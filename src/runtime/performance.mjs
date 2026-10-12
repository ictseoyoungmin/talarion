// TL00-R3 observational performance evidence, not physical-device certification.
// Measurements are engine-reported and sampled during replay; they are not
// deterministic gameplay state. Hardware budgets are recorded, not auto-passed.
const finiteNonnegative = v => typeof v === "number" && Number.isFinite(v) && v >= 0;
function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}
export function summarizePerformance(samples, { target, targetFps, sampleFile } = {}) {
  const errors = [];
  if (!Array.isArray(samples)) samples = [];
  let priorTick = -1;
  const valid = [];
  for (const [i, row] of samples.entries()) {
    if (!row || !Number.isSafeInteger(row.tick) || row.tick <= priorTick ||
        !finiteNonnegative(row.fps) || !finiteNonnegative(row.processMs) ||
        !finiteNonnegative(row.physicsMs) || !finiteNonnegative(row.memoryBytes)) {
      errors.push("invalid performance sample #" + i);
      continue;
    }
    priorTick = row.tick;
    valid.push(row);
  }
  if (valid.length < 3) errors.push("fewer than three valid performance samples");
  const fps = valid.map(x => x.fps), process = valid.map(x => x.processMs);
  return {
    schema: "talarion.performance/v1", target,
    ok: errors.length === 0,
    mode: "observational-ci-emulator-not-device-certified",
    sampleFile, sampleCount: valid.length,
    targetFps: finiteNonnegative(targetFps) ? targetFps : null,
    fpsP10: percentile(fps, 0.1), fpsMedian: percentile(fps, 0.5),
    processMsP95: percentile(process, 0.95),
    physicsMsP95: percentile(valid.map(x => x.physicsMs), 0.95),
    peakMemoryBytes: valid.length ? Math.max(...valid.map(x => x.memoryBytes)) : null,
    errors
  };
}
