const pre_loading = document.querySelector("div.loading");

function AnimationLoading() {
    pre_loading.style.opacity = "0";

    setTimeout(() => {
        pre_loading.style.display = "none";
    }, 500);
}

const dateLoding = document.getElementById("dataLoading");

function constDate() {
    dateLoding.classList.remove("off");

    setTimeout(() => {
        dateLoding.classList.toggle("off");
    }, 500);
}