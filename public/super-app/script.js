/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */

// ==========================================================
// 1. CONFIGURAÇÃO (Global)
// ==========================================================
const YOUR_CREATE_PREFERENCE_URL = "https://createpreference-xsy57wqb6q-uc.a.run.app";
// NOVO: URL da nova função
const YOUR_CREATE_PAYMENT_URL = "https://createpayment-xsy57wqb6q-uc.a.run.app"; 
const YOUR_PUBLIC_KEY = "APP_USR-519e5c93-44f8-42b1-a139-1b40aeb06310";

// ==========================================================
// 2. INICIALIZAÇÃO DO MERCADO PAGO (Global)
// ==========================================================
const mp = new MercadoPago(YOUR_PUBLIC_KEY);
let paymentBrickController;
let pixTimerInterval = null;
let stopOrderListener = null; // Listener de pedidos

// ==========================================================
// 3. ESTADO DA APLICAÇÃO (Global)
// ==========================================================
const state = {
    cart: [], 
    currentPage: 'page-home',
    currentProduct: null, 
    currentOrderId: null, 
    currentUser: null,  
    totalAmount: 0, 
};


// ==========================================================
// 4. LÓGICA PRINCIPAL DA APLICAÇÃO
// ==========================================================
document.addEventListener("DOMContentLoaded", () => {
  
    // Variáveis de escopo para o Firebase
    let auth;
    let db;
    let googleProvider; 

    // ==========================================================
    // 5. INICIALIZAÇÃO DO FIREBASE (Agora com Provedor Google)
    // ==========================================================
    try {
        const firebaseConfig = {
            apiKey: "AIzaSyAVQ3tf6Qu4_9PajpJclZAJjVvRgB4ZE2I",
            authDomain: "super-app25.firebaseapp.com",
            projectId: "super-app25",
            storageBucket: "super-app25.firebasestorage.app",
            messagingSenderId: "810900166273",
            appId: "1:810900166273:web:24b8f055a68c9f0a6b5f80"
        };

        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
        
        googleProvider = new firebase.auth.GoogleAuthProvider();

        auth.onAuthStateChanged(user => {
            if (user) {
                console.log("Usuário logado:", user.uid, user.isAnonymous);
                state.currentUser = user;
                updateUserUI(user); 
                setupOrderListener(user.uid); 
            } else {
                console.log("Ninguém logado, iniciando login anônimo...");
                auth.signInAnonymously().catch(error => {
                    console.error("Erro no login anônimo:", error);
                });
            }
        });

    } catch (error) {
        console.error("Erro ao inicializar Firebase:", error);
        alert("Não foi possível conectar aos serviços do Firebase.");
    }

    // --- Seletores do DOM ---
    const pages = document.querySelectorAll(".page");
    const navItems = document.querySelectorAll(".nav-item[data-target]");
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
    const moreMenuButton = document.getElementById("more-menu-button");
    const moreMenuModal = document.getElementById("more-menu-modal");
    const navToOrdersButton = document.getElementById("nav-to-orders-button");
    const ordersListContainer = document.getElementById("orders-list-container");
    const ordersEmptyMessage = document.getElementById("orders-empty-message");

    // --- Seletores (Login/Perfil) ---
    const profileButton = document.getElementById("profile-button");
    const userProfileModal = document.getElementById("user-profile-modal");
    const userLoggedInView = document.getElementById("user-logged-in-view");
    const userLoggedOutView = document.getElementById("user-logged-out-view");
    const userProfilePic = document.getElementById("user-profile-pic");
    const userProfileName = document.getElementById("user-profile-name");
    const userProfileEmail = document.getElementById("user-profile-email");
    const profileNavOrders = document.getElementById("profile-nav-orders");
    const logoutButton = document.getElementById("logout-button");
    const googleLoginButton = document.getElementById("google-login-button");


    // ==========================================================
    // 6. NOVAS FUNÇÕES DE AUTENTICAÇÃO
    // ==========================================================

    function signInWithGoogle() {
        auth.signInWithPopup(googleProvider)
            .then(result => {
                showToast(`Bem-vindo, ${result.user.displayName}!`, "success");
                closeModal(userProfileModal);
            })
            .catch(error => {
                console.error("Erro no login com Google:", error);
                showToast("Falha no login com Google.", "error");
            });
    }

    function signOut() {
        auth.signOut()
            .then(() => {
                showToast("Você saiu.", "success");
                closeModal(userProfileModal);
            })
            .catch(error => {
                console.error("Erro ao sair:", error);
            });
    }

    function updateUserUI(user) {
        if (user && !user.isAnonymous) {
            userProfilePic.src = user.photoURL || "https://placehold.co/100";
            userProfileName.textContent = user.displayName;
            userProfileEmail.textContent = user.email;
            userLoggedInView.style.display = 'block';
            userLoggedOutView.style.display = 'none';
        } else {
            userLoggedInView.style.display = 'none';
            userLoggedOutView.style.display = 'block';
        }
    }

    // Listeners dos novos botões
    profileButton.addEventListener("click", () => {
        showModal(userProfileModal);
    });
    userProfileModal.querySelector('.modal-close').addEventListener("click", () => {
        closeModal(userProfileModal);
    });
    googleLoginButton.addEventListener("click", signInWithGoogle);
    logoutButton.addEventListener("click", signOut);
    profileNavOrders.addEventListener("click", () => {
        closeModal(userProfileModal);
        navigateTo('page-orders');
    });


    // ==========================================================
    // 7. LÓGICA DE PAGAMENTO (Brick)
    // ==========================================================
    async function initializePaymentBrick(amount, preferenceData) {
        const brickLoadingMessage = document.getElementById("brick-loading-message");
        const paymentError = document.getElementById("payment-error");
        const paymentContainer = document.getElementById("payment-brick-container");

        paymentContainer.innerHTML = '';
        paymentError.style.display = 'none';
        brickLoadingMessage.style.display = 'block';

        try {
            console.log("Preferência criada com ID:", preferenceData.preferenceId);

            if (paymentBrickController) {
                paymentBrickController.unmount();
            }

            const bricksBuilder = mp.bricks();
            const settings = {
                initialization: {
                    amount: Number(amount),
                    preferenceId: preferenceData.preferenceId,
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
                    
                    // ⬇️ ⬇️ ⬇️ LÓGICA DO SUBMIT TOTALMENTE ATUALIZADA ⬇️ ⬇️ ⬇️
                    onSubmit: (formData) => {
                        console.log("Formulário enviado, criando pagamento...");
                        state.currentOrderId = preferenceData.orderId; 
                        
                        // Desabilita o botão de pagar
                        const submitButton = document.querySelector("#payment-brick-container .mp-brick-submit-button");
                        if(submitButton) submitButton.disabled = true;

                        return new Promise((resolve, reject) => {
                            fetch(YOUR_CREATE_PAYMENT_URL, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    formData: formData,
                                    orderId: preferenceData.orderId
                                }),
                            })
                            .then(response => {
                                if (!response.ok) {
                                    return response.json().then(err => { 
                                        throw new Error(err.message || "Erro do servidor"); 
                                    });
                                }
                                return response.json();
                            })
                            .then(result => {
                                // 'result' é a resposta completa do pagamento
                                if (submitButton) submitButton.disabled = false;
                                
                                // ⬇️ ⬇️ ⬇️ LINHA ADICIONADA PARA O TESTE ⬇️ ⬇️ ⬇️
                                console.log("Resposta do Pagamento (Payment ID):", result.id);
                                // ⬆️ ⬆️ ⬆️ FIM DA ADIÇÃO ⬆️ ⬆️ ⬆️
                                
                                // Se for PIX, 'result.status' será 'pending'
                                if (result.status === 'pending') {
                                    populatePixScreen(result); // Envia a resposta inteira
                                    navigateTo('page-pix-result');
                                } else {
                                    // Se for cartão, o status será 'approved' ou 'rejected'
                                    // O webhook cuidará de atualizar o status no Firestore
                                    navigateTo('page-orders');
                                }
                                resolve();
                            })
                            .catch(error => {
                                console.error("Erro ao criar pagamento:", error);
                                if (submitButton) submitButton.disabled = false;
                                paymentError.textContent = `Erro: ${error.message}`;
                                paymentError.style.display = 'block';
                                reject();
                            });
                        });
                    },
                    // ⬆️ ⬆️ ⬆️ FIM DA ATUALIZAÇÃO ⬆️ ⬆️ ⬆️

                    onError: (error) => {
                        console.error("Erro no brick de pagamento:", error);
                        paymentError.textContent = 'Houve um erro no formulário. Verifique os dados.';
                        paymentError.style.display = 'block';
                    },
                },
            };

            paymentBrickController = await bricksBuilder.create("payment", "payment-brick-container", settings);

        } catch (error) {
            console.error("Erro ao inicializar Brick:", error);
            paymentError.textContent = 'Não foi possível carregar as opções de pagamento.';
            paymentError.style.display = 'block';
        }
    }

    // ==========================================================
    // 8. LÓGICA DE NAVEGAÇÃO E UI (Modais, Banner, etc.)
    // ==========================================================
    
    // (Todas as funções de UI, Navegação, Carrinho, etc. permanecem INALTERADAS)
    
    // --- Lógica de Navegação (Router) ---
    function navigateTo(pageId) {
        pages.forEach(page => page.classList.remove("active"));
        document.getElementById(pageId).classList.add("active");
        
        navItems.forEach(item => {
            const target = item.dataset.target;
            item.classList.toggle("active", target === pageId);
        });
        moreMenuButton.classList.remove("active");
        
        state.currentPage = pageId;
        window.scrollTo(0, 0);
        
        if (pageId === 'page-cart') {
            renderCartPage();
        }
        if (pageId === 'page-orders') {
            moreMenuButton.classList.add("active");
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

    // --- Lógica do Menu "Mais" ---
    function showModal(modalElement) {
        modalElement.classList.add("show");
    }
    function closeModal(modalElement) {
        modalElement.classList.remove("show");
    }
    moreMenuButton.addEventListener("click", () => {
        showModal(moreMenuModal);
    });
    moreMenuModal.querySelector('.modal-close').addEventListener("click", () => {
        closeModal(moreMenuModal);
    });
    moreMenuModal.addEventListener("click", (e) => {
        if (e.target === moreMenuModal) {
            closeModal(moreMenuModal);
        }
    });
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
    function clearCart() { state.cart = []; updateCartBadge(); }
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

    continueToPaymentButton.addEventListener("click", async () => {
        if (!state.currentUser) {
            showToast("Aguardando autenticação...", "error");
            return;
        }
        if (!document.getElementById("cep").value) {
            showToast("Preencha o CEP.", "error");
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
        document.getElementById("brick-loading-message").style.display = 'block';

        try {
            const response = await fetch(YOUR_CREATE_PREFERENCE_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                  name: "Compra em EletroBusiness", 
                  price: total,
                  items: state.cart, 
                  userId: state.currentUser.uid 
              }),
            });
            
            if (!response.ok) {
                throw new Error("Falha ao criar ordem no backend");
            }

            const preferenceData = await response.json(); // { preferenceId, orderId }
            
            clearCart();
            
            initializePaymentBrick(state.totalAmount, preferenceData);

        } catch (error) {
            console.error("Erro ao chamar createPreference:", error);
            document.getElementById("payment-error").textContent = 'Erro ao iniciar pagamento. Tente novamente.';
            document.getElementById("payment-error").style.display = 'block';
            document.getElementById("brick-loading-message").style.display = 'none';
        }
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
    
    // ⬇️ ⬇️ ⬇️ FUNÇÃO ATUALIZADA ⬇️ ⬇️ ⬇️
    // Agora lê a resposta do 'createPayment'
    function populatePixScreen(paymentResponse) {
        if (!paymentResponse.point_of_interaction) {
            console.error("populatePixScreen chamado sem point_of_interaction");
            return;
        }
        const qrBase64 = paymentResponse.point_of_interaction.transaction_data.qr_code_base64;
        const qrCopyCode = paymentResponse.point_of_interaction.transaction_data.qr_code; 
        const expiresAt = paymentResponse.date_of_expiration;

        pixQrCodeDiv.innerHTML = `<img src="data:image/png;base64, ${qrBase64}" alt="PIX QR Code">`;
        pixCopyCodeInput.value = qrCopyCode;
        
        startPixTimer(expiresAt);
    }
    // ⬆️ ⬆️ ⬆️ FIM DA ATUALIZAÇÃO ⬆️ ⬆️ ⬆️
    
    function startPixTimer(expiresAt) {
        if (pixTimerInterval) {
            clearInterval(pixTimerInterval);
        }
        
        const endTime = (expiresAt.toDate ? expiresAt.toDate() : new Date(expiresAt)).getTime();

        pixTimerInterval = setInterval(() => {
            const now = new Date().getTime();
            const distance = endTime - now;

            if (distance < 0) {
                clearInterval(pixTimerInterval);
                pixTimerDisplay.textContent = "QR Code Expirado";
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
    pixPaidButton.textContent = "Voltar para Meus Pedidos";
    pixPaidButton.addEventListener("click", () => {
        clearInterval(pixTimerInterval); 
        navigateTo('page-orders'); 
    });


    // ==========================================================
    // 9. LÓGICA DE PEDIDOS (FIRESTORE)
    // ==========================================================
    
    // (Esta seção permanece INALTERADA, ela já lê do Firestore)
    
    function setupOrderListener(userId) {
        if (stopOrderListener) stopOrderListener(); 

        if (!db) { 
            console.error("Firestore (db) não está inicializado.");
            return;
        }
        stopOrderListener = db.collection("orders")
          .where("userId", "==", userId)
          .orderBy("createdAt", "desc")
          .onSnapshot(snapshot => {
              const orders = [];
              snapshot.forEach(doc => {
                  orders.push({ id: doc.id, ...doc.data() });
              });
              
              renderOrdersPage(orders);
              
          }, error => {
              console.error("Erro ao ouvir pedidos:", error);
          });
    }

    function renderOrdersPage(orders) {
        if (!orders || orders.length === 0) {
            ordersEmptyMessage.style.display = 'block';
            ordersListContainer.innerHTML = '';
            return;
        }
        
        ordersEmptyMessage.style.display = 'none';
        ordersListContainer.innerHTML = '';
        
        orders.forEach(order => {
            let status = order.status;
            let statusText = order.statusText;
            
            if (status === 'pending_payment' && order.expiresAt && (order.expiresAt.toDate ? order.expiresAt.toDate() : new Date(order.expiresAt)) < new Date()) {
                status = 'failed';
                statusText = 'Pagamento expirado';
            }
            
            if (!order.items || order.items.length === 0) {
                console.error("Pedido " + order.id + " ignorado (sem itens).");
                return; 
            }

            const firstItem = order.items[0];
            const otherItemsCount = order.items.length - 1;
            
            let actionButtons = '';
            
            if (status === 'failed') {
                actionButtons = `<button class="cta-button retry-payment-button" data-order-id="${order.id}">Tentar Pagar Novamente</button>`;
                if (statusText === 'Pagamento expirado') {
                    actionButtons = `
                        <button class="order-action-delete" data-order-id="${order.id}" title="Excluir Pedido"><i class='bx bx-trash'></i></button>
                        ${actionButtons} 
                    `;
                }
            } else if (status === 'pending_payment') {
                actionButtons = `
                    <button class="order-action-delete" data-order-id="${order.id}" title="Cancelar Pedido"><i class='bx bx-trash'></i></button>
                    <button class="cta-button retry-payment-button" data-order-id="${order.id}">Ver QR Code</button>
                `;
            }

            const orderCardHtml = `
                <div class="order-card">
                    <div class="order-header">
                        <span class="order-date">${order.createdAt ? order.createdAt.toDate().toLocaleDateString('pt-BR', {day: '2-digit', month: 'short', year: 'numeric'}) : ''}</span>
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
                            ${actionButtons}
                        </div>
                    </div>
                </div>
            `;
            ordersListContainer.innerHTML += orderCardHtml;
        });
    }

    // Ações de clique nos pedidos
    ordersListContainer.addEventListener("click", async (e) => {
        
        // DELETAR PEDIDO
        const deleteButton = e.target.closest(".order-action-delete");
        if (deleteButton) {
            const orderId = deleteButton.dataset.orderId;
            if (confirm("Tem certeza que deseja cancelar este pedido?")) {
                try {
                    await db.collection("orders").doc(orderId).delete();
                    showToast("Pedido cancelado.", "success");
                } catch (error) {
                    console.error("Erro ao deletar pedido:", error);
                    showToast("Erro ao cancelar pedido.", "error");
                }
            }
            return;
        }

        // TENTAR PAGAR NOVAMENTE / VER QR CODE
        const retryButton = e.target.closest(".retry-payment-button");
        if (retryButton) {
            const orderId = retryButton.dataset.orderId;
            
            try {
                const orderDoc = await db.collection("orders").doc(orderId).get();
                if (!orderDoc.exists) return;
                const order = orderDoc.data();

                // Se for um PIX PENDENTE, busca os dados do PIX e vai para a tela
                if (order.status === 'pending_payment') {
                    state.currentOrderId = orderId;
                    if (order.paymentData) { // Se os dados do QR Code já existem
                        populatePixScreen(order); // Reusa os dados
                        navigateTo('page-pix-result');
                    } else {
                        // Isso não deve acontecer, mas por segurança
                        showToast("Erro ao recarregar QR Code.", "error");
                    }
                    return;
                }

                // Se FALHOU, recria o checkout
                if (order.status === 'failed') {
                    state.cart = order.items; 
                    state.totalAmount = order.total;
                    updateCartBadge();
                    navigateTo('page-checkout');
                    showCheckoutStep(1); 
                }
            } catch (error) {
                console.error("Erro ao tentar pagar novamente:", error);
            }
        }
    });

    
    // --- Inicializa a aplicação ---
    navigateTo('page-home');
    showSlide(0);

}); // FIM DO DOMCONTENTLOADED