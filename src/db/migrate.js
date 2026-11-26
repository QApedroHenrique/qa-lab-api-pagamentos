const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

/** Aplica o schema (idempotente: usa CREATE ... IF NOT EXISTS). */
async function migrar() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
}

/** Limpa todas as tabelas. Usado apenas pelo setup dos testes locais. */
async function limparBanco() {
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
