const crypto = require('crypto');
const ambiente = require('./ambiente');
const { apiAutenticada, apiPublica } = require('./api');
const { assinar } = require('./assinatura');

/* ----------------------------- Dados fictícios ----------------------------- */

function digitoCpf(base) {
  const pesoInicial = base.length + 1;
  const soma = [...base].reduce((acc, d, i) => acc + Number(d) * (pesoInicial - i), 0);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

/** Gera um CPF FICTÍCIO que passa no algoritmo de validação. */
function gerarCpf() {
  let base;
  do {
    base = Array.from({ length: 9 }, () => crypto.randomInt(0, 10)).join('');
  } while (/^(\d)\1{8}$/.test(base));
  const d1 = digitoCpf(base);
  const d2 = digitoCpf(base + d1);
  return `${base}${d1}${d2}`;
}

/** CPF com o último dígito verificador propositalmente errado. */
function gerarCpfInvalido() {
  const cpf = gerarCpf();
  return cpf.slice(0, 10) + ((Number(cpf[10]) + 1) % 10);
}

const NOMES = ['Ana Teste', 'Bruno Exemplo', 'Carla Ficticia', 'Diego Simulado', 'Eva Demonstracao'];
const nomeAleatorio = () => `${NOMES[crypto.randomInt(0, NOMES.length)]} ${crypto.randomInt(1000, 9999)}`;

const novaChave = () => `teste-${crypto.randomUUID()}`;

/* ------------------------------- Operações -------------------------------- */

async function criarConta(dados = {}) {
  const api = await apiAutenticada();
  const resposta = await api.post('/contas', { nome: nomeAleatorio(), documento: gerarCpf(), ...dados });
  if (resposta.status !== 201) throw new Error(`Falha ao criar conta: ${JSON.stringify(resposta.data)}`);
  return resposta.data;
}

/** Envia o webhook de PIX recebido, assinado corretamente (simula o provedor). */
async function enviarPix({ contaId, valor, eventoId = `pix-${crypto.randomUUID()}`, segredo, timestamp, corpo }) {
  const conteudo = corpo ?? { evento_id: eventoId, tipo: 'pix.recebido', conta_id: contaId, valor };
  const corpoBruto = typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo);
  const header = assinar(segredo ?? ambiente.pixWebhookSecret, corpoBruto, timestamp);
  const resposta = await apiPublica({ 'X-Assinatura': header }).post('/webhooks/pix', corpoBruto);
  return { resposta, eventoId, corpoBruto, header };
}

/** Cria uma conta e já deposita saldo nela via PIX. */
async function criarContaComSaldo(saldo) {
  const conta = await criarConta();
  if (saldo > 0) {
    const { resposta } = await enviarPix({ contaId: conta.id, valor: saldo });
    if (resposta.status !== 200) throw new Error(`Falha ao depositar: ${JSON.stringify(resposta.data)}`);
  }
  return { ...conta, saldo };
}

async function transferir({ origem, destino, valor, descricao, chave = novaChave() }) {
  const api = await apiAutenticada();
  const corpo = { conta_origem_id: origem, conta_destino_id: destino, valor };
  if (descricao !== undefined) corpo.descricao = descricao;
  const resposta = await api.post('/transferencias', corpo, { headers: { 'Idempotency-Key': chave } });
  return { resposta, chave, corpo };
}

async function consultarSaldo(contaId) {
  const api = await apiAutenticada();
  const resposta = await api.get(`/contas/${contaId}`);
  return resposta.data.saldo;
}

module.exports = {
  gerarCpf,
  gerarCpfInvalido,
  nomeAleatorio,
  novaChave,
  criarConta,
  enviarPix,
  criarContaComSaldo,
  transferir,
  consultarSaldo,
};
