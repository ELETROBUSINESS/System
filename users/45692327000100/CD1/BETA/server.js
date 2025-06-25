const express = require('express');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
app.use(bodyParser.json());

const vapidKeys = {
  publicKey: 'BBFqC6_Y7Zqn6mzf3YLmznDwuj5GU_eUraMsMCS0HGNQVL5mlTwkAOCcZt6Q0grDilU8VyZ-c-cWKHGgY951O9I-Y',
  privateKey: 'gUA5iaA7d3B9A0kXqHYhF'
};

webpush.setVapidDetails(
  'mailto:seuemail@exemplo.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// Salva a inscrição do admin
let adminSubscription = null;

app.post('/subscribe', (req, res) => {
  adminSubscription = req.body;
  console.log('Admin registrado.');
  res.status(201).json({});
});

app.post('/notify', (req, res) => {
  if (!adminSubscription) {
    return res.status(400).json({ error: 'Admin ainda não registrado.' });
  }

  const payload = JSON.stringify({
    title: 'Nova venda!',
    body: 'Alguém acabou de apertar o botão!',
  });

  webpush.sendNotification(adminSubscription, payload)
    .then(() => res.status(200).json({ success: true }))
    .catch(err => {
      console.error('Erro ao enviar notificação:', err);
      res.sendStatus(500);
    });
});

app.listen(3000, () => {
  console.log('Servidor rodando em http://localhost:3000');
});
