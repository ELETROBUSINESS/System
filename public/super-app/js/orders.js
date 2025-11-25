// js/orders.js

document.addEventListener('userReady', (e) => {
    const user = e.detail;
    const container = document.getElementById("orders-list");
    
    if (!container) return;

    if (!user || user.isAnonymous) {
        container.innerHTML = `
            <div class='cart-empty'>
                <i class='bx bx-user-circle' style='font-size: 3rem; color:#ccc;'></i>
                <h3 style="margin-top:1rem;">Faça login</h3>
                <p style="color:#666;">Entre com sua conta para ver seus pedidos.</p>
            </div>`;
        return;
    }

    // Listener em tempo real
    db.collection("orders")
      .where("userId", "==", user.uid)
      .orderBy("createdAt", "desc")
      .onSnapshot(snapshot => {
          if (snapshot.empty) {
              container.innerHTML = `
                <div class='cart-empty'>
                    <i class='bx bx-shopping-bag' style='font-size: 3rem; color:#ccc;'></i>
                    <h3 style="margin-top:1rem;">Nenhum pedido encontrado.</h3>
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
          container.innerHTML = "<p style='text-align:center; margin-top:2rem;'>Erro ao carregar pedidos.</p>";
      });
});

function renderOrderCard(order, container) {
    const firstItem = order.items && order.items.length > 0 ? order.items[0] : { name: 'Produto', image: 'https://placehold.co/60' };
    
    // Tratamento de data seguro
    let date = 'Data recente';
    if (order.createdAt && order.createdAt.toDate) {
        date = order.createdAt.toDate().toLocaleDateString('pt-BR');
    }

    let statusClass = '';
    let statusLabel = '';
    let actionsHtml = '';

    // --- LÓGICA DE STATUS ---
    switch(order.status) {
        case 'approved': 
            statusClass = 'status-approved'; // Verde (style.css)
            statusLabel = 'Preparando Pedido';
            break;
            
        case 'pending':          // Retorno padrão do MP para Pix
        case 'pending_payment':  // Retorno do nosso backend inicial
        case 'in_process':
            statusClass = 'status-pending_payment'; // Amarelo/Laranja (style.css)
            statusLabel = 'Aguardando Pagamento';
            
            // Verifica se tem dados de Pix para mostrar o botão
            if (order.paymentData && (order.paymentData.qr_code || order.paymentData.qr_code_base64)) {
                 actionsHtml = `<button class="cta-button retry-payment-button" onclick="openPixModal('${order.id}')" style="font-size:0.9rem; padding:0.5rem;">Ver QR Code</button>`;
            }
            break;

        case 'rejected':
        case 'cancelled':
        case 'failed': 
            statusClass = 'status-failed'; // Vermelho
            statusLabel = 'Cancelado';
            break;

        default: 
            statusClass = 'status-processing'; // Azul
            statusLabel = order.statusText || 'Processando';
    }

    const cardHtml = `
        <div class="order-card">
            <div class="order-header">
                <span class="order-date">${date}</span>
                <span class="order-status ${statusClass}">${statusLabel}</span>
            </div>
            <div class="order-body">
                <div class="order-item-preview">
                    <img src="${firstItem.image}" alt="Imagem" style="background:#fff;">
                    <div class="order-item-info">
                        <h4>${firstItem.name}</h4>
                        <p>Total: <strong>R$ ${order.total.toFixed(2).replace('.', ',')}</strong></p>
                    </div>
                </div>
            </div>
            ${actionsHtml ? `<div class="order-footer"><div class="order-actions" style="width:100%;">${actionsHtml}</div></div>` : ''}
        </div>
    `;
    
    container.innerHTML += cardHtml;
}

// --- FUNÇÕES GLOBAIS DE SUPORTE ---

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
                // CORREÇÃO: Usamos 'flex' para ativar o alinhamento central do CSS
                pixArea.style.display = "flex"; 
                
                pixImg.innerHTML = `<img src="data:image/png;base64, ${order.paymentData.qr_code_base64}" alt="QR Code Pix">`;
                pixInput.value = order.paymentData.qr_code;
                
                // Removemos o scrollIntoView pois agora é um modal fixo na tela
                // pixArea.scrollIntoView(...); 
            }
        } else {
            showToast("QR Code expirado ou indisponível.", "error");
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