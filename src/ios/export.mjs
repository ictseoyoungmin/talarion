import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { run } from "../core/process.mjs";
import { resolveGodot, classifyGodotExport } from "../adapters/godot.mjs";
import { stageReplay, cleanupStagedReplay, replayPaths } from "../runtime/replay-stage.mjs";
import { iosPreflightCommand } from "./preflight.mjs";

export const IOS_EXPORT_SCHEMA = "talarion.ios-export/v1";

function iniValue(text, key) {
  for (const line of (text ?? "").split(/\r?\n/)) {
    const equal = line.indexOf("=");
    if (equal < 0 || line.slice(0, equal).trim() !== key) continue;
    return line.slice(equal + 1).trim().replace(/^"|"$/g, "");
  }
  return null;
}

function iosPreset(text, name) {
  if (typeof text !== "string" || !name) return null;
  for (const block of text.split(/(?=^\[preset\.\d+\]\s*$)/m).slice(1)) {
    const header = block.split(/^\[preset\.\d+\.options\]\s*$/m)[0];
    if (iniValue(header, "name") !== name || iniValue(header, "platform") !== "iOS") continue;
    const options = block.split(/^\[preset\.\d+\.options\]\s*$/m)[1];
    return { bundle: iniValue(options, "application/bundle_identifier"),
      team: iniValue(options, "application/app_store_team_id") };
  }
  return null;
}

export function assessIosExportPlan(config, preflight, presetText) {
  const ios = config?.ios ?? {};
  const preset = iosPreset(presetText, ios.preset);
  const checks = [
    { id: "IX-01", pass: preflight?.hostClass === "macos" &&
        preflight?.status === "prerequisites-detected" &&
        preflight?.checks?.slice(0, 9).length === 9 &&
        preflight.checks.slice(0, 9).every(c => c.status === "pass"),
      reason: "Real macOS, Xcode, SDK, Godot and iOS preflight required." },
    { id: "IX-02", pass: preset !== null,
      reason: "An actual Godot iOS export preset is required." },
    { id: "IX-03", pass: Boolean(preset && ios.bundleIdentifier &&
        preset.bundle === ios.bundleIdentifier),
      reason: "Godot preset bundle identifier must exactly match Talarion configuration." },
    { id: "IX-04", pass: Boolean(preset && /^[A-Z0-9]{10}$/.test(ios.appStoreTeamId ?? "") &&
        preset.team === ios.appStoreTeamId),
      reason: "A real Apple Team ID must match both configuration and export preset." }
  ].map(c => ({ id: c.id, status: c.pass ? "pass" : "blocked", detail: c.reason }));
  return { eligible: checks.every(c => c.status === "pass"), checks };
}

async function noSymlink(root, candidate) {
  const relative = path.relative(root, candidate);
  if (!relative || relative === ".." || relative.startsWith(".." + path.sep) ||
      path.isAbsolute(relative)) throw Error("Path must be inside the repository.");
  let cursor = root;
  for (const component of relative.split(path.sep)) {
    cursor = path.join(cursor, component);
    const stat = await fs.lstat(cursor).catch(e => e.code === "ENOENT" ? null : Promise.reject(e));
    if (stat?.isSymbolicLink()) throw Error("iOS export refuses symlink paths.");
  }
}
async function requireInside(root, candidate, prefix) {
  const full = path.resolve(root, candidate);
  await noSymlink(root, full);
  const relative = path.relative(root, full);
  if (prefix && !(relative === prefix || relative.startsWith(prefix + path.sep))) {
    throw Error("iOS export output must be inside artifacts/.");
  }
  return full;
}
async function fileHash(filename) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest("hex");
}

// Parse ZIP central-directory metadata only. This confirms that the real
// export contains an Xcode project, but does not execute or certify Xcode.
export async function inspectXcodeArchive(filename) {
  const handle = await fs.open(filename, "r");
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size < 22) throw Error("Missing or empty ZIP archive.");
    const tailSize = Math.min(stat.size, 65557);
    const tail = Buffer.alloc(tailSize);
    await handle.read(tail, 0, tailSize, stat.size - tailSize);
    let end = -1;
    for (let i = tail.length - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === 0x06054b50 &&
          i + 22 + tail.readUInt16LE(i + 20) === tail.length) { end = i; break; }
    }
    if (end < 0) throw Error("ZIP end-of-directory missing.");
    const count = tail.readUInt16LE(end + 10);
    const length = tail.readUInt32LE(end + 12);
    const start = tail.readUInt32LE(end + 16);
    if (!count || count === 65535 || length === 0xffffffff || start === 0xffffffff ||
        length > 64 * 1024 * 1024 || start + length > stat.size - 22) {
      throw Error("Unsupported or invalid ZIP central directory.");
    }
    const central = Buffer.alloc(length);
    const read = await handle.read(central, 0, length, start);
    if (read.bytesRead !== length) throw Error("Truncated ZIP central directory.");
    const names = new Set();
    let offset = 0;
    let project = null;
    for (let i = 0; i < count; i++) {
      if (offset + 46 > length || central.readUInt32LE(offset) !== 0x02014b50) {
        throw Error("Malformed ZIP entry.");
      }
      const flags = central.readUInt16LE(offset + 8);
      const nameBytes = central.readUInt16LE(offset + 28);
      const extraBytes = central.readUInt16LE(offset + 30);
      const commentBytes = central.readUInt16LE(offset + 32);
      const next = offset + 46 + nameBytes + extraBytes + commentBytes;
      if (next > length || flags & 1) throw Error("Encrypted or truncated ZIP entry.");
      const name = central.subarray(offset + 46, offset + 46 + nameBytes).toString("utf8");
      const segments = name.split("/");
      if (!name || name.includes("\\") || name.startsWith("/") ||
          segments.some(s => s === ".." || s === "." || s.includes(":")) ||
          names.has(name)) throw Error("Unsafe or duplicate ZIP entry.");
      names.add(name);
      if (/(^|\/)[^/]+\.xcodeproj\/project\.pbxproj$/.test(name)) project = name;
      offset = next;
    }
    if (offset !== length || !project) throw Error("ZIP has no Xcode project.pbxproj.");
    return { entryCount: count, xcodeProject: project };
  } finally { await handle.close(); }
}

function baseReport({ status, plan, preflight, archive, attempted = false }) {
  return {
    schema: IOS_EXPORT_SCHEMA, target: "ios", ok: status === "xcode-project-exported",
    status, scope: "macos-godot-xcode-project-export-only",
    hostClass: preflight.hostClass, preflightStatus: preflight.status,
    checks: plan.checks, exportAttempted: attempted,
    exportProduced: status === "xcode-project-exported",
    signed: false, xcodeBuildVerified: false,
    simulatorRuntimeObserved: false, physicalDeviceRuntimeObserved: false,
    parityCertified: false, physicalDeviceCertified: false,
    archive
  };
}

export async function iosExportCommand(config, outputDir, options = {}) {
  if (!outputDir) throw Error("Usage: talarion ios export <output-dir>");
  const root = config.root;
  const dir = await requireInside(root, outputDir, "artifacts");
  const projectDir = await requireInside(root, config.project?.path ?? "");
  const { source, staged } = replayPaths(config);
  await requireInside(root, source);
  const relativeStaged = path.relative(projectDir, staged);
  if (!relativeStaged || relativeStaged === ".." ||
      relativeStaged.startsWith(".." + path.sep) || path.isAbsolute(relativeStaged)) {
    throw Error("Staged replay path escapes the Godot project.");
  }
  await noSymlink(root, staged);
  const presets = await requireInside(root, path.join(projectDir, "export_presets.cfg"));
  await requireInside(root, path.join(projectDir, "project.godot"));
  await fs.mkdir(dir, { recursive: true });
  const preflight = await iosPreflightCommand(config, path.join(dir, "ios-preflight.json"));
  const presetText = await fs.readFile(presets, "utf8").catch(e =>
    e.code === "ENOENT" ? null : Promise.reject(e));
  const plan = assessIosExportPlan(config, preflight, presetText);
  const archiveFile = path.join(dir,
    String(config.project?.name ?? "game").replace(/[^A-Za-z0-9_-]/g, "-") + "-ios.zip");
  await noSymlink(root, archiveFile);
  const manifestFile = path.join(dir, "ios-export.json");
  await noSymlink(root, manifestFile);
  const write = async report => {
    await fs.writeFile(manifestFile, JSON.stringify(report, null, 2) + "\n", "utf8");
    return { ...report, manifest: manifestFile,
      text: "TALARION IOS EXPORT — " + report.status + "\n" +
        "Signing, Xcode build, runtime and device parity are NOT certified." };
  };
  if (options.onBeforeExport) throw Error("Unsupported export override.");
  if (!plan.eligible || process.platform !== "darwin") {
    return write(baseReport({ status: "blocked", plan, preflight, archive: null }));
  }
  if (await fs.lstat(archiveFile).catch(e => e.code === "ENOENT" ? null : Promise.reject(e))) {
    return write(baseReport({ status: "blocked-existing-archive", plan, preflight,
      archive: null }));
  }
  const godot = await resolveGodot(config);
  if (!godot.ok) {
    return write(baseReport({ status: "blocked-missing-godot", plan, preflight,
      archive: null }));
  }
  const replaySha256 = await fileHash(source);
  let exec;
  try {
    await stageReplay(config);
    exec = await run(godot.bin, ["--headless", "--path", projectDir,
      "--export-debug", config.ios.preset, archiveFile]);
  } finally { await cleanupStagedReplay(config); }
  const classified = classifyGodotExport(exec);
  if (!classified.ok) {
    return write({ ...baseReport({ status: "export-failed", plan, preflight,
      archive: null, attempted: true }), exitCode: exec.code,
      fatalDiagnosticsCount: classified.fatalDiagnostics.length });
  }
  try {
    await noSymlink(root, archiveFile);
    const index = await inspectXcodeArchive(archiveFile);
    const bytes = (await fs.stat(archiveFile)).size;
    const sha256 = await fileHash(archiveFile);
    return write({ ...baseReport({ status: "xcode-project-exported", plan, preflight,
      attempted: true, archive: { file: path.relative(root, archiveFile),
        bytes, sha256, ...index } }), godotVersion: godot.version,
      replaySha256, preset: config.ios.preset,
      bundleIdentifier: config.ios.bundleIdentifier });
  } catch (error) {
    return write({ ...baseReport({ status: "invalid-export-archive", plan, preflight,
      attempted: true, archive: null }), reason: error.message });
  }
}
