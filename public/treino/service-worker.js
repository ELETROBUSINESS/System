const CACHE_NAME = 'eletro-app-v1.0.01';

// Lista os arquivos principais que o app precisa para funcionar offline
// ATENÇÃO: Usando os caminhos absolutos da URL
const URLS_TO_CACHE = [
  '/treino/login.html',
  '/treino/home.html',
  '/treino/manifest.json'
];

// Evento de "install"
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache aberto. Adicionando arquivos principais.');
        return cache.addAll(URLS_TO_CACHE);
      })
  );
});

// Evento de "fetch"
self.addEventListener('fetch', (event) => {
  // Ignora requisições que não são GET (como POST para o Firebase)
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    // Estratégia: Cache-First
    caches.match(event.request)
      .then((response) => {
        // Se achou no cache, retorna o arquivo do cache
        if (response) {
          return response;
        }
        // Se não achou, vai até a internet buscar o arquivo
        return fetch(event.request);
      })
  );
});