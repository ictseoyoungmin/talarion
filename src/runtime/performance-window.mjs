// TL02-P2: explicit replay-tick sampling windows and conservative *observational*
// across-run regressions. These do not certify target FPS or physical devices.
export const WINDOW_SCHEMA = "talarion.performance-window/v1";
export const REGRESSION_SCHEMA = "talarion.performance-regression/v1";
const finite = x => typeof x === "number" && Number.isFinite(x) && x >= 0;
const positiveInt = x => Number.isSafeInteger(x) && x > 0;
const nonnegativeInt = x => Number.isSafeInteger(x) && x >= 0;
const median = v => {
  if (!v.length) return null;
  const sorted = [...v].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const quantile = (v, p) => {
  if (!v.length) return null;
  const a = [...v].sort((x, y) => x - y);
  return a[Math.max(0, Math.ceil(a.length * p) - 1)];
};
const mad = v => {
  const m = median(v);
  return m === null ? null : median(v.map(x => Math.abs(x - m)));
};

export function summarizePerformanceWindow(samples, {
  window = null, replayEndTick = null, replayTickRate = null,
  evidenceVerified = false
} = {}) {
  const settings = window;
  const invalid = settings !== null && (
    !settings || typeof settings !== "object" || Array.isArray(settings) ||
    !nonnegativeInt(settings.warmupTicks) ||
    !positiveInt(settings.sampleStepTicks) ||
    !positiveInt(settings.minSamples) ||
    settings.warmupTicks % settings.sampleStepTicks !== 0 ||
    settings.minSamples < 3);
  const provenanceValid = positiveInt(replayEndTick) && positiveInt(replayTickRate);
  const configured = settings !== null;
  const valid = configured && !invalid && provenanceValid &&
    replayEndTick > settings.warmupTicks &&
    replayEndTick % settings.sampleStepTicks === 0;
  const expected = valid
    ? Array.from({ length: (replayEndTick - settings.warmupTicks) /
      settings.sampleStepTicks }, (_, i) =>
      settings.warmupTicks + (i + 1) * settings.sampleStepTicks)
    : [];
  const rows = Array.isArray(samples) ? samples : [];
  let prior = -1;
  const validSamples = rows.every(row => {
    if (!row || !nonnegativeInt(row.tick) || row.tick <= prior ||
      !finite(row.fps) || !finite(row.processMs) ||
      !finite(row.physicsMs) || !finite(row.memoryBytes)) return false;
    prior = row.tick;
    return true;
  });
  const withinReplay = valid && validSamples &&
    rows.every(r => r.tick <= replayEndTick);
  const measured = withinReplay
    ? rows.filter(r => r.tick > settings.warmupTicks && r.tick <= replayEndTick)
    : [];
  const actualTicks = measured.map(r => r.tick);
  const complete = actualTicks.length === expected.length &&
    actualTicks.every((tick, i) => tick === expected[i]);
  const status = !configured ? "not-configured" : invalid || !valid
    ? "invalid-window" : !evidenceVerified || !validSamples || !withinReplay
      ? "unverified" : measured.length < settings.minSamples ||
        expected.length < settings.minSamples || !complete
        ? "incomplete-window" : "complete-window";
  const good = status === "complete-window";
  return {
    schema: WINDOW_SCHEMA, status, ok: good,
    scope: "single-exported-replay-engine-observation",
    replayEndTick: provenanceValid ? replayEndTick : null,
    replayTickRate: provenanceValid ? replayTickRate : null,
    warmupTicks: valid ? settings.warmupTicks : null,
    sampleStepTicks: valid ? settings.sampleStepTicks : null,
    expectedTicks: expected, measuredTicks: good ? actualTicks : [],
    expectedCount: expected.length,
    measuredCount: good ? measured.length : null,
    excludedWarmupCount: good
      ? rows.filter(r => r.tick <= settings.warmupTicks).length : null,
    metrics: good ? {
      fpsP10: quantile(measured.map(r => r.fps), 0.1),
      fpsMedian: median(measured.map(r => r.fps)),
      processMsP95: quantile(measured.map(r => r.processMs), 0.95),
      physicsMsP95: quantile(measured.map(r => r.physicsMs), 0.95),
      peakMemoryBytes: Math.max(...measured.map(r => r.memoryBytes))
    } : null,
    noise: good ? {
      fpsMedianAbsoluteDeviation: mad(measured.map(r => r.fps)),
      processMsMedianAbsoluteDeviation: mad(measured.map(r => r.processMs))
    } : null,
    budgetDecision: "not-evaluated",
    hardwareCertified: false
  };
}

const comparableRun = r => r && typeof r === "object" &&
  typeof r.runId === "string" && r.runId.length > 0 &&
  ["web", "android"].includes(r.target) &&
  typeof r.runtimeKind === "string" && r.runtimeKind.length > 0 &&
  typeof r.environmentKey === "string" && r.environmentKey.length > 0 &&
  typeof r.profile === "string" && r.profile.length > 0 &&
  typeof r.replaySha256 === "string" && /^[0-9a-f]{64}$/i.test(r.replaySha256) &&
  r.window?.schema === WINDOW_SCHEMA && r.window?.ok === true &&
  r.window?.status === "complete-window" &&
  positiveInt(r.window.replayEndTick) &&
  positiveInt(r.window.sampleStepTicks) &&
  nonnegativeInt(r.window.warmupTicks) &&
  positiveInt(r.window.replayTickRate) &&
  r.window?.metrics && finite(r.window.metrics.fpsMedian) &&
  finite(r.window.metrics.processMsP95);

// This is a deterministic noise *heuristic*, not a statistical p-value.
// Require three independent runs in each cohort with an explicit environmentKey.
// No CI cross-run cohort -> no regression claim.
export function assessObservationalRegression({
  baseline, candidate, maxFpsDropPct, maxProcessRisePct
} = {}) {
  const a = Array.isArray(baseline) ? baseline : [];
  const b = Array.isArray(candidate) ? candidate : [];
  const combined = [...a, ...b];
  const validThresholds = finite(maxFpsDropPct) && finite(maxProcessRisePct) &&
    maxFpsDropPct <= 100 && maxProcessRisePct <= 1000;
  const unique = new Set(combined.map(r => r?.runId));
  const reference = combined[0];
  const axes = r => [
    r.target, r.runtimeKind, r.environmentKey, r.profile, r.replaySha256,
    r.window.replayEndTick, r.window.replayTickRate, r.window.warmupTicks,
    r.window.sampleStepTicks, r.window.expectedCount
  ];
  const uniform = combined.length > 0 && combined.every(r =>
    comparableRun(r) && JSON.stringify(axes(r)) === JSON.stringify(axes(reference)));
  const enough = a.length >= 3 && b.length >= 3;
  const reason = !validThresholds ? "invalid-thresholds" :
    !enough ? "insufficient-independent-runs" :
    unique.size !== combined.length ? "duplicate-run-id" :
    !uniform ? "incompatible-or-unverified-evidence" : null;
  if (reason) {
    return { schema: REGRESSION_SCHEMA, status: "not-evaluated",
      reason, observationalOnly: true, hardwareCertified: false,
      baselineCount: a.length, candidateCount: b.length, metrics: [] };
  }
  const specs = [
    ["fpsMedian", "lower-worse", maxFpsDropPct],
    ["processMsP95", "higher-worse", maxProcessRisePct]
  ];
  const metrics = specs.map(([name, direction, limitPct]) => {
    const ref = median(a.map(x => x.window.metrics[name]));
    const now = median(b.map(x => x.window.metrics[name]));
    const baselineMad = mad(a.map(x => x.window.metrics[name]));
    const candidateMad = mad(b.map(x => x.window.metrics[name]));
    // The baseline must be positive for a percentage calculation.
    if (!(ref > 0)) return { name, status: "inconclusive-noise",
      reason: "zero-baseline", baselineMedian: ref, candidateMedian: now };
    const degradation = direction === "lower-worse" ? ref - now : now - ref;
    const percent = 100 * degradation / ref;
    const heuristicNoisePct = 100 * 2 * (baselineMad + candidateMad) / ref;
    const status = percent - heuristicNoisePct > limitPct
      ? "regression-observed" : percent + heuristicNoisePct <= limitPct
        ? "no-regression-observed" : "inconclusive-noise";
    return { name, direction, status, baselineMedian: ref,
      candidateMedian: now, baselineMad, candidateMad,
      degradationPercent: percent, noiseFencePercent: heuristicNoisePct,
      maximumAllowedDegradationPercent: limitPct };
  });
  const status = metrics.some(x => x.status === "regression-observed")
    ? "regression-observed"
    : metrics.some(x => x.status === "inconclusive-noise")
      ? "inconclusive-noise" : "no-regression-observed";
  return { schema: REGRESSION_SCHEMA, status,
    reason: null, observationalOnly: true, hardwareCertified: false,
    baselineCount: a.length, candidateCount: b.length,
    target: reference.target, runtimeKind: reference.runtimeKind,
    environmentKey: reference.environmentKey, profile: reference.profile,
    replaySha256: reference.replaySha256, metrics };
}
