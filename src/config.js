require('dotenv').config({ quiet: true });

/**
 * Segredos com valor padrão PÚBLICO (estão no repositório). Servem só para o ambiente local de
 * testes: em produção a API se recusa a iniciar com eles (RN-15).
 */
const SEGREDOS_PADRAO_LOCAL = {
  API_CLIENT_SECRET: 'segredo-local-123',
  JWT_SECRET: 'jwt-segredo-local',
  PIX_WEBHOOK_SECRET: 'pix-segredo-local',
};

const segredo = (nome) => process.env[nome] || SEGREDOS_PADRAO_LOCAL[nome];

const listaSeparadaPorVirgula = (valor) =>
  (valor || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

// Todos os valores padrão abaixo são FICTÍCIOS e servem apenas para o ambiente local de testes.
const config = {
  porta: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL || 'postgres://qa:qa@localhost:5432/pagamentos',

  // Credenciais do cliente da API (fluxo client_credentials)
  clientId: process.env.API_CLIENT_ID || 'qa-lab',
  clientSecret: segredo('API_CLIENT_SECRET'),

  // Token de acesso (JWT)
  jwtSecret: segredo('JWT_SECRET'),
  jwtExpiracaoSegundos: Number(process.env.JWT_EXPIRACAO_SEGUNDOS || 3600),

  // Webhook de entrada (provedor PIX fictício -> API)
  pixWebhookSecret: segredo('PIX_WEBHOOK_SECRET'),
  toleranciaAssinaturaSegundos: Number(process.env.TOLERANCIA_ASSINATURA_SEGUNDOS || 300),

  // Webhooks de saída (API -> sistemas parceiros)
  webhookMaxTentativas: Number(process.env.WEBHOOK_MAX_TENTATIVAS || 3),
  webhookIntervaloBaseMs: Number(process.env.WEBHOOK_INTERVALO_BASE_MS || 200),
  webhookTimeoutMs: Number(process.env.WEBHOOK_TIMEOUT_MS || 3000),
  // Exceções ao bloqueio anti-SSRF (RN-16): hosts internos liberados, separados por vírgula
  webhookHostsPermitidos: listaSeparadaPorVirgula(process.env.WEBHOOK_HOSTS_PERMITIDOS),

  // Regras de negócio
  valorMinimoCentavos: 1,
  valorMaximoTransferenciaCentavos: 1_000_000, // R$ 10.000,00
  tamanhoMaximoDescricao: 140,
};

/**
 * RN-15: em produção, segredo ausente, vazio ou igual ao padrão público impede a API de iniciar.
 * A mensagem cita apenas o NOME das variáveis, nunca o valor.
 */
function validarConfiguracao(ambiente = process.env) {
  if (ambiente.NODE_ENV !== 'production') return;
  const inseguros = Object.entries(SEGREDOS_PADRAO_LOCAL)
    .filter(([nome, padrao]) => !ambiente[nome] || ambiente[nome] === padrao)
    .map(([nome]) => nome);
  if (inseguros.length) {
    throw new Error(
      `NODE_ENV=production exige segredos próprios. Defina: ${inseguros.join(', ')}.`,
    );
  }
}

module.exports = config;
module.exports.validarConfiguracao = validarConfiguracao;
