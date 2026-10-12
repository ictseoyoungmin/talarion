import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildDoctorReport, formatDoctorText, DOCTOR_REPORT_SCHEMA } from "../src/doctor/diagnostic-report.mjs";
import { renderDoctorHtml } from "../src/doctor/render.mjs";

const CLI = fileURLToPath(new URL("../bin/talarion.mjs", import.meta.url));
const record = (id, file, line, severity = "warning", targets = ["android"]) => ({
  id, file, line, column: 4, targets, severity,
  category: "code-api", capability: "platform.storage",
  message: "Call <script>alert('boom')</script> & browser API",
  remediation: "Replace <script> with an adapter & test."
});

const assetBudget = {
  schema: "talarion.asset-budget/v1",
  filesScanned: 2, knownDimensions: 1, unknownDimensions: 1,
  targets: {
    web: {
      profile: "web", textureMax: 4096, dimensionStatus: "unknown", sourceTextureCount: 2,
      performance: { status: "not-measured", targetFps: 60 }
    },
    android: {
      profile: "low", textureMax: 2048, dimensionStatus: "over-budget", sourceTextureCount: 2,
      performance: { status: "not-measured", targetFps: 30 }
    }
  }
};

test("reports sort reproducibly and stable findingId does not depend on message or input order", () => {
  const a = record("PF102", "game/z.gd", 9);
  const b = record("PF105", "game/a.js", 2, "error");
  const c = record("PF204", "game/img.svg", undefined, "info", ["web", "android"]);
  const config = { diagnostics: [a, b, c], rulesEvaluated: ["PF102", "PF105", "PF204"], assetBudget };
  const one = buildDoctorReport(config);
  const two = buildDoctorReport({ ...config, diagnostics: [c, a, b] });
  assert.equal(one.schema, DOCTOR_REPORT_SCHEMA);
  assert.deepEqual(one, two);
  assert.equal(JSON.stringify(one), JSON.stringify(two));
  assert.deepEqual(one.findings.map(f => f.ruleId), ["PF105", "PF102", "PF204"]);
  assert.deepEqual(one.summary, {
    findings: 3, error: 1, warning: 1, info: 1,
    byRule: { PF105: 1, PF102: 1, PF204: 1 },
    byTarget: { android: { error: 1, warning: 1, info: 1 },
      web: { error: 0, warning: 0, info: 1 } }
  });
  assert.equal(one.decision, "fail");
  assert.equal(one.ok, false);
  assert.equal(one.scope.hardwareCertified, false);
  assert.equal(one.scope.performanceCertified, false);
  assert.equal(one.scope.exportedRuntimeEvidence, false);
  assert.equal(one.scope.asset.targets.android.performanceStatus, "not-measured");
  const mutated = buildDoctorReport({ ...config,
    diagnostics: [{ ...a, message: "different prose" }, b, c] });
  assert.equal(mutated.findings.find(f => f.ruleId === "PF102").findingId,
    one.findings.find(f => f.ruleId === "PF102").findingId);
  const relocated = buildDoctorReport({ ...config, diagnostics: [{ ...a, line: 10 }, b, c] });
  assert.notEqual(relocated.findings.find(f => f.ruleId === "PF102").findingId,
    one.findings.find(f => f.ruleId === "PF102").findingId);
});

test("same-rule occurrences remain distinguishable, empty and unknown source reports never certify devices", () => {
  const same = record("PF102", "game/shared.js", 2);
  const report = buildDoctorReport({
    diagnostics: [same, { ...same }], assetBudget, rulesEvaluated: []
  });
  assert.equal(report.summary.warning, 2);
  assert.equal(new Set(report.findings.map(f => f.findingId)).size, 2);
  assert.equal(report.decision, "review");
  const none = buildDoctorReport({ diagnostics: [], assetBudget, rulesEvaluated: [] });
  assert.equal(none.decision, "no-findings");
  assert.equal(none.scope.asset.targets.web.dimensionStatus, "unknown");
  assert.equal(none.scope.hardwareCertified, false);
  assert.equal(none.scope.exportedRuntimeEvidence, false);
  assert.equal(none.ok, true);
});

test("HTML escapes untrusted paths, source messages and remediations; text includes useful fix", () => {
  const report = buildDoctorReport({
    diagnostics: [record("PF102", 'evil/<img src=x onerror="boom">.gd', 3)],
    rulesEvaluated: ["PF102"], assetBudget
  });
  const html = renderDoctorHtml(report);
  assert.ok(html.startsWith("<!doctype html>"));
  assert.ok(html.includes("Talarion"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&lt;img src=x onerror=&quot;boom&quot;&gt;"));
  assert.ok(!html.includes("<script>alert"));
  assert.ok(!html.includes('<img src=x onerror="boom">'));
  assert.ok(html.includes('class="finding"'));
  assert.ok(html.includes("not-measured"));
  assert.ok(html.includes("not"));
  const text = formatDoctorText(report);
  assert.ok(text.includes("PF102"));
  assert.ok(text.includes("Fix:"));
  assert.ok(text.includes("physical-device certification"));
});

test("CLI doctor report exports byte-stable JSON/HTML, preserves exit status and rejects path escape", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "talarion-report-p3-"));
  try {
    const project = path.join(root, "game");
    await fs.mkdir(project);
    await fs.writeFile(path.join(project, "project.godot"), "[application]\n");
    await fs.writeFile(path.join(project, "export_presets.cfg"), "[preset.0]\n");
    await fs.writeFile(path.join(project, "icon.svg"), "<svg></svg>");
    const conf = {
      schemaVersion: 1, project: { path: "game", engine: "godot" },
      toolchain: { godot: path.join(root, "no-such-binary") },
      targets: { android: { profile: "low" }, web: { profile: "web" } },
      profiles: { low: { textureMax: 2048 }, web: { textureMax: 4096 } }
    };
    const file = path.join(root, "talarion.config.json");
    await fs.writeFile(file, JSON.stringify(conf));
    const exec = (...args) => spawnSync(process.execPath, [CLI, ...args],
      { cwd: root, encoding: "utf8" });
    const first = exec("doctor", "report", "artifacts/doctor", "--json");
    assert.equal(first.status, 0, first.stderr);
    const parsed = JSON.parse(first.stdout);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.schema, DOCTOR_REPORT_SCHEMA);
    const jsonFile = path.join(root, "artifacts/doctor/doctor-report.json");
    const htmlFile = path.join(root, "artifacts/doctor/doctor-report.html");
    const a = await fs.readFile(jsonFile, "utf8");
    const h = await fs.readFile(htmlFile, "utf8");
    const second = exec("doctor", "report", "artifacts/doctor", "--json");
    assert.equal(second.status, 0, second.stderr);
    assert.equal(await fs.readFile(jsonFile, "utf8"), a);
    assert.equal(await fs.readFile(htmlFile, "utf8"), h);
    assert.equal(JSON.parse(a).scope.asset.targets.android.dimensionStatus, "unknown");
    assert.equal(JSON.parse(a).scope.hardwareCertified, false);
    assert.ok(h.includes("Portability Doctor"));
    const legacy = exec("doctor", "--json");
    assert.equal(legacy.status, 0, legacy.stderr);
    assert.equal(JSON.parse(legacy.stdout).schema, "talarion.doctor/v1");
    assert.deepEqual(JSON.parse(legacy.stdout).report, JSON.parse(a));
    assert.equal(exec("doctor", "report", "../outside", "--json").status, 1);
    assert.equal(exec("doctor", "report", ".", "--json").status, 1);
    assert.equal(exec("doctor", "report", "artifacts/doctor", "extra", "--json").status, 1);
    await fs.symlink(path.join(root, "artifacts/doctor"), path.join(root, "linked"));
    assert.equal(exec("doctor", "report", "linked/another", "--json").status, 1);
    conf.profiles.low.textureMax = 0;
    await fs.writeFile(file, JSON.stringify(conf));
    const broken = exec("doctor", "report", "artifacts/doctor", "--json");
    assert.equal(broken.status, 1);
    assert.equal(JSON.parse(broken.stdout).ok, false);
    assert.equal(JSON.parse(await fs.readFile(jsonFile, "utf8")).decision, "fail");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
