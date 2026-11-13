import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS, compute, mixture, ageFactor, validate, calibrationFit, simulatedSeries, measuredRecord} from '../src/engine.js';
const near=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
test('carga cilindro = resistencia × área / 1000',()=>{
 const r=compute(DEFAULTS); assert.ok(r.ok); near(r.loadKN,28*Math.PI*150**2/4/1000,1e-5);
});
test('factor de edad 28 días = 1',()=>near(ageFactor(28),1));
test('compresión con tasa de esfuerzo convertible a fuerza',()=>{
 const r=compute({...DEFAULTS,rateCompression:0.25});near(r.rateKNs,0.25*Math.PI*150**2/4/1000);
});
test('factor edad menor de 28 no excede 1',()=>assert.ok(ageFactor(7)<1));
test('flexión a tercios = f_r b h² / L',()=>{
 const r=compute({...DEFAULTS,test:'beam',loading:'third'});
 near(r.loadKN,r.fr*150*150**2/(450*1000),1e-5);
});
test('flexión central es 2/3 de carga por tercios para igual fr',()=>{
 const a=compute({...DEFAULTS,test:'beam',loading:'third'}),b=compute({...DEFAULTS,test:'beam',loading:'center'});
 near(b.loadKN,a.loadKN*2/3);
});
test('apoyo: luz no puede superar longitud',()=>assert.ok(!compute({...DEFAULTS,test:'beam',span:800,length:600}).ok));
test('reforzada con 3 inferiores y 3 superiores = As tres barras',()=>{
 const r=compute({...DEFAULTS,test:'reinforced',stirrups:false});
 near(r.capacity.As,3*Math.PI*9.5**2/4);
});
test('estribos aportan resistencia nominal a cortante',()=>{
 const r0=compute({...DEFAULTS,test:'reinforced',stirrups:false});
 const r1=compute({...DEFAULTS,test:'reinforced',stirrups:true});
 assert.ok(r1.capacity.Vdesign>r0.capacity.Vdesign);
});
test('estribos menor espaciamiento aumentan Vs',()=>{
 const a=compute({...DEFAULTS,test:'reinforced',stirrups:true,stirrupSpacing:100});
 const b=compute({...DEFAULTS,test:'reinforced',stirrups:true,stirrupSpacing:200});
 assert.ok(a.capacity.Vs>b.capacity.Vs);
});
test('área transversal inválida dispara error',()=>assert.ok(validate({...DEFAULTS,diameter:0}).errors.length));
test('medición real se calcula independientemente de estimación',()=>{
 const a=compute({...DEFAULTS,loadMeasured:400});
 near(a.measured.strength,400*1000/(Math.PI*150**2/4));
});
test('relación agua/cemento se ajusta por humedad y absorción',()=>{
 const a=mixture(DEFAULTS);
 near(a.surfaceWater,(1.5-1)*DEFAULTS.sand/100+(0.5-0.8)*DEFAULTS.gravel/100);
});
test('tres datos reales dan calibración y no demo',()=>{
 const data=[0.4,0.5,0.6].map((wc,i)=>({test:'cylinder',measured:true,age:28,wc,fcMeasured:[40,30,20][i]}));
 const fit=calibrationFit(data);assert.ok(fit && fit.n===3);
});
test('dos registros no permiten calibración',()=>assert.equal(calibrationFit([{test:'cylinder',measured:true,age:28,wc:0.4,fcMeasured:25}]),null));
test('serie de falla muestra descarga súbita',()=>{
 const r=compute(DEFAULTS),data=simulatedSeries(r);
 assert.ok(data.at(-1).load<data[30].load);
});
test('registrar ensayo requiere lectura real',()=>{
 assert.throws(()=>measuredRecord(DEFAULTS,compute(DEFAULTS)));
 const input={...DEFAULTS,loadMeasured:400}; const record=measuredRecord(input,compute(input));
 near(record.forceKN,400); assert.ok(record.measured);
});
test('parámetros de refuerzo sin dimensiones suficientes son rechazados',()=>{
 const r=compute({...DEFAULTS,test:'reinforced',depth:70,cover:30,stirrupDiameter:10,stirrups:true});assert.ok(!r.ok);
});
test('flexión reforzada devuelve escenarios por cortante y flexión',()=>{
 const r=compute({...DEFAULTS,test:'reinforced',loading:'center',span:450});
 assert.ok(r.ok && r.capacity.PflexKN>0 && r.capacity.Pshear>0 && r.mechanism);
});
test('velocidad C78 tercios 150x150 y L=450: 7.5 kN/min',()=>{
 const r=compute({...DEFAULTS,test:'beam',loading:'third',rateFlex:1.0});
 near(r.rateKNs*60,7.5,1e-10);
});
test('alerta si ritmo de compresión queda fuera de referencia',()=>{
 const r=compute({...DEFAULTS,rateCompression:.5});
 assert.ok(r.warnings.some(x=>x.includes('0,25')));
});
test('alerta si ritmo de flexión a tercios excede referencia',()=>{
 const r=compute({...DEFAULTS,test:'beam',rateFlex:1.5,loading:'third'});
 assert.ok(r.warnings.some(x=>x.includes('0,9')));
});
test('curado ambiente no asigna resistencia ficticia',()=>{
 const a=compute({...DEFAULTS,curing:'agua'});
 const b=compute({...DEFAULTS,curing:'ambiente'});
 near(a.loadKN,b.loadKN);
 assert.ok(b.warnings.some(x=>x.includes('curado')));
});
test('módulo a cuerda solo cuando se ingresa deformación suficiente',()=>{
 const r=compute({...DEFAULTS,epsilonAt40:.00065,sigmaAt50:1});
 near(r.Emeasured,(28*.4-1)/(.00065-.00005),1e-5);
});
test('entrada sin mezcla viable retorna error',()=>{
 const r=compute({...DEFAULTS,water:.01,absSand:99,absGravel:99});assert.ok(!r.ok);
});
