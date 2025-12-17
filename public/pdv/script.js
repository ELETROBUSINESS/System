

// ============================================================
// 1. ESCOPO GLOBAL (VARIÁVEIS E BANCO DE DADOS)
// ============================================================

let db; // Variável do Banco de Dados
let realtimeOrdersUnsubscribe = null;
let areValuesHidden = false;

// Variáveis de Pedidos Online (Globais para evitar o erro ReferenceError)
let activeOrdersData = [];
let currentOrderStatusFilter = 'pendente';

// Configuração e Inicialização Imediata do Firebase
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
} else {
    firebase.app();
}

db = firebase.firestore(); // db agora existe globalmente
console.log("Firebase inicializado globalmente!");

// Credenciais e URLs
const FIREBASE_CONFIG_ID = 'floralchic-loja';
const STORE_OWNER_UID = "3zYT9Y6hXWeJSuvmEYP4FMZa5gI2";
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzvd0BBLEEQlu-ksnIbsmnYcjQNQuZcTrsCmXMKHGM5g7DPEk3Nj95X47LKbj7rRSAT/exec";
const REGISTRO_VENDA_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxCCaxdYdC6J_QKsaoWTDquH915MHUnM9BykD39ZUujR2LB3lx9d9n5vAsHdJZJByaa7w/exec";

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

    let selectedCrediarioClient = null; // Para armazenar o cliente selecionado no pagamento

    // --- Estado da Aplicação ---
    let localProductCache = null;
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
    const effectiveDiscountDisplay = document.getElementById('effective-discount-display');
    const discountPercentageText = document.getElementById('discount-percentage-text');
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
    const alertTitle = document.getElementById('alert-title');
    const alertMessage = document.getElementById('alert-message');
    const confirmTitle = document.getElementById('confirm-title');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmActionBtn = document.getElementById('confirm-action-btn');
    const mainNavbar = document.getElementById('main-navbar');
    const navbarItems = document.querySelectorAll('.navbar-item');
    const navbarHighlight = document.getElementById('navbar-highlight');
    const allPages = document.querySelectorAll('.page-content');
    const produtosTableContainer = document.getElementById('produtos-table-container');
    const clientesListContainer = document.getElementById('clientes-list-container');
    const smartRoundingToggle = document.getElementById('smart-rounding-toggle');
    const reloadCacheBtn = document.getElementById('reload-cache-btn');
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
    const closeCaixaPixInput = document.getElementById('close-caixa-pix');
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


    // Handler para Opções de Pagamento
    // Localize onde você tem "paymentOptions.forEach..."
    paymentOptions.forEach(option => {
        option.addEventListener('click', () => {
            const method = option.dataset.method;

            if (method === 'Crediário') {
                // Lógica Nova: Não fecha o modal, mostra opções de parcelamento

                // 1. Esconde as opções de ícones grandes
                document.getElementById('single-payment-options').style.display = 'none';
                document.getElementById('split-payment-toggle-btn').style.display = 'none';

                // 2. Mostra o painel de parcelas
                const crediarioArea = document.getElementById('crediario-options');
                crediarioArea.style.display = 'block';

                // 3. Atualiza simulação de valor
                const total = lastSaleData ? lastSaleData.total : 0;
                const select = document.getElementById('sale-installments');
                const preview = document.getElementById('installment-preview');

                const updatePreview = () => {
                    const parc = parseInt(select.value);
                    const val = total / parc;
                    preview.innerHTML = `${parc}x de <strong>${formatCurrency(val)}</strong>`;
                };

                select.onchange = updatePreview;
                updatePreview(); // Roda primeira vez

                // Se ainda não selecionou cliente, abre o modal de seleção primeiro?
                // Idealmente sim, mas vamos manter seu fluxo: seleciona cliente, depois volta pra cá ou confirma.
                if (!selectedCrediarioClient) {
                    // ... lógica para abrir busca de cliente ...
                    // (Mantenha sua lógica atual de abrir modal de cliente se necessário)
                }

            } else {
                // ... (Lógica normal para Dinheiro/Pix/Cartão)
                handlePaymentSelection(method);
            }
        });
    });

    document.getElementById('confirm-crediario-btn').addEventListener('click', () => {
        if (!selectedCrediarioClient) {
            // Se não tem cliente, abre o modal de busca
            openModal(document.getElementById('client-selection-modal'));
            return;
        }

        // Define método e número de parcelas
        selectedPaymentMethod = 'Crediário';
        const numParcelas = document.getElementById('sale-installments').value;

        // Salva num lugar temporário para usar no processFinalSale
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

    const updateSummaryClientCard = () => {
        if (selectedCrediarioClient && selectedPaymentMethod === 'Crediário') {
            summaryClientCard.style.display = 'block';
            summaryClientNameText.textContent = selectedCrediarioClient.nomeExibicao;

            // Cálculo do Limite em Tempo Real
            const limite = parseFloat(selectedCrediarioClient.limite) || 0;
            const dividaAntiga = parseFloat(selectedCrediarioClient.saldoDevedor) || 0;
            const compraAtual = lastSaleData ? lastSaleData.total : 0;

            // Disponível AGORA (antes de consolidar a compra atual)
            const disponivelReal = limite - dividaAntiga;

            // Como ficará APÓS a compra
            const saldoFinalPrevisto = disponivelReal - compraAtual;

            if (limite > 0) {
                summaryLimitValue.textContent = formatCurrency(saldoFinalPrevisto);

                // Barra de progresso baseada no uso total (Dívida + Compra)
                const usoTotal = dividaAntiga + compraAtual;
                let percentual = (usoTotal / limite) * 100;
                if (percentual > 100) percentual = 100;

                summaryLimitFill.style.width = `${percentual}%`;

                if (saldoFinalPrevisto < 0) {
                    summaryLimitFill.classList.add('danger');
                    summaryLimitValue.style.color = 'var(--warning-red)';
                    summaryLimitValue.textContent = `Estourado: ${formatCurrency(saldoFinalPrevisto)}`;
                } else {
                    summaryLimitFill.classList.remove('danger');
                    summaryLimitValue.style.color = 'var(--text-dark)';
                }
            } else {
                // Sem limite definido
                summaryLimitFill.style.width = '0%';
                summaryLimitValue.textContent = "Ilimitado / Não def.";
            }

        } else {
            summaryClientCard.style.display = 'none';
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

    const renderCart = () => {
        cartItemsBody.innerHTML = '';

        // Bloqueio de Desconto Global se houver itens do Firebase
        const hasFirebaseItems = cart.some(i => i.isFirebase);
        if (hasFirebaseItems) {
            discountInputR.disabled = true;
            discountInputR.placeholder = "Bloqueado (Ofertas)";
            document.querySelectorAll('.perc-btn').forEach(b => b.disabled = true);
            if (discount > 0) { discount = 0; discountInputR.value = ''; updateSummary(); }
        } else {
            discountInputR.disabled = false;
            discountInputR.placeholder = "0,00";
            document.querySelectorAll('.perc-btn').forEach(b => b.disabled = false);
        }

        if (cart.length === 0) {
            emptyState.style.display = 'flex';
            itemListTable.style.display = 'none';
            itemListContainer.classList.add('empty');
        } else {
            emptyState.style.display = 'none';
            itemListTable.style.display = 'table';
            itemListContainer.classList.remove('empty');

            cart.forEach(item => {
                const tr = document.createElement('tr');
                tr.dataset.id = item.id;
                if (item.isNew) { tr.classList.add('new-item-flash'); delete item.isNew; setTimeout(() => tr.classList.remove('new-item-flash'), 500); }

                // Visual do Input de Desconto
                let discountInputHtml = '';
                if (item.isFirebase) {
                    const colorStyle = item.discountPercent > 0 ? 'color:var(--success-green);font-weight:bold' : 'color:#999';
                    discountInputHtml = `<span style="${colorStyle}">${item.discountPercent.toFixed(0)}%</span>`;
                } else {
                    discountInputHtml = `<input type="number" style="width:50px;padding:4px;border:1px solid #ddd;border-radius:4px;text-align:center;" value="${item.discountPercent}" min="0" max="100" onchange="updateCartItem('${item.id}', 'discountPercent', this.value)"> %`;
                }

                tr.innerHTML = `
                        <td>
                            <div class="product-info">
                                <div class="product-image"><i class='bx bx-package'></i></div>
                                <div class="product-details">
                                    <span class="name">${item.name}</span>
                                    <span class="barcode">#${item.id}</span>
                                </div>
                            </div>
                        </td>
                        <td>
                            <div class="quantity-control">
                                <button class="qty-btn" onclick="updateCartItem('${item.id}', 'quantity', 'decrease')"><i class='bx bx-minus'></i></button>
                                <span class="qty-display">${item.quantity}</span>
                                <button class="qty-btn" onclick="updateCartItem('${item.id}', 'quantity', 'increase')"><i class='bx bx-plus'></i></button>
                            </div>
                        </td>
                        <td class="item-price">${formatCurrency(item.originalPrice)}</td>
                        
                        <td class="item-offer" style="text-align:center;">${discountInputHtml}</td>
                        
                        <td class="item-total">${formatCurrency(item.price * item.quantity)}</td>
                        
                        <td><button class="remove-btn" onclick="removeFromCart('${item.id}')" title="Remover"><i class='bx bx-trash'></i></button></td>
                    `;
                cartItemsBody.appendChild(tr);
            });
        }
        updateSummary();
    };


    const updateSummary = () => {
        // 1. Subtotal Bruto (Soma dos preços cheios originais)
        const subtotalGross = cart.reduce((acc, item) => acc + (item.originalPrice * item.quantity), 0);

        // 2. Total Líquido (Soma dos preços reais com desconto aplicado nos itens)
        const totalNetItems = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

        // 3. Desconto Total (Diferença entre Bruto e Líquido + Desconto Global se houver)
        // Nota: Se houver itens Firebase, 'discount' global será 0 pela lógica do renderCart
        const totalDiscount = (subtotalGross - totalNetItems) + discount;

        // 4. Total Final a Pagar
        const finalTotal = subtotalGross - totalDiscount;

        // Atualiza Interface
        const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

        summarySubtotal.textContent = formatCurrency(subtotalGross);
        summaryDiscount.textContent = formatCurrency(totalDiscount > 0 ? totalDiscount * -1 : 0); // Exibe negativo visualmente

        // Exibe porcentagem efetiva se houver desconto
        if (totalDiscount > 0 && subtotalGross > 0) {
            const percentage = (totalDiscount / subtotalGross) * 100;
            discountPercentageText.textContent = `(${percentage.toFixed(2)}% econ.)`;
            effectiveDiscountDisplay.style.display = 'flex';
        } else {
            discountPercentageText.textContent = '';
            effectiveDiscountDisplay.style.display = 'none';
        }

        summaryTotal.textContent = formatCurrency(finalTotal);
        itemCount.textContent = totalItems;
        paymentTotalEl.textContent = formatCurrency(finalTotal);
        receiptTotalEl.textContent = formatCurrency(finalTotal);

        // Atualiza dados globais da venda para o recibo
        lastSaleData = {
            subtotal: subtotalGross,
            discount: totalDiscount,
            total: finalTotal,
            paymentMethod: selectedPaymentMethod
        };

        updateSummaryClientCard();
    };


    // Função para converter "dd/MM/yyyy" em objeto Date do JS corretamente
    function parseDataSegura(dataStr) {
        if (!dataStr || dataStr === "Quitado" || dataStr === "Verificar") return null;

        try {
            // Se já for uma string ISO (YYYY-MM-DDTHH:mm...), o Date entende direto
            let d = new Date(dataStr);

            // Se a data for inválida (NaN), tenta o fallback do formato brasileiro
            if (isNaN(d.getTime())) {
                const partes = dataStr.split('/');
                if (partes.length === 3) {
                    const dia = parseInt(partes[0]);
                    const mes = parseInt(partes[1]) - 1;
                    const ano = parseInt(partes[2]);
                    d = new Date(ano, mes, dia, 12, 0, 0); // Meio-dia para evitar fuso
                }
            }

            return isNaN(d.getTime()) ? null : d;
        } catch (e) {
            console.error("Erro ao processar data:", dataStr);
            return null;
        }
    }

    const renderProdutosPage = () => { produtosTableContainer.innerHTML = ''; if (!localProductCache) { produtosTableContainer.innerHTML = '<p style="text-align: center; color: var(--text-light);"><i class="bx bx-loader-alt bx-spin"></i> Carregando...</p>'; if (localProductCache === null) carregarCacheDeProdutos(); return; } if (localProductCache.length === 0) { produtosTableContainer.innerHTML = '<p style="text-align: center; color: var(--text-light);">Nenhum produto.</p>'; return; } const table = document.createElement('table'); table.className = 'data-table products-table'; table.innerHTML = `<thead><tr><th>Nome</th><th>Código</th><th>Preço</th></tr></thead><tbody></tbody>`; const tbody = table.querySelector('tbody'); localProductCache.forEach(product => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${product.name}</td><td>${product.id}</td><td class="currency">${formatCurrency(product.price)}</td>`; tbody.appendChild(tr); }); produtosTableContainer.appendChild(table); };

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

            // --- CÁLCULO DE DATA E EMBLEMAS ---
            let diffDays = 0;
            // O backend agora manda 'Quitado' ou uma data 'dd/MM/yyyy' calculada corretamente
            let dataObj = parseDataSegura(cliente.proximoVencimento);
            let temData = (dataObj instanceof Date && !isNaN(dataObj.getTime()));

            // Se o saldo for quase zero, força status quitado independente da data
            const isQuitado = parseFloat(cliente.saldoDevedor) <= 0.01;

            if (temData) {
                // Renderiza a data normalmente
            } else {
                // Se o sistema retornar nulo ou data inválida, exibe "Em dia" ou "OK"
                badgeHtml = `<div class="status-badge badge-quitado"><span>OK</span></div>`;
            }

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

    // --- Lógica da Página de Histórico ---
    const carregarHistorico = async () => {
        salesHistoryList.innerHTML = '<p style="text-align: center; padding: 20px;"><i class="bx bx-loader-alt bx-spin"></i> Atualizando...</p>';

        try {
            const response = await fetch(`${SCRIPT_URL}?action=listarHistoricoVendas`);
            const result = await response.json();

            if (result.status === 'success' && result.data.length > 0) {
                salesHistoryList.innerHTML = ''; // Limpa

                result.data.forEach(venda => {
                    // Cria o cartão da venda
                    const card = document.createElement('div');
                    card.style.border = '1px solid var(--border-color)';
                    card.style.borderRadius = '12px';
                    card.style.padding = '16px';
                    card.style.backgroundColor = '#fff';

                    card.innerHTML = `
                            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                                <strong style="font-size:1rem;">${venda.cliente}</strong>
                                <span style="color:var(--success-green); font-weight:bold;">${formatCurrency(venda.valor)}</span>
                            </div>
                            <div style="font-size:0.85rem; color:#666; margin-bottom:8px;">
                                <i class='bx bx-user'></i> Vend: ${venda.vendedor} &bull; 
                                <i class='bx bx-credit-card'></i> ${venda.pagamento} &bull; 
                                <i class='bx bx-time'></i> ${venda.data}
                            </div>
                            <div style="font-size:0.8rem; background:#f9f9f9; padding:8px; border-radius:6px; color:#444;">
                                ${venda.produtos}
                            </div>
                        `;
                    salesHistoryList.appendChild(card);
                });
            } else {
                salesHistoryList.innerHTML = '<p style="text-align: center; color: #777; padding: 20px;">Nenhuma venda registrada hoje.</p>';
            }
        } catch (e) {
            salesHistoryList.innerHTML = '<p style="text-align: center; color: var(--warning-red);">Erro ao carregar histórico.</p>';
        }
    };

    // Botão de Atualizar e Clique na Aba
    btnRefreshHistory.addEventListener('click', carregarHistorico);

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

            // Se for Firebase e tiver oferta válida, calcula o preço final
            if (product.isFirebase && product.priceOffer > 0 && product.priceOffer < basePrice) {
                finalPrice = product.priceOffer;
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
    const clearCart = () => { cart = []; removeDiscount(); resetPaymentMethod(); lastSaleData = null; renderCart(); };

    // Funções de Modal com Acessibilidade
    const openModal = (modalEl) => { elementToRestoreFocus = document.activeElement; modalEl.classList.add('active'); const primaryFocus = modalEl.querySelector('[data-primary-focus="true"]'); if (primaryFocus) { setTimeout(() => primaryFocus.focus(), 100); } };
    const closeModal = (modalEl) => { modalEl.classList.remove('active'); if (elementToRestoreFocus && elementToRestoreFocus.focus) { try { elementToRestoreFocus.focus(); } catch (e) { console.warn("Não foi possível restaurar o foco:", e); } } elementToRestoreFocus = null; };
    const showCustomAlert = (title, message) => { alertTitle.textContent = title; alertMessage.textContent = message; openModal(alertModal); };
    const showCustomConfirm = (title, message, onConfirm) => { confirmTitle.textContent = title; confirmMessage.textContent = message; confirmCallback = onConfirm; openModal(confirmModal); };
    const resetPaymentMethod = () => { selectedPaymentMethod = null; summaryPaymentMethod.textContent = "Não selecionado"; summaryPaymentMethod.style.fontWeight = '500'; summaryPaymentMethod.style.color = 'var(--text-light)'; updateSummary(); };

    // --- Funções de Desconto ---
    const getSubtotal = () => cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const applyDiscount = (requestedDiscount, isPercentage = false) => { const subtotal = getSubtotal(); if (subtotal === 0) { if (requestedDiscount !== 0) { showCustomAlert("Vazio", "Adicione itens."); } return; } let calculatedDiscount = isPercentage ? subtotal * (requestedDiscount / 100) : requestedDiscount; const newTotal = subtotal - calculatedDiscount; const roundedTotal = isSmartRoundingEnabled ? Math.round(newTotal * 2) / 2 : newTotal; const finalDiscount = subtotal - roundedTotal; discount = (finalDiscount > subtotal) ? subtotal : ((finalDiscount < 0) ? 0 : finalDiscount); discountInputR.value = discount > 0 ? discount.toFixed(2) : ''; updateSummary(); };
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

    window.updateCartItem = (id, field, value) => {
        const item = cart.find(i => i.id === id);
        if (!item) return;

        if (field === 'quantity') {
            if (value === 'increase') item.quantity++;
            else if (value === 'decrease') {
                item.quantity--;
                if (item.quantity === 0) return removeFromCart(id);
            }
        } else if (field === 'discountPercent') {
            // Só permite editar se NÃO for produto Firebase (oferta fixa)
            if (!item.isFirebase) {
                let percent = parseFloat(value) || 0;
                // Travas de segurança
                if (percent < 0) percent = 0;
                if (percent > 100) percent = 100;

                item.discountPercent = percent;

                // CÁLCULO: Preço Final = Preço Original * (1 - %)
                // O 'originalPrice' continua sendo o preço cheio.
                item.price = item.originalPrice * (1 - (percent / 100));
            }
        }
        renderCart();
    };

    // Função Principal de Carregamento (Híbrida)
    async function carregarCacheDeProdutos() {
        barcodeInput.disabled = true;
        barcodeInput.placeholder = "Carregando sistema...";
        barcodeHint.textContent = "Sincronizando estoques...";
        localProductCache = [];

        try {
            // 1. Busca Google Sheets e Firebase em paralelo
            const [sheetResponse, firebaseProducts] = await Promise.all([
                fetch(SCRIPT_URL + "?action=listarProdutos"),
                fetchFirebaseProductsForCache()
            ]);

            // 2. Processa Google Sheets
            if (!sheetResponse.ok) throw new Error("Erro rede Sheets.");
            const sheetResult = await sheetResponse.json();
            let sheetProducts = [];

            if (sheetResult.status === 'success') {
                sheetProducts = sheetResult.data.map(p => ({
                    ...p,
                    price: parseFloat(p.price) // Garante numérico
                }));
            }

            // 3. Lógica de Mesclagem (Firebase Sobrescreve Sheets)
            // Cria um mapa usando o ID (código de barras) como chave
            const productMap = new Map();

            // Adiciona produtos da Planilha primeiro
            sheetProducts.forEach(p => productMap.set(String(p.id).trim(), p));

            // Adiciona/Sobrescreve com produtos do Firebase
            firebaseProducts.forEach(p => {
                // Se já existe, o Firebase ganha (atualiza preço/nome)
                // Se não existe, é adicionado
                productMap.set(String(p.id).trim(), p);
            });

            // Converte de volta para array
            localProductCache = Array.from(productMap.values());
            if (document.getElementById('produtos-table-container')) {
                renderProdutosPage(); // <--- Essa função pega os dados da memória e cria as linhas da tabela (<tr>)
            }

            console.log(`Cache unificado: ${localProductCache.length} produtos.`);
            barcodeHint.textContent = "F2 para focar";

        } catch (error) {
            console.error("Erro cache prod:", error);
            showCustomAlert("Erro Sincronização", "Falha ao carregar produtos. Verifique a internet.");
            localProductCache = [];
            barcodeHint.textContent = "Erro. F5.";
        } finally {
            barcodeInput.disabled = false;
            barcodeInput.placeholder = "Ler código...";
            if (verificarToken()) barcodeInput.focus();
        }
    }


    function buscarProdutoLocalmente(barcode) { if (localProductCache === null) { showCustomAlert("Aguarde", "Cache carregando."); return null; } return localProductCache.find(p => p.id === barcode) || null; }
    async function cadastrarProdutoNaAPI(product) { quickAddSubmitBtn.disabled = true; quickAddSubmitBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Cadastrando..."; try { const params = new URLSearchParams({ action: 'cadastrarProduto', codigo: product.id, nome: product.name, preco: product.price }); const response = await fetch(`${SCRIPT_URL}?${params.toString()}`, { method: 'GET' }); if (!response.ok) throw new Error("Erro rede."); const result = await response.json(); if (result.status === 'success') { if (localProductCache) { localProductCache.push(result.data); } return result.data; } else { throw new Error(result.message || "Erro API."); } } catch (error) { console.error("Erro cadastro prod:", error); showCustomAlert("Erro Cadastro Prod", error.message); return null; } finally { quickAddSubmitBtn.disabled = false; quickAddSubmitBtn.innerHTML = "Adicionar"; } }
    async function registrarVendaAtual(payments) { if (!lastSaleData) { throw new Error("Sem dados venda."); } if (!REGISTRO_VENDA_SCRIPT_URL || REGISTRO_VENDA_SCRIPT_URL.includes("COLE_A_URL")) { throw new Error("URL registro não config."); } const now = new Date(); const timestamp = formatTimestamp(now); const baseData = { formType: 'venda', seller: 'nubia', type: 'entrada', value: lastSaleData.subtotal.toFixed(2), desconto: lastSaleData.discount.toFixed(2), Timestamp: timestamp }; const fetchPromises = payments.map(payment => { const paymentData = { ...baseData, payment: payment.method || 'N/A', total: payment.value.toFixed(2) }; const formData = new URLSearchParams(paymentData); console.log("Enviando parte registro:", formData.toString()); return fetch(REGISTRO_VENDA_SCRIPT_URL, { redirect: "follow", method: "POST", body: formData.toString(), headers: { "Content-Type": "application/x-www-form-urlencoded" }, }); }); const responses = await Promise.all(fetchPromises); const allOk = responses.every(response => response.ok); if (allOk) { console.log("Registro OK!"); } else { const firstErrorResponse = responses.find(response => !response.ok); let errorText = `Falha registro. Status: ${firstErrorResponse?.status || '?'}`; try { if (firstErrorResponse) errorText = await firstErrorResponse.text(); } catch (readError) { } throw new Error(errorText); } }

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

    async function carregarClientesDaAPI() { clientesListContainer.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px 0;"><i class="bx bx-loader-alt bx-spin"></i> Carregando...</p>'; localClientCache = null; try { const response = await fetch(SCRIPT_URL + "?action=listarClientes"); if (!response.ok) throw new Error("Erro rede."); const result = await response.json(); if (result.status === 'success') { localClientCache = result.data; console.log(`Cache cli: ${localClientCache.length}`); renderClientesPage(); } else { throw new Error(result.message || "Erro API."); } } catch (error) { console.error("Erro carregar cli:", error); clientesListContainer.innerHTML = `<p style="text-align: center; color: var(--warning-red); padding: 20px 0;">${error.message}</p>`; localClientCache = []; } }
    async function salvarClienteNaAPI(clienteData) { clienteSaveBtn.disabled = true; clienteSaveBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Salvando..."; try { const params = new URLSearchParams({ action: 'cadastrarCliente', ...clienteData }); const response = await fetch(`${SCRIPT_URL}?${params.toString()}`, { method: 'GET' }); if (!response.ok) throw new Error("Erro rede."); const result = await response.json(); if (result.status === 'success') { showCustomAlert("Sucesso!", result.message || "Cliente cadastrado!"); closeModal(addClienteModal); if (localClientCache !== null) { localClientCache.push(result.data); localClientCache.sort((a, b) => (a.apelido || a.nomeExibicao).localeCompare(b.apelido || b.nomeExibicao)); } renderClientesPage(); } else { throw new Error(result.message || "Erro API."); } } catch (error) { console.error("Erro salvar cli:", error); showCustomAlert("Erro Salvar", error.message); } finally { clienteSaveBtn.disabled = false; clienteSaveBtn.innerHTML = "<i class='bx bx-save'></i> Salvar"; } }
    async function abrirCaixaAPI(data) {
        openCaixaSaveBtn.disabled = true; openCaixaSaveBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Abrindo..."; try {
            const params = new URLSearchParams({ action: 'abrirCaixa', ...data }); const response = await fetch(`${SCRIPT_URL}?${params.toString()}`, { method: 'GET' }); if (!response.ok) throw new Error("Erro rede."); const result = await response.json(); if (result.status === 'success') {
                salvarToken(); liberarSistema(); showCustomAlert("Sucesso!", result.message || "Caixa aberto!"); closeModal(openCaixaModal);
            } else { throw new Error(result.message || "Erro API."); }
        } catch (error) { console.error("Erro abrir caixa:", error); showCustomAlert("Erro Abrir Caixa", error.message); } finally { openCaixaSaveBtn.disabled = false; openCaixaSaveBtn.innerHTML = "<i class='bx bx-check'></i> Confirmar"; }
    }
    async function fecharCaixaAPI(data) {
        closeCaixaSaveBtn.disabled = true; closeCaixaSaveBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Fechando..."; try {
            const params = new URLSearchParams({ action: 'fecharCaixa', ...data }); const response = await fetch(`${SCRIPT_URL}?${params.toString()}`, { method: 'GET' }); if (!response.ok) throw new Error("Erro rede."); const result = await response.json(); if (result.status === 'success') {
                limparToken(); bloquearSistema("Caixa fechado! Recarregue a página (F5) para reabrir."); // Mensagem atualizada
                showCustomAlert("Sucesso!", result.message || "Caixa fechado!"); closeModal(closeCaixaModal);
            } else { throw new Error(result.message || "Erro API."); }
        } catch (error) { console.error("Erro fechar caixa:", error); showCustomAlert("Erro Fechar Caixa", error.message); } finally { closeCaixaSaveBtn.disabled = false; closeCaixaSaveBtn.innerHTML = "<i class='bx bx-lock-alt'></i> Confirmar"; }
    }

    // --- Funções para controlar UI (baseado no token) ---
    const bloquearSistema = (message = "Abertura de caixa necessária.") => {
        mainContent.style.display = 'none';
        loadingOverlay.classList.remove('hidden');
        loadingMessage.textContent = message;
        headerCloseCaixaBtn.style.display = 'none';
    };

    const liberarSistema = () => {
        loadingOverlay.classList.add('hidden');
        mainContent.style.display = 'block';
        headerCloseCaixaBtn.style.display = 'inline-flex';

        if (localProductCache === null) carregarCacheDeProdutos();
        const activePage = document.querySelector('.navbar-item.active')?.dataset.page;
        if (activePage === 'clientes' && localClientCache === null) carregarClientesDaAPI();

        const activeItem = document.querySelector('.navbar-item.active');
        if (activeItem) updateNavbarHighlight(activeItem);
    };

    // --- Handlers de Ação ---
    const handleScan = () => { const barcode = barcodeInput.value.trim(); if (!barcode) return; const product = buscarProdutoLocalmente(barcode); if (product) { addToCart(product); } else if (localProductCache !== null) { lastScannedBarcode = barcode; scannedBarcodeEl.textContent = barcode; quickAddForm.reset(); openModal(quickAddModal); } barcodeInput.value = ''; };
    const debounce = (func, delay) => { clearTimeout(barcodeScanTimeout); barcodeScanTimeout = setTimeout(func, delay); };
    const handleQuickAddSubmit = async () => { const name = quickAddName.value; const price = parseFloat(quickAddPrice.value); if (!name || isNaN(price) || price <= 0) { showCustomAlert("Inválido", "Nome e preço."); return; } const newProduct = { id: lastScannedBarcode, name: name, price: price }; const produtoCadastrado = await cadastrarProdutoNaAPI(newProduct); if (produtoCadastrado) { addToCart(produtoCadastrado); closeModal(quickAddModal); } };
    const handlePaymentSelection = (method) => { if (splitPaymentArea.style.display === 'none') { selectedPaymentMethod = method; summaryPaymentMethod.textContent = method; summaryPaymentMethod.style.fontWeight = '600'; summaryPaymentMethod.style.color = 'var(--text-dark)'; updateSummary(); closeModal(paymentModal); } else { showCustomAlert("Atenção", "Confirme/cancele divisão."); } };
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

    // 2. Listeners das Opções
    document.getElementById('btn-print-thermal').onclick = () => {
        closeModal(document.getElementById('print-selection-modal'));
        printThermal(tempClientNameForSignature);
    };

    document.getElementById('btn-print-a4').onclick = () => {
        closeModal(document.getElementById('print-selection-modal'));
        printA4(tempClientNameForSignature);
    };

    // --- Layout 1: Cupom Térmico ---
    const printThermal = (clientName) => {
        const now = new Date();
        const uniqueSaleID = formatTimestamp(now);

        let itemLinesHtml = '';
        cart.forEach(item => {
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
                <div class="line"><span>TOTAL:</span><span>${formatCurrency(lastSaleData.total)}</span></div>
                <div class="line"><span>Pagto:</span><span>${selectedPaymentMethod || 'N/A'}</span></div>
            </div>
            ${signatureHtml}
            <div style="text-align:center;margin-top:20px;font-size:0.8rem"><p>Não é documento fiscal</p></div>
            </body></html>`;

        executePrint(html);
    };

    // --- FUNÇÃO DE IMPRESSÃO A4 (CORRIGIDA E BLINDADA) ---
    // --- FUNÇÃO DE IMPRESSÃO A4 (CORRIGIDA) ---
    function printA4(vendaData = null, clienteData = null, parcelas = 1) {
        console.log("Iniciando impressão A4...");

        // 1. DADOS DA VENDA
        // Tenta pegar de parâmetros, depois da última venda salva, depois calcula na hora
        let dadosVenda = vendaData;

        if (!dadosVenda && window.lastSaleData) {
            dadosVenda = {
                id: "V-" + Date.now().toString().slice(-6),
                total: window.lastSaleData.total,
                discount: window.lastSaleData.discount || 0,
                pagamento: window.lastSaleData.paymentMethod || document.getElementById('summary-payment-method').textContent
            };
        }

        // Fallback final: Pega os textos da tela se não tiver dados na memória
        if (!dadosVenda) {
            const totalText = document.getElementById('summary-total').innerText.replace('R$', '').replace('.', '').replace(',', '.');
            const descText = document.getElementById('summary-discount').innerText.replace('- R$', '').replace('.', '').replace(',', '.');

            dadosVenda = {
                id: "BALCAO-" + new Date().getHours() + new Date().getMinutes(),
                total: parseFloat(totalText) || 0,
                discount: parseFloat(descText) || 0,
                pagamento: document.getElementById('summary-payment-method').textContent
            };
        }

        // 2. DADOS DO CLIENTE
        let dadosCliente = clienteData || window.selectedCrediarioClient;

        // Se não veio objeto de cliente, tenta ler o nome da tela
        if (!dadosCliente) {
            const nomeTela = document.getElementById('summary-client-name-text').textContent;
            if (nomeTela && nomeTela !== "Nome do Cliente") {
                dadosCliente = { nomeExibicao: nomeTela, cpf: "", endereco: "" };
            }
        }

        // --- PREENCHIMENTO DO DOCUMENTO ---

        // Cabeçalho
        document.getElementById('print-sale-id').textContent = dadosVenda.id;
        document.getElementById('print-sale-date').textContent = new Date().toLocaleDateString('pt-BR');
        document.getElementById('print-timestamp').textContent = new Date().toLocaleString('pt-BR');

        // Dados do Cliente
        if (dadosCliente) {
            document.getElementById('print-client-name').textContent = (dadosCliente.nomeExibicao || dadosCliente.nomeCompleto || "").toUpperCase();
            document.getElementById('print-client-doc').textContent = dadosCliente.cpf || "---";
            document.getElementById('print-client-address').textContent = dadosCliente.endereco || "Endereço não informado";
            document.getElementById('print-signature-name').textContent = (dadosCliente.nomeExibicao || "CLIENTE").toUpperCase();
        } else {
            document.getElementById('print-client-name').textContent = "CONSUMIDOR FINAL";
            document.getElementById('print-client-doc').textContent = "---";
            document.getElementById('print-client-address').textContent = "---";
            document.getElementById('print-signature-name').textContent = "CLIENTE";
        }

        // 3. ITENS (CORREÇÃO CRÍTICA: USAR ARRAY GLOBAL 'cart')
        const tbody = document.getElementById('print-items-body');
        tbody.innerHTML = '';

        // Verifica se existe carrinho global e se tem itens
        if (typeof cart !== 'undefined' && cart.length > 0) {
            cart.forEach(item => {
                // Calcula o total do item na hora (Preço unitário * Quantidade)
                const itemTotal = item.price * item.quantity;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                <td>${(item.id || "000").toString().slice(-4)}</td>
                <td>${item.name}</td>
                <td class="text-center">${item.quantity}</td>
                <td class="text-right">${formatCurrency(item.price)}</td>
                <td class="text-right"><strong>${formatCurrency(itemTotal)}</strong></td>
            `;
                tbody.appendChild(tr);
            });
        } else {
            // Caso raro onde o carrinho foi limpo antes de imprimir
            tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding: 15px;">Itens indisponíveis ou venda já finalizada.</td></tr>';
        }

        // 4. TOTAIS
        const total = parseFloat(dadosVenda.total) || 0;
        const desconto = Math.abs(parseFloat(dadosVenda.discount) || 0);
        const subtotal = total + desconto;

        document.getElementById('print-subtotal').textContent = formatCurrency(subtotal);
        document.getElementById('print-discount').textContent = "- " + formatCurrency(desconto);
        document.getElementById('print-total').textContent = formatCurrency(total);

        // Método de pagamento
        let textoPagamento = dadosVenda.pagamento || "Dinheiro";
        document.getElementById('print-obs-text').textContent = textoPagamento;

        // 5. PARCELAMENTO (Se for crediário)
        const instArea = document.getElementById('print-installments-area');
        const instList = document.getElementById('print-installments-list');
        instList.innerHTML = '';

        if (textoPagamento && textoPagamento.toLowerCase().includes("crediário")) {
            instArea.style.display = 'block';

            // Tenta detectar número de parcelas pelo texto "(3x)" se não vier por parâmetro
            if (parcelas === 1) {
                const match = textoPagamento.match(/\((\d+)x\)/);
                if (match) parcelas = parseInt(match[1]);
            }

            // Garante que é pelo menos 1
            if (parcelas < 1) parcelas = 1;

            const diaVenc = (dadosCliente && dadosCliente.diaVencimento) ? parseInt(dadosCliente.diaVencimento) : 10;
            const valorParcela = total / parcelas;
            const hoje = new Date();

            let dataBase = new Date(hoje.getFullYear(), hoje.getMonth(), diaVenc);
            if (hoje.getDate() >= (diaVenc - 10)) {
                dataBase.setMonth(dataBase.getMonth() + 1);
            }

            for (let i = 0; i < parcelas; i++) {
                let d = new Date(dataBase);
                d.setMonth(dataBase.getMonth() + i);

                const div = document.createElement('div');
                div.className = 'inst-badge';
                div.innerHTML = `<b>${i + 1}/${parcelas}</b> ${d.toLocaleDateString('pt-BR').slice(0, 5)}<br>${formatCurrency(valorParcela)}`;
                instList.appendChild(div);
            }
        } else {
            instArea.style.display = 'none';
        }

        // 6. IMPRIMIR
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
    const navigateFecharCaixaSteps = (direction) => { const nextStep = currentFecharCaixaStep + direction; if (direction === 1) { if (currentFecharCaixaStep === 1 && !validateFecharCaixaStep1()) return; if (currentFecharCaixaStep === 2 && !validateFecharCaixaStep2()) return; if (currentFecharCaixaStep === 3 && !validateFecharCaixaStep3()) return; } if (nextStep >= 1 && nextStep <= 4) { document.querySelectorAll('#close-caixa-form .form-step').forEach(el => el.classList.remove('active')); document.getElementById(`close-caixa-step-${nextStep}`).classList.add('active'); currentFecharCaixaStep = nextStep; updateFecharCaixaModalUI(); } };
    const updateFecharCaixaModalUI = () => { const progress = currentFecharCaixaStep * 25; closeCaixaProgress.style.width = `${progress}%`; closeCaixaPrevBtn.style.display = currentFecharCaixaStep === 1 ? "none" : "inline-flex"; closeCaixaNextBtn.style.display = currentFecharCaixaStep === 4 ? "none" : "inline-flex"; closeCaixaSaveBtn.style.display = currentFecharCaixaStep === 4 ? "inline-flex" : "none"; const firstInput = document.querySelector(`#close-caixa-step-${currentFecharCaixaStep} [data-primary-focus="true"], #close-caixa-step-${currentFecharCaixaStep} input`); if (firstInput) setTimeout(() => firstInput.focus(), 150); };
    const validateFecharCaixaStep1 = () => { let isValid = true;[closeCaixaNotasInput, closeCaixaMoedasInput].forEach(input => { const val = parseFloat(input.value); if (input.value.trim() === '' || isNaN(val) || val < 0) { input.classList.add('input-error'); isValid = false; } else { input.classList.remove('input-error'); } }); if (!isValid) showCustomAlert("Inválido", "Notas e Moedas devem ser >= 0."); return isValid; }; // Exige preenchimento
    const validateFecharCaixaStep2 = () => { let isValid = true;[closeCaixaCartaoInput].forEach(input => { const val = parseFloat(input.value); if (input.value.trim() === '' || isNaN(val) || val < 0) { input.classList.add('input-error'); isValid = false; } else { input.classList.remove('input-error'); } }); const pixVal = parseFloat(closeCaixaPixInput.value); if (closeCaixaPixInput.value && (isNaN(pixVal) || pixVal < 0)) { closeCaixaPixInput.classList.add('input-error'); isValid = false; } else { closeCaixaPixInput.classList.remove('input-error'); } if (!isValid) showCustomAlert("Inválido", "Cartão e Pix (se preenchido) >= 0."); return isValid; }; // Exige preenchimento cartão
    const validateFecharCaixaStep3 = () => { let isValid = true; const finalNotas = parseFloat(closeCaixaNotasInput.value) || 0; const finalMoedas = parseFloat(closeCaixaMoedasInput.value) || 0; const deposito = parseFloat(closeCaixaDepositoInput.value); const fica = parseFloat(closeCaixaFicaInput.value); const totalContado = finalNotas + finalMoedas; const totalDestinado = deposito + fica;[closeCaixaDepositoInput, closeCaixaFicaInput].forEach(input => { const val = parseFloat(input.value); if (input.value.trim() === '' || isNaN(val) || val < 0) { input.classList.add('input-error'); isValid = false; } else { input.classList.remove('input-error'); } }); if (isValid && Math.abs(totalContado - totalDestinado) > 0.01) { closeCaixaDepositoInput.classList.add('input-error'); closeCaixaFicaInput.classList.add('input-error'); isValid = false; showCustomAlert("Incompatível", `Soma Depósito+Fica (${formatCurrency(totalDestinado)}) != Total Contado (${formatCurrency(totalContado)}).`); } if (!isValid && Math.abs(totalContado - totalDestinado) <= 0.01) showCustomAlert("Inválido", "Depósito e Fica Caixa >= 0."); return isValid; }; // Exige preenchimento
    const validateFecharCaixaStep4 = () => { let isValid = true; if (!closeCaixaAssinaturaInput.value.trim()) { closeCaixaAssinaturaInput.classList.add('input-error'); isValid = false; } else { closeCaixaAssinaturaInput.classList.remove('input-error'); } if (!isValid) showCustomAlert("Obrigatório", "Informe responsável."); return isValid; };
    const resetFecharCaixaModal = () => { closeCaixaForm.reset(); document.querySelectorAll('#close-caixa-form .input-error').forEach(el => el.classList.remove('input-error')); currentFecharCaixaStep = 1; document.querySelectorAll('#close-caixa-form .form-step').forEach(el => el.classList.remove('active')); document.getElementById('close-caixa-step-1').classList.add('active'); updateFecharCaixaModalUI(); };


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

    barcodeInput.addEventListener('input', () => { debounce(handleScan, 300); });
    cartItemsBody.addEventListener('click', (e) => { const button = e.target.closest('button'); if (!button) return; const { action, id } = button.dataset; if (action === 'increase' || action === 'decrease') { updateQuantity(id, action); } else if (button.classList.contains('remove-btn')) { showCustomConfirm("Remover Item", "Tem certeza?", () => { removeFromCart(id); closeModal(confirmModal); }); } });
    discountToggleRow.addEventListener('click', () => { discountPopover.classList.toggle('active'); });
    percBtnContainer.addEventListener('click', (e) => { const button = e.target.closest('.perc-btn'); if (button && button.dataset.perc) { applyDiscount(parseFloat(button.dataset.perc), true); } });
    discountInputR.addEventListener('input', (e) => { applyDiscount(parseFloat(e.target.value) || 0, false); });
    removeDiscountBtn.addEventListener('click', removeDiscount);
    paymentToggleRow.addEventListener('click', () => { if (cart.length > 0) { splitPaymentArea.style.display = 'none'; singlePaymentOptions.style.display = 'grid'; splitPaymentToggleBtn.innerHTML = "<i class='bx bx-columns'></i> Dividir Pagamento"; splitPaymentToggleBtn.classList.remove('active'); splitValue1.value = ''; splitValue2.value = ''; splitMethod1.value = ''; splitMethod2.value = ''; confirmSplitPaymentBtn.disabled = true; updateSplitRemaining(); openModal(paymentModal); } else { showCustomAlert("Vazio", "Adicione itens."); } });
    splitPaymentToggleBtn.addEventListener('click', () => { const isActive = splitPaymentArea.style.display !== 'none'; splitPaymentArea.style.display = isActive ? 'none' : 'block'; singlePaymentOptions.style.display = isActive ? 'grid' : 'none'; splitPaymentToggleBtn.innerHTML = isActive ? "<i class='bx bx-columns'></i> Dividir Pagamento" : "<i class='bx bx-x'></i> Cancelar Divisão"; splitPaymentToggleBtn.classList.toggle('active'); if (!isActive) { currentSplitPayments.totalSaleValue = lastSaleData?.total || 0; updateSplitRemaining(); splitMethod1.focus(); } else { confirmSplitPaymentBtn.disabled = true; } });
    [splitValue1, splitValue2, splitMethod1, splitMethod2].forEach(el => { el.addEventListener('input', updateSplitRemaining); el.addEventListener('change', updateSplitRemaining); });
    confirmSplitPaymentBtn.addEventListener('click', () => { if (Math.abs(currentSplitPayments.remaining) >= 0.01) { showCustomAlert("Erro", "Soma não bate."); return; } if (!splitMethod1.value || !splitMethod2.value || splitMethod1.value === splitMethod2.value) { showCustomAlert("Erro", "Selecione 2 formas diferentes."); return; } currentSplitPayments.method1 = splitMethod1.value; currentSplitPayments.value1 = parseFloat(splitValue1.value) || 0; currentSplitPayments.method2 = splitMethod2.value; currentSplitPayments.value2 = parseFloat(splitValue2.value) || 0; selectedPaymentMethod = `Dividido (${currentSplitPayments.method1} + ${currentSplitPayments.method2})`; summaryPaymentMethod.textContent = selectedPaymentMethod; summaryPaymentMethod.style.fontWeight = '600'; summaryPaymentMethod.style.color = 'var(--text-dark)'; updateSummary(); closeModal(paymentModal); });

    // --- VARIÁVEIS GLOBAIS DE IMPRESSÃO ---
    let selectedPrintFormat = 'thermal'; // 'thermal' ou 'a4'

    // --- 1. BOTÃO FINALIZAR VENDA (F9) ---
    // Agora ele apenas abre a seleção de impressão. Nada é registrado ainda.
    finishSaleBtn.addEventListener('click', () => {
        if (cart.length === 0) {
            showCustomAlert("Vazio", "Adicione itens.");
            return;
        }

        if (!selectedPaymentMethod) {
            showCustomAlert("Pagamento", "Selecione forma.");
            openModal(paymentModal);
            return;
        }

        // Validação extra para Crediário
        if (selectedPaymentMethod === 'Crediário' && !selectedCrediarioClient) {
            showCustomAlert("Atenção", "Selecione o cliente para o Crediário.");
            openModal(clientSelectionModal);
            return;
        }

        // Abre escolha de impressão
        openModal(document.getElementById('print-selection-modal'));
    });

    let isReturningToPayment = false; // Controle de fluxo

    // --- 1. LISTENERS DOS BOTÕES DE SELEÇÃO DE IMPRESSÃO ---
    // Ao clicar, fechamos o modal de seleção e iniciamos o processo único
    document.getElementById('btn-print-thermal').onclick = () => {
        closeModal(document.getElementById('print-selection-modal'));
        processFinalSale('thermal');
    };

    document.getElementById('btn-print-a4').onclick = () => {
        closeModal(document.getElementById('print-selection-modal'));
        processFinalSale('a4');
    };

    // --- 2. FUNÇÃO MESTRA: REGISTRAR, IMPRIMIR E AVANÇAR ---
    async function processFinalSale(format) {
        // 1. Feedback Visual Imediato (Bloqueia a tela)
        loadingOverlay.classList.remove('hidden');
        loadingMessage.innerHTML = "Registrando Venda...<br>Aguarde a impressão.";

        // Desabilita botão original para evitar cliques extras no fundo
        finishSaleBtn.disabled = true;

        try {
            const now = new Date();
            const timestamp = formatTimestamp(now);
            let parcelasEnvio = 1;
            if (selectedPaymentMethod === 'Crediário') {
                parcelasEnvio = window.tempInstallments || 1;
            }

            // --- CORREÇÃO AQUI: Prepara e envia para o Histórico ---
            const dadosParaHistorico = {
                cliente: selectedCrediarioClient ? selectedCrediarioClient.nomeExibicao : "Cliente Balcão",
                vendedor: currentSeller || "Caixa", // Pega o vendedor selecionado ou define Caixa
                valorTotal: lastSaleData.total.toFixed(2),
                itens: cart, // Passa o array do carrinho
                metodoPagamento: selectedPaymentMethod,
                id: timestamp
            };

            // Chama a função que envia para a planilha 'historic' (sem await para não travar a impressão)
            salvarVendaNoHistorico(dadosParaHistorico);
            // -------------------------------------------------------

            // 2. PREPARAR DADOS DO PAGAMENTO
            let paymentsToSend = [];
            if (selectedPaymentMethod && selectedPaymentMethod.startsWith("Dividido")) {
                paymentsToSend.push({ method: currentSplitPayments.method1, value: currentSplitPayments.value1 });
                paymentsToSend.push({ method: currentSplitPayments.method2, value: currentSplitPayments.value2 });
            } else {
                paymentsToSend.push({ method: selectedPaymentMethod, value: lastSaleData.total });
            }

            // ============================================================
            // NOVO: ABATER ESTOQUE NO FIREBASE (Executa em paralelo)
            // ============================================================
            const promiseEstoque = abaterEstoqueFirebase(cart);
            const promiseRegistro = registrarVendaAtual(paymentsToSend);

            // Aguarda o registro financeiro (obrigatório) e o estoque (desejável)
            await Promise.all([promiseRegistro, promiseEstoque]);
            // ============================================================

            // 4. REGISTRAR DÍVIDA (LOG) COM PARCELAMENTO
            if (selectedPaymentMethod === 'Crediário') {
                const paramsCliente = new URLSearchParams({
                    action: 'registrarTransacao',
                    idCliente: selectedCrediarioClient.idCliente,
                    tipo: 'Compra',
                    valor: lastSaleData.total.toFixed(2),
                    timestamp: timestamp,
                    parcelas: parcelasEnvio // <--- ENVIANDO AS PARCELAS AQUI
                });

                await fetch(`${SCRIPT_URL}?${paramsCliente.toString()}`, { method: 'GET' });
            }

            // 5. IMPRIMIR (Dispara a janela do navegador UMA VEZ)
            const clientName = selectedCrediarioClient ? selectedCrediarioClient.nomeExibicao : null;

            if (format === 'a4') {
                printA4(clientName);
            } else {
                printThermal(clientName);
            }

            // 6. ATUALIZAR A TELA (Pós-Impressão)
            loadingOverlay.classList.add('hidden');
            finishSaleBtn.disabled = false;
            finishSaleBtn.innerHTML = "<i class='bx bx-check-circle'></i> Finalizar Venda (F9)";

            // LÓGICA DE NAVEGAÇÃO:
            if (selectedPaymentMethod === 'Crediário') {
                // Se for Crediário, já imprimimos no passo 5.
                // Então abrimos o modal DIRETO no Passo 2 (Validação), pulando o botão de imprimir.

                credFlowClientName.textContent = selectedCrediarioClient.nomeExibicao;

                // Esconde Passo 1 (Impressão)
                document.getElementById('cred-step-1').style.display = 'none';

                // Mostra Passo 2 (Validação)
                const step2 = document.getElementById('cred-step-2');
                step2.style.display = 'block';
                step2.style.opacity = '1';
                step2.classList.remove('locked-step');

                // Atualiza QR Code (caso use) ou apenas prepara a tela
                const qrImg = document.querySelector('#cred-step-2 .qr-img-wrapper img');
                if (qrImg) {
                    const baseUrl = "http://eletrobusiness.com.br/comprovante/buy/valid55102.html";
                    const finalUrl = `${baseUrl}?id=${selectedCrediarioClient.idCliente}`;
                    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(finalUrl)}`;
                }

                openModal(crediarioFlowModal);
            } else {
                // Se for Venda Comum, apenas mostra o Recibo de Sucesso
                openModal(receiptModal);
            }

        } catch (error) {
            console.error("Erro fatal na venda:", error);
            loadingOverlay.classList.add('hidden');
            finishSaleBtn.disabled = false;
            finishSaleBtn.innerHTML = "<i class='bx bx-check-circle'></i> Finalizar Venda (F9)";
            showCustomAlert("Erro", "Falha ao registrar. Verifique sua conexão.");
        }
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

    // Localize: paymentOptions.forEach...
    paymentOptions.forEach(option => {
        option.addEventListener('click', () => {
            const method = option.dataset.method;

            if (method === 'Crediário') {
                // VERIFICAÇÃO IMEDIATA: Tem cliente selecionado?
                if (!selectedCrediarioClient) {
                    // FLUXO CORRETO: 
                    // 1. Marca que queremos voltar pra cá depois
                    isReturningToPayment = true;
                    // 2. Fecha este modal
                    closeModal(paymentModal);
                    // 3. Abre a busca de cliente
                    // (Reseta a busca antes para ficar limpo)
                    if (clientSelectionInput) clientSelectionInput.value = '';
                    if (clientSelectionResults) {
                        clientSelectionResults.innerHTML = '';
                        clientSelectionResults.style.display = 'none';
                    }
                    if (clientSearchHint) clientSearchHint.style.display = 'block';

                    openModal(clientSelectionModal);
                    setTimeout(() => clientSelectionInput.focus(), 100);
                    return; // Para por aqui, espera o usuário selecionar
                }

                // Se JÁ TEM cliente, mostra a tela de parcelas
                showCrediarioScreen();

            } else {
                // Fluxo normal (Dinheiro, Pix, Cartão)
                selectedCrediarioClient = null;
                updateSummaryClientCard();
                handlePaymentSelection(method);
            }
        });
    });

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

    // Lógica da Navbar SPA (Atualizada)
    const updateNavbarHighlight = (activeItem) => { if (!activeItem) return; const itemRect = activeItem.getBoundingClientRect(); const navbarRect = mainNavbar.getBoundingClientRect(); navbarHighlight.style.width = `${itemRect.width}px`; navbarHighlight.style.left = `${itemRect.left - navbarRect.left}px`; };

    // --- CORREÇÃO DA NAVBAR (EVITA O ERRO RESOURCE EXHAUSTED) ---
    // --- Navegação SPA (Navbar) - CORRIGIDA ---
    navbarItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            // 1. ATUALIZAÇÃO VISUAL DA NAVBAR
            const previouslyActive = document.querySelector('.navbar-item.active');
            if (previouslyActive === item && item.dataset.page !== 'pedidos') { return; }

            navbarItems.forEach(navItem => navItem.classList.remove('active'));
            item.classList.add('active');
            updateNavbarHighlight(item);

            // 2. TROCA DE PÁGINA (VISIBILIDADE)
            // Fazemos isso ANTES de qualquer lógica específica para garantir que o elemento exista e esteja visível
            allPages.forEach(page => page.style.display = 'none');
            const pageId = item.dataset.page + '-page';
            const targetPage = document.getElementById(pageId);

            if (targetPage) targetPage.style.display = 'block';

            // 3. LÓGICA ESPECÍFICA DE CADA PÁGINA

            // --- CORREÇÃO AQUI: RESET DA ABA PEDIDOS ---
            if (item.dataset.page === 'pedidos') {
                // Limpa notificações
                item.classList.remove('notify-active');
                const badge = document.getElementById('pedidos-badge');
                if (badge) badge.classList.remove('active');

                // Reseta Filtro
                currentOrderStatusFilter = 'pendente';

                // Reseta Abas Visuais
                const orderTabs = document.querySelectorAll('#order-status-tabs .order-tab');
                orderTabs.forEach(t => t.classList.remove('active'));
                const defaultTab = document.querySelector('#order-status-tabs .order-tab[data-status="pendente"]');
                if (defaultTab) defaultTab.classList.add('active');

                // Renderiza (Agora vai funcionar pois a página já está display: block)
                renderDummyOrders();
            }

            // Carregamentos das outras páginas
            if (pageId === 'produtos-page' && !localProductCache) carregarCacheDeProdutos();
            if (pageId === 'clientes-page' && !localClientCache) carregarClientesDaAPI();
            if (pageId === 'historico-page') carregarHistorico();
        });
    });


    window.addEventListener('resize', () => { updateNavbarHighlight(document.querySelector('.navbar-item.active')); });

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

    // Listeners para Navegação Fechar Caixa
    closeCaixaNextBtn.addEventListener('click', () => navigateFecharCaixaSteps(1));
    closeCaixaPrevBtn.addEventListener('click', () => navigateFecharCaixaSteps(-1));

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
            vendaPixFixo: (parseFloat(closeCaixaPixInput.value) || 0).toFixed(2),
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
    const initialActiveNavbarItem = document.querySelector(`.navbar-item[data-page="${initialActivePage}"]`);
    if (initialActiveNavbarItem) {
        navbarItems.forEach(item => item.classList.remove('active'));
        initialActiveNavbarItem.classList.add('active');
        setTimeout(() => {
            updateNavbarHighlight(initialActiveNavbarItem);
            if (verificarToken()) {
                allPages.forEach(page => page.style.display = 'none');
                document.getElementById(initialActivePage + '-page').style.display = 'block';
            }
        }, 50);
    }

    // --- Novas Variáveis Globais ---

    // --- LÓGICA DO GERENCIADOR FIREBASE ---

    // Seletores
    const btnLoadFirebase = document.getElementById('btn-load-firebase');
    const firebaseListContainer = document.getElementById('firebase-products-list');

    // Função Auxiliar de Limpeza de Valor (igual ao seu index.js)
    function parseValueFirebase(val) {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        let str = String(val);
        str = str.replace(/[^\d,.-]/g, '');
        str = str.replace(',', '.');
        return parseFloat(str) || 0;
    }

    // Carregar Produtos
    btnLoadFirebase.addEventListener('click', async () => {
        firebaseListContainer.innerHTML = '<p style="text-align: center; padding: 20px;"><i class="bx bx-loader-alt bx-spin"></i> Conectando ao Firebase...</p>';

        try {
            // Verifica se o objeto 'db' existe (SDK Firebase carregado)
            if (typeof db === 'undefined') {
                throw new Error("SDK do Firebase não encontrado. Verifique os scripts no <head>.");
            }

            const productsRef = db.collection('artifacts').doc(FIREBASE_CONFIG_ID)
                .collection('users').doc(STORE_OWNER_UID)
                .collection('products');

            const snapshot = await productsRef.get();

            if (snapshot.empty) {
                firebaseListContainer.innerHTML = '<p style="text-align: center; padding: 20px;">Nenhum produto encontrado no banco de dados.</p>';
                return;
            }

            firebaseListContainer.innerHTML = ''; // Limpa lista

            snapshot.forEach(doc => {
                const prod = doc.data();
                const id = doc.id;
                renderFirebaseRow(id, prod);
            });

        } catch (error) {
            console.error("Erro Firebase:", error);
            firebaseListContainer.innerHTML = `<p style="text-align: center; color: var(--warning-red); padding: 20px;">Erro: ${error.message}</p>`;
        }
    });

    // Renderizar Linha
    // --- Renderizar Linha (Atualizado: Estoque + Design Novo) ---
    function renderFirebaseRow(id, prod) {
        // Dados Básicos
        const imgUrl = prod.imgUrl || 'https://placehold.co/100x100/f5f5f5/999?text=IMG';
        const name = prod.name || 'Produto sem nome';
        const currentCode = prod.code || '';
        // Pega o estoque atual (se não existir, assume 0)
        const currentStock = prod.stock !== undefined ? prod.stock : 0;

        // Cálculos de Preço
        const valNormal = parseValueFirebase(prod.price);
        const valOferta = parseValueFirebase(prod['price-oferta']);
        const hasOffer = (valOferta > 0 && valOferta < valNormal);

        let priceHtml = '';

        if (hasOffer) {
            // Cálculo da Porcentagem
            const percent = ((valNormal - valOferta) / valNormal) * 100;

            // Design: Preço preto e tag limpa "-XX%"
            priceHtml = `
            <div class="fb-old-price">${formatCurrency(valNormal)}</div>
            <div class="fb-new-price">
                ${formatCurrency(valOferta)}
                <span class="fb-discount-tag">-${Math.round(percent)}%</span>
            </div>
        `;
        } else {
            priceHtml = `<div class="fb-new-price">${formatCurrency(valNormal)}</div>`;
        }

        // Criação do Elemento HTML
        const row = document.createElement('div');
        row.className = 'firebase-item-row';

        // Estrutura Grid: Produto | Preço | Estoque | Código | Botão
        row.innerHTML = `
        <div class="fb-prod-info">
            <img src="${imgUrl}" class="fb-prod-img" alt="Prod">
            <span class="fb-prod-name">${name}</span>
        </div>
        
        <div class="fb-price-box">
            ${priceHtml}
        </div>

        <div>
            <input type="number" class="fb-input-stock" id="input-stock-${id}" value="${currentStock}" min="0" placeholder="0">
        </div>

        <div>
            <input type="text" class="fb-input-code" id="input-code-${id}" value="${currentCode}" placeholder="Digite o código...">
        </div>

        <div style="text-align: center;">
            <button class="btn btn-primary" onclick="saveFirebaseProduct('${id}')" style="width: 40px; height: 40px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" title="Salvar Alterações">
                <i class='bx bx-save'></i>
            </button>
        </div>
    `;

        firebaseListContainer.appendChild(row);
    }

    // --- Função para Salvar Código E Estoque ---
    window.saveFirebaseProduct = async (docId) => {
        // Seleciona os inputs baseados no ID do documento
        const codeInput = document.getElementById(`input-code-${docId}`);
        const stockInput = document.getElementById(`input-stock-${docId}`);
        const btn = codeInput.parentElement.nextElementSibling.querySelector('button');

        const newCode = codeInput.value.trim();
        const newStock = parseInt(stockInput.value) || 0; // Garante que é número

        // Feedback Visual (Loading)
        btn.disabled = true;
        btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i>";

        try {
            const productRef = db.collection('artifacts').doc(FIREBASE_CONFIG_ID)
                .collection('users').doc(STORE_OWNER_UID)
                .collection('products').doc(docId);

            // Atualiza Código, Estoque e Data
            await productRef.update({
                code: newCode,
                stock: newStock,
                updatedAt: new Date().toISOString()
            });

            // Sucesso
            btn.innerHTML = "<i class='bx bx-check'></i>";
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-success');

            showToastFirebase("Produto atualizado!");

            // Reseta botão após 2 segundos
            setTimeout(() => {
                btn.innerHTML = "<i class='bx bx-save'></i>";
                btn.classList.remove('btn-success');
                btn.classList.add('btn-primary');
                btn.disabled = false;
            }, 2000);

        } catch (error) {
            console.error("Erro ao salvar:", error);
            btn.innerHTML = "<i class='bx bx-error'></i>";
            btn.classList.add('btn-danger');
            alert("Erro ao salvar: " + error.message);
            btn.disabled = false;
        }
    };

    // Função Global para Salvar (chamada pelo botão HTML acima)
    window.saveBarcodeToFirebase = async (docId) => {
        const input = document.getElementById(`input-code-${docId}`);
        const btn = input.parentElement.nextElementSibling.querySelector('button');
        const newCode = input.value.trim();
        const originalIcon = btn.innerHTML;

        // Feedback Visual (Loading)
        btn.disabled = true;
        btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i>";

        try {
            const productRef = db.collection('artifacts').doc(FIREBASE_CONFIG_ID)
                .collection('users').doc(STORE_OWNER_UID)
                .collection('products').doc(docId);

            // Atualiza apenas o campo 'code' e o 'updatedAt'
            await productRef.update({
                code: newCode,
                updatedAt: new Date().toISOString()
            });

            // Sucesso
            btn.innerHTML = "<i class='bx bx-check'></i>";
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-success');

            // Toca um som ou mostra notificação (opcional)
            showToastFirebase("Código atualizado com sucesso!");

            // Reseta botão após 2 segundos
            setTimeout(() => {
                btn.innerHTML = "<i class='bx bx-save'></i>";
                btn.classList.remove('btn-success');
                btn.classList.add('btn-primary');
                btn.disabled = false;
            }, 2000);

        } catch (error) {
            console.error("Erro ao salvar:", error);
            btn.innerHTML = "<i class='bx bx-error'></i>";
            btn.classList.add('btn-danger');
            alert("Erro ao salvar no Firebase: " + error.message);
            btn.disabled = false;
        }
    };

    // Pequeno Toast para feedback (opcional, pode usar o seu showCustomAlert)
    function showToastFirebase(msg) {
        // Se você já tiver uma função de toast, use ela. Senão, cria uma simples:
        const div = document.createElement('div');
        div.style.cssText = "position:fixed; bottom:20px; right:20px; background:#333; color:#fff; padding:12px 24px; border-radius:8px; z-index:9999; animation: slideInUp 0.3s;";
        div.textContent = msg;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 3000);
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

    // --- Função Lógica de Abrir Modal de Detalhes (CORRIGIDA) ---
    // --- SUBSTITUA A FUNÇÃO openClienteDetails POR ESTA ---
    const openClienteDetails = async (id) => {
        const cliente = localClientCache.find(c => c.idCliente == id);
        if (!cliente) return;

        // 1. Preencher Dados Básicos
        document.getElementById('detail-cliente-nome').textContent = cliente.nomeCompleto || cliente.nomeExibicao;
        document.getElementById('detail-cliente-apelido').textContent = cliente.apelido ? `(${cliente.apelido})` : '';

        // Saldo Devedor
        const saldoEl = document.getElementById('detail-cliente-saldo');
        saldoEl.textContent = formatCurrency(cliente.saldoDevedor);
        saldoEl.style.color = cliente.saldoDevedor > 0 ? 'var(--warning-red)' : 'var(--success-green)';

        // --- CORREÇÃO DA DATA NO MODAL ---
        const dataObj = parseDataSegura(cliente.proximoVencimento);
        let textoVencimento = "Sem vencimento";

        if (dataObj) {
            // Formata para DD/MM/AAAA
            const dia = String(dataObj.getDate()).padStart(2, '0');
            const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
            const ano = dataObj.getFullYear();
            textoVencimento = `${dia}/${mes}/${ano}`;

            // Se estiver atrasado, pinta de vermelho
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            if (dataObj < hoje && cliente.saldoDevedor > 0.01) {
                document.getElementById('detail-cliente-vencimento').style.color = 'var(--warning-red)';
                textoVencimento += " (Atrasado)";
            } else {
                document.getElementById('detail-cliente-vencimento').style.color = 'var(--text-dark)';
            }
        }

        document.getElementById('detail-cliente-vencimento').textContent = textoVencimento;

        // Contato
        document.getElementById('detail-cliente-telefone').textContent = cliente.telefone || 'Não informado';
        document.getElementById('detail-cliente-endereco').textContent = cliente.endereco || 'Não informado';

        // 2. Lógica da Barra de Limite (Mantida igual)
        const detailLimitTotal = document.getElementById('detail-cliente-limite-total');
        const detailProgressBar = document.getElementById('detail-cliente-progress');
        const detailLimitAvailable = document.getElementById('detail-cliente-disponivel');
        const detailLimitPercent = document.getElementById('detail-cliente-percentual');

        const limite = parseFloat(cliente.limite) || 0;
        const saldo = parseFloat(cliente.saldoDevedor) || 0;

        detailLimitTotal.textContent = formatCurrency(limite);

        if (limite > 0) {
            const disponivel = limite - saldo;
            let percentualUso = (saldo / limite) * 100;
            let visualWidth = percentualUso;
            if (visualWidth < 0) visualWidth = 0;
            if (visualWidth > 100) visualWidth = 100;

            detailLimitAvailable.textContent = `Disponível: ${formatCurrency(disponivel)}`;
            detailLimitPercent.textContent = `${percentualUso.toFixed(1)}% usado`;
            detailProgressBar.style.width = `${visualWidth}%`;

            detailProgressBar.className = 'progress-fill';
            if (disponivel < 0) {
                detailProgressBar.classList.add('danger');
                detailLimitAvailable.style.color = 'var(--warning-red)';
            } else if (percentualUso > 80) {
                detailProgressBar.classList.add('warning');
                detailLimitAvailable.style.color = 'var(--text-light)';
            } else {
                detailLimitAvailable.style.color = 'var(--text-light)';
            }
        } else {
            detailProgressBar.style.width = '0%';
            detailLimitAvailable.textContent = "Sem limite definido";
            detailLimitPercent.textContent = "-";
        }

        openModal(document.getElementById('cliente-details-modal'));

        // 3. Carrega o Histórico
        const historyContainer = document.getElementById('detail-history-container');
        historyContainer.innerHTML = '<p style="text-align:center; padding:20px; color:#777;"><i class="bx bx-loader-alt bx-spin"></i> Buscando histórico...</p>';

        try {
            const response = await fetch(`${SCRIPT_URL}?action=obterHistorico&idCliente=${id}`);
            const result = await response.json();

            if (result.status === 'success' && result.data.length > 0) {
                let html = '<table class="history-table"><thead><tr><th>Data</th><th>Tipo</th><th>Valor</th><th>Anexo</th></tr></thead><tbody>';
                result.data.forEach(item => {
                    const isCompra = String(item.tipo).toLowerCase().includes('compra') && item.valor > 0;
                    const tipoClass = isCompra ? 'type-compra' : 'type-pagamento';
                    const valorColor = isCompra ? 'var(--warning-red)' : 'var(--success-green)';

                    let anexoHtml = '-';
                    if (item.anexo && item.anexo.startsWith('http')) {
                        anexoHtml = `<button class="btn-link-receipt" onclick="window.open('${item.anexo}', '_blank')" style="background:none; border:none; font-family:inherit; font-size:inherit; cursor:pointer;" title="Ver Comprovante"><i class='bx bx-show'></i> Ver</button>`;
                    }

                    html += `
                    <tr>
                        <td>${item.data}<br><small style="color:#999">${item.obs || ''}</small></td>
                        <td><span class="history-type-tag ${tipoClass}">${isCompra ? 'COMPRA' : 'PAGTO'}</span></td>
                        <td style="color:${valorColor}; font-weight:600;">${formatCurrency(Math.abs(item.valor))}</td>
                        <td>${anexoHtml}</td>
                    </tr>
                `;
                });
                html += '</tbody></table>';
                historyContainer.innerHTML = html;
            } else {
                historyContainer.innerHTML = '<p style="text-align:center; padding:20px; color:#999;">Nenhum histórico encontrado.</p>';
            }
        } catch (error) {
            console.error("Erro histórico:", error);
            historyContainer.innerHTML = '<p style="text-align:center; padding:20px; color:var(--warning-red);">Erro ao carregar.</p>';
        }
    };

    // --- Listener para o Botão Alterar Limite ---
    if (btnAlterarLimite) {
        btnAlterarLimite.addEventListener('click', () => {
            showCustomAlert(
                "Acesso Restrito",
                "Somente um administrador pode alterar o limite de crédito de forma segura no momento."
            );
        });
    }

    // --- Lógica de Abrir Modal de Pagamento ---
    const openClientePayment = (id) => {
        const cliente = localClientCache.find(c => c.idCliente == id);
        if (!cliente) return;

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
            const linkCompleto = `${baseUrl}?q=${nomeParam}`;

            const qrContainer = document.getElementById('qrcode-container');
            const linkText = document.getElementById('link-acesso-text');

            if (qrContainer) {
                qrContainer.innerHTML = "";
                qrContainer.style.display = "flex";
                new QRCode(qrContainer, { text: linkCompleto, width: 150, height: 150 });
            }

            if (linkText) {
                linkText.style.display = "block";
                linkText.innerHTML = `<a href="${linkCompleto}" target="_blank">ABRIR LINK</a>`;
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
});

// Listener de Tecla Enter no Input de Senha
const inputAuth = document.getElementById('admin-password-input');
if (inputAuth) {
    inputAuth.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') verificarSenhaAdm();
    });
}

// --- 3. CONFIRMAR RENEGOCIAÇÃO (ENVIO API) ---
const btnConfirmarReneg = document.getElementById('btn-confirmar-renegociacao');

if (btnConfirmarReneg) {
    btnConfirmarReneg.onclick = async function () {
        const novaData = document.getElementById('reneg-nova-data').value;
        const modalReneg = document.getElementById('modal-renegociar');
        const parcelasEl = document.getElementById('reneg-parcelas');
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

        const btn = this;
        const originalText = btn.innerHTML;
        btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Salvando...";
        btn.disabled = true;

        try {
            const API_URL_ADM = "https://script.google.com/macros/s/AKfycbzvd0BBLEEQlu-ksnIbsmnYcjQNQuZcTrsCmXMKHGM5g7DPEk3Nj95X47LKbj7rRSAT/exec";

            // Envia o NOME na variavel idCliente (o backend já sabe lidar com isso)
            const response = await fetch(`${API_URL_ADM}?action=renegociarSaldo&idCliente=${encodeURIComponent(nomeParaBuscar)}&novaData=${novaData}&parcelas=${qtdParcelas}`);
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
    };
}