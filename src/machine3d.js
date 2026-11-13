import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {resolveFailureMode, clamp01} from './failureModes.js';

/*
 * Simulación geométrica 3D cualitativa. Materiales PBR, fisuras físicas visibles,
 * fragmentos rígidos y partículas precalculadas (no FEM / ni dinámica calibrada).
 * Mantiene un presupuesto limitado de polígonos y fragmentos para WebView Android.
 */
const lerp=(a,b,t)=>a+(b-a)*t;
const rng=(seed)=>()=>((seed=Math.imul(1664525,seed)+1013904223|0)>>>0)/4294967296;
const vec=(x,y,z)=>new THREE.Vector3(x,y,z);
const choose=(n,max=100)=>Math.max(1,Math.min(max,Math.round(Number(n)||1)));
const clamp=(n,a,b)=>Math.min(b,Math.max(a,Number(n)||a));

function concreteTexture(){
  const c=document.createElement('canvas');c.width=c.height=256;
  const cx=c.getContext('2d',{willReadFrequently:true}),random=rng(11225);
  if(!cx)return null;
  const img=cx.createImageData(256,256);
  for(let i=0;i<img.data.length;i+=4){
    const grain=(random()-.5)*40, v=153+grain;
    img.data[i]=v+2;img.data[i+1]=v+2;img.data[i+2]=v+1;img.data[i+3]=255;
  }
  cx.putImageData(img,0,0);
  for(let i=0;i<1050;i++){
    const x=random()*256,y=random()*256,r=.15+random()*1.8;
    cx.fillStyle=random()>.45?'rgba(50,56,61,.28)':'rgba(239,237,225,.33)';
    cx.beginPath();cx.arc(x,y,r,0,Math.PI*2);cx.fill();
  }
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,2);
  t.colorSpace=THREE.SRGBColorSpace;return t;
}
function material(color,metalness=0,roughness=.85,extra={}){
  return new THREE.MeshStandardMaterial({color,metalness,roughness,...extra});
}

export class UniversalMachine3D {
 constructor(canvas){
  this.canvas=canvas;this._running=true;this._visible=true;this.progress=0;
  this.model={test:'cylinder'};this.failure=null;this.quality='auto';this._rng=rng(20261113);
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#07111e');
  this.scene.fog=new THREE.FogExp2('#07111e',.035);
  this.camera=new THREE.PerspectiveCamera(39,1,.1,65);this.camera.position.set(6,4.3,7.6);
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.65;
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  this.maxDpr=Math.min(window.devicePixelRatio||1,1.65);
  this.controls=new OrbitControls(this.camera,canvas);this.controls.enableDamping=true;this.controls.enablePan=false;
  this.controls.minDistance=4;this.controls.maxDistance=15;this.controls.maxPolarAngle=1.75;
  this.controls.target.set(0,1.93,0);
  this.scene.add(new THREE.HemisphereLight(0xd2ecff,0x15202c,1.35));
  const main=new THREE.DirectionalLight(0xe4f6ff,3.1);main.position.set(-4,8,5);main.castShadow=true;
  main.shadow.mapSize.set(512,512);main.shadow.camera.left=-6;main.shadow.camera.right=6;
  main.shadow.camera.top=7;main.shadow.camera.bottom=-5;this.scene.add(main);
  this.keyLight=main;
  const cyan=new THREE.PointLight(0x38c7ff,50,16);cyan.position.set(4,4.0,-3);this.scene.add(cyan);
  const amber=new THREE.PointLight(0xffc98c,12,10);amber.position.set(-3,2,2);this.scene.add(amber);
  this.materials={
   metal:material('#809bb0',.84,.25),chrome:material('#c3d2dd',.9,.16),dark:material('#182734',.65,.39),
   concrete:material('#ffffff',0,.94),fracture:material('#9a9186',0,.98,{flatShading:true}),
   steel:material('#485664',.79,.32),steelHighlight:material('#677988',.86,.27),
   warning:material('#f47958',.16,.4,{emissive:'#aa361c',emissiveIntensity:.7}),
   core:material('#6c6965',0,.93),dust:material('#b8b6ab',0,1,{transparent:true,opacity:.4,depthWrite:false}),
  };
  this.texture=concreteTexture();if(this.texture){this.materials.concrete.map=this.texture;this.materials.concrete.bumpMap=this.texture;this.materials.concrete.bumpScale=.02;}
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),material('#122031',.22,.93));
  floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;this.scene.add(floor);
  const grid=new THREE.GridHelper(18,18,0x295365,0x193143);grid.position.y=.004;this.scene.add(grid);
  this.machine=new THREE.Group();this.specimenGroup=new THREE.Group();this.dynamic=new THREE.Group();
  this.scene.add(this.machine,this.specimenGroup,this.dynamic);
  this.buildFrame();
  this.setQuality('auto');
  this.setConfig({test:'cylinder',diameter:150,height:300,width:150,depth:150,length:600,span:450,nTop:3,nBottom:3,stirrups:false,stirrupSpacing:100,cover:30,barDiameter:9.5,stirrupDiameter:6});
  this._resize=()=>this.resize();this.resize();
  this._observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(this._resize):null;
  this._observer?.observe(this.canvas.parentElement||this.canvas);
  window.addEventListener('resize',this._resize);
  this._onVisibility=()=>{this._visible=!document.hidden;if(this._visible)this.render();};
  document.addEventListener('visibilitychange',this._onVisibility);
  this._contextLost=e=>{e.preventDefault();this._running=false;this.onContextLost?.();};
  this.canvas.addEventListener('webglcontextlost',this._contextLost,{passive:false});
  this._raf=0;this.render();
 }
 createMesh(geom,mat,parent,xyz=[0,0,0]){
  const mesh=new THREE.Mesh(geom,mat);mesh.position.set(...xyz);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
 }
 box(w,h,d,mat,x,y,z,parent=this.machine){return this.createMesh(new THREE.BoxGeometry(w,h,d),mat,parent,[x,y,z]);}
 cylinder(r,h,mat,x,y,z,parent=this.machine,segments=32){return this.createMesh(new THREE.CylinderGeometry(r,r,h,segments),mat,parent,[x,y,z]);}
 rod(a,b,r,mat,parent=this.specimenGroup){
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),axis=end.clone().sub(start);
  if(axis.length()<.0001)return null;
  const obj=this.createMesh(new THREE.CylinderGeometry(r,r,axis.length(),8),mat,parent);
  obj.position.copy(start.add(end).multiplyScalar(.5));
  obj.quaternion.setFromUnitVectors(vec(0,1,0),axis.normalize());return obj;
 }
 sign(text,x,y,z){
  const c=document.createElement('canvas');c.width=512;c.height=96;
  const ctx=c.getContext('2d');if(!ctx)return;
  ctx.clearRect(0,0,512,96);ctx.font='bold 51px system-ui';ctx.fillStyle='#eafaff';ctx.textAlign='center';ctx.fillText(text,256,64);
  const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;
  const spr=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthWrite:false}));
  spr.scale.set(2,.4,1);spr.position.set(x,y,z);this.machine.add(spr);
 }
 buildFrame(){
  const m=this.materials;
  this.box(5.35,.34,2.75,m.dark,0,.16,0);
  this.box(4.85,.12,2.40,m.metal,0,.45,0);
  this.box(5.32,.50,2.75,m.dark,0,4.45,0);
  for(const x of [-2.22,2.22])for(const z of [-.94,.94]){
   this.cylinder(.143,3.99,m.chrome,x,2.45,z);
   this.cylinder(.21,.14,m.dark,x,.44,z);
   this.cylinder(.21,.15,m.metal,x,4.28,z);
  }
  this.box(1.56,.55,1.4,m.metal,0,4.05,0);
  this.cylinder(.27,.77,m.chrome,0,3.59,0);
  this.cylinder(.40,.20,m.dark,0,3.11,0);
  this.piston=this.cylinder(.39,.17,m.metal,0,2.91,0,this.dynamic);
  this.headShaft=this.cylinder(.17,1.0,m.chrome,0,2.70,0,this.dynamic);
  this.box(1.38,.12,1.45,m.chrome,0,.60,0);
  this.sign('HORMIGÓN LAB',0,4.47,1.39);
  // Dial frontal cuya aguja responde al porcentaje de carga.
  this.cylinder(.37,.07,m.chrome,1.42,3.86,1.21);
  const face=this.createMesh(new THREE.CircleGeometry(.30,48),new THREE.MeshBasicMaterial({color:0x081926}),this.machine,[1.42,3.86,1.256]);
  this.needlePivot=new THREE.Group();this.needlePivot.position.set(1.42,3.86,1.267);this.machine.add(this.needlePivot);
  this.rod([0,0,0],[0,.245,0],.012,m.warning,this.needlePivot);
  for(let i=0;i<=12;i++){
   const a=-2.5+i/12*5;
   this.rod([1.42+Math.sin(a)*.245,3.86+Math.cos(a)*.245,1.268],
     [1.42+Math.sin(a)*.277,3.86+Math.cos(a)*.277,1.268],.006,m.chrome,this.machine);
  }
  this.pulseLight=new THREE.PointLight(0x53d9ff,0,3);this.pulseLight.position.set(0,1.9,1.1);this.machine.add(this.pulseLight);
 }
 setQuality(q){
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const quality=q==='eco'?'eco':q==='alta'?'alta':'auto';this.quality=quality;
  const dpr=quality==='eco'?1:quality==='alta'?Math.min(window.devicePixelRatio||1,1.85):Math.min(window.devicePixelRatio||1,1.5);
  this.renderer.setPixelRatio(reduced?Math.min(dpr,1):dpr);
  this.renderer.shadowMap.enabled=quality!=='eco'&&!reduced;
  this.keyLight.castShadow=this.renderer.shadowMap.enabled;
  this.maxParticles=quality==='eco'?40:quality==='alta'?100:64;
  this.resize();
 }
 clearSpecimen(){
  this.ghostMaterial?.dispose();this.ghostMaterial=null;
  this.particles=null;this.chips=[];this.mainParts=[];this.cracks=[];this.materials.dust.opacity=.40;
  this.specimenGroup.traverse(o=>{
   if(o.isMesh||o.isLine||o.isPoints)o.geometry?.dispose?.();
   if((o.isLine||o.isPoints)&&o.material)o.material.dispose?.();
   // Los materiales compartidos y sus texturas se reutilizan.
  });
  while(this.specimenGroup.children.length)this.specimenGroup.remove(this.specimenGroup.children[0]);
 }
 setConfig(cfg){
  this.model={...this.model,...cfg};
  this.failure=resolveFailureMode(this.model.test,this.model.fractureMode||'auto',this.model);
  if(cfg.visualQuality!==undefined&&cfg.visualQuality!==this.quality)this.setQuality(cfg.visualQuality);
  this.clearSpecimen();this._rng=rng(20261113+this.failure.id.length*101);
  this.isCylinder=this.model.test==='cylinder';
  if(this.isCylinder)this.buildCylinder();else this.buildBeam();
  this.buildParticles();this.setProgress(0);
 }
 makeCrack(points,parent=this.specimenGroup,color=0x2f3032){
  const arr=points.map(p=>new THREE.Vector3(...p));
  const obj=new THREE.Line(new THREE.BufferGeometry().setFromPoints(arr),new THREE.LineBasicMaterial({color,transparent:true,opacity:.92}));
  obj.visible=false;parent.add(obj);this.cracks.push(obj);return obj;
 }
 buildCylinder(){
  const m=this.materials, radius=clamp((Number(this.model.diameter)||150)/150*.47,.22,.67),h=clamp((Number(this.model.height)||300)/300*1.68,.7,2.12);
  const base=.75;this.sampleBase=base;this.sampleHeight=h;
  this.box(1.36,.09,1.36,m.chrome,0,base-.07,0,this.specimenGroup);
  this.topPlate=this.box(1.33,.10,1.33,m.chrome,0,base+h+.10,0,this.specimenGroup);
  this.solid=this.cylinder(radius,h,m.concrete,0,base+h/2,0,this.specimenGroup,48);
  this.fractured=new THREE.Group();this.specimenGroup.add(this.fractured);this.fractured.visible=false;
  const id=this.failure.id;
  if(id==='c39-3'){
   for(let i=0;i<4;i++){
    const wedge=this.createMesh(new THREE.CylinderGeometry(radius*.97,radius*.97,h,16,1,false,i*Math.PI/2+.018,Math.PI/2-.036),m.concrete,this.fractured,[0,base+h/2,0]);
    this.mainParts.push({mesh:wedge,dir:vec(Math.sin(i*Math.PI/2),.1,Math.cos(i*Math.PI/2)),twist:(i-1.5)*.10});
   }
  }else{
   const cH=h*.53,lower=this.createMesh(new THREE.CylinderGeometry(radius,radius,cH,44),m.concrete,this.fractured,[0,base+cH/2,0]);
   const upper=this.createMesh(new THREE.CylinderGeometry(radius,radius,h-cH,44),m.concrete,this.fractured,[0,base+cH+(h-cH)/2,0]);
   this.mainParts.push({mesh:lower,dir:vec(-.36,0,.2),twist:.085},{mesh:upper,dir:vec(.34,.20,-.17),twist:-.12});
   const hasCone=['c39-1','c39-2','c39-6'].includes(id);
   if(hasCone){
    const cone=this.createMesh(new THREE.ConeGeometry(radius*.82,h*.23,28),m.fracture,this.fractured,[0,base+h*.46,0]);
    this.mainParts.push({mesh:cone,dir:vec(.08,.2,.11),twist:.15});
   }
   if(id==='c39-5'||id==='c39-6'){
    const spall=this.createMesh(new THREE.IcosahedronGeometry(radius*.5,1),m.fracture,this.fractured,[radius*.87,base+h*.80,0]);
    this.mainParts.push({mesh:spall,dir:vec(.6,.30,0),twist:.38});
   }
  }
  const p=this.failure.id==='c39-4'?[[radius*.86,base+h*.95,radius*.15],[-radius*.2,base+h*.55,radius*.53],[-radius*.75,base+h*.07,radius*.20]]:
   [[radius*.86,base+h*.08,radius*.2],[radius*.62,base+h*.31,radius*.26],[radius*.91,base+h*.54,radius*.1],[radius*.5,base+h*.90,radius*.35]];
  this.makeCrack(p);this.makeCrack(p.map(v=>[-v[0],v[1],-v[2]]));
  this.fracturePoint=vec(0,base+h*.52,0);
 }
 splitProfile(pts,thickness,px,base,mat){
  const shape=new THREE.Shape();shape.moveTo(pts[0][0]-px,pts[0][1]);
  for(let i=1;i<pts.length;i++)shape.lineTo(pts[i][0]-px,pts[i][1]);shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,steps:1,curveSegments:1});
  const obj=this.createMesh(g,mat,this.fractured,[px,base,-thickness/2]);return obj;
 }
 buildBeam(){
  const m=this.materials,L=3.6,h=clamp((Number(this.model.depth)||150)/150*.78,.51,1.40);
  const b=clamp((Number(this.model.width)||150)/150*.85,.51,1.30),base=.88;
  this.sampleBase=base;this.sampleHeight=h;this.sampleLength=L;this.sampleWidth=b;
  this._beamDims={L,h,b,base};
  for(const x of [-1.56,1.56]){
   const roller=this.cylinder(.135,b*1.12,m.chrome,x,.76,0,this.specimenGroup,20);roller.rotation.x=Math.PI/2;
   this.box(.38,.11,b*1.2,m.dark,x,.61,0,this.specimenGroup);
  }
  for(const x of this.model.loading==='center'?[0]:[-.55,.55])this.box(.25,.10,b*1.12,m.chrome,x,base+h+.07,0,this.specimenGroup);
  this.topPlate=this.box(1.55,.09,b*1.15,m.chrome,0,2.7,0,this.specimenGroup);
  this.solid=this.box(L,h,b,m.concrete,0,base+h/2,0,this.specimenGroup);
  this.fractured=new THREE.Group();this.specimenGroup.add(this.fractured);this.fractured.visible=false;
  // Plano de fractura irregular a lo largo de y, extruido en z.
  const id=this.failure.id;
  const shear=['rc-shear','rc-shearcomp','rc-flexshear'].includes(id);
  const off=id==='plain-offcenter'?.57:0;
  const anchor=id==='rc-bearing'?1.21:id==='rc-bond'?.78:off;
  const seam=[];for(let i=0;i<=8;i++){
   const yy=h*i/8;let x=anchor+(shear?lerp(-.48,.57,i/8):0);
   if(id==='rc-flexshear')x=anchor+lerp(-.24,.43,i/8);
   x+=Math.sin(i*2.7)*.028+((i%2)?-.015:.014);
   seam.push([x,yy]);
  }
  const left=[[-L/2,0],[seam[0][0],0],...seam.slice(1),[-L/2,h]];
  const right=[[seam[0][0],0],[L/2,0],[L/2,h],...seam.slice().reverse()];
  const lp=(-L/2+anchor)/2,rp=(anchor+L/2)/2;
  const lmesh=this.splitProfile(left,b,lp,base,m.concrete);
  const rmesh=this.splitProfile(right,b,rp,base,m.concrete);
  this.mainParts=[{mesh:lmesh,dir:vec(-.35,-.05,0),twist:-.09},{mesh:rmesh,dir:vec(.35,-.1,0),twist:.085}];
  // Áridos visibles en el borde de rotura; textura de fractura sin barras pintadas.
  for(let i=0;i<75;i++){
   const rand=this._rng;const y=rand()*h,z=(rand()-.5)*b,x=seam[Math.min(8,Math.floor(y/h*8))][0]+.004;
   const rad=.008+rand()*.023;
   const rock=this.createMesh(new THREE.IcosahedronGeometry(rad,0),i%4?m.fracture:m.core,this.fractured,[x,base+y,z]);
   rock.visible=true;
  }
  this.makeCrack(seam.map(v=>[v[0],base+v[1],b/2+.008]));
  const side=seam.map(v=>[v[0],base+v[1],-b/2-.008]);this.makeCrack(side);
  this.fracturePoint=vec(anchor,base+h*.53,0);
  if(this.model.test==='reinforced')this.buildSteel();
 }
 buildSteel(){
  const {L,h,b,base}=this._beamDims,m=this.materials;
  const cover=clamp(Number(this.model.cover)/Number(this.model.depth)*h,.055,h*.27);
  const nTop=choose(this.model.nTop,10),nBottom=choose(this.model.nBottom,10);
  const barR=clamp(Number(this.model.barDiameter)/Number(this.model.depth)*h*.5,.014,.056);
  const zRadius=b/2-cover-barR;
  this.steelGroup=new THREE.Group();this.specimenGroup.add(this.steelGroup);
  const ghost=Boolean(this.model.revealSteel);
  if(ghost){this.ghostMaterial=this.materials.concrete.clone();this.ghostMaterial.transparent=true;this.ghostMaterial.opacity=.22;this.ghostMaterial.depthWrite=false;this.solid.material=this.ghostMaterial;}
  const rows=[{n:nBottom,y:base+cover+barR},{n:nTop,y:base+h-cover-barR}];
  for(const {n,y} of rows)for(let i=0;i<n;i++){
   const z=n===1?0:lerp(-zRadius,zRadius,i/(n-1));
   this.rod([-L/2+.15,y,z],[L/2-.15,y,z],barR,m.steel,this.steelGroup);
   if(this.model.hooks && this.model.hooks!=='Rectas'){
    const d=y<base+h/2?.11:-.11;
    this.rod([-L/2+.15,y,z],[-L/2+.15,y+d,z],barR,m.steel,this.steelGroup);
    this.rod([L/2-.15,y,z],[L/2-.15,y+d,z],barR,m.steel,this.steelGroup);
   }
  }
  if(this.model.stirrups){
   const s=Math.max(20,Number(this.model.stirrupSpacing)||100),span=Math.max(100,Number(this.model.length)||600);
   const count=choose(span/s,48),yr=[base+cover*.78,base+h-cover*.78];
   const zr=[-b/2+cover*.77,b/2-cover*.77];
   const stirR=clamp(Number(this.model.stirrupDiameter)/Number(this.model.width)*b/2,.010,.034);
   for(let i=0;i<=count;i++){
    const x=lerp(-L/2+.20,L/2-.20,i/count),v=[[x,yr[0],zr[0]],[x,yr[0],zr[1]],[x,yr[1],zr[1]],[x,yr[1],zr[0]],[x,yr[0],zr[0]]];
    for(let k=1;k<v.length;k++)this.rod(v[k-1],v[k],stirR,m.steelHighlight,this.steelGroup);
   }
  }
  // Marcas de corrugado a lo largo de la barra expuesta: discretas, sin duplicar miles de mallas.
  if(this.model.revealSteel)this.steelGroup.renderOrder=5;
 }
 buildParticles(){
  const max=this.maxParticles||64, count=this.isCylinder?Math.round(max*.7):max;
  this.fragments=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),this.materials.fracture,count);
  this.fragments.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.specimenGroup.add(this.fragments);
  this.fragmentData=[];const R=this._rng,base=this.fracturePoint;
  for(let i=0;i<count;i++){
   const s=.011+R()*.037;
   this.fragmentData.push({pos:vec(base.x+(R()-.5)*.28,base.y+(R()-.5)*.30,base.z+(R()-.5)*.32),
    vel:vec((R()-.5)*2.2,(R()*.95)+.02,(R()-.5)*1.7),scale:s,rot:vec(R()*6,R()*6,R()*6)});
  }
  this._dummy=new THREE.Object3D();this.fragments.visible=false;
  for(let i=0;i<count;i++)this.applyFragment(i,0,false);
  this.fragments.instanceMatrix.needsUpdate=true;
  const dustCount=Math.min(180,count*2),pos=new Float32Array(dustCount*3),v=new Float32Array(dustCount*3);
  for(let i=0;i<dustCount;i++){
   pos[3*i]=base.x;pos[3*i+1]=base.y;pos[3*i+2]=base.z;
   v[3*i]=(R()-.5)*2.4;v[3*i+1]=.15+R()*.85;v[3*i+2]=(R()-.5)*2.1;
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  this.dustVelocity=v;this.dustOrigin=base.clone();
  this.dust=new THREE.Points(geo,new THREE.PointsMaterial({color:0xc4b7a2,size:.047,transparent:true,opacity:.32,depthWrite:false}));
  this.dust.visible=false;this.specimenGroup.add(this.dust);
 }
 applyFragment(i,t,visible){
  const d=this.fragmentData[i],severity=this.failure?.severity||.4;
  const p=d.pos,vel=d.vel;
  this._dummy.position.set(p.x+vel.x*severity*t,p.y+vel.y*t-.65*t*t,p.z+vel.z*severity*t);
  this._dummy.position.y=Math.max(this.sampleBase+.014,this._dummy.position.y);
  this._dummy.rotation.set(d.rot.x+t*2,d.rot.y+t*2.8,d.rot.z+t*1.3);
  const factor=visible?1:.001;this._dummy.scale.setScalar(d.scale*factor);
  this._dummy.updateMatrix();this.fragments.setMatrixAt(i,this._dummy.matrix);
 }
 setProgress(value,relativeLoad=null){
  const p=clamp01(value);this.progress=p;
  const f=relativeLoad===null?Math.min(1,p/.92):clamp01(relativeLoad);
  const damage=clamp01((p-.90)/.10),open=damage*damage*(3-2*damage);
  const abrupt=this.failure.behavior==='Frágil',soft=this.failure.behavior==='Progresiva';
  const spread=(abrupt?.20:soft?.085:.13)*open*(this.failure.severity+.4);
  if(this.topPlate){
   const plateY=this.isCylinder?this.sampleBase+this.sampleHeight+.11-Math.min(p,.9)*.055:
    this.sampleBase+this.sampleHeight+.16-Math.min(p,.90)*.06;
   this.topPlate.position.y=plateY;
   this.piston.position.y=plateY+.13;
   const upper=3.11,lower=plateY+.18;
   this.headShaft.scale.y=Math.max(.08,upper-lower);
   this.headShaft.position.y=(upper+lower)/2;
  }
  this.solid.visible=p<.912;
  if(this.solid.visible){this.solid.scale.y=1-.02*Math.min(p,.9);}
  this.fractured.visible=p>=.912;
  for(const crack of this.cracks)crack.visible=p>.7;
  // Fragmentos se mueven poco en flexión dúctil y más en rotura diagonal.
  for(const part of this.mainParts){
   const v=part.dir;part.mesh.position.x=(part.mesh.userData.originX??=part.mesh.position.x)+v.x*spread;
   part.mesh.position.y=(part.mesh.userData.originY??=part.mesh.position.y)+v.y*spread;
   part.mesh.position.z=(part.mesh.userData.originZ??=part.mesh.position.z)+v.z*spread;
   part.mesh.rotation.z=part.twist*open;
  }
  const t=damage*1.25;
  this.fragments.visible=damage>.025;
  if(this.fragments.visible){
   for(let i=0;i<this.fragmentData.length;i++)this.applyFragment(i,t,true);
   this.fragments.instanceMatrix.needsUpdate=true;
  }
  this.dust.visible=damage>.03;
  if(this.dust.visible){
   const attr=this.dust.geometry.getAttribute('position'),positions=attr.array;
   for(let i=0;i<positions.length/3;i++){
    positions[3*i]=this.dustOrigin.x+this.dustVelocity[3*i]*t*.6;
    positions[3*i+1]=Math.max(this.sampleBase,this.dustOrigin.y+this.dustVelocity[3*i+1]*t-.32*t*t);
    positions[3*i+2]=this.dustOrigin.z+this.dustVelocity[3*i+2]*t*.6;
   }
   attr.needsUpdate=true;this.dust.material.opacity=Math.max(0,.32*(1-damage*.7));
  }
  this.needlePivot.rotation.z=lerp(-2.1,2.1,f);
  this.pulseLight.intensity=p>.87?4+8*(1-f):0;
 }
 resize(){
  const rect=this.canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
  const w=Math.max(1,Math.round(rect.width)),h=Math.max(1,Math.round(rect.height));
  this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);
 }
 render(){
  if(!this._running||!this._visible)return;
  this._raf=requestAnimationFrame(()=>this.render());
  this.controls.update();try{this.renderer.render(this.scene,this.camera);}catch(err){
   this._running=false;cancelAnimationFrame(this._raf);this.onContextLost?.(err);
  }
 }
 resetView(){this.camera.position.set(6,4.3,7.6);this.controls.target.set(0,1.93,0);this.controls.update();}
 destroy(){
  this._running=false;cancelAnimationFrame(this._raf);this._observer?.disconnect();
  window.removeEventListener('resize',this._resize);document.removeEventListener('visibilitychange',this._onVisibility);
  this.canvas.removeEventListener('webglcontextlost',this._contextLost);
  this.controls.dispose();this.clearSpecimen();this.texture?.dispose();
  for(const m of Object.values(this.materials))m.dispose?.();this.renderer.dispose();
 }
}
