/**
 * HORMIGÓN LAB — motor de cálculo académico, independiente de la interfaz.
 * Unidades: mm, MPa (= N/mm²), kN, kg, L, s.
 * Regla: distinguir identidades físicas y expresiones analíticas de predicciones heurísticas.
 */
export const DEFAULTS = Object.freeze({
  test: 'cylinder', concrete: 'normal', loading: 'third',
  diameter: 150, height: 300, width: 150, depth: 150, length: 600, span: 450,
  age: 28, fc28: 28, curing: 'agua', rateCompression: 0.25,
  rateFlex: 1.0, playback: 10, loadMeasured: '',
  cement: 6, water: 3, sand: 12, gravel: 18, air: 2,
  sgCement: 3.15, sgSand: 2.64, sgGravel: 2.68,
  moistureSand: 1.5, absSand: 1.0, moistureGravel: 0.5, absGravel: 0.8,
  cementType: 'Tipo UG', sandSource: 'Río', gravelSource: 'Triturada', fineness: 2.7,
  nominalSize: 19, admixture: 'Ninguno', strengthModel: 'design',
  nTop: 3, nBottom: 3, barDiameter: 9.5, fy: 420,
  cover: 30, stirrups: false, stirrupDiameter: 6, stirrupSpacing: 100,
  stirrupLegs: 2, hooks: 'Rectas', fractureOffset: 0,
  sigmaAt50: '', epsilonAt40: '',
});
export const STANDARD_LINKS = Object.freeze([
  { code: 'ASTM C39/C39M-26', label: 'Compresión uniaxial de cilindros', url:'https://store.astm.org/c0039_c0039m-26.html' },
  { code: 'ASTM C78/C78M-22', label: 'Flexión de viga simple a tercios', url:'https://store.astm.org/standards/c78_c78m' },
  { code: 'ASTM C293/C293M', label: 'Flexión de viga simple con carga central', url:'https://store.astm.org/standards/c293_c293m' },
  { code: 'ASTM C469/C469M-22', label: 'Módulo estático con deformaciones medidas', url:'https://store.astm.org/standards/c469_c469m' },
  { code: 'ASTM C192/C192M-26a', label: 'Elaboración y curado en laboratorio', url:'https://store.astm.org/c0192_c0192m-26a.html' },
  { code: 'ASTM C33/C33M-24a', label: 'Agregados para concreto', url:'https://store.astm.org/c0033_c0033m-24a.html' },
  { code: 'ACI PRC-211.1-22', label: 'Selección de proporciones y mezclas de prueba', url:'https://www.concrete.org/Portals/0/Files/PDF/Previews/211.1-22_preview.pdf' },
]);
const N = (x) => Number(x);
const fixed = (x,d=3) => Number.isFinite(x) ? x.toFixed(d) : '—';
const validPositive=(x)=>Number.isFinite(N(x)) && N(x)>0;
const row=(title,formula,substitution,result,note='')=>({title,formula,substitution,result,note});

export function ageFactor(age) {
  // Ley de potencia DIDÁCTICA, no norma ni predicción certificada.
  if (!validPositive(age)) throw Error('La edad debe ser mayor que cero.');
  return Math.min(1.10, Math.max(0.35, Math.pow(N(age)/28, 0.22)));
}
export function calibrationFit(records) {
  // Modelo local opcional: ln(f'c28)=a+b*(agua/cemento), solo para cilindros ensayados a 28 d.
  const data=(records||[]).filter(r=>r && r.test==='cylinder' && r.measured===true &&
    Number(r.age)===28 && validPositive(r.fcMeasured) && validPositive(r.wc) && N(r.wc)>0.2 && N(r.wc)<1.2);
  if (data.length<3) return null;
  const xx=data.map(r=>N(r.wc)), yy=data.map(r=>Math.log(N(r.fcMeasured)));
  const n=xx.length, xbar=xx.reduce((a,b)=>a+b,0)/n, ybar=yy.reduce((a,b)=>a+b,0)/n;
  const ssx=xx.reduce((s,x)=>s+(x-xbar)**2,0);
  if(ssx<1e-8) return null;
  const b=xx.reduce((s,x,i)=>s+(x-xbar)*(yy[i]-ybar),0)/ssx;
  const a=ybar-b*xbar, sst=yy.reduce((s,y)=>s+(y-ybar)**2,0);
  const sse=yy.reduce((s,y,i)=>s+(y-(a+b*xx[i]))**2,0);
  return {a,b,n,r2:sst>0?1-sse/sst:1, minWC:Math.min(...xx),maxWC:Math.max(...xx)};
}

export function validate(s) {
  const errors=[], warnings=[];
  const must=['fc28','age','cement','water','sand','gravel','sgCement','sgSand','sgGravel','nominalSize'];
  if(N(s.air)<0||N(s.air)>=30)errors.push('El contenido de aire debe estar entre 0 y 30 %.');
  if(['concrete','test'].some(k=>!s[k]))errors.push('Selecciona el tipo de concreto y ensayo.');
  if(s.test==='cylinder') must.push('diameter','height','rateCompression');
  else must.push('width','depth','span','length','rateFlex');
  if(s.test==='reinforced') must.push('barDiameter','fy','cover','nBottom','nTop');
  if(s.stirrups && s.test==='reinforced') must.push('stirrupDiameter','stirrupSpacing','stirrupLegs');
  for(const key of must) if(!validPositive(s[key])) errors.push(`Introduce un valor positivo para ${key}.`);
  if(s.test!=='cylinder' && N(s.span)>N(s.length)) errors.push('La luz entre apoyos no puede superar la longitud de la viga.');
  if(s.test==='reinforced' && N(s.depth)<=2*N(s.cover)+N(s.stirrupDiameter)+N(s.barDiameter)) errors.push('La sección no permite alojar el refuerzo con ese recubrimiento.');
  if(s.test==='cylinder' && (N(s.rateCompression)<0.20||N(s.rateCompression)>0.30)) warnings.push('La tasa de esfuerzo configurada difiere del rango 0,25 ± 0,05 MPa/s empleado como referencia de C39; confirmar la edición aplicable y el equipo.');
  if(s.test!=='cylinder' && s.loading==='third' && (N(s.rateFlex)<0.9||N(s.rateFlex)>1.2)) warnings.push('Para referencia C78/C78M-22 se emplea 0,9 a 1,2 MPa/min de incremento de esfuerzo en la fibra traccionada.');
  if(N(s.water)/N(s.cement)>0.70) warnings.push('Relación agua/cemento elevada; validar resistencia y durabilidad mediante mezclas de prueba.');
  if(N(s.water)/N(s.cement)<0.28) warnings.push('Relación agua/cemento muy baja; comprobar trabajabilidad y tecnología de colocación.');
  if(s.test!=='cylinder' && N(s.span)<3*N(s.depth)) warnings.push('Viga profunda/corta: las fórmulas simples de flexión y cortante pueden no describir el mecanismo de falla.');
  if(s.test==='reinforced' && N(s.nominalSize)>(N(s.width)-2*N(s.cover))/3) warnings.push('Revisar tamaño máximo nominal frente a dimensiones y espacios libres del armado.');
  if(s.test==='reinforced' && !s.stirrups) warnings.push('Sin acero transversal: posible falla frágil por cortante o adherencia; el modelo no reproduce fisuración local.');
  if(s.test==='reinforced' && s.hooks!=='Rectas') warnings.push('Los ganchos se muestran en 3D, pero no se calcula longitud de desarrollo ni resistencia de anclaje.');
  if(N(s.age)<28) warnings.push('Estimación de evolución de resistencia por edad: función didáctica, no criterio de aceptación.');
  if(s.test==='reinforced') {
    const clear = (N(s.width)-2*(N(s.cover)+N(s.stirrups?s.stirrupDiameter:0))-N(s.nBottom)*N(s.barDiameter))/(N(s.nBottom)-1||1);
    if(clear < Math.max(N(s.barDiameter),25,N(s.nominalSize)*4/3)) warnings.push('La separación libre horizontal entre barras puede ser insuficiente para el agregado elegido.');
  }
  return {errors,warnings};
}

export function mixture(s) {
  const cement=N(s.cement), sand=N(s.sand), gravel=N(s.gravel), water=N(s.water);
  // Valores de masas de agregados expresados en base seca; humedad total vs absorción.
  // Para ajustar agua agregada se usa el aporte superficial neto.
  const surfaceWater=(N(s.moistureSand)-N(s.absSand))*sand/100+(N(s.moistureGravel)-N(s.absGravel))*gravel/100;
  const effectiveWater=water+surfaceWater;
  const absoluteLiters=cement/N(s.sgCement)+sand/N(s.sgSand)+gravel/N(s.sgGravel)+effectiveWater;
  const totalLiters=absoluteLiters/(1-N(s.air)/100);
  const wc=effectiveWater/cement;
  return {surfaceWater,effectiveWater,waterToCement:wc,absoluteLiters,totalLiters,apparentDensity:(cement+sand+gravel+effectiveWater)/(totalLiters/1000),
    cementPerM3:cement*1000/totalLiters, sandPerM3:sand*1000/totalLiters, gravelPerM3:gravel*1000/totalLiters,
    normalized:{cement:1,sand:sand/cement,gravel:gravel/cement}};
}

export function compute(input, records=[]) {
  const s={...DEFAULTS,...input}, v=validate(s);
  if(v.errors.length) return {ok:false,errors:v.errors,warnings:v.warnings};
  const notes=[...v.warnings], steps=[], mix=mixture(s), factor=ageFactor(s.age), fit=calibrationFit(records);
  if(!Number.isFinite(mix.totalLiters)||mix.effectiveWater<=0) return {ok:false,errors:['La combinación de humedades produce agua efectiva o rendimiento no válido.'],warnings:notes};
  if(s.concrete!=='normal')notes.push('Para concreto de alta resistencia o liviano, las correlaciones simplificadas de E y módulo de rotura requieren calibración y reglas específicas.');
  if(s.curing!=='agua')notes.push('El tipo de curado se registra pero no se aplica un factor arbitrario a la resistencia: se necesitan datos reales para cuantificar su influencia.');
  if(s.admixture!=='Ninguno')notes.push('El efecto del aditivo en trabajabilidad y resistencia depende de su ficha técnica y dosificación; aquí no se asigna un aumento artificial.');
  let fc28=N(s.fc28), basis='Resistencia objetivo introducida por el usuario';
  if(s.strengthModel==='calibrated') {
    if(fit) {fc28=Math.exp(fit.a+fit.b*mix.waterToCement);basis=`Ajuste empírico con ${fit.n} ensayos propios (R²=${fixed(fit.r2,2)})`;
      if(mix.waterToCement<fit.minWC||mix.waterToCement>fit.maxWC) notes.push('La relación a/c está fuera del intervalo histórico de calibración: extrapolación incierta.');
      if(fit.r2<0.65) notes.push('Ajuste histórico con R² bajo: resultado de predicción poco fiable.');
    } else {notes.push('No hay al menos tres ensayos reales de cilindros a 28 días para calibración; se emplea el f\'c introducido.');}
  }
  const fc=fc28*factor, fr=0.62*Math.sqrt(fc), E=4700*Math.sqrt(fc), reinforced=s.test==='reinforced';
  steps.push(row('Relación agua/cemento efectiva','a/c = (agua añadida + aporte superficial de agregados) / cemento',
    `(${fixed(s.water)} + ${fixed(mix.surfaceWater)}) / ${fixed(s.cement)}`,fixed(mix.waterToCement),
    'Balance de agua estimado con humedades y absorciones ingresadas. Verificar base seca/SSD en el laboratorio.'));
  steps.push(row('Volumen absoluto / rendimiento','V ≈ [Σ(masa_i / G_i) + agua efectiva] / (1 − aire)',
    `${fixed(mix.absoluteLiters,1)} / (1 − ${fixed(s.air,1)} %)`,`${fixed(mix.totalLiters,1)} L`,
    'Aproximación de volúmenes absolutos, sin corrección por aditivos; la dosificación debe ensayarse.'));
  steps.push(row('Resistencia a la edad del ensayo (MODELO)','f_c(t) = f_c(28) · min(1,10; max(0,35; (t/28)^0,22))',
    `${fixed(fc28,2)} × ${fixed(factor,3)}`,`${fixed(fc,3)} MPa`,
    'Heurística educativa de evolución de edad; NO es un resultado ASTM ni una medida de laboratorio.'));
  steps.push(row('Módulo elástico estimado','E_c ≈ 4700 √f_c (concreto de peso normal)',
    `4700 × √${fixed(fc,3)}`,`${fixed(E,0)} MPa`,
    'Correlación aproximada de diseño. ASTM C469 requiere registro real de esfuerzos y deformaciones.'));
  let loadKN, rateKNs, modulus, mechanism, loadModel, capacity, specimenArea, momentKNm=null, shearKN=null, flexMode=s.loading;
  if(s.test==='cylinder') {
    const A=Math.PI*N(s.diameter)**2/4; specimenArea=A;
    loadKN=fc*A/1000; rateKNs=N(s.rateCompression)*A/1000;
    modulus=fc; mechanism='Compresión axial (ilustrativa)';
    loadModel='Modelo didáctico: carga de rotura derivada de f_c configurada por el usuario';
    steps.push(row('Área transversal del cilindro','A = π D² / 4',`π × ${s.diameter}² / 4`,`${fixed(A,1)} mm²`));
    steps.push(row('Carga de falla estimada (NO MEDIDA)','P_est = f_c,modelo × A / 1000',
      `${fixed(fc,2)} × ${fixed(A,1)} / 1000`,`${fixed(loadKN,2)} kN`));
    steps.push(row('Velocidad de fuerza','dP/dt = (dσ/dt) A / 1000',
      `${s.rateCompression} × ${fixed(A,1)} / 1000`,`${fixed(rateKNs,3)} kN/s`,
      'La tasa de esfuerzo es un ajuste de simulación; verificar la edición de norma y el equipo real.'));
  } else {
    const b=N(s.width),d=N(s.depth),L=N(s.span); specimenArea=b*d;
    const flexCoefficient=flexMode==='center'?3/2:1;
    rateKNs=N(s.rateFlex)*b*d*d/(L*flexCoefficient*1000*60);
    steps.push(row('Geometría de flexión','b × h, luz L',`${b} × ${d}; L=${L}`,`${fixed(b*d,0)} mm²`));
    if(!reinforced){
      modulus=fr;loadKN=fr*b*d*d/(L*flexCoefficient*1000);
      mechanism='Flexión del concreto simple (modelo nominal)';
      loadModel=flexMode==='center'?'Fórmula de módulo de rotura para carga central (C293)':'Fórmula de módulo de rotura para carga a tercios (C78)';
      steps.push(row('Módulo de rotura estimado','f_r ≈ 0,62 √f_c',`0,62 × √${fixed(fc,2)}`,`${fixed(fr,3)} MPa`,
        'Relación empírica orientativa. No es un módulo de rotura medido.'));
      steps.push(row('Carga estimada de falla',flexMode==='center'?'P = 2 f_r b h² / (3 L)':'P = f_r b h² / L',
        `${fixed(fr,3)}, b=${b}, h=${d}, L=${L}`,`${fixed(loadKN,2)} kN`,
        'ASTM C78 y C293 no son intercambiables. La ubicación de la fractura condiciona la validez.'));
    } else {
      const As=N(s.nBottom)*Math.PI*N(s.barDiameter)**2/4;
      const deff=d-N(s.cover)-(s.stirrups?N(s.stirrupDiameter):0)-N(s.barDiameter)/2;
      const a=As*N(s.fy)/(0.85*fc*b);
      const beta1=fc<=28?0.85:Math.max(0.65,0.85-0.05*(fc-28)/7);
      const c=a/beta1;
      const epsT=c>0?0.003*(deff-c)/c:0;
      const epsY=N(s.fy)/200000;
      const phiM=epsT>=0.005?0.9:epsT<=epsY?0.65:0.65+0.25*(epsT-epsY)/(0.005-epsY);
      const Mn=As*N(s.fy)*(deff-a/2)/1e6;
      const Mdesign=phiM*Mn;
      // Fuerza total asociada al momento resistente para la configuración elegida:
      const PflexKN=Mdesign*(flexMode==='center'?4:6)/(L/1000);
      const Vc=0.17*Math.sqrt(fc)*b*deff/1000;
      const Av=s.stirrups?N(s.stirrupLegs)*Math.PI*N(s.stirrupDiameter)**2/4:0;
      const Vs=s.stirrups?Av*N(s.fy)*deff/N(s.stirrupSpacing)/1000:0;
      const Vdesign=0.75*(Vc+Vs), Pshear=2*Vdesign;
      momentKNm=Mdesign; shearKN=Vdesign;
      loadKN=Math.min(PflexKN,Pshear);
      mechanism=PflexKN<=Pshear?'Predominio flexional probable (simplificado)':'Predominio de cortante posible (simplificado)';
      loadModel='Modelo académico de secciones: flexión unidireccional y cortante nominal, sin longitud de desarrollo ni análisis no lineal';
      modulus=fr;
      capacity={As,deff,a,beta1,c,epsT,phiM,Mn,Mdesign,Vc,Av,Vs,Vdesign,PflexKN,Pshear};
      steps.push(row('Área de acero inferior','A_s = n · π d_b²/4',`${s.nBottom} × π × ${s.barDiameter}²/4`,`${fixed(As,2)} mm²`,
        'Se evalúa acero inferior a tracción para carga gravitacional positiva. El acero superior se visualiza, pero el aporte a compresión no se incluye.'));
      steps.push(row('Peralte efectivo','d = h − recubrimiento − Ø estribo − Ø barra / 2',
        `${d} − ${s.cover} − ${s.stirrups?s.stirrupDiameter:0} − ${s.barDiameter}/2`,`${fixed(deff,2)} mm`));
      steps.push(row('Bloque equivalente de compresión','a = A_s f_y / (0,85 f_c b)',
        `${fixed(As,1)} × ${s.fy} / (0,85 × ${fixed(fc,2)} × ${b})`,`${fixed(a,2)} mm`));
      steps.push(row('Momento nominal','M_n = A_s f_y (d − a/2)',
        `${fixed(As,1)} × ${s.fy} × (${fixed(deff,2)} − ${fixed(a,2)}/2)`,`${fixed(Mn,3)} kN·m`));
      steps.push(row('Resistencia de diseño a flexión','φM_n = φ × M_n',`${fixed(phiM,3)} × ${fixed(Mn,3)}`,`${fixed(Mdesign,3)} kN·m`,
        `ε_t≈${fixed(epsT,5)}; modelo seccional simplificado, no análisis de ductilidad de la vigueta.`));
      steps.push(row('Resistencia nominal a cortante','V_c ≈ 0,17 √f_c b d; V_s = A_v f_y d/s',
        `V_c=${fixed(Vc,3)}; V_s=${fixed(Vs,3)}`,`φV_n=${fixed(Vdesign,3)} kN`,
        'Fórmulas simplificadas de enseñanza para secciones de concreto convencional; el comportamiento de viguetas cortas puede diferir.'));
      steps.push(row('Carga que controla (estimación)','P_est = mín(P_flex, 2 φV_n)',
        `mín(${fixed(PflexKN,2)}, ${fixed(Pshear,2)})`,`${fixed(loadKN,2)} kN`,
        'NO reproduce fisuración, deslizamiento del acero, fallas de anclaje, barras dobladas o efectos del estribado real.'));
    }
    steps.push(row('Ritmo de aplicación de carga','dP/dt = S b h² / (L k 60 ·1000), k=1 en tercios o 1,5 en centro',
      `S=${fixed(s.rateFlex,2)} MPa/min; k=${flexCoefficient}`,`${fixed(rateKNs,4)} kN/s`,
      'Convertido desde tasa de aumento de esfuerzo a tasa de fuerza; validar rangos con norma y máquina.'));
  }
  const duration=loadKN/rateKNs;
  let measured=null;
  if(validPositive(s.loadMeasured)){
    const p=N(s.loadMeasured),A=specimenArea;
    const fm=s.test==='cylinder'? p*1000/A : p*1000*N(s.span)*(flexMode==='center'?1.5:1)/(N(s.width)*N(s.depth)**2);
    measured={loadKN:p,strength:fm,unit:'MPa',label:s.test==='cylinder'?'Resistencia a compresión calculada':'Módulo nominal de rotura / esfuerzo equivalente'};
    steps.push(row('Resultado calculado con lectura del equipo',s.test==='cylinder'?'f_c = P_real × 1000 / A':flexMode==='center'?'R = 3P_real L/(2bh²)':'R = P_real L/(bh²)',
      `P_real=${p} kN; dimensiones introducidas`,`${fixed(fm,3)} MPa`,
      reinforced?'Para concreto reforzado el valor es un esfuerzo nominal equivalente, NO un módulo de rotura ASTM de concreto simple.':'Confirmar configuración y posición de la fractura antes de reportar aceptación normativa.'));
  }
  let Emeasured=null;
  if(validPositive(s.epsilonAt40) && s.test==='cylinder'){
    const eps=N(s.epsilonAt40),S1=N(s.sigmaAt50)||0;
    if(eps>0.00005){Emeasured=(0.4*fc-S1)/(eps-0.00005);
      steps.push(row('Módulo de cuerda con deformación ingresada','E = (σ_40% − σ_50µε) / (ε_40% − 0,000050)',
        `(${fixed(fc*0.4,3)} − ${fixed(S1,3)}) / (${eps} − 0,000050)`,`${fixed(Emeasured,0)} MPa`,
        'Aplicación didáctica de expresión asociada a ASTM C469; requiere mediciones experimentales y procedimiento completo.'));
    }else notes.push('Para E_c por cuerda, ε al 40% debe superar 0,000050.');
  }
  if(s.test==='reinforced') notes.push('La geometría armada se estudia como elemento reforzado; NO se debe declarar el resultado un ensayo ASTM C78/C293 de concreto simple.');
  if(s.test!=='cylinder' && Number(s.fractureOffset)>0) notes.push('Se debe evaluar la ubicación de inicio de fractura antes de aplicar el cálculo normativo del módulo de rotura.');
  const rawModel={fc,fc28,basis,fr,E,Emeasured,mix,ageFactor:factor,loadKN,rateKNs,duration,modulus,mechanism,loadModel,capacity,measured,s,specimenArea};
  return {ok:true,...rawModel,warnings:notes,steps,calibration:fit,unitSystem:'SI',standards:s.test==='cylinder'?['ASTM C39/C39M','ASTM C469/C469M']:s.test==='reinforced'?['Modelo didáctico ACI/NSR (no ensayo ASTM de concreto simple)']:[flexMode==='center'?'ASTM C293/C293M':'ASTM C78/C78M']};
}

export function simulatedSeries(r, count=44) {
  if(!r.ok) return [];
  return Array.from({length:count+1},(_,i)=>{
    const t=i/count, load=t<=0.92?r.loadKN*(t/0.92):r.loadKN*(1-0.78*(t-0.92)/0.08);
    const deflection=(t<=0.92?Math.pow(t/0.92,1.3):1+(t-0.92)*2)* (r.s.test==='cylinder'?0.22:3.2);
    return {t,load,deflection,stress:load*1000/r.specimenArea||load*1000/(r.s.test==='cylinder'?Math.PI*r.s.diameter**2/4:r.s.width*r.s.depth)};
  });
}

export function measuredRecord(s, calculated, label=''){
  if(!calculated?.measured || !calculated.ok) throw Error('Primero ingresa una lectura experimental mayor que cero.');
  return {id:`HL-${Date.now()}-${Math.floor(Math.random()*999)}`,date:new Date().toISOString(),label:label||`Ensayo ${s.test}`,
    test:s.test, age:N(s.age),fcMeasured:calculated.measured.strength,measured:true,
    forceKN:calculated.measured.loadKN,wc:calculated.mix.waterToCement,diameter:N(s.diameter),width:N(s.width),depth:N(s.depth),span:N(s.span),
    standard:calculated.standards[0]};
}
