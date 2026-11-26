const jwt = require('jsonwebtoken');
const ambiente = require('../helpers/ambiente');
const { apiPublica } = require('../helpers/api');

describe('Autenticação — POST /auth/token', () => {
  const api = apiPublica();
  const credenciais = { client_id: ambiente.clientId, client_secret: ambiente.clientSecret };

  test('[CT-AUT-01] gera token Bearer com credenciais válidas', async () => {
    const resposta = await api.post('/auth/token', credenciais);

    expect(resposta.status).toBe(200);
    expect(resposta.data).toSeguirContrato('TokenResposta');
    expect(resposta.data.token_type).toBe('Bearer');
    expect(resposta.headers['cache-control']).toBe('no-store');
  });

  test('[CT-AUT-02] o token gerado expira no tempo informado em expires_in', async () => {
    const resposta = await api.post('/auth/token', credenciais);
    const { iat, exp } = jwt.decode(resposta.data.access_token);

    expect(exp - iat).toBe(resposta.data.expires_in);
  });

  test.each([
    ['client_secret incorreto', { client_id: ambiente.clientId, client_secret: 'errado' }],
    ['client_id inexistente', { client_id: 'nao-existe', client_secret: ambiente.clientSecret }],
  ])('[CT-AUT-03] recusa %s com 401 CREDENCIAIS_INVALIDAS', async (_caso, corpo) => {
    const resposta = await api.post('/auth/token', corpo);

    expect(resposta.status).toBe(401);
    expect(resposta.data).toSeguirContrato('Erro');
    expect(resposta.data.erro.codigo).toBe('CREDENCIAIS_INVALIDAS');
  });

  test.each([
    ['corpo vazio', {}, ['client_id', 'client_secret']],
    ['sem client_secret', { client_id: 'qa-lab' }, ['client_secret']],
    ['client_id numérico', { client_id: 123, client_secret: 'x' }, ['client_id']],
  ])('[CT-AUT-04] retorna 400 com %s e aponta os campos inválidos', async (_caso, corpo, camposEsperados) => {
    const resposta = await api.post('/auth/token', corpo);

    expect(resposta.status).toBe(400);
    expect(resposta.data.erro.codigo).toBe('DADOS_INVALIDOS');
    expect(resposta.data.erro.detalhes.map((d) => d.campo)).toEqual(camposEsperados);
  });
});

describe('Autenticação — acesso a rotas protegidas', () => {
  const rota = '/contas/00000000-0000-4000-8000-000000000000';

  test('[CT-AUT-05] sem header Authorization retorna 401 e WWW-Authenticate', async () => {
    const resposta = await apiPublica().get(rota);

    expect(resposta.status).toBe(401);
    expect(resposta.data.erro.codigo).toBe('NAO_AUTENTICADO');
    expect(resposta.headers['www-authenticate']).toMatch(/^Bearer/);
  });

  test.each([
    ['esquema Basic no lugar de Bearer', 'Basic cWEtbGFiOnNlZ3JlZG8='],
    ['token mal formado', 'Bearer isso-nao-e-um-jwt'],
    ['Bearer sem token', 'Bearer'],
  ])('[CT-AUT-06] recusa %s com 401', async (_caso, header) => {
    const resposta = await apiPublica({ Authorization: header }).get(rota);
    expect(resposta.status).toBe(401);
  });

  test('[CT-AUT-07] recusa token com assinatura adulterada', async () => {
    const { data } = await apiPublica().post('/auth/token', {
      client_id: ambiente.clientId,
      client_secret: ambiente.clientSecret,
    });
    const [cabecalho, payload] = data.access_token.split('.');
    const tokenAdulterado = `${cabecalho}.${payload}.assinatura-falsa`;

    const resposta = await apiPublica({ Authorization: `Bearer ${tokenAdulterado}` }).get(rota);

    expect(resposta.status).toBe(401);
    expect(resposta.data.erro.mensagem).toMatch(/inválido/);
  });

  test('[CT-AUT-08] recusa token assinado com outro segredo', async () => {
    const token = jwt.sign({ sub: ambiente.clientId }, 'segredo-de-um-atacante', { expiresIn: 60 });
    const resposta = await apiPublica({ Authorization: `Bearer ${token}` }).get(rota);
    expect(resposta.status).toBe(401);
  });

  test('[CT-AUT-09] recusa token expirado com mensagem específica', async () => {
    // Token gerado com o segredo do ambiente de teste, mas já vencido há 1 minuto
    const token = jwt.sign(
      { sub: ambiente.clientId, exp: Math.floor(Date.now() / 1000) - 60 },
      ambiente.jwtSecret,
    );
    const resposta = await apiPublica({ Authorization: `Bearer ${token}` }).get(rota);

    expect(resposta.status).toBe(401);
    expect(resposta.data.erro.mensagem).toBe('Token de acesso expirado.');
  });

  test('[CT-AUT-10] recusa token com algoritmo "none" (ataque clássico de JWT)', async () => {
    const cabecalho = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: ambiente.clientId })).toString('base64url');
    const resposta = await apiPublica({ Authorization: `Bearer ${cabecalho}.${payload}.` }).get(rota);

    expect(resposta.status).toBe(401);
  });
});
