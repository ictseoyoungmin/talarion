import { resolveAdapterExecution } from "../adapters/dispatch.mjs";

export async function build(config, target) {
  if (!target) throw new Error("Usage: talarion build <web|android>");

  const dispatch = await resolveAdapterExecution(config, target);
  if (!dispatch.report.ok) {
    return {
      ok: false, target, status: "blocked", adapter: dispatch.report,
      text: [
        `TALARION BUILD — ${target}`,
        "ADAPTER BLOCKED",
        ...dispatch.report.checks.filter(c => !c.ok).map(c => `FAIL ${c.id}: ${c.detail}`)
      ].join("\n")
    };
  }

  const r = await dispatch.handlers.exportProject(config, target);
  return {
    ...r,
    adapter: dispatch.report,
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
