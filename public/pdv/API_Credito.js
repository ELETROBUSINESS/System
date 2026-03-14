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
    const mesOffsetBase = parseInt(data.mes_offset) || 0; // Para migração de parcelas específicas (1/2, 2/2...)
    
    // Suporte para data manual (Migração)
    const dataCompra = data.data_manual ? new Date(data.data_manual) : new Date();

    // Busca dia de vencimento real do cliente se não informado
    let diaVencimento = parseInt(data.diaVencimento);
    if (isNaN(diaVencimento)) {
        const clientSheet = ss.getSheetByName('Clientes');
        if (clientSheet) {
            const cRows = clientSheet.getDataRange().getValues();
            for (let j = 1; j < cRows.length; j++) {
                if (String(cRows[j][1]).trim().toLowerCase() === idCliente.toLowerCase()) {
                    diaVencimento = parseInt(cRows[j][8]) || 10;
                    break;
                }
            }
        }
    }
    if (isNaN(diaVencimento)) diaVencimento = 10;

    const linhasParaInserir = [];

    for (let i = 0; i < numParcelas; i++) {
        // Calcula a data base para cada parcela
        let dataReferencia = new Date(dataCompra);
        // Aplica o offset (Ex: Se comprou em Março e é parcela 2/2, offset base é 1, dataRef vira Abril)
        dataReferencia.setMonth(dataCompra.getMonth() + i + mesOffsetBase);

        // Gera o BillingID: Este ID agora representa o MÊS DE PAGAMENTO (M+1 ou M+2)
        const billingId = gerarBillingID(idCliente, dataReferencia);

        // Sincroniza o Vencimento com o BillingID gerado
        const parts = billingId.split('-');
        const monthYear = parts[1]; // Ex: "042026"
        const targetMes = parseInt(monthYear.substring(0, 2)) - 1; // 0-indexed
        const targetAno = parseInt(monthYear.substring(2));
        
        const dataVenc = new Date(targetAno, targetMes, diaVencimento);

        const row = [
            "MOV-" + Date.now() + i,     // ID único
            dataCompra,                  // Data Real da Operação
            idCliente,
            billingId,
            'compra',
            data.descricao || `Venda Crediário`, // Agora usamos a descrição vinda do utilitário
            valorTotal / numParcelas,
            dataVenc,
            'aberta'
        ];
        linhasParaInserir.push(row);
    }

    sheet.getRange(sheet.getLastRow() + 1, 1, linhasParaInserir.length, 9).setValues(linhasParaInserir);

    // Recalcula tudo e sincroniza com a aba 'Clientes'
    if (!data.pular_saldo) {
        sincronizarDadosResumoCliente(idCliente);
    }

    const billingFinal = linhasParaInserir.length > 0 ? linhasParaInserir[0][3] : "N/A";
    return { success: true, message: `Venda registrada em ${billingFinal}` };
}

/**
 * Sistema de Pagamento em Cascata (Abate faturas mais antigas primeiro)
 */
function registrarPagamentoParcela(data) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CREDITO_SHEET_NAME);
    const idCliente = String(data.id_cliente || data.id || "").trim();
    let valorPagamento = Math.abs(parseFloat(data.valor)) || 0;

    if (!sheet) return { status: "error", message: "Aba de crédito não encontrada." };
    if (!idCliente) return { status: "error", message: "ID do cliente não informado." };

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

    // 2. Ordenar BillingIDs por vencimento Real para o cascateamento
    const ordenados = Object.values(faturasStats)
        .filter(f => f.saldoRestante > 0.01)
        .sort((a, b) => {
            const da = a.vencimento instanceof Date ? a.vencimento : new Date(a.vencimento);
            const db = b.vencimento instanceof Date ? b.vencimento : new Date(b.vencimento);
            return da - db;
        });

    // 3. Aplicar o pagamento nas faturas abertas
    for (let fatura of ordenados) {
        if (valorPagamento <= 0) break;

        const bId = Object.keys(faturasStats).find(key => faturasStats[key] === fatura);
        let valorParaEstaFatura = 0;

        if (valorPagamento >= fatura.saldoRestante - 0.01) {
            valorParaEstaFatura = fatura.saldoRestante;
            valorPagamento -= fatura.saldoRestante;
            fatura.compras.forEach(rowIdx => sheet.getRange(rowIdx, COL_CREDITO.STATUS + 1).setValue('paga'));
        } else {
            valorParaEstaFatura = valorPagamento;
            valorPagamento = 0;
            fatura.compras.forEach(rowIdx => sheet.getRange(rowIdx, COL_CREDITO.STATUS + 1).setValue('parcial'));
        }

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

    if (!data.pular_saldo) {
        sincronizarDadosResumoCliente(idCliente);
    }
    return { success: true, message: "Pagamento processado em cascata." };
}

/**
 * Consulta o extrato do cliente agrupado por BillingID (Faturas)
 */
/**
 * Consulta o extrato do cliente agrupado por BillingID (Faturas)
 */
/**
 * Helper: Gera o BillingID (Ex: 1024-042026) considerando o mês de PAGAMENTO
 */
function gerarBillingID(idCliente, dataReferencia) {
    let d = new Date(dataReferencia);
    let mes = d.getMonth() + 1; // Mês da operação
    let ano = d.getFullYear();

    // REGRA DE OURO:
    // 1. Toda compra cai no vencimento do mês seguinte (M+1)
    mes++;
    
    // 2. Se a operação ocorreu APÓS o dia de fechamento (25), pula mais um mês (M+2)
    if (d.getDate() > CLOSING_DAY) {
        mes++;
    }

    // Ajuste de virada de ano
    while (mes > 12) {
        mes -= 12;
        ano++;
    }

    return `${idCliente}-${String(mes).padStart(2, '0')}${ano}`;
}

function consultarExtratoCliente(data) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CREDITO_SHEET_NAME);
    const idAlvo = String(data.id_cliente || data.id || "").trim().toLowerCase();
    const pinEnviado = String(data.pin || "").trim();

    if (!idAlvo) return { status: "error", message: "ID do cliente não informado." };

    // 1. Buscar Dados do Cliente
    const clientSheet = ss.getSheetByName('Clientes');
    if (!clientSheet) return { status: "error", message: "Banco de clientes não encontrado." };

    const clientRows = clientSheet.getDataRange().getValues();
    let clienteEncontrado = null;

    for (let i = 1; i < clientRows.length; i++) {
        const idRow = String(clientRows[i][1]).trim().toLowerCase();
        if (idRow === idAlvo) {
            clienteEncontrado = {
                id: clientRows[i][1],
                nome: clientRows[i][2],
                telefone: clientRows[i][5],
                endereco: clientRows[i][6],
                diaVencimento: clientRows[i][8], 
                limite: clientRows[i][9],
                saldoDevedor: clientRows[i][7],
                pass: String(clientRows[i][11] || "").trim()
            };
            break;
        }
    }

    if (!clienteEncontrado) return { status: "error", message: "Cliente não encontrado." };

    const temSenha = clienteEncontrado.pass && clienteEncontrado.pass !== "0" && clienteEncontrado.pass !== "";
    clienteEncontrado.temSenha = temSenha;
    
    if (temSenha) {
        if (!pinEnviado) return { status: "auth_required", cliente: { nome: clienteEncontrado.nome, temSenha: true } };
        if (pinEnviado !== clienteEncontrado.pass) return { status: "error", message: "PIN incorreto." };
    }

    // 3. Buscar Movimentações
    if (!sheet) return { success: true, status: "success", cliente: clienteEncontrado, data: [] };

    const rows = sheet.getDataRange().getValues();
    const faturasAgrupadas = {};

    for (let i = 1; i < rows.length; i++) {
        const idCol = String(rows[i][COL_CREDITO.ID_CLIENTE]).trim().toLowerCase();
        if (idCol !== idAlvo) continue;

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

    const listaFaturas = Object.values(faturasAgrupadas).sort((a, b) => {
        const da = a.vencimento instanceof Date ? a.vencimento : new Date(a.vencimento);
        const db = b.vencimento instanceof Date ? b.vencimento : new Date(b.vencimento);
        return da - db;
    });

    return { success: true, status: "success", cliente: clienteEncontrado, data: listaFaturas };
}

/**
 * Recalcula tudo e sincroniza com a aba 'Clientes'
 */
function sincronizarDadosResumoCliente(idCliente) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const creditorSheet = ss.getSheetByName(CREDITO_SHEET_NAME);
    const clientSheet = ss.getSheetByName('Clientes');
    if (!clientSheet || !creditorSheet) return;

    const idAlvo = String(idCliente).trim().toLowerCase();
    const dataRows = creditorSheet.getDataRange().getValues();
    const faturas = {};

    // 1. Agrupar saldos por fatura (Case-insensitive)
    for (let i = 1; i < dataRows.length; i++) {
        const idCol = String(dataRows[i][COL_CREDITO.ID_CLIENTE]).trim().toLowerCase();
        if (idCol === idAlvo) {
            const bid = dataRows[i][COL_CREDITO.BILLING_ID];
            if (!faturas[bid]) faturas[bid] = { saldo: 0, vencimento: dataRows[i][COL_CREDITO.VENCIMENTO] };
            faturas[bid].saldo += parseFloat(dataRows[i][COL_CREDITO.VALOR]) || 0;
        }
    }

    // 2. Ordenar e filtrar abertas
    const abertas = Object.values(faturas)
        .filter(f => f.saldo > 0.01)
        .sort((a, b) => {
            const da = a.vencimento instanceof Date ? a.vencimento : new Date(a.vencimento);
            const db = b.vencimento instanceof Date ? b.vencimento : new Date(b.vencimento);
            return da - db;
        });

    const saldoTotal = abertas.reduce((acc, f) => acc + f.saldo, 0);
    const proxValor = abertas.length > 0 ? abertas[0].saldo : 0;
    const qtdRest = abertas.length;

    // 3. Atualizar aba Clientes (Busca o Dia Fixo na Coluna O/14)
    const cRows = clientSheet.getDataRange().getValues();
    for (let j = 1; j < cRows.length; j++) {
        if (String(cRows[j][1]).trim().toLowerCase() === idAlvo) {
            
            // Tenta pegar o dia fixo da coluna O (14). Se não houver, fallback para 10.
            const diaFixo = parseInt(cRows[j][14]) || 10;
            let proxVencFinal = "";

            if (abertas.length > 0) {
                // Pega o Mês/Ano da fatura mais antiga aberta e aplica o dia fixo
                const ref = abertas[0].vencimento instanceof Date ? abertas[0].vencimento : new Date(abertas[0].vencimento);
                proxVencFinal = new Date(ref.getFullYear(), ref.getMonth(), diaFixo);
            }

            clientSheet.getRange(j + 1, 8).setValue(saldoTotal); // Saldo
            clientSheet.getRange(j + 1, 9).setValue(proxVencFinal); // Vencimento Real Calculado
            
            if (cRows[0].length < 13) {
                 clientSheet.getRange(1, 13).setValue("Valor Proxima Parcela");
                 clientSheet.getRange(1, 14).setValue("Parcelas Restantes");
            }
            clientSheet.getRange(j + 1, 13).setValue(proxValor);
            clientSheet.getRange(j + 1, 14).setValue(qtdRest);
            break;
        }
    }
}
