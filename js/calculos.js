/* =====================================================================
   Cotizador Sunname · Cálculo de cotizaciones
   Sin pantalla: recibe los datos del formulario y la configuración, y
   devuelve horas, importes y textos. Lo usan la app (js/app.js) y las
   pruebas automáticas (pruebas/calculos.test.js, se corren con "npm test").
   ===================================================================== */
(function(raiz){
"use strict";
/* =================== Valores por defecto =================== */
const DEF={
  tarifa:1000, tarifaDev:1000, tarifaSoporte:1000, iva:16, anticipo:30, descMax:10, vigencia:30, pago:"30% de anticipo y el saldo por hitos",
  margenA:30, margenB:40,
  odoo:[{h:25,p:19550},{h:50,p:38080},{h:100,p:68000},{h:200,p:136000}],
  empTier:50,
  pUsuarios:[{hasta:3,h:25},{hasta:5,h:30},{hasta:10,h:50},{hasta:20,h:100},{hasta:50,h:150},{hasta:100,h:200},{hasta:null,h:260}],
  hArea:20, hEmpresa:15, gestion:10, conting:20, hSemana:20,
  dist:[{n:"Análisis y diseño",p:15},{n:"Configuración",p:35},{n:"Migración de datos",p:10},{n:"Capacitación",p:15},{n:"Pruebas",p:10},{n:"Salida a producción y estabilización",p:15}],
  fases:[{n:"Firma y arranque del proyecto",p:30},{n:"Configuración y migración de datos",p:30},{n:"Capacitación y pruebas",p:20},{n:"Salida a producción",p:20}],
  gapCredito:100, licStandard:0, licCustom:0, diasSeguimiento:7,
  gBase:4, gEmpresa:2, gArea:3, gOdoo:2, gVisita:5, gDev:4, gRedondeo:1000,
  gUsuarios:[{hasta:10,h:0},{hasta:25,h:1},{hasta:50,h:2},{hasta:100,h:3},{hasta:null,h:5}],
  gSuc:[{hasta:1,h:0},{hasta:3,h:2},{hasta:6,h:4},{hasta:10,h:6},{hasta:null,h:8}],
  canales:[{id:"vendedor",n:"Vendedor",c:5},{id:"direccion",n:"Dirección",c:0},{id:"directa",n:"Venta directa",c:0},{id:"consultoria",n:"Consultoría",c:0}],
  empresa:"Sunname", telEmpresa:"", correoEmpresa:"", web:"",
  terminos:"Precios en pesos mexicanos. No incluyen licencias de Odoo, que se contratan directamente con Odoo. Las horas adicionales fuera del alcance acordado se cotizan por separado. El cronograma depende de la disponibilidad y las validaciones del cliente."
};
/* Aplicaciones de Odoo por categoría: [id, nombre, marcada por defecto en Proyecto y GAP] */
const APPS=[
  ["Ventas",[["crm","CRM"],["ventas","Ventas"],["subs","Suscripciones"],["renta","Alquiler"],["pdv","Punto de venta (tienda)"],["pdvrest","Punto de venta (restaurantes)"]]],
  ["Finanzas",[["conta","Contabilidad"],["fact","Facturación"],["gastos","Gastos"],["consol","Consolidación de estados financieros"],["docs","Documentos"],["firma","Firma electrónica"],["hoja","Hoja de cálculo (BI)"]]],
  ["Sitio web",[["web","Sitio web"],["ecom","Comercio electrónico"],["blog","Blog"],["foro","Foro"],["chat","Chat en vivo"],["elearn","eLearning"]]],
  ["Cadena de suministro",[["inv","Inventario"],["compras","Compras"],["mrp","Manufactura (MRP)"],["plm","PLM"],["mant","Mantenimiento"],["calidad","Calidad"]]],
  ["Recursos humanos",[["empleados","Empleados"],["recl","Reclutamiento"],["ausencias","Vacaciones"],["eval","Evaluaciones"],["refer","Referencias"],["flota","Flotilla"]]],
  ["Marketing",[["mkauto","Automatización de marketing"],["mkmail","Marketing por correo"],["mksms","Marketing por SMS"],["mksoc","Marketing social"],["eventos","Eventos"],["encuestas","Encuestas"]]],
  ["Servicios",[["proyecto","Proyecto"],["hojas","Hojas de horas"],["campo","Servicio externo"],["helpdesk","Soporte al cliente"],["planea","Planeación"],["citas","Citas"]]],
  ["Productividad",[["conv","Conversaciones",1],["calendario","Calendario",1],["limpieza","Limpieza de datos",1],["tableros","Tableros",1],["aprob","Aprobaciones"],["conoc","Conocimiento"],["voip","VoIP"],["wa","WhatsApp"]]]
];
const APP=Object.fromEntries(APPS.flatMap(c=>c[1]).map(a=>[a[0],a[1]]));
const NOTA_APPS="Las aplicaciones se implementan en su funcionalidad estándar. Cualquier adecuación de funcionamiento o integración se cotiza por separado.";
/* Áreas del paquete de horas: [id, nombre, peso, marcada por defecto, aplicaciones que incluye (textos de Odoo; "Compras" en lugar de "Aprovisionamiento" para coincidir con la lista de Proyecto y GAP)] */
const AREAS=[["ventas","Ventas y CRM",1,1,["Ventas","Facturación","Suscripciones","Alquiler","CRM"]],["fin","Finanzas",1,1,["Gastos","consolidación de estados financieros"]],["log","Compras e inventario",1,1,["Compras","Inventario"]],["web","Sitio web",1,0,["Sitio web","Comercio electrónico","Foro"]],["rh","Recursos humanos",1,0,["Reclutamiento","Vacaciones","Evaluaciones","Gastos"]],["pos","Punto de venta",1,0,["Tienda","Restaurantes"]],["serv","Servicios",1,0,["Proyecto","Hojas de horas","Soporte al cliente","Planeación"]],["mrp","Manufactura",2,0,["MRP","PLM","Calidad","Mantenimiento"]]];
/* aplicaciones del catálogo que corresponden a cada área de Horas (para llevarlas a Proyecto o GAP) */
const AREA_APPS={ventas:["ventas","fact","subs","renta","crm"],fin:["gastos","consol"],log:["compras","inv"],web:["web","ecom","foro"],rh:["recl","ausencias","eval","gastos"],pos:["pdv","pdvrest"],serv:["proyecto","hojas","helpdesk","planea"],mrp:["mrp","plm","calidad","mant"]};
/* Área de negocio de cada aplicación, con las mismas áreas de Horas (más Marketing), para la nota
   "Elegiste aplicaciones de N áreas" en Proyecto y GAP. Productividad, Documentos, Firma y Hoja de
   cálculo son transversales y no cuentan. */
const APP_AREA={...Object.fromEntries(Object.entries(AREA_APPS).reverse().flatMap(([area,ids])=>ids.map(id=>[id,area]))),
  conta:"fin",blog:"web",chat:"web",elearn:"web",empleados:"rh",refer:"rh",flota:"rh",campo:"serv",citas:"serv",
  mkauto:"mkt",mkmail:"mkt",mksms:"mkt",mksoc:"mkt",eventos:"mkt",encuestas:"mkt"};
const NOMBRE_AREA={...Object.fromEntries(AREAS.map(a=>[a[0],a[1]])),mkt:"Marketing"};

/* =================== Utilidades =================== */
const numTxt=t=>parseFloat(String(t).replace(/[^\d.]/g,""))||0;
const fmtN=n=>Math.round(numTxt(n)).toLocaleString("es-MX");
const limpio=x=>Math.round(x*1e6)/1e6;
const arriba=(x,paso)=>Math.ceil(limpio(x/paso))*paso;
const money=x=>(x<0?"-":"")+"$"+Math.round(Math.abs(x)).toLocaleString("es-MX");
const hrs=x=>(Math.round(x*10)/10).toLocaleString("es-MX")+" h";
const tier=(t,x)=>{for(const r of t)if(r.hasta===null||x<=r.hasta)return r.h;return t[t.length-1].h;};

/* =================== Cálculo ===================
   e: datos del formulario con el mismo formato que se guarda en cada cotización
      (id del campo -> valor; casillas -> true/false; opciones -> "r:<nombre>").
   P: configuración (tarifas y reglas).
   ctx: {admin, aprobado}: si quien cotiza es administración y si el descuento ya fue autorizado. */
function cotizar(e,P,ctx={}){
  const v=id=>Math.max(0,numTxt(e[id]??""));
  const on=id=>!!e[id];
  const appsDe=pre=>APPS.map(([cat,l])=>[cat,l.filter(a=>on(pre+"-app-"+a[0])).map(a=>a[1])]).filter(c=>c[1].length);
  const areasDe=pre=>Object.keys(NOMBRE_AREA).filter(ar=>Object.keys(APP_AREA).some(id=>APP_AREA[id]===ar&&on(pre+"-app-"+id))).map(ar=>NOMBRE_AREA[ar]);
  const modo=e["r:modo"]||"horas";
  const canal=P.canales.find(c=>c.id===e["r:canal"])||P.canales[0];
  const descPct=Math.min(100,v("desc")),desc=descPct/100;
  let horas=0,sub=0,viat=0,titulo="",desg=[],flags=[],detalle="",dur="",conceptos=[],fasesH=null,cred=0,apps=[],paquete=null,areasApps=[];

  if(modo==="horas"){
    titulo="Paquete de horas";
    let w=0,sel=[];AREAS.forEach(a=>{if(on("a-"+a[0])){w+=a[2];sel.push(a[1]);apps.push([a[1],a[4]]);}});
    let t=w<=0?-1:w<=1?0:w<=3?1:w<=5?2:3;
    if(t>=0&&t<3&&v("h-emp")>P.empTier)t++;
    const mk=(e["r:margen"]==="A"?P.margenA:P.margenB)/100;
    if(t<0){flags.push(["alerta","Falta seleccionar áreas"]);}
    else{
      const pk=P.odoo[t];horas=pk.h;sub=pk.p*(1+mk);
      paquete={h:pk.h,n:sel.length,masEmp:v("h-emp")>P.empTier};
      desg=[["Precio de referencia Odoo",money(pk.p)],["Margen Sunname "+Math.round(mk*100)+"%",money(pk.p*mk)],["Precio por hora",money(sub/horas)]];
      detalle=`Implementación de Odoo para las áreas de ${sel.join(", ")}. Incluye kickoff, configuración estándar, carga de datos, transferencia de conocimiento al usuario clave, pruebas y salida a producción.`;
      conceptos=[[`Paquete de ${horas} horas de consultoría e implementación Odoo`,sub]];
      dur=horas<=25?"2 a 4 semanas":horas<=50?"1 a 2 meses":horas<=100?"2 a 3 meses":"3 a 6 meses";
      if(horas>=200)flags.push(["aviso","Alcance grande: considera Proyecto o GAP"]);
    }
  }
  if(modo==="proy"){
    titulo="Proyecto de implementación";apps=appsDe("p");areasApps=areasDe("p");
    const u=v("p-usr"),ar=Math.max(1,v("p-areas")),em=Math.max(1,v("p-emp")),co=Math.max(1,v("p-cons")),dev=v("p-dev");
    const base=[["Base por "+u+" usuarios",tier(P.pUsuarios,u)],["Áreas ("+ar+" × "+P.hArea+" h)",ar*P.hArea],["Empresas adicionales",(em-1)*P.hEmpresa],
      ["Visitas ("+v("p-nvis")+" × "+v("p-hvis")+" h × "+co+" consultores)",v("p-nvis")*v("p-hvis")*co]];
    const bF=base.reduce((s,r)=>s+r[1],0),fac=(1+P.gestion/100)*(1+P.conting/100);
    const impF=arriba(bF*fac,5),impD=dev?arriba(dev*fac,5):0,imp=impF+impD,post=v("p-pm")*v("p-pmh");
    horas=imp+post;viat=v("p-nvis")*v("p-vvis");
    sub=impF*P.tarifa+impD*P.tarifaDev+post*P.tarifaSoporte;
    desg=[...base.filter(r=>r[1]).map(r=>[r[0],hrs(r[1])]),dev?["Desarrollo validado",hrs(dev)]:null,
      ["Gestión "+P.gestion+"% y contingencia "+P.conting+"%",hrs(imp-bF-dev)],["Implementación funcional",hrs(impF),"t"],impD?["Desarrollo",hrs(impD),"t"]:null,
      post?["Soporte post producción",hrs(post)]:null,["Tarifa funcional",money(P.tarifa)],impD?["Tarifa desarrollo",money(P.tarifaDev)]:null,post?["Tarifa soporte",money(P.tarifaSoporte)]:null].filter(Boolean);
    const sem=Math.max(1,arriba(imp/(co*Math.max(1,P.hSemana)),1));
    dur=`${sem} semana${sem>1?"s":""} de implementación`+(post?` y ${v("p-pm")} meses de soporte`:"");
    detalle=`Implementación de Odoo para ${u} usuarios en ${ar} áreas${em>1?" y "+em+" empresas":""}, con ${co} consultor${co>1?"es":""} asignado${co>1?"s":""}. Incluye análisis, diseño, configuración, migración de datos, capacitación, pruebas, salida a producción y estabilización${v("p-nvis")?", con "+v("p-nvis")+" visitas presenciales":""}.`;
    conceptos=[[`Implementación funcional Odoo (${hrs(impF)})`,impF*P.tarifa]];
    if(impD)conceptos.push([`Desarrollos a la medida (${hrs(impD)})`,impD*P.tarifaDev]);
    if(post)conceptos.push([`Soporte post producción: ${v("p-pm")} meses, ${hrs(post)}`,post*P.tarifaSoporte]);
    const gf=String(e["p-gapfolio"]??"");
    if(gf&&on("p-gapcred")){cred=Math.min(sub,v("p-gapmonto")*P.gapCredito/100);if(cred){conceptos.push([`Crédito por análisis GAP ${gf}`,-cred]);sub-=cred;desg.push(["Crédito análisis GAP",money(-cred)]);}}
    fasesH=P.dist.map(x=>[x.n,Math.round(impF*x.p/100)]);if(impD)fasesH.push(["Desarrollos a la medida",impD]);if(post)fasesH.push(["Soporte post producción",post]);
    if(dev>0)flags.push(["aviso","Validar horas de desarrollo con el área técnica"]);
    if(u>50||em>2||ar>8)flags.push(["alerta","Proyecto grande: vende primero un análisis GAP"]);
  }
  if(modo==="gap"){
    titulo="Análisis GAP";apps=appsDe("g");areasApps=areasDe("g");
    const r=[["Preparación y cierre",P.gBase],["Usuarios ("+v("g-usr")+")",tier(P.gUsuarios,v("g-usr"))],["Empresas adicionales",Math.max(0,v("g-emp")-1)*P.gEmpresa],
      ["Áreas ("+v("g-areas")+" × "+P.gArea+" h)",v("g-areas")*P.gArea],["Sucursales o plantas",tier(P.gSuc,v("g-suc"))],
      ["Revisión de Odoo actual",on("g-odoo")?P.gOdoo:0],["Especificación de desarrollos",on("g-dev")?P.gDev:0],["Visita en sitio",on("g-visita")?P.gVisita:0]];
    horas=r.reduce((s,x)=>s+x[1],0);
    viat=on("g-visita")?v("g-viat"):0;
    const red=Math.max(1,P.gRedondeo);sub=arriba(horas*P.tarifa+viat,red)-viat;
    desg=[...r.filter(x=>x[1]).map(x=>[x[0],hrs(x[1])]),["Total de horas",hrs(horas),"t"],["Tarifa por hora",money(P.tarifa)]];
    dur=horas<=20?"1 a 2 semanas":horas<=40?"2 a 4 semanas":"4 a 6 semanas";
    detalle=`Análisis de brechas (GAP) para ${v("g-usr")} usuarios, ${v("g-emp")} empresa${v("g-emp")>1?"s":""}, ${v("g-areas")} áreas y ${v("g-suc")} sucursales o plantas. Entregables: documento de análisis GAP, reportes del proceso actual contra Odoo${on("g-dev")?", lista y especificación preliminar de desarrollos":""} y propuesta de fases para el proyecto.`;
    conceptos=[[`Análisis GAP (${hrs(horas)})`,sub]];
  }

  sub=Math.round(sub);viat=Math.round(viat);conceptos=conceptos.map(c=>[c[0],Math.round(c[1])]);
  const dAmt=Math.round(sub*desc),subD=sub-dAmt,iva=Math.round((subD+viat)*P.iva/100),total=subD+viat+iva,com=Math.round(subD*canal.c/100);
  const anticipo=Math.round(total*P.anticipo/100);
  const aprobado=!!ctx.aprobado;
  const requiere=descPct>P.descMax&&!ctx.admin&&!aprobado;
  const descAviso=descPct>P.descMax?(ctx.admin?"admin":aprobado?"aprobado":"pendiente"):null;
  if(descAviso==="pendiente")flags.push(["alerta","Descuento requiere autorización"]);
  let pagos=modo==="proy"?P.fases.map(x=>[x.n,x.p,Math.round(total*x.p/100)]):[["Anticipo",P.anticipo,anticipo],["Saldo por hitos",100-P.anticipo,total-anticipo]];
  if(modo==="proy"&&pagos.length&&P.fases.reduce((a,x)=>a+(+x.p||0),0)===100){const resto=total-pagos.slice(0,-1).reduce((a,x)=>a+x[2],0);pagos[pagos.length-1][2]=resto;}
  const uLic=modo==="horas"?v("h-emp"):modo==="proy"?v("p-usr"):v("g-usr");
  const custom=(modo==="proy"&&v("p-dev")>0)||(modo==="gap"&&on("g-dev"));
  const pLic=custom?P.licCustom:P.licStandard;
  const lic=pLic>0&&uLic>0?{plan:custom?"Personalizado":"Estándar",u:uLic,mes:pLic*uLic}:null;
  return {modo,titulo,horas,sub,dAmt,anticipo,descPct,subD,viat,iva,total,com,canal,dur,detalle,apps,conceptos,requiere,flags,pagos,fasesH,lic,cred,
    gapFolio:modo==="proy"?String(e["p-gapfolio"]??""):"",desg,paquete,descAviso,areasApps};
}

/* Texto corto con las aplicaciones de una cotización guardada (para el Excel del historial) */
const appsTexto=e=>{const r=cotizar(e,DEF);return r.apps.map(a=>`${a[0]}: ${a[1].join(", ")}`).join(" | ");};

const api={DEF,APPS,APP,NOTA_APPS,AREAS,AREA_APPS,APP_AREA,numTxt,fmtN,limpio,arriba,money,hrs,tier,cotizar,appsTexto};
if(typeof module!=="undefined"&&module.exports)module.exports=api;else raiz.Cotizador=api;
})(this);
