const APPSCRIPT_URL = "https://script.google.com/macros/s/AKfycbzB7dluoiNyJ4XK6oDK_iyuKZfwPTAJa4ua4RetQsUX9cMObgE-k_tFGI82HxW_OyMf/exec";
const GA_MEASUREMENT_ID = 'G-BV6V3GTMR0';

/**
 * Função global para rastreamento de eventos no Google Analytics.
 * @param {string} eventName - Nome do evento (ex: 'view_item', 'add_to_cart')
 * @param {object} params - Metadados do evento
 */
function trackEvent(eventName, params = {}) {
    if (typeof gtag === 'function') {
        const guestId = localStorage.getItem('guest_uid') || 'guest';
        const enhancedParams = {
            ...params,
            client_id: guestId,
            page_title: document.title,
            page_location: window.location.href,
            timestamp: new Date().toISOString()
        };
        gtag('event', eventName, enhancedParams);
        console.log(`[GA] Evento: ${eventName}`, enhancedParams);
    }
}

// Detecção de Campanha/Indicação (Landing)
function checkLandingParameters() {
    const search = window.location.search;
    if (search.includes('layla10')) {
        trackEvent('campaign_referral', {
            campaign_id: 'layla10',
            source: 'landing_url'
        });

        // Auto-aplicação de cupom se for a primeira entrada
        if (!sessionStorage.getItem('applied_coupon')) {
            sessionStorage.setItem('applied_coupon', JSON.stringify({ code: 'LAYLA10' }));
            console.log('[Analytics] Campanha Layla10 detectada. Cupom aplicado.');
        }
    }
}

var MP_PUBLIC_KEY = "APP_USR-ab887886-2763-4265-8893-bf9513809bd1"; // ALERTA: A chave "APP_USR-786d3961..." inserida (EletroPay) é INVÁLIDA e causava o erro 404. Revertido para a chave anterior. Insira a Public Key correta do painel!
const CACHE_KEY = 'dtudo_products_cache';
const CACHE_TIME_KEY = 'dtudo_cache_time';
const CACHE_DURATION = 60 * 1000; // 60 segundos conforme solicitado

// Helpers de formatação global
const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
const getFirstImageUrl = (url) => { if (!url) return 'https://placehold.co/500x500?text=Sem+Foto'; return url.split(',')[0].trim(); };

function calculateInstallmentsRule(price) {
    if (price >= 300) return { count: 3, value: price / 3 };
    if (price >= 150) return { count: 2, value: price / 2 };
    return { count: 1, value: price };
}

function getInstallmentHtml(price) {
    const inst = calculateInstallmentsRule(price);
    if (inst.count > 1) {
        return `<div class="installment-text">ou até <b>${inst.count}x ${formatCurrency(inst.value)}</b></div>`;
    }
    return `<div class="installment-text">ou <b>${formatCurrency(price)}</b> no cartão</div>`;
}

// Variáveis globais acessíveis em outras páginas
let currentUser = null;
let db = null;
let auth = null;

// --- 2. INICIALIZAÇÃO DO FIREBASE ---
document.addEventListener("DOMContentLoaded", () => {
    const firebaseConfig = {
        apiKey: "AIzaSyAVQ3tf6Qu4_9PajpJclZAJjVvRgB4ZE2I",
        authDomain: "super-app25.firebaseapp.com",
        projectId: "super-app25",
        storageBucket: "super-app25.firebasestorage.app",
        messagingSenderId: "810900166273",
        appId: "1:810900166273:web:24b8f055a68c9f0a6b5f80"
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    auth = firebase.auth();
    db = firebase.firestore();

    // Observer de Auth Global
    auth.onAuthStateChanged(user => {
        currentUser = user;
        updateUserUI(user);
        document.dispatchEvent(new CustomEvent('userReady', { detail: user }));
    });

    // Inicia o Gerenciador de Dados Central
    DataManager.init();

    updateCartBadge();
    checkLandingParameters();
    setupGlobalEvents();
    startOfferTimers();
});

// --- LÓGICA DE CRONÔMETRO DE OFERTA ---
function startOfferTimers() {
    const OFFER_DEADLINE = new Date("2026-03-02T23:59:59").getTime();

    function update() {
        const now = Date.now();
        const diff = OFFER_DEADLINE - now;

        if (diff <= 0) {
            // Pausa produtos com oferta: esconde elementos com a classe .has-offer
            document.querySelectorAll('.has-offer').forEach(el => {
                if (el.tagName === 'DIV') {
                    el.style.display = 'none';
                }
            });
            return;
        }

        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);

        const timeStr = [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');

        document.querySelectorAll('.timer-countdown').forEach(el => {
            el.innerText = timeStr;
        });
    }

    setInterval(update, 1000);
    update();
}

// --- 3. BANCO DE DADOS CENTRAL (CACHE) ---
const DataManager = {
    init: function () {
        // Primeira carga ao abrir qualquer página
        this.sync();
    },

    sync: async function () {
        const now = Date.now();
        const lastSync = parseInt(localStorage.getItem(CACHE_TIME_KEY) || '0');

        // Se sincronizou nos últimos 60 segundos, não busca de novo (evita lentidão entre telas)
        if (now - lastSync < CACHE_DURATION && localStorage.getItem(CACHE_KEY)) {
            console.log("[DataManager] Cache recente, pulando sincronização.");
            return;
        }

        if (this._isSyncing) return;
        this._isSyncing = true;

        try {
            console.log("[DataManager] Sincronizando produtos...");
            const response = await fetch(`${APPSCRIPT_URL}?action=listarProdutosSuperApp`);
            const result = await response.json();

            if (result.status === "success" && result.data) {
                const oldData = localStorage.getItem(CACHE_KEY);
                const newDataStr = JSON.stringify(result.data);

                if (oldData !== newDataStr) {
                    console.log("[DataManager] Dados atualizados detectados.");
                    localStorage.setItem(CACHE_KEY, newDataStr);
                    localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());

                    // Notifica interessados
                    document.dispatchEvent(new CustomEvent('productsUpdated', { detail: result.data }));
                } else {
                    // Mesmo se os dados forem iguais, atualiza o tempo para não dar fetch de novo logo em seguida
                    localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
                }
            }
        } catch (e) {
            console.error("[DataManager] Erro ao sincronizar:", e);
        } finally {
            this._isSyncing = false;
        }
    },


    getProducts: function () {
        const data = localStorage.getItem(CACHE_KEY);
        return data ? JSON.parse(data) : [];
    }
};

// --- 3. GERENCIAMENTO DO CARRINHO ---
const CartManager = {
    get: () => JSON.parse(localStorage.getItem('app_cart')) || [],

    add: (product) => {
        let cart = CartManager.get();
        const existing = cart.find(item => item.id === product.id);
        if (existing) {
            existing.quantity++;
        } else {
            cart.push({ ...product, quantity: 1 });
        }
        localStorage.setItem('app_cart', JSON.stringify(cart));
        updateCartBadge();
        showToast(`${product.name} adicionado ao cesto!`, "success");
        if (typeof trackEvent === 'function') {
            trackEvent('add_to_cart', {
                items: [{ item_id: product.id, item_name: product.name, price: product.priceNew || product.priceOriginal }]
            });
        }
    },

    remove: (id) => {
        let cart = CartManager.get();
        cart = cart.filter(item => item.id !== id);
        localStorage.setItem('app_cart', JSON.stringify(cart));
        updateCartBadge();
    },

    clear: () => {
        localStorage.removeItem('app_cart');
        updateCartBadge();
    },

    total: () => {
        const cart = CartManager.get();
        return cart.reduce((sum, item) => sum + ((item.priceNew || item.priceOriginal) * item.quantity), 0);
    }
};

// --- 4. UI HELPERS GLOBAIS ---
function updateCartBadge() {
    const count = CartManager.get().reduce((acc, item) => acc + item.quantity, 0);
    const badgeMobile = document.getElementById("cart-badge");
    const badgeDesktop = document.getElementById("cart-badge-desktop");

    if (badgeMobile) {
        badgeMobile.innerText = count;
        badgeMobile.style.display = count > 0 ? 'flex' : 'none';
        if (count > 0) {
            badgeMobile.classList.add('pulse');
            setTimeout(() => badgeMobile.classList.remove('pulse'), 3000);
        }
    }
    if (badgeDesktop) {
        badgeDesktop.innerText = count;
        badgeDesktop.style.display = count > 0 ? 'flex' : 'none';
        if (count > 0) {
            badgeDesktop.classList.add('pulse');
            setTimeout(() => badgeDesktop.classList.remove('pulse'), 3000);
        }
    }
}

let toastTimeout;
function showToast(msg, type = "success") {
    const toast = document.getElementById("toast-notification");
    if (!toast) return;

    // Cancela o timeout anterior se houver (evita que o toast suma antes do tempo se clicarem várias vezes)
    clearTimeout(toastTimeout);

    toast.innerHTML = `<i class='bx bxs-${type === 'success' ? 'check-circle' : 'error-circle'}'></i> <span>${msg}</span>`;
    toast.className = `toast show ${type}`;

    toastTimeout = setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

// --- ATUALIZAÇÃO VISUAL DO USUÁRIO (CORRIGIDO) ---
function updateUserUI(user) {
    const desktopGreeting = document.getElementById("desktop-profile-trigger");
    const mobileBtn = document.getElementById("profile-button-mobile");

    // Elementos do Modal de Perfil
    const modalLoggedIn = document.getElementById("user-logged-in-view");
    const modalLoggedOut = document.getElementById("user-logged-out-view");
    const profilePic = document.getElementById("user-profile-pic");
    const profileName = document.getElementById("user-profile-name");

    if (user && !user.isAnonymous) {
        // --- USUÁRIO LOGADO ---
        const firstName = user.displayName ? user.displayName.split(' ')[0] : 'Cliente';
        const photoUrl = user.photoURL || 'https://placehold.co/100x100/333/fff?text=U'; // Fallback se não tiver foto

        // 1. Atualiza Header Desktop
        if (desktopGreeting) {
            // Adiciona a foto pequena ao lado do texto
            desktopGreeting.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px;">
                    <img src="${photoUrl}" style="width:32px; height:32px; border-radius:50%; border:1px solid #fff;">
                    <div style="display:flex; flex-direction:column;">
                        <span>olá, ${firstName}</span>
                        <strong>Minha Conta</strong>
                    </div>
                </div>`;
        }

        // 2. Atualiza Ícone Mobile (Troca o ícone pela foto)
        if (mobileBtn) {
            mobileBtn.innerHTML = `<img src="${photoUrl}" style="width:30px; height:30px; border-radius:50%; border:2px solid #fff; object-fit:cover;">`;
        }

        // 3. Atualiza Conteúdo do Modal
        if (modalLoggedIn && modalLoggedOut) {
            modalLoggedIn.style.display = "block"; // Mostra painel logado
            modalLoggedOut.style.display = "none"; // Esconde botão de login

            if (profilePic) profilePic.src = photoUrl;
            if (profileName) profileName.innerText = user.displayName;
        }

    } else {
        // --- USUÁRIO DESLOGADO ---

        // 1. Reset Header Desktop
        if (desktopGreeting) {
            desktopGreeting.innerHTML = `<span>olá, faça seu login</span><strong>ou cadastre-se</strong>`;
        }

        // 2. Reset Ícone Mobile
        if (mobileBtn) {
            mobileBtn.innerHTML = `<i class='bx bx-user-circle'></i>`;
        }

        // 3. Reset Conteúdo do Modal
        if (modalLoggedIn && modalLoggedOut) {
            modalLoggedIn.style.display = "none";
            modalLoggedOut.style.display = "block";
        }
    }
}

function setupGlobalEvents() {
    // Logout
    const logoutBtn = document.getElementById("logout-button");
    const desktopLogout = document.getElementById("desktop-logout");

    const handleLogout = () => {
        trackEvent('login', { method: 'Google' });
        auth.signOut().then(() => {
            showToast("Você saiu da conta.");
            // O auth.onAuthStateChanged vai rodar e limpar a UI automaticamente
            const modal = document.getElementById("user-profile-modal");
            if (modal) modal.classList.remove("show");
        });
    };

    if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);
    if (desktopLogout) desktopLogout.addEventListener("click", handleLogout);

    // Google Login (Geralmente no Modal)
    const googleBtn = document.getElementById("google-login-button");
    if (googleBtn) {
        googleBtn.addEventListener("click", () => {
            const provider = new firebase.auth.GoogleAuthProvider();
            auth.signInWithPopup(provider).then(() => {
                showToast("Login realizado!", "success");
                const modal = document.getElementById("user-profile-modal");
                if (modal) modal.classList.remove("show");
            }).catch(error => {
                console.error(error);
                showToast("Erro ao entrar.", "error");
            });
        });
    }

    // Localização
    const locationBar = document.getElementById("location-bar-trigger");
    if (locationBar) {
        locationBar.addEventListener("click", openLocationModal);
    }

    updateLocationUI();
}

// --- LÓGICA DE LOCALIZAÇÃO ---
function updateLocationUI() {
    const loc = localStorage.getItem('user_location') || 'Selecionar endereço';
    const textEl = document.getElementById('current-location-text');
    if (textEl) textEl.innerText = loc;
}

function openLocationModal() {
    const modal = document.getElementById('location-modal');
    if (modal) modal.classList.add('show');
}

window.selectLocation = function (city) {
    localStorage.setItem('user_location', `Enviar para ${city}`);
    updateLocationUI();
    const modal = document.getElementById('location-modal');
    if (modal) modal.classList.remove('show');
    showToast(`Endereço alterado para ${city}`);
}

window.applyCEP = function () {
    const input = document.getElementById('cep-input');
    const cep = input ? input.value.trim() : '';
    if (cep.length >= 8) {
        localStorage.setItem('user_location', `CEP ${cep}`);
        updateLocationUI();
        const modal = document.getElementById('location-modal');
        if (modal) modal.classList.remove('show');
        showToast(`CEP ${cep} aplicado`);
    } else {
        showToast("Insira um CEP válido", "error");
    }
}
// --- LÓGICA DO MODAL DE BUSCA GERAL ---
window.openSearchModal = function () {
    const modal = document.getElementById('search-modal');
    if (modal) {
        modal.classList.add('show');
        const input = document.getElementById('modal-search-input');
        if (input) {
            input.value = '';
            input.focus();
        }
        renderSearchHistory();
    }
};

window.closeSearchModal = function () {
    const modal = document.getElementById('search-modal');
    if (modal) modal.classList.remove('show');
};

window.executeSearch = function (termOverride) {
    const input = document.getElementById('modal-search-input');
    const term = (termOverride && typeof termOverride === 'string') ? termOverride : (input ? input.value.trim() : "");
    if (term) {
        saveSearchHistory(term);
        window.location.href = `search.html?q=${encodeURIComponent(term)}`;
    }
};

function saveSearchHistory(term) {
    let history = JSON.parse(localStorage.getItem('search_history') || '[]');
    history = history.filter(h => h.toLowerCase() !== term.toLowerCase());
    history.unshift(term);
    localStorage.setItem('search_history', JSON.stringify(history.slice(0, 5)));
}

function renderSearchHistory() {
    const container = document.getElementById('search-history-list');
    const section = document.getElementById('search-history-section');
    let history = JSON.parse(localStorage.getItem('search_history') || '[]');

    if (!container || !section) return;

    if (history.some(h => String(h).includes('<div'))) {
        history = history.filter(h => !String(h).includes('<div'));
        localStorage.setItem('search_history', JSON.stringify(history));
    }

    if (history.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    container.innerHTML = history.map(h => {
        const safeTerm = String(h).replace(/<[^>]*>/g, '').trim();
        return `
            <div class="suggestion-item" onclick="window.location.href='search.html?q=${encodeURIComponent(safeTerm)}'">
                <i class='bx bx-history'></i> ${safeTerm}
            </div>
        `;
    }).join('');
}

window.clearSearchHistory = function () {
    localStorage.removeItem('search_history');
    renderSearchHistory();
};

window.toggleSearchExpansion = function (event) {
    if (event) event.stopPropagation();
    const container = document.getElementById('header-search-container');
    if (container) {
        const isExpanded = container.classList.contains('expanded');
        if (isExpanded) {
            openSearchModal();
        } else {
            container.classList.add('expanded');
            setTimeout(() => { openSearchModal(); }, 400);
        }
    }
};

// --- MAPA DE SINÔNIMOS PARA BUSCA INTELIGENTE ---
const SEARCH_SYNONYMS = {
    'tv': ['televisao', 'televisão', 'televisor', 'smart tv', 'monitor', 'led'],
    'televisao': ['tv', 'televisor', 'smart tv'],
    'televisão': ['tv', 'televisor', 'smart tv'],
    'celular': ['smartphone', 'telefone', 'mobile', 'iphone', 'android'],
    'smartphone': ['celular', 'telefone', 'mobile'],
    'fone': ['headset', 'fone de ouvido', 'auricular', 'bluetooth', 'tws'],
    'relogio': ['smartwatch', 'smart watch', 'relógio', 'digital', 'analogico'],
    'relógio': ['relogio', 'smartwatch', 'smart watch'],
    'caixa': ['som', 'speaker', 'bluetooth', 'amplificada', 'jbl'],
    'notebook': ['laptop', 'computador', 'pc', 'informatica'],
    'pc': ['computador', 'notebook', 'desktop', 'gabinete'],
    'brinquedo': ['infantil', 'boneca', 'carro', 'jogo', 'kids'],
    'escolar': ['papelaria', 'caderno', 'caneta', 'lapis', 'mochila'],
    'presenteie': ['dia das mulheres', 'dia da mulher', 'mulheres', 'mulher'],
    'makes': ['cosméticos', 'maquiagens', 'maquiagem', 'batom', 'rimel', 'blush', 'makeup', 'make up']
};

window.smartMatch = function (product, term) {
    const name = (product.name || '').toLowerCase();
    const cat = (product.category || '').toLowerCase();
    const brand = (product.brand || product.marca || '').toLowerCase();
    const query = term.toLowerCase();
    if (name.includes(query) || cat.includes(query) || brand.includes(query)) return true;
    for (const [key, synonyms] of Object.entries(SEARCH_SYNONYMS)) {
        if (query === key || synonyms.includes(query)) {
            const matchesKey = name.includes(key) || cat.includes(key) || brand.includes(key);
            const matchesSynonym = synonyms.some(s => name.includes(s) || cat.includes(s) || brand.includes(s));
            if (matchesKey || matchesSynonym) return true;
        }
    }
    return false;
};

window.setupSearch = function () {
    const modalInput = document.getElementById('modal-search-input');
    const clearBtn = document.getElementById('clear-search');
    if (modalInput) {
        modalInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') executeSearch(); });
        modalInput.addEventListener('input', (e) => {
            const term = e.target.value.trim().toLowerCase();
            if (clearBtn) clearBtn.style.display = term ? 'block' : 'none';
            const suggestionsList = document.getElementById('search-suggestions-list');
            const suggestionsSection = document.getElementById('search-suggestions-section');
            if (suggestionsList) {
                if (term.length >= 2) {
                    const cached = DataManager.getProducts() || [];
                    const filtered = cached.filter(p => smartMatch(p, term)).slice(0, 6);
                    if (filtered.length > 0) {
                        suggestionsList.innerHTML = filtered.map(p => `
                            <div class="suggestion-item" onclick="window.location.href='search.html?q=${encodeURIComponent(p.name)}'">
                                <i class='bx bx-search'></i> ${p.name}
                            </div>
                        `).join('') + `
                            <div class="suggestion-item" onclick="executeSearch()" style="background: #fdfdfd; border-top: 1px solid #eee; color: #db0038; font-weight: 700;">
                                <i class='bx bx-right-arrow-alt'></i> Ver todos os resultados para "${term}"
                            </div>
                        `;
                        if (suggestionsSection) {
                            suggestionsSection.style.display = 'block';
                            suggestionsSection.querySelector('.search-section-title').innerText = 'Busca Inteligente';
                        }
                    } else {
                        suggestionsList.innerHTML = `<div class="suggestion-item" onclick="executeSearch()"><i class='bx bx-search'></i> Buscar por "${term}"...</div>`;
                        if (suggestionsSection) suggestionsSection.style.display = 'block';
                    }
                } else {
                    if (suggestionsSection) {
                        suggestionsSection.style.display = 'block';
                        suggestionsSection.querySelector('.search-section-title').innerText = 'Sugestões para você';
                    }
                    suggestionsList.innerHTML = `
                        <div class="suggestion-item" onclick="window.location.href='search.html?q=relogio'"> <i class='bx bx-trending-up'></i> Relógio Masculino</div>
                        <div class="suggestion-item" onclick="window.location.href='search.html?q=escolar'"><i class='bx bx-trending-up'></i> Material Escolar</div>
                        <div class="suggestion-item" onclick="window.location.href='search.html?q=eletronico'"><i class='bx bx-trending-up'></i> Eletrônicos</div>
                    `;
                }
            }
        });
    }
    if (clearBtn) { clearBtn.onclick = () => { if (modalInput) { modalInput.value = ''; modalInput.focus(); clearBtn.style.display = 'none'; } }; }
    const modal = document.getElementById('search-modal');
    if (modal) { modal.onclick = (e) => { if (e.target === modal) closeSearchModal(); }; }
};
