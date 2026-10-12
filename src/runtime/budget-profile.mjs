// TL02-P1 validates the profile's fixed-unit budget vocabulary and explains
// which budget metrics are actually observed. It never makes a budget verdict.
export const BUDGET_COVERAGE_SCHEMA = "talarion.budget-coverage/v1";
export const BUDGET_FIELDS = Object.freeze([
  Object.freeze({ field: "targetFps", metric: "fpsP10", unit: "fps",
    direction: "minimum", required: true, integer: false }),
  Object.freeze({ field: "processMsP95Budget", metric: "processMsP95", unit: "ms",
    direction: "maximum", required: false, integer: false }),
  Object.freeze({ field: "peakMemoryBytesBudget", metric: "peakMemoryBytes", unit: "bytes",
    direction: "maximum", required: false, integer: true }),
  Object.freeze({ field: "drawCallBudget", metric: "drawCalls", unit: "calls",
    direction: "maximum", required: false, integer: true })
]);

const isPositive = (value, integer) => typeof value === "number" &&
  Number.isFinite(value) && value > 0 && (!integer || Number.isSafeInteger(value));
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);

export function analyzeBudgetProfile(profile, observedMetrics = null, evidenceVerified = false) {
  const errors = [];
  if (!isObject(profile)) errors.push({
    code: "BP01", field: "profile", reason: "missing-or-invalid-profile"
  });
  const p = isObject(profile) ? profile : {};
  const units = p.performanceUnits;
  if (units !== undefined && !isObject(units)) errors.push({
    code: "BP03", field: "performanceUnits", reason: "units-must-be-a-map"
  });
  const declaredUnits = isObject(units) ? units : {};
  const supported = new Map(BUDGET_FIELDS.map(def => [def.field, def]));
  for (const name of Object.keys(declaredUnits).sort()) {
    const def = supported.get(name);
    if (!def || declaredUnits[name] !== def.unit) {
      errors.push({ code: "BP03", field: name, reason: def
        ? "unit-mismatch-expected-" + def.unit : "unsupported-budget-unit-field" });
    } else if (p[name] === undefined || p[name] === null) {
      errors.push({ code: "BP04", field: name, reason: "unit-without-budget" });
    }
  }
  for (const def of BUDGET_FIELDS) {
    const value = p[def.field];
    if ((value === undefined || value === null) && !def.required) continue;
    if (!isPositive(value, def.integer)) errors.push({
      code: "BP02", field: def.field,
      reason: def.integer ? "requires-positive-safe-integer" : "requires-positive-finite-number"
    });
  }
  const profileValid = errors.length === 0;
  const observed = isObject(observedMetrics) ? observedMetrics : {};
  const metrics = BUDGET_FIELDS.map(def => {
    const value = p[def.field];
    const declared = isPositive(value, def.integer) ? value : null;
    const hasObserved = def.metric !== "drawCalls" &&
      (def.metric === "peakMemoryBytes"
        ? Number.isSafeInteger(observed[def.metric]) && observed[def.metric] >= 0
        : typeof observed[def.metric] === "number" &&
          Number.isFinite(observed[def.metric]) && observed[def.metric] >= 0);
    const trusted = evidenceVerified && profileValid;
    const status = !profileValid ? "invalid-profile"
      : declared === null ? "not-declared"
        : !trusted ? "unverified"
          : !hasObserved ? "unobserved"
            : "comparable-not-graded";
    return {
      budgetField: def.field,
      observedMetric: def.metric,
      unit: def.unit, unitSource: Object.hasOwn(declaredUnits, def.field)
        ? declaredUnits[def.field] === def.unit ? "explicit-validated" : "explicit-invalid"
        : "schema-fixed",
      direction: def.direction,
      required: def.required,
      declaredLimit: declared,
      observedValue: status === "comparable-not-graded" ? observed[def.metric] : null,
      status, comparisonEvaluated: false, decision: "not-evaluated"
    };
  });
  return {
    schema: BUDGET_COVERAGE_SCHEMA,
    ok: profileValid,
    profileStatus: profileValid ? "valid" : "invalid",
    errors, metrics,
    unobserved: [
      { metric: "gpuTextureMemoryBytes", unit: "bytes", status: "not-in-runner-protocol" },
      { metric: "thermalHeadroom", unit: "unknown", status: "not-in-runner-protocol" }
    ],
    compliance: "not-evaluated", hardwareCertified: false
  };
}
