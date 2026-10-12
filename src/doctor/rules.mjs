// Stable public diagnostic catalog. Adding rules must not silently change existing IDs.
export const DOCTOR_SCHEMA = "talarion.doctor/v1";
export const RULE_CLASS = Object.freeze({
  0: "foundation",
  1: "code-api",
  2: "asset-budget",
  3: "renderer",
  4: "lifecycle-input-storage",
  5: "build-export",
  6: "replay-parity"
});
export const DIAGNOSTIC_SEVERITIES = Object.freeze(["error", "warning", "info"]);
export const PORTABLE_CAPABILITIES = Object.freeze([
  "engine.project", "engine.export", "toolchain.godot",
  "platform.input", "platform.storage", "platform.audio",
  "platform.haptics", "platform.lifecycle", "platform.purchase"
]);

const specs = [
  {
    id: "PF001", severity: "error", capability: "engine.project",
    targets: ["web", "android"], message: "Godot project.godot missing",
    remediation: "Configure an existing canonical Godot project directory in project.path."
  },
  {
    id: "PF002", severity: "warning", capability: "engine.export",
    targets: ["web", "android"], message: "export_presets.cfg missing; build commands cannot export yet",
    remediation: "Provide valid Web and Android export presets in the canonical project."
  },
  {
    id: "PF003", severity: "warning", capability: "toolchain.godot",
    targets: ["web", "android"], message: "Godot executable not found; static checks still available",
    remediation: "Install Godot and export templates, or configure toolchain.godot."
  },
  {
    id: "PF102", severity: "warning", capability: "platform.storage",
    targets: ["android"], message: "Direct web storage API; use a portable storage adapter.",
    remediation: "Isolate browser localStorage behind a target-implemented platform.storage boundary.",
    pattern: /\b(?:window\s*\.\s*)?localStorage\s*(?:\.|\[)/.source
  },
  {
    id: "PF103", severity: "warning", capability: "platform.haptics",
    targets: ["android"], message: "Direct browser haptics API; use a portable haptics adapter.",
    remediation: "Call the portable platform.haptics interface instead of navigator.vibrate.",
    pattern: /\bnavigator\s*\.\s*vibrate\s*\(/.source
  },
  {
    id: "PF104", severity: "warning", capability: "platform.input",
    targets: ["web", "android"], message: "Raw key polling found; prefer action-mapped portable input for gameplay.",
    remediation: "Map gameplay intent to engine input actions rather than physical key codes.",
    pattern: /\bInput\s*\.\s*is_key_pressed\s*\(/.source
  }
];

export const DOCTOR_RULES = Object.freeze(specs.map(spec => {
  const prefix = Number(spec.id.slice(2, 3));
  const category = RULE_CLASS[prefix];
  if (!/^PF[0-6][0-9]{2}$/.test(spec.id) || !category ||
      !DIAGNOSTIC_SEVERITIES.includes(spec.severity) ||
      !PORTABLE_CAPABILITIES.includes(spec.capability) ||
      !spec.targets.length || !spec.targets.every(t => ["web", "android"].includes(t))) {
    throw new Error("Invalid portability rule: " + spec.id);
  }
  return Object.freeze({ ...spec, category, targets: Object.freeze([...spec.targets]) });
}));

const ids = DOCTOR_RULES.map(rule => rule.id);
if (new Set(ids).size !== ids.length) throw new Error("Duplicate portability rule ID");
export const DOCTOR_RULE_BY_ID = Object.freeze(Object.fromEntries(
  DOCTOR_RULES.map(rule => [rule.id, rule])
));

export function diagnosticFor(id, details = {}) {
  const rule = DOCTOR_RULE_BY_ID[id];
  if (!rule) throw new Error("Unknown diagnostic ID: " + id);
  const { file, line, column } = details;
  return {
    id: rule.id, severity: rule.severity,
    category: rule.category, capability: rule.capability,
    targets: [...rule.targets], message: rule.message,
    remediation: rule.remediation,
    ...(file ? { file } : {}),
    ...(Number.isInteger(line) && line > 0 ? { line } : {}),
    ...(Number.isInteger(column) && column > 0 ? { column } : {})
  };
}
