import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { summarizePerformanceWindow, assessObservationalRegression,
  WINDOW_SCHEMA, REGRESSION_SCHEMA } from "../src/runtime/performance-window.mjs";
import { summarizePerformance } from "../src/runtime/performance.mjs";
import { assessPerformanceAuthority } from "../src/runtime/budget-authority.mjs";

const sha = x => createHash("sha256").update(x).digest("hex");
const replaySha256 = sha("canonical-replay");
const windowConfig = { warmupTicks: 120, sampleStepTicks: 60, minSamples: 5 };
const raw = (fps = 60, process = 7) =>
  Array.from({ length: 10 }, (_, i) => ({
    tick: (i + 1) * 60, fps, processMs: process, physicsMs: 1,
    memoryBytes: 4000000 + i * 100
  }));
const summarize = (rows, opts = {}) => summarizePerformanceWindow(rows, {
  window: windowConfig, replayEndTick: 600, replayTickRate: 60,
  evidenceVerified: true, ...opts
});
const cohortRun = (runId, fps, process, environmentKey = "ubuntu-web-ci") => ({
  runId, target: "web", runtimeKind: "headless-browser",
  environmentKey, profile: "web-qa", replaySha256,
  window: summarize(raw(fps, process))
});
const groups = (base, now) => ({
  baseline: base.map((fps, i) => cohortRun("baseline-" + i, fps, 7 + i * 0.1)),
  candidate: now.map((fps, i) => cohortRun("candidate-" + i, fps, 7 + i * 0.1)),
  maxFpsDropPct: 10, maxProcessRisePct: 20
});

test("P2 fixed replay ticks exclude warmup and derive exact window distributions", () => {
  const samples = raw().map((row, i) => ({
    ...row, fps: i < 2 ? 3 : (i + 1) * 5,
    processMs: i < 2 ? 200 : (i + 1)
  }));
  const w = summarize(samples);
  assert.equal(w.schema, WINDOW_SCHEMA);
  assert.equal(w.status, "complete-window");
  assert.equal(w.ok, true);
  assert.equal(w.warmupTicks, 120);
  assert.equal(w.replayEndTick, 600);
  assert.equal(w.replayTickRate, 60);
  assert.equal(w.excludedWarmupCount, 2);
  assert.equal(w.expectedCount, 8);
  assert.equal(w.measuredCount, 8);
  assert.deepEqual(w.expectedTicks, [180, 240, 300, 360, 420, 480, 540, 600]);
  assert.deepEqual(w.measuredTicks, w.expectedTicks);
  assert.equal(w.metrics.fpsP10, 15);
  assert.equal(w.metrics.fpsMedian, 32.5);
  assert.equal(w.metrics.processMsP95, 10);
  assert.equal(w.metrics.peakMemoryBytes, 4000900);
  assert.equal(w.noise.fpsMedianAbsoluteDeviation, 10);
  assert.equal(w.budgetDecision, "not-evaluated");
  assert.equal(w.hardwareCertified, false);
});

test("P2 unknown, sparse, out-of-range, unaligned, duplicated and forged samples fail closed", () => {
  assert.equal(summarize(raw(), { window: null }).status, "not-configured");
  assert.equal(summarize(raw(), { replayEndTick: null }).status, "invalid-window");
  assert.equal(summarize(raw(), { replayTickRate: null }).status, "invalid-window");
  for (const config of [
    { warmupTicks: -1, sampleStepTicks: 60, minSamples: 5 },
    { warmupTicks: 100, sampleStepTicks: 60, minSamples: 5 },
    { warmupTicks: 120, sampleStepTicks: 0, minSamples: 5 },
    { warmupTicks: 600, sampleStepTicks: 60, minSamples: 5 },
    { warmupTicks: 120, sampleStepTicks: 60, minSamples: 2 },
    { warmupTicks: 120, sampleStepTicks: 60, minSamples: "5" }
  ]) {
    const result = summarize(raw(), { window: config });
    assert.equal(result.status, "invalid-window", JSON.stringify(config));
    assert.equal(result.metrics, null);
  }
  const modified = [
    raw().slice(0, -1),
    raw().filter(r => r.tick !== 360),
    [...raw(), { ...raw()[9], tick: 660 }],
    raw().map((r, i) => i === 3 ? { ...r, tick: 241 } : r),
    raw().map((r, i) => i === 3 ? { ...r, tick: 180 } : r),
    raw().map((r, i) => i === 3 ? { ...r, fps: Infinity } : r)
  ];
  for (const rows of modified) {
    const r = summarize(rows);
    assert.notEqual(r.status, "complete-window");
    assert.equal(r.metrics, null);
    assert.equal(r.measuredCount, null);
    assert.equal(r.budgetDecision, "not-evaluated");
  }
  assert.equal(summarize(raw(), { evidenceVerified: false }).status, "unverified");
  assert.equal(summarize(raw().slice(0, 3)).status, "incomplete-window");
});

test("P2 observed window is attached to P0 verified evidence, while budget stays unevaluated", () => {
  const config = {
    replay: { default: "fixtures/replay/tutorial.tlr.json" },
    performanceWindow: windowConfig,
    targets: { web: { profile: "web" }, android: { profile: "low" } },
    profiles: { web: { targetFps: 60 }, low: { targetFps: 30, drawCallBudget: 300 } }
  };
  const source = raw(50, 8);
  const manifests = Object.fromEntries(["web", "android"].map(target => {
    const targetFps = target === "web" ? 60 : 30;
    return [target, {
      schema: "talarion.runner-result/v1", target, ok: true,
      browser: target === "web" ? "playwright-chromium-headless" : undefined,
      device: target === "android"
        ? { schema: "talarion.android-device/v1", isEmulator: true, apiLevel: 30 } : undefined,
      provenance: { replaySha256,
        ...(target === "android" ? { apkSha256: sha("apk") } : {}) },
      evidence: { performance: summarizePerformance(source, {
        target, targetFps, sampleFile: "performance.jsonl"
      }) }
    }];
  }));
  const payload = { config, manifests, samples: { web: source, android: source },
    replaySha256, sampleHashes: { web: sha("web"), android: sha("android") },
    replayEndTick: 600, replayTickRate: 60 };
  const valid = assessPerformanceAuthority(payload);
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.targets.map(x => x.performanceWindow.status),
    ["complete-window", "complete-window"]);
  assert.equal(valid.targets[0].performanceWindow.metrics.fpsMedian, 50);
  assert.equal(valid.targets[0].budgetDecision, "not-evaluated");
  assert.equal(valid.certification.physicalDevice, false);
  const invalid = structuredClone(payload);
  invalid.manifests.web.evidence.performance.fpsMedian = 9999;
  const failure = assessPerformanceAuthority(invalid);
  assert.equal(failure.ok, false);
  assert.equal(failure.targets[0].performanceWindow.status, "unverified");
  assert.equal(failure.targets[0].performanceWindow.metrics, null);
  assert.equal(failure.targets[1].performanceWindow.status, "complete-window");
});

test("P2 regression requires three distinct independent same-environment runs per cohort", () => {
  const s = groups([60, 60, 60], [50, 50, 50]);
  for (const bad of [
    { ...s, candidate: s.candidate.slice(0, 2) },
    { ...s, candidate: [{ ...s.candidate[0], runId: "baseline-0" }, ...s.candidate.slice(1)] },
    { ...s, candidate: s.candidate.map(x => ({ ...x, environmentKey: "different-host" })) },
    { ...s, candidate: s.candidate.map(x => ({ ...x, replaySha256: sha("other") })) },
    { ...s, candidate: s.candidate.map(x => ({
      ...x, window: { ...x.window, status: "incomplete-window", ok: false }
    })) }
  ]) {
    const r = assessObservationalRegression(bad);
    assert.equal(r.status, "not-evaluated");
    assert.notEqual(r.reason, null);
    assert.equal(r.hardwareCertified, false);
  }
  assert.equal(assessObservationalRegression({ ...s,
    maxFpsDropPct: -1 }).reason, "invalid-thresholds");
  assert.equal(assessObservationalRegression({ ...s,
    maxFpsDropPct: NaN }).reason, "invalid-thresholds");
  assert.equal(assessObservationalRegression({ ...s,
    maxFpsDropPct: undefined }).reason, "invalid-thresholds");
  assert.equal(assessObservationalRegression({}).status, "not-evaluated");
});

test("P2 noise-aware regression observes repeatable regressions without device certification", () => {
  const regression = assessObservationalRegression(groups([60, 61, 59], [44, 45, 46]));
  assert.equal(regression.schema, REGRESSION_SCHEMA);
  assert.equal(regression.status, "regression-observed");
  assert.equal(regression.metrics[0].status, "regression-observed");
  assert.equal(regression.hardwareCertified, false);
  assert.equal(regression.observationalOnly, true);
  assert.equal(regression.baselineCount, 3);
  assert.equal(regression.candidateCount, 3);
  assert.equal(assessObservationalRegression(groups(
    [60, 61, 59], [60, 61, 59])).status, "no-regression-observed");
  const noisy = assessObservationalRegression(groups(
    [55, 60, 65], [50, 54, 60]));
  assert.equal(noisy.status, "inconclusive-noise");
  assert.ok(noisy.metrics.some(m => m.status === "inconclusive-noise"));
  const s = groups([60, 60, 60], [60, 60, 60]);
  s.baseline = s.baseline.map(x => ({ ...x, window: {
    ...x.window, metrics: { ...x.window.metrics, processMsP95: 0 }
  } }));
  assert.equal(assessObservationalRegression(s).status, "inconclusive-noise");
});

test("P2 regression is order invariant and does not compare Web against Android", () => {
  const input = groups([61, 60, 59], [52, 51, 50]);
  const before = assessObservationalRegression(input);
  const after = assessObservationalRegression({
    ...input, baseline: [...input.baseline].reverse(),
    candidate: [...input.candidate].reverse()
  });
  assert.deepEqual(before, after);
  const other = { ...input, candidate: input.candidate.map(r => ({
    ...r, target: "android", runtimeKind: "android-emulator"
  })) };
  assert.equal(assessObservationalRegression(other).status, "not-evaluated");
});
