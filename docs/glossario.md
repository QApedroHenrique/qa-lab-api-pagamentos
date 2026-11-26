# Glossário

Termos usados no projeto, explicados em linguagem simples.

| Termo | O que é |
|---|---|
| **API REST** | Forma de um sistema oferecer funções a outros sistemas por HTTP (`GET`, `POST`, `DELETE`...), trocando dados em JSON. |
| **Asserção** | Verificação feita pelo teste: "espero que o status seja 201". Se não for, o teste falha. |
| **Backoff exponencial** | Esperar cada vez mais entre uma tentativa e outra (ex.: 200 ms, 400 ms, 800 ms), para não sobrecarregar um sistema que está com problema. |
| **Caixa-preta** | Testar pelo comportamento externo (entrada e saída), sem depender de como o código foi escrito. |
| **Centavos** | Valores guardados como números inteiros (`1050` = R$ 10,50), para evitar erros de arredondamento. |
| **Condição de corrida** | Bug que só aparece quando duas operações acontecem ao mesmo tempo (ex.: dois saques simultâneos usando o mesmo saldo). |
| **Contrato (de API)** | Descrição formal do que a API recebe e devolve: campos, tipos e status. Aqui ele está no arquivo OpenAPI. |
| **Deadlock** | Duas operações travadas esperando uma pela outra para sempre. |
| **Estorno** | Devolver o valor de uma transferência para quem enviou. |
| **Gasto duplo** | Usar o mesmo saldo duas vezes por causa de operações simultâneas. |
| **HMAC** | "Assinatura" criada com um segredo compartilhado. Prova que a mensagem veio de quem conhece o segredo e que não foi alterada no caminho. |
| **Idempotência** | Repetir a mesma operação várias vezes tem o mesmo efeito de fazê-la uma vez só. Essencial em pagamentos: se a internet cair e o cliente reenviar, não pode cobrar duas vezes. |
| **Idempotency-Key** | Identificador único que o cliente manda junto com a requisição para a API reconhecer repetições. |
| **JWT** | Token de acesso assinado digitalmente, com data de expiração. |
| **LGPD** | Lei Geral de Proteção de Dados: entre outras coisas, exige expor o mínimo possível de dados pessoais (por isso o CPF é mascarado). |
| **Livro-razão (ledger)** | Registro de todas as movimentações. O saldo sempre pode ser recalculado a partir dele. |
| **Lock (`FOR UPDATE`)** | Trava uma linha do banco enquanto uma operação está em andamento, para outra não alterar ao mesmo tempo. |
| **Newman** | Ferramenta que roda coleções do Postman pelo terminal (usada no CI). |
| **OpenAPI / Swagger** | Padrão para documentar APIs. O Swagger UI transforma o arquivo em uma página interativa. |
| **Replay (ataque)** | Reenviar uma requisição válida capturada antes. Evitado com o timestamp dentro da assinatura. |
| **Teste de mutação** | Inserir bugs de propósito para conferir se os testes percebem. |
| **Transação** | Conjunto de operações no banco que acontecem todas juntas ou nenhuma (`COMMIT` / `ROLLBACK`). |
| **Webhook** | Notificação automática: um sistema chama a URL de outro quando algo acontece (ex.: "PIX recebido"). |
