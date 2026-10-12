import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../src/core/config.mjs";
import { validateCandidateAdapter, MAX_CANDIDATE_BYTES } from "../src/adapters/candidate.mjs";

const CLI=fileURLToPath(new URL("../bin/talarion.mjs",import.meta.url));
const cfg=()=>loadConfig(process.cwd());
const has=(r,id)=>r.checks.some(c=>c.id===id&&c.status==="fail");

test("reference candidate verifies only source claims",async()=>{
  const c=await cfg(),r=await validateCandidateAdapter(c,"src/adapters/godot.manifest.json");
  assert.equal(r.ok,true,JSON.stringify(r.checks));
  assert.equal(r.authority,"static-candidate-declaration");
  assert.match(r.source.sha256,/^[a-f0-9]{64}$/);
  for(const k of ["runtimeObserved","parityCertified","hardwareCertified"])assert.equal(r[k],false);
});

test("negative fixtures show stable error codes",async()=>{
  const c=await cfg();
  for(const [file,id] of [
    ["fixtures/adapters/malformed.json","AC004"],
    ["fixtures/adapters/unsafe-runner.json","AM013"],
    ["fixtures/adapters/unsupported-engine.json","AM003"]
  ]){
    const r=await validateCandidateAdapter(c,file);
    assert.equal(r.ok,false);
    assert.ok(has(r,id),JSON.stringify(r.checks));
    assert.ok(r.source?.sha256);
  }
});

test("invalid paths, symlinks and oversized inputs fail closed",async()=>{
  const c=await cfg();
  for(const file of ["/etc/passwd","../../out.json","README.md","",null]){
    assert.ok(has(await validateCandidateAdapter(c,file),"AC001"));
  }
  assert.ok(has(await validateCandidateAdapter(c,"fixtures/adapters/missing.json"),"AC002"));
  const dir=await fs.mkdtemp(path.join(c.root,"artifacts","tl04-candidate-"));
  try{
    const link=path.join(dir,"linked.json");
    await fs.symlink(path.join(c.root,"src/adapters/godot.manifest.json"),link);
    assert.ok(has(await validateCandidateAdapter(c,path.relative(c.root,link)),"AC002"));
    const huge=path.join(dir,"huge.json");
    await fs.writeFile(huge," ".repeat(MAX_CANDIDATE_BYTES+1));
    assert.ok(has(await validateCandidateAdapter(c,path.relative(c.root,huge)),"AC003"));
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test("agent CLI returns JSON and nonzero for unsafe or deferred candidate",()=>{
  const run=(file,target)=>spawnSync(process.execPath,
    [CLI,"adapter","validate",file,...(target?[target]:[]),"--json"],
    {cwd:process.cwd(),encoding:"utf8"});
  const good=run("src/adapters/godot.manifest.json");
  assert.equal(good.status,0,good.stderr);
  assert.equal(JSON.parse(good.stdout).runtimeObserved,false);
  for(const file of ["fixtures/adapters/malformed.json","fixtures/adapters/unsafe-runner.json"]){
    const bad=run(file);
    assert.equal(bad.status,1);
    assert.equal(JSON.parse(bad.stdout).ok,false);
  }
  const ios=run("src/adapters/godot.manifest.json","ios");
  assert.equal(ios.status,1);
  assert.equal(JSON.parse(ios.stdout).runtimeObserved,false);
});
