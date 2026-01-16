/**
 * --- CONFIGURAÇÕES DE API (INTEGRAÇÃO COM GOOGLE SHEETS) ---
 * Baseado no código doGet(e) fornecido.
 */
const BASE_API = "https://script.google.com/macros/s/AKfycby8x6--ITfvIW7ui6c24reBqzL3LUhqL30hf4-gaJCS0xB0EDPM50TcSji_W-IuNU33/exec";

const API_URLS = {
    PAGINA_1: `${BASE_API}?pagina=1`, // Saldo e A Receber
    PAGINA_2: `${BASE_API}?pagina=2`, // Faturamento, Lucro, Ticket, Clientes
    PAGINA_3: `${BASE_API}?pagina=3`, // Metas e Tickets específicos
    BILLS: "https://script.google.com/macros/s/AKfycbzkAs8dsJMepkQBhdL--XwO3wUQuQgvA-DFPEwraiz8ijiX9gkPMBuAeM5udQjzmJvzqQ/exec?action=getContas",
    NFCE: "https://script.google.com/macros/s/AKfycbzB7dluoiNyJ4XK6oDK_iyuKZfwPTAJa4ua4RetQsUX9cMObgE-k_tFGI82HxW_OyMf/exec"
};

/**
 * --- SEGURANÇA E AUTENTICAÇÃO ---
 */
(function checkAuth() {
    const tokenString = localStorage.getItem('session_token');
    const LOGIN_URL = '/login.html';
    if (!tokenString) {
        if (!window.location.pathname.includes('login.html')) {
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
// let isFaturamentoActive = true; // Moved to Tokens section
let holdTimer = null;
const holdDuration = 1200;
let currentDueIndex = 0;
let dashboardContas = [];

// Estado do Saldo
let valor1Original = '';
let valor2Original = '';
let faturamentoOriginal = '';
let faturamentoDecimalOriginal = '';
let creditoOriginal = '';
let lastBillsTotal = 0;
let movimentacoesData = [];
let carouselInterval = null;

// Tokens de Acessibilidade (Persistência)
let isBalanceVisible = localStorage.getItem('acc_privacy') === 'true'; // Token: acc_privacy
let isFaturamentoActive = localStorage.getItem('acc_summary') !== 'false'; // Token: acc_summary (Default true)

// Aplicar Navbar Token ao iniciar
const savedNavState = localStorage.getItem('acc_navbar'); // Token: acc_navbar
if (savedNavState !== null) {
    document.documentElement.setAttribute('data-minimized', savedNavState);
    if (savedNavState === 'true') document.body.classList.add('sidebar-collapsed');
}

/**
 * --- SISTEMA DE DADOS & CACHE (Smart Caching) ---
 */
const DataManager = {
    // Configurações
    STORAGE_PREFIX: 'acc_cache_',
    TTL: 1000 * 60 * 15, // 15 Minutos de validade "fresca" (depois disso, força skeleton se network falhar?)
    // Na lógica Stale-While-Revalidate, sempre tentamos mostrar o cache primeiro.

    get: function (key) {
        try {
            const raw = sessionStorage.getItem(this.STORAGE_PREFIX + key);
            if (!raw) return null;
            const item = JSON.parse(raw);
            return item.data;
        } catch (e) {
            console.error('[DataManager] Erro ao ler cache', e);
            return null;
        }
    },

    set: function (key, data) {
        try {
            const wrapper = {
                timestamp: new Date().getTime(),
                data: data
            };
            sessionStorage.setItem(this.STORAGE_PREFIX + key, JSON.stringify(wrapper));
        } catch (e) {
            console.error('[DataManager] Erro ao salvar cache (Quota excedida?)', e);
        }
    },

    /**
     * Busca dados com estratégia Stale-While-Revalidate.
     * 1. Retorna cache imediatamente (se existir).
     * 2. Busca na rede em background.
     * 3. Se rede retornar e for diferente do cache, chama callback de update.
     * 
     * @param {string} key Identificador único do dado (ex: 'balance_data')
     * @param {string} url URL da API
     * @param {function(data, isUpdate)} renderFn Callback para renderizar a UI. isUpdate=true indica que os dados chegaram depois (animação).
     */
    fetchSmart: async function (key, url, renderFn) {
        // 1. Tenta Cache
        const cached = this.get(key);
        let hasCache = false;

        if (cached) {
            console.log(`[DataManager] Renderizando ${key} via CACHE.`);
            hasCache = true;
            renderFn(cached, false); // false = Initial render, sem animação de mudança
        } else {
            console.log(`[DataManager] Sem cache para ${key}. Aguardando rede...`);
        }

        // 2. Network Fetch (Background)
        try {
            const response = await fetch(url);
            const newData = await response.json();

            // Compara para evitar render desnecessário
            const isDifferent = !cached || JSON.stringify(cached) !== JSON.stringify(newData);

            if (isDifferent) {
                console.log(`[DataManager] Novos dados recebidos para ${key}. Atualizando...`);
                this.set(key, newData);

                // Se não tinha cache, é render inicial (sem animação de 'mudança', apenas show).
                // Se tinha cache, é update (animação de 'mudança').
                renderFn(newData, hasCache);
            } else {
                console.log(`[DataManager] Dados de rede iguais ao cache para ${key}. Nada a fazer.`);
            }
        } catch (e) {
            console.error(`[DataManager] Falha na rede para ${key}`, e);
            // Se não tinha cache e rede falhou, precisamos avisar a UI para mostrar erro/vazio
            if (!hasCache) {
                // Opcional: renderFn(null, false) ou tratar erro
            }
        }
    }
};

/**
 * --- SISTEMA DE NAVEGAÇÃO E RESPONSIVIDADE ---
 */
/* --- SUBSTITUA NO SEU ARQUIVO script26.js --- */

function navigateTo(url) {
    if (document.startViewTransition) {
        document.startViewTransition(() => {
            window.location.href = url;
        });
    } else {
        window.location.href = url;
    }
}


function toggleSidebar() {
    const html = document.documentElement;
    const isMin = html.getAttribute('data-minimized') === 'true';
    const newState = !isMin;

    // Atualiza o estado global e salva Token
    html.setAttribute('data-minimized', newState);
    localStorage.setItem('acc_navbar', newState);

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
// Flag global para controlar a animação inicial
// Flag global para controlar a animação inicial
let isFirstNavUpdate = true;

function updateNavMarker() {
    // Busca o item ativo e o container da navbar
    const activeItem = document.querySelector('.nav-item.active');
    const navContainer = document.querySelector('.nav-container');

    if (!activeItem || !navContainer) return;

    const navRect = navContainer.getBoundingClientRect();
    const elRect = activeItem.getBoundingClientRect();
    const isDesktop = window.innerWidth >= 1024;

    const marker = document.querySelector('.nav-marker');

    if (!isDesktop) {
        // --- MOBILE LOGIC ---
        const navOverlay = document.getElementById('nav-overlay');
        const mobileRect = navOverlay ? navOverlay.getBoundingClientRect() : navRect;
        const centerX = elRect.left + elRect.width / 2 - mobileRect.left;
        const newXPercent = (centerX / mobileRect.width * 100);

        if (isFirstNavUpdate) {
            // LOAD INICIAL (Mobile)
            if (marker) {
                // 1. Desliga transição para posicionamento imediato
                marker.style.transition = 'none';

                // 2. Define posição X (CSS Variable)
                document.body.style.setProperty('--marker-x', newXPercent + '%');

                // 3. Define estado inicial da animação (pop-up vindo de baixo)
                // IMPORTANTE: Mantém translateX(-50%) do CSS base
                marker.style.transform = "translateX(-50%) translateY(60px)";

                // 4. Força Reflow
                void marker.offsetWidth;

                // 5. Anima entrada
                requestAnimationFrame(() => {
                    marker.style.transition = 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                    marker.style.transform = "translateX(-50%) translateY(0px)";
                });
            }
            isFirstNavUpdate = false;
        } else {
            // INTERAÇÃO (Troca de Aba ou Resize)
            const currentX = parseFloat(document.body.style.getPropertyValue('--marker-x') || '0');

            // Se mudou pouco, é resize -> ajusta direto sem pulo
            if (Math.abs(currentX - newXPercent) < 1) {
                document.body.style.setProperty('--marker-x', newXPercent + '%');
                // Garante que esteja visível (zerado Y)
                if (marker) marker.style.transform = "translateX(-50%) translateY(0px)";
                return;
            }

            // Se mudou muito, é troca de aba -> faz o pop-up
            if (marker) {
                // Desce (Esconde)
                marker.style.transform = "translateX(-50%) translateY(60px)";

                // Muda X e Sobe
                setTimeout(() => {
                    document.body.style.setProperty('--marker-x', newXPercent + '%');
                    marker.style.transform = "translateX(-50%) translateY(0px)";
                }, 200);
            } else {
                document.body.style.setProperty('--marker-x', newXPercent + '%');
            }
        }
        // Limpa propriedade desktop se existir
        document.body.style.removeProperty('--marker-y');

    } else {
        // --- DESKTOP LOGIC ---
        if (marker) {
            // Limpa transforms inline do mobile (left/top controlados pelo CSS desktop + var Y)
            marker.style.transform = "";

            if (isFirstNavUpdate) {
                marker.style.transition = 'none';
                void marker.offsetWidth; // Reflow
                requestAnimationFrame(() => marker.style.transition = '');
                isFirstNavUpdate = false;
            }
        }

        const centerY = elRect.top + (elRect.height / 2) - navRect.top;
        document.body.style.setProperty('--marker-y', `${centerY}px`);
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
/**
 * --- LÓGICA DE COLETA DE DADOS (PÁGINA 1: SALDO) ---
 */
function fetchBalanceData(forceUpdate = false) {
    // Se não tem os elementos na tela, nem busca (checa Saldo OU Ticket)
    if (!document.getElementById('valor1') && !document.getElementById('kpi-ticket')) return;

    DataManager.fetchSmart('balance_data', API_URLS.PAGINA_1, (data, isUpdate) => {
        // Função de renderização (chamada via Cache e depois via Rede)

        // 1. Armazena globais (para uso no toggle privacy)
        valor1Original = data.valor1;
        valor2Original = data.valor2;
        if (data.valor3 !== undefined) creditoOriginal = data.valor3;

        // 2. Se for UPDATE (dados mudaram no background), animar!
        if (isUpdate) {
            // Se a privacidade estiver ativa (visível), animamos os números na tela
            if (isBalanceVisible) {
                updateValueWithAnimation('valor1', valor1Original);
                updateValueWithAnimation('valor2', valor2Original);
                updateValueWithAnimation('cred-val', creditoOriginal);
            }
        } else {
            // Render Inicial (Cache ou First Load) -> Sem animação de contagem, apenas mostra.
            // Mas precisamos tirar o Skeleton SE ele estiver lá.
            toggleSkeleton(['valor1', 'valor2'], false, 'red');
            toggleSkeleton('cred-val', false);

            applyBalanceVisibility(); // Aplica texto seco
        }

        // Novos Campos (Valor4, Valor5) - Moved from Dashboard Ops
        // Valor6 e Valor7 (NFCe) vindos da API PAGINA_1
        const ticketEl = document.getElementById('kpi-ticket');
        const lucroEl = document.getElementById('kpi-lucro');
        const nfceValEl = document.getElementById('kpi-nfce-val');
        const nfceQtdEl = document.getElementById('kpi-nfce-qtd');

        if (ticketEl) ticketEl.innerText = data.valor4 || 'R$ 0,00';
        if (lucroEl) lucroEl.innerText = data.valor5 || 'R$ 0,00';
        // Valor 6 = Total NFCe (R$)
        if (nfceValEl) nfceValEl.innerText = data.valor6 || 'R$ 0,00';

        // Valor 7 = Quantidade NFCe (Remover R$ e decimais)
        if (nfceQtdEl) {
            let rawQtd = String(data.valor7 || '0');
            // Remove 'R$', espaços, e qualquer texto antes
            rawQtd = rawQtd.replace('R$', '').trim();
            // Se vier "9,00", pega só o "9"
            if (rawQtd.includes(',')) rawQtd = rawQtd.split(',')[0];
            nfceQtdEl.innerText = rawQtd + ' notas';
        }
    });

    // Se NÃO tiver cache, o DataManager não chamou o callback imediatamente.
    // Então mostramos Skeleton APENAS se não houver dados em cache.
    if (!DataManager.get('balance_data')) {
        toggleSkeleton(['valor1', 'valor2'], true, 'red');
        toggleSkeleton('cred-val', true);
    }
}

/* --- HELPERS DE ANIMAÇÃO NUMÉRICA --- */
function updateValueWithAnimation(elementId, newValueStr) {
    const el = document.getElementById(elementId);
    if (!el) return;

    // Helper: Extrai número de string "R$ 1.200,50" -> 1200.50
    const parseCurrency = (str) => {
        if (!str) return 0;
        return parseFloat(str.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;
    };

    const startVal = parseCurrency(el.innerText === 'R$ ***,**' ? '0' : el.innerText);
    const endVal = parseCurrency(newValueStr);

    if (startVal !== endVal) {
        animateValue(el, startVal, endVal, 1500, true);
    } else {
        el.innerText = newValueStr; // Garante formatação exata
    }
}

function animateValue(obj, start, end, duration, isCurrency = false) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);

        // Easing (easeOutOuad)
        // const ease = progress * (2 - progress); 
        const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic

        const currentVal = (progress * (end - start) + start);

        if (isCurrency) {
            obj.innerHTML = currentVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        } else {
            obj.innerHTML = Math.floor(currentVal);
        }

        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            // Finaliza com valor exato formatado (para evitar imprecisões de float na animação)
            if (isCurrency) obj.innerHTML = end.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            else obj.innerHTML = end;
        }
    };
    window.requestAnimationFrame(step);
}

/* --- SKELETON HELPERS --- */
function toggleSkeleton(ids, isLoading, extraClass = '') {
    if (!Array.isArray(ids)) ids = [ids];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (isLoading) {
                // Só adiciona skeleton se AINDA não tiver conteudo real visivel (evita flash reverso)
                // Mas aqui forçamos no inicio, entao ok.
                el.classList.add('skeleton');
                if (extraClass) el.classList.add(...extraClass.split(' '));
                el.innerText = '';
            } else {
                el.classList.remove('skeleton');
                if (extraClass) el.classList.remove(...extraClass.split(' '));
            }
        }
    });
}

function applyBalanceVisibility() {
    const v1El = document.getElementById('valor1');
    const v2El = document.getElementById('valor2');
    const fatInt = document.getElementById('fat-int');
    const fatDec = document.getElementById('fat-dec');
    const credVal = document.getElementById('cred-val');
    const toggleIcon = document.getElementById('toggle-balance-icon');

    if (isBalanceVisible) {
        if (v1El) v1El.textContent = valor1Original;
        if (v2El) v2El.textContent = valor2Original;
        if (fatInt) fatInt.innerText = faturamentoOriginal;
        if (fatDec) fatDec.innerText = faturamentoDecimalOriginal;
        if (credVal) credVal.innerText = creditoOriginal;

        if (toggleIcon) toggleIcon.className = 'bx bx-show';
    } else {
        if (v1El) v1El.textContent = 'R$ ***,**';
        if (v2El) v2El.textContent = 'R$ ***,**';
        // Mask Dashboard
        if (fatInt) fatInt.innerText = 'R$ ***';
        if (fatDec) fatDec.innerText = ',**';
        if (credVal) credVal.innerText = 'R$ ***,**';

        if (toggleIcon) toggleIcon.className = 'bx bx-hide';
    }

    // Atualiza Listas Dependentes
    renderBillsCarousel(lastBillsTotal);
    if (typeof renderMovements === 'function') renderMovements();
}

/**
 * --- LÓGICA DE DASHBOARD (PÁGINA 2: OPERACIONAL) ---
 */
/**
 * --- LÓGICA DE DASHBOARD (PÁGINA 2: OPERACIONAL) ---
 */
function fetchDashboardOperational(forceUpdate = false) {
    const intEl = document.getElementById('fat-int');
    const decEl = document.getElementById('fat-dec');

    // Se não tem cache e vai buscar, skeleton
    if (!DataManager.get('dashboard_ops') && intEl) {
        toggleSkeleton(['fat-int', 'fat-dec'], true);
    }

    DataManager.fetchSmart('dashboard_ops', API_URLS.PAGINA_2, (data, isUpdate) => {
        if (intEl) toggleSkeleton(['fat-int', 'fat-dec'], false);

        // 1. Processa Faturamento
        let newFaturamento = faturamentoOriginal;
        let newDecimal = faturamentoDecimalOriginal;

        if (data.faturamentoDate) {
            const cleanVal = data.faturamentoDate.replace('R$', '').trim();
            const parts = cleanVal.split(',');
            newFaturamento = `R$ ${parts[0]}`;
            newDecimal = `,${parts[1] || '00'}`;
        }

        // Se update, checar se mudou
        if (isUpdate) {
            // Animar mudança se privacy off
            // (Simplificação: apenas atualiza vars globais e rechama applyBalanceVisibility que lida com o display)
            faturamentoOriginal = newFaturamento;
            faturamentoDecimalOriginal = newDecimal;
            applyBalanceVisibility(); // Re-renderiza com novos valores
        } else {
            faturamentoOriginal = newFaturamento;
            faturamentoDecimalOriginal = newDecimal;
            applyBalanceVisibility();
        }
    });
}

// Busca Contas (Carousel)
function fetchBills(forceUpdate = false) {
    const container = document.getElementById('due-carousel');

    // Skeleton (apenas se não tiver cache)
    if (!DataManager.get('bills_data') && container) {
        container.innerHTML = `
            <div class="carousel-item active">
                <div class="flex flex-col items-start w-full">
                    <div class="skeleton" style="width: 50%; height: 10px; margin-bottom: 8px;"></div>
                    <div class="skeleton" style="width: 80%; height: 24px;"></div>
                </div>
            </div>`;
    }

    DataManager.fetchSmart('bills_data', API_URLS.BILLS, (data, isUpdate) => {
        if (data && data.length > 0) {
            // Filtro e Lógica de Dias (Reutilizando logica original)
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

            filtered.sort((a, b) => a._days - b._days);

            // Recalcula Total
            lastBillsTotal = filtered.reduce((acc, c) => acc + parseFloat(c.valor), 0);
            dashboardContas = filtered.slice(0, 8);

            // Renderiza
            renderBillsCarousel(lastBillsTotal);
        } else {
            if (container) container.innerHTML = `<div class="text-center text-xs text-gray-400 py-4">Nenhuma conta para vencer.</div>`;
        }
    });
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

    // Se não há contas filtered, mas a API retornou vazia antes, tratar
    if (dashboardContas.length === 0) return;

    container.innerHTML = dashboardContas.map((conta, idx) => {
        const status = getBillsStatus(conta.vencimento);
        const valorDisplay = isBalanceVisible
            ? `R$ ${parseFloat(conta.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            : 'R$ ***,**';

        return `
        <div class="carousel-item ${idx === 0 ? 'active' : ''}">
            <div class="flex flex-col items-start text-left">
                <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-tight">${conta.descricao}</span>
                <span class="text-xl font-bold text-gray-800">${valorDisplay}</span>
            </div>
            <div class="flex items-center gap-4">
                <span class="text-[9px] ${status.color} font-extrabold px-2 py-1 ${status.bg} rounded-lg uppercase">${status.text}</span>
                <div class="action-btn" onclick="navigateTo('manager.html')" style="width: 28px; height: 28px; border-radius: 50%; background: #f3f4f6; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                    <i class='bx bx-plus text-gray-400'></i>
                </div>
            </div>
        </div>
    `}).join('') + `
        <div class="carousel-item" id="total-summary-item">
            <div class="flex flex-col items-center justify-center w-full">
                <span class="text-[10px] font-semibold text-white/70 uppercase tracking-widest mb-1">Contas a pagar essa semana</span>
                <div class="flex items-baseline" id="real-total-today">
                    <span class="text-2xl font-bold text-white">
                        ${isBalanceVisible ? `R$ ${totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ ***,**'}
                    </span>
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
    setTimeout(runCycle, 45000);
}

/**
 * --- LÓGICA DE MÉTRICAS (PÁGINA 2 E 3) ---
 */
function fetchMetricsPageData() {
    // Legacy placeholder - substituido por fetchDashboardOperational se usado na home
}

/**
 * --- COMPONENTES UI (CARROSSEL, HOLD, NAV) ---
 */
function startCarouselLogic() {
    if (carouselInterval) clearInterval(carouselInterval);
    currentDueIndex = 0;

    const card = document.getElementById('card-vencer');
    const items = document.querySelectorAll('#due-carousel .carousel-item');
    const dotPager = document.getElementById('dot-pager');

    // Se não tiver itens, esconde pager ou não roda ciclo
    if (!dotPager || !items || items.length === 0) return;

    // Reset
    items.forEach((item, i) => {
        item.classList.toggle('active', i === 0);
        item.classList.remove('exit');
    });

    if (items[0] && items[0].id === 'total-summary-item') card?.classList.add('total-active');
    else card?.classList.remove('total-active');

    dotPager.innerHTML = Array.from({ length: items.length }).map((_, i) => `<div class="dot ${i === 0 ? 'active' : ''}"></div>`).join('');

    carouselInterval = setInterval(() => {
        const oldItem = items[currentDueIndex];
        if (oldItem) {
            oldItem.classList.add('exit');
            oldItem.classList.remove('active');
            setTimeout(() => oldItem.classList.remove('exit'), 1000);
        }

        currentDueIndex = (currentDueIndex + 1) % items.length;

        const newItem = items[currentDueIndex];
        if (newItem) {
            newItem.classList.add('active');
            if (newItem.id === 'total-summary-item') card?.classList.add('total-active');
            else card?.classList.remove('total-active');
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

    // Salva Token
    localStorage.setItem('acc_summary', isFaturamentoActive);
}

function navigateShortcut(elementId, targetUrl) {
    const btn = document.getElementById(elementId);
    if (!btn) return;
    btn.classList.add('animating');
    setTimeout(() => {
        btn.classList.remove('animating');
        navigateTo(targetUrl); // Usa o novo helper
    }, 600);
}

/**
 * --- INICIALIZAÇÃO ---
 */
/* --- AUTO REFRESH LOGIC --- */
/**
 * --- LÓGICA DE PERFIL DO USUÁRIO (NOVA) ---
 */
function loadUserProfile() {
    // Tenta carregar dados do usuário do cache (padrão antigo ou novo)
    let userData = null;

    // 1. Tenta user_cache (App Core Legacy)
    try {
        const cache = localStorage.getItem('user_cache');
        if (cache) userData = JSON.parse(cache);
    } catch (e) { console.error('Erro user_cache', e); }

    // 2. Se não funcionar, tenta session_token (pode ter dados limitados)
    if (!userData) {
        try {
            const token = JSON.parse(localStorage.getItem('session_token') || '{}');
            if (token.uid) {
                // Se só tiver o UID, tentamos defaults se não houver user_cache
                userData = {
                    name: token.name || 'Usuário',
                    role: token.role || 'Colaborador',
                    photoUrl: token.photoUrl || null
                };
            }
        } catch (e) { }
    }

    if (!userData) return;

    // Atualiza UI
    const elNameFull = document.getElementById('user-full-name');
    const elGreeting = document.getElementById('user-greeting-name');
    const elRole = document.getElementById('user-role-display');
    const elPhoto = document.getElementById('user-profile-img');

    const firstName = (userData.name || 'Visitante').split(' ')[0];

    if (elNameFull) elNameFull.innerText = `Olá, ${firstName}!`;
    if (elGreeting) elGreeting.innerText = firstName;
    if (elRole) elRole.innerText = userData.role || 'Colaborador';

    if (elPhoto) {
        if (userData.photoUrl && userData.photoUrl.startsWith('http')) {
            elPhoto.src = userData.photoUrl;
        } else {
            // Fallback com inicial
            const letter = firstName.charAt(0).toUpperCase();
            elPhoto.src = `https://placehold.co/150/db0038/FFFFFF?text=${letter}`;
        }
    }
}

function refreshCurrentPageData(force = false) {
    loadUserProfile();

    // Identificação de Página e Disparo de Dados REAIS
    if (document.getElementById('valor1') || document.getElementById('kpi-ticket')) {
        fetchBalanceData(force); // Página 1
    }

    if (document.getElementById('fat-int')) {
        fetchBills(force); // API de Contas
        fetchDashboardOperational(force); // Página 2
        fetchMovements(force); // Histórico de Movimentações
        startHintCycle();
        fetchRevenueChart(force); // Gráfico de Vendas (ApexCharts)
        fetchNFCeData(force); // Validação de XML
    }

    if (document.getElementById('chart-dots-group')) {
        updateMetricsDashboard(); // Inicia Dashboard de Métricas
    }

    if (document.getElementById('transaction-list')) {
        // Init Extrato Page
        // Use DataManager (Smart Fetch) logic internally
        if (!fullMetricsData) {
            fetchMetricsDashboardData(force);
        } else {
            // Se já tem dados, re-fetch para update em background
            fetchMetricsDashboardData(force);
        }
    }
}

/* --- AUTO REFRESH LOGIC (Stepped) --- */
const AUTO_REFRESH_DELAYS = [
    134000, // 2m 14s
    148000, // 2m 28s
    160000, // 2m 40s
    197000  // 3m 17s
];
let refreshStep = 0;

function scheduleAutoRefresh() {
    if (refreshStep >= AUTO_REFRESH_DELAYS.length) {
        showOutdatedWarning();
        return; // Stop updating
    }

    const delay = AUTO_REFRESH_DELAYS[refreshStep];
    console.log(`[AutoRefresh] Agendado para daqui a ${delay / 1000}s (Etapa ${refreshStep + 1}/${AUTO_REFRESH_DELAYS.length})`);

    setTimeout(() => {
        console.log('[AutoRefresh] Executando atualização...');
        refreshCurrentPageData(true); // Force check
        refreshStep++;
        scheduleAutoRefresh();
    }, delay);
}

function showOutdatedWarning() {
    if (document.getElementById('outdated-msg')) return;

    const div = document.createElement('div');
    div.id = 'outdated-msg';
    div.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0;
        background: #db0038; color: white;
        text-align: center; padding: 12px;
        font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600;
        z-index: 10000; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        display: flex; align-items: center; justify-content: center; gap: 8px;
        animation: slideDown 0.5s ease-out;
    `;
    div.innerHTML = `
        <i class='bx bx-error-circle text-lg'></i>
        <span>Parece que as informações estão desatualizadas, <a href="#" onclick="location.reload(); return false;" style="color: white; text-decoration: underline;">recarregue a página (F5)</a> para manter elas atualizadas.</span>
    `;

    // Inject animation style
    if (!document.getElementById('anim-slide-down')) {
        const style = document.createElement('style');
        style.id = 'anim-slide-down';
        style.innerHTML = `@keyframes slideDown { from { transform: translateY(-100%); } to { transform: translateY(0); } }`;
        document.head.appendChild(style);
    }

    document.body.appendChild(div);
}

window.onload = () => {
    // Page Entrance Animation (Removed in favor of View Transitions)
    // document.body.classList.add('page-loaded');

    updateNavMarker();

    // Evento Olho do Saldo
    const toggleBalanceIcon = document.getElementById('toggle-balance-icon');
    if (toggleBalanceIcon) {
        toggleBalanceIcon.addEventListener('click', () => {
            isBalanceVisible = !isBalanceVisible;
            localStorage.setItem('acc_privacy', isBalanceVisible); // Save Token
            applyBalanceVisibility();
        });
    }

    // 1. Initial Load (FORCE = FALSE). 
    // Se tiver cache, NÃO vai para a rede.
    refreshCurrentPageData(false);

    // 2. Start Stepped Auto-Refresh Sequence
    scheduleAutoRefresh();
};

/* --- FETCH MOVIMENTAÇÕES (Histórico) --- */
function fetchMovements(forceUpdate = false) {
    const list = document.getElementById('movements-list');
    if (!list) return;

    const url = "https://script.google.com/macros/s/AKfycbzd_UOW_Ei9nPxNwmJdEtX4q3XDXu_WWktWUvH70ooAFM8C1bB6r7m39E18vl5dRjDZ/exec";

    // Skeleton (apenas se não houver cache)
    if (!DataManager.get('movements_data')) {
        const skeletonRow = `
            <div class="flex items-center justify-between p-3 border-b border-gray-100">
                 <div class="flex items-center">
                     <div class="skeleton" style="width: 32px; height: 32px; border-radius: 50%; margin-right: 12px;"></div>
                     <div class="flex flex-col gap-1">
                         <div class="skeleton" style="width: 80px; height: 10px;"></div>
                         <div class="skeleton" style="width: 50px; height: 8px;"></div>
                     </div>
                 </div>
                 <div class="skeleton" style="width: 60px; height: 12px;"></div>
            </div>
        `;
        list.innerHTML = skeletonRow.repeat(3);
    }

    DataManager.fetchSmart('movements_data', url, (data, isUpdate) => {
        if (!data || data.length === 0) {
            list.innerHTML = `<div class="p-4 text-center text-xs text-gray-400">Nenhuma movimentação recente.</div>`;
            return;
        }

        // Ordenar por data decrescente (Mais recente primeiro)
        // Precisamos garantir que parseDate ou similar esteja disponivel ou usar logica de Date
        // Dados brutos podem vir como Strings "dd/mm/yyyy" ou ISO
        const sortFn = (a, b) => {
            const dateA = a.timestamp ? parseDateBR(a.timestamp) : new Date(0);
            const dateB = b.timestamp ? parseDateBR(b.timestamp) : new Date(0);
            return dateB - dateA;
        };

        // Copia para não mutar se for referencia cacheada direta
        // 1. First Reverse (Launch Order Old->New becomes New->Old)
        // 2. Then Sort by Date (Stable sort keeps relative order of reversed items for same day)
        const sortedData = [...data].reverse().sort(sortFn);

        // Armazena as 5 últimas movimentações globalmente
        movimentacoesData = sortedData.slice(0, 5);

        // Se for update, a renderMovements já substitui o HTML, o que é um "flash" aceitável para listas
        // Poderíamos animar fade-in, mas na lista é ok substituir.
        renderMovements();
        updateLastUpdateIndicator();
    });
}

function renderMovements() {
    const list = document.getElementById('movements-list');
    if (!list || movimentacoesData.length === 0) return;

    let html = '';
    movimentacoesData.forEach(item => {
        const type = item.type ? item.type.toLowerCase() : '';
        const isEntry = type.includes('entrada');
        const icon = isEntry ? 'bx-up-arrow-alt' : 'bx-down-arrow-alt';
        const iconBg = isEntry ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600';

        let val;
        if (isBalanceVisible) {
            val = parseFloat(item.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        } else {
            val = 'R$ ***,**';
        }

        html += `
        <div class="flex items-center justify-between p-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors fade-in">
            <div class="flex items-center">
                <div class="w-8 h-8 rounded-full flex items-center justify-center ${iconBg} mr-3">
                    <i class='bx ${icon} text-lg'></i>
                </div>
                <div class="text-left">
                    <p class="text-xs font-bold text-gray-800">${item.payment || 'Pagamento'}</p>
                    <p class="text-[9px] text-gray-400 font-bold uppercase">${item.timestamp || ''}</p>
                </div>
            </div>
            <span class="text-xs font-bold ${isEntry ? 'text-green-600' : 'text-red-600'}">${val}</span>
        </div>
        `;
    });
    list.innerHTML = html;
}

/* --- GRÁFICO DE VENDAS (ApexCharts) --- */
let revenueChartInstance = null; // Store instance globally

function fetchRevenueChart(forceUpdate = false) {
    const chartEl = document.getElementById('revenueChart');
    if (!chartEl) return;

    const CHART_API = 'https://script.google.com/macros/s/AKfycbzbeCWhW4cyixLvkvpYYpv1UK72CfLYQblJv8jWSPPSSHFzNehv0vW5vLjHZrua-qeMJg/exec';

    // Se não tem cache, mantém skeleton class
    if (DataManager.get('revenue_chart_data')) {
        chartEl.classList.remove('skeleton');
    }

    DataManager.fetchSmart('revenue_chart_data', CHART_API, (data, isUpdate) => {
        if (!data || data.length === 0) {
            chartEl.innerHTML = '<div class="flex items-center justify-center h-full text-xs text-red-300">Sem dados</div>';
            return;
        }

        chartEl.classList.remove('skeleton');

        // Helper para Data Segura
        const parseDateSafe = (d) => {
            const t = new Date(d);
            if (!isNaN(t)) return t;
            if (typeof parseDateBR === 'function') return parseDateBR(d);
            const p = d.split('/');
            if (p.length === 3) return new Date(p[2], p[1] - 1, p[0]);
            return new Date();
        };

        const sortedData = data.sort((a, b) => parseDateSafe(a.dia) - parseDateSafe(b.dia)).slice(-7);
        const totalSales = sortedData.reduce((acc, curr) => acc + (parseFloat(curr.faturamento) || 0), 0);

        // Atualiza Valor Total
        const totalDisplay = document.getElementById('chart-total-val');
        if (totalDisplay) {
            // Se update, anima
            if (isUpdate) updateValueWithAnimation('chart-total-val', totalSales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
            else totalDisplay.innerText = totalSales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }

        // --- LEGENDA DE DATA (START/END) ---
        const labelContainer = document.getElementById('chart-labels');
        if (labelContainer && sortedData.length > 0) {
            const firstDate = parseDateSafe(sortedData[0].dia).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
            const lastDate = parseDateSafe(sortedData[sortedData.length - 1].dia).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
            labelContainer.innerHTML = `<span>${firstDate}</span><span>${lastDate}</span>`;
        }

        const seriesData = sortedData.map(d => parseFloat(d.faturamento) || 0);
        const categories = sortedData.map(d => parseDateSafe(d.dia).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }));

        if (revenueChartInstance) {
            // Update
            revenueChartInstance.updateOptions({
                xaxis: { categories: categories }
            });
            revenueChartInstance.updateSeries([{
                data: seriesData
            }]);
        } else {
            // Create
            const options = {
                chart: {
                    type: 'area',
                    height: '100%',
                    toolbar: { show: false },
                    fontFamily: 'Inter, sans-serif',
                    zoom: { enabled: false }
                },
                series: [{
                    name: 'Receita',
                    data: seriesData
                }],
                colors: ['#db0038'],
                fill: {
                    type: 'gradient',
                    gradient: {
                        shadeIntensity: 1,
                        opacityFrom: 0.4,
                        opacityTo: 0.05,
                        stops: [0, 100]
                    }
                },
                dataLabels: { enabled: false },
                stroke: { curve: 'smooth', width: 2 },
                xaxis: {
                    categories: categories,
                    axisBorder: { show: false },
                    axisTicks: { show: false },
                    labels: {
                        style: { colors: '#9ca3af', fontSize: '10px', fontFamily: 'Inter' },
                        offsetY: -2
                    },
                    tooltip: { enabled: false }
                },
                yaxis: { show: false },
                grid: {
                    show: true,
                    borderColor: '#f3f4f6',
                    strokeDashArray: 4,
                    padding: { top: 0, right: 0, bottom: 0, left: 10 },
                    xaxis: { lines: { show: false } },
                    yaxis: { lines: { show: true } }
                },
                tooltip: {
                    theme: 'light',
                    y: { formatter: (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
                }
            };
            revenueChartInstance = new ApexCharts(chartEl, options);
            revenueChartInstance.render();
        }
        updateLastUpdateIndicator();
    });
}



/* --- NOVA LÓGICA DE NFC-e (XML Parsing) --- */

function extrairTagXML(xmlString, tag) {
    if (!xmlString || xmlString === "" || xmlString === "---") return null;
    // Regex ajustada para aceitar namespaces opcionais (ex: nfe:dhEmi ou apenas dhEmi)
    const regex = new RegExp(`<([a-zA-Z0-9]+:)?${tag}>(.*?)<\/[a-zA-Z0-9:]*?${tag}>`, 'i');
    const match = xmlString.match(regex);
    // match[0] é tudo, match[1] é namespace, match[2] é o valor
    return match ? match[2] : null;
}

function fetchNFCeData(forceUpdate = false) {
    const valEl = document.getElementById('kpi-nfce-val');
    // const qtdEl = document.getElementById('kpi-nfce-qtd'); // Agora via fetchBalanceData (API Antiga)
    if (!valEl) return;

    // Se não tem cache, skeleton
    if (!DataManager.get('nfce_data') && valEl) {
        valEl.innerText = 'R$ ...';
    }

    // URL Exata fornecida pelo usuário
    const url = "https://script.google.com/macros/s/AKfycbzB7dluoiNyJ4XK6oDK_iyuKZfwPTAJa4ua4RetQsUX9cMObgE-k_tFGI82HxW_OyMf/exec?action=listarNotasFiscais";

    // Passar forceUpdate para ignorar cache se necessário
    DataManager.fetchSmart('nfce_data', url, (result, isUpdate) => {
        if (result && result.status === 'success' && Array.isArray(result.data)) {
            const rawData = result.data;
            console.log('[NFCe Debug] Total recebido da API:', rawData.length);

            // Data Local YYYY-MM-DD
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const todayStr = `${year}-${month}-${day}`;

            // Filtrar Autorizadas e Hoje
            const validNotes = rawData.filter(nota => {
                // Ignora linhas vazias
                if (!nota.xml || nota.xml === "") return false;

                // 1. Verificação de Status (Híbrida: API ou XML)
                let isAuthorized = false;

                // Tenta pelo campo status da API
                if (nota.status && String(nota.status).toLowerCase().includes('autorizada')) {
                    isAuthorized = true;
                }

                // Se falhar (campo vazio), tenta pelo XML (<xMotivo> ou <cStat>)
                if (!isAuthorized) {
                    const xMotivo = extrairTagXML(nota.xml, "xMotivo");
                    const cStat = extrairTagXML(nota.xml, "cStat");

                    if (xMotivo && xMotivo.toLowerCase().includes('autorizado')) isAuthorized = true;
                    if (cStat === '100') isAuthorized = true;
                }

                if (!isAuthorized) return false;

                // 2. Filtro de Data (Híbrido: XML > Timestamp)
                let noteDate = null;
                const dhEmi = extrairTagXML(nota.xml, "dhEmi");

                if (dhEmi) {
                    // Formato XML: 2026-01-13T18:19:56-03:00 -> Pega 2026-01-13
                    noteDate = dhEmi.split('T')[0];
                } else if (nota.timestamp) {
                    // Fallback: Se não conseguir ler dhEmi, usa o carimbo de data da API
                    try {
                        const d = new Date(nota.timestamp);
                        const y = d.getFullYear();
                        const m = String(d.getMonth() + 1).padStart(2, '0');
                        const da = String(d.getDate()).padStart(2, '0');
                        noteDate = `${y}-${m}-${da}`;
                    } catch (e) {
                        console.error('Erro ao processar timestamp:', e);
                    }
                }

                // Compara com hoje (YYYY-MM-DD)
                // Se noteDate for nulo, falha. Se for diferente de todayStr, falha.
                if (!noteDate || noteDate !== todayStr) return false;

                return true;
            });

            console.log('[NFCe Debug] Notas Válidas Hoje:', validNotes.length);

            // Somar Valores
            let totalVal = 0;
            validNotes.forEach(nota => {
                let vNF = extrairTagXML(nota.xml, "vNF");
                if (vNF) {
                    // Garante formato numérico (previne erros com vírgula)
                    vNF = vNF.replace(',', '.');
                    const val = parseFloat(vNF);
                    console.log(`[NFCe Debug] Nota ${nota.nNF} Valor: ${val}`);
                    if (!isNaN(val)) totalVal += val;
                }
            });

            console.log('[NFCe Debug] Total calculado:', totalVal);

            // Update UI (Apenas se tiver dados validos de hoje)
            if (validNotes.length > 0) {
                if (isUpdate && isBalanceVisible) {
                    if (valEl) valEl.innerText = `R$ ${totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                } else {
                    if (valEl) {
                        if (isBalanceVisible) valEl.innerText = `R$ ${totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                        else valEl.innerText = 'R$ ***,**';
                    }
                }
            } else {
                console.warn('[NFCe Debug] Nenhuma nota válida encontrada para hoje. Mantendo valor antigo.');
            }
        }
        // Se der erro ou vazio, NÃO sobrescrevemos o valor (deixa o da API Page 1)
    }, forceUpdate);
}

/* --- LAST UPDATE INDICATOR --- */
function updateLastUpdateIndicator() {
    let indicator = document.getElementById('last-update-indicator');
    if (!indicator) {
        // Mobile Check: If window width < 768, do not create or show
        if (window.innerWidth < 768) return;

        indicator = document.createElement('div');
        indicator.id = 'last-update-indicator';
        // Style updated: Bottom Right, bigger font, better contrast
        indicator.style.cssText = 'position: fixed; bottom: 15px; right: 15px; font-size: 11px; color: #4b5563; z-index: 9999; font-family: Inter, sans-serif; background: rgba(255,255,255,0.8); padding: 4px 8px; border-radius: 4px; border: 1px solid #e5e7eb; pointer-events: none;';
        document.body.appendChild(indicator);
    } else {
        // If resize happened and now is mobile, hide it
        if (window.innerWidth < 768) {
            indicator.style.display = 'none';
            return;
        } else {
            indicator.style.display = 'block';
        }
    }
    const now = new Date();
    // Format: "Atualizado às HH:MM:SS"
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    indicator.innerText = `Atualizado às ${timeStr}`;

    // Log Storage Usage
    logStorageUsage();
}

function logStorageUsage() {
    let total = 0;
    let keys = 0;
    for (let x in sessionStorage) {
        if (sessionStorage.hasOwnProperty(x)) {
            total += ((sessionStorage[x].length + x.length) * 2);
            keys++;
        }
    }
    // Approx 5MB limit usually
    const sizeKB = (total / 1024).toFixed(2);
    const percentage = ((total / (5 * 1024 * 1024)) * 100).toFixed(2);
    console.log(`[Storage Debug] SessionStorage: ${sizeKB} KB used (${percentage}%) across ${keys} keys.`);
}

/**
 * --- LÓGICA DO EXTRATO (DASHBOARD - IDEIAL N1) ---
 */
/**
 * --- LÓGICA DE MÉTRICAS (DASHBOARD) - REAL DATA ---
 */
let fullMetricsData = null;

function fetchMetricsDashboardData(forceUpdate = false) {
    // API URL para buscar todas as transações
    const url = "https://script.google.com/macros/s/AKfycbzd_UOW_Ei9nPxNwmJdEtX4q3XDXu_WWktWUvH70ooAFM8C1bB6r7m39E18vl5dRjDZ/exec";

    // Se não tem cache, e estamos no extrato, maybe show skeleton?
    // Mas a renderExtractList trata lista vazia.

    DataManager.fetchSmart('extract_data', url, (dataJson, isUpdate) => {
        // Handle API structure
        let rows = [];
        if (dataJson.content && Array.isArray(dataJson.content)) rows = dataJson.content;
        else if (Array.isArray(dataJson)) rows = dataJson;
        else if (typeof dataJson === 'object') rows = Object.values(dataJson); // Fallback

        if (!rows || rows.length === 0) {
            fullMetricsData = [];
            // Se for update e vazio, talvez limpar?
        } else {
            // Detect format: Array of Arrays (Sheet) vs Array of Objects (JSON)
            const firstItem = rows[0];
            const isObject = firstItem && typeof firstItem === 'object' && !Array.isArray(firstItem);

            if (isObject) {
                // API returns correct layout directly
                fullMetricsData = rows.map(item => ({
                    timestamp: item.timestamp || item.Data || '',
                    payment: item.payment || item.Pagamento || '',
                    descricao: item.descricao || item.Descricao || '',
                    type: item.type || item.Tipo || '',
                    total: item.total || item.Valor || 0
                }));
            } else {
                // Legacy Sheet Rows
                let startIdx = 0;
                if (rows.length > 0 && String(rows[0][0]).toLowerCase().includes('data')) {
                    startIdx = 1;
                }

                if (rows.length > startIdx) {
                    fullMetricsData = rows.slice(startIdx).map(row => ({
                        timestamp: row[0],
                        payment: row[1],
                        descricao: row[2],
                        type: row[3],
                        total: row[4]
                    }));
                } else {
                    fullMetricsData = [];
                }
            }
        }

        // Inverter a ordem original (Assumindo que vem Antigo -> Novo, queremos Novo -> Antigo)
        // Isso resolve a ordem intra-dia (mesmo dia, horas diferentes não parseadas)
        if (fullMetricsData.length > 0) {
            fullMetricsData.reverse();
            // Em seguida, ordena por Dia (Estável: mantém a inversão feita acima para dias iguais)
            fullMetricsData.sort((a, b) => parseDate(b.timestamp) - parseDate(a.timestamp));
        }

        if (document.getElementById('transaction-list')) {
            renderExtractList();
            calculateExtractTotals();
            updateLastUpdateIndicator(); // Ensure indicator is updated/shown on Extract page
        }
        if (document.getElementById('period-select')) { // Metricas Page
            updateMetricsDashboard();
            updateLastUpdateIndicator();
        }
    });
}

/* --- LÓGICA DE MÉTRICAS (DASHBOARD) --- */
function updateMetricsDashboard() {
    if (!fullMetricsData) {
        fetchMetricsDashboardData();
        return;
    }
    // ... existing logic ...

    const selector = document.getElementById('period-select');
    if (!selector) return;

    if (selector.value !== 'day') {
        alert('Filtro indisponível no momento.');
        selector.value = 'day';
        return;
    }

    const period = selector.value;
    const now = new Date();

    // Filtra dados com base no período
    const filteredData = fullMetricsData.filter(item => {
        if (!item.timestamp) return false;
        // Parse dd/mm/yyyy
        const parts = item.timestamp.split(' ');
        const dateParts = parts[0].split('/');
        // Note: Month is 0-indexed in JS Date
        const tDate = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);

        if (period === 'day') {
            return tDate.getDate() === now.getDate() && tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
        } else if (period === 'week') {
            // Últimos 7 dias
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(now.getDate() - 7);
            return tDate >= sevenDaysAgo;
        } else if (period === 'month') {
            return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
        }
        return true;
    });

    // Calcula KPIs
    let faturamento = 0;
    let saidas = 0;

    filteredData.forEach(item => {
        let val = typeof item.total === 'number' ? item.total : parseFloat(item.total.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
        if (isNaN(val)) val = 0;

        const type = item.type ? item.type.toLowerCase() : '';
        if (type === 'entrada') {
            faturamento += val;
        } else if (type === 'saida') {
            saidas += val;
        }
    });

    const entradasCount = filteredData.filter(i => (i.type || '').toLowerCase() === 'entrada').length;
    const ticket = entradasCount > 0 ? faturamento / entradasCount : 0;
    const lucro = faturamento - saidas;
    const totalNfce = entradasCount; // Assumindo Entradas como Vendas/Notas

    // Atualiza KPIs
    animateValue(0, faturamento, 800, v => {
        const el = document.getElementById('kpi-faturamento');
        if (el) el.innerText = `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    });
    // Ticket, Lucro e NFCe agora vêm do fetchDashboardOperational (valor4..7)
    // animateValue(0, ticket, 800, v => {
    //     const el = document.getElementById('kpi-ticket');
    //     if (el) el.innerText = `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    // });
    // animateValue(0, lucro, 800, v => {
    //     const el = document.getElementById('kpi-lucro');
    //     if (el) el.innerText = `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;
    // });
    // animateValue(0, totalNfce, 800, v => {
    //     const el = document.getElementById('kpi-nfce-val');
    //     if (el) el.innerText = `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;
    // });

    // Populate Info Totals
    animateValue(0, faturamento, 800, v => {
        const el = document.getElementById('kpi-total-in');
        if (el) el.innerText = `+ R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    });
    animateValue(0, saidas, 800, v => {
        const el = document.getElementById('kpi-total-out');
        if (el) el.innerText = `- R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    });

    // const qtdEl = document.getElementById('kpi-nfce-qtd');
    // if (qtdEl) qtdEl.innerText = `${totalNfce} notas`;

    // Atualiza Gráfico (Last 7 Days trend from filtered Data?)

    const salesByDate = {};
    filteredData.forEach(item => {
        if ((item.type || '').toLowerCase() === 'entrada') {
            const parts = item.timestamp.split(' ');
            const dateParts = parts[0].split('/');
            // Use date object to sort correctly later
            const dKey = parts[0].substring(0, 5); // dd/mm (Simple key)
            // Better key: YYYYMMDD
            const sortKey = `${dateParts[2]}${dateParts[1]}${dateParts[0]}`;

            let val = typeof item.total === 'number' ? item.total : parseFloat(item.total.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());

            if (!salesByDate[sortKey]) salesByDate[sortKey] = { val: 0, label: dKey };
            salesByDate[sortKey].val += val;
        }
    });

    // Converter para array e ordenar
    let sortedKeys = Object.keys(salesByDate).sort();

    // Se vazio, mock zero
    if (sortedKeys.length === 0) {
        // Mock empty chart
        renderAreaChart([0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]);
        const lbl = document.getElementById('chart-labels');
        if (lbl) lbl.innerHTML = '';
        return;
    }

    const chartLabels = sortedKeys.map(k => salesByDate[k].label);
    const chartValues = sortedKeys.map(k => salesByDate[k].val);

    // Mock OldValues (Zero for now or calculate previous period?)
    const oldValues = chartValues.map(v => v * 0.9); // Simulado -10%

    // Render Labels
    const labelContainer = document.getElementById('chart-labels');
    if (labelContainer) {
        // Show last 7 or all if less
        const showLabels = chartLabels.slice(-7);
        labelContainer.innerHTML = showLabels.map(l => `<span>${l}</span>`).join('');
    }

    // Render Chart
    // Ensure we have at least 2 points for line
    let renderVals = chartValues;
    let renderOld = oldValues;

    if (renderVals.length < 2) {
        renderVals.push(renderVals[0] || 0);
        renderOld.push(renderOld[0] || 0);
    }

    renderAreaChart(renderVals.slice(-7), renderOld.slice(-7));
}

/* --- LÓGICA DA LISTA DE EXTRATO (BIBLIOTECA BASE) --- */
let currentExtractFilter = 'all';
let currentExtractLimit = 20;

function parseCurrencyVal(valRaw) {
    if (valRaw === undefined || valRaw === null) return 0;
    if (typeof valRaw === 'number') return valRaw;

    let valStrRaw = String(valRaw).replace('R$', '').trim();

    // Remove whitespace/invisible chars
    valStrRaw = valStrRaw.replace(/\s/g, '');

    let val = 0;

    if (valStrRaw.includes(',') && valStrRaw.includes('.')) {
        // Mixed separators
        if (valStrRaw.indexOf('.') < valStrRaw.indexOf(',')) {
            // 1.000,00 (BR)
            val = parseFloat(valStrRaw.replace(/\./g, '').replace(',', '.'));
        } else {
            // 1,000.00 (US)
            val = parseFloat(valStrRaw.replace(/,/g, ''));
        }
    } else if (valStrRaw.includes(',')) {
        // 100,00 (BR)
        val = parseFloat(valStrRaw.replace(',', '.'));
    } else {
        // Number or 100.00 US
        val = parseFloat(valStrRaw);
    }
    return isNaN(val) ? 0 : val;
}

function calculateExtractTotals() {
    if (!fullMetricsData) return;

    let totalIn = 0;
    let totalOut = 0;

    fullMetricsData.forEach(t => {
        let val = parseCurrencyVal(t.total);
        if ((t.type || '').toLowerCase().includes('entrada')) totalIn += val;
        else if ((t.type || '').toLowerCase().includes('sa')) totalOut += Math.abs(val);
    });

    // Update Elements, removing + and -
    const elIn = document.getElementById('total-in');
    const elOut = document.getElementById('total-out');

    if (elIn) elIn.innerText = `R$ ${totalIn.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    if (elOut) elOut.innerText = `R$ ${totalOut.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function parseDate(str) {
    if (!str) return 0;
    try {
        // 1. If it's already a Date object
        if (str instanceof Date) {
            const d = new Date(str);
            d.setHours(0, 0, 0, 0);
            return d.getTime();
        }

        // 2. If it is a string
        const strVal = String(str).trim();

        // ISO Date (yyyy-mm-dd)
        if (strVal.match(/^\d{4}-\d{2}-\d{2}/)) {
            const d = new Date(strVal);
            d.setHours(0, 0, 0, 0);
            return d.getTime();
        }

        // BR Date (dd/mm/yyyy) or other formats
        // Split by / or - or space
        let parts = strVal.split(/[\/\-\s]+/);

        if (parts.length >= 3) {
            // Check if parts[2] is year (4 digits) -> dd/mm/yyyy
            if (parts[2].length === 4) {
                const d = new Date(parts[2], parts[1] - 1, parts[0]);
                d.setHours(0, 0, 0, 0);
                return d.getTime();
            }
            // Check if parts[0] is year (4 digits) -> yyyy/mm/dd
            if (parts[0].length === 4) {
                const d = new Date(parts[0], parts[1] - 1, parts[2]);
                d.setHours(0, 0, 0, 0);
                return d.getTime();
            }
        }
    } catch (e) {
        console.warn('Error parsing date:', str);
        return 0;
    }
    return 0;
}

function getDateLabel(ts) {
    if (!ts) return 'Data Desconhecida';

    const d = new Date(ts);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.getTime() === today.getTime()) return 'Hoje';
    if (d.getTime() === yesterday.getTime()) return 'Ontem';

    return d.toLocaleDateString('pt-BR');
}

function renderExtractList() {
    const listEl = document.getElementById('transaction-list');
    const loadMoreBtn = document.getElementById('load-more');
    const searchInput = document.getElementById('search-input');
    const searchQuery = searchInput ? searchInput.value.toLowerCase() : '';

    if (!listEl || !fullMetricsData) return;

    // Filtra
    let filtered = fullMetricsData.filter(t => {
        const type = String(t.type || '').toLowerCase();
        let matchesType = true;

        if (currentExtractFilter === 'in') matchesType = type.includes('entrada');
        if (currentExtractFilter === 'out') matchesType = type.includes('sa');

        const name = String(t.payment || '').toLowerCase();
        const desc = String(t.descricao || '').toLowerCase();
        const matchesSearch = name.includes(searchQuery) || desc.includes(searchQuery);

        return matchesType && matchesSearch;
    });

    // Sort by Date Descending
    filtered.sort((a, b) => parseDate(b.timestamp) - parseDate(a.timestamp));

    // Load More Visibility
    if (filtered.length > currentExtractLimit) {
        if (loadMoreBtn) loadMoreBtn.style.display = 'flex';
    } else {
        if (loadMoreBtn) loadMoreBtn.style.display = 'none';
    }

    const visibleItems = filtered.slice(0, currentExtractLimit);

    if (visibleItems.length === 0) {
        listEl.innerHTML = `<div class="p-10 text-center text-gray-400 text-xs font-bold uppercase tracking-widest">
            Nenhuma movimentação encontrada<br>
            <span class="text-[9px] opacity-50">(T: ${fullMetricsData.length}, F: ${currentExtractFilter}, Q: "${searchQuery}")</span>
        </div>`;
        return;
    }

    let contentHtml = '';
    visibleItems.forEach(t => {
        const typeLc = (t.type || '').toLowerCase();
        const isIn = typeLc.includes('entrada');

        let val = parseCurrencyVal(t.total);
        const valStr = `R$ ${Math.abs(val).toFixed(2).replace('.', ',')}`;

        // Display timestamp or a default
        const dateDisplay = t.timestamp || 'Data N/D';

        contentHtml += `
        <div class="transaction-item">
            <div class="trans-icon-box">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    ${isIn ? '<path d="M12 19V5M5 12l7-7 7 7"/>' : '<path d="M12 5v14M5 12l7 7 7-7"/>'}
                </svg>
            </div>
            <div class="flex-1 ml-4 text-left">
                <p class="text-xs font-bold text-gray-800">${t.payment || 'Movimentação'}</p>
                <p class="text-[9px] text-gray-400 font-bold uppercase tracking-tight">${dateDisplay}</p>
            </div>
            <p class="text-xs font-bold ${isIn ? 'trans-val-pos' : 'trans-val-neg'}">
                ${valStr}
            </p>
        </div>
        `;
    });

    listEl.innerHTML = contentHtml;
}

function setExtractFilter(type, el) {
    currentExtractFilter = type;
    currentExtractLimit = 20;
    document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    if (el) el.classList.add('active');
    renderExtractList();
}

function filterExtractList() {
    currentExtractLimit = 20;
    renderExtractList();
}

function loadExtractMore() {
    currentExtractLimit += 20;
    renderExtractList();
}

function renderAreaChart(values, oldValues) {
    const linePath = document.getElementById('chart-line');
    const fillPath = document.getElementById('chart-fill');
    const dotsGroup = document.getElementById('chart-dots-group');

    if (!linePath || !fillPath || !dotsGroup) return;

    const maxVal = Math.max(...values, ...oldValues);
    const stepX = 400 / (values.length - 1); // Width 400 defined in SVG viewBox
    dotsGroup.innerHTML = '';

    // Cálculo Y: 200 altura total. margem de segurança.
    const calcY = (val) => 200 - (val / maxVal * 160);

    let d = `M 0 ${calcY(values[0])}`;
    createDot(0, calcY(values[0]), 0, values, oldValues);

    for (let i = 1; i < values.length; i++) {
        const x = i * stepX;
        const y = calcY(values[i]);
        d += ` L ${x} ${y}`;
        createDot(x, y, i, values, oldValues);
    }

    linePath.setAttribute('d', d);
    fillPath.setAttribute('d', d + ` L 400 200 L 0 200 Z`);

    // Reset animation
    linePath.classList.remove('active'); fillPath.classList.remove('active');
    void linePath.offsetWidth;
    linePath.classList.add('active'); fillPath.classList.add('active');
}

function createDot(x, y, index, currentSet, prevSet) {
    const dotsGroup = document.getElementById('chart-dots-group');
    if (!dotsGroup) return;

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", "3.5");
    circle.setAttribute("class", "chart-dot");

    circle.addEventListener('mouseenter', (e) => {
        const tooltip = document.getElementById('chart-tooltip');
        if (!tooltip) return;

        const val = currentSet[index];
        const oldVal = prevSet[index];
        const diff = ((val - oldVal) / oldVal * 100).toFixed(1);

        tooltip.innerHTML = `R$ ${val.toLocaleString('pt-PT')} <br><span class="${diff >= 0 ? 'text-green-400' : 'text-red-400'}">${diff >= 0 ? '+' : ''}${diff}%</span>`;
        tooltip.style.opacity = '1';

        // Tooltip position needs to be handled carefully relative to viewport or SVG
        // Note: e.pageX might work if tooltip is body-relative absolute
        const rect = circle.getBoundingClientRect();
        tooltip.style.left = (rect.left + window.scrollX + 10) + 'px';
        tooltip.style.top = (rect.top + window.scrollY - 40) + 'px';
    });

    circle.addEventListener('mouseleave', () => {
        const t = document.getElementById('chart-tooltip');
        if (t) t.style.opacity = '0';
    });

    dotsGroup.appendChild(circle);
}

function animateValue(start, end, duration, callback) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        callback(progress * (end - start) + start);
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}