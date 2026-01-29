import { db } from './firebase-config.js';

// Configuration from PDV script
const FIREBASE_CONFIG_ID = 'floralchic-loja';
const STORE_OWNER_UID = "3zYT9Y6hXWeJSuvmEYP4FMZa5gI2";
// Legacy Scripts
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzB7dluoiNyJ4XK6oDK_iyuKZfwPTAJa4ua4RetQsUX9cMObgE-k_tFGI82HxW_OyMf/exec";
const REGISTRO_VENDA_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxCCaxdYdC6J_QKsaoWTDquH915MHUnM9BykD39ZUujR2LB3lx9d9n5vAsHdJZJByaa7w/exec";

// Constants
let localClientCache = null;
let currentSelectedClientId = null;

// DOM Elements
const clientsTableBody = document.getElementById('clients-table-body');
const searchInput = document.getElementById('client-search-input');
const detailsModal = document.getElementById('cliente-details-modal');
const choiceModal = document.getElementById('transaction-choice-modal');
const payModal = document.getElementById('cliente-pay-modal');
const purchaseModal = document.getElementById('cliente-purchase-modal');

// Helpers
const formatCurrency = (val) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatTimestamp = (date) => {
    const d = date;
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`;
};

// --- API Functions ---

async function fetchClients() {
    clientsTableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4"><i class="bx bx-loader-alt bx-spin"></i> Carregando clientes...</td></tr>';
    try {
        const response = await fetch(`${SCRIPT_URL}?action=listarClientes`);
        const result = await response.json();
        if (result.status === 'success') {
            localClientCache = result.data;
            renderClients();
            updateKPIs(result.data);
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error("Erro ao carregar clientes:", error);
        clientsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-red-500 p-4">Erro: ${error.message}</td></tr>`;
    }
}

async function registrarPagamentoAPI(cliente, valor, metodo) {
    const now = new Date();
    const timestamp = formatTimestamp(now);
    const descricao = `Crediário ${cliente.nomeExibicao}`;

    // 1. Post to Cash Flow (Venda)
    const vendaData = {
        formType: 'venda', seller: 'nubia', type: 'entrada',
        value: valor.toFixed(2), desconto: '0.00',
        Timestamp: timestamp, payment: metodo, total: valor.toFixed(2),
        description: descricao, obs: `Recebimento ID: ${cliente.idCliente}`
    };

    // 2. Get to Debt (Abatimento)
    const paramsCliente = new URLSearchParams({
        action: 'registrarTransacao',
        idCliente: cliente.idCliente,
        tipo: 'Pagamento',
        valor: (valor * -1).toFixed(2), // Negative
        timestamp: timestamp
    });

    const [resVenda, resCliente] = await Promise.all([
        fetch(REGISTRO_VENDA_SCRIPT_URL, {
            method: "POST",
            body: new URLSearchParams(vendaData),
            headers: { "Content-Type": "application/x-www-form-urlencoded" }
        }),
        fetch(`${SCRIPT_URL}?${paramsCliente.toString()}`)
    ]);

    if (!resVenda.ok) throw new Error("Erro no Fluxo de Caixa");
    if (!resCliente.ok) throw new Error("Erro no Abatimento");

    return true;
}

async function registrarCompraAPI(cliente, valor, desc) {
    // Single GET to Debt (Increment)
    const params = new URLSearchParams({
        action: 'registrarTransacao',
        idCliente: cliente.idCliente,
        valor: valor.toFixed(2),
        tipo: 'Compra',
        parcelas: 1,
        isEntrada: 'false',
        obs: desc || 'Compra Manual' // If backend supports obs
    });

    const response = await fetch(`${SCRIPT_URL}?${params.toString()}`);
    if (!response.ok) throw new Error("Erro na API");

    // We can assume success if status 200, or check JSON
    // const json = await response.json(); 
    return true;
}

// --- Render & UI ---

function renderClients() {
    const term = searchInput.value.toLowerCase();
    const filtered = localClientCache ? localClientCache.filter(c =>
        (c.nomeExibicao && c.nomeExibicao.toLowerCase().includes(term)) ||
        (c.apelido && c.apelido.toLowerCase().includes(term)) ||
        (c.cpf && c.cpf.includes(term))
    ) : [];

    if (filtered.length === 0) {
        clientsTableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-gray-500">Nenhum cliente encontrado.</td></tr>';
        return;
    }

    clientsTableBody.innerHTML = filtered.map(c => {
        const saldo = parseFloat(c.saldoDevedor) || 0;
        const color = saldo > 0.01 ? 'text-red-500 font-bold' : 'text-green-500 font-bold';

        // Mobile row structure handled by CSS, we just output standard table here
        return `
        <tr class="hover:bg-gray-50 cursor-pointer" onclick="openDetails('${c.idCliente}')">
            <td class="client-name-cell">
                <span class="font-bold text-gray-800">${c.nomeExibicao}</span>
                ${c.apelido ? `<small>${c.apelido}</small>` : ''}
            </td>
            <td>        
                <span class="mobile-label md:hidden">Status:</span>
                ${getStatusBadge(saldo, c.proximoVencimento)}
            </td>
            <td>
                <span class="mobile-label md:hidden">Dívida:</span>
                <span class="${color}">${formatCurrency(saldo)}</span>
            </td>
            <td>
                <span class="mobile-label md:hidden">Vencimento:</span>
                ${c.proximoVencimento || '-'}
            </td>
            <td class="text-right">
                <button class="btn-icon-sm" onclick="event.stopPropagation(); openDetails('${c.idCliente}')"><i class='bx bx-chevron-right'></i></button>
            </td>
        </tr>
    `}).join('');
}

function getStatusBadge(saldo, vencimentoStr) {
    if (saldo <= 0.01) return '<span class="px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-bold">Quitado</span>';

    // Parse date if robust needed, here simple check
    if (!vencimentoStr) return '<span class="px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs">Sem Data</span>';

    return '<span class="px-2 py-1 rounded bg-red-50 text-red-600 text-xs font-bold">Aberto</span>'; // Simplified logic
}

function updateKPIs(data) {
    const totalReceivable = data.reduce((acc, c) => acc + (parseFloat(c.saldoDevedor) || 0), 0);
    const clientsCount = data.length;

    document.getElementById('total-receivable').textContent = formatCurrency(totalReceivable);
    document.getElementById('kpi-cred-val').textContent = formatCurrency(totalReceivable);
    document.getElementById('kpi-clients-count').textContent = clientsCount;
    // Overdue logic removed for simplicity or need date parsing
}

// --- Modal Actions ---

window.openDetails = (id) => {
    currentSelectedClientId = id;
    const client = localClientCache.find(c => c.idCliente == id);
    if (!client) return;

    document.getElementById('detail-cliente-nome').textContent = client.nomeExibicao;
    document.getElementById('detail-cliente-apelido').textContent = client.apelido || '';
    document.getElementById('detail-cliente-saldo').textContent = formatCurrency(client.saldoDevedor);
    document.getElementById('detail-cliente-vencimento').textContent = client.proximoVencimento || '--/--/--';

    // Open Modal
    detailsModal.classList.add('active');
};

function closeModalLogic(modal) {
    modal.classList.remove('active');
}

// --- Event Listeners ---

// Global Close Modal
document.querySelectorAll('.close-modal-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const targetId = btn.getAttribute('data-target');
        document.getElementById(targetId).classList.remove('active');
    });
});

// Search
searchInput.addEventListener('input', renderClients);

// WhatsApp Button
document.getElementById('btn-whatsapp').addEventListener('click', () => {
    if (!currentSelectedClientId) return;
    const client = localClientCache.find(c => c.idCliente == currentSelectedClientId);

    if (client && client.telefone) {
        let phone = client.telefone.replace(/\D/g, '');
        if (phone.length < 10) { alert('Telefone inválido'); return; }
        if (!phone.startsWith('55')) phone = '55' + phone;
        window.open(`https://wa.me/${phone}`, '_blank');
    } else {
        alert("Cliente sem telefone cadastrado.");
    }
});

// New Transaction Button (Opens Choice)
document.getElementById('btn-new-transaction').addEventListener('click', () => {
    detailsModal.classList.remove('active'); // Close details to focus on action
    choiceModal.classList.add('active');
});

// Choice: Payment
document.getElementById('choice-btn-pay').addEventListener('click', () => {
    choiceModal.classList.remove('active');
    payModal.classList.add('active');
});

// Choice: Purchase
document.getElementById('choice-btn-purchase').addEventListener('click', () => {
    choiceModal.classList.remove('active');
    purchaseModal.classList.add('active');
});

// Submit Payment
document.getElementById('cliente-pay-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const valor = parseFloat(document.getElementById('pay-valor').value);
    const metodo = document.getElementById('pay-metodo').value;
    const btn = e.target.querySelector('button[type="submit"]');

    if (isNaN(valor) || valor <= 0) return alert("Valor inválido");

    const client = localClientCache.find(c => c.idCliente == currentSelectedClientId);
    if (!client) return;

    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Processando...';

    try {
        await registrarPagamentoAPI(client, valor, metodo);
        alert("Pagamento Registrado!");
        closeModalLogic(payModal);
        await fetchClients(); // Reload data
    } catch (err) {
        alert(err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
});

// Submit Purchase
document.getElementById('cliente-purchase-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const valor = parseFloat(document.getElementById('purchase-valor').value);
    const desc = document.getElementById('purchase-desc').value;
    const btn = e.target.querySelector('button[type="submit"]');

    if (isNaN(valor) || valor <= 0) return alert("Valor inválido");

    const client = localClientCache.find(c => c.idCliente == currentSelectedClientId);
    if (!client) return;

    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Salvando...';

    try {
        await registrarCompraAPI(client, valor, desc);
        alert("Compra Registrada!");
        closeModalLogic(purchaseModal);
        await fetchClients(); // Reload data
    } catch (err) {
        alert(err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
});


// Init
fetchClients();
