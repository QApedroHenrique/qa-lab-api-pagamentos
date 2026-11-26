const { ErroApi } = require('../utils/erros');

function rotaNaoEncontrada(req, res) {
  res.status(404).json({
    erro: { codigo: 'ROTA_NAO_ENCONTRADA', mensagem: `Rota ${req.method} ${req.path} não existe.` },
  });
}

// eslint-disable-next-line no-unused-vars
function tratarErros(erro, req, res, next) {
  if (erro instanceof ErroApi) {
    return res.status(erro.status).json(erro.paraJson());
  }

  // JSON mal formatado no corpo da requisição
  if (erro.type === 'entity.parse.failed') {
    return res.status(400).json({
      erro: { codigo: 'JSON_INVALIDO', mensagem: 'O corpo da requisição não é um JSON válido.' },
    });
  }

  if (erro.type === 'entity.too.large') {
    return res.status(413).json({
      erro: { codigo: 'CORPO_MUITO_GRANDE', mensagem: 'O corpo da requisição excede o limite permitido.' },
    });
  }

  console.error(`[${req.id}] Erro inesperado:`, erro);
  return res.status(500).json({
    erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro inesperado. Informe o X-Request-Id ao suporte.' },
  });
}

module.exports = { rotaNaoEncontrada, tratarErros };
