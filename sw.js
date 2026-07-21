// sw.js — HUB.nexus Service Worker (Web Push)
// Deve ficar na RAIZ do projeto: /sw.js

self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  if (!e.data) return;

  let payload;
  try { payload = e.data.json(); }
  catch { payload = { title: 'HUB.nexus', body: e.data.text() }; }

  const options = {
    body:    payload.body  || '',
    icon:    payload.icon  || '/assets/logo.png',
    badge:   '/assets/logo.png',
    tag:     payload.tag   || 'hubnexus-' + Date.now(),
    data:    { url: payload.url || '/' },
    actions: payload.url ? [{ action: 'open', title: 'Ver →' }] : [],
    vibrate: [200, 100, 200],
  };

  e.waitUntil(
    self.registration.showNotification(payload.title || 'HUB.nexus', options)
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const match = clients.find(c => c.url.includes(self.location.origin));
      if (match) { match.focus(); match.navigate(url); }
      else self.clients.openWindow(url);
    })
  );
});
