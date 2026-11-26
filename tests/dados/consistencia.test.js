const db = require('../helpers/db');
const { apiAutenticada } = require('../helpers/api');
const { criarConta, criarContaComSaldo, transferir, enviarPix } = require('../helpers/fabricas');

/**
 * Validação de dados com SQL: depois de um cenário com várias operações,
 * o banco precisa continuar íntegro. As consultas ficam em /sql/consistencia
 * e podem ser executadas manualmente no psql/DBeaver.
 */
describe('Consistência dos dados (validação via SQL)', () => {
  const contasDoCenario = [];

  beforeAll(async () => {
    const api = await apiAutenticada();
    const ana = await criarContaComSaldo(50000);
    const bruno = await criarContaComSaldo(20000);
    const carla = await criarConta();
    contasDoCenario.push(ana, bruno, carla);

    const t1 = await transferir({ origem: ana.id, destino: carla.id, valor: 15000 });
    await transferir({ origem: bruno.id, destino: carla.id, valor: 5000 });
    await transferir({ origem: carla.id, destino: bruno.id, valor: 2500 });
    await api.post(`/transferencias/${t1.resposta.data.id}/estorno`);
    await transferir({ origem: ana.id, destino: bruno.id, valor: 999999 }); // falha: saldo insuficiente
    const eventoRepetido = `pix-cenario-${Date.now()}`;
    await enviarPix({ contaId: carla.id, valor: 1000, eventoId: eventoRepetido });
    await enviarPix({ contaId: carla.id, valor: 1000, eventoId: eventoRepetido }); // reenvio do provedor
  });

  afterAll(() => db.fechar());

  test('[CT-DAD-01] o saldo de toda conta bate com a soma dos lançamentos do livro-razão', async () => {
    const divergencias = await db.executarArquivoSql('consistencia/01_saldo_bate_com_lancamentos.sql');
    expect(divergencias).toEqual([]);
  });

  test('[CT-DAD-02] nenhuma conta tem saldo negativo', async () => {
    const negativas = await db.executarArquivoSql('consistencia/02_nenhum_saldo_negativo.sql');
    expect(negativas).toEqual([]);
  });

  test('[CT-DAD-03] o dinheiro é conservado: soma dos saldos = soma dos PIX recebidos', async () => {
    const [resultado] = await db.executarArquivoSql('consistencia/03_conservacao_do_dinheiro.sql');
    expect(Number(resultado.diferenca)).toBe(0);
    expect(Number(resultado.soma_dos_saldos)).toBeGreaterThan(0);
  });

  test('[CT-DAD-04] toda transferência tem exatamente os lançamentos esperados para o seu status', async () => {
    const problemas = await db.executarArquivoSql('consistencia/04_lancamentos_por_transferencia.sql');
    expect(problemas).toEqual([]);
  });

  test('[CT-DAD-05] cada evento PIX gerou exatamente um crédito', async () => {
    const problemas = await db.executarArquivoSql('consistencia/05_pix_creditado_uma_vez.sql');
    expect(problemas).toEqual([]);
  });

  test('[CT-DAD-06] o saldo informado pela API é o mesmo gravado no banco', async () => {
    const api = await apiAutenticada();
    for (const conta of contasDoCenario) {
      const { data } = await api.get(`/contas/${conta.id}`);
      const [linha] = await db.consultar('SELECT saldo FROM contas WHERE id = $1', [conta.id]);
      expect(data.saldo).toBe(Number(linha.saldo));
    }
  });

  test('[CT-DAD-07] os saldos finais do cenário são os calculados manualmente', async () => {
    const api = await apiAutenticada();
    const [ana, bruno, carla] = await Promise.all(contasDoCenario.map((c) => api.get(`/contas/${c.id}`)));

    // Ana: 50000 - 15000 + 15000 (estorno) = 50000
    // Bruno: 20000 - 5000 + 2500 = 17500
    // Carla: 0 + 15000 + 5000 - 2500 - 15000 (estorno) + 1000 (PIX, uma vez só) = 3500
    expect(ana.data.saldo).toBe(50000);
    expect(bruno.data.saldo).toBe(17500);
    expect(carla.data.saldo).toBe(3500);
  });
});
