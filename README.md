<p align="center"><img src="assets/img/gather-logo-cyan.png" alt="GATHER" width="420"></p>

# GATHER 0.1 — Portal do desenvolvedor

**Nathanael Industries · Categoria Desenvolvedores**
Gerenciadora e orquestradora de APIs: a IA que cria APIs para as demais IAs da NI (Horácio, Miquéias, Asafe).

## Páginas
| Arquivo | Conteúdo |
|---|---|
| `index.html` | Apresentação da Gather, pipeline, IAs atendidas, roadmap |
| `console.html` | Console do desenvolvedor (a Gather em funcionamento) |
| `docs.html` | Documentação: pedidos, artefatos, manifesto de tools, auth, erros, convenções |

## Console
- **Criar API** — pedido em linguagem natural → a Gather identifica a IA consumidora, os recursos, as operações, a autenticação e os extras (tempo real, webhook) e gera:
  `openapi.json` (OpenAPI 3.1), `gather.tools.json` (manifesto de ferramentas para as IAs), `server.js` (Express funcional), `client.js` e `client.py`. Tudo é editável antes de registrar.
- **Catálogo** — registro central: ver artefatos, editar, publicar/despublicar, testar, excluir.
- **Roteador de IAs** — uma IA descreve a necessidade e a Gather seleciona a API compatível ou propõe criar uma.
- **Credenciais** — emissão de chaves `gth_live_…` por IA/API/escopo/expiração; guarda só o hash SHA-256; revogação.
- **Playground** — chamadas com validação real da chave (401/403) e respostas simuladas; gera o cURL.
- **Monitor** — uptime, latência p50, erros e tendência das APIs publicadas (simulado na v0.1).
- **Configurações** — exportar/importar o registro, carregar exemplos.

## Estrutura
```
assets/css/style.css         tema preto & ciano
assets/js/gather-engine.js   motor da Gather (interpretação + geradores), sem dependências
assets/js/console.js         interface do console
assets/img/                  logos ciano e branca (PNG transparente) e favicon
```

## Rodar
Site estático, sem build. Abra `index.html` ou sirva a pasta:
```bash
python3 -m http.server 8080
```
Pronto para GitHub Pages.

## Limites da v0.1
Dados ficam no `localStorage` do navegador; Playground e Monitor são simulados; a interpretação é por regras.
Roadmap: 0.2 backend real + deploy via Asafe · 0.3 geração com LLM · 1.0 orquestração autônoma.
