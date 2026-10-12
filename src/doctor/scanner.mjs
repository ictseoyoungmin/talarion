import path from "node:path";
import { DOCTOR_RULES, diagnosticFor } from "./rules.mjs";

const EXTS = new Set([".gd", ".js", ".mjs", ".ts"]);
const MATCH_RULES = DOCTOR_RULES.filter(rule => rule.pattern);

// Conservative lexical analysis, not a full GDScript/JS/TS parser.
// Mask comments and quoted literals without shifting source offsets or newlines.
// Embedded JavaScript template substitutions are intentionally skipped.
export function maskNonCode(source, extension) {
  const gd = extension === ".gd";
  const chars = source.split("");
  let mode = "code", quote = "", triple = false;
  const blank = (at, count = 1) => {
    for (let k = at; k < Math.min(at + count, chars.length); k++) {
      if (source[k] !== "\n" && source[k] !== "\r") chars[k] = " ";
    }
  };
  for (let i = 0; i < source.length; i++) {
    const c = source[i], next = source[i + 1];
    if (mode === "line") {
      if (c === "\n") mode = "code";
      else blank(i);
      continue;
    }
    if (mode === "block") {
      if (c === "*" && next === "/") {
        blank(i, 2); i++; mode = "code";
      } else blank(i);
      continue;
    }
    if (mode === "string") {
      if (triple && source.slice(i, i + 3) === quote.repeat(3)) {
        blank(i, 3); i += 2; mode = "code";
      } else if (!triple && c === "\\") {
        blank(i, 2); i++;
      } else if (!triple && c === quote) {
        blank(i); mode = "code";
      } else if (!triple && c === "\n") {
        mode = "code";
      } else blank(i);
      continue;
    }
    if ((gd && c === "#") || (!gd && c === "/" && next === "/")) {
      blank(i, gd ? 1 : 2); if (!gd) i++;
      mode = "line";
    } else if (!gd && c === "/" && next === "*") {
      blank(i, 2); i++; mode = "block";
    } else if (c === "'" || c === '"' || (!gd && c.charCodeAt(0) === 96)) {
      quote = c;
      triple = gd && source.slice(i, i + 3) === quote.repeat(3);
      blank(i, triple ? 3 : 1);
      if (triple) i += 2;
      mode = "string";
    }
  }
  return chars.join("");
}

export function scanPortabilitySource({ file, source }) {
  const ext = path.extname(file).toLowerCase();
  if (!EXTS.has(ext)) return [];
  const code = maskNonCode(source, ext);
  const lineStarts = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === "\n") lineStarts.push(i + 1);
  const locate = pos => {
    let lo = 0, hi = lineStarts.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (lineStarts[mid] <= pos) lo = mid + 1;
      else hi = mid;
    }
    const line = lo;
    return { line, column: pos - lineStarts[line - 1] + 1 };
  };
  const findings = [];
  for (const rule of MATCH_RULES) {
    const re = new RegExp(rule.pattern, "g");
    for (const m of code.matchAll(re)) {
      findings.push(diagnosticFor(rule.id, { file, ...locate(m.index) }));
    }
  }
  return findings.sort((a, b) =>
    a.line - b.line || a.column - b.column || a.id.localeCompare(b.id));
}
