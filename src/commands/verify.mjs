import { doctor } from "./doctor.mjs";
import { validateReplayCommand } from "./replay.mjs";
import { compareCommand } from "./compare.mjs";
import { resolveFromRoot } from "../core/config.mjs";
import { checkRuntimeContract } from "../runtime/contract-check.mjs";
import { inspectAdapterCommand } from "../adapters/manifest.mjs";

export async function verifyCommand(config) {
  const d = await doctor(config);
  const replay = await validateReplayCommand(resolveFromRoot(config, config.replay.default));
  const bridge = await checkRuntimeContract(config);
  const adapter = await inspectAdapterCommand(config);
  const parity = await compareCommand(
    config,
    resolveFromRoot(config, "fixtures/state/web.jsonl"),
    resolveFromRoot(config, "fixtures/state/android.jsonl")
  );
  const ok = d.ok && replay.ok && bridge.ok && parity.ok && adapter.ok;
  return {
    ok, doctor: d, replay, bridge, parity, adapter,
    text: [
      "TALARION VERIFY",
      `doctor: ${d.ok ? "PASS" : "FAIL"} (${d.warnings} warning(s))`,
      `replay: ${replay.ok ? "PASS" : "FAIL"}`,
      `runtime contract: ${bridge.ok ? "PASS" : "FAIL"}`,
      `adapter manifest: ${adapter.ok ? "PASS" : "FAIL"} (static only)`,
      `fixture parity: ${parity.ok ? "PASS" : "FAIL"} (${(parity.parity*100).toFixed(2)}%)`,
      "",
      ok ? "TL00 STATIC/HARNESS GATE PASS" : "TL00 STATIC/HARNESS GATE FAIL",
      "Note: static/fixture verification is not TL00 acceptance. Run exported Web + Android emulator CI and `talarion gate tl00`."
    ].join("\n")
  };
}
