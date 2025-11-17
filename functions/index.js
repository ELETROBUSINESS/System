const functions = require("firebase-functions");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const cors = require("cors")({ origin: true });
const { defineString } = require('firebase-functions/params');

const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

const mercadoPagoToken = defineString('MERCADOPAGO_ACCESS_TOKEN');

// ==========================================================
// FUNÇÃO 1: CRIAR PREFERÊNCIA (Inalterada)
// ==========================================================
exports.createPreference = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        if (req.method !== "POST") {
            return res.status(405).send({ error: "Método não permitido" });
        }

        try {
            const { name, price, items, userId } = req.body;
            if (!name || !price || !items || !userId) {
                return res.status(400).send({ error: "Dados da solicitação incompletos" });
            }

            const accessToken = mercadoPagoToken.value();
            const client = new MercadoPagoConfig({ accessToken });
            const preferenceClient = new Preference(client);

            // 1. CRIAR O PEDIDO NO FIRESTORE
            const orderRef = await db.collection("orders").add({
                userId: userId,
                items: items,
                total: price,
                status: "pending_payment", // Status inicial
                statusText: "Aguardando Pagamento",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                paymentType: null,
                paymentId: null,
            });

            // 2. CRIAR A PREFERÊNCIA NO MERCADO PAGO
            const preferenceData = {
                body: {
                    items: [ { title: name, unit_price: Number(price), quantity: 1, } ],
                    back_urls: {
                        success: "https://eletrobusiness.com.br/", 
                        failure: "https://eletrobusiness.com.br/",
                    },
                    auto_return: "approved",
                    external_reference: orderRef.id, 
                }
            };
            
            const response = await preferenceClient.create(preferenceData);
            
            // 3. RETORNA OS IDs PARA O FRONTEND
            return res.status(200).send({ 
                preferenceId: response.id, // ID do Mercado Pago
                orderId: orderRef.id       // ID do nosso Firestore
            });

        } catch (error) {
            console.error("Erro ao criar preferência:", error);
            return res.status(500).send({ error: "Erro ao criar preferência" });
        }
    }); 
});

// ==========================================================
// FUNÇÃO 2: PROCESSAR PAGAMENTO (Inalterada)
// ==========================================================
exports.processPayment = functions.https.onRequest(async (req, res) => {
    // ... (manter o código da sua processPayment anterior)
});

// ==========================================================
// FUNÇÃO 3: WEBHOOK DO MERCADO PAGO (CORRIGIDA)
// ==========================================================
exports.processWebhook = functions.https.onRequest(async (req, res) => {
    const topic = req.query.topic || req.query.type;
    console.log("Webhook recebido:", topic, req.body);

    if (topic === "payment") {
        try {
            const paymentId = req.body.data.id;
            
            const accessToken = mercadoPagoToken.value();
            const client = new MercadoPagoConfig({ accessToken });
            const payment = new Payment(client);
            
            const paymentDetails = await payment.get({ id: paymentId });
            
            const orderId = paymentDetails.external_reference;
            
            if (!orderId) {
                console.warn(`Pagamento ${paymentId} sem external_reference.`);
                return res.status(200).send("OK, mas sem external_reference");
            }
            
            // 3. Formatar o novo status
            const mpStatus = paymentDetails.status; // ex: 'approved', 'rejected', 'pending'
            let newStatus = "processing";
            let newStatusText = "Processando";

            if (mpStatus === "approved") {
                newStatus = "approved";
                newStatusText = "Pagamento Aprovado";
            } else if (mpStatus === "rejected") {
                newStatus = "failed";
                newStatusText = "Pagamento Falhado";
            } else if (mpStatus === "pending" || mpStatus === "in_process") {
                // 'pending' é o status do PIX recém-criado
                newStatus = "pending_payment";
                newStatusText = "Aguardando Pagamento";
            }
            
            // ⬇️ ⬇️ ⬇️ CORREÇÃO IMPORTANTE ⬇️ ⬇️ ⬇️
            // Objeto para atualizar o Firestore
            const updateData = {
                status: newStatus,
                statusText: newStatusText,
                paymentId: paymentId,
                paymentType: paymentDetails.payment_type_id,
            };

            // Se for PIX (pending), salvamos os dados do QR Code
            if (newStatus === "pending_payment" && paymentDetails.point_of_interaction) {
                updateData.paymentData = paymentDetails.point_of_interaction.transaction_data;
                // Salvamos a data de expiração que o MP nos envia
                updateData.expiresAt = paymentDetails.date_of_expiration;
            }
            // ⬆️ ⬆️ ⬆️ FIM DA CORREÇÃO ⬆️ ⬆️ ⬆️

            // 4. Atualizar o pedido no Firestore
            const orderRef = db.collection("orders").doc(orderId);
            await orderRef.update(updateData); // Agora envia o objeto 'updateData'

            console.log(`Pedido ${orderId} atualizado para ${newStatus}`);
            return res.status(200).send("Webhook processado com sucesso");

        } catch (error) {
            console.error("Erro ao processar Webhook:", error);
            return res.status(500).send("Erro no Webhook");
        }
    }
    
    return res.status(200).send("OK");
});