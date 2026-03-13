const axios = require('axios');

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzM0MDc2NjksInN1YiI6IlFLbXdrZGlENERaUVU3YmllbWpQU1RJUFBqeTIifQ.D531EqJBNrXOqKQHgvTzkdpxudUjhF3rnwX_BhEt0FI";

async function simulate(destCep, label) {
    console.log(`\n--- Simulação: ${label} (CEP: ${destCep}) ---`);
    const payload = {
        from: { postal_code: "68637000" },
        to: { postal_code: destCep },
        services: "1,2,17",
        options: { insurance: true, use_origin_out_of_state: true },
        package: { format: "box", weight: 1.0, height: 10, width: 10, length: 10 }
    };

    try {
        const response = await axios.post("https://api.superfrete.com/v1/calculator", payload, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TOKEN}` }
        });
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        console.error("Erro na API:", err.response ? err.response.data : err.message);
    }
}

async function run() {
    await simulate("68633000", "Aurora do Pará (Perto)");
    await simulate("01001000", "São Paulo (Longe)");
}

run();
