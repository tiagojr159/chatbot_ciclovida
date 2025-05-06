const delay = ms => new Promise(res => setTimeout(res, ms));

// Gerenciamento de estados por usuário
const estados = new Map();

function setEstadoUsuario(from, estado, subEstado = null, dadosAdicionais = {}) {
    estados.set(from, { estado, subEstado, timestamp: Date.now(), ...dadosAdicionais });
}

function getEstadoUsuario(from) {
    return estados.get(from) || { estado: null, subEstado: null, timestamp: null };
}

function limparEstadoUsuario(from) {
    estados.delete(from);
}

module.exports = {
    delay,
    setEstadoUsuario,
    getEstadoUsuario,
    limparEstadoUsuario
};