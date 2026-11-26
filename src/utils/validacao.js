const config = require('../config');
const { erros } = require('./erros');

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function ehUuid(valor) {
  return typeof valor === 'string' && REGEX_UUID.test(valor);
}

function garantirUuid(valor, campo = 'id') {
  if (!ehUuid(valor)) throw erros.idInvalido(campo);
}

function ehObjeto(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

/** Valor monetário em centavos: inteiro, >= mínimo e <= máximo informado. */
function validarValor(valor, maximo, detalhes, campo = 'valor') {
  if (typeof valor !== 'number' || !Number.isInteger(valor)) {
    detalhes.push({ campo, mensagem: 'Deve ser um número inteiro em centavos.' });
  } else if (valor < config.valorMinimoCentavos) {
    detalhes.push({ campo, mensagem: `Deve ser maior ou igual a ${config.valorMinimoCentavos}.` });
  } else if (maximo !== undefined && valor > maximo) {
    detalhes.push({ campo, mensagem: `Deve ser menor ou igual a ${maximo}.` });
  }
}

function lancarSeHouverErros(detalhes) {
  if (detalhes.length) throw erros.validacao(detalhes);
}

module.exports = { ehUuid, garantirUuid, ehObjeto, validarValor, lancarSeHouverErros };
