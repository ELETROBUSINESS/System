// js/global.js

// --- 1. CONFIGURAÇÕES ---
const API_URLS = {
    CREATE_PREFERENCE: "https://createpreference-xsy57wqb6q-uc.a.run.app",
    CREATE_PAYMENT: "https://createpayment-xsy57wqb6q-uc.a.run.app",
    CREATE_INFINITEPAY_LINK: "https://createinfinitepaylink-xsy57wqb6q-uc.a.run.app"
};
const MP_PUBLIC_KEY = "APP_USR-ab887886-2763-4265-8893-bf9513809bd1";

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

    // Observer de Auth Global: Roda sempre que o status do login muda (inclusive ao recarregar a página)
    auth.onAuthStateChanged(user => {
        currentUser = user;
        updateUserUI(user); // << AQUI É ONDE A MÁGICA ACONTECE

        // Dispara evento para outras páginas saberem que carregou
        document.dispatchEvent(new CustomEvent('userReady', { detail: user }));
    });

    updateCartBadge();
    setupGlobalEvents();
});

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
    const count = CartManager.get().reduce((acc, item) => acc + item.quantity, 0);
    const badgeMobile = document.getElementById("cart-badge");
    const badgeDesktop = document.getElementById("cart-badge-desktop");

    if (badgeMobile) {
        badgeMobile.innerText = count;
        badgeMobile.style.display = count > 0 ? 'flex' : 'none';
    }
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