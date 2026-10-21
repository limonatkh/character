/* =====================================================================
 * MESH ATTRIBUTES: skin weights, region tags, UV projections, colours.
 * Pure JS on typed arrays (works in workers and Node).
 * ===================================================================== */
import { primDist, UNION } from '../sdf/field.js';

/**
 * Skin weights from primitive contributions: every primitive belongs to a
 * bone; near a vertex, each primitive votes with exp(−(d − dmin)/σ). Blend
 * zones of the distance field (armpits, hips, neck) therefore get smoothly
 * shared weights. Returns { skinIndex: Uint16Array(4n), skinWeight: Float32Array(4n), tags: Uint8Array(n), dominant: Uint16Array(n) }.
 * `fieldForWeights` may differ from the meshed field (garments use the body's).
 */
export function skinWeights(positions, fieldForWeights, opts = {}) {
  const n = positions.length / 3;
  const skinIndex = new Uint16Array(n * 4), skinWeight = new Float32Array(n * 4);
  const tags = new Uint8Array(n), dominant = new Uint16Array(n);
  const sigmaMin = opts.sigmaMin ?? 0.004;
  const offset = opts.offset || null;   // optional per-vertex normals * distance to probe inside (garments)
  const allow = opts.allow || null;     // optional (i) => Set of allowed bone indices (e.g. a sleeve only follows its arm)
  const acc = new Map();
  for (let i = 0; i < n; i++) {
    let x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    if (offset) { x -= offset[i * 3]; y -= offset[i * 3 + 1]; z -= offset[i * 3 + 2]; }
    let prims = fieldForWeights.nearPrims(x, y, z);
    const ok = allow && allow(i);
    if (ok) {
      let f = prims.filter(p => ok.has(p.bone));
      // the cell lists only primitives within the field's margin: far from the body (loose garments) the
      // allowed ones may be missing from it, so look at all of them
      if (!f.length && fieldForWeights.prims) f = fieldForWeights.prims.filter(p => p.bone !== undefined && ok.has(p.bone) && unionPrim(fieldForWeights, p));
      if (f.length) prims = f;
    }
    acc.clear();
    let dmin = Infinity, best = null, bestTag = 0, bestTagD = Infinity;
    const ds = new Float64Array(prims.length);
    for (let j = 0; j < prims.length; j++) {
      const d = primDist(prims[j], x, y, z);
      ds[j] = d;
      if (d < dmin) { dmin = d; best = prims[j]; }
      if (prims[j].tag && d < bestTagD) { bestTagD = d; bestTag = prims[j].tag; }
    }
    if (!best) { skinIndex[i * 4] = opts.fallbackBone || 0; skinWeight[i * 4] = 1; continue; }
    for (let j = 0; j < prims.length; j++) {
      const p = prims[j];
      const sg = Math.max(sigmaMin, p.k * 0.45);
      const w = Math.exp(-(ds[j] - dmin) / sg);
      if (w < 1e-3) continue;
      acc.set(p.bone, (acc.get(p.bone) || 0) + w);
    }
    const top = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    let sum = 0;
    for (const [, w] of top) sum += w;
    for (let k = 0; k < 4; k++) {
      if (k < top.length) { skinIndex[i * 4 + k] = top[k][0]; skinWeight[i * 4 + k] = top[k][1] / sum; }
    }
    // drop tiny weights (cleaner rigs) and renormalise
    let s2 = 0;
    for (let k = 0; k < 4; k++) { if (skinWeight[i * 4 + k] < 0.02) skinWeight[i * 4 + k] = 0; s2 += skinWeight[i * 4 + k]; }
    for (let k = 0; k < 4; k++) skinWeight[i * 4 + k] /= s2 || 1;
    dominant[i] = top.length ? top[0][0] : best.bone;
    // region tag: only when that tagged primitive is (nearly) the surface here
    tags[i] = bestTag && bestTagD - dmin < (opts.tagBand ?? 0.0012) ? bestTag : 0;
  }
  return { skinIndex, skinWeight, tags, dominant };
}

const unionSets = new WeakMap();
function unionPrim(field, p) {
  let set = unionSets.get(field);
  if (!set) { set = new Set(); for (const L of field.layers || []) if (L.op === UNION) for (const q of L.prims) set.add(q); unionSets.set(field, set); }
  return set.has(p);
}

/**
 * Split an indexed mesh into groups by a per-triangle key (e.g. head vs body),
 * duplicating shared boundary vertices so each group can have its own material
 * and UVs while positions and normals stay identical (no visible seam).
 * @param attrs { name: { array, itemSize } } per-vertex attributes to carry over
 * @param keyOfTri (a, b, c) => groupKey
 */
export function splitGroups(indices, attrs, keyOfTri) {
  const groups = new Map();
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t], b = indices[t + 1], c = indices[t + 2];
    const key = keyOfTri(a, b, c);
    if (key === null || key === undefined) continue;
    let g = groups.get(key);
    if (!g) { g = { map: new Map(), idx: [], src: [] }; groups.set(key, g); }
    for (const v of [a, b, c]) {
      let ni = g.map.get(v);
      if (ni === undefined) { ni = g.src.length; g.map.set(v, ni); g.src.push(v); }
      g.idx.push(ni);
    }
  }
  const out = {};
  for (const [key, g] of groups) {
    const o = { indices: Uint32Array.from(g.idx), attributes: {}, source: Uint32Array.from(g.src) };
    for (const [name, { array, itemSize }] of Object.entries(attrs)) {
      const Arr = array.constructor;
      const a = new Arr(g.src.length * itemSize);
      for (let i = 0; i < g.src.length; i++) for (let k = 0; k < itemSize; k++) a[i * itemSize + k] = array[g.src[i] * itemSize + k];
      o.attributes[name] = { array: a, itemSize };
    }
    out[key] = o;
  }
  return out;
}

/**
 * Cylindrical UVs around an axis (origin o, unit axis a, reference direction r0
 * pointing to u = 0.5). scale: metres per UV unit (0 = normalised 0..1 around).
 */
export function cylindricalUV(positions, o, a, r0, opts = {}) {
  const n = positions.length / 3, uv = new Float32Array(n * 2);
  const b = cross(a, r0);
  const circ = opts.circumference || 1;
  for (let i = 0; i < n; i++) {
    const px = positions[i * 3] - o[0], py = positions[i * 3 + 1] - o[1], pz = positions[i * 3 + 2] - o[2];
    const h = px * a[0] + py * a[1] + pz * a[2];
    const qx = px - a[0] * h, qy = py - a[1] * h, qz = pz - a[2] * h;
    const ang = Math.atan2(qx * b[0] + qy * b[1] + qz * b[2], qx * r0[0] + qy * r0[1] + qz * r0[2]);
    uv[i * 2] = opts.metric ? (ang / (2 * Math.PI)) * circ : 0.5 + ang / (2 * Math.PI);
    uv[i * 2 + 1] = opts.metric ? h : (h - (opts.v0 || 0)) / (opts.vSpan || 1);
  }
  return uv;
}

/**
 * Bone-segment cylindrical UVs in metres: each vertex is unwrapped around the
 * segment of its dominant bone (u = arc length, v = length along the bone).
 * Good for tiling detail textures (skin pores, fabric weave) without an atlas.
 */
export function boneUV(positions, normals, dominant, joints, boneNames, childOf) {
  const n = positions.length / 3, uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const name = boneNames[dominant[i]];
    const a = joints[name], c = joints[childOf[name]] || [a[0], a[1] + 0.1, a[2]];
    let ax = c[0] - a[0], ay = c[1] - a[1], az = c[2] - a[2];
    const L = Math.hypot(ax, ay, az) || 1; ax /= L; ay /= L; az /= L;
    const px = positions[i * 3] - a[0], py = positions[i * 3 + 1] - a[1], pz = positions[i * 3 + 2] - a[2];
    const h = px * ax + py * ay + pz * az;
    const qx = px - ax * h, qy = py - ay * h, qz = pz - az * h;
    const rad = Math.hypot(qx, qy, qz) || 0.01;
    // reference direction perpendicular to the bone
    let rx = 0, ry = 0, rz = -1;
    if (Math.abs(az) > 0.9) { rx = 1; rz = 0; }
    const d = rx * ax + ry * ay + rz * az; rx -= ax * d; ry -= ay * d; rz -= az * d;
    const rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;
    const bx = ay * rz - az * ry, by = az * rx - ax * rz, bz = ax * ry - ay * rx;
    const ang = Math.atan2(qx * bx + qy * by + qz * bz, qx * rx + qy * ry + qz * rz);
    uv[i * 2] = ang * rad;
    uv[i * 2 + 1] = h;
  }
  return uv;
}

export function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }

/** Area-weighted vertex normals (for meshes that do not come from a field). */
export function computeNormals(P, I) {
  const N = new Float32Array(P.length);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) { N[k] += nx; N[k + 1] += ny; N[k + 2] += nz; }
  }
  for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; }
  return N;
}
