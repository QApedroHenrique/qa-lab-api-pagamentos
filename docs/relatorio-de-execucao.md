# Relatório de execução

Resumo da execução de referência da versão **1.1.0**. A cada push, o GitHub Actions gera os relatórios
HTML atualizados (artefato `relatorios-de-teste` e GitHub Pages).

## Resultado geral

| Suíte | Executado | Passou | Falhou | Tempo |
|---|---|---|---|---|
| Jest — 12 arquivos, 110 casos | 183 testes | **183** | 0 | — |
| Newman — regressão encadeada | 21 requisições · 114 asserções | **114** | 0 | < 1 s |
| Rastreabilidade (`docs:verificar`) | 110 casos | **110** | 0 | — |

**Ambiente:** Node.js 22 · PostgreSQL 16 · Linux.

### Distribuição por área

| Área | Arquivo | Testes |
|---|---|---:|
| Autenticação | `funcional/autenticacao.test.js` | 15 |
| Contas | `funcional/contas.test.js` | 22 |
| Extrato | `funcional/extrato.test.js` | 11 |
| Transferências | `funcional/transferencias.test.js` | 28 |
| Idempotência | `funcional/idempotencia.test.js` | 6 |
| Estornos | `funcional/estornos.test.js` | 7 |
| Webhook de entrada (PIX) | `funcional/webhook-pix.test.js` | 20 |
| Webhooks de saída | `funcional/webhooks-saida.test.js` | 17 |
| Contrato (OpenAPI) | `contrato/contratos.test.js` | 13 |
| Segurança | `seguranca/seguranca.test.js` | 32 |
| Concorrência | `concorrencia/concorrencia.test.js` | 5 |
| Consistência de dados (SQL) | `dados/consistencia.test.js` | 7 |
| **Total** | | **183** |

## Teste de mutação manual

Uma suíte que sempre passa pode estar testando pouco. Para medir se os testes **realmente pegam
defeitos**, foram inseridos 8 bugs de propósito no código (um de cada vez), a suíte foi rodada e o
código foi restaurado. **Os 8 defeitos foram detectados.**

| # | Defeito inserido | Casos que falharam (detectaram o bug) |
|---|---|---|
| M1 | Remover o `FOR UPDATE` (lock) das contas na transferência | CT-CNC-01, CT-CNC-04 |
| M2 | Remover a janela de 5 minutos da assinatura HMAC | CT-PIX-09, CT-PIX-11 |
| M3 | Ignorar a `Idempotency-Key` (toda requisição vira uma nova) | CT-IDE-01 a 04, CT-EST-07, CT-CNC-02 |
| M4 | Devolver o CPF completo na resposta da conta | CT-CON-01, CT-CON-09, CT-SEG-02 |
| M5 | Remover a deduplicação de eventos PIX | CT-PIX-02, CT-CNC-05, CT-DAD-03, 05, 07 |
| M6 | Disparar webhook também na repetição idempotente | CT-WHK-06 |
| M7 | Erro de limite: `>=` no lugar de `>` no valor máximo | CT-TRF-10 |
| M8 | Permitir estornar uma transferência já estornada | CT-EST-03, CT-CNC-03 |

**O que isso mostra:**

- **M1** só é pego pelos testes de **concorrência**. Testes sequenciais passariam com esse bug,
  que em produção significaria gasto duplo.
- **M4** é pego pelo **teste de contrato** (`additionalProperties: false`), não só pelo teste de LGPD:
  o contrato barra qualquer campo que não deveria estar na resposta.
- **M5** é pego também pelas **validações SQL**: a conservação do dinheiro (CT-DAD-03) quebra
  quando um PIX é creditado duas vezes.
- **M7** é um erro de valor-limite clássico, e só a **análise de valor-limite** (CT-TRF-10, valor = 1.000.000) pega.

## Riscos residuais e limitações

| Item | Situação |
|---|---|
| Desempenho em volume | Não coberto. Há só o limite de tempo de resposta de 1 s por requisição no Postman. |
| Queda do banco no meio de uma transação | Não coberto. Depende do `ROLLBACK` do PostgreSQL. |
| Webhooks pendentes se a API reiniciar | Entregas em andamento são perdidas: a fila fica em memória. Numa versão real, seria preciso uma fila persistente (ex.: tabela de *outbox* + *worker*). |
| Rate limit / proteção contra força bruta no `/auth/token` | Não implementado: fica fora do escopo de uma API local de laboratório. |
| Rotação de segredos de webhook | Não implementada. |
| Dependências | As dependências de **produção** não têm vulnerabilidades conhecidas (`npm audit --omit=dev` → 0). O `npm audit` completo aponta alertas em pacotes internos das ferramentas de **desenvolvimento** (Newman, Jest), que não vão para a imagem da API. O Dependabot está configurado para propor atualizações semanalmente. |

## Como reproduzir

```bash
docker compose up -d db
npm install
npm run test:ci                    # Jest + resultado.json
npm start &                        # API para o Newman
npm run test:newman                # Newman
npm run relatorios                 # página reports/index.html
```
