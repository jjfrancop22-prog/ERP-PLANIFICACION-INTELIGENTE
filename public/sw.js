// LAB-PSI NEXTGEN PWA: sin caché de datos ni de operaciones Firebase.
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
