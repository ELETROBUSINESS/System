const axios = require('axios');

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzM0MDc2NjksInN1YiI6IlFLbXdrZGlENERaUVU3YmllbWpQU1RJUFBqeTIifQ.D531EqJBNrXOqKQHgvTzkdpxudUjhF3rnwX_BhEt0FI";

async function testFlat(label, payload) {
    console.log(`\n--- ${label} ---`);
    try {
        const response = await axios.post("https://api.superfrete.com/v1/calculator", payload, {
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${TOKEN}`,
                "Accept": "application/json"
            },
            timeout: 5000
        });
        console.log(`Status: ${response.status}`);
        console.log(`Data: ${JSON.stringify(response.data, null, 2)}`);
    } catch (err) {
        console.log(`Error: ${err.message}`);
        if (err.response) {
            console.log(`Status: ${err.response.status}`);
            console.log(`Data (First 200 chars): ${JSON.stringify(err.response.data).substring(0, 200)}...`);
        }
    }
}

async function run() {
    // Flat Payload Variation
    const flatPayload = {
        from: "68637000",
        to: "68658000",
        weight: "0.500",
        width: 15,
        height: 10,
        length: 20,
        services: "1,2,17"
    };

    await testFlat("Flat Structure", flatPayload);

    // Deep Structure Variation (The one I was using)
    const deepPayload = {
        from: { postal_code: "68637000" },
        to: { postal_code: "68658000" },
        services: "1,2,17",
        package: { format: "box", weight: 0.5, height: 10, width: 15, length: 20 }
    };
    await testFlat("Deep Structure", deepPayload);
}

run();
