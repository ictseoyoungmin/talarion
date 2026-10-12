const esc = x => String(x ?? "").replace(/[&<>"']/g,
  c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;",
    '"':"&quot;", "'":"&#39;" })[c]);
export function renderPerformanceReview(result) {
  const pages=result.targets.map(t=>{
    const budget=t.budgets.map(b=>"<tr><td>"+esc(b.field)+"</td><td>"+
      esc(b.limit === null ? "undeclared" : b.limit+" "+b.unit)+
      "</td><td>"+esc(b.observedMedian??"—")+"</td><td>"+
      esc(b.status)+"</td></tr>").join("");
    const evidence=t.runs.map(r=>"<li><code>"+esc(r.runId)+"</code> "+
      esc(r.cohort)+" · "+esc(r.environmentKey)+" SHA-256: <code>"+
      esc(r.sha256)+"</code></li>").join("");
    return '<section><h2>'+esc(t.target.toUpperCase())+'</h2><p class="status">'+
      esc(t.status)+"</p><p>Baseline "+t.baselineCount+
      " / Candidate "+t.candidateCount+" independent observations</p>"+
      "<p>Regression: "+esc(t.regression.status)+"</p><div class=\"scroll\"><table>"+
      "<thead><tr><th>Budget</th><th>Declared</th><th>Observed</th><th>Status</th></tr></thead><tbody>"+
      (budget||'<tr><td colspan="4">No verified budget evidence</td></tr>')+
      "</tbody></table></div><h3>Evidence fingerprints</h3><ul>"+
      (evidence||"<li>No verified evidence</li>")+"</ul></section>";
  }).join("");
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>Talarion · Performance Review</title><style>'+
    ':root{font:16px/1.5 system-ui,sans-serif;color:#192638;background:#f4f6f8}'+
    '*{box-sizing:border-box}main{max-width:1020px;margin:auto;padding:clamp(18px,4vw,52px)}'+
    'h1{font-size:clamp(28px,5vw,44px)}section,.notice{background:white;border:1px solid #d9dfe7;border-radius:14px;padding:24px;margin:18px 0}'+
    'h2{margin-top:0}.status{font-size:20px;font-weight:700;overflow-wrap:anywhere}'+
    '.scroll{overflow:auto}table{min-width:600px;width:100%;border-collapse:collapse;text-align:left}'+
    'td,th{padding:12px;border-bottom:1px solid #e4e9ef}th{color:#607083}'+
    'li{overflow-wrap:anywhere;margin:8px 0}code{font-size:12px;overflow-wrap:anywhere}'+
    'footer{color:#62718a;font-size:13px;margin:30px 0}</style></head><body><main>'+
    '<p>TL02 / OBSERVATIONAL PERFORMANCE REVIEW</p><h1>Performance Review</h1>'+
    '<p>Decision: <strong>'+esc(result.decision)+'</strong></p>'+
    '<div class="notice"><strong>Observational evidence only.</strong> Not a target FPS, '+
    'physical-device, GPU or thermal certification. A single candidate run is insufficient '+
    'for a multi-run regression or budget compliance decision.</div>'+
    pages+'<footer>Schema '+esc(result.schema)+
    ' · MAD variation is a heuristic, not a confidence interval.</footer></main></body></html>\n';
}
