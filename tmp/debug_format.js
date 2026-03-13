const axios = require('axios');

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzM0MDc2NjksInN1YiI6IlFLbXdrZGlENERaUVU3YmllbWpQU1RJUFBqeTIifQ.D531EqJBNrXOqKQHgvTzkdpxudUjhF3rnwX_BhEt0FI";

async function testFormat() {
    const payload = {
        from: "68637000",
        to: "68658000",
        services: "1,2,17",
        options: {
            own_hand: false,
            receipt: false,
            insurance: true,
            use_origin_out_of_state: true
        },
        package: {
            format: "box",
            weight: "0.500",
            height: 10,
            width: 10,
            length: 16
        }
    };

    try {
        const response = await axios.post("https://api.superfrete.com/v1/calculator", payload, {
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${TOKEN}`,
                "Accept": "application/json"
            }
        });
        console.log("SUCCESS");
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        console.log("ERROR");
        console.log(err.response ? JSON.stringify(err.response.data).substring(0, 500) : err.message);
    }
}

testFormat();
