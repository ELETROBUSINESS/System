// Substitua este URL pelo URL que você montou no passo 2
const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1RxoXureJRdfkyIhR870DMiA3dghTPj-uvHgefJ9rPw8/edit?gid=374775660#gid=374775660';

async function fetchSheetData() {
    try {
        const response = await fetch(GOOGLE_SHEET_URL);
        const csvText = await response.text();
        
        // O CSV para a faixa D2:E3 terá os valores separados por vírgula.
        // Ex: "8000","10000"
        const values = csvText.trim().split(',');
        
        // Assumimos que o primeiro valor é o alcançado e o segundo é a meta
        const alcancado = parseFloat(values[0].replace(/"/g, ''));
        const meta = parseFloat(values[1].replace(/"/g, ''));

        if (isNaN(alcancado) || isNaN(meta)) {
            throw new Error('Os dados retornados não são números válidos.');
        }

        return { alcancado, meta };

    } catch (error) {
        console.error('Erro ao buscar dados da planilha:', error);
        return null;
    }
}

async function createGoalChart() {
    const data = await fetchSheetData();

    const percentageTextElement = document.getElementById('percentageText');
    if (!data) {
        percentageTextElement.textContent = 'Erro';
        return;
    }

    const { alcancado, meta } = data;
    const porcentagem = (alcancado / meta) * 100;
    const restante = 100 - porcentagem;

    const ctx = document.getElementById('goalChart').getContext('2d');

    const corAlcancadoRoxo = '#8a2be2'; // Cor roxa
    const corRestanteCinza = '#d3d3d3'; // Cor cinza claro

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [porcentagem, restante],
                backgroundColor: [
                    corAlcancadoRoxo,
                    corRestanteCinza
                ],
                borderWidth: 0,
                spacing: 5,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '85%',
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: false
                }
            },
            layout: {
                padding: 0
            }
        }
    });

    percentageTextElement.textContent = `${porcentagem.toFixed(0)}%`;
}

// Inicia a criação do gráfico
createGoalChart();