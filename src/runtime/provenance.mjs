import fs from "node:fs/promises";
import { createHash } from "node:crypto";

export async function sha256File(file) {
  const bytes = await fs.readFile(file);
  return createHash("sha256").update(bytes).digest("hex");
}
