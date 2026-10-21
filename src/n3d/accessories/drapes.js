/* =====================================================================
 * DRAPED ACCESSORIES: scarves, shawls, keffiyeh / ghutra (with agal).
 *
 * A small position-based-dynamics cloth solver: a grid of particles with
 * stretch, shear and bending constraints, gravity, and collisions with
 * everything the character wears (the stacked outfit field + hair). Each
 * item starts from a hand-placed configuration (wrapped around the neck,
 * over the shoulders, folded over the head) and is settled by the solver,
 * so it drapes over the actual body and clothes. Pinned rows (the knot of
 * a scarf, the agal ring of a keffiyeh) hold it in place.
 * ===================================================================== */
import { MeshBuilder, add, sub, mul, dot, cross, norm, len, madd, lerp3, rng } from '../mesh/builder.js';
import { gradient } from '../sdf/field.js';
import { vertexNormals } from '../garments/shell.js';
import { headAz, bandY, hairThickness, ss } from './common.js';
import { tube, finish } from './items.js';

/** PBD cloth. P: Float64Array positions (nu*nv*3); pinned: Uint8Array. */
function simulate(cloth, collide, opts) {
  const { nu, nv } = cloth;
  const n = nu * nv, P = cloth.P, prev = new Float64Array(P), pinned = cloth.pinned;
  const g = opts.gravity ?? -9.8, dt = 1 / 60, iters = opts.iters ?? 100, sub2 = opts.substeps ?? 3;
  const gap = opts.gap;
  const cons = [];
  const idx = (i, j) => j * nu + i;
  const rest = (a, b) => Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]);
  const addC = (a, b, k) => cons.push([a, b, opts.restScale ? rest(a, b) * opts.restScale : rest(a, b), k]);
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    if (i + 1 < nu) addC(idx(i, j), idx(i + 1, j), 1);
    if (j + 1 < nv) addC(idx(i, j), idx(i, j + 1), 1);
    if (i + 1 < nu && j + 1 < nv) { addC(idx(i, j), idx(i + 1, j + 1), 0.5); addC(idx(i + 1, j), idx(i, j + 1), 0.5); }
    if (i + 2 < nu) addC(idx(i, j), idx(i + 2, j), opts.bend ?? 0.15);
    if (j + 2 < nv) addC(idx(i, j), idx(i, j + 2), opts.bend ?? 0.15);
  }
  const gr = [0, 0, 0];
  for (let it = 0; it < iters; it++) {
    // verlet integration with damping
    for (let k = 0; k < n; k++) {
      if (pinned[k]) continue;
      for (let c = 0; c < 3; c++) {
        const x = P[k * 3 + c], v = (x - prev[k * 3 + c]) * 0.96;
        prev[k * 3 + c] = x;
        P[k * 3 + c] = x + v + (c === 1 ? g * dt * dt : 0);
      }
    }
    for (let s = 0; s < sub2; s++) {
      for (const [a, b, r, k] of cons) {
        const dx = P[b * 3] - P[a * 3], dy = P[b * 3 + 1] - P[a * 3 + 1], dz = P[b * 3 + 2] - P[a * 3 + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
        const wa = pinned[a] ? 0 : 1, wb = pinned[b] ? 0 : 1, w = wa + wb;
        if (!w) continue;
        // cloth barely stretches but compresses freely (bunching)
        const diff = d > r ? (d - r) / d : (d - r) / d * 0.25;
        const corr = diff * k / w;
        P[a * 3] += dx * corr * wa; P[a * 3 + 1] += dy * corr * wa; P[a * 3 + 2] += dz * corr * wa;
        P[b * 3] -= dx * corr * wb; P[b * 3 + 1] -= dy * corr * wb; P[b * 3 + 2] -= dz * corr * wb;
      }
      // collisions (push out of the body + clothes, with friction)
      for (let k = 0; k < n; k++) {
        if (pinned[k]) continue;
        const x = P[k * 3], y = P[k * 3 + 1], z = P[k * 3 + 2];
        const d = collide.eval(x, y, z);
        if (d < gap) {
          gradient(collide, x, y, z, 0.002, gr);
          const gl = Math.hypot(gr[0], gr[1], gr[2]) || 1;
          const push = (gap - d);
          P[k * 3] += gr[0] / gl * push; P[k * 3 + 1] += gr[1] / gl * push; P[k * 3 + 2] += gr[2] / gl * push;
          // friction: kill tangential motion
          prev[k * 3] += (P[k * 3] - prev[k * 3]) * 0.6; prev[k * 3 + 1] += (P[k * 3 + 1] - prev[k * 3 + 1]) * 0.6; prev[k * 3 + 2] += (P[k * 3 + 2] - prev[k * 3 + 2]) * 0.6;
        }
        if (P[k * 3 + 1] < 0.01) P[k * 3 + 1] = 0.01;
      }
    }
  }
  return cloth;
}

/** Thin cloth solid from the particle grid (two faces + edges), smoothed by subdivision. */
function clothMesh(cloth, th, subdiv = 2, tex = 0.5) {
  const { nu, nv } = cloth;
  // Catmull-Rom upsampling of the grid
  const NU = (nu - 1) * subdiv + 1, NV = (nv - 1) * subdiv + 1;
  const at = (i, j) => { i = Math.max(0, Math.min(nu - 1, i)); j = Math.max(0, Math.min(nv - 1, j)); const k = (j * nu + i) * 3; return [cloth.P[k], cloth.P[k + 1], cloth.P[k + 2]]; };
  const cr = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return [0, 1, 2].map(c => 0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)); };
  const G = [];
  for (let J = 0; J < NV; J++) for (let I = 0; I < NU; I++) {
    const fi = I / subdiv, fj = J / subdiv, i = Math.min(nu - 2, Math.floor(fi)), j = Math.min(nv - 2, Math.floor(fj)), ti = fi - i, tj = fj - j;
    const rows = [-1, 0, 1, 2].map(dj => cr(at(i - 1, j + dj), at(i, j + dj), at(i + 1, j + dj), at(i + 2, j + dj), ti));
    G.push(cr(rows[0], rows[1], rows[2], rows[3], tj));
  }
  const mb = new MeshBuilder();
  const idx = (I, J) => J * NU + I;
  // normals of the mid surface
  const Nn = G.map((p, k) => { const I = k % NU, J = (k / NU) | 0; const du = sub(G[idx(Math.min(NU - 1, I + 1), J)], G[idx(Math.max(0, I - 1), J)]), dv = sub(G[idx(I, Math.min(NV - 1, J + 1))], G[idx(I, Math.max(0, J - 1))]); return norm(cross(du, dv)); });
  // UVs in metres along the cloth (patterns keep their real size)
  const top = G.map((p, k) => mb.vert(madd(p, Nn[k], th / 2), Nn[k], (k % NU) / (NU - 1) * cloth.Lu, ((k / NU) | 0) / (NV - 1) * cloth.Lv));
  const bot = G.map((p, k) => mb.vert(madd(p, Nn[k], -th / 2), mul(Nn[k], -1), (k % NU) / (NU - 1) * cloth.Lu, ((k / NU) | 0) / (NV - 1) * cloth.Lv));
  for (let J = 0; J < NV - 1; J++) for (let I = 0; I < NU - 1; I++) {
    const a = idx(I, J), b = idx(I + 1, J), c = idx(I + 1, J + 1), d = idx(I, J + 1);
    mb.quad(top[a], top[b], top[c], top[d]); mb.quad(bot[a], bot[d], bot[c], bot[b]);
  }
  const edge = (list) => { for (let k = 0; k < list.length - 1; k++) { const a = list[k], b = list[k + 1]; mb.quad(top[a], bot[a], bot[b], top[b]); } };
  edge(Array.from({ length: NU }, (_, I) => idx(I, 0)).reverse()); edge(Array.from({ length: NU }, (_, I) => idx(I, NV - 1)));
  edge(Array.from({ length: NV }, (_, J) => idx(0, J))); edge(Array.from({ length: NV }, (_, J) => idx(NU - 1, J)).reverse());
  const g = mb.build();
  g.normal = vertexNormals(g.position, g.index);
  // make faces point outward of the cloth's own normal side consistently
  return g;
}

function grid(nu, nv, fn) {
  const P = new Float64Array(nu * nv * 3), pinned = new Uint8Array(nu * nv);
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const p = fn(i / (nu - 1), j / (nv - 1), i, j); P[(j * nu + i) * 3] = p[0]; P[(j * nu + i) * 3 + 1] = p[1]; P[(j * nu + i) * 3 + 2] = p[2]; if (p[3]) pinned[j * nu + i] = 1; }
  return { nu, nv, P, pinned };
}

/**
 * Scarf wrapped once around the neck, ends hanging in front (or one thrown back).
 * spec: { length (m), width (m), wrap: 'front' | 'oneBack' | 'loop', thickness }
 */
export function buildScarf(spec, ctx) {
  const { F, U } = ctx, S = F.S;
  const L = (spec.length ?? 1.6) * S, W = (spec.width ?? 0.24) * S;
  const nb = F.neckBase, sec = F.neckSection || (() => F.neckR);
  const nu = 72, nv = 7;
  const wrapLen = 2 * Math.PI * (F.neckR + 0.04 * S) * 1.0;
  const y0 = nb[1] + 0.025 * S;
  const cloth = grid(nu, nv, (u, v) => {
    const s = (u - 0.5) * L;                                       // arc length from the middle
    const vw = (v - 0.5) * W * 0.4;                                 // width is bunched around the neck
    if (Math.abs(s) < wrapLen / 2) {
      const a = Math.PI + s / (wrapLen / (2 * Math.PI));            // middle of the scarf at the back of the neck
      const r = sec(a) + 0.03 * S + Math.abs(vw) * 0.3;
      return [Math.sin(a) * r, y0 + vw, nb[2] - Math.cos(a) * r];
    }
    // hanging ends from the front of the neck
    const side = Math.sign(s), rest = Math.abs(s) - wrapLen / 2;
    const ax = side * (0.035 * S + (v - 0.5) * W * 0.9) * 0.9;
    let p = [ax, y0 - rest, nb[2] - sec(0) - 0.05 * S - rest * 0.15];
    if (spec.wrap === 'oneBack' && side > 0) p = [0.08 * S + (v - 0.5) * W * 0.6, y0 - rest, nb[2] + sec(Math.PI) + 0.06 * S + rest * 0.12];
    return p;
  });
  // the loop around the neck holds the scarf: pin the back of the wrap gently (upper rows)
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const s = (i / (nu - 1) - 0.5) * L; if (Math.abs(s) < wrapLen * 0.3 && j > 1 && j < nv - 2) cloth.pinned[j * nu + i] = 1; }
  cloth.Lu = L; cloth.Lv = W;
  simulate(cloth, U, { gap: (spec.thickness ?? 0.004) * S * 1.4 + 0.002 * S, iters: 90, bend: 0.25 });
  const g = clothMesh(cloth, (spec.thickness ?? 0.004) * S, 2);
  return { meshes: [{ name: 'scarf', geometry: g, material: 'main', follow: true }] };
}

/** Shawl over the shoulders, ends falling in front. */
export function buildShawl(spec, ctx) {
  const { F, U } = ctx, S = F.S;
  const L = (spec.length ?? 1.5) * S, W = (spec.width ?? 0.6) * S;
  const nb = F.neckBase;
  const nu = 40, nv = 16;
  const cloth = grid(nu, nv, (u, v) => {
    const s = (u - 0.5) * L;
    const a = Math.PI + Math.max(-1, Math.min(1, s / (0.35 * S))) * Math.PI * 0.62;     // wraps from front-left over the back to front-right
    const r = 0.17 * S + 0.04 * S;
    const ext = Math.max(0, Math.abs(s) - 0.35 * S);
    const top = [Math.sin(a) * r, F.shoulderY + 0.06 * S - ext * 0.9, nb[2] - Math.cos(a) * r - (Math.abs(s) > 0.35 * S ? 0.1 * S : 0)];
    // width hangs down the back / front
    return [top[0], top[1] - v * W * 0.85, top[2] + (Math.cos(a) > 0 ? -1 : 1) * v * W * 0.1 + (Math.abs(s) < 0.35 * S ? v * W * 0.25 * -Math.cos(a) : 0)];
  });
  cloth.Lu = L; cloth.Lv = W;
  simulate(cloth, U, { gap: 0.006 * S, iters: 100, bend: 0.12 });
  const g = clothMesh(cloth, (spec.thickness ?? 0.003) * S, 2);
  return { meshes: [{ name: 'shawl', geometry: g, material: 'main', follow: true }] };
}

/** Keffiyeh / ghutra / shemagh draped over the head, optionally held by an agal. */
export function buildKeffiyeh(spec, ctx) {
  const { F, U, sf } = ctx, S = F.S;
  const m = sf.head.marks, c = m.cranium.c, R = m.cranium.r;
  const hairT = Math.min(0.03 * S, hairThickness(ctx.hairParts, sf.farField, m.browY, S));
  const lv = { front: 0.04, side: 0.012, back: 0.02 };
  const band = az => bandY(m, az, lv);
  // collision: body + clothes + a head volume inflated by the hair
  const headVol = { eval: (x, y, z) => Math.min(U.eval(x, y, z), sf.farField.eval(x, y, z) - hairT - 0.002 * S) };
  const nu = 34, nv = 30;
  const Wd = (spec.size ?? 1) * 1.0 * S, Ld = (spec.size ?? 1) * 0.95 * S;
  const cloth = grid(nu, nv, (u, v) => {
    // u: across (left → right side of the head), v: from the forehead edge back over the crown and down
    const az = (u - 0.5) * Math.PI * 1.25;                          // ±112° around the head front
    const front = v === 0;
    // on the head: spherical cap from the forehead to the back
    const el = v * Math.PI * 0.95;                                   // 0 at the forehead edge … over the top … down the back
    const rr = [R[0] + hairT + 0.008 * S, R[1] + hairT + 0.008 * S, R[2] + hairT + 0.01 * S];
    const dir = [Math.sin(az) * Math.cos(el * 0.0), 0, 0];
    void dir; void front;
    // parametric: start on the forehead band, go up over the crown, then down the back
    const y0 = band(az) + 0.002 * S;
    const p0 = [c[0] + Math.sin(az) * rr[0] * 1.02, y0, c[2] - Math.cos(az) * rr[2] * 1.02];
    const crownTop = [c[0] + Math.sin(az) * rr[0] * 0.4, c[1] + rr[1], c[2] + 0.02 * S];
    const back = [c[0] + Math.sin(az) * (rr[0] + 0.03 * S) * 1.05, c[1] - 0.05 * S - (v - 0.5) * Ld * 0.9, c[2] + rr[2] + 0.05 * S];
    if (v < 0.3) return lerp3(p0, crownTop, v / 0.3).map((x, k) => x + (k === 1 ? Math.sin(v / 0.3 * Math.PI) * 0.03 * S : 0));
    return lerp3(crownTop, back, Math.min(1, (v - 0.3) / 0.3));
  });
  // side flaps hang down beside the face: extend the outer columns downward initially
  for (let j = 0; j < nv; j++) for (const i of [0, 1, 2, nu - 3, nu - 2, nu - 1]) {
    const k = (j * nu + i) * 3; const t = Math.min(1, j / 6);
    cloth.P[k + 1] -= t * 0.08 * S;
  }
  // agal ring pins the cloth to the head along the band line
  const agalY = az => band(az) + 0.035 * S;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const k = (j * nu + i) * 3, x = cloth.P[k], y = cloth.P[k + 1], z = cloth.P[k + 2];
    const az = headAz(m, x, z);
    if (Math.abs(y - agalY(az)) < 0.014 * S && Math.hypot(x - c[0], z - c[2]) < (R[0] + R[2]) / 2 + hairT + 0.05 * S) cloth.pinned[j * nu + i] = spec.agal !== false ? 1 : 0;
    if (j === 0) cloth.pinned[j * nu + i] = 1;                       // the folded front edge sits on the forehead
  }
  cloth.Lu = Wd; cloth.Lv = Ld;
  simulate(cloth, headVol, { gap: 0.004 * S, iters: 90, substeps: 2, bend: 0.1, restScale: 1.0 });
  const g = clothMesh(cloth, 0.0022 * S, 2, 1);
  const meshes = [{ name: 'keffiyeh', geometry: g, material: 'main', follow: false }];
  if (spec.agal !== false) {
    const mb = new MeshBuilder();
    for (const dy of [0, 0.014 * S]) {
      const ring = [];
      for (let k = 0; k < 64; k++) {
        const az = k / 64 * Math.PI * 2 - Math.PI;
        const y = agalY(az) + dy;
        // sit on top of the cloth
        let r = 0.2 * S, p;
        for (let it = 0; it < 80; it++) { p = [c[0] + Math.sin(az) * r, y, c[2] - Math.cos(az) * r]; if (headVol.eval(...p) < 0.004 * S + 0.006 * S) break; r -= 0.002 * S; }
        ring.push(p);
      }
      tube(mb, ring, 0.0055 * S, { closed: true, sides: 10 });
    }
    meshes.push({ name: 'agal', geometry: finish(mb), material: 'accent', follow: false });
  }
  const hides = (x, y, z) => y > band(headAz(m, x, z)) - 0.004 * S && Math.hypot(x - c[0], z - c[2]) < Math.max(R[0], R[2]) + hairT + 0.03 * S;
  return { meshes, hides, bone: 'head' };
}
void rng; void ss; void dot; void len; void add;
