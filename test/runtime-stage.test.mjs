import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { loadConfig } from "../src/core/config.mjs";
import { stageReplay, cleanupStagedReplay, replayPaths } from "../src/runtime/replay-stage.mjs";

test("staged replay is byte-identical to the canonical replay", async () => {
  const config = await loadConfig(process.cwd());
  const { source, staged } = replayPaths(config);

  await cleanupStagedReplay(config);
  const result = await stageReplay(config);

  const [a, b] = await Promise.all([fs.readFile(source), fs.readFile(staged)]);
  assert.deepEqual(b, a);
  assert.equal(result.bytes, a.length);

  await cleanupStagedReplay(config);
  await assert.rejects(fs.access(staged));
});
