// js/cart.js

document.addEventListener("DOMContentLoaded", () => {
    renderCartPage();
    setupCartEvents();
});

// Expondo função global para o HTML acessar (onclick)
window.updateQty = function(id, change) {
    let cart = CartManager.get();
    const itemIndex = cart.findIndex(i => i.id === id);
    
    if (itemIndex > -1) {
        // Atualiza quantidade
        cart[itemIndex].quantity += change;
        
        // Impede quantidade menor que 1
        if (cart[itemIndex].quantity < 1) {
            cart[itemIndex].quantity = 1;
        }
        
        // Salva e Renderiza
        localStorage.setItem('app_cart', JSON.stringify(cart));
        renderCartPage();
        
        // Atualiza badge global (se a função existir no global.js)
        if (typeof updateCartBadge === 'function') {
            updateCartBadge();
        }
    }
}

function renderCartPage() {
    const items = CartManager.get();
    const container = document.getElementById("cart-items-container");
    const summaryBox = document.getElementById("cart-summary-box");
    
    if (container) container.innerHTML = "";
    
    // Estado Vazio
    if (items.length === 0) {
        if (summaryBox) summaryBox.style.display = 'none';
        
        if (container) {
            container.innerHTML = `
                <div class="cart-empty" style="text-align: center; padding: 3rem;">
                    <i class='bx bx-cart-alt' style="font-size: 4rem; color: #ccc;"></i>
                    <h3 style="margin-top: 1rem;">Seu carrinho está vazio</h3>
                    <p style="color: #666;">Navegue pela loja para adicionar produtos.</p>
                    <a href="index.html" class="checkout-btn" style="display:inline-block; width:auto; padding: 10px 30px; margin-top:20px; text-decoration:none;">Ver Produtos</a>
                </div>`;
        }
        return;
    }

    // Renderiza Itens
    if (summaryBox) summaryBox.style.display = 'block';
    
    items.forEach(item => {
        // Formata preço
        const price = parseFloat(item.priceNew);
        const fmtPrice = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

        const itemHTML = `
            <div class="cart-item" data-id="${item.id}">
                <img src="${item.image}" alt="${item.name}" class="cart-item-image">
                
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <span class="cart-item-price">${fmtPrice}</span>
                    
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
}

function updateSummary() {
    const totalEl = document.getElementById("summary-total-value");
    if (totalEl) {
        const total = CartManager.total();
        totalEl.innerText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total);
    }
}

function setupCartEvents() {
    // Evento de Remover Item (Lixeira)
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

    // Botão Finalizar Compra
    const checkoutBtn = document.getElementById("go-to-checkout");
    if (checkoutBtn) {
        checkoutBtn.addEventListener("click", () => {
            if (CartManager.get().length === 0) return;
            
            // Verifica Login e Redireciona
            if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
                // Se tiver modal de login, abre ele, senão redireciona para página de login (se existir)
                // Assumindo que você usa o modal global:
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


// Configuração do Frete Grátis (R$ 29,99 conforme lógica anterior)
const FREE_SHIPPING_THRESHOLD = 29.99;

// --- 1. LÓGICA DA BARRA DE PROGRESSO ---
function updateShippingProgressBar() {
    const box = document.getElementById('shipping-progress-box');
    const fill = document.getElementById('shipping-progress-fill');
    const text = document.getElementById('shipping-progress-text');
    
    // Pega o total do CartManager (Global)
    const currentTotal = typeof CartManager !== 'undefined' ? CartManager.total() : 0;

    if (currentTotal === 0) {
        if(box) box.style.display = 'none';
        return;
    }

    if(box) box.style.display = 'block';

    const percentage = (currentTotal / FREE_SHIPPING_THRESHOLD) * 100;
    const limitedPercent = percentage > 100 ? 100 : percentage;

    if(fill) {
        fill.style.width = `${limitedPercent}%`;
        
        if (currentTotal >= FREE_SHIPPING_THRESHOLD) {
            fill.classList.remove('incomplete');
            fill.style.backgroundColor = '#00a650'; // Verde
            text.innerHTML = `<i class='bx bxs-check-circle' style='color:#00a650'></i> Parabéns! Você ganhou <strong>Frete Grátis</strong>`;
        } else {
            fill.classList.add('incomplete');
            const remaining = FREE_SHIPPING_THRESHOLD - currentTotal;
            const remainingFmt = remaining.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            text.innerHTML = `Faltam <strong>${remainingFmt}</strong> para Frete Grátis`;
        }
    }
}

// Chame isso ao carregar a página
document.addEventListener("DOMContentLoaded", () => {
    updateShippingProgressBar();
});

// Sobrescreva ou integre com o renderCart existente para atualizar a barra
// Exemplo: Se você tem uma função renderCart(), adicione updateShippingProgressBar() no final dela.


// --- 2. LÓGICA DO CEP NO CARRINHO ---
function calculateCartShipping() {
    const cepInput = document.getElementById('cart-cep-input');
    const resultDiv = document.getElementById('cart-shipping-result');
    
    if (!cepInput || !resultDiv) return;

    const cepVal = cepInput.value.replace(/\D/g, '');

    if (cepVal.length !== 8) {
        showToast('CEP inválido.', 'error');
        return;
    }

    // Limpa e mostra loading simples
    resultDiv.style.display = 'flex';
    resultDiv.innerHTML = '<span style="color:#666; font-size:0.9rem;"><i class="bx bx-loader-alt bx-spin"></i> Consultando...</span>';

    setTimeout(() => {
        resultDiv.innerHTML = '';
        const cartTotal = typeof CartManager !== 'undefined' ? CartManager.total() : 0;
        const hasFreeShipping = cartTotal >= FREE_SHIPPING_THRESHOLD;

        // LÓGICA DO CEP ESPECÍFICO
        if (cepVal === '68637000') {
            // Entrega Disponível (Ipixuna)
            let priceHtml = '';
            
            if (hasFreeShipping) {
                priceHtml = `<span style="color:#00a650; font-weight:700;">Grátis</span>`;
            } else {
                priceHtml = `<span>R$ 7,99</span>`;
            }

            resultDiv.innerHTML = `
                <div class="shipping-option">
                    <i class='bx bxs-truck' style="color:#333; font-size:1.4rem;"></i>
                    <div class="shipping-info">
                        <span class="shipping-title-opt" style="color:#333; font-weight:600;">Entrega Expressa</span>
                        <span class="shipping-subtitle-opt">Receba hoje ou amanhã</span>
                    </div>
                    <div style="margin-left:auto;">${priceHtml}</div>
                </div>
                <div class="shipping-option" style="margin-top:10px;">
                    <i class='bx bxs-store' style="color:#333; font-size:1.4rem;"></i>
                    <div class="shipping-info">
                        <span class="shipping-title-opt" style="color:#333; font-weight:600;">Retirar na Loja</span>
                        <span class="shipping-subtitle-opt">Disponível em 1 hora</span>
                    </div>
                    <div style="margin-left:auto; color:#00a650; font-weight:700;">Grátis</div>
                </div>
            `;
        } else {
            // Outro CEP -> Apenas Retirada
            resultDiv.innerHTML = `
                <div class="pickup-only-msg">
                    <i class='bx bx-error-circle'></i> 
                    Não realizamos entregas para este CEP no momento.
                </div>
                
                <p style="font-size:0.9rem; font-weight:600; margin-bottom:5px; color:#333;">Opção disponível:</p>
                
                <div class="store-suggestion">
                    <i class='bx bxs-map' style="font-size:1.5rem; color:#db0038;"></i>
                    <div>
                        <strong style="display:block; font-size:0.9rem;">D'Tudo Aurora</strong>
                        <span style="font-size:0.8rem; color:#666;">Rodovia Principal, Centro - Aurora do Pará</span>
                    </div>
                    <span style="margin-left:auto; color:#00a650; font-weight:700; font-size:0.85rem;">Grátis</span>
                </div>
            `;
        }
    }, 600);
}