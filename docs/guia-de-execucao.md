# Guia de execução

## Pré-requisitos

| Ferramenta | Versão | Para quê |
|---|---|---|
| [Node.js](https://nodejs.org) | 20 ou superior (recomendado 22) | Rodar a API e os testes |
| [Docker](https://www.docker.com/products/docker-desktop/) | qualquer versão recente | Subir o PostgreSQL sem instalar nada |
| [Postman](https://www.postman.com/downloads/) | opcional | Rodar a coleção pela interface gráfica |

> Sem Docker? Funciona com qualquer PostgreSQL 14+ local: crie o banco `pagamentos` com usuário `qa`/senha `qa`
> ou ajuste a variável `DATABASE_URL`.

## 1. Rodando os testes automatizados (Jest)

```bash
git clone https://github.com/QApedroHenrique/qa-lab-api-pagamentos.git
cd qa-lab-api-pagamentos

docker compose up -d db     # sobe só o PostgreSQL
npm install
npm test                    # aplica o schema, limpa o banco, sobe a API e roda a suíte inteira
```

Ao final, abra o relatório HTML em **`reports/jest/index.html`**.

**Comandos úteis:**

```bash
npx jest tests/funcional/transferencias.test.js   # só um arquivo
npx jest -t "CT-IDE"                               # só os casos de idempotência
npx jest -t "CT-CNC-01"                            # um caso específico
```

## 2. Rodando a API manualmente

```bash
docker compose up -d db
npm start
```

- API: `http://localhost:3000`
- Documentação interativa (Swagger): **`http://localhost:3000/docs`**
- Saúde: `http://localhost:3000/saude`

Ou tudo em container (banco + API):

```bash
docker compose up -d --build
```

## 3. Regressão Postman

### Pelo terminal (Newman)

Com a API rodando (`npm start`):

```bash
npm run test:newman
```

Relatório em **`reports/newman/index.html`**.

### Pela interface do Postman

1. **Import** → selecione `postman/qa-lab-api-pagamentos.postman_collection.json` e `postman/local.postman_environment.json`.
2. No canto superior direito, escolha o ambiente **QA Lab — Local**.
3. Clique com o botão direito na coleção → **Run collection** → **Run**.

As requisições **precisam rodar em ordem**: cada uma usa dados gerados pela anterior (token, ids, chave de idempotência).

## 4. Página de relatórios

Depois de rodar Jest (`npm run test:ci`) e Newman (`npm run test:newman`):

```bash
npm run relatorios    # gera reports/index.html com o resumo e links para os dois relatórios
```

## 5. Integração contínua (GitHub Actions)

O workflow [`.github/workflows/testes.yml`](../.github/workflows/testes.yml) roda a cada `push` na `main`
e em todo *pull request*:

1. sobe um PostgreSQL 16 como *service container*;
2. instala as dependências (`npm ci`);
3. verifica a rastreabilidade testes × documentação (`npm run docs:verificar`);
4. roda a suíte Jest;
5. sobe a API e roda a regressão Newman;
6. gera o resumo da execução (aparece na aba **Summary** do workflow);
7. guarda os relatórios como artefato e publica no **GitHub Pages**.

**Para ativar a publicação dos relatórios no GitHub Pages** (uma vez só):
`Settings` → `Pages` → em **Build and deployment / Source**, escolha **GitHub Actions**.
Os relatórios ficam em `https://QApedroHenrique.github.io/qa-lab-api-pagamentos/`.

## 6. Testando outro ambiente

A suíte é caixa-preta e pode apontar para uma API que já está rodando:

```bash
BASE_URL=http://localhost:3000 DATABASE_URL=postgres://qa:qa@localhost:5432/pagamentos npm test
```

Com `BASE_URL` definida, o setup **não** sobe a API nem limpa o banco.
Os testes de consistência SQL precisam de acesso de leitura ao banco desse ambiente, e o CT-AUT-09
(token expirado) precisa do mesmo `JWT_SECRET`.

## 7. Configuração

Todas as variáveis estão em [`.env.example`](../.env.example). Sem `.env`, a API usa os mesmos valores padrão
(todos fictícios). As mais usadas:

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3000` | Porta da API |
| `DATABASE_URL` | `postgres://qa:qa@localhost:5432/pagamentos` | Conexão com o banco |
| `WEBHOOK_MAX_TENTATIVAS` | `3` | Tentativas de entrega de webhook |
| `WEBHOOK_INTERVALO_BASE_MS` | `200` (50 nos testes) | Intervalo inicial entre tentativas |
| `TOLERANCIA_ASSINATURA_SEGUNDOS` | `300` | Janela de validade da assinatura HMAC |
| `WEBHOOK_HOSTS_PERMITIDOS` | vazio (`127.0.0.1` nos testes) | Hosts internos liberados no cadastro de webhook (RN-16) |
| `NODE_ENV` | — | Com `production`, exige `JWT_SECRET`, `API_CLIENT_SECRET` e `PIX_WEBHOOK_SECRET` próprios (RN-15) |
| `PERMITIR_LIMPEZA_BANCO` | — | `true` libera a limpeza do banco pela suíte quando o host não é local |

## 8. Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `NODE_ENV=production exige segredos próprios` | Imagem Docker rodando sem os segredos | Defina as três variáveis citadas, ou use o `docker compose` (demonstração) |
| `limparBanco() recusado` | `DATABASE_URL` aponta para um banco que não é local | Aponte para um banco de teste local, ou defina `PERMITIR_LIMPEZA_BANCO=true` se ele for descartável |
| Cadastro de webhook local retorna 400 "rede interna" | Bloqueio anti-SSRF | Libere o host em `WEBHOOK_HOSTS_PERMITIDOS` (ex.: `127.0.0.1`) |
| `ECONNREFUSED 127.0.0.1:5432` | Banco não está rodando | `docker compose up -d db` e aguarde alguns segundos |
| `port is already allocated` ao subir o banco | Já existe um PostgreSQL na porta 5432 | Pare o outro serviço ou mude a porta no `docker-compose.yml` e na `DATABASE_URL` |
| Newman falha em `Gerar token` | A API não está rodando | Rode `npm start` em outro terminal antes |
| Postman com erro de variável vazia | Requisições rodadas fora de ordem | Rode a coleção inteira pelo Runner, na ordem |
| `docs:verificar` falhou | Criou um teste com `[CT-...]` sem documentar (ou o contrário) | Adicione o caso em `docs/casos-de-teste.md` |
