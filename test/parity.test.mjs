import test from "node:test";
import assert from "node:assert/strict";
import { compareSnapshots } from "../src/parity/compare.mjs";

test("small cross-runtime transform drift stays within tolerance", () => {
  const left = [{ tick: 60, entity: "player", state: "RUN", position: [1,0,0], health: 100 }];
  const right = [{ tick: 60, entity: "player", state: "RUN", position: [1.01,0,0], health: 100 }];
  const result = compareSnapshots(left, right, { positionTolerance: 0.1, scalarTolerance: 0.001 });
  assert.equal(result.ok, true);
  assert.equal(result.parity, 1);
});

test("authoritative state divergence fails parity", () => {
  const left = [{ tick: 60, entity: "player", state: "RUN", position: [1,0,0], health: 100 }];
  const right = [{ tick: 60, entity: "player", state: "IDLE", position: [1,0,0], health: 100 }];
  const result = compareSnapshots(left, right, { positionTolerance: 0.1, scalarTolerance: 0.001 });
  assert.equal(result.ok, false);
  assert.equal(result.differences.length, 1);
});
