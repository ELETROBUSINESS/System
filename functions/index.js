const functions = require("firebase-functions");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const cors = require("cors")({ origin: true });
const { defineString } = require('firebase-functions/params');

const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

const mercadoPagoToken = defineString('MERCADOPAGO_ACCESS_TOKEN');
const WEBHOOK_URL = "https://us-central1-super-app25.cloudfunctions.net/processWebhook";

// ==========================================================
// FUNÇÃO 1: CRIAR PREFERÊNCIA (MANTIDA IGUAL)
// ==========================================================
exports.createPreference = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        if (req.method !== "POST") return res.status(405).send({ error: "Method not allowed" });

        try {
            const { items, userId, shippingCost, deliveryData, clientData } = req.body;
            
            if (!items || items.length === 0) return res.status(400).send({ error: "No items" });

            const cleanPhone = clientData && clientData.phone ? clientData.phone.replace(/\D/g, '') : '';
            const cleanEmail = clientData && clientData.email ? clientData.email : 'cliente@eletrobusiness.com.br';
            
            const productsTotal = items.reduce((sum, item) => sum + (Number(item.priceNew) * Number(item.quantity)), 0);
            const freight = Number(shippingCost) || 0;
            const finalTotal = productsTotal + freight;

            const accessToken = mercadoPagoToken.value();
            const client = new MercadoPagoConfig({ accessToken });
            const preferenceClient = new Preference(client);

            const formattedItems = items.map(item => ({
                id: item.id,
                title: item.name,
                quantity: parseInt(item.quantity),
                unit_price: Number(item.priceNew),
            }));

            if (freight > 0) {
                formattedItems.push({
                    id: "shipping",
                    title: "Frete / Entrega",
                    quantity: 1,
                    unit_price: freight
                });
            }

            const orderRef = await db.collection("orders").add({
                userId: userId || 'guest',
                items: items,
                productsTotal: productsTotal,
                shippingCost: freight,
                total: finalTotal,
                deliveryData: deliveryData || {},
                clientData: clientData || {},
                status: "pending_payment", 
                statusText: "Iniciando Checkout",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            const preferenceData = {
                body: {
                    items: formattedItems,
                    payer: {
                        name: clientData ? clientData.firstName : 'Cliente',
                        surname: clientData ? clientData.lastName : 'Eletro',
                        email: cleanEmail,
                        phone: {
                            area_code: "",
                            number: cleanPhone 
                        }
                    },
                    back_urls: {
                        success: "https://eletrobusiness.com.br/", 
                        failure: "https://eletrobusiness.com.br/",
                        pending: "https://eletrobusiness.com.br/"
                    },
                    auto_return: "approved",
                    external_reference: orderRef.id,
                    statement_descriptor: "ELETROBUSINESS",
                    notification_url: WEBHOOK_URL 
                }
            };
            
            const response = await preferenceClient.create(preferenceData);
            
            return res.status(200).send({ 
                preferenceId: response.id,
                orderId: orderRef.id
            });

        } catch (error) {
            console.error("Erro Preference:", error);
            const mpError = error.cause || error.message;
            return res.status(500).send({ error: mpError });
        }
    }); 
});

// ==========================================================
// FUNÇÃO 2: CRIAR PAGAMENTO (COM BOAS PRÁTICAS - DADOS COMPLETOS)
// ==========================================================
exports.createPayment = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const body = req.body;
            const paymentData = body.payment_data || body.formData;
            const orderId = body.orderId;
            
            // Dados extras para Aprovação
            const items = body.items || [];
            const shippingCost = Number(body.shippingCost) || 0;
            const customPayer = body.customPayer || {}; // [NOVO] Dados do comprador

            if (!paymentData || !orderId) return res.status(400).send({ error: "Dados ausentes" });
            
            const accessToken = mercadoPagoToken.value();
            const client = new MercadoPagoConfig({ accessToken });
            const payment = new Payment(client);

            // 1. Captura IP
            let ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            if (ipAddress && ipAddress.indexOf(',') > -1) {
                ipAddress = ipAddress.split(',')[0];
            }
            if (!ipAddress || ipAddress === '::1') ipAddress = '127.0.0.1';

            // 2. Formata Itens (Risco)
            const formattedItems = items.map(item => ({
                id: item.id || "ID_GEN",
                title: item.name || "Produto",
                description: item.description ? item.description.substring(0, 200) : "Item",
                picture_url: item.image || "",
                category_id: "electronics",
                quantity: parseInt(item.quantity),
                unit_price: Number(item.priceNew)
            }));

            if (shippingCost > 0) {
                formattedItems.push({
                    id: "shipping",
                    title: "Frete",
                    category_id: "services",
                    quantity: 1,
                    unit_price: shippingCost
                });
            }

            // 3. Mesclagem do Payer (Endereço, Telefone, CPF)
            // O objeto paymentData já vem com o email do frontend, mas vamos reforçar com dados completos
            if (!paymentData.payer) paymentData.payer = {};
            
            // Injeta os dados formatados que vieram do frontend
            if (customPayer.email) paymentData.payer.email = customPayer.email;
            if (customPayer.first_name) paymentData.payer.first_name = customPayer.first_name;
            if (customPayer.last_name) paymentData.payer.last_name = customPayer.last_name;
            
            // identification (CPF)
            if (customPayer.identification) {
                paymentData.payer.identification = customPayer.identification;
            }
            
            // address (Endereço do comprador) - Resolve "Endereço do comprador"
            if (customPayer.address) {
                paymentData.payer.address = customPayer.address;
            }

            // phone (Telefone) - Resolve "Telefone do comprador"
            if (customPayer.phone) {
                // O MP espera apenas números, já limpamos no frontend
                paymentData.payer.phone = {
                    area_code: customPayer.phone.area_code,
                    number: customPayer.phone.number
                };
            }

            // 4. Additional Info
            if (!paymentData.additional_info) paymentData.additional_info = {};
            paymentData.additional_info.ip_address = ipAddress;
            paymentData.additional_info.items = formattedItems;
            // Também enviamos o payer aqui para redundância de análise de risco
            paymentData.additional_info.payer = {
                first_name: customPayer.first_name,
                last_name: customPayer.last_name,
                phone: {
                    area_code: customPayer.phone ? customPayer.phone.area_code : "",
                    number: customPayer.phone ? customPayer.phone.number : ""
                },
                address: customPayer.address
            };

            // 5. Configs Finais
            paymentData.external_reference = orderId;
            paymentData.notification_url = WEBHOOK_URL;
            paymentData.statement_descriptor = "ELETROBUSINESS"; 

            console.log(`Processando Pgto ${orderId} | IP: ${ipAddress} | CPF Enviado: ${customPayer.identification ? 'SIM' : 'NÃO'}`);

            const requestOptions = { idempotencyKey: orderId };
            const paymentResponse = await payment.create({ body: paymentData, requestOptions });
            
            // Atualiza Firestore
            const updateData = {
                status: paymentResponse.status,
                statusText: paymentResponse.status_detail,
                paymentId: paymentResponse.id,
                paymentType: paymentResponse.payment_type_id,
            };

            if (paymentResponse.status === "pending" && paymentResponse.point_of_interaction) {
                updateData.paymentData = paymentResponse.point_of_interaction.transaction_data;
                updateData.statusText = "Aguardando Pagamento";
            } else if (paymentResponse.status === "approved") {
                updateData.statusText = "Pagamento Aprovado";
            }
            
            await db.collection("orders").doc(orderId).update(updateData);
            return res.status(200).send(paymentResponse);

        } catch (error) {
            console.error("Erro Pagamento:", error);
            const mpError = error.response ? error.response.data : error;
            return res.status(500).send(mpError);
        }
    });
});

// ==========================================================
// FUNÇÃO 3: WEBHOOK (MANTIDA IGUAL)
// ==========================================================
exports.processWebhook = functions.https.onRequest(async (req, res) => {
    const topic = req.query.topic || req.query.type;
    const id = req.query.id || req.query['data.id'] || (req.body.data ? req.body.data.id : null);

    if (topic === "payment" && id) {
        try {
            const accessToken = mercadoPagoToken.value();
            const client = new MercadoPagoConfig({ accessToken });
            const payment = new Payment(client);
            const paymentDetails = await payment.get({ id: id });
            const orderId = paymentDetails.external_reference;
            
            if (orderId) {
                let newStatusText = paymentDetails.status;
                if(paymentDetails.status === 'approved') newStatusText = "Pagamento Aprovado";
                if(paymentDetails.status === 'pending') newStatusText = "Aguardando Pagamento";
                
                await db.collection("orders").doc(orderId).update({
                    status: paymentDetails.status,
                    statusText: newStatusText,
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        } catch(e) { console.error(e); }
    }
    return res.status(200).send("OK");
});