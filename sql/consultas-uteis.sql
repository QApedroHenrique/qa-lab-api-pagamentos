-- Consultas de apoio para investigação manual (DBeaver, pgAdmin ou psql).
-- Troque os valores entre <> antes de executar.

-- 1) Saldo e extrato completo de uma conta
SELECT c.nome, c.saldo, l.tipo, l.origem, l.valor, l.referencia_id, l.criado_em
  FROM contas c
  JOIN lancamentos l ON l.conta_id = c.id
 WHERE c.id = '<id_da_conta>'
 ORDER BY l.id DESC;

-- 2) Transferências de uma conta (enviadas e recebidas) com o lado da operação
SELECT t.id,
       CASE WHEN t.conta_origem_id = '<id_da_conta>' THEN 'ENVIADA' ELSE 'RECEBIDA' END AS sentido,
       t.valor, t.status, t.criada_em, t.estornada_em
  FROM transferencias t
 WHERE '<id_da_conta>' IN (t.conta_origem_id, t.conta_destino_id)
 ORDER BY t.criada_em DESC;

-- 3) Chaves de idempotência usadas mais de uma vez? (não deveria existir: chave é PRIMARY KEY)
SELECT chave, COUNT(*) FROM chaves_idempotencia GROUP BY chave HAVING COUNT(*) > 1;

-- 4) Entregas de webhook que falharam, com a quantidade de tentativas
SELECT a.url, e.tipo_evento, e.status, e.tentativas, e.ultimo_status_http, e.atualizada_em
  FROM entregas_webhook e
  JOIN assinaturas_webhook a ON a.id = e.assinatura_id
 WHERE e.status = 'FALHOU'
 ORDER BY e.atualizada_em DESC;

-- 5) Ranking das contas com maior volume transferido (enviado)
SELECT c.nome, COUNT(t.id) AS quantidade, SUM(t.valor) AS total_centavos
  FROM transferencias t
  JOIN contas c ON c.id = t.conta_origem_id
 WHERE t.status = 'CONCLUIDA'
 GROUP BY c.nome
 ORDER BY total_centavos DESC
 LIMIT 10;
