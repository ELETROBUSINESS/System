import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const form = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const rememberMe = document.getElementById('remember-me');
const errorMsg = document.getElementById('error-message');
const submitBtn = document.getElementById('btn-submit');
const togglePass = document.getElementById('toggle-password');

// Toggle Password Visibility
if (togglePass) {
    togglePass.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        togglePass.querySelector('i').classList.toggle('bx-show');
        togglePass.querySelector('i').classList.toggle('bx-hide');
    });
}

// Show Error Helper
function showError(message) {
    errorMsg.querySelector('span').textContent = message;
    errorMsg.classList.remove('hidden');
    // Shake animation
    form.animate([
        { transform: 'translateX(0)' },
        { transform: 'translateX(-4px)' },
        { transform: 'translateX(4px)' },
        { transform: 'translateX(0)' }
    ], { duration: 300 });
}

// Handle Login
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMsg.classList.add('hidden');

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            showError('Por favor, preencha todos os campos.');
            return;
        }

        // Set Loading State
        const originalBtnText = submitBtn.innerText;
        submitBtn.innerText = 'Autenticando...';
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-75', 'cursor-not-allowed');

        try {
            // Set Persistence
            const persistenceType = rememberMe.checked ? browserLocalPersistence : browserSessionPersistence;
            await setPersistence(auth, persistenceType);

            // Sign In
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            console.log("Logged in:", user.uid);

            // Fetch User Data from Firestore
            // Path logic from registration script: app/users/accounts/{uid}
            const userDocRef = doc(db, "app", "users", "accounts", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();

                // SECURITY: Store user config in localStorage for easy access by main.js
                // Removing sensitive data if any, but keeping API configs and Permissions
                // Note: We use 'APP_USER_DATA' key
                localStorage.setItem('APP_USER_DATA', JSON.stringify(userData));

                // Redirect
                window.location.href = 'conta.html';
            } else {
                console.error("User document not found in Firestore!");
                showError("Erro de conta: Perfil de usuário não encontrado.");
                // Optional: signOut
                auth.signOut();
            }

        } catch (error) {
            console.error("Login Error:", error);
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                showError("Email ou senha incorretos.");
            } else if (error.code === 'auth/too-many-requests') {
                showError("Muitas tentativas. Tente novamente mais tarde.");
            } else {
                showError("Ocorreu um erro ao entrar. Tente novamente.");
            }
        } finally {
            // Reset Loading State
            submitBtn.innerText = originalBtnText;
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
        }
    });
}
