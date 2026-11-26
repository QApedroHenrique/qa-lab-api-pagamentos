# Plano de teste

| | |
|---|---|
| **Projeto** | QA Lab — API de Pagamentos (fictícia) |
| **Versão do sistema** | 1.0.0 |
| **Responsável** | Pedro Henrique Barbosa dos Santos (QA) |
| **Referências** | [Regras de negócio](regras-de-negocio.md) · [Casos de teste](casos-de-teste.md) · [OpenAPI](../openapi/openapi.yaml) |
| **Base** | Estrutura inspirada no ISTQB CTFL 4.0 e na ISO/IEC/IEEE 29119-3 |

---

## 1. Objetivo

Garantir que a API de pagamentos movimenta dinheiro **corretamente, uma única vez e com segurança**,
inclusive sob falhas de rede, reenvios de parceiros e requisições simultâneas — e que tudo o que
a API responde corresponde ao que está gravado no banco.

## 2. Escopo

### 2.1 Dentro do escopo

| Módulo | Endpoints |
|---|---|
| Autenticação | `POST /auth/token` e o controle de acesso das rotas protegidas |
| Contas | `POST /contas`, `GET /contas/{id}` |
| Extrato | `GET /contas/{id}/extrato` |
| Transferências | `POST /transferencias`, `GET /transferencias/{id}` |
| Estornos | `POST /transferencias/{id}/estorno` |
| Webhook de entrada | `POST /webhooks/pix` |
| Webhooks de saída | `POST/DELETE /webhooks/assinaturas`, `GET .../entregas` e a entrega dos eventos |
| Documentação | `GET /openapi.json`, `GET /docs`, `GET /saude` |

### 2.2 Fora do escopo

- **Interface gráfica** — a API não tem front-end (coberto em outro projeto do portfólio).
- **Testes de carga e desempenho** em volume (há apenas um limite de tempo de resposta < 1 s no Postman).
- **Infraestrutura de produção** (TLS, rate limit, WAF, backups) — o projeto roda só localmente e no CI.
- **Integração real com o PIX / Banco Central** — o provedor é simulado pela própria suíte.
- **Testes de recuperação de desastre** (queda do banco no meio de uma transação).

## 3. Abordagem

### 3.1 Níveis e tipos de teste

| Nível / Tipo | Como é feito | Ferramenta |
|---|---|---|
| **Teste de sistema (API, caixa-preta)** | Requisições HTTP reais contra a API rodando | Jest + axios |
| **Teste de contrato** | Toda resposta é validada contra os schemas do `openapi.yaml` (fonte única) | Ajv (JSON Schema 2020-12) |
| **Teste de integração (webhooks)** | Um servidor falso faz o papel do parceiro (recebe, falha, responde 500...) | Node `http` |
| **Teste de segurança** | Autenticação, HMAC, LGPD, injeção, cabeçalhos | Jest |
| **Teste de concorrência** | Requisições disparadas ao mesmo tempo (`Promise.all`) | Jest |
| **Validação de dados** | Consultas SQL de integridade após os cenários | PostgreSQL + `pg` |
| **Regressão ponta a ponta** | Fluxo encadeado (token → conta → PIX → transferência → estorno → extrato) | Postman + Newman |
| **Rastreabilidade** | Script garante que testes e documentação estão sincronizados | Node |

### 3.2 Técnicas de projeto de teste

- **Particionamento de equivalência** — classes válidas e inválidas para CPF, valor, tipos de dado, URLs.
- **Análise de valor-limite** — nome (2/3/100/101), valor (0/1/1.000.000/1.000.001), descrição (140/141),
  `limite` do extrato (0/1/100/101), `Idempotency-Key` (100/101), janela da assinatura (240 s/301 s).
- **Tabela de decisão** — regras combinadas de transferência e estorno (ver [casos de teste](casos-de-teste.md)).
- **Transição de estado** — ciclo de vida da transferência (`CONCLUIDA → ESTORNADA`) e da entrega de
  webhook (`PENDENTE → ENTREGUE | FALHOU`).
- **Suposição de erro** — erros comuns em sistemas financeiros: cobrança em dobro, reenvio de webhook,
  maiúsculas/minúsculas em IDs, ordem de campos no JSON, `alg: none` em JWT, valores em reais no lugar de centavos.

### 3.3 Priorização por risco

| Risco de produto | Impacto | Probabilidade | Mitigação nos testes |
|---|---|---|---|
| Cobrança em dobro (retry do cliente) | Alto | Alta | CT-IDE-*, CT-CNC-02, CT-WHK-06 |
| Gasto duplo / saldo negativo sob concorrência | Alto | Média | CT-CNC-01, CT-DAD-02 |
| Crédito duplicado por reenvio do provedor PIX | Alto | Alta | CT-PIX-02, CT-CNC-05, CT-DAD-05 |
| Webhook falso creditando dinheiro | Alto | Média | CT-PIX-06 a 13 |
| Divergência entre saldo e lançamentos | Alto | Baixa | CT-DAD-01, 03, 04 |
| Vazamento de CPF (LGPD) | Alto | Média | CT-SEG-02, CT-SEG-03 |
| Acesso sem autenticação | Alto | Baixa | CT-AUT-*, CT-SEG-01 |
| Parceiro fora do ar travando transferências | Médio | Média | CT-WHK-07 a 09 |
| Documentação desatualizada em relação à API | Médio | Alta | CT-CTR-*, `docs:verificar` |

Casos 🔴 de alta prioridade cobrem os riscos de impacto alto e são os primeiros a serem analisados quando falham.

## 4. Ambiente de teste

| Item | Configuração |
|---|---|
| Runtime | Node.js 22 (mínimo 20) |
| Banco | PostgreSQL 16 (Docker local ou *service container* no GitHub Actions) |
| Dados | 100% fictícios, gerados durante a execução (CPFs válidos pelo algoritmo, mas inventados) |
| Isolamento | Cada teste cria as próprias contas; o banco é limpo no início da suíte |
| Execução | Local (`npm test`) e automática a cada push/PR (GitHub Actions) |

## 5. Critérios

**Entrada** (para iniciar a execução):
- API sobe e `GET /saude` responde 200;
- banco acessível e schema aplicado;
- `npm run docs:verificar` sem pendências.

**Saída** (para considerar a versão aprovada):
- 100% dos casos 🔴 passando;
- nenhuma falha nas validações SQL de consistência;
- regressão Postman sem asserções falhando;
- relatórios publicados como artefato do CI.

**Suspensão:** a execução é interrompida se a API ou o banco ficarem indisponíveis, ou se o setup
falhar. Os testes são retomados depois da correção do ambiente.

## 6. Entregáveis

| Entregável | Onde |
|---|---|
| Plano de teste | este documento |
| Regras de negócio (base de teste) | [regras-de-negocio.md](regras-de-negocio.md) |
| Casos de teste e matriz de rastreabilidade | [casos-de-teste.md](casos-de-teste.md) |
| Scripts automatizados | [`tests/`](../tests) e [`postman/`](../postman) |
| Consultas SQL de validação | [`sql/`](../sql) |
| Relatórios HTML (Jest e Newman) | `reports/` (gerados a cada execução e publicados no CI) |
| Relatório de execução | [relatorio-de-execucao.md](relatorio-de-execucao.md) |

## 7. Riscos de projeto

| Risco | Mitigação |
|---|---|
| Testes de webhook/concorrência instáveis (*flaky*) por dependerem de tempo | Esperas por condição (`aguardar`) em vez de `sleep` fixo; intervalos de retry menores no ambiente de teste; execução em série (`--runInBand`) |
| Testes dependentes entre si | Cada teste cria seus próprios dados; nenhum teste depende da ordem de execução |
| Falso positivo (teste que passa sem testar nada) | Teste de mutação manual: defeitos foram inseridos de propósito para confirmar que os testes falham ([relatório](relatorio-de-execucao.md#teste-de-mutação-manual)) |
