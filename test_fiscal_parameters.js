const fetch = require('node-fetch');

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzB7dluoiNyJ4XK6oDK_iyuKZfwPTAJa4ua4RetQsUX9cMObgE-k_tFGI82HxW_OyMf/exec";

async function testFetch(params = "") {
    const url = `${SCRIPT_URL}?action=listarNotasFiscais${params}`;
    console.log(`\nTesting: ${params || "(none)"}`);
    try {
        const response = await fetch(url);
        const json = await response.json();

        if (json.status === 'success' && Array.isArray(json.data)) {
            const numbers = json.data.map(item => {
                const match = item.xml ? item.xml.match(/<nNF>(.*?)<\/nNF>/) : null;
                return match ? parseInt(match[1]) : 0;
            }).filter(n => n > 0).sort((a, b) => a - b);

            if (numbers.length > 0)
                console.log(`Count: ${json.data.length} | Range: ${numbers[0]} - ${numbers[numbers.length - 1]}`);
            else
                console.log(`Count: ${json.data.length} | No valid XML numbers found`);
        } else {
            console.log("Status:", json.status);
        }
    } catch (error) {
        console.error("Error:", error.message);
    }
}

(async () => {
    // Month/Year
    await testFetch("&month=12&year=2025");
    await testFetch("&mes=12&ano=2025");

    // Dates
    await testFetch("&startDate=2025-12-01&endDate=2025-12-31");
    await testFetch("&dataInicio=2025-12-01&dataFim=2025-12-31");

    // Pagination attempts
    await testFetch("&limit=100");
    await testFetch("&startId=1");
    await testFetch("&minId=1");

    // Flags
    await testFetch("&all=true");
    await testFetch("&todos=true");
})();
