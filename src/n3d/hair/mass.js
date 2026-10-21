/* =====================================================================
 * HAIR MASS — the sculpted volume of a hairstyle
 *
 * Every hairstyle that has a `mass` in its recipe gets a real 3D hair
 * volume: a signed-distance field built from the head and the style's
 * shape, meshed with the same octree contouring as the body and garments.
 * The mass carries the SILHOUETTE (height on top, tapered sides, quiffs,
 * fringes, long hair falling over the back and resting on the shoulders),
 * while the strand layers of the engine (clumps, cards, fine strands) sit
 * on top of it and break up its outline. Its surface gets flow-aligned
 * UVs, so a strand texture (colour streaks + groove normal map) follows
 * the combing direction, and root → tip colours along the hair length.
 *
 * Components (all optional, combined with smooth unions):
 *   shell    scalp offset whose thickness varies over the head:
 *            top / sides / back / nape, front quiff, parting crease
 *   fringe   a slab falling from the front hairline over the forehead
 *   curtain  long hair: a hollow hull hanging from the widest part of the
 *            head down to the cut, resting on the shoulders / back, open
 *            at the face; behind the shoulders or with front sections
 *   spikes   tapered cones grown from the scalp (spiky / anime styles)
 *   bun      a rounded knot at a tie point
 * ===================================================================== */
import { contour } from '../mesh/octree.js';
import { FnField } from '../sdf/field.js';
import { azimuthOf, hairlineY, sampleScalp } from './scalp.js';
import { vertexNormals } from '../garments/shell.js';
import { BONE_INDEX } from '../core/skeleton.js';
import { rng, noise3 } from '../mesh/builder.js';

const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp01 = x => Math.max(0, Math.min(1, x));
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const smax = (a, b, k) => -smin(-a, -b, k);
const bell = (x, c, w) => Math.exp(-((x - c) / w) * ((x - c) / w));

/** Rounded cone (capsule with two radii) distance — Inigo Quilez. */
function roundCone(px, py, pz, a, b, r1, r2) {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz, rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  const pax = px - a[0], pay = py - a[1], paz = pz - a[2];
  const y = pax * bax + pay * bay + paz * baz, z = y - l2;
  const qx = pax * l2 - bax * y, qy = pay * l2 - bay * y, qz = paz * l2 - baz * y;
  const x2 = qx * qx + qy * qy + qz * qz, y2 = y * y * l2, z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

/**
 * @param h   hair context from the engine: { field (skin), collide, marks, rig, D, S, hl, c, whorl, partX, P }
 * @param M   recipe.mass
 * @returns   a hair part { id, rep: 'mass', geometry, bone, texture, weights } or null
 */
export function buildHairMass(h, M, P) {
  const S = h.S, m = h.marks, c = m.cranium.c, Rc = m.cranium.r;
  // distances must stay exact well away from the skin (the hair is centimetres thick): the far field
  const head = h.far || h.field, body = h.collide || h.far || h.field;
  const vol = 0.55 + 0.9 * P.volume;                 // user volume
  const lenK = P.length;
  const browY = m.browY, topY = m.top[1];
  const upOf = y => clamp01((y - browY) / (topY - browY));
  const chinY = m.chin[1], jawY = m.chin[1] + 0.03 * S;
  const shoulderY = h.rig.dim.shoulderY;
  const hl = h.hl;
  const parts = {};

  // ------------------------------------------------------------ shell (thickness over the scalp)
  const sh = { top: 0.012, side: 0.006, back: 0.01, nape: 0.005, front: null, quiff: 0, edge: 0.012, ...(M.shell || {}) };
  const thick = (az, up, y) => {
    const a = Math.abs(az), upRaw = (y - browY) / (topY - browY);
    const back = ss(1.7, 2.6, a), front = 1 - ss(0.55, 1.15, a);
    let t = sh.side + (sh.top - sh.side) * ss(0.2, 0.85, up);
    t += (sh.back - t) * back * (1 - ss(0.65, 0.95, up));
    t += (sh.nape - t) * back * (1 - ss(-0.7, 0.35, upRaw));                 // gradual toward the nape (no ledge)
    if (sh.front !== null) t += (sh.front - t) * front * (1 - ss(0.75, 1, up));
    if (sh.quiff) t += sh.quiff * front * bell(up, 0.78, 0.22);
    if (sh.crown) t += sh.crown * bell(up, 0.95, 0.25) * (1 - front * 0.6);
    if (sh.disconnect) {
      // undercut: long on top, clipped sides and back (a short but smooth step)
      const k = Math.max(ss(sh.disconnect - 0.1, sh.disconnect + 0.06, up), front * ss(0.22, 0.36, up));
      t = sh.side + (t - sh.side) * k;
    }
    return t * S * vol;
  };
  const shellFn = (x, y, z, crease = true) => {
    const az = azimuthOf([x, y, z], c), up = upOf(y);
    const depth = y - hairlineY(az, hl, m);                         // > 0 above the hairline
    const edge = sh.edge * S;
    const minT = 0.0014 * S;
    let t = thick(az, up, y);
    t = minT + (t - minT) * ss(0, edge, depth);                     // tapers to the scalp at the hairline
    let d = head.eval(x, y, z) - t;
    // the hairline: nothing below it (the steep hairline curve is scaled down to stay a distance bound)
    d = Math.max(d, (-depth - 0.0015 * S) / 3);
    // parting crease
    if (crease && P.part && P.part !== 'none' && sh.partCrease !== 0) {
      const px = c[0] + h.partX, inFront = z < c[2] + 0.03 * S;
      if (inFront && up > 0.45) {
        const w = Math.abs(x - px) - 0.0012 * S;
        d = smax(d, -(w + 0.0005 * S) + (t * 0.55), 0.004 * S);
      }
    }
    return d;
  };

  // ------------------------------------------------------------ fringe / bangs
  const FR = M.fringe ? { thick: 0.009, tipThick: 0.004, to: 'brow', width: 0.95, sweep: 0, ...M.fringe } : null;
  const fringeLen = FR ? Math.min(1.3, (P.fringe ?? 1) * (M.fringeReach ?? 1)) : 0;
  const fringeTo = FR ? ({ brow: browY + 0.002 * S, eye: m.eyes[0].center[1], nose: m.noseTip[1], hairline: null }[FR.to] ?? browY) : 0;
  const fringeFn = (x, y, z) => {
    const az = azimuthOf([x, y, z], c), a = az - (FR.sweep + 0.25 * P.direction);
    const yH = hairlineY(az, hl, m);
    const yEnd = yH - (yH - fringeTo) * fringeLen + 0.006 * S * Math.sin(az * 9 + 1.3) + 0.004 * S * Math.sin(az * 23);
    const k = clamp01((yH + 0.01 * S - y) / Math.max(0.01 * S, yH + 0.01 * S - yEnd));   // 0 at the hairline … 1 at the tips
    const t = (FR.thick + (FR.tipThick - FR.thick) * k) * S * vol;
    let d = head.eval(x, y, z) - t;
    const r = Math.hypot(x - c[0], z - c[2]);
    d = Math.max(d, (Math.abs(a) - FR.width) * r * 0.8, yEnd - y, y - (yH + 0.035 * S));
    if (FR.spiky) {
      // anime fringe: the bottom edge is cut into pointed locks
      const n = FR.spiky, ph = (a / FR.width * 0.5 + 0.5) * n, fr = ph - Math.floor(ph);
      const tooth = Math.abs(fr - 0.5) * 2;                                  // 0 at a lock's tip … 1 between locks
      d = Math.max(d, (yEnd + tooth * (yH - yEnd) * 0.55 - y) * 0.6);
    }
    return d;
  };

  // ------------------------------------------------------------ curtain (long hair)
  let curtainFn = null, curtainSolidFn = null, curtainInfo = null;
  if (M.curtain) {
    const C = { cut: 'shoulder', thickness: 0.026, flare: 0.08, face: 1.08, below: 'behind', frontLocks: false, gap: 0.006, vCut: 0, layers: 0.4, ...M.curtain };
    const cutY = ({ jaw: jawY, chin: chinY - 0.005 * S, neck: chinY - 0.05 * S, shoulder: shoulderY + 0.02 * S, chest: shoulderY - 0.13 * S, midback: shoulderY - 0.25 * S, waist: shoulderY - 0.42 * S }[C.cut] ?? shoulderY);
    // length: the user's length scales the distance from the ears to the cut
    const earY = m.ears[0].c[1];
    const yCut = earY - (earY - cutY) * lenK;
    const yTop = m.ears[0].top[1] + 0.03 * S;
    const ax = c[0], az0 = c[2] + 0.005 * S;
    // radial profile R(y, θ): hangs straight down from the widest part of the head (+ volume), rests on the body
    const na = 72, dy = 0.008 * S, y0 = Math.min(yCut, shoulderY - 0.5 * S) - 0.03 * S, ny = Math.ceil((yTop - y0) / dy) + 1;
    const R = new Float32Array(ny * na), Rb = new Float32Array(ny * na);
    const surfR = (f, y, th) => {
      const dx = Math.sin(th), dz = -Math.cos(th);
      let r = 0.42 * S;
      if (f.eval(ax + dx * r, y, az0 + dz * r) < 0) return r;
      for (let it = 0; it < 60 && r > 0.004; it++) {
        const v = f.eval(ax + dx * r, y, az0 + dz * r);
        if (v < 0.0015 * S) break;
        r -= Math.max(0.0015 * S, v * 0.9);
      }
      return Math.max(0, r);
    };
    const shellT = 0.004 * S + thick(Math.PI * 0.75, 0.3, 0);
    for (let j = 0; j < na; j++) {
      const th = -Math.PI + (j + 0.5) / na * 2 * Math.PI;
      let run = 0;
      for (let i = ny - 1; i >= 0; i--) {
        const y = y0 + i * dy;
        const rb = surfR(body, y, th);
        Rb[i * na + j] = rb;
        const above = y > jawY;
        // above the jaw: the head itself (+ shell thickness) sets the hang; below it only the body pushes out
        if (above) run = Math.max(run, rb + shellT + 0.006 * S * vol);
        const fl = C.flare * S * vol * Math.max(0, (Math.min(jawY, yTop) - y) / (0.3 * S)) * (0.6 + 0.4 * Math.abs(Math.sin(th)));
        R[i * na + j] = Math.max(run + fl, rb + C.gap * S + C.thickness * S * 0.5);
      }
    }
    // blur around and along to keep it smooth
    const tmp = new Float32Array(R.length);
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < ny; i++) for (let j = 0; j < na; j++) tmp[i * na + j] = (R[i * na + ((j + na - 1) % na)] + 2 * R[i * na + j] + R[i * na + ((j + 1) % na)]) / 4;
      for (let i = 0; i < ny; i++) for (let j = 0; j < na; j++) R[i * na + j] = (tmp[Math.max(0, i - 1) * na + j] + 2 * tmp[i * na + j] + tmp[Math.min(ny - 1, i + 1) * na + j]) / 4;
    }
    const at = (arr, y, th) => {
      let fy = (y - y0) / dy; fy = Math.max(0, Math.min(ny - 1.001, fy));
      let fa = (th + Math.PI) / (2 * Math.PI) * na - 0.5; fa = ((fa % na) + na) % na;
      const i0 = Math.floor(fy), j0 = Math.floor(fa), ty = fy - i0, ta = fa - j0, j1 = (j0 + 1) % na;
      return (arr[i0 * na + j0] * (1 - ta) + arr[i0 * na + j1] * ta) * (1 - ty) + (arr[(i0 + 1) * na + j0] * (1 - ta) + arr[(i0 + 1) * na + j1] * ta) * ty;
    };
    // where the hair may hang: the face stays open; below the jaw only behind the shoulders (or in front locks)
    const openHalf = y => {
      const below = 1 - ss(jawY - 0.03 * S, jawY + 0.02 * S, y);
      const behind = C.below === 'front' ? 0.55 : C.below === 'sides' ? 1.25 : 1.62;
      return C.face + (behind - C.face) * below;
    };
    const capR = y => {
      // below the shoulders the hair never spreads beyond the head width + flare (it rests on the back)
      return Rc[0] + 0.05 * S * vol + C.flare * S * Math.max(0, (jawY - y) / (0.3 * S));
    };
    const tau = C.thickness * S * vol;
    curtainInfo = { yCut, yTop, ax, az0, at, R };
    const curtain = solid => (x, y, z) => {
      if (y > yTop + 0.06 * S) return 1;
      const dx = x - ax, dz = z - az0, r = Math.hypot(dx, dz), th = Math.atan2(dx, -dz);
      const RR = at(R, Math.min(y, yTop), th) - 1.5 * Math.max(0, y - yTop);
      // a hollow hull of thickness tau (strands grow on the solid version, so they never fall inside it)
      let d = solid ? r - RR : Math.max(r - RR, RR - tau - r);
      // the face opening (angular cut, in metres along the circle)
      const ah = openHalf(y);
      d = Math.max(d, (ah - Math.abs(th)) * Math.max(r, 0.05 * S) * 0.7);
      // side spread limit below the shoulders
      if (y < jawY) d = Math.max(d, (Math.abs(dx) - capR(y)) * ss(jawY, jawY - 0.05 * S, y));
      // the cut: V / U shape and layered, uneven ends
      const back = Math.abs(th) / Math.PI;
      const ends = yCut - C.vCut * S * (back * back) + 0.012 * S * C.layers * (Math.sin(th * 11 + 0.7) * 0.6 + Math.sin(th * 27 + 2) * 0.4);
      d = Math.max(d, (ends - y) * 0.9);
      return d;
    };
    curtainFn = curtain(false);
    curtainSolidFn = curtain(true);
  }

  // ------------------------------------------------------------ spikes
  let spikes = null;
  if (M.spikes) {
    const K = { count: 26, length: 0.05, radius: 0.012, region: 'top', lean: 0.35, ...M.spikes };
    const keep = K.region === 'all' ? (r => r.up > 0.12) : K.region === 'strip' ? (r => Math.abs(r.p[0] - c[0]) < 0.022 * S && r.up > 0.12)
      : K.region === 'locks' ? (r => !(Math.abs(r.az) < 1.0 && r.up < 0.7) && r.up < 0.55) : (r => r.up > 0.35);
    const pool = sampleScalp(h.field, m, hl, Math.round(K.count * (K.region === 'strip' ? 14 : 3) * P.density), 77, keep);
    const roots = K.region === 'strip' ? pool.sort((a, b) => a.p[2] - b.p[2]).filter((_, i, A) => i % Math.max(1, Math.floor(A.length / (K.count * P.density))) === 0) : pool.slice(0, Math.round(K.count * P.density));
    const R = rng(13);
    spikes = roots.map(rt => {
      const L = K.length * S * lenK * (0.7 + 0.6 * R()) * (K.region === 'strip' || K.down ? 1 : 0.6 + 0.6 * rt.up);
      const dirOut = rt.n;
      let dx, dy, dz;
      if (K.down) {
        // locks fall along the head (tangent, downward) and stand a little off it
        const g = [0, -1, 0.3], gn = g[0] * dirOut[0] + g[1] * dirOut[1] + g[2] * dirOut[2];
        let tx = g[0] - dirOut[0] * gn, ty = g[1] - dirOut[1] * gn, tz = g[2] - dirOut[2] * gn;
        const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
        dx = tx + dirOut[0] * 0.12 + (R() - 0.5) * 0.25 + P.direction * 0.2; dy = ty + dirOut[1] * 0.12; dz = tz + dirOut[2] * 0.12;
      } else {
        const back = [0, 0.15, 1];
        dx = dirOut[0] + back[0] * K.lean + (R() - 0.5) * 0.4 * P.messiness + P.direction * 0.3;
        dy = dirOut[1] + back[1] * K.lean + 0.35; dz = dirOut[2] + back[2] * K.lean;
      }
      const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
      // locks start inside the hair volume, so they grow out of it instead of sitting on the scalp
      const sink = K.down ? -0.002 * S : 0.004 * S;
      const a = [rt.p[0] - rt.n[0] * sink + (K.down ? rt.n[0] * thick(rt.az, rt.up, rt.p[1]) * 0.5 : 0), rt.p[1] - rt.n[1] * sink + (K.down ? rt.n[1] * thick(rt.az, rt.up, rt.p[1]) * 0.5 : 0), rt.p[2] - rt.n[2] * sink + (K.down ? rt.n[2] * thick(rt.az, rt.up, rt.p[1]) * 0.5 : 0)];
      const b = [rt.p[0] + dx * L, rt.p[1] + dy * L, rt.p[2] + dz * L];
      const r1 = K.radius * S * (0.8 + 0.4 * R()) * Math.sqrt(P.thickness);
      return { a, b, r1, r2: 0.0012 * S, cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2, cz: (a[2] + b[2]) / 2, br: L / 2 + r1 };
    });
  }
  const spikeFn = (x, y, z) => {
    let d = 1;
    for (const s of spikes) {
      const lb = Math.hypot(x - s.cx, y - s.cy, z - s.cz) - s.br;
      if (lb > d) continue;
      d = smin(d, roundCone(x, y, z, s.a, s.b, s.r1, s.r2), 0.004 * S);
    }
    return d;
  };

  // ------------------------------------------------------------ bun
  let bunFn = null;
  if (M.bun) {
    const T = M.bun.at(h), rb = (M.bun.radius || 0.04) * S * (0.7 + 0.5 * P.volume) * Math.sqrt(lenK);
    const ctr = [T[0], T[1], T[2] + rb * 0.55];
    bunFn = (x, y, z) => {
      const qx = (x - ctr[0]) / rb, qy = (y - ctr[1]) / (rb * 0.82), qz = (z - ctr[2]) / (rb * 0.9);
      const k = Math.hypot(qx, qy, qz);
      return (k - 1) * rb * 0.82 + 0.0015 * S * noise3(x * 120, y * 120, z * 120, 3);
    };
  }

  // ------------------------------------------------------------ the combined field
  const kBlend = 0.006 * S;
  const comps = [];
  if (M.shell !== false) comps.push(['shell', shellFn]);
  if (FR && fringeLen > 0.05) comps.push(['fringe', fringeFn]);
  if (curtainFn) comps.push(['curtain', curtainFn]);
  if (spikes && spikes.length) comps.push(['spikes', spikeFn]);
  if (bunFn) comps.push(['bun', bunFn]);
  if (!comps.length) return null;
  const combine = list => (x, y, z) => {
    let d = Infinity;
    for (const [, f] of list) { const v = f(x, y, z); d = d === Infinity ? v : smin(d, v, kBlend); }
    // never inside the body / clothes below the jaw (hair rests on the shoulders and back)
    if (y < jawY + 0.02 * S && body) {
      const w = ss(jawY + 0.02 * S, jawY - 0.03 * S, y);
      d = Math.max(d, (0.003 * S - body.eval(x, y, z)) * w - (1 - w) * 0.02 * S);
    }
    return d;
  };
  const field = combine(comps);
  // strands grow over a simpler, closed version: no parting crease, solid curtain (nothing to get trapped in)
  const shellNoCrease = (x, y, z) => shellFn(x, y, z, false);
  const growField = combine(comps.map(([n, f]) => [n, n === 'curtain' && curtainSolidFn ? curtainSolidFn : n === 'shell' ? shellNoCrease : f]));

  // ------------------------------------------------------------ mesh
  const cell = Math.max(0.0028 * S, (h.D.hairMass || 0.0042) * S);
  const lowY = curtainInfo ? curtainInfo.yCut - 0.04 * S : Math.min(m.napeY, fringeTo || m.napeY) - 0.03 * S;
  const min = [c[0] - Rc[0] - 0.12 * S, lowY, c[2] - Rc[2] - 0.12 * S], max = [c[0] + Rc[0] + 0.12 * S, topY + 0.1 * S + (spikes ? 0.06 * S * lenK : 0), c[2] + Rc[2] + 0.16 * S];
  const size = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  const depth = Math.ceil(Math.log2(size / cell)), root = cell * (1 << depth);
  const ctr = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const mesh = contour(new FnField(field), { min: [ctr[0] - root / 2, ctr[1] - root / 2, ctr[2] - root / 2], size: root, maxDepth: depth, cellSizeAt: () => cell, margin: 1.5, project: 2, normals: false });
  let Pp = mesh.positions, I = mesh.indices;
  // drop what is hidden inside the head / body (inner walls of the hull, under the scalp)
  {
    const nv = Pp.length / 3, inside = new Uint8Array(nv);
    for (let i = 0; i < nv; i++) {
      const x = Pp[i * 3], y = Pp[i * 3 + 1], z = Pp[i * 3 + 2];
      inside[i] = head.eval(x, y, z) < -0.0012 * S || (y < jawY && body && body.eval(x, y, z) < -0.001 * S) ? 1 : 0;
    }
    const keep = [];
    for (let t = 0; t < I.length; t += 3) if (!(inside[I[t]] && inside[I[t + 1]] && inside[I[t + 2]])) keep.push(I[t], I[t + 1], I[t + 2]);
    I = Uint32Array.from(keep);
  }
  if (!I.length) return null;
  const N = vertexNormals(Pp, I);
  const nv = Pp.length / 3;

  // ------------------------------------------------------------ flow UVs (metres), root → tip colours, ambient occlusion
  const uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3), tipT = new Float32Array(nv);
  const flow = M.flow || 'natural';
  const w = h.whorl, wc = [w[0] - c[0], w[1] - c[1], w[2] - c[2]], wl = Math.hypot(...wc), wa = wc.map(v => v / wl);
  let e1 = Math.abs(wa[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  { const d = e1[0] * wa[0] + e1[1] * wa[1] + e1[2] * wa[2]; e1 = [e1[0] - wa[0] * d, e1[1] - wa[1] * d, e1[2] - wa[2] * d]; const l = Math.hypot(...e1); e1 = e1.map(v => v / l); }
  const e2 = [wa[1] * e1[2] - wa[2] * e1[1], wa[2] * e1[0] - wa[0] * e1[2], wa[0] * e1[1] - wa[1] * e1[0]];
  const rMean = (Rc[0] + Rc[1] + Rc[2]) / 3;
  const Rgen = rng(5);
  const streak = new Float32Array(97); for (let i = 0; i < streak.length; i++) streak[i] = 0.82 + 0.3 * Rgen();
  for (let i = 0; i < nv; i++) {
    const x = Pp[i * 3], y = Pp[i * 3 + 1], z = Pp[i * 3 + 2];
    let best = 'shell', bv = Infinity;
    for (const [name, f] of comps) { const v = Math.abs(f(x, y, z)); if (v < bv) { bv = v; best = name; } }
    let u, v, t;
    if (best === 'curtain' && curtainInfo) {
      const dx = x - curtainInfo.ax, dz = z - curtainInfo.az0, th = Math.atan2(dx, -dz), r = Math.hypot(dx, dz);
      u = th * Math.max(r, 0.06 * S); v = y;
      t = clamp01((curtainInfo.yTop - y) / Math.max(0.05 * S, curtainInfo.yTop - curtainInfo.yCut));
    } else if (best === 'fringe') {
      u = x; v = y; t = clamp01((hairlineY(azimuthOf([x, y, z], c), hl, m) - y) / (0.07 * S)) * 0.8 + 0.1;
    } else if (best === 'spikes') {
      const q = [x - c[0], y - c[1], z - c[2]];
      u = Math.atan2(q[0], -q[2]) * rMean; v = y; t = clamp01((y - c[1]) / (0.15 * S)) * 0.9 + 0.1;
    } else if (flow === 'back' || flow === 'forward') { u = x; v = z - 0.3 * y; t = 0.25; }
    else if (flow === 'side') { u = z; v = x - 0.2 * y; t = 0.25; }
    else if (flow === 'up') { const q = [x - c[0], z - c[2]]; u = Math.atan2(q[0], -q[1]) * rMean; v = y; t = 0.25; }
    else {
      // natural fall from the crown whorl: streaks radiate from it
      const q = [x - c[0], y - c[1], z - c[2]], ql = Math.hypot(...q) || 1;
      const dw = (q[0] * wa[0] + q[1] * wa[1] + q[2] * wa[2]) / ql;
      const phi = Math.acos(Math.max(-1, Math.min(1, dw)));
      const psi = Math.atan2((q[0] * e2[0] + q[1] * e2[1] + q[2] * e2[2]), (q[0] * e1[0] + q[1] * e1[1] + q[2] * e1[2]));
      u = psi * Math.sin(Math.min(phi, 1.2)) * rMean; v = phi * rMean; t = clamp01(phi / 2.2) * 0.5;
    }
    uv[i * 2] = u; uv[i * 2 + 1] = v;
    tipT[i] = t;
    // colour: root → tip, streaky variation across the strands, highlights, AO in hollows / under layers
    let cc = [P.rootRGB[0] + (P.tipRGB[0] - P.rootRGB[0]) * t, P.rootRGB[1] + (P.tipRGB[1] - P.rootRGB[1]) * t, P.rootRGB[2] + (P.tipRGB[2] - P.rootRGB[2]) * t];
    const sk = streak[Math.abs(Math.floor(u / (0.004 * S))) % streak.length];
    if (P.highlightAmount > 0 && P.highlightRGB) {
      const hlv = clamp01((noise3(u * 70, 0.5, 0.2, 11) * 0.5 + 0.5 - (1 - P.highlightAmount)) * 4);
      cc = [cc[0] + (P.highlightRGB[0] - cc[0]) * hlv * 0.7, cc[1] + (P.highlightRGB[1] - cc[1]) * hlv * 0.7, cc[2] + (P.highlightRGB[2] - cc[2]) * hlv * 0.7];
    }
    // inner surfaces of a curtain (facing the head) are in shadow
    let ao = 1;
    if (best === 'curtain' && curtainInfo) {
      const dx = x - curtainInfo.ax, dz = z - curtainInfo.az0, r = Math.hypot(dx, dz) || 1;
      const inward = -(N[i * 3] * dx + N[i * 3 + 2] * dz) / r;
      ao = 1 - 0.45 * clamp01(inward * 1.5);
    }
    const hd = head.eval(x, y, z);
    if (best === 'shell') ao *= 0.78 + 0.22 * clamp01(hd / (0.006 * S));
    col[i * 3] = cc[0] * sk * ao; col[i * 3 + 1] = cc[1] * sk * ao; col[i * 3 + 2] = cc[2] * sk * ao;
  }

  // ------------------------------------------------------------ skin weights: head, blending to the upper chest for long hair
  const si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4);
  const bHead = BONE_INDEX.head, bNeck = BONE_INDEX.neck, bChest = BONE_INDEX.upperChest;
  for (let i = 0; i < nv; i++) {
    const y = Pp[i * 3 + 1];
    const wh = ss(shoulderY - 0.02 * S, jawY, y);           // 1 = head
    const wc2 = 1 - wh;
    si[i * 4] = bHead; sw[i * 4] = wh * 0.85 + (wh >= 1 ? 0.15 : 0);
    si[i * 4 + 1] = bNeck; sw[i * 4 + 1] = wh >= 1 ? 0 : 0.15 * wh + 0.25 * wc2;
    si[i * 4 + 2] = bChest; sw[i * 4 + 2] = wc2 * 0.75;
    const s = sw[i * 4] + sw[i * 4 + 1] + sw[i * 4 + 2];
    for (let k = 0; k < 3; k++) sw[i * 4 + k] /= s;
  }
  return {
    part: { id: 'hair_mass', rep: 'mass', bone: bHead, texture: M.texture || 'mass', geometry: { position: Pp, normal: N, uv, color: col, index: I, skinIndex: si, skinWeight: sw } },
    field: new FnField(growField),
    stats: { tris: I.length / 3, cell },
  };
}
