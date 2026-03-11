const CACHE_NAME = 'pdv-cache-v16';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './script.js',
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

// Fetch: Estratégia de Cache Inteligente
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. Ignora requisições de API e Analytics (Sempre Rede)
    if (
        url.href.includes('script.google.com') ||
        url.href.includes('firestore.googleapis.com') ||
        url.href.includes('cloudfunctions.net') ||
        url.href.includes('a.run.app') ||
        url.href.includes('googletagmanager') ||
        url.href.includes('google-analytics')
    ) {
        return;
    }

    // 2. Arquivos Locais (HTML, JS, CSS do projeto): Estratégia NETWORK FIRST
    // Isso garante que se houver internet, ele pega a versão nova. Se não houver, usa o cache.
    const isLocalAsset = url.origin === self.location.origin && 
                        (url.pathname.endsWith('.html') || 
                         url.pathname.endsWith('.js') || 
                         url.pathname.endsWith('.css') ||
                         url.pathname === '/pdv/' ||
                         url.pathname === '/pdv');

    if (isLocalAsset) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Atualiza o cache com a versão nova da rede
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, response.clone());
                        return response;
                    });
                })
                .catch(() => {
                    // Falhou a rede (offline)? Usa o que tiver no cache
                    return caches.match(event.request);
                })
        );
        return;
    }

    // 3. Bibliotecas Externas (CDNs): Estratégia CACHE FIRST
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return fetch(event.request).then((networkResponse) => {
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });
            });
        })
    );
});
