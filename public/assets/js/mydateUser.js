document.addEventListener('DOMContentLoaded', () => {
    const url = `https://script.google.com/macros/s/AKfycby8x6--ITfvIW7ui6c24reBqzL3LUhqL30hf4-gaJCS0xB0EDPM50TcSji_W-IuNU33/exec?pagina=3`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            const campos = [
                'ticketEvelynDate',
                'ticketRyannDate',
                'metaRyan',
                'metaEvelyn'
            ];

            campos.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.textContent = data[id];
                    el.classList.remove('skeleton', 'shimmer');
                }
            });
        })
        .catch(error => {
            console.error('Erro ao buscar dados da página 3:', error);
        });
});