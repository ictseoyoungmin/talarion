import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { run } from "../core/process.mjs";
import { inspectWebNative } from "../web-native/runtime.mjs";
import { writeJson,writeJsonl } from "../runtime/evidence.mjs";
import { decodePng } from "../visual/png.mjs";

const ROOT=fileURLToPath(new URL("../../",import.meta.url));
const PACKAGE="dev.talarion.signalgarden";
const ACTIVITY=PACKAGE+"/.GameActivity";
const sha=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");
const shaFile=async file=>sha(await fs.readFile(file));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const checks=[];
const assert=(id,condition,detail)=>{
  checks.push({id,passed:!!condition,detail});
  if(!condition)throw new Error(id+": "+detail);
};
async function adb(...args){
  const result=await run(process.env.ADB||"adb",args);
  if(!result.ok)throw new Error("ADB "+args.slice(0,3).join(" ")+": "+String(result.stderr||result.stdout||result.error).slice(-950));
  return result.stdout;
}
async function logPackets(){
  const stdout=await adb("logcat","-d","-v","raw","TalarionGame:I","*:S");
  const entries=[],errors=[];
  for(const line of stdout.split(/\r?\n/)){
    if(line.includes("JS_ERROR")||line.includes("ASSET_NOT_FOUND"))errors.push(line.slice(0,260));
    const m=/TALARION_(INTERACTIVE_READY|TOUCH|LIFECYCLE|VISIBILITY)\s+(\{[^\r\n]*\})/.exec(line);
    if(!m)continue;
    try{entries.push({kind:m[1],value:JSON.parse(m[2])});}catch{errors.push("Unparseable runtime evidence: "+m[1]);}
  }
  if(errors.length)throw new Error("Runtime errors: "+errors.join("; "));
  return entries;
}
async function until(label,predicate,{limitMs=12000}={}){
  const start=Date.now();
  while(Date.now()-start<limitMs){
    const events=await logPackets();
    const match=predicate(events);
    if(match)return {events,match};
    await pause(280);
  }
  throw new Error("Timed out observing "+label+" on the installed Android game");
}
async function focused(requireGame){
  const dump=await adb("shell","dumpsys","window");
  const line=dump.split(/\r?\n/).find(x=>x.includes("mCurrentFocus"));
  const ok=!!line&&line.includes(PACKAGE);
  assert(requireGame?"WI010":"WI011",requireGame?ok:!ok,
    "Foreground "+(requireGame?"must be game":"must not be game")+"; actual: "+(line??"missing"));
}
async function capture(file,requireGame=true){
  if(requireGame)await focused(true);
  const child=spawn(process.env.ADB||"adb",["exec-out","screencap","-p"],{stdio:["ignore","pipe","pipe"]});
  const chunks=[],stderr=[];
  const bytes=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{child.kill("SIGKILL");reject(new Error("Screenshot capture timeout"));},15000);
    child.stdout.on("data",b=>chunks.push(Buffer.from(b)));
    child.stderr.on("data",b=>stderr.push(b.toString()));
    child.on("error",e=>{clearTimeout(timer);reject(e)});
    child.on("close",code=>{
      clearTimeout(timer);
      code===0?resolve(Buffer.concat(chunks)):reject(new Error("Screenshot failed: "+stderr.join("").slice(-500)));
    });
  });
  if(bytes.length<15000||bytes.subarray(0,8).toString("hex")!=="89504e470d0a1a0a")
    throw new Error("Bad raw Android screenshot");
  const im=decodePng(bytes);
  if(im.width<320||im.height<180)throw new Error("Small actual Android screenshot");
  await fs.writeFile(file,bytes);
  return {name:path.basename(file),file,bytes:bytes.length,
    width:im.width,height:im.height,sha256:sha(bytes)};
}
async function verifyBuild(inspected){
  const dir=path.join(ROOT,"artifacts/build/android-webview");
  const build=JSON.parse(await fs.readFile(path.join(dir,"build-evidence.json"),"utf8"));
  const apk=path.join(dir,"signal-garden-debug.apk");
  assert("WI001",build.ok===true&&build.package===PACKAGE&&
    build.artifactKind==="debug-apk"&&build.runtime==="android-webview",
    "An independent, correctly classified debug WebView build is required");
  assert("WI002",build.artifactSha256===await shaFile(apk),
    "APK sha256 must exactly match the previously built APK");
  const sourceFiles=await Promise.all(inspected.manifest.sources.slice().sort().map(async f=>({
    path:f,sha256:await shaFile(path.join(inspected.project,f))
  })));
  const sourceSha256=sha(Buffer.from(sourceFiles.map(x=>x.path+":"+x.sha256).join("\n")));
  assert("WI003",build.identity?.sourceSha256===sourceSha256&&
    JSON.stringify(build.identity.sourceFiles)===JSON.stringify(sourceFiles),
    "Original game source file roster and hash must match the packaged build");
  const vendorRoot=path.join(ROOT,"node_modules/three/build");
  assert("WI004",build.identity.vendorSha256===await shaFile(path.join(vendorRoot,"three.module.js"))&&
    build.identity.vendorCoreSha256===await shaFile(path.join(vendorRoot,"three.core.js"))&&
    build.identity.replaySha256===await shaFile(path.join(inspected.project,inspected.manifest.replay)),
    "Vendor and replay inputs must be the exact packaged revision");
  const hostDir=path.join(ROOT,"src/android-webview");
  const hostSha=sha(Buffer.from([
    await shaFile(path.join(hostDir,"java/dev/talarion/signalgarden/GameActivity.java")),
    await shaFile(path.join(hostDir,"AndroidManifest.xml"))
  ].join("\n")));
  assert("WI005",build.hostSha256===hostSha,
    "Installed host activity/source revision must match the emitted build manifest");
  return {build,apk};
}
export async function smokeInteractiveWebView(project){
  checks.length=0;
  const inspection=await inspectWebNative(project);
  assert("WI000",inspection.ok&&inspection.manifest?.id==="signal-garden",
    "Constrained original Signal Garden Web-native source must pass preflight");
  const {build,apk}=await verifyBuild(inspection);
  const devices=await adb("devices");
  assert("WI006",devices.split(/\r?\n/).filter(x=>/\sdevice$/.test(x)).length===1,
    "Exactly one authorized Android emulator/device is required for real input");
  const outRoot=path.join(ROOT,"artifacts/run/android-webview-interactive");
  await fs.mkdir(outRoot,{recursive:true});
  const dir=await fs.mkdtemp(path.join(outRoot,"signal-garden-"));
  const captures=[],actions=[];
  let error=null;
  try{
    await adb("install","-r",apk);
    await adb("shell","am","force-stop",PACKAGE);
    await adb("logcat","-c");
    await adb("shell","am","start","-n",ACTIVITY);
    const start=await until("interactive ready",p=>p.find(e=>e.kind==="INTERACTIVE_READY"));
    assert("WI007",start.match.value.gameId==="signal-garden"&&
      start.match.value.replay===false&&start.match.value.state?.moves===0,
      "Original game must load in real interactive mode at an empty state");
    await pause(450);
    const emulator=(await adb("shell","getprop","ro.kernel.qemu")).trim()==="1";
    const first=await capture(path.join(dir,"01-start.png"));captures.push(first);
    assert("WI008",first.width>first.height,
      "Android game must be displayed in physical landscape orientation");
    // Android screencap is in physical pixels; CSS touch buttons are defined
    // in dp/CSS pixels. On Pixel 5 this ratio is 440/160 = 2.75.
    const densityOutput=await adb("shell","wm","density");
    const dpi=Number(/Override density:\s*(\d+)/.exec(densityOutput)?.[1]||
      /Physical density:\s*(\d+)/.exec(densityOutput)?.[1]);
    assert("WI016",Number.isFinite(dpi)&&dpi>=120&&dpi<=1000,
      "Actual Android display density must be observed before input coordinates");
    const ratio=dpi/160;
    const xRight=first.width-Math.round(51*ratio);
    const y=first.height-Math.round(50*ratio);
    const steps=[
      {x:xRight,y,direction:[1,0],position:[-2,0,-3],moves:1,collected:0},
      {x:xRight,y,direction:[1,0],position:[-1,0,-3],moves:2,collected:1}
    ];
    for(const expected of steps){
      await adb("shell","input","tap",String(expected.x),String(expected.y));
      const hit=await until("trusted physical tap "+expected.moves,p=>
        p.filter(e=>e.kind==="TOUCH").find(e=>e.value?.state?.moves===expected.moves));
      const v=hit.match.value;
      assert("WI009",v.trusted===true&&v.accepted===true&&
        JSON.stringify(v.direction)===JSON.stringify(expected.direction)&&
        JSON.stringify(v.state.position)===JSON.stringify(expected.position)&&
        v.state.collected===expected.collected,
        "Real Android tap must change original authoritative game state as expected");
      actions.push({step:expected.moves,input:{x:expected.x,y:expected.y},observation:v});
    }
    await pause(650);
    captures.push(await capture(path.join(dir,"02-beacon-collected.png")));
    await adb("shell","input","keyevent","3");
    await until("Android HOME/pause",p=>p.some(e=>e.kind==="LIFECYCLE"&&e.value?.phase==="pause"));
    await focused(false);
    captures.push(await capture(path.join(dir,"03-home.png"),false));
    await adb("shell","am","start","-n",ACTIVITY);
    await until("Android game resumed",p=>p.filter(e=>e.kind==="LIFECYCLE"&&e.value?.phase==="resume").length>=2);
    await pause(500);
    captures.push(await capture(path.join(dir,"04-resumed.png")));
    const xDown=first.width-Math.round(109*ratio);
    await adb("shell","input","tap",String(xDown),String(y));
    const after=await until("post-resume trusted tap",p=>
      p.filter(e=>e.kind==="TOUCH").find(e=>e.value?.state?.moves===3));
    const v=after.match.value;
    assert("WI012",v.trusted===true&&v.accepted===true&&
      JSON.stringify(v.direction)===JSON.stringify([0,1])&&
      JSON.stringify(v.state.position)===JSON.stringify([-1,0,-2])&&
      v.state.collected===1,
      "Original game must preserve authoritative gameplay across HOME/resume");
    const finalPackets=await logPackets();
    assert("WI013",finalPackets.filter(e=>e.kind==="INTERACTIVE_READY").length===1,
      "No hidden page reload/state reset occurred on Android resume");
    assert("WI014",finalPackets.some(e=>e.kind==="LIFECYCLE"&&e.value?.phase==="pause")&&
      finalPackets.filter(e=>e.kind==="LIFECYCLE"&&e.value?.phase==="resume").length>=2,
      "Actual Activity.pause and resume must be observed independently");
    actions.push({step:3,input:{x:xDown,y},observation:v});
    await pause(600);
    captures.push(await capture(path.join(dir,"05-after-resume-tap.png")));
    assert("WI015",new Set(captures.map(x=>x.sha256)).size>=4,
      "Real Android screenshots must reflect distinct observed view states");
    const report={schema:"talarion.android-webview-interactive/v1",ok:true,
      gameId:"signal-garden",runtime:"android-webview",package:PACKAGE,
      provenance:{apkSha256:build.artifactSha256,sourceSha256:build.identity.sourceSha256,
        hostSha256:build.hostSha256,replaySha256:build.identity.replaySha256},
      environment:{observedInAndroidEmulator:emulator,deviceClass:emulator?"emulator":"unverified-device",screenSize:[first.width,first.height]},
      actions,captures,checks:[...checks],lifecycle:finalPackets.filter(e=>
        e.kind==="LIFECYCLE"||e.kind==="VISIBILITY"),runtimeObserved:true,
      humanTouchEquivalentViaAdb:true,physicalDeviceCertified:false,
      releaseCertified:false,visualParityCertified:false,
      text:"TALARION WF02-P1 TOUCH + LIFECYCLE PASS\nReal Android taps: 3/3; HOME/resume state preserved; screenshots: 5\nNative rendering or Play release: NOT CERTIFIED"};
    await writeJsonl(path.join(dir,"interactive-events.jsonl"),finalPackets);
    await writeJson(path.join(dir,"runner-result.json"),report);
    return report;
  }catch(e){
    error=e;
    await writeJson(path.join(dir,"runner-result.json"),{
      schema:"talarion.android-webview-interactive/v1",ok:false,projectId:"signal-garden",
      artifactSha256:build.artifactSha256,checks:[...checks],actions,captures,
      error:String(e?.stack||e),humanTouchEquivalentViaAdb:false,
      physicalDeviceCertified:false,releaseCertified:false
    });
    throw e;
  }finally{
    if(error)await adb("shell","am","force-stop",PACKAGE).catch(()=>{});
  }
}
