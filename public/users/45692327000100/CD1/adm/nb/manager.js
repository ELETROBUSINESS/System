// Aguarda o carregamento completo do DOM para garantir que todos os elementos HTML existam
document.addEventListener('DOMContentLoaded', () => {

    // --- CONSTANTES E VARIÁVEIS GLOBAIS ---
    const URL_APPS_SCRIPT = 'https://script.google.com/macros/s/AKfycbyPWy8SHpOTsZAqFKoUTNOrgJkZKVVtYAMRXNDBQ3Nnalkr2k5c6CrUYtfmSuTQ5rbqhw/exec';
    const loja = 'cd1'; // Define a loja padrão ou busca dinamicamente se necessário
    
    const boletosTbody = document.getElementById('boletos-body');
    const crediarioTbody = document.getElementById('crediario-body');
    const loadingIndicator = document.getElementById('loading');
    const lastUpdateTimeElement = document.getElementById('last-update-time');

    // --- FUNÇÕES PRINCIPAIS ---

    /**
     * Busca e exibe os boletos da planilha.
     * @param {string} loja - O identificador da loja para buscar os dados.
     */
    function fetchBoletos(loja) {
        loadingIndicator.style.display = 'block'; // Mostra o spinner de carregamento
        boletosTbody.innerHTML = ''; // Limpa a tabela antes de carregar novos dados

        fetch(`${URL_APPS_SCRIPT}?tipo=boletos&loja=${loja}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro de rede: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.error) {
                    throw new Error(`Erro no servidor: ${data.error}`);
                }
                
                if (data.length === 0) {
                     boletosTbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Nenhum boleto "a pagar" encontrado.</td></tr>`;
                     return;
                }

                data.forEach(boleto => {
                    const tr = document.createElement('tr');

                    // --- CÓDIGO CORRIGIDO ---
                    // Acessa os dados pelas propriedades do objeto para garantir a ordem correta.
                    
                    const tdVencimento = document.createElement('td');
                    tdVencimento.textContent = boleto.vencimento;
                    tr.appendChild(tdVencimento);

                    const tdEmpresa = document.createElement('td');
                    tdEmpresa.textContent = boleto.empresa;
                    tr.appendChild(tdEmpresa);

                    const tdValor = document.createElement('td');
                    // Formata o valor para o padrão monetário brasileiro (R$)
                    tdValor.textContent = typeof boleto.valor === 'number'
                        ? boleto.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : boleto.valor;
                    tr.appendChild(tdValor);

                    const tdStatus = document.createElement('td');
                    tdStatus.textContent = boleto.status;
                    tr.appendChild(tdStatus);

                    const tdAction = document.createElement('td');
                    const payButton = document.createElement('button');
                    payButton.className = 'pay-button';
                    payButton.textContent = 'Pagar';
                    payButton.onclick = () => {
                        // Passa o objeto 'boleto' completo para a função de atualização
                        updateBoletoStatus(boleto, tr);
                    };
                    tdAction.appendChild(payButton);
                    tr.appendChild(tdAction);

                    boletosTbody.appendChild(tr);
                });
            })
            .catch(error => {
                console.error('Erro ao buscar boletos:', error);
                // Exibe uma mensagem de erro clara para o usuário na tabela
                boletosTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Falha ao carregar os boletos. Tente novamente.</td></tr>`;
            })
            .finally(() => {
                // Garante que o indicador de carregamento seja escondido, mesmo se houver erro
                loadingIndicator.style.display = 'none';
                updateLastRefreshTime();
            });
    }

    /**
     * Atualiza o status de um boleto para "pago".
     * @param {object} boleto - O objeto contendo os dados do boleto (vencimento, empresa).
     * @param {HTMLElement} tableRow - A linha da tabela (tr) correspondente ao boleto.
     */
    function updateBoletoStatus(boleto, tableRow) {
        if (!confirm(`Deseja marcar o boleto da empresa "${boleto.empresa}" como pago?`)) {
            return;
        }
        
        tableRow.style.opacity = '0.5'; // Feedback visual de que a ação está em progresso

        const payload = {
            tipo: 'boletos',
            loja: loja, // Usa a variável global 'loja'
            empresa: boleto.empresa,
            vencimento: boleto.vencimento,
            novoStatus: 'pago'
        };

        fetch(URL_APPS_SCRIPT, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'application/json'
            },
            mode: 'no-cors' // Mantido conforme o código original, mas 'cors' é geralmente preferível
        })
        .then(response => {
            // Com 'no-cors', a resposta é opaca, então não podemos ler o sucesso/erro diretamente do corpo.
            // A melhoria aqui é remover a linha da interface para dar feedback de sucesso.
            alert(`Boleto da "${boleto.empresa}" marcado como pago! A lista será atualizada.`);
            tableRow.remove(); // Remove a linha da tabela para um feedback imediato
        })
        .catch(error => {
            console.error('Erro ao atualizar status:', error);
            alert('Ocorreu um erro ao tentar atualizar o status. Verifique sua conexão e tente novamente.');
            tableRow.style.opacity = '1'; // Restaura a aparência normal se a atualização falhar
        });
    }

    /**
     * Busca e exibe os dados de crediário.
     * @param {string} loja 
     */
    function fetchCrediario(loja) {
        // Implementação futura para crediário, se necessário, seguindo o mesmo padrão de fetchBoletos.
        // console.log(`Buscando dados de crediário para a loja: ${loja}`);
    }

    /**
     * Atualiza o texto com a hora da última atualização.
     */
    function updateLastRefreshTime() {
        const now = new Date();
        const formattedTime = now.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        lastUpdateTimeElement.textContent = `Última atualização: ${formattedTime}`;
    }


    // --- INICIALIZAÇÃO ---
    
    // Busca os dados iniciais ao carregar a página
    fetchBoletos(loja);
    // fetchCrediario('lapinha'); // Descomente se precisar carregar o crediário também
});