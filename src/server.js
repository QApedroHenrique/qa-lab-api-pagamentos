const config = require('./config');
const { criarApp } = require('./app');
const { migrar } = require('./db/migrate');
const { pool } = require('./db/pool');

/** Valida a configuração, aplica o schema e sobe o servidor HTTP. Retorna o servidor (usado também pelo setup dos testes). */
async function iniciar(porta = config.porta) {
  config.validarConfiguracao(); // RN-15: falha antes de tocar no banco
  await migrar();
  const app = criarApp();
  return new Promise((resolve) => {
    const servidor = app.listen(porta, () => resolve(servidor));
  });
}

if (require.main === module) {
  iniciar()
    .then((servidor) => {
      const { port } = servidor.address();
      console.log(`API de Pagamentos (fictícia) rodando em http://localhost:${port}`);
      console.log(`Documentação interativa: http://localhost:${port}/docs`);

      const encerrar = () => {
        servidor.close(() => pool.end().then(() => process.exit(0)));
      };
      process.on('SIGTERM', encerrar);
      process.on('SIGINT', encerrar);
    })
    .catch((erro) => {
      console.error('Não foi possível iniciar a API:', erro.message);
      process.exit(1);
    });
}

module.exports = { iniciar };
