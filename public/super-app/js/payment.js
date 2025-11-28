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
    updateStoreAddresses(); // Atualiza os endereços visuais ao carregar
});

// --- ATUALIZAÇÃO VISUAL DOS ENDEREÇOS (Novo) ---
function updateStoreAddresses() {
    const storeItems = document.querySelectorAll('.store-item');
    storeItems.forEach(item => {
        const text = item.innerText;
        const small = item.querySelector('small');
        if (!small) return;

        if (text.includes("Ipixuna")) {
            small.innerText = "R. Jarbas Passarinho, Centro, Ipixuna do Pará";
        } else if (text.includes("Aurora")) {
            small.innerText = "Av. Bernardo Sayão, n° 10, centro, Aurora do Pará";
        }
    });
}

// --- VALIDAÇÃO DE CPF ---
function isValidCPF(cpf) {
    if (typeof cpf !== 'string') return false;
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
    let soma = 0;
    let resto;
    for (let i = 1; i <= 9; i++) soma = soma + parseInt(cpf.substring(i-1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11)) resto = 0;
    if (resto !== parseInt(cpf.substring(9, 10))) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma = soma + parseInt(cpf.substring(i-1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11)) resto = 0;
    if (resto !== parseInt(cpf.substring(10, 11))) return false;
    return true;
}

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
        const cpfInput = document.getElementById("reg-cpf");
        const cpfVal = cpfInput ? cpfInput.value.trim() : "";
        const emailInput = document.getElementById("reg-email").value;

        if(!emailInput && auth.currentUser) {
            document.getElementById("reg-email").value = auth.currentUser.email;
        }

        if (!fname || !lname || !phone || !cpfVal) {
            showToast("Preencha todos os campos obrigatórios, incluindo CPF.", "error");
            return;
        }

        if (!isValidCPF(cpfVal)) {
            showToast("CPF Inválido. Verifique os números digitados.", "error");
            if(cpfInput) {
                cpfInput.style.borderColor = "red";
                cpfInput.focus();
                setTimeout(() => cpfInput.style.borderColor = "#e0e0e0", 3000);
            }
            return;
        }

        if (auth.currentUser) {
            try {
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
        const deliveryCard = document.querySelector(`.delivery-option-card[data-type="delivery"]`);
        if (type === 'delivery' && deliveryCard.classList.contains('blocked-option')) {
            showToast("Entrega indisponível para este CEP.", "error");
            return;
        }

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
            updateTotalDisplay();
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

    const cepInput = document.getElementById("cep");
    if (cepInput) {
        cepInput.addEventListener("blur", () => {
            const cepRaw = cepInput.value.replace(/\D/g, '');
            if (cepRaw.length === 8) {
                validateDeliveryArea(cepRaw);
            }
        });
        
        cepInput.addEventListener("input", (e) => {
            let val = e.target.value.replace(/\D/g, '');
            if (val.length > 5) val = val.substring(0, 5) + '-' + val.substring(5, 8);
            e.target.value = val;
        });
    }

    document.getElementById("city-select").addEventListener("change", calculateShipping);
}

// --- FUNÇÃO DE VALIDAÇÃO DE ÁREA COM BOTÃO DE VOLTAR (NOVO) ---
function validateDeliveryArea(cep) {
    const deliveryCard = document.querySelector(`.delivery-option-card[data-type="delivery"]`);
    const pickupContainer = document.getElementById("container-pickup-list");
    const deliveryForm = document.getElementById("container-delivery-form");

    if (cep !== '68637000') {
        // Bloqueia Entrega
        deliveryCard.style.opacity = '0.5';
        deliveryCard.style.filter = 'grayscale(1)';
        deliveryCard.style.cursor = 'not-allowed';
        deliveryCard.classList.add('blocked-option');
        
        selectDeliveryType('pickup');
        showToast("Entrega indisponível para este CEP. Apenas retirada.", "warning");

        // Injeta Botão "Alterar CEP" se não existir
        if (!document.getElementById("btn-change-cep-retry")) {
            const btn = document.createElement("button");
            btn.id = "btn-change-cep-retry";
            btn.style = "background:none; border:none; color:#db0038; text-decoration:underline; cursor:pointer; margin-bottom:15px; font-size:0.9rem; display:flex; align-items:center; gap:5px; font-weight:600;";
            btn.innerHTML = "<i class='bx bx-left-arrow-alt'></i> Alterar CEP / Endereço";
            
            btn.onclick = (e) => {
                e.preventDefault();
                // Reseta visual
                pickupContainer.style.display = "none";
                deliveryForm.style.display = "block";
                
                deliveryCard.style.opacity = '1';
                deliveryCard.style.filter = 'none';
                deliveryCard.style.cursor = 'pointer';
                deliveryCard.classList.remove('blocked-option');
                
                // Volta para modo delivery e foca no CEP
                selectDeliveryType('delivery');
                const cInput = document.getElementById("cep");
                cInput.value = ""; // Limpa para obrigar nova digitação
                cInput.focus();
            };
            pickupContainer.insertBefore(btn, pickupContainer.firstChild);
        }

    } else {
        // Libera Entrega
        deliveryCard.style.opacity = '1';
        deliveryCard.style.filter = 'none';
        deliveryCard.style.cursor = 'pointer';
        deliveryCard.classList.remove('blocked-option');
        
        // Remove botão se existir (pois agora está liberado)
        const btnRetry = document.getElementById("btn-change-cep-retry");
        if(btnRetry) btnRetry.remove();

        if (deliveryMode === 'delivery') {
            calculateShipping();
        }
    }
}

function calculateShipping() {
    if (deliveryMode === 'pickup') {
        currentShippingCost = 0;
        updateTotalDisplay();
        return;
    }

    const cepInput = document.getElementById("cep");
    const cepVal = cepInput.value.replace(/\D/g, '');
    const display = document.getElementById("shipping-cost-display");
    const cartTotal = CartManager.total();
    const isBullf = document.getElementById("frete-bullf") ? document.getElementById("frete-bullf").checked : false;

    if (isBullf) {
        currentShippingCost = 0;
        display.innerText = "Grátis (Frete Bullf)";
        display.style.color = "var(--color-secondary)";
    } else if (cepVal === '68637000') {
        if (cartTotal >= 29.99) {
            currentShippingCost = 0;
            display.innerText = "Grátis (Pedido > R$ 29,99)";
            display.style.color = "#00a650"; 
        } else {
            currentShippingCost = 7.99;
            display.innerText = "R$ 7,99";
            display.style.color = "#333";
        }
    } else {
        currentShippingCost = 0;
        display.innerText = "Calculando...";
    }
    
    updateTotalDisplay();
}

function updateTotalDisplay() {
    const productsTotal = CartManager.total();
    const finalTotal = productsTotal + currentShippingCost;
    
    const shippingDisplay = document.getElementById("payment-shipping-display");
    const totalDisplay = document.getElementById("payment-total-display");
    
    if(shippingDisplay) shippingDisplay.innerText = currentShippingCost === 0 ? "Grátis" : `R$ ${currentShippingCost.toFixed(2).replace('.', ',')}`;
    if(totalDisplay) totalDisplay.innerText = `R$ ${finalTotal.toFixed(2).replace('.', ',')}`;
}

async function initPaymentBrick() {
    const cart = CartManager.get();
    const productsTotal = CartManager.total();
    
    if (productsTotal <= 0) {
        document.getElementById("brick-loading-message").innerText = "Carrinho vazio ou valor inválido.";
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
    if((!email || email.trim() === "") && auth.currentUser) email = auth.currentUser.email;
    if(!email || email.trim() === "") email = "cliente@eletrobusiness.com.br"; 

    const user = auth.currentUser;
    const uid = user ? user.uid : 'guest';

    try {
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

                    db.collection("orders").doc(currentOrderId).set(globalOrderData, { merge: true })
                    .then(() => console.log("Dados salvos."))
                    .catch(err => console.error("Erro ao salvar:", err));

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