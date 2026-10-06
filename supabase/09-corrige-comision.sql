-- =====================================================================
-- Cotizador Sunname · Corrección a las reglas de 07-proteger-cotizaciones.sql
-- Ejecutar en Supabase: SQL Editor > New query > Run (se puede volver a correr).
--
-- Encontrado al probar con un usuario de ventas: se podía cambiar solo la
-- comisión de una cotización propia (sin tocar subtotal ni canal) y se guardaba.
-- Ahora:
--  * Si no cambia el subtotal ni el canal, la comisión se queda como estaba.
--  * Si el canal no existe en la Configuración, la comisión es 0.
-- (07-proteger-cotizaciones.sql ya trae esta misma versión.)
-- =====================================================================

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
      elsif jsonb_typeof(cfg->'canales') = 'array' then
        new.datos := new.datos || '{"comision":0}'::jsonb;          -- canal que no existe: sin comisión
      end if;
    else
      -- sin cambio de subtotal ni de canal, la comisión no se puede tocar
      new.datos := (new.datos - 'comision')
        || case when old.datos ? 'comision' then jsonb_build_object('comision', old.datos->'comision') else '{}'::jsonb end;
    end if;
  end if;

  new.actualizado := now();
  return new;
end $$;

revoke execute on function public.proteger_cotizacion() from public, anon, authenticated;
