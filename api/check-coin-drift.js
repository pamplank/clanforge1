// api/check-coin-drift.js
//
// Triggered by the same free external scheduler (cron-job.org) used for
// check-ending-auctions and check-weekly-decay — NOT Vercel's built-in
// cron (Hobby plan only allows once/day). Recommended schedule: once
// nightly is plenty, since drift doesn't need real-time detection the
// way ending auctions do.
//
// Runs the SAME forward-ledger check as the in-app Drift Audit tab (see
// buildPointsHistoryEntries in src/App.jsx) across every member, and
// posts to Discord only when it finds a drift that wasn't already known
// about — so this alerts once per new problem, not once per night
// forever for the same still-open issue (e.g. ikillyou's long-standing
// 480 drift, deliberately left uncorrected pending investigation,
// shouldn't spam the channel on every run).
//
// Deliberately detect-and-alert only, NOT auto-correct: every real drift
// this clan has hit so far needed a different fix (claw back real coins
// vs. backfill the log, which entry was the phantom one, etc.) — see the
// tx_log comments on Isabella's and ikillyou's corrections. A previous
// automatic-style correction attempt on ikillyou's account (7/15) used
// the wrong sign and doubled her gap instead of closing it. This script
// exists to make sure a human notices promptly, not to replace the
// human judgment call.
//
// Known-drift state is stored in app_state (key="known_coin_drift") as
// {memberId: driftAmount}, the same table/pattern check-weekly-decay
// already uses for last_decay_ts — no new table needed.
//
// Also runs two related checks discovered the same way this drift check
// was originally found — by hand, after the fact, once someone noticed a
// specific member's numbers looked wrong:
//
// 1. ATTENDANCE HISTORY GAPS: attendance_logs.attendees is the
//    authoritative record of who was marked present and what they were
//    supposed to earn for an event (written once, at submission time,
//    unaffected by later per-member writes) — but a since-fixed bug in
//    setMembers could silently wipe a member's own attend_log/tx_log
//    entry for that same event afterward. Cross-checking the two catches
//    exactly that gap: present in the event record, missing from the
//    member's own history. Scoped to a rolling window (ATTENDANCE_WINDOW_MS
//    below) rather than all-time, since this only needs to catch RECENT
//    gaps — rescanning the entire history every night forever is wasted
//    work once older gaps are backfilled.
//
// 2. RESURRECTED / DUPLICATE MEMBERS: a member whose join_date is recent
//    but who's listed as an attendee on an event dated BEFORE that
//    join_date is a member whose original account was lost (deleted, or
//    replaced by a fresh row) and re-added — silently losing all prior
//    coins/attendance/rarity/power history in the process (see Khaleesy,
//    found 2026-08-07: join_date 8/6, but present at an 8/3 event under
//    her real, since-lost account). This can't be auto-fixed (the old
//    history is genuinely gone, not just miscounted) — it's flagged so a
//    human knows to go looking for what else that member might be
//    missing beyond just attendance (rarity, power, coins earned before
//    the loss, etc.).
//
// Same philosophy as the drift check above: alert once per new finding,
// never auto-correct. Known state for these two lives in app_state keys
// "known_attendance_gaps" (array of "member|event|date" strings) and
// "known_resurrected_members" (array of member ids).

const ATTENDANCE_WINDOW_MS = 21 * 24 * 60 * 60 * 1000; // 21 days

const SUPA_URL = process.env.VITE_SUPABASE_URL;
const SUPA_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const CRON_SECRET = process.env.CRON_SECRET; // same secret used by the other cron endpoints
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL_GENERAL;

function safeJsonArray(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

function logSortKey(entry) {
  if (entry?.ts) return entry.ts;
  const d = new Date(entry?.date);
  return isNaN(d) ? 0 : d.getTime();
}

// Mirrors analyzeDriftCauses in src/App.jsx (duplicate-burst detection
// only — the unresolved-bid check there needs the live auctions table,
// too heavy for a nightly alert; the in-app Drift Audit tab still covers
// it). Terse on purpose: this feeds a Discord line, not a full report.
function findDuplicateBurst(member) {
  const DUP_WINDOW_MS = 120000;
  const txLog = safeJsonArray(member.tx_log).filter((e) => e.ts).sort((a, b) => a.ts - b.ts);
  const used = new Set();
  for (let i = 0; i < txLog.length; i++) {
    if (used.has(i)) continue;
    const e = txLog[i];
    const group = [i];
    for (let j = i + 1; j < txLog.length; j++) {
      if (used.has(j)) continue;
      const o = txLog[j];
      if (o.ts - e.ts > DUP_WINDOW_MS) break;
      if (o.logType === e.logType && o.reason === e.reason && o.change === e.change) group.push(j);
    }
    if (group.length > 1) {
      group.forEach((idx) => used.add(idx));
      return `${group.length}x "${e.reason}" within ${Math.round((txLog[group[group.length - 1]].ts - txLog[group[0]].ts) / 1000)}s — check for a duplicate-entry burst`;
    }
  }
  return null;
}

// Same math as buildPointsHistoryEntries in src/App.jsx: a forward ledger
// built from zero (not anchored to the live coin total, which would hide
// drift by construction — see the Balance-column fix this mirrors).
function computeDrift(member) {
  const attendLog = safeJsonArray(member.attend_log).map((l) => ({ ts: l.ts, date: l.date, coins: l.coins }));
  const decayLog = safeJsonArray(member.decay_log).map((d) => ({ ts: d.ts, date: d.date, coins: d.amount }));
  const txLog = safeJsonArray(member.tx_log)
    .filter((e) => e.logType !== "Weekly Decay")
    .map((e) => ({ ts: e.ts, date: e.date, coins: e.change }));
  const entries = [...attendLog, ...decayLog, ...txLog].sort((a, b) => logSortKey(a) - logSortKey(b));
  let logTotal = 0;
  entries.forEach((e) => { logTotal += Number(e.coins) || 0; });
  return { logTotal, liveTotal: Number(member.coins) || 0, drift: (Number(member.coins) || 0) - logTotal };
}

// attendance_logs.date / members.join_date are both "M/D/YYYY" strings
// (toLocaleDateString-style, no leading zeros) — plain `new Date(str)`
// parses that correctly as US-format.
function parseUsDate(str) {
  const d = new Date(str);
  return isNaN(d) ? null : d;
}

// Cross-checks attendance_logs.attendees (authoritative — written once at
// submission, not touched afterward) against each member's own attend_log,
// for events within the last ATTENDANCE_WINDOW_MS. Returns one entry per
// missing (member, event, date) combo, keyed for dedup against known state.
function findAttendanceGaps(attendanceLogs, membersByName) {
  const cutoff = Date.now() - ATTENDANCE_WINDOW_MS;
  const gaps = [];
  attendanceLogs.forEach((log) => {
    const logTs = Number(log.id);
    if (!logTs || logTs < cutoff) return;
    const attendees = safeJsonArray(log.attendees);
    attendees.forEach((att) => {
      const member = membersByName.get(att.name);
      if (!member) return; // member no longer exists — nothing to flag
      const hasEntry = safeJsonArray(member.attend_log).some(
        (e) => e.event === log.event && e.date === log.date
      );
      if (!hasEntry) {
        gaps.push({ key: `${att.name}|${log.event}|${log.date}`, member: att.name, event: log.event, date: log.date, earned: att.earned });
      }
    });
  });
  return gaps;
}

// A member whose join_date is recent but who's listed as an attendee on an
// event dated BEFORE that join_date has a lost-and-recreated account.
function findResurrectedMembers(members, attendanceLogs) {
  const recentCutoff = Date.now() - ATTENDANCE_WINDOW_MS;
  const found = [];
  members.forEach((m) => {
    if (!m.join_date) return;
    const joinDate = parseUsDate(m.join_date);
    if (!joinDate || joinDate.getTime() < recentCutoff) return; // only recently-(re)joined members are suspects
    const earlierEvent = attendanceLogs.find((log) => {
      if (!safeJsonArray(log.attendees).some((a) => a.name === m.name)) return false;
      const eventDate = parseUsDate(log.date);
      return eventDate && eventDate.getTime() < joinDate.getTime();
    });
    if (earlierEvent) {
      found.push({ id: m.id, name: m.name, joinDate: m.join_date, earlierEvent: earlierEvent.event, earlierDate: earlierEvent.date });
    }
  });
  return found;
}

export default async function handler(req, res) {
  const providedKey = req.query?.key || req.headers["authorization"]?.replace("Bearer ", "");
  if (!CRON_SECRET || providedKey !== CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!SUPA_URL || !SUPA_KEY) {
    return res.status(500).json({ error: "Server missing required environment variables" });
  }

  try {
    const attendanceCutoff = Date.now() - ATTENDANCE_WINDOW_MS;
    const [membersRes, attendanceRes, stateRes] = await Promise.all([
      fetch(`${SUPA_URL}/rest/v1/members?select=id,name,join_date,coins,tx_log,attend_log,decay_log`, {
        headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
      }),
      // id is a text column holding a ms-timestamp string, but every id in
      // this table is the same digit-length, so a lexicographic gte filter
      // here matches numeric gte — no need to pull the whole table.
      fetch(`${SUPA_URL}/rest/v1/attendance_logs?select=id,date,event,attendees&id=gte.${attendanceCutoff}`, {
        headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
      }),
      fetch(`${SUPA_URL}/rest/v1/app_state?select=key,value&key=in.(known_coin_drift,known_attendance_gaps,known_resurrected_members)`, {
        headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
      }),
    ]);
    const members = await membersRes.json();
    if (!Array.isArray(members)) {
      return res.status(500).json({ error: "Failed to load members" });
    }
    const attendanceLogs = await attendanceRes.json();
    const stateRows = await stateRes.json();
    const stateByKey = {};
    if (Array.isArray(stateRows)) stateRows.forEach((r) => { stateByKey[r.key] = r.value; });
    function parseState(key, fallback) {
      try { return stateByKey[key] ? JSON.parse(stateByKey[key]) : fallback; } catch { return fallback; }
    }
    const knownDrift = parseState("known_coin_drift", {});
    const knownGapKeys = new Set(parseState("known_attendance_gaps", []));
    const knownResurrectedIds = new Set(parseState("known_resurrected_members", []));

    const currentDrift = {};
    const newOrChanged = [];
    members.forEach((m) => {
      const { logTotal, liveTotal, drift } = computeDrift(m);
      if (drift === 0) return;
      currentDrift[m.id] = drift;
      const prev = knownDrift[m.id];
      if (prev === undefined || prev !== drift) {
        newOrChanged.push({ id: m.id, name: m.name, logTotal, liveTotal, drift, prevDrift: prev, cause: findDuplicateBurst(m) });
      }
    });

    const membersByName = new Map(members.map((m) => [m.name, m]));
    const allGaps = Array.isArray(attendanceLogs) ? findAttendanceGaps(attendanceLogs, membersByName) : [];
    const newGaps = allGaps.filter((g) => !knownGapKeys.has(g.key));
    const allResurrected = Array.isArray(attendanceLogs) ? findResurrectedMembers(members, attendanceLogs) : [];
    const newResurrected = allResurrected.filter((r) => !knownResurrectedIds.has(r.id));

    // Persist each check's full current snapshot (including unchanged
    // findings) so the next run's diff is against this run's reality.
    await Promise.all([
      fetch(`${SUPA_URL}/rest/v1/app_state?on_conflict=key`, {
        method: "POST",
        headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ key: "known_coin_drift", value: JSON.stringify(currentDrift), updated_at: Date.now() }),
      }),
      fetch(`${SUPA_URL}/rest/v1/app_state?on_conflict=key`, {
        method: "POST",
        headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ key: "known_attendance_gaps", value: JSON.stringify(allGaps.map((g) => g.key)), updated_at: Date.now() }),
      }),
      fetch(`${SUPA_URL}/rest/v1/app_state?on_conflict=key`, {
        method: "POST",
        headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ key: "known_resurrected_members", value: JSON.stringify(allResurrected.map((r) => r.id)), updated_at: Date.now() }),
      }),
    ]);

    const sections = [];
    if (newOrChanged.length > 0) {
      const lines = newOrChanged.map((r) => {
        const sign = r.drift > 0 ? "+" : "";
        const changeNote = r.prevDrift !== undefined ? ` (was ${r.prevDrift > 0 ? "+" : ""}${r.prevDrift})` : " (new)";
        const causeNote = r.cause ? `\n  💡 ${r.cause}` : "";
        return `• **${r.name}** — log total ${r.logTotal}, live balance ${r.liveTotal}, drift **${sign}${r.drift}**${changeNote}${causeNote}`;
      });
      sections.push(`⚠️ **Coin Drift** — ${newOrChanged.length} member(s) with new or changed drift:\n${lines.join("\n")}`);
    }
    if (newGaps.length > 0) {
      const lines = newGaps.map((g) => `• **${g.member}** — missing "${g.event}" (${g.date}), ${g.earned} coins never landed in their history`);
      sections.push(`📋 **Attendance History Gaps** — ${newGaps.length} entr${newGaps.length === 1 ? "y" : "ies"} present in an event record but missing from the member's own history:\n${lines.join("\n")}`);
    }
    if (newResurrected.length > 0) {
      const lines = newResurrected.map((r) => `• **${r.name}** — joined ${r.joinDate}, but attended "${r.earlierEvent}" on ${r.earlierDate} (before that join date) — likely a lost/recreated account`);
      sections.push(`👻 **Possibly Resurrected Members** — ${newResurrected.length} member(s) whose account may have lost its real history:\n${lines.join("\n")}`);
    }

    if (sections.length > 0 && DISCORD_WEBHOOK_URL) {
      await fetch(DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `**Nightly Audit**\n\n${sections.join("\n\n")}\n\nCheck the Drift Audit tab in-app (Master only) before correcting — this alert does not auto-fix anything.`,
        }),
      }).catch((e) => console.error("check-coin-drift: Discord post failed:", e));
    }

    return res.status(200).json({
      checked: members.length,
      totalWithDrift: Object.keys(currentDrift).length,
      newOrChanged: newOrChanged.length,
      attendanceGaps: { total: allGaps.length, new: newGaps.length },
      resurrectedMembers: { total: allResurrected.length, new: newResurrected.length },
      alerted: sections.length > 0 && !!DISCORD_WEBHOOK_URL,
    });
  } catch (err) {
    console.error("check-coin-drift failed:", err);
    return res.status(500).json({ error: "Failed to check coin drift" });
  }
}
