/**
 * Executado UMA vez antes de toda a suíte.
 * - Com BASE_URL definida: testa uma API que já está rodando (ex.: outro ambiente).
 * - Sem BASE_URL: aplica o schema, limpa o banco e sobe a API localmente numa porta livre.
 */
module.exports = async () => {
  if (process.env.BASE_URL) {
    console.log(`\n→ Testando API externa em ${process.env.BASE_URL}`);
    return;
  }

  // Retentativas de webhook mais rápidas só no ambiente de teste
  process.env.WEBHOOK_INTERVALO_BASE_MS = process.env.WEBHOOK_INTERVALO_BASE_MS || '50';

  const { iniciar } = require('../../src/server');
  const { migrar, limparBanco } = require('../../src/db/migrate');

  await migrar();
  await limparBanco();
  const servidor = await iniciar(0);

  globalThis.__SERVIDOR_API__ = servidor;
  process.env.BASE_URL = `http://localhost:${servidor.address().port}`;
  console.log(`\n→ API de teste iniciada em ${process.env.BASE_URL}`);
};
