// gerarHash.js
const bcrypt = require('bcrypt');

const senha = '204511'; // Substitua pela senha real
const saltRounds = 10;

bcrypt.hash(senha, saltRounds, function(err, hash) {
  if (err) {
    console.error('Erro ao gerar o hash:', err);
    return;
  }

  console.log('Hash gerado:', hash);
});
