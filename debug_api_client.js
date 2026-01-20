const https = require('https');

const API_URL = "https://script.google.com/macros/s/AKfycbzB7dluoiNyJ4XK6oDK_iyuKZfwPTAJa4ua4RetQsUX9cMObgE-k_tFGI82HxW_OyMf/exec";
const ID = "CLImhove5nuW4F"; // ID fornecido pelo usuário
const url = `${API_URL}?action=obterDadosFatura&idCliente=${ID}`;

console.log(`Fazendo requisição para: ${url}`);

https.get(url, (res) => {
    let data = '';

    // A chunk of data has been received.
    res.on('data', (chunk) => {
        data += chunk;
    });

    // The whole response has been received.
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log("\n--- RESULTADO JSON ---");
            if (json.cliente) {
                console.log("CLIENTE ENCONTRADO:");
                console.log("Nome:", json.cliente.nome);
                console.log("Telefone:", json.cliente.telefone);
                console.log("Endereço:", json.cliente.endereco);
                console.log("Dia Vencimento:", json.cliente.diaVencimento);
                console.log("\nDADOS COMPLETOS (Debug):");
                console.log(JSON.stringify(json.cliente, null, 2));
            } else {
                console.log("AVISO: Objeto 'cliente' não retornado.");
                console.log(JSON.stringify(json, null, 2));
            }
        } catch (e) {
            console.error("Erro ao processar JSON:", e.message);
            console.log("Resposta bruta:", data); // Pode ser um erro HTML do Google
        }
    });

}).on("error", (err) => {
    console.log("Erro na requisição: " + err.message);
});
