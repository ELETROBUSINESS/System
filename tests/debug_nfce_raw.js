const fetch = require('node-fetch');

// URL fornecida pelo usuário
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzB7dluoiNyJ4XK6oDK_iyuKZfwPTAJa4ua4RetQsUX9cMObgE-k_tFGI82HxW_OyMf/exec";

async function testFetchNFCeRaw() {
    console.log("Iniciando teste de debug RAW...");
    const url = `${SCRIPT_URL}?action=listarNotasFiscais`;
    console.log(`URL: ${url}`);

    try {
        const response = await fetch(url);
        const result = await response.json();

        console.log("Status da Resposta:", result.status);

        if (result.status === 'success' && Array.isArray(result.data)) {
            console.log(`Total de notas recebidas: ${result.data.length}`);

            // Logar a estrutura crua do primeiro item para ver as chaves reais
            if (result.data.length > 0) {
                console.log("--- ESTRUTURA DO PRIMEIRO ITEM ---");
                console.log(JSON.stringify(result.data[0], null, 2));
            }

        } else {
            console.log("Erro: Dados inválidos ou status de erro.", result);
        }

    } catch (error) {
        console.error("Erro fatal no fetch:", error);
    }
}

testFetchNFCeRaw();
