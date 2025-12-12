// ============================================================
// SISTEMA DE SEGURANÇA E UI GLOBAL
// ============================================================

const TOKEN_KEY = 'caixaToken';
const TOKEN_EXPIRATION_KEY = 'caixaTokenExpiration';
const TOKEN_DURATION_HOURS = 20;

// Elementos Globais
const loadingOverlay = document.getElementById('loading-overlay');
const mainContent = document.getElementById('main-content');
const openCaixaModal = document.getElementById('open-caixa-modal');
const headerCloseCaixaBtn = document.getElementById('header-close-caixa-btn');

// 1. Funções de Token
window.salvarToken = () => {
    const now = Date.now();
    const expirationTime = now + (TOKEN_DURATION_HOURS * 60 * 60 * 1000);
    localStorage.setItem(TOKEN_KEY, `caixaAberto_${now}`);
    localStorage.setItem(TOKEN_EXPIRATION_KEY, expirationTime.toString());
    console.log("Token salvo com sucesso.");
};

window.verificarToken = () => {
    const token = localStorage.getItem(TOKEN_KEY);
    const expiration = localStorage.getItem(TOKEN_EXPIRATION_KEY);
    const now = Date.now();

    if (token && expiration && now < parseInt(expiration)) {
        return true;
    } else {
        // Token inválido ou expirado
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(TOKEN_EXPIRATION_KEY);
        return false;
    }
};

window.limparToken = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRATION_KEY);
};

// 2. Controle de Interface (Bloqueio/Desbloqueio)
window.bloquearSistema = (mensagem = "Abertura de caixa necessária.") => {
    // 1. Ativa o Overlay de Fundo
    if (loadingOverlay) {
        loadingOverlay.classList.remove('hidden');
        
        // CORREÇÃO VISUAL:
        // Se formos abrir o modal de caixa, escondemos o spinner/texto do fundo para não poluir
        // Se for apenas um bloqueio genérico, mostramos a mensagem
        const msgEl = document.getElementById('loading-message');
        const spinnerIcon = loadingOverlay.querySelector('i');
        
        if (openCaixaModal) {
            // Se o modal vai abrir, limpa o fundo (deixa só branco)
            if (msgEl) msgEl.style.display = 'none';
            if (spinnerIcon) spinnerIcon.style.display = 'none';
        } else {
            // Bloqueio normal com mensagem
            if (msgEl) {
                msgEl.style.display = 'block';
                msgEl.textContent = mensagem;
            }
            if (spinnerIcon) spinnerIcon.style.display = 'block';
        }
    }

    if (mainContent) mainContent.style.display = 'none';
    
    // 2. Abre o Modal de Caixa por cima de tudo (agora com z-index corrigido no CSS)
    if (openCaixaModal && !openCaixaModal.classList.contains('active')) {
        openCaixaModal.classList.add('active');
        
        // Foca no primeiro campo input para facilitar
        setTimeout(() => {
            const inputNotas = document.getElementById('open-caixa-notas');
            if(inputNotas) inputNotas.focus();
        }, 100);
    }
}; 


window.liberarSistema = () => {
    // Esconde o overlay de carregamento
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
    
    // Mostra o conteúdo principal
    if (mainContent) mainContent.style.display = 'block';
    
    // Fecha modal de caixa se estiver aberto
    if (openCaixaModal) openCaixaModal.classList.remove('active');
    
    // Mostra botão de fechar caixa
    if (headerCloseCaixaBtn) headerCloseCaixaBtn.style.display = 'inline-flex';
};

// 3. Inicialização Global
document.addEventListener('DOMContentLoaded', () => {
    // Relógio
    const updateClock = () => {
        const el = document.getElementById('horario');
        if (el) {
            const date = new Date();
            const pad = (n) => n < 10 ? '0' + n : n;
            el.textContent = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
        }
    };
    setInterval(updateClock, 1000);
    updateClock();

    // Verificação Inicial de Segurança
    // Só roda se estiver na página principal (pdv) para evitar loops em outras páginas
    if (document.getElementById('pdv-page-identifier')) { 
        if (window.verificarToken()) {
            console.log("Sistema liberado via token.");
            window.liberarSistema();
        } else {
            console.log("Sistema bloqueado. Aguardando abertura.");
            window.bloquearSistema();
        }
    }
});