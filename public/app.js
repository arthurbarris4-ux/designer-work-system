const api = {
  tasks: "/api/tasks",
  clients: "/api/clients",
  uploads: "/api/uploads",
  report: "/api/reports/client",
  summary: "/api/summary",
  health: "/api/health",
  due: "/api/notifications/due",
  ack: "/api/notifications/ack",
};

const statusOrder = ["A fazer", "Em andamento", "Aguardando aprovação", "Concluído"];
const checklistLabels = ["Briefing recebido", "Arte criada", "Legenda criada", "Enviado para cliente", "Ajustes aplicados", "Aprovado", "Publicado"];

const state = {
  tasks: [],
  clients: [],
  uploads: [],
  summary: null,
  report: null,
  focusDate: toDateInput(new Date()),
  filters: {
    search: "",
    client: "all",
    status: "all",
  },
  installPrompt: null,
  dailySummaryShown: false,
};

const els = {
  sidebar: document.querySelector(".sidebar"),
  menuToggle: document.querySelector("#menuToggle"),
  serverDot: document.querySelector("#serverDot"),
  serverStatus: document.querySelector("#serverStatus"),
  focusDate: document.querySelector("#focusDate"),
  search: document.querySelector("#search"),
  clientFilter: document.querySelector("#clientFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  navButtons: document.querySelectorAll(".nav-button"),
  views: document.querySelectorAll(".view"),
  todayCount: document.querySelector("#todayCount"),
  pendingCount: document.querySelector("#pendingCount"),
  lateCount: document.querySelector("#lateCount"),
  weekHours: document.querySelector("#weekHours"),
  sideNextTitle: document.querySelector("#sideNextTitle"),
  sideNextMeta: document.querySelector("#sideNextMeta"),
  themeToggle: document.querySelector("#themeToggle"),
  themeIcon: document.querySelector("#themeIcon"),
  themeLabel: document.querySelector("#themeLabel"),
  nextPostHero: document.querySelector("#nextPostHero"),
  nextPostTitle: document.querySelector("#nextPostTitle"),
  nextPostMeta: document.querySelector("#nextPostMeta"),
  nextPostDate: document.querySelector("#nextPostDate"),
  nextPostEdit: document.querySelector("#nextPostEdit"),
  week: document.querySelector("#week"),
  statusBars: document.querySelector("#statusBars"),
  taskRows: document.querySelector("#taskRows"),
  todayTitle: document.querySelector("#todayTitle"),
  todayPill: document.querySelector("#todayPill"),
  todayList: document.querySelector("#todayList"),
  reminderList: document.querySelector("#reminderList"),
  notificationState: document.querySelector("#notificationState"),
  kanban: document.querySelector("#kanban"),
  requestNotifications: document.querySelector("#requestNotifications"),
  installApp: document.querySelector("#installApp"),
  newClient: document.querySelector("#newClient"),
  calendarMonth: document.querySelector("#calendarMonth"),
  calendarTitle: document.querySelector("#calendarTitle"),
  calendarGrid: document.querySelector("#calendarGrid"),
  clientGrid: document.querySelector("#clientGrid"),
  uploadClient: document.querySelector("#uploadClient"),
  assetFile: document.querySelector("#assetFile"),
  uploadAsset: document.querySelector("#uploadAsset"),
  uploadFeedback: document.querySelector("#uploadFeedback"),
  assetGrid: document.querySelector("#assetGrid"),
  reportClient: document.querySelector("#reportClient"),
  reportMonth: document.querySelector("#reportMonth"),
  generateReport: document.querySelector("#generateReport"),
  printReport: document.querySelector("#printReport"),
  reportSheet: document.querySelector("#reportSheet"),
  newTask: document.querySelector("#newTask"),
  taskDialog: document.querySelector("#taskDialog"),
  taskForm: document.querySelector("#taskForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  closeDialog: document.querySelector("#closeDialog"),
  cancelDialog: document.querySelector("#cancelDialog"),
  deleteTask: document.querySelector("#deleteTask"),
  taskId: document.querySelector("#taskId"),
  taskClient: document.querySelector("#taskClient"),
  taskDueDate: document.querySelector("#taskDueDate"),
  taskProject: document.querySelector("#taskProject"),
  taskDeliverable: document.querySelector("#taskDeliverable"),
  taskTheme: document.querySelector("#taskTheme"),
  taskLinks: document.querySelector("#taskLinks"),
  taskChecklist: document.querySelector("#taskChecklist"),
  taskStatus: document.querySelector("#taskStatus"),
  taskHours: document.querySelector("#taskHours"),
  taskReminder: document.querySelector("#taskReminder"),
  taskNotes: document.querySelector("#taskNotes"),
  installDialog: document.querySelector("#installDialog"),
  closeInstallDialog: document.querySelector("#closeInstallDialog"),
  okInstallDialog: document.querySelector("#okInstallDialog"),
  clientDialog: document.querySelector("#clientDialog"),
  clientForm: document.querySelector("#clientForm"),
  clientDialogTitle: document.querySelector("#clientDialogTitle"),
  closeClientDialog: document.querySelector("#closeClientDialog"),
  cancelClientDialog: document.querySelector("#cancelClientDialog"),
  deleteClient: document.querySelector("#deleteClient"),
  clientId: document.querySelector("#clientId"),
  clientName: document.querySelector("#clientName"),
  clientContact: document.querySelector("#clientContact"),
  clientPhone: document.querySelector("#clientPhone"),
  clientEmail: document.querySelector("#clientEmail"),
  clientValue: document.querySelector("#clientValue"),
  clientPosts: document.querySelector("#clientPosts"),
  clientPayment: document.querySelector("#clientPayment"),
  clientNotes: document.querySelector("#clientNotes"),
  dailySummaryDialog: document.querySelector("#dailySummaryDialog"),
  dailyGreeting: document.querySelector("#dailyGreeting"),
  dailySummaryContent: document.querySelector("#dailySummaryContent"),
  closeDailySummary: document.querySelector("#closeDailySummary"),
  startWorking: document.querySelector("#startWorking"),
};

init();

async function init() {
  applyStoredTheme();
  els.focusDate.value = state.focusDate;
  els.calendarMonth.value = state.focusDate.slice(0, 7);
  els.reportMonth.value = state.focusDate.slice(0, 7);
  bindEvents();
  await registerServiceWorker();
  await refreshAll();
  setInterval(checkDueNotifications, 30000);
}

function bindEvents() {
  els.menuToggle.addEventListener("click", toggleMenu);

  els.focusDate.addEventListener("change", async () => {
    state.focusDate = els.focusDate.value;
    await refreshAll();
  });

  els.search.addEventListener("input", () => {
    state.filters.search = els.search.value.trim();
    render();
  });

  els.clientFilter.addEventListener("change", () => {
    state.filters.client = els.clientFilter.value;
    render();
  });

  els.statusFilter.addEventListener("change", () => {
    state.filters.status = els.statusFilter.value;
    render();
  });

  els.navButtons.forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  els.newTask.addEventListener("click", () => openTaskDialog());
  els.closeDialog.addEventListener("click", () => els.taskDialog.close());
  els.cancelDialog.addEventListener("click", () => els.taskDialog.close());
  els.deleteTask.addEventListener("click", deleteCurrentTask);
  els.taskForm.addEventListener("submit", saveTask);
  els.requestNotifications.addEventListener("click", requestNotifications);
  els.installApp.addEventListener("click", installApp);
  els.newClient.addEventListener("click", () => openClientDialog());
  els.clientForm.addEventListener("submit", saveClient);
  els.closeClientDialog.addEventListener("click", () => els.clientDialog.close());
  els.cancelClientDialog.addEventListener("click", () => els.clientDialog.close());
  els.deleteClient.addEventListener("click", deleteCurrentClient);
  els.calendarMonth.addEventListener("change", renderCalendar);
  els.uploadAsset.addEventListener("click", uploadSelectedAsset);
  els.generateReport.addEventListener("click", generateReport);
  els.printReport.addEventListener("click", () => window.print());
  els.closeDailySummary.addEventListener("click", () => els.dailySummaryDialog.close());
  els.startWorking.addEventListener("click", () => els.dailySummaryDialog.close());
  els.themeToggle.addEventListener("click", toggleTheme);
  els.nextPostEdit.addEventListener("click", () => {
    const taskId = els.nextPostEdit.dataset.taskId;
    if (taskId) openTaskDialog(taskId);
  });
  els.closeInstallDialog.addEventListener("click", () => els.installDialog.close());
  els.okInstallDialog.addEventListener("click", () => els.installDialog.close());

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.installPrompt = event;
    els.installApp.disabled = false;
  });
}

async function refreshAll() {
  await checkHealth();
  await Promise.all([loadTasks(), loadClients(), loadUploads(), loadSummary()]);
  populateFilters();
  render();
  maybeOpenDailySummary();
  await checkDueNotifications();
}

async function checkHealth() {
  try {
    await request(api.health);
    els.serverDot.classList.add("ok");
    els.serverStatus.textContent = "Online";
  } catch {
    els.serverDot.classList.remove("ok");
    els.serverStatus.textContent = "Offline";
  }
}

async function loadTasks() {
  const params = new URLSearchParams();
  if (state.filters.search) params.set("search", state.filters.search);
  if (state.filters.client !== "all") params.set("client", state.filters.client);
  if (state.filters.status !== "all") params.set("status", state.filters.status);
  state.tasks = await request(`${api.tasks}?${params}`);
}

async function loadSummary() {
  state.summary = await request(`${api.summary}?date=${state.focusDate}`);
}

async function loadClients() {
  state.clients = await request(api.clients);
}

async function loadUploads() {
  state.uploads = await request(api.uploads);
}

function render() {
  renderNextPost();
  renderMetrics();
  renderWeek();
  renderStatusBars();
  renderTable();
  renderToday();
  renderReminders();
  renderKanban();
  renderClients();
  renderCalendar();
  renderAssets();
  renderReport();
}

function renderNextPost() {
  const next = getNextPostTask();
  if (!next) {
    els.nextPostTitle.textContent = "Nenhum post pendente";
    els.nextPostMeta.textContent = "Crie uma tarefa nova para aparecer aqui automaticamente.";
    els.nextPostDate.textContent = "--/--";
    els.nextPostEdit.dataset.taskId = "";
    els.nextPostEdit.disabled = true;
    els.sideNextTitle.textContent = "Sem post";
    els.sideNextMeta.textContent = "nenhuma entrega pendente";
    return;
  }

  const isToday = next.dueDate === state.focusDate;
  els.nextPostTitle.textContent = next.theme || next.deliverable;
  els.nextPostMeta.textContent = `${isToday ? "Post de hoje" : "Post mais perto da entrega"} · ${next.client} · ${next.deliverable}`;
  els.nextPostDate.textContent = formatShortDate(next.dueDate);
  els.nextPostEdit.dataset.taskId = next.id;
  els.nextPostEdit.disabled = false;
  els.sideNextTitle.textContent = next.theme || next.deliverable;
  els.sideNextMeta.textContent = `${next.client} · ${formatShortDate(next.dueDate)}`;
}

function getNextPostTask() {
  const openTasks = state.tasks
    .filter((task) => task.status !== "Concluído")
    .sort(sortTasks);
  const today = openTasks.find((task) => task.dueDate === state.focusDate);
  if (today) return today;
  const future = openTasks.find((task) => task.dueDate >= state.focusDate);
  if (future) return future;
  return openTasks.at(-1) || null;
}

function renderMetrics() {
  const summary = state.summary || {};
  els.todayCount.textContent = summary.todayCount ?? 0;
  els.pendingCount.textContent = summary.pendingCount ?? 0;
  els.lateCount.textContent = summary.lateCount ?? 0;
  els.weekHours.textContent = `${formatNumber(summary.weekHours || 0)}h`;
}

function renderWeek() {
  els.week.innerHTML = "";
  for (let i = 0; i < 7; i += 1) {
    const day = addDays(state.focusDate, i);
    const tasks = state.tasks.filter((task) => task.dueDate === day);
    const card = document.createElement("article");
    card.className = `day ${i === 0 ? "focus" : ""}`;
    card.innerHTML = `
      <div class="day-head">
        <div>
          <strong>${weekday(day)}</strong>
          <small>${formatShortDate(day)}</small>
        </div>
        <span class="day-count">${tasks.length || "livre"}</span>
      </div>
      <div class="day-list">
        ${tasks.slice(0, 4).map((task) => `
          <div class="mini-task ${task.client.includes("Harddy") ? "harddy" : ""}">
            <span class="mini-client">${escapeHtml(task.client)}</span>
            <span class="mini-theme">${escapeHtml(task.theme || task.deliverable)}</span>
          </div>
        `).join("")}
        ${tasks.length > 4 ? `<small class="more-tasks">+${tasks.length - 4} tarefas</small>` : ""}
      </div>
    `;
    els.week.append(card);
  }
}

function renderStatusBars() {
  const counts = state.summary?.byStatus || {};
  const total = Math.max(Object.values(counts).reduce((sum, value) => sum + value, 0), 1);
  els.statusBars.innerHTML = statusOrder.map((status) => {
    const count = counts[status] || 0;
    const width = Math.round((count / total) * 100);
    return `
      <div class="bar">
        <span>${status}</span>
        <div class="track"><div class="fill" style="width:${width}%"></div></div>
        <strong>${count}</strong>
      </div>
    `;
  }).join("");
}

function renderTable() {
  const upcoming = [...state.tasks]
    .filter((task) => task.dueDate >= state.focusDate)
    .sort(sortTasks)
    .slice(0, 12);

  els.taskRows.innerHTML = upcoming.length
    ? upcoming.map((task) => `
      <tr>
        <td>${formatShortDate(task.dueDate)}</td>
        <td>${escapeHtml(task.client)}</td>
        <td>${escapeHtml(task.deliverable)}</td>
        <td>${escapeHtml(task.theme || "Sem tema")}</td>
        <td>${statusPill(task.status)}</td>
        <td><button class="mini-button" data-edit="${task.id}" type="button">Editar</button></td>
      </tr>
    `).join("")
    : `<tr><td colspan="6"><div class="empty">Nenhuma entrega encontrada.</div></td></tr>`;

  els.taskRows.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => openTaskDialog(button.dataset.edit));
  });
}

function renderToday() {
  const todayTasks = state.tasks.filter((task) => task.dueDate === state.focusDate).sort(sortTasks);
  els.todayTitle.textContent = `Tarefas de ${formatLongDate(state.focusDate)}`;
  els.todayPill.textContent = todayTasks.length === 1 ? "1 item" : `${todayTasks.length} itens`;
  els.todayList.innerHTML = todayTasks.length
    ? todayTasks.map(taskCard).join("")
    : `<div class="empty">Nenhuma tarefa para a data foco.</div>`;
  bindTaskButtons(els.todayList);
}

function renderReminders() {
  const reminders = state.tasks
    .filter((task) => task.remindAt && task.status !== "Concluído")
    .sort((a, b) => a.remindAt.localeCompare(b.remindAt))
    .slice(0, 5);

  els.notificationState.textContent = getNotificationText();
  els.reminderList.innerHTML = reminders.length
    ? reminders.map((task) => `
      <article class="task-card">
        <h3>${escapeHtml(task.theme || task.deliverable)}</h3>
        <p>${escapeHtml(task.client)} · ${formatReminder(task.remindAt)}</p>
        <div class="task-meta">${statusPill(task.status)}</div>
      </article>
    `).join("")
    : `<div class="empty">Nenhum lembrete configurado.</div>`;
}

function renderKanban() {
  els.kanban.innerHTML = statusOrder.map((status) => {
    const tasks = state.tasks.filter((task) => task.status === status).sort(sortTasks);
    return `
      <section class="column">
        <h3>${status}<span class="pill">${tasks.length}</span></h3>
        <div class="task-list">
          ${tasks.length ? tasks.map(taskCard).join("") : `<div class="empty">Vazio</div>`}
        </div>
      </section>
    `;
  }).join("");
  bindTaskButtons(els.kanban);
}

function renderClients() {
  els.clientGrid.innerHTML = state.clients.length
    ? state.clients.map((client) => {
      const clientTasks = state.tasks.filter((task) => task.client === client.name);
      const done = clientTasks.filter((task) => task.status === "Concluído").length;
      return `
        <article class="client-card">
          <h3>${escapeHtml(client.name)}</h3>
          <p>${escapeHtml(client.contact || "Sem contato definido")}</p>
          <dl>
            <dt>Contrato</dt><dd>${money(client.contractValue)}</dd>
            <dt>Posts</dt><dd>${clientTasks.length}/${client.contractedPosts || 0}</dd>
            <dt>Concluídos</dt><dd>${done}</dd>
            <dt>Pagamento</dt><dd>${escapeHtml(client.paymentStatus)}</dd>
          </dl>
          <div class="task-actions">
            <button class="mini-button" data-client-edit="${client.id}" type="button">Editar</button>
            <button class="mini-button" data-client-report="${escapeHtml(client.name)}" type="button">Relatório</button>
          </div>
        </article>
      `;
    }).join("")
    : `<div class="empty">Nenhum cliente cadastrado.</div>`;

  els.clientGrid.querySelectorAll("[data-client-edit]").forEach((button) => {
    button.addEventListener("click", () => openClientDialog(button.dataset.clientEdit));
  });
  els.clientGrid.querySelectorAll("[data-client-report]").forEach((button) => {
    button.addEventListener("click", async () => {
      setView("reports");
      els.reportClient.value = button.dataset.clientReport;
      await generateReport();
    });
  });
}

function renderCalendar() {
  const month = els.calendarMonth.value || state.focusDate.slice(0, 7);
  const [year, monthIndex] = month.split("-").map(Number);
  const first = new Date(year, monthIndex - 1, 1);
  const start = new Date(first);
  start.setDate(start.getDate() - first.getDay());
  const title = first.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  els.calendarTitle.textContent = title.charAt(0).toUpperCase() + title.slice(1);

  const headers = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const cells = headers.map((day) => `<div class="calendar-head">${day}</div>`);
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const iso = toDateInput(date);
    const tasks = state.tasks.filter((task) => task.dueDate === iso);
    cells.push(`
      <article class="calendar-cell ${date.getMonth() !== monthIndex - 1 ? "outside" : ""}">
        <strong>${date.getDate()}</strong>
        ${tasks.map((task) => `
          <button class="calendar-task ${task.client.includes("Harddy") ? "harddy" : ""}" data-edit="${task.id}" type="button">
            ${escapeHtml(task.client)} · ${escapeHtml(task.theme || task.deliverable)}
          </button>
        `).join("")}
      </article>
    `);
  }
  els.calendarGrid.innerHTML = cells.join("");
  els.calendarGrid.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => openTaskDialog(button.dataset.edit));
  });
}

function renderAssets() {
  if (!state.uploads.length) {
    els.assetGrid.innerHTML = `<div class="empty">Nenhuma arte enviada ainda.</div>`;
    return;
  }

  const folders = state.uploads.reduce((groups, asset) => {
    const client = asset.client || "Sem cliente";
    if (!groups.has(client)) groups.set(client, []);
    groups.get(client).push(asset);
    return groups;
  }, new Map());

  els.assetGrid.innerHTML = [...folders.entries()].map(([client, assets]) => `
    <details class="asset-folder" open>
      <summary>
        <span class="folder-mark" aria-hidden="true"></span>
        <span>
          <strong>${escapeHtml(client)}</strong>
          <small>${assets.length} ${assets.length === 1 ? "arte enviada" : "artes enviadas"}</small>
        </span>
      </summary>
      <div class="asset-folder-grid">
        ${assets.map((asset) => `
          <article class="asset-card">
            <img src="${asset.url}" alt="${escapeHtml(asset.originalName)}" loading="lazy" />
            <h3>${escapeHtml(asset.originalName)}</h3>
            <small>${formatKb(asset.size)} compactado</small>
            <div class="task-actions">
              <a class="mini-button" href="${asset.url}" target="_blank" rel="noopener">Abrir</a>
              <a class="mini-button" href="${asset.url}" download="${escapeHtml(asset.originalName)}">Baixar</a>
            </div>
          </article>
        `).join("")}
      </div>
    </details>
  `).join("");
  return;

  els.assetGrid.innerHTML = state.uploads.length
    ? state.uploads.slice(0, 12).map((asset) => `
      <article class="asset-card">
        <img src="${asset.url}" alt="${escapeHtml(asset.originalName)}" loading="lazy" />
        <h3>${escapeHtml(asset.client || "Sem cliente")}</h3>
        <div class="task-actions">
          <a class="mini-button" href="${asset.url}" target="_blank" rel="noopener">Abrir</a>
          <a class="mini-button" href="${asset.url}" download="${escapeHtml(asset.originalName)}">Baixar</a>
        </div>
        <small>${escapeHtml(asset.originalName)} · ${formatKb(asset.size)} compactado</small>
      </article>
    `).join("")
    : `<div class="empty">Nenhuma arte enviada ainda.</div>`;
}

function taskCard(task) {
  return `
    <article class="task-card">
      <div>
        <h3>${escapeHtml(task.theme || task.deliverable)}</h3>
        <p>${escapeHtml(task.client)} · ${formatShortDate(task.dueDate)} · ${escapeHtml(task.project || "Sem projeto")}</p>
      </div>
      <div class="task-meta">
        ${statusPill(task.status)}
        <span class="pill">${formatNumber(task.hours)}h</span>
      </div>
      <div class="task-actions">
        ${nextStatusButton(task)}
        <button class="mini-button" data-edit="${task.id}" type="button">Editar</button>
      </div>
    </article>
  `;
}

function bindTaskButtons(container) {
  container.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => openTaskDialog(button.dataset.edit));
  });
  container.querySelectorAll("[data-status]").forEach((button) => {
    button.addEventListener("click", async () => {
      await request(`${api.tasks}/${button.dataset.task}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: button.dataset.status }),
      });
      await refreshAll();
    });
  });
}

function nextStatusButton(task) {
  if (task.status === "Concluído") {
    return `<button class="mini-button" data-task="${task.id}" data-status="A fazer" type="button">Reabrir</button>`;
  }
  const index = statusOrder.indexOf(task.status);
  const next = statusOrder[Math.min(index + 1, statusOrder.length - 1)];
  return `<button class="mini-button" data-task="${task.id}" data-status="${next}" type="button">${next}</button>`;
}

function populateFilters() {
  const currentClient = state.filters.client;
  const currentStatus = state.filters.status;
  const clients = [...new Set([
    ...state.clients.map((client) => client.name),
    ...state.tasks.map((task) => task.client),
  ].filter(Boolean))].sort();
  els.clientFilter.innerHTML = `<option value="all">Todos os clientes</option>${clients.map((client) => `<option>${escapeHtml(client)}</option>`).join("")}`;
  els.statusFilter.innerHTML = `<option value="all">Todos os status</option>${statusOrder.map((status) => `<option>${status}</option>`).join("")}`;
  els.uploadClient.innerHTML = clients.map((client) => `<option>${escapeHtml(client)}</option>`).join("");
  els.reportClient.innerHTML = clients.map((client) => `<option>${escapeHtml(client)}</option>`).join("");
  els.clientFilter.value = clients.includes(currentClient) ? currentClient : "all";
  els.statusFilter.value = statusOrder.includes(currentStatus) ? currentStatus : "all";
  if (!els.reportClient.value && clients[0]) els.reportClient.value = clients[0];
  state.filters.client = els.clientFilter.value;
  state.filters.status = els.statusFilter.value;
}

function openTaskDialog(taskId = "") {
  const task = state.tasks.find((item) => item.id === taskId);
  els.dialogTitle.textContent = task ? "Editar tarefa" : "Nova tarefa";
  els.taskId.value = task?.id || "";
  els.taskClient.value = task?.client || "";
  els.taskDueDate.value = task?.dueDate || state.focusDate;
  els.taskProject.value = task?.project || "";
  els.taskDeliverable.value = task?.deliverable || "";
  els.taskTheme.value = task?.theme || "";
  els.taskLinks.value = Array.isArray(task?.links) ? task.links.join("\n") : "";
  renderChecklistEditor(task?.checklist);
  els.taskStatus.value = task?.status || "A fazer";
  els.taskHours.value = task?.hours || 1.5;
  els.taskReminder.value = task?.remindAt ? task.remindAt.slice(0, 16) : "";
  els.taskNotes.value = task?.notes || "";
  els.deleteTask.style.visibility = task ? "visible" : "hidden";
  els.taskDialog.showModal();
}

function renderChecklistEditor(checklist = []) {
  els.taskChecklist.innerHTML = checklistLabels.map((label) => {
    const found = checklist.find((item) => item.label === label);
    return `
      <label class="check-item">
        <input type="checkbox" value="${escapeHtml(label)}" ${found?.done ? "checked" : ""} />
        ${escapeHtml(label)}
      </label>
    `;
  }).join("");
}

function getChecklistFromForm() {
  return [...els.taskChecklist.querySelectorAll("input[type='checkbox']")].map((input) => ({
    label: input.value,
    done: input.checked,
  }));
}

async function saveTask(event) {
  event.preventDefault();
  const id = els.taskId.value;
  const payload = {
    client: els.taskClient.value.trim(),
    dueDate: els.taskDueDate.value,
    project: els.taskProject.value.trim(),
    deliverable: els.taskDeliverable.value.trim(),
    theme: els.taskTheme.value.trim(),
    links: els.taskLinks.value.split("\n").map((link) => link.trim()).filter(Boolean),
    checklist: getChecklistFromForm(),
    status: els.taskStatus.value,
    hours: Number(els.taskHours.value || 0),
    remindAt: els.taskReminder.value ? `${els.taskReminder.value}:00.000` : null,
    notes: els.taskNotes.value.trim(),
  };
  await request(id ? `${api.tasks}/${id}` : api.tasks, {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(payload),
  });
  els.taskDialog.close();
  await refreshAll();
}

async function deleteCurrentTask() {
  const id = els.taskId.value;
  if (!id) return;
  await request(`${api.tasks}/${id}`, { method: "DELETE" });
  els.taskDialog.close();
  await refreshAll();
}

function openClientDialog(clientId = "") {
  const client = state.clients.find((item) => item.id === clientId);
  els.clientDialogTitle.textContent = client ? "Editar cliente" : "Novo cliente";
  els.clientId.value = client?.id || "";
  els.clientName.value = client?.name || "";
  els.clientContact.value = client?.contact || "";
  els.clientPhone.value = client?.phone || "";
  els.clientEmail.value = client?.email || "";
  els.clientValue.value = client?.contractValue || 0;
  els.clientPosts.value = client?.contractedPosts || 0;
  els.clientPayment.value = client?.paymentStatus || "Em aberto";
  els.clientNotes.value = client?.notes || "";
  els.deleteClient.style.visibility = client ? "visible" : "hidden";
  els.clientDialog.showModal();
}

async function saveClient(event) {
  event.preventDefault();
  const id = els.clientId.value;
  const payload = {
    name: els.clientName.value.trim(),
    contact: els.clientContact.value.trim(),
    phone: els.clientPhone.value.trim(),
    email: els.clientEmail.value.trim(),
    contractValue: Number(els.clientValue.value || 0),
    contractedPosts: Number(els.clientPosts.value || 0),
    paymentStatus: els.clientPayment.value,
    notes: els.clientNotes.value.trim(),
  };
  await request(id ? `${api.clients}/${id}` : api.clients, {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(payload),
  });
  els.clientDialog.close();
  await refreshAll();
}

async function deleteCurrentClient() {
  const id = els.clientId.value;
  if (!id) return;
  await request(`${api.clients}/${id}`, { method: "DELETE" });
  els.clientDialog.close();
  await refreshAll();
}

async function uploadSelectedAsset() {
  const file = els.assetFile.files?.[0];
  if (!file) {
    els.uploadFeedback.textContent = "Escolha uma imagem primeiro.";
    return;
  }
  els.uploadFeedback.textContent = "Compactando imagem...";
  const compressed = await compressImage(file);
  els.uploadFeedback.textContent = `Enviando ${formatKb(compressed.size)}...`;
  await request(api.uploads, {
    method: "POST",
    body: JSON.stringify({
      client: els.uploadClient.value,
      originalName: file.name,
      originalSize: file.size,
      size: compressed.size,
      width: compressed.width,
      height: compressed.height,
      dataUrl: compressed.dataUrl,
    }),
  });
  els.assetFile.value = "";
  els.uploadFeedback.textContent = `Arte compactada: ${formatKb(file.size)} → ${formatKb(compressed.size)}.`;
  await loadUploads();
  renderAssets();
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Imagem inválida."));
      image.onload = () => {
        const maxWidth = 1600;
        const scale = Math.min(1, maxWidth / image.width);
        const width = Math.round(image.width * scale);
        const height = Math.round(image.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
        const size = Math.round((dataUrl.length - "data:image/jpeg;base64,".length) * 0.75);
        resolve({ dataUrl, width, height, size });
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function generateReport() {
  const client = els.reportClient.value;
  const month = els.reportMonth.value;
  state.report = await request(`${api.report}?client=${encodeURIComponent(client)}&month=${encodeURIComponent(month)}`);
  renderReport();
}

function renderReport() {
  const report = state.report;
  if (!report) {
    els.reportSheet.innerHTML = `<div class="empty">Escolha um cliente e gere o relatório.</div>`;
    return;
  }
  const titleMonth = report.month ? parseMonth(report.month).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : "período completo";
  els.reportSheet.innerHTML = `
    <span class="kicker">Relatório mensal</span>
    <h2>${escapeHtml(report.client?.name || els.reportClient.value)} · ${titleMonth}</h2>
    <p>Resumo de entregas planejadas e andamento dos posts.</p>
    <div class="report-stats">
      <article><span>Planejados</span><strong>${report.totals.planned}</strong></article>
      <article><span>Concluídos</span><strong>${report.totals.done}</strong></article>
      <article><span>Pendentes</span><strong>${report.totals.pending}</strong></article>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Data</th><th>Entrega</th><th>Tema</th><th>Status</th></tr></thead>
        <tbody>
          ${report.tasks.map((task) => `
            <tr>
              <td>${formatShortDate(task.dueDate)}</td>
              <td>${escapeHtml(task.deliverable)}</td>
              <td>${escapeHtml(task.theme || "Sem tema")}</td>
              <td>${statusPill(task.status)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function maybeOpenDailySummary() {
  if (state.dailySummaryShown) return;
  state.dailySummaryShown = true;
  const next = getNextPostTask();
  const today = state.tasks.filter((task) => task.dueDate === state.focusDate);
  const late = state.tasks.filter((task) => task.dueDate < state.focusDate && task.status !== "Concluído");
  els.dailyGreeting.textContent = `${getGreeting()}, Arthur`;
  els.dailySummaryContent.innerHTML = `
    <div class="daily-summary-grid">
      <article><span>Hoje</span><strong>${today.length}</strong><small>tarefas na data foco</small></article>
      <article><span>Atrasadas</span><strong>${late.length}</strong><small>tarefas pendentes</small></article>
      <article><span>Próximo post</span><strong>${next ? formatShortDate(next.dueDate) : "--/--"}</strong><small>${escapeHtml(next?.client || "sem entrega")}</small></article>
    </div>
    <div class="notice-box daily-focus-card">
      <strong>${escapeHtml(next?.theme || "Nenhum post pendente")}</strong>
      <p>${next ? `${escapeHtml(next.client)} · ${escapeHtml(next.deliverable)}` : "Crie uma tarefa para começar."}</p>
    </div>
  `;
  els.dailySummaryDialog.showModal();
}

async function requestNotifications() {
  if (!("Notification" in window)) {
    els.notificationState.textContent = "Este navegador não suporta notificações.";
    return;
  }
  const result = await Notification.requestPermission();
  els.notificationState.textContent = getNotificationText(result);
  await checkDueNotifications();
}

async function checkDueNotifications() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const due = await request(`${api.due}?now=${encodeURIComponent(new Date().toISOString())}`);
  if (!due.length) return;

  const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.ready : null;
  for (const task of due) {
    const title = `Lembrete: ${task.client}`;
    const body = task.theme || task.deliverable;
    if (registration?.showNotification) {
      await registration.showNotification(title, {
        body,
        tag: task.id,
        icon: "/icon.svg",
        badge: "/icon.svg",
        data: { taskId: task.id },
      });
    } else {
      new Notification(title, { body, tag: task.id });
    }
  }
  await request(api.ack, {
    method: "POST",
    body: JSON.stringify({ ids: due.map((task) => task.id) }),
  });
  await loadTasks();
  renderReminders();
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/service-worker.js");
  } catch {
    // The app remains usable without service worker support.
  }
}

async function installApp() {
  if (!state.installPrompt) {
    els.installDialog.showModal();
    return;
  }
  state.installPrompt.prompt();
  await state.installPrompt.userChoice;
  state.installPrompt = null;
}

function applyStoredTheme() {
  const stored = localStorage.getItem("designer-work-theme") || "light";
  document.documentElement.dataset.theme = stored;
  updateThemeButton(stored);
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("designer-work-theme", next);
  updateThemeButton(next);
}

function updateThemeButton(theme) {
  const isDark = theme === "dark";
  els.themeIcon.textContent = isDark ? "☀" : "☾";
  els.themeLabel.textContent = isDark ? "Modo light" : "Modo dark";
}

function setView(viewName) {
  els.navButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === viewName));
  els.views.forEach((view) => view.classList.toggle("active", view.id === `${viewName}View`));
  closeMobileMenu();
}

function toggleMenu() {
  const isOpen = els.sidebar.classList.toggle("menu-open");
  els.menuToggle.setAttribute("aria-expanded", String(isOpen));
  els.menuToggle.setAttribute("aria-label", isOpen ? "Fechar menu" : "Abrir menu");
}

function closeMobileMenu() {
  els.sidebar.classList.remove("menu-open");
  els.menuToggle.setAttribute("aria-expanded", "false");
  els.menuToggle.setAttribute("aria-label", "Abrir menu");
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Erro ${response.status}`);
  }
  return response.json();
}

function statusPill(status) {
  const className = status === "Em andamento" ? "progress" : status === "Aguardando aprovação" ? "waiting" : status === "Concluído" ? "done" : "";
  return `<span class="pill ${className}">${escapeHtml(status)}</span>`;
}

function sortTasks(a, b) {
  return a.dueDate.localeCompare(b.dueDate);
}

function getNotificationText(value) {
  if (!("Notification" in window)) return "Não suportado";
  const permission = value || Notification.permission;
  if (permission === "granted") return "Ativas";
  if (permission === "denied") return "Bloqueadas";
  return "Aguardando permissão";
}

function toDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateString, amount) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);
  return toDateInput(date);
}

function formatShortDate(dateString) {
  return parseDate(dateString).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatLongDate(dateString) {
  return parseDate(dateString).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}

function weekday(dateString) {
  return parseDate(dateString).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
}

function parseDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatReminder(value) {
  if (!value) return "sem lembrete";
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatKb(value) {
  const kb = Number(value || 0) / 1024;
  if (kb < 1024) return `${kb.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} KB`;
  return `${(kb / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

function parseMonth(monthString) {
  const [year, month] = monthString.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
