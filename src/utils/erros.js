/**
 * Erro de negócio/validação com status HTTP e código padronizado.
 * Formato da resposta: { "erro": { "codigo": "...", "mensagem": "...", "detalhes": [...] } }
 */
class ErroApi extends Error {
  constructor(status, codigo, mensagem, detalhes) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.detalhes = detalhes;
  }

  paraJson() {
    const corpo = { erro: { codigo: this.codigo, mensagem: this.message } };
    if (this.detalhes && this.detalhes.length) corpo.erro.detalhes = this.detalhes;
    return corpo;
  }
}

const erros = {
  validacao: (detalhes) =>
    new ErroApi(400, 'DADOS_INVALIDOS', 'Um ou mais campos são inválidos.', detalhes),
  idInvalido: (campo = 'id') =>
    new ErroApi(400, 'ID_INVALIDO', `O parâmetro "${campo}" deve ser um UUID válido.`),
  naoAutenticado: (mensagem = 'Token de acesso ausente ou inválido.') =>
    new ErroApi(401, 'NAO_AUTENTICADO', mensagem),
  credenciaisInvalidas: () =>
    new ErroApi(401, 'CREDENCIAIS_INVALIDAS', 'client_id ou client_secret incorretos.'),
  assinaturaInvalida: (mensagem = 'Assinatura do webhook ausente ou inválida.') =>
    new ErroApi(401, 'ASSINATURA_INVALIDA', mensagem),
  naoEncontrado: (recurso) =>
    new ErroApi(404, 'NAO_ENCONTRADO', `${recurso} não encontrado(a).`),
  conflito: (codigo, mensagem) => new ErroApi(409, codigo, mensagem),
  regraNegocio: (codigo, mensagem) => new ErroApi(422, codigo, mensagem),
};

module.exports = { ErroApi, erros };
