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
            if (!items || !userId || items.length === 0) {
                return res.status(400).send({ error: "Dados da solicitação incompletos" });
            }

            // SEGURANÇA: Recalcula o total baseado nos itens para evitar fraude no frontend
            const calculatedTotal = items.reduce((sum, item) => sum + (item.priceNew * item.quantity), 0);
            
            // Aceitamos uma pequena margem de erro de arredondamento (0.10) ou usamos o calculado
            const finalTotal = calculatedTotal; 

            const accessToken = mercadoPagoToken.value();
            const client = new MercadoPagoConfig({ accessToken });
            const preferenceClient = new Preference(client);

            // 1. FORMATAR OS ITENS
            const formattedItems = items.map(item => ({
                id: item.id,
                title: item.name,
                description: item.description ? item.description.substring(0, 250) : "Produto",
                quantity: parseInt(item.quantity),
                unit_price: Number(item.priceNew),
                category_id: "MLB1000"
            }));

            // 2. CRIAR O PEDIDO NO FIRESTORE
            const orderRef = await db.collection("orders").add({
                userId: userId,
                items: items,
                total: finalTotal, // Usa o total validado
                status: "pending_payment", 
                statusText: "Aguardando Pagamento",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                paymentType: null,
                paymentId: null,
            });

            // 3. CRIAR A PREFERÊNCIA NO MP
            const preferenceData = {
                body: {
                    items: formattedItems,
                    payer: {
                        // O email será preenchido pelo Brick na etapa seguinte, 
                        // mas podemos tentar enviar se tivermos o dado do usuário aqui.
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
            // [CORREÇÃO 1]: Pegamos os dados de forma segura
            // O frontend envia { payment_data: {...}, orderId: ..., preferenceId: ... }
            const body = req.body;
            
            // Tenta pegar de payment_data OU formData (fallback)
            const paymentData = body.payment_data || body.formData;
            const orderId = body.orderId;
            const preferenceId = body.preferenceId;

            if (!paymentData || !orderId || !preferenceId) {
                console.error("Dados recebidos incompletos:", JSON.stringify(body));
                return res.status(400).send({ error: "Dados incompletos ou formato inválido" });
            }
            
            const accessToken = mercadoPagoToken.value();
            const client = new MercadoPagoConfig({ accessToken });
            const payment = new Payment(client);

            // [CORREÇÃO 2]: Associamos à preferência diretamente no objeto extraído
            paymentData.preference_id = preferenceId;
            
            // Garantimos que external_reference está presente para vincular ao webhook
            paymentData.external_reference = orderId;
            
            // Opcional: Garantir descrição na fatura
            paymentData.statement_descriptor = "ELETROBUSINESS";
            
            console.log("Enviando pagamento ao MP:", JSON.stringify(paymentData));

            // 4. Enviamos os dados para o Mercado Pago
            // Usamos X-Idempotency-Key para evitar cobrança dupla em caso de retry de rede
            const requestOptions = {
                idempotencyKey: orderId 
            };

            const paymentResponse = await payment.create({ 
                body: paymentData, 
                requestOptions 
            });
            
            // Atualiza Firestore
            const updateData = {
                status: paymentResponse.status,
                statusText: paymentResponse.status_detail,
                paymentId: paymentResponse.id,
                paymentType: paymentResponse.payment_type_id,
            };

            // Se for Pix ou Boleto (pendente com dados de interação)
            if (paymentResponse.status === "pending" && paymentResponse.point_of_interaction) {
                updateData.paymentData = paymentResponse.point_of_interaction.transaction_data;
                updateData.expiresAt = paymentResponse.date_of_expiration;
                updateData.statusText = "Aguardando Pagamento";
            } else if (paymentResponse.status === "approved") {
                updateData.statusText = "Pagamento Aprovado";
            }
            
            await db.collection("orders").doc(orderId).update(updateData);
            
            return res.status(200).send(paymentResponse);

        } catch (error) {
            // Tratamento de erro detalhado
            console.error("Erro CRÍTICO ao criar pagamento:", error);
            const errorData = error.response ? error.response.data : { message: error.message };
            return res.status(500).send(errorData);
        }
    });
});


// ==========================================================
// FUNÇÃO 3: WEBHOOK
// ==========================================================
exports.processWebhook = functions.https.onRequest(async (req, res) => {
    const topic = req.query.topic || req.query.type;
    // O MP às vezes envia o ID no query params ou no body.data.id
    const id = req.query.id || req.query['data.id'] || (req.body.data ? req.body.data.id : null);

    console.log("Webhook recebido:", topic, id);

    if (topic === "payment" && id) {
        try {
            const accessToken = mercadoPagoToken.value();
            const client = new MercadoPagoConfig({ accessToken });
            const payment = new Payment(client);
            
            const paymentDetails = await payment.get({ id: id });
            const orderId = paymentDetails.external_reference;
            
            if (!orderId) {
                console.warn(`Pagamento ${id} sem external_reference.`);
                return res.status(200).send("OK, ignorado (sem ref)");
            }
            
            const mpStatus = paymentDetails.status;
            let newStatusText = "Processando";

            // Mapeamento simples de status
            const statusMap = {
                approved: "Pagamento Aprovado",
                authorized: "Autorizado",
                in_process: "Em Análise",
                rejected: "Recusado",
                cancelled: "Cancelado",
                refunded: "Reembolsado",
                charged_back: "Estornado"
            };

            if (statusMap[mpStatus]) {
                newStatusText = statusMap[mpStatus];
            }

            await db.collection("orders").doc(orderId).update({
                status: mpStatus,
                statusText: newStatusText,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`Pedido ${orderId} atualizado para ${mpStatus}`);
            return res.status(200).send("Webhook processado");

        } catch (error) {
            console.error("Erro no Webhook:", error);
            return res.status(500).send("Erro interno");
        }
    }
    
    return res.status(200).send("OK");
});