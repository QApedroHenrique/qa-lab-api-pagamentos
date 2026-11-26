const crypto = require('crypto');
const { pool } = require('../db/pool');
const { erros } = require('../utils/erros');
const { mascararCpf } = require('../utils/cpf');

function formatarConta(linha) {
  return {
    id: linha.id,
    nome: linha.nome,
    documento_mascarado: mascararCpf(linha.documento),
    saldo: Number(linha.saldo),
    criada_em: linha.criada_em.toISOString(),
  };
}

async function criarConta({ nome, documento }) {
  try {
    const { rows } = await pool.query(
      'INSERT INTO contas (id, nome, documento) VALUES ($1, $2, $3) RETURNING *',
      [crypto.randomUUID(), nome, documento],
    );
    return formatarConta(rows[0]);
  } catch (erro) {
    if (erro.code === '23505') {
      throw erros.conflito('DOCUMENTO_JA_CADASTRADO', 'Já existe uma conta com este documento.');
    }
    throw erro;
  }
}

async function buscarConta(id) {
  const { rows } = await pool.query('SELECT * FROM contas WHERE id = $1', [id]);
  if (!rows.length) throw erros.naoEncontrado('Conta');
  return formatarConta(rows[0]);
}

async function buscarExtrato(id, limite) {
  const conta = await buscarConta(id);
  const { rows } = await pool.query(
    `SELECT id, tipo, origem, valor, referencia_id, criado_em
       FROM lancamentos
      WHERE conta_id = $1
      ORDER BY id DESC
      LIMIT $2`,
    [id, limite],
  );
  return {
    conta_id: conta.id,
    saldo: conta.saldo,
    lancamentos: rows.map((l) => ({
      id: Number(l.id),
      tipo: l.tipo,
      origem: l.origem,
      valor: Number(l.valor),
      referencia_id: l.referencia_id,
      criado_em: l.criado_em.toISOString(),
    })),
  };
}

/**
 * Movimenta o saldo de uma conta e registra o lançamento no livro-razão.
 * Deve ser chamada DENTRO de uma transação (recebe o cliente da transação).
 */
async function movimentar(cliente, { contaId, tipo, origem, valor, referenciaId }) {
  const sinal = tipo === 'CREDITO' ? 1 : -1;
  await cliente.query('UPDATE contas SET saldo = saldo + $1 WHERE id = $2', [sinal * valor, contaId]);
  await cliente.query(
    `INSERT INTO lancamentos (conta_id, tipo, origem, valor, referencia_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [contaId, tipo, origem, valor, referenciaId],
  );
}

module.exports = { criarConta, buscarConta, buscarExtrato, movimentar, formatarConta };
