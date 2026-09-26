-- =====================================================================
-- Cotizador Sunname · Esquema de base de datos
-- Ejecutar una sola vez en Supabase: SQL Editor > New query > Run
-- =====================================================================

-- ---------- 1. Perfiles y roles ----------
create table if not exists public.perfiles (
  id      uuid primary key references auth.users(id) on delete cascade,
  nombre  text not null default '',
  rol     text not null default 'vendedor' check (rol in ('admin','vendedor')),
  activo  boolean not null default true,
  creado  timestamptz not null default now()
);

-- ¿El usuario actual está activo? ¿Es administración?
create or replace function public.es_activo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.perfiles where id = auth.uid() and activo);
$$;

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.perfiles where id = auth.uid() and activo and rol = 'admin');
$$;

-- Cada usuario nuevo de Authentication recibe su perfil (rol vendedor)
create or replace function public.nuevo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario after insert on auth.users
  for each row execute function public.nuevo_usuario();

-- ---------- 2. Datos del cotizador ----------
create table if not exists public.config (
  id              text primary key,             -- 'parametros'
  datos           jsonb not null default '{}',
  actualizado     timestamptz not null default now(),
  actualizado_por uuid default auth.uid()
);

create table if not exists public.cotizaciones (
  id          text primary key,                 -- folio, p. ej. SUN-2026-0001
  datos       jsonb not null,
  creado_por  uuid default auth.uid() references auth.users(id),
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

create table if not exists public.aprobaciones (
  id     text primary key references public.cotizaciones(id) on delete cascade,
  datos  jsonb not null,
  creado timestamptz not null default now()
);

create table if not exists public.folios (
  anio int primary key,
  n    int not null default 0
);

-- ---------- 3. Folio consecutivo (nunca se repite) ----------
create or replace function public.siguiente_folio() returns text
language plpgsql security definer set search_path = public as $$
declare
  y int := extract(year from (now() at time zone 'America/Mexico_City'));
  v int;
begin
  if not public.es_activo() then
    raise exception 'Sin acceso';
  end if;
  insert into public.folios (anio, n) values (y, 1)
  on conflict (anio) do update set n = public.folios.n + 1
  returning n into v;
  return 'SUN-' || y || '-' || lpad(v::text, 4, '0');
end $$;

-- ---------- 4. Actualizar solo algunos campos de una cotización ----------
create or replace function public.actualizar_cotizacion(p_id text, p_cambios jsonb) returns void
language sql security invoker set search_path = public as $$
  update public.cotizaciones set datos = datos || p_cambios where id = p_id;
$$;

-- ---------- 5. Solo administración puede marcar un descuento como autorizado ----------
create or replace function public.proteger_cotizacion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.datos->>'estado') = 'autorizada'
     and (tg_op = 'INSERT' or coalesce(old.datos->>'estado', '') <> 'autorizada')
     and not public.es_admin() then
    raise exception 'Solo administración puede autorizar descuentos';
  end if;
  new.actualizado := now();
  return new;
end $$;

drop trigger if exists antes_de_guardar on public.cotizaciones;
create trigger antes_de_guardar before insert or update on public.cotizaciones
  for each row execute function public.proteger_cotizacion();

-- ---------- 6. Seguridad por filas (RLS) ----------
alter table public.perfiles     enable row level security;
alter table public.config       enable row level security;
alter table public.cotizaciones enable row level security;
alter table public.aprobaciones enable row level security;
alter table public.folios       enable row level security;   -- sin políticas: solo vía siguiente_folio()

drop policy if exists "perfiles: ver"            on public.perfiles;
drop policy if exists "perfiles: admin edita"    on public.perfiles;
create policy "perfiles: ver"         on public.perfiles for select to authenticated using (public.es_activo());
create policy "perfiles: admin edita" on public.perfiles for update to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists "config: ver"          on public.config;
drop policy if exists "config: admin crea"   on public.config;
drop policy if exists "config: admin edita"  on public.config;
create policy "config: ver"         on public.config for select to authenticated using (public.es_activo());
create policy "config: admin crea"  on public.config for insert to authenticated with check (public.es_admin());
create policy "config: admin edita" on public.config for update to authenticated using (public.es_admin()) with check (public.es_admin());

-- Por ahora todo el equipo ve todas las cotizaciones
drop policy if exists "cotizaciones: ver"          on public.cotizaciones;
drop policy if exists "cotizaciones: crear"        on public.cotizaciones;
drop policy if exists "cotizaciones: editar"       on public.cotizaciones;
drop policy if exists "cotizaciones: admin borra"  on public.cotizaciones;
create policy "cotizaciones: ver"         on public.cotizaciones for select to authenticated using (public.es_activo());
create policy "cotizaciones: crear"       on public.cotizaciones for insert to authenticated with check (public.es_activo());
create policy "cotizaciones: editar"      on public.cotizaciones for update to authenticated using (public.es_activo()) with check (public.es_activo());
create policy "cotizaciones: admin borra" on public.cotizaciones for delete to authenticated using (public.es_admin());

drop policy if exists "aprobaciones: ver"          on public.aprobaciones;
drop policy if exists "aprobaciones: admin crea"   on public.aprobaciones;
drop policy if exists "aprobaciones: admin edita"  on public.aprobaciones;
drop policy if exists "aprobaciones: admin borra"  on public.aprobaciones;
create policy "aprobaciones: ver"         on public.aprobaciones for select to authenticated using (public.es_activo());
create policy "aprobaciones: admin crea"  on public.aprobaciones for insert to authenticated with check (public.es_admin());
create policy "aprobaciones: admin edita" on public.aprobaciones for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "aprobaciones: admin borra" on public.aprobaciones for delete to authenticated using (public.es_admin());

-- ---------- 7. Permisos explícitos (la exposición automática de tablas está desactivada) ----------
revoke all on public.perfiles, public.config, public.cotizaciones, public.aprobaciones, public.folios from anon;
grant select, update                 on public.perfiles     to authenticated;
grant select, insert, update         on public.config       to authenticated;
grant select, insert, update, delete on public.cotizaciones to authenticated;
grant select, insert, update, delete on public.aprobaciones to authenticated;

revoke execute on function public.siguiente_folio()                    from public, anon;
revoke execute on function public.actualizar_cotizacion(text, jsonb)   from public, anon;
grant  execute on function public.siguiente_folio()                    to authenticated;
grant  execute on function public.actualizar_cotizacion(text, jsonb)   to authenticated;
grant  execute on function public.es_activo(), public.es_admin()       to authenticated;

-- ---------- 8. Cambios en tiempo real ----------
do $$
begin
  begin alter publication supabase_realtime add table public.config;       exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.cotizaciones; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.aprobaciones; exception when duplicate_object then null; end;
end $$;
