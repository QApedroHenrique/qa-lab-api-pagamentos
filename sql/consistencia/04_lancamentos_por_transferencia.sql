-- REGRA: toda transferência CONCLUIDA tem exatamente 2 lançamentos (1 débito na origem e 1 crédito no destino)
-- e toda transferência ESTORNADA tem exatamente 4 (os 2 originais + 2 do estorno, no sentido inverso),
-- sempre com o mesmo valor da transferência.
-- RESULTADO ESPERADO: nenhuma linha.

WITH resumo AS (
  SELECT t.id,
         t.status,
         t.valor,
         COUNT(l.id) FILTER (WHERE l.origem = 'TRANSFERENCIA' AND l.tipo = 'DEBITO'  AND l.conta_id = t.conta_origem_id)  AS debito_origem,
         COUNT(l.id) FILTER (WHERE l.origem = 'TRANSFERENCIA' AND l.tipo = 'CREDITO' AND l.conta_id = t.conta_destino_id) AS credito_destino,
         COUNT(l.id) FILTER (WHERE l.origem = 'ESTORNO'       AND l.tipo = 'DEBITO'  AND l.conta_id = t.conta_destino_id) AS estorno_debito_destino,
         COUNT(l.id) FILTER (WHERE l.origem = 'ESTORNO'       AND l.tipo = 'CREDITO' AND l.conta_id = t.conta_origem_id)  AS estorno_credito_origem,
         COUNT(l.id)                                                                                                        AS total,
         BOOL_AND(l.valor = t.valor)                                                                                        AS valores_iguais
    FROM transferencias t
    LEFT JOIN lancamentos l ON l.referencia_id = t.id::text
   GROUP BY t.id, t.status, t.valor
)
SELECT *
  FROM resumo
 WHERE NOT (
         (status = 'CONCLUIDA' AND total = 2 AND debito_origem = 1 AND credito_destino = 1)
      OR (status = 'ESTORNADA' AND total = 4 AND debito_origem = 1 AND credito_destino = 1
                                AND estorno_debito_destino = 1 AND estorno_credito_origem = 1)
       )
    OR valores_iguais IS NOT TRUE;
