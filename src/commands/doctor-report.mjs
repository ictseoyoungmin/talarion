import fs from "node:fs/promises";
import path from "node:path";
import { doctor } from "./doctor.mjs";
import { renderDoctorHtml } from "../doctor/render.mjs";

function destination(root, relativeDir) {
  if (!relativeDir || typeof relativeDir !== "string" || path.isAbsolute(relativeDir)) {
    throw new Error("Doctor report directory must be a non-empty relative path within the repository.");
  }
  const dir = path.resolve(root, relativeDir);
  const rel = path.relative(root, dir);
  if (!rel || rel === ".." || rel.startsWith(".." + path.sep) || path.isAbsolute(rel)) {
    throw new Error("Doctor report directory must stay inside the repository.");
  }
  return { dir, rel };
}

async function rejectSymlinkComponents(root, rel) {
  let here = root;
  for (const part of rel.split(path.sep)) {
    here = path.join(here, part);
    const stat = await fs.lstat(here).catch(error => {
      if (error?.code === "ENOENT") return null;
      throw error;
    });
    if (stat?.isSymbolicLink()) throw new Error("Doctor report output cannot traverse a symbolic link.");
    if (stat && !stat.isDirectory()) throw new Error("Doctor report output parent is not a directory.");
  }
}

export async function doctorReportCommand(config, outputDir) {
  const { dir, rel } = destination(config.root, outputDir);
  await rejectSymlinkComponents(config.root, rel);
  const result = await doctor(config);
  const report = result.report;
  // All content is fully computed and validated before writing. Files are
  // stable across repeated runs with identical project source and toolchain.
  const jsonBody = JSON.stringify(report, null, 2) + "\n";
  const htmlBody = renderDoctorHtml(report);
  await fs.mkdir(dir, { recursive: true });
  const jsonFile = path.join(dir, "doctor-report.json");
  const htmlFile = path.join(dir, "doctor-report.html");
  await fs.writeFile(jsonFile, jsonBody, "utf8");
  await fs.writeFile(htmlFile, htmlBody, "utf8");
  return {
    ok: result.ok, schema: report.schema,
    decision: report.decision, summary: report.summary,
    files: { json: jsonFile, html: htmlFile },
    text: "TALARION DOCTOR REPORT\n" +
      result.text + "\n\nSaved " + jsonFile + "\nSaved " + htmlFile
  };
}
