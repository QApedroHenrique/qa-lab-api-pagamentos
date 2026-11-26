const crypto = require('crypto');

/**
 * Assinatura HMAC-SHA256 usada nos webhooks (entrada e saída).
 *
 * Header:  X-Assinatura: t=<timestamp_unix>,v1=<hmac_hex>
 * Conteúdo assinado:  "<timestamp>.<corpo_bruto_da_requisicao>"
 *
 * Incluir o timestamp no conteúdo assinado impede que alguém reaproveite
 * uma requisição antiga (ataque de replay).
 */
function gerarAssinatura(segredo, corpoBruto, timestamp = Math.floor(Date.now() / 1000)) {
  const hmac = crypto.createHmac('sha256', segredo).update(`${timestamp}.${corpoBruto}`).digest('hex');
  return `t=${timestamp},v1=${hmac}`;
}

function interpretarHeader(header) {
  if (typeof header !== 'string') return null;
  const partes = Object.fromEntries(
    header.split(',').map((parte) => {
      const [chave, ...resto] = parte.trim().split('=');
      return [chave, resto.join('=')];
    }),
  );
  if (!/^\d+$/.test(partes.t || '') || !/^[a-f0-9]{64}$/.test(partes.v1 || '')) return null;
  return { timestamp: Number(partes.t), hmac: partes.v1 };
}

/**
 * Retorna { valida: true } ou { valida: false, motivo }.
 */
function verificarAssinatura(segredo, corpoBruto, header, toleranciaSegundos) {
  const dados = interpretarHeader(header);
  if (!dados) return { valida: false, motivo: 'Header X-Assinatura ausente ou mal formatado.' };

  const agora = Math.floor(Date.now() / 1000);
  if (Math.abs(agora - dados.timestamp) > toleranciaSegundos) {
    return { valida: false, motivo: 'Assinatura expirada (timestamp fora da janela de tolerância).' };
  }

  const esperado = crypto
    .createHmac('sha256', segredo)
    .update(`${dados.timestamp}.${corpoBruto}`)
    .digest('hex');

  // timingSafeEqual evita ataques de tempo na comparação
  const iguais = crypto.timingSafeEqual(Buffer.from(esperado, 'hex'), Buffer.from(dados.hmac, 'hex'));
  return iguais ? { valida: true } : { valida: false, motivo: 'Assinatura não confere com o conteúdo.' };
}

module.exports = { gerarAssinatura, verificarAssinatura, interpretarHeader };
