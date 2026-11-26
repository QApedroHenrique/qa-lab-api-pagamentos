const db = require('../helpers/db');
const { criarConta, criarContaComSaldo, transferir, consultarSaldo, novaChave } = require('../helpers/fabricas');

afterAll(() => db.fechar());

describe('Idempotência das transferências (header Idempotency-Key)', () => {
  test('[CT-IDE-01] repetir a mesma requisição devolve a MESMA transferência e debita só uma vez', async () => {
    const origem = await criarContaComSaldo(10000);
    const destino = await criarConta();
    const chave = novaChave();

    const primeira = await transferir({ origem: origem.id, destino: destino.id, valor: 4000, chave });
    const segunda = await transferir({ origem: origem.id, destino: destino.id, valor: 4000, chave });

    expect(primeira.resposta.status).toBe(201);
    expect(segunda.resposta.status).toBe(201);
    expect(segunda.resposta.data).toEqual(primeira.resposta.data);
    expect(primeira.resposta.headers['idempotency-replayed']).toBeUndefined();
    expect(segunda.resposta.headers['idempotency-replayed']).toBe('true');
    expect(await consultarSaldo(origem.id)).toBe(6000);
    expect(await consultarSaldo(destino.id)).toBe(4000);
  });

  test('[CT-IDE-02] a repetição não cria uma segunda transferência no banco (validação via SQL)', async () => {
    const origem = await criarContaComSaldo(10000);
    const destino = await criarConta();
    const chave = novaChave();

    for (let i = 0; i < 3; i += 1) await transferir({ origem: origem.id, destino: destino.id, valor: 1000, chave });

    const [{ quantidade }] = await db.consultar(
      'SELECT COUNT(*)::int AS quantidade FROM transferencias WHERE conta_origem_id = $1',
      [origem.id],
    );
    expect(quantidade).toBe(1);
  });

  test('[CT-IDE-03] a mesma chave com corpo diferente retorna 422 e não movimenta saldo', async () => {
    const origem = await criarContaComSaldo(10000);
    const destino = await criarConta();
    const chave = novaChave();

    await transferir({ origem: origem.id, destino: destino.id, valor: 1000, chave });
    const { resposta } = await transferir({ origem: origem.id, destino: destino.id, valor: 2000, chave });

    expect(resposta.status).toBe(422);
    expect(resposta.data.erro.codigo).toBe('CHAVE_IDEMPOTENCIA_REUTILIZADA');
    expect(await consultarSaldo(origem.id)).toBe(9000);
  });

  test('[CT-IDE-04] a ordem dos campos no JSON não muda a identidade da requisição', async () => {
    const origem = await criarContaComSaldo(10000);
    const destino = await criarConta();
    const chave = novaChave();
    const { apiAutenticada } = require('../helpers/api');
    const api = await apiAutenticada();
    const headers = { 'Idempotency-Key': chave };

    const primeira = await api.post(
      '/transferencias',
      { conta_origem_id: origem.id, conta_destino_id: destino.id, valor: 500 },
      { headers },
    );
    const segunda = await api.post(
      '/transferencias',
      { valor: 500, conta_destino_id: destino.id, conta_origem_id: origem.id },
      { headers },
    );

    expect(segunda.status).toBe(201);
    expect(segunda.data.id).toBe(primeira.data.id);
  });

  test('[CT-IDE-05] depois de um erro (saldo insuficiente) a mesma chave pode ser usada de novo', async () => {
    const origem = await criarConta();
    const destino = await criarConta();
    const chave = novaChave();

    const comErro = await transferir({ origem: origem.id, destino: destino.id, valor: 500, chave });
    expect(comErro.resposta.status).toBe(422);

    const { enviarPix } = require('../helpers/fabricas');
    await enviarPix({ contaId: origem.id, valor: 500 });
    const novaTentativa = await transferir({ origem: origem.id, destino: destino.id, valor: 500, chave });

    expect(novaTentativa.resposta.status).toBe(201);
    expect(novaTentativa.resposta.headers['idempotency-replayed']).toBeUndefined();
  });

  test('[CT-IDE-06] chaves diferentes geram transferências diferentes', async () => {
    const origem = await criarContaComSaldo(10000);
    const destino = await criarConta();

    const a = await transferir({ origem: origem.id, destino: destino.id, valor: 1000 });
    const b = await transferir({ origem: origem.id, destino: destino.id, valor: 1000 });

    expect(a.resposta.data.id).not.toBe(b.resposta.data.id);
    expect(await consultarSaldo(origem.id)).toBe(8000);
  });
});
