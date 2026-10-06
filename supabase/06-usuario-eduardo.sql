-- =====================================================================
-- Cotizador Sunname · Usuario de Eduardo Acevedo (administración)
-- 1) Crea el usuario en Authentication > Users > Add user > Create new user
--    (marca "Auto Confirm User").
-- 2) Ejecuta este script para ponerle nombre y rol.
-- =====================================================================

-- Por si el usuario se creó antes de correr 01-esquema.sql
insert into public.perfiles (id, nombre)
select id, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

update public.perfiles p set nombre = 'Eduardo Acevedo', rol = 'admin', activo = true
from auth.users u where u.id = p.id and lower(u.email) = 'eacevedo@sunname.com.mx';

-- Revisa el resultado: debe aparecer con rol admin
select u.email, p.nombre, p.rol, p.activo
from public.perfiles p join auth.users u on u.id = p.id
where lower(u.email) = 'eacevedo@sunname.com.mx';

-- Si prefieres que sea de ventas:
--   update public.perfiles p set rol = 'vendedor'
--   from auth.users u where u.id = p.id and lower(u.email) = 'eacevedo@sunname.com.mx';
