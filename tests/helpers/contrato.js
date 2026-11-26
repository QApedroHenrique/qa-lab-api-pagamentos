const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

/**
 * Validação de CONTRATO a partir da própria especificação OpenAPI (openapi/openapi.yaml).
 * Fonte única da verdade: o que está documentado é exatamente o que é testado.
 */
const especificacao = YAML.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'openapi', 'openapi.yaml'), 'utf8'),
);

const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
addFormats(ajv);

// Converte "#/components/schemas/X" em referências diretas ao schema "X"
function reescreverRefs(no) {
  if (Array.isArray(no)) return no.map(reescreverRefs);
  if (no && typeof no === 'object') {
    return Object.fromEntries(
      Object.entries(no).map(([chave, valor]) => [
        chave,
        chave === '$ref' && typeof valor === 'string' ? valor.replace('#/components/schemas/', '') : reescreverRefs(valor),
      ]),
    );
  }
  return no;
}

for (const [nome, schema] of Object.entries(especificacao.components.schemas)) {
  ajv.addSchema({ $id: nome, ...reescreverRefs(schema) });
}

function validarContrato(nomeSchema, dados) {
  const validar = ajv.getSchema(nomeSchema);
  if (!validar) throw new Error(`Schema "${nomeSchema}" não existe em openapi.yaml`);
  const valido = validar(dados);
  return { valido, erros: valido ? [] : validar.errors };
}

module.exports = { validarContrato, especificacao };
