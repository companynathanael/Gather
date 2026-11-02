# Lições da Gather — Laboratório nº 1 (02/11/2026)

A Gather criou **50 APIs** a partir de pedidos em português e depois mais **15 inéditas** (para conferir se aprendeu de verdade, e não só decorou).
Cada API foi testada de verdade e **removida no final**, mesmo as que passaram.

## Como cada API foi testada
1. **Interpretação** — IA consumidora, recursos, recurso principal, operações, autenticação, tempo real, webhook, limite, nome.
2. **Linguagem** — nada de plural errado nos nomes e descrições ("ordems", "traducaos").
3. **OpenAPI** — referências válidas, parâmetros de rota declarados, `operationId` sem repetição.
4. **Manifesto de tools** — nomes válidos e únicos, campos obrigatórios existentes.
5. **Sintaxe** — `server.js`, `client.js` e `client.py` compilam.
6. **Servidor real** — o `server.js` gerado sobe com Express e passa por: `/health`, 401 sem chave ou com chave errada, criar → listar → consultar → atualizar → remover → 404, stream SSE, rotas de ação, `/calculos/avaliar` (calcula e recusa código) e limite de requisições (429).
7. **Clientes reais** — o `client.js` e o `client.py` gerados chamam o servidor rodando.
8. **Interface** — as 50 criadas pelo console (pedido → Gerar → Registrar e ativar), testadas no Playground com uma chave emitida, e depois **excluídas pelo Catálogo** e a chave revogada.

## Resultado
| Rodada | Motor | Resultado |
|---|---|---|
| 1 | original | 37/50 sem falhas (testes iniciais) |
| 2 | original | 26/50 com os testes mais rígidos |
| 2 | corrigido | **50/50** |
| 3 | corrigido · 15 pedidos inéditos | 13/15 (1 erro real da Gather, 1 expectativa errada no teste) |
| 4 | corrigido de novo · 65 pedidos | **65/65** |
| Interface | 1ª vez | 35/50 registradas (15 bloqueadas por nome repetido) |
| Interface | corrigida | **50/50** registradas, 50/50 no Playground, 50/50 removidas |

## Lições aprendidas (e já aplicadas no motor)
1. **Ordem das rotas no servidor.** `/cotacoes/stream` vinha depois de `/cotacoes/:id`, então o Express tratava "stream" como um id e devolvia 404. → Rotas fixas são registradas antes das rotas com parâmetro.
2. **Rota de cálculo que não calculava.** `/calculos/avaliar` era só um esqueleto. → Agora calcula de verdade e recusa qualquer coisa que não seja número ou operador (testado com `process.exit()`).
3. **Recurso principal errado.** O nome da API vinha da ordem do dicionário, não do pedido ("relatórios … com cálculos" virava "API de cálculos"). → O recurso principal é o que aparece primeiro no texto.
4. **"Para todas as IAs" não é um recurso.** A frase criava um recurso "agentes" sem ninguém pedir. → Frases que só indicam o consumidor são ignoradas na busca de recursos.
5. **Palavras ambíguas.** "ações" pode ser ação da bolsa ou ação de um agente ("auditoria das ações dos agentes" virava "ativos"). → "ações" só vira *ativos* em contexto financeiro (bolsa, preço, cotação, compra, venda…).
6. **Singular diferente do plural.** "ordem" e "mensagem" não eram reconhecidas no singular. → Dicionário aceita *ordem/ordens* e *mensagem/mensagens*.
7. **"Contas bancárias" não são usuários.** → *contas bancárias/correntes* vão para *carteiras*; *contas de usuário/acesso* vão para *usuários*.
8. **Plural em português.** "ordems", "mensagems", "traducaos". → Regras de plural e singular: m→ns, ão→ões, r/z→es, el→éis.
9. **Recurso desconhecido mal escolhido.** "API para gerenciar veículos" virava "gerenciars"; "estoque de produtos" virava "estoques"; "biblioteca de livros" virava "bibliotecas". → Verbos, conectivos e nomes de IA são ignorados, e em "*coleção* de *itens*" o recurso é o item (e o nome mantém o acento: "veículos", "traduções").
10. **Verbos de ação.** "Asafe precisa reiniciar servidores" só gerava CRUD. → Verbos como reiniciar, pausar, retomar, aprovar, sincronizar e arquivar viram rotas `POST /recurso/{id}/verbo`, que devolvem 404 para um item inexistente.
11. **Pedidos parecidos travavam o registro.** Três pedidos diferentes geravam "Horácio · API de eventos", e o 2º e o 3º eram recusados. → A Gather avisa que já existe uma API parecida (sugere reutilizar pelo Roteador) e numera a nova ("… 2").
12. **Interface em telas de 1360px.** As ações do Catálogo e a aba Monitor ficavam cortadas. → Layout ajustado.

## Ainda não resolvido (próximas lições)
- A interpretação continua por regras: um pedido com palavras fora do dicionário vira um recurso genérico com campos padrão (`nome`, `descricao`, `criado_em`).
- As rotas de ação (`/reiniciar`, `/aprovar`…) e os webhooks saem como esqueleto (`TODO`) no `server.js`.
- Pedidos que citam duas IAs ("Horácio e Miquéias compartilham…") ficam com só uma delas como consumidora.

## Rodar o laboratório de novo
```bash
cd laboratorio
npm install
npm test
```
Cria uma API para cada pedido de `casos.json`, sobe cada servidor gerado, testa, mostra o resultado e apaga tudo no final.
Toda lição nova deve virar um caso em `casos.json`, para a Gather nunca mais errar a mesma coisa.
