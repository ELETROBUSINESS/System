const list = document.querySelectorAll(".list");

function activeLink() {
    list.forEach((item) =>
        item.classList.remove('active'));
    this.classList.add('active');
}

list.forEach((item) =>
    item.addEventListener('click', activeLink));

let count = 1;
document.getElementById('radio1').checked = true;

setInterval(function () {
    nextImg();
}, 10000);

function nextImg() {
    count++;
    if (count > 2) {
        count = 1;
    }
    document.getElementById('radio' + count).checked = true;
}

function imprimir() {
    document.getElementById("comprovanteNFiscal").classList.remove("difoff");
    window.print();
}
