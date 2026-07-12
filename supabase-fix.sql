-- Legado Barbearia — estrutura completa para Supabase
-- Execute no SQL Editor. O script pode ser executado novamente com segurança.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null default 'admin' check (role in ('owner','admin','barber')),
  created_at timestamptz not null default now()
);

create table if not exists public.business_settings (
  id text primary key default 'main',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id text primary key,
  name text not null,
  description text not null default '',
  duration_minutes integer not null check (duration_minutes >= 5),
  price numeric(10,2) not null default 0,
  icon text not null default 'corte.webp',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.availability (
  id text primary key default 'main',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.blocked_slots (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  all_day boolean not null default false,
  start_time time,
  end_time time,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  service_id text references public.services(id) on delete set null,
  service_name text not null,
  duration_minutes integer not null,
  price_value numeric(10,2) not null default 0,
  booking_date date not null,
  start_time time not null,
  end_time time not null,
  client_name text not null,
  client_phone text not null,
  phone_digits text not null,
  client_photo text not null default '',
  professional text not null,
  notes text not null default '',
  status text not null default 'pending' check (status in ('pending','confirmed','completed','cancelled','no_show')),
  source text not null default 'site',
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bookings_schedule_idx on public.bookings (booking_date, start_time, end_time);
create index if not exists bookings_phone_code_idx on public.bookings (phone_digits, code);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  client_phone text not null,
  phone_digits text not null unique,
  profile_photo text not null default '',
  notes text not null default '',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portfolio (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'Cortes',
  description text not null default '',
  image_url text not null,
  alt_text text not null default '',
  featured boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  client_phone text not null default '',
  phone_digits text not null default '',
  service_name text not null default 'Atendimento Legado',
  testimonial text not null,
  rating integer not null default 5 check (rating between 1 and 5),
  profile_photo text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  active boolean not null default false,
  source text not null default 'admin',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Compatibilidade com instalações anteriores.
alter table public.bookings add column if not exists client_photo text not null default '';
alter table public.testimonials add column if not exists client_phone text not null default '';
alter table public.testimonials add column if not exists phone_digits text not null default '';
alter table public.testimonials add column if not exists profile_photo text not null default '';
alter table public.testimonials add column if not exists status text not null default 'pending';
alter table public.testimonials add column if not exists source text not null default 'admin';

-- Proteção adicional contra sobreposição real de atendimentos ativos.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_no_active_overlap') then
    alter table public.bookings
      add constraint bookings_no_active_overlap
      exclude using gist (
        lower(professional) with =,
        tsrange(booking_date + start_time, booking_date + end_time, '[)') with &&
      )
      where (status in ('pending','confirmed'));
  end if;
exception
  when others then
    raise notice 'A restrição de sobreposição não foi criada. Verifique se já existem horários conflitantes: %', sqlerrm;
end $$;

alter table public.profiles enable row level security;
alter table public.business_settings enable row level security;
alter table public.services enable row level security;
alter table public.availability enable row level security;
alter table public.blocked_slots enable row level security;
alter table public.bookings enable row level security;
alter table public.clients enable row level security;
alter table public.portfolio enable row level security;
alter table public.testimonials enable row level security;

-- Torna a criação das políticas idempotente.
drop policy if exists "public read settings" on public.business_settings;
drop policy if exists "public read active services" on public.services;
drop policy if exists "public read availability" on public.availability;
drop policy if exists "public read active portfolio" on public.portfolio;
drop policy if exists "public read active testimonials" on public.testimonials;
drop policy if exists "admins manage settings" on public.business_settings;
drop policy if exists "admins manage services" on public.services;
drop policy if exists "admins manage availability" on public.availability;
drop policy if exists "admins manage blocks" on public.blocked_slots;
drop policy if exists "admins manage bookings" on public.bookings;
drop policy if exists "admins manage clients" on public.clients;
drop policy if exists "admins manage portfolio" on public.portfolio;
drop policy if exists "admins manage testimonials" on public.testimonials;
drop policy if exists "users read own profile" on public.profiles;
drop policy if exists "public create pending booking" on public.bookings;
drop policy if exists "public create client profile" on public.clients;
drop policy if exists "public create pending testimonial" on public.testimonials;

create policy "public read settings" on public.business_settings
for select to anon, authenticated using (true);

create policy "public read active services" on public.services
for select to anon, authenticated using (active = true or auth.role() = 'authenticated');

create policy "public read availability" on public.availability
for select to anon, authenticated using (true);

create policy "public read active portfolio" on public.portfolio
for select to anon, authenticated using (active = true or auth.role() = 'authenticated');

create policy "public read active testimonials" on public.testimonials
for select to anon, authenticated using ((active = true and status = 'approved') or auth.role() = 'authenticated');

create policy "admins manage settings" on public.business_settings for all to authenticated using (true) with check (true);
create policy "admins manage services" on public.services for all to authenticated using (true) with check (true);
create policy "admins manage availability" on public.availability for all to authenticated using (true) with check (true);
create policy "admins manage blocks" on public.blocked_slots for all to authenticated using (true) with check (true);
create policy "admins manage bookings" on public.bookings for all to authenticated using (true) with check (true);
create policy "admins manage clients" on public.clients for all to authenticated using (true) with check (true);
create policy "admins manage portfolio" on public.portfolio for all to authenticated using (true) with check (true);
create policy "admins manage testimonials" on public.testimonials for all to authenticated using (true) with check (true);
create policy "users read own profile" on public.profiles for select to authenticated using (auth.uid() = id);

-- Intervalos ocupados sem expor dados pessoais.
drop function if exists public.booked_intervals(date);
drop function if exists public.booked_intervals(date, text);
create function public.booked_intervals(p_date date, p_professional text default null)
returns table (start_time time, end_time time, professional text)
language sql
security definer
set search_path = public, pg_temp
as $$
  select b.start_time, b.end_time, b.professional
  from public.bookings b
  where b.booking_date = p_date
    and b.status in ('pending','confirmed')
    and (p_professional is null or lower(b.professional) = lower(p_professional))
  union all
  select
    case when s.all_day then time '00:00' else coalesce(s.start_time, time '00:00') end,
    case when s.all_day then time '23:59:59' else coalesce(s.end_time, time '23:59:59') end,
    coalesce(p_professional, '')
  from public.blocked_slots s
  where s.date = p_date;
$$;

-- Criação pública segura e atômica do agendamento.
drop function if exists public.create_booking(jsonb);
create function public.create_booking(p_booking jsonb)
returns setof public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := coalesce(nullif(p_booking->>'id', '')::uuid, gen_random_uuid());
  v_code text := upper(trim(coalesce(p_booking->>'code', '')));
  v_phone_digits text := regexp_replace(coalesce(p_booking->>'phone_digits', p_booking->>'client_phone', ''), '\D', '', 'g');
  v_date date := (p_booking->>'booking_date')::date;
  v_start time := (p_booking->>'start_time')::time;
  v_end time := (p_booking->>'end_time')::time;
  v_professional text := trim(coalesce(p_booking->>'professional', ''));
  v_buffer integer := 0;
  v_lead integer := 0;
  v_service_id text;
begin
  if char_length(v_code) < 4 then raise exception 'INVALID_CODE'; end if;
  if char_length(v_phone_digits) not between 10 and 13 then raise exception 'INVALID_PHONE'; end if;
  if char_length(trim(coalesce(p_booking->>'client_name', ''))) < 2 then raise exception 'INVALID_NAME'; end if;
  if v_professional = '' then raise exception 'INVALID_PROFESSIONAL'; end if;
  if v_end <= v_start then raise exception 'INVALID_TIME'; end if;

  select
    coalesce((data->>'bufferMinutes')::integer, 0),
    coalesce((data->>'minimumLeadMinutes')::integer, 0)
    into v_buffer, v_lead
  from public.availability
  where id = 'main';
  v_buffer := coalesce(v_buffer, 0);
  v_lead := coalesce(v_lead, 0);

  if (v_date + v_start) < timezone('America/Sao_Paulo', now()) + make_interval(mins => v_lead) then
    raise exception 'TOO_SOON';
  end if;

  if exists (
    select 1
    from public.blocked_slots s
    where s.date = v_date
      and (
        s.all_day
        or tsrange(
          v_date + coalesce(s.start_time, time '00:00'),
          v_date + coalesce(s.end_time, time '23:59:59'),
          '[)'
        ) && tsrange(
          v_date + v_start,
          v_date + v_end + make_interval(mins => v_buffer),
          '[)'
        )
      )
  ) then
    raise exception 'SLOT_UNAVAILABLE';
  end if;

  if exists (
    select 1
    from public.bookings b
    where b.booking_date = v_date
      and b.status in ('pending','confirmed')
      and lower(b.professional) = lower(v_professional)
      and tsrange(
        b.booking_date + b.start_time,
        b.booking_date + b.end_time + make_interval(mins => v_buffer),
        '[)'
      ) && tsrange(
        v_date + v_start,
        v_date + v_end + make_interval(mins => v_buffer),
        '[)'
      )
  ) then
    raise exception 'SLOT_UNAVAILABLE';
  end if;

  select s.id into v_service_id
  from public.services s
  where s.id = nullif(p_booking->>'service_id', '')
  limit 1;

  insert into public.bookings (
    id, code, service_id, service_name, duration_minutes, price_value,
    booking_date, start_time, end_time, client_name, client_phone,
    phone_digits, client_photo, professional, notes, status, source,
    cancellation_reason, created_at, updated_at
  ) values (
    v_id,
    v_code,
    v_service_id,
    coalesce(nullif(p_booking->>'service_name', ''), 'Atendimento Legado'),
    greatest(5, coalesce((p_booking->>'duration_minutes')::integer, 30)),
    greatest(0, coalesce((p_booking->>'price_value')::numeric, 0)),
    v_date,
    v_start,
    v_end,
    trim(p_booking->>'client_name'),
    coalesce(p_booking->>'client_phone', v_phone_digits),
    v_phone_digits,
    coalesce(p_booking->>'client_photo', ''),
    v_professional,
    coalesce(p_booking->>'notes', ''),
    'pending',
    'site',
    null,
    now(),
    now()
  );

  insert into public.clients (
    id, client_name, client_phone, phone_digits, profile_photo,
    notes, first_seen_at, last_seen_at, created_at, updated_at
  ) values (
    gen_random_uuid(),
    trim(p_booking->>'client_name'),
    coalesce(p_booking->>'client_phone', v_phone_digits),
    v_phone_digits,
    coalesce(p_booking->>'client_photo', ''),
    '',
    now(), now(), now(), now()
  )
  on conflict (phone_digits) do update set
    client_name = excluded.client_name,
    client_phone = excluded.client_phone,
    profile_photo = case when excluded.profile_photo <> '' then excluded.profile_photo else public.clients.profile_photo end,
    last_seen_at = now(),
    updated_at = now();

  return query select b.* from public.bookings b where b.id = v_id;
end;
$$;

-- Consulta segura por telefone e código.
drop function if exists public.lookup_booking(text, text);
create function public.lookup_booking(p_phone_digits text, p_code text)
returns setof public.bookings
language sql
security definer
set search_path = public, pg_temp
as $$
  select b.*
  from public.bookings b
  where b.phone_digits = regexp_replace(p_phone_digits, '\D', '', 'g')
    and upper(b.code) = upper(trim(p_code))
  limit 1;
$$;

-- Cancelamento seguro pelo mesmo telefone e código.
drop function if exists public.cancel_booking(text, text);
create function public.cancel_booking(p_phone_digits text, p_code text)
returns setof public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_deadline integer := 0;
begin
  select coalesce((data->>'cancellationDeadlineMinutes')::integer, 0)
    into v_deadline
  from public.availability
  where id = 'main';
  v_deadline := coalesce(v_deadline, 0);

  select b.id into v_id
  from public.bookings b
  where b.phone_digits = regexp_replace(p_phone_digits, '\D', '', 'g')
    and upper(b.code) = upper(trim(p_code))
    and b.status in ('pending','confirmed')
    and (b.booking_date + b.start_time) >= timezone('America/Sao_Paulo', now()) + make_interval(mins => v_deadline)
  limit 1;

  if v_id is null then return; end if;

  update public.bookings
  set status = 'cancelled', cancellation_reason = 'Cancelado pelo cliente', updated_at = now()
  where id = v_id;

  return query select b.* from public.bookings b where b.id = v_id;
end;
$$;

-- Cadastro simples do cliente usado no site público.
drop function if exists public.save_client_profile(jsonb);
create function public.save_client_profile(p_client jsonb)
returns setof public.clients
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phone_digits text := regexp_replace(coalesce(p_client->>'phone_digits', p_client->>'client_phone', ''), '\D', '', 'g');
begin
  if char_length(v_phone_digits) not between 10 and 13 then raise exception 'INVALID_PHONE'; end if;
  if char_length(trim(coalesce(p_client->>'client_name', ''))) < 2 then raise exception 'INVALID_NAME'; end if;

  insert into public.clients (
    id, client_name, client_phone, phone_digits, profile_photo, notes,
    first_seen_at, last_seen_at, created_at, updated_at
  ) values (
    gen_random_uuid(),
    trim(p_client->>'client_name'),
    coalesce(p_client->>'client_phone', v_phone_digits),
    v_phone_digits,
    coalesce(p_client->>'profile_photo', ''),
    coalesce(p_client->>'notes', ''),
    now(), now(), now(), now()
  )
  on conflict (phone_digits) do update set
    client_name = excluded.client_name,
    client_phone = excluded.client_phone,
    profile_photo = excluded.profile_photo,
    notes = excluded.notes,
    last_seen_at = now(),
    updated_at = now();

  return query select c.* from public.clients c where c.phone_digits = v_phone_digits limit 1;
end;
$$;

-- Envio público de avaliação sempre pendente de aprovação.
drop function if exists public.submit_testimonial(jsonb);
create function public.submit_testimonial(p_testimonial jsonb)
returns setof public.testimonials
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := coalesce(nullif(p_testimonial->>'id', '')::uuid, gen_random_uuid());
  v_phone_digits text := regexp_replace(coalesce(p_testimonial->>'phone_digits', p_testimonial->>'client_phone', ''), '\D', '', 'g');
begin
  if char_length(v_phone_digits) not between 10 and 13 then raise exception 'INVALID_PHONE'; end if;
  if char_length(trim(coalesce(p_testimonial->>'testimonial', ''))) < 8 then raise exception 'INVALID_TESTIMONIAL'; end if;

  insert into public.testimonials (
    id, client_name, client_phone, phone_digits, service_name,
    testimonial, rating, profile_photo, status, active, source,
    sort_order, created_at, updated_at
  ) values (
    v_id,
    trim(p_testimonial->>'client_name'),
    coalesce(p_testimonial->>'client_phone', v_phone_digits),
    v_phone_digits,
    coalesce(nullif(p_testimonial->>'service_name', ''), 'Atendimento Legado'),
    trim(p_testimonial->>'testimonial'),
    least(5, greatest(1, coalesce((p_testimonial->>'rating')::integer, 5))),
    coalesce(p_testimonial->>'profile_photo', ''),
    'pending',
    false,
    'site',
    coalesce((p_testimonial->>'sort_order')::integer, 0),
    now(), now()
  );

  return query select t.* from public.testimonials t where t.id = v_id;
end;
$$;

-- Permissões da API.
grant usage on schema public to anon, authenticated;
revoke all on public.blocked_slots, public.bookings, public.clients from anon;
grant select on public.business_settings, public.services, public.availability, public.portfolio, public.testimonials to anon;
grant all on public.business_settings, public.services, public.availability, public.blocked_slots, public.bookings, public.clients, public.portfolio, public.testimonials to authenticated;
grant select on public.profiles to authenticated;

grant execute on function public.booked_intervals(date, text) to anon, authenticated;
grant execute on function public.create_booking(jsonb) to anon, authenticated;
grant execute on function public.lookup_booking(text, text) to anon, authenticated;
grant execute on function public.cancel_booking(text, text) to anon, authenticated;
grant execute on function public.save_client_profile(jsonb) to anon, authenticated;
grant execute on function public.submit_testimonial(jsonb) to anon, authenticated;

-- Atualiza imediatamente o cache de esquema da API REST.
notify pgrst, 'reload schema';
