// js/app-core.js

// 1. Configuração Centralizada do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAVQ3tf6Qu4_9PajpJclZAJjVvRgB4ZE2I",
    authDomain: "super-app25.firebaseapp.com",
    projectId: "super-app25",
    storageBucket: "super-app25.firebasestorage.app",
    messagingSenderId: "810900166273",
    appId: "1:810900166273:web:24b8f055a68c9f0a6b5f80"
};

// Inicializa apenas se ainda não estiver inicializado
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// 2. Controle de Sessão e UI Global
document.addEventListener("DOMContentLoaded", () => {

    // Gerencia estado de Loading
    const body = document.body;
    body.classList.add('loading-auth'); // Força estado de carregamento inicial

    // Verifica Autenticação
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log("Usuário autenticado:", user.uid);
            await loadUserDataGlobal(user);
            body.classList.remove('loading-auth');
            highlightCurrentMenu(); // Ativa o ícone correto no menu
        } else {
            // Se não tem Firebase User, verifica se tem Token de Sessão (Legacy/E-finance)
            const sessionToken = localStorage.getItem('session_token');
            if (sessionToken) {
                console.log("Sessão via Token detectada. Ignorando Auth Firebase.");
                body.classList.remove('loading-auth');
                return;
            }

            console.warn("Sem sessão. Redirecionando...");
            const isAdminArea = window.location.pathname.includes('/adm/nb/');
            window.location.href = isAdminArea ? "/users/e-finance.html" : "/login.html";
        }
    });

    // 6. Timer de Sessão Visual
    createSessionTimer();

    // Configura Botão Sair (se existir na página - Ex: Extrato)
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.logoutApp();
        });
    }
});

// Função Global de Logout (para usar em onClick inline)
window.logoutApp = function () {
    // Determina URL de Redirecionamento
    // Se estiver na área administrativa específica, volta para e-finance
    const isAdminArea = window.location.pathname.includes('/adm/nb/');
    const redirectUrl = isAdminArea ? "/users/e-finance.html" : "/login.html";

    // Limpa tokens imediatamente para garantir
    localStorage.removeItem('user_cache');
    localStorage.removeItem('session_token');

    // Limpa cache de dados
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('acc_cache_')) localStorage.removeItem(key);
    });

    // Tenta logout no Firebase e redireciona
    if (firebase.auth().currentUser) {
        auth.signOut().then(() => {
            window.location.href = redirectUrl;
        }).catch(() => {
            window.location.href = redirectUrl;
        });
    } else {
        window.location.href = redirectUrl;
    }
};

// 3. Função de Carregamento de Dados (Reutilizável)
async function loadUserDataGlobal(user) {
    // Tenta usar cache primeiro para velocidade
    const cache = JSON.parse(localStorage.getItem('user_cache') || '{}');
    if (cache.uid === user.uid) updateGlobalUI(cache);

    try {
        // Busca atualização no banco
        const doc = await db.collection('users').doc(user.uid).get();
        if (doc.exists) {
            const data = doc.data();
            const uiData = {
                uid: user.uid,
                name: data.nome || data.username,
                role: data.funcao || 'Colaborador',
                photoUrl: data.photoUrl,
                points: data.pontos || 0,
                // Adicione outros campos globais aqui se precisar
            };

            // --- TEMPORARY FRONTEND OVERRIDE FOR POINTS ---
            const lowerName = (uiData.name || "").toLowerCase();
            if (lowerName.includes('evelyn')) {
                uiData.points = 7;
            } else if (lowerName.includes('ryan')) {
                uiData.points = 5;
            }
            // ----------------------------------------------

            updateGlobalUI(uiData);
            localStorage.setItem('user_cache', JSON.stringify(uiData));
        }
    } catch (error) {
        console.error("Erro core:", error);
    }
}

// 4. Atualiza Elementos Padrão da Interface (Header, Foto, Pontos)
function updateGlobalUI(data) {
    const firstName = data.name.split(' ')[0];

    // Atualiza Saudações (se o elemento existir na página)
    const els = {
        greeting: document.getElementById('user-greeting'),
        role: document.getElementById('user-role'),
        photo: document.getElementById('user-photo'),
        points: document.getElementById('user-points')
    };

    if (els.greeting) els.greeting.innerText = `Olá, ${firstName}!`;
    if (els.role) els.role.innerText = data.role;

    if (els.photo) {
        if (data.photoUrl && data.photoUrl.includes('http')) {
            els.photo.src = data.photoUrl;
        } else {
            const letter = firstName.charAt(0).toUpperCase();
            els.photo.src = `https://placehold.co/150/db0038/FFFFFF?text=${letter}`;
        }
    }

    if (els.points) {
        els.points.innerText = Number(data.points).toFixed(2).replace('.', ',');
        els.points.classList.remove('skeleton'); // Remove efeito de carregamento
    }
}

// 5. Destaca o item correto no Menu Inferior/Lateral
function highlightCurrentMenu() {
    const currentPage = window.location.pathname.split("/").pop(); // ex: 'quest.html'
    const menuLinks = document.querySelectorAll('.navigation .list a');

    document.querySelectorAll('.navigation .list').forEach(li => li.classList.remove('active'));

    menuLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage) {
            link.parentElement.classList.add('active');
        }
    });
}

// 6. Timer de Sessão
function createSessionTimer() {
    const div = document.createElement('div');
    div.id = 'last-update-indicator';
    div.style.cssText = 'position: fixed; bottom: 15px; right: 15px; font-size: 11px; color: rgb(75, 85, 99); z-index: 9999; font-family: Inter, sans-serif; background: rgba(255, 255, 255, 0.8); padding: 4px 8px; border-radius: 4px; border: 1px solid rgb(229, 231, 235); pointer-events: none; display: block;';

    // Adiciona ao corpo se não existir
    if (!document.getElementById('last-update-indicator')) {
        document.body.appendChild(div);
    }

    const updateTimer = () => {
        const tokenString = localStorage.getItem('session_token');
        if (!tokenString) {
            div.innerText = "Sessão inválida";
            return;
        }

        try {
            const token = JSON.parse(tokenString);
            const now = new Date().getTime();
            const diff = token.expires - now;

            if (diff <= 0) {
                div.innerText = "Sessão expirada";
                div.style.color = "red";
                // Redireciona se expirou
                const isAdminArea = window.location.pathname.includes('/adm/nb/');
                const redirectUrl = isAdminArea ? "/users/e-finance.html" : "/login.html";
                setTimeout(() => window.location.href = redirectUrl, 1000);
            } else {
                const totalSeconds = Math.floor(diff / 1000);
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;

                // Formatação MM:SS
                div.innerText = `Sessão expira em ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        } catch (e) {
            div.innerText = "Erro no timer";
        }
    };

    updateTimer(); // Chama imediatamente
    setInterval(updateTimer, 1000); // Atualiza a cada segundo
}