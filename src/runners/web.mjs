import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { exists } from "../core/io.mjs";
import { resolveFromRoot } from "../core/config.mjs";
import { parseProtocolLine, writeJsonl, writeJson } from "../runtime/evidence.mjs";
import { runnerResult } from "./contract.mjs";

const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".wasm", "application/wasm"],
  [".pck", "application/octet-stream"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"]
]);

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    throw new Error("Web runner requires Playwright. Run: npm install && npx playwright install chromium");
  }
}

function createStaticServer(rootDir) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      let rel = decodeURIComponent(url.pathname);
      if (rel === "/") rel = "/index.html";

      const file = path.resolve(rootDir, "." + rel);
      if (!file.startsWith(path.resolve(rootDir) + path.sep)) {
        res.writeHead(403);
        return res.end("Forbidden");
      }

      const data = await fs.readFile(file);
      res.setHeader("Content-Type", MIME.get(path.extname(file)) ?? "application/octet-stream");
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
      res.writeHead(200);
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        url: `http://127.0.0.1:${address.port}/index.html`,
        close: () => new Promise(done => server.close(done))
      });
    });
  });
}

export async function runWeb(config, options = {}) {
  const timeoutMs = Number(options.timeoutMs ?? 30000);
  const entry = resolveFromRoot(config, config.targets.web.output);
  if (!(await exists(entry))) throw new Error(`Web build not found: ${entry}`);

  const artifactDir = resolveFromRoot(config, "artifacts/run/web");
  await fs.rm(artifactDir, { recursive: true, force: true });
  await fs.mkdir(artifactDir, { recursive: true });

  const playwright = await loadPlaywright();
  const server = await createStaticServer(path.dirname(entry));
  const browser = await playwright.chromium.launch({ headless: true });

  const states = [];
  const screenshots = [];
  const runtimeErrors = [];
  const pendingCaptures = [];

  let resolveFinished;
  let rejectFinished;
  const finished = new Promise((resolve, reject) => {
    resolveFinished = resolve;
    rejectFinished = reject;
  });

  const timer = setTimeout(
    () => rejectFinished(new Error(`Web replay timed out after ${timeoutMs} ms`)),
    timeoutMs
  );

  try {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });

    page.on("pageerror", error => runtimeErrors.push(error.message));
    page.on("console", msg => {
      const parsed = parseProtocolLine(msg.text());
      if (!parsed) return;

      if (parsed.kind === "state" && parsed.value && typeof parsed.value === "object") {
        states.push(parsed.value);
      }

      if (parsed.kind === "capture" && parsed.value && typeof parsed.value === "object") {
        const name = String(parsed.value.name ?? `tick-${parsed.value.tick ?? "unknown"}`);
        const file = path.join(artifactDir, `${name}.png`);
        const capture = page.screenshot({ path: file }).then(() => {
          screenshots.push({ checkpoint: name, file });
        });
        pendingCaptures.push(capture);
      }

      if (parsed.kind === "finished") resolveFinished(parsed.value);
    });

    await page.goto(server.url, { waitUntil: "load" });
    const finishedTick = await finished;
    await Promise.all(pendingCaptures);

    const stateFile = path.join(artifactDir, "state.jsonl");
    await writeJsonl(stateFile, states);

    const result = runnerResult({
      target: "web",
      build: entry,
      replay: resolveFromRoot(config, config.replay.default),
      stateFile,
      screenshots,
      performance: null,
      warnings: runtimeErrors,
      ok: states.length > 0 && runtimeErrors.length === 0
    });
    result.finishedTick = finishedTick;

    const resultFile = path.join(artifactDir, "runner-result.json");
    await writeJson(resultFile, result);
    return { ...result, resultFile };
  } finally {
    clearTimeout(timer);
    await browser.close();
    await server.close();
  }
}
