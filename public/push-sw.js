// Push notification handlers for Atlas PWA
// This file is loaded by the main service worker

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: "Atlas",
      body: event.data.text(),
      icon: "/logo.png",
      url: "/dashboard",
    };
  }

  const { title = "Atlas", body = "", icon = "/logo.png", badge = "/icons/icon-72x72.png", url = "/dashboard", tag = "atlas-notif", actions } = payload;

  const options = {
    body,
    icon,
    badge,
    tag,
    data: { url },
    vibrate: [100, 50, 100],
    renotify: true,
  };

  if (actions && Array.isArray(actions)) {
    options.actions = actions;
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Try to focus an existing window
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(targetUrl);
    })
  );
});
