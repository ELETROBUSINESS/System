// Remova ou ignore a função calcular() para este formulário, pois ela não é usada aqui.
// function calcular() { ... }

let push = document.getElementById('pushBox'); // Se pushBox existe na sua página principal

function createPush(){
    if (!push) { // Adiciona verificação para criar o elemento se não existir
        push = document.createElement('div');
        push.id = 'pushBox';
        document.body.appendChild(push);
    }
    push.classList.add('push');
    push.innerHTML = '<i class="bx bx-cart"></i> Enviando despesa...';
        
    setTimeout(()=>{
        push.classList.remove('push'); // Preferível remover a classe para esconder
        push.innerHTML = ''; // Limpar o texto
        // Ou, se realmente quiser remover o elemento do DOM:
        // push.remove(); 
    }, 5000); // Usar número para o tempo
}

// Model ADM para Boletos
const formbillsADM = document.getElementById("form-bills-adm");

formbillsADM.addEventListener("submit", function (e) {
    e.preventDefault(); // Impede o recarregamento da página
    document.getElementById("submit-button-ADM").disabled = true;
    createPush();

    // Collect the form data
    var formData = new FormData(this);
    var keyValuePairs = [];
    for (var pair of formData.entries()) {
        keyValuePairs.push(pair[0] + "=" + encodeURIComponent(pair[1])); // Use encodeURIComponent
    }

    var formDataString = keyValuePairs.join("&");

    // 🚨 ATENÇÃO: SUBSTITUA ESTE URL PELO NOVO URL DA SUA IMPLANTAÇÃO DO APPS SCRIPT
    // Use o MESMO URL que você usa para o formulário de vendas, pois o Apps Script
    // lida com ambos os tipos de requisição.
    const appScriptURL = "https://script.google.com/macros/s/AKfycbxCCaxdYdC6J_QKsaoWTDquH915MHUnM9BykD39ZUujR2LB3lx9d9n5vAsHdJZJByaa7w/exec"; 
    
    fetch(
        appScriptURL,
        {
            redirect: "follow",
            method: "POST",
            body: formDataString,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded", // CORRIGIDO: Este é o Content-Type correto
            },
        }
    )
    .then(function (response) {
        if (response.ok) { // Verifica se a resposta HTTP é OK (status 200-299)
            return response.json(); // Espera uma resposta JSON do Apps Script
        } else {
            // Se a resposta não for OK, lança um erro com o status e o texto da resposta
            return response.text().then(text => {
                throw new Error(`Failed to submit the form. Status: ${response.status}. Response: ${text}`);
            });
        }
    })
    .then(function (data) {
        // Display a success message
        document.getElementById("submit-button-ADM").disabled = false;
        document.getElementById("form-bills-adm").reset(); // Reseta o formulário correto
        location.reload(); // Avalie se recarregar a página é realmente necessário

        console.log("Formulário de boleto enviado com sucesso!", data);
    })
    .catch(function (error) {
        // Handle errors, you can display an error message here
        console.error("Erro ao enviar o formulário de boleto:", error);
        document.getElementById("submit-button-ADM").disabled = false; // Reabilita o botão em caso de erro
    });
});