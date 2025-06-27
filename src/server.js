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
        // Redireciona para o login se a sessão não existir
        return res.redirect('/index.html');
    }

    const requestedPath = req.path; // Ex: '/45692327000100/CD1/colaborador/ryan/conta.html'
    const userRedirect = req.session.user.redirect; // Ex: '/users/45692327000100/CD1/colaborador/ryan/conta.html'

    // Extrai o caminho permitido do usuário a partir da URL de redirecionamento,
    // garantindo que o nome do arquivo final seja removido.
    // Isso cria o prefixo: '/45692327000100/CD1/colaborador/ryan'
    const allowedPrefix = userRedirect.substring(userRedirect.indexOf('/users/') + 6, userRedirect.lastIndexOf('/'));
    
    // Converte o prefixo em um caminho relativo para comparação
    const userAllowedBasePath = '/' + allowedPrefix;

    // Verifica se o caminho solicitado começa com o prefixo permitido
    if (requestedPath.startsWith(userAllowedBasePath)) {
        // Se autorizado, serve os arquivos estáticos
        return express.static(usersDir)(req, res, next);
    } else {
        // Se não autorizado, nega o acesso
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
        res.redirect('/index.html');
    });
});

// 404
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '../public/404.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor rodando: http://localhost:${PORT}`);
});
