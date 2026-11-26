-- Modelo de dados da API de Pagamentos (fictícia)
-- Todos os valores monetários são armazenados em CENTAVOS (BIGINT) para evitar erro de arredondamento.

CREATE TABLE IF NOT EXISTS contas (
  id          UUID PRIMARY KEY,
  nome        TEXT        NOT NULL,
  documento   VARCHAR(11) NOT NULL UNIQUE,
  saldo       BIGINT      NOT NULL DEFAULT 0 CHECK (saldo >= 0),
  criada_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Livro-razão (ledger): toda movimentação de saldo gera um lançamento.
-- Regra de consistência: contas.saldo = soma(CREDITO) - soma(DEBITO).
CREATE TABLE IF NOT EXISTS lancamentos (
  id             BIGSERIAL PRIMARY KEY,
  conta_id       UUID        NOT NULL REFERENCES contas(id),
  tipo           TEXT        NOT NULL CHECK (tipo IN ('CREDITO', 'DEBITO')),
  origem         TEXT        NOT NULL CHECK (origem IN ('PIX_RECEBIDO', 'TRANSFERENCIA', 'ESTORNO')),
  valor          BIGINT      NOT NULL CHECK (valor > 0),
  referencia_id  TEXT        NOT NULL,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lancamentos_conta ON lancamentos (conta_id, id DESC);

CREATE TABLE IF NOT EXISTS transferencias (
  id                UUID PRIMARY KEY,
  conta_origem_id   UUID        NOT NULL REFERENCES contas(id),
  conta_destino_id  UUID        NOT NULL REFERENCES contas(id),
  valor             BIGINT      NOT NULL CHECK (valor > 0),
  descricao         TEXT,
  status            TEXT        NOT NULL CHECK (status IN ('CONCLUIDA', 'ESTORNADA')),
  criada_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  estornada_em      TIMESTAMPTZ,
  CHECK (conta_origem_id <> conta_destino_id)
);

-- Chaves de idempotência (header Idempotency-Key das transferências).
-- A chave é gravada NO INÍCIO da mesma transação da transferência: se duas requisições
-- com a mesma chave chegarem juntas, a segunda espera a primeira terminar e devolve a mesma resposta.
CREATE TABLE IF NOT EXISTS chaves_idempotencia (
  chave            TEXT PRIMARY KEY,
  hash_requisicao  TEXT        NOT NULL,
  status_http      INT,
  corpo_resposta   JSONB,
  criada_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Eventos PIX recebidos do provedor (garante que o mesmo evento não credita duas vezes)
CREATE TABLE IF NOT EXISTS eventos_pix_recebidos (
  evento_id    TEXT PRIMARY KEY,
  conta_id     UUID        NOT NULL REFERENCES contas(id),
  valor        BIGINT      NOT NULL CHECK (valor > 0),
  recebido_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Assinaturas de webhook de saída (parceiros que querem ser notificados)
CREATE TABLE IF NOT EXISTS assinaturas_webhook (
  id         UUID PRIMARY KEY,
  url        TEXT        NOT NULL,
  eventos    TEXT[]      NOT NULL,
  segredo    TEXT        NOT NULL,
  ativa      BOOLEAN     NOT NULL DEFAULT true,
  criada_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Histórico de entregas de webhook (observabilidade e auditoria de retentativas)
CREATE TABLE IF NOT EXISTS entregas_webhook (
  id                  BIGSERIAL PRIMARY KEY,
  assinatura_id       UUID        NOT NULL REFERENCES assinaturas_webhook(id) ON DELETE CASCADE,
  evento_id           UUID        NOT NULL,
  tipo_evento         TEXT        NOT NULL,
  status              TEXT        NOT NULL CHECK (status IN ('PENDENTE', 'ENTREGUE', 'FALHOU')),
  tentativas          INT         NOT NULL DEFAULT 0,
  ultimo_status_http  INT,
  payload             JSONB       NOT NULL,
  criada_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizada_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);
