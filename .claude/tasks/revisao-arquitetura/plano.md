# Plano — Endurecimento a partir da revisão externa da arquitetura

## Arquivos
| Arquivo | Mudança |
|---|---|
| `src/config.js` | `validarConfiguracao()` + `webhookHostsPermitidos` |
| `src/server.js` | chama `validarConfiguracao()` antes de migrar |
| `src/utils/destino-webhook.js` | novo: `destinoPermitido(url)` (função pura) |
| `src/rotas/webhooks.js` | recusa destino interno no cadastro |
| `src/db/pool.js` | ROLLBACK protegido + `release(erro)` |
| `src/db/migrate.js` | trava do `limparBanco()` |
| `src/db/schema.sql` | 3 índices em FKs |
| `docker-compose.yml`, `.env.example` | `NODE_ENV` da demo e nova variável |
| `tests/setup/global-setup.js` | libera `127.0.0.1` na allowlist |
| `tests/helpers/esperar.js` | novo: `aguardarAte(condicao)` |
| `tests/funcional/webhooks-saida.test.js` | CT-WHK-07/08 com polling |
| `tests/seguranca/seguranca.test.js` | CT-SEG-11, 12, 13 |
| `openapi/openapi.yaml`, `docs/*`, `README.md`, `CHANGELOG.md` | RN-15/16, CTs, limitações, diagramas |

## Passos
1. Schema (índices) → pool → migrate.
2. Config + server (RN-15).
3. Util + rota (RN-16).
4. Testes e helper de espera.
5. OpenAPI, regras, casos, arquitetura (ER simplificado, fluxo de estorno, limitações), referência, README, CHANGELOG.

## Casos de teste
| ID | Cenário | RN | Técnica | Prioridade | Arquivo |
|---|---|---|---|---|---|
| CT-SEG-11 | `NODE_ENV=production` sem segredos → não inicia (exit 1) | RN-15 | SEG, PE | 🔴 | seguranca.test.js |
| CT-SEG-12 | `NODE_ENV=production` com segredos próprios → inicia | RN-15 | SEG, PE | 🟡 | seguranca.test.js |
| CT-SEG-13 | URL de webhook local/interna → 400 (SSRF) | RN-16 | SEG, PE | 🔴 | seguranca.test.js |

## Riscos de pagamento
- centavos / saldo negativo / locks / idempotência: **não afeta** (nenhuma regra de saldo muda).
- atomicidade: **afeta** `emTransacao` — o comportamento de COMMIT/ROLLBACK é o mesmo; só muda o tratamento quando o ROLLBACK falha.
- webhook antes do COMMIT: **não afeta** (outbox fica documentado como limitação).
- LGPD: **não afeta**; a mensagem de segredo ausente cita só nomes de variáveis.
- contrato OpenAPI: **afeta** a descrição do campo `url` (sem mudança de schema).

## Como validar
`npm run docs:verificar` · `npx jest -t "CT-SEG|CT-WHK"` · `npm test` (no CI: GitHub Actions com Postgres).
