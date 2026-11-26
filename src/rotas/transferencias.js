const express = require('express');
const config = require('../config');
const servico = require('../servicos/transferencias');
const { erros } = require('../utils/erros');
const { ehObjeto, ehUuid, garantirUuid, validarValor, lancarSeHouverErros } = require('../utils/validacao');

const router = express.Router();

const REGEX_CHAVE = /^[A-Za-z0-9._:-]{1,100}$/;

/** POST /transferencias — exige o header Idempotency-Key. */
router.post('/', async (req, res) => {
  const chave = req.get('Idempotency-Key');
  if (!chave || !REGEX_CHAVE.test(chave)) {
    throw erros.validacao([
      {
        campo: 'Idempotency-Key',
        mensagem: 'Header obrigatório (1 a 100 caracteres: letras, números, ".", "_", ":" ou "-").',
      },
    ]);
  }

  const corpo = ehObjeto(req.body) ? req.body : {};
  const detalhes = [];
  if (!ehUuid(corpo.conta_origem_id)) detalhes.push({ campo: 'conta_origem_id', mensagem: 'Deve ser um UUID.' });
  if (!ehUuid(corpo.conta_destino_id)) detalhes.push({ campo: 'conta_destino_id', mensagem: 'Deve ser um UUID.' });
  validarValor(corpo.valor, config.valorMaximoTransferenciaCentavos, detalhes);
  if (
    corpo.descricao !== undefined &&
    corpo.descricao !== null &&
    (typeof corpo.descricao !== 'string' || corpo.descricao.length > config.tamanhoMaximoDescricao)
  ) {
    detalhes.push({ campo: 'descricao', mensagem: `Texto de até ${config.tamanhoMaximoDescricao} caracteres.` });
  }
  lancarSeHouverErros(detalhes);

  if (corpo.conta_origem_id.toLowerCase() === corpo.conta_destino_id.toLowerCase()) {
    throw erros.regraNegocio('CONTAS_IGUAIS', 'A conta de origem e a de destino não podem ser a mesma.');
  }

  const dados = {
    conta_origem_id: corpo.conta_origem_id.toLowerCase(),
    conta_destino_id: corpo.conta_destino_id.toLowerCase(),
    valor: corpo.valor,
  };
  if (typeof corpo.descricao === 'string') dados.descricao = corpo.descricao;

  const { status, corpo: resposta, repetida } = await servico.transferir(dados, chave);
  if (repetida) res.set('Idempotency-Replayed', 'true');
  res.status(status).location(`/transferencias/${resposta.id}`).json(resposta);
});

/** GET /transferencias/:id */
router.get('/:id', async (req, res) => {
  garantirUuid(req.params.id);
  res.json(await servico.buscarTransferencia(req.params.id));
});

/** POST /transferencias/:id/estorno */
router.post('/:id/estorno', async (req, res) => {
  garantirUuid(req.params.id);
  res.status(200).json(await servico.estornar(req.params.id));
});

module.exports = router;
