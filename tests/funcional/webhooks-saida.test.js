const { apiAutenticada } = require('../helpers/api');
const { assinaturaConfere } = require('../helpers/assinatura');
const { ReceptorWebhook } = require('../helpers/receptor-webhook');
const { criarConta, criarContaComSaldo, transferir } = require('../helpers/fabricas');

/**
 * Cada teste sobe um "sistema parceiro" falso (ReceptorWebhook), cadastra a URL dele
 * na API e verifica o que chega: payload, headers, assinatura e retentativas.
 */
describe('Webhooks de saída — notificações para parceiros', () => {
  let api;
  let receptor;
  let assinatura;

  beforeAll(async () => {
    api = await apiAutenticada();
  });

  async function cadastrar(eventos) {
    const resposta = await api.post('/webhooks/assinaturas', { url: receptor.url, eventos });
    assinatura = resposta.data;
    return resposta;
  }

  async function novaTransferencia(valor = 1000) {
    const origem = await criarContaComSaldo(10000);
    const destino = await criarConta();
    const { resposta } = await transferir({ origem: origem.id, destino: destino.id, valor });
    return resposta.data;
  }

  const doEvento = (transferenciaId, tipo) => (r) =>
    r.corpo?.tipo === tipo && r.corpo?.dados?.transferencia?.id === transferenciaId;

  beforeEach(async () => {
    receptor = await new ReceptorWebhook().iniciar();
    assinatura = undefined;
  });

  afterEach(async () => {
    if (assinatura?.id) await api.delete(`/webhooks/assinaturas/${assinatura.id}`);
    await receptor.encerrar();
  });

  test('[CT-WHK-01] cadastra assinatura e devolve o segredo usado para validar as entregas', async () => {
    const resposta = await cadastrar(['transferencia.concluida']);

    expect(resposta.status).toBe(201);
    expect(resposta.data).toSeguirContrato('AssinaturaCriada');
    expect(resposta.headers.location).toBe(`/webhooks/assinaturas/${resposta.data.id}`);
  });

  test('[CT-WHK-02] envia transferencia.concluida com payload no contrato e headers de rastreio', async () => {
    await cadastrar(['transferencia.concluida']);
    const transferencia = await novaTransferencia(1234);

    const [entrega] = await receptor.aguardar(doEvento(transferencia.id, 'transferencia.concluida'));

    expect(entrega.metodo).toBe('POST');
    expect(entrega.corpo).toSeguirContrato('EventoWebhook');
    expect(entrega.corpo.dados.transferencia).toEqual(transferencia);
    expect(entrega.headers['content-type']).toMatch(/application\/json/);
    expect(entrega.headers['x-evento-id']).toBe(entrega.corpo.id);
    expect(entrega.headers['x-evento-tipo']).toBe('transferencia.concluida');
    expect(entrega.headers['x-tentativa']).toBe('1');
  });

  test('[CT-WHK-03] a assinatura HMAC do webhook confere com o segredo recebido no cadastro', async () => {
    await cadastrar(['transferencia.concluida']);
    const transferencia = await novaTransferencia();

    const [entrega] = await receptor.aguardar(doEvento(transferencia.id, 'transferencia.concluida'));

    expect(assinaturaConfere(assinatura.segredo, entrega.corpoBruto, entrega.headers['x-assinatura'])).toBe(true);
    expect(assinaturaConfere('outro-segredo', entrega.corpoBruto, entrega.headers['x-assinatura'])).toBe(false);
  });

  test('[CT-WHK-04] envia transferencia.estornada quando há estorno', async () => {
    await cadastrar(['transferencia.estornada']);
    const transferencia = await novaTransferencia();
    await api.post(`/transferencias/${transferencia.id}/estorno`);

    const [entrega] = await receptor.aguardar(doEvento(transferencia.id, 'transferencia.estornada'));

    expect(entrega.corpo.dados.transferencia.status).toBe('ESTORNADA');
  });

  test('[CT-WHK-05] só envia os eventos que o parceiro assinou', async () => {
    await cadastrar(['transferencia.estornada']);
    const transferencia = await novaTransferencia();

    await new Promise((r) => setTimeout(r, 500));
    expect(receptor.filtrar(doEvento(transferencia.id, 'transferencia.concluida'))).toHaveLength(0);
  });

  test('[CT-WHK-06] repetição idempotente da transferência NÃO dispara um segundo webhook', async () => {
    await cadastrar(['transferencia.concluida']);
    const origem = await criarContaComSaldo(10000);
    const destino = await criarConta();
    const primeira = await transferir({ origem: origem.id, destino: destino.id, valor: 500 });
    await transferir({ origem: origem.id, destino: destino.id, valor: 500, chave: primeira.chave });

    await receptor.aguardar(doEvento(primeira.resposta.data.id, 'transferencia.concluida'));
    await new Promise((r) => setTimeout(r, 400));
    expect(receptor.filtrar(doEvento(primeira.resposta.data.id, 'transferencia.concluida'))).toHaveLength(1);
  });

  test('[CT-WHK-07] tenta de novo quando o parceiro falha (500, 503) e registra a entrega como ENTREGUE', async () => {
    await cadastrar(['transferencia.concluida']);
    receptor.programarRespostas(500, 503); // 3ª tentativa recebe o padrão (200)
    const transferencia = await novaTransferencia();

    const tentativas = await receptor.aguardar(doEvento(transferencia.id, 'transferencia.concluida'), {
      quantidade: 3,
    });
    expect(tentativas.map((t) => t.headers['x-tentativa'])).toEqual(['1', '2', '3']);
    expect(new Set(tentativas.map((t) => t.headers['x-evento-id'])).size).toBe(1); // mesmo evento

    await new Promise((r) => setTimeout(r, 200));
    const { data } = await api.get(`/webhooks/assinaturas/${assinatura.id}/entregas`);
    expect(data).toSeguirContrato('ListaEntregas');
    expect(data.entregas[0]).toMatchObject({ status: 'ENTREGUE', tentativas: 3, ultimo_status_http: 200 });
  });

  test('[CT-WHK-08] desiste após 3 tentativas e registra a entrega como FALHOU', async () => {
    await cadastrar(['transferencia.concluida']);
    receptor.responderSempre(500);
    const transferencia = await novaTransferencia();

    await receptor.aguardar(doEvento(transferencia.id, 'transferencia.concluida'), { quantidade: 3 });
    await new Promise((r) => setTimeout(r, 600));

    expect(receptor.filtrar(doEvento(transferencia.id, 'transferencia.concluida'))).toHaveLength(3);
    const { data } = await api.get(`/webhooks/assinaturas/${assinatura.id}/entregas`);
    expect(data.entregas[0]).toMatchObject({ status: 'FALHOU', tentativas: 3, ultimo_status_http: 500 });
  });

  test('[CT-WHK-09] parceiro fora do ar não afeta a transferência (entrega é assíncrona)', async () => {
    await cadastrar(['transferencia.concluida']);
    await receptor.encerrar(); // parceiro "cai" antes do evento
    receptor = await new ReceptorWebhook().iniciar(); // só para o afterEach conseguir encerrar

    const inicio = Date.now();
    const transferencia = await novaTransferencia();

    expect(transferencia.status).toBe('CONCLUIDA');
    expect(Date.now() - inicio).toBeLessThan(2000);
  });

  test('[CT-WHK-10] assinatura removida (DELETE) deixa de receber eventos', async () => {
    await cadastrar(['transferencia.concluida']);
    const remocao = await api.delete(`/webhooks/assinaturas/${assinatura.id}`);
    expect(remocao.status).toBe(204);
    const idRemovido = assinatura.id;
    assinatura = undefined;

    const transferencia = await novaTransferencia();
    await new Promise((r) => setTimeout(r, 400));

    expect(receptor.filtrar(doEvento(transferencia.id, 'transferencia.concluida'))).toHaveLength(0);
    expect((await api.delete(`/webhooks/assinaturas/${idRemovido}`)).status).toBe(404);
    expect((await api.get(`/webhooks/assinaturas/${idRemovido}/entregas`)).status).toBe(404);
  });

  test.each([
    ['URL ausente', { eventos: ['transferencia.concluida'] }, 'url'],
    ['URL com protocolo ftp', { url: 'ftp://parceiro.exemplo/webhook', eventos: ['transferencia.concluida'] }, 'url'],
    ['URL sem protocolo', { url: 'parceiro.exemplo/webhook', eventos: ['transferencia.concluida'] }, 'url'],
    ['lista de eventos vazia', { url: 'https://parceiro.exemplo/webhook', eventos: [] }, 'eventos'],
    ['evento inexistente', { url: 'https://parceiro.exemplo/webhook', eventos: ['conta.criada'] }, 'eventos'],
    ['eventos como texto', { url: 'https://parceiro.exemplo/webhook', eventos: 'transferencia.concluida' }, 'eventos'],
  ])('[CT-WHK-11] cadastro com %s retorna 400', async (_caso, corpo, campo) => {
    const resposta = await api.post('/webhooks/assinaturas', corpo);

    expect(resposta.status).toBe(400);
    expect(resposta.data.erro.detalhes.map((d) => d.campo)).toContain(campo);
  });

  test('[CT-WHK-12] eventos duplicados no cadastro são gravados uma única vez', async () => {
    const resposta = await cadastrar(['transferencia.concluida', 'transferencia.concluida']);
    expect(resposta.data.eventos).toEqual(['transferencia.concluida']);
  });
});
