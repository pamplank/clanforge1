// api/clear-auction-history.js
//
// Triggered by the same free external scheduler (cron-job.org) used for
// the auction-ending-soon check and the weekly decay job — NOT Vercel's
// built-in cron, since Vercel's free Hobby plan only allows cron jobs
// once per day and this only needs to run about once a week anyway.
//
// The `auctions` table keeps every auction ever created, active or ended,
// forever — every client's load-all-data fetch and 3s poll pulls the
// WHOLE table (see AUCTION_LIST_COLS usage in App.jsx), so as ended
// auctions pile up week over week, every page load and poll gets heavier
// for everyone. This trims it back down by deleting ended auctions once
// they're older than the retention window.
//
// SAFE to delete: a member's own win/coin history (Leaderboard wins,
// coin transaction log) is a self-contained snapshot written directly
// onto that member's own row when they win (see claimAuctionWinAndLog /
// incrementAuctionWinAtomic in App.jsx) — nothing there is looked up from
// the `auctions` table when displaying player history, so purging old
// auction rows here only empties the Auction House's own History tab,
// never a player's personal record.
//
// RETENTION: 14 days — an ended auction stays visible in the in-app
// History tab for two weeks after it closes, then gets purged the next
// time this runs.
//
// SCHEDULE: checked against a shared, persistent timestamp in Supabase
// (app_state, key="last_history_cleanup_ts") rather than any one
// browser's local clock/localStorage, so it runs on schedule regardless
// of whether anyone has the app open — same pattern as check-weekly-decay.

const SUPA_URL = process.env.VITE_SUPABASE_URL;
const SUPA_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const CRON_SECRET = process.env.CRON_SECRET; // same secret used by the other cron endpoints

const RETENTION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // only actually run once a week

export default async function handler(req, res) {
  const providedKey = req.query?.key || req.headers["authorization"]?.replace("Bearer ", "");
  if (!CRON_SECRET || providedKey !== CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!SUPA_URL || !SUPA_KEY) {
    return res.status(500).json({ error: "Server missing required environment variables" });
  }

  try {
    const now = Date.now();

    const stateRes = await fetch(`${SUPA_URL}/rest/v1/app_state?select=key,value&key=eq.last_history_cleanup_ts`, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    });
    const stateRows = await stateRes.json();
    const lastRunTs = Array.isArray(stateRows) && stateRows[0] ? Number(stateRows[0].value) || 0 : 0;

    if (now - lastRunTs < CHECK_INTERVAL_MS) {
      return res.status(200).json({ ran: false, reason: "not due yet", lastRunTs });
    }

    const cutoff = now - RETENTION_MS;

    // Count first so the response reports something meaningful even
    // though DELETE with Prefer: return=minimal below won't echo rows.
    const countRes = await fetch(
      `${SUPA_URL}/rest/v1/auctions?select=id&status=eq.ended&ends_at=lt.${cutoff}`,
      { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } }
    );
    const toDelete = await countRes.json();
    const deleteCount = Array.isArray(toDelete) ? toDelete.length : 0;

    if (deleteCount > 0) {
      await fetch(`${SUPA_URL}/rest/v1/auctions?status=eq.ended&ends_at=lt.${cutoff}`, {
        method: "DELETE",
        headers: {
          apikey: SUPA_KEY,
          Authorization: `Bearer ${SUPA_KEY}`,
          Prefer: "return=minimal",
        },
      });
    }

    // Real upsert (not PATCH) — unlike last_decay_ts, nothing else ever
    // seeds this row client-side, so PATCH alone would silently match zero
    // rows forever and this job would re-run on every single cron tick
    // instead of settling into the intended weekly cadence.
    await fetch(`${SUPA_URL}/rest/v1/app_state?on_conflict=key`, {
      method: "POST",
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({ key: "last_history_cleanup_ts", value: String(now), updated_at: now }),
    });

    return res.status(200).json({ ran: true, deleted: deleteCount, cutoff });
  } catch (err) {
    console.error("clear-auction-history failed:", err);
    return res.status(500).json({ error: "Failed to clear auction history" });
  }
}
