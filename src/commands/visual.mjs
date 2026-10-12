import { compareVisualRuns } from "../visual/parity.mjs";

export async function visualCommand(config, action, webDir, androidDir, outputDir) {
  if (action !== "compare" || !webDir || !androidDir || !outputDir) {
    throw new Error("Usage: talarion visual compare <web-evidence-dir> <android-evidence-dir> <output-dir>");
  }
  return compareVisualRuns(config, webDir, androidDir, outputDir);
}
