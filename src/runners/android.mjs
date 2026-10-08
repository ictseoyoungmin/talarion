import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { run } from "../core/process.mjs";
import { exists } from "../core/io.mjs";
import { resolveFromRoot } from "../core/config.mjs";
import { parseProtocolLine, writeJsonl, writeJson } from "../runtime/evidence.mjs";
import { runnerResult } from "./contract.mjs";

async function resolveAdb(config) {
  const adb = config.toolchain?.adb || "adb";
  const probe = await run(adb, ["version"]);
  if (!probe.ok) throw new Error("ADB not found. Install Android platform-tools or configure toolchain.adb.");
  return adb;
}

async function requireDevice(adb) {
  const result = await run(adb, ["devices"]);
  if (!result.ok) throw new Error(result.stderr || "adb devices failed");

  const devices = result.stdout
    .split(/\r?\n/)
    .slice(1)
    .map(line => line.trim().split(/\s+/))
    .filter(parts => parts.length >= 2 && parts[1] === "device")
    .map(parts => parts[0]);

  if (devices.length === 0) throw new Error("No authorized Android device or emulator found.");
  if (devices.length > 1 && !process.env.ANDROID_SERIAL) {
    throw new Error("Multiple Android devices are connected. Set ANDROID_SERIAL to select one.");
  }
  return devices;
}

export async function runAndroid(config, options = {}) {
  const timeoutMs = Number(options.timeoutMs ?? 45000);
  const adb = await resolveAdb(config);
  const devices = await requireDevice(adb);
  const apk = resolveFromRoot(config, config.targets.android.output);
  const packageName = config.targets.android.package;

  if (!packageName) throw new Error("targets.android.package is required for the Android runner.");
  if (!(await exists(apk))) throw new Error(`Android build not found: ${apk}`);

  const artifactDir = resolveFromRoot(config, "artifacts/run/android");
  await fs.rm(artifactDir, { recursive: true, force: true });
  await fs.mkdir(artifactDir, { recursive: true });

  const install = await run(adb, ["install", "-r", apk]);
  if (!install.ok) throw new Error(install.stderr || install.stdout || "adb install failed");

  await run(adb, ["logcat", "-c"]);
  await run(adb, ["shell", "am", "force-stop", packageName]);

  const states = [];
  const captures = [];
  const runtimeErrors = [];

  let resolveFinished;
  let rejectFinished;
  const finished = new Promise((resolve, reject) => {
    resolveFinished = resolve;
    rejectFinished = reject;
  });

  const logcat = spawn(adb, ["logcat", "-v", "raw"], {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  let buffer = "";
  const consume = chunk => {
    buffer += chunk.toString("utf8");
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const parsed = parseProtocolLine(line);
      if (!parsed) continue;

      if (parsed.kind === "state" && parsed.value && typeof parsed.value === "object") {
        states.push(parsed.value);
      }
      if (parsed.kind === "capture" && parsed.value && typeof parsed.value === "object") {
        captures.push(parsed.value);
      }
      if (parsed.kind === "finished") resolveFinished(parsed.value);
    }
  };

  logcat.stdout.on("data", consume);
  logcat.stderr.on("data", chunk => runtimeErrors.push(chunk.toString("utf8").trim()));
  logcat.on("error", error => rejectFinished(error));

  const timer = setTimeout(
    () => rejectFinished(new Error(`Android replay timed out after ${timeoutMs} ms`)),
    timeoutMs
  );

  try {
    const launch = await run(adb, [
      "shell", "monkey",
      "-p", packageName,
      "-c", "android.intent.category.LAUNCHER",
      "1"
    ]);
    if (!launch.ok) throw new Error(launch.stderr || launch.stdout || "Android launch failed");

    const finishedTick = await finished;
    if (buffer) consume("\n");

    const stateFile = path.join(artifactDir, "state.jsonl");
    await writeJsonl(stateFile, states);

    const result = runnerResult({
      target: "android",
      build: apk,
      replay: resolveFromRoot(config, config.replay.default),
      stateFile,
      screenshots: [],
      performance: null,
      warnings: [
        ...runtimeErrors.filter(Boolean),
        ...(captures.length ? [`${captures.length} capture checkpoint(s) observed; screenshot capture is TL00-R2.`] : [])
      ],
      ok: states.length > 0
    });
    result.finishedTick = finishedTick;
    result.devices = devices;

    const resultFile = path.join(artifactDir, "runner-result.json");
    await writeJson(resultFile, result);
    return { ...result, resultFile };
  } finally {
    clearTimeout(timer);
    logcat.kill("SIGTERM");
  }
}
