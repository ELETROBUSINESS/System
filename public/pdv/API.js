// ==========================================
// CONFIGURAÇÕES GERAIS
// ==========================================
const SHEET_NAME = 'Movimentações';

const COL = {
    LOJA: 0,
    TIPO: 3,
    ID: 4,
    PAGAMENTO: 5,
    TOTAL: 9,
    TIMESTAMP: 11
};

// ==========================================
// PONTO DE ENTRADA DA API (POST)
// ==========================================
function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);
        let response;

        if (data.action === 'calcular') {
            response = calcularDashboard(data);
        } else {
            response = salvarNoBanco(data);
        }

        return ContentService.createTextOutput(JSON.stringify(response))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: "Erro no servidor: " + error.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}

// ==========================================
// FUNÇÃO 1: SALVAR DADOS
// ==========================================
function salvarNoBanco(data) {
    const sheet = getDatabaseSheet();
    const timestamp = new Date();
    const idVenda = data.id || "";

    // Normaliza o tipo para salvar sempre minúsculo (ajuda na busca depois)
    const tipoSalvo = data.tipo ? data.tipo.toLowerCase() : "";

    const novaLinha = [
        data.loja,
        data.operador,
        data.cargo,
        tipoSalvo,
        idVenda,
        data.pagamento,
        data.valor,
        data.desconto,
        data.taxas,
        data.total,
        data.descricao,
        timestamp
    ];

    try {
        sheet.appendRow(novaLinha);
        return { success: true, message: "Dados salvos com sucesso!" };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

// ==========================================
// FUNÇÃO 2: SISTEMA DE CÁLCULO (DASHBOARD)
// ==========================================
function calcularDashboard(data) {
    const sheet = getDatabaseSheet();
    const rows = sheet.getDataRange().getValues();
    const dataRows = rows.slice(1);

    const lojaAlvo = data.loja;
    const periodo = data.periodo || 'dia';

    let saldo = 0;
    let faturamento = 0;
    let aReceber = 0;
    let clientesAtendidos = 0;
    let descontos = 0;
    let taxas = 0;
    let entradasDinheiro = 0;
    let saidasDinheiro = 0;
    let vendasMaquininha = 0;
    let vendasDinheiro = 0;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const msDiasPendentes = getDiasPendentes(hoje).map(d => d.getTime());

    dataRows.forEach(row => {
        // 1. Filtro de Loja
        if (String(row[COL.LOJA]).trim() != lojaAlvo) return;

        // 2. Normalização da Data
        const dataRow = normalizarData(row[COL.TIMESTAMP]);
        if (!dataRow) return;

        // 3. Normalização de Texto
        const tipo = String(row[COL.TIPO]).toLowerCase().trim();
        const pagto = String(row[COL.PAGAMENTO]).toLowerCase().trim();
        const descRow = parseFloat(row[7]) || 0;
        const taxaRow = parseFloat(row[8]) || 0;
        const total = parseFloat(row[COL.TOTAL]) || 0;

        // Identifica se é Crediário
        const isCrediario = pagto.includes('crediário') || pagto.includes('crediario');

        // Verifica pendência
        const isPendente = msDiasPendentes.includes(dataRow.getTime());

        // --- LÓGICA DE SALDO (Dinheiro em Caixa) ---

        // CASO 1: Saídas ou Ajustes Negativos (Retira do Saldo)
        if (tipo === 'saída' || tipo === 'saida' || tipo === 'ajuste-') {
            saldo -= total;
            if (pagto === 'dinheiro' && estaNoPeriodo(dataRow, hoje, 'dia')) {
                saidasDinheiro += total;
            }
        }
        // CASO 2: Ajustes Positivos (Soma no Saldo, mas não é venda)
        else if (tipo === 'ajuste+') {
            saldo += total;
            if (pagto === 'dinheiro' && estaNoPeriodo(dataRow, hoje, 'dia')) {
                entradasDinheiro += total;
            }
        }
        // CASO 3: Entradas de Vendas (Dinheiro ou Cartão Maturado)
        else if (tipo === 'entrada') {
            // Dinheiro ou Pix QR
            if (pagto === 'dinheiro' || pagto === 'pixqr') {
                saldo += total;
                if (pagto === 'dinheiro' && estaNoPeriodo(dataRow, hoje, 'dia')) {
                    entradasDinheiro += total;
                }
            }
            // Se for Cartão e já caiu na conta (Maturado) e NÃO for Crediário
            else if (isMetodoRecebivel(pagto) && !isPendente && !isCrediario) {
                saldo += total;
            }
        }

        // --- FILTRO DE PERÍODO (Para Faturamento e Clientes) ---
        if (estaNoPeriodo(dataRow, hoje, periodo)) {
            // SÓ SOMA IF FOR "ENTRADA" REAL (Ajustes são ignorados aqui)
            if (tipo === 'entrada' && !isCrediario) {
                faturamento += total;
                descontos += descRow;
                taxas += taxaRow;
                clientesAtendidos++;

                // Audit por pagamento (Sempre baseado no dia no relatório de fechamento)
                if (estaNoPeriodo(dataRow, hoje, 'dia')) {
                    if (pagto === 'dinheiro') {
                        vendasDinheiro += total;
                    } else if (!isCrediario) {
                        // Tudo que não é dinheiro e não é crediário vai para Maquininha (Pix, Cartões, etc)
                        vendasMaquininha += total;
                    }
                }
            }
        }

        // --- LÓGICA DE A RECEBER ---
        // Apenas Entradas reais entram aqui (Ajustes são ignorados)
        if (tipo === 'entrada' && isMetodoRecebivel(pagto) && isPendente && !isCrediario) {
            aReceber += total;
        }
    });

    return {
        success: true,
        loja: lojaAlvo,
        periodo: periodo,
        resultados: {
            saldo: parseFloat(saldo.toFixed(2)),
            faturamento: parseFloat(faturamento.toFixed(2)),
            aReceber: parseFloat(aReceber.toFixed(2)),
            clientesAtendidos: clientesAtendidos,
            descontos: parseFloat(descontos.toFixed(2)),
            taxas: parseFloat(taxas.toFixed(2)),
            lucroOperacional: parseFloat((faturamento - taxas).toFixed(2)),
            vendasMaquininha: parseFloat(vendasMaquininha.toFixed(2)),
            vendasDinheiro: parseFloat(vendasDinheiro.toFixed(2)),
            detalheDinheiro: {
                entradas: parseFloat(entradasDinheiro.toFixed(2)),
                saidas: parseFloat(saidasDinheiro.toFixed(2)),
                balanco: parseFloat((entradasDinheiro - saidasDinheiro).toFixed(2))
            }
        }
    };
}

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

function getDatabaseSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    return ss.getSheetByName(SHEET_NAME);
}

function normalizarData(valorCelula) {
    if (!valorCelula) return null;
    let dataFinal;

    if (typeof valorCelula.getMonth === 'function') {
        dataFinal = new Date(valorCelula);
    }
    else if (typeof valorCelula === 'string') {
        const parteData = valorCelula.split(' ')[0];
        const partes = parteData.split('/');
        if (partes.length === 3) {
            dataFinal = new Date(partes[2], partes[1] - 1, partes[0]);
        } else {
            dataFinal = new Date(valorCelula);
        }
    } else {
        return null;
    }

    if (isNaN(dataFinal.getTime())) return null;
    dataFinal.setHours(0, 0, 0, 0);
    return dataFinal;
}

function estaNoPeriodo(dataRow, dataHoje, periodo) {
    const tRow = dataRow.getTime();
    const tHoje = dataHoje.getTime();

    if (periodo === 'dia') return tRow === tHoje;

    if (periodo === 'semana') {
        const diffTime = Math.abs(tHoje - tRow);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
    }

    if (periodo === 'mes') {
        return dataRow.getMonth() === dataHoje.getMonth() &&
            dataRow.getFullYear() === dataHoje.getFullYear();
    }
    return false;
}

function getDiasPendentes(hoje) {
    const diaSemana = hoje.getDay();
    const datas = [new Date(hoje)];

    if (diaSemana === 0) {
        datas.push(subtrairDias(hoje, 1));
        datas.push(subtrairDias(hoje, 2));
    } else if (diaSemana === 6) {
        datas.push(subtrairDias(hoje, 1));
    }
    return datas;
}

function subtrairDias(data, dias) {
    const nova = new Date(data);
    nova.setDate(nova.getDate() - dias);
    nova.setHours(0, 0, 0, 0);
    return nova;
}

function isMetodoRecebivel(pagamento) {
    const p = pagamento;
    if (p === 'dinheiro' || p === 'pixqr') return false;

    const termos = ['crédito', 'credito', 'visa', 'master', 'elo', 'débito', 'debito', 'pix'];
    return termos.some(t => p.includes(t));
}

function testeFinal() {
    const req = {
        action: "calcular",
        loja: "DT#25",
        periodo: "dia"
    };
    console.log(JSON.stringify(calcularDashboard(req), null, 2));
}