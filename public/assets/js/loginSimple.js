document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector(".form_login");

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const username = document.getElementById("login").value;
    const password = document.getElementById("senha").value;

    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
      localStorage.setItem("auth", JSON.stringify(user));
      window.location.href = user.redirect;
    } else {
      alert("Usuário ou senha inválidos");
    }
  });
});
