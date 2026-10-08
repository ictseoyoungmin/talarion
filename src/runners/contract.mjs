// Runtime runner contract for TL00.
// A runner may be Playwright/Web, ADB/Android, or a future device backend.
// It must return evidence, never just "success".

export const RUNNER_RESULT_SCHEMA = "talarion.runner-result/v1";

export function runnerResult({
  target,
  build,
  replay,
  stateFile,
  screenshots = [],
  performance = null,
  warnings = [],
  ok = true
}) {
  return {
    schema: RUNNER_RESULT_SCHEMA,
    target,
    ok,
    build,
    replay,
    evidence: {
      stateFile,
      screenshots,
      performance
    },
    warnings
  };
}

export function assertRunnerResult(value) {
  if (!value || value.schema !== RUNNER_RESULT_SCHEMA) {
    throw new Error(`Runner result must use ${RUNNER_RESULT_SCHEMA}`);
  }
  if (!value.target) throw new Error("Runner result missing target");
  if (!value.evidence?.stateFile) throw new Error("Runner result missing evidence.stateFile");
  return value;
}
