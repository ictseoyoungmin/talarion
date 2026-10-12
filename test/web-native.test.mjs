import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { createGame,move,snapshot,BEACONS } from "../examples/web-native/simulation.mjs";
import { inspectWebNative,createWebNativeServer, WEB_INSPECTION_SCHEMA } from "../src/web-native/runtime.mjs";

const REF=path.resolve("examples/web-native");
const failed=(r,id)=>r.checks.some(c=>c.id===id&&c.status==="fail");

test("the Web-native source is a separate Three.js game and manifest preflight does not certify runtime",async()=>{
  const r=await inspectWebNative(REF);
  assert.equal(r.schema,WEB_INSPECTION_SCHEMA);
  assert.equal(r.ok,true,JSON.stringify(r.checks.filter(x=>x.status==="fail")));
  assert.equal(r.manifest.engine,"three");
  assert.equal(r.manifest.id,"signal-garden");
  assert.equal(r.runtimeObserved,false);
  assert.equal(r.androidRuntimeObserved,false);
  assert.equal(r.releaseCertified,false);
});

test("replay movement and beacon collection are deterministic and engine independent",async()=>{
  const r=JSON.parse(await fs.readFile(path.join(REF,"replay.json"),"utf8"));
  const g=createGame();
  for(let tick=1;tick<=320;tick++){
    g.tick=tick;
    for(const e of r.events.filter(e=>e.tick===tick&&e.type==="move"))
      assert.equal(move(g,e.dx,e.dz),true);
  }
  assert.equal(g.mode,"VICTORY");
  assert.equal(g.collected.length,BEACONS.length);
  assert.deepEqual(snapshot(g),{tick:320,entity:"player",state:"VICTORY",
    position:[2,0,1],collected:3,collectedIds:[0,1,2],moves:9});
  assert.equal(move(g,999,0),false);
});

test("bad capability, replay identity and source traversal block preflight",async()=>{
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),"talarion-wf01-"));
  try {
    const files=["talarion.web.json","index.html","style.css","game.mjs","simulation.mjs","replay.json"];
    await Promise.all(files.map(file=>fs.copyFile(path.join(REF,file),path.join(temp,file))));
    const manifestFile=path.join(temp,"talarion.web.json"),replayFile=path.join(temp,"replay.json");
    const manifest=JSON.parse(await fs.readFile(manifestFile,"utf8"));
    manifest.requirements.push("webxr-unsupported");
    await fs.writeFile(manifestFile,JSON.stringify(manifest));
    assert.ok(failed(await inspectWebNative(temp),"WN005"));
    manifest.requirements.pop();manifest.sources.push("../escape.txt");
    await fs.writeFile(manifestFile,JSON.stringify(manifest));
    assert.ok(failed(await inspectWebNative(temp),"WN003"));
    manifest.sources.pop();await fs.writeFile(manifestFile,JSON.stringify(manifest));
    const replay=JSON.parse(await fs.readFile(replayFile,"utf8"));
    replay.gameId="wrong-game";await fs.writeFile(replayFile,JSON.stringify(replay));
    assert.ok(failed(await inspectWebNative(temp),"WN007"));
    await fs.rm(path.join(temp,"game.mjs"));await fs.symlink(path.join(REF,"game.mjs"),path.join(temp,"game.mjs"));
    assert.ok(failed(await inspectWebNative(temp),"WN004"));
  } finally {await fs.rm(temp,{recursive:true,force:true})}
});

test("the Web-native server allows explicitly listed game assets only",async(t)=>{
  const inspection=await inspectWebNative(REF);
  assert.equal(inspection.ok,true);
  if(!(await fs.stat(path.resolve("node_modules/three/package.json")).catch(()=>null))){
    t.skip("Pinned Three.js package not installed in static-only Node job");
    return;
  }
  const server=await createWebNativeServer(inspection);
  try{
    const root=await fetch(server.url);
    assert.equal(root.status,200);
    assert.match(await root.text(),/SIGNAL GARDEN/);
    const vendor=await fetch(server.url+"__talarion/three.module.js");
    assert.equal(vendor.status,200);
    assert.ok((await vendor.text()).length>100000);
    const core=await fetch(server.url+"__talarion/three.core.js");
    assert.equal(core.status,200);
    assert.ok((await core.text()).length>100000);
    assert.equal((await fetch(server.url+"../../package.json")).status,404);
    assert.equal((await fetch(server.url+"talarion.web.json")).status,200);
    assert.equal((await fetch(server.url+"no-such-file.txt")).status,404);
  }finally{await server.close()}
});

test("agent CLI inspect works without Godot and without installed Three.js",()=>{
  const a=spawnSync(process.execPath,["bin/talarion.mjs","web-native","inspect","examples/web-native","--json"],{
    cwd:process.cwd(),encoding:"utf8"
  });
  assert.equal(a.status,0,a.stderr);
  const r=JSON.parse(a.stdout);
  assert.equal(r.ok,true);
  assert.equal(r.runtimeObserved,false);
  const b=spawnSync(process.execPath,["bin/talarion.mjs","web-native","inspect","examples/ruins-lite","--json"],{
    cwd:process.cwd(),encoding:"utf8"
  });
  assert.equal(b.status,1,b.stderr);
  assert.equal(JSON.parse(b.stdout).ok,false);
});
