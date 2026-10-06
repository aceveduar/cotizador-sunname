-- =====================================================================
-- Cotizador Sunname · Nuevos usuarios de ventas
-- 1) Crea los usuarios en Authentication > Users > Add user > Create new user
--    (marca "Auto Confirm User").
-- 2) Ejecuta este script para ponerles nombre y rol.
-- =====================================================================

-- Por si algún usuario se creó antes de correr 01-esquema.sql
insert into public.perfiles (id, nombre)
select id, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

update public.perfiles p set nombre = 'Karla Janet Teyssier Mino', rol = 'vendedor', activo = true
from auth.users u where u.id = p.id and lower(u.email) = 'kteyssier@sunname.com.mx';

update public.perfiles p set nombre = 'Anuar Ivan Ramos Pérez', rol = 'vendedor', activo = true
from auth.users u where u.id = p.id and lower(u.email) = 'aramos@sunname.com.mx';

-- Revisa el resultado: deben aparecer los dos con rol vendedor
select u.email, p.nombre, p.rol, p.activo
from public.perfiles p join auth.users u on u.id = p.id
where lower(u.email) in ('kteyssier@sunname.com.mx', 'aramos@sunname.com.mx');

-- Para darles acceso de administración (Configuración y autorizar descuentos):
--   update public.perfiles p set rol = 'admin'
--   from auth.users u where u.id = p.id
--     and lower(u.email) in ('kteyssier@sunname.com.mx', 'aramos@sunname.com.mx');
