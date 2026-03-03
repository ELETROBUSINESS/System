// js/cart.js

const STORE_OWNER_UID = "3zYT9Y6hXWeJSuvmEYP4FMZa5gI2";
const APP_ID = 'floralchic-loja';

document.addEventListener("DOMContentLoaded", () => {
    initCartPage();
});

async function initCartPage() {
    renderCartPage();
    await refreshCartData(); // Valida preços na API
    setupCartEvents();
    if (typeof updateCartBadge === 'function') updateCartBadge();

    const pageTitle = "Meu Cesto | Dtudo";
    document.title = pageTitle;
    if (typeof gtag === 'function') {
        gtag('event', 'page_view', {
            page_title: pageTitle,
            page_location: window.location.href,
            page_path: window.location.pathname + window.location.search
        });
    }
}

async function refreshCartData() {
    const localCart = CartManager.get();
    if (localCart.length === 0) return;

    let serverProducts = DataManager.getProducts();
    if (!serverProducts || serverProducts.length === 0) {
        try {
            const response = await fetch(`${APPSCRIPT_URL}?action=listarProdutosSuperApp`);
            const result = await response.json();
            if (result.status === "success" && result.data) {
                serverProducts = result.data;
                localStorage.setItem('dtudo_products_cache', JSON.stringify(result.data));
            }
        } catch (e) {
            console.error("Erro ao validar API no carrinho", e);
        }
    }

    let hasUpdates = false;
    const verifiedCart = localCart.map(item => {
        const prod = serverProducts.find(p => String(p.id) === String(item.id));
        if (prod) {
            const valPrice = parseFloat(prod.price || 0);
            const valOffer = parseFloat(prod['price-oferta'] || 0);
            const hasOffer = (valOffer > 0 && valOffer < valPrice);

            let officialPricePix, officialPriceCard;
            if (hasOffer) {
                officialPricePix = valOffer; // Oferta é o preço final do PIX
                officialPriceCard = valPrice; // Cartão mantém preço original
            } else {
                officialPriceCard = valPrice;
                officialPricePix = valPrice * 0.95; // 5% de desconto PIX para produtos fora de oferta
            }

            if (Math.abs(item.priceNew - officialPricePix) > 0.05 || Math.abs(item.priceOriginal - officialPriceCard) > 0.05) {
                item.priceNew = officialPricePix;
                item.priceOriginal = officialPriceCard;
                hasUpdates = true;
            }
        }
        return item;
    });

    if (hasUpdates) {
        localStorage.setItem('app_cart', JSON.stringify(verifiedCart));
        renderCartPage();
    }
}

function renderEmptyState() {
    const container = document.getElementById("cart-items-container");
    const fixedSummary = document.getElementById("fixed-summary");

    if (fixedSummary) fixedSummary.style.display = 'none';
    const couponSection = document.getElementById("coupon-section");
    if (couponSection) couponSection.style.display = 'none';

    if (container) {
        container.innerHTML = `
            <div class="empty-cart-view">
                <i class='bx bx-cart-alt empty-icon'></i>
                <h3 class="empty-title">Seu cesto está vazio</h3>
                <p class="empty-desc">Adicione produtos para começar suas compras com os melhores descontos do Pará!</p>
                <a href="index.html" class="btn-return">Explorar Produtos</a>
            </div>
        `;
    }
}

function renderCartPage() {
    const items = CartManager.get();
    const container = document.getElementById("cart-items-container");
    const storeWrapper = document.getElementById("cart-store-wrapper");
    const fixedSummary = document.getElementById("fixed-summary");


    if (items.length === 0) {
        if (storeWrapper) storeWrapper.style.display = 'none';
        renderEmptyState();
        return;
    }

    if (storeWrapper) storeWrapper.style.display = 'block';
    if (fixedSummary) fixedSummary.style.display = 'block';
    if (container) container.innerHTML = "";


    items.forEach(item => {
        const priceOffer = parseFloat(item.priceNew || 0); // Preço com desconto/oferta
        const priceOriginal = parseFloat(item.priceOriginal || item.priceNew || 0); // Preço de tabela
        const hasOffer = (priceOriginal - priceOffer) > 0.05;

        const html = `
            <div class="cart-item-card" data-id="${item.id}">
                <button class="remove-btn" onclick="removeItem('${item.id}')"><i class='bx bx-trash'></i></button>
                <img src="${item.image}" alt="${item.name}" class="cart-item-img" onclick="window.location.href='product.html?id=${item.id}'">
                <div class="cart-item-details">
                    <div onclick="window.location.href='product.html?id=${item.id}'">
                        <h4 class="cart-item-name">${item.name}</h4>
                    </div>
                    
                    <div class="cart-item-actions" style="margin-top: 5px;">
                        <span style="font-size: 0.75rem; color: #888; margin-bottom: 4px; display: block;">Quantidade</span>
                        <div class="qty-selector">
                            <button class="qty-btn" onclick="updateQty('${item.id}', -1)">-</button>
                            <span class="qty-value">${item.quantity}</span>
                            <button class="qty-btn" onclick="updateQty('${item.id}', 1)">+</button>
                        </div>
                    </div>

                    <div class="cart-item-price-row" style="margin-top: auto; text-align: left;">
                        ${hasOffer ? `<span class="price-old-cart">${formatCurrency(priceOriginal)}</span>` : ''}
                        <div style="display: flex; align-items: baseline; gap: 5px;">
                            <span class="price-new-cart">${formatCurrency(priceOffer)}</span>
                            <span style="font-size: 0.75rem; color: #00a650; font-weight: 600;">no Pix</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        if (container) container.insertAdjacentHTML('beforeend', html);
    });



    updateSummary();
}

window.updateQty = function (id, change) {
    let cart = CartManager.get();
    const idx = cart.findIndex(i => i.id === id);
    if (idx > -1) {
        cart[idx].quantity += change;
        if (cart[idx].quantity < 1) cart[idx].quantity = 1;
        localStorage.setItem('app_cart', JSON.stringify(cart));
        renderCartPage();
        if (typeof updateCartBadge === 'function') updateCartBadge();
    }
}

window.removeItem = function (id) {
    CartManager.remove(id);
    renderCartPage();
    if (typeof updateCartBadge === 'function') updateCartBadge();
}

function updateSummary() {
    const items = CartManager.get();
    let subtotal = 0; // Soma dos preços originais
    let savingsBase = 0; // Diferença entre original e oferta do item

    items.forEach(item => {
        const qty = item.quantity || 1;
        const pOrig = parseFloat(item.priceOriginal || item.priceNew || 0);
        const pOffer = parseFloat(item.priceNew || 0);

        subtotal += pOrig * qty;
        savingsBase += (pOrig - pOffer) * qty;
    });

    const totalBeforeCoupon = subtotal - savingsBase;

    // Lógica de Cupom
    const coupon = JSON.parse(sessionStorage.getItem('applied_coupon') || 'null');
    let couponDiscountValue = 0;
    const serverProducts = typeof DataManager !== 'undefined' ? (DataManager.getProducts() || []) : [];

    if (coupon) {
        if (coupon.code === 'VALE5') {
            couponDiscountValue = 5.00;
        } else if (coupon.code === 'APROVEITA26') {
            couponDiscountValue = totalBeforeCoupon * 0.12;
        } else if (coupon.code === 'LAYLA10') {
            let laylaTotal = 0;
            items.forEach(item => {
                const prod = serverProducts.find(p => String(p.id) === String(item.id));
                const cat = prod && prod.category ? prod.category.toUpperCase() : '';
                if (cat.includes('MAQUIAGEM') || cat.includes('COSMÉTICO') || cat.includes('COSMETICO')) {
                    laylaTotal += (parseFloat(item.priceNew) || 0) * (item.quantity || 1);
                }
            });
            couponDiscountValue = laylaTotal * 0.10;
        }
    }

    const finalPix = Math.max(0, totalBeforeCoupon - couponDiscountValue);
    const totalDiscounts = savingsBase + couponDiscountValue;
    const fmt = { style: 'currency', currency: 'BRL' };

    // Elementos DOM
    const elSubtotal = document.getElementById("summary-subtotal");
    const elPix = document.getElementById("summary-total-pix");
    const elCouponRow = document.getElementById("coupon-summary-row");
    const elCouponVal = document.getElementById("summary-coupon-value");

    if (elSubtotal) elSubtotal.innerText = formatCurrency(subtotal);
    if (elPix) elPix.innerText = formatCurrency(finalPix);

    if (totalDiscounts > 0.05) {
        if (elCouponRow) elCouponRow.style.display = 'flex';
        if (elCouponVal) elCouponVal.innerText = `- ${totalDiscounts.toLocaleString('pt-BR', fmt)}`;
    } else {
        if (elCouponRow) elCouponRow.style.display = 'none';
    }


    renderCouponUI(coupon);
}



function renderCouponUI(coupon) {
    const row = document.getElementById('applied-coupon-row');
    const btn = document.getElementById('open-coupon-modal');
    const text = document.getElementById('applied-coupon-text');

    if (coupon) {
        if (row) row.style.display = 'flex';
        if (btn) btn.style.display = 'none';
        if (text) text.innerText = `Cupom ${coupon.code} aplicado`;
    } else {
        if (row) row.style.display = 'none';
        if (btn) btn.style.display = 'flex';
    }
}

window.openCouponModal = function () {
    const modal = document.getElementById('coupon-modal');
    if (modal) modal.classList.add('show');
}

window.closeCouponModal = function () {
    const modal = document.getElementById('coupon-modal');
    if (modal) {
        modal.classList.remove('show');
        document.getElementById('coupon-error').style.display = 'none';
        document.getElementById('coupon-code-input').value = '';
    }
}

window.applyCoupon = function () {
    const input = document.getElementById('coupon-code-input');
    const code = input.value.trim().toUpperCase();
    const error = document.getElementById('coupon-error');

    if (code === 'VALE5' || code === 'APROVEITA26' || code === 'LAYLA10') {
        sessionStorage.setItem('applied_coupon', JSON.stringify({ code: code }));
        updateSummary();
        closeCouponModal();
    } else {
        if (error) error.style.display = 'block';
    }
}

window.removeCoupon = function () {
    sessionStorage.removeItem('applied_coupon');
    updateSummary();
}

function setupCartEvents() {
    // Definimos diretamente no escopo global ou garantimos uma única atribuição
    const checkoutBtn = document.getElementById("go-to-checkout");
    if (checkoutBtn) {
        // Removemos qualquer atribuição anterior para garantir que não haja duplicidade ou lógicas conflitantes
        checkoutBtn.onclick = null;
        checkoutBtn.onclick = (e) => {
            e.preventDefault();
            const cartItems = CartManager.get();
            if (cartItems.length === 0) return;

            if (typeof trackEvent === 'function') {
                trackEvent('begin_checkout', {
                    value: CartManager.total(),
                    currency: 'BRL',
                    items_count: cartItems.length
                });
            }
            // Vamos direto para o checkout (login não é mais obrigatório aqui)
            window.location.href = "payment.html";
        };
    }
}