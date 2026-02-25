// js/index.js

const STORE_OWNER_UID = "3zYT9Y6hXWeJSuvmEYP4FMZa5gI2";
const APP_ID = 'floralchic-loja';
const COMMENTS_CACHE_KEY = "dtudo_user_reviews";
const REVIEWS_CACHE_DURATION = 20 * 60 * 60 * 1000;
const CART_KEY = 'app_cart';

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
    'escolar': ['papelaria', 'caderno', 'caneta', 'lapis', 'mochila']
};

function smartMatch(product, term) {
    const name = (product.name || '').toLowerCase();
    const cat = (product.category || '').toLowerCase();
    const query = term.toLowerCase();

    // 1. Verifica match direto
    if (name.includes(query) || cat.includes(query)) return true;

    // 2. Verifica Sinônimos
    for (const [key, synonyms] of Object.entries(SEARCH_SYNONYMS)) {
        // Se o termo pesquisado é a chave ou está nos sinônimos daquela chave
        if (query === key || synonyms.includes(query)) {
            // Verifica se o NOME do produto contém a CHAVE ou algum dos SINÔNIMOS
            if (name.includes(key) || synonyms.some(s => name.includes(s))) return true;
        }
    }
    return false;
}

// Variáveis Globais
let lastVisibleDoc = null;
let productsBuffer = [];
let isLoading = false;
let allProductsLoaded = false;
let currentDetailImages = [];
let selectedRating = 0;
let selectedReviewImageBase64 = null;
let currentUserReviewId = null;
let searchDebounceTimeout = null;

// ==================== 1. UTILITÁRIOS E CACHE ====================

// --- NOVA REGRA DE PARCELAMENTO ---
function calculateInstallmentsRule(price) {
    if (price >= 300) return 3;
    if (price >= 150) return 2;
    return 1; // À vista no cartão
}

// --- HELPER PARA OBTER A BASE DE CÁLCULO DA PARCELA ---
function getInstallmentBasis(prod) {
    // Verifica se existe "web_price" e se é um número válido > 0
    const webPrice = parseFloat(prod.web_price);

    if (!isNaN(webPrice) && webPrice > 0) {
        return webPrice;
    }

    // Fallback para o preço original "price" caso web_price não exista
    return parseFloat(prod.price || 0);
}

function getLocalUserReviews() {
    const raw = localStorage.getItem(COMMENTS_CACHE_KEY);
    if (!raw) return [];
    try {
        const data = JSON.parse(raw);
        const now = new Date().getTime();
        if (!data.timestamp || (now - data.timestamp > REVIEWS_CACHE_DURATION)) {
            localStorage.removeItem(COMMENTS_CACHE_KEY);
            return [];
        }
        return data.reviews || [];
    } catch (e) { return []; }
}

function saveLocalUserReviews(reviews) {
    const data = { timestamp: new Date().getTime(), reviews: reviews };
    localStorage.setItem(COMMENTS_CACHE_KEY, JSON.stringify(data));
}

window.addToCartDirect = function (id, name, priceOriginal, priceNew, img) {
    if (typeof CartManager !== 'undefined') {
        const product = {
            id: id,
            name: name,
            priceOriginal: priceOriginal,
            priceNew: priceNew,
            image: img
        };
        CartManager.add(product);
    } else {
        const CART_KEY = 'app_cart';
        let cart = JSON.parse(localStorage.getItem(CART_KEY)) || [];
        const existingItem = cart.find(item => item.id === id);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({ id: id, name: name, priceOriginal: priceOriginal, priceNew: priceNew, image: img, quantity: 1 });
        }
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
        if (typeof updateCartBadge === 'function') updateCartBadge();
        showToast(`${name} adicionado ao carrinho!`, "success");
    }
}

function extractProductImages(prod) {
    let images = [];
    if (prod.imgUrl && prod.imgUrl.trim() !== "") {
        if (prod.imgUrl.includes(',')) {
            const urls = prod.imgUrl.split(',').map(url => url.trim()).filter(url => url !== "");
            images.push(...urls);
        } else {
            images.push(prod.imgUrl.trim());
        }
    }
    let i = 1;
    while (true) {
        const key = 'imgUrl' + i;
        if (prod[key] && prod[key].trim() !== "") { images.push(prod[key].trim()); i++; }
        else { break; }
        if (i > 20) break;
    }
    if (images.length === 0) return ['https://placehold.co/500x500/EBEBEB/333?text=Sem+Foto'];
    return images;
}

function getCachedData() {
    const json = localStorage.getItem(CACHE_KEY);
    const time = localStorage.getItem(CACHE_TIME_KEY);
    if (!json || !time) return null;
    if (new Date().getTime() - parseInt(time) > CACHE_DURATION) { clearCache(); return null; }
    return JSON.parse(json);
}

function saveToCache(newProducts) {
    const currentCache = getCachedData() || [];
    const uniqueIds = new Set(currentCache.map(p => p.id));
    const merged = [...currentCache];
    newProducts.forEach(p => { if (!uniqueIds.has(p.id)) merged.push(p); });
    localStorage.setItem(CACHE_KEY, JSON.stringify(merged));
    localStorage.setItem(CACHE_TIME_KEY, new Date().getTime().toString());
}

function clearCache() {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIME_KEY);
}

// ==================== 2. RENDERIZAÇÃO DA HOME (CARD NOVO) ====================

function buildProductCardHTML(prod) {
    let rawImg = prod.imgUrl || '';
    if (rawImg.includes(',')) {
        rawImg = rawImg.split(',')[0].trim();
    }
    let displayImg = rawImg || 'https://placehold.co/400x400/f8f9fa/c20026?text=Dtudo';
    const valPrice = parseFloat(prod.price || 0); // Cartão (Cheio)
    const valOffer = parseFloat(prod['price-oferta'] || 0);
    const hasOffer = (valOffer > 0 && valOffer < valPrice);
    const baseSalePrice = hasOffer ? valOffer : valPrice;
    const priceCard = baseSalePrice;
    const pricePix = baseSalePrice * 0.95;
    const fmtConfig = { style: 'currency', currency: 'BRL' };
    const fmtPix = new Intl.NumberFormat('pt-BR', fmtConfig).format(pricePix);
    const fmtOriginal = new Intl.NumberFormat('pt-BR', fmtConfig).format(valPrice);

    let name = prod.name || '';
    name = name.toLowerCase().replace(/(^\w|\s\w)/g, m => m.toUpperCase());

    const fmtCard = new Intl.NumberFormat('pt-BR', fmtConfig).format(priceCard);

    let priceHtml = '';
    if (hasOffer) {
        priceHtml = `
            <div class="price-container">
                <span class="price-old">${fmtOriginal}</span>
                <span class="price-new">${fmtPix} <small style="font-size: 0.65rem; color: #666; font-weight: 500;">no Pix</small></span>
            </div>`;
    } else {
        priceHtml = `
            <div class="price-container">
                <span class="price-old">${fmtCard}</span>
                <span class="price-new">${fmtPix} <small style="font-size: 0.65rem; color: #666; font-weight: 500;">no Pix</small></span>
            </div>`;
    }

    const maxInst = calculateInstallmentsRule(priceCard);
    let installmentHtml = '';
    if (maxInst > 1) {
        installmentHtml = `<div class="installment-text">ou <b>${fmtCard}</b> em até <b>${maxInst}x</b></div>`;
    } else {
        installmentHtml = `<div class="installment-text">ou <b>${fmtCard}</b> no cartão</div>`;
    }

    const stock = parseInt(prod.stock || 0);
    const isSoldOut = stock <= 0;

    return `
        <div class="product-card ${isSoldOut ? 'sold-out' : ''}" id="prod-${prod.id}" onclick="window.location.href='product.html?id=${prod.id}'">
            <div class="product-image">
                <img src="${displayImg}" alt="${prod.name}" loading="lazy" onload="this.classList.add('loaded')">
                <button class="cart-btn-overlay" onclick="event.stopPropagation(); addToCartDirect('${prod.id}', '${name}', ${priceCard}, ${pricePix}, '${displayImg}')">
                    <i class='bx bx-cart-add'></i>
                </button>
                ${isSoldOut ? '<div class="sold-out-badge" style="position:absolute; bottom:0; width:100%; background:rgba(0,0,0,0.6); color:#fff; text-align:center; font-size:0.75rem; font-weight:700; padding:2px 0; backdrop-filter:blur(2px);">Esgotado</div>' : ''}
            </div>
            <div class="product-info">
                <h4 class="product-name">${name}</h4>
                ${priceHtml}
                ${installmentHtml}
                ${!isSoldOut ? '<div class="free-shipping"><i class=\'bx bxs-truck\'></i> Frete Grátis</div>' : '<div class="free-shipping" style="color:#999"><i class=\'bx bx-time\'></i> Em breve</div>'}
            </div>
        </div>`;
}

function renderProductBatch(products) {
    const container = document.getElementById('firebase-products-container');
    if (!container) return;
    if (container.querySelector('.skeleton-card')) container.innerHTML = '';

    products.forEach(prod => {
        if (document.getElementById(`prod-${prod.id}`)) return;
        const hasUrl = prod.imgUrl && prod.imgUrl.trim() !== "" && !prod.imgUrl.includes('placehold.co') && (prod.imgUrl.startsWith('http') || prod.imgUrl.includes('/'));
        if (!hasUrl) return;

        container.insertAdjacentHTML('beforeend', buildProductCardHTML(prod));
    });
}

function renderHomeSections(cached) {
    const container = document.getElementById('home-sections-container');
    if (!container) return;

    // Filter valid products (must have a name)
    const validProds = cached.filter(p => p.name && p.name.trim() !== "");
    const interests = JSON.parse(localStorage.getItem('user_interests') || '[]');

    let destaques = validProds.filter(p => interests.some(i => (p.category || '').toLowerCase().includes(i)));
    if (destaques.length === 0) destaques = validProds.slice(0, 8);
    else destaques = destaques.slice(0, 8);

    const novidades = [...validProds].reverse().slice(0, 8);
    const getCat = (term) => validProds.filter(p => (p.category || '').toLowerCase().includes(term) || (p.name || '').toLowerCase().includes(term)).slice(0, 8);

    const brinquedos = getCat('brinquedo');
    const cozinha = getCat('cozinha');

    let html = '';

    const createSection = (title, items, filterTag) => {
        if (!items || items.length === 0) return '';
        return `
            <div class="home-dynamic-section" style="margin-bottom: 30px;">
                <h2 class="section-title" style="margin-bottom: 15px;">${title}</h2>
                <div class="product-grid" style="margin-bottom: 15px;">
                    ${items.map(p => buildProductCardHTML(p)).join('')}
                </div>
                ${filterTag ? `<div style="text-align: center;">
                    <button onclick="window.location.href='search.html?q=${encodeURIComponent(filterTag)}'" 
                            style="background: transparent; color: var(--color-brand-red); border: 2px solid var(--color-brand-red); padding: 8px 24px; border-radius: 20px; font-weight: 700; cursor: pointer; text-transform: uppercase; font-size: 0.85rem; transition: background 0.3s;"
                            onmouseover="this.style.background='var(--color-brand-red)'; this.style.color='#fff';"
                            onmouseout="this.style.background='transparent'; this.style.color='var(--color-brand-red)';">
                        Ver mais em ${title}
                    </button>
                </div>` : ''}
            </div>
        `;
    };

    html += createSection('Destaques para você', destaques, null);
    html += createSection('Novidades', novidades, null); // ou uma categoria especial
    if (brinquedos.length > 0) html += createSection('Brinquedos', brinquedos, 'brinquedo');
    if (cozinha.length > 0) html += createSection('Cozinha', cozinha, 'cozinha');

    container.innerHTML = html;
}


// --- BUSCA COM MODAL ---
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

window.executeSearch = function () {
    const input = document.getElementById('modal-search-input');
    const term = input ? input.value.trim() : "";
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
    const history = JSON.parse(localStorage.getItem('search_history') || '[]');

    if (!container || !section) return;

    if (history.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    container.innerHTML = history.map(h => `
        <div class="suggestion-item" onclick="window.location.href='search.html?q=${encodeURIComponent(h)}'">
            <i class='bx bx-history'></i> ${h}
        </div>
    `).join('');
}

window.clearSearchHistory = function () {
    localStorage.removeItem('search_history');
    renderSearchHistory();
};

function setupSearch() {
    const modalInput = document.getElementById('modal-search-input');
    const clearBtn = document.getElementById('clear-search');

    if (modalInput) {
        modalInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') executeSearch();
        });

        modalInput.addEventListener('input', (e) => {
            const term = e.target.value.trim().toLowerCase();
            if (clearBtn) clearBtn.style.display = term ? 'block' : 'none';

            const suggestionsList = document.getElementById('search-suggestions-list');
            const suggestionsSection = document.getElementById('search-suggestions-section');
            if (suggestionsList) {
                if (term.length >= 2) {
                    const cached = getCachedData() || [];
                    // Usa a lógica de SmartMatch para filtrar
                    const filtered = cached.filter(p => smartMatch(p, term)).slice(0, 6);

                    if (filtered.length > 0) {
                        // Ao clicar na sugestão, agora vai para a PÁGINA DE PESQUISA (Busca o termo)
                        suggestionsList.innerHTML = filtered.map(p => `
                            <div class="suggestion-item" onclick="window.location.href='search.html?q=${encodeURIComponent(p.name)}'">
                                <i class='bx bx-search'></i> ${p.name}
                            </div>
                        `).join('') + `
                            <div class="suggestion-item" onclick="executeSearch()" style="background: #fdfdfd; border-top: 1px solid #eee; color: var(--color-brand-red); font-weight: 700;">
                                <i class='bx bx-right-arrow-alt'></i> Ver todos os resultados para "${term}"
                            </div>
                        `;
                        if (suggestionsSection) suggestionsSection.querySelector('.search-section-title').innerText = 'Busca Inteligente';
                    } else {
                        suggestionsList.innerHTML = `
                            <div class="suggestion-item" onclick="executeSearch()">
                                <i class='bx bx-search'></i> Buscar por "${term}"...
                            </div>
                        `;
                    }
                } else {
                    if (suggestionsSection) suggestionsSection.querySelector('.search-section-title').innerText = 'Sugestões para você';
                    suggestionsList.innerHTML = `
                        <div class="suggestion-item" onclick="window.location.href='search.html?q=relogio'"><i class='bx bx-trending-up'></i> Relógio Masculino</div>
                        <div class="suggestion-item" onclick="window.location.href='search.html?q=escolar'"><i class='bx bx-trending-up'></i> Material Escolar</div>
                        <div class="suggestion-item" onclick="window.location.href='search.html?q=eletronico'"><i class='bx bx-trending-up'></i> Eletrônicos</div>
                    `;
                }
            }
        });
    }

    if (clearBtn) {
        clearBtn.onclick = () => {
            if (modalInput) {
                modalInput.value = '';
                modalInput.focus();
                clearBtn.style.display = 'none';
            }
        };
    }

    // Fechar modal ao clicar fora do conteúdo
    const modal = document.getElementById('search-modal');
    if (modal) {
        modal.onclick = (e) => {
            if (e.target === modal) closeSearchModal();
        };
    }
}

function startSuggestionTimer() {
    setInterval(() => {
        const allCards = Array.from(document.querySelectorAll('.product-card:not(.skeleton-card)'));
        if (allCards.length === 0) return;

        const randomIndex = Math.floor(Math.random() * allCards.length);
        const card = allCards[randomIndex];
        if (card) {
            card.classList.add('suggest-animation');
            setTimeout(() => card.classList.remove('suggest-animation'), 6000);
        }
    }, 60000);
}

function registerInterest(category) {
    if (!category || category === 'todos' || category === 'ofertas') return;
    let interests = JSON.parse(localStorage.getItem('user_interests') || '[]');
    let lowerCat = category.toLowerCase().trim();
    if (!interests.includes(lowerCat)) {
        interests.unshift(lowerCat);
        if (interests.length > 4) interests.pop(); // Mantém últimos 4 interesses
        localStorage.setItem('user_interests', JSON.stringify(interests));
    }
}

function registerRecentlyViewed(prod) {
    if (!prod) return;
    let viewed = JSON.parse(localStorage.getItem('user_recently_viewed') || '[]');
    viewed = viewed.filter(p => p.id !== prod.id); // Remove if exists
    viewed.unshift({
        id: prod.id,
        name: prod.name,
        price: prod.price,
        'price-oferta': prod['price-oferta'],
        imgUrl: prod.imgUrl
    });
    if (viewed.length > 10) viewed.pop(); // Keep last 10
    localStorage.setItem('user_recently_viewed', JSON.stringify(viewed));
}

function renderRecentlyViewed() {
    const container = document.getElementById('recently-viewed-container');
    const section = document.getElementById('recently-viewed');
    if (!container || !section) return;

    const viewed = JSON.parse(localStorage.getItem('user_recently_viewed') || '[]');
    if (viewed.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';

    // Create mini cards
    let html = '';
    viewed.forEach(prod => {
        let rawImg = prod.imgUrl || '';
        if (rawImg.includes(',')) {
            rawImg = rawImg.split(',')[0].trim();
        }
        let displayImg = rawImg || 'https://placehold.co/400x400/f8f9fa/c20026?text=Dtudo';
        const valPrice = parseFloat(prod.price || 0);
        const valOffer = parseFloat(prod['price-oferta'] || 0);
        const hasOffer = (valOffer > 0 && valOffer < valPrice);
        const finalPrice = hasOffer ? valOffer : valPrice;

        const fmtConfig = { style: 'currency', currency: 'BRL' };
        const fmtPrice = new Intl.NumberFormat('pt-BR', fmtConfig).format(finalPrice);

        html += `
            <div class="category-item" style="min-width: 120px; text-align: left; background: #fff; border: 1px solid #eee; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); cursor: pointer;" onclick="window.location.href='product.html?id=${prod.id}'">
                <img src="${displayImg}" style="width: 100%; height: 100px; object-fit: cover;">
                <div style="padding: 8px;">
                    <div style="font-size: 0.75rem; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px;">${prod.name}</div>
                    <div style="font-size: 0.9rem; font-weight: 700; color: #333;">${fmtPrice}</div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function sortProductsForUX(products) {
    const interests = JSON.parse(localStorage.getItem('user_interests') || '[]');

    return products.sort((a, b) => {
        const aStock = parseFloat(a.stock || 0);
        const bStock = parseFloat(b.stock || 0);

        // Esgotados para o final
        if (aStock <= 0 && bStock > 0) return 1;
        if (bStock <= 0 && aStock > 0) return -1;

        // Produtos com interesse salvos primeiro (apenas comparando se a categoria do produto contém algo da base do user)
        if (interests.length > 0) {
            const aCat = (a.category || '').toLowerCase();
            const bCat = (b.category || '').toLowerCase();
            const aMatch = interests.some(i => aCat.includes(i));
            const bMatch = interests.some(i => bCat.includes(i));

            if (aMatch && !bMatch) return -1;
            if (bMatch && !aMatch) return 1;
        }

        // Produtos com desconto no topo
        const aHasOffer = (parseFloat(a['price-oferta'] || 0) > 0 && parseFloat(a['price-oferta'] || 0) < parseFloat(a.price || 0));
        const bHasOffer = (parseFloat(b['price-oferta'] || 0) > 0 && parseFloat(b['price-oferta'] || 0) < parseFloat(b.price || 0));

        if (aHasOffer && !bHasOffer) return -1;
        if (bHasOffer && !aHasOffer) return 1;

        return 0;
    });
}

// Global state para não buscar do script mais de 1x
window._apiFetched = false;

async function fetchMoreProducts() {
    if (isLoading || allProductsLoaded) return;
    const loader = document.getElementById('infinite-loader');

    // 1. Caso faltem carregar os recursos iniciais / e esteja vazio o buffer
    if (productsBuffer.length === 0 && !window._apiFetched) {
        isLoading = true;
        if (loader) loader.style.display = 'block';

        try {
            const response = await fetch(`${APPSCRIPT_URL}?action=listarProdutosSuperApp`);
            const result = await response.json();

            if (result.status === "success" && result.data && result.data.length > 0) {
                saveToCache(result.data);
                const urlParams = new URLSearchParams(window.location.search);
                applyLocalFilter(result.data, urlParams.get('filter') || 'todos');
            } else {
                allProductsLoaded = true;
            }
        } catch (error) {
            console.error("Erro busca AppScript:", error);
            allProductsLoaded = true;
        } finally {
            window._apiFetched = true;
            isLoading = false;
            const customLoader = document.getElementById('custom-loader-overlay');
            if (customLoader) customLoader.style.display = 'none';
        }
    }

    // 2. Transfere suavemente para a tela os próximos blocos do buffer
    if (productsBuffer.length > 0) {
        isLoading = true;
        if (loader) loader.style.display = 'block';

        setTimeout(() => {
            const BATCH_SIZE = 12; // Lote controlado para manter engajamento
            const toDisplay = productsBuffer.slice(0, BATCH_SIZE);
            productsBuffer = productsBuffer.slice(BATCH_SIZE);

            renderProductBatch(toDisplay);

            if (productsBuffer.length === 0 && window._apiFetched) {
                allProductsLoaded = true;
            }
            isLoading = false;
            if (loader) loader.style.display = 'none';
        }, 500); // 500ms simula um carregamento natural ao rolar = excelente UX
    } else {
        allProductsLoaded = true;
        if (loader) loader.style.display = 'none';
    }
}

async function initProductFeed() {
    productsBuffer = [];
    allProductsLoaded = false;
    window._apiFetched = false;
    isLoading = false;

    renderRecentlyViewed();

    const container = document.getElementById('firebase-products-container');

    // Inicia a busca imediatamente em background
    const fetchPromise = (async () => {
        const cached = getCachedData();
        if (cached && cached.length > 0) {
            window._apiFetched = true;
            return cached;
        }
        try {
            const response = await fetch(`${APPSCRIPT_URL}?action=listarProdutosSuperApp`);
            const result = await response.json();
            if (result.status === "success" && result.data) {
                saveToCache(result.data);
                return result.data;
            }
        } catch (e) { console.error(e); }
        return [];
    })();

    // Garante que o skeleton seja visto por pelo menos 300ms para evitar flickering
    const [data] = await Promise.all([
        fetchPromise,
        new Promise(r => setTimeout(r, 300))
    ]);

    const finalData = (data && data.length > 0) ? data : DataManager.getProducts();

    if (finalData && finalData.length > 0) {
        window._apiFetched = true;
        const urlParams = new URLSearchParams(window.location.search);
        filterLocalCategory(urlParams.get('filter') || 'todos');

        // Soft refresh em background se usamos cache
        if (data === null || data.length === 0) {
            fetch(`${APPSCRIPT_URL}?action=listarProdutosSuperApp`)
                .then(res => res.json())
                .then(result => {
                    if (result.status === "success" && result.data) {
                        saveToCache(result.data);
                        // Se mudou algo, o evento productsUpdated (global) cuidará de atualizar o feed
                    }
                }).catch(() => { });
        }
    }

    // Hide custom loader gracefully after cached payload injects
    const customLoader = document.getElementById('custom-loader-overlay');
    if (customLoader) customLoader.style.display = 'none';

    const sentinel = document.getElementById('scroll-sentinel');
    if (sentinel) {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !isLoading && !allProductsLoaded) {
                fetchMoreProducts();
            }
        }, { rootMargin: '300px' });
        observer.observe(sentinel);
    }
}

window.filterLocalCategory = function (categoryStr) {
    const cached = getCachedData();
    if (!cached) return;

    categoryStr = categoryStr || 'todos';

    const homeSec = document.getElementById('home-sections-container');
    const feedCont = document.getElementById('firebase-products-container');
    const titleObj = document.getElementById('feed-title');
    const sentinel = document.getElementById('scroll-sentinel');

    if (categoryStr === 'todos') {
        if (homeSec) homeSec.style.display = 'block';
        if (feedCont) feedCont.style.display = 'none';
        if (titleObj) titleObj.style.display = 'none';
        if (sentinel) sentinel.style.display = 'none';

        renderHomeSections(cached);
        isLoading = false;
        allProductsLoaded = true; // disable scroll loading for home
    } else {
        if (homeSec) homeSec.style.display = 'none';
        if (feedCont) {
            feedCont.style.display = 'grid'; // because it is `.product-grid` wait. The class is product-grid, so it is inherently grid. But let's set display '' to revert to css override.
            feedCont.style.display = '';
            feedCont.innerHTML = '';
        }
        if (titleObj) {
            titleObj.style.display = 'block';
            if (categoryStr === 'ofertas') titleObj.innerText = 'Promoções Relâmpago ⚡';
            else titleObj.innerText = 'Categoria: ' + categoryStr.charAt(0).toUpperCase() + categoryStr.slice(1);
        }
        if (sentinel) sentinel.style.display = 'block';

        isLoading = false;
        allProductsLoaded = false;
        window._apiFetched = true;

        registerInterest(categoryStr);
        applyLocalFilter(cached, categoryStr);
        fetchMoreProducts();
    }

    // Smooth scroll para topo ao filtrar
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function applyLocalFilter(cached, categoryStr) {
    let filtered = cached;
    if (categoryStr === 'ofertas') {
        filtered = cached.filter(p => parseFloat(p['price-oferta'] || 0) > 0 && parseFloat(p['price-oferta'] || 0) < parseFloat(p.price || 0));
    } else if (categoryStr && categoryStr !== 'todos') {
        filtered = cached.filter(p => {
            const cat = (p.category || '').toLowerCase();
            const name = (p.name || '').toLowerCase();
            if (categoryStr === 'relogio') {
                // Filtra por categoria 'relogio' ou por nomes que indicam relógios (REL, Relógio, etc)
                return cat.includes('relogio') || name.includes('rel.') || name.includes('relogio') || name.includes('relógio');
            }
            if (categoryStr === 'escolar') {
                return cat.includes('escolar') || cat.includes('papelaria') || cat.includes('material');
            }
            return cat.includes(categoryStr.toLowerCase());
        });
    }

    // Filtro de Restrição: Exibe apenas produtos com nome válido.
    filtered = filtered.filter(p => p.name && p.name.trim() !== "");

    productsBuffer = sortProductsForUX(filtered);
}

// ==================== 3. LÓGICA DE DETALHES ====================

async function loadProductDetail(id) {
    // Esconde elementos da home
    document.querySelector('.home-offer-banner').style.display = 'none';
    document.querySelector('.banner-slider').style.display = 'none';
    document.querySelector('.categories-section').style.display = 'none';
    document.getElementById('products').style.display = 'none';

    // Mostra view de detalhe
    const detailView = document.getElementById('product-detail-view');
    const content = document.getElementById('detail-content');
    detailView.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'auto' });

    // Skeleton Screen (Carregamento)
    content.innerHTML = `
        <div class="detail-skeleton">
            <div class="sk-img"></div>
            <div class="sk-info">
                <div class="sk-line" style="width:60%"></div>
                <div class="sk-line" style="width:100%; height:30px; margin-bottom:20px;"></div>
                <div class="sk-line" style="width:40%; height:40px;"></div>
                <div class="sk-line" style="width:100%; height:50px; margin-top:30px;"></div>
            </div>
        </div>
    `;

    try {
        let prod = null;

        const cachedData = getCachedData();
        if (cachedData) {
            prod = cachedData.find(p => String(p.id) === String(id));
        }

        if (!prod) {
            const response = await fetch(`${APPSCRIPT_URL}?action=listarProdutosSuperApp`);
            const result = await response.json();
            if (result.status === "success" && result.data) {
                saveToCache(result.data);
                prod = result.data.find(p => String(p.id) === String(id));
            }
        }

        if (!prod) {
            content.innerHTML = "<h3>Produto não encontrado.</h3>";
            return;
        }

        registerInterest(prod.category);
        registerRecentlyViewed(prod);

        const doc = { id: String(id) };
        currentDetailImages = extractProductImages(prod);

        // --- PREÇOS ---
        const valPrice = parseFloat(prod.price || 0);
        const valOffer = parseFloat(prod['price-oferta'] || 0);
        const hasOffer = (valOffer > 0 && valOffer < valPrice);
        const finalPrice = hasOffer ? valOffer : valPrice;

        document.title = `${prod.name} | Dtudo`;

        const fmtConfig = { style: 'currency', currency: 'BRL' };
        const fmtFinal = new Intl.NumberFormat('pt-BR', fmtConfig).format(finalPrice);
        const fmtOld = new Intl.NumberFormat('pt-BR', fmtConfig).format(valPrice);

        // Analytics
        if (typeof gtag === 'function') {
            gtag('event', 'view_item', {
                currency: 'BRL', value: finalPrice,
                items: [{ item_id: doc.id, item_name: prod.name, price: finalPrice, quantity: 1 }]
            });
            gtag('event', 'page_view', { page_title: prod.name, page_location: window.location.href, page_path: `/produto/${prod.id}` });
        }

        // --- PARCELAMENTO ---
        const installmentBasis = getInstallmentBasis(prod);
        const maxInstallments = calculateInstallmentsRule(installmentBasis);
        const installmentValue = installmentBasis / maxInstallments;
        const fmtInstallmentValue = new Intl.NumberFormat('pt-BR', fmtConfig).format(installmentValue);

        const installmentBlock = `
            <div class="installment-container">
                <div class="installment-main">
                    <i class='bx bx-credit-card-front'></i>
                    <span>Em até <strong>${maxInstallments}x</strong> de <strong>${fmtInstallmentValue}</strong> sem juros</span>
                </div>
            </div>
        `;

        // Bloco de Preço
        let priceBlock = '';
        if (hasOffer) {
            const savings = valPrice - valOffer;
            const fmtSavings = new Intl.NumberFormat('pt-BR', fmtConfig).format(savings);
            priceBlock = `
                <div class="detail-price-old">${fmtOld}</div>
                <div class="detail-price-current">${fmtFinal}</div>
                <span class="detail-savings-text">Você economiza ${fmtSavings}</span>
            `;
        } else {
            priceBlock = `
                <div class="detail-price-current">${fmtFinal}</div>
            `;
        }

        // --- ESTOQUE ---
        const stockCount = parseInt(prod.stock || 0);
        const soldCount = parseInt(prod.sold || 0);
        let stockHtml = '';
        const maxRef = 8;

        if (stockCount <= 0) {
            stockHtml = `
                <div class="stock-scarcity-container">
                    <div class="stock-label"><strong style="color:#999">Esgotado</strong></div>
                    <div class="stock-track"><div class="stock-fill" style="width:0"></div></div>
                </div>`;
        } else if (stockCount <= maxRef) {
            let scarcityRatio = 1 - (stockCount / maxRef);
            if (stockCount === 1) scarcityRatio = 0.95;
            if (scarcityRatio < 0.1) scarcityRatio = 0.1;
            const barWidth = scarcityRatio * 100;
            stockHtml = `
                <div class="stock-scarcity-container">
                    <div class="stock-label">
                        <span>Disponibilidade: ${stockCount} itens</span>
                        <strong style="color:#db0038">Restam poucas unidades!</strong>
                    </div>
                    <div class="stock-track"><div class="stock-fill" style="width:${barWidth}%; background:#db0038"></div></div>
                </div>`;
        } else {
            stockHtml = `
                <div class="stock-scarcity-container">
                    <div class="stock-label">
                        <strong style="color:#00a650; display:flex; align-items:center; gap:5px;">
                            <i class='bx bxs-check-circle'></i> Disponível em estoque
                        </strong>
                    </div>
                </div>`;
        }

        // --- VARIAÇÕES (LINKED VARIANTS - VISUAL) ---
        let linkedVariantsHtml = '';
        if (prod.linkedVariants && Array.isArray(prod.linkedVariants) && prod.linkedVariants.length > 0) {

            // Renderiza as outras opções
            const othersHtml = prod.linkedVariants.map(v => `
                <div class="variant-option" onclick="window.location.href='product.html?id=${v.id}'" title="${v.name}">
                    <img src="${v.img || 'https://placehold.co/60'}" alt="${v.name}">
                    <span>${v.name}</span>
                </div>
            `).join('');

            // Renderiza a opção atual (Ativa)
            const currentHtml = `
                <div class="variant-option current" title="Selecionado: ${prod.name}">
                    <img src="${currentDetailImages[0]}" alt="${prod.name}">
                    <span>${prod.name}</span>
                </div>
            `;

            linkedVariantsHtml = `
                <div class="linked-variants-section">
                    <div class="linked-variants-title">Variações disponíveis:</div>
                    <div class="linked-variants-list">
                        ${currentHtml}
                        ${othersHtml}
                    </div>
                </div>
            `;
        }

        // --- VARIAÇÕES (TEXTO SIMPLES - LEGADO) ---
        // Mantemos isso caso você use variações simples como "Tamanho: P;M;G" dentro do mesmo produto ID
        let variantsHtml = '';
        if (prod.variants) {
            const vList = Array.isArray(prod.variants) ? prod.variants : prod.variants.split(';');
            if (vList.length > 0) {
                const btns = vList.map((v, i) => `<div class="variant-btn ${i === 0 ? 'selected' : ''}" onclick="selectVariant(this)">${v.trim()}</div>`).join('');
                variantsHtml = `<div class="variants-section"><div class="variants-title">Opções:</div><div class="variants-list">${btns}</div></div>`;
            }
        }

        // --- GALERIA THUMBNAILS ---
        const thumbsHtml = currentDetailImages.length > 1 ? `
            <div class="thumbnails-scroll">
                ${currentDetailImages.map((src, i) => `
                    <img src="${src}" class="thumbnail-item ${i === 0 ? 'active' : ''}" onclick="swapDetailImage('${src}', this)">
                `).join('')}
            </div>` : '';

        // --- MONTAGEM FINAL DO HTML ---
        content.innerHTML = `
            <div class="detail-view-container">
                <div class="detail-gallery-container">
                    <div class="main-image-wrapper">
                        <img id="main-detail-img" src="${currentDetailImages[0]}" alt="${prod.name}" onclick="openZoom(this.src)">
                        <div class="zoom-hint"><i class='bx bx-zoom-in'></i> Toque para ampliar</div>
                    </div>
                    ${thumbsHtml}
                </div>

                <div class="detail-info">
                    <div class="detail-status">Novo | ${soldCount} vendidos</div>

                    <h1 class="detail-title">${prod.name}</h1>
                    
                    ${''/*
                    <div class="detail-rating-summary" id="detail-rating-box">
                        <div class="review-stars-static">
                            <i class='bx bx-star' style="color:#ddd"></i><i class='bx bx-star' style="color:#ddd"></i><i class='bx bx-star' style="color:#ddd"></i><i class='bx bx-star' style="color:#ddd"></i><i class='bx bx-star' style="color:#ddd"></i>
                        </div>
                        <span style="font-size:0.9rem; color:#666; font-weight:600;">(0)</span>
                    </div>
                    */}



                    ${priceBlock}
                    ${stockHtml}
                    
                    ${linkedVariantsHtml}
                    
                    ${variantsHtml}

                    <div class="action-buttons">
                        <button class="btn-buy-now" 
                             ${stockCount <= 0 ? 'disabled style="background:#ccc; cursor:not-allowed;"' : ''}
                             onclick="addToCartDirect('${doc.id}', '${prod.name}', ${valPrice}, ${finalPrice}, '${currentDetailImages[0]}'); window.location.href='carrinho.html'">
                             ${stockCount <= 0 ? 'Indisponível' : 'Comprar Agora'}
                        </button>
                        
                        <button class="btn-add-cart" 
                            ${stockCount <= 0 ? 'disabled style="border-color:#ccc!important; color:#999!important;"' : ''}
                            onclick="addToCartDirect('${doc.id}', '${prod.name}', ${valPrice}, ${finalPrice}, '${currentDetailImages[0]}')">
                            Adicionar ao carrinho
                        </button>
                    </div>
                    <div class="seller-info" style="margin-top: 15px; padding: 12px; background: #f8f9fa; border-radius: 8px; border: 1px solid #eee; display: flex; align-items: center; gap: 10px;">
                        <i class='bx bx-store-alt' style="font-size: 1.5rem; color: #666;"></i>
                        <div style="font-size: 0.85rem; color: #444;">
                            Vendido por: <strong>D'Tudo Variedades</strong><br>
                            <span style="color: #888;">CD1 - Ipixuna do Pará</span>
                        </div>
                    </div>

                    <button class="btn-whatsapp-direct" 
                        style="background-color: #25D366; color: white; border: none; padding: 12px; border-radius: var(--radius-sm); font-weight: 700; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 10px; cursor: pointer;"
                        ${stockCount <= 0 ? 'disabled style="background:#ccc; cursor:not-allowed;"' : ''}
                        onclick="window.open('https://wa.me/5591986341760?text=Olá, quero fazer um pedido do produto: ${encodeURIComponent(prod.name)}', '_blank')">
                        <i class='bx bxl-whatsapp' style="font-size: 1.3rem;"></i> Comprar pelo WhatsApp
                    </button>

                    <div class="trust-badges">
                        <div class="trust-item">
                            <i class='bx bx-undo'></i>
                            <span><strong>Devolução Grátis.</strong> 7 dias a partir do recebimento.</span>
                        </div>
                        <div class="trust-item">
                            <i class='bx bx-shield-quarter'></i>
                            <span><strong>Compra Garantida.</strong> Receba o produto que está esperando ou devolvemos o dinheiro.</span>
                        </div>
                    </div>
                </div>
            </div>

            ${''/*
            <div class="comments-section">
                <div class="comments-header">Opiniões sobre o produto</div>
                <div id="review-form-container">
                    <div style="text-align:center; padding: 20px; background:#f9f9f9; border-radius:8px;">
                        <div class="spinner" style="margin:0 auto;"></div>
                    </div>
                </div>
                <div id="reviews-list" class="comment-list">
                    <div class="empty-reviews">
                        <i class='bx bx-message-square-dots'></i>
                        Carregando avaliações...
                    </div>
                </div>
            </div>
            */}


            <!-- PRODUTOS SUGERIDOS -->
            <div class="suggested-products-section" style="margin-top: 30px;">
                <h3 style="font-size: 1.1rem; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
                    <i class='bx bx-bulb' style="color: #ffb100;"></i> Quem viu este produto também comprou
                </h3>
                <div id="suggested-items-container" class="categories-scroll" style="gap: 15px;">
                    <!-- Preenchido via JS logo abaixo -->
                </div>
            </div>
            
            <div style="background:#fff; padding:20px; margin-top:20px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                <h3 style="font-size:1.2rem; margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px;">Descrição</h3>
                <p style="color:#666; line-height:1.6; white-space: pre-line;">${prod.description || 'Sem descrição detalhada.'}</p>
            </div>
        `;

        // Renderiza Sugestões no Detalhe
        renderSuggestedProducts(prod, cachedData);

        // fetchLiveRating(doc.id);
        // checkUserReviewStatus(doc.id);
        // loadReviews(doc.id);


    } catch (error) {
        console.error("Erro detalhes:", error);
        content.innerHTML = "<p>Erro ao carregar.</p>";
    } finally {
        const customLoader = document.getElementById('custom-loader-overlay');
        if (customLoader) customLoader.style.display = 'none';
    }
}

// --- ZOOM ---
window.openZoom = function (src) {
    const zoomModal = document.createElement('div');
    zoomModal.id = 'zoom-modal';
    zoomModal.style = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.95); z-index: 9999;
        display: flex; justify-content: center; align-items: center;
        overflow: hidden;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = "<i class='bx bx-x'></i>";
    closeBtn.style = `
        position: absolute; top: 20px; right: 20px;
        background: rgba(255,255,255,0.2); color: #fff;
        border: none; border-radius: 50%; width: 50px; height: 50px;
        font-size: 2rem; cursor: pointer; z-index: 10000;
    `;
    closeBtn.onclick = () => document.body.removeChild(zoomModal);

    const img = document.createElement('img');
    img.src = src;
    img.style = "max-width: 100%; max-height: 100%; transition: transform 0.2s;";

    let zoomed = false;
    img.onclick = (e) => {
        e.stopPropagation();
        zoomed = !zoomed;
        img.style.transform = zoomed ? "scale(2.5)" : "scale(1)";
        img.style.cursor = zoomed ? "zoom-out" : "zoom-in";
    };

    zoomModal.appendChild(closeBtn);
    zoomModal.appendChild(img);
    zoomModal.onclick = () => document.body.removeChild(zoomModal);

    document.body.appendChild(zoomModal);
}

// ==================== 4. LÓGICA DE AVALIAÇÃO & PROTEÇÃO ====================

async function fetchLiveRating(productId) {
    const ratingBox = document.getElementById('detail-rating-box');
    try {
        const snapshot = await db.collection('artifacts').doc(APP_ID)
            .collection('comments')
            .where('productId', '==', productId)
            .where('status', '==', 'approved')
            .get();

        if (snapshot.empty) return;

        let totalStars = 0;
        let count = 0;

        snapshot.forEach(doc => {
            const r = doc.data();
            totalStars += parseInt(r.rating || 0);
            count++;
        });

        if (count > 0) {
            const avg = totalStars / count;
            let starsHtml = '';
            for (let i = 1; i <= 5; i++) {
                if (i <= Math.round(avg)) starsHtml += "<i class='bx bxs-star' style='color:#3483fa'></i>";
                else starsHtml += "<i class='bx bx-star' style='color:#ddd'></i>";
            }
            if (ratingBox) {
                ratingBox.innerHTML = `
                    <div class="review-stars-static">${starsHtml}</div>
                    <span style="font-size:0.9rem; color:#666; font-weight:600;">(${count})</span>
                `;
            }
        }
    } catch (e) {
        console.error("Erro ao calcular média:", e);
    }
}

async function checkUserReviewStatus(productId) {
    const container = document.getElementById('review-form-container');

    if (!auth.currentUser) {
        container.innerHTML = `
            <div style="text-align:center; padding: 20px; background:#f9f9f9; border-radius:8px;">
                <p style="color:#666; margin-bottom:10px;">Quer avaliar este produto?</p>
                <button onclick="document.getElementById('user-profile-modal').classList.add('show')" class="btn-add-cart" style="width:auto; padding:10px 20px;">
                    Fazer Login
                </button>
            </div>`;
        return;
    }

    try {
        const snapshot = await db.collection('artifacts').doc(APP_ID)
            .collection('comments')
            .where('productId', '==', productId)
            .where('userId', '==', auth.currentUser.uid)
            .limit(1)
            .get();

        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            const data = doc.data();
            currentUserReviewId = doc.id;
            renderReviewForm(true, data);
        } else {
            currentUserReviewId = null;
            renderReviewForm(false, null);
        }
    } catch (e) {
        console.warn("Erro ao verificar review:", e);
        renderReviewForm(false, null);
    }
}

function renderReviewForm(isEditing, data) {
    const container = document.getElementById('review-form-container');
    const title = isEditing ? "Edite sua avaliação" : "O que você achou deste produto?";
    const btnText = isEditing ? "Atualizar Avaliação" : "Enviar Avaliação";

    const existingText = data ? data.text : "";
    const existingRating = data ? data.rating : 0;
    const existingImg = data ? data.image : null;

    selectedRating = existingRating;
    selectedReviewImageBase64 = existingImg;

    let starsHtml = "";
    for (let i = 1; i <= 5; i++) {
        const cls = (i <= selectedRating) ? 'bx bxs-star active' : 'bx bx-star';
        const style = (i <= selectedRating) ? 'color:#3483fa' : 'color:#e0e0e0';
        starsHtml += `<i class='${cls}' style='${style}' data-val="${i}" onclick="setRating(${i})"></i>`;
    }

    const imgPreviewStyle = existingImg ? "display:block;" : "display:none;";

    container.innerHTML = `
        <div class="comment-form">
            <span class="rating-label">${title}</span>
            <div class="rating-input" id="star-input-group">
                ${starsHtml}
            </div>

            <textarea id="new-review-text" placeholder="Conte-nos mais sobre sua experiência...">${existingText}</textarea>
            
            <div class="review-upload-box">
                <label for="review-file-input" class="review-upload-label">
                    <i class='bx bx-camera'></i> ${isEditing ? "Alterar foto" : "Adicionar fotos"}
                </label>
                <input type="file" id="review-file-input" accept="image/*" style="display:none;" onchange="handleReviewImage(this)">
                <img id="review-img-preview" src="${existingImg || ''}" style="${imgPreviewStyle}">
            </div>

            <div style="text-align: right;">
                <button class="cta-button" style="width:auto; padding: 12px 30px;" onclick="submitReview('${isEditing ? 'UPDATE' : 'CREATE'}')">${btnText}</button>
            </div>
        </div>
    `;
}

// --- FUNÇÕES DE SUPORTE ---

window.swapDetailImage = function (src, el) {
    document.getElementById('main-detail-img').src = src;
    document.querySelectorAll('.thumbnail-item').forEach(img => img.classList.remove('active'));
    el.classList.add('active');
}

window.selectVariant = function (el) {
    document.querySelectorAll('.variant-btn').forEach(btn => btn.classList.remove('selected'));
    el.classList.add('selected');
}

window.setRating = function (val) {
    selectedRating = val;
    const stars = document.querySelectorAll('#star-input-group i');
    stars.forEach(s => {
        const sVal = parseInt(s.dataset.val);
        if (sVal <= val) {
            s.className = 'bx bxs-star active';
            s.style.color = "#3483fa";
        } else {
            s.className = 'bx bx-star';
            s.style.color = "#e0e0e0";
        }
    });
}

window.handleReviewImage = function (input) {
    const file = input.files[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        alert("A imagem deve ter no máximo 10MB.");
        input.value = "";
        return;
    }

    const img = new Image();
    img.src = URL.createObjectURL(file);

    img.onload = function () {
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
            if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
            }
        } else {
            if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
            }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);

        selectedReviewImageBase64 = compressedBase64;

        const prev = document.getElementById('review-img-preview');
        prev.src = compressedBase64;
        prev.style.display = 'block';

        URL.revokeObjectURL(img.src);
    };

    img.onerror = function () {
        alert("Erro ao processar a imagem. Tente outra.");
        input.value = "";
    };
}

window.submitReview = async function (mode) {
    if (!auth.currentUser) {
        const loginModal = document.getElementById('user-profile-modal');
        if (loginModal) loginModal.classList.add('show');
        return;
    }

    const text = document.getElementById('new-review-text').value.trim();
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (selectedRating === 0) return alert("Selecione uma nota de 1 a 5 estrelas.");
    if (!text) return alert("Escreva um comentário.");

    const user = auth.currentUser;
    const reviewData = {
        productId: productId,
        userId: user.uid,
        userName: user.displayName || "Cliente",
        text: text,
        rating: selectedRating,
        image: selectedReviewImageBase64,
        status: 'pending',
        createdAt: new Date().toISOString()
    };

    let localReviews = getLocalUserReviews();
    localReviews = localReviews.filter(r => r.productId !== productId);
    localReviews.unshift(reviewData);
    saveLocalUserReviews(localReviews);

    loadReviews(productId);

    try {
        if (mode === 'UPDATE' && currentUserReviewId) {
            await db.collection('artifacts').doc(APP_ID)
                .collection('comments').doc(currentUserReviewId)
                .update({
                    ...reviewData,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            showToast("Avaliação atualizada!", "success");
        } else {
            await db.collection('artifacts').doc(APP_ID).collection('comments').add({
                ...reviewData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast("Avaliação enviada!", "success");
            checkUserReviewStatus(productId);
        }
    } catch (e) {
        console.error("Erro review:", e);
        alert("Erro ao salvar no servidor. Tente novamente.");
    }
}

async function loadReviews(productId) {
    const listEl = document.getElementById('reviews-list');
    if (!listEl) return;

    let html = '';

    let localReviews = getLocalUserReviews();
    const myReview = localReviews.find(r => r.productId === productId);
    if (myReview) {
        html += renderReviewItem(myReview, true);
    }

    try {
        const snapshot = await db.collection('artifacts').doc(APP_ID)
            .collection('comments')
            .where('productId', '==', productId)
            .where('status', '==', 'approved')
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();

        snapshot.forEach(doc => {
            const d = doc.data();
            if (auth.currentUser && d.userId === auth.currentUser.uid) return;
            html += renderReviewItem(d, false);
        });

        if (!html) {
            html = `
                <div class="empty-reviews">
                    <i class='bx bx-star'></i>
                    <p>Este produto ainda não tem avaliações.</p>
                    <small>Seja o primeiro a contar sua experiência!</small>
                </div>`;
        }
        listEl.innerHTML = html;

    } catch (e) {
        console.warn("Erro reviews (falta indice?):", e);
        if (html) listEl.innerHTML = html;
        else listEl.innerHTML = '<div class="empty-reviews"><p>Avaliações indisponíveis.</p></div>';
    }
}

function renderReviewItem(data, isPending) {
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
        starsHtml += (i <= data.rating)
            ? "<i class='bx bxs-star'></i>"
            : "<i class='bx bx-star' style='color:#ddd'></i>";
    }

    let dateStr = "Recentemente";
    if (data.createdAt) {
        const d = new Date(data.createdAt);
        dateStr = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    const initial = data.userName ? data.userName.charAt(0).toUpperCase() : "C";
    const imgHtml = data.image ? `<img src="${data.image}" class="review-image-attachment" onclick="window.open('${data.image}')" title="Ver zoom">` : '';

    const style = isPending ? 'opacity:0.8;' : '';

    return `
        <div class="comment-item" style="${style}">
            <div class="review-card-header">
                <div class="review-avatar">${initial}</div>
                <div>
                    <div class="comment-user-name">${data.userName}</div>
                    <div class="review-stars-static">${starsHtml}</div>
                </div>
                <div class="comment-date">${dateStr}</div>
            </div>
            
            <div class="comment-text">${data.text}</div>
            ${imgHtml}
        </div>
    `;
}

// Adicione esta função ao seu arquivo index.js (pode ser antes do DOMContentLoaded)

function initSlider() {
    const wrapper = document.querySelector('.slider-wrapper');
    const slides = document.querySelectorAll('.slide');

    // Se não houver slider ou slides, cancela para evitar erros
    if (!wrapper || slides.length === 0) return;

    let currentIndex = 0;
    const totalSlides = slides.length;
    const intervalTime = 4000; // Tempo em milissegundos (4 segundos)

    setInterval(() => {
        currentIndex++;

        // Se chegar no fim, volta para o primeiro
        if (currentIndex >= totalSlides) {
            currentIndex = 0;
        }

        // Move o wrapper para a esquerda baseado no índice atual
        // Ex: Index 1 move -100%, Index 2 move -200%
        wrapper.style.transform = `translateX(-${currentIndex * 100}%)`;
    }, intervalTime);
}

// --- CRONÔMETRO MEGA OFERTAS ---
function startMegaCountdown() {
    function updateTimer() {
        const now = new Date();
        const target = new Date();
        target.setHours(22, 0, 0, 0);

        let diff = target - now;

        if (diff <= 0) {
            // Se já passou das 22h, as ofertas encerram
            document.querySelectorAll('.timer-unit span').forEach(s => s.innerText = '00');
            const countdownTitle = document.querySelector('.countdown-texts h3');
            if (countdownTitle) countdownTitle.innerText = 'OFERTAS ENCERRADAS!';
            const countdownP = document.querySelector('.countdown-texts p');
            if (countdownP) countdownP.innerText = 'Fique atento para as próximas promoções.';
            return;
        }

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);

        const hEl = document.getElementById('timer-hours');
        const mEl = document.getElementById('timer-min');
        const sEl = document.getElementById('timer-sec');

        if (hEl) hEl.innerText = String(hours).padStart(2, '0');
        if (mEl) mEl.innerText = String(mins).padStart(2, '0');
        if (sEl) sEl.innerText = String(secs).padStart(2, '0');

        // Atualiza também o timer secundário da home se existir
        const homeTimer = document.getElementById('home-timer-countdown');
        if (homeTimer) {
            homeTimer.innerText = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
    }

    updateTimer();
    setInterval(updateTimer, 1000);
}

function renderSuggestedProducts(currentProd, allProducts) {
    const container = document.getElementById('suggested-items-container');
    if (!container || !allProducts) return;

    // Filtra produtos da mesma categoria, excluindo o atual, e que tenham imagem válida
    const category = (currentProd.category || '').toLowerCase();
    const nameLower = (currentProd.name || '').toLowerCase();

    let suggested = allProducts.filter(p => {
        if (String(p.id) === String(currentProd.id)) return false;
        if (!p.imgUrl || p.imgUrl.trim() === "" || p.imgUrl.includes('placehold.co')) return false;

        const pCat = (p.category || '').toLowerCase();
        const pName = (p.name || '').toLowerCase();

        // Lógica especial para relógios
        if (category === 'relogio' || nameLower.includes('rel.') || nameLower.includes('relogio') || nameLower.includes('relógio')) {
            return pCat.includes('relogio') || pName.includes('rel.') || pName.includes('relogio') || pName.includes('relógio');
        }

        return pCat === category;
    });

    // Se tiver poucos da mesma categoria, pega aleatórios
    if (suggested.length < 4) {
        const alreadyIn = new Set(suggested.map(p => p.id));
        const others = allProducts.filter(p =>
            String(p.id) !== String(currentProd.id) &&
            !alreadyIn.has(p.id) &&
            p.imgUrl && p.imgUrl.trim() !== "" && !p.imgUrl.includes('placehold.co')
        );
        suggested = [...suggested, ...others.sort(() => 0.5 - Math.random())];
    }

    // Limita a 8 itens
    suggested = suggested.slice(0, 8);

    if (suggested.length === 0) {
        document.querySelector('.suggested-products-section').style.display = 'none';
        return;
    }

    let html = '';
    suggested.forEach(prod => {
        let displayImg = prod.imgUrl || 'https://placehold.co/400x400/f8f9fa/c20026?text=Dtudo';
        const valPrice = parseFloat(prod.price || 0);
        const valOffer = parseFloat(prod['price-oferta'] || 0);
        const finalPrice = (valOffer > 0 && valOffer < valPrice) ? valOffer : valPrice;
        const fmtPrice = finalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        html += `
            <div class="category-item" style="min-width: 140px; text-align: left; background: #fff; border: 1px solid #eee; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: transform 0.2s; cursor: pointer;" onclick="window.location.href='product.html?id=${prod.id}'">
                <img src="${displayImg}" style="width: 100%; height: 120px; object-fit: cover;">
                <div style="padding: 10px;">
                    <div style="font-size: 0.8rem; color: #444; height: 32px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.2; margin-bottom: 5px;">${prod.name}</div>
                    <div style="font-size: 1rem; font-weight: 700; color: #c20026;">${fmtPrice}</div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// ==================== 5. INICIALIZAÇÃO ====================
document.addEventListener("DOMContentLoaded", () => {
    if (typeof initSlider === 'function') initSlider();
    if (typeof setupSearch === 'function') setupSearch();
    if (typeof updateCartBadge === 'function') updateCartBadge();
    if (typeof startSuggestionTimer === 'function') startSuggestionTimer();
    startMegaCountdown();

    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (productId) {
        loadProductDetail(productId);
    } else {
        if (document.getElementById('firebase-products-container')) {
            initProductFeed();
        }
        // Listen for background updates from DataManager (global.js)
        document.addEventListener('productsUpdated', (e) => {
            console.log("[Index] Recebida atualização do DataManager. Atualizando feed...");
            const urlParams = new URLSearchParams(window.location.search);
            if (!urlParams.get('id')) { // Only if not on detail view
                filterLocalCategory(urlParams.get('filter') || 'todos');
            }
        });
    }
});