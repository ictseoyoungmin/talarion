import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { encodePng } from "../src/visual/png.mjs";
import { compareNormalizedImages, normalizeImage, compareVisualRuns } from "../src/visual/parity.mjs";

function image(width = 16, height = 9, black = false) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const v = black ? 0 : x < width / 2 ? 220 : 35;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

test("normalization and visual metric are deterministic", () => {
  const source = image();
  const left = normalizeImage(source, 16, 9);
  const right = normalizeImage(source, 16, 9);
  const result = compareNormalizedImages(left, right);
  assert.equal(result.similarity, 1);
  assert.equal(result.meanAbsoluteError, 0);
  assert.ok(result.lumaStdDev.web > 0.1);
  assert.equal(left.policy, "center-crop-nearest-rgb-v1");
  assert.deepEqual(left.crop, { x: 0, y: 0, width: 16, height: 9 });
});

test("visual comparison distinguishes a blank screen", () => {
  const good = normalizeImage(image());
  const blank = normalizeImage(image(16, 9, true));
  const result = compareNormalizedImages(good, blank);
  assert.ok(result.similarity < 0.8);
  assert.equal(result.lumaStdDev.android, 0);
});

test("visual evidence rejects missing, wrong-tick and blank checkpoints", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "talarion-visual-"));
  try {
    const web = path.join(root, "web"), android = path.join(root, "android");
    await Promise.all([fs.mkdir(web), fs.mkdir(android)]);
    await fs.writeFile(path.join(root, "replay.json"), JSON.stringify({
      schema: "talarion.replay/v1",
      tickRate: 60,
      events: [{ tick: 5, type: "capture", name: "demo" }, { tick: 12, type: "session.end" }]
    }));
    const content = encodePng(image());
    await Promise.all([
      fs.writeFile(path.join(web, "demo.png"), content),
      fs.writeFile(path.join(android, "demo.png"), content)
    ]);
    const manifest = (target, shots) => ({
      schema: "talarion.runner-result/v1", target, ok: true, finishedTick: 12,
      evidence: { screenshots: shots }
    });
    const shot = { checkpoint: "demo", tick: 5, file: "/original-run/demo.png" };
    const save = (dir, target, shots) => fs.writeFile(
      path.join(dir, "runner-result.json"), JSON.stringify(manifest(target, shots))
    );
    const config = {
      root, replay: { default: "replay.json" },
      parity: { visual: { width: 16, height: 9, minSimilarity: 0.9, minLumaStdDev: 0.05 } }
    };
    await Promise.all([save(web, "web", [shot]), save(android, "android", [shot])]);
    const success = await compareVisualRuns(config, web, android, path.join(root, "good"));
    assert.equal(success.ok, true, JSON.stringify(success.failures));
    assert.equal(success.passedCheckpoints, 1);
    await fs.access(path.join(root, "good", "demo.diff.png"));

    await save(android, "android", []);
    const missing = await compareVisualRuns(config, web, android, path.join(root, "missing"));
    assert.equal(missing.ok, false);
    assert.match(missing.results[0].error, /Expected exactly one/);
    await fs.access(path.join(root, "missing", "result.json"));

    await save(android, "android", [{ ...shot, tick: 6 }]);
    const wrongTick = await compareVisualRuns(config, web, android, path.join(root, "wrong-tick"));
    assert.equal(wrongTick.ok, false);
    assert.match(wrongTick.results[0].error, /capture tick differs/);

    await save(android, "android", [shot]);
    await fs.writeFile(path.join(android, "demo.png"), encodePng(image(16, 9, true)));
    const wrongFrame = await compareVisualRuns(config, web, android, path.join(root, "wrong-frame"));
    assert.equal(wrongFrame.ok, false);
    assert.equal(wrongFrame.results[0].ok, false);
    assert.equal(wrongFrame.results[0].lumaStdDev.android, 0);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("TL00 live action captures occur before transient states expire", async () => {
  const replay = JSON.parse(await fs.readFile(
    path.join(process.cwd(), "fixtures/replay/tutorial.tlr.json"), "utf8"
  ));
  const actions = new Map(replay.events.filter(e => ["interact", "attack"].includes(e.type))
    .map(e => [e.type, e.tick]));
  const captures = new Map(replay.events.filter(e => e.type === "capture")
    .map(e => [e.name, e.tick]));
  assert.ok(captures.get("interaction") > actions.get("interact"));
  assert.ok(captures.get("interaction") < actions.get("interact") + 20);
  assert.ok(captures.get("attack") > actions.get("attack"));
  assert.ok(captures.get("attack") < actions.get("attack") + 20);
});

test("localized actor mismatch triggers tile gate despite high global similarity", () => {
  const left = normalizeImage(image(320, 180), 320, 180);
  const right = normalizeImage(image(320, 180), 320, 180);
  for (let y = 60; y < 75; y++) {
    for (let x = 120; x < 130; x++) {
      const i = (y * 320 + x) * 4;
      right.data[i] = 0;
      right.data[i + 1] = 0;
      right.data[i + 2] = 0;
    }
  }
  const result = compareNormalizedImages(left, right);
  assert.ok(result.similarity > 0.99);
  assert.ok(result.maxTileError > 0.02);
  assert.deepEqual(result.tileGrid, { columns: 16, rows: 9 });
});
