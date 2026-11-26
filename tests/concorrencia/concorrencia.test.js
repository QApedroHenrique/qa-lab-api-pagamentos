const crypto = require('crypto');
const db = require('../helpers/db');
const { apiAutenticada } = require('../helpers/api');
const { criarConta, criarContaComSaldo, transferir, consultarSaldo, novaChave, enviarPix } = require('../helpers/fabricas');

afterAll(() => db.fechar());

const contarStatus = (respostas) =>
  respostas.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {});

/**
 * Testes de condição de corrida: disparam várias requisições AO MESMO TEMPO (Promise.all).
 * São os bugs mais caros em sistemas financeiros (gasto duplo, saldo negativo, cobrança em dobro).
 */
describe('Concorrência', () => {
  test('[CT-CNC-01] 10 transferências simultâneas de R$1,00 numa conta com R$5,00: exatamente 5 passam', async () => {
    const origem = await criarContaComSaldo(500);
    const destino = await criarConta();

    const resultados = await Promise.all(
      Array.from({ length: 10 }, () => transferir({ origem: origem.id, destino: destino.id, valor: 100 })),
    );
    const respostas = resultados.map((r) => r.resposta);

    expect(contarStatus(respostas)).toEqual({ 201: 5, 422: 5 });
    expect(respostas.filter((r) => r.status === 422).every((r) => r.data.erro.codigo === 'SALDO_INSUFICIENTE')).toBe(true);
    expect(await consultarSaldo(origem.id)).toBe(0);
    expect(await consultarSaldo(destino.id)).toBe(500);
  });

  test('[CT-CNC-02] 5 requisições simultâneas com a MESMA Idempotency-Key criam uma única transferência', async () => {
    const origem = await criarContaComSaldo(10000);
    const destino = await criarConta();
    const chave = novaChave();

    const resultados = await Promise.all(
      Array.from({ length: 5 }, () => transferir({ origem: origem.id, destino: destino.id, valor: 3000, chave })),
    );
    const ids = new Set(resultados.map((r) => r.resposta.data.id));

    expect(resultados.every((r) => r.resposta.status === 201)).toBe(true);
    expect(ids.size).toBe(1);
    expect(await consultarSaldo(origem.id)).toBe(7000);

    const [{ quantidade }] = await db.consultar(
      'SELECT COUNT(*)::int AS quantidade FROM transferencias WHERE conta_origem_id = $1',
      [origem.id],
    );
    expect(quantidade).toBe(1);
  });

  test('[CT-CNC-03] estornos simultâneos da mesma transferência: só 1 é aplicado', async () => {
    const api = await apiAutenticada();
    const origem = await criarContaComSaldo(5000);
    const destino = await criarConta();
    const { resposta } = await transferir({ origem: origem.id, destino: destino.id, valor: 2000 });

    const respostas = await Promise.all(
      Array.from({ length: 5 }, () => api.post(`/transferencias/${resposta.data.id}/estorno`)),
    );

    expect(contarStatus(respostas)).toEqual({ 200: 1, 409: 4 });
    expect(await consultarSaldo(origem.id)).toBe(5000);
    expect(await consultarSaldo(destino.id)).toBe(0);
  });

  test('[CT-CNC-04] transferências cruzadas simultâneas (A→B e B→A) terminam sem deadlock', async () => {
    const contaA = await criarContaComSaldo(10000);
    const contaB = await criarContaComSaldo(10000);

    const operacoes = Array.from({ length: 20 }, (_, i) =>
      i % 2 === 0
        ? transferir({ origem: contaA.id, destino: contaB.id, valor: 100 })
        : transferir({ origem: contaB.id, destino: contaA.id, valor: 100 }),
    );
    const resultados = await Promise.all(operacoes);

    expect(resultados.every((r) => r.resposta.status === 201)).toBe(true);
    expect((await consultarSaldo(contaA.id)) + (await consultarSaldo(contaB.id))).toBe(20000);
  });

  test('[CT-CNC-05] o mesmo evento PIX enviado 5 vezes ao mesmo tempo credita uma única vez', async () => {
    const conta = await criarConta();
    const eventoId = `pix-${crypto.randomUUID()}`;

    const resultados = await Promise.all(
      Array.from({ length: 5 }, () => enviarPix({ contaId: conta.id, valor: 700, eventoId })),
    );
    const status = resultados.map((r) => r.resposta.data.status).sort();

    expect(status).toEqual(['JA_PROCESSADO', 'JA_PROCESSADO', 'JA_PROCESSADO', 'JA_PROCESSADO', 'PROCESSADO']);
    expect(await consultarSaldo(conta.id)).toBe(700);
  });
});
