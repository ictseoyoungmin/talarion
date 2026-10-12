import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ADAPTER_MANIFEST_SCHEMA = "talarion.adapter-manifest/v1";
export const ADAPTER_INSPECTION_SCHEMA = "talarion.adapter-inspection/v1";
export const ADAPTER_CAPABILITIES = Object.freeze(["project-inspection","export","replay","state","visual","performance"]);
const STATES = new Set(["supported", "unsupported", "unknown"]);
const MANIFEST_FILE = fileURLToPath(new URL("./godot.manifest.json", import.meta.url));
const isObject = x => x !== null && typeof x === "object" && !Array.isArray(x);
const validId = x => typeof x === "string" && /^[a-z][a-z0-9-]*$/.test(x);
const validValue = x => typeof x === "string" && x.trim().length > 0;

function safeModule(relative) {
  return typeof relative === "string" &&
    relative.split("/").every(x => x !== "" && x !== "." && x !== "..") &&
    !relative.includes("\\") && !relative.includes(":") &&
    !relative.startsWith("/") && relative.endsWith(".mjs");
}

// Contract assessment is a pure, deterministic structural check. It cannot
// attest to running an engine, renderer, phone or iOS simulator.
export function assessAdapterManifest(manifest, config, requestedTarget = null) {
  const checks = [];
  const check = (id, pass, detail, target = null) => {
    checks.push({ id, status: pass ? "pass" : "fail", detail, ...(target ? { target } : {}) });
  };
  check("AM001", isObject(manifest) && manifest.schema === ADAPTER_MANIFEST_SCHEMA,
    "Recognized versioned adapter manifest schema");
  check("AM002", validId(manifest?.id) && manifest?.authority === "declared-interface-only",
    "Adapter ID and declaration-only authority");
  check("AM003", isObject(manifest?.engine) && validId(manifest.engine.id) &&
    manifest.engine.versionPolicy === "configuration-recommended" &&
    manifest.engine.id === config?.project?.engine &&
    /^\d+\.\d+(?:\.\d+)?$/.test(config?.toolchain?.recommendedVersion ?? ""),
    "Engine identity and configured version policy; no binary version attestation");
  const entries = isObject(manifest?.targets) ? Object.entries(manifest.targets).sort(([a],[b])=>a.localeCompare(b)) : [];
  check("AM004", entries.length > 0 && entries.every(([id])=>validId(id)),
    "Explicit, well-formed target catalog");
  const targets = [];
  const allowed = new Set(ADAPTER_CAPABILITIES);
  for (const [target, item] of entries) {
    const valid = isObject(item);
    const state = valid && STATES.has(item.status) ? item.status : "unknown";
    check("AM010", valid && STATES.has(item.status), "Explicit target support state", target);
    const caps = valid && isObject(item.capabilities) ? item.capabilities : {};
    const allCaps = ADAPTER_CAPABILITIES.every(name => STATES.has(caps[name])) &&
      Object.keys(caps).length === ADAPTER_CAPABILITIES.length &&
      Object.keys(caps).every(name => allowed.has(name));
    check("AM011", allCaps, "Complete six-capability matrix without implicit defaults", target);
    const consistent = allCaps && (state === "supported"
      ? ADAPTER_CAPABILITIES.every(name => caps[name] === "supported")
      : ADAPTER_CAPABILITIES.every(name => caps[name] !== "supported"));
    check("AM012", consistent, "Capability states agree with target support authority", target);
    const endpoints = item?.entrypoints;
    const endpointsValid = state === "supported"
      ? isObject(endpoints) && Object.keys(endpoints).sort().join(",") === "export,runner" &&
        safeModule(endpoints.export) && safeModule(endpoints.runner)
      : endpoints === undefined;
    check("AM013", endpointsValid,
      "Supported target has safe export and runner module paths; unsupported target has none",target);
    targets.push({ target, status: state,
      capabilities: Object.fromEntries(ADAPTER_CAPABILITIES.map(name => [name, caps[name] ?? "unknown"])),
      ...(endpointsValid && state === "supported" ? { entrypoints: endpoints } : {}) });
  }
  const configured = Object.keys(isObject(config?.targets) ? config.targets : {}).sort();
  const requested = requestedTarget === null ? configured : [requestedTarget];
  if (requested.length === 0) check("AM020", false, "No configured target selected");
  for (const target of requested) {
    const targetConfig = config?.targets?.[target];
    const entry = targets.find(x => x.target === target);
    check("AM020", !!entry && entry.status === "supported" && isObject(targetConfig),
      "Requested target must be explicitly configured and supported",target);
    check("AM021", isObject(targetConfig) && validValue(targetConfig.preset) &&
      validValue(targetConfig.output) && validValue(targetConfig.profile) &&
      isObject(config?.profiles?.[targetConfig?.profile]),
      "Configured preset, output and profile must exist",target);
  }
  return {
    schema: ADAPTER_INSPECTION_SCHEMA,
    ok: checks.every(x => x.status === "pass"),
    authority: "static-interface-declaration",
    adapterId: manifest?.id ?? null,
    engine: manifest?.engine?.id ?? null,
    engineVersionObserved: false,
    runtimeObserved: false,
    parityCertified: false,
    hardwareCertified: false,
    selectedTargets: requested,
    targets, checks
  };
}

export async function inspectAdapterCommand(config, target = null, { manifest = undefined } = {}) {
  let loaded = manifest;
  if (loaded === undefined) {
    loaded = JSON.parse(await fs.readFile(MANIFEST_FILE, "utf8"));
  }
  const result = assessAdapterManifest(loaded, config, target);
  // The reference implementation lives in the same repository as the sample.
  // Only inspect entrypoints for the selected supported targets; never invoke them.
  const root = await fs.realpath(config.root);
  for (const name of result.selectedTargets) {
    const item = result.targets.find(x => x.target === name);
    if (item?.status !== "supported" || !item.entrypoints) continue;
    for (const [kind, relative] of Object.entries(item.entrypoints).sort(([a],[b]) => a.localeCompare(b))) {
      const full = path.resolve(root, relative);
      const rel = path.relative(root, full);
      let ok = !!rel && rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel);
      if (ok) {
        const info = await fs.lstat(full).catch(()=>null);
        const real = await fs.realpath(full).catch(()=>null);
        const actual = real ? path.relative(root, real) : "..";
        ok = !!info?.isFile() && !info.isSymbolicLink() && !!actual &&
          actual !== ".." && !actual.startsWith(".." + path.sep) && !path.isAbsolute(actual);
      }
      result.checks.push({
        id: "AM030",status: ok ? "pass" : "fail",target: name,
        detail: kind + " entrypoint exists within repository: " + relative
      });
    }
  }
  result.ok = result.checks.every(x => x.status === "pass");
  result.text = [
    "TALARION ADAPTER INSPECTION — " + (result.ok ? "PASS" : "FAIL"),
    "adapter: " + result.adapterId + " / engine: " + result.engine,
    "scope: static declarations and source entrypoints only",
    ...result.targets.map(x => x.target + ": " + x.status),
    ...result.checks.filter(x => x.status === "fail").map(x =>
      "FAIL " + x.id + (x.target ? " [" + x.target + "]" : "") + " " + x.detail),
    "No runtime, iOS export, parity or device certification."
  ].join("\n");
  return result;
}
