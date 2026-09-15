// Barangay Bacong Daycare Tracker — self-removing service worker.
//
// The system has no offline mode (see the capstone paper's delimitations). An
// earlier version of this file cached every page it served — including the
// signed-in roster — and served that copy when the network dropped. Browsers
// that still have that worker fetch this file on their next update check; it
// deletes every cache, unregisters itself and reloads the open tabs so they go
// back to the network. It intercepts no requests.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => client.navigate(client.url));
    })()
  );
});
