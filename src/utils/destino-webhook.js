const net = require('net');

/**
 * Proteção contra SSRF no cadastro de webhooks (RN-16).
 * A API faz requisições para a URL cadastrada; sem esta checagem, qualquer cliente poderia
 * apontá-la para a rede interna (banco, metadados da nuvem em 169.254.169.254, painéis admin).
 *
 * Recebe um `URL` já parseado: o parser WHATWG normaliza formas alternativas de IP
 * (`http://2130706433`, `http://0x7f.1` → `127.0.0.1`), então a checagem vê o endereço real.
 * Limitação conhecida: nomes de domínio que RESOLVEM para IP interno não são verificados (sem DNS).
 */

const NOMES_INTERNOS = [/^localhost$/, /\.localhost$/, /\.local$/, /\.internal$/];

function ipv4Interno(ip) {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 || // "esta rede" (0.0.0.0)
    a === 10 ||
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local / metadados da nuvem
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224 // multicast e reservado
  );
}

function ipv6Interno(ip) {
  if (ip === '::' || ip === '::1') return true;
  // IPv4 mapeado em IPv6: o parser escreve ::ffff:127.0.0.1 como ::ffff:7f00:1
  const mapeadoHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(ip);
  if (mapeadoHex) {
    const alto = parseInt(mapeadoHex[1], 16);
    const baixo = parseInt(mapeadoHex[2], 16);
    return ipv4Interno(`${alto >> 8}.${alto & 255}.${baixo >> 8}.${baixo & 255}`);
  }
  const mapeadoDecimal = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
  if (mapeadoDecimal) return ipv4Interno(mapeadoDecimal[1]);
  return /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip); // fc00::/7 (privado) e fe80::/10 (link-local)
}

/** true se o host da URL pode receber webhooks. */
function destinoPermitido(url, hostsPermitidos = []) {
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (hostsPermitidos.includes(host)) return true;

  if (net.isIPv4(host)) return !ipv4Interno(host);
  if (net.isIPv6(host)) return !ipv6Interno(host);
  return !NOMES_INTERNOS.some((padrao) => padrao.test(host));
}

module.exports = { destinoPermitido };
