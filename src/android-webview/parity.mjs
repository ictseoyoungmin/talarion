import fs from "node:fs/promises";
import path from "node:path";
import { writeJson } from "../runtime/evidence.mjs";
import { decodePng } from "../visual/png.mjs";

const isObject=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
async function findEvidence(dir,filename){
  const root=path.resolve(dir);
  const names=await fs.readdir(root,{withFileTypes:true});
  const results=[];
  for(const n of names){
    if(n.isSymbolicLink())continue;
    if(n.isFile()&&n.name===filename)results.push(path.join(root,n.name));
    if(n.isDirectory()&&n.name.startsWith("signal-garden-")){
      const file=path.join(root,n.name,filename);
      if((await fs.stat(file).catch(()=>null))?.isFile())results.push(file);
    }
  }
  if(results.length!==1)throw new Error("Expected exactly one independent "+filename+" in "+dir);
  return results[0];
}
const check=(checks,id,ok,detail)=>checks.push({id,status:ok?"pass":"fail",detail});
export async function compareWebAndWebView(webDir,androidDir,output){
  const webFile=await findEvidence(webDir,"runner-result.json");
  const androidFile=await findEvidence(androidDir,"runner-result.json");
  const w=JSON.parse(await fs.readFile(webFile,"utf8"));
  const a=JSON.parse(await fs.readFile(androidFile,"utf8"));
  const checks=[];
  check(checks,"WP001",w.ok===true&&a.ok===true&&w.runtimeObserved===true&&
    a.observed?.runtimeObserved===true&&w.runtime==="browser-js"&&a.runtime==="android-webview",
    "Two distinct observed browser/WebView runtime providers report success");
  const ids=w.provenance&&a.identity;
  check(checks,"WP002",!!ids&&["sourceSha256","replaySha256","vendorSha256","vendorCoreSha256"].every(k=>
    typeof w.provenance[k]==="string"&&w.provenance[k].length===64&&w.provenance[k]===a.identity[k]),
    "Exact same original Web game source, replay and pinned Three.js vendor hashes");
  const [wa,aa]=await Promise.all([
    fs.readFile(path.join(path.dirname(webFile),"state.jsonl"),"utf8"),
    fs.readFile(path.join(path.dirname(androidFile),"state.jsonl"),"utf8")
  ]);
  const sWeb=wa.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const sAndroid=aa.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  check(checks,"WP003",sWeb.length>=8&&sWeb.length===sAndroid.length&&
    sWeb.every((s,i)=>JSON.stringify(s)===JSON.stringify(sAndroid[i])),
    "Independent original game state streams match exactly at all recorded ticks");
  const wScreens=w.evidence?.screenshots??[],aScreens=a.evidence?.screenshots??[];
  const comparable=wScreens.length===3&&aScreens.length===3&&
    wScreens.every(s=>aScreens.some(t=>t.checkpoint===s.checkpoint&&t.tick===s.tick));
  check(checks,"WP004",comparable,
    "All named checkpoints and capture tick identities were observed on both hosts");
  let imagesOkay=comparable;
  for(const reportPath of [webFile,androidFile]){
    const isWeb=reportPath===webFile;
    for(const shot of (isWeb?wScreens:aScreens)){
      const filename=path.join(path.dirname(reportPath),shot.checkpoint+".png");
      const bytes=await fs.readFile(filename).catch(()=>Buffer.alloc(0));
      if(bytes.length<15000||bytes.subarray(0,8).toString("hex")!=="89504e470d0a1a0a")
        imagesOkay=false;
    }
  }
  check(checks,"WP005",imagesOkay,"Both hosts produced nonempty actual PNG captures at every checkpoint");
  const win=JSON.stringify(w.evidence?.finished?.finalState)===JSON.stringify(a.evidence?.finished?.finalState);
  check(checks,"WP006",win&&a.evidence?.finished?.finalState?.state==="VICTORY",
    "Final independently observed gameplay state/score is equivalent");
  // Fixture-specific visual semantic barrier: an unchanged Signal Garden
  // progress HUD must visibly show 1, 2, then 3 amber segments at capture time.
  // This is NOT a general pixel-fidelity claim or OCR.
  const hud={};let hudValid=comparable;
  for(const [name,expectedSegments] of [["arrival",1],["crossing",2],["completion",3]]){
    try{
      const bytes=await fs.readFile(path.join(path.dirname(androidFile),name+".png"));
      const im=decodePng(bytes);
      let count=0;
      for(let y=Math.floor(im.height*.72);y<Math.floor(im.height*.84);y++){
        for(let x=Math.floor(im.width*.06);x<Math.floor(im.width*.26);x++){
          const i=(y*im.width+x)*4,r=im.data[i],g=im.data[i+1],b=im.data[i+2];
          if(r>170&&g>110&&b>55&&b<210&&r>g*1.12&&g>b*1.07)count++;
        }
      }
      const normalized=count/(im.width*im.height);
      const nominalPerSegment=.00043;
      const aligned=normalized>(expectedSegments-.35)*nominalPerSegment &&
        normalized<(expectedSegments+.35)*nominalPerSegment;
      hud[name]={expectedSegments,normalizedAmberArea:normalized,aligned};
      if(!aligned)hudValid=false;
    }catch(error){
      hud[name]={expectedSegments,error:String(error.message??error),aligned:false};
      hudValid=false;
    }
  }
  check(checks,"WP007",hudValid,
    "Real Android capture displays the expected 1/2/3 Signal Garden HUD progression at named checkpoints");
  const ok=checks.every(c=>c.status==="pass");
  const report={schema:"talarion.webview-parity/v1",ok,
    gameId:"signal-garden",portabilityClass:"same-runtime",
    authority:"observed-independent-browser-and-android-webview",
    stateParityCertified:ok,visualCapturePresenceVerified:imagesOkay,fixtureHudProgressVerified:hudValid,hud,
    visualPixelSimilarityCertified:false,physicalDeviceCertified:false,
    releaseCertified:false,storePublished:false,checks,
    observed:{webStateCount:sWeb.length,androidStateCount:sAndroid.length,
      webCaptures:wScreens.length,androidCaptures:aScreens.length},
    // Deliberately do not repeat artifact paths from the original GitHub runner machine.
    text:"TALARION WF02 PARITY "+(ok?"PASS":"FAIL")+
      "\nState: "+sWeb.length+"/"+sAndroid.length+" | checkpoints: "+
      wScreens.length+"/"+aScreens.length+"\nVisual pixel equivalence: NOT CERTIFIED"};
  await writeJson(output,report);
  return report;
}
