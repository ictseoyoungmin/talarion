import fs from "node:fs/promises";
import path from "node:path";
import { resolveFromRoot } from "../core/config.mjs";

export function replayPaths(config) {
  const source = resolveFromRoot(config, config.replay.default);
  const projectDir = resolveFromRoot(config, config.project.path);
  const staged = path.join(projectDir, config.replay.stagedResource);
  return { source, staged, projectDir };
}

export async function stageReplay(config) {
  const { source, staged } = replayPaths(config);
  const bytes = await fs.readFile(source);
  await fs.mkdir(path.dirname(staged), { recursive: true });
  await fs.writeFile(staged, bytes);
  return { source, staged, bytes: bytes.length };
}

export async function cleanupStagedReplay(config) {
  const { staged, projectDir } = replayPaths(config);
  await fs.rm(staged, { force: true });

  let dir = path.dirname(staged);
  const stop = path.join(projectDir, ".talarion");
  while (dir.startsWith(stop)) {
    try {
      await fs.rmdir(dir);
    } catch {
      break;
    }
    if (dir === stop) break;
    dir = path.dirname(dir);
  }
}
