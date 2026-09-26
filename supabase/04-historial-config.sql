-- =====================================================================
-- Cotizador Sunname · Historial de cambios en Configuración
-- Ejecutar una sola vez en Supabase: SQL Editor > New query > Run
-- Registra automáticamente qué campo cambió, antes/después, quién y cuándo.
-- Solo administración puede verlo; nadie puede editarlo ni borrarlo desde el cotizador.
-- =====================================================================

create table if not exists public.config_historial (
  id           bigserial primary key,
  cambiado_por uuid references auth.users(id),
  creado       timestamptz not null default now(),
  campo        text not null,
  antes        jsonb,
  despues      jsonb
);

create index if not exists config_historial_creado on public.config_historial (creado desc);

-- Compara la configuración anterior con la nueva y guarda cada campo que cambió.
-- Si la misma persona cambia el mismo campo varias veces en menos de 2 minutos
-- (por ejemplo, mientras escribe "1100"), se guarda como un solo cambio.
create or replace function public.registrar_cambio_config() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  k       text;
  previo  public.config_historial%rowtype;
begin
  for k in select distinct key from (
      select jsonb_object_keys(coalesce(old.datos, '{}'::jsonb)) as key
      union
      select jsonb_object_keys(new.datos)
    ) llaves
  loop
    if (old.datos -> k) is distinct from (new.datos -> k) then
      select * into previo from public.config_historial
        where campo = k and cambiado_por is not distinct from auth.uid()
          and creado > now() - interval '2 minutes'
        order by creado desc limit 1;
      if found then
        if previo.antes is not distinct from (new.datos -> k) then
          delete from public.config_historial where id = previo.id;   -- regresó al valor original: no hubo cambio
        else
          update public.config_historial set despues = new.datos -> k, creado = now() where id = previo.id;
        end if;
      else
        insert into public.config_historial (cambiado_por, campo, antes, despues)
        values (auth.uid(), k, old.datos -> k, new.datos -> k);
      end if;
    end if;
  end loop;
  new.actualizado := now();
  new.actualizado_por := auth.uid();
  return new;
end $$;

drop trigger if exists al_cambiar_config on public.config;
create trigger al_cambiar_config before update on public.config
  for each row execute function public.registrar_cambio_config();

alter table public.config_historial enable row level security;
drop policy if exists "historial: admin ve" on public.config_historial;
create policy "historial: admin ve" on public.config_historial for select to authenticated using (public.es_admin());

revoke all on public.config_historial from anon;
grant select on public.config_historial to authenticated;

do $$
begin
  begin alter publication supabase_realtime add table public.config_historial; exception when duplicate_object then null; end;
end $$;
