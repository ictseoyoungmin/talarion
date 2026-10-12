import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const source = new URL("../examples/ruins-lite/main.gd", import.meta.url);

test("QA #4 capture marker is render-complete, not a physics-tick assertion", async () => {
  const gd = await fs.readFile(fileURLToPath(source), "utf8");
  const main = gd.slice(gd.indexOf("func _on_capture_checkpoint("),
    gd.indexOf("func _on_replay_finished("));
  assert.match(main, /_emit_state\(tick, name\)/);
  assert.match(main, /_emit_capture_after_render\(name, tick\)/);
  const emit = main.indexOf('print("TALARION_CAPTURE "');
  assert.ok(emit > 0);
  const barriers = [...main.matchAll(/await RenderingServer\.frame_post_draw/g)];
  assert.ok(barriers.length >= 2);
  assert.ok(barriers.every(m => m.index < emit),
    "capture marker must follow completed render frames");
  assert.match(main, /"renderBarrier": "frame-post-draw-2"/);
});
