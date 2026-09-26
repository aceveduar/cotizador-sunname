-- =====================================================================
-- Cotizador Sunname · Notas de prueba
-- Ejecutar una sola vez en Supabase: SQL Editor > New query > Run
-- Cada quien ve sus propias notas; administración ve las de todo el equipo.
-- =====================================================================

create table if not exists public.notas (
  id           uuid primary key default gen_random_uuid(),
  texto        text not null check (length(trim(texto)) > 0),
  contexto     text not null default '',
  autor        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  creado       timestamptz not null default now(),
  atendida     boolean not null default false,
  atendida_por uuid references auth.users(id),
  atendida_en  timestamptz
);

alter table public.notas enable row level security;

drop policy if exists "notas: ver propias o admin"    on public.notas;
drop policy if exists "notas: crear propias"          on public.notas;
drop policy if exists "notas: admin marca atendida"   on public.notas;
drop policy if exists "notas: borrar propias o admin" on public.notas;

create policy "notas: ver propias o admin" on public.notas for select to authenticated
  using (public.es_activo() and (autor = auth.uid() or public.es_admin()));
create policy "notas: crear propias" on public.notas for insert to authenticated
  with check (public.es_activo() and autor = auth.uid());
create policy "notas: admin marca atendida" on public.notas for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy "notas: borrar propias o admin" on public.notas for delete to authenticated
  using (public.es_activo() and (autor = auth.uid() or public.es_admin()));

revoke all on public.notas from anon;
grant select, insert, update, delete on public.notas to authenticated;

do $$
begin
  begin alter publication supabase_realtime add table public.notas; exception when duplicate_object then null; end;
end $$;
