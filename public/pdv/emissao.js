/* emissao.js */

document.addEventListener('DOMContentLoaded', () => {
    // --- State Management ---
    let currentStep = 1;
    const totalSteps = 4;
    const FISCAL_API_URL = "https://southamerica-east1-super-app25.cloudfunctions.net";

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
            uf: 'PA'
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

    function renderHistory() {
        const listContainer = document.getElementById('nfe-history-list');
        if (!listContainer) return;

        // Simulate a small delay for skeletons
        setTimeout(() => {
            listContainer.innerHTML = ''; // Clear skeletons

            // Re-render draft if it exists
            renderDraftIndicator();

            // Check if there are any real history items (mock check for now)
            const draftExists = localStorage.getItem('nfe_draft');
            if (!draftExists && listContainer.children.length === 0) {
                listContainer.innerHTML = `
                    <div class="empty-state-list" style="text-align:center; padding: 4rem 1rem;">
                        <i class='bx bx-history' style="font-size: 3rem; color: #ddd; margin-bottom: 1rem;"></i>
                        <p style="color: #aaa;">Nenhuma nota fiscal emitida até o momento.</p>
                    </div>
                `;
            }
        }, 800);
    }

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
        });
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
    [inputDestDoc, inputDestNome, inputDestTel, inputDestEmail, inputDestRua, inputDestNum, inputDestBairro, inputDestCep, inputDestMunicipio, inputDestUf].forEach(input => {
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
            dest: { cpf: '', nome: '', telefone: '', email: '', rua: '', num: '', bairro: '', cep: '', municipio: '', uf: 'PA' },
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
        nfeData.dest = { cpf: '', nome: '', telefone: '', email: '', rua: '', num: '', bairro: '', cep: '', municipio: '', uf: 'PA' };
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
        // FIX NUMBER TO 67
        if (nfeNumDisplay) {
            nfeNumDisplay.textContent = "000.067";
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
            nNF: "67" // Fixed as requested
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
                alert(`NF-e Emitida com Sucesso!\nNúmero: ${result.nNF}\nChave: ${result.chave}`);
                modalEmissao.classList.remove('active');
                clearDraft();
                location.reload(); // Refresh to see history if implemented
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
});
