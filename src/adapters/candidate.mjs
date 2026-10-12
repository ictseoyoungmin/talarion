import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { inspectAdapterCommand, ADAPTER_INSPECTION_SCHEMA } from "./manifest.mjs";

export const MAX_CANDIDATE_BYTES = 256 * 1024;
const bad = (id, detail, source = null) => ({
  schema: ADAPTER_INSPECTION_SCHEMA,
  ok: false,
  authority: "static-candidate-declaration",
  engineVersionObserved: false,
  runtimeObserved: false,
  parityCertified: false,
  hardwareCertified: false,
  ...(source ? { source } : {}),
  checks: [{ id, status: "fail", detail }],
  text: "TALARION CANDIDATE ADAPTER — FAIL\n" + id + ": " + detail +
    "\nCandidate files never register an executable adapter."
});

export async function validateCandidateAdapter(config, filename, target = null) {
  if (typeof filename !== "string" || !filename.trim() ||
      path.isAbsolute(filename) || !filename.endsWith(".json")) {
    return bad("AC001", "Candidate path must be a relative JSON file inside repository.");
  }
  const root = await fs.realpath(config.root);
  const full = path.resolve(root, filename);
  const relative = path.relative(root, full);
  if (!relative || relative === ".." || relative.startsWith(".." + path.sep) ||
      path.isAbsolute(relative)) {
    return bad("AC001", "Candidate path escapes repository.");
  }
  let cursor = root;
  for (const segment of relative.split(path.sep)) {
    cursor = path.join(cursor, segment);
    const st = await fs.lstat(cursor).catch(error =>
      error?.code === "ENOENT" ? null : Promise.reject(error));
    if (!st) return bad("AC002", "Candidate file not found.");
    if (st.isSymbolicLink()) return bad("AC002", "Candidate path crosses a symlink.");
  }
  const stat = await fs.stat(full);
  if (!stat.isFile() || stat.size > MAX_CANDIDATE_BYTES) {
    return bad("AC003", "Candidate must be a regular JSON file at most 256 KiB.");
  }
  const bytes = await fs.readFile(full);
  const source = {
    path: relative.split(path.sep).join("/"),
    sha256: createHash("sha256").update(bytes).digest("hex")
  };
  let manifest;
  try {
    manifest = JSON.parse(bytes.toString("utf8"));
  } catch {
    return bad("AC004", "Candidate JSON syntax invalid.", source);
  }
  // Validation only: do not write, load modules, run exports or start runtimes.
  const result = await inspectAdapterCommand(config, target, { manifest });
  result.authority = "static-candidate-declaration";
  result.source = source;
  result.text += "\nCandidate validation never registers or runs the declared adapter.";
  return result;
}
