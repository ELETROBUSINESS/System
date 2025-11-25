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
// FUNÇÃO 2: CRIAR PAGAMENTO (ATUALIZADA PARA CORRIGIR ERROS DE HOMOLOGAÇÃO)
// ==========================================================
exports.createPayment = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const body = req.body;
            const paymentData = body.payment_data || body.formData;
            const orderId = body.orderId;

            if (!paymentData || !orderId) return res.status(400).send({ error: "Dados ausentes" });
            
            const accessToken = mercadoPagoToken.value();
            const client = new MercadoPagoConfig({ accessToken });
            const payment = new Payment(client);

            // [CORREÇÃO 1]: Identificador do Dispositivo e IP
            // Captura o IP real do cliente através do proxy do Firebase/Google
            let ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            if (ipAddress && ipAddress.indexOf(',') > -1) {
                ipAddress = ipAddress.split(',')[0]; // Pega o primeiro IP se houver lista
            }

            // Adiciona informações adicionais obrigatórias para análise de risco
            paymentData.additional_info = {
                ip_address: ipAddress,
                items: paymentData.items || [] // Repassa itens se disponível, ajuda na aprovação
            };

            // [CORREÇÃO 2]: Descrição da Fatura (Statement Descriptor)
            // Nome que aparecerá na fatura do cartão (Máx 22 caracteres)
            paymentData.statement_descriptor = "ELETROBUSINESS";
            paymentData.description = `Pedido ${orderId}`; // Descrição interna

            // Configurações Padrão
            paymentData.external_reference = orderId;
            paymentData.notification_url = WEBHOOK_URL;

            console.log("Processando pagamento para Order:", orderId, "IP:", ipAddress);

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