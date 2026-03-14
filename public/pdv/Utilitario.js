/**
 * MÓDULO: Utilitario (Migração)
 * Responsável por migrar dados do sistema antigo para o novo formato de BillingID
 */

function migrarHistoricoParaCrediario() {
  const ssNova = SpreadsheetApp.getActiveSpreadsheet();
  
  // URL da planilha antiga fornecida pelo usuário
  const ID_PLANILHA_ANTIGA = "1w0vz_LFwBZBm7Yt9fIIzGK48w7iL_cZW7oEipkoaTw0";
  const ssAntiga = SpreadsheetApp.openById(ID_PLANILHA_ANTIGA);
  
  const logsSheet = ssAntiga.getSheetByName("logs");
  const creditoSheet = ssNova.getSheetByName("Crédito");
  
  if (!logsSheet) {
    throw new Error("Aba 'logs' não encontrada na planilha ANTIGA.");
  }

  // 1. Obter todos os dados do log antigo
  const dataLogs = logsSheet.getDataRange().getValues();
  const logsParaProcessar = [];

  console.log("Total de linhas encontradas na aba logs:", dataLogs.length);

  // Cabeçalhos esperados: [0]Timestamp, [1]ID Cliente, [2]Tipo, [3]Valor, [4]Parcela, [5]Obs
  for (let i = 1; i < dataLogs.length; i++) {
    const row = dataLogs[i];
    const idCliente = String(row[1] || "").trim();
    const tipo = String(row[2] || "").toLowerCase().trim();
    
    // Filtro mais robusto: inclui compras, pagamentos e renegociações
    const isCompra = tipo.includes('compra') || tipo.includes('renegociação (nova)');
    const isPagamento = tipo.includes('pagamento') || tipo.includes('renegociação (baixa)');
    
    const ehCredito = isCompra || isPagamento;
    const temIdValido = idCliente.length > 5; // Verifica se tem um ID mínimo

    if (ehCredito && temIdValido) {
      logsParaProcessar.push({
        timestamp: row[0],
        idCliente: idCliente,
        tipo: isCompra ? 'compra' : 'pagamento',
        originalTipo: String(row[2]).trim(), // Preserva: "Compra", "Renegociação (Nova)", etc
        valor: parseFloat(row[3]) || 0,
        parcela: row[4],
        obs: row[5]
      });
    }
  }

  // 2. Ordenar por data cronológica (garante que pagamentos ocorram após as compras)
  logsParaProcessar.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  console.log(`Iniciando migração de ${logsParaProcessar.length} registros...`);

  let comprasSucesso = 0;
  let pagtosSucesso = 0;

  logsParaProcessar.forEach((log, index) => {
    try {
      if (log.tipo === 'compra') {
        const parcelaStr = String(log.parcela || "").trim();
        let offset = 0;
        let descFinal = log.obs || `Migração: ${log.originalTipo}`;

        // Lógica de Inteligência para identificar parcelamento pelo campo 'parcela' (1/2, 2/6...)
        if (parcelaStr && parcelaStr.includes('/')) {
            const partes = parcelaStr.split('/');
            const atual = parseInt(partes[0]) || 1;
            const total = parseInt(partes[1]) || 1;
            
            // Se for parcela 1, offset 0. Se for parcela 2, offset 1, etc...
            offset = atual - 1; 
            descFinal = `${log.obs || "Compra Parc."} (${parcelaStr})`;
        } else if (String(log.obs).toLowerCase().includes('compra parc')) {
            // Fallback se a coluna parcela estiver vazia mas a obs dizer que é parcela
            descFinal = log.obs;
        }

        const res = registrarVendaCrediario({
          id_cliente: log.idCliente,
          valor: Math.abs(log.valor),
          parcelas: 1, 
          mes_offset: offset, 
          descricao: descFinal,
          data_manual: log.timestamp,
          pular_saldo: true
        });
        if (res.success) comprasSucesso++;
      } 
      else if (log.tipo === 'pagamento') {
        const res = registrarPagamentoParcela({
          id_cliente: log.idCliente,
          valor: Math.abs(log.valor),
          data_manual: log.timestamp,
          pular_saldo: true
        });
        if (res.success) pagtosSucesso++;
      }
    } catch (e) {
      console.error(`Erro no índice ${index} (Cliente: ${log.idCliente}): ${e.message}`);
    }
  });

  return {
    status: "success",
    message: `Migração concluída. Compras: ${comprasSucesso}, Pagamentos: ${pagtosSucesso}`,
    total: logsParaProcessar.length
  };
}

/**
 * Função utilitária para recalcular e sincronizar o saldo dos clientes
 * com base na nova aba 'Crédito' (Garante integridade final)
 */
function recalcularSaldosAposMigracao() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const clientesSheet = ss.getSheetByName("Clientes");
  const creditoSheet = ss.getSheetByName("Crédito");

  if (!clientesSheet || !creditoSheet) return "Abas não encontradas";

  const clientesData = clientesSheet.getDataRange().getValues();
  const creditoData = creditoSheet.getDataRange().getValues();

  // Mapeamento de saldos calculado da aba Crédito
  const saldosMap = {};
  for (let j = 1; j < creditoData.length; j++) {
    const idCli = String(creditoData[j][COL_CREDITO.ID_CLIENTE]).trim();
    const valor = parseFloat(creditoData[j][COL_CREDITO.VALOR]) || 0;
    
    if (!saldosMap[idCli]) saldosMap[idCli] = 0;
    // Soma direta (Compras são positivas, pagamentos que restam são negativos ou 0 se baixados)
    saldosMap[idCli] += valor;
  }

  const idIdx = (typeof COL_CLIENTE !== 'undefined') ? COL_CLIENTE.ID : 0;
  const saldoIdx = (typeof COL_CLIENTE !== 'undefined') ? COL_CLIENTE.SALDO : 7;

  for (let i = 1; i < clientesData.length; i++) {
    const id = String(clientesData[i][idIdx]).trim();
    const saldoCorreto = saldosMap[id] || 0;
    clientesSheet.getRange(i + 1, saldoIdx + 1).setValue(saldoCorreto);
  }

  return "Saldos sincronizados com sucesso.";
}

/**
 * FUNÇÃO MESTRE: Executa a migração completa e sincroniza os saldos ao final.
 * Use esta função para realizar o processo inteiro de uma vez.
 */
function EXECUTAR_MIGRACAO_TOTAL() {
  console.log("--- INICIANDO PROCESSO DE MIGRAÇÃO TOTAL ---");
  
  const resMigracao = migrarHistoricoParaCrediario();
  console.log("Resultado da Migração:", resMigracao.message);
  
  const resSincronizacao = recalcularSaldosAposMigracao();
  console.log("Resultado da Sincronização:", resSincronizacao);
  
  console.log("--- PROCESSO CONCLUÍDO ---");
  return {
    migracao: resMigracao,
    sincronizacao: resSincronizacao
  };
}

/**
 * Mapeia e migra o cadastro básico dos clientes para a planilha nova.
 */
function migrarCadastroClientes() {
  const ssNova = SpreadsheetApp.getActiveSpreadsheet();
  const ID_PLANILHA_ANTIGA = "1w0vz_LFwBZBm7Yt9fIIzGK48w7iL_cZW7oEipkoaTw0";
  const ssAntiga = SpreadsheetApp.openById(ID_PLANILHA_ANTIGA);
  
  const sheetAntiga = ssAntiga.getSheetByName("clientes");
  const sheetNova = ssNova.getSheetByName("Clientes");

  if (!sheetAntiga || !sheetNova) {
    throw new Error("Aba 'clientes' não encontrada em uma das planilhas.");
  }

  const dataAntiga = sheetAntiga.getDataRange().getValues();
  const clientesParaInserir = [];

  console.log(`Lendo ${dataAntiga.length - 1} clientes da base antiga...`);

  // Mapeamento baseado na descrição do usuário (API antiga):
  // [0]ID, [1]Nome, [2]Apelido, [3]Telefone, [4]Endereço, [5]Saldo, [10]Data Cadastro, [11]Limite, [13]Dia Venc, [14]Pass
  for (let i = 1; i < dataAntiga.length; i++) {
    const row = dataAntiga[i];
    
    // Preparando linha no formato da NOVA API (API26.js / COL_CLIENTE)
    // COL_CLIENTE: [0]LOJA, [1]ID, [2]NOME, [3]CPF, [4]NASCIMENTO, [5]TELEFONE, [6]ENDERECO, [7]SALDO, [8]VENCIMENTO, [9]LIMITE, [10]BADGE, [11]PASS
    const newRow = [
      "DT#25",           // [0] Loja padrão
      row[0],            // [1] ID Cliente
      row[1],            // [2] Nome Completo
      "",                // [3] CPF (não informado na antiga)
      "",                // [4] Nascimento (não informado na antiga)
      row[3],            // [5] Telefone
      row[4],            // [6] Endereço
      parseFloat(row[5]) || 0, // [7] Saldo
      row[13] || 10,     // [8] Dia Vencimento
      parseFloat(row[11]) || 0, // [9] Limite
      "",                // [10] Badge (vazio inicial)
      row[14]            // [11] Senha (Pass)
    ];
    
    clientesParaInserir.push(newRow);
  }

  if (clientesParaInserir.length > 0) {
    // Clear old data (except headers) if you want a clean sync
    if (sheetNova.getLastRow() > 1) {
      sheetNova.getRange(2, 1, sheetNova.getLastRow() - 1, sheetNova.getLastColumn()).clearContent();
    }
    
    sheetNova.getRange(2, 1, clientesParaInserir.length, 12).setValues(clientesParaInserir);
    console.log(`${clientesParaInserir.length} clientes migrados com sucesso.`);
  }

  return "Migração de cadastros concluída.";
}
