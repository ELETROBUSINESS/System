// js/payment.js

const mp = new MercadoPago(MP_PUBLIC_KEY);
let paymentBrickController;
let currentShippingCost = 0;
let deliveryMode = 'delivery';
let selectedStore = '';

const STORE_OWNER_UID = "3zYT9Y6hXWeJSuvmEYP4FMZa5gI2";
const APP_ID = 'floralchic-loja';

// --- CONTROLE DO LOADER PADRÃO ---
function showProcessingOverlay() {
    const overlay = document.getElementById('custom-loader-overlay');
    if (overlay) overlay.style.display = 'flex';
}

function hideProcessingOverlay() {
    const overlay = document.getElementById('custom-loader-overlay');
    if (overlay) overlay.style.display = 'none';
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
    let serverProducts = [];

    try {
        const APPSCRIPT_URL = "https://script.google.com/macros/s/AKfycbzB7dluoiNyJ4XK6oDK_iyuKZfwPTAJa4ua4RetQsUX9cMObgE-k_tFGI82HxW_OyMf/exec";
        const response = await fetch(`${APPSCRIPT_URL}?action=listarProdutosSuperApp`);
        const result = await response.json();
        if (result.status === "success" && result.data) {
            serverProducts = result.data;
        }
    } catch (e) {
        console.error("Erro ao buscar API para validação", e);
    }

    for (const item of localCart) {
        try {
            const prod = serverProducts.find(p => String(p.id) === String(item.id));

            if (!prod) {
                verifiedCart.push(item);
                continue;
            }

            const valPrice = parseFloat(prod.price || 0); // Preço Cheio (Cartão)
            const valOffer = parseFloat(prod['price-oferta'] || 0); // Preço Pix

            const hasOffer = (valOffer > 0 && valOffer < valPrice);
            const officialPriceCard = valPrice > 0 ? valPrice : (item.priceNew || 0);
            const officialPricePix = hasOffer ? valOffer : officialPriceCard;

            if (Math.abs(item.priceNew - officialPricePix) > 0.05) {
                item.priceNew = officialPricePix;
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
    setupMasks();
});

function setupMasks() {
    const phoneInput = document.getElementById('reg-phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function (e) {
            let x = e.target.value.replace(/\D/g, '').match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
            e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
        });
    }

    const cpfInput = document.getElementById('reg-cpf');
    if (cpfInput) {
        cpfInput.addEventListener('input', function (e) {
            let x = e.target.value.replace(/\D/g, '').match(/(\d{0,3})(\d{0,3})(\d{0,3})(\d{0,2})/);
            e.target.value = !x[2] ? x[1] : x[1] + '.' + x[2] + (x[3] ? '.' + x[3] : '') + (x[4] ? '-' + x[4] : '');
        });
    }
}

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
            let fullName = '';
            if (data.firstName && data.lastName) fullName = `${data.firstName} ${data.lastName}`;
            else if (data.firstName) fullName = data.firstName;
            document.getElementById("reg-full-name").value = fullName;
            document.getElementById("reg-phone").value = data.phone || '';
            if (data.cpf && document.getElementById("reg-cpf")) document.getElementById("reg-cpf").value = data.cpf;
        }
    } catch (e) { console.error("Erro perfil", e); }
}

function setupStepNavigation() {
    document.getElementById("btn-go-shipping").addEventListener("click", async () => {
        const fullName = document.getElementById("reg-full-name").value.trim();
        const phone = document.getElementById("reg-phone").value.trim();
        const cpfInput = document.getElementById("reg-cpf");
        const cpfVal = cpfInput ? cpfInput.value.trim() : "";
        const emailField = document.getElementById("reg-email");
        const emailInput = emailField ? emailField.value : "";

        if (!fullName || !phone) {
            showToast("Preencha seu Nome e Celular.", "error");
            return;
        }

        const cpfRaw = cpfVal.replace(/\D/g, '');
        if (cpfRaw.length > 0 && !isValidCPF(cpfVal)) {
            showToast("CPF Inválido.", "error");
            return;
        }

        if (auth.currentUser) {
            const parts = fullName.split(' ');
            const fname = parts[0];
            const lname = parts.slice(1).join(' ');

            db.collection("users").doc(auth.currentUser.uid).set({
                firstName: fname, lastName: lname, phone: phone, cpf: cpfVal, email: auth.currentUser ? auth.currentUser.email : emailInput
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
        setupCheckoutOptions();
    });
}

function setupCheckoutOptions() {
    // Rendereiza resumo rápido e opções.
    const cart = CartManager.get();

    let totalPix = 0;
    let totalReal = 0;

    cart.forEach(item => {
        const qty = item.quantity || 1;
        const pPix = parseFloat(item.pricePix || item.priceNew || 0);
        let pReal = parseFloat(item.priceBase || item.priceOriginal || 0);
        if (pReal === 0 || pReal < pPix) pReal = pPix;

        totalPix += pPix * qty;
        totalReal += pReal * qty;
    });

    const finalTotalPix = totalPix + currentShippingCost;
    const finalTotalReal = totalReal + currentShippingCost;
    const savings = totalReal - totalPix;

    // Atualiza Subtotal (Valor Cheio)
    const subtotalEl = document.getElementById("payment-subtotal-display");
    if (subtotalEl) {
        subtotalEl.innerText = `R$ ${totalReal.toFixed(2).replace('.', ',')}`;
    }

    // Atualiza Total Final com ênfase no Pix
    const totalEl = document.getElementById("payment-total-display");
    if (totalEl) {
        if (savings > 0.05) {
            totalEl.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: flex-end;">
                    <span style="font-size: 0.9rem; color: #999; text-decoration: line-through; font-weight: normal;">R$ ${finalTotalReal.toFixed(2).replace('.', ',')}</span>
                    <span style="color: #00a650;">R$ ${finalTotalPix.toFixed(2).replace('.', ',')}</span>
                    <small style="font-size: 0.75rem; color: #666; font-weight: 500; margin-top: -2px;">no Pix (Economize R$ ${savings.toFixed(2).replace('.', ',')})</small>
                </div>
            `;
        } else {
            totalEl.innerText = `R$ ${finalTotalReal.toFixed(2).replace('.', ',')}`;
        }
    }

    // Renderiza a lista de produtos no resumo
    const listContainer = document.getElementById("payment-product-list");
    if (listContainer) {
        listContainer.innerHTML = '';
        cart.forEach(item => {
            const pPix = parseFloat(item.pricePix || item.priceNew || 0);
            let pReal = parseFloat(item.priceBase || item.priceOriginal || 0);
            if (pReal === 0 || pReal < pPix) pReal = pPix;

            const hasDiscount = (pReal - pPix) > 0.05;

            const imgUrl = item.image || 'https://placehold.co/100x100/eee/999?text=Sem+Foto';
            const html = `
                <div class="product-summary-item">
                    <img src="${imgUrl}" class="product-summary-img">
                    <div class="product-summary-info">
                        <div class="product-summary-name">${item.name}</div>
                        <div class="product-summary-price">
                            ${item.quantity}x ${hasDiscount ? `<span style="text-decoration:line-through; font-size:0.7rem; color:#999;">R$ ${pReal.toFixed(2).replace('.', ',')}</span> ` : ''}
                            <span style="${hasDiscount ? 'color:#00a650; font-weight:700;' : ''}">R$ ${pPix.toFixed(2).replace('.', ',')}</span>
                        </div>
                    </div>
                </div>
            `;
            listContainer.insertAdjacentHTML('beforeend', html);
        });
    }

    const btnPix = document.getElementById("btn-choice-pix");
    const btnCard = document.getElementById("btn-choice-card");
    const btnZap = document.getElementById("btn-pay-whatsapp");

    // Limpa event listeners antigos clonando nodes se necessário
    const newBtnPix = btnPix.cloneNode(true);
    btnPix.parentNode.replaceChild(newBtnPix, btnPix);

    const newBtnCard = btnCard.cloneNode(true);
    btnCard.parentNode.replaceChild(newBtnCard, btnCard);

    const newBtnZap = btnZap.cloneNode(true);
    btnZap.parentNode.replaceChild(newBtnZap, btnZap);

    // LÓGICA PIX
    newBtnPix.addEventListener("click", async () => {
        showProcessingOverlay();
        try {
            const checkoutData = await startCustomCheckout('pix');
            if (checkoutData && checkoutData.point_of_interaction) {
                hideProcessingOverlay();
                showPixScreen(checkoutData);
            }
        } catch (e) {
            hideProcessingOverlay();
            showToast("Erro ao gerar Pix", "error");
        }
    });

    // LÓGICA CARTÃO (INTEGRAÇÃO INFINITEPAY)
    newBtnCard.addEventListener("click", async () => {
        showProcessingOverlay();
        try {
            const checkoutData = await startInfinitePayCheckout();
            if (checkoutData && checkoutData.url) {
                // Redireciona para o checkout seguro da InfinitePay
                window.location.href = checkoutData.url;
            } else {
                throw new Error("Link incompleto");
            }
        } catch (e) {
            hideProcessingOverlay();
            showToast("Erro ao processar cartão. Tente novamente ou use Pix.", "error");
            console.error(e);
        }
    });

    newBtnZap.addEventListener("click", () => {
        const fullName = document.getElementById("reg-full-name") ? document.getElementById("reg-full-name").value : "";
        const phone = document.getElementById("reg-phone").value;
        const orderIdentifier = Math.floor(100000 + Math.random() * 900000);

        let msg = `Olá, gostaria de finalizar meu pedido!\n\n_Ref. Pedido:_ *#${orderIdentifier}*\n\n*Produtos:*\n`;
        cart.forEach(item => {
            msg += `- ${item.quantity}x ${item.name} (R$ ${parseFloat(item.priceNew).toFixed(2).replace('.', ',')})\n`;
        });
        msg += `\n*Frete:* ${currentShippingCost === 0 ? 'Grátis' : 'R$ ' + currentShippingCost.toFixed(2).replace('.', ',')}`;
        msg += `\n*Total estimado:* R$ ${finalTotal.toFixed(2).replace('.', ',')}`;
        msg += `\n\n*Meus Dados:*`;
        msg += `\nNome: ${fullName}`;
        msg += `\nTelefone: ${document.getElementById("reg-phone").value}`;

        if (deliveryMode === 'delivery') {
            msg += `\n*Endereço de Entrega:* ${document.getElementById("address").value}, ${document.getElementById("num").value} - ${document.getElementById("city-select").value}`;
        } else {
            msg += `\n*Retirada:* Loja ${selectedStore}`;
        }

        // Save order logic
        const cartShort = cart.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.priceNew, image: i.image }));
        const user = auth.currentUser;
        const uid = user ? user.uid : (localStorage.getItem('guest_uid') || ('guest_' + Date.now()));

        db.collection("orders").add({
            userId: uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: "pending_payment",
            statusText: "Aguardando Atendente",
            total: finalTotal,
            shipping: { cost: currentShippingCost, mode: deliveryMode },
            client: { name: fullName, phone: phone },
            items: cartShort,
            paymentMethod: "whatsapp"
        });

        window.open(`https://wa.me/5591986341760?text=${encodeURIComponent(msg)}`, '_blank');

        CartManager.clear();
        setTimeout(() => window.location.href = "index.html", 1500);
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
    const cepRaw = cep.replace(/\D/g, '');
    const auroraRec = document.getElementById("aurora-recommendation");
    const sellerCont = document.getElementById("seller-checkout-container");
    const goPaymentBtn = document.getElementById("btn-go-payment");
    const summaryBox = document.getElementById("shipping-summary-box");
    const citySelect = document.getElementById("city-select");

    // Reseta estados
    if (auroraRec) auroraRec.style.display = 'none';
    if (sellerCont) sellerCont.style.display = 'none';
    if (goPaymentBtn) goPaymentBtn.style.display = 'block';
    if (summaryBox) summaryBox.style.display = 'block';

    const isIpixuna = (cepRaw === '68637000');
    const isParagominas = (cepRaw.startsWith('68625') || cepRaw.startsWith('68626') || cepRaw.startsWith('68627') || cepRaw.startsWith('68628') || cepRaw.startsWith('68629') || cepRaw.startsWith('68630'));
    const isAurora = (cepRaw === '68658000');

    if (isAurora) {
        if (auroraRec) auroraRec.style.display = 'flex';
        citySelect.value = "Aurora do Pará";
    }

    if (isIpixuna || isParagominas || isAurora) {
        // Áreas atendidas (Aurora entra aqui mas com recomendação acima)
        if (isIpixuna) citySelect.value = "Ipixuna do Pará";
        if (isParagominas) citySelect.value = "Paragominas";

        if (deliveryMode === 'delivery') calculateShipping();
    } else {
        // Áreas NÃO atendidas para entrega automática
        if (sellerCont) sellerCont.style.display = 'block';
        if (goPaymentBtn) goPaymentBtn.style.display = 'none';
        if (summaryBox) summaryBox.style.display = 'none';
        showToast("Entrega automática indisponível. Fale com um vendedor.", "warning");
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

    const isIpixuna = (cepVal === '68637000');
    const isAurora = (cepVal === '68658000');
    const isParagominas = (cepVal.startsWith('68625') || cepVal.startsWith('68626') || cepVal.startsWith('68627') || cepVal.startsWith('68628') || cepVal.startsWith('68629') || cepVal.startsWith('68630'));

    if (isIpixuna) {
        currentShippingCost = 0;
        display.innerText = "Grátis (Oferta Limitada)";
        display.style.color = "#00a650";
        display.style.fontWeight = "bold";
    } else if (isAurora) {
        currentShippingCost = 50;
        display.innerText = "R$ 50,00";
        display.style.color = "#333";
        display.style.fontWeight = "bold";
    } else if (isParagominas) {
        currentShippingCost = 60; // Definindo um padrão para Paragominas
        display.innerText = "R$ 60,00";
        display.style.color = "#333";
        display.style.fontWeight = "bold";
    } else {
        currentShippingCost = 0;
        display.innerText = "Consultar Vendedor";
    }
    updateTotalDisplay();
}

function updateTotalDisplay() {
    const cart = CartManager.get();
    let totalPix = 0;
    let totalReal = 0;

    cart.forEach(item => {
        const qty = item.quantity || 1;
        const pPix = parseFloat(item.pricePix || item.priceNew || 0);
        let pReal = parseFloat(item.priceBase || item.priceOriginal || 0);
        if (pReal === 0 || pReal < pPix) pReal = pPix;

        totalPix += pPix * qty;
        totalReal += pReal * qty;
    });

    const finalTotalPix = totalPix + currentShippingCost;
    const finalTotalReal = totalReal + currentShippingCost;
    const savings = totalReal - totalPix;

    const shippingEl = document.getElementById("payment-shipping-display");
    if (shippingEl) {
        shippingEl.innerText = currentShippingCost === 0 ? "Grátis" : `R$ ${currentShippingCost.toFixed(2).replace('.', ',')}`;
    }

    const totalEl = document.getElementById("payment-total-display");
    if (totalEl) {
        if (savings > 0.05) {
            totalEl.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: flex-end;">
                    <span style="font-size: 0.9rem; color: #999; text-decoration: line-through; font-weight: normal;">R$ ${finalTotalReal.toFixed(2).replace('.', ',')}</span>
                    <span style="color: #00a650;">R$ ${finalTotalPix.toFixed(2).replace('.', ',')}</span>
                    <small style="font-size: 0.75rem; color: #666; font-weight: 500; margin-top: -2px;">no Pix (Economize R$ ${savings.toFixed(2).replace('.', ',')})</small>
                </div>
            `;
        } else {
            totalEl.innerText = `R$ ${finalTotalReal.toFixed(2).replace('.', ',')}`;
        }
    }
}

async function startCustomCheckout(method) {
    const cart = await validateCartPrices(CartManager.get());
    const productsTotalPix = cart.reduce((sum, item) => sum + ((item.pricePix || item.priceNew) * item.quantity), 0);
    const finalTotalPix = productsTotalPix + currentShippingCost;

    const fullName = document.getElementById("reg-full-name").value;
    const parts = fullName.split(' ');
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');

    const rawPhone = document.getElementById("reg-phone").value;
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const rawCpf = document.getElementById("reg-cpf") ? document.getElementById("reg-cpf").value : "";
    const cleanCpf = rawCpf.replace(/\D/g, '');
    const emailField = document.getElementById("reg-email");
    let email = emailField ? emailField.value : "";
    if ((!email || email.trim() === "") && auth.currentUser) email = auth.currentUser.email;
    if (!email || email.trim() === "") email = "cliente@eletrobusiness.com.br";

    const uid = auth.currentUser ? auth.currentUser.uid : (localStorage.getItem('guest_uid') || 'guest_' + Date.now());

    const street = document.getElementById("address").value || "Retirada";
    const city = document.getElementById("city-select").value || "Cidade";

    // 1. Cria Preferência
    const prefResponse = await fetch(API_URLS.CREATE_PREFERENCE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            account: 'eletropay', // REQUISITO: Conta 45692327000100
            items: cart,
            shippingCost: currentShippingCost,
            deliveryData: { mode: deliveryMode, store: selectedStore, address: street },
            clientData: { firstName, lastName, phone: rawPhone, email, cpf: rawCpf },
            userId: uid
        }),
    });

    const prefData = await prefResponse.json();
    if (!prefData.orderId) throw new Error("Erro ao gerar Pedido");

    // 2. Cria Pagamento Pix
    const payResponse = await fetch(API_URLS.CREATE_PAYMENT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            account: 'eletropay', // REQUISITO: Conta 45692327000100
            payment_data: {
                transaction_amount: finalTotalPix,
                payment_method_id: 'pix',
                description: `Pedido Super App #${prefData.orderId.substring(0, 6)}`
            },
            orderId: prefData.orderId,
            items: cart,
            shippingCost: currentShippingCost,
            customPayer: {
                email, first_name: firstName, last_name: lastName,
                identification: { type: "CPF", number: cleanCpf || "00000000000" },
                phone: { area_code: cleanPhone.substring(0, 2), number: cleanPhone.substring(2) },
                address: { zip_code: "00000000", street_name: street, city: city }
            }
        })
    });

    return await payResponse.json();
}

async function startInfinitePayCheckout() {
    const cart = await validateCartPrices(CartManager.get());

    const fullName = document.getElementById("reg-full-name").value;
    const parts = fullName.split(' ');
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');

    const rawPhone = document.getElementById("reg-phone").value;
    const emailField = document.getElementById("reg-email");
    let email = emailField ? emailField.value : "";
    if ((!email || email.trim() === "") && auth.currentUser) email = auth.currentUser.email;

    const uid = auth.currentUser ? auth.currentUser.uid : (localStorage.getItem('guest_uid') || 'guest_' + Date.now());

    const street = document.getElementById("address").value || "Retirada";

    const response = await fetch(API_URLS.CREATE_INFINITEPAY_LINK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            account: 'eletropay', // REQUISITO: Conta 45692327000100
            items: cart,
            shippingCost: currentShippingCost,
            deliveryData: { mode: deliveryMode, store: selectedStore, address: street },
            clientData: { firstName, lastName, phone: rawPhone, email },
            userId: uid
        }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data;
}

// --- FUNÇÃO ANTIGA DO BRICK (Pode ser removida ou deixada legada) ---
async function initPaymentBrick() {
    // ... mantido ou removido se não for mais usar ...
}

function processPaymentSubmit(formData, orderId, cart, finalTotal, uid, fName, lName, email, cpf, phone, street, num, city, rawPhone, rawCpf) {
    const areaCode = phone.length >= 2 ? phone.substring(0, 2) : "11";
    const phoneNumber = phone.length > 2 ? phone.substring(2) : "900000000";

    const customPayer = {
        email: email, first_name: fName, last_name: lName,
        identification: { type: "CPF", number: cpf ? cpf : "00000000000" },
        phone: { area_code: areaCode, number: phoneNumber },
        address: { zip_code: "00000000", street_name: street, street_number: num, city: city }
    };

    // Removed the DB set block so we rely entirely on backend generation and prevent permission errors.
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

    const btnSeller = document.getElementById("btn-seller-checkout");
    if (btnSeller) {
        btnSeller.addEventListener("click", () => {
            const cart = CartManager.get();
            const fullName = document.getElementById("reg-full-name") ? document.getElementById("reg-full-name").value : "Cliente";
            const phone = document.getElementById("reg-phone") ? document.getElementById("reg-phone").value : "";
            const cep = document.getElementById("cep").value;
            const address = document.getElementById("address").value;
            const num = document.getElementById("num").value;

            let msg = `Olá! Meu CEP (${cep}) não está na lista de entrega automática e gostaria de finalizar meu pedido com um vendedor.\n\n*Produtos:*\n`;
            cart.forEach(item => {
                msg += `- ${item.quantity}x ${item.name}\n`;
            });
            msg += `\n*Endereço:* ${address}, ${num}\n*Nome:* ${fullName}\n*Telefone:* ${phone}`;

            window.open(`https://wa.me/5591986341760?text=${encodeURIComponent(msg)}`, '_blank');
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