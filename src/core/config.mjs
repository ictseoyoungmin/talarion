import fs from "node:fs/promises";
import path from "node:path";
import { exists } from "./io.mjs";

export async function findProjectRoot(start) {
  let here = path.resolve(start);
  while (true) {
    if (await exists(path.join(here, "talarion.config.json"))) return here;
    const parent = path.dirname(here);
    if (parent === here) throw new Error("talarion.config.json not found");
    here = parent;
  }
}

export async function loadConfig(start) {
  const root = await findProjectRoot(start);
  const configPath = path.join(root, "talarion.config.json");
  const raw = JSON.parse(await fs.readFile(configPath, "utf8"));
  return { ...raw, root, configPath };
}

export function resolveFromRoot(config, relativePath) {
  return path.resolve(config.root, relativePath);
}
