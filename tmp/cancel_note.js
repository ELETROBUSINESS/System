const https = require('https');

const API_URL = "https://southamerica-east1-super-app25.cloudfunctions.net/cancelarNfce";
const payload = JSON.stringify({
    chave: "15260345692327000100650010000010941702474339",
    nProt: "215260134471000",
    justificativa: "Cancelamento solicitado pelo cliente apos desistencia da compra no balcao"
});

const options = {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
    },
    timeout: 30000
};

const req = https.request(API_URL, options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log("Status Code:", res.statusCode);
        console.log("Response:", data);
    });
});

req.on('error', (e) => {
    console.error("Erro na requisição:", e.message);
});

req.write(payload);
req.end();
