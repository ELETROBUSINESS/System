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
// FUNÇÃO 2: CRIAR PAGAMENTO (BLINDADA CONTRA ERROS DE DADOS)
// ==========================================================
exports.createPayment = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const body = req.body;
            // Dados brutos do Frontend
            const paymentData = body.payment_data || body.formData;
            const customPayer = body.customPayer || {}; 
            const orderId = body.orderId;
            const items = body.items || [];
            const shippingCost = Number(body.shippingCost) || 0;

            if (!paymentData || !orderId) return res.status(400).send({ error: "Dados de pagamento ausentes" });
            
            const accessToken = mercadoPagoToken.value();
            const client = new MercadoPagoConfig({ accessToken });
            const payment = new Payment(client);

            // 1. Captura IP (Obrigatório para Device ID)
            let ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            if (ipAddress && ipAddress.indexOf(',') > -1) ipAddress = ipAddress.split(',')[0];
            if (!ipAddress || ipAddress === '::1') ipAddress = '127.0.0.1';

            // 2. Sanitização de Dados (AQUI ESTAVA O ERRO PROVÁVEL)
            // O MP exige strings limpas para telefone e CPF
            const cleanAreaCode = customPayer.phone ? String(customPayer.phone.area_code).replace(/\D/g, '') : "11";
            const cleanNumber = customPayer.phone ? String(customPayer.phone.number).replace(/\D/g, '') : "900000000";
            const cleanCpf = customPayer.identification ? String(customPayer.identification.number).replace(/\D/g, '') : "";
            const cleanZip = customPayer.address ? String(customPayer.address.zip_code).replace(/\D/g, '') : "00000000";

            // 3. Constrói o Payload Limpo
            // Em vez de usar o objeto 'sujo' do frontend, injetamos os dados validados
            
            // Preserva dados vitais do token gerado pelo Brick
            const finalPaymentData = {
                token: paymentData.token,
                issuer_id: paymentData.issuer_id,
                payment_method_id: paymentData.payment_method_id,
                transaction_amount: Number(paymentData.transaction_amount),
                installments: Number(paymentData.installments),
                payer: {
                    email: customPayer.email || paymentData.payer.email,
                    first_name: customPayer.first_name || "Cliente",
                    last_name: customPayer.last_name || "Eletro",
                    identification: {
                        type: "CPF", // Obrigatório ser CPF
                        number: cleanCpf 
                    },
                    address: {
                        zip_code: cleanZip,
                        street_name: customPayer.address?.street_name || "Rua",
                        street_number: customPayer.address?.street_number || "0",
                        neighborhood: "Centro", // Opcional mas bom ter
                        city: customPayer.address?.city || "Cidade",
                        federal_unit: "PA" // Opcional
                    }
                },
                additional_info: {
                    ip_address: ipAddress,
                    items: [], // Será preenchido abaixo
                    payer: {
                        first_name: customPayer.first_name,
                        last_name: customPayer.last_name,
                        phone: {
                            area_code: cleanAreaCode,
                            number: cleanNumber
                        },
                        address: {
                            zip_code: cleanZip,
                            street_name: customPayer.address?.street_name || "Rua",
                            street_number: customPayer.address?.street_number || "0"
                        }
                    }
                },
                external_reference: orderId,
                statement_descriptor: "ELETROBUSINESS",
                notification_url: WEBHOOK_URL
            };

            // Se for PIX, removemos campos exclusivos de cartão para não dar erro
            if (paymentData.payment_method_id === 'pix') {
                delete finalPaymentData.token;
                delete finalPaymentData.issuer_id;
                delete finalPaymentData.installments;
            }

            // 4. Preenche Itens (Risco)
            const formattedItems = items.map(item => ({
                id: item.id ? String(item.id) : "ID",
                title: item.name ? String(item.name) : "Produto",
                description: "Item da Loja",
                picture_url: item.image || "",
                category_id: "electronics",
                quantity: parseInt(item.quantity),
                unit_price: Number(item.priceNew)
            }));

            if (shippingCost > 0) {
                formattedItems.push({
                    id: "shipping",
                    title: "Frete",
                    description: "Entrega",
                    category_id: "services",
                    quantity: 1,
                    unit_price: Number(shippingCost)
                });
            }
            finalPaymentData.additional_info.items = formattedItems;

            console.log(`Enviando Payload Blindado para Order ${orderId}`);

            const requestOptions = { idempotencyKey: orderId };
            const paymentResponse = await payment.create({ body: finalPaymentData, requestOptions });
            
            // Salva sucesso no Firestore
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
            console.error("Erro Pagamento Backend:", error);
            // Tenta pegar a mensagem de erro real do MP
            const mpError = error.response ? error.response.data : { message: error.message };
            // Retorna 400 para o frontend saber que falhou, com os detalhes
            return res.status(400).send(mpError);
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