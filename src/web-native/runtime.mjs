import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { parseProtocolLine, writeJsonl, writeJson } from "../runtime/evidence.mjs";

export const WEB_PROJECT_SCHEMA = "talarion.web-native-project/v1";
export const WEB_INSPECTION_SCHEMA = "talarion.web-native-inspection/v1";
export const WEB_EVIDENCE_SCHEMA = "talarion.web-native-evidence/v1";
const TOOL_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const DEFAULT_PROJECT = path.join(TOOL_ROOT,"examples/web-native");
const KNOWN_CAPABILITIES = new Set(["webgl2","keyboard","fixed-tick-replay"]);
const MIME = {".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".png":"image/png",".glb":"model/gltf-binary",".jpg":"image/jpeg",".webp":"image/webp"};
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const inside = (base,file) => { const r=path.relative(base,file);return r!==""&&r!==".."&&!r.startsWith(".."+path.sep)&&!path.isAbsolute(r); };
const safePath = value => typeof value==="string" && value.length>0 &&
  !path.isAbsolute(value) && !value.includes("\\") &&
  value.split("/").every(s=>s!==""&&s!=="."&&s!==".."&&!s.startsWith(".")) &&
  !value.startsWith("__talarion/") && !value.includes(":");
const isObject = x => x!==null && typeof x==="object" && !Array.isArray(x);
const sameArray = (a,b) => JSON.stringify(a)===JSON.stringify(b);
const shaFile = file=>fs.readFile(file).then(sha);
const noLink = async file => {
  const absolute=path.resolve(file),parsed=path.parse(absolute);
  let cursor=parsed.root;
  for(const part of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)){
    cursor=path.join(cursor,part);
    const info=await fs.lstat(cursor).catch(()=>null);
    if(!info||info.isSymbolicLink())return false;
  }
  return true;
};

export async function inspectWebNative(projectRef=DEFAULT_PROJECT){
  const checks=[];const add=(id,ok,detail)=>checks.push({id,status:ok?"pass":"fail",detail});
  const project=path.resolve(projectRef);
  const rootSafe=await noLink(project) && (await fs.stat(project).catch(()=>null))?.isDirectory()===true;
  add("WN001",rootSafe,"An existing non-symlink Web game directory was explicitly selected");
  let manifest=null;
  if(rootSafe&&await noLink(path.join(project,"talarion.web.json"))){
    try{manifest=JSON.parse(await fs.readFile(path.join(project,"talarion.web.json"),"utf8"))}catch{}
  }
  const shape=isObject(manifest)&&manifest.schema===WEB_PROJECT_SCHEMA&&
    /^[a-z][a-z0-9-]{1,55}$/.test(manifest.id??"")&&
    manifest.engine==="three"&&manifest.renderer==="webgl2"&&
    manifest.threeVersion==="0.180.0";
  add("WN002",shape,"Versioned project identity and supported Three.js WebGL2 provider");
  const files=Array.isArray(manifest?.sources)?manifest.sources:[];
  const requiredFiles=[manifest?.entry,manifest?.replay,"talarion.web.json"];
  const validSources=shape&&files.length>=5&&files.length<=128&&
    files.every(safePath)&&new Set(files).size===files.length&&
    requiredFiles.every(f=>safePath(f)&&files.includes(f));
  add("WN003",!!validSources,"Explicit source allowlist includes entry, replay and manifest");
  const checked=[];
  if(validSources){
    for(const rel of files){
      const full=path.resolve(project,rel);
      const exists=inside(project,full)&&await noLink(full)&&
        (await fs.stat(full).catch(()=>null))?.isFile()===true;
      checked.push({path:rel,ok:exists});
    }
  }
  add("WN004",validSources&&checked.every(f=>f.ok),"Listed sources are readable, ordinary files inside project without symlink traversal");
  const caps=manifest?.requirements;
  const validCaps=Array.isArray(caps)&&caps.length>=1&&new Set(caps).size===caps.length&&
    caps.every(c=>KNOWN_CAPABILITIES.has(c))&&
    ["webgl2","fixed-tick-replay"].every(c=>caps.includes(c));
  add("WN005",validCaps,"Every required Web-native capability is explicitly recognized");
  const proof=manifest?.evidence;
  const validProof=isObject(proof)&&Number.isSafeInteger(proof.minSnapshots)&&
    proof.minSnapshots>=3&&Array.isArray(proof.checkpoints)&&
    proof.checkpoints.length>=3&&proof.checkpoints.length<=12&&
    proof.checkpoints.every(x=>typeof x==="string"&&/^[a-z][a-z0-9-]{1,45}$/.test(x))&&
    new Set(proof.checkpoints).size===proof.checkpoints.length&&
    Number.isSafeInteger(proof.finishedTick)&&proof.finishedTick>0;
  add("WN006",validProof,"Declared bounded evidence checkpoints and terminal tick");
  let replay=null;
  if(validSources&&checked.every(f=>f.ok)){
    try{replay=JSON.parse(await fs.readFile(path.join(project,manifest.replay),"utf8"))}catch{}
  }
  const validReplay=isObject(replay)&&replay.schema==="talarion.replay/v1"&&
    replay.gameId===manifest.id&&replay.tickRate===60&&Number.isSafeInteger(replay.seed)&&
    Array.isArray(replay.events)&&replay.events.length>=1&&
    replay.events.every((e,i)=>isObject(e)&&Number.isInteger(e.tick)&&e.tick>0&&
      e.tick<=manifest.evidence?.finishedTick&&(i===0||e.tick>=replay.events[i-1].tick)&&
      (e.type==="capture"?manifest.evidence.checkpoints.includes(e.name):
        e.type==="move"&&Number.isInteger(e.dx)&&Number.isInteger(e.dz)&&Math.abs(e.dx)+Math.abs(e.dz)===1))&&
    manifest.evidence.checkpoints.every(n=>replay.events.filter(e=>e.type==="capture"&&e.name===n).length===1);
  add("WN007",!!validReplay,"Replay schema, game identity, ordered actions and exact capture names");
  const ok=checks.every(c=>c.status==="pass");
  return {schema:WEB_INSPECTION_SCHEMA,ok,
    authority:"read-only-source-inspection",project,engine:manifest?.engine??null,
    runtimeObserved:false,androidRuntimeObserved:false,releaseCertified:false,
    manifest:ok?manifest:null,replay:ok?replay:null,checks,
    text:"TALARION WEB-NATIVE INSPECT — "+(ok?"STATIC PASS":"BLOCKED")+"\n"+
      checks.filter(c=>c.status==="fail").map(c=>"FAIL "+c.id+" "+c.detail).join("\n")+
      "\nStatic source declarations do not certify browser or Android runtime."};
}

async function requireProject(projectRef){
  const report=await inspectWebNative(projectRef);
  if(!report.ok){
    throw Object.assign(new Error("Web-native project preflight blocked: "+
      report.checks.filter(c=>c.status==="fail").map(c=>c.id).join(",")),{inspection:report});
  }
  return report;
}

async function vendorFile(version){
  const packageJson=JSON.parse(await fs.readFile(path.join(TOOL_ROOT,"node_modules/three/package.json"),"utf8"));
  if(packageJson.version!==version)throw new Error("Three.js dependency version differs from project manifest");
  const full=path.join(TOOL_ROOT,"node_modules/three/build/three.module.js");
  if(!(await noLink(full)))throw new Error("Pinned Three.js vendor source missing or symlinked; run npm install");
  return full;
}

export async function createWebNativeServer(inspection,{port=0}={}){
  if(!inspection?.ok||inspection.schema!==WEB_INSPECTION_SCHEMA)
    throw new Error("Read-only web project inspection must pass before serving");
  const files=new Map(inspection.manifest.sources.map(p=>["/"+p,path.join(inspection.project,p)]));
  files.set("/",path.join(inspection.project,inspection.manifest.entry));
  const vendor=await vendorFile(inspection.manifest.threeVersion);
  const vendorCore=path.join(path.dirname(vendor),"three.core.js");
  if(!(await noLink(vendorCore)))throw new Error("Pinned Three.js internal core module is missing; run npm install");
  const server=http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url??"/","http://127.0.0.1");
      if(req.method!=="GET"||url.pathname.startsWith("//")){res.writeHead(405);res.end();return}
      const file=url.pathname==="/__talarion/three.module.js" ? vendor :
        url.pathname==="/__talarion/three.core.js" ? vendorCore : files.get(url.pathname);
      if(!file){res.writeHead(404);res.end("Not found");return}
      const bytes=await fs.readFile(file);
      res.writeHead(200,{
        "Content-Type":MIME[path.extname(file)]??"application/octet-stream",
        "Cache-Control":"no-store",
        "X-Content-Type-Options":"nosniff",
        "Content-Security-Policy":"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
      });
      res.end(bytes);
    }catch{res.writeHead(500);res.end("Server error")}
  });
  await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(port,"127.0.0.1",resolve)});
  const address=server.address();
  return {url:"http://127.0.0.1:"+address.port+"/",close:()=>new Promise(resolve=>server.close(resolve))};
}

export async function devWebNative(projectRef=DEFAULT_PROJECT,{port=0}={}){
  const inspection=await requireProject(projectRef);
  const server=await createWebNativeServer(inspection,{port});
  return {schema:"talarion.web-native-dev/v1",ok:true,project:inspection.project,
    url:server.url,server,
    text:"TALARION WEB-NATIVE DEVELOPMENT\n"+server.url+"\nCtrl+C to close; no project source files are modified."};
}

export async function testWebNative(projectRef=DEFAULT_PROJECT,{timeoutMs=35000}={}){
  const inspection=await requireProject(projectRef);
  const vendor=await vendorFile(inspection.manifest.threeVersion);
  const sourceFiles=await Promise.all(inspection.manifest.sources.slice().sort().map(async f=>({
    path:f,sha256:await shaFile(path.join(inspection.project,f))
  })));
  const sourceSha256=sha(Buffer.from(sourceFiles.map(x=>x.path+":"+x.sha256).join("\n")));
  const vendorSha256=await shaFile(vendor);
  const vendorCoreSha256=await shaFile(path.join(path.dirname(vendor),"three.core.js"));
  const replaySha256=await shaFile(path.join(inspection.project,inspection.manifest.replay));
  const base=path.join(TOOL_ROOT,"artifacts/run/web-native");
  await fs.mkdir(base,{recursive:true});
  const evidenceDir=await fs.mkdtemp(path.join(base,inspection.manifest.id+"-"));
  const server=await createWebNativeServer(inspection);
  let browser=null;
  try{
    let playwright;
    try{playwright=await import("playwright")}catch{throw new Error("Playwright is required: npm install && npx playwright install chromium")}
    browser=await playwright.chromium.launch({headless:true,args:["--enable-webgl","--use-gl=angle","--use-angle=swiftshader"]});
    const page=await browser.newPage({viewport:{width:1024,height:640},deviceScaleFactor:1});
    const states=[],perf=[],captures=[],issues=[],ready=[];
    let resolved=null;
    let rejectDone;
    const done=new Promise((resolve,reject)=>{resolved=resolve;rejectDone=reject});
    const timer=setTimeout(()=>rejectDone(new Error("Web-native replay timed out; ready="+
      ready.length+"; states="+states.length+"; captures="+captures.length+
      "; browser errors="+JSON.stringify(issues.slice(0,8)))),timeoutMs);
    const captureTasks=[];
    try{
      page.on("pageerror",error=>issues.push(String(error.message)));
      page.on("console",message=>{
        if(message.type()==="error")issues.push(message.text());
        const packet=parseProtocolLine(message.text());
        if(!packet)return;
        if(packet.kind==="state"&&isObject(packet.value))states.push(packet.value);
        if(packet.kind==="performance"&&isObject(packet.value))perf.push(packet.value);
        if(packet.kind==="ready"&&isObject(packet.value))ready.push(packet.value);
        if(packet.kind==="capture"&&isObject(packet.value)){
          const name=packet.value.name;
          if(!inspection.manifest.evidence.checkpoints.includes(name)||captures.some(x=>x.checkpoint===name)){
            issues.push("Invalid or repeated screenshot marker "+String(name));return;
          }
          const file=path.join(evidenceDir,name+".png");
          captureTasks.push(page.evaluate(()=>new Promise(resolve=>
            requestAnimationFrame(()=>requestAnimationFrame(resolve))))
            .then(()=>page.screenshot({path:file}))
            .then(async bytes=>captures.push({checkpoint:name,tick:packet.value.tick,file,sha256:sha(bytes),bytes:bytes.length}))
            .catch(error=>issues.push("Capture "+name+": "+error.message)));
        }
        if(packet.kind==="finished")resolved(packet.value);
      });
      await page.goto(server.url+"?talarionReplay=1",{waitUntil:"load"});
      const webgl=await page.evaluate(()=>!!document.getElementById("stage")?.getContext("webgl2"));
      const finished=await done;
      await Promise.all(captureTasks);
      const last=states.at(-1);
      const expected=inspection.manifest.evidence;
      const ok=webgl&&issues.length===0&&ready.length===1&&
        ready[0].gameId===inspection.manifest.id&&
        finished?.tick===expected.finishedTick&&finished?.gameId===inspection.manifest.id&&
        finished?.errorCount===0&&isObject(finished?.finalState)&&
        states.length>=expected.minSnapshots&&
        states.every((s,i)=>Number.isInteger(s.tick)&&
          (i===0||s.tick>states[i-1].tick)&&s.entity==="player")&&
        last?.state===finished.finalState.state&&
        last?.collected===finished.finalState.collected&&
        last?.collected===3&&last?.state==="VICTORY"&&
        captures.length===expected.checkpoints.length&&
        expected.checkpoints.every(n=>captures.some(c=>c.checkpoint===n&&c.bytes>15000))&&
        perf.length>=3;
      await Promise.all([
        writeJsonl(path.join(evidenceDir,"state.jsonl"),states),
        writeJsonl(path.join(evidenceDir,"performance.jsonl"),perf)
      ]);
      const result={schema:WEB_EVIDENCE_SCHEMA,ok,source:"web-native",
        projectId:inspection.manifest.id,engine:"three",host:"desktop-web",
        runtime:"browser-js",renderBackend:"webgl2",portingClass:"same-runtime",
        runtimeObserved:true,androidRuntimeObserved:false,releaseCertified:false,
        provenance:{sourceSha256,sourceFiles,vendorVersion:inspection.manifest.threeVersion,
          vendorSha256,vendorCoreSha256,replaySha256},
        evidence:{stateFile:path.join(evidenceDir,"state.jsonl"),screenshots:captures,
          performanceFile:path.join(evidenceDir,"performance.jsonl"),finished},
        observed:{webgl2:webgl,readyCount:ready.length,snapshots:states.length,
          captures:captures.length,performanceSamples:perf.length},warnings:issues,
        text:"TALARION WEB-NATIVE RUNTIME — "+(ok?"PASS":"FAIL")+
          "\nOriginal game: "+inspection.manifest.id+
          "\nSnapshots: "+states.length+" / Captures: "+captures.length+
          "\nEvidence: "+evidenceDir+"\nAndroid and Play release: NOT TESTED"};
      await writeJson(path.join(evidenceDir,"runner-result.json"),result);
      return result;
    }finally{clearTimeout(timer);await page.close().catch(()=>{})}
  }finally{await browser?.close().catch(()=>{});await server.close()}
}

export function defaultWebNativeProject(){return DEFAULT_PROJECT}
