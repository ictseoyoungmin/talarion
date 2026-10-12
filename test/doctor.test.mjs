import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DOCTOR_SCHEMA, DOCTOR_RULES, DOCTOR_RULE_BY_ID, RULE_CLASS,
  PORTABLE_CAPABILITIES, diagnosticFor } from "../src/doctor/rules.mjs";
import { scanPortabilitySource, maskNonCode } from "../src/doctor/scanner.mjs";
import { doctor } from "../src/commands/doctor.mjs";

const read = name => fs.readFile(
  new URL("../fixtures/doctor/" + name, import.meta.url), "utf8");

test("TL01-P0 rule identities, categories, severities and capabilities are stable", () => {
  assert.equal(DOCTOR_SCHEMA, "talarion.doctor/v1");
  assert.deepEqual(DOCTOR_RULES.map(r => r.id),
    ["PF001", "PF002", "PF003", "PF102", "PF103", "PF104"]);
  assert.equal(new Set(DOCTOR_RULES.map(r => r.id)).size, DOCTOR_RULES.length);
  for (const rule of DOCTOR_RULES) {
    assert.equal(rule.category, RULE_CLASS[Number(rule.id[2])]);
    assert.ok(["error", "warning", "info"].includes(rule.severity));
    assert.ok(PORTABLE_CAPABILITIES.includes(rule.capability));
    assert.ok(rule.targets.length > 0);
    assert.equal(DOCTOR_RULE_BY_ID[rule.id], rule);
    assert.ok(rule.remediation.length > 15);
  }
  assert.equal(diagnosticFor("PF102").capability, "platform.storage");
  assert.throws(() => diagnosticFor("PF999"), /Unknown/);
});

test("fixture-based source rule detections carry reproducible line, column and remediation", async () => {
  const web = scanPortabilitySource({ file: "game/browser.js", source: await read("browser.js") });
  assert.deepEqual(web.map(x => [x.id, x.line, x.column]),
    [["PF102", 4, 1], ["PF103", 5, 1]]);
  for (const finding of web) {
    assert.equal(finding.category, "code-api");
    assert.deepEqual(finding.targets, ["android"]);
    assert.equal(finding.file, "game/browser.js");
    assert.ok(finding.remediation.includes("platform."));
  }
  const gd = scanPortabilitySource({ file: "game/input.gd", source: await read("input.gd") });
  assert.deepEqual(gd.map(x => [x.id, x.line, x.column]), [["PF104", 8, 8]]);
  assert.equal(gd[0].capability, "platform.input");
  assert.deepEqual(scanPortabilitySource({
    file: "game/portable.gd", source: await read("portable.gd")
  }), []);
});

test("scanner masks quoted examples, line comments and multiline comments without moving offsets", () => {
  const js = "const s='navigator.vibrate(6)';\r\n/* window.localStorage.x */\n" +
    "navigator.vibrate(8); // navigator.vibrate(9)";
  const masked = maskNonCode(js, ".js");
  assert.equal(masked.length, js.length);
  assert.equal(masked.split("\n").length, js.split("\n").length);
  const result = scanPortabilitySource({ file: "test.ts", source: js });
  assert.deepEqual(result.map(r => [r.id, r.line, r.column]), [["PF103", 3, 1]]);
  assert.deepEqual(scanPortabilitySource({ file: "readme.md", source: js }), []);
});

test("duplicate source occurrences are reported deterministically, never collapsed", () => {
  const source = "Input.is_key_pressed(KEY_1)\nInput.is_key_pressed(KEY_2)\n";
  const a = scanPortabilitySource({ file: "actor.gd", source });
  const b = scanPortabilitySource({ file: "actor.gd", source });
  assert.deepEqual(a, b);
  assert.deepEqual(a.map(d => d.line), [1, 2]);
  assert.deepEqual(a.map(d => d.column), [1, 1]);
});

test("doctor sorts project evidence, ignores generated code and remains warning-only for source rules", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "talarion-doctor-"));
  try {
    const game = path.join(root, "game");
    await fs.mkdir(path.join(game, "nested"), { recursive: true });
    await fs.mkdir(path.join(game, ".godot"), { recursive: true });
    await fs.writeFile(path.join(game, "project.godot"), "[application]\n");
    await fs.writeFile(path.join(game, "export_presets.cfg"), "[preset.0]\n");
    await fs.writeFile(path.join(game, "nested", "actor.gd"), await read("input.gd"));
    await fs.writeFile(path.join(game, "browser.js"), await read("browser.js"));
    await fs.writeFile(path.join(game, ".godot", "generated.gd"), "Input.is_key_pressed(KEY_X)");
    const config = {
      root, project: { path: "game" },
      toolchain: { godot: path.join(root, "missing-godot-bin") }
    };
    const a = await doctor(config), b = await doctor(config);
    assert.equal(a.ok, true);
    assert.equal(a.errors, 0);
    assert.equal(a.schema, DOCTOR_SCHEMA);
    assert.deepEqual(a.checks, b.checks);
    const sourceWarnings = a.diagnostics.filter(x => x.file);
    assert.deepEqual(sourceWarnings.map(x => [x.id, x.file, x.line]),
      [["PF102", "game/browser.js", 4], ["PF103", "game/browser.js", 5],
       ["PF104", "game/nested/actor.gd", 8]]);
    assert.equal(a.warnings, sourceWarnings.length + 1);
    assert.ok(a.text.includes("game/nested/actor.gd:8:8"));
    await fs.rm(path.join(game, "project.godot"));
    const failed = await doctor(config);
    assert.equal(failed.ok, false);
    assert.equal(failed.errors, 1);
    assert.equal(failed.diagnostics.find(x => x.id === "PF001").severity, "error");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
