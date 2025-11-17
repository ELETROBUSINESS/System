/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */

// ==========================================================
// 1. CONFIGURAÇÃO
// ==========================================================
const YOUR_CREATE_PREFERENCE_URL = "https://createpreference-xsy57wqb6q-uc.a.run.app";
const YOUR_PROCESS_PAYMENT_URL = "https://processpayment-xsy57wqb6q-uc.a.run.app"; 
const YOUR_PUBLIC_KEY = "APP_USR-519e5c93-44f8-42b1-a139-1b40aeb06310";

// ==========================================================
// 2. INICIALIZAÇÃO DO MERCADO PAGO
// ==========================================================

const mp = new MercadoPago(YOUR_PUBLIC_KEY);
let paymentBrickController;
let pixTimerInterval = null; // Variável global para o timer do PIX

// ==========================================================
// 3. LÓGICA DA LOJA
// ==========================================================

// Estado global da aplicação
const state = {
    cart: [], 
    orders: [], // NOVO: Array de pedidos
    currentPage: 'page-home',
    currentProduct: null, 
    currentOrderId: null, // NOVO: ID do pedido sendo processado
    totalAmount: 0, 
};

document.addEventListener("DOMContentLoaded", () => {
  
    // --- Seletores do DOM ---
    const pages = document.querySelectorAll(".page");
    const navItems = document.querySelectorAll(".nav-item");
    const cartBadge = document.getElementById("cart-badge");
    const productGrid = document.querySelector(".product-grid");
    const toast = document.getElementById("toast-notification");
    const productModal = document.getElementById("product-modal");
    const productModalClose = document.getElementById("product-modal-close");
    const cartItemsContainer = document.getElementById("cart-items-container");
    const cartEmptyMessage = document.getElementById("cart-empty-message");
    const cartFullContent = document.getElementById("cart-content");
    const summarySubtotal = document.getElementById("summary-subtotal");
    const summarySavings = document.getElementById("summary-savings");
    const summaryTotal = document.getElementById("summary-total");
    const goToCheckoutButton = document.getElementById("go-to-checkout-button");
    const checkoutStep1 = document.getElementById("checkout-step-1");
    const checkoutStep2 = document.getElementById("checkout-step-2");
    const stepLabel1 = document.getElementById("step-label-1");
    const stepLabel2 = document.getElementById("step-label-2");
    const continueToPaymentButton = document.getElementById("continue-to-payment-button");
    const paymentTotalDisplay = document.getElementById("payment-total-display");
    const pixQrCodeDiv = document.getElementById("pix-qr-code");
    const pixCopyCodeInput = document.getElementById("pix-copy-code");
    const pixCopyButton = document.getElementById("pix-copy-button");
    const pixPaidButton = document.getElementById("pix-paid-button");
    const pixTimerDisplay = document.getElementById("pix-timer");

    // --- Seletores (NOVOS) ---
    const moreMenuButton = document.getElementById("more-menu-button");
    const moreMenuModal = document.getElementById("more-menu-modal");
    const navToOrdersButton = document.getElementById("nav-to-orders-button");
    const ordersListContainer = document.getElementById("orders-list-container");
    const ordersEmptyMessage = document.getElementById("orders-empty-message");


    // ==========================================================
    // 2. INICIALIZAÇÃO DO MERCADO PAGO (MOVIDA PARA CÁ)
    // ==========================================================
    async function initializePaymentBrick(amount) {
      const brickLoadingMessage = document.getElementById("brick-loading-message");
      const paymentError = document.getElementById("payment-error");
      const paymentContainer = document.getElementById("payment-brick-container");

      paymentContainer.innerHTML = '';
      paymentError.style.display = 'none';
      brickLoadingMessage.style.display = 'block';

      try {
        console.log("Chamando o backend para criar a preferência...");
        
        const response = await fetch(YOUR_CREATE_PREFERENCE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Compra em EletroBusiness", price: amount }),
        });

        if (!response.ok) {
            throw new Error("Falha ao criar a preferência. Status: " + response.status);
        }

        const data = await response.json();
        const preferenceId = data.id;
        console.log("Preferência criada com ID:", preferenceId);

        if (paymentBrickController) {
          paymentBrickController.unmount();
        }

        const bricksBuilder = mp.bricks();
        const settings = {
          initialization: {
            amount: Number(amount),
            preferenceId: preferenceId,
            payer: {
                email: "comprador.teste@gmail.com",
                firstName: "Comprador",
                lastName: "Teste",
                identification: { type: "CPF", number: "19119119100" },
                entity_type: "individual" 
            },
          },
          customization: {
            paymentMethods: {
              bankTransfer: "all", 
              creditCard: "all",
              mercadoPago: ["wallet_purchase"],
            },
            visual: { style: { theme: 'light' } }
          },
          callbacks: {
            onReady: () => {
              console.log("Brick de pagamento está pronto!");
              brickLoadingMessage.style.display = 'none';
            },
            onSubmit: (formData) => {
              console.log("Formulário enviado:", formData);
              
              const submitButton = document.querySelector("#payment-brick-container .mp-brick-submit-button");
              if(submitButton) submitButton.disabled = true;

              return new Promise((resolve, reject) => {
                fetch(YOUR_PROCESS_PAYMENT_URL, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(formData), 
                })
                .then(response => {
                    if (!response.ok) {
                        return response.json().then(err => { 
                            throw { status: response.status, data: err }; 
                        });
                    }
                    return response.json();
                })
                .then(result => {
                  if(submitButton) submitButton.disabled = false;
                  console.log("Resposta do pagamento:", result);

                  const now = new Date().toISOString();
                  
                  // FLUXO DE PIX (PENDENTE)
                  if (result.status === 'pending' && (result.payment_method_id === 'pix' || formData.paymentType === 'bank_transfer')) {
                    
                    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutos a partir de agora
                    const order = {
                        id: result.id,
                        items: [...state.cart], // Salva uma cópia
                        total: state.totalAmount,
                        status: 'pending_payment',
                        statusText: 'Aguardando Pagamento',
                        createdAt: now,
                        paymentType: 'pix',
                        paymentData: result.point_of_interaction.transaction_data,
                        expiresAt: expiresAt
                    };
                    addOrUpdateOrder(order);
                    state.currentOrderId = order.id;
                    
                    clearCart(); // Limpa o carrinho
                    
                    populatePixScreen(result, expiresAt);
                    navigateTo('page-pix-result');
                    resolve(); 

                  } else if (result.status === 'approved') {
                    // PAGAMENTO APROVADO (CARTÃO)
                    const order = {
                        id: result.id,
                        items: [...state.cart],
                        total: state.totalAmount,
                        status: 'approved',
                        statusText: 'Pagamento Aprovado',
                        createdAt: now,
                        paymentType: 'card',
                    };
                    addOrUpdateOrder(order);
                    clearCart();
                    
                    showToast("Pagamento aprovado! Obrigado!", "success");
                    navigateTo('page-orders'); // Redireciona para pedidos
                    resolve();

                  } else {
                    // PAGAMENTO REJEITADO (CARTÃO)
                    const message = result.message || result.status_detail || "Pagamento rejeitado";
                    const order = {
                        id: result.id || `failed-${Date.now()}`,
                        items: [...state.cart],
                        total: state.totalAmount,
                        status: 'failed',
                        statusText: message,
                        createdAt: now,
                        paymentType: 'card',
                    };
                    addOrUpdateOrder(order);

                    console.error("Pagamento rejeitado:", message);
                    paymentError.textContent = `Pagamento rejeitado: ${message}`;
                    paymentError.style.display = 'block';
                    // NÃO redireciona, mantém o usuário no checkout
                    reject(); 
                  }
                })
                .catch(error => {
                  // Erro de rede ou erro 500
                  if(submitButton) submitButton.disabled = false;
                  console.error("Erro grave ao processar pagamento:", error);
                  
                  // Salva um pedido falhado mesmo em erro de rede
                  const order = {
                        id: `failed-${Date.now()}`,
                        items: [...state.cart],
                        total: state.totalAmount,
                        status: 'failed',
                        statusText: error.data?.message || 'Erro de comunicação',
                        createdAt: new Date().toISOString(),
                        paymentType: 'unknown',
                    };
                  addOrUpdateOrder(order);
                  
                  paymentError.textContent = `Erro: ${error.data?.message || 'Tente novamente'}`;
                  paymentError.style.display = 'block';
                  reject();
                });
              });
            },
            onError: (error) => {
              console.error("Erro no brick de pagamento:", error);
              brickLoadingMessage.style.display = 'none';
              paymentError.textContent = 'Houve um erro no formulário. Verifique os dados.';
              paymentError.style.display = 'block';
            },
          },
        };

        paymentBrickController = await bricksBuilder.create("payment", "payment-brick-container", settings);

      } catch (error) {
        console.error("Erro ao chamar o backend (fetch):", error);
        brickLoadingMessage.style.display = 'none';
        paymentError.textContent = 'Não foi possível carregar as opções de pagamento.';
        paymentError.style.display = 'block';
      }
    }

    // --- Lógica de Navegação (Router) ---
    function navigateTo(pageId) {
        pages.forEach(page => page.classList.remove("active"));
        document.getElementById(pageId).classList.add("active");
        
        // Atualiza botões da navbar
        navItems.forEach(item => {
            const target = item.dataset.target;
            item.classList.toggle("active", target === pageId);
        });
        // Desativa o botão "Mais" se outra aba estiver ativa
        moreMenuButton.classList.remove("active");
        
        state.currentPage = pageId;
        window.scrollTo(0, 0);
        
        // Lógica específica ao entrar nas páginas
        if (pageId === 'page-cart') {
            renderCartPage();
        }
        if (pageId === 'page-orders') {
            moreMenuButton.classList.add("active"); // Ativa o botão "Mais"
            renderOrdersPage();
        }
        if (pageId === 'page-checkout') {
            showCheckoutStep(1); 
            if (paymentBrickController) {
                paymentBrickController.unmount();
                paymentBrickController = null;
            }
        }
    }

    // --- Navegação da Navbar ---
    navItems.forEach(item => {
        item.addEventListener("click", () => navigateTo(item.dataset.target));
    });
    
    // --- Navegação do Botão "Voltar" ---
    document.querySelectorAll(".back-button").forEach(button => {
        button.addEventListener("click", () => navigateTo(button.dataset.target));
    });

    // --- Lógica do Menu "Mais" (NOVO) ---
    function showModal(modalElement) {
        modalElement.classList.add("show");
    }
    function closeModal(modalElement) {
        modalElement.classList.remove("show");
    }

    moreMenuButton.addEventListener("click", () => {
        showModal(moreMenuModal);
    });
    
    // Fecha o modal ao clicar no 'X'
    moreMenuModal.querySelector('.modal-close').addEventListener("click", () => {
        closeModal(moreMenuModal);
    });
    
    // Fecha o modal ao clicar fora dele
    moreMenuModal.addEventListener("click", (e) => {
        if (e.target === moreMenuModal) {
            closeModal(moreMenuModal);
        }
    });

    // Botão "Meus Pedidos" dentro do modal
    navToOrdersButton.addEventListener("click", () => {
        closeModal(moreMenuModal);
        navigateTo('page-orders');
    });

    // --- Lógica do Banner (Slider) ---
    let slideIndex = 0;
    const slides = document.querySelector(".slider-wrapper");
    const dots = document.querySelectorAll(".nav-dot");

    function showSlide(index) {
        if (!slides) return;
        const totalSlides = slides.children.length;
        slideIndex = (index + totalSlides) % totalSlides;
        slides.style.transform = `translateX(-${slideIndex * 100}%)`;
        dots.forEach((dot, i) => dot.classList.toggle("active", i === slideIndex));
    }
    window.currentSlide = (n) => showSlide(slideIndex = n);
    setInterval(() => showSlide(slideIndex + 1), 5000);
    
    
    // --- Lógica do Modal de Produto ---
    productGrid.addEventListener("click", (e) => {
        if (e.target.classList.contains("cta-button")) {
            const productCard = e.target.closest(".product-card");
            openProductModal(productCard.dataset);
        }
    });
    function openProductModal(productData) {
        state.currentProduct = productData;
        document.getElementById("modal-product-name").textContent = productData.name;
        document.getElementById("modal-product-image").src = productData.image;
        document.getElementById("modal-product-price-old").textContent = `R$ ${parseFloat(productData.priceOld).toFixed(2).replace('.', ',')}`;
        document.getElementById("modal-product-price-new").textContent = `R$ ${parseFloat(productData.priceNew).toFixed(2).replace('.', ',')}`;
        document.getElementById("modal-product-description").textContent = productData.description;
        showModal(productModal);
    }
    function closeProductModal() {
        closeModal(productModal);
        state.currentProduct = null;
    }
    productModalClose.addEventListener("click", closeProductModal);
    productModal.addEventListener("click", (e) => {
        if (e.target === productModal) closeProductModal();
    });

    // --- Lógica do Carrinho ---
    document.getElementById("add-to-cart-button").addEventListener("click", () => {
        if (state.currentProduct) {
            addToCart(state.currentProduct);
            closeProductModal();
            showToast("Item adicionado ao carrinho!", "success");
        }
    });
    
    function addToCart(productData) {
        const existingItem = state.cart.find(item => item.id === productData.id);
        if (existingItem) {
            existingItem.quantity++;
        } else {
            state.cart.push({
                id: productData.id,
                name: productData.name,
                image: productData.image,
                priceOld: parseFloat(productData.priceOld),
                priceNew: parseFloat(productData.priceNew),
                quantity: 1,
            });
        }
        updateCartBadge();
    }
    
    function updateCartBadge() {
        const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
        if (totalItems > 0) {
            cartBadge.textContent = totalItems;
            cartBadge.style.display = 'flex';
        } else {
            cartBadge.style.display = 'none';
        }
    }
    
    function clearCart() {
        state.cart = [];
        updateCartBadge();
    }
    
    function showToast(message, type = "success") {
        toast.innerHTML = `<i class='bx bxs-${type === 'success' ? 'check-circle' : 'error-circle'}'></i> <span>${message}</span>`;
        toast.classList.remove("success", "error");
        toast.classList.add(type);
        toast.classList.add("show");
        setTimeout(() => { toast.classList.remove("show"); }, 3000);
    }
    
    function renderCartPage() {
        if (state.cart.length === 0) {
            cartEmptyMessage.style.display = 'block';
            cartFullContent.style.display = 'none';
            return;
        }
        
        cartEmptyMessage.style.display = 'none';
        cartFullContent.style.display = 'block';
        cartItemsContainer.innerHTML = '';
        let subtotal = 0;
        let totalSavings = 0;
        
        state.cart.forEach(item => {
            subtotal += item.priceNew * item.quantity;
            totalSavings += (item.priceOld - item.priceNew) * item.quantity;
            cartItemsContainer.innerHTML += `
                <div class="cart-item" data-id="${item.id}">
                    <img src="${item.image}" alt="${item.name}" class="cart-item-image">
                    <div class="cart-item-info">
                        <h4>${item.name}</h4>
                        <span class="cart-item-price">R$ ${item.priceNew.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <button class="cart-item-remove"><i class='bx bx-trash'></i></button>
                </div>
            `;
        });
        
        summarySubtotal.textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
        summarySavings.textContent = `- R$ ${totalSavings.toFixed(2).replace('.', ',')}`;
        summaryTotal.textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
        
        document.querySelectorAll(".cart-item-remove").forEach(button => {
            button.addEventListener("click", (e) => {
                const itemId = e.target.closest(".cart-item").dataset.id;
                removeFromCart(itemId);
                renderCartPage();
            });
        });
    }

    function removeFromCart(itemId) {
        state.cart = state.cart.filter(item => item.id !== itemId);
        updateCartBadge();
    }
    
    // --- Lógica da Página de Checkout ---
    function showCheckoutStep(stepNumber) {
        if (stepNumber === 1) {
            checkoutStep1.classList.add("active");
            checkoutStep2.classList.remove("active");
            stepLabel1.classList.add("active");
            stepLabel2.classList.remove("active");
        } else if (stepNumber === 2) {
            checkoutStep1.classList.remove("active");
            checkoutStep2.classList.add("active");
            stepLabel1.classList.add("active");
            stepLabel2.classList.add("active");
        }
    }

    continueToPaymentButton.addEventListener("click", () => {
        // Validação simples (pode ser melhorada)
        if (!document.getElementById("cep").value || !document.getElementById("address").value || !document.getElementById("number").value) {
            showToast("Preencha o CEP, Endereço e Número.", "error");
            return;
        }
        
        const total = state.cart.reduce((sum, item) => sum + item.priceNew * item.quantity, 0);
        if (total <= 0) {
            showToast("Seu carrinho está vazio.", "error");
            return;
        }
        
        state.totalAmount = total; 
        showCheckoutStep(2);
        paymentTotalDisplay.textContent = `R$ ${state.totalAmount.toFixed(2).replace('.', ',')}`;
        initializePaymentBrick(state.totalAmount);
    });

    goToCheckoutButton.addEventListener("click", () => {
        const total = state.cart.reduce((sum, item) => sum + item.priceNew * item.quantity, 0);
        if (total > 0) {
            state.totalAmount = total; 
            navigateTo('page-checkout');
        } else {
            showToast("Seu carrinho está vazio!", "error");
        }
    });

    // --- Lógica da Página PIX ---
    
    // Atualizada para receber 'expiresAt'
    function populatePixScreen(pixData, expiresAt) {
        const qrBase64 = pixData.paymentData.qr_code_base64;
        const qrCopyCode = pixData.paymentData.qr_code; 

        pixQrCodeDiv.innerHTML = `<img src="data:image/png;base64, ${qrBase64}" alt="PIX QR Code">`;
        pixCopyCodeInput.value = qrCopyCode;
        
        // Inicia o cronômetro
        startPixTimer(expiresAt);
    }

    // NOVO: Função do Cronômetro
    function startPixTimer(expiresAt) {
        if (pixTimerInterval) {
            clearInterval(pixTimerInterval);
        }
        
        const endTime = new Date(expiresAt).getTime();

        pixTimerInterval = setInterval(() => {
            const now = new Date().getTime();
            const distance = endTime - now;

            if (distance < 0) {
                clearInterval(pixTimerInterval);
                pixTimerDisplay.textContent = "QR Code Expirado";
                // Encontra o pedido e marca como falhado
                const order = state.orders.find(o => o.id === state.currentOrderId);
                if (order && order.status === 'pending_payment') {
                    order.status = 'failed';
                    order.statusText = 'Pagamento expirado';
                    saveOrdersToLocalStorage();
                }
                return;
            }

            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            
            pixTimerDisplay.textContent = `Expira em ${minutes}:${seconds.toString().padStart(2, '0')}`;

        }, 1000);
    }

    pixCopyButton.addEventListener("click", () => {
        pixCopyCodeInput.select();
        try {
            document.execCommand("copy");
            showToast("Código PIX copiado!", "success");
        } catch (err) {
            showToast("Falha ao copiar código.", "error");
        }
        window.getSelection().removeAllRanges();
    });
    
    // ATUALIZADO: Botão "Já paguei"
    pixPaidButton.addEventListener("click", () => {
        clearInterval(pixTimerInterval); // Para o timer
        
        // Encontra o pedido e atualiza o status para "processando"
        const order = state.orders.find(o => o.id === state.currentOrderId);
        if (order) {
            order.status = 'processing'; // O usuário *afirma* que pagou
            order.statusText = 'Processando Pagamento';
            saveOrdersToLocalStorage();
        }
        
        showToast("Obrigado! Estamos confirmando seu pagamento.", "success");
        navigateTo('page-orders'); // Vai para a lista de pedidos
    });


    // --- Lógica de Pedidos (NOVAS FUNÇÕES) ---
    function loadOrdersFromLocalStorage() {
        const orders = localStorage.getItem("eletro_orders");
        if (orders) {
            state.orders = JSON.parse(orders);
        }
    }

    function saveOrdersToLocalStorage() {
        localStorage.setItem("eletro_orders", JSON.stringify(state.orders));
    }

    function addOrUpdateOrder(order) {
        // Remove se já existir (para evitar duplicatas)
        state.orders = state.orders.filter(o => o.id !== order.id);
        // Adiciona no início da lista
        state.orders.unshift(order);
        saveOrdersToLocalStorage();
    }
    
    function renderOrdersPage() {
        if (state.orders.length === 0) {
            ordersEmptyMessage.style.display = 'block';
            ordersListContainer.innerHTML = '';
            return;
        }
        
        ordersEmptyMessage.style.display = 'none';
        ordersListContainer.innerHTML = '';
        
        state.orders.forEach(order => {
            let status = order.status;
            let statusText = order.statusText;
            
            // Verifica se o PIX expirou
            if (status === 'pending_payment' && new Date(order.expiresAt) < new Date()) {
                status = 'failed';
                statusText = 'Pagamento expirado';
                order.status = status; // Atualiza o estado
                order.statusText = statusText;
                saveOrdersToLocalStorage(); // Salva a atualização
            }
            
            const firstItem = order.items[0];
            const otherItemsCount = order.items.length - 1;
            
            // Define o botão de ação
            let actionButton = '';
            if (status === 'failed') {
                actionButton = `<button class="cta-button retry-payment-button" data-order-id="${order.id}">Tentar Pagar Novamente</button>`;
            } else if (status === 'pending_payment') {
                actionButton = `<button class="cta-button retry-payment-button" data-order-id="${order.id}">Ver QR Code</button>`;
            }

            const orderCardHtml = `
                <div class="order-card">
                    <div class="order-header">
                        <span class="order-date">${new Date(order.createdAt).toLocaleDateString('pt-BR', {day: '2-digit', month: 'short', year: 'numeric'})}</span>
                        <span class="order-status status-${status}">${statusText}</span>
                    </div>
                    <div class="order-body">
                        <div class="order-item-preview">
                            <img src="${firstItem.image}" alt="${firstItem.name}">
                            <div class="order-item-info">
                                <h4>${firstItem.name}</h4>
                                <p>${otherItemsCount > 0 ? `e mais ${otherItemsCount} item(ns)` : '1 item'}</p>
                            </div>
                        </div>
                    </div>
                    <div class="order-footer">
                        <span class="order-total">Total: R$ ${order.total.toFixed(2).replace('.', ',')}</span>
                        <div class="order-actions">
                            ${actionButton}
                        </div>
                    </div>
                </div>
            `;
            ordersListContainer.innerHTML += orderCardHtml;
        });
    }

    // Lógica para "Tentar Pagar Novamente"
    ordersListContainer.addEventListener("click", (e) => {
        if (e.target.classList.contains("retry-payment-button")) {
            const orderId = e.target.dataset.orderId;
            const order = state.orders.find(o => o.id == orderId || o.id === orderId);
            
            if (!order) return;

            // Se for um PIX pendente, apenas reabre a tela do PIX
            if (order.status === 'pending_payment') {
                state.currentOrderId = order.id;
                populatePixScreen(order, order.expiresAt);
                navigateTo('page-pix-result');
                return;
            }

            // Se for "falhado", recria o checkout
            state.cart = order.items; // Sobrescreve o carrinho atual
            state.totalAmount = order.total;
            updateCartBadge(); // Atualiza o ícone do carrinho
            
            navigateTo('page-checkout');
            
            // Avança direto para o passo 2 (Pagamento)
            showCheckoutStep(2);
            paymentTotalDisplay.textContent = `R$ ${state.totalAmount.toFixed(2).replace('.', ',')}`;
            initializePaymentBrick(state.totalAmount);
        }
    });

    
    // --- Inicializa a aplicação ---
    loadOrdersFromLocalStorage(); // Carrega pedidos salvos
    navigateTo('page-home');
    showSlide(0);
});