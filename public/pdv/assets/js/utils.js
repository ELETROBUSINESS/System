// Constantes Globais
const FIREBASE_CONFIG_ID = 'floralchic-loja';
const STORE_OWNER_UID = "3zYT9Y6hXWeJSuvmEYP4FMZa5gI2";
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzvd0BBLEEQlu-ksnIbsmnYcjQNQuZcTrsCmXMKHGM5g7DPEk3Nj95X47LKbj7rRSAT/exec";
const REGISTRO_VENDA_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxCCaxdYdC6J_QKsaoWTDquH915MHUnM9BykD39ZUujR2LB3lx9d9n5vAsHdJZJByaa7w/exec";

// Formatadores
const formatCurrency = (value) => { 
    const n = Number(value); 
    if (isNaN(n)) return 'R$ 0,00'; 
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); 
};

const formatTime = (date) => {
    const pad = (n) => n < 10 ? '0' + n : n;
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const formatTimestamp = (date) => { /* ...seu código original... */ };

// Helpers de UI
const showCustomAlert = (title, message) => {
    const modal = document.getElementById('alert-modal');
    if(modal) {
        document.getElementById('alert-title').textContent = title;
        document.getElementById('alert-message').textContent = message;
        modal.classList.add('active');
    } else {
        alert(`${title}: ${message}`);
    }
};

const openModal = (modal) => { if(modal) modal.classList.add('active'); };
const closeModal = (modal) => { if(modal) modal.classList.remove('active'); };

// Inicializa Eventos Globais de Modal (Fechar ao clicar no X ou fora)
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal-overlay');
            closeModal(modal);
        });
    });
});