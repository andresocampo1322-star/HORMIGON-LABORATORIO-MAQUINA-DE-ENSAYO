import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Modelo 3D manipulable construido geométricamente: ningún servicio externo o imagen precargada.
export class UniversalMachine3D {
  constructor(canvas){
    this.canvas=canvas;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#09111d');
    this.scene.fog=new THREE.Fog('#09111d',15,35);
    this.camera=new THREE.PerspectiveCamera(40,1,0.1,100);
    this.camera.position.set(6.8,4.5,7.8);
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.75;
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.controls=new OrbitControls(this.camera,this.canvas);
    this.controls.enableDamping=true;this.controls.enablePan=false;
    this.controls.minDistance=4.5;this.controls.maxDistance=17;
    this.controls.maxPolarAngle=1.72;this.controls.target.set(0,1.9,0);
    this.scene.add(new THREE.HemisphereLight('#cde9ff','#102231',2.1));
    const k=new THREE.DirectionalLight('#e6f6ff',3.2); k.position.set(-4,9,5);k.castShadow=true;
    k.shadow.mapSize.set(1024,1024);k.shadow.camera.left=-7;k.shadow.camera.right=7;
    k.shadow.camera.top=8;k.shadow.camera.bottom=-6; this.scene.add(k);
    const blue=new THREE.PointLight('#31c4ff',40,15);blue.position.set(4,4,-3);this.scene.add(blue);
    this.metal=new THREE.MeshStandardMaterial({color:'#8097a9',metalness:0.81,roughness:0.26});
    this.steel=new THREE.MeshStandardMaterial({color:'#c2d2dd',metalness:0.93,roughness:0.18});
    this.dark=new THREE.MeshStandardMaterial({color:'#1b2734',metalness:0.74,roughness:0.36});
    this.concrete=new THREE.MeshStandardMaterial({color:'#9ea3a3',metalness:0,roughness:0.97,flatShading:false});
    this.rebar=new THREE.MeshStandardMaterial({color:'#4a5257',metalness:0.7,roughness:0.42});
    this.warning=new THREE.MeshStandardMaterial({color:'#e55f47',emissive:'#9f2614',emissiveIntensity:0.7,roughness:0.8});
    this.floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#101b29',metalness:0.18,roughness:0.9}));
    this.floor.rotation.x=-Math.PI/2;this.floor.receiveShadow=true;this.scene.add(this.floor);
    const grid=new THREE.GridHelper(20,20,'#18364a','#162937');grid.position.y=0.008;this.scene.add(grid);
    this.machine=new THREE.Group();this.scene.add(this.machine);
    this.samples=new THREE.Group();this.scene.add(this.samples);
    this.dynamic=new THREE.Group();this.scene.add(this.dynamic);
    this.specimen=null;this.cracks=[];this.model={test:'cylinder'};
    this.createFrame();this.setConfig({test:'cylinder',width:150,depth:150,diameter:150,height:300,nTop:3,nBottom:3,stirrups:false,span:450,barDiameter:9.5,cover:30});
    this._resize=()=>this.resize();window.addEventListener('resize',this._resize);this.resize();
    this._running=true;this.render();
  }
  box(w,h,d,mat,x,y,z,parent=this.machine){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  cylinder(radius,height,mat,x,y,z,parent=this.machine,segments=32){
    const obj=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,segments),mat);
    obj.position.set(x,y,z);obj.castShadow=true;obj.receiveShadow=true;parent.add(obj);return obj;
  }
  rod(start,end,radius,mat,parent=this.samples){
    const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end),v=b.clone().sub(a);
    if(v.length()<0.001)return null;
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,v.length(),10),mat);
    mesh.position.copy(a.add(b).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());
    mesh.castShadow=true;parent.add(mesh);return mesh;
  }
  makeText(text,x,y,z,scale=.4){
    const c=document.createElement('canvas');c.width=512;c.height=128;
    const ctx=c.getContext('2d');ctx.clearRect(0,0,512,128);
    ctx.fillStyle='#e8f9ff';ctx.font='bold 62px sans-serif';ctx.textAlign='center';ctx.fillText(text,256,78);
    const texture=new THREE.CanvasTexture(c);
    const mat=new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false});
    const spr=new THREE.Sprite(mat);spr.scale.set(2.2*scale,.55*scale,1);spr.position.set(x,y,z);this.machine.add(spr);
  }
  createFrame(){
    this.box(5.4,.35,2.5,this.dark,0,.18,0);
    this.box(4.7,.14,2.2,this.metal,0,.43,0);
    this.box(5.4,.52,2.5,this.dark,0,4.47,0);
    for(const x of [-2.24,2.24])for(const z of [-.9,.9]){
      this.cylinder(.16,4.05,this.steel,x,2.4,z);
      this.cylinder(.22,.12,this.dark,x,.42,z);
      this.cylinder(.22,.15,this.metal,x,4.18,z);
    }
    this.box(1.55,.52,1.3,this.metal,0,4.1,0);
    this.cylinder(.29,.85,this.steel,0,3.6,0);
    this.cylinder(.40,.18,this.dark,0,3.08,0);
    this.piston=this.cylinder(.40,.22,this.metal,0,2.92,0,this.dynamic);
    this.box(1.48,.13,1.55,this.steel,0,.59,0);
    this.makeText('HORMIGÓN LAB',0,4.5,1.3,.9);
    // Manómetro en panel lateral
    const dial=new THREE.Mesh(new THREE.CylinderGeometry(.38,.38,.08,48),this.steel);
    dial.rotation.x=Math.PI/2;dial.position.set(1.42,3.85,1.17);this.machine.add(dial);
    const face=new THREE.Mesh(new THREE.CircleGeometry(.30,50),new THREE.MeshBasicMaterial({color:'#0a1928'}));
    face.position.set(1.42,3.85,1.22);this.machine.add(face);
    this.needle=this.rod([1.42,3.85,1.25],[1.5,4,1.25],.012,this.warning,this.machine);
  }
  clear(group){while(group.children.length){let c=group.children[0];group.remove(c);c.traverse?.(v=>{v.geometry?.dispose?.();});}}
  setConfig(cfg){
    this.model={...this.model,...cfg};this.clear(this.samples);
    this.cracks=[];this.cracksGroup=new THREE.Group();this.samples.add(this.cracksGroup);
    const beam=this.model.test!=='cylinder';
    if(!beam){
      const ratio=Math.max(.55,Math.min(1.3,Number(cfg.diameter)/150));
      const h=Math.max(.6,Math.min(2.2,Number(cfg.height)/300*1.65));
      this.specimen=this.cylinder(.47*ratio,h,this.concrete,0,.7+h/2,0,this.samples,48);
      this.sampleBaseY=.7;this.initialHeight=h;
      this.box(1.28,.09,1.28,this.steel,0,.67,0,this.samples);
      this.platenSize=1.2;
      this.topPlate=this.box(1.28,.10,1.28,this.steel,0,.7+h+.1,0,this.samples);
      const points=[[-.44,.7,.23],[-.35,1.12,.35],[-.46,1.48,.24],[-.28,1.79,.38]];
      const crack=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),
         new THREE.LineBasicMaterial({color:'#aa2b21',linewidth:2}));
      crack.visible=false;this.cracksGroup.add(crack);this.cracks.push(crack);
    }else{
      const w=Math.max(.6,Math.min(1.35,Number(cfg.depth)/150*.83));
      const b=Math.max(.6,Math.min(1.35,Number(cfg.width)/150*.8));
      const l=3.55;
      this.specimen=this.box(l,w,b,this.concrete,0,.84+w/2,0,this.samples);
      this.specimen.position.y=.85+w/2;this.sampleBaseY=.85;this.initialHeight=w;
      for (const x of [-1.47,1.47]){
        const roller=this.cylinder(.13,b*1.18,this.steel,x,.73,0,this.samples);
        roller.rotation.x=Math.PI/2;
        this.box(.38,.10,b*1.2,this.dark,x,.57,0,this.samples);
      }
      const loads=this.model.loading==='center'?[0]:[-.57,.57];
      for(const x of loads){this.box(.23,.11,b*1.05,this.steel,x,.85+w+.08,0,this.samples);}
      this.topPlate=this.box(1.70,.10,.95,this.steel,0,2.60,0,this.samples);
      this.platenSize=1.7;
      if(this.model.test==='reinforced'){
        const nTop=Math.max(1,Math.min(8,Number(cfg.nTop)||3)),nBottom=Math.max(1,Math.min(8,Number(cfg.nBottom)||3));
        const cover=Math.max(.04,Math.min(.30,Number(cfg.cover)/Number(cfg.depth)*w));
        const zmax=b/2-cover, ymax=this.sampleBaseY+w-cover;
        for(let row=0;row<2;row++){
          const count=row===0?nBottom:nTop;const y=row===0?this.sampleBaseY+cover:ymax;
          for(let j=0;j<count;j++){
            const z=count===1?0:-zmax+2*zmax*j/(count-1);
            this.rod([-l/2+.09,y,z],[l/2-.09,y,z],.025,this.rebar,this.samples);
            if(cfg.hooks && cfg.hooks!=='Rectas') {
              this.rod([-l/2+.09,y,z],[-l/2+.09,y+ (row?-.13:.13),z],.024,this.rebar,this.samples);
              this.rod([l/2-.09,y,z],[l/2-.09,y+(row?-.13:.13),z],.024,this.rebar,this.samples);
            }
          }
        }
        if(cfg.stirrups){
          const n=Math.max(2,Math.min(40,Math.floor(l/(Number(cfg.stirrupSpacing)/Number(cfg.span)*l))));
          for(let i=0;i<=n;i++){
            const x=-l/2+.12+i*(l-.24)/n;
            const yy=[this.sampleBaseY+cover*.75,this.sampleBaseY+w-cover*.75];
            const zz=[-b/2+cover*.75,b/2-cover*.75];
            const v=[[x,yy[0],zz[0]],[x,yy[0],zz[1]],[x,yy[1],zz[1]],[x,yy[1],zz[0]],[x,yy[0],zz[0]]];
            for(let k=1;k<v.length;k++)this.rod(v[k-1],v[k],.014,this.rebar,this.samples);
          }
        }
      }
      const red=new THREE.Line(new THREE.BufferGeometry().setFromPoints([
         new THREE.Vector3(.35,.84+w,-b/2-.008),new THREE.Vector3(.15,.84+w*.8,-b/2-.008),new THREE.Vector3(.40,.85+w*.43,-b/2-.008),new THREE.Vector3(.10,.85,-b/2-.008)]),
        new THREE.LineBasicMaterial({color:'#a73125',linewidth:3}));
      red.visible=false;this.cracksGroup.add(red);this.cracks.push(red);
    }
    this.setProgress(0);
  }
  setProgress(t){
    const p=Math.max(0,Math.min(1,t));
    if(this.topPlate && this.model.test==='cylinder'){
      this.topPlate.position.y=this.sampleBaseY+this.initialHeight+.10-Math.min(p,0.95)*.11;
      this.specimen.scale.y=1-Math.min(p,.95)*.045;
    }
    if(this.piston)this.piston.position.y=2.92-p*.34;
    for(const crack of this.cracks)crack.visible=p>.91;
    if(this.needle)this.needle.rotation.z=p*1.9;
  }
  resize(){const rect=this.canvas.getBoundingClientRect();const w=Math.max(rect.width,300),h=Math.max(rect.height,250);
    this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);
  }
  render(){if(!this._running)return;requestAnimationFrame(()=>this.render());this.controls.update();this.renderer.render(this.scene,this.camera);}
  resetView(){this.camera.position.set(6.8,4.5,7.8);this.controls.target.set(0,1.9,0);this.controls.update();}
  destroy(){this._running=false;window.removeEventListener('resize',this._resize);this.controls.dispose();this.renderer.dispose();}
}
