---
name: task
description: Transforma um pedido solto em uma especificação fechada (task.md) para a API de pagamentos. Primeiro passo do fluxo task → plano → questionar → feature → revisar.
argument-hint: <descrição do que você quer>
disable-model-invocation: true
---

# /task — especificar a tarefa

Pedido do usuário: **$ARGUMENTS**

Objetivo: gerar `.claude/tasks/<slug>/task.md`, curto e sem ambiguidade. **Não escreva código nesta etapa.**

## Passos
1. Escolha um `<slug>` curto em kebab-case (ex.: `limite-diario-transferencia`).
2. Leia só o necessário: `docs/regras-de-negocio.md` e as RNs afetadas, a parte relevante de `openapi/openapi.yaml`, os arquivos de `src/` e `tests/` da área.
3. Se faltar informação que **muda o resultado** (valor de limite, código de erro, status HTTP), pergunte ao usuário antes de escrever. Se for detalhe com padrão óbvio no projeto, siga o padrão e registre como suposição.
4. Escreva o arquivo no formato abaixo.

## Formato do task.md
```markdown
# <título>

## Objetivo
1–3 frases: o que muda e por quê.

## Regras de negócio
- RN afetadas (existentes) e RN nova, se houver (próximo número livre, ex.: RN-15).
- Cada regra com valores exatos: limites em centavos, status HTTP, código de erro.

## Contrato
Endpoints, campos, headers e respostas que mudam (vai para o openapi.yaml).

## Dados
Mudanças em `src/db/schema.sql` (tabela, coluna, constraint, índice). "Nenhuma" se não houver.

## Critérios de aceite
- [ ] Dado / quando / então, verificáveis por teste. Inclua os casos de erro e valor-limite.

## Fora de escopo
O que explicitamente não será feito.

## Suposições
O que foi decidido sem confirmação do usuário.
```

Termine dizendo o caminho do arquivo e sugerindo `/plano <slug>`.
