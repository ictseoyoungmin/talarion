import { resolveFromRoot } from "../core/config.mjs";

export async function plan(config) {
  const targets = Object.entries(config.targets ?? {}).map(([name, t]) => ({
    target: name,
    engine: config.project.engine,
    preset: t.preset,
    profile: t.profile,
    output: resolveFromRoot(config, t.output)
  }));
  const text = [
    "TALARION BUILD GRAPH",
    `project: ${config.project.name}`,
    `engine: ${config.project.engine}`,
    "",
    ...targets.map(t => `${t.target.padEnd(8)} ${t.profile.padEnd(12)} preset=${t.preset} -> ${t.output}`)
  ].join("\n");
  return { ok: true, project: config.project, targets, text };
}
