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

describe('Segurança — configuração de produção (RN-15)', () => {
  const path = require('path');
  const { spawn } = require('child_process');
  const SERVIDOR = path.join(__dirname, '..', '..', 'src', 'server.js');

  /**
   * Sobe a API como um PROCESSO separado (como no Docker) e devolve o que aconteceu:
   * { iniciou, codigoSaida, saida }. Se ela iniciar, o processo é encerrado logo em seguida.
   */
  function executarApi(variaveis) {
    return new Promise((resolve, reject) => {
      const processo = spawn(process.execPath, [SERVIDOR], {
        env: { ...process.env, PORT: '0', ...variaveis },
      });
      let saida = '';
      let iniciou = false;
      const limite = setTimeout(() => {
        processo.kill();
        reject(new Error(`A API não iniciou nem encerrou a tempo. Saída:\n${saida}`));
      }, 15000);
      const ler = (parte) => {
        saida += parte;
        if (!iniciou && /rodando em/.test(saida)) {
          iniciou = true;
          processo.kill();
        }
      };
      processo.stdout.on('data', ler);
      processo.stderr.on('data', ler);
      processo.on('exit', (codigoSaida) => {
        clearTimeout(limite);
        resolve({ iniciou, codigoSaida, saida });
      });
    });
  }

  const SEM_SEGREDOS = { JWT_SECRET: '', API_CLIENT_SECRET: '', PIX_WEBHOOK_SECRET: '' };

  test('[CT-SEG-11] em produção, sem segredos próprios, a API se recusa a iniciar', async () => {
    const semNenhum = await executarApi({ NODE_ENV: 'production', ...SEM_SEGREDOS });
    const comPadraoPublico = await executarApi({
      NODE_ENV: 'production',
      JWT_SECRET: 'jwt-segredo-local', // valor que está no repositório = não é segredo
      API_CLIENT_SECRET: 'segredo-proprio-1',
      PIX_WEBHOOK_SECRET: 'segredo-proprio-2',
    });

    expect(semNenhum.iniciou).toBe(false);
    expect(semNenhum.codigoSaida).toBe(1);
    for (const variavel of ['JWT_SECRET', 'API_CLIENT_SECRET', 'PIX_WEBHOOK_SECRET']) {
      expect(semNenhum.saida).toContain(variavel);
    }

    expect(comPadraoPublico.iniciou).toBe(false);
    expect(comPadraoPublico.codigoSaida).toBe(1);
    expect(comPadraoPublico.saida).toContain('JWT_SECRET');
    expect(comPadraoPublico.saida).not.toContain('jwt-segredo-local'); // nunca expõe o valor
  });

  test('[CT-SEG-12] em produção, com segredos próprios, a API inicia normalmente', async () => {
    const resultado = await executarApi({
      NODE_ENV: 'production',
      JWT_SECRET: 'segredo-proprio-jwt',
      API_CLIENT_SECRET: 'segredo-proprio-cliente',
      PIX_WEBHOOK_SECRET: 'segredo-proprio-pix',
    });

    expect(resultado.iniciou).toBe(true);
  });
});

describe('Segurança — SSRF no cadastro de webhook (RN-16)', () => {
  test.each([
    ['localhost', 'http://localhost:8080/webhook'],
    ['subdomínio de localhost', 'http://api.localhost/webhook'],
    ['metadados da nuvem', 'http://169.254.169.254/latest/meta-data/'],
    ['rede privada 10.x', 'http://10.0.0.5/webhook'],
    ['rede privada 172.16.x', 'https://172.16.10.1/webhook'],
    ['rede privada 192.168.x', 'http://192.168.0.10/webhook'],
    ['0.0.0.0', 'http://0.0.0.0:3000/webhook'],
    ['loopback IPv6', 'http://[::1]:3000/webhook'],
    ['loopback em IPv4 mapeado em IPv6', 'http://[::ffff:127.0.0.2]/webhook'],
    ['loopback escrito como número decimal', 'http://2130706434/webhook'],
  ])('[CT-SEG-13] URL de webhook para %s é recusada (400)', async (_caso, url) => {
    const api = await apiAutenticada();
    const resposta = await api.post('/webhooks/assinaturas', { url, eventos: ['transferencia.concluida'] });

    expect(resposta.status).toBe(400);
    expect(resposta.data.erro.codigo).toBe('DADOS_INVALIDOS');
    expect(resposta.data.erro.detalhes).toEqual([
      { campo: 'url', mensagem: expect.stringMatching(/rede interna/) },
    ]);
  });
});
