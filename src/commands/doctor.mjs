import fs from "node:fs/promises";
import path from "node:path";
import { resolveGodot, inspectGodotProject } from "../adapters/godot.mjs";
import { resolveFromRoot } from "../core/config.mjs";
import { exists } from "../core/io.mjs";
import { DOCTOR_SCHEMA, DOCTOR_RULES, diagnosticFor } from "../doctor/rules.mjs";
import { scanPortabilitySource } from "../doctor/scanner.mjs";
import { inspectAdapterRegistry, missingAdapterDiagnostics } from "../doctor/adapters.mjs";

const IGNORE_DIRS = new Set([
  ".git", ".godot", ".import", ".talarion",
  "node_modules", "artifacts", "build", "dist"
]);

async function sourceFiles(dir) {
  if (!(await exists(dir))) return [];
  const result = [];
  async function visit(here) {
    const entries = (await fs.readdir(here, { withFileTypes: true }))
      .sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const ent of entries) {
      const target = path.join(here, ent.name);
      if (ent.isSymbolicLink()) continue;
      if (ent.isDirectory() && !IGNORE_DIRS.has(ent.name)) await visit(target);
      else if (ent.isFile() && /\.(gd|ts|js|mjs)$/.test(ent.name)) result.push(target);
    }
  }
  await visit(dir);
  return result;
}

export async function doctor(config) {
  const checks = [];
  const project = await inspectGodotProject(config);
  function projectCheck(id, passed, passedMessage) {
    const item = diagnosticFor(id);
    checks.push({ ...item, severity: passed ? "pass" : item.severity,
      message: passed ? passedMessage : item.message });
  }
  projectCheck("PF001", project.projectExists, "Godot project.godot found");
  projectCheck("PF002", project.presetsExist, "export_presets.cfg found");

  const godot = await resolveGodot(config);
  const item = diagnosticFor("PF003");
  checks.push({ ...item, severity: godot.ok ? "pass" : item.severity,
    message: godot.ok ? "Godot found: " + godot.version : item.message });

  const projectDir = resolveFromRoot(config, config.project.path);
  const registry = await inspectAdapterRegistry(config, projectDir);
  for (const file of await sourceFiles(projectDir)) {
    const adapterTargets = registry.fileTargets.get(file) ?? null;
    const relative = path.relative(config.root, file).split(path.sep).join("/");
    const source = await fs.readFile(file, "utf8");
    const findings = scanPortabilitySource({ file: relative, source });
    // Adapter code may use its own platform API, but wrong-target API calls
    // still deserve diagnostics (e.g. Java JNI inside a Web adapter).
    checks.push(...findings.filter(finding =>
      !adapterTargets || finding.targets.some(target => adapterTargets.has(target))));
  }

  checks.push(...missingAdapterDiagnostics(checks, registry));
  const diagnostics = checks.filter(c => c.severity !== "pass");
  const errors = diagnostics.filter(c => c.severity === "error").length;
  const warnings = diagnostics.filter(c => c.severity === "warning").length;
  const infos = diagnostics.filter(c => c.severity === "info").length;
  const ok = errors === 0;
  const lines = [
    "TALARION DOCTOR",
    ...checks.map(c => (c.severity === "pass" ? "✓" :
      c.severity === "warning" ? "△" : c.severity === "info" ? "i" : "✗") +
      " " + c.id + " " + c.message +
      (c.file ? " (" + c.file +
        (c.line ? ":" + c.line + ":" + c.column : "") + ")" : "")),
    "",
    (ok ? "PASS" : "FAIL") + " — " + warnings + " warning(s), " +
      errors + " error(s), " + infos + " info notice(s)"
  ];
  return {
    schema: DOCTOR_SCHEMA, ok, warnings, errors, infos,
    checks, diagnostics, rulesEvaluated: DOCTOR_RULES.map(r => r.id),
    text: lines.join("\n")
  };
}
