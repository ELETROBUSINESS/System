// js/login.js

document.addEventListener("DOMContentLoaded", () => {
    const loginBtn = document.getElementById("page-login-google");

    // Se o usuário já estiver logado (ex: acessou a pág por engano), redireciona
    document.addEventListener('userReady', (e) => {
        const user = e.detail;
        if (user && !user.isAnonymous) {
            // Verifica se tem instrução de retorno na URL ou vai pro padrão
            redirectUser();
        }
    });

    if (loginBtn) {
        loginBtn.addEventListener("click", () => {
            const provider = new firebase.auth.GoogleAuthProvider();
            
            // Força o prompt de seleção de conta para garantir que o usuário escolha
            provider.setCustomParameters({
                prompt: 'select_account'
            });

            auth.signInWithPopup(provider)
                .then((result) => {
                    showToast("Login realizado com sucesso!", "success");
                    setTimeout(redirectUser, 1000);
                })
                .catch((error) => {
                    console.error("Erro no login:", error);
                    showToast("Não foi possível fazer login.", "error");
                });
        });
    }
});

function redirectUser() {
    // Por padrão, quem faz login vai para o checkout (payment.html)
    // pois a intenção principal é finalizar a compra.
    // Futuramente você pode implementar ?returnUrl=... aqui.
    window.location.href = "payment.html";
}