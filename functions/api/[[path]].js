const STATUS_ORDER = ["A fazer", "Em andamento", "Aguardando aprovação", "Concluído"];
const CHECKLIST_LABELS = ["Briefing recebido", "Arte criada", "Legenda criada", "Enviado para cliente", "Ajustes aplicados", "Aprovado", "Publicado"];

export async function onRequest(context) {
  try {
    const url = new URL(context.request.url);
    const method = context.request.method;
    const store = createStore(context.env);

    if (method === "GET" && url.pathname === "/api/health") {
      return json({ ok: true, time: new Date().toISOString(), storage: "supabase-cloudflare" });
    }

    if (method === "GET" && url.pathname === "/api/settings") {
      const db = await store.readDb();
      return json(db.settings);
    }

    if (method === "PUT" && url.pathname === "/api/settings") {
      const body = await readJson(context.request);
      const db = await store.readDb();
      db.settings = { ...db.settings, ...body, updatedAt: new Date().toISOString() };
      await store.writeDb(db);
      return json(db.settings);
    }

    if (method === "GET" && url.pathname === "/api/finance") {
      const db = await store.readDb();
      return json(normalizeFinance(db.finance));
    }

    if (method === "PUT" && url.pathname === "/api/finance/investments") {
      const body = await readJson(context.request);
      const db = await store.readDb();
      db.finance = normalizeFinance({
        ...db.finance,
        investments: Array.isArray(body.investments) ? body.investments : db.finance?.investments,
        updatedAt: new Date().toISOString(),
      });
      await store.writeDb(db);
      return json(db.finance);
    }

    if (method === "POST" && url.pathname === "/api/finance/expenses") {
      const body = await readJson(context.request);
      const db = await store.readDb();
      db.finance = normalizeFinance(db.finance);
      const expense = normalizeExpense(body);
      db.finance.expenses.push(expense);
      db.finance.updatedAt = new Date().toISOString();
      await store.writeDb(db);
      return json(expense, 201);
    }

    const expenseMatch = url.pathname.match(/^\/api\/finance\/expenses\/([^/]+)$/);
    if (expenseMatch) {
      const db = await store.readDb();
      db.finance = normalizeFinance(db.finance);
      const expenseId = decodeURIComponent(expenseMatch[1]);
      const expenseIndex = db.finance.expenses.findIndex((expense) => expense.id === expenseId);
      if (expenseIndex === -1) return json({ error: "Despesa nao encontrada." }, 404);

      if (method === "PUT") {
        const body = await readJson(context.request);
        db.finance.expenses[expenseIndex] = normalizeExpense({ ...db.finance.expenses[expenseIndex], ...body, id: expenseId }, false);
        db.finance.updatedAt = new Date().toISOString();
        await store.writeDb(db);
        return json(db.finance.expenses[expenseIndex]);
      }

      if (method === "DELETE") {
        const [deleted] = db.finance.expenses.splice(expenseIndex, 1);
        db.finance.updatedAt = new Date().toISOString();
        await store.writeDb(db);
        return json(deleted);
      }
    }

    if (method === "GET" && url.pathname === "/api/clients") {
      const db = await store.readDb();
      return json(db.clients || []);
    }

    if (method === "POST" && url.pathname === "/api/clients") {
      const body = await readJson(context.request);
      const db = await store.readDb();
      const client = normalizeClient(body);
      db.clients.push(client);
      await store.writeDb(db);
      return json(client, 201);
    }

    const clientMatch = url.pathname.match(/^\/api\/clients\/([^/]+)$/);
    if (clientMatch) {
      const db = await store.readDb();
      const clientId = decodeURIComponent(clientMatch[1]);
      const clientIndex = db.clients.findIndex((client) => client.id === clientId);
      if (clientIndex === -1) return json({ error: "Cliente não encontrado." }, 404);

      if (method === "PUT") {
        const body = await readJson(context.request);
        db.clients[clientIndex] = normalizeClient({ ...db.clients[clientIndex], ...body, id: clientId }, false);
        db.clients[clientIndex].updatedAt = new Date().toISOString();
        await store.writeDb(db);
        return json(db.clients[clientIndex]);
      }

      if (method === "DELETE") {
        const [deleted] = db.clients.splice(clientIndex, 1);
        await store.writeDb(db);
        return json(deleted);
      }
    }

    if (method === "GET" && url.pathname === "/api/tasks") {
      const db = await store.readDb();
      return json(filterTasks(db.tasks, url).map((task) => withComputedTask(task)));
    }

    if (method === "POST" && url.pathname === "/api/tasks") {
      const body = await readJson(context.request);
      const db = await store.readDb();
      const task = normalizeTask(body);
      db.tasks.push(task);
      await store.writeDb(db);
      return json(task, 201);
    }

    const taskStatusMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/status$/);
    if (taskStatusMatch && method === "PATCH") {
      const body = await readJson(context.request);
      const db = await store.readDb();
      const taskId = decodeURIComponent(taskStatusMatch[1]);
      const taskIndex = db.tasks.findIndex((task) => task.id === taskId);
      if (taskIndex === -1) return json({ error: "Tarefa não encontrada." }, 404);
      db.tasks[taskIndex].status = body.status;
      db.tasks[taskIndex].updatedAt = new Date().toISOString();
      db.tasks[taskIndex].completedAt = body.status === "Concluído" ? new Date().toISOString() : null;
      await store.writeDb(db);
      return json(withComputedTask(db.tasks[taskIndex]));
    }

    const taskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
    if (taskMatch) {
      const db = await store.readDb();
      const taskId = decodeURIComponent(taskMatch[1]);
      const taskIndex = db.tasks.findIndex((task) => task.id === taskId);
      if (taskIndex === -1) return json({ error: "Tarefa não encontrada." }, 404);

      if (method === "PUT") {
        const body = await readJson(context.request);
        db.tasks[taskIndex] = normalizeTask({ ...db.tasks[taskIndex], ...body, id: taskId }, false);
        db.tasks[taskIndex].updatedAt = new Date().toISOString();
        await store.writeDb(db);
        return json(withComputedTask(db.tasks[taskIndex]));
      }

      if (method === "DELETE") {
        const [deleted] = db.tasks.splice(taskIndex, 1);
        await store.writeDb(db);
        return json(deleted);
      }
    }

    if (method === "GET" && url.pathname === "/api/summary") {
      const db = await store.readDb();
      const date = url.searchParams.get("date") || localDate(new Date());
      return json(getSummary(db.tasks, date));
    }

    if (method === "GET" && url.pathname === "/api/reports/client") {
      const db = await store.readDb();
      const clientName = url.searchParams.get("client") || "";
      const month = url.searchParams.get("month") || "";
      const reportTasks = db.tasks
        .filter((task) => !clientName || task.client === clientName)
        .filter((task) => !month || task.dueDate.startsWith(month))
        .map((task) => withComputedTask(task));
      const client = db.clients.find((item) => item.name === clientName) || null;
      return json({
        client,
        month,
        tasks: reportTasks,
        totals: {
          planned: reportTasks.length,
          done: reportTasks.filter((task) => task.status === "Concluído").length,
          pending: reportTasks.filter((task) => task.status !== "Concluído").length,
        },
      });
    }

    if (method === "GET" && url.pathname === "/api/uploads") {
      const db = await store.readDb();
      const client = url.searchParams.get("client");
      const uploads = (db.uploads || []).filter((upload) => !client || client === "all" || upload.client === client);
      return json(uploads);
    }

    if (method === "POST" && url.pathname === "/api/uploads") {
      const body = await readJson(context.request);
      const db = await store.readDb();
      const upload = await store.saveUpload(body);
      db.uploads.unshift(upload);
      await store.writeDb(db);
      return json(upload, 201);
    }

    if (method === "GET" && url.pathname === "/api/notifications/due") {
      const db = await store.readDb();
      const now = url.searchParams.get("now") ? new Date(url.searchParams.get("now")) : new Date();
      const due = db.tasks.filter((task) => {
        if (!task.remindAt || task.status === "Concluído") return false;
        if (task.lastNotifiedAt) return false;
        return new Date(task.remindAt).getTime() <= now.getTime();
      });
      return json(due);
    }

    if (method === "POST" && url.pathname === "/api/notifications/ack") {
      const body = await readJson(context.request);
      const ids = Array.isArray(body.ids) ? body.ids : [];
      const db = await store.readDb();
      const now = new Date().toISOString();
      db.tasks = db.tasks.map((task) => (ids.includes(task.id) ? { ...task, lastNotifiedAt: now } : task));
      await store.writeDb(db);
      return json({ ok: true, acknowledged: ids.length });
    }

    return json({ error: "Rota não encontrada." }, 404);
  } catch (error) {
    return json({ error: "Erro interno do servidor.", detail: error.message }, 500);
  }
}

function createStore(env) {
  const supabase = {
    url: normalizeSupabaseUrl(env.SUPABASE_URL || ""),
    key: env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || "",
    bucket: env.SUPABASE_BUCKET || "designer-artes",
  };
  if (!supabase.url || !supabase.key) throw new Error("Supabase não configurado.");

  return {
    async readDb() {
      const rows = await supabaseRequest(supabase, "/rest/v1/designer_state?id=eq.main&select=data");
      if (!rows.length) {
        const seed = createSeedDatabase();
        await this.writeDb(seed);
        return seed;
      }
      const migrated = migrateDb(rows[0].data || createSeedDatabase());
      if (migrated.changed) await this.writeDb(migrated.db);
      return migrated.db;
    },

    async writeDb(db) {
      await supabaseRequest(supabase, "/rest/v1/designer_state?on_conflict=id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          id: "main",
          data: db,
          updated_at: new Date().toISOString(),
        }),
      });
    },

    async saveUpload(input) {
      const now = new Date().toISOString();
      const dataUrl = String(input.dataUrl || "");
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) throw new Error("Upload inválido.");

      const mimeType = match[1];
      const ext = mimeType.includes("png") ? ".png" : mimeType.includes("webp") ? ".webp" : ".jpg";
      const id = crypto.randomUUID();
      const client = String(input.client || "Sem cliente").trim() || "Sem cliente";
      const folderName = slugFolder(client);
      const filename = `${id}${ext}`;
      const storagePath = `${folderName}/${filename}`;
      const bytes = base64ToBytes(match[2]);
      await uploadRemoteFile(supabase, storagePath, bytes, mimeType);
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
    },
  };
}

async function supabaseRequest(supabase, endpoint, options = {}) {
  const response = await fetch(`${supabase.url}${endpoint}`, {
    ...options,
    headers: {
      apikey: supabase.key,
      Authorization: `Bearer ${supabase.key}`,
      ...(options.body && typeof options.body === "string" ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function uploadRemoteFile(supabase, storagePath, bytes, mimeType) {
  const response = await fetch(`${supabase.url}/storage/v1/object/${supabase.bucket}/${storagePath}`, {
    method: "POST",
    headers: {
      apikey: supabase.key,
      Authorization: `Bearer ${supabase.key}`,
      "Content-Type": mimeType,
      "Cache-Control": "3600",
      "x-upsert": "false",
    },
    body: bytes,
  });
  if (!response.ok) throw new Error(`Upload Supabase ${response.status}: ${await response.text()}`);
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
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
  db.tasks = db.tasks.map((task) => {
    const next = normalizeTask(task, false);
    if (JSON.stringify(next) !== JSON.stringify(task)) changed = true;
    return next;
  });
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
        id: String(item.id || crypto.randomUUID()),
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
    id: input.id || crypto.randomUUID(),
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
    id: input.id || crypto.randomUUID(),
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
    id: input.id || crypto.randomUUID(),
    client: String(input.client || "").trim(),
    project: String(input.project || "").trim(),
    deliverable: String(input.deliverable || "").trim(),
    theme: String(input.theme || "").trim(),
    dueDate: String(input.dueDate || localDate(new Date())).slice(0, 10),
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
  const incoming = Array.isArray(checklist) ? checklist : [];
  return CHECKLIST_LABELS.map((label) => {
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
  return { ...task, autoPriority: automaticPriority(task, localDate(new Date())) };
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
  const byStatus = Object.fromEntries(STATUS_ORDER.map((status) => [status, tasks.filter((task) => task.status === status).length]));
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
    meta: { name: "Designer Work System", version: 1, createdAt: new Date().toISOString() },
    settings: { notificationCheckSeconds: 30, defaultReminderTime: "09:00", updatedAt: new Date().toISOString() },
    clients: createSeedClients(),
    uploads: [],
    finance: createDefaultFinance(),
    tasks,
  };
}

function createSeedClients() {
  const now = new Date().toISOString();
  return [
    { id: "client-safra-smart", name: "Safra Smart", company: "Safra Smart", contact: "", phone: "", email: "", contractValue: 600, contractedPosts: 13, paymentStatus: "Em aberto", notes: "Calendário de posts de junho.", createdAt: now, updatedAt: now },
    { id: "client-harddy-otc", name: "Harddy OTC", company: "Harddy OTC", contact: "", phone: "", email: "", contractValue: 600, contractedPosts: 13, paymentStatus: "Em aberto", notes: "Calendário de posts de junho.", createdAt: now, updatedAt: now },
  ];
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function normalizeSupabaseUrl(value) {
  return String(value || "").trim().replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
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

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
