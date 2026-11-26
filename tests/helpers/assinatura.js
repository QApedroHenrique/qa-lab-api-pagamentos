const crypto = require('crypto');

/**
 * Implementação INDEPENDENTE da assinatura HMAC, escrita a partir da documentação.
 * Os testes não importam o código da API: se a API mudar o algoritmo, o teste percebe.
 */
function assinar(segredo, corpoBruto, timestamp = Math.floor(Date.now() / 1000)) {
  const hmac = crypto.createHmac('sha256', segredo).update(`${timestamp}.${corpoBruto}`).digest('hex');
  return `t=${timestamp},v1=${hmac}`;
}

/** Confere uma assinatura recebida em um webhook de saída. */
function assinaturaConfere(segredo, corpoBruto, header) {
  const match = /^t=(\d+),v1=([a-f0-9]{64})$/.exec(header || '');
  if (!match) return false;
  return assinar(segredo, corpoBruto, Number(match[1])) === header;
}

module.exports = { assinar, assinaturaConfere };
