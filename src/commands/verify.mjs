import { doctor } from "./doctor.mjs";
import { validateReplayCommand } from "./replay.mjs";
import { compareCommand } from "./compare.mjs";
import { resolveFromRoot } from "../core/config.mjs";

export async function verifyCommand(config) {
  const d = await doctor(config);
  const replay = await validateReplayCommand(resolveFromRoot(config, "fixtures/replay/tutorial.tlr.json"));
  const parity = await compareCommand(
    config,
    resolveFromRoot(config, "fixtures/state/web.jsonl"),
    resolveFromRoot(config, "fixtures/state/android.jsonl")
  );
  const ok = d.ok && replay.ok && parity.ok;
  return {
    ok, doctor: d, replay, parity,
    text: [
      "TALARION VERIFY",
      `doctor: ${d.ok ? "PASS" : "FAIL"} (${d.warnings} warning(s))`,
      `replay: ${replay.ok ? "PASS" : "FAIL"}`,
      `fixture parity: ${parity.ok ? "PASS" : "FAIL"} (${(parity.parity*100).toFixed(2)}%)`,
      "",
      ok ? "TL00 STATIC/HARNESS GATE PASS" : "TL00 STATIC/HARNESS GATE FAIL",
      "Note: real Web+Android runtime gate is intentionally still OPEN."
    ].join("\n")
  };
}
