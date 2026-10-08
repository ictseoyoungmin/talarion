import test from "node:test";
import assert from "node:assert/strict";
import { classifyGodotExport } from "../src/adapters/godot.mjs";

test("successful Godot export stays successful without fatal diagnostics", () => {
  const result = classifyGodotExport({ ok: true, stdout: "export complete", stderr: "" });
  assert.equal(result.ok, true);
  assert.deepEqual(result.fatalDiagnostics, []);
});

test("script parse errors fail an otherwise zero-exit Godot export", () => {
  const result = classifyGodotExport({
    ok: true,
    stdout: "",
    stderr: 'SCRIPT ERROR: Parse Error: warning treated as error\nERROR: Failed to load script "res://main.gd"'
  });
  assert.equal(result.ok, false);
  assert.equal(result.fatalDiagnostics.length, 2);
});

test("unrelated stderr does not automatically fail Web export", () => {
  const result = classifyGodotExport({
    ok: true,
    stdout: "",
    stderr: "cannot connect to daemon at tcp:5037: Connection refused"
  });
  assert.equal(result.ok, true);
});
