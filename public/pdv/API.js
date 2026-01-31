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

    // Normaliza para salvar padronizado (opcional, mas bom para organização)
    const tipoSalvo = data.tipo ? data.tipo.toLowerCase() : "";

    const novaLinha = [
        data.loja,
        data.operador,
        data.cargo,
        tipoSalvo, // Salva já em minúsculo se quiser
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

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const msDiasPendentes = getDiasPendentes(hoje).map(d => d.getTime());

    dataRows.forEach(row => {
        // 1. Filtro de Loja (Trim remove espaços acidentais)
        if (String(row[COL.LOJA]).trim() != lojaAlvo) return;

        // 2. Normalização da Data
        const dataRow = normalizarData(row[COL.TIMESTAMP]);
        if (!dataRow) return;

        // 3. Normalização de Texto (TUDO PARA MINÚSCULO)
        // Isso resolve o problema de "entrada" vs "Entrada"
        const tipo = String(row[COL.TIPO]).toLowerCase().trim();
        const pagto = String(row[COL.PAGAMENTO]).toLowerCase().trim();
        const total = parseFloat(row[COL.TOTAL]) || 0;

        const isPendente = msDiasPendentes.includes(dataRow.getTime());

        // --- LÓGICA DE SALDO ---
        if (tipo === 'saída' || tipo === 'saida') {
            saldo -= total;
        }
        else if (tipo === 'entrada') {
            // Dinheiro ou Pix QR (entradas imediatas)
            if (pagto === 'dinheiro' || pagto === 'pixqr') {
                saldo += total;
            }
            // Se for Cartão/Crédito E já passou do prazo (não é pendente) -> Soma no Saldo
            else if (isMetodoRecebivel(pagto) && !isPendente) {
                saldo += total;
            }
        }

        // --- FILTRO DE PERÍODO ---
        if (estaNoPeriodo(dataRow, hoje, periodo)) {
            if (tipo === 'entrada') {
                faturamento += total;
                clientesAtendidos++;
            }
        }

        // --- LÓGICA DE A RECEBER ---
        if (tipo === 'entrada' && isMetodoRecebivel(pagto) && isPendente) {
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
            clientesAtendidos: clientesAtendidos
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
    // Já recebe em minúsculo vindo da função principal
    const p = pagamento;

    if (p === 'dinheiro' || p === 'pixqr') return false;

    const termos = ['crédito', 'credito', 'visa', 'master', 'elo', 'débito', 'debito', 'pix'];
    return termos.some(t => p.includes(t));
}

// ==========================================
// TESTE FINAL
// ==========================================
function testeFinal() {
    const req = {
        action: "calcular",
        loja: "DT#25",
        periodo: "mes"
    };
    console.log(JSON.stringify(calcularDashboard(req), null, 2));
}