/* emissao.js */

document.addEventListener('DOMContentLoaded', () => {
    // --- State Management ---
    let currentStep = 1;
    const totalSteps = 5;
    const FISCAL_API_URL = "https://emitirnfe-xsy57wqb6q-rj.a.run.app";
    const API26_URL = "https://script.google.com/macros/s/AKfycbyZtUsI44xA4MQQLZWJ6K93t6ZaSaN6hw7YQw9EclZG9E85kM6yOWQCQ0D-ZJpGmyq4/exec";

    let nfeData = {
        dest: {
            cpf: '',
            nome: '',
            telefone: '',
            email: '',
            rua: '',
            num: '',
            bairro: '',
            cep: '',
            municipio: '',
            uf: 'PA',
            ie: ''
        },
        items: [],
        pag: {
            tipo: '01', // Dinheiro default
            valor: 0
        },
        frete: {
            mod: '9',
            valor: 0,
            transp: ''
        }
    };

    // --- Local Cache ---
    let localProductCache = [];
    let localClientCache = [];

    // --- DOM Elements ---
    const modalEmissao = document.getElementById('modal-emissao');
    const btnNovaEmissao = document.getElementById('btn-nova-emissao');
    const btnCloseEmissao = document.getElementById('btn-close-emissao');
    const btnNext = document.getElementById('btn-next-step');
    const btnPrev = document.getElementById('btn-prev-step');

    // Preview Elements
    const prevDestNome = document.getElementById('prev-dest-nome');
    const prevItemsContainer = document.getElementById('prev-items-container');
    const prevTotalValue = document.getElementById('prev-total-value');

    // Form Elements
    const inputDestDoc = document.getElementById('nfe-dest-doc');
    const inputDestNome = document.getElementById('nfe-dest-nome');
    const inputDestTel = document.getElementById('nfe-dest-tel');
    const inputDestEmail = document.getElementById('nfe-dest-email');
    const inputDestRua = document.getElementById('nfe-dest-rua');
    const inputDestNum = document.getElementById('nfe-dest-num');
    const inputDestBairro = document.getElementById('nfe-dest-bairro');
    const inputDestCep = document.getElementById('nfe-dest-cep');
    const inputDestMunicipio = document.getElementById('nfe-dest-municipio');
    const inputDestUf = document.getElementById('nfe-dest-uf');
    const inputDestIe = document.getElementById('nfe-dest-ie');
    const inputPagTipo = document.getElementById('nfe-pag-tipo');

    // Shipping Elements
    const inputFreteMod = document.getElementById('nfe-frete-mod');
    const inputFreteValor = document.getElementById('nfe-frete-valor');
    const inputFreteTransp = document.getElementById('nfe-frete-transp');
    const divFreteDetalhes = document.getElementById('frete-detalhes');

    // Search Elements
    const barcodeInput = document.getElementById('barcode-input');
    const searchResultsDiv = document.getElementById('barcode-search-results');


    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzB7dluoiNyJ4XK6oDK_iyuKZfwPTAJa4ua4RetQsUX9cMObgE-k_tFGI82HxW_OyMf/exec";

    // --- INITIALIZATION ---
    loadCache();
    loadDraft();

    async function loadCache() {
        // Force API load, ignoring offlineDB as requested
        console.log("Iniciando carregamento de produtos via API...");
        await fetchProductsFromAPI();
        renderHistory(); // Initialize history view
    }

    async function renderHistory() {
        const listContainer = document.getElementById('nfe-history-list');
        if (!listContainer) return;

        try {
            const response = await fetch(`${API26_URL}?action=listar_notas_fiscais`);
            const result = await response.json();

            listContainer.innerHTML = ''; // Clear skeletons
            renderDraftIndicator();

            if (result.success && result.data && result.data.length > 0) {
                // FILTRO: Apenas Modelo 55 (NF-e) - Busca flexível por 55 no campo modelo
                const items = result.data
                    .filter(n => String(n.modelo).includes('55'))
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

                console.log(`Filtro Modelo 55: ${items.length} notas encontradas de ${result.data.length} totais.`);

                if (items.length === 0) {
                    showEmptyState(listContainer);
                    return;
                }

                items.forEach((nota, idx) => {
                    const card = document.createElement('div');
                    card.className = 'nfe-card';
                    const dataFmt = new Date(nota.timestamp).toLocaleString('pt-BR');
                    const statusClass = nota.status === 'Autorizada' ? 'status-success' : 'status-error';

                    card.innerHTML = `
                        <div class="nfe-card-info">
                            <div class="nfe-card-num">NF-e #${nota.nNF}</div>
                            <div class="nfe-card-date">${dataFmt}</div>
                        </div>
                        <div class="nfe-card-actions" style="display:flex; gap: 10px; align-items:center;">
                            <div class="nfe-card-status">
                                <span class="badge ${statusClass}">${nota.status}</span>
                                <div class="nfe-card-total">R$ ${parseFloat(nota.total || 0).toFixed(2).replace('.', ',')}</div>
                            </div>
                            <button class="btn-nfe-action" onclick="window.reimprimirNota(${idx}, 'history')" title="Imprimir DANFE">
                                <i class='bx bx-printer'></i>
                            </button>
                        </div>
                    `;
                    // Atach data to window for re-printing
                    if (!window.historyData) window.historyData = [];
                    window.historyData[idx] = nota;

                    listContainer.appendChild(card);
                });
            } else {
                showEmptyState(listContainer);
            }
        } catch (err) {
            console.error("Erro ao carregar histórico:", err);
            listContainer.innerHTML = '<p class="text-error">Erro ao carregar histórico.</p>';
        }
    }

    function showEmptyState(container) {
        const draftExists = localStorage.getItem('nfe_draft');
        if (!draftExists) {
            container.innerHTML = `
                <div class="empty-state-list" style="text-align:center; padding: 4rem 1rem;">
                    <i class='bx bx-history' style="font-size: 3rem; color: #ddd; margin-bottom: 1rem;"></i>
                    <p style="color: #aaa;">Nenhuma NF-e (Modelo 55) emitida até o momento.</p>
                </div>
            `;
        }
    }

    window.reimprimirNota = (idx, source) => {
        const nota = window.historyData[idx];
        if (!nota) return;

        // Simular o result que a função imprimirNota espera
        const mockResult = {
            nNF: nota.nNF,
            chave: nota.chave,
            nProt: nota.protocolo,
            xml: nota.xml,
            // Precisamos reconstruir dados para a DANFE se o XML não estiver completo
            reprintData: nota
        };

        imprimirNota(mockResult);
    };

    async function fetchProductsFromAPI() {
        const loadingOverlay = document.getElementById('custom-loader-overlay');
        try {
            // Show loading state
            if (loadingOverlay) loadingOverlay.style.display = 'flex';
            if (barcodeInput) barcodeInput.placeholder = "Carregando produtos...";

            const response = await fetch(`${SCRIPT_URL}?action=getProducts`);
            if (!response.ok) throw new Error("Erro na rede");

            const products = await response.json();

            if (Array.isArray(products)) {
                localProductCache = products;
                console.log(`API: ${products.length} produtos carregados.`);
            } else {
                console.error("Formato inválido recebido da API");
            }

            if (barcodeInput) barcodeInput.placeholder = "Digite o código ou nome...";
        } catch (error) {
            console.error("Erro ao buscar produtos da API:", error);
            if (barcodeInput) barcodeInput.placeholder = "Erro ao carregar. Tente recarregar.";
        } finally {
            if (loadingOverlay) loadingOverlay.style.display = 'none';
        }
    }


    // --- Event Listeners ---

    // Open/Close Modal
    if (btnNovaEmissao) {
        btnNovaEmissao.addEventListener('click', () => {
            const stored = localStorage.getItem('nfe_draft');
            if (stored) {
                if (confirm('Existe uma emissão iniciada. Deseja continuar de onde parou?\n\n[OK] Continuar\n[Cancelar] Começar Nova (Apaga atual)')) {
                    continueDraft();
                    return;
                } else {
                    clearDraft();
                }
            }
            resetForm();
            modalEmissao.classList.add('active');
            updatePreview();
            fetchNextNFeNumber();
        });
    }

    async function fetchNextNFeNumber() {
        if (!API26_URL) return;

        const url = `${API26_URL}?action=buscar_proximo_numero_nfe`;
        const resumoEl = document.getElementById('resumo-nfe-num');
        const prevEl = document.getElementById('prev-nfe-num');

        if (resumoEl) resumoEl.textContent = 'Carregando...';
        if (prevEl) prevEl.textContent = '...';

        try {
            const response = await fetch(url);
            const data = await response.json();

            let nextNumber = "1";
            if (data && data.success && data.proximoNumero) {
                nextNumber = String(data.proximoNumero);
            }

            const padded = nextNumber.padStart(9, '0');
            const formattedNumber = padded.replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3');

            if (resumoEl) resumoEl.textContent = formattedNumber;
            if (prevEl) prevEl.textContent = formattedNumber;

            nfeData.numeroNota = formattedNumber;
            saveDraft();
        } catch (e) {
            console.error("Erro ao buscar próximo número da NFe:", e);
            if (resumoEl) resumoEl.textContent = "Falha ao carregar";
            if (prevEl) prevEl.textContent = "000.000";
        }
    }

    window.deleteDraft = function (e) {
        if (e) e.stopPropagation();
        if (confirm('Deseja excluir esta emissão em andamento?')) {
            clearDraft();
        }
    };

    if (btnCloseEmissao) {
        btnCloseEmissao.addEventListener('click', (e) => {
            e.preventDefault();
            console.log("Fechando modal...");
            modalEmissao.classList.remove('active');
            renderDraftIndicator();
        });
    }

    // Wizard Navigation
    btnNext.addEventListener('click', () => {
        if (currentStep < totalSteps) {
            // Validation before moving
            if (currentStep === 1) {
                if (!inputDestNome.value) {
                    alert('Informe o nome do destinatário.');
                    return;
                }
            }
            if (currentStep === 2) {
                if (nfeData.items.length === 0) {
                    alert('Adicione pelo menos um produto.');
                    return;
                }
            }

            currentStep++;
            showStep(currentStep);
        } else {
            // Final Step (Emission)
            finishEmission();
        }
    });

    btnPrev.addEventListener('click', () => {
        if (currentStep > 1) {
            currentStep--;
            showStep(currentStep);
        }
    });

    // Form Inputs Listeners (Live Preview Update)
    [inputDestDoc, inputDestNome, inputDestTel, inputDestEmail, inputDestRua, inputDestNum, inputDestBairro, inputDestCep, inputDestMunicipio, inputDestUf, inputDestIe].forEach(input => {
        if (input) {
            input.addEventListener('input', () => {
                nfeData.dest.cpf = inputDestDoc ? inputDestDoc.value : '';
                nfeData.dest.nome = inputDestNome ? inputDestNome.value : 'Consumidor Final';
                nfeData.dest.telefone = inputDestTel ? inputDestTel.value : '';
                nfeData.dest.email = inputDestEmail ? inputDestEmail.value : '';
                nfeData.dest.rua = inputDestRua ? inputDestRua.value : '';
                nfeData.dest.num = inputDestNum ? inputDestNum.value : '';
                nfeData.dest.bairro = inputDestBairro ? inputDestBairro.value : '';
                nfeData.dest.cep = inputDestCep ? inputDestCep.value : '';
                nfeData.dest.municipio = inputDestMunicipio ? inputDestMunicipio.value : '';
                nfeData.dest.uf = inputDestUf ? inputDestUf.value : 'PA';
                nfeData.dest.ie = inputDestIe ? inputDestIe.value : '';
                updatePreview();
            });
        }
    });

    // Shipping Listeners
    if (inputFreteMod) {
        inputFreteMod.addEventListener('change', (e) => {
            nfeData.frete.mod = e.target.value;
            if (divFreteDetalhes) {
                divFreteDetalhes.style.display = e.target.value !== '9' ? 'block' : 'none';
            }
            updatePreview();
        });
    }

    if (inputFreteValor) {
        inputFreteValor.addEventListener('input', (e) => {
            nfeData.frete.valor = parseFloat(e.target.value) || 0;
            updatePreview();
        });
    }

    if (inputFreteTransp) {
        inputFreteTransp.addEventListener('input', (e) => {
            nfeData.frete.transp = e.target.value;
            updatePreview();
        });
    }

    // Phone Formatting (BR)
    if (inputDestTel) {
        inputDestTel.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 11) value = value.slice(0, 11);

            if (value.length > 10) {
                value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
            } else if (value.length > 5) {
                value = value.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
            } else if (value.length > 2) {
                value = value.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
            } else {
                value = value.replace(/^(\d*)/, '($1');
            }

            e.target.value = value;
            nfeData.dest.telefone = value;
        });
    }

    // Payment Type Listener
    if (inputPagTipo) {
        inputPagTipo.addEventListener('change', (e) => {
            nfeData.pag.tipo = e.target.value;
        });
    }

    // Close results when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.scan-search-container')) {
            searchResultsDiv.style.display = 'none';
        }
    });

    barcodeInput.addEventListener('input', (e) => {
        const rawTerm = e.target.value;
        const term = rawTerm.trim().toUpperCase();

        if (!term) {
            searchResultsDiv.style.display = 'none';
            return;
        }

        if (/^\d+$/.test(term)) {
            searchResultsDiv.style.display = 'none';
            const exactMatch = localProductCache.find(p =>
                String(p.id).trim() === term ||
                (p.barcode && String(p.barcode).trim() === term) ||
                (p.codigo && String(p.codigo).trim() === term)
            );

            if (exactMatch) {
                addItemToNfe(exactMatch);
                e.target.value = '';
            }
            return;
        }

        if (term.length >= 3) {
            const lowerTerm = term.toLowerCase();
            const terms = lowerTerm.split(' ').filter(t => t.length > 0);

            const matches = localProductCache.filter(p => {
                if (!p) return false;
                const pName = (p.name || '').toLowerCase();
                const pBrand = (p.brand || '').toLowerCase();
                return terms.every(t => pName.includes(t) || pBrand.includes(t));
            }).slice(0, 50);

            renderSearchResults(matches);
        } else {
            searchResultsDiv.style.display = 'none';
        }
    });

    barcodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (searchResultsDiv.style.display !== 'none' && searchResultsDiv.children.length > 0) {
                searchResultsDiv.children[0].click();
            }
        }
    });

    function saveDraft() {
        const draft = {
            step: currentStep,
            data: nfeData,
            timestamp: Date.now()
        };
        localStorage.setItem('nfe_draft', JSON.stringify(draft));
        renderDraftIndicator();
    }

    function loadDraft() {
        const stored = localStorage.getItem('nfe_draft');
        if (stored) {
            try {
                const draft = JSON.parse(stored);
                nfeData = draft.data;
                currentStep = draft.step || 1;

                if (nfeData.dest) {
                    inputDestDoc.value = nfeData.dest.cpf || '';
                    inputDestNome.value = nfeData.dest.nome || '';
                    inputDestTel.value = nfeData.dest.telefone || '';
                    inputDestEmail.value = nfeData.dest.email || '';
                    if (inputDestRua) inputDestRua.value = nfeData.dest.rua || '';
                    if (inputDestNum) inputDestNum.value = nfeData.dest.num || '';
                    if (inputDestBairro) inputDestBairro.value = nfeData.dest.bairro || '';
                    if (inputDestCep) inputDestCep.value = nfeData.dest.cep || '';
                    if (inputDestMunicipio) inputDestMunicipio.value = nfeData.dest.municipio || '';
                    if (inputDestUf) inputDestUf.value = nfeData.dest.uf || 'PA';
                    if (inputDestIe) inputDestIe.value = nfeData.dest.ie || '';

                    // Trigger input events to apply masks if modal is opened later
                    [inputDestDoc, inputDestTel].forEach(input => {
                        if (input) input.dispatchEvent(new Event('input'));
                    });
                }

                if (nfeData.frete) {
                    if (inputFreteMod) inputFreteMod.value = nfeData.frete.mod || '9';
                    if (inputFreteValor) inputFreteValor.value = nfeData.frete.valor || 0;
                    if (inputFreteTransp) inputFreteTransp.value = nfeData.frete.transp || '';
                    if (divFreteDetalhes) divFreteDetalhes.style.display = nfeData.frete.mod !== '9' ? 'block' : 'none';
                }

                if (nfeData.pag && inputPagTipo) {
                    inputPagTipo.value = nfeData.pag.tipo || '01';
                }

                renderDraftIndicator();

            } catch (e) {
                console.error("Erro ao carregar rascunho:", e);
            }
        }
    }

    function clearDraft() {
        localStorage.removeItem('nfe_draft');
        nfeData = {
            dest: { cpf: '', nome: '', telefone: '', email: '', rua: '', num: '', bairro: '', cep: '', municipio: '', uf: 'PA', ie: '' },
            items: [],
            pag: { tipo: '01', valor: 0 },
            frete: { mod: '9', valor: 0, transp: '' }
        };
        renderDraftIndicator();
    }

    function renderDraftIndicator() {
        const listContainer = document.getElementById('nfe-history-list');
        const existingDraftCard = document.getElementById('draft-card-indicator');
        const stored = localStorage.getItem('nfe_draft');

        if (stored) {
            const draft = JSON.parse(stored);
            const clientName = draft.data.dest.nome || "Cliente Não Identificado";
            const itemCount = draft.data.items.length;
            const stepName = draft.step === 1 ? "Dados" : (draft.step === 2 ? "Produtos" : "Pagamento");

            const html = `
                <div class="nfe-info">
                    <strong style="color: #000;"><i class='bx bx-file-blank' style="margin-right:8px;"></i> Emissão em Andamento</strong>
                    <span>${clientName} • ${stepName} • ${itemCount} produtos</span>
                </div>
                <div style="display:flex; gap:12px; align-items:center;">
                    <button class="btn-nfe-delete" onclick="deleteDraft(event)" title="Excluir"><i class='bx bx-trash'></i></button>
                    <button class="btn-nfe btn-nfe-primary" style="padding: 10px 24px; font-size:0.9rem;" onclick="continueDraft()">Continuar</button>
                </div>
            `;

            if (existingDraftCard) {
                existingDraftCard.innerHTML = html;
            } else {
                const card = document.createElement('div');
                card.id = 'draft-card-indicator';
                card.className = 'nfe-card';
                card.style.borderLeft = '4px solid #000';
                card.innerHTML = html;

                if (listContainer) listContainer.insertBefore(card, listContainer.firstChild);
            }
        } else {
            if (existingDraftCard) existingDraftCard.remove();
            renderHistory();
        }
    }

    window.continueDraft = function () {
        const stored = localStorage.getItem('nfe_draft');
        if (stored) {
            const draft = JSON.parse(stored);
            nfeData = draft.data;
            currentStep = draft.step || 1;

            inputDestDoc.value = nfeData.dest.cpf || '';
            inputDestNome.value = nfeData.dest.nome || '';
            inputDestTel.value = nfeData.dest.telefone || '';
            inputDestEmail.value = nfeData.dest.email || '';
            if (inputDestRua) inputDestRua.value = nfeData.dest.rua || '';
            if (inputDestNum) inputDestNum.value = nfeData.dest.num || '';
            if (inputDestBairro) inputDestBairro.value = nfeData.dest.bairro || '';
            if (inputDestCep) inputDestCep.value = nfeData.dest.cep || '';
            if (inputDestMunicipio) inputDestMunicipio.value = nfeData.dest.municipio || '';
            if (inputDestUf) inputDestUf.value = nfeData.dest.uf || 'PA';
            if (inputDestIe) inputDestIe.value = nfeData.dest.ie || '';
            inputPagTipo.value = nfeData.pag.tipo || '01';

            if (inputFreteMod) inputFreteMod.value = nfeData.frete.mod || '9';
            if (inputFreteValor) inputFreteValor.value = nfeData.frete.valor || 0;
            if (inputFreteTransp) inputFreteTransp.value = nfeData.frete.transp || '';

            modalEmissao.classList.add('active');
            showStep(currentStep);
            renderNfeItems();

            // Trigger input events to apply masks
            [inputDestDoc, inputDestTel].forEach(input => {
                if (input) input.dispatchEvent(new Event('input'));
            });

            updatePreview();
            fetchNextNFeNumber();
        }
    };

    function renderSearchResults(products) {
        searchResultsDiv.innerHTML = '';

        if (products.length === 0) {
            searchResultsDiv.style.display = 'none';
            return;
        }

        products.forEach(prod => {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.style.color = '#000000'; // Explicit color for the whole item

            let imgHTML = '';
            if (prod.imgUrl && prod.imgUrl.length > 10) {
                imgHTML = `<img src="${prod.imgUrl}" style="width:30px; height:30px; object-fit:cover; border-radius:4px; margin-right:8px;">`;
            } else {
                imgHTML = `<div style="width:30px; height:30px; background:#eee; border-radius:4px; margin-right:8px; display:flex; align-items:center; justify-content:center;"><i class='bx bx-box'></i></div>`;
            }

            div.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px;">
                    ${imgHTML}
                    <div style="display:flex; flex-direction:column;">
                        <strong style="font-size:0.95rem; color:#000;">${prod.name}</strong>
                        <small style="color:#777; font-size:0.8rem;">Cód: ${prod.id} ${prod.barcode ? ' • ' + prod.barcode : ''}</small>
                    </div>
                </div>
                <div style="font-weight:700; color:#000; font-size:1rem;">R$ ${parseFloat(prod.price).toFixed(2)}</div>
            `;

            div.addEventListener('click', () => {
                addItemToNfe(prod);
                barcodeInput.value = '';
                searchResultsDiv.style.display = 'none';
                barcodeInput.focus();
            });

            searchResultsDiv.appendChild(div);
        });

        searchResultsDiv.style.display = 'block';
    }

    function addItemToNfe(prod) {
        const existing = nfeData.items.find(i => i.codigo === prod.id || i.codigo === prod.barcode);

        if (existing) {
            existing.quantidade++;
            existing.valorTotal = existing.quantidade * existing.valorUnit;
        } else {
            nfeData.items.push({
                codigo: prod.id || prod.barcode || '000',
                descricao: prod.name,
                ncm: prod.ncm || '00000000',
                cfop: prod.cfop || '5102',
                unidade: prod.unit || 'UN',
                quantidade: 1,
                valorUnit: parseFloat(prod.price) || 0,
                valorTotal: parseFloat(prod.price) || 0
            });
        }

        renderNfeItems();
        updatePreview();
    }

    function showStep(step) {
        document.querySelectorAll('.step-container').forEach(el => el.classList.remove('active'));
        const targetStep = document.getElementById(`step-${step}`);
        if (targetStep) targetStep.classList.add('active');

        btnPrev.style.display = step === 1 ? 'none' : 'block';
        btnNext.textContent = step === totalSteps ? 'Emitir Nota' : 'Próximo';

        document.querySelectorAll('.timeline-step').forEach(el => {
            const s = parseInt(el.dataset.step);
            if (s <= step) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
            if (s < step) {
                el.classList.add('completed');
            } else {
                el.classList.remove('completed');
            }
        });

        if (step === 3) calculateTotals();
        saveDraft();
    }

    function resetForm() {
        currentStep = 1;
        nfeData.items = [];
        inputDestDoc.value = '';
        inputDestNome.value = '';
        inputDestTel.value = '';
        inputDestEmail.value = '';
        if (inputDestRua) inputDestRua.value = '';
        if (inputDestNum) inputDestNum.value = '';
        if (inputDestBairro) inputDestBairro.value = '';
        if (inputDestCep) inputDestCep.value = '';
        if (inputDestMunicipio) inputDestMunicipio.value = '';
        if (inputDestUf) inputDestUf.value = 'PA';
        if (inputDestIe) inputDestIe.value = '';
        nfeData.dest = { cpf: '', nome: '', telefone: '', email: '', rua: '', num: '', bairro: '', cep: '', municipio: '', uf: 'PA', ie: '' };
        nfeData.frete = { mod: '9', valor: 0, transp: '' };
        if (inputFreteMod) inputFreteMod.value = '9';
        if (inputFreteValor) inputFreteValor.value = 0;
        if (inputFreteTransp) inputFreteTransp.value = '';
        if (divFreteDetalhes) divFreteDetalhes.style.display = 'none';

        showStep(1);
        renderNfeItems();
    }

    function renderNfeItems() {
        const container = document.getElementById('nfe-items-list');
        if (!container) return;
        container.innerHTML = '';

        if (nfeData.items.length === 0) {
            container.innerHTML = '<p style="text-align:center; color: #aaa; margin-top:20px;">Nenhum produto adicionado.</p>';
            return;
        }

        const header = document.createElement('div');
        header.className = 'nfe-items-header';
        header.innerHTML = `
            <span>Produto</span>
            <span style="text-align:center">Qtd.</span>
            <span style="text-align:center">Vl. Unit</span>
            <span style="text-align:right">Total</span>
            <span style="text-align:right"></span>
        `;
        container.appendChild(header);

        nfeData.items.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'nfe-item-row';

            const unitPrice = parseFloat(item.valorUnit).toFixed(2);
            const totalPrice = parseFloat(item.valorTotal).toFixed(2).replace('.', ',');

            div.innerHTML = `
                <div class="nfe-item-main">
                    <span class="nfe-item-title" title="${item.descricao}">${item.descricao}</span>
                    <div class="nfe-item-badges">
                        <span class="nfe-badge">${item.ncm || 'NCM?'}</span>
                        <span class="nfe-badge">${item.cfop || '5102'}</span>
                        <span class="nfe-badge">${item.unidade || 'UN'}</span>
                    </div>
                </div>

                <div class="nfe-item-col-qty">
                    <div class="qty-capsule" style="width: 120px; height: 32px;">
                        <button class="qty-btn btn-decrease" data-index="${index}">-</button>
                        <input type="number" class="qty-input-embedded nfe-qty-input" value="${item.quantidade}" data-index="${index}" min="0.01" step="1">
                        <button class="qty-btn btn-increase" data-index="${index}">+</button>
                    </div>
                </div>
                
                <div class="nfe-item-col-price">
                    <div class="qty-capsule" style="width: 100px; height: 32px; padding: 0 8px;">
                        <span style="font-size: 0.8rem; color: #666; margin-right: 4px;">R$</span>
                        <input type="number" value="${unitPrice}" class="qty-input-embedded nfe-price-input" 
                               data-index="${index}" min="0.01" step="0.01" style="text-align: right; width: 100%;">
                    </div>
                </div>

                <div class="nfe-item-total">
                    R$ ${totalPrice}
                </div>

                <div style="display:flex; justify-content:flex-end;">
                    <button class="btn-action-delete" data-index="${index}" title="Remover Item">
                        <i class='bx bx-trash'></i>
                    </button>
                </div>
            `;
            container.appendChild(div);
        });

        document.querySelectorAll('.btn-decrease').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.closest('.btn-decrease').dataset.index;
                const input = document.querySelector(`.nfe-qty-input[data-index="${idx}"]`);
                let val = parseFloat(input.value);
                if (val > 1) {
                    val -= 1;
                    updateItemQuantity(idx, val);
                }
            });
        });

        document.querySelectorAll('.btn-increase').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.closest('.btn-increase').dataset.index;
                const input = document.querySelector(`.nfe-qty-input[data-index="${idx}"]`);
                let val = parseFloat(input.value);
                val += 1;
                updateItemQuantity(idx, val);
            });
        });

        document.querySelectorAll('.nfe-qty-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const idx = e.target.dataset.index;
                const newQty = parseFloat(e.target.value);
                if (newQty > 0) {
                    updateItemQuantity(idx, newQty);
                } else {
                    e.target.value = nfeData.items[idx].quantidade;
                }
            });
        });

        document.querySelectorAll('.nfe-price-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const idx = e.target.dataset.index;
                const newPrice = parseFloat(e.target.value);
                if (newPrice >= 0) {
                    nfeData.items[idx].valorUnit = newPrice;
                    nfeData.items[idx].valorTotal = nfeData.items[idx].quantidade * newPrice;
                    renderNfeItems();
                    updatePreview();
                } else {
                    e.target.value = nfeData.items[idx].valorUnit;
                }
            });
        });

        document.querySelectorAll('.btn-action-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.closest('.btn-action-delete').dataset.index;
                nfeData.items.splice(idx, 1);
                renderNfeItems();
                updatePreview();
            });
        });
    }

    function updateItemQuantity(index, newQty) {
        nfeData.items[index].quantidade = newQty;
        nfeData.items[index].valorTotal = newQty * nfeData.items[index].valorUnit;
        renderNfeItems();
        updatePreview();
    }

    function updatePreview() {
        const destNome = nfeData.dest.nome || 'CONSUMIDOR FINAL';
        let destDoc = nfeData.dest.cpf || '000.000.000-00';

        // Detailed Address for Preview
        const rua = nfeData.dest.rua || '';
        const num = nfeData.dest.num || '';
        const bairro = nfeData.dest.bairro || '';
        const cep = nfeData.dest.cep || '';
        const mun = nfeData.dest.municipio || '';
        const uf = nfeData.dest.uf || 'PA';

        let destEnd = 'ENDEREÇO NÃO INFORMADO';
        if (rua) {
            destEnd = `${rua}, ${num} - ${bairro} - ${cep} - ${mun}/${uf}`;
        }

        // Format Doc for preview
        const rawDoc = destDoc.replace(/\D/g, '');
        if (rawDoc.length === 11) {
            destDoc = rawDoc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        } else if (rawDoc.length === 14) {
            destDoc = rawDoc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        }

        const prevNome = document.getElementById('prev-dest-nome');
        const prevEnd = document.getElementById('prev-dest-data');
        const prevDoc = document.getElementById('prev-dest-doc');

        if (prevNome) prevNome.textContent = destNome.toUpperCase();
        if (prevEnd) prevEnd.textContent = destEnd.toUpperCase();
        if (prevDoc) prevDoc.textContent = destDoc;

        const prevIe = document.getElementById('prev-dest-ie');
        const prevIeContainer = document.getElementById('prev-dest-ie-container');
        if (prevIe && prevIeContainer) {
            if (nfeData.dest.ie) {
                prevIe.textContent = nfeData.dest.ie.toUpperCase();
                prevIeContainer.style.display = 'inline';
            } else {
                prevIeContainer.style.display = 'none';
            }
        }

        // Let's use a cleaner approach targeting the info box
        const emitBox = document.querySelector('.danfe-section .danfe-info-box');
        if (emitBox && !emitBox.id.includes('dest')) { // Ensure we are in the EMITENTE section
            emitBox.innerHTML = `<strong>A N F DA SILVA LTDA</strong><br>
                                 RUA JARBAS PASSARINHO, SN - CENTRO - IPIXUNA DO PARÁ/PA<br>
                                 CNPJ: 45.692.327/0001-00 IE: 158228057`;
        }

        const tbody = document.getElementById('prev-items-body');
        if (tbody) {
            tbody.innerHTML = '';
            let currentTotal = 0;

            nfeData.items.forEach(item => {
                const tr = document.createElement('tr');
                let desc = (item.descricao || '').toUpperCase();
                if (desc.length > 25) desc = desc.substring(0, 25) + '...';

                const qty = item.quantidade || 0;
                const unit = item.unidade || 'UN';
                const vUnit = parseFloat(item.valorUnit || 0);
                const vTotal = parseFloat(item.valorTotal || 0);

                tr.innerHTML = `
                    <td>${desc}</td>
                    <td class="text-center">${qty}</td>
                    <td class="text-center">${unit}</td>
                    <td class="text-right">${vUnit.toFixed(2).replace('.', ',')}</td>
                    <td class="text-right">${vTotal.toFixed(2).replace('.', ',')}</td>
                `;
                tbody.appendChild(tr);
                currentTotal += vTotal;
            });

            const vFrete = parseFloat(nfeData.frete.valor || 0);
            const totalFmt = "R$ " + currentTotal.toFixed(2).replace('.', ',');
            const freteFmt = "R$ " + vFrete.toFixed(2).replace('.', ',');
            const totalNotaFmt = "R$ " + (currentTotal + vFrete).toFixed(2).replace('.', ',');

            const vProdEl = document.getElementById('prev-vprod');
            const vFreteEl = document.getElementById('prev-vfrete');
            const vTotalEl = document.getElementById('prev-vtotal');

            if (vProdEl) vProdEl.textContent = totalFmt;
            if (vFreteEl) vFreteEl.textContent = freteFmt;
            if (vTotalEl) vTotalEl.textContent = totalNotaFmt;
        }

        const accessKeyDisplay = document.getElementById('prev-access-key');
        if (accessKeyDisplay && accessKeyDisplay.textContent.startsWith('0000')) {
            accessKeyDisplay.textContent = "3523 1000 0000 0000 0000 5500 1000 0000 0112 3456 7890";
        }

        const nfeNumDisplay = document.getElementById('prev-nfe-num');
        if (nfeNumDisplay) {
            nfeNumDisplay.textContent = nfeData.numeroNota || "Carregando...";
        }

        saveDraft();
    }

    const pagSelect = document.getElementById('nfe-pag-tipo');
    const parcelasContainer = document.getElementById('nfe-parcelas-container');

    if (pagSelect && parcelasContainer) {
        pagSelect.addEventListener('change', (e) => {
            parcelasContainer.style.display = e.target.value === '03' ? 'block' : 'none';
        });
    }

    function calculateTotals() {
        let itemsTotal = nfeData.items.reduce((acc, item) => acc + item.valorTotal, 0);
        let freteTotal = parseFloat(nfeData.frete.valor || 0);
        nfeData.pag.valor = itemsTotal + freteTotal;
    }

    async function finishEmission() {
        calculateTotals();
        const finalPayload = {
            destinatario: nfeData.dest,
            produtos: nfeData.items,
            pagamento: nfeData.pag,
            frete: nfeData.frete,
            modelo: "55",
            nNF: nfeData.numeroNota || "1"
        };
        console.log("Enviando NFE (Mod 55):", finalPayload);

        try {
            const loadingOverlay = document.getElementById('custom-loader-overlay');
            if (loadingOverlay) loadingOverlay.style.display = 'flex';

            const response = await fetch(`${FISCAL_API_URL}/emitirNfe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalPayload)
            });

            const result = await response.json();

            if (result.status === "success") {
                // --- SALVAR NO BANCO DE DADOS (PLANILHA FISCAL VIA API26) ---
                console.log("💾 Salvando NF-e na planilha database...");
                try {
                    const saleId = "MANUAL-" + Date.now();

                    // Mapeamento Amigável de Pagamento
                    const payMap = { '01': 'Dinheiro', '17': 'PIX', '17-prazo': 'PIX', '03': 'C. Crédito', '04': 'C. Débito', '05': 'Crediário', '90': 'Sem Pagto' };
                    const payLabel = payMap[nfeData.pag.tipo] || 'Outros';

                    const savePayload = {
                        action: "salvar_nota_fiscal",
                        loja: "DT#25",
                        modelo: "55",
                        numeroNota: result.nNF || nfeData.numeroNota || "---",
                        idVenda: saleId,
                        status: "Autorizada",
                        operador: "Emissor Manual",
                        cargo: "Caixa",
                        pagamento: payLabel,
                        total: nfeData.pag.valor,
                        mensagem: result.message || "Emitida com Sucesso",
                        xml: result.xml || "",
                        chave: result.chave || "",
                        protocolo: result.nProt || ""
                    };

                    // Envio em Segundo Plano (Non-blocking)
                    fetch(API26_URL, {
                        method: 'POST',
                        body: JSON.stringify(savePayload)
                    }).then(r => r.json())
                        .then(res => console.log("✅ Registro na Planilha:", res))
                        .catch(e => console.error("❌ Erro ao salvar na planilha:", e));

                } catch (saveErr) {
                    console.error("❌ Erro ao preparar payload de salvamento:", saveErr);
                }

                // --- IMPRESSÃO AUTOMÁTICA ---
                console.log("🖨️ Acionando impressão da DANFE Completa...");
                imprimirNota(result);

                alert(`NF-e Emitida com Sucesso!\nNúmero: ${result.nNF}\nChave: ${result.chave}`);
                modalEmissao.classList.remove('active');
                clearDraft();
            } else {
                alert(`Erro na Emissão: ${result.message || 'Erro desconhecido'}`);
            }
        } catch (err) {
            console.error("Erro ao emitir NF-e:", err);
            alert("Erro de conexão com o servidor fiscal.");
        } finally {
            const loadingOverlay = document.getElementById('custom-loader-overlay');
            if (loadingOverlay) loadingOverlay.style.display = 'none';
        }
    }

    const destCpfInput = document.getElementById('nfe-dest-doc');
    const loadingSpinner = document.getElementById('cnpj-loading');
    const feedbackMsg = document.getElementById('cnpj-feedback');

    if (destCpfInput) {
        destCpfInput.addEventListener('input', async (e) => {
            let v = e.target.value.replace(/\D/g, '');
            let rawVal = v;
            if (v.length > 14) v = v.substring(0, 14);

            if (v.length <= 11) {
                v = v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
            } else {
                v = v.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
            }
            e.target.value = v;

            if (rawVal.length === 14) {
                if (loadingSpinner) loadingSpinner.style.display = 'block';
                if (feedbackMsg) feedbackMsg.style.display = 'none';
                destCpfInput.style.borderColor = 'var(--nfe-border)';

                if (isValidCNPJ(rawVal)) {
                    try {
                        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${rawVal}`);
                        if (res.ok) {
                            const data = await res.json();
                            if (feedbackMsg) {
                                feedbackMsg.textContent = "CNPJ encontrado: " + (data.razao_social || data.nome_fantasia);
                                feedbackMsg.className = "text-success";
                                feedbackMsg.style.display = 'block';
                            }
                            const nomeInput = document.getElementById('nfe-dest-nome');
                            if (nomeInput) nomeInput.value = data.razao_social || data.nome_fantasia || '';

                            if (inputDestRua) inputDestRua.value = data.logradouro || '';
                            if (inputDestNum) inputDestNum.value = data.numero || 'SN';
                            if (inputDestBairro) inputDestBairro.value = data.bairro || '';
                            if (inputDestCep) inputDestCep.value = data.cep || '';
                            if (inputDestMunicipio) inputDestMunicipio.value = data.municipio || '';
                            if (inputDestUf) inputDestUf.value = data.uf || 'PA';

                            const emailInput = document.getElementById('nfe-dest-email');
                            if (emailInput && data.email) emailInput.value = data.email;
                            const telInput = document.getElementById('nfe-dest-tel');
                            if (telInput && data.ddd_telefone_1) telInput.value = `(${data.ddd_telefone_1}) ${data.telefone_1 || ''}`;

                            // Update nfeData source of truth
                            nfeData.dest.cpf = rawVal;
                            nfeData.dest.nome = nomeInput ? nomeInput.value : '';
                            nfeData.dest.rua = data.logradouro || '';
                            nfeData.dest.num = data.numero || 'SN';
                            nfeData.dest.bairro = data.bairro || '';
                            nfeData.dest.cep = data.cep || '';
                            nfeData.dest.municipio = data.municipio || '';
                            nfeData.dest.uf = data.uf || 'PA';
                            nfeData.dest.email = emailInput ? emailInput.value : '';
                            nfeData.dest.telefone = telInput ? telInput.value : '';

                            updatePreview();
                        }
                    } catch (err) {
                        if (feedbackMsg) {
                            feedbackMsg.textContent = "CNPJ não encontrado.";
                            feedbackMsg.className = "text-danger";
                            feedbackMsg.style.display = 'block';
                        }
                    } finally {
                        if (loadingSpinner) loadingSpinner.style.display = 'none';
                    }
                } else {
                    if (loadingSpinner) loadingSpinner.style.display = 'none';
                    if (feedbackMsg) {
                        feedbackMsg.textContent = "CNPJ Inválido.";
                        feedbackMsg.className = "text-danger";
                        feedbackMsg.style.display = 'block';
                    }
                    destCpfInput.style.borderColor = 'black';
                }
            } else {
                if (loadingSpinner) loadingSpinner.style.display = 'none';
                if (feedbackMsg) feedbackMsg.style.display = 'none';
                destCpfInput.style.borderColor = 'var(--nfe-border)';
            }
        });

        destCpfInput.addEventListener('blur', (e) => {
            const rawVal = e.target.value.replace(/\D/g, '');
            if (rawVal.length === 11 && !isValidCPF(rawVal)) {
                if (feedbackMsg) {
                    feedbackMsg.textContent = "CPF Inválido.";
                    feedbackMsg.className = "text-danger";
                    feedbackMsg.style.display = 'block';
                }
                e.target.style.borderColor = 'black';
            }
        });
    }

    function isValidCPF(cpf) {
        cpf = cpf.replace(/[^\d]+/g, '');
        if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
        let soma = 0, resto;
        for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
        resto = (soma * 10) % 11;
        if (resto === 10 || resto === 11) resto = 0;
        if (resto !== parseInt(cpf.substring(9, 10))) return false;
        soma = 0;
        for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
        resto = (soma * 10) % 11;
        if (resto === 10 || resto === 11) resto = 0;
        return resto === parseInt(cpf.substring(10, 11));
    }

    function isValidCNPJ(cnpj) {
        cnpj = cnpj.replace(/[^\d]+/g, '');
        if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
        let tamanho = cnpj.length - 2, numeros = cnpj.substring(0, tamanho), digitos = cnpj.substring(tamanho), soma = 0, pos = tamanho - 7;
        for (let i = tamanho; i >= 1; i--) {
            soma += numeros.charAt(tamanho - i) * pos--;
            if (pos < 2) pos = 9;
        }
        let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
        if (resultado !== parseInt(digitos.charAt(0))) return false;
        tamanho++; numeros = cnpj.substring(0, tamanho); soma = 0; pos = tamanho - 7;
        for (let i = tamanho; i >= 1; i--) {
            soma += numeros.charAt(tamanho - i) * pos--;
            if (pos < 2) pos = 9;
        }
        resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
        return resultado === parseInt(digitos.charAt(1));
    }

    // --- FUNÇÕES DE IMPRESSÃO ---

    function parseNfeXml(xmlString) {
        if (!xmlString) return null;
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, "text/xml");

            const getTag = (tag, parent = xmlDoc) => {
                const el = parent.getElementsByTagName(tag)[0];
                return el ? el.textContent : '';
            };

            const destEl = xmlDoc.getElementsByTagName('dest')[0];
            if (!destEl) return null;

            const enderDest = destEl.getElementsByTagName('enderDest')[0];

            const items = [];
            const detList = xmlDoc.getElementsByTagName('det');
            for (let i = 0; i < detList.length; i++) {
                const prod = detList[i].getElementsByTagName('prod')[0];
                items.push({
                    codigo: getTag('cProd', prod),
                    descricao: getTag('xProd', prod),
                    ncm: getTag('NCM', prod),
                    cfop: getTag('CFOP', prod),
                    unidade: getTag('uCom', prod),
                    quantidade: getTag('qCom', prod),
                    valorUnit: parseFloat(getTag('vUnCom', prod) || 0),
                    valorTotal: parseFloat(getTag('vProd', prod) || 0)
                });
            }

            const icmsTot = xmlDoc.getElementsByTagName('ICMSTot')[0];

            return {
                dest: {
                    nome: getTag('xNome', destEl),
                    doc: getTag('CPF', destEl) || getTag('CNPJ', destEl),
                    end: `${getTag('xLgr', enderDest)}, ${getTag('nro', enderDest)} - ${getTag('xBairro', enderDest)}`,
                    mun: getTag('xMun', enderDest),
                    uf: getTag('UF', enderDest),
                    cep: getTag('CEP', enderDest),
                    bairro: getTag('xBairro', enderDest)
                },
                items: items,
                total: parseFloat(getTag('vNF', icmsTot) || 0),
                vProd: parseFloat(getTag('vProd', icmsTot) || 0),
                vFrete: parseFloat(getTag('vFrete', icmsTot) || 0)
            };
        } catch (e) {
            console.error("Erro ao parsear XML:", e);
            return null;
        }
    }

    function imprimirNota(result) {
        // Emissão Profissional DANFE Completa A4
        const printWindow = window.open('', '_blank');

        // Se for uma nota do histórico, tentamos parsear o XML salvo
        const isHistory = !!result.reprintData;
        let d = isHistory ? result.reprintData : nfeData;

        // Se for histórico, o XML é nossa fonte da verdade para preencher o que falta
        let parsedXmlData = null;
        if (isHistory && d.xml) {
            parsedXmlData = parseNfeXml(d.xml);
        }

        const nNF = (result.nNF || d.nNF || d.numeroNota || "0").toString().padStart(9, '0');
        const chaveFmt = (result.chave || d.chave || "0").replace(/(.{4})/g, '$1 ').trim();
        const dataEmi = isHistory ? new Date(d.timestamp).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
        const nProt = result.nProt || d.protocolo || "---";

        // Mapeamento emitente (Padrão)
        const emit = {
            nome: "A N F DA SILVA LTDA",
            cnpj: "45.692.327/0001-00",
            ie: "158228057",
            end: "RUA JARBAS PASSARINHO, SN - CENTRO",
            mun: "IPIXUNA DO PARÁ - PA",
            cep: "68637-000",
            fone: "(91) 99237-5194"
        };

        // Dados do Destinatário
        let dest = {};
        if (parsedXmlData) {
            dest = parsedXmlData.dest;
        } else if (isHistory) {
            dest = {
                nome: "NÃO ENCONTRADO NO XML",
                doc: d.idVenda,
                end: "Endereço não disponível",
                bairro: "---",
                cep: "---"
            };
        } else {
            dest = {
                nome: d.dest.nome.toUpperCase(),
                doc: d.dest.cpf,
                end: `${d.dest.rua}, ${d.dest.num} - ${d.dest.bairro}`,
                mun: d.dest.municipio,
                uf: d.dest.uf,
                cep: d.dest.cep,
                bairro: d.dest.bairro.toUpperCase()
            };
        }

        // Dados dos Itens
        let itensHtml = '';
        let vProdutos = 0;
        let vFrete = 0;
        let vFinal = 0;

        if (parsedXmlData) {
            vProdutos = parsedXmlData.vProd;
            vFrete = parsedXmlData.vFrete;
            vFinal = parsedXmlData.total;
            parsedXmlData.items.forEach(it => {
                itensHtml += `
                    <tr>
                        <td>${it.codigo}</td>
                        <td>${it.descricao.toUpperCase()}</td>
                        <td>${it.ncm}</td>
                        <td>${it.cfop}</td>
                        <td>${it.unidade}</td>
                        <td>${it.quantidade}</td>
                        <td>${it.valorUnit.toFixed(2).replace('.', ',')}</td>
                        <td>${it.valorTotal.toFixed(2).replace('.', ',')}</td>
                    </tr>
                `;
            });
        } else if (!isHistory) {
            vProdutos = nfeData.items.reduce((acc, item) => acc + item.valorTotal, 0);
            vFrete = parseFloat(nfeData.frete.valor || 0);
            vFinal = vProdutos + vFrete;
            d.items.forEach(it => {
                itensHtml += `
                    <tr>
                        <td>${it.codigo || '---'}</td>
                        <td>${it.descricao.toUpperCase()}</td>
                        <td>${it.ncm}</td>
                        <td>${it.cfop || '5102'}</td>
                        <td>${it.unidade}</td>
                        <td>${it.quantidade}</td>
                        <td>${parseFloat(it.valorUnit).toFixed(2).replace('.', ',')}</td>
                        <td>${parseFloat(it.valorTotal).toFixed(2).replace('.', ',')}</td>
                    </tr>
                `;
            });
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>DANFE NF-E - ${nNF}</title>
                <style>
                    body { font-family: 'Arial', sans-serif; font-size: 9px; margin: 0; padding: 15px; color: #000; line-height: 1.1; }
                    .danfe-box { width: 100%; border: 1px solid #000; margin-bottom: -1px; display: flex; }
                    .danfe-container { width: 100%; max-width: 800px; margin: auto; }
                    .border-all { border: 1px solid #000; }
                    .padding-5 { padding: 5px; }
                    .text-center { text-align: center; }
                    .text-right { text-align: right; }
                    .bold { font-weight: bold; }
                    .label { font-size: 7px; display: block; text-transform: uppercase; margin-bottom: 2px; }
                    .value { font-size: 10px; font-weight: bold; }
                    
                    .header-left { width: 35%; border: 1px solid #000; padding: 5px; }
                    .header-mid { width: 15%; border: 1px solid #000; padding: 5px; text-align: center; }
                    .header-right { width: 50%; border: 1px solid #000; padding: 5px; }
                    
                    .canhoto { border: 1px solid #000; padding: 8px; margin-bottom: 15px; font-size: 8px; border-style: none none dashed none; padding-bottom: 15px; }
                    .section-title { background: #eee; font-weight: bold; padding: 3px; border: 1px solid #000; margin-top: 5px; text-align: center; font-size: 8px; }
                    
                    .table-data { width: 100%; border-collapse: collapse; margin-top: -1px; }
                    .table-data td { border: 1px solid #000; padding: 4px; vertical-align: top; }
                    
                    .prod-table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                    .prod-table th { border: 1px solid #000; font-size: 7px; background: #f2f2f2; padding: 4px; }
                    .prod-table td { border: 1px solid #000; padding: 3px; font-size: 8px; }

                    .barcode-placeholder { 
                        width: 100%; 
                        height: 35px; 
                        background: repeating-linear-gradient(90deg, #000, #000 1px, #fff 1px, #fff 3px);
                        margin: 5px 0;
                    }
                </style>
            </head>
            <body>
                <div class="canhoto">
                    <div style="display:flex; justify-content: space-between;">
                        <div style="width: 80%;">RECEBEMOS DE ${emit.nome} OS PRODUTOS/SERVIÇOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO</div>
                        <div style="text-align:center;">NF-E<br><span style="font-size:10px; font-weight:bold;">Nº ${nNF}</span><br>SÉRIE 1</div>
                    </div>
                    <div style="margin-top:10px; border-top: 1px solid #000; padding-top:5px;">
                        DATA DE RECEBIMENTO: ____/____/_______  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR: __________________________________________________
                    </div>
                </div>

                <div class="danfe-container">
                    <div class="danfe-box">
                        <div class="header-left">
                            <div class="value" style="font-size: 11px;">${emit.nome}</div>
                            <div style="font-size: 8px; margin-top:5px;">
                                ${emit.end}<br>
                                ${emit.mun}<br>
                                CEP: ${emit.cep}<br>
                                Fone: ${emit.fone}
                            </div>
                        </div>
                        <div class="header-mid">
                            <div class="bold" style="font-size: 14px;">DANFE</div>
                            <div style="font-size: 7px;">Documento Auxiliar da<br>Nota Fiscal Eletrônica</div>
                            <div style="margin: 5px 0; font-size: 9px;">0 - Entrada<br>1 - Saída &nbsp; <span class="border-all" style="padding:0 3px;">1</span></div>
                            <div class="bold">N. ${nNF}</div>
                            <div class="bold">SÉRIE 1</div>
                            <div style="font-size: 7px;">FL 1/1</div>
                        </div>
                        <div class="header-right">
                            <div class="barcode-placeholder"></div>
                            <div class="label">Chave de Acesso</div>
                            <div class="value" style="font-size: 9px; letter-spacing: 0.5px;">${chaveFmt}</div>
                            <div class="label" style="margin-top:5px;">Consulta de autenticidade no portal nacional da NF-e www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizadora</div>
                        </div>
                    </div>

                    <table class="table-data">
                        <tr>
                            <td style="width: 50%;"><span class="label">Natureza da Operação</span><span class="value">VENDA DENTRO DO ESTADO</span></td>
                            <td style="width: 50%;"><span class="label">Protocolo de Autorização de Uso</span><span class="value">${nProt} - ${dataEmi}</span></td>
                        </tr>
                    </table>
                    <table class="table-data">
                        <tr>
                            <td style="width: 33%;"><span class="label">Inscrição Estadual</span><span class="value">${emit.ie}</span></td>
                            <td style="width: 33%;"><span class="label">Insc. Est. do Subst. Trib.</span><span class="value">---</span></td>
                            <td style="width: 34%;"><span class="label">CNPJ</span><span class="value">${emit.cnpj}</span></td>
                        </tr>
                    </table>

                    <div class="section-title">DESTINATÁRIO / REMETENTE</div>
                    <table class="table-data">
                        <tr>
                            <td style="width: 55%;"><span class="label">Nome / Razão Social</span><span class="value">${dest.nome}</span></td>
                            <td style="width: 25%;"><span class="label">CNPJ / CPF</span><span class="value">${dest.doc}</span></td>
                            <td style="width: 20%;"><span class="label">Data de Emissão</span><span class="value">${dataEmi.split(' ')[0]}</span></td>
                        </tr>
                        <tr>
                            <td><span class="label">Endereço</span><span class="value">${dest.end}</span></td>
                            <td><span class="label">Bairro / Distrito</span><span class="value">${dest.bairro}</span></td>
                            <td><span class="label">CEP</span><span class="value">${dest.cep}</span></td>
                        </tr>
                        <tr>
                            <td><span class="label">Município</span><span class="value">${dest.mun}</span></td>
                            <td><span class="label">UF</span><span class="value">${dest.uf || 'PA'}</span></td>
                            <td><span class="label">Fone / Fax</span><span class="value">---</span></td>
                        </tr>
                    </table>

                    <div class="section-title">CÁLCULO DO IMPOSTO</div>
                    <table class="table-data">
                        <tr>
                            <td><span class="label">Base de Calc. ICMS</span><span class="value">0,00</span></td>
                            <td><span class="label">Valor do ICMS</span><span class="value">0,00</span></td>
                            <td><span class="label">Valor Total dos Produtos</span><span class="value">R$ ${vProdutos.toFixed(2).replace('.', ',')}</span></td>
                        </tr>
                        <tr>
                            <td><span class="label">Valor do Frete</span><span class="value">R$ ${vFrete.toFixed(2).replace('.', ',')}</span></td>
                            <td><span class="label">Valor do Seguro</span><span class="value">0,00</span></td>
                            <td><span class="label">Valor Total da Nota</span><span class="value">R$ ${vFinal.toFixed(2).replace('.', ',')}</span></td>
                        </tr>
                    </table>

                    <div class="section-title">DADOS DOS PRODUTOS / SERVIÇOS</div>
                    <table class="prod-table">
                        <thead>
                            <tr>
                                <th style="width: 8%;">Cód. Prod.</th>
                                <th style="width: 40%;">Descrição do Produto</th>
                                <th style="width: 8%;">NCM</th>
                                <th style="width: 5%;">CFOP</th>
                                <th style="width: 4%;">UN</th>
                                <th style="width: 7%;">Qtd.</th>
                                <th style="width: 14%;">V. Unitário</th>
                                <th style="width: 14%;">V. Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itensHtml}
                        </tbody>
                    </table>
                </div>

                <div style="position: fixed; bottom: 20px; left: 0; right: 0; text-align: center; border-top: 1px solid #ccc; font-size: 7px; padding-top: 5px;">
                    DADOS ADICIONAIS: DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL. NÃO GERA DIREITO A CRÉDITO FISCAL DE IPI.
                </div>

                <script>
                    window.onload = function() {
                        setTimeout(() => { window.print(); }, 500);
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }
});
