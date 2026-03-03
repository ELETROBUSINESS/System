const container = document.getElementById("orders-list");

document.addEventListener('userReady', (e) => {
    checkUserAuth();
});

// Inicialização imediata caso userReady já tenha disparado
if (typeof auth !== 'undefined' && auth.currentUser) {
    checkUserAuth();
} else {
    setTimeout(checkUserAuth, 1000); // Fallback
}

async function checkUserAuth() {
    if (!container) return;

    const user = auth.currentUser;
    const guestPhone = localStorage.getItem('user_phone');

    if (user && !user.isAnonymous) {
        loadOrdersFromAPI(user.phoneNumber || guestPhone);
    } else if (guestPhone) {
        loadOrdersFromAPI(guestPhone);
    } else {
        renderAuthRequired();
    }
}

function renderAuthRequired() {
    container.innerHTML = `
        <div class='empty-state'>
            <i class='bx bx-user-circle'></i>
            <h3>Acesse seus pedidos</h3>
            <p>Informe seu WhatsApp para acompanhar suas compras.</p>
            <div style="margin-top:20px; max-width:300px; margin-left:auto; margin-right:auto;">
                <input type="tel" id="login-phone" placeholder="(00) 00000-0000" 
                    style="width:100%; padding:12px; border:1px solid #ddd; border-radius:8px; margin-bottom:10px; text-align:center; font-size:1.1rem;">
                <button onclick="handlePhoneLogin()" id="btn-login-orders"
                    style="width:100%; padding:14px; background:var(--color-brand-red, #c20026); color:#fff; border:none; border-radius:8px; font-weight:700; cursor:pointer;">
                    Consultar Meus Pedidos
                </button>
            </div>
        </div>`;

    const input = document.getElementById('login-phone');
    if (input) {
        input.addEventListener('input', function (e) {
            let x = e.target.value.replace(/\D/g, '').match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
            e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
        });
    }
}

async function handlePhoneLogin() {
    const phone = document.getElementById('login-phone').value.trim();
    if (phone.length < 14) {
        showToast("Insira um WhatsApp válido.", "error");
        return;
    }
    localStorage.setItem('user_phone', phone);
    await loadOrdersFromAPI(phone);
}

async function loadOrdersFromAPI(phone) {
    if (!phone) return;
    container.innerHTML = '<p style="text-align: center; margin-top: 2rem; color: #999;">Buscando seus pedidos...</p>';
    try {
        const phoneClean = phone.replace(/\D/g, '');
        const resp = await fetch(`${APPSCRIPT_URL}?action=getOrdersByPhone&phone=${phoneClean}`);
        const result = await resp.json();

        if (result.status === "success" && result.data && result.data.length > 0) {
            container.innerHTML = "";
            result.data.forEach(order => {
                renderOrderCard(order, container);
            });
        } else {
            container.innerHTML = `
                <div class='empty-state'>
                    <i class='bx bx-shopping-bag'></i>
                    <h3>Nenhum pedido encontrado</h3>
                    <p>Não encontramos pedidos para o número ${phone}.</p>
                    <button onclick="localStorage.removeItem('user_phone'); location.reload();" 
                        style="background:none; border:none; color:var(--color-brand-red); text-decoration:underline; font-size:0.8rem; margin-top:10px; cursor:pointer;">
                        Tentar outro número
                    </button>
                </div>`;
        }
    } catch (e) {
        console.error(e);
        container.innerHTML = "<p style='text-align:center; color:red; margin-top:20px;'>Erro ao carregar pedidos.</p>";
    }
}


function renderOrderCard(order, container) {
    const firstItem = order.items && order.items.length > 0
        ? order.items[0]
        : { name: 'Pedido Diversos', image: 'https://placehold.co/70' };

    let date = '--/--/----';
    if (order.createdAt) {
        let d = order.createdAt;
        if (d.toDate) d = d.toDate(); // Firebase
        else d = new Date(d); // String ou Date object

        if (!isNaN(d.getTime())) {
            date = d.toLocaleDateString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });
        }
    }


    // Verifica se é Retirada ou Entrega
    const isPickup = order.shipping && order.shipping.mode === 'pickup';

    // --- LÓGICA DE REEMBOLSO (Mantida) ---
    let refundHtml = '';
    // ... (Mantenha o código de reembolso igual ao anterior se quiser, ou eu posso reenviar) ...
    // Vou pular o bloco de reembolso aqui para focar na mudança, mas mantenha ele no seu arquivo.

    let statusClass = 'status-pending';
    let statusLabel = 'Processando';
    let showPixButton = false;
    let showTracking = false;
    let canDelete = true;

    // Variáveis Rastreio
    let step1Active = false, step2Active = false, step3Active = false;
    let showTruckAnimation = false;
    let showPickupAnimation = false; // Nova animação/icone estático

    // Textos Dinâmicos
    const textStep2 = isPickup ? "Pronto para Retirada" : "Saiu para entrega";
    const descStep2 = isPickup ? "Seu pedido já está disponível na loja escolhida." : "Seu pedido está chegando! O motorista está a caminho.";
    const textStep3 = isPickup ? "Retirado" : "Entregue";
    const descStep3 = isPickup ? "Pedido retirado com sucesso." : "O pedido foi entregue com sucesso.";
    const iconStep2 = isPickup ? "bx-store" : "bxs-truck";

    const st = (order.status || 'Pendente').toLowerCase();

    switch (st) {
        case 'aprovado':
        case 'pago':
        case 'approved':
        case 'paid':
        case 'preparation':
            statusClass = 'status-approved';
            statusLabel = 'Aprovado';
            showTracking = true;
            step1Active = true;
            canDelete = false;
            break;

        case 'enviado':
        case 'shipped':
        case 'saiu para entrega':
            statusClass = 'status-approved';
            statusLabel = isPickup ? 'Disponível na Loja' : 'Em Transporte';
            showTracking = true;
            step1Active = true;
            step2Active = true;
            if (isPickup) {
                showPickupAnimation = true;
            } else {
                showTruckAnimation = true;
            }
            canDelete = false;
            break;

        case 'entregue':
        case 'delivered':
        case 'concluído':
            statusClass = 'status-approved';
            statusLabel = isPickup ? 'Retirado' : 'Entregue';
            showTracking = true;
            step1Active = true;
            step2Active = true;
            step3Active = true;
            canDelete = false;
            break;

        case 'pendente':
        case 'pending':
        case 'pending_payment':
        case 'in_process':
        case 'aguardando':
            statusClass = 'status-pending';
            statusLabel = 'Aguardando Pagamento';
            if (order.paymentData && (order.paymentData.qr_code || order.paymentData.qr_code_base64)) {
                showPixButton = true;
            }
            canDelete = true;
            break;

        case 'cancelado':
        case 'rejected':
        case 'cancelled':
        case 'failed':
            statusClass = 'status-cancelled';
            statusLabel = 'Cancelado';
            canDelete = true;
            break;

        default:
            statusLabel = order.status || 'Verificando';

    }

    const pixActionHtml = showPixButton
        ? `<button class="btn-pix-action" onclick="openPixModal('${order.id}')"><i class='bx bx-qr-scan'></i> Pagar com Pix</button>`
        : ``;

    const deleteBtnHtml = canDelete
        ? `<button class="btn-delete-order" onclick="deleteOrder('${order.id}')" title="Remover"><i class='bx bx-trash'></i></button>`
        : ``;

    // HTML do Rastreamento
    let trackingHtml = '';
    if (showTracking) {
        const s1Class = step1Active ? (step2Active ? 'completed' : 'active') : '';
        const s2Class = step2Active ? (step3Active ? 'completed' : 'active') : '';
        const s3Class = step3Active ? 'active' : '';

        // Animação: Caminhão (Entrega) OU Loja (Retirada)
        let animationArea = '';
        if (showTruckAnimation) {
            animationArea = `
            <div class="truck-animation-container">
                <div class="road-line"></div>
                <i class='bx bxs-truck moving-truck'></i>
            </div>`;
        } else if (showPickupAnimation) {
            // Um alerta visual verde simples para retirada
            animationArea = `
            <div style="background:#d1fae5; color:#065f46; padding:10px; border-radius:8px; margin-top:15px; display:flex; align-items:center; gap:10px;">
                <i class='bx bxs-store' style="font-size:1.5rem;"></i>
                <strong>Oba! Seu pedido já pode ser retirado na loja.</strong>
            </div>`;
        }

        trackingHtml = `
            <div class="tracking-section">
                <div class="tracking-title">Acompanhe seu pedido</div>
                ${animationArea}
                <div class="tracking-steps" style="${(showTruckAnimation || showPickupAnimation) ? 'margin-top:15px;' : ''}">
                    <div class="step-item ${s1Class}">
                        <div class="step-icon"><i class='bx bx-package'></i></div>
                        <div class="step-content"><h5>Em separação</h5><p>Seu pedido está sendo separado.</p></div>
                    </div>
                    <div class="step-item ${s2Class}">
                        <div class="step-icon"><i class='bx ${iconStep2}'></i></div>
                        <div class="step-content"><h5>${textStep2}</h5><p>${descStep2}</p></div>
                    </div>
                    <div class="step-item ${s3Class}">
                        <div class="step-icon"><i class='bx bx-check-circle'></i></div>
                        <div class="step-content"><h5>${textStep3}</h5><p>${descStep3}</p></div>
                    </div>
                </div>
            </div>
        `;
    }

    const cardHtml = `
        <div class="order-card-modern">
            <div class="card-header">
                <div class="order-date"><i class='bx bx-calendar'></i> ${date}</div>
                <span class="status-badge ${statusClass}">${statusLabel}</span>
            </div>
            <div class="card-body">
                <img src="${firstItem.image}" alt="Produto" class="product-thumb" onerror="this.src='https://placehold.co/70x70?text=Produto'">
                <div class="product-info">
                    <h4 class="product-name">${firstItem.name}</h4>
                    <div class="product-total">Total: <strong>${typeof order.total === 'number' ? 'R$ ' + order.total.toFixed(2).replace('.', ',') : order.total}</strong></div>
                </div>
            </div>
            ${refundHtml || ''} 
            ${trackingHtml}
            <div class="card-footer">
                ${pixActionHtml ? pixActionHtml : '<div style="flex:1"></div>'}
                ${deleteBtnHtml}
            </div>
        </div>
    `;

    container.innerHTML += cardHtml;
}

// --- FUNÇÕES DE AÇÃO ---

window.deleteOrder = async (orderId) => {
    if (confirm("Deseja remover este pedido do histórico?")) {
        showToast("Remoção temporariamente indisponível.", "info");
    }
};

window.openPixModal = (orderId) => {
    showToast("Acesse o PIX via e-mail ou WhatsApp do vendedor.", "info");
};

window.copyPixCode = () => {
    const input = document.getElementById("pix-code-text");
    if (input) {
        input.select();
        document.execCommand("copy");
        showToast("Código Copiado!", "success");
    }
};

window.closePixModal = () => {
    document.getElementById("pix-display-area").style.display = "none";
};