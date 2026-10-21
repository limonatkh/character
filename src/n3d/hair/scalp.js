/* =====================================================================
 * SCALP AND HAIRLINE
 *
 * The hair-bearing region is described in head-spherical coordinates
 * around the cranium centre: azimuth (0 = front, ± = toward the
 * character's right/left, π = back) and world height. The hairline is a
 * smooth function hairlineY(az): forehead line (with widow's peak and
 * temple recession), temples, sideburns in front of the ears, the arc over
 * each ear, behind the ears and the nape. Roots are sampled uniformly over
 * the head (Fibonacci sphere) and projected onto the real head surface.
 * ===================================================================== */
import { projectTo, fieldNormal, rng } from '../mesh/builder.js';

const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const bell = (x, c, w) => Math.exp(-Math.pow((x - c) / w, 2));

export const HAIRLINE_DEFAULTS = { height: 0, recession: 0, widowsPeak: 0, sideburns: 0.5, nape: 0, temples: 0 };

/** Azimuth of a point around the cranium centre (0 = front, + = character's right). */
export function azimuthOf(p, c) { return Math.atan2(p[0] - c[0], -(p[2] - c[2])); }

/**
 * World height of the hairline at azimuth `az`.
 * hl: { height −1..1, recession 0..1, widowsPeak 0..1, sideburns 0..1, nape −1..1, temples −1..1 }
 */
export function hairlineY(az, hl, m) {
  const S = m.S, a = Math.abs(az);
  const yF = m.browY + (0.058 + 0.014 * hl.height) * S;                       // forehead hairline
  const yT = yF - (0.024 + 0.008 * (hl.temples || 0)) * S;                    // temple corner
  const ear = m.ears[0], earTop = ear.top[1], earMid = ear.c[1];
  const ySb = earTop - (0.006 + 0.03 * hl.sideburns) * S;                     // sideburn bottom
  const yN = m.napeY + (0.012 - 0.02 * (hl.nape || 0)) * S;
  let y;
  if (a < 1.05) {
    y = yF + (yT - yF) * ss(0.5, 1.02, a);
    y -= (hl.widowsPeak || 0) * 0.011 * S * bell(a, 0, 0.11);
    y += (hl.recession || 0) * (0.032 * S * bell(a, 0.5, 0.2) + 0.012 * S * bell(a, 0.2, 0.25));
  } else if (a < 1.3) {
    y = yT + (ySb - yT) * ss(1.05, 1.22, a);                                 // down the sideburn
  } else if (a < 1.82) {
    y = ySb + (earTop + 0.004 * S - ySb) * ss(1.28, 1.4, a);                 // over the ear
  } else {
    y = earTop + 0.004 * S + (yN - earTop - 0.004 * S) * ss(1.82, 2.3, a);   // behind the ear → nape
  }
  void earMid;
  return y;
}

/** Signed distance (m) above the hairline: > 0 inside the scalp, < 0 outside. */
export function scalpDepth(p, hl, m) {
  const c = m.cranium.c;
  return p[1] - hairlineY(azimuthOf(p, c), hl, m);
}

/**
 * Sample `count` roots uniformly over the hair-bearing scalp.
 * Returns [{ p, n, az, h (height above the hairline), up (0 front/1 crown) }].
 */
export function sampleScalp(field, m, hl, count, seed = 1, filter = null) {
  const c = m.cranium.c, R = m.cranium.r;
  const out = [];
  const total = Math.round(count * 1.9);                      // ~half the sphere is hair-bearing
  const rand = rng(seed);
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < total; i++) {
    const y = 1 - (i + 0.5) / total * 2;
    const rr = Math.sqrt(1 - y * y);
    const th = ga * i + rand() * 0.3;
    const d = [Math.cos(th) * rr, y, Math.sin(th) * rr];
    const start = [c[0] + d[0] * (R[0] + 0.03 * m.S), c[1] + d[1] * (R[1] + 0.03 * m.S), c[2] + d[2] * (R[2] + 0.03 * m.S)];
    if (start[1] < m.napeY - 0.03 * m.S) continue;
    const p = projectTo(field, start, 0, 6);
    // reject failed projections (landed on the shoulders / arms or diverged)
    if (Math.abs(field.eval(p[0], p[1], p[2])) > 0.002 * m.S) continue;
    const q = [(p[0] - c[0]) / R[0], (p[1] - c[1]) / R[1], (p[2] - c[2]) / R[2]];
    if (q[0] * q[0] + q[1] * q[1] + q[2] * q[2] > 2.2) continue;
    const h = scalpDepth(p, hl, m);
    if (h < 0) continue;
    const az = azimuthOf(p, c);
    // ears are never hair-bearing
    let nearEar = false;
    for (const e of m.ears) if (Math.hypot(p[0] - e.c[0], p[1] - e.c[1], p[2] - e.c[2]) < 0.024 * m.S) nearEar = true;
    if (nearEar) continue;
    const root = { p, n: fieldNormal(field, p), az, h, up: Math.max(0, Math.min(1, (p[1] - (m.browY)) / (m.top[1] - m.browY))) };
    if (filter && !filter(root)) continue;
    out.push(root);
  }
  return out;
}
