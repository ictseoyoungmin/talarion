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


test("same tick and entity remain distinct across checkpoint snapshots", () => {
  const left = [
    { tick: 180, entity: "player", checkpoint: "after-jump", state: "IDLE", position: [1,0,0], health: 100 },
    { tick: 180, entity: "player", checkpoint: "interval", state: "IDLE", position: [1,0,0], health: 100 }
  ];
  const right = structuredClone(left);
  right[0].state = "RUN";

  const result = compareSnapshots(left, right, { positionTolerance: 0.1, scalarTolerance: 0.001 });
  assert.equal(result.ok, false);
  assert.equal(result.total, 2);
  assert.equal(result.matched, 1);
  assert.equal(result.differences[0].key, "180:player:after-jump");
});

test("camera rotation is authoritative parity state", () => {
  const left = [{ tick: 60, entity: "player", checkpoint: "interval", state: "IDLE", cameraRotation: [0,0,0] }];
  const right = [{ tick: 60, entity: "player", checkpoint: "interval", state: "IDLE", cameraRotation: [0,0.5,0] }];

  const result = compareSnapshots(left, right, {
    positionTolerance: 0.1,
    rotationTolerance: 0.1,
    scalarTolerance: 0.001
  });
  assert.equal(result.ok, false);
  assert.ok(result.differences[0].detail.cameraRotationDelta > 0.1);
});

test("duplicate snapshot identity fails instead of silently overwriting", () => {
  const row = { tick: 60, entity: "player", checkpoint: "interval", state: "RUN" };
  const result = compareSnapshots([row, { ...row }], [row], {
    positionTolerance: 0.1,
    scalarTolerance: 0.001
  });
  assert.equal(result.ok, false);
  assert.equal(result.differences[0].kind, "duplicate");
});

test("missing or malformed authoritative vector cannot silently pass", () => {
  const left = [{ tick: 60, entity: "player", state: "RUN", position: [1,0,0] }];
  const missing = [{ tick: 60, entity: "player", state: "RUN" }];
  const malformed = [{ tick: 60, entity: "player", state: "RUN", position: ["bad",0,0] }];
  for (const right of [missing, malformed]) {
    const result = compareSnapshots(left, right, { positionTolerance: 0.1 });
    assert.equal(result.ok, false);
    assert.equal(result.differences[0].detail.position.error, "missing or invalid vector");
  }
});

test("missing health evidence cannot be considered equal", () => {
  const left = [{ tick: 60, entity: "player", state: "RUN", health: 90 }];
  const right = [{ tick: 60, entity: "player", state: "RUN" }];
  const result = compareSnapshots(left, right, {});
  assert.equal(result.ok, false);
  assert.equal(result.differences[0].detail.health.error, "missing or invalid scalar");
});
