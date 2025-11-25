// js/payment.js

// Inicializa o SDK
const mp = new MercadoPago(MP_PUBLIC_KEY);
let paymentBrickController;

document.addEventListener("DOMContentLoaded", () => {
    setupCheckoutSteps();
});

function setupCheckoutSteps() {
    const btnGoPayment = document.getElementById("btn-go-payment");
    
    if (btnGoPayment) {
        btnGoPayment.addEventListener("click", async () => {
            // 1. Validação do CEP
            const cepInput = document.getElementById("cep");
            if (cepInput && !cepInput.value) {
                showToast("Por favor, preencha o CEP", "error");
                return;
            }

            // 2. Transição de tela
            document.getElementById("step-shipping").classList.remove("active");
            document.getElementById("step-payment").classList.add("active");
            document.getElementById("step-indic-2").classList.add("active"); 
            
            // 3. Inicia o Brick
            await initPaymentBrick();
        });
    }
}

async function initPaymentBrick() {
    const cart = CartManager.get();
    const total = CartManager.total();
    
    // Pega o usuário logado
    const user = auth.currentUser;
    const userEmail = (user && user.email) ? user.email : "cliente@eletrobusiness.com.br";

    const displayTotal = document.getElementById("payment-total-display");
    if(displayTotal) displayTotal.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;

    try {
        // A. Cria Preferência no Backend
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
        
        // B. Configurações do Brick
        const builder = mp.bricks();
        const settings = {
            initialization: {
                amount: total,
                preferenceId: data.preferenceId,
                payer: {
                    email: userEmail,
                    // REMOVIDO entity_type daqui para sumir o aviso amarelo.
                    // Ele será injetado apenas na hora de pagar.
                },
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
                    // [CORREÇÃO CRÍTICA]
                    // Criamos uma COPIA LIMPA do objeto para não quebrar a referência do SDK
                    const cleanFormData = { ...formData };

                    // Garante a estrutura do Payer
                    if (!cleanFormData.payer) cleanFormData.payer = {};
                    
                    // Preenche os dados obrigatórios para evitar erro 500
                    cleanFormData.payer.email = userEmail;
                    cleanFormData.payer.entity_type = 'individual';
                    cleanFormData.payer.type = 'customer';
                    cleanFormData.payer.first_name = user && user.displayName ? user.displayName.split(' ')[0] : 'Cliente';
                    
                    console.log("Payload enviado:", cleanFormData); // Debug

                    return new Promise((resolve, reject) => {
                        fetch(API_URLS.CREATE_PAYMENT, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                formData: cleanFormData, // Envia o objeto limpo
                                orderId: data.orderId,
                                preferenceId: data.preferenceId
                            })
                        })
                        .then(res => {
                            if(!res.ok) {
                                return res.json().then(err => { throw err; });
                            }
                            return res.json();
                        })
                        .then(result => {
                            CartManager.clear();
                            window.location.href = "pedidos.html"; 
                            resolve();
                        })
                        .catch(error => {
                            console.error("Erro detalhado do backend:", error);
                            showToast("Erro ao processar pagamento. Tente novamente.", "error");
                            reject();
                        });
                    });
                },
                onError: (error) => {
                    console.error("Erro no Brick:", error);
                    showToast("Erro no formulário de pagamento", "error");
                },
            },
        };

        // Renderiza o Brick
        paymentBrickController = await builder.create("payment", "payment-brick-container", settings);

    } catch (e) {
        console.error("Erro fatal no checkout:", e);
        showToast("Erro ao carregar pagamentos.", "error");
        
        document.getElementById("step-shipping").classList.add("active");
        document.getElementById("step-payment").classList.remove("active");
    }
}