// IDs das Planilhas e Nomes das Abas
const SS_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const PRODUTOS_SHEET_NAME = "produtos";
const CLIENTES_SHEET_NAME = "clientes";
const LOGS_SHEET_NAME = "logs";
const CAIXA_SHEET_NAME = "caixa_movimentos"; // (NOVO)
const FISCAL_SHEET_NAME = "fiscal";
const PEDIDOS_SHEET_NAME = "pedidos"; // (NOVO) Geração de pedidos do Super App

// Validação de comprovante

// --- IMPORTANTE: Adicione esta função doPost para aceitar o upload da imagem ---
function doPost(e) {
    const lock = LockService.getScriptLock();
    lock.tryLock(30000);

    try {
        const data = JSON.parse(e.postData.contents);
        const action = data.action;

        // [NOVO] Salvar pelo Modal (Novo Frontend)
        if (action === "saveProduct") {
            // Chama a função nova auxiliar que você vai colar no final do arquivo
            const result = saveProduct(data.data);
            return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
        }

        if (action === "updateFiscalFromXML") {
            const result = processarAtualizacaoXML(data.produtos); // data.produtos virá do seu HTML
            return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
        }

        // [EXISTENTE] Salvar Simplificado/Antigo
        if (action === "salvarProdutoCompleto") {
            const result = salvarProdutoCompleto(data);
            return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
        }

        // 1. Upload de Comprovante (Imagem)
        if (action === "uploadComprovante") {
            const result = salvarComprovanteDrive(data);
            return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
        }
        // 2. Importação em Massa (Excel)
        else if (action === "importarProdutosLote") {
            const result = importarProdutosEmMassa(data.produtos);
            return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
        }
        // 3. Registrar Histórico Detalhado (NOVO)
        else if (action === "registrarHistorico") {
            const result = registrarHistoricoCompleto(data);
            return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
        }

        // 4. Salvar Log Fiscal (Integrado ao PDV)
        else if (action === "salvarNotaFiscal") {
            const result = salvarLogFiscal(data.data);
            return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
        }

        // 5. Atualizar Dados do Cliente (NOVO)
        else if (action === "updateClientData") {
            const result = atualizarDadosCliente(data.data);
            return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
        }

        // 6. Abater Estoque em Lote (NOVO)
        else if (action === "abaterEstoqueLote") {
            const result = abaterEstoqueLote(data.itens);
            return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
        }

        // 7. Salvar Pedido Super App (Redundância)
        else if (action === "salvarPedido") {
            const result = salvarPedidoSuperApp(data.data);
            return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
        }

        // 8. Atualizar Status de Pagamento
        else if (action === "atualizarStatusPedido") {
            const result = atualizarStatusPedidoSuperApp(data.orderId, data.status);
            return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
        }

        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Ação desconhecida" })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
            status: "error",
            message: "Erro no POST: " + error.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    } finally {
        lock.releaseLock();
    }
}

// --- ADICIONE ESTA FUNÇÃO AO FINAL DO ARQUIVO Code.js ---
function processarAtualizacaoXML(listaProdutosXML) {
    const lock = LockService.getScriptLock();
    lock.tryLock(30000); // Bloqueio de segurança para evitar conflitos [cite: 4]

    try {
        const sheet = getSheet(PRODUTOS_SHEET_NAME); // [cite: 78]
        const values = sheet.getDataRange().getValues();

        // Cabeçalhos em minúsculo para busca segura [cite: 244]
        const headers = values[0].map(h => h.toString().toLowerCase().trim());

        // Identificação das colunas (Baseado na estrutura de 15 colunas do script) [cite: 54, 58, 388]
        const idxNome = headers.indexOf("nome"); // Coluna B (index 1) [cite: 56]
        const idxNcm = headers.indexOf("ncm");   // Coluna J (index 9) [cite: 57, 382]
        const idxCfop = headers.indexOf("cfop"); // Coluna L (index 11) [cite: 57, 384]

        let atualizados = 0;

        listaProdutosXML.forEach(prodXml => {
            const nomeXmlLimpo = String(prodXml.nome).trim().toLowerCase();

            // Percorre a planilha procurando pelo nome/descrição
            for (let i = 1; i < values.length; i++) {
                const nomePlanilha = String(values[i][idxNome]).trim().toLowerCase();

                if (nomePlanilha === nomeXmlLimpo) {
                    const ncmAtual = String(values[i][idxNcm] || "").trim();

                    // REGRA: Só atualiza se o NCM na planilha estiver vazio [cite: 382]
                    if (ncmAtual === "" || ncmAtual === "---") {
                        // Atualiza NCM e CFOP nas colunas correspondentes [cite: 382, 384, 389]
                        sheet.getRange(i + 1, idxNcm + 1).setValue(prodXml.ncm);
                        sheet.getRange(i + 1, idxCfop + 1).setValue(prodXml.cfop);
                        atualizados++;
                    }
                    break; // Produto encontrado e processado, vai para o próximo do XML
                }
            }
        });

        return {
            status: "success",
            message: `${atualizados} produtos tiveram dados fiscais preenchidos.`
        };
    } catch (e) {
        return { status: "error", message: "Erro no script: " + e.toString() };
    } finally {
        lock.releaseLock();
    }
}

function obterProximoNumeroFiscal() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("fiscal");
    if (!sheet) return 1;

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return 1;

    // Pega todos os valores da Coluna B (n° da nota), começando da linha 2
    const valores = sheet.getRange(2, 2, lastRow - 1, 1).getValues();

    // Filtra apenas números válidos e encontra o maior
    const numeros = valores
        .map(r => parseInt(r[0]))
        .filter(n => !isNaN(n));

    if (numeros.length === 0) return 1;

    const maiorNumero = Math.max(...numeros);
    return maiorNumero + 1;
}

function verificarUltimoLogCliente(idCliente) {
    try {
        const sheetLogs = getSheet(LOGS_SHEET_NAME);
        const lastRow = sheetLogs.getLastRow();

        if (lastRow < 2) {
            return { status: "error", message: "Nenhum registro de venda encontrado." };
        }

        // Pega o intervalo da última linha
        const dataRange = sheetLogs.getRange(lastRow, 1, 1, sheetLogs.getLastColumn());

        // VALUES: Para pegar números reais (Valor monetário)
        const values = dataRange.getValues()[0];

        // DISPLAY VALUES: Para pegar o TEXTO EXATO (Parcelas "1/2") sem converter para data
        const displayValues = dataRange.getDisplayValues()[0];

        // Mapeamento baseado na sua imagem (Coluna A=0, B=1, ... E=4)
        const logIdCliente = String(values[1]);  // Coluna B
        const logTimestamp = values[0];          // Coluna A
        const logTipo = values[2];               // Coluna C

        // Usa 'values' para o dinheiro (mantém precisão numérica)
        const logValor = parseFloat(values[3]);  // Coluna D

        // --- CORREÇÃO DEFINITIVA ---
        // Usa 'displayValues' no índice 4 (Coluna E) para pegar "1/2" como texto puro
        const logParcelas = displayValues[4] ? String(displayValues[4]) : "-";

        const logAnexo = values[7];              // Coluna H

        // 1. Validação de ID
        // Se o ID vier no link, tem que bater com a planilha. Se não vier, aceita o último.
        if (idCliente && logIdCliente !== String(idCliente)) {
            return {
                status: "error",
                message: "QR Code não corresponde à última venda registrada."
            };
        }

        // 2. Verifica se já tem anexo
        if (logAnexo && logAnexo.toString().length > 5) {
            return {
                status: "existente",
                message: "O comprovante desta venda já foi validado.",
                link: logAnexo
            };
        }

        // 3. Busca Nome do Cliente (Aba Clientes)
        let nomeCliente = "Consumidor";
        const sheetClientes = getSheet(CLIENTES_SHEET_NAME);
        const dataClientes = sheetClientes.getDataRange().getValues();

        for (let i = 1; i < dataClientes.length; i++) {
            if (String(dataClientes[i][0]) === logIdCliente) {
                nomeCliente = dataClientes[i][2] || dataClientes[i][1]; // Apelido ou Nome
                break;
            }
        }

        // Formatação Final
        const dataFormatada = Utilities.formatDate(new Date(logTimestamp), Session.getScriptTimeZone(), 'dd/MM HH:mm');
        const valorFormatado = logValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        return {
            status: "success",
            data: {
                timestamp: dataFormatada,
                idCliente: logIdCliente,
                rowIndex: lastRow,
                nome: nomeCliente,
                valor: valorFormatado,
                // Retorna o texto limpo da coluna E ou "Pagamento" se for o caso
                parcelas: logTipo === 'Pagamento' ? 'Pagamento' : logParcelas
            }
        };
    } catch (e) {
        return { status: "error", message: e.toString() };
    }
}
function salvarComprovanteDrive(data) {
    try {
        const { idCliente, imageBase64, rowIndex } = data;

        // 1. Converter Base64 em Blob
        const nomeArquivo = `Comprovante_${idCliente}_${new Date().getTime()}.jpg`;
        const imageBlob = Utilities.newBlob(Utilities.base64Decode(imageBase64.split(',')[1]), MimeType.JPEG, nomeArquivo);

        // 2. Criar ou localizar a pasta
        const folders = DriveApp.getFoldersByName("Comprovantes PDV");
        let folder;
        if (folders.hasNext()) {
            folder = folders.next();
        } else {
            folder = DriveApp.createFolder("Comprovantes PDV");
        }

        // 3. Salvar Arquivo e tornar público para visualização
        const file = folder.createFile(imageBlob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        const fileUrl = file.getUrl();

        // 4. Atualizar Planilha de Logs na Coluna H
        const sheet = getSheet(LOGS_SHEET_NAME);
        const currentRowValues = sheet.getRange(rowIndex, 2).getValue();

        if (String(currentRowValues) === String(idCliente)) {
            sheet.getRange(rowIndex, 8).setValue(fileUrl);
            return { status: "success", message: "Comprovante salvo!", url: fileUrl };
        } else {
            // Fallback para garantir o salvamento na linha indicada
            sheet.getRange(rowIndex, 8).setValue(fileUrl);
            return { status: "success", message: "Salvo (Linha recuperada).", url: fileUrl };
        }
    } catch (e) {
        return { status: "error", message: "Erro ao salvar no Drive: " + e.toString() };
    }
}

function doGet(e) {
    const lock = LockService.getScriptLock();
    let lockAcquired = false;
    let response = {};

    try {
        // 1. Tenta obter o bloqueio para evitar conflitos (Wait 15s)
        lockAcquired = lock.tryLock(15000);
        if (!lockAcquired) {
            return ContentService.createTextOutput(JSON.stringify({
                status: "error",
                message: "Servidor ocupado. Tente novamente em alguns segundos."
            })).setMimeType(ContentService.MimeType.JSON);
        }

        // 2. Verifica parâmetros básicos
        if (!e || !e.parameter || !e.parameter.action) {
            throw new Error("Ação não especificada na requisição.");
        }

        // 3. DEFINIÇÃO DA VARIÁVEL ACTION (Movido para cima para evitar erro de inicialização)
        const action = e.parameter.action;

        // ============================================================
        // ROTEAMENTO DE AÇÕES (API ROUTER)
        // ============================================================

        // --- 0. FISCAL: PRÓXIMO NÚMERO ---
        if (action === "getProximoNumero") {
            const proximo = obterProximoNumeroFiscal();
            response = {
                status: "success",
                proximo: proximo
            };
        }

        // --- 1. PRODUTOS ---
        else if (action === "listarProdutos") {
            response = listarTodosProdutos();
        }

        else if (action === "buscarPrecoPorNome") {
            response = buscarPrecoPorNome(e.parameter.nome);
        }

        else if (action === "alterarVencimentoManual") {
            response = alterarVencimentoManual(e.parameter.idCliente, e.parameter.novaData);
        }
        else if (action === "alterarLimite") {
            response = alterarLimite(e.parameter.idCliente, e.parameter.novoLimite);
        }

        else if (action === "getProducts") {
            const result = listarTodosProdutos();
            response = result.status === "success" ? result.data : [];
        }

        else if (action === "buscarProduto") {
            response = buscarProdutoPorCodigo(e.parameter.codigo);
        }

        else if (action === "cadastrarProduto") {
            response = cadastrarNovoProduto(e.parameter.codigo, e.parameter.nome, e.parameter.preco);
        }

        // --- 2. CLIENTES ---
        else if (action === "listarClientes") {
            response = listarTodosClientes();
        }

        else if (action === "getClients") { // Nome usado em carregarClientesDaAPI
            const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("clientes");
            if (!sheet || sheet.getLastRow() <= 1) {
                response = [];
            } else {
                // Retorna a array bruta de clientes
                response = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
            }
        }

        else if (action === "cadastrarCliente") {
            response = cadastrarNovoCliente(e.parameter);
        }

        // --- 3. CAIXA ---
        else if (action === "abrirCaixa") {
            response = registrarAberturaCaixa(e.parameter.valorNotas, e.parameter.valorMoedas);
        }

        else if (action === "fecharCaixa") {
            response = registrarFechamentoCaixa(e.parameter);
        }

        // --- 4. TRANSAÇÕES ---
        else if (action === "registrarTransacao") {
            response = registrarTransacao(e.parameter);
        }

        // --- 5. CONSULTAS E HISTÓRICO ---
        else if (action === "verificarUltimoLog") {
            response = verificarUltimoLogCliente(e.parameter.idCliente);
        }

        else if (action === "obterHistorico") {
            response = obterHistoricoCliente(e.parameter.idCliente);
        }

        else if (action === "listarHistoricoVendas") {
            response = listarHistoricoVendas();
        }

        // --- 6. FISCAL: LISTAGEM ---
        else if (action === "listarNotasFiscais") {
            // VERIFICACAO DO PARAMETRO OFFLIMITE
            const ignoreLimit = (e && e.parameter && (e.parameter.offlimite === "true" || e.parameter.offlimite === "?" || e.parameter.offlimite === "1"));
            const dados = listarLogFiscal(ignoreLimit);
            response = {
                status: 'success',
                data: dados
            };
        }

        // --- AÇÕES DE MÉTRICAS E ADMIN ---
        else if (action === "metricasCrediario") {
            response = calcularMetricasCrediario();
        }

        // [NOVO] Adicione este bloco:
        else if (action === "previsaoMensal") {
            response = obterPrevisaoFinanceiraMes();
        }

        else if (action === "obterDadosFatura") {
            response = obterDadosFaturaCliente(e.parameter.idCliente, e.parameter.pin);
        }

        else if (action === "renegociarSaldo") {
            response = renegociarSaldoCliente(e.parameter.idCliente, e.parameter.novaData, e.parameter.parcelas);
        }

        // --- SUPER APP ---
        else if (action === "listarProdutosSuperApp") {
            response = listarProdutosSuperApp();
        }

        // --- AÇÃO DESCONHECIDA ---
        else {
            response = { status: "error", message: "Ação inválida: " + action };
        }

    } catch (error) {
        Logger.log("Erro Fatal no GET: " + error);
        response = {
            status: "error",
            message: "Erro interno: " + (error.message || error.toString())
        };
    } finally {
        if (lockAcquired) {
            lock.releaseLock();
        }
    }

    // Retorno universal em JSON
    return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
}

function listarProdutosSuperApp() {
    try {
        const sheet = getSheet(PRODUTOS_SHEET_NAME);
        const dataRaw = sheet.getDataRange().getValues();
        if (dataRaw.length <= 1) return { status: "success", data: [] };

        const headers = dataRaw[0].map(h => String(h).toLowerCase().trim());
        const produtos = [];

        const idxCodigo = headers.indexOf("codigo") !== -1 ? headers.indexOf("codigo") : 0;
        const idxNome = headers.indexOf("nome") !== -1 ? headers.indexOf("nome") : 1;
        const idxPreco = headers.indexOf("preco") !== -1 ? headers.indexOf("preco") : 2;
        const idxNcm = headers.indexOf("ncm") !== -1 ? headers.indexOf("ncm") : 9;

        // Tenta encontrar colunas promocionais, se não achar usa 16 como fallback
        let idxPromo = headers.indexOf("promocional");
        if (idxPromo === -1) idxPromo = headers.indexOf("promocao");
        if (idxPromo === -1) idxPromo = 16;

        // Coluna F (Índice 5) é Categorias, conforme solicitado
        let idxCat = headers.indexOf("categoria");
        if (idxCat === -1) idxCat = headers.indexOf("category");
        if (idxCat === -1) idxCat = 5;

        const idxDesc = headers.indexOf("descricao") !== -1 ? headers.indexOf("descricao") : (headers.indexOf("description") !== -1 ? headers.indexOf("description") : 17);
        const idxImgUrl = headers.indexOf("imgurl") !== -1 ? headers.indexOf("imgurl") : (headers.indexOf("img url") !== -1 ? headers.indexOf("img url") : 18);

        const idxWebPrice = headers.indexOf("web_price");

        for (let i = 1; i < dataRaw.length; i++) {
            const row = dataRaw[i];

            // 1. Mapeia NCM se disponível
            const ncm = idxNcm !== -1 ? String(row[idxNcm] || "").trim() : "";

            // 2. Coleta Estoque (Coluna P - Index 15 ou Header nominal)
            let estoque = parseFloat(row[15]) || 0;
            if (headers.indexOf("estoque atual") !== -1) {
                estoque = parseFloat(row[headers.indexOf("estoque atual")]) || 0;
            }

            const codigo = String(row[idxCodigo] || "");
            if (!codigo) continue;

            let precoNum = 0;
            if (idxPreco !== -1) {
                let pString = String(row[idxPreco]).replace("R$", "").trim().replace(",", ".");
                precoNum = parseFloat(pString) || 0;
            }

            const prodObj = {
                id: codigo,
                name: String(row[idxNome] || ""),
                price: precoNum,
                stock: estoque,
                ncm: ncm
            };

            // 3. Força o uso da Coluna Q (Index 16) para Preço Promocional
            const valPromo = row[16];
            if (valPromo && valPromo !== "") {
                let pString2 = String(valPromo).replace("R$", "").trim().replace(",", ".");
                const pNum = parseFloat(pString2) || 0;
                if (pNum > 0) prodObj["price-oferta"] = pNum;
            }

            if (idxWebPrice !== -1 && row[idxWebPrice]) {
                let pString3 = String(row[idxWebPrice]).replace("R$", "").trim().replace(",", ".");
                prodObj["web_price"] = parseFloat(pString3) || 0;
            }

            if (idxImgUrl !== -1 && row[idxImgUrl]) prodObj.imgUrl = String(row[idxImgUrl]);
            if (idxCat !== -1 && row[idxCat]) prodObj.category = String(row[idxCat]);
            if (idxDesc !== -1 && row[idxDesc]) prodObj.description = String(row[idxDesc]);

            let imgCont = 1;
            while (imgCont <= 10) {
                const headStr = ("imgurl" + imgCont);
                const idxI = headers.indexOf(headStr);
                if (idxI !== -1 && row[idxI]) {
                    prodObj["imgUrl" + imgCont] = String(row[idxI]);
                } else if (idxI === -1 && imgCont > 3) {
                    break;
                }
                imgCont++;
            }

            produtos.push(prodObj);
        }

        return { status: "success", data: produtos };
    } catch (e) {
        return { status: "error", message: e.toString() };
    }
}

function buscarPrecoPorNome(nomePesquisa) {
    try {
        if (!nomePesquisa) return { status: "error", message: "Nome do produto não informado." };

        const sheet = getSheet(PRODUTOS_SHEET_NAME);
        const data = sheet.getDataRange().getValues();

        // 1. Mapeamento
        const headers = data[0].map(h => String(h).toLowerCase().trim());
        const idxNome = headers.indexOf("nome");
        const idxPreco = headers.indexOf("preco");
        let idxPromo = headers.indexOf("promocional");
        if (idxPromo === -1) idxPromo = headers.indexOf("promocao");

        if (idxNome === -1 || idxPreco === -1) {
            return { status: "error", message: "Colunas 'nome' ou 'preco' não encontradas." };
        }

        // 2. Normalização do termo de busca (Remove acentos e caracteres especiais)
        // Ex: "V-30" vira "v30", "Batom!" vira "batom"
        const termoBusca = normalizarTexto(nomePesquisa);

        // 3. Loop de busca
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            const nomeOriginal = String(row[idxNome]);
            const nomeDb = normalizarTexto(nomeOriginal);

            // TENTATIVA 1: Busca Exata (Normalizada)
            // TENTATIVA 2: Verifica se o termo buscado CONTÉM o nome do banco (para casos onde o vendedor digitou detalhes extra)
            // Ex: Busca = "Ventilador Mondial V-30 110v" | Banco = "Ventilador Mondial V-30" -> Match!

            const matchExato = nomeDb === termoBusca;
            const matchParcial = termoBusca.includes(nomeDb) && nomeDb.length > 3; // >3 evita match com palavras curtas tipo "v30"

            if (matchExato || matchParcial) {
                let precoFinal = parseBrFloat(row[idxPreco]);
                let statusOferta = "normal";

                if (idxPromo !== -1) {
                    const valorPromo = parseBrFloat(row[idxPromo]);
                    if (valorPromo > 0) {
                        precoFinal = valorPromo;
                        statusOferta = "oferta";
                    }
                }

                return {
                    status: "success",
                    nome: nomeOriginal, // Retorna o nome oficial do banco
                    preco: precoFinal,
                    tipo: statusOferta
                };
            }
        }

        return { status: "error", message: "Produto não encontrado: " + nomePesquisa };

    } catch (e) {
        return { status: "error", message: "Erro: " + e.toString() };
    }
}

// FUNÇÃO NOVA: Adicione esta função no final do seu arquivo .gs
function normalizarTexto(texto) {
    if (!texto) return "";
    return String(texto)
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[^a-z0-9\s]/g, "") // Remove traços, pontos, símbolos
        .replace(/\s+/g, " ") // Remove espaços duplos
        .trim();
}

function parseBrFloat(value) {
    if (typeof value === "number") return value;
    if (!value) return 0;
    let cleanValue = value.toString().replace(/[R$\s]/g, "").replace(",", ".");
    return parseFloat(cleanValue) || 0;
}

// --- 1. FUNÇÃO DE CRIAÇÃO DE ABAS (Atualizada com novas colunas) ---
// [CORRIGIDO] - getSheet Unificado e Seguro
function getSheet(sheetName) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
        Logger.log("Criando nova aba: " + sheetName);
        sheet = ss.insertSheet(sheetName);

        // REGRA PARA PRODUTOS (ATUALIZADA)
        if (sheetName === PRODUTOS_SHEET_NAME) {
            sheet.appendRow([
                "Codigo", "Nome", "Preco", "Custo",
                "Estoque Atual", "Estoque Minimo",
                "NCM", "CFOP", "Unidade", "Origem", "Timestamp"
            ]);
        }
        // REGRA PARA CLIENTES (MANTIDA ORIGINAL)
        else if (sheetName === CLIENTES_SHEET_NAME) {
            sheet.appendRow([
                "ID Cliente", "Nome Completo", "Apelido", "Telefone", "Endereço",
                "Saldo Devedor", "Parcelas Totais", "Parcelas Pagas", "Próximo Vencimento",
                "Data Cadastro", "Dia Vencimento", "Limite", "Pass"
            ]);
        }
        // REGRA PARA LOGS (MANTIDA ORIGINAL)
        else if (sheetName === LOGS_SHEET_NAME) {
            sheet.appendRow(["Timestamp", "ID Cliente", "Tipo", "Valor", "Parcela N/Total", "Observação", "Data Venda/Pagamento"]);
        }
        // Localize dentro da função getSheet(sheetName)
        else if (sheetName === FISCAL_SHEET_NAME) {
            // Adicionei "Nº Nota" e "Protocolo" para alinhar com o salvamento
            sheet.appendRow(["Timestamp", "Nº Nota", "ID Venda", "Status", "Chave", "Protocolo", "Mensagem", "Itens Ignorados", "Conteúdo XML"]);
        }
        // REGRA PARA CAIXA (MANTIDA ORIGINAL)
        else if (sheetName === CAIXA_SHEET_NAME) {
            sheet.appendRow(["Timestamp", "Tipo", "Valor Inicial Notas", "Valor Inicial Moedas", "Valor Final Notas", "Valor Final Moedas", "Venda Cartão", "Venda Pix Fixo", "Valor Depósito", "Valor Fica Caixa", "Assinatura"]);
        }
        SpreadsheetApp.flush();
    }
    return sheet;
}

// [NOVO] - Rota de salvamento para o Modal Avançado (JSON)
function salvarProdutoCompleto(data) {
    const lock = LockService.getScriptLock();
    lock.tryLock(10000);

    try {
        const sheet = getSheet(PRODUTOS_SHEET_NAME);
        const rows = sheet.getDataRange().getValues();
        const headers = rows[0].map(h => h.toString().toLowerCase().trim());

        const codigo = String(data.codigo || "").trim();
        if (!codigo) return { status: "error", message: "Código obrigatório." };

        // Mapeamento compatível com o formulário do Front-end
        const mapeamento = {
            "codigo": codigo,
            "nome": data.nome,
            "preco": parseFloat(data.preco_venda) || 0,
            "custo": parseFloat(data.preco_custo) || 0,
            "estoque atual": parseFloat(data.estoque_atual) || 0,
            "estoque minimo": parseFloat(data.estoque_minimo) || 0,
            "ncm": String(data.ncm || "").trim(),
            "cfop": String(data.cfop || "").trim(),
            "unidade": data.unidade || "UN",
            "origem": data.origem || "0",
            "timestamp": new Date()
        };

        let rowIndex = -1;
        for (let i = 1; i < rows.length; i++) {
            if (String(rows[i][0]) === codigo) { rowIndex = i + 1; break; }
        }

        const newRowData = headers.map(h => mapeamento[h] !== undefined ? mapeamento[h] : "");

        if (rowIndex > 0) {
            sheet.getRange(rowIndex, 1, 1, newRowData.length).setValues([newRowData]);
        } else {
            sheet.appendRow(newRowData);
        }

        return { status: "success", message: "Produto atualizado na planilha." };
    } catch (e) {
        return { status: "error", message: e.toString() };
    } finally {
        lock.releaseLock();
    }
}

function formatSheetData(sheet) {
    const dataRange = sheet.getDataRange();
    if (dataRange.getNumRows() <= 1) return [];
    const data = dataRange.getValues();
    const headers = data[0].map(header => header.toString().trim().toLowerCase());

    return data.slice(1).map((row) => {
        let obj = {};
        headers.forEach((header, index) => {
            let value = row[index];
            // Converte objetos de Data nativos para String ISO para o front-end
            if (value instanceof Date) {
                obj[header] = value.toISOString();
            } else {
                obj[header] = value;
            }
        });
        return obj;
    });
}

// --- Funções de Lógica - Produtos ---

// Substitua a função listarTodosProdutos inteira por esta:

function listarTodosProdutos() {
    Logger.log("Executando listarTodosProdutos (Versão Fiscal + Estoque)...");

    try {
        const sheet = getSheet(PRODUTOS_SHEET_NAME);
        const data = formatSheetData(sheet); // Lê headers e minúsculas

        if (data.length === 0) {
            return { status: "success", data: [] };
        }

        const mapaUnidades = {
            "UNIDADE": "UN", "UN": "UN", "UND": "UN",
            "CAIXA": "CX", "CX": "CX",
            "PACOTE": "PC", "PEÇA": "PC", "PECA": "PC", "PC": "PC",
            "QUILO": "KG", "KG": "KG", "KILO": "KG",
            "LITRO": "L", "L": "L",
            "METRO": "M", "M": "M"
        };

        const produtos = data.map(item => {
            // Tratamento de Preço
            let precoNum = 0;
            if (typeof item.preco === 'number') {
                precoNum = item.preco;
            } else if (item.preco) {
                let pString = String(item.preco).replace("R$", "").trim().replace(",", ".");
                precoNum = parseFloat(pString) || 0;
            }

            // Tratamento de Estoque
            // Busca Inteligente de Estoque
            const keys = Object.keys(item);

            // Prioriza "estoque atual", depois "estoque", depois qualquer uma que contenha "estoque" e não "minimo"
            let stockKey = keys.find(k => k === "estoque atual") ||
                keys.find(k => k === "estoque") ||
                keys.find(k => k.includes("estoque") && !k.includes("minimo"));

            // Se não encontrou pelo nome, e a planilha tem muitas colunas, tenta o fallback da Coluna P (index 15)
            // No formatSheetData, se não houver header, a chave pode ser vazia ou algo genérico
            let stockVal = stockKey ? parseFloat(item[stockKey]) : 0;

            // Se o valor for 0 e tivermos acesso ao índice bruto (não temos aqui pelo item), 
            // mas podemos verificar se existe uma chave vazia que possa ser a P
            if (isNaN(stockVal)) stockVal = 0;

            // Busca Inteligente de Estoque Mínimo
            let minStockKey = keys.find(k => k === "estoque minimo") ||
                keys.find(k => k === "estoque_minimo") ||
                keys.find(k => k.includes("estoque") && k.includes("minimo"));

            let minStockVal = minStockKey ? parseFloat(item[minStockKey]) : 0;
            if (isNaN(minStockVal)) minStockVal = 0;

            // Tratamento de Unidade
            let unidadeCrua = String(item.unidade || "UN").toUpperCase().trim();
            let unidadeFinal = mapaUnidades[unidadeCrua] || "UN";

            return {
                id: String(item.codigo || ""),
                name: String(item.nome || ""),
                price: precoNum,
                costPrice: parseFloat(item.custo) || 0,
                stock: stockVal,
                minStock: minStockVal, // <--- ADICIONADO
                category: String(item.categoria || item.category || "Geral"),
                imgUrl: String(item.imgurl || item.imgUrl || ""),
                brand: String(item.marca || item.brand || ""),

                // Dados Fiscais
                ncm: String(item.ncm || ""),
                cest: String(item.cest || ""),
                cfop: String(item.cfop || ""),
                unit: unidadeFinal,
                origem: String(item.origem || "0"),
                csosn: String(item.csosn || ""),
                promoPrice: parseFloat(item.promocional || item.promoPrice) || 0
            };
        }).filter(p => p.id && p.id !== "");

        return { status: "success", data: produtos };

    } catch (error) {
        Logger.log("ERRO FATAL em listarTodosProdutos: " + error.toString());
        return { status: "error", message: "Erro ao ler produtos: " + error.toString() };
    }
}

function buscarProdutoPorCodigo(codigo) {
    // ... (função buscarProdutoPorCodigo permanece a mesma) ...
    Logger.log("Executando buscarProdutoPorCodigo: " + codigo); if (!codigo) return { status: "error", message: "Código não fornecido." }; try { const todosProdutosResult = listarTodosProdutos(); if (todosProdutosResult.status === 'error') { return todosProdutosResult; } const produtoEncontrado = todosProdutosResult.data.find(p => p.id === codigo.toString()); if (produtoEncontrado) { Logger.log("Produto encontrado (via listagem): " + JSON.stringify(produtoEncontrado)); return { status: "success", data: produtoEncontrado }; } else { Logger.log("Produto " + codigo + " não encontrado."); return { status: "success", data: null }; } } catch (error) { Logger.log("Erro buscarProdutoPorCodigo " + codigo + ": " + error + " Stack: " + error.stack); return { status: "error", message: "Erro buscar produto." }; }
}

function cadastrarNovoProduto(codigo, nome, preco) {
    Logger.log("Executando cadastrarNovoProduto: " + JSON.stringify({ codigo, nome, preco }));
    if (!codigo || !nome || !preco) return { status: "error", message: "Dados incompletos." };
    const precoNum = parseFloat(preco);
    if (isNaN(precoNum) || precoNum <= 0) return { status: "error", message: "Preço inválido." };

    try {
        const sheet = getSheet(PRODUTOS_SHEET_NAME);
        const buscaExistente = buscarProdutoPorCodigo(codigo);
        if (buscaExistente.status === 'success' && buscaExistente.data !== null) { Logger.log("Prod duplicado: " + codigo); return { status: "error", message: `Produto ${codigo} já existe.` }; }
        else if (buscaExistente.status === 'error') { return buscaExistente; }

        // (MODIFICADO) Adiciona Timestamp
        const timestamp = new Date();
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const newRow = headers.map(header => {
            const lowerHeader = header.toString().trim().toLowerCase();
            if (lowerHeader === 'codigo') return codigo;
            if (lowerHeader === 'nome') return nome;
            if (lowerHeader === 'preco') return precoNum;
            if (lowerHeader === 'timestamp') return timestamp; // Adiciona o timestamp
            return "";
        });

        Logger.log("Adicionando produto: " + JSON.stringify(newRow));
        sheet.appendRow(newRow);
        SpreadsheetApp.flush();

        const novoProduto = { id: codigo.toString(), name: nome, price: precoNum, stock: 0, minStock: 0, unit: 'UN' };
        Logger.log("Produto cadastrado: " + JSON.stringify(novoProduto));
        return { status: "success", data: novoProduto, message: "Produto cadastrado!" };

    } catch (error) {
        Logger.log(`Erro cadastrarNovoProduto ${codigo}: ${error} Stack: ${error.stack}`);
        return { status: "error", message: "Erro ao salvar produto." };
    }
}

// --- Funções de Lógica - Clientes ---
function generateUniqueClientId() { /* ... (sem alterações) ... */ return "CLI" + Date.now().toString(36) + Math.random().toString(36).substring(2, 5).toUpperCase(); }

function obterDadosFaturaCliente(identificador, senhaInformada) {
    const sheet = getSheet(CLIENTES_SHEET_NAME);
    const dados = formatSheetData(sheet);

    // Normalização (limpeza de nome)
    const limpar = (txt) => {
        if (!txt) return "";
        return txt.toString().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, "");
    };

    const busca = limpar(identificador);

    // Busca Cliente
    let cliente = dados.find(c => String(c["id cliente"]) === String(identificador));
    if (!cliente) {
        cliente = dados.find(c => {
            return limpar(c["nome completo"]) === busca || limpar(c["apelido"]) === busca;
        });
    }

    if (!cliente) return { status: "error", message: "Cliente não encontrado." };

    // --- LÓGICA DE SEGURANÇA (LOGIN) ---
    // Verifica se existe senha cadastrada na coluna 'pass'
    // Nota: formatSheetData converte headers para minúsculo, então 'Pass' vira 'pass'
    const senhaCadastrada = cliente["pass"] ? String(cliente["pass"]).trim() : "";

    // Se tiver senha E a senha informada não bater
    if (senhaCadastrada.length > 0 && String(senhaInformada) !== senhaCadastrada) {
        // Retorna APENAS dados básicos para a tela de login
        return {
            status: "auth_required",
            cliente: {
                nome: cliente["nome completo"] || cliente["apelido"],
                // Não enviamos saldo, histórico ou limite aqui por segurança
            }
        };
    }

    // --- SE PASSOU PELA SEGURANÇA, PEGA OS DADOS ---
    const idClienteReal = cliente["id cliente"] || cliente["idcliente"];

    // Helper robusto para encontrar valor varrendo as chaves
    const findVal = (keywords) => {
        const keys = Object.keys(cliente);
        for (const word of keywords) {
            // Tenta achar alguma chave que contenha essa palavra (ex: "nome" acha "nome completo")
            const match = keys.find(k => k.toString().toLowerCase().includes(word.toLowerCase()));
            if (match && cliente[match]) return cliente[match];
        }
        return "";
    };

    const sheetLogs = getSheet(LOGS_SHEET_NAME);
    const logsData = sheetLogs.getDataRange().getValues();

    const logs = [];
    for (let i = 1; i < logsData.length; i++) {
        const idLog = String(logsData[i][1]);
        // Verifica se bate o ID (ignorando case)
        if (idLog && idLog.toLowerCase() === String(idClienteReal).toLowerCase()) {
            logs.push({
                data: logsData[i][6] || logsData[i][0],
                tipo: logsData[i][2],
                valor: parseFloat(logsData[i][3]),
                obs: logsData[i][5],
                vencimentoParcela: logsData[i][8],
                anexo: logsData[i][7]
            });
        }
    }

    return {
        status: "success",
        cliente: {
            id: idClienteReal,
            nome: findVal(["nome", "cliente", "apelido"]) || "Cliente",
            diaVencimento: findVal(["dia", "vencimento"]) || 10,
            saldo: parseFloat(findVal(["saldo", "devedor"])) || 0,
            limite: parseFloat(findVal(["limite"])) || 0,
            telefone: findVal(["telefone", "celular", "contato", "zap"]),
            endereco: findVal(["endereço", "endereco", "local", "rua"])
        },
        historico: logs,
        _debugKeys: Object.keys(cliente) // Para ajudar a diagnosticar se falhar de novo
    };
}

// --- 2. FUNÇÃO DE CADASTRO DE CLIENTE (Atualizada para salvar o Dia Fixo) ---
function cadastrarNovoCliente(params) {
    Logger.log("Executando cadastrarNovoCliente: " + JSON.stringify(params));

    // Extrai os dados novos (diaVencimento e limite)
    const {
        nomeCompleto,
        apelido,
        telefone,
        endereco,
        valorCompra,
        numParcelas,
        diaVencimento, // [NOVO] Vem do HTML
        limite         // [NOVO] Vem do HTML
    } = params;

    if (!apelido) return { status: "error", message: "Apelido obrigatório." };

    const valorCompraNum = parseFloat(valorCompra) || 0; // Se não houver compra inicial, é 0
    const numParcelasNum = parseInt(numParcelas) || 0;

    // Gera ID e Data
    const idCliente = generateUniqueClientId();
    const dataCadastro = new Date();

    // Define o Dia de Vencimento Fixo (Padrão dia 10 se não vier nada)
    const diaVencimentoFixo = parseInt(diaVencimento) || 10;
    const limiteCredito = parseFloat(limite) || 0;

    // Calcula um "Próximo Vencimento" visual inicial baseado no dia fixo escolhido
    // Apenas para não deixar a coluna visual vazia
    let dataVisualVencimento = new Date();
    if (dataVisualVencimento.getDate() >= diaVencimentoFixo) {
        // Se hoje já passou do dia escolhido, joga pro mês que vem
        dataVisualVencimento.setMonth(dataVisualVencimento.getMonth() + 1);
    }
    dataVisualVencimento.setDate(diaVencimentoFixo);

    try {
        const clientesSheet = getSheet(CLIENTES_SHEET_NAME);

        // Mapeamento dinâmico baseado nos cabeçalhos da planilha
        const headersRange = clientesSheet.getRange(1, 1, 1, clientesSheet.getLastColumn());
        const clienteHeaders = headersRange.getValues()[0];

        const clienteRow = clienteHeaders.map(header => {
            const lowerHeader = header.toString().trim().toLowerCase();

            switch (lowerHeader) {
                case 'id cliente': return idCliente;
                case 'nome completo': return nomeCompleto || "";
                case 'apelido': return apelido;
                case 'telefone': return telefone || "";
                case 'endereço': return endereco || "";
                case 'saldo devedor': return valorCompraNum;
                case 'parcelas totais': return numParcelasNum;
                case 'parcelas pagas': return 0;
                case 'próximo vencimento': return dataVisualVencimento; // Data calculada
                case 'data cadastro': return dataCadastro;

                // [MUDANÇA AQUI]: Mapeamento das novas colunas
                case 'dia vencimento': return diaVencimentoFixo;
                case 'limite': return limiteCredito;

                default: return "";
            }
        });

        Logger.log("Add cliente: " + JSON.stringify(clienteRow));
        clientesSheet.appendRow(clienteRow);

        // Se houve compra inicial no cadastro, registra no log
        if (valorCompraNum > 0) {
            const logsSheet = getSheet(LOGS_SHEET_NAME);
            logsSheet.appendRow([
                new Date(),
                idCliente,
                "Compra",
                valorCompraNum,
                "1/1",
                "Compra inicial cadastro",
                dataCadastro
            ]);
        }

        SpreadsheetApp.flush();

        const novoCliente = {
            idCliente: idCliente,
            nomeExibicao: nomeCompleto || apelido,
            apelido: apelido,
            saldoDevedor: valorCompraNum,
            proximoVencimento: Utilities.formatDate(dataVisualVencimento, Session.getScriptTimeZone(), 'dd/MM/yyyy'),
            diaVencimento: diaVencimentoFixo,
            limite: limiteCredito
        };

        return { status: "success", data: novoCliente, message: "Cliente cadastrado!" };

    } catch (error) {
        Logger.log(`Erro cadastrarNovoCliente ${apelido}: ${error} Stack: ${error.stack}`);
        return { status: "error", message: "Erro salvar cliente: " + error.message };
    }
}

// --- (NOVO) Funções de Lógica - Caixa ---

function registrarAberturaCaixa(valorNotas, valorMoedas) {
    Logger.log("Registrando abertura de caixa...");
    const valorNotasNum = parseFloat(valorNotas);
    const valorMoedasNum = parseFloat(valorMoedas);

    if (isNaN(valorNotasNum) || valorNotasNum < 0 || isNaN(valorMoedasNum) || valorMoedasNum < 0) {
        return { status: "error", message: "Valores de abertura inválidos." };
    }

    try {
        const sheet = getSheet(CAIXA_SHEET_NAME);
        const timestamp = new Date();
        const rowData = [timestamp, "Abertura", valorNotasNum, valorMoedasNum, "", "", "", "", "", "", ""]; // Deixa campos de fechamento vazios

        Logger.log("Adicionando abertura à planilha: " + JSON.stringify(rowData));
        sheet.appendRow(rowData);
        SpreadsheetApp.flush();
        Logger.log("Abertura de caixa registrada.");
        return { status: "success", message: "Caixa aberto com sucesso!" };

    } catch (error) {
        Logger.log(`Erro em registrarAberturaCaixa: ${error} Stack: ${error.stack}`);
        return { status: "error", message: "Erro ao registrar abertura do caixa." };
    }
}

function registrarFechamentoCaixa(params) {
    Logger.log("Registrando fechamento de caixa: " + JSON.stringify(params));
    const {
        valorFinalNotas, valorFinalMoedas, vendaCartao, vendaPixFixo,
        valorDeposito, valorFicaCaixa, assinatura
    } = params;

    // Validações
    const valorFinalNotasNum = parseFloat(valorFinalNotas);
    const valorFinalMoedasNum = parseFloat(valorFinalMoedas);
    const vendaCartaoNum = parseFloat(vendaCartao);
    const vendaPixFixoNum = parseFloat(vendaPixFixo || 0); // Opcional, default 0
    const valorDepositoNum = parseFloat(valorDeposito);
    const valorFicaCaixaNum = parseFloat(valorFicaCaixa);

    if (isNaN(valorFinalNotasNum) || valorFinalNotasNum < 0 ||
        isNaN(valorFinalMoedasNum) || valorFinalMoedasNum < 0 ||
        isNaN(vendaCartaoNum) || vendaCartaoNum < 0 ||
        isNaN(vendaPixFixoNum) || vendaPixFixoNum < 0 ||
        isNaN(valorDepositoNum) || valorDepositoNum < 0 ||
        isNaN(valorFicaCaixaNum) || valorFicaCaixaNum < 0 ||
        !assinatura) {
        return { status: "error", message: "Dados do fechamento inválidos ou incompletos." };
    }

    // Validação adicional: Depósito + Fica Caixa deve ser próximo ao total contado (permitindo pequena margem)
    const totalContado = valorFinalNotasNum + valorFinalMoedasNum;
    const totalDestinado = valorDepositoNum + valorFicaCaixaNum;
    if (Math.abs(totalContado - totalDestinado) > 0.01) { // Permite 1 centavo de diferença
        Logger.log(`Validacao falhou: Contado (${totalContado}) != Destinado (${totalDestinado})`);
        // Poderia retornar erro, mas por enquanto vamos apenas logar e continuar
        // return { status: "error", message: `A soma do valor para depósito (${formatCurrencyGAS(valorDepositoNum)}) e do valor que fica no caixa (${formatCurrencyGAS(valorFicaCaixaNum)}) não bate com o total contado em dinheiro (${formatCurrencyGAS(totalContado)}). Verifique os valores.` };
    }


    try {
        const sheet = getSheet(CAIXA_SHEET_NAME);
        const timestamp = new Date();
        const rowData = [
            timestamp, "Fechamento", "", "", // Deixa campos de abertura vazios
            valorFinalNotasNum, valorFinalMoedasNum, vendaCartaoNum, vendaPixFixoNum,
            valorDepositoNum, valorFicaCaixaNum, assinatura
        ];

        Logger.log("Adicionando fechamento à planilha: " + JSON.stringify(rowData));
        sheet.appendRow(rowData);
        SpreadsheetApp.flush();
        Logger.log("Fechamento de caixa registrado.");
        return { status: "success", message: "Caixa fechado com sucesso!" };

    } catch (error) {
        Logger.log(`Erro em registrarFechamentoCaixa: ${error} Stack: ${error.stack}`);
        return { status: "error", message: "Erro ao registrar fechamento do caixa." };
    }
}

// Função auxiliar para formatar moeda dentro do Apps Script (se necessário para mensagens de erro)
function formatCurrencyGAS(value) {
    try {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    } catch (e) {
        return "R$ " + (value || 0).toFixed(2);
    }
}

// --- Função para Registrar Log (Compra ou Pagamento) ---

// --- FUNÇÃO DE CÁLCULO DE VENCIMENTOS (Lógica de Cartão) ---
function calcularDatasParcelas(diaVencimento, dataCompra, qtdParcelas) {
    const DIAS_CORTE = 10; // Fatura fecha 10 dias antes do vencimento
    const diaVenc = parseInt(diaVencimento) || 10;

    // 1. Descobre o PRIMEIRO vencimento
    let dataPrimeiroVenc = new Date(dataCompra.getFullYear(), dataCompra.getMonth(), diaVenc);
    let dataCorte = new Date(dataPrimeiroVenc);
    dataCorte.setDate(dataPrimeiroVenc.getDate() - DIAS_CORTE);

    // Se comprou DEPOIS do corte, só vence no outro mês
    if (dataCompra >= dataCorte) {
        dataPrimeiroVenc.setMonth(dataPrimeiroVenc.getMonth() + 1);
    } else {
        // Se comprou ANTES do corte, mas o dia já passou (ex: compra dia 12, vence dia 10), joga pro próximo
        if (dataCompra > dataPrimeiroVenc) {
            dataPrimeiroVenc.setMonth(dataPrimeiroVenc.getMonth() + 1);
        }
    }

    // 2. Gera o array de datas para todas as parcelas
    let datas = [];
    for (let i = 0; i < qtdParcelas; i++) {
        let dataParcela = new Date(dataPrimeiroVenc);
        dataParcela.setMonth(dataPrimeiroVenc.getMonth() + i); // Soma meses
        datas.push(Utilities.formatDate(dataParcela, Session.getScriptTimeZone(), 'dd/MM/yyyy'));
    }

    return datas;
}

function registrarTransacao(params) {
    const lock = LockService.getScriptLock();
    lock.tryLock(10000);

    try {
        // Adicionei isEntrada na desestruturação
        const { idCliente, valor, tipo, parcelas, isEntrada } = params;

        const numParcelas = parseInt(parcelas) || 1;
        const valorTotal = parseFloat(valor); // Negativo se for pagamento

        if (!idCliente || !valorTotal) return { status: "error", message: "Dados incompletos." };

        const sheetClientes = getSheet(CLIENTES_SHEET_NAME);
        const dadosClientes = sheetClientes.getDataRange().getValues();
        let linhaCliente = -1;
        let diaVencimentoCliente = 10;

        // 1. Localiza Cliente e Atualiza Saldo
        for (let i = 1; i < dadosClientes.length; i++) {
            if (String(dadosClientes[i][0]) === String(idCliente)) {
                linhaCliente = i + 1;
                let valDia = parseInt(dadosClientes[i][10]);
                if (valDia > 0) diaVencimentoCliente = valDia;

                const saldoAnterior = parseFloat(dadosClientes[i][5]) || 0;
                const novoSaldo = saldoAnterior + valorTotal;

                // Grava Novo Saldo
                sheetClientes.getRange(linhaCliente, 6).setValue(novoSaldo);

                // --- AUTOMAÇÃO DE DATA DE VENCIMENTO ---
                // Se QUITOU TUDO (Saldo zerado ou credor)
                if (novoSaldo <= 0.01) {
                    sheetClientes.getRange(linhaCliente, 9).setValue("");
                }
                // Se for COMPRA NOVA saindo do zero
                else if (saldoAnterior <= 0.01 && novoSaldo > 0.01) {
                    // Define o primeiro vencimento padrão
                    const hoje = new Date();
                    let dataVenc = new Date(hoje.getFullYear(), hoje.getMonth(), diaVencimentoCliente);
                    // Se já passou do dia de corte (ex: dia 10), joga pro próximo
                    if (hoje.getDate() >= diaVencimentoCliente) {
                        dataVenc.setMonth(dataVenc.getMonth() + 1);
                    }
                    sheetClientes.getRange(linhaCliente, 9).setValue(dataVenc);
                }
                // Nota: Se for pagamento parcial, a função calcularDataVencimentoReal cuidará de atualizar
                // o visual na próxima leitura (listarClientes). Aqui só tratamos Zerar ou Iniciar.

                break;
            }
        }

        if (linhaCliente === -1) return { status: "error", message: "Cliente não encontrado." };

        // 2. Gravação no LOG
        const logsSheet = getSheet(LOGS_SHEET_NAME);

        if (valorTotal > 0) {
            // --- COMPRA (Lógica Mantida) ---
            const valorParcela = valorTotal / numParcelas;
            const datasVencimento = calcularDatasParcelas(diaVencimentoCliente, new Date(), numParcelas);
            const novasLinhas = [];
            for (let i = 0; i < numParcelas; i++) {
                let dataVencParcela = datasVencimento[i];
                novasLinhas.push([new Date(), idCliente, tipo || "Compra", valorParcela, `${i + 1}/${numParcelas}`, `Compra Parc.`, new Date(), "", dataVencParcela]);
            }
            if (novasLinhas.length > 0) {
                const startRow = logsSheet.getLastRow() + 1;
                logsSheet.getRange(startRow, 1, novasLinhas.length, novasLinhas[0].length).setValues(novasLinhas);
            }
            return { status: "success", message: `Compra registrada.` };

        } else {
            // --- PAGAMENTO (Lógica Alterada) ---

            // Define o texto da observação baseado no parâmetro enviado pelo Front
            // Se isEntrada for true, salva "Entrada", senão o padrão.
            const observacao = (isEntrada === true || isEntrada === "true") ? "Entrada" : "Pagamento Mínimo/Total";

            logsSheet.appendRow([
                new Date(),
                idCliente,
                "Pagamento",
                valorTotal,
                "-",
                observacao, // <--- AQUI ESTÁ A MUDANÇA
                new Date(),
                "",
                "-"
            ]);
            return { status: "success", message: "Pagamento registrado." };
        }

    } catch (error) {
        Logger.log("Erro Transacao: " + error);
        return { status: "error", message: error.toString() };
    } finally {
        lock.releaseLock();
    }
}

function obterHistoricoCliente(idCliente) {
    try {
        const sheet = getSheet(LOGS_SHEET_NAME);
        const data = sheet.getDataRange().getValues();
        // Estrutura esperada: [Timestamp, ID, Tipo, Valor, Parcela, Obs, Data, ANEXO]

        const historico = [];

        // Começa do fim para o início (para mostrar os mais recentes primeiro)
        // i >= 1 para pular o cabeçalho
        for (let i = data.length - 1; i >= 1; i--) {
            const row = data[i];
            // Coluna 1 é o ID do Cliente
            if (String(row[1]) === String(idCliente)) {

                let dataFormatada = "";
                try {
                    // Tenta formatar a data (Coluna 0)
                    if (row[0]) {
                        dataFormatada = Utilities.formatDate(new Date(row[0]), Session.getScriptTimeZone(), 'dd/MM/yy HH:mm');
                    }
                } catch (e) { }

                historico.push({
                    data: dataFormatada,
                    tipo: row[2],        // Tipo (Compra/Pagamento)
                    valor: row[3],       // Valor
                    obs: row[5],         // Observação
                    anexo: row[7] || ""  // Link do Anexo (se existir)
                });

                // Limite de segurança: retornar apenas os últimos 50 registros para não pesar
                if (historico.length >= 50) break;
            }
        }

        return { status: "success", data: historico };

    } catch (e) {
        return { status: "error", message: "Erro ao buscar histórico: " + e.toString() };
    }
}


function importarProdutosEmMassa(novosProdutos) {
    const lock = LockService.getScriptLock();
    try {
        lock.waitLock(30000);
        const sheet = getSheet(PRODUTOS_SHEET_NAME);
        const range = sheet.getDataRange();
        const data = range.getValues();

        if (data.length === 0) {
            // Cria cabeçalhos se a planilha estiver vazia
            sheet.appendRow(["Codigo", "Nome", "Preco", "Timestamp", "Custo", "Categoria", "Cadastrado", "ImgUrl", "Marca", "NCM", "CEST", "CFOP", "Unidade", "Origem", "CSOSN"]);
            return importarProdutosEmMassa(novosProdutos);
        }

        // --- MAPEAMENTO INTELIGENTE DAS COLUNAS DE DESTINO ---
        // Transforma os cabeçalhos da planilha 'produtos' em minúsculo para facilitar a busca
        let headers = data[0].map(h => h.toString().toLowerCase().trim());

        // Função auxiliar para achar o número da coluna (ou criar se não existir)
        const getOrAddHeader = (name) => {
            let idx = headers.indexOf(name.toLowerCase());
            if (idx === -1) {
                // Se não achar a coluna, cria ela no final
                sheet.getRange(1, headers.length + 1).setValue(name);
                headers.push(name.toLowerCase());
                idx = headers.length - 1;
            }
            return idx;
        };

        // Identifica onde estão as colunas na aba 'produtos'
        const idxCodigo = headers.indexOf("codigo");
        // Aqui garantimos que ele ache a coluna "Custo" e "Marca" do destino
        const idxNome = getOrAddHeader("Nome");
        const idxPreco = getOrAddHeader("Preco");
        const idxCusto = getOrAddHeader("Custo");
        const idxMarca = getOrAddHeader("Marca");
        const idxImg = getOrAddHeader("ImgUrl");
        // Fiscais
        const idxNcm = getOrAddHeader("NCM");
        const idxCest = getOrAddHeader("CEST");
        const idxCfop = getOrAddHeader("CFOP");
        const idxUnidade = getOrAddHeader("Unidade");
        const idxOrigem = getOrAddHeader("Origem");
        const idxCsosn = getOrAddHeader("CSOSN");
        const idxTimestamp = getOrAddHeader("Timestamp");

        // Cria um mapa para saber em qual linha está cada produto existente
        const mapaExistentes = {};
        for (let i = 1; i < data.length; i++) {
            const cod = String(data[i][idxCodigo]).trim();
            if (cod) mapaExistentes[cod] = i + 1; // Salva o número da linha
        }

        const timestampNow = new Date();
        const novosParaAdicionar = [];

        // --- LOOP DE PROCESSAMENTO ---
        novosProdutos.forEach(prod => {
            const codigo = String(prod.codigo || prod.id).trim();
            if (!codigo) return;

            // >>>> AQUI ESTÁ A CORREÇÃO DE LEITURA (A PONTE) <<<<
            // O script lê 'custo' (do CSV) ou 'costPrice' (do sistema antigo)
            const custoReal = parseFloat(prod.custo !== undefined ? prod.custo : (prod.costPrice || 0));

            // O script lê 'brand' (do CSV) ou 'marca' (se houver)
            const marcaReal = prod.brand || prod.marca || "";

            const nome = prod.nome || prod.name || "";
            const preco = parseFloat(prod.preco || prod.price) || 0;
            const imgUrl = prod.imgUrl || "";

            // Dados Fiscais
            const ncm = prod.ncm || "";
            const cest = prod.cest || "";
            const cfop = prod.cfop || "";
            const unidade = prod.unidade || prod.unit || "UN";
            const origem = prod.origem || "0";
            const csosn = prod.csosn || "";

            if (mapaExistentes[codigo]) {
                // === ATUALIZAR PRODUTO JÁ EXISTENTE ===
                const linha = mapaExistentes[codigo];

                // Atualiza Nome e Preço
                sheet.getRange(linha, idxNome + 1).setValue(nome);
                sheet.getRange(linha, idxPreco + 1).setValue(preco);

                // >>>> AQUI FORÇAMOS A ATUALIZAÇÃO DO CUSTO E MARCA <<<<
                // Se vier valor de custo, atualiza a coluna Custo
                if (custoReal > 0) sheet.getRange(linha, idxCusto + 1).setValue(custoReal);
                // Se vier valor de marca, atualiza a coluna Marca
                if (marcaReal) sheet.getRange(linha, idxMarca + 1).setValue(marcaReal);

                if (imgUrl) sheet.getRange(linha, idxImg + 1).setValue(imgUrl);
                sheet.getRange(linha, idxTimestamp + 1).setValue(timestampNow);

                // Atualiza Fiscais
                if (ncm) sheet.getRange(linha, idxNcm + 1).setValue(ncm);
                if (cest) sheet.getRange(linha, idxCest + 1).setValue(cest);
                if (cfop) sheet.getRange(linha, idxCfop + 1).setValue(cfop);
                if (unidade) sheet.getRange(linha, idxUnidade + 1).setValue(unidade);
                if (origem) sheet.getRange(linha, idxOrigem + 1).setValue(origem);
                if (csosn) sheet.getRange(linha, idxCsosn + 1).setValue(csosn);

            } else {
                // === CRIAR NOVO PRODUTO ===
                const novaLinha = new Array(headers.length).fill("");
                novaLinha[idxCodigo] = codigo;
                novaLinha[idxNome] = nome;
                novaLinha[idxPreco] = preco;

                // >>>> AQUI PREENCHEMOS NO NOVO CADASTRO <<<<
                novaLinha[idxCusto] = custoReal;
                novaLinha[idxMarca] = marcaReal;

                novaLinha[idxImg] = imgUrl;
                novaLinha[idxNcm] = ncm;
                novaLinha[idxCest] = cest;
                novaLinha[idxCfop] = cfop;
                novaLinha[idxUnidade] = unidade;
                novaLinha[idxOrigem] = origem;
                novaLinha[idxCsosn] = csosn;
                novaLinha[idxTimestamp] = timestampNow;

                novosParaAdicionar.push(novaLinha);
            }
        });

        // Se tiver novos, adiciona no final em lote
        if (novosParaAdicionar.length > 0) {
            const startRow = sheet.getLastRow() + 1;
            sheet.getRange(startRow, 1, novosParaAdicionar.length, headers.length).setValues(novosParaAdicionar);
        }

        return { status: "success", message: `Concluído! ${novosProdutos.length} produtos processados.` };
    } catch (e) {
        return { status: "error", message: "Erro no Script: " + e.toString() };
    } finally {
        lock.releaseLock();
    }
}



// --- CONSTANTES ---
const HISTORIC_SHEET_NAME = "historic";

// --- NOVO: Função para Salvar no Histórico Detalhado ---
function registrarHistoricoCompleto(dados) {
    const lock = LockService.getScriptLock();
    lock.tryLock(10000);

    try {
        const sheet = getSheet(HISTORIC_SHEET_NAME);

        // Garante cabeçalhos se for nova
        if (sheet.getLastRow() === 0) {
            sheet.appendRow(["Data/Hora", "Cliente", "Vendedor", "Valor Total", "Produtos", "Pagamento", "ID Venda"]);
        }

        // Formata a lista de produtos (ex: Bola Azul (2x), Caderno (1x)...)
        // O front-end já deve mandar uma string ou array, aqui garantimos que vire string
        const produtosString = dados.produtos || "";

        sheet.appendRow([
            new Date(),                 // Data/Hora (Timestamp automático)
            dados.cliente,              // Nome do Cliente
            dados.vendedor,             // Vendedor
            dados.valor,                // Valor Numérico
            produtosString,             // String formatada dos itens
            dados.pagamento,            // Forma de Pagamento
            dados.idVenda || ""         // ID único (opcional, mas bom ter)
        ]);

        return { status: "success", message: "Histórico registrado." };

    } catch (e) {
        Logger.log("Erro ao salvar histórico: " + e);
        return { status: "error", message: e.toString() };
    } finally {
        lock.releaseLock();
    }
}

// --- NOVO: Função para Ler o Histórico do Dia (para o PDV) ---
// --- Função para Ler o Histórico do Dia (Atualizada para filtrar HOJE) ---
function listarHistoricoVendas() {
    try {
        const sheet = getSheet(HISTORIC_SHEET_NAME);
        const data = sheet.getDataRange().getValues();

        if (data.length <= 1) return { status: "success", data: [] };

        const historico = [];
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0); // Zera o horário para comparar apenas o dia

        // Itera do fim para o começo (mais recentes primeiro)
        for (let i = data.length - 1; i >= 1; i--) {
            const row = data[i];
            const dataVenda = new Date(row[0]); // Coluna A (Data/Hora)

            // Cria uma cópia da data da venda zerada para comparar
            const dataVendaZerada = new Date(dataVenda);
            dataVendaZerada.setHours(0, 0, 0, 0);

            // --- FILTRO: Apenas vendas de HOJE ---
            if (dataVendaZerada.getTime() !== hoje.getTime()) {
                // Se não for hoje, para o loop? Não, pois a planilha pode não estar ordenada. 
                // Apenas pula (continue). Se tiver certeza da ordem, poderia usar break.
                continue;
            }

            historico.push({
                data: Utilities.formatDate(dataVenda, Session.getScriptTimeZone(), 'HH:mm'), // Apenas hora, pois o dia é hoje
                fullDate: row[0], // Data completa para uso interno
                cliente: row[1],
                vendedor: row[2],
                valor: row[3],
                produtos: row[4],
                pagamento: row[5],
                idVenda: row[6] || ""
            });
        }

        return { status: "success", data: historico };
    } catch (e) {
        return { status: "error", message: "Erro ao ler histórico: " + e.toString() };
    }
}

// =================================================================
// [ATUALIZADO] LÓGICA DE CRÉDITO INTEGRADA (CLIENTES + LOGS)
// =================================================================


// Função auxiliar: Calcula vencimento estilo Cartão de Crédito
// diaVencimento: número (ex: 10)
// dataCompra: objeto Date
function calcularVencimentoFatura(diaVencimento, dataCompra) {
    const DIAS_CORTE = 10; // A fatura fecha 10 dias antes do vencimento (Configurável)

    // Garante que é número
    const diaVenc = parseInt(diaVencimento) || 10; // Default dia 10 se não tiver

    // Cria a data de vencimento teórica neste mês
    let dataVencimento = new Date(dataCompra.getFullYear(), dataCompra.getMonth(), diaVenc);

    // Cria a data de corte (fechamento) deste mês
    let dataFechamento = new Date(dataVencimento);
    dataFechamento.setDate(dataVencimento.getDate() - DIAS_CORTE);

    // LÓGICA DE VIRADA DE FATURA:
    // Se a compra foi feita DEPOIS ou NO dia do fechamento, joga para o próximo mês.
    // Caso contrário, tenta manter no mês atual (ou próximo se o dia já passou).

    // Exemplo: Venc dia 15. Corte dia 05.
    // Compra dia 06/01 -> Passou do corte (05/01). Vencimento vai para 15/02.
    // Compra dia 02/01 -> Antes do corte. Vencimento seria 15/01.

    if (dataCompra >= dataFechamento) {
        // Comprou depois do fechamento: Pula para o vencimento do mês seguinte
        // Mas cuidado: se o vencimento for dia 5 e hoje é dia 20, "mês seguinte" é o próximo.
        // Vamos simplificar: Vencimento é sempre no futuro.

        // Adiciona 1 mês na data de vencimento base
        dataVencimento.setMonth(dataVencimento.getMonth() + 1);

        // Verificação extra: Se virou o ano, o JS resolve sozinho (ex: mês 13 vira jan do próx ano)
    } else {
        // Comprou antes do fechamento.
        // Se a data de vencimento já passou hoje (ex: compra dia 12, vencimento era dia 10), joga pro próximo.
        if (dataCompra > dataVencimento) {
            dataVencimento.setMonth(dataVencimento.getMonth() + 1);
        }
    }

    return dataVencimento;
}

// =======================================================
// CÁLCULO DE MÉTRICAS UNIFICADO (CORREÇÃO GRÁFICO 100%)
// =======================================================

function calcularMetricasCrediario() {
    try {
        const sheetClientes = getSheet(CLIENTES_SHEET_NAME);
        const dadosClientes = formatSheetData(sheetClientes);
        const sheetLogs = getSheet(LOGS_SHEET_NAME);
        const dadosLogsRaw = sheetLogs.getDataRange().getValues();
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const mesAtual = hoje.getMonth();
        const anoAtual = hoje.getFullYear();
        let recebidoMes = 0;
        const logsPorCliente = {};
        for (let i = 1; i < dadosLogsRaw.length; i++) {
            const row = dadosLogsRaw[i];
            const idCli = String(row[1]);
            if (!idCli) continue;
            if (!logsPorCliente[idCli]) logsPorCliente[idCli] = [];
            const tipo = String(row[2]).toLowerCase();
            const valor = parseFloat(row[3]) || 0;
            const dataLog = row[0] instanceof Date ? row[0] : new Date(row[0]);
            const logItem = {
                tipo: tipo,
                valor: valor,
                dataVenda: row[6] instanceof Date ? row[6] : dataLog,
                vencimentoParcela: row[8] instanceof Date ? row[8] : null,
                // [CORREÇÃO AQUI]: Lendo a obs para detectar a data manual
                obs: String(row[5] || "")
            };
            logsPorCliente[idCli].push(logItem);
            if (dataLog.getMonth() === mesAtual && dataLog.getFullYear() === anoAtual) {
                if ((tipo.includes("pagamento") || tipo.includes("baixa")) && !tipo.includes("reneg")) {
                    recebidoMes += Math.abs(valor);
                }
            }
        }
        let totalDividaAtiva = 0;
        let totalDividaAtrasada = 0;
        let totalLimiteConcedido = 0;
        let valR14 = 0, valR30 = 0, valR90 = 0;
        dadosClientes.forEach(cli => {
            const id = String(cli["id cliente"]);
            const saldo = parseBrFloat(cli["saldo devedor"]);
            const limite = parseBrFloat(cli["limite"]);
            const diaVenc = parseInt(cli["dia vencimento"]) || 10;
            totalLimiteConcedido += limite;
            if (saldo > 0.01) {
                totalDividaAtiva += saldo;
                const logsDoCliente = logsPorCliente[id] || [];
                const dataVencReal = calcularDataVencimentoReal(logsDoCliente, diaVenc);
                if (dataVencReal) {
                    dataVencReal.setHours(0, 0, 0, 0);
                    if (dataVencReal < hoje) {
                        totalDividaAtrasada += saldo;
                        const diffTime = Math.abs(hoje - dataVencReal);
                        const diasAtraso = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        if (diasAtraso > 90) valR90 += saldo;
                        else if (diasAtraso > 30) valR30 += saldo;
                        else if (diasAtraso >= 1) valR14 += saldo;
                    }
                }
            }
        });
        const base = totalDividaAtiva > 0 ? totalDividaAtiva : 1;
        const fix = (n) => n.toFixed(1);
        return {
            status: "success",
            used: totalDividaAtiva,
            limit: totalLimiteConcedido,
            receivedMonth: recebidoMes,
            payingPercent: fix(((totalDividaAtiva - totalDividaAtrasada) / base) * 100),
            totalRiskPercent: fix((totalDividaAtrasada / base) * 100),
            risk14: fix((valR14 / base) * 100),
            risk30: fix((valR30 / base) * 100),
            risk90: fix((valR90 / base) * 100)
        };
    } catch (e) {
        return { status: "error", message: e.toString() };
    }
}


function parseBrFloat(value) {
    if (typeof value === "number") return value;
    if (!value) return 0;
    // Remove R$, espaços e converte vírgula em ponto
    let cleanValue = value.toString().replace(/[R$\s]/g, "").replace(",", ".");
    return parseFloat(cleanValue) || 0;
}

function listarTodosClientes() {
    try {
        const sheet = getSheet(CLIENTES_SHEET_NAME);
        const dataClientes = formatSheetData(sheet);
        const sheetLogs = getSheet(LOGS_SHEET_NAME);
        const dadosLogs = sheetLogs.getDataRange().getValues();
        const logsPorCliente = {};

        // Helper para garantir float correto
        const safeFloat = (val) => {
            if (typeof val === 'number') return val;
            if (!val) return 0;
            let str = val.toString().replace("R$", "").trim();
            if (str.includes(",") && str.includes(".")) {
                str = str.replace(".", "").replace(",", ".");
            } else if (str.includes(",")) {
                str = str.replace(",", ".");
            }
            return parseFloat(str) || 0;
        };

        for (let i = 1; i < dadosLogs.length; i++) {
            const row = dadosLogs[i];
            const id = String(row[1]);
            if (!id) continue;
            if (!logsPorCliente[id]) logsPorCliente[id] = [];

            logsPorCliente[id].push({
                tipo: String(row[2]).toLowerCase(),
                valor: safeFloat(row[3]),
                parcela: String(row[4] || ""), // Captura coluna 'Parcela N/Total'
                dataVenda: (row[6] instanceof Date) ? row[6] : new Date(row[0]),
                vencimentoParcela: (row[8] instanceof Date) ? row[8] : null,
                obs: String(row[5] || "").toLowerCase()
            });
        }
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const clientes = dataClientes.map(item => {
            const id = String(item["id cliente"] || "");
            if (!id) return null;
            const saldoDevedorNum = parseBrFloat(item["saldo devedor"]);
            const limiteNum = parseBrFloat(item["limite"]);
            const diaVencimento = parseInt(item["dia vencimento"]) || 10;

            // --- CÁLCULO VIA LOGS ---
            let valorParcelaCalc = 0;
            let parcelasRestantesCalc = 0;

            if (saldoDevedorNum > 0.01) {
                const logs = logsPorCliente[id] || [];
                // Ordena logs por data decrescente
                logs.sort((a, b) => b.dataVenda - a.dataVenda);

                // Procura o último log que tenha formato "X/Y" E seja parcelamento
                const ultimoLogParcelado = logs.find(l =>
                    (l.tipo.includes("renegocia") || l.tipo.includes("compra")) &&
                    l.parcela.includes("/")
                );

                if (ultimoLogParcelado) {
                    valorParcelaCalc = safeFloat(ultimoLogParcelado.valor);
                    if (valorParcelaCalc > 0) {
                        parcelasRestantesCalc = Math.ceil(saldoDevedorNum / valorParcelaCalc);
                    }
                } else {
                    // Fallback
                    valorParcelaCalc = saldoDevedorNum;
                    parcelasRestantesCalc = 1;
                }
            }

            let proximoVencimentoFormatado = "Quitado";
            let status = "Quitado";
            let diasAtraso = 0;
            if (saldoDevedorNum > 0.01) {
                const logsDoCliente = logsPorCliente[id] || [];
                const dataCalculada = calcularDataVencimentoReal(logsDoCliente, diaVencimento);
                if (dataCalculada) {
                    proximoVencimentoFormatado = Utilities.formatDate(dataCalculada, Session.getScriptTimeZone(), 'dd/MM/yyyy');
                    const dataVencZerada = new Date(dataCalculada);
                    dataVencZerada.setHours(0, 0, 0, 0);
                    if (dataVencZerada < hoje) {
                        const diffTime = Math.abs(hoje - dataVencZerada);
                        diasAtraso = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        status = "Atrasado";
                    } else {
                        status = "Em Dia";
                    }
                } else {
                    proximoVencimentoFormatado = "À Vencer";
                    status = "Em Dia";
                }
            }
            if (limiteNum <= 0) status = "Bloqueado";
            return {
                idCliente: id,
                nomeCompleto: item["nome completo"] || "",
                nomeExibicao: item["nome completo"] || item["apelido"] || "Sem Nome",
                apelido: item["apelido"] || "",
                saldoDevedor: saldoDevedorNum,
                proximoVencimento: proximoVencimentoFormatado,
                telefone: String(item["telefone"] || "Não informado"),
                endereco: String(item["endereço"] || item["endereco"] || "Não informado"),
                limite: limiteNum,
                diaVencimento: diaVencimento,
                status: status,
                diasAtraso: diasAtraso,
                // [NOVO] Retornando dados calculados via Logs
                parcelasTotais: 0,
                parcelasPagas: 0,
                parcelasRestantes: parcelasRestantesCalc,
                valorParcela: valorParcelaCalc
            };
        }).filter(c => c !== null);
        clientes.sort((a, b) => a.nomeExibicao.localeCompare(b.nomeExibicao));
        return { status: "success", data: clientes };
    } catch (error) {
        return { status: "error", message: error.toString() };
    }
}

function renegociarSaldoCliente(nomeBusca, novaDataStr, numParcelasStr) {
    const lock = LockService.getScriptLock();
    lock.tryLock(10000);

    try {
        if (!nomeBusca || !novaDataStr) return { status: "error", message: "Dados incompletos." };

        const qtdParcelas = parseInt(numParcelasStr) || 1;
        const sheetClientes = getSheet(CLIENTES_SHEET_NAME);
        const dataClientes = sheetClientes.getDataRange().getValues();

        let linhaCliente = -1;
        let saldoAtual = 0;
        let idClienteReal = "";

        const busca = String(nomeBusca).trim().toUpperCase();

        for (let i = 1; i < dataClientes.length; i++) {
            const idRow = String(dataClientes[i][0]).trim().toUpperCase();
            const nomeRow = String(dataClientes[i][1]).trim().toUpperCase();
            const apelidoRow = String(dataClientes[i][2]).trim().toUpperCase();

            if (nomeRow === busca || apelidoRow === busca) {
                linhaCliente = i + 1;
                idClienteReal = dataClientes[i][0];
                saldoAtual = parseFloat(dataClientes[i][5]) || 0;
                break;
            }
        }

        if (linhaCliente === -1) return { status: "error", message: "Cliente '" + nomeBusca + "' não encontrado." };
        if (saldoAtual <= 0.01) return { status: "error", message: "Cliente não possui dívida ativa." };

        // [NOVO] >>> LOG ESPECIAL DE FIXAÇÃO DE DATA <<<
        // Isso garante que o cálculo futuro respeite essa data
        const dataNovaFormatada = novaDataStr.split('-').reverse().join('/');
        logAlteracaoManual(idClienteReal, dataNovaFormatada);

        const sheetLogs = getSheet(LOGS_SHEET_NAME);
        const timestamp = new Date();

        // 1. Log de Baixa
        sheetLogs.appendRow([timestamp, idClienteReal, "Renegociação (Baixa)", -saldoAtual, "-", "Renegociação via Admin", timestamp, "", "-"]);

        // 2. Logs de Nova Dívida
        const p = novaDataStr.split('-');
        const dataPrimeiraParcela = new Date(p[0], p[1] - 1, p[2], 12, 0, 0);
        const valorParcela = saldoAtual / qtdParcelas;
        const novasLinhasLog = [];

        for (let i = 0; i < qtdParcelas; i++) {
            let dataVenc = new Date(dataPrimeiraParcela);
            dataVenc.setMonth(dataPrimeiraParcela.getMonth() + i);
            novasLinhasLog.push([new Date(), idClienteReal, "Renegociação (Nova)", valorParcela, `${i + 1}/${qtdParcelas}`, `Renegociado (${qtdParcelas}x)`, timestamp, "", dataVenc]);
        }

        if (novasLinhasLog.length > 0) {
            sheetLogs.getRange(sheetLogs.getLastRow() + 1, 1, novasLinhasLog.length, novasLinhasLog[0].length).setValues(novasLinhasLog);
        }

        // 3. Atualiza Ficha
        sheetClientes.getRange(linhaCliente, 9).setValue(dataPrimeiraParcela);
        SpreadsheetApp.flush();

        return { status: "success", message: "Renegociado com sucesso!" };

    } catch (error) {
        return { status: "error", message: error.toString() };
    } finally {
        lock.releaseLock();
    }
}

function calcularDataVencimentoReal(logs, diaVencimento) {
    if (!logs || logs.length === 0) return null;
    let manualDate = null;
    let manualTimestamp = 0;
    logs.sort((a, b) => new Date(a.dataVenda).getTime() - new Date(b.dataVenda).getTime());
    for (let i = logs.length - 1; i >= 0; i--) {
        const obs = logs[i].obs || "";
        // [CORRECAO] Flag 'i' para case-insensitive
        const match = obs.match(/Data de vencimento alterada para \{(\d{2}\/\d{2}\/\d{4})\}/i);
        if (match) {
            const parts = match[1].split('/');
            manualDate = new Date(parts[2], parts[1] - 1, parts[0]);
            manualTimestamp = new Date(logs[i].dataVenda).getTime();
            break;
        }
    }
    let relevantLogs = logs;
    if (manualDate) relevantLogs = logs.filter(l => new Date(l.dataVenda).getTime() > manualTimestamp);
    let faturas = {};
    const diaVenc = parseInt(diaVencimento) || 10;
    const HORAS_JANELA_ENTRADA = 24;
    const PERCENTUAL_MAX_ENTRADA = 0.75;
    relevantLogs.forEach(log => {
        const tipo = log.tipo.toLowerCase();
        const valor = parseFloat(log.valor) || 0;
        if (tipo.includes("compra") || tipo.includes("nova") || tipo.includes("reneg")) {
            let dataVenc;
            let dataCompraOriginal = new Date(log.dataVenda);
            if (log.vencimentoParcela && !isNaN(new Date(log.vencimentoParcela).getTime())) {
                dataVenc = new Date(log.vencimentoParcela);
            } else {
                let dataBase = new Date(log.dataVenda);
                dataVenc = new Date(dataBase.getFullYear(), dataBase.getMonth(), diaVenc);
                let dataCorte = new Date(dataVenc);
                dataCorte.setDate(dataVenc.getDate() - 10);
                if (dataBase >= dataCorte && !tipo.includes("reneg")) dataVenc.setMonth(dataVenc.getMonth() + 1);
            }
            dataVenc.setHours(12, 0, 0, 0);
            let chave = Utilities.formatDate(dataVenc, Session.getScriptTimeZone(), 'yyyy-MM');
            if (!faturas[chave]) faturas[chave] = { data: dataVenc, total: 0, valorOriginal: 0, dataCompraRef: dataCompraOriginal };
            faturas[chave].total += valor;
            faturas[chave].valorOriginal += valor;
        }
    });
    const pagamentos = relevantLogs.filter(l => {
        const t = l.tipo.toLowerCase();
        return (t.includes("pagamento") || t.includes("baixa")) && !t.includes("reneg");
    }).sort((a, b) => new Date(a.dataVenda) - new Date(b.dataVenda));
    let chavesOrdenadas = Object.keys(faturas).sort();
    for (let logPag of pagamentos) {
        let valorPagamento = Math.abs(parseFloat(logPag.valor));
        let dataPagamento = new Date(logPag.dataVenda);
        const marcadoManualmente = logPag.obs && logPag.obs.toLowerCase().includes("entrada");
        for (let chave of chavesOrdenadas) {
            let fatura = faturas[chave];
            if (fatura.total <= 0.05) continue;
            let ehEntrada = false;
            if (marcadoManualmente) { ehEntrada = true; }
            else {
                const diffTimeMs = Math.abs(dataPagamento - fatura.dataCompraRef);
                const diffHoras = diffTimeMs / (1000 * 60 * 60);
                if (diffHoras <= HORAS_JANELA_ENTRADA) {
                    const proporcao = valorPagamento / fatura.valorOriginal;
                    if (proporcao < PERCENTUAL_MAX_ENTRADA) ehEntrada = true;
                }
            }
            let saldoAntes = fatura.total;
            if (valorPagamento >= fatura.total - 0.05) {
                valorPagamento -= fatura.total;
                fatura.total = 0;
            } else {
                fatura.total -= valorPagamento;
                if (!ehEntrada && Math.abs(parseFloat(logPag.valor)) >= (saldoAntes * 0.15)) {
                    fatura.data.setMonth(fatura.data.getMonth() + 1);
                }
                valorPagamento = 0;
                break;
            }
        }
    }
    for (let chave of chavesOrdenadas) {
        if (faturas[chave].total > 0.05) return faturas[chave].data;
    }
    if (manualDate) return manualDate;
    return null;
}

function alterarVencimentoManual(identificador, novaData) {
    if (!identificador || !novaData) return { status: "error", message: "Dados incompletos." };
    let idClienteReal = identificador;
    if (!String(identificador).toUpperCase().trim().startsWith("CLI")) {
        const sheet = getSheet(CLIENTES_SHEET_NAME);
        const data = sheet.getDataRange().getValues();
        const busca = String(identificador).trim().toUpperCase();
        for (let i = 1; i < data.length; i++) {
            if (String(data[i][1]).toUpperCase() === busca || String(data[i][2]).toUpperCase() === busca) {
                idClienteReal = data[i][0];
                break;
            }
        }
    }
    let dataFormatada = novaData;
    if (novaData.includes('-')) dataFormatada = novaData.split('-').reverse().join('/');
    try {
        logAlteracaoManual(idClienteReal, dataFormatada);
        return { status: "success", message: "Data de vencimento alterada manualmente." };
    } catch (e) { return { status: "error", message: e.toString() }; }
}
function logAlteracaoManual(idCliente, dataStr) {
    const sheetLogs = getSheet(LOGS_SHEET_NAME);
    const timestamp = new Date();
    sheetLogs.appendRow([timestamp, idCliente, "Alteração Manual", 0, "-", `Data de vencimento alterada para {${dataStr}}`, timestamp, "", "-"]);
}
// [NOVO] Função para alterar limite com Log
function alterarLimite(idCliente, novoLimite) {
    const lock = LockService.getScriptLock();
    lock.tryLock(10000);
    try {
        const sheet = getSheet(CLIENTES_SHEET_NAME);
        const data = sheet.getDataRange().getValues();
        let rowIndex = -1;
        const busca = String(idCliente).trim().toUpperCase();
        // Busca por ID ou Nome/Apelido
        let idReal = idCliente;
        for (let i = 1; i < data.length; i++) {
            if (String(data[i][0]).toUpperCase() === busca || String(data[i][1]).toUpperCase() === busca || String(data[i][2]).toUpperCase() === busca) {
                rowIndex = i + 1;
                idReal = data[i][0];
                break;
            }
        }
        if (rowIndex === -1) return { status: "error", message: "Cliente não encontrado." };
        // Limite fica na Coluna L (Index 11) - Se não mudou ordem
        // Verifica cabeçalho para ter certeza
        const headers = data[0].map(h => h.toString().toLowerCase().trim());
        const idxLimite = headers.indexOf('limite');
        if (idxLimite === -1) return { status: "error", message: "Coluna de Limite não encontrada." };
        // Atualiza Limite
        const novoLimFloat = parseFloat(novoLimite);
        sheet.getRange(rowIndex, idxLimite + 1).setValue(novoLimFloat);
        // Loga a alteração
        const sheetLogs = getSheet(LOGS_SHEET_NAME);
        sheetLogs.appendRow([new Date(), idReal, "Alteração Limite", 0, "-", `Limite alterado para R$ ${novoLimFloat}`, new Date(), "", "-"]);
        return { status: "success", message: "Limite atualizado com sucesso!" };
    } catch (e) {
        return { status: "error", message: e.toString() };
    } finally {
        lock.releaseLock();
    }
}


function logAlteracaoManual(idCliente, dataStr) {
    const sheetLogs = getSheet(LOGS_SHEET_NAME);
    const timestamp = new Date();
    // LOG ESPECIAL: 'Data de vencimento alterada para {dd/MM/yyyy}'
    sheetLogs.appendRow([
        timestamp,
        idCliente,
        "Alteração Manual",
        0,
        "-",
        `Data de vencimento alterada para {${dataStr}}`,
        timestamp,
        "",
        "-"
    ]);
}

// ==========================================
// NOVA FUNÇÃO AUXILIAR: saveProduct
// (Usada pelo Novo Modal de Edição Fiscal)
// ==========================================
function saveProduct(data) {
    const lock = LockService.getScriptLock();
    lock.tryLock(10000);

    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("produtos");
        const rows = sheet.getDataRange().getValues();
        const headers = rows[0].map(h => h.toString().toLowerCase().trim());

        const codigo = String(data.id || "").trim();
        if (!codigo) return { status: "error", message: "Código/ID é obrigatório." };

        // Mapeamento Dinâmico (Header da Planilha -> Valor do Objeto Data)
        // Certifique-se que as chaves aqui (lado esquerdo) batem com os headers da planilha (em minúsculo)
        const mapeamento = {
            "codigo": codigo,
            "nome": data.name,
            "preco": parseFloat(data.price) || 0,
            "timestamp": new Date(),
            "custo": parseFloat(data.costPrice) || 0,
            "estoque atual": parseFloat(data.stock) || 0, // <--- ESTOQUE
            "estoque": parseFloat(data.stock) || 0,       // Fallback
            "categoria": data.category || 'Geral',
            "imgurl": data.imgUrl || '',
            "marca": data.brand || '',
            "ncm": String(data.ncm || ""),
            "cest": String(data.cest || ""),
            "cfop": String(data.cfop || "5102"),
            unit: data.unit || 'UN',
            origem: data.origem || '0',
            csosn: data.csosn || '102',
            "promocional": parseFloat(data.promoPrice) || 0
            // O campo 'cadastrado' (ou TRUE) não parece ter header padrão no getSheet, verifique se precisa
        };

        // Identifica linha pelo código (Coluna A assumida como Codigo ou busca no header?)
        // Vamos assumir que Codigo é a chave primária.
        let rowIndex = -1;
        const idxCodigo = headers.indexOf("codigo");

        if (idxCodigo !== -1) {
            for (let i = 1; i < rows.length; i++) {
                if (String(rows[i][idxCodigo]) === codigo) {
                    rowIndex = i + 1;
                    break;
                }
            }
        } else {
            // Fallback: Procura na coluna 0 se não achar header 'codigo'
            for (let i = 1; i < rows.length; i++) {
                if (String(rows[i][0]) === codigo) {
                    rowIndex = i + 1;
                    break;
                }
            }
        }

        // Reconstrói a linha baseado nos headers existentes na planilha
        // Se a coluna não existir na planilha, o dado é ignorado (segurança)
        const newRowData = headers.map(h => {
            return mapeamento[h] !== undefined ? mapeamento[h] : "";
        });

        if (rowIndex > 0) {
            // Edição: Atualiza linha
            sheet.getRange(rowIndex, 1, 1, newRowData.length).setValues([newRowData]);
            return { status: "success", message: "Produto atualizado!", type: "edit" };
        } else {
            // Criação: Append
            sheet.appendRow(newRowData);
            return { status: "success", message: "Produto criado!", type: "create" };
        }

    } catch (e) {
        return { status: "error", message: e.toString() };
    } finally {
        lock.releaseLock();
    }
}

function migrarDadosDaAbaTemp() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetTemp = ss.getSheetByName("importar_temp");

    if (!sheetTemp) {
        Logger.log("Aba 'importar_temp' não encontrada.");
        return;
    }

    // Pega os dados brutos e normaliza as chaves (cabeçalhos ficam minúsculos)
    const dadosBrutos = formatSheetData(sheetTemp);

    // A CORREÇÃO ESTÁ AQUI: Adicionamos 'custo' e 'brand' ao mapeamento
    const produtosParaImportar = dadosBrutos.map(row => {
        return {
            codigo: row.codigo,
            nome: row.nome || row.descricao,
            preco: row.preco || row.valor,

            // >>> Novas linhas obrigatórias <<<
            custo: row.custo,    // Pega a coluna 'custo' da aba temp
            brand: row.brand,    // Pega a coluna 'brand' da aba temp
            // -------------------------------

            ncm: row.ncm,
            cest: row.cest,
            cfop: row.cfop,
            unidade: row.unidade || row.unid,
            csosn: row.csosn,
            origem: row.origem
        };
    });

    Logger.log(`Processando ${produtosParaImportar.length} produtos...`);

    // Agora a função de importação receberá o objeto completo com custo e marca
    const resultado = importarProdutosEmMassa(produtosParaImportar);

    Logger.log(resultado.message);
}

// --- FUNÇÕES FISCAIS (NOVO) ---

function salvarLogFiscal(data) {
    const lock = LockService.getScriptLock();
    lock.tryLock(30000);

    try {
        const sheet = getSheet(FISCAL_SHEET_NAME);
        const itensIgnoradosStr = (data.itensIgnorados || []).map(i => i.name).join(", ");

        // Alinhado com o novo cabeçalho de 9 colunas
        const rowData = [
            new Date(),
            data.nNF || "---",
            data.saleId || "---",
            data.status || "ERRO",
            data.chave || "",
            data.nProt || "",
            data.mensagem || data.error || "Erro desconhecido", // Captura o erro da API
            itensIgnoradosStr,
            data.xml || ""
        ];

        sheet.appendRow(rowData);
        return { status: "success", message: "Log fiscal atualizado." };
    } catch (e) {
        return { status: "error", message: e.toString() };
    } finally {
        lock.releaseLock();
    }
}

// SUBSTITUA A FUNÇÃO listarLogFiscal POR ESTA VERSÃO CORRIGIDA

// --- NO ARQUIVO Code.js ---

function listarLogFiscal(ignoreLimit) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("fiscal") || ss.getSheetByName("Fiscal");

    if (!sheet) return [];

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    // Pega todos os dados de uma vez
    const data = sheet.getRange(2, 1, lastRow - 1, 9).getValues();

    const logs = [];

    // LOOP INVERTIDO: Começa do fim (notas mais novas) para o começo
    for (let i = data.length - 1; i >= 0; i--) {
        const row = data[i];
        const mensagem = String(row[6] || "").trim(); // Coluna G (Mensagem)

        // === O FILTRO ESTÁ AQUI ===
        // Se for venda simples, PULA para a próxima (continue)
        if (mensagem === "Venda simples registrada") {
            continue;
        }

        // Se passou no filtro, formata os dados
        let dataFormatada = row[0];
        if (row[0] instanceof Date) {
            dataFormatada = row[0].toISOString();
        }

        logs.push({
            timestamp: dataFormatada,
            nNF: String(row[1] || ""),
            idVenda: String(row[2] || ""),
            status: String(row[3] || ""),
            chave: String(row[4] || ""),
            nProt: String(row[5] || ""),
            mensagem: mensagem,
            itensIgnorados: String(row[7] || ""),
            xml: String(row[8] || "")
        });

        // Se já temos 50 notas válidas, paramos de procurar para não travar o script
        // Se já temos 50 notas válidas E NÃO temos a flag ignoreLimit, paramos de procurar
        if (!ignoreLimit && logs.length >= 50) break;
    }

    return logs;
}

// --- FUNÇÃO DE FATURA/MEU ACESSO (SOLICITADA) ---
function obterDadosFaturaCliente(identificador, senhaInformada) {
    try {
        const sheet = getSheet(CLIENTES_SHEET_NAME);
        const data = sheet.getDataRange().getValues();
        let clienteEncontrado = null;
        let idReal = null;

        // Limpa e normaliza a busca (Nome ou ID)
        const busca = String(identificador).toUpperCase().trim();

        // 1. Busca Cliente (ID, Nome ou Apelido)
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            const id = String(row[0]).toUpperCase().trim();
            const nome = String(row[1]).toUpperCase().trim();
            const apelido = String(row[2]).toUpperCase().trim();

            if (id === busca || nome === busca || apelido === busca) {
                // Encontrou!
                idReal = row[0];
                clienteEncontrado = {
                    id: row[0],
                    nome: row[1],
                    apelido: row[2],
                    telefone: row[3],
                    endereco: row[4],
                    saldoDevedor: parseFloat(row[5]) || 0,
                    diaVencimento: parseInt(row[10]) || 10,
                    limite: parseFloat(row[11]) || 0,
                    // Coluna 'Pass' (Senha) está no índice 12
                    senha: String(row[12] || "")
                };
                break;
            }
        }

        if (!clienteEncontrado) {
            return { status: "error", message: "Cliente não encontrado." };
        }

        // 2. Validação de Senha (PIN)
        // Se o cliente tem senha cadastrada, exige conferência
        if (clienteEncontrado.senha && clienteEncontrado.senha.length > 0) {
            if (!senhaInformada || String(senhaInformada) !== clienteEncontrado.senha) {
                // Retorna status especial para abrir modal de senha no front
                return {
                    status: "auth_required",
                    cliente: { nome: clienteEncontrado.nome }
                };
            }
        }

        // 3. Busca Histórico (Logs de Compras/Pagamentos)
        const logs = [];
        const sheetLogs = getSheet(LOGS_SHEET_NAME);
        const dataLogs = sheetLogs.getDataRange().getValues();

        for (let i = 1; i < dataLogs.length; i++) {
            const row = dataLogs[i];
            // ID do cliente está na coluna B (index 1)
            if (String(row[1]) === String(idReal)) {
                logs.push({
                    data: row[0], // Timestamp
                    tipo: row[2],
                    valor: parseFloat(row[3]) || 0,
                    obs: row[5],
                    dataVenda: row[6], // Data Venda/Pagamento (Coluna G)
                    anexo: row[7],     // Link do Comprovante (Coluna H)
                    vencimentoParcela: row[8] // Vencimento (Coluna I)
                });
            }
        }

        // Retorna tudo limpo (removendo a senha por segurança)
        clienteEncontrado.temSenha = (clienteEncontrado.senha && clienteEncontrado.senha.length > 0);
        delete clienteEncontrado.senha;

        return {
            status: "success",
            cliente: clienteEncontrado,
            historico: logs
        };

    } catch (e) {
        return { status: "error", message: e.toString() };
    }
}

// --- 3. ATUALIZAR DADOS CLIENTE (NOVO) ---
function atualizarDadosCliente(dados) {
    const lock = LockService.getScriptLock();
    lock.tryLock(10000);

    try {
        const sheet = getSheet(CLIENTES_SHEET_NAME);
        const dataRange = sheet.getDataRange();
        const values = dataRange.getValues();

        const idClienteAlvo = String(dados.idCliente);
        let rowIndex = -1;

        // Procura a linha do cliente pelo ID (Coluna A = index 0)
        for (let i = 1; i < values.length; i++) {
            if (String(values[i][0]) === idClienteAlvo) {
                rowIndex = i + 1; // Linha da planilha (1-based)
                break;
            }
        }

        if (rowIndex === -1) {
            return { status: "error", message: "Cliente n�o encontrado para atualiza��o." };
        }

        // Atualiza Telefone (Coluna D = 4) e Endere�o (Coluna E = 5)
        // OBS: getRange(row, column) -> Column D is 4, E is 5
        sheet.getRange(rowIndex, 4).setValue(dados.telefone);
        sheet.getRange(rowIndex, 5).setValue(dados.endereco);

        return { status: "success", message: "Dados atualizados com sucesso!" };

    } catch (e) {
        return { status: "error", message: "Erro ao atualizar dados: " + e.toString() };
    } finally {
        lock.releaseLock();
    }
}

function obterPrevisaoFinanceiraMes() {
    Logger.log("--- INICIANDO CÁLCULO DE PREVISÃO MENSAL ---");

    try {
        const sheetLogs = getSheet(LOGS_SHEET_NAME);
        const dataLogs = sheetLogs.getDataRange().getValues();

        const hoje = new Date();
        const mesAtual = hoje.getMonth(); // 0 = Janeiro, 1 = Fevereiro...
        const anoAtual = hoje.getFullYear();

        Logger.log(`Data Base: ${hoje.toLocaleDateString()} | Mês Alvo (Index): ${mesAtual} | Ano: ${anoAtual}`);
        Logger.log(`Total de linhas na planilha de Logs: ${dataLogs.length}`);

        let totalVencendoNoMes = 0;
        let totalRecebidoNoMes = 0;
        let itensSomados = 0;

        // Começa do 1 para pular o cabeçalho
        for (let i = 1; i < dataLogs.length; i++) {
            const row = dataLogs[i];

            const tipo = String(row[2]).toLowerCase();
            const valor = parseFloat(row[3]) || 0;
            const dataRegistro = row[0] instanceof Date ? row[0] : new Date(row[0]);

            // Coluna I (Index 8): Data de Vencimento
            let dataVencimento = null;
            if (row[8] && row[8] instanceof Date) {
                dataVencimento = row[8];
            } else if (row[8]) {
                try { dataVencimento = new Date(row[8]); } catch (e) { }
            }

            // LÓGICA 1: O que vence este mês (Previsão)
            if ((tipo.includes("compra") || tipo.includes("renegociação (nova)")) && dataVencimento) {
                if (dataVencimento.getMonth() === mesAtual && dataVencimento.getFullYear() === anoAtual) {
                    totalVencendoNoMes += valor;
                    itensSomados++;
                    // Descomente a linha abaixo se quiser ver item por item (pode lotar o log)
                    // Logger.log(`Item Somado (Linha ${i+1}): R$ ${valor} - Venc: ${dataVencimento.toLocaleDateString()}`);
                }
            }

            // LÓGICA 2: O que já entrou (Realizado)
            if ((tipo.includes("pagamento") || tipo.includes("baixa")) && !tipo.includes("renegociação")) {
                if (dataRegistro.getMonth() === mesAtual && dataRegistro.getFullYear() === anoAtual) {
                    totalRecebidoNoMes += Math.abs(valor);
                }
            }
        }

        Logger.log("--- RESULTADO FINAL ---");
        Logger.log(`Itens de parcelas encontrados para este mês: ${itensSomados}`);
        Logger.log(`Valor Total Esperado (Vencimento no mês): R$ ${totalVencendoNoMes.toFixed(2)}`);
        Logger.log(`Valor Total Já Recebido (Pagamentos no mês): R$ ${totalRecebidoNoMes.toFixed(2)}`);

        return {
            status: "success",
            mes: mesAtual + 1,
            ano: anoAtual,
            previsao: totalVencendoNoMes,
            realizado: totalRecebidoNoMes,
            pendente: totalVencendoNoMes - totalRecebidoNoMes
        };

    } catch (e) {
        Logger.log("ERRO FATAL: " + e.toString());
        return { status: "error", message: "Erro ao calcular previsão: " + e.toString() };
    }
}

function testarPrevisao() {
    const resultado = obterPrevisaoFinanceiraMes();
    console.log("Objeto de Retorno para o Front-end:", JSON.stringify(resultado, null, 2));
}
function abaterEstoqueLote(itens) {
    const lock = LockService.getScriptLock();
    lock.tryLock(15000); // 15 seg [cite: 81]

    try {
        const sheet = getSheet(PRODUTOS_SHEET_NAME);
        const values = sheet.getDataRange().getValues();
        const headers = values[0].map(h => h.toString().toLowerCase().trim());

        const idxCodigo = headers.indexOf("codigo");
        // Aceita "estoque atual" ou "estoque" [cite: 604]
        let idxEstoque = headers.indexOf("estoque atual");
        if (idxEstoque === -1) idxEstoque = headers.indexOf("estoque");

        if (idxCodigo === -1 || idxEstoque === -1) {
            return { status: "error", message: "Colunas 'codigo' ou 'estoque' não encontradas." };
        }

        let totalProcessado = 0;

        itens.forEach(itemVenda => {
            const codigoAlvo = String(itemVenda.id).trim();
            const qtdVendida = parseFloat(itemVenda.qty) || 0;

            if (codigoAlvo && qtdVendida > 0) {
                // Busca o produto na planilha
                for (let i = 1; i < values.length; i++) {
                    if (String(values[i][idxCodigo]) === codigoAlvo) {
                        const estoqueAtual = parseFloat(values[i][idxEstoque]) || 0;

                        // Só desconta se houver estoque > 0 conforme solicitado
                        if (estoqueAtual > 0) {
                            const novoEstoque = Math.max(0, estoqueAtual - qtdVendida);
                            sheet.getRange(i + 1, idxEstoque + 1).setValue(novoEstoque);
                            totalProcessado++;
                        }
                        break;
                    }
                }
            }
        });

        return { status: "success", message: `Estoque atualizado para ${totalProcessado} itens.` };

    } catch (e) {
        return { status: "error", message: "Erro abater estoque: " + e.toString() };
    } finally {
        lock.releaseLock();
    }
}

// ==========================================================
// FUNÇÕES PARA GESTÃO DE PEDIDOS DO SUPER APP
// ==========================================================

function salvarPedidoSuperApp(data) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        let sheet = ss.getSheetByName(PEDIDOS_SHEET_NAME);

        // Se a aba não existir, cria com os cabeçalhos
        if (!sheet) {
            sheet = ss.insertSheet(PEDIDOS_SHEET_NAME);
            sheet.appendRow([
                "Data", "ID Pedido", "ID Cliente", "Nome Cliente", "Telefone",
                "Email", "Endereço", "Items", "Total Produtos", "Frete",
                "Total Final", "Status", "Gateway", "Conta"
            ]);
            sheet.getRange("1:1").setFontWeight("bold").setBackground("#f3f3f3");
        }

        const itemsString = data.items.map(i => `${i.quantity}x ${i.name}`).join(" | ");
        const dateStr = Utilities.formatDate(new Date(), "GMT-3", "dd/MM/yyyy HH:mm:ss");

        sheet.appendRow([
            dateStr,
            data.orderId,
            data.userId || "guest",
            data.clientData ? `${data.clientData.firstName} ${data.clientData.lastName}` : "Cliente",
            data.clientData ? data.clientData.phone : "",
            data.clientData ? data.clientData.email : "",
            data.deliveryData ? data.deliveryData.address : "Retirada",
            itemsString,
            data.productsTotal,
            data.shippingCost,
            data.total,
            data.status || "Pendente",
            data.gateway || "Mercado Pago",
            data.account || "Default"
        ]);

        return { status: "success", message: "Pedido salvo na planilha" };
    } catch (e) {
        return { status: "error", message: "Erro ao salvar pedido: " + e.toString() };
    }
}

function atualizarStatusPedidoSuperApp(orderId, newStatus) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PEDIDOS_SHEET_NAME);
        if (!sheet) return { status: "error", message: "Aba pedidos não encontrada" };

        const data = sheet.getDataRange().getValues();
        // Coluna B (index 1) tem o ID do Pedido
        for (let i = 1; i < data.length; i++) {
            if (String(data[i][1]) === String(orderId)) {
                // Coluna L (index 11) tem o Status
                sheet.getRange(i + 1, 12).setValue(newStatus);
                return { status: "success" };
            }
        }
        return { status: "not_found" };
    } catch (e) {
        return { status: "error", message: e.toString() };
    }
}
