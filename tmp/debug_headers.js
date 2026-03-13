const axios = require('axios');

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzM0MDc2NjksInN1YiI6IlFLbXdrZGlENERaUVU3YmllbWpQU1RJUFBqeTIifQ.D531EqJBNrXOqKQHgvTzkdpxudUjhF3rnwX_BhEt0FI";

async function test(label, url, headers, payload) {
    console.log(`\n--- ${label} ---`);
    console.log(`URL: ${url}`);
    console.log(`Headers: ${JSON.stringify(headers)}`);
    try {
        const response = await axios.post(url, payload, { headers, timeout: 5000 });
        console.log(`Status: ${response.status}`);
        console.log(`Response Type: ${typeof response.data}`);
        if (typeof response.data === 'string' && response.data.includes('<!doctype html>')) {
            console.log(`Response: [HTML Content]`);
        } else {
            console.log(`Response: ${JSON.stringify(response.data, null, 2)}`);
        }
    } catch (err) {
        console.log(`Error: ${err.message}`);
        if (err.response) {
            console.log(`Status: ${err.response.status}`);
            console.log(`Data: ${JSON.stringify(err.response.data).substring(0, 200)}...`);
        }
    }
}

async function run() {
    const payload = {
        from: { postal_code: "68637000" },
        to: { postal_code: "68658000" },
        services: "1,2,17",
        package: { format: "box", weight: 0.5, height: 10, width: 10, length: 16 }
    };

    // Header 1: Bearer
    await test("Header 1: Bearer", "https://api.superfrete.com/v1/calculator", 
        { "Content-Type": "application/json", "Authorization": `Bearer ${TOKEN}`, "Accept": "application/json" }, payload);

    // Header 2: Just Token
    await test("Header 2: Just Token", "https://api.superfrete.com/v1/calculator", 
        { "Content-Type": "application/json", "Authorization": TOKEN, "Accept": "application/json" }, payload);

    // Header 3: auth-token header (Common in some Brazilian APIs)
    await test("Header 3: auth-token", "https://api.superfrete.com/v1/calculator", 
        { "Content-Type": "application/json", "auth-token": TOKEN, "Accept": "application/json" }, payload);

    // URL 2: with Trailing Slash
    await test("URL 2: Trailing Slash", "https://api.superfrete.com/v1/calculator/", 
        { "Content-Type": "application/json", "Authorization": `Bearer ${TOKEN}`, "Accept": "application/json" }, payload);
}

run();
