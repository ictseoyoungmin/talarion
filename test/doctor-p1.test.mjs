import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DOCTOR_RULES, DOCTOR_SCHEMA } from "../src/doctor/rules.mjs";
import { scanPortabilitySource } from "../src/doctor/scanner.mjs";
import { inspectAdapterRegistry } from "../src/doctor/adapters.mjs";
import { doctor } from "../src/commands/doctor.mjs";

const fixture = name => fs.readFile(
  new URL("../fixtures/doctor/" + name, import.meta.url), "utf8");

test("P1 catalog extends the legacy six stable IDs", () => {
  assert.equal(DOCTOR_SCHEMA, "talarion.doctor/v1");
  assert.deepEqual(DOCTOR_RULES.slice(0, 6).map(x => x.id),
    ["PF001", "PF002", "PF003", "PF102", "PF103", "PF104"]);
  assert.deepEqual(DOCTOR_RULES.slice(6).map(x => x.id),
    ["PF105", "PF106", "PF107", "PF108", "PF109",
     "PF401", "PF402", "PF403", "PF404", "PF405"]);
});

test("browser lifecycle, keyboard, storage and audio use literal events and exact lines", async () => {
  const source = await fixture("browser-p1.js");
  const actual = scanPortabilitySource({ file: "game/browser-p1.js", source });
  assert.deepEqual(actual.map(x => [x.id, x.line]),
    [["PF105", 2], ["PF401", 3], ["PF401", 4],
     ["PF402", 5], ["PF109", 6], ["PF401", 7]]);
  assert.ok(actual.every(x => x.targets.join(",") === "android"));
  assert.ok(actual.every(x => x.remediation.length > 20 && x.column >= 1));
  const safe = [
    'window.addEventListener("click", () => {});',
    'window.addEventListener(name, cb);',
    'const name = "pagehide";',
    'const text = "window.addEventListener";',
    'custom.addEventListener("pagehide", cb);',
    'const sound = engine.AudioContext;',
    'const obj = { sessionStorage: null };'
  ].join("\n");
  assert.deepEqual(scanPortabilitySource({ file: "game/safe.js", source: safe }), []);
  assert.deepEqual(scanPortabilitySource({ file: "game/binding.gd", source }), []);
});

test("Godot platform-native APIs are classified by incompatible target", async () => {
  const source = await fixture("godot-p1.gd");
  const actual = scanPortabilitySource({ file: "game/demo.gd", source });
  assert.deepEqual(actual.map(x => [x.id, x.line, x.targets.join("/")]),
    [["PF106", 3, "android"], ["PF108", 4, "web"],
     ["PF107", 5, "web"], ["PF404", 6, "web"],
     ["PF403", 7, "web/android"]]);
  assert.deepEqual(scanPortabilitySource({ file: "game/demo.js", source }), []);
  assert.deepEqual(scanPortabilitySource({
    file: "game/guard.gd",
    source: '# Engine.get_singleton("AndroidRuntime")\n' +
      'var example = "JavaScriptBridge.eval(42)"\n' +
      'Input.is_action_pressed("jump")\n'
  }), []);
});

test("adapter declarations cannot launder wrong-target source or escaped paths", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "talarion-p1-"));
  try {
    const game = path.join(root, "game");
    await fs.mkdir(path.join(game, "adapters", "android"), { recursive: true });
    await fs.mkdir(path.join(game, "adapters", "web"), { recursive: true });
    await fs.writeFile(path.join(game, "project.godot"), "[application]\n");
    await fs.writeFile(path.join(game, "export_presets.cfg"), "[preset.0]\n");
    await fs.writeFile(path.join(game, "core.js"),
      'window.localStorage.setItem("x", "y");\n' +
      'window.sessionStorage.getItem("x");\n');
    await fs.writeFile(path.join(game, "adapters", "android", "storage.gd"),
      'JavaClassWrapper.wrap("java.lang.String")\n');
    await fs.writeFile(path.join(game, "adapters", "web", "lifecycle.gd"),
      'JavaClassWrapper.wrap("java.lang.String")\n');
    const base = {
      root, project: { path: "game" },
      toolchain: { godot: path.join(root, "no-godot-binary") }
    };
    const without = await doctor(base);
    assert.deepEqual(without.diagnostics.filter(x => x.id === "PF405")
      .map(x => [x.requiredCapability, x.targets[0], x.status]),
      [["platform.adapter", "web", "missing"],
       ["platform.storage", "android", "missing"]]);
    const config = {
      ...base, portability: { adapters: {
        "platform.storage": { android: "game/adapters/android/storage.gd" },
        "platform.lifecycle": { web: "game/adapters/web/lifecycle.gd" }
      } }
    };
    const valid = await doctor(config);
    assert.equal(valid.ok, true);
    assert.equal(valid.diagnostics.some(x => x.id === "PF405" &&
      x.requiredCapability === "platform.storage"), false);
    // JNI is allowed in an Android adapter but not in a Web adapter.
    assert.ok(valid.diagnostics.some(x => x.id === "PF107" &&
      x.file === "game/adapters/web/lifecycle.gd"));
    assert.ok(valid.diagnostics.some(x => x.id === "PF405" &&
      x.requiredCapability === "platform.adapter" && x.targets[0] === "web"));
    assert.equal(valid.diagnostics.some(x => x.id === "PF107" &&
      x.file === "game/adapters/android/storage.gd"), false);
    assert.ok(valid.diagnostics.some(x => x.id === "PF102" &&
      x.file === "game/core.js"));

    const invalid = await inspectAdapterRegistry({
      ...base, portability: { adapters: {
        "platform.storage": { android: "../outside.gd" }
      } }
    }, game);
    assert.equal(invalid.valid.size, 0);
    assert.equal(invalid.invalid[0].status, "invalid");
    assert.equal(invalid.invalid[0].targets[0], "android");
    const wrongFolder = await inspectAdapterRegistry({
      ...base, portability: { adapters: {
        "platform.storage": { web: "game/adapters/android/storage.gd" }
      } }
    }, game);
    assert.equal(wrongFolder.valid.size, 0);
    assert.equal(wrongFolder.invalid[0].status, "invalid");
    const good = await inspectAdapterRegistry(config, game);
    assert.equal(good.valid.size, 2);
    assert.equal(good.invalid.length, 0);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
