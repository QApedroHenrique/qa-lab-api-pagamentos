# QA Lab — API de Pagamentos

API de pagamentos **fictícia** (sistema sob teste) + suíte de QA em volta dela. Tudo em português (código, docs, mensagens de commit).

## Stack
Node 20+ · Express 5 · PostgreSQL 16 (`pg`, SQL puro, sem ORM) · JWT HS256 · OpenAPI 3.1 · Jest 30 + axios + Ajv · Postman/Newman · GitHub Actions.

## Comandos
| Comando | Uso |
|---|---|
| `docker compose up -d db` | Sobe o Postgres (pré-requisito dos testes) |
| `npm test` | Suíte completa (`--runInBand`; o global-setup sobe a API e limpa o banco) |
| `npx jest -t "CT-TRF"` | Roda só um grupo de casos |
| `npm run docs:verificar` | Rastreabilidade testes × `docs/casos-de-teste.md` (quebra o CI se divergir) |
| `npm run test:newman` | Regressão Postman (API precisa estar rodando: `npm start`) |

## Onde fica cada coisa
- `src/rotas/` valida entrada e escolhe status HTTP · `src/servicos/` regra de negócio dentro de transação · `src/utils/` funções puras.
- `src/db/schema.sql` é o schema único (aplicado por `migrate.js`). `src/db/pool.js` tem o helper de transação.
- `openapi/openapi.yaml` é a **fonte única do contrato**: os testes validam as respostas contra ele (`toSeguirContrato`).
- `docs/regras-de-negocio.md` (RN-01..RN-14) → `docs/casos-de-teste.md` (CT-XXX-NN) → `tests/**/*.test.js`.

## Regras que não podem ser quebradas
- Dinheiro é **inteiro em centavos** (`BIGINT`). Nunca float.
- Saldo nunca negativo (aplicação + `CHECK` no banco). Toda alteração de saldo gera lançamento no livro-razão.
- Locks com `SELECT ... FOR UPDATE` **em ordem fixa por id** (evita deadlock A→B / B→A).
- Idempotência: chave gravada no início da transação; erros não ficam gravados.
- Webhook de saída só **depois do COMMIT** e assíncrono. HMAC sobre `timestamp.corpo_bruto`, comparação com `timingSafeEqual`.
- CPF completo **nunca** sai na API (só `documento_mascarado`), nem em erro nem em log.
- Erros sempre `{ erro: { codigo, mensagem, detalhes? } }`, sem stack trace.

## Convenções de teste
- Todo teste tem ID no nome: `test('[CT-TRF-05] ...')`. Prefixos: AUT, CON, EXT, TRF, IDE, EST, PIX, WHK, CTR, SEG, CNC, DAD.
- Teste novo ⇒ linha nova em `docs/casos-de-teste.md` (ID, cenário, RN, técnica ISTQB, prioridade 🔴🟡🟢).
- Testes são caixa-preta via HTTP; dados criados pelas fábricas de `tests/helpers/fabricas.js`; nada depende de outro teste.
- Oráculo independente: helpers de teste **não importam** código de `src/`.
- Espera por condição (receptor de webhook), nunca `sleep` fixo.

## Fluxo de trabalho com skills
Para qualquer mudança não trivial, usar em ordem: `/task` → `/plano` → `/questionar` → `/feature` → `/revisar`.
Os artefatos ficam em `.claude/tasks/<slug>/` (`task.md`, `plano.md`, `questoes.md`, `revisao.md`).
