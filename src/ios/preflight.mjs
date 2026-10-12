import fs from "node:fs/promises";
import path from "node:path";
import { run } from "../core/process.mjs";
import { resolveGodot } from "../adapters/godot.mjs";

export const IOS_PREFLIGHT_SCHEMA = "talarion.ios-preflight/v1";

function option(text,name) {
  for(const line of (text??"").split(/\r?\n/)) {
    const p=line.indexOf("=");
    if(p<0||line.slice(0,p).trim()!==name)continue;
    return line.slice(p+1).trim().replace(/^"|"$/g,"");
  }
  return null;
}
function presetExists(text,name) {
  if(typeof text!=="string"||!name)return false;
  const blocks=text.split(/(?=^\[preset\.\d+\]\s*$)/m).slice(1);
  return blocks.some(b=>option(b.split(/^\[preset\.\d+\.options\]/m)[0],"name")===name &&
    option(b,"platform")==="iOS");
}
function bundle(id) {
  return typeof id==="string"&&id.length<=255&&
    /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/.test(id);
}
function team(id) {
  return typeof id==="string"&&/^[A-Z0-9]{10}$/.test(id);
}
function simulatorCompatible(text) {
  if(typeof text!=="string")return false;
  const section=text.split(/^\[rendering\]\s*$/m)[1]?.split(/^\[/m)[0];
  const mobile=option(section,"renderer/rendering_method.mobile");
  return (mobile??option(section,"renderer/rendering_method"))==="gl_compatibility";
}
export function assessIosPreflight({
  config,hostPlatform,tools={},presetText,projectText
}={}) {
  const ios=config?.ios??{},checks=[];
  const check=(id,ok,detail,unverified=false)=>checks.push({
    id,status:unverified?"unverified":ok?"pass":"blocked",detail
  });
  check("IOS-01",hostPlatform==="darwin","Godot iOS export requires macOS.");
  check("IOS-02",tools.xcode===true&&tools.xcodeSelect===true,
    "Full Xcode and selected Xcode developer directory required.");
  check("IOS-03",tools.iphoneosSdk===true,"Observed iPhoneOS SDK required.");
  check("IOS-04",tools.iphonesimulatorSdk===true,"Observed iPhoneSimulator SDK required.");
  check("IOS-05",tools.godot===true,"Godot executable required.");
  check("IOS-06",presetExists(presetText,ios.preset),
    "Project iOS export preset required, not Web/Android preset.");
  check("IOS-07",bundle(ios.bundleIdentifier),
    "Explicit reverse-DNS bundle identifier required.");
  check("IOS-08",team(ios.appStoreTeamId),
    "Apple App Store Team ID required for iOS export.");
  check("IOS-09",simulatorCompatible(projectText),
    "iOS Simulator only supports Godot Compatibility renderer.");
  check("IOS-10",false,
    "Matching installed Godot iOS export templates not verified in P0.",true);
  check("IOS-11",false,
    "Xcode signing, provisioning, and archive not verified in P0.",true);
  const prerequisitesObserved=checks.slice(0,9).every(c=>c.status==="pass");
  return {
    schema:IOS_PREFLIGHT_SCHEMA,ok:true,target:"ios",
    status:prerequisitesObserved?"prerequisites-detected":"blocked",
    scope:"static-configuration-and-host-toolchain-preflight",
    hostClass:hostPlatform==="darwin"?"macos":
      hostPlatform==="linux"?"linux-unsupported-for-export":
        hostPlatform==="win32"?"windows-unsupported-for-export":"unknown",
    prerequisitesObserved,exportReady:false,exportAttempted:false,
    appSigned:false,simulatorRuntimeObserved:false,
    physicalDeviceRuntimeObserved:false,simulatorCertified:false,
    physicalDeviceCertified:false,parityCertified:false,
    simulatorRendererConstraint:"gl_compatibility",
    requiredFutureEvidence:[
      "matching Godot iOS export templates verified",
      "reviewed Xcode signing and provisioning configuration",
      "actual exported Xcode project and archive provenance",
      "actual simulator or physical runtime replay/image evidence"
    ],
    checks,
    text:"TALARION IOS PREFLIGHT\n"+
      checks.map(c=>c.status.toUpperCase()+" "+c.id+" — "+c.detail).join("\n")+
      "\n"+(prerequisitesObserved?"PREREQUISITES DETECTED":"IOS EXPORT BLOCKED")+
      "\nNo iOS export, signing, simulator/device or parity certification."
  };
}
const optional=filename=>fs.readFile(filename,"utf8").catch(e=>{
  if(e.code==="ENOENT")return null;
  throw e;
});
async function probe(bin,args,valid=()=>true) {
  const r=await run(bin,args);
  return r.ok&&valid(r.stdout.trim());
}
function inside(root,out) {
  const full=path.resolve(root,out),rel=path.relative(root,full);
  if(!rel||rel===".."||rel.startsWith(".."+path.sep)||path.isAbsolute(rel))
    throw Error("iOS preflight output must be inside repository.");
  return {full,rel};
}
async function noSymlink(root,rel) {
  let at=root;
  for(const part of rel.split(path.sep)) {
    at=path.join(at,part);
    const info=await fs.lstat(at).catch(e=>e.code==="ENOENT"?null:Promise.reject(e));
    if(info?.isSymbolicLink())throw Error("iOS preflight path crosses symlink.");
  }
}
export async function iosPreflightCommand(config,outputFile,options={}) {
  if(!outputFile)throw Error("Usage: talarion ios preflight <out.json>");
  const root=config.root,projectDir=path.resolve(root,config.project?.path??"");
  const rp=path.relative(root,projectDir);
  if(rp===".."||rp.startsWith(".."+path.sep)||path.isAbsolute(rp))
    throw Error("Project path escapes repository.");
  const {full,rel}=inside(root,outputFile);
  await noSymlink(root,rel);
  const [presetText,projectText]=await Promise.all([
    optional(path.join(projectDir,"export_presets.cfg")),
    optional(path.join(projectDir,"project.godot"))
  ]);
  const hostPlatform=options.platform??process.platform;
  const runMac=async(bin,args,accept)=>hostPlatform==="darwin"&&
    await probe(bin,args,accept);
  const tools=options.tools??{
    xcode:await runMac("xcodebuild",["-version"]),
    xcodeSelect:await runMac("xcode-select",["-p"],
      v=>v.includes("Xcode.app/Contents/Developer")),
    iphoneosSdk:await runMac("xcrun",["--sdk","iphoneos","--show-sdk-path"],
      v=>v.includes("iPhoneOS")),
    iphonesimulatorSdk:await runMac("xcrun",["--sdk","iphonesimulator","--show-sdk-path"],
      v=>v.includes("iPhoneSimulator")),
    godot:(await resolveGodot(config)).ok
  };
  const result=assessIosPreflight({config,hostPlatform,tools,presetText,projectText});
  await fs.mkdir(path.dirname(full),{recursive:true});
  await fs.writeFile(full,JSON.stringify(result,null,2)+"\n","utf8");
  return {...result,output:full};
}
