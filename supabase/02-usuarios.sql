-- =====================================================================
-- Cotizador Sunname · Roles de usuarios
-- 1) Primero ejecuta 01-esquema.sql.
-- 2) Crea los usuarios en Authentication > Users > Add user > Create new user
--    (marca "Auto Confirm User").
-- 3) Ejecuta este script.
-- =====================================================================

-- Por si algún usuario se creó antes de correr 01-esquema.sql
insert into public.perfiles (id, nombre)
select id, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

-- Nombres y roles. Por ahora los tres son administración.
update public.perfiles p set nombre = 'Angélica María Colmenárez', rol = 'admin', activo = true
from auth.users u where u.id = p.id and lower(u.email) = 'acolmenarez@sunname.com.mx';

update public.perfiles p set nombre = 'Eduardo Froylán Martínez Martínez', rol = 'admin', activo = true
from auth.users u where u.id = p.id and lower(u.email) = 'fmartinez@sunname.com.mx';

update public.perfiles p set nombre = 'María Dolores Martínez Martínez', rol = 'admin', activo = true
from auth.users u where u.id = p.id and lower(u.email) = 'mmartinez@sunname.com.mx';

-- Revisa el resultado: deben aparecer los tres con rol admin
select u.email, p.nombre, p.rol, p.activo
from public.perfiles p join auth.users u on u.id = p.id
order by p.nombre;

-- ---------------------------------------------------------------------
-- A futuro (María como administradora principal):
--   update public.perfiles p set rol = 'vendedor'
--   from auth.users u where u.id = p.id
--     and lower(u.email) in ('acolmenarez@sunname.com.mx', 'fmartinez@sunname.com.mx');
--
-- Para quitarle el acceso a alguien sin borrarlo:
--   update public.perfiles p set activo = false
--   from auth.users u where u.id = p.id and lower(u.email) = 'correo@sunname.com.mx';
-- ---------------------------------------------------------------------
