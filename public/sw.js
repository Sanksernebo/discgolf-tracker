/**
 * Service worker for push notifications and PWA install.
 * Kept intentionally minimal: no offline caching, no route interception —
 * just what we need to receive pushes and route the tap to the app.
 */

self.addEventListener("install", (event) => {
  // Take over immediately on first install so the page doesn't need reload.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = { title: "Discgolfi jälgija", body: "" };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    payload.body = event.data.text();
  }
  const { title, body, url, tag } = payload;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: tag || "discgolf-tracker",
      renotify: true,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Focus an existing tab if we have one; otherwise open a new one.
      for (const client of allClients) {
        if ("focus" in client) {
          if (client.url.endsWith(targetUrl)) return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
