function calcular() {
    const value = document.getElementById("value");
    const desconto = document.getElementById("desconto");
    const total = document.getElementById("total");

    const result = (parseFloat(value.value || 0) - parseFloat(desconto.value || 0)).toFixed(2); // Use parseFloat e default para 0
    
    total.value = result;
}

function gerator() {
    const payment = document.getElementById("paymentModal").value;
    document.getElementById("paymentInfo").innerHTML = payment;

    const cash = document.getElementById("total").value;
    document.getElementById("valueInfo").innerHTML = cash;

    const seller = document.getElementById("seller").value;
    document.getElementById("sellerInfo").innerHTML = seller;

    const desc = document.getElementById("desconto").value;
    document.getElementById("desInfo").innerHTML = desc;

    // Certifique-se de que o elemento "horario" existe
    const hrElement = document.getElementById("horario");
    const hr = hrElement ? hrElement.innerHTML : ''; // Adiciona uma verificação para evitar erros se o elemento não existir
    document.getElementById("hrInfo").innerHTML = hr;
}

let push = document.getElementById('pushBox');

function createPush(){
    if (!push) { // Verifica se pushBox existe
        push = document.createElement('div');
        push.id = 'pushBox';
        document.body.appendChild(push); // Adiciona ao body ou a um contêiner específico
    }
    push.classList.add('push');
    push.innerHTML = '<i class="bx bx-cart"></i> Registrando...';
        
    setTimeout(()=>{
        push.classList.remove('push'); // Em vez de remover, melhor esconder ou resetar
        push.innerHTML = '';
        // Ou se quiser remover completamente:
        // push.remove();
    }, 5000); // 5000ms
}

// Model ADM
const formADM = document.getElementById("form-sell-adm");
const songSell = document.getElementById("Sell"); // Certifique-se de que este elemento de áudio existe

formADM.addEventListener("submit", function (e) {
    e.preventDefault(); // Impede o recarregamento da página
    document.getElementById("submit-button-ADM").disabled = true;
    gerator();
    createPush();
    if (songSell) { // Verifica se o elemento de áudio existe antes de tentar tocar
        songSell.play();
    }
    document.getElementById("submit-button-ADM").classList.toggle("loadingB");

    // Collect the form data
    var formData = new FormData(this);
    var keyValuePairs = [];
    for (var pair of formData.entries()) {
        keyValuePairs.push(pair[0] + "=" + encodeURIComponent(pair[1])); // Use encodeURIComponent
    }

    var formDataString = keyValuePairs.join("&");

    // 🚨 ATENÇÃO: SUBSTITUA ESTE URL PELO NOVO URL DA SUA IMPLANTAÇÃO DO APPS SCRIPT
    const appScriptURL = "https://script.google.com/macros/s/AKfycbyPWy8SHpOTsZAqFKoUTNOrgJkZKVVtYAMRXNDBQ3Nnalkr2k5c6CrUYtfmSuTQ5rbqhw/exec"; // EX: https://script.google.com/macros/s/AKfycbzHtsx2ppbUHEY-KK9XkHKxuUwNHW6SGSlO18HkmXX2E4BJ_SiE4VcaTsG8V2ePlucY3Q/exec
    
    fetch(
        appScriptURL,
        {
            redirect: "follow",
            method: "POST",
            body: formDataString,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded", // Mude para este Content-Type
            },
        }
    )
    .then(function (response) {
        // Verifica se a resposta HTTP é OK (status 200-299)
        if (response.ok) {
            return response.json(); // Se o Apps Script retornar JSON, parse-o. Se for só texto, use response.text()
        } else {
            // Se a resposta não for OK, lança um erro com o status
            return response.text().then(text => { throw new Error(`Failed to submit the form. Status: ${response.status}. Response: ${text}`); });
        }
    })
    .then(function (data) {
        // Display a success message
        document.getElementById("submit-button-ADM").disabled = false;
        document.getElementById("form-sell-adm").reset();
        document.getElementById("generatedReceipt").classList.toggle("generatedReceipt");
        
        // Você pode querer exibir uma mensagem de sucesso para o usuário aqui
        console.log("Formulário enviado com sucesso!", data);
    })
    .catch(function (error) {
        // Handle errors, you can display an error message here
        console.error("Erro ao enviar o formulário:", error);
        document.getElementById("submit-button-ADM").disabled = false; // Reabilita o botão em caso de erro
    });
});