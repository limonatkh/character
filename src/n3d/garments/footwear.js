/* =====================================================================
 * FOOTWEAR
 *
 * Shoes are built around the character's own feet:
 *   upper  = the foot (and, for boots, the lower leg) offset by an ease,
 *            blended with a shoe "last" (toe box, heel counter) — meshed
 *            like a garment shell, so it gets a real opening, collar,
 *            inner surface and rims
 *   sole   = the footprint outline expanded into a welt, extruded below the
 *            foot (midsole + outsole, heel block, arch)
 *   trims  = tongue, laces and eyelets, toe caps, heel counters, side
 *            panels, elastic gussets, straps, buckles, stitching
 * Soles lift the whole character: the result reports `groundOffset`.
 * ===================================================================== */
import { Field, UNION, SUBTRACT, smin, primDist } from '../sdf/field.js';
import { BONE_NAMES, BONE_INDEX } from '../core/skeleton.js';
import { contour } from '../mesh/octree.js';
import { meshGarment, vertexNormals } from './shell.js';
import { splitAlong } from '../mesh/clip.js';
import { MeshBuilder, add, sub, mul, dot, cross, norm, len, madd, lerp3, disc, resample } from '../mesh/builder.js';
import { MeshQuery } from '../mesh/query.js';
import { skinWeights } from '../mesh/attributes.js';

const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Foot frame: heel back → toe tip, side axis, foot length and width. */
export function footFrame(rig, side) {
  const J = rig.joints, S = rig.H / 1.75, x = side === 'left' ? -1 : 1;
  const an = J[side + 'Foot'], toe = J[side + 'Toes'];
  const fs = rig.dim.footLen / 0.266;
  const heelBack = [an[0], 0, an[2] + (0.035 + 0.037) * S * fs];
  const tip = [toe[0] - x * 0.006 * S, 0, toe[2] - rig.dim.footLen * 0.24];
  const f = norm([tip[0] - heelBack[0], 0, tip[2] - heelBack[2]]);
  const s = [-f[2] * x * -1, 0, f[0] * x * -1];               // toward the outside of the foot
  const sx = Math.sign(s[0]) === x ? s : mul(s, -1);
  return { side, x, an, toe, heelBack, tip, f, s: sx, L: len(sub(tip, heelBack)), W: 0.098 * S * fs, S, fs };
}

/** 2D distance to the footprint outline (u along the foot 0..L, v across, + outside), expanded by `welt`. */
function footprint(ff, u, v, welt, shape) {
  const { L, W } = ff;
  const toeK = shape.toe ?? 0;               // −1 round … 0 almond … 1 pointed ; square uses shape.square
  const e = (cu, cv, ru, rv) => { const a = (u - cu) / ru, b = (v - cv) / rv; return (Math.sqrt(a * a + b * b) - 1) * Math.min(ru, rv); };
  const heel = e(0.17 * L, 0.0, 0.17 * L, W * 0.36);
  const ball = e(0.66 * L, W * 0.06, 0.2 * L, W * 0.5);
  const toeLen = 0.16 * L * (1 + 0.5 * Math.max(0, toeK)), toeW = W * (0.42 - 0.12 * Math.max(0, toeK) + 0.06 * (shape.square || 0));
  const toe = e(0.86 * L + 0.02 * L * toeK, -W * 0.02, toeLen, toeW);
  let d = smin(smin(heel, ball, 0.06 * L), toe, 0.05 * L);
  // arch: the inner side is slightly concave
  d += 0.012 * W * ss(0.25 * L, 0.45 * L, u) * ss(0.65 * L, 0.45 * L, u) * Math.max(0, -Math.sign(v));
  return d - welt;
}

/**
 * Build a pair of shoes.
 * spec: {
 *   collar: { back, front, sides } heights (m) of the opening above the ground (or { y } for boots)
 *   shaft: boot shaft top height (m above the ground) | 0
 *   ease, soleH, soleTop (wrap), heelH (extra heel block), welt, toe (−1..1), square (0..1), lastVolume
 *   laces: { rows, closed } | null, tongue: bool, toeCap, heelCounter, sidePanel, gusset (chelsea), strapRows (sandals), sandal: true
 *   colors / materials are handled by the asset
 * }
 */
export function buildShoes(spec, ctx) {
  const { rig, sf, D } = ctx;
  const S = rig.H / 1.75;
  const out = { parts: [], meshes: [], groundOffset: (spec.soleH ?? 0.025) * S };
  const solids = [];
  const regions = [];
  for (const side of ['left', 'right']) {
    const ff = footFrame(rig, side);
    const res = buildShoe(spec, ctx, ff);
    out.meshes.push(...res.meshes);
    out.parts.push(...res.parts);
    solids.push(res.solid);
    regions.push(res.cover);
  }
  // what layers above see: body ∪ shoes
  const U = ctx.U;
  out.stack = { eval(x, y, z) { let d = U.eval(x, y, z); for (const s of solids) { const v = s(x, y, z); if (v < d) d = v; } return d; } };
  out.region = (x, y, z) => Math.min(regions[0](x, y, z), regions[1](x, y, z));
  for (const m of out.meshes) Object.assign(m.mesh, shoeWeights(m.mesh, sf, rig.H / 1.75));
  for (const p of out.parts) Object.assign(p.geometry, shoeWeights(p.geometry, sf, rig.H / 1.75));
  out.opaque = !spec.sandal;
  return out;
}

function buildShoe(spec, ctx, ff) {
  const { rig, sf, D } = ctx;
  const S = ff.S, side = ff.side;
  const ease = (spec.ease ?? 0.004) * S;
  const soleH = (spec.soleH ?? 0.025) * S, soleTop = (spec.soleTop ?? 0.012) * S, welt = (spec.welt ?? 0.006) * S;
  const local = (x, z) => { const qx = x - ff.heelBack[0], qz = z - ff.heelBack[2]; return [qx * ff.f[0] + qz * ff.f[2], qx * ff.s[0] + qz * ff.s[2]]; };
  const world = (u, v, y) => [ff.heelBack[0] + ff.f[0] * u + ff.s[0] * v, y, ff.heelBack[2] + ff.f[2] * u + ff.s[2] * v];

  // the foot (and the lower leg for boots) from the body's own primitives
  const want = new Set([side + 'Foot', side + 'Toes', ...(spec.shaft ? [side + 'LowerLeg'] : [])]);
  const prims = sf.body.union.filter(p => want.has(BONE_NAMES[p.bone]));
  const footF = new Field([{ op: UNION, prims }], { cell: 0.03 * S, margin: 0.03 * S });
  const shape = { toe: spec.toe ?? 0, square: spec.square ?? 0 };
  const lastVol = (spec.lastVolume ?? 1);
  // shoe last: rounded toe box + heel counter, follows the footprint
  const last = (x, y, z) => {
    const [u, v] = local(x, z);
    const d2 = footprint(ff, u, v, -0.003 * S + ease, shape);
    const topY = (0.028 + 0.035 * ss(0.95 * ff.L, 0.45 * ff.L, u) + 0.02 * ss(0.3 * ff.L, 0, u)) * S * lastVol;
    const dy = y - topY;
    return Math.max(d2, dy);
  };
  const upperField = { eval(x, y, z) { return smin(footF.eval(x, y, z) - ease, last(x, y, z), 0.025 * S); } };

  // opening (collar line): height above the ground around the ankle
  const C = spec.collar || { back: 0.075, front: 0.06, sides: 0.055 };
  const an = ff.an;
  const collarY = (x, z) => {
    if (spec.shaft) return spec.shaft * S;
    const [u] = local(x, z);
    const a = Math.atan2((x - an[0]) * ff.x, -(z - an[2]));           // 0 front (instep), π back
    const back = C.back * S, sideH = C.sides * S, front = C.front * S;
    const k = Math.abs(a) / Math.PI;
    let y = k < 0.5 ? front + (sideH - front) * ss(0, 0.5, k) : sideH + (back - sideH) * ss(0.5, 1, k);
    void u;
    return y;
  };
  // laced shoes: the opening continues as a slit over the instep (closed by the tongue)
  const throatU = (spec.throat ?? 0.58) * ff.L;
  const region = (x, y, z) => {
    // (a distance-like bound box keeps the mesher's pruning valid)
    const box = Math.max(Math.abs(x - an[0]) - 0.16 * S, ff.tip[2] - 0.08 * S - z, z - ff.heelBack[2] - 0.08 * S);
    if (box > 0) return box + 0.01 * S;
    let r = y - collarY(x, z);
    r = Math.max(r, soleTop * 0.4 - y);
    if (spec.laces || spec.opening) {
      const [u, v] = local(x, z);
      const slitW = (spec.slit ?? 0.018) * S;
      const slit = Math.max(Math.abs(v) - slitW * (0.6 + 0.4 * ss(throatU, ff.L * 0.25, u)), throatU - u, y - 0.2 * S, (0.045 * S) - y);
      r = Math.max(r, -slit);
    }
    if (spec.sandal) r = 1;
    return r;
  };
  const meshes = [], parts = [];
  // ---------------------------------------------------------------- upper
  let upperMesh = null;
  if (!spec.sandal) {
    const G = {
      field: upperField, region, regionParts: [{ name: 'collar', fn: (x, y, z) => y - collarY(x, z) }, { name: 'sole', fn: (x, y) => soleTop * 0.4 - y }, { name: 'slit', fn: region }],
      thickness: (spec.thickness ?? 0.0025) * S, cell: Math.min(D.garment * 0.55, 0.0055 * S),
      bounds: { min: [an[0] - 0.12 * S, -0.01, ff.tip[2] - 0.05 * S], max: [an[0] + 0.12 * S, (spec.shaft || 0.12) * S + 0.03 * S, ff.heelBack[2] + 0.05 * S] },
      bands: spec.collarPad ? { collar: { w: 0.018 * S, kind: 'band' } } : {},
      panel: () => 0, uv: (pn, x, y, z) => { const [u, v] = local(x, z); return [u + Math.abs(v) * 0.5, y + Math.abs(v)]; },
      displace: spec.collarPad ? (p, n, info) => (info.band ? 0.0035 * S * Math.sin(Math.PI * Math.min(1, info.bandU * 1.1)) : 0) : null,
      bandWidth: 0.05 * S, roundRim: 3, minIsland: 30,
    };
    upperMesh = meshGarment(G, { bodyField: sf.field, S });
    meshes.push({ part: 'upper', side, mesh: upperMesh });
  }
  // ---------------------------------------------------------------- sole
  const heelH = (spec.heelH ?? 0) * S;
  const soleSolid = (x, y, z) => {
    const [u, v] = local(x, z);
    const d2 = footprint(ff, u, v, welt, shape);
    const bottom = -soleH;
    // arch gap between heel block and forefoot (dress shoes, boots)
    const arch = (spec.archGap ?? 0) * S * ss(0.24 * ff.L, 0.32 * ff.L, u) * ss(0.62 * ff.L, 0.52 * ff.L, u);
    const topY = soleTop + heelH * ss(0.4 * ff.L, 0.25 * ff.L, u);
    const dy = Math.max(bottom + arch - y, y - topY);
    const r = 0.003 * S;
    const ox = Math.max(d2, 0), oy = Math.max(dy, 0);
    return Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(d2, dy), 0) - r * 0;
  };
  const soleMeshRaw = contour({ eval: soleSolid }, {
    min: [an[0] - 0.15 * S, -soleH - 0.04 * S, ff.tip[2] - 0.06 * S], size: 0.46 * S, maxDepth: Math.ceil(Math.log2(0.46 * S / (0.0045 * S))), margin: 1.6, project: 3,
  });
  // groups: outsole (bottom), midsole (rest) — split exactly along the line between them
  {
    const split0 = -soleH + (spec.outsole ?? 0.35) * soleH;
    const sv = new Float32Array(soleMeshRaw.positions.length / 3);
    for (let i = 0; i < sv.length; i++) sv[i] = soleMeshRaw.positions[i * 3 + 1] - split0;
    const sp = splitAlong(soleMeshRaw.positions, soleMeshRaw.indices, sv, []);
    const P = sp.P, I = sp.I;
    soleMeshRaw.normals = vertexNormals(P, I);
    const outI = [], midI = [];
    const split = -soleH + (spec.outsole ?? 0.35) * soleH;
    for (let t = 0; t < I.length; t += 3) { const yc = (P[I[t] * 3 + 1] + P[I[t + 1] * 3 + 1] + P[I[t + 2] * 3 + 1]) / 3; (yc < split ? outI : midI).push(I[t], I[t + 1], I[t + 2]); }
    const index = Uint32Array.from([...midI, ...outI]);
    const uv = new Float32Array(P.length / 3 * 2);
    for (let i = 0; i < P.length / 3; i++) { const [u, v] = local(P[i * 3], P[i * 3 + 2]); uv[i * 2] = u + P[i * 3 + 1]; uv[i * 2 + 1] = v; }
    meshes.push({ part: 'sole', side, mesh: { position: P, normal: soleMeshRaw.normals, uv, index, groups: [{ name: 'midsole', start: 0, count: midI.length }, { name: 'outsole', start: midI.length, count: outI.length }] } });
  }
  // ---------------------------------------------------------------- trims
  const q = upperMesh ? new MeshQuery(upperMesh.surface.P, upperMesh.surface.I, 0.012 * S) : null;
  const place = (u, v, y, lift = 0) => {
    if (!q) return world(u, v, y);
    const p = world(u, v, y);
    const h = q.nearest(p, 0.04 * S);
    return h ? madd(h.p, h.n, lift) : p;
  };
  const nrmAt = p => { const h = q && q.nearest(p, 0.04 * S); return h ? h.n : [0, 1, 0]; };
  // tongue + laces
  if (spec.laces && q) {
    const rows = spec.laces.rows ?? 6;
    const slitW = (spec.slit ?? 0.018) * S;
    const tongue = new MeshBuilder();
    const tPts = [];
    for (let k = 0; k <= 10; k++) { const u = throatU - 0.015 * S + (k / 10) * (ff.L * 0.62 - throatU); tPts.push(u); }
    // tongue: a padded strip from the throat up past the collar
    const tongueTop = collarY(an[0], an[2] - 0.03 * S) + 0.02 * S;
    const path = [];
    for (let k = 0; k <= 12; k++) {
      const a = k / 12;
      const u = throatU - 0.01 * S - a * (throatU - 0.42 * ff.L);
      const y0 = 0.05 * S + a * (tongueTop - 0.05 * S);
      const base = world(u, 0, y0);
      // push the tongue onto the foot surface
      let p = base;
      for (let it = 0; it < 12; it++) { const d = footF.eval(...p) - ease * 0.8; if (Math.abs(d) < 0.0005) break; const g = [footF.eval(p[0] + 1e-3, p[1], p[2]) - footF.eval(...p), footF.eval(p[0], p[1] + 1e-3, p[2]) - footF.eval(...p), footF.eval(p[0], p[1], p[2] + 1e-3) - footF.eval(...p)].map(v => v / 1e-3); const gl = dot(g, g) || 1; p = sub(p, mul(g, d / gl)); }
      path.push(p);
    }
    const tw = slitW * 1.6, tt = 0.004 * S;
    sweepFlat(tongue, path, i => nrmAt(path[i]), tw, tt);
    parts.push({ name: 'tongue', material: 'main', geometry: finish(tongue) });
    // eyelets and criss-cross laces
    const eye = new MeshBuilder(), lace = new MeshBuilder();
    const rowsPts = [];
    for (let r = 0; r < rows; r++) {
      const a = r / Math.max(1, rows - 1);
      const u = throatU - 0.01 * S - a * (throatU - 0.47 * ff.L);
      const yy = 0.06 * S + a * (collarY(an[0], an[2] - 0.03 * S) - 0.075 * S);
      const pair = [-1, 1].map(sg => {
        const p0 = world(u, sg * (slitW + 0.008 * S), yy);
        const h = q.nearest(p0, 0.05 * S);
        return h ? { p: madd(h.p, h.n, 0.0008 * S), n: h.n } : null;
      });
      if (pair[0] && pair[1]) rowsPts.push(pair);
    }
    for (const pr of rowsPts) for (const e of pr) disc(eye, e.p, e.n, 0.0035 * S, 0.0012 * S, { sides: 10 });
    const lr = (spec.laces.radius ?? 0.0017) * S;
    for (let r = 0; r < rowsPts.length; r++) {
      const [L0, R0] = rowsPts[r];
      // straight bar at the first row, then criss-cross
      const segs = r === 0 ? [[L0, R0]] : [[rowsPts[r - 1][0], R0], [rowsPts[r - 1][1], L0]];
      for (const [a, b] of segs) {
        const mid = madd(lerp3(a.p, b.p, 0.5), norm(add(a.n, b.n)), 0.004 * S);
        tubeLine(lace, resample([a.p, mid, b.p], 8), lr);
      }
    }
    // bow at the top
    if (rowsPts.length && spec.laces.bow !== false) {
      const [L0, R0] = rowsPts[rowsPts.length - 1];
      const c = madd(lerp3(L0.p, R0.p, 0.5), norm(add(L0.n, R0.n)), 0.006 * S);
      const n = norm(add(L0.n, R0.n)), sideV = norm(sub(R0.p, L0.p)), fw = norm(cross(sideV, n));
      for (const sg of [-1, 1]) {
        const loop = [];
        for (let k = 0; k <= 12; k++) { const a = k / 12 * Math.PI * 2; loop.push(add(c, add(mul(sideV, sg * (0.012 * S) * (1 - Math.cos(a)) * 0.9), add(mul(fw, 0.008 * S * Math.sin(a)), mul(n, 0.002 * S * Math.sin(a)))))); }
        tubeLine(lace, loop, lr);
        tubeLine(lace, resample([c, add(c, add(mul(sideV, sg * 0.006 * S), mul(fw, -0.035 * S))), add(c, add(mul(sideV, sg * 0.01 * S), add(mul(fw, -0.06 * S), [0, -0.02 * S, 0])))], 10), lr);
      }
    }
    parts.push({ name: 'eyelets', material: 'hardware', geometry: finish(eye) });
    parts.push({ name: 'laces', material: 'laces', geometry: finish(lace) });
  }
  // overlays: toe cap, heel counter, side panel, chelsea gusset, apron / penny strap
  const overlay = (name, mat, uRange, vRange, yRange, lift = 0.0012) => {
    if (!q) return;
    const mb = new MeshBuilder();
    const nu = 12, nv = 10;
    const g0 = mb.count;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const a = i / nu, b = j / nv;
      const u = uRange[0] + (uRange[1] - uRange[0]) * a;
      const vv = vRange ? vRange[0] + (vRange[1] - vRange[0]) * b : 0;
      const yy = yRange[0] + (yRange[1] - yRange[0]) * b;
      // project from outside toward the foot axis
      const p0 = world(u, vRange ? vv : (b - 0.5) * 0.3 * S, yy);
      const h = q.nearest(p0, 0.08 * S);
      mb.vert(h ? madd(h.p, h.n, lift * S) : p0, h ? h.n : [0, 1, 0], a, b);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = g0 + j * (nu + 1) + i; mb.quad(a, a + 1, a + nu + 2, a + nu + 1); }
    parts.push({ name, material: mat, geometry: finish(mb, q) });
  };
  if (spec.toeCap) overlay('toeCap', spec.toeCap === true ? 'trim' : spec.toeCap, [0.8 * ff.L, ff.L + 0.01 * S], [-0.07 * S, 0.07 * S], [soleTop, 0.05 * S]);
  if (spec.heelCounter) overlay('heelCounter', 'trim', [-0.01 * S, 0.16 * ff.L], [-0.06 * S, 0.06 * S], [soleTop, collarY(an[0], an[2] + 0.1 * S) - 0.012 * S]);
  if (spec.sidePanel) for (const sg of [-1, 1]) overlay('sidePanel', 'accent', [0.3 * ff.L, 0.62 * ff.L], [sg * 0.08 * S, sg * 0.08 * S], [soleTop + 0.006 * S, 0.05 * S]);
  if (spec.gusset) for (const sg of [-1, 1]) overlay('gusset', 'elastic', [0.12 * ff.L, 0.22 * ff.L], [sg * 0.09 * S, sg * 0.09 * S], [0.07 * S, (spec.shaft || 0.14) * S]);
  // sandal straps
  if (spec.sandal) {
    const mb = new MeshBuilder();
    for (const st of spec.straps || []) {
      const pts = [];
      for (let k = 0; k <= 16; k++) {
        const a = k / 16;
        const ang = Math.PI * a;                                       // over the foot from the inside to the outside
        const u = st.u0 * ff.L + (st.u1 - st.u0) * ff.L * a;
        const center = world(u, 0, 0.0);
        let dir = norm(add(mul(ff.s, -Math.cos(ang)), [0, Math.sin(ang) * 1.2, 0]));
        // walk outward until outside the foot
        let r = 0.002;
        let p = add(center, mul(dir, r));
        for (let it = 0; it < 60; it++) { const d = footF.eval(...p); if (d > 0.002 * S) break; r += Math.max(0.002 * S, -d); p = add(center, add(mul(dir, r), [0, soleTop, 0])); }
        pts.push(p);
      }
      sweepFlat(mb, pts, i => norm(sub(pts[i], world(st.u0 * ff.L, 0, 0))), (st.w ?? 0.018) * S, 0.0035 * S);
    }
    parts.push({ name: 'straps', material: 'main', geometry: finish(mb) });
  }
  if (spec.pennyStrap && q) overlay('pennyStrap', 'trim', [0.5 * ff.L, 0.56 * ff.L], [-0.05 * S, 0.05 * S], [0.05 * S, 0.055 * S], 0.002);
  // skin weights: foot / toes / lower leg from the body
  const solid = (x, y, z) => {
    const s1 = soleSolid(x, y, z);
    if (spec.sandal) return s1;
    const up = Math.max(upperField.eval(x, y, z), region(x, y, z) + 0.0 * S);
    return Math.min(s1, Math.max(up, -0.02 * S - (y - collarY(x, z))));
  };
  const cover = (x, y, z) => (spec.sandal ? Math.max(y - soleTop, footF.eval(x, y, z) - 0.002 * S) : Math.max(region(x, y, z), footF.eval(x, y, z) - 0.03 * S));
  return { meshes, parts, solid, cover };
}

/* ------------------------------------------------------------------ helpers */
function sweepFlat(mb, path, nrm, w, t) {
  const n = path.length, start = mb.count;
  for (let i = 0; i < n; i++) {
    const tg = norm(sub(path[Math.min(n - 1, i + 1)], path[Math.max(0, i - 1)]));
    const nn = norm(nrm(i)), sd = norm(cross(tg, nn));
    const prof = [[0, -w / 2], [t, -w / 2 + t * 0.4], [t, w / 2 - t * 0.4], [0, w / 2]];
    for (const [a, b] of prof) mb.vert(add(path[i], add(mul(nn, a), mul(sd, b))), nn, b / w + 0.5, i / (n - 1));
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < 4; k++) { const a = start + i * 4 + k, b = start + i * 4 + (k + 1) % 4; mb.quad(a, b, b + 4, a + 4); }
  const capA = start, capB = start + (n - 1) * 4;
  mb.quad(capA, capA + 3, capA + 2, capA + 1); mb.quad(capB, capB + 1, capB + 2, capB + 3);
}
function tubeLine(mb, path, r) {
  const n = path.length, sides = 6, start = mb.count;
  for (let i = 0; i < n; i++) {
    const t = norm(sub(path[Math.min(n - 1, i + 1)], path[Math.max(0, i - 1)]));
    const u = norm(cross(t, Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), v = cross(t, u);
    for (let k = 0; k < sides; k++) { const a = k / sides * Math.PI * 2; const d = add(mul(u, Math.cos(a)), mul(v, Math.sin(a))); mb.vert(madd(path[i], d, r), d, k / sides, i / (n - 1)); }
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < sides; k++) { const a = start + i * sides + k, b = start + i * sides + (k + 1) % sides; mb.quad(a, b, b + sides, a + sides); }
}
function finish(mb) {
  const g = mb.build();
  // closed-volume orientation + smooth normals
  const P = g.position, I = g.index;
  let v = 0;
  for (let t = 0; t < I.length; t += 3) { const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3; v += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]); }
  if (v < 0) for (let t = 0; t < I.length; t += 3) { const tmp = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = tmp; }
  g.normal = vertexNormals(P, I);
  return g;
}

/** Skin weights for shoe geometry: from the body (feet / toes / lower legs). */
export function shoeWeights(geo, sf, S) {
  const w = skinWeights(geo.position, sf.field, { sigmaMin: 0.01 * S });
  // keep only leg / foot bones
  return { skinIndex: w.skinIndex, skinWeight: w.skinWeight };
}
export { BONE_INDEX };
