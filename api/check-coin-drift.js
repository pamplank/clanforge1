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

export default async function handler(req, res) {
  const providedKey = req.query?.key || req.headers["authorization"]?.replace("Bearer ", "");
  if (!CRON_SECRET || providedKey !== CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!SUPA_URL || !SUPA_KEY) {
    return res.status(500).json({ error: "Server missing required environment variables" });
  }

  try {
    const [membersRes, stateRes] = await Promise.all([
      fetch(`${SUPA_URL}/rest/v1/members?select=id,name,coins,tx_log,attend_log,decay_log`, {
        headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
      }),
      fetch(`${SUPA_URL}/rest/v1/app_state?select=key,value&key=eq.known_coin_drift`, {
        headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
      }),
    ]);
    const members = await membersRes.json();
    if (!Array.isArray(members)) {
      return res.status(500).json({ error: "Failed to load members" });
    }
    const stateRows = await stateRes.json();
    let knownDrift = {};
    try {
      const raw = Array.isArray(stateRows) && stateRows[0] ? stateRows[0].value : null;
      knownDrift = raw ? JSON.parse(raw) : {};
    } catch { knownDrift = {}; }

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

    // Persist the full current snapshot (including unchanged entries) so
    // next run's diff is against this run's reality, not a stale one.
    await fetch(`${SUPA_URL}/rest/v1/app_state?on_conflict=key`, {
      method: "POST",
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({ key: "known_coin_drift", value: JSON.stringify(currentDrift), updated_at: Date.now() }),
    });

    if (newOrChanged.length > 0 && DISCORD_WEBHOOK_URL) {
      const lines = newOrChanged.map((r) => {
        const sign = r.drift > 0 ? "+" : "";
        const changeNote = r.prevDrift !== undefined ? ` (was ${r.prevDrift > 0 ? "+" : ""}${r.prevDrift})` : " (new)";
        const causeNote = r.cause ? `\n  💡 ${r.cause}` : "";
        return `• **${r.name}** — log total ${r.logTotal}, live balance ${r.liveTotal}, drift **${sign}${r.drift}**${changeNote}${causeNote}`;
      });
      await fetch(DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `⚠️ **Coin Drift Audit** found ${newOrChanged.length} member(s) with new or changed drift:\n${lines.join("\n")}\n\nCheck the Drift Audit tab in-app (Master only) before correcting — this alert does not auto-fix anything.`,
        }),
      }).catch((e) => console.error("check-coin-drift: Discord post failed:", e));
    }

    return res.status(200).json({
      checked: members.length,
      totalWithDrift: Object.keys(currentDrift).length,
      newOrChanged: newOrChanged.length,
      alerted: newOrChanged.length > 0 && !!DISCORD_WEBHOOK_URL,
    });
  } catch (err) {
    console.error("check-coin-drift failed:", err);
    return res.status(500).json({ error: "Failed to check coin drift" });
  }
}
