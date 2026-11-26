/**
 * Junta os resultados do Jest e do Newman e gera:
 *  - reports/index.html  → página inicial dos relatórios (publicada no GitHub Pages)
 *  - resumo no GitHub Actions (quando a variável GITHUB_STEP_SUMMARY existe)
 */
const fs = require('fs');
const path = require('path');

const pastaRelatorios = path.join(__dirname, '..', 'reports');

function lerJson(caminho) {
  try {
    return JSON.parse(fs.readFileSync(path.join(pastaRelatorios, caminho), 'utf8'));
  } catch {
    return null;
  }
}

const jest = lerJson('jest/resultado.json');
const newman = lerJson('newman/resultado.json');

const resumoJest = jest && {
  suites: jest.numTotalTestSuites,
  total: jest.numTotalTests,
  passaram: jest.numPassedTests,
  falharam: jest.numFailedTests,
  duracaoSeg: ((Date.now() - jest.startTime) / 1000).toFixed(1),
};

const resumoNewman = newman && {
  requisicoes: newman.run.stats.requests.total,
  assercoes: newman.run.stats.assertions.total,
  falharam: newman.run.stats.assertions.failed,
  tempoMedioMs: Math.round(newman.run.timings.responseAverage),
};

const tudoPassou = (resumoJest?.falharam ?? 1) === 0 && (resumoNewman?.falharam ?? 1) === 0;
const data = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const commit = (process.env.GITHUB_SHA || 'local').slice(0, 7);

/* --------------------------- Resumo do GitHub Actions --------------------------- */
if (process.env.GITHUB_STEP_SUMMARY) {
  const linhas = [
    `## ${tudoPassou ? '✅' : '❌'} Resultado dos testes`,
    '',
    '| Suíte | Executados | Passaram | Falharam |',
    '|---|---:|---:|---:|',
    resumoJest
      ? `| Jest (API, contrato, segurança, concorrência, SQL) | ${resumoJest.total} testes | ${resumoJest.passaram} | ${resumoJest.falharam} |`
      : '| Jest | — | — | não executado |',
    resumoNewman
      ? `| Newman (regressão encadeada Postman) | ${resumoNewman.requisicoes} requisições / ${resumoNewman.assercoes} asserções | ${resumoNewman.assercoes - resumoNewman.falharam} | ${resumoNewman.falharam} |`
      : '| Newman | — | — | não executado |',
    '',
    'Os relatórios HTML completos estão nos artefatos desta execução.',
  ];
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${linhas.join('\n')}\n`);
}

/* ---------------------------- Página inicial (HTML) ---------------------------- */
const cartao = (titulo, numeros, link, descricao) => `
    <a class="cartao" href="${link}">
      <h2>${titulo}</h2>
      <p class="descricao">${descricao}</p>
      <div class="numeros">${numeros}</div>
      <span class="abrir">Abrir relatório completo →</span>
    </a>`;

const numero = (valor, rotulo, classe = '') =>
  `<div class="numero ${classe}"><strong>${valor}</strong><span>${rotulo}</span></div>`;

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Relatórios de teste — QA Lab API de Pagamentos</title>
  <style>
    :root { --fundo:#f6f7f9; --texto:#1d2430; --suave:#5b6573; --borda:#e2e5ea; --ok:#13795b; --erro:#b42318; --destaque:#2454d6; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background:var(--fundo); color:var(--texto); }
    main { max-width: 920px; margin: 0 auto; padding: 48px 20px; }
    .selo { display:inline-block; padding:4px 12px; border-radius:999px; font-weight:600; font-size:14px;
            background:${tudoPassou ? '#e3f4ec' : '#fde8e6'}; color:${tudoPassou ? 'var(--ok)' : 'var(--erro)'}; }
    h1 { margin: 12px 0 6px; font-size: 28px; }
    .meta { color: var(--suave); margin: 0 0 32px; }
    .grade { display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
    .cartao { display:block; background:#fff; border:1px solid var(--borda); border-radius:14px; padding:24px;
              text-decoration:none; color:inherit; transition: box-shadow .15s, transform .15s; }
    .cartao:hover { box-shadow: 0 6px 20px rgba(0,0,0,.08); transform: translateY(-2px); }
    .cartao h2 { margin:0 0 6px; font-size:19px; }
    .descricao { margin:0 0 18px; color:var(--suave); font-size:14px; line-height:1.5; }
    .numeros { display:flex; gap:20px; margin-bottom:18px; }
    .numero strong { display:block; font-size:26px; }
    .numero span { font-size:13px; color:var(--suave); }
    .numero.ok strong { color: var(--ok); }
    .numero.erro strong { color: var(--erro); }
    .abrir { color: var(--destaque); font-weight:600; font-size:14px; }
    footer { margin-top:40px; color:var(--suave); font-size:13px; }
    footer a { color: var(--destaque); }
  </style>
</head>
<body>
  <main>
    <span class="selo">${tudoPassou ? '✔ Todos os testes passaram' : '✖ Há testes falhando'}</span>
    <h1>QA Lab — API de Pagamentos</h1>
    <p class="meta">Execução de ${data} · commit ${commit}</p>
    <div class="grade">
      ${
        resumoJest
          ? cartao(
              'Suíte automatizada (Jest)',
              numero(resumoJest.total, 'testes') +
                numero(resumoJest.passaram, 'passaram', 'ok') +
                numero(resumoJest.falharam, 'falharam', resumoJest.falharam ? 'erro' : ''),
              'jest/index.html',
              'Testes funcionais, de contrato (OpenAPI), segurança, concorrência e consistência de dados via SQL.',
            )
          : ''
      }
      ${
        resumoNewman
          ? cartao(
              'Regressão encadeada (Postman/Newman)',
              numero(resumoNewman.requisicoes, 'requisições') +
                numero(resumoNewman.assercoes, 'asserções') +
                numero(resumoNewman.falharam, 'falharam', resumoNewman.falharam ? 'erro' : 'ok'),
              'newman/index.html',
              'Fluxo ponta a ponta: token → contas → PIX → transferência → estorno → extrato.',
            )
          : ''
      }
    </div>
    <footer>
      Projeto de portfólio com dados 100% fictícios · por Pedro Henrique Barbosa dos Santos ·
      <a href="https://www.linkedin.com/in/pedro-henrique-996aa7355/">LinkedIn</a>
    </footer>
  </main>
</body>
</html>
`;

fs.mkdirSync(pastaRelatorios, { recursive: true });
fs.writeFileSync(path.join(pastaRelatorios, 'index.html'), html);
console.log(`Página de relatórios gerada em reports/index.html (${tudoPassou ? 'tudo passou' : 'há falhas'}).`);
