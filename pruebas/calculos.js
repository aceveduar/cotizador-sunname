// Pruebas de cálculo: referencia independiente vs. lo que muestra el cotizador
(async()=>{
const W=ms=>new Promise(r=>setTimeout(r,ms));
const out=[];const log=(ok,n,d)=>out.push((ok?"OK  ":"FALLA ")+n+(d?" | "+d:""));
await W(800);
const $=id=>document.getElementById(id);
const fire=(el,t)=>el.dispatchEvent(new Event(t,{bubbles:true}));
function setVal(id,v){const i=$(id);i.value=v;fire(i,"input");}
function setChk(id,v){const i=$(id);i.checked=v;fire(i,"change");}
function radio(name,val){const r=document.querySelector(`input[name="${name}"][value="${val}"]`);r.checked=true;fire(r,"change");}
const num=t=>{const m=String(t).replace(/[^\d.-]/g,"");return m?parseFloat(m):0;};
function leer(){
  const filas={};document.querySelectorAll("#r-filas .fila").forEach(f=>{const s=f.querySelectorAll("span");filas[s[0].textContent.split(" ")[0]]=num(s[1].textContent);});
  const int={};document.querySelectorAll("#r-int .fila").forEach(f=>{const s=f.querySelectorAll("span");int[s[0].textContent.split(" ")[0]]=s[1].textContent;});
  const pag=[...document.querySelectorAll("#r-pagos .fila span:last-child")].map(x=>num(x.textContent));
  return {total:num($("r-total").firstChild.textContent),sub:filas.Subtotal||0,viat:filas["Viáticos"]||0,iva:filas.IVA||0,precioLista:filas.Precio||null,
    horas:num(($("r-modo").textContent.split("·")[1]||"0")),com:num(int["Comisión"]||0),pdf:!$("b-pdf").disabled,estado:$("r-estado").textContent,pagos:pag,anticipo:filas.Anticipo||null};
}
function reset(){
  ["a-ventas","a-fin","a-log","a-web","a-rh","a-pos","a-serv","a-mrp"].forEach((id,i)=>setChk(id,false));
  setVal("desc",0);radio("canal","vendedor");radio("margen","B");
}
// ---------- referencia ----------
const ODOO=[[25,19550],[50,38080],[100,68000],[200,136000]];
function refHoras(areas,emp,mk){let w=0;areas.forEach(a=>w+=a==="mrp"?2:1);let t=w<=0?-1:w<=1?0:w<=3?1:w<=5?2:3;if(t>=0&&t<3&&emp>50)t++;if(t<0)return {horas:0,sub:0,viat:0};return {horas:ODOO[t][0],sub:Math.round(ODOO[t][1]*(100+mk)/100),viat:0};}
const usrT=u=>u<=3?25:u<=5?30:u<=10?50:u<=20?100:u<=50?150:u<=100?200:260;
function refProy(o,g=10,c=20,tf=1000,td=1000,ts=1000){
  const bF=usrT(o.u)+Math.max(1,o.ar)*20+(Math.max(1,o.em)-1)*15+o.nv*o.hv*Math.max(1,o.co);
  const up=(n)=>Math.floor((n*(100+g)*(100+c)+49999)/50000)*5; // entero exacto
  const impF=up(bF),impD=o.dev?up(o.dev):0,post=o.pm*o.pmh;
  return {horas:impF+impD+post,sub:impF*tf+impD*td+post*ts,viat:o.nv*o.vv,impF,impD};
}
const gU=u=>u<=10?0:u<=25?1:u<=50?2:u<=100?3:5, gS=s=>s<=1?0:s<=3?2:s<=6?4:s<=10?6:8;
function refGap(o){const h=4+gU(o.u)+Math.max(0,o.em-1)*2+o.ar*3+gS(o.suc)+(o.odoo?2:0)+(o.dev?4:0)+(o.vis?5:0);const viat=o.vis?o.viat:0;const sub=Math.ceil((h*1000+viat)/1000)*1000-viat;return {horas:h,sub,viat};}
function fin(r,desc,canalPct){const dAmt=Math.round(r.sub*desc/100),subD=r.sub-dAmt,iva=Math.round((subD+r.viat)*0.16),total=subD+r.viat+iva;return {...r,subD,iva,total,com:Math.round(subD*canalPct/100)};}
function comparar(n,e,g){
  const errs=[];
  if(e.horas!==g.horas)errs.push(`horas ${g.horas}≠${e.horas}`);
  if(e.subD!==g.sub)errs.push(`subtotal ${g.sub}≠${e.subD}`);
  if(e.viat!==g.viat)errs.push(`viáticos ${g.viat}≠${e.viat}`);
  if(e.iva!==g.iva)errs.push(`IVA ${g.iva}≠${e.iva}`);
  if(e.total!==g.total)errs.push(`total ${g.total}≠${e.total}`);
  if(e.com!==g.com)errs.push(`comisión ${g.com}≠${e.com}`);
  if(g.sub+g.viat+g.iva!==g.total)errs.push("la suma visible no cuadra");
  log(!errs.length,n,errs.join(", ")||`total $${g.total.toLocaleString("es-MX")}`);
}
// ---------- Paquete de horas ----------
radio("modo","horas");
const H=[["H1 3 áreas, 10 emp, 40%",["ventas","fin","log"],10,"B",40],["H2 1 área, 30%",["ventas"],5,"A",30],["H3 ventas+log+manufactura (cuenta doble)",["ventas","log","mrp"],5,"B",40],
  ["H4 todas las áreas",["ventas","fin","log","web","rh","pos","serv","mrp"],1,"B",40],["H5 3 áreas, 60 empleados (sube nivel)",["ventas","fin","log"],60,"B",40],
  ["H6 6 áreas, 60 empleados (ya es el máximo)",["ventas","fin","log","web","rh","pos"],60,"A",30],["H7 4 áreas exacto en 51 empleados",["ventas","fin","log","web"],51,"A",30]];
for(const [n,ar,emp,m,mk] of H){reset();radio("modo","horas");ar.forEach(a=>setChk("a-"+a,true));setVal("h-emp",emp);radio("margen",m);comparar(n,fin(refHoras(ar,emp,mk),0,5),leer());}
reset();radio("modo","horas");{const g=leer();log(g.horas===0&&!g.pdf&&/áreas/.test(g.estado),"H8 sin áreas: bloquea PDF y avisa",g.estado);}
reset();radio("modo","horas");["ventas","fin","log"].forEach(a=>setChk("a-"+a,true));setVal("h-emp",10);setVal("desc",15);comparar("H9 con 15% de descuento",fin(refHoras(["ventas","fin","log"],10,40),15,5),leer());
{const g=leer();log(g.anticipo===Math.round(g.total*0.3),"H10 anticipo 30% del total",`$${g.anticipo}`);}
reset();radio("modo","horas");setChk("a-ventas",true);radio("canal","direccion");comparar("H11 venta de Dirección: sin comisión",fin(refHoras(["ventas"],10,40),0,0),leer());
// ---------- Proyecto ----------
radio("modo","proy");
const Pz=[["P1 valores de ejemplo",{u:25,ar:5,em:1,co:2,nv:4,hv:8,vv:3000,dev:40,pm:3,pmh:10}],["P2 mínimo (3 usuarios, 1 área, sin visitas)",{u:3,ar:1,em:1,co:1,nv:0,hv:8,vv:3000,dev:0,pm:0,pmh:10}],
  ["P3 grande (120 usuarios, 3 empresas)",{u:120,ar:10,em:3,co:3,nv:6,hv:8,vv:4500,dev:100,pm:6,pmh:20}],["P4 bordes de tabla (usuarios 50, 51)",{u:50,ar:2,em:2,co:1,nv:1,hv:4,vv:2500,dev:5,pm:1,pmh:5}],
  ["P5 51 usuarios",{u:51,ar:2,em:2,co:1,nv:1,hv:4,vv:2500,dev:5,pm:1,pmh:5}],["P6 áreas en 0 se toma como 1",{u:10,ar:0,em:0,co:0,nv:0,hv:8,vv:0,dev:0,pm:0,pmh:0}]];
for(const [n,o] of Pz){reset();radio("modo","proy");setVal("p-usr",o.u);setVal("p-areas",o.ar);setVal("p-emp",o.em);setVal("p-cons",o.co);setVal("p-nvis",o.nv);setVal("p-hvis",o.hv);setVal("p-vvis",o.vv);setVal("p-dev",o.dev);setVal("p-pm",o.pm);setVal("p-pmh",o.pmh);
  comparar(n,fin(refProy(o),0,5),leer());}
{const g=leer();const s=g.pagos.reduce((a,b)=>a+b,0);log(s===g.total,"P7 plan de pagos suma el total",`${g.pagos.join(" + ")} = ${s}`);}
reset();radio("modo","proy");const o1={u:25,ar:5,em:1,co:2,nv:4,hv:8,vv:3000,dev:40,pm:3,pmh:10};
Object.entries({"p-usr":25,"p-areas":5,"p-emp":1,"p-cons":2,"p-nvis":4,"p-hvis":8,"p-vvis":3000,"p-dev":40,"p-pm":3,"p-pmh":10}).forEach(([k,v])=>setVal(k,v));
setVal("desc",7);comparar("P8 con 7% de descuento",fin(refProy(o1),7,5),leer());
{const g=leer();const s=g.pagos.reduce((a,b)=>a+b,0);log(s===g.total,"P9 plan de pagos cuadra con descuento",`${s} vs ${g.total}`);}
// crédito GAP
setVal("desc",0);$("p-gapfolio").value="SUN-2026-9999";$("p-gapmonto").value="44000";setChk("p-gapcred",true);
{const r=refProy(o1);r.sub-=44000;comparar("P10 crédito por GAP de $44,000",fin(r,0,5),leer());}
setChk("p-gapcred",false);comparar("P11 crédito GAP desactivado",fin(refProy(o1),0,5),leer());
$("p-gapfolio").value="";$("p-gapmonto").value="0";fire($("p-gapmonto"),"input");
// tarifas distintas y porcentajes raros (prueba de redondeo)
const setCfg=(k,v)=>{const i=document.querySelector(`#secs [data-k="${k}"]`);i.value=v;fire(i,"input");};
setCfg("tarifaDev",1500);setCfg("tarifaSoporte",800);
comparar("P12 tarifa desarrollo $1,500 y soporte $800",fin(refProy(o1,10,20,1000,1500,800),0,5),leer());
setCfg("gestion",15);setCfg("conting",25);
let malos=0;for(const u of [3,7,12,25,40]){for(const ar of [1,3,5,8]){setVal("p-usr",u);setVal("p-areas",ar);const e=fin(refProy({...o1,u,ar},15,25,1000,1500,800),0,5),g=leer();if(e.total!==g.total||e.horas!==g.horas)malos++;}}
log(!malos,"P13 gestión 15% / contingencia 25%: 20 combinaciones",malos?malos+" diferencias":"sin diferencias de redondeo");
setCfg("gestion",10);setCfg("conting",20);setCfg("tarifaDev",1000);setCfg("tarifaSoporte",1000);
// ---------- Análisis GAP ----------
const G=[["G1 valores de ejemplo",{u:60,em:2,ar:8,suc:3,odoo:false,dev:true,vis:true,viat:10000}],["G2 chico sin visita",{u:5,em:1,ar:2,suc:0,odoo:false,dev:false,vis:false,viat:10000}],
  ["G3 grande con viáticos impares",{u:200,em:4,ar:12,suc:15,odoo:true,dev:true,vis:true,viat:12345}],["G4 bordes (10 usuarios, 1 sucursal)",{u:10,em:1,ar:1,suc:1,odoo:true,dev:false,vis:true,viat:0}]];
for(const [n,o] of G){reset();radio("modo","gap");setVal("g-usr",o.u);setVal("g-emp",o.em);setVal("g-areas",o.ar);setVal("g-suc",o.suc);setChk("g-odoo",o.odoo);setChk("g-dev",o.dev);setChk("g-visita",o.vis);setVal("g-viat",o.viat);
  comparar(n,fin(refGap(o),0,5),leer());}
setVal("desc",5);comparar("G5 GAP grande con 5% de descuento",fin(refGap({u:10,em:1,ar:1,suc:1,odoo:true,dev:false,vis:true,viat:0}),5,5),leer());
setVal("desc",150);{const g=leer();log(g.total>=0&&num($("desc").value)<=150,"G6 descuento 150% no da negativos",`total $${g.total}`);}
setVal("desc",0);
// correo y texto
{const t=$("r-texto").textContent;log(/Asunto:/.test(t)&&t.includes(document.getElementById("r-total").firstChild.textContent.trim()),"T1 el correo incluye asunto y total");}
const pre=document.createElement("pre");pre.id="TEST";pre.textContent=out.join("\n");document.body.appendChild(pre);
})();
