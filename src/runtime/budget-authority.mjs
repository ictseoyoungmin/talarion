import fs from "node:fs/promises";
import path from "node:path";
import { summarizePerformance } from "./performance.mjs";
import { sha256File } from "./provenance.mjs";
import { resolveFromRoot } from "../core/config.mjs";
import { analyzeBudgetProfile } from "./budget-profile.mjs";
import { summarizePerformanceWindow } from "./performance-window.mjs";

export const AUTHORITY_SCHEMA = "talarion.performance-authority/v1";
const RUNNER_SCHEMA = "talarion.runner-result/v1";
const validHash = v => typeof v === "string" && /^[0-9a-f]{64}$/i.test(v);
const comparable = ["sampleCount", "fpsP10", "fpsMedian", "processMsP95",
  "physicsMsP95", "peakMemoryBytes", "targetFps"];
const finiteNonnegative = v => typeof v === "number" && Number.isFinite(v) && v >= 0;
const budgetValue = v => finiteNonnegative(v) && v > 0 ? v : null;
const text = result => "TALARION PERFORMANCE AUTHORITY\n" +
  result.targets.map(t => {
    const label = t.target.toUpperCase() + " " + (t.ok ? "VERIFIED" : "UNVERIFIED");
    return label + " — " + t.runtimeKind +
      " / " + t.observation.status + " / budget " + t.budgetDecision;
  }).join("\n") +
  "\n" + (result.ok ? "EVIDENCE CONTRACT PASS" : "EVIDENCE CONTRACT FAIL") +
  "\nNo target FPS, GPU or physical-device certification.";

export function assessPerformanceAuthority({ config, manifests, samples, replaySha256,
  sampleHashes = {}, replayEndTick = null, replayTickRate = null } = {}) {
  const targets = [];
  for (const target of ["web", "android"]) {
    const runner = manifests?.[target];
    const profileName = config?.targets?.[target]?.profile ?? null;
    const profile = profileName ? config?.profiles?.[profileName] : null;
    const goal = budgetValue(profile?.targetFps);
    const declared = {
      profile: profileName,
      targetFps: goal,
      drawCallBudget: budgetValue(profile?.drawCallBudget),
      scope: "declared-only"
    };
    const runtimeKind = target === "web"
      ? runner?.browser === "playwright-chromium-headless"
        ? "headless-browser" : "unknown-web-runtime"
      : runner?.device?.isEmulator === true ? "android-emulator"
        : runner?.device?.isEmulator === false ? "android-physical-unreviewed"
          : "unknown-android-device";
    const checks = [];
    const check = (id, condition, detail) => checks.push({
      id, ok: condition === true, detail
    });
    check("PA01", runner?.schema === RUNNER_SCHEMA && runner?.target === target &&
      runner.ok === true, "Runner manifest identifies a successful exported target.");
    check("PA02", validHash(replaySha256) &&
      runner?.provenance?.replaySha256 === replaySha256 &&
      (target === "web" || validHash(runner?.provenance?.apkSha256)),
    "Both runner replay identity and Android APK provenance must be present.");
    check("PA03", runtimeKind !== "unknown-web-runtime" &&
      runtimeKind !== "unknown-android-device" &&
      (target === "web" || (
        runner.device.schema === "talarion.android-device/v1" &&
        Number.isInteger(runner.device.apiLevel) && runner.device.apiLevel > 0)),
    "Runtime class and Android device/emulator identity must be explicit.");
    const reported = runner?.evidence?.performance;
    const recomputed = summarizePerformance(samples?.[target] ?? [], {
      target, targetFps: goal,
      sampleFile: reported?.sampleFile
    });
    check("PA04", reported?.schema === "talarion.performance/v1" &&
      reported.target === target && reported.ok === true &&
      recomputed.ok && recomputed.sampleCount >= 3 &&
      reported.mode === "observational-ci-emulator-not-device-certified",
    "Raw engine observations contain at least three valid, ordered samples.");
    check("PA05", checks.at(-1).ok &&
      comparable.every(key => Object.is(reported[key], recomputed[key])),
    "Recomputed raw samples must exactly agree with the runner summary and declared FPS.");
    check("PA06", validHash(sampleHashes[target]),
      "Raw performance samples have a SHA-256 content fingerprint.");
    const sourceTrusted = checks.every(c => c.ok);
    const coverage = analyzeBudgetProfile(profile, {
      fpsP10: recomputed.fpsP10,
      processMsP95: recomputed.processMsP95,
      peakMemoryBytes: recomputed.peakMemoryBytes
    }, sourceTrusted);
    check("PA07", coverage.errors.every(e => e.code !== "BP01" && e.code !== "BP02"),
      "Target profile exists and budget values use positive, type-correct quantities.");
    check("PA08", coverage.errors.every(e => e.code !== "BP03" && e.code !== "BP04"),
      "Optional explicit budget units agree with the fixed metric units.");
    const ok = checks.every(c => c.ok);
    const performanceWindow = summarizePerformanceWindow(samples?.[target] ?? [], {
      window: config?.performanceWindow ?? null,
      replayEndTick, replayTickRate, evidenceVerified: ok
    });
    targets.push({
      target, ok, runtimeKind,
      declared, budgetCoverage: coverage, performanceWindow,
      observation: {
        status: ok ? "validated-runner-observation" : "unverified",
        source: "engine-protocol-jsonl",
        sampleSha256: validHash(sampleHashes[target]) ? sampleHashes[target] : null,
        replaySha256: validHash(replaySha256) ? replaySha256 : null,
        sampleCount: ok ? recomputed.sampleCount : null,
        metrics: ok ? {
          fpsP10: recomputed.fpsP10,
          fpsMedian: recomputed.fpsMedian,
          processMsP95: recomputed.processMsP95,
          physicsMsP95: recomputed.physicsMsP95,
          peakMemoryBytes: recomputed.peakMemoryBytes
        } : null,
        unobserved: ["gpuTextureMemoryBytes", "drawCalls", "thermalHeadroom"]
      },
      budgetDecision: "not-evaluated",
      hardwareCertified: false,
      checks
    });
  }
  const result = {
    schema: AUTHORITY_SCHEMA,
    ok: targets.every(t => t.ok),
    scope: "manifest-and-raw-engine-telemetry-contract",
    certification: {
      physicalDevice: false, targetFps: false,
      drawCalls: false, thermal: false
    },
    targets,
    notes: [
      "Validated runner observations are not statistically robust budget decisions.",
      "The source runner manifest and sample files require trusted CI provenance.",
      "A physical Android device class does not itself grant release certification."
    ]
  };
  result.text = text(result);
  return result;
}

function parseJsonl(source) {
  return source.split(/\r?\n/).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); }
    catch { throw new Error("Invalid performance JSONL line " + (index + 1)); }
  });
}

export async function performanceAuthorityCommand(config, webDir, androidDir, outputFile) {
  if (![webDir, androidDir, outputFile].every(Boolean)) {
    throw new Error("Usage: talarion budget authority <web-dir> <android-dir> <out.json>");
  }
  const directories = { web: webDir, android: androidDir };
  const manifests = {}, samples = {}, sampleHashes = {};
  for (const target of ["web", "android"]) {
    const dir = path.resolve(directories[target]);
    const manifest = await fs.readFile(path.join(dir, "runner-result.json"), "utf8");
    const sampleFile = path.join(dir, "performance.jsonl");
    manifests[target] = JSON.parse(manifest);
    samples[target] = parseJsonl(await fs.readFile(sampleFile, "utf8"));
    sampleHashes[target] = await sha256File(sampleFile);
  }
  const replayFile = resolveFromRoot(config, config.replay.default);
  const replaySha256 = await sha256File(replayFile);
  // Legacy P0 callers can supply opaque replay bytes for hash-only verification.
  // P2 windows then remain unconfigured/invalid instead of breaking P0 authority.
  let replay = null;
  try { replay = JSON.parse(await fs.readFile(replayFile, "utf8")); }
  catch (error) { if (error?.code === "ENOENT") throw error; }
  const replayTickRate = replay?.tickRate;
  const replayEndTick = replay?.schema === "talarion.replay/v1" &&
    Array.isArray(replay.events) && replay.events.length &&
    replay.events.every(e => Number.isSafeInteger(e.tick) && e.tick >= 0)
    ? Math.max(...replay.events.map(e => e.tick)) : null;
  const result = assessPerformanceAuthority({
    config, manifests, samples, sampleHashes, replaySha256,
    replayEndTick, replayTickRate
  });
  const output = path.resolve(outputFile);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(result, null, 2) + "\n", "utf8");
  return { ...result, output };
}
