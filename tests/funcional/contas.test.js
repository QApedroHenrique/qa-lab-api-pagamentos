const { apiAutenticada } = require('../helpers/api');
const { gerarCpf, gerarCpfInvalido, criarConta } = require('../helpers/fabricas');

describe('Contas — POST /contas', () => {
  let api;
  beforeAll(async () => {
    api = await apiAutenticada();
  });

  test('[CT-CON-01] cria conta com saldo zero, header Location e CPF mascarado', async () => {
    const documento = gerarCpf();
    const resposta = await api.post('/contas', { nome: 'Maria Fictícia', documento });

    expect(resposta.status).toBe(201);
    expect(resposta.data).toSeguirContrato('Conta');
    expect(resposta.data.saldo).toBe(0);
    expect(resposta.headers.location).toBe(`/contas/${resposta.data.id}`);
    expect(resposta.data.documento_mascarado).toBe(`***.${documento.slice(3, 6)}.${documento.slice(6, 9)}-**`);
  });

  test('[CT-CON-02] remove espaços extras do início e do fim do nome', async () => {
    const resposta = await api.post('/contas', { nome: '   João Exemplo   ', documento: gerarCpf() });

    expect(resposta.status).toBe(201);
    expect(resposta.data.nome).toBe('João Exemplo');
  });

  // Análise de valor-limite: nome deve ter de 3 a 100 caracteres
  test.each([
    [2, 400],
    [3, 201],
    [100, 201],
    [101, 400],
  ])('[CT-CON-03] valor-limite do nome: %i caracteres → %i', async (tamanho, statusEsperado) => {
    const resposta = await api.post('/contas', { nome: 'a'.repeat(tamanho), documento: gerarCpf() });
    expect(resposta.status).toBe(statusEsperado);
  });

  // Partição de equivalência para o documento (CPF)
  test.each([
    ['dígito verificador errado', () => gerarCpfInvalido()],
    ['todos os dígitos iguais', () => '11111111111'],
    ['com pontuação', () => {
      const cpf = gerarCpf();
      return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
    }],
    ['com 10 dígitos', () => gerarCpf().slice(0, 10)],
    ['com letras', () => '1234567890a'],
    ['como número em vez de texto', () => Number(gerarCpf().replace(/^0/, '1'))],
    ['ausente', () => undefined],
  ])('[CT-CON-04] recusa documento %s com 400', async (_caso, gerarDocumento) => {
    const resposta = await api.post('/contas', { nome: 'Teste Documento', documento: gerarDocumento() });

    expect(resposta.status).toBe(400);
    expect(resposta.data.erro.detalhes).toEqual([
      expect.objectContaining({ campo: 'documento' }),
    ]);
  });

  test('[CT-CON-05] não permite duas contas com o mesmo CPF (409)', async () => {
    const documento = gerarCpf();
    await criarConta({ documento });

    const resposta = await api.post('/contas', { nome: 'Outra Pessoa', documento });

    expect(resposta.status).toBe(409);
    expect(resposta.data.erro.codigo).toBe('DOCUMENTO_JA_CADASTRADO');
  });

  test('[CT-CON-06] retorna todos os erros de validação de uma vez', async () => {
    const resposta = await api.post('/contas', { nome: 'x', documento: '123' });

    expect(resposta.status).toBe(400);
    expect(resposta.data.erro.detalhes.map((d) => d.campo).sort()).toEqual(['documento', 'nome']);
  });

  test('[CT-CON-07] JSON mal formado retorna 400 JSON_INVALIDO', async () => {
    const resposta = await api.post('/contas', '{"nome": "sem fechar"', {
      transformRequest: [(dados) => dados],
    });

    expect(resposta.status).toBe(400);
    expect(resposta.data.erro.codigo).toBe('JSON_INVALIDO');
  });

  test('[CT-CON-08] corpo como lista em vez de objeto retorna 400', async () => {
    const resposta = await api.post('/contas', [{ nome: 'Lista', documento: gerarCpf() }]);
    expect(resposta.status).toBe(400);
  });
});

describe('Contas — GET /contas/:id', () => {
  let api;
  beforeAll(async () => {
    api = await apiAutenticada();
  });

  test('[CT-CON-09] consulta uma conta existente', async () => {
    const conta = await criarConta();
    const resposta = await api.get(`/contas/${conta.id}`);

    expect(resposta.status).toBe(200);
    expect(resposta.data).toSeguirContrato('Conta');
    expect(resposta.data).toEqual(conta);
  });

  test('[CT-CON-10] UUID válido mas inexistente retorna 404', async () => {
    const resposta = await api.get('/contas/2b1f7c9e-4d3a-4f6b-9c8d-1a2b3c4d5e6f');

    expect(resposta.status).toBe(404);
    expect(resposta.data.erro.codigo).toBe('NAO_ENCONTRADO');
  });

  test.each(['123', 'nao-e-uuid', '2b1f7c9e-4d3a-4f6b-9c8d'])(
    '[CT-CON-11] id "%s" (fora do formato UUID) retorna 400 ID_INVALIDO',
    async (id) => {
      const resposta = await api.get(`/contas/${id}`);

      expect(resposta.status).toBe(400);
      expect(resposta.data.erro.codigo).toBe('ID_INVALIDO');
    },
  );
});
