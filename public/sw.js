// Service Worker do Bora Uai — Push Notifications Nativas Android / PWA
// Recebe push mesmo com o aplicativo fechado ou em segundo plano (estilo Shopee, iFood, 99)

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
    icon: data.icon || '/pwa-192.png',
    badge: data.badge || '/favicon.png',
    image: data.image || undefined, // Banner estilo Shopee/iFood
    tag: data.tag || `borauai-${Date.now()}`,
    data: { url: data.url || '/' },
    vibrate: data.vibrate || [300, 100, 300, 100, 400],
    requireInteraction: data.requireInteraction !== false,
    renotify: true,
    actions: data.actions || [
      { action: 'open', title: '👀 Ver Agora' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Se houver uma janela aberta do domínio, navega e foca nela
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Se o app estava fechado, abre a janela no link indicado
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
