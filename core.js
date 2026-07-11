(() => {
  "use strict";

  const KEYS = {
    settings: "legadoSettings",
    services: "legadoServices",
    availability: "legadoAvailability",
    bookings: "legadoBookings",
    blocks: "legadoBlockedSlots",
    portfolio: "legadoPortfolio",
    testimonials: "legadoTestimonials",
    credentials: "legadoAdminCredentials",
    session: "legadoAdminSession"
  };

  const DEFAULT_SETTINGS = {
    businessName: "Legado Barbearia",
    whatsappNumber: "556499886880",
    displayPhone: "+55 (64) 9988-6880",
    professional: "Gilliel Glaydson",
    barbers: ["Gilliel Glaydson"],
    instagram: "@gdlegadobarbearia",
    instagramUrl: "https://www.instagram.com/gdlegadobarbearia?igsh=M2xwZ3V5MmtjY2Vm",
    address: "St. Cruvinel",
    city: "Mineiros - GO, 75830-000",
    businessDays: "Segunda a sábado",
    businessHours: "09h às 19h",
    bookingMessage: "Seu horário será analisado e confirmado pela barbearia.",
    cancellationPolicy: "Cancelamentos e reagendamentos devem ser feitos com antecedência.",
    showPrices: true,
    aboutEyebrow: "CONHEÇA A LEGADO",
    aboutTitle: "Tradição, técnica e personalidade em cada detalhe.",
    aboutText: "A Legado Barbearia nasceu para oferecer uma experiência completa: atendimento com hora marcada, ambiente sofisticado e cuidado pensado para valorizar o estilo de cada cliente.",
    professionalBio: "Gilliel Glaydson une precisão, atenção aos detalhes e atendimento personalizado para entregar cortes e barbas alinhados ao perfil de cada cliente.",
    professionalPhoto: "assets/gilliel-apresentacao.webp",
    portfolioEyebrow: "PORTFÓLIO",
    portfolioTitle: "Resultados reais, feitos na Legado.",
    portfolioText: "Fotos reais de cortes, barbas, acabamentos e transformações realizadas na barbearia.",
    testimonialsEyebrow: "EXPERIÊNCIA DOS CLIENTES",
    testimonialsTitle: "Quem vive a experiência, recomenda.",
    testimonialsText: "Depoimentos reais podem ser cadastrados e publicados diretamente pelo administrador.",
    googleMapsUrl: "https://maps.app.goo.gl/uMqV56GQe719X8EE7",
    depositEnabled: false,
    depositAmount: 0,
    pixKey: "",
    depositMessage: "O sinal será conferido manualmente pela barbearia.",
    loyaltyEnabled: false,
    loyaltyGoal: 10,
    loyaltyReward: "Um benefício especial após 10 atendimentos concluídos."
  };

  const DEFAULT_SERVICES = [
    { id: "corte-classico", name: "Corte Clássico", durationMinutes: 45, price: 0, description: "Acabamento preciso e finalização personalizada.", icon: "corte.webp", active: true },
    { id: "barba-premium", name: "Barba Premium", durationMinutes: 35, price: 0, description: "Modelagem, alinhamento e cuidado completo.", icon: "barba.webp", active: true },
    { id: "corte-barba", name: "Corte + Barba", durationMinutes: 70, price: 0, description: "Experiência completa para renovar o visual.", icon: "produtos.webp", active: true },
    { id: "acabamento", name: "Acabamento", durationMinutes: 20, price: 0, description: "Pezinho, contorno e pequenos ajustes.", icon: "agendamento.webp", active: true }
  ];

  const standardDay = (end = "19:00") => ({
    enabled: true,
    periods: [{ start: "09:00", end: "12:00" }, { start: "13:00", end }]
  });

  const DEFAULT_AVAILABILITY = {
    slotInterval: 15,
    bufferMinutes: 10,
    advanceDays: 45,
    minimumLeadMinutes: 60,
    cancellationDeadlineMinutes: 120,
    weekdays: {
      0: { enabled: false, periods: [] },
      1: standardDay(),
      2: standardDay(),
      3: standardDay(),
      4: standardDay(),
      5: standardDay(),
      6: standardDay("18:00")
    }
  };

  // O portfólio começa vazio para não repetir os mesmos ícones usados na seção de serviços.
  // As fotos reais dos trabalhos são adicionadas pelo painel administrativo.
  const DEFAULT_PORTFOLIO = [];
  const LEGACY_PORTFOLIO_IDS = new Set(["portfolio-cortes", "portfolio-barbas", "portfolio-finalizacao", "portfolio-experiencia"]);
  const LEGACY_PORTFOLIO_IMAGES = new Set(["assets/corte.webp", "assets/barba.webp", "assets/produtos.webp", "assets/agendamento.webp"]);

  const DEFAULT_TESTIMONIALS = [];
  const ICONS = ["corte.webp", "barba.webp", "produtos.webp", "agendamento.webp"];
  const VALID_STATUSES = ["pending", "confirmed", "completed", "cancelled", "no_show"];
  const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed"];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadRaw(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      return parsed == null ? clone(fallback) : parsed;
    } catch {
      return clone(fallback);
    }
  }

  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("legado:datachange", { detail: { key } }));
  }

  function escapeHTML(value = "") {
    return String(value).replace(/[&<>'"]/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[char]);
  }

  function slugify(value = "") {
    return String(value)
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `item-${Date.now()}`;
  }

  function parsePrice(value) {
    if (typeof value === "number") return Number.isFinite(value) ? Math.max(0, value) : 0;
    const cleaned = String(value || "")
      .replace(/R\$/gi, "")
      .replace(/\s/g, "")
      .replace(/\.(?=\d{3}(?:\D|$))/g, "")
      .replace(",", ".")
      .replace(/[^0-9.-]/g, "");
    const number = Number(cleaned);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
  }

  function formatCurrency(value) {
    return parsePrice(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function parseDuration(value) {
    if (typeof value === "number" && Number.isFinite(value)) return Math.max(5, Math.round(value));
    const found = String(value || "").match(/\d+/);
    return found ? Math.max(5, Number(found[0])) : 30;
  }

  function resolveMediaSource(value, fallback = "assets/corte.webp") {
    const source = String(value || fallback).trim();
    if (/^(data:|blob:|https?:\/\/|\/|\.\.?\/|assets\/)/i.test(source)) return source;
    return `assets/${source}`;
  }

  function normalizeService(service, index = 0) {
    return {
      id: String(service.id || `${slugify(service.name)}-${Date.now()}-${index}`),
      name: String(service.name || "Serviço"),
      durationMinutes: parseDuration(service.durationMinutes ?? service.duration),
      price: parsePrice(service.price),
      description: String(service.description || "Atendimento premium da Legado Barbearia."),
      icon: String(service.icon || ICONS[index % ICONS.length]),
      active: service.active !== false
    };
  }

  function getServices(includeInactive = false) {
    const raw = loadRaw(KEYS.services, DEFAULT_SERVICES);
    const list = Array.isArray(raw) ? raw.map(normalizeService) : clone(DEFAULT_SERVICES);
    return includeInactive ? list : list.filter(service => service.active);
  }

  function setServices(services) {
    save(KEYS.services, services.map(normalizeService));
  }

  function getSettings() {
    const raw = loadRaw(KEYS.settings, DEFAULT_SETTINGS);
    const merged = { ...clone(DEFAULT_SETTINGS), ...(raw && typeof raw === "object" ? raw : {}) };
    if (!raw?.professionalPhoto || raw.professionalPhoto === "assets/logo.webp" || raw.professionalPhoto === "assets/logo.png" || raw.professionalPhoto === "assets/gilliel-apresentacao.png") {
      merged.professionalPhoto = "assets/gilliel-apresentacao.webp";
    }
    if (!raw?.googleMapsUrl || raw.googleMapsUrl === "https://www.google.com/maps/search/?api=1&query=Av.%20Ant%C3%B4nio%20Carlos%20Paniago%2C%20Mineiros%20GO") {
      merged.googleMapsUrl = "https://maps.app.goo.gl/uMqV56GQe719X8EE7";
    }
    if (!raw?.address || raw.address === "Av. Antônio Carlos Paniago") merged.address = "St. Cruvinel";
    if (!raw?.city || raw.city === "Mineiros - GO") merged.city = "Mineiros - GO, 75830-000";
    const barbers = Array.isArray(merged.barbers) ? merged.barbers : [];
    merged.barbers = [...new Set([merged.professional, ...barbers].map(item => String(item || "").trim()).filter(Boolean))];
    if (!merged.barbers.length) merged.barbers = [merged.professional || DEFAULT_SETTINGS.professional];
    if (!merged.professional || !merged.barbers.includes(merged.professional)) merged.professional = merged.barbers[0];
    return merged;
  }

  function setSettings(settings) {
    save(KEYS.settings, { ...getSettings(), ...settings });
  }

  function normalizePortfolioItem(item, index = 0) {
    const coverImage = String(item?.image || item?.images?.[0] || "assets/corte.webp");
    const gallery = Array.isArray(item?.images) ? item.images.map(value => String(value || "").trim()).filter(Boolean) : [];
    const images = [...new Set([coverImage, ...gallery])];
    return {
      id: String(item?.id || `${slugify(item?.title || "portfolio")}-${Date.now()}-${index}`),
      title: String(item?.title || "Trabalho Legado"),
      category: String(item?.category || "Cortes"),
      summary: String(item?.summary || item?.description || "Trabalho realizado pela Legado Barbearia."),
      description: String(item?.description || item?.summary || "Trabalho realizado pela Legado Barbearia."),
      image: coverImage,
      images: images.length ? images : ["assets/corte.webp"],
      alt: String(item?.alt || item?.title || "Trabalho da Legado Barbearia"),
      featured: item?.featured === true,
      active: item?.active !== false,
      order: Number.isFinite(Number(item?.order)) ? Number(item.order) : index + 1,
      createdAt: item?.createdAt || new Date().toISOString()
    };
  }

  function isLegacyIconPortfolioItem(item) {
    const gallery = Array.isArray(item?.images) && item.images.length ? item.images : [item?.image];
    return LEGACY_PORTFOLIO_IDS.has(String(item?.id || ""))
      && gallery.every(image => LEGACY_PORTFOLIO_IMAGES.has(String(image || "")));
  }

  function getPortfolio(includeInactive = false) {
    const raw = loadRaw(KEYS.portfolio, DEFAULT_PORTFOLIO);
    const original = Array.isArray(raw) ? raw.map(normalizePortfolioItem) : clone(DEFAULT_PORTFOLIO);
    const items = original.filter(item => !isLegacyIconPortfolioItem(item));
    if (items.length !== original.length) {
      localStorage.setItem(KEYS.portfolio, JSON.stringify(items));
    }
    return items.filter(item => includeInactive || item.active).sort((a, b) => a.order - b.order);
  }

  function setPortfolio(items) {
    save(KEYS.portfolio, (Array.isArray(items) ? items : []).map(normalizePortfolioItem));
  }

  function normalizeTestimonial(item, index = 0) {
    return {
      id: String(item?.id || `testimonial-${Date.now()}-${index}`),
      name: String(item?.name || "Cliente Legado"),
      service: String(item?.service || "Atendimento Legado"),
      text: String(item?.text || ""),
      rating: Math.min(5, Math.max(1, Number(item?.rating) || 5)),
      active: item?.active !== false,
      order: Number.isFinite(Number(item?.order)) ? Number(item.order) : index + 1,
      createdAt: item?.createdAt || new Date().toISOString()
    };
  }

  function getTestimonials(includeInactive = false) {
    const raw = loadRaw(KEYS.testimonials, DEFAULT_TESTIMONIALS);
    const items = Array.isArray(raw) ? raw.map(normalizeTestimonial) : [];
    return items.filter(item => includeInactive || item.active).sort((a, b) => a.order - b.order);
  }

  function setTestimonials(items) {
    save(KEYS.testimonials, (Array.isArray(items) ? items : []).map(normalizeTestimonial));
  }

  function normalizePeriod(period) {
    const start = /^\d{2}:\d{2}$/.test(period?.start || "") ? period.start : "09:00";
    const end = /^\d{2}:\d{2}$/.test(period?.end || "") ? period.end : "18:00";
    return { start, end };
  }

  function normalizeAvailability(raw) {
    const base = clone(DEFAULT_AVAILABILITY);
    if (!raw || typeof raw !== "object") return base;

    // Migração da primeira versão, baseada em uma lista fixa de horários.
    if (!raw.weekdays && Array.isArray(raw.times)) {
      const sorted = raw.times.filter(time => /^\d{2}:\d{2}$/.test(time)).sort();
      if (sorted.length) {
        const start = sorted[0];
        const last = sorted[sorted.length - 1];
        const end = minutesToTime(timeToMinutes(last) + 60);
        for (let day = 0; day <= 6; day += 1) {
          base.weekdays[day] = {
            enabled: !(raw.closedWeekdays || [0]).map(Number).includes(day),
            periods: [{ start, end }]
          };
        }
      }
      return base;
    }

    const availability = {
      slotInterval: Math.max(5, Number(raw.slotInterval) || base.slotInterval),
      bufferMinutes: Math.max(0, Number(raw.bufferMinutes) || 0),
      advanceDays: Math.max(1, Number(raw.advanceDays) || base.advanceDays),
      minimumLeadMinutes: Math.max(0, Number(raw.minimumLeadMinutes) || 0),
      cancellationDeadlineMinutes: Math.max(0, Number(raw.cancellationDeadlineMinutes) || 0),
      weekdays: {}
    };

    for (let day = 0; day <= 6; day += 1) {
      const source = raw.weekdays?.[day] ?? raw.weekdays?.[String(day)] ?? base.weekdays[day];
      const periods = Array.isArray(source?.periods) ? source.periods.map(normalizePeriod).filter(period => timeToMinutes(period.end) > timeToMinutes(period.start)) : [];
      availability.weekdays[day] = { enabled: source?.enabled !== false && periods.length > 0, periods };
    }
    return availability;
  }

  function getAvailability() {
    return normalizeAvailability(loadRaw(KEYS.availability, DEFAULT_AVAILABILITY));
  }

  function setAvailability(value) {
    save(KEYS.availability, normalizeAvailability(value));
  }

  function timeToMinutes(time) {
    const [hours, minutes] = String(time || "00:00").split(":").map(Number);
    return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
  }

  function minutesToTime(total) {
    const safe = Math.max(0, Math.min(24 * 60, Math.round(total)));
    const hours = Math.floor(safe / 60);
    const minutes = safe % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  function addMinutes(time, minutes) {
    return minutesToTime(timeToMinutes(time) + Number(minutes || 0));
  }

  function toLocalISO(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseISODate(iso) {
    return new Date(`${iso}T12:00:00`);
  }

  function todayISO() {
    return toLocalISO(new Date());
  }

  function formatDate(iso, options = { weekday: "long", day: "2-digit", month: "long" }) {
    if (!iso) return "";
    return parseISODate(iso).toLocaleDateString("pt-BR", options);
  }

  function dateTimeValue(date, time) {
    return new Date(`${date}T${time}:00`).getTime();
  }

  function makeCode() {
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const prefix = Array.from({ length: 3 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
    return `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  function normalizePhone(value) {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
    return digits;
  }

  function formatPhone(value) {
    const digits = normalizePhone(value).slice(0, 11);
    if (digits.length === 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    if (digits.length === 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    return value || "";
  }

  function getServiceById(id, includeInactive = true) {
    return getServices(includeInactive).find(service => String(service.id) === String(id));
  }

  function normalizeBooking(booking) {
    const service = getServiceById(booking.serviceId) || {};
    const durationMinutes = parseDuration(booking.durationMinutes ?? booking.duration ?? service.durationMinutes);
    const priceValue = parsePrice(booking.priceValue ?? booking.price ?? service.price);
    const startTime = booking.startTime || booking.time || "09:00";
    return {
      id: String(booking.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
      code: String(booking.code || makeCode()),
      serviceId: String(booking.serviceId || service.id || ""),
      service: String(booking.service || service.name || "Serviço"),
      durationMinutes,
      priceValue,
      price: priceValue > 0 ? formatCurrency(priceValue) : "",
      date: String(booking.date || todayISO()),
      dateLabel: String(booking.dateLabel || formatDate(booking.date || todayISO())),
      time: startTime,
      startTime,
      endTime: booking.endTime || addMinutes(startTime, durationMinutes),
      name: String(booking.name || "Cliente"),
      phone: formatPhone(booking.phone || ""),
      phoneDigits: normalizePhone(booking.phoneDigits || booking.phone || ""),
      professional: String(booking.professional || getSettings().professional),
      notes: String(booking.notes || ""),
      status: VALID_STATUSES.includes(booking.status) ? booking.status : "pending",
      createdAt: booking.createdAt || new Date().toISOString(),
      updatedAt: booking.updatedAt || booking.createdAt || new Date().toISOString(),
      rescheduledFrom: booking.rescheduledFrom || null,
      cancellationReason: String(booking.cancellationReason || ""),
      source: booking.source || "site"
    };
  }

  function getBookings() {
    const raw = loadRaw(KEYS.bookings, []);
    return Array.isArray(raw) ? raw.map(normalizeBooking) : [];
  }

  function setBookings(bookings) {
    save(KEYS.bookings, bookings.map(normalizeBooking));
  }

  function upsertBooking(booking) {
    const normalized = normalizeBooking(booking);
    const bookings = getBookings();
    const index = bookings.findIndex(item => String(item.id) === String(normalized.id));
    if (index >= 0) bookings[index] = normalized;
    else bookings.push(normalized);
    setBookings(bookings);
    return normalized;
  }

  function deleteBooking(id) {
    setBookings(getBookings().filter(item => String(item.id) !== String(id)));
  }

  function normalizeBlock(block) {
    const allDay = block.allDay === true || !block.startTime && !block.time;
    const startTime = block.startTime || block.time || "00:00";
    const endTime = block.endTime || (block.time ? addMinutes(block.time, 60) : "23:59");
    return {
      id: String(block.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
      date: String(block.date || todayISO()),
      allDay,
      startTime,
      endTime,
      reason: String(block.reason || "Horário bloqueado"),
      createdAt: block.createdAt || new Date().toISOString()
    };
  }

  function getBlocks() {
    const raw = loadRaw(KEYS.blocks, []);
    return Array.isArray(raw) ? raw.map(normalizeBlock) : [];
  }

  function setBlocks(blocks) {
    save(KEYS.blocks, blocks.map(normalizeBlock));
  }

  function intervalsOverlap(startA, endA, startB, endB) {
    return startA < endB && startB < endA;
  }

  function isInsideWorkingPeriod(date, startTime, durationMinutes) {
    const availability = getAvailability();
    const day = parseISODate(date).getDay();
    const config = availability.weekdays[day];
    if (!config?.enabled) return false;
    const start = timeToMinutes(startTime);
    const end = start + durationMinutes;
    return config.periods.some(period => start >= timeToMinutes(period.start) && end <= timeToMinutes(period.end));
  }

  function normalizeProfessional(value = "") {
    return String(value || "").trim().toLocaleLowerCase("pt-BR");
  }

  function findBookingConflicts({ date, startTime, durationMinutes, professional = "", ignoreBookingId = null, statuses = ACTIVE_BOOKING_STATUSES }) {
    const availability = getAvailability();
    const start = timeToMinutes(startTime);
    const endWithBuffer = start + Number(durationMinutes || 0) + availability.bufferMinutes;
    const targetProfessional = normalizeProfessional(professional || getSettings().professional);
    const acceptedStatuses = Array.isArray(statuses) ? statuses : ACTIVE_BOOKING_STATUSES;
    return getBookings().filter(item => {
      if (item.date !== date || String(item.id) === String(ignoreBookingId) || !acceptedStatuses.includes(item.status)) return false;
      if (normalizeProfessional(item.professional) !== targetProfessional) return false;
      const existingStart = timeToMinutes(item.startTime || item.time);
      const existingEnd = existingStart + item.durationMinutes + availability.bufferMinutes;
      return intervalsOverlap(start, endWithBuffer, existingStart, existingEnd);
    });
  }

  function getConflict({ date, startTime, durationMinutes, professional = "", ignoreBookingId = null, bookingStatuses = ACTIVE_BOOKING_STATUSES }) {
    const availability = getAvailability();
    const start = timeToMinutes(startTime);
    const endWithBuffer = start + Number(durationMinutes || 0) + availability.bufferMinutes;

    const block = getBlocks().find(item => {
      if (item.date !== date) return false;
      if (item.allDay) return true;
      return intervalsOverlap(start, endWithBuffer, timeToMinutes(item.startTime), timeToMinutes(item.endTime));
    });
    if (block) return { type: "block", item: block };

    const booking = findBookingConflicts({ date, startTime, durationMinutes, professional, ignoreBookingId, statuses: bookingStatuses })[0];
    if (booking) return { type: "booking", item: booking };
    return null;
  }

  function isPastLeadTime(date, startTime) {
    const availability = getAvailability();
    return dateTimeValue(date, startTime) < Date.now() + availability.minimumLeadMinutes * 60000;
  }

  function isSlotAvailable({ date, startTime, durationMinutes, professional = "", ignoreBookingId = null, allowPast = false, bookingStatuses = ACTIVE_BOOKING_STATUSES }) {
    if (!date || !startTime) return false;
    if (!isInsideWorkingPeriod(date, startTime, durationMinutes)) return false;
    if (!allowPast && isPastLeadTime(date, startTime)) return false;
    return !getConflict({ date, startTime, durationMinutes, professional, ignoreBookingId, bookingStatuses });
  }

  function generateSlots(date, durationMinutes, options = {}) {
    if (!date) return [];
    const availability = getAvailability();
    const day = parseISODate(date).getDay();
    const config = availability.weekdays[day];
    if (!config?.enabled) return [];
    const slots = [];
    config.periods.forEach(period => {
      const start = timeToMinutes(period.start);
      const end = timeToMinutes(period.end);
      for (let time = start; time + durationMinutes <= end; time += availability.slotInterval) {
        const startTime = minutesToTime(time);
        const available = isSlotAvailable({
          date,
          startTime,
          durationMinutes,
          professional: options.professional || getSettings().professional,
          ignoreBookingId: options.ignoreBookingId,
          allowPast: options.allowPast,
          bookingStatuses: options.bookingStatuses || ACTIVE_BOOKING_STATUSES
        });
        if (available || options.includeUnavailable) {
          slots.push({ startTime, endTime: addMinutes(startTime, durationMinutes), available });
        }
      }
    });
    return slots;
  }

  function reserveBooking(booking) {
    const normalized = normalizeBooking({ ...booking, status: "pending" });
    const available = isSlotAvailable({
      date: normalized.date,
      startTime: normalized.startTime,
      durationMinutes: normalized.durationMinutes,
      professional: normalized.professional,
      ignoreBookingId: normalized.id,
      allowPast: false,
      bookingStatuses: ACTIVE_BOOKING_STATUSES
    });
    if (!available) {
      return {
        ok: false,
        reason: "conflict",
        conflict: getConflict({
          date: normalized.date,
          startTime: normalized.startTime,
          durationMinutes: normalized.durationMinutes,
          professional: normalized.professional,
          ignoreBookingId: normalized.id,
          bookingStatuses: ACTIVE_BOOKING_STATUSES
        })
      };
    }
    return { ok: true, booking: upsertBooking(normalized) };
  }

  function confirmBooking(id, options = {}) {
    const bookings = getBookings();
    const index = bookings.findIndex(item => String(item.id) === String(id));
    if (index < 0) return { ok: false, reason: "not_found", conflicts: [] };
    const target = bookings[index];
    const confirmedConflicts = findBookingConflicts({
      date: target.date,
      startTime: target.startTime,
      durationMinutes: target.durationMinutes,
      professional: target.professional,
      ignoreBookingId: target.id,
      statuses: ["confirmed"]
    });
    if (confirmedConflicts.length) return { ok: false, reason: "confirmed_conflict", conflicts: confirmedConflicts };

    const pendingConflicts = findBookingConflicts({
      date: target.date,
      startTime: target.startTime,
      durationMinutes: target.durationMinutes,
      professional: target.professional,
      ignoreBookingId: target.id,
      statuses: ["pending"]
    });
    if (pendingConflicts.length && !options.cancelPendingConflicts) {
      return { ok: false, reason: "pending_conflict", conflicts: pendingConflicts };
    }

    const now = new Date().toISOString();
    bookings[index] = normalizeBooking({ ...target, status: "confirmed", updatedAt: now });
    if (options.cancelPendingConflicts) {
      const conflictIds = new Set(pendingConflicts.map(item => String(item.id)));
      bookings.forEach((item, itemIndex) => {
        if (!conflictIds.has(String(item.id))) return;
        bookings[itemIndex] = normalizeBooking({
          ...item,
          status: "cancelled",
          cancellationReason: `Conflito de agenda: o horário foi confirmado para ${target.name} (${target.code}).`,
          updatedAt: now
        });
      });
    }
    setBookings(bookings);
    return { ok: true, booking: bookings[index], cancelledConflicts: pendingConflicts };
  }

  function canClientCancel(booking) {
    if (!["pending", "confirmed"].includes(booking.status)) return false;
    const deadline = getAvailability().cancellationDeadlineMinutes;
    return dateTimeValue(booking.date, booking.startTime) - Date.now() >= deadline * 60000;
  }

  function statusLabel(status) {
    return ({
      pending: "Pendente",
      confirmed: "Confirmado",
      completed: "Concluído",
      cancelled: "Cancelado",
      no_show: "Não compareceu"
    })[status] || status;
  }

  function downloadFile(filename, content, type = "text/plain;charset=utf-8") {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function csvEscape(value) {
    const string = String(value ?? "");
    return `"${string.replace(/"/g, '""')}"`;
  }

  function exportBookingsCSV(bookings = getBookings()) {
    const header = ["Código", "Data", "Início", "Fim", "Cliente", "WhatsApp", "Serviço", "Duração", "Valor", "Profissional", "Status", "Observações", "Criado em"];
    const rows = bookings
      .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
      .map(item => [item.code, item.date, item.startTime, item.endTime, item.name, item.phone, item.service, item.durationMinutes, item.priceValue.toFixed(2).replace(".", ","), item.professional, statusLabel(item.status), item.notes, item.createdAt]);
    const csv = "\uFEFF" + [header, ...rows].map(row => row.map(csvEscape).join(";")).join("\n");
    downloadFile(`agenda-legado-${todayISO()}.csv`, csv, "text/csv;charset=utf-8");
  }

  function getBackup() {
    return {
      version: 3,
      exportedAt: new Date().toISOString(),
      settings: getSettings(),
      services: getServices(true),
      availability: getAvailability(),
      bookings: getBookings(),
      blocks: getBlocks(),
      portfolio: getPortfolio(true),
      testimonials: getTestimonials(true)
    };
  }

  function restoreBackup(data) {
    if (!data || typeof data !== "object") throw new Error("Arquivo de backup inválido.");
    if (data.settings) setSettings(data.settings);
    if (Array.isArray(data.services)) setServices(data.services);
    if (data.availability) setAvailability(data.availability);
    if (Array.isArray(data.bookings)) setBookings(data.bookings);
    if (Array.isArray(data.blocks)) setBlocks(data.blocks);
    if (Array.isArray(data.portfolio)) setPortfolio(data.portfolio);
    if (Array.isArray(data.testimonials)) setTestimonials(data.testimonials);
  }

  window.Legado = {
    KEYS,
    DEFAULT_SETTINGS,
    DEFAULT_SERVICES,
    DEFAULT_AVAILABILITY,
    DEFAULT_PORTFOLIO,
    DEFAULT_TESTIMONIALS,
    ICONS,
    VALID_STATUSES,
    ACTIVE_BOOKING_STATUSES,
    clone,
    loadRaw,
    save,
    escapeHTML,
    slugify,
    parsePrice,
    formatCurrency,
    parseDuration,
    resolveMediaSource,
    normalizeService,
    getServices,
    setServices,
    getSettings,
    setSettings,
    normalizePortfolioItem,
    getPortfolio,
    setPortfolio,
    normalizeTestimonial,
    getTestimonials,
    setTestimonials,
    getAvailability,
    setAvailability,
    timeToMinutes,
    minutesToTime,
    addMinutes,
    toLocalISO,
    parseISODate,
    todayISO,
    formatDate,
    dateTimeValue,
    makeCode,
    normalizePhone,
    formatPhone,
    getServiceById,
    normalizeBooking,
    getBookings,
    setBookings,
    upsertBooking,
    deleteBooking,
    getBlocks,
    setBlocks,
    intervalsOverlap,
    isInsideWorkingPeriod,
    normalizeProfessional,
    findBookingConflicts,
    getConflict,
    isPastLeadTime,
    isSlotAvailable,
    generateSlots,
    reserveBooking,
    confirmBooking,
    canClientCancel,
    statusLabel,
    downloadFile,
    exportBookingsCSV,
    getBackup,
    restoreBackup
  };
})();
