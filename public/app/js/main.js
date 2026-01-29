import { auth } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', async () => {

    // 1. Check Auth & Data Availability
    const userDataRaw = localStorage.getItem('APP_USER_DATA');

    // Simple check: if no data or no auth logic satisfied (we can check auth.currentUser but it might load async)
    // We rely on localStorage for instant render, and Firebase Auth for security (async check below)

    if (!userDataRaw) {
        console.warn("No user data found. Redirecting to login...");
        window.location.href = 'access.html';
        return;
    }

    const userData = JSON.parse(userDataRaw);

    // 2. Render User Info (Instant)
    renderUserInfo(userData);

    // 3. Apply Permissions (Feature Flags)
    applyPermissions(userData.permissions || {});

    // 4. Inject API Configuration globally for script26.js
    if (userData.api_config) {
        window.USER_API_CONFIG = userData.api_config;
        console.log("Custom API Config injected.");
    } else {
        console.warn("No API Config found in user data. Legacy script might fail or use defaults.");
    }

    // 5. Load Legacy Logic (script26.js)
    loadLegacyScript();

    // 6. Handle Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            auth.signOut().then(() => {
                // Clear App Data
                localStorage.removeItem('APP_USER_DATA');
                localStorage.removeItem('session_token');

                // Clear Legacy Cache (Critical for preventing data bleed)
                localStorage.removeItem('user_cache');
                localStorage.removeItem('dashboard_ops');
                localStorage.removeItem('bills_data');
                localStorage.removeItem('movements_data');
                localStorage.removeItem('extract_data');

                window.location.href = 'access.html';
            });
        });
    }
    // 7. Reveal Dashboard
    const appContainer = document.getElementById('app-container');
    if (appContainer) {
        // Small delay to allow bold fonts/layout to settle
        setTimeout(() => {
            appContainer.classList.remove('opacity-0');
            appContainer.classList.add('opacity-100');
        }, 100);
    }
});

function renderUserInfo(user) {
    const nameEl = document.getElementById('user-name-display');
    const welcomeEl = document.getElementById('welcome-user-name');
    const roleEl = document.getElementById('user-role-display');
    const photoEl = document.getElementById('user-photo-display');

    if (nameEl && user.nome) nameEl.textContent = `Olá, ${user.nome.split(' ')[0]}!`;
    if (welcomeEl && user.nome) welcomeEl.textContent = user.nome.split(' ')[0];
    if (roleEl) roleEl.textContent = user.funcao || 'Colaborador';
    if (photoEl && user.photoUrl) photoEl.src = user.photoUrl;
}

function applyPermissions(permissions) {
    // Feature: Graphs
    if (permissions.graphs === false) {
        const graphs = document.querySelectorAll('[data-feature="graphs"]');
        graphs.forEach(el => el.classList.add('hidden'));
    } else {
        const graphs = document.querySelectorAll('[data-feature="graphs"]');
        graphs.forEach(el => el.classList.remove('hidden-feature', 'hidden'));
    }

    // Feature: Shortcuts
    if (permissions.shortcuts === false) {
        const shortcuts = document.querySelectorAll('[data-feature="shortcuts"]');
        shortcuts.forEach(el => el.classList.add('hidden'));
    } else {
        const shortcuts = document.querySelectorAll('[data-feature="shortcuts"]');
        shortcuts.forEach(el => el.classList.remove('hidden-feature', 'hidden'));
    }
}

function loadLegacyScript() {
    const script = document.createElement('script');
    script.src = '/assets/js/script26.js';
    script.async = true;
    document.body.appendChild(script);
}
