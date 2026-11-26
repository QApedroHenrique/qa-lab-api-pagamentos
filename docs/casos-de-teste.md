# Casos de teste

Catálogo de todos os casos de teste automatizados, com a **regra de negócio** que cada um cobre
([regras-de-negocio.md](regras-de-negocio.md)), a **técnica de teste** usada e a **prioridade**.

O ID de cada caso aparece no nome do teste (ex.: `[CT-TRF-05] saldo insuficiente retorna 422...`),
então dá para ir do documento ao código e do relatório de execução ao documento.
A consistência entre este arquivo e a suíte é verificada automaticamente no CI
(`npm run docs:verificar`).

**Resumo:** 110 casos de teste → 183 execuções (casos com várias entradas usam `test.each`)
\+ 21 requisições / 114 asserções na regressão Postman.

### Legenda das técnicas (nomenclatura ISTQB CTFL)

| Sigla | Técnica |
|---|---|
| **PE** | Particionamento de equivalência |
| **AVL** | Análise de valor-limite |
| **TD** | Tabela de decisão |
| **TE** | Teste de transição de estado |
| **SE** | Suposição de erro (baseada em experiência) |
| **CTR** | Teste de contrato (schema OpenAPI) |
| **SEG** | Teste de segurança |
| **CNC** | Teste de concorrência (condição de corrida) |
| **SQL** | Validação de dados no banco |

**Prioridade:** 🔴 Alta (risco financeiro ou de segurança) · 🟡 Média (regra de negócio) · 🟢 Baixa (usabilidade/padrão)

---

## Autenticação — `tests/funcional/autenticacao.test.js`

| ID | Cenário | Regra | Técnica | Prioridade |
|---|---|---|---|---|
| CT-AUT-01 | Gera token Bearer com credenciais válidas (contrato + `Cache-Control: no-store`) | RN-01 | PE, CTR | 🔴 |
| CT-AUT-02 | O token expira exatamente no tempo informado em `expires_in` | RN-01 | SE | 🟡 |
| CT-AUT-03 | Recusa `client_secret` incorreto e `client_id` inexistente (401) | RN-01 | PE | 🔴 |
| CT-AUT-04 | Corpo vazio, campo faltando ou de tipo errado → 400 apontando os campos | RN-01, RN-13 | PE | 🟢 |
| CT-AUT-05 | Sem `Authorization` → 401 com `WWW-Authenticate` | RN-01 | PE | 🔴 |
| CT-AUT-06 | Esquema `Basic`, token mal formado e `Bearer` sem token → 401 | RN-01 | PE, SE | 🔴 |
| CT-AUT-07 | Token com assinatura adulterada → 401 | RN-01 | SEG | 🔴 |
| CT-AUT-08 | Token assinado com outro segredo → 401 | RN-01 | SEG | 🔴 |
| CT-AUT-09 | Token expirado → 401 com mensagem específica | RN-01 | SEG | 🔴 |
| CT-AUT-10 | Token com algoritmo `none` (ataque clássico de JWT) → 401 | RN-01 | SEG, SE | 🔴 |

## Contas — `tests/funcional/contas.test.js`

| ID | Cenário | Regra | Técnica | Prioridade |
|---|---|---|---|---|
| CT-CON-01 | Cria conta com saldo zero, `Location` e CPF mascarado | RN-02, RN-03, RN-04 | PE, CTR | 🔴 |
| CT-CON-02 | Remove espaços extras do início e do fim do nome | RN-02 | SE | 🟢 |
| CT-CON-03 | Nome com 2 (400), 3 (201), 100 (201) e 101 (400) caracteres | RN-02 | AVL | 🟡 |
| CT-CON-04 | CPF inválido: dígito errado, dígitos iguais, pontuação, 10 dígitos, letras, número, ausente | RN-02 | PE | 🟡 |
| CT-CON-05 | CPF duplicado → 409 `DOCUMENTO_JA_CADASTRADO` | RN-02 | PE | 🟡 |
| CT-CON-06 | Devolve todos os erros de validação de uma vez | RN-02, RN-13 | SE | 🟢 |
| CT-CON-07 | JSON mal formado → 400 `JSON_INVALIDO` | RN-13 | SE | 🟢 |
| CT-CON-08 | Corpo como lista em vez de objeto → 400 | RN-13 | SE | 🟢 |
| CT-CON-09 | Consulta conta existente (igual à resposta da criação) | RN-02 | PE, CTR | 🟡 |
| CT-CON-10 | UUID válido mas inexistente → 404 | RN-13 | PE | 🟡 |
| CT-CON-11 | ID fora do formato UUID → 400 `ID_INVALIDO` | RN-13 | PE | 🟢 |

## Extrato — `tests/funcional/extrato.test.js`

| ID | Cenário | Regra | Técnica | Prioridade |
|---|---|---|---|---|
| CT-EXT-01 | Conta nova tem extrato vazio e saldo zero | RN-03, RN-10 | PE, CTR | 🟢 |
| CT-EXT-02 | Registra PIX, envio e recebimento, do mais recente para o mais antigo | RN-10 | PE | 🟡 |
| CT-EXT-03 | O parâmetro `limite` restringe a quantidade de lançamentos | RN-10 | PE | 🟢 |
| CT-EXT-04 | `limite` = 0, 1, 100, 101, -1, 2.5 e `abc` | RN-10 | AVL, PE | 🟢 |
| CT-EXT-05 | Extrato de conta inexistente → 404 | RN-13 | PE | 🟢 |

## Transferências — `tests/funcional/transferencias.test.js`

| ID | Cenário | Regra | Técnica | Prioridade |
|---|---|---|---|---|
| CT-TRF-01 | Transfere e atualiza os saldos de origem e destino | RN-07 | PE, CTR | 🔴 |
| CT-TRF-02 | Permite transferir exatamente todo o saldo | RN-07 | AVL | 🔴 |
| CT-TRF-03 | Guarda a descrição quando informada e `null` quando omitida | RN-07 | PE | 🟢 |
| CT-TRF-04 | `GET /transferencias/:id` devolve a transferência criada | RN-07 | PE | 🟡 |
| CT-TRF-05 | Saldo insuficiente → 422 e nenhum saldo alterado | RN-07 | TD, AVL | 🔴 |
| CT-TRF-06 | Origem sem saldo nenhum → 422 | RN-07 | TD | 🔴 |
| CT-TRF-07 | Origem igual ao destino → 422 `CONTAS_IGUAIS` | RN-07 | TD | 🟡 |
| CT-TRF-08 | Origem igual ao destino mudando maiúsculas/minúsculas do UUID → 422 | RN-07 | SE | 🟡 |
| CT-TRF-09 | Conta de origem ou de destino inexistente → 404 com mensagem específica | RN-07 | TD | 🟡 |
| CT-TRF-10 | Valor 0 (400), 1 (201), 1.000.000 (201) e 1.000.001 (400) centavos | RN-05, RN-07 | AVL | 🔴 |
| CT-TRF-11 | Valor negativo, decimal, texto, nulo e booleano → 400 | RN-05 | PE | 🔴 |
| CT-TRF-12 | Descrição com 140 (201) e 141 (400) caracteres | RN-07 | AVL | 🟢 |
| CT-TRF-13 | IDs de conta fora do formato UUID → 400 apontando os dois campos | RN-07, RN-13 | PE | 🟢 |
| CT-TRF-14 | `Idempotency-Key` ausente, vazia, com espaço ou com 101 caracteres → 400 | RN-08 | PE, AVL | 🔴 |
| CT-TRF-15 | `GET` de transferência inexistente → 404 | RN-13 | PE | 🟢 |
| CT-TRF-16 | `Idempotency-Key` com exatamente 100 caracteres é aceita | RN-08 | AVL | 🟡 |

**Tabela de decisão da transferência (CT-TRF-05 a CT-TRF-09):**

| Condição | R1 | R2 | R3 | R4 | R5 |
|---|---|---|---|---|---|
| Origem ≠ destino | N | S | S | S | S |
| Origem existe | — | N | S | S | S |
| Destino existe | — | — | N | S | S |
| Saldo ≥ valor | — | — | — | N | S |
| **Resultado** | 422 `CONTAS_IGUAIS` | 404 | 404 | 422 `SALDO_INSUFICIENTE` | **201** |

## Idempotência — `tests/funcional/idempotencia.test.js`

| ID | Cenário | Regra | Técnica | Prioridade |
|---|---|---|---|---|
| CT-IDE-01 | Repetir a requisição devolve a mesma transferência, com `Idempotency-Replayed`, e debita uma vez | RN-08 | SE | 🔴 |
| CT-IDE-02 | Três repetições geram uma única linha em `transferencias` (SQL) | RN-08 | SQL | 🔴 |
| CT-IDE-03 | Mesma chave com corpo diferente → 422 e saldo intacto | RN-08 | TD | 🔴 |
| CT-IDE-04 | A ordem dos campos no JSON não muda a identidade da requisição | RN-08 | SE | 🟡 |
| CT-IDE-05 | Depois de um erro, a mesma chave pode ser usada de novo | RN-08 | TE | 🟡 |
| CT-IDE-06 | Chaves diferentes geram transferências diferentes | RN-08 | PE | 🟡 |

## Estornos — `tests/funcional/estornos.test.js`

| ID | Cenário | Regra | Técnica | Prioridade |
|---|---|---|---|---|
| CT-EST-01 | Estorna e devolve os saldos ao estado anterior | RN-09 | TE, CTR | 🔴 |
| CT-EST-02 | O estorno aparece no extrato das duas contas | RN-09, RN-10 | PE | 🟡 |
| CT-EST-03 | Segundo estorno → 409 sem movimentar saldo | RN-09 | TE | 🔴 |
| CT-EST-04 | Destino já gastou o dinheiro → 422, nada é alterado | RN-09 | TD | 🔴 |
| CT-EST-05 | Estorno de transferência inexistente → 404 | RN-09 | TD | 🟢 |
| CT-EST-06 | Estorno com ID fora do formato UUID → 400 | RN-13 | PE | 🟢 |
| CT-EST-07 | Repetir a criação depois do estorno devolve a resposta original, sem nova cobrança | RN-08, RN-09 | TE, SE | 🔴 |

## Webhook de entrada (PIX) — `tests/funcional/webhook-pix.test.js`

| ID | Cenário | Regra | Técnica | Prioridade |
|---|---|---|---|---|
| CT-PIX-01 | PIX com assinatura válida credita a conta | RN-06 | PE, CTR | 🔴 |
| CT-PIX-02 | Reenvio do mesmo evento → `JA_PROCESSADO`, sem crédito duplo (confirmado via SQL) | RN-06 | SE, SQL | 🔴 |
| CT-PIX-03 | Vários PIX diferentes na mesma conta são somados | RN-06 | PE | 🟡 |
| CT-PIX-04 | PIX para conta inexistente → 404 e evento não registrado (SQL) | RN-06 | PE, SQL | 🟡 |
| CT-PIX-05 | Payload inválido: valor zero/decimal, tipo desconhecido, sem `evento_id`, `conta_id` inválido | RN-06 | PE | 🟡 |
| CT-PIX-06 | Sem `X-Assinatura` → 401 e não credita | RN-06 | SEG | 🔴 |
| CT-PIX-07 | Assinatura com segredo errado → 401 | RN-06 | SEG | 🔴 |
| CT-PIX-08 | Corpo alterado depois de assinado (valor inflado) → 401 | RN-06 | SEG, SE | 🔴 |
| CT-PIX-09 | Assinatura com 301 segundos → 401 (anti-replay) | RN-06 | AVL, SEG | 🔴 |
| CT-PIX-10 | Assinatura com 4 minutos → aceita | RN-06 | AVL | 🟡 |
| CT-PIX-11 | Timestamp 10 minutos no futuro → 401 | RN-06 | AVL, SEG | 🟡 |
| CT-PIX-12 | Header sem timestamp, sem hash, hash truncado ou texto qualquer → 401 | RN-06 | PE, SEG | 🔴 |
| CT-PIX-13 | Assinatura validada antes do payload (sem assinatura → 401, não 400) | RN-06 | SEG | 🟡 |

## Webhooks de saída — `tests/funcional/webhooks-saida.test.js`

| ID | Cenário | Regra | Técnica | Prioridade |
|---|---|---|---|---|
| CT-WHK-01 | Cadastra assinatura e devolve o segredo para validar as entregas | RN-11 | PE, CTR | 🟡 |
| CT-WHK-02 | Envia `transferencia.concluida` com payload no contrato e headers de rastreio | RN-11 | PE, CTR | 🔴 |
| CT-WHK-03 | A assinatura HMAC da entrega confere com o segredo (e não confere com outro) | RN-11 | SEG | 🔴 |
| CT-WHK-04 | Envia `transferencia.estornada` quando há estorno | RN-11 | PE | 🟡 |
| CT-WHK-05 | Só envia os eventos que o parceiro assinou | RN-11 | PE | 🟡 |
| CT-WHK-06 | Repetição idempotente da transferência não dispara segundo webhook | RN-08, RN-11 | SE | 🔴 |
| CT-WHK-07 | Parceiro responde 500 e 503: retenta e registra `ENTREGUE` na 3ª tentativa | RN-11 | TE | 🔴 |
| CT-WHK-08 | Parceiro sempre com 500: desiste após 3 tentativas e registra `FALHOU` | RN-11 | TE, AVL | 🔴 |
| CT-WHK-09 | Parceiro fora do ar não atrasa nem impede a transferência | RN-11 | SE | 🔴 |
| CT-WHK-10 | Assinatura removida deixa de receber eventos; 404 depois de removida | RN-11 | TE | 🟡 |
| CT-WHK-11 | Cadastro com URL ausente/ftp/sem protocolo ou eventos vazios/inexistentes/texto → 400 | RN-11 | PE | 🟢 |
| CT-WHK-12 | Eventos duplicados no cadastro são gravados uma única vez | RN-11 | SE | 🟢 |

## Contrato — `tests/contrato/contratos.test.js`

| ID | Cenário | Regra | Técnica | Prioridade |
|---|---|---|---|---|
| CT-CTR-01 | Erros 400 (2 tipos), 401 (3 tipos), 404 (2 tipos), 409 e 422 seguem o schema `Erro` em JSON UTF-8 | RN-13 | CTR | 🟡 |
| CT-CTR-02 | `GET /saude` segue o schema `Saude` | RN-13 | CTR | 🟢 |
| CT-CTR-03 | O `/openapi.json` publicado é idêntico ao `openapi.yaml` do repositório | RN-13 | CTR | 🟡 |
| CT-CTR-04 | A documentação interativa (Swagger UI) está no ar em `/docs` | RN-13 | PE | 🟢 |
| CT-CTR-05 | Todo schema referenciado na especificação existe | RN-13 | CTR | 🟢 |

## Segurança — `tests/seguranca/seguranca.test.js`

| ID | Cenário | Regra | Técnica | Prioridade |
|---|---|---|---|---|
| CT-SEG-01 | As 9 rotas protegidas exigem token (401) | RN-01 | SEG | 🔴 |
| CT-SEG-02 | O CPF completo nunca aparece em nenhuma resposta (inclusive no 409) | RN-04 | SEG | 🔴 |
| CT-SEG-03 | O contrato da Conta recusa campos extras (pegaria vazamento de `documento`) | RN-04 | CTR, SEG | 🔴 |
| CT-SEG-04 | SQL injection no nome é gravado como texto e não executa nada | RN-13 | SEG, SQL | 🔴 |
| CT-SEG-05 | Parâmetro de rota malicioso (SQL injection, path traversal) → 400 | RN-13 | SEG | 🔴 |
| CT-SEG-06 | Corpo acima de 100 KB → 413 | RN-14 | AVL, SEG | 🟡 |
| CT-SEG-07 | Valor acima do maior inteiro seguro do JavaScript → 400 | RN-05 | AVL, SE | 🟡 |
| CT-SEG-08 | Não expõe `X-Powered-By` | RN-13 | SEG | 🟢 |
| CT-SEG-09 | `X-Request-Id` em toda resposta, propagado quando seguro e descartado quando malicioso | RN-13 | SEG | 🟢 |
| CT-SEG-10 | Rota inexistente → 404 padronizado sem stack trace | RN-13 | SEG | 🟢 |
| CT-SEG-11 | `NODE_ENV=production` sem segredos (ou com o padrão público) → API não inicia, exit 1, sem expor valor | RN-15 | SEG, PE | 🔴 |
| CT-SEG-12 | `NODE_ENV=production` com segredos próprios → API inicia | RN-15 | SEG, PE | 🟡 |
| CT-SEG-13 | URL de webhook para localhost, rede privada, metadados da nuvem, IPv6 loopback, IPv4 mapeado ou IP decimal → 400 (SSRF) | RN-16 | SEG, PE | 🔴 |

## Concorrência — `tests/concorrencia/concorrencia.test.js`

| ID | Cenário | Regra | Técnica | Prioridade |
|---|---|---|---|---|
| CT-CNC-01 | 10 transferências simultâneas de R$ 1,00 com saldo de R$ 5,00: exatamente 5 passam | RN-03, RN-12 | CNC | 🔴 |
| CT-CNC-02 | 5 requisições simultâneas com a mesma `Idempotency-Key`: uma única transferência | RN-08, RN-12 | CNC, SQL | 🔴 |
| CT-CNC-03 | 5 estornos simultâneos: só 1 é aplicado | RN-09, RN-12 | CNC | 🔴 |
| CT-CNC-04 | 20 transferências cruzadas simultâneas (A→B e B→A) sem deadlock | RN-12 | CNC | 🔴 |
| CT-CNC-05 | O mesmo PIX enviado 5 vezes ao mesmo tempo credita uma vez | RN-06, RN-12 | CNC | 🔴 |

## Consistência de dados (SQL) — `tests/dados/consistencia.test.js`

Executados depois de um cenário com PIX, transferências, estorno, uma transferência recusada e
reenvio de PIX. As consultas ficam em [`sql/consistencia/`](../sql/consistencia).

| ID | Cenário | Regra | Técnica | Prioridade |
|---|---|---|---|---|
| CT-DAD-01 | O saldo de toda conta bate com a soma dos lançamentos | RN-03, RN-10 | SQL | 🔴 |
| CT-DAD-02 | Nenhuma conta com saldo negativo | RN-03 | SQL | 🔴 |
| CT-DAD-03 | Conservação do dinheiro: soma dos saldos = soma dos PIX recebidos | RN-07, RN-09 | SQL | 🔴 |
| CT-DAD-04 | Toda transferência tem os lançamentos esperados para o seu status (2 ou 4) | RN-07, RN-09 | SQL | 🔴 |
| CT-DAD-05 | Cada evento PIX gerou exatamente um crédito | RN-06 | SQL | 🔴 |
| CT-DAD-06 | O saldo da API é o mesmo gravado no banco | RN-03 | SQL | 🟡 |
| CT-DAD-07 | Os saldos finais do cenário batem com o cálculo manual | RN-07, RN-09 | SQL, SE | 🟡 |

---

## Regressão encadeada no Postman — `postman/`

Fluxo ponta a ponta em que cada requisição usa dados da anterior. Além das asserções de cada passo,
**toda** requisição verifica: tempo de resposta < 1 s, presença de `X-Request-Id`, JSON e formato padrão de erro.

| Passo | Requisição | O que valida | Regra |
|---|---|---|---|
| 01.1 | Gerar token de acesso | 200, tipo Bearer, JWT em 3 partes; guarda o token | RN-01 |
| 01.2 | Recusar credenciais inválidas | 401 `CREDENCIAIS_INVALIDAS` | RN-01 |
| 01.3 | Recusar rota protegida sem token | 401 | RN-01 |
| 02.1 | Criar conta de origem (CPF fictício gerado no pré-script) | 201, saldo 0, CPF mascarado, `Location` | RN-02, RN-04 |
| 02.2 | Criar conta de destino | 201 | RN-02 |
| 02.3 | Recusar CPF duplicado | 409 `DOCUMENTO_JA_CADASTRADO` | RN-02 |
| 02.4 | Recusar CPF inválido | 400 apontando `documento` | RN-02 |
| 03.1 | Receber PIX de R$ 500,00 (HMAC calculado no pré-script) | 200 `PROCESSADO` | RN-06 |
| 03.2 | Reenviar o mesmo PIX | 200 `JA_PROCESSADO` | RN-06 |
| 03.3 | Recusar PIX com assinatura falsa | 401 `ASSINATURA_INVALIDA` | RN-06 |
| 03.4 | Conferir saldo após o PIX | R$ 500,00 (creditado uma vez) | RN-06 |
| 04.1 | Transferir R$ 120,00 | 201 `CONCLUIDA`; guarda o id | RN-07 |
| 04.2 | Repetir com a mesma `Idempotency-Key` | 201, mesmo id, `Idempotency-Replayed: true` | RN-08 |
| 04.3 | Mesma chave com valor diferente | 422 `CHAVE_IDEMPOTENCIA_REUTILIZADA` | RN-08 |
| 04.4 | Transferência acima do saldo | 422 `SALDO_INSUFICIENTE` | RN-07 |
| 04.5 | Transferência sem `Idempotency-Key` | 400 | RN-08 |
| 04.6 | Conferir saldo da origem | R$ 380,00 (debitado uma vez) | RN-08 |
| 05.1 | Estornar a transferência | 200 `ESTORNADA` com data | RN-09 |
| 05.2 | Recusar estorno duplicado | 409 `TRANSFERENCIA_JA_ESTORNADA` | RN-09 |
| 05.3 | Conferir saldo restaurado | R$ 500,00 | RN-09 |
| 06.1 | Extrato da conta de origem | 3 lançamentos na ordem certa; saldo = soma | RN-10 |

---

## Matriz de cobertura: regra × casos

| Regra | Casos automatizados (Jest) | Postman |
|---|---|---|
| RN-01 Autenticação | CT-AUT-01 a 10, CT-SEG-01 | 01.1–01.3 |
| RN-02 Cadastro de conta | CT-CON-01 a 06, CT-CON-09 | 02.1–02.4 |
| RN-03 Saldo | CT-CON-01, CT-EXT-01, CT-CNC-01, CT-DAD-01, 02, 06 | 03.4, 04.6 |
| RN-04 LGPD | CT-CON-01, CT-SEG-02, CT-SEG-03 | 02.1 |
| RN-05 Valores em centavos | CT-TRF-10, CT-TRF-11, CT-SEG-07 | — |
| RN-06 PIX via webhook | CT-PIX-01 a 13, CT-CNC-05, CT-DAD-05 | 03.1–03.4 |
| RN-07 Transferência | CT-TRF-01 a 13, CT-DAD-03, 04, 07 | 04.1, 04.4 |
| RN-08 Idempotência | CT-TRF-14, 16, CT-IDE-01 a 06, CT-EST-07, CT-WHK-06, CT-CNC-02 | 04.2, 04.3, 04.5 |
| RN-09 Estorno | CT-EST-01 a 07, CT-CNC-03, CT-DAD-03, 04, 07 | 05.1–05.3 |
| RN-10 Extrato | CT-EXT-01 a 04, CT-EST-02, CT-DAD-01 | 06.1 |
| RN-11 Webhooks de saída | CT-WHK-01 a 12 | — |
| RN-12 Concorrência | CT-CNC-01 a 05 | — |
| RN-13 Padrão de erros | CT-CON-06 a 08, 10, 11, CT-CTR-01 a 05, CT-SEG-04, 05, 08 a 10 | todas (validação geral) |
| RN-14 Limites técnicos | CT-SEG-06 | — |
| RN-15 Segredos em produção | CT-SEG-11, 12 | — |
| RN-16 Destino de webhook (anti-SSRF) | CT-SEG-13 (e CT-WHK-01 a 12 com o host liberado) | — |
