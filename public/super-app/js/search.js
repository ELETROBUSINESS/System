// js/search.js

const APPSCRIPT_URL = "https://script.google.com/macros/s/AKfycbzB7dluoiNyJ4XK6oDK_iyuKZfwPTAJa4ua4RetQsUX9cMObgE-k_tFGI82HxW_OyMf/exec";
const CACHE_KEY = 'dtudo_products_cache';

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

    if (query) {
        resultsTitle.innerText = `Resultados para "${query}"`;
        resultsSearchInput.value = query;
        await performSearch(query, 'query');
    } else if (category) {
        resultsTitle.innerText = `Categoria: ${category.charAt(0).toUpperCase() + category.slice(1)}`;
        await performSearch(category, 'category');
    } else {
        resultsTitle.innerText = "Todos os Produtos";
        await performSearch('', 'all');
    }

    if (typeof updateCartBadge === 'function') updateCartBadge();
});

function calculateInstallmentsRule(price) {
    if (price >= 300) return 3;
    if (price >= 150) return 2;
    return 1; // À vista no cartão
}

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

    let allProducts = [];
    const cached = sessionStorage.getItem(CACHE_KEY);

    if (cached) {
        allProducts = JSON.parse(cached);
    } else {
        try {
            const res = await fetch(`${APPSCRIPT_URL}?action=listarProdutosSuperApp`);
            const json = await res.json();
            if (json.status === 'success') {
                allProducts = json.data;
                sessionStorage.setItem(CACHE_KEY, JSON.stringify(allProducts));
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
    products.forEach(prod => {
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

        const maxInst = calculateInstallmentsRule(priceCard);
        let installmentHtml = '';
        if (maxInst > 1) {
            installmentHtml = `<div class="installment-text">ou <b>${fmtCard}</b> em até <b>${maxInst}x</b></div>`;
        } else {
            installmentHtml = `<div class="installment-text">ou <b>${fmtCard}</b> no cartão</div>`;
        }

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

        const html = `
            <div class="product-card" id="prod-${prod.id}">
                <div class="product-image" onclick="window.location.href='product.html?id=${prod.id}'">
                    <img src="${prod.imgUrl}" alt="${name}" loading="lazy">
                    <button class="cart-btn-overlay" onclick="event.stopPropagation(); addToCartDirect('${prod.id}', '${name}', ${priceCard}, ${pricePix}, '${prod.imgUrl}')">
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
