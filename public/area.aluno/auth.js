document.addEventListener('DOMContentLoaded', () => {
    // 1. VERIFICAÇÃO DE LOGIN
    const userToken = localStorage.getItem('studentToken');
    if (!userToken && !window.location.pathname.endsWith('login.html')) {
        // Se não houver token e não estiver na página de login, redireciona
        window.location.href = 'login.html';
        return; // Impede a execução do resto do script
    }

    // 2. LÓGICA DA NAVBAR FLUTUANTE (só executa se a navbar existir)
    const navigation = document.querySelector('.navigation');
    if (navigation) {
        const navLists = navigation.querySelectorAll('.list');
        const currentPage = window.location.pathname.split('/').pop(); // Pega o nome do arquivo atual

        navLists.forEach(list => {
            list.classList.remove('active');
            if (list.dataset.page === currentPage) {
                list.classList.add('active');
            }
        });
    }
});