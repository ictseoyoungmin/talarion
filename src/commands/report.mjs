import fs from "node:fs/promises";
import path from "node:path";
import { ensureDirFor } from "../core/io.mjs";
import { compareCommand } from "./compare.mjs";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function visualSection(visual, visualFile, output) {
  if (!visual) return "";
  const base = path.dirname(path.resolve(visualFile));
  const cards = visual.results.map(item => {
    const images = item.files ? ["web", "android", "diff"].map(kind => {
      const src = path.relative(path.dirname(output), path.join(base, item.files[kind])).split(path.sep).join("/");
      return '<figure><img loading="lazy" alt="' + esc(item.checkpoint + " " + kind) +
        '" src="' + esc(src) + '"><figcaption>' + kind.toUpperCase() + '</figcaption></figure>';
    }).join("") : "";
    return '<section class="card"><h3>' + esc(item.checkpoint) + " · tick " + esc(item.tick) +
      ' · <span class="' + (item.ok ? "ok" : "bad") + '">' + (item.ok ? "PASS" : "FAIL") +
      '</span></h3><p><small>Similarity: ' +
      (Number.isFinite(item.similarity) ? item.similarity.toFixed(4) : "N/A") +
      " " + esc(item.error || "") + '</small></p><div class="images">' + images + "</div></section>";
  }).join("");
  const errors = visual.failures.length ? '<p class="bad">' + esc(visual.failures.join("; ")) + "</p>" : "";
  return '<section class="card"><h2>Visual parity</h2><p><b class="' +
    (visual.ok ? "ok" : "bad") + '">' + (visual.ok ? "PASS" : "FAIL") +
    "</b> · " + visual.passedCheckpoints + "/" + visual.expectedCheckpoints +
    " checkpoints · " + esc(visual.normalization.policy) +
    " · min similarity " + esc(visual.thresholds.minSimilarity) + "</p>" + errors +
    "</section>" + cards;
}

export async function reportCommand(config, left, right, out, visualFile = null) {
  const state = await compareCommand(config, left, right);
  const output = path.resolve(out);
  await ensureDirFor(output);

  const visual = visualFile ? JSON.parse(await fs.readFile(path.resolve(visualFile), "utf8")) : null;
  if (visual && visual.schema !== "talarion.visual-parity/v1") {
    throw new Error("Invalid visual manifest schema");
  }
  const ok = state.ok && (!visual || visual.ok);
  const rows = state.differences.slice(0, 100).map(d =>
    "<tr><td>" + esc(d.key) + "</td><td>" + esc(d.kind) +
    "</td><td><pre>" + esc(JSON.stringify(d.detail ?? d, null, 2)) + "</pre></td></tr>"
  ).join("");
  const table = rows ?
    '<table><thead><tr><th>Key</th><th>Kind</th><th>Detail</th></tr></thead><tbody>' + rows + "</tbody></table>" :
    '<p class="ok">No state divergence above configured tolerance.</p>';
  const style = [
    "body{margin:0;background:#0a0d12;color:#eef2f7;font:14px system-ui;padding:24px}",
    "main{max-width:1050px;margin:auto}h1{font-size:36px;letter-spacing:-.04em}",
    ".ok{color:#78d6a5}.bad{color:#e88989}",
    ".card{background:#111720;border:1px solid #273142;border-radius:16px;padding:18px;margin:12px 0}",
    ".grid,.images{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}",
    ".metric{background:#0e131b;border-radius:12px;padding:14px}",
    ".images figure{margin:0;min-width:0}.images img{width:100%;height:auto;border:1px solid #293446;border-radius:8px}",
    ".images figcaption{padding-top:5px;color:#93a0af;font-size:11px}",
    "small{color:#93a0af}table{width:100%;border-collapse:collapse}",
    "td,th{border-bottom:1px solid #273142;padding:10px;text-align:left;vertical-align:top}",
    "pre{white-space:pre-wrap;font-size:11px}",
    "@media(max-width:650px){.grid,.images{grid-template-columns:1fr}body{padding:14px}}"
  ].join("");
  const html = '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Talarion Parity Report</title><style>' + style +
    '</style></head><body><main><small>TALARION / TL00</small><h1>Parity Report</h1>' +
    '<div class="card"><div class="grid">' +
    '<div class="metric"><small>State parity</small><br><b>' + (state.parity * 100).toFixed(2) + '%</b></div>' +
    '<div class="metric"><small>Snapshots</small><br><b>' + state.total + '</b></div>' +
    '<div class="metric"><small>Overall status</small><br><b class="' + (ok ? "ok" : "bad") +
    '">' + (ok ? "PASS" : "FAIL") + '</b></div></div></div>' +
    '<div class="card"><small>WEB</small><div>' + esc(state.leftPath) +
    '</div><br><small>ANDROID</small><div>' + esc(state.rightPath) + '</div></div>' +
    '<div class="card"><h2>State divergences</h2>' + table + "</div>" +
    visualSection(visual, visualFile, output) +
    "</main></body></html>";
  await fs.writeFile(output, html, "utf8");
  return { ...state, ok, visual, output, text: state.text +
    "\nVisual: " + (visual ? (visual.ok ? "PASS" : "FAIL") : "not requested") +
    "\nReport: " + output };
}
