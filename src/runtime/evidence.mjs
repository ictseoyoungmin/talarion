import fs from "node:fs/promises";
import path from "node:path";

const MARKERS = [
  ["TALARION_STATE ", "state"],
  ["TALARION_CAPTURE ", "capture"],
  ["TALARION_REPLAY_READY ", "ready"],
  ["TALARION_REPLAY_FINISHED ", "finished"],
  ["TALARION_EVENT ", "event"],
  ["TALARION_PERF ", "performance"]
];

export function parseProtocolLine(line) {
  const text = String(line);
  for (const [marker, kind] of MARKERS) {
    const index = text.indexOf(marker);
    if (index < 0) continue;

    const payloadText = text.slice(index + marker.length).trim();
    let value;
    try {
      value = JSON.parse(payloadText);
    } catch {
      value = payloadText;
    }
    return { kind, value, raw: text };
  }
  return null;
}

export async function writeJsonl(file, rows) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const body = rows.map(row => JSON.stringify(row)).join("\n");
  await fs.writeFile(file, body ? body + "\n" : "", "utf8");
}

export async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}
