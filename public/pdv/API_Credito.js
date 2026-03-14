/**
 * MÓDULO: API_Credito
 * Descrição: Inteligência dedicada ao Crediário com lógica de Faturas (BillingID)
 */

// --- CONFIGURAÇÕES DO MÓDULO ---
const CREDITO_SHEET_NAME = "Crédito"; 
const CLOSING_DAY = 25;              

// Mapeamento das colunas da aba 'Crédito'
// Definido como global para o projeto Apps Script
const COL_CREDITO = {
    ID: 0,            // UUID único da movimentação
    DATA: 1,          // Data do evento
    ID_CLIENTE: 2,    // ID do Cliente (CLI...)
    BILLING_ID: 3,    // O ID unificado (1024-032026)
    TIPO: 4,          // 'compra' ou 'pagamento'
    DESCRICAO: 5,     // Detalhes da compra ou recibo
    VALOR: 6,         // Valor flutuante
    VENCIMENTO: 7,    // Data de vencimento dessa parcela/fatura
    STATUS: 8         // 'aberta', 'paga', 'parcial'
};

/**
 * Registra uma venda no crediário criando o BillingID correto
 * @param {Object} data - Dados vindos do POST
 */
function registrarVendaCrediario(data) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(CREDITO_SHEET_NAME);

    // Cria aba de Crédito se não existir
    if (!sheet) {
        sheet = ss.insertSheet(CREDITO_SHEET_NAME);
        sheet.appendRow(['ID', 'Data', 'ID_Cliente', 'Billing_ID', 'Tipo', 'Descrição', 'Valor', 'Vencimento', 'Status']);
    }

    const idCliente = String(data.id_cliente || data.id || "").trim();
    const valorTotal = parseFloat(data.valor || data.total) || 0;
    const numParcelas = parseInt(data.parcelas) || 1;
    // Suporte para data manual (Migração)
    const dataCompra = data.data_manual ? new Date(data.data_manual) : new Date();

    if (!idCliente) return { success: false, message: "ID do cliente não informado." };

    const linhasParaInserir = [];

    for (let i = 0; i < numParcelas; i++) {
        // Calcula a data base para cada parcela (mês 0, mês 1, etc)
        let dataReferencia = new Date(dataCompra);
        dataReferencia.setMonth(dataCompra.getMonth() + i);

        // Gera o BillingID seguindo sua sugestão: ID_CLIENTE-MMYYYY
        const billingId = gerarBillingID(idCliente, dataReferencia);

        // Calcula o Vencimento (baseado no dia de vencimento fixo do cliente ou padrão dia 10)
        const diaVencimento = parseInt(data.diaVencimento) || 10;
        const dataVenc = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth(), diaVencimento);

        // Se a compra da parcela foi após o dia de fechamento, o billingId já reflete isso no gerarBillingID

        const row = [
            "MOV-" + Date.now() + i,     // ID único
            dataCompra,                  // Data do Registro
            idCliente,
            billingId,
            'compra',
            `${data.descricao || "Venda Crediário"} (${i + 1}/${numParcelas})`,
            valorTotal / numParcelas,
            dataVenc,
            'aberta'
        ];
        linhasParaInserir.push(row);
    }

    sheet.getRange(sheet.getLastRow() + 1, 1, linhasParaInserir.length, 9).setValues(linhasParaInserir);

    // Atualizar o Saldo na aba Clientes (Pula se for migração em lote)
    if (!data.pular_saldo) {
        atualizarSaldoGlobalCliente(idCliente, valorTotal);
    }

    return { success: true, message: `Venda em ${numParcelas}x registrada com BillingID.` };
}

/**
 * Sistema de Pagamento em Cascata (Abate faturas mais antigas primeiro)
 */
function registrarPagamentoParcela(data) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CREDITO_SHEET_NAME);
    const idCliente = String(data.id_cliente || data.id || "").trim();
    let valorPagamento = Math.abs(parseFloat(data.valor)) || 0;

    if (!sheet) return { success: false, message: "Aba de crédito não encontrada." };
    if (!idCliente) return { success: false, message: "ID do cliente não informado." };

    // 1. Obter todos os lançamentos do cliente para calcular o saldo real por fatura
    const rows = sheet.getDataRange().getValues();
    const faturasStats = {}; // { billingId: { saldoRestante: X, compras: [rowIndex...] } }

    for (let i = 1; i < rows.length; i++) {
        const idCol = String(rows[i][COL_CREDITO.ID_CLIENTE]).trim();
        if (idCol !== idCliente) continue;

        const bId = rows[i][COL_CREDITO.BILLING_ID];
        const tipo = String(rows[i][COL_CREDITO.TIPO]).toLowerCase();
        const valor = parseFloat(rows[i][COL_CREDITO.VALOR]) || 0;

        if (!faturasStats[bId]) faturasStats[bId] = { saldoRestante: 0, compras: [], vencimento: rows[i][COL_CREDITO.VENCIMENTO] };
        
        faturasStats[bId].saldoRestante += valor;
        if (tipo === 'compra') faturasStats[bId].compras.push(i + 1);
    }

    // 2. Ordenar BillingIDs por vencimento para o cascateamento
    const ordenados = Object.values(faturasStats)
        .filter(f => f.saldoRestante > 0.01)
        .sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento));

    // 3. Aplicar o pagamento nas faturas abertas
    for (let fatura of ordenados) {
        if (valorPagamento <= 0) break;

        const bId = Object.keys(faturasStats).find(key => faturasStats[key] === fatura);
        let valorParaEstaFatura = 0;

        if (valorPagamento >= fatura.saldoRestante - 0.01) {
            valorParaEstaFatura = fatura.saldoRestante;
            valorPagamento -= fatura.saldoRestante;
            // Marca todas as linhas de compra dessa fatura como pagas
            fatura.compras.forEach(rowIdx => sheet.getRange(rowIdx, COL_CREDITO.STATUS + 1).setValue('paga'));
        } else {
            valorParaEstaFatura = valorPagamento;
            valorPagamento = 0;
            // Marca como parcial
            fatura.compras.forEach(rowIdx => sheet.getRange(rowIdx, COL_CREDITO.STATUS + 1).setValue('parcial'));
        }

        // Registra a linha do pagamento vinculado a este BillingID (Fatura)
        const dataPagamento = data.data_manual ? new Date(data.data_manual) : new Date();
        sheet.appendRow([
            "PAY-" + Date.now(),
            dataPagamento,
            idCliente,
            bId,
            'pagamento',
            `Recebimento de Crediário`,
            -valorParaEstaFatura,
            '',
            'pago'
        ]);
    }

    // Atualizar o Saldo na aba Clientes (Pula se for migração em lote)
    if (!data.pular_saldo) {
        atualizarSaldoGlobalCliente(idCliente, -Math.abs(parseFloat(data.valor)));
    }
    return { success: true, message: "Pagamento processado em cascata." };
}

/**
 * Consulta o extrato do cliente agrupado por BillingID (Faturas)
 */
function consultarExtratoCliente(data) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CREDITO_SHEET_NAME);
    const idCliente = String(data.id_cliente || data.id || "").trim();

    if (!sheet) return { success: false, faturas: [] };
    if (!idCliente) return { success: false, message: "ID do cliente não informado." };

    const rows = sheet.getDataRange().getValues();
    const faturasAgrupadas = {};

    for (let i = 1; i < rows.length; i++) {
        const idCol = String(rows[i][COL_CREDITO.ID_CLIENTE]).trim();
        if (idCol !== idCliente) continue;

        const bId = rows[i][COL_CREDITO.BILLING_ID];
        if (!faturasAgrupadas[bId]) {
            faturasAgrupadas[bId] = {
                id: bId,
                vencimento: rows[i][COL_CREDITO.VENCIMENTO],
                total_faturado: 0,
                saldo_restante: 0,
                status: 'paga',
                itens: []
            };
        }

        const tipo = String(rows[i][COL_CREDITO.TIPO]).toLowerCase();
        const valor = parseFloat(rows[i][COL_CREDITO.VALOR]) || 0;
        const status = String(rows[i][COL_CREDITO.STATUS]).toLowerCase();

        if (tipo === 'compra') {
            faturasAgrupadas[bId].total_faturado += valor;
            faturasAgrupadas[bId].saldo_restante += valor;
            if (status !== 'paga') faturasAgrupadas[bId].status = 'aberta';
        } else if (tipo === 'pagamento') {
            // Pagamentos diminuem o saldo restante (valor já é negativo)
            faturasAgrupadas[bId].saldo_restante += valor; 
        }

        faturasAgrupadas[bId].itens.push({
            data: rows[i][COL_CREDITO.DATA],
            tipo: tipo,
            desc: rows[i][COL_CREDITO.DESCRICAO],
            valor: valor,
            status: status
        });
    }

    // Converte objeto para array e ordena por vencimento
    const listaFaturas = Object.values(faturasAgrupadas).sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento));

    return { success: true, data: listaFaturas };
}

/**
 * Helper: Gera o BillingID (Ex: 1024-032026) considerando o dia de fechamento
 */
function gerarBillingID(idCliente, dataReferencia) {
    let mes = dataReferencia.getMonth() + 1;
    let ano = dataReferencia.getFullYear();

    // Lógica de fechamento: se comprou após o CLOSING_DAY, cai no billing do mês seguinte
    if (dataReferencia.getDate() > CLOSING_DAY) {
        mes++;
        if (mes > 12) { mes = 1; ano++; }
    }

    return `${idCliente}-${String(mes).padStart(2, '0')}${ano}`;
}

/**
 * Atualiza o saldo na aba 'Clientes' da API principal
 */
function atualizarSaldoGlobalCliente(idCliente, variacao) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // CLIENTES_SHEET_NAME e COL_CLIENTE são esperadas estar no escopo global (Main.gs / API26.gs)
    const sheet = ss.getSheetByName(CLIENTES_SHEET_NAME || 'Clientes'); 
    if (!sheet) return;

    const rows = sheet.getDataRange().getValues();
    // COL_CLIENTE.ID e COL_CLIENTE.SALDO são índices (0-based)
    const idIdx = (typeof COL_CLIENTE !== 'undefined') ? COL_CLIENTE.ID : 1;
    const saldoIdx = (typeof COL_CLIENTE !== 'undefined') ? COL_CLIENTE.SALDO : 7;

    for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][idIdx]).trim() === String(idCliente).trim()) {
            const saldoAtual = parseFloat(rows[i][saldoIdx]) || 0;
            sheet.getRange(i + 1, saldoIdx + 1).setValue(saldoAtual + variacao);
            break;
        }
    }
}
