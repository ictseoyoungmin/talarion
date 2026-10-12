import fs from "node:fs/promises";
import path from "node:path";
import { sha256File } from "./provenance.mjs";
import { buildPerformanceReview } from "./performance-review.mjs";
import { renderPerformanceReview } from "./performance-render.mjs";

const hash=x=>typeof x==="string"&&/^[0-9a-f]{64}$/i.test(x);
function located(root,where) {
  const file=path.resolve(root,where),rel=path.relative(root,file);
  if (!rel||rel===".."||rel.startsWith(".."+path.sep)||path.isAbsolute(rel))
    throw new Error("Report paths must remain inside repository.");
  return {file,rel};
}
async function noSymlink(root,rel) {
  let here=root;
  for(const part of rel.split(path.sep)) {
    here=path.join(here,part);
    const st=await fs.lstat(here).catch(e=>e.code==="ENOENT"?null:Promise.reject(e));
    if(st?.isSymbolicLink())throw new Error("Report paths cannot cross symlinks.");
  }
}
async function readAuthority(root,filename,expected=null) {
  const {file,rel}=located(root,filename);
  await noSymlink(root,rel);
  const sha256=await sha256File(file);
  if(expected!==null&&sha256!==expected)
    throw new Error("Authority file SHA-256 differs from cohort manifest.");
  return {authority:JSON.parse(await fs.readFile(file,"utf8")),sha256};
}
export async function performanceReportCommand(config,source,outDir,current=false) {
  const root=config.root;
  const {file:dest,rel:outRel}=located(root,outDir);
  await noSymlink(root,outRel);
  let cohorts,policy;
  if(current) {
    const observed=await readAuthority(root,source);
    policy={maxFpsDropPct:10,maxProcessRisePct:20};
    cohorts=Object.fromEntries(["web","android"].map(target=>[
      target,{baseline:[],candidate:[{
        runId:"single-"+target+"-"+observed.sha256.slice(0,16),
        environmentKey:"single-run-unclassified",
        ...observed
      }]}
    ]));
  } else {
    const {file,rel}=located(root,source);
    await noSymlink(root,rel);
    const manifest=JSON.parse(await fs.readFile(file,"utf8"));
    if(manifest?.schema!=="talarion.performance-cohorts/v1")
      throw new Error("Unsupported performance cohort manifest.");
    policy=manifest.policy;
    cohorts={};
    for(const target of ["web","android"]) {
      cohorts[target]={};
      for(const type of ["baseline","candidate"]) {
        const entries=manifest.cohorts?.[target]?.[type];
        if(!Array.isArray(entries))
          throw new Error("Missing "+target+" "+type+" cohort.");
        const data=[];
        for(const entry of entries) {
          if(typeof entry?.file!=="string"||!entry.file||!hash(entry.sha256))
            throw new Error("Invalid cohort file or digest.");
          const abs=path.resolve(path.dirname(file),entry.file);
          const observed=await readAuthority(root,abs,entry.sha256);
          data.push({runId:entry.runId,environmentKey:entry.environmentKey,...observed});
        }
        cohorts[target][type]=data.sort((a,b)=>
          String(a.runId).localeCompare(String(b.runId),"en"));
      }
    }
  }
  const result=buildPerformanceReview({cohorts,policy});
  await fs.mkdir(dest,{recursive:true});
  const json=path.join(dest,"performance-review.json");
  const html=path.join(dest,"performance-review.html");
  await fs.writeFile(json,JSON.stringify(result,null,2)+"\n","utf8");
  await fs.writeFile(html,renderPerformanceReview(result),"utf8");
  return {...result,files:{json,html}};
}
