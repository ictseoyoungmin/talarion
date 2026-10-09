#!/usr/bin/env node
import { loadConfig } from "../src/core/config.mjs";
import { printJson, fail } from "../src/core/io.mjs";
import { doctor } from "../src/commands/doctor.mjs";
import { plan } from "../src/commands/plan.mjs";
import { build } from "../src/commands/build.mjs";
import { validateReplayCommand } from "../src/commands/replay.mjs";
import { compareCommand } from "../src/commands/compare.mjs";
import { reportCommand } from "../src/commands/report.mjs";
import { verifyCommand } from "../src/commands/verify.mjs";
import { testTargetCommand } from "../src/commands/test-target.mjs";
import { visualCommand } from "../src/commands/visual.mjs";

const argv = process.argv.slice(2);
const jsonMode = argv.includes("--json");
const args = argv.filter(x => x !== "--json");
const command = args[0];

const help = `
Talarion 0.0.1

Usage:
  talarion doctor [--json]
  talarion plan [--json]
  talarion build <web|android> [--json]
  talarion test <web|android> [--json]
  talarion replay validate <file> [--json]
  talarion compare <left.jsonl> <right.jsonl> [--json]
  talarion visual compare <web-dir> <android-dir> <out-dir> [--json]
  talarion report <left.jsonl> <right.jsonl> <out.html> [visual-result.json] [web-runner.json] [android-runner.json] [--json]
  talarion verify [--json]
`;

try {
  const config = await loadConfig(process.cwd());
  let result;
  switch (command) {
    case "doctor":
      result = await doctor(config);
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
