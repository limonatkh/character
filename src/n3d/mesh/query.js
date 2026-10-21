/* =====================================================================
 * MESH QUERIES: nearest point and ray casting on a triangle mesh, through
 * a uniform grid of triangles. Trims, pockets, buttons and accessories are
 * placed on the FINAL garment surface (with its folds), not on the field.
 * ===================================================================== */

export class MeshQuery {
  constructor(P, I, cell = 0.02) {
    this.P = P; this.I = I; this.cell = cell;
    this.grid = new Map();
    const nT = I.length / 3;
    this.fn = new Float32Array(nT * 3);          // face normals
    for (let t = 0; t < nT; t++) {
      const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
      const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      this.fn[t * 3] = nx; this.fn[t * 3 + 1] = ny; this.fn[t * 3 + 2] = nz;
      const x0 = Math.min(P[a], P[b], P[c]), x1 = Math.max(P[a], P[b], P[c]);
      const y0 = Math.min(P[a + 1], P[b + 1], P[c + 1]), y1 = Math.max(P[a + 1], P[b + 1], P[c + 1]);
      const z0 = Math.min(P[a + 2], P[b + 2], P[c + 2]), z1 = Math.max(P[a + 2], P[b + 2], P[c + 2]);
      for (let ix = Math.floor(x0 / cell); ix <= Math.floor(x1 / cell); ix++)
        for (let iy = Math.floor(y0 / cell); iy <= Math.floor(y1 / cell); iy++)
          for (let iz = Math.floor(z0 / cell); iz <= Math.floor(z1 / cell); iz++) {
            const k = this.key(ix, iy, iz); let l2 = this.grid.get(k); if (!l2) this.grid.set(k, l2 = []); l2.push(t);
          }
    }
  }
  key(ix, iy, iz) { return (ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791); }

  /** Nearest surface point within maxDist: { p, n, t (triangle), dist } or null. */
  nearest(p, maxDist = 0.05) {
    const c = this.cell, rMax = Math.max(1, Math.ceil(maxDist / c));
    const ix = Math.floor(p[0] / c), iy = Math.floor(p[1] / c), iz = Math.floor(p[2] / c);
    if (!this.stamp) { this.stamp = new Int32Array(this.I.length / 3); this.qid = 0; this.tmp = [0, 0, 0]; }
    const stamp = this.stamp, qid = ++this.qid, tmp = this.tmp;
    let bestT = -1, bd = maxDist * maxDist, bx = 0, by = 0, bz = 0;
    for (let r = 1; r <= rMax; r++) {
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
        if (r > 1 && Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) < r) continue;     // only the new shell
        const l = this.grid.get(this.key(ix + dx, iy + dy, iz + dz)); if (!l) continue;
        for (let k = 0; k < l.length; k++) {
          const t = l[k];
          if (stamp[t] === qid) continue; stamp[t] = qid;
          closestOnTriInto(this.P, this.I, t, p[0], p[1], p[2], tmp);
          const d2 = (tmp[0] - p[0]) ** 2 + (tmp[1] - p[1]) ** 2 + (tmp[2] - p[2]) ** 2;
          if (d2 < bd) { bd = d2; bestT = t; bx = tmp[0]; by = tmp[1]; bz = tmp[2]; }
        }
      }
      if (bestT >= 0 && bd <= (r * c) * (r * c)) break;          // nothing closer can be further out
    }
    if (bestT < 0) return null;
    return { p: [bx, by, bz], t: bestT, n: [this.fn[bestT * 3], this.fn[bestT * 3 + 1], this.fn[bestT * 3 + 2]], dist: Math.sqrt(bd) };
  }

  /** First hit of the ray o + d·t (d normalised), t ∈ [0, maxT]: { p, n, t, tri } or null. */
  raycast(o, d, maxT = 1) {
    const c = this.cell, step = c * 0.5;
    let best = null;
    const tested = new Set();
    for (let s = 0; s <= maxT + c; s += step) {
      const x = o[0] + d[0] * s, y = o[1] + d[1] * s, z = o[2] + d[2] * s;
      const l = this.grid.get(this.key(Math.floor(x / c), Math.floor(y / c), Math.floor(z / c)));
      if (l) for (const t of l) {
        if (tested.has(t)) continue; tested.add(t);
        const h = rayTri(this.P, this.I, t, o, d);
        if (h !== null && h >= 0 && h <= maxT && (!best || h < best.t)) best = { t: h, tri: t };
      }
      if (best && best.t < s - c) break;
    }
    if (!best) return null;
    return { p: [o[0] + d[0] * best.t, o[1] + d[1] * best.t, o[2] + d[2] * best.t], n: [this.fn[best.tri * 3], this.fn[best.tri * 3 + 1], this.fn[best.tri * 3 + 2]], t: best.t, tri: best.tri };
  }
}

function rayTri(P, I, t, o, d) {
  const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
  const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2];
  const e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
  const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-12) return null;
  const inv = 1 / det;
  const tx = o[0] - P[a], ty = o[1] - P[a + 1], tz = o[2] - P[a + 2];
  const u = (tx * px + ty * py + tz * pz) * inv;
  if (u < 0 || u > 1) return null;
  const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
  const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv;
  if (v < 0 || u + v > 1) return null;
  return (e2x * qx + e2y * qy + e2z * qz) * inv;
}

function closestOnTri(P, I, t, p) {
  const A = [P[I[t * 3] * 3], P[I[t * 3] * 3 + 1], P[I[t * 3] * 3 + 2]];
  const B = [P[I[t * 3 + 1] * 3], P[I[t * 3 + 1] * 3 + 1], P[I[t * 3 + 1] * 3 + 2]];
  const C = [P[I[t * 3 + 2] * 3], P[I[t * 3 + 2] * 3 + 1], P[I[t * 3 + 2] * 3 + 2]];
  const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]], dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const ab = sub(B, A), ac = sub(C, A), ap = sub(p, A);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return A;
  const bp = sub(p, B), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return B;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return [A[0] + ab[0] * v, A[1] + ab[1] * v, A[2] + ab[2] * v]; }
  const cp = sub(p, C), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return C;
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return [A[0] + ac[0] * w, A[1] + ac[1] * w, A[2] + ac[2] * w]; }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return [B[0] + (C[0] - B[0]) * w, B[1] + (C[1] - B[1]) * w, B[2] + (C[2] - B[2]) * w]; }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  return [A[0] + ab[0] * v + ac[0] * w, A[1] + ab[1] * v + ac[1] * w, A[2] + ab[2] * v + ac[2] * w];
}

/** Allocation-free closest point on triangle t to (px, py, pz), written into out. */
function closestOnTriInto(P, I, t, px, py, pz, out) {
  const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
  const ax = P[a], ay = P[a + 1], az = P[a + 2];
  const abx = P[b] - ax, aby = P[b + 1] - ay, abz = P[b + 2] - az;
  const acx = P[c] - ax, acy = P[c + 1] - ay, acz = P[c + 2] - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) { out[0] = ax; out[1] = ay; out[2] = az; return; }
  const bpx = px - P[b], bpy = py - P[b + 1], bpz = pz - P[b + 2];
  const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) { out[0] = P[b]; out[1] = P[b + 1]; out[2] = P[b + 2]; return; }
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); out[0] = ax + abx * v; out[1] = ay + aby * v; out[2] = az + abz * v; return; }
  const cpx = px - P[c], cpy = py - P[c + 1], cpz = pz - P[c + 2];
  const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) { out[0] = P[c]; out[1] = P[c + 1]; out[2] = P[c + 2]; return; }
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); out[0] = ax + acx * w; out[1] = ay + acy * w; out[2] = az + acz * w; return; }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); out[0] = P[b] + (P[c] - P[b]) * w; out[1] = P[b + 1] + (P[c + 1] - P[b + 1]) * w; out[2] = P[b + 2] + (P[c + 2] - P[b + 2]) * w; return; }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  out[0] = ax + abx * v + acx * w; out[1] = ay + aby * v + acy * w; out[2] = az + abz * v + acz * w;
}
