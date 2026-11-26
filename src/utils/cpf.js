/**
 * Validação de CPF pelo algoritmo oficial dos dígitos verificadores.
 * Os testes geram CPFs FICTÍCIOS que passam no algoritmo, mas não pertencem a ninguém.
 */
function calcularDigito(base) {
  const pesoInicial = base.length + 1;
  const soma = base
    .split('')
    .reduce((acc, digito, i) => acc + Number(digito) * (pesoInicial - i), 0);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

function cpfValido(valor) {
  if (typeof valor !== 'string' || !/^\d{11}$/.test(valor)) return false;
  if (/^(\d)\1{10}$/.test(valor)) return false; // 000.000.000-00, 111..., etc.
  const d1 = calcularDigito(valor.slice(0, 9));
  const d2 = calcularDigito(valor.slice(0, 10));
  return d1 === Number(valor[9]) && d2 === Number(valor[10]);
}

/** Mascara o CPF para não expor o documento completo nas respostas (boa prática LGPD). */
function mascararCpf(cpf) {
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}

module.exports = { cpfValido, mascararCpf, calcularDigito };
