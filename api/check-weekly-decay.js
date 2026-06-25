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

const SUPA_URL = process.env.VITE_SUPABASE_URL;
const SUPA_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const CRON_SECRET = process.env.CRON_SECRET; // same secret used by check-ending-auctions

const GMT8_OFFSET_MS = 8 * 60 * 60 * 1000;

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

    const stateRes = await fetch(`${SUPA_URL}/rest/v1/app_state?select=value&key=eq.last_decay_ts`, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    });
    const stateRows = await stateRes.json();
    const lastDecayTs = Array.isArray(stateRows) && stateRows[0] ? Number(stateRows[0].value) || 0 : 0;

    if (lastDecayTs >= mostRecentScheduled) {
      return res.status(200).json({ ran: false, reason: "not due yet", lastDecayTs, mostRecentScheduled });
    }

    // Apply 5% decay to every member, same math as the old client-side logic.
    const membersRes = await fetch(`${SUPA_URL}/rest/v1/members?select=id,coins,decay_log,tx_log`, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    });
    const members = await membersRes.json();
    if (!Array.isArray(members) || members.length === 0) {
      return res.status(200).json({ ran: false, reason: "no members found" });
    }

    const decayDate = new Date().toLocaleDateString("en-US");
    const decayTs = Date.now();
    let totalDecayed = 0;

    const updates = members.map((m) => {
      const coins = Number(m.coins) || 0;
      const d = Math.floor(coins * 0.05);
      totalDecayed += d;
      let decayLog = [];
      try { decayLog = typeof m.decay_log === "string" ? JSON.parse(m.decay_log) : (m.decay_log || []); } catch {}
      decayLog = [...decayLog, { amount: -d, date: decayDate, ts: decayTs }];
      return { id: m.id, coins: coins - d, decay_log: JSON.stringify(decayLog) };
    });

    // Attach one consolidated tx_log announcement to the first member only,
    // matching the original behavior (single "All Members" row in the
    // Global Points Log instead of one entry per member).
    let firstMemberTxLog = [];
    try {
      const raw = members[0].tx_log;
      firstMemberTxLog = typeof raw === "string" ? JSON.parse(raw) : (raw || []);
    } catch {}
    firstMemberTxLog = [...firstMemberTxLog, {
      change: -totalDecayed,
      reason: `5% weekly coin decay applied to all ${members.length} members`,
      date: decayDate, logType: "Weekly Decay", addedBy: "System", ts: decayTs,
    }];
    updates[0].tx_log = JSON.stringify(firstMemberTxLog);

    await Promise.allSettled(
      updates.map((u) =>
        fetch(`${SUPA_URL}/rest/v1/members?id=eq.${encodeURIComponent(u.id)}`, {
          method: "PATCH",
          headers: {
            apikey: SUPA_KEY,
            Authorization: `Bearer ${SUPA_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify(u),
        })
      )
    );

    await fetch(`${SUPA_URL}/rest/v1/app_state?key=eq.last_decay_ts`, {
      method: "PATCH",
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value: String(mostRecentScheduled), updated_at: Date.now() }),
    });

    return res.status(200).json({ ran: true, membersAffected: members.length, totalDecayed });
  } catch (err) {
    console.error("check-weekly-decay failed:", err);
    return res.status(500).json({ error: "Failed to check/apply weekly decay" });
  }
}
