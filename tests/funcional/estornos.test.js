const { apiAutenticada } = require('../helpers/api');
const { criarConta, criarContaComSaldo, transferir, consultarSaldo } = require('../helpers/fabricas');

async function prepararTransferencia(valor = 3000, saldoInicial = 10000) {
  const origem = await criarContaComSaldo(saldoInicial);
  const destino = await criarConta();
  const { resposta } = await transferir({ origem: origem.id, destino: destino.id, valor });
  return { origem, destino, transferencia: resposta.data };
}

describe('Estornos — POST /transferencias/:id/estorno', () => {
  let api;
  beforeAll(async () => {
    api = await apiAutenticada();
  });

  test('[CT-EST-01] estorna a transferência e devolve os saldos ao estado anterior', async () => {
    const { origem, destino, transferencia } = await prepararTransferencia(3000, 10000);

    const resposta = await api.post(`/transferencias/${transferencia.id}/estorno`);

    expect(resposta.status).toBe(200);
    expect(resposta.data).toSeguirContrato('Transferencia');
    expect(resposta.data.status).toBe('ESTORNADA');
    expect(new Date(resposta.data.estornada_em).getTime()).toBeGreaterThanOrEqual(
      new Date(transferencia.criada_em).getTime(),
    );
    expect(await consultarSaldo(origem.id)).toBe(10000);
    expect(await consultarSaldo(destino.id)).toBe(0);
  });

  test('[CT-EST-02] o estorno aparece no extrato das duas contas', async () => {
    const { origem, destino, transferencia } = await prepararTransferencia(1500);
    await api.post(`/transferencias/${transferencia.id}/estorno`);

    const extratoOrigem = (await api.get(`/contas/${origem.id}/extrato`)).data;
    const extratoDestino = (await api.get(`/contas/${destino.id}/extrato`)).data;

    expect(extratoOrigem.lancamentos[0]).toMatchObject({ tipo: 'CREDITO', origem: 'ESTORNO', valor: 1500 });
    expect(extratoDestino.lancamentos[0]).toMatchObject({ tipo: 'DEBITO', origem: 'ESTORNO', valor: 1500 });
  });

  test('[CT-EST-03] estornar de novo a mesma transferência retorna 409 e não movimenta saldo', async () => {
    const { origem, transferencia } = await prepararTransferencia(2000, 5000);
    await api.post(`/transferencias/${transferencia.id}/estorno`);

    const segunda = await api.post(`/transferencias/${transferencia.id}/estorno`);

    expect(segunda.status).toBe(409);
    expect(segunda.data.erro.codigo).toBe('TRANSFERENCIA_JA_ESTORNADA');
    expect(await consultarSaldo(origem.id)).toBe(5000);
  });

  test('[CT-EST-04] destino que já gastou o dinheiro: estorno recusado com 422', async () => {
    const { destino, transferencia } = await prepararTransferencia(3000);
    const terceiro = await criarConta();
    await transferir({ origem: destino.id, destino: terceiro.id, valor: 2000 }); // destino fica com 1000

    const resposta = await api.post(`/transferencias/${transferencia.id}/estorno`);

    expect(resposta.status).toBe(422);
    expect(resposta.data.erro.codigo).toBe('SALDO_INSUFICIENTE_PARA_ESTORNO');
    expect(await consultarSaldo(destino.id)).toBe(1000);
    expect((await api.get(`/transferencias/${transferencia.id}`)).data.status).toBe('CONCLUIDA');
  });

  test('[CT-EST-05] estorno de transferência inexistente retorna 404', async () => {
    const resposta = await api.post('/transferencias/0f1e2d3c-4b5a-4968-8776-655443322110/estorno');
    expect(resposta.status).toBe(404);
  });

  test('[CT-EST-06] estorno com id fora do formato UUID retorna 400', async () => {
    const resposta = await api.post('/transferencias/123/estorno');
    expect(resposta.status).toBe(400);
  });

  test('[CT-EST-07] repetir a requisição original depois do estorno devolve a resposta original, sem nova cobrança', async () => {
    // Comportamento documentado: a chave de idempotência guarda a resposta da CRIAÇÃO.
    const origem = await criarContaComSaldo(10000);
    const destino = await criarConta();
    const original = await transferir({ origem: origem.id, destino: destino.id, valor: 1000 });
    await api.post(`/transferencias/${original.resposta.data.id}/estorno`);

    const repeticao = await transferir({ origem: origem.id, destino: destino.id, valor: 1000, chave: original.chave });

    expect(repeticao.resposta.status).toBe(201);
    expect(repeticao.resposta.data.id).toBe(original.resposta.data.id);
    expect(await consultarSaldo(origem.id)).toBe(10000);
  });
});
