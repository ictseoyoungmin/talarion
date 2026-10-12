import fs from "node:fs/promises";
import path from "node:path";

export function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

export function fail(message) {
  throw new Error(message);
}

export async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

export async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

export async function ensureDirFor(file) {
  await fs.mkdir(path.dirname(file), { recursive: true });
}

export async function readJsonl(file) {
  const text = await fs.readFile(file, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line, i) => {
    try { return JSON.parse(line); }
    catch { throw new Error(`Invalid JSONL at ${file}:${i + 1}`); }
  });
}
