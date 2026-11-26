-- REGRA: o saldo de cada conta deve ser igual à soma dos créditos menos a soma dos débitos do livro-razão.
-- RESULTADO ESPERADO: nenhuma linha (cada linha retornada é uma conta com divergência).

SELECT c.id,
       c.saldo                                                              AS saldo_na_conta,
       COALESCE(SUM(CASE WHEN l.tipo = 'CREDITO' THEN l.valor ELSE -l.valor END), 0) AS saldo_pelos_lancamentos
  FROM contas c
  LEFT JOIN lancamentos l ON l.conta_id = c.id
 GROUP BY c.id, c.saldo
HAVING c.saldo <> COALESCE(SUM(CASE WHEN l.tipo = 'CREDITO' THEN l.valor ELSE -l.valor END), 0);
