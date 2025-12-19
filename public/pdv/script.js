

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

    // --- Função Renderizar Carrinho (Versão Limpa - Apenas API Apps Script) ---
    const renderCart = () => {
        cartItemsBody.innerHTML = '';

        // 1. Resetar controles globais (sempre permitidos agora)
        if (cart.length > 0) {
            discountInputR.disabled = false;
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
            updateSummary(); // Zera os totais
            return; // Encerra aqui se estiver vazio
        }

        // 2. Loop para desenhar os itens
        cart.forEach(item => {
            const tr = document.createElement('tr');
            tr.dataset.id = item.id;

            // Animação visual de item novo (opcional, mantido para UX)
            if (item.isNew) {
                tr.classList.add('new-item-flash');
                delete item.isNew;
                setTimeout(() => tr.classList.remove('new-item-flash'), 500);
            }

            // HTML do Input de Desconto (Padronizado para todos os itens)
            const discountInputHtml = `
                <div class="discount-wrapper" onclick="this.querySelector('input').focus()">
                    <input type="number" 
                           class="discount-input" 
                           value="${item.discountPercent}" 
                           min="0" 
                           max="100" 
                           placeholder="0"
                           onchange="updateCartItem('${item.id}', 'discountPercent', this.value)"
                           onkeypress="return event.charCode >= 48 && event.charCode <= 57"> 
                    <span class="discount-symbol">%</span>
                </div>`;

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
                            <button class="qty-btn" data-action="decrease" data-id="${item.id}"><i class='bx bx-minus'></i></button>
                            <span class="qty-display">${item.quantity}</span>
                            <button class="qty-btn" data-action="increase" data-id="${item.id}"><i class='bx bx-plus'></i></button>
                        </div>
                    </td>
                    <td class="item-price">${formatCurrency(item.originalPrice)}</td>
                    
                    <td class="item-offer">${discountInputHtml}</td>
                    
                    <td class="item-total">${formatCurrency(item.price * item.quantity)}</td>
                    
                    <td><button class="remove-btn" data-id="${item.id}" title="Remover"><i class='bx bx-trash'></i></button></td>
                `;
            cartItemsBody.appendChild(tr);
        });

        // 3. Atualiza os totais gerais
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
        // 1. Subtotal Bruto (Soma dos preços cheios originais)
        const subtotalGross = cart.reduce((acc, item) => acc + (item.originalPrice * item.quantity), 0);

        // 2. Total Líquido (Soma dos preços reais com desconto aplicado nos itens)
        const totalNetItems = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

        // 3. Desconto Total (Diferença entre Bruto e Líquido + Desconto Global se houver)
        // Nota: Se houver itens Firebase, 'discount' global será 0 pela lógica do renderCart
        const totalDiscount = (subtotalGross - totalNetItems) + discount;

        // 4. Total Final a Pagar
        const finalTotal = subtotalGross - totalDiscount;
        updateTaxEstimate(finalTotal);

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

        document.getElementById('count-all').textContent = total;
        document.getElementById('count-ok').textContent = ok;
        document.getElementById('count-pending').textContent = pending;
    };

    // 1. Função Renderizar (COM PAGINAÇÃO)
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
        const produtosFiltrados = localProductCache.filter(p => {
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

            return true;
        });

        if (produtosFiltrados.length === 0) {
            container.innerHTML = `
            <div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-light);">
                <i class='bx bx-search-alt' style="font-size: 3rem; margin-bottom: 10px;"></i>
                <p>Nada encontrado para "${term}".</p>
            </div>`;
            return;
        }

        // 2. Lógica de Paginação
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
                <th width="45%">Produto / Marca</th>
                <th width="15%">Preço</th>
                <th width="25%">Situação Fiscal</th>
                <th width="10%" class="text-center">Ações</th>
            </tr>
        </thead>
        <tbody></tbody>
        `;

        const tbody = table.querySelector('tbody');

        // Renderiza os produtos da página atual
        produtosDaPagina.forEach(prod => {
            const tr = document.createElement('tr');

            const isFiscalOk = (prod.ncm && prod.cfop);
            const statusHtml = isFiscalOk
                ? `<span class="fiscal-status ok" title="NCM: ${prod.ncm}"><i class='bx bx-check'></i> OK</span>`
                : `<span class="fiscal-status pending"><i class='bx bx-error'></i> Pendente</span>`;

            const imgHtml = prod.imgUrl && prod.imgUrl.length > 10
                ? `<img src="${prod.imgUrl}" class="product-thumb-sm" alt="Foto">`
                : `<div class="product-thumb-placeholder"><i class='bx bx-box'></i></div>`;

            const brandHtml = prod.brand ? `<span class="brand-tag">${prod.brand}</span>` : '';

            tr.innerHTML = `
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
                    div.innerHTML = `<span>${partes[2]}</span> <strong>x${partes[1]}</strong>`;
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
    window.carregarCacheDeProdutos = async () => {
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

        // 1. Dispara o carregamento de Produtos (se não tiver)
        if (localProductCache === null) {
            carregarCacheDeProdutos();
        }

        // 2. Dispara o carregamento de Clientes (AGORA SEMPRE, independentemente da aba)
        if (localClientCache === null) {
            console.log("Pré-carregando clientes...");
            carregarClientesDaAPI();
        }

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
    function printA4(nomeClienteParams = null) {
        console.log("Gerando A4...");

        let itensParaImprimir = cart;
        let dadosFinanceiros = null;

        // --- CORREÇÃO PRINCIPAL ---
        // Verifica se os itens no carrinho são "fakes" do histórico (preço zerado)
        // Se todos forem zero, significa que é uma reimpressão e NÃO devemos recalcular.
        const isHistoricoSimulado = cart.length > 0 && cart.every(i => i.price === 0);

        if (cart.length > 0 && !isHistoricoSimulado) {
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

        // LÓGICA ALTERADA: Se for Crediário, pula a pergunta e imprime A4 direto
        if (selectedPaymentMethod === 'Crediário') {
            if (!selectedCrediarioClient) {
                showCustomAlert("Atenção", "Selecione o cliente para o Crediário.");
                openModal(clientSelectionModal);
                return;
            }

            // Chama direto a função de processamento com o formato A4
            processFinalSale('a4');
            return;
        }

        // Para os outros métodos (Dinheiro, PIX, Cartão), continua perguntando
        openModal(document.getElementById('print-selection-modal'));
    });

    let isReturningToPayment = false; // Controle de fluxo

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
            // LÓGICA DE NAVEGAÇÃO:
            if (selectedPaymentMethod === 'Crediário') {
                // Configura o nome do cliente
                credFlowClientName.textContent = selectedCrediarioClient.nomeExibicao;

                // Esconde Passo 1 (Impressão)
                document.getElementById('cred-step-1').style.display = 'none';

                // Mostra Passo 2 (Validação e QR Code)
                const step2 = document.getElementById('cred-step-2');
                step2.style.display = 'flex';
                step2.style.opacity = '1';
                step2.classList.remove('locked-step');

                // --- LÓGICA DO QR CODE ATUALIZADA ---
                const qrImg = document.getElementById('cred-qrcode-img');

                if (qrImg && selectedCrediarioClient) {
                    // 1. Define a URL base para o valid55102.html
                    // window.location.href pega o endereço atual do navegador para garantir que funcione em qualquer domínio
                    const currentPath = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
                    const baseUrl = `${currentPath}/valid55102.html`;

                    // 2. Adiciona o ID do cliente (idCliente) na URL
                    // Isso permite que o valid55102.html saiba quem é o cliente
                    const finalUrl = `${baseUrl}?id=${selectedCrediarioClient.idCliente}`;

                    console.log("QR Code gerado para:", finalUrl); // Log para conferência

                    // 3. Gera a imagem visual do QR Code apontando para essa URL
                    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=5&data=${encodeURIComponent(finalUrl)}`;
                }
                // ------------------------------------

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
    // --- NOVO SISTEMA DE NAVEGAÇÃO OTIMIZADO ---

    // Certifique-se de que estas linhas estão no topo do seu escopo de UI
    const moreMenuBtn = document.getElementById('more-menu-btn');
    const moreMenuModal = document.getElementById('more-menu-modal');
    const moreMenuIcon = document.getElementById('more-menu-icon'); // Verifique esta linha

    // 1. Lógica do Dropdown (Abre/Fecha) corrigida
    if (moreMenuBtn && moreMenuModal) {
        moreMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isShowing = moreMenuModal.classList.toggle('show');

            // O uso de ?. evita o erro se o ícone for nulo
            if (moreMenuIcon) {
                moreMenuIcon.style.transform = isShowing ? 'rotate(180deg)' : 'rotate(0deg)';
            }
        });
    }

    // Fechar ao clicar em qualquer lugar da tela
    document.addEventListener('click', () => {
        moreMenuModal.classList.remove('show');
        moreMenuIcon.style.transform = 'rotate(0deg)';
    });

    // 2. Lógica de Troca de Páginas (Unificada)
    // Selecionamos todos os itens da navbar E os itens de dentro do modal
    const allNavTriggers = document.querySelectorAll('.navbar-item:not(#more-menu-btn), .more-menu-item');

    allNavTriggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            const page = trigger.dataset.page;
            if (!page) return;

            // --- Limpeza Visual ---
            // Remove 'active' de todos os itens principais
            document.querySelectorAll('.navbar-item').forEach(el => el.classList.remove('active', 'active-parent'));
            // Remove 'active' de itens do modal
            document.querySelectorAll('.more-menu-item').forEach(el => el.classList.remove('active'));

            // --- Lógica de Destaque ---
            if (trigger.classList.contains('more-menu-item')) {
                // Se clicou no modal, ativa o item e destaca o pai (Gerenciamento)
                trigger.classList.add('active');
                moreMenuBtn.classList.add('active-parent');
                updateNavbarHighlight(moreMenuBtn); // A linha vermelha corre para o botão "Gerenciamento"
            } else {
                // Se clicou na navbar principal
                trigger.classList.add('active');
                updateNavbarHighlight(trigger);
            }

            // --- Troca de Conteúdo (Sua lógica original) ---
            const pageId = page + '-page';
            const targetPage = document.getElementById(pageId);

            if (targetPage) {
                allPages.forEach(p => p.style.display = 'none');
                targetPage.style.display = 'block';
            }

            // --- Gatilhos de Carregamento (Sua lógica original) ---
            if (page === 'pedidos') {
                // Reseta abas de pedidos... (seu código atual)
                renderDummyOrders();
            }
            if (pageId === 'produtos-page' && !localProductCache) carregarCacheDeProdutos();
            if (pageId === 'clientes-page' && !localClientCache) carregarClientesDaAPI();
            if (pageId === 'historico-page') carregarHistorico();

            // Fecha o modal após o clique
            moreMenuModal.classList.remove('show');
            moreMenuIcon.style.transform = 'rotate(0deg)';
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
        document.getElementById('detail-cliente-apelido').textContent = cliente.apelido ? `(${cliente.apelido})` : '';

        const saldoEl = document.getElementById('detail-cliente-saldo');
        saldoEl.textContent = formatCurrency(cliente.saldoDevedor);
        saldoEl.style.color = cliente.saldoDevedor > 0 ? 'var(--warning-red)' : 'var(--success-green)';

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

            // Alerta visual de atraso
            if (diffDays < 0 && cliente.saldoDevedor > 0.01) {
                vencimentoEl.style.color = 'var(--warning-red)';
                textoVencimento += " (Atrasado)";
            } else {
                vencimentoEl.style.color = 'var(--text-dark)';
            }
        }
        vencimentoEl.textContent = textoVencimento;

        document.getElementById('detail-cliente-telefone').textContent = cliente.telefone || 'Não informado';
        document.getElementById('detail-cliente-endereco').textContent = cliente.endereco || 'Não informado';

        // 3. Lógica da Barra de Limite
        const limite = parseFloat(cliente.limite) || 0;
        const saldo = parseFloat(cliente.saldoDevedor) || 0;
        const detailLimitTotal = document.getElementById('detail-cliente-limite-total');
        const detailProgressBar = document.getElementById('detail-cliente-progress');
        const detailLimitAvailable = document.getElementById('detail-cliente-disponivel');
        const detailLimitPercent = document.getElementById('detail-cliente-percentual');

        detailLimitTotal.textContent = formatCurrency(limite);

        if (limite > 0) {
            const disponivel = limite - saldo;
            let percentualUso = (saldo / limite) * 100;
            let visualWidth = percentualUso > 100 ? 100 : (percentualUso < 0 ? 0 : percentualUso);

            detailLimitAvailable.textContent = `Disponível: ${formatCurrency(disponivel)}`;
            detailLimitPercent.textContent = `${percentualUso.toFixed(1)}% usado`;
            detailProgressBar.style.width = `${visualWidth}%`;

            detailProgressBar.className = 'progress-fill';
            if (disponivel < 0) {
                detailProgressBar.classList.add('danger');
                detailLimitAvailable.style.color = 'var(--warning-red)';
            } else if (percentualUso > 80) {
                detailProgressBar.classList.add('warning');
            }
        } else {
            detailProgressBar.style.width = '0%';
            detailLimitAvailable.textContent = "Sem limite definido";
            detailLimitPercent.textContent = "-";
        }

        // Exibe o modal
        openModal(document.getElementById('cliente-details-modal'));

        // 4. Carregar Histórico com Nova Lógica de Classificação (Renegociação)
        const historyContainer = document.getElementById('detail-history-container');
        historyContainer.innerHTML = '<p style="text-align:center; padding:20px;"><i class="bx bx-loader-alt bx-spin"></i> Carregando extrato...</p>';

        try {
            const response = await fetch(`${SCRIPT_URL}?action=obterHistorico&idCliente=${id}`);
            const result = await response.json();

            if (result.status === 'success' && result.data.length > 0) {
                let html = '<table class="history-table"><thead><tr><th>Data</th><th>Tipo</th><th>Valor</th><th>Doc</th></tr></thead><tbody>';

                result.data.forEach(item => {
                    const tipoLower = String(item.tipo).toLowerCase();
                    let tipoTexto = 'PAGTO';
                    let tipoClass = 'type-pagamento';
                    let valorColor = 'var(--success-green)';

                    // --- NOVA LÓGICA DE CLASSIFICAÇÃO ---
                    if (tipoLower.includes('compra')) {
                        tipoTexto = 'COMPRA';
                        tipoClass = 'type-compra';
                        valorColor = 'var(--warning-red)';
                    } else if (tipoLower.includes('renegociação (baixa)')) {
                        tipoTexto = 'RENEG. BAIXA';
                        tipoClass = 'type-reneg-baixa'; // Azul/Informativo
                        valorColor = '#2196F3';
                    } else if (tipoLower.includes('renegociação (nova)')) {
                        tipoTexto = 'PARCELA';
                        tipoClass = 'type-reneg-nova'; // Laranja/Dívida
                        valorColor = 'var(--warning-red)';
                    }

                    let anexoHtml = '-';
                    if (item.anexo && item.anexo.startsWith('http')) {
                        anexoHtml = `<button class="btn-link-receipt" onclick="window.open('${item.anexo}', '_blank')"><i class='bx bx-show'></i></button>`;
                    }

                    html += `
                <tr>
                    <td>${item.data}<br><small style="color:#999">${item.obs || ''}</small></td>
                    <td><span class="history-type-tag ${tipoClass}">${tipoTexto}</span></td>
                    <td style="color:${valorColor}; font-weight:600;">${formatCurrency(Math.abs(item.valor))}</td>
                    <td>${anexoHtml}</td>
                </tr>`;
                });
                html += '</tbody></table>';
                historyContainer.innerHTML = html;
            } else {
                historyContainer.innerHTML = '<p style="text-align:center; padding:20px; color:#999;">Nenhuma movimentação encontrada.</p>';
            }
        } catch (error) {
            console.error("Erro no histórico:", error);
            historyContainer.innerHTML = '<p style="text-align:center; padding:20px; color:red;">Erro ao carregar dados.</p>';
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