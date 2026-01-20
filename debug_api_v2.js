const https = require('https');

// Função manual para seguir redirects
function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                // Segue o redirect
                fetchUrl(res.headers.location).then(resolve).catch(reject);
            } else {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }
        }).on('error', reject);
    });
}

const API_URL = "https://script.google.com/macros/s/AKfycbzB7dluoiNyJ4XK6oDK_iyuKZfwPTAJa4ua4RetQsUX9cMObgE-k_tFGI82HxW_OyMf/exec";
const ID = "CLImhove5nuW4F";
const target = `${API_URL}?action=obterDadosFatura&idCliente=${ID}`;

console.log("Debugando requisição para: " + target);
console.log("Aguarde (seguindo redirects)...");

fetchUrl(target).then(data => {
    console.log("\n--- RESPOSTA DA API ---");
    try {
        const json = JSON.parse(data);
        if (json.cliente) {
            console.log("SUCESSO! Dados do Cliente retornados:");
            console.log(JSON.stringify(json.cliente, null, 2));
            console.log("-------------------------------------");
            if (!json.cliente.nome || json.cliente.nome === "Cliente") {
                console.log("ALERTA: O nome veio vazio ou padrão. O script do Google pode estar desatualizado ou não encontrou a coluna.");
            } else {
                console.log("OK: O nome veio preenchido corretamente.");
            }
        } else {
            console.log("ERRO: Objeto 'cliente' não encontrado no JSON.");
            console.log(json);
        }
    } catch (e) {
        console.log("ERRO AO PARSEAR JSON. Resposta bruta:");
        console.log(data.substring(0, 500));
    }
}).catch(err => {
    console.error("ERRO DE CONEXÃO: " + err.message);
});
