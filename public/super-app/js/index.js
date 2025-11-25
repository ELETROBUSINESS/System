// js/index.js

document.addEventListener("DOMContentLoaded", () => {
    initSlider();
    setupProductButtons();
});

// --- Lógica do Slider de Banners ---
function initSlider() {
    const sliderWrapper = document.querySelector(".slider-wrapper");
    if (!sliderWrapper) return;

    const slides = document.querySelectorAll(".slide");
    let slideIndex = 0;
    const totalSlides = slides.length;

    // Função para mudar o slide
    function showSlide(index) {
        slideIndex = index;
        if (slideIndex >= totalSlides) slideIndex = 0;
        if (slideIndex < 0) slideIndex = totalSlides - 1;
        
        sliderWrapper.style.transform = `translateX(-${slideIndex * 100}%)`;
    }

    // Auto-play a cada 5 segundos
    setInterval(() => {
        showSlide(slideIndex + 1);
    }, 5000);
}

// --- Lógica de Adicionar ao Carrinho ---
function setupProductButtons() {
    // Usamos delegação de evento para garantir que funcione mesmo se produtos forem carregados dinamicamente
    const productGrid = document.querySelector(".product-grid");
    
    if (productGrid) {
        productGrid.addEventListener("click", (e) => {
            if (e.target.classList.contains("cta-button")) {
                const card = e.target.closest(".product-card");
                
                // Extrai dados dos atributos data-*
                const product = {
                    id: card.dataset.id,
                    name: card.dataset.name,
                    priceNew: parseFloat(card.dataset.priceNew),
                    priceOld: parseFloat(card.dataset.priceOld),
                    image: card.dataset.image,
                    description: card.dataset.description
                };

                // Usa a função global do CartManager
                CartManager.add(product);
            }
        });
    }
}