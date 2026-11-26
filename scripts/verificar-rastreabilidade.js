/**
 * Verifica a RASTREABILIDADE entre testes e documentação:
 *  - todo caso de teste automatizado ([CT-XXX-NN] no nome do teste) precisa estar em docs/casos-de-teste.md;
 *  - todo caso documentado precisa existir na suíte automatizada.
 * Roda no CI: se alguém criar um teste sem documentar (ou o contrário), o pipeline falha.
 */
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const REGEX_ID = /\[(CT-[A-Z]{3}-\d{2})\]/g;

function arquivosDeTeste(pasta) {
  return fs.readdirSync(pasta, { withFileTypes: true }).flatMap((item) => {
    const caminho = path.join(pasta, item.name);
    if (item.isDirectory()) return arquivosDeTeste(caminho);
    return item.name.endsWith('.test.js') ? [caminho] : [];
  });
}

const nosTestes = new Map();
for (const arquivo of arquivosDeTeste(path.join(raiz, 'tests'))) {
  for (const [, id] of fs.readFileSync(arquivo, 'utf8').matchAll(REGEX_ID)) {
    nosTestes.set(id, path.relative(raiz, arquivo));
  }
}

const documento = fs.readFileSync(path.join(raiz, 'docs', 'casos-de-teste.md'), 'utf8');
const naDocumentacao = new Set(
  documento
    .split('\n')
    .map((linha) => /^\|\s*(CT-[A-Z]{3}-\d{2})\s*\|/.exec(linha))
    .filter(Boolean)
    .map((m) => m[1]),
);

const semDocumentacao = [...nosTestes.keys()].filter((id) => !naDocumentacao.has(id)).sort();
const semTeste = [...naDocumentacao].filter((id) => !nosTestes.has(id)).sort();

console.log(`Casos nos testes: ${nosTestes.size} | Casos documentados: ${naDocumentacao.size}`);

if (semDocumentacao.length || semTeste.length) {
  if (semDocumentacao.length) {
    console.error('\n✖ Testes sem documentação em docs/casos-de-teste.md:');
    semDocumentacao.forEach((id) => console.error(`   ${id}  (${nosTestes.get(id)})`));
  }
  if (semTeste.length) {
    console.error('\n✖ Casos documentados que não existem na suíte:');
    semTeste.forEach((id) => console.error(`   ${id}`));
  }
  process.exit(1);
}

console.log('✔ Rastreabilidade completa: todo teste está documentado e todo caso documentado está automatizado.');
