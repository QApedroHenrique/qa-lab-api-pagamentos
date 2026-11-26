-- REGRA: transferências e estornos só MOVEM dinheiro entre contas, nunca criam nem destroem.
-- Portanto, a soma de todos os saldos deve ser igual à soma de todos os PIX recebidos.
-- RESULTADO ESPERADO: uma linha com diferenca = 0.

SELECT (SELECT COALESCE(SUM(saldo), 0) FROM contas)                AS soma_dos_saldos,
       (SELECT COALESCE(SUM(valor), 0) FROM eventos_pix_recebidos) AS soma_dos_pix_recebidos,
       (SELECT COALESCE(SUM(saldo), 0) FROM contas)
     - (SELECT COALESCE(SUM(valor), 0) FROM eventos_pix_recebidos) AS diferenca;
