function calcular() {
  const value = document.getElementById("value");
  const desconto = document.getElementById("desconto");
  const total = document.getElementById("total");

  const result = ((value.value) - (desconto.value)).toFixed(2);
  
  total.value = result;
}

function gerator() {
  const payment = document.getElementById("paymentModal").value;
  document.getElementById("paymentInfo").innerHTML = payment;

  const cash = parseFloat(document.getElementById("total").value.replace(",", "."));
document.getElementById("valueInfo").innerHTML = cash.toLocaleString("pt-BR", {style: "currency",currency: "BRL"
});

  const seller = document.getElementById("seller").value;
  document.getElementById("sellerInfo").innerHTML = seller;

  const desc = parseFloat(document.getElementById("desconto").value.replace(",", "."));
document.getElementById("desInfo").innerHTML = desc.toLocaleString("pt-BR", {style: "currency",currency: "BRL"
});

  const hr = document.getElementById("horario").innerHTML;
  document.getElementById("hrInfo").innerHTML = hr;
}

let push = document.getElementById('pushBox');

function createPush(){
  push.classList.add('push');
  push.innerHTML = '<i class="bx bx-cart"></i> Enviando venda...';
    
  setTimeout(()=>{
    push.remove();
  }, '5000');
}
/* 

(async () => {
  Notification.requestPermission().then(perm => {
    if (perm === 'granted'){
      const notification = new Notification('Bem vindo!',{
          body: 'é bom te ver novamente.',
          data: { hello: 'world'},
          icon: '/img/icons/alert.png'
      });

      notification.addEventListener('close', e => {
        console.log(e);
      })
    }
  })
})()


*/

const form = document.getElementById("form-sell");
const songSell = document.getElementById("songSell");

form.addEventListener("submit", function (e) {
    e.preventDefault(); // Indepede o recarregamento da página
    document.getElementById("submit-button-sell").disabled = true;
    createPush();
    calcular()
    gerator();
    songSell.play();
    document.getElementById("submit-button-sell").classList.toggle("loadingB");

    // Collect the form data
    var formData = new FormData(this);
    var keyValuePairs = [];
    for (var pair of formData.entries()) {
      keyValuePairs.push(pair[0] + "=" + pair[1]);
    }

    var formDataString = keyValuePairs.join("&");

    // Send a POST request to your Google Apps Script
    fetch(
      "https://script.google.com/macros/s/AKfycbzHhyOOr4zuF8TMkzshaIcFkOSwapba2F1qUpq4oWsoVE5u6Dnora0zj7EgA0PUlEql/exec",
      {
        redirect: "follow",
        method: "POST",
        body: formDataString,
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
      }
    )
      .then(function (response) {
        // Check if the request was successful
        if (response) {
          return response; // Assuming your script returns JSON response
        } else {
          throw new Error("Failed to submit the form.");
        }
      })
      .then(function (data) {
        // Display a success message
        document.getElementById("submit-button-sell").disabled = false;
        document.getElementById("form-sell").reset();
        document.getElementById("generatedReceipt").classList.toggle("generatedReceipt");
      })
      .catch(function (error) {
        // Handle errors, you can display an error message here
        console.error(error);
      });
    
  });