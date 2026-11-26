# Questões — revisao-arquitetura

| # | Ponto | Impacto | Severidade | Decisão |
|---|---|---|---|---|
| 1 | A allowlist só por hostname não pega um domínio público que **resolve** para IP interno (DNS rebinding) | segurança | 🟡 | Fora de escopo; registrado em "Limitações conhecidas". Resolver DNS no cadastro e de novo na entrega. |
| 2 | O parser `URL` normaliza `http://2130706433`, `0x7f.1` e `[::ffff:127.0.0.1]` → o bloqueio precisa olhar o hostname **já normalizado**, inclusive IPv4 mapeado em hex | segurança | 🔴 | Tratar IPv4 mapeado nas formas decimal e hex. |
| 3 | Se a allowlist padrão liberasse `localhost`, os casos de SSRF com `localhost` não teriam valor | teste | 🟡 | Os testes liberam só `127.0.0.1`; `localhost` fica no CT-SEG-13. |
| 4 | O CT-SEG-12 depende de banco (o start aplica o schema) | uso | 🟢 | Aceito: a suíte já exige Postgres. |
| 5 | A trava do `limparBanco()` não pode quebrar o CI (host `localhost`) nem o compose (host `db`) | uso | 🔴 | Lista de hosts locais inclui os dois. |
| 6 | O `docker compose up` passaria a falhar com a validação de segredos | uso | 🔴 | O compose roda como `development` (demo); a imagem continua `production`. Documentado. |
| 7 | CT-WHK-05, 06 e 10 verificam que "nada chegou": nesse caso a espera fixa é inevitável | teste | 🟢 | Documentar a exceção em vez de remover. |
