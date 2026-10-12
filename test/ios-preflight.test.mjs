import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { assessIosPreflight, IOS_PREFLIGHT_SCHEMA } from "../src/ios/preflight.mjs";
const CLI=fileURLToPath(new URL("../bin/talarion.mjs",import.meta.url));
const projectText='[rendering]\nrenderer/rendering_method="gl_compatibility"\nrenderer/rendering_method.mobile="gl_compatibility"\n';
const goodPreset='[preset.0]\nname="Web"\nplatform="Web"\n[preset.0.options]\n\n[preset.1]\nname="iOS"\nplatform="iOS"\n[preset.1.options]\n';
const config={ios:{preset:"iOS",bundleIdentifier:"dev.talarion.ruinslite",
  appStoreTeamId:"A1B2C3D4E5"}};
const tools={xcode:true,xcodeSelect:true,iphoneosSdk:true,
  iphonesimulatorSdk:true,godot:true};
const assess=(extra={})=>assessIosPreflight({
  config,hostPlatform:"darwin",tools,presetText:goodPreset,projectText,...extra
});
const check=(out,id)=>out.checks.find(x=>x.id===id)?.status;

test("TL03-P0 detects full macOS prerequisites but never claims iOS export/Apple evidence",()=>{
  const p=assess();
  assert.equal(p.schema,IOS_PREFLIGHT_SCHEMA);
  assert.equal(p.ok,true);
  assert.equal(p.status,"prerequisites-detected");
  assert.equal(p.prerequisitesObserved,true);
  assert.deepEqual(p.checks.map(x=>x.status),
    [...Array(9).fill("pass"),"unverified","unverified"]);
  for(const field of ["exportReady","exportAttempted","appSigned",
    "simulatorRuntimeObserved","physicalDeviceRuntimeObserved",
    "simulatorCertified","physicalDeviceCertified","parityCertified"])
    assert.equal(p[field],false,field);
  assert.equal(p.hostClass,"macos");
});

test("TL03-P0 Linux is blocked even if all other host/toolchain flags are spoofed",()=>{
  const p=assess({hostPlatform:"linux"});
  assert.equal(p.status,"blocked");
  assert.equal(check(p,"IOS-01"),"blocked");
  assert.equal(p.hostClass,"linux-unsupported-for-export");
  assert.equal(p.exportReady,false);
  const windows=assess({hostPlatform:"win32"});
  assert.equal(windows.status,"blocked");
  assert.equal(windows.hostClass,"windows-unsupported-for-export");
});

test("TL03-P0 rejects missing Xcode, SDK, Godot, team, bundle and iOS preset",()=>{
  const samples=[
    [{tools:{...tools,xcode:false}},"IOS-02"],
    [{tools:{...tools,xcodeSelect:false}},"IOS-02"],
    [{tools:{...tools,iphoneosSdk:false}},"IOS-03"],
    [{tools:{...tools,iphonesimulatorSdk:false}},"IOS-04"],
    [{tools:{...tools,godot:false}},"IOS-05"],
    [{presetText:'[preset.0]\nname="iOS"\nplatform="Android"\n'},"IOS-06"],
    [{presetText:null},"IOS-06"],
    [{config:{ios:{...config.ios,bundleIdentifier:"bad bundle"}}},"IOS-07"],
    [{config:{ios:{...config.ios,bundleIdentifier:"dev"}}},"IOS-07"],
    [{config:{ios:{...config.ios,appStoreTeamId:null}}},"IOS-08"],
    [{config:{ios:{...config.ios,appStoreTeamId:"unsafe-signing-secret"}}},"IOS-08"]
  ];
  for(const [override,id] of samples) {
    const p=assess(override);
    assert.equal(p.status,"blocked",id);
    assert.equal(check(p,id),"blocked");
    assert.equal(p.exportReady,false);
    assert.equal(p.parityCertified,false);
  }
});

test("TL03-P0 simulator requires Compatibility renderer, never infer from Mobile/Vulkan",()=>{
  const projectVariants=[
    "",'[rendering]\nrenderer/rendering_method="gl_compatibility"',
    '[rendering]\nrenderer/rendering_method="gl_compatibility"\nrenderer/rendering_method.mobile="gl_compatibility"',
    '[rendering]\nrenderer/rendering_method="gl_compatibility"\nrenderer/rendering_method.mobile="gl_compatibility"'
  ];
  assert.equal(check(assess({projectText:projectVariants[0]}),"IOS-09"),"blocked");
  assert.equal(check(assess({projectText:projectVariants[1]}),"IOS-09"),"pass");
  assert.equal(check(assess({projectText:'[rendering]\nrenderer/rendering_method="gl_compatibility"\nrenderer/rendering_method.mobile="gl_compatibility"'}),"IOS-09"),"pass");
  assert.equal(check(assess({projectText:'[rendering]\nrenderer/rendering_method="gl_compatibility"\nrenderer/rendering_method.mobile="gl_compatibility"\n'}),"IOS-09"),"pass");
  assert.equal(check(assess({projectText:'[rendering]\nrenderer/rendering_method="gl_compatibility"\nrenderer/rendering_method.mobile="gl_compatibility"'}),"IOS-09"),"pass");
  assert.equal(check(assess({projectText:'[rendering]\nrenderer/rendering_method="gl_compatibility"\nrenderer/rendering_method.mobile="gl_compatibility"\n'}),"IOS-09"),"pass");
  assert.equal(check(assess({projectText:'[rendering]\nrenderer/rendering_method="gl_compatibility"\nrenderer/rendering_method.mobile="gl_compatibility"'}),"IOS-09"),"pass");
  assert.equal(check(assess({projectText:'[rendering]\nrenderer/rendering_method="gl_compatibility"\nrenderer/rendering_method.mobile="gl_compatibility"\n'}),"IOS-09"),"pass");
  assert.equal(check(assess({projectText:'[rendering]\nrenderer/rendering_method="gl_compatibility"\nrenderer/rendering_method.mobile="gl_compatibility"'}),"IOS-09"),"pass");
  assert.equal(check(assess({projectText:'[rendering]\nrenderer/rendering_method="gl_compatibility"\nrenderer/rendering_method.mobile="gl_compatibility"\n'}),"IOS-09"),"pass");
  assert.equal(check(assess({projectText:'[rendering]\nrenderer/rendering_method="gl_compatibility"\nrenderer/rendering_method.mobile="gl_compatibility"'}),"IOS-09"),"pass");
  assert.equal(check(assess({projectText:'[rendering]\nrenderer/rendering_method="gl_compatibility"\nrenderer/rendering_method.mobile="gl_compatibility"\n'}),"IOS-09"),"pass");
  assert.equal(check(assess({projectText:'[rendering]\nrenderer/rendering_method="gl_compatibility"\nrenderer/rendering_method.mobile="gl_compatibility"'}),"IOS-09"),"pass");
});

test("TL03-P0 CLI exports deterministic blocked report on Linux and refuses unsafe output",async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),"talarion-ios-"));
  try {
    const project=path.join(root,"game");
    await fs.mkdir(project);
    await fs.writeFile(path.join(root,"talarion.config.json"),
      JSON.stringify({project:{path:"game",engine:"godot"},ios:{
        preset:"iOS",bundleIdentifier:"dev.talarion.ruinslite",appStoreTeamId:null
      },toolchain:{godot:"talarion-nonexistent-godot-executable"}}));
    await fs.writeFile(path.join(project,"project.godot"),projectText);
    await fs.writeFile(path.join(project,"export_presets.cfg"),
      '[preset.0]\nname="Web"\nplatform="Web"\n');
    const run=out=>spawnSync(process.execPath,[CLI,"ios","preflight",out,"--json"],
      {cwd:root,encoding:"utf8"});
    const a=run("artifacts/ios/preflight.json");
    assert.equal(a.status,0,a.stderr);
    const result=JSON.parse(a.stdout);
    assert.equal(result.status,"blocked");
    assert.equal(result.ok,true);
    assert.equal(result.exportReady,false);
    assert.equal(result.exportAttempted,false);
    assert.equal(result.simulatorCertified,false);
    const file=path.join(root,"artifacts/ios/preflight.json");
    const first=await fs.readFile(file,"utf8");
    assert.equal(run("artifacts/ios/preflight.json").status,0);
    assert.equal(await fs.readFile(file,"utf8"),first);
    assert.equal(run("../outside.json").status,1);
    assert.equal(run(".").status,1);
    await fs.symlink(path.join(root,"artifacts/ios"),path.join(root,"shortcut"));
    assert.equal(run("shortcut/through.json").status,1);
  } finally {await fs.rm(root,{recursive:true,force:true})}
});
