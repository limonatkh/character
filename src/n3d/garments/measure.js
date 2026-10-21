/* =====================================================================
 * BODY MEASUREMENTS FOR GARMENTS
 *
 * Garments are cut from measurements of the actual body, like a tailor:
 *   torso profile  R(y, θ): outermost radius of the trunk (arms excluded)
 *                  around the vertical body axis, from the ankles to the
 *                  armpits, at every height and angle
 *   limb profiles  r(t): largest radius of each arm / leg along its axis
 * Loose garments then hang from these measurements (fabric falls straight
 * down from the bust, the belly or the seat, and around the arm or leg),
 * so every fit works on every body shape and size.
 * ===================================================================== */
import { Field, UNION, SUBTRACT, primDist } from '../sdf/field.js';
import { BONE_NAMES } from '../core/skeleton.js';

const ARM_PART = /(UpperArm|LowerArm|Hand|Thumb|Index|Middle|Ring|Little)/;

/** Sub-field of the body made of the primitives whose bone passes `keep(boneName)`. */
export function bodySubField(sf, keep, S = 1) {
  const pick = list => list.filter(p => keep(BONE_NAMES[p.bone] || ''));
  const U = pick([...sf.body.union]), SB = pick([...sf.body.subtract]);
  return new Field([{ op: UNION, prims: U }, { op: SUBTRACT, prims: SB }], { cell: 0.03 * S, margin: 0.015 * S });
}

/** A table R[iy][ia] over heights and angles with bilinear lookup (angles wrap). */
export class RadialProfile {
  constructor(axisZ, y0, dy, ny, na) {
    this.axisZ = axisZ; this.y0 = y0; this.dy = dy; this.ny = ny; this.na = na;
    this.R = new Float32Array(ny * na);
  }
  clone() { const p = new RadialProfile(this.axisZ, this.y0, this.dy, this.ny, this.na); p.R.set(this.R); return p; }
  get y1() { return this.y0 + this.dy * (this.ny - 1); }
  yAt(i) { return this.y0 + this.dy * i; }
  thAt(j) { return (j / this.na) * 2 * Math.PI - Math.PI; }
  at(y, th) {
    let fy = (y - this.y0) / this.dy;
    if (fy < 0) fy = 0; else if (fy > this.ny - 1) fy = this.ny - 1;
    const iy = Math.min(this.ny - 2, Math.floor(fy)), ty = fy - iy;
    let fa = (th + Math.PI) / (2 * Math.PI) * this.na;
    fa = ((fa % this.na) + this.na) % this.na;
    const ia = Math.floor(fa), ta = fa - ia, ib = (ia + 1) % this.na;
    const R = this.R, na = this.na;
    const a = R[iy * na + ia] + (R[iy * na + ib] - R[iy * na + ia]) * ta;
    const b = R[(iy + 1) * na + ia] + (R[(iy + 1) * na + ib] - R[(iy + 1) * na + ia]) * ta;
    return a + (b - a) * ty;
  }
  /** Box blur in angle and height (smooth drape surfaces). */
  blur(passes = 1) {
    const { ny, na } = this, R = this.R, T = new Float32Array(R.length);
    for (let p = 0; p < passes; p++) {
      for (let i = 0; i < ny; i++) for (let j = 0; j < na; j++) {
        const jl = (j + na - 1) % na, jr = (j + 1) % na, iu = Math.min(ny - 1, i + 1), id = Math.max(0, i - 1);
        T[i * na + j] = (R[i * na + j] * 4 + R[i * na + jl] + R[i * na + jr] + R[iu * na + j] + R[id * na + j]) / 8;
      }
      R.set(T);
    }
    return this;
  }
}

/**
 * Sphere-trace inward from far outside toward the axis; returns the radius
 * of the first surface met (the outermost surface), or 0.
 */
export function traceIn(f, ox, oy, oz, dx, dz, r0) {
  let r = r0;
  for (let i = 0; i < 80 && r > 0; i++) {
    const d = f.eval(ox + dx * r, oy, oz + dz * r);
    if (d < 0.0006) return Math.max(0, r - Math.max(0, d));
    r -= Math.max(d * 0.9, 0.0012);
  }
  return 0;
}

/**
 * Measure the trunk (torso + legs, arms excluded).
 * @returns RadialProfile with heights from the ankles to `yTop`.
 */
export function measureTorso(trunk, frame, opts = {}) {
  const S = frame.S;
  const axisZ = 0.01 * S;
  const y0 = opts.y0 ?? frame.ankleY + 0.01 * S, y1 = opts.y1 ?? frame.armpitY;
  const dy = opts.dy ?? 0.018 * S, na = opts.na ?? 48;
  const ny = Math.max(2, Math.ceil((y1 - y0) / dy) + 1);
  const prof = new RadialProfile(axisZ, y0, (y1 - y0) / (ny - 1), ny, na);
  const r0 = 0.42 * S;
  for (let i = 0; i < ny; i++) {
    const y = prof.yAt(i);
    for (let j = 0; j < na; j++) {
      const th = prof.thAt(j);
      // θ = 0 → front (−Z); + toward the character's right (+X)
      prof.R[i * na + j] = traceIn(trunk, 0, y, axisZ, Math.sin(th), -Math.cos(th), r0);
    }
  }
  return prof.blur(1);
}

/**
 * Trouser hull around one leg: outermost trunk surface (hip, seat, thigh,
 * calf) around the leg's own (slanted) axis, with rays on the inner side
 * starting at the body's midline — so above the crotch each leg's hull
 * reaches the centre line (the two legs of a pair of trousers meet there)
 * and below it follows the inner leg.
 */
export function measureLegHull(trunk, frame, side, opts = {}) {
  const S = frame.S, sg = frame.legs[side], s = sg.sign;
  const hip = sg.a, ank = sg.b;
  const y0 = frame.ankleY - 0.01 * S, y1 = opts.y1 ?? frame.waistY + 0.04 * S;
  const dy = 0.016 * S, na = 40, ny = Math.max(2, Math.ceil((y1 - y0) / dy) + 1);
  const prof = new RadialProfile(0, y0, (y1 - y0) / (ny - 1), ny, na);
  const ky = (hip[1] - ank[1]) || 1;
  prof.cx = y => ank[0] + (hip[0] - ank[0]) * Math.min(1.3, (y - ank[1]) / ky);
  prof.cz = y => ank[2] + (hip[2] - ank[2]) * Math.min(1.3, (y - ank[1]) / ky);
  prof.side = s;
  for (let i = 0; i < ny; i++) {
    const y = prof.yAt(i), cx = prof.cx(y), cz = prof.cz(y);
    for (let j = 0; j < na; j++) {
      const th = prof.thAt(j), dx = Math.sin(th), dz = -Math.cos(th);
      let r0 = 0.3 * S;
      if (dx * s < -1e-3) r0 = Math.min(r0, Math.abs(cx) / Math.abs(dx) - 0.0005);   // stop at the midline
      const v0 = trunk.eval(cx + dx * r0, y, cz + dz * r0);
      prof.R[i * na + j] = v0 < 0 ? r0 : traceIn(trunk, cx, y, cz, dx, dz, r0);
    }
  }
  return prof.blur(1);
}

/**
 * Largest radius of a limb along its axis (t = 0 at the root joint, 1 at the end).
 * @param seg { a, d, L } segment from bodyFrame
 */
export function measureLimb(limbField, seg, n = 24, na = 12) {
  const out = new Float32Array(n + 1);
  // a frame perpendicular to the limb axis
  const d = seg.d, h = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let u = [d[1] * h[2] - d[2] * h[1], d[2] * h[0] - d[0] * h[2], d[0] * h[1] - d[1] * h[0]];
  const ul = Math.hypot(...u); u = u.map(v => v / ul);
  const w = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
  for (let i = 0; i <= n; i++) {
    const t = i / n, c = [seg.a[0] + d[0] * seg.L * t, seg.a[1] + d[1] * seg.L * t, seg.a[2] + d[2] * seg.L * t];
    let best = 0;
    for (let j = 0; j < na; j++) {
      const a = j / na * 2 * Math.PI, ca = Math.cos(a), sa = Math.sin(a);
      const dir = [u[0] * ca + w[0] * sa, u[1] * ca + w[1] * sa, u[2] * ca + w[2] * sa];
      let r = 0.2;
      for (let k = 0; k < 60 && r > 0; k++) {
        const v = limbField.eval(c[0] + dir[0] * r, c[1] + dir[1] * r, c[2] + dir[2] * r);
        if (v < 0.0006) break;
        r -= Math.max(v * 0.9, 0.001);
      }
      if (r > best) best = r;
    }
    out[i] = best;
  }
  return { r: out, n, at(t) { const f = Math.max(0, Math.min(n, t * n)), i = Math.min(n - 1, Math.floor(f)); return out[i] + (out[i + 1] - out[i]) * (f - i); } };
}

/**
 * All measurements of a character (computed once, shared by every garment).
 */
export function measureBody(sf, frame) {
  const keepTrunk = n => !ARM_PART.test(n) && !/^(head|jaw|leftEye|rightEye)$/.test(n);
  const S = frame.S;
  const trunk = bodySubField(sf, keepTrunk, S);
  const torso = measureTorso(trunk, frame);
  const arms = {}, legs = {}, legHulls = {};
  for (const s of ['left', 'right']) {
    const armF = bodySubField(sf, n => n.startsWith(s) && ARM_PART.test(n), S);
    arms[s] = measureLimb(armF, frame.arms[s]);
    const legF = bodySubField(sf, n => n.startsWith(s) && /(UpperLeg|LowerLeg|Foot|Toes)/.test(n), S);
    legs[s] = measureLimb(legF, frame.legs[s]);
    legHulls[s] = measureLegHull(trunk, frame, s);
  }
  // the neck on its own: necklines follow its real shape
  const neckPrims = sf.body.union.filter(p => BONE_NAMES[p.bone] === 'neck');
  frame.neckField = { eval(x, y, z) { let d = Infinity; for (const p of neckPrims) { const v = primDist(p, x, y, z); if (v < d) d = v; } return d; } };
  // smooth neck section (Fourier low-pass of the measured cross-section) for necklines
  const ny = frame.neckBase[1] + 0.014 * S, cz = frame.neckBase[2], na = 36, rs = [];
  for (let j = 0; j < na; j++) {
    const a = j / na * 2 * Math.PI - Math.PI, dx = Math.sin(a), dz = -Math.cos(a);
    let r = 0.16 * S;
    for (let k = 0; k < 60 && r > 0; k++) { const v = frame.neckField.eval(dx * r, ny, cz + dz * r); if (v < 0.0004) break; r -= Math.max(v * 0.9, 0.0008); }
    rs.push(r);
  }
  const H = 3, co = [];
  for (let h = 0; h <= H; h++) {
    let c = 0, s2 = 0;
    for (let j = 0; j < na; j++) { const a = j / na * 2 * Math.PI - Math.PI; c += rs[j] * Math.cos(h * a); s2 += rs[j] * Math.sin(h * a); }
    co.push([c * (h ? 2 : 1) / na, s2 * (h ? 2 : 1) / na]);
  }
  frame.neckSection = a => { let r = 0; for (let h = 0; h <= H; h++) r += co[h][0] * Math.cos(h * a) + co[h][1] * Math.sin(h * a); return r; };
  return { trunk, torso, arms, legs, legHulls, neck: frame.neckField };
}
