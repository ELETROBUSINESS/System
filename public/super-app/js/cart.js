// js/cart.js

const STORE_OWNER_UID = "3zYT9Y6hXWeJSuvmEYP4FMZa5gI2";
const APP_ID = 'floralchic-loja';
const FREE_SHIPPING_THRESHOLD = 29.99;

document.addEventListener("DOMContentLoaded", () => {
    renderCartPage();
    refreshCartData();
    setupCartEvents();
});

// --- FUNÇÃO DE BUSCA NO BANCO ---
async function refreshCartData() {
    const localCart = CartManager.get();
    if (localCart.length === 0) return;

    // Loading discreto
    const totalEl = document.getElementById("summary-total-value");
    if (totalEl) totalEl.style.opacity = "0.5";

    const verifiedCart = [];
    let hasUpdates = false;

    // Buscamos todos os produtos de uma vez via API para ser mais rápido (opcional, mantendo compatibilidade)
    let serverProducts = [];
    try {
        const APPSCRIPT_URL = "https://script.google.com/macros/s/AKfycbzB7dluoiNyJ4XK6oDK_iyuKZfwPTAJa4ua4RetQsUX9cMObgE-k_tFGI82HxW_OyMf/exec";
        const response = await fetch(`${APPSCRIPT_URL}?action=listarProdutosSuperApp`);
        const result = await response.json();
        if (result.status === "success" && result.data) {
            serverProducts = result.data;
        }
    } catch (e) {
        console.error("Erro ao buscar API para validação no carrinho", e);
    }

    for (const item of localCart) {
        try {
            const prod = serverProducts.find(p => String(p.id) === String(item.id));

            if (prod) {
                const valPrice = parseFloat(prod.price || 0); // Preço Cheio (Cartão)
                const valOffer = parseFloat(prod['price-oferta'] || 0); // Preço Oferta (Opcional)

                const hasOffer = (valOffer > 0 && valOffer < valPrice);

                // Regra Super App: Preço Pix tem 5% de desconto sobre o preço final de venda
                const finalSalePrice = hasOffer ? valOffer : valPrice;
                const officialPricePix = finalSalePrice * 0.95;
                const officialPriceCard = finalSalePrice;

                if (Math.abs(item.priceNew - officialPricePix) > 0.05 || Math.abs(item.priceOriginal - officialPriceCard) > 0.05) {
                    item.priceNew = officialPricePix;
                    item.priceOriginal = officialPriceCard;
                    hasUpdates = true;
                }
            } else {
                // Se não achou na API nova, tenta no Firestore (Legado/Garanti)
                const docRef = db.collection('artifacts').doc(APP_ID)
                    .collection('users').doc(STORE_OWNER_UID)
                    .collection('products').doc(item.id);

                const docSnap = await docRef.get();
                if (docSnap.exists) {
                    const prodFs = docSnap.data();
                    const dbPriceOriginal = parseFloat(prodFs.price || 0);
                    const dbPriceOffer = parseFloat(prodFs['price-oferta'] || 0);
                    const hasOffer = (dbPriceOffer > 0 && dbPriceOffer < dbPriceOriginal);

                    const finalSalePrice = hasOffer ? dbPriceOffer : dbPriceOriginal;
                    const officialPricePix = finalSalePrice * 0.95;
                    const officialPriceCard = finalSalePrice;

                    item.priceOriginal = officialPriceCard;
                    item.priceNew = officialPricePix;
                    hasUpdates = true;
                }
            }
            verifiedCart.push(item);
        } catch (e) {
            console.error("Erro update item no carrinho:", item.name, e);
            verifiedCart.push(item);
        }
    }

    if (hasUpdates) {
        localStorage.setItem('app_cart', JSON.stringify(verifiedCart));
        renderCartPage();
    } else if (totalEl) {
        totalEl.style.opacity = "1";
    }
}

window.updateQty = function (id, change) {
    let cart = CartManager.get();
    const itemIndex = cart.findIndex(i => i.id === id);

    if (itemIndex > -1) {
        cart[itemIndex].quantity += change;
        if (cart[itemIndex].quantity < 1) cart[itemIndex].quantity = 1;

        localStorage.setItem('app_cart', JSON.stringify(cart));
        renderCartPage();
        if (typeof updateCartBadge === 'function') updateCartBadge();
    }
}

function renderCartPage() {
    const items = CartManager.get();
    const container = document.getElementById("cart-items-container");
    const summaryBox = document.getElementById("cart-summary-box");

    if (container) container.innerHTML = "";

    if (items.length === 0) {
        if (summaryBox) summaryBox.style.display = 'none';
        const progressBox = document.getElementById('shipping-progress-box');
        if (progressBox) progressBox.style.display = 'none';

        if (container) {
            container.innerHTML = `
                <div class="cart-empty" style="text-align: center; padding: 3rem;">
                    <i class='bx bx-cart-alt' style="font-size: 4rem; color: #ccc;"></i>
                    <h3 style="margin-top: 1rem;">Seu carrinho está vazio</h3>
                    <p style="color: #666;">Navegue pela loja para adicionar produtos.</p>
                    <a href="index.html" class="checkout-btn" style="display:inline-block; width:auto; padding: 10px 30px; margin-top:20px; text-decoration:none; background-color:#333; color:#fff; border-radius:6px;">Ver Produtos</a>
                </div>`;
        }
        return;
    }

    if (summaryBox) summaryBox.style.display = 'block';

    items.forEach(item => {
        // Preço Vigente (Pix com 5%) vs Preço Cheio (Cartão)
        const priceVigente = parseFloat(item.priceNew || 0);
        const priceCheio = parseFloat(item.priceOriginal || item.priceNew || 0);
        const hasDiscount = (priceCheio - priceVigente) > 0.05;

        const fmtVigente = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(priceVigente);
        const fmtCheio = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(priceCheio);

        let priceHtml = '';

        if (hasDiscount) {
            priceHtml = `
                <div style="display:flex; flex-direction:column; align-items:flex-start; margin: 2px 0;">
                    <span style="font-size: 0.75rem; color: #999; text-decoration: line-through; margin-bottom: -4px;">${fmtCheio}</span>
                    <span class="cart-item-price" style="color: #00a650; font-weight:800; font-size:1.1rem;">
                        ${fmtVigente} <small style="color:#666; font-weight:500; font-size:0.75rem;">no Pix</small>
                    </span>
                </div>
            `;
        } else {
            priceHtml = `<span class="cart-item-price" style="display:block; margin: 4px 0; font-weight: 800; font-size: 1.1rem; color: #333;">${fmtVigente}</span>`;
        }

        const itemHTML = `
            <div class="cart-item" data-id="${item.id}">
                <img src="${item.image}" alt="${item.name}" class="cart-item-image">
                <div class="cart-item-info">
                    <h4 style="margin:0; font-size:0.95rem; font-weight: 500; color: #444; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-transform: capitalize;">${item.name}</h4>
                    ${priceHtml}
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 5px;">
                        <div class="quantity-control" style="margin-top: 0; background: #fff; border: 1px solid #eee; border-radius: 8px; padding: 2px;">
                            <button class="qty-btn" style="border: none; background: #f9f9f9; width: 32px; height: 32px; border-radius: 6px; font-size: 1.1rem;" onclick="updateQty('${item.id}', -1)">-</button>
                            <span class="qty-val" style="min-width: 30px;">${item.quantity}</span>
                            <button class="qty-btn" style="border: none; background: #f9f9f9; width: 32px; height: 32px; border-radius: 6px; font-size: 1.1rem;" onclick="updateQty('${item.id}', 1)">+</button>
                        </div>
                        <button class="cart-item-remove" aria-label="Remover item" style="background: rgba(219, 0, 56, 0.05); color: #db0038; width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                            <i class='bx bx-trash' style="font-size: 1.3rem;"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += itemHTML;
    });

    updateSummary();
    updateShippingProgressBar();
}

function updateSummary() {
    const items = CartManager.get();
    let totalPix = 0;
    let totalReal = 0; // Total "Cheio" (Cartão)

    items.forEach(item => {
        const qty = item.quantity || 1;
        const pPix = parseFloat(item.priceNew || 0);

        let pCheio = parseFloat(item.priceOriginal || 0);
        // Fallback: Se não tem original, assume que o original é igual ao Pix
        if (pCheio === 0 || pCheio < pPix) pCheio = pPix;

        totalPix += pPix * qty;
        totalReal += pCheio * qty;
    });

    const savings = totalReal - totalPix;

    // Atualiza Total Principal
    const totalEl = document.getElementById("summary-total-value");
    const savingsContainer = document.getElementById("summary-savings-text");

    if (totalEl) {
        totalEl.style.opacity = "1";

        if (savings > 0.05) {
            // Se houver economia, mostra o valor Pix como principal
            const fmtPix = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPix);
            const fmtReal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalReal);

            totalEl.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: flex-end;">
                    <span style="font-size: 0.85rem; color: #999; text-decoration: line-through; margin-bottom: 2px;">${fmtReal}</span>
                    <span style="color: #00a650; font-weight: 800; font-size: 1.4rem;">${fmtPix}</span>
                    <small style="font-size: 0.75rem; color: #666; font-weight: 500; margin-top: -2px;">no Pix</small>
                </div>
            `;

            if (savingsContainer) {
                const savingsFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(savings);
                savingsContainer.innerHTML = `<span class="pix-economy-text" style="color: #00a650; background: #e8f5e9; padding: 4px 8px; border-radius: 4px; border: 1px solid #c8e6c9;">Você economiza ${savingsFmt}</span>`;
            }
        } else {
            // Sem economia, mostra normal
            totalEl.innerText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalReal);
            if (savingsContainer) savingsContainer.innerHTML = "";
        }
    }
}

function updateShippingProgressBar() {
    const box = document.getElementById('shipping-progress-box');
    if (box) box.style.display = 'none';
}

function setupCartEvents() {
    const container = document.getElementById("cart-items-container");
    if (container) {
        container.addEventListener("click", (e) => {
            const btn = e.target.closest(".cart-item-remove");
            if (btn) {
                const itemId = btn.closest(".cart-item").dataset.id;
                CartManager.remove(itemId);
                renderCartPage();
            }
        });
    }

    const checkoutBtn = document.getElementById("go-to-checkout");
    if (checkoutBtn) {
        checkoutBtn.addEventListener("click", () => {
            if (CartManager.get().length === 0) return;
            window.location.href = "payment.html";
        });
    }
}