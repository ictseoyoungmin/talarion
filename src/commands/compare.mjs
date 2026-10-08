import path from "node:path";
import { readJsonl } from "../core/io.mjs";
import { compareSnapshots } from "../parity/compare.mjs";

export async function compareCommand(config, leftFile, rightFile) {
  const leftPath = path.resolve(leftFile), rightPath = path.resolve(rightFile);
  const left = await readJsonl(leftPath), right = await readJsonl(rightPath);
  const result = compareSnapshots(left, right, config.parity);
  const text = [
    "TALARION PARITY",
    `left:  ${leftPath}`,
    `right: ${rightPath}`,
    `snapshots: ${result.total}`,
    `matched:   ${result.matched}`,
    `parity:    ${(result.parity * 100).toFixed(2)}%`,
    result.ok ? "PARITY PASS" : `PARITY FAIL — ${result.differences.length} divergence(s)`
  ].join("\n");
  return { ...result, leftPath, rightPath, text };
}
