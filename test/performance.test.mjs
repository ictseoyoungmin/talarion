import test from "node:test";
import assert from "node:assert/strict";
import { summarizePerformance } from "../src/runtime/performance.mjs";

const sample = (tick, fps, processMs) => ({
  tick, fps, processMs, physicsMs: 0.9, memoryBytes: 2000000
});

test("observed performance summary preserves budgets without asserting compliance", () => {
  const result = summarizePerformance([
    sample(60, 60, 5), sample(120, 58, 7), sample(180, 30, 20),
    sample(240, 45, 15)
  ], { target: "android", targetFps: 30, sampleFile: "performance.jsonl" });
  assert.equal(result.ok, true);
  assert.equal(result.sampleCount, 4);
  assert.equal(result.fpsP10, 30);
  assert.equal(result.fpsMedian, 45);
  assert.equal(result.processMsP95, 20);
  assert.equal(result.peakMemoryBytes, 2000000);
  assert.match(result.mode, /not-device-certified/);
});

test("missing, duplicate and nonfinite telemetry fail closed", () => {
  assert.equal(summarizePerformance([], { target: "web" }).ok, false);
  assert.equal(summarizePerformance([sample(60, 30, 10), sample(60, 31, 10),
    sample(180, 32, 10)], { target: "web" }).ok, false);
  assert.equal(summarizePerformance([sample(60, 60, 5), sample(120, NaN, 7),
    sample(180, 60, 8)], { target: "web" }).ok, false);
});
