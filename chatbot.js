const qrcode = require('qrcode-terminal');
const { Client, Buttons, List, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const csv = require('csv-parser');

const client = new Client();

// Função para consultar dados em um arquivo CSV
async function consultarCSV(termoBusca, colunaBusca, caminhoArquivo) {
    return new Promise((resolve, reject) => {
        const resultados = [];

        fs.createReadStream(caminhoArquivo)
            .pipe(csv())
            .on('data', (row) => {
                if (row[colunaBusca] &&
                    row[colunaBusca].toLowerCase().includes(termoBusca.toLowerCase())) {
                    resultados.push(row);
                }
            })
            .on('end', () => {
                resolve(resultados);
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}

// Função para carregar e sortear teatros
async function sortearTeatros(caminhoArquivo, quantidade = 5) {
    return new Promise((resolve, reject) => {
        const teatros = [];

        fs.createReadStream(caminhoArquivo)
            .pipe(csv())
            .on('data', (row) => {
                teatros.push(row);
            })
            .on('end', () => {
                const teatrosSorteados = teatros.sort(() => Math.random() - 0.5).slice(0, quantidade);
                resolve(teatrosSorteados);
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Tudo certo! WhatsApp conectado.');
});

client.initialize();

const delay = ms => new Promise(res => setTimeout(res, ms));

// Estados do bot
let estados = new Map(); // Usaremos um Map para rastrear o estado por usuário (msg.from)

function setEstadoUsuario(from, estado, subEstado = null) {
    estados.set(from, { estado, subEstado, timestamp: Date.now() });
}

function getEstadoUsuario(from) {
    return estados.get(from) || { estado: null, subEstado: null, timestamp: null };
}

function limparEstadoUsuario(from) {
    estados.delete(from);
}

client.on('message', async msg => {
    const from = msg.from;
    const estadoAtual = getEstadoUsuario(from);

    // Opção inicial: Menu
    if (msg.body.match(/(menu|Menu|dia|tarde|noite|oi|Oi|Olá|olá|ola|Ola)/i) && msg.from.endsWith('@c.us') && !estadoAtual.estado) {
        const chat = await msg.getChat();
        await delay(1000);
        await chat.sendStateTyping();
        await delay(1000);
        const contact = await msg.getContact();
        const name = contact.pushname;
        await client.sendMessage(from, 'Olá! ' + name.split(" ")[0] + ', esse é um teste de um robô de Tiago Junior. \n\n\n\n Sou o assistente virtual da Prefeitura do Recife. Como posso ajudá-lo hoje? Por favor, digite uma das opções abaixo:\n\n 0 - Tiago Junior \n 1 - Medicamentos \n 2 - Turismo \n 3 - Transportes');
        await delay(1000);
        await chat.sendStateTyping();
        await delay(3000);
        limparEstadoUsuario(from); // Garante que o estado inicial seja limpo
    }

    // Opção 1 - Medicamentos
    if (msg.body === '1' && msg.from.endsWith('@c.us') && estadoAtual.estado !== 'turismo') {
        const chat = await msg.getChat();
        await delay(3000);
        await chat.sendStateTyping();
        await delay(3000);
        await client.sendMessage(from, 'Digite o nome do medicamento que você está procurando nas farmácias da prefeitura');
        setEstadoUsuario(from, 'medicamentos');
    }

    // Captura o nome do medicamento
    if (estadoAtual.estado === 'medicamentos' && msg.from.endsWith('@c.us') && msg.body !== '1') {
        const chat = await msg.getChat();
        const nomeMedicamento = msg.body.trim();

        await delay(3000);
        await chat.sendStateTyping();
        await delay(3000);

        try {
            const resultados = await consultarCSV(nomeMedicamento, 'medicamento', './medicamentos.csv');
            if (resultados.length > 0) {
                let resposta = 'Medicamento encontrado:\n';
                resultados.forEach(resultado => {
                    resposta += `\nNome: ${resultado.medicamento || 'Não especificado'}\n`;
                    resposta += `Endereço da Farmácia: ${resultado.endereco || 'Não especificado'}\n`;
                    resposta += `Dosagem: ${resultado.dosagem || 'Não especificada'}\n`;
                });
                await client.sendMessage(from, resposta);
            } else {
                await client.sendMessage(from, `Desculpe, não encontramos o medicamento "${nomeMedicamento}" em nosso estoque.`);
            }
        } catch (error) {
            console.error('Erro ao consultar CSV:', error);
            await client.sendMessage(from, 'Ocorreu um erro ao buscar o medicamento. Por favor, tente novamente.');
        }

        limparEstadoUsuario(from);
    }

    // Opção 2 - Turismo
    if (msg.body === '2' && msg.from.endsWith('@c.us') && estadoAtual.estado !== 'medicamentos') {
        const chat = await msg.getChat();
        await delay(3000);
        await chat.sendStateTyping();
        await delay(3000);
        await client.sendMessage(from, 'Escolha uma das opções de turismo:\n\n1 - Teatro\n2 - Restaurante');
        setEstadoUsuario(from, 'turismo');
    }

    // Captura a subopção de Turismo
    if (estadoAtual.estado === 'turismo' && msg.from.endsWith('@c.us')) {
        const chat = await msg.getChat();
        const subOpcao = msg.body;

        if (subOpcao === '1') { 
            await delay(3000);
            await chat.sendStateTyping();
            await delay(3000);

            try {
                const teatrosSorteados = await sortearTeatros('./teatros.csv', 5);
                if (teatrosSorteados.length > 0) {
                    let resposta = 'Aqui estão 5 teatros sorteados para você visitar:\n';
                    teatrosSorteados.forEach((teatro, index) => {
                        resposta += `\n${index + 1}. ${teatro.nome+': '+teatro.descricao || 'Teatro não especificado'}\n`;
                    });
                    await client.sendMessage(from, resposta);
                } else {
                    await client.sendMessage(from, 'Nenhum teatro encontrado na base de dados.');
                }
            } catch (error) {
                console.error('Erro ao sortear teatros:', error);
                await client.sendMessage(from, 'Ocorreu um erro ao buscar os teatros. Por favor, tente novamente.');
            }
        } else if (subOpcao === '2') { // Restaurante
            await delay(3000);
            await chat.sendStateTyping();
            await delay(3000);
            await client.sendMessage(from, 'Função de restaurantes ainda não implementada. Por favor, escolha outra opção.');
        } else {
            await delay(3000);
            await chat.sendStateTyping();
            await delay(3000);
            await client.sendMessage(from, 'Opção inválida. Por favor, escolha 1 para Teatro ou 2 para Restaurante.');
            return; // Não reseta o estado para permitir nova tentativa
        }

        limparEstadoUsuario(from);
    }

    // Outras opções permanecem iguais
    if (msg.body === '3' && msg.from.endsWith('@c.us')) {
        const chat = await msg.getChat();
        await delay(3000);
        await chat.sendStateTyping();
        await delay(3000);
        await client.sendMessage(from, 'Sorteio de em prêmios todo ano.\n\nAtendimento médico ilimitado 24h por dia.\n\nReceitas de medicamentos');
        await delay(3000);
        await chat.sendStateTyping();
        await delay(3000);
        await client.sendMessage(from, 'Link para cadastro: https://site.com');
    }

    if (msg.body === '4' && msg.from.endsWith('@c.us')) {
        const chat = await msg.getChat();
        await delay(3000);
        await chat.sendStateTyping();
        await delay(3000);
        await client.sendMessage(from, 'Você pode aderir aos nossos planos diretamente pelo nosso site ou pelo WhatsApp.\n\nApós a adesão, você terá acesso imediato');
        await delay(3000);
        await chat.sendStateTyping();
        await delay(3000);
        await client.sendMessage(from, 'Link para cadastro: https://site.com');
    }

    if (msg.body === '5' && msg.from.endsWith('@c.us')) {
        const chat = await msg.getChat();
        await delay(3000);
        await chat.sendStateTyping();
        await delay(3000);
        await client.sendMessage(from, 'Se você tiver outras dúvidas ou precisar de mais informações, por favor, fale aqui nesse whatsapp ou visite nosso site: https://site.com');
    }
});