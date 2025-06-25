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

  const cash = document.getElementById("total").value;
  document.getElementById("valueInfo").innerHTML = cash;

  const seller = document.getElementById("seller").value;
  document.getElementById("sellerInfo").innerHTML = seller;

  const desc = document.getElementById("desconto").value;
  document.getElementById("desInfo").innerHTML = desc;

  const hr = document.getElementById("horario").innerHTML;
  document.getElementById("hrInfo").innerHTML = hr;
}

let push = document.getElementById('pushBox');

function createPush(){
  push.classList.add('push');
  push.innerHTML = '<i class="bx bx-cart"></i> Registrando...';
    
  setTimeout(()=>{
    push.remove();
  }, '5000');
}
  // Model ADM

const formADM = document.getElementById("form-sell-adm");
const songSell = document.getElementById("songSell");

formADM.addEventListener("submit", function (e) {
    e.preventDefault(); // Indepede o recarregamento da página
    document.getElementById("submit-button-ADM").disabled = true;
    gerator();
    createPush();
    songSell.play();
    document.getElementById("submit-button-ADM").classList.toggle("loadingB");

    // Collect the form data
    var formData = new FormData(this);
    var keyValuePairs = [];
    for (var pair of formData.entries()) {
      keyValuePairs.push(pair[0] + "=" + pair[1]);
    }

    var formDataString = keyValuePairs.join("&");

    // Send a POST request to your Google Apps Script
    fetch(
      "https://script.google.com/macros/s/AKfycbzHtsx2ppbUHEY-KK9XkHKxuUwNHW6SGSlO18HkmXX2E4BJ_SiE4VcaTsG8V2ePlucY3Q/exec",
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
        document.getElementById("submit-button-ADM").disabled = false;
        document.getElementById("form-sell-adm").reset();
        document.getElementById("generatedReceipt").classList.toggle("generatedReceipt");
      })
      .catch(function (error) {
        // Handle errors, you can display an error message here
        console.error(error);
      });
    
  });