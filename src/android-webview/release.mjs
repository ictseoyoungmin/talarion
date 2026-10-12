import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { run } from "../core/process.mjs";
import { inspectWebNative } from "../web-native/runtime.mjs";
import { testWebView } from "./runtime.mjs";
import { smokeInteractiveWebView } from "./interactive.mjs";

const ROOT=fileURLToPath(new URL("../../",import.meta.url));
const GAME="signal-garden";
const PACKAGE="dev.talarion.signalgarden";
const ACTIVITY=PACKAGE+"/.GameActivity";
const OUTPUT=path.join(ROOT,"artifacts/build/android-webview-release");
const AAB=path.join(OUTPUT,"signal-garden-release.aab");
const EVIDENCE=path.join(OUTPUT,"release-evidence.json");
const POLICY_FILE=path.join(ROOT,"docs/development/policies/google-play-2026-08-31.json");
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const digest=async f=>sha(await fs.readFile(f));
const exists=async f=>(await fs.stat(f).catch(()=>null))?.isFile()===true;
const under=(dir,file)=>{const relative=path.relative(dir,path.resolve(file));return relative===""||(!relative.startsWith(".."+path.sep)&&relative!==".."&&!path.isAbsolute(relative));};
const sdkRoot=()=>process.env.ANDROID_SDK_ROOT||process.env.ANDROID_HOME||"";
const tool=(root,name)=>path.join(root,name+(process.platform==="win32"?".exe":""));
const bundleArgs=(command,...args)=>["-jar",process.env.TALARION_BUNDLETOOL_JAR||"",command,...args];
const ks=()=>({
  path:process.env.TALARION_RELEASE_KEYSTORE||"",
  alias:process.env.TALARION_RELEASE_ALIAS||"",
  storePass:process.env.TALARION_RELEASE_STOREPASS_FILE||"",
  keyPass:process.env.TALARION_RELEASE_KEYPASS_FILE||""
});
const safe=async(command,args,options={})=>{
  const result=await run(command,args,options);
  if(!result.ok)throw new Error("WF03 Android tool failed: "+path.basename(command)+" "+
    (result.stderr||result.error||result.stdout||"").slice(-1400));
  return result.stdout||"";
};
const classes=async dir=>{
  const found=[];
  for(const ent of await fs.readdir(dir,{withFileTypes:true})){
    const file=path.join(dir,ent.name);
    if(ent.isDirectory())found.push(...await classes(file));
    else if(ent.isFile()&&ent.name.endsWith(".class"))found.push(file);
  }
  return found.sort();
};
async function game(project){
  const result=await inspectWebNative(project);
  if(!result.ok||result.manifest?.id!==GAME||result.manifest?.engine!=="three")
    throw new Error("WF03 only accepts inspected original Signal Garden Three.js source");
  return result;
}
async function policy(){
  const p=JSON.parse(await fs.readFile(POLICY_FILE,"utf8"));
  if(p.schema!=="talarion.play-policy-snapshot/v1"||p.mobileNewSubmissionMinTargetSdk!==36||
    p.effectiveFrom!=="2026-08-31"||!p.sourceUrl.startsWith("https://support.google.com/googleplay/"))
    throw new Error("Unrecognized Google Play policy snapshot; review official policy before building");
  const age=(Date.now()-Date.parse(p.reviewedOn+"T00:00:00+09:00"))/86400000;
  if(!Number.isFinite(age)||age<0||age>90)throw new Error("Google Play policy snapshot out of date; review and version policy");
  return p;
}
async function sourceIdentity(info){
  const sources=await Promise.all(info.manifest.sources.slice().sort().map(async rel=>({
    path:rel,sha256:await digest(path.join(info.project,rel))
  })));
  const vendor=path.join(ROOT,"node_modules/three/build/three.module.js");
  const core=path.join(ROOT,"node_modules/three/build/three.core.js");
  const host=path.join(ROOT,"src/android-webview");
  return {sourceFiles:sources,sourceSha256:sha(Buffer.from(sources.map(f=>f.path+":"+f.sha256).join("\n"))),
    replaySha256:await digest(path.join(info.project,info.manifest.replay)),
    vendorVersion:info.manifest.threeVersion,vendorSha256:await digest(vendor),
    vendorCoreSha256:await digest(core),
    hostSha256:sha(Buffer.from([await digest(path.join(host,"java/dev/talarion/signalgarden/GameActivity.java")),
      await digest(path.join(host,"AndroidManifest.xml"))].join("\n")))};
}
async function credentialsPresent(){
  const k=ks(),invalid=[];
  if(!/^[a-zA-Z0-9._-]{1,80}$/.test(k.alias))invalid.push("WR003: release key alias absent/invalid");
  for(const [id,location] of [["WR004",k.path],["WR005",k.storePass],["WR006",k.keyPass]]){
    if(!location||under(ROOT,location)||!(await exists(location))||
      (await fs.lstat(location).catch(()=>null))?.isSymbolicLink())
      invalid.push(id+": signing material must be a regular external file outside the checkout");
  }
  return invalid;
}
export async function planReleaseAab(project){
  const info=await game(project);
  const p=await policy();
  const sdk=sdkRoot();
  const checks=[
    {id:"WR001",ok:!!sdk&&await exists(path.join(sdk,"platforms/android-36/android.jar")),detail:"Android platform API 36 installed"},
    {id:"WR002",ok:!!sdk&&await exists(tool(path.join(sdk,"build-tools/36.0.0"),"aapt2")),detail:"Android build tools 36.0.0 installed"},
    {id:"WR007",ok:await exists(process.env.TALARION_BUNDLETOOL_JAR||""),detail:"Explicit pinned external bundletool JAR exists"},
    {id:"WR008",ok:process.platform!=="win32",detail:"Current WF03 command path supported on Linux/macOS"},
    {id:"WR009",ok:info.ok,detail:"Original Three.js source read-only inspection"},
    {id:"WR010",ok:p.mobileNewSubmissionMinTargetSdk===36,detail:"Pinned reviewed mobile Play API 36 rule; Play approval not inferred"}
  ];
  const bad=await credentialsPresent();
  for(const id of ["WR003","WR004","WR005","WR006"])
    checks.push({id,ok:!bad.some(x=>x.startsWith(id+":")),detail:"External user-controlled upload signing material"});
  return {schema:"talarion.release-plan/v1",ok:checks.every(x=>x.ok),
    projectId:GAME,package:PACKAGE,artifactKind:"release-aab",runtime:"android-webview",
    targetSdk:36,minSdk:26,policy:{effectiveFrom:p.effectiveFrom,reviewedOn:p.reviewedOn,sourceUrl:p.sourceUrl},
    checks,releaseCertified:false,playApproved:false,
    text:"TALARION WF03 RELEASE PLAN "+(checks.every(x=>x.ok)?"READY":"BLOCKED")};
}
function signingOptions(){
  const k=ks();
  return ["-keystore",k.path,"-storepass:file",k.storePass,"-keypass:file",k.keyPass];
}
function apksSigningOptions(){
  const k=ks();
  return ["--ks="+k.path,"--ks-pass=file:"+k.storePass,"--ks-key-alias="+k.alias,
    "--key-pass=file:"+k.keyPass];
}
async function validateBundle(){
  await safe("java",bundleArgs("validate","--bundle="+AAB));
  const manifest=await safe("java",bundleArgs("dump","manifest","--bundle="+AAB));
  if(!manifest.includes(PACKAGE)||!/(?:android:)?targetSdkVersion\s*=\s*["']36["']/.test(manifest))
    throw new Error("Bundle manifest package/targetSdk is not independently confirmed");
  const entries=await safe("unzip",["-Z","-1",AAB]);
  for(const required of ["base/manifest/AndroidManifest.xml","base/dex/classes.dex","base/assets/game/index.html"]){
    if(!entries.split(/\r?\n/).includes(required))throw new Error("Release bundle missing "+required);
  }
  const libs=entries.split(/\r?\n/).filter(x=>/^base\/lib\/.*\.so$/.test(x));
  if(libs.some(x=>x.includes("/armeabi-v7a/"))&&!libs.some(x=>x.includes("/arm64-v8a/")))
    throw new Error("Release bundle has 32-bit ARM native libraries without arm64");
  if(libs.some(x=>x.includes("/x86/"))&&!libs.some(x=>x.includes("/x86_64/")))
    throw new Error("Release bundle has 32-bit x86 native libraries without x86_64");
  const verified=await safe("jarsigner",["-verify",AAB]);
  if(!verified.includes("jar verified."))throw new Error("AAB upload-key JAR signature not verified");
  const certificate=await safe("keytool",["-printcert","-jarfile",AAB]);
  const match=certificate.match(/SHA256:\s*([0-9A-F:]+)/i);
  if(!match)throw new Error("Missing independently readable signer certificate SHA-256 fingerprint");
  return {signerCertificateSha256:match[1],nativeLibs:libs,abi64Requirement:libs.length?"checked":"not-applicable-java-only",
    package:PACKAGE,targetSdk:36,signatureVerified:true,bundletoolValidated:true};
}
export async function buildReleaseAab(project){
  const info=await game(project);
  const plan=await planReleaseAab(project);
  if(!plan.ok)throw new Error("WF03 release preflight blocked: "+plan.checks.filter(x=>!x.ok).map(x=>x.id).join(","));
  const pkg=JSON.parse(await fs.readFile(path.join(ROOT,"node_modules/three/package.json"),"utf8"));
  if(pkg.version!==info.manifest.threeVersion)throw new Error("WF03 source/vendor version mismatch");
  const identity=await sourceIdentity(info);
  const sdk=sdkRoot(),bt=path.join(sdk,"build-tools/36.0.0");
  const platform=path.join(sdk,"platforms/android-36/android.jar");
  const stage=await fs.mkdtemp(path.join(os.tmpdir(),"talarion-release-"));
  try{
    const base=path.join(stage,"base"),assets=path.join(base,"assets/game");
    await fs.mkdir(path.join(assets,"__talarion"),{recursive:true});
    for(const rel of info.manifest.sources){
      const dst=path.join(assets,rel);
      await fs.mkdir(path.dirname(dst),{recursive:true});
      await fs.copyFile(path.join(info.project,rel),dst);
    }
    for(const vendorFile of ["three.module.js","three.core.js"])
      await fs.copyFile(path.join(ROOT,"node_modules/three/build",vendorFile),
        path.join(assets,"__talarion",vendorFile));
    const compiled=path.join(stage,"classes"),dex=path.join(base,"dex");
    await fs.mkdir(compiled,{recursive:true});await fs.mkdir(dex,{recursive:true});
    await safe("javac",["-source","8","-target","8","-classpath",platform,"-d",compiled,
      path.join(ROOT,"src/android-webview/java/dev/talarion/signalgarden/GameActivity.java")]);
    const classFiles=await classes(compiled);
    if(classFiles.length===0)throw new Error("Release Activity compilation produced no classes");
    await safe(tool(bt,"d8"),["--min-api","26","--lib",platform,"--output",dex,...classFiles]);
    if(!(await exists(path.join(dex,"classes.dex"))))throw new Error("Release classes.dex missing");
    const proto=path.join(stage,"proto.apk");
    await safe(tool(bt,"aapt2"),["link","--proto-format","-o",proto,
      "--manifest",path.join(ROOT,"src/android-webview/AndroidManifest.xml"),
      "-I",platform,"--min-sdk-version","26","--target-sdk-version","36",
      "--version-code","2","--version-name","0.2.0"]);
    const extracted=path.join(stage,"linked");
    await fs.mkdir(extracted,{recursive:true});
    await safe("unzip",["-j","-o",proto,"AndroidManifest.xml","-d",extracted]);
    await fs.mkdir(path.join(base,"manifest"),{recursive:true});
    await fs.copyFile(path.join(extracted,"AndroidManifest.xml"),path.join(base,"manifest/AndroidManifest.xml"));
    const contents=await safe("unzip",["-Z","-1",proto]);
    if(!contents.split(/\r?\n/).includes("resources.pb"))
      throw new Error("aapt2 proto output lacks resources.pb (cannot form verified base module)");
    await safe("unzip",["-j","-o",proto,"resources.pb","-d",base]);
    const moduleZip=path.join(stage,"base.zip");
    await safe("zip",["-q","-r",moduleZip,"."],{cwd:base});
    const unsigned=path.join(stage,"unsigned.aab"),signed=path.join(stage,"signed.aab");
    await safe("java",bundleArgs("build-bundle","--modules="+moduleZip,"--output="+unsigned));
    await safe("jarsigner",[...signingOptions(),"-signedjar",signed,unsigned,ks().alias]);
    await fs.mkdir(OUTPUT,{recursive:true});
    await fs.copyFile(signed,AAB);
    const gate=await validateBundle();
    const evidence={schema:"talarion.release-build/v1",ok:true,
      package:PACKAGE,projectId:GAME,portabilityClass:"same-runtime",
      sourceRuntime:"browser-js",hostRuntime:"android-webview",artifactKind:"release-aab",
      aab:AAB,aabSha256:await digest(AAB),aabBytes:(await fs.stat(AAB)).size,
      versionCode:2,versionName:"0.2.0",minSdk:26,targetSdk:36,
      sourceIdentity:identity,hostSha256:identity.hostSha256,
      policy:plan.policy,gate,buildTools:"36.0.0",
      uploadKeyProvidedExternally:true,deviceInstallObserved:false,
      releaseCertified:false,playApproved:false,hardwareCertified:false,
      text:"TALARION WF03 SIGNED RELEASE AAB BUILD PASS\nPlay publication/device certification: NOT VERIFIED"};
    await fs.writeFile(EVIDENCE,JSON.stringify(evidence,null,2)+"\n");
    return evidence;
  }finally{await fs.rm(stage,{recursive:true,force:true})}
}
export async function verifyReleaseAab(project){
  const info=await game(project);
  await policy();
  const evidence=JSON.parse(await fs.readFile(EVIDENCE,"utf8"));
  if(evidence.schema!=="talarion.release-build/v1"||!evidence.ok||evidence.projectId!==GAME||
    evidence.aab!==AAB||evidence.targetSdk!==36||evidence.aabSha256!==await digest(AAB))
    throw new Error("WF03 untrusted or stale AAB build evidence");
  const identity=await sourceIdentity(info);
  if(JSON.stringify(evidence.sourceIdentity)!==JSON.stringify(identity))
    throw new Error("WF03 release artifact does not match current Web game source/vendor/host");
  const gate=await validateBundle();
  if(JSON.stringify(gate)!==JSON.stringify(evidence.gate))
    throw new Error("WF03 bundle gate/certificate changed since build");
  return {schema:"talarion.release-verify/v1",ok:true,artifact:AAB,
    artifactSha256:evidence.aabSha256,sourceIdentity:identity,gate,
    releaseCertified:false,playApproved:false,deviceInstallObserved:false,
    text:"TALARION WF03 AAB INDEPENDENT VERIFY PASS (no Play approval or device claim)"};
}
export async function testReleaseAab(project){
  // P1 never builds an AAB implicitly: it consumes an independently verified P0 artifact.
  const verified=await verifyReleaseAab(project);
  const signingIssues=await credentialsPresent();
  if(signingIssues.length)throw new Error("WR100: release APK extraction requires external signing credentials");
  const adb=process.env.ADB||"adb";
  const devices=await safe(adb,["devices"]);
  const connected=devices.split(/\r?\n/).map(x=>x.trim().split(/\s+/)).filter(x=>x[1]==="device");
  if(connected.length!==1||(process.env.ANDROID_SERIAL&&connected[0][0]!==process.env.ANDROID_SERIAL))
    throw new Error("WR102: release smoke QA requires one selected authorized emulator");
  // The fixture has the same application ID as WF02 Debug, so installation may uninstall
  // an existing Debug app. This operation is limited to an independently identified emulator.
  const qemu=(await safe(adb,["shell","getprop","ro.kernel.qemu"])).trim();
  if(qemu!=="1")throw new Error("WR103: destructive package swap refused on physical Android hardware");
  const apkSet=path.join(OUTPUT,"release-universal.apks");
  await fs.rm(apkSet,{force:true});
  await safe("java",bundleArgs("build-apks","--bundle="+AAB,"--output="+apkSet,
    "--mode=universal",...apksSigningOptions()));
  const apkDir=path.join(OUTPUT,"install-test");
  await fs.rm(apkDir,{recursive:true,force:true});await fs.mkdir(apkDir,{recursive:true});
  await safe("unzip",["-j","-o",apkSet,"universal.apk","-d",apkDir]);
  const apk=path.join(apkDir,"universal.apk");
  if(!await exists(apk))throw new Error("WR104: bundletool APK set has no universal APK");
  const sdk=sdkRoot(),bt=path.join(sdk,"build-tools","36.0.0");
  const pkg=await safe(tool(bt,"aapt2"),["dump","badging",apk]);
  if(!pkg.includes("package: name='"+PACKAGE+"'")||
    !pkg.includes("versionCode='2'")||!pkg.includes("versionName='0.2.0'")||
    !pkg.includes("targetSdkVersion:'36'"))
    throw new Error("WR105: extracted release APK has wrong package/version/target SDK");
  const signer=await safe(tool(bt,"apksigner"),["verify","--verbose","--print-certs",apk]);
  const apkCert=signer.match(/Signer #1 certificate SHA-256 digest:\s*([0-9a-f:]+)/i)?.[1]?.replace(/:/g,"").toLowerCase();
  const aabCert=verified.gate.signerCertificateSha256.replace(/:/g,"").toLowerCase();
  if(!apkCert||apkCert!==aabCert||!signer.includes("Verified using v2 scheme"))
    throw new Error("WR106: extracted APK signer must match actual signed AAB upload signer");
  const files=(await safe("unzip",["-Z","-1",apk])).split(/\r?\n/);
  if(!["assets/game/index.html","classes.dex"].every(x=>files.includes(x)))
    throw new Error("WR107: extracted release APK is missing original game or Activity");
  const apkSha256=await digest(apk);
  const identity=verified.sourceIdentity;
  const releaseBuild={ok:true,projectId:GAME,package:PACKAGE,
    runtime:"android-webview",artifactKind:"release-apk",targetSdk:36,
    artifact:apk,artifactSha256:apkSha256,identity,hostSha256:identity.hostSha256,
    sourceAabSha256:verified.artifactSha256};
  // No hidden Debug APK build or Debug keystore: the same SHA-256-pinned extracted
  // Release APK is installed in a separate emulator replay and actual ADB touch run.
  const installed=await safe(adb,["shell","pm","path",PACKAGE]);
  if(installed.includes("package:"))await safe(adb,["uninstall",PACKAGE]);
  const replay=await testWebView(project,{releaseBuild});
  if(replay.artifactKind!=="release-apk"||replay.artifactSha256!==apkSha256||
    replay.sourceAabSha256!==verified.artifactSha256||
    replay.observed?.runtimeObserved!==true||replay.observed.stateCount<8||
    replay.observed.captureCount!==3)
    throw new Error("WR108: original Release APK deterministic replay evidence missing or stale");
  const interactive=await smokeInteractiveWebView(project,{releaseBuild});
  if(interactive.artifactKind!=="release-apk"||
    interactive.provenance?.apkSha256!==apkSha256||
    interactive.sourceAabSha256!==verified.artifactSha256||
    interactive.actions?.length!==3||interactive.captures?.length!==5||
    interactive.checks?.some(x=>x.passed!==true)||
    !interactive.environment?.observedInAndroidEmulator||
    interactive.lifecycle?.filter(e=>e.kind==="LIFECYCLE"&&e.value?.phase==="resume").length<2)
    throw new Error("WR109: original Release APK trusted touch/HOME-resume evidence invalid");
  const out={schema:"talarion.release-runtime/v1",ok:true,
    sourceAabSha256:verified.artifactSha256,extractedApkSha256:apkSha256,
    certificateSha256:apkCert,installedPackage:PACKAGE,versionCode:2,targetSdk:36,
    artifactKind:"release-apk",emulatorRuntimeObserved:true,
    gameplayReplayObserved:true,stateSnapshots:replay.observed.stateCount,
    replayScreenshots:replay.observed.captureCount,
    trustedTouchActions:interactive.actions.length,touchScreenshots:interactive.captures.length,
    homeResumeStatePreserved:true,
    provenance:{...identity,sourceAabSha256:verified.artifactSha256,apkSha256},
    evidence:{replay:replay.evidence?.stateFile,
      replayResult:path.join(path.dirname(replay.evidence.stateFile),"runner-result.json"),
      touchResult:interactive.captures[0]?.file?
        path.join(path.dirname(interactive.captures[0].file),"runner-result.json"):null},
    gameplayParityCertified:false,releaseCertified:false,playApproved:false,hardwareCertified:false,
    text:"TALARION WF03-P1 REAL EXTRACTED API36 RELEASE APK RUNTIME PASS\nOriginal emulator game replay, trusted touch + HOME/resume observed; Google Play: NOT CERTIFIED"};
  await fs.writeFile(path.join(OUTPUT,"install-evidence.json"),JSON.stringify(out,null,2)+"\n");
  return out;
}
