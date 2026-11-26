-- REGRA: cada evento PIX recebido gera exatamente 1 lançamento de crédito, com o mesmo valor e na mesma conta.
-- RESULTADO ESPERADO: nenhuma linha.

SELECT e.evento_id,
       e.valor,
       COUNT(l.id) AS quantidade_de_lancamentos
  FROM eventos_pix_recebidos e
  LEFT JOIN lancamentos l
         ON l.referencia_id = e.evento_id
        AND l.origem = 'PIX_RECEBIDO'
        AND l.tipo = 'CREDITO'
        AND l.conta_id = e.conta_id
        AND l.valor = e.valor
 GROUP BY e.evento_id, e.valor
HAVING COUNT(l.id) <> 1;
