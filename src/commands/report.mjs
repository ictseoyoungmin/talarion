import fs from "node:fs/promises";
import path from "node:path";
import { ensureDirFor } from "../core/io.mjs";
import { compareCommand } from "./compare.mjs";

const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

export async function reportCommand(config, left, right, out) {
  const result = await compareCommand(config, left, right);
  const output = path.resolve(out);
  await ensureDirFor(output);
  const rows = result.differences.slice(0, 100).map(d =>
    `<tr><td>${esc(d.key)}</td><td>${esc(d.kind)}</td><td><pre>${esc(JSON.stringify(d.detail ?? d, null, 2))}</pre></td></tr>`
  ).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Talarion Parity Report</title>
<style>
body{margin:0;background:#0a0d12;color:#eef2f7;font:14px system-ui;padding:24px}main{max-width:920px;margin:auto}
h1{font-size:36px;letter-spacing:-.04em}.ok{color:#78d6a5}.bad{color:#e88989}
.card{background:#111720;border:1px solid #273142;border-radius:16px;padding:18px;margin:12px 0}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.metric{background:#0e131b;border-radius:12px;padding:14px}
small{color:#93a0af}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #273142;padding:10px;text-align:left;vertical-align:top}
pre{white-space:pre-wrap;font-size:11px}@media(max-width:650px){.grid{grid-template-columns:1fr}body{padding:14px}}
</style></head><body><main>
<small>TALARION / TL00</small><h1>Parity Report</h1>
<div class="card"><div class="grid">
<div class="metric"><small>Parity</small><br><b>${(result.parity*100).toFixed(2)}%</b></div>
<div class="metric"><small>Snapshots</small><br><b>${result.total}</b></div>
<div class="metric"><small>Status</small><br><b class="${result.ok?'ok':'bad'}">${result.ok?'PASS':'FAIL'}</b></div>
</div></div>
<div class="card"><small>LEFT</small><div>${esc(result.leftPath)}</div><br><small>RIGHT</small><div>${esc(result.rightPath)}</div></div>
<div class="card"><h2>Divergences</h2>${rows ? `<table><thead><tr><th>Key</th><th>Kind</th><th>Detail</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="ok">No state divergence above configured tolerance.</p>'}</div>
</main></body></html>`;
  await fs.writeFile(output, html, "utf8");
  return { ...result, output, text: `${result.text}\nReport: ${output}` };
}
