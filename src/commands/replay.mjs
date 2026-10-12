import path from "node:path";
import { readJson } from "../core/io.mjs";

function validateReplay(data) {
  const errors = [];
  if (data.schema !== "talarion.replay/v1") errors.push("schema must be talarion.replay/v1");
  if (!Number.isInteger(data.tickRate) || data.tickRate <= 0) errors.push("tickRate must be a positive integer");
  if (!Array.isArray(data.events)) errors.push("events must be an array");
  let previous = -1;
  for (const [i, event] of (data.events ?? []).entries()) {
    if (!Number.isInteger(event.tick) || event.tick < 0) errors.push(`events[${i}].tick invalid`);
    if (event.tick < previous) errors.push(`events[${i}] is out of tick order`);
    if (typeof event.type !== "string") errors.push(`events[${i}].type invalid`);
    previous = event.tick;
  }
  return errors;
}

export async function validateReplayCommand(file) {
  const absolute = path.resolve(file);
  const data = await readJson(absolute);
  const errors = validateReplay(data);
  return {
    ok: errors.length === 0,
    file: absolute,
    eventCount: Array.isArray(data.events) ? data.events.length : 0,
    errors,
    text: errors.length
      ? `REPLAY INVALID\n${errors.map(x => `✗ ${x}`).join("\n")}`
      : `REPLAY VALID\n${absolute}\n${data.events.length} event(s) @ ${data.tickRate} Hz`
  };
}
