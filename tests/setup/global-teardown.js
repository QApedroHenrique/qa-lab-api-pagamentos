module.exports = async () => {
  const servidor = globalThis.__SERVIDOR_API__;
  if (!servidor) return;

  // Dá tempo para webhooks que ainda estão em retentativa terminarem antes de fechar o banco
  await new Promise((r) => setTimeout(r, 300));
  servidor.closeAllConnections?.();
  await new Promise((resolve) => servidor.close(resolve));
  await require('../../src/db/pool').pool.end();
};
