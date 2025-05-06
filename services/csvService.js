const fs = require('fs');
const csv = require('csv-parser');

async function consultarCSV(termoBusca, colunaBusca, caminhoArquivo) {
    return new Promise((resolve, reject) => {
        const resultados = [];

        fs.createReadStream(caminhoArquivo)
            .pipe(csv())
            .on('data', (row) => {
                if (row[colunaBusca] && row[colunaBusca].toLowerCase().includes(termoBusca.toLowerCase())) {
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

module.exports = {
    consultarCSV,
    sortearTeatros
};