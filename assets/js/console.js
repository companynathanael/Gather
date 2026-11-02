/* ==========================================================
   GATHER CONSOLE 0.1 — Nathanael Industries
   ========================================================== */
(function () {
  "use strict";
  const G = window.Gather;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const aiName = (id) => (G.AIS.find((a) => a.id === id) || { name: id }).name;
  const AUTH_LABEL = { apiKey: "API Key", bearer: "Bearer", oauth2: "OAuth2", none: "Pública" };

  /* ---------- Armazenamento ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem("gather." + k); return v ? JSON.parse(v) : d; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem("gather." + k, JSON.stringify(v)); } catch (_) { /* sem storage */ } },
  };
  let apis = store.get("apis", []);
  let keys = store.get("keys", []);
  let activity = store.get("activity", []);
  const saveApis = () => store.set("apis", apis);
  const saveKeys = () => store.set("keys", keys);

  function log(msg, cls = "") {
    activity.unshift({ t: new Date().toISOString(), msg, cls });
    activity = activity.slice(0, 200);
    store.set("activity", activity);
    renderActivity();
  }

  function toast(msg) {
    const t = $("#toast"); $("#toast-msg").textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2600);
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast("Copiado para a área de transferência"); }
    catch (_) { toast("Não foi possível copiar"); }
  }

  function download(name, content, type = "application/json") {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function artifact(spec, kind) {
    switch (kind) {
      case "openapi": return { name: "openapi.json", code: JSON.stringify(G.toOpenAPI(spec), null, 2) };
      case "tools": return { name: "gather.tools.json", code: JSON.stringify(G.toToolManifest(spec), null, 2) };
      case "server": return { name: "server.js", code: G.toExpress(spec), type: "text/javascript" };
      case "js": return { name: "client.js", code: G.toJsClient(spec), type: "text/javascript" };
      case "py": return { name: "client.py", code: G.toPyClient(spec), type: "text/x-python" };
    }
  }

  /* ---------- Navegação ---------- */
  const VIEWS = ["criar", "catalogo", "roteador", "credenciais", "playground", "monitor"];
  function go(view) {
    if (!VIEWS.includes(view)) view = "criar";
    $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + view));
    $$("#seg button").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    renderStats();
    if (view === "catalogo") renderCatalog();
    if (view === "credenciais") renderKeys();
    if (view === "playground") renderPlayground();
    if (view === "monitor") renderMonitor();
    window.scrollTo(0, 0);
  }
  $$("#seg button").forEach((b) => b.addEventListener("click", () => { location.hash = b.dataset.view; }));
  window.addEventListener("hashchange", () => go(location.hash.slice(1)));

  function updateCounts() {
    const na = apis.length, nk = keys.filter((k) => !k.revoked).length;
    $("#c-apis").textContent = na; $("#c-apis").dataset.n = na;
    $("#c-keys").textContent = nk; $("#c-keys").dataset.n = nk;
    renderStats();
  }

  function fillAiSelect(sel, includeAll = true) {
    sel.innerHTML = G.AIS.filter((a) => includeAll || a.id !== "todas").map((a) => `<option value="${a.id}">${esc(a.name)} · ${esc(a.version)}</option>`).join("");
  }

  /* ================= ESTADO GERAL ================= */
  function renderStats() {
    $("#k-apis").textContent = apis.length;
    $("#k-pub").textContent = apis.filter((a) => a.status === "published").length;
    $("#k-eps").textContent = apis.reduce((n, a) => n + a.endpoints.length, 0);
    $("#k-keys").textContent = keys.filter((k) => !k.revoked).length;
    $("#ai-count").textContent = `${apis.length} API${apis.length === 1 ? "" : "s"}`;
    $("#by-ai").innerHTML = G.AIS.map((ai) => {
      const mine = apis.filter((a) => a.consumer === ai.id);
      const on = mine.filter((a) => a.status === "published").length;
      return `<div class="ai-item"><span class="av ${mine.length ? "hi" : ""}">${esc(ai.id === "todas" ? "*" : ai.name[0])}</span>
        <div><div class="nm">${esc(ai.name)}</div><div class="rl">${esc(ai.role)}</div></div>
        <span class="ct">${on ? '<span class="dot"></span>' : ""}${mine.length} API${mine.length === 1 ? "" : "s"}</span></div>`;
    }).join("");
    renderActivity();
  }
  function renderActivity() {
    const el = $("#activity"); if (!el) return;
    el.innerHTML = activity.length
      ? activity.slice(0, 40).map((a) => `<div class="${a.cls}"><span>${esc(a.msg)}<small>${ago(a.t)}</small></span></div>`).join("")
      : `<div><span class="muted">Nenhuma atividade ainda.</span></div>`;
  }
  function ago(t) {
    const s = Math.round((Date.now() - new Date(t)) / 1000);
    if (s < 60) return "agora";
    if (s < 3600) return `há ${Math.floor(s / 60)} min`;
    if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
    return new Date(t).toLocaleDateString("pt-BR");
  }

  /* ================= CRIAR ================= */
  const EXAMPLES = [
    "API de cotações em tempo real para o Miquéias listar ativos e consultar preços",
    "Horácio precisa gerenciar tarefas e lembretes com notificação por webhook",
    "Asafe: monitorar servidores e logs dos agentes, autenticação JWT",
    "API de cálculos para o Miquéias avaliar fórmulas",
    "Gerenciar permissões de acesso dos agentes para todas as IAs",
    "Horácio: agenda de compromissos e mensagens do Sr. Nathanael",
  ];
  let draft = null;
  let outTab = "openapi";

  $("#chips").innerHTML = EXAMPLES.map((e) => `<button class="chip">${esc(e)}</button>`).join("");
  $$("#chips .chip").forEach((c) => c.addEventListener("click", () => { $("#prompt").value = c.textContent; generate(); }));
  $("#btn-gerar").addEventListener("click", generate);
  $("#prompt").addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey || !e.shiftKey)) { e.preventDefault(); generate(); } });

  async function generate() {
    const text = $("#prompt").value.trim();
    if (!text) { toast("Descreva a API que a IA precisa"); return; }
    const btn = $("#btn-gerar"); btn.disabled = true;
    const think = $("#think"); think.innerHTML = "";
    const { spec, steps } = G.interpret(text);
    // Lição do laboratório: pedidos parecidos geravam o mesmo nome e o registro era bloqueado.
    // Agora a Gather avisa que já existe uma API parecida e numera a nova.
    const twin = apis.find((a) => a.slug === spec.slug);
    if (twin) {
      let n = 2; while (apis.some((a) => a.slug === G.slugify(`${spec.name} ${n}`))) n++;
      const again = G.build(Object.assign({}, spec, { name: `${spec.name} ${n}`, slug: undefined, baseUrl: undefined, id: undefined }));
      Object.assign(spec, { name: again.name, slug: again.slug, baseUrl: again.baseUrl });
      steps.push(`Já existe "${twin.name}" — considere reutilizá-la (Roteador). Nova API numerada como ${n}.`);
    }
    const lines = ["interpretando pedido…", ...steps, `Endpoints gerados: ${spec.endpoints.length}`, "Artefatos prontos: openapi.json, gather.tools.json, server.js, client.js, client.py"];
    for (let i = 0; i < lines.length; i++) {
      const cls = i === 0 ? "cy" : i === lines.length - 1 ? "ok" : "";
      think.insertAdjacentHTML("beforeend", `<div><span class="t">›</span> <span class="${cls}">${esc(lines[i])}</span></div>`);
      think.scrollTop = think.scrollHeight;
      await new Promise((r) => setTimeout(r, 140));
    }
    loadDraft(spec);
    btn.disabled = false;
    log(`Pedido interpretado: "${text.slice(0, 80)}"`, "cy");
  }

  function resourcesToText(resources) {
    return resources.map((r) => `${r.name}: ${Object.entries(r.fields).map(([k, t]) => `${k}:${t}`).join(", ")}`).join("\n");
  }
  function textToResources(txt) {
    return txt.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      const [name, rest = ""] = l.split(/:(.*)/s);
      const fields = {};
      rest.split(",").map((f) => f.trim()).filter(Boolean).forEach((f) => { const [k, t = "string"] = f.split(":").map((x) => x.trim()); if (k) fields[G.slugify(k).replace(/-/g, "_")] = ["string", "number", "integer", "boolean", "datetime"].includes(t) ? t : "string"; });
      return { name: name.trim(), fields: Object.keys(fields).length ? fields : { nome: "string" } };
    }).filter((r) => r.name);
  }

  function loadDraft(spec) {
    draft = JSON.parse(JSON.stringify(spec));
    $("#f-name").value = draft.name;
    $("#f-consumer").value = draft.consumer;
    $("#f-auth").value = draft.auth;
    $("#f-version").value = draft.version;
    $("#f-rate").value = draft.rateLimit;
    $("#f-base").value = draft.baseUrl;
    $("#f-desc").value = draft.description;
    $("#f-resources").value = resourcesToText(draft.resources);
    renderEndpoints();
    renderOutput();
  }

  function readDraft() {
    const prev = draft || {};
    const name = $("#f-name").value.trim() || "Nova API";
    const autoBase = !$("#f-base").value.trim() || $("#f-base").value.trim() === prev.baseUrl && G.slugify(prev.name) !== G.slugify(name);
    const eps = $$("#ep-list .ep").map((row) => ({
      method: $("select", row).value,
      path: $(".ep-path", row).value.trim(),
      summary: $(".ep-desc", row).value.trim(),
      action: row.dataset.action || "custom",
      resource: row.dataset.resource || undefined,
    })).filter((e) => e.path);
    // recalcula o recurso de cada endpoint pelo caminho (o usuário pode ter editado)
    eps.forEach((e) => { e.resource = (e.path.split("/")[1] || "root").replace(/[{}]/g, ""); });
    draft = G.build({
      id: prev.id, createdAt: prev.createdAt, status: prev.status,
      name, consumer: $("#f-consumer").value, auth: $("#f-auth").value,
      version: $("#f-version").value.trim() || "0.1.0",
      rateLimit: Math.max(1, parseInt($("#f-rate").value, 10) || 120),
      baseUrl: autoBase ? undefined : $("#f-base").value.trim(),
      description: $("#f-desc").value.trim(),
      resources: textToResources($("#f-resources").value),
      endpoints: eps,
    });
    if (autoBase) $("#f-base").value = draft.baseUrl;
    return draft;
  }

  function epRow(e) {
    const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
    const div = document.createElement("div");
    div.className = "ep"; div.dataset.action = e.action || "custom"; if (e.resource) div.dataset.resource = e.resource;
    div.innerHTML = `<select>${methods.map((m) => `<option ${m === e.method ? "selected" : ""}>${m}</option>`).join("")}</select>
      <input class="ep-path mono" value="${esc(e.path)}" placeholder="/recurso/{id}">
      <input class="ep-desc" value="${esc(e.summary)}" placeholder="Descrição">
      <button class="x" title="Remover">✕</button>`;
    $(".x", div).addEventListener("click", () => { div.remove(); renderOutput(); });
    $(".ep-path", div).addEventListener("input", () => { div.dataset.action = "custom"; });
    $("select", div).addEventListener("change", () => { div.dataset.action = "custom"; });
    return div;
  }
  function renderEndpoints() {
    const list = $("#ep-list"); list.innerHTML = "";
    (draft ? draft.endpoints : []).forEach((e) => list.appendChild(epRow(e)));
    if (!list.children.length) list.innerHTML = `<div class="hint">Nenhum endpoint. Gere pelo pedido ou adicione manualmente.</div>`;
  }

  function renderOutput() {
    const spec = readDraft();
    const a = artifact(spec, outTab);
    $("#out-code").textContent = a.code;
  }

  $$("#out-tabs button").forEach((b) => b.addEventListener("click", () => {
    $$("#out-tabs button").forEach((x) => x.classList.toggle("active", x === b));
    outTab = b.dataset.out; renderOutput();
  }));
  ["#f-name", "#f-consumer", "#f-auth", "#f-version", "#f-rate", "#f-base", "#f-desc", "#f-resources"].forEach((s) => $(s).addEventListener("input", debounce(renderOutput, 250)));
  $("#ep-list").addEventListener("input", debounce(renderOutput, 250));
  $("#ep-list").addEventListener("change", renderOutput);

  $("#btn-add-ep").addEventListener("click", () => {
    const list = $("#ep-list"); if (!$(".ep", list)) list.innerHTML = "";
    list.appendChild(epRow({ method: "GET", path: "/", summary: "" }));
    $(".ep:last-child .ep-path", list).focus();
  });
  $("#btn-add-res").addEventListener("click", () => {
    const t = $("#f-resources"); t.value = (t.value.trim() ? t.value.trim() + "\n" : "") + "novo_recurso: nome:string, criado_em:datetime"; t.focus(); renderOutput();
  });
  $("#btn-crud").addEventListener("click", () => {
    const spec = readDraft();
    const existing = new Set(spec.endpoints.map((e) => e.method + " " + e.path));
    const add = [];
    spec.resources.forEach((r) => {
      const b = "/" + r.name;
      [["GET", b, "list", `Listar ${r.name}`], ["GET", b + "/{id}", "get", `Consultar ${r.name} por ID`], ["POST", b, "create", `Criar em ${r.name}`], ["PATCH", b + "/{id}", "update", `Atualizar ${r.name}`], ["DELETE", b + "/{id}", "remove", `Remover de ${r.name}`]]
        .forEach(([method, path, action, summary]) => { if (!existing.has(method + " " + path)) add.push({ method, path, action, summary, resource: r.name }); });
    });
    if (!existing.has("GET /health")) add.push({ method: "GET", path: "/health", action: "health", summary: "Verificar saúde da API", resource: "health" });
    const list = $("#ep-list"); if (!$(".ep", list)) list.innerHTML = "";
    add.forEach((e) => list.appendChild(epRow(e)));
    renderOutput(); toast(`${add.length} endpoint(s) adicionados`);
  });
  $("#btn-dl").addEventListener("click", () => { const a = artifact(readDraft(), outTab); download(a.name, a.code, a.type); });
  function resetForm() {
    $("#prompt").value = ""; $("#think").innerHTML = '<div class="t">aguardando pedido…</div>';
    draft = null;
    loadDraft(G.build({ name: "", endpoints: [{ method: "GET", path: "/health", summary: "Verificar saúde da API", action: "health", resource: "health" }] }));
    $("#f-name").value = "";
  }
  $("#btn-reset").addEventListener("click", resetForm);

  function register(publish) {
    const spec = readDraft();
    if (!spec.endpoints.length) { toast("Adicione ao menos um endpoint"); return; }
    if (!$("#f-name").value.trim()) { toast("Dê um nome para a API"); $("#f-name").focus(); return; }
    const dup = apis.find((a) => a.slug === spec.slug && a.id !== spec.id);
    if (dup) { toast(`Já existe uma API com o identificador "${spec.slug}"`); return; }
    spec.status = publish ? "published" : spec.status === "published" ? "published" : "draft";
    spec.updatedAt = new Date().toISOString();
    const i = apis.findIndex((a) => a.id === spec.id);
    if (i >= 0) apis[i] = spec; else apis.unshift(spec);
    saveApis(); updateCounts();
    log(`API ${i >= 0 ? "atualizada" : "registrada"}: ${spec.name} (${spec.endpoints.length} endpoints) → ${aiName(spec.consumer)}`, "ok");
    if (publish) log(`API ativada: ${spec.baseUrl}`, "cy");
    toast(publish ? "API registrada e ativada" : "Rascunho salvo no catálogo");
    resetForm(); location.hash = "catalogo";
  }
  $("#btn-register").addEventListener("click", () => register(false));
  $("#btn-register-pub").addEventListener("click", () => register(true));

  /* ================= CATÁLOGO ================= */
  function renderCatalog() {
    const q = ($("#cat-search").value || "").toLowerCase();
    const f = $("#cat-filter").value;
    const rows = apis.filter((a) => (!f || a.consumer === f) && (!q || (a.name + " " + a.slug + " " + a.description).toLowerCase().includes(q)));
    $("#cat-body").innerHTML = rows.length ? rows.map((a) => `
      <tr data-id="${a.id}">
        <td><b>${esc(a.name)}</b><div class="sub">${esc(a.baseUrl)}</div></td>
        <td>${esc(aiName(a.consumer))}</td>
        <td class="mono">${esc(a.version)}</td>
        <td class="mono">${a.endpoints.length}</td>
        <td>${AUTH_LABEL[a.auth] || a.auth}</td>
        <td>${a.status === "published" ? `<span class="pill ok">ativa</span>` : `<span class="pill">rascunho</span>`}</td>
        <td class="acts">
          <button class="btn sm ghost" data-act="ver">Ver</button>
          <button class="btn sm ghost" data-act="editar">Editar</button>
          <button class="btn sm ghost" data-act="pub">${a.status === "published" ? "Desativar" : "Ativar"}</button>
          <button class="btn sm ghost" data-act="testar">Testar</button>
          <button class="btn sm danger" data-act="del">✕</button>
        </td>
      </tr>`).join("") : `<tr><td colspan="7" class="empty-cell">${empty(apis.length ? "Nenhuma API encontrada." : "Nenhuma API criada ainda.", apis.length ? "Ajuste a busca ou o filtro." : 'Crie a primeira em <a href="#criar">Criar API</a> ou carregue os exemplos ao lado.')}</td></tr>`;
  }
  $("#cat-search").addEventListener("input", renderCatalog);
  $("#cat-filter").addEventListener("change", renderCatalog);
  $("#cat-body").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-act]"); if (!btn) return;
    const id = btn.closest("tr").dataset.id; const api = apis.find((a) => a.id === id); if (!api) return;
    const act = btn.dataset.act;
    if (act === "ver") openModal(api);
    if (act === "editar") { location.hash = "criar"; setTimeout(() => loadDraft(api), 0); }
    if (act === "pub") {
      api.status = api.status === "published" ? "draft" : "published"; saveApis();
      log(`${api.status === "published" ? "Ativada" : "Desativada"}: ${api.name}`, api.status === "published" ? "cy" : "warn"); renderCatalog(); renderStats();
    }
    if (act === "testar") { location.hash = "playground"; setTimeout(() => { $("#p-api").value = api.id; fillEndpoints(); }, 0); }
    if (act === "del" && confirm(`Excluir a API "${api.name}"? As credenciais vinculadas serão revogadas.`)) {
      apis = apis.filter((a) => a.id !== id); saveApis();
      keys.forEach((k) => { if (k.api === id) k.revoked = true; }); saveKeys();
      log(`API removida: ${api.name}`, "err"); updateCounts(); renderCatalog();
    }
  });

  /* ---------- Modal ---------- */
  let modalApi = null;
  function openModal(api) {
    modalApi = api;
    $("#m-title").textContent = api.name;
    $("#m-meta").innerHTML = `<span class="pill cy">${esc(aiName(api.consumer))}</span><span class="pill">v${esc(api.version)}</span><span class="pill">${AUTH_LABEL[api.auth]}</span><span class="pill">${api.rateLimit} req/min</span><span class="mono hint">${esc(api.baseUrl)}</span>`;
    $$("#m-tabs button").forEach((b, i) => b.classList.toggle("active", i === 0));
    renderModalTab("endpoints");
    $("#modal").classList.add("open");
  }
  function renderModalTab(kind) {
    const el = $("#m-content");
    if (kind === "endpoints") {
      el.innerHTML = `<div class="table-wrap"><table><tbody>${modalApi.endpoints.map((e) => `<tr><td><span class="method m-${e.method}">${e.method}</span></td><td class="mono">${esc(e.path)}</td><td class="muted">${esc(e.summary)}</td></tr>`).join("")}</tbody></table></div>`;
      return;
    }
    const a = artifact(modalApi, kind);
    el.innerHTML = `<div class="flex" style="justify-content:flex-end;margin-bottom:8px"><button class="btn sm ghost" id="m-copy">Copiar</button><button class="btn sm ghost" id="m-dl">Baixar ${a.name}</button></div><pre class="code"></pre>`;
    $("pre", el).textContent = a.code;
    $("#m-copy").onclick = () => copy(a.code);
    $("#m-dl").onclick = () => download(a.name, a.code, a.type);
  }
  $$("#m-tabs button").forEach((b) => b.addEventListener("click", () => { $$("#m-tabs button").forEach((x) => x.classList.toggle("active", x === b)); renderModalTab(b.dataset.out); }));
  $("#m-close").addEventListener("click", () => $("#modal").classList.remove("open"));
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") $("#modal").classList.remove("open"); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#modal").classList.remove("open"); });

  /* ================= ROTEADOR ================= */
  function route() {
    const ai = $("#r-ai").value; const need = $("#r-need").value.trim();
    if (!need) { toast("Descreva a necessidade"); return; }
    const words = G.slugify(need).split("-").filter((w) => w.length > 2);
    const { spec: wanted } = G.interpret(need);
    const wantedRes = new Set(wanted.resources.map((r) => r.name));
    const scored = apis.map((a) => {
      let score = 0; const reasons = [];
      const overlap = a.resources.filter((r) => wantedRes.has(r.name)).map((r) => r.name);
      if (overlap.length) { score += 50 * overlap.length; reasons.push(`recursos: ${overlap.join(", ")}`); }
      const hay = G.slugify(a.name + " " + a.description + " " + a.endpoints.map((e) => e.summary + " " + e.path).join(" "));
      const hits = words.filter((w) => hay.includes(w));
      if (hits.length) { score += 8 * hits.length; reasons.push(`termos: ${hits.slice(0, 5).join(", ")}`); }
      if (a.consumer === ai || a.consumer === "todas") { score += 15; reasons.push("acesso permitido à IA"); }
      else if (score) { score -= 10; reasons.push(`pertence a ${aiName(a.consumer)} — exige credencial cruzada`); }
      if (a.status === "published") { score += 10; reasons.push("ativa"); }
      return { a, score, reasons };
    }).filter((x) => x.score > 20).sort((x, y) => y.score - x.score);

    const out = $("#route-out");
    log(`Roteador: ${aiName(ai)} pediu "${need.slice(0, 60)}" → ${scored.length ? scored[0].a.name : "nenhuma API compatível"}`, scored.length ? "cy" : "warn");
    if (!scored.length) {
      out.innerHTML = `<div class="glow-card"><b>Nenhuma API compatível encontrada</b><p class="muted">A Gather pode criar uma nova API para ${esc(aiName(ai))} com os recursos: <b>${esc([...wantedRes].join(", "))}</b>.</p><button class="btn" id="r-create">Criar esta API</button></div>`;
      $("#r-create").onclick = () => { location.hash = "criar"; setTimeout(() => { $("#prompt").value = `${need} para ${aiName(ai)}`; generate(); }, 0); };
      return;
    }
    out.innerHTML = scored.slice(0, 5).map((x, i) => {
      const op = x.a.endpoints.find((e) => wantedRes.has(e.resource) && e.action === "list") || x.a.endpoints[0];
      return `<div class="${i === 0 ? "glow-card" : "table-wrap"}" style="${i === 0 ? "" : "padding:16px"}">
        <div class="flex">${i === 0 ? '<span class="pill solid">recomendada</span>' : ""}<b>${esc(x.a.name)}</b><span class="spacer"></span><span class="mono" style="color:var(--cyan)">score ${x.score}</span></div>
        <div class="hint" style="margin-top:6px">${esc(x.reasons.join(" · "))}</div>
        <div class="mt mono" style="font-size:13px">Chamada sugerida: <span class="method m-${op.method}">${op.method}</span> ${esc(x.a.baseUrl + op.path)}</div>
      </div>`;
    }).join("");
  }
  $("#btn-route").addEventListener("click", route);
  $("#r-need").addEventListener("keydown", (e) => { if (e.key === "Enter") route(); });

  /* ================= CREDENCIAIS ================= */
  async function sha256(text) {
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    // fallback (contexto não seguro): hash simples, não criptográfico
    let h = 0; for (const c of text) h = (h * 31 + c.charCodeAt(0)) | 0; return "fnv" + (h >>> 0).toString(16);
  }
  function randomKey() {
    const bytes = new Uint8Array(24); crypto.getRandomValues(bytes);
    return "gth_live_" + [...bytes].map((b) => "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"[b % 62]).join("");
  }
  function renderKeys() {
    fillApiSelect($("#k-api"), true);
    $("#keys-body").innerHTML = keys.length ? keys.map((k) => {
      const api = apis.find((a) => a.id === k.api);
      const expired = k.expires && new Date(k.expires) < new Date();
      const st = k.revoked ? `<span class="pill err">revogada</span>` : expired ? `<span class="pill warn">expirada</span>` : `<span class="pill ok">ativa</span>`;
      return `<tr data-id="${k.id}"><td class="mono">${esc(k.prefix)}…${esc(k.suffix)}</td><td>${esc(aiName(k.ai))}</td><td>${api ? esc(api.name) : k.api === "*" ? "Todas" : '<span class="hint">removida</span>'}</td><td>${esc(k.scope)}</td><td class="mono">${k.expires ? new Date(k.expires).toLocaleDateString("pt-BR") : "—"}</td><td class="mono">${k.uses || 0}</td><td>${st}</td><td>${k.revoked ? "" : '<button class="btn sm danger" data-act="revoke">Revogar</button>'}</td></tr>`;
    }).join("") : `<tr><td colspan="8" class="empty-cell">${empty("Nenhuma chave emitida.", "Emita uma chave ao lado para que uma IA possa acessar as APIs.")}</td></tr>`;
  }
  function fillApiSelect(sel, withAll) {
    const cur = sel.value;
    sel.innerHTML = (withAll ? `<option value="*">Todas as APIs</option>` : "") + apis.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join("");
    if ([...sel.options].some((o) => o.value === cur)) sel.value = cur;
  }
  $("#btn-issue").addEventListener("click", async () => {
    const key = randomKey();
    const days = +$("#k-exp").value;
    const rec = {
      id: "key_" + Date.now().toString(36), ai: $("#k-ai").value, api: $("#k-api").value, scope: $("#k-scope").value,
      hash: await sha256(key), prefix: key.slice(0, 13), suffix: key.slice(-4), uses: 0,
      created: new Date().toISOString(), expires: days ? new Date(Date.now() + days * 864e5).toISOString() : null, revoked: false,
    };
    keys.unshift(rec); saveKeys(); updateCounts();
    $("#new-key").innerHTML = `<div class="glow-card"><div class="hint">Copie agora — esta chave não será exibida novamente.</div><div class="flex mt"><code class="mono" style="color:var(--cyan);word-break:break-all;flex:1">${esc(key)}</code><button class="btn sm" id="copy-key">Copiar</button><button class="btn sm ghost" id="use-key">Usar no Playground</button></div></div>`;
    $("#copy-key").onclick = () => copy(key);
    $("#use-key").onclick = () => { location.hash = "playground"; setTimeout(() => { $("#p-key").value = key; if (rec.api !== "*") { $("#p-api").value = rec.api; fillEndpoints(); } }, 0); };
    log(`Credencial emitida para ${aiName(rec.ai)} (${rec.scope}) — ${rec.prefix}…${rec.suffix}`, "ok");
    renderKeys();
  });
  $("#keys-body").addEventListener("click", (ev) => {
    const b = ev.target.closest("button[data-act=revoke]"); if (!b) return;
    const k = keys.find((x) => x.id === b.closest("tr").dataset.id);
    if (k && confirm("Revogar esta credencial?")) { k.revoked = true; saveKeys(); updateCounts(); log(`Credencial revogada: ${k.prefix}…${k.suffix}`, "err"); renderKeys(); }
  });

  /* ================= PLAYGROUND ================= */
  function renderPlayground() { fillApiSelect($("#p-api"), false); fillEndpoints(); }
  function fillEndpoints() {
    const api = apis.find((a) => a.id === $("#p-api").value);
    $("#p-ep").innerHTML = api ? api.endpoints.map((e, i) => `<option value="${i}">${e.method} ${esc(e.path)}</option>`).join("") : `<option>— registre uma API primeiro —</option>`;
    updatePgFields();
  }
  function currentEp() { const api = apis.find((a) => a.id === $("#p-api").value); return api ? { api, ep: api.endpoints[+$("#p-ep").value] } : {}; }
  function updatePgFields() {
    const { api, ep } = currentEp();
    const hasParams = ep && /\{\w+\}/.test(ep.path);
    $("#p-params-wrap").style.display = hasParams ? "" : "none";
    if (hasParams && !$("#p-params").value) $("#p-params").value = (ep.path.match(/\{(\w+)\}/g) || []).map((p) => p.slice(1, -1) + "=abc123").join("&");
    const hasBody = ep && ["POST", "PUT", "PATCH"].includes(ep.method);
    $("#p-body-wrap").style.display = hasBody ? "" : "none";
    if (hasBody) {
      const res = api.resources.find((r) => r.name === ep.resource);
      const sample = {};
      if (ep.path === "/calculos/avaliar") sample.expressao = "(2^10 + 6) / 2";
      else if (res) Object.entries(res.fields).forEach(([k, t]) => (sample[k] = t === "number" || t === "integer" ? 0 : t === "boolean" ? false : t === "datetime" ? new Date().toISOString() : ""));
      $("#p-body").value = JSON.stringify(sample, null, 2);
    }
    $("#p-curl").textContent = ep ? curlFor(api, ep) : "";
  }
  function resolvePath(ep) {
    const params = new URLSearchParams($("#p-params").value);
    return ep.path.replace(/\{(\w+)\}/g, (_, n) => encodeURIComponent(params.get(n) || n));
  }
  function curlFor(api, ep) {
    const hasBody = ["POST", "PUT", "PATCH"].includes(ep.method);
    const auth = api.auth === "apiKey" ? ` \\\n  -H "X-Gather-Key: $GATHER_KEY"` : api.auth === "none" ? "" : ` \\\n  -H "Authorization: Bearer $TOKEN"`;
    return `curl -X ${ep.method} "${api.baseUrl}${resolvePath(ep)}"${auth}${hasBody ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${($("#p-body").value || "{}").replace(/\s+/g, " ")}'` : ""}`;
  }
  $("#p-api").addEventListener("change", fillEndpoints);
  $("#p-ep").addEventListener("change", () => { $("#p-params").value = ""; updatePgFields(); });
  ["#p-params", "#p-body"].forEach((s) => $(s).addEventListener("input", () => { const { api, ep } = currentEp(); if (ep) $("#p-curl").textContent = curlFor(api, ep); }));

  $("#btn-send").addEventListener("click", async () => {
    const { api, ep } = currentEp(); if (!ep) { toast("Registre uma API primeiro"); return; }
    const setStatus = (code, lat) => {
      $("#p-status").className = "pill " + (code < 300 ? "ok" : code < 500 ? "warn" : "err");
      $("#p-status").textContent = `HTTP ${code}`; $("#p-lat").textContent = lat != null ? `${lat} ms` : "";
    };
    let body = null;
    if (["POST", "PUT", "PATCH"].includes(ep.method)) {
      try { body = JSON.parse($("#p-body").value || "{}"); } catch (e) { setStatus(400); $("#p-out").textContent = JSON.stringify({ erro: "JSON inválido no corpo", detalhe: e.message, codigo: "GATHER_400" }, null, 2); return; }
    }
    // autenticação
    if (api.auth === "apiKey" && ep.action !== "health") {
      const k = $("#p-key").value.trim();
      const h = k ? await sha256(k) : "";
      const rec = keys.find((x) => x.hash === h);
      const now = new Date();
      let err = null;
      if (!rec) err = [401, "Chave inválida ou ausente"];
      else if (rec.revoked) err = [401, "Chave revogada"];
      else if (rec.expires && new Date(rec.expires) < now) err = [401, "Chave expirada"];
      else if (rec.api !== "*" && rec.api !== api.id) err = [403, "Chave não autorizada para esta API"];
      else if (rec.scope === "read" && ep.method !== "GET") err = [403, "Escopo de leitura não permite " + ep.method];
      if (err) { setStatus(err[0], 3); $("#p-out").textContent = JSON.stringify({ erro: err[1], codigo: "GATHER_" + err[0] }, null, 2); log(`Playground ${ep.method} ${ep.path} → ${err[0]} (${err[1]})`, "err"); return; }
      rec.uses = (rec.uses || 0) + 1; rec.lastUsed = now.toISOString(); saveKeys();
    }
    $("#p-status").className = "pill cy"; $("#p-status").textContent = "enviando…";
    const r = G.mockResponse(api, ep, body);
    await new Promise((res) => setTimeout(res, r.latency));
    setStatus(r.status, r.latency);
    $("#p-out").textContent = r.body == null ? "// 204 No Content" : typeof r.body === "string" ? r.body : JSON.stringify(r.body, null, 2);
    log(`Playground ${ep.method} ${api.slug}${resolvePath(ep)} → ${r.status} em ${r.latency}ms`, r.status < 300 ? "ok" : "warn");
  });

  /* ================= MONITOR ================= */
  const mon = {}; let monOn = true; let monTimer = null;
  function monState(api) {
    if (!mon[api.id]) mon[api.id] = { lat: [], checks: 0, fails: 0, errors: 0, down: false };
    return mon[api.id];
  }
  function spark(values) {
    if (values.length < 2) return "";
    const max = Math.max(...values), min = Math.min(...values), w = 120, h = 28;
    const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 2 - ((v - min) / (max - min || 1)) * (h - 4)}`);
    return `<svg class="spark" viewBox="0 0 ${w} ${h}"><path d="M${pts.join(" L")}"/></svg>`;
  }
  function tick() {
    const pub = apis.filter((a) => a.status === "published");
    pub.forEach((a) => {
      const s = monState(a);
      s.checks++;
      // simulação: pequenas chances de degradação/queda
      if (!s.down && Math.random() < 0.015) { s.down = true; monLog(`${a.name} indisponível (timeout)`, "err"); }
      else if (s.down && Math.random() < 0.35) { s.down = false; monLog(`${a.name} recuperada`, "ok"); }
      if (s.down) { s.fails++; s.lat.push(0); }
      else {
        const base = 30 + a.endpoints.length * 2;
        const l = Math.round(base + Math.random() * 40 + (Math.random() < 0.05 ? 300 : 0));
        if (l > 300) monLog(`${a.name} latência alta: ${l}ms`, "warn");
        if (Math.random() < 0.02) s.errors++;
        s.lat.push(l);
      }
      s.lat = s.lat.slice(-30);
    });
    if ($("#view-monitor").classList.contains("active")) renderMonitorTable();
  }
  function monLog(msg, cls) {
    const el = $("#mon-log");
    el.insertAdjacentHTML("afterbegin", `<div><span class="t">${new Date().toLocaleTimeString("pt-BR")}</span> <span class="${cls}">${esc(msg)}</span></div>`);
    while (el.children.length > 150) el.lastChild.remove();
  }
  function renderMonitorTable() {
    const pub = apis.filter((a) => a.status === "published");
    const all = pub.flatMap((a) => monState(a).lat.filter((x) => x > 0)).sort((x, y) => x - y);
    $("#m-active").textContent = pub.length;
    $("#m-down").textContent = pub.filter((a) => monState(a).down).length;
    $("#m-p50").textContent = (all.length ? all[Math.floor(all.length / 2)] : 0) + " ms";
    $("#m-checks").textContent = pub.reduce((n, a) => n + monState(a).checks, 0);
    $("#mon-body").innerHTML = pub.length ? pub.map((a) => {
      const s = monState(a);
      const ok = s.lat.filter((x) => x > 0).sort((x, y) => x - y);
      const p50 = ok.length ? ok[Math.floor(ok.length / 2)] : 0;
      const up = s.checks ? (((s.checks - s.fails) / s.checks) * 100).toFixed(2) : "100.00";
      return `<tr><td><b>${esc(a.name)}</b><div class="sub">${esc(a.baseUrl)}/health</div></td>
        <td>${s.down ? '<span class="pill err">fora do ar</span>' : p50 > 200 ? '<span class="pill warn">degradada</span>' : '<span class="pill ok">operacional</span>'}</td>
        <td class="mono">${up}%</td><td class="mono">${p50} ms</td><td class="mono">${s.errors}</td><td>${spark(s.lat.filter((x) => x > 0))}</td></tr>`;
    }).join("") : `<tr><td colspan="6" class="empty-cell">${empty("Nenhuma API ativa.", "Ative uma API no catálogo para monitorá-la.")}</td></tr>`;
  }
  function renderMonitor() { renderMonitorTable(); if (!$("#mon-log").children.length) monLog("Monitor iniciado — verificando /health a cada 3s", "cy"); }
  function startMon() { clearInterval(monTimer); monTimer = setInterval(tick, 3000); tick(); }
  $("#btn-mon").addEventListener("click", () => {
    monOn = !monOn; $("#btn-mon").textContent = monOn ? "Pausar" : "Retomar";
    if (monOn) { startMon(); monLog("Monitor retomado", "cy"); } else { clearInterval(monTimer); monLog("Monitor pausado", "warn"); }
  });

  /* ================= CONFIG ================= */
  $("#btn-export").addEventListener("click", () => {
    download(`gather-registro-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ gather: G.version, exportadoEm: new Date().toISOString(), apis, keys }, null, 2));
  });
  $("#imp-file").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!Array.isArray(data.apis)) throw new Error("arquivo sem lista de APIs");
      const known = new Set(apis.map((a) => a.id));
      data.apis.map((a) => G.build(a)).forEach((a) => { if (!known.has(a.id)) apis.push(a); });
      if (Array.isArray(data.keys)) { const kk = new Set(keys.map((k) => k.id)); data.keys.forEach((k) => { if (!kk.has(k.id) && k.hash) keys.push(k); }); }
      saveApis(); saveKeys(); updateCounts(); go(location.hash.slice(1)); log(`Registro importado: ${data.apis.length} API(s)`, "ok"); toast("Importação concluída");
    } catch (err) { toast("Falha ao importar: " + err.message); }
    e.target.value = "";
  });
  $("#btn-seed").addEventListener("click", () => {
    const seeds = [
      ["API de cotações em tempo real para o Miquéias listar ativos e consultar preços", true],
      ["Horácio precisa gerenciar tarefas e lembretes com notificação por webhook", true],
      ["Asafe: monitorar servidores e logs dos agentes, autenticação JWT", true],
      ["API de cálculos para o Miquéias avaliar fórmulas", false],
    ];
    let n = 0;
    seeds.forEach(([t, pub]) => {
      const { spec } = G.interpret(t);
      if (apis.some((a) => a.slug === spec.slug)) return;
      spec.status = pub ? "published" : "draft"; apis.push(spec); n++;
    });
    saveApis(); updateCounts(); renderCatalog(); log(`${n} API(s) de exemplo carregadas`, "cy"); toast(n ? `${n} API(s) de exemplo carregadas` : "Exemplos já carregados");
  });
  $("#btn-wipe").addEventListener("click", () => {
    if (!confirm("Apagar todas as APIs, credenciais e atividade deste navegador?")) return;
    apis = []; keys = []; activity = []; saveApis(); saveKeys(); store.set("activity", []);
    Object.keys(mon).forEach((k) => delete mon[k]); updateCounts(); renderCatalog(); toast("Registro apagado");
  });

  /* ---------- Util ---------- */
  function empty(title, text) {
    return `<div class="empty"><img src="assets/img/gather-mark-cyan.png" alt=""><b>${esc(title)}</b><span>${text}</span></div>`;
  }
  function clock() { $("#clock").textContent = new Date().toLocaleTimeString("pt-BR"); }
  clock(); setInterval(clock, 1000);
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
  $$("[data-copy]").forEach((b) => b.addEventListener("click", () => copy($(b.dataset.copy).textContent)));

  /* ---------- Início ---------- */
  fillAiSelect($("#f-consumer"));
  fillAiSelect($("#r-ai"), false);
  fillAiSelect($("#k-ai"), false);
  $("#cat-filter").innerHTML = `<option value="">Todas as IAs</option>` + G.AIS.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join("");
  resetForm();
  if (!activity.length) log("Gather 0.1 iniciada. Console pronto.", "cy");
  updateCounts();
  startMon();
  go(location.hash.slice(1) || "criar");

  /* ---------- Inicialização (boot) ---------- */
  (function boot() {
    const el = $("#boot"); if (!el) return;
    const steps = ["inicializando motor de APIs", "carregando catálogo", "verificando credenciais", "conectando às IAs", "gather online"];
    let i = 0;
    const next = () => {
      $("#boot-status").textContent = steps[i];
      $("#boot-bar").style.width = ((i + 1) / steps.length) * 100 + "%";
      if (i === steps.length - 1) { el.classList.add("online"); setTimeout(() => el.classList.add("done"), 700); return; }
      i++; setTimeout(next, 380);
    };
    next();
  })();
})();
