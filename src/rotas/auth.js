const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { erros } = require('../utils/erros');
const { ehObjeto, lancarSeHouverErros } = require('../utils/validacao');

const router = express.Router();

function iguaisSeguro(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

/**
 * POST /auth/token — fluxo client_credentials simplificado.
 * Corpo: { "client_id": "...", "client_secret": "..." }
 */
router.post('/token', (req, res) => {
  const corpo = ehObjeto(req.body) ? req.body : {};
  const detalhes = [];
  if (typeof corpo.client_id !== 'string' || !corpo.client_id) {
    detalhes.push({ campo: 'client_id', mensagem: 'Obrigatório.' });
  }
  if (typeof corpo.client_secret !== 'string' || !corpo.client_secret) {
    detalhes.push({ campo: 'client_secret', mensagem: 'Obrigatório.' });
  }
  lancarSeHouverErros(detalhes);

  const valido =
    iguaisSeguro(corpo.client_id, config.clientId) && iguaisSeguro(corpo.client_secret, config.clientSecret);
  if (!valido) throw erros.credenciaisInvalidas();

  const token = jwt.sign({ sub: corpo.client_id }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: config.jwtExpiracaoSegundos,
  });

  res.set('Cache-Control', 'no-store');
  res.status(200).json({ access_token: token, token_type: 'Bearer', expires_in: config.jwtExpiracaoSegundos });
});

module.exports = router;
