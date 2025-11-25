// js/payment.js

const mp = new MercadoPago(MP_PUBLIC_KEY);
let paymentBrickController;

document.addEventListener("DOMContentLoaded", () => {
    setupCheckoutSteps();
    setupPixEvents(); // Configura o botão de copiar e finalizar
});

function setupCheckoutSteps() {
    const btnGoPayment = document.getElementById("btn-go-payment");
    if (btnGoPayment) {
        btnGoPayment.addEventListener("click", async () => {
            const cepInput = document.getElementById("cep");
            if (cepInput && !cepInput.value) {
                showToast("Por favor, preencha o CEP", "error");
                return;
            }
            // Avança para tela do Brick
            document.getElementById("step-shipping").classList.remove("active");
            document.getElementById("step-payment").classList.add("active");
            document.getElementById("step-indic-2").classList.add("active"); 
            await initPaymentBrick();
        });
    }
}

function setupPixEvents() {
    // Botão Copiar Código
    const btnCopy = document.getElementById("btn-copy-pix");
    if (btnCopy) {
        btnCopy.addEventListener("click", () => {
            const input = document.getElementById("display-pix-copypaste");
            input.select();
            document.execCommand("copy");
            showToast("Código PIX copiado!", "success");
        });
    }

    // Botão "Pagamento Feito" (Redireciona para Pedidos)
    const btnFinish = document.getElementById("btn-finish-pix");
    if (btnFinish) {
        btnFinish.addEventListener("click", () => {
            window.location.href = "pedidos.html";
        });
    }
}

async function initPaymentBrick() {
    const cart = CartManager.get();
    const total = CartManager.total();
    
    // Usuário
    const user = auth.currentUser;
    const userEmail = (user && user.email) ? user.email : "cliente_guest@eletrobusiness.com.br";
    const userName = (user && user.displayName) ? user.displayName : "Cliente Eletro";

    const displayTotal = document.getElementById("payment-total-display");
    if(displayTotal) displayTotal.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;

    try {
        // 1. Cria Preferência
        const response = await fetch(API_URLS.CREATE_PREFERENCE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                price: total, 
                items: cart, 
                userId: user ? user.uid : 'guest' 
            }),
        });
        
        if (!response.ok) throw new Error("Erro ao criar preferência");
        const data = await response.json(); 
        
        // 2. Monta o Brick
        const builder = mp.bricks();
        const settings = {
            initialization: {
                amount: total,
                preferenceId: data.preferenceId,
                payer: { email: userEmail },
            },
            customization: {
                paymentMethods: {
                    bankTransfer: "all",
                    creditCard: "all",
                    mercadoPago: "all", 
                },
                visual: {
                    style: { theme: 'light' },
                    hidePaymentButton: false
                }
            },
            callbacks: {
                onReady: () => {
                    const loading = document.getElementById("brick-loading-message");
                    if (loading) loading.style.display = 'none';
                },
                onSubmit: ({ formData }) => {
                    // Prepara dados
                    const finalData = { ...formData };
                    if (!finalData.payer) finalData.payer = {};
                    finalData.payer.email = userEmail;
                    finalData.payer.first_name = userName.split(' ')[0];
                    finalData.payer.last_name = userName.split(' ').slice(1).join(' ') || 'Cliente';
                    finalData.payer.entity_type = 'individual';
                    finalData.payer.type = 'customer';
                    
                    console.log("Enviando Pagamento...", finalData);

                    return new Promise((resolve, reject) => {
                        fetch(API_URLS.CREATE_PAYMENT, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                payment_data: finalData,
                                orderId: data.orderId
                            })
                        })
                        .then(res => {
                            if(!res.ok) return res.json().then(err => { throw err; });
                            return res.json();
                        })
                        .then(paymentResult => {
                            console.log("Resultado Pagamento:", paymentResult);
                            CartManager.clear();

                            // LÓGICA DE DECISÃO (PIX vs CARTÃO)
                            if (paymentResult.status === 'pending' && paymentResult.point_of_interaction) {
                                // É PIX! Mostrar tela de QR Code
                                showPixScreen(paymentResult);
                                resolve(); // Resolve a promise do Brick (para loading parar)
                            } else {
                                // É Cartão Aprovado (ou outro status final), redireciona direto
                                window.location.href = "pedidos.html"; 
                                resolve();
                            }
                        })
                        .catch(error => {
                            console.error("Erro Backend:", error);
                            showToast("Erro ao processar pagamento.", "error");
                            reject();
                        });
                    });
                },
                onError: (error) => {
                    console.error("Erro Brick:", error);
                    showToast("Erro no formulário", "error");
                },
            },
        };

        paymentBrickController = await builder.create("payment", "payment-brick-container", settings);

    } catch (e) {
        console.error("Erro fatal:", e);
        showToast("Erro ao iniciar sistema.", "error");
    }
}

// Função para exibir a tela de PIX sem sair da página
function showPixScreen(paymentResult) {
    const qrCodeBase64 = paymentResult.point_of_interaction.transaction_data.qr_code_base64;
    const qrCodeCopy = paymentResult.point_of_interaction.transaction_data.qr_code;

    // Preenche os elementos
    document.getElementById("display-pix-qr").src = `data:image/png;base64,${qrCodeBase64}`;
    document.getElementById("display-pix-copypaste").value = qrCodeCopy;

    // Troca a visualização
    document.getElementById("checkout-stepper").style.display = 'none'; // Esconde stepper opcionalmente
    document.getElementById("step-payment").style.display = 'none'; // Esconde Brick
    document.getElementById("step-pix-result").style.display = 'block'; // Mostra PIX
    
    // Scroll para o topo
    window.scrollTo({ top: 0, behavior: 'smooth' });
}