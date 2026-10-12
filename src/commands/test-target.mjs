import { build } from "./build.mjs";
import { resolveAdapterExecution } from "../adapters/dispatch.mjs";

export async function testTargetCommand(config, target) {
  if (!target) throw new Error("Usage: talarion test <web|android>");

  const buildResult = await build(config, target);
  if (!buildResult.ok) {
    return {
      ok: false,
      target,
      build: buildResult,
      text: `TALARION TEST — ${target}\nBUILD FAIL`
    };
  }

  // Reconfirm the allowlisted binding before executing a target runner.
  const dispatch = await resolveAdapterExecution(config, target);
  if (!dispatch.report.ok) {
    return {
      ok: false,
      target,
      status: "blocked",
      build: buildResult,
      adapter: dispatch.report,
      text: `TALARION TEST — ${target}\nADAPTER BLOCKED`
    };
  }
  const runtime = await dispatch.handlers.runTarget(config);

  return {
    ok: runtime.ok,
    target,
    build: buildResult,
    runtime,
    adapter: dispatch.report,
    text: [
      `TALARION TEST — ${target}`,
      "build: PASS",
      `runtime: ${runtime.ok ? "PASS" : "FAIL"}`,
      `state: ${runtime.evidence.stateFile}`,
      `finished tick: ${runtime.finishedTick}`
    ].join("\n")
  };
}
