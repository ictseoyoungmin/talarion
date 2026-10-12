import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../src/core/config.mjs";
import { ADAPTER_CAPABILITIES, ADAPTER_INSPECTION_SCHEMA,
  assessAdapterManifest, inspectAdapterCommand } from "../src/adapters/manifest.mjs";
import { verifyCommand } from "../src/commands/verify.mjs";

const CLI = fileURLToPath(new URL("../bin/talarion.mjs", import.meta.url));
const SOURCE = new URL("../src/adapters/godot.manifest.json", import.meta.url);
const load = () => fs.readFile(SOURCE, "utf8").then(JSON.parse);
const fails = (r,id) => r.checks.some(c => c.id===id && c.status==="fail");

test("Godot manifest binds only Web and Android to declared source implementations",async()=>{
  const config=await loadConfig(process.cwd());
  const m=await load();
  const r=await inspectAdapterCommand(config);
  assert.equal(r.ok,true,JSON.stringify(r.checks.filter(c=>c.status==="fail")));
  assert.equal(r.schema,ADAPTER_INSPECTION_SCHEMA);
  assert.deepEqual(r.selectedTargets,["android","web"]);
  assert.deepEqual(r.targets.map(x=>x.target),["android","ios","web"]);
  for(const target of ["web","android"]) {
    const t=r.targets.find(x=>x.target===target);
    assert.equal(t.status,"supported");
    assert.deepEqual(Object.keys(t.capabilities).sort(),[...ADAPTER_CAPABILITIES].sort());
    assert.ok(Object.values(t.capabilities).every(x=>x==="supported"));
    assert.equal(r.checks.filter(x=>x.target===target&&x.id==="AM030"&&x.status==="pass").length,2);
  }
  assert.equal(r.targets.find(x=>x.target==="ios").status,"unsupported");
  assert.equal(assessAdapterManifest(m,config).ok,true);
  assert.equal(r.authority,"static-interface-declaration");
  assert.equal(r.engineVersionObserved,false);
  assert.equal(r.runtimeObserved,false);
  assert.equal(r.parityCertified,false);
  assert.equal(r.hardwareCertified,false);
});

test("unconfigured, unknown and deferred targets fail closed",async()=>{
  const config=await loadConfig(process.cwd());
  for(const target of ["ios","switch"]) {
    const r=await inspectAdapterCommand(config,target);
    assert.equal(r.ok,false);
    assert.ok(fails(r,"AM020"));
    assert.equal(r.runtimeObserved,false);
  }
});

test("malformed manifest, mismatched engine and authority never pass",async()=>{
  const config=await loadConfig(process.cwd()),m=await load();
  for(const bad of [
    {...m,schema:"talarion.adapter-manifest/v999"},
    {...m,authority:"hardware-certified"},
    {...m,engine:{...m.engine,id:"unity"}},
    {...m,targets:null},
    null
  ]) assert.equal(assessAdapterManifest(bad,config).ok,false);
});

test("missing, contradictory, invalid and unknown capability declarations fail",async()=>{
  const config=await loadConfig(process.cwd()),m=await load();
  for(const edit of [
    x=>{delete x.targets.web.capabilities.visual;},
    x=>{x.targets.web.capabilities.visual="yes";},
    x=>{x.targets.web.capabilities.future="supported";},
    x=>{x.targets.ios.capabilities.export="supported";},
    x=>{x.targets.web.status="unknown";},
    x=>{x.targets.web.entrypoints.runner="../outside.mjs";}
  ]) {
    const x=structuredClone(m);edit(x);
    assert.equal(assessAdapterManifest(x,config).ok,false);
  }
});

test("missing profile and missing runner entrypoint fail without runtime invocation",async()=>{
  const config=await loadConfig(process.cwd()),m=await load();
  const profile=structuredClone(config); profile.targets.web.profile="unconfigured";
  assert.ok(fails(assessAdapterManifest(m,profile),"AM021"));
  const bad=structuredClone(m);
  bad.targets.web.entrypoints.runner="src/runners/missing.mjs";
  const r=await inspectAdapterCommand(config,"web",{manifest:bad});
  assert.equal(r.ok,false); assert.ok(fails(r,"AM030"));
});

test("agent CLI JSON status cannot self-certify iOS",()=>{
  const a=spawnSync(process.execPath,[CLI,"adapter","inspect","--json"],{cwd:process.cwd(),encoding:"utf8"});
  assert.equal(a.status,0,a.stderr);
  assert.equal(JSON.parse(a.stdout).runtimeObserved,false);
  const b=spawnSync(process.execPath,[CLI,"adapter","inspect","ios","--json"],{cwd:process.cwd(),encoding:"utf8"});
  assert.equal(b.status,1,b.stderr);
  assert.equal(JSON.parse(b.stdout).ok,false);
});

test("verify includes adapter inspection with static-only authority",async()=>{
  const c=await loadConfig(process.cwd());
  const r=await verifyCommand(c);
  assert.equal(r.adapter.schema,ADAPTER_INSPECTION_SCHEMA);
  assert.equal(r.adapter.ok,true);
  assert.equal(r.adapter.runtimeObserved,false);
  assert.match(r.text,/adapter manifest: PASS/);
});
