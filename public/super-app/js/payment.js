// js/payment.js

const mp = new MercadoPago(MP_PUBLIC_KEY);
let paymentBrickController;

document.addEventListener("DOMContentLoaded", () => {
    setupCheckoutSteps();
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
            document.getElementById("step-shipping").classList.remove("active");
            document.getElementById("step-payment").classList.add("active");
            document.getElementById("step-indic-2").classList.add("active"); 
            await initPaymentBrick();
        });
    }
}

async function initPaymentBrick() {
    const cart = CartManager.get();
    const total = CartManager.total();
    
    // Tratamento de email do usuário
    const user = auth.currentUser;
    // Se não tiver email (login google as vezes demora), usa um fallback válido
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
                payer: {
                    email: userEmail,
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
                    // CÓPIA LIMPA DO DADO
                    const finalData = { ...formData };
                    
                    // Injeção forçada de dados do pagador
                    if (!finalData.payer) finalData.payer = {};
                    finalData.payer.email = userEmail;
                    finalData.payer.first_name = userName.split(' ')[0];
                    finalData.payer.last_name = userName.split(' ').slice(1).join(' ') || 'Cliente';
                    finalData.payer.entity_type = 'individual';
                    finalData.payer.type = 'customer';
                    
                    // LOG NO NAVEGADOR PARA VOCÊ CONFERIR
                    console.log("Enviando para Backend:", finalData);

                    return new Promise((resolve, reject) => {
                        fetch(API_URLS.CREATE_PAYMENT, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                // Envia como payment_data para o backend pegar
                                payment_data: finalData,
                                orderId: data.orderId,
                                // NÃO enviamos mais preferenceId aqui, pois o backend não precisa 
                                // e se ele tentar usar, da erro no MP.
                            })
                        })
                        .then(res => {
                            if(!res.ok) {
                                return res.json().then(err => { throw err; });
                            }
                            return res.json();
                        })
                        .then(result => {
                            console.log("Sucesso:", result);
                            CartManager.clear();
                            window.location.href = "pedidos.html"; 
                            resolve();
                        })
                        .catch(error => {
                            console.error("Erro Backend:", error);
                            // Mostra erro na tela se possível, ou genérico
                            const msg = error.message || "Erro ao processar pagamento";
                            showToast("Erro: " + msg, "error");
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
        showToast("Erro ao iniciar sistema de pagamento.", "error");
    }
}