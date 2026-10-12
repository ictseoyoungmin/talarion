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
  "platform.haptics", "platform.lifecycle", "platform.purchase",
  "platform.adapter", "asset.texture", "asset.profile"
]);

const JS_EXTS = Object.freeze([".js", ".mjs", ".ts"]);
const GD_EXTS = Object.freeze([".gd"]);

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
    extensions: JS_EXTS,
    id: "PF102", severity: "warning", capability: "platform.storage",
    targets: ["android"], message: "Direct web storage API; use a portable storage adapter.",
    remediation: "Isolate browser localStorage behind a target-implemented platform.storage boundary.",
    pattern: /\b(?:window\s*\.\s*)?localStorage\s*(?:\.|\[)/.source
  },
  {
    extensions: JS_EXTS,
    id: "PF103", severity: "warning", capability: "platform.haptics",
    targets: ["android"], message: "Direct browser haptics API; use a portable haptics adapter.",
    remediation: "Call the portable platform.haptics interface instead of navigator.vibrate.",
    pattern: /\bnavigator\s*\.\s*vibrate\s*\(/.source
  },
  {
    extensions: GD_EXTS,
    id: "PF104", severity: "warning", capability: "platform.input",
    targets: ["web", "android"], message: "Raw key polling found; prefer action-mapped portable input for gameplay.",
    remediation: "Map gameplay intent to engine input actions rather than physical key codes.",
    pattern: /\bInput\s*\.\s*is_key_pressed\s*\(/.source
  },
  {
    id: "PF105", severity: "warning", capability: "platform.storage",
    targets: ["android"], extensions: JS_EXTS,
    message: "Direct browser sessionStorage usage is not portable to Android.",
    remediation: "Move sessionStorage reads/writes behind platform.storage with a native Android implementation.",
    pattern: /\b(?:window\s*\.\s*)?sessionStorage\s*(?:\.|\[)/.source
  },
  {
    id: "PF106", severity: "warning", capability: "platform.adapter",
    targets: ["android"], extensions: GD_EXTS,
    message: "Godot JavaScriptBridge is Web-only.",
    remediation: "Move JavaScriptBridge use into a Web adapter and provide an Android equivalent or explicit feature fallback.",
    pattern: /\bJavaScriptBridge\s*\.\s*(?:eval|get_interface|create_object|create_callback|download_buffer|force_fs_sync)\s*\(/.source
  },
  {
    id: "PF107", severity: "warning", capability: "platform.adapter",
    targets: ["web"], extensions: GD_EXTS,
    message: "Godot JavaClassWrapper JNI access is Android-only.",
    remediation: "Move JNI access into an Android adapter; implement a Web fallback behind a portable capability.",
    pattern: /\bJavaClassWrapper\s*\.\s*(?:wrap|create_proxy)\s*\(/.source
  },
  {
    id: "PF108", severity: "warning", capability: "platform.adapter",
    targets: ["web"], extensions: GD_EXTS,
    message: "AndroidRuntime singleton is not available in Web exports.",
    remediation: "Keep AndroidRuntime acquisition inside a guarded Android adapter with a Web fallback.",
    literalCall: { pattern: /\bEngine\s*\.\s*get_singleton\s*\(/.source, names: ["AndroidRuntime"] }
  },
  {
    id: "PF109", severity: "warning", capability: "platform.audio",
    targets: ["android"], extensions: JS_EXTS,
    message: "Browser AudioContext is not an Android-native gameplay audio adapter.",
    remediation: "Use the portable audio interface or isolate Web Audio in a Web-only adapter.",
    pattern: /\bnew\s+(?:window\s*\.\s*)?(?:AudioContext|webkitAudioContext)\s*\(/.source
  },
  {
    id: "PF401", severity: "warning", capability: "platform.lifecycle",
    targets: ["android"], extensions: JS_EXTS,
    message: "Browser page lifecycle hooks differ from Android activity pause/resume.",
    remediation: "Use a portable lifecycle abstraction with Android pause/resume and Web visibility/pagehide adapters.",
    pattern: /\b(?:window\s*\.\s*on(?:pagehide|beforeunload)\s*=|document\s*\.\s*(?:hidden|visibilityState|onvisibilitychange)\b)/.source,
    literalCall: {
      pattern: /\b(?:window|document)\s*\.\s*addEventListener\s*\(/.source,
      names: ["pagehide", "pageshow", "beforeunload", "visibilitychange", "freeze", "resume"]
    }
  },
  {
    id: "PF402", severity: "warning", capability: "platform.input",
    targets: ["android"], extensions: JS_EXTS,
    message: "Browser keyboard DOM handlers do not provide portable gameplay action input.",
    remediation: "Map keyboard/touch/controller events into semantic gameplay actions through platform.input.",
    literalCall: {
      pattern: /\b(?:window|document)\s*\.\s*addEventListener\s*\(/.source,
      names: ["keydown", "keyup", "keypress"]
    }
  },
  {
    id: "PF403", severity: "warning", capability: "platform.input",
    targets: ["web", "android"], extensions: GD_EXTS,
    message: "Physical key polling ties gameplay to device keyboard layouts.",
    remediation: "Use Godot Input.is_action_pressed or a portable semantic input adapter.",
    pattern: /\bInput\s*\.\s*is_physical_key_pressed\s*\(/.source
  },
  {
    id: "PF404", severity: "warning", capability: "platform.adapter",
    targets: ["web"], extensions: GD_EXTS,
    message: "OS.execute relies on an operating-system subprocess unavailable in Web exports.",
    remediation: "Isolate subprocess calls outside portable gameplay and implement a Web-safe fallback.",
    pattern: /\bOS\s*\.\s*execute\s*\(/.source
  },
  {
    id: "PF201", severity: "warning", capability: "asset.texture",
    targets: ["web", "android"],
    message: "Source texture exceeds the declared textureMax dimension.",
    remediation: "Reduce the source raster resolution or select an appropriate, reviewed target texture profile."
  },
  {
    id: "PF202", severity: "warning", capability: "asset.texture",
    targets: ["web", "android"],
    message: "Texture header is invalid or truncated; dimensions cannot be verified.",
    remediation: "Repair or replace the image and rerun static asset inspection."
  },
  {
    id: "PF203", severity: "error", capability: "asset.profile",
    targets: ["web", "android"],
    message: "Target textureMax is missing or not a positive integer.",
    remediation: "Declare a positive integer profiles[targets[target].profile].textureMax."
  },
  {
    id: "PF204", severity: "info", capability: "asset.texture",
    targets: ["web", "android"],
    message: "Texture dimensions are unknown to the static inspector.",
    remediation: "Provide a supported raster source or validate this asset with engine import/render evidence."
  },
  {
    id: "PF405", severity: "warning", capability: "platform.adapter",
    targets: ["web", "android"],
    message: "Portable capability needs a declared, existing target adapter.",
    remediation: "Declare an actual target adapter source under project/adapters/<target>/ and review its implementation."
  }
];

export const DOCTOR_RULES = Object.freeze(specs.map(spec => {
  const prefix = Number(spec.id.slice(2, 3));
  const category = RULE_CLASS[prefix];
  if (!/^PF[0-6][0-9]{2}$/.test(spec.id) || !category ||
      !DIAGNOSTIC_SEVERITIES.includes(spec.severity) ||
      !PORTABLE_CAPABILITIES.includes(spec.capability) ||
      !spec.targets.length || !spec.targets.every(t => ["web", "android"].includes(t)) ||
      (spec.extensions && (!spec.extensions.length || spec.extensions.some(e => ![".gd", ".js", ".mjs", ".ts"].includes(e)))) ||
      (spec.literalCall && (!spec.literalCall.pattern || !spec.literalCall.names.length))) {
    throw new Error("Invalid portability rule: " + spec.id);
  }
  return Object.freeze({ ...spec, category, targets: Object.freeze([...spec.targets]),
    ...(spec.extensions ? { extensions: Object.freeze([...spec.extensions]) } : {}) });
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
