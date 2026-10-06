-- =====================================================================
-- Cotizador Sunname · Reglas de seguridad para cotizaciones y usuarios
-- Ejecutar una sola vez en Supabase: SQL Editor > New query > Run
-- (se puede volver a correr sin problema).
--
-- 1) Ventas solo modifica sus propias cotizaciones; administración, todas.
--    Todo el equipo sigue VIENDO todas.
-- 2) Nadie puede cambiar quién hizo una cotización.
-- 3) Un descuento arriba del máximo sin autorización regresa a "Por autorizar",
--    aunque se intente guardar por fuera del cotizador.
-- 4) La comisión de ventas se calcula con el canal de la Configuración.
-- 5) Los usuarios nuevos nacen desactivados: para darles acceso hay que
--    ponerles nombre y activo = true (como en 05-usuarios-ventas.sql).
-- =====================================================================

-- ---------- 1. Solo el dueño (o administración) edita ----------
drop policy if exists "cotizaciones: editar" on public.cotizaciones;
create policy "cotizaciones: editar" on public.cotizaciones for update to authenticated
  using (public.es_admin() or (public.es_activo() and creado_por = auth.uid()))
  with check (public.es_admin() or (public.es_activo() and creado_por = auth.uid()));

-- Si no se pudo actualizar (no existe o no es tuya), avisa con error en lugar de no hacer nada
create or replace function public.actualizar_cotizacion(p_id text, p_cambios jsonb) returns void
language plpgsql security invoker set search_path = public as $$
begin
  update public.cotizaciones set datos = datos || p_cambios where id = p_id;
  if not found then
    raise exception 'Solo puedes modificar tus propias cotizaciones' using errcode = '42501';
  end if;
end $$;
revoke execute on function public.actualizar_cotizacion(text, jsonb) from public, anon;
grant  execute on function public.actualizar_cotizacion(text, jsonb) to authenticated;

-- ---------- 2 a 4. Reglas al guardar ----------
create or replace function public.proteger_cotizacion() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  adm   boolean := public.es_admin();
  cfg   jsonb;
  dmax  numeric := 10;
  d     numeric := 0;
  aut   numeric;
  pct   numeric;
  sub   numeric;
begin
  -- quién la hizo: al crearla es quien la guarda (administración puede respetar el que venga); después no cambia
  if tg_op = 'INSERT' then
    if not adm or new.creado_por is null then new.creado_por := auth.uid(); end if;
  else
    new.creado_por := old.creado_por;
  end if;
  if new.creado_por is not null then
    new.datos := jsonb_set(new.datos, '{creadoPor}', to_jsonb(new.creado_por::text));
  end if;

  -- solo administración marca un descuento como autorizado
  if (new.datos->>'estado') = 'autorizada'
     and (tg_op = 'INSERT' or coalesce(old.datos->>'estado', '') <> 'autorizada')
     and not adm then
    raise exception 'Solo administración puede autorizar descuentos';
  end if;

  if not adm then
    select datos into cfg from public.config where id = 'parametros';
    if jsonb_typeof(cfg->'descMax') = 'number' then dmax := (cfg->>'descMax')::numeric; end if;

    -- descuento: siempre número; si pasa del máximo y no hay autorización suficiente, queda por autorizar
    if jsonb_typeof(new.datos->'descPct') = 'number' then d := (new.datos->>'descPct')::numeric; end if;
    new.datos := new.datos || jsonb_build_object('descPct', d);
    if d > dmax then
      select case when jsonb_typeof(datos->'desc') = 'number' then (datos->>'desc')::numeric end
        into aut from public.aprobaciones where id = new.id;
      if aut is null or aut < d then
        new.datos := new.datos || '{"estado":"por_autorizar"}'::jsonb;
      end if;
    end if;

    -- comisión según el canal de la Configuración (solo al crearla o si cambia el subtotal o el canal)
    if tg_op = 'INSERT'
       or old.datos->'subtotal' is distinct from new.datos->'subtotal'
       or old.datos->'canal'    is distinct from new.datos->'canal' then
      select case when jsonb_typeof(x->'c') = 'number' then (x->>'c')::numeric end into pct
        from jsonb_array_elements(case when jsonb_typeof(cfg->'canales') = 'array' then cfg->'canales' else '[]'::jsonb end) x
        where x->>'id' = new.datos->>'canal' limit 1;
      sub := case when jsonb_typeof(new.datos->'subtotal') = 'number' then (new.datos->>'subtotal')::numeric else 0 end;
      if pct is not null then
        new.datos := new.datos || jsonb_build_object('comision', round(sub * pct / 100));
      end if;
    end if;
  end if;

  new.actualizado := now();
  return new;
end $$;

drop trigger if exists antes_de_guardar on public.cotizaciones;
create trigger antes_de_guardar before insert or update on public.cotizaciones
  for each row execute function public.proteger_cotizacion();

-- ---------- 5. Usuarios nuevos desactivados ----------
alter table public.perfiles alter column activo set default false;

-- Revisa: cuántas cotizaciones tiene cada quien (las que no tienen dueño solo las edita administración)
select coalesce(p.nombre, '(sin dueño)') as vendedor, count(*) as cotizaciones
from public.cotizaciones c left join public.perfiles p on p.id = c.creado_por
group by 1 order by 2 desc;
