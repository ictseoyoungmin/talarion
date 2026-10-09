import { build } from "./build.mjs";
import { runWeb } from "../runners/web.mjs";
import { runAndroid } from "../runners/android.mjs";

export async function testTargetCommand(config, target) {
  if (!["web", "android"].includes(target)) {
    throw new Error("Usage: talarion test <web|android>");
  }

  const buildResult = await build(config, target);
  if (!buildResult.ok) {
    return {
      ok: false,
      target,
      build: buildResult,
      text: `TALARION TEST — ${target}\nBUILD FAIL`
    };
  }

  const runtime = target === "web"
    ? await runWeb(config)
    : await runAndroid(config);

  return {
    ok: runtime.ok,
    target,
    build: buildResult,
    runtime,
    text: [
      `TALARION TEST — ${target}`,
      "build: PASS",
      `runtime: ${runtime.ok ? "PASS" : "FAIL"}`,
      `state: ${runtime.evidence.stateFile}`,
      `finished tick: ${runtime.finishedTick}`
    ].join("\n")
  };
}
