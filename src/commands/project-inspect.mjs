import fs from "node:fs/promises";
import path from "node:path";

export const PROJECT_ADOPTION_SCHEMA = "talarion.project-adoption/v1";
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const within = (root, candidate) => {
  const rel = path.relative(root, candidate);
  return !!rel && rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel);
};
const normalized = value => value.replace(/\\/g, "/");

async function checkComponents(root, candidate, { expectDirectory = false } = {}) {
  if (!within(root, candidate)) return false;
  let cursor = root;
  for (const segment of path.relative(root, candidate).split(path.sep)) {
    cursor = path.join(cursor, segment);
    const st = await fs.lstat(cursor).catch(error => {
      if (error?.code === "ENOENT") return null;
      throw error;
    });
    if (!st || st.isSymbolicLink()) return false;
  }
  const st = await fs.lstat(candidate);
  return expectDirectory ? st.isDirectory() : st.isFile();
}

function parsePresets(text) {
  const presets = new Map();
  let current = null;
  for (const raw of (text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    const section = /^\[preset\.(\d+)(?:\.options)?\]$/.exec(line);
    if (section) {
      if (!presets.has(section[1])) presets.set(section[1], {});
      current = presets.get(section[1]);
      continue;
    }
    if (line.startsWith("[")) { current = null; continue; }
    if (!current) continue;
    const value = /^([\w/]+)\s*=\s*"([^"]*)"\s*$/.exec(line);
    if (value) current[value[1]] = value[2];
  }
  return [...presets.values()];
}

function globMatches(pattern, value) {
  if (typeof pattern !== "string" || !pattern) return false;
  const regex = "^" + pattern.split("*").map(s =>
    s.replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&")).join(".*") + "$";
  return new RegExp(regex).test(value);
}

const limitations = Object.freeze([
  { id: "TA-L01", status: "unverified",
    detail: "verify uses repository fixtures/state/web.jsonl and android.jsonl, not independent project results" },
  { id: "TA-L02", status: "unverified",
    detail: "CI exports the bundled Ruins Lite game; no second-project runtime evidence exists" },
  { id: "TA-L03", status: "unverified",
    detail: "Game-specific source must emit TALARION_STATE, TALARION_CAPTURE and performance evidence" },
  { id: "TA-L04", status: "unverified",
    detail: "Runners write fixed artifacts/run/web and artifacts/run/android directories in this repository" }
]);

export async function inspectProjectAdoption(config) {
  const checks = [];
  const check = (id, passed, detail) =>
    checks.push({ id, status: passed ? "pass" : "fail", detail });
  const root = await fs.realpath(config.root);
  const ref = config?.project?.path;
  const hasRef = typeof ref === "string" && !!ref.trim() && !path.isAbsolute(ref);
  const project = hasRef ? path.resolve(root, ref) : root;
  const projectSafe = hasRef && await checkComponents(root, project, { expectDirectory: true });
  check("TA001", projectSafe, "Project is a symlink-free existing child of the Talarion checkout");

  async function readProject(name) {
    if (!projectSafe) return null;
    const file = path.join(project, name);
    if (!(await checkComponents(root, file))) return null;
    return fs.readFile(file, "utf8");
  }
  const [projectText, presetText, bridgeText] = await Promise.all([
    readProject("project.godot"), readProject("export_presets.cfg"),
    readProject("talarion_bridge.gd")
  ]);
  check("TA002", typeof projectText === "string", "Godot project.godot exists");
  check("TA011", config?.project?.engine === "godot",
    "Current adoption contract supports only the Godot engine");
  const sceneMatch = typeof projectText === "string" ?
    /^\s*run\/main_scene\s*=\s*"res:\/\/([^"]+)"\s*$/m.exec(projectText) : null;
  const sceneName = sceneMatch?.[1];
  const sceneFile = typeof sceneName === "string" ?
    path.resolve(project, sceneName) : project;
  const mainSceneOk = projectSafe && !!sceneName && within(project, sceneFile) &&
    await checkComponents(root, sceneFile);
  check("TA012", !!mainSceneOk, "Configured res:// main scene exists inside Godot project");
  check("TA003", typeof bridgeText === "string", "TalarionBridge script exists at project root");
  const autoloadSection = typeof projectText === "string" ?
    (/\[autoload\]([\s\S]*?)(?=\n\[|$)/.exec(projectText) ?? [,""])[1] : "";
  const autoload = /^\s*TalarionBridge\s*=\s*"\*?res:\/\/talarion_bridge\.gd"\s*$/m.test(autoloadSection);
  check("TA004", autoload, "Godot TalarionBridge autoload points to res://talarion_bridge.gd");

  const resource = config?.replay?.stagedResource;
  const relativeResource = typeof resource === "string" && !!resource.trim() &&
    !path.isAbsolute(resource) && !normalized(resource).split("/").some(s => !s || s === "." || s === "..");
  const staged = relativeResource ? path.resolve(project, resource) : project;
  const resourceSafe = projectSafe && relativeResource && within(project, staged);
  const bridgeMatch = typeof bridgeText === "string" ?
    /\bconst\s+REPLAY_PATH\s*:=\s*"res:\/\/([^"]+)"/.exec(bridgeText) : null;
  check("TA005", resourceSafe && !!bridgeMatch && bridgeMatch[1] === normalized(resource),
    "Configured stagedResource stays inside project and matches bridge REPLAY_PATH");

  const presets = parsePresets(presetText);
  for (const target of ["web","android"]) {
    const t = config?.targets?.[target];
    const platform = target === "web" ? "Web" : "Android";
    const matches = presets.filter(p => p.name === t?.preset && p.platform === platform);
    const preset = matches.length === 1 ? matches[0] : null;
    check("TA006-" + target, !!preset,
      platform + " preset uniquely matches the configured name and platform");
    const patterns = preset?.include_filter?.split(",").map(s => s.trim()) ?? [];
    check("TA007-" + target, resourceSafe && !!preset &&
      patterns.some(p => globMatches(p, normalized(resource))),
      "Export include_filter covers the configured replay JSON");
    if (target === "android") {
      const pkg = t?.package;
      check("TA008", !!preset && typeof pkg === "string" && !!pkg.trim() &&
        preset["package/unique_name"] === pkg,
        "Android package identity matches configured ADB launch package");
    }
    const output = t?.output;
    const out = typeof output === "string" && !!output.trim() &&
      !path.isAbsolute(output) ? path.resolve(root, output) : root;
    const outputSafe = within(root, out) && out !== project &&
      !within(project, out) && typeof output === "string" &&
      out.endsWith(target === "web" ? ".html" : ".apk");
    check("TA009-" + target, outputSafe,
      "Build output is inside checkout, outside project and has target extension");
  }

  const replayRef = config?.replay?.default;
  const replay = typeof replayRef === "string" && !!replayRef.trim() &&
    !path.isAbsolute(replayRef) ? path.resolve(root, replayRef) : root;
  let replayData = null;
  if (within(root, replay) && await checkComponents(root, replay)) {
    try { replayData = JSON.parse(await fs.readFile(replay, "utf8")); }
    catch { /* Bad replay does not throw from static inspection. */ }
  }
  const validReplay = isObject(replayData) &&
    replayData.schema === "talarion.replay/v1" &&
    Number.isInteger(replayData.tickRate) && replayData.tickRate > 0 &&
    Array.isArray(replayData.events) && replayData.events.length > 0 &&
    replayData.events.every(e => isObject(e) && Number.isInteger(e.tick) && e.tick >= 0) &&
    replayData.events.every((e,i) => i === 0 || e.tick >= replayData.events[i-1].tick);
  check("TA010", !!validReplay, "Canonical replay JSON is readable, nonempty and tick-ordered");

  const ok = checks.every(c => c.status === "pass");
  return {
    schema: PROJECT_ADOPTION_SCHEMA,
    ok,
    readiness: ok ? "static-prerequisites-detected" : "blocked",
    authority: "static-project-preflight",
    project: hasRef ? normalized(ref) : null,
    engine: config?.project?.engine ?? null,
    runtimeObserved: false,
    independentProjectVerified: false,
    parityCertified: false,
    hardwareCertified: false,
    checks,
    limitations: [...limitations],
    text: [
      "TALARION PROJECT INSPECT — " + (ok ? "STATIC PREREQUISITES DETECTED" : "BLOCKED"),
      ...checks.filter(c => c.status === "fail").map(c => "FAIL " + c.id + " — " + c.detail),
      "Static checks do not execute or certify a different Godot game.",
      "Known integration gaps: " + limitations.map(x => x.id).join(", ")
    ].join("\n")
  };
}
