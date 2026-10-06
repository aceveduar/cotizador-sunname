# Cotizador Sunname

Cotizador de implementaciones Odoo de Sunname: paquete de horas, proyecto y análisis GAP.

- PDF de la cotización con folio, logo y aplicaciones de Odoo incluidas
- Historial de cotizaciones, seguimiento y exportación a Excel
- Autorización de descuentos, comisiones y configuración de tarifas
- Inicio de sesión y datos compartidos con Supabase

## Archivos

- `index.html`: estructura de las pantallas.
- `css/estilos.css`: estilos y colores de marca.
- `js/calculos.js`: cálculo de precios, horas y textos de la cotización, sin pantalla. Aquí también están los valores por defecto, las áreas y el catálogo de aplicaciones de Odoo.
- `js/app.js`: todo lo demás: pantalla, PDF, historial, configuración, notas y conexión con Supabase.
- `img/`: logo claro (pantalla y PDF), logo oscuro (modo oscuro) e ícono de la pestaña.
- `supabase/`: scripts de la base de datos, numerados en el orden en que se corren.
- `pruebas/`: pruebas de los cálculos.

Al cambiar `css/` o `js/`, sube el número `?v=` en `index.html` para que los navegadores no usen la versión anterior guardada.

## Pruebas

Con Node.js instalado: `npm test`. Revisa los cálculos de Horas, Proyecto, GAP, descuentos, comisiones y crédito del GAP. Córrelas antes de subir cualquier cambio de precios o reglas.

`pruebas/calculos.js` es la prueba anterior: se pega en la consola del navegador con el cotizador abierto.

## Datos y usuarios

Las cotizaciones, la configuración y las notas viven en Supabase. `SUPABASE_URL` y `SUPABASE_KEY` están en `js/app.js`; la clave es la pública y puede estar en el código.

Si `SUPABASE_URL` se deja vacía, el cotizador entra en **modo de prueba** y guarda todo en el navegador. Sirve para probar cambios sin tocar los datos reales.

Para dar de alta a alguien: crearlo en Supabase (Authentication > Users > Add user, con "Auto Confirm User") y correr un script como `05-usuarios-ventas.sql` para ponerle nombre, rol y activarlo. Los usuarios nuevos nacen desactivados.

## Reglas que viven en dos lugares

El descuento máximo sin autorización y la comisión por canal se aplican en la pantalla (`js/calculos.js`) y también en la base de datos (`supabase/07-proteger-cotizaciones.sql`). Si cambia una de estas reglas, hay que actualizar ambos.

## Marca

Colores: variables `--marca-*` al inicio de `css/estilos.css`. Logos: carpeta `img/`.
