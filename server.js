import http from "node:http";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR || path.join(__dirname, "data");
const dbPath = path.join(dataDir, "db.json");
const uploadsDir = path.join(dataDir, "uploads");
const port = Number(process.env.PORT || 3333);
const supabase = {
  url: normalizeSupabaseUrl(process.env.SUPABASE_URL || ""),
  key: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "",
  bucket: process.env.SUPABASE_BUCKET || "designer-artes",
};
supabase.enabled = Boolean(supabase.url && supabase.key);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

await ensureDatabase();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    await serveStatic(req, res, url);
  } catch (error) {
    sendJson(res, 500, { error: "Erro interno do servidor.", detail: error.message });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Designer Work System rodando em http://localhost:${port}`);
});

function normalizeSupabaseUrl(value) {
  return String(value || "")
    .trim()
    .replace(/\/rest\/v1\/?$/, "")
    .replace(/\/$/, "");
}

async function handleApi(req, res, url) {
  const segments = url.pathname.split("/").filter(Boolean);
  const method = req.method || "GET";

  if (method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true, time: new Date().toISOString(), storage: supabase.enabled ? "supabase" : "local" });
    return;
  }

  if (method === "GET" && url.pathname === "/api/settings") {
    const db = await readDb();
    sendJson(res, 200, db.settings);
    return;
  }

  if (method === "PUT" && url.pathname === "/api/settings") {
    const body = await readBody(req);
    const db = await readDb();
    db.settings = { ...db.settings, ...body, updatedAt: new Date().toISOString() };
    await writeDb(db);
    sendJson(res, 200, db.settings);
    return;
  }

  if (method === "GET" && url.pathname === "/api/finance") {
    const db = await readDb();
    sendJson(res, 200, normalizeFinance(db.finance));
    return;
  }

  if (method === "PUT" && url.pathname === "/api/finance/investments") {
    const body = await readBody(req);
    const db = await readDb();
    db.finance = normalizeFinance({
      ...db.finance,
      investments: Array.isArray(body.investments) ? body.investments : db.finance?.investments,
      updatedAt: new Date().toISOString(),
    });
    await writeDb(db);
    sendJson(res, 200, db.finance);
    return;
  }

  if (method === "POST" && url.pathname === "/api/finance/expenses") {
    const body = await readBody(req);
    const db = await readDb();
    db.finance = normalizeFinance(db.finance);
    const expense = normalizeExpense(body);
    db.finance.expenses.push(expense);
    db.finance.updatedAt = new Date().toISOString();
    await writeDb(db);
    sendJson(res, 201, expense);
    return;
  }

  if (segments[1] === "finance" && segments[2] === "expenses" && segments[3]) {
    const expenseId = segments[3];
    const db = await readDb();
    db.finance = normalizeFinance(db.finance);
    const expenseIndex = db.finance.expenses.findIndex((expense) => expense.id === expenseId);
    if (expenseIndex === -1) {
      sendJson(res, 404, { error: "Despesa nao encontrada." });
      return;
    }

    if (method === "PUT") {
      const body = await readBody(req);
      db.finance.expenses[expenseIndex] = normalizeExpense({ ...db.finance.expenses[expenseIndex], ...body, id: expenseId }, false);
      db.finance.updatedAt = new Date().toISOString();
      await writeDb(db);
      sendJson(res, 200, db.finance.expenses[expenseIndex]);
      return;
    }

    if (method === "DELETE") {
      const [deleted] = db.finance.expenses.splice(expenseIndex, 1);
      db.finance.updatedAt = new Date().toISOString();
      await writeDb(db);
      sendJson(res, 200, deleted);
      return;
    }
  }

  if (method === "GET" && url.pathname === "/api/clients") {
    const db = await readDb();
    sendJson(res, 200, db.clients || []);
    return;
  }

  if (method === "POST" && url.pathname === "/api/clients") {
    const body = await readBody(req);
    const db = await readDb();
    const client = normalizeClient(body);
    db.clients.push(client);
    await writeDb(db);
    sendJson(res, 201, client);
    return;
  }

  if (segments[1] === "clients" && segments[2]) {
    const clientId = segments[2];
    const db = await readDb();
    const clientIndex = db.clients.findIndex((client) => client.id === clientId);
    if (clientIndex === -1) {
      sendJson(res, 404, { error: "Cliente não encontrado." });
      return;
    }

    if (method === "PUT") {
      const body = await readBody(req);
      db.clients[clientIndex] = normalizeClient({ ...db.clients[clientIndex], ...body, id: clientId }, false);
      db.clients[clientIndex].updatedAt = new Date().toISOString();
      await writeDb(db);
      sendJson(res, 200, db.clients[clientIndex]);
      return;
    }

    if (method === "DELETE") {
      const [deleted] = db.clients.splice(clientIndex, 1);
      await writeDb(db);
      sendJson(res, 200, deleted);
      return;
    }
  }

  if (method === "GET" && url.pathname === "/api/tasks") {
    const db = await readDb();
    sendJson(res, 200, filterTasks(db.tasks, url).map((task) => withComputedTask(task)));
    return;
  }

  if (method === "POST" && url.pathname === "/api/tasks") {
    const body = await readBody(req);
    const db = await readDb();
    const task = normalizeTask(body);
    db.tasks.push(task);
    await writeDb(db);
    sendJson(res, 201, task);
    return;
  }

  if (segments[1] === "tasks" && segments[2]) {
    const taskId = segments[2];
    const db = await readDb();
    const taskIndex = db.tasks.findIndex((task) => task.id === taskId);
    if (taskIndex === -1) {
      sendJson(res, 404, { error: "Tarefa não encontrada." });
      return;
    }

    if (method === "PUT") {
      const body = await readBody(req);
      db.tasks[taskIndex] = normalizeTask({ ...db.tasks[taskIndex], ...body, id: taskId }, false);
      db.tasks[taskIndex].updatedAt = new Date().toISOString();
      await writeDb(db);
      sendJson(res, 200, withComputedTask(db.tasks[taskIndex]));
      return;
    }

    if (method === "PATCH" && segments[3] === "status") {
      const body = await readBody(req);
      db.tasks[taskIndex].status = body.status;
      db.tasks[taskIndex].updatedAt = new Date().toISOString();
      if (body.status !== "Concluído") db.tasks[taskIndex].completedAt = null;
      if (body.status === "Concluído") db.tasks[taskIndex].completedAt = new Date().toISOString();
      await writeDb(db);
      sendJson(res, 200, withComputedTask(db.tasks[taskIndex]));
      return;
    }

    if (method === "DELETE") {
      const [deleted] = db.tasks.splice(taskIndex, 1);
      await writeDb(db);
      sendJson(res, 200, deleted);
      return;
    }
  }

  if (method === "GET" && url.pathname === "/api/summary") {
    const db = await readDb();
    const date = url.searchParams.get("date") || localDate(new Date());
    sendJson(res, 200, getSummary(db.tasks, date));
    return;
  }

  if (method === "GET" && url.pathname === "/api/reports/client") {
    const db = await readDb();
    const clientName = url.searchParams.get("client") || "";
    const month = url.searchParams.get("month") || "";
    const reportTasks = db.tasks
      .filter((task) => !clientName || task.client === clientName)
      .filter((task) => !month || task.dueDate.startsWith(month))
      .map((task) => withComputedTask(task));
    const client = db.clients.find((item) => item.name === clientName) || null;
    sendJson(res, 200, {
      client,
      month,
      tasks: reportTasks,
      totals: {
        planned: reportTasks.length,
        done: reportTasks.filter((task) => task.status === "Concluído").length,
        pending: reportTasks.filter((task) => task.status !== "Concluído").length,
      },
    });
    return;
  }

  if (method === "GET" && url.pathname === "/api/uploads") {
    const db = await readDb();
    const client = url.searchParams.get("client");
    const uploads = (db.uploads || []).filter((upload) => !client || client === "all" || upload.client === client);
    sendJson(res, 200, uploads);
    return;
  }

  if (method === "POST" && url.pathname === "/api/uploads") {
    const body = await readBody(req);
    const db = await readDb();
    const upload = await saveUpload(body);
    db.uploads.unshift(upload);
    await writeDb(db);
    sendJson(res, 201, upload);
    return;
  }

  if (method === "GET" && url.pathname === "/api/notifications/due") {
    const db = await readDb();
    const now = url.searchParams.get("now") ? new Date(url.searchParams.get("now")) : new Date();
    const due = db.tasks.filter((task) => {
      if (!task.remindAt || task.status === "Concluído") return false;
      if (task.lastNotifiedAt) return false;
      return new Date(task.remindAt).getTime() <= now.getTime();
    });
    sendJson(res, 200, due);
    return;
  }

  if (method === "POST" && url.pathname === "/api/notifications/ack") {
    const body = await readBody(req);
    const ids = Array.isArray(body.ids) ? body.ids : [];
    const db = await readDb();
    const now = new Date().toISOString();
    db.tasks = db.tasks.map((task) => (ids.includes(task.id) ? { ...task, lastNotifiedAt: now } : task));
    await writeDb(db);
    sendJson(res, 200, { ok: true, acknowledged: ids.length });
    return;
  }

  sendJson(res, 404, { error: "Rota não encontrada." });
}

async function serveStatic(req, res, url) {
  let requested = decodeURIComponent(url.pathname);
  if (requested === "/") requested = "/index.html";

  const rootDir = requested.startsWith("/uploads/") ? uploadsDir : publicDir;
  const cleanRequest = requested.startsWith("/uploads/") ? requested.replace("/uploads/", "/") : requested;
  const target = path.normalize(path.join(rootDir, cleanRequest));
  if (!target.startsWith(rootDir)) {
    sendText(res, 403, "Acesso negado.");
    return;
  }

  try {
    const stat = await fs.stat(target);
    if (stat.isDirectory()) {
      sendText(res, 403, "Diretório não permitido.");
      return;
    }

    const ext = path.extname(target);
    res.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=300",
    });
    createReadStream(target).pipe(res);
  } catch {
    sendText(res, 404, "Arquivo não encontrado.");
  }
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("JSON inválido.");
  }
}

async function readDb() {
  if (supabase.enabled) return readRemoteDb();
  await ensureDatabase();
  const raw = await fs.readFile(dbPath, "utf8");
  return JSON.parse(raw);
}

async function writeDb(db) {
  if (supabase.enabled) {
    await writeRemoteDb(db);
    return;
  }
  await fs.mkdir(dataDir, { recursive: true });
  const tmp = `${dbPath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(tmp, dbPath);
}

async function ensureDatabase() {
  if (supabase.enabled) {
    const db = await readRemoteDb({ seedIfMissing: true });
    const migrated = migrateDb(db);
    if (migrated.changed) await writeRemoteDb(migrated.db);
    return;
  }
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(uploadsDir, { recursive: true });
  try {
    await fs.access(dbPath);
    const db = await readDbWithoutEnsure();
    const migrated = migrateDb(db);
    if (migrated.changed) await writeDb(migrated.db);
  } catch {
    await writeDb(createSeedDatabase());
  }
}

async function readDbWithoutEnsure() {
  const raw = await fs.readFile(dbPath, "utf8");
  return JSON.parse(raw);
}

async function readRemoteDb({ seedIfMissing = true } = {}) {
  const rows = await supabaseRequest("/rest/v1/designer_state?id=eq.main&select=data");
  if (!rows.length) {
    const seed = createSeedDatabase();
    if (seedIfMissing) await writeRemoteDb(seed);
    return seed;
  }

  const migrated = migrateDb(rows[0].data || createSeedDatabase());
  if (migrated.changed) await writeRemoteDb(migrated.db);
  return migrated.db;
}

async function writeRemoteDb(db) {
  await supabaseRequest("/rest/v1/designer_state?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      id: "main",
      data: db,
      updated_at: new Date().toISOString(),
    }),
  });
}

async function supabaseRequest(endpoint, options = {}) {
  const response = await fetch(`${supabase.url}${endpoint}`, {
    ...options,
    headers: {
      apikey: supabase.key,
      Authorization: `Bearer ${supabase.key}`,
      ...(options.body && typeof options.body === "string" ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase ${response.status}: ${detail}`);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function migrateDb(db) {
  let changed = false;
  if (!db.meta) {
    db.meta = createSeedDatabase().meta;
    changed = true;
  }
  if (!db.settings) {
    db.settings = createSeedDatabase().settings;
    changed = true;
  }
  if (!Array.isArray(db.clients)) {
    db.clients = createSeedClients();
    changed = true;
  }
  if (!Array.isArray(db.uploads)) {
    db.uploads = [];
    changed = true;
  }
  if (!db.finance) {
    db.finance = createDefaultFinance();
    changed = true;
  } else {
    const nextFinance = normalizeFinance(db.finance);
    if (JSON.stringify(nextFinance) !== JSON.stringify(db.finance)) changed = true;
    db.finance = nextFinance;
  }
  if (!Array.isArray(db.tasks)) {
    db.tasks = createSeedDatabase().tasks;
    changed = true;
  }
  if (Array.isArray(db.tasks)) {
    db.tasks = db.tasks.map((task) => {
      const next = normalizeTask(task, false);
      const isChanged = JSON.stringify(next) !== JSON.stringify(task);
      if (isChanged) changed = true;
      return next;
    });
  }
  return { db, changed };
}

function createDefaultFinance() {
  return {
    expenses: [],
    investments: [
      { id: "reserva", name: "Reserva", percent: 40 },
      { id: "equipamentos", name: "Equipamentos", percent: 25 },
      { id: "marketing", name: "Marketing", percent: 20 },
      { id: "ferramentas", name: "Ferramentas", percent: 15 },
    ],
    updatedAt: new Date().toISOString(),
  };
}

function normalizeFinance(input = {}) {
  const defaults = createDefaultFinance();
  return {
    expenses: Array.isArray(input.expenses) ? input.expenses.map((expense) => normalizeExpense(expense, false)) : [],
    investments: Array.isArray(input.investments) && input.investments.length
      ? input.investments.map((item) => ({
        id: String(item.id || randomUUID()),
        name: String(item.name || "").trim() || "Investimento",
        percent: Number(item.percent || 0),
      }))
      : defaults.investments,
    updatedAt: input.updatedAt || defaults.updatedAt,
  };
}

function normalizeExpense(input, isNew = true) {
  const now = new Date().toISOString();
  return {
    id: input.id || randomUUID(),
    category: String(input.category || "Outros").trim(),
    name: String(input.name || "").trim(),
    amount: Number(input.amount || 0),
    date: String(input.date || localDate(new Date())).slice(0, 10),
    status: String(input.status || "Aberta").trim(),
    createdAt: input.createdAt || now,
    updatedAt: isNew ? now : input.updatedAt || now,
  };
}

function normalizeClient(input, isNew = true) {
  const now = new Date().toISOString();
  return {
    id: input.id || randomUUID(),
    name: String(input.name || "").trim(),
    company: String(input.company || input.name || "").trim(),
    contact: String(input.contact || "").trim(),
    phone: String(input.phone || "").trim(),
    email: String(input.email || "").trim(),
    contractValue: Number(input.contractValue || 0),
    contractedPosts: Number(input.contractedPosts || 0),
    paymentStatus: input.paymentStatus || "Em aberto",
    notes: String(input.notes || "").trim(),
    createdAt: input.createdAt || now,
    updatedAt: isNew ? now : input.updatedAt || now,
  };
}

function normalizeTask(input, isNew = true) {
  const now = new Date().toISOString();
  const status = input.status || "A fazer";
  return {
    id: input.id || randomUUID(),
    client: String(input.client || "").trim(),
    project: String(input.project || "").trim(),
    deliverable: String(input.deliverable || "").trim(),
    theme: String(input.theme || "").trim(),
    dueDate: input.dueDate || localDate(new Date()),
    priority: input.priority || "Média",
    status,
    hours: Number(input.hours || 0),
    notes: String(input.notes || "").trim(),
    checklist: normalizeChecklist(input.checklist),
    links: normalizeLinks(input.links),
    remindAt: input.remindAt || null,
    lastNotifiedAt: input.lastNotifiedAt || null,
    createdAt: input.createdAt || now,
    updatedAt: isNew ? now : input.updatedAt || now,
    completedAt: status === "Concluído" ? input.completedAt || now : null,
  };
}

function normalizeChecklist(checklist) {
  const labels = ["Briefing recebido", "Arte criada", "Legenda criada", "Enviado para cliente", "Ajustes aplicados", "Aprovado", "Publicado"];
  const incoming = Array.isArray(checklist) ? checklist : [];
  return labels.map((label) => {
    const found = incoming.find((item) => item.label === label);
    return { label, done: Boolean(found?.done) };
  });
}

function normalizeLinks(links) {
  if (Array.isArray(links)) return links.map((link) => String(link || "").trim()).filter(Boolean);
  if (typeof links === "string") return links.split("\n").map((link) => link.trim()).filter(Boolean);
  return [];
}

function withComputedTask(task) {
  return {
    ...task,
    autoPriority: automaticPriority(task, localDate(new Date())),
  };
}

function automaticPriority(task, baseDate) {
  if (task.status === "Concluído") return "Baixa";
  if (task.dueDate < baseDate) return "Alta";
  if (task.dueDate === baseDate) return "Alta";
  if (task.dueDate <= addDays(baseDate, 1)) return "Média";
  return task.priority || "Baixa";
}

function filterTasks(tasks, url) {
  const client = url.searchParams.get("client");
  const status = url.searchParams.get("status");
  const search = (url.searchParams.get("search") || "").toLowerCase();
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  return tasks
    .filter((task) => !client || client === "all" || task.client === client)
    .filter((task) => !status || status === "all" || task.status === status)
    .filter((task) => !from || task.dueDate >= from)
    .filter((task) => !to || task.dueDate <= to)
    .filter((task) => {
      if (!search) return true;
      const text = `${task.client} ${task.project} ${task.deliverable} ${task.theme} ${task.notes}`.toLowerCase();
      return text.includes(search);
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || priorityRank(a.priority) - priorityRank(b.priority));
}

function getSummary(tasks, date) {
  const weekEnd = addDays(date, 6);
  const openStatuses = ["A fazer", "Em andamento", "Aguardando aprovação"];
  const today = tasks.filter((task) => task.dueDate === date);
  const week = tasks.filter((task) => task.dueDate >= date && task.dueDate <= weekEnd);
  const late = tasks.filter((task) => task.dueDate < date && openStatuses.includes(task.status));
  const byStatus = Object.fromEntries(["A fazer", "Em andamento", "Aguardando aprovação", "Concluído"].map((status) => [
    status,
    tasks.filter((task) => task.status === status).length,
  ]));

  return {
    date,
    todayCount: today.length,
    weekCount: week.length,
    lateCount: late.length,
    pendingCount: tasks.filter((task) => openStatuses.includes(task.status)).length,
    weekHours: week.reduce((sum, task) => sum + Number(task.hours || 0), 0),
    byStatus,
  };
}

function createSeedDatabase() {
  const themes = [
    "Clima oficial INMET",
    "Gestão de safras",
    "Romaneios e fiscal",
    "Pecuária completa",
    "Mapa e relevo 3D",
    "Assistente IA agrônomo",
    "Análise de solo",
    "ZARC oficial MAPA",
    "Feito para o produtor brasileiro",
    "Produtor de grãos",
    "Pecuarista",
    "Como funciona em 3 passos",
    "Suporte humano opcional",
  ];
  const tasks = [];
  let id = 1;
  let themeIndex = 0;

  for (let day = 1; day <= 30; day += 1) {
    const date = new Date(2026, 5, day);
    const weekDay = date.getDay();
    let client = "";
    let theme = "";
    let priority = "Baixa";

    if ([1, 3, 5].includes(weekDay)) {
      client = "Safra Smart";
      theme = themes[themeIndex++];
      priority = "Média";
    } else if ([2, 4, 6].includes(weekDay)) {
      client = "Harddy OTC";
      theme = "Definir tema";
    }

    if (!client) continue;

    tasks.push(normalizeTask({
      id: `task-${String(id++).padStart(3, "0")}`,
      client,
      project: "Calendário de posts",
      deliverable: "Post para feed",
      theme,
      dueDate: localDate(date),
      priority,
      status: "A fazer",
      hours: 1.5,
      remindAt: `${localDate(date)}T09:00:00.000`,
      notes: "",
    }));
  }

  return {
    meta: {
      name: "Designer Work System",
      version: 1,
      createdAt: new Date().toISOString(),
    },
    settings: {
      notificationCheckSeconds: 30,
      defaultReminderTime: "09:00",
      updatedAt: new Date().toISOString(),
    },
    clients: createSeedClients(),
    uploads: [],
    finance: createDefaultFinance(),
    tasks,
  };
}

function createSeedClients() {
  const now = new Date().toISOString();
  return [
    {
      id: "client-safra-smart",
      name: "Safra Smart",
      company: "Safra Smart",
      contact: "",
      phone: "",
      email: "",
      contractValue: 600,
      contractedPosts: 13,
      paymentStatus: "Em aberto",
      notes: "Calendário de posts de junho.",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "client-harddy-otc",
      name: "Harddy OTC",
      company: "Harddy OTC",
      contact: "",
      phone: "",
      email: "",
      contractValue: 600,
      contractedPosts: 13,
      paymentStatus: "Em aberto",
      notes: "Calendário de posts de junho.",
      createdAt: now,
      updatedAt: now,
    },
  ];
}

async function saveUpload(input) {
  const now = new Date().toISOString();
  const dataUrl = String(input.dataUrl || "");
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Upload inválido.");

  const mimeType = match[1];
  const ext = mimeType.includes("png") ? ".png" : mimeType.includes("webp") ? ".webp" : ".jpg";
  const id = randomUUID();
  const client = String(input.client || "Sem cliente").trim() || "Sem cliente";
  const folderName = slugFolder(client);
  const filename = `${id}${ext}`;
  const folderPath = path.join(uploadsDir, folderName);
  const filePath = path.join(folderPath, filename);
  const buffer = Buffer.from(match[2], "base64");

  if (supabase.enabled) {
    const storagePath = `${folderName}/${filename}`;
    await uploadRemoteFile(storagePath, buffer, mimeType);
    return {
      id,
      client,
      folderName,
      taskId: input.taskId || null,
      originalName: String(input.originalName || "arte").trim(),
      mimeType,
      size: Number(input.size || 0),
      originalSize: Number(input.originalSize || 0),
      width: Number(input.width || 0),
      height: Number(input.height || 0),
      url: `${supabase.url}/storage/v1/object/public/${supabase.bucket}/${storagePath}`,
      createdAt: now,
    };
  }

  await fs.mkdir(folderPath, { recursive: true });
  await fs.writeFile(filePath, buffer);

  return {
    id,
    client,
    folderName,
    taskId: input.taskId || null,
    originalName: String(input.originalName || "arte").trim(),
    mimeType,
    size: Number(input.size || 0),
    originalSize: Number(input.originalSize || 0),
    width: Number(input.width || 0),
    height: Number(input.height || 0),
    url: `/uploads/${folderName}/${filename}`,
    createdAt: now,
  };
}

async function uploadRemoteFile(storagePath, buffer, mimeType) {
  const response = await fetch(`${supabase.url}/storage/v1/object/${supabase.bucket}/${storagePath}`, {
    method: "POST",
    headers: {
      apikey: supabase.key,
      Authorization: `Bearer ${supabase.key}`,
      "Content-Type": mimeType,
      "Cache-Control": "3600",
      "x-upsert": "false",
    },
    body: buffer,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Upload Supabase ${response.status}: ${detail}`);
  }
}

function slugFolder(value) {
  const normalized = String(value || "sem-cliente")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "sem-cliente";
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function localDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateString, days) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return localDate(date);
}

function priorityRank(priority) {
  return { Alta: 0, Média: 1, Baixa: 2 }[priority] ?? 3;
}
