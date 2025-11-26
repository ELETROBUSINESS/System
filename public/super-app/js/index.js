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

// --- RENDERIZA CARD (LÓGICA RIGOROSA DE PREÇO) ---
function renderProductCard(id, prod, container) {
    const imgUrl = prod.imgUrl || 'https://placehold.co/400x400/EBEBEB/333?text=Sem+Foto';
    
    // 1. Extrai os valores numéricos limpos
    const valPriceNormal = parseValue(prod.price);           // Campo 'price'
    const valPriceOferta = parseValue(prod['price-oferta']); // Campo 'price-oferta'

    // 2. Define se existe oferta
    // Consideramos oferta se o valor da oferta for maior que 0 e menor que o preço normal
    const hasOffer = (valPriceOferta > 0 && valPriceOferta < valPriceNormal);
    
    let priceHtml = '';
    let finalPriceToCart = valPriceNormal; // Preço padrão para o carrinho

    if (hasOffer) {
        // --- TEM OFERTA ---
        // price -> price-old (Riscado)
        // price-oferta -> price-new (Destaque)
        
        finalPriceToCart = valPriceOferta;
        
        const fmtOld = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valPriceNormal);
        const fmtNew = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valPriceOferta);
        
        // Calcula desconto
        const discountVal = valPriceNormal - valPriceOferta;
        const discountPercent = Math.round((discountVal / valPriceNormal) * 100);
        
        priceHtml = `
            <div class="price-container">
                <span class="price-old">${fmtOld}</span>
                
                <div class="price-wrapper">
                    <span class="price-new">${fmtNew}</span>
                    <span class="discount-tag">${discountPercent}% OFF</span>
                </div>
            </div>
        `;
    } else {
        // --- SEM OFERTA ---
        // Apenas mostra o preço normal no destaque
        const fmtNormal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valPriceNormal);
        
        priceHtml = `
            <div class="price-container">
                <span class="price-old" style="visibility:hidden">-</span>
                <span class="price-new">${fmtNormal}</span>
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

// --- PÁGINA DE DETALHES (MESMA LÓGICA DE PREÇO) ---
async function loadProductDetail(id) {
    document.getElementById('home-view').style.display = 'none';
    document.getElementById('product-detail-view').style.display = 'block';

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
        const imgUrl = prod.imgUrl || 'https://placehold.co/600x600/EBEBEB/333?text=Sem+Foto';

        // Lógica de Preço Detalhe
        const valPriceNormal = parseValue(prod.price);
        const valPriceOferta = parseValue(prod['price-oferta']);
        const hasOffer = (valPriceOferta > 0 && valPriceOferta < valPriceNormal);

        let finalPriceToCart = valPriceNormal;
        let displayPrice = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valPriceNormal);

        if (hasOffer) {
            finalPriceToCart = valPriceOferta;
            displayPrice = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valPriceOferta);
            
            // Se quiser mostrar o preço antigo no detalhe também (opcional)
            // const displayOld = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valPriceNormal);
            // ... injetar no HTML se tiver elemento para isso
        }

        document.getElementById('p-detail-img').src = imgUrl;
        document.getElementById('p-detail-name').innerText = prod.name;
        document.getElementById('p-detail-price').innerText = displayPrice;
        document.getElementById('p-detail-stock').innerText = prod.stock > 0 ? `${prod.stock} disponíveis` : "Indisponível";
        document.getElementById('p-detail-desc').innerText = prod.desc || "Sem descrição.";
        document.title = `${prod.name} | Dtudo`;

        document.getElementById('btn-add-cart-detail').onclick = () => { addToCartDirect(id, prod.name, finalPriceToCart, imgUrl); };
        document.getElementById('btn-buy-now').onclick = () => {
            addToCartDirect(id, prod.name, finalPriceToCart, imgUrl);
            window.location.href = 'carrinho.html';
        };

    } catch (error) {
        console.error("Erro ao carregar detalhe:", error);
    }
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