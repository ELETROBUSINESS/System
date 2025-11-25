// js/orders.js

// Ouve o evento customizado disparado pelo global.js quando o Auth carrega
document.addEventListener('userReady', (e) => {
    const user = e.detail;
    const container = document.getElementById("orders-list");
    
    if (!container) return;

    if (!user || user.isAnonymous) {
        container.innerHTML = `
            <div class='cart-empty'>
                <i class='bx bx-user-circle' style='font-size: 3rem;'></i>
                <h3>Faça login</h3>
                <p>Entre com sua conta para ver seus pedidos.</p>
            </div>`;
        return;
    }

    // Listener em tempo real do Firestore
    db.collection("orders")
      .where("userId", "==", user.uid)
      .orderBy("createdAt", "desc")
      .onSnapshot(snapshot => {
          if (snapshot.empty) {
              container.innerHTML = `
                <div class='cart-empty'>
                    <i class='bx bx-shopping-bag' style='font-size: 3rem;'></i>
                    <h3>Nenhum pedido encontrado.</h3>
                </div>`;
              return;
          }
          
          container.innerHTML = ""; // Limpa lista atual
          
          snapshot.forEach(doc => {
              const order = { id: doc.id, ...doc.data() };
              renderOrderCard(order, container);
          });
      }, error => {
          console.error("Erro ao buscar pedidos:", error);
          container.innerHTML = "<p>Erro ao carregar pedidos.</p>";
      });
});

function renderOrderCard(order, container) {
    // Garante que existe item para exibir imagem
    const firstItem = order.items && order.items.length > 0 ? order.items[0] : { name: 'Produto', image: 'https://placehold.co/60' };
    const date = order.createdAt ? order.createdAt.toDate().toLocaleDateString('pt-BR') : 'Data recente';
    
    // Variáveis de controle
    let statusClass = '';
    let statusLabel = '';
    let actionsHtml = '';

    // --- LÓGICA DE STATUS UNIFICADA ---
    switch(order.status) {
        // PAGAMENTO APROVADO
        case 'approved': 
            statusClass = 'status-approved'; 
            statusLabel = 'Preparando Pedido'; // Texto solicitado
            break;
            
        // PAGAMENTO PENDENTE (Pix gerado ou Processando)
        case 'pending':          // Status padrão do MP
        case 'pending_payment':  // Status interno nosso
        case 'in_process':       // Status de análise do MP
            statusClass = 'status-pending_payment'; // Cor Laranja/Amarela
            statusLabel = 'Aguardando Pagamento';
            
            // Só mostra o botão se tivermos o QR Code salvo no banco
            if (order.paymentData && (order.paymentData.qr_code || order.paymentData.qr_code_base64)) {
                 actionsHtml = `<button class="cta-button retry-payment-button" onclick="openPixModal('${order.id}')">Ver QR Code</button>`;
            }
            break;

        // PAGAMENTO FALHOU / CANCELADO
        case 'rejected':
        case 'cancelled':
        case 'failed': 
            statusClass = 'status-failed'; 
            statusLabel = 'Cancelado/Recusado';
            break;

        // DEFAULT (Caso venha algo novo)
        default: 
            statusClass = 'status-processing';
            statusLabel = order.statusText || 'Processando';
    }

    // Monta o HTML do Card
    const cardHtml = `
        <div class="order-card">
            <div class="order-header">
                <span class="order-date">${date}</span>
                <span class="order-status ${statusClass}">${statusLabel}</span>
            </div>
            <div class="order-body">
                <div class="order-item-preview">
                    <img src="${firstItem.image}" alt="Imagem do Produto">
                    <div class="order-item-info">
                        <h4>${firstItem.name}</h4>
                        <p>Total: <strong>R$ ${order.total.toFixed(2).replace('.', ',')}</strong></p>
                    </div>
                </div>
            </div>
            ${actionsHtml ? `<div class="order-footer"><div class="order-actions">${actionsHtml}</div></div>` : ''}
        </div>
    `;
    
    container.innerHTML += cardHtml;
}

// --- Funções Auxiliares (Pix) ---

// Torna global para ser acessada pelo onclick do HTML gerado acima
window.openPixModal = async (orderId) => {
    try {
        const doc = await db.collection("orders").doc(orderId).get();
        if (!doc.exists) return;
        
        const order = doc.data();
        
        if (order.paymentData && order.paymentData.qr_code && order.paymentData.qr_code_base64) {
            // Exibe a área de Pix (definida no HTML do pedidos.html)
            const pixArea = document.getElementById("pix-display-area");
            const pixImg = document.getElementById("pix-qr-img");
            const pixInput = document.getElementById("pix-code-text");
            
            if (pixArea) {
                pixArea.style.display = "block";
                pixImg.innerHTML = `<img src="data:image/png;base64, ${order.paymentData.qr_code_base64}" style="max-width:200px; display:block; margin:0 auto;">`;
                pixInput.value = order.paymentData.qr_code;
                
                // Scroll para ver o Pix
                pixArea.scrollIntoView({ behavior: 'smooth' });
            }
        } else {
            showToast("Código PIX indisponível ou expirado.", "error");
        }
    } catch (e) {
        console.error(e);
        showToast("Erro ao abrir PIX.", "error");
    }
};

// Função para copiar o código
window.copyPixCode = () => {
    const input = document.getElementById("pix-code-text");
    if (input) {
        input.select();
        document.execCommand("copy");
        showToast("Código Copiado!", "success");
    }
};