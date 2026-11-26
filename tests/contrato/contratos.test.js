const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const { apiAutenticada, apiPublica } = require('../helpers/api');
const { especificacao } = require('../helpers/contrato');
const { criarConta, criarContaComSaldo, transferir, gerarCpf } = require('../helpers/fabricas');

const ID = '6f5e4d3c-2b1a-4098-8f7e-6d5c4b3a2f1e';

describe('Contrato — respostas de erro seguem o formato padrão', () => {
  let api;
  let contaComSaldo;
  let contaSemSaldo;
  beforeAll(async () => {
    api = await apiAutenticada();
    contaComSaldo = await criarContaComSaldo(1000);
    contaSemSaldo = await criarConta();
  });

  const cenarios = [
    ['400 DADOS_INVALIDOS', () => api.post('/contas', {}), 400],
    ['400 ID_INVALIDO', () => api.get('/contas/abc'), 400],
    ['401 NAO_AUTENTICADO', () => apiPublica().get(`/contas/${ID}`), 401],
    ['401 CREDENCIAIS_INVALIDAS', () => apiPublica().post('/auth/token', { client_id: 'x', client_secret: 'y' }), 401],
    ['401 ASSINATURA_INVALIDA', () => apiPublica().post('/webhooks/pix', {}), 401],
    ['404 NAO_ENCONTRADO', () => api.get(`/transferencias/${ID}`), 404],
    ['404 ROTA_NAO_ENCONTRADA', () => api.get('/nao-existe'), 404],
    ['409 DOCUMENTO_JA_CADASTRADO', async () => {
      const documento = gerarCpf();
      await api.post('/contas', { nome: 'Primeira', documento });
      return api.post('/contas', { nome: 'Segunda', documento });
    }, 409],
    ['422 SALDO_INSUFICIENTE', async () =>
      (await transferir({ origem: contaSemSaldo.id, destino: contaComSaldo.id, valor: 1 })).resposta, 422],
  ];

  test.each(cenarios)('[CT-CTR-01] %s segue o schema Erro', async (_nome, executar, statusEsperado) => {
    const resposta = await executar();

    expect(resposta.status).toBe(statusEsperado);
    expect(resposta.data).toSeguirContrato('Erro');
    expect(resposta.headers['content-type']).toMatch(/^application\/json; charset=utf-8/);
  });
});

describe('Contrato — documentação publicada', () => {
  test('[CT-CTR-02] GET /saude segue o schema Saude', async () => {
    const resposta = await apiPublica().get('/saude');

    expect(resposta.status).toBe(200);
    expect(resposta.data).toSeguirContrato('Saude');
  });

  test('[CT-CTR-03] /openapi.json publicado é idêntico ao arquivo openapi.yaml do repositório', async () => {
    const resposta = await apiPublica().get('/openapi.json');
    const arquivo = YAML.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'openapi', 'openapi.yaml'), 'utf8'));

    expect(resposta.status).toBe(200);
    expect(resposta.data).toEqual(arquivo);
  });

  test('[CT-CTR-04] a documentação interativa (Swagger UI) está no ar em /docs', async () => {
    const resposta = await apiPublica().get('/docs/');

    expect(resposta.status).toBe(200);
    expect(resposta.headers['content-type']).toMatch(/text\/html/);
    expect(resposta.data).toContain('swagger-ui');
  });

  test('[CT-CTR-05] todo schema referenciado na especificação existe', () => {
    const referencias = JSON.stringify(especificacao).match(/#\/components\/schemas\/\w+/g) || [];
    const inexistentes = [...new Set(referencias)]
      .map((ref) => ref.split('/').pop())
      .filter((nome) => !especificacao.components.schemas[nome]);

    expect(inexistentes).toEqual([]);
  });
});
