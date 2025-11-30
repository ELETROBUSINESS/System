// js/payment.js

const mp = new MercadoPago(MP_PUBLIC_KEY); 
let paymentBrickController;
let currentShippingCost = 0;
let deliveryMode = 'delivery';
let selectedStore = '';

const STORE_OWNER_UID = "3zYT9Y6hXWeJSuvmEYP4FMZa5gI2";
const APP_ID = 'floralchic-loja';

// --- CONTROLE DO OVERLAY EMOCIONAL ---
function showProcessingOverlay() {
    const overlay = document.getElementById('processing-overlay');
    if(overlay) {
        overlay.style.display = 'flex';
        // Simula a mudança de textos para parecer progresso real
        const steps = overlay.querySelectorAll('.processing-step span');
        setTimeout(() => { if(steps[0]) steps[0].innerText = "Estoque reservado!"; }, 1000);
        setTimeout(() => { if(steps[1]) steps[1].innerText = "Finalizando pedido..."; }, 2000);
    }
}

function hideProcessingOverlay() {
    const overlay = document.getElementById('processing-overlay');
    if(overlay) overlay.style.display = 'none';
}

// --- REGRA DE PARCELAS SEM JUROS ---
function getInterestFreeSteps(totalValue) {
    if (totalValue >= 1000) return 12;
    if (totalValue >= 800) return 9;
    if (totalValue >= 625) return 8;
    if (totalValue >= 600) return 7;
    if (totalValue >= 300) return 6;
    if (totalValue >= 250) return 5;
    return 4;
}

// --- VALIDAÇÃO DE PREÇOS (SEPARA PIX E CARTÃO) ---
async function validateCartPrices(localCart) {
    const verifiedCart = [];
    let hasChanges = false;

    for (const item of localCart) {
        try {
            const docRef = db.collection('artifacts').doc(APP_ID)
                .collection('users').doc(STORE_OWNER_UID)
                .collection('products').doc(item.id);

            const docSnap = await docRef.get();

            if (!docSnap.exists) {
                verifiedCart.push(item);
                continue;
            }

            const prod = docSnap.data();
            const valPrice = parseFloat(prod.price || 0); // Preço Cheio (Cartão)
            const valOffer = parseFloat(prod['price-oferta'] || 0); // Preço Pix
            
            const hasOffer = (valOffer > 0 && valOffer < valPrice);
            const officialPriceCard = valPrice > 0 ? valPrice : (item.priceNew || 0);
            const officialPricePix = hasOffer ? valOffer : officialPriceCard;

            if (Math.abs(item.priceNew - officialPriceCard) > 0.05 && Math.abs(item.priceNew - officialPricePix) > 0.05) {
                item.priceNew = officialPriceCard; 
                hasChanges = true;
            }
            
            item.priceBase = officialPriceCard;
            item.pricePix = officialPricePix;
            item.hasOffer = hasOffer;

            verifiedCart.push(item);

        } catch (e) {
            console.error("Erro validando produto:", item.id, e);
            verifiedCart.push(item);
        }
    }

    if (hasChanges) localStorage.setItem('app_cart', JSON.stringify(verifiedCart));
    return verifiedCart;
}

document.addEventListener("DOMContentLoaded", () => {
    document.addEventListener('userReady', (e) => {
        const user = e.detail;
        if (user && user.email) {
            const emailInput = document.getElementById("reg-email");
            if (emailInput) emailInput.value = user.email;
            loadUserData(user.uid);
        }
    });

    if (auth && auth.currentUser) {
        const emailInput = document.getElementById("reg-email");
        if (emailInput) emailInput.value = auth.currentUser.email;
        loadUserData(auth.currentUser.uid);
    }

    setupStepNavigation();
    setupDeliveryLogic();
    setupPixEvents();
    updateStoreAddresses();
});

function updateStoreAddresses() {
    const storeItems = document.querySelectorAll('.store-item');
    storeItems.forEach(item => {
        const text = item.innerText;
        const small = item.querySelector('small');
        if (!small) return;
        if (text.includes("Ipixuna")) small.innerText = "R. Jarbas Passarinho, Centro, Ipixuna do Pará";
        else if (text.includes("Aurora")) small.innerText = "Av. Bernardo Sayão, n° 10, centro, Aurora do Pará";
    });
}

function isValidCPF(cpf) {
    if (typeof cpf !== 'string') return false;
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
    let soma = 0;
    let resto;
    for (let i = 1; i <= 9; i++) soma = soma + parseInt(cpf.substring(i - 1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11)) resto = 0;
    if (resto !== parseInt(cpf.substring(9, 10))) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma = soma + parseInt(cpf.substring(i - 1, i)) * (12 - i);
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
            if (data.cpf && document.getElementById("reg-cpf")) document.getElementById("reg-cpf").value = data.cpf;
        }
    } catch (e) { console.error("Erro perfil", e); }
}

function setupStepNavigation() {
    document.getElementById("btn-go-shipping").addEventListener("click", async () => {
        const fname = document.getElementById("reg-first-name").value.trim();
        const lname = document.getElementById("reg-last-name").value.trim();
        const phone = document.getElementById("reg-phone").value.trim();
        const cpfInput = document.getElementById("reg-cpf");
        const cpfVal = cpfInput ? cpfInput.value.trim() : "";
        const emailInput = document.getElementById("reg-email").value;

        if (!emailInput && auth.currentUser) document.getElementById("reg-email").value = auth.currentUser.email;

        if (!fname || !lname || !phone || !cpfVal) {
            showToast("Preencha todos os campos e CPF.", "error");
            return;
        }
        if (!isValidCPF(cpfVal)) {
            showToast("CPF Inválido.", "error");
            return;
        }

        if (auth.currentUser) {
            db.collection("users").doc(auth.currentUser.uid).set({
                firstName: fname, lastName: lname, phone: phone, cpf: cpfVal, email: auth.currentUser.email
            }, { merge: true }).catch(e => console.error(e));
        }
        changeStep(2);
    });

    document.getElementById("btn-go-payment").addEventListener("click", async () => {
        const cart = CartManager.get();
        if (cart.length === 0) {
            showToast("Carrinho vazio!", "error");
            return;
        }
        if (deliveryMode === 'delivery') {
            if (!document.getElementById("cep").value || !document.getElementById("address").value) {
                showToast("Preencha o endereço.", "error");
                return;
            }
        } else if (!selectedStore) {
            showToast("Selecione uma loja.", "error");
            return;
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
            showToast("Entrega indisponível.", "error");
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
            if (cepRaw.length === 8) validateDeliveryArea(cepRaw);
        });
    }
    document.getElementById("city-select").addEventListener("change", calculateShipping);
}

function validateDeliveryArea(cep) {
    const deliveryCard = document.querySelector(`.delivery-option-card[data-type="delivery"]`);
    const pickupContainer = document.getElementById("container-pickup-list");
    const deliveryForm = document.getElementById("container-delivery-form");

    if (cep !== '68637000') {
        deliveryCard.style.opacity = '0.5';
        deliveryCard.style.filter = 'grayscale(1)';
        deliveryCard.classList.add('blocked-option');
        selectDeliveryType('pickup');
        showToast("Entrega indisponível para este CEP.", "warning");

        if (!document.getElementById("btn-change-cep-retry")) {
            const btn = document.createElement("button");
            btn.id = "btn-change-cep-retry";
            btn.style = "background:none; border:none; color:#db0038; cursor:pointer; margin-bottom:15px; font-weight:600;";
            btn.innerHTML = "<i class='bx bx-left-arrow-alt'></i> Alterar CEP";
            btn.onclick = (e) => {
                e.preventDefault();
                pickupContainer.style.display = "none";
                deliveryForm.style.display = "block";
                deliveryCard.style.opacity = '1';
                deliveryCard.style.filter = 'none';
                deliveryCard.classList.remove('blocked-option');
                selectDeliveryType('delivery');
                document.getElementById("cep").value = "";
                document.getElementById("cep").focus();
            };
            pickupContainer.insertBefore(btn, pickupContainer.firstChild);
        }
    } else {
        deliveryCard.style.opacity = '1';
        deliveryCard.style.filter = 'none';
        deliveryCard.classList.remove('blocked-option');
        const btnRetry = document.getElementById("btn-change-cep-retry");
        if (btnRetry) btnRetry.remove();
        if (deliveryMode === 'delivery') calculateShipping();
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

    if (cepVal === '68637000') {
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
    document.getElementById("payment-shipping-display").innerText = currentShippingCost === 0 ? "Grátis" : `R$ ${currentShippingCost.toFixed(2).replace('.', ',')}`;
    document.getElementById("payment-total-display").innerText = `R$ ${finalTotal.toFixed(2).replace('.', ',')}`;
}

// --- FUNÇÃO PRINCIPAL DO BRICK ---
async function initPaymentBrick() {
    const loadingEl = document.getElementById("brick-loading-message");
    if (loadingEl) {
        loadingEl.style.display = 'block';
        loadingEl.innerText = "Preparando valores...";
    }

    let cart;
    try {
        cart = await validateCartPrices(CartManager.get());
    } catch (e) {
        console.error("Erro crítico validação:", e);
        return;
    }

    const productsTotalCard = cart.reduce((sum, item) => sum + ((item.priceBase || item.priceNew) * item.quantity), 0);
    const productsTotalPix = cart.reduce((sum, item) => sum + ((item.pricePix || item.priceNew) * item.quantity), 0);
    
    const finalTotalCard = productsTotalCard + currentShippingCost;
    const finalTotalPix = productsTotalPix + currentShippingCost;
    
    const savings = finalTotalCard - finalTotalPix;
    const interestFreeMax = getInterestFreeSteps(finalTotalCard);

    // --- RENDERIZA A LISTA ---
    const listContainer = document.getElementById("payment-product-list");
    if (listContainer) {
        listContainer.innerHTML = '';
        cart.forEach(item => {
            const itemPrice = parseFloat(item.priceBase || item.priceNew);
            const imgUrl = item.image || 'https://placehold.co/100x100/eee/999?text=Sem+Foto';
            
            const parcelas = interestFreeMax;
            const valorParcela = itemPrice / parcelas;
            const valorFormatado = valorParcela.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            let badgeHtml = '';
            if (interestFreeMax > 1) {
                badgeHtml = `
                <div class="installment-warning" style="background-color: #e8f5e9; color: #1b5e20; border-color: #c8e6c9;">
                    <i class='bx bx-credit-card'></i> 
                    Até ${parcelas}x de ${valorFormatado} sem juros
                </div>`;
            } else {
                 badgeHtml = `<div class="installment-warning">Preço à vista</div>`;
            }

            const html = `
                <div class="product-summary-item">
                    <img src="${imgUrl}" class="product-summary-img">
                    <div class="product-summary-info">
                        <div class="product-summary-name">${item.name}</div>
                        <div class="product-summary-price">
                            ${item.quantity}x R$ ${itemPrice.toFixed(2).replace('.', ',')}
                        </div>
                        ${badgeHtml}
                    </div>
                </div>
            `;
            listContainer.insertAdjacentHTML('beforeend', html);
        });

        if (savings > 0) {
            const savingsFormatted = savings.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
            const pixTotalFormatted = finalTotalPix.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
            
            const economyHtml = `
            <div style="
                background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
                color: #064e3b;
                border: 1px solid #34d399;
                border-radius: 8px;
                padding: 12px;
                margin-top: 15px;
                display: flex;
                align-items: center;
                gap: 12px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.05);
            ">
                <i class='bx bxs-offer' style="font-size: 2rem; color: #059669;"></i>
                <div>
                    <div style="font-weight: 800; font-size: 0.95rem; text-transform: uppercase;">Economize ${savingsFormatted} no Pix!</div>
                    <div style="font-size: 0.85rem;">Total final selecionando Pix: <strong>${pixTotalFormatted}</strong></div>
                </div>
            </div>
            `;
            listContainer.insertAdjacentHTML('beforeend', economyHtml);
        }
    }

    if (productsTotalCard <= 0) return;

    document.getElementById("payment-subtotal-display").innerText = `R$ ${productsTotalCard.toFixed(2).replace('.', ',')}`;
    document.getElementById("payment-total-display").innerText = `R$ ${finalTotalCard.toFixed(2).replace('.', ',')}`;

    const firstName = document.getElementById("reg-first-name").value;
    const lastName = document.getElementById("reg-last-name").value;
    const rawPhone = document.getElementById("reg-phone").value;
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const rawCpf = document.getElementById("reg-cpf") ? document.getElementById("reg-cpf").value : "";
    const cleanCpf = rawCpf.replace(/\D/g, '');
    let email = document.getElementById("reg-email").value;
    if ((!email || email.trim() === "") && auth.currentUser) email = auth.currentUser.email;
    if (!email) email = "cliente@eletrobusiness.com.br";
    const user = auth.currentUser;
    const uid = user ? user.uid : 'guest';

    const cep = document.getElementById("cep").value.replace(/\D/g, '') || "00000000";
    const street = document.getElementById("address").value || "Retirada";
    const number = document.getElementById("num").value || "0";
    const city = document.getElementById("city-select").value || "Cidade";

    try {
        const response = await fetch(API_URLS.CREATE_PREFERENCE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                items: cart, 
                shippingCost: currentShippingCost,
                interestFreeSteps: interestFreeMax,
                deliveryData: {
                    mode: deliveryMode,
                    store: selectedStore,
                    address: deliveryMode === 'delivery' ? street : null,
                },
                clientData: { firstName, lastName, phone: rawPhone, email, cpf: rawCpf },
                userId: uid
            }),
        });

        const data = await response.json();
        if (!data.preferenceId) throw new Error("ID pref inválido");

        if (paymentBrickController) paymentBrickController.unmount();

        const builder = mp.bricks();
        const settings = {
            initialization: {
                amount: finalTotalCard,
                preferenceId: data.preferenceId,
                payer: {
                    email: email,
                    firstName: firstName, lastName: lastName,
                    identification: { type: 'CPF', number: cleanCpf },
                    address: { zip_code: cep, street_name: street, street_number: number, city: city }
                },
            },
            customization: {
                paymentMethods: {
                    creditCard: 'all', debitCard: 'all', ticket: [], bankTransfer: ['pix'],
                    maxInstallments: 12
                },
                visual: { style: { theme: 'light' }, hidePaymentButton: false }
            },
            callbacks: {
                onReady: () => { if (loadingEl) loadingEl.style.display = 'none'; },
                
                // === AQUI ESTÁ A MUDANÇA PRINCIPAL ===
                onSubmit: ({ formData }) => {
                     // 1. MOSTRA O OVERLAY DE EMOÇÃO/DESEJO IMEDIATAMENTE
                     showProcessingOverlay();

                     // 2. Continua o fluxo normal
                     let amountToCharge = finalTotalCard;
                     if (formData.payment_method_id === 'pix') {
                         amountToCharge = finalTotalPix;
                         formData.transaction_amount = amountToCharge;
                     }

                     return processPaymentSubmit(formData, data.orderId, cart, amountToCharge, uid, firstName, lastName, email, cleanCpf, cleanPhone, street, number, city, rawPhone, rawCpf);
                },
                onError: (error) => { 
                    console.error(error); 
                    hideProcessingOverlay(); // Esconde se der erro
                    showToast("Erro pagamento", "error"); 
                },
            },
        };
        paymentBrickController = await builder.create("payment", "payment-brick-container", settings);

    } catch (e) {
        console.error("Erro fatal:", e);
        if (loadingEl) loadingEl.innerText = "Erro ao carregar.";
    }
}

function processPaymentSubmit(formData, orderId, cart, finalTotal, uid, fName, lName, email, cpf, phone, street, num, city, rawPhone, rawCpf) {
     const areaCode = phone.length >= 2 ? phone.substring(0, 2) : "11";
     const phoneNumber = phone.length > 2 ? phone.substring(2) : "900000000";

     const customPayer = {
        email: email, first_name: fName, last_name: lName,
        identification: { type: "CPF", number: cpf },
        phone: { area_code: areaCode, number: phoneNumber },
        address: { zip_code: "00000000", street_name: street, street_number: num, city: city }
    };

    db.collection("orders").doc(orderId).set({
        status: 'pending_payment',
        paymentMethod: formData.payment_method_id,
        total: finalTotal, 
        client: { name: `${fName} ${lName}`, phone: rawPhone, email: email, cpf: rawCpf },
        shipping: { mode: deliveryMode, cost: currentShippingCost }
    }, { merge: true });

    return new Promise((resolve, reject) => {
        fetch(API_URLS.CREATE_PAYMENT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                payment_data: formData,
                orderId: orderId,
                items: cart,
                shippingCost: currentShippingCost,
                customPayer: customPayer
            })
        })
        .then(res => res.json())
        .then(paymentResult => {
            CartManager.clear();
            
            // Sucesso: Mantemos o overlay até redirecionar ou trocar a tela
            if (paymentResult.status === 'pending' && paymentResult.point_of_interaction) {
                // Para Pix, escondemos o overlay e mostramos a tela de QR Code
                hideProcessingOverlay();
                showPixScreen(paymentResult);
            } else {
                // Para cartão aprovado, redirecionamos
                showToast("Pedido realizado!", "success");
                setTimeout(() => window.location.href = "pedidos.html", 2000);
            }
            resolve();
        })
        .catch(error => {
            console.error(error);
            hideProcessingOverlay(); // Se falhar, esconde para o usuário tentar de novo
            showToast("Falha ao processar", "error");
            reject();
        });
    });
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
    if (btnFinish) btnFinish.addEventListener("click", () => window.location.href = "pedidos.html");
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