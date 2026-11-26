const http = require('http');

/**
 * Servidor HTTP de teste que faz o papel do SISTEMA PARCEIRO recebendo webhooks.
 * Permite programar as respostas (ex.: 500, 500, 200) para testar retentativas.
 */
class ReceptorWebhook {
  constructor() {
    this.recebidos = [];
    this.respostasProgramadas = [];
    this.statusPadrao = 200;
    this.servidor = http.createServer((req, res) => {
      let corpoBruto = '';
      req.on('data', (parte) => {
        corpoBruto += parte;
      });
      req.on('end', () => {
        let corpo = null;
        try {
          corpo = JSON.parse(corpoBruto);
        } catch {
          corpo = null;
        }
        this.recebidos.push({ metodo: req.method, headers: req.headers, corpoBruto, corpo });
        const status = this.respostasProgramadas.length ? this.respostasProgramadas.shift() : this.statusPadrao;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ recebido: status < 300 }));
      });
    });
  }

  async iniciar() {
    await new Promise((resolve) => this.servidor.listen(0, '127.0.0.1', resolve));
    return this;
  }

  get url() {
    return `http://127.0.0.1:${this.servidor.address().port}/webhook`;
  }

  /** Define a sequência de status que o receptor vai devolver, em ordem. */
  programarRespostas(...status) {
    this.respostasProgramadas.push(...status);
  }

  responderSempre(status) {
    this.statusPadrao = status;
  }

  /** Requisições recebidas que satisfazem o filtro. */
  filtrar(filtro) {
    return this.recebidos.filter(filtro);
  }

  /** Espera até `quantidade` requisições que satisfaçam o filtro chegarem (ou estoura o tempo). */
  async aguardar(filtro, { quantidade = 1, timeoutMs = 5000 } = {}) {
    const inicio = Date.now();
    while (Date.now() - inicio < timeoutMs) {
      const encontrados = this.filtrar(filtro);
      if (encontrados.length >= quantidade) return encontrados;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error(
      `Timeout: esperava ${quantidade} webhook(s) e chegaram ${this.filtrar(filtro).length} em ${timeoutMs}ms`,
    );
  }

  async encerrar() {
    await new Promise((resolve) => this.servidor.close(resolve));
  }
}

module.exports = { ReceptorWebhook };
