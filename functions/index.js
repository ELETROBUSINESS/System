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
                status: "pending_payment", 
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
// FUNÇÃO 2: CRIAR PAGAMENTO (CORRIGIDA)
// ==========================================================
exports.createPayment = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            // 1. 'formData' do body é o objeto inteiro do Brick
            const { formData: brickObject, orderId } = req.body;
            if (!brickObject || !orderId) {
                return res.status(400).send({ error: "Dados incompletos" });
            }
            
            const accessToken = mercadoPagoToken.value();
            const client = new MercadoPagoConfig({ accessToken });
            const payment = new Payment(client);

            // 2. ⬇️ ⬇️ ⬇️ A CORREÇÃO ESTÁ AQUI ⬇️ ⬇️ ⬇️
            //    Extraímos apenas os dados de pagamento de dentro do objeto do Brick
            const paymentData = brickObject.formData;
            // ⬆️ ⬆️ ⬆️ FIM DA CORREÇÃO ⬆️ ⬆️ ⬆️

            // 3. Adicionamos a referência ao objeto de dados correto
            paymentData.external_reference = orderId;

            // 4. Enviamos apenas os 'paymentData' para o Mercado Pago
            const paymentResponse = await payment.create({ body: paymentData });
            
            // Prepara os dados para salvar no Firestore
            const updateData = {
                status: paymentResponse.status,
                statusText: paymentResponse.status_detail,
                paymentId: paymentResponse.id,
                paymentType: paymentResponse.payment_type_id,
            };

            // Se for PIX, salva os dados do QR Code
            if (paymentResponse.status === "pending" && paymentResponse.point_of_interaction) {
                updateData.paymentData = paymentResponse.point_of_interaction.transaction_data;
                updateData.expiresAt = paymentResponse.date_of_expiration;
                updateData.statusText = "Aguardando Pagamento";
            }
            
            // Atualiza o pedido no Firestore
            const orderRef = db.collection("orders").doc(orderId);
            await orderRef.update(updateData);
            
            // Retorna a resposta completa do pagamento para o frontend
            return res.status(200).send(paymentResponse);

        } catch (error) {
            // Log de erro melhorado
            const errorData = error.response ? error.response.data : { message: error.message };
            console.error("Erro ao criar pagamento:", JSON.stringify(errorData));
            return res.status(500).send(errorData);
        }
    });
});


// ==========================================================
// FUNÇÃO 3: WEBHOOK (Confirma o pagamento)
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
            
            // Formata o status
            const mpStatus = paymentDetails.status;
            let newStatus = "processing";
            let newStatusText = "Processando";

            if (mpStatus === "approved") {
                newStatus = "approved";
                newStatusText = "Pagamento Aprovado";
            } else if (mpStatus === "rejected") {
                newStatus = "failed";
                newStatusText = "Pagamento Falhado";
            }

            // Atualiza o pedido no Firestore
            const orderRef = db.collection("orders").doc(orderId);
            await orderRef.update({
                status: newStatus,
                statusText: newStatusText,
            });

            console.log(`Pedido ${orderId} atualizado para ${newStatus}`);
            return res.status(200).send("Webhook processado com sucesso");

        } catch (error) {
            console.error("Erro ao processar Webhook:", error);
            return res.status(500).send("Erro no Webhook");
        }
    }
    
    return res.status(200).send("OK");
});