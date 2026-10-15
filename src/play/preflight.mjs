import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT=fileURLToPath(new URL("../../",import.meta.url));
const POLICY=path.join(ROOT,"docs/development/policies/google-play-2026-08-31.json");
const DAY=86400000;
const hasOwn=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const record=o=>o!==null&&typeof o==="object"&&!Array.isArray(o);
const validDate=s=>typeof s==="string"&&/^\d{4}-\d\d-\d\d$/.test(s)&&
  !Number.isNaN(Date.parse(s+"T00:00:00+09:00"))&&
  new Date(Date.parse(s+"T00:00:00+09:00")).toLocaleDateString("sv-SE",{timeZone:"Asia/Seoul"})===s;
const validPackage=s=>typeof s==="string"&&s.length<=200&&
  /^(?:[a-z][a-z0-9_]*\.)+[a-z][a-z0-9_]*$/.test(s)&&
  !s.split(".").some(x=>x==="android"||x==="example"||x==="test");
const validVersion=n=>Number.isSafeInteger(n)&&n>=1&&n<=2100000000;
const validHex=s=>typeof s==="string"&&/^[0-9a-f]{64}$/i.test(s);
function rejectReserved(value,at="contract"){
  if(!record(value)&&!Array.isArray(value))return [];
  const banned=/(?:password|passphrase|private.?key|keystore|api.?token|secret|playApproved|releaseCertified|playReady|uploadKeyPassword)/i;
  const findings=[];
  for(const [k,v] of Object.entries(value)){
    if(banned.test(k))findings.push(at+"."+k);
    if(record(v)||Array.isArray(v))findings.push(...rejectReserved(v,at+"."+k));
  }
  return findings;
}
function check(checks,id,pass,detail){
  checks.push({id,status:pass?"pass":"fail",detail});
}
export function auditGooglePlayContract(contract,policy,{now=new Date()}={}){
  const checks=[],external=[];
  const c=record(contract)?contract:{};
  const app=record(c.application)?c.application:{};
  const artifact=record(c.artifact)?c.artifact:{};
  const d=record(c.declarations)?c.declarations:{};
  const p=record(policy)?policy:{};
  const t=now instanceof Date?now:new Date(now);
  const nowTime=t.getTime();
  const reviewed=validDate(p.reviewedOn)?Date.parse(p.reviewedOn+"T00:00:00+09:00"):NaN;
  const effective=validDate(p.effectiveFrom)?Date.parse(p.effectiveFrom+"T00:00:00+09:00"):NaN;
  const fresh=Number.isFinite(nowTime)&&Number.isFinite(reviewed)&&
    (nowTime-reviewed)>=0&&(nowTime-reviewed)<=90*DAY;
  const active=Number.isFinite(nowTime)&&Number.isFinite(effective)&&nowTime>=effective;
  const snapshotValid=p.schema==="talarion.play-policy-snapshot/v1"&&
    p.mobileNewSubmissionMinTargetSdk===36&&
    p.sourceUrl==="https://support.google.com/googleplay/android-developer/answer/11926878?hl=en";
  check(checks,"PC001",c.schema==="talarion.play-submission-contract/v1"&&
    c.platform==="google-play"&&["new-app","update"].includes(c.submission),
    "Explicit versioned Play contract and new-app/update submission type required");
  check(checks,"PC002",validPackage(app.packageId),
    "Android applicationId/package must be syntactically valid; Play ownership unverified");
  check(checks,"PC003",validVersion(app.versionCode)&&
    typeof app.versionName==="string"&&/^[0-9A-Za-z][0-9A-Za-z._+-]{0,63}$/.test(app.versionName),
    "Safe versionCode and well-formed versionName; no Play release-history inference");
  check(checks,"PC004",snapshotValid&&fresh&&active,
    "Pinned official Google Play policy snapshot must be effective and reviewed in past 90 days");
  // No policy fallback for Android TV, XR, Auto or Wear: scope is mobile only.
  const categorySupported=app.deviceCategory==="mobile";
  check(checks,"PC005",categorySupported&&Number.isSafeInteger(app.targetSdk)&&
    app.targetSdk>=p.mobileNewSubmissionMinTargetSdk&&snapshotValid&&active,
    "Mobile new app/update requires API36+ since 2026-08-31; other categories need separate policies");
  check(checks,"PC006",Number.isSafeInteger(app.minSdk)&&app.minSdk>=1&&
    Number.isSafeInteger(app.targetSdk)&&app.minSdk<=app.targetSdk,
    "Explicit valid Android min SDK and target SDK required");
  check(checks,"PC007",c.submission==="new-app"?
    app.previousPublishedVersionCode===null:
    c.submission==="update"&&validVersion(app.previousPublishedVersionCode)&&
      validVersion(app.versionCode)&&app.versionCode>app.previousPublishedVersionCode,
    "For updates, previous Play versionCode must be declared and current strictly higher; owner history unverified");
  check(checks,"PC008",artifact.format==="aab"&&
    ["ci-disposable","external-user-upload"].includes(artifact.signerClass)&&
    (artifact.sha256===null||validHex(artifact.sha256))&&
    (artifact.signerCertificateSha256===null||validHex(artifact.signerCertificateSha256)),
    "AAB only; declared signer class and optional SHA256 digests are not independently verified");
  check(checks,"PC009",Array.isArray(app.requestedPermissions)&&
    app.requestedPermissions.length<=80&&new Set(app.requestedPermissions).size===app.requestedPermissions.length&&
    app.requestedPermissions.every(x=>typeof x==="string"&&
      /^[a-z][a-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(x)),
    "Explicit no-wildcard Android permission inventory is required; policy implications need external review");
  const declarationKeys=["privacyPolicy","dataSafety","contentRating","targetAudience",
    "ads","storeListing","accountTesting","developerVerification"];
  check(checks,"PC010",declarationKeys.every(key=>
    hasOwn(d,key)&&["pending","drafted","owner-reviewed"].includes(d[key])),
    "Eight separate Play declaration statuses required (pending/drafted/owner-reviewed)");
  check(checks,"PC011",rejectReserved(c).length===0,
    "Contract cannot carry signing secrets or self-issued Play certification flags");
  check(checks,"PC012",Object.keys(c).every(x=>["schema","platform","submission","application","artifact","declarations"].includes(x))&&
    Object.keys(app).every(x=>["packageId","deviceCategory","versionCode","versionName","previousPublishedVersionCode","targetSdk","minSdk","requestedPermissions"].includes(x))&&
    Object.keys(artifact).every(x=>["format","signerClass","sha256","signerCertificateSha256"].includes(x))&&
    Object.keys(d).every(x=>declarationKeys.includes(x)),
    "Unknown and unsupported contract fields are rejected (versioned schema)");
  external.push(
    {id:"PE001",authority:"Google Play Console",reason:"Package ID ownership, developer verification and account eligibility cannot be self-certified"},
    {id:"PE002",authority:"Google Play Console",reason:"Previous published version code, signed upload-key lineage and Play App Signing enrollment require account evidence"},
    {id:"PE003",authority:"independent release artifact",reason:"Manifest/permissions/AAB digest/certificate must be inspected from signed bytes; JSON declarations are not observed facts"},
    {id:"PE004",authority:"Google Play Console",reason:"Privacy, data safety, content rating, ads, audience, listing and applicable test requirements need owner review and Console verification"},
    {id:"PE005",authority:"Google Play reviewer",reason:"Actual uploaded app, policy acceptance, review and publication remain outside static preflight"}
  );
  const declarationPending=declarationKeys.filter(k=>d[k]!=="owner-reviewed");
  if(artifact.signerClass==="ci-disposable")
    external.push({id:"PE006",authority:"app owner",reason:"CI disposable signer cannot be reused as production Play upload key"});
  const staticPass=checks.every(x=>x.status==="pass");
  return {
    schema:"talarion.play-static-preflight/v1",ok:staticPass,
    status:staticPass?"blocked-by-external-account":"invalid-static-contract",
    staticContractValid:staticPass,submissionReady:false,playApproved:false,playPublished:false,
    productionSigningVerified:false,physicalDeviceCertified:false,
    application:{packageId:validPackage(app.packageId)?app.packageId:null,
      versionCode:validVersion(app.versionCode)?app.versionCode:null,
      deviceCategory:app.deviceCategory??null,targetSdk:app.targetSdk??null},
    policy:{effectiveFrom:p.effectiveFrom??null,reviewedOn:p.reviewedOn??null,
      sourceUrl:snapshotValid?p.sourceUrl:null,rule:"mobile new-app/update API36+"},
    checks,declarationPending,externalRequired:external,
    text:"TALARION GOOGLE PLAY STATIC PREFLIGHT "+(staticPass?"CONTRACT PASS / EXTERNAL AUTHORITY BLOCKED":"INVALID CONTRACT")+
      "\nGoogle Play submission/publication: NOT VERIFIED"
  };
}
export async function playStaticPreflight(contractFile,outputFile,{now}={}){
  const p=JSON.parse(await fs.readFile(POLICY,"utf8"));
  const contract=JSON.parse(await fs.readFile(contractFile,"utf8"));
  const report=auditGooglePlayContract(contract,p,{now});
  if(outputFile){
    const output=path.resolve(outputFile);
    await fs.mkdir(path.dirname(output),{recursive:true});
    await fs.writeFile(output,JSON.stringify(report,null,2)+"\n",{flag:"w",mode:0o600});
  }
  return report;
}
