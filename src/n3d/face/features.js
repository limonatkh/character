/* =====================================================================
 * FACE FEATURES built as their own geometry: eyeballs (with a cornea
 * bulge and polar UVs for the iris texture), eyebrows (individual hair
 * ribbons lying on the brow, combed in the natural directions) and
 * eyelashes (curved, tapering lashes along the real lid margins).
 * ===================================================================== */
import { MeshBuilder, uvSphere, ribbon, add, sub, mul, norm, cross, dot, madd, lerp3, rng, projectTo, fieldNormal, resample } from '../mesh/builder.js';
import { BONE_INDEX } from '../core/skeleton.js';

/** Eyeballs: one mesh per eye, skinned 100% to its eye bone. */
export function buildEyeballs(head, opts = {}) {
  return head.eyes.map(e => {
    const mb = new MeshBuilder();
    // local axes: x = right, y = up, z = forward (−Z world) → the iris is at the +z pole
    uvSphere(mb, e.center, e.radius * 0.985, { ws: opts.ws || 32, hs: opts.hs || 20, axes: [[1, 0, 0], [0, 1, 0], [0, 0, -1]], bulge: 0.07 });
    return { id: 'eye_' + e.side, kind: 'eye', bone: BONE_INDEX[e.side + 'Eye'], geometry: mb.build() };
  });
}

/* ---------------------------------------------------------------- eyelashes */
/** Point on the lid margin at azimuth `az` (upper or lower), slightly outside the lid bulb. */
function lidMargin(e, az, upper, out = 0) {
  const q = Math.cos(Math.min(Math.PI / 2, Math.abs(az) * Math.PI / (2 * e.A)));
  const el = upper ? e.Eu * Math.pow(Math.max(q, 0), e.pw) - 0.03 : -e.El * Math.pow(Math.max(q, 0), e.pw * 0.85) + 0.03;
  const elev = el + e.tilt * az;
  const r = e.radius + e.lid * 0.6 + out;
  // u outward (s), v up, w forward (−Z)
  const u = Math.sin(az) * Math.cos(elev), v = Math.sin(elev), w = Math.cos(az) * Math.cos(elev);
  return [e.center[0] + e.s * u * r, e.center[1] + v * r, e.center[2] - w * r];
}

/**
 * @param cfg { length 0..1.6, density 0.4..1.5, curl 0..1, color }
 */
export function buildLashes(head, cfg = {}, D = {}) {
  const length = cfg.length ?? 1, density = cfg.density ?? 1, curl = cfg.curl ?? 0.6;
  const mb = new MeshBuilder({ colors: false });
  const S = head.marks.S;
  for (const e of head.eyes) {
    for (const upper of [true, false]) {
      const count = Math.round((upper ? 44 : 16) * density * (D.trim || 1) ** 0.5);
      const R = rng(upper ? 11 : 23);
      for (let i = 0; i < count; i++) {
        const tt = (i + 0.5) / count;
        const az = (-0.92 + 1.84 * tt) * e.A * (upper ? 1 : 0.8);
        const outer = Math.max(0, az / e.A);                    // longer toward the outer corner
        const root = lidMargin(e, az, upper);
        const nrm = norm(sub(root, e.center));
        const up = upper ? [0, 1, 0] : [0, -1, 0];
        const L = (upper ? 0.0082 : 0.0032) * S * length * (0.75 + 0.45 * outer + 0.15 * R()) * (1 - 0.35 * Math.pow(Math.abs(az / e.A), 4));
        const pts = [];
        const n = 5;
        for (let k = 0; k < n; k++) {
          const t = k / (n - 1);
          // out of the lid, then curling up (upper) or down (lower)
          const dir = norm(add(mul(nrm, 1 - 0.6 * curl * t), mul(up, (0.35 + curl * 0.9) * t)));
          pts.push(k === 0 ? root : madd(pts[k - 1], dir, L / (n - 1)));
        }
        const side = norm(cross(nrm, up));
        ribbon(mb, pts, t => 0.00034 * S * (1 - 0.85 * t), () => cross(sub(pts[n - 1], pts[0]), side), {});
      }
    }
  }
  return { id: 'lashes', kind: 'lashes', bone: BONE_INDEX.head, geometry: mb.build() };
}

/* ---------------------------------------------------------------- eyebrows */
/**
 * Eyebrow hairs. Shape comes from the head landmarks plus:
 * cfg { thickness 0.4..1.8, density 0.3..1.6, arch −1..1, angle −1..1, length 0.7..1.25,
 *       tail −1..1 (tail drop), spacing −1..1, bushiness 0..1, gap (unibrow −1 .. 1) }
 */
export function buildBrows(sf, head, cfg = {}, D = {}) {
  const field = sf.field, S = head.marks.S;
  const th = cfg.thickness ?? 1, dens = cfg.density ?? 1, arch = cfg.arch ?? 0, ang = cfg.angle ?? 0;
  const lenK = cfg.length ?? 1, bush = cfg.bushiness ?? 0.15, tailDrop = cfg.tail ?? 0;
  const mb = new MeshBuilder({ colors: true });
  for (const b of head.marks.brows) {
    const s = b.s;
    // brow centre line: inner → peak → outer, shaped by the parameters
    const inner = add(b.inner, [s * 0.002 * S * (cfg.spacing ?? 0), -0.002 * S * ang, 0]);
    const outerFull = add(b.outer, [0, 0.002 * S * ang - 0.003 * S * tailDrop, 0]);
    const outer = lerp3(inner, outerFull, 0.82 + 0.18 * lenK);
    const peak = add(lerp3(b.peak, lerp3(inner, outer, 0.62), 0.3), [0, 0.0035 * S * arch, 0]);
    const line = resample([inner, lerp3(inner, peak, 0.55), peak, lerp3(peak, outer, 0.5), outer], 24).map(p => projectTo(field, p, 0.0004, 4));
    const total = Math.round(150 * dens * th * Math.min(1.6, D.trim || 1));
    const R = rng(s > 0 ? 77 : 78);
    const widthAt = u => (0.0072 * th * S) * (u < 0.25 ? 0.75 + u : u > 0.7 ? 1 - (u - 0.7) * 2.2 : 1);
    for (let i = 0; i < total; i++) {
      const u = Math.pow(R(), 0.92);
      const v = (R() - 0.5);                                   // across the brow
      const k = Math.min(line.length - 2, Math.floor(u * (line.length - 1)));
      const f = u * (line.length - 1) - k;
      const c = lerp3(line[k], line[k + 1], f);
      const tang = norm(sub(line[k + 1], line[k]));
      const nrm = fieldNormal(field, c);
      const across = norm(cross(nrm, tang)).map(x => x * (s > 0 ? 1 : -1));   // points up on the face
      const root = projectTo(field, madd(c, across, v * widthAt(u)), 0.0003, 3);
      // direction: inner hairs point up, the body and tail sweep outward; upper hairs comb down-out, lower up-out
      const upW = u < 0.22 ? 0.9 - u * 2.5 : -v * 0.9;
      let dir = norm(add(mul(tang, u < 0.22 ? 0.35 : 1), mul(across, upW + (R() - 0.5) * 0.35 * (0.4 + bush))));
      const L = (0.004 + 0.0025 * R()) * S * (u < 0.22 ? 0.85 : 1) * (0.8 + 0.5 * bush) * (0.75 + 0.25 * th);
      const pts = [root];
      for (let j = 1; j < 4; j++) {
        dir = norm(add(dir, mul(nrm, -0.12)));                // lie down on the skin
        let p = madd(pts[j - 1], dir, L / 3);
        p = projectTo(field, p, 0.00035 + 0.0006 * bush * (j / 3) + 0.0002 * Math.abs(v), 2);
        pts.push(p);
      }
      const shade = 0.85 + 0.3 * R();
      ribbon(mb, pts, t => 0.00062 * S * (1 - 0.7 * t) * (0.8 + 0.3 * th), () => nrm, { color: () => [shade, shade, shade] });
    }
  }
  return { id: 'brows', kind: 'brows', bone: BONE_INDEX.head, geometry: mb.build() };
}
