const CACHE_NAME = 'safeguard-v1';
const ASSETS = [
    '/',
    '/index',
    '/login',
    '/register',
    '/static/css/style.css',
    '/static/js/main.js',
    '/static/js/audio_detection.js',
    '/static/js/emergency_actions.js',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached response if found
                if (response) {
                    return response;
                }
                // Otherwise fetch from network
                return fetch(event.request);
            })
    );
});

// Sync event for background sync (advanced)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-emergency-logs') {
        // logic to push stored logs
        console.log("Syncing emergency logs...");
    }
});
