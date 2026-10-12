import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateReplayCommand } from "../src/commands/replay.mjs";

test("replay validator returns structured errors for malformed JSON values", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "talarion-bad-replay-"));
  const cases = [
    [null, "replay must be a JSON object"],
    [{ schema: "talarion.replay/v1", tickRate: 60, events: {} }, "events must be an array"],
    [{ schema: "talarion.replay/v1", tickRate: 60, events: [null, 3, "jump"] }, "events[0] must be an object"],
    [{ schema: "talarion.replay/v1", tickRate: 60, events: [
      { tick: 10, type: "move" }, { tick: 5, type: "jump" }
    ] }, "events[1] is out of tick order"],
    [{ schema: "talarion.replay/v1", tickRate: 60, events: [
      { tick: -1, type: "" }
    ] }, "events[0].tick invalid"]
  ];
  try {
    for (const [i, [payload, expected]] of cases.entries()) {
      const filename = path.join(dir, `bad-${i}.json`);
      await fs.writeFile(filename, JSON.stringify(payload));
      const result = await validateReplayCommand(filename);
      assert.equal(result.ok, false);
      assert.ok(result.errors.includes(expected), JSON.stringify(result.errors));
      assert.match(result.text, /REPLAY INVALID/);
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
