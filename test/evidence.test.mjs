import test from "node:test";
import assert from "node:assert/strict";
import { parseProtocolLine } from "../src/runtime/evidence.mjs";

test("parses browser protocol lines", () => {
  const parsed = parseProtocolLine('TALARION_STATE {"tick":60,"entity":"player"}');
  assert.equal(parsed.kind, "state");
  assert.equal(parsed.value.tick, 60);
});

test("parses protocol markers inside Android logcat text", () => {
  const parsed = parseProtocolLine('10-09 01:40:00 I/Godot: TALARION_CAPTURE {"tick":420,"name":"interaction"}');
  assert.equal(parsed.kind, "capture");
  assert.equal(parsed.value.name, "interaction");
});

test("parses scalar replay-finished payload", () => {
  const parsed = parseProtocolLine("Godot: TALARION_REPLAY_FINISHED 600");
  assert.equal(parsed.kind, "finished");
  assert.equal(parsed.value, 600);
});
