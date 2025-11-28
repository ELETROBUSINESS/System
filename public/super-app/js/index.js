// js/index.js

const STORE_OWNER_UID = "3zYT9Y6hXWeJSuvmEYP4FMZa5gI2"; 
const APP_ID = 'floralchic-loja';

let allProductsCache = [];

document.addEventListener("DOMContentLoaded", () => {
    initSlider();
    setupSearch();
    
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (productId) {
        loadProductDetail(productId);
    } else {
        loadHomeProducts();
    }
});

function parseValue(val) {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    let str = String(val);
    str = str.replace(/[^\d,.-]/g, '');
    str = str.replace(',', '.');
    return parseFloat(str) || 0;
}

// --- BUSCA ---
function setupSearch() {
    const searchInput = document.querySelector('.search-bar input');
    const dropdown = document.getElementById('search-dropdown');
    if (!searchInput || !dropdown) return;

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        if (term.length === 0) {
            dropdown.classList.remove('active');
            dropdown.innerHTML = '';
            return;
        }
        const filtered = allProductsCache.filter(prod => prod.name.toLowerCase().includes(term));
        if (filtered.length === 0) {
            dropdown.innerHTML = `<div style="padding:15px; color:#666; font-size:0.9rem;">Nenhum resultado.</div>`;
            dropdown.classList.add('active');
            return;
        }
        renderDropdownResults(filtered, dropdown);
    });

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });
}

function renderDropdownResults(products, container) {
    const suggestions = products.slice(0, 5);
    const visuals = products.slice(0, 3);
    let html = `<ul class="search-suggestions-list">`;
    suggestions.forEach(prod => {
        html += `<li class="search-suggestion-item" onclick="goToProduct('${prod.id}')"><i class='bx bx-search'></i>${prod.name}</li>`;
    });
    html += `</ul>`;
    if (visuals.length > 0) {
        html += `<div class="search-visual-title">Principais Resultados</div><div class="search-visual-grid">`;
        visuals.forEach(prod => {
            const imgUrl = prod.imgUrl || 'https://placehold.co/100x100/eee/999?text=Prod';
            html += `<div class="search-mini-card" onclick="goToProduct('${prod.id}')"><img src="${imgUrl}" alt="${prod.name}"><span>${prod.name}</span></div>`;
        });
        html += `</div>`;
    }
    container.innerHTML = html;
    container.classList.add('active');
}

window.goToProduct = function(id) {
    window.location.href = `index.html?id=${id}`;
}

// --- HOME ---
async function loadHomeProducts() {
    const container = document.getElementById('firebase-products-container');
    try {
        const productsRef = db.collection('artifacts').doc(APP_ID)
                              .collection('users').doc(STORE_OWNER_UID)
                              .collection('products');
        const snapshot = await productsRef.get();
        if(container) container.innerHTML = ''; 

        if (snapshot.empty) {
            if(container) container.innerHTML = "<p style='text-align:center; grid-column:1/-1;'>Nenhum produto encontrado.</p>";
            return;
        }
        allProductsCache = [];
        snapshot.forEach(doc => {
            const prod = doc.data();
            prod.id = doc.id;
            allProductsCache.push(prod);
            if(container) renderProductCard(prod.id, prod, container);
        });
        startDetailTimer(); // Timer da Home
    } catch (error) {
        console.error("Erro produtos:", error);
    }
}

function renderProductCard(id, prod, container) {
    const imgUrl = prod.imgUrl || 'https://placehold.co/400x400/EBEBEB/333?text=Sem+Foto';
    const valPriceNormal = parseValue(prod.price);
    const valPriceOferta = parseValue(prod['price-oferta']);
    const hasOffer = (valPriceOferta > 0 && valPriceOferta < valPriceNormal);
    
    let priceHtml = '';
    let finalPriceToCart = valPriceNormal;

    if (hasOffer) {
        finalPriceToCart = valPriceOferta;
        const fmtOld = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valPriceNormal);
        const fmtNew = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valPriceOferta);
        const discountVal = valPriceNormal - valPriceOferta;
        const discountFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(discountVal);
        
        priceHtml = `
            <div class="price-container">
                <span class="price-old">${fmtOld}</span>
                <div class="price-wrapper"><span class="price-new">${fmtNew}</span></div>
                <span class="economy-text">Economize ${discountFmt}</span>
            </div>`;
    } else {
        const fmtNormal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valPriceNormal);
        priceHtml = `
            <div class="price-container">
                <span class="price-old" style="visibility:hidden">-</span>
                <span class="price-new">${fmtNormal}</span>
                <span class="economy-text" style="visibility:hidden">-</span>
            </div>`;
    }

    const cardHtml = `
        <div class="product-card" onclick="window.location.href='index.html?id=${id}'">
            <div class="product-image"><img src="${imgUrl}" alt="${prod.name}" loading="lazy"></div>
            <div class="product-info">
                <h4 class="product-name">${prod.name}</h4>
                ${priceHtml}
                <div class="free-shipping"><i class='bx bxs-truck'></i> Frete Grátis</div>
                <button class="cta-button" onclick="event.stopPropagation(); addToCartDirect('${id}', '${prod.name}', ${finalPriceToCart}, '${imgUrl}')">Comprar</button>
            </div>
        </div>`;
    container.innerHTML += cardHtml;
}

// --- DETALHES (CORRIGIDO) ---
async function loadProductDetail(id) {
    document.getElementById('home-view').style.display = 'none';
    document.getElementById('product-detail-view').style.display = 'block';
    window.scrollTo(0, 0);

    try {
        const docRef = db.collection('artifacts').doc(APP_ID)
                         .collection('users').doc(STORE_OWNER_UID)
                         .collection('products').doc(id);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            window.location.href = 'index.html';
            return;
        }

        const prod = docSnap.data();
        const valPriceNormal = parseValue(prod.price);
        const valPriceOferta = parseValue(prod['price-oferta']);
        const hasOffer = (valPriceOferta > 0 && valPriceOferta < valPriceNormal);

        let finalPrice = valPriceNormal;
        let displayPrice = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valPriceNormal);

        // Reset visual seguro
        const timerFixed = document.getElementById('fixed-offer-timer');
        const oldPriceEl = document.getElementById('p-detail-old-price');
        const savingsEl = document.getElementById('p-detail-savings');
        
        if(timerFixed) timerFixed.style.display = 'none';
        if(oldPriceEl) oldPriceEl.style.display = 'none';
        if(savingsEl) savingsEl.style.display = 'none';

        if (hasOffer) {
            finalPrice = valPriceOferta;
            displayPrice = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valPriceOferta);
            const oldDisplay = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valPriceNormal);
            
            if(oldPriceEl) { oldPriceEl.innerText = oldDisplay; oldPriceEl.style.display = 'block'; }

            const savings = valPriceNormal - valPriceOferta;
            const savingsFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(savings);
            
            if(savingsEl) { savingsEl.innerText = `Você economiza ${savingsFmt}`; savingsEl.style.display = 'block'; }

            if(timerFixed) timerFixed.style.display = 'flex';
            startDetailTimer();
        }

        document.getElementById('p-detail-img').src = prod.imgUrl || 'https://placehold.co/600x600/EBEBEB/333?text=Sem+Foto';
        document.getElementById('p-detail-name').innerText = prod.name;
        document.getElementById('p-detail-price').innerText = displayPrice;
        document.getElementById('p-detail-sold').innerText = "0"; 
        document.getElementById('p-detail-desc').innerText = prod.desc || "Sem descrição.";
        document.title = `${prod.name} | Dtudo`;

        document.getElementById('btn-add-cart-detail').onclick = () => { 
            addToCartDirect(id, prod.name, finalPrice, prod.imgUrl); 
            showToast("Adicionado ao carrinho!", "success");
        };
        document.getElementById('btn-buy-now').onclick = () => {
            addToCartDirect(id, prod.name, finalPrice, prod.imgUrl);
            window.location.href = 'carrinho.html';
        };

    } catch (error) {
        console.error("Erro detalhes:", error);
    }
}

// --- FRETE (CORRIGIDO) ---
window.calculateDetailShipping = function() {
    const cepInput = document.getElementById('detail-cep');
    const resultDiv = document.getElementById('detail-shipping-result');
    const statusText = document.getElementById('shipping-status-text');

    // Validação de segurança se os elementos não existirem
    if (!cepInput || !resultDiv || !statusText) return;

    const cepVal = cepInput.value.replace(/\D/g, '');

    if (cepVal.length !== 8) {
        showToast('Digite um CEP válido (8 dígitos).', 'error');
        return;
    }

    statusText.innerText = "Calculando...";
    resultDiv.style.display = 'none';
    
    setTimeout(() => {
        statusText.innerHTML = `<span style="color: #00a650;">Frete Grátis Disponível</span>`;
        resultDiv.innerHTML = '';

        if (cepVal === '68637000') {
            resultDiv.innerHTML = `
                <div class="shipping-option"><i class='bx bxs-truck'></i><div class="shipping-info"><span class="shipping-title-opt">Receber em casa (Grátis)</span><span class="shipping-subtitle-opt">Chega hoje comprando agora ou em até 1 dia últil</span></div></div>
                <div class="shipping-option"><i class='bx bxs-store'></i><div class="shipping-info"><span class="shipping-title-opt">Retirar na Loja (Grátis)</span><span class="shipping-subtitle-opt">Disponível em 1 hora</span></div></div>
            `;
        } else {
            const randomPrice = (Math.random() * (45 - 20) + 20).toFixed(2).replace('.', ',');
            resultDiv.innerHTML = `
                <div class="shipping-option"><i class='bx bxs-truck' style="color:#333"></i><div class="shipping-info"><span class="shipping-title-opt" style="color:#333">Entrega Padrão: R$ ${randomPrice}</span><span class="shipping-subtitle-opt">Chega em 7 a 12 dias úteis</span></div></div>
            `;
        }
        resultDiv.style.display = 'flex';
    }, 600);
}

// --- TIMER ---
let timerInterval;
function startDetailTimer() {
    if (timerInterval) clearInterval(timerInterval);
    const targetDate = new Date('2025-11-29T21:00:00').getTime();
    
    const displayHome = document.getElementById('home-timer-countdown'); 
    const displayFixed = document.getElementById('p-timer-countdown-fixed'); 

    function updateTimer() {
        const now = new Date().getTime();
        const distance = targetDate - now;

        if (distance < 0) {
            clearInterval(timerInterval);
            if(displayFixed) displayFixed.innerText = "EXPIRADO";
            if(displayHome) displayHome.innerText = "EXPIRADO";
            const fixedBar = document.getElementById('fixed-offer-timer');
            if(fixedBar) fixedBar.style.display = 'none';
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        const text = `${days > 0 ? days + 'd ' : ''}${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;

        if(displayFixed) displayFixed.innerText = text;
        if(displayHome) displayHome.innerText = text;
    }
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
}

function addToCartDirect(id, name, price, image) {
    if (typeof CartManager !== 'undefined') {
        CartManager.add({ id: id, name: name, priceNew: parseFloat(price), priceOld: parseFloat(price), image: image, quantity: 1, description: "" });
    }
}

function initSlider() {
    const sliderWrapper = document.querySelector(".slider-wrapper");
    if (!sliderWrapper) return;
    const slides = document.querySelectorAll(".slide");
    let slideIndex = 0;
    setInterval(() => {
        slideIndex = (slideIndex + 1) % slides.length;
        sliderWrapper.style.transform = `translateX(-${slideIndex * 100}%)`;
    }, 5000);
}

// --- No final ou início do seu js/index.js ---

// 1. Função que conta os itens e atualiza o visual
function updateCartBadges() {
    let cart = [];
    
    // Tenta ler o carrinho. NOTA: Verifique no seu 'global.js' qual a chave usada no localStorage.
    // Geralmente é algo como 'dtudo_cart', 'shopping_cart' ou 'cart'.
    // Vou tentar ler a variável global CartManager se ela expor os itens, senão tento localStorage.
    
    try {
        if (typeof CartManager !== 'undefined' && CartManager.items) {
            cart = CartManager.items;
        } else {
            // Substitua 'dtudo_cart' pelo nome exato que está no seu global.js se não funcionar
            cart = JSON.parse(localStorage.getItem('dtudo_cart') || '[]'); 
        }
    } catch (e) {
        console.error("Erro ao ler carrinho:", e);
    }

    // Soma a quantidade de todos os produtos
    const totalItems = cart.reduce((total, item) => total + (item.quantity || 1), 0);

    // Atualiza os elementos HTML (Mobile e Desktop)
    const badgeMobile = document.getElementById('cart-badge');
    const badgeDesktop = document.getElementById('cart-badge-desktop');

    // Função auxiliar para mostrar/esconder
    const updateElement = (el) => {
        if (el) {
            el.innerText = totalItems;
            // Se tiver 0 itens, esconde a bolinha. Se tiver > 0, mostra.
            el.style.display = totalItems > 0 ? 'flex' : 'none';
            
            // Adiciona uma animação de "pulo" para chamar atenção
            el.classList.remove('pulse-animation');
            void el.offsetWidth; // Trigger reflow
            if (totalItems > 0) el.classList.add('pulse-animation');
        }
    };

    updateElement(badgeMobile);
    updateElement(badgeDesktop);
}

// 2. Modifique a função addToCartDirect existente para chamar a atualização
function addToCartDirect(id, name, price, image) {
    if (typeof CartManager !== 'undefined') {
        CartManager.add({ 
            id: id, 
            name: name, 
            priceNew: parseFloat(price), 
            priceOld: parseFloat(price), 
            image: image, 
            quantity: 1, 
            description: "" 
        });
        
        // CHAMA A ATUALIZAÇÃO IMEDIATAMENTE APÓS ADICIONAR
        updateCartBadges(); 
        
        // Feedback visual extra (opcional)
        showToast(`+1 ${name} adicionado!`, "success");
    } else {
        console.error("CartManager não encontrado.");
    }
}

// 3. Garanta que a contagem atualize ao carregar a página
document.addEventListener("DOMContentLoaded", () => {
    // ... seus outros inits (initSlider, setupSearch, etc) ...
    
    updateCartBadges(); // <--- ADICIONE ISSO NO SEU DOMContentLoaded
});