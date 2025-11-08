const CACHE_NAME = 'eletro-app-v14';

const URLS_TO_CACHE = [
  '/treino/login.html',
  '/treino/home.html',
  '/treino/treino.html',
  '/treino/manifest.json'
];

// Evento de "install"
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache v12 aberto. Adicionando arquivos principais.');
        // force-reload para garantir que estamos pegando os arquivos do servidor
        const requests = URLS_TO_CACHE.map(url => new Request(url, { cache: 'reload' }));
        return cache.addAll(requests);
      })
      .then(() => {
        // Força o novo service worker a ativar imediatamente
        return self.skipWaiting();
      })
  );
});

// Evento de "activate"
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((cacheName) => {
          return cacheName.startsWith('eletro-app-') && cacheName !== CACHE_NAME;
        }).map((cacheName) => {
          console.log('Deletando cache antigo:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      // Reivindica o controle da página imediatamente
      return self.clients.claim();
    })
  );
});

// Evento de "fetch"
self.addEventListener('fetch', (event) => {
  // Ignora requisições que não são GET
  if (event.request.method !== 'GET') {
    return;
  }

  // Ignora requisições do Firebase
  if (event.request.url.includes('firebase') || event.request.url.includes('gstatic')) {
    return event.respondWith(fetch(event.request));
  }

  event.respondWith(
    // Estratégia: Cache-First
    caches.match(event.request)
      .then((response) => {
        if (response) {
          // Retorna do cache
          return response;
        }
        // Se não está no cache, busca na rede
        return fetch(event.request).then((networkResponse) => {
          return networkResponse;
        });
      })
      .catch((error) => {
        console.error("Erro no fetch do Service Worker:", error);
      })
  );
});

