const CACHE_NAME = 'pdv-cache-v15';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './offline-db.js',
    './manifest.json',
    'https://cdn.jsdelivr.net/npm/boxicons@2.1.4/css/boxicons.min.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    'https://cdn.boxicons.com/fonts/basic/boxicons.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
    'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js',
    'https://cdn-uicons.flaticon.com/2.6.0/uicons-solid-straight/css/uicons-solid-straight.css',
    'https://cdn-uicons.flaticon.com/2.6.0/uicons-regular-rounded/css/uicons-regular-rounded.css',
    'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js',
    'https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js'
];

// Instalação: Cache de arquivos estáticos
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching static assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
    self.skipWaiting();
});

// Ativação: Limpeza de caches antigos
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch: Estratégia de Cache
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. Ignora requisições de API e Analytics
    if (
        url.href.includes('googletagmanager') ||
        url.href.includes('google-analytics')
    ) {
        event.respondWith(new Response('', { status: 200 }));
        return;
    }

    if (
        url.href.includes('script.google.com') ||
        url.href.includes('firestore.googleapis.com') ||
        url.href.includes('cloudfunctions.net') ||
        url.href.includes('a.run.app')
    ) {
        return;
    }

    // 2. Arquivos Estáticos: Cache First, falling back to network
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).catch((err) => {
                console.log('[Service Worker] Fetch failed (ignoring):', event.request.url);
                // Retorna uma resposta válida para evitar erro no navegador
                return new Response('', { status: 408, statusText: 'Request Timed Out (Offline)' });
            });
        })
    );
});
