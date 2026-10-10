// Service Worker para o app do garçom — Web Push + click handler
// Este SW NÃO faz cache (preview-safe). Foco apenas em receber push.
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Bora Uai', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Bora Uai';
  const options = {
    body: data.body || '',
    icon: '/placeholder.svg',
    badge: '/placeholder.svg',
    tag: data.tag,
    data: { url: data.url || '/garcom' },
    vibrate: data.vibrate || [200, 100, 200],
    requireInteraction: data.requireInteraction === true,
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/garcom';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Se já houver janela aberta em /garcom, foca nela
      for (const c of clients) {
        if (c.url.includes('/garcom') && 'focus' in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
