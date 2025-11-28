// js/payment.js

const mp = new MercadoPago(MP_PUBLIC_KEY);
let paymentBrickController;
let currentShippingCost = 0;
let deliveryMode = 'delivery'; 
let selectedStore = '';

document.addEventListener("DOMContentLoaded", () => {
    // Tenta preencher email assim que o user estiver pronto
    document.addEventListener('userReady', (e) => {
        const user = e.detail;
        if (user && user.email) {
            const emailInput = document.getElementById("reg-email");
            if(emailInput) emailInput.value = user.email;
            loadUserData(user.uid);
        }
    });

    // Se já estiver cacheado
    if (auth && auth.currentUser) {
        const emailInput = document.getElementById("reg-email");
        if(emailInput) emailInput.value = auth.currentUser.email;
        loadUserData(auth.currentUser.uid);
    }

    setupStepNavigation();
    setupDeliveryLogic();
    setupPixEvents();
});

async function loadUserData(uid) {
    try {
        const doc = await db.collection("users").doc(uid).get();
        if (doc.exists) {
            const data = doc.data();
            document.getElementById("reg-first-name").value = data.firstName || '';
            document.getElementById("reg-last-name").value = data.lastName || '';
            document.getElementById("reg-phone").value = data.phone || '';
            if(data.cpf && document.getElementById("reg-cpf")) {
                document.getElementById("reg-cpf").value = data.cpf;
            }
        }
    } catch (e) {
        console.error("Erro ao carregar perfil", e);
    }
}

function setupStepNavigation() {
    document.getElementById("btn-go-shipping").addEventListener("click", async () => {
        const fname = document.getElementById("reg-first-name").value.trim();
        const lname = document.getElementById("reg-last-name").value.trim();
        const phone = document.getElementById("reg-phone").value.trim();
        const emailInput = document.getElementById("reg-email").value;

        if(!emailInput && auth.currentUser) {
            document.getElementById("reg-email").value = auth.currentUser.email;
        }

        if (!fname || !lname || !phone) {
            showToast("Preencha todos os campos obrigatórios.", "error");
            return;
        }

        // Salva dados parciais no perfil do usuário
        if (auth.currentUser) {
            try {
                const cpfVal = document.getElementById("reg-cpf") ? document.getElementById("reg-cpf").value : "";
                await db.collection("users").doc(auth.currentUser.uid).set({
                    firstName: fname,
                    lastName: lname,
                    phone: phone,
                    cpf: cpfVal,
                    email: auth.currentUser.email
                }, { merge: true });
            } catch (e) { console.error("Erro ao salvar user", e); }
        }
        changeStep(2);
    });

    document.getElementById("btn-go-payment").addEventListener("click", async () => {
        if (deliveryMode === 'delivery') {
            const cep = document.getElementById("cep").value;
            const city = document.getElementById("city-select").value;
            const address = document.getElementById("address").value;
            const displayCost = document.getElementById("shipping-cost-display").innerText;
            
            if (!cep || !city || !address) {
                showToast("Preencha o endereço completo.", "error");
                return;
            }
            if (displayCost.includes("Não entregamos")) {
                showToast("Não entregamos nesta região.", "error");
                return;
            }
        } else {
            if (!selectedStore) {
                showToast("Selecione uma loja para retirada.", "error");
                return;
            }
        }

        changeStep(3);
        await initPaymentBrick();
    });
}

function changeStep(stepNum) {
    document.querySelectorAll('.checkout-step').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));

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

function setupDeliveryLogic() {
    window.selectDeliveryType = (type) => {
        deliveryMode = type;
        document.querySelectorAll('.delivery-option-card').forEach(c => c.classList.remove('selected'));
        document.querySelector(`.delivery-option-card[data-type="${type}"]`).classList.add('selected');

        if (type === 'delivery') {
            document.getElementById("container-delivery-form").style.display = 'block';
            document.getElementById("container-pickup-list").style.display = 'none';
            calculateShipping(); 
        } else {
            document.getElementById("container-delivery-form").style.display = 'none';
            document.getElementById("container-pickup-list").style.display = 'block';
            currentShippingCost = 0; 
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

    document.getElementById("city-select").addEventListener("change", calculateShipping);
}

function calculateShipping() {
    if (deliveryMode === 'pickup') return;

    const city = document.getElementById("city-select").value;
    const isBullf = document.getElementById("frete-bullf") ? document.getElementById("frete-bullf").checked : false;
    const cartTotal = CartManager.total();
    const display = document.getElementById("shipping-cost-display");

    if (isBullf) {
        currentShippingCost = 0;
        display.innerText = "Grátis (Frete Bullf)";
        display.style.color = "var(--color-accent-blue)";
        return;
    }

    if (!city) {
        currentShippingCost = 0;
        display.innerText = "Selecione a cidade";
        display.style.color = "#666";
        return;
    }

    if (city === "Ipixuna do Pará") {
        if (cartTotal >= 29.99) {
            currentShippingCost = 0;
            display.innerText = "Grátis (Pedido > R$ 29,99)";
            display.style.color = "green";
        } else {
            currentShippingCost = 7.99;
            display.innerText = "R$ 7,99";
            display.style.color = "#333";
        }
    } else if (city === "Aurora do Pará") {
        currentShippingCost = 50.00;
        display.innerText = "R$ 50,00";
        display.style.color = "#333";
    } else {
        currentShippingCost = 0; 
        display.innerText = "Não entregamos nesta região";
        display.style.color = "red";
    }
}

document.getElementById("btn-go-payment").addEventListener("click", async () => {
    // 1. Verificação de Segurança do Carrinho
    const cart = CartManager.get();
    if (cart.length === 0) {
        showToast("Seu carrinho está vazio!", "error");
        setTimeout(() => window.location.href = "index.html", 1500);
        return;
    }

    if (deliveryMode === 'delivery') {
        const cep = document.getElementById("cep").value;
        const city = document.getElementById("city-select").value;
        const address = document.getElementById("address").value;
        const displayCost = document.getElementById("shipping-cost-display").innerText;
        
        if (!cep || !city || !address) {
            showToast("Preencha o endereço completo.", "error");
            return;
        }
        if (displayCost.includes("Não entregamos")) {
            showToast("Não entregamos nesta região.", "error");
            return;
        }
    } else {
        if (!selectedStore) {
            showToast("Selecione uma loja para retirada.", "error");
            return;
        }
    }

    changeStep(3);
    await initPaymentBrick();
});

// SUBSTIUA A FUNÇÃO initPaymentBrick INTEIRA POR ESTA VERSÃO COM DEBUG:
async function initPaymentBrick() {
    const cart = CartManager.get();
    const productsTotal = CartManager.total();
    
    // Proteção extra contra valor zero
    if (productsTotal <= 0) {
        document.getElementById("brick-loading-message").innerText = "Carrinho vazio. Adicione itens.";
        document.getElementById("brick-loading-message").style.color = "red";
        return;
    }

    const finalTotal = productsTotal + currentShippingCost;

    document.getElementById("payment-subtotal-display").innerText = `R$ ${productsTotal.toFixed(2).replace('.', ',')}`;
    document.getElementById("payment-shipping-display").innerText = currentShippingCost === 0 ? "Grátis" : `R$ ${currentShippingCost.toFixed(2).replace('.', ',')}`;
    document.getElementById("payment-total-display").innerText = `R$ ${finalTotal.toFixed(2).replace('.', ',')}`;

    const firstName = document.getElementById("reg-first-name").value;
    const lastName = document.getElementById("reg-last-name").value;
    const rawPhone = document.getElementById("reg-phone").value;
    const rawCpf = document.getElementById("reg-cpf") ? document.getElementById("reg-cpf").value : "00000000000";
    
    const cep = document.getElementById("cep").value || "00000000";
    const street = document.getElementById("address").value || "Retirada na Loja";
    const number = document.getElementById("num").value || "S/N";
    const city = document.getElementById("city-select").value || "Cidade";

    let email = document.getElementById("reg-email").value;
    if((!email || email === "") && auth.currentUser) email = auth.currentUser.email;
    if(!email) email = "cliente@eletrobusiness.com.br";

    const user = auth.currentUser;
    const uid = user ? user.uid : 'guest';

    try {
        console.log("Iniciando criação de preferência...");
        
        const response = await fetch(API_URLS.CREATE_PREFERENCE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                items: cart, 
                shippingCost: currentShippingCost, 
                deliveryData: {
                    mode: deliveryMode,
                    store: selectedStore,
                    address: deliveryMode === 'delivery' ? street : null,
                    city: deliveryMode === 'delivery' ? city : null,
                },
                clientData: { firstName, lastName, phone: rawPhone, email, cpf: rawCpf }, 
                userId: uid 
            }),
        });
        
        if (!response.ok) {
            const errData = await response.json();
            throw new Error("Erro ao criar preferência: " + (errData.error || "Desconhecido"));
        }
        
        const data = await response.json(); 
        
        // --- DEBUG CRÍTICO: Verifique isso no Console (F12) se der erro ---
        console.log("✅ Preferência Criada. Order ID:", data.orderId);
        
        // Se o OrderID for sempre igual, o problema está no backend gerando IDs repetidos.
        const currentOrderId = data.orderId; 
        
        if (paymentBrickController) paymentBrickController.unmount(); 
        
        const builder = mp.bricks();
        const settings = {
            initialization: {
                amount: finalTotal, 
                preferenceId: data.preferenceId,
                payer: { 
                    email: email,
                    firstName: firstName,
                    lastName: lastName,
                },
            },
            customization: {
                paymentMethods: {
                    creditCard: [],      
                    debitCard: [],       
                    ticket: [],          
                    bankTransfer: ['pix'] 
                },
                visual: { 
                    style: { theme: 'light' },
                    hidePaymentButton: false
                }
            },
            callbacks: {
                onReady: () => {
                    document.getElementById("brick-loading-message").style.display = 'none';
                },
                onSubmit: ({ formData }) => {
                    const cleanCpf = rawCpf.replace(/\D/g, '');
                    const cleanPhone = rawPhone.replace(/\D/g, '');
                    const areaCode = cleanPhone.length >= 2 ? cleanPhone.substring(0, 2) : "11";
                    const phoneNumber = cleanPhone.length > 2 ? cleanPhone.substring(2) : "900000000";

                    const customPayer = {
                        email: email,
                        first_name: firstName,
                        last_name: lastName,
                        identification: { type: "CPF", number: cleanCpf },
                        phone: { area_code: areaCode, number: phoneNumber },
                        address: {
                            zip_code: cep.replace(/\D/g, ''),
                            street_name: street,
                            street_number: number,
                            city: city
                        }
                    };

                    const globalOrderData = {
                        orderId: currentOrderId,
                        userId: uid,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        status: 'pending_payment', 
                        statusText: 'Aguardando Pagamento',
                        paymentMethod: 'pix',
                        total: finalTotal,
                        items: cart,
                        client: {
                            name: `${firstName} ${lastName}`,
                            phone: rawPhone,
                            email: email,
                            cpf: rawCpf
                        },
                        shipping: {
                            mode: deliveryMode,
                            cost: currentShippingCost,
                            address: deliveryMode === 'delivery' ? `${street}, ${number} - ${city}` : `Retirada: ${selectedStore}`
                        }
                    };

                    // Salvamento Global no Firestore
                    // Se o banco não aceitar, vai dar erro no console aqui
                    db.collection("orders").doc(currentOrderId).set(globalOrderData, { merge: true })
                    .then(() => console.log("Dados salvos no Firestore com sucesso."))
                    .catch(err => {
                        console.error("ERRO AO SALVAR NO BANCO:", err);
                        showToast("Erro ao salvar pedido no banco.", "error");
                    });

                    return new Promise((resolve, reject) => {
                        fetch(API_URLS.CREATE_PAYMENT, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                payment_data: formData,
                                orderId: currentOrderId,
                                items: cart, 
                                shippingCost: currentShippingCost,
                                customPayer: customPayer
                            })
                        })
                        .then(async res => {
                            if (!res.ok) {
                                const errData = await res.json();
                                throw new Error(errData.message || JSON.stringify(errData));
                            }
                            return res.json();
                        })
                        .then(paymentResult => {
                            console.log("Status Pagamento:", paymentResult.status);
                            CartManager.clear(); // Limpa o carrinho após sucesso

                            if (paymentResult.status === 'pending' && paymentResult.point_of_interaction) {
                                showPixScreen(paymentResult);
                                resolve();
                            } else {
                                window.location.href = "pedidos.html"; 
                                resolve();
                            }
                        })
                        .catch(error => {
                            console.error("Erro no Processamento:", error);
                            showToast("Falha: " + error.message, "error");
                            reject();
                        });
                    });
                },
                onError: (error) => {
                    console.error(error);
                    showToast("Erro no formulário de pagamento", "error");
                },
            },
        };

        paymentBrickController = await builder.create("payment", "payment-brick-container", settings);

    } catch (e) {
        console.error("Erro fatal:", e);
        showToast("Erro ao iniciar sistema. Tente novamente.", "error");
        document.getElementById("brick-loading-message").innerText = "Erro ao carregar: " + e.message;
    }
}

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

    const stepper = document.getElementById("checkout-stepper");
    if (stepper) stepper.style.display = 'none';
    
    document.getElementById("step-payment").style.display = 'none';
    document.getElementById("step-pix-result").style.display = 'block';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}