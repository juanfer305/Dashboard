-- ============================================
-- Esquema para "Libro" — panel de ingresos, clientes y cuentas de cobro
-- Ejecuta esto en Supabase: Project → SQL Editor → New query
-- ============================================

create table if not exists categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  descripcion text,
  tipo text check (tipo in ('ingreso', 'gasto')),
  created_at timestamptz default now()
);

create table if not exists movimientos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('ingreso', 'gasto')),
  monto numeric not null check (monto >= 0),
  fecha date not null,
  categoria text not null,
  descripcion text,
  created_at timestamptz default now()
);

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  documento text,
  correo text,
  ciudad text,
  created_at timestamptz default now()
);

create table if not exists cuentas_cobro (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete set null,
  fecha date not null,
  descripcion text,
  valor numeric not null check (valor >= 0),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'enviada')),
  pdf_url text,
  created_at timestamptz default now()
);

create table if not exists creditos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete set null,
  fecha date not null,
  monto numeric not null check (monto >= 0),
  pagado numeric not null default 0 check (pagado >= 0),
  saldo_restante numeric not null check (saldo_restante >= 0),
  descripcion text,
  created_at timestamptz default now()
);

-- ============================================
-- Storage bucket
-- Supabase Storage no crea buckets por SQL. Crea uno manualmente en el dashboard:
-- 1) Ve a Storage → Create bucket.
-- 2) Nombre: invoices
-- 3) Public access: enabled (para pruebas iniciales).
-- 4) Si prefieres privacidad, deja el bucket privado y luego genera URLs firmadas desde el navegador.
--
-- Opcional: en Storage → Policies agrega una política de lectura/escritura para el anon key
-- solo durante el desarrollo. En producción conviene usar Auth y restringir el acceso.
-- ============================================

-- ============================================
-- Row Level Security (RLS)
-- Esta app es de un solo usuario (tú) y usa la anon key directo desde el navegador.
-- Para empezar rápido, habilitamos RLS con una política abierta.
-- IMPORTANTE: esto significa que cualquiera con tu anon key (visible en el código del
-- navegador) puede leer/escribir estos datos. Está bien para un proyecto personal,
-- pero si vas a compartir el link o crece el proyecto, deberías agregar autenticación
-- (Supabase Auth) y cambiar las políticas para filtrar por auth.uid().
-- ============================================

alter table movimientos enable row level security;
alter table clientes enable row level security;
alter table cuentas_cobro enable row level security;

create policy "Acceso abierto - movimientos" on movimientos
  for all using (true) with check (true);

create policy "Acceso abierto - clientes" on clientes
  for all using (true) with check (true);

create policy "Acceso abierto - cuentas_cobro" on cuentas_cobro
  for all using (true) with check (true);
