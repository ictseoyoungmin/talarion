import * as THREE from "/__talarion/three.module.js";
import { createGame,move,snapshot,BEACONS } from "./simulation.mjs";

const canvas=document.getElementById("stage");
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.18;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color("#152732");scene.fog=new THREE.FogExp2("#203d48",0.018);
const camera=new THREE.PerspectiveCamera(43,window.innerWidth/window.innerHeight,.1,180);
const ambient=new THREE.HemisphereLight(0xb9dff6,0x182e29,2.2);scene.add(ambient);
const sun=new THREE.DirectionalLight(0xffc28c,3.4);sun.position.set(-9,19,-8);sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-22;sun.shadow.camera.right=22;sun.shadow.camera.top=22;sun.shadow.camera.bottom=-22;sun.shadow.bias=-0.0005;scene.add(sun);
const world=new THREE.Group();scene.add(world);
function mesh(geometry,color,roughness=1,metalness=0){
  const m=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness,metalness}));
  m.castShadow=true;m.receiveShadow=true;return m;
}
function cylinder(radiusTop,radiusBottom,height,color,x,y,z,sides=7){
  const o=mesh(new THREE.CylinderGeometry(radiusTop,radiusBottom,height,sides),color);
  o.position.set(x,y,z);world.add(o);return o;
}
cylinder(15,13,1.1,0x162a30,0,-2.25,0,12);
cylinder(13.5,14.2,.95,0x466458,0,-1.65,0,12);
cylinder(11.9,12.1,.35,0x6a8373,0,-1.03,0,12);
const tileMaterial=new THREE.MeshStandardMaterial({color:0x789184,roughness:.96});
for(let x=-4;x<=4;x++)for(let z=-4;z<=4;z++){
 const tile=new THREE.Mesh(new THREE.BoxGeometry(.93,.12,.93),tileMaterial);
 tile.position.set(x*1.8,-.7,z*1.8);tile.receiveShadow=true;world.add(tile);
}
const ornaments=new THREE.Group();world.add(ornaments);
for(let i=0;i<17;i++){
  const a=i*2.3999,r=9.4+(i%3)*.65,x=Math.cos(a)*r,z=Math.sin(a)*r;
  cylinder(.14,.28,1.6,0x43584e,x,-.14,z,5);
  const leaves=mesh(new THREE.ConeGeometry(.95,2.1,6),i%2?0x47786d:0x5b8a74);
  leaves.position.set(x,1.3,z);ornaments.add(leaves);
}
for(let i=0;i<32;i++){
  const a=i*7.27,rad=8.5+((i*17)%21)/10;
  const o=mesh(new THREE.DodecahedronGeometry(.13+(i%4)*.07,0),0xd1bd91);
  o.position.set(Math.cos(a)*rad,-.65,Math.sin(a)*rad);ornaments.add(o);
}
const pedestal=mesh(new THREE.CylinderGeometry(.58,.72,.28,6),0x344b52);
const beaconVisuals=BEACONS.map(([x,z],i)=>{
 const group=new THREE.Group();group.position.set(x*1.8,-.48,z*1.8);world.add(group);
 const base=pedestal.clone();group.add(base);
 const orb=new THREE.Mesh(new THREE.IcosahedronGeometry(.42,1),
   new THREE.MeshStandardMaterial({color:0xfcc18c,emissive:0xff984b,emissiveIntensity:1.7,metalness:.18,roughness:.24}));
 orb.position.y=.73;group.add(orb);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.55,.036,5,40),new THREE.MeshBasicMaterial({color:0xffd39d}));
 ring.rotation.x=Math.PI*.52;ring.position.y=.73;group.add(ring);
 const light=new THREE.PointLight(0xffaa6c,5,6,2);light.position.y=.9;group.add(light);
 return {group,orb,ring,light,index:i};
});
const player=new THREE.Group();world.add(player);
const body=mesh(new THREE.CapsuleGeometry(.32,.65,6,12),0xf6e9d2,.58);
body.position.y=.63;player.add(body);
const visor=mesh(new THREE.BoxGeometry(.44,.23,.12),0x234654,.2);
visor.position.set(0,.94,-.3);player.add(visor);
const pack=mesh(new THREE.BoxGeometry(.46,.52,.24),0x627d78);
pack.position.set(0,.7,.35);player.add(pack);
const feet=mesh(new THREE.CylinderGeometry(.41,.41,.08,12),0x233b43);
feet.position.y=.07;player.add(feet);
const state=createGame();player.position.set(state.x*1.8,-.6,state.z*1.8);
const progress=document.querySelectorAll("#progress span"),mission=document.getElementById("mission");
const replayMode=new URLSearchParams(location.search).get("talarionReplay")==="1";
document.getElementById("mode").textContent=replayMode?"AUTOMATED REPLAY":"FREE PLAY";
const performanceNow=()=>performance.now();
let lastFrame=performanceNow(),frames=0,sampledFrames=0;
const runtimeErrors=[];
window.addEventListener("error",e=>runtimeErrors.push(String(e.message)));
function updateHud(){
 progress.forEach((p,i)=>p.classList.toggle("on",state.collected.includes(i)));
 mission.textContent=state.mode==="VICTORY"?"ALL SIGNALS RESTORED":String(state.collected.length)+" / 3 SIGNALS RECOVERED";
}
function applyMovement(dx,dz){
 if(move(state,dx,dz)) {updateHud();return true}return false;
}
if(!replayMode){
 // Observational only: a trusted tap on the non-interactive WebGL canvas
 // proves that Android input reached this live page after HOME/resume.
 // It never invokes movement, focuses gameplay controls or mutates state.
 canvas.addEventListener("pointerdown",event=>{
  protocol("INPUT_PROBE",{trusted:event.isTrusted,stage:event.target===canvas,
    hidden:document.hidden,viewport:[window.innerWidth,window.innerHeight],
    state:snapshot(state)});
 });
 const keys={KeyW:[0,-1],ArrowUp:[0,-1],KeyS:[0,1],ArrowDown:[0,1],KeyA:[-1,0],ArrowLeft:[-1,0],KeyD:[1,0],ArrowRight:[1,0]};
 window.addEventListener("keydown",event=>{const d=keys[event.code];if(d&&!event.repeat){event.preventDefault();applyMovement(...d)}});
 document.querySelectorAll("[data-dir]").forEach(el=>el.addEventListener("click",event=>{
  const d=el.dataset.dir.split(",").map(Number);
  const accepted=applyMovement(...d);
  // Observational protocol only: never let the QA runner move the game directly.
  protocol("TOUCH",{direction:d,accepted,trusted:event.isTrusted,state:snapshot(state)});
 }));
 document.addEventListener("visibilitychange",()=>protocol("VISIBILITY",{
  hidden:document.hidden,state:snapshot(state)
 }));
 // This packet is emitted by the original game after two compositor frames.
 requestAnimationFrame(()=>requestAnimationFrame(()=>protocol("INTERACTIVE_READY",{
  gameId:"signal-garden",state:snapshot(state),replay:false
 })));
}
function frame(t){
 const seconds=t*.001;
 const destination=new THREE.Vector3(state.x*1.8,-.6,state.z*1.8);
 player.position.lerp(destination,.09);
 player.position.y=-.6+Math.sin(seconds*2)*.035;
 for(const b of beaconVisuals){
  const taken=state.collected.includes(b.index);
  b.orb.visible=!taken;b.ring.visible=!taken;b.light.intensity=taken?.15:5;
  b.orb.position.y=.73+Math.sin(seconds*2+b.index)*.15;
  b.ring.rotation.z=seconds*.55+b.index;
 }
 const desired=player.position.clone().add(new THREE.Vector3(14,20,25));
 camera.position.lerp(desired,.028);camera.lookAt(player.position.x*.33,-.5,player.position.z*.33);
 renderer.render(scene,camera);
 frames++;sampledFrames++;
 lastFrame=t;
 requestAnimationFrame(frame);
}
camera.position.set(18,24,30);requestAnimationFrame(frame);
window.addEventListener("resize",()=>{
 camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
 renderer.setSize(innerWidth,innerHeight);
});
function protocol(kind,payload){console.log("TALARION_"+kind+" "+JSON.stringify(payload))}
async function startReplay(){
 const response=await fetch("./replay.json",{cache:"no-store"});
 if(!response.ok)throw new Error("Replay HTTP failure "+response.status);
 const replay=await response.json();
 if(replay.schema!=="talarion.replay/v1"||replay.gameId!=="signal-garden"||
   replay.tickRate!==60||!Array.isArray(replay.events)||replay.events.some(e=>!Number.isInteger(e.tick))||
   replay.events.some((e,i)=>i>0&&e.tick<replay.events[i-1].tick))
   throw new Error("Invalid game replay");
 protocol("REPLAY_READY",{gameId:replay.gameId,tickRate:replay.tickRate,seed:replay.seed,events:replay.events.length});
 let currentIndex=0;
 let captureHold=false;
 const interval=setInterval(()=>{
  if(captureHold)return;
  state.tick++;
  while(currentIndex<replay.events.length&&replay.events[currentIndex].tick===state.tick){
   const e=replay.events[currentIndex++];
   if(e.type==="move")applyMovement(e.dx,e.dz);
   else if(e.type==="capture"){
    // Hold authoritative replay tick until two game draw frames have completed.
    // Capture is emitted only after presentation has had a chance to catch up.
    captureHold=true;
    const checkpoint={name:e.name,tick:state.tick};
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      protocol("CAPTURE",checkpoint);
      setTimeout(()=>{captureHold=false;},900);
    }));
   }
   else {clearInterval(interval);throw new Error("Unknown replay event "+e.type)}
  }
  if(state.tick%30===0 || state.mode==="VICTORY"&&state.tick===270)
   protocol("STATE",snapshot(state));
  if(state.tick%60===0){
   protocol("PERF",{tick:state.tick,frames:sampledFrames,elapsedSimulationSeconds:1,
     fpsObserved:sampledFrames});
   sampledFrames=0;
  }
  if(state.tick===320){
   clearInterval(interval);
   protocol("REPLAY_FINISHED",{tick:state.tick,gameId:replay.gameId,finalState:snapshot(state),errorCount:runtimeErrors.length});
  }
 },1000/replay.tickRate);
}
if(replayMode)startReplay().catch(error=>{console.error(error);protocol("REPLAY_FAILED",{error:String(error)})});
updateHud();
