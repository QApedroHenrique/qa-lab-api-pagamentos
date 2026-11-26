const crypto = require('crypto');
const db = require('../helpers/db');
const { apiPublica } = require('../helpers/api');
const { assinar } = require('../helpers/assinatura');
const ambiente = require('../helpers/ambiente');
const { criarConta, enviarPix, consultarSaldo } = require('../helpers/fabricas');

afterAll(() => db.fechar());

const agora = () => Math.floor(Date.now() / 1000);

describe('Webhook de entrada — POST /webhooks/pix (processamento)', () => {
  test('[CT-PIX-01] PIX com assinatura válida credita a conta', async () => {
    const conta = await criarConta();
    const { resposta, eventoId } = await enviarPix({ contaId: conta.id, valor: 25000 });

    expect(resposta.status).toBe(200);
    expect(resposta.data).toSeguirContrato('RespostaPix');
    expect(resposta.data).toEqual({ evento_id: eventoId, status: 'PROCESSADO' });
    expect(await consultarSaldo(conta.id)).toBe(25000);
  });

  test('[CT-PIX-02] reenvio do MESMO evento responde JA_PROCESSADO e não credita de novo', async () => {
    const conta = await criarConta();
    const eventoId = `pix-${crypto.randomUUID()}`;

    await enviarPix({ contaId: conta.id, valor: 1000, eventoId });
    const reenvio = await enviarPix({ contaId: conta.id, valor: 1000, eventoId });

    expect(reenvio.resposta.status).toBe(200);
    expect(reenvio.resposta.data.status).toBe('JA_PROCESSADO');
    expect(await consultarSaldo(conta.id)).toBe(1000);

    const [{ quantidade }] = await db.consultar(
      `SELECT COUNT(*)::int AS quantidade FROM lancamentos WHERE referencia_id = $1`,
      [eventoId],
    );
    expect(quantidade).toBe(1);
  });

  test('[CT-PIX-03] vários PIX diferentes na mesma conta são somados', async () => {
    const conta = await criarConta();
    await enviarPix({ contaId: conta.id, valor: 100 });
    await enviarPix({ contaId: conta.id, valor: 250 });
    await enviarPix({ contaId: conta.id, valor: 650 });

    expect(await consultarSaldo(conta.id)).toBe(1000);
  });

  test('[CT-PIX-04] PIX para conta inexistente retorna 404 e o evento não é registrado', async () => {
    const eventoId = `pix-${crypto.randomUUID()}`;
    const { resposta } = await enviarPix({
      contaId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
      valor: 100,
      eventoId,
    });

    expect(resposta.status).toBe(404);
    const registros = await db.consultar('SELECT 1 FROM eventos_pix_recebidos WHERE evento_id = $1', [eventoId]);
    expect(registros).toHaveLength(0);
  });

  test.each([
    ['valor zero', { valor: 0 }, 'valor'],
    ['valor decimal', { valor: 10.5 }, 'valor'],
    ['tipo de evento desconhecido', { tipo: 'pix.devolvido' }, 'tipo'],
    ['sem evento_id', { evento_id: undefined }, 'evento_id'],
    ['conta_id inválido', { conta_id: 'abc' }, 'conta_id'],
  ])('[CT-PIX-05] payload com %s retorna 400', async (_caso, alteracao, campo) => {
    const conta = await criarConta();
    const corpo = { evento_id: `pix-${crypto.randomUUID()}`, tipo: 'pix.recebido', conta_id: conta.id, valor: 100, ...alteracao };
    const { resposta } = await enviarPix({ corpo });

    expect(resposta.status).toBe(400);
    expect(resposta.data.erro.detalhes.map((d) => d.campo)).toContain(campo);
  });
});

describe('Webhook de entrada — POST /webhooks/pix (segurança da assinatura HMAC)', () => {
  let conta;
  let corpoBruto;
  beforeEach(async () => {
    conta = await criarConta();
    corpoBruto = JSON.stringify({
      evento_id: `pix-${crypto.randomUUID()}`,
      tipo: 'pix.recebido',
      conta_id: conta.id,
      valor: 5000,
    });
  });

  async function postar(headers, corpo = corpoBruto) {
    return apiPublica(headers).post('/webhooks/pix', corpo);
  }

  test('[CT-PIX-06] sem header X-Assinatura retorna 401 e não credita', async () => {
    const resposta = await postar({});

    expect(resposta.status).toBe(401);
    expect(resposta.data.erro.codigo).toBe('ASSINATURA_INVALIDA');
    expect(await consultarSaldo(conta.id)).toBe(0);
  });

  test('[CT-PIX-07] assinatura gerada com segredo errado retorna 401', async () => {
    const resposta = await postar({ 'X-Assinatura': assinar('segredo-errado', corpoBruto) });
    expect(resposta.status).toBe(401);
    expect(resposta.data.erro.mensagem).toMatch(/não confere/);
  });

  test('[CT-PIX-08] corpo alterado depois de assinado (ex.: valor inflado) retorna 401', async () => {
    const header = assinar(ambiente.pixWebhookSecret, corpoBruto);
    const corpoAdulterado = corpoBruto.replace('"valor":5000', '"valor":500000');

    const resposta = await postar({ 'X-Assinatura': header }, corpoAdulterado);

    expect(resposta.status).toBe(401);
    expect(await consultarSaldo(conta.id)).toBe(0);
  });

  test('[CT-PIX-09] assinatura com mais de 5 minutos é recusada (proteção contra replay)', async () => {
    const header = assinar(ambiente.pixWebhookSecret, corpoBruto, agora() - 301);
    const resposta = await postar({ 'X-Assinatura': header });

    expect(resposta.status).toBe(401);
    expect(resposta.data.erro.mensagem).toMatch(/expirada/);
  });

  test('[CT-PIX-10] assinatura dentro da janela de tolerância (4 min atrás) é aceita', async () => {
    const header = assinar(ambiente.pixWebhookSecret, corpoBruto, agora() - 240);
    const resposta = await postar({ 'X-Assinatura': header });
    expect(resposta.status).toBe(200);
  });

  test('[CT-PIX-11] assinatura com timestamp no futuro além da tolerância é recusada', async () => {
    const header = assinar(ambiente.pixWebhookSecret, corpoBruto, agora() + 600);
    const resposta = await postar({ 'X-Assinatura': header });
    expect(resposta.status).toBe(401);
  });

  test.each([
    ['sem o timestamp', (h) => h.replace(/^t=\d+,/, '')],
    ['sem o hash', (h) => h.replace(/,v1=.*/, '')],
    ['hash truncado', (h) => h.slice(0, -2)],
    ['texto qualquer', () => 'assinatura-qualquer'],
  ])('[CT-PIX-12] header X-Assinatura %s retorna 401', async (_caso, mutar) => {
    const header = mutar(assinar(ambiente.pixWebhookSecret, corpoBruto));
    const resposta = await postar({ 'X-Assinatura': header });
    expect(resposta.status).toBe(401);
  });

  test('[CT-PIX-13] a assinatura é validada ANTES do payload (corpo inválido sem assinatura → 401, não 400)', async () => {
    const resposta = await postar({}, JSON.stringify({ qualquer: 'coisa' }));
    expect(resposta.status).toBe(401);
  });
});
