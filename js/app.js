/* =====================================================================
   Cotizador Sunname · App (pantalla, PDF, historial, configuración, notas y Supabase)
   El cálculo de precios vive en js/calculos.js.
   ===================================================================== */
(function(){
const {DEF,APPS,APP,NOTA_APPS,AREAS,AREA_APPS,numTxt,fmtN,money,hrs,cotizar,appsTexto}=window.Cotizador;
const ESTADOS=[["borrador","Borrador"],["por_autorizar","Por autorizar"],["autorizada","Autorizada"],["enviada","Enviada"],["ganada","Ganada"],["perdida","Perdida"]];
const EST=Object.fromEntries(ESTADOS);

const clone=o=>JSON.parse(JSON.stringify(o));
/* repara textos con acentos dañados por una codificación incorrecta (p. ej. "DirecciÃ³n") */
const reparaTexto=t=>{if(typeof t!=="string"||!/[ÃÂ]/.test(t))return t;try{const b=Uint8Array.from([...t].map(c=>{const x=c.charCodeAt(0);if(x>255)throw 0;return x;}));return new TextDecoder("utf-8",{fatal:true}).decode(b);}catch(e){return t;}};
const reparar=o=>Array.isArray(o)?o.map(reparar):o&&typeof o==="object"?Object.fromEntries(Object.entries(o).map(([k,v])=>[k,reparar(v)])):reparaTexto(o);
const merge=d=>{const p=clone(DEF);if(d){d=reparar(d);for(const k in DEF)if(d[k]!==undefined&&d[k]!==null&&typeof d[k]===typeof DEF[k])p[k]=clone(d[k]);}return p;};
let P=clone(DEF);
try{const s=localStorage.getItem("sunname-cfg");if(s)P=merge(JSON.parse(s));}catch(e){}

const ajena=q=>!S.admin&&!!S.meId&&!!q&&!!q.creadoPor&&q.creadoPor!==S.meId;
const S={db:null,user:null,dl:null,meId:null,admin:false,quotes:[],aprob:{},names:{},
  currentId:null,currentFolio:"",currentDoc:null,dirty:false,showInt:false,quien:"todas",fEstado:"activas",R:null};
try{S.showInt=localStorage.getItem("sunname-int")==="1";}catch(e){}

const $=id=>document.getElementById(id);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const v=id=>Math.max(0,numTxt($(id).value));
document.addEventListener("focusout",e=>{if(e.target.matches&&e.target.matches("[data-money]"))e.target.value=fmtN(e.target.value);});
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fecha=iso=>new Date(iso).toLocaleDateString("es-MX",{day:"numeric",month:"short",year:"numeric"});
function toast(t){const e=$("toast");e.textContent=t;e.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>e.hidden=true,3200);}

/* =================== Marca =================== */
/* Logo Sunname (PNG con fondo transparente). El oscuro tiene letras blancas para el modo oscuro. */
const LOGO_CLARO="img/logo-claro.png";
const LOGO_OSCURO="img/logo-oscuro.png";
const LOGO=LOGO_CLARO;
$("logo-c").src=LOGO_CLARO;$("logo-o").src=LOGO_OSCURO;
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function hexOk(h){return /^#[0-9a-f]{6}$/i.test(h);}
function lum(h){const n=parseInt(h.slice(1),16),c=[n>>16&255,n>>8&255,n&255].map(x=>{x/=255;return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4)});return .2126*c[0]+.7152*c[1]+.0722*c[2];}

/* =================== Formulario =================== */
function stepper(id,label,val,step=1,hint="",dinero=false){
  const inp=dinero?`<span class="pre">$</span><input id="${id}" type="text" inputmode="numeric" data-money min="0" value="${fmtN(val)}">`:`<input id="${id}" type="number" min="0" value="${val}">`;
  return `<label class="campo"><span>${label}</span><div class="stepper" data-step="${step}"><button type="button" aria-label="Menos">−</button>${inp}<button type="button" aria-label="Más">+</button></div>${hint?`<small>${hint}</small>`:""}</label>`;
}
$("areas").innerHTML=AREAS.map(a=>`<label class="chip"><input type="checkbox" id="a-${a[0]}" ${a[3]?"checked":""}><span class="dot"></span><span>${a[1]}${a[2]>1?" <small>cuenta doble</small>":""}<span class="apps">${a[4].join(", ")}</span></span></label>`).join("");
$("p-alc").innerHTML=stepper("p-usr","Usuarios",25)+stepper("p-areas","Áreas o departamentos",5)+stepper("p-emp","Empresas",1)+stepper("p-cons","Consultores asignados",2);
$("p-vis").innerHTML=stepper("p-nvis","Número de visitas",4)+stepper("p-hvis","Horas por visita",8)+stepper("p-vvis","Viáticos por visita",3000,500,"",true);
$("p-ext").innerHTML=stepper("p-dev","Horas de desarrollo",0,5,"Validadas por el área técnica")+stepper("p-pm","Meses de soporte",3,1,"Después de salir a producción")+stepper("p-pmh","Horas por mes",10);
$("g-alc").innerHTML=stepper("g-usr","Usuarios",60)+stepper("g-emp","Empresas",2)+stepper("g-areas","Áreas a analizar",8)+stepper("g-suc","Sucursales o plantas",3);
$("g-viat-w").innerHTML=stepper("g-viat","Viáticos estimados",10000,1000,"",true);
const appsHTML=pre=>APPS.map(([cat,l],i)=>`<details class="apps-cat" data-cat="${pre}-${i}"><summary>${cat}<span class="cnt" hidden></span></summary><div class="chips compact">${l.map(a=>`<label class="chip"><input type="checkbox" id="${pre}-app-${a[0]}" ${a[2]?"checked":""}><span class="dot"></span>${a[1]}</label>`).join("")}</div></details>`).join("");
$("p-apps").innerHTML=appsHTML("p");$("g-apps").innerHTML=appsHTML("g");
$$("[data-nota-apps]").forEach(e=>e.textContent=NOTA_APPS);
/* contador por categoría y resumen de lo elegido; con abrir=true despliega solo las categorías que tienen algo marcado */
function syncApps(pre,abrir){
  const nombres=[];
  APPS.forEach(([cat,l],i)=>{
    const sel=l.filter(a=>$(pre+"-app-"+a[0]).checked),det=document.querySelector(`[data-cat="${pre}-${i}"]`),c=det.querySelector(".cnt");
    c.hidden=!sel.length;c.textContent=sel.length;if(abrir)det.open=sel.length>0;nombres.push(...sel.map(a=>a[1]));
  });
  const n=nombres.length,lista=n>8?nombres.slice(0,8).join(", ")+` y ${n-8} más`:nombres.join(", ");
  $(pre+"-apps-sel").innerHTML=n?`<b>${n} seleccionada${n>1?"s":""}:</b> ${esc(lista)}`:"Ninguna aplicación seleccionada. Abre una categoría para elegir.";
}
syncApps("p",true);syncApps("g",true);
["h-emp","p-areas","p-emp","p-cons","g-emp","g-areas"].forEach(id=>$(id).setAttribute("min","1"));
["p-areas","g-areas"].forEach(id=>$(id).closest(".campo").insertAdjacentHTML("beforeend",`<small id="${id}-hint" aria-live="polite"></small>`));
const FRESH=snapshot();

function drawDynamic(){
  const mSel=(document.querySelector("input[name=margen]:checked")||{}).value||"B";
  $("margenes").innerHTML=[["A",P.margenA],["B",P.margenB]].map(m=>`<label><input type="radio" name="margen" value="${m[0]}" ${m[0]===mSel?"checked":""}>${m[1]}%</label>`).join("");
  const cSel=(document.querySelector("input[name=canal]:checked")||{}).value||"vendedor";
  $("canales").innerHTML=P.canales.map(c=>`<label><input type="radio" name="canal" value="${c.id}" ${c.id===cSel?"checked":""}>${esc(c.n)}</label>`).join("");
}
drawDynamic();

document.addEventListener("click",e=>{
  const b=e.target.closest(".stepper button");if(!b)return;
  const s=b.parentElement,inp=s.querySelector("input"),st=parseFloat(s.dataset.step)||1;
  let n=numTxt(inp.value)+(b===s.firstElementChild?-st:st);
  n=Math.max(parseFloat(inp.getAttribute("min"))||0,n);if(inp.max)n=Math.min(parseFloat(inp.max),n);
  inp.value=inp.hasAttribute("data-money")?fmtN(n):n;cambio();
});
function cambio(){if(S.currentId)S.dirty=true;calc();}
/* Cliente obligatorio: se marca el campo y se explica debajo, en lugar de solo un aviso que desaparece */
function faltaCliente(){const c=$("cliente");c.classList.add("falta");c.setAttribute("aria-invalid","true");$("cliente-err").hidden=false;c.scrollIntoView({behavior:"smooth",block:"center"});c.focus({preventScroll:true});}
$("cliente").addEventListener("input",()=>{if($("cliente").value.trim()){$("cliente").classList.remove("falta");$("cliente").removeAttribute("aria-invalid");$("cliente-err").hidden=true;}});
function pasarApps(de,a){
  let ids=[];
  if(de==="horas"){if(!S.horasTocado)return;AREAS.forEach(x=>{if($("a-"+x[0]).checked)ids.push(...AREA_APPS[x[0]]);});}
  else ids=Object.keys(APP).filter(id=>$(de[0]+"-app-"+id).checked);
  const pre=a[0];let n=0;
  new Set(ids).forEach(id=>{const c=$(pre+"-app-"+id);if(c&&!c.checked){c.checked=true;n++;}});
  if(n){syncApps(pre,true);toast(`Se agregaron ${n} aplicaci${n>1?"ones":"ón"} de lo que elegiste en ${de==="horas"?"Paquete de horas":de==="proy"?"Proyecto":"Análisis GAP"}`);}
}
// "input" llega antes que el recálculo general, que es el que actualiza S.modoAct
$$("input[name=modo]").forEach(r=>r.addEventListener("input",()=>{if(r.checked&&r.value!=="horas"&&S.modoAct&&S.modoAct!==r.value)pasarApps(S.modoAct,r.value);}));
$("areas").addEventListener("change",()=>{S.horasTocado=true;});
$("v-cot").addEventListener("input",cambio);
$("v-cot").addEventListener("change",e=>{if(e.target.type==="radio"||e.target.type==="checkbox")cambio();});

function snapshot(){const o={};$$("#v-cot input").forEach(i=>{if(i.type==="radio"){if(i.checked)o["r:"+i.name]=i.value;}else if(i.type==="checkbox")o[i.id]=i.checked;else if(i.id)o[i.id]=i.value;});return o;}
function restore(o){
  for(const k in o){
    if(k.startsWith("r:")){const r=document.querySelector(`input[name="${CSS.escape(k.slice(2))}"][value="${CSS.escape(String(o[k]))}"]`);if(r)r.checked=true;}
    else{const i=$(k);if(!i)continue;if(i.type==="checkbox")i.checked=!!o[k];else i.value=o[k];}
  }
  $("mas-cliente").open=!!(o.contacto||o.correo||o.telefono);
  syncApps("p",true);syncApps("g",true);
  S.horasTocado=o!==FRESH&&o["r:modo"]==="horas";
  $("cliente").classList.remove("falta");$("cliente").removeAttribute("aria-invalid");$("cliente-err").hidden=true;
}

/* =================== Cálculo =================== */
function calc(){
  const e=snapshot(),modo=e["r:modo"]||"horas";S.modoAct=modo;
  $$("[data-pane]").forEach(p=>p.hidden=p.dataset.pane!==modo);
  $$(".modo").forEach(l=>l.classList.toggle("on",l.querySelector("input").checked));
  const descSol=Math.min(100,v("desc"));
  const aprobado=!!(S.currentId&&S.aprob[S.currentId]&&S.aprob[S.currentId].desc>=descSol);
  const R=cotizar(e,P,{admin:S.admin,aprobado});
  const {titulo,horas,sub,dAmt,anticipo,descPct,subD,viat,iva,total,com,canal,dur,detalle,apps,flags,pagos,lic,desg,requiere}=R;

  if(modo==="horas"){const pk=R.paquete;$("paquete").innerHTML=pk?`<div class="h num">${pk.h} h</div><span>Paquete recomendado para ${pk.n} área${pk.n>1?"s":""}${pk.masEmp?" y más de "+P.empTier+" empleados":""}.</span>`:`<span>Selecciona al menos un área para ver el paquete.</span>`;}
  if(modo==="proy"){
    syncApps("p");
    const gf=$("p-gapfolio").value;$("p-gap-w").hidden=!gf;
    if(gf){$("p-gap-lbl").textContent=gf;$("p-gap-hint").textContent=`Se acredita el ${P.gapCredito}% de ${money(v("p-gapmonto"))} pagados por el análisis`;}
  }
  // cuántas áreas de negocio tienen aplicaciones elegidas (Productividad es transversal y no cuenta)
  if(modo!=="horas"){
    const id=modo==="proy"?"p-areas":"g-areas",h=$(id+"-hint"),n=R.areasApps.length,dif=n>0&&n!==Math.max(1,v(id));
    h.textContent=n?`Elegiste aplicaciones de ${n} área${n>1?"s":""}`+(dif?"; revisa este número":""):"";h.classList.toggle("aviso",dif);h.title=R.areasApps.join(", ");
  }
  if(modo==="gap"){syncApps("g");$("g-viat-w").hidden=!$("g-visita").checked;}
  const da=$("desc-aviso");da.hidden=!R.descAviso;
  if(R.descAviso==="admin"){da.className="nota aviso";da.textContent=`Descuento arriba del máximo de ${P.descMax}%. Como administración puedes emitirlo directamente.`;}
  else if(R.descAviso==="aprobado"){da.className="nota ok";da.textContent=`Descuento de ${descPct}% autorizado por la administración.`;}
  else if(R.descAviso==="pendiente"){da.className="nota aviso";da.textContent=`El máximo sin autorización es ${P.descMax}%. Guarda y solicita autorización para poder descargar el PDF.`;}

  $("r-modo").textContent=titulo+(horas?" · "+hrs(horas):"");
  $("r-total").innerHTML=money(total)+"<small>MXN</small>";
  $("r-bajo").textContent="Total con IVA"+(dur?" · "+dur:"");
  const f=flags.find(x=>x[0]==="alerta")||flags[0],st=$("r-estado");
  st.className="estado"+(f?" "+f[0]:"");st.textContent=f?f[1]:"Lista para enviar";
  const filas=[];
  {const n=modo==="horas"?new Set(apps.flatMap(c=>c[1])).size:apps.reduce((a,c)=>a+c[1].length,0);if(n||modo!=="horas")filas.push(["Aplicaciones de Odoo",String(n),"d"]);}
  if(dAmt)filas.push(["Precio de lista",money(sub),"d"],["Descuento "+descPct+"%","−"+money(dAmt),"d"]);
  filas.push(["Subtotal",money(subD)]);if(viat)filas.push(["Viáticos",money(viat)]);
  filas.push(["IVA "+P.iva+"%",money(iva)],["Total",money(total),"t"]);
  if(modo!=="proy")filas.push(["Anticipo "+P.anticipo+"%",money(anticipo),"d"]);
  else if(pagos.length)filas.push(["Primer pago "+pagos[0][1]+"%",money(pagos[0][2]),"d"]);   // el plan completo está en Desglose
  const row=r=>`<div class="fila ${r[2]||""}"><span>${esc(r[0])}</span><span>${r[1]}</span></div>`;
  $("r-filas").innerHTML=filas.map(row).join("");
  $("r-desglose").innerHTML=desg.map(row).join("");
  $("r-pagos-w").hidden=modo!=="proy";
  if(modo==="proy")$("r-pagos").innerHTML=pagos.map(x=>row([x[0]+" ("+x[1]+"%)",money(x[2])])).join("");
  $("r-lic").hidden=!lic;
  if(lic)$("r-lic").innerHTML=row([`Licencias Odoo ${lic.plan}, ${lic.u} usuarios (no incluidas)`,money(lic.mes)+"/mes","d"]);
  $("r-int").innerHTML=[["Canal",esc(canal.n)],["Comisión "+canal.c+"%",money(com)],["Ingreso neto Sunname",money(subD-com)]].map(row).join("");
  $("r-int").hidden=!S.showInt;$("ojo-l").textContent=S.showInt?"Ocultar":"Mostrar";$("ojo").setAttribute("aria-expanded",String(S.showInt));
  $("b-total").textContent=money(total);$("b-modo").textContent=titulo+" · con IVA";

  // acciones
  const pdf=$("b-pdf"),gu=$("b-guardar");
  const pendiente=S.currentDoc&&S.currentDoc.estado==="por_autorizar"&&!S.dirty;
  if(requiere){
    pdf.disabled=true;pdf.querySelector("span").textContent="PDF disponible al autorizar";
    gu.textContent=pendiente?"Esperando autorización":"Solicitar autorización";gu.disabled=pendiente||!S.db;
  }else{
    pdf.disabled=!!f&&f[1]==="Falta seleccionar áreas";pdf.querySelector("span").textContent="Descargar PDF";
    gu.disabled=!S.db||(S.currentId&&!S.dirty);gu.textContent=S.currentId?(S.dirty?"Guardar cambios":"Guardada"):"Guardar";
  }
  $("folio-chip").hidden=!S.currentFolio;$("folio-chip").textContent=S.currentFolio?(S.dirty?"Editando ":"")+S.currentFolio:"";
  $("nueva").hidden=!S.currentId;
  $("cot-h1").textContent=S.currentId?($("cliente").value||"Cotización"):"¿Qué vas a cotizar?";

  const cli=$("cliente").value.trim();
  const emp=P.empresa||"Sunname",contacto=$("contacto").value.trim().split(/[,(]/)[0].trim();
  const pagosTxt=modo==="proy"?"Plan de pagos:\n"+pagos.map(x=>`  - ${x[0]}: ${x[1]}% (${money(x[2])})`).join("\n"):`Forma de pago: ${P.pago}. Anticipo: ${money(anticipo)}.`;
  const firma=[S.names[S.meId],emp,P.telEmpresa,P.correoEmpresa].filter(Boolean).join("\n");
  const texto=`Asunto: Cotización ${S.currentFolio?S.currentFolio+" · ":""}${titulo} · ${cli||"tu empresa"}

Hola${contacto?" "+contacto:""}:

Gracias por considerar a ${emp}. Te comparto la cotización de ${titulo.toLowerCase()} para ${cli||"tu empresa"}.

${detalle}

${apps.length?"Aplicaciones de Odoo (funcionalidad estándar; adecuaciones e integraciones se cotizan aparte):\n"+apps.map(a=>`  - ${a[0]}: ${a[1].join(", ")}`).join("\n")+"\n\n":""}Horas estimadas: ${hrs(horas)}
Duración estimada: ${dur||"—"}
Inversión: ${money(subD)} + IVA${viat?" + viáticos ("+money(viat)+")":""} = ${money(total)} MXN${dAmt?" (incluye descuento de "+money(dAmt)+")":""}
${pagosTxt}
${lic?`Referencia de licencias Odoo ${lic.plan}: ${money(lic.mes)} al mes por ${lic.u} usuarios (no incluidas en esta cotización).\n`:""}Vigencia: ${P.vigencia} días.

Adjunto el PDF con el detalle. Quedo atento a tus comentarios.

Saludos,
${firma}`;
  $("r-texto").textContent=texto;
  S.R={...R,texto,cliente:cli};
  return S.R;
}

$("ojo").addEventListener("click",()=>{S.showInt=!S.showInt;try{localStorage.setItem("sunname-int",S.showInt?"1":"0");}catch(e){}calc();});
$("b-copiar").addEventListener("click",()=>{
  const t=S.R.texto;
  try{navigator.clipboard.writeText(t).then(()=>toast("Correo copiado. Pégalo en tu correo y adjunta el PDF."),()=>{$("r-txt").hidden=false;$("r-txt").open=true;toast("Selecciona el texto del correo y cópialo manualmente");});}catch(e){$("r-txt").hidden=false;$("r-txt").open=true;}
});
$("b-ver").addEventListener("click",()=>$("resumen").scrollIntoView({behavior:"smooth",block:"start"}));
$("nueva").addEventListener("click",nueva);
function nueva(){S.currentId=null;S.currentFolio="";S.currentDoc=null;S.dirty=false;restore(FRESH);drawDynamic();calc();window.scrollTo(0,0);}

/* =================== Guardar / folio =================== */
async function nuevoFolio(){
  if(S.sb){const {data,error}=await S.sb.rpc("siguiente_folio");if(error)throw {code:"unavailable",message:error.message};return data;}
  const y=new Date().getFullYear(),ref=S.db.doc("meta/folio");
  const s=await ref.get();const d=s.exists?s.data():{};const n=(d.y===y?(d.n||0):0)+1;await ref.set({y,n});
  return `SUN-${y}-${String(n).padStart(4,"0")}`;
}
async function guardar(estadoForzado){
  if(!S.db){toast("Sin conexión con la base de datos. Recarga la página.");return false;}
  const R=calc();
  if(!R.cliente){faltaCliente();return false;}
  if(!R.horas||R.total<=0){toast("Completa la cotización antes de guardar (no tiene horas).");return false;}
  const now=new Date().toISOString();
  try{
    if(!S.currentId){S.currentFolio=await nuevoFolio();S.currentId=S.currentFolio;}
    const prev=S.currentDoc||{};
    let estado=estadoForzado||prev.estado||"borrador";
    if(R.requiere)estado="por_autorizar";
    else if(estado==="por_autorizar")estado="borrador";
    const doc={folio:S.currentFolio,cliente:R.cliente,modo:R.modo,titulo:R.titulo,horas:R.horas,subtotal:Math.round(R.subD),total:Math.round(R.total),
      descPct:R.descPct,canal:R.canal.id,origenGap:R.gapFolio||null,comision:Math.round(R.com),estado,creadoPor:prev.creadoPor||S.meId||null,creado:prev.creado||now,actualizado:now,inputs:snapshot()};
    await S.db.collection("cotizaciones").doc(S.currentId).set(doc);
    S.currentDoc=doc;S.dirty=false;calc();return true;
  }catch(e){toast(e&&e.code==="invalid_argument"?(ajena(S.currentDoc)?"Esta cotización es de otra persona. Usa «Duplicar» para hacer tu propia versión.":"No tienes permiso para guardar esta cotización."):"No se pudo guardar. Intenta de nuevo.");return false;}
}
$("b-guardar").addEventListener("click",async()=>{
  const req=S.R&&S.R.requiere;
  if(await guardar())toast(req?"Solicitud enviada a la administración":"Cotización "+S.currentFolio+" guardada");
});

/* =================== PDF =================== */
function rgb(h){const n=parseInt((hexOk(h)?h:"#1f3a34").slice(1),16);return [n>>16&255,n>>8&255,n&255];}
const pdfTxt=s=>String(s).replace(/[−–—]/g,"-").replace(/×/g,"x").replace(/[“”]/g,'"');
async function logoData(){
  if(!LOGO)return null;
  try{
    const im=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=LOGO;});
    const k=Math.min(1,480/im.naturalWidth),c=document.createElement("canvas");c.width=Math.round(im.naturalWidth*k);c.height=Math.round(im.naturalHeight*k);c.getContext("2d").drawImage(im,0,0,c.width,c.height);
    return {data:c.toDataURL("image/png"),w:im.naturalWidth,h:im.naturalHeight};
  }catch(e){return null;}
}
async function hacerPDF(R){
  const {jsPDF}=window.jspdf;const d=new jsPDF({unit:"pt",format:"a4"});
  const W=d.internal.pageSize.getWidth(),H=d.internal.pageSize.getHeight(),M=48,pri=rgb(css("--marca-primario")),acc=rgb(css("--marca-acento"));
  const T=(s,x,y,o)=>d.text(pdfTxt(s),x,y,o);
  let y=0;const ensure=h=>{if(y+h>H-70){d.addPage();y=60;}};
  const tabla=(titulo,cols,filas)=>{ // cols: [[titulo, x, align]]
    ensure(60+Math.min(filas.length,6)*24);
    d.setTextColor(...pri);d.setFont("helvetica","bold");d.setFontSize(11);T(titulo,M,y);y+=12;
    d.setFillColor(240,244,248);d.rect(M,y,W-2*M,22,"F");d.setTextColor(95,106,102);d.setFontSize(8.5);
    cols.forEach(c=>T(c[0].toUpperCase(),c[1],y+15,{align:c[2]||"left"}));y+=22;
    d.setFont("helvetica","normal");d.setFontSize(10);d.setTextColor(27,34,32);
    filas.forEach(f=>{ensure(24);f.forEach((v,i)=>T(v,cols[i][1],y+16,{align:cols[i][2]||"left"}));y+=24;d.setDrawColor(221,225,220);d.line(M,y,W-M,y);});
    y+=24;
  };
  // encabezado
  const lg=await logoData();
  if(lg){const bh=42,bw=lg.w*bh/lg.h;d.addImage(lg.data,"PNG",M,28,bw,bh,undefined,"FAST");}
  else{d.setTextColor(...pri);d.setFont("helvetica","bold");d.setFontSize(22);T(P.empresa||"Sunname",M,58);}
  d.setTextColor(...pri);d.setFont("helvetica","bold");d.setFontSize(17);T("COTIZACIÓN",W-M,46,{align:"right"});
  d.setFont("helvetica","normal");d.setFontSize(10);d.setTextColor(91,106,126);T((S.currentFolio||"")+"   "+new Date().toLocaleDateString("es-MX",{day:"numeric",month:"long",year:"numeric"}),W-M,63,{align:"right"});
  d.setFillColor(...acc);d.rect(0,92,W,3,"F");
  // cliente
  y=132;d.setTextColor(110,118,115);d.setFontSize(9);const RX=W-M-190;T("CLIENTE",M,y);T("VIGENCIA",RX,y);
  d.setTextColor(27,34,32);d.setFont("helvetica","bold");d.setFontSize(14);T(R.cliente||"-",M,y+18);
  d.setFont("helvetica","normal");d.setFontSize(10);T(P.vigencia+" días",RX,y+18);
  const cont=[$("contacto").value,$("correo").value,$("telefono").value].filter(Boolean).join("  ·  ");
  if(cont){d.setFontSize(10);d.setTextColor(90,98,95);T(cont,M,y+34);}
  d.setTextColor(110,118,115);d.setFontSize(9);T("DURACIÓN ESTIMADA",RX,y+40);d.setTextColor(27,34,32);d.setFontSize(10);d.text(d.splitTextToSize(pdfTxt(R.dur||"-"),190),RX,y+56,{lineHeightFactor:1.35});
  // título y descripción
  y=236;d.setDrawColor(221,225,220);d.line(M,y-14,W-M,y-14);
  d.setTextColor(...pri);d.setFont("helvetica","bold");d.setFontSize(15);T(R.titulo,M,y+8);
  d.setTextColor(60,68,65);d.setFont("helvetica","normal");d.setFontSize(10.5);
  const lines=d.splitTextToSize(pdfTxt(R.detalle),W-2*M);d.text(lines,M,y+28,{lineHeightFactor:1.45});
  y=y+28+lines.length*15.2+18;
  // aplicaciones de Odoo
  if(R.apps&&R.apps.length){
    ensure(60);d.setTextColor(...pri);d.setFont("helvetica","bold");d.setFontSize(11);T(R.modo==="horas"?"Aplicaciones de Odoo incluidas":"Aplicaciones de Odoo consideradas",M,y);y+=18;
    const LW=150;
    R.apps.forEach(a=>{const l=d.splitTextToSize(pdfTxt(a[1].join(", ")),W-2*M-LW);ensure(l.length*13.3+6);
      d.setFont("helvetica","bold");d.setFontSize(10);d.setTextColor(27,34,32);T(a[0],M,y);
      d.setFont("helvetica","normal");d.setTextColor(60,68,65);d.text(l,M+LW,y,{lineHeightFactor:1.35});y+=l.length*13.3+6;});
    d.setFontSize(9);d.setTextColor(110,118,115);const nt=d.splitTextToSize(pdfTxt(NOTA_APPS),W-2*M);ensure(nt.length*12+4);d.text(nt,M,y+4,{lineHeightFactor:1.35});y+=nt.length*12.2+22;
  }
  // tabla de conceptos
  d.setFillColor(240,244,248);d.rect(M,y,W-2*M,26,"F");
  d.setTextColor(95,106,102);d.setFont("helvetica","bold");d.setFontSize(9);T("CONCEPTO",M+12,y+17);T("IMPORTE",W-M-12,y+17,{align:"right"});
  y+=26;d.setFont("helvetica","normal");d.setFontSize(10.5);d.setTextColor(27,34,32);
  const filas=[...R.conceptos];if(R.viat)filas.push(["Viáticos estimados",R.viat]);
  filas.forEach(c=>{const l=d.splitTextToSize(pdfTxt(c[0]),W-2*M-140);ensure(l.length*14+18);d.text(l,M+12,y+20);T(money(c[1]),W-M-12,y+20,{align:"right"});y+=Math.max(32,l.length*14+18);d.setDrawColor(221,225,220);d.line(M,y,W-M,y);});
  // totales
  y+=18;ensure(140);const tx=W-M-230;
  const tot=[["Subtotal",money(R.sub+R.viat)]];
  if(R.dAmt)tot.push([`Descuento ${R.descPct}%`,"-"+money(R.dAmt)]);
  tot.push([`IVA ${P.iva}%`,money(R.iva)]);
  tot.forEach(t=>{d.setTextColor(95,106,102);T(t[0],tx,y);d.setTextColor(27,34,32);T(t[1],W-M-12,y,{align:"right"});y+=18;});
  y+=4;d.setFillColor(...pri);d.roundedRect(tx-12,y-4,W-M-tx+12,34,17,17,"F");
  const tc=[255,255,255];
  d.setTextColor(...tc);d.setFont("helvetica","bold");d.setFontSize(12);T("Total MXN",tx,y+17);T(money(R.total),W-M-12,y+17,{align:"right"});
  y+=46;d.setFont("helvetica","normal");d.setFontSize(10);
  if(R.modo!=="proy"){d.setTextColor(95,106,102);T(`Anticipo ${P.anticipo}%`,tx,y);d.setTextColor(27,34,32);T(money(R.anticipo),W-M-12,y,{align:"right"});}
  y+=36;
  if(R.fasesH){const X=W-M-12;tabla("Fases del proyecto",[["Fase",M+12],["Horas",X,"right"]],R.fasesH.filter(f=>f[1]).map(f=>[f[0],hrs(f[1])]));}
  if(R.modo==="proy"){const X=W-M-12;tabla("Plan de pagos",[["Hito",M+12],["%",X-150,"right"],["Monto",X,"right"]],R.pagos.map(p=>[p[0],p[1]+"%",money(p[2])]));}
  y-=36;
  // condiciones
  y+=36;ensure(120);
  d.setTextColor(...pri);d.setFont("helvetica","bold");d.setFontSize(11);T("Condiciones",M,y);y+=18;
  d.setFont("helvetica","normal");d.setFontSize(9.5);d.setTextColor(60,68,65);
  const cond=[R.modo==="proy"?"Forma de pago: según el plan de pagos por hito.":`Forma de pago: ${P.pago}.`,`Horas estimadas: ${hrs(R.horas)}. Duración estimada: ${R.dur}.`,`Vigencia de la cotización: ${P.vigencia} días.`,
    R.lic?`Referencia de licencias Odoo ${R.lic.plan}: ${money(R.lic.mes)} al mes por ${R.lic.u} usuarios. Las licencias se contratan directamente con Odoo y no están incluidas en esta cotización.`:"",P.terminos].filter(Boolean);
  cond.forEach(c=>{const l=d.splitTextToSize(pdfTxt(c),W-2*M);if(y+l.length*13>H-60){d.addPage();y=60;}d.text(l,M,y,{lineHeightFactor:1.4});y+=l.length*13.3+6;});
  // pie
  const pie=[P.empresa,P.telEmpresa,P.correoEmpresa,P.web].filter(Boolean).join("   ·   ");
  const n=d.getNumberOfPages();
  for(let i=1;i<=n;i++){d.setPage(i);d.setDrawColor(221,225,220);d.line(M,H-44,W-M,H-44);d.setFontSize(8.5);d.setTextColor(120,128,125);T(pie,M,H-28);T(`${i} / ${n}`,W-M,H-28,{align:"right"});}
  return d.output("blob");
}
$("b-pdf").addEventListener("click",async()=>{
  const btn=$("b-pdf"),lab=btn.querySelector("span");
  if(!window.jspdf){toast("No se pudo cargar el generador de PDF. Revisa tu conexión y recarga la página.");return;}
  const R=calc();if(!R.cliente){faltaCliente();return;}
  btn.disabled=true;lab.textContent="Preparando PDF…";
  try{
    if(S.db&&(!S.currentId||S.dirty)){if(!(await guardar()))return;}
    const blob=await hacerPDF(calc());
    const nombre=`Cotizacion ${S.currentFolio||""} ${R.cliente}`.replace(/[\\/:*?"<>|]/g,"").replace(/\s+/g," ").trim()+".pdf";
    if(!S.dl){toast("No se pudo preparar la descarga. Recarga la página.");return;}
    await S.dl.save({filename:nombre,data:blob});
    toast("PDF listo: "+nombre);
  }catch(e){if(!(e&&e.code==="declined"))toast(e&&e.code==="rate_limited"?"Ya hay una descarga abierta. Espera un momento.":"No se pudo generar el PDF.");}
  finally{calc();}
});

/* =================== Navegación =================== */
function ir(vista){
  ["cot","his","cfg"].forEach(k=>{$("v-"+k).hidden=k!==vista;const b=$("nav-"+k);if(k===vista)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current");});
  $("barra").hidden=vista!=="cot";
  if(vista==="his")renderHist();
  if(vista==="cfg"){cargarHistorial();requestAnimationFrame(marcarSeccion);}
  window.scrollTo(0,0);
}
$$(".nav button").forEach(b=>b.addEventListener("click",()=>ir(b.dataset.v)));
document.addEventListener("click",e=>{if(e.target.closest("[data-ir-cot]"))ir("cot");});

/* =================== Historial =================== */
$("f-estado").innerHTML=[["activas","Activas"],["todas","Todas"],...ESTADOS].map(e=>`<button data-e="${e[0]}" aria-pressed="${e[0]==="activas"}">${e[1]}</button>`).join("");
const POR_PAGINA=50;S.verN=POR_PAGINA;
$("f-estado").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;S.fEstado=b.dataset.e;S.verN=POR_PAGINA;$$("#f-estado button").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));renderHist();});
$("f-quien").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;S.quien=b.dataset.q;S.verN=POR_PAGINA;$$("#f-quien button").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));renderHist();});
$("f-buscar").addEventListener("input",()=>{S.verN=POR_PAGINA;renderHist();});
$("lista").addEventListener("click",e=>{if(e.target.closest("[data-mas]")){S.verN+=POR_PAGINA;renderHist();}});

async function nombres(ids){
  const falt=ids.filter(i=>i&&!(i in S.names));
  if(falt.length&&S.user&&S.user.profiles){try{const ps=await S.user.profiles(falt);falt.forEach(i=>S.names[i]=(ps[i]&&ps[i].name)||"");}catch(e){}}
  $$("[data-uid]").forEach(el=>{const n=S.names[el.dataset.uid];el.textContent=n||(el.dataset.uid===S.meId?"Tú":"Vendedor");});
}
const MOTIVOS=["Precio","Eligió a otro proveedor","Se pospuso el proyecto","Sin respuesta","Otro"];
const DIA=864e5;
S.mes=new Date().toISOString().slice(0,7);$("adm-mes").value=S.mes;
$("adm-mes").addEventListener("change",e=>{S.mes=e.target.value||S.mes;renderHist();});
function seguimiento(q){
  if(["ganada","perdida"].includes(q.estado)||!q.creado)return null;
  const now=Date.now(),dv=Math.ceil((new Date(q.creado).getTime()+P.vigencia*DIA-now)/DIA);
  if(dv<0)return ["alerta","Vencida hace "+(-dv)+" día"+(dv===-1?"":"s")];
  if(q.estado==="enviada"&&q.enviada){const ds=Math.floor((now-new Date(q.enviada).getTime())/DIA);if(ds>=P.diasSeguimiento)return ["aviso","Sin respuesta hace "+ds+" días"];}
  if(dv<=3)return ["aviso",dv===0?"Vence hoy":"Vence en "+dv+" día"+(dv>1?"s":"")];
  return null;
}
function renderHist(){
  if(!S.db){$("lista").innerHTML=`<div class="vacio">Conectando con la base de datos…</div>`;$("kpis").innerHTML="";S.lista=[];return;}
  const base=S.quotes.filter(q=>S.quien==="todas"||!S.meId||q.creadoPor===S.meId);
  // KPIs
  const act=base.filter(q=>["borrador","por_autorizar","autorizada","enviada"].includes(q.estado));
  const gan=base.filter(q=>q.estado==="ganada"),per=base.filter(q=>q.estado==="perdida");
  const sum=a=>a.reduce((s,q)=>s+(q.subtotal||0),0),nc=n=>n+(n===1?" cotización":" cotizaciones");
  const tasa=gan.length+per.length?Math.round(gan.length*100/(gan.length+per.length)):null;
  $("kpis").innerHTML=[["En proceso",money(sum(act)),nc(act.length)+" · sin IVA"],["Ganadas",money(sum(gan)),nc(gan.length)+" · sin IVA"],["Tasa de cierre",tasa===null?"—":tasa+"%","ganadas contra perdidas"],["Cotizado total",money(sum(base)),nc(base.length)+" · sin IVA"]]
    .map(k=>`<div class="kpi"><small>${k[0]}</small><b>${k[1]}</b><span>${k[2]}</span></div>`).join("");
  // cola de autorización
  const cola=S.quotes.filter(q=>q.estado==="por_autorizar");
  $("nav-badge").hidden=!(S.admin&&cola.length);$("nav-badge").textContent=cola.length;
  if(S.admin&&cola.length){
    $("cola").hidden=false;
    $("cola").innerHTML=`<h2>Descuentos por autorizar</h2>`+cola.map(q=>`<div class="it"><div><b>${esc(q.cliente)}</b> · <span class="num">${esc(q.folio)}</span><br><small style="color:var(--suave)">Descuento de ${+q.descPct||0}% (máximo ${P.descMax}%) · ${money(q.total)} con IVA · <span data-uid="${esc(q.creadoPor||"")}"></span></small></div><div style="display:flex;gap:8px"><button class="btn chico" data-apr="${esc(q.id)}">Autorizar</button><button class="btn linea chico" data-rech="${esc(q.id)}">Rechazar</button></div></div>`).join("");
  }else $("cola").hidden=true;
  // seguimiento
  const seg=base.map(q=>[q,seguimiento(q)]).filter(x=>x[1]);
  $("seg-box").hidden=!seg.length;
  if(seg.length)$("seg-box").innerHTML=`<h2>Requieren seguimiento</h2>`+seg.map(([q,t])=>`<div class="it"><div><b>${esc(q.cliente)}</b> · <span class="num">${esc(q.folio)}</span> · ${money(q.subtotal||0)}<br><span class="tag ${t[0]}">${t[1]}</span></div><button class="btn linea chico" data-abrir="${esc(q.id)}">Abrir</button></div>`).join("");
  // lista
  const qtxt=$("f-buscar").value.trim().toLowerCase();
  const lst=base.filter(q=>(S.fEstado==="todas"||(S.fEstado==="activas"?act.includes(q):q.estado===S.fEstado))&&(!qtxt||(q.cliente||"").toLowerCase().includes(qtxt)||(q.folio||"").toLowerCase().includes(qtxt)));
  S.lista=lst;
  if(!lst.length){$("lista").innerHTML=`<div class="vacio">${S.quotes.length?"No hay cotizaciones con estos filtros.":`Aún no hay cotizaciones guardadas. Las que guardes o descargues en PDF aparecerán aquí.<br><button class="btn chico" style="margin-top:14px" data-ir-cot>Crear primera cotización</button>`}</div>`;}
  else $("lista").innerHTML=`<div class="q h"><span>Folio</span><span>Cliente</span><span>Vendedor</span><span style="text-align:right">Subtotal<small class="sub-h">sin IVA</small></span><span>Estado</span><span></span></div>`+
    lst.slice(0,S.verN).map(q=>{const t=seguimiento(q);return `<div class="q"><span class="fo">${esc(q.folio)}<br><small style="color:var(--suave);font-weight:400">${fecha(q.creado)}</small></span>
      <span class="cl"><b>${esc(q.cliente)}</b><small>${esc(q.titulo)} · ${hrs(q.horas||0)}${+q.descPct?" · "+(+q.descPct)+"% desc.":""}${q.origenGap?" · de "+esc(q.origenGap):""}</small>${t?`<span class="tag ${t[0]}">${t[1]}</span>`:""}</span>
      <span class="vd" data-uid="${esc(q.creadoPor||"")}"></span>
      <span class="mt">${money(q.subtotal||0)}</span>
      <span class="es"><select class="sel" data-est="${esc(q.id)}" data-e="${esc(q.estado)}" aria-label="Estado de ${esc(q.folio)}" ${(q.estado==="por_autorizar"&&!S.admin)||ajena(q)?"disabled":""} ${ajena(q)?'title="Solo quien la hizo o administración puede cambiarla"':""}>${ESTADOS.filter(e=>e[0]!=="por_autorizar"||q.estado==="por_autorizar").filter(e=>e[0]!=="autorizada"||q.estado==="autorizada").map(e=>`<option value="${e[0]}" ${e[0]===q.estado?"selected":""}>${e[1]}</option>`).join("")}</select>
        ${q.estado==="perdida"?`<select class="sel" data-motivo="${esc(q.id)}" aria-label="Motivo de pérdida" ${ajena(q)?"disabled":""}><option value="">¿Por qué se perdió?</option>${MOTIVOS.map(m=>`<option ${m===q.motivo?"selected":""}>${m}</option>`).join("")}</select>`:""}
        ${q.modo==="gap"&&q.estado==="ganada"?`<button class="btn chico" data-g2p="${esc(q.id)}">Pasar a proyecto</button>`:""}</span>
      <span class="acc"><button class="btn linea chico" data-abrir="${esc(q.id)}">Abrir</button><button class="btn linea chico" data-dup="${esc(q.id)}">Duplicar</button></span></div>`;}).join("");
  if(lst.length>S.verN)$("lista").insertAdjacentHTML("beforeend",`<div class="mas-lista"><span>Mostrando ${S.verN} de ${lst.length}</span><button class="btn linea chico" data-mas>Ver ${Math.min(POR_PAGINA,lst.length-S.verN)} más</button></div>`);
  // administración: comisiones y motivos del mes
  $("adm").hidden=!S.admin;
  if(S.admin){
    const delMes=(q,campo)=>((q[campo]||q.actualizado||"").slice(0,7)===S.mes);
    const g=S.quotes.filter(q=>q.estado==="ganada"&&delMes(q,"ganada")),porV={};
    g.forEach(q=>{const k=q.creadoPor||"";const r=porV[k]||(porV[k]={n:0,sub:0,com:0});r.n++;r.sub+=q.subtotal||0;r.com+=q.comision||0;});
    const filas=Object.entries(porV).sort((a,b)=>b[1].com-a[1].com);
    $("adm-com").innerHTML=filas.length?`<table class="tabla"><thead><tr><th>Vendedor</th><th class="n">Ganadas</th><th class="n">Vendido</th><th class="n">Comisión</th></tr></thead><tbody>${filas.map(([k,r])=>`<tr><td data-uid="${esc(k)}"></td><td class="n">${r.n}</td><td class="n">${money(r.sub)}</td><td class="n">${money(r.com)}</td></tr>`).join("")}</tbody>
      <tfoot><tr><td>Total</td><td class="n">${g.length}</td><td class="n">${money(sum(g))}</td><td class="n">${money(g.reduce((s,q)=>s+(q.comision||0),0))}</td></tr></tfoot></table>`:`<p class="lead" style="font-size:14px">No hay ventas ganadas en este mes.</p>`;
    const pm=S.quotes.filter(q=>q.estado==="perdida"&&delMes(q,"perdida")),mot={};
    pm.forEach(q=>{const m=q.motivo||"Sin motivo registrado";mot[m]=(mot[m]||0)+1;});
    $("adm-mot").innerHTML=pm.length?`<table class="tabla"><tbody>${Object.entries(mot).sort((a,b)=>b[1]-a[1]).map(([m,n])=>`<tr><td>${esc(m)}</td><td class="n">${n}</td></tr>`).join("")}</tbody></table>`:`<p class="lead" style="font-size:14px">No hay cotizaciones perdidas en este mes.</p>`;
  }
  nombres([...new Set(S.quotes.map(q=>q.creadoPor).filter(Boolean))]);
}
/* El historial trae las cotizaciones sin el formulario completo; se pide al abrirlas */
async function completar(q){
  if(q.inputs)return q;
  try{const s=await S.db.doc("cotizaciones/"+q.id).get();if(s.exists)Object.assign(q,s.data());}catch(e){}
  return q;
}
/* Formularios de varias cotizaciones a la vez (para el Excel), en grupos */
async function inputsDe(lst){
  const faltan=lst.filter(q=>!q.inputs).map(q=>q.id),r={};
  if(faltan.length&&S.sb){
    for(let i=0;i<faltan.length;i+=100){
      const {data}=await S.sb.from("cotizaciones").select("id,inputs:datos->inputs").in("id",faltan.slice(i,i+100));
      (data||[]).forEach(x=>r[x.id]=x.inputs||{});
    }
  }
  lst.forEach(q=>{if(q.inputs)r[q.id]=q.inputs;});
  return r;
}
function gapAProyecto(q){
  const i=q.inputs||{};
  S.currentId=null;S.currentFolio="";S.currentDoc=null;S.dirty=false;
  restore(FRESH);drawDynamic();
  restore({"r:modo":"proy",cliente:q.cliente,contacto:i.contacto||"",correo:i.correo||"",telefono:i.telefono||"",
    "p-usr":i["g-usr"]||25,"p-areas":i["g-areas"]||5,"p-emp":i["g-emp"]||1,"p-gapfolio":q.folio,"p-gapmonto":q.subtotal||0,"p-gapcred":true,
    ...Object.fromEntries(Object.keys(APP).filter(id=>("g-app-"+id) in i).map(id=>["p-app-"+id,i["g-app-"+id]]))});
  ir("cot");calc();toast("Proyecto creado a partir del análisis "+q.folio+". Revisa el alcance y guarda.");
}
document.addEventListener("click",async e=>{
  const t=e.target.closest("[data-abrir],[data-dup],[data-apr],[data-rech],[data-g2p]");if(!t)return;
  const id=t.dataset.abrir||t.dataset.dup||t.dataset.apr||t.dataset.rech||t.dataset.g2p,q=S.quotes.find(x=>x.id===id);if(!q)return;
  if(t.dataset.g2p||t.dataset.abrir||t.dataset.dup){t.disabled=true;await completar(q);t.disabled=false;}
  if(t.dataset.g2p){gapAProyecto(q);return;}
  if(t.dataset.abrir||t.dataset.dup){
    restore(FRESH);restore(q.inputs||{});drawDynamic();restore(q.inputs||{});
    if(t.dataset.abrir){S.currentId=q.id;S.currentFolio=q.folio;S.currentDoc=q;if(ajena(q))toast("Esta cotización es de otra persona: puedes verla y descargar el PDF. Para cambiarla, usa «Duplicar».");}
    else{S.currentId=null;S.currentFolio="";S.currentDoc=null;toast("Copia creada. Ajusta y guarda para asignar un folio nuevo.");}
    S.dirty=false;ir("cot");calc();return;
  }
  t.disabled=true;
  try{
    const now=new Date().toISOString();
    if(t.dataset.apr){await S.db.collection("aprobaciones").doc(id).set({desc:q.descPct,por:S.meId||null,fecha:now});await S.db.collection("cotizaciones").doc(id).update({estado:"autorizada",actualizado:now});toast("Descuento autorizado para "+q.folio);}
    else{await S.db.collection("cotizaciones").doc(id).update({estado:"borrador",rechazo:now,actualizado:now});toast("Descuento rechazado. El vendedor debe ajustarlo.");}
  }catch(err){toast("No se pudo actualizar. Intenta de nuevo.");t.disabled=false;}
});
document.addEventListener("change",async e=>{
  const m=e.target.closest("[data-motivo]");
  if(m){try{await S.db.collection("cotizaciones").doc(m.dataset.motivo).update({motivo:m.value,actualizado:new Date().toISOString()});toast("Motivo guardado");}catch(err){toast("No se pudo guardar el motivo.");}return;}
  const s=e.target.closest("[data-est]");if(!s)return;
  const id=s.dataset.est,now=new Date().toISOString(),upd={estado:s.value,actualizado:now};s.dataset.e=s.value;
  if(["enviada","ganada","perdida"].includes(s.value))upd[s.value]=now;
  try{await S.db.collection("cotizaciones").doc(id).update(upd);toast(s.value==="perdida"?"Marcada como perdida. Elige el motivo debajo del estado.":"Estado actualizado: "+EST[s.value]);}
  catch(err){toast(err&&err.code==="invalid_argument"?"Solo quien hizo la cotización o administración puede cambiar su estado.":"No se pudo cambiar el estado.");renderHist();}
});
$("b-exp").addEventListener("click",async()=>{
  if(!window.XLSX){toast("No se pudo cargar el generador de Excel. Recarga la página.");return;}
  if(!S.dl){toast("No se pudo preparar la descarga. Recarga la página.");return;}
  const lst=S.lista||[];if(!lst.length){toast("No hay cotizaciones para exportar con estos filtros");return;}
  const ins=await inputsDe(lst);
  const filas=lst.map(q=>{const r={Folio:q.folio,Fecha:(q.creado||"").slice(0,10),Cliente:q.cliente,Modalidad:q.titulo,Aplicaciones:appsTexto(ins[q.id]||{}),Vendedor:S.names[q.creadoPor]||"",Horas:q.horas||0,
    "Descuento %":q.descPct||0,"Subtotal sin IVA":q.subtotal||0,"Total con IVA":q.total||0,Estado:EST[q.estado]||q.estado,"Motivo de pérdida":q.motivo||"","Origen GAP":q.origenGap||""};
    if(S.admin)r["Comisión"]=q.comision||0;return r;});
  const ws=XLSX.utils.json_to_sheet(filas);ws["!cols"]=Object.keys(filas[0]).map(k=>({wch:Math.max(10,k.length+2,...filas.map(f=>String(f[k]).length+1))}));
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Cotizaciones");
  const buf=XLSX.write(wb,{type:"array",bookType:"xlsx"});
  try{await S.dl.save({filename:`Cotizaciones Sunname ${new Date().toISOString().slice(0,10)}.xlsx`,data:new Blob([buf])});toast("Excel listo");}
  catch(err){if(!(err&&err.code==="declined"))toast("No se pudo exportar.");}
});

/* =================== Configuración =================== */
const SECS=[
  {id:"empresa",t:"Datos para el PDF",d:"Aparecen en el encabezado y pie de cada cotización.",f:[
    ["empresa","Nombre comercial","","txt"],["telEmpresa","Teléfono","","txt"],["correoEmpresa","Correo","","txt"],["web","Sitio web","","txt"],["terminos","Términos y condiciones","Se imprimen al final del PDF","area"]]},
  {id:"gen",t:"Generales",d:"Valores que usan todas las modalidades.",f:[
    ["tarifa","Tarifa por hora funcional","Consultoría en Proyecto y Análisis GAP","MXN"],["tarifaDev","Tarifa por hora de desarrollo","Desarrollos a la medida en Proyecto","MXN"],
    ["tarifaSoporte","Tarifa por hora de soporte","Soporte post producción en Proyecto","MXN"],["iva","IVA","","%"],["anticipo","Anticipo","Porcentaje del total","%"],
    ["descMax","Descuento máximo sin autorización","Arriba de este valor el vendedor debe pedir autorización","%"],["vigencia","Vigencia de la cotización","","días"],
    ["diasSeguimiento","Avisar si una cotización enviada no tiene respuesta en","Aparece en Cotizaciones como pendiente de seguimiento","días"],
    ["pago","Forma de pago","Texto que aparece en la cotización","txt"]]},
  {id:"horas",t:"Paquete de horas",d:"Precios de referencia de odoo.com/es/pricing-packs y el margen que suma Sunname. 1 área = 25 h, 2–3 = 50 h, 4–5 = 100 h, 6 o más = 200 h; manufactura cuenta doble. El precio de Odoo y el margen nunca aparecen en el PDF.",f:[
    ["margenA","Margen opción 1","","%"],["margenB","Margen opción 2","Opción seleccionada por defecto","%"],
    ["empTier","Empleados para subir un paquete","Con más empleados se recomienda el siguiente paquete","empleados"]],
    tabla:{k:"odoo",titulo:"Precios Odoo por paquete",fila:r=>`Paquete de ${r.h} horas`,campo:"p",u:"MXN"}},
  {id:"proy",t:"Proyecto",d:"Cómo se calculan las horas de un proyecto.",f:[
    ["hArea","Horas por área o departamento","","h"],["hEmpresa","Horas por empresa adicional","A partir de la segunda","h"],
    ["gestion","Gestión de proyecto","Sobre las horas base","%"],["conting","Contingencia","Sobre horas base más gestión","%"],
    ["hSemana","Horas por consultor a la semana","Para estimar la duración","h"]],
    tabla:{k:"pUsuarios",titulo:"Horas base por número de usuarios",u:"h"},
    tablasNP:[{k:"dist",titulo:"Reparto de horas por fase (aparece en el PDF)"},{k:"fases",titulo:"Plan de pagos por hito (aparece en el PDF)"}]},
  {id:"gap",t:"Análisis GAP",d:"Reglas del cotizador GAP.",f:[
    ["gBase","Horas base","Preparación, análisis y cierre","h"],["gEmpresa","Horas por empresa adicional","","h"],["gArea","Horas por área","","h"],
    ["gOdoo","Si ya usa Odoo","Revisión del sistema actual","h"],["gDev","Si se esperan desarrollos","Especificación preliminar","h"],
    ["gVisita","Visita en sitio","Una jornada presencial","h"],["gRedondeo","Redondear precio a","El precio sube al múltiplo siguiente","MXN"],
    ["gapCredito","Crédito al pasar a proyecto","Porcentaje del GAP que se descuenta del proyecto","%"]],
    tablas:[{k:"gUsuarios",titulo:"Horas adicionales por usuarios",u:"h"},{k:"gSuc",titulo:"Horas adicionales por sucursales",u:"h",que:"sucursales"}]},
  {id:"lic",t:"Licencias Odoo",d:"Precio por usuario al mes que se muestra como referencia; no se suma al total. Déjalo en 0 para no mostrarlo. Revisa los precios vigentes en odoo.com/es/pricing.",f:[
    ["licStandard","Plan Estándar","Por usuario al mes","MXN"],["licCustom","Plan Personalizado","Por usuario al mes; se usa cuando hay desarrollos","MXN"]]},
  {id:"com",t:"Comisiones",d:"Porcentaje de comisión según quién hizo la venta. Se calcula sobre el subtotal, sin IVA ni viáticos.",canales:true}
];
let editable=true;
/* resalta en el menú lateral la sección que se está viendo */
function marcarSeccion(){
  if($("v-cfg").hidden)return;
  const secs=$$("#secs .sec, #sec-hist").filter(x=>!x.hidden);if(!secs.length)return;
  const linea=innerHeight*0.33;let act=secs[0];
  secs.forEach(x=>{if(x.getBoundingClientRect().top<=linea)act=x;});
  if(innerHeight+scrollY>=document.documentElement.scrollHeight-4)act=secs[secs.length-1];
  $$("#cfg-nav button").forEach(bt=>bt.classList.toggle("on","sec-"+bt.dataset.go===act.id));
}
let rafSec=0;addEventListener("scroll",()=>{cancelAnimationFrame(rafSec);rafSec=requestAnimationFrame(marcarSeccion);},{passive:true});
function vigilarSecciones(){requestAnimationFrame(marcarSeccion);}
/* ---------- Historial de cambios (solo administración, con Supabase) ---------- */
const ETIQ={canales:"Comisiones por canal"},UNI={};
SECS.forEach(sc=>{(sc.f||[]).forEach(f=>{ETIQ[f[0]]=f[1];UNI[f[0]]=f[3];});if(sc.tabla)ETIQ[sc.tabla.k]=sc.tabla.titulo;(sc.tablas||[]).forEach(t=>ETIQ[t.k]=t.titulo);(sc.tablasNP||[]).forEach(t=>ETIQ[t.k]=t.titulo);});
function fmtHist(campo,v){
  if(v===null||v===undefined||v==="")return "—";
  if(typeof v==="number"){const u=UNI[campo];return u==="MXN"?money(v):u==="%"?v+"%":u==="h"?v+" h":u?v+" "+u:String(v);}
  if(typeof v==="string")return "«"+(v.length>90?v.slice(0,90)+"…":v)+"»";
  return JSON.stringify(v);
}
function difLista(campo,a,b){
  a=Array.isArray(a)?a:[];b=Array.isArray(b)?b:[];const out=[];
  const etq={p:campo==="odoo"?"precio":"%",c:"comisión",h:"horas",hasta:"límite",n:"nombre"};
  for(let i=0;i<Math.max(a.length,b.length);i++){
    const x=a[i]||{},y=b[i]||{};
    for(const k of new Set([...Object.keys(x),...Object.keys(y)])){
      if(JSON.stringify(x[k])===JSON.stringify(y[k]))continue;
      const nom=y.n||x.n||(campo==="odoo"?`Paquete de ${y.h??x.h} h`:("hasta" in y||"hasta" in x)?((y.hasta??x.hasta)===null?"Último rango":`Rango hasta ${y.hasta??x.hasta}`):`Fila ${i+1}`);
      const f=val=>val===null||val===undefined?"—":typeof val==="number"?(campo==="odoo"&&k==="p"?money(val):k==="p"||k==="c"?val+"%":k==="h"?val+" h":String(val)):String(val);
      out.push(`<span>${esc(nom)} (${etq[k]||k}): <span class="de">${esc(f(x[k]))}</span> → <b>${esc(f(y[k]))}</b></span>`);
    }
  }
  return out.length?out.join(""):"<span>Sin diferencias visibles</span>";
}
async function cargarHistorial(){
  const sec=$("sec-hist");
  if(!S.sb||!S.admin||S.sinHistorial){if(!sec.hidden){sec.hidden=true;drawCfg();}return;}
  const {data,error}=await S.sb.from("config_historial").select("id,campo,antes,despues,cambiado_por,creado").order("creado",{ascending:false}).limit(60);
  if(error){if(["PGRST205","42P01"].includes(error.code))S.sinHistorial=true;sec.hidden=true;return;}
  const faltan=[...new Set((data||[]).map(h=>h.cambiado_por).filter(Boolean))].filter(i=>!(i in S.names));
  if(faltan.length){const {data:ps}=await S.sb.from("perfiles").select("id,nombre").in("id",faltan);(ps||[]).forEach(x=>S.names[x.id]=x.nombre);}
  const estaba=sec.hidden;sec.hidden=false;if(estaba&&!(document.activeElement&&document.activeElement.closest("#secs")))drawCfg();
  $("hist-lst").innerHTML=(data&&data.length)?data.map(h=>{
    const lista=Array.isArray(h.antes)||Array.isArray(h.despues);
    const det=lista?difLista(h.campo,h.antes,h.despues):`<span><span class="de">${esc(fmtHist(h.campo,h.antes))}</span> → <b>${esc(fmtHist(h.campo,h.despues))}</b></span>`;
    return `<div class="hrow"><div><b>${esc(ETIQ[h.campo]||h.campo)}</b><small>${esc(S.names[h.cambiado_por]||"Sin nombre")} · ${esc(fechaN(h.creado))}</small></div><div class="cambio">${det}</div></div>`;
  }).join(""):`<p class="lead" style="font-size:14px">Todavía no hay cambios registrados.</p>`;
}
function prow(label,hint,input,u,pesos){return `<div class="prow"><div class="l"><b>${label}</b>${hint?`<small>${hint}</small>`:""}</div><div class="unidad">${pesos?`<span class="pre">$</span>`:""}${input}${u?`<span>${u}</span>`:""}${pesos?`<span>MXN</span>`:""}</div></div>`;}
function tablaHTML(t){
  const arr=P[t.k];let h=`<div class="subt">${t.titulo}</div>`;
  if(t.campo)return h+arr.map((r,i)=>prow(t.fila(r),"",t.u==="MXN"?`<input type="text" inputmode="numeric" data-money data-t="${t.k}" data-i="${i}" data-f="${t.campo}" value="${fmtN(r[t.campo])}">`:`<input type="number" min="0" data-t="${t.k}" data-i="${i}" data-f="${t.campo}" value="${r[t.campo]}">`,t.u==="MXN"?"":t.u,t.u==="MXN")).join("");
  const que=t.que||"usuarios";
  return h+arr.map((r,i)=>{
    const desde=i===0?1:(arr[i-1].hasta||0)+1;
    const lab=r.hasta===null?`Más de ${arr[i-1]?arr[i-1].hasta:0} ${que}`:`De ${desde} a <input type="number" min="${desde}" data-t="${t.k}" data-i="${i}" data-f="hasta" value="${r.hasta}" aria-label="Hasta" style="width:70px;border:1px solid var(--linea);border-radius:8px;padding:4px 6px;background:var(--fondo);font-weight:600;text-align:center"> ${que}`;
    return prow(lab,"",`<input type="number" min="0" data-t="${t.k}" data-i="${i}" data-f="h" value="${r.h}">`,t.u);
  }).join("");
}
function tablaNP(t){
  const arr=P[t.k],sm=arr.reduce((a,r)=>a+(+r.p||0),0);
  return `<div class="subt">${t.titulo}</div>`+arr.map((r,i)=>prow(`<input type="text" class="np" data-t="${t.k}" data-i="${i}" data-f="n" value="${esc(r.n)}" aria-label="Nombre">`,"",`<input type="number" min="0" data-t="${t.k}" data-i="${i}" data-f="p" value="${r.p}">`,"%")).join("")+
    `<p class="suma ${sm===100?"":"mal"}" data-suma="${t.k}">Suma: ${sm}%${sm===100?"":". Debe sumar 100%."}</p>`;
}
function campoCfg(f){
  if(f[3]==="txt")return prow(f[1],f[2],`<input type="text" data-k="${f[0]}" value="${esc(P[f[0]])}">`,"");
  if(f[3]==="area")return prow(f[1],f[2],`<textarea rows="5" data-k="${f[0]}">${esc(P[f[0]])}</textarea>`,"");
  if(f[3]==="MXN")return prow(f[1],f[2],`<input type="text" inputmode="numeric" data-money data-k="${f[0]}" value="${fmtN(P[f[0]])}">`,"",true);
  return prow(f[1],f[2],`<input type="number" min="0" data-k="${f[0]}" value="${P[f[0]]}">`,f[3]);
}
function drawCfg(){
  $("cfg-nav").innerHTML=SECS.map(s=>`<button data-go="${s.id}">${s.t}</button>`).join("")+($("sec-hist").hidden?"":`<button data-go="hist">Historial de cambios</button>`);
  $("secs").innerHTML=SECS.map(s=>{
    let h=`<section class="sec" id="sec-${s.id}"><h2>${s.t}</h2><p>${s.d}</p>`;
    (s.f||[]).forEach(f=>h+=campoCfg(f));
    if(s.tabla)h+=tablaHTML(s.tabla);
    (s.tablas||[]).forEach(t=>h+=tablaHTML(t));
    (s.tablasNP||[]).forEach(t=>h+=tablaNP(t));
    if(s.canales)h+=P.canales.map((c,i)=>prow(esc(c.n),i===0?"Único canal con comisión por defecto":"",`<input type="number" min="0" data-t="canales" data-i="${i}" data-f="c" value="${c.c}">`,"%")).join("");
    return h+"</section>";
  }).join("");
  $$("#secs input,#secs textarea").forEach(i=>i.disabled=!editable);
  $("reset").disabled=!editable;
  vigilarSecciones();
}
drawCfg();
$("cfg-nav").addEventListener("click",e=>{const b=e.target.closest("[data-go]");if(b)$("sec-"+b.dataset.go).scrollIntoView({behavior:"smooth",block:"start"});});
$("secs").addEventListener("input",e=>{
  const i=e.target;if(!editable)return;
  if(i.dataset.k){
    const k=i.dataset.k;
    if(typeof DEF[k]==="string")P[k]=i.value;
    else P[k]=numTxt(i.value);
  }else if(i.dataset.t){
    const k=i.dataset.t;P[k][+i.dataset.i][i.dataset.f]=i.dataset.f==="n"?i.value:numTxt(i.value);
    const sp=document.querySelector(`[data-suma="${k}"]`);
    if(sp){const sm=P[k].reduce((a,r)=>a+(+r.p||0),0);sp.textContent=`Suma: ${sm}%${sm===100?"":". Debe sumar 100%."}`;sp.className="suma"+(sm===100?"":" mal");}
  }
  drawDynamic();calc();programarGuardado();
});
$("secs").addEventListener("focusout",e=>{if(e.target.dataset&&e.target.dataset.f==="hasta")setTimeout(drawCfg,0);});

/* guardado compartido de configuración */
let timer=null,ultimo=null,guardandoCfg=false;
/* JSON con llaves ordenadas: la base de datos puede devolver las llaves en otro orden */
const estable=o=>JSON.stringify(o,(k,v)=>v&&typeof v==="object"&&!Array.isArray(v)?Object.keys(v).sort().reduce((a,x)=>(a[x]=v[x],a),{}):v);
function estado(t,c){const g=$("guardado");g.textContent=t;g.className="guardado"+(c?" "+c:"");}
function programarGuardado(){estado("Guardando…","pend");guardandoCfg=true;clearTimeout(timer);timer=setTimeout(guardarCfg,700);}
async function guardarCfg(){
  const datos=clone(P);
  try{localStorage.setItem("sunname-cfg",JSON.stringify(datos));}catch(e){}
  if(!S.db){estado("Guardado solo en este navegador","pend");return;}
  guardandoCfg=true;timer=null;
  try{ultimo=estable(datos);await S.db.doc("config/parametros").set(datos);estado(S.local?"Guardado en esta computadora":"Cambios guardados para todos");if(S.sb)setTimeout(cargarHistorial,600);}
  catch(e){
    if(e&&e.code==="invalid_argument"){editable=false;drawCfg();estado("Solo lectura: no tienes permiso para cambiar la configuración","ro");}
    else estado("No se pudo guardar. Intenta de nuevo en un momento.","pend");
  }finally{guardandoCfg=timer!==null;}
}
$("reset").addEventListener("click",()=>{$("reset").hidden=true;$("reset-conf").hidden=false;});
$("reset-no").addEventListener("click",()=>{$("reset").hidden=false;$("reset-conf").hidden=true;});
$("reset-si").addEventListener("click",()=>{
  const keep={empresa:P.empresa,telEmpresa:P.telEmpresa,correoEmpresa:P.correoEmpresa,web:P.web,terminos:P.terminos};
  P={...clone(DEF),...keep};$("reset").hidden=false;$("reset-conf").hidden=true;drawCfg();drawDynamic();calc();programarGuardado();
});

/* =================== Notas de prueba ===================
   Con sesión de Supabase se guardan en la base de datos (administración ve las del equipo).
   Sin Supabase se guardan en este navegador. */
const NK="sunname-notas";
const leerNotas=()=>{try{return JSON.parse(localStorage.getItem(NK)||"[]");}catch(e){return [];}};
const guardarNotas=n=>{try{localStorage.setItem(NK,JSON.stringify(n));}catch(e){}};
let notasMias=[],notasEq=[],notaTab="mias",notaFiltro="pend",notaPersona="";
const enBD=()=>!!(S.sb&&S.meId&&!S.sinNotas);
const fechaN=iso=>new Date(iso).toLocaleString("es-MX",{dateStyle:"medium",timeStyle:"short"});
function contexto(){
  const vista=!$("v-cot").hidden?"Cotizar":!$("v-his").hidden?"Cotizaciones":"Configuración";
  const modo=S.R?S.R.titulo:"";
  return vista+(vista==="Cotizar"&&modo?" · "+modo:"")+(vista==="Cotizar"&&S.currentFolio?" · "+S.currentFolio:"");
}
async function cargarNotas(){
  if(!enBD()){notasMias=leerNotas().map((x,i)=>({id:String(i),texto:x.txt,contexto:x.ctx,fecha:x.fecha}));notasEq=[];pintarNotas();return;}
  const {data,error}=await S.sb.from("notas").select("id,texto,contexto,autor,creado,atendida").order("creado",{ascending:false}).limit(1000);
  if(error){if(["PGRST205","42P01"].includes(error.code)){S.sinNotas=true;return cargarNotas();}toast("No se pudieron cargar las notas.");return;}
  const todas=data||[];notasMias=todas.filter(n=>n.autor===S.meId);notasEq=S.admin?todas:[];
  const faltan=[...new Set(notasEq.map(n=>n.autor))].filter(i=>!(i in S.names));
  if(faltan.length){const {data:ps}=await S.sb.from("perfiles").select("id,nombre").in("id",faltan);(ps||[]).forEach(x=>S.names[x.id]=x.nombre);}
  pintarNotas();
}
const filtrarEq=()=>notasEq.filter(n=>(notaFiltro==="todas"||(notaFiltro==="pend"?!n.atendida:n.atendida))&&(!notaPersona||n.autor===notaPersona));
function pintarNotas(){
  const bd=enBD(),adm=bd&&S.admin,pend=notasEq.filter(n=>!n.atendida).length;
  $("nota-nombre-w").hidden=bd;
  $("nota-lead").textContent=bd?"Escribe lo que cambiarías o lo que no se entiende. Se guarda al instante y administración la puede revisar.":"Escribe lo que cambiarías o lo que no se entiende. Se guarda en este navegador; al terminar, copia tus notas y envíalas.";
  $("nota-tabs").hidden=!adm;if(!adm)notaTab="mias";
  $("nota-tab-cnt").hidden=!pend;$("nota-tab-cnt").textContent=pend;
  const c=adm?pend:notasMias.length;$("nota-cnt").hidden=!c;$("nota-cnt").textContent=c;
  $("nota-mias").hidden=notaTab!=="mias";$("nota-equipo").hidden=notaTab!=="equipo";$("notas").classList.toggle("ancho",notaTab==="equipo");
  $$("#nota-tabs button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.t===notaTab)));
  $$("#nota-f button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.f===notaFiltro)));
  $("nota-lst-t").hidden=!notasMias.length;$("nota-pie").hidden=bd||!notasMias.length;
  $("nota-lst").innerHTML=notasMias.map(n=>`<div class="it"><small>${esc(n.creado?fechaN(n.creado):n.fecha)} · ${esc(n.contexto)}${n.atendida?' · <b style="color:var(--ok)">Atendida</b>':""}</small><span>${esc(n.texto)}</span><button type="button" class="x" data-borrar="${esc(n.id)}">Borrar</button></div>`).join("");
  if(adm){
    const personas=[...new Set(notasEq.map(n=>n.autor))];
    $("nota-persona").innerHTML=`<option value="">Todas las personas</option>`+personas.map(x=>`<option value="${esc(x)}" ${x===notaPersona?"selected":""}>${esc(S.names[x]||"Sin nombre")}</option>`).join("");
    const lst=filtrarEq();
    $("nota-eq-cuenta").textContent=`${lst.length} nota${lst.length===1?"":"s"} · ${pend} pendiente${pend===1?"":"s"} en total`;
    $("nota-eq-lst").innerHTML=lst.length?lst.map(n=>`<div class="it ${n.atendida?"ok":""}"><small><b>${esc(S.names[n.autor]||"Sin nombre")}</b> · ${esc(fechaN(n.creado))} · ${esc(n.contexto)}</small><span>${esc(n.texto)}</span><label class="at"><input type="checkbox" data-atender="${esc(n.id)}" ${n.atendida?"checked":""}>Atendida</label></div>`).join(""):`<p class="lead" style="font-size:14px">No hay notas con este filtro.</p>`;
  }
}
function textoNotas(){
  const nom=$("nota-nombre").value.trim();
  return `Notas de prueba · Cotizador Sunname${nom?" · "+nom:""}\n\n`+notasMias.slice().reverse().map((x,i)=>`${i+1}. [${x.contexto}] ${x.texto}\n   (${x.fecha||fechaN(x.creado)})`).join("\n\n");
}
try{$("nota-nombre").value=localStorage.getItem("sunname-nota-nombre")||"";}catch(e){}
$("nota-nombre").addEventListener("input",e=>{try{localStorage.setItem("sunname-nota-nombre",e.target.value);}catch(err){}});
$("nota-abrir").addEventListener("click",()=>{$("nota-ctx").textContent="Pantalla: "+contexto();pintarNotas();cargarNotas();$("notas").showModal();if(notaTab==="mias")$("nota-txt").focus();});
$("nota-tabs").addEventListener("click",e=>{const b=e.target.closest("[data-t]");if(!b)return;notaTab=b.dataset.t;pintarNotas();});
$("nota-f").addEventListener("click",e=>{const b=e.target.closest("[data-f]");if(!b)return;notaFiltro=b.dataset.f;pintarNotas();});
$("nota-persona").addEventListener("change",e=>{notaPersona=e.target.value;pintarNotas();});
$("nota-guardar").addEventListener("click",async()=>{
  const t=$("nota-txt").value.trim();if(!t){$("nota-txt").focus();return;}
  const b=$("nota-guardar");b.disabled=true;
  if(enBD()){
    const {error}=await S.sb.from("notas").insert({texto:t,contexto:contexto()});
    b.disabled=false;if(error){toast("No se pudo guardar la nota. Intenta de nuevo.");return;}
  }else{
    const n=leerNotas();n.push({txt:t,ctx:contexto(),fecha:new Date().toLocaleString("es-MX",{dateStyle:"medium",timeStyle:"short"})});guardarNotas(n);b.disabled=false;
  }
  $("nota-txt").value="";await cargarNotas();toast("Nota guardada");
});
$("nota-lst").addEventListener("click",async e=>{
  const b=e.target.closest("[data-borrar]");if(!b)return;
  if(enBD()){const {error}=await S.sb.from("notas").delete().eq("id",b.dataset.borrar);if(error){toast("No se pudo borrar.");return;}}
  else{const n=leerNotas();n.splice(+b.dataset.borrar,1);guardarNotas(n);}
  cargarNotas();
});
$("nota-eq-lst").addEventListener("change",async e=>{
  const c=e.target.closest("[data-atender]");if(!c)return;
  const {error}=await S.sb.from("notas").update({atendida:c.checked,atendida_por:c.checked?S.meId:null,atendida_en:c.checked?new Date().toISOString():null}).eq("id",c.dataset.atender);
  if(error){toast("No se pudo actualizar la nota.");c.checked=!c.checked;return;}
  const n=notasEq.find(x=>x.id===c.dataset.atender);if(n)n.atendida=c.checked;pintarNotas();
});
$("nota-copiar").addEventListener("click",()=>{
  const t=textoNotas();
  try{navigator.clipboard.writeText(t).then(()=>toast("Notas copiadas. Pégalas en WhatsApp o en un correo."),()=>toast("No se pudo copiar. Usa «Descargar .txt»."));}catch(e){toast("No se pudo copiar. Usa «Descargar .txt».");}
});
$("nota-bajar").addEventListener("click",async()=>{
  const nom=$("nota-nombre").value.trim()||"notas";
  try{await (S.dl||localDL).save({filename:`Notas cotizador ${nom} ${new Date().toISOString().slice(0,10)}.txt`,data:new Blob([textoNotas()],{type:"text/plain"})});}catch(e){if(!(e&&e.code==="declined"))toast("No se pudo descargar.");}
});
$("nota-exp").addEventListener("click",async()=>{
  if(!window.XLSX){toast("No se pudo cargar el generador de Excel. Recarga la página.");return;}
  const lst=filtrarEq();if(!lst.length){toast("No hay notas con este filtro");return;}
  const filas=lst.map(n=>({Fecha:fechaN(n.creado),Persona:S.names[n.autor]||"",Pantalla:n.contexto,Nota:n.texto,Estado:n.atendida?"Atendida":"Pendiente"}));
  const ws=XLSX.utils.json_to_sheet(filas);ws["!cols"]=[{wch:20},{wch:30},{wch:40},{wch:80},{wch:12}];
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Notas");
  try{await (S.dl||localDL).save({filename:`Notas de prueba ${new Date().toISOString().slice(0,10)}.xlsx`,data:new Blob([XLSX.write(wb,{type:"array",bookType:"xlsx"})])});toast("Excel listo");}catch(e){if(!(e&&e.code==="declined"))toast("No se pudo exportar.");}
});
pintarNotas();

calc();
renderHist();

/* =================== Modo de prueba (sin Supabase) ===================
   Si SUPABASE_URL está vacía, las cotizaciones y la configuración se guardan
   en este navegador. Sirve para probar cambios sin tocar los datos reales. */
function localDB(){
  const K="sunname-db";let store={};try{store=JSON.parse(localStorage.getItem(K)||"{}");}catch(e){}
  const subs=[],save=()=>{try{localStorage.setItem(K,JSON.stringify(store));}catch(e){}setTimeout(()=>subs.forEach(f=>f()),0);};
  const snap=p=>{const d=store[p];return {id:p.split("/").pop(),exists:!!d,data:()=>d&&clone(d),metadata:{fromCache:false,hasPendingWrites:false}};};
  const doc=p=>({id:p.split("/").pop(),path:p,get:async()=>snap(p),
    set:async d=>{store[p]=clone(d);save();},
    update:async d=>{if(!store[p])throw {code:"invalid_argument"};Object.assign(store[p],clone(d));save();},
    delete:async()=>{delete store[p];save();},
    onSnapshot:n=>{const f=()=>n(snap(p));subs.push(f);setTimeout(f,0);return()=>{};}});
  const col=(p,ord)=>{const q={path:p,doc:id=>doc(p+"/"+id),orderBy:(f,dir)=>col(p,[f,dir]),limit:()=>q,where:()=>q,
    onSnapshot:n=>{const f=()=>{const nseg=p.split("/").length+1;let docs=Object.keys(store).filter(k=>k.startsWith(p+"/")&&k.split("/").length===nseg).map(snap);
      if(ord)docs.sort((a,b)=>((a.data()[ord[0]]||"")>(b.data()[ord[0]]||"")?1:-1)*(ord[1]==="desc"?-1:1));n({docs,size:docs.length,empty:!docs.length,metadata:{}});};
      subs.push(f);setTimeout(f,0);return()=>{};}};return q;};
  return {doc,collection:col};
}
const localDL={save:async({filename,data})=>{
  const url=URL.createObjectURL(data instanceof Blob?data:new Blob([data]));
  const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
}};

/* =================== Supabase (login y datos compartidos) ===================
   Pega aquí la URL del proyecto y la clave pública (anon / publishable).
   Vacías = el cotizador guarda en el navegador (modo local). */
const SUPABASE_URL="https://wemyausioojlghafwolj.supabase.co";
const SUPABASE_KEY="sb_publishable_Lu9Yn0bp12DO178UWzqXfg_zSWF0E42";

function cargarScript(src,sri){return new Promise((ok,no)=>{const e=document.createElement("script");e.src=src;if(sri){e.integrity=sri;e.crossOrigin="anonymous";}e.onload=ok;e.onerror=no;document.head.appendChild(e);});}
/* Datos en Supabase.
   Las colecciones (cotizaciones, aprobaciones) se descargan una vez y después solo se
   actualiza la fila que cambia (tiempo real), en lugar de volver a bajar todo.
   De las cotizaciones se baja solo lo que usa el historial; el formulario completo
   ("inputs") se trae al abrir, duplicar o exportar (ver completar() e inputsDe()). */
const LIGERO={cotizaciones:["folio","cliente","modo","titulo","horas","subtotal","total","descPct","canal","origenGap","comision","estado","creadoPor","creado","actualizado","enviada","ganada","perdida","motivo","rechazo"]};
const LOTE=1000;   // Supabase entrega máximo 1,000 filas por consulta
function supaDB(sb){
  const subs={},csubs={},cache={},cargando={};
  const avisar=t=>setTimeout(()=>(subs[t]||[]).forEach(f=>f()),0);
  const emitir=t=>setTimeout(()=>(csubs[t]||[]).forEach(f=>f()),0);
  const falla=e=>{throw {code:e&&["42501","P0001"].includes(e.code)?"invalid_argument":"unavailable",message:e&&e.message};};
  const snap=(id,row)=>({id,exists:!!row,data:()=>row?clone(row.datos):undefined,metadata:{fromCache:false,hasPendingWrites:false}});
  const ligero=(t,x)=>LIGERO[t]?Object.fromEntries(LIGERO[t].filter(k=>x[k]!==null&&x[k]!==undefined).map(k=>[k,x[k]])):x.datos;
  async function cargar(t){
    if(cargando[t])return cargando[t];
    return cargando[t]=(async()=>{
      const sel=LIGERO[t]?"id,"+LIGERO[t].map(k=>`${k}:datos->${k}`).join(","):"id,datos";
      const m=new Map();
      for(let i=0;;i+=LOTE){
        const {data,error}=await sb.from(t).select(sel).order("id").range(i,i+LOTE-1);
        if(error)falla(error);
        (data||[]).forEach(x=>m.set(x.id,ligero(t,x)));
        if(!data||data.length<LOTE)break;
      }
      cache[t]=m;
    })().finally(()=>{cargando[t]=null;});
  }
  const recargarTodo=()=>Object.keys(cache).forEach(t=>cargar(t).then(()=>emitir(t),()=>{}));
  // después de guardar desde esta pantalla: trae solo esa fila (los triggers pueden haberla ajustado)
  async function refrescar(t,id){
    if(cache[t]){const {data}=await sb.from(t).select("id,datos").eq("id",id).maybeSingle();if(data)cache[t].set(id,data.datos);else cache[t].delete(id);emitir(t);}
    avisar(t);
  }
  const canal=sb.channel("cotizador");
  ["config","cotizaciones","aprobaciones"].forEach(t=>canal.on("postgres_changes",{event:"*",schema:"public",table:t},pl=>{
    if(cache[t]){
      if(pl.eventType==="DELETE"){if(pl.old&&pl.old.id)cache[t].delete(pl.old.id);}
      else if(pl.new&&pl.new.id&&pl.new.datos)cache[t].set(pl.new.id,pl.new.datos);
      emitir(t);
    }
    avisar(t);
  }));
  // si se cayó la conexión en tiempo real, al reconectar se vuelve a descargar todo una vez
  let suscrito=false;
  canal.subscribe(st=>{if(st==="SUBSCRIBED"){if(suscrito)recargarTodo();suscrito=true;}});
  // la pestaña estuvo oculta un rato (computadora dormida, otra ventana): se refresca al volver
  let oculta=0;
  document.addEventListener("visibilitychange",()=>{if(document.hidden)oculta=Date.now();else if(oculta&&Date.now()-oculta>60000)recargarTodo();});
  function doc(path){
    const [t,id]=path.split("/");
    const r={id,path,
      get:async()=>{const {data,error}=await sb.from(t).select("id,datos").eq("id",id).maybeSingle();if(error)falla(error);return snap(id,data);},
      set:async d=>{const {error}=await sb.from(t).upsert({id,datos:d});if(error)falla(error);refrescar(t,id);},
      update:async d=>{
        if(t==="cotizaciones"){const {error}=await sb.rpc("actualizar_cotizacion",{p_id:id,p_cambios:d});if(error)falla(error);refrescar(t,id);return;}
        const s0=await r.get();if(!s0.exists)throw {code:"invalid_argument"};await r.set({...s0.data(),...d});},
      delete:async()=>{const {error}=await sb.from(t).delete().eq("id",id);if(error)falla(error);if(cache[t]){cache[t].delete(id);emitir(t);}avisar(t);},
      onSnapshot:(n,e)=>{const f=()=>r.get().then(n,x=>e&&e(x));(subs[t]=subs[t]||[]).push(f);f();return()=>{subs[t]=subs[t].filter(x=>x!==f);};}};
    return r;
  }
  function col(t,ord){
    const q={path:t,doc:id=>doc(t+"/"+id),orderBy:(f,dir)=>col(t,[f,dir]),limit:()=>q,where:()=>q,
      onSnapshot:(n,e)=>{
        const f=()=>{
          let docs=[...cache[t].entries()].map(([id,datos])=>snap(id,{datos}));
          if(ord)docs.sort((a,b)=>((a.data()[ord[0]]||"")>(b.data()[ord[0]]||"")?1:-1)*(ord[1]==="desc"?-1:1));
          n({docs,size:docs.length,empty:!docs.length,metadata:{}});};
        (csubs[t]=csubs[t]||[]).push(f);
        if(cache[t])f();else cargar(t).then(()=>emitir(t),x=>e&&e({code:"unavailable",message:x&&x.message}));
        return()=>{csubs[t]=csubs[t].filter(x=>x!==f);};}};
    return q;
  }
  return {doc,collection:col};
}
function supaUser(sb,uid,perfil){
  return {canEdit:async()=>perfil.rol==="admin",id:async()=>uid,
    profiles:async ids=>{const {data}=await sb.from("perfiles").select("id,nombre").in("id",ids);const o={};(data||[]).forEach(p=>o[p.id]={name:p.nombre});return o;}};
}

/* pantalla de acceso */
const verLogin=(modo,msg)=>{
  $("login").hidden=false;$("login-logo").src=LOGO_CLARO;$("login-logo-o").src=LOGO_OSCURO;
  $("f-entrar").hidden=modo!=="entrar";$("f-clave").hidden=modo!=="clave";
  $("login-t").textContent=modo==="clave"?"Crea tu contraseña":"Inicia sesión";
  $("login-sub").textContent=modo==="clave"?"Mínimo 8 caracteres.":modo==="cargando"?"Conectando…":"Ingresa con tu correo de Sunname.";
  $("l-err").hidden=!msg;$("l-err").textContent=msg||"";$("l-ok").hidden=true;
};
async function entrar(session){
  const uid=session.user.id;
  const {data:perfil,error}=await S.sb.from("perfiles").select("nombre,rol,activo").eq("id",uid).maybeSingle();
  if(error||!perfil||!perfil.activo){S.saliendo=true;await S.sb.auth.signOut();verLogin("entrar",error?"No se pudo conectar. Intenta de nuevo.":"Tu usuario no tiene acceso. Pide a administración que lo active.");S.saliendo=false;return;}
  $("login").hidden=true;
  S.names[uid]=perfil.nombre;
  const nom=perfil.nombre||session.user.email,ini=nom.split(/\s+/).filter(w=>w.length>2||/^[A-ZÁÉÍÓÚÑ]/.test(w)).slice(0,2).map(w=>w[0]).join("").toUpperCase();
  $("usuario").hidden=false;$("av-ini").textContent=ini||"?";$("av-btn").title=nom;
  $("usr-nombre").textContent=nom;$("usr-correo").textContent=session.user.email;$("usr-rol").textContent=perfil.rol==="admin"?"Administración":"Ventas";
  await conectar(supaDB(S.sb),supaUser(S.sb,uid,perfil),localDL);
  S.sb.channel("notas").on("postgres_changes",{event:"*",schema:"public",table:"notas"},()=>cargarNotas()).subscribe();
  S.sb.channel("historial").on("postgres_changes",{event:"*",schema:"public",table:"config_historial"},()=>{if(!$("v-cfg").hidden)cargarHistorial();}).subscribe();
  cargarNotas();
}
async function iniciarSupabase(){
  const tipo=(location.hash.match(/type=([a-z]+)/)||[])[1];
  try{await cargarScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.min.js","sha384-WgXwGL6fUsYJWNaKJgVbrJKGRQwc1vieh2oy4kw9nXqpNDz3tdSsqEYUgeHD/NuF");}
  catch(e){verLogin("entrar","No se pudo conectar. Revisa tu internet y recarga la página.");return;}
  // bloqueo simple de sesión: el de pestañas del navegador puede quedarse esperando en algunos equipos
  const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{lock:async(n,t,fn)=>await fn()}});S.sb=sb;
  sb.auth.onAuthStateChange(ev=>{if(ev==="PASSWORD_RECOVERY")verLogin("clave");if(ev==="SIGNED_OUT"&&!S.saliendo)location.reload();});
  const {data:{session}}=await sb.auth.getSession();
  if(!session){verLogin("entrar");return;}
  if(tipo==="invite"||tipo==="recovery"){verLogin("clave");return;}
  await entrar(session);
}
$("f-entrar").addEventListener("submit",async e=>{
  e.preventDefault();const b=$("l-btn");b.disabled=true;b.textContent="Entrando…";$("l-err").hidden=true;
  const {data,error}=await S.sb.auth.signInWithPassword({email:$("l-correo").value.trim(),password:$("l-clave").value});
  b.disabled=false;b.textContent="Entrar";
  if(error){$("l-err").hidden=false;$("l-err").textContent=/confirm/i.test(error.message)?"Tu correo aún no está confirmado.":"Correo o contraseña incorrectos.";return;}
  await entrar(data.session);
});
$("l-ver").addEventListener("click",()=>{const i=$("l-clave"),v=i.type==="password";i.type=v?"text":"password";$("l-ver").textContent=v?"Ocultar":"Mostrar";$("l-ver").setAttribute("aria-label",v?"Ocultar contraseña":"Mostrar contraseña");i.focus();});
$("l-olvide").addEventListener("click",async()=>{
  const correo=$("l-correo").value.trim();
  if(!correo){$("l-err").hidden=false;$("l-err").textContent="Escribe tu correo y vuelve a dar clic.";$("l-correo").focus();return;}
  const {error}=await S.sb.auth.resetPasswordForEmail(correo,{redirectTo:location.origin+location.pathname});
  $("l-err").hidden=!error;$("l-err").textContent=error?"No se pudo enviar el correo. Intenta más tarde.":"";
  $("l-ok").hidden=!!error;$("l-ok").textContent="Te enviamos un correo para restablecer tu contraseña.";
});
$("f-clave").addEventListener("submit",async e=>{
  e.preventDefault();
  if($("n-clave").value!==$("n-clave2").value){$("n-err").hidden=false;$("n-err").textContent="Las contraseñas no coinciden.";return;}
  const {error}=await S.sb.auth.updateUser({password:$("n-clave").value});
  if(error){$("n-err").hidden=false;$("n-err").textContent="No se pudo guardar la contraseña: "+error.message;return;}
  history.replaceState(null,"",location.pathname);
  const {data:{session}}=await S.sb.auth.getSession();await entrar(session);toast("Contraseña guardada");
});
$("salir").addEventListener("click",async()=>{await S.sb.auth.signOut();});
const menuU=abrir=>{$("menu-u").hidden=!abrir;$("av-btn").setAttribute("aria-expanded",String(abrir));};
$("av-btn").addEventListener("click",e=>{e.stopPropagation();menuU($("menu-u").hidden);});
document.addEventListener("click",e=>{if(!e.target.closest("#usuario"))menuU(false);});
document.addEventListener("keydown",e=>{if(e.key==="Escape")menuU(false);});

/* =================== Conexión con la plataforma =================== */
async function conectar(db,user,dl){
  S.db=db;S.user=user;S.dl=dl;
  if(user){try{S.admin=await user.canEdit();}catch(e){}try{S.meId=await user.id();}catch(e){}}
  else S.admin=true;
  editable=S.admin;
  $("nav-cfg").hidden=!S.admin;
  if(!db){estado("Guardado solo en este navegador","pend");drawCfg();calc();renderHist();return;}
  estado(S.local?"Guardado en esta computadora":editable?"Cambios guardados para todos":"Solo lectura",editable?"":"ro");
  drawCfg();calc();
  db.doc("config/parametros").onSnapshot(s=>{
    if(!s.exists||s.metadata.hasPendingWrites)return;
    const d=s.data();
    // se ignora el eco de nuestro propio guardado y cualquier respuesta atrasada mientras se edita
    if(estable(d)===ultimo||guardandoCfg||(document.activeElement&&document.activeElement.closest("#secs")))return;
    P=merge(d);try{localStorage.setItem("sunname-cfg",JSON.stringify(P));}catch(e){}
    if(!(document.activeElement&&document.activeElement.closest("#secs")))drawCfg();
    drawDynamic();calc();renderHist();
  },()=>{});
  db.collection("cotizaciones").orderBy("creado","desc").limit(1000).onSnapshot(s=>{
    S.quotes=s.docs.map(d=>({id:d.id,...d.data()}));
    if(S.currentId){const q=S.quotes.find(x=>x.id===S.currentId);if(q&&!S.dirty)S.currentDoc=q;}
    renderHist();calc();
  },()=>{});
  db.collection("aprobaciones").onSnapshot(s=>{S.aprob={};s.docs.forEach(d=>S.aprob[d.id]=d.data());calc();},()=>{});
}
(async()=>{
  if(SUPABASE_URL&&SUPABASE_KEY){verLogin("cargando");try{await iniciarSupabase();}catch(e){verLogin("entrar","No se pudo conectar. Revisa tu internet y recarga la página.");}return;}
  S.local=true;await conectar(localDB(),null,localDL);
})();
})();
