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
exports.createPreference = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        if (req.method !== "POST") {
            return res.status(405).send({ error: "Método não permitido" });
        }

        try {
            const { price, items, userId } = req.body;
            
            // Validação básica
            if (!items || items.length === 0) {
                console.error("Tentativa de criar preferência sem itens.");
                return res.status(400).send({ error: "Sem itens no carrinho" });
            }

            const accessToken = mercadoPagoToken.value();
            const client = new MercadoPagoConfig({ accessToken });
            const preferenceClient = new Preference(client);

            // Formata itens
            const formattedItems = items.map(item => ({
                id: item.id,
                title: item.name,
                description: item.description ? item.description.substring(0, 250) : "Produto",
                quantity: parseInt(item.quantity),
                unit_price: Number(item.priceNew),
                category_id: "MLB1000"
            }));

            // Cria Pedido no Firestore
            const orderRef = await db.collection("orders").add({
                userId: userId || 'guest',
                items: items,
                total: price,
                status: "pending_payment", 
                statusText: "Iniciando Checkout",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // Cria Preferência no MP
            const preferenceData = {
                body: {
                    items: formattedItems,
                    back_urls: {
                        success: "https://eletrobusiness.com.br/", 
                        failure: "https://eletrobusiness.com.br/",
                        pending: "https://eletrobusiness.com.br/"
                    },
                    auto_return: "approved",
                    external_reference: orderRef.id, // VÍNCULO IMPORTANTE
                    statement_descriptor: "ELETROBUSINESS",
                }
            };
            
            const response = await preferenceClient.create(preferenceData);
            
            return res.status(200).send({ 
                preferenceId: response.id,
                orderId: orderRef.id
            });

        } catch (error) {
            console.error("Erro ao criar preferência:", error);
            return res.status(500).send({ error: "Erro interno ao criar preferência" });
        }
    }); 
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