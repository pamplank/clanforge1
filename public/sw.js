// public/sw.js
//
// This file runs in the background, separately from the React app — the
// browser keeps it alive even when no ClanForge tab is open, which is what
// lets a push notification show up at all. It does two things:
//   1. "push"         — a push arrived from the server; show it as a
//                        native OS notification.
//   2. "notificationclick" — the user tapped the notification; focus an
//                        existing ClanForge tab if one's open, or open a
//                        new one to the Auctions page.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "ClanForge", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "ClanForge";
  const options = {
    body: data.body || "",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    data: { url: data.url || "/" },
    tag: data.tag || undefined, // same tag replaces an existing notification instead of stacking
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
