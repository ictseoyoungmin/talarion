import fs from "node:fs/promises";
import path from "node:path";
import { resolveFromRoot } from "../core/config.mjs";

export function replayPaths(config) {
  const source = resolveFromRoot(config, config.replay.default);
  const projectDir = resolveFromRoot(config, config.project.path);
  const resource = config.replay.stagedResource;
  if (typeof resource !== "string" || !resource.trim() || path.isAbsolute(resource)) {
    throw new Error("Staged replay resource must be a relative path inside the project.");
  }
  const staged = path.resolve(projectDir, resource);
  const relative = path.relative(projectDir, staged);
  if (!relative || relative === ".." || relative.startsWith(".." + path.sep) ||
      path.isAbsolute(relative)) {
    throw new Error("Staged replay resource escapes the project.");
  }
  // Only the configured staging subtree may be pruned; never the project root.
  const stageRoot = path.join(projectDir, relative.split(path.sep)[0]);
  return { source, staged, projectDir, stageRoot };
}

export async function stageReplay(config) {
  const { source, staged } = replayPaths(config);
  const bytes = await fs.readFile(source);
  await fs.mkdir(path.dirname(staged), { recursive: true });
  await fs.writeFile(staged, bytes);
  return { source, staged, bytes: bytes.length };
}

export async function cleanupStagedReplay(config) {
  const { staged, projectDir, stageRoot } = replayPaths(config);
  await fs.rm(staged, { force: true });

  // rmdir intentionally stops at the first non-empty directory, preserving
  // unrelated files in the staging subtree and never deleting the project.
  let dir = path.dirname(staged);
  while (dir !== projectDir && (dir === stageRoot || dir.startsWith(stageRoot + path.sep))) {
    try {
      await fs.rmdir(dir);
    } catch (error) {
      // An already-removed nested directory must not prevent pruning its
      // now-empty staging parent; any non-ENOENT error still stops safely.
      if (error?.code !== "ENOENT") break;
    }
    if (dir === stageRoot) break;
    dir = path.dirname(dir);
  }
}
