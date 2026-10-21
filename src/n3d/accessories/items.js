/* =====================================================================
 * WORN ITEMS: glasses, earrings, necklaces, rings, bracelets, watches,
 * gloves, belts, bags (backpack, crossbody, waist bag), ties, bow ties.
 * Everything is placed from the body frame and rests on what the
 * character already wears (the stacked outfit field), so a necklace lies
 * on the sweater and a belt sits on the trousers.
 * ===================================================================== */
import { MeshBuilder, add, sub, mul, dot, cross, norm, len, madd, lerp3, disc, resample, pushOut, projectTo, fieldNormal, noise3 } from '../mesh/builder.js';
import { meshGarment, vertexNormals } from '../garments/shell.js';
import { contour } from '../mesh/octree.js';
import { Field, UNION, primDist } from '../sdf/field.js';
import { BONE_NAMES } from '../core/skeleton.js';
import { ss } from './common.js';

/* ------------------------------------------------------------------ geometry helpers */
function finish(mb, closed = true) {
  const g = mb.build();
  if (closed) {
    const P = g.position, I = g.index;
    let v = 0;
    for (let t = 0; t < I.length; t += 3) { const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3; v += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]); }
    if (v < 0) for (let t = 0; t < I.length; t += 3) { const tmp = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = tmp; }
  }
  g.normal = vertexNormals(g.position, g.index);
  return g;
}
/** Tube along a path: round (radius r, opts.sides) or flat (opts.rect = [half width across, half height along opts.up]).
 * Flat profiles get one pair of vertices per side, so their faces shade with real (flat) normals. */
function tube(mb, path, r, opts = {}) {
  const n = path.length, sides = opts.sides || 8, start = mb.count, closed = !!opts.closed;
  const up0 = opts.up || [0, 1, 0];
  const rect = opts.rect;
  for (let i = 0; i < n; i++) {
    const t = norm(sub(path[closed ? (i + 1) % n : Math.min(n - 1, i + 1)], path[closed ? (i + n - 1) % n : Math.max(0, i - 1)]));
    let u = norm(sub(up0, mul(t, dot(up0, t)))); if (!isFinite(u[0]) || len(u) < 0.5) u = norm(cross(t, [1, 0, 0]));
    const v = cross(t, u);
    if (rect) {
      // corners (v, u): (-a,-b) (a,-b) (a,b) (-a,b); sides face −u, +v, +u, −v
      const P = [[-rect[0], -rect[1]], [rect[0], -rect[1]], [rect[0], rect[1]], [-rect[0], rect[1]]].map(([a, b]) => add(path[i], add(mul(v, a), mul(u, b))));
      const N = [mul(u, -1), v, u, mul(v, -1)];
      for (let k = 0; k < 4; k++) { mb.vert(P[k], N[k], 0, i / n); mb.vert(P[(k + 1) % 4], N[k], 1, i / n); }
    } else for (let k = 0; k < sides; k++) { const a = k / sides * Math.PI * 2; const d = add(mul(u, Math.cos(a)), mul(v, Math.sin(a))); mb.vert(madd(path[i], d, r), d, k / sides, i / n); }
  }
  const m = rect ? 8 : sides;
  for (let i = 0; i < n - 1 + (closed ? 1 : 0); i++) {
    const r0 = start + i * m, r1 = start + ((i + 1) % n) * m;
    if (rect) for (let k = 0; k < 4; k++) mb.quad(r0 + 2 * k, r0 + 2 * k + 1, r1 + 2 * k + 1, r1 + 2 * k);
    else for (let k = 0; k < m; k++) mb.quad(r0 + k, r0 + (k + 1) % m, r1 + (k + 1) % m, r1 + k);
  }
  if (!closed && opts.caps !== false) for (const [ring, flip] of [[0, true], [n - 1, false]]) {
    const ci = mb.vert(path[ring], [0, 1, 0], 0, 0);
    if (rect) for (let k = 0; k < 4; k++) { const a = start + ring * m + 2 * k, b = a + 1; if (flip) mb.tri(b, a, ci); else mb.tri(a, b, ci); }
    else for (let k = 0; k < m; k++) { const a = start + ring * m + k, b = start + ring * m + (k + 1) % m; if (flip) mb.tri(b, a, ci); else mb.tri(a, b, ci); }
  }
}
function torus(mb, c, axis, R, r, seg = 32, sides = 10) {
  const a = norm(axis), u = norm(cross(a, Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), v = cross(a, u);
  const path = [];
  for (let i = 0; i < seg; i++) { const t = i / seg * Math.PI * 2; path.push(add(c, add(mul(u, Math.cos(t) * R), mul(v, Math.sin(t) * R)))); }
  tube(mb, path, r, { closed: true, sides, up: a });
}
function sphere(mb, c, r, nU = 14, nV = 10, bump = 0) {
  const s = mb.count;
  for (let j = 0; j <= nV; j++) for (let i = 0; i <= nU; i++) {
    const th = j / nV * Math.PI, ph = i / nU * Math.PI * 2, d = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
    mb.vert(madd(c, d, r * (1 + bump * noise3(d[0] * 5, d[1] * 5, d[2] * 5))), d, i / nU, j / nV);
  }
  for (let j = 0; j < nV; j++) for (let i = 0; i < nU; i++) { const a = s + j * (nU + 1) + i; mb.quad(a, a + nU + 1, a + nU + 2, a + 1); }
}
/** Rounded box mesh via the octree mesher (bags, watch cases, buckles). */
function roundedSolid(fieldFn, center, size, cell) {
  const maxDepth = Math.ceil(Math.log2(size / cell));
  const root = cell * (1 << maxDepth);
  const r = contour({ eval: (x, y, z) => fieldFn([x, y, z]) }, { min: [center[0] - root / 2, center[1] - root / 2, center[2] - root / 2], size: root, maxDepth, margin: 1.5, project: 3 });
  return { position: r.positions, normal: r.normals, uv: new Float32Array(r.positions.length / 3 * 2).map((_, i) => r.positions[Math.floor(i / 2) * 3 + (i % 2 ? 1 : 0)] * 4), index: r.indices };
}
function rbox(p, c, half, rad, axes) {
  const d = sub(p, c);
  const q = [Math.abs(dot(d, axes[0])) - half[0] + rad, Math.abs(dot(d, axes[1])) - half[1] + rad, Math.abs(dot(d, axes[2])) - half[2] + rad];
  return Math.hypot(Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0)) + Math.min(Math.max(q[0], q[1], q[2]), 0) - rad;
}
/** Walk a ray from outside toward `target` and stop on the surface of field f (sphere tracing). */
function surfaceHit(f, from, to, lift = 0) {
  const d = norm(sub(to, from)), L = len(sub(to, from));
  let t = 0;
  for (let i = 0; i < 120 && t < L; i++) {
    const p = madd(from, d, t), v = f.eval(p[0], p[1], p[2]);
    if (v < 0.0004) return madd(madd(from, d, t), fieldNormal(f, p), lift);
    t += Math.max(v * 0.85, 0.0008);
  }
  return null;
}

/* ================================================================== EYEWEAR */
export function buildGlasses(spec, ctx) {
  const m = ctx.sf.head.marks, S = m.S;
  const style = spec.style || 'rectangle';
  const frame = new MeshBuilder(), lens = new MeshBuilder();
  const eyes = m.eyes.slice().sort((a, b) => a.center[0] - b.center[0]);
  const fz = Math.min(eyes[0].center[2], eyes[1].center[2]) - eyes[0].radius - (0.014 + (spec.distance ?? 0)) * S;
  const fy = eyes[0].center[1] + 0.002 * S;
  const sizeK = spec.size ?? 1;
  const thick = style === 'acetate' || style === 'cateye' ? 0.0028 * S : 0.0011 * S;
  const outlines = [];
  for (const e of eyes) {
    const s = Math.sign(e.center[0]) || 1;
    const cx = e.center[0] + s * 0.004 * S;
    const W = 0.027 * S * sizeK, H = (style === 'round' ? 0.024 : style === 'aviator' ? 0.026 : 0.019) * S * sizeK;
    const pts = [];
    for (let k = 0; k < 48; k++) {
      const a = k / 48 * Math.PI * 2;
      let x, y;
      if (style === 'round') { x = Math.cos(a) * H; y = Math.sin(a) * H; }
      else if (style === 'aviator') { x = Math.cos(a) * W; y = Math.sin(a) * H * (Math.sin(a) < 0 ? 1.15 : 0.75) - (Math.cos(a) * s > 0 ? 0.004 * S * Math.max(0, -Math.sin(a)) : 0); }
      else if (style === 'cateye') { x = Math.cos(a) * W; y = Math.sin(a) * H + (Math.cos(a) * s > 0.3 && Math.sin(a) > 0 ? 0.006 * S * Math.cos(a) * s : 0); }
      else { const p = 4; x = Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), 2 / p) * W; y = Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 2 / p) * H; }
      // wrap slightly around the face
      const z = fz + 0.06 * (x * s) * (x * s) / (0.03 * S) * 0.5;
      pts.push([cx + x, fy + y, z]);
    }
    outlines.push({ pts, c: [cx, fy, fz], s, W });
    if (style === 'acetate' || style === 'cateye') tube(frame, pts, 0, { closed: true, rect: [thick * 1.15, thick * 1.05], up: [0, 0, -1] });
    else tube(frame, pts, thick, { closed: true, sides: 6 });
    // lens: fan from the centre (slightly curved)
    const c0 = lens.vert([cx, fy, fz - 0.0012 * S], [0, 0, -1], 0.5, 0.5);
    const ring = pts.map(p => lens.vert([p[0], p[1], p[2]], [0, 0, -1], 0, 0));
    for (let k = 0; k < ring.length; k++) lens.tri(c0, ring[k], ring[(k + 1) % ring.length]);
  }
  // bridge
  const L = outlines[0], R = outlines[1];
  const inL = L.pts.reduce((b, p) => (p[0] > b[0] ? p : b), L.pts[0]), inR = R.pts.reduce((b, p) => (p[0] < b[0] ? p : b), R.pts[0]);
  const bridge = resample([inL, [0, fy + 0.006 * S, fz - 0.003 * S], inR], 12);
  tube(frame, bridge, thick * 0.9, { sides: 6 });
  if (style === 'aviator') tube(frame, resample([add(inL, [0, 0.012 * S, 0]), [0, fy + 0.016 * S, fz - 0.002 * S], add(inR, [0, 0.012 * S, 0])], 12), thick * 0.8, { sides: 6 });
  // temples: from the hinge back over the ear, then down behind it
  for (const o of outlines) {
    const ear = m.ears.find(e => Math.sign(e.c[0]) === o.s) || m.ears[0];
    const hinge = o.pts.reduce((b, p) => (p[0] * o.s > b[0] * o.s ? p : b), o.pts[0]);
    const side = o.s * (Math.abs(ear.c[0]) + 0.006 * S);
    const pts = [hinge, [side * 0.96, fy + 0.003 * S, fz + 0.02 * S], [side, ear.top[1] + 0.002 * S, ear.c[2] - 0.008 * S], [side * 0.98, ear.top[1] - 0.006 * S, ear.c[2] + 0.012 * S], [side * 0.92, ear.top[1] - 0.028 * S, ear.c[2] + 0.02 * S]];
    const path = resample(pts, 22).map(p => pushOut(ctx.sf.field, p, thick * 1.6, 3));
    if (style === 'acetate' || style === 'cateye') tube(frame, path, 0, { rect: [thick * 0.6, thick * 1.5], up: [0, 1, 0] });
    else tube(frame, path, thick * 0.9, { sides: 6 });
    // nose pads (metal frames)
    if (style === 'rectangle' || style === 'round' || style === 'aviator') sphere(frame, [o.c[0] - o.s * (o.W * 0.55), fy - 0.006 * S, fz + 0.006 * S], 0.002 * S, 8, 6);
  }
  return { meshes: [{ name: 'frame', geometry: finish(frame), material: 'main' }, { name: 'lenses', geometry: finish(lens, false), material: 'lens' }], bone: 'head' };
}

/* ================================================================== JEWELLERY */
export function buildEarrings(spec, ctx) {
  const m = ctx.sf.head.marks, S = m.S;
  const mb = new MeshBuilder();
  for (const e of m.ears) {
    const s = Math.sign(e.c[0]) || 1;
    const lobe = [e.c[0] + s * 0.004 * S, e.c[1] - 0.024 * S * (1 + (m.faceParams?.earSize || 0) * 0.15), e.c[2] - 0.002 * S];
    if (spec.style === 'hoop') torus(mb, add(lobe, [0, -(spec.size ?? 1) * 0.011 * S, 0]), [1, 0, 0], (spec.size ?? 1) * 0.011 * S, 0.0011 * S, 36, 8);
    else if (spec.style === 'drop') { tube(mb, [lobe, add(lobe, [0, -0.012 * S, 0])], 0.0006 * S, { sides: 6 }); sphere(mb, add(lobe, [0, -0.017 * S * (spec.size ?? 1), 0]), 0.0045 * S * (spec.size ?? 1), 12, 8); }
    else sphere(mb, add(lobe, [s * 0.0015 * S, 0, 0]), 0.0022 * S * (spec.size ?? 1), 12, 8);
  }
  return { meshes: [{ name: 'earrings', geometry: finish(mb), material: 'main' }], bone: 'head' };
}

export function buildNecklace(spec, ctx) {
  const { F, U } = ctx, S = F.S;
  const mb = new MeshBuilder(), pm = new MeshBuilder();
  const drop = (spec.length ?? 0.5) * 0.18 * S + 0.03 * S;
  const nb = F.neckBase, sec = F.neckSection || (() => F.neckR);
  const path = [];
  const N = 96;
  for (let k = 0; k < N; k++) {
    const a = k / N * Math.PI * 2 - Math.PI;                        // 0 = front
    const fr = Math.pow(Math.cos(a / 2), 2);
    const r = sec(a) + (0.012 + 0.03 * fr * Math.min(1, drop / (0.1 * S))) * S;
    const y = nb[1] - 0.01 * S - drop * Math.pow(fr, 1.5);
    let p = [Math.sin(a) * r, y + 0.06 * S, nb[2] - Math.cos(a) * r];
    // let it fall onto whatever is worn: walk down / out until it rests on the surface
    p = pushOut(U, p, 0.0035 * S, 4);
    const down = surfaceHit(U, p, add(p, [0, -0.08 * S, -0.02 * S * fr]), 0.003 * S);
    path.push(down && down[1] > y - 0.03 * S ? down : pushOut(U, [p[0], y, p[2] - 0.01 * S * fr], 0.003 * S, 4));
  }
  const smooth = path.map((p, i) => mul(add(add(path[(i + N - 1) % N], path[(i + 1) % N]), mul(p, 2)), 0.25));
  if (spec.style === 'beads') smooth.forEach((p, i) => { if (i % 2 === 0) sphere(mb, p, 0.0042 * S, 10, 8); });
  else tube(mb, smooth, (spec.thickness ?? 1) * 0.0011 * S, { closed: true, sides: 6 });
  if (spec.pendant !== false) {
    const front = smooth[N / 2];
    const n = fieldNormal(U, front);
    const c = add(madd(front, n, 0.003 * S), [0, -0.012 * S, 0]);
    if (spec.pendantShape === 'disc') disc(pm, c, n, 0.009 * S, 0.0018 * S, { sides: 20, bevel: 0.4 });
    else { sphere(pm, c, 0.006 * S, 14, 10); }
    tube(mb, [front, add(front, [0, -0.006 * S, 0])], 0.0008 * S, { sides: 6 });
  }
  const meshes = [{ name: 'necklace', geometry: finish(mb), material: 'main', follow: true }];
  if (pm.count) meshes.push({ name: 'pendant', geometry: finish(pm), material: 'accent', follow: true });
  return { meshes };
}

/** Rings (on a finger) and bracelets / watch (on a wrist). */
export function buildRing(spec, ctx) {
  const { rig, sf } = ctx, S = rig.H / 1.75, J = rig.joints;
  const side = spec.hand === 'right' ? 'right' : 'left';
  const finger = spec.finger || 'Ring';
  const a = J[side + finger + 'Proximal'], b = J[side + finger + 'Intermediate'];
  const ax = norm(sub(b, a)), c = lerp3(a, b, 0.4);
  // finger radius from the body field
  const u = norm(cross(ax, [0, 1, 0]));
  let r = 0.002;
  for (let i = 0; i < 40; i++) { if (sf.field.eval(...madd(c, u, r)) > 0) break; r += 0.0005 * S; }
  const mb = new MeshBuilder();
  torus(mb, c, ax, r + 0.0012 * S, 0.0011 * S * (spec.thickness ?? 1), 28, 8);
  if (spec.gem) sphere(mb, madd(c, norm(cross(ax, u)), -(r + 0.0035 * S)), 0.0022 * S, 10, 8);
  return { meshes: [{ name: 'ring', geometry: finish(mb), material: 'main' }], bone: side + finger + 'Proximal' };
}
function wristFrame(rig, sf, side, t) {
  const J = rig.joints, S = rig.H / 1.75;
  const a = J[side + 'LowerArm'], b = J[side + 'Hand'];
  const ax = norm(sub(b, a)), c = lerp3(a, b, t);
  const u0 = norm(sub([0, 1, 0], mul(ax, ax[1])));
  // radius per angle
  const ring = [];
  for (let k = 0; k < 32; k++) {
    const ang = k / 32 * Math.PI * 2;
    const d = add(mul(u0, Math.cos(ang)), mul(cross(ax, u0), Math.sin(ang)));
    let r = 0.06 * S;
    for (let i = 0; i < 60 && r > 0; i++) { const v = sf.field.eval(...madd(c, d, r)); if (v < 0.0004) break; r -= Math.max(v * 0.9, 0.0006); }
    ring.push({ d, r });
  }
  return { c, ax, u0, ring, S };
}
export function buildBracelet(spec, ctx) {
  const side = spec.side === 'right' ? 'right' : 'left';
  const W = wristFrame(ctx.rig, ctx.sf, side, 0.93);
  const mb = new MeshBuilder();
  const gap = 0.006 * W.S + (spec.loose ?? 0.3) * 0.006 * W.S;
  const path = W.ring.map(({ d, r }) => madd(W.c, d, r + gap));
  if (spec.style === 'beads') path.forEach((p, i) => { if (i % 1 === 0) sphere(mb, p, 0.0035 * W.S, 10, 8); });
  else if (spec.style === 'cuff') tube(mb, path, 0, { closed: true, rect: [0.0015 * W.S, 0.006 * W.S], up: W.ax });
  else tube(mb, path, 0.0016 * W.S, { closed: true, sides: 8 });
  return { meshes: [{ name: 'bracelet', geometry: finish(mb), material: 'main' }], bone: side + 'LowerArm' };
}
export function buildWatch(spec, ctx) {
  const side = spec.side === 'right' ? 'right' : 'left';
  const W = wristFrame(ctx.rig, ctx.sf, side, 0.9);
  const S = W.S;
  const strap = new MeshBuilder(), cs = new MeshBuilder(), dial = new MeshBuilder(), glass = new MeshBuilder();
  const path = W.ring.map(({ d, r }) => madd(W.c, d, r + 0.0018 * S));
  tube(strap, path, 0, { closed: true, rect: [0.0016 * S, 0.0095 * S], up: W.ax });
  // case on the back of the wrist (top in A-pose ≈ the u0 direction)
  const top = W.ring[0];
  const n = top.d, cc = madd(W.c, n, top.r + 0.006 * S);
  const R = (spec.size ?? 1) * 0.019 * S;
  if (spec.shape === 'square') {
    const axes = [norm(cross(n, W.ax)), W.ax, n];
    const g = roundedSolid(p => rbox(p, cc, [R * 0.85, R * 0.95, 0.0045 * S], 0.003 * S, axes), cc, 0.06 * S, 0.0016 * S);
    cs.merge(fromGeo(g));
  } else disc(cs, cc, n, R, 0.009 * S, { sides: 32, bevel: 0.45 });
  disc(dial, madd(cc, n, 0.0042 * S), n, R * 0.82, 0.0006 * S, { sides: 32, bevel: 0.1 });
  // hands
  const t1 = norm(cross(n, W.ax));
  tube(cs, [madd(cc, n, 0.0052 * S), add(madd(cc, n, 0.0052 * S), mul(W.ax, R * 0.55))], 0.0005 * S, { sides: 4 });
  tube(cs, [madd(cc, n, 0.0054 * S), add(madd(cc, n, 0.0054 * S), mul(t1, R * 0.4))], 0.0006 * S, { sides: 4 });
  disc(glass, madd(cc, n, 0.0058 * S), n, R * 0.85, 0.0008 * S, { sides: 32, dome: true });
  return { meshes: [{ name: 'strap', geometry: finish(strap), material: 'strap' }, { name: 'case', geometry: finish(cs), material: 'main' }, { name: 'dial', geometry: finish(dial), material: 'accent' }, { name: 'crystal', geometry: finish(glass), material: 'lens' }], bone: side + 'LowerArm' };
}
function fromGeo(g) { const mb = new MeshBuilder(); for (let i = 0; i < g.position.length / 3; i++) mb.vert([g.position[i * 3], g.position[i * 3 + 1], g.position[i * 3 + 2]], [g.normal[i * 3], g.normal[i * 3 + 1], g.normal[i * 3 + 2]], 0, 0); for (const i of g.index) mb.idx.push(i); return mb; }

/* ================================================================== GLOVES */
export function buildGloves(spec, ctx) {
  const { sf, rig, D } = ctx, S = rig.H / 1.75;
  const meshes = [];
  for (const side of ['left', 'right']) {
    const prims = sf.body.union.filter(p => { const n = BONE_NAMES[p.bone] || ''; return n.startsWith(side) && /(Hand|Thumb|Index|Middle|Ring|Little|LowerArm)/.test(n); });
    const hf = new Field([{ op: UNION, prims }], { cell: 0.02 * S, margin: 0.02 * S });
    const J = rig.joints, a = J[side + 'LowerArm'], b = J[side + 'Hand'], L = len(sub(b, a)), d = norm(sub(b, a));
    const cuffT = 1 - (spec.cuff ?? 0.25) * 0.5;
    const ease = (spec.ease ?? 0.0018) * S + (spec.thickness ?? 1) * 0.0008 * S;
    const field = { eval: (x, y, z) => hf.eval(x, y, z) - ease };
    const region = (x, y, z) => { const q = sub([x, y, z], a); const al = dot(q, d); return cuffT * L - al; };
    const G = {
      field, region, regionParts: [{ name: 'cuff', fn: region }], thickness: 0.0015 * S, cell: Math.min(D.hands * 1.3, 0.0035 * S),
      bounds: { min: [b[0] - 0.16 * S, b[1] - 0.2 * S, b[2] - 0.16 * S], max: [b[0] + 0.16 * S, b[1] + 0.12 * S, b[2] + 0.16 * S] },
      bands: spec.knit ? { cuff: { w: 0.04 * S, kind: 'rib' } } : { cuff: { w: 0.012 * S, kind: 'band' } },
      panel: () => 0, uv: (pn, x, y, z) => [x + z, y], bandWidth: 0.04 * S, roundRim: 2, minIsland: 20,
    };
    const mesh = meshGarment(G, { bodyField: sf.field, S });
    meshes.push({ name: 'glove ' + side, geometry: mesh, groups: mesh.groups, skinned: true });
  }
  return { meshes };
}

/* ================================================================== BELT */
export function buildBelt(spec, ctx) {
  const { F, U } = ctx, S = F.S;
  const y0 = ctx.waistY ?? F.hipY + 0.07 * S;
  const w = (spec.width ?? 0.034) * S, th = 0.0035 * S;
  const path = [];
  for (let k = 0; k < 96; k++) {
    const a = k / 96 * Math.PI * 2 - Math.PI;
    const dir = [Math.sin(a), 0, -Math.cos(a)];
    const o = [dir[0] * 0.5 * S, y0, 0.01 * S + dir[2] * 0.5 * S];
    const h = surfaceHit(U, o, [0, y0, 0.01 * S], th * 0.6);
    if (h) path.push([h[0], y0, h[2]]);
  }
  const mb = new MeshBuilder(), hw = new MeshBuilder();
  const sm = path.map((p, i) => mul(add(add(path[(i + path.length - 1) % path.length], path[(i + 1) % path.length]), mul(p, 2)), 0.25));
  tube(mb, sm, 0, { closed: true, rect: [th / 2, w / 2], up: [0, 1, 0] });
  // buckle at the front: a frame + prong
  const front = sm.reduce((b, p) => (p[2] < b[2] && Math.abs(p[0]) < 0.03 * S ? p : b), sm[0]);
  const n = norm([front[0] * 0.2, 0, -1]), ax = [norm(cross([0, 1, 0], n)), [0, 1, 0], n];
  const c = madd(front, n, th * 1.2);
  const bw = w * 0.75, bh = w * 0.62;
  const frame = [[-bw, -bh], [bw, -bh], [bw, bh], [-bw, bh]].map(([u, v]) => add(c, add(mul(ax[0], u), mul(ax[1], v))));
  tube(hw, frame, 0, { closed: true, rect: [0.0025 * S, 0.0025 * S], up: n });
  tube(hw, [add(c, mul(ax[0], -bw)), add(c, mul(ax[0], bw * 0.2))], 0.0012 * S, { sides: 6 });
  // belt tip running past the buckle
  const tip = [add(c, mul(ax[0], bw * 0.9)), add(madd(c, n, -0.001 * S), mul(ax[0], bw + 0.05 * S))].map(p => pushOut(U, p, th, 3));
  tube(mb, resample(tip, 6), 0, { rect: [th / 2, w * 0.48], up: [0, 1, 0] });
  return { meshes: [{ name: 'belt', geometry: finish(mb), material: 'main', follow: true }, { name: 'buckle', geometry: finish(hw), material: 'hardware', follow: true }] };
}

/* ================================================================== BAGS */
export function buildBag(spec, ctx) {
  const { F, U } = ctx, S = F.S;
  const type = spec.type || 'backpack';
  const body = new MeshBuilder(), straps = new MeshBuilder(), hw = new MeshBuilder();
  const sizeK = spec.size ?? 1;
  if (type === 'backpack') {
    const backHit = surfaceHit(U, [0, F.chestY - 0.02 * S, 0.6 * S], [0, F.chestY - 0.02 * S, 0], 0);
    const half = [0.15 * S * sizeK, 0.21 * S * sizeK, 0.065 * S * sizeK];
    const cy = F.chestY - 0.06 * S;
    const cz = (backHit ? backHit[2] : 0.12 * S) + half[2] + 0.004 * S;
    const cc = [0, cy, cz], axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const bag = p => {
      const bulge = 0.012 * S * Math.cos(Math.min(1, Math.abs(p[0] / half[0])) * Math.PI / 2) * Math.cos(Math.min(1, Math.abs((p[1] - cy) / half[1])) * Math.PI / 2);
      let d = rbox(p, cc, [half[0], half[1], half[2]], 0.035 * S, axes) - bulge * ss(cz - half[2], cz + half[2], p[2]);
      const pocket = rbox(p, [0, cy - 0.07 * S, cz + half[2]], [half[0] * 0.75, half[1] * 0.42, 0.035 * S], 0.025 * S, axes);
      return Math.min(d, pocket);
    };
    body.merge(fromGeo(roundedSolid(bag, cc, 0.62 * S, 0.008 * S)));
    // shoulder straps: from the top of the bag over the shoulders down to the bottom corners
    for (const s of [-1, 1]) {
      const pts = [];
      const topP = [s * 0.06 * S, cy + half[1] - 0.02 * S, cz - half[2]];
      const over = [s * 0.11 * S, F.shoulderY + 0.03 * S, F.neckBase[2] + 0.01 * S];
      const front = [s * 0.12 * S, F.chestY + 0.02 * S, -0.2 * S];
      const low = [s * 0.14 * S, cy - half[1] + 0.06 * S, -0.06 * S];
      const bot = [s * 0.13 * S, cy - half[1] + 0.03 * S, cz - half[2] + 0.01 * S];
      for (const p of resample([topP, over, front, low, bot], 36)) pts.push(pushOut(U, p, 0.004 * S, 5));
      tube(straps, pts.map((p, i) => mul(add(add(pts[Math.max(0, i - 1)], pts[Math.min(pts.length - 1, i + 1)]), mul(p, 2)), 0.25)), 0, { rect: [0.0035 * S, 0.026 * S], up: [s, 0, 0] });
    }
    // top handle and zip pulls
    tube(straps, resample([[-0.035 * S, cy + half[1] - 0.005 * S, cz - 0.01 * S], [0, cy + half[1] + 0.035 * S, cz - 0.01 * S], [0.035 * S, cy + half[1] - 0.005 * S, cz - 0.01 * S]], 12), 0.004 * S, { sides: 6 });
    for (const s of [-1, 1]) tube(hw, [[s * 0.05 * S, cy + half[1] - 0.012 * S, cz + half[2] * 0.6], [s * 0.05 * S, cy + half[1] - 0.04 * S, cz + half[2] * 0.75]], 0.0022 * S, { sides: 6 });
  } else {
    // crossbody / messenger / waist bag
    const waist = type === 'waist';
    const hipY = waist ? F.waistY - 0.02 * S : F.hipY - 0.02 * S;
    const ang = waist ? 0 : (spec.side === 'left' ? -1.25 : 1.25);
    const dir = [Math.sin(ang), 0, -Math.cos(ang)];
    const hit = surfaceHit(U, [dir[0] * 0.6 * S, hipY, 0.01 * S + dir[2] * 0.6 * S], [0, hipY, 0.01 * S], 0);
    const half = waist ? [0.11 * S * sizeK, 0.05 * S * sizeK, 0.035 * S * sizeK] : [0.13 * S * sizeK, 0.1 * S * sizeK, 0.035 * S * sizeK];
    const n = norm([dir[0], 0, dir[2]]);
    const cc = hit ? madd(hit, n, half[2] + 0.004 * S) : [dir[0] * 0.25 * S, hipY, dir[2] * 0.25 * S];
    const axes = [norm(cross([0, 1, 0], n)), [0, 1, 0], n];
    const bag = p => rbox(p, cc, half, waist ? 0.03 * S : 0.02 * S, axes) - 0.006 * S * Math.cos(Math.min(1, Math.abs(dot(sub(p, cc), axes[0]) / half[0])) * Math.PI / 2) * ss(-half[2], half[2], dot(sub(p, cc), n));
    body.merge(fromGeo(roundedSolid(bag, cc, 0.4 * S, 0.006 * S)));
    if (!waist) {
      // flap
      const flap = p => rbox(p, add(madd(cc, n, half[2] + 0.002 * S), [0, half[1] * 0.35, 0]), [half[0] + 0.004 * S, half[1] * 0.68, 0.003 * S], 0.003 * S, axes);
      body.merge(fromGeo(roundedSolid(flap, add(cc, [0, half[1] * 0.35, 0]), 0.36 * S, 0.004 * S)));
    }
    // strap: across the chest to the opposite shoulder (crossbody) or around the waist
    const pts = [];
    if (waist) {
      for (let k = 0; k <= 64; k++) { const a = k / 64 * Math.PI * 2 - Math.PI; const o = [Math.sin(a) * 0.5 * S, hipY + 0.01 * S, 0.01 * S - Math.cos(a) * 0.5 * S]; const h = surfaceHit(U, o, [0, hipY + 0.01 * S, 0.01 * S], 0.004 * S); if (h) pts.push(h); }
      tube(straps, pts, 0, { closed: true, rect: [0.0025 * S, 0.016 * S], up: [0, 1, 0] });
    } else {
      const sh = -Math.sign(ang);
      const a0 = add(cc, add(mul(axes[0], -Math.sign(ang) * half[0] * 0.9), [0, half[1] * 0.8, 0]));
      const a1 = add(cc, add(mul(axes[0], Math.sign(ang) * half[0] * 0.9), [0, half[1] * 0.8, 0]));
      const route = [a1, [sh * 0.05 * S, F.chestY, -0.22 * S], [sh * 0.12 * S, F.shoulderY + 0.035 * S, F.neckBase[2]], [sh * 0.0 * S, F.chestY + 0.02 * S, 0.22 * S], a0];
      for (const p of resample(route, 60)) pts.push(pushOut(U, p, 0.004 * S, 5));
      const sm = pts.map((p, i) => mul(add(add(pts[Math.max(0, i - 1)], pts[Math.min(pts.length - 1, i + 1)]), mul(p, 2)), 0.25));
      tube(straps, sm, 0, { rect: [0.0025 * S, 0.016 * S], up: n });
    }
    // buckle / zip pull
    tube(hw, [madd(cc, n, half[2] + 0.002 * S), add(madd(cc, n, half[2] + 0.004 * S), [0, -0.018 * S, 0])], 0.002 * S, { sides: 6 });
  }
  return { meshes: [{ name: 'bag', geometry: finish(body), material: 'main', follow: true }, { name: 'straps', geometry: finish(straps), material: 'strap', follow: true }, { name: 'bagHardware', geometry: finish(hw), material: 'hardware', follow: true }] };
}

/* ================================================================== TIE / BOW TIE */
export function buildTie(spec, ctx) {
  const { F, U } = ctx, S = F.S;
  const mb = new MeshBuilder(), knot = new MeshBuilder();
  const topY = F.neckBase[1] - 0.012 * S;
  const kc = surfaceHit(U, [0, topY, -0.4 * S], [0, topY, F.neckBase[2]], 0.004 * S) || [0, topY, -0.08 * S];
  if (spec.style === 'bow') {
    for (const s of [-1, 1]) {
      const wing = p => {
        const q = sub(p, add(kc, [s * 0.03 * S, 0, -0.004 * S]));
        const pinch = 0.6 + 0.4 * ss(0, 0.035 * S, Math.abs(q[0] + s * 0.03 * S) * 1.0);
        return (Math.hypot(q[0] / 0.032, q[1] / (0.022 * pinch), q[2] / 0.008) - 1) * 0.008 * S;
      };
      mb.merge(fromGeo(roundedSolid(wing, add(kc, [s * 0.03 * S, 0, 0]), 0.1 * S, 0.0022 * S)));
    }
    knot.merge(fromGeo(roundedSolid(p => rbox(p, add(kc, [0, 0, -0.008 * S]), [0.008 * S, 0.011 * S, 0.006 * S], 0.004 * S, [[1, 0, 0], [0, 1, 0], [0, 0, 1]]), kc, 0.06 * S, 0.002 * S)));
    return { meshes: [{ name: 'bowtie', geometry: finish(mb), material: 'main', follow: true }, { name: 'knot', geometry: finish(knot), material: 'main', follow: true }] };
  }
  // necktie: knot + blade lying on the shirt
  const len0 = (spec.length ?? 1) * (F.neckBase[1] - F.waistY + 0.03 * S);
  const pts = [];
  for (let k = 0; k <= 40; k++) {
    const y = topY - 0.03 * S - len0 * k / 40;
    const h = surfaceHit(U, [0, y, -0.4 * S], [0, y, 0.1 * S], 0.0035 * S);
    if (h) pts.push(h);
  }
  if (pts.length > 3) {
    const n = pts.length;
    const wTop = 0.034 * S, wBot = (spec.width ?? 1) * 0.08 * S;
    const s0 = mb.count;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), w = wTop + (wBot - wTop) * Math.pow(t, 0.9);
      const nrm = fieldNormal(U, pts[i]), side = norm(cross(nrm, [0, 1, 0])).map(v => -v);
      const tipDrop = i === n - 1 ? 0 : 0;
      for (const [u, lift] of [[-1, 0], [1, 0], [1, 0.003 * S], [-1, 0.003 * S]]) mb.vert(add(madd(pts[i], nrm, lift), mul(side, u * w / 2)), nrm, 0, t + tipDrop);
    }
    for (let i = 0; i < n - 1; i++) for (let k = 0; k < 4; k++) { const a = s0 + i * 4 + k, b = s0 + i * 4 + (k + 1) % 4; mb.quad(a, b, b + 4, a + 4); }
    // pointed tip
    const last = pts[n - 1], nrm = fieldNormal(U, last);
    const tip = mb.vert(madd(add(last, [0, -wBot * 0.45, 0]), nrm, 0.0015 * S), nrm, 0, 1);
    const L = s0 + (n - 1) * 4;
    mb.tri(L, L + 1, tip); mb.tri(L + 3, tip, L + 2); mb.tri(L + 1, L + 2, tip); mb.tri(L, tip, L + 3);
    mb.quad(s0, s0 + 3, s0 + 2, s0 + 1);
  }
  knot.merge(fromGeo(roundedSolid(p => {
    const q = sub(p, add(kc, [0, -0.012 * S, -0.004 * S]));
    const w = 0.02 * S * (1 - 0.35 * ss(0.012 * S, -0.014 * S, q[1]));
    return Math.max(Math.abs(q[0]) - w, Math.abs(q[1]) - 0.016 * S, Math.abs(q[2]) - 0.008 * S) - 0.003 * S;
  }, kc, 0.08 * S, 0.0022 * S)));
  return { meshes: [{ name: 'tie', geometry: finish(mb), material: 'main', follow: true }, { name: 'knot', geometry: finish(knot), material: 'main', follow: true }] };
}
export { surfaceHit, tube, sphere, torus, finish, roundedSolid, rbox };
void projectTo; void primDist;
