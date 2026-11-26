const crypto = require('crypto');
const config = require('../config');
const { pool } = require('../db/pool');
const { erros } = require('../utils/erros');
const { gerarAssinatura } = require('../utils/assinatura');

const EVENTOS_DISPONIVEIS = ['transferencia.concluida', 'transferencia.estornada'];

function formatarAssinatura(linha, incluirSegredo = false) {
  const assinatura = {
    id: linha.id,
    url: linha.url,
    eventos: linha.eventos,
    ativa: linha.ativa,
    criada_em: linha.criada_em.toISOString(),
  };
  if (incluirSegredo) assinatura.segredo = linha.segredo;
  return assinatura;
}

async function criarAssinatura({ url, eventos }) {
  const segredo = `whsec_${crypto.randomBytes(24).toString('hex')}`;
  const { rows } = await pool.query(
    `INSERT INTO assinaturas_webhook (id, url, eventos, segredo)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [crypto.randomUUID(), url, [...new Set(eventos)], segredo],
  );
  // O segredo só é exibido UMA vez, na criação (mesmo padrão de grandes gateways de pagamento)
  return formatarAssinatura(rows[0], true);
}

async function removerAssinatura(id) {
  const { rowCount } = await pool.query('DELETE FROM assinaturas_webhook WHERE id = $1', [id]);
  if (!rowCount) throw erros.naoEncontrado('Assinatura de webhook');
}

async function listarEntregas(assinaturaId) {
  const existe = await pool.query('SELECT 1 FROM assinaturas_webhook WHERE id = $1', [assinaturaId]);
  if (!existe.rowCount) throw erros.naoEncontrado('Assinatura de webhook');
  const { rows } = await pool.query(
    `SELECT id, evento_id, tipo_evento, status, tentativas, ultimo_status_http, criada_em, atualizada_em
       FROM entregas_webhook WHERE assinatura_id = $1 ORDER BY id DESC`,
    [assinaturaId],
  );
  return rows.map((e) => ({
    id: Number(e.id),
    evento_id: e.evento_id,
    tipo_evento: e.tipo_evento,
    status: e.status,
    tentativas: e.tentativas,
    ultimo_status_http: e.ultimo_status_http,
    criada_em: e.criada_em.toISOString(),
    atualizada_em: e.atualizada_em.toISOString(),
  }));
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Entrega um evento para UMA assinatura, com retentativas e backoff exponencial.
 * Considera sucesso qualquer resposta 2xx. Timeout, erro de rede ou status != 2xx => nova tentativa.
 */
async function entregar(entregaId, assinatura, corpo, evento) {
  for (let tentativa = 1; tentativa <= config.webhookMaxTentativas; tentativa += 1) {
    let statusHttp = null;
    try {
      const resposta = await fetch(assinatura.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'qa-lab-api-pagamentos-webhooks/1.0',
          'X-Evento-Id': evento.id,
          'X-Evento-Tipo': evento.tipo,
          'X-Tentativa': String(tentativa),
          'X-Assinatura': gerarAssinatura(assinatura.segredo, corpo),
        },
        body: corpo,
        signal: AbortSignal.timeout(config.webhookTimeoutMs),
      });
      statusHttp = resposta.status;
    } catch {
      statusHttp = null; // timeout ou falha de conexão
    }

    const entregue = statusHttp !== null && statusHttp >= 200 && statusHttp < 300;
    const ultimaTentativa = tentativa === config.webhookMaxTentativas;
    let status = 'PENDENTE';
    if (entregue) status = 'ENTREGUE';
    else if (ultimaTentativa) status = 'FALHOU';

    await pool
      .query(
        `UPDATE entregas_webhook
            SET tentativas = $1, ultimo_status_http = $2, status = $3, atualizada_em = now()
          WHERE id = $4`,
        [tentativa, statusHttp, status, entregaId],
      )
      .catch(() => {});

    if (entregue || ultimaTentativa) return;
    await esperar(config.webhookIntervaloBaseMs * 2 ** (tentativa - 1));
  }
}

/**
 * Publica um evento para todas as assinaturas ativas interessadas nele.
 * É chamado DEPOIS do COMMIT da operação, para nunca notificar algo que foi desfeito.
 * A entrega é assíncrona: a resposta da API não espera os parceiros.
 */
async function publicarEvento(tipo, dados) {
  const evento = { id: crypto.randomUUID(), tipo, criado_em: new Date().toISOString(), dados };
  const corpo = JSON.stringify(evento);

  const { rows: assinaturas } = await pool.query(
    'SELECT * FROM assinaturas_webhook WHERE ativa = true AND $1 = ANY(eventos)',
    [tipo],
  );

  for (const assinatura of assinaturas) {
    const { rows } = await pool.query(
      `INSERT INTO entregas_webhook (assinatura_id, evento_id, tipo_evento, status, payload)
       VALUES ($1, $2, $3, 'PENDENTE', $4) RETURNING id`,
      [assinatura.id, evento.id, tipo, corpo],
    );
    entregar(rows[0].id, assinatura, corpo, evento).catch((erro) =>
      console.error('Falha inesperada ao entregar webhook:', erro.message),
    );
  }
}

function publicarSemBloquear(tipo, dados) {
  publicarEvento(tipo, dados).catch((erro) => console.error('Falha ao publicar evento:', erro.message));
}

module.exports = {
  EVENTOS_DISPONIVEIS,
  criarAssinatura,
  removerAssinatura,
  listarEntregas,
  publicarSemBloquear,
};
