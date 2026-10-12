import { createHash } from "node:crypto";

export const DOCTOR_REPORT_SCHEMA = "talarion.doctor-report/v1";
const ORDER = { error: 0, warning: 1, info: 2 };
const norm = value => String(value ?? "");
const targets = value => [...new Set(value ?? [])].sort();
const issueKey = finding => JSON.stringify([
  finding.id, norm(finding.file), finding.line ?? null,
  finding.column ?? null, targets(finding.targets),
  norm(finding.profile), norm(finding.requiredCapability),
  norm(finding.status), norm(finding.declaredPath)
]);

export function buildDoctorReport(doctor) {
  const list = (doctor.diagnostics ?? []).map(f => ({
    ruleId: f.id, severity: f.severity, category: f.category,
    capability: f.capability, targets: targets(f.targets),
    message: f.message, remediation: f.remediation,
    ...(f.file ? { file: f.file } : {}),
    ...(Number.isInteger(f.line) ? { line: f.line } : {}),
    ...(Number.isInteger(f.column) ? { column: f.column } : {}),
    ...(f.profile !== undefined ? { profile: f.profile } : {}),
    ...(f.requiredCapability ? { requiredCapability: f.requiredCapability } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(f.declaredPath !== undefined ? { declaredPath: f.declaredPath } : {}),
    ...(f.observed ? { observed: f.observed } : {}),
    ...(f.limit !== undefined ? { limit: f.limit } : {}),
    ...(f.reason ? { reason: f.reason } : {})
  }));
  list.sort((a, b) =>
    (ORDER[a.severity] ?? 3) - (ORDER[b.severity] ?? 3) ||
    norm(a.file).localeCompare(norm(b.file), "en") ||
    (a.line ?? 0) - (b.line ?? 0) ||
    (a.column ?? 0) - (b.column ?? 0) ||
    a.ruleId.localeCompare(b.ruleId, "en") ||
    issueKey(a).localeCompare(issueKey(b), "en")
  );
  const seen = new Map();
  const findings = list.map(item => {
    const key = issueKey({ ...item, id: item.ruleId });
    const nth = seen.get(key) ?? 0;
    seen.set(key, nth + 1);
    const fingerprint = createHash("sha256").update(key + ":" + nth).digest("hex").slice(0, 16);
    return { findingId: item.ruleId + "-" + fingerprint, ...item };
  });
  const counts = { error: 0, warning: 0, info: 0 };
  const byRule = {};
  const byTarget = {};
  for (const f of findings) {
    counts[f.severity]++;
    byRule[f.ruleId] = (byRule[f.ruleId] ?? 0) + 1;
    for (const target of f.targets) {
      if (!byTarget[target]) byTarget[target] = { error: 0, warning: 0, info: 0 };
      byTarget[target][f.severity]++;
    }
  }
  const assets = doctor.assetBudget ?? null;
  const assetStatuses = Object.fromEntries(
    Object.entries(assets?.targets ?? {}).sort(([a], [b]) => a.localeCompare(b, "en"))
      .map(([target, data]) => [target, {
        profile: data.profile, dimensionStatus: data.dimensionStatus,
        textureMax: data.textureMax,
        sourceTextureCount: data.sourceTextureCount,
        performanceStatus: data.performance?.status ?? "not-measured"
      }])
  );
  return {
    schema: DOCTOR_REPORT_SCHEMA,
    decision: counts.error ? "fail" : findings.length ? "review" : "no-findings",
    ok: counts.error === 0,
    summary: {
      findings: findings.length, ...counts, byRule, byTarget
    },
    findings, rulesEvaluated: [...(doctor.rulesEvaluated ?? [])],
    scope: {
      sourceAnalysisOnly: true, exportedRuntimeEvidence: false,
      hardwareCertified: false, performanceCertified: false,
      asset: assets ? {
        schema: assets.schema, filesScanned: assets.filesScanned,
        knownDimensions: assets.knownDimensions,
        unknownDimensions: assets.unknownDimensions,
        targets: assetStatuses
      } : null
    }
  };
}

export function formatDoctorText(report) {
  const lines = [
    "TALARION DOCTOR",
    "Assessment: " + report.decision.toUpperCase() +
      " — " + report.summary.error + " error(s), " +
      report.summary.warning + " warning(s), " +
      report.summary.info + " info notice(s)"
  ];
  if (!report.findings.length) lines.push("No actionable source findings.");
  for (const finding of report.findings) {
    const location = finding.file
      ? " (" + finding.file +
        (finding.line ? ":" + finding.line + ":" + finding.column : "") + ")"
      : "";
    lines.push(
      "[" + finding.severity.toUpperCase() + "] " + finding.ruleId +
      location + " [" + finding.targets.join(", ") + "] " + finding.message,
      "  Fix: " + finding.remediation
    );
  }
  const asset = report.scope.asset;
  if (asset) {
    lines.push("", "SOURCE TEXTURES — observed " + asset.knownDimensions +
      "/" + asset.filesScanned + "; unknown " + asset.unknownDimensions);
    for (const [target, data] of Object.entries(asset.targets)) {
      lines.push("  " + target + ": " + data.dimensionStatus +
        " (textureMax " + (data.textureMax ?? "invalid") + ")");
    }
  }
  lines.push("", "Static analysis only — no exported runtime, GPU performance or physical-device certification.",
    report.ok ? "DOCTOR PASS (not release certification)" : "DOCTOR FAIL");
  return lines.join("\n");
}
