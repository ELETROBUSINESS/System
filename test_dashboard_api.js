const NEW_API = "https://script.google.com/macros/s/AKfycbyZtUsI44xA4MQQLZWJ6K93t6ZaSaN6hw7YQw9EclZG9E85kM6yOWQCQ0D-ZJpGmyq4/exec";
const LEGACY_API = "https://script.google.com/macros/s/AKfycby8x6--ITfvIW7ui6c24reBqzL3LUhqL30hf4-gaJCS0xB0EDPM50TcSji_W-IuNU33/exec?pagina=1";

async function test() {
    console.log("--- Testando Dashboard Híbrido (CORRIGIDO PARA POST) ---");

    // 1. Nova API (POST)
    // OBS: O content-type precisa ser text/plain p/ evitar CORS preflight complexo no browser,
    // embora no Node tanto faz, o Apps Script lida bem com text/plain ou json.
    // O script do user faz JSON.parse(e.postData.contents).
    const payload = {
        action: 'calcular',
        loja: 'DT#25',
        periodo: 'dia'
    };

    console.log(`POST New API: ${NEW_API}`);
    console.log("Payload:", payload);

    const start = Date.now();

    try {
        const [resNew, resLegacy] = await Promise.allSettled([
            fetch(NEW_API, {
                method: 'POST',
                body: JSON.stringify(payload)
            }).then(r => r.json()),

            fetch(LEGACY_API).then(r => r.json())
        ]);

        console.log(`\nTempo total: ${Date.now() - start}ms\n`);

        const combinedData = {};

        // Process New
        if (resNew.status === 'fulfilled') {
            console.log("✅ Nova API: SUCESSO\n");

            if (resNew.value.success) {
                const d = resNew.value.resultados;
                combinedData.saldo = d.saldo;
                combinedData.receber = d.aReceber;
                combinedData.faturamento = d.faturamento;
                combinedData.clientes = d.clientesAtendidos;
            } else {
                console.log("⚠️ Nova API retornou success: false", resNew.value);
            }
        } else {
            console.log("❌ Nova API: FALHOU", resNew.reason);
        }

        // Process Legacy
        if (resLegacy.status === 'fulfilled') {
            console.log("\n✅ Legacy API: SUCESSO");
            const d = resLegacy.value;
            combinedData.ticket = d.valor4;
            combinedData.lucro = d.valor5;
        }

        console.log("\n--- RESULTADO FINAL ---");
        console.table(combinedData);

    } catch (e) {
        console.error("Erro fatal:", e);
    }
}

test();
