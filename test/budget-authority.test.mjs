import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { summarizePerformance } from "../src/runtime/performance.mjs";
import { assessPerformanceAuthority, AUTHORITY_SCHEMA } from "../src/runtime/budget-authority.mjs";
import { assessTl00 } from "../src/runtime/gates.mjs";
import { analyzeBudgetProfile, BUDGET_COVERAGE_SCHEMA, BUDGET_FIELDS } from "../src/runtime/budget-profile.mjs";

const CLI = fileURLToPath(new URL("../bin/talarion.mjs", import.meta.url));
const sha = buffer => createHash("sha256").update(buffer).digest("hex");
const replayHash = sha("same-replay");
const samples = Array.from({ length: 5 }, (_, i) => ({
  tick: (i + 1) * 60, fps: 25 + i * 5,
  processMs: 4 + i, physicsMs: 1 + i * 0.1,
  memoryBytes: 2000000 + i * 1000
}));
const config = {
  targets: { web: { profile: "web-qa" }, android: { profile: "android-low" } },
  profiles: { "web-qa": { targetFps: 60 },
    "android-low": { targetFps: 30, drawCallBudget: 400 } }
};
const make = (deviceType = true) => ({
  config,
  replaySha256: replayHash,
  sampleHashes: { web: sha("web"), android: sha("android") },
  samples: { web: samples, android: samples },
  manifests: {
    web: {
      schema: "talarion.runner-result/v1", ok: true, target: "web",
      browser: "playwright-chromium-headless",
      provenance: { replaySha256: replayHash },
      evidence: { performance: summarizePerformance(samples,
        { target: "web", targetFps: 60, sampleFile: "performance.jsonl" }) }
    },
    android: {
      schema: "talarion.runner-result/v1", ok: true, target: "android",
      device: { schema: "talarion.android-device/v1", isEmulator: deviceType, apiLevel: 30 },
      provenance: { replaySha256: replayHash, apkSha256: sha("apk") },
      evidence: { performance: summarizePerformance(samples,
        { target: "android", targetFps: 30, sampleFile: "performance.jsonl" }) }
    }
  }
});

test("P0 verifies recomputed samples and labels declared vs observed evidence", () => {
  const result = assessPerformanceAuthority(make());
  assert.equal(result.schema, AUTHORITY_SCHEMA);
  assert.equal(result.ok, true, JSON.stringify(result.targets.filter(t => !t.ok)));
  assert.deepEqual(result.targets.map(t => t.runtimeKind),
    ["headless-browser", "android-emulator"]);
  assert.deepEqual(result.targets.map(t => t.observation.status),
    ["validated-runner-observation", "validated-runner-observation"]);
  const android = result.targets[1];
  assert.equal(android.observation.metrics.fpsMedian, 35);
  assert.equal(android.declared.targetFps, 30);
  assert.equal(android.declared.drawCallBudget, 400);
  assert.equal(android.observation.metrics.peakMemoryBytes, 2004000);
  assert.equal(android.budgetDecision, "not-evaluated");
  assert.ok(android.observation.unobserved.includes("drawCalls"));
  assert.equal(result.certification.physicalDevice, false);
  assert.equal(result.certification.targetFps, false);
});

test("P0 never certifies hardware even when Android manifest identifies physical device", () => {
  const evidence = assessPerformanceAuthority(make(false));
  assert.equal(evidence.ok, true);
  assert.equal(evidence.targets[1].runtimeKind, "android-physical-unreviewed");
  assert.equal(evidence.targets[1].hardwareCertified, false);
  assert.equal(evidence.targets[1].budgetDecision, "not-evaluated");
  assert.equal(evidence.certification.physicalDevice, false);
});

test("P0 mismatched summary, falsified samples and provenance fail closed", () => {
  const stale = make();
  stale.manifests.android.evidence.performance.fpsMedian = 9999;
  const a = assessPerformanceAuthority(stale);
  assert.equal(a.ok, false);
  assert.equal(a.targets[1].observation.status, "unverified");
  assert.equal(a.targets[1].observation.metrics, null);
  assert.equal(a.targets[1].checks.find(c => c.id === "PA05").ok, false);
  const bad = make();
  bad.samples.web = [samples[0], samples[0], ...samples.slice(2)];
  assert.equal(assessPerformanceAuthority(bad).targets[0].ok, false);
  const altered = make();
  altered.manifests.web.provenance.replaySha256 = sha("wrong");
  assert.equal(assessPerformanceAuthority(altered).targets[0].checks[1].ok, false);
  const unknown = make();
  unknown.manifests.android.device.isEmulator = null;
  assert.equal(assessPerformanceAuthority(unknown).targets[1].ok, false);
  const missing = make();
  missing.sampleHashes.web = null;
  assert.equal(assessPerformanceAuthority(missing).targets[0].checks[5].ok, false);
});

test("P0 missing raw evidence and invalid profile values cannot become budget PASS", () => {
  const empty = make();
  empty.samples.android = [];
  assert.equal(assessPerformanceAuthority(empty).targets[1].ok, false);
  const noProfile = make();
  noProfile.config = { targets: noProfile.config.targets, profiles: {} };
  const result = assessPerformanceAuthority(noProfile);
  assert.equal(result.ok, false);
  assert.equal(result.targets[0].declared.targetFps, null);
  assert.equal(result.targets[0].budgetDecision, "not-evaluated");
  assert.equal(result.certification.targetFps, false);
});

test("TL00 acceptance remains independent of telemetry target FPS claims", () => {
  const evidence = assessPerformanceAuthority(make());
  assert.equal(evidence.ok, true);
  assert.equal(evidence.targets[0].observation.metrics.fpsP10, 25);
  assert.equal(evidence.targets[0].declared.targetFps, 60);
  assert.equal(evidence.certification.targetFps, false);
  assert.equal(assessTl00({}).ok, false);
});

test("CLI recomputes real JSONL bytes and emits deterministic evidence, rejecting edited manifests", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "talarion-pa-"));
  try {
    const cfg = structuredClone(config);
    cfg.replay = { default: "replay.json" };
    await fs.writeFile(path.join(root, "replay.json"), "same-replay");
    await fs.writeFile(path.join(root, "talarion.config.json"), JSON.stringify(cfg));
    const fixtures = make();
    for (const target of ["web", "android"]) {
      const dir = path.join(root, target);
      await fs.mkdir(dir);
      const p = target === "web" ? 60 : 30;
      fixtures.manifests[target].provenance.replaySha256 = replayHash;
      fixtures.manifests[target].evidence.performance =
        summarizePerformance(samples, {
          target, targetFps: p,
          sampleFile: path.join(dir, "performance.jsonl")
        });
      await fs.writeFile(path.join(dir, "runner-result.json"),
        JSON.stringify(fixtures.manifests[target]));
      await fs.writeFile(path.join(dir, "performance.jsonl"),
        samples.map(x => JSON.stringify(x)).join("\n") + "\n");
    }
    const args = ["budget", "authority", "web", "android", "authority.json", "--json"];
    const run = () => spawnSync(process.execPath, [CLI, ...args], {
      cwd: root, encoding: "utf8"
    });
    const first = run();
    assert.equal(first.status, 0, first.stderr);
    const a = await fs.readFile(path.join(root, "authority.json"), "utf8");
    const parsed = JSON.parse(a);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.targets[1].runtimeKind, "android-emulator");
    assert.equal(parsed.certification.physicalDevice, false);
    assert.equal(run().status, 0);
    assert.equal(await fs.readFile(path.join(root, "authority.json"), "utf8"), a);
    fixtures.manifests.android.evidence.performance.fpsP10 = 900;
    await fs.writeFile(path.join(root, "android/runner-result.json"),
      JSON.stringify(fixtures.manifests.android));
    const changed = run();
    assert.equal(changed.status, 1);
    assert.equal(JSON.parse(await fs.readFile(path.join(root, "authority.json"), "utf8")).ok, false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});


test("P1 fixed metric units never grade an observational FPS result", () => {
  const result = assessPerformanceAuthority(make());
  assert.equal(result.ok, true);
  assert.deepEqual(BUDGET_FIELDS.map(d => [d.field, d.unit]), [
    ["targetFps", "fps"],
    ["processMsP95Budget", "ms"],
    ["peakMemoryBytesBudget", "bytes"],
    ["drawCallBudget", "calls"]
  ]);
  const android = result.targets[1];
  const coverage = android.budgetCoverage;
  assert.equal(coverage.schema, BUDGET_COVERAGE_SCHEMA);
  assert.equal(coverage.ok, true);
  assert.equal(android.checks.length, 8);
  const fps = coverage.metrics.find(m => m.budgetField === "targetFps");
  assert.deepEqual([fps.unit, fps.direction, fps.status, fps.declaredLimit,
    fps.observedValue, fps.comparisonEvaluated, fps.decision],
  ["fps", "minimum", "comparable-not-graded", 30, 25, false, "not-evaluated"]);
  const calls = coverage.metrics.find(m => m.budgetField === "drawCallBudget");
  assert.equal(calls.declaredLimit, 400);
  assert.equal(calls.observedValue, null);
  assert.equal(calls.status, "unobserved");
  assert.equal(coverage.metrics.find(m => m.budgetField === "processMsP95Budget").status,
    "not-declared");
  assert.equal(coverage.compliance, "not-evaluated");
  assert.equal(result.certification.targetFps, false);
  assert.equal(result.certification.drawCalls, false);
  assert.ok(coverage.unobserved.some(x => x.metric === "gpuTextureMemoryBytes"));
});

test("P1 optional measured budgets use exact declared and schema-fixed units, never pass", () => {
  const s = make();
  s.config = structuredClone(config);
  const web = s.config.profiles["web-qa"];
  web.processMsP95Budget = 12.5;
  web.peakMemoryBytesBudget = 4_000_000;
  web.performanceUnits = {
    targetFps: "fps",
    processMsP95Budget: "ms",
    peakMemoryBytesBudget: "bytes"
  };
  const r = assessPerformanceAuthority(s);
  assert.equal(r.ok, true);
  const metrics = r.targets[0].budgetCoverage.metrics;
  assert.deepEqual(metrics.slice(0, 3).map(m => [
    m.status, m.unitSource, m.observedValue, m.declaredLimit
  ]), [
    ["comparable-not-graded", "explicit-validated", 25, 60],
    ["comparable-not-graded", "explicit-validated", 8, 12.5],
    ["comparable-not-graded", "explicit-validated", 2004000, 4000000]
  ]);
  assert.equal(r.targets[0].budgetDecision, "not-evaluated");
});

test("P1 wrong units and invalid numeric profiles fail closed", () => {
  const invalid = [
    { targetFps: 60, performanceUnits: { targetFps: "ms" } },
    { targetFps: 60, performanceUnits: { drawCallBudget: "calls" } },
    { targetFps: 60, performanceUnits: { frameTime: "ms" } },
    { targetFps: 60, performanceUnits: "fps" },
    { targetFps: 60, processMsP95Budget: "8ms" },
    { targetFps: 60, peakMemoryBytesBudget: 10.5 },
    { targetFps: 60, drawCallBudget: 0 },
    { targetFps: 60, drawCallBudget: -20 },
    { targetFps: Number.NaN },
    { targetFps: Infinity },
    { targetFps: "60" },
    { targetFps: true },
    {},
    null,
    []
  ];
  for (const profile of invalid) {
    const result = analyzeBudgetProfile(profile, { fpsP10: 60 }, true);
    assert.equal(result.ok, false, JSON.stringify(profile));
    assert.ok(result.errors.length >= 1);
    assert.ok(result.metrics.every(m => m.comparisonEvaluated === false));
    assert.ok(result.metrics.every(m => m.status === "invalid-profile"));
    assert.equal(result.hardwareCertified, false);
  }
  const s = make(); s.config = structuredClone(config);
  s.config.profiles["web-qa"].performanceUnits = { targetFps: "milliseconds" };
  const bad = assessPerformanceAuthority(s).targets[0];
  assert.equal(bad.ok, false);
  assert.equal(bad.checks.find(x => x.id === "PA08").ok, false);
  assert.equal(bad.budgetCoverage.metrics[0].status, "invalid-profile");
  assert.equal(bad.budgetCoverage.metrics[0].unitSource, "explicit-invalid");
  assert.equal(bad.observation.metrics, null);
  const t = make(); t.config = structuredClone(config);
  t.config.profiles["android-low"].drawCallBudget = 0.2;
  assert.equal(assessPerformanceAuthority(t).targets[1].checks.find(
    x => x.id === "PA07").ok, false);
});

test("P1 unknown and invalid raw evidence cannot become comparable or hardware certified", () => {
  const failed = make();
  failed.manifests.web.evidence.performance.fpsP10 = 9999;
  const r = assessPerformanceAuthority(failed).targets[0];
  assert.equal(r.ok, false);
  assert.equal(r.budgetCoverage.metrics[0].status, "unverified");
  assert.equal(r.budgetCoverage.metrics[0].observedValue, null);

  const s = make(false);
  s.samples.android = samples.map(row => ({ ...row, drawCalls: 7 }));
  const physical = assessPerformanceAuthority(s);
  assert.equal(physical.ok, true);
  assert.equal(physical.targets[1].runtimeKind, "android-physical-unreviewed");
  const drawCalls = physical.targets[1].budgetCoverage.metrics.find(x =>
    x.budgetField === "drawCallBudget");
  assert.equal(drawCalls.status, "unobserved");
  assert.equal(drawCalls.observedValue, null);
  assert.equal(drawCalls.decision, "not-evaluated");
  assert.equal(physical.certification.physicalDevice, false);
});
