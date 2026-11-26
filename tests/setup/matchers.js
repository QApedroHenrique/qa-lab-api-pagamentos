const { validarContrato } = require('../helpers/contrato');

/**
 * Matcher customizado: expect(corpo).toSeguirContrato('Conta')
 * Valida o corpo contra o schema de mesmo nome em openapi/openapi.yaml.
 */
expect.extend({
  toSeguirContrato(recebido, nomeSchema) {
    const { valido, erros } = validarContrato(nomeSchema, recebido);
    return {
      pass: valido,
      message: () =>
        valido
          ? `Esperava que o corpo NÃO seguisse o contrato "${nomeSchema}".`
          : `O corpo não segue o contrato "${nomeSchema}":\n` +
            erros.map((e) => `  • ${e.instancePath || '(raiz)'} ${e.message}`).join('\n') +
            `\n\nCorpo recebido:\n${JSON.stringify(recebido, null, 2)}`,
    };
  },
});
