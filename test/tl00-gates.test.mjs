import test from "node:test";
import assert from "node:assert/strict";
import { assessTl00, assessHardwareCertification } from "../src/runtime/gates.mjs";

const hash = "a".repeat(64);
const sample = () => ({
  web: {
    schema: "talarion.runner-result/v1", target: "web", ok: true, finishedTick: 600,
    provenance: { replaySha256: hash },
    evidence: { performance: { schema: "talarion.performance/v1", target: "web",
      ok: true, sampleCount: 10, fpsMedian: 10, peakMemoryBytes: 50000 } }
  },
  android: {
    schema: "talarion.runner-result/v1", target: "android", ok: true, finishedTick: 600,
    provenance: { replaySha256: hash, apkSha256: "b".repeat(64) },
    device: { schema: "talarion.android-device/v1", isEmulator: true, apiLevel: 30 },
    evidence: { performance: { schema: "talarion.performance/v1", target: "android",
      ok: true, sampleCount: 10, fpsMedian: 4, peakMemoryBytes: 75000 } }
  },
  visual: {
    schema: "talarion.visual-parity/v1", ok: true, expectedCheckpoints: 3,
    passedCheckpoints: 3, results: Array.from({ length: 3 },
      () => ({ ok: true, maxTileError: 0.01 }))
  },
  state: { ok: true, total: 15, matched: 15 },
  replayHash: hash, expectedTick: 600, expectedCaptures: 3
});

test("TL00 can close with actual emulator evidence, without physical certification", () => {
  const result = assessTl00(sample());
  assert.equal(result.ok, true, JSON.stringify(result.checks.filter(x => !x.ok)));
  assert.equal(result.hardwareCertified, false);
});

test("TL00 is fail-closed for missing evidence and cannot be satisfied with empty fixtures", () => {
  assert.equal(assessTl00({}).ok, false);
  const s = sample(); s.state = { ok: true, total: 0, matched: 0 };
  assert.equal(assessTl00(s).ok, false);
  s.state = { ok: true, total: 15, matched: 15 }; s.visual.results[2].ok = false;
  assert.equal(assessTl00(s).ok, false);
  s.visual.results[2].ok = true; s.web.provenance.replaySha256 = "c".repeat(64);
  assert.equal(assessTl00(s).ok, false);
  s.web.provenance.replaySha256 = hash; s.android.evidence.performance.sampleCount = 0;
  assert.equal(assessTl00(s).ok, false);
});

test("a passing emulator does not pass device certification", () => {
  const s = sample();
  assert.equal(assessTl00(s).ok, true);
  const result = assessHardwareCertification({
    device: s.android.device,
    measurements: { reviewed: true, source: "physical-device", budgetPassed: true },
    lifecycle: { passed: true }, compatibility: { passed: true }
  });
  assert.equal(result.ok, false);
  assert.equal(result.hardwareCertified, false);
});

test("release certification requires physical device and independently reviewed measurements", () => {
  const device = { schema: "talarion.android-device/v1", isEmulator: false, apiLevel: 35 };
  assert.equal(assessHardwareCertification({ device }).ok, false);
  const result = assessHardwareCertification({
    device,
    measurements: { reviewed: true, source: "physical-device", budgetPassed: true },
    lifecycle: { passed: true }, compatibility: { passed: true }
  });
  assert.equal(result.ok, true);
});
