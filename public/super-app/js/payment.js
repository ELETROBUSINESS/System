// js/payment.js

const mp = new MercadoPago(MP_PUBLIC_KEY);
let paymentBrickController;
let currentShippingCost = 0;
let deliveryMode = 'delivery'; // 'delivery' ou 'pickup'
let selectedStore = '';

document.addEventListener("DOMContentLoaded", () => {
    // Escuta o login para preencher o email
    document.addEventListener('userReady', (e) => {
        const user = e.detail;
        if(user && user.email) {
            document.getElementById("reg-email").value = user.email;
            loadUserData(user.uid);
        }
    });
    
    // Se o usuário já estiver carregado antes do listener
    if(auth && auth.currentUser) {
        document.getElementById("reg-email").value = auth.currentUser.email;
        loadUserData(auth.currentUser.uid);
    }

    setupStepNavigation();
    setupDeliveryLogic();
    setupPixEvents();
});

// --- CARREGAR DADOS DO USUÁRIO ---
async function loadUserData(uid) {
    try {
        const doc = await db.collection("users").doc(uid).get();
        if (doc.exists) {
            const data = doc.data();
            document.getElementById("reg-first-name").value = data.firstName || '';
            document.getElementById("reg-last-name").value = data.lastName || '';
            document.getElementById("reg-phone").value = data.phone || '';
        }
    } catch (e) {
        console.error("Erro ao carregar perfil", e);
    }
}

// --- NAVEGAÇÃO ENTRE ETAPAS ---
function setupStepNavigation() {
    // Botão: Cadastro -> Envio
    document.getElementById("btn-go-shipping").addEventListener("click", async () => {
        const fname = document.getElementById("reg-first-name").value.trim();
        const lname = document.getElementById("reg-last-name").value.trim();
        const phone = document.getElementById("reg-phone").value.trim();

        if (!fname || !lname || !phone) {
            showToast("Preencha todos os campos obrigatórios.", "error");
            return;
        }

        // Salva no Firebase
        if (auth.currentUser) {
            try {
                await db.collection("users").doc(auth.currentUser.uid).set({
                    firstName: fname,
                    lastName: lname,
                    phone: phone,
                    email: auth.currentUser.email
                }, { merge: true });
            } catch (e) { console.error("Erro ao salvar user", e); }
        }

        // Avança UI
        changeStep(2);
    });

    // Botão: Envio -> Pagamento
    document.getElementById("btn-go-payment").addEventListener("click", async () => {
        // Validação da Entrega
        if (deliveryMode === 'delivery') {
            const cep = document.getElementById("cep").value;
            const city = document.getElementById("city-select").value;
            const address = document.getElementById("address").value;
            
            if (!cep || !city || !address) {
                showToast("Preencha o endereço completo.", "error");
                return;
            }
        } else {
            if (!selectedStore) {
                showToast("Selecione uma loja para retirada.", "error");
                return;
            }
        }

        // Avança UI
        changeStep(3);
        await initPaymentBrick();
    });
}

function changeStep(stepNum) {
    // Esconde todos
    document.querySelectorAll('.checkout-step').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));

    // Mostra o atual
    if (stepNum === 2) {
        document.getElementById("step-shipping").classList.add("active");
        document.getElementById("step-indic-1").classList.add("active");
        document.getElementById("step-indic-2").classList.add("active");
    } else if (stepNum === 3) {
        document.getElementById("step-payment").classList.add("active");
        document.getElementById("step-indic-1").classList.add("active");
        document.getElementById("step-indic-2").classList.add("active");
        document.getElementById("step-indic-3").classList.add("active");
    }
}

// --- LÓGICA DE ENTREGA E FRETE ---
function setupDeliveryLogic() {
    // Funções globais para o HTML acessar
    window.selectDeliveryType = (type) => {
        deliveryMode = type;
        
        // Visual Cards
        document.querySelectorAll('.delivery-option-card').forEach(c => c.classList.remove('selected'));
        document.querySelector(`.delivery-option-card[data-type="${type}"]`).classList.add('selected');

        // Toggle Forms
        if (type === 'delivery') {
            document.getElementById("container-delivery-form").style.display = 'block';
            document.getElementById("container-pickup-list").style.display = 'none';
            calculateShipping(); // Recalcula
        } else {
            document.getElementById("container-delivery-form").style.display = 'none';
            document.getElementById("container-pickup-list").style.display = 'block';
            currentShippingCost = 0; // Retirada é grátis
        }
    };

    window.selectStore = (elem, storeName) => {
        document.querySelectorAll('.store-item').forEach(i => {
            i.classList.remove('selected');
            i.querySelector('i').className = 'bx bx-circle';
        });
        elem.classList.add('selected');
        elem.querySelector('i').className = 'bx bx-check-circle';
        selectedStore = storeName;
    };

    // Recalcula frete ao mudar a cidade
    document.getElementById("city-select").addEventListener("change", calculateShipping);
}

function calculateShipping() {
    if (deliveryMode === 'pickup') return;

    const city = document.getElementById("city-select").value;
    const cartTotal = CartManager.total();
    const display = document.getElementById("shipping-cost-display");

    if (!city) {
        currentShippingCost = 0;
        display.innerText = "Selecione a cidade";
        return;
    }

    if (city === "Ipixuna do Pará") {
        if (cartTotal >= 29.99) {
            currentShippingCost = 0;
            display.innerText = "Grátis (Pedido > R$ 29,99)";
            display.style.color = "green";
        } else {
            currentShippingCost = 10.00; // Taxa simbólica se for menor (ou pode bloquear)
            display.innerText = "R$ 10,00 (Min. R$ 29,99 para grátis)";
            display.style.color = "red";
        }
    } else if (city === "Aurora do Pará") {
        currentShippingCost = 50.00;
        display.innerText = "R$ 50,00";
        display.style.color = "#333";
    } else {
        currentShippingCost = 0; // Outra cidade (lógica a definir, deixei 0 pra não travar)
        display.innerText = "A combinar";
    }
}

// --- PAGAMENTO (MERCADO PAGO) ---
async function initPaymentBrick() {
    const cart = CartManager.get();
    const productsTotal = CartManager.total();
    const finalTotal = productsTotal + currentShippingCost;

    // Atualiza Display do Resumo
    document.getElementById("payment-subtotal-display").innerText = `R$ ${productsTotal.toFixed(2).replace('.', ',')}`;
    document.getElementById("payment-shipping-display").innerText = currentShippingCost === 0 ? "Grátis" : `R$ ${currentShippingCost.toFixed(2).replace('.', ',')}`;
    document.getElementById("payment-total-display").innerText = `R$ ${finalTotal.toFixed(2).replace('.', ',')}`;

    // Dados do Usuário Coletados
    const firstName = document.getElementById("reg-first-name").value;
    const lastName = document.getElementById("reg-last-name").value;
    const phone = document.getElementById("reg-phone").value;
    const email = document.getElementById("reg-email").value;

    const user = auth.currentUser;
    const uid = user ? user.uid : 'guest';

    try {
        // 1. Cria Preferência (Enviando o Frete e Dados do Cliente)
        const response = await fetch(API_URLS.CREATE_PREFERENCE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                items: cart, 
                shippingCost: currentShippingCost, // NOVO: Envia o frete
                deliveryData: {
                    mode: deliveryMode,
                    store: selectedStore,
                    address: deliveryMode === 'delivery' ? document.getElementById("address").value : null,
                    city: deliveryMode === 'delivery' ? document.getElementById("city-select").value : null,
                },
                clientData: { firstName, lastName, phone, email }, // NOVO: Envia dados do cliente
                userId: uid 
            }),
        });
        
        if (!response.ok) throw new Error("Erro ao criar preferência");
        const data = await response.json(); 
        
        // 2. Monta o Brick
        if (paymentBrickController) paymentBrickController.unmount(); // Limpa se já existir
        
        const builder = mp.bricks();
        const settings = {
            initialization: {
                amount: finalTotal, // Envia o total COM frete para o Brick
                preferenceId: data.preferenceId,
                payer: { email: email },
            },
            customization: {
                paymentMethods: { bankTransfer: "all", creditCard: "all", mercadoPago: "all" },
                visual: { style: { theme: 'light' } }
            },
            callbacks: {
                onReady: () => {
                    document.getElementById("brick-loading-message").style.display = 'none';
                },
                onSubmit: ({ formData }) => {
                    // Prepara Payload
                    const finalData = { ...formData };
                    if (!finalData.payer) finalData.payer = {};
                    finalData.payer.email = email;
                    finalData.payer.first_name = firstName;
                    finalData.payer.last_name = lastName;
                    finalData.payer.entity_type = 'individual';
                    finalData.payer.type = 'customer';
                    
                    // Adiciona o telefone se o MP aceitar (opcional, mas bom ter)
                    // finalData.payer.phone = { number: phone }; 

                    console.log("Enviando Pagamento...", finalData);

                    return new Promise((resolve, reject) => {
                        fetch(API_URLS.CREATE_PAYMENT, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                payment_data: finalData,
                                orderId: data.orderId
                            })
                        })
                        .then(res => res.json())
                        .then(paymentResult => {
                            CartManager.clear();
                            if (paymentResult.status === 'pending' && paymentResult.point_of_interaction) {
                                showPixScreen(paymentResult);
                                resolve();
                            } else {
                                window.location.href = "pedidos.html"; 
                                resolve();
                            }
                        })
                        .catch(error => {
                            console.error("Erro Backend:", error);
                            showToast("Erro ao processar pagamento.", "error");
                            reject();
                        });
                    });
                },
                onError: (error) => {
                    console.error(error);
                    showToast("Erro no formulário", "error");
                },
            },
        };

        paymentBrickController = await builder.create("payment", "payment-brick-container", settings);

    } catch (e) {
        console.error("Erro fatal:", e);
        showToast("Erro ao iniciar pagamento.", "error");
    }
}

// --- PIX ---
function setupPixEvents() {
    const btnCopy = document.getElementById("btn-copy-pix");
    if (btnCopy) {
        btnCopy.addEventListener("click", () => {
            const input = document.getElementById("display-pix-copypaste");
            input.select();
            document.execCommand("copy");
            showToast("Código copiado!", "success");
        });
    }
    const btnFinish = document.getElementById("btn-finish-pix");
    if (btnFinish) {
        btnFinish.addEventListener("click", () => {
            window.location.href = "pedidos.html";
        });
    }
}

function showPixScreen(paymentResult) {
    const qrCodeBase64 = paymentResult.point_of_interaction.transaction_data.qr_code_base64;
    const qrCodeCopy = paymentResult.point_of_interaction.transaction_data.qr_code;

    document.getElementById("display-pix-qr").src = `data:image/png;base64,${qrCodeBase64}`;
    document.getElementById("display-pix-copypaste").value = qrCodeCopy;

    document.getElementById("checkout-stepper").style.display = 'none';
    document.getElementById("step-payment").style.display = 'none';
    document.getElementById("step-pix-result").style.display = 'block';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}