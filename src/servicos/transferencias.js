const crypto = require('crypto');
const { pool, emTransacao } = require('../db/pool');
const { erros } = require('../utils/erros');
const { movimentar } = require('./contas');
const webhooks = require('./webhooks');

function formatarTransferencia(linha) {
  return {
    id: linha.id,
    conta_origem_id: linha.conta_origem_id,
    conta_destino_id: linha.conta_destino_id,
    valor: Number(linha.valor),
    descricao: linha.descricao,
    status: linha.status,
    criada_em: linha.criada_em.toISOString(),
    estornada_em: linha.estornada_em ? linha.estornada_em.toISOString() : null,
  };
}

/** Hash estável do corpo: ordem das chaves não muda o resultado. */
function hashCorpo(corpo) {
  const normalizado = JSON.stringify(corpo, Object.keys(corpo).sort());
  return crypto.createHash('sha256').update(normalizado).digest('hex');
}

/**
 * Bloqueia (FOR UPDATE) as contas envolvidas SEMPRE na mesma ordem (por id),
 * o que evita deadlock quando A->B e B->A acontecem ao mesmo tempo.
 */
async function bloquearContas(cliente, ids) {
  const { rows } = await cliente.query(
    'SELECT id, saldo FROM contas WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE',
    [ids],
  );
  return new Map(rows.map((r) => [r.id, { ...r, saldo: Number(r.saldo) }]));
}

/**
 * Cria uma transferência entre contas com garantia de idempotência.
 * Retorna { status, corpo, repetida }.
 */
async function transferir(dados, chaveIdempotencia) {
  const hash = hashCorpo(dados);

  const resultado = await emTransacao(async (cliente) => {
    // 1) Reserva a chave. Se outra requisição com a mesma chave estiver em andamento,
    //    o Postgres faz esta linha esperar até a outra terminar.
    const reserva = await cliente.query(
      `INSERT INTO chaves_idempotencia (chave, hash_requisicao) VALUES ($1, $2)
       ON CONFLICT (chave) DO NOTHING RETURNING chave`,
      [chaveIdempotencia, hash],
    );

    if (!reserva.rowCount) {
      const { rows } = await cliente.query('SELECT * FROM chaves_idempotencia WHERE chave = $1', [
        chaveIdempotencia,
      ]);
      const existente = rows[0];
      if (existente.hash_requisicao !== hash) {
        throw erros.regraNegocio(
          'CHAVE_IDEMPOTENCIA_REUTILIZADA',
          'Esta Idempotency-Key já foi usada com um corpo de requisição diferente.',
        );
      }
      return { status: existente.status_http, corpo: existente.corpo_resposta, repetida: true };
    }

    // 2) Bloqueia as contas e valida as regras de negócio
    const contas = await bloquearContas(cliente, [dados.conta_origem_id, dados.conta_destino_id]);
    const origem = contas.get(dados.conta_origem_id);
    if (!origem) throw erros.naoEncontrado('Conta de origem');
    if (!contas.get(dados.conta_destino_id)) throw erros.naoEncontrado('Conta de destino');
    if (origem.saldo < dados.valor) {
      throw erros.regraNegocio('SALDO_INSUFICIENTE', 'A conta de origem não tem saldo suficiente.');
    }

    // 3) Registra a transferência e os dois lançamentos (débito e crédito)
    const { rows } = await cliente.query(
      `INSERT INTO transferencias (id, conta_origem_id, conta_destino_id, valor, descricao, status)
       VALUES ($1, $2, $3, $4, $5, 'CONCLUIDA') RETURNING *`,
      [crypto.randomUUID(), dados.conta_origem_id, dados.conta_destino_id, dados.valor, dados.descricao ?? null],
    );
    const transferencia = formatarTransferencia(rows[0]);

    await movimentar(cliente, {
      contaId: transferencia.conta_origem_id,
      tipo: 'DEBITO',
      origem: 'TRANSFERENCIA',
      valor: transferencia.valor,
      referenciaId: transferencia.id,
    });
    await movimentar(cliente, {
      contaId: transferencia.conta_destino_id,
      tipo: 'CREDITO',
      origem: 'TRANSFERENCIA',
      valor: transferencia.valor,
      referenciaId: transferencia.id,
    });

    // 4) Guarda a resposta para devolver igual em caso de repetição
    await cliente.query(
      'UPDATE chaves_idempotencia SET status_http = 201, corpo_resposta = $1 WHERE chave = $2',
      [transferencia, chaveIdempotencia],
    );

    return { status: 201, corpo: transferencia, repetida: false };
  });

  if (!resultado.repetida) {
    webhooks.publicarSemBloquear('transferencia.concluida', { transferencia: resultado.corpo });
  }
  return resultado;
}

async function buscarTransferencia(id) {
  const { rows } = await pool.query('SELECT * FROM transferencias WHERE id = $1', [id]);
  if (!rows.length) throw erros.naoEncontrado('Transferência');
  return formatarTransferencia(rows[0]);
}

/** Estorna uma transferência concluída: devolve o valor do destino para a origem. */
async function estornar(id) {
  const transferencia = await emTransacao(async (cliente) => {
    const { rows } = await cliente.query('SELECT * FROM transferencias WHERE id = $1 FOR UPDATE', [id]);
    if (!rows.length) throw erros.naoEncontrado('Transferência');
    const atual = formatarTransferencia(rows[0]);

    if (atual.status === 'ESTORNADA') {
      throw erros.conflito('TRANSFERENCIA_JA_ESTORNADA', 'Esta transferência já foi estornada.');
    }

    const contas = await bloquearContas(cliente, [atual.conta_origem_id, atual.conta_destino_id]);
    if (contas.get(atual.conta_destino_id).saldo < atual.valor) {
      throw erros.regraNegocio(
        'SALDO_INSUFICIENTE_PARA_ESTORNO',
        'A conta de destino não tem saldo suficiente para devolver o valor.',
      );
    }

    await movimentar(cliente, {
      contaId: atual.conta_destino_id,
      tipo: 'DEBITO',
      origem: 'ESTORNO',
      valor: atual.valor,
      referenciaId: atual.id,
    });
    await movimentar(cliente, {
      contaId: atual.conta_origem_id,
      tipo: 'CREDITO',
      origem: 'ESTORNO',
      valor: atual.valor,
      referenciaId: atual.id,
    });

    const atualizada = await cliente.query(
      `UPDATE transferencias SET status = 'ESTORNADA', estornada_em = now() WHERE id = $1 RETURNING *`,
      [id],
    );
    return formatarTransferencia(atualizada.rows[0]);
  });

  webhooks.publicarSemBloquear('transferencia.estornada', { transferencia });
  return transferencia;
}

module.exports = { transferir, buscarTransferencia, estornar };
