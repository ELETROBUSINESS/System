const https = require('https');

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzB7dluoiNyJ4XK6oDK_iyuKZfwPTAJa4ua4RetQsUX9cMObgE-k_tFGI82HxW_OyMf/exec?action=listarNotasFiscais";
const chaveBusca = "15260345692327000100650010000010941702474339";

function fetchUrl(url) {
    https.get(url, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
            console.log("Redirecting to:", res.headers.location);
            fetchUrl(res.headers.location);
            return;
        }

        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            try {
                if (data.startsWith('<')) {
                    console.log("Recebido HTML (provavelmente erro ou login).");
                    return;
                }
                const json = JSON.parse(data);
                const notas = json.data;
                const nota = notas.find(n => n.chave === chaveBusca);
                if (nota) {
                    console.log("Nota encontrada!");
                    console.log("Protocolo:", nota.nProt || nota.protocolo);
                } else {
                    console.log("Nota não encontrada na planilha.");
                }
            } catch (e) {
                console.error("Erro:", e.message);
            }
        });
    }).on("error", (err) => {
        console.log("Error: " + err.message);
    });
}

fetchUrl(SCRIPT_URL);
