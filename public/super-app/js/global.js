const APPSCRIPT_URL = "https://script.google.com/macros/s/AKfycbzB7dluoiNyJ4XK6oDK_iyuKZfwPTAJa4ua4RetQsUX9cMObgE-k_tFGI82HxW_OyMf/exec";
var MP_PUBLIC_KEY = "APP_USR-ab887886-2763-4265-8893-bf9513809bd1"; // ALERTA: A chave "APP_USR-786d3961..." inserida (EletroPay) é INVÁLIDA e causava o erro 404. Revertido para a chave anterior. Insira a Public Key correta do painel!
const CACHE_KEY = 'dtudo_products_cache';
const CACHE_TIME_KEY = 'dtudo_cache_time';
const CACHE_DURATION = 60 * 1000; // 60 segundos conforme solicitado

// Helpers de formatação global
const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

function calculateInstallmentsRule(price) {
    if (price >= 300) return { count: 3, value: price / 3 };
    if (price >= 150) return { count: 2, value: price / 2 };
    return { count: 1, value: price };
}

function getInstallmentHtml(price) {
    const inst = calculateInstallmentsRule(price);
    if (inst.count > 1) {
        return `<div class="installment-text">ou até <b>${inst.count}x ${formatCurrency(inst.value)}</b></div>`;
    }
    return `<div class="installment-text">ou <b>${formatCurrency(price)}</b> no cartão</div>`;
}

// Variáveis globais acessíveis em outras páginas
let currentUser = null;
let db = null;
let auth = null;

// --- 2. INICIALIZAÇÃO DO FIREBASE ---
document.addEventListener("DOMContentLoaded", () => {
    const firebaseConfig = {
        apiKey: "AIzaSyAVQ3tf6Qu4_9PajpJclZAJjVvRgB4ZE2I",
        authDomain: "super-app25.firebaseapp.com",
        projectId: "super-app25",
        storageBucket: "super-app25.firebasestorage.app",
        messagingSenderId: "810900166273",
        appId: "1:810900166273:web:24b8f055a68c9f0a6b5f80"
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    auth = firebase.auth();
    db = firebase.firestore();

    // Observer de Auth Global
    auth.onAuthStateChanged(user => {
        currentUser = user;
        updateUserUI(user);
        document.dispatchEvent(new CustomEvent('userReady', { detail: user }));
    });

    // Inicia o Gerenciador de Dados Central
    DataManager.init();

    updateCartBadge();
    setupGlobalEvents();
});

// --- 3. BANCO DE DADOS CENTRAL (CACHE) ---
const DataManager = {
    init: function () {
        // Primeira carga ao abrir qualquer página
        this.sync();

        // Loop de atualização a cada 60s
        setInterval(() => this.sync(), CACHE_DURATION);
    },

    sync: async function () {
        try {
            const response = await fetch(`${APPSCRIPT_URL}?action=listarProdutosSuperApp`);
            const result = await response.json();

            if (result.status === "success" && result.data) {
                const oldData = localStorage.getItem(CACHE_KEY);
                const newDataStr = JSON.stringify(result.data);

                if (oldData !== newDataStr) {
                    console.log("[DataManager] Detectadas mudanças no banco central.");

                    // Salva novos dados
                    localStorage.setItem(CACHE_KEY, newDataStr);
                    localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());

                    // Mecânica de 10s para refletir a atualização para o usuário
                    setTimeout(() => {
                        console.log("[DataManager] Refletindo novas informações...");
                        document.dispatchEvent(new CustomEvent('productsUpdated', { detail: result.data }));
                    }, 10000); // 10s após atualizar por completo
                }
            }
        } catch (e) {
            console.error("[DataManager] Erro ao sincronizar:", e);
        }
    },

    getProducts: function () {
        const data = localStorage.getItem(CACHE_KEY);
        return data ? JSON.parse(data) : [];
    }
};

// --- 3. GERENCIAMENTO DO CARRINHO ---
const CartManager = {
    get: () => JSON.parse(localStorage.getItem('app_cart')) || [],

    add: (product) => {
        let cart = CartManager.get();
        const existing = cart.find(item => item.id === product.id);
        if (existing) {
            existing.quantity++;
        } else {
            cart.push({ ...product, quantity: 1 });
        }
        localStorage.setItem('app_cart', JSON.stringify(cart));
        updateCartBadge();
        showToast(`${product.name} adicionado ao cesto!`, "success");
    },

    remove: (id) => {
        let cart = CartManager.get();
        cart = cart.filter(item => item.id !== id);
        localStorage.setItem('app_cart', JSON.stringify(cart));
        updateCartBadge();
    },

    clear: () => {
        localStorage.removeItem('app_cart');
        updateCartBadge();
    },

    total: () => {
        const cart = CartManager.get();
        return cart.reduce((sum, item) => sum + ((item.priceNew || item.priceOriginal) * item.quantity), 0);
    }
};

// --- 4. UI HELPERS GLOBAIS ---
function updateCartBadge() {
    const count = CartManager.get().reduce((acc, item) => acc + item.quantity, 0);
    const badgeMobile = document.getElementById("cart-badge");
    const badgeDesktop = document.getElementById("cart-badge-desktop");

    if (badgeMobile) {
        badgeMobile.innerText = count;
        badgeMobile.style.display = count > 0 ? 'flex' : 'none';
        if (count > 0) {
            badgeMobile.classList.add('pulse');
            setTimeout(() => badgeMobile.classList.remove('pulse'), 3000);
        }
    }
    if (badgeDesktop) {
        badgeDesktop.innerText = count;
        badgeDesktop.style.display = count > 0 ? 'flex' : 'none';
        if (count > 0) {
            badgeDesktop.classList.add('pulse');
            setTimeout(() => badgeDesktop.classList.remove('pulse'), 3000);
        }
    }
}

let toastTimeout;
function showToast(msg, type = "success") {
    const toast = document.getElementById("toast-notification");
    if (!toast) return;

    // Cancela o timeout anterior se houver (evita que o toast suma antes do tempo se clicarem várias vezes)
    clearTimeout(toastTimeout);

    toast.innerHTML = `<i class='bx bxs-${type === 'success' ? 'check-circle' : 'error-circle'}'></i> <span>${msg}</span>`;
    toast.className = `toast show ${type}`;

    toastTimeout = setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

// --- ATUALIZAÇÃO VISUAL DO USUÁRIO (CORRIGIDO) ---
function updateUserUI(user) {
    const desktopGreeting = document.getElementById("desktop-profile-trigger");
    const mobileBtn = document.getElementById("profile-button-mobile");

    // Elementos do Modal de Perfil
    const modalLoggedIn = document.getElementById("user-logged-in-view");
    const modalLoggedOut = document.getElementById("user-logged-out-view");
    const profilePic = document.getElementById("user-profile-pic");
    const profileName = document.getElementById("user-profile-name");

    if (user && !user.isAnonymous) {
        // --- USUÁRIO LOGADO ---
        const firstName = user.displayName ? user.displayName.split(' ')[0] : 'Cliente';
        const photoUrl = user.photoURL || 'https://placehold.co/100x100/333/fff?text=U'; // Fallback se não tiver foto

        // 1. Atualiza Header Desktop
        if (desktopGreeting) {
            // Adiciona a foto pequena ao lado do texto
            desktopGreeting.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px;">
                    <img src="${photoUrl}" style="width:32px; height:32px; border-radius:50%; border:1px solid #fff;">
                    <div style="display:flex; flex-direction:column;">
                        <span>olá, ${firstName}</span>
                        <strong>Minha Conta</strong>
                    </div>
                </div>`;
        }

        // 2. Atualiza Ícone Mobile (Troca o ícone pela foto)
        if (mobileBtn) {
            mobileBtn.innerHTML = `<img src="${photoUrl}" style="width:30px; height:30px; border-radius:50%; border:2px solid #fff; object-fit:cover;">`;
        }

        // 3. Atualiza Conteúdo do Modal
        if (modalLoggedIn && modalLoggedOut) {
            modalLoggedIn.style.display = "block"; // Mostra painel logado
            modalLoggedOut.style.display = "none"; // Esconde botão de login

            if (profilePic) profilePic.src = photoUrl;
            if (profileName) profileName.innerText = user.displayName;
        }

    } else {
        // --- USUÁRIO DESLOGADO ---

        // 1. Reset Header Desktop
        if (desktopGreeting) {
            desktopGreeting.innerHTML = `<span>olá, faça seu login</span><strong>ou cadastre-se</strong>`;
        }

        // 2. Reset Ícone Mobile
        if (mobileBtn) {
            mobileBtn.innerHTML = `<i class='bx bx-user-circle'></i>`;
        }

        // 3. Reset Conteúdo do Modal
        if (modalLoggedIn && modalLoggedOut) {
            modalLoggedIn.style.display = "none";
            modalLoggedOut.style.display = "block";
        }
    }
}

function setupGlobalEvents() {
    // Logout
    const logoutBtn = document.getElementById("logout-button");
    const desktopLogout = document.getElementById("desktop-logout");

    const handleLogout = () => {
        auth.signOut().then(() => {
            showToast("Você saiu da conta.");
            // O auth.onAuthStateChanged vai rodar e limpar a UI automaticamente
            const modal = document.getElementById("user-profile-modal");
            if (modal) modal.classList.remove("show");
        });
    };

    if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);
    if (desktopLogout) desktopLogout.addEventListener("click", handleLogout);

    // Google Login (Geralmente no Modal)
    const googleBtn = document.getElementById("google-login-button");
    if (googleBtn) {
        googleBtn.addEventListener("click", () => {
            const provider = new firebase.auth.GoogleAuthProvider();
            auth.signInWithPopup(provider).then(() => {
                showToast("Login realizado!", "success");
                const modal = document.getElementById("user-profile-modal");
                if (modal) modal.classList.remove("show");
            }).catch(error => {
                console.error(error);
                showToast("Erro ao entrar.", "error");
            });
        });
    }

    // Menu "Mais" e Modais globais (Perfil)
    const profileBtn = document.getElementById("profile-button-mobile"); // Botão mobile
    const profileModal = document.getElementById("user-profile-modal");

    // O botão desktop já tem lógica inline no HTML, mas o mobile precisa disso:
    if (profileBtn && profileModal) {
        profileBtn.addEventListener("click", () => profileModal.classList.add("show"));

        const closeBtn = profileModal.querySelector(".modal-close");
        if (closeBtn) closeBtn.addEventListener("click", () => profileModal.classList.remove("show"));
    }
}