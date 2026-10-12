import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { loadConfig } from "../src/core/config.mjs";
import { resolveAdapterExecution, ADAPTER_DISPATCH_SCHEMA } from "../src/adapters/dispatch.mjs";
import { build } from "../src/commands/build.mjs";
import { testTargetCommand } from "../src/commands/test-target.mjs";
import { exportGodot } from "../src/adapters/godot.mjs";
import { runWeb } from "../src/runners/web.mjs";
import { runAndroid } from "../src/runners/android.mjs";

const config = () => loadConfig(process.cwd());
const manifest = async () => JSON.parse(await fs.readFile(new URL("../src/adapters/godot.manifest.json", import.meta.url), "utf8"));
const failed = (result, id) => result.report.checks.some(c => c.id === id && !c.ok);

test("Godot Web and Android dispatch bind the actual exported runtime handlers", async () => {
  const c = await config();
  for (const [target, runner] of [["web", runWeb], ["android", runAndroid]]) {
    const binding = await resolveAdapterExecution(c, target);
    assert.equal(binding.report.schema, ADAPTER_DISPATCH_SCHEMA);
    assert.equal(binding.report.ok, true, JSON.stringify(binding.report.checks));
    assert.equal(binding.handlers.exportProject, exportGodot);
    assert.equal(binding.handlers.runTarget, runner);
    assert.equal(binding.report.authority, "validated-source-binding-only");
    assert.equal(binding.report.runtimeObserved, false);
    assert.equal(binding.report.hardwareCertified, false);
  }
});

test("iOS and unrecognized targets are blocked before attempting exports or runners", async () => {
  const c = await config();
  for (const target of ["ios", "unity", "switch"]) {
    const binding = await resolveAdapterExecution(c, target);
    assert.equal(binding.report.ok, false);
    assert.equal(binding.handlers, null);
    assert.ok(failed(binding, "AD001"));
    assert.ok(failed(binding, "AD002"));
    assert.equal((await build(c, target)).status, "blocked");
    const t = await testTargetCommand(c, target);
    assert.equal(t.ok, false);
    assert.equal(t.build.status, "blocked");
  }
});

test("different configured engine cannot reach Godot export or runner", async () => {
  const c = await config();
  const changed = { ...c, project: { ...c.project, engine: "unity" } };
  const r = await resolveAdapterExecution(changed, "web");
  assert.equal(r.report.ok, false);
  assert.equal(r.handlers, null);
  assert.equal((await build(changed, "web")).status, "blocked");
});

test("tampered module path, missing profile and unsupported capability reject dispatch", async () => {
  const c = await config();
  const source = await manifest();
  for (const mutation of [
    m => { m.targets.web.entrypoints.runner = "src/runners/android.mjs"; },
    m => { m.targets.web.capabilities.replay = "unknown"; },
    m => { m.targets.web.status = "unknown"; }
  ]) {
    const tampered = structuredClone(source);
    mutation(tampered);
    const r = await resolveAdapterExecution(c, "web", { manifest: tampered });
    assert.equal(r.report.ok, false);
    assert.equal(r.handlers, null);
  }
  const swapped = structuredClone(source);
  swapped.targets.web.entrypoints.runner = "src/runners/android.mjs";
  const r = await resolveAdapterExecution(c, "web", {manifest: swapped});
  assert.ok(failed(r, "AD003"));
  const badConfig = { ...c, targets: {
    ...c.targets, web: { ...c.targets.web, profile: "missing" }
  }};
  const invalid = await resolveAdapterExecution(badConfig, "web");
  assert.equal(invalid.report.ok, false);
  assert.equal(invalid.handlers, null);
});

test("dispatcher never treats manifest binding as observed gameplay or hardware proof", async () => {
  const c = await config();
  const a = await resolveAdapterExecution(c, "android");
  assert.equal(a.report.runtimeObserved, false);
  assert.equal(a.report.parityCertified, false);
  assert.equal(a.report.hardwareCertified, false);
  assert.equal(a.report.inspection.engineVersionObserved, false);
});
