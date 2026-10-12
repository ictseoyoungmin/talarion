import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/core/config.mjs";
import { checkRuntimeContract } from "../src/runtime/contract-check.mjs";

test("TL00 runtime bridge contract is structurally complete", async () => {
  const config = await loadConfig(process.cwd());
  const result = await checkRuntimeContract(config);
  assert.equal(result.ok, true, JSON.stringify(result.checks, null, 2));
});
