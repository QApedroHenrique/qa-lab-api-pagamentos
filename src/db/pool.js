const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool({ connectionString: config.databaseUrl, max: 20 });

/**
 * Executa uma função dentro de uma transação de banco.
 * Faz COMMIT se tudo der certo e ROLLBACK se qualquer erro for lançado.
 * Se o próprio ROLLBACK falhar (ex.: conexão caiu), o erro ORIGINAL é preservado e a conexão
 * é descartada do pool em vez de ser reaproveitada quebrada pela próxima requisição.
 */
async function emTransacao(fn) {
  const cliente = await pool.connect();
  let conexaoQuebrada;
  try {
    await cliente.query('BEGIN');
    const resultado = await fn(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (erro) {
    try {
      await cliente.query('ROLLBACK');
    } catch (erroRollback) {
      conexaoQuebrada = erroRollback;
    }
    throw erro;
  } finally {
    cliente.release(conexaoQuebrada); // com erro, o pg destrói a conexão
  }
}

module.exports = { pool, emTransacao };
