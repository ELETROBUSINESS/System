const https = require('https');

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzB7dluoiNyJ4XK6oDK_iyuKZfwPTAJa4ua4RetQsUX9cMObgE-k_tFGI82HxW_OyMf/exec";
const FINAL_URL = `${SCRIPT_URL}?action=atualizarStatusNota&chave=15260345692327000100650010000010941702474339&novoStatus=CANCELADA`;

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
            console.log("Status Code:", res.statusCode);
            console.log("Response:", data);
        });
    }).on("error", (err) => {
        console.log("Error: " + err.message);
    });
}

fetchUrl(FINAL_URL);
