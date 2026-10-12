import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
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
  await assert.rejects(fs.access(path.dirname(staged)));
});

test("nested staging directories are removed without deleting unrelated resources", async () => {
  const config = await loadConfig(process.cwd());
  const nested = { ...config, replay: {
    ...config.replay, stagedResource: "talarion_runtime/nested/replay.json"
  } };
  const { staged, stageRoot } = replayPaths(nested);
  const keep = path.join(stageRoot, "keep.txt");
  await cleanupStagedReplay(nested);
  await fs.mkdir(stageRoot, { recursive: true });
  await fs.writeFile(keep, "keep");
  try {
    await stageReplay(nested);
    await cleanupStagedReplay(nested);
    await assert.rejects(fs.access(staged));
    await assert.rejects(fs.access(path.dirname(staged)));
    assert.equal(await fs.readFile(keep, "utf8"), "keep");
  } finally {
    await fs.rm(keep, { force: true });
    await cleanupStagedReplay(nested);
  }
  await assert.rejects(fs.access(stageRoot));
});

test("staged replay rejects traversal and absolute destinations", async () => {
  const config = await loadConfig(process.cwd());
  for (const resource of ["../../outside.json", path.join(config.root, "escape.json")]) {
    assert.throws(() => replayPaths({
      ...config, replay: { ...config.replay, stagedResource: resource }
    }), /Staged replay resource/);
  }
});
