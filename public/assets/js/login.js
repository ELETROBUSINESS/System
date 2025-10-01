// public/assets/js/login.js

document.addEventListener("DOMContentLoaded", () => {
    // Seletores dos elementos do DOM
    const loginForm = document.getElementById("login-form");
    const usernameStep = document.getElementById("username-step");
    const passwordStep = document.getElementById("password-step");
    
    const usernameInput = document.getElementById("login-username");
    const passwordInput = document.getElementById("login-password");

    const userAvatar = document.getElementById("user-avatar");
    const userName = document.getElementById("user-name");
    const changeUserBtn = document.getElementById("change-user-btn");

    let currentUser = null; // Para armazenar o usuário encontrado na primeira etapa

    // Função para mostrar a tela de senha
    const showPasswordStep = (user) => {
        userAvatar.src = user.profilePic;
        userName.textContent = user.username;
        
        usernameStep.classList.add("hidden");
        passwordStep.classList.remove("hidden");
        
        // Adicionamos um setTimeout para garantir que o elemento esteja visível antes de focar
        setTimeout(() => {
            passwordInput.focus();
        }, 0); 
    };
    
    // Função para mostrar a tela de usuário
    const showUsernameStep = () => {
        passwordStep.classList.add("hidden");
        usernameStep.classList.remove("hidden");
        usernameInput.focus();
    };

    // 1. VERIFICA SE EXISTE UM TOKEN VÁLIDO AO CARREGAR A PÁGINA
    const savedUserToken = localStorage.getItem("user_token");
    if (savedUserToken) {
        const token = JSON.parse(savedUserToken);

        // Verifica se o token não expirou
        if (new Date().getTime() < token.expires) {
            currentUser = token.user; // O usuário já está validado
            showPasswordStep(currentUser);
        } else {
            localStorage.removeItem("user_token"); // Token expirado, remove
            showUsernameStep();
        }
    } else {
        showUsernameStep(); // Nenhum token, começa do zero
    }

    // 2. LIDA COM O ENVIO DO FORMULÁRIO
    loginForm.addEventListener("submit", (e) => {
        e.preventDefault();

        // Se estivermos na etapa de usuário...
        if (!usernameStep.classList.contains("hidden")) {
            const usernameValue = usernameInput.value;
            const foundUser = users.find(u => u.username.toLowerCase() === usernameValue.toLowerCase());

            if (foundUser) {
                currentUser = foundUser;
                showPasswordStep(currentUser);
            } else {
                alert("Usuário não encontrado.");
            }
        } 
        // Se estivermos na etapa de senha...
        else {
            const passwordValue = passwordInput.value;
            
            if (currentUser && currentUser.password === passwordValue) {
                // Sucesso! Criar o token de 120 dias
                const expirationTime = new Date().getTime() + (120 * 24 * 60 * 60 * 1000);
                const token = {
                    user: currentUser,
                    expires: expirationTime
                };
                
                localStorage.setItem("user_token", JSON.stringify(token));
                
                // Redireciona para a página do usuário
                window.location.href = currentUser.redirect;

            } else {
                alert("Senha inválida.");
            }
        }
    });

    // 3. LIDA COM O BOTÃO "TROCAR USUÁRIO"
    changeUserBtn.addEventListener("click", () => {
        localStorage.removeItem("user_token");
        currentUser = null;
        usernameInput.value = "";
        passwordInput.value = "";
        showUsernameStep();
    });
});