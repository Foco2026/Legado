(() => {
  "use strict";

  const L = window.Legado;
  const state = {
    step: 1,
    serviceId: "",
    service: null,
    date: "",
    dateLabel: "",
    time: "",
    rebookingId: null
  };

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const elements = {
    form: $("#bookingForm"), next: $("#nextButton"), prev: $("#prevButton"), summary: $("#summaryMini"),
    serviceChoices: $("#serviceChoices"), publicServices: $("#publicServicesGrid"), dates: $("#dateChoices"),
    customDate: $("#customDate"), times: $("#timeChoices"), professional: $("#professional"),
    modal: $("#confirmationModal"), confirmationSummary: $("#confirmationSummary"), confirmationCode: $("#confirmationCode"),
    toast: $("#toast"), lookupForm: $("#lookupForm"), lookupResult: $("#lookupResult")
  };

  let settings = L.getSettings();
  let services = L.getServices();
  let availability = L.getAvailability();
  let portfolioCategory = "Todos";
  let activePortfolioItem = null;
  let activePortfolioImages = [];
  let activePortfolioImageIndex = 0;
  let lastBooking = null;
  let toastTimer = null;
  let statusInterval = null;
  let testimonialsTimer = null;

  function showToast(message, error = false) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.toggle("error", error);
    elements.toast.classList.add("show");
    toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2800);
  }

  async function optimizeImage(file, maxDimension = 900, quality = 0.78) {
    if (!file || !file.type.startsWith("image/")) throw new Error("Escolha uma imagem válida.");
    if (file.size > 12 * 1024 * 1024) throw new Error("A imagem é muito grande. Escolha um arquivo com até 12 MB.");
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("Não foi possível ler a imagem."));
        image.src = objectUrl;
      });
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: false });
      context.fillStyle = "#071728";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      return canvas.toDataURL("image/webp", quality);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  function configuredStatus(now = new Date()) {
    availability = L.getAvailability();
    const blocks = L.getBlocks();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const todayIso = L.toLocalISO(now);
    const todayConfig = availability.weekdays?.[now.getDay()];
    const allDayBlocked = blocks.some(block => block.date === todayIso && block.allDay);
    const periods = !allDayBlocked && todayConfig?.enabled ? (todayConfig.periods || []) : [];
    const activePeriod = periods.find(period => currentMinutes >= L.timeToMinutes(period.start) && currentMinutes < L.timeToMinutes(period.end));
    if (activePeriod) return { open: true, text: `Aberto agora · até ${activePeriod.end}` };

    for (let offset = 0; offset <= 8; offset += 1) {
      const date = new Date(now);
      date.setHours(12, 0, 0, 0);
      date.setDate(now.getDate() + offset);
      const iso = L.toLocalISO(date);
      const config = availability.weekdays?.[date.getDay()];
      if (!config?.enabled || !config.periods?.length || blocks.some(block => block.date === iso && block.allDay)) continue;
      const candidate = config.periods.find(period => offset > 0 || L.timeToMinutes(period.start) > currentMinutes);
      if (!candidate) continue;
      const dayLabel = offset === 0 ? "hoje" : offset === 1 ? "amanhã" : date.toLocaleDateString("pt-BR", { weekday: "long" });
      return { open: false, text: `Fechado · abre ${dayLabel} ${candidate.start}` };
    }
    return { open: false, text: "Fechado no momento" };
  }

  function renderBusinessStatus() {
    const info = configuredStatus();
    [$("#headerBusinessStatus"), $("#visitLiveStatus")].filter(Boolean).forEach(element => {
      element.textContent = info.text;
      element.classList.remove("status-loading", "status-open", "status-closed");
      element.classList.add(info.open ? "status-open" : "status-closed");
    });
  }

  function closePortfolioLightbox() {
    const modal = $("#portfolioLightbox");
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    activePortfolioItem = null;
    activePortfolioImages = [];
    activePortfolioImageIndex = 0;
  }

  function showPortfolioImage(index) {
    if (!activePortfolioImages.length) return;
    activePortfolioImageIndex = Math.max(0, Math.min(activePortfolioImages.length - 1, Number(index) || 0));
    const image = activePortfolioImages[activePortfolioImageIndex];
    $("#lightboxImage").src = image;
    $("#lightboxImage").alt = `${activePortfolioItem?.alt || activePortfolioItem?.title || "Trabalho Legado"} — foto ${activePortfolioImageIndex + 1}`;
    $$(".lightbox-thumb").forEach((thumb, thumbIndex) => thumb.classList.toggle("active", thumbIndex === activePortfolioImageIndex));
    $("#lightboxCounter").textContent = `Foto ${activePortfolioImageIndex + 1} de ${activePortfolioImages.length}`;
    $("#lightboxPrev").disabled = activePortfolioImages.length <= 1;
    $("#lightboxNext").disabled = activePortfolioImages.length <= 1;
  }

  function matchingServiceForPortfolio(item) {
    const target = `${item?.category || ""} ${item?.title || ""}`.toLowerCase();
    const priorities = target.includes("barba") ? ["barba"] : target.includes("acabamento") || target.includes("finaliza") ? ["acabamento", "finaliza"] : ["corte"];
    return services.find(service => priorities.some(term => service.name.toLowerCase().includes(term))) || services[0] || null;
  }

  function renderAbout() {
    settings = L.getSettings();
    const photo = $("#professionalPhoto");
    if (photo) { photo.src = settings.professionalPhoto || "assets/gilliel-apresentacao.webp"; photo.alt = `${settings.professional}, profissional da ${settings.businessName}`; }
    const oldTitle = "TradiÃ§Ã£o, tÃ©cnica e personalidade em cada detalhe.";
    const oldText = "A Legado Barbearia nasceu para oferecer uma experiÃªncia completa: atendimento com hora marcada, ambiente sofisticado e cuidado pensado para valorizar o estilo de cada cliente.";
    $("#aboutEyebrow").textContent = settings.aboutEyebrow === "CONHEÃ‡A A LEGADO" ? "NOSSA HISTÃ“RIA" : settings.aboutEyebrow;
    $("#aboutTitle").textContent = settings.aboutTitle === oldTitle ? "Uma barbearia criada para deixar legado." : settings.aboutTitle;
    $("#aboutText").textContent = settings.aboutText === oldText ? "A Legado nasceu em Mineiros com uma ideia simples: transformar o cuidado masculino em um momento de respeito, presenÃ§a e identidade. Cada corte, barba e acabamento carrega atenÃ§Ã£o aos detalhes, conversa boa e o compromisso de fazer o cliente sair se reconhecendo melhor no espelho." : settings.aboutText;
    $("#professionalName").textContent = settings.professional;
    $("#professionalBio").textContent = settings.professionalBio;
    $("#mapButton").href = settings.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${settings.address}, ${settings.city}`)}`;
    $("#faqAddress").textContent = `${settings.address}, ${settings.city}.`;
  }

  function renderBarbers() {
    const grid = $("#barbersGrid");
    if (!grid) return;
    const names = Array.isArray(settings.barbers) && settings.barbers.length ? settings.barbers : [settings.professional];
    const primary = settings.professional || names[0] || "Barbeiro Legado";
    grid.innerHTML = names.map((name, index) => {
      const isPrimary = String(name).trim().toLowerCase() === String(primary).trim().toLowerCase() || index === 0;
      const photo = isPrimary ? (settings.professionalPhoto || "assets/gilliel-apresentacao.webp") : "assets/logo-192.png";
      const initials = String(name || "LG").split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
      return `
        <article class="barber-card reveal">
          <div class="barber-photo">
            <img src="${L.escapeHTML(photo)}" alt="${L.escapeHTML(name)}" loading="lazy" />
            <span>${L.escapeHTML(initials || "LG")}</span>
          </div>
          <div>
            <small>${isPrimary ? "RESPONSÁVEL PELA CASA" : "BARBEIRO LEGADO"}</small>
            <h3>${L.escapeHTML(name)}</h3>
            <p>${isPrimary ? L.escapeHTML(settings.professionalBio || "Atendimento cuidadoso, técnica e acabamento alinhado ao padrão Legado.") : "Atendimento com hora marcada, cuidado no acabamento e respeito ao estilo de cada cliente."}</p>
          </div>
        </article>`;
    }).join("");
    observeReveals();
  }

  function portfolioCategories(items) {
    return ["Todos", ...new Set(items.map(item => item.category).filter(Boolean))];
  }

  function renderPortfolio() {
    const items = L.getPortfolio();
    const section = $("#portfolio");
    const filters = $("#portfolioFilters");
    const grid = $("#portfolioGrid");
    if (section) section.classList.toggle("hidden", !items.length);
    if (!items.length) {
      filters.innerHTML = "";
      grid.innerHTML = "";
      return;
    }
    $("#portfolioEyebrow").textContent = settings.portfolioEyebrow;
    $("#portfolioTitle").textContent = settings.portfolioTitle;
    $("#portfolioText").textContent = settings.portfolioText;
    const categories = portfolioCategories(items);
    if (!categories.includes(portfolioCategory)) portfolioCategory = "Todos";
    filters.innerHTML = items.length ? categories.map(category => `<button class="portfolio-filter ${category === portfolioCategory ? "active" : ""}" type="button" data-portfolio-filter="${L.escapeHTML(category)}">${L.escapeHTML(category)}</button>`).join("") : "";
    filters.classList.toggle("hidden", !items.length);
    const visible = portfolioCategory === "Todos" ? items : items.filter(item => item.category === portfolioCategory);
    grid.innerHTML = visible.map(item => {
      const galleryCount = Array.isArray(item.images) ? item.images.length : 1;
      return `
      <article class="portfolio-card reveal ${item.featured ? "featured" : ""}" data-portfolio-id="${L.escapeHTML(item.id)}" tabindex="0" role="button" aria-label="Abrir ${L.escapeHTML(item.title)}">
        <img src="${L.escapeHTML(item.image)}" alt="${L.escapeHTML(item.alt)}" loading="lazy" />
        ${galleryCount > 1 ? `<span class="portfolio-gallery-badge">${galleryCount} fotos</span>` : ""}
        <span class="portfolio-open" aria-hidden="true">↗</span>
        <div class="portfolio-card-content"><span>${L.escapeHTML(item.category)}</span><h3>${L.escapeHTML(item.title)}</h3><p>${L.escapeHTML(item.summary || item.description)}</p></div>
      </article>`;
    }).join("");
    observeReveals();
  }

  function openPortfolioItem(id) {
    const item = L.getPortfolio().find(entry => String(entry.id) === String(id));
    if (!item) return;
    activePortfolioItem = item;
    activePortfolioImages = Array.isArray(item.images) && item.images.length ? item.images : [item.image];
    activePortfolioImageIndex = 0;
    $("#lightboxCategory").textContent = item.category;
    $("#lightboxTitle").textContent = item.title;
    $("#lightboxDescription").textContent = item.description;
    const thumbs = $("#lightboxThumbnails");
    thumbs.innerHTML = activePortfolioImages.map((image, index) => `<button class="lightbox-thumb ${index === 0 ? "active" : ""}" type="button" data-lightbox-index="${index}" aria-label="Ver foto ${index + 1}"><img src="${L.escapeHTML(image)}" alt="" /></button>`).join("");
    showPortfolioImage(0);
    const modal = $("#portfolioLightbox");
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
  }

  function renderTestimonials() {
    const items = L.getTestimonials();
    const section = $("#avaliacoes");
    if (section) section.classList.remove("hidden");
    $("#testimonialsEyebrow").textContent = settings.testimonialsEyebrow || "AVALIAÇÕES";
    $("#testimonialsTitle").textContent = settings.testimonialsTitle || "Quem vive a experiência, recomenda.";
    $("#testimonialsText").textContent = settings.testimonialsText || "Depoimentos reais dos clientes da Legado.";
    if (!items.length) {
      clearInterval(testimonialsTimer);
      $("#testimonialsGrid").innerHTML = `
        <article class="testimonial-card testimonial-invite reveal">
          <div class="testimonial-stars" aria-label="Experiência Legado">★★★★★</div>
          <blockquote>Atendimento com hora marcada, cuidado no acabamento e uma experiência pensada para você sair pronto para o próximo compromisso.</blockquote>
          <div class="testimonial-author"><strong>Legado Barbearia</strong><span>Seu feedback também pode aparecer aqui</span></div>
        </article>`;
      observeReveals();
      return;
    }
    $("#testimonialsGrid").innerHTML = items.map(item => `
      <article class="testimonial-card reveal">
        <div class="testimonial-stars" aria-label="${item.rating} de 5 estrelas">${"★".repeat(item.rating)}${"☆".repeat(5-item.rating)}</div>
        <blockquote>${L.escapeHTML(item.text)}</blockquote>
        <div class="testimonial-author">
          ${item.photo ? `<img class="testimonial-avatar" src="${L.escapeHTML(item.photo)}" alt="${L.escapeHTML(item.name)}" loading="lazy" />` : ""}
          <div><strong>${L.escapeHTML(item.name)}</strong><span>${L.escapeHTML(item.service)}${item.createdAt ? ` · ${L.escapeHTML(L.formatDate(item.createdAt.slice(0, 10), { month: "short", year: "numeric" }))}` : ""}</span></div>
        </div>
      </article>`).join("");
    startTestimonialsCarousel();
    observeReveals();
  }
  function startTestimonialsCarousel() {
    const grid = $("#testimonialsGrid");
    clearInterval(testimonialsTimer);
    if (!grid || grid.children.length < 2) return;
    let index = 0;
    testimonialsTimer = setInterval(() => {
      index = (index + 1) % grid.children.length;
      grid.scrollTo({ left: grid.clientWidth * index, behavior: "smooth" });
    }, 4800);
  }

  function serviceMeta(service) {
    const pieces = [`${service.durationMinutes} min`];
    if (settings.showPrices && service.price > 0) pieces.push(L.formatCurrency(service.price));
    return pieces.join(" · ");
  }

  function buildPublicServices() {
    services = L.getServices();
    if (!services.length) {
      elements.publicServices.innerHTML = '<div class="availability-note">Os serviços estão sendo atualizados. Fale conosco pelo WhatsApp.</div>';
      return;
    }
    elements.publicServices.innerHTML = services.map(service => `
      <article class="service-card reveal" data-service-card="${L.escapeHTML(service.id)}" tabindex="0" role="button" aria-label="Agendar ${L.escapeHTML(service.name)}">
        <img src="${L.escapeHTML(L.resolveMediaSource(service.icon))}" alt="Ícone do serviço ${L.escapeHTML(service.name)}" loading="lazy" />
        <div><h3>${L.escapeHTML(service.name)}</h3><p>${L.escapeHTML(service.description)}</p></div>
        <span>${service.durationMinutes} minutos${settings.showPrices && service.price > 0 ? ` · <b class="price-tag">${L.escapeHTML(L.formatCurrency(service.price))}</b>` : ""}</span>
        <strong class="service-select-cta">Selecionar</strong>
      </article>`).join("");
    observeReveals();
  }
  function buildServiceChoices() {
    elements.serviceChoices.innerHTML = services.map(service => `
      <button type="button" class="choice ${state.serviceId === service.id ? "selected" : ""}" data-service="${L.escapeHTML(service.id)}">
        <strong>${L.escapeHTML(service.name)}</strong><small>${L.escapeHTML(serviceMeta(service))}</small>
      </button>`).join("");
  }

  function selectService(id) {
    const service = services.find(item => String(item.id) === String(id));
    if (!service) return;
    state.serviceId = service.id;
    state.service = service;
    state.time = "";
    buildServiceChoices();
    buildTimes();
    updateSummary();
  }

  function maxBookingDate() {
    const date = new Date();
    date.setDate(date.getDate() + availability.advanceDays);
    return L.toLocalISO(date);
  }

  function hasAllDayBlock(date) {
    return L.getBlocks().some(block => block.date === date && block.allDay);
  }

  function dateIsOpen(date) {
    const parsed = L.parseISODate(date);
    const config = availability.weekdays[parsed.getDay()];
    return Boolean(config?.enabled && config.periods?.length && !hasAllDayBlock(date));
  }

  function buildDates() {
    availability = L.getAvailability();
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    monthEnd.setHours(12, 0, 0, 0);
    const maxDate = L.parseISODate(maxBookingDate());
    maxDate.setHours(12, 0, 0, 0);
    const finalDate = monthEnd < maxDate ? monthEnd : maxDate;
    const daysToShow = Math.max(1, Math.floor((finalDate - today) / 86400000) + 1);
    const dates = Array.from({ length: daysToShow }, (_, index) => {
      const date = new Date(today);
      date.setHours(12, 0, 0, 0);
      date.setDate(today.getDate() + index);
      return date;
    });

    elements.dates.innerHTML = dates.map(date => {
      const iso = L.toLocalISO(date);
      const disabled = !dateIsOpen(iso);
      const week = date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
      const month = date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
      return `<button type="button" class="date-button ${disabled ? "disabled" : ""} ${state.date === iso ? "selected" : ""}" data-date="${iso}" ${disabled ? "disabled" : ""}>
        <span>${week}</span><strong>${String(date.getDate()).padStart(2, "0")}</strong><small>${month}</small>
      </button>`;
    }).join("");

    elements.customDate.min = L.todayISO();
    elements.customDate.max = maxBookingDate();
    elements.customDate.value = state.date;
  }
  function selectDate(date) {
    if (!date || date < L.todayISO() || date > maxBookingDate()) {
      showToast("Escolha uma data dentro do período permitido.", true);
      return false;
    }
    if (!dateIsOpen(date)) {
      showToast("A barbearia não atende nesta data.", true);
      return false;
    }
    state.date = date;
    state.dateLabel = L.formatDate(date);
    state.time = "";
    buildDates();
    buildTimes();
    updateSummary();
    return true;
  }

  function buildTimes() {
    if (!state.date || !state.service) {
      elements.times.innerHTML = '<p class="availability-note">Escolha o serviço e a data para ver os horários.</p>';
      return;
    }
    const professional = elements.professional.value || settings.professional;
    const slots = L.generateSlots(state.date, state.service.durationMinutes, { professional }).filter(slot => slot.available !== false);
    if (!slots.length) {
      elements.times.innerHTML = '<p class="availability-note">Não há horários disponíveis para este serviço nesta data. Tente outro dia.</p>';
      return;
    }
    const groups = [
      { label: "Manhã", items: slots.filter(slot => L.timeToMinutes(slot.startTime) < 720) },
      { label: "Tarde", items: slots.filter(slot => L.timeToMinutes(slot.startTime) >= 720 && L.timeToMinutes(slot.startTime) < 1080) },
      { label: "Noite", items: slots.filter(slot => L.timeToMinutes(slot.startTime) >= 1080) }
    ].filter(group => group.items.length);
    elements.times.innerHTML = `
      <div class="time-context">
        <strong>${L.escapeHTML(state.service.name)}</strong>
        <span>${state.service.durationMinutes} min · ${L.escapeHTML(professional)}</span>
      </div>
      ${groups.map(group => `
        <section class="time-period">
          <h4>${group.label}</h4>
          <div class="time-period-grid">
            ${group.items.map(slot => `
              <button type="button" class="time-button ${state.time === slot.startTime ? "selected" : ""}" data-time="${slot.startTime}">
                ${slot.startTime}<small>até ${slot.endTime}</small>
              </button>`).join("")}
          </div>
        </section>`).join("")}`;
  }
  function selectTime(time) {
    if (!state.service || !state.date) return;
    if (!L.isSlotAvailable({ date: state.date, startTime: time, durationMinutes: state.service.durationMinutes, professional: elements.professional.value || settings.professional })) {
      buildTimes();
      showToast("Esse horário não está mais disponível.", true);
      return;
    }
    state.time = time;
    buildTimes();
    updateSummary();
    setTimeout(() => goToStep(4), 160);
  }

  function updateSummary() {
    const parts = [];
    if (state.service) parts.push(`${state.service.name} · ${serviceMeta(state.service)}`);
    if (state.dateLabel) parts.push(state.dateLabel);
    if (elements.professional.value) parts.push(elements.professional.value);
    if (state.time) parts.push(`${state.time}–${L.addMinutes(state.time, state.service.durationMinutes)}`);
    elements.summary.textContent = parts.length ? parts.join(" · ") : "Selecione um serviço para começar.";
    renderBookingReview();
  }

  function renderBookingReview() {
    const review = $("#bookingReview");
    if (!review) return;
    if (!state.service || !state.date || !state.time) {
      review.innerHTML = '<strong>Resumo do horário</strong><p>Escolha serviço, data e horário para revisar antes de confirmar.</p>';
      return;
    }
    const professional = elements.professional.value || settings.professional;
    const endTime = L.addMinutes(state.time, state.service.durationMinutes);
    review.innerHTML = `
      <div class="booking-review-head">
        <span>HORÁRIO ESCOLHIDO</span>
        <strong>${L.escapeHTML(state.time)} às ${L.escapeHTML(endTime)}</strong>
      </div>
      <div class="booking-review-grid">
        <div><small>Serviço</small><b>${L.escapeHTML(state.service.name)}</b></div>
        <div><small>Data</small><b>${L.escapeHTML(L.formatDate(state.date, { day: "2-digit", month: "short" }))}</b></div>
        <div><small>Barbeiro</small><b>${L.escapeHTML(professional)}</b></div>
        <div><small>Duração</small><b>${state.service.durationMinutes} min</b></div>
      </div>`;
  }
  function showInlineMessage(message) {
    const previous = elements.summary.textContent;
    elements.summary.textContent = message;
    elements.summary.style.color = "#efd77e";
    setTimeout(() => {
      elements.summary.style.color = "";
      if (elements.summary.textContent === message) elements.summary.textContent = previous;
      updateSummary();
    }, 1900);
    return false;
  }

  function validateStep() {
    if (state.step === 1 && !state.service) return showInlineMessage("Selecione um serviço.");
    if (state.step === 2 && !state.date) return showInlineMessage("Escolha uma data.");
    if (state.step === 3 && !state.time) return showInlineMessage("Selecione um horário disponível.");
    if (state.step === 3 && !L.isSlotAvailable({ date: state.date, startTime: state.time, durationMinutes: state.service.durationMinutes, professional: elements.professional.value || settings.professional })) {
      state.time = "";
      buildTimes();
      return showInlineMessage("Esse horário ficou indisponível. Escolha outro.");
    }
    if (state.step === 4) {
      const name = $("#clientName");
      const phone = $("#clientPhone");
      const consent = $("#privacyConsent");
      if (name.value.trim().length < 3) { name.focus(); return showInlineMessage("Informe seu nome completo."); }
      if (L.normalizePhone(phone.value).length < 10) { phone.focus(); return showInlineMessage("Informe um WhatsApp válido."); }
      if (!consent.checked) { consent.focus(); return showInlineMessage("Marque a autorização para continuar."); }
    }
    return true;
  }

  function goToStep(step) {
    state.step = Math.min(4, Math.max(1, step));
    if (state.step === 3) buildTimes();
    $$(".form-step").forEach(section => section.classList.toggle("active", Number(section.dataset.step) === state.step));
    $$(".step").forEach((button, index) => {
      button.classList.toggle("active", index + 1 === state.step);
      button.classList.toggle("done", index + 1 < state.step);
    });
    elements.prev.disabled = state.step === 1;
    elements.next.textContent = state.step === 4 ? (state.rebookingId ? "Confirmar reagendamento" : "Confirmar agendamento") : "Continuar";
  }

  function createBooking() {
    if (!L.isSlotAvailable({ date: state.date, startTime: state.time, durationMinutes: state.service.durationMinutes, professional: elements.professional.value || settings.professional })) {
      state.time = "";
      goToStep(3);
      showInlineMessage("Esse horário já foi reservado. Escolha outro.");
      return;
    }
    const now = new Date().toISOString();
    const reservation = L.reserveBooking({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      code: L.makeCode(),
      serviceId: state.service.id,
      service: state.service.name,
      durationMinutes: state.service.durationMinutes,
      priceValue: state.service.price,
      date: state.date,
      dateLabel: state.dateLabel,
      startTime: state.time,
      time: state.time,
      endTime: L.addMinutes(state.time, state.service.durationMinutes),
      name: $("#clientName").value.trim(),
      phone: L.formatPhone($("#clientPhone").value),
      clientPhoto: $("#clientPhotoData")?.value || "",
      professional: elements.professional.value || settings.professional,
      notes: $("#notes").value.trim(),
      status: "pending",
      createdAt: now,
      updatedAt: now,
      rescheduledFrom: state.rebookingId,
      source: "site"
    });
    if (!reservation.ok) {
      state.time = "";
      goToStep(3);
      buildTimes();
      showInlineMessage("Esse horário acabou de ser reservado. Escolha outro.");
      return;
    }
    const booking = reservation.booking;

    if (state.rebookingId) {
      const original = L.getBookings().find(item => String(item.id) === String(state.rebookingId));
      if (original) L.upsertBooking({ ...original, status: "cancelled", cancellationReason: `Reagendado para ${booking.code}`, updatedAt: now });
    }

    lastBooking = booking;
    L.upsertClient({ name: booking.name, phone: booking.phone, phoneDigits: booking.phoneDigits, photo: booking.clientPhoto });
    showConfirmation(booking);
    state.rebookingId = null;
  }

  function showConfirmation(booking) {
    elements.confirmationCode.textContent = booking.code;
    elements.confirmationSummary.innerHTML = `
      <strong>Cliente:</strong> ${L.escapeHTML(booking.name)}<br>
      <strong>Serviço:</strong> ${L.escapeHTML(booking.service)}${booking.priceValue > 0 ? ` · ${L.escapeHTML(L.formatCurrency(booking.priceValue))}` : ""}<br>
      <strong>Data:</strong> ${L.escapeHTML(L.formatDate(booking.date))}<br>
      <strong>Horário:</strong> ${booking.startTime} às ${booking.endTime}<br>
      <strong>Profissional:</strong> ${L.escapeHTML(booking.professional)}<br>
      <strong>Status:</strong> Pendente — aguardando confirmação da barbearia
      ${booking.notes ? `<br><strong>Observação:</strong> ${L.escapeHTML(booking.notes)}` : ""}`;
    const depositBox = $("#depositBox");
    const showDeposit = settings.depositEnabled && Number(settings.depositAmount) > 0 && String(settings.pixKey || "").trim();
    depositBox.classList.toggle("hidden", !showDeposit);
    if (showDeposit) { $("#depositAmount").textContent = L.formatCurrency(settings.depositAmount); $("#depositMessage").textContent = settings.depositMessage; $("#depositPixKey").textContent = settings.pixKey; }
    elements.modal.classList.add("open");
    elements.modal.setAttribute("aria-hidden", "false");
  }

  function whatsappMessage(booking, intro = "Olá! Gostaria de confirmar meu agendamento na Legado Barbearia.") {
    return [
      intro, "", `*Código:* ${booking.code}`, `*Nome:* ${booking.name}`, `*Serviço:* ${booking.service}${booking.priceValue > 0 ? ` · ${L.formatCurrency(booking.priceValue)}` : ""}`,
      `*Data:* ${L.formatDate(booking.date)}`, `*Horário:* ${booking.startTime} às ${booking.endTime}`, `*Profissional:* ${booking.professional}`,
      booking.notes ? `*Observação:* ${booking.notes}` : ""
    ].filter(Boolean).join("\n");
  }

  function openWhatsApp(booking, intro) {
    const number = String(settings.whatsappNumber).replace(/\D/g, "");
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(whatsappMessage(booking, intro))}`, "_blank", "noopener");
  }

  function downloadICS(booking) {
    const compact = (date, time) => `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
    const content = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Legado Barbearia//Agenda//PT-BR", "BEGIN:VEVENT",
      `UID:${booking.id}@legadobarbearia`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
      `DTSTART:${compact(booking.date, booking.startTime)}`, `DTEND:${compact(booking.date, booking.endTime)}`,
      `SUMMARY:${booking.service} - Legado Barbearia`, `DESCRIPTION:Código ${booking.code}. Profissional: ${booking.professional}.`,
      `LOCATION:${settings.address}, ${settings.city}`, "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
    L.downloadFile(`legado-${booking.code}.ics`, content, "text/calendar;charset=utf-8");
  }

  function applySettings() {
    settings = L.getSettings();
    const selectedProfessional = elements.professional.value || settings.professional;
    elements.professional.innerHTML = settings.barbers.map(name => `<option value="${L.escapeHTML(name)}" ${name === selectedProfessional ? "selected" : ""}>${L.escapeHTML(name)}</option>`).join("");
    const whatsapp = $("#footerWhatsapp");
    whatsapp.href = `https://wa.me/${String(settings.whatsappNumber).replace(/\D/g, "")}`;
    whatsapp.textContent = `WhatsApp: ${settings.displayPhone}`;
    const instagramLinks = [$("#footerInstagram"), $("#heroInstagram"), $("#experienceInstagram"), $("#portfolioInstagram")];
    instagramLinks.filter(Boolean).forEach(link => { link.href = settings.instagramUrl || `https://instagram.com/${settings.instagram.replace("@", "")}`; });
    $("#footerInstagram").textContent = `Instagram: ${settings.instagram}`;
    $("#footerAddress").textContent = settings.address;
    $("#footerCity").textContent = settings.city;
    $("#footerBusinessDays").textContent = settings.businessDays;
    $("#footerBusinessHours").textContent = settings.businessHours;
    $("#bookingPolicyText").textContent = settings.bookingMessage;
    const number = String(settings.whatsappNumber).replace(/\D/g, "");
    const whatsappUrl = `https://wa.me/${number}`;
    const mapUrl = settings.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${settings.address}, ${settings.city}`)}`;
    const reviewMessage = `Olá! Fui atendido na Legado Barbearia e gostaria de deixar uma avaliação.`;
    const contactLinks = [$("#floatingWhatsapp"), $("#visitWhatsapp")];
    contactLinks.filter(Boolean).forEach(link => link.href = whatsappUrl);
    const reviewLink = $("#reviewWhatsapp");
    if (reviewLink) reviewLink.href = `${whatsappUrl}?text=${encodeURIComponent(reviewMessage)}`;
    const visitMap = $("#visitMap"); if (visitMap) visitMap.href = mapUrl;
    if ($("#visitAddress")) $("#visitAddress").textContent = settings.address;
    if ($("#visitCity")) $("#visitCity").textContent = settings.city;
    if ($("#visitBusinessDays")) $("#visitBusinessDays").textContent = settings.businessDays;
    if ($("#visitBusinessHours")) $("#visitBusinessHours").textContent = settings.businessHours;
    if ($("#visitPhone")) $("#visitPhone").textContent = settings.displayPhone;
    renderAbout();
    renderBusinessStatus();
  }

  function formatInputPhone(input) {
    input.value = L.formatPhone(input.value);
  }

  function clientInitials(name = "Cliente Legado") {
    return String(name || "CL").split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "CL";
  }

  function renderProfileAvatar(client = null) {
    const preview = $("#profileAvatarPreview");
    if (!preview) return;
    if (client?.photo) {
      preview.innerHTML = `<img src="${L.escapeHTML(client.photo)}" alt="${L.escapeHTML(client.name)}" />`;
    } else {
      preview.textContent = clientInitials(client?.name || $("#profileName")?.value || "Cliente Legado");
    }
  }

  function findClientByPhone(value) {
    const digits = L.normalizePhone(value);
    if (digits.length < 10) return null;
    return L.getClients().find(client => client.phoneDigits === digits) || null;
  }

  function applyClientProfile(client, target = "all") {
    if (!client) return false;
    if (target === "all" || target === "profile") {
      if ($("#profileName")) $("#profileName").value = client.name || "";
      if ($("#profilePhone")) $("#profilePhone").value = client.phone || "";
      if ($("#profilePhotoData")) $("#profilePhotoData").value = client.photo || "";
      if ($("#profileNotes")) $("#profileNotes").value = client.notes || "";
      renderProfileAvatar(client);
    }
    if (target === "all" || target === "booking") {
      if ($("#clientName") && !$("#clientName").value.trim()) $("#clientName").value = client.name || "";
      if ($("#clientPhone")) $("#clientPhone").value = client.phone || $("#clientPhone").value;
      if ($("#clientPhotoData")) $("#clientPhotoData").value = client.photo || "";
      if ($("#notes") && client.notes && !$("#notes").value.trim()) $("#notes").value = client.notes;
    }
    if (target === "all" || target === "review") {
      if ($("#reviewName")) $("#reviewName").value = client.name || $("#reviewName").value;
      if ($("#reviewPhone")) $("#reviewPhone").value = client.phone || $("#reviewPhone").value;
    }
    return true;
  }

  function renderLookup(booking) {
    const canCancel = L.canClientCancel(booking);
    const upcoming = ["pending", "confirmed"].includes(booking.status) && L.dateTimeValue(booking.date, booking.startTime) > Date.now();
    elements.lookupResult.innerHTML = `
      <article class="client-booking" data-client-booking="${L.escapeHTML(booking.id)}">
        <div class="client-booking-head"><div><h3>${L.escapeHTML(booking.service)}</h3><p>Código ${L.escapeHTML(booking.code)} · ${L.escapeHTML(booking.name)}</p></div><span class="status-badge status-${booking.status}">${L.statusLabel(booking.status)}</span></div>
        <div class="client-booking-details">
          <div><span>Data</span><strong>${L.escapeHTML(L.formatDate(booking.date, { day: "2-digit", month: "long", year: "numeric" }))}</strong></div>
          <div><span>Horário</span><strong>${booking.startTime}–${booking.endTime}</strong></div>
          <div><span>Profissional</span><strong>${L.escapeHTML(booking.professional)}</strong></div>
          <div><span>Duração</span><strong>${booking.durationMinutes} min</strong></div>
          <div><span>Valor</span><strong>${booking.priceValue > 0 ? L.formatCurrency(booking.priceValue) : "A confirmar"}</strong></div>
          <div><span>WhatsApp</span><strong>${L.escapeHTML(booking.phone)}</strong></div>
        </div>
        ${booking.notes ? `<p class="policy-note"><strong>Observação:</strong> ${L.escapeHTML(booking.notes)}</p>` : ""}
        ${settings.depositEnabled && Number(settings.depositAmount) > 0 && settings.pixKey ? `<div class="client-deposit-box"><strong>Sinal opcional/configurado:</strong> ${L.escapeHTML(L.formatCurrency(settings.depositAmount))}<br>Chave Pix: ${L.escapeHTML(settings.pixKey)}<br>${L.escapeHTML(settings.depositMessage)}</div>` : ""}
        <p class="policy-note">${L.escapeHTML(settings.cancellationPolicy)} ${canCancel ? "Este agendamento ainda pode ser alterado pelo site." : upcoming ? "O prazo de alteração pelo site terminou; fale com a barbearia." : ""}</p>
        <div class="client-actions">
          <button class="button" type="button" data-client-action="whatsapp">Falar no WhatsApp</button>
          <button class="button button-secondary" type="button" data-client-action="calendar">Adicionar ao calendário</button>
          ${canCancel ? '<button class="button button-secondary" type="button" data-client-action="rebook">Reagendar</button><button class="button button-secondary" type="button" data-client-action="cancel">Cancelar</button>' : ""}
        </div>
      </article>`;
    elements.lookupResult.dataset.bookingId = booking.id;
  }

  function lookupBooking(phone, code) {
    const phoneDigits = L.normalizePhone(phone);
    const normalizedCode = String(code || "").trim().toUpperCase();
    return L.getBookings().find(item => item.phoneDigits === phoneDigits && item.code.toUpperCase() === normalizedCode);
  }

  function beginRebooking(booking) {
    const service = services.find(item => item.id === booking.serviceId) || services.find(item => item.name === booking.service);
    if (!service) { showToast("Este serviço não está mais disponível.", true); return; }
    state.rebookingId = booking.id;
    selectService(service.id);
    state.date = ""; state.dateLabel = ""; state.time = "";
    $("#clientName").value = booking.name;
    $("#clientPhone").value = booking.phone;
    if ($("#clientPhotoData")) $("#clientPhotoData").value = booking.clientPhoto || L.getClients().find(client => client.phoneDigits === booking.phoneDigits)?.photo || "";
    $("#notes").value = booking.notes;
    $("#privacyConsent").checked = true;
    buildDates(); buildTimes(); updateSummary(); goToStep(2);
    $("#agendar").scrollIntoView({ behavior: "smooth" });
    showToast("Escolha a nova data e o novo horário. O anterior será cancelado após a confirmação.");
  }

  function cancelBooking(booking) {
    if (!L.canClientCancel(booking)) { showToast("O prazo para cancelamento pelo site terminou.", true); return; }
    if (!window.confirm("Deseja realmente cancelar este agendamento?")) return;
    const updated = L.upsertBooking({ ...booking, status: "cancelled", cancellationReason: "Cancelado pelo cliente", updatedAt: new Date().toISOString() });
    renderLookup(updated);
    showToast("Agendamento cancelado.");
    openWhatsApp(updated, "Olá! Cancelei este agendamento pelo site da Legado Barbearia.");
  }

  elements.next.addEventListener("click", () => {
    if (!validateStep()) return;
    if (state.step < 4) goToStep(state.step + 1);
    else createBooking();
  });
  elements.prev.addEventListener("click", () => goToStep(state.step - 1));
  elements.serviceChoices.addEventListener("click", event => {
    const button = event.target.closest("[data-service]");
    if (button) selectService(button.dataset.service);
  });
  elements.publicServices.addEventListener("click", event => {
    const card = event.target.closest("[data-service-card]");
    if (!card) return;
    selectService(card.dataset.serviceCard); goToStep(1); $("#agendar").scrollIntoView({ behavior: "smooth" });
  });
  elements.publicServices.addEventListener("keydown", event => {
    if (!["Enter", " "].includes(event.key)) return;
    const card = event.target.closest("[data-service-card]");
    if (card) { event.preventDefault(); card.click(); }
  });
  elements.dates.addEventListener("click", event => {
    const button = event.target.closest("[data-date]");
    if (button && !button.disabled) selectDate(button.dataset.date);
  });
  elements.customDate.addEventListener("change", event => selectDate(event.target.value));
  elements.times.addEventListener("click", event => {
    const button = event.target.closest("[data-time]");
    if (button) selectTime(button.dataset.time);
  });
  $$("[data-step-target]").forEach(button => button.addEventListener("click", () => {
    const target = Number(button.dataset.stepTarget);
    if (target < state.step) goToStep(target);
  }));
  $$("[data-close-modal]").forEach(element => element.addEventListener("click", () => {
    elements.modal.classList.remove("open"); elements.modal.setAttribute("aria-hidden", "true");
  }));
  $("#whatsappButton").addEventListener("click", () => lastBooking && openWhatsApp(lastBooking));
  $("#calendarButton").addEventListener("click", () => lastBooking && downloadICS(lastBooking));
  $("#copyCodeButton").addEventListener("click", async () => {
    if (!lastBooking) return;
    try { await navigator.clipboard.writeText(lastBooking.code); showToast("Código copiado."); }
    catch { showToast(`Código: ${lastBooking.code}`); }
  });
  $("#copyPixButton").addEventListener("click", async () => {
    const key = String(settings.pixKey || "").trim(); if (!key) return;
    try { await navigator.clipboard.writeText(key); showToast("Chave Pix copiada."); } catch { showToast(`Chave Pix: ${key}`); }
  });
  $("#copyLookupLinkButton").addEventListener("click", async () => {
    if (!lastBooking) return;
    const url = new URL(location.href);
    url.search = "";
    url.searchParams.set("telefone", lastBooking.phoneDigits || L.normalizePhone(lastBooking.phone));
    url.searchParams.set("codigo", lastBooking.code);
    url.hash = "meus-horarios";
    try { await navigator.clipboard.writeText(url.toString()); showToast("Link de consulta copiado. Ele funciona neste aparelho até a conexão online."); }
    catch { showToast("Não foi possível copiar o link.", true); }
  });

  elements.professional.addEventListener("change", () => { state.time = ""; buildTimes(); updateSummary(); });
  [$("#clientPhone"), $("#lookupPhone"), $("#reviewPhone"), $("#profilePhone")].filter(Boolean).forEach(input => input.addEventListener("input", () => {
    formatInputPhone(input);
    const client = findClientByPhone(input.value);
    if (!client) return;
    if (input.id === "clientPhone") applyClientProfile(client, "booking");
    if (input.id === "reviewPhone") applyClientProfile(client, "review");
    if (input.id === "profilePhone") applyClientProfile(client, "profile");
  }));
  $("#profileName")?.addEventListener("input", () => renderProfileAvatar({ name: $("#profileName").value, photo: $("#profilePhotoData")?.value || "" }));
  $("#profilePhoto")?.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      showToast("Preparando foto do perfil...");
      $("#profilePhotoData").value = await optimizeImage(file, 720, .78);
      renderProfileAvatar({ name: $("#profileName").value, photo: $("#profilePhotoData").value });
      showToast("Foto adicionada ao cadastro.");
    } catch (error) {
      $("#profilePhotoData").value = "";
      event.target.value = "";
      showToast(error.message, true);
    }
  });
  $("#profileForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const name = $("#profileName").value.trim();
    const phone = L.formatPhone($("#profilePhone").value);
    const phoneDigits = L.normalizePhone(phone);
    if (name.length < 2) return showToast("Informe seu nome para salvar o cadastro.", true);
    if (phoneDigits.length < 10) return showToast("Informe um WhatsApp válido.", true);
    const client = L.upsertClient({ name, phone, phoneDigits, photo: $("#profilePhotoData").value || "", notes: $("#profileNotes").value.trim() });
    applyClientProfile(client, "all");
    showToast("Cadastro salvo. Seus próximos agendamentos ficam mais rápidos.");
  });
  $("#reviewForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const name = $("#reviewName").value.trim();
    const phone = L.formatPhone($("#reviewPhone").value);
    const phoneDigits = L.normalizePhone(phone);
    const text = $("#reviewText").value.trim();
    if (name.length < 2) return showToast("Informe seu nome para enviar a avaliação.", true);
    if (phoneDigits.length < 10) return showToast("Informe um WhatsApp válido.", true);
    if (text.length < 8) return showToast("Escreva um comentário um pouco maior.", true);
    if (!$("#reviewConsent").checked) return showToast("Autorize o uso da avaliação para continuar.", true);
    const existingClient = L.getClients().find(client => client.phoneDigits === phoneDigits);
    const photo = existingClient?.photo || "";
    const items = L.getTestimonials(true);
    items.push(L.normalizeTestimonial({
      id: `testimonial-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      phone,
      phoneDigits,
      service: $("#reviewService").value.trim() || "Atendimento Legado",
      text,
      rating: Number($("#reviewRating").value) || 5,
      photo,
      status: "pending",
      active: false,
      source: "site",
      order: items.length + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    L.setTestimonials(items);
    L.upsertClient({ name, phone, phoneDigits, photo, notes: existingClient?.notes || "" });
    $("#reviewForm").reset();
    showToast("Avaliação enviada. Ela aparecerá no site depois da aprovação.");
  });
  $("#lookupCode").addEventListener("input", event => { event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 8); });
  elements.lookupForm.addEventListener("submit", event => {
    event.preventDefault();
    const booking = lookupBooking($("#lookupPhone").value, $("#lookupCode").value);
    if (!booking) {
      elements.lookupResult.innerHTML = '<div class="empty-state"><strong>Agendamento não encontrado</strong><p>Confira o WhatsApp e o código. Nesta versão, a consulta funciona apenas no aparelho usado para agendar.</p></div>';
      return;
    }
    renderLookup(booking);
  });
  elements.lookupResult.addEventListener("click", event => {
    const action = event.target.closest("[data-client-action]")?.dataset.clientAction;
    if (!action) return;
    const booking = L.getBookings().find(item => String(item.id) === String(elements.lookupResult.dataset.bookingId));
    if (!booking) return;
    if (action === "whatsapp") openWhatsApp(booking, "Olá! Gostaria de falar sobre este agendamento na Legado Barbearia.");
    if (action === "calendar") downloadICS(booking);
    if (action === "rebook") beginRebooking(booking);
    if (action === "cancel") cancelBooking(booking);
  });

  $("#portfolioFilters").addEventListener("click", event => {
    const button = event.target.closest("[data-portfolio-filter]");
    if (!button) return;
    portfolioCategory = button.dataset.portfolioFilter;
    renderPortfolio();
  });
  $("#portfolioGrid").addEventListener("click", event => {
    const card = event.target.closest("[data-portfolio-id]");
    if (card) openPortfolioItem(card.dataset.portfolioId);
  });
  $("#portfolioGrid").addEventListener("keydown", event => {
    if (!["Enter", " "].includes(event.key)) return;
    const card = event.target.closest("[data-portfolio-id]");
    if (card) { event.preventDefault(); openPortfolioItem(card.dataset.portfolioId); }
  });
  $("#lightboxThumbnails").addEventListener("click", event => {
    const button = event.target.closest("[data-lightbox-index]");
    if (!button) return;
    showPortfolioImage(Number(button.dataset.lightboxIndex));
  });
  $("#lightboxPrev").addEventListener("click", () => showPortfolioImage((activePortfolioImageIndex - 1 + activePortfolioImages.length) % activePortfolioImages.length));
  $("#lightboxNext").addEventListener("click", () => showPortfolioImage((activePortfolioImageIndex + 1) % activePortfolioImages.length));
  $("#bookPortfolioStyle").addEventListener("click", () => {
    if (!activePortfolioItem) return;
    const service = matchingServiceForPortfolio(activePortfolioItem);
    if (service) selectService(service.id);
    const notes = $("#notes");
    const reference = `Referência do portfólio: ${activePortfolioItem.title}`;
    if (notes && !notes.value.includes(reference)) notes.value = [notes.value.trim(), reference].filter(Boolean).join("\n");
    closePortfolioLightbox();
    goToStep(1);
    $("#agendar").scrollIntoView({ behavior: "smooth", block: "start" });
    showToast("Estilo adicionado como referência do agendamento.");
  });
  $("#sharePortfolioStyle").addEventListener("click", async () => {
    if (!activePortfolioItem) return;
    const shareUrl = location.protocol === "file:" ? `${location.href.split("#")[0]}#portfolio` : `${location.origin}${location.pathname}#portfolio`;
    const data = { title: `${activePortfolioItem.title} | Legado Barbearia`, text: activePortfolioItem.description, url: shareUrl };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(`${data.title}\n${data.text}\n${data.url}`); showToast("Link do portfólio copiado."); }
    } catch (error) { if (error?.name !== "AbortError") showToast("Não foi possível compartilhar.", true); }
  });
  $$('[data-close-lightbox]').forEach(element => element.addEventListener("click", closePortfolioLightbox));

  const menuButton = $(".menu-button");
  const nav = $(".main-nav");
  const header = $(".site-header");
  function setMenuOpen(open) {
    nav.classList.toggle("open", open);
    header.classList.toggle("menu-open", open);
    document.body.classList.toggle("body-menu-open", open);
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.textContent = open ? "×" : "☰";
  }
  menuButton.addEventListener("click", () => setMenuOpen(!nav.classList.contains("open")));
  nav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => setMenuOpen(false)));
  document.addEventListener("click", event => {
    if (!nav.classList.contains("open")) return;
    if (event.target.closest(".main-nav") || event.target.closest(".menu-button")) return;
    setMenuOpen(false);
  });

  const navLinks = Array.from(nav.querySelectorAll('a[href^="#"]'));
  const navSections = navLinks.map(link => document.querySelector(link.getAttribute("href"))).filter(Boolean);
  function setActiveNav(id) {
    navLinks.forEach(link => link.classList.toggle("active", link.getAttribute("href") === `#${id}`));
  }
  if ("IntersectionObserver" in window) {
    const navObserver = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target?.id) setActiveNav(visible.target.id);
    }, { rootMargin: "-35% 0px -55% 0px", threshold: [.08, .18, .32] });
    navSections.forEach(section => navObserver.observe(section));
  }

  const mobileBookingCta = $(".mobile-booking-cta");
  const floatingWhatsapp = $("#floatingWhatsapp");
  const bookingSection = $("#agendar");
  function updateMobileCta() {
    if (!mobileBookingCta || !bookingSection) return;
    const box = bookingSection.getBoundingClientRect();
    const insideBooking = box.top < window.innerHeight * .72 && box.bottom > window.innerHeight * .28;
    const beforeBooking = box.top > window.innerHeight * .24;
    const nearBottom = window.innerHeight + window.scrollY > document.documentElement.scrollHeight - 180;
    const hideFloatingActions = insideBooking || !beforeBooking || nearBottom;
    mobileBookingCta.classList.toggle("is-hidden", hideFloatingActions);
    if (floatingWhatsapp) floatingWhatsapp.classList.toggle("is-hidden", hideFloatingActions);
  }
  window.addEventListener("scroll", updateMobileCta, { passive: true });
  window.addEventListener("resize", updateMobileCta);
  updateMobileCta();
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      setMenuOpen(false);
      closePortfolioLightbox();
      elements.modal.classList.remove("open");
      elements.modal.setAttribute("aria-hidden", "true");
    }
    const lightboxOpen = $("#portfolioLightbox").classList.contains("open");
    if (lightboxOpen && event.key === "ArrowLeft") showPortfolioImage((activePortfolioImageIndex - 1 + activePortfolioImages.length) % activePortfolioImages.length);
    if (lightboxOpen && event.key === "ArrowRight") showPortfolioImage((activePortfolioImageIndex + 1) % activePortfolioImages.length);
  });

  let observer;
  function observeReveals() {
    if (!observer) observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add("visible"); observer.unobserve(entry.target); }
    }), { threshold: .1 });
    $$(".reveal:not(.visible)").forEach(element => observer.observe(element));
  }

  function refreshData() {
    settings = L.getSettings(); services = L.getServices(); availability = L.getAvailability();
    if (state.serviceId) state.service = services.find(item => item.id === state.serviceId) || null;
    applySettings(); buildPublicServices(); buildServiceChoices(); buildDates(); buildTimes(); updateSummary(); renderBarbers(); renderPortfolio(); renderTestimonials(); renderBusinessStatus();
  }

  window.addEventListener("storage", refreshData);
  window.addEventListener("legado:datachange", refreshData);
  $("#currentYear").textContent = new Date().getFullYear();
  clearInterval(statusInterval);
  statusInterval = setInterval(renderBusinessStatus, 60000);

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }

  applySettings(); buildPublicServices(); buildServiceChoices(); buildDates(); buildTimes(); renderBarbers(); renderPortfolio(); renderTestimonials(); goToStep(1); observeReveals();

  const query = new URLSearchParams(location.search);
  if (query.get("telefone") && query.get("codigo")) {
    $("#lookupPhone").value = L.formatPhone(query.get("telefone"));
    $("#lookupCode").value = query.get("codigo").toUpperCase();
    const found = lookupBooking(query.get("telefone"), query.get("codigo"));
    if (found) renderLookup(found);
  }
})();
