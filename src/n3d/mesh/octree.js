/* =====================================================================
 * ADAPTIVE OCTREE DUAL CONTOURING
 *
 * Turns a signed distance field into a watertight triangle mesh whose
 * resolution varies by region (fine on the face and hands, coarser on the
 * torso) WITHOUT cracks: dual contouring on an octree emits one quad per
 * sign-changing minimal edge, joining the vertices of the 4 cells around it,
 * whatever their sizes (Ju et al. 2002; table layout after Nick Gildea's
 * public-domain DualContouringSample).
 *
 * Each leaf's vertex = mass point of its edge crossings, projected onto the
 * iso-surface with Newton steps (smooth organic surfaces, no QEF artefacts).
 * Normals come from the field gradient, so shading is smooth regardless of
 * the triangulation.
 * ===================================================================== */
import { gradient } from '../sdf/field.js';

// corner i: x = (i>>2)&1, y = (i>>1)&1, z = i&1
const EDGEVMAP = [[0, 4], [1, 5], [2, 6], [3, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 1], [2, 3], [4, 5], [6, 7]];
const CELL_FACE = [[0, 4, 0], [1, 5, 0], [2, 6, 0], [3, 7, 0], [0, 2, 1], [4, 6, 1], [1, 3, 1], [5, 7, 1], [0, 1, 2], [2, 3, 2], [4, 5, 2], [6, 7, 2]];
const CELL_EDGE = [[0, 1, 2, 3, 0], [4, 5, 6, 7, 0], [0, 4, 1, 5, 1], [2, 6, 3, 7, 1], [0, 2, 4, 6, 2], [1, 3, 5, 7, 2]];
const FACE_FACE = [
  [[4, 0, 0], [5, 1, 0], [6, 2, 0], [7, 3, 0]],
  [[2, 0, 1], [6, 4, 1], [3, 1, 1], [7, 5, 1]],
  [[1, 0, 2], [3, 2, 2], [5, 4, 2], [7, 6, 2]],
];
const FACE_EDGE = [
  [[1, 4, 0, 5, 1, 1], [1, 6, 2, 7, 3, 1], [0, 4, 6, 0, 2, 2], [0, 5, 7, 1, 3, 2]],
  [[0, 2, 3, 0, 1, 0], [0, 6, 7, 4, 5, 0], [1, 2, 0, 6, 4, 2], [1, 3, 1, 7, 5, 2]],
  [[1, 1, 0, 3, 2, 0], [1, 5, 4, 7, 6, 0], [0, 1, 5, 0, 4, 1], [0, 3, 7, 2, 6, 1]],
];
const EDGE_EDGE = [
  [[3, 2, 1, 0, 0], [7, 6, 5, 4, 0]],
  [[5, 1, 4, 0, 1], [7, 3, 6, 2, 1]],
  [[6, 4, 2, 0, 2], [7, 5, 3, 1, 2]],
];
const PROCESS_EDGE = [[3, 2, 1, 0], [7, 5, 6, 4], [11, 10, 9, 8]];
const ORDERS = [[0, 0, 1, 1], [0, 1, 0, 1]];

class Node {
  constructor(ix, iy, iz, size, depth) {
    this.ix = ix; this.iy = iy; this.iz = iz;    // min corner on the finest lattice
    this.size = size;                             // edge length in lattice units
    this.depth = depth;
    this.children = null;                         // internal node: 8 children (some null)
    this.leaf = false;
    this.corners = 0;                             // bit i set = corner i inside (d < 0)
    this.index = -1;                              // vertex index
  }
}

/**
 * @param field   { eval(x, y, z) }
 * @param opts {
 *   min: [x, y, z]      root cube min corner (m)
 *   size: number        root cube edge (m)
 *   maxDepth: int       finest level (cell = size / 2^maxDepth)
 *   cellSizeAt(x,y,z)   desired cell size (m) at a point (region resolution)
 *   project: int        Newton projection steps (default 3)
 *   relax: int          tangential relaxation passes (default 0)
 * }
 * @returns { positions: Float32Array, normals: Float32Array, indices: Uint32Array, stats }
 */
export function contour(field, opts) {
  const t0 = now();
  const maxDepth = opts.maxDepth;
  const N = 1 << maxDepth;
  const unit = opts.size / N;                     // finest cell (m)
  const [ox, oy, oz] = opts.min;
  const lat = (i) => i * unit;
  const cellSizeAt = opts.cellSizeAt || (() => unit);
  const margin = opts.margin ?? 1.25;             // near-surface test slack (non-exact distance fields)

  // corner cache on the finest lattice
  const cache = new Map();
  const S = N + 1;
  let evals = 0;
  const corner = (ix, iy, iz) => {
    const key = (ix * S + iy) * S + iz;
    let v = cache.get(key);
    if (v === undefined) { v = field.eval(ox + lat(ix), oy + lat(iy), oz + lat(iz)); cache.set(key, v); evals++; }
    return v;
  };

  // ---- build the octree (only cells that may contain the surface)
  const leaves = [];
  const build = (ix, iy, iz, size, depth) => {
    const h = size * unit;
    const cx = ox + lat(ix) + h / 2, cy = oy + lat(iy) + h / 2, cz = oz + lat(iz) + h / 2;
    if (opts.prune && opts.prune(cx, cy, cz, h * 0.866)) return null;     // outside the region of interest
    const d = field.eval(cx, cy, cz); evals++;
    if (Math.abs(d) > h * 0.866 * margin) return null;
    const node = new Node(ix, iy, iz, size, depth);
    const want = cellSizeAt(cx, cy, cz);
    if (depth >= maxDepth || h <= want * 1.42) {          // nearest power-of-two level
      node.leaf = true;
      let mask = 0;
      for (let i = 0; i < 8; i++) {
        const v = corner(ix + ((i >> 2) & 1) * size, iy + ((i >> 1) & 1) * size, iz + (i & 1) * size);
        if (v < 0) mask |= 1 << i;
      }
      node.corners = mask;
      leaves.push(node);
      return node;
    }
    const half = size >> 1;
    const ch = new Array(8);
    let any = false;
    for (let i = 0; i < 8; i++) {
      ch[i] = build(ix + ((i >> 2) & 1) * half, iy + ((i >> 1) & 1) * half, iz + (i & 1) * half, half, depth + 1);
      if (ch[i]) any = true;
    }
    if (!any) return null;
    node.children = ch;
    return node;
  };
  const root = build(0, 0, 0, N, 0);
  const tBuild = now();

  // ---- one vertex per leaf
  const pos = [], g = [0, 0, 0];
  const steps = opts.project ?? 2;
  for (const n of leaves) {
    const h = n.size * unit;
    const x0 = ox + lat(n.ix), y0 = oy + lat(n.iy), z0 = oz + lat(n.iz);
    let mx = 0, my = 0, mz = 0, cnt = 0;
    if (n.corners !== 0 && n.corners !== 255) {
      for (let e = 0; e < 12; e++) {
        const c1 = EDGEVMAP[e][0], c2 = EDGEVMAP[e][1];
        const s1 = (n.corners >> c1) & 1, s2 = (n.corners >> c2) & 1;
        if (s1 === s2) continue;
        const v1 = corner(n.ix + ((c1 >> 2) & 1) * n.size, n.iy + ((c1 >> 1) & 1) * n.size, n.iz + (c1 & 1) * n.size);
        const v2 = corner(n.ix + ((c2 >> 2) & 1) * n.size, n.iy + ((c2 >> 1) & 1) * n.size, n.iz + (c2 & 1) * n.size);
        const t = v1 / (v1 - v2);
        const ax = (c1 >> 2) & 1, ay = (c1 >> 1) & 1, az = c1 & 1, bx = (c2 >> 2) & 1, by = (c2 >> 1) & 1, bz = c2 & 1;
        mx += x0 + h * (ax + (bx - ax) * t); my += y0 + h * (ay + (by - ay) * t); mz += z0 + h * (az + (bz - az) * t);
        cnt++;
      }
    }
    let px, py, pz;
    if (cnt) { px = mx / cnt; py = my / cnt; pz = mz / cnt; } else { px = x0 + h / 2; py = y0 + h / 2; pz = z0 + h / 2; }
    // Newton projection onto the surface (forward-difference gradient, 4 evaluations per step)
    for (let st = 0; st < steps; st++) {
      const d = field.eval(px, py, pz);
      if (Math.abs(d) < h * 0.02) { evals++; break; }
      const e = Math.min(h * 0.25, 0.0008);
      const gx = (field.eval(px + e, py, pz) - d) / e, gy = (field.eval(px, py + e, pz) - d) / e, gz = (field.eval(px, py, pz + e) - d) / e;
      const gl2 = gx * gx + gy * gy + gz * gz;
      evals += 4;
      if (gl2 < 1e-12) break;
      px -= d * gx / gl2; py -= d * gy / gl2; pz -= d * gz / gl2;
    }
    const lim = h * 0.3;
    px = clamp(px, x0 - lim, x0 + h + lim); py = clamp(py, y0 - lim, y0 + h + lim); pz = clamp(pz, z0 - lim, z0 + h + lim);
    n.index = pos.length / 3;
    pos.push(px, py, pz);
  }

  // ---- contouring
  const idx = [];
  const tri = (a, b, c) => { if (a !== b && b !== c && a !== c) idx.push(a, b, c); };
  const processEdge = (n0, n1, n2, n3, dir) => {
    const pe = PROCESS_EDGE[dir];
    let minSize = Infinity, minI = 0, flip = false, sc = false;
    for (let i = 0; i < 4; i++) {
      const n = i === 0 ? n0 : i === 1 ? n1 : i === 2 ? n2 : n3;
      const e = EDGEVMAP[pe[i]];
      const m1 = (n.corners >> e[0]) & 1, m2 = (n.corners >> e[1]) & 1;
      if (n.size < minSize) { minSize = n.size; minI = i; flip = m1 === 1; sc = m1 !== m2; }
    }
    if (!sc) return;
    const a = n0.index, b = n1.index, c = n2.index, d = n3.index;
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (!flip) { tri(a, b, d); tri(a, d, c); } else { tri(a, d, b); tri(a, c, d); }
  };
  const edgeProc = (n0, n1, n2, n3, dir) => {
    if (!n0 || !n1 || !n2 || !n3) return;
    if (n0.leaf && n1.leaf && n2.leaf && n3.leaf) { processEdge(n0, n1, n2, n3, dir); return; }
    for (let i = 0; i < 2; i++) {
      const m = EDGE_EDGE[dir][i];
      edgeProc(n0.leaf ? n0 : n0.children[m[0]], n1.leaf ? n1 : n1.children[m[1]], n2.leaf ? n2 : n2.children[m[2]], n3.leaf ? n3 : n3.children[m[3]], m[4]);
    }
  };
  const faceProc = (n0, n1, dir) => {
    if (!n0 || !n1) return;
    if (n0.leaf && n1.leaf) return;
    for (let i = 0; i < 4; i++) {
      const m = FACE_FACE[dir][i];
      faceProc(n0.leaf ? n0 : n0.children[m[0]], n1.leaf ? n1 : n1.children[m[1]], m[2]);
    }
    for (let i = 0; i < 4; i++) {
      const m = FACE_EDGE[dir][i], o = ORDERS[m[0]];
      const a = o[0] ? n1 : n0, b = o[1] ? n1 : n0, c = o[2] ? n1 : n0, d = o[3] ? n1 : n0;
      edgeProc(a.leaf ? a : a.children[m[1]], b.leaf ? b : b.children[m[2]], c.leaf ? c : c.children[m[3]], d.leaf ? d : d.children[m[4]], m[5]);
    }
  };
  const cellProc = (n) => {
    if (!n || n.leaf) return;
    const ch = n.children;
    for (let i = 0; i < 8; i++) cellProc(ch[i]);
    for (let i = 0; i < 12; i++) faceProc(ch[CELL_FACE[i][0]], ch[CELL_FACE[i][1]], CELL_FACE[i][2]);
    for (let i = 0; i < 6; i++) { const m = CELL_EDGE[i]; edgeProc(ch[m[0]], ch[m[1]], ch[m[2]], ch[m[3]], m[4]); }
  };
  cellProc(root);
  const tContour = now();

  // ---- drop unused vertices, compact
  const used = new Int32Array(pos.length / 3).fill(-1);
  let nv = 0;
  for (const i of idx) if (used[i] < 0) used[i] = nv++;
  const positions = new Float32Array(nv * 3);
  for (let i = 0; i < used.length; i++) if (used[i] >= 0) { positions[used[i] * 3] = pos[i * 3]; positions[used[i] * 3 + 1] = pos[i * 3 + 1]; positions[used[i] * 3 + 2] = pos[i * 3 + 2]; }
  const indices = new Uint32Array(idx.length);
  for (let i = 0; i < idx.length; i++) indices[i] = used[idx[i]];

  // ---- optional tangential relaxation (better triangles, stays on the surface)
  if (opts.relax) relaxOnSurface(field, positions, indices, opts.relax);

  // ---- normals from the field
  const normals = new Float32Array(nv * 3);
  if (opts.normals === false) {
    // geometric vertex normals (area-weighted) are enough to fix the rare folded triangle
    for (let t = 0; t < indices.length; t += 3) {
      const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
      const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
      const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const o of [a, b, c]) { normals[o] += nx; normals[o + 1] += ny; normals[o + 2] += nz; }
    }
    for (let i = 0; i < normals.length; i += 3) { const l = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1; normals[i] /= l; normals[i + 1] /= l; normals[i + 2] /= l; }
    orient(positions, normals, indices);
    return { positions, normals, indices, stats: { leaves: leaves.length, verts: nv, tris: indices.length / 3, evals, ms: { build: tBuild - t0, contour: tContour - tBuild, total: now() - t0 } } };
  }
  for (let i = 0; i < nv; i++) {
    gradient(field, positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2], 0.0006, g);
    const l = Math.hypot(g[0], g[1], g[2]) || 1;
    normals[i * 3] = g[0] / l; normals[i * 3 + 1] = g[1] / l; normals[i * 3 + 2] = g[2] / l;
  }
  // Orientation check: triangles must face along the field gradient.
  orient(positions, normals, indices);

  return { positions, normals, indices, stats: { leaves: leaves.length, verts: nv, tris: indices.length / 3, evals, ms: { build: tBuild - t0, contour: tContour - tBuild, total: now() - t0 } } };
}

/** Flip every triangle whose winding disagrees with the vertex normals. */
function orient(P, Nn, I) {
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const s = nx * (Nn[a] + Nn[b] + Nn[c]) + ny * (Nn[a + 1] + Nn[b + 1] + Nn[c + 1]) + nz * (Nn[a + 2] + Nn[b + 2] + Nn[c + 2]);
    if (s < 0) { const tmp = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = tmp; }
  }
}

/** Laplacian smoothing followed by re-projection onto the iso-surface. */
export function relaxOnSurface(field, P, I, passes) {
  const n = P.length / 3;
  const sum = new Float32Array(n * 3), cnt = new Uint16Array(n);
  const g = [0, 0, 0];
  for (let p = 0; p < passes; p++) {
    sum.fill(0); cnt.fill(0);
    for (let t = 0; t < I.length; t += 3) {
      for (let k = 0; k < 3; k++) {
        const a = I[t + k], b = I[t + (k + 1) % 3];
        sum[a * 3] += P[b * 3]; sum[a * 3 + 1] += P[b * 3 + 1]; sum[a * 3 + 2] += P[b * 3 + 2]; cnt[a]++;
        sum[b * 3] += P[a * 3]; sum[b * 3 + 1] += P[a * 3 + 1]; sum[b * 3 + 2] += P[a * 3 + 2]; cnt[b]++;
      }
    }
    for (let i = 0; i < n; i++) {
      if (!cnt[i]) continue;
      let x = P[i * 3] * 0.5 + sum[i * 3] / cnt[i] * 0.5, y = P[i * 3 + 1] * 0.5 + sum[i * 3 + 1] / cnt[i] * 0.5, z = P[i * 3 + 2] * 0.5 + sum[i * 3 + 2] / cnt[i] * 0.5;
      for (let s = 0; s < 2; s++) {
        const d = field.eval(x, y, z);
        gradient(field, x, y, z, 0.0006, g);
        const gl2 = g[0] * g[0] + g[1] * g[1] + g[2] * g[2];
        if (gl2 < 1e-12) break;
        x -= d * g[0] / gl2; y -= d * g[1] / gl2; z -= d * g[2] / gl2;
      }
      P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
    }
  }
}

/**
 * Region resolution helper: a list of { c: [x,y,z], r, cell } spheres
 * (inside r: that cell size, fading to `base` over `fade` metres).
 */
export function zonedCellSize(base, zones, fade = 0.04) {
  return (x, y, z) => {
    let s = base;
    for (const zn of zones) {
      const d = Math.hypot(x - zn.c[0], y - zn.c[1], z - zn.c[2]) - zn.r;
      if (d <= 0) s = Math.min(s, zn.cell);
      else if (d < fade) s = Math.min(s, zn.cell + (base - zn.cell) * (d / fade));
    }
    return s;
  };
}

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
