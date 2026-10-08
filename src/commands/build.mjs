import { exportGodot } from "../adapters/godot.mjs";

export async function build(config, target) {
  if (!target) throw new Error("Usage: talarion build <web|android>");
  if (config.project.engine !== "godot") throw new Error("TL00 starter currently supports only Godot.");
  const r = await exportGodot(config, target);
  return {
    ...r,
    text: [
      `TALARION BUILD — ${target}`,
      `Godot: ${r.version}`,
      `Preset: ${r.preset}`,
      `Output: ${r.output}`,
      r.ok ? "BUILD PASS" : "BUILD FAIL",
      r.stderr?.trim() ? `\n${r.stderr.trim()}` : ""
    ].join("\n")
  };
}
