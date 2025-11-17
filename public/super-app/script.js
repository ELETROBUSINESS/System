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

// A FUNÇÃO initializePaymentBrick FOI MOVIDA DAQUI...

// ==========================================================
// 3. LÓGICA DA LOJA (NÃO PRECISA MUDAR)
// ==========================================================

// Estado global da aplicação
const state = {
    cart: [], 
    currentPage: 'page-home',
    currentProduct: null, 
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


    // ==========================================================
    // 2. INICIALIZAÇÃO DO MERCADO PAGO (MOVIDA PARA CÁ)
    // ==========================================================
    /**
     * Função para criar e renderizar o Payment Brick
     * @param {number} amount - Valor total do carrinho
     */
    async function initializePaymentBrick(amount) {
      const brickLoadingMessage = document.getElementById("brick-loading-message");
      const paymentError = document.getElementById("payment-error");
      const paymentContainer = document.getElementById("payment-brick-container");

      // Limpa o estado anterior
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
            // ⬇️ ⬇️ ⬇️ CORREÇÃO DO CACHE / FRONTEND ⬇️ ⬇️ ⬇️
            // Pré-preenche todos os dados do Payer para pular a tela de e-mail
            payer: {
                email: "comprador.teste@gmail.com",
                firstName: "Comprador",
                lastName: "Teste",
                identification: {
                    type: "CPF",
                    number: "19119119100" // Mesmo CPF de teste do backend
                },
                entity_type: "individual" // Esta linha previne o aviso "entityType..."
            },
            // ⬆️ ⬆️ ⬆️ FIM DA CORREÇÃO ⬆️ ⬆️ ⬆️
          },
          customization: {
            paymentMethods: {
              bankTransfer: "all", 
              creditCard: "all",
              mercadoPago: ["wallet_purchase"],
            },
            visual: { 
                style: { 
                    theme: 'light'
                } 
            }
          },
          callbacks: {
            onReady: () => {
              console.log("Brick de pagamento está pronto!");
              brickLoadingMessage.style.display = 'none';
            },
            onSubmit: (formData) => { // 'formData' aqui é o objeto { formData: {...}, ... }
              console.log("Formulário enviado:", formData);
              
              const submitButton = document.querySelector("#payment-brick-container .mp-brick-submit-button");
              if(submitButton) submitButton.disabled = true;

              return new Promise((resolve, reject) => {
                fetch(YOUR_PROCESS_PAYMENT_URL, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(formData), // Envia o objeto inteiro
                })
                .then(response => {
                  // Verifica se a resposta do servidor foi OK (status 200-299)
                  if (!response.ok) {
                      // Se for um erro 500 ou 400, joga um erro para o .catch()
                      throw new Error(`Erro do servidor: ${response.status}`);
                  }
                  // Se foi OK, continua para processar o JSON
                  return response.json();
                })
                .then(result => {
                  
                  if(submitButton) submitButton.disabled = false;
                  console.log("Resposta do pagamento:", result);

                  // FLUXO DE PIX
                  if (result.status === 'pending' && (result.payment_method_id === 'pix' || formData.paymentType === 'bank_transfer')) {
                    // ESTA FUNÇÃO AGORA ESTÁ ACESSÍVEL POIS ESTÁ NO MESMO ESCOPO
                    populatePixScreen(result);
                    navigateTo('page-pix-result');
                    resolve(); 

                  } else if (result.status === 'approved') {
                    // Pagamento aprovado
                    showToast("Pagamento aprovado! Obrigado!", "success");
                    state.cart = []; 
                    updateCartBadge();
                    navigateTo('page-home');
                    resolve();

                  } else {
                    // Pagamento rejeitado ou outro erro
                    const message = result.message || result.status_detail || "Pagamento rejeitado";
                    console.error("Pagamento rejeitado:", message);
                    paymentError.textContent = `Pagamento rejeitado: ${message}`;
                    paymentError.style.display = 'block';
                    reject(); 
                  }
                })
                .catch(error => {
                  if(submitButton) submitButton.disabled = false;
                  console.error("Erro grave ao processar pagamento:", error);
                  paymentError.textContent = 'Erro de comunicação. Tente novamente.';
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

        paymentBrickController = await bricksBuilder.create(
          "payment",
          "payment-brick-container",
          settings
        );

      } catch (error) {
        console.error("Erro ao chamar o backend (fetch):", error);
        brickLoadingMessage.style.display = 'none';
        paymentError.textContent = 'Não foi possível carregar as opções de pagamento.';
        paymentError.style.display = 'block';
      }
    }
    // ==========================================================
    // FIM DA FUNÇÃO MOVIDA
    // ==========================================================


    // --- Lógica de Navegação (Router) ---
    function navigateTo(pageId) {
        pages.forEach(page => page.classList.remove("active"));
        document.getElementById(pageId).classList.add("active");
        
        navItems.forEach(item => {
            item.classList.toggle("active", item.dataset.target === pageId);
        });
        
        state.currentPage = pageId;
        window.scrollTo(0, 0);
        
        if (pageId === 'page-cart') {
            renderCartPage();
        }
        
        if (pageId === 'page-checkout') {
            showCheckoutStep(1); 
            if (paymentBrickController) {
                paymentBrickController.unmount();
                paymentBrickController = null;
            }
        }
    }

    navItems.forEach(item => {
        item.addEventListener("click", () => navigateTo(item.dataset.target));
    });
    
    document.querySelectorAll(".back-button").forEach(button => {
        button.addEventListener("click", () => navigateTo(button.dataset.target));
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
        
        productModal.classList.add("show");
    }

    function closeProductModal() {
        productModal.classList.remove("show");
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
    
    function showToast(message, type = "success") {
        toast.innerHTML = `<i class='bx bxs-${type === 'success' ? 'check-circle' : 'error-circle'}'></i> <span>${message}</span>`;
        toast.classList.remove("success", "error");
        
        if (type === 'success') {
            toast.classList.add("success");
        } else {
            toast.classList.add("error");
        }

        toast.classList.add("show");
        setTimeout(() => {
            toast.classList.remove("show");
        }, 3000);
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
            
            const itemHtml = `
                <div class="cart-item" data-id="${item.id}">
                    <img src="${item.image}" alt="${item.name}" class="cart-item-image">
                    <div class="cart-item-info">
                        <h4>${item.name}</h4>
                        <span class="cart-item-price">R$ ${item.priceNew.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <button class="cart-item-remove"><i class='bx bx-trash'></i></button>
                </div>
            `;
            cartItemsContainer.innerHTML += itemHtml;
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
        const total = state.cart.reduce((sum, item) => sum + item.priceNew * item.quantity, 0);
        
        if (total > 0) {
            state.totalAmount = total; 
            showCheckoutStep(2);
            paymentTotalDisplay.textContent = `R$ ${state.totalAmount.toFixed(2).replace('.', ',')}`;
            // Esta chamada agora funciona corretamente
            initializePaymentBrick(state.totalAmount);
        } else {
            alert("Seu carrinho está vazio!");
        }
    });

    goToCheckoutButton.addEventListener("click", () => {
        const total = state.cart.reduce((sum, item) => sum + item.priceNew * item.quantity, 0);
        
        if (total > 0) {
            state.totalAmount = total; 
            navigateTo('page-checkout');
        } else {
            alert("Seu carrinho está vazio!");
        }
    });

    // --- Lógica da Página PIX ---
    function populatePixScreen(pixData) {
        const qrBase64 = pixData.point_of_interaction.transaction_data.qr_code_base64;
        const qrCopyCode = pixData.point_of_interaction.transaction_data.qr_code; 

        pixQrCodeDiv.innerHTML = `<img src="data:image/png;base64, ${qrBase64}" alt="PIX QR Code">`;
        pixCopyCodeInput.value = qrCopyCode;
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
    
    pixPaidButton.addEventListener("click", () => {
        showToast("Obrigado! Assim que o pagamento for confirmado, enviaremos seu pedido.", "success");
        state.cart = []; 
        updateCartBadge();
        navigateTo('page-home');
    });
    
    // --- Inicializa a página ---
    navigateTo('page-home');
    showSlide(0);
});