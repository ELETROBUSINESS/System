const DB_NAME = 'pdv-db';
const DB_VERSION = 2; // Incremented for clients store

const offlineDB = {
    db: null,

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error("Erro ao abrir banco de dados offline:", event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log("Banco de dados offline inicializado.");
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // Store para Produtos (Cache para busca offline)
                if (!db.objectStoreNames.contains('products')) {
                    db.createObjectStore('products', { keyPath: 'id' });
                }
                // Store para Clientes (Cache para busca offline)
                if (!db.objectStoreNames.contains('clients')) {
                    db.createObjectStore('clients', { keyPath: 'id' });
                }
                // Store para Vendas Pendentes (Fila de sincronização)
                if (!db.objectStoreNames.contains('pending_sales')) {
                    db.createObjectStore('pending_sales', { keyPath: 'localId', autoIncrement: true });
                }
            };
        });
    },

    // --- PRODUTOS ---
    async saveProducts(products) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['products'], 'readwrite');
            const store = transaction.objectStore('products');

            store.clear(); // Full Refresh

            products.forEach(product => {
                if (!product.id) product.id = product.barcode || Math.random().toString(36).substr(2, 9);
                store.put(product);
            });

            transaction.oncomplete = () => {
                console.log(`Cache offline produtos atualizado: ${products.length} itens.`);
                resolve();
            };
            transaction.onerror = (e) => reject(e.target.error);
        });
    },

    async getProducts() {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['products'], 'readonly');
            const store = transaction.objectStore('products');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    },

    // --- CLIENTES ---
    async saveClients(clients) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['clients'], 'readwrite');
            const store = transaction.objectStore('clients');

            store.clear(); // Full Refresh

            clients.forEach(client => {
                // Garante ID para a chave primária
                if (!client.id) client.id = client.cpf || Math.random().toString(36).substr(2, 9);
                store.put(client);
            });

            transaction.oncomplete = () => {
                console.log(`Cache offline clientes atualizado: ${clients.length} itens.`);
                resolve();
            };
            transaction.onerror = (e) => reject(e.target.error);
        });
    },

    async getClients() {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['clients'], 'readonly');
            const store = transaction.objectStore('clients');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    },

    // --- VENDAS PENDENTES ---
    async savePendingSale(saleData) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pending_sales'], 'readwrite');
            const store = transaction.objectStore('pending_sales');
            const request = store.add(saleData);

            request.onsuccess = () => {
                resolve(request.result); // Retorna o localId gerado
            };
            request.onerror = (e) => reject(e.target.error);
        });
    },

    async getPendingSales() {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pending_sales'], 'readonly');
            const store = transaction.objectStore('pending_sales');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    },

    async deletePendingSale(localId) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pending_sales'], 'readwrite');
            const store = transaction.objectStore('pending_sales');
            const request = store.delete(localId);

            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }
};

// Inicializa automaticamente
offlineDB.init();