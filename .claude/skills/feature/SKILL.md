---
name: feature
description: Implementa uma tarefa da API de pagamentos seguindo o plano.md aprovado, com testes, contrato e documentação. Quarto passo do fluxo.
argument-hint: <slug da task>
disable-model-invocation: true
---

# /feature — implementação

Siga `.claude/tasks/$ARGUMENTS/plano.md` (com `task.md` e `questoes.md` como referência).
Sem argumento: pasta mais recente em `.claude/tasks/`. Se não existir plano, pare e sugira `/task` e `/plano`.

## Regras
- Siga o plano. Se precisar desviar, diga o motivo e atualize o `plano.md`. Não faça nada fora do escopo.
- Respeite as "Regras que não podem ser quebradas" do `CLAUDE.md` (centavos, locks por id, webhook após COMMIT, CPF etc.).
- Siga o estilo do código vizinho: CommonJS, nomes em português, erros via `src/utils/erros.js`, transação via `src/db/pool.js`.

## Ordem
1. Schema (`src/db/schema.sql`) → serviço → rota.
2. `openapi/openapi.yaml`: endpoints, schemas e códigos de erro novos.
3. Testes com o ID no nome (`[CT-XXX-NN]`), usando as fábricas e helpers existentes. Helpers não importam `src/`.
   Inclua valor-limite, erro e, se o plano apontou risco, concorrência e SQL de consistência.
4. Docs: `docs/regras-de-negocio.md` (RN), `docs/casos-de-teste.md` (linhas dos CTs, resumo de contagens),
   `docs/referencia-da-api.md` e `CHANGELOG.md` quando a API mudar. Postman, se o fluxo encadeado for afetado.

## Validação (obrigatória)
1. `npx jest -t "<prefixos dos CTs novos>"` até passar.
2. `npm test` completo. `npm run docs:verificar`.
3. Se o Postgres não estiver rodando, avise o usuário (`docker compose up -d db`) em vez de pular os testes.

Ao final, informe: arquivos alterados, CTs criados, resultado real dos comandos (cole a falha, se houver).
Sugira `/revisar <slug>`. Não faça commit sem o usuário pedir.
