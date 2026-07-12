(() => {
  "use strict";
  const L = window.Legado;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const authView = $("#authView");
  const adminView = $("#adminView");
  const toast = $("#adminToast");
  const bookingModal = $("#bookingModal");
  let toastTimer = null;
  let calendarDate = new Date();
  calendarDate.setHours(12, 0, 0, 0);
  let calendarMode = "day";
  let currentPortfolioGallery = [];

  function getCredentials() {
    return L.loadRaw(L.KEYS.credentials, null);
  }

  async function hashPassword(value) {
    if (window.crypto?.subtle) {
      const bytes = new TextEncoder().encode(value);
      const hash = await crypto.subtle.digest("SHA-256", bytes);
      return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, "0")).join("");
    }
    let hash = 5381;
    for (const char of String(value)) hash = ((hash << 5) + hash) ^ char.charCodeAt(0);
    return `local-${hash >>> 0}`;
  }

  function showToast(message, error = false) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.toggle("error", error);
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
  }

  async function optimizeImage(file, maxDimension = 1400, quality = 0.8) {
    if (!file || !file.type.startsWith("image/")) throw new Error("Escolha uma imagem válida.");
    if (file.size > 18 * 1024 * 1024) throw new Error("A imagem é muito grande. Escolha um arquivo com até 18 MB.");
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error("Não foi possível ler a imagem.")); image.src = objectUrl; });
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext("2d", { alpha: false });
      context.fillStyle = "#071728"; context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      return canvas.toDataURL("image/webp", quality);
    } finally { URL.revokeObjectURL(objectUrl); }
  }

  function updateStorageMeter() {
    let bytes = 0;
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      bytes += (key?.length || 0) * 2 + (localStorage.getItem(key)?.length || 0) * 2;
    }
    const mb = bytes / (1024 * 1024);
    const label = $("#storageUsage");
    const bar = $("#storageUsageBar");
    if (label) label.textContent = `${mb.toFixed(2)} MB`;
    if (bar) bar.style.width = `${Math.min(100, mb / 5 * 100)}%`;
  }

  function showAuthMessage(message, error = false) {
    const element = $("#authMessage");
    element.textContent = message;
    element.classList.toggle("error", error);
  }

  function configureAuthView() {
    const credentials = getCredentials();
    const setup = $("#setupForm");
    const login = $("#loginForm");
    if (credentials || window.LegadoSupabase?.signIn) {
      setup.classList.add("hidden"); login.classList.remove("hidden");
      $("#authTitle").textContent = "Acesso administrativo";
      $("#authDescription").textContent = window.LegadoSupabase?.signIn ? "Entre com o usuário criado no Supabase Auth." : "Entre para organizar a agenda da Legado Barbearia.";
      $("#loginEmail").value = credentials?.email || "";
    } else {
      setup.classList.remove("hidden"); login.classList.add("hidden");
      $("#authTitle").textContent = "Primeiro acesso";
      $("#authDescription").textContent = "Crie o acesso administrativo deste dispositivo.";
    }
  }

  function showAdmin() {
    authView.classList.add("hidden");
    adminView.classList.remove("hidden");
    $("#logoutButton").classList.remove("hidden");
    $("#openAdminTutorial").classList.remove("hidden");
    const credentials = getCredentials();
    $("#adminNameLabel").textContent = credentials?.name || "Administrador";
    $("#todayLabel").textContent = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
    refreshAll();
    if (localStorage.getItem("legadoAdminTutorialSeen") !== "1") openPanel("tutorial");
  }

  function logout() {
    sessionStorage.removeItem(L.KEYS.session);
    window.LegadoSupabase?.signOut?.();
    adminView.classList.add("hidden"); authView.classList.remove("hidden"); $("#logoutButton").classList.add("hidden"); $("#openAdminTutorial").classList.add("hidden");
    configureAuthView();
  }

  $("#setupForm").addEventListener("submit", async event => {
    event.preventDefault();
    const name = $("#setupName").value.trim();
    const email = $("#setupEmail").value.trim().toLowerCase();
    const password = $("#setupPassword").value;
    const confirmation = $("#setupPasswordConfirm").value;
    if (name.length < 2 || !email.includes("@")) return showAuthMessage("Preencha nome e e-mail corretamente.", true);
    if (password.length < 6) return showAuthMessage("A senha precisa ter no mínimo 6 caracteres.", true);
    if (password !== confirmation) return showAuthMessage("As senhas não coincidem.", true);
    L.save(L.KEYS.credentials, { name, email, passwordHash: await hashPassword(password), createdAt: new Date().toISOString() });
    sessionStorage.setItem(L.KEYS.session, "active");
    showAdmin();
  });

  $("#loginForm").addEventListener("submit", async event => {
    event.preventDefault();
    const credentials = getCredentials();
    const email = $("#loginEmail").value.trim().toLowerCase();
    const password = $("#loginPassword").value;
    if (window.LegadoSupabase?.signIn) {
      showAuthMessage("Conectando ao Supabase...");
      const remote = await window.LegadoSupabase.signIn(email, password);
      if (remote.ok) { sessionStorage.setItem(L.KEYS.session, "active"); showAuthMessage(""); showAdmin(); return; }
    }
    const passwordHash = await hashPassword(password);
    if (!credentials || email !== String(credentials.email).toLowerCase() || passwordHash !== credentials.passwordHash) return showAuthMessage("E-mail ou senha incorretos.", true);
    sessionStorage.setItem(L.KEYS.session, "active"); showAuthMessage(""); showAdmin();
  });

  $("#logoutButton").addEventListener("click", logout);
  $$('[data-toggle-password]').forEach(button => button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.togglePassword);
    input.type = input.type === "password" ? "text" : "password";
    button.textContent = input.type === "password" ? "Mostrar" : "Ocultar";
  }));

  function renderAdminTutorial() {
    const settings = L.getSettings();
    const services = L.getServices(true);
    const availability = L.getAvailability();
    const portfolio = L.getPortfolio(true);
    const testimonials = L.getTestimonials(true);
    const enabledDays = Object.values(availability.weekdays || {}).filter(day => day?.enabled && day.periods?.length).length;
    const checks = [
      { title: "Contato e endereço", detail: settings.whatsappNumber && settings.address ? "Informações públicas preenchidas" : "Preencha os dados públicos", done: Boolean(settings.whatsappNumber && settings.address), panel: "settings" },
      { title: "Serviços", detail: services.length ? `${services.length} serviço(s) cadastrado(s)` : "Cadastre os serviços", done: services.length > 0, panel: "services" },
      { title: "Horários", detail: enabledDays ? `${enabledDays} dia(s) com expediente` : "Configure o expediente", done: enabledDays > 0, panel: "availability" },
      { title: "Portfólio", detail: portfolio.length ? `${portfolio.length} trabalho(s) publicado(s)` : "Adicione fotos reais", done: portfolio.length > 0, panel: "portfolio" },
      { title: "Avaliações", detail: testimonials.length ? `${testimonials.length} avaliação(ões)` : "Cadastre feedbacks reais", done: testimonials.length > 0, panel: "testimonials" }
    ];
    const completed = checks.filter(item => item.done).length;
    const label = $("#tutorialProgressLabel");
    const bar = $("#tutorialProgressBar");
    const list = $("#adminTutorialChecklist");
    if (label) label.textContent = `${completed} de ${checks.length}`;
    if (bar) bar.style.width = `${completed / checks.length * 100}%`;
    if (list) list.innerHTML = checks.map(item => `
      <button class="tutorial-check-item ${item.done ? "done" : ""}" type="button" data-open-panel="${item.panel}">
        <span class="tutorial-check-status">${item.done ? "✓" : "○"}</span>
        <strong>${L.escapeHTML(item.title)}</strong>
        <small>${L.escapeHTML(item.detail)}</small>
      </button>`).join("");
  }

  function openPanel(name) {
    $$(".admin-panel").forEach(panel => panel.classList.toggle("active", panel.dataset.panel === name));
    $$(".admin-nav-button[data-panel-target]").forEach(button => button.classList.toggle("active", button.dataset.panelTarget === name));
    const mobileSelect = $("#adminPanelSelect");
    if (mobileSelect) mobileSelect.value = name;
    if (name === "calendar") renderCalendar();
    if (name === "reports") renderReports();
    if (name === "portfolio") renderPortfolioAdmin();
    if (name === "testimonials") renderTestimonialsAdmin();
    if (name === "tutorial") renderAdminTutorial();
    if (window.innerWidth <= 1200) document.querySelector(".admin-content")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  $$('[data-panel-target]').forEach(button => button.addEventListener("click", () => openPanel(button.dataset.panelTarget)));
  $$('[data-open-panel]').forEach(button => button.addEventListener("click", () => openPanel(button.dataset.openPanel)));
  $("#adminPanelSelect")?.addEventListener("change", event => openPanel(event.target.value));
  document.addEventListener("click", event => {
    const dynamicButton = event.target.closest("[data-open-panel]");
    if (dynamicButton && dynamicButton.closest("#adminTutorialChecklist")) openPanel(dynamicButton.dataset.openPanel);
  });
  $("#openAdminTutorial").addEventListener("click", () => openPanel("tutorial"));
  $("#finishAdminTutorial").addEventListener("click", () => { localStorage.setItem("legadoAdminTutorialSeen", "1"); openPanel("overview"); showToast("Tutorial concluído. Você pode abri-lo novamente quando quiser."); });

  function statusBadge(status) {
    return `<span class="status-badge status-${status}">${L.statusLabel(status)}</span>`;
  }

  function currentMonthRange() {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1, 12);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0, 12);
    return [L.toLocalISO(first), L.toLocalISO(last)];
  }

  function renderOverview() {
    const bookings = L.getBookings();
    const today = L.todayISO();
    const [monthStart, monthEnd] = currentMonthRange();
    const todayList = bookings.filter(item => item.date === today && item.status !== "cancelled").sort((a, b) => a.startTime.localeCompare(b.startTime));
    const completedMonth = bookings.filter(item => item.status === "completed" && item.date >= monthStart && item.date <= monthEnd);
    const pendingCount = bookings.filter(item => item.status === "pending" && L.dateTimeValue(item.date, item.startTime) >= Date.now()).length;
    $("#statToday").textContent = todayList.length;
    $("#statPending").textContent = pendingCount;
    if ($("#pendingQuickCount")) $("#pendingQuickCount").textContent = pendingCount;
    if ($("#pendingNavBadge")) { $("#pendingNavBadge").textContent = pendingCount; $("#pendingNavBadge").classList.toggle("empty", pendingCount === 0); }
    $("#statCompleted").textContent = completedMonth.length;
    $("#statRevenue").textContent = L.formatCurrency(completedMonth.reduce((sum, item) => sum + item.priceValue, 0));
    $("#todayBookings").innerHTML = todayList.length ? todayList.map(item => `
      <div class="today-booking-item" data-booking-id="${L.escapeHTML(item.id)}">
        <div class="today-booking-time">${item.startTime}</div><div><strong>${L.escapeHTML(item.name)}</strong><small>${L.escapeHTML(item.service)} · até ${item.endTime}</small></div>${statusBadge(item.status)}
      </div>`).join("") : '<div class="empty-admin"><strong>Agenda livre hoje</strong>Nenhum atendimento registrado para esta data.</div>';
  }

  $("#todayBookings").addEventListener("click", event => {
    const id = event.target.closest("[data-booking-id]")?.dataset.bookingId;
    if (id) openBookingEditor(id);
  });

  $("#openPendingBookings")?.addEventListener("click", () => {
    $("#bookingSearch").value = "";
    $("#bookingDateFilter").value = "";
    $("#bookingStatusFilter").value = "pending";
    openPanel("bookings");
    renderBookings();
  });

  function filteredBookings() {
    const search = $("#bookingSearch").value.trim().toLowerCase();
    const date = $("#bookingDateFilter").value;
    const status = $("#bookingStatusFilter").value;
    return L.getBookings().filter(item => {
      const haystack = `${item.name} ${item.phone} ${item.service} ${item.code}`.toLowerCase();
      return (!search || haystack.includes(search)) && (!date || item.date === date) && (status === "all" || item.status === status);
    }).sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`));
  }

  function renderBookings() {
    const bookings = filteredBookings();
    const table = $("#bookingTable");
    const header = '<div class="booking-row header"><span>Cliente</span><span>Data e horário</span><span>Serviço</span><span>Valor</span><span>Status</span><span>Ações</span></div>';
    if (!bookings.length) {
      table.innerHTML = `${header}<div class="empty-admin"><strong>Nenhum agendamento</strong>Não há registros que correspondam aos filtros.</div>`;
      return;
    }
    table.innerHTML = header + bookings.map(item => {
      const activeConflicts = L.findBookingConflicts({ date: item.date, startTime: item.startTime, durationMinutes: item.durationMinutes, professional: item.professional, ignoreBookingId: item.id, statuses: ["pending", "confirmed"] });
      return `
      <div class="booking-row ${activeConflicts.length ? "booking-row-conflict" : ""}" data-booking-id="${L.escapeHTML(item.id)}">
        <div class="booking-client" data-label="Cliente"><strong>${L.escapeHTML(item.name)}</strong><small>${L.escapeHTML(item.phone)} · ${L.escapeHTML(item.code)}</small></div>
        <div class="booking-cell" data-label="Data e horário"><strong>${L.escapeHTML(L.formatDate(item.date, { day: "2-digit", month: "short", year: "numeric" }))}</strong><small>${item.startTime}–${item.endTime}</small></div>
        <div class="booking-cell" data-label="Serviço"><strong>${L.escapeHTML(item.service)}</strong><small>${item.durationMinutes} min</small></div>
        <div class="booking-cell" data-label="Valor / profissional"><strong>${item.priceValue > 0 ? L.formatCurrency(item.priceValue) : "—"}</strong><small>${L.escapeHTML(item.professional)}</small></div>
        <div data-label="Status">${statusBadge(item.status)}</div>
        <div class="booking-actions" data-label="Ações">
          <button class="icon-action" data-booking-action="edit" type="button">Editar</button>
          <button class="icon-action" data-booking-action="whatsapp" type="button">WhatsApp</button>
          ${["pending", "confirmed"].includes(item.status) && L.dateTimeValue(item.date, item.startTime) > Date.now() ? '<button class="icon-action" data-booking-action="reminder" type="button">Lembrete</button>' : ""}
          ${item.status === "pending" ? '<button class="icon-action confirm-action" data-booking-action="confirmed" type="button" title="Confirma este horário e impede outro atendimento do mesmo profissional">✓ Confirmar</button>' : ""}
          ${activeConflicts.length ? `<span class="booking-conflict-label" title="Existe outro registro concorrente para este profissional e horário">⚠ conflito</span>` : ""}
          ${["pending", "confirmed"].includes(item.status) ? '<button class="icon-action" data-booking-action="completed" type="button">Concluir</button><button class="icon-action" data-booking-action="no_show" type="button">Faltou</button><button class="icon-action danger" data-booking-action="cancelled" type="button">Cancelar</button>' : ""}
          <button class="icon-action danger" data-booking-action="delete" type="button">Excluir</button>
        </div>
      </div>`;
    }).join("");
  }

  [$("#bookingSearch"), $("#bookingDateFilter"), $("#bookingStatusFilter")].forEach(element => element.addEventListener("input", renderBookings));
  $("#clearBookingFilters").addEventListener("click", () => { $("#bookingSearch").value = ""; $("#bookingDateFilter").value = ""; $("#bookingStatusFilter").value = "all"; renderBookings(); });
  $("#exportBookings").addEventListener("click", () => L.exportBookingsCSV(filteredBookings()));

  function openBookingWhatsApp(booking, mode = "details") {
    const digits = booking.phoneDigits || L.normalizePhone(booking.phone);
    const number = digits.startsWith("55") ? digits : `55${digits}`;
    const intro = mode === "reminder"
      ? `Olá, ${booking.name}! Passando para lembrar do seu horário na Legado Barbearia.`
      : `Olá, ${booking.name}! Aqui é da Legado Barbearia. Seguem os dados do seu agendamento.`;
    const message = [intro, "", `*Código:* ${booking.code}`, `*Serviço:* ${booking.service}`, `*Data:* ${L.formatDate(booking.date)}`, `*Horário:* ${booking.startTime} às ${booking.endTime}`, `*Profissional:* ${booking.professional}`, `*Status:* ${L.statusLabel(booking.status)}`, mode === "reminder" ? "Se precisar alterar, fale conosco com antecedência." : ""].filter(Boolean).join("\n");
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  }

  $("#bookingTable").addEventListener("click", event => {
    const row = event.target.closest("[data-booking-id]");
    const action = event.target.closest("[data-booking-action]")?.dataset.bookingAction;
    if (!row || !action) return;
    const booking = L.getBookings().find(item => String(item.id) === String(row.dataset.bookingId));
    if (!booking) return;
    if (action === "edit") return openBookingEditor(booking.id);
    if (action === "whatsapp") return openBookingWhatsApp(booking);
    if (action === "reminder") return openBookingWhatsApp(booking, "reminder");
    if (action === "delete") {
      if (!window.confirm(`Excluir definitivamente o agendamento de ${booking.name}?`)) return;
      L.deleteBooking(booking.id); showToast("Agendamento excluído."); return;
    }
    if (action === "confirmed") {
      const firstCheck = L.confirmBooking(booking.id);
      if (!firstCheck.ok && firstCheck.reason === "confirmed_conflict") {
        const conflict = firstCheck.conflicts[0];
        showToast(`Não foi possível confirmar: ${conflict.name} já está confirmado às ${conflict.startTime} com ${conflict.professional}.`, true);
        return;
      }
      if (!firstCheck.ok && firstCheck.reason === "pending_conflict") {
        const names = firstCheck.conflicts.map(item => `${item.name} (${item.code})`).join(", ");
        const proceed = window.confirm(`Existe ${firstCheck.conflicts.length} solicitação pendente concorrente para o mesmo profissional e horário: ${names}.

Confirmar ${booking.name} e cancelar automaticamente as solicitações concorrentes?`);
        if (!proceed) return;
        const result = L.confirmBooking(booking.id, { cancelPendingConflicts: true });
        if (!result.ok) return showToast("Não foi possível confirmar o horário. Atualize a agenda e tente novamente.", true);
        showToast(`Agendamento confirmado. ${result.cancelledConflicts.length} solicitação(ões) concorrente(s) cancelada(s).`);
        return;
      }
      if (firstCheck.ok) {
        showToast("Agendamento confirmado e horário protegido para este profissional.");
        return;
      }
      return showToast("Não foi possível confirmar o agendamento.", true);
    }
    L.upsertBooking({ ...booking, status: action, updatedAt: new Date().toISOString() });
    showToast(`Agendamento marcado como ${L.statusLabel(action).toLowerCase()}.`);
  });

  function renderClients() {
    const search = $("#clientSearch").value.trim().toLowerCase();
    const clientSettings = L.getSettings();
    const groups = new Map();
    L.getClients().forEach(client => {
      if (!client.phoneDigits) return;
      groups.set(client.phoneDigits, { ...client, bookings: [] });
    });
    L.getBookings().forEach(booking => {
      const key = booking.phoneDigits || booking.phone;
      if (!groups.has(key)) groups.set(key, { name: booking.name, phone: booking.phone, phoneDigits: booking.phoneDigits, photo: booking.clientPhoto || "", bookings: [] });
      const group = groups.get(key); group.name = booking.name || group.name; group.phone = booking.phone || group.phone; group.photo = booking.clientPhoto || group.photo; group.bookings.push(booking);
    });
    const clients = [...groups.values()].map(client => {
      const sorted = client.bookings.sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`));
      const completed = sorted.filter(item => item.status === "completed");
      const upcoming = sorted.filter(item => ["pending", "confirmed"].includes(item.status) && L.dateTimeValue(item.date, item.startTime) >= Date.now());
      return { ...client, last: sorted[0], completed: completed.length, upcoming: upcoming.length, spent: completed.reduce((sum, item) => sum + item.priceValue, 0) };
    }).filter(client => !search || `${client.name} ${client.phone}`.toLowerCase().includes(search)).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    $("#clientsCount").textContent = groups.size;
    $("#clientsGrid").innerHTML = clients.length ? clients.map(client => `
      <article class="client-card" data-client-phone="${L.escapeHTML(client.phoneDigits)}"><div class="client-card-head"><div class="client-profile-head">${client.photo ? `<img class="client-avatar" src="${L.escapeHTML(client.photo)}" alt="${L.escapeHTML(client.name)}" />` : `<span class="client-avatar">${L.escapeHTML(String(client.name || "CL").split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "CL")}</span>`}<div><h3>${L.escapeHTML(client.name)}</h3><p>${L.escapeHTML(client.phone)}</p></div></div><span class="count-pill">${client.bookings.length}</span></div>
      <div class="client-card-stats"><div><span>Concluídos</span><strong>${client.completed}</strong></div><div><span>Próximos</span><strong>${client.upcoming}</strong></div><div><span>Total</span><strong>${L.formatCurrency(client.spent)}</strong></div></div>
      <p>Último registro: ${client.last ? L.formatDate(client.last.date, { day: "2-digit", month: "short", year: "numeric" }) : "—"}</p>
      ${clientSettings.loyaltyEnabled ? `<div class="loyalty-progress"><div><span>Fidelidade</span><strong>${client.completed % Math.max(1, Number(clientSettings.loyaltyGoal) || 10)}/${Math.max(1, Number(clientSettings.loyaltyGoal) || 10)}</strong></div><i style="width:${Math.min(100,(client.completed % Math.max(1, Number(clientSettings.loyaltyGoal) || 10))/Math.max(1, Number(clientSettings.loyaltyGoal) || 10)*100)}%"></i><small>${L.escapeHTML(clientSettings.loyaltyReward || "Benefício configurado")}</small></div>` : ""}
      <div class="client-card-actions"><button type="button" data-client-action="filter">Ver histórico</button><a href="https://wa.me/55${L.escapeHTML(client.phoneDigits)}" target="_blank" rel="noopener">WhatsApp</a></div></article>`).join("") : '<div class="empty-admin"><strong>Nenhum cliente</strong>Os clientes aparecerão após os primeiros agendamentos.</div>';
  }
  $("#clientSearch").addEventListener("input", renderClients);
  $("#clientsGrid").addEventListener("click", event => {
    const button = event.target.closest('[data-client-action="filter"]');
    if (!button) return;
    const card = button.closest("[data-client-phone]");
    $("#bookingSearch").value = card.dataset.clientPhone;
    openPanel("bookings"); renderBookings();
  });

  function setServiceIcon(source, preset = "") {
    const resolved = source || preset || "corte.webp";
    $("#serviceIconData").value = resolved;
    $("#serviceIconPreview img").src = L.resolveMediaSource(resolved);
    if (preset) $("#serviceIconPreset").value = preset;
  }

  function resetServiceForm() {
    $("#serviceForm").reset();
    $("#serviceId").value = "";
    $("#serviceActive").checked = true;
    $("#serviceFormTitle").textContent = "Novo serviço";
    $("#cancelServiceEdit").classList.add("hidden");
    $("#serviceIconUpload").value = "";
    setServiceIcon("corte.webp", "corte.webp");
  }

  function renderServices() {
    const services = L.getServices(true);
    $("#servicesCount").textContent = services.length;
    $("#servicesList").innerHTML = services.length ? services.map(service => `
      <div class="management-item service-management-item ${service.active ? "" : "inactive"}" data-service-id="${L.escapeHTML(service.id)}">
        <img class="service-management-icon" src="${L.escapeHTML(L.resolveMediaSource(service.icon))}" alt="" />
        <div><h4>${L.escapeHTML(service.name)}</h4><p>${L.escapeHTML(service.description)}</p><div class="item-meta">${service.durationMinutes} min · ${service.price > 0 ? L.formatCurrency(service.price) : "valor não informado"} · ${service.active ? "ativo" : "oculto"}</div></div>
        <div class="management-actions"><button class="icon-action" data-service-action="edit" type="button">Editar</button><button class="icon-action" data-service-action="toggle" type="button">${service.active ? "Ocultar" : "Ativar"}</button><button class="icon-action danger" data-service-action="delete" type="button">Excluir</button></div>
      </div>`).join("") : '<div class="empty-admin"><strong>Nenhum serviço</strong>Cadastre o primeiro serviço.</div>';
  }

  $("#serviceIconPreset").addEventListener("change", event => {
    $("#serviceIconUpload").value = "";
    setServiceIcon(event.target.value, event.target.value);
  });

  $("#serviceIconUpload").addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      showToast("Otimizando ícone...");
      const data = await optimizeImage(file, 720, .84);
      setServiceIcon(data);
      showToast("Ícone pronto. Salve o serviço para publicar.");
    } catch (error) {
      showToast(error.message, true);
      event.target.value = "";
    }
  });

  $("#resetServiceIcon").addEventListener("click", () => {
    const preset = $("#serviceIconPreset").value || "corte.webp";
    $("#serviceIconUpload").value = "";
    setServiceIcon(preset, preset);
  });

  $("#serviceForm").addEventListener("submit", event => {
    event.preventDefault();
    const id = $("#serviceId").value || `${L.slugify($("#serviceName").value)}-${Date.now()}`;
    const service = L.normalizeService({ id, name: $("#serviceName").value.trim(), durationMinutes: Number($("#serviceDuration").value), price: Number($("#servicePrice").value || 0), icon: $("#serviceIconData").value || $("#serviceIconPreset").value, active: $("#serviceActive").checked, description: $("#serviceDescription").value.trim() });
    if (service.name.length < 2 || service.durationMinutes < 5) return showToast("Informe nome e duração válidos.", true);
    const services = L.getServices(true); const index = services.findIndex(item => item.id === id);
    if (index >= 0) services[index] = service; else services.push(service);
    try {
      L.setServices(services); resetServiceForm(); showToast("Serviço e ícone salvos."); updateStorageMeter();
    } catch (error) {
      showToast("O armazenamento deste navegador está cheio. Use uma imagem menor ou remova fotos antigas.", true);
    }
  });
  $("#cancelServiceEdit").addEventListener("click", resetServiceForm);
  $("#servicesList").addEventListener("click", event => {
    const item = event.target.closest("[data-service-id]"); const action = event.target.closest("[data-service-action]")?.dataset.serviceAction;
    if (!item || !action) return;
    const services = L.getServices(true); const service = services.find(current => current.id === item.dataset.serviceId); if (!service) return;
    if (action === "edit") {
      $("#serviceId").value = service.id;
      $("#serviceName").value = service.name;
      $("#serviceDuration").value = service.durationMinutes;
      $("#servicePrice").value = service.price || "";
      $("#serviceActive").checked = service.active;
      $("#serviceDescription").value = service.description;
      $("#serviceFormTitle").textContent = "Editar serviço";
      $("#cancelServiceEdit").classList.remove("hidden");
      $("#serviceIconUpload").value = "";
      const isPreset = L.ICONS.includes(service.icon);
      $("#serviceIconPreset").value = isPreset ? service.icon : "corte.webp";
      setServiceIcon(service.icon);
      $("#serviceForm").scrollIntoView({ behavior: "smooth", block: "start" });
      $("#serviceName").focus();
    }
    if (action === "toggle") { service.active = !service.active; L.setServices(services); showToast(service.active ? "Serviço ativado." : "Serviço ocultado."); }
    if (action === "delete") {
      if (!window.confirm(`Excluir o serviço “${service.name}”? Agendamentos antigos não serão apagados.`)) return;
      L.setServices(services.filter(current => current.id !== service.id)); showToast("Serviço excluído."); updateStorageMeter();
    }
  });

  function dedupeImages(list) {
    return [...new Set((Array.isArray(list) ? list : []).map(value => String(value || "").trim()).filter(Boolean))];
  }

  function renderPortfolioGalleryEditor() {
    const container = $("#portfolioGalleryEditor");
    if (!container) return;
    const cover = $("#portfolioImageData").value || "assets/corte.webp";
    const gallery = dedupeImages(currentPortfolioGallery.length ? currentPortfolioGallery : [cover]);
    container.innerHTML = gallery.map((image, index) => `
      <article class="portfolio-gallery-thumb" data-gallery-index="${index}">
        <img src="${L.escapeHTML(image)}" alt="Prévia da foto ${index + 1}" />
        <footer>
          <small>${image === cover ? "Foto de capa" : `Foto ${index + 1}`}</small>
          <button type="button" data-gallery-action="cover">Usar como capa</button>
          <button type="button" class="danger" data-gallery-action="remove">Remover</button>
        </footer>
      </article>`).join("");
  }

  async function appendPortfolioGallery(files) {
    const list = [...(files || [])];
    if (!list.length) return;
    try {
      showToast("Otimizando fotos do portfólio...");
      for (const file of list) {
        const data = await optimizeImage(file, 1600, .8);
        currentPortfolioGallery.push(data);
      }
      currentPortfolioGallery = dedupeImages(currentPortfolioGallery);
      if (!$("#portfolioImageData").value && currentPortfolioGallery[0]) {
        $("#portfolioImageData").value = currentPortfolioGallery[0];
        $("#portfolioImagePreview img").src = currentPortfolioGallery[0];
      }
      renderPortfolioGalleryEditor();
      showToast(list.length > 1 ? `${list.length} fotos adicionadas.` : "Foto adicionada.");
    } catch (error) { showToast(error.message, true); }
  }

  function loadPortfolioSectionTexts() {
    const current = L.getSettings();
    const titleInput = $("#portfolioSectionTitleInput");
    const textInput = $("#portfolioSectionTextInput");
    if (titleInput) titleInput.value = current.portfolioTitle || "Trabalhos que carregam identidade.";
    if (textInput) textInput.value = current.portfolioText || "Conheça alguns estilos, serviços e detalhes da experiência Legado.";
  }

  const portfolioSectionTextForm = $("#portfolioSectionTextForm");
  if (portfolioSectionTextForm) portfolioSectionTextForm.addEventListener("submit", event => {
    event.preventDefault();
    const title = $("#portfolioSectionTitleInput").value.trim();
    const description = $("#portfolioSectionTextInput").value.trim();
    if (title.length < 3) return showToast("Informe o título da seção do portfólio.", true);
    L.setSettings({ portfolioTitle: title, portfolioText: description });
    showToast("Textos gerais do portfólio atualizados.");
  });

  function resetPortfolioForm() {
    $("#portfolioForm").reset();
    $("#portfolioId").value = "";
    $("#portfolioImageData").value = "assets/corte.webp";
    $("#portfolioImagePreview img").src = "assets/corte.webp";
    currentPortfolioGallery = ["assets/corte.webp"];
    $("#portfolioSummaryInput").value = "";
    $("#portfolioDescriptionInput").value = "";
    $("#portfolioAltInput").value = "";
    $("#portfolioOrderInput").value = String(L.getPortfolio(true).length + 1);
    $("#portfolioActiveInput").checked = true;
    $("#portfolioFormTitle").textContent = "Adicionar trabalho";
    $("#portfolioImage").value = "";
    const extraInput = $("#portfolioGalleryImages"); if (extraInput) extraInput.value = "";
    renderPortfolioGalleryEditor();
  }

  function renderPortfolioAdmin() {
    loadPortfolioSectionTexts();
    const items = L.getPortfolio(true);
    $("#portfolioCount").textContent = items.length;
    $("#portfolioAdminList").innerHTML = items.length ? items.map(item => `
      <article class="portfolio-admin-item ${item.active ? "" : "inactive"}" data-portfolio-admin-id="${L.escapeHTML(item.id)}">
        <img src="${L.escapeHTML(item.image)}" alt="" />
        <div><h4>${L.escapeHTML(item.title)}</h4><p><strong>Legenda:</strong> ${L.escapeHTML(item.summary || item.description)}</p><p class="portfolio-admin-description"><strong>Texto completo:</strong> ${L.escapeHTML(item.description)}</p><div class="item-meta">${L.escapeHTML(item.category)} · ordem ${item.order} · <strong>${(Array.isArray(item.images) ? item.images.length : 1)} foto(s)</strong> · ${item.featured ? "destaque · " : ""}${item.active ? "publicado" : "oculto"}</div></div>
        <div class="management-actions"><button class="icon-action" data-portfolio-action="edit" type="button">Editar</button><button class="icon-action" data-portfolio-action="up" type="button">↑</button><button class="icon-action" data-portfolio-action="down" type="button">↓</button><button class="icon-action" data-portfolio-action="toggle" type="button">${item.active ? "Ocultar" : "Publicar"}</button><button class="icon-action danger" data-portfolio-action="delete" type="button">Excluir</button></div>
      </article>`).join("") : '<div class="empty-admin"><strong>Portfólio vazio</strong>Adicione fotos dos trabalhos e do ambiente.</div>';
    updateStorageMeter();
  }

  $("#portfolioImage").addEventListener("change", async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      showToast("Otimizando imagem...");
      const data = await optimizeImage(file, 1500, .8);
      const previousCover = $("#portfolioImageData").value;
      $("#portfolioImageData").value = data; $("#portfolioImagePreview img").src = data;
      currentPortfolioGallery = dedupeImages([data, ...currentPortfolioGallery.filter(image => image !== previousCover)]);
      renderPortfolioGalleryEditor();
      showToast("Imagem pronta para salvar.");
    } catch (error) { showToast(error.message, true); event.target.value = ""; }
  });

  const portfolioGalleryInput = $("#portfolioGalleryImages");
  if (portfolioGalleryInput) portfolioGalleryInput.addEventListener("change", event => {
    appendPortfolioGallery(event.target.files);
    event.target.value = "";
  });

  $("#portfolioGalleryEditor").addEventListener("click", event => {
    const card = event.target.closest("[data-gallery-index]");
    const action = event.target.closest("[data-gallery-action]")?.dataset.galleryAction;
    if (!card || !action) return;
    const index = Number(card.dataset.galleryIndex);
    const image = currentPortfolioGallery[index];
    if (!image) return;
    if (action === "cover") {
      $("#portfolioImageData").value = image;
      $("#portfolioImagePreview img").src = image;
      currentPortfolioGallery = dedupeImages([image, ...currentPortfolioGallery.filter(current => current !== image)]);
      renderPortfolioGalleryEditor();
      return;
    }
    if (action === "remove") {
      currentPortfolioGallery.splice(index, 1);
      currentPortfolioGallery = dedupeImages(currentPortfolioGallery);
      if (!currentPortfolioGallery.length) currentPortfolioGallery = ["assets/corte.webp"];
      if (!currentPortfolioGallery.includes($("#portfolioImageData").value)) {
        $("#portfolioImageData").value = currentPortfolioGallery[0];
        $("#portfolioImagePreview img").src = currentPortfolioGallery[0];
      }
      renderPortfolioGalleryEditor();
    }
  });

  $("#portfolioForm").addEventListener("submit", event => {
    event.preventDefault();
    const title = $("#portfolioTitleInput").value.trim();
    if (title.length < 2) return showToast("Informe um título para o trabalho.", true);
    if ($("#portfolioSummaryInput").value.trim().length < 3) return showToast("Escreva uma legenda curta para o card.", true);
    if ($("#portfolioDescriptionInput").value.trim().length < 5) return showToast("Escreva o texto completo do trabalho.", true);
    const id = $("#portfolioId").value || `${L.slugify(title)}-${Date.now()}`;
    const items = L.getPortfolio(true);
    const existing = items.find(item => item.id === id);
    const cover = $("#portfolioImageData").value || existing?.image || "assets/corte.webp";
    const galleryImages = dedupeImages([cover, ...(currentPortfolioGallery.length ? currentPortfolioGallery : (existing?.images || []))]);
    const item = L.normalizePortfolioItem({
      ...existing, id, title, category: $("#portfolioCategoryInput").value.trim() || "Cortes",
      summary: $("#portfolioSummaryInput").value.trim(), description: $("#portfolioDescriptionInput").value.trim(), alt: $("#portfolioAltInput").value.trim() || title,
      image: cover, images: galleryImages,
      featured: $("#portfolioFeaturedInput").checked, active: $("#portfolioActiveInput").checked,
      order: Number($("#portfolioOrderInput").value) || items.length + 1
    });
    const index = items.findIndex(current => current.id === id);
    if (index >= 0) items[index] = item; else items.push(item);
    try { L.setPortfolio(items); resetPortfolioForm(); showToast("Portfólio atualizado."); }
    catch (error) { showToast("O armazenamento deste navegador está cheio. Remova imagens ou faça o backup.", true); }
  });
  $("#resetPortfolioForm").addEventListener("click", resetPortfolioForm);
  $("#portfolioAdminList").addEventListener("click", event => {
    const row = event.target.closest("[data-portfolio-admin-id]");
    const action = event.target.closest("[data-portfolio-action]")?.dataset.portfolioAction;
    if (!row || !action) return;
    const items = L.getPortfolio(true); const index = items.findIndex(item => item.id === row.dataset.portfolioAdminId); if (index < 0) return;
    const item = items[index];
    if (action === "edit") {
      $("#portfolioId").value = item.id; $("#portfolioTitleInput").value = item.title; $("#portfolioCategoryInput").value = item.category; $("#portfolioSummaryInput").value = item.summary || item.description; $("#portfolioDescriptionInput").value = item.description; $("#portfolioAltInput").value = item.alt; $("#portfolioImageData").value = item.image; $("#portfolioImagePreview img").src = item.image; $("#portfolioFeaturedInput").checked = item.featured; $("#portfolioActiveInput").checked = item.active; $("#portfolioOrderInput").value = item.order; currentPortfolioGallery = dedupeImages(item.images && item.images.length ? item.images : [item.image]); renderPortfolioGalleryEditor(); $("#portfolioFormTitle").textContent = "Editar trabalho"; $("#portfolioForm").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (action === "toggle") { item.active = !item.active; L.setPortfolio(items); showToast(item.active ? "Trabalho publicado." : "Trabalho ocultado."); }
    if (["up", "down"].includes(action)) {
      const target = action === "up" ? index - 1 : index + 1; if (target < 0 || target >= items.length) return;
      [items[index], items[target]] = [items[target], items[index]]; items.forEach((entry, order) => entry.order = order + 1); L.setPortfolio(items);
    }
    if (action === "delete") { if (!window.confirm(`Excluir “${item.title}” do portfólio?`)) return; L.setPortfolio(items.filter(current => current.id !== item.id)); resetPortfolioForm(); showToast("Item excluído."); }
  });

  function resetTestimonialForm() {
    $("#testimonialForm").reset(); $("#testimonialId").value = ""; $("#testimonialPhoto").value = ""; $("#testimonialPhone").value = ""; $("#testimonialActive").checked = true; $("#testimonialRating").value = "5"; $("#testimonialOrder").value = String(L.getTestimonials(true).length + 1); $("#testimonialFormTitle").textContent = "Adicionar avaliação";
  }

  function renderTestimonialsAdmin() {
    const items = L.getTestimonials(true);
    $("#testimonialsCount").textContent = items.length;
    if ($("#pendingTestimonialsCount")) $("#pendingTestimonialsCount").textContent = items.filter(item => item.status === "pending").length;
    $("#testimonialAdminList").innerHTML = items.length ? items.map(item => `
      <article class="testimonial-admin-item ${item.active ? "" : "inactive"} ${item.status === "pending" ? "pending-review" : ""}" data-testimonial-admin-id="${L.escapeHTML(item.id)}">
        <div class="testimonial-admin-head">${item.photo ? `<img class="testimonial-admin-avatar" src="${L.escapeHTML(item.photo)}" alt="${L.escapeHTML(item.name)}" />` : ""}<div><div class="testimonial-admin-stars">${"★".repeat(item.rating)}${"☆".repeat(5-item.rating)}</div><span class="status-badge status-${item.status === "approved" ? "completed" : item.status === "rejected" ? "cancelled" : "pending"}">${item.status === "approved" ? "Aprovada" : item.status === "rejected" ? "Rejeitada" : "Pendente"}</span></div></div>
        <blockquote>${L.escapeHTML(item.text)}</blockquote>
        <div><strong>${L.escapeHTML(item.name)}</strong><span>${L.escapeHTML(item.service)} · ${item.phone ? `${L.escapeHTML(item.phone)} · ` : ""}ordem ${item.order} · ${item.source === "site" ? "enviada pelo site" : "criada no admin"}</span></div>
        <div class="management-actions">
          ${item.status !== "approved" ? '<button class="icon-action confirm-action" data-testimonial-action="approve" type="button">Aprovar</button>' : ""}
          <button class="icon-action" data-testimonial-action="edit" type="button">Editar</button>
          <button class="icon-action" data-testimonial-action="toggle" type="button">${item.active ? "Ocultar" : "Publicar"}</button>
          ${item.status !== "rejected" ? '<button class="icon-action danger" data-testimonial-action="reject" type="button">Rejeitar</button>' : ""}
          <button class="icon-action danger" data-testimonial-action="delete" type="button">Excluir</button>
        </div>
      </article>`).join("") : '<div class="empty-admin"><strong>Nenhuma avaliação</strong>As avaliações enviadas pelo site aparecerão aqui para aprovação.</div>';
  }

  $("#testimonialForm").addEventListener("submit", event => {
    event.preventDefault();
    const name = $("#testimonialName").value.trim(); const text = $("#testimonialText").value.trim();
    if (name.length < 2 || text.length < 8) return showToast("Informe o nome e um depoimento válido.", true);
    const id = $("#testimonialId").value || `testimonial-${Date.now()}`; const items = L.getTestimonials(true); const existing = items.find(item => item.id === id);
    const active = $("#testimonialActive").checked;
    const phone = $("#testimonialPhone").value || existing?.phone || "";
    const item = L.normalizeTestimonial({ ...existing, id, name, text, phone, phoneDigits: L.normalizePhone(phone), photo: $("#testimonialPhoto").value || existing?.photo || "", service: $("#testimonialService").value.trim() || "Atendimento Legado", rating: Number($("#testimonialRating").value), order: Number($("#testimonialOrder").value) || items.length + 1, active, status: active ? "approved" : "pending", source: existing?.source || "admin", updatedAt: new Date().toISOString() });
    const index = items.findIndex(current => current.id === id); if (index >= 0) items[index] = item; else items.push(item);
    if (item.phoneDigits) L.upsertClient({ name: item.name, phone: item.phone, phoneDigits: item.phoneDigits, photo: item.photo });
    L.setTestimonials(items); resetTestimonialForm(); showToast("Avaliação salva.");
  });
  $("#resetTestimonialForm").addEventListener("click", resetTestimonialForm);
  $("#testimonialAdminList").addEventListener("click", event => {
    const row = event.target.closest("[data-testimonial-admin-id]"); const action = event.target.closest("[data-testimonial-action]")?.dataset.testimonialAction; if (!row || !action) return;
    const items = L.getTestimonials(true); const item = items.find(current => current.id === row.dataset.testimonialAdminId); if (!item) return;
    if (action === "edit") { $("#testimonialId").value = item.id; $("#testimonialName").value = item.name; $("#testimonialPhone").value = item.phone || ""; $("#testimonialPhoto").value = item.photo || ""; $("#testimonialService").value = item.service; $("#testimonialText").value = item.text; $("#testimonialRating").value = String(item.rating); $("#testimonialOrder").value = item.order; $("#testimonialActive").checked = item.active && item.status === "approved"; $("#testimonialFormTitle").textContent = "Editar avaliação"; $("#testimonialForm").scrollIntoView({ behavior: "smooth", block: "start" }); }
    if (action === "approve") { item.active = true; item.status = "approved"; item.updatedAt = new Date().toISOString(); L.setTestimonials(items); if (item.phoneDigits) L.upsertClient({ name: item.name, phone: item.phone, phoneDigits: item.phoneDigits, photo: item.photo }); showToast("Avaliação aprovada e publicada."); }
    if (action === "reject") { item.active = false; item.status = "rejected"; item.updatedAt = new Date().toISOString(); L.setTestimonials(items); showToast("Avaliação rejeitada."); }
    if (action === "toggle") { item.active = !item.active; item.status = item.active ? "approved" : "pending"; item.updatedAt = new Date().toISOString(); L.setTestimonials(items); showToast(item.active ? "Avaliação publicada." : "Avaliação ocultada."); }
    if (action === "delete") { if (!window.confirm(`Excluir o depoimento de ${item.name}?`)) return; L.setTestimonials(items.filter(current => current.id !== item.id)); resetTestimonialForm(); showToast("Avaliação excluída."); }
  });

  const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  function buildWeekdayRows() {
    $("#weekdayRows").innerHTML = dayNames.map((name, day) => `<div class="schedule-row" data-weekday="${day}"><strong class="day-name">${name}</strong><label class="day-toggle"><input id="day-${day}-enabled" type="checkbox" /> Aberto</label><div class="period-fields"><input id="day-${day}-p1-start" type="time" /><span>até</span><input id="day-${day}-p1-end" type="time" /></div><div class="period-fields"><input id="day-${day}-p2-start" type="time" /><span>até</span><input id="day-${day}-p2-end" type="time" /></div></div>`).join("");
  }

  function loadAvailabilityForm() {
    const availability = L.getAvailability();
    for (let day = 0; day <= 6; day += 1) {
      const config = availability.weekdays[day];
      $(`#day-${day}-enabled`).checked = config.enabled;
      const [p1 = {}, p2 = {}] = config.periods;
      $(`#day-${day}-p1-start`).value = p1.start || ""; $(`#day-${day}-p1-end`).value = p1.end || ""; $(`#day-${day}-p2-start`).value = p2.start || ""; $(`#day-${day}-p2-end`).value = p2.end || "";
    }
    $("#slotInterval").value = String(availability.slotInterval); $("#bufferMinutes").value = availability.bufferMinutes; $("#advanceDays").value = availability.advanceDays; $("#minimumLeadMinutes").value = availability.minimumLeadMinutes; $("#cancellationDeadlineMinutes").value = availability.cancellationDeadlineMinutes;
  }

  $("#availabilityForm").addEventListener("submit", event => {
    event.preventDefault();
    const weekdays = {};
    for (let day = 0; day <= 6; day += 1) {
      const periods = [];
      for (let period = 1; period <= 2; period += 1) {
        const start = $(`#day-${day}-p${period}-start`).value; const end = $(`#day-${day}-p${period}-end`).value;
        if (start && end) {
          if (L.timeToMinutes(end) <= L.timeToMinutes(start)) return showToast(`Corrija o horário de ${dayNames[day]}.`, true);
          periods.push({ start, end });
        }
      }
      weekdays[day] = { enabled: $(`#day-${day}-enabled`).checked && periods.length > 0, periods };
    }
    L.setAvailability({ weekdays, slotInterval: Number($("#slotInterval").value), bufferMinutes: Number($("#bufferMinutes").value), advanceDays: Number($("#advanceDays").value), minimumLeadMinutes: Number($("#minimumLeadMinutes").value), cancellationDeadlineMinutes: Number($("#cancellationDeadlineMinutes").value) });
    showToast("Disponibilidade atualizada.");
  });

  function renderBlocks() {
    const blocks = L.getBlocks().sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
    $("#blockedCount").textContent = blocks.length;
    $("#blockedSlotsList").innerHTML = blocks.length ? blocks.map(block => `<div class="management-item" data-block-id="${L.escapeHTML(block.id)}"><div><h4>${L.escapeHTML(L.formatDate(block.date, { day: "2-digit", month: "short", year: "numeric" }))}</h4><p>${block.allDay ? "Dia inteiro" : `${block.startTime} às ${block.endTime}`} · ${L.escapeHTML(block.reason)}</p></div><div class="management-actions"><button class="icon-action danger" data-block-delete type="button">Remover</button></div></div>`).join("") : '<div class="empty-admin"><strong>Nenhum bloqueio</strong>Todos os períodos configurados estão disponíveis.</div>';
  }
  $("#blockDate").min = L.todayISO(); $("#blockDate").value = L.todayISO();
  $("#blockAllDay").addEventListener("change", event => $("#blockTimeFields").classList.toggle("hidden", event.target.checked));
  $("#blockForm").addEventListener("submit", event => {
    event.preventDefault();
    const allDay = $("#blockAllDay").checked; const startTime = $("#blockStart").value; const endTime = $("#blockEnd").value;
    if (!allDay && (!startTime || !endTime || L.timeToMinutes(endTime) <= L.timeToMinutes(startTime))) return showToast("Informe um período válido.", true);
    const blocks = L.getBlocks(); blocks.push({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, date: $("#blockDate").value, allDay, startTime: allDay ? "00:00" : startTime, endTime: allDay ? "23:59" : endTime, reason: $("#blockReason").value.trim() || "Horário bloqueado" }); L.setBlocks(blocks); $("#blockReason").value = ""; showToast("Bloqueio adicionado.");
  });
  $("#blockedSlotsList").addEventListener("click", event => {
    const item = event.target.closest("[data-block-id]"); if (!item || !event.target.closest("[data-block-delete]")) return;
    L.setBlocks(L.getBlocks().filter(block => block.id !== item.dataset.blockId)); showToast("Bloqueio removido.");
  });

  function startOfWeek(date) {
    const result = new Date(date); const day = result.getDay(); const diff = day === 0 ? -6 : 1 - day; result.setDate(result.getDate() + diff); result.setHours(12, 0, 0, 0); return result;
  }

  function openCalendarDay(iso) {
    calendarDate = L.parseISODate(iso);
    calendarDate.setHours(12, 0, 0, 0);
    calendarMode = "day";
    renderCalendar();
    $("#calendarView").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderCalendar() {
    const bookings = L.getBookings();
    const blocks = L.getBlocks();
    const view = $("#calendarView");
    $$('[data-calendar-view]').forEach(button => button.classList.toggle("active", button.dataset.calendarView === calendarMode));

    if (calendarMode === "day") {
      const iso = L.toLocalISO(calendarDate);
      $("#calendarPeriodLabel").textContent = L.formatDate(iso, { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
      const dayBookings = bookings.filter(item => item.date === iso).sort((a, b) => a.startTime.localeCompare(b.startTime));
      const dayBlocks = blocks.filter(item => item.date === iso).sort((a, b) => a.startTime.localeCompare(b.startTime));
      const activeBookings = dayBookings.filter(item => item.status !== "cancelled");
      const pendingCount = activeBookings.filter(item => item.status === "pending").length;
      const confirmedCount = activeBookings.filter(item => item.status === "confirmed").length;
      const entries = [
        ...dayBookings.map(item => ({ type: "booking", time: item.startTime, item })),
        ...dayBlocks.map(item => ({ type: "block", time: item.allDay ? "00:00" : item.startTime, item }))
      ].sort((a, b) => a.time.localeCompare(b.time));

      view.innerHTML = `
        <div class="calendar-day-overview">
          <div class="calendar-day-stat"><strong>${activeBookings.length}</strong><span>Agendamentos ativos</span></div>
          <div class="calendar-day-stat pending"><strong>${pendingCount}</strong><span>Aguardando confirmação</span></div>
          <div class="calendar-day-stat confirmed"><strong>${confirmedCount}</strong><span>Confirmados</span></div>
          <button class="button button-small" type="button" data-calendar-new-booking>+ Novo neste dia</button>
        </div>
        <div class="day-calendar">
          ${entries.length ? entries.map(entry => entry.type === "booking" ? `
            <article class="calendar-booking ${entry.item.status}">
              <div class="calendar-booking-time">${entry.item.startTime}<small>até ${entry.item.endTime}</small></div>
              <div class="calendar-booking-details">
                <strong>${L.escapeHTML(entry.item.name)}</strong>
                <small>${L.escapeHTML(entry.item.service)} · ${L.escapeHTML(entry.item.phone)}</small>
                <small>${L.escapeHTML(entry.item.professional || L.getSettings().professional)}</small>
              </div>
              ${statusBadge(entry.item.status)}
              <div class="calendar-booking-actions"><button type="button" data-booking-edit="${L.escapeHTML(entry.item.id)}">Ver detalhes / editar</button></div>
            </article>` : `
            <div class="calendar-block"><strong>${entry.item.allDay ? "Dia bloqueado" : `${entry.item.startTime}–${entry.item.endTime}`}</strong> · ${L.escapeHTML(entry.item.reason)}</div>`).join("") : `
            <div class="empty-admin calendar-empty-day"><strong>Agenda livre</strong>Nenhum agendamento ou bloqueio nesta data.<button class="button button-small" type="button" data-calendar-new-booking>Criar agendamento</button></div>`}
        </div>`;
    }

    if (calendarMode === "week") {
      const start = startOfWeek(calendarDate);
      const end = new Date(start); end.setDate(end.getDate() + 6);
      $("#calendarPeriodLabel").textContent = `${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${end.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;
      const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return date; });
      view.innerHTML = `<div class="week-calendar">${days.map(date => {
        const iso = L.toLocalISO(date);
        const list = bookings.filter(item => item.date === iso && item.status !== "cancelled").sort((a, b) => a.startTime.localeCompare(b.startTime));
        return `<div class="week-day ${iso === L.todayISO() ? "today" : ""}" data-calendar-date="${iso}" role="button" tabindex="0" aria-label="Abrir agenda de ${L.formatDate(iso)}">
          <div class="week-day-head"><span>${date.toLocaleDateString("pt-BR", { weekday: "short" })}</span><strong>${date.getDate()}</strong><small>${list.length} agendamento${list.length === 1 ? "" : "s"}</small></div>
          <div class="week-day-body">${list.map(item => `<div class="week-event ${item.status}"><strong>${item.startTime} · ${L.escapeHTML(item.name)}</strong><small>${L.escapeHTML(item.service)}</small></div>`).join("") || '<div class="month-more">Agenda livre</div>'}<span class="week-day-open">Abrir o dia →</span></div>
        </div>`;
      }).join("")}</div>`;
    }

    if (calendarMode === "month") {
      const first = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1, 12);
      const gridStart = startOfWeek(first);
      $("#calendarPeriodLabel").textContent = first.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      const days = Array.from({ length: 42 }, (_, index) => { const date = new Date(gridStart); date.setDate(gridStart.getDate() + index); return date; });
      const headings = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(day => `<div class="month-weekday">${day}</div>`).join("");
      view.innerHTML = `<div class="month-calendar">${headings}${days.map(date => {
        const iso = L.toLocalISO(date);
        const list = bookings.filter(item => item.date === iso && item.status !== "cancelled").sort((a, b) => a.startTime.localeCompare(b.startTime));
        return `<div class="month-day ${date.getMonth() !== first.getMonth() ? "outside" : ""} ${iso === L.todayISO() ? "today" : ""}" data-calendar-date="${iso}" role="button" tabindex="0" aria-label="Abrir agenda de ${L.formatDate(iso)}">
          <div class="month-day-number"><span>${date.getDate()}</span>${list.length ? `<small>${list.length}</small>` : ""}</div>
          ${list.slice(0, 3).map(item => `<div class="month-event ${item.status}">${item.startTime} ${L.escapeHTML(item.name)}</div>`).join("")}
          ${list.length > 3 ? `<div class="month-more">+${list.length - 3} outros</div>` : ""}
          ${!list.length ? '<div class="month-more">Livre</div>' : ""}
        </div>`;
      }).join("")}</div>`;
    }
  }

  $("#calendarPrev").addEventListener("click", () => { if (calendarMode === "day") calendarDate.setDate(calendarDate.getDate() - 1); if (calendarMode === "week") calendarDate.setDate(calendarDate.getDate() - 7); if (calendarMode === "month") calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(); });
  $("#calendarNext").addEventListener("click", () => { if (calendarMode === "day") calendarDate.setDate(calendarDate.getDate() + 1); if (calendarMode === "week") calendarDate.setDate(calendarDate.getDate() + 7); if (calendarMode === "month") calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(); });
  $("#calendarToday").addEventListener("click", () => { calendarDate = new Date(); calendarDate.setHours(12, 0, 0, 0); renderCalendar(); });
  $$('[data-calendar-view]').forEach(button => button.addEventListener("click", () => { calendarMode = button.dataset.calendarView; renderCalendar(); }));
  $("#calendarView").addEventListener("click", event => {
    const editButton = event.target.closest("[data-booking-edit]");
    if (editButton) return openBookingEditor(editButton.dataset.bookingEdit);
    if (event.target.closest("[data-calendar-new-booking]")) return openBookingEditor();
    const day = event.target.closest("[data-calendar-date]");
    if (day) openCalendarDay(day.dataset.calendarDate);
  });
  $("#calendarView").addEventListener("keydown", event => {
    if (!["Enter", " "].includes(event.key)) return;
    const day = event.target.closest("[data-calendar-date]");
    if (!day) return;
    event.preventDefault();
    openCalendarDay(day.dataset.calendarDate);
  });

  function fillBookingServiceOptions(selected = "") {
    const services = L.getServices(true).filter(service => service.active || service.id === selected);
    $("#editorService").innerHTML = services.map(service => `<option value="${L.escapeHTML(service.id)}">${L.escapeHTML(service.name)} · ${service.durationMinutes} min${service.price > 0 ? ` · ${L.formatCurrency(service.price)}` : ""}</option>`).join("");
    if (selected) $("#editorService").value = selected;
  }

  function updateEditorTimes() {
    const id = $("#editorBookingId").value; const service = L.getServiceById($("#editorService").value); const date = $("#editorDate").value; const current = id ? L.getBookings().find(item => item.id === id) : null;
    if (!service || !date) { $("#editorTime").innerHTML = '<option value="">Escolha serviço e data</option>'; return; }
    const slots = L.generateSlots(date, service.durationMinutes, { includeUnavailable: true, ignoreBookingId: id || null, allowPast: Boolean(current), professional: $("#editorProfessional").value.trim() || current?.professional || L.getSettings().professional });
    let options = slots.map(slot => `<option value="${slot.startTime}" ${slot.available ? "" : "disabled"}>${slot.startTime}–${slot.endTime}${slot.available ? "" : " · indisponível"}</option>`).join("");
    if (current && current.date === date && !slots.some(slot => slot.startTime === current.startTime)) options = `<option value="${current.startTime}">${current.startTime}–${current.endTime} · horário atual</option>${options}`;
    $("#editorTime").innerHTML = options || '<option value="">Sem horários disponíveis</option>';
    if (current && current.date === date) $("#editorTime").value = current.startTime;
    updateEditorSummary();
  }

  function updateEditorSummary() {
    const service = L.getServiceById($("#editorService").value); const time = $("#editorTime").value; const date = $("#editorDate").value;
    $("#editorSummary").textContent = service && time && date ? `${L.formatDate(date)} · ${time} às ${L.addMinutes(time, service.durationMinutes)} · ${service.name}${service.price > 0 ? ` · ${L.formatCurrency(service.price)}` : ""}` : "Escolha serviço, data e horário.";
  }

  function openBookingEditor(id = null) {
    const booking = id ? L.getBookings().find(item => String(item.id) === String(id)) : null;
    $("#bookingModalTitle").textContent = booking ? "Editar agendamento" : "Novo agendamento";
    $("#editorBookingId").value = booking?.id || ""; fillBookingServiceOptions(booking?.serviceId || "");
    $("#editorName").value = booking?.name || ""; $("#editorPhone").value = booking?.phone || ""; $("#editorStatus").value = booking?.status || "pending"; $("#editorDate").value = booking?.date || L.toLocalISO(calendarDate); $("#editorProfessional").value = booking?.professional || L.getSettings().professional; $("#editorNotes").value = booking?.notes || "";
    updateEditorTimes(); if (booking) $("#editorTime").value = booking.startTime; updateEditorSummary();
    bookingModal.classList.add("open"); bookingModal.setAttribute("aria-hidden", "false");
  }
  function closeBookingEditor() { bookingModal.classList.remove("open"); bookingModal.setAttribute("aria-hidden", "true"); }
  $$('[data-create-booking]').forEach(button => button.addEventListener("click", () => openBookingEditor()));
  $$('[data-close-booking-modal]').forEach(button => button.addEventListener("click", closeBookingEditor));
  [$("#editorService"), $("#editorDate"), $("#editorProfessional")].forEach(element => element.addEventListener("change", updateEditorTimes));
  $("#editorTime").addEventListener("change", updateEditorSummary);
  $("#editorPhone").addEventListener("input", event => { event.target.value = L.formatPhone(event.target.value); });

  $("#bookingEditorForm").addEventListener("submit", event => {
    event.preventDefault();
    const id = $("#editorBookingId").value; const existing = id ? L.getBookings().find(item => item.id === id) : null;
    const service = L.getServiceById($("#editorService").value); const date = $("#editorDate").value; const time = $("#editorTime").value; const status = $("#editorStatus").value;
    if (!service || !date || !time || $("#editorName").value.trim().length < 2 || L.normalizePhone($("#editorPhone").value).length < 10) return showToast("Preencha os dados do agendamento corretamente.", true);
    const professional = $("#editorProfessional").value.trim() || L.getSettings().professional;
    const inactiveStatus = ["cancelled", "completed", "no_show"].includes(status);
    const statusesToCheck = status === "confirmed" ? ["confirmed"] : ["pending", "confirmed"];
    if (!inactiveStatus && !L.isSlotAvailable({ date, startTime: time, durationMinutes: service.durationMinutes, professional, ignoreBookingId: id || null, allowPast: false, bookingStatuses: statusesToCheck })) return showToast("Este horário entra em conflito com outro agendamento confirmado ou com um bloqueio.", true);

    const pendingConflicts = status === "confirmed" ? L.findBookingConflicts({ date, startTime: time, durationMinutes: service.durationMinutes, professional, ignoreBookingId: id || null, statuses: ["pending"] }) : [];
    if (pendingConflicts.length) {
      const names = pendingConflicts.map(item => `${item.name} (${item.code})`).join(", ");
      if (!window.confirm(`Há ${pendingConflicts.length} solicitação pendente concorrente: ${names}.

Salvar este agendamento como confirmado e cancelar as concorrentes?`)) return;
    }

    const saved = L.upsertBooking({ ...existing, id: id || `${Date.now()}-${Math.random().toString(16).slice(2)}`, code: existing?.code || L.makeCode(), serviceId: service.id, service: service.name, durationMinutes: service.durationMinutes, priceValue: service.price, date, dateLabel: L.formatDate(date), startTime: time, time, endTime: L.addMinutes(time, service.durationMinutes), name: $("#editorName").value.trim(), phone: L.formatPhone($("#editorPhone").value), professional, notes: $("#editorNotes").value.trim(), status, source: existing?.source || "admin", createdAt: existing?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
    if (status === "confirmed" && pendingConflicts.length) {
      const result = L.confirmBooking(saved.id, { cancelPendingConflicts: true });
      if (!result.ok) return showToast("O agendamento foi salvo, mas a confirmação encontrou um conflito. Revise a agenda.", true);
    }
    closeBookingEditor(); showToast(existing ? "Agendamento atualizado." : `Agendamento criado. Código ${saved.code}`);
  });

  function setReportDefaults() {
    const [start, end] = currentMonthRange(); if (!$("#reportStart").value) $("#reportStart").value = start; if (!$("#reportEnd").value) $("#reportEnd").value = end;
  }
  function reportBookings() { const start = $("#reportStart").value; const end = $("#reportEnd").value; return L.getBookings().filter(item => (!start || item.date >= start) && (!end || item.date <= end)); }
  function renderBarReport(element, data, formatter = value => value) {
    const entries = Object.entries(data).sort((a, b) => b[1] - a[1]); const max = Math.max(1, ...entries.map(entry => entry[1]));
    element.innerHTML = entries.length ? entries.map(([label, value]) => `<div class="bar-item"><span title="${L.escapeHTML(label)}">${L.escapeHTML(label)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, value / max * 100)}%"></div></div><strong>${formatter(value)}</strong></div>`).join("") : '<div class="empty-admin"><strong>Sem dados</strong>Nenhum registro no período.</div>';
  }
  function renderReports() {
    setReportDefaults(); const bookings = reportBookings(); const completed = bookings.filter(item => item.status === "completed"); const revenue = completed.reduce((sum, item) => sum + item.priceValue, 0); const cancelled = bookings.filter(item => ["cancelled", "no_show"].includes(item.status)).length;
    $("#reportCompleted").textContent = completed.length; $("#reportRevenue").textContent = L.formatCurrency(revenue); $("#reportTicket").textContent = L.formatCurrency(completed.length ? revenue / completed.length : 0); $("#reportCancelled").textContent = cancelled;
    const serviceData = {}; completed.forEach(item => serviceData[item.service] = (serviceData[item.service] || 0) + 1);
    const timeData = {}; bookings.filter(item => item.status !== "cancelled").forEach(item => timeData[item.startTime] = (timeData[item.startTime] || 0) + 1);
    const weekdayData = {}; bookings.filter(item => item.status !== "cancelled").forEach(item => { const label = dayNames[L.parseISODate(item.date).getDay()]; weekdayData[label] = (weekdayData[label] || 0) + 1; });
    const statusData = {}; bookings.forEach(item => { const label = L.statusLabel(item.status); statusData[label] = (statusData[label] || 0) + 1; });
    renderBarReport($("#servicesReport"), serviceData); renderBarReport($("#timesReport"), timeData); renderBarReport($("#weekdaysReport"), weekdayData); renderBarReport($("#statusReport"), statusData);
  }
  $("#applyReport").addEventListener("click", renderReports);
  $("#exportReport").addEventListener("click", () => L.exportBookingsCSV(reportBookings()));

  function parseBarbers(value, primary) {
    const names = String(value || "").split(/\r?\n|,/).map(item => item.trim()).filter(Boolean);
    return [...new Set([primary, ...names].map(item => String(item || "").trim()).filter(Boolean))];
  }

  function refreshBarberOptions() {
    const datalist = $("#barberOptions");
    if (!datalist) return;
    datalist.innerHTML = L.getSettings().barbers.map(name => `<option value="${L.escapeHTML(name)}"></option>`).join("");
  }

  function loadSettingsForms() {
    const settings = L.getSettings();
    $("#settingProfessional").value = settings.professional; if ($("#settingBarbers")) $("#settingBarbers").value = settings.barbers.join("\n"); refreshBarberOptions(); $("#settingWhatsappNumber").value = settings.whatsappNumber; $("#settingDisplayPhone").value = settings.displayPhone; $("#settingInstagram").value = settings.instagram; $("#settingInstagramUrl").value = settings.instagramUrl; $("#settingCity").value = settings.city; $("#settingAddress").value = settings.address; $("#settingBusinessDays").value = settings.businessDays; $("#settingBusinessHours").value = settings.businessHours; $("#settingBookingMessage").value = settings.bookingMessage; $("#settingCancellationPolicy").value = settings.cancellationPolicy; $("#settingGoogleMapsUrl").value = settings.googleMapsUrl || ""; $("#settingAboutTitle").value = settings.aboutTitle || ""; $("#settingAboutText").value = settings.aboutText || ""; $("#settingProfessionalBio").value = settings.professionalBio || ""; $("#settingPortfolioTitle").value = settings.portfolioTitle || ""; $("#settingPortfolioText").value = settings.portfolioText || ""; $("#settingTestimonialsTitle").value = settings.testimonialsTitle || ""; $("#settingTestimonialsText").value = settings.testimonialsText || ""; $("#settingProfessionalPhoto").value = settings.professionalPhoto || "assets/gilliel-apresentacao.webp"; $("#settingProfessionalPhotoPreview").src = settings.professionalPhoto || "assets/gilliel-apresentacao.webp"; $("#settingDepositEnabled").checked = Boolean(settings.depositEnabled); $("#settingDepositAmount").value = Number(settings.depositAmount) || 0; $("#settingPixKey").value = settings.pixKey || ""; $("#settingDepositMessage").value = settings.depositMessage || ""; $("#settingLoyaltyEnabled").checked = Boolean(settings.loyaltyEnabled); $("#settingLoyaltyGoal").value = Number(settings.loyaltyGoal) || 10; $("#settingLoyaltyReward").value = settings.loyaltyReward || ""; $("#settingShowPrices").checked = settings.showPrices;
    const credentials = getCredentials(); $("#credentialName").value = credentials?.name || ""; $("#credentialEmail").value = credentials?.email || ""; $("#credentialPassword").value = ""; $("#credentialPasswordConfirm").value = "";
  }
  $("#settingProfessionalPhotoFile").addEventListener("change", async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try { const data = await optimizeImage(file, 1100, .82); $("#settingProfessionalPhoto").value = data; $("#settingProfessionalPhotoPreview").src = data; showToast("Foto pronta. Salve as informações para publicar."); }
    catch (error) { showToast(error.message, true); event.target.value = ""; }
  });
  $("#removeProfessionalPhoto").addEventListener("click", () => { $("#settingProfessionalPhoto").value = "assets/logo.png"; $("#settingProfessionalPhotoPreview").src = "assets/logo.png"; $("#settingProfessionalPhotoFile").value = ""; });
  $("#businessSettingsForm").addEventListener("submit", event => {
    event.preventDefault(); const primaryProfessional = $("#settingProfessional").value.trim(); L.setSettings({ professional: primaryProfessional, barbers: parseBarbers($("#settingBarbers")?.value, primaryProfessional), whatsappNumber: $("#settingWhatsappNumber").value.replace(/\D/g, ""), displayPhone: $("#settingDisplayPhone").value.trim(), instagram: $("#settingInstagram").value.trim(), instagramUrl: $("#settingInstagramUrl").value.trim(), city: $("#settingCity").value.trim(), address: $("#settingAddress").value.trim(), businessDays: $("#settingBusinessDays").value.trim(), businessHours: $("#settingBusinessHours").value.trim(), bookingMessage: $("#settingBookingMessage").value.trim(), cancellationPolicy: $("#settingCancellationPolicy").value.trim(), googleMapsUrl: $("#settingGoogleMapsUrl").value.trim(), aboutTitle: $("#settingAboutTitle").value.trim(), aboutText: $("#settingAboutText").value.trim(), professionalBio: $("#settingProfessionalBio").value.trim(), portfolioTitle: $("#settingPortfolioTitle").value.trim(), portfolioText: $("#settingPortfolioText").value.trim(), testimonialsTitle: $("#settingTestimonialsTitle").value.trim(), testimonialsText: $("#settingTestimonialsText").value.trim(), professionalPhoto: $("#settingProfessionalPhoto").value || "assets/gilliel-apresentacao.webp", depositEnabled: $("#settingDepositEnabled").checked, depositAmount: Number($("#settingDepositAmount").value) || 0, pixKey: $("#settingPixKey").value.trim(), depositMessage: $("#settingDepositMessage").value.trim(), loyaltyEnabled: $("#settingLoyaltyEnabled").checked, loyaltyGoal: Math.max(1, Number($("#settingLoyaltyGoal").value) || 10), loyaltyReward: $("#settingLoyaltyReward").value.trim(), showPrices: $("#settingShowPrices").checked }); showToast("Informações públicas atualizadas.");
  });
  $("#credentialsForm").addEventListener("submit", async event => {
    event.preventDefault(); const current = getCredentials(); const name = $("#credentialName").value.trim(); const email = $("#credentialEmail").value.trim().toLowerCase(); const password = $("#credentialPassword").value; const confirmation = $("#credentialPasswordConfirm").value;
    if (name.length < 2 || !email.includes("@")) return showToast("Informe nome e e-mail válidos.", true); if (password && password.length < 6) return showToast("A nova senha precisa ter 6 caracteres.", true); if (password !== confirmation) return showToast("As novas senhas não coincidem.", true);
    L.save(L.KEYS.credentials, { ...current, name, email, passwordHash: password ? await hashPassword(password) : current.passwordHash, updatedAt: new Date().toISOString() }); $("#adminNameLabel").textContent = name; loadSettingsForms(); showToast("Acesso atualizado.");
  });
  $("#exportBackup").addEventListener("click", () => L.downloadFile(`backup-legado-${L.todayISO()}.json`, JSON.stringify(L.getBackup(), null, 2), "application/json;charset=utf-8"));
  $("#importBackup").addEventListener("change", async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try { const data = JSON.parse(await file.text()); if (!window.confirm("Restaurar este backup substituirá os dados atuais. Continuar?")) return; L.restoreBackup(data); showToast("Backup restaurado com sucesso."); refreshAll(); }
    catch (error) { showToast(error.message || "Não foi possível restaurar o arquivo.", true); }
    finally { event.target.value = ""; }
  });
  $("#resetDemoData").addEventListener("click", () => {
    if (!window.confirm("Isso apagará agendamentos, serviços, horários, configurações e o login deste navegador. Deseja continuar?")) return;
    Object.values(L.KEYS).forEach(key => { localStorage.removeItem(key); sessionStorage.removeItem(key); }); localStorage.removeItem("legadoAdminTutorialSeen"); location.reload();
  });

  function refreshAll() {
    refreshBarberOptions();
    renderOverview(); renderBookings(); renderClients(); renderServices(); renderPortfolioAdmin(); renderTestimonialsAdmin(); loadAvailabilityForm(); renderBlocks(); renderCalendar(); renderReports(); loadSettingsForms(); renderAdminTutorial(); updateStorageMeter();
  }
  window.addEventListener("storage", refreshAll);
  window.addEventListener("legado:datachange", refreshAll);

  buildWeekdayRows(); resetPortfolioForm(); resetTestimonialForm(); configureAuthView();
  if (getCredentials() && sessionStorage.getItem(L.KEYS.session) === "active") showAdmin();
})();
