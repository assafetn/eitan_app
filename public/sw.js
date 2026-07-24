// Minimal service worker at root scope.
//
// This worker exists SOLELY to receive Web Push. It deliberately has NO fetch
// handler and does NOT touch the Cache API: a cache-first worker would keep
// serving stale JS/CSS after a Vercel deploy.

self.addEventListener('install', (e) => self.skipWaiting());

self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (err) {
    payload = {};
  }
  const title = payload.title || 'איתן';
  const options = {
    body: payload.body || '',
    tag: payload.tag || 'eitan-generic',
    dir: 'rtl',
    lang: 'he',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: payload.url || '/tasks' },
    renotify: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/tasks';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ('focus' in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      })
  );
});
