/**
 * Sistema de Fechamento de Caixa - Minimalist Edition
 */

let closingData = null;
let currentStep = 1;

function getStepIndicator(step) {
    return `
        <div class="closing-steps-indicator">
            <div class="step-dot ${step >= 1 ? 'active' : ''}"></div>
            <div class="step-dot ${step >= 2 ? 'active' : ''}"></div>
            <div class="step-dot ${step >= 3 ? 'active' : ''}"></div>
        </div>
    `;
}

async function openClosingFlow() {
    const modal = document.getElementById('closing-modal');
    const content = document.getElementById('closing-modal-content');

    modal.classList.add('show');
    content.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20">
            <div class="w-8 h-8 border-2 border-gray-100 border-t-black rounded-full animate-spin"></div>
            <p class="mt-6 text-[10px] text-gray-400 font-bold tracking-[0.2em] uppercase">Sincronizando Dados</p>
        </div>
    `;

    try {
        const storeId = 'DT#25';
        const response = await fetch(NEW_API, {
            method: 'POST',
            body: JSON.stringify({ action: 'calcular', loja: storeId, periodo: 'dia' })
        });

        const result = await response.json();
        if (result.success) {
            closingData = result.resultados;
            renderStep1();
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        content.innerHTML = `
            <div class="text-center py-10">
                <h2 class="closing-title">Falha na Conexão</h2>
                <p class="text-gray-400 text-[11px] mb-8">Não foi possível carregar o relatório operacional.</p>
                <button onclick="closeClosingModal()" class="btn-closing-next">Voltar</button>
            </div>
        `;
    }
}

function renderStep1() {
    currentStep = 1;
    const content = document.getElementById('closing-modal-content');
    const d = closingData;

    content.innerHTML = `
        <div class="step-container active">
            ${getStepIndicator(1)}
            <h2 class="closing-title">Desempenho</h2>
            <p class="closing-subtitle">Resumo das operações de hoje</p>

            <div class="closing-stats-grid">
                <div class="closing-stat-card">
                    <span class="stat-label">Faturado</span>
                    <span class="stat-value">R$ ${d.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="closing-stat-card">
                    <span class="stat-label">Clientes</span>
                    <span class="stat-value">${d.clientesAtendidos}</span>
                </div>
                <div class="closing-stat-card">
                    <span class="stat-label">Taxas</span>
                    <span class="stat-value" style="color: #64748b">- R$ ${d.taxas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="closing-stat-card">
                    <span class="stat-label">Lucro</span>
                    <span class="stat-value" style="font-weight: 700">R$ ${d.lucroOperacional.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
            </div>

            <button onclick="renderStep2()" class="btn-closing-next">Conferir Dinheiro</button>
        </div>
    `;
}

function renderStep2() {
    currentStep = 2;
    const content = document.getElementById('closing-modal-content');
    const d = closingData.detalheDinheiro;

    content.innerHTML = `
        <div class="step-container active">
            ${getStepIndicator(2)}
            <h2 class="closing-title">Espécie</h2>
            <p class="closing-subtitle">Balanço físico em caixa</p>

            <div class="closing-summary-list">
                <div class="closing-summary-row">
                    <span class="summary-label">Entradas</span>
                    <span class="summary-value">R$ ${d.entradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="closing-summary-row">
                    <span class="summary-label">Saídas / Sangrias</span>
                    <span class="summary-value">R$ ${d.saidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="closing-summary-row summary-total">
                    <span class="summary-label">Saldo Esperado</span>
                    <span class="summary-value">R$ ${d.balanco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
            </div>

            <div class="closing-input-group">
                <span class="stat-label">Contagem Física</span>
                <input type="number" id="input-cash" class="closing-input" placeholder="0,00" step="0.01" inputmode="decimal" autofocus>
            </div>

            <button onclick="renderStep3()" class="btn-closing-next">Próximo Passo</button>
            <a href="javascript:void(0)" onclick="renderStep1()" class="btn-closing-back">Voltar</a>
        </div>
    `;
}

function renderStep3() {
    currentStep = 3;
    const cashInHand = parseFloat(document.getElementById('input-cash').value) || 0;
    const expectedCash = closingData.detalheDinheiro.balanco;
    const diff = cashInHand - expectedCash;

    closingData.informedCash = cashInHand;
    closingData.cashDifference = diff;

    const content = document.getElementById('closing-modal-content');

    content.innerHTML = `
        <div class="step-container active">
            ${getStepIndicator(3)}
            <h2 class="closing-title">Digital</h2>
            <p class="closing-subtitle">Relatórios de máquinas e pix</p>

            <div class="closing-stats-grid mb-8">
                <div class="closing-stat-card">
                    <span class="stat-label">Diferença Dinheiro</span>
                    <div class="flex items-center gap-2">
                        <span class="stat-value">R$ ${diff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        ${diff !== 0 ? `<span class="discrepancy-badge discrepancy-error">${diff > 0 ? 'Sobra' : 'Falta'}</span>` : ''}
                    </div>
                </div>
                <div class="closing-stat-card">
                    <span class="stat-label">Esperado Digital</span>
                    <span class="stat-value">R$ ${closingData.vendasMaquininha.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
            </div>

            <div class="closing-input-group">
                <span class="stat-label">Total nas Máquinas</span>
                <input type="number" id="input-card" class="closing-input" placeholder="0,00" step="0.01" inputmode="decimal" autofocus>
            </div>

            <button onclick="finishClosing()" class="btn-closing-next">Finalizar Fechamento</button>
            <a href="javascript:void(0)" onclick="renderStep2()" class="btn-closing-back">Voltar</a>
        </div>
    `;
}

async function finishClosing() {
    const cardProcessed = parseFloat(document.getElementById('input-card').value) || 0;
    const expectedCard = closingData.vendasMaquininha;
    const diffCard = cardProcessed - expectedCard;
    const diffCash = closingData.cashDifference;

    const btn = document.querySelector('.btn-closing-next');
    btn.disabled = true;
    btn.innerHTML = 'Processando...';

    const timestamp = Date.now();
    const adjustments = [];

    if (Math.abs(diffCash) > 0.01) {
        adjustments.push({
            action: 'salvar', loja: 'DT#25', operador: 'Nubia', cargo: 'CEO',
            tipo: 'ajuste' + (diffCash >= 0 ? '+' : '-'),
            id: 'FECH-DIN-' + timestamp, pagamento: 'dinheiro',
            valor: Math.abs(diffCash), total: Math.abs(diffCash),
            descricao: `Dif. Dinheiro: Esp ${closingData.detalheDinheiro.balanco}, Inf ${closingData.informedCash}`
        });
    }

    if (Math.abs(diffCard) > 0.01) {
        adjustments.push({
            action: 'salvar', loja: 'DT#25', operador: 'Nubia', cargo: 'CEO',
            tipo: 'ajuste' + (diffCard >= 0 ? '+' : '-'),
            id: 'FECH-MAQ-' + timestamp, pagamento: 'maquininha',
            valor: Math.abs(diffCard), total: Math.abs(diffCard),
            descricao: `Dif. Digital: Esp ${expectedCard}, Inf ${cardProcessed}`
        });
    }

    try {
        if (adjustments.length > 0) {
            await Promise.all(adjustments.map(p => fetch(NEW_API, { method: 'POST', body: JSON.stringify(p) })));
        }

        document.getElementById('closing-modal-content').innerHTML = `
            <div class="text-center py-10">
                <div class="w-12 h-12 border border-black rounded-full flex items-center justify-center mx-auto mb-8">
                    <i class='bx bx-check text-2xl'></i>
                </div>
                <h2 class="closing-title">Concluído</h2>
                <p class="text-gray-400 text-[11px] mb-12">O caixa foi fechado e os ajustes foram processados.</p>

                <div class="closing-summary-list mb-12">
                    <div class="closing-summary-row">
                        <span class="summary-label">Dinheiro</span>
                        <span class="summary-value ${diffCash < 0 ? 'text-red-500' : ''}">${diffCash >= 0 ? '+' : ''}${diffCash.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div class="closing-summary-row">
                        <span class="summary-label">Digital</span>
                        <span class="summary-value ${diffCard < 0 ? 'text-red-500' : ''}">${diffCard >= 0 ? '+' : ''}${diffCard.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>

                <button onclick="closeClosingModal(); window.location.reload();" class="btn-closing-next">Sair</button>
            </div>
        `;
    } catch (error) {
        btn.disabled = false;
        btn.innerHTML = 'Tentar Novamente';
    }
}
