/**
 * Catálogo cualitativo de patrones para visualización didáctica.
 * ASTM C39 (tipos 1–6) describe formas OBSERVADAS, no predice un patrón por dosificación.
 * Los modos de vigas reúnen patrones descritos en literatura experimental ACI/NCHRP.
 * Ningún modo equivale a una simulación FEM, determinación de causa o certificación.
 */
const entry = (id, test, label, behavior, description, residual=0.17, severity=0.45) =>
  Object.freeze({id,test,label,behavior,description,residual,severity});

export const FAILURE_MODES = Object.freeze([
  entry('c39-1','cylinder','Tipo 1 · conos en ambos extremos','Fractura axial','Conos aproximadamente simétricos y fisuras laterales; patrón ilustrativo C39.',0.12,.55),
  entry('c39-2','cylinder','Tipo 2 · cono y fisuras verticales','Fractura axial','Cono en un extremo y grietas longitudinales en el otro.',0.1,.62),
  entry('c39-3','cylinder','Tipo 3 · falla columnar','Fractura axial','División longitudinal del cilindro en segmentos.',0.10,.60),
  entry('c39-4','cylinder','Tipo 4 · falla diagonal','Fractura axial','Plano inclinado dominante, sin conos definidos.',0.08,.70),
  entry('c39-5','cylinder','Tipo 5 · desconchado lateral','Fractura axial','Desprendimiento lateral en un extremo; revisar cabeceo y alineación reales.',0.09,.64),
  entry('c39-6','cylinder','Tipo 6 · extremo en punta','Fractura axial','Desconchado con extremo puntiagudo; patrón cualitativo C39.',0.09,.66),
  entry('plain-flexure','beam','Flexión · grieta vertical','Frágil','Fisura transversal que asciende desde la cara traccionada.',0.02,.68),
  entry('plain-offcenter','beam','Flexión · fractura desplazada','Frágil','Grieta transversal excéntrica; revisar validez de ubicación C78 en datos reales.',0.02,.67),
  entry('rc-ductile','reinforced','Flexión dúctil · acero puente','Progresiva','Grietas verticales, deformación creciente y barras que mantienen continuidad.',0.55,.28),
  entry('rc-brittle','reinforced','Flexión frágil · rotura brusca','Frágil','Apertura rápida de grietas de flexión; no demuestra rotura del acero.',0.11,.75),
  entry('rc-shear','reinforced','Cortante · tracción diagonal','Frágil','Fisura diagonal entre zona de carga y apoyo, con desprendimientos localizados.',0.05,.82),
  entry('rc-flexshear','reinforced','Flexión–cortante','Mixta','Fisura vertical que gira hacia diagonal antes de la rotura.',0.10,.65),
  entry('rc-crush','reinforced','Compresión · aplastamiento','Progresiva','Desconchado en la fibra comprimida y deformación del acero.',0.27,.52),
  entry('rc-bond','reinforced','Adherencia / deslizamiento','Frágil','Separación de recubrimiento y acero expuesto longitudinalmente; diagnóstico requiere mediciones.',0.12,.55),
  entry('rc-shearcomp','reinforced','Cortante–compresión','Frágil','Grieta diagonal con trituración localizada próxima a la zona comprimida.',0.07,.83),
  entry('rc-bearing','reinforced','Aplastamiento en apoyo','Localizada','Daño localizado por concentración de esfuerzos junto al apoyo.',0.22,.46),
]);

const byId=new Map(FAILURE_MODES.map(m=>[m.id,m]));
export const getFailureModes=test=>FAILURE_MODES.filter(m=>m.test===test);
export const getFailureMode=id=>byId.get(id)||null;

export function suggestFailureMode(test, data={}){
  if(test==='cylinder')return 'c39-1';
  if(test==='beam')return Number(data.fractureOffset)>0?'plain-offcenter':'plain-flexure';
  const cap=data.capacity;
  if(cap){
    if(cap.Pshear<cap.PflexKN*0.92)return 'rc-shear';
    if(cap.epsT<=0.0021)return 'rc-crush';
    if(cap.epsT>=0.005)return 'rc-ductile';
  }
  return 'rc-flexshear';
}

export function resolveFailureMode(test,requested='auto',data={}){
  const manual=getFailureMode(requested);
  if(manual?.test===test)return {...manual,manual:true};
  const auto=getFailureMode(suggestFailureMode(test,data));
  return {...auto,manual:false};
}

export const clamp01=x=>Math.max(0,Math.min(1,Number.isFinite(Number(x))?Number(x):0));
/** Perfil adimensional exclusivamente ILUSTRATIVO, no curva constitutiva. */
export function normalizedLoad(t,modeOrId){
  const p=clamp01(t),mode=typeof modeOrId==='string'?getFailureMode(modeOrId):modeOrId;
  const residual=mode?.residual??0.15;
  if(p<=.92){const x=p/.92;return clamp01(Math.pow(x,0.90)*(1-0.035*x+0.035*x*x));}
  const q=clamp01((p-.92)/.08);
  if(mode?.behavior==='Progresiva')return clamp01(residual+(1-residual)*Math.pow(1-q,1.6));
  return clamp01(residual+(1-residual)*Math.pow(1-q,mode?.behavior==='Localizada'?2.5:6));
}

export function damageStage(progress,mode){
  const p=clamp01(progress);
  if(p<.44)return 'Carga inicial';
  if(p<.77)return 'Microfisuración ilustrativa';
  if(p<.92)return 'Propagación de fisuras';
  if(p<.945)return mode?.behavior==='Progresiva'?'Fisuración controlada':'Inicio de fractura';
  return mode?.behavior==='Progresiva'?'Daño residual progresivo':'Desprendimiento localizado';
}
