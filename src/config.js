require('dotenv').config({ quiet: true });

// Todos os valores padrão abaixo são FICTÍCIOS e servem apenas para o ambiente local de testes.
const config = {
  porta: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL || 'postgres://qa:qa@localhost:5432/pagamentos',

  // Credenciais do cliente da API (fluxo client_credentials)
  clientId: process.env.API_CLIENT_ID || 'qa-lab',
  clientSecret: process.env.API_CLIENT_SECRET || 'segredo-local-123',

  // Token de acesso (JWT)
  jwtSecret: process.env.JWT_SECRET || 'jwt-segredo-local',
  jwtExpiracaoSegundos: Number(process.env.JWT_EXPIRACAO_SEGUNDOS || 3600),

  // Webhook de entrada (provedor PIX fictício -> API)
  pixWebhookSecret: process.env.PIX_WEBHOOK_SECRET || 'pix-segredo-local',
  toleranciaAssinaturaSegundos: Number(process.env.TOLERANCIA_ASSINATURA_SEGUNDOS || 300),

  // Webhooks de saída (API -> sistemas parceiros)
  webhookMaxTentativas: Number(process.env.WEBHOOK_MAX_TENTATIVAS || 3),
  webhookIntervaloBaseMs: Number(process.env.WEBHOOK_INTERVALO_BASE_MS || 200),
  webhookTimeoutMs: Number(process.env.WEBHOOK_TIMEOUT_MS || 3000),

  // Regras de negócio
  valorMinimoCentavos: 1,
  valorMaximoTransferenciaCentavos: 1_000_000, // R$ 10.000,00
  tamanhoMaximoDescricao: 140,
};

module.exports = config;
