/* Travel Together service worker: shows background push notifications and opens the right page on click. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { /* plain text payload */ }
  event.waitUntil(self.registration.showNotification(d.title || 'Travel Together', { body: d.body || '', icon: '/icon.svg', badge: '/icon.svg', data: { url: d.url || '/' }, tag: d.url || 'tt' }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) { try { c.navigate(url); } catch { /* ignore */ } return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
