// Laboratório da Gather: cria ~50 APIs, testa tudo (inclusive rodando o servidor gerado) e remove no final.
const fs = require("fs"), path = require("path"), { spawn, execFileSync } = require("child_process");
const ENGINE = process.env.ENGINE || path.join(__dirname, "..", "assets", "js", "gather-engine.js");
require(ENGINE); const G = globalThis.Gather;
const LAB = __dirname, OUT = path.join(LAB, "out");
const casos = JSON.parse(fs.readFileSync(path.join(LAB, "casos.json"), "utf8"));
const KEY = "gth_live_teste123";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const only = process.argv[2] ? process.argv[2].split(",").map(Number) : null;

function sample(t, k) {
  if (t === "number") return 12.5; if (t === "integer") return 3; if (t === "boolean") return true;
  if (t === "datetime") return "2026-11-02T10:00:00Z"; return "valor_" + k;
}

async function http(base, method, p, { body, headers = {}, raw } = {}) {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 3000);
  try {
    const r = await fetch(base + p, { method, headers: { "Content-Type": "application/json", ...headers }, body: body ? JSON.stringify(body) : undefined, signal: ctl.signal });
    if (raw) { const rd = r.body.getReader(); const { value } = await rd.read(); ctl.abort(); return { status: r.status, text: new TextDecoder().decode(value) }; }
    const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch (_) {}
    return { status: r.status, json, text };
  } catch (e) { return { status: 0, error: e.message }; } finally { clearTimeout(to); }
}

async function testCase(c, i) {
  const fail = []; const F = (cat, msg) => fail.push({ cat, msg });
  const { spec } = G.interpret(c.t);
  const resNames = spec.resources.map((r) => r.name);
  const actions = new Set(spec.endpoints.map((e) => e.action));

  // ---------- 1. Interpretação ----------
  if (c.ai && spec.consumer !== c.ai) F("interpretacao", `IA esperada ${c.ai}, veio ${spec.consumer}`);
  (c.res || []).forEach((r) => { if (!resNames.includes(r)) F("interpretacao", `faltou recurso "${r}" (veio: ${resNames.join(", ")})`); });
  (c.notRes || []).forEach((r) => { if (resNames.includes(r)) F("interpretacao", `recurso indevido "${r}"`); });
  if (c.auth && spec.auth !== c.auth) F("interpretacao", `auth esperada ${c.auth}, veio ${spec.auth}`);
  if (c.stream && !actions.has("stream")) F("interpretacao", "faltou stream em tempo real");
  if (c.webhook && !spec.endpoints.some((e) => e.path === "/webhooks")) F("interpretacao", "faltou webhook");
  if (c.crud && !["list", "get", "create", "update", "remove"].every((a) => actions.has(a))) F("interpretacao", "esperado CRUD completo");
  (c.has || []).forEach((a) => { if (!actions.has(a)) F("interpretacao", `faltou operação ${a}`); });
  if (c.rate && spec.rateLimit !== c.rate) F("interpretacao", `rate limit esperado ${c.rate}, veio ${spec.rateLimit}`);
  if (c.custom && !spec.endpoints.some((e) => e.path === c.custom)) F("interpretacao", `faltou rota ${c.custom}`);
  if (c.name && spec.name !== c.name) F("interpretacao", `nome esperado "${c.name}", veio "${spec.name}"`);
  if (!spec.endpoints.some((e) => e.path === "/health")) F("interpretacao", "sem /health");
  if (c.main && resNames[0] !== c.main) F("interpretacao", `recurso principal esperado ${c.main}, veio ${resNames[0]}`);
  const bad = (spec.name + " " + spec.endpoints.map((e) => e.summary).join(" ")).match(/\b\w+(ms|aos|ars|ãos|els)\b/gi);
  if (bad) F("linguagem", `plural errado: ${[...new Set(bad)].join(", ")}`);
  const keys = spec.endpoints.map((e) => e.method + " " + e.path);
  if (new Set(keys).size !== keys.length) F("interpretacao", "rotas duplicadas");

  // ---------- 2. OpenAPI ----------
  const oa = G.toOpenAPI(spec);
  const ids = []; const refs = JSON.stringify(oa).match(/"\$ref":"#\/components\/schemas\/(\w+)"/g) || [];
  refs.forEach((r) => { const n = r.split("/").pop().replace('"', ""); if (!oa.components.schemas[n]) F("openapi", `$ref quebrado ${n}`); });
  Object.entries(oa.paths).forEach(([p, ops]) => Object.entries(ops).forEach(([m, op]) => {
    ids.push(op.operationId);
    const params = (p.match(/\{(\w+)\}/g) || []).map((x) => x.slice(1, -1));
    params.forEach((n) => { if (!(op.parameters || []).some((q) => q.in === "path" && q.name === n)) F("openapi", `${m} ${p}: parâmetro ${n} não declarado`); });
    if (!op.responses || !Object.keys(op.responses).length) F("openapi", `${m} ${p}: sem respostas`);
  }));
  const dupIds = ids.filter((x, k) => ids.indexOf(x) !== k);
  if (dupIds.length) F("openapi", `operationId duplicado: ${[...new Set(dupIds)].join(", ")}`);

  // ---------- 3. Manifesto ----------
  const man = G.toToolManifest(spec);
  const tn = man.tools.map((t) => t.name);
  tn.forEach((n) => { if (!/^[a-zA-Z0-9_-]{1,64}$/.test(n)) F("manifesto", `nome de tool inválido: ${n}`); });
  if (new Set(tn).size !== tn.length) F("manifesto", "nomes de tool duplicados");
  man.tools.forEach((t) => (t.input_schema.required || []).forEach((r) => { if (!t.input_schema.properties[r]) F("manifesto", `${t.name}: required "${r}" sem propriedade`); }));

  // ---------- 4. Arquivos ----------
  const dir = path.join(OUT, String(i + 1).padStart(2, "0")); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "server.js"), G.toExpress(spec));
  fs.writeFileSync(path.join(dir, "client.mjs"), G.toJsClient(spec));
  fs.writeFileSync(path.join(dir, "client.py"), G.toPyClient(spec));
  fs.writeFileSync(path.join(dir, "openapi.json"), JSON.stringify(oa, null, 2));
  for (const [f, cmd, args] of [["server.js", "node", ["--check"]], ["client.mjs", "node", ["--check"]], ["client.py", "python3", ["-m", "py_compile"]]]) {
    try { execFileSync(cmd, [...args, path.join(dir, f)], { stdio: "pipe" }); } catch (e) { F("sintaxe", `${f}: ${String(e.stderr).split("\n").slice(0, 3).join(" ")}`); }
  }
  if (fail.some((f) => f.cat === "sintaxe")) return { c, spec, fail };

  // ---------- 5. Servidor real ----------
  const port = 4100 + i; const base = `http://127.0.0.1:${port}`;
  const srv = spawn("node", [path.join(dir, "server.js")], { cwd: LAB, env: { ...process.env, PORT: port, GATHER_KEYS: KEY } });
  let srvErr = ""; srv.stderr.on("data", (d) => (srvErr += d));
  let up = false; for (let k = 0; k < 40 && !up; k++) { await sleep(100); up = (await http(base, "GET", "/health")).status === 200; }
  try {
    if (!up) { F("servidor", "não subiu / health falhou " + srvErr.slice(0, 200)); return { c, spec, fail }; }
    const H = spec.auth === "apiKey" ? { "X-Gather-Key": KEY } : spec.auth === "none" ? {} : { Authorization: "Bearer token-teste" };
    const firstList = spec.endpoints.find((e) => e.action === "list") || spec.endpoints.find((e) => e.method === "GET" && e.action !== "health" && e.action !== "stream");
    if (spec.auth !== "none" && firstList && !firstList.path.includes("{")) {
      const r = await http(base, "GET", firstList.path);
      if (r.status !== 401) F("servidor", `sem credencial deveria dar 401, deu ${r.status}`);
      if (spec.auth === "apiKey") { const r2 = await http(base, "GET", firstList.path, { headers: { "X-Gather-Key": "errada" } }); if (r2.status !== 401) F("servidor", `chave errada deveria dar 401, deu ${r2.status}`); }
    }
    for (const res of spec.resources) {
      const eps = Object.fromEntries(spec.endpoints.filter((e) => e.resource === res.name).map((e) => [e.action, e]));
      const body = Object.fromEntries(Object.entries(res.fields).map(([k, t]) => [k, sample(t, k)]));
      if (eps.list) { const r = await http(base, "GET", eps.list.path, { headers: H }); if (r.status !== 200 || !Array.isArray(r.json?.dados)) F("servidor", `${eps.list.path} list: ${r.status}`); }
      if (!eps.create) continue;
      const cr = await http(base, "POST", eps.create.path, { headers: H, body });
      if (cr.status !== 201 || !cr.json?.id) { F("servidor", `POST ${eps.create.path}: ${cr.status}`); continue; }
      const id = cr.json.id; const one = (e) => e.path.replace("{id}", id);
      if (eps.list) { const r = await http(base, "GET", eps.list.path + "?limite=5&pagina=1", { headers: H }); if (r.json?.total !== 1) F("servidor", `list após criar: total ${r.json?.total}`); }
      if (eps.get) { const r = await http(base, "GET", one(eps.get), { headers: H }); if (r.status !== 200 || r.json?.id !== id) F("servidor", `GET por id: ${r.status}`); }
      if (eps.update) { const k0 = Object.keys(res.fields)[0]; const r = await http(base, "PATCH", one(eps.update), { headers: H, body: { [k0]: "mudou" } }); if (r.status !== 200 || r.json?.[k0] !== "mudou" || r.json?.id !== id) F("servidor", `PATCH: ${r.status}`); }
      if (eps.remove) {
        const r = await http(base, "DELETE", one(eps.remove), { headers: H }); if (r.status !== 204) F("servidor", `DELETE: ${r.status}`);
        if (eps.get) { const r2 = await http(base, "GET", one(eps.get), { headers: H }); if (r2.status !== 404) F("servidor", `GET após DELETE deveria 404, deu ${r2.status}`); }
      }
    }
    for (const e of spec.endpoints.filter((e) => e.action === "stream")) {
      const r = await http(base, "GET", e.path, { headers: H, raw: true });
      if (r.status !== 200 || !/^data: /.test(r.text || "")) F("servidor", `stream ${e.path}: ${r.status} ${r.error || ""}`);
    }
    for (const e of spec.endpoints.filter((e) => e.action === "custom")) {
      let p = e.path;
      if (p.includes("{id}")) {
        const res = spec.resources.find((r) => r.name === e.resource); const ce = spec.endpoints.find((x) => x.resource === e.resource && x.action === "create");
        const miss = await http(base, e.method, p.replace("{id}", "nao-existe"), { headers: H, body: {} });
        if (miss.status !== 404) F("servidor", `${e.path} com id inexistente deveria dar 404, deu ${miss.status}`);
        if (!ce) continue;
        const cr = await http(base, "POST", ce.path, { headers: H, body: Object.fromEntries(Object.entries(res.fields).map(([k, t]) => [k, sample(t, k)])) });
        p = p.replace("{id}", cr.json?.id);
      }
      const body = e.path === "/calculos/avaliar" ? { expressao: "(2+3)*4" } : { url: "https://exemplo/hook", eventos: ["*"] };
      const r = await http(base, e.method, p, { headers: H, body });
      if (r.status >= 300) F("servidor", `${e.method} ${e.path}: ${r.status}`);
      if (e.path === "/calculos/avaliar") { const bad = await http(base, "POST", p, { headers: H, body: { expressao: "process.exit()" } }); if (bad.status !== 400) F("seguranca", `/calculos/avaliar aceitou código: ${bad.status}`); }
      if (e.path === "/calculos/avaliar" && r.json?.resultado !== 20) F("servidor", `/calculos/avaliar não calcula (resposta: ${r.text.slice(0, 60)})`);
    }
    // ---------- 6. Cliente JS real ----------
    if (firstList && !firstList.path.includes("{")) {
      const cls = Object.keys(await import(path.join(dir, "client.mjs") + "?v=" + i))[0];
      const mod = await import(path.join(dir, "client.mjs") + "?v=" + i);
      const api = new mod[cls]({ baseUrl: base, chave: spec.auth === "apiKey" ? KEY : "token-teste" });
      try { const r = await api[G.operationId(firstList)](); if (!r) F("cliente-js", "resposta vazia"); }
      catch (e) { F("cliente-js", e.message.slice(0, 120)); }
      // ---------- 7. Cliente Python real ----------
      const pyName = G.operationId(firstList).replace(/([A-Z])/g, "_$1").toLowerCase();
      const py = `import importlib.util,sys\nspec=importlib.util.spec_from_file_location("c","${path.join(dir, "client.py")}")\nm=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)\ncls=[getattr(m,n) for n in dir(m) if n.endswith("Client")][0]\nc=cls(chave="${spec.auth === "apiKey" ? KEY : "token-teste"}",base_url="${base}")\nprint(getattr(c,"${pyName}")())`;
      try { execFileSync("python3", ["-I", "-c", py], { stdio: "pipe", timeout: 8000 }); } catch (e) { F("cliente-py", String(e.stderr).trim().split("\n").pop().slice(0, 140)); }
    }
    // ---------- 8. Rate limit ----------
    if (c.rate) {
      let last = 0; for (let k = 0; k < spec.rateLimit + 5; k++) last = (await http(base, "GET", "/health", { headers: H })).status;
      if (last !== 429) F("servidor", `rate limit não aplicado (última resposta ${last})`);
    }
  } finally { srv.kill(); }
  return { c, spec, fail };
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  const results = [];
  for (let i = 0; i < casos.length; i++) { if (only && !only.includes(i + 1)) continue; results.push(await testCase(casos[i], i)); }
  let ok = 0; const cats = {};
  results.forEach((r, k) => {
    const n = only ? only[k] : k + 1;
    if (!r.fail.length) ok++;
    r.fail.forEach((f) => (cats[f.cat] = (cats[f.cat] || 0) + 1));
    console.log(`${r.fail.length ? "✗" : "✓"} ${String(n).padStart(2)} ${r.spec.name.padEnd(42).slice(0, 42)} ${r.spec.endpoints.length} rotas${r.fail.length ? "\n     - " + r.fail.map((f) => `[${f.cat}] ${f.msg}`).join("\n     - ") : ""}`);
  });
  console.log(`\n${ok}/${results.length} APIs sem falhas`, JSON.stringify(cats));
  fs.writeFileSync(path.join(LAB, "resultado.json"), JSON.stringify(results.map((r) => ({ t: r.c.t, nome: r.spec.name, rotas: r.spec.endpoints.length, falhas: r.fail })), null, 2));
  // remoção das APIs geradas no laboratório
  fs.rmSync(OUT, { recursive: true, force: true });
  console.log("APIs do laboratório removidas:", !fs.existsSync(OUT));
})();
