// js/cart.js

document.addEventListener("DOMContentLoaded", () => {
    renderCartPage();
    setupCartEvents();
});

function renderCartPage() {
    const items = CartManager.get();
    const container = document.getElementById("cart-items-container");
    const summaryBox = document.getElementById("cart-summary-box");
    
    // Limpa container
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
                </div>`;
        }
        return;
    }

    // Renderiza Itens
    if (summaryBox) summaryBox.style.display = 'block';
    
    items.forEach(item => {
        const itemHTML = `
            <div class="cart-item" data-id="${item.id}">
                <img src="${item.image}" alt="${item.name}" class="cart-item-image">
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <span class="cart-item-price">R$ ${item.priceNew.toFixed(2).replace('.', ',')}</span>
                    <p style="font-size:0.8rem; color:#666; margin-top: 4px;">Quantidade: ${item.quantity}</p>
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
        totalEl.innerText = `R$ ${CartManager.total().toFixed(2).replace('.', ',')}`;
    }
}

function setupCartEvents() {
    // Evento de Remover Item (Delegação)
    const container = document.getElementById("cart-items-container");
    if (container) {
        container.addEventListener("click", (e) => {
            const btn = e.target.closest(".cart-item-remove");
            if (btn) {
                const itemId = btn.closest(".cart-item").dataset.id;
                CartManager.remove(itemId);
                renderCartPage(); // Re-renderiza a tela
            }
        });
    }

    // Evento de "Finalizar Compra" - LÓGICA ATUALIZADA AQUI
    const checkoutBtn = document.getElementById("go-to-checkout");
    if (checkoutBtn) {
        checkoutBtn.addEventListener("click", () => {
            if (CartManager.get().length === 0) return;
            
            // Verifica Auth Global
            // Se não estiver logado ou for anônimo, redireciona para a página de Login
            if (!auth.currentUser || auth.currentUser.isAnonymous) {
                window.location.href = "login.html"; 
            } else {
                // Se já estiver logado, vai direto para o pagamento
                window.location.href = "payment.html";
            }
        });
    }
}