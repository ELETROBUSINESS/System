const fetch = require('node-fetch');

// URL fornecida pelo usuário
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzB7dluoiNyJ4XK6oDK_iyuKZfwPTAJa4ua4RetQsUX9cMObgE-k_tFGI82HxW_OyMf/exec";

// Função helper para extrair tag XML
function extrairTagXML(xmlString, tag) {
    if (!xmlString || xmlString === "" || xmlString === "---") return null;
    const regex = new RegExp(`<([a-zA-Z0-9]+:)?${tag}>(.*?)<\/[a-zA-Z0-9:]*?${tag}>`, 'i');
    const match = xmlString.match(regex);
    return match ? match[2] : null;
}

async function testFetchNFCe() {
    console.log("Iniciando teste de fetch NFC-e...");
    const url = `${SCRIPT_URL}?action=listarNotasFiscais`;
    console.log(`URL: ${url}`);

    try {
        const response = await fetch(url);
        const result = await response.json();

        console.log("Status da Resposta:", result.status);

        if (result.status === 'success' && Array.isArray(result.data)) {
            console.log(`Total de notas recebidas: ${result.data.length}`);

            const now = new Date();
            // Data Local YYYY-MM-DD
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const todayStr = `${year}-${month}-${day}`;

            console.log(`Filtrando por data de hoje: ${todayStr}`);

            let countAuthorized = 0;
            let countToday = 0;
            let totalValue = 0;

            result.data.forEach((nota, index) => {
                const status = String(nota.status).toLowerCase();
                const isAuthorized = status.includes('autorizada');

                // Extrair Data e Valor
                const dhEmi = extrairTagXML(nota.xml, "dhEmi");
                const vNF = extrairTagXML(nota.xml, "vNF");

                // Logs detalhados para os primeiros 5 itens
                if (index < 5) {
                    console.log(`[Nota ${index}] Status: ${status} | DataXML: ${dhEmi} | ValorXML: ${vNF}`);
                }

                if (isAuthorized) {
                    countAuthorized++;
                    if (dhEmi && dhEmi.startsWith(todayStr)) {
                        countToday++;
                        if (vNF) {
                            totalValue += parseFloat(vNF);
                        }
                    }
                }
            });

            console.log("--- RESUMO ---");
            console.log(`Total Autorizadas: ${countAuthorized}`);
            console.log(`Total Autorizadas HOJE (${todayStr}): ${countToday}`);
            console.log(`Valor Total HOJE: R$ ${totalValue.toFixed(2)}`);

        } else {
            console.log("Erro: Dados inválidos ou status de erro.", result);
        }

    } catch (error) {
        console.error("Erro fatal no fetch:", error);
    }
}

testFetchNFCe();
