const axios = require('axios');

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzM0MDc2NjksInN1YiI6IlFLbXdrZGlENERaUVU3YmllbWpQU1RJUFBqeTIifQ.D531EqJBNrXOqKQHgvTzkdpxudUjhF3rnwX_BhEt0FI";

async function testVariation(label, payload) {
    console.log(`\nTesting: ${label}`);
    try {
        const response = await axios.post("https://api.superfrete.com/v1/calculator", payload, {
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${TOKEN}`,
                "User-Agent": "Dtudo App (suporte@dtudo.com.br)"
            },
            timeout: 10000
        });
        console.log("Response Status:", response.status);
        console.log("Data:", JSON.stringify(response.data, null, 2));
    } catch (err) {
        console.log("Error Status:", err.response ? err.response.status : "No Response");
        console.log("Error Data:", err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
    }
}

async function run() {
    const basePayload = {
        from: { postal_code: "68637000" },
        to: { postal_code: "68658000" },
        services: ["1", "2", "17"],
        options: { own_hand: false, receipt: false, insurance: true, use_origin_out_of_state: true },
        package: { format: "box", weight: 2.6, height: 45, width: 45, length: 20 }
    };

    // Variation 1: Original
    await testVariation("Variation 1: Array services + use_origin_out_of_state: true", basePayload);

    // Variation 2: String services
    await testVariation("Variation 2: String services", { ...basePayload, services: "1,2,17" });

    // Variation 3: Remove options
    await testVariation("Variation 3: Remove options", { 
        from: basePayload.from, 
        to: basePayload.to, 
        services: basePayload.services, 
        package: basePayload.package 
    });

    // Variation 4: Try a common CEP pair (São Paulo to São Paulo)
    await testVariation("Variation 4: SP to SP (01001000 to 04571010)", {
        from: { postal_code: "01001000" },
        to: { postal_code: "04571010" },
        services: ["1", "2", "17"],
        package: { format: "box", weight: 0.5, height: 10, width: 10, length: 10 }
    });
}

run();
