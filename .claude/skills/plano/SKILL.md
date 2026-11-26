---
name: plano
description: Gera o plano de ação (plano.md) a partir do task.md de uma tarefa da API de pagamentos. Segundo passo do fluxo.
argument-hint: <slug da task>
disable-model-invocation: true
---

# /plano — plano de ação

Task: `.claude/tasks/$ARGUMENTS/task.md` (se não houver argumento, use a pasta mais recente em `.claude/tasks/`).

Objetivo: gerar `.claude/tasks/<slug>/plano.md`. **Não altere código nesta etapa.**

## Passos
1. Leia o `task.md`. Leia **apenas** os arquivos que serão tocados (rota, serviço, schema, testes e docs da área).
2. Planeje na ordem em que a mudança deve ser feita, seguindo a separação do projeto:
   schema → serviço (regra + transação) → rota (validação + status) → openapi → testes → docs.
3. Para cada critério de aceite, defina o caso de teste: próximo ID livre do prefixo certo
   (veja `docs/casos-de-teste.md`), técnica ISTQB e prioridade.

## Formato do plano.md
```markdown
# Plano — <título>

## Arquivos
| Arquivo | Mudança |
|---|---|

## Passos
1. ... (cada passo pequeno e verificável)

## Casos de teste
| ID | Cenário | RN | Técnica | Prioridade | Arquivo |
|---|---|---|---|---|---|

## Riscos de pagamento
Para cada item, "afeta" ou "não afeta" + como será tratado:
centavos/arredondamento · saldo negativo · atomicidade/rollback · locks e ordem (deadlock) ·
idempotência · webhook antes do COMMIT · LGPD (CPF) · contrato OpenAPI.

## Como validar
Comandos exatos (`npx jest -t "CT-XXX"`, `npm test`, `npm run docs:verificar`).
```

Termine sugerindo `/questionar <slug>`.
