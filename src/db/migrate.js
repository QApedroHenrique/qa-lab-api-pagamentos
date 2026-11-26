const fs = require('fs');
const path = require('path');
const config = require('../config');
const { pool } = require('./pool');

/** Aplica o schema (idempotente: usa CREATE ... IF NOT EXISTS). */
async function migrar() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
}

const HOSTS_LOCAIS = ['localhost', '127.0.0.1', '::1', '[::1]', 'db'];

/**
 * Trava de segurança: TRUNCATE só em banco local (máquina do dev, container `db` do compose ou
 * serviço do CI). Para outro host, é preciso pedir explicitamente com PERMITIR_LIMPEZA_BANCO=true.
 * Em produção, nunca.
 */
function garantirQuePodeLimpar() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('limparBanco() recusado: NODE_ENV=production.');
  }
  const host = new URL(config.databaseUrl).hostname.toLowerCase();
  if (!HOSTS_LOCAIS.includes(host) && process.env.PERMITIR_LIMPEZA_BANCO !== 'true') {
    throw new Error(
      `limparBanco() recusado: o banco em "${host}" não é local. ` +
        'Se tiver certeza de que é um banco de teste descartável, defina PERMITIR_LIMPEZA_BANCO=true.',
    );
  }
}

/** Limpa todas as tabelas. Usado apenas pelo setup dos testes locais. */
async function limparBanco() {
  garantirQuePodeLimpar();
  await pool.query(`
    TRUNCATE entregas_webhook, assinaturas_webhook, eventos_pix_recebidos,
             chaves_idempotencia, lancamentos, transferencias, contas
    RESTART IDENTITY CASCADE
  `);
}

if (require.main === module) {
  migrar()
    .then(() => {
      console.log('Schema aplicado com sucesso.');
      return pool.end();
    })
    .catch((erro) => {
      console.error('Falha ao aplicar o schema:', erro.message);
      process.exit(1);
    });
}

module.exports = { migrar, limparBanco };
