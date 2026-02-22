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
}

async function refreshCartData() {
    const localCart = CartManager.get();
    if (localCart.length === 0) return;

    let serverProducts = [];
    try {
        const APPSCRIPT_URL = "https://script.google.com/macros/s/AKfycbzB7dluoiNyJ4XK6oDK_iyuKZfwPTAJa4ua4RetQsUX9cMObgE-k_tFGI82HxW_OyMf/exec";
        const response = await fetch(`${APPSCRIPT_URL}?action=listarProdutosSuperApp`);
        const result = await response.json();
        if (result.status === "success" && result.data) {
            serverProducts = result.data;
        }
    } catch (e) {
        console.error("Erro ao validar API no carrinho", e);
    }

    let hasUpdates = false;
    const verifiedCart = localCart.map(item => {
        const prod = serverProducts.find(p => String(p.id) === String(item.id));
        if (prod) {
            const valPrice = parseFloat(prod.price || 0);
            const valOffer = parseFloat(prod['price-oferta'] || 0);
            const baseSalePrice = (valOffer > 0 && valOffer < valPrice) ? valOffer : valPrice;

            const officialPricePix = baseSalePrice * 0.95;
            const officialPriceCard = baseSalePrice;

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
                <h3 class="empty-title">Seu carrinho está vazio</h3>
                <p class="empty-desc">Adicione produtos para começar suas compras com os melhores descontos do Pará!</p>
                <a href="index.html" class="btn-return">Explorar Produtos</a>
            </div>
        `;
    }
}

function renderCartPage() {
    const items = CartManager.get();
    const container = document.getElementById("cart-items-container");
    const fixedSummary = document.getElementById("fixed-summary");

    if (items.length === 0) {
        renderEmptyState();
        return;
    }

    if (fixedSummary) fixedSummary.style.display = 'block';
    const couponSection = document.getElementById("coupon-section");
    if (couponSection) couponSection.style.display = 'block';
    if (container) container.innerHTML = "";

    const fmtConfig = { style: 'currency', currency: 'BRL' };

    items.forEach(item => {
        const pricePix = parseFloat(item.priceNew || 0);
        const priceCard = parseFloat(item.priceOriginal || item.priceNew || 0);

        const fmtPix = pricePix.toLocaleString('pt-BR', fmtConfig);
        const fmtCard = priceCard.toLocaleString('pt-BR', fmtConfig);
        const hasDiscount = (priceCard - pricePix) > 0.05;

        const html = `
            <div class="cart-item-card" data-id="${item.id}">
                <img src="${item.image}" alt="${item.name}" class="cart-item-img" onclick="window.location.href='product.html?id=${item.id}'">
                <div class="cart-item-details">
                    <div onclick="window.location.href='product.html?id=${item.id}'">
                        <h4 class="cart-item-name">${item.name}</h4>
                        <div class="cart-item-price-row">
                            ${hasDiscount ? `<span class="price-old-cart">${fmtCard}</span>` : ''}
                            <span class="price-new-cart">${fmtPix}</span>
                            <span class="price-pix-badge">Pix</span>
                        </div>
                    </div>
                    <div class="cart-item-actions">
                        <div class="qty-selector">
                            <button class="qty-btn" onclick="updateQty('${item.id}', -1)">-</button>
                            <span class="qty-value">${item.quantity}</span>
                            <button class="qty-btn" onclick="updateQty('${item.id}', 1)">+</button>
                        </div>
                        <button class="remove-btn" onclick="removeItem('${item.id}')">
                            <i class='bx bx-trash'></i>
                        </button>
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
    let totalPix = 0;
    let totalCard = 0;

    items.forEach(item => {
        const qty = item.quantity || 1;
        totalPix += (parseFloat(item.priceNew) || 0) * qty;
        totalCard += (parseFloat(item.priceOriginal || item.priceNew) || 0) * qty;
    });

    // Lógica de Cupom
    const coupon = JSON.parse(sessionStorage.getItem('applied_coupon') || 'null');
    let discountValue = 0;

    if (coupon) {
        if (coupon.code === 'VALE5') {
            discountValue = 5.00;
        } else if (coupon.code === 'APROVEITA26' || coupon.code === 'DOMINGOU') {
            discountValue = totalPix * 0.12;
        }
    }

    const finalPix = Math.max(0, totalPix - discountValue);
    const finalCard = Math.max(0, totalCard - (coupon ? discountValue : 0)); // No cartão o desconto é o mesmo valor nominal? O usuário disse: "somado com desconto se o pagamento for no pix" para o APROVEITA26. Geralmente cupons de % aplicam sobre o valor base. 
    // "APROVEITA26 cupom de 12% de desconto (somado com desconto se o pagamento for no pix)"
    // Isso sugere que o desconto de 12% é sobre o valor que já tem desconto de Pix se for Pix.

    const savings = totalCard - finalPix;
    const fmt = { style: 'currency', currency: 'BRL' };

    const elPix = document.getElementById("summary-total-pix");
    const elCard = document.getElementById("summary-total-card");
    const elSavings = document.getElementById("savings-container");
    const elCouponRow = document.getElementById("coupon-summary-row");
    const elCouponVal = document.getElementById("summary-coupon-value");

    if (elPix) elPix.innerText = finalPix.toLocaleString('pt-BR', fmt);
    if (elCard) elCard.innerText = `ou ${finalCard.toLocaleString('pt-BR', fmt)} no cartão`;

    if (elCouponRow && elCouponVal) {
        if (coupon) {
            elCouponRow.style.display = 'flex';
            elCouponVal.innerText = `- ${discountValue.toLocaleString('pt-BR', fmt)}`;
        } else {
            elCouponRow.style.display = 'none';
        }
    }

    if (elSavings) {
        if (savings > 0.05) {
            elSavings.innerHTML = `<span class="savings-badge">Economia de ${savings.toLocaleString('pt-BR', fmt)}</span>`;
        } else {
            elSavings.innerHTML = '';
        }
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

    if (code === 'VALE5' || code === 'APROVEITA26' || code === 'DOMINGOU') {
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
            if (CartManager.get().length === 0) return;
            window.location.href = "payment.html";
        };
    }
}