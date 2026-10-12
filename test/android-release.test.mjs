import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { planReleaseAab,buildReleaseAab,verifyReleaseAab,testReleaseAab } from "../src/android-webview/release.mjs";
import { testWebView } from "../src/android-webview/runtime.mjs";
import { smokeInteractiveWebView, landscapeResumeEvidence } from "../src/android-webview/interactive.mjs";

const project=path.resolve("examples/web-native");
const env=["TALARION_RELEASE_KEYSTORE","TALARION_RELEASE_ALIAS",
  "TALARION_RELEASE_STOREPASS_FILE","TALARION_RELEASE_KEYPASS_FILE","TALARION_BUNDLETOOL_JAR"];

test("WF03 official snapshot requires new Android mobile API36, independently from API35 debug",async()=>{
  const rule=JSON.parse(await fs.readFile("docs/development/policies/google-play-2026-08-31.json","utf8"));
  const debug=await fs.readFile("src/android-webview/runtime.mjs","utf8");
  const release=await fs.readFile("src/android-webview/release.mjs","utf8");
  assert.equal(rule.effectiveFrom,"2026-08-31");
  assert.equal(rule.mobileNewSubmissionMinTargetSdk,36);
  assert.match(debug,/--target-sdk-version","35"/);
  assert.match(release,/--target-sdk-version","36"/);
  assert.match(release,/--proto-format/);
  assert.match(release,/jarsigner/);
  assert.doesNotMatch(release,/apksigner.+sign/);
});

test("WF03 plan rejects missing upload signing keys, fails closed without AAB",async()=>{
  const original=Object.fromEntries(env.map(k=>[k,process.env[k]]));
  for(const k of env)delete process.env[k];
  try{
    const p=await planReleaseAab(project);
    assert.equal(p.ok,false);
    assert.equal(p.schema,"talarion.release-plan/v1");
    assert.equal(p.targetSdk,36);
    for(const id of ["WR003","WR004","WR005","WR006","WR007"])
      assert.equal(p.checks.find(c=>c.id===id).ok,false,id);
    assert.equal(p.releaseCertified,false);
    await assert.rejects(buildReleaseAab(project),/preflight blocked/);
    await assert.rejects(buildReleaseAab("examples/ruins-lite"),/only accepts inspected/);
  }finally{for(const k of env){if(original[k]===undefined)delete process.env[k];else process.env[k]=original[k];}}
});

test("WF03 never accepts repo-local or symlink secret material",async()=>{
  const home=await fs.mkdtemp(path.join(os.tmpdir(),"talarion-wf03-check-"));
  const original=Object.fromEntries(env.map(k=>[k,process.env[k]]));
  try{
    const pfile=path.join(home,"password");await fs.writeFile(pfile,"not-a-real-release-key");
    const symlink=path.join(home,"linked");await fs.symlink(pfile,symlink);
    Object.assign(process.env,{
      TALARION_RELEASE_KEYSTORE:path.resolve("package.json"),
      TALARION_RELEASE_ALIAS:"upload",
      TALARION_RELEASE_STOREPASS_FILE:symlink,
      TALARION_RELEASE_KEYPASS_FILE:pfile
    });
    const p=await planReleaseAab(project);
    assert.equal(p.checks.find(c=>c.id==="WR004").ok,false);
    assert.equal(p.checks.find(c=>c.id==="WR005").ok,false);
    assert.equal(p.checks.find(c=>c.id==="WR006").ok,true);
    assert.equal(p.releaseCertified,false);
  }finally{
    for(const k of env){if(original[k]===undefined)delete process.env[k];else process.env[k]=original[k];}
    await fs.rm(home,{recursive:true,force:true});
  }
});

test("WF03 read-only CLI plan does not claim Play approval",()=>{
  const v=spawnSync(process.execPath,["bin/talarion.mjs","web-native","android","release","plan",
    "examples/web-native","--json"],{encoding:"utf8"});
  assert.equal(v.status,1,v.stderr);
  const p=JSON.parse(v.stdout);
  assert.equal(p.schema,"talarion.release-plan/v1");
  assert.equal(p.playApproved,false);
  assert.equal(p.releaseCertified,false);
});

test("WF03-P1 cannot accept a synthetic release replay or fall back to Debug build",async()=>{
  const missing=path.join(os.tmpdir(),"wf03-forged-release-does-not-exist.apk");
  const forged={ok:true,artifactKind:"release-apk",projectId:"signal-garden",
    package:"dev.talarion.signalgarden",targetSdk:36,runtime:"android-webview",
    sourceAabSha256:"a".repeat(64),artifactSha256:"b".repeat(64),
    artifact:missing,identity:{sourceSha256:"c".repeat(64)}};
  await assert.rejects(testWebView(project,{releaseBuild:forged}),/ENOENT|WR101/);
  await assert.rejects(smokeInteractiveWebView(project,{releaseBuild:forged}),
    /WI002|WI003|ENOENT/);
});
test("WF03-P1 released APK QA is a separate fail-closed emulator gate",async()=>{
  const source=await fs.readFile("src/android-webview/release.mjs","utf8");
  const smoke=await fs.readFile("src/android-webview/interactive.mjs","utf8");
  const runtime=await fs.readFile("src/android-webview/runtime.mjs","utf8");
  const ci=await fs.readFile(".github/workflows/ci.yml","utf8");
  assert.match(source,/ro\.kernel\.qemu/);
  assert.match(source,/WR103: destructive package swap refused on physical Android hardware/);
  assert.match(source,/build-apks/);
  assert.match(source,/apksigner/);
  assert.match(source,/verified\.gate\.signerCertificateSha256/);
  assert.match(source,/releaseBuild\}/);
  assert.match(runtime,/releaseBuild\?\?await buildWebView\(project\)/);
  assert.match(runtime,/artifacts\/run\/android-webview-release/);
  assert.match(smoke,/artifacts\/run\/android-webview-release-interactive/);
  assert.match(ci,/Compare actual extracted Release APK game against independent browser replay/);
  assert.match(ci,/talarion-wf03-release-runtime-evidence/);
  // Without an independently generated exact-source signed AAB this MUST fail,
  // and may never generate or install the legacy Debug APK as a fallback.
  await assert.rejects(testReleaseAab(project),/ENOENT|untrusted|stale|WR10/);
});

test("WF03-P1 regression: HOME portrait surface cannot be certified before two landscape frames",()=>{
  const portrait={width:1080,height:2340};
  const landscape={width:2340,height:1080};
  assert.equal(landscapeResumeEvidence([portrait]),false);
  assert.equal(landscapeResumeEvidence([landscape,portrait]),false);
  assert.equal(landscapeResumeEvidence([portrait,landscape]),false);
  assert.equal(landscapeResumeEvidence([portrait,landscape,portrait,landscape]),false);
  assert.equal(landscapeResumeEvidence([portrait,landscape,landscape]),true);
  assert.equal(landscapeResumeEvidence([portrait,{width:NaN,height:1080},landscape]),false);
  assert.equal(landscapeResumeEvidence([portrait,{width:0,height:0},landscape]),false);
});

test("WF03-P1 retains raw portrait evidence and fails closed if no real landscape resume",async()=>{
  const src=await fs.readFile("src/android-webview/interactive.mjs","utf8");
  assert.match(src,/04-resume-orientation-probe\.png/);
  assert.match(src,/orientationObservations/);
  assert.match(src,/awaitLandscapeResume\(dir,orientationObservations\)/);
  assert.match(src,/assert\("WI017",false/);
  assert.doesNotMatch(src,/sleep\(\d+\).*post-resume trusted tap/);
});
