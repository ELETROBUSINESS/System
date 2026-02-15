


// ============================================================
// 1. ESCOPO GLOBAL (VARIÁVEIS E BANCO DE DADOS)
// ============================================================

const infinitePayRates = {
    "pix": 0.00,
    "debit": 0.85,
    "credit_spot": 2.89,
    "installments_visa_master": {
        "2x": 4.22, "3x": 4.83, "4x": 5.44, "5x": 6.05, "6x": 6.64,
        "7x": 7.24, "8x": 7.82, "9x": 8.41, "10x": 8.98, "11x": 9.56, "12x": 10.12
    },
    "installments_elo_amex": {
        "2x": 6.09, "3x": 6.69, "4x": 7.28, "5x": 7.87, "6x": 8.46,
        "7x": 9.05, "8x": 9.63, "9x": 10.20, "10x": 10.76, "11x": 11.33, "12x": 11.88
    },
    "debit_elo_amex": 2.08,
    "credit_spot_elo_amex": 4.65,
    "movecard": 8.00
};

let db; // Variável do Banco de Dados
let realtimeOrdersUnsubscribe = null;
let areValuesHidden = false;

let fiscalHistory = []; // Armazena { idVenda, data, status, xml, itensEmitidos, itensPendentes }
const FISCAL_API_URL = "https://emitirnfce-xsy57wqb6q-rj.a.run.app";

// Variáveis de Pedidos Online (Globais para evitar o erro ReferenceError)
let activeOrdersData = [];
// --- Cache Global de Produtos ---
let localProductCache = null; // Movido para escopo global para acesso por listeners
let currentOrderStatusFilter = 'pendente';
let selectedProductIds = new Set(); // Armazena IDs dos produtos selecionados para download

// Configuração e Inicialização Imediata do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAVQ3tf6Qu4_9PajpJclZAJjVvRgB4ZE2I",
    authDomain: "super-app25.firebaseapp.com",
    projectId: "super-app25",
    storageBucket: "super-app25.firebasestorage.app",
    messagingSenderId: "810900166273",
    appId: "1:810900166273:web:24b8f055a68c9f0a6b5f80"
};

// Configuração da Composição 2026 (Simples Nacional 1ª Faixa - 4%)
const TAX_COMPOSITION_2026 = [
    { label: 'CPP (Previdência)', perc: 1.66 }, // 41.5% de 4.0%
    { label: 'ICMS (Estado)', perc: 1.36 },    // 34.0% de 4.0%
    { label: 'COFINS (Federal)', perc: 0.51 }, // 12.74% de 4.0%
    { label: 'IRPJ', perc: 0.22 },             // 5.5% de 4.0%
    { label: 'CSLL', perc: 0.14 },             // 3.5% de 4.0%
    { label: 'PIS/Pasep', perc: 0.11 }         // 2.76% de 4.0%
];
let currentTaxDisplay = 0; // Armazena o valor atual para a animação de contagem

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app();
}

db = firebase.firestore(); // db agora existe globalmente
console.log("Firebase inicializado globalmente!");

// Credenciais e URLs
const FIREBASE_CONFIG_ID = 'floralchic-loja';
const STORE_OWNER_UID = "3zYT9Y6hXWeJSuvmEYP4FMZa5gI2";
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzB7dluoiNyJ4XK6oDK_iyuKZfwPTAJa4ua4RetQsUX9cMObgE-k_tFGI82HxW_OyMf/exec";
const REGISTRO_VENDA_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxCCaxdYdC6J_QKsaoWTDquH915MHUnM9BykD39ZUujR2LB3lx9d9n5vAsHdJZJByaa7w/exec";
const CENTRAL_API_URL = "https://script.google.com/macros/s/AKfycbyZtUsI44xA4MQQLZWJ6K93t6ZaSaN6hw7YQw9EclZG9E85kM6yOWQCQ0D-ZJpGmyq4/exec"; // URL de Migração

// Funções Auxiliares Globais (Necessárias para as funções abaixo)
const formatCurrency = (value) => { const n = Number(value); if (isNaN(n)) return 'R$ 0,00'; return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); };
const formatTime = (date) => { const pad = (n) => n < 10 ? '0' + n : n; return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`; };
const mapStatusFirebaseToUI = (fbStatus) => {
    if (fbStatus === 'approved') return 'pendente';
    if (fbStatus === 'preparation') return 'preparando';
    if (fbStatus === 'shipped') return 'enviado';
    if (fbStatus === 'delivered') return 'finalizado';
    return fbStatus;
};

// --- Modal Helpers ---
window.openModal = (modal) => {
    if (modal) {
        modal.style.display = 'flex';
        // Small timeout to allow display change to register before adding active class for transition
        setTimeout(() => modal.classList.add('active'), 10);
    }
};

window.closeModal = (modal) => {
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            if (!modal.classList.contains('active')) modal.style.display = 'none';
        }, 300);
    }
};

window.showCustomAlert = (title, message) => {
    const modal = document.getElementById('alert-modal');
    if (modal) {
        document.getElementById('alert-modal-title').innerText = title;
        document.getElementById('alert-modal-message').innerText = message;
        openModal(modal);
    } else {
        alert(`${title}: ${message}`);
    }
};

window.showCustomConfirm = (title, message, callback) => {
    const modal = document.getElementById('confirm-modal');
    if (modal) {
        document.getElementById('confirm-modal-title').innerText = title;
        document.getElementById('confirm-modal-message').innerText = message;

        const confirmBtn = document.getElementById('confirm-modal-btn');
        // Remove listeners antigos cloning node
        const newBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

        newBtn.addEventListener('click', () => {
            closeModal(modal);
            if (callback) callback();
        });

        openModal(modal);
        // Focus confirm for quick access
        setTimeout(() => newBtn.focus(), 100);
    } else {
        if (confirm(`${title}: ${message}`)) {
            if (callback) callback();
        }
    }
};

// ============================================================
// 2. FUNÇÕES GLOBAIS DE PEDIDOS (Para o HTML acessar)
// ============================================================

// Função de Renderização (Movemos para fora do DOMContentLoaded)
const renderDummyOrders = () => {
    const container = document.getElementById('orders-grid-container');
    const badgeNavbar = document.getElementById('pedidos-badge');

    // Atualiza Badge
    const pendingCount = activeOrdersData.filter(o => o.status === 'pendente').length;
    if (badgeNavbar) {
        badgeNavbar.innerText = pendingCount;
        if (pendingCount > 0) badgeNavbar.classList.add('active'); else badgeNavbar.classList.remove('active');
    }

    // Atualiza contadores nas abas
    const countPendenteEl = document.getElementById('count-pendente');
    const countPreparandoEl = document.getElementById('count-preparando');
    if (countPendenteEl) countPendenteEl.innerText = pendingCount;
    if (countPreparandoEl) countPreparandoEl.innerText = activeOrdersData.filter(o => o.status === 'preparando').length;

    // Só renderiza se a aba estiver visível e o container existir
    const pedidosPage = document.getElementById('pedidos-page');
    if (!pedidosPage || pedidosPage.style.display === 'none' || !container) return;

    const filteredOrders = activeOrdersData.filter(order => order.status === currentOrderStatusFilter);
    container.innerHTML = '';

    if (filteredOrders.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-light); padding: 60px;"><i class='bx bx-check-circle' style="font-size: 3rem; opacity:0.3;"></i><p>Nenhum pedido "${currentOrderStatusFilter}".</p></div>`;
        return;
    }

    filteredOrders.forEach(order => {
        const card = document.createElement('div');
        card.className = 'order-card';
        let statusColor = '#856404'; let statusBg = '#fff3cd';
        if (order.status === 'preparando') { statusColor = '#004085'; statusBg = '#cce5ff'; }
        if (order.status === 'enviado' || order.status === 'finalizado') { statusColor = '#155724'; statusBg = '#d4edda'; }

        card.innerHTML = `
                    <div class="order-status" style="background:${statusBg}; color:${statusColor}">${order.status.toUpperCase()}</div>
                    <div class="order-header"><span class="order-id">#${order.displayId}</span><span class="order-time">${order.time}</span></div>
                    <div class="order-client">
                        <div class="client-avatar-small"><i class='bx bx-user'></i></div>
                        <div class="client-info"><h4>${order.client}</h4><p>${order.address}</p></div>
                    </div>
                    <div class="order-items-summary"><strong>Itens:</strong> ${order.items}</div>
                    <div class="order-footer">
                        <span class="order-total">${order.total}</span>
                        <div class="order-actions">
                            <button class="btn-main-action" onclick="openOrderDetailModal('${order.id}')">Detalhes <i class='bx bx-chevron-right'></i></button>
                        </div>
                    </div>`;
        container.appendChild(card);
    });
};

// Função de Polling (Escuta do Firebase)
// Função de Polling (Escuta do Firebase) - ATUALIZADA COM ENDEREÇO DE COLETA
// Função de Polling (Escuta do Firebase) - ATUALIZADA
function startOrderPolling() {
    if (realtimeOrdersUnsubscribe) realtimeOrdersUnsubscribe();

    const q = db.collection('orders').orderBy('createdAt', 'desc').limit(50);

    console.log("Iniciando monitoramento de pedidos...");

    realtimeOrdersUnsubscribe = q.onSnapshot((snapshot) => {
        const fetchedOrders = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.status === 'pending_payment' || data.status === 'cancelled' || data.status === 'rejected') return;

            const dateObj = data.createdAt ? data.createdAt.toDate() : new Date();
            let itemsStr = "Sem itens";
            if (data.items && Array.isArray(data.items)) itemsStr = data.items.map(i => `${i.quantity}x ${i.name}`).join(', ');

            // --- LÓGICA DE EXIBIÇÃO DO ENDEREÇO ---
            let addressDisplay = 'Endereço não informado';
            let shippingMode = data.shipping?.mode || 'delivery';

            if (data.shipping) {
                if (shippingMode === 'pickup') {
                    // Limpa a string para pegar só o nome da cidade/loja
                    // Ex: "Retirada: Ipixuna" vira "Ipixuna"
                    const storeName = (data.shipping.address || '').replace('Retirada: ', '') || 'Loja';
                    addressDisplay = `<i class='bx bxs-store' style="color:var(--info-blue)"></i> Coleta na loja de ${storeName}`;
                } else {
                    // Entrega normal
                    addressDisplay = `<i class='bx bxs-truck' style="color:#666"></i> ${data.shipping.address}`;
                }
            }
            // --------------------------------------

            fetchedOrders.push({
                id: doc.id,
                displayId: data.orderId || doc.id.substring(0, 6),
                time: formatTime(dateObj),
                client: data.client ? data.client.name : 'Cliente Online',
                address: addressDisplay, // HTML formatado
                rawAddress: data.shipping?.address || '', // Endereço puro para lógica interna
                status: mapStatusFirebaseToUI(data.status),
                total: formatCurrency(data.total || 0),
                items: itemsStr,
                shippingMode: shippingMode,
                paymentMethod: data.paymentMethod || 'Pix'
            });
        });

        activeOrdersData = fetchedOrders;
        renderDummyOrders();

    }, (error) => {
        console.error("Erro pedidos:", error);
    });
}

// ============================================================
// 3. INÍCIO DO DOMContentLoaded (LÓGICA DE UI E EVENTOS)
// ============================================================
document.addEventListener('DOMContentLoaded', () => {

    // Inicia o listener de pedidos imediatamente
    startOrderPolling();

    // ==========================================
    // LÓGICA DE METAS DE CADASTRO (ANTIGRAVITY)
    // ==========================================
    const GOAL_CONFIG = {
        morning: { name: "Manhã", start: 0, end: 12, target: 70 },
        afternoon: { name: "Tarde/Noite", start: 12, end: 24, target: 70 }
    };

    function getCurrentShift() {
        const hour = new Date().getHours();
        return (hour >= 0 && hour < 12) ? 'morning' : 'afternoon';
    }

    async function registrarLogAtividadePDV(acao, quantidade = 1, detalhes = "") {
        try {
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            const data = {
                action: "registrar_log",
                operador: userData.nome || "PDV Alpha",
                cargo: userData.cargo || "Operador",
                loja: "DT#25",
                acao: acao,
                quantidade: quantidade,
                detalhes: detalhes
            };

            await fetch(CENTRAL_API_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } catch (e) {
            console.error("Erro ao registrar log:", e);
        }
    }

    function updateGoalUI() {
        const shift = getCurrentShift();
        const config = GOAL_CONFIG[shift];
        const lastReset = localStorage.getItem('registration_goal_reset');
        const nowStr = new Date().toDateString() + "_" + shift;

        // Resetar se mudou o dia ou o turno
        if (lastReset !== nowStr) {
            localStorage.setItem('registration_goal_count', '0');
            localStorage.setItem('registration_goal_ids', JSON.stringify([]));
            localStorage.setItem('registration_goal_reset', nowStr);
        }

        const count = parseInt(localStorage.getItem('registration_goal_count') || '0');
        const fillPerc = Math.min((count / config.target) * 100, 100);

        const fillEl = document.getElementById('goal-progress-fill');
        const countEl = document.getElementById('registered-count');
        const shiftNameEl = document.getElementById('current-shift-name');

        if (fillEl) fillEl.style.width = fillPerc + '%';
        if (countEl) countEl.innerText = count;
        if (shiftNameEl) shiftNameEl.innerText = config.name;
    }

    // Exporta para ser usado na função de salvar produto
    window.trackProductRegistration = async (productId) => {
        const shift = getCurrentShift();
        const registeredIds = JSON.parse(localStorage.getItem('registration_goal_ids') || '[]');

        if (!registeredIds.includes(productId)) {
            registeredIds.push(productId);
            const newCount = registeredIds.length;

            localStorage.setItem('registration_goal_ids', JSON.stringify(registeredIds));
            localStorage.setItem('registration_goal_count', newCount.toString());

            updateGoalUI();

            // Logar a atividade
            await registrarLogAtividadePDV("Cadastro de Produto", 1, `Produto: ${productId}`);
        }
    };

    updateGoalUI();
    setInterval(updateGoalUI, 60000); // Atualiza turno se passar das 12h

    // --- Constantes Locais de UI ---
    const TOKEN_KEY = 'caixaToken';
    const TOKEN_EXPIRATION_KEY = 'caixaTokenExpiration';
    const TOKEN_DURATION_HOURS = 20;


    // Inicializa o Firebase apenas se ainda não foi inicializado
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    } else {
        firebase.app(); // se já existe, usa o padrão
    }

    // Define a variável global 'db' que o nosso script do PDV usa
    const db = firebase.firestore();

    console.log("Firebase inicializado com sucesso!");

    // --- MONITORAMENTO DE ATUALIZAÇÃO (GLOBAL) ---
    const updateBanner = document.getElementById('system-update-banner'); // Mudança de ID
    const updateBtn = document.getElementById('btn-update-refresh');

    if (updateBanner && updateBtn) {
        db.collection('system_alerts').doc('update-notice').onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                const serverVersion = data.version || 'default';
                const localVersion = localStorage.getItem('pdv_update_version');

                if (data.show === true && serverVersion !== localVersion) {
                    updateBanner.classList.add('visible'); // Slide Down
                    updateBtn.dataset.pendingVersion = serverVersion;
                    document.body.style.paddingTop = "70px"; // Empurra o conteúdo para baixo
                } else {
                    updateBanner.classList.remove('visible');
                    document.body.style.paddingTop = "0px"; // Restaura
                }
            }
        }, (error) => {
            console.error("Erro ao monitorar alertas:", error);
        });

        updateBtn.addEventListener('click', () => {
            const versionToConfirm = updateBtn.dataset.pendingVersion;

            updateBtn.disabled = true;
            updateBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Atualizando...";

            if (versionToConfirm) {
                localStorage.setItem('pdv_update_version', versionToConfirm);

                db.collection('system_alerts').doc('update-notice').update({
                    updated_count: firebase.firestore.FieldValue.increment(1)
                }).then(() => {
                    window.location.reload();
                }).catch(err => {
                    console.error("Erro:", err);
                    window.location.reload();
                });
            } else {
                window.location.reload();
            }
        });
    }

    let selectedCrediarioClient = null; // Para armazenar o cliente selecionado no pagamento

    // --- Estado da Aplicação ---
    // localProductCache moved to global scope
    let localClientCache = null;
    let cart = [];
    let lastScannedBarcode = null;
    let confirmCallback = null;
    let discount = 0;
    let selectedPaymentMethod = null;
    let elementToRestoreFocus = null;
    let isSmartRoundingEnabled = true;
    let lastSaleData = null;
    let barcodeScanTimeout = null;
    let currentClienteStep = 1;
    let currentFecharCaixaStep = 1;
    let currentSplitPayments = { method1: null, value1: 0, method2: null, value2: 0, remaining: 0, totalSaleValue: 0 };
    // VARIÁVEIS PARA TAXA INFINITEPAY
    let selectedCardFlag = 'Visa'; // Default
    let selectedInstallments = '1'; // Default
    let selectedPixType = null; // MIGRATION: Stores specific Pix type

    // --- Seletores do DOM ---
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingMessage = document.getElementById('loading-message');
    const mainContent = document.getElementById('main-content');
    const headerCloseCaixaBtn = document.getElementById('header-close-caixa-btn');
    const barcodeInput = document.getElementById('barcode-input');
    const barcodeHint = document.getElementById('barcode-hint');
    const cartItemsBody = document.getElementById('cart-items-body');
    const itemListContainer = document.getElementById('item-list-container');
    const emptyState = document.getElementById('empty-state');
    const itemListTable = document.getElementById('item-list-table');
    const summarySubtotal = document.getElementById('summary-subtotal');
    const summaryTotal = document.getElementById('summary-total');
    const itemCount = document.getElementById('item-count');
    const summaryDiscount = document.getElementById('summary-discount');
    const discountToggleRow = document.getElementById('discount-toggle-row');
    const discountPopover = document.getElementById('discount-popover');
    const discountInputR = document.getElementById('discount-input-r');
    const percBtnContainer = document.getElementById('perc-btn-container');
    const removeDiscountBtn = document.getElementById('remove-discount-btn');
    const effectiveDiscountDisplay = document.getElementById('discount-effective-label');
    const discountPercentageText = document.getElementById('discount-percentage-text');

    // --- LÓGICA DO BOTÃO DE LÁPIS (DESCONTO MANUAL EM R$) ---
    const btnEditDiscount = document.getElementById('btn-edit-discount');
    const modalDiscountAuth = document.getElementById('discount-auth-modal');
    const discountAuthInputs = modalDiscountAuth ? modalDiscountAuth.querySelectorAll('.auth-box') : [];
    const btnConfirmAuth = document.getElementById('btn-confirm-discount-auth');
    const authErrorMsg = document.getElementById('auth-error-msg');
    const btnTogglePass = document.getElementById('auth-toggle-pass');

    // 1. Alternar Modo Manual (Sem Token Inicial)
    let isManualMode = false;
    window.isDiscountAuthorized = false; // Controle global de autorização

    if (btnEditDiscount) {
        btnEditDiscount.addEventListener('click', (e) => {
            e.stopPropagation();

            isManualMode = !isManualMode;
            const percBtnContainer = document.getElementById('perc-btn-container'); // Container para animação
            const icon = btnEditDiscount.querySelector('i');

            if (isManualMode) {
                // MODO MANUAL ATIVO
                if (discountInputR) {
                    discountInputR.disabled = false;
                    discountInputR.value = ''; // Limpa para digitar do zero
                    discountInputR.placeholder = "R$ 0,00";
                    discountInputR.classList.add('unlocked-input');
                    setTimeout(() => discountInputR.focus(), 100);
                }

                // Esconde botões de porcentagem com animação
                if (percBtnContainer) percBtnContainer.classList.add('hidden');

                // Altera ícone para 'X' (Fechar/Cancelar edição)
                if (icon) {
                    icon.className = 'bx bx-x';
                    icon.style.fontSize = '1.2rem'; // Ajuste visual se necessário
                }

            } else {
                // MODO PADRÃO (PORCENTAGEM)
                if (discountInputR) {
                    discountInputR.disabled = true;
                    discountInputR.value = ''; // Limpa valor
                    discountInputR.placeholder = "0,00";
                    discountInputR.classList.remove('unlocked-input');

                    // Reseta desconto global ao sair do modo manual
                    discount = 0;
                    if (effectiveDiscountDisplay) effectiveDiscountDisplay.textContent = "0%";
                    updateSummary();
                }

                // Mostra botões
                if (percBtnContainer) percBtnContainer.classList.remove('hidden');

                // Restaura ícone Lápis
                if (icon) {
                    icon.className = 'bx bx-pencil';
                    icon.style.removeProperty('font-size');
                }
            }
        });
    }

    // 2. Lógica dos Inputs de Senha (Auto-focus)
    if (discountAuthInputs.length > 0) {
        discountAuthInputs.forEach((input, index) => {
            input.addEventListener('input', (e) => {
                const val = e.target.value;

                // Pula para o próximo
                if (val.length === 1 && index < discountAuthInputs.length - 1) {
                    discountAuthInputs[index + 1].focus();
                }

                // Verifica se completou a senha
                const code = Array.from(discountAuthInputs).map(i => i.value).join('');
                if (btnConfirmAuth) btnConfirmAuth.disabled = (code.length < 4);

                // Ativa botão se completou
                if (code.length === 4 && btnConfirmAuth) btnConfirmAuth.focus();
            });

            input.addEventListener('keydown', (e) => {
                // Voltar com Backspace
                if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
                    discountAuthInputs[index - 1].focus();
                }
            });
        });
    }

    // 3. Toggle ver senha
    if (btnTogglePass) {
        btnTogglePass.addEventListener('click', () => {
            const type = discountAuthInputs[0].type === 'password' ? 'tel' : 'password';
            discountAuthInputs.forEach(input => input.type = type);
            btnTogglePass.classList.toggle('bx-show');
            btnTogglePass.classList.toggle('bx-hide');
        });
    }

    // 4. Confirmar Autorização
    if (btnConfirmAuth) {
        btnConfirmAuth.addEventListener('click', () => {
            const code = Array.from(discountAuthInputs).map(i => i.value).join('');

            if (code === '0425') {
                closeModal(modalDiscountAuth);
                window.isDiscountAuthorized = true; // Marca como autorizado

                // Aplica o valor pendente se houver
                if (window.pendingDiscountValue !== undefined) {
                    if (discountInputR) {
                        discountInputR.value = window.pendingDiscountValue;
                        // Dispara input para atualizar discount e summary
                        discountInputR.dispatchEvent(new Event('input'));
                    }
                    window.pendingDiscountValue = null;
                }

                if (typeof showCustomToast === 'function') {
                    showCustomToast("Desconto Alto Autorizado!");
                }

                // Retorna foco
                if (discountInputR) setTimeout(() => discountInputR.focus(), 100);

            } else {
                if (authErrorMsg) {
                    authErrorMsg.style.display = 'block';
                    authErrorMsg.textContent = "Senha incorreta!";
                }
                discountAuthInputs.forEach(i => i.value = '');
                discountAuthInputs[0].focus();
            }
        });
    }

    // 5. Listener para Atualizar Desconto ao Digitar Manualmente
    /*
    if (discountInputR) {
        discountInputR.addEventListener('input', (e) => {
            // Remove seleção dos botões de porcentagem
            document.querySelectorAll('.perc-btn').forEach(btn => btn.classList.remove('active'));

            let val = parseFloat(parseValueFirebase(e.target.value));
            if (isNaN(val)) val = 0;

            const subtotal = getSubtotal();
            const perc = subtotal > 0 ? (val / subtotal) * 100 : 0;

            // --- Lógica de Autorização para Descontos > 10% ---
            if (perc > 10 && !window.isDiscountAuthorized) {
                // Bloqueia e abre modal
                // e.target.blur(); // Remove foco para evitar continuar digitando?
                openModal(modalDiscountAuth);

                // Salva o valor pendente para aplicar depois se autorizado
                window.pendingDiscountValue = val;

                return; // Interrompe aplicação do desconto
            }

            // Se autorizado ou menor que 10%, aplica
            if (val >= 0) {
                discount = val;

                if (effectiveDiscountDisplay) {
                    effectiveDiscountDisplay.textContent = `Manual (${perc.toFixed(1)}%)`;
                }
            } else {
                discount = 0;
                if (effectiveDiscountDisplay) effectiveDiscountDisplay.textContent = "0%";
            }

            updateSummary();
        });
    }
    */

    const paymentToggleRow = document.getElementById('payment-toggle-row');
    const summaryPaymentMethod = document.getElementById('summary-payment-method');
    const finishSaleBtn = document.getElementById('finish-sale-btn');
    const cancelSaleBtn = document.getElementById('cancel-sale-btn');
    const quickAddModal = document.getElementById('quick-add-modal');
    const paymentModal = document.getElementById('payment-modal');
    const paymentTotalEl = document.getElementById('payment-total');
    const singlePaymentOptions = document.getElementById('single-payment-options');
    const paymentOptions = paymentModal.querySelectorAll('.payment-option');
    const splitPaymentToggleBtn = document.getElementById('split-payment-toggle-btn');
    const splitPaymentArea = document.getElementById('split-payment-area');
    const splitMethod1 = document.getElementById('split-method-1');
    const splitValue1 = document.getElementById('split-value-1');
    const splitMethod2 = document.getElementById('split-method-2');
    const splitValue2 = document.getElementById('split-value-2');
    const splitPaymentRemaining = document.getElementById('split-payment-remaining');
    const confirmSplitPaymentBtn = document.getElementById('confirm-split-payment-btn');
    const receiptModal = document.getElementById('receipt-modal');
    const receiptTotalEl = document.getElementById('receipt-total');
    const newSaleBtn = document.getElementById('new-sale-btn');
    const printReceiptBtn = document.getElementById('print-receipt-btn');
    const confirmModal = document.getElementById('confirm-modal');
    const alertModal = document.getElementById('alert-modal');
    const scannedBarcodeEl = document.getElementById('scanned-barcode');
    const quickAddForm = document.getElementById('quick-add-form');
    const quickAddName = document.getElementById('quick-product-name');
    const quickAddPrice = document.getElementById('quick-product-price');
    const quickAddSubmitBtn = document.getElementById('quick-add-submit-btn');
    const alertTitle = document.getElementById('alert-modal-title');
    const alertMessage = document.getElementById('alert-modal-message');
    const confirmTitle = document.getElementById('confirm-modal-title');
    const confirmMessage = document.getElementById('confirm-modal-message');
    const confirmActionBtn = document.getElementById('confirm-modal-btn');
    const mainNavbar = document.getElementById('main-navbar');
    const navbarItems = document.querySelectorAll('.navbar-item');
    const navbarHighlight = document.getElementById('navbar-highlight');
    const allPages = document.querySelectorAll('.page-content');
    const produtosTableContainer = document.getElementById('produtos-table-container');
    const clientesListContainer = document.getElementById('clientes-list-container');
    const smartRoundingToggle = document.getElementById('smart-rounding-toggle');
    const reloadCacheBtn = document.getElementById('reload-cache-btn');
    // discountInputP helper removed
    const discountNavElements = [discountInputR, ...document.querySelectorAll('.perc-btn'), removeDiscountBtn];
    let discountNavIndex = 0;
    const removeDiscountHint = document.getElementById('remove-discount-hint');
    const horarioElement = document.getElementById('horario');
    const addClienteBtn = document.getElementById('add-cliente-btn');
    const addClienteModal = document.getElementById('add-cliente-modal');
    const addClienteForm = document.getElementById('add-cliente-form');
    const clienteSaveBtn = document.getElementById('cliente-save-btn');
    const clienteApelidoInput = document.getElementById('cliente-apelido');
    const clienteCpfInput = document.getElementById('cliente-cpf'); // Campo Novo
    const clienteNomeInput = document.getElementById('cliente-nome');
    const clienteTelefoneInput = document.getElementById('cliente-telefone');
    const clienteEnderecoInput = document.getElementById('cliente-endereco');
    const compraValorInput = document.getElementById('compra-valor');
    const compraParcelasInput = document.getElementById('compra-parcelas');
    const compraVencimentoInput = document.getElementById('compra-vencimento');
    const openCaixaModal = document.getElementById('open-caixa-modal');
    const openCaixaForm = document.getElementById('open-caixa-form');
    const openCaixaNotasInput = document.getElementById('open-caixa-notas');
    const openCaixaMoedasInput = document.getElementById('open-caixa-moedas');
    const openCaixaSemValorCheckbox = document.getElementById('open-caixa-sem-valor');
    const openCaixaSaveBtn = document.getElementById('open-caixa-save-btn');
    const closeCaixaModal = document.getElementById('close-caixa-modal');
    const closeCaixaForm = document.getElementById('close-caixa-form');
    const closeCaixaProgress = document.getElementById('close-caixa-progress');
    const closeCaixaPrevBtn = document.getElementById('close-caixa-prev-btn');
    const closeCaixaNextBtn = document.getElementById('close-caixa-next-btn');
    const closeCaixaNotasInput = document.getElementById('close-caixa-notas');
    const closeCaixaMoedasInput = document.getElementById('close-caixa-moedas');
    const closeCaixaCartaoInput = document.getElementById('close-caixa-cartao');
    const closeCaixaDepositoInput = document.getElementById('close-caixa-deposito');
    const closeCaixaFicaInput = document.getElementById('close-caixa-fica');
    const closeCaixaAssinaturaInput = document.getElementById('close-caixa-assinatura');
    const closeCaixaSaveBtn = document.getElementById('close-caixa-save-btn');


    // Novos Seletores para Fluxo de Cliente
    const clientSelectionModal = document.getElementById('client-selection-modal');
    const clientSelectionInput = document.getElementById('client-selection-input');
    const clientSelectionResults = document.getElementById('client-selection-results');
    const clientSearchHint = document.getElementById('client-search-hint');
    const btnNewClientModal = document.getElementById('btn-new-client-modal');

    // Seletores do Resumo (Sidebar)
    const summaryClientCard = document.getElementById('summary-client-card');
    const summaryClientNameText = document.getElementById('summary-client-name-text');
    const btnChangeSummaryClient = document.getElementById('btn-change-summary-client');
    const summaryLimitFill = document.getElementById('summary-limit-fill');
    const summaryLimitValue = document.getElementById('summary-limit-value');

    // Modais e Botões do Fluxo Novo
    const crediarioFlowModal = document.getElementById('crediario-flow-modal');
    const btnForcePrint = document.getElementById('btn-force-print');
    const btnFinishCrediarioFinal = document.getElementById('btn-finish-crediario-final');
    const credStep1 = document.getElementById('cred-step-1');
    const credStep2 = document.getElementById('cred-step-2');
    const credFlowClientName = document.getElementById('cred-flow-client-name');


    const validateProductFiscal = (prod) => {
        // Regra: Precisa ter NCM, CFOP e Unidade definidos e não estar vazio
        // O 'quick add' geralmente não tem NCM
        if (!prod.ncm || prod.ncm.length < 2) return { valid: false, reason: "Sem NCM" };
        if (!prod.cfop) return { valid: false, reason: "Sem CFOP" };
        if (!prod.csosn) return { valid: false, reason: "Sem CSOSN" };
        return { valid: true };
    };

    // --- Lógica para Remover Cliente Selecionado ---
    const btnRemoveClient = document.getElementById('btn-remove-client');
    const paymentRow = document.getElementById('payment-toggle-row'); // Seletor da linha de pagamento
    const paymentLabel = document.getElementById('summary-payment-method'); // Texto do pagamento

    if (btnRemoveClient) {
        btnRemoveClient.addEventListener('click', (e) => {
            e.stopPropagation();

            // 1. Limpa a variável global do cliente
            selectedCrediarioClient = null;

            // 2. RESETA O PAGAMENTO (Conforme solicitado)
            selectedPaymentMethod = null; // Limpa a variável de pagamento (se existir globalmente)

            if (paymentLabel) {
                paymentLabel.textContent = "Não selecionado";
                paymentLabel.style.color = "var(--text-light)";
                paymentLabel.style.fontWeight = "normal";
            }

            // 3. REMOVE A BORDA VERMELHA (Se estiver ativa)
            if (paymentRow) {
                paymentRow.classList.remove('border-pulse');
            }

            // 4. Atualiza a interface do card de cliente
            updateSummaryClientCard();

            // 5. Feedback visual
            if (typeof showCustomToast === 'function') {
                showCustomToast("Cliente removido. Pagamento resetado.");
            }
        });
    }

    // Função para animar os números (Efeito de contagem)
    const animateTaxValue = (start, end, duration) => {
        const obj = document.getElementById('tax-counter-val');
        if (!obj) return;

        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const current = progress * (end - start) + start;
            obj.innerHTML = current.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            if (progress < 1) window.requestAnimationFrame(step);
        };
        window.requestAnimationFrame(step);
    };

    // Função para processar a estimativa de impostos 2026
    const updateTaxEstimate = (totalVenda) => {
        const totalTax = totalVenda * 0.04; // Alíquota nominal de 4%

        // Dispara a animação
        animateTaxValue(currentTaxDisplay, totalTax, 400);
        currentTaxDisplay = totalTax;

        // Preenche o Modal de Detalhamento
        const tbody = document.getElementById('tax-breakdown-body');
        if (tbody) {
            tbody.innerHTML = '';
            TAX_COMPOSITION_2026.forEach(tax => {
                const valorReal = (totalVenda * (tax.perc / 100));
                tbody.innerHTML += `
                <tr>
                    <td>${tax.label}</td>
                    <td>${tax.perc.toFixed(2)}%</td>
                    <td style="font-weight: 600;">${formatCurrency(valorReal)}</td>
                </tr>
            `;
            });
        }
    };

    // Handler para Opções de Pagamento

    // Localize o bloco por volta da linha 1157 e substitua por este:
    paymentOptions.forEach(option => {
        option.addEventListener('click', () => {
            const method = option.dataset.method;
            const cashSection = document.getElementById('cash-change-section');
            const cardOptions = document.getElementById('credit-card-options');
            const optionsGrid = document.getElementById('single-payment-options');

            // Reset visual active state
            document.querySelectorAll('.payment-card').forEach(c => c.classList.remove('active'));
            option.classList.add('active');

            if (method === 'Dinheiro') {
                if (optionsGrid && cashSection) {
                    optionsGrid.style.display = 'none';
                    cashSection.style.display = 'block';
                    setTimeout(() => document.getElementById('cash-received').focus(), 150);
                }
            } else if (method === 'Crediário') {
                if (!selectedCrediarioClient) {
                    isReturningToPayment = true;
                    closeModal(paymentModal);
                    if (clientSelectionInput) clientSelectionInput.value = '';
                    if (clientSelectionResults) {
                        clientSelectionResults.innerHTML = '';
                        clientSelectionResults.style.display = 'none';
                    }
                    openModal(clientSelectionModal);
                    setTimeout(() => clientSelectionInput.focus(), 100);
                    return;
                }
                showCrediarioScreen();
            } else if (method === 'C. Crédito') {
                if (optionsGrid && cardOptions) {
                    optionsGrid.style.display = 'none';
                    cardOptions.style.display = 'flex';
                }
            } else {
                // Para PIX, Débito e Movecard
                selectedCrediarioClient = null;
                updateSummaryClientCard();

                // Reseta detalhes de cartão para calcular taxa corretamente
                if (method === 'C. Débito') {
                    selectedCardFlag = 'Visa'; /// Default para ref
                    selectedInstallments = 'debit'; // Marcador interno
                }

                handlePaymentSelection(method);
            }
        });
    });

    // --- LISTENER MIGRATION PIX ---
    document.getElementById('btn-pix-qrcode').addEventListener('click', () => {
        selectedPixType = 'qrcode';
        closeModal(document.getElementById('pix-type-modal'));
        handlePaymentSelection('PIX', true);
    });

    document.getElementById('btn-pix-maquininha').addEventListener('click', () => {
        selectedPixType = 'maquininha';
        closeModal(document.getElementById('pix-type-modal'));
        handlePaymentSelection('PIX', true);
    });

    // --- CORREÇÃO: Botões de Voltar no Modal de Pagamento ---
    document.querySelectorAll('.btn-back-payment').forEach(btn => {
        btn.addEventListener('click', () => {
            const cashSection = document.getElementById('cash-change-section');
            const cred_options = document.getElementById('crediario-options');
            const card_options = document.getElementById('credit-card-options');
            const optionsGrid = document.getElementById('single-payment-options');

            if (cashSection) cashSection.style.display = 'none';
            if (cred_options) cred_options.style.display = 'none';
            if (card_options) card_options.style.display = 'none';
            if (optionsGrid) optionsGrid.style.display = 'grid';
        });
    });

    // CONFIRMAR CARTÃO DE CRÉDITO
    const confirmCreditBtn = document.getElementById('confirm-credit-card-btn');
    if (confirmCreditBtn) {
        confirmCreditBtn.addEventListener('click', () => {
            const flag = document.getElementById('card-flag-select').value;
            const installments = document.getElementById('card-installments-select').value;

            // ATUALIZA GLOBAIS
            selectedCardFlag = flag;
            selectedInstallments = installments;

            // Update Sidebar
            const summaryMethod = document.getElementById('summary-payment-method');
            if (summaryMethod) {
                summaryMethod.textContent = `C. Crédito (${flag} - ${installments}x)`;
            }

            // Logic to confirm sale
            handlePaymentSelection('C. Crédito');

            // Close modal handled in handlePaymentSelection usually, but let's ensure
            closeModal(document.getElementById('payment-modal'));

            // Reset UI
            setTimeout(() => {
                document.getElementById('credit-card-options').style.display = 'none';
                document.getElementById('single-payment-options').style.display = 'grid';
            }, 300);
        });
    }

    // Adicione o cálculo de troco em tempo real (Apenas Visual no Modal)
    document.getElementById('cash-received').addEventListener('input', (e) => {
        const total = lastSaleData ? lastSaleData.total : 0;
        const recebido = parseFloat(e.target.value) || 0;
        const troco = recebido - total;

        // Atualiza apenas o texto dentro do modal de pagamento
        const display = document.getElementById('cash-change-value');
        display.textContent = formatCurrency(troco > 0 ? troco : 0);
        display.style.color = troco < 0 ? '#ef4444' : '#10b981';
    });

    // Botão de confirmar dinheiro (Atualiza o Resumo Lateral)
    document.getElementById('confirm-cash-btn').addEventListener('click', () => {
        // Usa o getSubtotal() - discount atual, pois o 'lastSaleData' pode estar defasado se houve edits
        // Mas 'discount' pode mudar durante a função, então salvamos o estado inicial
        const currentSubtotal = getSubtotal();
        const currentTotal = currentSubtotal - discount; // Total ANTES do arredondamento extra
        const recebido = parseFloat(document.getElementById('cash-received').value) || 0;

        if (recebido < (currentTotal - 0.01)) { // Margem de erro pequena para floats
            showCustomAlert("Atenção", "Valor recebido é menor que o total.");
            return;
        }

        const troco = recebido - currentTotal;
        // --- ATUALIZA O RESUMO NA SIDEBAR ---
        const summaryChangeRow = document.getElementById('summary-change-row');
        const summaryChangeValue = document.getElementById('summary-change-value');
        const summaryTotal = document.getElementById('summary-total'); // Para atualizar o total visualmente

        // --- LÓGICA DE ARREDONDAMENTO (ANTES DO TROCO) ---
        // 1. Calcula o total arredondado alvo
        const targetTotal = Math.floor(currentTotal * 2) / 2;
        const roundingDiff = currentTotal - targetTotal;
        let finalTroco = troco;

        // 2. Aplica o arredondamento se necessário
        if (roundingDiff > 0.009) {
            // Atualiza o desconto global adicionando a diferença
            discount += roundingDiff;
            discountInputR.value = discount.toFixed(2);

            // Recalcula o troco com base no NOVO total (menor)
            // Ex: Total 19.99 (Pago 20) -> Troco 0.01
            // Novo Total 19.50 (Pago 20) -> Troco 0.50
            finalTroco = recebido - targetTotal;
            window.lastTrocoValue = finalTroco;

            // Força atualização da View de Totais
            updateSummary();

            if (typeof showCustomToast === 'function') {
                showCustomToast(`Arredondamento: -${formatCurrency(roundingDiff)}`);
            }
        } else {
            window.lastTrocoValue = finalTroco;
        }

        if (summaryChangeRow && summaryChangeValue) {
            // Só mostra se for Dinheiro (redundante mas seguro) e tiver troco/valor definido
            summaryChangeValue.textContent = formatCurrency(finalTroco);
            summaryChangeRow.style.display = 'flex'; // Exibe a barra verde
        }
        // -------------------------------------

        handlePaymentSelection('Dinheiro');

        // Reseta visual para a próxima venda
        document.getElementById('cash-change-section').style.display = 'none';
        document.getElementById('single-payment-options').style.display = 'grid';
    });
    /*
 
    // Cálculo de Troco em tempo real
    document.getElementById('cash-received').addEventListener('input', (e) => {
        const total = lastSaleData ? lastSaleData.total : 0;
        const recebido = parseFloat(e.target.value) || 0;
        const troco = recebido - total;
 
        const display = document.getElementById('cash-change-value');
        display.textContent = formatCurrency(troco > 0 ? troco : 0);
        display.style.color = troco < 0 ? '#ef4444' : '#10b981';
    });
    */

    document.getElementById('confirm-crediario-btn').addEventListener('click', () => {
        if (!selectedCrediarioClient) {
            // Se não tem cliente, abre o modal de busca
            openModal(document.getElementById('client-selection-modal'));
            return;
        }

        // Define método e número de parcelas
        selectedPaymentMethod = 'Crediário';
        const numParcelas = document.getElementById('sale-installments').value;

        window.tempInstallments = numParcelas;

        // Atualiza resumo
        document.getElementById('summary-payment-method').textContent = `Crediário (${numParcelas}x)`;
        updateSummary();

        closeModal(document.getElementById('payment-modal'));

        // Reseta visual do modal para a próxima vez
        setTimeout(() => {
            document.getElementById('single-payment-options').style.display = 'grid';
            document.getElementById('crediario-options').style.display = 'none';
        }, 500);
    });


    // --- Busca de Cliente (Novo Modal) ---
    clientSelectionInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        clientSelectionResults.innerHTML = '';

        if (term.length < 2) {
            clientSelectionResults.style.display = 'none';
            clientSearchHint.style.display = 'block';
            return;
        }

        clientSearchHint.style.display = 'none';

        if (!localClientCache) { carregarClientesDaAPI(); return; }

        const filtered = localClientCache.filter(c =>
            (c.nomeExibicao && c.nomeExibicao.toLowerCase().includes(term)) ||
            (c.apelido && c.apelido.toLowerCase().includes(term))
        );

        if (filtered.length > 0) {
            clientSelectionResults.style.display = 'block';
            filtered.forEach(client => {
                const div = document.createElement('div');
                div.className = 'client-result-item';
                // Mostra Nome + Saldo atual na busca
                div.innerHTML = `
                        <div>
                            <strong>${client.nomeExibicao}</strong> 
                            <small style="color:#777">(${client.apelido || '-'})</small>
                        </div>
                        <div style="font-size:0.85rem; font-weight:600; color:${client.saldoDevedor > 0 ? 'var(--warning-red)' : 'var(--success-green)'}">
                            Dívida: ${formatCurrency(client.saldoDevedor)}
                        </div>
                    `;
                div.addEventListener('click', () => confirmClientSelection(client));
                clientSelectionResults.appendChild(div);
            });
        } else {
            clientSelectionResults.style.display = 'none';
            clientSearchHint.textContent = "Nenhum cliente encontrado.";
            clientSearchHint.style.display = 'block';
        }
    });

    // Botão "+" no modal de busca
    btnNewClientModal.addEventListener('click', () => {
        closeModal(clientSelectionModal);
        resetClienteModal();
        openModal(addClienteModal);
    });

    const confirmClientSelection = (client) => {
        selectedCrediarioClient = client;

        // Atualiza UI Geral
        updateSummaryClientCard();
        closeModal(clientSelectionModal);

        // --- NOVO: Destaca a forma de pagamento para lembrar o operador ---
        const paymentRow = document.getElementById('payment-toggle-row');
        const paymentLabel = document.getElementById('summary-payment-method');

        if (paymentRow) {
            // Adiciona a borda vermelha pulsante
            paymentRow.classList.add('border-pulse');

            // Opcional: Muda o texto para "Definir Pagamento" em vermelho
            if (paymentLabel.textContent === 'Não selecionado') {
                paymentLabel.textContent = "Definir Pagamento!";
                paymentLabel.style.color = "var(--warning-red)";
            }
        }

        // LÓGICA MÁGICA: Se viemos do botão de pagamento, reabre o pagamento direto nas parcelas
        if (isReturningToPayment) {
            isReturningToPayment = false; // Reseta a flag
            openModal(paymentModal);
            showCrediarioScreen(); // Vai direto para as parcelas
        } else {
            // Fluxo normal (apenas selecionou cliente pelo botão do menu)
            // Apenas atualiza o resumo visualmente
            summaryPaymentMethod.textContent = "Crediário (Aguardando)";
        }
    };

    // Botão "Alterar" no Sidebar
    btnChangeSummaryClient.addEventListener('click', () => {
        clientSelectionInput.value = '';
        clientSelectionResults.style.display = 'none';
        clientSearchHint.style.display = 'block';
        openModal(clientSelectionModal);
        setTimeout(() => clientSelectionInput.focus(), 100);
    });

    // --- ATUALIZADA: Lógica do Card de Cliente (CORRIGIDA) ---
    const updateSummaryClientCard = () => {
        const card = document.getElementById('summary-client-card');
        const nameText = document.getElementById('summary-client-name-text');
        const creditInfo = document.getElementById('client-credit-info');
        const btnRemove = document.getElementById('btn-remove-client');
        const limitFill = document.getElementById('summary-limit-fill');
        const limitValue = document.getElementById('summary-limit-value');

        // Se existe um cliente selecionado (global selectedCrediarioClient)
        if (selectedCrediarioClient) {
            // Estilo visual: Cliente Identificado
            card.classList.add('active-client');

            // Texto
            nameText.textContent = selectedCrediarioClient.nomeExibicao || selectedCrediarioClient.nomeCompleto;
            nameText.style.color = "var(--text-dark)";

            // 1. MOSTRA o botão de remover (SEMPRE que tiver cliente)
            if (btnRemove) btnRemove.style.display = 'inline-flex';

            // Lógica da Barra de Crédito
            const limite = parseFloat(selectedCrediarioClient.limite) || 0;

            if (limite > 0) {
                creditInfo.style.display = 'block';

                const dividaAntiga = parseFloat(selectedCrediarioClient.saldoDevedor) || 0;
                const compraAtual = lastSaleData ? lastSaleData.total : 0;

                const disponivelReal = limite - dividaAntiga;
                const saldoFinalPrevisto = disponivelReal - compraAtual;

                limitValue.textContent = formatCurrency(saldoFinalPrevisto);

                const usoTotal = dividaAntiga + compraAtual;
                let percentual = (usoTotal / limite) * 100;
                if (percentual > 100) percentual = 100;

                limitFill.style.width = `${percentual}%`;

                if (saldoFinalPrevisto < 0) {
                    limitFill.classList.add('danger');
                    limitValue.style.color = 'var(--warning-red)';
                } else {
                    limitFill.classList.remove('danger');
                    limitValue.style.color = 'var(--text-dark)';
                }
            } else {
                // Cliente selecionado mas sem limite: Esconde SÓ a barra de crédito
                creditInfo.style.display = 'none';
                // (A linha que escondia o botão foi removida daqui)
            }

        } else {
            // --- CONSUMIDOR FINAL (Nenhum cliente selecionado) ---
            card.classList.remove('active-client');
            nameText.textContent = "Consumidor Final";
            nameText.style.color = "#94a3b8";

            // ESCONDE o botão de remover
            if (btnRemove) btnRemove.style.display = 'none';

            // Esconde info de crédito
            creditInfo.style.display = 'none';
        }
    };


    // --- Funções de Token ---
    const verificarToken = () => { const token = localStorage.getItem(TOKEN_KEY); const expiration = localStorage.getItem(TOKEN_EXPIRATION_KEY); const now = Date.now(); if (token && expiration && now < parseInt(expiration)) { console.log("Token válido."); return true; } else { console.log("Token inválido/expirado."); localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_EXPIRATION_KEY); return false; } };
    const salvarToken = () => { const now = Date.now(); const expirationTime = now + TOKEN_DURATION_HOURS * 60 * 60 * 1000; const tokenValue = `caixaAberto_${now}`; localStorage.setItem(TOKEN_KEY, tokenValue); localStorage.setItem(TOKEN_EXPIRATION_KEY, expirationTime.toString()); console.log("Token salvo, expira:", new Date(expirationTime)); };
    const limparToken = () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_EXPIRATION_KEY); console.log("Token limpo."); };

    // --- Funções de Formatação ---
    const formatCurrency = (value) => { const numericValue = Number(value); if (isNaN(numericValue)) return 'R$ 0,00'; return numericValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); };
    const formatTimestamp = (date) => { const pad = (n) => n < 10 ? '0' + n : n; const d = date.getDate(), mo = date.getMonth() + 1, y = date.getFullYear(); const h = date.getHours(), mi = date.getMinutes(), s = date.getSeconds(); return `${pad(d)}/${pad(mo)}/${y} ${pad(h)}:${pad(mi)}:${pad(s)}`; };
    const formatTime = (date) => { const pad = (n) => n < 10 ? '0' + n : n; const h = date.getHours(), mi = date.getMinutes(), s = date.getSeconds(); return `${pad(h)}:${pad(mi)}:${pad(s)}`; };

    // --- Funções de Renderização ---

    // --- Função Renderizar Carrinho (Versão Limpa - Apenas API Apps Script) ---
    // --- Função Renderizar Carrinho (DESIGN MODERNO) ---
    const renderCart = () => {
        cartItemsBody.innerHTML = '';

        // 1. Resetar controles globais (sempre permitidos agora)
        if (cart.length > 0) {
            // discountInputR.disabled = false; // Mantém desativado até autorização
            discountInputR.placeholder = "0,00";
            document.querySelectorAll('.perc-btn').forEach(b => b.disabled = false);

            emptyState.style.display = 'none';
            itemListTable.style.display = 'table';
            itemListContainer.classList.remove('empty');
        } else {
            // Estado vazio
            discountInputR.disabled = true;
            emptyState.style.display = 'flex';
            itemListTable.style.display = 'none';
            itemListContainer.classList.add('empty');
            updateSummary();
            return;
        }

        // --- VALIDAÇÃO DE OFERTA NO RENDER ---
        const isOfferApplicable = (!selectedPaymentMethod || selectedPaymentMethod === 'Dinheiro' || selectedPaymentMethod === 'PIX');

        // 2. Loop para desenhar os itens
        cart.forEach(item => {
            const tr = document.createElement('tr');
            tr.dataset.id = item.id;

            // Define se a oferta está "ativa" visualmente
            const showOfferVisuals = item.hasOffer && isOfferApplicable;
            const itemDisplayPrice = showOfferVisuals ? item.price : item.originalPrice;

            // Define ícone base (pode melhorar se tiver imagem real)
            const iconHtml = item.imgUrl
                ? `<img src="${item.imgUrl}" style="width:100%; height:100%; object-fit:contain;">`
                : `<i class='bx bx-package'></i>`;

            tr.innerHTML = `
                <td>
                    <div class="product-cell-modern">
                        <div class="prod-icon-box">${iconHtml}</div>
                        <div class="prod-info-box">
                            <span class="prod-name">${item.name}</span>
                            <div style="display:flex; gap:6px; align-items:center;">
                                <span class="prod-barcode">#${item.id}</span>
                                ${item.hasOffer ? `
                                    <span class="carnaval-tag" style="padding: 1px 6px; font-size: 0.6rem; background:${showOfferVisuals ? '#db0038' : '#e5e7eb'}; color:${showOfferVisuals ? 'white' : '#9ca3af'}; border-radius:10px; font-weight:700; ${!showOfferVisuals ? 'text-decoration:line-through;' : ''}">
                                        <i class='bx bx-party'></i> Carnaval
                                    </span>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </td>
                
                <td class="text-center">
                    <div class="qty-capsule">
                        <button class="qty-btn" data-action="decrease" data-id="${item.id}">-</button>
                        <span class="qty-display">${item.quantity}</span>
                        <button class="qty-btn" data-action="increase" data-id="${item.id}">+</button>
                    </div>
                </td>
                
                <td class="text-center">
                    <div style="display:flex; flex-direction:column; align-items:center;">
                        <span class="unit-price-display" style="${showOfferVisuals ? 'color:#db0038; font-weight:700;' : ''}">${formatCurrency(itemDisplayPrice)}</span>
                        ${showOfferVisuals ? `<small style="text-decoration:line-through; color:#9ca3af; font-size:0.7rem;">${formatCurrency(item.originalPrice)}</small>` : ''}
                        ${item.hasOffer && !isOfferApplicable ? `<small style="color:#ef4444; font-size:0.6rem; font-weight:600;">(Só p/ Dinheiro/PIX)</small>` : ''}
                    </div>
                </td>
                
                <td class="text-center">
                    <div class="discount-capsule" title="${item.hasOffer ? 'Oferta Carnaval' : 'Clique para editar'}">
                        <input type="number" 
                               class="discount-input-embedded" 
                               value="${showOfferVisuals ? (item.discountPercent ? parseFloat(item.discountPercent).toFixed(0) : '') : '0'}" 
                               placeholder="0" 
                               min="0" max="100"
                               ${item.hasOffer ? 'readonly disabled style="background:transparent; cursor:default;"' : `onchange="updateCartItem('${item.id}', 'discountPercent', this.value)"`}
                               onclick="this.select()">
                        <span class="discount-symbol">%</span>
                    </div>
                </td>
                
                <td class="text-right" style="padding-right: 20px;">
                    <span class="total-price-display">${formatCurrency(itemDisplayPrice * item.quantity)}</span>
                </td>
                
                <td class="text-center">
                    <button class="btn-trash-item remove-btn" data-id="${item.id}" title="Remover">
                        <i class='bx bx-trash'></i>
                    </button>
                </td>
            `;

            // Efeito visual de entrada
            if (item.isNew) {
                tr.style.animation = "fadeInHighlight 0.5s";
                delete item.isNew;
            }

            cartItemsBody.appendChild(tr);
        });

        updateSummary();
    };

    // Abre o modal de transparência tributária ao clicar no card
    const taxCard = document.getElementById('open-tax-modal');
    if (taxCard) {
        taxCard.addEventListener('click', () => {
            const modal = document.getElementById('tax-details-modal');
            if (modal) openModal(modal);
        });
    }

    const updateSummary = () => {
        // --- LÓGICA DE VALIDAÇÃO DE OFERTA POR PAGAMENTO ---
        // A oferta de "Carnaval" (promocional) só é válida para Dinheiro ou PIX
        const isOfferApplicable = (!selectedPaymentMethod || selectedPaymentMethod === 'Dinheiro' || selectedPaymentMethod === 'PIX');

        // 1. Cálculos (Mantidos)
        const subtotalGross = cart.reduce((acc, item) => acc + (item.originalPrice * item.quantity), 0);

        const totalNetItems = cart.reduce((acc, item) => {
            let itemPrice = item.price;

            // Se o item tem oferta mas o pagamento não permite, usa o preço original
            if (item.hasOffer && !isOfferApplicable) {
                // Se existe um desconto manual (não vindo da oferta), poderíamos aplicar, 
                // mas como bloqueamos a edição de itens com oferta, usamos o cheio.
                itemPrice = item.originalPrice;
            }

            return acc + (itemPrice * item.quantity);
        }, 0);

        const totalDiscount = (subtotalGross - totalNetItems) + discount;
        const finalTotal = subtotalGross - totalDiscount;

        updateTaxEstimate(finalTotal);

        // --- CÁLCULO DA TAXA INFINITEPAY ---
        const taxRow = document.getElementById('infinitepay-tax-row');
        const taxValEl = document.getElementById('infinitepay-tax-val');

        let txVal = 0;
        let rate = 0;

        if (selectedPaymentMethod === 'PIX') {
            rate = infinitePayRates.pix;
        } else if (selectedPaymentMethod === 'C. Débito') {
            // Verifica bandeira se necessário, mas rate é fixo para débito geral ou específico
            // Pelo objeto: "debit": 0.85, "debit_elo_amex": 2.08
            // Como não selecionamos bandeira no débito rápido, vamos assumir padrão ou criar modal depois?
            // Por enquanto, usa padrão:
            rate = infinitePayRates.debit;
        } else if (selectedPaymentMethod === 'Movecard') {
            rate = infinitePayRates.movecard;
        } else if (selectedPaymentMethod === 'C. Crédito') {
            const isEloAmex = (selectedCardFlag === 'Elo' || selectedCardFlag === 'Amex');
            const instKey = selectedInstallments + 'x';

            if (selectedInstallments === '1') {
                rate = isEloAmex ? infinitePayRates.credit_spot_elo_amex : infinitePayRates.credit_spot;
            } else {
                const table = isEloAmex ? infinitePayRates.installments_elo_amex : infinitePayRates.installments_visa_master;
                rate = table[instKey] || 0;
            }
        }

        // Se rate > 0, calcula
        if (rate > 0) {
            txVal = finalTotal * (rate / 100);
            if (taxValEl) taxValEl.textContent = formatCurrency(txVal);
            if (taxRow) taxRow.style.display = 'flex';
        } else {
            // Se for dinheiro ou taxa 0
            if (selectedPaymentMethod === 'Dinheiro' || !selectedPaymentMethod) {
                if (taxRow) taxRow.style.display = 'none';
            } else {
                // Exibe 0,00 se for Pix (rate 0) ou outro
                if (taxValEl) taxValEl.textContent = formatCurrency(0);
                if (taxRow) taxRow.style.display = 'flex';
            }
        }
        // -----------------------------------

        // 2. Atualiza Interface
        const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

        // Subtotal e Total
        document.getElementById('summary-subtotal').textContent = formatCurrency(subtotalGross);
        document.getElementById('summary-total').textContent = formatCurrency(finalTotal);
        if (document.getElementById('item-count')) document.getElementById('item-count').textContent = totalItems;

        // Atualiza Modais externos (Pagamento/Recibo)
        if (document.getElementById('payment-total')) document.getElementById('payment-total').textContent = formatCurrency(finalTotal);
        if (document.getElementById('receipt-total')) document.getElementById('receipt-total').textContent = formatCurrency(finalTotal);

        // --- LÓGICA DE DESCONTO (ATUALIZADA) ---
        const rowDiscount = document.getElementById('row-discount-display');
        const summaryDiscountVal = document.getElementById('summary-discount'); // Texto na lista
        const btnDiscountVal = document.getElementById('summary-discount-btn-val'); // Texto no botão

        // Valor negativo para exibição
        const discountDisplay = totalDiscount > 0 ? formatCurrency(totalDiscount * -1) : "R$ 0,00";

        // Atualiza botão do grid
        if (btnDiscountVal) btnDiscountVal.textContent = totalDiscount > 0 ? discountDisplay : "R$ 0,00";

        // Atualiza linha do recibo
        if (summaryDiscountVal) summaryDiscountVal.textContent = discountDisplay;

        // Mostra/Esconde linha de desconto na lista final
        if (rowDiscount) {
            rowDiscount.style.display = totalDiscount > 0.01 ? 'flex' : 'none';
        }

        // Dados globais para o recibo
        lastSaleData = {
            subtotal: subtotalGross,
            discount: totalDiscount,
            total: finalTotal,
            paymentMethod: selectedPaymentMethod
        };

        updateSummaryClientCard();
    };


    function parseDataSegura(dataStr) {
        if (!dataStr || typeof dataStr !== 'string' || dataStr === "Quitado") return null;

        // Prioridade total ao formato brasileiro DD/MM/YYYY
        const partes = dataStr.split('/');
        if (partes.length === 3) {
            const dia = parseInt(partes[0]);
            const mes = parseInt(partes[1]) - 1;
            const ano = parseInt(partes[2]);
            return new Date(ano, mes, dia, 12, 0, 0);
        }

        const d = new Date(dataStr);
        return isNaN(d.getTime()) ? null : d;
    }

    // --- VARIÁVEIS GLOBAIS NOVAS ---
    let currentProductFilter = 'all'; // all, fiscal_ok, fiscal_pending
    let editingProductId = null;      // ID do produto sendo editado
    let currentProductPage = 1;       // <--- ADICIONE ISSO (Página Atual)
    const ITEMS_PER_PAGE = 50;        // <--- ADICIONE ISSO (Itens por página)

    // =======================================================
    // LÓGICA DE PRODUTOS (PESQUISA, FILTROS E EDIÇÃO)
    // =======================================================

    // 2. Atualizar Contadores dos Filtros (Corrigido)
    const updateProductCounters = () => {
        if (!localProductCache) return;

        const total = localProductCache.length;

        // Verifica convertendo para String para evitar erro se vier como número
        const ok = localProductCache.filter(p =>
            p.ncm && String(p.ncm).trim().length >= 2 && p.cfop
        ).length;

        const pending = total - ok;
        const offers = localProductCache.filter(p => p.promoPrice && parseFloat(p.promoPrice) > 0).length;

        document.getElementById('count-all').textContent = total;
        document.getElementById('count-ok').textContent = ok;
        document.getElementById('count-pending').textContent = pending;
        if (document.getElementById('count-offers')) document.getElementById('count-offers').textContent = offers;
    };
    window.updateProductCounters = updateProductCounters;

    // 1. Função Renderizar (COM PAGINAÇÃO)
    const renderProdutosPage = () => {
        const container = document.getElementById('produtos-table-container');
        const searchInput = document.getElementById('products-search-input');

        // Atualiza contadores
        if (typeof updateProductCounters === 'function') updateProductCounters();

        // Verificação de segurança
        if (!localProductCache || localProductCache.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="bx bx-package"></i><p>Nenhum produto cadastrado.</p></div>';
            return;
        }

        const term = searchInput ? searchInput.value.toLowerCase().trim() : "";

        // 1. Filtragem
        let produtosFiltrados = localProductCache.filter(p => {
            const safeName = (p.name || "").toString().toLowerCase();
            const safeBrand = (p.brand || "").toString().toLowerCase();
            const safeId = (p.id || "").toString().toLowerCase();
            const safeNcm = (p.ncm || "").toString().toLowerCase();

            const matchesSearch =
                safeName.includes(term) ||
                safeId.includes(term) ||
                safeNcm.includes(term) ||
                safeBrand.includes(term);

            if (!matchesSearch) return false;

            const hasNcm = p.ncm && String(p.ncm).trim().length >= 2;
            const hasCfop = p.cfop && String(p.cfop).trim().length >= 3;
            const isFiscalOk = (hasNcm && hasCfop);

            if (currentProductFilter === 'fiscal_ok' && !isFiscalOk) return false;
            if (currentProductFilter === 'fiscal_pending' && isFiscalOk) return false;
            if (currentProductFilter === 'offers' && !(p.promoPrice && parseFloat(p.promoPrice) > 0)) return false;

            return true;
        });

        // ========================================================
        // APLICAÇÃO DA ORDEM (MAIS RECENTES PRIMEIRO)
        // Inverte a lista filtrada antes de calcular a paginação
        // ========================================================
        produtosFiltrados.reverse();

        // DICA: Se preferir ordenar por ID numérico de forma garantida:
        // produtosFiltrados.sort((a, b) => Number(b.id) - Number(a.id));
        // ========================================================

        if (produtosFiltrados.length === 0) {
            container.innerHTML = `
        <div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-light);">
            <i class='bx bx-search-alt' style="font-size: 3rem; margin-bottom: 10px;"></i>
            <p>Nada encontrado para "${term}".</p>
        </div>`;
            return;
        }

        // 2. Lógica de Paginação (agora com a lista já invertida)
        const totalItems = produtosFiltrados.length;
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

        // Garante que a página atual é válida
        if (currentProductPage > totalPages) currentProductPage = totalPages;
        if (currentProductPage < 1) currentProductPage = 1;

        const startIndex = (currentProductPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const produtosDaPagina = produtosFiltrados.slice(startIndex, endIndex);

        // --- TABELA ---
        const table = document.createElement('table');
        table.className = 'products-table';

        table.innerHTML = `
        <thead>
            <tr>
                <th width="30px" class="text-center">
                    <input type="checkbox" id="select-all-products" ${produtosDaPagina.length > 0 && produtosDaPagina.every(p => selectedProductIds.has(String(p.id))) ? 'checked' : ''}>
                </th>
                <th width="40%">Produto / Marca</th>
                <th width="15%">Preço</th>
                <th width="15%">Desc. %</th>
                <th width="20%">Situação Fiscal</th>
                <th width="10%" class="text-center">Ações</th>
            </tr>
        </thead>
        <tbody></tbody>
        `;

        const tbody = table.querySelector('tbody');

        // Renderiza os produtos da página atual
        produtosDaPagina.forEach(prod => {
            const tr = document.createElement('tr');
            const prodIdStr = String(prod.id);
            const isChecked = selectedProductIds.has(prodIdStr);

            const isFiscalOk = (prod.ncm && prod.cfop);
            const statusHtml = isFiscalOk
                ? `<span class="fiscal-status ok" title="NCM: ${prod.ncm}"><i class='bx bx-check'></i> OK</span>`
                : `<span class="fiscal-status pending"><i class='bx bx-error'></i> Pendente</span>`;

            const imgHtml = prod.imgUrl && prod.imgUrl.length > 10
                ? `<img src="${prod.imgUrl}" class="product-thumb-sm" alt="Foto">`
                : `<div class="product-thumb-placeholder"><i class="bx bx-package"></i></div>`;

            const brandHtml = prod.brand ? `<span class="brand-tag">${prod.brand}</span>` : '';

            tr.innerHTML = `
            <td class="text-center">
                <input type="checkbox" class="product-checkbox" data-id="${prod.id}" ${isChecked ? 'checked' : ''}>
            </td>
            <td>
                <div class="product-cell-wrapper">
                    ${imgHtml}
                    <div style="display:flex; flex-direction:column;">
                        <strong style="color:var(--text-dark); font-size: 0.95rem;">${prod.name}</strong>
                        <div style="display:flex; gap:8px; align-items:center;">
                            <span style="font-size:0.75rem; color:var(--text-light);">#${prod.id}</span>
                            ${brandHtml}
                        </div>
                    </div>
                </div>
            </td>
            <td>
                <div style="font-weight:600; color:var(--text-dark);">${formatCurrency(prod.price)}</div>
                ${prod.costPrice > 0 ? `<small style="color:var(--text-light); font-size:0.7rem;">Custo: ${formatCurrency(prod.costPrice)}</small>` : ''}
            </td>
            <td>
                ${prod.promoPrice && prod.promoPrice > 0 ? `
                    <div class="carnaval-tag-wrapper">
                        <span class="carnaval-tag">
                            <i class='bx bx-party'></i> Carnaval
                        </span>
                        <div class="carnaval-value">
                            ${(((prod.price - prod.promoPrice) / prod.price) * 100).toFixed(0)}% OFF
                        </div>
                    </div>
                ` : '<span style="color:var(--text-light); font-size:0.8rem;">---</span>'}
            </td>
            <td>
                ${statusHtml}
                <div style="font-size:0.7rem; color:var(--text-light); margin-top:2px;">
                    ${prod.ncm ? 'NCM: ' + prod.ncm : 'Sem NCM'}
                </div>
            </td>
            <td class="text-center">
                <button class="btn btn-sm btn-secondary" onclick="openProductEdit('${prod.id}')" title="Editar">
                    <i class='bx bx-edit-alt'></i>
                </button>
            </td>
            `;
            tbody.appendChild(tr);
        });

        // Event listeners para os checkboxes
        table.querySelectorAll('.product-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const id = String(e.target.dataset.id);
                if (e.target.checked) {
                    selectedProductIds.add(id);
                } else {
                    selectedProductIds.delete(id);
                }
                updateDownloadButtonState();
            });
        });

        const selectAllCb = table.querySelector('#select-all-products');
        if (selectAllCb) {
            selectAllCb.addEventListener('change', (e) => {
                const checked = e.target.checked;
                produtosDaPagina.forEach(p => {
                    const id = String(p.id);
                    if (checked) {
                        selectedProductIds.add(id);
                    } else {
                        selectedProductIds.delete(id);
                    }
                });
                renderProdutosPage(); // Re-renderiza para atualizar os checkboxes individuais
                updateDownloadButtonState();
            });
        }

        // 3. Rodapé com Paginação
        if (totalPages > 1) {
            const paginationRow = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 4;
            td.style.padding = "15px";
            td.style.backgroundColor = "#f9fafb";
            td.style.borderTop = "1px solid #e5e7eb";

            // Controles
            const controlsDiv = document.createElement('div');
            controlsDiv.style.display = "flex";
            controlsDiv.style.justifyContent = "space-between";
            controlsDiv.style.alignItems = "center";

            // Botão Anterior
            const btnPrev = document.createElement('button');
            btnPrev.className = "btn btn-sm btn-secondary";
            btnPrev.innerHTML = "<i class='bx bx-chevron-left'></i> Anterior";
            btnPrev.disabled = currentProductPage === 1;
            btnPrev.onclick = () => {
                currentProductPage--;
                renderProdutosPage();
                // Rola suavemente para o topo da tabela
                container.scrollIntoView({ behavior: 'smooth', block: 'start' });
            };

            // Texto Informativo
            const infoText = document.createElement('span');
            infoText.style.color = "var(--text-light)";
            infoText.style.fontSize = "0.9rem";
            infoText.innerHTML = `Página <strong>${currentProductPage}</strong> de <strong>${totalPages}</strong> (${totalItems} itens)`;

            // Botão Próximo
            const btnNext = document.createElement('button');
            btnNext.className = "btn btn-sm btn-secondary";
            btnNext.innerHTML = "Próximo <i class='bx bx-chevron-right'></i>";
            btnNext.disabled = currentProductPage === totalPages;
            btnNext.onclick = () => {
                currentProductPage++;
                renderProdutosPage();
                container.scrollIntoView({ behavior: 'smooth', block: 'start' });
            };

            controlsDiv.appendChild(btnPrev);
            controlsDiv.appendChild(infoText);
            controlsDiv.appendChild(btnNext);

            td.appendChild(controlsDiv);
            paginationRow.appendChild(td);
            tbody.appendChild(paginationRow);
        }

        container.innerHTML = '';
        container.appendChild(table);
    };
    window.renderProdutosPage = renderProdutosPage;

    // --- FUNÇÃO RENDERIZAR CLIENTES (VERSÃO EMBLEMAS + CORREÇÃO DATA) ---
    // --- SUBSTITUA A FUNÇÃO renderClientesPage POR ESTA ---
    const renderClientesPage = () => {
        const container = document.getElementById('clientes-list-container');
        const searchInput = document.getElementById('clientes-page-search');

        container.innerHTML = '';

        if (localClientCache === null) {
            container.innerHTML = '<div style="padding:40px; text-align:center; color:#888;"><i class="bx bx-loader-alt bx-spin font-2rem"></i><p>Buscando carteira de clientes...</p></div>';
            return;
        }

        const term = searchInput ? searchInput.value.toLowerCase() : "";

        // Ordenação e Filtro
        let clientesFiltrados = localClientCache.filter(c =>
            (c.nomeExibicao && c.nomeExibicao.toLowerCase().includes(term)) ||
            (c.apelido && c.apelido.toLowerCase().includes(term))
        ).sort((a, b) => {
            const nomeA = a.nomeExibicao || a.apelido || "";
            const nomeB = b.nomeExibicao || b.apelido || "";
            return nomeA.localeCompare(nomeB);
        });

        if (clientesFiltrados.length === 0) {
            container.innerHTML = `
            <div style="text-align:center; padding:40px; background:#f9fafb; border-radius:12px;">
                <i class='bx bx-user-x' style="font-size:3rem; color:#d1d5db;"></i>
                <p style="color:#6b7280; margin-top:10px;">Nenhum cliente encontrado.</p>
            </div>`;
            return;
        }

        const table = document.createElement('table');
        table.className = 'item-list-table clients-table';
        table.style.width = '100%';

        // Ícone do olho (privacidade)
        const eyeIconClass = areValuesHidden ? 'bx-show' : 'bx-hide';

        table.innerHTML = `
        <thead>
            <tr>
                <th style="padding-left:16px;">Cliente</th>
                <th style="text-align:center;">Situação</th>
                <th>
                    Saldo Devedor 
                    <button class="toggle-privacy-btn" id="btn-toggle-privacy" title="Esconder Valores">
                        <i class='bx ${eyeIconClass}'></i>
                    </button>
                </th>
                <th style="text-align:right; padding-right:16px;">Ações</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;

        const tbody = table.querySelector('tbody');

        // Data de hoje zerada para comparação correta
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        clientesFiltrados.forEach(cliente => {
            const tr = document.createElement('tr');
            const blurClass = areValuesHidden ? 'blur-value' : '';


            // --- CÁLCULO DE DATA E EMBLEMAS CORRIGIDO ---
            let diffDays = 0;
            let dataObj = parseDataSegura(cliente.proximoVencimento);
            let temData = (dataObj instanceof Date && !isNaN(dataObj.getTime()));

            // CALCULA A DIFERENÇA DE DIAS REAL
            if (temData) {
                const hoje = new Date();
                hoje.setHours(0, 0, 0, 0);
                const dataVenc = new Date(dataObj);
                dataVenc.setHours(0, 0, 0, 0);

                const diffTime = dataVenc - hoje;
                diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }
            // --------------------------------------------

            // Se o saldo for quase zero, força status quitado independente da data
            const isQuitado = parseFloat(cliente.saldoDevedor) <= 0.01;

            let badgeHtml = '';

            if (isQuitado) {
                // QUITADO (Verde)
                badgeHtml = `<div class="status-badge badge-quitado" data-tooltip="Cliente sem débitos">
                            <i class='bx bx-check-double'></i> <span>OK</span>
                         </div>`;
            } else if (!temData) {
                // COM DÍVIDA, MAS DATA INVÁLIDA
                badgeHtml = `<div class="status-badge" style="background-color:#9ca3af;" data-tooltip="Verifique o Dia de Vencimento no Cadastro">
                            <i class='bx bx-help-circle'></i> <span>S/ Data</span>
                         </div>`;
            } else {
                // LÓGICA DE CORES DA FATURA
                if (diffDays < 0) {
                    // ATRASADO (Vermelho)
                    const diasAtraso = Math.abs(diffDays);
                    badgeHtml = `<div class="status-badge badge-atrasado" data-tooltip="Fatura vencida há ${diasAtraso} dias">
                                <i class='bx bx-error-circle'></i> <span>-${diasAtraso}d</span>
                             </div>`;
                } else if (diffDays === 0) {
                    // VENCE HOJE (Laranja Escuro)
                    badgeHtml = `<div class="status-badge" style="background-color:#ea580c; color:white;" data-tooltip="Vence Hoje!">
                                <i class='bx bx-bell'></i> <span>HOJE</span>
                             </div>`;
                } else if (diffDays <= 3) {
                    // VENCE EM BREVE (Até 3 dias) - Amarelo/Laranja
                    badgeHtml = `<div class="status-badge badge-alerta" data-tooltip="Fecha em breve">
                                <i class='bx bx-time-five'></i> <span>${diffDays}d</span>
                             </div>`;
                } else if (diffDays <= 10) {
                    // FATURA ABERTA (Próxima do fechamento) - Azul
                    badgeHtml = `<div class="status-badge" style="background-color:#3b82f6; color:white;" data-tooltip="Fatura Aberta">
                                <i class='bx bx-calendar'></i> <span>${diffDays}d</span>
                             </div>`;
                } else {
                    // FATURA FUTURA (Longe) - Verde Claro ou Cinza
                    badgeHtml = `<div class="status-badge badge-em-dia" data-tooltip="Vencimento distante">
                                <i class='bx bx-calendar-check'></i> <span>${diffDays}d</span>
                             </div>`;
                }
            }

            if (parseFloat(cliente.saldoDevedor) <= 0.01) { // Considera 0.01 como quitado (evita erros de arredondamento)
                // QUITADO (Verde Azulado)
                badgeHtml = `<div class="status-badge badge-quitado" data-tooltip="Cliente Quitado">
                            <i class='bx bx-badge-check'></i> <span>OK</span>
                         </div>`;
            } else if (!temData) {
                // TEM DÍVIDA MAS SEM DATA (Cinza)
                badgeHtml = `<div class="status-badge" style="background-color:#9ca3af;" data-tooltip="Data não informada">
                            <i class='bx bx-calendar-x'></i> <span>S/ Data</span>
                         </div>`;
            } else {
                // TEM DÍVIDA E TEM DATA
                if (diffDays < 0) {
                    // ATRASADO (Vermelho)
                    const diasAtraso = Math.abs(diffDays);
                    badgeHtml = `<div class="status-badge badge-atrasado" data-tooltip="${diasAtraso} dia(s) de atraso">
                                <i class='bx bx-time'></i> <span>-${diasAtraso}d</span>
                             </div>`;
                } else if (diffDays === 0) {
                    // VENCE HOJE (Laranja Escuro)
                    badgeHtml = `<div class="status-badge badge-alerta" style="background-color:#ea580c;" data-tooltip="Vence Hoje!">
                                <i class='bx bx-bell'></i> <span>HOJE</span>
                             </div>`;
                } else if (diffDays <= 5) {
                    // ALERTA / VENCE LOGO (Amarelo/Laranja)
                    badgeHtml = `<div class="status-badge badge-alerta" data-tooltip="Vence em ${diffDays} dia(s)">
                                <i class='bx bx-bell'></i> <span>${diffDays}d</span>
                             </div>`;
                } else {
                    // EM DIA (Verde)
                    badgeHtml = `<div class="status-badge badge-em-dia" data-tooltip="Em dia (Vence em ${diffDays} dias)">
                                <i class='bx bx-check'></i> <span>Em dia</span>
                             </div>`;
                }
            }

            const corValor = cliente.saldoDevedor > 0 ? 'var(--text-dark)' : 'var(--success-green)';

            tr.innerHTML = `
            <td class="client-name-cell">
                <strong>${cliente.nomeExibicao}</strong>
                <small>${cliente.apelido && cliente.nomeExibicao !== cliente.apelido ? cliente.apelido : ''}</small>
            </td>
            <td style="text-align:center;">
                ${badgeHtml}
            </td>
            <td class="currency ${blurClass}" style="font-size:1rem; color: ${corValor};">
                ${formatCurrency(cliente.saldoDevedor)}
            </td>
            <td>
                <div class="action-btn-group">
                    <button class="btn-action-md btn-view" data-id="${cliente.idCliente}" title="Ver Detalhes">
                        <i class='bx bx-show'></i>
                    </button> 
                    <button class="btn-action-md btn-pay" data-id="${cliente.idCliente}" title="Receber">
                        <i class='bx bx-dollar'></i>
                    </button>
                </div>
            </td>
        `;
            tbody.appendChild(tr);
        });

        container.appendChild(table);

        // Reatribui eventos
        document.querySelectorAll('.btn-view').forEach(btn => btn.addEventListener('click', () => openClienteDetails(btn.dataset.id)));
        document.querySelectorAll('.btn-pay').forEach(btn => btn.addEventListener('click', () => openClientePayment(btn.dataset.id)));

        const toggleBtn = document.getElementById('btn-toggle-privacy');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                areValuesHidden = !areValuesHidden;
                renderClientesPage();
            });
        }
    };

    // Mockup de Marcas para teste (Depois virá do banco)
    let brandsCache = ["Samsung", "Apple", "Xiaomi", "Motorola", "Dell", "Logitech", "TP-Link", "Multilaser"];

    // 1. LISTENER DO NOVO BOTÃO ADICIONAR
    const btnAddProduct = document.getElementById('btn-add-product');
    if (btnAddProduct) {
        btnAddProduct.addEventListener('click', () => {
            // Chama a função de edição passando NULL, indicando que é um NOVO produto
            openProductEdit(null);
        });
    }

    // 3. Abrir Modal de Edição
    window.openProductEdit = (id) => {
        // Reseta visual (Tamanho e Ícone)
        modalContent.classList.remove('modal-expanded');
        const maxIcon = btnMaximize.querySelector('i');
        if (maxIcon) maxIcon.classList.replace('bx-collapse', 'bx-expand');

        // Limpa Preview de Imagem
        updateImagePreview('');

        if (id) {
            // --- MODO EDIÇÃO ---
            const prod = localProductCache.find(p => String(p.id) === String(id));
            if (!prod) return;

            editingProductId = id; // Define ID Global

            // Preenche Campos
            inputCode.value = prod.id;
            document.getElementById('edit-prod-name').value = prod.name;
            document.getElementById('edit-prod-price').value = prod.price;
            document.getElementById('edit-prod-cost').value = prod.costPrice || '';
            document.getElementById('edit-prod-brand').value = prod.brand || '';
            document.getElementById('edit-prod-img-url').value = prod.imgUrl || '';
            document.getElementById('edit-prod-stock').value = prod.stock || 0;
            updateImagePreview(prod.imgUrl);

            // Trava o Código
            inputCode.disabled = true;
            inputCode.classList.add('bg-locked');
            if (btnUnlockCode) {
                btnUnlockCode.innerHTML = "<i class='bx bx-lock-alt'></i>";
                btnUnlockCode.classList.remove('unlocked');
            }

            // Fiscais
            document.getElementById('edit-prod-ncm').value = prod.ncm || '';
            document.getElementById('edit-prod-cest').value = prod.cest || '';
            document.getElementById('edit-prod-cfop').value = prod.cfop || '5102';
            document.getElementById('edit-prod-unit').value = prod.unit || 'UN';
            document.getElementById('edit-prod-csosn').value = prod.csosn || '102';
            document.getElementById('edit-prod-origem').value = prod.origem || '0';

        } else {
            // --- MODO NOVO PRODUTO ---
            editingProductId = null; // Nenhum ID sendo editado

            // Limpa tudo
            document.getElementById('edit-product-form').reset();

            // Destrava Código (Obrigatório digitar)
            inputCode.disabled = false;
            inputCode.classList.remove('bg-locked');
            inputCode.value = "";
            inputCode.placeholder = "Digite ou Escaneie o Código";
            if (btnUnlockCode) {
                btnUnlockCode.style.display = 'none'; // Esconde cadeado pois já está livre
            }

            // Valores Padrão
            document.getElementById('edit-prod-cfop').value = '5102';
            document.getElementById('edit-prod-unit').value = 'UN';
            document.getElementById('edit-prod-csosn').value = '102';
            document.getElementById('edit-prod-origem').value = '0';

            // Foca no código
            setTimeout(() => inputCode.focus(), 200);
        }

        // Recalcula lucros (zerados ou preenchidos)
        const event = new Event('input');
        document.getElementById('edit-prod-cost').dispatchEvent(event);

        openModal(document.getElementById('edit-product-modal'));
    };

    // --- Funções Auxiliares Novas (Adicionar no escopo global ou dentro do DOMContentLoaded) ---

    // Auxiliar: Atualiza Preview da Imagem
    window.updateImagePreview = (url) => {
        const container = document.getElementById('edit-img-preview');
        if (url && url.length > 10) {
            container.innerHTML = `<img src="${url}" onerror="this.src='https://placehold.co/100x100?text=Erro'">`;
        } else {
            container.innerHTML = `<i class='bx bx-image-add'></i>`;
        }
    };

    // Auxiliar: Seleciona Marca
    window.selectBrand = (brandName, isNew = false) => {
        const brandInput = document.getElementById('edit-prod-brand');
        brandInput.value = brandName; // Formata bonito (Primeira letra maiúscula se quiser tratar)
        document.getElementById('brand-suggestions-list').style.display = 'none';

        if (isNew) {
            // Adiciona temporariamente ao cache local para funcionar na sessão
            brandsCache.push(brandName);
            console.log("Nova marca registrada temporariamente:", brandName);
        }
    };

    // Função para enviar o produto para o Google Sheets via POST
    async function salvarProdutoNaAPI(prodData) {
        // Monta o pacote JSON que o doPost do Code.js espera
        const payload = {
            action: "saveProduct",
            data: prodData
        };

        const options = {
            method: 'POST', // O Code.js exige POST para salvar dados complexos
            body: JSON.stringify(payload)
        };

        // Envia para a URL do seu script (SCRIPT_URL já está definida no topo do seu arquivo)
        const response = await fetch(SCRIPT_URL, options);
        return await response.json();
    }

    // 4. Salvar Edição (Localmente por enquanto)
    // 4. Salvar Edição (Localmente + API Google Sheets)
    const handleSaveProductEdit = async (e) => {
        e.preventDefault();

        // Referência ao botão para dar feedback visual
        const submitBtn = document.querySelector('#edit-product-form button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;

        // Pega os valores do form
        const newCode = document.getElementById('edit-prod-code').value.trim();
        const newName = document.getElementById('edit-prod-name').value.trim();

        if (!newCode || !newName) {
            showCustomAlert("Erro", "Código e Nome são obrigatórios.");
            return;
        }

        // Objeto base do produto (Estrutura compatível com Code.js > saveProduct)
        const prodData = {
            id: newCode,
            name: newName,
            price: parseFloat(document.getElementById('edit-prod-price').value) || 0,
            costPrice: parseFloat(document.getElementById('edit-prod-cost').value) || 0,
            brand: document.getElementById('edit-prod-brand').value.trim(),
            imgUrl: document.getElementById('edit-prod-img-url').value.trim(),
            // Se for edição, mantém o estoque que estava no cache, se for novo começa com 0
            // (O Google Sheets não deve sobrescrever estoque com 0 se já existir, mas enviamos por segurança)
            stock: editingProductId ? parseInt(document.getElementById('edit-prod-stock').value) : 0,

            // Dados Fiscais
            ncm: document.getElementById('edit-prod-ncm').value.trim(),
            cest: document.getElementById('edit-prod-cest').value.trim(),
            cfop: document.getElementById('edit-prod-cfop').value,
            unit: document.getElementById('edit-prod-unit').value,
            csosn: document.getElementById('edit-prod-csosn').value,
            origem: document.getElementById('edit-prod-origem').value,

            // Categoria (opcional, se não tiver no form, enviamos string vazia ou Geral)
            category: 'Geral'
        };

        // Bloqueia o botão
        submitBtn.disabled = true;
        submitBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Salvando...";

        try {
            // --- ENVIA PARA A API ---
            const apiResult = await salvarProdutoNaAPI(prodData);

            if (apiResult.status !== 'success') {
                throw new Error(apiResult.message || "Erro desconhecido na API.");
            }

            // --- SUCESSO: ATUALIZA O CACHE LOCAL ---
            if (editingProductId) {
                // --- ATUALIZAR EXISTENTE ---
                const prodIndex = localProductCache.findIndex(p => String(p.id) === String(editingProductId));

                if (prodIndex !== -1) {
                    // Verifica troca de código
                    if (newCode !== String(editingProductId)) {
                        // Se mudou o código, verifica se já existe outro igual
                        const exists = localProductCache.some(p => String(p.id) === newCode);
                        if (exists) {
                            throw new Error("Este novo código de barras já existe em outro produto!");
                        }
                    }
                    localProductCache[prodIndex] = prodData;
                }
            } else {
                // --- CRIAR NOVO ---
                const exists = localProductCache.some(p => String(p.id) === newCode);
                if (exists) {
                    throw new Error("Já existe um produto com este código!");
                }
                localProductCache.push(prodData);
            }

            // Sucesso final
            showCustomAlert("Sucesso", "Produto salvo na nuvem e localmente!");
            closeModal(document.getElementById('edit-product-modal'));
            renderProdutosPage();

            // Restaura botão de cadeado
            if (btnUnlockCode) btnUnlockCode.style.display = 'block';

        } catch (error) {
            console.error("Erro ao salvar produto:", error);
            showCustomAlert("Erro ao Salvar", error.message);
        } finally {
            // Restaura o botão
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    };

    // --- LÓGICA DE MAXIMIZAR MODAL ---
    const btnMaximize = document.getElementById('btn-maximize-modal');
    const modalContent = document.querySelector('#edit-product-modal .modal-content');

    if (btnMaximize && modalContent) {
        btnMaximize.addEventListener('click', () => {
            modalContent.classList.toggle('modal-expanded');

            // Troca o ícone
            const icon = btnMaximize.querySelector('i');
            if (modalContent.classList.contains('modal-expanded')) {
                icon.classList.replace('bx-expand', 'bx-collapse');
                btnMaximize.title = "Restaurar tamanho";
            } else {
                icon.classList.replace('bx-collapse', 'bx-expand');
                btnMaximize.title = "Expandir janela";
            }
        });
    }

    // --- LÓGICA DE DESBLOQUEIO DE CÓDIGO ---
    const btnUnlockCode = document.getElementById('btn-unlock-code');
    const inputCode = document.getElementById('edit-prod-code');

    if (btnUnlockCode) {
        btnUnlockCode.addEventListener('click', () => {
            // Se já estiver desbloqueado, não faz nada
            if (!inputCode.disabled) return;

            showCustomConfirm(
                "Alterar Código de Barras?",
                "Isso pode afetar o histórico se o código for usado como identificador. Tem certeza?",
                () => {
                    inputCode.disabled = false;
                    inputCode.classList.remove('bg-locked');
                    inputCode.focus();

                    // Visual do botão muda
                    btnUnlockCode.innerHTML = "<i class='bx bx-lock-open-alt'></i>";
                    btnUnlockCode.classList.add('unlocked');

                    closeModal(document.getElementById('confirm-modal'));
                }
            );
        });
    }

    // 1. Pesquisa
    const prodSearchInput = document.getElementById('products-search-input');
    if (prodSearchInput) {
        prodSearchInput.addEventListener('input', () => {
            currentProductPage = 1; // <--- ADICIONE ESTA LINHA
            renderProdutosPage();
        });
    }

    // 2. Filtros
    document.querySelectorAll('.filter-cap').forEach(btn => {
        btn.addEventListener('click', () => {
            // Visual
            document.querySelectorAll('.filter-cap').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Lógica
            currentProductFilter = btn.dataset.filter;
            renderProdutosPage();
        });
    });

    // 3. Form Submit Edição
    const editForm = document.getElementById('edit-product-form');
    if (editForm) {
        editForm.addEventListener('submit', handleSaveProductEdit);
    }

    // 4. Botão Recarregar
    document.getElementById('btn-reload-products')?.addEventListener('click', () => {
        carregarCacheDeProdutos();
    });

    // --- PEDIDO 2: SALVAR CLIENTE (Lógica Simplificada) ---
    const formAddCliente = document.getElementById('add-cliente-form');
    if (formAddCliente) {
        formAddCliente.addEventListener('submit', (e) => {
            e.preventDefault();

            // Validação simples
            const apelido = document.getElementById('cliente-apelido').value.trim();
            if (!apelido) {
                showCustomAlert("Erro", "O Apelido é obrigatório.");
                return;
            }

            const clienteData = {
                nomeCompleto: document.getElementById('cliente-nome').value.trim(),
                apelido: apelido,
                telefone: document.getElementById('cliente-telefone').value.trim(),
                cpf: document.getElementById('cliente-cpf').value.trim(), // Novo campo
                endereco: document.getElementById('cliente-endereco').value.trim(),
                valorCompra: document.getElementById('compra-valor').value, // Pode ser vazio
                primeiroVencimento: document.getElementById('compra-vencimento').value
            };

            salvarClienteNaAPI(clienteData);
        });
    }

    // --- Variáveis Globais Novas ---
    let currentSeller = localStorage.getItem('pdv_last_seller') || null; // Carrega do cache

    // --- Seletores Novos ---
    const sellerToggleRow = document.getElementById('seller-toggle-row');
    const sellerPopover = document.getElementById('seller-popover');
    const summarySellerName = document.getElementById('summary-seller-name');
    const sellerButtons = document.querySelectorAll('.seller-btn');
    const btnRefreshHistory = document.getElementById('btn-refresh-history');
    const salesHistoryList = document.getElementById('sales-history-list');

    // --- Inicialização do Vendedor ---
    if (currentSeller) {
        summarySellerName.textContent = currentSeller;
        summarySellerName.style.color = 'var(--text-dark)';
        // Marca visualmente o botão
        sellerButtons.forEach(btn => {
            if (btn.dataset.name === currentSeller) btn.style.backgroundColor = 'var(--primary-red)';
        });
    }

    // --- Lógica de Seleção de Vendedor ---
    sellerToggleRow.addEventListener('click', () => {
        sellerPopover.classList.toggle('active');
    });

    sellerButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove estilo dos outros
            sellerButtons.forEach(b => {
                b.style.backgroundColor = 'var(--card-white)';
                b.style.color = 'var(--text-dark)';
            });

            // Aplica ao selecionado
            currentSeller = btn.dataset.name;
            localStorage.setItem('pdv_last_seller', currentSeller); // Salva no cache

            btn.style.backgroundColor = 'var(--primary-red)';
            btn.style.color = 'white';

            summarySellerName.textContent = currentSeller;
            summarySellerName.style.color = 'var(--text-dark)';
            sellerPopover.classList.remove('active');
        });
    });

    // Função para enviar os dados para o Histórico
    async function salvarVendaNoHistorico(dadosVenda) {
        // SCRIPT_URL é a variável com seu link ".../exec"
        if (!SCRIPT_URL) {
            console.error("SCRIPT_URL não definida!");
            return;
        }

        // Estrutura exata que seu backend espera receber
        const payload = {
            action: "registrarHistorico", // Isso ativa o if no doPost
            cliente: dadosVenda.cliente || "Cliente Balcão",
            vendedor: dadosVenda.vendedor || "Caixa",
            valor: dadosVenda.valorTotal, // Certifique-se que é número ou string formatada
            produtos: formatarListaProdutos(dadosVenda.itens), // Transforma array em string
            pagamento: dadosVenda.metodoPagamento,
            idVenda: dadosVenda.id || Date.now().toString()
        };

        const options = {
            method: 'POST', // OBRIGATÓRIO ser POST para cair no doPost
            body: JSON.stringify(payload) // OBRIGATÓRIO converter para string JSON
        };

        try {
            console.log("Enviando histórico...", payload);

            // O fetch dispara o request
            // mode: 'no-cors' NÃO deve ser usado se você quer ler a resposta JSON
            const response = await fetch(SCRIPT_URL, options);

            const jsonResponse = await response.json();

            if (jsonResponse.status === "success") {
                console.log("Histórico registrado com sucesso!");
            } else {
                console.error("Erro no backend:", jsonResponse.message);
            }
        } catch (error) {
            console.error("Erro na requisição:", error);
        }
    }

    // Função auxiliar para transformar o array de itens numa string legível na planilha
    function formatarListaProdutos(itens) {
        if (!itens || !Array.isArray(itens)) return "N/A";

        // CORREÇÃO: Alterado de 'item.qtd' para 'item.quantity' e 'item.nome' para 'item.name'
        return itens.map(item => `${item.quantity || 1}x ${item.name || item.nome || "Item"}`).join(", ");
    }

    // --- Lógica da Página de Histórico (Atualizada) ---
    let historyCache = []; // Cache local para os detalhes
    let selectedHistorySale = null; // Venda selecionada para reimpressão

    const carregarHistorico = async () => {
        const tbody = document.getElementById('sales-history-list');
        tbody.innerHTML = '<tr><td colspan="5" class="text-center pad-20"><i class="bx bx-loader-alt bx-spin"></i> Carregando vendas de hoje...</td></tr>';

        try {
            const response = await fetch(`${SCRIPT_URL}?action=listarHistoricoVendas`);
            const result = await response.json();

            if (result.status === 'success' && result.data.length > 0) {
                historyCache = result.data; // Salva no cache
                tbody.innerHTML = ''; // Limpa

                result.data.forEach((venda, index) => {
                    const tr = document.createElement('tr');

                    // Ícone de pagamento
                    let iconPay = "<i class='bx bx-money'></i>";
                    if (venda.pagamento.toLowerCase().includes('pix')) iconPay = "<i class='bx bx-scan'></i>";
                    if (venda.pagamento.toLowerCase().includes('cartão')) iconPay = "<i class='bx bx-credit-card'></i>";
                    if (venda.pagamento.toLowerCase().includes('crediário')) iconPay = "<i class='bx bx-user-check'></i>";

                    tr.innerHTML = `
                        <td style="color:var(--text-light); font-size:0.9rem;">${venda.data}</td>
                        <td><strong>${venda.cliente}</strong><br><small style="color:var(--text-light); font-size:0.75rem;">Vend: ${venda.vendedor}</small></td>
                        <td><span class="badge-neutral">${iconPay} ${venda.pagamento}</span></td>
                        <td style="color:var(--success-green); font-weight:700;">${formatCurrency(venda.valor)}</td>
                        <td class="text-center">
                            <button class="btn btn-sm btn-secondary btn-view-sale" data-index="${index}" title="Ver Detalhes">
                                <i class='bx bx-show-alt'></i>
                            </button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });

                // Adiciona listeners aos botões
                document.querySelectorAll('.btn-view-sale').forEach(btn => {
                    btn.addEventListener('click', () => openHistoryDetails(btn.dataset.index));
                });

            } else {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center pad-20 text-muted">Nenhuma venda registrada hoje.</td></tr>';
            }
        } catch (e) {
            console.error(e);
            tbody.innerHTML = '<tr><td colspan="5" class="text-center pad-20 text-danger">Erro ao carregar histórico.</td></tr>';
        }
    };

    // Botão de Atualizar e Clique na Aba
    btnRefreshHistory.addEventListener('click', carregarHistorico);


    // --- Funções de Detalhes e Reimpressão ---

    // 1. Abrir Modal de Detalhes
    window.openHistoryDetails = (index) => {
        const venda = historyCache[index];
        if (!venda) return;

        selectedHistorySale = venda; // Salva para uso na impressão

        // Preenche Modal
        document.getElementById('hist-det-valor').textContent = formatCurrency(venda.valor);
        document.getElementById('hist-det-pagamento').textContent = venda.pagamento;
        document.getElementById('hist-det-cliente').textContent = venda.cliente;
        document.getElementById('hist-det-vendedor').textContent = venda.vendedor;
        document.getElementById('hist-det-hora').textContent = venda.data;

        // Lista de Itens (Parse da string "1x Item A, 2x Item B")
        const itensContainer = document.getElementById('hist-det-itens');
        itensContainer.innerHTML = '';

        if (venda.produtos) {
            const itensLista = venda.produtos.split(', '); // Divide pela vírgula
            itensLista.forEach(itemStr => {
                const div = document.createElement('div');
                div.className = 'receipt-item-row';
                // Tenta separar quantidade do nome (Ex: "2x Coca Cola")
                const partes = itemStr.match(/(\d+)x\s(.+)/);

                if (partes) {
                    div.innerHTML = `<span><i class="bx bx-package"></i> ${partes[2]}</span> <strong>x${partes[1]}</strong>`;
                } else {
                    div.innerHTML = `<span>${itemStr}</span>`;
                }
                itensContainer.appendChild(div);
            });
        }

        openModal(document.getElementById('sale-details-modal'));
    };

    // 2. Botão "Reimprimir" no Modal de Detalhes
    document.getElementById('btn-reprint-history').addEventListener('click', () => {
        // Fecha o modal de detalhes
        closeModal(document.getElementById('sale-details-modal'));

        // Abre o modal de escolha de formato (o mesmo do checkout)
        // O sistema vai saber que é reimpressão porque 'selectedHistorySale' não é nulo
        openModal(document.getElementById('print-selection-modal'));
    });

    // 3. ATUALIZAÇÃO CRÍTICA: Modificar a lógica de impressão para aceitar dados históricos

    document.getElementById('btn-print-a4').onclick = () => {
        closeModal(document.getElementById('print-selection-modal'));
        if (selectedHistorySale) {
            printHistoryReceipt(selectedHistorySale, 'a4');
            selectedHistorySale = null; // Reseta após usar
        } else {
            processFinalSale('a4'); // Fluxo normal de venda nova
        }
    };

    // 4. Função Mestra de Reimpressão (Adapta os dados do histórico para o layout de impressão)
    function printHistoryReceipt(venda, format) {
        // Reconstrói o array de itens a partir da string
        const itensSimulados = [];
        if (venda.produtos) {
            const lista = venda.produtos.split(', ');
            lista.forEach(str => {
                const partes = str.match(/(\d+)x\s(.+)/);
                if (partes) {
                    itensSimulados.push({
                        name: partes[2],
                        quantity: parseInt(partes[1]),
                        price: 0, // Histórico simples não salva preço unitário, infelizmente
                        originalPrice: 0
                    });
                } else {
                    itensSimulados.push({ name: str, quantity: 1, price: 0, originalPrice: 0 });
                }
            });
        }

        // Mock dos dados financeiros (Já que não temos subtotal/desconto separados no histórico simples)
        const financeiroSimulado = {
            subtotal: parseFloat(venda.valor),
            desconto: 0,
            total: parseFloat(venda.valor),
            pagamento: venda.pagamento
        };

        // Usa as funções de impressão existentes, mas precisamos "enganá-las" ou adaptá-las
        // A melhor forma sem reescrever tudo é criar uma versão específica para histórico ou 
        // temporariamente substituir as variáveis globais (cart e lastSaleData). 
        // Vamos usar a técnica de substituir variáveis globais temporariamente, é mais rápido e reutiliza o layout.

        // 1. Backup do estado atual
        const backupCart = [...cart];
        const backupSaleData = lastSaleData ? { ...lastSaleData } : null;
        const backupPayment = selectedPaymentMethod;

        // 2. Sobrescreve com dados do histórico
        cart = itensSimulados;
        lastSaleData = financeiroSimulado;
        selectedPaymentMethod = venda.pagamento;

        // 3. Chama a função de impressão correspondente
        if (format === 'a4') {
            printA4(venda.cliente); // Passa nome do cliente
        } else {
            printThermal(venda.cliente);
        }

        // 4. Restaura o estado original (Delay para garantir que a função de impressão leu os dados)
        setTimeout(() => {
            cart = backupCart;
            lastSaleData = backupSaleData;
            selectedPaymentMethod = backupPayment;
        }, 1000);
    }

    // --- Funções de Lógica do Carrinho ---

    const addToCart = (product) => {
        const existingItem = cart.find(item => item.id === product.id);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            // 1. Define o Preço Original (Sempre o preço cheio da tabela)
            let basePrice = product.price;

            // 2. Define o Preço Efetivo e o Desconto
            let finalPrice = basePrice;
            let discountPct = 0;
            let isOffer = false;

            // Se tiver oferta (Planilha ou Firebase)
            const offerPrice = product.promoPrice || product.priceOffer || 0;

            if (offerPrice > 0 && offerPrice < basePrice) {
                finalPrice = parseFloat(offerPrice);
                discountPct = ((basePrice - finalPrice) / basePrice) * 100;
                isOffer = true;
            }

            cart.push({
                ...product,
                originalPrice: basePrice, // NUNCA MUDA (Preço de Tabela)
                price: finalPrice,        // MUDA com desconto (Preço de Venda)
                quantity: 1,
                isNew: true,
                discountPercent: discountPct,
                hasOffer: isOffer
            });
        }
        renderCart();
    };

    const updateQuantity = (id, action) => { const item = cart.find(item => item.id === id); if (!item) return; if (action === 'increase') { item.quantity += 1; } else if (action === 'decrease') { item.quantity -= 1; if (item.quantity === 0) { removeFromCart(id); return; } } renderCart(); };
    const removeFromCart = (id) => { cart = cart.filter(item => item.id !== id); renderCart(); };
    const clearCart = () => {
        cart = [];
        removeDiscount();
        resetPaymentMethod();
        lastSaleData = null;

        // Reset Troco UI
        window.lastTrocoValue = 0;
        const rowResumo = document.getElementById('summary-change-row');
        if (rowResumo) rowResumo.style.display = 'none';

        // Reset Input de Dinheiro e Display de Troco (Fix)
        const cashInput = document.getElementById('cash-received');
        if (cashInput) cashInput.value = '';

        const changeDisplay = document.getElementById('cash-change-value');
        if (changeDisplay) {
            changeDisplay.textContent = 'R$ 0,00';
            changeDisplay.style.color = ''; // Reseta cor (remove verde/vermelho)
        }

        renderCart();
    };

    // Funções de Modal com Acessibilidade
    const openModal = (modalEl) => { elementToRestoreFocus = document.activeElement; modalEl.classList.add('active'); const primaryFocus = modalEl.querySelector('[data-primary-focus="true"]'); if (primaryFocus) { setTimeout(() => primaryFocus.focus(), 100); } };
    const closeModal = (modalEl) => { modalEl.classList.remove('active'); if (elementToRestoreFocus && elementToRestoreFocus.focus) { try { elementToRestoreFocus.focus(); } catch (e) { console.warn("Não foi possível restaurar o foco:", e); } } elementToRestoreFocus = null; };
    const showCustomAlert = (title, message) => {
        alertTitle.textContent = title; alertMessage.textContent = message; openModal(alertModal);
    };
    const showCustomToast = (message) => {
        // Cria o elemento
        const toast = document.createElement('div');
        toast.textContent = message;

        // Estilo inline para garantir que funcione sem mexer no CSS
        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#333',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: '8px',
            zIndex: '9999',
            opacity: '0',
            transition: 'opacity 0.3s ease'
        });

        document.body.appendChild(toast);

        // Animação de entrada
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
        });

        // Remove após 3 segundos
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 3000);
    };
    const showCustomConfirm = (title, message, onConfirm) => { confirmTitle.textContent = title; confirmMessage.textContent = message; confirmCallback = onConfirm; openModal(confirmModal); };
    const resetPaymentMethod = () => { selectedPaymentMethod = null; summaryPaymentMethod.textContent = "Não selecionado"; summaryPaymentMethod.style.fontWeight = '500'; summaryPaymentMethod.style.color = 'var(--text-light)'; updateSummary(); };

    // --- Funções de Desconto ---
    const getSubtotal = () => cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const applyDiscount = (requestedDiscount, isPercentage = false, fromInput = false) => {
        const subtotal = getSubtotal();
        if (subtotal === 0) {
            if (requestedDiscount !== 0) { showCustomAlert("Vazio", "Adicione itens."); }
            return;
        }
        let calculatedDiscount = isPercentage ? subtotal * (requestedDiscount / 100) : requestedDiscount;

        // AUTH CHECK (>10%)
        const percCheck = subtotal > 0 ? (calculatedDiscount / subtotal) * 100 : 0;
        if (percCheck > 10 && !window.isDiscountAuthorized) {
            const authModal = document.getElementById('discount-auth-modal');
            if (authModal && typeof openModal === 'function') {
                openModal(authModal);
                window.pendingDiscountValue = calculatedDiscount;
                return; // Bloqueia aplicação
            }
        }

        const newTotal = subtotal - calculatedDiscount;
        const roundedTotal = isSmartRoundingEnabled ? Math.round(newTotal * 2) / 2 : newTotal;
        const finalDiscount = subtotal - roundedTotal;

        discount = (finalDiscount > subtotal) ? subtotal : ((finalDiscount < 0) ? 0 : finalDiscount);

        // Only update input if NOT typing manually
        if (!fromInput && discountInputR) {
            discountInputR.value = discount > 0 ? discount.toFixed(2).replace('.', ',') : '';
        }

        // Update Effective Discount Label
        const perc = subtotal > 0 ? (discount / subtotal) * 100 : 0;
        if (typeof effectiveDiscountDisplay !== 'undefined' && effectiveDiscountDisplay) {
            effectiveDiscountDisplay.textContent = `Desconto efetivo: ${perc.toFixed(2).replace('.', ',')}%`;
        }

        updateSummary();
    };
    const removeDiscount = () => { discount = 0; discountInputR.value = ''; updateSummary(); };


    // --- Funções de API (ATUALIZADA: GOOGLE SHEETS + FIREBASE) ---

    // Função auxiliar para buscar produtos do Firebase
    async function fetchFirebaseProductsForCache() {
        try {
            const productsRef = db.collection('artifacts').doc(FIREBASE_CONFIG_ID)
                .collection('users').doc(STORE_OWNER_UID)
                .collection('products');
            const snapshot = await productsRef.get();
            if (snapshot.empty) return [];

            return snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: data.code || doc.id,
                    name: data.name,
                    price: parseValueFirebase(data.price),
                    priceOffer: parseValueFirebase(data['price-oferta']), // AGORA PEGANDO A OFERTA
                    stock: data.stock || 0,
                    isFirebase: true,
                    docId: doc.id
                };
            }).filter(p => p.id);
        } catch (e) {
            console.error("Erro Firebase:", e);
            return [];
        }
    }

    // --- Função Global para Atualizar Itens (Descontos) ---
    window.updateCartItem = (id, field, value) => {
        // Converte para String para garantir que encontre o ID certo (Texto ou Número)
        const item = cart.find(i => String(i.id) === String(id));

        if (!item) return;

        if (field === 'discountPercent') {
            let percent = parseFloat(value);

            // Validações de limite (0 a 100)
            if (isNaN(percent) || percent < 0) percent = 0;
            if (percent > 100) percent = 100;

            // 1. Define a porcentagem de desconto
            item.discountPercent = percent;

            // 2. Recalcula o Preço de Venda
            // Fórmula: Preço Original - (Valor do Desconto)
            // Mantemos o preço original intacto e alteramos apenas o preço final (item.price)
            item.price = item.originalPrice * (1 - (percent / 100));
        }

        // Renderiza novamente para atualizar a linha e o total do pedido
        renderCart();
    };

    // Função Principal de Carregamento (Híbrida)
    // --- CORREÇÃO 2: Desbloqueio do PDV após carregar ---
    // --- LÓGICA DE DOWNLOAD DE PREÇOS ---
    window.updateDownloadButtonState = () => {
        const btn = document.getElementById('btn-download-prices');
        const countSpan = document.getElementById('selected-count');

        if (btn && countSpan) {
            const count = selectedProductIds.size;
            countSpan.textContent = count;
            btn.style.display = count > 0 ? 'inline-flex' : 'none';
        }
    };

    document.getElementById('btn-download-prices')?.addEventListener('click', () => {
        if (selectedProductIds.size === 0) return;
        generateA4Prices();
    });

    const generateA4Prices = () => {
        const productsToPrint = localProductCache.filter(p => selectedProductIds.has(String(p.id)));
        if (productsToPrint.length === 0) return;

        // Dividir em grupos de 5 (5 por folha)
        const chunks = [];
        for (let i = 0; i < productsToPrint.length; i += 5) {
            chunks.push(productsToPrint.slice(i, i + 5));
        }

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    @page { size: A4; margin: 0; }
                    body { margin: 0; font-family: 'Inter', sans-serif; background: #fff; }
                    .page {
                        width: 210mm;
                        height: 297mm;
                        overflow: hidden;
                        page-break-after: always;
                    }
                    .tag {
                        width: 210mm;
                        height: 59.4mm;
                        background: #db0038;
                        color: #fff;
                        display: flex;
                        flex-direction: column;
                        box-sizing: border-box;
                        padding: 4mm 8mm;
                        border-bottom: 0.2mm dashed rgba(255,255,255,0.4);
                        position: relative;
                        overflow: hidden;
                    }
                    .tag:last-child { border-bottom: none; }
                    .product-name {
                        font-size: 20pt;
                        font-weight: 800;
                        text-transform: uppercase;
                        line-height: 1.1;
                        margin: 0;
                        display: -webkit-box;
                        -webkit-line-clamp: 2;
                        -webkit-box-orient: vertical;
                        overflow: hidden;
                    }
                    .tag-body {
                        flex: 1;
                        display: flex;
                        align-items: flex-end;
                        justify-content: space-between;
                        margin-top: 1mm;
                    }
                    .barcode-container {
                        background: #fff;
                        padding: 2mm 5mm;
                        border-radius: 3mm;
                        display: flex;
                        align-items: center;
                    }
                    .barcode-container svg { height: 14mm; max-width: 65mm; }
                    .price-container {
                        display: flex;
                        flex-direction: column;
                        align-items: flex-end;
                        line-height: 1;
                    }
                    .old-price {
                        font-size: 16pt;
                        text-decoration: line-through;
                        opacity: 0.8;
                        font-weight: 500;
                        margin-bottom: -1mm;
                    }
                    .new-price {
                        font-size: 68pt;
                        font-weight: 950;
                        margin: 0;
                        letter-spacing: -2pt;
                        white-space: nowrap;
                        display: flex;
                        align-items: baseline;
                    }
                    .new-price small {
                        font-size: 22pt;
                        margin-right: 1mm;
                        font-weight: 800;
                    }
                </style>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;800;900&display=swap" rel="stylesheet">
            </head>
            <body>
        `);

        chunks.forEach(chunk => {
            doc.write('<div class="page">');
            chunk.forEach(prod => {
                const promoPrice = prod.promoPrice || 0;
                const finalPrice = promoPrice > 0 ? promoPrice : prod.price;
                const formattedFinal = formatCurrency(finalPrice);
                const priceValue = formattedFinal.replace('R$', '').trim();
                const oldPriceValue = formatCurrency(prod.price);
                doc.write(`
                    <div class="tag">
                        <div class="tag-header"><h2 class="product-name">${prod.name}</h2></div>
                        <div class="tag-body">
                            <div class="barcode-container">
                                <svg class="barcode" jsbarcode-value="${prod.id}" jsbarcode-textmargin="0" jsbarcode-displayvalue="true" jsbarcode-fontoptions="bold"></svg>
                            </div>
                            <div class="price-container">
                                ${promoPrice > 0 ? `<div class="old-price">${oldPriceValue}</div>` : ''}
                                <div class="new-price"><small>R$</small>${priceValue}</div>
                            </div>
                        </div>
                    </div>
                `);
            });
            doc.write('</div>');
        });

        doc.write(`
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
            <script>
                window.onload = function() {
                    JsBarcode(".barcode").init();
                    setTimeout(() => {
                        window.print();
                        setTimeout(() => {
                            window.parent.document.body.removeChild(window.frameElement);
                        }, 100);
                    }, 500);
                };
            </script>
            </body>
            </html>
        `);
        doc.close();
    };


    window.carregarCacheDeProdutos = async () => {
        const loaderOverlay = document.getElementById('custom-loader-overlay');
        if (loaderOverlay) loaderOverlay.style.display = 'flex';

        const container = document.getElementById('produtos-table-container');
        const pdvInput = document.getElementById('barcode-input'); // Seleciona o input do PDV
        const pdvHint = document.getElementById('barcode-hint');   // Seleciona o texto de ajuda

        // Feedback visual na tela de produtos
        if (container) {
            container.innerHTML = '<div class="empty-state"><i class="bx bx-loader-alt bx-spin" style="font-size:2rem"></i><p class="mt-2">Sincronizando Dados...</p></div>';
        }

        try {
            // Busca os dados do Backend
            const response = await fetch(SCRIPT_URL + "?action=getProducts");
            const json = await response.json();

            localProductCache = json; // Salva na memória

            // Popula o Cache de Marcas
            const marcasExistentes = [...new Set(localProductCache.map(p => p.brand).filter(b => b && b.trim() !== ""))];
            if (marcasExistentes.length > 0) {
                brandsCache = marcasExistentes.sort();
            }

            renderProdutosPage(); // Renderiza a tabela

            // === A CORREÇÃO DO PDV ESTÁ AQUI ===
            // Destrava o campo de busca do PDV e muda o texto
            if (pdvInput) {
                pdvInput.disabled = false;
                pdvInput.placeholder = "Digite o código ou nome...";
                // Se estiver na página do PDV, foca
                if (document.getElementById('pdv-page').style.display !== 'none') {
                    pdvInput.focus();
                }
            }
            if (pdvHint) {
                pdvHint.textContent = "Digite para buscar ou use o leitor";
            }

            // Verifica se a função toast existe antes de chamar (para evitar aquele erro anterior)
            if (typeof showCustomToast === 'function') {
                runFiscalSanityCheck();
                showCustomToast("Sistema Carregado!");
            } else {
                console.log("Produtos carregados.");
            }

        } catch (error) {
            console.error("Erro ao carregar produtos:", error);

            // Exibe erro na tela de produtos
            if (container) {
                container.innerHTML = `<div class="empty-state text-danger"><i class='bx bx-error'></i><p>Erro ao sincronizar. Verifique a conexão.</p><button class="btn btn-sm btn-secondary mt-2" onclick="carregarCacheDeProdutos()">Tentar Novamente</button></div>`;
            }

            // Avisa no PDV que deu erro
            if (pdvHint) {
                pdvHint.innerHTML = "<span style='color:red'>Erro ao carregar produtos. Recarregue a página.</span>";
            }
        } finally {
            if (loaderOverlay) loaderOverlay.style.display = 'none';
        }
    };


    function buscarProdutoLocalmente(barcode) {
        if (localProductCache === null) {
            showCustomAlert("Aguarde", "Cache carregando.");
            return null;
        }

        // CORREÇÃO: Converte ambos para String e remove espaços antes de comparar
        // Isso resolve o problema de Número vs Texto
        const barcodeLimpo = String(barcode).trim();

        return localProductCache.find(p => String(p.id).trim() === barcodeLimpo) || null;
    }
    async function cadastrarProdutoNaAPI(product) { quickAddSubmitBtn.disabled = true; quickAddSubmitBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Cadastrando..."; try { const params = new URLSearchParams({ action: 'cadastrarProduto', codigo: product.id, nome: product.name, preco: product.price }); const response = await fetch(`${SCRIPT_URL}?${params.toString()}`, { method: 'GET' }); if (!response.ok) throw new Error("Erro rede."); const result = await response.json(); if (result.status === 'success') { if (localProductCache) { localProductCache.push(result.data); } return result.data; } else { throw new Error(result.message || "Erro API."); } } catch (error) { console.error("Erro cadastro prod:", error); showCustomAlert("Erro Cadastro Prod", error.message); return null; } finally { quickAddSubmitBtn.disabled = false; quickAddSubmitBtn.innerHTML = "Adicionar"; } }
    async function registrarVendaAtual(payments, totalValueOverride = null, discountOverride = null) {
        if (!REGISTRO_VENDA_SCRIPT_URL || REGISTRO_VENDA_SCRIPT_URL.includes("COLE_A_URL")) { throw new Error("URL registro não config."); }

        // Use overrides if provided (Background Mode), otherwise fallback to global (Legacy Mode)
        const effectiveTotal = totalValueOverride !== null ? totalValueOverride : (lastSaleData ? lastSaleData.subtotal : 0);
        const effectiveDiscount = discountOverride !== null ? discountOverride : (lastSaleData ? lastSaleData.discount : 0);

        const now = new Date();
        const timestamp = formatTimestamp(now);

        const baseData = {
            formType: 'venda',
            seller: 'nubia',
            type: 'entrada',
            value: Number(effectiveTotal).toFixed(2),
            desconto: Number(effectiveDiscount).toFixed(2),
            Timestamp: timestamp
        };

        const fetchPromises = payments.map(payment => {
            const paymentData = { ...baseData, payment: payment.method || 'N/A', total: payment.value.toFixed(2) };
            const formData = new URLSearchParams(paymentData);
            console.log("Enviando parte registro:", formData.toString());
            return fetch(REGISTRO_VENDA_SCRIPT_URL, { redirect: "follow", method: "POST", body: formData.toString(), headers: { "Content-Type": "application/x-www-form-urlencoded" }, });
        });

        const responses = await Promise.all(fetchPromises);
        const allOk = responses.every(response => response.ok);
        if (allOk) { console.log("Registro OK!"); } else {
            const firstErrorResponse = responses.find(response => !response.ok);
            let errorText = `Falha registro. Status: ${firstErrorResponse?.status || '?'}`;
            try { if (firstErrorResponse) errorText = await firstErrorResponse.text(); } catch (readError) { }
            throw new Error(errorText);
        }
    }

    // Função para abater estoque no Firebase
    async function abaterEstoqueFirebase(itensVendidos) {
        const batch = db.batch();
        let updatesCount = 0;

        itensVendidos.forEach(item => {
            // Só abate se o produto veio do Firebase e tem um ID de documento válido
            if (item.isFirebase && item.docId) {
                const ref = db.collection('artifacts').doc(FIREBASE_CONFIG_ID)
                    .collection('users').doc(STORE_OWNER_UID)
                    .collection('products').doc(item.docId);

                // Decrementa a quantidade atômica (seguro contra concorrência)
                batch.update(ref, {
                    stock: firebase.firestore.FieldValue.increment(-item.quantity),
                    updatedAt: new Date().toISOString()
                });
                updatesCount++;
            }
        });

        if (updatesCount > 0) {
            try {
                await batch.commit();
                console.log(`Estoque atualizado: ${updatesCount} itens abatidos no Firebase.`);
            } catch (e) {
                console.error("Erro ao abater estoque:", e);
                // Não paramos a venda por erro de estoque, apenas logamos
            }
        }
    }

    async function abaterEstoquePlanilha(itensVendidos) {
        try {
            const itensFormatados = itensVendidos.map(item => ({
                id: item.barcode || item.id, // Usa barcode ou id do item no carrinho
                qty: item.quantity
            }));

            const response = await fetch(SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'abaterEstoqueLote',
                    itens: itensFormatados
                })
            });
            const result = await response.json();
            console.log("Estoque Planilha:", result.message);
        } catch (e) {
            console.error("Erro ao abater estoque na planilha:", e);
        }
    }

    async function carregarClientesDaAPI() { clientesListContainer.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px 0;"><i class="bx bx-loader-alt bx-spin"></i> Carregando...</p>'; localClientCache = null; try { const response = await fetch(SCRIPT_URL + "?action=listarClientes"); if (!response.ok) throw new Error("Erro rede."); const result = await response.json(); if (result.status === 'success') { localClientCache = result.data; console.log(`Cache cli: ${localClientCache.length}`); renderClientesPage(); } else { throw new Error(result.message || "Erro API."); } } catch (error) { console.error("Erro carregar cli:", error); clientesListContainer.innerHTML = `<p style="text-align: center; color: var(--warning-red); padding: 20px 0;">${error.message}</p>`; localClientCache = []; } }
    async function salvarClienteNaAPI(clienteData) { clienteSaveBtn.disabled = true; clienteSaveBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Salvando..."; try { const params = new URLSearchParams({ action: 'cadastrarCliente', ...clienteData }); const response = await fetch(`${SCRIPT_URL}?${params.toString()}`, { method: 'GET' }); if (!response.ok) throw new Error("Erro rede."); const result = await response.json(); if (result.status === 'success') { showCustomAlert("Sucesso!", result.message || "Cliente cadastrado!"); closeModal(addClienteModal); if (localClientCache !== null) { localClientCache.push(result.data); localClientCache.sort((a, b) => (a.apelido || a.nomeExibicao).localeCompare(b.apelido || b.nomeExibicao)); } renderClientesPage(); } else { throw new Error(result.message || "Erro API."); } } catch (error) { console.error("Erro salvar cli:", error); showCustomAlert("Erro Salvar", error.message); } finally { clienteSaveBtn.disabled = false; clienteSaveBtn.innerHTML = "<i class='bx bx-save'></i> Salvar"; } }
    async function abrirCaixaAPI(data) {
        openCaixaSaveBtn.disabled = true; openCaixaSaveBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Abrindo..."; try {
            const params = new URLSearchParams({ action: 'abrirCaixa', ...data }); const response = await fetch(`${SCRIPT_URL}?${params.toString()}`, { method: 'GET' }); if (!response.ok) throw new Error("Erro rede."); const result = await response.json(); if (result.status === 'success') {
                salvarToken(); liberarSistema(); closeModal(openCaixaModal);
            } else { throw new Error(result.message || "Erro API."); }
        } catch (error) { console.error("Erro abrir caixa:", error); showCustomAlert("Erro Abrir Caixa", error.message); } finally { openCaixaSaveBtn.disabled = false; openCaixaSaveBtn.innerHTML = "<i class='bx bx-check'></i> Confirmar"; }
    }
    async function fecharCaixaAPI(data) {
        closeCaixaSaveBtn.disabled = true; closeCaixaSaveBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Fechando..."; try {
            const params = new URLSearchParams({ action: 'fecharCaixa', ...data }); const response = await fetch(`${SCRIPT_URL}?${params.toString()}`, { method: 'GET' }); if (!response.ok) throw new Error("Erro rede."); const result = await response.json(); if (result.status === 'success') {
                limparToken(); bloquearSistema("Caixa fechado! Recarregue a página (F5) para reabrir."); // Mensagem atualizada
                showCustomAlert("Sucesso!", result.message || "Caixa fechado!"); closeModal(closeCaixaModal);
            } else { throw new Error(result.message || "Erro API."); }
        } catch (error) { console.error("Erro fechar caixa:", error); showCustomAlert("Erro Fechar Caixa", error.message); } finally { closeCaixaSaveBtn.disabled = false; closeCaixaSaveBtn.innerHTML = "<i class='bx bx-store'></i> Confirmar"; }
    }

    // --- Funções para controlar UI (baseado no token) ---
    const bloquearSistema = (message = "Abertura de caixa necessária.") => {
        mainContent.style.display = 'none';
        loadingOverlay.classList.remove('hidden');
        loadingMessage.textContent = message;
        headerCloseCaixaBtn.style.display = 'none';
    };

    const liberarSistema = () => {
        // 1. Remove o bloqueio visual imediatamente
        loadingOverlay.classList.add('hidden');
        mainContent.style.display = 'block';
        headerCloseCaixaBtn.style.display = 'inline-flex';

        // 2. Força o fechamento do modal de abertura para liberar o teclado
        openCaixaModal.classList.remove('active');

        // 3. Tenta carregar dados em segundo plano sem travar a UI
        try {
            carregarCacheDeProdutos();
            carregarClientesDaAPI();
        } catch (e) {
            console.error("Erro ao carregar dados iniciais, mas o sistema segue livre.", e);
        }
    };

    // --- Handlers de Ação ---
    const handleScan = () => { const barcode = barcodeInput.value.trim(); if (!barcode) return; const product = buscarProdutoLocalmente(barcode); if (product) { addToCart(product); } else if (localProductCache !== null) { lastScannedBarcode = barcode; scannedBarcodeEl.textContent = barcode; quickAddForm.reset(); openModal(quickAddModal); } barcodeInput.value = ''; };
    const debounce = (func, delay) => { clearTimeout(barcodeScanTimeout); barcodeScanTimeout = setTimeout(func, delay); };
    const handleQuickAddSubmit = async () => { const name = quickAddName.value; const price = parseFloat(quickAddPrice.value); if (!name || isNaN(price) || price <= 0) { showCustomAlert("Inválido", "Nome e preço."); return; } const newProduct = { id: lastScannedBarcode, name: name, price: price }; const produtoCadastrado = await cadastrarProdutoNaAPI(newProduct); if (produtoCadastrado) { addToCart(produtoCadastrado); closeModal(quickAddModal); } };

    const handlePaymentSelection = (method, isConfirmedPix = false) => {
        if (splitPaymentArea.style.display === 'none') {

            // --- INTERCEPTAÇÃO PIX (MIGRAÇÃO) ---
            if (method === 'PIX' && !isConfirmedPix) {
                openModal(document.getElementById('pix-type-modal'));
                return;
            }

            selectedPaymentMethod = method;
            summaryPaymentMethod.textContent = method;

            // --- LÓGICA DE ARREDONDAMENTO AUTOMÁTICO (DINHEIRO) ---
            // A lógica foi movida para o botão de confirmação do dinheiro para garantir que o troco esteja correto.
            // Aqui apenas garantimos que o metodo seja registrado.
            summaryPaymentMethod.style.fontWeight = '600';
            summaryPaymentMethod.style.color = 'var(--text-dark)';

            // Remove o alerta visual (borda vermelha)
            const paymentRow = document.getElementById('payment-toggle-row');
            if (paymentRow) paymentRow.classList.remove('border-pulse');

            // --- NOVA LÓGICA DE LIMPEZA ---
            // Se o método escolhido NÃO for 'Dinheiro', esconde o troco e zera o valor
            if (method !== 'Dinheiro') {
                const rowResumo = document.getElementById('summary-change-row');
                if (rowResumo) rowResumo.style.display = 'none';
                window.lastTrocoValue = 0; // Zera para evitar envio fiscal incorreto
            }
            // ------------------------------

            updateSummary();
            renderCart(); // Garante que as tags de oferta atualizem visualmente
            closeModal(paymentModal);
        } else {
            showCustomAlert("Atenção", "Confirme ou cancele a divisão de pagamento.");
        }
    };

    // --- Lógica de Impressão (Atualizada: Sem QR Code, Com A4) ---

    let tempClientNameForSignature = null; // Variável auxiliar

    // 1. Abre o Modal de Seleção
    const handlePrintReceipt = (clientNameForSignature = null) => {
        if (!lastSaleData || cart.length === 0) {
            showCustomAlert("Erro", "Sem dados venda."); return;
        }
        tempClientNameForSignature = clientNameForSignature;
        openModal(document.getElementById('print-selection-modal'));
    };

    // ============================================================
    // CORREÇÃO DA LÓGICA DE IMPRESSÃO (HISTÓRICO VS NOVA VENDA)
    // ============================================================

    document.getElementById('btn-print-thermal').onclick = () => {
        closeModal(document.getElementById('print-selection-modal'));

        // Verifica se estamos vindo do HISTÓRICO
        if (selectedHistorySale) {
            console.log("Imprimindo do Histórico:", selectedHistorySale); // Debug
            printHistoryReceipt(selectedHistorySale, 'thermal');
            selectedHistorySale = null;
        } else {
            // Se não for histórico, aí sim é venda nova
            processFinalSale('thermal');
        }
    };

    // --- Layout 1: Cupom Térmico ---
    const printThermal = (clientName, saleData = null) => {
        const now = new Date();
        const uniqueSaleID = formatTimestamp(now);

        // Use passed data or fall back to globals
        const currentCart = saleData ? saleData.items : cart;
        const currentTotal = saleData ? saleData.valorTotal : (lastSaleData ? lastSaleData.total : 0);
        const currentPayment = saleData ? saleData.metodoPagamento : selectedPaymentMethod;

        let itemLinesHtml = '';
        currentCart.forEach(item => {
            itemLinesHtml += `<div class="receipt-item"><div class="item-name">${item.name}</div><div class="item-details">${item.quantity} x ${formatCurrency(item.price)}<span>${formatCurrency(item.quantity * item.price)}</span></div></div>`;
        });

        let signatureHtml = '';
        if (clientName) {
            signatureHtml = `<div style="margin-top:30px;text-align:center;border-top:1px solid #000;padding-top:5px;">Assinatura</div><div style="text-align:center;font-weight:bold;">${clientName}</div>`;
        }

        const html = `<html><head><style>@media print{body{margin:0;padding:0;}iframe{display:none;}}body{font-family:'Courier New',monospace;font-size:10pt;color:#000;max-width:300px;margin:0 auto;padding:10px;}.header{text-align:center;border-bottom:1px dashed #000;padding-bottom:10px;margin-bottom:10px;}.items{border-bottom:1px dashed #000;padding-bottom:10px;}.item-details{display:flex;justify-content:space-between;}.summary{padding-top:10px;}.line{display:flex;justify-content:space-between;}</style></head><body>
            <div class="header"><h3>Dtudo Variedades</h3><p>CNPJ: 45.692.327/0001-00</p><p>${uniqueSaleID}</p></div>
            <p style="text-align:center;font-weight:bold">COMPROVANTE</p>
            <div class="items">${itemLinesHtml}</div>
            <div class="summary">
                <div class="line"><span>TOTAL:</span><span>${formatCurrency(currentTotal)}</span></div>
                <div class="line"><span>Pagto:</span><span>${currentPayment || 'N/A'}</span></div>
            </div>
            ${signatureHtml}
            <div style="text-align:center;margin-top:20px;font-size:0.8rem"><p>Não é documento fiscal</p></div>
            </body></html>`;

        executePrint(html);
    };

    // --- FUNÇÃO DE IMPRESSÃO A4 (CORRIGIDA E BLINDADA) ---
    // --- FUNÇÃO DE IMPRESSÃO A4 (CORRIGIDA) ---
    function printA4(nomeClienteParams = null, saleData = null) {
        console.log("Gerando A4...");

        let itensParaImprimir = saleData ? saleData.items : cart;
        let dadosFinanceiros = null;

        // --- CORREÇÃO PRINCIPAL ---
        // Verifica se os itens no carrinho são "fakes" do histórico (preço zerado)
        // Se todos forem zero, significa que é uma reimpressão e NÃO devemos recalcular.
        const isHistoricoSimulado = itensParaImprimir.length > 0 && itensParaImprimir.every(i => i.price === 0);

        if (saleData) {
            // Recalculate robustly using original prices if available
            const subtotalBruto = saleData.items.reduce((acc, i) => acc + ((i.originalPrice || i.price) * i.quantity), 0);
            const totalLiquido = saleData.items.reduce((acc, i) => acc + (i.price * i.quantity), 0);

            // Total Discount = (Gross - Net) + Global Discount
            const descontoTotal = (subtotalBruto - totalLiquido) + (saleData.discount || 0);

            dadosFinanceiros = {
                subtotal: subtotalBruto,
                desconto: descontoTotal,
                total: saleData.valorTotal,
                pagamento: saleData.metodoPagamento
            };
        } else if (cart.length > 0 && !isHistoricoSimulado) {
            // CENÁRIO 1: VENDA NOVA (Calcula tudo na hora para precisão exata)
            const subtotalBruto = cart.reduce((acc, item) => acc + (item.originalPrice * item.quantity), 0);
            const totalLiquido = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

            let descontoGlobal = (typeof discount !== 'undefined') ? discount : 0;

            const descontoItens = subtotalBruto - totalLiquido;
            const totalDesconto = descontoItens + descontoGlobal;
            const totalFinal = subtotalBruto - totalDesconto;

            dadosFinanceiros = {
                subtotal: subtotalBruto,
                desconto: totalDesconto,
                total: totalFinal,
                pagamento: selectedPaymentMethod || "Dinheiro"
            };
        } else if (lastSaleData) {
            // CENÁRIO 2: HISTÓRICO (Usa os dados fechados que vieram do backend)
            dadosFinanceiros = {
                subtotal: lastSaleData.subtotal,
                desconto: lastSaleData.discount || 0,
                total: lastSaleData.total,
                pagamento: lastSaleData.paymentMethod || lastSaleData.pagamento || "Dinheiro"
            };
        } else {
            showCustomAlert("Erro", "Nenhum dado de venda para imprimir.");
            return;
        }

        // 2. DADOS DO CLIENTE
        let clienteNome = "CONSUMIDOR FINAL";
        let clienteEnd = "Endereço não informado";

        if (nomeClienteParams) {
            clienteNome = nomeClienteParams;
        } else if (selectedCrediarioClient) {
            clienteNome = selectedCrediarioClient.nomeExibicao;
            clienteEnd = selectedCrediarioClient.endereco || clienteEnd;
        } else {
            const nomeTela = document.getElementById('summary-client-name-text').textContent;
            if (nomeTela && nomeTela !== "Nome do Cliente") clienteNome = nomeTela;
        }

        // --- PREENCHIMENTO DO DOM DE IMPRESSÃO ---

        const now = new Date();
        document.getElementById('print-sale-id').textContent = "V-" + now.getTime().toString().slice(-6);
        document.getElementById('print-sale-date').textContent = now.toLocaleDateString('pt-BR') + " " + now.toLocaleTimeString('pt-BR');

        document.getElementById('print-client-name').textContent = clienteNome.toUpperCase();
        document.getElementById('print-client-address').textContent = clienteEnd;

        // Tabela de Itens
        const tbody = document.getElementById('print-items-body');
        tbody.innerHTML = '';

        if (itensParaImprimir.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Detalhes indisponíveis.</td></tr>';
        } else {
            itensParaImprimir.forEach(item => {
                // CORREÇÃO VISUAL: Se for histórico (preço 0), mostra traço "-" em vez de "R$ 0,00"
                const showPrice = item.price > 0 || !isHistoricoSimulado;
                const textoUnit = showPrice ? formatCurrency(item.price) : "-";
                const textoTotal = showPrice ? formatCurrency(item.price * item.quantity) : "-";

                const tr = document.createElement('tr');
                tr.innerHTML = `
                <td>${(item.id || "000").toString().slice(-4)}</td>
                <td>${item.name}</td>
                <td class="text-center">${item.quantity}</td>
                <td class="text-right">${textoUnit}</td>
                <td class="text-right"><strong>${textoTotal}</strong></td>
            `;
                tbody.appendChild(tr);
            });
        }

        // Totais (Agora usa o objeto correto 'dadosFinanceiros')
        document.getElementById('print-subtotal').textContent = formatCurrency(dadosFinanceiros.subtotal);

        const valDesconto = dadosFinanceiros.desconto;
        if (valDesconto > 0.01) {
            document.getElementById('print-discount').textContent = "- " + formatCurrency(valDesconto);
        } else {
            document.getElementById('print-discount').textContent = formatCurrency(0);
        }

        document.getElementById('print-total').textContent = formatCurrency(dadosFinanceiros.total);
        document.getElementById('print-obs-text').textContent = dadosFinanceiros.pagamento;

        // 3. PARCELAS
        const areaParcelas = document.getElementById('print-installments-area');
        const listaParcelas = document.getElementById('print-installments-list');
        listaParcelas.innerHTML = '';

        if (String(dadosFinanceiros.pagamento).toLowerCase().includes('crediário') || selectedPaymentMethod === 'Crediário') {
            areaParcelas.style.display = 'block';
            let numParcelas = window.tempInstallments || 1;

            const hoje = new Date();
            const diaVencimento = (selectedCrediarioClient && selectedCrediarioClient.diaVencimento) ? parseInt(selectedCrediarioClient.diaVencimento) : 10;
            const valorParcela = dadosFinanceiros.total / numParcelas;

            for (let i = 1; i <= numParcelas; i++) {
                let dataParcela = new Date(hoje.getFullYear(), hoje.getMonth() + i, diaVencimento);
                const div = document.createElement('div');
                div.className = 'inst-badge';
                div.innerHTML = `<b>${i}/${numParcelas}</b> ${dataParcela.toLocaleDateString('pt-BR')}<br>${formatCurrency(valorParcela)}`;
                listaParcelas.appendChild(div);
            }
        } else {
            areaParcelas.style.display = 'none';
        }

        setTimeout(() => window.print(), 300);
    }

    const executePrint = (html) => {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        iframe.contentDocument.open();
        iframe.contentDocument.write(html);
        iframe.contentDocument.close();
        iframe.onload = () => {
            setTimeout(() => {
                try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) { }
                setTimeout(() => document.body.removeChild(iframe), 1000);
            }, 500);
        };
    };
    const updateDiscountNavFocus = (focusEl = true) => { discountNavElements.forEach(el => el.classList.remove('nav-focus')); const currentEl = discountNavElements[discountNavIndex]; if (currentEl) { currentEl.classList.add('nav-focus'); if (focusEl) { currentEl.focus(); if (currentEl.tagName === 'INPUT') { currentEl.select(); } } removeDiscountHint.style.display = (currentEl.id === 'remove-discount-btn') ? 'block' : 'none'; } };
    const navigateClienteSteps = (direction) => { const nextStep = currentClienteStep + direction; if (direction === 1 && currentClienteStep === 1) { if (!validateStep1()) return; } if (nextStep >= 1 && nextStep <= 2) { document.getElementById(`cliente-step-${currentClienteStep}`).classList.remove('active'); document.getElementById(`cliente-step-${nextStep}`).classList.add('active'); currentClienteStep = nextStep; updateClienteModalUI(); } };

    const resetClienteModal = () => {
        if (addClienteForm) addClienteForm.reset();
        // Remove classes de erro se houver
        document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
    };

    const updateSplitRemaining = () => { const total = lastSaleData?.total || 0; const val1 = parseFloat(splitValue1.value) || 0; const val2 = parseFloat(splitValue2.value) || 0; const sum = val1 + val2; const remaining = total - sum; currentSplitPayments.remaining = remaining; currentSplitPayments.totalSaleValue = total; splitPaymentRemaining.textContent = `Restante: ${formatCurrency(remaining)}`; confirmSplitPaymentBtn.disabled = !(Math.abs(remaining) < 0.01 && splitMethod1.value && val1 > 0 && splitMethod2.value && val2 > 0 && splitMethod1.value !== splitMethod2.value); splitPaymentRemaining.style.color = remaining < -0.01 ? 'var(--warning-red)' : 'var(--primary-red)'; };
    const updateCloseCaixaNextBtnState = () => {
        let isStepValid = false;
        if (currentFecharCaixaStep === 1) {
            const v1 = parseFloat(closeCaixaNotasInput.value);
            const v2 = parseFloat(closeCaixaMoedasInput.value);
            isStepValid = (v1 > 0 || v2 > 0);
        } else if (currentFecharCaixaStep === 2) {
            const v1 = parseFloat(closeCaixaCartaoInput.value);
            isStepValid = (v1 >= 0); // Allow zero but require input
        } else if (currentFecharCaixaStep === 3) {
            const v1 = parseFloat(closeCaixaDepositoInput.value);
            const v2 = parseFloat(closeCaixaFicaInput.value);
            isStepValid = (v1 >= 0 && v2 >= 0);
        } else if (currentFecharCaixaStep === 4) {
            isStepValid = closeCaixaAssinaturaInput.value.trim().length > 0;
        }

        if (isStepValid) {
            closeCaixaNextBtn.disabled = false;
            closeCaixaNextBtn.classList.add('btn-primary');
            closeCaixaSaveBtn.disabled = false;
        } else {
            closeCaixaNextBtn.disabled = true;
            closeCaixaNextBtn.classList.remove('btn-primary');
            closeCaixaSaveBtn.disabled = true;
        }
    };

    const navigateFecharCaixaSteps = (direction) => {
        const nextStep = currentFecharCaixaStep + direction;
        if (direction === 1) {
            if (currentFecharCaixaStep === 1 && !validateFecharCaixaStep1()) return;
            if (currentFecharCaixaStep === 2 && !validateFecharCaixaStep2()) return;
            if (currentFecharCaixaStep === 3 && !validateFecharCaixaStep3()) return;
        }
        if (nextStep >= 1 && nextStep <= 4) {
            document.querySelectorAll('#close-caixa-form .form-step').forEach(el => el.classList.remove('active'));
            document.getElementById(`close-caixa-step-${nextStep}`).classList.add('active');
            currentFecharCaixaStep = nextStep;
            updateFecharCaixaModalUI();
        }
    };

    const updateFecharCaixaModalUI = () => {
        const progress = currentFecharCaixaStep * 25;
        closeCaixaProgress.style.width = `${progress}%`;
        closeCaixaPrevBtn.style.display = currentFecharCaixaStep === 1 ? "none" : "inline-flex";
        closeCaixaNextBtn.style.display = currentFecharCaixaStep === 4 ? "none" : "inline-flex";
        closeCaixaSaveBtn.style.display = currentFecharCaixaStep === 4 ? "inline-flex" : "none";

        updateCloseCaixaNextBtnState();

        const firstInput = document.querySelector(`#close-caixa-step-${currentFecharCaixaStep} [data-primary-focus="true"], #close-caixa-step-${currentFecharCaixaStep} input`);
        if (firstInput) setTimeout(() => firstInput.focus(), 150);
    };

    const validateFecharCaixaStep1 = () => {
        const v1 = parseFloat(closeCaixaNotasInput.value) || 0;
        const v2 = parseFloat(closeCaixaMoedasInput.value) || 0;
        if (v1 <= 0 && v2 <= 0) {
            showCustomAlert("Atenção", "Informe o valor em notas ou moedas.");
            return false;
        }
        return true;
    };

    const validateFecharCaixaStep2 = () => {
        const val = parseFloat(closeCaixaCartaoInput.value);
        if (isNaN(val) || val < 0) {
            closeCaixaCartaoInput.classList.add('input-error');
            showCustomAlert("Inválido", "Informe o valor total das vendas na maquininha.");
            return false;
        }
        closeCaixaCartaoInput.classList.remove('input-error');
        return true;
    };

    const validateFecharCaixaStep3 = () => {
        let isValid = true;
        const finalNotas = parseFloat(closeCaixaNotasInput.value) || 0;
        const finalMoedas = parseFloat(closeCaixaMoedasInput.value) || 0;
        const depositoValue = closeCaixaDepositoInput.value.replace(',', '.');
        const ficaValue = closeCaixaFicaInput.value.replace(',', '.');
        const deposito = parseFloat(depositoValue);
        const fica = parseFloat(ficaValue);

        const totalContado = Number((finalNotas + finalMoedas).toFixed(2));
        const totalDestinado = Number((deposito + fica).toFixed(2));

        [closeCaixaDepositoInput, closeCaixaFicaInput].forEach(input => {
            const val = parseFloat(input.value.replace(',', '.'));
            if (input.value.trim() === '' || isNaN(val) || val < 0) {
                input.classList.add('input-error');
                isValid = false;
            } else {
                input.classList.remove('input-error');
            }
        });

        if (isValid && Math.abs(totalContado - totalDestinado) > 0.01) {
            closeCaixaDepositoInput.classList.add('input-error');
            closeCaixaFicaInput.classList.add('input-error');

            const msg = `Discrepância nos valores!\n\nDinheiro Contado: ${formatCurrency(totalContado)}\nDestino Informado: ${formatCurrency(totalDestinado)}\n\nA soma para Depósito + Fica deve ser igual ao total contado no Passo 1. Deseja prosseguir mesmo assim?`;

            if (!confirm(msg)) {
                return false;
            }
            // Se confirmou, removemos o erro visual e permitimos
            closeCaixaDepositoInput.classList.remove('input-error');
            closeCaixaFicaInput.classList.remove('input-error');
        }
        return isValid;
    };

    const validateFecharCaixaStep4 = () => {
        if (!closeCaixaAssinaturaInput.value.trim()) {
            closeCaixaAssinaturaInput.classList.add('input-error');
            showCustomAlert("Obrigatório", "Informe o responsável.");
            return false;
        }
        closeCaixaAssinaturaInput.classList.remove('input-error');
        return true;
    };

    const resetFecharCaixaModal = () => {
        closeCaixaForm.reset();
        document.querySelectorAll('#close-caixa-form .input-error').forEach(el => el.classList.remove('input-error'));
        currentFecharCaixaStep = 1;
        document.querySelectorAll('#close-caixa-form .form-step').forEach(el => el.classList.remove('active'));
        document.getElementById('close-caixa-step-1').classList.add('active');
        updateFecharCaixaModalUI();
    };


    // --- Event Listeners ---
    barcodeInput.addEventListener('focus', () => barcodeHint.style.opacity = '0');
    barcodeInput.addEventListener('blur', () => barcodeHint.style.opacity = '1');

    // --- Listener das Abas de Pedidos (FILTROS) ---
    const orderTabs = document.querySelectorAll('#order-status-tabs .order-tab');
    orderTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove classe active de todas
            orderTabs.forEach(t => t.classList.remove('active'));

            // Adiciona na clicada
            tab.classList.add('active');

            // Atualiza o filtro global
            currentOrderStatusFilter = tab.dataset.status;

            // Re-renderiza a lista
            renderDummyOrders();
        });
    });

    barcodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleScan(); // Processa imediatamente ao detectar o sinal de conclusão do leitor
        }
    });

    barcodeInput.addEventListener('input', () => {
        debounce(() => {
            if (barcodeInput.value.length >= 8) handleScan();
        }, 500);
    });

    discountToggleRow.addEventListener('click', () => { discountPopover.classList.toggle('active'); });
    percBtnContainer.addEventListener('click', (e) => { const button = e.target.closest('.perc-btn'); if (button && button.dataset.perc) { applyDiscount(parseFloat(button.dataset.perc), true); } });
    discountInputR.addEventListener('input', (e) => {
        let valStr = e.target.value.replace(',', '.');
        let val = parseFloat(valStr);
        if (isNaN(val)) val = 0;
        applyDiscount(val, false, true);
    });
    // Porcentagem input removed
    removeDiscountBtn.addEventListener('click', removeDiscount);
    paymentToggleRow.addEventListener('click', () => { if (cart.length > 0) { splitPaymentArea.style.display = 'none'; singlePaymentOptions.style.display = 'grid'; splitPaymentToggleBtn.innerHTML = "<i class='bx bx-columns'></i> Dividir Pagamento"; splitPaymentToggleBtn.classList.remove('active'); splitValue1.value = ''; splitValue2.value = ''; splitMethod1.value = ''; splitMethod2.value = ''; confirmSplitPaymentBtn.disabled = true; updateSplitRemaining(); openModal(paymentModal); } else { showCustomAlert("Vazio", "Adicione itens."); } });
    splitPaymentToggleBtn.addEventListener('click', () => { const isActive = splitPaymentArea.style.display !== 'none'; splitPaymentArea.style.display = isActive ? 'none' : 'block'; singlePaymentOptions.style.display = isActive ? 'grid' : 'none'; splitPaymentToggleBtn.innerHTML = isActive ? "<i class='bx bx-columns'></i> Dividir Pagamento" : "<i class='bx bx-x'></i> Cancelar Divisão"; splitPaymentToggleBtn.classList.toggle('active'); if (!isActive) { currentSplitPayments.totalSaleValue = lastSaleData?.total || 0; updateSplitRemaining(); splitMethod1.focus(); } else { confirmSplitPaymentBtn.disabled = true; } });
    [splitValue1, splitValue2, splitMethod1, splitMethod2].forEach(el => { el.addEventListener('input', updateSplitRemaining); el.addEventListener('change', updateSplitRemaining); });
    confirmSplitPaymentBtn.addEventListener('click', () => { if (Math.abs(currentSplitPayments.remaining) >= 0.01) { showCustomAlert("Erro", "Soma não bate."); return; } if (!splitMethod1.value || !splitMethod2.value || splitMethod1.value === splitMethod2.value) { showCustomAlert("Erro", "Selecione 2 formas diferentes."); return; } currentSplitPayments.method1 = splitMethod1.value; currentSplitPayments.value1 = parseFloat(splitValue1.value) || 0; currentSplitPayments.method2 = splitMethod2.value; currentSplitPayments.value2 = parseFloat(splitValue2.value) || 0; selectedPaymentMethod = `Dividido (${currentSplitPayments.method1} + ${currentSplitPayments.method2})`; summaryPaymentMethod.textContent = selectedPaymentMethod; summaryPaymentMethod.style.fontWeight = '600'; summaryPaymentMethod.style.color = 'var(--text-dark)'; updateSummary(); closeModal(paymentModal); });

    // --- VARIÁVEIS GLOBAIS DE IMPRESSÃO ---
    let selectedPrintFormat = 'thermal'; // 'thermal' ou 'a4'

    function prepararConferenciaFiscal() {
        const modal = document.getElementById('modal-confirm-fiscal');
        const listApt = document.getElementById('confirm-fiscal-apt-list');
        const listIgnored = document.getElementById('confirm-fiscal-ignored-list');
        const secIgnored = document.getElementById('section-ignored-fiscal');
        const btnConfirm = document.getElementById('btn-confirm-emission');

        if (!modal || !btnConfirm) return;

        // 1. RESET TOTAL
        listApt.innerHTML = '';
        listIgnored.innerHTML = '';
        btnConfirm.disabled = false;
        btnConfirm.style.opacity = "1";
        btnConfirm.innerHTML = `<i class='bx bx-paper-plane'></i> Confirmar e Emitir`;

        const globalDiscount = typeof discount !== 'undefined' ? discount : 0;
        const globalTroco = window.lastTrocoValue || 0;
        const totalVendaReal = lastSaleData ? lastSaleData.total : 0;

        const totalItensOriginal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        const fatorDesconto = totalItensOriginal > 0 ? (totalItensOriginal - globalDiscount) / totalItensOriginal : 1;

        let itensFiscaisFinal = [];
        let ignoredCount = 0;
        let somaBrutaFiscal = 0;

        // 2. PROCESSAMENTO INICIAL
        cart.forEach(item => {
            const ncmLimpo = (item.ncm || "").toString().replace(/\D/g, '');
            const temCfop = item.cfop && String(item.cfop).trim().length >= 3;

            if (ncmLimpo.length === 8 && temCfop) {
                const precoFiscal = Number((item.price * fatorDesconto).toFixed(2));
                const subtotalItem = Number((precoFiscal * item.quantity).toFixed(2));

                itensFiscaisFinal.push({
                    name: item.name,
                    ncm: ncmLimpo,
                    cfop: item.cfop,
                    quantity: item.quantity,
                    precoUnitario: precoFiscal,
                    subtotal: subtotalItem
                });
                somaBrutaFiscal += subtotalItem;
            } else {
                ignoredCount++;
                const div = document.createElement('div');
                div.innerHTML = `<p style="font-size:0.8rem; color:#92400e; margin-bottom:5px;">● ${item.name} (Sem NCM/CFOP)</p>`;
                listIgnored.appendChild(div);
            }
        });

        // 3. ARREDONDAMENTO ROBUSTO (0.05) - Apenas para Dinheiro
        // Se for Dinheiro, a nota fiscal TEM que bater com o arredondamento físico (x.00, x.05, x.10...)
        // Se for PIX/Cartão, mantém precisão de centavos (x.01, x.02...)

        const isCash = selectedPaymentMethod === 'Dinheiro';
        let totalFiscalAjustado = somaBrutaFiscal;

        if (isCash) {
            // Arredonda para o múltiplo de 0.05 mais próximo (Regra de Troco)
            // Ex: 19.99 -> 19.99 * 20 = 399.8 -> 400 / 20 = 20.00 (Errado, queremos Floor ou Round?)
            // A regra do Banco Central para troco é geralmente arredondar para BAIXO se não tem moeda,
            // mas aqui queremos alinhar com o que foi cobrado no checkout (que foi arredondado).
            // Vamos assumir o mesmo arredondamento usado no checkout: Floor(x * 2) / 2 para 0.50
            // MAS PERA: A nota fiscal precisa ser precisa. Se o checkout arredondou para 19.50, a nota tem que ser 19.50.

            // Recalcula o alvo baseado na regra de checkout (0.50)
            // totalVendaReal já deve estar arredondado se for dinheiro, mas vamos garantir.
            totalFiscalAjustado = Number(totalVendaReal.toFixed(2));
        } else {
            totalFiscalAjustado = Number(somaBrutaFiscal.toFixed(2));
        }

        let diferencaArredondamento = Number((totalFiscalAjustado - somaBrutaFiscal).toFixed(2));

        // Ajusta o último item fiscal para absorver a diferença (exigência da SEFAZ: Soma itens = vNF)
        if (itensFiscaisFinal.length > 0 && Math.abs(diferencaArredondamento) > 0.0001) {
            const ultimo = itensFiscaisFinal[itensFiscaisFinal.length - 1];

            // Aplica a diferença no subtotal do item
            ultimo.subtotal = Number((ultimo.subtotal + diferencaArredondamento).toFixed(2));

            // Recalcula o unitário para bater (Unitário = Subtotal / Quantidade)
            // A SEFAZ aceita até 4 casas decimais no unitário, o que ajuda no ajuste fino
            ultimo.precoUnitario = Number((ultimo.subtotal / ultimo.quantity).toFixed(4));

            // Log de Debug
            console.log(`[Fiscal] Ajuste de Arredondamento (${isCash ? 'Dinheiro' : 'Outro'}): ${diferencaArredondamento}`);
        }

        // 4. RENDERIZAÇÃO NA TELA
        itensFiscaisFinal.forEach(item => {
            const div = document.createElement('div');
            div.className = 'apt-item-row';
            div.innerHTML = `
            <div>
                <strong>${item.name}</strong>
                <span class="ncm-tag">NCM: ${item.ncm} | CFOP: ${item.cfop}</span>
            </div>
            <div style="text-align:right">${formatCurrency(item.precoUnitario)}</div>
            <div style="text-align:right"><strong>${formatCurrency(item.subtotal)}</strong></div>
        `;
            listApt.appendChild(div);
        });

        // 5. VALIDAÇÃO E BOTÃO
        document.getElementById('confirm-venda-total').textContent = formatCurrency(totalVendaReal);
        document.getElementById('confirm-fiscal-payment-method').textContent = selectedPaymentMethod || "Dinheiro";
        document.getElementById('confirm-valor-recebido').textContent = formatCurrency(totalVendaReal + globalTroco);
        document.getElementById('confirm-troco-real').textContent = formatCurrency(globalTroco);

        if (totalFiscalAjustado <= 0) {
            document.getElementById('confirm-base-fiscal').innerHTML = `<span style="color:red">R$ 0,00 (Sem itens fiscais)</span>`;
            document.getElementById('confirm-vpag-sefaz').textContent = "R$ 0,00";
            btnConfirm.disabled = true;
            btnConfirm.style.opacity = "0.5";
            btnConfirm.innerHTML = `<i class='bx bx-error-circle'></i> Não há itens para emitir`;
        } else {
            // vPag = Total da Nota + Troco (Sempre limpo agora)
            const vPagSefaz = totalFiscalAjustado + globalTroco;
            document.getElementById('confirm-base-fiscal').textContent = formatCurrency(totalFiscalAjustado);
            document.getElementById('confirm-vpag-sefaz').textContent = formatCurrency(vPagSefaz);
            btnConfirm.disabled = false;
            btnConfirm.style.opacity = "1";
        }

        secIgnored.style.display = ignoredCount > 0 ? 'block' : 'none';
        openModal(modal);
    }

    // --- SEÇÃO FISCAL: NAVEGAÇÃO E PENDÊNCIAS ---

    function switchOrderTab(tab) {
        const emitidasView = document.getElementById('orders-emitidas-view');
        const pendentesView = document.getElementById('orders-pendentes-view');
        const tabs = document.querySelectorAll('.order-tab');

        // Remove classe ativa de todos
        tabs.forEach(t => t.classList.remove('active'));

        if (tab === 'emitidas') {
            emitidasView.style.display = 'block';
            pendentesView.style.display = 'none';
            // Seleciona a aba correta para destacar
            document.querySelector('.order-tab[onclick*="emitidas"]').classList.add('active');
        } else {
            emitidasView.style.display = 'none';
            pendentesView.style.display = 'block';
            document.querySelector('.order-tab[onclick*="pendentes"]').classList.add('active');
            renderizarItensPendentes(); // Atualiza a lista de itens com erro
        }
    }

    // Renderiza itens que foram ignorados na última tentativa de emissão
    function renderizarItensPendentes() {
        const container = document.getElementById('pendentes-list');
        if (!container) return;

        // 'itensFiscaisPendentes' deve ser preenchido durante o processFinalSale
        if (!window.itensFiscaisPendentes || window.itensFiscaisPendentes.length === 0) {
            container.innerHTML = '<div class="empty-state">Nenhum item pendente de correção.</div>';
            return;
        }

        container.innerHTML = window.itensFiscaisPendentes.map(item => `
        <div class="apt-item-row" style="padding: 12px; border-bottom: 1px solid #eee;">
            <div>
                <strong>${item.name}</strong>
                <span class="ncm-tag" style="color: #ef4444;">Motivo: ${item.reason}</span>
            </div>
            <div class="text-right">
                <button class="btn-view" onclick="abrirEdicaoProduto('${item.id}')">
                    <i class='bx bx-edit'></i> Corrigir
                </button>
            </div>
        </div>
    `).join('');
    }

    document.getElementById('btn-cancel-fiscal').onclick = () => {
        closeModal(document.getElementById('modal-confirm-fiscal'));
    };

    // Listener para o botão de CONFIRMAR EMISSÃO (Verde)
    document.getElementById('btn-confirm-emission').onclick = () => {
        emissaoFiscalAtiva = true; // Ativa a flag fiscal
        closeModal(document.getElementById('modal-confirm-fiscal'));
        processFinalSale(pendingPrintFormat); // pendingPrintFormat já deve estar definido globalmente
    };

    // Listener para o botão de NÃO EMITIR (Cinza)
    document.getElementById('btn-cancel-fiscal').onclick = () => {
        emissaoFiscalAtiva = false; // Desativa a flag fiscal
        closeModal(document.getElementById('modal-confirm-fiscal'));
        processFinalSale(pendingPrintFormat);
    };
    // --- 1. BOTÃO FINALIZAR VENDA (F9) ---

    // Variável global ao bloco para armazenar o formato
    let pendingPrintFormat = 'thermal';
    let emissaoFiscalAtiva = true; // Flag global de controle

    finishSaleBtn.addEventListener('click', () => {
        if (cart.length === 0) return showCustomAlert("Vazio", "Adicione itens.");
        if (!selectedPaymentMethod) {
            showCustomAlert("Pagamento", "Selecione a forma de pagamento.");
            openModal(paymentModal);
            return;
        }

        if (selectedPaymentMethod === 'Crediário') {
            if (!selectedCrediarioClient) {
                showCustomAlert("Atenção", "Selecione o cliente.");
                openModal(clientSelectionModal);
                return;
            }
            pendingPrintFormat = 'a4';
            prepararConferenciaFiscal();
        } else {
            openModal(document.getElementById('print-selection-modal'));
        }
    });

    // Handlers de seleção de impressão
    document.getElementById('btn-print-thermal').onclick = () => {
        closeModal(document.getElementById('print-selection-modal'));
        pendingPrintFormat = 'thermal';
        if (selectedHistorySale) {
            printHistoryReceipt(selectedHistorySale, 'thermal');
            selectedHistorySale = null;
        } else {
            prepararConferenciaFiscal();
        }
    };

    document.getElementById('btn-print-a4').onclick = () => {
        closeModal(document.getElementById('print-selection-modal'));
        pendingPrintFormat = 'a4';
        if (selectedHistorySale) {
            printHistoryReceipt(selectedHistorySale, 'a4');
            selectedHistorySale = null;
        } else {
            prepararConferenciaFiscal();
        }
    };

    let isReturningToPayment = false; // Controle de fluxo

    /* ======================================== */
    /* == BACKGROUND SALE PROCESSING LOGIC   == */
    /* ======================================== */

    // --- Notification Helpers ---
    const notifSidebar = document.getElementById('sale-processing-notification');
    const notifTitle = document.getElementById('notif-title');
    const notifStatus = document.getElementById('notif-status');

    function showProcessingNotification() {
        if (!notifSidebar) return;
        notifSidebar.classList.remove('success', 'error');
        notifSidebar.classList.add('active');
        if (notifTitle) notifTitle.innerText = "Processando...";
        if (notifStatus) notifStatus.innerText = "Iniciando...";
    }

    function updateNotificationStatus(percent, message) {
        if (!notifSidebar) return;
        // Percent ignored in new UI
        if (notifStatus) notifStatus.innerText = message;
    }

    function showSuccessNotification() {
        if (!notifSidebar) return;
        notifSidebar.classList.add('success');
        if (notifTitle) notifTitle.innerText = "Venda Concluída!";
        if (notifStatus) notifStatus.innerText = "Tudo certo.";

        setTimeout(() => {
            notifSidebar.classList.remove('active');
            // Reset styles after hiding
            setTimeout(() => {
                notifSidebar.classList.remove('success', 'error');
            }, 500);
        }, 3000);
    }

    function showErrorNotification(message) {
        if (!notifSidebar) return;
        notifSidebar.classList.add('error');
        if (notifTitle) notifTitle.innerText = "Erro";
        if (notifStatus) notifStatus.innerText = message || "Falha ao salvar.";

        setTimeout(() => {
            notifSidebar.classList.remove('active');
            setTimeout(() => {
                notifSidebar.classList.remove('success', 'error');
            }, 500);
        }, 5000);
    }

    // --- Data Capture ---
    function captureSaleState(printFormat, isFiscalActive) {
        return {
            items: JSON.parse(JSON.stringify(cart)), // Deep copy items
            metodoPagamento: selectedPaymentMethod,
            client: selectedCrediarioClient ? JSON.parse(JSON.stringify(selectedCrediarioClient)) : null,
            discount: discount || 0,
            troco: window.lastTrocoValue || 0,
            printFormat: printFormat,
            isFiscalActive: isFiscalActive,
            saleId: "V" + new Date().getTime().toString().slice(-8),
            tempInstallments: window.tempInstallments || 1, // Capture installments if present
            valorTotal: cart.reduce((acc, item) => acc + (item.price * item.quantity), 0) - (discount || 0),
            // --- DADOS PARA MIGRAÇÃO ---
            operador: document.getElementById('summary-seller-name') ? document.getElementById('summary-seller-name').textContent : "Caixa",
            taxaString: document.getElementById('infinitepay-tax-val') ? document.getElementById('infinitepay-tax-val').textContent : "R$ 0,00",
            installments: selectedInstallments,
            pixType: selectedPixType
        };
    }

    // --- FUNÇÃO DE MIGRAÇÃO (ENVIO PARA NOVA API CENTRAL) ---
    async function sendToCentralApi(saleData) {
        try {
            console.log("Iniciando envio para API Central (Migração)...");

            const operadorNome = saleData.operador || "Caixa";
            // Regra: Nubia = ADM, outros = Caixa
            const cargo = operadorNome === "Nubia" ? "ADM" : "Caixa";

            // Tratamento da Taxa
            const taxaStr = saleData.taxaString || "0";
            // Remove R$, pontos e substitui virgula por ponto
            const taxaVal = parseFloat(taxaStr.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;

            // Tratamento do Pagamento
            let pagamentoDetalhe = saleData.metodoPagamento;
            if (pagamentoDetalhe === 'C. Crédito') {
                const flag = saleData.cardFlag || '';
                const inst = saleData.installments || '';
                if (flag && inst) {
                    pagamentoDetalhe = `Crédito ${inst}x ${flag}`;
                }
            } else if (pagamentoDetalhe === 'PIX') {
                // Mapeamento PIX Migração
                if (saleData.pixType === 'maquininha') {
                    pagamentoDetalhe = 'PixQr';
                } else {
                    // qrcode ou null(default)
                    pagamentoDetalhe = 'PIX';
                }
            }

            // Tratamento do Valor Total (Neto) e Bruto
            // saleData.valorTotal já é (items - desconto)
            // Precisamos do Bruto para o campo 'valor' (item 6)
            // item 9 'total' = Valor da Operação (Neto) - Taxas

            const valorNetoVenda = saleData.valorTotal;
            const valorBrutoVenda = valorNetoVenda + (saleData.discount || 0);

            const totalLiquidoComTaxas = valorNetoVenda - taxaVal;

            // Tratamento da Descrição (Lista de Itens)
            const listaItens = saleData.items.map(i => `${i.quantity}x ${i.name}`).join('; ');
            const descricaoFinal = listaItens || "Venda no PDV";

            const payload = {
                loja: "DT#25",      // 1. Loja (Fixo)
                operador: operadorNome, // 2. Operador
                cargo: cargo,       // 3. Cargo
                tipo: "entrada",    // 4. Tipo (Fixo)
                id: saleData.saleId,// 5. ID (Novo)
                pagamento: pagamentoDetalhe, // 6. Pagamento (Formatado)
                valor: valorBrutoVenda,      // 7. Valor
                desconto: saleData.discount || 0, // 8. Desconto
                taxas: taxaVal,     // 9. Taxas
                total: totalLiquidoComTaxas, // 10. Total
                descricao: descricaoFinal    // 11. Descrição (Lista de itens)
                // Timestamp vai ser gerado pelo Google Script (new Date())
            };

            // Envio 'no-cors' para evitar bloqueio, enviando como string text/plain mas formato JSON
            await fetch(CENTRAL_API_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: JSON.stringify(payload)
            });

            console.log("Dados enviados para API Central com sucesso!");

        } catch (e) {
            console.error("Erro na migração API Central:", e);
            // Silencioso para o usuário final
        }
    }

    // --- Background Worker ---
    async function startBackgroundSale(saleData) {
        console.log("Starting Background Sale:", saleData.saleId);
        updateNotificationStatus(10, "Preparando dados...");

        // Destructure for easier access
        const { items, metodoPagamento, client, discount, troco, printFormat, isFiscalActive, saleId, tempInstallments } = saleData;

        try {
            // 1. Calculations
            const totalBase = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
            const factor = totalBase > 0 ? (totalBase - discount) / totalBase : 1;

            const itensAptos = [];
            const itensIgnorados = [];

            items.forEach(item => {
                const ncmLimpo = (item.ncm || "").toString().replace(/\D/g, '');
                if (ncmLimpo.length === 8 && item.cfop) {
                    itensAptos.push({
                        id: item.id || item.codigo,
                        name: (item.name || item.nome).substring(0, 120),
                        price: Number((item.price * factor).toFixed(2)),
                        quantity: Number(item.quantity || 1),
                        ncm: ncmLimpo,
                        cfop: item.cfop,
                        unit: item.unit || 'UN'
                    });
                } else {
                    itensIgnorados.push({ name: item.name, reason: "NCM/CFOP ausente" });
                }
            });

            const totalFiscalLiquido = itensAptos.reduce((acc, i) => acc + (i.price * i.quantity), 0);

            // 2. Fiscal Emission
            let dadosFiscal = {
                status: "Não Emitida",
                mensagem: "Venda simples registrada",
                saleId: saleId,
                itensIgnorados: itensIgnorados
            };

            if (isFiscalActive && itensAptos.length > 0) {
                updateNotificationStatus(30, "Emitindo NFC-e...");
                try {
                    const response = await fetch(`${FISCAL_API_URL}/emitirNfce`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            items: itensAptos,
                            totalPagamento: totalFiscalLiquido,
                            paymentMethod: metodoPagamento,
                            troco: troco,
                            valorPagoManual: totalFiscalLiquido + troco,
                            saleId: saleId
                        })
                    });
                    const resFiscal = await response.json();

                    if (resFiscal.status === "success") {
                        dadosFiscal = {
                            status: "Autorizada",
                            cStat: resFiscal.cStat,
                            chave: resFiscal.chave,
                            nProt: resFiscal.nProt,
                            nNF: resFiscal.nNF,
                            xml: resFiscal.xml,
                            mensagem: resFiscal.message,
                            saleId: saleId,
                            itensIgnorados: itensIgnorados
                        };
                    } else {
                        dadosFiscal = {
                            status: "Rejeitada",
                            cStat: resFiscal.cStat,
                            mensagem: resFiscal.message,
                            saleId: saleId,
                            itensIgnorados: itensIgnorados
                        };
                    }
                } catch (err) {
                    dadosFiscal.status = "Erro";
                    dadosFiscal.mensagem = "Erro de comunicação";
                }
            }

            updateNotificationStatus(60, "Salvando dados...");

            // 3. Persist Data
            const clientName = client ? client.nomeExibicao : "Cliente Balcão";
            const totalGeralVenda = saleData.valorTotal;

            // Recalculate Totals for Reporting (Gross vs Net)
            // Ensure we use originalPrice if available to reconstruct the Gross Subtotal
            const subtotalBruto = items.reduce((acc, item) => acc + ((item.originalPrice || item.price) * item.quantity), 0);
            const totalLiquidoItens = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
            const globalDiscount = discount || 0;
            const totalDesconto = (subtotalBruto - totalLiquidoItens) + globalDiscount;

            const dadosVendaInterna = {
                id: saleId,
                cliente: clientName,
                valorTotal: totalGeralVenda,
                itens: items,
                metodoPagamento: metodoPagamento
            };

            const promisesParaExecutar = [
                fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: "salvarNotaFiscal", data: dadosFiscal }) }),
                // Pass Gross Subtotal and Total Discount to match legacy behavior
                registrarVendaAtual(
                    [{ method: metodoPagamento, value: totalGeralVenda }],
                    subtotalBruto,
                    totalDesconto
                ),
                salvarVendaNoHistorico(dadosVendaInterna),
                abaterEstoqueFirebase(items),
                abaterEstoquePlanilha(items)
            ];

            if (String(metodoPagamento).toLowerCase().includes('crediário')) {
                const idCli = client ? client.idCliente : null;
                if (idCli) {
                    const params = new URLSearchParams({
                        action: 'registrarTransacao',
                        idCliente: idCli,
                        valor: totalGeralVenda,
                        tipo: 'Compra',
                        parcelas: tempInstallments || 1,
                        isEntrada: 'false'
                    });
                    promisesParaExecutar.push(fetch(`${SCRIPT_URL}?${params.toString()}`));
                }
            }

            // --- DISPARO DA MIGRAÇÃO (EM PARALELO) ---
            promisesParaExecutar.push(sendToCentralApi(saleData));

            await Promise.allSettled(promisesParaExecutar);

            updateNotificationStatus(90, "Finalizando...");

            // 4. Printing
            if (printFormat === 'a4') {
                printA4(clientName, saleData);
            } else {
                printThermal(clientName, saleData);
            }

            showSuccessNotification();

        } catch (error) {
            console.error("Background Sale Error:", error);
            showErrorNotification("Erro ao salvar. Verifique conexão.");
        } finally {
            finishSaleBtn.disabled = false;
            finishSaleBtn.style.backgroundColor = '';
            finishSaleBtn.innerText = "Finalizar Compra (F9)";
        }
    }

    // --- PROCESSAMENTO FINAL DA VENDA (Refatorado para Async) --
    async function processFinalSale(printFormat = 'thermal') {
        const btnId = emissaoFiscalAtiva ? 'btn-confirm-emission' : 'btn-cancel-fiscal';

        if (cart.length === 0) return showCustomAlert("Atenção", "Carrinho vazio!");

        // 1. Capture State
        const saleState = captureSaleState(printFormat, emissaoFiscalAtiva);

        // 2. Reset UI Immediately
        clearCart();
        selectedCrediarioClient = null;
        const clientSpan = document.getElementById('selected-client-name');
        if (clientSpan) clientSpan.innerText = "Cliente não identificado";

        closeModal(document.getElementById('modal-confirm-fiscal'));
        closeModal(document.getElementById('payment-modal'));
        closeModal(document.getElementById('print-selection-modal'));

        // 3. Start Background Process
        showProcessingNotification();

        // Disable temporarily to prevent accidental double-trigger on old state?
        // Not needed as cart is empty.

        // Call async without await
        startBackgroundSale(saleState);
    }

    async function cancelarNota(chave, nProt) {
        // 1. Validações iniciais
        if (!chave || !nProt) return alert("Dados da nota incompletos.");

        // Pergunta a justificativa (Obrigatória, mín 15 caracteres)
        const justificativa = prompt("Digite o motivo do cancelamento (Mínimo 15 letras):\nEx: Desistencia da compra pelo cliente no balcao");

        if (!justificativa || justificativa.length < 15) {
            return alert("O motivo é obrigatório e precisa ter no mínimo 15 caracteres.");
        }

        if (!confirm("Tem certeza? Esta ação é irreversível e o prazo é de 30 minutos após a emissão.")) {
            return;
        }

        try {
            // Mostra loading
            showCustomAlert("Aguarde", "Processando cancelamento na SEFAZ...", "info");

            // 2. Chama o Backend
            const response = await fetch("https://sua-url-cloud-run/cancelarNfce", { // <-- ATUALIZE A URL
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chave: chave,
                    nProt: nProt,
                    justificativa: justificativa
                })
            });

            const data = await response.json();

            if (data.status === "success") {
                alert("✅ SUCESSO! Nota cancelada.\nStatus: " + data.message);

                // 3. Atualiza na Planilha (Opcional, mas recomendado)
                // Você deve criar uma ação no Code.js para atualizar o status da linha para "CANCELADA"
                registrarCancelamentoPlanilha(chave);

            } else {
                alert("❌ ERRO AO CANCELAR:\nCód: " + data.cStat + "\nMotivo: " + data.message);
            }

        } catch (err) {
            console.error(err);
            alert("Erro de comunicação com o servidor.");
        }
    }

    // Função auxiliar para atualizar a planilha (adicione ao script.js)
    function registrarCancelamentoPlanilha(chave) {
        fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: "atualizarStatusNota", // Você precisará criar isso no Code.js se quiser
                chave: chave,
                novoStatus: "CANCELADA"
            })
        });
    }
    // 2. Botão Concluir Final (AGORA SÓ LIMPA A TELA)
    // Como já salvamos no passo anterior, este botão serve apenas para fechar o ciclo.
    btnFinishCrediarioFinal.addEventListener('click', () => {
        showCustomAlert("Sucesso", "Processo de crediário finalizado!");

        closeModal(crediarioFlowModal);

        // Limpa tudo e prepara para nova venda
        clearCart();
        selectedCrediarioClient = null;
        // Reseta botão de imprimir para a próxima vez
        btnForcePrint.disabled = false;
        btnForcePrint.innerHTML = "<i class='bx bx-printer'></i> Imprimir Comprovante";

        barcodeInput.focus();
    });

    cancelSaleBtn.addEventListener('click', () => { if (cart.length === 0) return; showCustomConfirm("Cancelar Venda", "Tem certeza?", () => { clearCart(); closeModal(confirmModal); }); });
    confirmActionBtn.addEventListener('click', () => { if (confirmCallback) { confirmCallback(); confirmCallback = null; } });
    document.querySelectorAll('.close-modal-btn').forEach(btn => { btn.addEventListener('click', (e) => { const modal = e.target.closest('.modal-overlay'); if (modal && modal.id !== 'receipt-modal' && modal.id !== 'open-caixa-modal') { closeModal(modal); if (modal.id === 'add-cliente-modal') { resetClienteModal(); } else if (modal.id === 'close-caixa-modal') { resetFecharCaixaModal(); } } }); });
    printReceiptBtn.addEventListener('click', handlePrintReceipt);
    newSaleBtn.addEventListener('click', () => { closeModal(receiptModal); clearCart(); barcodeInput.focus(); });
    quickAddName.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); quickAddPrice.focus(); } });
    quickAddPrice.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); quickAddSubmitBtn.click(); } });
    quickAddSubmitBtn.addEventListener('click', handleQuickAddSubmit);
    quickAddForm.addEventListener('submit', (e) => { e.preventDefault(); handleQuickAddSubmit(); });

    // Adicione esta função ao seu script.js
    async function carregarHistoricoFiscal() {
        const tbodyEmitidas = document.getElementById('lista-notas-emitidas');
        if (!tbodyEmitidas) return;

        tbodyEmitidas.innerHTML = '<tr><td colspan="5" class="text-center pad-20"><i class="bx bx-loader-alt bx-spin"></i> Processando XMLs...</td></tr>';

        try {
            const response = await fetch(`${SCRIPT_URL}?action=listarNotasFiscais`);
            const result = await response.json();

            if (result.status === 'success' && Array.isArray(result.data)) {
                tbodyEmitidas.innerHTML = '';

                result.data.forEach(nota => {
                    const tr = document.createElement('tr');

                    // 1. Extração de dados do XML (vNF e tPag)
                    const valorXML = extrairTagXML(nota.xml, "vNF");
                    const codPagXML = extrairTagXML(nota.xml, "tPag");

                    const valorFormatado = valorXML ? formatCurrency(parseFloat(valorXML)) : "R$ 0,00";
                    const formaPagamento = codPagXML ? traduzirPagamentoSEFAZ(codPagXML) : "---";

                    // 2. Lógica da Barra Lateral de Status
                    let statusBarClass = 'bar-rejected';
                    const statusLower = String(nota.status).toLowerCase();
                    const temItensIgnorados = nota.itensIgnorados && nota.itensIgnorados.trim().length > 2;

                    if (statusLower.includes('autorizada')) {
                        statusBarClass = temItensIgnorados ? 'bar-partial' : 'bar-approved';
                    } else if (statusLower.includes('cancelada')) {
                        statusBarClass = 'bar-cancelled';
                    }

                    // 3. Formatação da Data
                    let dataEmi = "---";
                    if (nota.timestamp) {
                        const d = new Date(nota.timestamp);
                        dataEmi = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    }

                    tr.innerHTML = `
                    <td>
                        <div class="note-cell-wrapper">
                            <div class="status-indicator-bar ${statusBarClass}"></div>
                            <div style="display:flex; flex-direction:column">
                                <span class="note-number">N° ${nota.nNF || '---'}</span>
                                <small style="font-size:0.7rem; color:var(--text-light)">ID: ${nota.idVenda.slice(-6)}</small>
                            </div>
                        </div>
                    </td>
                    <td style="color:var(--text-light)">Consumidor Final</td>
                    <td style="font-size:1rem">${dataEmi}</td>
                    <td>
                        <div style="display:flex; flex-direction:column">
                            <strong style="color:var(--text-dark)">${valorFormatado}</strong>
                            <small style="color:var(--info-blue); font-weight:500; font-size:0.75rem">${formaPagamento}</small>
                        </div>
                    </td>
                    <td class="text-right">
                        <div style="display:flex; justify-content: flex-end; gap:8px;">
                            <button class="btn-icon-small" onclick="copiarChave('${nota.chave}')" title="Copiar Chave">
                                <i class='bx bx-copy'></i>
                            </button>
                            <button class="btn-icon-small" onclick="visualizarDetalhesNota('${nota.idVenda}')" title="Ver Detalhes">
                                <i class='bx bx-search-alt'></i>
                            </button>
                        </div>
                    </td>
                `;
                    tbodyEmitidas.appendChild(tr);
                });
            }
        } catch (e) {
            console.error("Erro fiscal:", e);
            tbodyEmitidas.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Erro ao carregar dados fiscais.</td></tr>';
        }
    }

    // Pop-up detalhado para a ação de visualização
    window.visualizarDetalhesNota = async (idVenda) => {
        const response = await fetch(`${SCRIPT_URL}?action=listarNotasFiscais`);
        const result = await response.json();
        const nota = result.data.find(n => n.idVenda === idVenda);

        if (nota) {
            const itensRemovidos = nota.itensIgnorados || "Nenhum item foi removido.";
            showCustomAlert(
                `Nota Fiscal #${nota.nNF}`,
                `Status: ${nota.status}\n\nChave: ${nota.chave}\n\nProtocolo: ${nota.nProt}\n\nRetorno SEFAZ: ${nota.mensagem}\n\nItens Pendentes: ${itensRemovidos}`
            );
        }
    };

    // Funções de Pop-up para as Ações
    window.copiarChave = (chave) => {
        if (!chave) return showCustomAlert("Erro", "Chave não disponível.");
        navigator.clipboard.writeText(chave);
        showCustomToast("Chave copiada para a área de transferência!");
    };

    window.visualizarInfoFiscal = async (idVenda) => {
        // Aqui você pode abrir um modal com o retorno da SEFAZ salvo na coluna 'mensagem'
        const response = await fetch(`${SCRIPT_URL}?action=listarNotasFiscais`);
        const result = await response.json();
        const nota = result.data.find(n => n.idVenda === idVenda);

        if (nota) {
            showCustomAlert(`Detalhes da Venda ${nota.idVenda}`,
                `Status: ${nota.status}\n\nRetorno SEFAZ: ${nota.mensagem}\n\nItens Ignorados: ${nota.itensIgnorados || 'Nenhum'}`);
        }
    };

    // Função para extrair valores de tags específicas do XML
    function extrairTagXML(xmlString, tag) {
        if (!xmlString || xmlString === "" || xmlString === "---") return null;
        const regex = new RegExp(`<${tag}>(.*?)<\/${tag}>`, 'i');
        const match = xmlString.match(regex);
        return match ? match[1] : null;
    }

    // Tradutor de códigos de pagamento da SEFAZ
    function traduzirPagamentoSEFAZ(codigo) {
        const tipos = {
            "01": "Dinheiro",
            "02": "Cheque",
            "03": "C. Crédito",
            "04": "C. Débito",
            "05": "Crediário",
            "10": "Vale Alimentação",
            "11": "Vale Refeição",
            "15": "Boleto",
            "17": "PIX",
            "99": "Outros"
        };
        return tipos[codigo] || "Outros";
    }

    // 1. Tenta pegar o botão da Navbar (Barra lateral/principal)
    const btnFiscalNavbar = document.querySelector('.navbar-item[data-page="notas"]');
    if (btnFiscalNavbar) {
        btnFiscalNavbar.addEventListener('click', () => {
            carregarHistoricoFiscal();
            // Se tiver lógica de troca de tela/aba, adicione aqui. Ex:
            // document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
            // document.getElementById('notas-page').style.display = 'block';
        });
    }

    // 2. Tenta pegar o botão do Menu "Mais" (O que você mostrou no código)
    const btnFiscalMenu = document.querySelector('.more-menu-item[data-page="notas"]');
    if (btnFiscalMenu) {
        btnFiscalMenu.addEventListener('click', () => {
            carregarHistoricoFiscal();
            // Mesma lógica de troca de tela aqui, se necessário
        });
    }

    // Função para abrir o modal DANFE
    window.verDanfe = (idVenda) => {
        const reg = fiscalHistory.find(r => r.idVenda === idVenda);
        if (!reg) return;

        const container = document.getElementById('danfe-itens-list');
        container.innerHTML = '';
        let total = 0;

        reg.itensEmitidos.forEach(item => {
            const val = item.price * item.quantity;
            total += val;
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.marginBottom = '5px';
            row.innerHTML = `
            <span>${item.name.substring(0, 15)}... <small>x${item.quantity}</small></span>
            <span>${formatCurrency(val)}</span>
        `;
            container.appendChild(row);
        });

        document.getElementById('danfe-total-valor').textContent = formatCurrency(total);
        openModal(document.getElementById('modal-ver-nota'));
    };

    // Atalho para ir editar o produto direto
    window.corrigirProduto = (idProd) => {
        // Fecha página de notas
        // Vai para página de produtos
        document.querySelector('.navbar-item[data-page="produtos"]').click(); // Simula clique
        // Abre modal de edição
        setTimeout(() => {
            openProductEdit(idProd);
        }, 500);
    };

    // Função auxiliar para mostrar a tela de parcelas (Limpeza de código)
    function showCrediarioScreen() {
        // Esconde seleção principal
        document.getElementById('single-payment-options').style.display = 'none';
        document.getElementById('split-payment-toggle-btn').style.display = 'none';

        // Atualiza nome do cliente na tela nova
        const lblClientName = document.getElementById('lbl-cred-client-name');
        if (lblClientName && selectedCrediarioClient) {
            lblClientName.textContent = selectedCrediarioClient.nomeExibicao;
        }

        // Mostra tela de parcelas
        const crediarioArea = document.getElementById('crediario-options');
        crediarioArea.style.display = 'block';

        // Atualiza simulação
        const total = lastSaleData ? lastSaleData.total : 0;
        const select = document.getElementById('sale-installments');
        const preview = document.getElementById('installment-preview');

        const updatePreview = () => {
            const parc = parseInt(select.value);
            const val = total / parc;
            preview.innerHTML = `${parc}x de ${formatCurrency(val)}`;
        };

        select.onchange = updatePreview;
        updatePreview();
    }

    smartRoundingToggle.addEventListener('change', (e) => { isSmartRoundingEnabled = e.target.checked; if (discount > 0) { applyDiscount(discount, false); } });
    reloadCacheBtn.addEventListener('click', () => { showCustomConfirm("Recarregar Produtos", "Buscar lista recente?", () => { closeModal(confirmModal); carregarCacheDeProdutos(); }); });

    // Função para atualizar a posição do marcador vermelho
    const updateNavbarHighlight = (activeItem) => {
        if (!activeItem || !navbarHighlight || !mainNavbar) return;

        const itemRect = activeItem.getBoundingClientRect();
        const navbarRect = mainNavbar.getBoundingClientRect();

        // Calcula a posição relativa do item dentro da navbar
        const left = itemRect.left - navbarRect.left;
        const width = itemRect.width;

        // Aplica os valores
        navbarHighlight.style.width = `${width}px`;
        navbarHighlight.style.left = `${left}px`;
    };

    // --- Navegação SPA (Navbar) - CORRIGIDA E OTIMIZADA ---
    const moreMenuBtn = document.getElementById('more-menu-btn');
    const moreMenuModal = document.getElementById('more-menu-modal');
    const moreMenuIcon = document.getElementById('more-menu-icon');

    if (moreMenuBtn && moreMenuModal) {
        moreMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isShowing = moreMenuModal.classList.toggle('show');
            if (moreMenuIcon) {
                moreMenuIcon.style.transform = isShowing ? 'rotate(180deg)' : 'rotate(0deg)';
            }
        });
    }

    document.addEventListener('click', () => {
        if (moreMenuModal) moreMenuModal.classList.remove('show');
        if (moreMenuIcon) moreMenuIcon.style.transform = 'rotate(0deg)';
    });

    const allNavTriggers = document.querySelectorAll('.navbar-item:not(#more-menu-btn), .more-menu-item');

    allNavTriggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            const page = trigger.dataset.page;
            if (!page) return;

            // Remove active de tudo
            document.querySelectorAll('.navbar-item').forEach(el => el.classList.remove('active', 'active-parent'));
            document.querySelectorAll('.more-menu-item').forEach(el => el.classList.remove('active'));

            if (trigger.classList.contains('more-menu-item')) {
                trigger.classList.add('active');
                if (moreMenuBtn) {
                    moreMenuBtn.classList.add('active-parent');
                    updateNavbarHighlight(moreMenuBtn);
                }
            } else {
                trigger.classList.add('active');
                updateNavbarHighlight(trigger);
            }

            const pageId = page + '-page';
            const targetPage = document.getElementById(pageId);

            if (targetPage) {
                allPages.forEach(p => p.style.display = 'none');
                targetPage.style.display = 'block';
            }

            if (page === 'pedidos') renderDummyOrders();
            if (pageId === 'produtos-page' && !localProductCache) carregarCacheDeProdutos();
            if (pageId === 'clientes-page' && !localClientCache) carregarClientesDaAPI();
            if (pageId === 'historico-page') carregarHistorico();

            if (moreMenuModal) moreMenuModal.classList.remove('show');
            if (moreMenuIcon) moreMenuIcon.style.transform = 'rotate(0deg)';
        });
    });

    // Resize listener - atualiza a posição do marcador
    window.addEventListener('resize', () => {
        const active = document.querySelector('.navbar-item.active');
        if (active) updateNavbarHighlight(active);
    });

    // Listeners do Modal Adicionar Cliente
    if (addClienteBtn) {
        addClienteBtn.addEventListener('click', () => {
            resetClienteModal();
            openModal(addClienteModal);
            setTimeout(() => {
                if (clienteApelidoInput) clienteApelidoInput.focus();
            }, 100);
        });
    }

    clienteSaveBtn.addEventListener('click', () => { if (!validateStep2()) return; const clienteData = { nomeCompleto: clienteNomeInput.value.trim(), apelido: clienteApelidoInput.value.trim(), telefone: clienteTelefoneInput.value.trim(), endereco: clienteEnderecoInput.value.trim(), valorCompra: compraValorInput.value, numParcelas: compraParcelasInput.value, primeiroVencimento: compraVencimentoInput.value }; salvarClienteNaAPI(clienteData); });

    if (addClienteForm) {
        addClienteForm.addEventListener('submit', (e) => {
            e.preventDefault();

            // 1. Validação
            const apelido = clienteApelidoInput.value.trim();
            if (!apelido) {
                showCustomAlert("Obrigatório", "O campo Apelido é obrigatório.");
                clienteApelidoInput.classList.add('input-error');
                return;
            }
            clienteApelidoInput.classList.remove('input-error');

            // 2. Coleta de Dados
            // No evento de submit do form add-cliente-form
            const clienteData = {
                nomeCompleto: clienteNomeInput.value.trim(),
                apelido: apelido,
                telefone: clienteTelefoneInput.value.trim(),
                cpf: clienteCpfInput ? clienteCpfInput.value.trim() : "",
                endereco: clienteEnderecoInput.value.trim(),

                // NOVOS CAMPOS PARA O SISTEMA DE FATURA:
                diaVencimento: document.getElementById('cliente-dia-vencimento').value,
                limite: document.getElementById('cliente-limite').value || 0,

                // Campos antigos de compra inicial (se ainda usar):
                valorCompra: compraValorInput.value,
                // Nota: 'primeiroVencimento' não é mais tão útil se o sistema calcula automático,
                // mas se quiser manter para a compra inicial, ok.
                // O backend atualizado (item 1B acima) precisa estar preparado para ignorar ou usar isso.
            };

            // 3. Envia para API
            salvarClienteNaAPI(clienteData);
        });
    }

    // Listeners dos Modais de Caixa
    headerCloseCaixaBtn.addEventListener('click', () => {
        resetFecharCaixaModal();
        openModal(closeCaixaModal);
    });

    // Submit Abrir Caixa
    openCaixaForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const abrirSemValor = openCaixaSemValorCheckbox.checked;
        const notasInput = openCaixaNotasInput.value.trim();
        const moedasInput = openCaixaMoedasInput.value.trim();
        const notas = parseFloat(notasInput) || 0;
        const moedas = parseFloat(moedasInput) || 0;

        if (!abrirSemValor && !notasInput && !moedasInput) {
            showCustomAlert("Valor Inválido", "Informe Notas ou Moedas, ou marque 'Abrir sem valor'.");
            if (!notasInput) openCaixaNotasInput.classList.add('input-error'); else openCaixaNotasInput.classList.remove('input-error');
            if (!moedasInput) openCaixaMoedasInput.classList.add('input-error'); else openCaixaMoedasInput.classList.remove('input-error');
            return;
        }
        if ((notasInput && notas < 0) || (moedasInput && moedas < 0)) {
            showCustomAlert("Valor Inválido", "Valores não podem ser negativos.");
            if (notasInput && notas < 0) openCaixaNotasInput.classList.add('input-error'); else openCaixaNotasInput.classList.remove('input-error');
            if (moedasInput && moedas < 0) openCaixaMoedasInput.classList.add('input-error'); else openCaixaMoedasInput.classList.remove('input-error');
            return;
        }

        openCaixaNotasInput.classList.remove('input-error');
        openCaixaMoedasInput.classList.remove('input-error');

        const data = {
            valorNotas: abrirSemValor ? '0.00' : notas.toFixed(2),
            valorMoedas: abrirSemValor ? '0.00' : moedas.toFixed(2)
        };
        abrirCaixaAPI(data);
    });

    // Listener para Checkbox Abrir sem Valor
    openCaixaSemValorCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        openCaixaNotasInput.disabled = isChecked;
        openCaixaMoedasInput.disabled = isChecked;
        openCaixaNotasInput.classList.remove('input-error');
        openCaixaMoedasInput.classList.remove('input-error');
        if (isChecked) {
            openCaixaNotasInput.value = '0.00';
            openCaixaMoedasInput.value = '0.00';
        } else {
            openCaixaNotasInput.value = '';
            openCaixaMoedasInput.value = '';
        }
    });

    // Event listeners já consolidados no final do arquivo
    // closeCaixaNextBtn.addEventListener('click', ...);

    // Submit Fechar Caixa (agora no botão Salvar)
    closeCaixaForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!validateFecharCaixaStep4()) return;
        if (!validateFecharCaixaStep3()) { // Revalida passo anterior
            navigateFecharCaixaSteps(-1); // Volta se inválido
            return;
        };

        const data = {
            valorFinalNotas: (parseFloat(closeCaixaNotasInput.value) || 0).toFixed(2),
            valorFinalMoedas: (parseFloat(closeCaixaMoedasInput.value) || 0).toFixed(2),
            vendaCartao: (parseFloat(closeCaixaCartaoInput.value) || 0).toFixed(2),
            vendaPixFixo: "0.00",
            valorDeposito: (parseFloat(closeCaixaDepositoInput.value) || 0).toFixed(2),
            valorFicaCaixa: (parseFloat(closeCaixaFicaInput.value) || 0).toFixed(2),
            assinatura: closeCaixaAssinaturaInput.value.trim()
        };
        fecharCaixaAPI(data);
    });

    function updateClock() { if (horarioElement) { horarioElement.textContent = formatTime(new Date()); } }

    // Listener Global de Teclas de Atalho
    document.addEventListener('keydown', (e) => {
        const openModals = document.querySelectorAll('.modal-overlay.active');

        // Se Abrir Caixa está aberto, só permite Enter e Tab (e teclas de digitação)
        if (openCaixaModal.classList.contains('active')) {
            if (e.key === 'Escape') {
                e.preventDefault(); // Bloqueia Escape
            } else if (e.key !== 'Enter' && e.key !== 'Tab' && !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && e.target.tagName !== 'INPUT') {
                // Permite Enter (para submit), Tab e Setas (navegação), e digitação nos inputs
            } else if (e.key === 'Enter' && document.activeElement.closest('form') === openCaixaForm) {
                // Deixa o Enter submeter
            } else if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
                // Bloqueia outros atalhos se o foco não estiver num campo editável
                // e.preventDefault(); // Comentado para testar se causa o bug de digitação
            }
            return;
        }


        if (openModals.length > 0) {
            const topModal = openModals[openModals.length - 1];
            if (topModal.id === 'discount-popover' && ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Enter'].includes(e.key)) { /* ... Lógica setas desconto ... */ if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key)) { e.preventDefault(); } if (e.key === 'Enter' && document.activeElement === discountInputR) { e.preventDefault(); discountInputR.blur(); barcodeInput.focus(); return; } switch (e.key) { case 'ArrowDown': discountNavIndex = (discountNavIndex < 5) ? 5 : 0; break; case 'ArrowRight': discountNavIndex = (discountNavIndex < 4) ? discountNavIndex + 1 : (discountNavIndex === 4 ? 0 : 0); break; case 'ArrowUp': discountNavIndex = (discountNavIndex === 5) ? 0 : (discountNavIndex > 0 ? discountNavIndex - 1 : 5); break; case 'ArrowLeft': discountNavIndex = (discountNavIndex > 0 && discountNavIndex < 5) ? discountNavIndex - 1 : (discountNavIndex === 0 ? 4 : 4); break; case 'Enter': e.preventDefault(); const currentEl = discountNavElements[discountNavIndex]; if (currentEl && currentEl.tagName === 'BUTTON') currentEl.click(); break; } updateDiscountNavFocus(); return; }
            else if (topModal.id === 'payment-modal') { switch (e.key) { case 'F6': e.preventDefault(); handlePaymentSelection('Dinheiro'); break; case 'F7': e.preventDefault(); handlePaymentSelection('PIX'); break; case 'F8': e.preventDefault(); handlePaymentSelection('Cartão'); break; case 'Escape': e.preventDefault(); closeModal(paymentModal); break; } return; }
            else if (topModal.id === 'confirm-modal') { if (e.key === 'Enter') { e.preventDefault(); confirmActionBtn.click(); } if (e.key === 'Escape') { e.preventDefault(); closeModal(confirmModal); } return; }
            else if (topModal.id === 'receipt-modal') { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); newSaleBtn.click(); } return; }
            else if (topModal.id === 'alert-modal') { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); closeModal(alertModal); } return; }
            else if (topModal.id === 'quick-add-modal') { if (e.key === 'Escape') { e.preventDefault(); closeModal(quickAddModal); } return; }
            else if (topModal.id === 'add-cliente-modal') { if (e.key === 'Escape') { e.preventDefault(); closeModal(addClienteModal); resetClienteModal(); } return; }
            else if (topModal.id === 'close-caixa-modal') {
                if (e.key === 'Escape') { e.preventDefault(); closeModal(closeCaixaModal); resetFecharCaixaModal(); }
                else if (e.key === 'Enter') {
                    if (closeCaixaNextBtn.style.display !== 'none') {
                        e.preventDefault(); closeCaixaNextBtn.click();
                    } else if (closeCaixaSaveBtn.style.display !== 'none' && document.activeElement !== closeCaixaAssinaturaInput) {
                        e.preventDefault(); // Submete o form via JS para garantir validação
                        closeCaixaForm.dispatchEvent(new Event('submit', { cancelable: true }));
                    }
                }
                return;
            }
        } else if (openModals.length === 0) {
            switch (e.key) {
                case 'F2': e.preventDefault(); barcodeInput.focus(); barcodeInput.select(); break;
                case 'F3': e.preventDefault(); discountToggleRow.click(); discountNavIndex = 0; updateDiscountNavFocus(); break;
                case 'F4': e.preventDefault(); paymentToggleRow.click(); break;
                case 'F8':
                    e.preventDefault();
                    if (verificarToken()) {
                        resetFecharCaixaModal();
                        openModal(closeCaixaModal);
                    } else {
                        showCustomAlert("Atenção", "Caixa precisa estar aberto.");
                    }
                    break;
                case 'F9': e.preventDefault(); finishSaleBtn.click(); break;
                case 'F10': e.preventDefault(); cancelSaleBtn.click(); break;
            }
        }
    });

    // --- Inicialização ---
    renderCart(); resetPaymentMethod();
    updateClock(); setInterval(updateClock, 1000);

    // Lógica de Inicialização com Token
    if (verificarToken()) {
        console.log("Iniciando com token válido.");
        liberarSistema();
    } else {
        console.log("Iniciando sem token. Abrindo caixa...");
        loadingOverlay.classList.add('hidden');
        openCaixaForm.reset();
        openCaixaSemValorCheckbox.checked = false;
        openCaixaNotasInput.disabled = false;
        openCaixaMoedasInput.disabled = false;
        openModal(openCaixaModal);
    }

    // Define a aba ativa inicial e ajusta o highlight
    const initialActivePage = 'pdv';

    // Primeiro tenta encontrar pelo data-page, senão pega o que já tem active no HTML
    let initialActiveNavbarItem = document.querySelector(`.navbar-item[data-page="${initialActivePage}"]`);
    if (!initialActiveNavbarItem) {
        initialActiveNavbarItem = document.querySelector('.navbar-item.active');
    }

    if (initialActiveNavbarItem) {
        // Garante que só o PDV está ativo
        navbarItems.forEach(item => item.classList.remove('active'));
        initialActiveNavbarItem.classList.add('active');

        // Aguarda fontes carregarem e DOM estar pronto
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => {
                setTimeout(() => {
                    updateNavbarHighlight(initialActiveNavbarItem);
                }, 50);
            });
        } else {
            // Fallback para navegadores sem suporte a document.fonts
            setTimeout(() => {
                updateNavbarHighlight(initialActiveNavbarItem);
            }, 200);
        }

        if (verificarToken()) {
            allPages.forEach(page => page.style.display = 'none');
            document.getElementById(initialActivePage + '-page').style.display = 'block';
        }
    }

    // --- Novas Variáveis Globais ---

    // --- LÓGICA DO GERENCIADOR FIREBASE ---

    // Função Auxiliar de Limpeza de Valor (igual ao seu index.js)
    function parseValueFirebase(val) {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        let str = String(val);
        str = str.replace(/[^\d,.-]/g, '');
        str = str.replace(',', '.');
        return parseFloat(str) || 0;
    }

    let currentSelectedClientId = null;

    // --- Seletores dos Novos Modais ---
    const clienteDetailsModal = document.getElementById('cliente-details-modal');
    const clientePayModal = document.getElementById('cliente-pay-modal');
    const clientePayForm = document.getElementById('cliente-pay-form');

    // --- Seletores da Barra de Limite ---
    const detailLimitTotal = document.getElementById('detail-cliente-limite-total');
    const detailProgressBar = document.getElementById('detail-cliente-progress');
    const detailLimitAvailable = document.getElementById('detail-cliente-disponivel');
    const detailLimitPercent = document.getElementById('detail-cliente-percentual');
    const btnAlterarLimite = document.getElementById('btn-alterar-limite');

    const openClienteDetails = async (id) => {
        const cliente = localClientCache.find(c => c.idCliente == id);
        if (!cliente) return;

        // 1. Preenchimento de Cabeçalho e Dados Básicos
        document.getElementById('detail-cliente-nome').textContent = cliente.nomeCompleto || cliente.nomeExibicao;
        // Remove os parênteses do apelido conforme solicitado
        document.getElementById('detail-cliente-apelido').textContent = cliente.apelido ? cliente.apelido : '';

        const saldoEl = document.getElementById('detail-cliente-saldo');
        saldoEl.textContent = formatCurrency(cliente.saldoDevedor);
        // User requested black color for debt value instead of red
        saldoEl.style.color = 'var(--text-dark)';

        // 2. Cálculo de Data e Diferença de Dias (Proteção contra erro getMonth)
        const dataObj = parseDataSegura(cliente.proximoVencimento);
        let diffDays = 0;
        let textoVencimento = "Sem vencimento";
        const vencimentoEl = document.getElementById('detail-cliente-vencimento');

        if (dataObj && !isNaN(dataObj.getTime())) {
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            const dataVenc = new Date(dataObj);
            dataVenc.setHours(0, 0, 0, 0);

            // Calcula a diferença real de dias para os alertas visuais
            const diffTime = dataVenc - hoje;
            diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            const dia = String(dataObj.getDate()).padStart(2, '0');
            const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
            const ano = dataObj.getFullYear();
            textoVencimento = `${dia}/${mes}/${ano}`;

            // Alerta visual de atraso (Texto removido conforme solicitado, mantem cor se desejado ou remove tb)
            if (diffDays < 0 && cliente.saldoDevedor > 0.01) {
                vencimentoEl.style.color = 'var(--warning-red)';
                // textoVencimento += " (Atrasado)"; // REMOVIDO
            } else {
                vencimentoEl.style.color = 'var(--text-dark)';
            }
        }
        vencimentoEl.textContent = textoVencimento;

        // [NOVO] Cards de Parcelas (Prioriza dados do Backend)
        const qtdParcelasEl = document.getElementById('detail-cliente-qtd-parcelas');
        const valorParcelaEl = document.getElementById('detail-cliente-valor-parcela-mensal');

        let qtdRestante = 0;
        let valorMensal = 0;

        // Se o Backend já mandou calculado, usa. Senão, calcula fallback.
        if (cliente.parcelasRestantes !== undefined) {
            qtdRestante = parseInt(cliente.parcelasRestantes) || 0;
        } else {
            const totalP = parseInt(cliente.parcelasTotais) || 0;
            const pagasP = parseInt(cliente.parcelasPagas) || 0;
            qtdRestante = totalP - pagasP;
        }

        if (cliente.valorParcela !== undefined && parseFloat(cliente.valorParcela) > 0) {
            valorMensal = parseFloat(cliente.valorParcela);
        } else if (qtdRestante > 0 && cliente.saldoDevedor > 0) {
            valorMensal = cliente.saldoDevedor / qtdRestante;
        }

        if (qtdParcelasEl) qtdParcelasEl.textContent = qtdRestante > 0 ? `${qtdRestante}x` : "-";
        if (valorParcelaEl) valorParcelaEl.textContent = valorMensal > 0 ? formatCurrency(valorMensal) : "-";


        document.getElementById('detail-cliente-telefone').textContent = cliente.telefone || 'Não informado';
        document.getElementById('detail-cliente-endereco').textContent = cliente.endereco || 'Não informado';

        // 3. Lógica da Barra de Limite
        const limite = parseFloat(cliente.limite) || 0;
        const saldo = parseFloat(cliente.saldoDevedor) || 0;
        const detailLimitTotal = document.getElementById('detail-cliente-limite-total');
        const detailProgressBar = document.getElementById('detail-cliente-progress');
        const detailLimitAvailable = document.getElementById('detail-cliente-disponivel');
        const detailLimitPercent = document.getElementById('detail-cliente-percentual');

        if (detailLimitTotal) detailLimitTotal.textContent = formatCurrency(limite);

        if (limite > 0) {
            const disponivel = limite - saldo;
            let percentualUso = (saldo / limite) * 100;
            let visualWidth = percentualUso > 100 ? 100 : (percentualUso < 0 ? 0 : percentualUso);

            if (detailLimitAvailable) detailLimitAvailable.textContent = `Disponível: ${formatCurrency(disponivel)}`;
            if (detailLimitPercent) detailLimitPercent.textContent = `${percentualUso.toFixed(1)}% usado`;
            if (detailProgressBar) {
                detailProgressBar.style.width = `${visualWidth}%`;
                detailProgressBar.className = 'progress-fill';
                if (disponivel < 0) {
                    detailProgressBar.classList.add('danger');
                    detailLimitAvailable.style.color = 'var(--warning-red)';
                } else if (percentualUso > 80) {
                    detailProgressBar.classList.add('warning');
                }
            }
        } else {
            if (detailProgressBar) detailProgressBar.style.width = '0%';
            if (detailLimitAvailable) detailLimitAvailable.textContent = "Sem limite definido";
            if (detailLimitPercent) detailLimitPercent.textContent = "-";
        }

        // Reset Menu Dropdown
        const menu = document.getElementById('client-options-dropdown');
        if (menu) {
            menu.classList.remove('active'); // Usa classe agora
            menu.style.display = ''; // Limpa inline style se houver
        }

        // Reset QR Code Container
        const qrContainer = document.getElementById('qrcode-container');
        if (qrContainer) qrContainer.classList.remove('active');

        // Guardar ID atual para ações do menu
        document.getElementById('cliente-details-modal').setAttribute('data-current-client-id', id);
        document.getElementById('cliente-details-modal').setAttribute('data-cliente-nome', cliente.nomeCompleto || cliente.nomeExibicao);

        // Exibe o modal
        openModal(document.getElementById('cliente-details-modal'));

        // 4. Carregar Histórico...
        const historyContainer = document.getElementById('detail-history-container');
        historyContainer.innerHTML = '<p style="text-align:center; padding:20px;"><i class="bx bx-loader-alt bx-spin"></i> Carregando extrato...</p>';

        try {
            const response = await fetch(`${SCRIPT_URL}?action=obterHistorico&idCliente=${id}`);
            const result = await response.json();

            if (result.status === 'success' && result.data.length > 0) {
                let html = '<table class="history-table"><thead><tr><th>Data</th><th>Tipo</th><th>Valor</th><th>Doc</th></tr></thead><tbody>';

                result.data.forEach(item => {
                    const tipoLower = String(item.tipo).toLowerCase();
                    const obsLower = String(item.obs || "").toLowerCase();

                    // Lógica visual da tabela
                    let tipoTexto = 'PAGTO';
                    let tipoClass = 'type-pagamento';
                    let valorColor = 'var(--success-green)';

                    if (tipoLower.includes('compra')) {
                        tipoTexto = 'COMPRA';
                        tipoClass = 'type-compra';
                        valorColor = 'var(--warning-red)';
                    } else if (tipoLower.includes('renegiciação (baixa)') || tipoLower.includes('renegociação (baixa)')) {
                        tipoTexto = 'RENEG. BAIXA';
                        tipoClass = 'type-reneg-baixa';
                        valorColor = '#2196F3';
                    } else if (tipoLower.includes('renegociação (nova)')) {
                        tipoTexto = 'RENEG. NOVA';
                        tipoClass = 'type-reneg-nova';
                        valorColor = 'var(--warning-red)';
                    }

                    let anexoHtml = '-';
                    if (item.anexo && item.anexo.startsWith('http')) {
                        anexoHtml = `<button class="btn-link-receipt" onclick="window.open('${item.anexo}', '_blank')"><i class='bx bx-show'></i></button>`;
                    }

                    html += `<tr>
                    <td>${item.data}<br><small style="color:#999">${item.obs || ''}</small></td>
                    <td><span class="history-type-tag ${tipoClass}">${tipoTexto}</span></td>
                    <td style="color:${valorColor}; font-weight:600;">${formatCurrency(Math.abs(item.valor))}</td>
                    <td>${anexoHtml}</td>
                </tr>`;
                });

                html += '</tbody></table>';
                historyContainer.innerHTML = html;

            } else {
                historyContainer.innerHTML = '<p class="text-center text-light pad-20">Nenhum histórico recente encontrado.</p>';
            }
        } catch (e) {
            console.error("Erro histórico", e);
            historyContainer.innerHTML = '<p class="text-center text-danger">Erro ao carregar histórico.</p>';
        }
    };

    // --- NOVA LÓGICA DO MENU DE OPÇÕES DO CLIENTE ---

    // Toggle Menu
    const btnOptions = document.getElementById('btn-client-options');
    const menuDropdown = document.getElementById('client-options-dropdown');

    if (btnOptions && menuDropdown) {
        btnOptions.addEventListener('click', (e) => {
            e.stopPropagation();
            menuDropdown.classList.toggle('active'); // Usa classe
        });

        // Fechar ao clicar fora
        document.addEventListener('click', () => {
            menuDropdown.classList.remove('active');
        });
    }

    // Ações do Menu
    const dropdownItems = document.querySelectorAll('.dropdown-item');
    dropdownItems.forEach(item => {
        // Hover effect for restricted items (Padlock Icon)
        if (item.classList.contains('restricted')) {
            const icon = item.querySelector('i');
            const originalIconClass = icon ? icon.className : '';

            item.addEventListener('mouseenter', () => {
                if (icon) icon.className = 'bx bx-lock-alt';
            });

            item.addEventListener('mouseleave', () => {
                if (icon) icon.className = originalIconClass;
            });
        }

        item.addEventListener('click', (e) => {
            const action = item.getAttribute('data-action');
            const modalDetails = document.getElementById('cliente-details-modal');
            const nomeCliente = modalDetails.getAttribute('data-cliente-nome');
            const idCliente = modalDetails.getAttribute('data-current-client-id');
            const menu = document.getElementById('client-options-dropdown');

            if (menu) menu.classList.remove('active'); // Fecha menu ao clicar

            if (!nomeCliente) return;

            if (action === 'dados') {
                // Ação sem senha - Abre Modal de Edição
                const modalEdit = document.getElementById('modal-edit-client-data');
                const telefoneAtual = document.getElementById('detail-cliente-telefone').innerText;
                const enderecoAtual = document.getElementById('detail-cliente-endereco').innerText;

                // Preenche campos
                document.getElementById('input-edit-telefone').value = telefoneAtual !== '--' ? telefoneAtual : '';
                document.getElementById('input-edit-endereco').value = enderecoAtual !== '--' ? enderecoAtual : '';

                // Abre Modal
                openModal(modalEdit);

                // Configura botão de salvar (Remove listeners antigos para evitar duplicação)
                const btnSave = document.getElementById('btn-save-client-data');
                const newBtnSave = btnSave.cloneNode(true);
                btnSave.parentNode.replaceChild(newBtnSave, btnSave);

                newBtnSave.addEventListener('click', async () => {
                    const novoTelefone = document.getElementById('input-edit-telefone').value.trim();
                    const novoEndereco = document.getElementById('input-edit-endereco').value.trim();

                    if (!novoTelefone && !novoEndereco) {
                        showCustomAlert("Atenção", "Preencha ao menos um campo.");
                        return;
                    }

                    // Feedback visual
                    const originalText = newBtnSave.innerText;
                    newBtnSave.disabled = true;
                    newBtnSave.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Salvando...";

                    try {
                        const payload = {
                            action: "updateClientData",
                            data: {
                                idCliente: idCliente,
                                telefone: novoTelefone,
                                endereco: novoEndereco
                            }
                        };

                        const options = {
                            method: 'POST',
                            body: JSON.stringify(payload)
                        };

                        const response = await fetch(SCRIPT_URL, options);
                        const result = await response.json();

                        if (result.status === 'success') {
                            showCustomAlert("Sucesso", "Dados atualizados!");

                            // Atualiza a tela de detalhes instantaneamente
                            document.getElementById('detail-cliente-telefone').innerText = novoTelefone || '--';
                            document.getElementById('detail-cliente-endereco').innerText = novoEndereco || '--';

                            // Recarrega lista de clientes no fundo para manter cache atualizado
                            // renderClientesPage(); // Opcional, se quiser forçar refresh total

                            closeModal(modalEdit);
                        } else {
                            throw new Error(result.message || "Erro desconhecido.");
                        }

                    } catch (err) {
                        console.error(err);
                        showCustomAlert("Erro", "Falha ao salvar dados: " + err.message);
                    } finally {
                        newBtnSave.disabled = false;
                        newBtnSave.innerText = originalText;
                    }
                });
                return;
            }

            if (action === 'renegociar') {
                solicitarAcessoAdm(function () {
                    const modalReneg = document.getElementById('modal-renegociar');
                    modalReneg.setAttribute('data-cliente-nome', nomeCliente);
                    // Preenche dados atuais
                    const saldoEl = document.getElementById('detail-cliente-saldo');
                    const vencEl = document.getElementById('detail-cliente-vencimento');
                    if (modalReneg) {
                        document.getElementById('reneg-saldo-atual').innerText = saldoEl ? saldoEl.innerText : "R$ 0,00";
                        document.getElementById('reneg-vencimento-atual').value = vencEl ? vencEl.innerText : "";
                        modalReneg.style.display = 'flex';
                        modalReneg.classList.add('active');
                    }
                });
            }
            else if (action === 'manual_venc') {
                solicitarAcessoAdm(function () {
                    const modalDate = document.getElementById('modal-alterar-vencimento');
                    modalDate.setAttribute('data-cliente-nome', nomeCliente);
                    // Tenta preencher data atual
                    const vencEl = document.getElementById('detail-cliente-vencimento');
                    if (vencEl) {
                        const partes = vencEl.innerText.trim().split('/'); // dd/mm/yyyy
                        if (partes.length === 3) {
                            // html input date espera yyyy-mm-dd
                            try { document.getElementById('input-novo-vencimento').value = `${partes[2]}-${partes[1]}-${partes[0]}`; } catch (e) { }
                        }
                    }
                    modalDate.style.display = 'flex';
                    modalDate.classList.add('active');
                });
            }
            else if (action === 'limite') {
                solicitarAcessoAdm(function () {
                    const novoLimite = prompt(`Digite o novo limite para ${nomeCliente} (apenas números):`);
                    if (novoLimite) {
                        const btn = item; // Referência visual se precisasse
                        // ... Logica de API ...
                        fetch(`${SCRIPT_URL}?action=alterarLimite&idCliente=${encodeURIComponent(idCliente)}&novoLimite=${novoLimite}`)
                            .then(r => r.json())
                            .then(res => {
                                if (res.status === 'success') {
                                    alert("Limite atualizado com sucesso!");
                                    // Recarrega
                                    openClienteDetails(idCliente);
                                } else {
                                    alert("Erro: " + res.message);
                                }
                            })
                            .catch(err => alert("Erro comunicacao: " + err.message));
                    }
                });
            }
            else if (action === 'acesso') {
                solicitarAcessoAdm(function () {
                    const nomeParam = nomeCliente.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
                    const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/')) + "/meuacesso.html";
                    const linkCompleto = `${baseUrl}?q=${nomeParam}`; // Usando nome simplificado para query

                    const qrContainer = document.getElementById('qrcode-container');
                    const qrCanvas = document.getElementById('qrcode-canvas');
                    const linkText = document.getElementById('link-acesso-text');

                    if (qrContainer && qrCanvas && linkText) {
                        qrCanvas.innerHTML = ""; // Limpa anterior
                        new QRCode(qrCanvas, { text: linkCompleto, width: 180, height: 180 });

                        linkText.innerHTML = `<i class='bx bx-link-external'></i> ${linkCompleto}`;
                        linkText.onclick = () => window.open(linkCompleto, '_blank');

                        qrContainer.classList.add('active'); // Exibe com animação
                        qrContainer.style.display = 'flex'; // Garante display flex
                    }
                });
            }
        });
    });

    // --- Lógica de Abrir Modal de Pagamento ---
    const openClientePayment = (id) => {
        const cliente = localClientCache.find(c => c.idCliente == id);

        currentSelectedClientId = id;

        // Preenche info básica
        document.getElementById('pay-cliente-nome').textContent = cliente.nomeExibicao;
        document.getElementById('pay-cliente-saldo-atual').textContent = formatCurrency(cliente.saldoDevedor);

        // Reseta form e foca no valor
        clientePayForm.reset();
        openModal(clientePayModal);
    };

    // --- Função Atualizada: Fluxo de Caixa + Abatimento de Dívida ---
    async function registrarPagamentoClienteAPI(cliente, valor, metodo) {
        // Validação das URLs
        if (!REGISTRO_VENDA_SCRIPT_URL || REGISTRO_VENDA_SCRIPT_URL.includes("COLE_A_URL")) {
            throw new Error("URL de registro de vendas não configurada.");
        }
        if (!SCRIPT_URL || SCRIPT_URL.includes("COLE_A_URL")) {
            throw new Error("URL de script de clientes não configurada.");
        }

        const now = new Date();
        const timestamp = formatTimestamp(now);
        const descricaoAutomatica = `Crediário ${cliente.nomeExibicao}`;

        // --- PREPARAÇÃO REQUISIÇÃO 1: FLUXO DE CAIXA (Vendas) ---
        const vendaData = {
            formType: 'venda',
            seller: 'nubia',
            type: 'entrada',
            value: valor.toFixed(2), // Valor Positivo (Entrou dinheiro)
            desconto: '0.00',
            Timestamp: timestamp,
            payment: metodo,
            total: valor.toFixed(2),
            description: descricaoAutomatica,
            obs: `Recebimento ID: ${cliente.idCliente}`
        };
        const formVenda = new URLSearchParams(vendaData);

        // --- PREPARAÇÃO REQUISIÇÃO 2: ABATIMENTO DÍVIDA (Clientes) ---
        // Envia valor negativo para reduzir o saldo devedor na planilha
        const valorAbatimento = (valor * -1).toFixed(2);

        const paramsCliente = new URLSearchParams({
            action: 'registrarTransacao', // Nome da ação que seu Google Script deve esperar
            idCliente: cliente.idCliente,
            tipo: 'Pagamento',
            valor: valorAbatimento,       // Ex: -50.00
            timestamp: timestamp
        });

        console.log("Processando Pagamento Duplo...");

        // --- DISPARO SIMULTÂNEO (Promise.all) ---
        // Dispara as duas requisições ao mesmo tempo para ser mais rápido
        const [resVenda, resCliente] = await Promise.all([
            // 1. Post no Fluxo de Caixa
            fetch(REGISTRO_VENDA_SCRIPT_URL, {
                redirect: "follow",
                method: "POST",
                body: formVenda.toString(),
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
            }),
            // 2. Get no Script de Clientes (seguindo o padrão de salvarCliente)
            fetch(`${SCRIPT_URL}?${paramsCliente.toString()}`, {
                method: 'GET'
            })
        ]);

        // Verificação de Erros
        if (!resVenda.ok) {
            throw new Error(`Erro no Registro de Venda: ${resVenda.status}`);
        }
        if (!resCliente.ok) {
            // Tentamos ler o erro se possível
            throw new Error(`Erro no Abatimento da Dívida: ${resCliente.status}`);
        }

        // Opcional: Ler a resposta do cliente para garantir que o script processou "success"
        const resultCliente = await resCliente.json();
        if (resultCliente.status !== 'success') {
            console.warn("Aviso do Script Cliente:", resultCliente.message);
            // Não vamos jogar erro aqui se a venda passou, apenas logar o aviso
        }

        return true;
    }

    // --- Listener Otimizado do Submit de Pagamento ---
    clientePayForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const valorInput = document.getElementById('pay-valor');
        const valorPago = parseFloat(valorInput.value);
        const metodo = document.getElementById('pay-metodo').value;
        const submitBtn = clientePayForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;

        if (!currentSelectedClientId) return;
        if (isNaN(valorPago) || valorPago <= 0) {
            showCustomAlert("Valor Inválido", "Insira um valor maior que zero.");
            return;
        }

        // Encontrar o cliente no cache local
        const cliente = localClientCache.find(c => c.idCliente == currentSelectedClientId);
        if (!cliente) {
            showCustomAlert("Erro", "Cliente não encontrado no cache.");
            return;
        }

        // 1. Estado de Carregamento (Bloqueia botão)
        submitBtn.disabled = true;
        submitBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Processando...";

        try {
            // 2. Envia para o Google Sheets
            await registrarPagamentoClienteAPI(cliente, valorPago, metodo);

            // 3. Atualiza o Cache Local (Otimismo)
            // Subtrai o valor pago do saldo devedor visualmente
            let novoSaldo = parseFloat(cliente.saldoDevedor) - valorPago;
            cliente.saldoDevedor = novoSaldo < 0 ? 0 : novoSaldo; // Evita negativo se pagar a mais

            // 4. Atualiza a Tabela e Fecha Modal
            renderClientesPage(); // Re-renderiza a lista com o novo saldo
            closeModal(clientePayModal);
            showCustomAlert("Sucesso", `Pagamento de ${formatCurrency(valorPago)} registrado para ${cliente.nomeExibicao}!`);

        } catch (error) {
            console.error("Erro ao registrar pagamento:", error);
            showCustomAlert("Erro", "Falha ao registrar o pagamento. Tente novamente.");
        } finally {
            // 5. Restaura o botão
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    });


    // ============================================================
    // FUNÇÕES DO MODAL DE PEDIDOS (Adicionar no final do DOMContentLoaded)
    // ============================================================

    let currentOpenOrder = null; // Variável local para saber qual pedido está aberto

    // 1. Função para Abrir o Modal (Lógica de Navegação Corrigida)
    // 1. Função para Abrir o Modal (ATUALIZADA COM STATUS DE RETIRADA)
    // 1. Função para Abrir o Modal (ATUALIZADA COM TAG DE ENTREGA)
    window.openOrderDetailModal = (orderId) => {
        const order = activeOrdersData.find(o => o.id === orderId);
        if (!order) return;

        currentOpenOrder = order;

        document.getElementById('modal-order-id').textContent = `#${order.displayId}`;
        document.getElementById('modal-order-client').textContent = order.client;

        // --- DETALHE DA ENTREGA (NOVO) ---
        let deliveryTag = '';

        if (order.shippingMode === 'pickup') {
            // Se for retirada, a string order.address já diz "Coleta na loja..."
            // Adicionamos uma tag azul para reforçar
            deliveryTag = `<span style="display:inline-block; margin-top:4px; font-size:0.75rem; background:#e3f2fd; color:#0d47a1; padding:2px 8px; border-radius:4px; font-weight:600;">RETIRADA NA LOJA</span>`;
        } else {
            // Se for entrega, adicionamos a tag verde "Receber em Casa"
            deliveryTag = `<span style="display:inline-block; margin-top:4px; font-size:0.75rem; background:#e6fffa; color:#00695c; padding:2px 8px; border-radius:4px; font-weight:600;">ENTREGA EM CASA</span>`;
        }

        // Injeta o endereço (com ícone) + a tag nova logo abaixo
        document.getElementById('modal-order-address').innerHTML = `
                ${order.address}<br>${deliveryTag}
            `;
        // --------------------------------

        document.getElementById('modal-calc-total').textContent = order.total;
        document.getElementById('modal-payment-method').textContent = "Pagamento: " + order.paymentMethod;

        // Lista de Itens
        const itemsContainer = document.getElementById('modal-order-items-list');
        itemsContainer.innerHTML = '';
        const divItem = document.createElement('div');
        divItem.className = 'modal-order-item';
        divItem.innerHTML = `<span class="item-info-text">${order.items}</span>`;
        itemsContainer.appendChild(divItem);

        // Stepper (Lógica Visual)
        const steps = ['pendente', 'preparando', 'enviado', 'finalizado'];
        let currentStatus = order.status.toLowerCase();
        if (currentStatus === 'approved') currentStatus = 'pendente';
        if (currentStatus === 'preparation') currentStatus = 'preparando';
        if (currentStatus === 'shipped') currentStatus = 'enviado';
        if (currentStatus === 'delivered') currentStatus = 'finalizado';

        // Ajuste de Texto do Stepper para Retirada
        const stepEnviado = document.getElementById('step-enviado');
        const stepFinalizado = document.getElementById('step-finalizado');

        if (order.shippingMode === 'pickup') {
            if (stepEnviado) {
                stepEnviado.querySelector('span').textContent = "Pronto p/ Retirada";
                stepEnviado.querySelector('.step-icon').innerHTML = "<i class='bx bxs-store'></i>";
            }
            if (stepFinalizado) stepFinalizado.querySelector('span').textContent = "Retirado";
        } else {
            if (stepEnviado) {
                stepEnviado.querySelector('span').textContent = "Enviado";
                stepEnviado.querySelector('.step-icon').innerHTML = "<i class='bx bx-car'></i>";
            }
            if (stepFinalizado) stepFinalizado.querySelector('span').textContent = "Entregue";
        }

        const currentIndex = steps.indexOf(currentStatus);

        steps.forEach((stepName, index) => {
            const el = document.getElementById(`step-${stepName}`);
            if (el) {
                el.classList.remove('active', 'completed', 'locked');
                el.onclick = null;

                if (index < currentIndex) {
                    el.classList.add('completed');
                    el.onclick = () => manualSetStatus(stepName);
                } else if (index === currentIndex) {
                    el.classList.add('active');
                    el.style.cursor = 'default';
                } else {
                    el.classList.add('locked');
                }
            }
        });

        openModal(document.getElementById('order-details-modal'));
    };

    // 2. Função para Mudar Status Manualmente
    window.manualSetStatus = async (targetUiStatus) => {
        if (!currentOpenOrder) return;

        // Mapeamento Inverso
        const mapStatusUIToFirebase = (uiStatus) => {
            if (uiStatus === 'pendente') return 'approved';
            if (uiStatus === 'preparando') return 'preparation';
            if (uiStatus === 'enviado') return 'shipped';
            if (uiStatus === 'finalizado') return 'delivered';
            return uiStatus; // Fallback
        };

        const newFbStatus = mapStatusUIToFirebase(targetUiStatus);
        const btn = document.getElementById('btn-update-status');
        const originalText = btn.innerHTML;

        // Verifica se clicou no status que já está
        if (currentOpenOrder.status === targetUiStatus) return;

        btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Atualizando...";
        btn.disabled = true;

        try {
            // Atualiza APENAS o status para evitar sobrescrever outros dados
            await db.collection('orders').doc(currentOpenOrder.id).update({
                status: newFbStatus,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp() // Usa timestamp do servidor
            });

            // Atualiza visualmente o objeto local para refletir na hora sem esperar o listener
            currentOpenOrder.status = targetUiStatus;

            // Recarrega o visual do modal para pintar as bolinhas certas
            window.openOrderDetailModal(currentOpenOrder.id);

            // O listener global (startOrderPolling) vai atualizar a lista de trás automaticamente

        } catch (error) {
            console.error("Erro status:", error);
            // Se der erro de cota, avisa amigavelmente
            if (error.code === 'resource-exhausted') {
                showCustomAlert("Erro de Cota", "Muitas atualizações recentes. Aguarde um momento.");
            } else {
                showCustomAlert("Erro", "Falha ao atualizar status.");
            }
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    };
    // 3. Botão "Avançar Status" (Lógica sequencial)
    const btnUpdateStatus = document.getElementById('btn-update-status');
    if (btnUpdateStatus) {
        btnUpdateStatus.onclick = () => {
            if (!currentOpenOrder) return;
            const steps = ['pendente', 'preparando', 'enviado', 'finalizado'];
            const currentIndex = steps.indexOf(currentOpenOrder.status);

            if (currentIndex < steps.length - 1) {
                const nextStatus = steps[currentIndex + 1];
                window.manualSetStatus(nextStatus);
            } else {
                alert("Pedido já finalizado.");
            }
        };
    }


    // --- CORREÇÃO DA BARRA DE PESQUISA (Crediário) ---
    const searchInputClientes = document.getElementById('clientes-page-search');

    if (searchInputClientes) {
        // O evento 'input' detecta cada letra digitada ou apagada
        searchInputClientes.addEventListener('input', () => {
            renderClientesPage();
        });
    }


    // Botão "Voltar" dentro das opções de crediário (volta para escolher PIX, Dinheiro, etc)
    const btnBackToPayment = document.getElementById('back-to-payment-methods');
    if (btnBackToPayment) {
        btnBackToPayment.addEventListener('click', () => {
            document.getElementById('crediario-options').style.display = 'none';
            document.getElementById('single-payment-options').style.display = 'grid';
            document.getElementById('split-payment-toggle-btn').style.display = 'block';
        });
    }

    // Botão "Alterar" (ícone pequeno ao lado do nome do cliente na tela de parcelas)
    const btnChangeCredClient = document.getElementById('btn-change-cred-client');
    if (btnChangeCredClient) {
        btnChangeCredClient.addEventListener('click', () => {
            isReturningToPayment = true; // Marca para voltar pra cá
            closeModal(paymentModal);
            openModal(clientSelectionModal);
        });
    }

    // --- LÓGICA DE CÁLCULO DE LUCRO (Adicionar no script.js) ---
    const inputCusto = document.getElementById('edit-prod-cost');
    const inputVenda = document.getElementById('edit-prod-price');

    const realizarCalculos = () => {
        const custo = parseFloat(inputCusto.value) || 0;
        const venda = parseFloat(inputVenda.value) || 0;

        const lucro = venda - custo;

        // Cálculo da Margem (Lucro / Venda)
        let margem = 0;
        if (venda > 0) margem = (lucro / venda) * 100;

        // Cálculo do Markup (Venda / Custo) - ou (Lucro / Custo), depende da sua regra.
        // Geralmente Markup é um índice multiplicador sobre o custo.
        let markup = 0;
        if (custo > 0) markup = ((venda - custo) / custo) * 100;

        // Atualiza na tela
        document.getElementById('calc-profit').textContent = formatCurrency(lucro);
        document.getElementById('calc-margin').textContent = margem.toFixed(1) + '%';
        document.getElementById('calc-markup').textContent = markup.toFixed(1) + '%';

        // Cores
        const profitEl = document.getElementById('calc-profit');
        if (lucro > 0) profitEl.style.color = 'var(--success-green)';
        else if (lucro < 0) profitEl.style.color = 'var(--warning-red)';
        else profitEl.style.color = '#666';
    };

    // Adiciona os ouvintes de evento para calcular enquanto digita
    if (inputCusto && inputVenda) {
        inputCusto.addEventListener('input', realizarCalculos);
        inputVenda.addEventListener('input', realizarCalculos);
    }

    // --- Listener de Cliques na Tabela do Carrinho ---
    cartItemsBody.addEventListener('click', (e) => {
        // Pega o botão mais próximo (para funcionar mesmo clicando no ícone <i>)
        const button = e.target.closest('button');
        if (!button) return;

        const { action, id } = button.dataset;

        // Se for botão de Quantidade (+ ou -)
        if (action === 'increase' || action === 'decrease') {
            // Garante que o ID seja string para encontrar no array
            const item = cart.find(i => String(i.id) === String(id));
            if (item) updateQuantity(item.id, action);
        }
        // Se for botão de Lixeira
        else if (button.classList.contains('remove-btn')) {
            showCustomConfirm("Remover Item", "Tem certeza?", () => {
                // Converte ID para garantir que remova o item certo
                const idParaRemover = cart.find(i => String(i.id) === String(id))?.id;
                if (idParaRemover) removeFromCart(idParaRemover);

                closeModal(confirmModal);
            });
        }
    });

    function runFiscalSanityCheck() {
        if (!localProductCache || localProductCache.length === 0) {
            console.error("❌ Cache de produtos vazio.");
            return null;
        }

        const comNcm = localProductCache.filter(prod => prod.ncm && String(prod.ncm).trim() !== "");

        const prontosParaEmissao = comNcm.filter(prod => {
            const ncmValido = String(prod.ncm).trim().length === 8;
            const temCfop = prod.cfop && String(prod.cfop).trim() !== "";
            const temNome = prod.nome || prod.name;
            const temUnidade = prod.unidade || prod.unit;
            return ncmValido && temCfop && temNome && temUnidade;
        });

        const resultado = {
            stats: {
                totalSistema: localProductCache.length,
                totalComNcm: comNcm.length,
                totalProntos: prontosParaEmissao.length,
                totalComErro: comNcm.length - prontosParaEmissao.length
            },
            listas: { prontos: prontosParaEmissao }
        };

        console.log("%c📊 RELATÓRIO DE SAÚDE FISCAL (v7.5.0)", "color: white; background: #222; padding: 5px; border-radius: 3px;");
        console.table(resultado.stats);

        if (resultado.listas.prontos.length > 0) {
            console.log("%c🚀 DADOS FISCAIS PARA TESTE (Simulação itensAptos):", "color: #00ff00; font-weight: bold;");

            // Mapeia EXATAMENTE o que vai para o backend no processFinalSale
            const payloadSimulado = resultado.listas.prontos.slice(0, 3).map(item => {
                const ncmLimpo = (item.ncm || "").toString().replace(/\D/g, '');
                return {
                    id: item.id || item.codigo,
                    name: item.name || item.nome,
                    price: Number(item.price || item.preco),
                    quantity: 1, // Simulação de 1 unidade
                    ncm: ncmLimpo,
                    cfop: item.cfop,
                    unit: item.unit || item.unidade || 'UN',
                    csosn: item.csosn || '102',
                    origem: item.origem || '0'
                };
            });
            console.table(payloadSimulado);
        }
        return resultado;
    }

    // --- LÓGICA DE NAVEGAÇÃO ENTRE ABAS (EMITIDAS / PENDENTES) ---
    // Usamos "event delegation" para funcionar sempre, mesmo que o HTML mude

    document.addEventListener('click', function (e) {
        // 1. Verifica se o clique foi em uma aba dentro de #notas-tabs
        const tabClicada = e.target.closest('#notas-tabs .order-tab');

        // Se não clicou na aba, não faz nada
        if (!tabClicada) return;

        // 2. Remove a classe 'active' de todas as abas irmãs
        const container = tabClicada.parentElement;
        const todasAbas = container.querySelectorAll('.order-tab');
        todasAbas.forEach(t => t.classList.remove('active'));

        // 3. Adiciona 'active' na que foi clicada
        tabClicada.classList.add('active');

        // 4. Troca a visualização (Mostra/Esconde as tabelas)
        const viewAlvo = tabClicada.getAttribute('data-view');
        const viewEmitidas = document.getElementById('view-notas-emitidas');
        const viewPendentes = document.getElementById('view-notas-pendentes');

        if (viewEmitidas && viewPendentes) {
            if (viewAlvo === 'emitidas') {
                viewEmitidas.style.display = 'block';
                viewPendentes.style.display = 'none';
            } else if (viewAlvo === 'pendentes') {
                viewEmitidas.style.display = 'none';
                viewPendentes.style.display = 'block';
            }
        }
    });

    /* ======================================== */
    /* == ADVANCED SEARCH LOGIC              == */
    /* ======================================== */

    // Utility Debounce Function
    // Utility Debounce Function (Local to avoid conflicts)
    function debounceLocal(func, wait) {
        let timeout;
        return function (...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }

    const searchModal = document.getElementById('adv-search-modal');
    const searchInputAdv = document.getElementById('adv-search-input');
    const searchResultsGrid = document.getElementById('adv-search-results');
    const btnOpenSearch = document.getElementById('btn-open-adv-search');

    // Open Modal
    if (btnOpenSearch) {
        btnOpenSearch.addEventListener('click', (e) => {
            console.log("Botão de pesquisa avançada clicado!");
            e.preventDefault();
            e.stopPropagation();

            if (typeof openModal === 'function') {
                console.log("Abrindo modal de pesquisa...");
                openModal(searchModal);
            } else {
                console.error("Função openModal não encontrada! (Verifique o escopo)");
            }

            setTimeout(() => {
                if (searchInputAdv) searchInputAdv.focus();
            }, 100);

            // Clear search on open
            if (searchInputAdv) {
                searchInputAdv.value = '';
                // Don't render results initially to avoid performance hits
                if (searchResultsGrid) searchResultsGrid.innerHTML = '';
            }
        });
    }

    // Search Logic
    if (searchInputAdv) {
        searchInputAdv.addEventListener('input', debounceLocal((e) => {
            const term = e.target.value.toLowerCase().trim();
            renderAdvancedSearchResults(term);
        }, 300));
    }

    function renderAdvancedSearchResults(term) {
        if (!searchResultsGrid) return;

        if (!localProductCache) {
            searchResultsGrid.innerHTML = '<p class="text-center">Carregando produtos...</p>';
            return;
        }

        let results = [];
        if (!term) {
            // If no term, clear valid results or show nothing
            searchResultsGrid.innerHTML = '';
            return;
        } else {
            // Filter Products
            results = localProductCache.filter(p =>
                (p.name && p.name.toLowerCase().includes(term)) ||
                (p.id && p.id.toString().includes(term)) ||
                (p.brand && p.brand.toLowerCase().includes(term))
            ).slice(0, 20);
        }

        if (results.length === 0) {
            searchResultsGrid.innerHTML = '<p class="text-center w-full" style="grid-column: 1 / -1; padding: 20px;">Nenhum produto encontrado.</p>';
            return;
        }

        searchResultsGrid.innerHTML = results.map(p => {
            const hasImage = p.imgUrl && p.imgUrl.length > 10;
            const hasOffer = p.promoPrice && parseFloat(p.promoPrice) > 0;
            const actualPrice = hasOffer ? parseFloat(p.promoPrice) : parseFloat(p.price || 0);
            const originalPriceFormatted = parseFloat(p.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const finalPriceFormatted = actualPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            // Image or Icon Logic
            let imgHTML = '';
            if (hasImage) {
                imgHTML = `<img src="${p.imgUrl}" alt="${p.name}" class="adv-card-img">`;
            } else {
                imgHTML = `<div class="adv-card-icon"><i class='bx bx-box'></i></div>`;
            }

            return `
            <div class="adv-product-card ${hasOffer ? 'has-offer-card' : ''}">
                ${imgHTML}

                <div class="adv-card-body">
                    <h4 class="adv-card-title" title="${p.name}">${p.name}</h4>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span class="adv-card-subtitle">#${p.id}</span>
                        ${hasOffer ? `<span class="carnaval-tag" style="font-size: 0.55rem; padding: 1px 6px; background:#db0038; color:white; border-radius:10px; font-weight:700;"><i class='bx bx-party'></i> Carnaval</span>` : ''}
                    </div>
                </div>

                <div class="adv-card-price-box">
                    <div class="adv-card-price" style="${hasOffer ? 'color:#db0038; font-weight:800;' : ''}">${finalPriceFormatted}</div>
                    ${hasOffer ? `<small class="adv-card-original-price" style="text-decoration:line-through;">${originalPriceFormatted}</small>` : ''}
                </div>

                <div class="adv-card-actions">
                     <button class="btn-adv-action-icon btn-add" title="Adicionar" onclick="event.stopPropagation(); window.addToCartByCode('${p.id}')">
                        <i class='bx bx-plus'></i>
                     </button>
                     <button class="btn-adv-action-icon btn-details" title="Detalhes" onclick="event.stopPropagation(); if(typeof openEditProductModal === 'function') openEditProductModal('${p.id}');">
                        <i class='bx bx-edit-alt'></i>
                     </button>
                </div>
            </div>
            `;
        }).join('');
    }

    // Helper to add by code
    window.addToCartByCode = function (code) {
        const product = localProductCache.find(p => p.codigo == code || p.id == code);
        if (product) {
            addToCart(product);
            if (typeof showCustomToast === 'function') showCustomToast("Produto Adicionado!");
        }
    };

    // --- LÓGICA DE MONITORAMENTO DO FECHAMENTO DE CAIXA ---
    const inputsFecharCaixa = [
        'close-caixa-notas', 'close-caixa-moedas',
        'close-caixa-cartao',
        'close-caixa-deposito', 'close-caixa-fica',
        'close-caixa-assinatura'
    ];

    inputsFecharCaixa.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                updateCloseCaixaNextBtnState();
            });
        }
    });

    if (closeCaixaNextBtn) {
        closeCaixaNextBtn.addEventListener('click', () => {
            navigateFecharCaixaSteps(1);
        });
    }

    if (closeCaixaPrevBtn) {
        closeCaixaPrevBtn.addEventListener('click', () => {
            navigateFecharCaixaSteps(-1);
        });
    }

});

// =======================================================
// LÓGICA DE ADMINISTRADOR (CORRIGIDA E CONSOLIDADA)
// =======================================================

const ADMIN_PASS = "ADM25-PASS";
let acaoPendenteAposSenha = null; // Variável global para guardar o callback

// --- 1. FUNÇÕES DO MODAL DE SENHA ---

function solicitarAcessoAdm(callbackSucesso) {
    const modalAuth = document.getElementById('modal-admin-auth');
    const inputSenha = document.getElementById('admin-password-input');
    const msgErro = document.getElementById('auth-error-msg');

    if (!modalAuth) {
        alert("ERRO: Modal de autenticação não encontrado no HTML.");
        return;
    }

    // Reseta estado do modal
    inputSenha.value = "";
    msgErro.style.display = "none";

    // GUARDA A FUNÇÃO (CALLBACK) PARA SER EXECUTADA DEPOIS
    acaoPendenteAposSenha = callbackSucesso;

    // Abre modal (adiciona classe active se usar css de transição ou display flex)
    modalAuth.style.display = "flex";
    modalAuth.classList.add('active'); // Garante compatibilidade

    setTimeout(() => inputSenha.focus(), 100);
}

function fecharModalAuth() {
    const modalAuth = document.getElementById('modal-admin-auth');
    if (modalAuth) {
        modalAuth.style.display = "none";
        modalAuth.classList.remove('active');
    }
    acaoPendenteAposSenha = null; // Limpa a ação pendente
}

function verificarSenhaAdm() {
    const inputSenha = document.getElementById('admin-password-input');
    const msgErro = document.getElementById('auth-error-msg');

    if (inputSenha.value === ADMIN_PASS) {
        // --- CORREÇÃO DE ORDEM ---
        // 1. Salva a ação numa variável local antes de fechar o modal
        const acaoParaExecutar = acaoPendenteAposSenha;

        // 2. Fecha o modal (isso vai limpar a variável global acaoPendenteAposSenha)
        fecharModalAuth();

        // 3. Executa a ação salva (se existir)
        if (acaoParaExecutar && typeof acaoParaExecutar === 'function') {
            acaoParaExecutar();
        }
    } else {
        msgErro.style.display = "block";
        inputSenha.value = "";
        inputSenha.focus();
    }
}

// --- 2. LISTENERS GLOBAIS UNIFICADOS ---

// Eventos de clique (Delegação para evitar conflitos)
document.addEventListener('click', function (e) {
    const target = e.target;

    // Identifica botões principais (suporta clique no ícone interno)
    const btnLapis = target.closest('#btn-admin-edit');
    const btnQrCode = target.closest('#btn-gerar-acesso');
    const btnCloseReneg = target.closest('#close-renegociar');

    // Identifica botões do modal de senha
    const btnConfirmAuth = target.closest('#btn-confirm-auth');
    const btnCancelAuth = target.closest('#btn-cancel-auth');

    // >>> CLIQUE NO LÁPIS (RENEGOCIAR) <<<
    if (btnLapis) {
        e.preventDefault();

        solicitarAcessoAdm(function () {
            // Esta função roda SÓ DEPOIS da senha correta
            const modalReneg = document.getElementById('modal-renegociar');
            const nomeEl = document.getElementById('detail-cliente-nome');
            const saldoEl = document.getElementById('detail-cliente-saldo');
            const vencEl = document.getElementById('detail-cliente-vencimento');

            // Pega o nome visível AGORA
            const nomeAtual = nomeEl ? nomeEl.innerText.trim() : "";

            if (!nomeAtual || nomeAtual === "Carregando...") {
                alert("Erro: O nome do cliente ainda não carregou.");
                return;
            }

            // PASSAGEM DE DADOS: Guarda o nome no modal de renegociação
            modalReneg.setAttribute('data-cliente-nome', nomeAtual);

            // Preenche visualmente
            document.getElementById('reneg-saldo-atual').innerText = saldoEl ? saldoEl.innerText : "R$ 0,00";
            document.getElementById('reneg-vencimento-atual').value = vencEl ? vencEl.innerText : "";

            // Data sugerida (Hoje + 30 dias)
            try {
                const hoje = new Date();
                hoje.setDate(hoje.getDate() + 30);
                document.getElementById('reneg-nova-data').valueAsDate = hoje;
            } catch (e) { }

            // Abre o modal de renegociação
            modalReneg.style.display = 'flex';
            modalReneg.classList.add('active');
        });
    }

    // >>> CLIQUE NO LÁPIS (EDITAR VENCIMENTO MANUAL) <<<
    const btnEditVenc = target.closest('#btn-edit-vencimento');
    if (btnEditVenc) {
        e.preventDefault();
        solicitarAcessoAdm(function () {
            const modalDate = document.getElementById('modal-alterar-vencimento');
            const nomeEl = document.getElementById('detail-cliente-nome');
            const nomeAtual = nomeEl ? nomeEl.innerText.trim() : "";
            if (!nomeAtual || nomeAtual === "Carregando...") { alert("Erro: Nome não carregado."); return; }

            modalDate.setAttribute('data-cliente-nome', nomeAtual);
            // Tenta preencher a data atual
            const vencEl = document.getElementById('detail-cliente-vencimento');
            if (vencEl) {
                const partes = vencEl.innerText.trim().split('/');
                if (partes.length === 3) {
                    try { document.getElementById('input-novo-vencimento').value = `${partes[2]} -${partes[1]} -${partes[0]} `; } catch (e) { }
                }
            }

            modalDate.style.display = 'flex';
            modalDate.classList.add('active');
        });
    }

    // >>> CLIQUE NO FECHAR MODAL DATA <<<
    if (target.closest('[data-target="modal-alterar-vencimento"]')) {
        const m = document.getElementById('modal-alterar-vencimento');
        if (m) { m.style.display = 'none'; m.classList.remove('active'); }
    }

    // >>> CONFIRMAR ALTERAÇÃO DATA MANUAL (API) <<<
    const btnConfirmDate = target.closest('#btn-confirmar-vencimento');
    if (btnConfirmDate) {
        e.preventDefault();
        const modalDate = document.getElementById('modal-alterar-vencimento');
        const nomeParaBuscar = modalDate.getAttribute('data-cliente-nome');
        const novaData = document.getElementById('input-novo-vencimento').value;

        if (!novaData) { alert("Selecione uma data."); return; }
        if (!nomeParaBuscar) { alert("Erro nome cliente."); return; }

        const btn = btnConfirmDate;
        const originalText = btn.innerHTML;
        btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Salvando...";
        btn.disabled = true;

        (async () => {
            try {
                const params = new URLSearchParams({
                    action: "alterarVencimentoManual",
                    idCliente: nomeParaBuscar,
                    novaData: novaData
                });

                const response = await fetch(`${SCRIPT_URL}?${params.toString()} `);
                const result = await response.json();

                if (result.status === 'success') {
                    alert("Data alterada com sucesso!");
                    modalDate.style.display = 'none';
                    modalDate.classList.remove('active');

                    // Atualiza visualmente se o modal estiver aberto (está, por baixo)
                    const vencEl = document.getElementById('detail-cliente-vencimento');
                    if (vencEl) {
                        const partes = novaData.split('-');
                        vencEl.innerText = `${partes[2]} /${partes[1]}/${partes[0]} `;
                    }

                    // Dispara evento de "refresh" se existir, ou apenas alerta.
                } else {
                    alert("Erro: " + result.message);
                }
            } catch (e) {
                alert("Erro de conexão: " + e.message);
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        })();
    }

    // >>> CLIQUE NO GERAR ACESSO (QR CODE) <<<
    if (btnQrCode) {
        e.preventDefault();

        solicitarAcessoAdm(function () {
            const nomeElement = document.getElementById('detail-cliente-nome');
            const nomeCompleto = nomeElement ? nomeElement.innerText : "";

            if (!nomeCompleto || nomeCompleto === "Carregando...") return;

            const nomeParam = nomeCompleto.toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]/g, "");

            const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/')) + "/meuacesso.html";
            const linkCompleto = `${baseUrl}?q = ${nomeParam} `;

            const qrContainer = document.getElementById('qrcode-container');
            const linkText = document.getElementById('link-acesso-text');

            if (qrContainer) {
                qrContainer.innerHTML = "";
                qrContainer.style.display = "flex";
                new QRCode(qrContainer, { text: linkCompleto, width: 150, height: 150 });
            }

            if (linkText) {
                linkText.style.display = "block";
                linkText.innerHTML = `< a href = "${linkCompleto}" target = "_blank" > ABRIR LINK</a > `;
            }
        });
    }

    // >>> CONTROLES DO MODAL DE SENHA <<<
    if (btnConfirmAuth) verificarSenhaAdm();
    if (btnCancelAuth) fecharModalAuth();

    // >>> FECHAR MODAL DE RENEGOCIAÇÃO <<<
    if (btnCloseReneg) {
        const modalReneg = document.getElementById('modal-renegociar');
        modalReneg.style.display = 'none';
        modalReneg.classList.remove('active');
    }

    // >>> CONFIRMAR RENEGOCIAÇÃO (ENVIO API) <<<
    const btnConfirmarRenegDelegate = target.closest('#btn-confirmar-renegociacao');
    if (btnConfirmarRenegDelegate) {
        e.preventDefault(); // Evita reload se for form

        const modalReneg = document.getElementById('modal-renegociar');
        const novaDataEl = document.getElementById('reneg-nova-data');
        const parcelasEl = document.getElementById('reneg-parcelas');

        const novaData = novaDataEl ? novaDataEl.value : "";
        const qtdParcelas = parcelasEl ? parcelasEl.value : "1";

        // RECUPERA O NOME GUARDADO NO ATRIBUTO
        const nomeParaBuscar = modalReneg.getAttribute('data-cliente-nome');

        if (!novaData) {
            alert("Selecione uma nova data de vencimento.");
            return;
        }
        if (!nomeParaBuscar) {
            alert("Erro Técnico: Nome do cliente se perdeu. Feche e abra a ficha novamente.");
            return;
        }

        const btn = btnConfirmarRenegDelegate;
        const originalText = btn.innerHTML;
        btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Salvando...";
        btn.disabled = true;

        // Função assíncrona auto-executável para suportar await dentro do listener
        (async () => {
            try {
                // USA A URL GLOBAL (SCRIPT_URL) que contém a lógica do Code.js fornecido
                // Envia o NOME na variavel idCliente (o backend já sabe lidar com isso)
                const response = await fetch(`${SCRIPT_URL}?action = renegociarSaldo & idCliente=${encodeURIComponent(nomeParaBuscar)}& novaData=${novaData}& parcelas=${qtdParcelas} `);
                const json = await response.json();

                if (json.status === 'success') {
                    alert("✅ Renegociação realizada com sucesso!");
                    modalReneg.style.display = 'none';
                    modalReneg.classList.remove('active');

                    // Fecha a ficha do cliente para forçar atualização visual
                    const ficha = document.getElementById('cliente-details-modal');
                    if (ficha) {
                        ficha.classList.remove('active');
                        ficha.style.display = 'none';
                    }

                    // Recarrega lista
                    if (typeof renderClientesPage === 'function') {
                        if (typeof localClientCache !== 'undefined') localClientCache = null; // Limpa cache
                        renderClientesPage();
                    } else {
                        location.reload();
                    }
                } else {
                    alert("Erro do Sistema: " + json.message);
                }

            } catch (error) {
                alert("Erro de conexão: " + error.message);
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        })();
    }
});

// Listener de Tecla Enter no Input de Senha
const inputAuth = document.getElementById('admin-password-input');
if (inputAuth) {
    inputAuth.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') verificarSenhaAdm();
    });
}

// --- 3. CONFIRMAR RENEGOCIAÇÃO (ENVIO API) ---


// FUNÇÃO DE DIAGNÓSTICO (PLANO B)
window.testefiscal = async () => {
    console.log("🚀 Iniciando Teste Fiscal Isolado...");

    const itemTeste = [{
        id: "7897252260367",
        name: "PRODUTO TESTE FISCAL",
        price: 10.00,
        quantity: 1,
        ncm: "95030099", // NCM Genérico de brinquedo (o mesmo do seu erro)
        cfop: "5102",
        unit: "UN",
        csosn: "102",
        origem: "0"
    }];

    try {
        const response = await fetch(`${FISCAL_API_URL}/emitirNfce`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: itemTeste,
                totalPagamento: 10.00,
                saleId: "TESTE-" + Date.now()
            })
        });

        const data = await response.json();
        if (response.ok) {
            console.log("✅ TESTE BEM SUCEDIDO:", data);
            alert("Conexão Fiscal OK! Chave: " + data.chave);
        } else {
            console.error("❌ ERRO NO TESTE:", data);
            alert("Erro no Servidor: " + data.message);
        }
    } catch (err) {
        console.error("❌ FALHA NA REQUISIÇÃO:", err);
        alert("Falha de rede/DNS. Verifique a URL do Cloud Run.");
    }
};

// Função para fechar o aviso localmente
function closeAnnouncement() {
    document.getElementById('announcement-modal').classList.remove('active');
}

// Ouvinte em tempo real para avisos do sistema
function listenForSystemAnnouncements() {
    // Caminho no Firestore: Coleção 'system_alerts' -> Documento 'global_notice'
    db.collection("system_alerts").doc("global_notice")
        .onSnapshot((doc) => {
            const data = doc.data();
            // Se 'show' for verdadeiro no Firebase, o modal aparece para todos
            if (data && data.show === true) {
                const modal = document.getElementById('announcement-modal');
                modal.classList.add('active');

                // Opcional: Tocar um alerta sonoro discreto
                console.log("Sistema: Novo aviso de atualização recebido.");
            }
        }, (error) => {
            console.error("Erro ao escutar avisos:", error);
        });
}

// Inicie a escuta junto com as outras inicializações do DOM
document.addEventListener('DOMContentLoaded', () => {
    // ... suas inicializações existentes ...
    listenForSystemAnnouncements();
});

// --- SISTEMA DE STATUS DE CONEXÃO E RELÓGIO ---

function initSystemFooter() {
    const footer = document.querySelector('.pn');
    const statusText = document.getElementById('network-status-text');
    const timeDisplay = document.getElementById('horario');

    // 1. Lógica de Rede
    function updateNetworkStatus() {
        if (navigator.onLine) {
            statusText.textContent = "ONLINE";
            footer.classList.remove('offline');
        } else {
            statusText.textContent = "OFFLINE";
            footer.classList.add('offline');
        }
    }

    // Ouvintes de evento (dispara quando cai ou volta a net)
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    // Verificação inicial
    updateNetworkStatus();
}

// Inicia ao carregar a página
document.addEventListener("DOMContentLoaded", initSystemFooter);

function verificarEspaçoLocalStorage() {
    let totalCotas = 5120; // Limite padrão de ~5MB em KB
    let totalUsado = 0;

    for (let i = 0; i < localStorage.length; i++) {
        let chave = localStorage.key(i);
        let valor = localStorage.getItem(chave);
        // Cada caractere em JS ocupa 2 bytes (UTF-16)
        totalUsado += ((chave.length + valor.length) * 2) / 1024; // Convertendo para KB
    }

    let percentual = ((totalUsado / totalCotas) * 100).toFixed(2);
    let livre = (totalCotas - totalUsado).toFixed(2);

    // Log detalhado no console
    console.log(`--- MONITOR DE ARMAZENAMENTO ---`);
    console.log(`Usado: ${totalUsado.toFixed(2)} KB`);
    console.log(`Livre: ${livre} KB`);
    console.log(`Percentual: ${percentual}%`);

    // Retorna os dados para uso visual se necessário
    return { usado: totalUsado, percentual: percentual, livre: livre };
}

// Função para renderizar uma barrinha no rodapé (PN)
function renderizarBarraArmazenamento() {
    const info = verificarEspaçoLocalStorage();
    const footer = document.querySelector('.pn');

    if (!footer) return;

    // Remove barra antiga se existir
    const antiga = document.getElementById('storage-monitor');
    if (antiga) antiga.remove();

    const div = document.createElement('div');
    div.id = 'storage-monitor';
    div.style = "font-size: 10px; color: #fff; margin-left: 15px; display: flex; align-items: center; gap: 8px;";

    div.innerHTML = `
        <span>DB: ${info.percentual}%</span>
        <div style="width: 50px; height: 6px; background: rgba(255,255,255,0.2); border-radius: 3px; overflow: hidden;">
            <div style="width: ${info.percentual}%; height: 100%; background: ${info.percentual > 80 ? '#ef4444' : '#10b981'}; transition: 0.3s;"></div>
        </div>
    `;

    footer.appendChild(div);
}

// Chame ao carregar a página
document.addEventListener('DOMContentLoaded', renderizarBarraArmazenamento);




// --- Função Reutilizável de Maximização de Modais ---
function setupMaximizeModal(btnId, modalSelector) {
    const btn = document.getElementById(btnId);
    const modal = document.querySelector(modalSelector);
    if (!btn || !modal) return;

    // Remove listeners antigos (clone hack)
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', (e) => {
        e.preventDefault();
        modal.classList.toggle('maximized');
        const icon = newBtn.querySelector('i');
        if (icon) {
            if (modal.classList.contains('maximized')) {
                icon.className = 'bx bx-exit-fullscreen';
                newBtn.title = "Restaurar janela";
            } else {
                icon.className = 'bx bx-expand';
                newBtn.title = "Expandir janela";
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Aplica a lógica ao modal de Cliente
    setupMaximizeModal('btn-maximize-client-modal', '#cliente-details-modal .modal-content');

    // Aplica também ao modal de Produtos (garante funcionamento para ambos)
    setupMaximizeModal('btn-maximize-modal', '#edit-product-modal .modal-content');


    // --- LÓGICA DE RECUPERAÇÃO FISCAL (XML) ---
    const recoveryModal = document.getElementById('recovery-xml-modal');
    const btnOpenRecovery = document.getElementById('btn-open-recovery-modal');
    const btnProcessRecovery = document.getElementById('btn-process-recovery');
    const recoveryStatusArea = document.getElementById('recovery-status-area');
    const recoveryStatusMsg = document.getElementById('recovery-status-msg');

    if (btnOpenRecovery && recoveryModal) {
        btnOpenRecovery.addEventListener('click', () => {
            // Reset fields
            document.getElementById('recovery-chave').value = '';
            document.getElementById('recovery-items-text').value = '';

            recoveryStatusArea.style.display = 'none';
            recoveryModal.classList.add('active');
            recoveryModal.style.display = 'flex';
        });
    }

    if (btnProcessRecovery) {
        btnProcessRecovery.addEventListener('click', async () => {
            const chave = document.getElementById('recovery-chave').value.trim();
            const itemsText = document.getElementById('recovery-items-text').value.trim();
            const paymentMethod = document.getElementById('recovery-payment-method').value;
            // O valor agora é calculado automaticamente da soma dos itens

            if (chave.length !== 44) {
                alert("A chave deve ter 44 dígitos numéricos.");
                return;
            }

            if (!itemsText) {
                alert("Cole a lista de itens.");
                return;
            }

            // 1. Parse Itens
            const itens = parseItemsString(itemsText);
            if (itens.length === 0) {
                alert("Não foi possível identificar itens no texto. Tente o formato: '1x NOME DO PRODUTO'");
                return;
            }

            // Validação de Total (Agora é o total calculado)
            const paymentValue = itens.reduce((acc, it) => acc + (it.qCom * it.vUnCom), 0);

            if (paymentValue <= 0) {
                alert("O valor total dos itens é zero. Verifique se os produtos foram encontrados no cadastro.");
                return;
            }

            // Confirmar total com o usuário
            if (!confirm(`Confirma a recuperação com ${itens.length} itens no valor total de R$ ${paymentValue.toFixed(2)}?`)) {
                return;
            }

            // UI Feedback
            btnProcessRecovery.disabled = true;
            btnProcessRecovery.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Processando...";
            recoveryStatusArea.style.display = 'block';
            recoveryStatusMsg.textContent = "Reconstruindo XML...";
            recoveryStatusMsg.className = "";

            try {
                const payload = {
                    chNFe: chave,
                    itens: itens,
                    ambiente: 1, // 1 = Produção
                    payment: {
                        method: paymentMethod, // '01', '03', '04', '17'
                        value: paymentValue
                    }
                };

                const response = await fetch("https://southamerica-east1-super-app25.cloudfunctions.net/reconstruirNfce", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) throw new Error("Erro na função cloud: " + response.statusText);

                const result = await response.text(); // XML String

                // Download
                const blob = new Blob([result], { type: "application/xml" });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${chave}-procNFe.xml`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                recoveryStatusMsg.textContent = "Sucesso! Download iniciado.";
                recoveryStatusMsg.style.color = "green";
                recoveryModal.classList.remove('active');
                recoveryModal.style.display = 'none';

            } catch (error) {
                console.error(error);
                recoveryStatusMsg.textContent = "Erro: " + error.message;
                recoveryStatusMsg.style.color = "red";
            } finally {
                btnProcessRecovery.disabled = false;
                btnProcessRecovery.innerHTML = "<i class='bx bx-cog'></i> Processar e Gerar XML";
            }
        });
    }

    // Helper para parsear texto (Ex "1x VELA MACARON CANDY COLOR C/6UN - COLORIDO;")
    function parseItemsString(text) {
        // Normaliza quebras de linha e separadores (ponto e vírgula vira quebra para processar)
        const lines = text.replace(/;/g, '\n').split('\n');
        const parsed = [];

        lines.forEach(line => {
            line = line.trim();
            if (!line) return;

            // Tenta capturar "QTD x NOME"
            // Suporta: "1x PRODUTO", "1 x PRODUTO", "10X PRODUTO - DETALHE"
            const match = line.match(/^(\d+)\s*[xX]\s+(.+)/);

            if (match) {
                const qtd = parseFloat(match[1]);
                let nomeRaw = match[2].trim();

                // Se houver preço no final (ex: " - 10,00"), tentar extrair (opcional)
                // Mas o foco agora é buscar no cadastro pelo NOME

                // Remove traços ou caracteres irrelevantes do final se for preço
                // Mas o exemplo do usuário é " - COLORIDO", parte do nome.
                // Vamos assumir que tudo é nome e buscar a melhor correspondência.

                let product = null;
                let price = 0;

                if (localProductCache) {
                    const term = nomeRaw.toLowerCase();

                    // 1. Busca Exata
                    product = localProductCache.find(p => p.name.toLowerCase() === term);

                    // 2. Busca Contém (se não achou exata)
                    if (!product) {
                        product = localProductCache.find(p => p.name.toLowerCase().includes(term));
                    }

                    // 3. Tenta limpar sufixos comuns como " - " se não achou
                    if (!product && term.includes(' - ')) {
                        const cleanTerm = term.split(' - ')[0];
                        product = localProductCache.find(p => p.name.toLowerCase().includes(cleanTerm));
                    }
                }

                if (product) {
                    price = parseFloat(product.price);
                } else {
                    // Se não achou produto, tenta extrair preço do texto se existir "R$ 10,00" ou similar?
                    // User pediu para garantir que carrega. Se não achar, vai 0.
                    console.warn("Produto não encontrado no cache:", nomeRaw);
                }

                parsed.push({
                    code: product ? (product.code || product.id || product.codigo) : '99999',
                    description: product ? product.name : nomeRaw, // Use nome cadastrado se achar
                    ncm: product ? product.ncm : '00000000',
                    cest: product ? (product.cest || '') : '',
                    cfop: product ? product.cfop : '5102',
                    uCom: product ? (product.unit || 'UN') : 'UN',
                    qCom: qtd,
                    vUnCom: price,
                    vProd: price * qtd,
                    vTotTrib: (price * qtd) * 0.04
                });
            }
        });

        return parsed;
    }

});
/* ======================================== */
/* == LÓGICA DE SAÍDA DE CAIXA (SANGRIA) == */
/* ======================================== */
document.addEventListener('DOMContentLoaded', () => {
    const btnSangria = document.getElementById('btn-sangria');
    const modalSaidaCaixa = document.getElementById('modal-saida-caixa');
    const formSaidaCaixa = document.getElementById('form-saida-caixa');
    const saidaDeclarationSelect = document.getElementById('saidaDeclarationSelect');

    if (btnSangria && modalSaidaCaixa) {
        btnSangria.addEventListener('click', () => {
            // Reset fields
            document.getElementById('saida-valor').value = '';
            document.getElementById('saida-descricao').value = '';
            document.getElementById('saida-declaracao').value = '';
            if (saidaDeclarationSelect) {
                saidaDeclarationSelect.querySelector('.selected').innerHTML = "<i class='bx bx-purchase-tag-alt'></i> Selecione...";
                saidaDeclarationSelect.classList.remove('active');
            }

            // Open Modal Manually (Fallback if openModal is missing)
            if (typeof openModal === 'function') {
                openModal(modalSaidaCaixa);
            } else {
                modalSaidaCaixa.classList.add('active');
                modalSaidaCaixa.style.display = 'flex';
            }

            // Focus on valor
            setTimeout(() => document.getElementById('saida-valor').focus(), 100);
        });

        // Close button logic for this specific modal
        const closeBtns = modalSaidaCaixa.querySelectorAll('.close-modal-btn');
        closeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (typeof closeModal === 'function') {
                    closeModal(modalSaidaCaixa);
                } else {
                    modalSaidaCaixa.classList.remove('active');
                    modalSaidaCaixa.style.display = 'none';
                }
            });
        });
    }

    // Custom Select Logic
    if (saidaDeclarationSelect) {
        const selected = saidaDeclarationSelect.querySelector('.selected');
        const options = saidaDeclarationSelect.querySelector('.options');
        const hiddenInfo = document.getElementById('saida-declaracao');

        selected.addEventListener('click', (e) => {
            e.stopPropagation();
            saidaDeclarationSelect.classList.toggle('active');
        });

        options.querySelectorAll('div').forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                selected.innerHTML = opt.innerHTML;
                hiddenInfo.value = opt.getAttribute('data-value');
                saidaDeclarationSelect.classList.remove('active');
            });
        });

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!saidaDeclarationSelect.contains(e.target)) {
                saidaDeclarationSelect.classList.remove('active');
            }
        });
    }

    // Input Valor Formatting
    const inputSaidaValor = document.getElementById('saida-valor');
    if (inputSaidaValor) {
        inputSaidaValor.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, '');
            e.target.value = 'R$ ' + (parseInt(v || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        });
    }

    // Form Submission
    if (formSaidaCaixa) {
        formSaidaCaixa.addEventListener('submit', async (e) => {
            e.preventDefault();

            const btnSubmit = formSaidaCaixa.querySelector('button[type="submit"]');

            const valorRaw = inputSaidaValor.value.replace(/\D/g, ''); // 1234
            const valor = parseFloat(valorRaw) / 100; // 12.34
            const declaracao = document.getElementById('saida-declaracao').value;
            const descricao = document.getElementById('saida-descricao').value.trim();

            if (valor <= 0) {
                if (typeof showCustomAlert === 'function') showCustomAlert("Erro", "Informe um valor válido.");
                else alert("Informe um valor válido.");
                return;
            }

            if (!declaracao) {
                if (typeof showCustomAlert === 'function') showCustomAlert("Atenção", "Selecione o motivo da saída.");
                else alert("Selecione o motivo da saída.");
                return;
            }

            if (!descricao) {
                if (typeof showCustomAlert === 'function') showCustomAlert("Atenção", "A descrição é obrigatória.");
                else alert("A descrição é obrigatória.");
                return;
            }

            // UI Loading
            const originalBtnText = btnSubmit.innerHTML;
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Registrando...";

            try {
                // Get Operator Info
                const operadorNome = document.getElementById('summary-seller-name')?.textContent || "Caixa Principal";
                const cargo = operadorNome === "Nubia" ? "ADM" : "Caixa";
                const lojaId = 'DT#25'; // Loja atualizada para o padrão da API

                const payload = {
                    "loja": lojaId,
                    "operador": operadorNome,
                    "cargo": cargo,
                    "tipo": "saída",
                    "id": "",
                    "pagamento": "dinheiro",
                    "valor": valor,
                    "desconto": 0,
                    "taxas": 0,
                    "total": valor,
                    "descricao": `${declaracao}: ${descricao}`
                };

                const TARGET_API_URL = CENTRAL_API_URL;

                // Envio 'no-cors' para evitar bloqueio, enviando como string text/plain mas formato JSON
                await fetch(TARGET_API_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: {
                        'Content-Type': 'text/plain;charset=utf-8'
                    },
                    body: JSON.stringify(payload)
                });

                // Success Handling (Assumed success due to no-cors)
                console.log("Saída Registrada API (JSON):", payload);

                if (typeof showCustomAlert === 'function') {
                    showCustomAlert("Sucesso", "Saída registrada com sucesso!");
                } else {
                    alert("Saída registrada com sucesso!");
                }

                if (typeof closeModal === 'function') {
                    closeModal(modalSaidaCaixa);
                } else {
                    modalSaidaCaixa.classList.remove('active');
                    modalSaidaCaixa.style.display = 'none';
                }

                // Clear Form
                document.getElementById('saida-valor').value = '';
                document.getElementById('saida-descricao').value = '';
                if (saidaDeclarationSelect) {
                    saidaDeclarationSelect.querySelector('.selected').innerHTML = "<i class='bx bx-purchase-tag-alt'></i> Selecione...";
                }
                document.getElementById('saida-declaracao').value = '';

            } catch (error) {
                console.error("Erro ao registrar saída:", error);
                if (typeof showCustomAlert === 'function') showCustomAlert("Erro", "Falha ao comunicar com o servidor.");
                else alert("Falha ao comunicar com o servidor.");
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = originalBtnText;
            }
        });
    }
});



document.addEventListener('DOMContentLoaded', () => {
    // --- Lógica Modal Atualizar Produto ---
    const btnUpdateProduct = document.getElementById('btn-update-product');
    const updateProductModal = document.getElementById('update-product-modal');
    const updateProdBarcode = document.getElementById('update-prod-barcode');
    const btnSearchUpdateProd = document.getElementById('btn-search-update-prod');
    const updateProdLoader = document.getElementById('update-prod-loader');
    const updateProdForm = document.getElementById('update-prod-form');
    const btnSaveUpdateProd = document.getElementById('btn-save-update-prod');

    // Inputs do Form
    const upImg = document.getElementById('update-prod-img');
    const upImgPreview = document.getElementById('update-prod-img-preview');
    const upName = document.getElementById('update-prod-name');
    const upPrice = document.getElementById('update-prod-price');
    const upStock = document.getElementById('update-prod-stock');
    const upUnit = document.getElementById('update-prod-unit');
    const upCat = document.getElementById('update-prod-category');

    let currentEditingProduct = null;

    if (btnUpdateProduct && updateProductModal) {
        btnUpdateProduct.addEventListener('click', () => {
            openModal(updateProductModal);
            updateProdForm.style.display = 'none';
            updateProdLoader.style.display = 'none';
            updateProdBarcode.value = '';
            updateProdBarcode.focus();
            currentEditingProduct = null;
        });

        const searchProductForUpdate = async () => {
            const code = updateProdBarcode.value.trim();
            if (!code) return;

            updateProdLoader.style.display = 'block';
            updateProdForm.style.display = 'none';

            try {
                const response = await fetch(`${SCRIPT_URL}?action=buscarProduto&codigo=${code}`);
                const result = await response.json();

                updateProdLoader.style.display = 'none';

                if (result.status === 'success' && result.data) {
                    // Produto Encontrado
                    fillUpdateForm(result.data);
                } else {
                    // Produto Não Encontrado
                    if (confirm(`Produto ${code} não encontrado. Deseja cadastrar agora?`)) {
                        // Modo Criação
                        currentEditingProduct = { id: code, isNew: true };
                        clearUpdateForm();
                        updateProdForm.style.display = 'block';
                        upName.focus();
                    }
                }
            } catch (e) {
                console.error(e);
                updateProdLoader.style.display = 'none';
                showCustomAlert("Erro", "Falha ao buscar produto.");
            }
        };

        btnSearchUpdateProd.addEventListener('click', searchProductForUpdate);
        updateProdBarcode.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') searchProductForUpdate();
        });

        upImg.addEventListener('change', () => {
            if (upImg.value) {
                upImgPreview.src = upImg.value;
                upImgPreview.style.display = 'block';
            } else {
                upImgPreview.style.display = 'none';
            }
        });

        btnSaveUpdateProd.addEventListener('click', async () => {
            if (!currentEditingProduct) return;

            const originalText = btnSaveUpdateProd.innerHTML;
            btnSaveUpdateProd.disabled = true;
            btnSaveUpdateProd.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Salvando...";

            try {
                const payload = {
                    action: 'saveProduct',
                    data: {
                        id: currentEditingProduct.id,
                        name: upName.value.trim(),
                        price: upPrice.value,
                        stock: upStock.value,
                        unit: upUnit.value,
                        category: upCat.value,
                        imgUrl: upImg.value,
                        // Preserva ou define padrão
                        costPrice: currentEditingProduct.isNew ? 0 : currentEditingProduct.costPrice,
                        brand: currentEditingProduct.isNew ? '' : currentEditingProduct.brand,
                        ncm: currentEditingProduct.isNew ? '' : currentEditingProduct.ncm,
                        cest: currentEditingProduct.isNew ? '' : currentEditingProduct.cest,
                        cfop: currentEditingProduct.isNew ? '5102' : currentEditingProduct.cfop,
                        origem: currentEditingProduct.isNew ? '0' : currentEditingProduct.origem,
                        csosn: currentEditingProduct.isNew ? '102' : currentEditingProduct.csosn
                    }
                };

                const options = {
                    method: 'POST',
                    body: JSON.stringify(payload)
                };

                const response = await fetch(SCRIPT_URL, options);
                const result = await response.json();

                if (result.status === 'success') {
                    showCustomAlert("Sucesso", result.message);
                    updateProdForm.style.display = 'none';
                    updateProdBarcode.value = '';
                    // Recarrega cache discretamente
                    if (window.carregarCacheDeProdutos) window.carregarCacheDeProdutos();

                    // [ADICIONADO] Rastreia meta de cadastro
                    if (window.trackProductRegistration) window.trackProductRegistration(currentEditingProduct.id);
                } else {
                    // showCustomAlert("Erro", result.message);
                }

            } catch (e) {
                showCustomAlert("Erro", "Erro ao salvar: " + e.toString());
            } finally {
                btnSaveUpdateProd.disabled = false;
                btnSaveUpdateProd.innerHTML = originalText;
            }
        });
    }

    function fillUpdateForm(prod) {
        currentEditingProduct = prod;
        updateProdForm.style.display = 'block';

        upImg.value = prod.imgUrl || '';
        if (prod.imgUrl) {
            upImgPreview.src = prod.imgUrl;
            upImgPreview.style.display = 'block';
        } else {
            upImgPreview.style.display = 'none';
        }

        upName.value = prod.name || '';
        upPrice.value = prod.price || '';
        // prod.stock de listarTodosProdutos
        upStock.value = prod.stock !== undefined ? prod.stock : '';
        upUnit.value = prod.unit || 'UN';
        upCat.value = prod.category || 'Geral';
    }

    function clearUpdateForm() {
        upImg.value = '';
        upImgPreview.style.display = 'none';
        upName.value = '';
        upPrice.value = '';
        upStock.value = '';
        upUnit.value = 'UN';
        upCat.value = 'Geral';
    }

    // =======================================================
    // == LÓGICA DO MODAL FESTA (PROMOÇÃO) ==
    // =======================================================
    const btnFestaPromo = document.getElementById('btn-festa-promo');
    const modalFestaPromo = document.getElementById('modal-festa-promo');
    const festaBarcode = document.getElementById('festa-barcode-input');
    const btnFestaSearch = document.getElementById('btn-festa-search');
    const festaLoader = document.getElementById('festa-loader');
    const festaProductInfo = document.getElementById('festa-product-info');
    const btnSaveFesta = document.getElementById('btn-save-festa-promo');

    let currentFestaProduct = null;

    if (btnFestaPromo) {
        btnFestaPromo.addEventListener('click', () => {
            if (typeof openModal === 'function') openModal(modalFestaPromo);
            else modalFestaPromo.style.display = 'flex';

            if (festaBarcode) {
                festaBarcode.value = '';
                setTimeout(() => festaBarcode.focus(), 300);
            }
            if (festaProductInfo) festaProductInfo.style.display = 'none';
        });
    }

    const searchProductForFesta = async () => {
        const code = festaBarcode ? festaBarcode.value.trim() : '';
        if (!code) return;

        if (festaLoader) festaLoader.style.display = 'block';
        if (festaProductInfo) festaProductInfo.style.display = 'none';
        currentFestaProduct = null;

        try {
            // Primeiro busca no cache local se houver
            let prod = localProductCache ? localProductCache.find(p => String(p.id) === code) : null;

            if (!prod) {
                // Se não achou no cache, busca na API
                const response = await fetch(`${SCRIPT_URL}?action=buscarProduto&codigo=${code}`);
                const result = await response.json();
                if (result.status === 'success') prod = result.data;
            }

            if (festaLoader) festaLoader.style.display = 'none';

            if (prod) {
                currentFestaProduct = prod;
                const prodImg = document.getElementById('festa-prod-img');
                const prodName = document.getElementById('festa-prod-name');
                const prodPriceOrig = document.getElementById('festa-prod-price-orig');
                const offerPriceField = document.getElementById('festa-offer-price');
                const discountPercField = document.getElementById('festa-discount-perc');

                if (prodImg) prodImg.src = prod.imgUrl || 'https://placehold.co/70x70?text=S/F';
                if (prodName) prodName.textContent = prod.name;
                if (prodPriceOrig) prodPriceOrig.textContent = `Preço Atual: ${formatCurrency(prod.price)}`;

                if (offerPriceField) {
                    offerPriceField.value = '';
                    setTimeout(() => offerPriceField.focus(), 100);
                }
                if (discountPercField) discountPercField.value = '0';

                if (festaProductInfo) festaProductInfo.style.display = 'block';
            } else {
                if (confirm(`Produto ${code} não encontrado. Deseja cadastrar agora?`)) {
                    if (typeof closeModal === 'function') closeModal(modalFestaPromo);
                    else modalFestaPromo.style.display = 'none';

                    const btnUpdate = document.getElementById('btn-update-product');
                    if (btnUpdate) btnUpdate.click();

                    setTimeout(() => {
                        const codeInput = document.getElementById('update-product-barcode');
                        if (codeInput) {
                            codeInput.value = code;
                            const event = new KeyboardEvent('keydown', { key: 'Enter' });
                            codeInput.dispatchEvent(event);
                        }
                    }, 500);
                }
            }
        } catch (e) {
            console.error(e);
            if (festaLoader) festaLoader.style.display = 'none';
            if (window.showCustomAlert) window.showCustomAlert("Erro", "Erro ao buscar produto.");
        }
    };

    if (btnFestaSearch) btnFestaSearch.addEventListener('click', searchProductForFesta);
    if (festaBarcode) {
        festaBarcode.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchProductForFesta();
            }
        });
    }

    const offerPriceInput = document.getElementById('festa-offer-price');
    if (offerPriceInput) {
        offerPriceInput.addEventListener('input', (e) => {
            const offerPrice = parseFloat(e.target.value);
            const discountPercField = document.getElementById('festa-discount-perc');
            if (currentFestaProduct && offerPrice > 0) {
                const original = parseFloat(currentFestaProduct.price);
                const discountPercent = ((original - offerPrice) / original) * 100;
                if (discountPercField) discountPercField.value = discountPercent.toFixed(1);
            } else {
                if (discountPercField) discountPercField.value = '0';
            }
        });
    }

    if (btnSaveFesta) {
        btnSaveFesta.addEventListener('click', async () => {
            if (!currentFestaProduct) return;
            const offerPrice = document.getElementById('festa-offer-price').value;
            if (!offerPrice) {
                if (window.showCustomAlert) window.showCustomAlert("Atenção", "Informe o preço de oferta.");
                return;
            }

            const originalText = btnSaveFesta.innerHTML;
            btnSaveFesta.disabled = true;
            btnSaveFesta.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Gravando...";

            try {
                const payload = {
                    action: 'saveProduct',
                    data: {
                        ...currentFestaProduct,
                        promoPrice: parseFloat(offerPrice)
                    }
                };

                const response = await fetch(SCRIPT_URL, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                const result = await response.json();

                if (result.status === 'success') {
                    // Atualiza cache local
                    const idx = localProductCache.findIndex(p => String(p.id) === String(currentFestaProduct.id));
                    if (idx !== -1) localProductCache[idx].promoPrice = parseFloat(offerPrice);

                    if (typeof closeModal === 'function') closeModal(modalFestaPromo);
                    else modalFestaPromo.style.display = 'none';

                    renderProdutosPage(); // Atualiza a lista e contadores

                    // [ADICIONADO] Rastreia meta de cadastro (como edição de promo conta como atividade)
                    if (window.trackProductRegistration) window.trackProductRegistration(currentFestaProduct.id);
                } else {
                    if (window.showCustomAlert) window.showCustomAlert("Erro", "Falha ao salvar: " + result.message);
                }
            } catch (e) {
                console.error(e);
                if (window.showCustomAlert) window.showCustomAlert("Erro", "Falha na conexão com o servidor.");
            } finally {
                btnSaveFesta.disabled = false;
                btnSaveFesta.innerHTML = originalText;
            }
        });
    }
});


