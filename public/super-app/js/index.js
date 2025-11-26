// js/index.js

const STORE_OWNER_UID = "3zYT9Y6hXWeJSuvmEYP4FMZa5gI2"; 
const APP_ID = 'floralchic-loja';

let allProductsCache = []; // Cache global

document.addEventListener("DOMContentLoaded", () => {
    initSlider();
    setupSearch(); // Inicia a nova lógica
    
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (productId) {
        loadProductDetail(productId);
    } else {
        loadHomeProducts();
    }
});

// ============================================================
// NOVA LÓGICA DE PESQUISA (DROPDOWN)
// ============================================================
function setupSearch() {
    const searchInput = document.querySelector('.search-bar input');
    const dropdown = document.getElementById('search-dropdown');
    
    if (!searchInput || !dropdown) return;

    // Evento de digitação
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        
        // Se vazio, esconde o modal
        if (term.length === 0) {
            dropdown.classList.remove('active');
            dropdown.innerHTML = '';
            return;
        }

        // Filtra produtos
        const filtered = allProductsCache.filter(prod => 
            prod.name.toLowerCase().includes(term)
        );

        if (filtered.length === 0) {
            dropdown.innerHTML = `<div style="padding:15px; color:#666; font-size:0.9rem;">Nenhum resultado para "${term}"</div>`;
            dropdown.classList.add('active');
            return;
        }

        // Monta o HTML do Dropdown
        renderDropdownResults(filtered, dropdown);
    });

    // Fecha o dropdown se clicar fora
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });
}

function renderDropdownResults(products, container) {
    // 1. Lista de Sugestões (Máximo 5 nomes)
    const suggestions = products.slice(0, 5);
    
    // 2. Destaques Visuais (Máximo 3 produtos para o rodapé)
    const visuals = products.slice(0, 3);

    let html = `<ul class="search-suggestions-list">`;

    // Gera lista de texto
    suggestions.forEach(prod => {
        html += `
            <li class="search-suggestion-item" onclick="goToProduct('${prod.id}')">
                <i class='bx bx-search'></i>
                ${prod.name}
            </li>
        `;
    });
    html += `</ul>`;

    // Gera área visual (apenas se houver produtos)
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

// Função auxiliar para redirecionar
window.goToProduct = function(id) {
    window.location.href = `index.html?id=${id}`;
}

// ============================================================
// CARREGAMENTO DE DADOS (MANTIDO)
// ============================================================
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

        allProductsCache = []; // Limpa e recarrega cache

        snapshot.forEach(doc => {
            const prod = doc.data();
            prod.id = doc.id;
            allProductsCache.push(prod); // Popula o cache para a busca usar depois
            renderProductCard(prod.id, prod, container); // Renderiza no main
        });

    } catch (error) {
        console.error("Erro ao carregar produtos:", error);
        container.innerHTML = "<p>Erro ao carregar ofertas.</p>";
    }
}

// ... (Mantenha renderProductCard, loadProductDetail, addToCartDirect e initSlider como estavam) ...
// Certifique-se de copiar as funções que enviei na resposta anterior se não tiverem mudado.
// Abaixo apenas repito renderProductCard para garantir que você tenha o arquivo funcional.

function renderProductCard(id, prod, container) {
    const fmtPrice = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prod.price || 0);
    const imgUrl = prod.imgUrl || 'https://placehold.co/400x400/EBEBEB/333?text=Sem+Foto';
    
    const hasOffer = prod.originalPrice && (prod.originalPrice > prod.price);
    
    let priceHtml = '';
    if (hasOffer) {
        const oldPriceFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prod.originalPrice);
        const discountVal = prod.originalPrice - prod.price;
        const discountPercent = Math.round((discountVal / prod.originalPrice) * 100);
        
        priceHtml = `
            <div class="price-container">
                <span class="price-old">${oldPriceFmt}</span>
                <div class="price-wrapper">
                    <span class="price-new">${fmtPrice}</span>
                    <span class="discount-tag">${discountPercent}% OFF</span>
                </div>
            </div>
        `;
    } else {
        priceHtml = `
            <div class="price-container">
                <span class="price-old"></span>
                <span class="price-new">${fmtPrice}</span>
            </div>
        `;
    }

    const cardHtml = `
        <div class="product-card" onclick="window.location.href='index.html?id=${id}'">
            <div class="product-image">
                <img src="${imgUrl}" alt="${prod.name}">
            </div>
            <div class="product-info">
                <h4 class="product-name">${prod.name}</h4>
                ${priceHtml}
                <div class="free-shipping"><i class='bx bxs-truck'></i> Frete Grátis</div>
                <button class="cta-button" onclick="event.stopPropagation(); addToCartDirect('${id}', '${prod.name}', ${prod.price}, '${imgUrl}')">
                    Comprar
                </button>
            </div>
        </div>
    `;
    container.innerHTML += cardHtml;
}

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
        const fmtPrice = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prod.price || 0);
        const imgUrl = prod.imgUrl || 'https://placehold.co/600x600/EBEBEB/333?text=Sem+Foto';

        document.getElementById('p-detail-img').src = imgUrl;
        document.getElementById('p-detail-name').innerText = prod.name;
        document.getElementById('p-detail-price').innerText = fmtPrice;
        document.getElementById('p-detail-stock').innerText = prod.stock > 0 ? `${prod.stock} disponíveis` : "Indisponível";
        document.getElementById('p-detail-desc').innerText = prod.desc || "Sem descrição.";
        document.title = `${prod.name} | Dtudo`;

        document.getElementById('btn-add-cart-detail').onclick = () => { addToCartDirect(id, prod.name, prod.price, imgUrl); };
        document.getElementById('btn-buy-now').onclick = () => {
            addToCartDirect(id, prod.name, prod.price, imgUrl);
            window.location.href = 'carrinho.html';
        };
    } catch (error) {
        console.error("Erro:", error);
    }
}

function addToCartDirect(id, name, price, image) {
    if (typeof CartManager !== 'undefined') {
        CartManager.add({
            id: id, name: name, priceNew: parseFloat(price), priceOld: parseFloat(price), image: image, quantity: 1, description: ""
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