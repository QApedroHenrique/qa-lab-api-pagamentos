const { apiAutenticada } = require('../helpers/api');
const { criarConta, criarContaComSaldo, transferir, consultarSaldo, novaChave } = require('../helpers/fabricas');

const UUID_INEXISTENTE = '5e4d3c2b-1a09-4f8e-9d7c-6b5a4f3e2d1c';

describe('Transferências — POST /transferencias (caminho feliz)', () => {
  test('[CT-TRF-01] transfere valor e atualiza os saldos de origem e destino', async () => {
    const origem = await criarContaComSaldo(50000);
    const destino = await criarConta();

    const { resposta } = await transferir({ origem: origem.id, destino: destino.id, valor: 12345 });

    expect(resposta.status).toBe(201);
    expect(resposta.data).toSeguirContrato('Transferencia');
    expect(resposta.data).toMatchObject({
      conta_origem_id: origem.id,
      conta_destino_id: destino.id,
      valor: 12345,
      status: 'CONCLUIDA',
      estornada_em: null,
    });
    expect(resposta.headers.location).toBe(`/transferencias/${resposta.data.id}`);
    expect(await consultarSaldo(origem.id)).toBe(50000 - 12345);
    expect(await consultarSaldo(destino.id)).toBe(12345);
  });

  test('[CT-TRF-02] permite transferir exatamente todo o saldo (saldo final zero)', async () => {
    const origem = await criarContaComSaldo(999);
    const destino = await criarConta();

    const { resposta } = await transferir({ origem: origem.id, destino: destino.id, valor: 999 });

    expect(resposta.status).toBe(201);
    expect(await consultarSaldo(origem.id)).toBe(0);
  });

  test('[CT-TRF-03] guarda a descrição quando informada e null quando omitida', async () => {
    const origem = await criarContaComSaldo(1000);
    const destino = await criarConta();

    const comDescricao = await transferir({ origem: origem.id, destino: destino.id, valor: 100, descricao: 'Aluguel' });
    const semDescricao = await transferir({ origem: origem.id, destino: destino.id, valor: 100 });

    expect(comDescricao.resposta.data.descricao).toBe('Aluguel');
    expect(semDescricao.resposta.data.descricao).toBeNull();
  });

  test('[CT-TRF-04] consulta a transferência criada em GET /transferencias/:id', async () => {
    const origem = await criarContaComSaldo(1000);
    const destino = await criarConta();
    const { resposta: criada } = await transferir({ origem: origem.id, destino: destino.id, valor: 300 });

    const api = await apiAutenticada();
    const resposta = await api.get(`/transferencias/${criada.data.id}`);

    expect(resposta.status).toBe(200);
    expect(resposta.data).toEqual(criada.data);
  });
});

describe('Transferências — regras de negócio', () => {
  test('[CT-TRF-05] saldo insuficiente retorna 422 e não altera nenhum saldo', async () => {
    const origem = await criarContaComSaldo(1000);
    const destino = await criarConta();

    const { resposta } = await transferir({ origem: origem.id, destino: destino.id, valor: 1001 });

    expect(resposta.status).toBe(422);
    expect(resposta.data.erro.codigo).toBe('SALDO_INSUFICIENTE');
    expect(await consultarSaldo(origem.id)).toBe(1000);
    expect(await consultarSaldo(destino.id)).toBe(0);
  });

  test('[CT-TRF-06] conta de origem sem saldo nenhum retorna 422', async () => {
    const origem = await criarConta();
    const destino = await criarConta();
    const { resposta } = await transferir({ origem: origem.id, destino: destino.id, valor: 1 });
    expect(resposta.status).toBe(422);
  });

  test('[CT-TRF-07] origem e destino iguais retorna 422 CONTAS_IGUAIS', async () => {
    const conta = await criarContaComSaldo(1000);
    const { resposta } = await transferir({ origem: conta.id, destino: conta.id, valor: 100 });

    expect(resposta.status).toBe(422);
    expect(resposta.data.erro.codigo).toBe('CONTAS_IGUAIS');
  });

  test('[CT-TRF-08] origem e destino iguais com letras maiúsculas/minúsculas diferentes também é recusado', async () => {
    const conta = await criarContaComSaldo(1000);
    const { resposta } = await transferir({ origem: conta.id, destino: conta.id.toUpperCase(), valor: 100 });
    expect(resposta.data.erro?.codigo).toBe('CONTAS_IGUAIS');
  });

  test.each([
    ['origem', (contaReal) => ({ origem: UUID_INEXISTENTE, destino: contaReal }), 'Conta de origem'],
    ['destino', (contaReal) => ({ origem: contaReal, destino: UUID_INEXISTENTE }), 'Conta de destino'],
  ])('[CT-TRF-09] conta de %s inexistente retorna 404 com mensagem específica', async (_caso, montar, texto) => {
    const conta = await criarContaComSaldo(1000);
    const { resposta } = await transferir({ ...montar(conta.id), valor: 100 });

    expect(resposta.status).toBe(404);
    expect(resposta.data.erro.mensagem).toContain(texto);
    expect(await consultarSaldo(conta.id)).toBe(1000);
  });
});

describe('Transferências — validação de entrada', () => {
  let origem;
  let destino;
  beforeAll(async () => {
    origem = await criarContaComSaldo(2_000_000);
    destino = await criarConta();
  });

  // Análise de valor-limite: valor entre 1 centavo e R$ 10.000,00 (1.000.000 centavos)
  test.each([
    [0, 400],
    [1, 201],
    [1_000_000, 201],
    [1_000_001, 400],
  ])('[CT-TRF-10] valor-limite: %i centavos → %i', async (valor, statusEsperado) => {
    const { resposta } = await transferir({ origem: origem.id, destino: destino.id, valor });
    expect(resposta.status).toBe(statusEsperado);
  });

  // Partição de equivalência: tipos e formatos inválidos para "valor"
  test.each([
    ['negativo', -100],
    ['decimal (reais em vez de centavos)', 10.5],
    ['texto', '100'],
    ['nulo', null],
    ['booleano', true],
  ])('[CT-TRF-11] recusa valor %s com 400', async (_caso, valor) => {
    const { resposta } = await transferir({ origem: origem.id, destino: destino.id, valor });

    expect(resposta.status).toBe(400);
    expect(resposta.data.erro.detalhes).toEqual([expect.objectContaining({ campo: 'valor' })]);
  });

  test.each([
    [140, 201],
    [141, 400],
  ])('[CT-TRF-12] valor-limite da descrição: %i caracteres → %i', async (tamanho, statusEsperado) => {
    const { resposta } = await transferir({
      origem: origem.id,
      destino: destino.id,
      valor: 1,
      descricao: 'd'.repeat(tamanho),
    });
    expect(resposta.status).toBe(statusEsperado);
  });

  test('[CT-TRF-13] ids de conta fora do formato UUID retornam 400 apontando os dois campos', async () => {
    const { resposta } = await transferir({ origem: 'abc', destino: 123, valor: 100 });

    expect(resposta.status).toBe(400);
    expect(resposta.data.erro.detalhes.map((d) => d.campo)).toEqual(['conta_origem_id', 'conta_destino_id']);
  });

  test.each([
    ['ausente', undefined],
    ['vazio', ''],
    ['com espaço', 'chave com espaco'],
    ['com mais de 100 caracteres', 'k'.repeat(101)],
  ])('[CT-TRF-14] header Idempotency-Key %s retorna 400', async (_caso, chave) => {
    const api = await apiAutenticada();
    const headers = chave === undefined ? {} : { 'Idempotency-Key': chave };
    const resposta = await api.post(
      '/transferencias',
      { conta_origem_id: origem.id, conta_destino_id: destino.id, valor: 100 },
      { headers },
    );

    expect(resposta.status).toBe(400);
    expect(resposta.data.erro.detalhes[0].campo).toBe('Idempotency-Key');
  });

  test('[CT-TRF-15] GET de transferência inexistente retorna 404', async () => {
    const api = await apiAutenticada();
    const resposta = await api.get(`/transferencias/${UUID_INEXISTENTE}`);
    expect(resposta.status).toBe(404);
  });

  test('[CT-TRF-16] Idempotency-Key com exatamente 100 caracteres é aceita', async () => {
    const chave = novaChave().padEnd(100, 'x');
    const { resposta } = await transferir({ origem: origem.id, destino: destino.id, valor: 1, chave });
    expect(resposta.status).toBe(201);
  });
});
