# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [1.1.0] — 2026-11-26

Aplicação de uma revisão externa da arquitetura.

### Segurança
- **RN-15:** com `NODE_ENV=production`, a API não inicia sem `JWT_SECRET`, `API_CLIENT_SECRET` e
  `PIX_WEBHOOK_SECRET` próprios (CT-SEG-11, CT-SEG-12). O `docker compose` de demonstração roda como `development`.
- **RN-16:** `POST /webhooks/assinaturas` recusa URLs para localhost e redes internas (anti-SSRF), com exceções
  em `WEBHOOK_HOSTS_PERMITIDOS` (CT-SEG-13).

### Corrigido
- `emTransacao`: falha no ROLLBACK não mascara mais o erro original e a conexão quebrada é descartada.
- `limparBanco()` recusa bancos não locais (exceto com `PERMITIR_LIMPEZA_BANCO=true`) e produção.
- CT-WHK-07 e CT-WHK-08 esperam a mudança de status da entrega em vez de usar espera fixa.

### Adicionado
- Índices em `transferencias(conta_origem_id)`, `transferencias(conta_destino_id)` e `entregas_webhook(assinatura_id)`.
- Documentação: fluxo de estorno, nota sobre o diagrama ER e a referência polimórfica de `lancamentos`,
  decisão explícita sobre idempotência após erro e seção **Limitações conhecidas e próximos passos**.

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
