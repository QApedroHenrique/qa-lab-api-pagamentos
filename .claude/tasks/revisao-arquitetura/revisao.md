# Revisão — revisao-arquitetura

**Veredito:** aprovado com ressalvas

## Checklist
1. **Critérios de aceite:** RN-15 → CT-SEG-11/12; RN-16 → CT-SEG-13 (10 entradas) e CT-WHK-01 a 12 com o host liberado; CT-WHK-07/08 sem espera fixa.
2. **Pagamentos:** nenhuma regra de saldo mudou. `emTransacao` mantém BEGIN/COMMIT/ROLLBACK; só o caminho de falha do ROLLBACK mudou.
3. **Segurança:** a mensagem de segredo ausente cita apenas nomes (CT-SEG-11 verifica que o valor não aparece). O SSRF olha o hostname já normalizado pelo parser `URL`, inclusive IPv4 mapeado em hex.
4. **Contrato:** sem mudança de schema; descrição do campo `url` atualizada; versão 1.1.0.
5. **Testes:** IDs novos sem repetição; CT-SEG-11/12 sobem a API como processo separado (caixa-preta, sem importar `src/`).
6. **Rastreabilidade:** 110 casos em `casos-de-teste.md` e na matriz (RN-15, RN-16); CHANGELOG 1.1.0.
7. **Escopo:** itens de arquitetura (outbox, BOLA, TTL, migrações, rate limit, cursor, logs, DNS) só documentados.

## Ressalvas
| Severidade | Arquivo | Ponto |
|---|---|---|
| 🟡 | `src/utils/destino-webhook.js` | Sem resolução de DNS: domínio que resolve para IP interno passa (limitação nº 3 em arquitetura.md). |
| 🟢 | `tests/seguranca/seguranca.test.js` | CT-SEG-12 depende do Postgres porque o start aplica o schema (aceito, a suíte já exige banco). |

## Execução
A máquina local não tem Node/Postgres; a validação foi feita no GitHub Actions (run 45893354568): `docs:verificar` ok, Jest **183/183**, Newman ok.
