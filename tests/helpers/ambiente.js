require('dotenv').config({ quiet: true });

/**
 * Configuração do ambiente sob teste.
 * Os testes são "caixa-preta": falam com a API só por HTTP, em BASE_URL.
 * Se BASE_URL não for informada, o global-setup sobe a API localmente.
 */
module.exports = {
  baseUrl: () => process.env.BASE_URL || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL || 'postgres://qa:qa@localhost:5432/pagamentos',
  clientId: process.env.API_CLIENT_ID || 'qa-lab',
  clientSecret: process.env.API_CLIENT_SECRET || 'segredo-local-123',
  jwtSecret: process.env.JWT_SECRET || 'jwt-segredo-local',
  pixWebhookSecret: process.env.PIX_WEBHOOK_SECRET || 'pix-segredo-local',
};
