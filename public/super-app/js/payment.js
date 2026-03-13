// js/payment.js — Dtudo Super App Checkout
// Sincronizado com o novo payment.html (design minimalista)

// ─── MERCADO PAGO SDK INIT ───────────────────────────────
let mp;
try {
    if (typeof MercadoPago !== 'undefined') {
        mp = new MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' });
        console.log("Mercado Pago inicializado com sucesso.");
    } else {
        console.error("Mercado Pago SDK não carregado!");
    }
} catch (e) {
    console.error("Erro ao inicializar SDK Mercado Pago:", e);
}
let paymentBrickController = null;
let currentShippingCost = 0;
let deliveryMode = 'delivery';
let selectedStore = '';
let selectedPayMethod = 'pix';     // 'pix' | 'card' | 'zap'
let selectedInstallments = 1;
let validatedCart = [];
let appliedCoupon = JSON.parse(sessionStorage.getItem('applied_coupon') || 'null');

const CLOUD_FUNCTIONS_URL = 'https://us-central1-super-app25.cloudfunctions.net';
// APPSCRIPT_URL is global from global.js

// ─── REGISTRO CENTRALIZADO DE PEDIDO ─────────────────────
// Fire-and-forget: não bloqueia o pagamento se falhar
function registrarPedido({ cart, total, method, gateway = 'Mercado Pago', status = 'Pendente' }) {
    const user = (typeof auth !== 'undefined') ? auth.currentUser : null;
    const uid = user?.uid || localStorage.getItem('guest_uid') || ('guest_' + Date.now());
    const fullName = document.getElementById("reg-full-name")?.value.trim() || "Cliente";
    const phone = document.getElementById("reg-phone")?.value.trim() || "";
    const address = document.getElementById("address")?.value || "";
    const city = document.getElementById("city-select")?.value || "";
    const cep = document.getElementById("cep")?.value || "";

    // Salva o telefone no localStorage para "login" automático na tela de pedidos
    if (phone) localStorage.setItem('user_phone', phone);

    const nameParts = fullName.split(' ');
    const productsTotal = total - currentShippingCost;
    const orderId = 'SA-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

    const orderPayload = {
        orderId,
        userId: uid,
        clientData: {
            firstName: nameParts[0],
            lastName: nameParts.slice(1).join(' ') || '',
            phone,
            email: user?.email || ''
        },
        deliveryData: {
            address: deliveryMode === 'pickup'
                ? `Retirada: ${selectedStore}`
                : `${address}, ${city}, CEP ${cep}`,
            mode: deliveryMode,
            store: selectedStore,
            city,
            cep,
            seller: (typeof validatedOrderData !== 'undefined' && validatedOrderData && validatedOrderData.seller) ? validatedOrderData.seller : (new URLSearchParams(window.location.search).get('seller') || "")
        },
        items: JSON.stringify(cart.map(i => ({
            id: i.id, name: i.name,
            quantity: i.quantity,
            price: i.priceBase || i.priceNew,
            image: i.image
        }))),
        productsTotal,
        shippingCost: currentShippingCost,
        total,
        couponCode: appliedCoupon?.code || null,
        status,
        gateway,
        account: 'default'
    };

    // 1. Salva na API (planilha) — mode:no-cors evita preflight CORS no GAS
    fetch(APPSCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', // fire-and-forget: não lemos a resposta
        body: JSON.stringify({ action: 'salvarPedido', data: orderPayload })
    }).catch(e => console.warn("API pedido (ignorado):", e.message));

    // 2. Log no Firestore — apenas se autenticado
    if (typeof db !== 'undefined' && typeof firebase !== 'undefined' && user) {
        db.collection("orders").doc(orderId).set({
            ...orderPayload,
            paymentMethod: method,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(e => console.warn("Firestore log (ignorado):", e.message));
    }

    return orderId; // Síncrono — retorna ID imediatamente
}


// ─── UTILS ───────────────────────────────────────────────
const fmt = (v) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

function showProcessingOverlay() {
    const el = document.getElementById('custom-loader-overlay');
    if (el) el.style.display = 'flex';
}
function hideProcessingOverlay() {
    const el = document.getElementById('custom-loader-overlay');
    if (el) el.style.display = 'none';
}
function showToast(msg, type = 'info') {
    const el = document.getElementById('toast-notification');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast show';
    setTimeout(() => { el.className = 'toast'; }, 3500);
}

// ─── REGRA DE PARCELAS SEM JUROS ─────────────────────────
// Sincronizado conforme novas taxas disponibilizadas pela InfinitePay
function getInstallmentPlan(total) {
    // Nova Tabela:
    // Até R$ 50 -> 3x sem juros
    // Até R$ 100 -> 4x sem juros
    // Até R$ 200 -> 6x sem juros
    // Acima de R$ 200 -> 12x sem juros (extrapolação lógica para maiores valores)
    
    let freeInstallments = 1;
    if (total >= 200) freeInstallments = 6;
    else if (total >= 100) freeInstallments = 4;
    else if (total >= 50) freeInstallments = 3;
    else if (total >= 10) freeInstallments = 1; // Mínimo para parcelar geralmente é R$5-10

    // InfinitePay permite até 12x. Vamos habilitar conforme o valor.
    let maxInstallments = 1;
    if (total >= 200) maxInstallments = 12;
    else if (total >= 100) maxInstallments = 6;
    else if (total >= 50) maxInstallments = 4;
    else if (total >= 20) maxInstallments = 3;

    const INTEREST_RATE = 0.0199; // 1.99% ao mês (caso o cliente escolha mais parcelas que o "sem juros")

    const plan = [];
    for (let n = 1; n <= maxInstallments; n++) {
        // Garantia de parcela mínima (InfinitePay/Gateways costumam exigir min R$5.00)
        if (total / n < 5) break; 

        let installmentValue, totalWithInterest;
        if (n <= freeInstallments) {
            installmentValue = total / n;
            totalWithInterest = total;
        } else {
            // Cálculo de juros para parcelas que excedem a carência sem juros
            const factor = Math.pow(1 + INTEREST_RATE, n);
            installmentValue = (total * factor * INTEREST_RATE) / (factor - 1);
            totalWithInterest = installmentValue * n;
        }
        plan.push({ 
            n, 
            installmentValue, 
            totalWithInterest, 
            free: n <= freeInstallments 
        });
    }
    return plan;
}

// ─── VALIDAÇÃO DE PREÇOS (API) ────────────────────────────
async function validateCartPrices(localCart) {
    let serverProducts = [];
    try {
        const response = await fetch(`${APPSCRIPT_URL}?action=listarProdutosSuperApp`);
        const result = await response.json();
        if (result.status === "success" && result.data) serverProducts = result.data;
    } catch (e) {
        console.warn("Sem acesso à API, usando preços locais");
    }

    return localCart.map(item => {
        const prod = serverProducts.find(p => String(p.id) === String(item.id));
        if (!prod) return { ...item, pricePix: item.priceNew, priceBase: item.priceNew };

        const valPrice = parseFloat(prod.price || 0);
        const valOffer = parseFloat(prod['price-oferta'] || 0);
        const hasOffer = (valOffer > 0 && valOffer < valPrice);

        let pricePix, priceBase;
        if (hasOffer) {
            pricePix = valOffer; // Oferta é o preço final do PIX
            priceBase = valPrice; // Cartão mantém preço original
        } else {
            priceBase = valPrice;
            pricePix = valPrice * 0.98; // 2% de desconto PIX para produtos fora de oferta
        }
        return { ...item, priceBase, pricePix, priceNew: pricePix };
    });
}

// ─── INIT ─────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    // Pré-preenche dados do usuário logado
    document.addEventListener('userReady', (e) => {
        if (e.detail) loadUserData(e.detail.uid);
    });
    if (typeof auth !== 'undefined' && auth.currentUser) {
        loadUserData(auth.currentUser.uid);
    }

    setupMasks();
    setupStepNavigation();
    setupDeliveryLogic();
    setupCardModal();
    loadOrderFromUrl();

    const pageTitle = "Checkout | Dtudo";
    document.title = pageTitle;
    if (typeof gtag === 'function') {
        gtag('event', 'page_view', {
            page_title: pageTitle,
            page_location: window.location.href,
            page_path: window.location.pathname + window.location.search
        });
    }
});

// ─── CARREGAR DADOS DO USUÁRIO ────────────────────────────
async function loadUserData(uid) {
    if (!uid || typeof db === 'undefined') return;
    try {
        const doc = await db.collection("users").doc(uid).get();
        if (doc.exists) {
            const d = doc.data();
            const nameEl = document.getElementById("reg-full-name");
            const phoneEl = document.getElementById("reg-phone");
            if (nameEl && !nameEl.value) nameEl.value = [d.firstName, d.lastName].filter(Boolean).join(' ');
            if (phoneEl && !phoneEl.value) phoneEl.value = d.phone || '';
        }
    } catch (e) { console.error("loadUserData:", e); }

    // Fallback para localStorage (Phone Login)
    const savedPhone = localStorage.getItem('user_phone');
    const phoneEl = document.getElementById("reg-phone");
    if (savedPhone && phoneEl && !phoneEl.value) {
        phoneEl.value = savedPhone;
    }
}

// ─── MASCARAS ─────────────────────────────────────────────
function setupMasks() {
    const phone = document.getElementById('reg-phone');
    if (phone) {
        phone.addEventListener('input', function () {
            let x = this.value.replace(/\D/g, '').match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
            this.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
        });
    }

    const cep = document.getElementById('cep');
    if (cep) {
        cep.addEventListener('input', function () {
            let val = this.value.replace(/\D/g, '');
            if (val.length > 5) val = val.substring(0, 5) + '-' + val.substring(5, 8);
            this.value = val;

            if (val.replace('-', '').length === 8) {
                fetch(`https://viacep.com.br/ws/${val.replace('-', '')}/json/`)
                    .then(r => r.json())
                    .then(data => {
                        if (!data.erro) {
                            const addr = document.getElementById('address');
                            if (addr) addr.value = `${data.logradouro}, ${data.bairro}`.replace(/^, /, '');
                            const city = document.getElementById('city-select');
                            if (city && data.localidade) {
                                city.value = data.localidade;
                                calculateShipping();
                            }
                        }
                    }).catch(() => { });
            }
        });
    }
}

// ─── NAVEGAÇÃO ENTRE PASSOS ───────────────────────────────
function setupStepNavigation() {
    const btnShipping = document.getElementById("btn-go-shipping");
    if (btnShipping) {
        btnShipping.addEventListener("click", async () => {
            const name = document.getElementById("reg-full-name")?.value.trim();
            const phone = document.getElementById("reg-phone")?.value.trim();
            if (!name || !phone) {
                showToast("Preencha seu nome e WhatsApp.", "error");
                return;
            }
            // Salva no Firestore se logado
            if (typeof auth !== 'undefined' && auth.currentUser) {
                const parts = name.split(' ');
                db.collection("users").doc(auth.currentUser.uid).set({
                    firstName: parts[0], lastName: parts.slice(1).join(' '), phone
                }, { merge: true }).catch(() => { });
            }
            changeStep(2);
        });
    }

    const btnPayment = document.getElementById("btn-go-payment");
    if (btnPayment) {
        btnPayment.addEventListener("click", async () => {
            const cart = CartManager.get();
            const hasOrderData = (validatedOrderData && validatedOrderData.cartItems && validatedOrderData.cartItems.length > 0);
            
            if (cart.length === 0 && !hasOrderData) { 
                showToast("Carrinho vazio!", "error"); 
                return; 
            }

            if (deliveryMode === 'delivery') {
                if (!document.getElementById("cep")?.value || !document.getElementById("address")?.value) {
                    showToast("Preencha o endereço completo.", "error");
                    return;
                }
            } else if (!selectedStore) {
                showToast("Selecione uma loja para retirada.", "error");
                return;
            }

            changeStep(3);
            await setupPaymentStep();
        });
    }

    const btnConfirm = document.getElementById("btn-confirm-payment");
    if (btnConfirm) {
        btnConfirm.addEventListener("click", handleConfirmPayment);
    }
}

// ─── MUDAR PASSO ──────────────────────────────────────────
function changeStep(stepNum) {
    document.querySelectorAll('.co-card').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.co-step-item').forEach(el => {
        el.classList.remove('active', 'done');
    });

    const steps = ['step-indic-1', 'step-indic-2', 'step-indic-3'];
    const cards = ['step-registration', 'step-shipping', 'step-payment'];

    // Marca passos anteriores como "done"
    for (let i = 0; i < stepNum - 1; i++) {
        const el = document.getElementById(steps[i]);
        if (el) {
            el.classList.add('done');
            const num = el.querySelector('.co-step-num');
            if (num) num.innerHTML = '<i class="bx bx-check" style="font-size:0.9rem;"></i>';
        }
    }
    // Marca passo atual como "active"
    const activeStep = document.getElementById(steps[stepNum - 1]);
    if (activeStep) activeStep.classList.add('active');

    // Mostra card correto
    const activeCard = document.getElementById(cards[stepNum - 1]);
    if (activeCard) activeCard.classList.add('active');

    const stepTitles = ["Identificação", "Entrega", "Pagamento"];
    const pageTitle = `${stepTitles[stepNum - 1]} | Checkout | Dtudo`;
    document.title = pageTitle;

    if (typeof gtag === 'function') {
        gtag('event', 'page_view', {
            page_title: pageTitle,
            page_location: window.location.href,
            page_path: window.location.pathname + "#step" + stepNum
        });
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── LÓGICA DE ENTREGA ────────────────────────────────────
function setupDeliveryLogic() {
    const citySelect = document.getElementById('city-select');
    if (citySelect) citySelect.addEventListener('change', calculateShipping);

    const addressInput = document.getElementById('address');
    if (addressInput) addressInput.addEventListener('blur', calculateShipping);

    window.selectDeliveryType = (type) => {
        deliveryMode = type;
        document.querySelectorAll('.co-toggle').forEach(c => c.classList.remove('sel'));
        const active = document.querySelector(`.co-toggle[data-type="${type}"]`);
        if (active) active.classList.add('sel');

        const deliveryForm = document.getElementById("container-delivery-form");
        const pickupList = document.getElementById("container-pickup-list");

        if (type === 'delivery') {
            if (deliveryForm) deliveryForm.style.display = 'block';
            if (pickupList) pickupList.style.display = 'none';
            calculateShipping();
        } else {
            if (deliveryForm) deliveryForm.style.display = 'none';
            if (pickupList) pickupList.style.display = 'block';
            currentShippingCost = 0;
            updateShippingDisplay();
        }
    };

    window.selectStore = (elem, storeName) => {
        document.querySelectorAll('.co-store-item').forEach(i => i.classList.remove('sel'));
        elem.classList.add('sel');
        selectedStore = storeName;
    };
}

function calculateShipping() {
    const cart = CartManager.get();
    const city = document.getElementById('city-select')?.value || '';
    const cep = document.getElementById('cep')?.value || '';
    const address = document.getElementById('address')?.value || '';
    const subtotal = cart.reduce((s, i) => s + (i.priceNew * i.quantity), 0);

    // Normalização para comparação robusta
    const normalizedCity = city.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const isIpixuna = normalizedCity.includes('ipixuna');

    // Se for cidades padrão (Ipixuna), usa frete grátis
    if (isIpixuna) {
        currentShippingCost = 0; // Festival Frete Grátis
        renderFreightOptions(null); // Oculta opções dinâmicas
        updateShippingDisplay(subtotal);
    } else {
        // Para outras cidades e se o CEP estiver preenchido, busca SuperFrete
        const cleanCep = cep.replace(/\D/g, '');
        if (cleanCep.length === 8) {
            fetchDynamicFreight(cleanCep, cart, address, city);
        } else {
            // Se CEP incompleto e não é Ipixuna, reseta custo para null (A calcular)
            currentShippingCost = null; 
            renderFreightOptions(null);
            updateShippingDisplay(subtotal);
        }
    }
}

async function fetchDynamicFreight(cep, cart, address, city) {
    const container = document.getElementById('freight-list');
    const wrapper = document.getElementById('shipping-options-container');
    const manualInfo = document.getElementById('manual-shipping-info');
    
    if (wrapper) wrapper.style.display = 'block';
    if (manualInfo) manualInfo.style.display = 'none';
    if (container) container.innerHTML = '<div style="font-size:0.8rem; color:var(--faint); padding:10px 0;"><i class="bx bx-loader-alt bx-spin"></i> Calculando frete...</div>';

    try {
        // Busca os produtos detalhados para ter peso/medidas
        const allProds = DataManager.getProducts();
        const itemsWithMeasures = cart.map(item => {
            const p = allProds.find(x => String(x.id) === String(item.id));
            if (p) {
                return {
                    id: p.id,
                    name: p.name,
                    quantity: item.quantity,
                    weight: parseFloat(p.peso) || 0.5,
                    height: parseFloat(p.altura) || 10,
                    width: parseFloat(p.largura) || 10,
                    length: parseFloat(p.comprimento) || 10
                };
            }
            return { id: item.id, quantity: item.quantity, weight: 0.5, height: 10, width: 10, length: 10 };
        });

        const resp = await fetch(`${CLOUD_FUNCTIONS_URL}/calculateFreight`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                destination_cep: cep,
                destination_address: address,
                destination_city: city,
                items: itemsWithMeasures
            })
        });

        const options = await resp.json();
        if (options && options.length > 0) {
            console.log(`🚚 Sucesso! ${options.length} opções de frete recebidas.`);
        } else {
            console.warn("🚚 API SuperFrete não retornou opções de frete válidas para este CEP.");
        }
        renderFreightOptions(options);

    } catch (e) {
        console.error("Erro SuperFrete:", e);
        if (container) container.innerHTML = '<div style="font-size:0.8rem; color:var(--accent);">Erro ao calcular frete dinâmico.</div>';
        if (manualInfo) manualInfo.style.display = 'flex';
    }
}

function renderFreightOptions(options) {
    const container = document.getElementById('freight-list');
    const wrapper = document.getElementById('shipping-options-container');
    const manualInfo = document.getElementById('manual-shipping-info');

    if (!options || options.length === 0) {
        if (wrapper) wrapper.style.display = 'none';
        if (manualInfo) manualInfo.style.display = 'flex';
        return;
    }

    if (wrapper) wrapper.style.display = 'block';
    if (manualInfo) manualInfo.style.display = 'none';

    container.innerHTML = options.map((opt, idx) => `
        <div class="co-pay-option freight-opt ${idx === 0 ? 'sel' : ''}" style="padding:12px; margin-bottom:8px;" onclick="selectFreightOption(this, ${opt.price}, '${opt.name}')">
            <div class="co-pay-info">
                <div class="co-pay-label" style="font-size:0.85rem;">${opt.name}</div>
                <div class="co-pay-sub" style="font-size:0.75rem;">Chega em até ${opt.delivery_time} dias úteis</div>
            </div>
            <div style="font-weight:700; font-size:0.85rem;">${fmt(opt.price)}</div>
        </div>
    `).join('');

    // Seleciona a primeira opção por padrão
    const first = options[0];
    if (first) {
        currentShippingCost = first.price;
        updateShippingDisplay();
    }
}

window.selectFreightOption = (el, price, name) => {
    document.querySelectorAll('.freight-opt').forEach(opt => opt.classList.remove('sel'));
    el.classList.add('sel');
    currentShippingCost = price;
    updateShippingDisplay();
};

function updateShippingDisplay(subtotal) {
    const cart = CartManager.get();
    const sub = subtotal || cart.reduce((s, i) => s + (i.priceNew * i.quantity), 0);
    const total = sub + (Number(currentShippingCost) || 0);

    const subtotalEl = document.getElementById('subtotal-display');
    const shippingEl = document.getElementById('shipping-cost-display');
    const totalEl = document.getElementById('total-display');

    if (subtotalEl) subtotalEl.textContent = fmt(sub);
    if (shippingEl) {
        if (currentShippingCost === 0) shippingEl.textContent = 'Grátis 🎉';
        else if (currentShippingCost > 0) shippingEl.textContent = fmt(currentShippingCost);
        else shippingEl.textContent = 'A calcular';
    }
    if (totalEl) totalEl.textContent = fmt(total);
}

// ─── PASSO 3: CONFIGURAR RESUMO E PAGAMENTO ───────────────
async function setupPaymentStep() {
    showProcessingOverlay();

    try {
        const localCart = CartManager.get();
        const linkCart = (validatedOrderData && validatedOrderData.cartItems) ? validatedOrderData.cartItems : [];

        if (localCart.length === 0 && linkCart.length > 0) {
            console.log("[Checkout] Validando preços do pedido vinculado ao link.");
            validatedCart = await validateCartPrices(linkCart);
        } else {
            validatedCart = await validateCartPrices(localCart);
        }
    } catch (e) {
        console.warn("[Checkout] Falha ao validar preços, usando fallback:", e);
        const localCart = CartManager.get();
        const sourceCart = (localCart.length > 0) ? localCart : (validatedOrderData?.cartItems || []);
        validatedCart = sourceCart.map(i => ({ 
            ...i, 
            pricePix: i.pricePix || i.priceNew, 
            priceBase: i.priceBase || i.priceNew 
        }));
    }

    hideProcessingOverlay();

    // Renderiza lista de produtos
    renderProductList(validatedCart);

    // Lógica de Cupom
    let discountValue = 0;

    const baseTotalPix = validatedCart.reduce((s, i) => s + (i.pricePix || i.priceNew) * i.quantity, 0) + currentShippingCost;
    const baseTotalCard = validatedCart.reduce((s, i) => s + (i.priceBase || i.priceNew) * i.quantity, 0) + currentShippingCost;

    if (appliedCoupon) {
        if (appliedCoupon.code === 'VALE5') {
            discountValue = 5.00;
        } else if (appliedCoupon.code === 'APROVEITA26') {
            discountValue = baseTotalPix * 0.12;
        } else if (appliedCoupon.code === 'LAYLA10') {
            let laylaTotal = 0;
            const serverProducts = typeof DataManager !== 'undefined' ? (DataManager.getProducts() || []) : [];
            validatedCart.forEach(item => {
                const prod = serverProducts.find(p => String(p.id) === String(item.id));
                const cat = prod && prod.category ? prod.category.toUpperCase() : '';
                if (cat.includes('MAQUIAGEM') || cat.includes('COSMÉTICO') || cat.includes('COSMETICO')) {
                    laylaTotal += (item.pricePix || item.priceNew) * item.quantity;
                }
            });
            discountValue = laylaTotal * 0.10;
        }
    }

    const totalPix = Math.max(0, baseTotalPix - discountValue);
    const totalCard = Math.max(0, baseTotalCard - (appliedCoupon ? discountValue : 0));
    const savings = baseTotalCard - totalPix;

    renderTotals(totalPix, totalCard, savings, discountValue, appliedCoupon);
    renderPaymentOptions(totalCard, totalPix);

    // Seta método padrão: PIX
    selectPayMethod('pix');
}

function renderProductList(cart) {
    const container = document.getElementById('pay-product-list');
    if (!container) return;

    container.innerHTML = cart.map(item => {
        const pix = item.pricePix || item.priceNew;
        const card = item.priceBase || item.priceNew;
        const hasDiscount = card > pix + 0.01;
        return `
        <div class="co-product-item">
            <img class="co-product-img" src="${item.image || ''}" alt="${item.name}" onerror="this.style.background='#eee'">
            <div class="co-product-info">
                <div class="co-product-name">${item.name}</div>
                <div class="co-product-qty">Qtd: ${item.quantity}</div>
            </div>
            <div class="co-product-price">
                ${hasDiscount ? `<small>${fmt(card * item.quantity)}</small>` : ''}
                ${fmt(pix * item.quantity)}
            </div>
        </div>`;
    }).join('');
}

function renderTotals(totalPix, totalCard, savings, discountValue = 0, coupon = null) {
    // Armazena globalmente para usar no confirmar
    window._totalPix = totalPix;
    window._totalCard = totalCard;
    window._currentDiscount = discountValue;

    const subtotalCard = (totalCard + (coupon ? discountValue : 0)) - currentShippingCost;
    document.getElementById('pay-subtotal').textContent = fmt(subtotalCard);
    document.getElementById('pay-frete').textContent = currentShippingCost === 0 ? 'Grátis 🎉' : fmt(currentShippingCost);

    const couponRow = document.getElementById('pay-coupon-row');
    const couponVal = document.getElementById('pay-coupon-value');
    if (couponRow && couponVal) {
        if (coupon && discountValue > 0) {
            couponRow.style.display = 'flex';
            couponVal.textContent = `- ${fmt(discountValue)}`;
        } else {
            couponRow.style.display = 'none';
        }
    }

    const hasSavings = savings > 0.05;
    const savBadge = document.getElementById('pay-savings');
    if (savBadge) {
        if (hasSavings) {
            savBadge.textContent = `Economize ${fmt(savings)} pagando com PIX`;
            savBadge.style.display = 'inline-block';
        } else {
            savBadge.style.display = 'none';
        }
    }
}

function renderPaymentOptions(totalCard, totalPix) {
    // Atualiza sub-labels
    const pixSub = document.getElementById('pix-sub');
    if (pixSub) pixSub.textContent = `${fmt(totalPix)} · 2% de desconto à vista`;

    const plan = getInstallmentPlan(totalCard);
    const bestFree = plan.filter(p => p.free).pop();

    const cardSub = document.getElementById('card-sub');
    if (cardSub && bestFree) {
        cardSub.textContent = `Até ${bestFree.n}x de ${fmt(bestFree.installmentValue)} sem juros`;
    }

    // Gera lista de parcelas
    const box = document.getElementById('installments-box');
    if (box) {
        box.innerHTML = plan.map(p => `
            <div class="co-inst-option" data-n="${p.n}" onclick="chooseInstallment(${p.n}, ${p.installmentValue.toFixed(2)})">
                <span>${p.n}x de <strong>${fmt(p.installmentValue)}</strong>
                    ${!p.free ? `<span style="color:var(--faint);font-size:0.8rem;"> (total ${fmt(p.totalWithInterest)})</span>` : ''}
                </span>
                <span class="co-inst-badge ${p.free ? 'free' : ''}">
                    ${p.free ? 'Sem juros' : `+juros`}
                </span>
            </div>
        `).join('');
    }
}

window.chooseInstallment = (n, value) => {
    selectedInstallments = n;
    document.querySelectorAll('.co-inst-option').forEach(el => el.classList.remove('sel'));
    const sel = document.querySelector(`.co-inst-option[data-n="${n}"]`);
    if (sel) sel.classList.add('sel');

    const cardSub = document.getElementById('card-sub');
    if (cardSub) cardSub.textContent = `${n}x de ${fmt(value)}`;
};

// ─── SELEÇÃO DE MÉTODO DE PAGAMENTO ──────────────────────
window.selectPayMethod = (method) => {
    selectedPayMethod = method;

    document.querySelectorAll('.co-pay-option').forEach(el => el.classList.remove('sel'));
    const optMap = { pix: 'opt-pix', card: 'opt-card', zap: 'opt-zap' };
    const chosen = document.getElementById(optMap[method]);
    if (chosen) chosen.classList.add('sel');

    // Mostrar/ocultar lista de parcelas
    const instBox = document.getElementById('installments-box');
    if (instBox) instBox.className = method === 'card' ? 'co-installments show' : 'co-installments';

    // Mostrar/ocultar MP Brick (cartão)
    const brickWrapper = document.getElementById('payment-brick-wrapper');
    if (brickWrapper) brickWrapper.style.display = 'none';

    // Atualiza total exibido conforme método
    const totalLabel = document.getElementById('pay-total-label');
    const totalVal = document.getElementById('pay-total');

    if (method === 'pix') {
        if (totalLabel) totalLabel.textContent = 'Total com PIX';
        if (totalVal) totalVal.textContent = fmt(window._totalPix || 0);
        updateConfirmButton('pix');
    } else if (method === 'card') {
        if (totalLabel) totalLabel.textContent = 'Total no Cartão';
        const plan = getInstallmentPlan(window._totalCard || 0);
        const inst = plan.find(p => p.n === selectedInstallments) || plan[0];
        if (totalVal) totalVal.textContent = fmt(inst ? inst.installmentValue : (window._totalCard || 0));
        updateConfirmButton('card');
    } else {
        if (totalLabel) totalLabel.textContent = 'Total';
        if (totalVal) totalVal.textContent = fmt(window._totalCard || 0);
        updateConfirmButton('zap');
    }
};

function updateConfirmButton(method) {
    const btn = document.getElementById('btn-confirm-payment');
    if (!btn) return;
    if (method === 'pix') {
        btn.innerHTML = '<i class="bx bx-qr-scan"></i> Gerar QR Code PIX';
        btn.style.background = '';
    } else if (method === 'card') {
        btn.innerHTML = '<i class="bx bx-credit-card"></i> Pagar com Cartão';
        btn.style.background = '';
    } else {
        btn.innerHTML = '<i class="bx bxl-whatsapp"></i> Finalizar via WhatsApp';
        btn.style.background = '#25D366';
    }
}

// ─── CONFIRMAR PAGAMENTO ──────────────────────────────────
async function handleConfirmPayment() {
    if (selectedPayMethod === 'pix') {
        await handlePixPayment();
    } else if (selectedPayMethod === 'card') {
        await handleInfinitePayPayment();
    } else {
        handleWhatsAppPayment();
    }
}

// ─── PIX ──────────────────────────────────────────────────
async function handlePixPayment() {
    showProcessingOverlay();
    try {
        const paymentData = await startCustomCheckout('pix');
        if (paymentData && paymentData.point_of_interaction) {
            showPixScreen(paymentData);
        } else {
            throw new Error("Não foi possível gerar os dados do PIX.");
        }
    } catch (e) {
        console.error(e);
        showToast("Erro ao gerar PIX (Mercado Pago): " + e.message, "error");
    } finally {
        hideProcessingOverlay();
    }
}

async function startCustomCheckout(paymentType) {
    const cart = validatedCart.length ? validatedCart : CartManager.get();
    const user = (typeof auth !== 'undefined') ? auth.currentUser : null;
    const fullName = document.getElementById("reg-full-name")?.value.trim() || "Cliente";
    const phone = document.getElementById("reg-phone")?.value.trim() || "";
    const address = document.getElementById("address")?.value || "";
    const city = document.getElementById("city-select")?.value || "";
    const cep = document.getElementById("cep")?.value || "";

    const total = paymentType === 'pix' ? window._totalPix : window._totalCard;
    const expiration = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    // Registra pedido na API (fire-and-forget)
    const orderId = registrarPedido({
        cart, total, method: paymentType,
        gateway: 'Mercado Pago', status: 'Aguardando Pagamento PIX'
    });

    const phoneDigits = phone.replace(/\D/g, '');
    const nameParts = fullName.split(' ');

    // Items formatados com priceNew (campo usado pelo backend functions/index.js linha 624)
    const formattedItems = cart.map(i => ({
        id: String(i.id),
        name: i.name,
        quantity: Number(i.quantity),
        priceNew: Number(i.pricePix || i.priceNew), // priceNew é o campo lido pelo backend
        image: i.image || ''
    }));

    const payload = {
        orderId,
        account: 'eletropay',  // CNPJ 45692327000100 — conta do Super App
        items: formattedItems,
        shippingCost: currentShippingCost,
        customPayer: {
            first_name: nameParts[0],
            last_name: nameParts.slice(1).join(' ') || 'Cliente',
            email: user?.email || 'cliente@dtudo.com.br',
            phone: {
                area_code: phoneDigits.substring(0, 2) || '11',
                number: phoneDigits.substring(2) || '900000000'
            },
            address: {
                zip_code: cep.replace(/\D/g, '') || '00000000',
                street_name: address || 'Rua',
                street_number: '0',
                city: city || 'Ipixuna do Para'
            },
            identification: { type: 'CPF', number: '00000000000' }
        },
        // payment_data: campos que o backend usa para montar o finalPaymentData
        payment_data: {
            payment_method_id: 'pix',
            transaction_amount: Number(total.toFixed(2)),
            description: 'Compra Dtudo - Pedido ' + orderId,
            date_of_expiration: expiration,
            payer: { email: user?.email || 'cliente@dtudo.com.br' }
        }
    };

    const resp = await fetch(`${CLOUD_FUNCTIONS_URL}/createPayment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!resp.ok) {
        const errBody = await resp.text();
        console.error('createPayment 400:', errBody);
        throw new Error('Erro ' + resp.status + ': ' + errBody);
    }

    return await resp.json();
}


function showPixScreen(paymentData) {
    const screen = document.getElementById('pix-screen');
    if (!screen) return;

    const qr = paymentData.point_of_interaction?.transaction_data;
    const qrImg = document.getElementById('display-pix-qr');
    const qrCode = document.getElementById('display-pix-copypaste');
    const btnCopy = document.getElementById('btn-copy-pix');
    const btnDone = document.getElementById('btn-finish-pix');

    if (qrImg && qr?.qr_code_base64) qrImg.src = `data:image/png;base64,${qr.qr_code_base64}`;
    if (qrCode && qr?.qr_code) qrCode.value = qr.qr_code;

    if (btnCopy) {
        btnCopy.onclick = () => {
            navigator.clipboard.writeText(qr?.qr_code || '').then(() => showToast("Código copiado!"));
        };
    }

    if (btnDone) {
        btnDone.onclick = () => {
            if (typeof trackEvent === 'function' && paymentData) {
                trackEvent('purchase', {
                    transaction_id: paymentData.id,
                    value: paymentData.transaction_amount,
                    currency: 'BRL',
                    payment_type: 'pix',
                    items: paymentData.additional_info?.items || []
                });
            }
            CartManager.clear();
            window.location.href = "pedidos.html";
        };
    }

    screen.style.display = 'block';
}

// ─── CARTÃO — MODAL BOTTOM-SHEET COM MP BRICK ────────────
function openCardModal() {
    const overlay = document.getElementById('card-modal-overlay');
    if (!overlay) return;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden'; // bloqueia scroll do fundo

    // Monta o Brick (só se ainda não montado ou se foi desmontado)
    mountCardBrick();
}

function closeCardModal() {
    const overlay = document.getElementById('card-modal-overlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
}

async function mountCardBrick() {
    const container = document.getElementById('payment-brick-container');
    if (!container) return;
    if (container.children.length > 0 && paymentBrickController) return; // já montado

    if (paymentBrickController) {
        try { await paymentBrickController.unmount(); } catch (e) { }
        paymentBrickController = null;
    }

    showProcessingOverlay();
    const total = window._totalCard || 0;
    const user = (typeof auth !== 'undefined') ? auth.currentUser : null;
    const fullName = document.getElementById("reg-full-name")?.value.trim() || "Cliente";

    const bricksBuilder = mp.bricks();
    paymentBrickController = await bricksBuilder.create("payment", "payment-brick-container", {
        initialization: { amount: total },
        customization: {
            paymentMethods: {
                creditCard: "all",
                debitCard: "all",
                maxInstallments: total >= 150 ? 12 : 1,
            },
            visual: { style: { theme: 'default' } }
        },
        callbacks: {
            onReady: () => hideProcessingOverlay(),
            onSubmit: async ({ formData }) => {
                closeCardModal();
                showProcessingOverlay();
                try {
                    const cart = validatedCart.length ? validatedCart : CartManager.get();
                    const phone = document.getElementById("reg-phone")?.value.trim() || "";
                    const address = document.getElementById("address")?.value || "";
                    const city = document.getElementById("city-select")?.value || "";
                    const cep = document.getElementById("cep")?.value || "";

                    const orderId = registrarPedido({
                        cart, total,
                        method: 'card',
                        gateway: 'Mercado Pago Cartão',
                        status: 'Processando Cartão'
                    });

                    const resp = await fetch(`${CLOUD_FUNCTIONS_URL}/createPayment`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            orderId,
                            account: 'eletropay',
                            payment_data: formData,
                            items: cart.map(i => ({ id: String(i.id), name: i.name, quantity: i.quantity, priceNew: i.priceBase || i.priceNew, image: i.image || '' })),
                            shippingCost: currentShippingCost,
                            customPayer: {
                                first_name: fullName.split(' ')[0],
                                last_name: fullName.split(' ').slice(1).join(' ') || 'Cliente',
                                email: user?.email || formData.payer?.email || 'cliente@dtudo.com.br',
                                phone: { area_code: phone.replace(/\D/g, '').substring(0, 2) || '11', number: phone.replace(/\D/g, '').substring(2) || '900000000' },
                                address: { zip_code: cep.replace(/\D/g, '') || '00000000', street_name: address || 'Rua', street_number: '0', city: city || 'Ipixuna do Para' },
                                identification: { type: 'CPF', number: '00000000000' }
                            }
                        })
                    });

                    const result = await resp.json();
                    hideProcessingOverlay();

                    if (result.status === 'approved' || result.status === 'in_process') {
                        showToast("✅ Pagamento enviado! Aguarde confirmação.");
                        if (typeof trackEvent === 'function') {
                            trackEvent('purchase', {
                                transaction_id: result.id,
                                value: result.transaction_amount,
                                currency: 'BRL',
                                payment_type: 'card'
                            });
                        }
                        CartManager.clear();
                        setTimeout(() => window.location.href = "pedidos.html", 2000);
                    } else {
                        showToast("Pagamento não aprovado. Tente novamente.", "error");
                    }
                } catch (e) {
                    hideProcessingOverlay();
                    console.error(e);
                    showToast("Erro ao processar cartão.", "error");
                }
            },
            onError: (err) => {
                hideProcessingOverlay();
                console.error("Brick error:", err);
            }
        }
    });
}

// Setup do modal de cartão (chamado no DOMContentLoaded)
function setupCardModal() {
    const btnClose = document.getElementById('btn-close-card-modal');
    if (btnClose) btnClose.onclick = () => {
        closeCardModal();
    };
    // Fechar ao clicar no overlay (fora do modal)
    const overlay = document.getElementById('card-modal-overlay');
    if (overlay) overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeCardModal();
    });
}

async function handleInfinitePayPayment() {
    showProcessingOverlay();
    try {
        const cart = validatedCart.length ? validatedCart : CartManager.get();
        const isPix = selectedPayMethod === 'pix';
        const total = isPix ? (window._totalPix || 0) : (window._totalCard || 0);
        
        // 1. Registrar o pedido no sistema antes de redirecionar
        const orderId = registrarPedido({
            cart, 
            total,
            method: selectedPayMethod,
            gateway: 'InfinitePay Checkout',
            status: 'Aguardando Pagamento'
        });

        // 2. Chamar Cloud Function para gerar o link
        const fullName = document.getElementById("reg-full-name")?.value.trim() || "Cliente";
        const phone = document.getElementById("reg-phone")?.value.trim() || "";

        // Prepara itens com o preço correto baseado no método (Pix tem 2% de desconto no pricePix)
        const itemsPayload = cart.map(i => ({
            name: i.name,
            quantity: Number(i.quantity),
            price: Number(isPix ? (i.pricePix || i.priceNew) : (i.priceBase || i.priceNew))
        }));

        // Adiciona cupom de desconto como um item negativo se houver
        if (appliedCoupon && window._currentDiscount > 0) {
            itemsPayload.push({
                name: `Cupom: ${appliedCoupon.code}`,
                quantity: 1,
                price: -Math.abs(window._currentDiscount)
            });
        }

        const payload = {
            orderId: orderId,
            items: itemsPayload,
            customer: {
                name: fullName,
                phone: phone
            },
            payment_method: selectedPayMethod, // 'pix' ou 'card'
            redirect_url: window.location.origin + "/super-app/pedidos.html"
        };

        // Note: A URL da função pode variar conforme a região. 
        // Usamos a URL base definida no topo, ajustando se necessário.
        const INFINITE_FUNCTION_URL = CLOUD_FUNCTIONS_URL.replace('us-central1', 'southamerica-east1') + '/createInfinitePayLink';
        
        const resp = await fetch(INFINITE_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await resp.json();
        hideProcessingOverlay();

        if (result.status === 'success' && result.url) {
            // Track purchase attempt
            if (typeof trackEvent === 'function') {
                trackEvent('begin_checkout', {
                    value: total,
                    currency: 'BRL',
                    payment_type: selectedPayMethod,
                    gateway: 'infinitepay'
                });
            }
            
            // Redireciona para o link de pagamento da InfinitePay
            console.log("Redirecionando para InfinitePay:", result.url);
            window.location.href = result.url;
        } else {
            showToast("Erro ao gerar link de pagamento. Tente novamente.", "error");
        }
    } catch (e) {
        hideProcessingOverlay();
        console.error("InfinitePay Link Error:", e);
        showToast("Erro ao processar pagamento com InfinitePay.", "error");
    }
}

async function handleCardPayment() {
    await handleInfinitePayPayment();
}


// ─── WHATSAPP ─────────────────────────────────────────────
async function handleWhatsAppPayment() {
    const cart = validatedCart.length ? validatedCart : CartManager.get();
    const fullName = document.getElementById("reg-full-name")?.value.trim() || "Cliente";
    const phone = document.getElementById("reg-phone")?.value.trim() || "";
    const address = document.getElementById("address")?.value || "";
    const city = document.getElementById("city-select")?.value || "";
    const ref = Math.floor(100000 + Math.random() * 900000);
    const total = window._totalCard || 0;

    // 1. Registra na API (planilha) + Firestore
    await registrarPedido({
        cart,
        total,
        method: 'whatsapp',
        gateway: 'WhatsApp',
        status: 'Aguardando Atendente'
    });

    // 2. Monta mensagem detalhada para o WhatsApp
    let msg = `Olá! Gostaria de finalizar meu pedido.\n\n*Ref. #${ref}*\n\n*Produtos:*\n`;
    cart.forEach(i => {
        msg += `• ${i.quantity}x ${i.name} — ${fmt((i.priceBase || i.priceNew) * i.quantity)}\n`;
    });
    msg += `\n*Frete:* ${currentShippingCost === 0 ? 'Grátis' : fmt(currentShippingCost)}`;
    msg += `\n*Total:* ${fmt(total)}\n`;
    msg += `\n*Cliente:* ${fullName}\n*Tel:* ${phone}`;
    msg += deliveryMode === 'pickup'
        ? `\n*Retirada:* ${selectedStore}`
        : `\n*Entrega:* ${address}, ${city}`;

    // 3. Abre WhatsApp e limpa carrinho
    if (typeof trackEvent === 'function') {
        trackEvent('purchase', {
            transaction_id: 'WA-' + ref,
            value: total,
            currency: 'BRL',
            payment_type: 'whatsapp'
        });
    }
    window.open(`https://wa.me/5591986341760?text=${encodeURIComponent(msg)}`, '_blank');
    CartManager.clear();
    setTimeout(() => window.location.href = "index.html", 1500);
}

// ─── PIX EVENTS (tela de resultado) ──────────────────────
function setupPixEvents() {
    const btnFinish = document.getElementById('btn-finish-pix');
    if (btnFinish) {
        btnFinish.onclick = () => {
            CartManager.clear();
            window.location.href = "pedidos.html";
        };
    }
}

// ─── BACKGROUND LOADER PARA LINKS DE PAGAMENTO ────────────
let validatedOrderData = null;
async function loadOrderFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const rawOrderId = params.get('orderId');
    if (!rawOrderId) return;

    // Normaliza o ID para busca (sempre com SA-)
    const searchId = rawOrderId.startsWith('SA') 
        ? (rawOrderId.startsWith('SA-') ? rawOrderId : 'SA-' + rawOrderId.substring(2))
        : 'SA-' + rawOrderId;

    // Se for link de pedido, removemos a opção de WhatsApp
    const zapOpt = document.getElementById('opt-zap');
    if (zapOpt) zapOpt.style.display = 'none';

    console.log(`[Link Shortener] Detectado link via ID: ${searchId}...`);
    
    try {
        const response = await fetch(`${APPSCRIPT_URL}?action=getOrderById&orderId=${searchId}`);
        const result = await response.json();

        if (result.status === "success" && result.data) {
            const orderData = result.data;
            console.log("[Link Shortener] Pedido recuperado com sucesso.");
            
            validatedOrderData = orderData;

            // Extrai itens (pode vir como array ou string JSON)
            try {
                if (orderData.items) {
                    validatedOrderData.cartItems = Array.isArray(orderData.items) ? orderData.items : JSON.parse(orderData.items);
                } else if (orderData.itemsString) {
                    // Tenta parsear, se falhar (ex: string humanizada), mantém vazio para evitar crash
                    validatedOrderData.cartItems = JSON.parse(orderData.itemsString);
                }
            } catch (ee) {
                console.warn("[Link Shortener] Erro ao parsear itens do pedido. O formato pode estar inválido.", ee);
                validatedOrderData.cartItems = [];
            }

            // Exibe o vendedor se existir
            if (orderData.seller) {
                const sellerRow = document.getElementById('pay-seller-row');
                const sellerName = document.getElementById('pay-seller-name');
                if (sellerRow && sellerName) {
                    sellerRow.style.display = 'flex';
                    sellerName.textContent = orderData.seller;
                }
            }

            // Se o carrinho estiver vazio, preenchemos a visualização do Passo 3 antecipadamente
            if (CartManager.get().length === 0 && validatedOrderData.cartItems) {
                console.log("[Link Shortener] Injetando resumo do pedido.");
                if (document.getElementById('step-payment').classList.contains('active')) {
                    setupPaymentStep();
                }
            }
        } else if (result.status === "expired") {
            showToast(result.message, "warning");
            setTimeout(() => window.location.href = "index.html", 4000);
        }
    } catch (e) {
        console.warn("[Link Shortener] Falha ao carregar pedido em background:", e);
    }
}