import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  assessIosExportPlan, inspectXcodeArchive, IOS_EXPORT_SCHEMA
} from "../src/ios/export.mjs";

const CLI = fileURLToPath(new URL("../bin/talarion.mjs", import.meta.url));
const config = { ios: { preset: "iOS", bundleIdentifier: "dev.talarion.ruinslite",
  appStoreTeamId: "A1B2C3D4E5" } };
const preset = '[preset.0]\nname="Web"\nplatform="Web"\n' +
  '[preset.1]\nname="iOS"\nplatform="iOS"\n' +
  '[preset.1.options]\napplication/bundle_identifier="dev.talarion.ruinslite"\n' +
  'application/app_store_team_id="A1B2C3D4E5"\n';
const preflight = { hostClass: "macos", status: "prerequisites-detected",
  checks: Array.from({ length: 9 }, (_, i) =>
    ({ id: "IOS-0" + (i + 1), status: "pass" })) };

test("TL03-P1 requires actual preflight, matching iOS bundle and Apple Team ID", () => {
  assert.equal(assessIosExportPlan(config, preflight, preset).eligible, true);
  const negative = [
    [config, { ...preflight, hostClass: "linux-unsupported-for-export" }, preset, "IX-01"],
    [config, { ...preflight, checks: [...preflight.checks.slice(0, 3),
      { id: "IOS-04", status: "blocked" }, ...preflight.checks.slice(4)] }, preset, "IX-01"],
    [config, preflight, preset.replace('platform="iOS"', 'platform="Android"'), "IX-02"],
    [config, preflight, preset.replace('bundle_identifier="dev.talarion.ruinslite"',
      'bundle_identifier="dev.bad.bundle"'), "IX-03"],
    [config, preflight, preset.replace('app_store_team_id="A1B2C3D4E5"',
      'app_store_team_id="Q1W2E3R4T5"'), "IX-04"],
    [{ ios: { ...config.ios, appStoreTeamId: null } }, preflight, preset, "IX-04"]
  ];
  for (const [cfg, check, txt, id] of negative) {
    const result = assessIosExportPlan(cfg, check, txt);
    assert.equal(result.eligible, false, id);
    assert.equal(result.checks.find(c => c.id === id).status, "blocked", id);
  }
});

// Small uncompressed ZIP fixture: validating the central directory is
// sufficient because P1 only asserts structural presence, not Xcode build.
function zip(names) {
  const chunks = [], directory = [];
  let offset = 0;
  for (const name of names) {
    const filename = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(filename.length, 26);
    chunks.push(local, filename);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(filename.length, 28);
    central.writeUInt32LE(offset, 42);
    directory.push(central, filename);
    offset += local.length + filename.length;
  }
  const table = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(names.length, 8);
  end.writeUInt16LE(names.length, 10);
  end.writeUInt32LE(table.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, table, end]);
}

test("TL03-P1 verifies exported Xcode ZIP central-directory evidence", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "talarion-zip-"));
  const file = path.join(dir, "ios.zip");
  try {
    await fs.writeFile(file, zip(["ruins-lite.xcodeproj/project.pbxproj",
      "ruins-lite.pck", "ruins-lite/Info.plist"]));
    assert.deepEqual(await inspectXcodeArchive(file), {
      entryCount: 3, xcodeProject: "ruins-lite.xcodeproj/project.pbxproj"
    });
    for (const names of [
      ["payload.pck"], ["../unsafe.xcodeproj/project.pbxproj"],
      ["foo.xcodeproj/project.pbxproj", "foo.xcodeproj/project.pbxproj"]
    ]) {
      await fs.writeFile(file, zip(names));
      await assert.rejects(inspectXcodeArchive(file));
    }
    await fs.writeFile(file, Buffer.from("not a ZIP"));
    await assert.rejects(inspectXcodeArchive(file));
    await fs.writeFile(file, zip(["foo.xcodeproj/project.pbxproj"]));
    const data = await fs.readFile(file);
    data.writeUInt32LE(0xffffffff, data.length - 6);
    await fs.writeFile(file, data);
    await assert.rejects(inspectXcodeArchive(file));
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test("TL03-P1 CLI emits blocked, uncertified export manifest on Linux", async t => {
  if (process.platform !== "linux") return t.skip("Linux-only negative gate");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "talarion-ios-export-"));
  const execute = (...args) => spawnSync(process.execPath, [CLI, ...args, "--json"],
    { cwd: root, encoding: "utf8" });
  try {
    await fs.mkdir(path.join(root, "game"));
    await fs.writeFile(path.join(root, "talarion.config.json"), JSON.stringify({
      project: { name: "fixture", engine: "godot", path: "game" },
      toolchain: { godot: "nonexistent-talarion-godot" },
      replay: { default: "tutorial.json", stagedResource: "talarion_runtime/replay.json" },
      ios: config.ios
    }));
    await fs.writeFile(path.join(root, "game/project.godot"),
      '[rendering]\nrenderer/rendering_method.mobile="gl_compatibility"\n');
    await fs.writeFile(path.join(root, "game/export_presets.cfg"), preset);
    await fs.writeFile(path.join(root, "tutorial.json"), "{}");
    const first = execute("ios", "export", "artifacts/ios/build");
    assert.equal(first.status, 1);
    const out = JSON.parse(first.stdout);
    assert.equal(out.schema, IOS_EXPORT_SCHEMA);
    assert.equal(out.status, "blocked");
    for (const field of ["ok", "exportAttempted", "exportProduced", "signed",
      "xcodeBuildVerified", "simulatorRuntimeObserved",
      "physicalDeviceRuntimeObserved", "parityCertified", "physicalDeviceCertified"]) {
      assert.equal(out[field], false, field);
    }
    const manifest = path.join(root, "artifacts/ios/build/ios-export.json");
    const before = await fs.readFile(manifest, "utf8");
    assert.equal(execute("ios", "export", "artifacts/ios/build").status, 1);
    assert.equal(await fs.readFile(manifest, "utf8"), before);
    assert.equal(execute("ios", "export", "../escape").status, 1);
    assert.equal(execute("ios", "export", "docs/ios").status, 1);
    await fs.symlink(path.join(root, "artifacts/ios"), path.join(root, "shortcut"));
    assert.equal(execute("ios", "export", "shortcut/build").status, 1);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
