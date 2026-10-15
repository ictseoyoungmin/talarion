import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { auditGooglePlayContract } from "../src/play/preflight.mjs";

const when=new Date("2026-10-15T00:00:00+09:00");
const sources=async()=>Promise.all([
  fs.readFile("examples/play-submission.mobile.json","utf8").then(JSON.parse),
  fs.readFile("docs/development/policies/google-play-2026-08-31.json","utf8").then(JSON.parse)
]);
const clone=x=>structuredClone(x);
const failures=x=>x.checks.filter(c=>c.status==="fail").map(c=>c.id);

test("Play static contract passes only as external-authority blocked",async()=>{
  const [c,p]=await sources();
  const r=auditGooglePlayContract(c,p,{now:when});
  assert.equal(r.ok,true,JSON.stringify(failures(r)));
  assert.equal(r.checks.length,12);
  assert.equal(r.status,"blocked-by-external-account");
  for(const key of ["submissionReady","playApproved","playPublished","productionSigningVerified","physicalDeviceCertified"])
    assert.equal(r[key],false,key);
  assert.equal(r.externalRequired.length,6);
});

test("Play policy fails API35, unsupported targets and stale/future snapshots",async()=>{
  const [c,p]=await sources();
  for(const sdk of [34,35]){
    const d=clone(c);d.application.targetSdk=sdk;
    assert.ok(failures(auditGooglePlayContract(d,p,{now:when})).includes("PC005"));
  }
  const tv=clone(c);tv.application.deviceCategory="android-tv";
  assert.ok(failures(auditGooglePlayContract(tv,p,{now:when})).includes("PC005"));
  for(const modified of [
    {...p,reviewedOn:"2026-03-01"},
    {...p,reviewedOn:"2026-11-01"},
    {...p,sourceUrl:"https://example.invalid"},
    {...p,effectiveFrom:"2027-01-01"}
  ])assert.ok(failures(auditGooglePlayContract(c,modified,{now:when})).includes("PC004"));
});

test("Play update contract requires strictly increasing previous versionCode",async()=>{
  const [c,p]=await sources();
  for(const prev of [null,2,3,"1"]){
    const d=clone(c);d.submission="update";d.application.previousPublishedVersionCode=prev;
    assert.ok(failures(auditGooglePlayContract(d,p,{now:when})).includes("PC007"));
  }
  c.submission="update";c.application.previousPublishedVersionCode=1;
  assert.equal(auditGooglePlayContract(c,p,{now:when}).ok,true);
});

test("Play contract rejects self issued approval and unknown inputs",async()=>{
  const [c,p]=await sources();
  for(const [key,edit] of [
    ["PC002",d=>d.application.packageId="bad"],
    ["PC009",d=>d.application.requestedPermissions=["android.permission.INTERNET","android.permission.INTERNET"]],
    ["PC011",d=>d.playApproved=true],
    ["PC011",d=>d.artifact.privateKey="forbidden"],
    ["PC012",d=>d.application.unrecognized="unknown"],
    ["PC010",d=>delete d.declarations.dataSafety],
    ["PC008",d=>d.artifact.format="apk"]
  ]){
    const d=clone(c);edit(d);
    assert.ok(failures(auditGooglePlayContract(d,p,{now:when})).includes(key),key);
  }
});

test("Play standalone CLI is read-only and never claims publication",()=>{
  const run=spawnSync(process.execPath,["bin/talarion.mjs","play","preflight",
    "examples/play-submission.mobile.json","--json"],{encoding:"utf8"});
  assert.equal(run.status,0,run.stderr||run.stdout);
  const r=JSON.parse(run.stdout);
  assert.equal(r.ok,true);
  assert.equal(r.status,"blocked-by-external-account");
  assert.equal(r.playPublished,false);
});
