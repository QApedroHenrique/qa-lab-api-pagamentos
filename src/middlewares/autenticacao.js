const jwt = require('jsonwebtoken');
const config = require('../config');
const { erros } = require('../utils/erros');

/** Exige header "Authorization: Bearer <token>" com um JWT válido e não expirado. */
function exigirToken(req, res, next) {
  const header = req.get('Authorization') || '';
  const [esquema, token] = header.split(' ');

  if (esquema !== 'Bearer' || !token) {
    res.set('WWW-Authenticate', 'Bearer');
    return next(erros.naoAutenticado());
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    req.cliente = { id: payload.sub };
    return next();
  } catch (erro) {
    res.set('WWW-Authenticate', 'Bearer error="invalid_token"');
    const mensagem = erro.name === 'TokenExpiredError' ? 'Token de acesso expirado.' : 'Token de acesso inválido.';
    return next(erros.naoAutenticado(mensagem));
  }
}

module.exports = { exigirToken };
