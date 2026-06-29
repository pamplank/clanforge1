// /api/discord-notify.js
//
// A small server-side proxy between ClanForge and Discord. The real
// webhook URLs live only here, as Vercel environment variables — they
// never get sent to the browser, so they can't be read from dev tools
// or page source the way they could if the app called Discord directly
// from client-side JS.
//
// Supports MULTIPLE channels (e.g. general announcements vs auctions)
// by mapping a "channel" field in the request body to a specific
// environment variable. Add more entries to WEBHOOK_MAP below if you
// want additional channels later — each one just needs its own webhook
// URL and its own env var.
//
// The browser calls THIS endpoint (same domain, no CORS issues) with
// { channel, content } (or { channel, embeds }); this function looks up
// the right webhook for that channel and forwards the message
// server-side, returning Discord's response status back to the browser.
//
// Setup (one-time):
//   1. In Discord, create a webhook for EACH channel you want to post to
//      (Server Settings → Integrations → Webhooks → New Webhook, pick
//      the channel, copy the URL). Repeat per channel.
//   2. In Vercel, go to your project → Settings → Environment Variables
//      and add one variable per channel (see WEBHOOK_MAP below for the
//      exact names expected).
//   3. Redeploy so the new environment variables take effect.
//
// This file goes in /api/discord-notify.js at the root of your project
// (same level as package.json) — Vercel automatically turns any file in
// /api into a serverless endpoint at /api/<filename>.

// Maps a "channel" key (sent from the app) to the Vercel environment
// variable holding that channel's webhook URL. "general" is used as the
// fallback if the app doesn't specify a channel, or specifies one that
// isn't in this map — keeps old call sites working even before they're
// updated to pick a specific channel.
const WEBHOOK_MAP = {
  general: "DISCORD_WEBHOOK_URL_GENERAL",
  auctions: "DISCORD_WEBHOOK_URL_AUCTIONS",
};

export default async function handler(req, res) {
  // Only accept POST — this endpoint has one job (forward a message),
  // there's nothing to GET.
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { channel, ...payload } = req.body || {};
  const envVarName = WEBHOOK_MAP[channel] || WEBHOOK_MAP.general;
  const webhookUrl = process.env[envVarName];

  if (!webhookUrl) {
    // Misconfiguration on the server side (env var not set) — fail
    // clearly rather than silently doing nothing, so whoever's testing
    // this knows exactly which environment variable to go check.
    return res.status(500).json({ error: `${envVarName} is not configured on the server` });
  }

  try {
    const discordRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!discordRes.ok) {
      const text = await discordRes.text().catch(() => "");
      return res.status(discordRes.status).json({ error: "Discord rejected the message", detail: text });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to reach Discord", detail: String(err) });
  }
}
