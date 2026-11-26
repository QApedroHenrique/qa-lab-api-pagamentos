---
name: questionar
description: Questiona o task.md e o plano.md antes de implementar, apontando o que não foi validado e pode virar bug ou problema de uso na API de pagamentos. Terceiro passo do fluxo.
argument-hint: <slug da task>
disable-model-invocation: true
---

# /questionar — o que ainda não foi validado

Leia `.claude/tasks/$ARGUMENTS/task.md` e `plano.md` (sem argumento: pasta mais recente em `.claude/tasks/`).

Papel: QA cético. **Não concorde por padrão.** O objetivo é achar furos antes do código existir.
Não altere código nem reescreva o plano sozinho.

## O que procurar
Só levante pontos **concretos para esta tarefa** (nada de lista genérica). Verifique no código quando der.
- **Dinheiro:** valor 0, 1, limite exato, limite + 1 centavo, soma que estoura, float escondido.
- **Concorrência:** duas requisições ao mesmo tempo quebram a regra? Precisa de lock? A ordem dos locks continua por id?
- **Idempotência:** o reenvio (timeout, clique duplo) gera efeito duplo? A resposta gravada continua correta?
- **Estado:** transições inválidas (ex.: estornar algo ESTORNADO), o que acontece com o que já existe no banco.
- **Integrações:** webhook de entrada/saída, assinatura, replay, parceiro fora do ar, evento novo que precisa ser assinado.
- **Segurança/LGPD:** rota sem auth, dado sensível em resposta, erro ou log, acesso a recurso de outro.
- **Contrato:** cliente existente quebra? Campo novo obrigatório? `openapi.yaml` e Postman precisam mudar?
- **Testes:** critério de aceite sem teste, teste que passaria mesmo com o bug (pense: "que mutação este teste não pega?").
- **Contradições** entre task, plano, RNs existentes e código atual.

## Saída
Grave `.claude/tasks/<slug>/questoes.md` e mostre ao usuário:
```markdown
| # | Ponto | Impacto (bug / uso / segurança) | Severidade 🔴🟡🟢 | Sugestão |
```
Depois, **pergunte ao usuário** como resolver os 🔴 antes de seguir. Com as respostas, atualize `task.md`/`plano.md`
e sugira `/feature <slug>`. Se não houver nada relevante, diga isso em uma linha. Não invente pontos para encher a lista.
