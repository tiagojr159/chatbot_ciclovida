const { delay, setEstadoUsuario, getEstadoUsuario, limparEstadoUsuario } = require('../utils');
const { consultarCSV, sortearTeatros } = require('../services/csvService');
const { MessageMedia } = require('whatsapp-web.js');
const { createCanvas, loadImage } = require('canvas');
const fetch = require('node-fetch');

// Função para calcular tiles do OpenStreetMap
function getTileNumber(lat, lon, zoom) {
    const xtile = Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
    const ytile = Math.floor(
        ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * Math.pow(2, zoom)
    );
    return { xtile, ytile };
}

// Função para converter latitude/longitude para pixels no canvas
function latLonToPixels(lat, lon, centerLat, centerLon, zoom, canvasWidth, canvasHeight) {
    const { xtile: centerXTile, ytile: centerYTile } = getTileNumber(centerLat, centerLon, zoom);
    const { xtile, ytile } = getTileNumber(lat, lon, zoom);

    const tileSize = 256; // Tamanho padrão de um tile do OpenStreetMap
    const centerX = (centerXTile * tileSize) + (canvasWidth / 2);
    const centerY = (centerYTile * tileSize) + (canvasHeight / 2);

    const pixelX = (xtile * tileSize) - centerX + (canvasWidth / 2);
    const pixelY = (ytile * tileSize) - centerY + (canvasHeight / 2);

    return { x: pixelX, y: pixelY };
}

async function solicitarImagem(client, from, chat, endereco) {
    await delay(1000);
    await chat.sendStateTyping();
    await delay(1000);

    try {
        // Configurações do mapa
        const zoom = 15;
        const canvasWidth = 400;
        const canvasHeight = 400;

        // Coordenadas do centro (Recife, como no seu código Leaflet)
        const centerLat = -8.0476;
        const centerLon = -34.8770;

        // Criar o canvas
        const canvas = createCanvas(canvasWidth, canvasHeight);
        const ctx = canvas.getContext('2d');

        // Calcular os tiles necessários
        const { xtile: centerXTile, ytile: centerYTile } = getTileNumber(centerLat, centerLon, zoom);
        const tileSize = 256;

        // Baixar e desenhar tiles ao redor do centro
        const tilesAround = 1; // Quantidade de tiles ao redor do centro (1 tile = 256x256px)
        for (let x = -tilesAround; x <= tilesAround; x++) {
            for (let y = -tilesAround; y <= tilesAround; y++) {
                const tileX = centerXTile + x;
                const tileY = centerYTile + y;
                const tileUrl = `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`;

                try {
                    // Baixar o tile usando node-fetch com User-Agent
                    const response = await fetch(tileUrl, {
                        headers: {
                            'User-Agent': 'BotWhatsAppRecife/1.0 (https://github.com/seuusuario; seuemail@example.com)'
                        }
                    });
                    if (!response.ok) {
                        throw new Error(`Erro ao baixar tile ${tileUrl}: ${response.status} ${response.statusText}`);
                    }

                    // Converter o buffer para um formato que loadImage pode usar
                    const buffer = await response.buffer();
                    const image = await loadImage(buffer);

                    const canvasX = (x + tilesAround) * tileSize;
                    const canvasY = (y + tilesAround) * tileSize;
                    ctx.drawImage(image, canvasX, canvasY, tileSize, tileSize);
                } catch (tileError) {
                    console.error(`Erro ao carregar tile ${tileUrl}:`, tileError.message);
                }
            }
        }

        const markerLat = -8.0476;
        const markerLon = -34.8770;

        // Converter latitude/longitude para pixels no canvas
        const { x: markerX, y: markerY } = latLonToPixels(markerLat, markerLon, centerLat, centerLon, zoom, canvasWidth, canvasHeight);

        // Desenhar o marcador (usando um círculo vermelho como exemplo)
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(markerX, markerY, 10, 0, 2 * Math.PI);
        ctx.fill();

        // Converter o canvas para uma imagem base64
        const base64Image = canvas.toBuffer('image/png').toString('base64');
        const media = new MessageMedia('image/png', base64Image);
        await client.sendMessage(from, media, { caption: `Mapa para ${endereco}` });
    } catch (error) {
        console.error('Erro ao gerar o mapa:', error.message);
        await client.sendMessage(from, 'Ocorreu um erro ao gerar o mapa. Tente novamente mais tarde.');
    }

    limparEstadoUsuario(from);
}

async function enviarMensagemInicial(client, from, chat, contact) {
    await delay(1000);
    await chat.sendStateTyping();
    await delay(1000);
    const name = contact.pushname;
    await client.sendMessage(from, `Olá! ${name.split(" ")[0]}, Sou o assistente virtual da Prefeitura do Recife. Como posso ajudá-lo hoje? Por favor, digite uma das opções abaixo:\n\n  1 - Medicamentos \n 2 - Turismo \n 3 - Unidade de Saúde \n 4 - Unidades de Saneamento \n 5 - Unidades de Segurança \n 5 - Unidades de Segurança`);
    limparEstadoUsuario(from);
}

async function handleMedicamentos(client, from, chat, msg) {
    await delay(1000);
    await chat.sendStateTyping();
    await client.sendMessage(from, 'Digite o nome do medicamento que você está procurando nas farmácias da prefeitura');
    setEstadoUsuario(from, 'medicamentos');
}


async function processarSaude(client, from, chat, msg) {
    await delay(1000);
    await chat.sendStateTyping();
    await delay(1000);

    let resultados = null;

    try {
        // Consultar todos os registros do CSV sem filtro de nome
        resultados = await consultarCSV('', 'nome_oficial', './unidades_saude.csv', true); // O true indica que queremos todos os registros

        if (resultados.length > 0) {
            const limite = 20;
            const resultadosLimitados = resultados.slice(0, limite);
            const totalResultados = resultados.length;

            let resposta = 'Lista de Unidades de Saúde:\n';
            resultadosLimitados.forEach((resultado, index) => {
                resposta += `\n${index + 1}. Posto de Saude: ${resultado.nome_oficial || 'Não especificado'}\n`;
                resposta += `   Endereço: ${resultado.endereço || 'Não especificado'}\n`;
            });

            // Informar se os resultados foram limitados
            if (totalResultados > limite) {
                resposta += `\n\nMostrando apenas os primeiros ${limite} de ${totalResultados} unidades encontradas.`;
            }

            await client.sendMessage(from, resposta);
        } else {
            await client.sendMessage(from, 'Nenhuma unidade de saúde encontrada na base de dados.');
            limparEstadoUsuario(from);
        }
    } catch (error) {
        console.error('Erro ao consultar CSV:', error);
        await client.sendMessage(from, 'Ocorreu um erro ao listar as unidades de saúde. Por favor, tente novamente.');
        limparEstadoUsuario(from);
    }

    limparEstadoUsuario(from);
}



async function processarTelecentros(client, from, chat, msg) {
    await delay(1000);
    await chat.sendStateTyping();
    await delay(1000);

    let resultados = null;

    try {
        // Consultar todos os registros do CSV sem filtro de nome
        resultados = await consultarCSV('', 'Telecentro', './telecentros.csv', true); // O true indica que queremos todos os registros

        if (resultados.length > 0) {
            const limite = 20;
            const resultadosLimitados = resultados.slice(0, limite);
            const totalResultados = resultados.length;

            let resposta = 'Lista de Telecentros:\n';
            resultadosLimitados.forEach((resultado, index) => {
                resposta += `\n${index + 1}. Telecentro: ${resultado.Telecentro || 'Não especificado'}\n`;
                resposta += `   Endereço: ${resultado.endereço || 'Não especificado'}\n`;
            });

            // Informar se os resultados foram limitados
            if (totalResultados > limite) {
                resposta += `\n\nMostrando apenas os primeiros ${limite} de ${totalResultados} telecentros encontrados.`;
            }

            await client.sendMessage(from, resposta);
        } else {
            await client.sendMessage(from, 'Nenhum telecentro encontrado na base de dados.');
            limparEstadoUsuario(from);
        }
    } catch (error) {
        console.error('Erro ao consultar CSV:', error);
        await client.sendMessage(from, 'Ocorreu um erro ao listar os telecentros. Por favor, tente novamente.');
        limparEstadoUsuario(from);
    }

    limparEstadoUsuario(from);
}

async function processarUnidadesSeguranca(client, from, chat, msg) {
    await delay(1000);
    await chat.sendStateTyping();
    await delay(1000);

    let resultados = null;

    try {
        // Consultar todos os registros do CSV sem filtro de nome
        resultados = await consultarCSV('', 'equipamento', './unidades_seguranca.csv', true); // O true indica que queremos todos os registros

        if (resultados.length > 0) {
            const limite = 20;
            const resultadosLimitados = resultados.slice(0, limite);
            const totalResultados = resultados.length;

            let resposta = 'Lista de Unidades de Segurança:\n';
            resultadosLimitados.forEach((resultado, index) => {
                resposta += `\n${index + 1}. Posto de Segurança: ${resultado.equipamento || 'Não especificado'}\n`;
                resposta += `   Endereço: ${resultado.endereço || 'Não especificado'}\n`;
            });

            // Informar se os resultados foram limitados
            if (totalResultados > limite) {
                resposta += `\n\nMostrando apenas os primeiros ${limite} de ${totalResultados} unidades encontradas.`;
            }

            await client.sendMessage(from, resposta);
        } else {
            await client.sendMessage(from, 'Nenhuma unidade de segurança encontrada na base de dados.');
            limparEstadoUsuario(from);
        }
    } catch (error) {
        console.error('Erro ao consultar CSV:', error);
        await client.sendMessage(from, 'Ocorreu um erro ao listar as unidades de segurança. Por favor, tente novamente.');
        limparEstadoUsuario(from);
    }

    limparEstadoUsuario(from);
}


async function processarMedicamentosBairro(client, from, chat, msg) {
    await delay(1000);
    await chat.sendStateTyping();
    await delay(1000);

    let resultados = null;

    try {
        // Consultar todos os registros do CSV sem filtro de nome
        resultados = await consultarCSV('', 'MEDICAMENTO', './rel_medicamento_bairro.csv', true); // O true indica que queremos todos os registros

        if (resultados.length > 0) {
            const limite = 20;
            const resultadosLimitados = resultados.slice(0, limite);
            const totalResultados = resultados.length;

            let resposta = 'Lista de Medicamentos por Bairro:\n';
            resultadosLimitados.forEach((resultado, index) => {
                resposta += `\n${index + 1}. Bairro: ${resultado.BAIRRO || 'Não especificado'}\n`;
                resposta += `   Unidade de Saúde: ${resultado['UNIDADE DE SAÚDE'] || 'Não especificado'}\n`;
                resposta += `   Medicamento: ${resultado.MEDICAMENTO || 'Não especificado'}\n`;
                resposta += `   Apresentação: ${resultado.APRESENTAÇÃO || 'Não especificado'}\n`;
                resposta += `   Estoque: ${resultado.ESTOQUE || 'Não especificado'}\n`;
            });

            // Informar se os resultados foram limitados
            if (totalResultados > limite) {
                resposta += `\n\nMostrando apenas os primeiros ${limite} de ${totalResultados} registros encontrados.`;
            }

            await client.sendMessage(from, resposta);
        } else {
            await client.sendMessage(from, 'Nenhum medicamento encontrado na base de dados.');
            limparEstadoUsuario(from);
        }
    } catch (error) {
        console.error('Erro ao consultar CSV:', error);
        await client.sendMessage(from, 'Ocorreu um erro ao listar os medicamentos por bairro. Por favor, tente novamente.');
        limparEstadoUsuario(from);
    }

    limparEstadoUsuario(from);
}

async function processarSolicitacaoImagem(client, from, chat, msg) {
    const respostaUsuario = msg.body.toLowerCase().trim();
    const estado = getEstadoUsuario(from);

    if (respostaUsuario === 'sim') {
        if (estado.subEstado === 'aguardandoMapa') {
            const nomeMedicamento = estado.nomeMedicamento || msg.body;
            const resultados = await consultarCSV(nomeMedicamento, 'medicamento', './medicamentos.csv');
            if (resultados.length > 0) {
                await solicitarImagem(client, from, chat, resultados[0].endereco);
            } else {
                await client.sendMessage(from, 'Não foi possível encontrar o endereço para gerar o mapa.');
                limparEstadoUsuario(from);
            }
        }
    } else if (respostaUsuario === 'não') {
        await client.sendMessage(from, 'Entendido! Se precisar de mais ajuda, é só chamar.');
        limparEstadoUsuario(from);
    } else {
        await client.sendMessage(from, 'Por favor, digite "sim" ou "não".');
        return;
    }
    limparEstadoUsuario(from);
}

async function handleTurismo(client, from, chat, msg) {
    await delay(1000);
    await chat.sendStateTyping();
    await delay(1000);
    await client.sendMessage(from, 'Escolha uma das opções de turismo:\n\n1 - Teatro\n2 - Restaurante');
    setEstadoUsuario(from, 'turismo');
}

async function processarTurismo(client, from, chat, msg) {
    const subOpcao = msg.body;

    let teatrosSorteados = null;

    if (subOpcao === '1') {
        await delay(1000);
        await chat.sendStateTyping();
        await delay(1000);

        try {
            teatrosSorteados = await sortearTeatros('./teatros.csv', 5);
            if (teatrosSorteados.length > 0) {
                let resposta = 'Aqui estão 5 teatros sorteados para você visitar:\n';
                teatrosSorteados.forEach((teatro, index) => {
                    resposta += `\n${index + 1}. ${teatro.nome + ': ' + teatro.descricao || 'Teatro não especificado'}\n`;
                });
                await client.sendMessage(from, resposta);
            } else {
                await client.sendMessage(from, 'Nenhum teatro encontrado na base de dados.');
            }
        } catch (error) {
            console.error('Erro ao sortear teatros:', error);
            await client.sendMessage(from, 'Ocorreu um erro ao buscar os teatros. Por favor, tente novamente.');
        }
    } else if (subOpcao === '2') {
        await delay(1000);
        await chat.sendStateTyping();
        await delay(1000);
        await client.sendMessage(from, 'Função de restaurantes ainda não implementada. Por favor, escolha outra opção.');
    } else {
        await delay(1000);
        await chat.sendStateTyping();
        await delay(1000);
        await client.sendMessage(from, 'Opção inválida. Por favor, escolha 1 para Teatro ou 2 para Restaurante.');
        return;
    }

    if (subOpcao !== '1' || (teatrosSorteados && teatrosSorteados.length === 0)) {
        limparEstadoUsuario(from);
    }
}

async function processarSolicitacaoImagemTurismo(client, from, chat, msg) {
    const respostaUsuario = msg.body.toLowerCase().trim();
    const estado = getEstadoUsuario(from);

    if (respostaUsuario === 'sim') {
        if (estado.subEstado === 'aguardandoMapa') {
            await delay(1000);
            await chat.sendStateTyping();
            await delay(1000);
            const primeiroTeatro = (await sortearTeatros('./teatros.csv', 1))[0];
            await solicitarImagem(client, from, chat, `${primeiroTeatro.logradouro}, ${primeiroTeatro.bairro}`);
        }
    } else if (respostaUsuario === 'não') {
        await client.sendMessage(from, 'Entendido! Se precisar de mais ajuda, é só chamar.');
    } else {
        await client.sendMessage(from, 'Por favor, digite "sim" ou "não".');
        return;
    }
    limparEstadoUsuario(from);
}

async function handleOutrasOpcoes(client, from, chat, msg, opcao) {
    const opcoes = {
        '3': 'Sorteio de em prêmios todo ano.\n\nAtendimento médico ilimitado 24h por dia.\n\nReceitas de medicamentos\n\nLink para cadastro: https://site.com',
        '4': 'Você pode aderir aos nossos planos diretamente pelo nosso site ou pelo WhatsApp.\n\nApós a adesão, você terá acesso imediato\n\nLink para cadastro: https://site.com',
        '5': 'Se você tiver outras dúvidas ou precisar de mais informações, por favor, fale aqui nesse whatsapp ou visite nosso site: https://site.com'
    };

    const mensagem = opcoes[opcao] || 'Opção inválida.';
    await delay(1000);
    await chat.sendStateTyping();
    await delay(1000);
    await client.sendMessage(from, mensagem);
    await delay(1000);
    await chat.sendStateTyping();
    await delay(1000);
    if (opcao === '4') {
        await client.sendMessage(from, 'Link para cadastro: https://site.com');
    }
    limparEstadoUsuario(from);
}

function initializeBot(client) {
    client.on('message', async msg => {
        const from = msg.from;
        const estadoAtual = getEstadoUsuario(from);

        if (msg.body.match(/(menu|Menu|dia|tarde|noite|oi|Oi|Olá|olá|ola|Ola)/i) && msg.from.endsWith('@c.us') && !estadoAtual.estado) {
            const chat = await msg.getChat();
            const contact = await msg.getContact();
            await enviarMensagemInicial(client, from, chat, contact);
        }

        if (msg.body === '1' && msg.from.endsWith('@c.us') && estadoAtual.estado !== 'turismo') {
            const chat = await msg.getChat();
            await handleMedicamentos(client, from, chat, msg);
        }

        if (estadoAtual.estado === 'medicamentos' && msg.from.endsWith('@c.us') && msg.body !== '1') {
            const chat = await msg.getChat();
            if (estadoAtual.subEstado === 'aguardandoMapa') {
                await processarSolicitacaoImagem(client, from, chat, msg);
            } else {
                await processarMedicamento(client, from, chat, msg);
            }
        }

        if (msg.body === '2' && msg.from.endsWith('@c.us') && estadoAtual.estado !== 'medicamentos') {
            const chat = await msg.getChat();
            await handleTurismo(client, from, chat, msg);
        }

        if (estadoAtual.estado === 'turismo' && msg.from.endsWith('@c.us')) {
            const chat = await msg.getChat();
            if (estadoAtual.subEstado === 'aguardandoMapa') {
                await processarSolicitacaoImagemTurismo(client, from, chat, msg);
            } else {
                await processarTurismo(client, from, chat, msg);
            }
        }


        //abaixo:\n\n 0 - Tiago Junior \n 1 - Medicamentos \n 2 - Turismo \n 3 - Unidade de Saúde \n 4 - Unidades de Saneamento \n 5 - Unidades de Segurança

        if (msg.body === '3' && msg.from.endsWith('@c.us') && estadoAtual.estado !== 'unidades') {
            const chat = await msg.getChat();
            await processarSaude(client, from, chat, msg);
        }
        if (estadoAtual.estado === 'unidades' && msg.from.endsWith('@c.us') && msg.body !== '1') {
            const chat = await msg.getChat();
            await processarSaude(client, from, chat, msg);
        }


        if (msg.body === '4' && msg.from.endsWith('@c.us') && estadoAtual.estado !== 'unidades') {
            const chat = await msg.getChat();
            await processarTelecentros(client, from, chat, msg);
        }
        if (estadoAtual.estado === 'unidades' && msg.from.endsWith('@c.us') && msg.body !== '1') {
            const chat = await msg.getChat();
            await processarTelecentros(client, from, chat, msg);
        }


        if (msg.body === '5' && msg.from.endsWith('@c.us') && estadoAtual.estado !== 'unidades') {
            const chat = await msg.getChat();
            await processarUnidadesSeguranca(client, from, chat, msg);
        }
        if (estadoAtual.estado === 'unidades' && msg.from.endsWith('@c.us') && msg.body !== '1') {
            const chat = await msg.getChat();
            await processarUnidadesSeguranca(client, from, chat, msg);
        }


        if (msg.body === '6' && msg.from.endsWith('@c.us') && estadoAtual.estado !== 'correlacao') {
            const chat = await msg.getChat();
            await processarMedicamentosBairro(client, from, chat, msg);
        }
        if (estadoAtual.estado === 'correlacao' && msg.from.endsWith('@c.us') && msg.body !== '1') {
            const chat = await msg.getChat();
            await processarMedicamentosBairro(client, from, chat, msg);
        }






















    });
}

module.exports = { initializeBot };