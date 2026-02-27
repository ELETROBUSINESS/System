// CACHE_KEY is global from global.js

function getCachedData() {
    return DataManager.getProducts();
}

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

    if (name.includes(query) || cat.includes(query)) return true;

    for (const [key, synonyms] of Object.entries(SEARCH_SYNONYMS)) {
        if (query === key || synonyms.includes(query)) {
            if (name.includes(key) || synonyms.some(s => name.includes(s))) return true;
        }
    }
    return false;
}

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q') || '';
    const category = urlParams.get('category') || '';

    const resultsTitle = document.getElementById('search-results-title');
    const resultsSearchInput = document.getElementById('results-search-input');

    let pageTitle = "Resultados | Dtudo";
    if (query) {
        pageTitle = `Busca: ${query} | Dtudo`;
        resultsTitle.innerText = `Resultados para "${query}"`;
        resultsSearchInput.value = query;
        await performSearch(query, 'query');
    } else if (category) {
        pageTitle = `Categoria: ${category} | Dtudo`;
        resultsTitle.innerText = `Categoria: ${category.charAt(0).toUpperCase() + category.slice(1)}`;
        await performSearch(category, 'category');
    } else {
        resultsTitle.innerText = "Todos os Produtos";
        await performSearch('', 'all');
    }

    document.title = pageTitle;
    if (typeof gtag === 'function') {
        gtag('event', 'page_view', {
            page_title: pageTitle,
            page_location: window.location.href,
            page_path: window.location.pathname + window.location.search
        });
    }

    if (typeof updateCartBadge === 'function') updateCartBadge();
});

// Regras de parcelamento centralizadas no global.js

function renderSkeletonGrid(containerId, count = 4) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let html = '<div class="skeleton-grid" style="width:100%">';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="skeleton-card">
                <div class="skeleton-image shimmer"></div>
                <div class="skeleton-info">
                    <div class="skeleton-line sm shimmer"></div>
                    <div class="skeleton-line lg shimmer"></div>
                    <div class="skeleton-line md shimmer"></div>
                    <div class="skeleton-line price shimmer"></div>
                </div>
            </div>
        `;
    }
    html += '</div>';
    container.innerHTML = html;
}

async function performSearch(term, type) {
    const container = document.getElementById('search-results-container');
    const noResults = document.getElementById('no-results-message');
    const suggestionsSection = document.getElementById('suggested-results-section');
    const suggestionsContainer = document.getElementById('suggested-products-container');

    renderSkeletonGrid('search-results-container', 4);

    let allProducts = getCachedData();

    if (!allProducts || allProducts.length === 0) {
        try {
            const res = await fetch(`${APPSCRIPT_URL}?action=listarProdutosSuperApp`);
            const json = await res.json();
            if (json.status === 'success') {
                allProducts = json.data;
                localStorage.setItem(CACHE_KEY, JSON.stringify(allProducts));
            }
        } catch (e) {
            console.error("Erro ao buscar produtos:", e);
        }
    }

    let results = [];
    if (type === 'query') {
        results = allProducts.filter(p => smartMatch(p, term));
    } else if (type === 'category') {
        const lowerCat = term.toLowerCase();
        results = allProducts.filter(p => p.category && p.category.toLowerCase().includes(lowerCat));
    } else {
        results = allProducts;
    }

    // Filter valid images
    results = results.filter(p => p.imgUrl && p.imgUrl.trim() !== "" && !p.imgUrl.includes('placehold.co') && (p.imgUrl.startsWith('http') || p.imgUrl.includes('/')));

    if (typeof trackEvent === 'function') {
        trackEvent('search', {
            search_term: term,
            search_type: type,
            results_count: results.length
        });
    }

    if (results.length > 0) {
        container.innerHTML = '';
        renderProducts(results, container);
    } else {
        container.innerHTML = '';
        noResults.style.display = 'block';
        suggestionsSection.style.display = 'block';

        const suggestions = allProducts
            .filter(p => p.imgUrl && p.imgUrl.trim() !== "" && !p.imgUrl.includes('placehold.co') && (p.imgUrl.startsWith('http') || p.imgUrl.includes('/')))
            .sort(() => 0.5 - Math.random())
            .slice(0, 8);
        renderProducts(suggestions, suggestionsContainer);
    }
}

function renderProducts(products, target) {
    const OFFER_DEADLINE = new Date("2026-02-28T23:59:59").getTime();
    const isExpired = Date.now() >= OFFER_DEADLINE;

    products.forEach(prod => {
        const valPrice = parseFloat(prod.price || 0); // Preço original (Cartão)
        const valOffer = parseFloat(prod['price-oferta'] || 0);
        const hasOffer = (valOffer > 0 && valOffer < valPrice);

        // Se expirou e é oferta, pausa (não renderiza)
        if (hasOffer && isExpired) return;

        let pricePix, priceCard;

        if (hasOffer) {
            pricePix = valOffer; // Oferta é o preço final do PIX
            priceCard = valPrice; // Cartão mantém preço original
        } else {
            priceCard = valPrice;
            pricePix = valPrice * 0.95; // 5% de desconto PIX para produtos fora de oferta
        }

        let name = prod.name || '';
        name = name.toLowerCase().replace(/(^\w|\s\w)/g, m => m.toUpperCase());

        let priceHtml = '';
        if (hasOffer) {
            priceHtml = `
                <div class="price-container">
                    <span class="price-old">${formatCurrency(valPrice)}</span>
                    <span class="price-new">${formatCurrency(pricePix)} <small style="font-size: 0.65rem; color: #666; font-weight: 500;">no Pix</small></span>
                </div>`;
        } else {
            priceHtml = `
                <div class="price-container">
                    <span class="price-old">${formatCurrency(priceCard)}</span>
                    <span class="price-new">${formatCurrency(pricePix)} <small style="font-size: 0.65rem; color: #666; font-weight: 500;">no Pix</small></span>
                </div>`;
        }

        const installmentHtml = getInstallmentHtml(priceCard);

        let displayImg = getFirstImageUrl(prod.imgUrl);

        let timerHtml = '';
        if (hasOffer) {
            timerHtml = `
                <div class="offer-timer">
                    <i class='bx bx-time-five'></i>
                    <span class="timer-countdown">--:--:--</span>
                </div>`;
        }

        const html = `
            <div class="product-card ${hasOffer ? 'has-offer' : ''}" id="prod-${prod.id}">
                <div class="product-image" onclick="window.location.href='product.html?id=${prod.id}'">
                    ${timerHtml}
                    <img src="${displayImg}" alt="${name}" loading="lazy">
                    <button class="cart-btn-overlay" onclick="event.stopPropagation(); addToCartDirect('${prod.id}', '${name}', ${priceCard}, ${pricePix}, '${displayImg}')">
                        <i class='bx bx-cart-add'></i>
                    </button>
                </div>
                <div class="product-info" onclick="window.location.href='product.html?id=${prod.id}'">
                    <div class="seller-tag"><i class='bx bxs-badge-check'></i> D'tudo Variedades</div>
                    <h4 class="product-name" style="text-transform: none;">${name}</h4>
                    ${priceHtml}
                    ${installmentHtml}
                </div>
            </div>`;
        target.insertAdjacentHTML('beforeend', html);
    });
}

window.addToCartDirect = function (id, name, priceOriginal, priceNew, img) {
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

    const toast = document.createElement('div');
    toast.className = 'toast show';
    toast.innerHTML = `<i class='bx bx-check-circle'></i> ${name} adicionado!`;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

function updateCartBadge() {
    const badge = document.getElementById('cart-badge');
    const badgeDesktop = document.getElementById('cart-badge-desktop');
    const cart = JSON.parse(localStorage.getItem('app_cart') || '[]');
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);

    if (badge) {
        badge.innerText = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
    if (badgeDesktop) {
        badgeDesktop.innerText = count;
        badgeDesktop.style.display = count > 0 ? 'inline-block' : 'none';
    }
}
