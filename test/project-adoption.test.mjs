import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { loadConfig } from "../src/core/config.mjs";
import { inspectProjectAdoption, PROJECT_ADOPTION_SCHEMA } from "../src/commands/project-inspect.mjs";

const cfg = () => loadConfig(process.cwd());
const fails = (r,id) => r.checks.some(c => c.id === id && c.status === "fail");

test("the current Ruins Lite sample meets static adoption prerequisites only", async () => {
  const config = await cfg();
  const result = await inspectProjectAdoption(config);
  assert.equal(result.schema,PROJECT_ADOPTION_SCHEMA);
  assert.equal(result.ok,true,JSON.stringify(result.checks.filter(c=>c.status==="fail")));
  assert.equal(result.readiness,"static-prerequisites-detected");
  for(const flag of ["runtimeObserved","independentProjectVerified","parityCertified","hardwareCertified"]) {
    assert.equal(result[flag],false);
  }
  assert.ok(result.limitations.some(x => x.id === "TA-L01"));
});

test("missing project, path traversal and unknown engine fail closed", async () => {
  const c = await cfg();
  const cases=[
    [{...c, project:{...c.project,path:"../../external"}}, "TA001"],
    [{...c, project:{...c.project,path:"examples/missing"}}, "TA001"]
  ];
  for(const [sample,id] of cases) {
    const r=await inspectProjectAdoption(sample);
    assert.equal(r.ok,false);
    assert.ok(fails(r,id));
  }
});

test("alternate Godot project is checked without exports, mutations or fabricated parity", async () => {
  const c = await cfg();
  const dir = await fs.mkdtemp(path.join(c.root,"artifacts","tl05-project-"));
  const project=path.join(dir,"different-game");
  await fs.mkdir(project);
  const original=path.join(c.root,"examples","ruins-lite");
  const copy=async name=>fs.copyFile(path.join(original,name),path.join(project,name));
  try {
    await Promise.all(["project.godot","export_presets.cfg","talarion_bridge.gd","main.tscn"].map(copy));
    const external={...c,project:{...c.project,name:"different-game",path:path.relative(c.root,project)}};
    let result=await inspectProjectAdoption(external);
    assert.equal(result.ok,true,JSON.stringify(result.checks.filter(x=>x.status==="fail")));
    assert.equal(result.independentProjectVerified,false);
    await fs.rm(path.join(project,"main.tscn"));
    result=await inspectProjectAdoption(external);
    assert.ok(fails(result,"TA012"));
    await copy("main.tscn");

    const presetFile=path.join(project,"export_presets.cfg");
    const presets=await fs.readFile(presetFile,"utf8");
    await fs.writeFile(presetFile,presets.replace('package/unique_name="dev.talarion.ruinslite"','package/unique_name="dev.example.different"'));
    result=await inspectProjectAdoption(external);
    assert.ok(fails(result,"TA008"));
    await fs.writeFile(presetFile,presets.replace('include_filter="talarion_runtime/*.json"','include_filter=""'));
    result=await inspectProjectAdoption(external);
    assert.ok(fails(result,"TA007-web"));
    await fs.writeFile(presetFile,presets);
    await fs.writeFile(path.join(project,"project.godot"),"[application]\nrun/main_scene=\"res://main.tscn\"\n");
    result=await inspectProjectAdoption(external);
    assert.ok(fails(result,"TA004"));
    const altered={...external,replay:{...c.replay,stagedResource:"wrong/replay.json"}};
    result=await inspectProjectAdoption(altered);
    assert.ok(fails(result,"TA005"));
  } finally {
    await fs.rm(dir,{recursive:true,force:true});
  }
});

test("invalid replay and unsafe output fail structured checks",async()=>{
  const c=await cfg();
  const wrongEngine={...c,project:{...c.project,engine:"unity"}};
  assert.ok(fails(await inspectProjectAdoption(wrongEngine),"TA011"));
  const badReplay={...c,replay:{...c.replay,default:"fixtures/replay/absent.json"}};
  assert.ok(fails(await inspectProjectAdoption(badReplay),"TA010"));
  const badOutput={...c,targets:{...c.targets,web:{...c.targets.web,output:"../../outside.html"}}};
  assert.ok(fails(await inspectProjectAdoption(badOutput),"TA009-web"));
});

test("project inspect CLI emits machine-readable non-certifying report",()=>{
  const cmd=spawnSync(process.execPath,["bin/talarion.mjs","project","inspect","--json"],{cwd:process.cwd(),encoding:"utf8"});
  assert.equal(cmd.status,0,cmd.stderr);
  const r=JSON.parse(cmd.stdout);
  assert.equal(r.ok,true);
  assert.equal(r.runtimeObserved,false);
  assert.equal(r.independentProjectVerified,false);
});
