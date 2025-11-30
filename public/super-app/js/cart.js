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
    if(totalEl) totalEl.style.opacity = "0.5";

    const verifiedCart = [];
    let hasUpdates = false;

    for (const item of localCart) {
        try {
            const docRef = db.collection('artifacts').doc(APP_ID)
                .collection('users').doc(STORE_OWNER_UID)
                .collection('products').doc(item.id);

            const docSnap = await docRef.get();

            if (docSnap.exists) {
                const prod = docSnap.data();
                const dbPriceOriginal = parseFloat(prod.price || 0); 
                const dbPriceOffer = parseFloat(prod['price-oferta'] || 0); 
                
                const hasOffer = (dbPriceOffer > 0 && dbPriceOffer < dbPriceOriginal);
                
                item.priceOriginal = dbPriceOriginal; 
                item.priceNew = hasOffer ? dbPriceOffer : dbPriceOriginal; 
                
                hasUpdates = true;
            }
            verifiedCart.push(item);
        } catch (e) {
            console.error("Erro update:", item.name, e);
            verifiedCart.push(item);
        }
    }

    if (hasUpdates) {
        localStorage.setItem('app_cart', JSON.stringify(verifiedCart));
        renderCartPage();
    }
}

window.updateQty = function(id, change) {
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
        if(progressBox) progressBox.style.display = 'none';

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
        // Preço Vigente (Pix/Oferta) vs Preço Cheio
        const priceVigente = parseFloat(item.priceNew || 0);
        const priceCheio = parseFloat(item.priceOriginal || item.priceNew || 0);
        const hasDiscount = (priceCheio - priceVigente) > 0.05;

        const fmtVigente = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(priceVigente);
        const fmtCheio = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(priceCheio);

        let priceHtml = '';

        if (hasDiscount) {
            priceHtml = `
                <div style="display:flex; flex-direction:column; align-items:flex-start; margin: 5px 0;">
                    <span style="font-size: 0.8rem; color: #999; text-decoration: line-through; margin-bottom: -2px;">${fmtCheio}</span>
                    <span class="cart-item-price" style="color: #00a650; font-weight:700; font-size:1rem;">
                        ${fmtVigente} <small style="color:#333; font-weight:400; font-size:0.75rem;">no Pix</small>
                    </span>
                </div>
            `;
        } else {
            priceHtml = `<span class="cart-item-price" style="display:block; margin: 5px 0;">${fmtVigente}</span>`;
        }

        const itemHTML = `
            <div class="cart-item" data-id="${item.id}">
                <img src="${item.image}" alt="${item.name}" class="cart-item-image">
                <div class="cart-item-info">
                    <h4 style="margin:0; font-size:0.95rem;">${item.name}</h4>
                    ${priceHtml}
                    <div class="quantity-control">
                        <button class="qty-btn" onclick="updateQty('${item.id}', -1)">-</button>
                        <span class="qty-val">${item.quantity}</span>
                        <button class="qty-btn" onclick="updateQty('${item.id}', 1)">+</button>
                    </div>
                </div>
                <button class="cart-item-remove" aria-label="Remover item">
                    <i class='bx bx-trash'></i>
                </button>
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

    // Atualiza Total Principal (Valor REAL/Cheio)
    const totalEl = document.getElementById("summary-total-value");
    if (totalEl) {
        totalEl.style.opacity = "1";
        totalEl.innerText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalReal);
    }

    // Atualiza Texto de Economia Simples
    const savingsContainer = document.getElementById("summary-savings-text");
    if (savingsContainer) {
        if (savings > 0.05) {
            const savingsFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(savings);
            savingsContainer.innerHTML = `<span class="pix-economy-text">Economize ${savingsFmt} no Pix</span>`;
        } else {
            savingsContainer.innerHTML = "";
        }
    }
}

function updateShippingProgressBar() {
    const box = document.getElementById('shipping-progress-box');
    const fill = document.getElementById('shipping-progress-fill');
    const text = document.getElementById('shipping-progress-text');
    
    // Calcula baseado no valor Pix (regra de negócio comum) ou Real, dependendo da sua estratégia.
    // Usaremos CartManager.total() que geralmente pega o priceNew (Pix)
    const currentTotal = typeof CartManager !== 'undefined' ? CartManager.total() : 0;

    if (currentTotal === 0) {
        if(box) box.style.display = 'none';
        return;
    }

    if(box) box.style.display = 'block';

    // Lógica da Animação
    const isFreeShipping = currentTotal >= FREE_SHIPPING_THRESHOLD;
    const percentage = (currentTotal / FREE_SHIPPING_THRESHOLD) * 100;
    const limitedPercent = percentage > 100 ? 100 : percentage;

    if(fill) {
        fill.style.width = `${limitedPercent}%`;
        
        if (isFreeShipping) {
            // Se já não tiver a classe de celebração, adiciona para animar
            if (!box.classList.contains('celebrate')) {
                box.classList.add('celebrate');
                // Remove a animação depois que ela rodar para poder rodar de novo se o valor mudar
                setTimeout(() => box.classList.remove('celebrate'), 1000);
            }

            fill.classList.remove('incomplete');
            fill.style.backgroundColor = '#00a650'; 
            text.innerHTML = `<i class='bx bxs-check-circle' style='color:#00a650'></i> Parabéns! Você ganhou <strong>Frete Grátis</strong>`;
        } else {
            box.classList.remove('celebrate');
            fill.classList.add('incomplete');
            const remaining = FREE_SHIPPING_THRESHOLD - currentTotal;
            const remainingFmt = remaining.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            text.innerHTML = `Faltam <strong>${remainingFmt}</strong> para Frete Grátis`;
        }
    }
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
            
            if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
                const modal = document.getElementById("user-profile-modal");
                if(modal) {
                    modal.classList.add('show');
                    showToast("Faça login para continuar", "error");
                }
            } else {
                window.location.href = "payment.html";
            }
        });
    }
}