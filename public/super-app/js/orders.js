// js/orders.js

document.addEventListener('userReady', (e) => {
    const user = e.detail;
    const container = document.getElementById("orders-list");
    
    if (!container) return;

    if (!user || user.isAnonymous) {
        container.innerHTML = `
            <div class='empty-state'>
                <i class='bx bx-user-circle'></i>
                <h3>Faça Login</h3>
                <p>Acesse sua conta para visualizar o histórico.</p>
            </div>`;
        return;
    }

    // Listener em tempo real do Firebase
    db.collection("orders")
      .where("userId", "==", user.uid)
      .orderBy("createdAt", "desc")
      .onSnapshot(snapshot => {
          if (snapshot.empty) {
              container.innerHTML = `
                <div class='empty-state'>
                    <i class='bx bx-shopping-bag'></i>
                    <h3>Nenhum pedido ainda</h3>
                    <p>Seus pedidos aparecerão aqui.</p>
                </div>`;
              return;
          }
          
          container.innerHTML = "";
          
          snapshot.forEach(doc => {
              const order = { id: doc.id, ...doc.data() };
              renderOrderCard(order, container);
          });
      }, error => {
          console.error("Erro ao buscar pedidos:", error);
          container.innerHTML = "<p style='text-align:center; color:red; margin-top:20px;'>Erro de conexão.</p>";
      });
});

function renderOrderCard(order, container) {
    const firstItem = order.items && order.items.length > 0 
        ? order.items[0] 
        : { name: 'Pedido Diversos', image: 'https://placehold.co/70' };
    
    let date = '--/--/----';
    if (order.createdAt && order.createdAt.toDate) {
        date = order.createdAt.toDate().toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit'
        });
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

    switch(order.status) {
        case 'approved': 
        case 'preparation': 
            statusClass = 'status-approved'; 
            statusLabel = 'Aprovado';
            showTracking = true;
            step1Active = true; 
            canDelete = false; 
            break;
        
        case 'shipped': 
            statusClass = 'status-approved'; 
            statusLabel = isPickup ? 'Disponível na Loja' : 'Em Transporte';
            showTracking = true;
            step1Active = true; 
            step2Active = true; 
            if(isPickup) {
                showPickupAnimation = true; // Mostra algo estático ou ícone de loja
            } else {
                showTruckAnimation = true; // Mostra caminhão
            }
            canDelete = false; 
            break;

        case 'delivered': 
            statusClass = 'status-approved';
            statusLabel = isPickup ? 'Retirado' : 'Entregue';
            showTracking = true;
            step1Active = true;
            step2Active = true;
            step3Active = true; 
            canDelete = false; 
            break;
            
        case 'pending':
        case 'pending_payment':
        case 'in_process':
            statusClass = 'status-pending'; 
            statusLabel = 'Aguardando Pagamento';
            if (order.paymentData && (order.paymentData.qr_code || order.paymentData.qr_code_base64)) {
                 showPixButton = true;
            }
            canDelete = true; 
            break;

        case 'rejected':
        case 'cancelled':
        case 'failed': 
            statusClass = 'status-cancelled'; 
            statusLabel = 'Cancelado';
            canDelete = true;
            break;
            
        default:
            statusLabel = order.statusText || 'Verificando';
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
                <img src="${firstItem.image}" alt="Produto" class="product-thumb">
                <div class="product-info">
                    <h4 class="product-name">${firstItem.name}</h4>
                    <div class="product-total">Total: <strong>R$ ${order.total.toFixed(2).replace('.', ',')}</strong></div>
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
    // Usando confirm nativo ou substitua por modal customizado se preferir
    if (confirm("Deseja remover este pedido do histórico?")) {
        try {
            await db.collection("orders").doc(orderId).delete();
            showToast("Pedido removido.", "success");
        } catch (error) {
            console.error("Erro ao excluir:", error);
            showToast("Erro ao processar.", "error");
        }
    }
};

window.openPixModal = async (orderId) => {
    try {
        const doc = await db.collection("orders").doc(orderId).get();
        if (!doc.exists) return;
        
        const order = doc.data();
        
        if (order.paymentData && order.paymentData.qr_code_base64) {
            const pixArea = document.getElementById("pix-display-area");
            const pixImg = document.getElementById("pix-qr-img");
            const pixInput = document.getElementById("pix-code-text");
            
            if (pixArea) {
                // Injeta a imagem
                pixImg.innerHTML = `<img src="data:image/png;base64, ${order.paymentData.qr_code_base64}" alt="QR Code Pix">`;
                // Coloca o código copia e cola no input
                pixInput.value = order.paymentData.qr_code;
                // Mostra o modal (usando flex para centralizar)
                pixArea.style.display = "flex"; 
            }
        } else {
            showToast("QR Code não disponível.", "error");
        }
    } catch (e) {
        console.error(e);
        showToast("Erro ao abrir PIX.", "error");
    }
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