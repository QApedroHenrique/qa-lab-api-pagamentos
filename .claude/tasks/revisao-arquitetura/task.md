# Endurecimento a partir da revisão externa da arquitetura

## Objetivo
Aplicar os pontos da revisão externa que são pequenos, testáveis e de baixo risco, e documentar
como limitação conhecida o que exige mudança de arquitetura. Mostrar que o projeto sabe onde falha.

## Regras de negócio
- **RN-15 (nova) — Segredos em produção:** com `NODE_ENV=production`, a API **se recusa a iniciar**
  (exit code 1, mensagem com o nome das variáveis, nunca o valor) se `JWT_SECRET`, `API_CLIENT_SECRET`
  ou `PIX_WEBHOOK_SECRET` estiverem ausentes, vazios ou iguais ao padrão público do ambiente local.
- **RN-16 (nova) — Destino de webhook permitido (anti-SSRF):** o cadastro de assinatura recusa com
  **400 `DADOS_INVALIDOS`** (campo `url`) destinos locais ou de rede interna: `localhost`, `*.localhost`,
  `*.local`, `*.internal`, IPv4 0/8, 10/8, 100.64/10, 127/8, 169.254/16, 172.16/12, 192.168/16, ≥ 224/4,
  IPv6 `::`, `::1`, `fc00::/7`, `fe80::/10` e IPv4 mapeado em IPv6.
  Exceção: hosts listados em `WEBHOOK_HOSTS_PERMITIDOS` (separados por vírgula). Os testes liberam só `127.0.0.1`.
- RN-08: deixar explícita a decisão já testada em CT-IDE-05 (erro não grava a chave) e que as chaves não expiram.

## Contrato
`POST /webhooks/assinaturas`: nova causa de 400 no campo `url`. Sem campo novo.

## Dados
Índices novos: `transferencias(conta_origem_id)`, `transferencias(conta_destino_id)`, `entregas_webhook(assinatura_id)`.

## Infra / código interno
- `emTransacao`: falha no ROLLBACK não mascara o erro original e descarta a conexão (`release(erro)`).
- `limparBanco()`: só roda em banco local (`localhost`, `127.0.0.1`, `::1`, `db`) ou com `PERMITIR_LIMPEZA_BANCO=true`; nunca com `NODE_ENV=production`.
- `docker-compose.yml`: API roda com `NODE_ENV=development` (ambiente de demonstração); a imagem sozinha continua `production`.
- CT-WHK-07 e CT-WHK-08: trocar `sleep` por espera até o status da entrega mudar.

## Critérios de aceite
- [ ] Produção sem segredos → processo termina com código 1 e cita `JWT_SECRET` (CT-SEG-11).
- [ ] Produção com segredos próprios → API sobe (CT-SEG-12).
- [ ] Cadastro com `localhost`, `10.x`, `172.16.x`, `192.168.x`, `169.254.169.254`, `[::1]`, `0.0.0.0` → 400 campo `url` (CT-SEG-13).
- [ ] Host liberado na allowlist (`127.0.0.1`) continua funcionando (coberto por CT-WHK-01 a 12).
- [ ] CT-WHK-07/08 sem espera fixa.
- [ ] `npm run docs:verificar` passa.

## Fora de escopo (vira "Limitações conhecidas" em docs/arquitetura.md)
Transactional outbox, autorização por recurso (BOLA) e idempotência por cliente, TTL das chaves,
migrações versionadas, rate limit, paginação por cursor, logs estruturados, resolução DNS no anti-SSRF.

## Suposições
- Erro de SSRF usa o 400 de validação existente (sem código novo) para não quebrar clientes.
- Segredo igual ao padrão local conta como ausente.
