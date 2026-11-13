import test from 'node:test';
import assert from 'node:assert/strict';
import {FAILURE_MODES,getFailureModes,getFailureMode,resolveFailureMode,normalizedLoad,damageStage} from '../src/failureModes.js';
import {DEFAULTS,compute,simulatedSeries} from '../src/engine.js';

test('seis patrones cualitativos de cilindro C39',()=>{
 const patterns=getFailureModes('cylinder');
 assert.equal(patterns.length,6);assert.deepEqual(patterns.map(x=>x.id),['c39-1','c39-2','c39-3','c39-4','c39-5','c39-6']);
});
test('modos de falla de viga simple y reforzada tienen etiquetas únicas',()=>{
 assert.ok(getFailureModes('reinforced').length>=8);
 assert.ok(getFailureModes('beam').length>=2);
 assert.equal(new Set(FAILURE_MODES.map(x=>x.id)).size,FAILURE_MODES.length);
});
test('selección manual válida se mantiene solo dentro de su tipo de probeta',()=>{
 assert.equal(resolveFailureMode('cylinder','c39-4').id,'c39-4');
 assert.equal(resolveFailureMode('cylinder','rc-shear').id,'c39-1');
 assert.equal(resolveFailureMode('reinforced','rc-bond').manual,true);
 assert.equal(resolveFailureMode('beam','c39-1').manual,false);
});
test('sin estribos con capacidad de cortante inferior sugiere falla diagonal',()=>{
 const r=compute({...DEFAULTS,test:'reinforced',stirrups:false});
 assert.equal(r.ok,true);
 if(r.capacity.Pshear<r.capacity.PflexKN*.92)assert.equal(r.fracture.id,'rc-shear');
});
test('modo visual manual cambia el patrón, no la capacidad calculada',()=>{
 const a=compute({...DEFAULTS,test:'reinforced',fractureMode:'rc-shear'}),
 b=compute({...DEFAULTS,test:'reinforced',fractureMode:'rc-ductile'});
 assert.equal(a.ok,true);assert.equal(b.ok,true);
 assert.equal(a.loadKN,b.loadKN);assert.equal(a.fracture.id,'rc-shear');assert.equal(b.fracture.id,'rc-ductile');
 assert.ok(a.warnings.some(x=>x.includes('demostración visual')));
});
test('curvas de carga acotadas, pico común y residual por tipo de falla',()=>{
 for(const mode of FAILURE_MODES){
  for(let i=0;i<=100;i++){const v=normalizedLoad(i/100,mode);assert.ok(v>=0&&v<=1,`${mode.id}: ${i} ${v}`);}
  assert.equal(normalizedLoad(0,mode),0);
  assert.equal(normalizedLoad(.92,mode),1);
  assert.ok(Math.abs(normalizedLoad(1,mode)-mode.residual)<1e-6);
 }
 assert.ok(normalizedLoad(.98,getFailureMode('rc-ductile'))>normalizedLoad(.98,getFailureMode('rc-brittle')));
});
test('serie simulada tiene distintos descensos, sin cambiar pico modelado',()=>{
 const a=compute({...DEFAULTS,test:'reinforced',fractureMode:'rc-ductile'});
 const b=compute({...DEFAULTS,test:'reinforced',fractureMode:'rc-brittle'});
 assert.ok(simulatedSeries(a).at(-2).load>simulatedSeries(b).at(-2).load);
 assert.equal(a.loadKN,b.loadKN);
});
test('etapas de fisuración secuenciales y robustas ante datos no válidos',()=>{
 const mode=resolveFailureMode('reinforced','rc-ductile');
 assert.equal(damageStage(0,mode),'Carga inicial');
 assert.equal(damageStage(.8,mode),'Propagación de fisuras');
 assert.equal(damageStage(1,mode),'Daño residual progresivo');
 assert.equal(normalizedLoad(NaN,mode),0);
});
