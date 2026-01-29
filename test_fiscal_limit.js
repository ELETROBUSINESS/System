const fetch = require('node-fetch');

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzB7dluoiNyJ4XK6oDK_iyuKZfwPTAJa4ua4RetQsUX9cMObgE-k_tFGI82HxW_OyMf/exec";

async function testFetch(params = "") {
    const url = `${SCRIPT_URL}?action=listarNotasFiscais${params}`;
    console.log(`Fetching: ${url}`);
    try {
        const response = await fetch(url);
        const text = await response.text();

        // Handle redirects if node-fetch doesn't follow (AppScript often redirects)
        if (response.status === 302) {
            console.log("Redirect detected (not handled automatically by simple script)");
        }

        // Parse JSON
        let json;
        try {
            json = JSON.parse(text);
        } catch (e) {
            console.log("Response is not JSON:", text.substring(0, 100));
            return;
        }

        if (json.status === 'success' && Array.isArray(json.data)) {
            console.log(`Count: ${json.data.length}`);
            if (json.data.length > 0) {
                // Sort by XML nNF extraction if possible, or just print what we have
                const numbers = json.data.map(item => {
                    const match = item.xml ? item.xml.match(/<nNF>(.*?)<\/nNF>/) : null;
                    return match ? parseInt(match[1]) : "N/A";
                }).sort((a, b) => a - b);

                console.log(`Range: ${numbers[0]} to ${numbers[numbers.length - 1]}`);
                console.log(`First 5: ${numbers.slice(0, 5).join(', ')}`);
                console.log(`Last 5: ${numbers.slice(-5).join(', ')}`);
            }
        } else {
            console.log("Status not success or data not array:", json);
        }
    } catch (error) {
        console.error("Error:", error.message);
    }
}

// Run test with limit assumption
(async () => {
    console.log("--- Test 1: Default (limit=5000) ---");
    await testFetch("&limit=5000");

    console.log("\n--- Test 2: Page 2 (assuming page param) ---");
    await testFetch("&page=2");

    console.log("\n--- Test 3: Offset 50 (assuming offset param) ---");
    await testFetch("&offset=50");
})();
