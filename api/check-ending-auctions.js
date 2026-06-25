// api/check-ending-auctions.js
//
// Triggered by an external free scheduler (cron-job.org) hitting this URL
// once a minute — NOT by Vercel's own built-in cron, because Vercel's free
// Hobby plan only allows cron jobs to run once per DAY, which is useless
// for catching auctions ending within the next couple of minutes.
//
// Looks for active auctions ending soon and sends a "your auction is
// ending soon" push to whoever is currently winning it.
//
// To avoid spamming the same person every single minute while an auction
// counts down, each auction is only notified once: we track this with a
// `ending_soon_notified` flag we set directly on the auctions table.

const SUPA_URL = process.env.VITE_SUPABASE_URL;
const SUPA_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const CRON_SECRET = process.env.CRON_SECRET; // set this yourself, see setup notes
const ENDING_SOON_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

export default async function handler(req, res) {
  // Anyone who finds this URL could otherwise trigger it repeatedly and
  // spam push notifications — require a shared secret, passed either as
  // ?key=... (what cron-job.org will use) or an Authorization header.
  const providedKey = req.query?.key || req.headers["authorization"]?.replace("Bearer ", "");
  if (!CRON_SECRET || providedKey !== CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const now = Date.now();
    const windowEnd = now + ENDING_SOON_WINDOW_MS;

    const resAuctions = await fetch(
      `${SUPA_URL}/rest/v1/auctions?select=id,name,top_bidder,ends_at,ending_soon_notified&status=eq.active&ends_at=lte.${windowEnd}&ends_at=gte.${now}`,
      { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } }
    );
    const auctions = await resAuctions.json();
    if (!Array.isArray(auctions) || auctions.length === 0) {
      return res.status(200).json({ checked: 0, notified: 0 });
    }

    const toNotify = auctions.filter((a) => a.top_bidder && !a.ending_soon_notified);
    const baseUrl = `https://${req.headers.host}`;

    await Promise.allSettled(
      toNotify.map(async (a) => {
        const minutesLeft = Math.max(1, Math.round((a.ends_at - now) / 60000));
        await fetch(`${baseUrl}/api/send-push`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            memberName: a.top_bidder,
            title: "Auction ending soon!",
            body: `${a.name} ends in ${minutesLeft} min — you're currently winning.`,
            url: "/?page=auctions",
            tag: `ending-${a.id}`,
          }),
        });
        // Mark this auction as already notified so it doesn't fire again
        // every minute until it actually ends.
        await fetch(`${SUPA_URL}/rest/v1/auctions?id=eq.${encodeURIComponent(a.id)}`, {
          method: "PATCH",
          headers: {
            apikey: SUPA_KEY,
            Authorization: `Bearer ${SUPA_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ending_soon_notified: true }),
        });
      })
    );

    return res.status(200).json({ checked: auctions.length, notified: toNotify.length });
  } catch (err) {
    console.error("check-ending-auctions failed:", err);
    return res.status(500).json({ error: "Failed to check ending auctions" });
  }
}