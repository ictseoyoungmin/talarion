import path from "node:path";
import fs from "node:fs/promises";
import { run } from "../core/process.mjs";
import { exists } from "../core/io.mjs";
import { resolveFromRoot } from "../core/config.mjs";
import { stageReplay, cleanupStagedReplay } from "../runtime/replay-stage.mjs";

const CANDIDATES = process.platform === "win32"
  ? ["godot.exe", "godot4.exe", "godot", "godot4"]
  : ["godot", "godot4"];

const FATAL_EXPORT_PATTERNS = [
  /SCRIPT ERROR:/,
  /ERROR:\s+Failed to load script/,
  /ERROR:\s+Cannot export project/,
  /ERROR:\s+Project export .* failed/,
  /Parse Error:/
];

export function classifyGodotExport(result) {
  const diagnostics = [result.stdout ?? "", result.stderr ?? ""].join("\n");
  const fatalDiagnostics = diagnostics
    .split(/\r?\n/)
    .filter(line => FATAL_EXPORT_PATTERNS.some(pattern => pattern.test(line)));

  return {
    ok: result.ok && fatalDiagnostics.length === 0,
    fatalDiagnostics
  };
}

export async function resolveGodot(config) {
  const wanted = config.toolchain?.godot;
  if (wanted && wanted !== "auto") {
    const probe = await run(wanted, ["--version"]);
    return probe.ok ? { ok: true, bin: wanted, version: probe.stdout.trim() } :
      { ok: false, bin: wanted, reason: probe.error || probe.stderr.trim() };
  }
  for (const bin of CANDIDATES) {
    const probe = await run(bin, ["--version"]);
    if (probe.ok) return { ok: true, bin, version: probe.stdout.trim() };
  }
  return { ok: false, bin: null, reason: "Godot executable not found on PATH" };
}

export async function inspectGodotProject(config) {
  const projectDir = resolveFromRoot(config, config.project.path);
  const projectFile = path.join(projectDir, "project.godot");
  const presetsFile = path.join(projectDir, "export_presets.cfg");
  return {
    projectDir,
    projectFile,
    presetsFile,
    projectExists: await exists(projectFile),
    presetsExist: await exists(presetsFile)
  };
}

export async function exportGodot(config, target) {
  const targetConfig = config.targets?.[target];
  if (!targetConfig) throw new Error(`Unknown target: ${target}`);

  const godot = await resolveGodot(config);
  if (!godot.ok) throw new Error(godot.reason);

  const projectDir = resolveFromRoot(config, config.project.path);
  const output = resolveFromRoot(config, targetConfig.output);
  await fs.mkdir(path.dirname(output), { recursive: true });

  const stagedReplay = await stageReplay(config);
  try {
    const args = [
      "--headless",
      "--path", projectDir,
      "--export-debug", targetConfig.preset,
      output
    ];
    const result = await run(godot.bin, args);
    const classified = classifyGodotExport(result);

    return {
      ok: classified.ok,
      engine: "godot",
      target,
      preset: targetConfig.preset,
      output,
      stagedReplay,
      command: [godot.bin, ...args],
      version: godot.version,
      stdout: result.stdout,
      stderr: result.stderr,
      fatalDiagnostics: classified.fatalDiagnostics
    };
  } finally {
    await cleanupStagedReplay(config);
  }
}
