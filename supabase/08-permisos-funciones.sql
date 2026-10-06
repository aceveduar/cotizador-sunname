-- =====================================================================
-- Cotizador Sunname · Permisos de funciones (advertencias del Security Advisor)
-- Ejecutar en Supabase: SQL Editor > New query > Run (se puede volver a correr).
--
-- Supabase deja que cualquiera ejecute las funciones nuevas. Aquí se cierra:
--  * Nadie sin sesión ejecuta ninguna función.
--  * Las funciones de los triggers (al crear usuario, al guardar cotización,
--    al cambiar configuración) no se pueden llamar directo; los triggers
--    siguen funcionando porque no necesitan este permiso.
--  * es_activo, es_admin y siguiente_folio se quedan para usuarios con sesión:
--    las reglas de seguridad (RLS) y el folio las necesitan. Esas 3
--    advertencias de "Signed-In Users" son esperadas y se pueden ignorar.
-- =====================================================================

-- Sin sesión: nada
revoke execute on function public.es_activo()                 from public, anon;
revoke execute on function public.es_admin()                  from public, anon;
revoke execute on function public.siguiente_folio()           from public, anon;
revoke execute on function public.nuevo_usuario()             from public, anon, authenticated;
revoke execute on function public.proteger_cotizacion()       from public, anon, authenticated;
revoke execute on function public.registrar_cambio_config()   from public, anon, authenticated;

-- rls_auto_enable() no es del cotizador (la crea Supabase); solo se cierra si existe
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;

-- Con sesión: solo lo necesario
grant execute on function public.es_activo()       to authenticated;
grant execute on function public.es_admin()        to authenticated;
grant execute on function public.siguiente_folio() to authenticated;

-- Revisa: quién puede ejecutar cada función del cotizador
select p.proname as funcion,
       has_function_privilege('anon', p.oid, 'execute')          as sin_sesion,
       has_function_privilege('authenticated', p.oid, 'execute') as con_sesion
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('es_activo','es_admin','siguiente_folio','nuevo_usuario','proteger_cotizacion','registrar_cambio_config','rls_auto_enable','actualizar_cotizacion')
order by 1;
