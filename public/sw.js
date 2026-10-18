// public/sw.js
// Meridian service worker: push notifications only.
// It does no caching, so it cannot change how the app loads.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Meridian', {
      body: data.body || 'Time to close out today.',
      icon: '/android-chrome-192x192.png',
      badge: '/android-chrome-192x192.png',
      tag: data.tag || 'meridian',
      renotify: true,
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => 'focus' in w);
      if (open) {
        if (url !== '/' && 'navigate' in open) { try { open.navigate(url); } catch (e) { /* ignore */ } }
        return open.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
