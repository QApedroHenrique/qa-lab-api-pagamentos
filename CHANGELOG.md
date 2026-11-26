# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [1.0.0] — 2026-11-26

### Adicionado
- API fictícia de pagamentos: autenticação JWT, contas com CPF mascarado, PIX via webhook assinado (HMAC),
  transferências com `Idempotency-Key`, estornos, extrato (livro-razão) e webhooks de saída com retentativas.
- Contrato OpenAPI 3.1 com documentação interativa em `/docs`.
- Suíte Jest com 171 testes (107 casos): funcionais, contrato, segurança, concorrência e consistência via SQL.
- Coleção Postman encadeada (21 requisições, 114 asserções) executada pelo Newman.
- Pipeline no GitHub Actions com PostgreSQL, Jest, Newman, verificação de rastreabilidade e publicação dos relatórios.
- Documentação de teste: plano, regras de negócio, casos com rastreabilidade, arquitetura, referência da API,
  guia de execução, relatório com teste de mutação e glossário.
