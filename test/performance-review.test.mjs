import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { summarizePerformance } from "../src/runtime/performance.mjs";
import { assessPerformanceAuthority } from "../src/runtime/budget-authority.mjs";
import { buildPerformanceReview } from "../src/runtime/performance-review.mjs";
import { renderPerformanceReview } from "../src/runtime/performance-render.mjs";
const CLI=fileURLToPath(new URL("../bin/talarion.mjs",import.meta.url));
const sha=s=>createHash("sha256").update(s).digest("hex");
const replaySha=sha("replay");
function authority(tag,webFps=62,androidFps=40) {
  const config={
    targets:{web:{profile:"web"},android:{profile:"android"}},
    profiles:{web:{targetFps:60},android:{targetFps:30,drawCallBudget:300}},
    performanceWindow:{warmupTicks:120,sampleStepTicks:60,minSamples:5}
  };
  const samples={},manifests={};
  for(const target of ["web","android"]) {
    const fps=target==="web"?webFps:androidFps,goal=target==="web"?60:30;
    const rows=Array.from({length:10},(_,i)=>({
      tick:(i+1)*60,fps,processMs:6+(i%2),physicsMs:1,
      memoryBytes:5000000+i*100+tag.length
    }));
    samples[target]=rows;
    manifests[target]={
      schema:"talarion.runner-result/v1",ok:true,target,
      browser:target==="web"?"playwright-chromium-headless":undefined,
      device:target==="android"?{schema:"talarion.android-device/v1",
        isEmulator:true,apiLevel:30}:undefined,
      provenance:{replaySha256:replaySha,
        ...(target==="android"?{apkSha256:sha("apk"+tag)}:{})},
      evidence:{performance:summarizePerformance(rows,{
        target,targetFps:goal,sampleFile:"performance.jsonl"
      })}
    };
  }
  const result=assessPerformanceAuthority({config,manifests,samples,
    replaySha256:replaySha,replayEndTick:600,replayTickRate:60,
    sampleHashes:{web:sha("web-"+tag),android:sha("android-"+tag)}});
  assert.equal(result.ok,true);
  assert.ok(result.targets.every(t=>t.performanceWindow.status==="complete-window"));
  return result;
}
const policy={maxFpsDropPct:10,maxProcessRisePct:20};
function entry(tag,fps=62,android=40) {
  const authorityData=authority(tag,fps,android);
  const body=JSON.stringify(authorityData,null,2)+"\n";
  return {runId:tag,environmentKey:"linux-x64-fixed-runner",
    sha256:sha(body),authority:authorityData,body};
}
const cohorts=(baseline,candidate)=>{
  const target=x=>({baseline:baseline.map(v=>({...v})),
    candidate:candidate.map(v=>({...v}))});
  return {web:target("web"),android:target("android")};
};

test("P3 one Web and one Android authority produce evidence-only, not a performance PASS",()=>{
  const one=entry("only");
  const result=buildPerformanceReview({policy,cohorts:cohorts([], [one])});
  assert.equal(result.schema,"talarion.performance-review/v1");
  assert.equal(result.ok,true);
  assert.equal(result.decision,"evidence-only");
  assert.equal(result.performanceCertified,false);
  assert.equal(result.hardwareCertified,false);
  assert.equal(result.ciReleaseCertified,undefined);
  assert.deepEqual(result.targets.map(t=>t.regression.status),
    ["not-evaluated","not-evaluated"]);
  assert.ok(result.targets.every(t=>t.budgets.some(b=>
    b.status==="insufficient-independent-runs")));
});

test("P3 conclusive repeated degradation blocks policy but cannot certify devices",()=>{
  const base=["b1","b2","b3"].map(tag=>entry(tag,63,41));
  const cand=["c1","c2","c3"].map(tag=>entry(tag,41,20));
  const result=buildPerformanceReview({policy,cohorts:cohorts(base,cand)});
  assert.equal(result.ok,false);
  assert.equal(result.decision,"blocked-observational-degradation");
  for(const t of result.targets){
    assert.equal(t.regression.status,"regression-observed");
    assert.equal(t.status,"observed-degradation");
    assert.equal(t.budgets.find(b=>b.field==="targetFps").status,
      "observed-below-limit");
    assert.equal(t.physicalDeviceCertified,false);
  }
  const good=buildPerformanceReview({policy,cohorts:cohorts(
    ["a","b","c"].map(tag=>entry(tag,65,45)),
    ["d","e","f"].map(tag=>entry(tag,65,45))
  )});
  assert.equal(good.ok,true);
  assert.equal(good.decision,"observational-no-degradation");
  assert.equal(good.performanceCertified,false);
});

test("P3 refuses reused authority/sample evidence, inconsistent hosts and incomplete authority",()=>{
  const a=entry("same");
  const duplicates=[{...a,runId:"one"},{...a,runId:"two"},{...a,runId:"three"}];
  for(const bad of [
    duplicates,
    [entry("x"),entry("y"),{...entry("z"),environmentKey:"different-host"}],
    [entry("j"),entry("k"),{...entry("l"),authority:{...authority("l"),ok:false}}],
    [entry("r"),entry("s"),{...entry("t"),authority:{...authority("t"),targets:[]}}]
  ]) {
    const result=buildPerformanceReview({policy,cohorts:cohorts([],bad)});
    assert.equal(result.ok,false);
    assert.equal(result.decision,"invalid-evidence");
  }
  assert.equal(buildPerformanceReview({cohorts:cohorts([], [a])}).ok,false);
  assert.equal(buildPerformanceReview({policy:{...policy,maxProcessRisePct:-2},
    cohorts:cohorts([], [a])}).ok,false);
});

test("P3 report HTML escapes untrusted run identifiers",()=>{
  const e=entry("safe");
  e.runId='<img src=x onerror="alert(1)">';
  const result=buildPerformanceReview({policy,cohorts:cohorts([], [e])});
  assert.equal(result.ok,true);
  const html=renderPerformanceReview(result);
  assert.ok(html.startsWith("<!doctype html>"));
  assert.ok(html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"));
  assert.ok(!html.includes('<img src=x onerror="alert(1)">'));
  assert.ok(html.includes("Not a target FPS"));
});

test("P3 CLI writes byte-stable single-run JSON/HTML, rejects invalid manifests and path escapes",async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),"talarion-review-"));
  try{
    await fs.writeFile(path.join(root,"talarion.config.json"),"{}");
    const item=entry("single");
    await fs.writeFile(path.join(root,"authority.json"),item.body);
    const execute=(...args)=>spawnSync(process.execPath,[CLI,...args,"--json"],
      {cwd:root,encoding:"utf8"});
    const first=execute("budget","report","current","authority.json","out");
    assert.equal(first.status,0,first.stderr);
    assert.equal(JSON.parse(first.stdout).decision,"evidence-only");
    const json=path.join(root,"out/performance-review.json"),
      html=path.join(root,"out/performance-review.html");
    const firstJson=await fs.readFile(json,"utf8");
    const firstHtml=await fs.readFile(html,"utf8");
    assert.equal(execute("budget","report","current","authority.json","out").status,0);
    assert.equal(await fs.readFile(json,"utf8"),firstJson);
    assert.equal(await fs.readFile(html,"utf8"),firstHtml);
    assert.equal(execute("budget","report","current","authority.json","../escape").status,1);
    assert.equal(execute("budget","report","current","authority.json",".").status,1);
    const manifest={
      schema:"talarion.performance-cohorts/v1",policy,
      cohorts:{
        web:{baseline:[],candidate:[{file:"authority.json",sha256:item.sha256,
          runId:"run-web",environmentKey:"ci-web"}]},
        android:{baseline:[],candidate:[{file:"authority.json",sha256:item.sha256,
          runId:"run-android",environmentKey:"ci-android"}]}
      }
    };
    await fs.writeFile(path.join(root,"cohorts.json"),JSON.stringify(manifest));
    const multi=execute("budget","report","cohorts.json","cohort-report");
    assert.equal(multi.status,0,multi.stderr);
    manifest.cohorts.web.candidate[0].sha256=sha("changed");
    await fs.writeFile(path.join(root,"cohorts.json"),JSON.stringify(manifest));
    const bad=execute("budget","report","cohorts.json","bad-report");
    assert.equal(bad.status,1);
    assert.match(JSON.parse(bad.stdout).error,/SHA-256/i);
    await fs.symlink(path.join(root,"out"),path.join(root,"linked"));
    assert.equal(execute("budget","report","current","authority.json","linked/x").status,1);
  }finally{await fs.rm(root,{recursive:true,force:true})}
});


test("P3 CLI processes six distinct pinned cohort files, blocks degradation and is order-invariant",async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),"talarion-cohorts-"));
  try {
    await fs.writeFile(path.join(root,"talarion.config.json"),"{}");
    const baselines=["b1","b2","b3"].map(tag=>entry(tag,64,42));
    const candidates=["c1","c2","c3"].map(tag=>entry(tag,40,21));
    for(const e of [...baselines,...candidates])
      await fs.writeFile(path.join(root,e.runId+".json"),e.body);
    const items=(records,target)=>records.map(e=>({
      runId:target+"-"+e.runId,environmentKey:"fixed-linux-amd64",
      file:e.runId+".json",sha256:e.sha256
    }));
    const manifest={schema:"talarion.performance-cohorts/v1",policy,
      cohorts:Object.fromEntries(["web","android"].map(target=>[
        target,{baseline:items(baselines,target),candidate:items(candidates,target)}
      ]))};
    const file=path.join(root,"cohorts.json");
    await fs.writeFile(file,JSON.stringify(manifest));
    const command=()=>spawnSync(process.execPath,[
      CLI,"budget","report","cohorts.json","out","--json"
    ],{cwd:root,encoding:"utf8"});
    const result=command();
    assert.equal(result.status,1);
    const review=JSON.parse(await fs.readFile(path.join(root,"out/performance-review.json")));
    assert.equal(review.decision,"blocked-observational-degradation");
    assert.ok(review.targets.every(t=>t.regression.status==="regression-observed"));
    const html=await fs.readFile(path.join(root,"out/performance-review.html"),"utf8");
    assert.ok(html.includes("observed-degradation"));
    const snapshot=JSON.stringify(review);
    for(const t of ["web","android"]){
      manifest.cohorts[t].baseline.reverse();
      manifest.cohorts[t].candidate.reverse();
    }
    await fs.writeFile(file,JSON.stringify(manifest));
    assert.equal(command().status,1);
    assert.equal(JSON.stringify(JSON.parse(await fs.readFile(
      path.join(root,"out/performance-review.json")))),snapshot);
  }finally {await fs.rm(root,{recursive:true,force:true})}
});
