const express = require('express');
const contas = require('../servicos/contas');
const { cpfValido } = require('../utils/cpf');
const { ehObjeto, garantirUuid, lancarSeHouverErros } = require('../utils/validacao');

const router = express.Router();

const NOME_MIN = 3;
const NOME_MAX = 100;
const LIMITE_EXTRATO_PADRAO = 50;
const LIMITE_EXTRATO_MAX = 100;

/** POST /contas — cria uma conta com saldo zero. */
router.post('/', async (req, res) => {
  const corpo = ehObjeto(req.body) ? req.body : {};
  const detalhes = [];

  const nome = typeof corpo.nome === 'string' ? corpo.nome.trim() : corpo.nome;
  if (typeof nome !== 'string' || nome.length < NOME_MIN || nome.length > NOME_MAX) {
    detalhes.push({ campo: 'nome', mensagem: `Deve ter entre ${NOME_MIN} e ${NOME_MAX} caracteres.` });
  }
  if (!cpfValido(corpo.documento)) {
    detalhes.push({ campo: 'documento', mensagem: 'Deve ser um CPF válido com 11 dígitos, sem pontuação.' });
  }
  lancarSeHouverErros(detalhes);

  const conta = await contas.criarConta({ nome, documento: corpo.documento });
  res.status(201).location(`/contas/${conta.id}`).json(conta);
});

/** GET /contas/:id — consulta conta e saldo. */
router.get('/:id', async (req, res) => {
  garantirUuid(req.params.id);
  res.json(await contas.buscarConta(req.params.id));
});

/** GET /contas/:id/extrato?limite=N — lançamentos mais recentes primeiro. */
router.get('/:id/extrato', async (req, res) => {
  garantirUuid(req.params.id);

  let limite = LIMITE_EXTRATO_PADRAO;
  if (req.query.limite !== undefined) {
    const texto = String(req.query.limite);
    limite = /^\d+$/.test(texto) ? Number(texto) : NaN;
    if (!Number.isInteger(limite) || limite < 1 || limite > LIMITE_EXTRATO_MAX) {
      lancarSeHouverErros([
        { campo: 'limite', mensagem: `Deve ser um inteiro entre 1 e ${LIMITE_EXTRATO_MAX}.` },
      ]);
    }
  }

  res.json(await contas.buscarExtrato(req.params.id, limite));
});

module.exports = router;
