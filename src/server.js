// server.js (atualizado com suporte a CORS para funcionar com Netlify)
const express = require('express');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const { authenticateUser } = require('./auth/login');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: 'https://eletrobusiness.com.br', // ou seu domínio personalizado no Netlify
  credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: 'segredo',
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 30 * 60 * 1000 // 30 minutos
    }
}));

// Servir arquivos públicos apenas localmente (não afeta o Netlify)
app.use(express.static(path.join(__dirname, '../public')));

const usersDir = path.join(__dirname, '../users');

// Rota protegida para /users
app.use('/users', (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).send("Não autorizado. Faça login.");
    }

    const requestedPath = req.path;
    const user = req.session.user;

    const userAllowedBase = `/users/${user.username}`;
    const cnpjFolder = user.redirect.split('/').slice(0, 4).join('/');

    if (requestedPath.startsWith(userAllowedBase) || requestedPath.startsWith(cnpjFolder)) {
        return express.static(usersDir)(req, res, next);
    } else {
        return res.status(403).send("Acesso negado.");
    }
});

// Rota de login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    console.log("Tentativa de login:", username);

    try {
        const user = await authenticateUser(username, password);

        if (user) {
            req.session.user = {
                username: user.username,
                redirect: user.redirect
            };
            res.json({ success: true, redirect: user.redirect });
        } else {
            res.status(401).json({ success: false, message: 'Usuário ou senha inválidos' });
        }
    } catch (err) {
        console.error('Erro ao fazer login:', err);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login.html');
    });
});

// 404
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '../public/404.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor rodando: http://localhost:${PORT}`);
});
