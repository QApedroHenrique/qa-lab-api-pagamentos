const { apiAutenticada } = require('../helpers/api');
const { criarConta, criarContaComSaldo, enviarPix, transferir } = require('../helpers/fabricas');

describe('Extrato — GET /contas/:id/extrato', () => {
  let api;
  beforeAll(async () => {
    api = await apiAutenticada();
  });

  test('[CT-EXT-01] conta nova tem extrato vazio e saldo zero', async () => {
    const conta = await criarConta();
    const resposta = await api.get(`/contas/${conta.id}/extrato`);

    expect(resposta.status).toBe(200);
    expect(resposta.data).toSeguirContrato('Extrato');
    expect(resposta.data).toEqual({ conta_id: conta.id, saldo: 0, lancamentos: [] });
  });

  test('[CT-EXT-02] registra PIX, envio e recebimento de transferência, do mais recente para o mais antigo', async () => {
    const origem = await criarContaComSaldo(10000);
    const destino = await criarConta();
    const { resposta: trf } = await transferir({ origem: origem.id, destino: destino.id, valor: 2500 });

    const extratoOrigem = (await api.get(`/contas/${origem.id}/extrato`)).data;
    const extratoDestino = (await api.get(`/contas/${destino.id}/extrato`)).data;

    expect(extratoOrigem.saldo).toBe(7500);
    expect(extratoOrigem.lancamentos.map((l) => [l.tipo, l.origem, l.valor])).toEqual([
      ['DEBITO', 'TRANSFERENCIA', 2500],
      ['CREDITO', 'PIX_RECEBIDO', 10000],
    ]);
    expect(extratoOrigem.lancamentos[0].referencia_id).toBe(trf.data.id);

    expect(extratoDestino.saldo).toBe(2500);
    expect(extratoDestino.lancamentos).toEqual([
      expect.objectContaining({ tipo: 'CREDITO', origem: 'TRANSFERENCIA', valor: 2500, referencia_id: trf.data.id }),
    ]);
  });

  test('[CT-EXT-03] o parâmetro limite restringe a quantidade de lançamentos', async () => {
    const conta = await criarConta();
    for (let i = 1; i <= 3; i += 1) await enviarPix({ contaId: conta.id, valor: i * 100 });

    const resposta = await api.get(`/contas/${conta.id}/extrato`, { params: { limite: 2 } });

    expect(resposta.status).toBe(200);
    expect(resposta.data.lancamentos.map((l) => l.valor)).toEqual([300, 200]);
    expect(resposta.data.saldo).toBe(600);
  });

  // Valor-limite do parâmetro "limite" (1 a 100)
  test.each([
    ['0', 400],
    ['1', 200],
    ['100', 200],
    ['101', 400],
    ['-1', 400],
    ['2.5', 400],
    ['abc', 400],
  ])('[CT-EXT-04] limite=%s → %i', async (limite, statusEsperado) => {
    const conta = await criarConta();
    const resposta = await api.get(`/contas/${conta.id}/extrato?limite=${limite}`);
    expect(resposta.status).toBe(statusEsperado);
  });

  test('[CT-EXT-05] extrato de conta inexistente retorna 404', async () => {
    const resposta = await api.get('/contas/7d0b5c1e-2f4a-4b6c-8d9e-0a1b2c3d4e5f/extrato');
    expect(resposta.status).toBe(404);
  });
});
