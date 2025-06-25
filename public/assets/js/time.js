function atualizarHora() {
    const agora = new Date();
    const hora = agora.getHours().toString().padStart(2, '0');
    const minutos = agora.getMinutes().toString().padStart(2, '0');
    const segundos = agora.getSeconds().toString().padStart(2, '0');
  
    const horaFormatada = `${hora}:${minutos}:${segundos}`;
    document.getElementById("horario").innerHTML = horaFormatada;
  }
  
  // Atualiza a hora imediatamente e a cada segundo
  atualizarHora();
  setInterval(atualizarHora, 1000);