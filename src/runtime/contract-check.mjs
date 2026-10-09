import fs from "node:fs/promises";
import path from "node:path";
import { exists, readJson } from "../core/io.mjs";
import { resolveFromRoot } from "../core/config.mjs";

export async function checkRuntimeContract(config) {
  const checks = [];
  const replayPath = resolveFromRoot(config, config.replay?.default ?? "");
  const projectDir = resolveFromRoot(config, config.project.path);
  const bridgePath = path.join(projectDir, "talarion_bridge.gd");
  const projectFile = path.join(projectDir, "project.godot");

  const replayExists = await exists(replayPath);
  checks.push({ id: "PF601", ok: replayExists, message: replayExists ? "default replay found" : "default replay missing" });

  let replay = null;
  if (replayExists) {
    replay = await readJson(replayPath);
    const events = Array.isArray(replay.events) ? replay.events : [];
    const lastTick = events.length ? Math.max(...events.map(e => Number(e.tick) || 0)) : 0;
    const tickRate = Number(replay.tickRate) || 0;
    const duration = tickRate > 0 ? lastTick / tickRate : 0;
    const minDuration = Number(config.replay?.minimumDurationSeconds ?? 0);
    checks.push({
      id: "PF602",
      ok: duration >= minDuration,
      message: `replay duration ${duration.toFixed(2)}s (minimum ${minDuration.toFixed(2)}s)`
    });
  }

  const bridgeExists = await exists(bridgePath);
  checks.push({ id: "PF603", ok: bridgeExists, message: bridgeExists ? "Godot TalarionBridge source found" : "Godot TalarionBridge source missing" });

  let autoload = false;
  if (await exists(projectFile)) {
    const text = await fs.readFile(projectFile, "utf8");
    autoload = /\[autoload\][\s\S]*TalarionBridge\s*=/.test(text);
  }
  checks.push({ id: "PF604", ok: autoload, message: autoload ? "TalarionBridge autoload configured" : "TalarionBridge autoload missing" });

  const ok = checks.every(c => c.ok);
  return { ok, checks, replayPath, bridgePath };
}
