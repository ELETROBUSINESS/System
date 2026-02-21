/* emissao.js */

document.addEventListener('DOMContentLoaded', () => {
    // --- State Management ---
    let currentStep = 1;
    const totalSteps = 3;
    let nfeData = {
        dest: {
            cpf: '',
            nome: '',
            telefone: '',
            email: '',
            endereco: ''
        },
        items: [],
        pag: {
            tipo: '01', // Dinheiro default
            valor: 0
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
    const inputDestEnd = document.getElementById('nfe-dest-end');
    const inputPagTipo = document.getElementById('nfe-pag-tipo');

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
                try {
                    const draft = JSON.parse(stored);
                    if (draft.data && (draft.data.dest.nome || draft.data.items.length > 0)) {
                        if (confirm(`Existe uma emissão em andamento para ${draft.data.dest.nome || 'Cliente'}. Deseja continuar?`)) {
                            loadDraft();
                            modalEmissao.classList.add('active');
                            return;
                        } else {
                            clearDraft(); // User chose to discard
                        }
                    }
                } catch (e) { }
            }

            resetForm();
            modalEmissao.classList.add('active');
            updatePreview();
        });
    }

    if (btnCloseEmissao) {
        btnCloseEmissao.addEventListener('click', () => {
            // Check if we should save before closing? updatePreview already saves on change.
            modalEmissao.classList.remove('active');
            renderDraftIndicator(); // Ensure list is updated
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
                // Validar Telefone e Email se necessário
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
    [inputDestDoc, inputDestNome, inputDestTel, inputDestEmail, inputDestEnd].forEach(input => {
        if (input) {
            input.addEventListener('input', () => {
                nfeData.dest.cpf = inputDestDoc ? inputDestDoc.value : '';
                nfeData.dest.nome = inputDestNome ? inputDestNome.value : 'Consumidor Final';
                nfeData.dest.telefone = inputDestTel ? inputDestTel.value : '';
                nfeData.dest.email = inputDestEmail ? inputDestEmail.value : '';
                nfeData.dest.endereco = inputDestEnd ? inputDestEnd.value : '';
                updatePreview();
            });
        }
    });



    // Phone Formatting (BR)
    if (inputDestTel) {
        inputDestTel.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 11) value = value.slice(0, 11);

            // Mask: (00) 00000-0000 or (00) 0000-0000
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


    // --- PRODUCT SEARCH LOGIC (Copied & Adapted) ---

    // --- PRODUCT SEARCH LOGIC (Advanced) ---

    // --- SEARCH LOGIC (HYBRID) ---

    // Close results when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.scan-search-container')) {
            searchResultsDiv.style.display = 'none';
        }
    });

    // --- BUSCA HÍBRIDA REFINADA ---

    barcodeInput.addEventListener('input', (e) => {
        const rawTerm = e.target.value;
        const term = rawTerm.trim().toUpperCase();

        if (!term) {
            searchResultsDiv.style.display = 'none';
            return;
        }

        // 1. LÓGICA NUMÉRICA (CÓDIGO DE BARRAS / ID)
        if (/^\d+$/.test(term)) {
            searchResultsDiv.style.display = 'none'; // Garante que não mostra lista

            // Busca Exata (String vs String para segurança)
            const exactMatch = localProductCache.find(p =>
                String(p.id).trim() === term ||
                (p.barcode && String(p.barcode).trim() === term) ||
                (p.codigo && String(p.codigo).trim() === term) // Fallback para campo 'codigo'
            );

            if (exactMatch) {
                addItemToNfe(exactMatch);
                e.target.value = ''; // Limpa input imediatamente
                // Feedback sonoro opcional: beep()
            }
            return;
        }

        // 2. LÓGICA DE TEXTO (NOME / MARCA)
        if (term.length >= 3) {
            const lowerTerm = term.toLowerCase();
            const terms = lowerTerm.split(' ').filter(t => t.length > 0); // Suporte a busca composta

            const matches = localProductCache.filter(p => {
                if (!p) return false;
                const pName = (p.name || '').toLowerCase();
                const pBrand = (p.brand || '').toLowerCase();

                // Todos os termos digitados devem existir no nome ou marca
                return terms.every(t => pName.includes(t) || pBrand.includes(t));
            }).slice(0, 50); // Mostra até 50 resultados

            renderSearchResults(matches);
        } else {
            searchResultsDiv.style.display = 'none';
        }
    });

    // Enter apenas para confirmar se necessário ou focar
    barcodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            // Se houver resultados visíveis no dropdown (texto), seleciona o primeiro
            if (searchResultsDiv.style.display !== 'none' && searchResultsDiv.children.length > 0) {
                searchResultsDiv.children[0].click();
            }
        }
    });

    // --- DRAFT / CACHE SYSTEM ---

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
                // Check if draft is recent? (Optional, skipping for now)

                nfeData = draft.data;
                currentStep = draft.step || 1;

                // Restore UI
                if (nfeData.dest) {
                    inputDestDoc.value = nfeData.dest.cpf || '';
                    inputDestNome.value = nfeData.dest.nome || '';
                    inputDestTel.value = nfeData.dest.telefone || '';
                    inputDestEmail.value = nfeData.dest.email || '';
                    inputDestEnd.value = nfeData.dest.endereco || '';
                }

                if (nfeData.pag && inputPagTipo) {
                    inputPagTipo.value = nfeData.pag.tipo || '01';
                }

                // If modal is open, jump to step. If closed, maybe just indicate availability.
                // User said "appear in list". We will render a card in the main list.
                renderDraftIndicator();

            } catch (e) {
                console.error("Erro ao carregar rascunho:", e);
            }
        }
    }

    function clearDraft() {
        localStorage.removeItem('nfe_draft');
        nfeData = { dest: { cpf: '', nome: '', telefone: '', email: '', endereco: '' }, items: [], pag: { tipo: '01', valor: 0 } }; // Reset locally too
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
                    <strong style="color: var(--nfe-accent);"><i class='bx bx-edit'></i> Emissão em Andamento (Rascunho)</strong>
                    <span>${clientName} • Etapa: ${stepName} • ${itemCount} itens</span>
                </div>
                <button class="btn-nfe-primary" style="padding: 0.5rem;" onclick="continueDraft()">Continuar</button>
            `;

            if (existingDraftCard) {
                existingDraftCard.innerHTML = html;
            } else {
                const card = document.createElement('div');
                card.id = 'draft-card-indicator';
                card.className = 'nfe-card';
                card.style.borderLeft = '4px solid var(--nfe-accent)';
                card.innerHTML = html;

                // Add to TOP of list
                if (listContainer) listContainer.insertBefore(card, listContainer.firstChild);
            }
        } else {
            if (existingDraftCard) existingDraftCard.remove();
        }
    }

    // Assign global function for the button click
    window.continueDraft = function () {
        const stored = localStorage.getItem('nfe_draft');
        if (stored) {
            const draft = JSON.parse(stored);
            nfeData = draft.data;
            currentStep = draft.step || 1;

            // Restore Form Values
            inputDestDoc.value = nfeData.dest.cpf || '';
            inputDestNome.value = nfeData.dest.nome || '';
            inputDestTel.value = nfeData.dest.telefone || '';
            inputDestEmail.value = nfeData.dest.email || '';
            inputDestEnd.value = nfeData.dest.endereco || '';
            inputPagTipo.value = nfeData.pag.tipo || '01';

            modalEmissao.classList.add('active');
            showStep(currentStep); // Navigate to correct step
            renderNfeItems();
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
            div.style.cssText = "padding: 10px; cursor: pointer; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items:center;";

            // Image handling
            let imgHTML = '';
            if (prod.imgUrl && prod.imgUrl.length > 10) {
                imgHTML = `<img src="${prod.imgUrl}" style="width:30px; height:30px; object-fit:cover; border-radius:4px; margin-right:8px;">`;
            } else {
                imgHTML = `<div style="width:30px; height:30px; background:#eee; border-radius:4px; margin-right:8px; display:flex; align-items:center; justify-content:center;"><i class='bx bx-box'></i></div>`;
            }

            div.innerHTML = `
                <div style="display:flex; align-items:center;">
                    ${imgHTML}
                    <div>
                        <strong style="font-size:0.9rem;">${prod.name}</strong><br>
                        <small style="color:#666;">Cod: ${prod.id}</small>
                    </div>
                </div>
                <div style="font-weight:600;">R$ ${parseFloat(prod.price).toFixed(2)}</div>
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
        // Check if already exists to increment qty
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


    // --- Helper Functions ---

    function showStep(step) {
        // Update UI Steps / Timeline
        document.querySelectorAll('.step-container').forEach(el => el.classList.remove('active'));
        document.getElementById(`step-${step}`).classList.add('active');

        // Update Buttons
        btnPrev.style.display = step === 1 ? 'none' : 'block';
        btnNext.textContent = step === totalSteps ? 'Emitir Nota' : 'Próximo';

        // Update Timeline UI
        document.querySelectorAll('.timeline-step').forEach(el => {
            const s = parseInt(el.dataset.step);
            if (s <= step) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
            // Mark completed previous steps
            if (s < step) {
                el.classList.add('completed');
            } else {
                el.classList.remove('completed');
            }
        });

        // If step 3, calculate totals
        if (step === 3) {
            calculateTotals();
        }

        saveDraft(); // Save step change
    }

    function resetForm() {
        currentStep = 1;
        nfeData.items = [];

        inputDestDoc.value = '';
        inputDestNome.value = '';
        inputDestTel.value = '';
        inputDestEmail.value = '';
        inputDestEnd.value = '';

        nfeData.dest = { cpf: '', nome: '', telefone: '', email: '', endereco: '' };

        showStep(1);
        renderNfeItems();
    }

    function renderNfeItems() {
        const container = document.getElementById('nfe-items-list');
        container.innerHTML = '';

        if (nfeData.items.length === 0) {
            container.innerHTML = '<p style="text-align:center; color: #aaa; margin-top:20px;">Nenhum produto adicionado.</p>';
            return;
        }

        // Add Header
        const header = document.createElement('div');
        header.className = 'nfe-items-header';
        header.innerHTML = `
            <span>Produto</span>
            <span style="text-align:center">Qtd.</span>
            <span style="text-align:center">Vl. Unit</span>
            <span style="text-align:right">Total</span>
            <span></span>
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

        // Listeners for Qty Buttons
        document.querySelectorAll('.btn-decrease').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.closest('.btn-decrease').dataset.index;
                // find input associated
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

        // Listeners for Direct Input Change (Qty)
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

        // Listeners for Price Change
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

        // Listeners for Delete
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
        // --- Destinatário ---
        const destNome = nfeData.dest.nome || 'CONSUMIDOR FINAL';
        const destDoc = nfeData.dest.cpf || '000.000.000-00';
        const destEnd = nfeData.dest.endereco || 'ENDEREÇO NÃO INFORMADO';

        document.getElementById('prev-dest-nome').textContent = destNome.toUpperCase();
        document.getElementById('prev-dest-data').textContent = destEnd.toUpperCase();
        document.getElementById('prev-dest-doc').textContent = destDoc;

        // --- Items Table ---
        const tbody = document.getElementById('prev-items-body');
        if (tbody) {
            tbody.innerHTML = '';
            let currentTotal = 0; // Renamed to avoid confusion

            nfeData.items.forEach(item => {
                const tr = document.createElement('tr');

                // Truncate description if too long
                let desc = (item.descricao || '').toUpperCase();
                if (desc.length > 25) desc = desc.substring(0, 25) + '...';

                // Ensure numeric values
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

            // --- Totals ---
            const totalFmt = "R$ " + currentTotal.toFixed(2).replace('.', ',');

            const vProdEl = document.getElementById('prev-vprod');
            const vTotalEl = document.getElementById('prev-vtotal');

            if (vProdEl) vProdEl.textContent = totalFmt;
            if (vTotalEl) vTotalEl.textContent = totalFmt;
        }

        // --- Mock Data (Static for now, dynamic later) ---
        // if no access key generated yet
        const accessKeyDisplay = document.getElementById('prev-access-key');
        if (accessKeyDisplay && accessKeyDisplay.textContent.startsWith('0000')) {
            // Mock key structure: 
            // UF(2) YYMM CNPJ(14) MOD(2) SER(3) NF(9) CONST(1) COD(8) DV(1)
            // simplified:
            accessKeyDisplay.textContent = "3523 1000 0000 0000 0000 5500 1000 0000 0112 3456 7890";
        }

        const nfeNumDisplay = document.getElementById('prev-nfe-num');
        if (nfeNumDisplay) nfeNumDisplay.textContent = "000." + Math.floor(Math.random() * 900 + 100); // Mock


        saveDraft(); // Auto-save on every update
    }

    // --- Event Listeners for Payment ---
    const pagSelect = document.getElementById('nfe-pag-tipo');
    const parcelasContainer = document.getElementById('nfe-parcelas-container');

    if (pagSelect && parcelasContainer) {
        pagSelect.addEventListener('change', (e) => {
            if (e.target.value === '03') { // 03 = Cartão de Crédito
                parcelasContainer.style.display = 'block';
            } else {
                parcelasContainer.style.display = 'none';
            }
        });
    }

    function calculateTotals() {
        let total = nfeData.items.reduce((acc, item) => acc + item.valorTotal, 0);
        nfeData.pag.valor = total;
    }

    async function finishEmission() {
        calculateTotals();

        const finalPayload = {
            emitente: {
                cnpj: "SEU_CNPJ_AQUI", // Backend fills?
                nome: "Sua Empresa"
            },
            destinatario: nfeData.dest,
            produtos: nfeData.items,
            pagamento: nfeData.pag,
            totais: {
                vProd: nfeData.pag.valor,
                vNF: nfeData.pag.valor
            }
        };

        console.log("Enviando NFE para backend:", finalPayload);

        // Alert user
        alert('Nota fiscal enviada para processamento! (Simulação)');
        modalEmissao.classList.remove('active');
        clearDraft(); // Clear draft on success

        // Here you would call API.js functionality or similar
    }

    // --- CPF/CNPJ Logic (Refined) ---
    const destCpfInput = document.getElementById('nfe-dest-doc');
    const loadingSpinner = document.getElementById('cnpj-loading');
    const feedbackMsg = document.getElementById('cnpj-feedback');

    if (destCpfInput) {
        // Auto-formatting mask & Trigger
        destCpfInput.addEventListener('input', async (e) => {
            let v = e.target.value.replace(/\D/g, '');
            let rawVal = v;

            if (v.length > 14) v = v.substring(0, 14);

            // Simple mask logic
            if (v.length <= 11) {
                // CPF mask: 000.000.000-00
                v = v.replace(/(\d{3})(\d)/, '$1.$2');
                v = v.replace(/(\d{3})(\d)/, '$1.$2');
                v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');

            } else {
                // CNPJ mask: 00.000.000/0000-00
                v = v.replace(/^(\d{2})(\d)/, '$1.$2');
                v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
                v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
                v = v.replace(/(\d{4})(\d)/, '$1-$2');
            }
            e.target.value = v;

            // Check for CNPJ trigger (14 digits)
            if (rawVal.length === 14) {
                if (loadingSpinner) loadingSpinner.style.display = 'block';
                if (feedbackMsg) feedbackMsg.style.display = 'none';
                destCpfInput.style.borderColor = '#e2e8f0';

                if (isValidCNPJ(rawVal)) {
                    try {
                        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${rawVal}`);
                        if (res.ok) {
                            const data = await res.json();

                            if (feedbackMsg) {
                                feedbackMsg.textContent = "CNPJ encontrado: " + (data.razao_social || data.nome_fantasia);
                                feedbackMsg.className = "form-text text-success";
                                feedbackMsg.style.display = 'block';
                            }

                            const nomeInput = document.getElementById('nfe-dest-nome');
                            if (nomeInput) nomeInput.value = data.razao_social || data.nome_fantasia || '';

                            const endInput = document.getElementById('nfe-dest-end');
                            if (endInput) {
                                const log = data.logradouro || '';
                                const num = data.numero || '';
                                const comp = data.complemento || '';
                                const bai = data.bairro || '';
                                const mun = data.municipio || '';
                                const uf = data.uf || '';
                                endInput.value = `${log}, ${num}${comp ? ' ' + comp : ''} - ${bai}, ${mun} - ${uf}`;
                            }

                            const emailInput = document.getElementById('nfe-dest-email');
                            if (emailInput && data.email) emailInput.value = data.email;

                            const telInput = document.getElementById('nfe-dest-tel');
                            // Format simple phone
                            const phone = data.ddd_telefone_1 ? `(${data.ddd_telefone_1}) ${data.telefone_1 || ''}` : '';
                            if (telInput && phone) telInput.value = phone;

                            nfeData.dest.cpf = rawVal;
                            nfeData.dest.nome = nomeInput ? nomeInput.value : '';
                            nfeData.dest.endereco = endInput ? endInput.value : '';
                            updatePreview();

                        } else {
                            throw new Error('Not found');
                        }
                    } catch (err) {
                        console.error("Erro CNPJ", err);
                        if (feedbackMsg) {
                            feedbackMsg.textContent = "CNPJ não encontrado.";
                            feedbackMsg.className = "form-text text-danger";
                            feedbackMsg.style.display = 'block';
                        }
                    } finally {
                        if (loadingSpinner) loadingSpinner.style.display = 'none';
                    }
                } else {
                    if (loadingSpinner) loadingSpinner.style.display = 'none';
                    if (feedbackMsg) {
                        feedbackMsg.textContent = "CNPJ Inválido logicamente.";
                        feedbackMsg.className = "form-text text-danger";
                        feedbackMsg.style.display = 'block';
                    }
                    destCpfInput.style.borderColor = 'red';
                }
            } else {
                if (loadingSpinner) loadingSpinner.style.display = 'none';
                if (feedbackMsg) feedbackMsg.style.display = 'none';
                destCpfInput.style.borderColor = '#e2e8f0';
            }
        });

        // Blur validation just for visual check
        destCpfInput.addEventListener('blur', (e) => {
            const rawVal = e.target.value.replace(/\\D/g, '');
            if (rawVal.length === 11 && !isValidCPF(rawVal)) {
                if (feedbackMsg) {
                    feedbackMsg.textContent = "CPF Inválido.";
                    feedbackMsg.className = "form-text text-danger";
                    feedbackMsg.style.display = 'block';
                }
                e.target.style.borderColor = 'red';
            }
        });
    }

    // Helper: CPF Validator
    function isValidCPF(cpf) {
        if (typeof cpf !== "string") return false;
        cpf = cpf.replace(/[\s.-]*/igm, '');
        if (cpf.length !== 11 || !Array.from(cpf).filter(e => e !== cpf[0]).length) {
            return false;
        }
        var soma = 0;
        var resto;
        for (var i = 1; i <= 9; i++)
            soma = soma + parseInt(cpf.substring(i - 1, i)) * (11 - i);
        resto = (soma * 10) % 11;
        if ((resto == 10) || (resto == 11)) resto = 0;
        if (resto != parseInt(cpf.substring(9, 10))) return false;
        soma = 0;
        for (var i = 1; i <= 10; i++)
            soma = soma + parseInt(cpf.substring(i - 1, i)) * (12 - i);
        resto = (soma * 10) % 11;
        if ((resto == 10) || (resto == 11)) resto = 0;
        if (resto != parseInt(cpf.substring(10, 11))) return false;
        return true;
    }

    // Helper: CNPJ Validator
    function isValidCNPJ(cnpj) {
        cnpj = cnpj.replace(/[^\d]+/g, '');
        if (cnpj == '') return false;
        if (cnpj.length != 14) return false;
        // Elimina CNPJs invalidos conhecidos
        if (cnpj == "00000000000000" ||
            cnpj == "11111111111111" ||
            cnpj == "22222222222222" ||
            cnpj == "33333333333333" ||
            cnpj == "44444444444444" ||
            cnpj == "55555555555555" ||
            cnpj == "66666666666666" ||
            cnpj == "77777777777777" ||
            cnpj == "88888888888888" ||
            cnpj == "99999999999999")
            return false;

        // Valida DVs
        let tamanho = cnpj.length - 2
        let numeros = cnpj.substring(0, tamanho);
        let digitos = cnpj.substring(tamanho);
        let soma = 0;
        let pos = tamanho - 7;
        for (let i = tamanho; i >= 1; i--) {
            soma += numeros.charAt(tamanho - i) * pos--;
            if (pos < 2) pos = 9;
        }
        let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
        if (resultado != digitos.charAt(0)) return false;

        tamanho = tamanho + 1;
        numeros = cnpj.substring(0, tamanho);
        soma = 0;
        pos = tamanho - 7;
        for (let i = tamanho; i >= 1; i--) {
            soma += numeros.charAt(tamanho - i) * pos--;
            if (pos < 2) pos = 9;
        }
        resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
        if (resultado != digitos.charAt(1)) return false;

        return true;
    }
});
