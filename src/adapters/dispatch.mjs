import { inspectAdapterCommand } from "./manifest.mjs";
import { exportGodot } from "./godot.mjs";
import { runWeb } from "../runners/web.mjs";
import { runAndroid } from "../runners/android.mjs";

export const ADAPTER_DISPATCH_SCHEMA = "talarion.adapter-dispatch/v1";

// P1 is an explicit implementation binding, not a dynamic plugin loader.
// A manifest path does not authorize importing arbitrary code from a project.
const IMPLEMENTATIONS = Object.freeze({
  godot: Object.freeze({
    web: Object.freeze({
      exportPath: "src/adapters/godot.mjs",
      runnerPath: "src/runners/web.mjs",
      exportProject: exportGodot,
      runTarget: runWeb
    }),
    android: Object.freeze({
      exportPath: "src/adapters/godot.mjs",
      runnerPath: "src/runners/android.mjs",
      exportProject: exportGodot,
      runTarget: runAndroid
    })
  })
});

export async function resolveAdapterExecution(config, target, options = {}) {
  const inspection = await inspectAdapterCommand(config, target, options);
  const implementation = IMPLEMENTATIONS[config?.project?.engine]?.[target];
  const declared = inspection.targets.find(item => item.target === target);
  const checks = [
    {
      id: "AD001",
      ok: inspection.ok,
      detail: "Static manifest, target, configuration and entrypoint checks pass"
    },
    {
      id: "AD002",
      ok: !!implementation && declared?.status === "supported",
      detail: "Target has a registered concrete engine and runner implementation"
    },
    {
      id: "AD003",
      ok: !!implementation &&
        declared?.entrypoints?.export === implementation.exportPath &&
        declared?.entrypoints?.runner === implementation.runnerPath,
      detail: "Manifest entrypoints match the immutable built-in implementation binding"
    },
    {
      id: "AD004",
      ok: declared?.capabilities?.export === "supported" &&
        declared?.capabilities?.replay === "supported" &&
        declared?.capabilities?.state === "supported" &&
        declared?.capabilities?.visual === "supported" &&
        declared?.capabilities?.performance === "supported",
      detail: "Runtime capabilities are explicitly declared, not assumed"
    }
  ];
  const ok = checks.every(check => check.ok);
  const report = {
    schema: ADAPTER_DISPATCH_SCHEMA,
    ok,
    status: ok ? "bound" : "blocked",
    adapterId: inspection.adapterId,
    engine: config?.project?.engine ?? null,
    target,
    authority: "validated-source-binding-only",
    runtimeObserved: false,
    parityCertified: false,
    hardwareCertified: false,
    checks,
    inspection
  };
  return {
    report,
    handlers: ok ? {
      exportProject: implementation.exportProject,
      runTarget: implementation.runTarget
    } : null
  };
}
