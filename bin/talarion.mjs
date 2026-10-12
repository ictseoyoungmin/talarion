#!/usr/bin/env node
import { loadConfig } from "../src/core/config.mjs";
import { printJson, fail } from "../src/core/io.mjs";
import { doctor } from "../src/commands/doctor.mjs";
import { doctorReportCommand } from "../src/commands/doctor-report.mjs";
import { plan } from "../src/commands/plan.mjs";
import { build } from "../src/commands/build.mjs";
import { validateReplayCommand } from "../src/commands/replay.mjs";
import { compareCommand } from "../src/commands/compare.mjs";
import { reportCommand } from "../src/commands/report.mjs";
import { verifyCommand } from "../src/commands/verify.mjs";
import { testTargetCommand } from "../src/commands/test-target.mjs";
import { visualCommand } from "../src/commands/visual.mjs";
import { tl00AcceptanceCommand } from "../src/runtime/gates.mjs";
import { performanceAuthorityCommand } from "../src/runtime/budget-authority.mjs";
import { performanceReportCommand } from "../src/runtime/performance-report.mjs";
import { iosPreflightCommand } from "../src/ios/preflight.mjs";
import { iosExportCommand } from "../src/ios/export.mjs";
import { inspectAdapterCommand } from "../src/adapters/manifest.mjs";
import { validateCandidateAdapter } from "../src/adapters/candidate.mjs";
import { inspectProjectAdoption } from "../src/commands/project-inspect.mjs";
import { inspectWebNative, devWebNative, testWebNative, defaultWebNativeProject } from "../src/web-native/runtime.mjs";
import { planWebView, buildWebView, testWebView } from "../src/android-webview/runtime.mjs";
import { smokeInteractiveWebView } from "../src/android-webview/interactive.mjs";
import { planReleaseAab, buildReleaseAab, verifyReleaseAab, testReleaseAab } from "../src/android-webview/release.mjs";

const argv = process.argv.slice(2);
const jsonMode = argv.includes("--json");
const args = argv.filter(x => x !== "--json");
const command = args[0];

const help = `
Talarion 0.0.1

Usage:
  talarion doctor [--json]
  talarion doctor report <output-dir> [--json]
  talarion plan [--json]
  talarion project inspect [--json]
  talarion web-native inspect [project-directory] [--json]
  talarion web-native dev [project-directory] [--json]
  talarion web-native test [project-directory] [--json]
  talarion web-native android <plan|build|test|smoke> [project-directory] [--json]
  talarion web-native android release <plan|build|verify|test> [project-directory] [--json]
  talarion adapter inspect [web|android|ios] [--json]
  talarion adapter validate <candidate.json> [target] [--json]
  talarion build <web|android> [--json]
  talarion ios preflight <out.json> [--json]
  talarion ios export <output-dir> [--json]
  talarion test <web|android> [--json]
  talarion replay validate <file> [--json]
  talarion compare <left.jsonl> <right.jsonl> [--json]
  talarion visual compare <web-dir> <android-dir> <out-dir> [--json]
  talarion report <left.jsonl> <right.jsonl> <out.html> [visual-result.json] [web-runner.json] [android-runner.json] [--json]
  talarion verify [--json]
  talarion gate tl00 <web-dir> <android-dir> <visual-result.json> <out.json> [--json]
  talarion budget authority <web-dir> <android-dir> <out.json> [--json]
  talarion budget report current <authority.json> <output-dir> [--json]
  talarion budget report <cohorts.json> <output-dir> [--json]
`;

try {
  const config = await loadConfig(process.cwd());
  let result;
  switch (command) {
    case "doctor":
      if (args[1] === "report") {
        if (!args[2] || args[3]) fail("Usage: talarion doctor report <output-dir> [--json]");
        result = await doctorReportCommand(config, args[2]);
      } else {
        if (args[1]) fail("Usage: talarion doctor [--json]");
        result = await doctor(config);
      }
      break;
    case "ios":
      if (!args[2] || args[3]) fail("Usage: talarion ios <preflight|export> <path>");
      if (args[1] === "preflight") result = await iosPreflightCommand(config, args[2]);
      else if (args[1] === "export") result = await iosExportCommand(config, args[2]);
      else fail("Usage: talarion ios <preflight|export> <path>");
      break;
    case "adapter":
      if (args[1] === "inspect" && !args[3] && args[2] !== "") {
        result = await inspectAdapterCommand(config, args[2] ?? null);
      } else if (args[1] === "validate" && args[2] && !args[4]) {
        result = await validateCandidateAdapter(config, args[2], args[3] ?? null);
      } else {
        fail("Usage: talarion adapter inspect [target] | adapter validate <candidate.json> [target]");
      }
      break;
    case "web-native": {
      if (args[1] === "android") {
        if (args[2] === "release") {
          if (!["plan","build","verify","test"].includes(args[3]) || args[5])
            fail("Usage: talarion web-native android release <plan|build|verify|test> [project-directory] [--json]");
          const gameRoot = args[4] ?? defaultWebNativeProject();
          if (args[3] === "plan") result = await planReleaseAab(gameRoot);
          if (args[3] === "build") result = await buildReleaseAab(gameRoot);
          if (args[3] === "verify") result = await verifyReleaseAab(gameRoot);
          if (args[3] === "test") result = await testReleaseAab(gameRoot);
          break;
        }
        if (!["plan","build","test","smoke"].includes(args[2]) || args[4])
          fail("Usage: talarion web-native android <plan|build|test|smoke> [project-directory] [--json]");
        const gameRoot = args[3] ?? defaultWebNativeProject();
        if (args[2] === "plan") result = await planWebView(gameRoot);
        if (args[2] === "build") result = await buildWebView(gameRoot);
        if (args[2] === "test") result = await testWebView(gameRoot);
        if (args[2] === "smoke") result = await smokeInteractiveWebView(gameRoot);
        break;
      }
      if (!["inspect","dev","test"].includes(args[1]) || args[3]) {
        fail("Usage: talarion web-native <inspect|dev|test> [project-directory] [--json]");
      }
      const projectRoot = args[2] ?? defaultWebNativeProject();
      if (args[1] === "inspect") result = await inspectWebNative(projectRoot);
      if (args[1] === "dev") result = await devWebNative(projectRoot);
      if (args[1] === "test") result = await testWebNative(projectRoot);
      if (args[1] === "dev") result = {
        ...result,server:undefined
      };
      break;
    }
    case "project":
      if (args[1] !== "inspect" || args[2]) {
        fail("Usage: talarion project inspect [--json]");
      }
      result = await inspectProjectAdoption(config);
      break;
    case "plan":
      result = await plan(config);
      break;
    case "build":
      result = await build(config, args[1]);
      break;
    case "test":
      result = await testTargetCommand(config, args[1]);
      break;
    case "replay":
      if (args[1] !== "validate" || !args[2]) fail("Usage: talarion replay validate <file>");
      result = await validateReplayCommand(args[2]);
      break;
    case "compare":
      if (!args[1] || !args[2]) fail("Usage: talarion compare <left.jsonl> <right.jsonl>");
      result = await compareCommand(config, args[1], args[2]);
      break;
    case "visual":
      result = await visualCommand(config, args[1], args[2], args[3], args[4]);
      break;
    case "report":
      if (!args[1] || !args[2] || !args[3]) fail("Usage: talarion report <left> <right> <out.html>");
      result = await reportCommand(config, args[1], args[2], args[3], args[4], args[5], args[6]);
      break;
    case "budget":
      if (args[1] === "authority" && args[2] && args[3] && args[4] && !args[5]) {
        result = await performanceAuthorityCommand(config, args[2], args[3], args[4]);
      } else if (args[1] === "report" && args[2] === "current" &&
          args[3] && args[4] && !args[5]) {
        result = await performanceReportCommand(config, args[3], args[4], true);
      } else if (args[1] === "report" && args[2] && args[3] && !args[4]) {
        result = await performanceReportCommand(config, args[2], args[3]);
      } else {
        fail("Usage: talarion budget authority ... | budget report [current] <input> <output-dir>");
      }
      break;
    case "gate":
      if (args[1] !== "tl00") fail("Usage: talarion gate tl00 <web-dir> <android-dir> <visual-result.json> <out.json>");
      result = await tl00AcceptanceCommand(config, args[2], args[3], args[4], args[5]);
      break;
    case "verify":
      result = await verifyCommand(config);
      break;
    case "help":
    case "--help":
    case "-h":
    case undefined:
      console.log(help.trim());
      process.exit(0);
    default:
      fail(`Unknown command: ${command}\n${help}`);
  }

  if (jsonMode) printJson(result);
  else if (result?.text) console.log(result.text);

  if (result && result.ok === false) process.exitCode = 1;
} catch (error) {
  if (jsonMode) {
    printJson({ ok: false, error: error?.message ?? String(error) });
  } else {
    console.error(`Talarion error: ${error?.message ?? error}`);
  }
  process.exitCode = 1;
}
