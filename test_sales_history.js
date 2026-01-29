const fetch = require('node-fetch');

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzB7dluoiNyJ4XK6oDK_iyuKZfwPTAJa4ua4RetQsUX9cMObgE-k_tFGI82HxW_OyMf/exec";

async function testAction(action, params = "") {
    const url = `${SCRIPT_URL}?action=${action}${params}`;
    console.log(`\nTesting Action: ${action} ${params}`);
    try {
        const response = await fetch(url);
        const text = await response.text();
        try {
            const json = JSON.parse(text);
            if (json.status === 'success' && Array.isArray(json.data)) {
                console.log(`Count: ${json.data.length}`);
                if (json.data.length > 0) {
                    // For sales history, maybe 'id' or 'data'?
                    console.log("Sample Data Keys:", Object.keys(json.data[0]));
                    console.log("First Item:", JSON.stringify(json.data[0]));
                    console.log("Last Item:", JSON.stringify(json.data[json.data.length - 1]));
                }
            } else {
                console.log("Status:", json.status);
            }
        } catch (e) {
            console.log("Not JSON");
        }
    } catch (error) {
        console.error("Error:", error.message);
    }
}

(async () => {
    // Check Sales History
    await testAction("listarHistoricoVendas", "&limit=5000");

    // Check Fiscal Alternatives
    await testAction("listarTodasNotasFiscais");
    await testAction("getFiscalNotes");
    await testAction("getAllNotes");
    await testAction("relatorioFiscal");
    await testAction("listarNotas", "&limit=5000");
})();
