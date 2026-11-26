const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const ambiente = require('./ambiente');

/**
 * Acesso de LEITURA ao banco, usado para validar o estado dos dados com SQL
 * (o que a API responde precisa bater com o que foi gravado).
 */
const pool = new Pool({ connectionString: ambiente.databaseUrl, max: 3 });

async function consultar(sql, parametros = []) {
  const { rows } = await pool.query(sql, parametros);
  return rows;
}

/** Executa uma das consultas versionadas em /sql (as mesmas que podem ser rodadas no DBeaver/psql). */
async function executarArquivoSql(caminhoRelativo, parametros = []) {
  const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'sql', caminhoRelativo), 'utf8');
  return consultar(sql, parametros);
}

async function fechar() {
  await pool.end();
}

module.exports = { consultar, executarArquivoSql, fechar };
