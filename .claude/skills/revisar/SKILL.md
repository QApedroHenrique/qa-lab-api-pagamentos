---
name: revisar
description: Revisa a implementação de uma tarefa da API de pagamentos contra o task.md, o plano e as regras críticas de pagamento. Último passo do fluxo.
argument-hint: <slug da task>
disable-model-invocation: true
---

# /revisar — revisão final

Revise o que foi implementado para `.claude/tasks/$ARGUMENTS/` (sem argumento: pasta mais recente).
Base da revisão: `git diff` (ou os arquivos listados no `plano.md`, se não houver git), `task.md` e `plano.md`.

Papel: revisor exigente. Só aponte problemas reais, com arquivo:linha e um cenário concreto que quebra.
Não corrija nada sem o usuário pedir.

## Checklist
1. **Critérios de aceite:** cada um tem implementação **e** teste que falharia sem ela?
2. **Pagamentos:** centavos inteiros · saldo nunca negativo · débito e crédito na mesma transação ·
   `FOR UPDATE` em ordem por id · idempotência preservada · lançamento no livro-razão para toda mudança de saldo ·
   webhook só depois do COMMIT.
3. **Segurança:** rota protegida, sem CPF/segredo em resposta, erro ou log; HMAC com `timingSafeEqual`; SQL parametrizado.
4. **Contrato:** `openapi.yaml` bate com a resposta real; formato de erro `{ erro: { codigo, mensagem } }`.
5. **Testes:** IDs `[CT-XXX-NN]` sem repetir; caixa-preta; sem `sleep` fixo; sem dependência entre testes.
6. **Rastreabilidade:** RN e CTs documentados; `npm run docs:verificar` passa; CHANGELOG atualizado se a API mudou.
7. **Escopo:** nada além do pedido; nenhum código morto ou `console.log` esquecido.

## Saída
Grave `.claude/tasks/<slug>/revisao.md` e mostre:
```markdown
**Veredito:** aprovado | aprovado com ressalvas | reprovado

| Severidade | Arquivo:linha | Problema | Cenário que quebra | Correção sugerida |
```
Se rodou os testes, informe o resultado real. Se não rodou, diga que não rodou.
