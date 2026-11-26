const db = require('../helpers/db');
const { apiAutenticada, apiPublica } = require('../helpers/api');
const { gerarCpf, criarContaComSaldo, criarConta, transferir } = require('../helpers/fabricas');

afterAll(() => db.fechar());

const ID = '3c2b1a09-8f7e-4d6c-9b5a-4f3e2d1c0b9a';

describe('Segurança — controle de acesso', () => {
  test.each([
    ['POST', '/contas'],
    ['GET', `/contas/${ID}`],
    ['GET', `/contas/${ID}/extrato`],
    ['POST', '/transferencias'],
    ['GET', `/transferencias/${ID}`],
    ['POST', `/transferencias/${ID}/estorno`],
    ['POST', '/webhooks/assinaturas'],
    ['DELETE', `/webhooks/assinaturas/${ID}`],
    ['GET', `/webhooks/assinaturas/${ID}/entregas`],
  ])('[CT-SEG-01] %s %s exige token (401 sem Authorization)', async (metodo, rota) => {
    const resposta = await apiPublica().request({ method: metodo, url: rota, data: {} });

    expect(resposta.status).toBe(401);
    expect(resposta.data.erro.codigo).toBe('NAO_AUTENTICADO');
  });
});

describe('Segurança — proteção de dados (LGPD)', () => {
  test('[CT-SEG-02] o CPF completo nunca aparece em nenhuma resposta', async () => {
    const api = await apiAutenticada();
    const documento = gerarCpf();
    const criada = await api.post('/contas', { nome: 'Pessoa Privada', documento });
    await criarContaComSaldo(0);

    const respostas = [
      criada,
      await api.get(`/contas/${criada.data.id}`),
      await api.get(`/contas/${criada.data.id}/extrato`),
      await api.post('/contas', { nome: 'Duplicada', documento }), // erro 409 também não pode vazar
    ];

    for (const resposta of respostas) {
      expect(JSON.stringify(resposta.data)).not.toContain(documento);
    }
  });

  test('[CT-SEG-03] o contrato da Conta recusa campos extras (pegaria um vazamento do campo "documento")', () => {
    const contaComVazamento = {
      id: ID,
      nome: 'Teste',
      documento_mascarado: '***.123.456-**',
      saldo: 0,
      criada_em: new Date().toISOString(),
      documento: '12345678909',
    };
    expect(contaComVazamento).not.toSeguirContrato('Conta');
  });
});

describe('Segurança — entradas maliciosas', () => {
  test('[CT-SEG-04] texto com SQL injection no nome é gravado como texto e não executa nada', async () => {
    const api = await apiAutenticada();
    const nomeMalicioso = "Robert'); DROP TABLE contas;--";

    const resposta = await api.post('/contas', { nome: nomeMalicioso, documento: gerarCpf() });

    expect(resposta.status).toBe(201);
    expect(resposta.data.nome).toBe(nomeMalicioso);
    const [{ existe }] = await db.consultar("SELECT to_regclass('public.contas') IS NOT NULL AS existe");
    expect(existe).toBe(true);
  });

  test.each(["' OR '1'='1", '1; DROP TABLE contas', '../../etc/passwd'])(
    '[CT-SEG-05] parâmetro de rota malicioso "%s" é barrado pela validação (400)',
    async (valor) => {
      const api = await apiAutenticada();
      const resposta = await api.get(`/contas/${encodeURIComponent(valor)}`);
      expect(resposta.status).toBe(400);
    },
  );

  test('[CT-SEG-06] corpo acima de 100 KB é recusado com 413', async () => {
    const api = await apiAutenticada();
    const resposta = await api.post('/contas', { nome: 'x'.repeat(150 * 1024), documento: gerarCpf() });

    expect(resposta.status).toBe(413);
    expect(resposta.data.erro.codigo).toBe('CORPO_MUITO_GRANDE');
  });

  test('[CT-SEG-07] valor gigante (acima do inteiro seguro) não quebra a API', async () => {
    const origem = await criarContaComSaldo(1000);
    const destino = await criarConta();
    const { resposta } = await transferir({ origem: origem.id, destino: destino.id, valor: Number.MAX_SAFE_INTEGER + 2 });
    expect(resposta.status).toBe(400);
  });
});

describe('Segurança — cabeçalhos e mensagens de erro', () => {
  test('[CT-SEG-08] não expõe a tecnologia do servidor (sem X-Powered-By)', async () => {
    const resposta = await apiPublica().get('/saude');
    expect(resposta.headers['x-powered-by']).toBeUndefined();
  });

  test('[CT-SEG-09] toda resposta traz X-Request-Id e propaga o valor recebido do cliente', async () => {
    const gerado = await apiPublica().get('/saude');
    const propagado = await apiPublica({ 'X-Request-Id': 'meu-rastreio-123' }).get('/saude');
    const malicioso = await apiPublica({ 'X-Request-Id': '<script>alert(1)</script>' }).get('/saude');

    expect(gerado.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(propagado.headers['x-request-id']).toBe('meu-rastreio-123');
    expect(malicioso.headers['x-request-id']).not.toContain('<script>');
  });

  test('[CT-SEG-10] rota inexistente retorna 404 padronizado, sem stack trace', async () => {
    const resposta = await apiPublica().get('/rota/que/nao/existe');

    expect(resposta.status).toBe(404);
    expect(resposta.data.erro.codigo).toBe('ROTA_NAO_ENCONTRADA');
    expect(JSON.stringify(resposta.data)).not.toMatch(/at .*\.js|node_modules/);
  });
});
