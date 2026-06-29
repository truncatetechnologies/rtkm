// RTKM web push service worker — shows OS notifications even when the tab/app is closed.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: "RTKM", body: event.data ? event.data.text() : "" }; }
  const title = data.title || "RTKM";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: (data.data && data.data.link) || "rtkm",
      data: data.data || {},
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/app";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes("/app") && "focus" in w) { w.navigate && w.navigate(link); return w.focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(link);
    })
  );
});
