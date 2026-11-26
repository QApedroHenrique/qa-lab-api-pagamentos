# Arquitetura

Visão técnica da API fictícia (o **sistema sob teste**) e da **arquitetura da automação**.

## 1. Visão geral

```mermaid
flowchart LR
    subgraph Testes["Suíte de testes"]
        J["Jest + axios<br/>(caixa-preta via HTTP)"]
        P["Postman / Newman<br/>(regressão encadeada)"]
        R["Receptor de webhook falso<br/>(faz o papel do parceiro)"]
        Q["Consultas SQL<br/>(validação de dados)"]
    end

    subgraph API["API de Pagamentos (Node.js + Express)"]
        A["Rotas + validação"]
        S["Serviços<br/>(contas, transferências, PIX, webhooks)"]
        D["Despachante de webhooks<br/>(assíncrono, com retentativas)"]
    end

    DB[("PostgreSQL 16")]
    PROV["Provedor PIX<br/>(simulado pelos testes)"]

    J -- "HTTP + Bearer token" --> A
    P -- "HTTP + Bearer token" --> A
    PROV -- "POST /webhooks/pix<br/>assinado com HMAC" --> A
    J -. "simula" .-> PROV
    A --> S --> DB
    S -- "após COMMIT" --> D
    D -- "POST assinado (HMAC)<br/>até 3 tentativas" --> R
    Q -- "SELECT" --> DB
```

## 2. Estrutura do código

```
src/
├── app.js                 # monta o Express: X-Request-Id, JSON, rotas, Swagger, erros
├── server.js              # aplica o schema e sobe o servidor
├── config.js              # todas as configurações (via variáveis de ambiente)
├── db/
│   ├── schema.sql         # tabelas, constraints e índices
│   ├── migrate.js         # aplica o schema / limpa o banco (testes)
│   └── pool.js            # conexão e helper de transação (BEGIN/COMMIT/ROLLBACK)
├── middlewares/           # autenticação JWT e tratamento padronizado de erros
├── rotas/                 # validação de entrada e códigos HTTP
├── servicos/              # regras de negócio e acesso ao banco
└── utils/                 # CPF, assinatura HMAC, validações, erros
```

**Separação de responsabilidades:** as **rotas** validam a entrada e escolhem o status HTTP;
os **serviços** aplicam as regras de negócio dentro de transações; os **utils** são funções puras.

## 3. Modelo de dados

```mermaid
erDiagram
    contas ||--o{ lancamentos : "tem"
    contas ||--o{ transferencias : "origem"
    contas ||--o{ transferencias : "destino"
    contas ||--o{ eventos_pix_recebidos : "recebe"
    assinaturas_webhook ||--o{ entregas_webhook : "registra"

    contas {
        uuid id PK
        text nome
        varchar documento UK "CPF, nunca exposto"
        bigint saldo "CHECK >= 0"
        timestamptz criada_em
    }
    lancamentos {
        bigserial id PK
        uuid conta_id FK
        text tipo "CREDITO | DEBITO"
        text origem "PIX_RECEBIDO | TRANSFERENCIA | ESTORNO"
        bigint valor "CHECK > 0"
        text referencia_id "transferência ou evento"
    }
    transferencias {
        uuid id PK
        uuid conta_origem_id FK
        uuid conta_destino_id FK
        bigint valor
        text status "CONCLUIDA | ESTORNADA"
        timestamptz estornada_em
    }
    chaves_idempotencia {
        text chave PK
        text hash_requisicao
        int status_http
        jsonb corpo_resposta
    }
    eventos_pix_recebidos {
        text evento_id PK
        uuid conta_id FK
        bigint valor
    }
    assinaturas_webhook {
        uuid id PK
        text url
        text_array eventos
        text segredo
    }
    entregas_webhook {
        bigserial id PK
        uuid assinatura_id FK
        uuid evento_id
        text status "PENDENTE | ENTREGUE | FALHOU"
        int tentativas
        int ultimo_status_http
    }
```

**Livro-razão (ledger):** o saldo fica em `contas.saldo` por desempenho, mas **toda** alteração gera
um lançamento. Isso permite auditar o saldo com SQL a qualquer momento
([`sql/consistencia/01_saldo_bate_com_lancamentos.sql`](../sql/consistencia/01_saldo_bate_com_lancamentos.sql)).

## 4. Fluxos principais

### 4.1 Transferência com idempotência

```mermaid
sequenceDiagram
    autonumber
    participant C as Cliente
    participant API
    participant DB as PostgreSQL
    participant W as Despachante de webhooks

    C->>API: POST /transferencias (Idempotency-Key: K)
    API->>API: valida corpo e header (400 se inválido)
    API->>DB: BEGIN
    API->>DB: INSERT chave K ... ON CONFLICT DO NOTHING
    alt chave K já existia
        DB-->>API: nenhuma linha inserida
        API->>DB: SELECT resposta guardada de K
        API->>DB: COMMIT
        API-->>C: mesma resposta + Idempotency-Replayed: true
    else chave nova
        API->>DB: SELECT contas ... ORDER BY id FOR UPDATE
        API->>API: valida existência e saldo (404 / 422 → ROLLBACK)
        API->>DB: INSERT transferência + 2 lançamentos + UPDATE saldos
        API->>DB: guarda a resposta na chave K
        API->>DB: COMMIT
        API-->>C: 201 Created
        API--)W: publica transferencia.concluida (assíncrono)
    end
```

### 4.2 PIX recebido (webhook de entrada)

```mermaid
sequenceDiagram
    autonumber
    participant P as Provedor PIX
    participant API
    participant DB as PostgreSQL

    P->>API: POST /webhooks/pix + X-Assinatura: t=...,v1=HMAC
    API->>API: recalcula o HMAC sobre "t.corpo_bruto" e compara (tempo constante)
    API->>API: confere janela de 5 min (anti-replay)
    alt assinatura inválida
        API-->>P: 401 ASSINATURA_INVALIDA
    else assinatura válida
        API->>DB: BEGIN + SELECT conta FOR UPDATE
        API->>DB: INSERT evento ... ON CONFLICT DO NOTHING
        alt evento novo
            API->>DB: crédito + lançamento + COMMIT
            API-->>P: 200 PROCESSADO
        else evento repetido
            API->>DB: COMMIT (nada muda)
            API-->>P: 200 JA_PROCESSADO
        end
    end
```

### 4.3 Webhook de saída com retentativas

```mermaid
sequenceDiagram
    autonumber
    participant W as Despachante
    participant DB as PostgreSQL
    participant PA as Parceiro

    W->>DB: registra entrega PENDENTE
    loop até 3 tentativas
        W->>PA: POST evento (X-Tentativa: n, X-Assinatura)
        alt resposta 2xx
            W->>DB: status ENTREGUE
        else erro / timeout
            W->>DB: atualiza tentativas e último status
            W->>W: espera intervalo × 2^(n-1)
        end
    end
    W->>DB: status FALHOU (se nenhuma tentativa deu certo)
```

## 5. Decisões técnicas

| Decisão | Motivo | Como é testado |
|---|---|---|
| Valores em **centavos inteiros** (`BIGINT`) | Evita erro de arredondamento de ponto flutuante | CT-TRF-10, CT-TRF-11 |
| **Chave de idempotência gravada no início da transação** | Requisições simultâneas com a mesma chave esperam a primeira terminar e recebem a mesma resposta | CT-CNC-02 |
| **`SELECT ... FOR UPDATE` em ordem fixa (por id)** | Impede gasto duplo e evita deadlock em A→B / B→A simultâneos | CT-CNC-01, CT-CNC-04 |
| **`CHECK (saldo >= 0)` no banco** | Defesa em profundidade: mesmo com bug na aplicação, o banco recusa saldo negativo | CT-DAD-02 |
| **HMAC sobre `timestamp.corpo_bruto`** | Garante autenticidade e integridade, e impede reaproveitar requisições antigas | CT-PIX-06 a 13 |
| **Comparação em tempo constante** (`timingSafeEqual`) | Evita ataque de tempo na verificação de assinatura e credenciais | — (boa prática de código) |
| **Webhook disparado após o COMMIT** | Nunca notificar uma operação que foi desfeita | CT-WHK-02, CT-WHK-06 |
| **Entrega assíncrona com backoff exponencial** | Parceiro lento ou fora do ar não afeta o cliente | CT-WHK-07 a 09 |
| **CPF só mascarado nas respostas** | LGPD: minimização de dados | CT-SEG-02, CT-SEG-03 |
| **OpenAPI como fonte única do contrato** | A documentação publicada é a mesma usada para validar as respostas nos testes | CT-CTR-01 a 05 |

## 6. Arquitetura da automação

```
tests/
├── setup/            # global-setup (sobe a API e limpa o banco), teardown e matcher toSeguirContrato
├── helpers/          # cliente HTTP, fábricas de dados, assinatura HMAC, receptor de webhook, SQL
├── funcional/        # testes por funcionalidade
├── contrato/         # validação contra o OpenAPI
├── seguranca/        # autenticação, LGPD, entradas maliciosas
├── concorrencia/     # condições de corrida
└── dados/            # integridade via SQL
```

**Princípios usados:**

- **Caixa-preta:** os testes só conversam com a API por HTTP (`BASE_URL`). Dá para apontar a mesma
  suíte para outro ambiente sem mudar código.
- **Oráculo independente:** a assinatura HMAC dos testes foi escrita a partir da documentação, sem
  importar o código da API — se a API mudar o algoritmo por engano, o teste percebe.
- **Dados isolados e descartáveis:** cada teste cria as próprias contas com CPFs fictícios
  (fábricas em `tests/helpers/fabricas.js`). Nenhum teste depende de outro.
- **Status sempre explícito:** o cliente HTTP não lança exceção em 4xx/5xx; cada teste afirma o status esperado.
- **Espera por condição, não por tempo fixo:** o receptor de webhook espera até a requisição chegar
  (com timeout), o que deixa os testes rápidos e estáveis.
- **Matcher customizado:** `expect(corpo).toSeguirContrato('Conta')` deixa o teste legível e mostra
  exatamente qual campo violou o contrato quando falha.
