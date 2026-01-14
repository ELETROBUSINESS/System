const fetch = require('node-fetch');

// URL fornecida pelo usuário
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzB7dluoiNyJ4XK6oDK_iyuKZfwPTAJa4ua4RetQsUX9cMObgE-k_tFGI82HxW_OyMf/exec";

function extrairTagXML(xmlString, tag) {
    if (!xmlString || xmlString === "" || xmlString === "---") return null;
    const regex = new RegExp(`<([a-zA-Z0-9]+:)?${tag}>(.*?)<\/[a-zA-Z0-9:]*?${tag}>`, 'i');
    const match = xmlString.match(regex);
    return match ? match[2] : null;
}

async function debugNFCeLogic() {
    console.log("Iniciando depuração avançada NFC-e...");
    const url = `${SCRIPT_URL}?action=listarNotasFiscais`;
    console.log(`URL: ${url}`);

    try {
        const response = await fetch(url);
        const result = await response.json();

        if (result.status === 'success' && Array.isArray(result.data)) {
            const rawData = result.data;
            console.log(`Itens recebidos: ${rawData.length}`);

            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const todayStr = `${year}-${month}-${day}`;

            console.log(`Data alvo (Hoje): ${todayStr}`);

            let validCount = 0;
            let totalValue = 0;

            rawData.forEach((nota, idx) => {
                // 1. Ignorar vazios
                if (!nota.xml || nota.xml === "") {
                    // console.log(`[Item ${idx}] Ignorado (XML Vazio)`);
                    return;
                }

                // 2. Extrair Dados
                const statusAPI = String(nota.status).toLowerCase();
                const dhEmi = extrairTagXML(nota.xml, "dhEmi");
                const vNF = extrairTagXML(nota.xml, "vNF");
                const xMotivo = extrairTagXML(nota.xml, "xMotivo");
                const cStat = extrairTagXML(nota.xml, "cStat");

                // 3. Determinar se é Autorizada
                let isAuthorized = false;
                if (statusAPI.includes('autorizada')) isAuthorized = true;
                if (!isAuthorized && xMotivo && xMotivo.toLowerCase().includes('autorizado')) isAuthorized = true;
                if (!isAuthorized && cStat === '100') isAuthorized = true;

                // 4. Determinar se é Hoje
                const isToday = dhEmi && dhEmi.startsWith(todayStr);

                console.log(`[Item ${idx}] Data: ${dhEmi} | Hoje? ${isToday} | Aut? ${isAuthorized} (StatusAPI: '${nota.status}' | xMotivo: '${xMotivo}') | Val: ${vNF}`);

                if (isAuthorized && isToday) {
                    validCount++;
                    if (vNF) totalValue += parseFloat(vNF);
                }
            });

            console.log("--- RESULTADO FINAL ---");
            console.log(`Notas Válidas Hoje: ${validCount}`);
            console.log(`Soma Total: R$ ${totalValue.toFixed(2)}`);

        } else {
            console.log("Erro na API:", result);
        }

    } catch (error) {
        console.error("Erro fatal:", error);
    }
}

debugNFCeLogic();
