import fs from "node:fs/promises";
import path from "node:path";
import { diagnosticFor } from "./rules.mjs";

const TARGETS = ["web", "android"];
const EXTS = /\.(gd|js|mjs|ts)$/i;
const norm = text => text.split(path.sep).join("/");
const inside = relative => relative !== "" && relative !== ".." &&
  !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
const record = (capability, target, status, source, declaredPath) => {
  const d = diagnosticFor("PF405", source ? {
    file: source.file, line: source.line, column: source.column
  } : {});
  return {
    ...d, targets: [target], requiredCapability: capability, status,
    message: status === "missing"
      ? "Missing " + target + " adapter for " + capability + "."
      : "Invalid " + target + " adapter declaration for " + capability + ".",
    ...(typeof declaredPath === "string" ? { declaredPath } : {})
  };
};

// Only source files inside project/adapters/<target>/ are trusted as target
// adapter declarations. This is NOT a semantic audit of implementation code.
export async function inspectAdapterRegistry(config, projectDir) {
  const registry = config.portability?.adapters ?? {};
  const valid = new Set();
  const files = new Set();
  const fileTargets = new Map();
  const invalid = [];
  const errors = new Set();
  const rootReal = await fs.realpath(projectDir).catch(() => null);
  if (!registry || typeof registry !== "object" || Array.isArray(registry)) {
    return { valid, files, fileTargets, invalid: [record("platform.adapter", "web", "invalid")], errors };
  }
  for (const capability of Object.keys(registry).sort()) {
    const entry = registry[capability];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      invalid.push(record(capability, "web", "invalid")); errors.add(capability + ":web");
      continue;
    }
    for (const target of Object.keys(entry).sort()) {
      // An unknown target cannot accidentally authorize skipping source scans.
      const markedTarget = TARGETS.includes(target) ? target : "web";
      const key = capability + ":" + target;
      const declared = entry[target];
      const full = typeof declared === "string" && declared &&
        !path.isAbsolute(declared) ? path.resolve(config.root, declared) : null;
      const relative = full ? path.relative(projectDir, full) : "";
      const expected = path.join("adapters", target) + path.sep;
      let accepted = false;
      if (TARGETS.includes(target) && full && inside(relative) &&
          relative.startsWith(expected) && EXTS.test(full)) {
        const stat = await fs.lstat(full).catch(() => null);
        const real = await fs.realpath(full).catch(() => null);
        const realRelative = rootReal && real ? path.relative(rootReal, real) : "";
        accepted = !!stat?.isFile() && !!rootReal && !!real &&
          inside(realRelative) && realRelative.startsWith(expected);
      }
      if (accepted) {
        valid.add(key);
        files.add(full);
        if (!fileTargets.has(full)) fileTargets.set(full, new Set());
        fileTargets.get(full).add(target);
      } else {
        invalid.push(record(capability, markedTarget, "invalid", null,
          typeof declared === "string" ? declared : undefined));
        errors.add(key);
      }
    }
  }
  return { valid, files, fileTargets, invalid, errors };
}

export function missingAdapterDiagnostics(findings, registry) {
  const required = new Map();
  for (const finding of findings) {
    if (!finding.file || !finding.capability?.startsWith("platform.") ||
        finding.id === "PF405") continue;
    for (const target of finding.targets ?? []) {
      const key = finding.capability + ":" + target;
      if (!required.has(key)) required.set(key, { finding, target });
    }
  }
  const missing = [];
  for (const [key, item] of [...required].sort(([a], [b]) => a.localeCompare(b))) {
    if (registry.valid.has(key) || registry.errors.has(key)) continue;
    missing.push(record(item.finding.capability, item.target, "missing", item.finding));
  }
  return [...registry.invalid, ...missing].sort((a, b) =>
    a.requiredCapability.localeCompare(b.requiredCapability) ||
    a.targets[0].localeCompare(b.targets[0]) ||
    a.status.localeCompare(b.status));
}
