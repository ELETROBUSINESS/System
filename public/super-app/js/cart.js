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