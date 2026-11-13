import {DEFAULTS, compute, simulatedSeries, STANDARD_LINKS, measuredRecord, calibrationFit} from './engine.js';

const STORE_STATE='hormigon-lab.config.v1',STORE_HISTORY='hormigon-lab.records.v1';
const $=sel=>document.querySelector(sel), $$=sel=>[...document.querySelectorAll(sel)];
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(v,d=2)=>Number.isFinite(Number(v))?Number(v).toLocaleString('es-CO',{maximumFractionDigits:d,minimumFractionDigits:d}):'—';
const schema={
 geometry:[
  {key:'concrete',label:'Tipo de concreto',options:[['normal','Normal'],['alta','Alta resistencia (objetivo)'],['ligero','Liviano (referencial)']],wide:true},
  {key:'fc28',label:"Resistencia objetivo f’c a 28 días",unit:'MPa',min:5,max:150,step:1},
  {key:'age',label:'Edad de la probeta',unit:'días',min:1,max:365,step:1},
  {key:'diameter',label:'Diámetro del cilindro',unit:'mm',min:50,max:600,show:['cylinder']},
  {key:'height',label:'Altura del cilindro',unit:'mm',min:50,max:1000,show:['cylinder']},
  {key:'width',label:'Ancho (b) de la viga',unit:'mm',min:60,max:600,show:['beam','reinforced']},
  {key:'depth',label:'Altura (h) de la viga',unit:'mm',min:60,max:700,show:['beam','reinforced']},
  {key:'length',label:'Longitud total',unit:'mm',min:120,max:3000,show:['beam','reinforced']},
  {key:'span',label:'Luz entre apoyos',unit:'mm',min:100,max:2800,show:['beam','reinforced']},
  {key:'loading',label:'Configuración de carga',options:[['third','Dos cargas a tercios'],['center','Carga central']],wide:true,show:['beam','reinforced']},
  {key:'curing',label:'Método de curado',options:[['agua','Inmersión en agua'],['humedo','Cámara húmeda'],['ambiente','Ambiente (control incierto)']],wide:true},
 ],
 mix:[
  {key:'cement',label:'Masa de cemento',unit:'kg',min:.01,max:10000,step:.01},
  {key:'water',label:'Agua añadida',unit:'L',min:.01,max:8000,step:.01},
  {key:'sand',label:'Arena seca',unit:'kg',min:.01,max:10000,step:.1},
  {key:'gravel',label:'Grava seca',unit:'kg',min:.01,max:10000,step:.1},
  {key:'cementType',label:'Tipo de cemento',options:[['Tipo UG','Uso general'],['Tipo ART','Alta resistencia temprana'],['Tipo MCH','Moderado calor hidratación'],['Otro','Otro']],wide:true},
  {key:'sandSource',label:'Origen de la arena',options:[['Río','Río'],['Triturada','Triturada'],['Cantera','Cantera'],['Combinada','Combinada']]},
  {key:'gravelSource',label:'Origen de la grava',options:[['Triturada','Triturada'],['Río','Río'],['Reciclada','Reciclada (no calibrada)']]},
  {key:'nominalSize',label:'Tamaño máximo nominal',unit:'mm',min:4,max:100,step:.5},
  {key:'fineness',label:'Módulo de finura de arena',unit:'',min:1,max:4,step:.01},
  {key:'moistureSand',label:'Humedad total arena',unit:'%',min:0,max:25,step:.1},
  {key:'absSand',label:'Absorción arena',unit:'%',min:0,max:15,step:.1},
  {key:'moistureGravel',label:'Humedad total grava',unit:'%',min:0,max:25,step:.1},
  {key:'absGravel',label:'Absorción grava',unit:'%',min:0,max:15,step:.1},
  {key:'sgCement',label:'Gravedad específica cemento',min:2,max:4,step:.01},
  {key:'sgSand',label:'Gravedad específica arena',min:1.2,max:4,step:.01},
  {key:'sgGravel',label:'Gravedad específica grava',min:1.2,max:4,step:.01},
  {key:'air',label:'Aire de la mezcla',unit:'%',min:0,max:15,step:.1},
  {key:'admixture',label:'Aditivo',options:[['Ninguno','Ninguno'],['Reductor de agua','Reductor de agua'],['Retardante','Retardante'],['Acelerante','Acelerante'],['Inclusor de aire','Inclusor de aire']],wide:true},
  {key:'strengthModel',label:'Origen de la resistencia',options:[['design','Objetivo ingresado (base)'],['calibrated','Calibración con ensayos reales']],wide:true}
 ],
 steel:[
  {key:'nTop',label:'Barras longitudinales superiores',unit:'und',min:1,max:12,step:1},
  {key:'nBottom',label:'Barras longitudinales inferiores',unit:'und',min:1,max:12,step:1},
  {key:'barDiameter',label:'Diámetro barras',unit:'mm',min:4,max:40,step:.1},
  {key:'fy',label:'Límite de fluencia del acero',unit:'MPa',min:100,max:800,step:5},
  {key:'cover',label:'Recubrimiento',unit:'mm',min:5,max:150,step:1},
  {key:'hooks',label:'Extremos del acero',options:[['Rectas','Rectos'],['90 grados','Gancho 90° (visual)'],['135 grados','Gancho 135° (visual)']],wide:true},
  {key:'stirrups',label:'Incluir estribos',type:'checkbox',wide:true},
  {key:'stirrupDiameter',label:'Diámetro estribos',unit:'mm',min:3,max:16,step:.1,ifStirrups:true},
  {key:'stirrupSpacing',label:'Separación estribos',unit:'mm',min:20,max:500,step:5,ifStirrups:true},
  {key:'stirrupLegs',label:'Número de ramas',unit:'und',min:2,max:8,step:1,ifStirrups:true},
 ],
 machine:[
  {key:'rateCompression',label:'Velocidad de esfuerzo',unit:'MPa/s',min:.01,max:2,step:.01,show:['cylinder']},
  {key:'rateFlex',label:'Incremento de esfuerzo',unit:'MPa/min',min:.1,max:10,step:.1,show:['beam','reinforced']},
  {key:'playback',label:'Aceleración visual de simulación',options:[[1,'Tiempo físico 1×'],[5,'5×'],[10,'10×'],[25,'25×'],[50,'50×']],wide:true},
  {key:'loadMeasured',label:'Lectura máxima REAL (opcional)',unit:'kN',min:0,max:100000,step:.01,wide:true},
  {key:'sigmaAt50',label:'σ a 50 µε (medida)',unit:'MPa',min:0,max:250,step:.01,show:['cylinder']},
  {key:'epsilonAt40',label:'ε a 40% de carga (medida)',unit:'mm/mm',min:.00005,max:.01,step:.00001,show:['cylinder']},
  {key:'fractureOffset',label:'Distancia de fisura desde el centro',unit:'mm',min:0,max:1000,step:1,show:['beam','reinforced']},
 ]
};
const safeParse=(str, fallback)=>{try {return JSON.parse(str)??fallback;}catch{return fallback;}};
let state={...DEFAULTS,...safeParse(localStorage.getItem(STORE_STATE),{})};
let history=safeParse(localStorage.getItem(STORE_HISTORY),[]);
if(!Array.isArray(history))history=[];
let current=null, machine=null, simulation=null, frameRequest=null, animatedProgress=0, fallback3d=false;

function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('visible');clearTimeout(window._toastTimer);window._toastTimer=setTimeout(()=>el.classList.remove('visible'),3200);}
function saveState(){try{localStorage.setItem(STORE_STATE,JSON.stringify(state));}catch{}}
function saveHistory(){try{localStorage.setItem(STORE_HISTORY,JSON.stringify(history));}catch{toast('No fue posible guardar en el dispositivo.');}}
function isVisibleField(field){return (!field.show||field.show.includes(state.test))&&(!field.ifStirrups||state.stirrups);}
function fieldHtml(field){
  if(!isVisibleField(field))return '';
  const id=`f-${field.key}`;
  if(field.type==='checkbox')return `<div class="field wide"><label class="field-toggle" for="${id}">${escapeHTML(field.label)}<input type="checkbox" id="${id}" data-key="${field.key}" ${state[field.key]?'checked':''}></label></div>`;
  const control=field.options?`<select data-key="${field.key}" id="${id}">${field.options.map(([val,label])=>`<option value="${escapeHTML(val)}" ${String(state[field.key])===String(val)?'selected':''}>${escapeHTML(label)}</option>`).join('')}</select>`
  :`<input data-key="${field.key}" id="${id}" type="number" inputmode="decimal" step="${field.step??'any'}" ${field.min!==undefined?`min="${field.min}"`:''} ${field.max!==undefined?`max="${field.max}"`:''} value="${escapeHTML(state[field.key])}"/>`;
  return `<div class="field ${field.wide?'wide':''}"><label for="${id}">${escapeHTML(field.label)}</label><div class="field-control">${control}${field.unit?`<small>${escapeHTML(field.unit)}</small>`:''}</div></div>`;
}
function renderFields(){for(const [group,fields] of Object.entries(schema)) $(`#${group}-fields`).innerHTML=fields.map(fieldHtml).join('');
 $('#steel-details').hidden=state.test!=='reinforced';
 $$('.test-choice').forEach(b=>b.classList.toggle('active',b.dataset.test===state.test));
 $$('[data-key]').forEach(el=>el.addEventListener('change',()=>{
   const key=el.dataset.key;const raw=el.type==='checkbox'?el.checked:el.value;
   state[key]=el.type==='checkbox'?raw:el.type==='number'?(raw===''?'':Number(raw)):raw;
   if(key==='stirrups'){renderFields();}
   saveState();refresh();
 }));
}
function switchTab(name){$$('.tab-pane').forEach(p=>p.hidden=p.id!==`tab-${name}`);
 $$('.tabs [data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
 if(name==='lab'){setTimeout(()=>machine?.resize(),50);}
 if(name==='history')renderHistory();
 window.scrollTo({top:0,behavior:'smooth'});
}
function numericMetric(name,value,unit,subtitle){return `<div class="metric-card"><small>${escapeHTML(name)}</small><strong>${escapeHTML(value)} <span style="font-size:11px;color:#6fe3d8">${escapeHTML(unit)}</span></strong><p>${escapeHTML(subtitle)}</p></div>`;}
function drawChart(data){
 const svg=$('#mini-chart');if(!data?.length){svg.innerHTML='';return;}
 const max=Math.max(...data.map(p=>p.load),1),w=700,h=145,px=12,py=12;
 const x=t=>px+t*(w-px*2),y=v=>h-py-(v/max)*(h-2*py);
 const path=data.map((p,i)=>`${i?'L':'M'}${x(p.t).toFixed(2)},${y(p.load).toFixed(2)}`).join(' ');
 const area=`${path} L${x(1)},${h-py} L${x(0)},${h-py} Z`;
 svg.innerHTML=`<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#5ce3db" stop-opacity=".35"/><stop offset="1" stop-color="#5ce3db" stop-opacity="0"/></linearGradient></defs>
 <path d="M12 45H688 M12 83H688 M12 121H688" fill="none" stroke="#284354" stroke-dasharray="5 5"/>
 <path d="${area}" fill="url(#g)"/><path d="${path}" fill="none" stroke="#5ce3db" stroke-width="3.3" stroke-linecap="round" stroke-linejoin="round"/>`;
}
function renderResult(){
 const r=current;if(!r?.ok){$('#result-metrics').innerHTML='';$('#steps').innerHTML='';$('#result-alerts').innerHTML=(r?.errors||[]).map(m=>`<p class="warning error">${escapeHTML(m)}</p>`).join('');return;}
 $('#result-metrics').innerHTML=[
  numericMetric('CARGA MODELADA',num(r.loadKN,2),'kN','Estimación didáctica, no medida'),
  numericMetric('RESISTENCIA EN LA EDAD',num(r.fc,2),'MPa',r.basis),
  numericMetric('MÓDULO E CORRELACIONADO',num(r.E/1000,2),'GPa','Correlación aproximada, no ASTM C469'),
  numericMetric('RELACIÓN AGUA/CEMENTO',num(r.mix.waterToCement,3),'a/c','Ajustada por humedad y absorción'),
  numericMetric('RENDIMIENTO DE LA MEZCLA',num(r.mix.totalLiters,1),'L','Método aproximado de volúmenes absolutos'),
  numericMetric('RITMO DE FUERZA',num(r.rateKNs,3),'kN/s','Según la tasa de esfuerzo configurada'),
  numericMetric('TIEMPO MODELADO',num(r.duration,1),'s','Sin aceleración visual'),
  numericMetric('MECANISMO POSIBLE',r.s.test==='reinforced'?'Flexión / cortante':r.s.test==='cylinder'?'Compresión':'Flexión','','No sustituye la inspección de fractura'),
  ...(r.measured?[numericMetric('RESISTENCIA DESDE LECTURA',num(r.measured.strength,3),'MPa','Calculado desde carga real ingresada')]:[]),
  ...(r.capacity?[numericMetric('φMn',num(r.capacity.Mdesign,3),'kN·m','Estimación seccional'),numericMetric('φVn',num(r.capacity.Vdesign,3),'kN','Estimación seccional')]:[])
 ].join('');
 $('#result-alerts').innerHTML=`<p class="warning"><b>Alcance:</b> ${escapeHTML(r.loadModel)}. ${escapeHTML(r.mechanism)}. No equivale a un ensayo certificado.</p>`+r.warnings.map(w=>`<p class="warning">${escapeHTML(w)}</p>`).join('');
 $('#steps').innerHTML=r.steps.map((s,i)=>`<article class="step-card"><span class="num">${String(i+1).padStart(2,'0')}</span><h3>${escapeHTML(s.title)}</h3><div class="equation">${escapeHTML(s.formula)}</div><p><b>Sustitución:</b> ${escapeHTML(s.substitution)}</p><div class="step-result">= ${escapeHTML(s.result)}</div>${s.note?`<p>${escapeHTML(s.note)}</p>`:''}</article>`).join('');
}
function refresh(){
 current=compute(state,history);
 const isCylinder=state.test==='cylinder',isReinforced=state.test==='reinforced';
 $('#viewer-title').textContent=isCylinder?'Compresión uniaxial de cilindro':isReinforced?'Flexión de viga reforzada':'Flexión de viga de concreto simple';
 $('#standard-label').textContent=isCylinder?'ASTM C39/C39M':isReinforced?'MODELO DE SECCIÓN ARMADA':state.loading==='third'?'ASTM C78/C78M':'ASTM C293/C293M';
 $('#mode-status').textContent=isCylinder?'Compresión axial':isReinforced?'Flexión y cortante':'Flexión '+(state.loading==='third'?'a tercios':'central');
 $('#rate-status').textContent=isCylinder?`${num(state.rateCompression)} MPa/s`:`${num(state.rateFlex)} MPa/min`;
 $('#peak-display').textContent=current.ok?num(current.loadKN,1):'—';
 $('#strength-display').textContent=current.ok?num(isCylinder?current.fc:current.modulus,2):'—';
 $('#elastic-display').textContent=current.ok?num(current.E/1000,1):'—';
 drawChart(current.ok?simulatedSeries(current):[]);
 if(machine)try{machine.setConfig({...state,mechanism:current?.mechanism});}catch(e){console.error(e);}
 if(fallback3d)paintFallback(0);
 renderResult();
 updateGauge(0);if(simulation)stopSimulation(false);
}
function updateGauge(t){
 animatedProgress=t;const p=Math.max(0,Math.min(1,t));const rise=p<.92?p/.92:1-.78*((p-.92)/.08);
 const value=current?.ok?Math.max(0,rise)*current.loadKN:0;
 $('#gauge-value').textContent=num(value,2);$('#gauge-fill').style.width=`${Math.round(p*100)}%`;
 $('#gauge-caption').textContent=`${Math.round(p*100)}% de la duración modelada`;
 $('#progress-status').textContent=`${Math.round(p*100)} %`;
 machine?.setProgress(p);if(fallback3d)paintFallback(p);
}
function stopSimulation(resetStatus=true){
 if(frameRequest)cancelAnimationFrame(frameRequest);frameRequest=null;simulation=null;
 $('#run-btn').innerHTML='<span>▶</span> Iniciar simulación';if(resetStatus)$('#machine-status').textContent='EN ESPERA';
}
function startSimulation(){
 if(!current.ok){toast('Corrige los datos señalados en Resultados.');switchTab('results');return;}
 if(simulation){stopSimulation();return;}
 updateGauge(0);simulation={start:performance.now(),duration:current.duration, playback:Number(state.playback)||10};
 $('#machine-status').textContent='CARGANDO';$('#run-btn').innerHTML='■ Detener ensayo';
 function animate(now){if(!simulation)return;
   const t=Math.min(1,(now-simulation.start)/1000*simulation.playback/Math.max(simulation.duration,.01));
   updateGauge(t);
   if(t>=1){stopSimulation(false);$('#machine-status').textContent='FALLA MODELADA';toast('Simulación concluida. Consulta la memoria de cálculo.');}
   else frameRequest=requestAnimationFrame(animate);
 }frameRequest=requestAnimationFrame(animate);
}
function renderNorms(){
 $('#norms-list').innerHTML=STANDARD_LINKS.map(s=>`<a class="norm" href="${escapeHTML(s.url)}" target="_blank" rel="noopener"><span><strong>${escapeHTML(s.code)}</strong><small>${escapeHTML(s.label)}</small></span><b>↗</b></a>`).join('');
}
function renderHistory(){
 const fit=calibrationFit(history);
 $('#history-count').textContent=String(history.length);
 $('#calibration-status').textContent=fit?`R² ${num(fit.r2,2)}`:'Sin calibrar';
 $('#calibration-details').textContent=fit?`${fit.n} registros reales válidos`:'Mínimo tres cilindros a 28 días';
 $('#history-list').innerHTML=history.length?history.slice().reverse().map(r=>`<div class="history-record"><div><strong>${escapeHTML(r.label||r.id)}</strong><small>${escapeHTML((r.date||'').slice(0,10))} · ${escapeHTML(r.test)} · f=${num(r.fcMeasured,2)} MPa · a/c=${num(r.wc,3)} · P=${num(r.forceKN,1)} kN</small></div><button data-delete="${escapeHTML(r.id)}" aria-label="Eliminar registro">✕</button></div>`).join(''):'<p class="tiny-note">Todavía no hay registros experimentales guardados. Ingresa una carga REAL en la configuración de la máquina para crear el primero.</p>';
 $$('[data-delete]').forEach(btn=>btn.addEventListener('click',()=>{history=history.filter(r=>r.id!==btn.dataset.delete);saveHistory();renderHistory();refresh();}));
}
function downloadFile(name,body,type){
 const file=new Blob([body],{type});const url=URL.createObjectURL(file);
 const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function exportReport(){if(!current?.ok){toast('No hay cálculo válido para exportar.');return;}
 const r=current,stamp=new Date().toLocaleString('es-CO');
 const content=`<!DOCTYPE html><html lang="es"><meta charset="utf-8"><title>Memoria Hormigón Lab</title><style>body{font-family:Arial,sans-serif;max-width:920px;margin:36px auto;line-height:1.6;color:#122532;padding:20px}h1{font-size:25px}h2{margin-top:25px;color:#155464;border-bottom:1px solid #bbb}.card{padding:13px;margin:10px 0;border:1px solid #ccd7de;border-radius:8px}.expr{font-family:Georgia,serif;background:#eff5f7;padding:9px;white-space:pre-wrap}small{color:#637786}@media print{body{margin:0}}</style><h1>HORMIGÓN LAB — MEMORIA DE CÁLCULO</h1><p>Fecha: ${escapeHTML(stamp)} · Ensayo: ${escapeHTML(r.s.test)} · ${escapeHTML(r.standards.join(', '))}</p><p><strong>Advertencia: </strong> los valores no sustituyen un ensayo certificado. La carga modelada es una estimación didáctica.</p><h2>Resultados</h2><p>Carga estimada ${num(r.loadKN)} kN · f_c modelado ${num(r.fc)} MPa · E correlacionado ${num(r.E)} MPa · a/c ${num(r.mix.waterToCement,3)} · Rendimiento ${num(r.mix.totalLiters,1)} L</p>${r.measured?`<p><strong>Lectura real:</strong> ${num(r.measured.loadKN,2)} kN; esfuerzo equivalente ${num(r.measured.strength,3)} MPa.</p>`:''}<h2>Cálculo desarrollado</h2>${r.steps.map((s,i)=>`<div class="card"><strong>${i+1}. ${escapeHTML(s.title)}</strong><p class="expr">${escapeHTML(s.formula)}</p><p>Sustitución: ${escapeHTML(s.substitution)}</p><strong>= ${escapeHTML(s.result)}</strong><p><small>${escapeHTML(s.note)}</small></p></div>`).join('')}<h2>Observaciones</h2>${r.warnings.map(w=>`<p>• ${escapeHTML(w)}</p>`).join('')}<hr><p>Hormigón Lab · Uso académico</p></html>`;
 downloadFile('Memoria_Hormigon_Lab.html',content,'text/html;charset=utf-8');toast('Memoria exportada. Puedes imprimirla como PDF.');
}
async function exportPdf(){
 if(!current?.ok){toast('No hay cálculo válido para exportar.');return;}
 try{
  const {jsPDF}=await import('jspdf');
  const pdf=new jsPDF({unit:'mm',format:'a4',compress:true});
  const r=current;let y=24;const left=17,maxY=275,pageW=180;
  const normalize=s=>String(s??'').replaceAll('φ','phi').replaceAll('σ','sigma').replaceAll('ε','epsilon').replaceAll('π','pi').replaceAll('×','x').replaceAll('√','raiz ').replaceAll('²','^2').replaceAll('³','^3').replaceAll('≥','>=').replaceAll('≤','<=').replaceAll('−','-').replaceAll('≈','aprox. ').replaceAll('·','*');
  const line=(txt,size=10,leading=5.1,bold=false)=>{
   pdf.setFont('helvetica',bold?'bold':'normal');pdf.setFontSize(size);
   const rows=pdf.splitTextToSize(normalize(txt),pageW);
   for(const text of rows){if(y>maxY){pdf.addPage();y=20;}pdf.text(text,left,y);y+=leading;}
  };
  pdf.setFillColor(10,27,42);pdf.rect(0,0,210,15,'F');
  pdf.setTextColor(11,60,71);line('HORMIGON LAB — MEMORIA DE CALCULO',18,8,true);
  pdf.setTextColor(50,65,74);line(`Fecha: ${new Date().toLocaleString('es-CO')} | Ensayo: ${r.s.test}`,10);
  line(`Referencia: ${r.standards.join(' / ')}`,9);
  y+=4;pdf.setTextColor(160,52,30);line('ESTIMACIONES EDUCATIVAS: no representan un ensayo certificado ni una prediccion garantizada.',9,5,true);
  pdf.setTextColor(19,47,58);y+=5;
  line(`Carga modelada: ${num(r.loadKN,3)} kN | f_c modelado: ${num(r.fc,3)} MPa | E correlacionado: ${num(r.E,0)} MPa`,11,6,true);
  line(`Agua/cemento: ${num(r.mix.waterToCement,3)} | Rendimiento: ${num(r.mix.totalLiters,2)} L | Ritmo: ${num(r.rateKNs,3)} kN/s`);
  if(r.measured)line(`LECTURA REAL: ${num(r.measured.loadKN,2)} kN | Esfuerzo calculado: ${num(r.measured.strength,3)} MPa`,11,6,true);
  y+=6;pdf.setDrawColor(137,180,190);pdf.line(17,y,194,y);y+=9;line('PROCEDIMIENTO MATEMATICO',14,8,true);
  r.steps.forEach((s,i)=>{y+=3;line(`${i+1}. ${s.title}`,10,6,true);line(`Formula: ${s.formula}`,9,5);line(`Sustitucion: ${s.substitution}`,9,5);line(`Resultado: ${s.result}`,10,6,true);if(s.note)line(s.note,8,4.5);});
  y+=6;line('OBSERVACIONES DEL MODELO',12,8,true);
  r.warnings.forEach(w=>line('• '+w,9,5));
  const name='Hormigon_Lab_Memoria.pdf';
  const isNative=Boolean(window.Capacitor?.isNativePlatform?.());
  if(isNative){
   const [{Filesystem,Directory},{Share}]=await Promise.all([import('@capacitor/filesystem'),import('@capacitor/share')]);
   const data=pdf.output('datauristring').split(',')[1];
   const saved=await Filesystem.writeFile({path:name,directory:Directory.Cache,data});
   await Share.share({title:'Hormigón Lab - memoria de cálculo',url:saved.uri,dialogTitle:'Guardar o compartir memoria PDF'});
  }else pdf.save(name);
  toast('Memoria PDF preparada.');
 }catch(err){console.error(err);toast('No fue posible generar PDF. Usa la exportación HTML como alternativa.');}
}
function paintFallback(t){
 const c=$('#machine-canvas'),rect=c.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
 if(c.width!==Math.floor(rect.width*dpr)||c.height!==Math.floor(rect.height*dpr)){c.width=rect.width*dpr;c.height=rect.height*dpr;}
 const g=c.getContext('2d');g.save();g.scale(dpr,dpr);const w=rect.width,h=rect.height;
 g.clearRect(0,0,w,h);
 const grad=g.createRadialGradient(w*.52,h*.4,5,w*.5,h*.5,Math.max(w,h));grad.addColorStop(0,'#254555');grad.addColorStop(1,'#09111d');g.fillStyle=grad;g.fillRect(0,0,w,h);
 const X=x=>w/2+x*Math.min(w/6.8,h/6.5),Y=y=>h*.86-y*Math.min(w/6.8,h/6.5),scale=Math.min(w/6.8,h/6.5);
 g.lineCap='round';
 const drawBox=(x,y,ww,hh,color)=>{g.fillStyle=color;g.fillRect(X(x),Y(y+hh),ww*scale,hh*scale);};
 drawBox(-2.35,0,4.7,.3,'#273849');drawBox(-2.3,4.23,4.6,.43,'#8194a1');
 for(const x of [-1.92,1.92]){g.strokeStyle='#9ab9c4';g.lineWidth=.23*scale;g.beginPath();g.moveTo(X(x),Y(.38));g.lineTo(X(x),Y(4.26));g.stroke();}
 drawBox(-.65,3.7,1.3,.43,'#a8bdc7');drawBox(-.34,3.03,.68,.67,'#7c9fae');drawBox(-.68,2.85-t*.36,1.36,.16,'#b7c7cf');
 if(state.test==='cylinder'){
   g.fillStyle='#9ba6a7';g.beginPath();g.ellipse(w/2,Y(1.34),.57*scale,.83*scale,0,0,Math.PI*2);g.fill();
   g.strokeStyle='#d2dadb';g.lineWidth=2;g.stroke();drawBox(-.7,.47,1.4,.1,'#b1c7d0');
 }else{drawBox(-1.67,.7,3.34,.75,'#8d999c');drawBox(-1.51,.48,.25,.19,'#a1b2bd');drawBox(1.26,.48,.25,.19,'#a1b2bd');
   if(state.test==='reinforced'){g.strokeStyle='#424b55';g.lineWidth=4;for(const yy of [.91,1.29]){g.beginPath();g.moveTo(X(-1.57),Y(yy));g.lineTo(X(1.57),Y(yy));g.stroke();}}
 }
 if(t>.90){g.strokeStyle='#a83226';g.lineWidth=3;g.beginPath();g.moveTo(X(.2),Y(1.55));g.lineTo(X(-.05),Y(1.18));g.lineTo(X(.12),Y(.75));g.stroke();}
 g.fillStyle='#9fbfc6';g.textAlign='center';g.font='12px sans-serif';g.fillText('VISUALIZACIÓN TÉCNICA 2D · 3D REQUIERE DEPENDENCIAS',w/2,h*.96);
 g.restore();
}

async function initialize3D(){
 try{const {UniversalMachine3D}=await import('./machine3d.js');machine=new UniversalMachine3D($('#machine-canvas'));machine.setConfig(state);}
 catch(err){console.warn('3D no disponible, usando vista de respaldo:',err);fallback3d=true;paintFallback(animatedProgress);}
}
function wire(){
 $$('.tabs button').forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.tab)));
 $$('.test-choice').forEach(btn=>btn.addEventListener('click',()=>{state.test=btn.dataset.test;renderFields();saveState();refresh();}));
 $('#apply-preset').addEventListener('click',()=>{
   const preset=$('#preset-select').value;
   const configs={
     lab:{cement:6,sand:12,gravel:18,water:3,fc28:28},
     normal:{cement:350,sand:720,gravel:1040,water:175,fc28:28},
     high:{cement:7.5,sand:12,gravel:18,water:3.0,fc28:42,concrete:'alta'},
     reinforced:{test:'reinforced',nTop:3,nBottom:3,barDiameter:9.5,stirrups:true,stirrupSpacing:80,cester:false,fc28:28},
     nostirrups:{test:'reinforced',nTop:3,nBottom:3,barDiameter:9.5,stirrups:false,fc28:28},
   };
   const next={...configs[preset]};delete next.cester;Object.assign(state,next);
   renderFields();saveState();refresh();toast('Ejemplo académico aplicado. Ajusta los datos de tu ensayo.');
 });
 $('#run-btn').addEventListener('click',startSimulation);
 $('#reset-btn').addEventListener('click',()=>{stopSimulation();updateGauge(0);$('#machine-status').textContent='LISTA';});
 $('#camera-btn').addEventListener('click',()=>{if(machine)machine.resetView();else toast('La vista técnica de respaldo no admite rotación.');});
 $('#export-report').addEventListener('click',exportReport);
 $('#export-pdf').addEventListener('click',exportPdf);
 $('#save-real').addEventListener('click',()=>{
   if(!current?.ok||!current.measured){toast('Primero registra la carga REAL del ensayo en la máquina.');return;}
   try{history.push(measuredRecord(state,current,$('#record-label').value.trim()));saveHistory();renderHistory();refresh();toast('Lectura real registrada.');}
   catch(e){toast(e.message);}
 });
 $('#export-json').addEventListener('click',()=>downloadFile('HormigonLab_ensayos_reales.json',JSON.stringify({format:'hormigonlab.v1',records:history},null,2),'application/json'));
 $('#import-json').addEventListener('change',async e=>{
   const file=e.target.files?.[0];if(!file)return;
   try{const data=JSON.parse(await file.text());const rows=Array.isArray(data)?data:data.records;
     if(!Array.isArray(rows)||rows.length>2000||rows.some(r=>typeof r!=='object'||typeof r.id!=='string'||r.measured!==true||!Number.isFinite(Number(r.forceKN))))throw Error('El archivo no contiene registros válidos de Hormigón Lab.');
     const merged=[...history];for(const r of rows)if(!merged.some(h=>h.id===r.id))merged.push(r);history=merged;saveHistory();renderHistory();refresh();toast('Historial importado.');
   }catch(ex){toast(ex.message||'No se pudo leer el archivo.');}e.target.value='';
 });
 window.addEventListener('resize',()=>{if(fallback3d)paintFallback(animatedProgress);});
}
function init(){renderFields();renderNorms();renderHistory();wire();refresh();initialize3D();}
init();
