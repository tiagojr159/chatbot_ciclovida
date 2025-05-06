const qrcode = require('qrcode-terminal');
const { Client } = require('whatsapp-web.js');
const { initializeBot } = require('./handlers/messageHandler');

const client = new Client();

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Tudo certo! WhatsApp conectado.');
    initializeBot(client);
});

client.initialize();