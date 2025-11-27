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

// --- FUNÇÃO DE LIMPEZA DE VALORES (BLINDADA) ---
function parseValue(val) {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    
    // 1. Converte para string
    let str = String(val);
    
    // 2. Remove tudo que não for número, ponto ou vírgula (ex: tira R$)
    str = str.replace(/[^\d,.-]/g, '');
    
    // 3. Se tiver vírgula, substitui por ponto para o JS entender
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

        const filtered = allProductsCache.filter(prod => 
            prod.name.toLowerCase().includes(term)
        );

        if (filtered.length === 0) {
            dropdown.innerHTML = `<div style="padding:15px; color:#666; font-size:0.9rem;">Nenhum resultado para "${term}"</div>`;
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
        html += `
            <li class="search-suggestion-item" onclick="goToProduct('${prod.id}')">
                <i class='bx bx-search'></i>
                ${prod.name}
            </li>
        `;
    });
    html += `</ul>`;

    if (visuals.length > 0) {
        html += `
            <div class="search-visual-title">Principais Resultados</div>
            <div class="search-visual-grid">
        `;
        visuals.forEach(prod => {
            const imgUrl = prod.imgUrl || 'https://placehold.co/100x100/eee/999?text=Prod';
            html += `
                <div class="search-mini-card" onclick="goToProduct('${prod.id}')">
                    <img src="${imgUrl}" alt="${prod.name}">
                    <span>${prod.name}</span>
                </div>
            `;
        });
        html += `</div>`;
    }

    container.innerHTML = html;
    container.classList.add('active');
}

window.goToProduct = function(id) {
    window.location.href = `index.html?id=${id}`;
}

// --- CARREGAMENTO HOME ---
async function loadHomeProducts() {
    const container = document.getElementById('firebase-products-container');
    
    try {
        const productsRef = db.collection('artifacts').doc(APP_ID)
                              .collection('users').doc(STORE_OWNER_UID)
                              .collection('products');
        
        const snapshot = await productsRef.get();
        container.innerHTML = ''; 

        if (snapshot.empty) {
            container.innerHTML = "<p style='text-align:center; grid-column:1/-1;'>Nenhum produto encontrado.</p>";
            return;
        }

        allProductsCache = [];

        snapshot.forEach(doc => {
            const prod = doc.data();
            prod.id = doc.id;
            allProductsCache.push(prod);
            renderProductCard(prod.id, prod, container);
        });

    } catch (error) {
        console.error("Erro ao carregar produtos:", error);
        container.innerHTML = "<p>Erro ao carregar ofertas.</p>";
    }
}

function renderProductCard(id, prod, container) {
    const imgUrl = prod.imgUrl || 'https://placehold.co/400x400/EBEBEB/333?text=Sem+Foto';
    
    // 1. Extrai os valores numéricos limpos
    const valPriceNormal = parseValue(prod.price);
    const valPriceOferta = parseValue(prod['price-oferta']);

    // 2. Define se existe oferta
    const hasOffer = (valPriceOferta > 0 && valPriceOferta < valPriceNormal);
    
    let priceHtml = '';
    let finalPriceToCart = valPriceNormal;

    if (hasOffer) {
        // --- TEM OFERTA ---
        finalPriceToCart = valPriceOferta;
        
        const fmtOld = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valPriceNormal);
        const fmtNew = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valPriceOferta);
        
        // Calcula quanto economiza em Reais
        const discountVal = valPriceNormal - valPriceOferta;
        const discountFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(discountVal);
        
        priceHtml = `
            <div class="price-container">
                <span class="price-old">${fmtOld}</span>
                <span class="price-new">${fmtNew}</span>
                <span class="economy-text">Economize ${discountFmt} nesse produto</span>
            </div>
        `;
    } else {
        // --- SEM OFERTA ---
        const fmtNormal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valPriceNormal);
        
        priceHtml = `
            <div class="price-container">
                <span class="price-old" style="visibility:hidden">-</span>
                <span class="price-new">${fmtNormal}</span>
                <span class="economy-text" style="visibility:hidden">-</span>
            </div>
        `;
    }

    const cardHtml = `
        <div class="product-card" onclick="window.location.href='index.html?id=${id}'">
            <div class="product-image">
                <img src="${imgUrl}" alt="${prod.name}" loading="lazy">
            </div>
            
            <div class="product-info">
                <h4 class="product-name">${prod.name}</h4>
                
                ${priceHtml}
                
                <div class="free-shipping">
                    <i class='bx bxs-truck'></i> Frete Grátis
                </div>

                <button class="cta-button" onclick="event.stopPropagation(); addToCartDirect('${id}', '${prod.name}', ${finalPriceToCart}, '${imgUrl}')">
                    Comprar
                </button>
            </div>
        </div>
    `;
    container.innerHTML += cardHtml;
}

// js/index.js

// ... (Mantenha as constantes e imports iniciais) ...

// --- PÁGINA DE DETALHES ATUALIZADA ---
async function loadProductDetail(id) {
    document.getElementById('home-view').style.display = 'none';
    document.getElementById('product-detail-view').style.display = 'block';
    window.scrollTo(0, 0); // Rola para o topo

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
        
        // Tratamento de valores
        const valPriceNormal = parseValue(prod.price);
        const valPriceOferta = parseValue(prod['price-oferta']);
        const hasOffer = (valPriceOferta > 0 && valPriceOferta < valPriceNormal);

        let finalPrice = valPriceNormal;
        let displayPrice = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valPriceNormal);

        // Reset visual elements
        document.getElementById('p-timer-box').style.display = 'none';
        document.getElementById('p-detail-old-price').style.display = 'none';
        document.getElementById('p-detail-savings').style.display = 'none';

        if (hasOffer) {
            finalPrice = valPriceOferta;
            displayPrice = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valPriceOferta);
            const oldDisplay = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valPriceNormal);
            
            // Exibe preço antigo
            const oldEl = document.getElementById('p-detail-old-price');
            oldEl.innerText = oldDisplay;
            oldEl.style.display = 'block';

            // Exibe Economia
            const savings = valPriceNormal - valPriceOferta;
            const savingsFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(savings);
            const savingsEl = document.getElementById('p-detail-savings');
            savingsEl.innerText = `Economize ${savingsFmt} comprando agora`;
            savingsEl.style.display = 'block';

            // Ativa Cronômetro de Escassez
            document.getElementById('p-timer-box').style.display = 'flex';
            startDetailTimer();
        }

        const imgUrl = prod.imgUrl || 'https://placehold.co/600x600/EBEBEB/333?text=Sem+Foto';

        document.getElementById('p-detail-img').src = imgUrl;
        document.getElementById('p-detail-name').innerText = prod.name;
        document.getElementById('p-detail-price').innerText = displayPrice;
        // Randomiza vendas para prova social
        document.getElementById('p-detail-sold').innerText = Math.floor(Math.random() * 50) + 10; 
        // Randomiza visualizações
        document.getElementById('p-viewing-count').innerText = `${Math.floor(Math.random() * 15) + 5} pessoas estão vendo este produto agora`;
        
        document.getElementById('p-detail-desc').innerText = prod.desc || "Sem descrição.";
        document.title = `${prod.name} | Dtudo`;

        // Configura Botões
        document.getElementById('btn-add-cart-detail').onclick = () => { 
            addToCartDirect(id, prod.name, finalPrice, imgUrl); 
            showToast("Adicionado ao carrinho!", "success");
        };
        document.getElementById('btn-buy-now').onclick = () => {
            addToCartDirect(id, prod.name, finalPrice, imgUrl);
            window.location.href = 'carrinho.html';
        };

    } catch (error) {
        console.error("Erro:", error);
    }
}

// --- PÁGINA DE DETALHES (ATUALIZADA) ---
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
        
        // Lógica de Preço
        const valPriceNormal = parseValue(prod.price);
        const valPriceOferta = parseValue(prod['price-oferta']);
        const hasOffer = (valPriceOferta > 0 && valPriceOferta < valPriceNormal);

        let finalPrice = valPriceNormal;
        let displayPrice = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valPriceNormal);

        // Reset visual
        document.getElementById('p-timer-box').style.display = 'none';
        document.getElementById('p-detail-old-price').style.display = 'none';
        document.getElementById('p-detail-savings').style.display = 'none';

        if (hasOffer) {
            finalPrice = valPriceOferta;
            displayPrice = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valPriceOferta);
            const oldDisplay = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valPriceNormal);
            
            // Exibe preço antigo riscado
            const oldEl = document.getElementById('p-detail-old-price');
            oldEl.innerText = oldDisplay;
            oldEl.style.display = 'block';

            // Exibe Economia
            const savings = valPriceNormal - valPriceOferta;
            const savingsFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(savings);
            const savingsEl = document.getElementById('p-detail-savings');
            savingsEl.innerText = `Você economiza ${savingsFmt}`;
            savingsEl.style.display = 'inline-block'; // Ajuste para o novo estilo de "tag"

            // Ativa Cronômetro
            document.getElementById('p-timer-box').style.display = 'flex';
            startDetailTimer();
        }

        const imgUrl = prod.imgUrl || 'https://placehold.co/600x600/EBEBEB/333?text=Sem+Foto';

        document.getElementById('p-detail-img').src = imgUrl;
        document.getElementById('p-detail-name').innerText = prod.name;
        document.getElementById('p-detail-price').innerText = displayPrice;
        
        // CORREÇÃO: Define fixo como "0" (Honestidade)
        // Se no futuro o firebase tiver o campo 'soldCount', você muda para: prod.soldCount || 0
        document.getElementById('p-detail-sold').innerText = "0"; 
        
        document.getElementById('p-detail-desc').innerText = prod.desc || "Sem descrição.";
        document.title = `${prod.name} | Dtudo`;

        // Botões
        document.getElementById('btn-add-cart-detail').onclick = () => { 
            addToCartDirect(id, prod.name, finalPrice, imgUrl); 
            showToast("Adicionado ao carrinho!", "success");
        };
        document.getElementById('btn-buy-now').onclick = () => {
            addToCartDirect(id, prod.name, finalPrice, imgUrl);
            window.location.href = 'carrinho.html';
        };

    } catch (error) {
        console.error("Erro:", error);
    }
}

// --- CRONÔMETRO REAL (Até 29/11/2025 21:00) ---
let timerInterval;
function startDetailTimer() {
    if (timerInterval) clearInterval(timerInterval);
    
    // DATA ALVO: 29 de Novembro de 2025 às 21:00:00
    const targetDate = new Date('2025-11-29T21:00:00').getTime();
    const display = document.getElementById('p-timer-countdown');

    function updateTimer() {
        const now = new Date().getTime();
        const distance = targetDate - now;

        if (distance < 0) {
            clearInterval(timerInterval);
            display.innerText = "EXPIRADO";
            document.getElementById('p-timer-box').style.display = 'none'; // Some se acabou
            return;
        }

        // Cálculos de dias, horas, minutos e segundos
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        // Formatação visual: "2d 04:30:15" ou só "04:30:15" se for menos de 1 dia
        let text = "";
        if (days > 0) text += `${days}d `;
        text += `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        display.innerText = text;
    }

    updateTimer(); // Executa uma vez imediatamente
    timerInterval = setInterval(updateTimer, 1000);
}

function addToCartDirect(id, name, price, image) {
    if (typeof CartManager !== 'undefined') {
        CartManager.add({
            id: id,
            name: name,
            priceNew: parseFloat(price),
            priceOld: parseFloat(price), // Para visual interno do carrinho
            image: image,
            quantity: 1,
            description: ""
        });
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