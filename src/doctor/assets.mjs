import fs from "node:fs/promises";
import path from "node:path";
import { diagnosticFor } from "./rules.mjs";

export const ASSET_SCHEMA = "talarion.asset-budget/v1";
const HEADER_BYTES = 262144;
const EXCLUDED = new Set([
  ".git", ".godot", ".import", ".talarion", "node_modules",
  "artifacts", "build", "dist"
]);
const RASTER = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const UNKNOWN = new Set([".svg", ".svgz", ".bmp", ".tga", ".exr", ".hdr",
  ".dds", ".ktx", ".ktx2", ".basis", ".avif", ".gif", ".psd"]);
const pathLabel = (root, filename) => path.relative(root, filename).split(path.sep).join("/");
const dims = (width, height, format) =>
  Number.isSafeInteger(width) && Number.isSafeInteger(height) && width > 0 && height > 0
    ? { status: "measured", width, height, format }
    : { status: "unreadable", format, reason: "invalid-or-empty-dimensions" };

// Header-level observation only: does NOT infer engine texture memory, import
// transformation, texture compression, shader compatibility or runtime FPS.
export function parseTextureHeader(ext, bytes, { truncatedRead = false } = {}) {
  const format = ext.toLowerCase().replace(/^\./, "");
  if (!RASTER.has("." + format)) return { status: "unknown", format, reason: "format-not-inspected" };
  if (format === "png") {
    if (bytes.length < 24) return { status: truncatedRead ? "unknown" : "unreadable", format, reason: "short-header" };
    if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
        bytes.toString("ascii", 12, 16) !== "IHDR") {
      return { status: "unreadable", format, reason: "not-a-png-ihdr" };
    }
    return dims(bytes.readUInt32BE(16), bytes.readUInt32BE(20), format);
  }
  if (format === "webp") {
    if (bytes.length < 20) return { status: truncatedRead ? "unknown" : "unreadable", format, reason: "short-header" };
    if (bytes.toString("ascii", 0, 4) !== "RIFF" ||
        bytes.toString("ascii", 8, 12) !== "WEBP") {
      return { status: "unreadable", format, reason: "not-a-webp-riff" };
    }
    const type = bytes.toString("ascii", 12, 16);
    if (type === "VP8X") {
      if (bytes.length < 30) return { status: "unreadable", format, reason: "short-vp8x" };
      const w = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
      const h = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
      return dims(w, h, format);
    }
    if (type === "VP8 ") {
      if (bytes.length < 30) return { status: "unreadable", format, reason: "short-vp8" };
      if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) {
        return { status: "unreadable", format, reason: "vp8-keyframe-marker-not-found" };
      }
      return dims(bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff, format);
    }
    if (type === "VP8L") {
      if (bytes.length < 25 || bytes[20] !== 0x2f) {
        return { status: "unreadable", format, reason: "invalid-vp8l-header" };
      }
      return dims(1 + (bytes[21] | ((bytes[22] & 63) << 8)),
        1 + ((bytes[22] >> 6) | (bytes[23] << 2) | ((bytes[24] & 15) << 10)), format);
    }
    return { status: "unknown", format, reason: "unsupported-webp-chunk-" + type };
  }
  // JPEG SOF segments may follow arbitrarily large APP/ICC metadata.
  // When 256 KiB cannot locate SOF, report unknown, never a false PASS.
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return { status: "unreadable", format, reason: "invalid-jpeg-soi" };
  }
  let pos = 2;
  while (pos < bytes.length) {
    if (bytes[pos] !== 0xff) {
      return { status: "unreadable", format, reason: "invalid-jpeg-marker" };
    }
    while (pos < bytes.length && bytes[pos] === 0xff) pos++;
    if (pos >= bytes.length) break;
    const marker = bytes[pos++];
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) continue;
    if (marker === 0xda) {
      return { status: "unknown", format, reason: "jpeg-sos-without-sof" };
    }
    if (pos + 2 > bytes.length) break;
    const length = bytes.readUInt16BE(pos);
    if (length < 2) return { status: "unreadable", format, reason: "invalid-jpeg-segment-length" };
    const isSof = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
      0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker);
    if (isSof) {
      if (length < 7 || pos + 7 > bytes.length) break;
      return dims(bytes.readUInt16BE(pos + 5), bytes.readUInt16BE(pos + 3), format);
    }
    if (pos + length > bytes.length) break;
    pos += length;
  }
  return { status: truncatedRead ? "unknown" : "unreadable", format,
    reason: truncatedRead ? "jpeg-sof-beyond-header-limit" : "jpeg-sof-not-found" };
}

async function walkAssets(projectDir, configRoot) {
  const files = [];
  let skippedLinks = 0;
  async function visit(dir) {
    for (const ent of (await fs.readdir(dir, { withFileTypes: true }))
      .sort((a, b) => a.name.localeCompare(b.name, "en"))) {
      const absolute = path.join(dir, ent.name);
      if (ent.isSymbolicLink()) { skippedLinks++; continue; }
      if (ent.isDirectory()) {
        if (!EXCLUDED.has(ent.name)) await visit(absolute);
      } else if (ent.isFile()) {
        const ext = path.extname(ent.name).toLowerCase();
        if (!RASTER.has(ext) && !UNKNOWN.has(ext)) continue;
        const stat = await fs.stat(absolute);
        if (UNKNOWN.has(ext)) {
          files.push({ file: pathLabel(configRoot, absolute), status: "unknown",
            format: ext.slice(1), sourceBytes: stat.size, reason: "format-not-inspected" });
          continue;
        }
        const fh = await fs.open(absolute, "r");
        let data;
        try {
          const length = Math.min(stat.size, HEADER_BYTES);
          const out = Buffer.alloc(length);
          const { bytesRead } = await fh.read(out, 0, length, 0);
          data = out.subarray(0, bytesRead);
        } finally { await fh.close(); }
        files.push({ file: pathLabel(configRoot, absolute), sourceBytes: stat.size,
          ...parseTextureHeader(ext, data, { truncatedRead: stat.size > data.length }) });
      }
    }
  }
  try { await visit(projectDir); } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return { files, skippedLinks };
}

export async function auditStaticAssets(config, projectDir) {
  const { files, skippedLinks } = await walkAssets(projectDir, config.root);
  const targets = {};
  const diagnostics = [];
  const configuredTargets = Object.keys(config.targets ?? {}).sort();
  for (const target of configuredTargets) {
    const profileId = config.targets[target]?.profile;
    const profile = typeof profileId === "string" ? config.profiles?.[profileId] : null;
    const textureMax = profile?.textureMax;
    const validMax = Number.isSafeInteger(textureMax) && textureMax > 0;
    const oversized = validMax ? files.filter(file => file.status === "measured" &&
      (file.width > textureMax || file.height > textureMax)) : [];
    const uncertain = files.filter(file => file.status !== "measured");
    if (!validMax) diagnostics.push({
      ...diagnosticFor("PF203"), targets: [target], profile: profileId ?? null,
      status: "invalid", message: "Invalid or missing textureMax for " + target + " profile."
    });
    for (const file of oversized) diagnostics.push({
      ...diagnosticFor("PF201", { file: file.file }), targets: [target],
      status: "exceeds", profile: profileId,
      observed: { width: file.width, height: file.height },
      limit: textureMax,
      message: target + " texture " + file.width + "x" + file.height +
        " exceeds textureMax " + textureMax + "."
    });
    targets[target] = {
      profile: profileId ?? null, textureMax: validMax ? textureMax : null,
      dimensionStatus: !validMax ? "invalid-profile" : oversized.length
        ? "over-budget" : uncertain.length || files.length === 0
          ? "unknown" : "within-declared-source-limit",
      oversizedFiles: oversized.map(file => file.file),
      unknownFiles: uncertain.map(file => file.file),
      sourceTextureCount: files.length,
      performance: {
        status: "not-measured",
        targetFps: Number.isFinite(profile?.targetFps) ? profile.targetFps : null,
        drawCallBudget: Number.isFinite(profile?.drawCallBudget)
          ? profile.drawCallBudget : null,
        measuredFps: null, measuredDrawCalls: null
      }
    };
  }
  for (const file of files.filter(item => item.status !== "measured")) {
    diagnostics.push({
      ...diagnosticFor(file.status === "unreadable" ? "PF202" : "PF204",
        { file: file.file }),
      targets: configuredTargets, status: file.status,
      format: file.format, reason: file.reason
    });
  }
  return {
    schema: ASSET_SCHEMA, scope: "source-header-only", hardwareCertified: false,
    performanceCertified: false, filesScanned: files.length,
    knownDimensions: files.filter(file => file.status === "measured").length,
    unknownDimensions: files.filter(file => file.status !== "measured").length,
    skippedSymlinks: skippedLinks,
    textures: files, targets, diagnostics
  };
}
