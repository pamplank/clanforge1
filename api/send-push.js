// api/send-push.js
//
// This is the ONLY piece of code that ever touches the private VAPID key —
// it must run server-side (Vercel function), never in the browser, because
// anyone could read a private key shipped in frontend JS and use it to spam
// push notifications to your users under your identity.
//
// The frontend calls this with { memberName, title, body, url, tag } and
// this function looks up that member's saved push subscription(s) in
// Supabase and sends the actual push through web-push.

import webpush from "web-push";

const SUPA_URL = process.env.VITE_SUPABASE_URL;
const SUPA_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;

webpush.setVapidDetails(
  "mailto:admin@clanforge.app", // not a real inbox, just required by the push spec
  VAPID_PUBLIC,
  VAPID_PRIVATE
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!SUPA_URL || !SUPA_KEY || !VAPID_PUBLIC || !VAPID_PRIVATE) {
    return res.status(500).json({ error: "Server missing required environment variables" });
  }

  const { memberName, title, body, url, tag } = req.body || {};
  if (!memberName || !title) {
    return res.status(400).json({ error: "memberName and title are required" });
  }

  try {
    // Look up every subscription this member has registered (they might
    // have notifications enabled on more than one device/browser).
    const lookupRes = await fetch(
      `${SUPA_URL}/rest/v1/push_subscriptions?select=id,endpoint,p256dh,auth&member_name=eq.${encodeURIComponent(memberName)}`,
      { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } }
    );
    const subs = await lookupRes.json();
    if (!Array.isArray(subs) || subs.length === 0) {
      return res.status(200).json({ sent: 0, reason: "no subscriptions for this member" });
    }

    const payload = JSON.stringify({ title, body: body || "", url: url || "/", tag: tag || undefined });

    const results = await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        )
      )
    );

    // A subscription can go stale (user uninstalled, cleared site data, etc.)
    // — the push service responds 404/410 in that case. Clean those rows up
    // so we stop wasting calls on dead endpoints.
    const staleIds = [];
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const statusCode = r.reason?.statusCode;
        if (statusCode === 404 || statusCode === 410) staleIds.push(subs[i].id);
      }
    });
    if (staleIds.length > 0) {
      await fetch(`${SUPA_URL}/rest/v1/push_subscriptions?id=in.(${staleIds.map(encodeURIComponent).join(",")})`, {
        method: "DELETE",
        headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
      }).catch(() => {});
    }

    const sentCount = results.filter((r) => r.status === "fulfilled").length;
    return res.status(200).json({ sent: sentCount, total: subs.length });
  } catch (err) {
    console.error("send-push failed:", err);
    return res.status(500).json({ error: "Failed to send push" });
  }
}
