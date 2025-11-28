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
    // Tratamento de Imagem e Nome
    const firstItem = order.items && order.items.length > 0 
        ? order.items[0] 
        : { name: 'Pedido Diversos', image: 'https://placehold.co/70' };
    
    // Tratamento de Data
    let date = '--/--/----';
    if (order.createdAt && order.createdAt.toDate) {
        date = order.createdAt.toDate().toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit'
        });
    }

    let statusClass = 'status-pending'; 
    let statusLabel = 'Processando';
    let showPixButton = false;
    let showTracking = false;
    
    // Variáveis para controlar qual etapa do rastreio está ativa
    let step1Active = false, step2Active = false, step3Active = false;
    // Variável para a animação do caminhão
    let showTruckAnimation = false;

    // Lógica de Status
    switch(order.status) {
        case 'approved': 
            statusClass = 'status-approved'; 
            statusLabel = 'Aprovado';
            showTracking = true;
            step1Active = true; // Separando
            break;
        
        case 'shipped': // Novo status para "Saiu para entrega"
            statusClass = 'status-approved'; // Visualmente verde
            statusLabel = 'Em Transporte';
            showTracking = true;
            step1Active = true; 
            step2Active = true; // Caminhão
            showTruckAnimation = true; // ATIVA O CAMINHÃO
            break;

        case 'delivered': // Novo status para "Entregue"
            statusClass = 'status-approved';
            statusLabel = 'Entregue';
            showTracking = true;
            step1Active = true;
            step2Active = true;
            step3Active = true; // Entregue
            break;
            
        case 'pending':
        case 'pending_payment':
        case 'in_process':
            statusClass = 'status-pending'; 
            statusLabel = 'Aguardando Pagamento';
            if (order.paymentData && (order.paymentData.qr_code || order.paymentData.qr_code_base64)) {
                 showPixButton = true;
            }
            break;

        case 'rejected':
        case 'cancelled':
        case 'failed': 
            statusClass = 'status-cancelled'; 
            statusLabel = 'Cancelado';
            break;
            
        default:
            statusLabel = order.statusText || 'Verificando';
    }

    // HTML do Botão Pix (se necessário)
    const pixActionHtml = showPixButton 
        ? `<button class="btn-pix-action" onclick="openPixModal('${order.id}')">
             <i class='bx bx-qr-scan'></i> Pagar com Pix
           </button>` 
        : ``; 

    // HTML do Rastreamento (Só aparece se showTracking = true)
    let trackingHtml = '';
    
    if (showTracking) {
        // Define as classes para colorir os steps
        const s1Class = step1Active ? (step2Active ? 'completed' : 'active') : '';
        const s2Class = step2Active ? (step3Active ? 'completed' : 'active') : '';
        const s3Class = step3Active ? 'active' : '';

        // Se o caminhão estiver ativo, adiciona o HTML dele
        const truckHtml = showTruckAnimation ? `
            <div class="truck-animation-container">
                <div class="road-line"></div>
                <i class='bx bxs-truck moving-truck'></i>
            </div>
        ` : '';

        trackingHtml = `
            <div class="tracking-section">
                <div class="tracking-title">Acompanhe seu pedido</div>
                
                ${truckHtml}

                <div class="tracking-steps" style="${showTruckAnimation ? 'margin-top:15px;' : ''}">
                    <div class="step-item ${s1Class}">
                        <div class="step-icon"><i class='bx bx-package'></i></div>
                        <div class="step-content">
                            <h5>Em separação</h5>
                            <p>Seu pedido está sendo separado por nossos vendedores.</p>
                        </div>
                    </div>

                    <div class="step-item ${s2Class}">
                        <div class="step-icon"><i class='bx bxs-truck'></i></div>
                        <div class="step-content">
                            <h5>Saiu para entrega</h5>
                            <p>Seu pedido está chegando! O motorista está a caminho.</p>
                        </div>
                    </div>

                    <div class="step-item ${s3Class}">
                        <div class="step-icon"><i class='bx bx-home-smile'></i></div>
                        <div class="step-content">
                            <h5>Entregue</h5>
                            <p>O pedido foi entregue com sucesso.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Template Final
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
            
            ${trackingHtml}

            <div class="card-footer">
                ${pixActionHtml ? pixActionHtml : '<div style="flex:1"></div>'}
                <button class="btn-delete-order" onclick="deleteOrder('${order.id}')" title="Remover do histórico">
                    <i class='bx bx-trash'></i>
                </button>
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