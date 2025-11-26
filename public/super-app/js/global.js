// js/global.js

// --- 1. CONFIGURAÇÕES ---
const API_URLS = {
    CREATE_PREFERENCE: "https://createpreference-xsy57wqb6q-uc.a.run.app",
    CREATE_PAYMENT: "https://createpayment-xsy57wqb6q-uc.a.run.app"
};
const MP_PUBLIC_KEY = "APP_USR-519e5c93-44f8-42b1-a139-1b40aeb06310"; // Sua chave pública

// Variáveis globais acessíveis em outras páginas
let currentUser = null;
let db = null;
let auth = null;

// --- 2. INICIALIZAÇÃO DO FIREBASE (Executa em todas as páginas) ---
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
        updateUserUI(user); // Função UI definida abaixo

        // Dispara evento customizado para que páginas específicas saibam que o user carregou
        document.dispatchEvent(new CustomEvent('userReady', { detail: user }));
    });

    updateCartBadge(); // Atualiza o badge ao carregar a página
    setupGlobalEvents(); // Configura menu, logout, etc
});

// --- 3. GERENCIAMENTO DO CARRINHO (LocalStorage) ---
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
        showToast("Adicionado ao carrinho!", "success");
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
        return cart.reduce((sum, item) => sum + (item.priceNew * item.quantity), 0);
    }
};

// --- 4. UI HELPERS GLOBAIS (ATUALIZADA) ---
function updateCartBadge() {
    const count = CartManager.get().reduce((acc, item) => acc + item.quantity, 0);

    // Badge Mobile
    const badgeMobile = document.getElementById("cart-badge");
    if (badgeMobile) {
        badgeMobile.innerText = count;
        badgeMobile.style.display = count > 0 ? 'flex' : 'none';
    }

    // Badge Desktop (NOVO)
    const badgeDesktop = document.getElementById("cart-badge-desktop");
    if (badgeDesktop) {
        badgeDesktop.innerText = count;
        badgeDesktop.style.display = count > 0 ? 'flex' : 'none';
    }
}

function showToast(msg, type = "success") {
    const toast = document.getElementById("toast-notification");
    if (!toast) return;
    toast.innerHTML = `<i class='bx bxs-${type === 'success' ? 'check-circle' : 'error-circle'}'></i> <span>${msg}</span>`;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.classList.remove("show"), 3000);
}

// Função para atualizar saudação no desktop
function updateUserUI(user) {
    // ... (código existente dos modais) ...

    // Atualiza saudação no Desktop Header
    const desktopGreeting = document.getElementById("desktop-profile-trigger");
    if (desktopGreeting) {
        if (user && !user.isAnonymous) {
            const firstName = user.displayName ? user.displayName.split(' ')[0] : 'Cliente';
            desktopGreeting.innerHTML = `<span>olá, ${firstName}</span><strong>Minha Conta</strong>`;
        } else {
            desktopGreeting.innerHTML = `<span>olá, faça seu login</span><strong>ou cadastre-se</strong>`;
        }
    }
}

function setupGlobalEvents() {
    // Logout
    const logoutBtn = document.getElementById("logout-button");
    if (logoutBtn) logoutBtn.addEventListener("click", () => auth.signOut());

    // Google Login
    const googleBtn = document.getElementById("google-login-button");
    if (googleBtn) {
        googleBtn.addEventListener("click", () => {
            const provider = new firebase.auth.GoogleAuthProvider();
            auth.signInWithPopup(provider).then(() => {
                // Fecha modal se estiver aberto
                const modal = document.getElementById("user-profile-modal");
                if (modal) modal.classList.remove("show");
            });
        });
    }

    // Menu "Mais" e Modais globais (Perfil)
    const profileBtn = document.getElementById("profile-button");
    const profileModal = document.getElementById("user-profile-modal");
    if (profileBtn && profileModal) {
        profileBtn.addEventListener("click", () => profileModal.classList.add("show"));
        profileModal.querySelector(".modal-close").addEventListener("click", () => profileModal.classList.remove("show"));
    }
}