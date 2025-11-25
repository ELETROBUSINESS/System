const functions = require("firebase-functions");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const cors = require("cors")({ origin: true });
const { defineString } = require('firebase-functions/params');

const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

const mercadoPagoToken = defineString('MERCADOPAGO_ACCESS_TOKEN');

// ==========================================================
// FUNÇÃO 1: CRIAR PREFERÊNCIA
// ==========================================================
// ... Imports iguais ...

exports.createPreference = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        if (req.method !== "POST") return res.status(405).send({ error: "Method not allowed" });

        try {
            // [ATUALIZAÇÃO]: Recebemos shippingCost, deliveryData e clientData
            const { items, userId, shippingCost, deliveryData, clientData } = req.body;
            
            if (!items || items.length === 0) return res.status(400).send({ error: "No items" });

            // 1. Calcula total dos produtos
            const productsTotal = items.reduce((sum, item) => sum + (item.priceNew * item.quantity), 0);
            
            // 2. Soma o frete (garante que é número)
            const freight = Number(shippingCost) || 0;
            const finalTotal = productsTotal + freight;

            const accessToken = mercadoPagoToken.value();
            const client = new MercadoPagoConfig({ accessToken });
            const preferenceClient = new Preference(client);

            // 3. Formata Itens para o MP
            const formattedItems = items.map(item => ({
                id: item.id,
                title: item.name,
                quantity: parseInt(item.quantity),
                unit_price: Number(item.priceNew),
            }));

            // [ATUALIZAÇÃO]: Adiciona o frete como um "Item" no MP para somar no total visual
            if (freight > 0) {
                formattedItems.push({
                    id: "shipping",
                    title: "Frete / Entrega",
                    quantity: 1,
                    unit_price: freight
                });
            }

            // 4. Salva no Firestore com os novos dados
            const orderRef = await db.collection("orders").add({
                userId: userId || 'guest',
                items: items,
                productsTotal: productsTotal,
                shippingCost: freight,
                total: finalTotal, // Total Final
                deliveryData: deliveryData || {}, // Salva endereço/loja
                clientData: clientData || {},     // Salva nome/fone
                status: "pending_payment", 
                statusText: "Iniciando Checkout",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // 5. Cria Preferência
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

// ... createPayment e webhook continuam iguais (o createPayment apenas lê o total validado no backend ou confia no payment_data) ...
// OBS: Mantenha o createPayment como estava na versão "blindada" anterior.
exports.createPayment = functions.https.onRequest(async (req, res) => {
    // ... use o código da resposta anterior (o blindado) ...
    // A única diferença é que agora o pedido no banco terá mais dados, mas o pagamento flui igual.
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

            const requestOptions = { idempotencyKey: orderId };
            const paymentResponse = await payment.create({ body: paymentData, requestOptions });
            
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

exports.processWebhook = functions.https.onRequest(async (req, res) => {
    // Mantenha o webhook igual
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
                
                await db.collection("orders").doc(orderId).update({
                    status: paymentDetails.status,
                    statusText: newStatusText
                });
            }
        } catch(e) {}
    }
    return res.status(200).send("OK");
});

// ==========================================================
// FUNÇÃO 2: CRIAR PAGAMENTO (CORRIGIDA)
// ==========================================================
exports.createPayment = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const body = req.body;
            
            // Recupera dados (aceita payment_data ou formData)
            const paymentData = body.payment_data || body.formData;
            const orderId = body.orderId;

            if (!paymentData || !orderId) {
                console.error("Dados incompletos:", JSON.stringify(body));
                return res.status(400).send({ error: "Dados de pagamento ausentes" });
            }
            
            const accessToken = mercadoPagoToken.value();
            const client = new MercadoPagoConfig({ accessToken });
            const payment = new Payment(client);

            // [CORREÇÃO CRÍTICA]: 
            // 1. NÃO adicionar paymentData.preference_id = ... (Isso causava o erro)
            
            // 2. Garantir external_reference
            paymentData.external_reference = orderId;
            
            // 3. Garantir statement_descriptor se não vier
            if (!paymentData.statement_descriptor) {
                paymentData.statement_descriptor = "ELETROBUSINESS";
            }

            // LOG PARA DEBUG (Vai aparecer no console do Firebase Functions)
            console.log(">>> Payload enviado ao MP:", JSON.stringify(paymentData, null, 2));

            const requestOptions = { idempotencyKey: orderId };

            const paymentResponse = await payment.create({ 
                body: paymentData, 
                requestOptions 
            });
            
            // Atualiza Firestore com o resultado
            const updateData = {
                status: paymentResponse.status,
                statusText: paymentResponse.status_detail,
                paymentId: paymentResponse.id,
                paymentType: paymentResponse.payment_type_id,
            };

            // Se for Pix (Pending + Interaction)
            if (paymentResponse.status === "pending" && paymentResponse.point_of_interaction) {
                updateData.paymentData = paymentResponse.point_of_interaction.transaction_data;
                updateData.expiresAt = paymentResponse.date_of_expiration;
                updateData.statusText = "Aguardando Pagamento";
            } 
            else if (paymentResponse.status === "approved") {
                updateData.statusText = "Pagamento Aprovado";
            }
            
            await db.collection("orders").doc(orderId).update(updateData);
            
            return res.status(200).send(paymentResponse);

        } catch (error) {
            console.error("ERRO FATAL NO PAGAMENTO:", error);
            
            // Tenta extrair a mensagem de erro real do Mercado Pago
            const mpError = error.response ? error.response.data : error;
            console.error("Detalhes MP:", JSON.stringify(mpError));

            return res.status(500).send(mpError);
        }
    });
});

// ==========================================================
// FUNÇÃO 3: WEBHOOK (Mantenha igual, serve apenas para atualizar status)
// ==========================================================
exports.processWebhook = functions.https.onRequest(async (req, res) => {
    // ... (seu código de webhook existente pode ficar aqui)
    return res.status(200).send("OK");
});