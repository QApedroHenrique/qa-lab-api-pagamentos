const { emTransacao } = require('../db/pool');
const { erros } = require('../utils/erros');
const { movimentar } = require('./contas');

/**
 * Processa a notificação de um PIX recebido, enviada pelo provedor (fictício).
 * Idempotente por evento_id: o mesmo evento nunca credita a conta duas vezes,
 * mesmo que o provedor reenvie a notificação.
 */
async function processarPixRecebido({ evento_id: eventoId, conta_id: contaId, valor }) {
  return emTransacao(async (cliente) => {
    const conta = await cliente.query('SELECT id FROM contas WHERE id = $1 FOR UPDATE', [contaId]);
    if (!conta.rowCount) throw erros.naoEncontrado('Conta');

    const registro = await cliente.query(
      `INSERT INTO eventos_pix_recebidos (evento_id, conta_id, valor) VALUES ($1, $2, $3)
       ON CONFLICT (evento_id) DO NOTHING RETURNING evento_id`,
      [eventoId, contaId, valor],
    );
    if (!registro.rowCount) return { evento_id: eventoId, status: 'JA_PROCESSADO' };

    await movimentar(cliente, {
      contaId,
      tipo: 'CREDITO',
      origem: 'PIX_RECEBIDO',
      valor,
      referenciaId: eventoId,
    });
    return { evento_id: eventoId, status: 'PROCESSADO' };
  });
}

module.exports = { processarPixRecebido };
