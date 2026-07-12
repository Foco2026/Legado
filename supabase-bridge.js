(() => {
  "use strict";

  const config = window.LEGADO_SUPABASE;
  const L = window.Legado;
  if (!config?.url || !config?.anonKey || !L) return;

  const apiBase = config.url.replace(/\/$/, "") + "/rest/v1";
  const authBase = config.url.replace(/\/$/, "") + "/auth/v1";
  const SESSION_KEY = "legadoSupabaseSession";
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  let syncingFromSupabase = false;
  let refreshingSession = null;
  let connectionState = { status: "checking", message: "Verificando conexão com o Supabase...", error: "" };

  const original = {
    setSettings: L.setSettings,
    setServices: L.setServices,
    setAvailability: L.setAvailability,
    setBlocks: L.setBlocks,
    setPortfolio: L.setPortfolio,
    setTestimonials: L.setTestimonials,
    setClients: L.setClients,
    upsertClient: L.upsertClient,
    setBookings: L.setBookings,
    upsertBooking: L.upsertBooking,
    deleteBooking: L.deleteBooking,
    reserveBooking: L.reserveBooking,
    confirmBooking: L.confirmBooking,
    restoreBackup: L.restoreBackup
  };

  function setConnectionState(status, message, error = "") {
    connectionState = { status, message, error, updatedAt: new Date().toISOString() };
    window.dispatchEvent(new CustomEvent("legado:supabase-status", { detail: connectionState }));
  }

  function getConnectionState() {
    return { ...connectionState };
  }

  function readSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
  }

  function saveSession(session, persist = false) {
    if (!session) return;
    const target = persist ? localStorage : sessionStorage;
    target.setItem(SESSION_KEY, JSON.stringify(session));
    if (persist) sessionStorage.removeItem(SESSION_KEY);
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  }

  function accessToken() {
    return readSession()?.access_token || "";
  }

  function headers(extra = {}, includeSession = true) {
    const result = {
      apikey: config.anonKey,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...extra
    };
    const token = includeSession ? accessToken() : "";
    if (token) result.Authorization = `Bearer ${token}`;
    return result;
  }

  function stableUuid(value) {
    const text = String(value || "");
    if (uuidPattern.test(text)) return text;
    let hash1 = 2166136261;
    let hash2 = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash1 ^= text.charCodeAt(index);
      hash1 = Math.imul(hash1, 16777619);
      hash2 ^= text.charCodeAt(text.length - 1 - index);
      hash2 = Math.imul(hash2, 16777619);
    }
    const hex = `${(hash1 >>> 0).toString(16).padStart(8, "0")}${(hash2 >>> 0).toString(16).padStart(8, "0")}${Math.abs(text.length * 2654435761 >>> 0).toString(16).padStart(8, "0")}${Math.abs((hash1 ^ hash2) >>> 0).toString(16).padStart(8, "0")}`.slice(0, 32);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  }

  function cleanTime(value) {
    return String(value || "00:00").slice(0, 5);
  }

  function writeLocal(key, value) {
    syncingFromSupabase = true;
    try {
      localStorage.setItem(key, JSON.stringify(value));
      window.dispatchEvent(new CustomEvent("legado:datachange", { detail: { key, source: "supabase" } }));
    } finally {
      syncingFromSupabase = false;
    }
  }

  async function parseError(response, fallback) {
    const raw = await response.text().catch(() => "");
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw);
      return parsed.message || parsed.error_description || parsed.error || parsed.details || raw;
    } catch {
      return raw;
    }
  }

  async function refreshAccessToken() {
    const session = readSession();
    if (!session?.refresh_token) return false;
    if (refreshingSession) return refreshingSession;
    refreshingSession = (async () => {
      const response = await fetch(`${authBase}/token?grant_type=refresh_token`, {
        method: "POST",
        headers: headers({}, false),
        body: JSON.stringify({ refresh_token: session.refresh_token })
      });
      if (!response.ok) {
        clearSession();
        return false;
      }
      const nextSession = await response.json();
      saveSession(nextSession, Boolean(localStorage.getItem(SESSION_KEY)));
      return true;
    })().finally(() => { refreshingSession = null; });
    return refreshingSession;
  }

  async function request(path, options = {}, allowRefresh = true) {
    let response;
    try {
      response = await fetch(`${apiBase}/${path}`, { ...options, headers: headers(options.headers) });
    } catch (error) {
      setConnectionState("offline", "Não foi possível alcançar o Supabase.", error.message);
      throw new Error(`Falha de rede ao acessar o Supabase: ${error.message}`);
    }

    if (response.status === 401 && allowRefresh && readSession()?.refresh_token) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return request(path, options, false);
    }

    if (!response.ok) {
      const detail = await parseError(response, path);
      const error = new Error(`Supabase ${response.status}: ${detail}`);
      error.status = response.status;
      error.detail = detail;
      setConnectionState("error", "O Supabase respondeu com erro.", error.message);
      throw error;
    }

    setConnectionState("connected", accessToken() ? "Supabase conectado e autenticado." : "Supabase conectado.");
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async function rpc(name, params = {}, options = {}) {
    return request(`rpc/${name}`, {
      method: "POST",
      headers: { Prefer: options.prefer || "return=representation" },
      body: JSON.stringify(params)
    });
  }

  async function insert(table, rows, uuidId = false) {
    const list = (Array.isArray(rows) ? rows : [rows]).filter(Boolean);
    if (!list.length) return [];
    const body = list.map(row => uuidId && row.id ? { ...row, id: stableUuid(row.id) } : row);
    return request(table, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(body)
    });
  }

  async function upsert(table, rows, uuidId = false, conflict = "id") {
    const list = (Array.isArray(rows) ? rows : [rows]).filter(Boolean);
    if (!list.length) return [];
    const body = list.map(row => uuidId && row.id ? { ...row, id: stableUuid(row.id) } : row);
    return request(`${table}?on_conflict=${encodeURIComponent(conflict)}`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(body)
    });
  }

  async function removeRows(table, ids, uuidId = false) {
    const list = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
    await Promise.all(list.map(id => request(`${table}?id=eq.${encodeURIComponent(uuidId ? stableUuid(id) : id)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" }
    })));
  }

  function syncQuietly(work) {
    if (syncingFromSupabase || !accessToken()) return;
    Promise.resolve().then(work).catch(error => {
      console.warn("Legado Supabase:", error.message);
      setConnectionState("error", "Uma alteração ficou salva somente neste navegador.", error.message);
    });
  }

  function serviceRow(service, index = 0) {
    const item = L.normalizeService(service, index);
    return { id: item.id, name: item.name, description: item.description, duration_minutes: item.durationMinutes, price: item.price, icon: item.icon, active: item.active, sort_order: index + 1 };
  }

  function settingsRow(settings) {
    return { id: "main", data: { ...L.getSettings(), ...(settings || {}) }, updated_at: new Date().toISOString() };
  }

  function availabilityRow(value) {
    return { id: "main", data: L.getAvailability(value), updated_at: new Date().toISOString() };
  }

  function blockRow(block) {
    const item = { ...block };
    return { id: stableUuid(item.id), date: item.date, all_day: Boolean(item.allDay), start_time: item.startTime || "00:00", end_time: item.endTime || "23:59", reason: item.reason || "Horário bloqueado", created_at: item.createdAt || new Date().toISOString() };
  }

  function bookingRow(booking) {
    const item = L.normalizeBooking(booking);
    return {
      id: stableUuid(item.id),
      code: item.code,
      service_id: item.serviceId || null,
      service_name: item.service,
      duration_minutes: item.durationMinutes,
      price_value: item.priceValue,
      booking_date: item.date,
      start_time: item.startTime,
      end_time: item.endTime,
      client_name: item.name,
      client_phone: item.phone,
      phone_digits: item.phoneDigits,
      client_photo: item.clientPhoto || "",
      professional: item.professional,
      notes: item.notes,
      status: item.status,
      source: item.source,
      cancellation_reason: item.cancellationReason || null,
      created_at: item.createdAt,
      updated_at: item.updatedAt || new Date().toISOString()
    };
  }

  function clientRow(client) {
    const item = L.normalizeClient(client);
    return {
      id: stableUuid(item.id || item.phoneDigits),
      client_name: item.name,
      client_phone: item.phone,
      phone_digits: item.phoneDigits,
      profile_photo: item.photo || "",
      notes: item.notes || "",
      first_seen_at: item.firstSeenAt || new Date().toISOString(),
      last_seen_at: item.lastSeenAt || new Date().toISOString(),
      created_at: item.createdAt || new Date().toISOString(),
      updated_at: item.updatedAt || new Date().toISOString()
    };
  }

  function portfolioRow(item, index = 0) {
    const normalized = L.normalizePortfolioItem(item, index);
    return { id: stableUuid(normalized.id), title: normalized.title, category: normalized.category, description: normalized.description || normalized.summary, image_url: normalized.image, alt_text: normalized.alt, featured: normalized.featured, active: normalized.active, sort_order: normalized.order || index + 1, created_at: normalized.createdAt || new Date().toISOString(), updated_at: new Date().toISOString() };
  }

  function testimonialRow(item, index = 0) {
    const normalized = L.normalizeTestimonial(item, index);
    return { id: stableUuid(normalized.id), client_name: normalized.name, client_phone: normalized.phone || "", phone_digits: normalized.phoneDigits || "", service_name: normalized.service, testimonial: normalized.text, rating: normalized.rating, profile_photo: normalized.photo || "", status: normalized.status || "pending", active: normalized.active, source: normalized.source || "admin", sort_order: normalized.order || index + 1, created_at: normalized.createdAt || new Date().toISOString(), updated_at: normalized.updatedAt || new Date().toISOString() };
  }

  function mapService(row) {
    return L.normalizeService({ id: row.id, name: row.name, description: row.description, durationMinutes: row.duration_minutes, price: row.price, icon: row.icon, active: row.active });
  }

  function mapBlock(row) {
    return { id: row.id, date: row.date, allDay: row.all_day, startTime: cleanTime(row.start_time), endTime: cleanTime(row.end_time), reason: row.reason, createdAt: row.created_at };
  }

  function mapBooking(row) {
    return L.normalizeBooking({
      id: row.id,
      code: row.code,
      serviceId: row.service_id,
      service: row.service_name,
      durationMinutes: row.duration_minutes,
      priceValue: row.price_value,
      date: row.booking_date,
      startTime: cleanTime(row.start_time),
      time: cleanTime(row.start_time),
      endTime: cleanTime(row.end_time),
      name: row.client_name,
      phone: row.client_phone,
      phoneDigits: row.phone_digits,
      clientPhoto: row.client_photo,
      professional: row.professional,
      notes: row.notes,
      status: row.status,
      source: row.source,
      cancellationReason: row.cancellation_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  function mapClient(row, index = 0) {
    return L.normalizeClient({ id: row.id || row.phone_digits || `client-${index}`, name: row.client_name, phone: row.client_phone, phoneDigits: row.phone_digits, photo: row.profile_photo, notes: row.notes, firstSeenAt: row.first_seen_at, lastSeenAt: row.last_seen_at, createdAt: row.created_at, updatedAt: row.updated_at }, index);
  }

  function mapPortfolio(row, index = 0) {
    return L.normalizePortfolioItem({ id: row.id, title: row.title, category: row.category, summary: row.description, description: row.description, image: row.image_url, images: [row.image_url].filter(Boolean), alt: row.alt_text, featured: row.featured, active: row.active, order: row.sort_order || index + 1, createdAt: row.created_at }, index);
  }

  function mapTestimonial(row, index = 0) {
    return L.normalizeTestimonial({ id: row.id, name: row.client_name, phone: row.client_phone, phoneDigits: row.phone_digits, service: row.service_name, text: row.testimonial, rating: row.rating, photo: row.profile_photo, status: row.status, active: row.active, source: row.source, order: row.sort_order || index + 1, createdAt: row.created_at, updatedAt: row.updated_at }, index);
  }

  async function signIn(email, password, persist = false) {
    try {
      const response = await fetch(`${authBase}/token?grant_type=password`, {
        method: "POST",
        headers: headers({}, false),
        body: JSON.stringify({ email, password })
      });
      if (!response.ok) return { ok: false, error: await parseError(response, "Login recusado") };
      const session = await response.json();
      saveSession(session, persist);
      await hydrateFromSupabase();
      setConnectionState("connected", "Supabase conectado e autenticado.");
      return { ok: true, session };
    } catch (error) {
      setConnectionState("offline", "Não foi possível entrar no Supabase.", error.message);
      return { ok: false, error: error.message };
    }
  }

  async function signOut() {
    const token = accessToken();
    if (token) {
      fetch(`${authBase}/logout`, { method: "POST", headers: headers() }).catch(() => {});
    }
    clearSession();
    setConnectionState("connected", "Supabase conectado. Faça login para administrar.");
  }

  async function hydrateFromSupabase() {
    const publicLoads = [
      ["settings", () => request("business_settings?select=data&id=eq.main&limit=1")],
      ["availability", () => request("availability?select=data&id=eq.main&limit=1")],
      ["services", () => request("services?select=*&order=sort_order.asc,name.asc")],
      ["portfolio", () => request("portfolio?select=*&active=eq.true&order=sort_order.asc,created_at.desc")],
      ["testimonials", () => request("testimonials?select=*&active=eq.true&status=eq.approved&order=sort_order.asc,created_at.desc")]
    ];

    const results = await Promise.allSettled(publicLoads.map(([, loader]) => loader()));
    const loaded = {};
    results.forEach((result, index) => {
      const name = publicLoads[index][0];
      if (result.status === "fulfilled") loaded[name] = result.value || [];
      else console.warn(`Legado Supabase (${name}):`, result.reason?.message || result.reason);
    });

    if (loaded.settings?.[0]?.data && Object.keys(loaded.settings[0].data).length) writeLocal(L.KEYS.settings, loaded.settings[0].data);
    if (loaded.availability?.[0]?.data && Object.keys(loaded.availability[0].data).length) writeLocal(L.KEYS.availability, loaded.availability[0].data);
    if (loaded.services?.length) writeLocal(L.KEYS.services, loaded.services.map(mapService));
    if (Array.isArray(loaded.portfolio)) writeLocal(L.KEYS.portfolio, loaded.portfolio.map(mapPortfolio));
    if (Array.isArray(loaded.testimonials)) writeLocal(L.KEYS.testimonials, loaded.testimonials.map(mapTestimonial));

    if (accessToken()) {
      const privateLoads = await Promise.all([
        request("blocked_slots?select=*&order=date.asc,start_time.asc"),
        request("bookings?select=*&order=booking_date.asc,start_time.asc"),
        request("clients?select=*&order=updated_at.desc"),
        request("testimonials?select=*&order=created_at.desc")
      ]);
      writeLocal(L.KEYS.blocks, privateLoads[0].map(mapBlock));
      writeLocal(L.KEYS.bookings, privateLoads[1].map(mapBooking));
      writeLocal(L.KEYS.clients, privateLoads[2].map(mapClient));
      writeLocal(L.KEYS.testimonials, privateLoads[3].map(mapTestimonial));
    }

    setConnectionState("connected", accessToken() ? "Supabase conectado e autenticado." : "Supabase conectado.");
    return loaded;
  }

  async function testConnection() {
    try {
      await request("business_settings?select=id&limit=1");
      return { ok: true, state: getConnectionState() };
    } catch (error) {
      return { ok: false, error: error.message, state: getConnectionState() };
    }
  }

  async function getBookedIntervals(date, professional = "") {
    const rows = await rpc("booked_intervals", { p_date: date, p_professional: professional || null });
    return (rows || []).map(row => ({
      startTime: cleanTime(row.start_time),
      endTime: cleanTime(row.end_time),
      professional: row.professional || professional
    }));
  }

  async function createBooking(booking) {
    const localCandidate = L.normalizeBooking({ ...booking, id: stableUuid(booking.id), status: "pending" });
    try {
      const rows = await rpc("create_booking", { p_booking: bookingRow(localCandidate) });
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row) return { ok: false, reason: "connection", error: "O Supabase não retornou o agendamento criado." };
      const saved = mapBooking(row);
      original.upsertBooking(saved);
      original.upsertClient({ name: saved.name, phone: saved.phone, phoneDigits: saved.phoneDigits, photo: saved.clientPhoto });
      return { ok: true, booking: saved };
    } catch (error) {
      const detail = `${error.detail || ""} ${error.message || ""}`;
      if (/SLOT_UNAVAILABLE|overlap|conflict|exclusion/i.test(detail)) return { ok: false, reason: "conflict", error: error.message };
      return { ok: false, reason: "connection", error: error.message };
    }
  }

  async function lookupBooking(phone, code) {
    const rows = await rpc("lookup_booking", {
      p_phone_digits: L.normalizePhone(phone),
      p_code: String(code || "").trim().toUpperCase()
    });
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) return null;
    const booking = mapBooking(row);
    original.upsertBooking(booking);
    return booking;
  }

  async function cancelBooking(phone, code) {
    const rows = await rpc("cancel_booking", {
      p_phone_digits: L.normalizePhone(phone),
      p_code: String(code || "").trim().toUpperCase()
    });
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) return { ok: false, reason: "not_found" };
    const booking = mapBooking(row);
    original.upsertBooking(booking);
    return { ok: true, booking };
  }

  async function saveClientProfile(client) {
    const rows = await rpc("save_client_profile", { p_client: clientRow(client) });
    const row = Array.isArray(rows) ? rows[0] : rows;
    const saved = row ? mapClient(row) : L.normalizeClient(client);
    original.upsertClient(saved);
    return saved;
  }

  async function submitTestimonial(item) {
    const rows = await rpc("submit_testimonial", { p_testimonial: testimonialRow(item) });
    const row = Array.isArray(rows) ? rows[0] : rows;
    return row ? mapTestimonial(row) : L.normalizeTestimonial(item);
  }

  L.setSettings = function setSettings(settings) {
    original.setSettings(settings);
    syncQuietly(() => upsert("business_settings", settingsRow(settings)));
  };

  L.setAvailability = function setAvailability(value) {
    original.setAvailability(value);
    syncQuietly(() => upsert("availability", availabilityRow(value)));
  };

  L.setServices = function setServices(services) {
    const before = L.getServices(true).map(item => item.id);
    original.setServices(services);
    const after = L.getServices(true);
    const afterIds = new Set(after.map(item => item.id));
    syncQuietly(async () => {
      await upsert("services", after.map(serviceRow));
      await removeRows("services", before.filter(id => !afterIds.has(id)));
    });
  };

  L.setBlocks = function setBlocks(blocks) {
    const before = L.getBlocks().map(item => item.id);
    original.setBlocks(blocks);
    const after = L.getBlocks();
    const afterIds = new Set(after.map(item => item.id));
    syncQuietly(async () => {
      await upsert("blocked_slots", after.map(blockRow));
      await removeRows("blocked_slots", before.filter(id => !afterIds.has(id)), true);
    });
  };

  L.setPortfolio = function setPortfolio(items) {
    const before = L.getPortfolio(true).map(item => item.id);
    original.setPortfolio(items);
    const after = L.getPortfolio(true);
    const afterIds = new Set(after.map(item => item.id));
    syncQuietly(async () => {
      await upsert("portfolio", after.map(portfolioRow), true);
      await removeRows("portfolio", before.filter(id => !afterIds.has(id)), true);
    });
  };

  L.setTestimonials = function setTestimonials(items) {
    const before = L.getTestimonials(true).map(item => item.id);
    original.setTestimonials(items);
    const after = L.getTestimonials(true);
    syncQuietly(async () => {
      await upsert("testimonials", after.map(testimonialRow), true);
      const afterIds = new Set(after.map(item => item.id));
      await removeRows("testimonials", before.filter(id => !afterIds.has(id)), true);
    });
  };

  L.setClients = function setClients(clients) {
    original.setClients(clients);
    syncQuietly(() => upsert("clients", L.getClients().map(clientRow), true));
  };

  L.upsertClient = function upsertClient(client) {
    const saved = original.upsertClient(client);
    syncQuietly(() => upsert("clients", clientRow(saved), true));
    return saved;
  };

  L.setBookings = function setBookings(bookings) {
    original.setBookings(bookings);
    syncQuietly(() => upsert("bookings", L.getBookings().map(bookingRow), true));
  };

  L.upsertBooking = function upsertBooking(booking) {
    const saved = original.upsertBooking(booking);
    syncQuietly(async () => {
      await upsert("bookings", bookingRow(saved), true);
      await upsert("clients", clientRow({ name: saved.name, phone: saved.phone, phoneDigits: saved.phoneDigits, photo: saved.clientPhoto }), true);
    });
    return saved;
  };

  L.deleteBooking = function deleteBooking(id) {
    original.deleteBooking(id);
    syncQuietly(() => removeRows("bookings", id, true));
  };

  L.reserveBooking = function reserveBooking(booking) {
    const result = original.reserveBooking(booking);
    if (result.ok) syncQuietly(async () => {
      await upsert("bookings", bookingRow(result.booking), true);
      await upsert("clients", clientRow({ name: result.booking.name, phone: result.booking.phone, phoneDigits: result.booking.phoneDigits, photo: result.booking.clientPhoto }), true);
    });
    return result;
  };

  L.confirmBooking = function confirmBooking(id, options = {}) {
    const result = original.confirmBooking(id, options);
    if (result.ok) syncQuietly(async () => {
      await upsert("bookings", bookingRow(result.booking), true);
      if (result.cancelledConflicts?.length) {
        const current = L.getBookings().filter(item => result.cancelledConflicts.some(conflict => String(conflict.id) === String(item.id)));
        await upsert("bookings", current.map(bookingRow), true);
      }
    });
    return result;
  };

  L.restoreBackup = function restoreBackup(data) {
    original.restoreBackup(data);
    syncQuietly(async () => {
      await upsert("business_settings", settingsRow(L.getSettings()));
      await upsert("availability", availabilityRow(L.getAvailability()));
      await upsert("services", L.getServices(true).map(serviceRow));
      await upsert("blocked_slots", L.getBlocks().map(blockRow));
      await upsert("bookings", L.getBookings().map(bookingRow), true);
      await upsert("clients", L.getClients().map(clientRow), true);
      await upsert("portfolio", L.getPortfolio(true).map(portfolioRow), true);
      await upsert("testimonials", L.getTestimonials(true).map(testimonialRow), true);
    });
  };

  window.LegadoSupabase = {
    hydrateFromSupabase,
    testConnection,
    signIn,
    signOut,
    accessToken,
    readSession,
    getConnectionState,
    stableUuid,
    getBookedIntervals,
    createBooking,
    lookupBooking,
    cancelBooking,
    saveClientProfile,
    submitTestimonial
  };

  hydrateFromSupabase().catch(error => {
    console.warn("Legado Supabase:", error.message);
    setConnectionState("error", "Não foi possível carregar os dados do Supabase.", error.message);
  });
})();
