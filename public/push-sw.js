// Push notification service worker
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const payload = event.data.json();

  const options = {
    body: payload.body || "",
    icon: payload.icon || "/favicon.ico",
    badge: "/favicon.ico",
    tag: payload.tag || "default",
    data: payload.data || {},
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || "Hypnos Cafe", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/billing") || client.url.includes("/dashboard")) {
          return client.focus();
        }
      }
      return clients.openWindow("/dashboard");
    })
  );
});
