import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/core/config.mjs";
import { plan } from "../src/commands/plan.mjs";

test("plan reports configured targets, not an unimplemented dependency graph", async () => {
  const config = await loadConfig(process.cwd());
  const result = await plan(config);
  assert.equal(result.ok, true);
  assert.deepEqual(result.targets.map(t => t.target), ["web", "android"]);
  assert.match(result.text, /TALARION BUILD TARGET PLAN/);
  assert.doesNotMatch(result.text, /BUILD GRAPH/);
});
