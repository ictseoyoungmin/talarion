import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { run } from "../core/process.mjs";
import { exists } from "../core/io.mjs";
import { resolveFromRoot } from "../core/config.mjs";
import { parseProtocolLine, writeJsonl, writeJson } from "../runtime/evidence.mjs";
import { runnerResult } from "./contract.mjs";
import { summarizePerformance } from "../runtime/performance.mjs";
import { parseAndroidDeviceInfo } from "../runtime/device.mjs";
import { sha256File } from "../runtime/provenance.mjs";

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

async function captureAndroidPng(adb, file, packageName) {
  // A passing game-state replay is not proof the game is actually visible.
  // Abort instead of recording OS dialogs or a crashed launcher as game images.
  const focus = await run(adb, ["shell", "dumpsys", "window"]);
  if (!focus.ok) throw new Error("Cannot inspect foreground Android window: " + focus.stderr);
  const line = focus.stdout.split(/\r?\n/).find(text => /mCurrentFocus\s*=/.test(text));
  if (!line || !line.includes(packageName)) {
    throw new Error("Game is not foreground during capture; Android focus: " + (line?.trim() ?? "unknown"));
  }
  await fs.mkdir(path.dirname(file), { recursive: true });

  return new Promise((resolve, reject) => {
    const child = spawn(adb, ["exec-out", "screencap", "-p"], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const chunks = [];
    let stderr = "";

    child.stdout.on("data", chunk => chunks.push(Buffer.from(chunk)));
    child.stderr.on("data", chunk => stderr += chunk.toString("utf8"));
    child.on("error", reject);
    child.on("close", async code => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `adb screencap failed with exit code ${code}`));
        return;
      }
      try {
        await fs.writeFile(file, Buffer.concat(chunks));
        resolve(file);
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function runAndroid(config, options = {}) {
  const timeoutMs = Number(options.timeoutMs ?? 90000);
  const adb = await resolveAdb(config);
  const devices = await requireDevice(adb);
  const apk = resolveFromRoot(config, config.targets.android.output);
  const packageName = config.targets.android.package;

  if (!packageName) throw new Error("targets.android.package is required for the Android runner.");
  if (!(await exists(apk))) throw new Error(`Android build not found: ${apk}`);

  const [deviceProps, displayProps] = await Promise.all([
    run(adb, ["shell", "getprop"]),
    run(adb, ["shell", "dumpsys", "SurfaceFlinger"])
  ]);
  const device = parseAndroidDeviceInfo(deviceProps.stdout, displayProps.stdout);

  const artifactDir = resolveFromRoot(config, "artifacts/run/android");
  await fs.rm(artifactDir, { recursive: true, force: true });
  await fs.mkdir(artifactDir, { recursive: true });

  const install = await run(adb, ["install", "-r", apk]);
  if (!install.ok) throw new Error(install.stderr || install.stdout || "adb install failed");

  await run(adb, ["logcat", "-c"]);
  await run(adb, ["shell", "am", "force-stop", packageName]);

  const states = [];
  const performanceSamples = [];
  const screenshots = [];
  const runtimeErrors = [];
  let captureQueue = Promise.resolve();

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

      if (parsed.kind === "performance") performanceSamples.push(parsed.value);

      if (parsed.kind === "capture" && parsed.value && typeof parsed.value === "object") {
        const name = String(parsed.value.name ?? `tick-${parsed.value.tick ?? "unknown"}`);
        const tick = parsed.value.tick;
        const file = path.join(artifactDir, `${name}.png`);
        captureQueue = captureQueue.then(async () => {
          try {
            await captureAndroidPng(adb, file, packageName);
            screenshots.push({ checkpoint: name, tick, file });
          } catch (error) {
            runtimeErrors.push(`Screenshot ${name} failed: ${error?.message ?? error}`);
          }
        });
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
    await captureQueue;

    const stateFile = path.join(artifactDir, "state.jsonl");
    const performanceFile = path.join(artifactDir, "performance.jsonl");
    await Promise.all([
      writeJsonl(stateFile, states),
      writeJsonl(performanceFile, performanceSamples)
    ]);
    const performance = summarizePerformance(performanceSamples, {
      target: "android", targetFps: config.profiles?.[config.targets.android.profile]?.targetFps,
      sampleFile: performanceFile
    });

    const result = runnerResult({
      target: "android",
      build: apk,
      replay: resolveFromRoot(config, config.replay.default),
      stateFile,
      screenshots,
      performance,
      warnings: runtimeErrors.filter(Boolean),
      ok: states.length > 0 && performance.ok && runtimeErrors.length === 0
    });
    result.finishedTick = finishedTick;
    result.devices = devices.map(() => "(redacted)");
    result.device = device;
    result.provenance = {
      apkSha256: await sha256File(apk),
      replaySha256: await sha256File(resolveFromRoot(config, config.replay.default))
    };
    await writeJson(path.join(artifactDir, "device.json"), device);

    const resultFile = path.join(artifactDir, "runner-result.json");
    await writeJson(resultFile, result);
    return { ...result, resultFile };
  } finally {
    clearTimeout(timer);
    logcat.kill("SIGTERM");
  }
}
