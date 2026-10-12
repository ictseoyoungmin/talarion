import path from "node:path";
import { readJson } from "../core/io.mjs";

function validateReplay(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return ["replay must be a JSON object"];
  }
  const errors = [];
  if (data.schema !== "talarion.replay/v1") errors.push("schema must be talarion.replay/v1");
  if (!Number.isInteger(data.tickRate) || data.tickRate <= 0) errors.push("tickRate must be a positive integer");
  if (!Array.isArray(data.events)) errors.push("events must be an array");
  let previous = -1;
  for (const [i, event] of (Array.isArray(data.events) ? data.events : []).entries()) {
    if (!event || typeof event !== "object" || Array.isArray(event)) {
      errors.push(`events[${i}] must be an object`);
      continue;
    }
    if (!Number.isInteger(event.tick) || event.tick < 0) {
      errors.push(`events[${i}].tick invalid`);
    } else {
      if (event.tick < previous) errors.push(`events[${i}] is out of tick order`);
      previous = event.tick;
    }
    if (typeof event.type !== "string" || !event.type.trim()) {
      errors.push(`events[${i}].type invalid`);
    }
  }
  return errors;
}

export async function validateReplayCommand(file) {
  const absolute = path.resolve(file);
  const data = await readJson(absolute);
  const errors = validateReplay(data);
  const events = Array.isArray(data?.events) ? data.events : [];
  return {
    ok: errors.length === 0,
    file: absolute,
    eventCount: events.length,
    errors,
    text: errors.length
      ? `REPLAY INVALID\n${errors.map(x => `✗ ${x}`).join("\n")}`
      : `REPLAY VALID\n${absolute}\n${events.length} event(s) @ ${data.tickRate} Hz`
  };
}
