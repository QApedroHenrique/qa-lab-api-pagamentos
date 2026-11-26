const axios = require('axios');
const ambiente = require('./ambiente');

/**
 * Cliente HTTP que NUNCA lança exceção por status de erro:
 * cada teste verifica o status explicitamente (200, 201, 400, 401, 404, 409, 422...).
 */
function criarCliente(headers = {}) {
  return axios.create({
    baseURL: ambiente.baseUrl(),
    headers: { 'Content-Type': 'application/json', ...headers },
    validateStatus: () => true,
    timeout: 10000,
  });
}

let tokenEmCache;

async function obterToken() {
  if (tokenEmCache) return tokenEmCache;
  const resposta = await criarCliente().post('/auth/token', {
    client_id: ambiente.clientId,
    client_secret: ambiente.clientSecret,
  });
  if (resposta.status !== 200) {
    throw new Error(`Não foi possível obter token (status ${resposta.status}): ${JSON.stringify(resposta.data)}`);
  }
  tokenEmCache = resposta.data.access_token;
  return tokenEmCache;
}

/** Cliente já autenticado com Bearer token. */
async function apiAutenticada() {
  const token = await obterToken();
  return criarCliente({ Authorization: `Bearer ${token}` });
}

/** Cliente sem autenticação. */
function apiPublica(headers) {
  return criarCliente(headers);
}

module.exports = { apiAutenticada, apiPublica, obterToken };
