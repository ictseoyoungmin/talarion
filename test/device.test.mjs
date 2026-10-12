import test from "node:test";
import assert from "node:assert/strict";
import { parseAndroidDeviceInfo } from "../src/runtime/device.mjs";

test("emulator metadata is recorded without device serial or account identities", () => {
  const raw = [
    "[ro.product.model]: [sdk_gphone64_x86_64]",
    "[ro.product.manufacturer]: [Google]",
    "[ro.build.version.sdk]: [30]",
    "[ro.kernel.qemu]: [1]",
    "[ro.build.fingerprint]: [generic/test-keys]",
    "[ro.hardware]: [ranchu]",
    "[ro.serialno]: [DO_NOT_LEAK]"
  ].join("\n");
  const result = parseAndroidDeviceInfo(raw, "GLES: Google, SwiftShader Device");
  assert.equal(result.isEmulator, true);
  assert.equal(result.apiLevel, 30);
  assert.match(result.gles, /SwiftShader/);
  assert.ok(!JSON.stringify(result).includes("DO_NOT_LEAK"));
});

test("physical device flag requires direct system evidence", () => {
  const p = parseAndroidDeviceInfo("[ro.kernel.qemu]: [0]\n[ro.product.model]: [Phone]");
  assert.equal(p.isEmulator, false);
  assert.equal(parseAndroidDeviceInfo("[ro.product.model]: [Phone]").isEmulator, null);
});
