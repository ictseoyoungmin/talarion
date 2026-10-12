import fs from "node:fs/promises";
import path from "node:path";
import { resolveGodot, inspectGodotProject } from "../adapters/godot.mjs";
import { resolveFromRoot } from "../core/config.mjs";
import { exists } from "../core/io.mjs";

async function walk(dir, out = []) {
  if (!(await exists(dir))) return out;
  for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) await walk(p, out);
    else out.push(p);
  }
  return out;
}

export async function doctor(config) {
  const checks = [];
  const project = await inspectGodotProject(config);
  checks.push({
    id: "PF001",
    severity: project.projectExists ? "pass" : "error",
    message: project.projectExists ? "Godot project.godot found" : "Godot project.godot missing"
  });
  checks.push({
    id: "PF002",
    severity: project.presetsExist ? "pass" : "warning",
    message: project.presetsExist ? "export_presets.cfg found" : "export_presets.cfg missing; build commands cannot export yet"
  });

  const godot = await resolveGodot(config);
  checks.push({
    id: "PF003",
    severity: godot.ok ? "pass" : "warning",
    message: godot.ok ? `Godot found: ${godot.version}` : "Godot executable not found; static checks still available"
  });

  const projectDir = resolveFromRoot(config, config.project.path);
  const sourceFiles = (await walk(projectDir)).filter(p => /\.(gd|ts|js|mjs)$/.test(p));
  const rules = [
    { id: "PF102", re: /window\.localStorage|localStorage\./, message: "Direct web storage API; use a Talarion platform storage adapter." },
    { id: "PF103", re: /navigator\.vibrate\s*\(/, message: "Direct browser haptics API; use a Talarion haptics adapter." },
    { id: "PF104", re: /Input\.is_key_pressed\s*\(/, message: "Raw key polling found; prefer action-mapped portable input for gameplay." }
  ];
  for (const file of sourceFiles) {
    const text = await fs.readFile(file, "utf8");
    for (const rule of rules) {
      if (rule.re.test(text)) {
        checks.push({
          id: rule.id, severity: "warning",
          file: path.relative(config.root, file),
          message: rule.message
        });
      }
    }
  }

  const errors = checks.filter(c => c.severity === "error").length;
  const warnings = checks.filter(c => c.severity === "warning").length;
  const ok = errors === 0;
  const lines = [
    "TALARION DOCTOR",
    ...checks.map(c => `${c.severity === "pass" ? "✓" : c.severity === "warning" ? "△" : "✗"} ${c.id} ${c.message}${c.file ? ` (${c.file})` : ""}`),
    "",
    `${ok ? "PASS" : "FAIL"} — ${warnings} warning(s), ${errors} error(s)`
  ];
  return { ok, warnings, errors, checks, text: lines.join("\n") };
}
