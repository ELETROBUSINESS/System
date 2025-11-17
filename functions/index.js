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
                items: items, // Salva os itens do carrinho aqui
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
            
            return res.status(200).send({ 
                preferenceId: response.id,
                orderId: orderRef.id
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
            const { formData: brickObject, orderId } = req.body;
            if (!brickObject || !orderId) {
                return res.status(400).send({ error: "Dados incompletos" });
            }
            
            const accessToken = mercadoPagoToken.value();
            const client = new MercadoPagoConfig({ accessToken });
            const payment = new Payment(client);

            // ⬇️ ⬇️ ⬇️ INÍCIO DA CORREÇÃO ⬇️ ⬇️ ⬇️

            // 1. BUSCAR OS ITENS DO PEDIDO NO FIRESTORE
            const orderRef = db.collection("orders").doc(orderId);
            const orderDoc = await orderRef.get();
            if (!orderDoc.exists) {
                return res.status(404).send({ error: "Pedido não encontrado" });
            }
            const cartItems = orderDoc.data().items;

            // 2. FORMATAR OS ITENS PARA A API DE PAGAMENTO
            // (Isso resolve os 6 erros de "Aprovação dos pagamentos")
            const formattedItems = cartItems.map(item => ({
                id: item.id,
                title: item.name,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.priceNew,
                category_id: "MLB1000" // Categoria genérica para "Eletrônicos"
            }));

            // 3. PREPARAR O OBJETO DE PAGAMENTO
            const paymentData = brickObject.formData;
            paymentData.external_reference = orderId;
            paymentData.statement_descriptor = "ELETROBUSINESS"; // Resolve "Fatura do cartão"
            
            // 4. ADICIONAR OS ITENS AO PAGAMENTO
            paymentData.items = formattedItems; 

            // ⬆️ ⬆️ ⬆️ FIM DA CORREÇÃO ⬆️ ⬆️ ⬆️

            // 5. Enviamos os dados completos para o Mercado Pago
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
            await orderRef.update(updateData);
            
            // Retorna a resposta completa do pagamento para o frontend
            return res.status(200).send(paymentResponse);

        } catch (error) {
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
    // ... (Esta função permanece INALTERADA) ...
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