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

export function compareSnapshots(left, right, options) {
  const byKey = rows => new Map(rows.map(x => [`${x.tick}:${x.entity}`, x]));
  const L = byKey(left), R = byKey(right);
  const keys = [...new Set([...L.keys(), ...R.keys()])].sort();
  const differences = [];
  let matched = 0;

  for (const key of keys) {
    const a = L.get(key), b = R.get(key);
    if (!a || !b) {
      differences.push({ key, kind: "missing", left: !!a, right: !!b, pass: false });
      continue;
    }
    let pass = true;
    const detail = {};
    if (a.state !== b.state) { pass = false; detail.state = { left: a.state, right: b.state }; }
    const pd = vecDistance(a.position, b.position);
    if (pd !== null) {
      detail.positionDelta = pd;
      if (pd > options.positionTolerance) pass = false;
    }
    const rd = vecDistance(a.rotation, b.rotation);
    if (rd !== null) {
      detail.rotationDelta = rd;
      if (rd > options.positionTolerance) pass = false;
    }
    const sd = scalarDelta(a.health, b.health);
    if (sd !== null) {
      detail.healthDelta = sd;
      if (sd > options.scalarTolerance) pass = false;
    }
    if (pass) matched++;
    else differences.push({ key, kind: "divergence", pass, detail, left: a, right: b });
  }

  const total = keys.length;
  const parity = total ? matched / total : 1;
  return {
    ok: differences.length === 0,
    total,
    matched,
    parity,
    differences
  };
}
