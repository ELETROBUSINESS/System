// js/index.js

const STORE_OWNER_UID = "3zYT9Y6hXWeJSuvmEYP4FMZa5gI2";
const APP_ID = 'floralchic-loja';
const CACHE_KEY = 'dtudo_products_cache';
const CACHE_TIME_KEY = 'dtudo_cache_time';
const CACHE_DURATION = 20 * 60 * 1000;
const COMMENTS_CACHE_KEY = "dtudo_user_reviews";
const REVIEWS_CACHE_DURATION = 20 * 60 * 60 * 1000; 
const CART_KEY = 'app_cart';

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

// --- NOVA REGRA DE PARCELAMENTO (MERCADO PAGO) ---
function calculateInstallmentsRule(price) {
    if (price >= 1000) return 12;
    if (price >= 800) return 9;
    if (price >= 625) return 8;
    if (price >= 600) return 7;
    if (price >= 300) return 6;
    if (price >= 250) return 5;
    return 4; // Até 4x padrão
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

window.addToCartDirect = function(id, name, price, img) {
    let cart = JSON.parse(localStorage.getItem(CART_KEY)) || [];
    const existingItem = cart.find(item => item.id === id);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ id: id, name: name, priceNew: price, image: img, quantity: 1 });
    }
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    if(typeof updateCartBadge === 'function') updateCartBadge();
    showToast(`${name} adicionado ao carrinho!`, "success");
}

function extractProductImages(prod) {
    let images = [];
    if (prod.imgUrl && prod.imgUrl.trim() !== "") images.push(prod.imgUrl.trim());
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
    const json = sessionStorage.getItem(CACHE_KEY);
    const time = sessionStorage.getItem(CACHE_TIME_KEY);
    if (!json || !time) return null;
    if (new Date().getTime() - parseInt(time) > CACHE_DURATION) { clearCache(); return null; }
    return JSON.parse(json);
}

function saveToCache(newProducts) {
    const currentCache = getCachedData() || [];
    const uniqueIds = new Set(currentCache.map(p => p.id));
    const merged = [...currentCache];
    newProducts.forEach(p => { if (!uniqueIds.has(p.id)) merged.push(p); });
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(merged));
    sessionStorage.setItem(CACHE_TIME_KEY, new Date().getTime().toString());
}

function clearCache() {
    sessionStorage.removeItem(CACHE_KEY);
    sessionStorage.removeItem(CACHE_TIME_KEY);
}

// ==================== 2. RENDERIZAÇÃO DA HOME (CARD NOVO) ====================

function renderProductBatch(products) {
    const container = document.getElementById('firebase-products-container');
    if (container.querySelector('.skeleton-card')) container.innerHTML = ''; 

    products.forEach(prod => {
        if(document.getElementById(`prod-${prod.id}`)) return;

        let displayImg = prod.imgUrl || 'https://placehold.co/400x400/EBEBEB/333?text=Sem+Foto';
        
        // Preços de exibição (Venda)
        const valPrice = parseFloat(prod.price || 0); // Original
        const valOffer = parseFloat(prod['price-oferta'] || 0); // Oferta Atual
        const hasOffer = (valOffer > 0 && valOffer < valPrice);
        
        const fmtConfig = { style: 'currency', currency: 'BRL' };
        const fmtNormal = new Intl.NumberFormat('pt-BR', fmtConfig).format(valPrice);
        const fmtOffer = new Intl.NumberFormat('pt-BR', fmtConfig).format(valOffer);

        // Lógica de Parcelamento (Baseada em pc-oferta ou price)
        const installmentBasis = getInstallmentBasis(prod);
        const maxInst = calculateInstallmentsRule(installmentBasis);
        const valInst = installmentBasis / maxInst;
        const fmtInst = new Intl.NumberFormat('pt-BR', fmtConfig).format(valInst);

        let priceHtml = '';
        
        if (hasOffer) {
            // TEM OFERTA: Mostra economia
            const savings = valPrice - valOffer;
            const fmtSavings = new Intl.NumberFormat('pt-BR', fmtConfig).format(savings);
            
            priceHtml = `
                <div class="price-container">
                    <span class="price-old">${fmtNormal}</span>
                    <span class="price-new">${fmtOffer}</span>
                    <span class="card-savings">Economize ${fmtSavings}</span>
                </div>`;
        } else {
            // NÃO TEM OFERTA: Mostra parcelamento calculado com a base correta
            priceHtml = `
                <div class="price-container">
                    <span class="price-new">${fmtNormal}</span>
                    <span class="card-savings">${maxInst}x de ${fmtInst} sem juros</span>
                </div>`;
        }

        const stock = parseInt(prod.stock || 0);
        const isSoldOut = stock <= 0;

        const html = `
            <div class="product-card ${isSoldOut ? 'sold-out' : ''}" id="prod-${prod.id}" onclick="window.location.href='index.html?id=${prod.id}'">
                <div class="product-image">
                    <img src="${displayImg}" alt="${prod.name}" loading="lazy" onload="this.classList.add('loaded')">
                    ${isSoldOut ? '<div style="position:absolute; bottom:0; width:100%; background:#ccc; color:#555; text-align:center; font-size:0.8rem; font-weight:700;">Esgotado</div>' : ''}
                </div>
                <div class="product-info">
                    <h4 class="product-name">${prod.name}</h4>
                    ${priceHtml}
                    <div class="free-shipping"><i class='bx bxs-truck'></i> Frete Grátis</div>
                </div>
            </div>`;
        container.insertAdjacentHTML('beforeend', html);
    });
}

// --- BUSCA COM SUGESTÕES ---
function setupSearch() {
    const input = document.querySelector('.search-bar input');
    const dropdown = document.getElementById('search-dropdown');
    
    if(!input || !dropdown) return;

    input.addEventListener('input', (e) => {
        const term = e.target.value.trim().toLowerCase();
        clearTimeout(searchDebounceTimeout);
        
        if(term.length < 2) {
            dropdown.style.display = 'none';
            dropdown.innerHTML = '';
            return;
        }

        searchDebounceTimeout = setTimeout(async () => {
            dropdown.innerHTML = '<div style="padding:10px; text-align:center; color:#666;">Buscando...</div>';
            dropdown.style.display = 'block';

            const cached = getCachedData() || [];
            let results = cached.filter(p => p.name.toLowerCase().includes(term)).slice(0, 5);

            if(results.length === 0) {
                dropdown.innerHTML = '<div style="padding:10px; text-align:center; color:#666;">Nenhum produto encontrado.</div>';
            } else {
                let html = '';
                results.forEach(p => {
                    const price = parseFloat(p['price-oferta'] || p.price || 0);
                    const fmtPrice = price.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
                    const img = p.imgUrl || 'https://placehold.co/50x50';
                    
                    html += `
                        <div class="search-item" onclick="window.location.href='index.html?id=${p.id}'" style="display:flex; gap:10px; padding:10px; border-bottom:1px solid #eee; cursor:pointer; align-items:center;">
                            <img src="${img}" style="width:40px; height:40px; object-fit:cover; border-radius:4px;">
                            <div>
                                <div style="font-size:0.9rem; font-weight:500; color:#333;">${p.name}</div>
                                <div style="font-size:0.8rem; color:#00a650; font-weight:700;">${fmtPrice}</div>
                            </div>
                        </div>
                    `;
                });
                dropdown.innerHTML = html;
            }
        }, 300);
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

function startSuggestionTimer() {
    setInterval(() => {
        const allCards = Array.from(document.querySelectorAll('.product-card:not(.skeleton-card)'));
        if (allCards.length === 0) return;
        
        const randomIndex = Math.floor(Math.random() * allCards.length);
        const card = allCards[randomIndex];
        if(card) {
            card.classList.add('suggest-animation');
            setTimeout(() => card.classList.remove('suggest-animation'), 6000);
        }
    }, 60000); 
}

async function fetchMoreProducts() {
    if (isLoading || allProductsLoaded) return;
    const loader = document.getElementById('infinite-loader');

    if (productsBuffer.length > 0) {
        if(loader) loader.style.display = 'block';
        setTimeout(() => {
            renderProductBatch(productsBuffer);
            productsBuffer = [];
            if(loader) loader.style.display = 'none';
        }, 300);
        return; 
    }

    isLoading = true;
    if(loader) loader.style.display = 'block';

    try {
        let query = db.collection('artifacts').doc(APP_ID)
                      .collection('users').doc(STORE_OWNER_UID)
                      .collection('products')
                      .orderBy('createdAt', 'desc')
                      .limit(30);

        if (lastVisibleDoc) query = query.startAfter(lastVisibleDoc);
        const snapshot = await query.get();

        if (snapshot.empty) {
            allProductsLoaded = true;
            if(loader) loader.style.display = 'none';
            return;
        }

        lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
        const products = [];
        snapshot.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
        saveToCache(products);

        const toDisplay = products.slice(0, 20);
        const toBuffer = products.slice(20);
        renderProductBatch(toDisplay);
        productsBuffer = toBuffer;

    } catch (error) {
        console.error("Erro busca:", error);
    } finally {
        isLoading = false;
        if(loader) loader.style.display = 'none';
    }
}

async function initProductFeed() {
    const cached = getCachedData();
    if (cached && cached.length > 0) {
        renderProductBatch(cached);
    } else {
        await fetchMoreProducts();
    }
    const sentinel = document.getElementById('scroll-sentinel');
    if (sentinel) {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) fetchMoreProducts();
        }, { rootMargin: '200px' });
        observer.observe(sentinel);
    }
}

// ==================== 3. LÓGICA DE DETALHES ====================

async function loadProductDetail(id) {
    document.querySelector('.home-offer-banner').style.display = 'none';
    document.querySelector('.banner-slider').style.display = 'none';
    document.querySelector('.categories-section').style.display = 'none';
    document.getElementById('products').style.display = 'none';
    
    const detailView = document.getElementById('product-detail-view');
    const content = document.getElementById('detail-content');
    detailView.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'auto' });

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
        const doc = await db.collection('artifacts').doc(APP_ID)
                            .collection('users').doc(STORE_OWNER_UID)
                            .collection('products').doc(id).get();

        if (!doc.exists) {
            content.innerHTML = "<h3>Produto não encontrado.</h3>";
            return;
        }

        const prod = doc.data();
        currentDetailImages = extractProductImages(prod);

        // Preços de Exibição
        const valPrice = parseFloat(prod.price || 0);
        const valOffer = parseFloat(prod['price-oferta'] || 0);
        const hasOffer = (valOffer > 0 && valOffer < valPrice);
        const finalPrice = hasOffer ? valOffer : valPrice;
        
        document.title = `${prod.name} | Dtudo`;
        
        const fmtConfig = { style: 'currency', currency: 'BRL' };
        const fmtFinal = new Intl.NumberFormat('pt-BR', fmtConfig).format(finalPrice);
        const fmtOld = new Intl.NumberFormat('pt-BR', fmtConfig).format(valPrice);

        // --- LÓGICA DE PARCELAMENTO (BASEADA EM pc-oferta OU price) ---
        const installmentBasis = getInstallmentBasis(prod); // Usa pc-oferta se existir, senão usa price
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

        let priceBlock = '';
        if (hasOffer) {
            const savings = valPrice - valOffer;
            const fmtSavings = new Intl.NumberFormat('pt-BR', fmtConfig).format(savings);
            priceBlock = `
                <div class="detail-price-old">${fmtOld}</div>
                <div class="detail-price-current">${fmtFinal}</div>
                <span class="detail-savings-text">Você economiza ${fmtSavings}</span>
                ${installmentBlock}
            `;
        } else {
            priceBlock = `
                <div class="detail-price-current">${fmtFinal}</div>
                ${installmentBlock}
            `;
        }

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

        let variantsHtml = '';
        if (prod.variants) {
            const vList = Array.isArray(prod.variants) ? prod.variants : prod.variants.split(';');
            if (vList.length > 0) {
                const btns = vList.map((v, i) => `<div class="variant-btn ${i===0?'selected':''}" onclick="selectVariant(this)">${v.trim()}</div>`).join('');
                variantsHtml = `<div class="variants-section"><div class="variants-title">Opções:</div><div class="variants-list">${btns}</div></div>`;
            }
        }

        const thumbsHtml = currentDetailImages.length > 1 ? `
            <div class="thumbnails-scroll">
                ${currentDetailImages.map((src, i) => `
                    <img src="${src}" class="thumbnail-item ${i===0?'active':''}" onclick="swapDetailImage('${src}', this)">
                `).join('')}
            </div>` : '';

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
                    
                    <div class="detail-rating-summary" id="detail-rating-box">
                        <div class="review-stars-static">
                            <i class='bx bx-star' style="color:#ddd"></i><i class='bx bx-star' style="color:#ddd"></i><i class='bx bx-star' style="color:#ddd"></i><i class='bx bx-star' style="color:#ddd"></i><i class='bx bx-star' style="color:#ddd"></i>
                        </div>
                        <span style="font-size:0.9rem; color:#666; font-weight:600;">(0)</span>
                    </div>

                    ${priceBlock}
                    ${stockHtml}
                    ${variantsHtml}

                    <div class="action-buttons">
                        <button class="btn-buy-now" 
                             ${stockCount <= 0 ? 'disabled style="background:#ccc; cursor:not-allowed;"' : ''}
                             onclick="addToCartDirect('${doc.id}', '${prod.name}', ${finalPrice}, '${currentDetailImages[0]}'); window.location.href='carrinho.html'">
                             ${stockCount <= 0 ? 'Indisponível' : 'Comprar Agora'}
                        </button>
                        
                        <button class="btn-add-cart" 
                            ${stockCount <= 0 ? 'disabled style="border-color:#ccc!important; color:#999!important;"' : ''}
                            onclick="addToCartDirect('${doc.id}', '${prod.name}', ${finalPrice}, '${currentDetailImages[0]}')">
                            Adicionar ao carrinho
                        </button>
                    </div>

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
            
            <div style="background:#fff; padding:20px; margin-top:20px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                <h3 style="font-size:1.2rem; margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px;">Descrição</h3>
                <p style="color:#666; line-height:1.6; white-space: pre-line;">${prod.description || 'Sem descrição detalhada.'}</p>
            </div>
        `;

        fetchLiveRating(doc.id);
        checkUserReviewStatus(doc.id);
        loadReviews(doc.id);

    } catch (error) {
        console.error("Erro detalhes:", error);
        content.innerHTML = "<p>Erro ao carregar.</p>";
    }
}

// --- ZOOM ---
window.openZoom = function(src) {
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
            for(let i=1; i<=5; i++) {
                if (i <= Math.round(avg)) starsHtml += "<i class='bx bxs-star' style='color:#3483fa'></i>";
                else starsHtml += "<i class='bx bx-star' style='color:#ddd'></i>";
            }
            if(ratingBox) {
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
    for(let i=1; i<=5; i++) {
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

window.swapDetailImage = function(src, el) {
    document.getElementById('main-detail-img').src = src;
    document.querySelectorAll('.thumbnail-item').forEach(img => img.classList.remove('active'));
    el.classList.add('active');
}

window.selectVariant = function(el) {
    document.querySelectorAll('.variant-btn').forEach(btn => btn.classList.remove('selected'));
    el.classList.add('selected');
}

window.setRating = function(val) {
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

window.handleReviewImage = function(input) {
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

    img.onload = function() {
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

    img.onerror = function() {
        alert("Erro ao processar a imagem. Tente outra.");
        input.value = "";
    };
}

window.submitReview = async function(mode) {
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
    if(!listEl) return;
    
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
        if(html) listEl.innerHTML = html;
        else listEl.innerHTML = '<div class="empty-reviews"><p>Avaliações indisponíveis.</p></div>';
    }
}

function renderReviewItem(data, isPending) {
    let starsHtml = '';
    for(let i=1; i<=5; i++) {
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

// ==================== 5. INICIALIZAÇÃO ====================
document.addEventListener("DOMContentLoaded", () => {
    if(typeof initSlider === 'function') initSlider();
    if(typeof setupSearch === 'function') setupSearch();
    if(typeof updateCartBadge === 'function') updateCartBadge();
    if(typeof startSuggestionTimer === 'function') startSuggestionTimer();

    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (productId) {
        loadProductDetail(productId);
    } else {
        if (document.getElementById('firebase-products-container')) {
            initProductFeed();
        }
    }
});