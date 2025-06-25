const webpush = require('web-push');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('🔑 Chave Pública (publicKey):', vapidKeys.publicKey);
console.log('🔒 Chave Privada (privateKey):', vapidKeys.privateKey);
