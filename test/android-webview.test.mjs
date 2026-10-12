import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { buildWebView,planWebView } from "../src/android-webview/runtime.mjs";
import { compareWebAndWebView } from "../src/android-webview/parity.mjs";

const REF=path.resolve("examples/web-native");

test("Android WebView source host has strict offline and no native JS bridge contracts",async()=>{
  const java=await fs.readFile("src/android-webview/java/dev/talarion/signalgarden/GameActivity.java","utf8");
  const manifest=await fs.readFile("src/android-webview/AndroidManifest.xml","utf8");
  assert.match(java,/appassets\.androidplatform\.net/);
  assert.match(java,/shouldInterceptRequest/);
  assert.match(java,/setAllowFileAccess\(false\)/);
  assert.match(java,/MIXED_CONTENT_NEVER_ALLOW/);
  assert.match(java,/getAssets\(\)\.open/);
  assert.doesNotMatch(java,/addJavascriptInterface/);
  assert.doesNotMatch(manifest,/android\.permission\.INTERNET/);
  assert.match(manifest,/android:usesCleartextTraffic="false"/);
  assert.match(manifest,/android:exported="true"/);
});

test("WF02 first-party host preflight requires an explicit approved Web game",async()=>{
  const r=await planWebView(REF);
  assert.equal(r.schema,"talarion.android-webview-plan/v1");
  assert.equal(r.runtime,"android-webview");
  assert.equal(r.artifact,"debug-apk");
  assert.equal(r.runtimeObserved,false);
  assert.equal(r.releaseCertified,false);
  await assert.rejects(buildWebView(path.resolve("examples/ruins-lite")),
    /WebView source preflight blocked/);
});

test("Android WebView CLI plan is read-only and does not certify package build",()=>{
  const r=spawnSync(process.execPath,["bin/talarion.mjs","web-native","android","plan","examples/web-native","--json"],{
    encoding:"utf8"
  });
  assert.ok(r.status===0||r.status===1,r.stderr);
  const result=JSON.parse(r.stdout);
  assert.equal(result.schema,"talarion.android-webview-plan/v1");
  assert.equal(result.runtimeObserved,false);
  assert.equal(result.releaseCertified,false);
});

test("runtime-parity gate fails closed on cross-project and stale evidence",async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),"talarion-wf02-parity-"));
  const web=path.join(root,"web"),android=path.join(root,"android");
  await fs.mkdir(web);await fs.mkdir(android);
  const row={tick:30,entity:"player",state:"EXPLORE",position:[0,0,0]};
  const png=Buffer.concat([Buffer.from("89504e470d0a1a0a","hex"),Buffer.alloc(15000)]);
  try{
    const hash="a".repeat(64),other="b".repeat(64);
    const provenance={sourceSha256:hash,replaySha256:hash,vendorSha256:hash,vendorCoreSha256:hash};
    const snaps=["arrival","crossing","completion"].map((checkpoint,i)=>({checkpoint,tick:(i+1)*30}));
    await Promise.all([
      fs.writeFile(path.join(web,"runner-result.json"),JSON.stringify({ok:true,runtime:"browser-js",runtimeObserved:true,
        provenance,evidence:{screenshots:snaps,finished:{finalState:{state:"VICTORY"}}}})),
      fs.writeFile(path.join(android,"runner-result.json"),JSON.stringify({ok:true,runtime:"android-webview",
        observed:{runtimeObserved:true},identity:{...provenance,sourceSha256:other},
        evidence:{screenshots:snaps,finished:{finalState:{state:"VICTORY"}}}})),
      fs.writeFile(path.join(web,"state.jsonl"),JSON.stringify(row)+"\n"),
      fs.writeFile(path.join(android,"state.jsonl"),JSON.stringify({...row,tick:31})+"\n"),
      ...[web,android].flatMap(dir=>snaps.map(s=>fs.writeFile(path.join(dir,s.checkpoint+".png"),png)))
    ]);
    const output=path.join(root,"result.json");
    const report=await compareWebAndWebView(web,android,output);
    assert.equal(report.ok,false);
    assert.equal(report.checks.find(x=>x.id==="WP002").status,"fail");
    assert.equal(report.checks.find(x=>x.id==="WP003").status,"fail");
    assert.equal(report.visualPixelSimilarityCertified,false);
    assert.equal(report.releaseCertified,false);
  }finally{await fs.rm(root,{recursive:true,force:true})}
});


test("WF02-P1 interaction and Activity lifecycle use original game, never a synthetic native gameplay bridge",async()=>{
  const game=await fs.readFile("examples/web-native/game.mjs","utf8");
  const java=await fs.readFile("src/android-webview/java/dev/talarion/signalgarden/GameActivity.java","utf8");
  const runner=await fs.readFile("src/android-webview/interactive.mjs","utf8");
  assert.match(game,/protocol\("TOUCH",\{direction:d,accepted,trusted:event\.isTrusted,state:snapshot\(state\)\}\)/);
  assert.match(game,/protocol\("INTERACTIVE_READY"/);
  assert.match(java,/TALARION_LIFECYCLE/);
  assert.match(java,/game\.onPause\(\)/);
  assert.match(java,/game\.onResume\(\)/);
  assert.doesNotMatch(java,/addJavascriptInterface/);
  assert.match(runner,/adb\("shell","input","tap"/);
  assert.match(runner,/adb\("shell","input","keyevent","3"\)/);
  assert.match(runner,/WI012/);
  assert.match(runner,/WI013/);
  assert.match(runner,/WI015/);
  assert.match(runner,/physicalDeviceCertified:false/);
  assert.match(runner,/releaseCertified:false/);
  const cli=spawnSync(process.execPath,["bin/talarion.mjs","web-native","android","smoke","examples/ruins-lite","--json"],{encoding:"utf8"});
  assert.equal(cli.status,1,cli.stderr);
  assert.match(JSON.parse(cli.stdout).error,/WI000|preflight|Signal Garden/);
});
