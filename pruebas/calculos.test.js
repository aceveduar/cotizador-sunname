// Pruebas automáticas del cálculo. Se corren con:  npm test
// (o sin npm:  node --test pruebas/)
const test = require("node:test");
const assert = require("node:assert/strict");
const { DEF, cotizar, appsTexto } = require("../js/calculos.js");

const P = JSON.parse(JSON.stringify(DEF));

// Valores con los que abre el formulario (mismos que FRESH en la app)
const base = {
  "r:modo": "horas", "r:margen": "B", "r:canal": "vendedor", desc: "0",
  "a-ventas": true, "a-fin": true, "a-log": true, "a-web": false, "a-rh": false, "a-pos": false, "a-serv": false, "a-mrp": false,
  "h-emp": "10",
  "p-usr": "25", "p-areas": "5", "p-emp": "1", "p-cons": "2", "p-nvis": "4", "p-hvis": "8", "p-vvis": "3,000",
  "p-dev": "40", "p-pm": "3", "p-pmh": "10", "p-gapfolio": "", "p-gapmonto": "0", "p-gapcred": true,
  "g-usr": "60", "g-emp": "2", "g-areas": "8", "g-suc": "3", "g-odoo": false, "g-dev": true, "g-visita": true, "g-viat": "10,000",
  "p-app-conv": true, "p-app-calendario": true, "p-app-limpieza": true, "p-app-tableros": true,
  "g-app-conv": true, "g-app-calendario": true, "g-app-limpieza": true, "g-app-tableros": true,
};
const con = (cambios) => ({ ...base, ...cambios });

test("Paquete de horas con valores de inicio: 50 h y $61,842", () => {
  const R = cotizar(base, P, { admin: true });
  assert.equal(R.horas, 50);
  assert.equal(R.sub, 53312);   // 38,080 de Odoo + 40% de margen
  assert.equal(R.iva, 8530);
  assert.equal(R.total, 61842);
  assert.equal(R.anticipo, 18553);
  assert.deepEqual(R.apps.map((a) => a[0]), ["Ventas y CRM", "Finanzas", "Compras e inventario"]);
});

test("Horas: margen de 30% y más de 50 empleados sube de paquete", () => {
  const R = cotizar(con({ "r:margen": "A", "h-emp": "60" }), P, { admin: true });
  assert.equal(R.horas, 100);
  assert.equal(R.sub, 88400);   // 68,000 + 30%
  assert.ok(R.paquete.masEmp);
});

test("Horas sin áreas: no hay paquete y se avisa", () => {
  const R = cotizar(con({ "a-ventas": false, "a-fin": false, "a-log": false }), P, { admin: true });
  assert.equal(R.horas, 0);
  assert.equal(R.paquete, null);
  assert.deepEqual(R.flags[0], ["alerta", "Falta seleccionar áreas"]);
});

test("Proyecto con valores de inicio: 500 h y $593,920", () => {
  const R = cotizar(con({ "r:modo": "proy" }), P, { admin: true });
  assert.equal(R.horas, 500);
  assert.equal(R.sub, 500000);
  assert.equal(R.viat, 12000);
  assert.equal(R.total, 593920);
  assert.equal(R.dur, "12 semanas de implementación y 3 meses de soporte");
  assert.equal(R.pagos.reduce((s, p) => s + p[2], 0), R.total); // los hitos suman el total exacto
  assert.equal(R.apps.length, 1);                                // solo Productividad por defecto
});

test("Proyecto: el crédito del GAP se descuenta", () => {
  const R = cotizar(con({ "r:modo": "proy", "p-gapfolio": "SUN-2026-0001", "p-gapmonto": "44,000" }), P, { admin: true });
  assert.equal(R.cred, 44000);
  assert.equal(R.sub, 456000);
  assert.equal(R.conceptos.at(-1)[1], -44000);
});

test("Análisis GAP con valores de inicio: 44 h y $62,640", () => {
  const R = cotizar(con({ "r:modo": "gap" }), P, { admin: true });
  assert.equal(R.horas, 44);
  assert.equal(R.sub, 44000);
  assert.equal(R.viat, 10000);
  assert.equal(R.total, 62640);
});

test("Descuento: 10% se aplica sin autorización", () => {
  const R = cotizar(con({ desc: "10" }), P, { admin: false });
  assert.equal(R.dAmt, 5331);
  assert.equal(R.subD, 47981);
  assert.equal(R.requiere, false);
});

test("Descuento arriba del máximo: ventas necesita autorización, administración no", () => {
  const e = con({ desc: "15" });
  assert.equal(cotizar(e, P, { admin: false }).requiere, true);
  assert.equal(cotizar(e, P, { admin: false }).descAviso, "pendiente");
  assert.equal(cotizar(e, P, { admin: false, aprobado: true }).requiere, false);
  assert.equal(cotizar(e, P, { admin: true }).requiere, false);
});

test("Comisión según el canal", () => {
  assert.equal(cotizar(base, P, { admin: true }).com, 2666);                          // 5% de 53,312
  assert.equal(cotizar(con({ "r:canal": "directa" }), P, { admin: true }).com, 0);
});

test("Aplicaciones para el Excel del historial", () => {
  assert.equal(appsTexto(con({ "r:modo": "proy", "p-app-crm": true })),
    "Ventas: CRM | Productividad: Conversaciones, Calendario, Limpieza de datos, Tableros");
  assert.equal(appsTexto({}), ""); // cotización sin datos: vacío
});
