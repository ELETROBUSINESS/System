// js/product.js

// APPSCRIPT_URL, CACHE_KEY etc are global from global.js

function getCachedData() {
    return DataManager.getProducts();
}

document.addEventListener('productsUpdated', (e) => {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    if (productId) loadProductDetail(productId);
});

function saveToCache(newProducts) {
    const currentCache = getCachedData() || [];
    const uniqueIds = new Set(currentCache.map(p => p.id));
    const merged = [...currentCache];
    newProducts.forEach(p => { if (!uniqueIds.has(p.id)) merged.push(p); });
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(merged));
    sessionStorage.setItem(CACHE_TIME_KEY, new Date().getTime().toString());
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

function calculateInstallmentsRule(price) {
    // Nova regra solicitada: máximo 3x de acordo com o valor
    if (price >= 300) return 3;
    if (price >= 150) return 2;
    return 1; // À vista no cartão
}

function registerInterest(category) {
    if (!category || category === 'todos' || category === 'ofertas') return;
    let interests = JSON.parse(localStorage.getItem('user_interests') || '[]');
    let lowerCat = category.toLowerCase().trim();
    if (!interests.includes(lowerCat)) {
        interests.unshift(lowerCat);
        if (interests.length > 4) interests.pop();
        localStorage.setItem('user_interests', JSON.stringify(interests));
    }
}

function registerRecentlyViewed(prod) {
    if (!prod) return;
    let viewed = JSON.parse(localStorage.getItem('user_recently_viewed') || '[]');
    viewed = viewed.filter(p => p.id !== prod.id);
    viewed.unshift({
        id: prod.id,
        name: prod.name,
        price: prod.price,
        'price-oferta': prod['price-oferta'],
        imgUrl: prod.imgUrl
    });
    if (viewed.length > 10) viewed.pop();
    localStorage.setItem('user_recently_viewed', JSON.stringify(viewed));
}

async function loadProductDetail(id) {
    const content = document.getElementById('detail-content');

    // Garantir que o skeleton seja visto por pelo menos 800ms para uma transição suave
    await new Promise(r => setTimeout(r, 800));

    try {
        let prod = null;
        let allProducts = getCachedData();

        if (allProducts) {
            prod = allProducts.find(p => String(p.id) === String(id));
        }

        if (!prod) {
            const response = await fetch(`${APPSCRIPT_URL}?action=listarProdutosSuperApp`);
            const result = await response.json();
            if (result.status === "success" && result.data) {
                saveToCache(result.data);
                allProducts = result.data;
                prod = result.data.find(p => String(p.id) === String(id));
            }
        }

        if (!prod) {
            content.innerHTML = "<h3>Produto não encontrado.</h3>";
            return;
        }

        window.globalAllProducts = allProducts;
        window.currentProductGroup = prod.variacoes && prod.variacoes.length > 0 ? prod.variacoes : [prod];

        registerInterest(prod.category);
        registerRecentlyViewed(prod);

        renderProductView(prod, window.currentProductGroup, allProducts, 0);

    } catch (error) {
        console.error("Erro detalhes:", error);
        content.innerHTML = "<p>Erro ao carregar produto.</p>";
    }
}

window.selectVariation = function (index) {
    if (!window.currentProductGroup || !window.currentProductGroup[index]) return;
    const prod = window.currentProductGroup[index];
    renderProductView(prod, window.currentProductGroup, window.globalAllProducts, index);
};

function renderProductView(prod, variacoesGroup, allProducts, activeIndex) {
    const content = document.getElementById('detail-content');

    registerInterest(prod.category);
    registerRecentlyViewed(prod);

    const productImages = extractProductImages(prod);
    const valPrice = parseFloat(prod.price || 0);
    const valOffer = parseFloat(prod['price-oferta'] || 0);
    const hasOffer = (valOffer > 0 && valOffer < valPrice);

    // Preço Base de Venda (Cartão)
    const cardPrice = hasOffer ? valOffer : valPrice;

    // Pix tem 5% de desconto sobre o preço de venda final
    const pixPrice = cardPrice * 0.95;

    const pageTitle = `${prod.name} | Dtudo`;
    document.title = pageTitle;

    // Rastreia a visualização do produto com metadados para Analytics
    if (typeof trackEvent === 'function') {
        trackEvent('view_item', {
            items: [{
                item_id: prod.id,
                item_name: prod.name,
                item_category: prod.category,
                price: cardPrice
            }]
        });
    }

    // Formatação refinada: Separa Reais de Centavos para Estilo Premium
    const splitPrice = (val) => {
        const parts = val.toFixed(2).split('.');
        return { reais: parts[0], centavos: parts[1] };
    };

    // Parcelamento
    const maxInstallments = calculateInstallmentsRule(cardPrice);
    const installmentValue = cardPrice / maxInstallments;

    const pixParts = splitPrice(pixPrice);
    const instParts = splitPrice(installmentValue);
    const discountPerc = Math.round(((valPrice - pixPrice) / valPrice) * 100);

    const fmtConfig = { style: 'currency', currency: 'BRL' };
    const fmtCard = cardPrice.toLocaleString('pt-BR', fmtConfig);
    const fmtOriginal = valPrice.toLocaleString('pt-BR', fmtConfig);
    // fmtPix e fmtInstallmentValue são usados para cálculos, mas a exibição será customizada abaixo

    const stockCount = parseInt(prod.stock || 0);
    const soldCount = parseInt(prod.sold || 0);

    let stockHtml = '';
    if (stockCount <= 0) {
        stockHtml = `<div class="stock-scarcity-container"><div class="stock-label"><strong style="color:#999">Esgotado</strong></div></div>`;
    } else if (stockCount <= 8) {
        stockHtml = `
                <div class="stock-scarcity-container">
                    <div class="stock-label"><span>Disponibilidade: ${stockCount} itens</span><strong style="color:#db0038">Restam poucas unidades!</strong></div>
                    <div class="stock-track"><div class="stock-fill" style="width:${(1 - stockCount / 8) * 100}%; background:#db0038"></div></div>
                </div>`;
    } else {
        stockHtml = `<div class="stock-scarcity-container"><div class="stock-label"><strong style="color:var(--color-text-dark); display:flex; align-items:center; gap:5px;"><i class='bx bxs-check-circle'></i> Disponível em estoque</strong></div></div>`;
    }

    let priceBlock = `
            <div class="premium-price-container" style="margin-bottom: 20px; font-family: 'Roboto', sans-serif;">
                <div class="price-old-line" style="color: #999; text-decoration: line-through; font-size: 1rem; margin-bottom: 4px;">
                    ${fmtOriginal}
                </div>
                <div class="price-main-line" style="display: flex; align-items: baseline; gap: 4px; color: #333;">
                    <span style="font-size: 2.2rem; font-weight: 400; line-height: 1;">R$ ${pixParts.reais}</span>
                    <span style="font-size: 1.1rem; font-weight: 400; position: relative; top: -12px;">${pixParts.centavos}</span>
                    <span style="color: #00a650; font-size: 1.15rem; font-weight: 600; margin-left: 10px; background: #e6f7ee; padding: 2px 6px; border-radius: 4px;">${discountPerc}% OFF</span>
                </div>
                <div class="installment-line" style="font-size: 1.15rem; color: #333; margin-top: 5px;">
                    ou até <b>${maxInstallments}x R$ ${instParts.reais}</b><span style="font-size: 0.75rem; position: relative; top: -5px;">,${instParts.centavos}</span> no cartão
                </div>
                <div style="color: #00a650; font-size: 0.85rem; font-weight: 600; margin-top: 5px;">
                    <i class='bx bxs-zap'></i> Preço exclusivo no Pix
                </div>
            </div>
        `;

    let installmentBlock = ''; // Substituído pela installment-line acima para seguir o design 1:1

    let variationsHtml = '';
    if (variacoesGroup && variacoesGroup.length > 1) {
        variationsHtml = `
            <div class="product-variations" style="margin: 15px 0;">
                <div style="font-size: 0.9rem; font-weight: 500; margin-bottom: 12px; color: #333;">Opções disponíveis:</div>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    ${variacoesGroup.map((v, i) => {
            const isActive = i === activeIndex;
            let fullName = String(v.name || ('Opção ' + (i + 1))).toUpperCase();
            let base = String(v.baseName || '').toUpperCase();

            let diffText = fullName;
            if (base && fullName.includes(base) && fullName !== base) {
                diffText = fullName.replace(base, '').trim();
            }

            // Fallback se faltar ou não houver diferença além de 1 letra etc
            if (!diffText) diffText = 'Opção ' + (i + 1);

            const vImg = v.imgUrl || 'https://placehold.co/100x100/f8f9fa/c20026?text=Opção';

            return `
                            <div onclick="selectVariation(${i})" style="
                                display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
                                width: 75px; cursor: pointer;
                                border: 2px solid ${isActive ? 'var(--color-brand-blue)' : '#eaeaea'}; 
                                border-radius: 10px; overflow: hidden;
                                background: ${isActive ? '#f2f7ff' : '#fff'}; 
                                transition: all 0.2s ease;
                                box-shadow: ${isActive ? '0 2px 6px rgba(0,102,255,0.15)' : 'none'};
                            ">
                                <img src="${vImg}" style="width: 100%; height: 75px; object-fit: cover; border-bottom: 1px solid #eaeaea;">
                                <span style="
                                    font-size: 0.70rem; font-weight: 600; text-align: center; 
                                    padding: 6px 4px; line-height: 1.1; 
                                    color: ${isActive ? 'var(--color-brand-blue)' : '#555'};
                                    word-wrap: break-word; width: 100%;
                                ">${diffText}</span>
                            </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;
    }

    const thumbsHtml = productImages.length > 1 ? `
            <div class="thumbnails-scroll">
                ${productImages.map((src, i) => `
                    <img src="${src}" class="thumbnail-item ${i === 0 ? 'active' : ''}" onclick="swapDetailImage('${src}', this)">
                `).join('')}
            </div>` : '';

    content.innerHTML = `
            <div class="detail-view-container">
                <div class="detail-gallery-container">
                    <div class="main-image-wrapper">
                        <img id="main-detail-img" src="${productImages[0]}" alt="${prod.name}" onclick="openZoom(this.src)">
                    </div>
                    ${thumbsHtml}
                </div>

                <div class="detail-info" style="padding: 0 5px;">
                    <div class="detail-status">Novo | ${soldCount} vendidos</div>
                    <h1 class="detail-title" style="margin-bottom: 8px;">${prod.name}</h1>
                    ${priceBlock}
                    ${installmentBlock}
                    ${stockHtml}
                    ${variationsHtml}
                    
                    <div class="action-buttons">
                        <button class="btn-buy-now" ${stockCount <= 0 ? 'disabled style="background:#ccc;"' : ''} onclick="addToCartAndGo('${prod.id}', '${prod.name.replace(/'/g, "\\'")}', ${cardPrice}, ${pixPrice}, '${productImages[0]}')">
                            ${stockCount <= 0 ? 'Indisponível' : 'Comprar Agora'}
                        </button>
                        <button class="btn-add-cart" ${stockCount <= 0 ? 'disabled style="border-color:#ccc; color:#999;"' : ''} onclick="addToCart('${prod.id}', '${prod.name.replace(/'/g, "\\'")}', ${cardPrice}, ${pixPrice}, '${productImages[0]}')">
                            Adicionar ao cesto
                        </button>
                    </div>

                    <div class="seller-info">
                        <i class='bx bx-store-alt'></i>
                        <div class="seller-text">
                            Vendido por: <strong>D'Tudo Variedades</strong><br>
                            <span>CD1 - Ipixuna do Pará</span>
                        </div>
                    </div>

                    <button class="btn-whatsapp-direct" style="background:#25D366; color:#fff; border:none; padding:12px; border-radius:8px; width:100%; margin-top:10px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:8px;" onclick="window.open('https://wa.me/5591986341760?text=Olá, quero o produto: ${encodeURIComponent(prod.name)}', '_blank')">
                        <i class='bx bxl-whatsapp'></i> Comprar pelo WhatsApp
                    </button>
                </div>
            </div>

            <div style="background:#fff; padding:20px; margin-top:20px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                <h3 style="font-size:1.2rem; margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px;">Descrição</h3>
                <p style="color:#666; line-height:1.6; white-space: pre-line;">${prod.description || 'Sem descrição detalhada.'}</p>
            </div>
        `;

    renderSuggestedProducts(prod, allProducts);
}

function renderSuggestedProducts(currentProd, allProducts) {
    const container = document.getElementById('suggested-products-container');
    if (!container || !allProducts) return;

    const category = (currentProd.category || '').toLowerCase();
    let suggested = allProducts.filter(p => {
        if (String(p.id) === String(currentProd.id)) return false;
        if (!p.imgUrl || p.imgUrl.trim() === "" || p.imgUrl.includes('placehold.co')) return false;
        return (p.category || '').toLowerCase() === category;
    });

    if (suggested.length < 4) {
        const others = allProducts.filter(p =>
            String(p.id) !== String(currentProd.id) &&
            p.imgUrl && !p.imgUrl.includes('placehold.co')
        );
        suggested = [...suggested, ...others.sort(() => 0.5 - Math.random())];
    }

    suggested = suggested.slice(0, 8);
    container.innerHTML = suggested.map(prod => {
        let displayImg = getFirstImageUrl(prod.imgUrl);
        const valPrice = parseFloat(prod.price || 0);
        const valOffer = parseFloat(prod['price-oferta'] || 0);
        const finalPrice = (valOffer > 0 && valOffer < valPrice) ? valOffer : valPrice;
        return `
            <div class="category-item" style="min-width: 140px; text-align: left; background: #fff; border: 1px solid #eee; border-radius: 8px; overflow: hidden; height: 100%; font-family: 'Roboto', sans-serif;" onclick="window.location.href='product.html?id=${prod.id}'">
                <img src="${displayImg}" style="width: 100%; height: 120px; object-fit: cover;">
                <div style="padding: 10px;">
                    <div style="font-size: 0.8rem; color: #444; height: 32px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${prod.name}</div>
                    <div style="font-size: 1rem; font-weight: 700; color: #c20026;">${finalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                </div>
            </div>
        `;
    }).join('');
}

window.swapDetailImage = function (src, el) {
    document.getElementById('main-detail-img').src = src;
    document.querySelectorAll('.thumbnail-item').forEach(img => img.classList.remove('active'));
    el.classList.add('active');
}

window.addToCart = function (id, name, priceOriginal, priceNew, img) {
    if (typeof CartManager !== 'undefined') {
        const product = { id, name, priceOriginal, priceNew, image: img };
        CartManager.add(product);
        if (typeof trackEvent === 'function') {
            trackEvent('add_to_cart', {
                items: [{ item_id: id, item_name: name, price: priceNew }]
            });
        }
    }
}

window.addToCartAndGo = function (id, name, priceOriginal, priceNew, img) {
    window.addToCart(id, name, priceOriginal, priceNew, img);
    if (typeof trackEvent === 'function') {
        trackEvent('begin_checkout_click', { item_id: id, item_name: name });
    }
    window.location.href = 'carrinho.html';
}

window.openZoom = function (src) {
    const zoomModal = document.createElement('div');
    zoomModal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:9999; display:flex; justify-content:center; align-items:center;";
    zoomModal.innerHTML = `<img src="${src}" style="max-width:95%; max-height:95%; object-fit:contain;">`;
    zoomModal.onclick = () => document.body.removeChild(zoomModal);
    document.body.appendChild(zoomModal);
}

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    if (productId) loadProductDetail(productId);
});
