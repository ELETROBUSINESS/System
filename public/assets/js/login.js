document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('.form_login');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('login').value;
    const password = document.getElementById('senha').value;

    try {
      const response = await fetch('https://system-5y39.onrender.com/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // importante para cookies/sessão
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (data.success) {
        window.location.href = data.redirect;
      } else {
        alert('Usuário ou senha inválidos');
      }
    } catch (error) {
      console.error('Erro ao tentar login:', error);
      alert('Erro na conexão com o servidor.');
    }
  });
});
