import fs from "node:fs/promises";
import path from "node:path";
import { decodePng, encodePng } from "./png.mjs";

// Crop to a declared aspect ratio, then sample at fixed pixel centers.
// No screenshot content is interpreted or auto-aligned to improve a score.
export function normalizeImage(image, width = 320, height = 180) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
      !Number.isInteger(image.width) || !Number.isInteger(image.height) ||
      image.width < 1 || image.height < 1 || image.width > 8192 || image.height > 8192) {
    throw new Error("Invalid screenshot or normalization dimensions");
  }
  if (!image.data || image.data.length !== image.width * image.height * 4) {
    throw new Error("Invalid RGBA screenshot payload");
  }
  const targetAspect = width / height;
  let cropWidth = image.width, cropHeight = image.height;
  if (image.width / image.height > targetAspect) cropWidth = image.height * targetAspect;
  else cropHeight = image.width / targetAspect;
  const cropX = (image.width - cropWidth) / 2;
  const cropY = (image.height - cropHeight) / 2;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sy = Math.min(image.height - 1, Math.max(0, Math.floor(cropY + (y + 0.5) * cropHeight / height)));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(image.width - 1, Math.max(0, Math.floor(cropX + (x + 0.5) * cropWidth / width)));
      const src = (sy * image.width + sx) * 4;
      const dst = (y * width + x) * 4;
      data[dst] = image.data[src];
      data[dst + 1] = image.data[src + 1];
      data[dst + 2] = image.data[src + 2];
      data[dst + 3] = 255;
    }
  }
  return {
    width, height, data,
    source: { width: image.width, height: image.height },
    crop: { x: cropX, y: cropY, width: cropWidth, height: cropHeight },
    policy: "center-crop-nearest-rgb-v1"
  };
}

export function compareNormalizedImages(a, b) {
  if (a.width !== b.width || a.height !== b.height || a.data.length !== b.data.length) {
    throw new Error("Normalized screenshot dimensions differ");
  }
  let error = 0, lumSumA = 0, lumSqA = 0, lumSumB = 0, lumSqB = 0;
  const total = a.width * a.height;
  const diff = new Uint8Array(total * 4);
  for (let p = 0; p < total; p++) {
    const i = p * 4;
    const lumA = (0.2126 * a.data[i] + 0.7152 * a.data[i + 1] + 0.0722 * a.data[i + 2]) / 255;
    const lumB = (0.2126 * b.data[i] + 0.7152 * b.data[i + 1] + 0.0722 * b.data[i + 2]) / 255;
    lumSumA += lumA; lumSqA += lumA * lumA;
    lumSumB += lumB; lumSqB += lumB * lumB;
    for (let c = 0; c < 3; c++) {
      const delta = Math.abs(a.data[i + c] - b.data[i + c]);
      error += delta;
      diff[i + c] = Math.min(255, delta * 4);
    }
    diff[i + 3] = 255;
  }
  const meanAbsoluteError = error / (total * 3 * 255);
  return {
    similarity: 1 - meanAbsoluteError,
    meanAbsoluteError,
    lumaStdDev: {
      web: Math.sqrt(Math.max(0, lumSqA / total - (lumSumA / total) ** 2)),
      android: Math.sqrt(Math.max(0, lumSqB / total - (lumSumB / total) ** 2))
    },
    diff: { width: a.width, height: a.height, data: diff }
  };
}

async function loadManifest(dir, target) {
  const result = JSON.parse(await fs.readFile(path.join(dir, "runner-result.json"), "utf8"));
  if (result.schema !== "talarion.runner-result/v1" || result.target !== target || !result.ok) {
    throw new Error(target + " runner result is invalid or failed");
  }
  return result;
}

function chooseScreenshot(run, dir, name, tick) {
  const found = (run.evidence?.screenshots ?? []).filter(s => s.checkpoint === name);
  if (found.length !== 1) throw new Error("Expected exactly one " + name + " screenshot; found " + found.length);
  if (found[0].tick !== tick) throw new Error(name + " capture tick differs from the canonical replay");
  if (path.basename(found[0].file) !== name + ".png") {
    throw new Error("Screenshot filename does not match checkpoint " + name);
  }
  return path.join(dir, name + ".png");
}

export async function compareVisualRuns(config, webDir, androidDir, outDir) {
  const output = path.resolve(outDir);
  await fs.mkdir(output, { recursive: true });
  const replayFile = path.resolve(config.root, config.replay.default);
  const replay = JSON.parse(await fs.readFile(replayFile, "utf8"));
  const checkpoints = replay.events.filter(e => e.type === "capture");
  const options = config.parity?.visual ?? {};
  const width = options.width ?? 320, height = options.height ?? 180;
  const minSimilarity = options.minSimilarity ?? 0.8;
  const minLumaStdDev = options.minLumaStdDev ?? 0.012;
  if (!Number.isFinite(minSimilarity) || minSimilarity < 0 || minSimilarity > 1 ||
      !Number.isFinite(minLumaStdDev) || minLumaStdDev < 0 || minLumaStdDev > 1) {
    throw new Error("Invalid visual parity thresholds");
  }
  const names = checkpoints.map(c => c.name);
  if (new Set(names).size !== names.length ||
      names.some(n => typeof n !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(n))) {
    throw new Error("Replay checkpoints must have unique, filesystem-safe names");
  }
  if (!checkpoints.length) throw new Error("Replay has no visual checkpoints");

  const results = [], failures = [];
  try {
    const [web, android] = await Promise.all([
      loadManifest(path.resolve(webDir), "web"),
      loadManifest(path.resolve(androidDir), "android")
    ]);
    const finish = Math.max(...replay.events.map(e => e.tick));
    if (web.finishedTick !== finish || android.finishedTick !== finish) {
      failures.push("Runner completion tick differs from canonical replay");
    }
    for (const [run, target] of [[web, "web"], [android, "android"]]) {
      const extras = (run.evidence?.screenshots ?? []).filter(s => !names.includes(s.checkpoint));
      if (extras.length) failures.push(target + " emitted unexpected checkpoint images");
    }
    for (const checkpoint of checkpoints) {
      const name = checkpoint.name;
      try {
        const [webPath, androidPath] = [
          chooseScreenshot(web, path.resolve(webDir), name, checkpoint.tick),
          chooseScreenshot(android, path.resolve(androidDir), name, checkpoint.tick)
        ];
        const [webPng, androidPng] = await Promise.all([
          fs.readFile(webPath), fs.readFile(androidPath)
        ]);
        const left = normalizeImage(decodePng(webPng), width, height);
        const right = normalizeImage(decodePng(androidPng), width, height);
        const metrics = compareNormalizedImages(left, right);
        const files = {
          web: name + ".web.png",
          android: name + ".android.png",
          diff: name + ".diff.png"
        };
        await Promise.all([
          fs.writeFile(path.join(output, files.web), encodePng(left)),
          fs.writeFile(path.join(output, files.android), encodePng(right)),
          fs.writeFile(path.join(output, files.diff), encodePng(metrics.diff))
        ]);
        const ok = metrics.similarity >= minSimilarity &&
          metrics.lumaStdDev.web >= minLumaStdDev &&
          metrics.lumaStdDev.android >= minLumaStdDev;
        const item = {
          checkpoint: name, tick: checkpoint.tick, ok,
          similarity: metrics.similarity, meanAbsoluteError: metrics.meanAbsoluteError,
          lumaStdDev: metrics.lumaStdDev,
          source: { web: left.source, android: right.source },
          crop: { web: left.crop, android: right.crop },
          files
        };
        results.push(item);
        if (!ok) failures.push(name + ": visual evidence below configured thresholds");
      } catch (error) {
        results.push({ checkpoint: name, tick: checkpoint.tick, ok: false, error: String(error.message ?? error) });
        failures.push(name + ": missing or invalid screenshot");
      }
    }
  } catch (error) {
    failures.push(String(error.message ?? error));
  }
  const valid = results.filter(r => Number.isFinite(r.similarity));
  const result = {
    schema: "talarion.visual-parity/v1",
    ok: failures.length === 0 && results.length === checkpoints.length,
    expectedCheckpoints: checkpoints.length,
    passedCheckpoints: results.filter(r => r.ok).length,
    averageSimilarity: valid.length ? valid.reduce((n, r) => n + r.similarity, 0) / valid.length : null,
    normalization: { policy: "center-crop-nearest-rgb-v1", width, height },
    thresholds: { minSimilarity, minLumaStdDev },
    results, failures
  };
  const manifest = path.join(output, "result.json");
  await fs.writeFile(manifest, JSON.stringify(result, null, 2) + "\n", "utf8");
  return { ...result, output: manifest,
    text: "TALARION VISUAL PARITY\ncheckpoints: " + result.passedCheckpoints + "/" +
      result.expectedCheckpoints + "\n" + (result.ok ? "VISUAL PASS" : "VISUAL FAIL") +
      "\nEvidence: " + manifest };
}
