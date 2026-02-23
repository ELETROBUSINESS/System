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
    DESCRICAO: 10,
    TIMESTAMP: 11
};

// Banco de dados de Clientes
const CLIENTES_SHEET_NAME = 'Clientes';

const COL_CLIENTE = {
    LOJA: 0,
    ID: 1,
    NOME: 2,
    CPF: 3,
    NASCIMENTO: 4,
    TELEFONE: 5,
    ENDERECO: 6,
    SALDO: 7,
    VENCIMENTO: 8,
    LIMITE: 9,
    BADGE: 10,
    PASS: 11
};

// ==========================================
// PONTO DE ENTRADA DA API (POST)
// ==========================================
function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);
        let response;

        // --- NOVAS CONSTANTES PARA O MÓDULO CRÉDITO ---
        const REGISTROS_SHEET_NAME = "Registros"; // Assuming this is a new constant needed
        const CREDITO_SHEET_NAME = "Crédito"; // NOVA ABA

        // Mapeamento Colunas Crédito (Extrato Detalhado)
        const COL_CREDITO = {
            ID: 0,            // ID Único da Linha (UUID)
            DATA: 1,          // Data do Evento (Compra ou Pagto)
            ID_CLIENTE: 2,    // Vinculo com Cliente
            ID_PARCELA: 3,    // ID Agrupador da Parcela (ex: PEDIDO-123-P1)
            TIPO: 4,          // 'COMPRA' ou 'PAGAMENTO'
            DESCRICAO: 5,     // Ex: "Compra em 3x (1/3)"
            VALOR: 6,         // Positivo (Dívida) ou Negativo (Pagto)
            VENCIMENTO: 7,    // Data de Vencimento da Parcela
            STATUS: 8         // 'ABERTA', 'PAGA', 'PARCIAL'
        };
        // --- FIM NOVAS CONSTANTES ---

        switch (data.action) {
            case 'calcular':
                response = calcularDashboard(data);
                break;
            case 'registrar_log':
                response = registrarLog(data);
                break;
            case 'listar_itens':
                response = listarItensDoDia(data);
                break;
            case 'buscar_cliente': // <--- NOVA ROTA
                response = buscarCliente(data);
                break;
            case 'salvar_cliente': // <--- NOVA ROTA
                response = salvarCliente(data);
                break;
            case 'listar_clientes': // <--- NOVA ROTA (LISTAGEM)
                response = listarClientes(data);
                break;
            case 'buscar_preco': // <--- NOVA ROTA (Adicionada do snippet)
                response = buscarPrecoPorNome(data.nome);
                break;
            // --- NOVAS AÇÕES CRÉDITO ---
            case 'registrar_venda_crediario':
                response = registrarVendaCrediario(data, CREDITO_SHEET_NAME, COL_CREDITO);
                break;
            case 'registrar_pagamento_parcela':
                response = registrarPagamentoParcela(data, CREDITO_SHEET_NAME, COL_CREDITO);
                break;
            case 'consultar_extrato_cliente':
                response = consultarExtratoCliente(data, CREDITO_SHEET_NAME, COL_CREDITO);
                break;
            case 'salvar_nota_fiscal':
                response = salvarNotaFiscal(data);
                break;
            default:
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
// PONTO DE ENTRADA DA API (GET)
// ==========================================
function doGet(e) {
    try {
        const action = e.parameter.action;
        let response;

        switch (action) {
            case 'listar_notas_fiscais':
                response = listarNotasFiscaisTransicao();
                break;
            default:
                response = { success: false, message: "Rota GET não encontrada." };
        }

        return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
    }
}

// ==========================================
// FUNÇÃO: LISTAR TODOS OS CLIENTES
// ==========================================
function listarClientes(data) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        let sheet = ss.getSheetByName(CLIENTES_SHEET_NAME);

        if (!sheet) return { success: false, message: "Aba 'Clientes' não encontrada." };

        const rows = sheet.getDataRange().getValues();
        const clientes = [];

        // Pula cabeçalho (i=1)
        for (let i = 1; i < rows.length; i++) {
            const lojaRow = String(rows[i][COL_CLIENTE.LOJA]).trim();

            // Ignora linhas vazias ou sem ID
            if (!rows[i][COL_CLIENTE.ID]) continue;

            // Opcional: Filtrar por loja se enviado no data
            if (data.loja && lojaRow !== String(data.loja).trim()) continue;

            clientes.push({
                loja: rows[i][COL_CLIENTE.LOJA],
                id: rows[i][COL_CLIENTE.ID],
                nome: rows[i][COL_CLIENTE.NOME],
                apelido: rows[i][COL_CLIENTE.BADGE] || rows[i][COL_CLIENTE.NOME] || "Sem Nome", // Usa Badge como Apelido
                cpf: rows[i][COL_CLIENTE.CPF],
                saldo: rows[i][COL_CLIENTE.SALDO],
                limite: rows[i][COL_CLIENTE.LIMITE],
                vencimento: rows[i][COL_CLIENTE.VENCIMENTO]
            });
        }

        return {
            success: true,
            clientes: clientes
        };

    } catch (e) {
        return { success: false, message: e.toString() };
    }
}

function buscarPrecoPorNome(nomePesquisa) {
    try {
        if (!nomePesquisa) return { status: "error", message: "Nome do produto não informado." };

        const sheet = getSheet(PRODUTOS_SHEET_NAME);
        const data = sheet.getDataRange().getValues();

        // 1. Mapeamento dinâmico das colunas (para segurança)
        const headers = data[0].map(h => h.toString().toLowerCase().trim());
        const idxNome = headers.indexOf("nome");   // Procura coluna 'Nome'
        const idxPreco = headers.indexOf("preco"); // Procura coluna 'Preco'

        if (idxNome === -1 || idxPreco === -1) {
            return { status: "error", message: "Colunas 'Nome' ou 'Preco' não encontradas na planilha." };
        }

        // 2. Normaliza o termo de busca (minúsculo e sem espaços extras)
        const termoBusca = String(nomePesquisa).toLowerCase().trim();

        // 3. Loop de busca
        for (let i = 1; i < data.length; i++) {
            const nomeNaPlanilha = String(data[i][idxNome]).toLowerCase().trim();

            if (nomeNaPlanilha === termoBusca) {
                let precoEncontrado = data[i][idxPreco];

                // Tratamento caso o preço esteja como texto (ex: "R$ 10,00")
                if (typeof precoEncontrado === 'string') {
                    precoEncontrado = parseFloat(precoEncontrado.replace("R$", "").replace(",", ".").trim()) || 0;
                }

                return {
                    status: "success",
                    nome: data[i][idxNome], // Retorna o nome original da planilha (formatado)
                    preco: precoEncontrado
                };
            }
        }

        return { status: "error", message: "Produto não encontrado." };

    } catch (e) {
        return { status: "error", message: "Erro ao buscar preço: " + e.toString() };
    }
}

// ==========================================
// FUNÇÃO: BUSCAR CLIENTE POR LOJA E ID
// ==========================================
function buscarCliente(dataInput) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        let sheet = ss.getSheetByName(CLIENTES_SHEET_NAME);

        if (!sheet) return { success: false, message: "Aba 'Clientes' não encontrada." };

        const rows = sheet.getDataRange().getValues();
        const lojaAlvo = String(dataInput.loja).trim();
        const idAlvo = String(dataInput.id).trim();

        for (let i = 1; i < rows.length; i++) {
            const lojaRow = String(rows[i][COL_CLIENTE.LOJA]).trim();
            const idRow = String(rows[i][COL_CLIENTE.ID]).trim();

            if (lojaRow === lojaAlvo && idRow === idAlvo) {
                return {
                    success: true,
                    cliente: {
                        loja: rows[i][COL_CLIENTE.LOJA],
                        id: rows[i][COL_CLIENTE.ID],
                        nome: rows[i][COL_CLIENTE.NOME],
                        cpf: rows[i][COL_CLIENTE.CPF],
                        nascimento: rows[i][COL_CLIENTE.NASCIMENTO],
                        telefone: rows[i][COL_CLIENTE.TELEFONE],
                        endereco: rows[i][COL_CLIENTE.ENDERECO],
                        saldo: rows[i][COL_CLIENTE.SALDO],
                        vencimento: rows[i][COL_CLIENTE.VENCIMENTO],
                        limite: rows[i][COL_CLIENTE.LIMITE],
                        badge: rows[i][COL_CLIENTE.BADGE],
                        pass: rows[i][COL_CLIENTE.PASS]
                    }
                };
            }
        }

        return { success: false, message: "Cliente não encontrado nesta loja." };

    } catch (e) {
        return { success: false, message: e.toString() };
    }
}

// ==========================================
// FUNÇÃO: SALVAR/ATUALIZAR CLIENTE (UPSERT)
// ==========================================
function salvarCliente(data) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        let sheet = ss.getSheetByName(CLIENTES_SHEET_NAME);

        // Se a aba não existir, cria com cabeçalho
        if (!sheet) {
            sheet = ss.insertSheet(CLIENTES_SHEET_NAME);
            sheet.appendRow(['Loja', 'ID', 'Nome completo', 'CPF', 'Nascimento', 'Telefone', 'Endereço', 'Saldo', 'Vencimento', 'Limite', 'Badge', 'Pass']);
        }

        const rows = sheet.getDataRange().getValues();
        const lojaAlvo = String(data.loja).trim();
        const idAlvo = String(data.id).trim();

        const novaLinha = [
            data.loja,
            data.id,
            data.nome || "",
            data.cpf || "",
            data.nascimento || "",
            data.telefone || "",
            data.endereco || "",
            data.saldo || 0,
            data.vencimento || "",
            data.limite || 0,
            data.badge || "",
            data.pass || ""
        ];

        // Busca se o cliente já existe para atualizar
        let indexEncontrado = -1;
        for (let i = 1; i < rows.length; i++) {
            if (String(rows[i][COL_CLIENTE.LOJA]).trim() === lojaAlvo &&
                String(rows[i][COL_CLIENTE.ID]).trim() === idAlvo) {
                indexEncontrado = i + 1; // +1 porque sheets começa em 1
                break;
            }
        }

        if (indexEncontrado !== -1) {
            // Atualiza cliente existente
            sheet.getRange(indexEncontrado, 1, 1, novaLinha.length).setValues([novaLinha]);
            return { success: true, message: "Dados do cliente atualizados!" };
        } else {
            // Registra novo cliente
            sheet.appendRow(novaLinha);
            return { success: true, message: "Cliente cadastrado com sucesso!" };
        }

    } catch (e) {
        return { success: false, message: e.toString() };
    }
}

// ==========================================
// FUNÇÃO: REGISTRAR LOG (ANTIGRAVITY)
// ==========================================
function registrarLog(data) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('logs');

    if (!sheet) {
        sheet = ss.insertSheet('logs');
        sheet.appendRow(['Data/Hora', 'Loja', 'Operador', 'Cargo', 'Ação', 'Quantidade', 'Detalhes']);
    }

    const timestamp = new Date();
    const novaLinha = [
        timestamp,
        data.loja || "DT#25",
        data.operador || "",
        data.cargo || "",
        data.acao || "Registro",
        data.quantidade || 0,
        data.detalhes || ""
    ];

    try {
        sheet.appendRow(novaLinha);
        return { success: true, message: "Log registrado com sucesso!" };
    } catch (e) {
        return { success: false, message: e.message };
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

// ==========================================
// FUNÇÃO: LISTAR ITENS DO DIA
// ==========================================
function listarItensDoDia(dataInput) {
    const sheet = getDatabaseSheet();
    const rows = sheet.getDataRange().getValues();
    const dataRows = rows.slice(1); // Ignora cabeçalho

    // Se vier loja no JSON, filtra por loja também, senão pega geral
    const lojaAlvo = dataInput.loja || null;

    // Define "Hoje" formatado como string "dd/MM/yyyy" para comparação exata
    const timeZone = Session.getScriptTimeZone();
    const hojeStr = Utilities.formatDate(new Date(), timeZone, "dd/MM/yyyy");

    let listaItens = [];

    dataRows.forEach(row => {
        // 1. Filtro de Loja (Opcional, mas recomendado)
        if (lojaAlvo && String(row[COL.LOJA]).trim() !== lojaAlvo) return;

        // 2. Filtro de Data (Formata a data da linha e compara com hoje)
        const dataCelula = row[COL.TIMESTAMP];
        if (!dataCelula) return;

        const dataRowStr = Utilities.formatDate(new Date(dataCelula), timeZone, "dd/MM/yyyy");

        // Se a data for igual a hoje
        if (dataRowStr === hojeStr) {
            const descricao = String(row[COL.DESCRICAO]);

            // 3. Processamento da Descrição
            if (descricao && descricao !== "") {
                // Separa por ponto e vírgula (;)
                const partes = descricao.split(';');

                partes.forEach(item => {
                    const itemLimpo = item.trim();
                    if (itemLimpo.length > 0) {
                        listaItens.push(itemLimpo);
                    }
                });
            }
        }
    });

    return {
        success: true,
        data_referencia: hojeStr,
        total_itens: listaItens.length,
        itens: listaItens
    };
}

// ==========================================
// FUNÇÃO: SALVAR NOTA FISCAL (NFC-e / NF-e)
// ==========================================
function salvarNotaFiscal(data) {
    const FISCAL_SHEET_NAME = 'Fiscal'; // Mudança para 'Fiscal' como solicitado
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(FISCAL_SHEET_NAME);

    // Cria a aba se não existir
    if (!sheet) {
        sheet = ss.insertSheet(FISCAL_SHEET_NAME);
        // Loja, Modelo, Nº Nota, ID Venda, Status, Operador, Cargo, Pagamento, Total, Mensagem, Conteúdo XML, Chave, Procolo, Timestamp
        sheet.appendRow([
            'Loja',
            'Modelo',
            'Nº Nota',
            'ID Venda',
            'Status',
            'Operador',
            'Cargo',
            'Pagamento',
            'Total',
            'Mensagem',
            'Conteúdo XML',
            'Chave',
            'Procolo',
            'Timestamp'
        ]);
        SpreadsheetApp.flush();
    }

    const timestamp = new Date();
    const novaLinha = [
        data.loja || "DT#25",
        data.modelo || "NFC-e",
        data.numeroNota || "---",
        data.idVenda || "---",
        data.status || "Pendente",
        data.operador || "---",
        data.cargo || "---",
        data.pagamento || "---",
        data.total || 0,
        data.mensagem || "",
        data.xml || "",
        data.chave || "",
        data.protocolo || "",
        timestamp
    ];

    try {
        sheet.appendRow(novaLinha);
        return { success: true, message: "Nota Fiscal registrada com sucesso (Transição)!" };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

function listarNotasFiscaisTransicao() {
    const FISCAL_SHEET_NAME = 'Fiscal'; // Mudança para 'Fiscal' como solicitado
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(FISCAL_SHEET_NAME);

    if (!sheet) return { success: true, data: [] };

    const rows = sheet.getDataRange().getValues();
    if (rows.length <= 1) return { success: true, data: [] };

    const data = [];
    for (let i = 1; i < rows.length; i++) {
        data.push({
            loja: rows[i][0],
            modelo: rows[i][1],
            nNF: rows[i][2],
            idVenda: rows[i][3],
            status: rows[i][4],
            operador: rows[i][5],
            cargo: rows[i][6],
            pagamento: rows[i][7],
            total: rows[i][8],
            mensagem: rows[i][9],
            xml: rows[i][10],
            chave: rows[i][11],
            protocolo: rows[i][12],
            timestamp: rows[i][13]
        });
    }

    return { success: true, data: data };
}