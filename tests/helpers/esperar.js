/**
 * Espera por CONDIÇÃO, não por tempo fixo: chama `obter()` até `condicao(valor)` ser verdadeira
 * e devolve o último valor. Estoura com mensagem clara se o tempo acabar.
 */
async function aguardarAte(obter, condicao, { timeoutMs = 5000, intervaloMs = 25, descricao = 'condição' } = {}) {
  const inicio = Date.now();
  let ultimo;
  while (Date.now() - inicio < timeoutMs) {
    ultimo = await obter();
    if (condicao(ultimo)) return ultimo;
    await new Promise((r) => setTimeout(r, intervaloMs));
  }
  throw new Error(`Timeout de ${timeoutMs}ms esperando ${descricao}. Último valor: ${JSON.stringify(ultimo)}`);
}

module.exports = { aguardarAte };
