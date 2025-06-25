document.querySelector('.form_login').addEventListener('submit', async function (e) {
    e.preventDefault();

    const username = document.getElementById('login').value;
    const password = document.getElementById('senha').value;

    const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    const result = await response.json();

    if (result.success) {
        window.location.href = result.redirect;
    } else {
        alert('Usuário ou senha incorretos!');
    }
});
