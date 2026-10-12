import fs from "node:fs/promises";
import path from "node:path";
import { compareCommand } from "../commands/compare.mjs";
import { sha256File } from "./provenance.mjs";
import { resolveFromRoot } from "../core/config.mjs";

const validHash = x => typeof x === "string" && /^[a-f0-9]{64}$/i.test(x);

// TL00 certifies repeatable cross-runtime QA for one sample, NOT hardware.
// Device-performance certification is deliberately a separate release decision.
export function assessTl00({ web, android, visual, state, expectedTick, expectedCaptures, replayHash }) {
  const checks = [];
  const check = (id, ok, detail) => checks.push({ id, ok: !!ok, detail });
  check("TL00-01", !!web?.ok && web.schema === "talarion.runner-result/v1" && web.target === "web",
    "Web exported runtime completed with valid runner evidence");
  check("TL00-02", !!android?.ok && android.schema === "talarion.runner-result/v1" && android.target === "android",
    "Android exported runtime completed with valid runner evidence");
  check("TL00-03", web?.finishedTick === expectedTick && android?.finishedTick === expectedTick,
    "Both runtimes finished the canonical replay tick");
  check("TL00-04", !!state?.ok && state.total >= 15 && state.matched === state.total,
    "Real runtime states match at all required snapshot keys (at least 15)");
  check("TL00-05", visual?.schema === "talarion.visual-parity/v1" && visual.ok === true &&
    visual.expectedCheckpoints === expectedCaptures &&
    visual.passedCheckpoints === expectedCaptures && expectedCaptures >= 3 &&
    Array.isArray(visual.results) && visual.results.length === expectedCaptures &&
    visual.results.every(r => r.ok === true && Number.isFinite(r.maxTileError)),
    "All named captures match global and spatial visual gates");
  check("TL00-06", validHash(replayHash) && web?.provenance?.replaySha256 === replayHash &&
    android?.provenance?.replaySha256 === replayHash && validHash(android?.provenance?.apkSha256),
    "Authoritative replay SHA-256 and Android APK fingerprint recorded");
  check("TL00-07", android?.device?.schema === "talarion.android-device/v1" &&
    [true, false].includes(android?.device?.isEmulator) &&
    Number.isInteger(android?.device?.apiLevel) && android.device.apiLevel > 0,
    "Android target and emulator/hardware identity explicitly identified");
  for (const [key, run] of [["web", web], ["android", android]]) {
    const perf = run?.evidence?.performance;
    check("TL00-08-" + key, perf?.schema === "talarion.performance/v1" &&
      perf.target === key && perf.ok === true && perf.sampleCount >= 3 &&
      typeof perf.fpsMedian === "number" && Number.isFinite(perf.fpsMedian) &&
      typeof perf.peakMemoryBytes === "number" && Number.isFinite(perf.peakMemoryBytes),
      key + " collected valid observational performance data, without target-FPS certification");
  }
  return {
    schema: "talarion.tl00-acceptance/v1",
    ok: checks.every(c => c.ok),
    scope: "exported-web-and-android-runtime-parity",
    hardwareCertified: false,
    checks,
    text: "TALARION TL00 ACCEPTANCE\n" +
      checks.map(c => (c.ok ? "PASS " : "FAIL ") + c.id + " — " + c.detail).join("\n") +
      "\n" + (checks.every(c => c.ok) ? "TL00 ACCEPTANCE PASS" : "TL00 ACCEPTANCE FAIL") +
      "\nNote: physical Android device certification is a separate release gate."
  };
}

export function assessHardwareCertification({ device, measurements, lifecycle, compatibility } = {}) {
  const checks = [
    { id: "RC-01", ok: device?.schema === "talarion.android-device/v1" &&
      device.isEmulator === false && Number.isInteger(device.apiLevel),
      detail: "Physical hardware is positively identified, not an emulator" },
    { id: "RC-02", ok: measurements?.reviewed === true &&
      measurements?.source === "physical-device" && measurements?.budgetPassed === true,
      detail: "Device-specific FPS/memory/thermal targets reviewed and passed" },
    { id: "RC-03", ok: lifecycle?.passed === true && compatibility?.passed === true,
      detail: "Lifecycle and device compatibility validated" }
  ];
  return {
    schema: "talarion.hardware-certification/v1",
    ok: checks.every(c => c.ok),
    hardwareCertified: checks.every(c => c.ok),
    checks
  };
}

export async function tl00AcceptanceCommand(config, webDir, androidDir, visualFile, outputFile) {
  if (![webDir, androidDir, visualFile, outputFile].every(Boolean)) {
    throw new Error("Usage: talarion gate tl00 <web-dir> <android-dir> <visual-result.json> <out.json>");
  }
  const load = file => fs.readFile(path.resolve(file), "utf8").then(JSON.parse);
  const [web, android, visual] = await Promise.all([
    load(path.join(webDir, "runner-result.json")),
    load(path.join(androidDir, "runner-result.json")),
    load(visualFile)
  ]);
  const replayFile = resolveFromRoot(config, config.replay.default);
  const replay = await load(replayFile);
  if (!Array.isArray(replay.events) || !replay.events.length) throw Error("Invalid canonical replay");
  const [state, replayHash] = await Promise.all([
    compareCommand(config, path.join(webDir, "state.jsonl"), path.join(androidDir, "state.jsonl")),
    sha256File(replayFile)
  ]);
  const result = assessTl00({
    web, android, visual, state,
    expectedTick: Math.max(...replay.events.map(e => e.tick)),
    expectedCaptures: replay.events.filter(e => e.type === "capture").length,
    replayHash
  });
  const filename = path.resolve(outputFile);
  await fs.mkdir(path.dirname(filename), { recursive: true });
  await fs.writeFile(filename, JSON.stringify(result, null, 2) + "\n", "utf8");
  return { ...result, output: filename };
}
