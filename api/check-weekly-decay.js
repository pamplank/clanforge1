// api/check-weekly-decay.js
//
// Triggered by the same free external scheduler (cron-job.org) used for
// the auction-ending-soon check — NOT Vercel's built-in cron, since
// Vercel's free Hobby plan only allows cron jobs once per day, and this
// needs to be checked more often than that to land close to the actual
// scheduled moment.
//
// Replaces the old localStorage-based tracking, which only lived on
// whichever single browser/device the Master happened to have open —
// meaning decay could silently never run if that device/session never
// lined up with the scheduled time. This checks against a shared,
// persistent timestamp stored in Supabase instead, so it works
// regardless of whether anyone has the app open at all.
//
// SCHEDULE: every Tuesday at 7:00 AM GMT+8 (Asia/Manila time).
//
// DECAY RATE: now read from the same app_state table (key="decay_rate"),
// same as last_decay_ts, instead of being hardcoded here. The main app
// (Settings > Coin Decay) writes this row when a Master edits the rate.
// Falls back to 0.05 (5%) if no row exists yet, matching the original
// hardcoded behavior so nothing changes until a Master actually edits it.

const SUPA_URL = process.env.VITE_SUPABASE_URL;
const SUPA_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const CRON_SECRET = process.env.CRON_SECRET; // same secret used by check-ending-auctions

const GMT8_OFFSET_MS = 8 * 60 * 60 * 1000;
const DEFAULT_DECAY_RATE = 0.05;

// Returns the timestamp (real UTC ms) of the most recent Tuesday 7:00 AM
// GMT+8 that has already happened, relative to right now.
function getLastTuesday7amGmt8() {
  const nowMs = Date.now();
  const shifted = new Date(nowMs + GMT8_OFFSET_MS);
  const day = shifted.getUTCDay(); // 0=Sun,1=Mon,2=Tue,... in the GMT+8-shifted frame
  const diffToTuesday = day >= 2 ? day - 2 : day + 5;
  const tuesdayShifted = new Date(shifted);
  tuesdayShifted.setUTCDate(shifted.getUTCDate() - diffToTuesday);
  tuesdayShifted.setUTCHours(7, 0, 0, 0);
  if (tuesdayShifted.getTime() > shifted.getTime()) {
    tuesdayShifted.setUTCDate(tuesdayShifted.getUTCDate() - 7);
  }
  return tuesdayShifted.getTime() - GMT8_OFFSET_MS;
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
    const mostRecentScheduled = getLastTuesday7amGmt8();

    // Fetch both last_decay_ts and decay_rate in one query, same table.
    const stateRes = await fetch(`${SUPA_URL}/rest/v1/app_state?select=key,value&key=in.(last_decay_ts,decay_rate)`, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    });
    const stateRows = await stateRes.json();
    const stateMap = {};
    if (Array.isArray(stateRows)) stateRows.forEach((r) => { stateMap[r.key] = r.value; });

    const lastDecayTs = Number(stateMap.last_decay_ts) || 0;
    const parsedRate = parseFloat(stateMap.decay_rate);
    const decayRate = Number.isFinite(parsedRate) && parsedRate >= 0 ? parsedRate : DEFAULT_DECAY_RATE;

    if (lastDecayTs >= mostRecentScheduled) {
      return res.status(200).json({ ran: false, reason: "not due yet", lastDecayTs, mostRecentScheduled });
    }

    // Apply decay (decayRate, e.g. 0.05 = 5%) to every member, same math as
    // the old client-side logic, now using the configurable rate.
    const membersRes = await fetch(`${SUPA_URL}/rest/v1/members?select=id,coins,decay_log,tx_log`, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    });
    const members = await membersRes.json();
    if (!Array.isArray(members) || members.length === 0) {
      return res.status(200).json({ ran: false, reason: "no members found" });
    }

    const decayDate = new Date().toLocaleDateString("en-US");
    const decayTs = Date.now();
    const ratePct = Math.round(decayRate * 1000) / 10; // e.g. 0.05 -> 5, 0.075 -> 7.5

    // ROOT CAUSE of a real incident: this used to fire every member PATCH
    // with Promise.allSettled and never look at the results, then advance
    // last_decay_ts unconditionally. allSettled never rejects — so if
    // every single PATCH failed (network blip, Supabase hiccup, anything),
    // this job still reported success and marked the week as "handled,"
    // permanently. That's exactly what happened on 2026-07-07: last_decay_ts
    // advanced right on schedule, but zero members show a decay_log/tx_log
    // entry from that run. Nothing retried it, because nothing knew it failed.
    //
    // Fix: skip members who already have a decay_log entry at/after this
    // run's scheduled timestamp (idempotent per-member guard — makes a
    // retry safe, since already-succeeded members won't be decayed twice),
    // actually check each PATCH's response status, and only advance
    // last_decay_ts once every member is confirmed decayed (either just
    // now, or already, from an earlier partial run). If any fail, leave
    // last_decay_ts alone so the next scheduler tick retries just the
    // failures — visible in the response instead of silently "succeeding".
    const alreadyDone = [];
    const toUpdate = [];
    members.forEach((m) => {
      let decayLog = [];
      try { decayLog = typeof m.decay_log === "string" ? JSON.parse(m.decay_log) : (m.decay_log || []); } catch {}
      if (decayLog.some((e) => (e.ts || 0) >= mostRecentScheduled)) {
        alreadyDone.push(m.id);
        return;
      }
      const coins = Number(m.coins) || 0;
      const d = Math.floor(coins * decayRate);
      decayLog = [...decayLog, { amount: -d, date: decayDate, ts: decayTs }];
      toUpdate.push({ id: m.id, coins: coins - d, decay_log: JSON.stringify(decayLog), _amount: d });
    });

    let totalDecayed = 0;
    toUpdate.forEach((u) => { totalDecayed += u._amount; });

    // Attach one consolidated tx_log announcement to the first member being
    // updated this run (not just members[0] overall, since that member may
    // already be done from a prior partial run) — matches the original
    // "single combined row" behavior in the Global Points Log.
    if (toUpdate.length > 0) {
      const firstUpdate = toUpdate[0];
      const firstMember = members.find((m) => String(m.id) === String(firstUpdate.id));
      let firstMemberTxLog = [];
      try {
        const raw = firstMember?.tx_log;
        firstMemberTxLog = typeof raw === "string" ? JSON.parse(raw) : (raw || []);
      } catch {}
      firstMemberTxLog = [...firstMemberTxLog, {
        change: -totalDecayed,
        reason: `${ratePct}% weekly coin decay applied to all ${toUpdate.length} members`,
        date: decayDate, logType: "Weekly Decay", addedBy: "System", ts: decayTs,
      }];
      firstUpdate.tx_log = JSON.stringify(firstMemberTxLog);
    }

    const results = await Promise.allSettled(
      toUpdate.map(({ _amount, ...u }) =>
        fetch(`${SUPA_URL}/rest/v1/members?id=eq.${encodeURIComponent(u.id)}`, {
          method: "PATCH",
          headers: {
            apikey: SUPA_KEY,
            Authorization: `Bearer ${SUPA_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify(u),
        }).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r; })
      )
    );

    const failed = [];
    results.forEach((r, i) => { if (r.status === "rejected") failed.push({ id: toUpdate[i].id, error: String(r.reason) }); });
    const succeeded = toUpdate.length - failed.length;

    if (failed.length === 0) {
      // Every member (whether just now or in an earlier partial run) is
      // confirmed decayed for this scheduled run — safe to advance.
      await fetch(`${SUPA_URL}/rest/v1/app_state?key=eq.last_decay_ts`, {
        method: "PATCH",
        headers: {
          apikey: SUPA_KEY,
          Authorization: `Bearer ${SUPA_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value: String(mostRecentScheduled), updated_at: Date.now() }),
      });
    } else {
      console.error(`check-weekly-decay: ${failed.length}/${toUpdate.length} member updates failed, NOT advancing last_decay_ts so the next run retries them:`, failed);
    }

    return res.status(200).json({
      ran: true,
      alreadyDone: alreadyDone.length,
      attempted: toUpdate.length,
      succeeded,
      failed: failed.length,
      failedIds: failed.map((f) => f.id),
      totalDecayed,
      decayRate,
      advancedSchedule: failed.length === 0,
    });
  } catch (err) {
    console.error("check-weekly-decay failed:", err);
    return res.status(500).json({ error: "Failed to check/apply weekly decay" });
  }
}