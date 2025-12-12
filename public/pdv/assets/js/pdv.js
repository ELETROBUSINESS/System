// ============================================================
// LÓGICA DO PDV (Ponto de Venda)
// ============================================================

// Estado Local
let cart = JSON.parse(localStorage.getItem('pdv_cart_backup')) || [];
let localProductCache = null;
let lastSaleData = null;
let selectedPaymentMethod = null;
let selectedCrediarioClient = null;
let currentSplitPayments = { method1: null, value1: 0, method2: null, value2: 0, remaining: 0 };
let discount = 0;
let isSmartRoundingEnabled = true;

// Variáveis de Controle
let barcodeScanTimeout = null;
let currentSeller = localStorage.getItem('pdv_last_seller') || null;

// ============================================================
// 1. INICIALIZAÇÃO E CACHE
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // ... (Seu código de carrinho, scanner, etc. continua aqui) ...

    // ============================================================
    // LÓGICA DE ABERTURA DE CAIXA (CORRIGIDA)
    // ============================================================
    const openCaixaForm = document.getElementById('open-caixa-form');
    const openCaixaSemValorCheckbox = document.getElementById('open-caixa-sem-valor');
    const openCaixaNotasInput = document.getElementById('open-caixa-notas');
    const openCaixaMoedasInput = document.getElementById('open-caixa-moedas');
    const openCaixaSaveBtn = document.getElementById('open-caixa-save-btn');

    // Toggle do Checkbox
    if (openCaixaSemValorCheckbox) {
        openCaixaSemValorCheckbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            openCaixaNotasInput.disabled = isChecked;
            openCaixaMoedasInput.disabled = isChecked;
            if (isChecked) {
                openCaixaNotasInput.value = '0.00';
                openCaixaMoedasInput.value = '0.00';
            } else {
                openCaixaNotasInput.value = '';
                openCaixaMoedasInput.value = '';
            }
        });
    }

    // SUBMIT DO FORMULÁRIO
    if (openCaixaForm) {
        openCaixaForm.addEventListener('submit', async (e) => {
            // 1. IMPEDE O RELOAD DA PÁGINA
            e.preventDefault(); 
            
            const notas = parseFloat(openCaixaNotasInput.value) || 0;
            const moedas = parseFloat(openCaixaMoedasInput.value) || 0;
            const isSemValor = openCaixaSemValorCheckbox.checked;

            // Validação simples
            if (!isSemValor && notas <= 0 && moedas <= 0) {
                alert("Insira um valor ou marque 'Abrir sem valor'.");
                return;
            }

            // Feedback Visual
            const originalText = openCaixaSaveBtn.innerHTML;
            openCaixaSaveBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Abrindo...";
            openCaixaSaveBtn.disabled = true;

            try {
                // Aqui você faria a chamada para sua API (Google Scripts)
                // await abrirCaixaAPI(...) 
                
                // SIMULAÇÃO DE SUCESSO DA API
                console.log("Caixa aberto com sucesso.");
                
                // 2. SALVA O TOKEN
                window.salvarToken();

                // 3. LIBERA A TELA IMEDIATAMENTE
                window.liberarSistema();

                // Foca no scanner
                setTimeout(() => {
                    const scanner = document.getElementById('barcode-input');
                    if(scanner) scanner.focus();
                }, 500);

            } catch (error) {
                console.error("Erro ao abrir caixa:", error);
                alert("Erro ao abrir caixa.");
            } finally {
                openCaixaSaveBtn.innerHTML = originalText;
                openCaixaSaveBtn.disabled = false;
            }
        });
    }
});

// Salvar Backup Local (Persistência)
const saveCartState = () => localStorage.setItem('pdv_cart_backup', JSON.stringify(cart));

// Busca Unificada de Produtos (Sheets + Firebase)
async function carregarCacheDeProdutos() {
    const barcodeInput = document.getElementById('barcode-input');
    const hint = document.getElementById('barcode-hint');
    
    barcodeInput.placeholder = "Sincronizando estoque...";
    barcodeInput.disabled = true;

    try {
        // Busca paralela (Google Sheets + Firebase)
        // Assumindo que SCRIPT_URL e FIREBASE_CONFIG_ID estão em utils.js
        const [sheetResponse, firebaseProducts] = await Promise.all([
            fetch(SCRIPT_URL + "?action=listarProdutos"),
            fetchFirebaseProducts()
        ]);

        // Processa Google Sheets
        const sheetResult = await sheetResponse.json();
        let sheetProducts = (sheetResult.status === 'success') ? sheetResult.data : [];

        // Mescla (Firebase ganha preferência)
        const productMap = new Map();
        sheetProducts.forEach(p => productMap.set(String(p.id).trim(), { ...p, price: parseFloat(p.price) }));
        firebaseProducts.forEach(p => productMap.set(String(p.id).trim(), p));

        localProductCache = Array.from(productMap.values());
        
        console.log(`Cache carregado: ${localProductCache.length} produtos.`);
        hint.textContent = "Pronto. F2 para focar.";

    } catch (error) {
        console.error("Erro cache:", error);
        showCustomAlert("Erro Sincronização", "Falha ao carregar produtos. Verifique internet.");
        localProductCache = [];
    } finally {
        barcodeInput.disabled = false;
        barcodeInput.placeholder = "Ler código de barras...";
        barcodeInput.focus();
    }
}

// Auxiliar Firebase
async function fetchFirebaseProducts() {
    try {
        const snapshot = await db.collection('artifacts').doc(FIREBASE_CONFIG_ID)
            .collection('users').doc(STORE_OWNER_UID)
            .collection('products').get();
        
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: data.code || doc.id,
                name: data.name,
                price: parseValueFirebase(data.price), // precisa estar em utils.js ou aqui
                priceOffer: parseValueFirebase(data['price-oferta']),
                stock: data.stock || 0,
                isFirebase: true,
                docId: doc.id
            };
        }).filter(p => p.id);
    } catch (e) {
        console.error(e);
        return [];
    }
}

// ============================================================
// 2. OPERAÇÕES DO CARRINHO
// ============================================================

const addToCart = (product) => {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        // Lógica de Preço e Oferta
        let basePrice = product.price;
        let finalPrice = basePrice;
        let discountPct = 0;
        let isOffer = false;

        if (product.isFirebase && product.priceOffer > 0 && product.priceOffer < basePrice) {
            finalPrice = product.priceOffer;
            discountPct = ((basePrice - finalPrice) / basePrice) * 100;
            isOffer = true;
        }

        cart.push({
            ...product,
            originalPrice: basePrice,
            price: finalPrice,
            quantity: 1,
            discountPercent: discountPct,
            hasOffer: isOffer
        });
    }
    saveCartState();
    renderCart();
};

const removeFromCart = (id) => {
    cart = cart.filter(item => item.id !== id);
    saveCartState();
    renderCart();
};

const updateCartItem = (id, field, value) => {
    const item = cart.find(i => i.id === id);
    if (!item) return;

    if (field === 'quantity') {
        if (value === 'increase') item.quantity++;
        else if (value === 'decrease') {
            item.quantity--;
            if (item.quantity === 0) return removeFromCart(id);
        }
    } else if (field === 'discountPercent' && !item.isFirebase) {
        // Permite desconto manual no item se não for oferta do sistema
        let percent = parseFloat(value) || 0;
        if (percent > 100) percent = 100; if (percent < 0) percent = 0;
        item.discountPercent = percent;
        item.price = item.originalPrice * (1 - (percent / 100));
    }
    saveCartState();
    renderCart();
};

const renderCart = () => {
    const tbody = document.getElementById('cart-items-body');
    const emptyState = document.getElementById('empty-state');
    const table = document.getElementById('item-list-table');
    
    tbody.innerHTML = '';

    if (cart.length === 0) {
        emptyState.style.display = 'flex';
        table.style.display = 'none';
    } else {
        emptyState.style.display = 'none';
        table.style.display = 'table';

        cart.forEach(item => {
            const tr = document.createElement('tr');
            
            // Input de desconto (apenas se não for oferta firebase)
            let discountHtml = item.isFirebase 
                ? `<span style="color:var(--success-green); font-weight:bold">${item.discountPercent.toFixed(0)}%</span>`
                : `<input type="number" style="width:50px; text-align:center" value="${item.discountPercent}" onchange="updateCartItem('${item.id}', 'discountPercent', this.value)"> %`;

            tr.innerHTML = `
                <td>
                    <div class="product-info">
                        <div class="product-image"><i class='bx bx-package'></i></div>
                        <div>
                            <div style="font-weight:600">${item.name}</div>
                            <div style="font-size:0.8rem; color:#777">#${item.id}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="qty-control">
                        <button class="qty-btn" onclick="updateCartItem('${item.id}', 'quantity', 'decrease')">-</button>
                        <span>${item.quantity}</span>
                        <button class="qty-btn" onclick="updateCartItem('${item.id}', 'quantity', 'increase')">+</button>
                    </div>
                </td>
                <td>${formatCurrency(item.originalPrice)}</td>
                <td style="text-align:center">${discountHtml}</td>
                <td style="font-weight:700">${formatCurrency(item.price * item.quantity)}</td>
                <td><button onclick="removeFromCart('${item.id}')" style="color:red; background:none; border:none; cursor:pointer"><i class='bx bx-trash'></i></button></td>
            `;
            tbody.appendChild(tr);
        });
    }
    updateSummary();
};

const updateSummary = () => {
    // Cálculos
    const subtotalGross = cart.reduce((acc, item) => acc + (item.originalPrice * item.quantity), 0);
    const totalNetItems = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const itemDiscount = subtotalGross - totalNetItems;
    
    // Desconto Global
    const totalDiscount = itemDiscount + discount;
    const finalTotal = subtotalGross - totalDiscount;

    // DOM
    document.getElementById('item-count').textContent = cart.reduce((acc, i) => acc + i.quantity, 0);
    document.getElementById('summary-subtotal').textContent = formatCurrency(subtotalGross);
    document.getElementById('summary-discount').textContent = `- ${formatCurrency(totalDiscount)}`;
    document.getElementById('summary-total').textContent = formatCurrency(finalTotal);
    
    // Salva dados para finalização
    lastSaleData = {
        subtotal: subtotalGross,
        discount: totalDiscount,
        total: finalTotal
    };
};

// ============================================================
// 3. SCANNER E INPUTS
// ============================================================

const barcodeInput = document.getElementById('barcode-input');
const debounce = (func, delay) => { clearTimeout(barcodeScanTimeout); barcodeScanTimeout = setTimeout(func, delay); };

const handleScan = () => {
    const code = barcodeInput.value.trim();
    if (!code) return;

    if (localProductCache) {
        const product = localProductCache.find(p => p.id === code);
        if (product) {
            addToCart(product);
            barcodeInput.value = '';
        } else {
            // Produto não encontrado -> Modal Rápido
            document.getElementById('scanned-barcode').textContent = code;
            document.getElementById('quick-product-name').value = '';
            document.getElementById('quick-product-price').value = '';
            openModal(document.getElementById('quick-add-modal'));
            // Guarda código temporariamente
            barcodeInput.dataset.tempCode = code;
            barcodeInput.value = ''; 
        }
    }
};

barcodeInput.addEventListener('input', () => debounce(handleScan, 300));

// ============================================================
// 4. PAGAMENTO E FINALIZAÇÃO
// ============================================================

// Abertura do Modal de Pagamento
document.getElementById('payment-toggle-row').addEventListener('click', () => {
    if (cart.length === 0) return showCustomAlert("Vazio", "Adicione itens ao carrinho.");
    document.getElementById('payment-total').textContent = formatCurrency(lastSaleData.total);
    openModal(document.getElementById('payment-modal'));
});

// Seleção de Método
document.querySelectorAll('.payment-option').forEach(opt => {
    opt.addEventListener('click', () => {
        const method = opt.dataset.method;
        if (method === 'Crediário') {
            closeModal(document.getElementById('payment-modal'));
            openModal(document.getElementById('client-selection-modal'));
            // Lógica de busca de cliente está em clientes.js, 
            // mas aqui precisamos integrar se o usuário escolher.
            // Para simplificar: ao selecionar cliente, define selectedCrediarioClient e selectedPaymentMethod='Crediário'
        } else {
            selectedPaymentMethod = method;
            document.getElementById('summary-payment-method').textContent = method;
            updateSummary(); // Atualiza UI
            closeModal(document.getElementById('payment-modal'));
        }
    });
});

// Finalizar Venda (Botão F9)
document.getElementById('finish-sale-btn').addEventListener('click', () => {
    if (cart.length === 0) return showCustomAlert("Erro", "Carrinho vazio.");
    if (!selectedPaymentMethod) {
        showCustomAlert("Atenção", "Selecione a forma de pagamento.");
        return openModal(document.getElementById('payment-modal'));
    }
    // Abre seleção de impressão
    openModal(document.getElementById('print-selection-modal'));
});

// Processo de Registro (Ao clicar em imprimir)
const processFinalSale = async (printFormat) => {
    const loading = document.getElementById('loading-overlay');
    loading.classList.remove('hidden');
    loading.querySelector('p').textContent = "Registrando venda...";

    try {
        const now = new Date();
        const timestamp = formatTimestamp(now);

        // 1. Prepara Payload
        const salePayload = {
            action: "registrarHistorico",
            cliente: selectedCrediarioClient ? selectedCrediarioClient.nomeExibicao : "Consumidor Final",
            vendedor: currentSeller || "Caixa",
            valor: lastSaleData.total,
            produtos: cart.map(i => `${i.quantity}x ${i.name}`).join(', '),
            pagamento: selectedPaymentMethod,
            idVenda: timestamp
        };

        // 2. Envia para Scripts (Histórico e Fluxo)
        // Usamos fetch 'no-cors' ou normal dependendo do backend.
        // Aqui simulamos a chamada para garantir modularidade.
        const promises = [
            fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(salePayload) }),
            registrarVendaFinanceira(salePayload) // Função que envia pro REGISTRO_VENDA_SCRIPT_URL
        ];
        
        // 3. Abate Estoque Firebase
        promises.push(abaterEstoqueFirebase(cart));

        await Promise.all(promises);

        // 4. Imprime
        if (printFormat === 'thermal') printThermal();
        else printA4();

        // 5. Sucesso
        cart = [];
        saveCartState();
        renderCart();
        selectedPaymentMethod = null;
        selectedCrediarioClient = null;
        document.getElementById('summary-payment-method').textContent = "Não selecionado";
        
        loading.classList.add('hidden');
        closeModal(document.getElementById('print-selection-modal'));
        openModal(document.getElementById('receipt-modal'));

    } catch (error) {
        console.error("Erro venda:", error);
        loading.classList.add('hidden');
        showCustomAlert("Erro", "Falha ao registrar venda. Verifique conexão.");
    }
};

// Listeners de Impressão
document.getElementById('btn-print-thermal').onclick = () => processFinalSale('thermal');
document.getElementById('btn-print-a4').onclick = () => processFinalSale('a4');

// ============================================================
// 5. FUNÇÕES AUXILIARES (Estoque, Impressão)
// ============================================================

async function abaterEstoqueFirebase(itens) {
    const batch = db.batch();
    let hasUpdates = false;

    itens.forEach(item => {
        if (item.isFirebase && item.docId) {
            const ref = db.collection('artifacts').doc(FIREBASE_CONFIG_ID)
                .collection('users').doc(STORE_OWNER_UID)
                .collection('products').doc(item.docId);
            
            batch.update(ref, { 
                stock: firebase.firestore.FieldValue.increment(-item.quantity),
                updatedAt: new Date().toISOString()
            });
            hasUpdates = true;
        }
    });

    if (hasUpdates) await batch.commit();
}

async function registrarVendaFinanceira(data) {
    // Adaptação para o formato x-www-form-urlencoded que o Google Scripts costuma exigir
    const formData = new URLSearchParams();
    formData.append('formType', 'venda');
    formData.append('seller', 'nubia'); // Exemplo
    formData.append('type', 'entrada');
    formData.append('value', data.valor.toFixed(2));
    formData.append('payment', data.pagamento);
    formData.append('Timestamp', formatTimestamp(new Date()));
    
    await fetch(REGISTRO_VENDA_SCRIPT_URL, {
        method: "POST",
        body: formData.toString(),
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });
}

// Funções de Impressão (Simplificadas para o exemplo)
const printThermal = () => {
    // Gera HTML do cupom e abre janela de print
    const content = `<html><body><h3>Comprovante</h3><p>Total: ${formatCurrency(lastSaleData.total)}</p></body></html>`;
    const win = window.open('', '', 'width=300,height=600');
    win.document.write(content);
    win.print();
    // win.close(); // Opcional
};

const printA4 = () => {
    // Gera HTML A4
    const content = `<html><body><h1>Nota Auxiliar</h1><table border="1" width="100%">...</table></body></html>`;
    const win = window.open('', '', 'width=800,height=1100');
    win.document.write(content);
    win.print();
};

// Função Parse para limpar valores do Firebase
function parseValueFirebase(val) {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    return parseFloat(String(val).replace(',', '.')) || 0;
}

// Atalhos de Teclado
document.addEventListener('keydown', (e) => {
    if(e.key === 'F2') { e.preventDefault(); document.getElementById('barcode-input').focus(); }
    if(e.key === 'F3') { e.preventDefault(); document.getElementById('discount-toggle-row').click(); }
    if(e.key === 'F4') { e.preventDefault(); document.getElementById('payment-toggle-row').click(); }
    if(e.key === 'F9') { e.preventDefault(); document.getElementById('finish-sale-btn').click(); }
    // Esc fecha modais (já tratado no utils.js ou genericamente)
});