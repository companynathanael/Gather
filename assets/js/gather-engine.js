/* ==========================================================
   GATHER ENGINE 0.1 — Nathanael Industries
   Motor que transforma uma necessidade (texto ou formulário)
   em uma API completa para as IAs da NI:
     - especificação interna (spec)
     - OpenAPI 3.1
     - servidor (Node.js / Express)
     - cliente JS e Python
     - manifesto de ferramentas (tools) para as IAs consumirem
   Roda 100% no navegador, sem dependências.
   ========================================================== */
(function (global) {
  "use strict";

  /* ---------- IAs da Nathanael Industries ---------- */
  const AIS = [
    { id: "horacio", name: "Horácio", version: "HoV 1.1", category: "Auxiliar", role: "Assistente ao chefão (Sr. Nathanael)", keys: ["horacio", "horácio", "assistente"] },
    { id: "miqueias", name: "Miquéias", version: "JpG 1.0", category: "Auxiliar", role: "Tarefista, calculista e trading", keys: ["miqueias", "miquéias", "trading", "trade"] },
    { id: "asafe", name: "Asafe", version: "0.1", category: "Desenvolvedor", role: "Infraestrutura inteligente", keys: ["asafe", "infraestrutura", "servidor"] },
    { id: "gather", name: "Gather", version: "0.1", category: "Desenvolvedor", role: "Gerenciadora e orquestradora de APIs", keys: ["gather"] },
    { id: "todas", name: "Todas as IAs", version: "*", category: "Global", role: "API compartilhada", keys: ["todas", "todos", "global", "compartilhada"] },
  ];

  /* ---------- Dicionário de recursos conhecidos ---------- */
  // Cada recurso traz campos sugeridos (nome: tipo).
  const RESOURCES = [
    { re: /cota[cç](ão|ões|ao|oes)|pre[cç]os?|ticker/i, name: "cotacoes", label: "Cotação", fields: { ativo: "string", preco: "number", variacao: "number", volume: "number", timestamp: "datetime" } },
    { re: /\bativos?\b|\bacao\b|\bacoes\b|cripto|moedas?/i, name: "ativos", label: "Ativo", fields: { simbolo: "string", nome: "string", tipo: "string", mercado: "string" } },
    { re: /\bordens?\b|operacao|operacoes|\btrades?\b/i, name: "ordens", label: "Ordem", fields: { ativo: "string", lado: "string", quantidade: "number", preco: "number", status: "string" } },
    { re: /carteiras?|portf[oó]lio|saldos?/i, name: "carteiras", label: "Carteira", fields: { titular: "string", saldo: "number", moeda: "string" } },
    { re: /tarefas?|to-?dos?|afazeres/i, name: "tarefas", label: "Tarefa", fields: { titulo: "string", descricao: "string", prioridade: "string", concluida: "boolean", prazo: "datetime" } },
    { re: /agendas?|compromissos?|eventos?|reuni[aã]o|reuni[oõ]es/i, name: "eventos", label: "Evento", fields: { titulo: "string", inicio: "datetime", fim: "datetime", local: "string" } },
    { re: /lembretes?|alarmes?/i, name: "lembretes", label: "Lembrete", fields: { mensagem: "string", quando: "datetime", enviado: "boolean" } },
    { re: /notifica[cç](ão|ões|ao|oes)|alertas?/i, name: "notificacoes", label: "Notificação", fields: { canal: "string", destino: "string", mensagem: "string", nivel: "string" } },
    { re: /mensagens?|chat|conversas?/i, name: "mensagens", label: "Mensagem", fields: { remetente: "string", destinatario: "string", conteudo: "string", enviada_em: "datetime" } },
    { re: /c[aá]lculos?|calcul|f[oó]rmulas?|matem/i, name: "calculos", label: "Cálculo", fields: { expressao: "string", resultado: "number" } },
    { re: /relat[oó]rios?|an[aá]lises?/i, name: "relatorios", label: "Relatório", fields: { titulo: "string", periodo: "string", conteudo: "string", gerado_em: "datetime" } },
    { re: /servidor(es)?|m[aá]quinas?|inst[aâ]ncias?/i, name: "servidores", label: "Servidor", fields: { hostname: "string", ip: "string", regiao: "string", status: "string", cpu: "number", memoria: "number" } },
    { re: /\blogs?\b|registros? de (a[cç][aã]o|atividade)|auditoria/i, name: "logs", label: "Log", fields: { agente: "string", acao: "string", nivel: "string", detalhes: "string", timestamp: "datetime" } },
    { re: /agentes?|\bias\b|intelig[eê]ncias?/i, name: "agentes", label: "Agente", fields: { nome: "string", versao: "string", categoria: "string", status: "string" } },
    { re: /permiss(ão|ões|ao|oes)|acessos?|pap[eé]is/i, name: "permissoes", label: "Permissão", fields: { agente: "string", recurso: "string", nivel: "string" } },
    { re: /usu[aá]rios?|contas?|clientes?|contatos?/i, name: "usuarios", label: "Usuário", fields: { nome: "string", email: "string", papel: "string" } },
    { re: /arquivos?|documentos?|uploads?/i, name: "arquivos", label: "Arquivo", fields: { nome: "string", tipo: "string", tamanho: "integer", url: "string" } },
    { re: /\bdados\b|armazenamento|\bregistros?\b|banco de dados/i, name: "registros", label: "Registro", fields: { chave: "string", valor: "string", criado_em: "datetime" } },
    { re: /clima|previs[aã]o do tempo|meteorol/i, name: "clima", label: "Clima", fields: { cidade: "string", temperatura: "number", condicao: "string" } },
    { re: /not[ií]cias?|feeds?/i, name: "noticias", label: "Notícia", fields: { titulo: "string", fonte: "string", url: "string", publicada_em: "datetime" } },
    { re: /pagamentos?|faturas?|cobran[cç]as?/i, name: "pagamentos", label: "Pagamento", fields: { valor: "number", moeda: "string", status: "string", pago_em: "datetime" } },
  ];

  /* ---------- Ações ---------- */
  const ACTIONS = {
    list:   { re: /listar|lista|todos|todas|buscar|pesquisar|consultar|\bver\b|obter|monitorar/i },
    get:    { re: /consultar|detalh|obter|\bver\b|buscar um|por id/i },
    create: { re: /criar|cadastrar|registrar|adicionar|enviar|novo|nova|abrir|agendar|executar|gerar/i },
    update: { re: /atualizar|editar|alterar|modificar|marcar|concluir/i },
    remove: { re: /remover|excluir|deletar|apagar|cancelar/i },
  };

  /* ---------- Utilidades ---------- */
  const strip = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const slugify = (s) => strip(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "api";
  const camel = (s) => slugify(s).replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
  const pascal = (s) => { const c = camel(s); return c.charAt(0).toUpperCase() + c.slice(1); };
  const snake = (s) => slugify(s).replace(/-/g, "_");
  const singular = (s) => s.replace(/oes$/, "ao").replace(/([rsz])es$/, "$1").replace(/s$/, "");
  const PLURAIS = { "Cotação": "cotações", "Notificação": "notificações", "Permissão": "permissões", "Usuário": "usuários", "Cálculo": "cálculos", "Relatório": "relatórios", "Notícia": "notícias", "Servidor": "servidores", "Clima": "dados de clima" };
  const plural = (label) => PLURAIS[label] || label.toLowerCase() + "s";

  function typeToSchema(t) {
    switch (t) {
      case "number": return { type: "number" };
      case "integer": return { type: "integer" };
      case "boolean": return { type: "boolean" };
      case "datetime": return { type: "string", format: "date-time" };
      default: return { type: "string" };
    }
  }

  function sampleValue(name, t, i) {
    i = i || 1;
    switch (t) {
      case "number": return Math.round((Math.random() * 1000 + 1) * 100) / 100;
      case "integer": return Math.floor(Math.random() * 1000) + 1;
      case "boolean": return i % 2 === 0;
      case "datetime": return new Date(Date.now() - i * 3600e3).toISOString();
      default:
        if (/email/.test(name)) return `contato${i}@nathanael.industries`;
        if (/url/.test(name)) return `https://nathanael.industries/r/${i}`;
        if (/status/.test(name)) return ["ativo", "pendente", "concluido"][i % 3];
        if (/ativo|simbolo/.test(name)) return ["BTC", "ETH", "PETR4", "VALE3"][i % 4];
        if (/agente|remetente|destinatario|titular/.test(name)) return ["Horácio", "Miquéias", "Asafe", "Gather"][i % 4];
        return `${name}_${i}`;
    }
  }

  /* ---------- Construção de endpoints ---------- */
  function endpointsFor(resource, actions) {
    const base = `/${resource.name}`;
    const pl = plural(resource.label), sg = resource.label.toLowerCase();
    const all = {
      list:   { method: "GET",    path: base,            summary: `Listar ${pl}` },
      get:    { method: "GET",    path: `${base}/{id}`,  summary: `Consultar ${sg} por ID` },
      create: { method: "POST",   path: base,            summary: `Criar ${sg}` },
      update: { method: "PATCH",  path: `${base}/{id}`,  summary: `Atualizar ${sg}` },
      remove: { method: "DELETE", path: `${base}/{id}`,  summary: `Remover ${sg}` },
    };
    return actions.map((a) => Object.assign({ resource: resource.name, action: a }, all[a]));
  }

  /* ---------- Interpretação de linguagem natural ---------- */
  function interpret(text) {
    const raw = String(text || "").trim();
    const norm = strip(raw).toLowerCase();
    const steps = [];

    // 1) consumidor
    let consumer = AIS.find((a) => a.keys.some((k) => norm.includes(strip(k))));
    if (!consumer) consumer = AIS.find((a) => a.id === "todas");
    steps.push(`IA consumidora identificada: ${consumer.name}`);

    // 2) recursos
    const resources = [];
    for (const r of RESOURCES) {
      if (r.re.test(norm)) {
        if (!resources.some((x) => x.name === r.name)) resources.push(JSON.parse(JSON.stringify({ name: r.name, label: r.label, fields: r.fields })));
      }
    }
    if (!resources.length) {
      // fallback: palavra após "de"/"para gerenciar"
      const m = norm.match(/(?:api|servico|integracao)\s+(?:de|para)\s+([a-z]+)/) || norm.match(/gerenciar\s+([a-z]+)/);
      const word = m ? m[1] : "itens";
      resources.push({ name: slugify(word), label: pascal(singular(word)), fields: { nome: "string", descricao: "string", criado_em: "datetime" } });
      steps.push(`Nenhum recurso conhecido — criado recurso genérico "${word}"`);
    } else {
      steps.push(`Recursos detectados: ${resources.map((r) => r.name).join(", ")}`);
    }

    // 3) ações
    let actions = Object.keys(ACTIONS).filter((a) => ACTIONS[a].re.test(norm));
    if (/crud|completa|gerenciar|gerenciamento|administrar/.test(norm) || !actions.length) actions = ["list", "get", "create", "update", "remove"];
    if (actions.includes("list") && !actions.includes("get")) actions.push("get");
    const order = ["list", "get", "create", "update", "remove"];
    actions.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    steps.push(`Operações: ${actions.join(", ")}`);

    // 4) autenticação
    let auth = "apiKey";
    if (/oauth/.test(norm)) auth = "oauth2";
    else if (/jwt|bearer|token/.test(norm)) auth = "bearer";
    else if (/publica|sem autenticacao|aberta/.test(norm)) auth = "none";
    steps.push(`Autenticação: ${auth}`);

    // 5) extras
    const extras = { realtime: /tempo real|realtime|websocket|stream/.test(norm), webhook: /webhook|notificar|callback/.test(norm), rateLimit: /limite|rate|throttl/.test(norm) ? 60 : 120 };
    if (extras.realtime) steps.push("Canal em tempo real (stream) adicionado");
    if (extras.webhook) steps.push("Webhook de eventos adicionado");

    // 6) nome
    const nameMatch = raw.match(/["“](.+?)["”]/);
    const mainLabel = resources[0].label;
    const name = nameMatch ? nameMatch[1] : `${consumer.id === "todas" ? "NI" : consumer.name} · API de ${plural(mainLabel)}`;

    let endpoints = [];
    resources.forEach((r) => (endpoints = endpoints.concat(endpointsFor(r, actions))));
    if (resources.some((r) => r.name === "calculos")) {
      endpoints.push({ method: "POST", path: "/calculos/avaliar", summary: "Avaliar expressão matemática", resource: "calculos", action: "custom" });
    }
    if (extras.realtime) endpoints.push({ method: "GET", path: `/${resources[0].name}/stream`, summary: `Stream em tempo real de ${resources[0].name} (SSE)`, resource: resources[0].name, action: "stream" });
    if (extras.webhook) endpoints.push({ method: "POST", path: "/webhooks", summary: "Registrar webhook de eventos", resource: "webhooks", action: "custom" });
    endpoints.push({ method: "GET", path: "/health", summary: "Verificar saúde da API", resource: "health", action: "health" });

    const spec = build({
      name,
      description: raw || `API gerada pela Gather para ${consumer.name}.`,
      consumer: consumer.id,
      auth,
      resources,
      endpoints,
      rateLimit: extras.rateLimit,
    });
    return { spec, steps };
  }

  /* ---------- Normaliza/completa uma spec ---------- */
  function build(input) {
    const slug = slugify(input.slug || input.name);
    const resources = (input.resources || []).map((r) => ({ name: slugify(r.name).replace(/-/g, "_"), label: r.label || pascal(singular(r.name)), fields: r.fields || { nome: "string" } }));
    const endpoints = (input.endpoints || []).filter((e) => e && e.path).map((e) => ({
      method: String(e.method || "GET").toUpperCase(),
      path: e.path.startsWith("/") ? e.path : "/" + e.path,
      summary: e.summary || "",
      resource: e.resource || (e.path.split("/")[1] || "root").replace(/[{}]/g, ""),
      action: e.action || "custom",
    }));
    return {
      id: input.id || `api_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: input.name || "Nova API",
      slug,
      version: input.version || "0.1.0",
      description: input.description || "",
      consumer: input.consumer || "todas",
      auth: input.auth || "apiKey",
      baseUrl: input.baseUrl || `https://api.nathanael.industries/${slug}/v1`,
      rateLimit: input.rateLimit || 120,
      resources,
      endpoints,
      createdAt: input.createdAt || new Date().toISOString(),
      status: input.status || "draft",
    };
  }

  /* ---------- OpenAPI 3.1 ---------- */
  function toOpenAPI(spec) {
    const consumer = AIS.find((a) => a.id === spec.consumer) || AIS[4];
    const schemas = {};
    spec.resources.forEach((r) => {
      const props = { id: { type: "string", readOnly: true } };
      Object.entries(r.fields).forEach(([k, t]) => (props[k] = typeToSchema(t)));
      schemas[pascal(r.label)] = { type: "object", properties: props };
      const input = Object.assign({}, props); delete input.id;
      schemas[pascal(r.label) + "Input"] = { type: "object", properties: input, required: Object.keys(input).slice(0, 1) };
    });
    schemas.Erro = { type: "object", properties: { erro: { type: "string" }, codigo: { type: "string" } } };

    const paths = {};
    spec.endpoints.forEach((e) => {
      const oaPath = e.path;
      paths[oaPath] = paths[oaPath] || {};
      const res = spec.resources.find((r) => r.name === e.resource);
      const ref = res ? { $ref: `#/components/schemas/${pascal(res.label)}` } : { type: "object" };
      const op = {
        operationId: operationId(e),
        summary: e.summary,
        tags: [e.resource],
        responses: {},
      };
      const params = (oaPath.match(/\{(\w+)\}/g) || []).map((p) => ({ name: p.slice(1, -1), in: "path", required: true, schema: { type: "string" } }));
      if (e.action === "list") params.push({ name: "limite", in: "query", schema: { type: "integer", default: 20 } }, { name: "pagina", in: "query", schema: { type: "integer", default: 1 } });
      if (params.length) op.parameters = params;
      if (["POST", "PUT", "PATCH"].includes(e.method)) {
        op.requestBody = { required: true, content: { "application/json": { schema: res && e.action !== "custom" ? { $ref: `#/components/schemas/${pascal(res.label)}Input` } : { type: "object" } } } };
      }
      const ok = e.method === "POST" && e.action === "create" ? "201" : e.method === "DELETE" ? "204" : "200";
      if (ok === "204") op.responses["204"] = { description: "Removido" };
      else if (e.action === "list") op.responses[ok] = { description: "OK", content: { "application/json": { schema: { type: "object", properties: { dados: { type: "array", items: ref }, total: { type: "integer" } } } } } };
      else if (e.action === "health") op.responses[ok] = { description: "OK", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string" }, uptime: { type: "number" } } } } } };
      else if (e.action === "stream") op.responses[ok] = { description: "Stream SSE", content: { "text/event-stream": { schema: { type: "string" } } } };
      else op.responses[ok] = { description: "OK", content: { "application/json": { schema: ref } } };
      op.responses["4XX"] = { description: "Erro do cliente", content: { "application/json": { schema: { $ref: "#/components/schemas/Erro" } } } };
      if (e.action === "health") op.security = [];
      paths[oaPath][e.method.toLowerCase()] = op;
    });

    const securitySchemes = {};
    let security = [];
    if (spec.auth === "apiKey") { securitySchemes.GatherKey = { type: "apiKey", in: "header", name: "X-Gather-Key" }; security = [{ GatherKey: [] }]; }
    if (spec.auth === "bearer") { securitySchemes.Bearer = { type: "http", scheme: "bearer", bearerFormat: "JWT" }; security = [{ Bearer: [] }]; }
    if (spec.auth === "oauth2") { securitySchemes.OAuth2 = { type: "oauth2", flows: { clientCredentials: { tokenUrl: "https://auth.nathanael.industries/oauth/token", scopes: { "api:read": "Leitura", "api:write": "Escrita" } } } }; security = [{ OAuth2: ["api:read", "api:write"] }]; }

    return {
      openapi: "3.1.0",
      info: {
        title: spec.name,
        version: spec.version,
        description: spec.description,
        "x-nathanael-industries": { geradoPor: "Gather 0.1", consumidor: consumer.name, rateLimitPorMinuto: spec.rateLimit },
      },
      servers: [{ url: spec.baseUrl }],
      security,
      paths,
      components: { schemas, securitySchemes },
    };
  }

  function operationId(e) {
    const map = { list: "listar", get: "consultar", create: "criar", update: "atualizar", remove: "remover", health: "health", stream: "stream" };
    if (e.action === "health") return "verificarSaude";
    const verb = map[e.action] || e.method.toLowerCase();
    const parts = e.path.split("/").filter((p) => p && !p.startsWith("{"));
    return camel(verb + "-" + parts.join("-"));
  }

  /* ---------- Manifesto de ferramentas (para as IAs) ---------- */
  function toToolManifest(spec) {
    const tools = spec.endpoints.filter((e) => e.action !== "stream").map((e) => {
      const res = spec.resources.find((r) => r.name === e.resource);
      const properties = {}; const required = [];
      (e.path.match(/\{(\w+)\}/g) || []).forEach((p) => { const n = p.slice(1, -1); properties[n] = { type: "string", description: `Identificador (${n})` }; required.push(n); });
      if (e.action === "list") { properties.limite = { type: "integer", description: "Máximo de itens" }; properties.pagina = { type: "integer" }; }
      if (["POST", "PUT", "PATCH"].includes(e.method) && res) {
        Object.entries(res.fields).forEach(([k, t]) => { properties[k] = Object.assign({ description: k.replace(/_/g, " ") }, typeToSchema(t)); });
        if (e.action === "create") required.push(Object.keys(res.fields)[0]);
      }
      return {
        name: (snake(spec.slug) + "_" + snake(operationId(e).replace(/([A-Z])/g, "-$1"))).slice(0, 64),
        description: `${e.summary} — ${e.method} ${e.path}`,
        input_schema: { type: "object", properties, required },
        "x-http": { method: e.method, path: e.path },
      };
    });
    return {
      gather: "0.1",
      api: spec.slug,
      version: spec.version,
      consumidor: spec.consumer,
      baseUrl: spec.baseUrl,
      auth: spec.auth === "apiKey" ? { type: "apiKey", header: "X-Gather-Key", credencial: `gather://credenciais/${spec.slug}` } : { type: spec.auth },
      tools,
    };
  }

  /* ---------- Servidor Express ---------- */
  function toExpress(spec) {
    const L = [];
    L.push(`// ${spec.name} v${spec.version}`);
    L.push(`// Gerado pela GATHER 0.1 — Nathanael Industries`);
    L.push(`// Consumidor: ${spec.consumer} · Auth: ${spec.auth}`);
    L.push(`// Executar: npm i express && node server.js`);
    L.push(``);
    L.push(`const express = require("express");`);
    L.push(`const crypto = require("crypto");`);
    L.push(`const app = express();`);
    L.push(`app.use(express.json());`);
    L.push(``);
    L.push(`const db = { ${spec.resources.map((r) => `${r.name}: new Map()`).join(", ")} };`);
    L.push(`const inicio = Date.now();`);
    L.push(``);
    if (spec.auth === "apiKey") {
      L.push(`// Autenticação via chave emitida pela Gather`);
      L.push(`const CHAVES = new Set((process.env.GATHER_KEYS || "").split(",").filter(Boolean));`);
      L.push(`function auth(req, res, next) {`);
      L.push(`  if (req.path === "/health") return next();`);
      L.push(`  const k = req.get("X-Gather-Key");`);
      L.push(`  if (!k || !CHAVES.has(k)) return res.status(401).json({ erro: "Chave inválida", codigo: "GATHER_401" });`);
      L.push(`  next();`);
      L.push(`}`);
      L.push(`app.use(auth);`);
    } else if (spec.auth === "bearer" || spec.auth === "oauth2") {
      L.push(`// Autenticação Bearer (validar o token no provedor da NI)`);
      L.push(`app.use((req, res, next) => {`);
      L.push(`  if (req.path === "/health") return next();`);
      L.push(`  const h = req.get("Authorization") || "";`);
      L.push(`  if (!h.startsWith("Bearer ")) return res.status(401).json({ erro: "Token ausente", codigo: "GATHER_401" });`);
      L.push(`  next();`);
      L.push(`});`);
    }
    L.push(``);
    L.push(`// Rate limit simples: ${spec.rateLimit} req/min por cliente`);
    L.push(`const janelas = new Map();`);
    L.push(`app.use((req, res, next) => {`);
    L.push(`  const id = req.get("X-Gather-Key") || req.ip;`);
    L.push(`  const agora = Date.now(); const j = janelas.get(id) || { n: 0, t: agora };`);
    L.push(`  if (agora - j.t > 60000) { j.n = 0; j.t = agora; }`);
    L.push(`  j.n++; janelas.set(id, j);`);
    L.push(`  if (j.n > ${spec.rateLimit}) return res.status(429).json({ erro: "Limite excedido", codigo: "GATHER_429" });`);
    L.push(`  next();`);
    L.push(`});`);
    L.push(``);
    spec.endpoints.forEach((e) => {
      const p = e.path.replace(/\{(\w+)\}/g, ":$1");
      const m = e.method.toLowerCase();
      const col = spec.resources.find((r) => r.name === e.resource) ? `db.${e.resource}` : null;
      L.push(`// ${e.summary}`);
      if (e.action === "health") {
        L.push(`app.${m}("${p}", (req, res) => res.json({ status: "ok", uptime: (Date.now() - inicio) / 1000 }));`);
      } else if (col && e.action === "list") {
        L.push(`app.${m}("${p}", (req, res) => {`);
        L.push(`  const limite = Math.min(+req.query.limite || 20, 100), pagina = Math.max(+req.query.pagina || 1, 1);`);
        L.push(`  const todos = [...${col}.values()];`);
        L.push(`  res.json({ dados: todos.slice((pagina - 1) * limite, pagina * limite), total: todos.length });`);
        L.push(`});`);
      } else if (col && e.action === "get") {
        L.push(`app.${m}("${p}", (req, res) => {`);
        L.push(`  const item = ${col}.get(req.params.id);`);
        L.push(`  item ? res.json(item) : res.status(404).json({ erro: "Não encontrado", codigo: "GATHER_404" });`);
        L.push(`});`);
      } else if (col && e.action === "create") {
        L.push(`app.${m}("${p}", (req, res) => {`);
        L.push(`  const item = { id: crypto.randomUUID(), ...req.body };`);
        L.push(`  ${col}.set(item.id, item);`);
        L.push(`  res.status(201).json(item);`);
        L.push(`});`);
      } else if (col && e.action === "update") {
        L.push(`app.${m}("${p}", (req, res) => {`);
        L.push(`  const item = ${col}.get(req.params.id);`);
        L.push(`  if (!item) return res.status(404).json({ erro: "Não encontrado", codigo: "GATHER_404" });`);
        L.push(`  Object.assign(item, req.body, { id: item.id });`);
        L.push(`  res.json(item);`);
        L.push(`});`);
      } else if (col && e.action === "remove") {
        L.push(`app.${m}("${p}", (req, res) => {`);
        L.push(`  ${col}.delete(req.params.id) ? res.status(204).end() : res.status(404).json({ erro: "Não encontrado", codigo: "GATHER_404" });`);
        L.push(`});`);
      } else if (e.action === "stream") {
        L.push(`app.${m}("${p}", (req, res) => {`);
        L.push(`  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });`);
        L.push(`  const t = setInterval(() => res.write(\`data: \${JSON.stringify({ ts: Date.now() })}\\n\\n\`), 1000);`);
        L.push(`  req.on("close", () => clearInterval(t));`);
        L.push(`});`);
      } else {
        L.push(`app.${m}("${p}", (req, res) => {`);
        L.push(`  // TODO: implementar lógica de "${e.summary}"`);
        L.push(`  res.json({ ok: true, recebido: req.body || null });`);
        L.push(`});`);
      }
      L.push(``);
    });
    L.push(`const PORT = process.env.PORT || 3000;`);
    L.push(`app.listen(PORT, () => console.log("[GATHER] ${spec.name} ouvindo na porta " + PORT));`);
    return L.join("\n");
  }

  /* ---------- Cliente JavaScript ---------- */
  function toJsClient(spec) {
    const cls = pascal(spec.slug) + "Client";
    const L = [];
    L.push(`// Cliente ${spec.name} — gerado pela GATHER 0.1`);
    L.push(`export class ${cls} {`);
    L.push(`  constructor({ baseUrl = "${spec.baseUrl}", chave } = {}) {`);
    L.push(`    this.baseUrl = baseUrl; this.chave = chave;`);
    L.push(`  }`);
    L.push(`  async #req(method, path, body, query) {`);
    L.push(`    const url = new URL(this.baseUrl + path);`);
    L.push(`    if (query) Object.entries(query).forEach(([k, v]) => v != null && url.searchParams.set(k, v));`);
    L.push(`    const headers = { "Content-Type": "application/json" };`);
    if (spec.auth === "apiKey") L.push(`    if (this.chave) headers["X-Gather-Key"] = this.chave;`);
    else if (spec.auth !== "none") L.push(`    if (this.chave) headers["Authorization"] = "Bearer " + this.chave;`);
    L.push(`    const r = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });`);
    L.push(`    if (!r.ok) throw new Error(\`[\${r.status}] \${await r.text()}\`);`);
    L.push(`    return r.status === 204 ? null : r.json();`);
    L.push(`  }`);
    spec.endpoints.filter((e) => e.action !== "stream").forEach((e) => {
      const params = (e.path.match(/\{(\w+)\}/g) || []).map((p) => p.slice(1, -1));
      const hasBody = ["POST", "PUT", "PATCH"].includes(e.method);
      const args = [...params, hasBody ? "dados" : null, e.action === "list" ? "filtros = {}" : null].filter(Boolean);
      const pathExpr = "`" + e.path.replace(/\{(\w+)\}/g, "${encodeURIComponent($1)}") + "`";
      L.push(`  /** ${e.summary} */`);
      L.push(`  ${operationId(e)}(${args.join(", ")}) { return this.#req("${e.method}", ${pathExpr}${hasBody ? ", dados" : e.action === "list" ? ", null, filtros" : ""}); }`);
    });
    L.push(`}`);
    L.push(``);
    L.push(`// Uso:`);
    L.push(`// const api = new ${cls}({ chave: process.env.GATHER_KEY });`);
    const first = spec.endpoints.find((e) => e.action === "list") || spec.endpoints[0];
    if (first) L.push(`// const r = await api.${operationId(first)}();`);
    return L.join("\n");
  }

  /* ---------- Cliente Python ---------- */
  function toPyClient(spec) {
    const cls = pascal(spec.slug) + "Client";
    const L = [];
    L.push(`# Cliente ${spec.name} — gerado pela GATHER 0.1`);
    L.push(`import requests`);
    L.push(``);
    L.push(`class ${cls}:`);
    L.push(`    def __init__(self, chave=None, base_url="${spec.baseUrl}"):`);
    L.push(`        self.base_url = base_url`);
    L.push(`        self.s = requests.Session()`);
    if (spec.auth === "apiKey") L.push(`        if chave: self.s.headers["X-Gather-Key"] = chave`);
    else if (spec.auth !== "none") L.push(`        if chave: self.s.headers["Authorization"] = f"Bearer {chave}"`);
    L.push(``);
    L.push(`    def _req(self, method, path, json=None, params=None):`);
    L.push(`        r = self.s.request(method, self.base_url + path, json=json, params=params, timeout=30)`);
    L.push(`        r.raise_for_status()`);
    L.push(`        return None if r.status_code == 204 else r.json()`);
    spec.endpoints.filter((e) => e.action !== "stream").forEach((e) => {
      const params = (e.path.match(/\{(\w+)\}/g) || []).map((p) => p.slice(1, -1));
      const hasBody = ["POST", "PUT", "PATCH"].includes(e.method);
      const args = ["self", ...params, hasBody ? "dados" : null, e.action === "list" ? "**filtros" : null].filter(Boolean);
      const pathExpr = (params.length ? "f" : "") + `"${e.path}"`;
      L.push(``);
      L.push(`    def ${snake(operationId(e).replace(/([A-Z])/g, "-$1"))}(${args.join(", ")}):`);
      L.push(`        """${e.summary}"""`);
      L.push(`        return self._req("${e.method}", ${pathExpr}${hasBody ? ", json=dados" : e.action === "list" ? ", params=filtros" : ""})`);
    });
    return L.join("\n");
  }

  /* ---------- Resposta simulada (playground) ---------- */
  function mockResponse(spec, endpoint, body) {
    const res = spec.resources.find((r) => r.name === endpoint.resource);
    const make = (i) => { const o = { id: `${endpoint.resource.slice(0, 3)}_${(1000 + i).toString(36)}` }; if (res) Object.entries(res.fields).forEach(([k, t]) => (o[k] = sampleValue(k, t, i))); return o; };
    const latency = Math.round(18 + Math.random() * 90);
    switch (endpoint.action) {
      case "health": return { status: 200, latency, body: { status: "ok", uptime: Math.round(Math.random() * 864000) } };
      case "list": return { status: 200, latency, body: { dados: [1, 2, 3].map(make), total: 3 } };
      case "get": return { status: 200, latency, body: make(1) };
      case "create": return { status: 201, latency, body: Object.assign(make(7), body || {}) };
      case "update": return { status: 200, latency, body: Object.assign(make(1), body || {}) };
      case "remove": return { status: 204, latency, body: null };
      case "stream": return { status: 200, latency, body: "data: {\"ts\": " + Date.now() + "}\n\n" };
      default: {
        if (endpoint.path === "/calculos/avaliar" && body && body.expressao) {
          let resultado = null;
          if (/^[\d\s+\-*/().,%^]+$/.test(body.expressao)) { try { resultado = Function(`"use strict";return (${body.expressao.replace(/\^/g, "**").replace(/,/g, ".")})`)(); } catch (_) { /* inválida */ } }
          return { status: resultado == null ? 400 : 200, latency, body: resultado == null ? { erro: "Expressão inválida", codigo: "GATHER_400" } : { expressao: body.expressao, resultado } };
        }
        return { status: 200, latency, body: { ok: true, recebido: body || null } };
      }
    }
  }

  global.Gather = {
    AIS, RESOURCES, interpret, build, toOpenAPI, toToolManifest, toExpress, toJsClient, toPyClient, mockResponse, operationId, slugify,
    version: "0.1",
  };
})(typeof window !== "undefined" ? window : globalThis);
