const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');

const { pool } = require('./db/pool');
const { exigirToken } = require('./middlewares/autenticacao');
const { rotaNaoEncontrada, tratarErros } = require('./middlewares/erros');

const especificacao = YAML.parse(
  fs.readFileSync(path.join(__dirname, '..', 'openapi', 'openapi.yaml'), 'utf8'),
);

function criarApp() {
  const app = express();
  app.disable('x-powered-by');

  // Identificador único por requisição (facilita rastrear um bug nos logs)
  app.use((req, res, next) => {
    const recebido = req.get('X-Request-Id');
    req.id = recebido && /^[\w-]{1,100}$/.test(recebido) ? recebido : crypto.randomUUID();
    res.set('X-Request-Id', req.id);
    next();
  });

  // Guarda o corpo BRUTO: a assinatura HMAC dos webhooks é calculada sobre os bytes exatos recebidos
  app.use(
    express.json({
      limit: '100kb',
      verify: (req, res, buffer) => {
        req.corpoBruto = buffer.toString('utf8');
      },
    }),
  );

  // Documentação navegável
  app.get('/openapi.json', (req, res) => res.json(especificacao));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(especificacao, { customSiteTitle: 'API de Pagamentos — QA Lab' }));

  app.get('/saude', async (req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', banco: 'ok' });
    } catch {
      res.status(503).json({ status: 'indisponivel', banco: 'falha' });
    }
  });

  app.use('/auth', require('./rotas/auth'));
  app.use('/webhooks', require('./rotas/webhooks'));
  app.use('/contas', exigirToken, require('./rotas/contas'));
  app.use('/transferencias', exigirToken, require('./rotas/transferencias'));

  app.use(rotaNaoEncontrada);
  app.use(tratarErros);
  return app;
}

module.exports = { criarApp };
