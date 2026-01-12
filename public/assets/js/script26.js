/**
 * --- CONFIGURAÇÕES DE API (INTEGRAÇÃO COM GOOGLE SHEETS) ---
 * Baseado no código doGet(e) fornecido.
 */
const BASE_API = "https://script.google.com/macros/s/AKfycby8x6--ITfvIW7ui6c24reBqzL3LUhqL30hf4-gaJCS0xB0EDPM50TcSji_W-IuNU33/exec";

const API_URLS = {
    PAGINA_1: `${BASE_API}?pagina=1`, // Saldo e A Receber
    PAGINA_2: `${BASE_API}?pagina=2`, // Faturamento, Lucro, Ticket, Clientes
    PAGINA_3: `${BASE_API}?pagina=3`, // Metas e Tickets específicos
    BILLS: "https://script.google.com/macros/s/AKfycbzkAs8dsJMepkQBhdL--XwO3wUQuQgvA-DFPEwraiz8ijiX9gkPMBuAeM5udQjzmJvzqQ/exec?action=getContas"
};

/**
 * --- SEGURANÇA E AUTENTICAÇÃO ---
 */
(function checkAuth() {
    const tokenString = localStorage.getItem('session_token');
    const LOGIN_URL = '/users/e-finance.html';
    if (!tokenString) {
        if (!window.location.pathname.includes('e-finance.html')) {
            window.location.href = LOGIN_URL;
        }
        return;
    }
    try {
        const token = JSON.parse(tokenString);
        if (new Date().getTime() > token.expires) {
            localStorage.removeItem('session_token');
            window.location.href = LOGIN_URL;
        }
    } catch (e) {
        window.location.href = LOGIN_URL;
    }
})();

/**
 * --- VARIÁVEIS DE ESTADO ---
 */
let isFaturamentoActive = true;
let holdTimer = null;
const holdDuration = 1200;
let currentDueIndex = 0;
let dashboardContas = [];

// Estado do Saldo
let valor1Original = '';
let valor2Original = '';
let isBalanceVisible = localStorage.getItem('balanceVisible') === 'true';

/**
 * --- SISTEMA DE NAVEGAÇÃO E RESPONSIVIDADE ---
 */
/* --- SUBSTITUA NO SEU ARQUIVO script26.js --- */

function toggleSidebar() {
    const html = document.documentElement;
    const isMin = html.getAttribute('data-minimized') === 'true';
    const newState = !isMin;

    // Atualiza o estado global
    html.setAttribute('data-minimized', newState);

    // Sincroniza classe no body (opcional, mas bom para garantir)
    document.body.classList.toggle('sidebar-collapsed', newState);

    // CORREÇÃO: Busca o SVG dentro do botão, independente de ID
    const btn = document.querySelector('.btn-toggle-sidebar');
    const icon = btn ? btn.querySelector('svg') : document.getElementById('toggle-icon');

    if (icon) {
        // Rotaciona a seta: 180deg (fechado/esquerda) ou 0deg (aberto/direita)
        icon.style.transform = newState ? 'rotate(0deg)' : 'rotate(180deg)';
        icon.style.transition = 'transform 0.5s ease';
    }

    // Aguarda a transição do CSS (0.5s) para recalcular o marcador
    setTimeout(updateNavMarker, 500);
}

function updateNavMarker() {
    // Busca o item ativo e o container da navbar
    const activeItem = document.querySelector('.nav-item.active');
    const navContainer = document.querySelector('.nav-container');

    if (!activeItem || !navContainer) return;

    const navRect = navContainer.getBoundingClientRect();
    const elRect = activeItem.getBoundingClientRect();
    const isDesktop = window.innerWidth >= 1024;

    if (!isDesktop) {
        // MOBILE: Mantém lógica original (Eixo X)
        // Precisamos pegar o container relativo correto no mobile (nav-overlay ou container)
        const navOverlay = document.getElementById('nav-overlay');
        const mobileRect = navOverlay ? navOverlay.getBoundingClientRect() : navRect;

        const centerX = elRect.left + elRect.width / 2 - mobileRect.left;
        // Ajuste fino para centralizar a bolinha
        document.body.style.setProperty('--marker-x', (centerX / mobileRect.width * 100) + '%');
        document.body.style.setProperty('--marker-y', '0px'); // Reseta Y no mobile
    } else {
        // DESKTOP: Lógica ajustada para nova Sidebar (Eixo Y)

        // O cálculo é: (Topo do Item) + (Metade da Altura do Item) - (Topo da Navbar)
        // Isso centraliza o marcador exatamente no meio do ícone/texto
        const centerY = elRect.top + (elRect.height / 2) - navRect.top;

        document.body.style.setProperty('--marker-y', `${centerY}px`);

        // Garante que o marcador fique na esquerda (dentro da sidebar)
        document.body.style.removeProperty('--marker-x');
    }
}

window.addEventListener('resize', updateNavMarker);

function setViewMode(mode) {
    document.documentElement.setAttribute('data-view', mode);
    setTimeout(updateNavMarker, 550);
}

/**
 * --- LÓGICA DE COLETA DE DADOS (PÁGINA 1: SALDO) ---
 */
async function fetchBalanceData() {
    const v1El = document.getElementById('valor1');
    const v2El = document.getElementById('valor2');
    if (!v1El) return;

    try {
        const response = await fetch(API_URLS.PAGINA_1);
        const data = await response.json();

        // Armazena valores formatados vindos da API
        valor1Original = data.valor1;
        valor2Original = data.valor2;

        // Valor 3 (Crédito a Receber)
        const credVal = document.getElementById('cred-val');
        if (credVal && data.valor3 !== undefined) {
            // Assume que vem formatado como os outros, se não adicione 'R$'
            // O user não especificou formato, mas valor1 vem formatado.
            credVal.innerText = data.valor3;
        }

        applyBalanceVisibility();
    } catch (e) {
        console.error("Erro ao coletar saldo:", e);
    }
}

function applyBalanceVisibility() {
    const v1El = document.getElementById('valor1');
    const v2El = document.getElementById('valor2');
    const toggleIcon = document.getElementById('toggle-balance-icon');

    if (!v1El) return;

    if (isBalanceVisible) {
        v1El.textContent = valor1Original;
        v2El.textContent = valor2Original;
        if (toggleIcon) toggleIcon.className = 'bx bx-eye';
    } else {
        v1El.textContent = 'R$ *******';
        v2El.textContent = 'R$ ********';
        if (toggleIcon) toggleIcon.className = 'bx bx-eye-closed';
    }
}

/**
 * --- LÓGICA DE DASHBOARD (PÁGINA 2: OPERACIONAL) ---
 */
async function fetchDashboardOperational() {
    try {
        const response = await fetch(API_URLS.PAGINA_2);
        const data = await response.json();

        // 1. Processa Faturamento (Separa Inteiro de Decimal para o design)
        if (data.faturamentoDate) {
            const cleanVal = data.faturamentoDate.replace('R$', '').trim();
            const parts = cleanVal.split(',');

            const intEl = document.getElementById('fat-int');
            const decEl = document.getElementById('fat-dec');

            if (intEl) intEl.innerText = `R$ ${parts[0]}`;
            if (decEl) decEl.innerText = `,${parts[1] || '00'}`;
        }



    } catch (e) { console.error("Erro operacional:", e); }
}

// Busca Contas (Carousel)
async function fetchBills() {
    try {
        const response = await fetch(API_URLS.BILLS);
        const data = await response.json();
        if (data && data.length > 0) {
            // Filtro: Apenas venciadas há no máx 1 dia ou vencem em até 7 dias
            const filtered = data.filter(conta => {
                if (conta.status === 'pago') return false;

                const target = parseDateBR(conta.vencimento);
                target.setHours(0, 0, 0, 0);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const diff = target - today;
                const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                conta._days = days;

                return days >= -1 && days <= 7;
            });

            // Ordena: Mais próximos primeiro
            filtered.sort((a, b) => a._days - b._days);

            // Soma Total
            const total = filtered.reduce((acc, c) => acc + parseFloat(c.valor), 0);

            dashboardContas = filtered.slice(0, 8);
            renderBillsCarousel(total); // Passa o total
        }
    } catch (e) { console.error("Erro contas:", e); }
}

// Função Auxiliar de Data
function parseDateBR(str) {
    if (!str) return new Date();
    const parts = str.split('/');
    return new Date(parts[2], parts[1] - 1, parts[0]);
}

function getBillsStatus(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = parseDateBR(dateStr);
    target.setHours(0, 0, 0, 0);
    const diffTime = target - today;
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (days < 0) return { text: `Vencida há ${Math.abs(days)} dias`, color: 'text-red-600', bg: 'bg-red-50' };
    if (days === 0) return { text: 'Vence hoje', color: 'text-red-600', bg: 'bg-red-50' };
    if (days === 1) return { text: 'Vence amanhã', color: 'text-orange-500', bg: 'bg-orange-50' };
    if (days <= 3) return { text: `Vence em ${days} dias`, color: 'text-orange-500', bg: 'bg-orange-50' };
    return { text: `Vence em ${days} dias`, color: 'text-green-600', bg: 'bg-green-50' };
}

function renderBillsCarousel(totalVal = 0) {
    const container = document.getElementById('due-carousel');
    if (!container) return;

    container.innerHTML = dashboardContas.map((conta, idx) => {
        const status = getBillsStatus(conta.vencimento);
        return `
        <div class="carousel-item ${idx === 0 ? 'active' : ''}">
            <div class="flex flex-col items-start text-left">
                <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-tight">${conta.descricao}</span>
                <span class="text-xl font-bold text-gray-800">R$ ${parseFloat(conta.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div class="flex items-center gap-4">
                <span class="text-[9px] ${status.color} font-extrabold px-2 py-1 ${status.bg} rounded-lg uppercase">${status.text}</span>
                <div class="action-btn" onclick="window.location.href='manager.html'" style="width: 28px; height: 28px; border-radius: 50%; background: #f3f4f6; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                    <i class='bx bx-plus text-gray-400'></i>
                </div>
            </div>
        </div>
    `}).join('') + `
        <div class="carousel-item" id="total-summary-item">
            <div class="flex flex-col items-center justify-center w-full">
                <span class="text-[10px] font-semibold text-white/70 uppercase tracking-widest mb-1">Contas a pagar essa semana</span>
                <div class="flex items-baseline" id="real-total-today">
                    <span class="text-2xl font-bold text-white">R$ ${totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
            </div>
        </div>
    `;
    startCarouselLogic();
}

function startHintCycle() {
    const hint = document.getElementById('interaction-hint');
    if (!hint) return;

    const runCycle = () => {
        hint.classList.add('show');
        setTimeout(() => {
            hint.classList.remove('show');
            setTimeout(runCycle, 45000); // 45s off
        }, 7000); // 7s on
    };

    // Inicia o ciclo após 45s ou imediato? O pedido diz "a cada 45s exibir".
    // Vou iniciar com delay de 45s para não incomodar na entrada.
    setTimeout(runCycle, 45000);
}

/**
 * --- LÓGICA DE MÉTRICAS (PÁGINA 2 E 3) ---
 */
async function fetchMetricsPageData() {
    try {
        const res2 = await fetch(API_URLS.PAGINA_2);
        const data2 = await res2.json();

        // Atualiza KPIs de Métricas com dados REAIS da planilha
        const fatEl = document.getElementById('kpi-faturamento');
        const ticketEl = document.getElementById('kpi-ticket');
        const lucroEl = document.getElementById('kpi-lucro');
        const nfceEl = document.getElementById('kpi-nfce-val');

        if (fatEl) fatEl.innerText = data2.faturamentoDate;
        if (ticketEl) ticketEl.innerText = data2.ticketLJDate;
        if (lucroEl) lucroEl.innerText = data2.lucroDate;
        if (nfceEl) nfceEl.innerText = data2.movCardDate;

        const nfceQty = document.getElementById('kpi-nfce-qtd');
        if (nfceQty) nfceQty.innerText = `${data2.clientesDate} atendimentos`;

    } catch (e) { console.error("Erro ao carregar métricas:", e); }
}

/**
 * --- COMPONENTES UI (CARROSSEL, HOLD, NAV) ---
 */
function startCarouselLogic() {
    const card = document.getElementById('card-vencer');
    const items = document.querySelectorAll('#due-carousel .carousel-item');
    const dotPager = document.getElementById('dot-pager');
    if (!dotPager || items.length === 0) return;

    dotPager.innerHTML = Array.from({ length: items.length }).map((_, i) => `<div class="dot ${i === 0 ? 'active' : ''}"></div>`).join('');

    setInterval(() => {
        const oldItem = items[currentDueIndex];
        if (oldItem) { oldItem.classList.add('exit'); oldItem.classList.remove('active'); setTimeout(() => oldItem.classList.remove('exit'), 1000); }
        currentDueIndex = (currentDueIndex + 1) % items.length;
        const newItem = items[currentDueIndex];
        if (newItem) {
            newItem.classList.add('active');
            if (newItem.id === 'total-summary-item') card.classList.add('total-active');
            else card.classList.remove('total-active');
        }
        const dots = dotPager.querySelectorAll('.dot');
        dots.forEach((d, idx) => d.classList.toggle('active', idx === currentDueIndex));
    }, 5000);
}

function startHold() {
    const toggle = document.getElementById('main-toggle');
    if (!toggle) return;
    toggle.classList.add('is-holding');
    document.getElementById('thumb').style.left = isFaturamentoActive ? '60px' : '4px';
    holdTimer = setTimeout(() => { toggleDashboard(); endHold(); }, holdDuration);
}

function endHold() {
    if (holdTimer) clearTimeout(holdTimer);
    const toggle = document.getElementById('main-toggle');
    if (toggle) {
        toggle.classList.remove('is-holding');
        document.getElementById('thumb').style.left = '';
    }
}

function toggleDashboard() {
    isFaturamentoActive = !isFaturamentoActive;
    const widget = document.getElementById('main-toggle');
    if (!widget) return;
    widget.classList.toggle('swapped', !isFaturamentoActive);
    document.getElementById('fat-section')?.classList.toggle('section-disabled', !isFaturamentoActive);
    document.getElementById('cred-section')?.classList.toggle('section-disabled', isFaturamentoActive);
}

function navigateShortcut(elementId, targetUrl) {
    const btn = document.getElementById(elementId);
    if (!btn) return;
    btn.classList.add('animating');
    setTimeout(() => { btn.classList.remove('animating'); window.location.href = targetUrl; }, 600);
}

/**
 * --- INICIALIZAÇÃO ---
 */
window.onload = () => {
    updateNavMarker();

    // Evento Olho do Saldo
    const toggleBalanceIcon = document.getElementById('toggle-balance-icon');
    if (toggleBalanceIcon) {
        toggleBalanceIcon.addEventListener('click', () => {
            isBalanceVisible = !isBalanceVisible;
            localStorage.setItem('balanceVisible', isBalanceVisible);
            applyBalanceVisibility();
        });
    }

    // Identificação de Página e Disparo de Dados REAIS
    if (document.getElementById('valor1')) {
        fetchBalanceData(); // Página 1
    }

    if (document.getElementById('fat-int')) {
        fetchBills(); // API de Contas
        fetchDashboardOperational(); // Página 2
        fetchDashboardOperational(); // Página 2
        startHintCycle();
    }

    if (document.getElementById('period-select')) {
        fetchMetricsPageData(); // Página 2
    }
};