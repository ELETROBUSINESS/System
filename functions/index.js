const functions = require("firebase-functions");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const cors = require("cors")({ origin: true });
const { defineString } = require('firebase-functions/params');

const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

const mercadoPagoToken = defineString('MERCADOPAGO_ACCESS_TOKEN');

// URL DO SEU PROJETO (FIXA PARA GARANTIR O RECEBIMENTO)
// Baseada no ID: super-app25
const WEBHOOK_URL = "https://us-central1-super-app25.cloudfunctions.net/processWebhook";

// ==========================================================
// FUNÇÃO 1: CRIAR PREFERÊNCIA
// ==========================================================
exports.createPreference = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        if (req.method !== "POST") return res.status(405).send({ error: "Method not allowed" });

        try {
            const { items, userId, shippingCost, deliveryData, clientData } = req.body;
            
            if (!items || items.length === 0) return res.status(400).send({ error: "No items" });

            // Cálculos
            const productsTotal = items.reduce((sum, item) => sum + (item.priceNew * item.quantity), 0);
            const freight = Number(shippingCost) || 0;
            const finalTotal = productsTotal + freight;

            const accessToken = mercadoPagoToken.value();
            const client = new MercadoPagoConfig({ accessToken });
            const preferenceClient = new Preference(client);

            // Itens
            const formattedItems = items.map(item => ({
                id: item.id,
                title: item.name,
                quantity: parseInt(item.quantity),
                unit_price: Number(item.priceNew),
            }));

            // Frete como item
            if (freight > 0) {
                formattedItems.push({
                    id: "shipping",
                    title: "Frete / Entrega",
                    quantity: 1,
                    unit_price: freight
                });
            }

            // Salva no Firestore
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

            // Cria Preferência
            const preferenceData = {
                body: {
                    items: formattedItems,
                    payer: {
                        name: clientData ? clientData.firstName : 'Cliente',
                        surname: clientData ? clientData.lastName : '',
                        email: clientData ? clientData.email : '',
                        phone: {
                            area_code: "",
                            number: clientData ? clientData.phone : ""
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
                    // [IMPORTANTE] Avisa ao MP onde mandar o status (Preferência)
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
            return res.status(500).send({ error: error.message });
        }
    }); 
});

// ==========================================================
// FUNÇÃO 2: CRIAR PAGAMENTO
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

            paymentData.external_reference = orderId;
            if (!paymentData.statement_descriptor) paymentData.statement_descriptor = "ELETROBUSINESS";

            // [CORREÇÃO CRÍTICA]: Adiciona a URL do Webhook aqui também
            paymentData.notification_url = WEBHOOK_URL;

            console.log("Enviando Pagamento com Webhook:", WEBHOOK_URL);

            const requestOptions = { idempotencyKey: orderId };
            const paymentResponse = await payment.create({ body: paymentData, requestOptions });
            
            // Atualiza Firestore Inicial
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
// FUNÇÃO 3: WEBHOOK (RECEBE A CONFIRMAÇÃO)
// ==========================================================
exports.processWebhook = functions.https.onRequest(async (req, res) => {
    const topic = req.query.topic || req.query.type;
    const id = req.query.id || req.query['data.id'] || (req.body.data ? req.body.data.id : null);

    console.log(`Webhook disparado! Tópico: ${topic}, ID: ${id}`);

    if (topic === "payment" && id) {
        try {
            const accessToken = mercadoPagoToken.value();
            const client = new MercadoPagoConfig({ accessToken });
            const payment = new Payment(client);
            
            // Consulta o status atualizado no Mercado Pago
            const paymentDetails = await payment.get({ id: id });
            const orderId = paymentDetails.external_reference;
            const mpStatus = paymentDetails.status;

            console.log(`Atualizando pedido ${orderId} para ${mpStatus}`);
            
            if (orderId) {
                let newStatusText = mpStatus;
                
                // Tradução de status
                if(mpStatus === 'approved') newStatusText = "Pagamento Aprovado";
                if(mpStatus === 'pending') newStatusText = "Aguardando Pagamento";
                if(mpStatus === 'rejected') newStatusText = "Pagamento Recusado";

                // Atualiza o banco em tempo real
                await db.collection("orders").doc(orderId).update({
                    status: mpStatus,
                    statusText: newStatusText,
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        } catch(e) {
            console.error("Erro ao processar webhook:", e);
        }
    }
    
    // Responde 200 OK para o Mercado Pago não ficar reenviando
    return res.status(200).send("OK");
});