<p align="center"><img src="assets/img/gather-logo-cyan.png" alt="GATHER" width="420"></p>

# Gather 0.1 — Console

**Nathanael Industries · Categoria Desenvolvedores**
Gerenciadora e orquestradora de APIs: a IA que cria APIs para as demais IAs da NI (Horácio, Miquéias, Asafe).

## Uso interno
Ferramenta interna da Nathanael Industries (não é um site público). O `index.html` abre direto no console da Gather, com a tela de inicialização.

## Abas
- **Criar API** — pedido em linguagem natural → a Gather identifica a IA consumidora, os recursos, as operações, a autenticação e os extras (tempo real, webhook) e gera:
  `openapi.json` (OpenAPI 3.1), `gather.tools.json` (manifesto de ferramentas para as IAs), `server.js` (Express funcional), `client.js` e `client.py`. Tudo é editável antes de registrar.
- **Catálogo** — registro central: ver artefatos, editar, ativar/desativar, testar, excluir.
- **Roteador de IAs** — uma IA descreve a necessidade e a Gather seleciona a API compatível ou propõe criar uma.
- **Credenciais** — emissão de chaves `gth_live_…` por IA/API/escopo/expiração; guarda só o hash SHA-256; revogação.
- **Playground** — chamadas com validação real da chave (401/403) e respostas simuladas; gera o cURL.
- **Monitor** — uptime, latência p50, erros e tendência das APIs ativas (simulado na v0.1).
- **Topo** — exportar/importar o registro (ícones ↓ ↑); exemplos ficam no Catálogo.

