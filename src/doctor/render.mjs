const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const row = cells => "<tr>" + cells.map(c => "<td>" + escapeHtml(c) + "</td>").join("") + "</tr>";

export function renderDoctorHtml(report) {
  const { summary, scope, findings } = report;
  const entries = findings.map(finding => {
    const location = finding.file
      ? finding.file + (finding.line ? ":" + finding.line + ":" + finding.column : "")
      : "project / configuration";
    return '<article class="finding" id="f-' + escapeHtml(finding.findingId) + '">' +
      '<header><span class="severity ' + escapeHtml(finding.severity) + '">' +
      escapeHtml(finding.severity) + "</span><strong>" + escapeHtml(finding.ruleId) +
      '</strong><code>' + escapeHtml(location) + '</code></header>' +
      "<p>" + escapeHtml(finding.message) + "</p>" +
      '<dl><div><dt>Affected targets</dt><dd>' + escapeHtml(finding.targets.join(", ")) +
      '</dd></div><div><dt>Capability</dt><dd>' + escapeHtml(finding.capability) +
      '</dd></div><div><dt>Remediation</dt><dd>' + escapeHtml(finding.remediation) +
      '</dd></div></dl>' +
      '<small>Finding: ' + escapeHtml(finding.findingId) + "</small></article>";
  }).join("\n");
  const assetRows = Object.entries(scope.asset?.targets ?? {})
    .map(([target, data]) => row([
      target, data.profile ?? "(none)", data.dimensionStatus,
      data.textureMax ?? "invalid", data.sourceTextureCount,
      data.performanceStatus
    ])).join("\n");
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Talarion · Portability Doctor</title><style>' +
    ':root{color-scheme:light;font:16px/1.55 system-ui,sans-serif;background:#f5f6f8;color:#172334}' +
    '*{box-sizing:border-box}body{margin:0}main{max-width:1050px;margin:auto;padding:clamp(18px,4vw,56px)}' +
    'h1{font-size:clamp(28px,5vw,42px);margin:.2em 0}h2{font-size:21px;margin:32px 0 12px}' +
    '.muted{color:#5b6879}.top{margin-bottom:26px}.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:10px}' +
    '.metric,.finding,.notice,.tablewrap{border:1px solid #dce2e9;background:white;border-radius:12px;padding:18px}' +
    '.metric strong{font-size:26px;display:block}.metric span{color:#576679}' +
    '.finding{margin:12px 0}.finding header{display:flex;align-items:center;gap:12px;flex-wrap:wrap}' +
    'code{overflow-wrap:anywhere;font-size:13px}.finding p{margin:12px 0}dl{margin:0;display:grid;gap:8px}' +
    'dl div{display:grid;grid-template-columns:minmax(130px,24%) 1fr;gap:12px}dt{color:#607083}dd{margin:0;overflow-wrap:anywhere}' +
    '.severity{font-size:12px;font-weight:750;text-transform:uppercase;padding:3px 9px;border-radius:5px;background:#e9edf2}' +
    '.severity.error{background:#ffe6e5;color:#9b2424}.severity.warning{background:#fff3d8;color:#865700}' +
    '.severity.info{background:#e8f0ff;color:#345c9f}.finding small{display:block;color:#637288;margin-top:12px}' +
    'table{width:100%;border-collapse:collapse;min-width:660px;text-align:left}td,th{padding:12px;border-bottom:1px solid #e6e9ee}th{font-size:13px;color:#5b6b7c}' +
    '.tablewrap{overflow:auto}footer{margin-top:24px;color:#536478;font-size:13px}' +
    '</style></head><body><main>' +
    '<div class="top"><p class="muted">TALARION / STATIC PORTABILITY REVIEW</p>' +
    '<h1>Portability Doctor</h1><p>Decision: <strong>' + escapeHtml(report.decision.toUpperCase()) +
    '</strong> · Canonical deterministic diagnostics</p></div>' +
    '<section class="summary" aria-label="Finding counts">' +
    [["Findings", summary.findings], ["Errors", summary.error],
      ["Warnings", summary.warning], ["Info", summary.info]]
      .map(([label, value]) => '<div class="metric"><strong>' +
        escapeHtml(value) + '</strong><span>' + label + "</span></div>").join("") +
    '</section><section aria-label="Source scope"><h2>Evidence authority</h2>' +
    '<div class="notice"><strong>Static source inspection only.</strong> This is not evidence of exported ' +
    'runtime parity, actual GPU frame rate, texture residency or physical-device certification.' +
    '</div></section><section><h2>Actionable findings</h2>' +
    (entries || '<div class="notice">No actionable findings. Absence of findings does not certify portability.</div>') +
    '</section><section><h2>Source image budget</h2>' +
    '<p class="muted">Observed source headers: ' + escapeHtml(scope.asset?.knownDimensions ?? 0) +
    ' / ' + escapeHtml(scope.asset?.filesScanned ?? 0) +
    '. Unknown source dimensions: ' + escapeHtml(scope.asset?.unknownDimensions ?? 0) + '.</p>' +
    '<div class="tablewrap"><table><thead><tr><th>Target</th><th>Profile</th><th>Dimension status</th>' +
    '<th>Max width / height</th><th>Source files</th><th>Performance</th></tr></thead><tbody>' +
    (assetRows || '<tr><td colspan="6">No target profiles found</td></tr>') +
    '</tbody></table></div></section><footer>Schema: ' + escapeHtml(report.schema) +
    ' · Engine/device performance not certified · Source-only diagnostic evidence</footer></main></body></html>\n';
}
