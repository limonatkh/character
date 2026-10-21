/* =====================================================================
 * GEOMETRY TOOLKIT for explicit (non-field) parts: tubes, ribbons, discs,
 * boxes, lathes, curve frames, projection onto distance fields.
 * Used by hair, garment trims (collars, buttons, zippers, drawstrings,
 * stitching), accessories and drapes. Pure JS, typed arrays out.
 * ===================================================================== */
import { gradient } from '../sdf/field.js';

export class MeshBuilder {
  constructor(opts = {}) {
    this.pos = []; this.nor = []; this.uv = []; this.col = opts.colors ? [] : null; this.idx = [];
    this.extra = opts.extra || null;            // optional per-vertex scalar channel (e.g. hair "t" root→tip)
    this.ex = this.extra ? [] : null;
  }
  get count() { return this.pos.length / 3; }
  vert(p, n, u = 0, v = 0, c = null, e = 0) {
    this.pos.push(p[0], p[1], p[2]); this.nor.push(n[0], n[1], n[2]); this.uv.push(u, v);
    if (this.col) this.col.push(...(c || [1, 1, 1]));
    if (this.ex) this.ex.push(e);
    return this.pos.length / 3 - 1;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
  quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }
  /** Append another builder's data (offsetting indices). */
  merge(o) {
    const base = this.count;
    this.pos.push(...o.pos); this.nor.push(...o.nor); this.uv.push(...o.uv);
    if (this.col) this.col.push(...(o.col || new Array(o.count * 3).fill(1)));
    if (this.ex) this.ex.push(...(o.ex || new Array(o.count).fill(0)));
    for (const i of o.idx) this.idx.push(i + base);
  }
  build() {
    const out = {
      position: new Float32Array(this.pos), normal: new Float32Array(this.nor), uv: new Float32Array(this.uv),
      index: this.count > 65535 ? new Uint32Array(this.idx) : new Uint32Array(this.idx),
    };
    if (this.col) out.color = new Float32Array(this.col);
    if (this.ex) out.extra = new Float32Array(this.ex);
    return out;
  }
}

/* ---------------------------------------------------------------- vectors */
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = a => Math.hypot(a[0], a[1], a[2]);
export const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const madd = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
/** Rotate v around unit axis k by angle a (Rodrigues). */
export function rotate(v, k, a) {
  const c = Math.cos(a), s = Math.sin(a), d = dot(k, v), x = cross(k, v);
  return [v[0] * c + x[0] * s + k[0] * d * (1 - c), v[1] * c + x[1] * s + k[1] * d * (1 - c), v[2] * c + x[2] * s + k[2] * d * (1 - c)];
}

/* ---------------------------------------------------------------- curves */
/** Catmull-Rom resampling of a polyline into n points. */
export function resample(pts, n) {
  if (pts.length < 2) return pts.slice();
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + len(sub(pts[i], pts[i - 1])));
  const total = L[L.length - 1] || 1e-9;
  const out = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const s = total * k / (n - 1);
    while (j < pts.length - 2 && L[j + 1] < s) j++;
    const t = (s - L[j]) / ((L[j + 1] - L[j]) || 1e-9);
    const p0 = pts[Math.max(0, j - 1)], p1 = pts[j], p2 = pts[j + 1], p3 = pts[Math.min(pts.length - 1, j + 2)];
    out.push(catmull(p0, p1, p2, p3, t));
  }
  return out;
}
function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return [0, 1, 2].map(i => 0.5 * ((2 * p1[i]) + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3));
}
export function polylineLength(pts) { let s = 0; for (let i = 1; i < pts.length; i++) s += len(sub(pts[i], pts[i - 1])); return s; }

/**
 * Rotation-minimising frames along a curve. `up0` = initial normal hint
 * (or a function i → hint to re-orient, e.g. "away from the head").
 */
export function frames(pts, up0 = [0, 1, 0]) {
  const n = pts.length, T = [], N = [], B = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    T.push(norm(sub(b, a)));
  }
  let nrm = typeof up0 === 'function' ? up0(0) : up0;
  nrm = norm(sub(nrm, mul(T[0], dot(nrm, T[0]))));
  if (!isFinite(nrm[0]) || len(nrm) < 0.5) nrm = norm(cross(T[0], Math.abs(T[0][1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      // parallel transport
      const ax = cross(T[i - 1], T[i]); const sl = len(ax);
      if (sl > 1e-8) nrm = rotate(nrm, mul(ax, 1 / sl), Math.asin(Math.min(1, sl)));
      if (typeof up0 === 'function') {
        const h = up0(i); const hp = norm(sub(h, mul(T[i], dot(h, T[i]))));
        nrm = norm(lerp3(nrm, hp, 0.35));
      }
      nrm = norm(sub(nrm, mul(T[i], dot(nrm, T[i]))));
    }
    N.push(nrm); B.push(cross(T[i], nrm));
  }
  return { T, N, B };
}

/**
 * Tube along a curve. radius(t) with t ∈ [0,1]; scale = [sx(t), sy(t)] for
 * elliptical sections (sx along N, sy along B). Caps optional.
 */
export function tube(mb, pts, radius, opts = {}) {
  const sides = opts.sides || 8, n = pts.length;
  const F = opts.frames || frames(pts, opts.up || [0, 1, 0]);
  const flat = opts.flat || (() => 1);
  const twist = opts.twist || (() => 0);
  const start = mb.count;
  const vScale = opts.vScale ?? 1;
  let L = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) L += len(sub(pts[i], pts[i - 1]));
    const t = i / (n - 1), r = radius(t), fl = flat(t), tw = twist(t);
    for (let k = 0; k <= sides; k++) {
      const a = (k / sides) * Math.PI * 2 + tw;
      const ca = Math.cos(a), sa = Math.sin(a);
      const dir = add(mul(F.N[i], ca), mul(F.B[i], sa));
      const off = add(mul(F.N[i], ca * r * fl), mul(F.B[i], sa * r));
      // normal of an ellipse: (ca / fl, sa)
      const nn = norm(add(mul(F.N[i], ca / (fl || 1)), mul(F.B[i], sa)));
      mb.vert(add(pts[i], off), r > 1e-6 ? nn : dir, k / sides * (opts.uScale ?? 1), opts.metricV ? L * vScale : t * vScale, opts.color ? opts.color(t, k / sides) : null, t);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < sides; k++) {
    const a = start + i * (sides + 1) + k, b = a + sides + 1;
    mb.quad(a, b, b + 1, a + 1);
  }
  if (opts.capStart) cap(mb, pts[0], mul(F.T[0], -1), start, sides, false);
  if (opts.capEnd) cap(mb, pts[n - 1], F.T[n - 1], start + (n - 1) * (sides + 1), sides, true);
  return F;
}
function cap(mb, c, nrm, ring, sides, flip) {
  const ci = mb.vert(c, nrm, 0.5, 0.5);
  for (let k = 0; k < sides; k++) {
    // duplicate ring vertices with the cap normal
    if (flip) mb.tri(ring + k, ring + k + 1, ci); else mb.tri(ring + k + 1, ring + k, ci);
  }
}

/**
 * Ribbon (flat strip) along a curve. width(t); facing: function i → normal hint
 * (the strip's face normal). Two-sided via material. UV: u across 0..1, v along 0..1.
 */
export function ribbon(mb, pts, width, facing, opts = {}) {
  const n = pts.length, start = mb.count;
  const T = pts.map((p, i) => norm(sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)])));
  const u0 = opts.u0 ?? 0, u1 = opts.u1 ?? 1;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    let f = facing(i, t);
    f = norm(sub(f, mul(T[i], dot(f, T[i]))));
    const side = norm(cross(T[i], f));
    const w = width(t) / 2;
    const off = opts.offset ? opts.offset(t) : 0;
    const c = madd(pts[i], side, off);
    const col = opts.color ? opts.color(t) : null;
    mb.vert(madd(c, side, -w), f, u0, t, col, t);
    mb.vert(madd(c, side, w), f, u1, t, col, t);
  }
  for (let i = 0; i < n - 1; i++) { const a = start + i * 2; mb.quad(a, a + 2, a + 3, a + 1); }
}

/** Closed-loop band (ring) around a loop of points, with height along `up(i)` and thickness outward along `out(i)`. */
export function band(mb, loop, height, thickness, out, up, opts = {}) {
  const n = loop.length, start = mb.count;
  const rows = [[0, 0], [0, height], [thickness, height], [thickness, 0]];   // (outward, up) profile, closed box section
  const L = [0];
  for (let i = 1; i <= n; i++) L.push(L[i - 1] + len(sub(loop[i % n], loop[i - 1])));
  for (let i = 0; i <= n; i++) {
    const p = loop[i % n], o = out(i % n), u = up(i % n);
    rows.forEach(([a, b], r) => {
      const nn = r === 0 ? mul(o, -1) : r === 1 ? u : r === 2 ? o : mul(u, -1);
      mb.vert(add(p, add(mul(o, a + (opts.inset || 0)), mul(u, b))), nn, L[i] * (opts.uScale ?? 1), r / 3 * height * (opts.uScale ?? 1));
    });
  }
  for (let i = 0; i < n; i++) for (let r = 0; r < 4; r++) {
    const a = start + i * 4 + r, b = start + i * 4 + (r + 1) % 4, c = start + (i + 1) * 4 + (r + 1) % 4, d = start + (i + 1) * 4 + r;
    mb.quad(a, d, c, b);
  }
}

/** Cylinder (disc with thickness) centred at c, axis a. */
export function disc(mb, c, a, r, h, opts = {}) {
  const sides = opts.sides || 16;
  const ax = norm(a), u = norm(cross(ax, Math.abs(ax[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), v = cross(ax, u);
  const top = madd(c, ax, h / 2), bot = madd(c, ax, -h / 2);
  const bevel = opts.bevel ?? 0.25;
  const start = mb.count;
  // rings: top centre, top rim (inner), top edge, bottom edge, bottom rim, bottom centre
  const rimR = r * (1 - bevel * 0.4);
  const ct = mb.vert(madd(top, ax, opts.dome ? h * 0.4 : 0), ax, 0.5, 0.5);
  for (let k = 0; k <= sides; k++) {
    const an = k / sides * Math.PI * 2, d = add(mul(u, Math.cos(an)), mul(v, Math.sin(an)));
    mb.vert(madd(top, d, rimR), norm(add(ax, mul(d, 0.6))), 0.5 + 0.5 * Math.cos(an), 0.5 + 0.5 * Math.sin(an));
    mb.vert(madd(madd(top, ax, -h * 0.15), d, r), d, k / sides, 0);
    mb.vert(madd(madd(bot, ax, h * 0.15), d, r), d, k / sides, 1);
    mb.vert(madd(bot, d, rimR), norm(add(mul(ax, -1), mul(d, 0.6))), 0.5 + 0.5 * Math.cos(an), 0.5 + 0.5 * Math.sin(an));
  }
  const cb = mb.vert(bot, mul(ax, -1), 0.5, 0.5);
  for (let k = 0; k < sides; k++) {
    const r0 = start + 1 + k * 4, r1 = start + 1 + (k + 1) * 4;
    mb.tri(ct, r0, r1);
    mb.quad(r0, r0 + 1, r1 + 1, r1);
    mb.quad(r0 + 1, r0 + 2, r1 + 2, r1 + 1);
    mb.quad(r0 + 2, r0 + 3, r1 + 3, r1 + 2);
    mb.tri(cb, r1 + 3, r0 + 3);
  }
}

/** Box with given centre, half extents, and axes (x, y, z unit vectors). */
export function box(mb, c, h, ax = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
  const [X, Y, Z] = ax;
  const faces = [[X, Y, Z, h[0], h[1], h[2]], [mul(X, -1), Z, Y, h[0], h[2], h[1]], [Y, Z, X, h[1], h[2], h[0]], [mul(Y, -1), X, Z, h[1], h[0], h[2]], [Z, X, Y, h[2], h[0], h[1]], [mul(Z, -1), Y, X, h[2], h[1], h[0]]];
  for (const [n, a, b, dn, da, db] of faces) {
    const fc = madd(c, n, dn);
    const s = mb.count;
    for (const [i, j] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) mb.vert(madd(madd(fc, a, i * da), b, j * db), n, (i + 1) / 2, (j + 1) / 2);
    // winding: (a × b) should equal n
    const w = dot(cross(a, b), n) > 0;
    if (w) mb.quad(s, s + 1, s + 2, s + 3); else mb.quad(s, s + 3, s + 2, s + 1);
  }
}

/** UV sphere (eyeballs, beads). */
export function uvSphere(mb, c, r, opts = {}) {
  const ws = opts.ws || 24, hs = opts.hs || 16, start = mb.count;
  const ax = opts.axes || [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let j = 0; j <= hs; j++) {
    const th = j / hs * Math.PI;
    for (let i = 0; i <= ws; i++) {
      const ph = i / ws * Math.PI * 2;
      // local: z = polar axis (the eye's forward axis)
      const l = [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)];
      const d = add(add(mul(ax[0], l[0]), mul(ax[1], l[1])), mul(ax[2], l[2]));
      const sc = opts.bulge ? 1 + opts.bulge * Math.pow(Math.max(0, l[2]), 6) : 1;
      mb.vert(madd(c, d, r * sc), d, i / ws, j / hs);
    }
  }
  for (let j = 0; j < hs; j++) for (let i = 0; i < ws; i++) {
    const a = start + j * (ws + 1) + i, b = a + ws + 1;
    mb.quad(a, a + 1, b + 1, b);
  }
}

/* ---------------------------------------------------------------- fields */
/** Push p out of a field so that f(p) ≥ minDist (along the gradient). */
export function pushOut(field, p, minDist, iters = 3) {
  const g = [0, 0, 0];
  let q = p.slice();
  for (let i = 0; i < iters; i++) {
    const d = field.eval(q[0], q[1], q[2]);
    if (d >= minDist) break;
    gradient(field, q[0], q[1], q[2], 0.0008, g);
    const l = Math.hypot(g[0], g[1], g[2]) || 1;
    q = madd(q, [g[0] / l, g[1] / l, g[2] / l], (minDist - d) * 1.02);
  }
  return q;
}
/** Project p onto the iso-surface f = offset (Newton steps along the gradient). */
export function projectTo(field, p, offset = 0, iters = 4) {
  const g = [0, 0, 0];
  let q = p.slice();
  for (let i = 0; i < iters; i++) {
    const d = field.eval(q[0], q[1], q[2]) - offset;
    if (Math.abs(d) < 1e-5) break;
    gradient(field, q[0], q[1], q[2], 0.0008, g);
    const l2 = g[0] * g[0] + g[1] * g[1] + g[2] * g[2] || 1;
    q = [q[0] - d * g[0] / l2, q[1] - d * g[1] / l2, q[2] - d * g[2] / l2];
  }
  return q;
}
export function fieldNormal(field, p) {
  const g = gradient(field, p[0], p[1], p[2], 0.0008, [0, 0, 0]);
  return norm(g);
}

/** Deterministic random numbers (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/** Smooth value noise in 3D (for messiness, fabric folds). */
export function noise3(x, y, z, seed = 0) {
  const fl = Math.floor;
  const ix = fl(x), iy = fl(y), iz = fl(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const h = (a, b, c) => { let n = (a * 374761393 + b * 668265263 + c * 2147483647 + seed * 974711) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const s = t => t * t * (3 - 2 * t);
  const ux = s(fx), uy = s(fy), uz = s(fz);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(h(ix, iy, iz), h(ix + 1, iy, iz), ux), l(h(ix, iy + 1, iz), h(ix + 1, iy + 1, iz), ux), uy),
    l(l(h(ix, iy, iz + 1), h(ix + 1, iy, iz + 1), ux), l(h(ix, iy + 1, iz + 1), h(ix + 1, iy + 1, iz + 1), ux), uy), uz) * 2 - 1;
}
