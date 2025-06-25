function calcular() {
  const value = document.getElementById("value");
  const desconto = document.getElementById("desconto");

  const valorReal = Intl.NumberFormat(
    'pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)

  const result = ((value.value) - (desconto.value)).toFixed(2);

  const total = document.getElementById('total');
  total.textContent = result;
  
    value.innerHTML = valorReal;
}

let push = document.getElementById('pushBox');

function createPush(){
  push.classList.add('push');
  push.innerHTML = '<ion-icon name="cash-sharp"></ion-icon> Registrando...';
    
  setTimeout(()=>{
    push.remove();
  }, '5000');
}
  // Model ADM

  const formbillsADM = document.getElementById("form-bills-adm");

  formbillsADM.addEventListener("submit", function (e) {
      e.preventDefault(); // Indepede o recarregamento da página
      document.getElementById("submit-button-ADM").disabled = true;
      createPush();
  
      // Collect the form data
      var formData = new FormData(this);
      var keyValuePairs = [];
      for (var pair of formData.entries()) {
        keyValuePairs.push(pair[0] + "=" + pair[1]);
      }
  
      var formDataString = keyValuePairs.join("&");
  
      // Send a POST request to your Google Apps Script
      fetch(
        "https://script.google.com/macros/s/AKfycbw0TDT3Wc7K6I3lW4i4wLjpRQmOxc6lqzvvFrpf7YoK2Ad5042Msc_DRekmQb5smZWR/exec",
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
          document.getElementById("form-bills-adm").reset();
          location.reload();
        })
        .catch(function (error) {
          // Handle errors, you can display an error message here
          console.error(error);
        });
      
    });