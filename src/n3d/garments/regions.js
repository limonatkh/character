/* =====================================================================
 * GARMENT REGIONS (where a garment exists on the body)
 *
 * Every function returns a signed value in metres: NEGATIVE where the
 * garment is present, positive where it is cut away. Regions combine with
 * max() (a point must pass every test), so a garment's coverage reads like
 * a pattern description: "below the neckline, above the hem, sleeves to the
 * elbow, open at the front above the top button".
 * The shell is clipped exactly along the zero level, so hems, necklines and
 * cuffs are smooth curves on the body.
 * ===================================================================== */

const smax = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k * 0.25; };
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const front = a => { const c = Math.cos(a / 2); return c * c; };          // 1 at the front centre, 0 at the back
const bump = (a, w) => (Math.abs(a) < w ? Math.pow(Math.cos(Math.PI * a / (2 * w)), 2) : 0);

/** Point on a limb segment: { t, along, r }. */
function limb(sg, x, y, z) {
  const qx = x - sg.a[0], qy = y - sg.a[1], qz = z - sg.a[2];
  const along = qx * sg.d[0] + qy * sg.d[1] + qz * sg.d[2];
  const ex = qx - sg.d[0] * along, ey = qy - sg.d[1] * along, ez = qz - sg.d[2] * along;
  return { along, t: along / sg.L, r: Math.sqrt(ex * ex + ey * ey + ez * ez) };
}
export { limb as limbCoords };

/** Torso angle: 0 = front centre, + toward the character's right. */
export function torsoAngle(F, x, z) { return Math.atan2(x, -(z - 0.01 * F.S)); }

/* ------------------------------------------------------------------ hems and tops */
/** Garment ends at a hem line: hemY(θ) (number or function of the torso angle). */
export function hem(F, hemY) {
  const fn = typeof hemY === 'function' ? hemY : () => hemY;
  return (x, y, z) => fn(torsoAngle(F, x, z), x, z) - y;
}
/** Garment starts at a top line (waistband, rise, strapless top edge). */
export function topLine(F, topY) {
  const fn = typeof topY === 'function' ? topY : () => topY;
  return (x, y, z) => y - fn(torsoAngle(F, x, z), x, z);
}
/** Cut everything above the neck base + h (keeps garments off the head). */
export function headLimit(F, h) {
  const y0 = F.neckBase[1] + h;
  return (x, y) => y - y0;
}

/**
 * Dungarees bib: the trousers continue above the waist as a front bib (|x| < w, up to topFront)
 * and a low back panel (up to topBack). Smooth front ↔ back blend so the region stays continuous.
 */
export function bib(F, o) {
  const S = F.S, zc = 0.01 * S, waist = o.waistY ?? F.waistY;
  return (x, y, z) => {
    const fr = ss(zc + 0.05 * S, zc - 0.03 * S, z);                 // 1 in front, 0 behind
    const top = o.topBack + (o.topFront - o.topBack) * fr;
    // above the waist only the bib's width remains (in front); below it the trousers are whole
    const sides = Math.min((Math.abs(x) - o.w) * fr + (1 - fr) * 0.2 * S, y - (waist + 0.015 * S));
    return Math.max(y - top, sides);
  };
}

/* ------------------------------------------------------------------ necklines */
/**
 * Neck opening. type: crew | v | scoop | boat | square | collar | turtle | mock | hood | henley | polo
 * opts: width (−1..1 wider), depth (m, for v / scoop / square), back (m, extra back drop)
 * Returns the region value (positive inside the opening = cut).
 */
export function neckline(F, type, opts = {}) {
  const S = F.S, nz = F.neckBase[2], ny = F.neckBase[1], nR = F.neckR;
  const W = opts.width || 0, D = opts.depth ?? 0.1 * S, back = opts.back || 0, e = opts.ease ?? 0.004 * S;
  // the neck's own (smoothed) cross-section: necklines follow its real shape and thickness
  const sec = F.neckSection || (() => nR);
  const neckDist = (x, y, z, a, r) => r - sec(a);
  let gap, sector = null;
  switch (type) {
    case 'turtle': case 'mock': return () => -1;                       // no opening: the shell goes up the neck
    case 'collar': gap = a => e + S * (0.004 + 0.008 * front(a)) + W * 0.01 * S; break;
    case 'boat': gap = a => e + S * (0.008 + (0.05 + 0.03 * W) * Math.pow(Math.abs(Math.sin(a)), 1.4)); break;
    case 'v': gap = a => e + S * (0.007 + 0.006 * front(a)) + W * 0.012 * S; sector = { w: 0.55 + 0.25 * W, depth: a => D * Math.max(0, 1 - Math.abs(a) / (0.55 + 0.25 * W)) }; break;
    case 'scoop': gap = a => e + S * (0.009 + 0.006 * front(a)) + W * 0.015 * S; sector = { w: 1.0 + 0.3 * W, depth: a => D * bump(a, 1.0 + 0.3 * W) }; break;
    case 'square': gap = a => e + S * (0.01 + 0.006 * front(a)) + W * 0.015 * S; sector = { w: 0.62 + 0.2 * W, depth: a => D * ss(0.62 + 0.2 * W, 0.5 + 0.2 * W, Math.abs(a)) }; break;
    default: {                                                          // crew, henley, polo, hood: smooth round line
      gap = a => e + S * (0.01 + 0.012 * front(a)) + W * 0.018 * S;
      const dep = opts.depth ?? 0.03 * S;
      sector = { w: Math.PI, depth: a => -0.006 * S + dep * Math.pow(Math.max(0, Math.cos(a)), 1.6) + W * 0.008 * S, plain: true };
    }
  }
  const deepBack = 0.1 * S;
  return (x, y, z) => {
    const dz = z - nz, a = Math.atan2(x, -dz), r = Math.sqrt(x * x + dz * dz), h = y - ny;
    // (no early exit far from the neck: the value must stay continuous — garments stack on it)
    let hole = Math.max(neckDist(x, y, z, a, r) - gap(a), -h - deepBack);
    if (back > 0 && Math.abs(a) > 2) hole = Math.min(hole, Math.max(neckDist(x, y, z, a, r) - gap(a) - 0.2 * S, -h - back * ss(2, 2.6, Math.abs(a))));
    if (sector && sector.plain) hole = smax(hole, -h - sector.depth(a) - 0.012 * S, 0.014 * S);
    else if (sector) {
      const fr = Math.max(-h - sector.depth(a) - 0.012 * S, (Math.abs(a) - sector.w) * Math.max(r, 0.05 * S), dz);
      hole = Math.min(hole, fr);
    }
    return -hole;
  };
}

/* ------------------------------------------------------------------ front openings */
/**
 * Open front (cardigans, open jackets, robes, lapel V).
 * opts: gap (m, width of the opening below the break), breakY (lapel V starts),
 * slope (V widening per metre above the break), yLow (opening ends below this).
 */
export function frontOpening(F, opts) {
  const zc = 0.01 * F.S, g0 = opts.gap || 0, br = opts.breakY ?? Infinity, sl = opts.slope || 0, yLow = opts.yLow ?? -Infinity;
  return (x, y, z) => {
    const g = g0 + 2 * Math.max(0, y - br) * sl;
    const hole = Math.max(Math.abs(x) - g / 2, z - zc, yLow - y);
    return -hole;
  };
}

/* ------------------------------------------------------------------ sleeves */
/** Sleeve ends at t = tEnd along the arm (0 shoulder, 1 wrist). rCut(t) bounds the cut around the arm. */
export function sleeveEnd(F, side, tEnd, rCut) {
  const sg = F.arms[side];
  // the cut widens past the wrist (hands stay out); dividing by the widening slope keeps it a distance bound
  const n = Math.sqrt(1 + Math.pow(0.8 * F.S / sg.L, 2));
  return (x, y, z) => {
    const l = limb(sg, x, y, z);
    const cut = Math.max(tEnd * sg.L - l.along, (l.r - rCut(Math.max(0, Math.min(1.2, l.t))) - 0.8 * F.S * Math.max(0, l.t - 0.9)) / n);
    return -cut;
  };
}

/**
 * Sleeveless armhole: an ellipsoid around the shoulder joint plus the whole arm.
 * opts: strapX (inner edge of the strap, m from the centre), depth (m below the armpit)
 */
export function armhole(F, side, opts = {}) {
  const S = F.S, sg = F.arms[side], s = sg.sign;
  const J = F.J[side + 'UpperArm'];
  const cx = J[0] + s * 0.02 * S, cy = J[1] + 0.005 * S, cz = J[2];
  const strapX = opts.strapX ?? 0.11 * S, bottom = F.armpitY - (opts.depth ?? 0.03 * S);
  const rx = Math.max(0.02 * S, Math.abs(cx) - strapX), ry = Math.max(0.03 * S, cy - bottom), rz = 0.25 * S;
  const rMin = Math.min(rx, ry), nW = Math.sqrt(1 + Math.pow(0.8 * S / sg.L, 2));
  return (x, y, z) => {
    const qx = (x - cx) / rx, qy = (y - cy) / ry, qz = (z - cz) / rz;
    const e = (Math.sqrt(qx * qx + qy * qy + qz * qz) - 1) * rMin;
    const l = limb(sg, x, y, z);
    const beyond = Math.max(0.1 * sg.L - l.along, (l.r - 0.11 * S - 0.8 * S * Math.max(0, l.t - 0.85)) / nW);
    // smooth union: one clean curve from the strap down around the armpit
    const k = 0.025 * S, hh = Math.max(k - Math.abs(e - beyond), 0) / k;
    return -(Math.min(e, beyond) - hh * hh * k * 0.25);
  };
}

/** Exclude both arms from shoulder level down (lower garments, skirts, dresses' bodies). */
export function excludeArms(F, fromT = 0.18) {
  const S = F.S;
  return (x, y, z) => {
    let cut = Infinity;
    for (const s of ['left', 'right']) {
      const sg = F.arms[s], l = limb(sg, x, y, z), n = Math.sqrt(1 + Math.pow(0.8 * S / sg.L, 2));
      cut = Math.min(cut, Math.max(fromT * sg.L - l.along, (l.r - 0.12 * S - 0.8 * S * Math.max(0, l.t - 0.85)) / n));
    }
    return -cut;
  };
}

/* ------------------------------------------------------------------ legs */
/** Trouser legs end at t = tEnd (0 hip joint, 1 ankle). */
export function legEnd(F, tEnd) {
  const S = F.S;
  return (x, y, z) => {
    let cut = Infinity;
    for (const s of ['left', 'right']) {
      const sg = F.legs[s], l = limb(sg, x, y, z);
      cut = Math.min(cut, Math.max(tEnd * sg.L - l.along, l.r - 0.2 * S - 0.6 * S * Math.max(0, l.t - 0.9)));
    }
    return -cut;
  };
}

/** Intersection of several region functions. */
export function all(...fns) {
  const list = fns.filter(Boolean);
  return (x, y, z) => { let v = -Infinity; for (const f of list) { const w = f(x, y, z); if (w > v) v = w; } return v; };
}
/** Union of several region functions. */
export function any(...fns) {
  const list = fns.filter(Boolean);
  return (x, y, z) => { let v = Infinity; for (const f of list) { const w = f(x, y, z); if (w < v) v = w; } return v; };
}
export { ss as smoothstep, front as frontWeight, bump };
