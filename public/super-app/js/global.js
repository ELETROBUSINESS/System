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

// --- 4. UI HELPERS GLOBAIS ---
function updateCartBadge() {
    const badge = document.getElementById("cart-badge");
    if (!badge) return;
    const count = CartManager.get().reduce((acc, item) => acc + item.quantity, 0);
    if (count > 0) {
        badge.innerText = count;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

function showToast(msg, type = "success") {
    const toast = document.getElementById("toast-notification");
    if (!toast) return;
    toast.innerHTML = `<i class='bx bxs-${type === 'success' ? 'check-circle' : 'error-circle'}'></i> <span>${msg}</span>`;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.classList.remove("show"), 3000);
}

function updateUserUI(user) {
    // Atualiza foto/nome no menu lateral e modais se existirem na página atual
    const pic = document.getElementById("user-profile-pic");
    const name = document.getElementById("user-profile-name");
    const loggedView = document.getElementById("user-logged-in-view");
    const guestView = document.getElementById("user-logged-out-view");

    if (user && !user.isAnonymous) {
        if (pic) pic.src = user.photoURL || "https://placehold.co/100";
        if (name) name.innerText = user.displayName;
        if (loggedView) loggedView.style.display = 'block';
        if (guestView) guestView.style.display = 'none';
    } else {
        if (loggedView) loggedView.style.display = 'none';
        if (guestView) guestView.style.display = 'block';
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