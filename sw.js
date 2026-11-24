// Service worker: caches the static app shell so the site opens instantly
// (and still opens with no signal). Live data (waiting count, bookings) always
// comes from Firebase directly — this worker never touches cross-origin requests.
const CACHE_NAME = 'clinic-shell-v2';
const SHELL_FILES = [
    './',
    './index.html',
    './records.html',
    './header.jpg',
    './icon-180.png',
    './icon-192.png',
    './icon-512.png',
    './manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);

    // Only same-origin GETs. Firebase/Firestore, analytics, CDNs and embeds go straight to the network.
    if (req.method !== 'GET' || url.origin !== self.location.origin) return;

    // Pages: network-first so updates show immediately; fall back to the cached shell offline.
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
                    return res;
                })
                .catch(() => caches.match(req).then((res) => res || caches.match('./index.html')))
        );
        return;
    }

    // Static assets (images, icons, manifest): stale-while-revalidate.
    event.respondWith(
        caches.match(req).then((cached) => {
            const network = fetch(req)
                .then((res) => {
                    if (res.ok) {
                        const copy = res.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
                    }
                    return res;
                })
                .catch(() => cached);
            return cached || network;
        })
    );
});
