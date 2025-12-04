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
            console.warn("Sem sessão. Redirecionando...");
            window.location.href = "/login.html";
        }
    });

    // Configura Botão Sair (se existir na página)
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            auth.signOut().then(() => {
                localStorage.removeItem('user_cache');
                window.location.href = "/login.html";
            });
        });
    }
});

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