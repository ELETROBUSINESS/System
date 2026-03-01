// public/users/app/js/app-core.js
// Modernized to Firebase 10 Modular SDK

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. Configuração Centralizada
const firebaseConfig = {
    apiKey: "AIzaSyAVQ3tf6Qu4_9PajpJclZAJjVvRgB4ZE2I",
    authDomain: "super-app25.firebaseapp.com",
    projectId: "super-app25",
    storageBucket: "super-app25.firebasestorage.app",
    messagingSenderId: "810900166273",
    appId: "1:810900166273:web:24b8f055a68c9f0a6b5f80"
};

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyZtUsI44xA4MQQLZWJ6K93t6ZaSaN6hw7YQw9EclZG9E85kM6yOWQCQ0D-ZJpGmyq4/exec";

// Inicializa Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);

// 2. Controle de Sessão e UI Global
document.addEventListener("DOMContentLoaded", () => {
    const body = document.body;
    body.classList.add('loading-auth');

    // Verifica Autenticação
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("Usuário autenticado:", user.uid);
            await loadUserDataGlobal(user);
            body.classList.remove('loading-auth');
            highlightCurrentMenu();
        } else {
            // Se não tem Firebase User, verifica se tem Token de Sessão (Fallback de compatibilidade)
            const sessionToken = localStorage.getItem('session_token');
            if (sessionToken) {
                try {
                    const token = JSON.parse(sessionToken);
                    if (new Date().getTime() < token.expires) {
                        console.log("Sessão via Token válida e detectada.");
                        body.classList.remove('loading-auth');
                        // Tenta carregar dados da planilha se tiver nome de usuário no token
                        if (token.username) loadUserSpreadsheetData(token.username);
                        return;
                    }
                } catch (e) {
                    console.error("Erro no token legado:", e);
                }
            }

            console.warn("Sem sessão ativa. Redirecionando para login...");
            const isAdminArea = window.location.pathname.includes('/adm/nb/');
            window.location.href = isAdminArea ? "/users/e-finance.html" : "/login.html";
        }
    });

    createSessionTimer();

    // Configura Botão Sair
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.logoutApp();
        });
    }
});

// 3. Função de Carregamento de Dados (Cache first)
async function loadUserDataGlobal(user) {
    const cache = JSON.parse(localStorage.getItem('user_cache') || '{}');
    if (cache.uid === user.uid) {
        updateGlobalUI(cache);
        if (cache.username) loadUserSpreadsheetData(cache.username);
    }

    try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const data = userSnap.data();
            const sessionToken = JSON.parse(localStorage.getItem('session_token') || '{}');
            const username = data.username || sessionToken.username;

            const uiData = {
                uid: user.uid,
                name: data.nome || data.username || username,
                role: data.funcao || 'Colaborador',
                photoUrl: data.photoUrl,
                points: data.pontos || 0,
                username: username
            };

            // --- TEMPORARY FRONTEND OVERRIDE (MANTIDO) ---
            const lowerName = (uiData.name || "").toLowerCase();
            if (lowerName.includes('evelyn')) uiData.points = 7;
            else if (lowerName.includes('ryan')) uiData.points = 5;
            // ----------------------------------------------

            updateGlobalUI(uiData);
            localStorage.setItem('user_cache', JSON.stringify(uiData));

            if (username) loadUserSpreadsheetData(username);
        }
    } catch (error) {
        console.error("Erro ao carregar dados do Firestore:", error);
    }
}

async function loadUserSpreadsheetData(username) {
    if (!username) return;
    try {
        const responseData = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'buscar_dados_usuario',
                user_name: username
            })
        });
        const resultData = await responseData.json();
        if (resultData.success && resultData.userData) {
            updateSpreadsheetUI(resultData.userData);
        }

        // Carrega Lançamentos (Extrato)
        const responseLanc = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'listar_lancamentos_usuario',
                user_name: username
            })
        });
        const resultLanc = await responseLanc.json();
        if (resultLanc.success && resultLanc.lancamentos) {
            updateTransactionsUI(resultLanc.lancamentos);
        }
    } catch (error) {
        console.warn("Erro sincronização planilha:", error);
    }
}

function updateTransactionsUI(lancamentos) {
    const container = document.getElementById('lancamentos-container') ||
        document.getElementById('movements-list') ||
        document.getElementById('app-extract-list');
    if (!container) return;

    container.innerHTML = '';

    if (lancamentos.length === 0) {
        container.innerHTML = '<div class="text-center py-6 text-gray-400 font-medium text-xs">Sem lançamentos na planilha.</div>';
        return;
    }

    let totIn = 0;
    let totOut = 0;

    lancamentos.forEach(item => {
        const valor = parseFloat(item.valor) || 0;
        if (valor >= 0) totIn += valor;
        else totOut += Math.abs(valor);

        const isEntrada = valor >= 0;
        const iconBg = isEntrada ? 'bg-gray-50' : 'bg-gray-50'; // Seguindo UI neutra solicitada
        const iconColor = 'text-gray-600';
        const iconClass = isEntrada ? 'bx-trending-up' : 'bx-trending-down';

        // Formatação de Data DD/MM/AAAA
        let dataDisplay = item.data;
        if (typeof dataDisplay === 'string' && dataDisplay.includes('T')) {
            const d = new Date(dataDisplay);
            dataDisplay = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
        }

        const html = `
        <div class="finance-card p-4 flex items-center justify-between w-full bg-white shadow-sm border border-gray-50 rounded-2xl mb-2">
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-full ${iconBg} flex items-center justify-center ${iconColor}">
                     <i class='bx ${iconClass} text-xl'></i>
                </div>
                <div>
                    <h3 class="text-sm font-bold text-gray-800">${item.descricao || 'Lançamento'}</h3>
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">${dataDisplay}</span>
                        ${item.autorizado ? `<span class="text-[10px] text-gray-300 font-medium italic">| Por ${item.autorizado}</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="text-right">
                <span class="text-sm font-bold ${isEntrada ? 'text-gray-800' : 'text-gray-800'} block">
                    ${valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
            </div>
        </div>`;
        container.insertAdjacentHTML('beforeend', html);
    });

    // Atualiza Totais se existirem os elementos (comum em extrato.html)
    const tInEl = document.getElementById('total-in');
    const tOutEl = document.getElementById('total-out');
    if (tInEl) tInEl.innerText = `+ ${totIn.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
    if (tOutEl) tOutEl.innerText = `- ${totOut.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
}

function updateSpreadsheetUI(data) {
    const els = {
        nextDate: document.getElementById('user-next-payment-date'),
        nextValue: document.getElementById('user-next-payment-value'),
        walletBalance: document.getElementById('wallet-balance'),
        points: document.getElementById('user-points')
    };

    if (els.nextDate) {
        let dateStr = data.next_payment_data || '--/--/----';
        // Se vier no formato ISO do Google (ex: 2026-03-05T03:00:00.000Z), converte para DD/MM/YYYY
        if (dateStr.includes('T') && !isNaN(Date.parse(dateStr))) {
            const d = new Date(dateStr);
            const day = String(d.getUTCDate()).padStart(2, '0');
            const month = String(d.getUTCMonth() + 1).padStart(2, '0');
            const year = d.getUTCFullYear();
            dateStr = `${day}/${month}/${year}`;
        }
        els.nextDate.innerText = dateStr;
        els.nextDate.classList.remove('skeleton');
    }
    if (els.nextValue) {
        const val = parseFloat(data.next_payment_value) || 0;
        els.nextValue.innerText = val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        els.nextValue.classList.remove('skeleton');
    }

    // Sincroniza Pontos da Planilha (Prioridade)
    if (els.points && data.points !== undefined) {
        const pts = parseFloat(data.points) || 0;
        els.points.innerText = pts.toFixed(2).replace('.', ',');
        els.points.classList.remove('skeleton');
    }

    // Sincroniza Cargo/Função
    const roleEl = document.getElementById('user-role-display') || document.getElementById('user-role');
    if (roleEl && data.function) {
        roleEl.innerText = data.function.charAt(0).toUpperCase() + data.function.slice(1);
    }

    if (els.walletBalance) {
        const val = parseFloat(data.balance) || 0;
        els.walletBalance.innerText = val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        els.walletBalance.classList.remove('skeleton');
    }

    // Foto da Planilha (Se disponível)
    const userPhoto = document.getElementById('user-profile-img') || document.getElementById('user-photo');
    if (userPhoto && data.photo_url && data.photo_url.includes('http')) {
        userPhoto.src = data.photo_url;
    }
}

function updateGlobalUI(data) {
    if (!data.name) return;
    const namePart = data.name.split(' ')[0];
    const firstName = namePart.charAt(0).toUpperCase() + namePart.slice(1);

    const els = {
        greeting: document.getElementById('user-greeting') || document.getElementById('user-full-name') || document.getElementById('user-greeting-name'),
        role: document.getElementById('user-role-display') || document.getElementById('user-role'),
        photo: document.getElementById('user-photo-display') || document.getElementById('user-photo') || document.getElementById('user-profile-img'),
        points: document.getElementById('user-points')
    };

    if (els.greeting) {
        if (els.greeting.id === 'user-greeting-name') els.greeting.innerText = firstName;
        else els.greeting.innerText = `Olá, ${firstName}!`;
    }
    if (els.role) els.role.innerText = data.role;
    if (els.photo) {
        if (data.photoUrl && data.photoUrl.includes('http')) {
            els.photo.src = data.photoUrl;
        } else {
            const letter = firstName.charAt(0).toUpperCase();
            els.photo.src = `https://placehold.co/150/d60039/FFFFFF?text=${letter}`;
        }
    }
    if (els.points) {
        const pts = Number(data.points) || 0;
        els.points.innerText = pts.toFixed(2).replace('.', ',');
        els.points.classList.remove('skeleton');
    }
}

// 5. Menu Highlight
function highlightCurrentMenu() {
    const currentPage = window.location.pathname.split("/").pop();
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        const onclickAttr = item.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes(currentPage)) {
            item.classList.add('active');
        }
    });
}

// 6. Timer de Sessão Visual
function createSessionTimer() {
    let div = document.getElementById('last-update-indicator');
    if (!div) {
        div = document.createElement('div');
        div.id = 'last-update-indicator';
        div.style.cssText = 'position: fixed; bottom: 15px; right: 15px; font-size: 11px; color: #4B5563; z-index: 9999; font-family: Inter, sans-serif; background: rgba(255, 255, 255, 0.9); padding: 4px 8px; border-radius: 4px; border: 1px solid #E5E7EB; pointer-events: none;';
        document.body.appendChild(div);
    }

    const updateTimer = () => {
        const tokenString = localStorage.getItem('session_token');
        if (!tokenString) {
            div.innerText = "Sessão não detectada";
            return;
        }
        try {
            const token = JSON.parse(tokenString);
            const now = new Date().getTime();
            const diff = token.expires - now;
            if (diff <= 0) {
                div.innerText = "Sessão expirada";
                div.style.color = "red";
                window.logoutApp();
            } else {
                const totalSeconds = Math.floor(diff / 1000);
                const min = Math.floor(totalSeconds / 60);
                const sec = totalSeconds % 60;
                div.innerText = `Sessão expira em ${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
            }
        } catch (e) {
            div.innerText = "Erro no timer";
        }
    };
    updateTimer();
    setInterval(updateTimer, 1000);
}

// 7. Função Global de Logout
window.logoutApp = function () {
    const isAdminArea = window.location.pathname.includes('/adm/nb/');
    const redirectUrl = isAdminArea ? "/users/e-finance.html" : "/login.html";

    localStorage.removeItem('user_cache');
    localStorage.removeItem('session_token');
    Object.keys(localStorage).forEach(key => { if (key.startsWith('acc_cache_')) localStorage.removeItem(key); });

    signOut(auth).finally(() => {
        window.location.href = redirectUrl;
    });
};