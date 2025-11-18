const functions = require("firebase-functions");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const cors = require("cors")({ origin: true });
const { defineString } = require('firebase-functions/params');

const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

const mercadoPagoToken = defineString('MERCADOPAGO_ACCESS_TOKEN');

// ==========================================================
// FUNÇÃO 1: CRIAR PREFERÊNCIA (Corrigida para enviar itens)
// ==========================================================
exports.createPreference = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        if (req.method !== "POST") {
            return res.status(405).send({ error: "Método não permitido" });
        }

        try {
            const { price, items, userId } = req.body;
            if (!price || !items || !userId || items.length === 0) {
                return res.status(400).send({ error: "Dados da solicitação incompletos" });
            }

            const accessToken = mercadoPagoToken.value();
            const client = new MercadoPagoConfig({ accessToken });
            const preferenceClient = new Preference(client);

            // 1. FORMATAR OS ITENS PARA A PREFERÊNCIA
            // (Resolve os 6 erros de "Aprovação dos pagamentos")
            const formattedItems = items.map(item => ({
                id: item.id,
                title: item.name,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.priceNew,
                category_id: "MLB1000" // Categoria genérica para "Eletrônicos"
            }));

            // 2. CRIAR O PEDIDO NO FIRESTORE
            const orderRef = await db.collection("orders").add({
                userId: userId,
                items: items, // Salva os itens originais do carrinho
                total: price, // Salva o total
                status: "pending_payment", 
                statusText: "Aguardando Pagamento",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                paymentType: null,
                paymentId: null,
            });

            // 3. CRIAR A PREFERÊNCIA NO MP (Agora com os itens corretos)
            const preferenceData = {
                body: {
                    items: formattedItems, // <--- USA OS ITENS FORMATADOS
                    back_urls: {
                        success: "https://eletrobusiness.com.br/", 
                        failure: "https://eletrobusiness.com.br/",
                    },
                    auto_return: "approved",
                    external_reference: orderRef.id, 
                }
            };
            
            // ⬇️ ⬇️ ⬇️ LOG ADICIONADO ⬇️ ⬇️ ⬇️
            console.log(`[LOG] Criando PREFERÊNCIA para Ordem ${orderRef.id}:`, JSON.stringify(preferenceData.body, null, 2));
            // ⬆️ ⬆️ ⬆️ FIM DO LOG ⬆️ ⬆️ ⬆️
            
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
// FUNÇÃO 2: CRIAR PAGAMENTO (Corrigida para usar preference_id)
// ==========================================================
exports.createPayment = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const { formData: brickObject, orderId, preferenceId } = req.body; 
            if (!brickObject || !orderId || !preferenceId) {
                return res.status(400).send({ error: "Dados incompletos" });
            }
            
            const accessToken = mercadoPagoToken.value();
            const client = new MercadoPagoConfig({ accessToken });
            const payment = new Payment(client);

            // 1. Extrai os dados de pagamento (token, payer, etc.)
            const paymentData = brickObject.formData;

            // 2. ⬇️ ⬇️ ⬇️ CORREÇÃO CRÍTICA AQUI ⬇️ ⬇️ ⬇️
            // O Brick envia 'transaction_amount', mas ele conflita
            // com 'preference_id'. Devemos removê-lo.
            delete paymentData.transaction_amount;
            // ⬆️ ⬆️ ⬆️ FIM DA CORREÇÃO ⬆️ ⬆️ ⬆️

            // Agora, a 'preference_id' se torna a fonte da verdade
            // (Substituindo a 'transaction_amount' que removemos)
            paymentData.preference_id = preferenceId;
            
            // 3. Adicionamos os outros campos que o MP gosta
            paymentData.external_reference = orderId;
            paymentData.statement_descriptor = "ELETROBUSINESS";

            // (Os console.logs podem ficar aqui para depuração)
            console.log(`[LOG] Criando PAGAMENTO para Ordem ${orderId}:`, JSON.stringify(paymentData, null, 2));

            // 4. Enviamos os dados para o Mercado Pago
            const paymentResponse = await payment.create({ body: paymentData });
            
            // O resto da lógica para salvar no Firestore está correta
            const updateData = {
                status: paymentResponse.status,
                statusText: paymentResponse.status_detail,
                paymentId: paymentResponse.id,
                paymentType: paymentResponse.payment_type_id,
            };

            if (paymentResponse.status === "pending" && paymentResponse.point_of_interaction) {
                updateData.paymentData = paymentResponse.point_of_interaction.transaction_data;
                updateData.expiresAt = paymentResponse.date_of_expiration;
                updateData.statusText = "Aguardando Pagamento";
            }
            
            const orderRef = db.collection("orders").doc(orderId);
            await orderRef.update(updateData);
            
            return res.status(200).send(paymentResponse);

        } catch (error) {
            // O erro [preference_id] vinha daqui, da API do MP
            const errorData = error.response ? error.response.data : { message: error.message };
            console.error("Erro ao criar pagamento:", JSON.stringify(errorData));
            
            // Envia o erro real da API do MP de volta para o cliente
            const clientError = errorData.message || "Erro desconhecido";
            return res.status(500).send({ message: clientError, details: errorData });
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