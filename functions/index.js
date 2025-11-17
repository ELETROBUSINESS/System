const functions = require("firebase-functions");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const cors = require("cors")({ origin: true });
const { defineString } = require('firebase-functions/params');

const mercadoPagoToken = defineString('MERCADOPAGO_ACCESS_TOKEN');
// ==========================================================
// FUNÇÃO 1: CRIAR PREFERÊNCIA (AJUSTADA)
// ==========================================================
exports.createPreference = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        if (req.method !== "POST") {
            return res.status(405).send({ error: "Método não permitido" });
        }
        try {
            const accessToken = mercadoPagoToken.value();
            if (!accessToken) {
                console.error("Erro CRÍTICO: MERCADOPAGO_ACCESS_TOKEN não está definido.");
                return res.status(500).send({ error: "Erro interno de configuração." });
            }
            const client = new MercadoPagoConfig({ accessToken });
            const preferenceClient = new Preference(client);

            const { name, price } = req.body;
            if (!name || !price) {
                return res.status(400).send({ error: "Dados do produto incompletos" });
            }

            const preferenceData = {
                body: {
                    items: [ { title: name, unit_price: Number(price), quantity: 1, } ],
                    back_urls: {
                        success: "https://eletrobusiness.com.br/",
                        failure: "https://eletrobusiness.com.br/",
                    },
                    auto_return: "approved",

                    // ⬇️ ⬇️ ⬇️ PONTO QUE FALTAVA ⬇️ ⬇️ ⬇️
                    // Adicionar o 'payer' na criação da Preferência
                    // Isso alinha o backend com o frontend
                    payer: {
                        name: "Comprador",
                        surname: "Teste",
                        email: "comprador.teste@gmail.com",
                        phone: {
                            area_code: "11",
                            number: "911111111"
                        },
                        identification: {
                            type: "CPF",
                            number: "19119119100"
                        },
                        // A propriedade que causa o aviso no frontend
                        entity_type: "individual" 
                    }
                    // ⬆️ ⬆️ ⬆️ FIM DA CORREÇÃO ⬆️ ⬆️ ⬆️
                }
            };
            const response = await preferenceClient.create(preferenceData);
            return res.status(200).send({ id: response.id });
        } catch (error) {
            console.error("Erro ao criar preferência:", error);
            return res.status(500).send({ error: "Erro ao criar preferência" });
        }
    }); 
});


// ==========================================================
// FUNÇÃO 2: PROCESSAR PAGAMENTO (CORREÇÃO DA LÓGICA)
// ==========================================================
exports.processPayment = functions.https.onRequest(async (req, res) => {
    
    cors(req, res, async () => {
        if (req.method !== "POST") {
            return res.status(405).send({ error: "Método não permitido" });
        }

        try {
            const accessToken = mercadoPagoToken.value();
            if (!accessToken) {
                console.error("Erro CRÍTICO: MERCADOPAGO_ACCESS_TOKEN não está definido.");
                return res.status(500).send({ error: "Erro interno de configuração." });
            }
            
            const client = new MercadoPagoConfig({ accessToken });
            const payment = new Payment(client);
            
            // ⬇️ ⬇️ ⬇️ ESTA É A CORREÇÃO CRÍTICA ⬇️ ⬇️ ⬇️
            // O Brick envia { formData: {...}, paymentType: '...' }
            // Os dados reais do pagamento estão DENTRO do 'formData'
            const { formData, paymentType } = req.body;
            
            // Usamos o 'formData' como nosso objeto de pagamento base
            const paymentData = formData; 
            // ⬆️ ⬆️ ⬆️ FIM DA CORREÇÃO ⬆️ ⬆️ ⬆️

            // 2. LÓGICA DE REFORÇO (Mantida)
            if (!paymentData.payer) {
                paymentData.payer = {};
            }
            paymentData.payer.email = paymentData.payer.email || "comprador.teste@gmail.com";
            paymentData.payer.first_name = paymentData.payer.first_name || "Comprador";
            paymentData.payer.last_name = paymentData.payer.last_name || "Teste";
            paymentData.payer.entity_type = "individual"; 
            
            // Lógica específica do PIX (baseada no 'paymentType' externo)
            if (paymentType === 'bank_transfer') {
                paymentData.payment_method_id = 'pix'; 
                if (!paymentData.payer.identification) {
                    paymentData.payer.identification = {
                        type: "CPF",
                        number: "19119119100"
                    };
                }
            }
            
            console.log("Processando pagamento com dados (corrigidos e extraídos):", JSON.stringify(paymentData));
            
            // 3. Cria o pagamento com os dados corretos
            const response = await payment.create({ body: paymentData });

            console.log("Resposta do pagamento:", response);
            return res.status(200).send(response);

        } catch (error) {
            console.error("Erro ao processar pagamento:", JSON.stringify(error, null, 2));
            if (error.response && error.response.data) {
                return res.status(400).send(error.response.data);
            }
            return res.status(500).send({ error: "Erro interno ao processar pagamento" });
        }
    }); 
});