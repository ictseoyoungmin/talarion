function num(v) { return typeof v === "number" && Number.isFinite(v); }

function vecDistance(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return null;
  if (!a.every(num) || !b.every(num)) return null;
  return Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0));
}

function scalarDelta(a, b) {
  if (!num(a) || !num(b)) return null;
  return Math.abs(a - b);
}

function snapshotKey(row) {
  const checkpoint = row.checkpoint == null ? "" : String(row.checkpoint);
  return `${row.tick}:${row.entity}:${checkpoint}`;
}

function indexSnapshots(rows, side) {
  const map = new Map();
  const duplicates = [];

  for (const row of rows) {
    const key = snapshotKey(row);
    if (map.has(key)) {
      duplicates.push({
        key,
        kind: "duplicate",
        side,
        pass: false,
        first: map.get(key),
        duplicate: row
      });
      continue;
    }
    map.set(key, row);
  }

  return { map, duplicates };
}

function compareVectorField(detail, field, a, b, tolerance) {
  const delta = vecDistance(a?.[field], b?.[field]);
  if (a?.[field] == null && b?.[field] == null) return true;
  if (delta === null) {
    detail[field] = { left: a?.[field] ?? null, right: b?.[field] ?? null, error: "missing or invalid vector" };
    return false;
  }
  detail[`${field}Delta`] = delta;
  return delta <= tolerance;
}

export function compareSnapshots(left, right, options) {
  const L = indexSnapshots(left, "left");
  const R = indexSnapshots(right, "right");
  const keys = [...new Set([...L.map.keys(), ...R.map.keys()])].sort();
  const differences = [...L.duplicates, ...R.duplicates];
  let matched = 0;

  const positionTolerance = Number(options?.positionTolerance ?? 0);
  const rotationTolerance = Number(options?.rotationTolerance ?? positionTolerance);
  const scalarTolerance = Number(options?.scalarTolerance ?? 0);

  for (const key of keys) {
    const a = L.map.get(key), b = R.map.get(key);
    if (!a || !b) {
      differences.push({ key, kind: "missing", left: !!a, right: !!b, pass: false });
      continue;
    }

    let pass = true;
    const detail = {};

    if (a.state !== b.state) {
      pass = false;
      detail.state = { left: a.state, right: b.state };
    }

    if (!compareVectorField(detail, "position", a, b, positionTolerance)) pass = false;
    if (!compareVectorField(detail, "rotation", a, b, rotationTolerance)) pass = false;
    if (!compareVectorField(detail, "cameraRotation", a, b, rotationTolerance)) pass = false;

    const healthDelta = scalarDelta(a.health, b.health);
    if (a.health != null || b.health != null) {
      if (healthDelta === null) {
        detail.health = { left: a.health ?? null, right: b.health ?? null, error: "missing or invalid scalar" };
        pass = false;
      } else {
      detail.healthDelta = healthDelta;
      if (healthDelta > scalarTolerance) pass = false;
      }
    }

    if (pass) matched++;
    else differences.push({ key, kind: "divergence", pass, detail, left: a, right: b });
  }

  const total = keys.length + L.duplicates.length + R.duplicates.length;
  const parity = total ? matched / total : 1;

  return {
    ok: differences.length === 0,
    total,
    matched,
    parity,
    differences
  };
}
