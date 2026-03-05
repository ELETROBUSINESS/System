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
    'escolar': ['papelaria', 'caderno', 'caneta', 'lapis', 'mochila'],
    'presenteie': ['dia das mulheres', 'dia da mulher', 'mulheres', 'mulher'],
    'makes': ['cosméticos', 'maquiagens', 'maquiagem', 'batom', 'rimel', 'blush', 'makeup', 'make up']
};

function smartMatch(product, term) {
    const name = (product.name || '').toLowerCase();
    const cat = (product.category || '').toLowerCase();
    const brand = (product.brand || product.marca || '').toLowerCase();
    const query = term.toLowerCase();

    // 1. Verifica match direto (Nome, Categoria ou Marca)
    if (name.includes(query) || cat.includes(query) || brand.includes(query)) return true;

    // 2. Verifica Sinônimos
    for (const [key, synonyms] of Object.entries(SEARCH_SYNONYMS)) {
        // Se o termo pesquisado é a chave ou está nos sinônimos daquela chave
        if (query === key || synonyms.includes(query)) {
            // Verifica se o NOME, CATEGORIA ou MARCA do produto contém a CHAVE ou algum dos SINÔNIMOS
            const matchesKey = name.includes(key) || cat.includes(key) || brand.includes(key);
            const matchesSynonym = synonyms.some(s => name.includes(s) || cat.includes(s) || brand.includes(s));

            if (matchesKey || matchesSynonym) return true;
        }
    }
    return false;
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log("[Search] Inicializando busca...");
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const query = urlParams.get('q') || '';
        const category = urlParams.get('category') || '';

        const resultsTitle = document.getElementById('search-results-title');
        const resultsSearchInput = document.getElementById('results-search-input');

        let pageTitle = "Resultados | Dtudo";
        if (query) {
            console.log("[Search] Termo de busca:", query);
            pageTitle = `Busca: ${query} | Dtudo`;
            if (resultsTitle) resultsTitle.innerText = `Resultados para "${query}"`;
            if (resultsSearchInput) resultsSearchInput.value = query;
            await performSearch(query, 'query');
        } else if (category) {
            console.log("[Search] Categoria:", category);
            pageTitle = `Categoria: ${category} | Dtudo`;
            if (resultsTitle) resultsTitle.innerText = `Categoria: ${category.charAt(0).toUpperCase() + category.slice(1)}`;
            await performSearch(category, 'category');
        } else {
            console.log("[Search] Nenhum termo, mostrando todos");
            if (resultsTitle) resultsTitle.innerText = "Todos os Produtos";
            await performSearch('', 'all');
        }

        document.title = pageTitle;
        setupSearch();

        if (typeof gtag === 'function') {
            gtag('event', 'page_view', {
                page_title: pageTitle,
                page_location: window.location.href,
                page_path: window.location.pathname + window.location.search
            });
        }
    } catch (error) {
        console.error("[Search] Erro fatal na inicialização:", error);
    }

    if (typeof updateCartBadge === 'function') updateCartBadge();
});

// --- LÓGICA DO MODAL DE BUSCA (Portado de index.js) ---
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

    // Limpeza de histórico corrompido (strings HTML em vez de termos)
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
        // Sanitiza o termo para exibição
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
                    const filtered = cached.filter(p => smartMatch(p, term)).slice(0, 6);

                    if (filtered.length > 0) {
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
                        <div class="suggestion-item" onclick="window.location.href='search.html?category=relogio'"><i class='bx bx-trending-up'></i> Relógios</div>
                        <div class="suggestion-item" onclick="window.location.href='search.html?category=escolar'"><i class='bx bx-trending-up'></i> Material Escolar</div>
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

    const modal = document.getElementById('search-modal');
    if (modal) {
        modal.onclick = (e) => {
            if (e.target === modal) closeSearchModal();
        };
    }
}


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
    console.log(`[Search] performSearch iniciada: term="${term}", type="${type}"`);
    const container = document.getElementById('search-results-container');
    const noResults = document.getElementById('no-results-message');
    const suggestionsSection = document.getElementById('suggested-results-section');
    const suggestionsContainer = document.getElementById('suggested-products-container');

    if (!container) {
        console.error("[Search] Container 'search-results-container' não encontrado!");
        return;
    }

    // Tenta pegar do cache imediatamente
    let allProducts = getCachedData();

    // Se NÃO tem cache, mostra skeleton e busca do zero
    if (!allProducts || allProducts.length === 0) {
        renderSkeletonGrid('search-results-container', 4);
        try {
            const res = await fetch(`${APPSCRIPT_URL}?action=listarProdutosSuperApp`);
            const json = await res.json();
            if (json.status === 'success') {
                allProducts = json.data;
                localStorage.setItem(CACHE_KEY, JSON.stringify(allProducts));
                localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
            }
        } catch (e) {
            console.error("Erro ao buscar produtos:", e);
        }
    }

    if (!allProducts || allProducts.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:#666;">Erro ao carregar produtos. Verifique sua conexão.</div>';
        return;
    }

    let results = [];
    const lowerTerm = term.toLowerCase();

    if (type === 'query') {
        results = allProducts.filter(p => smartMatch(p, term));
    } else if (type === 'category') {
        if (lowerTerm === 'ofertas') {
            const OFFER_DEADLINE = new Date("2026-03-02T23:59:59").getTime();
            const isExpired = Date.now() >= OFFER_DEADLINE;
            if (isExpired) {
                results = [];
            } else {
                results = allProducts.filter(p => {
                    const valPrice = parseFloat(p.price || 0);
                    const valOffer = parseFloat(p['price-oferta'] || 0);
                    return valOffer > 0 && valOffer < valPrice;
                });
            }
        } else if (lowerTerm === 'presenteie' || lowerTerm === 'makes') {
            // Usa smartMatch para categorias especiais (sinônimos)
            results = allProducts.filter(p => smartMatch(p, term));
        } else if (lowerTerm === 'relogio' || lowerTerm === 'relógio') {
            // Filtro específico para relógios conforme definido
            results = allProducts.filter(p =>
                (p.name || '').toUpperCase().includes('REL') &&
                (p.name || '').toLowerCase().includes('feminino')
            );
        } else {
            results = allProducts.filter(p => p.category && p.category.toLowerCase().includes(lowerTerm));
        }

    } else {
        // "Todos os produtos" - limitar para não travar o browser
        results = allProducts.slice(0, 48);
    }

    // Filtrar produtos sem nome ou imagem
    results = results.filter(p => p.name && p.imgUrl && p.imgUrl.trim() !== "" && !p.imgUrl.includes('placehold.co'));

    if (typeof trackEvent === 'function') {
        trackEvent('search', {
            search_term: term,
            search_type: type,
            results_count: results.length
        });
    }

    container.innerHTML = '';
    if (results.length > 0 || (type === 'category' && lowerTerm === 'presenteie')) {
        noResults.style.display = 'none';
        suggestionsSection.style.display = 'none';

        // Renderiza Resultados Principais
        renderProducts(results, container);

        // LOGICA ESPECIAL: PRESENTEIE
        if (type === 'category' && lowerTerm === 'presenteie') {
            // 1. Injetar Banner
            const bannerHtml = `
                <div class="special-category-banner" style="grid-column: 1 / -1; margin: 20px 0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                    <img src="day-banner-mulher01.png" alt="Dia das Mulheres" style="width: 100%; display: block;">
                </div>
                <h3 class="section-title" style="grid-column: 1 / -1; margin: 20px 2.5% 10px; color: #db0038;">Sugestões de Makes</h3>
            `;
            container.insertAdjacentHTML('beforeend', bannerHtml);

            // 2. Extensão 'Makes'
            const makeResults = allProducts.filter(p =>
                !results.find(r => r.id === p.id) && // Evita duplicatas
                smartMatch(p, 'makes') &&
                p.name && p.imgUrl && p.imgUrl.trim() !== "" && !p.imgUrl.includes('placehold.co')
            );
            renderProducts(makeResults, container);

            // 3. Extensão 'Relógios Femininos'
            const watchResults = allProducts.filter(p =>
                !results.find(r => r.id === p.id) &&
                !makeResults.find(m => m.id === p.id) &&
                (p.name || '').toUpperCase().includes('REL') &&
                (p.name || '').toLowerCase().includes('feminino') &&
                p.name && p.imgUrl && p.imgUrl.trim() !== "" && !p.imgUrl.includes('placehold.co')
            );

            if (watchResults.length > 0) {
                container.insertAdjacentHTML('beforeend', `<h3 class="section-title" style="grid-column: 1 / -1; margin: 20px 2.5% 10px; color: #db0038;">Relógios Femininos</h3>`);
                renderProducts(watchResults, container);
            }
        }
    } else {
        noResults.style.display = 'block';
        suggestionsSection.style.display = 'block';

        const suggestions = allProducts
            .filter(p => p.name && p.imgUrl && p.imgUrl.trim() !== "" && !p.imgUrl.includes('placehold.co'))
            .sort(() => 0.5 - Math.random())
            .slice(0, 8);

        if (suggestionsContainer) {
            suggestionsContainer.innerHTML = '';
            renderProducts(suggestions, suggestionsContainer);
        }
    }
}


function renderProducts(products, target) {
    const OFFER_DEADLINE = new Date("2026-03-02T23:59:59").getTime();
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
            pricePix = valPrice * 0.98; // 2% de desconto PIX para produtos fora de oferta
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

        if (typeof showToast === 'function') {
            showToast(`${name} adicionado!`, "success");
        }
    }
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

document.addEventListener('click', (e) => {
    const container = document.getElementById('header-search-container');
    if (container && !container.contains(e.target) && window.innerWidth < 768) {
        // No search.html, ignoramos o fechamento automático para manter a barra visível
    }
});

