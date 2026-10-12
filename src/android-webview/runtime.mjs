import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { run } from "../core/process.mjs";
import { inspectWebNative } from "../web-native/runtime.mjs";
import { parseProtocolLine,writeJsonl,writeJson } from "../runtime/evidence.mjs";
import { parseAndroidDeviceInfo } from "../runtime/device.mjs";

const ROOT=fileURLToPath(new URL("../../",import.meta.url));
const PACKAGE="dev.talarion.signalgarden";
const ACTIVITY=PACKAGE+"/.GameActivity";
const BUILD_DIR=path.join(ROOT,"artifacts/build/android-webview");
const APK=path.join(BUILD_DIR,"signal-garden-debug.apk");
const INPUT_MANIFEST=path.join(BUILD_DIR,"build-evidence.json");
const sha=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");
const hashFile=async file=>sha(await fs.readFile(file));
const tool=(dir,name)=>path.join(dir,name+(process.platform==="win32"?".exe":""));
const sdkRoot=()=>process.env.ANDROID_SDK_ROOT||process.env.ANDROID_HOME;
const safeRun=async (cmd,args,opts={})=>{
  const r=await run(cmd,args,opts);
  if(!r.ok)throw new Error("Android tool failed: "+path.basename(cmd)+"\n"+(r.stderr||r.stdout||r.error||"unknown error").slice(-2600));
  return r;
};
const allClassFiles=async root=>{
  const result=[];
  for(const entry of await fs.readdir(root,{withFileTypes:true})){
    if(entry.isDirectory())result.push(...await allClassFiles(path.join(root,entry.name)));
    else if(entry.isFile()&&entry.name.endsWith(".class"))result.push(path.join(root,entry.name));
  }
  return result.sort();
};
async function requireWebGame(project){
  const inspected=await inspectWebNative(project);
  if(!inspected.ok)throw new Error("Android WebView source preflight blocked: "+
    inspected.checks.filter(c=>c.status==="fail").map(c=>c.id).join(","));
  if(inspected.manifest.id!=="signal-garden"||inspected.manifest.engine!=="three")
    throw new Error("WF02 host supports only the independent signal-garden Three.js reference");
  return inspected;
}
async function sourceIdentity(inspection,threeModule,threeCore){
  const files=await Promise.all(inspection.manifest.sources.slice().sort().map(async f=>({
    path:f,sha256:await hashFile(path.join(inspection.project,f))
  })));
  return {sourceFiles:files,
    sourceSha256:sha(Buffer.from(files.map(x=>x.path+":"+x.sha256).join("\n"))),
    replaySha256:await hashFile(path.join(inspection.project,inspection.manifest.replay)),
    vendorVersion:inspection.manifest.threeVersion,
    vendorSha256:await hashFile(threeModule),vendorCoreSha256:await hashFile(threeCore)};
}
export async function planWebView(project){
  const inspection=await requireWebGame(project);
  const sdk=sdkRoot();
  const checks=[{id:"WA001",ok:!!sdk,detail:"ANDROID_SDK_ROOT or ANDROID_HOME is set"},
    {id:"WA002",ok:process.platform!=="win32",detail:"Current WF02 SDK command execution is validated on Linux/macOS; Windows requires WSL or supported shell"},
    {id:"WA003",ok:inspection.ok,detail:"Read-only original Web game inspected"}];
  return {schema:"talarion.android-webview-plan/v1",
    ok:checks.every(x=>x.ok),projectId:inspection.manifest.id,package:PACKAGE,
    portabilityClass:"same-runtime",runtime:"android-webview",
    artifact:"debug-apk",runtimeObserved:false,releaseCertified:false,checks,
    text:"TALARION ANDROID WEBVIEW PLAN "+(checks.every(x=>x.ok)?"READY":"BLOCKED")};
}
export async function buildWebView(project){
  const inspection=await requireWebGame(project);
  const plan=await planWebView(project);
  if(!plan.ok)throw new Error(plan.checks.filter(x=>!x.ok).map(x=>x.id+" "+x.detail).join("; "));
  const sdk=sdkRoot(),buildTools=path.join(sdk,"build-tools","35.0.1");
  const platform=path.join(sdk,"platforms","android-35","android.jar");
  const android=(name)=>tool(buildTools,name);
  const vendorPackage=JSON.parse(await fs.readFile(path.join(ROOT,"node_modules/three/package.json"),"utf8"));
  if(vendorPackage.version!==inspection.manifest.threeVersion)throw new Error("Installed Three.js does not match pinned source version");
  const vendorRoot=path.join(ROOT,"node_modules/three/build");
  const vendor=path.join(vendorRoot,"three.module.js"),core=path.join(vendorRoot,"three.core.js");
  const identity=await sourceIdentity(inspection,vendor,core);
  const hostDir=path.join(ROOT,"src/android-webview");
  const source=path.join(hostDir,"java/dev/talarion/signalgarden/GameActivity.java");
  const manifest=path.join(hostDir,"AndroidManifest.xml");
  const hostSha256=sha(Buffer.from([await hashFile(source),await hashFile(manifest)].join("\n")));
  const stage=await fs.mkdtemp(path.join(os.tmpdir(),"talarion-webview-build-"));
  const raw=path.join(stage,"unsigned.apk"),aligned=path.join(stage,"aligned.apk");
  try{
    const gameRoot=path.join(stage,"assets/game");
    await fs.mkdir(path.join(gameRoot,"__talarion"),{recursive:true});
    for(const rel of inspection.manifest.sources){
      const dst=path.join(gameRoot,rel);
      await fs.mkdir(path.dirname(dst),{recursive:true});
      await fs.copyFile(path.join(inspection.project,rel),dst);
    }
    await Promise.all([
      fs.copyFile(vendor,path.join(gameRoot,"__talarion/three.module.js")),
      fs.copyFile(core,path.join(gameRoot,"__talarion/three.core.js"))
    ]);
    const classes=path.join(stage,"classes"),dex=path.join(stage,"dex");
    await fs.mkdir(classes,{recursive:true});await fs.mkdir(dex,{recursive:true});
    await safeRun("javac",["-source","8","-target","8","-classpath",platform,"-d",classes,source]);
    const sources=await allClassFiles(classes);
    if(sources.length===0)throw new Error("No compiled Android Activity classes");
    await safeRun(android("d8"),["--min-api","26","--lib",platform,"--output",dex,...sources]);
    const dx=path.join(dex,"classes.dex");
    if((await fs.stat(dx).catch(()=>null))?.size<1000)throw new Error("Missing compiled classes.dex");
    await safeRun(android("aapt2"),["link","-o",raw,"--manifest",manifest,
      "-I",platform,"--min-sdk-version","26","--target-sdk-version","35",
      "--version-code","1","--version-name","0.1.0"]);
    await safeRun("jar",["uf",raw,"-C",dex,"classes.dex","-C",stage,"assets"]);
    await safeRun(android("zipalign"),["-f","4",raw,aligned]);
    const debugKey=path.join(os.homedir(),".android","debug.keystore");
    if(!(await fs.stat(debugKey).catch(()=>null))){
      await fs.mkdir(path.dirname(debugKey),{recursive:true});
      await safeRun("keytool",["-genkeypair","-noprompt","-keystore",debugKey,
        "-storepass","android","-alias","androiddebugkey","-keypass","android",
        "-dname","CN=Android Debug,O=Android,C=US","-keyalg","RSA","-keysize","2048","-validity","10000"]);
    }
    await fs.mkdir(BUILD_DIR,{recursive:true});
    await safeRun(android("apksigner"),["sign","--ks",debugKey,"--ks-key-alias","androiddebugkey",
      "--ks-pass","pass:android","--key-pass","pass:android",
      "--out",APK,aligned]);
    await safeRun(android("apksigner"),["verify","--verbose",APK]);
    await safeRun(android("zipalign"),["-c","4",APK]);
    const size=(await fs.stat(APK)).size;
    if(size<100000)throw new Error("Unexpectedly small Android debug APK");
    const result={schema:"talarion.android-webview-build/v1",ok:true,
      projectId:inspection.manifest.id,package:PACKAGE,source:"three",
      host:"android",runtime:"android-webview",portabilityClass:"same-runtime",
      targetSdk:35,minSdk:26,artifactKind:"debug-apk",artifact:APK,
      artifactBytes:size,artifactSha256:await hashFile(APK),identity,
      hostSha256,buildTools:"35.0.1",releaseCertified:false,
      runtimeObserved:false,
      text:"TALARION WEBVIEW APK BUILD PASS\n"+APK+"\nGame source is unchanged. Release AAB/Play: NOT TESTED"};
    await writeJson(INPUT_MANIFEST,result);
    return result;
  }finally{await fs.rm(stage,{recursive:true,force:true})}
}

async function screenshot(adb,file){
  const foreground=await safeRun(adb,["shell","dumpsys","window"]);
  const focus=foreground.stdout.split(/\r?\n/).find(s=>s.includes("mCurrentFocus"));
  if(!focus?.includes(PACKAGE))throw new Error("Expected WebView app foreground; observed "+(focus??"unknown").slice(0,180));
  const child=spawn(adb,["exec-out","screencap","-p"],{stdio:["ignore","pipe","pipe"]});
  const output=[],errors=[];
  const bytes=await new Promise((resolve,reject)=>{
    child.stdout.on("data",x=>output.push(Buffer.from(x)));
    child.stderr.on("data",x=>errors.push(Buffer.from(x)));
    child.on("error",reject);
    child.on("close",code=>code===0?resolve(Buffer.concat(output)):
      reject(new Error("ADB screenshot failed: "+Buffer.concat(errors).toString("utf8").slice(-180))));
  });
  if(bytes.length<15000||bytes.subarray(0,8).toString("hex")!=="89504e470d0a1a0a")
    throw new Error("Screenshot is absent, too small or invalid PNG");
  await fs.writeFile(file,bytes);
  return {bytes:bytes.length,sha256:sha(bytes)};
}
export async function testWebView(project,{timeoutMs=90000}={}){
  const inspected=await requireWebGame(project);
  // Build and run the exact same source in one command to prevent stale artifact reuse.
  const build=await buildWebView(project);
  const adb=process.env.ADB||"adb";
  await safeRun(adb,["version"]);
  const devices=await safeRun(adb,["devices"]);
  const found=devices.stdout.split(/\r?\n/).slice(1).map(x=>x.trim()).filter(x=>/\sdevice$/.test(x));
  if(found.length!==1&&!process.env.ANDROID_SERIAL)throw new Error("Exactly one authorized emulator/device required, or select ANDROID_SERIAL");
  const [props,surface]=await Promise.all([safeRun(adb,["shell","getprop"]),safeRun(adb,["shell","dumpsys","SurfaceFlinger"])]);
  const device=parseAndroidDeviceInfo(props.stdout,surface.stdout);
  // No physical Android hardware certification; CI explicitly selects an emulator.
  await safeRun(adb,["install","-r",build.artifact]);
  await safeRun(adb,["logcat","-c"]);
  await safeRun(adb,["shell","am","force-stop",PACKAGE]);
  const evidenceRoot=path.join(ROOT,"artifacts/run/android-webview");
  await fs.mkdir(evidenceRoot,{recursive:true});
  const runDir=await fs.mkdtemp(path.join(evidenceRoot,inspected.manifest.id+"-"));
  const state=[],performance=[],captures=[],issues=[],ready=[];
  const tasks=[];let complete=null;let rejectComplete;
  const done=new Promise((resolve,reject)=>{complete=resolve;rejectComplete=reject});
  let partial="";
  const log=spawn(adb,["logcat","-v","raw","TalarionGame:I","*:S"],{stdio:["ignore","pipe","pipe"]});
  log.stdout.on("data",chunk=>{
    partial+=chunk.toString("utf8");
    const lines=partial.split(/\r?\n/);partial=lines.pop()??"";
    for(const line of lines){
      if(line.includes("JS_ERROR")||line.includes("ASSET_NOT_FOUND")){
        issues.push(line.slice(0,260));continue;
      }
      const packet=parseProtocolLine(line);
      if(!packet)continue;
      if(packet.kind==="ready")ready.push(packet.value);
      if(packet.kind==="state"&&packet.value&&typeof packet.value==="object")state.push(packet.value);
      if(packet.kind==="performance"&&packet.value&&typeof packet.value==="object")performance.push(packet.value);
      if(packet.kind==="capture"&&packet.value){
        const name=packet.value.name;
        if(!inspected.manifest.evidence.checkpoints.includes(name)||captures.some(x=>x.checkpoint===name)){
          issues.push("Invalid screenshot marker: "+String(name));continue;
        }
        const file=path.join(runDir,name+".png");
        const task=new Promise(resolve=>setTimeout(resolve,180))
          .then(()=>screenshot(adb,file))
          .then(meta=>captures.push({checkpoint:name,tick:packet.value.tick,file,...meta}))
          .catch(err=>issues.push("Screenshot "+name+": "+err.message));
        tasks.push(task);
      }
      if(packet.kind==="finished")complete(packet.value);
    }
  });
  log.stderr.on("data",chunk=>issues.push("ADB logcat stderr: "+String(chunk).slice(0,200)));
  log.on("error",rejectComplete);
  const timer=setTimeout(()=>rejectComplete(new Error("Android WebView replay timed out; ready="+ready.length+
    " states="+state.length+" captures="+captures.length+" errors="+JSON.stringify(issues.slice(0,7)))),timeoutMs);
  try{
    await safeRun(adb,["shell","am","start","-n",ACTIVITY,"--ez","talarion_replay","true"]);
    const finished=await done;
    await Promise.all(tasks);
    const expected=inspected.manifest.evidence;
    const valid=ready.length===1&&ready[0]?.gameId===inspected.manifest.id&&
      finished?.tick===expected.finishedTick&&finished?.gameId===inspected.manifest.id&&
      finished?.errorCount===0&&finished?.finalState?.state==="VICTORY"&&
      state.length>=expected.minSnapshots&&
      state.every((s,i)=>Number.isInteger(s.tick)&&(i===0||s.tick>state[i-1].tick))&&
      state.at(-1)?.collected===3&&state.at(-1)?.state==="VICTORY"&&
      captures.length===expected.checkpoints.length&&
      expected.checkpoints.every(n=>captures.some(c=>c.checkpoint===n))&&
      performance.length>=3&&issues.length===0;
    const stateFile=path.join(runDir,"state.jsonl"),performanceFile=path.join(runDir,"performance.jsonl");
    await Promise.all([writeJsonl(stateFile,state),writeJsonl(performanceFile,performance)]);
    const report={schema:"talarion.android-webview-run/v1",ok:valid,projectId:inspected.manifest.id,
      runtime:"android-webview",host:"android",portabilityClass:"same-runtime",artifact:build.artifact,
      artifactSha256:build.artifactSha256,identity:build.identity,device,
      evidence:{stateFile,performanceFile,screenshots:captures,finished},
      observed:{runtimeObserved:true,stateCount:state.length,captureCount:captures.length,performanceSamples:performance.length},
      releaseCertified:false,physicalDeviceCertified:false,issues,
      text:"TALARION ANDROID WEBVIEW "+(valid?"RUNTIME PASS":"RUNTIME FAIL")+
        "\nSnapshots: "+state.length+" / Captures: "+captures.length+
        "\nEvidence: "+runDir+"\nNative engine conversion: NO; Google Play ready: NO"};
    await writeJson(path.join(runDir,"runner-result.json"),report);
    if(!valid)throw new Error("Android WebView evidence gate FAIL; report: "+path.join(runDir,"runner-result.json"));
    return report;
  }finally{clearTimeout(timer);log.kill("SIGTERM")}
}
