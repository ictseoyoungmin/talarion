import { BUDGET_FIELDS } from "./budget-profile.mjs";
import { assessObservationalRegression } from "./performance-window.mjs";
export const REVIEW_SCHEMA = "talarion.performance-review/v1";
const hash = v => typeof v === "string" && /^[a-f0-9]{64}$/i.test(v);
const num = v => typeof v === "number" && Number.isFinite(v) && v >= 0;
function median(values) {
  const a = [...values].sort((x,y)=>x-y), n = a.length;
  return n % 2 ? a[(n-1)/2] : (a[n/2-1]+a[n/2])/2;
}
function fingerprint(r) {
  return JSON.stringify([r.target,r.runtimeKind,r.environmentKey,r.profile,
    r.replaySha256,r.window.replayEndTick,r.window.replayTickRate,
    r.window.warmupTicks,r.window.sampleStepTicks,r.window.expectedCount]);
}
function verify(entry,target) {
  const a = entry?.authority, t = a?.targets?.find(x=>x.target===target);
  if (!entry || typeof entry.runId!=="string" || !entry.runId.trim() ||
    typeof entry.environmentKey!=="string" || !entry.environmentKey.trim() ||
    !hash(entry.sha256) || a?.schema!=="talarion.performance-authority/v1" ||
    a.ok!==true || a.certification?.physicalDevice!==false ||
    !t || t.ok!==true || t.hardwareCertified!==false ||
    t.observation?.status!=="validated-runner-observation" ||
    !hash(t.observation?.replaySha256) || !hash(t.observation?.sampleSha256) ||
    t.budgetCoverage?.ok!==true || t.performanceWindow?.status!=="complete-window" ||
    t.performanceWindow?.ok!==true || t.budgetDecision!=="not-evaluated" ||
    !Array.isArray(t.checks) || t.checks.length<8 ||
    !t.checks.every(c=>c.ok===true) ||
    !t.budgetCoverage.metrics.every(m=>m.comparisonEvaluated===false &&
      m.decision==="not-evaluated")) return null;
  return {runId:entry.runId,environmentKey:entry.environmentKey,
    target,runtimeKind:t.runtimeKind,profile:t.declared.profile,
    replaySha256:t.observation.replaySha256,sha256:entry.sha256,
    sampleSha256:t.observation.sampleSha256,window:t.performanceWindow,
    coverage:t.budgetCoverage.metrics};
}
function budget(records) {
  const enough = records.length>=3 && records.every(r=>
    fingerprint(r)===fingerprint(records[0]));
  return BUDGET_FIELDS.map(def=>{
    const limits=records.map(r=>r.coverage.find(m=>m.budgetField===def.field));
    const limit=limits[0]?.declaredLimit??null;
    const status=limit===null ? "not-declared" : !enough
      ? "insufficient-independent-runs" :
      limits.every(m=>m?.status==="comparable-not-graded" &&
        m.declaredLimit===limit && m.unit===def.unit) &&
      records.every(r=>num(r.window.metrics?.[def.metric]))
        ? null : "unobserved-or-inconsistent";
    if(status) return {field:def.field,unit:def.unit,limit,
      status,observedMedian:null,noiseFence:null};
    const values=records.map(r=>r.window.metrics[def.metric]);
    const m=median(values),d=median(values.map(v=>Math.abs(v-m)))*2;
    const result=def.direction==="minimum"
      ? m+d<limit ? "observed-below-limit" :
        m-d>=limit ? "observed-within-limit" : "inconclusive-noise"
      : m-d>limit ? "observed-above-limit" :
        m+d<=limit ? "observed-within-limit" : "inconclusive-noise";
    return {field:def.field,unit:def.unit,limit,
      status:result,observedMedian:m,noiseFence:d};
  });
}
function targetReview(target,group,policy) {
  const base=group?.baseline??[],candidate=group?.candidate??[];
  const entries=[...base,...candidate],all=entries.map(r=>verify(r,target));
  const ids=entries.map(r=>r?.runId);
  const unique=new Set(ids).size===ids.length;
  const uniform=all.filter(Boolean).length<2 ||
    all.every(r=>r && fingerprint(r)===fingerprint(all[0]));
  const valid=entries.length>0 && unique && all.every(Boolean) && uniform;
  const a=valid?all.slice(0,base.length):[];
  const b=valid?all.slice(base.length):[];
  const regression=assessObservationalRegression({
    baseline:a,candidate:b,...policy
  });
  const budgets=valid?budget(b):[];
  const degraded=regression.status==="regression-observed" ||
    budgets.some(m=>["observed-below-limit","observed-above-limit"].includes(m.status));
  const noisy=regression.status==="inconclusive-noise" ||
    budgets.some(m=>m.status==="inconclusive-noise");
  const status=!valid?"invalid-evidence":degraded?"observed-degradation":
    noisy?"inconclusive":
      regression.status==="no-regression-observed" &&
      budgets.some(m=>m.status==="observed-within-limit")
        ?"observational-no-degradation":"insufficient-evidence";
  return {target,status,evidenceValid:valid,
    baselineCount:base.length,candidateCount:candidate.length,
    runs:valid?all.map((r,i)=>({cohort:i<base.length?"baseline":"candidate",
      runId:r.runId,sha256:r.sha256,sampleSha256:r.sampleSha256,
      environmentKey:r.environmentKey,runtimeKind:r.runtimeKind})):[],
    regression,budgets,physicalDeviceCertified:false};
}
export function buildPerformanceReview({cohorts,policy}={}) {
  const policyValid=num(policy?.maxFpsDropPct)&&num(policy?.maxProcessRisePct)&&
    policy.maxFpsDropPct<=100&&policy.maxProcessRisePct<=1000;
  const shape=cohorts&&["web","android"].every(t=>
    Array.isArray(cohorts[t]?.baseline)&&Array.isArray(cohorts[t]?.candidate));
  const targets=["web","android"].map(t=>targetReview(t,
    shape?cohorts[t]:null,policyValid?policy:{}));
  const evidenceValid=Boolean(shape&&policyValid&&targets.every(t=>t.evidenceValid));
  const failed=targets.some(t=>t.status==="observed-degradation");
  const decision=!evidenceValid?"invalid-evidence":failed?
    "blocked-observational-degradation":
    targets.some(t=>t.status==="inconclusive")?"review-inconclusive":
    targets.every(t=>t.status==="observational-no-degradation")?
      "observational-no-degradation":"evidence-only";
  return {schema:REVIEW_SCHEMA,ok:evidenceValid&&!failed,
    evidenceValid,decision,
    performanceCertified:false,hardwareCertified:false,
    policy:policyValid?policy:null,targets,
    text:"TALARION PERFORMANCE REVIEW\n"+
      targets.map(t=>t.target+": "+t.status+" (baseline "+
        t.baselineCount+", candidate "+t.candidateCount+")").join("\n")+
      "\n"+decision+"\nObservational only; no device/target-FPS certification."};
}
