-- Legado Barbearia — estrutura inicial para Supabase
-- Execute no SQL Editor do projeto. Revise as políticas antes de publicar em produção.

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

-- Impede sobreposição de agendamentos ativos do mesmo profissional no banco.
-- Essa é a proteção definitiva quando o site estiver conectado ao Supabase.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_no_active_overlap'
  ) then
    alter table public.bookings
      add constraint bookings_no_active_overlap
      exclude using gist (
        lower(professional) with =,
        tsrange(booking_date + start_time, booking_date + end_time, '[)') with &&
      )
      where (status in ('pending','confirmed'));
  end if;
end $$;

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

alter table public.bookings add column if not exists client_photo text not null default '';
alter table public.testimonials add column if not exists client_phone text not null default '';
alter table public.testimonials add column if not exists phone_digits text not null default '';
alter table public.testimonials add column if not exists profile_photo text not null default '';
alter table public.testimonials add column if not exists status text not null default 'pending';
alter table public.testimonials add column if not exists source text not null default 'admin';

alter table public.profiles enable row level security;
alter table public.business_settings enable row level security;
alter table public.services enable row level security;
alter table public.availability enable row level security;
alter table public.blocked_slots enable row level security;
alter table public.bookings enable row level security;
alter table public.clients enable row level security;
alter table public.portfolio enable row level security;
alter table public.testimonials enable row level security;

-- Leitura pública somente do conteúdo necessário ao site.
create policy "public read settings" on public.business_settings for select to anon, authenticated using (true);
create policy "public read active services" on public.services for select to anon, authenticated using (active = true or auth.role() = 'authenticated');
create policy "public read availability" on public.availability for select to anon, authenticated using (true);
create policy "public read active portfolio" on public.portfolio for select to anon, authenticated using (active = true or auth.role() = 'authenticated');
create policy "public read active testimonials" on public.testimonials for select to anon, authenticated using (active = true and status = 'approved');

-- Administradores autenticados gerenciam todos os dados.
create policy "admins manage settings" on public.business_settings for all to authenticated using (true) with check (true);
create policy "admins manage services" on public.services for all to authenticated using (true) with check (true);
create policy "admins manage availability" on public.availability for all to authenticated using (true) with check (true);
create policy "admins manage blocks" on public.blocked_slots for all to authenticated using (true) with check (true);
create policy "admins manage bookings" on public.bookings for all to authenticated using (true) with check (true);
create policy "admins manage clients" on public.clients for all to authenticated using (true) with check (true);
create policy "admins manage portfolio" on public.portfolio for all to authenticated using (true) with check (true);
create policy "admins manage testimonials" on public.testimonials for all to authenticated using (true) with check (true);
create policy "users read own profile" on public.profiles for select to authenticated using (auth.uid() = id);

-- Criação pública de agendamentos pendentes. Em produção, prefira uma Edge Function
-- ou RPC com validação de conflito, limite de requisições e CAPTCHA.
create policy "public create pending booking" on public.bookings
for insert to anon
with check (status = 'pending' and char_length(phone_digits) between 10 and 13);

create policy "public create client profile" on public.clients
for insert to anon
with check (char_length(phone_digits) between 10 and 13);

create policy "public create pending testimonial" on public.testimonials
for insert to anon
with check (status = 'pending' and active = false and char_length(phone_digits) between 10 and 13);

-- Retorna somente os intervalos ocupados, sem dados pessoais.
create or replace function public.booked_intervals(p_date date)
returns table (start_time time, end_time time)
language sql security definer set search_path = public
as $$
  select b.start_time, b.end_time
  from public.bookings b
  where b.booking_date = p_date and b.status in ('pending','confirmed');
$$;
grant execute on function public.booked_intervals(date) to anon, authenticated;

-- Consulta segura por telefone e código. Não lista agendamentos de terceiros.
create or replace function public.lookup_booking(p_phone_digits text, p_code text)
returns table (
  id uuid, code text, service_name text, booking_date date, start_time time, end_time time,
  professional text, status text, duration_minutes integer, price_value numeric, notes text
)
language sql security definer set search_path = public
as $$
  select b.id, b.code, b.service_name, b.booking_date, b.start_time, b.end_time,
         b.professional, b.status, b.duration_minutes, b.price_value, b.notes
  from public.bookings b
  where b.phone_digits = regexp_replace(p_phone_digits, '\D', '', 'g')
    and upper(b.code) = upper(p_code)
  limit 1;
$$;
grant execute on function public.lookup_booking(text, text) to anon, authenticated;
