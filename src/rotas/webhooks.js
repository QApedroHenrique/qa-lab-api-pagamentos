const express = require('express');
const config = require('../config');
const pix = require('../servicos/pix');
const webhooks = require('../servicos/webhooks');
const { exigirToken } = require('../middlewares/autenticacao');
const { erros } = require('../utils/erros');
const { verificarAssinatura } = require('../utils/assinatura');
const { destinoPermitido } = require('../utils/destino-webhook');
const { ehObjeto, ehUuid, garantirUuid, validarValor, lancarSeHouverErros } = require('../utils/validacao');

const router = express.Router();

/**
 * POST /webhooks/pix — ENTRADA: o provedor PIX (fictício) avisa que uma conta recebeu um PIX.
 * Autenticação por assinatura HMAC no header X-Assinatura (não usa Bearer token).
 */
router.post('/pix', async (req, res) => {
  const verificacao = verificarAssinatura(
    config.pixWebhookSecret,
    req.corpoBruto || '',
    req.get('X-Assinatura'),
    config.toleranciaAssinaturaSegundos,
  );
  if (!verificacao.valida) throw erros.assinaturaInvalida(verificacao.motivo);

  const corpo = ehObjeto(req.body) ? req.body : {};
  const detalhes = [];
  if (typeof corpo.evento_id !== 'string' || !/^[A-Za-z0-9._:-]{1,100}$/.test(corpo.evento_id)) {
    detalhes.push({ campo: 'evento_id', mensagem: 'Obrigatório (1 a 100 caracteres).' });
  }
  if (corpo.tipo !== 'pix.recebido') detalhes.push({ campo: 'tipo', mensagem: 'Deve ser "pix.recebido".' });
  if (!ehUuid(corpo.conta_id)) detalhes.push({ campo: 'conta_id', mensagem: 'Deve ser um UUID.' });
  validarValor(corpo.valor, undefined, detalhes);
  lancarSeHouverErros(detalhes);

  const resultado = await pix.processarPixRecebido({
    evento_id: corpo.evento_id,
    conta_id: corpo.conta_id.toLowerCase(),
    valor: corpo.valor,
  });
  res.status(200).json(resultado);
});

/** Rotas de gerenciamento de assinaturas (SAÍDA) exigem token. */
router.use('/assinaturas', exigirToken);

/** POST /webhooks/assinaturas — cadastra uma URL para receber eventos. */
router.post('/assinaturas', async (req, res) => {
  const corpo = ehObjeto(req.body) ? req.body : {};
  const detalhes = [];

  let url = null;
  try {
    url = new URL(corpo.url);
  } catch {
    url = null;
  }
  if (!url || !['http:', 'https:'].includes(url.protocol)) {
    detalhes.push({ campo: 'url', mensagem: 'Deve ser uma URL http(s) válida.' });
  } else if (!destinoPermitido(url, config.webhookHostsPermitidos)) {
    detalhes.push({
      campo: 'url',
      mensagem: 'Destino não permitido: endereços locais ou de rede interna são bloqueados.',
    });
  }

  const eventosValidos =
    Array.isArray(corpo.eventos) &&
    corpo.eventos.length > 0 &&
    corpo.eventos.every((e) => webhooks.EVENTOS_DISPONIVEIS.includes(e));
  if (!eventosValidos) {
    detalhes.push({
      campo: 'eventos',
      mensagem: `Lista não vazia com: ${webhooks.EVENTOS_DISPONIVEIS.join(', ')}.`,
    });
  }
  lancarSeHouverErros(detalhes);

  const assinatura = await webhooks.criarAssinatura({ url: corpo.url, eventos: corpo.eventos });
  res.status(201).location(`/webhooks/assinaturas/${assinatura.id}`).json(assinatura);
});

/** GET /webhooks/assinaturas/:id/entregas — histórico de entregas e retentativas. */
router.get('/assinaturas/:id/entregas', async (req, res) => {
  garantirUuid(req.params.id);
  res.json({ entregas: await webhooks.listarEntregas(req.params.id) });
});

/** DELETE /webhooks/assinaturas/:id */
router.delete('/assinaturas/:id', async (req, res) => {
  garantirUuid(req.params.id);
  await webhooks.removerAssinatura(req.params.id);
  res.status(204).end();
});

module.exports = router;
