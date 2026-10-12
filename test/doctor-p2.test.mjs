import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseTextureHeader, auditStaticAssets, ASSET_SCHEMA } from "../src/doctor/assets.mjs";
import { doctor } from "../src/commands/doctor.mjs";
import { DOCTOR_RULES } from "../src/doctor/rules.mjs";

function png(width, height) {
  const b = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(b, 0);
  b.writeUInt32BE(13, 8); b.write("IHDR", 12, "ascii");
  b.writeUInt32BE(width, 16); b.writeUInt32BE(height, 20);
  return b;
}
function jpeg(width, height) {
  const b = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0,
    0xff, 0xc0, 0, 11, 8, 0, 0, 0, 0, 3, 1, 0, 2, 0, 3, 0
  ]);
  b.writeUInt16BE(height, 13); b.writeUInt16BE(width, 15);
  return b;
}
function webp(width, height) {
  const b = Buffer.alloc(30);
  b.write("RIFF", 0, "ascii"); b.write("WEBP", 8, "ascii");
  b.write("VP8X", 12, "ascii"); b.writeUInt32LE(10, 16);
  for (let i = 0; i < 3; i++) {
    b[24 + i] = ((width - 1) >>> (8 * i)) & 255;
    b[27 + i] = ((height - 1) >>> (8 * i)) & 255;
  }
  return b;
}
const config = (root, max = 2048) => ({
  root, project: { path: "game" },
  toolchain: { godot: path.join(root, "absent-godot") },
  targets: { web: { profile: "web" }, android: { profile: "low" } },
  profiles: {
    web: { textureMax: 8192, targetFps: 60 },
    low: { textureMax: max, targetFps: 30, drawCallBudget: 400 }
  }
});

test("PF2xx catalog and observation schema are stable", () => {
  assert.deepEqual(DOCTOR_RULES.slice(-4).map(r => r.id),
    ["PF201", "PF202", "PF203", "PF204"]);
  assert.ok(DOCTOR_RULES.slice(-4).every(r => r.category === "asset-budget"));
  assert.equal(ASSET_SCHEMA, "talarion.asset-budget/v1");
});

test("PNG, JPEG, WebP source headers produce observed dimensions, not render metrics", () => {
  assert.deepEqual(parseTextureHeader(".png", png(3200, 1024)),
    { status: "measured", width: 3200, height: 1024, format: "png" });
  assert.deepEqual(parseTextureHeader(".jpeg", jpeg(1536, 768)),
    { status: "measured", width: 1536, height: 768, format: "jpeg" });
  assert.deepEqual(parseTextureHeader(".webp", webp(1024, 512)),
    { status: "measured", width: 1024, height: 512, format: "webp" });
  assert.equal(parseTextureHeader(".jpg", Buffer.from([0, 0])).status, "unreadable");
  assert.equal(parseTextureHeader(".png", Buffer.from("bad")).status, "unreadable");
  assert.equal(parseTextureHeader(".png", png(0, 400)).status, "unreadable");
  assert.equal(parseTextureHeader(".jpg", Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]), { truncatedRead: true }).status, "unknown");
  assert.equal(parseTextureHeader(".svg", Buffer.from("<svg/>")).status, "unknown");
});

test("source dimensions are audited per profile while unknowns and performance stay unverified", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "talarion-p2-"));
  try {
    const game = path.join(root, "game");
    await fs.mkdir(path.join(game, ".godot"), { recursive: true });
    await fs.mkdir(path.join(game, "assets"), { recursive: true });
    await fs.writeFile(path.join(game, "project.godot"), "[application]\n");
    await fs.writeFile(path.join(game, "export_presets.cfg"), "[preset.0]\n");
    await fs.writeFile(path.join(game, "assets", "a.png"), png(128, 256));
    await fs.writeFile(path.join(game, "assets", "b.jpg"), jpeg(4096, 512));
    await fs.writeFile(path.join(game, "assets", "c.webp"), webp(500, 400));
    await fs.writeFile(path.join(game, "assets", "d.svg"), "<svg/>");
    await fs.writeFile(path.join(game, "assets", "e.png"), Buffer.from("bad-image"));
    await fs.writeFile(path.join(game, ".godot", "generated.jpg"), jpeg(16384, 1024));
    await fs.symlink(path.join(game, "assets", "b.jpg"), path.join(game, "assets", "link.jpg"));
    const cfg = config(root);
    const a = await auditStaticAssets(cfg, game);
    assert.equal(a.schema, ASSET_SCHEMA);
    assert.equal(a.filesScanned, 5);
    assert.equal(a.knownDimensions, 3);
    assert.equal(a.unknownDimensions, 2);
    assert.equal(a.skippedSymlinks, 1);
    assert.equal(a.targets.web.dimensionStatus, "unknown");
    assert.equal(a.targets.android.dimensionStatus, "over-budget");
    assert.deepEqual(a.targets.android.oversizedFiles, ["game/assets/b.jpg"]);
    assert.deepEqual(a.diagnostics.map(d => [d.id, d.targets, d.file]),
      [["PF201", ["android"], "game/assets/b.jpg"],
       ["PF204", ["android", "web"], "game/assets/d.svg"],
       ["PF202", ["android", "web"], "game/assets/e.png"]]);
    assert.equal(a.targets.android.performance.targetFps, 30);
    assert.equal(a.targets.android.performance.drawCallBudget, 400);
    assert.equal(a.targets.android.performance.status, "not-measured");
    assert.equal(a.targets.android.performance.measuredFps, null);
    assert.equal(a.hardwareCertified, false);
    assert.equal(a.performanceCertified, false);
    const d = await doctor(cfg);
    assert.equal(d.ok, true);
    assert.deepEqual(d.assetBudget, a);
    assert.ok(d.text.includes("PF201"));
    const invalid = await doctor(config(root, 0));
    assert.equal(invalid.ok, false);
    assert.equal(invalid.assetBudget.targets.android.dimensionStatus, "invalid-profile");
    assert.ok(invalid.diagnostics.some(x => x.id === "PF203" && x.targets[0] === "android"));
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test("empty assets cannot produce a false static or hardware PASS", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "talarion-p2-empty-"));
  try {
    const game = path.join(root, "game"); await fs.mkdir(game);
    const r = await auditStaticAssets(config(root), game);
    assert.equal(r.targets.web.dimensionStatus, "unknown");
    assert.equal(r.targets.android.dimensionStatus, "unknown");
    assert.equal(r.targets.web.performance.measuredDrawCalls, null);
    assert.equal(r.performanceCertified, false);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
