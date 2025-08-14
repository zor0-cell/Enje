const CACHE_NAME = 'music-player-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    'https://files.catbox.moe/2nqd32.mp3'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});
