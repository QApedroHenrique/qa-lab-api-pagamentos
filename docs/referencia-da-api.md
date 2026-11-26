# Referência da API

> A especificação completa e navegável fica em **`http://localhost:3000/docs`** (Swagger UI),
> gerada a partir de [`openapi/openapi.yaml`](../openapi/openapi.yaml).
> Este documento é um resumo rápido para consulta.

**URL base local:** `http://localhost:3000` · **Formato:** JSON UTF-8 · **Valores:** centavos inteiros

## Endpoints

| Método | Rota | Autenticação | Descrição | Sucesso |
|---|---|---|---|---|
| `GET` | `/saude` | — | API e banco no ar | 200 |
| `POST` | `/auth/token` | — | Gera token de acesso | 200 |
| `POST` | `/contas` | Bearer | Cria conta | 201 |
| `GET` | `/contas/{id}` | Bearer | Consulta conta e saldo | 200 |
| `GET` | `/contas/{id}/extrato?limite=N` | Bearer | Lançamentos (mais recentes primeiro) | 200 |
| `POST` | `/transferencias` | Bearer + `Idempotency-Key` | Transfere entre contas | 201 |
| `GET` | `/transferencias/{id}` | Bearer | Consulta transferência | 200 |
| `POST` | `/transferencias/{id}/estorno` | Bearer | Estorna transferência | 200 |
| `POST` | `/webhooks/pix` | Assinatura HMAC | Recebe PIX do provedor | 200 |
| `POST` | `/webhooks/assinaturas` | Bearer | Cadastra URL de parceiro | 201 |
| `DELETE` | `/webhooks/assinaturas/{id}` | Bearer | Remove assinatura | 204 |
| `GET` | `/webhooks/assinaturas/{id}/entregas` | Bearer | Histórico de entregas | 200 |
| `GET` | `/docs` · `/openapi.json` | — | Documentação | 200 |

## Catálogo de erros

| HTTP | Código | Quando acontece |
|---|---|---|
| 400 | `DADOS_INVALIDOS` | Campo, parâmetro ou header inválido (detalhes em `erro.detalhes`) |
| 400 | `JSON_INVALIDO` | Corpo não é um JSON válido |
| 400 | `ID_INVALIDO` | ID da rota fora do formato UUID |
| 401 | `NAO_AUTENTICADO` | Token ausente, inválido ou expirado |
| 401 | `CREDENCIAIS_INVALIDAS` | `client_id` ou `client_secret` errados |
| 401 | `ASSINATURA_INVALIDA` | Webhook sem assinatura, com assinatura errada ou expirada |
| 404 | `NAO_ENCONTRADO` | Conta, transferência ou assinatura inexistente |
| 404 | `ROTA_NAO_ENCONTRADA` | Rota que não existe |
| 409 | `DOCUMENTO_JA_CADASTRADO` | CPF já tem conta |
| 409 | `TRANSFERENCIA_JA_ESTORNADA` | Estorno repetido |
| 413 | `CORPO_MUITO_GRANDE` | Corpo acima de 100 KB |
| 422 | `SALDO_INSUFICIENTE` | Origem sem saldo para a transferência |
| 422 | `SALDO_INSUFICIENTE_PARA_ESTORNO` | Destino sem saldo para devolver |
| 422 | `CONTAS_IGUAIS` | Origem igual ao destino |
| 422 | `CHAVE_IDEMPOTENCIA_REUTILIZADA` | Mesma `Idempotency-Key` com corpo diferente |
| 500 | `ERRO_INTERNO` | Erro inesperado (sem detalhes internos; informe o `X-Request-Id`) |

Exemplo:

```json
{
  "erro": {
    "codigo": "DADOS_INVALIDOS",
    "mensagem": "Um ou mais campos são inválidos.",
    "detalhes": [
      { "campo": "nome", "mensagem": "Deve ter entre 3 e 100 caracteres." },
      { "campo": "documento", "mensagem": "Deve ser um CPF válido com 11 dígitos, sem pontuação." }
    ]
  }
}
```

**Por que 400 × 422?** `400` é para requisição mal formada (tipo errado, campo faltando, formato inválido).
`422` é para requisição bem formada que viola uma regra de negócio (ex.: saldo insuficiente).

## Headers importantes

| Header | Direção | Uso |
|---|---|---|
| `Authorization: Bearer <token>` | requisição | Autenticação |
| `Idempotency-Key` | requisição | Obrigatório em `POST /transferencias` |
| `Idempotency-Replayed: true` | resposta | A resposta é a repetição de uma requisição anterior |
| `X-Assinatura: t=<ts>,v1=<hmac>` | ambos | Assinatura dos webhooks (entrada e saída) |
| `X-Request-Id` | ambos | Rastreio da requisição (gerado ou reaproveitado) |
| `Location` | resposta | URL do recurso criado (201) |
| `X-Evento-Id`, `X-Evento-Tipo`, `X-Tentativa` | webhook de saída | Identificação e número da tentativa |

## Passo a passo com `curl`

```bash
# 1) Token
TOKEN=$(curl -s -X POST http://localhost:3000/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"client_id":"qa-lab","client_secret":"segredo-local-123"}' | jq -r .access_token)

# 2) Conta (use um CPF fictício válido)
curl -s -X POST http://localhost:3000/contas \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"nome":"Maria Ficticia","documento":"52998224725"}'

# 3) PIX recebido — simula o provedor, assinando o corpo com HMAC-SHA256
CORPO='{"evento_id":"pix-001","tipo":"pix.recebido","conta_id":"<ID_DA_CONTA>","valor":50000}'
T=$(date +%s)
HMAC=$(printf '%s' "$T.$CORPO" | openssl dgst -sha256 -hmac 'pix-segredo-local' | sed 's/^.* //')
curl -s -X POST http://localhost:3000/webhooks/pix \
  -H 'Content-Type: application/json' -H "X-Assinatura: t=$T,v1=$HMAC" -d "$CORPO"

# 4) Transferência idempotente (rode duas vezes com a mesma chave e compare)
curl -s -i -X POST http://localhost:3000/transferencias \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: minha-chave-001' \
  -d '{"conta_origem_id":"<ORIGEM>","conta_destino_id":"<DESTINO>","valor":12000}'
```

## Payload dos webhooks de saída

```json
{
  "id": "1b2c3d4e-0000-4000-8000-000000000000",
  "tipo": "transferencia.concluida",
  "criado_em": "2026-11-26T15:00:00.000Z",
  "dados": {
    "transferencia": {
      "id": "…", "conta_origem_id": "…", "conta_destino_id": "…",
      "valor": 12000, "descricao": null, "status": "CONCLUIDA",
      "criada_em": "…", "estornada_em": null
    }
  }
}
```

Para validar: recalcule `HMAC-SHA256(segredo, "<t>.<corpo bruto>")` e compare com o `v1` do header `X-Assinatura`.
