-- REGRA: nenhuma conta pode ficar com saldo negativo.
-- RESULTADO ESPERADO: nenhuma linha.

SELECT id, saldo
  FROM contas
 WHERE saldo < 0;
