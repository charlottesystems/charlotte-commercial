// ============================================================
// CHARLOTTE PARKING — Service Worker
// Riceve push notification native dal browser
// ============================================================

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

// ── PUSH IN ARRIVO ────────────────────────────────────────────

self.addEventListener('push', event => {
  if (!event.data) return;

  let data;
  try { data = event.data.json(); }
  catch { data = { title: '📅 Charlotte Parking', body: event.data.text() }; }

  const options = {
    body: data.body || 'Tocca per visualizzare i dettagli',
    icon: '/charlotte-commercial/icon-512.png',
    badge: '/charlotte-commercial/icon-512.png',
    data: { url: data.url || '/charlotte-commercial/' },
    vibrate: [200, 100, 200],
    tag: 'charlotte-prenotazione',
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '📅 Nuova prenotazione', options)
  );
});

// ── TAP SULLA NOTIFICA ────────────────────────────────────────

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/charlotte-commercial/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('/charlotte-commercial/') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
