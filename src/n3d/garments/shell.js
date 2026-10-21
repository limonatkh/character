/* =====================================================================
 * GARMENT SHELL: field → finished garment mesh.
 *
 *  1. mesh the garment's outer surface (adaptive dual contouring) only
 *     inside its region (cells outside are never visited)
 *  2. clip it exactly along the region boundary (smooth hems, necklines,
 *     cuffs, openings) and drop stray fragments
 *  3. distance to the nearest edge (geodesic) → hem allowances, bands
 *  4. surface detail: drape folds, compression folds, hem turn-ups, seam
 *     ridges — displaced OUTWARD only, so nothing can sink into the body
 *  5. real thickness: inner surface near every opening + rounded rims
 *  6. panel UVs in metres (front / back / sleeves / legs …) split at the
 *     seams, so fabric textures and prints follow the garment's cut
 *  7. skin weights from the body underneath
 * ===================================================================== */
import { contour } from '../mesh/octree.js';
import { clipMesh, boundaryLoops, dropSmallIslands, splitAlong } from '../mesh/clip.js';
import { skinWeights } from '../mesh/attributes.js';

/**
 * @param G {
 *   field        outer surface field ({ eval })
 *   region(x,y,z) negative inside the garment's coverage
 *   thickness    fabric thickness (m)
 *   cell         mesh cell size (m)
 *   bounds       { min, max } box to mesh in
 *   panel(x,y,z) → panel id (int) ; uv(panel, x,y,z) → [u, v] (m)
 *   displace(p, n, info) → outward displacement (m, ≥ 0)   (optional)
 *   bandWidth    inner surface width from the openings (m)
 *   roundRim     rim profile segments (1 = flat, 2+ = rounded)
 * }
 * @param ctx { bodyField (for skin weights), S }
 */
export function meshGarment(G, ctx) {
  const t0 = now();
  const S = ctx.S || 1;
  const b = G.bounds;
  const cell = G.cell;
  const size = Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) + 4 * cell;
  const maxDepth = Math.ceil(Math.log2(size / cell));
  const rootSize = cell * (1 << maxDepth);
  const c = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
  const region = G.region;
  const raw = contour(G.field, {
    min: [c[0] - rootSize / 2, c[1] - rootSize / 2, c[2] - rootSize / 2], size: rootSize, maxDepth,
    cellSizeAt: G.cellSizeAt || (() => cell), margin: G.octreeMargin ?? 1.3, project: 2, normals: false,
    prune: (x, y, z, rad) => region(x, y, z) > rad * 1.2 + 2 * cell,
  });
  const tMesh = now();

  // ---- clip along the region boundary
  const nv0 = raw.positions.length / 3;
  const val = new Float32Array(nv0);
  for (let i = 0; i < nv0; i++) val[i] = region(raw.positions[i * 3], raw.positions[i * 3 + 1], raw.positions[i * 3 + 2]);
  const refine = (pa, pb, va, vb, p) => {
    // bisection on the region value, then back onto the garment surface
    let a = pa, bb = pb, fa = va;
    let q = p;
    for (let it = 0; it < 6; it++) {
      q = [(a[0] + bb[0]) / 2, (a[1] + bb[1]) / 2, (a[2] + bb[2]) / 2];
      const fq = region(q[0], q[1], q[2]);
      if ((fq < 0) === (fa < 0)) { a = q; fa = fq; } else bb = q;
    }
    return q;            // (linear on the edge: stays on the iso-curve; the surface deviation is negligible)
  };
  let cm = clipMesh(raw.positions, raw.normals, raw.indices, val, refine);
  let I = dropSmallIslands(cm.indices, cm.positions.length / 3, G.minIsland ?? 40);
  let P = cm.positions, onEdge = cm.onEdge;
  ({ P, I, onEdge } = compact(P, I, onEdge));
  // pin-holes left where the garment grazes the region boundary or a layer below: close them,
  // otherwise they would count as openings (and grow ribbed bands / rims around themselves)
  ({ P, I, onEdge } = fillSmallHoles(P, I, onEdge, 0.09 * S, 28));
  // panel seams become clean curves: split the mesh exactly along each seam function
  for (const fn of G.seams || []) {
    const val = new Float32Array(P.length / 3);
    for (let i = 0; i < val.length; i++) val[i] = fn(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
    const sp = splitAlong(P, I, val, []);
    P = sp.P; I = sp.I;
  }
  let nv = P.length / 3;

  // ---- edges: which part of the pattern each opening is (hem, neckline, cuff…)
  let loops = boundaryLoops(I);
  let isB = new Uint8Array(nv);
  for (const lp of loops) for (const v of lp) isB[v] = 1;
  const parts = G.regionParts || [];
  let edgeType = new Int8Array(nv).fill(-1);
  for (let i = 0; i < nv; i++) {
    if (!isB[i]) continue;
    let best = -1, bv = -Infinity;
    for (let k = 0; k < parts.length; k++) { const v = parts[k].fn(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); if (v > bv) { bv = v; best = k; } }
    edgeType[i] = best;
  }
  let edgeDist = geodesic(P, I, isB);
  // distance to each kind of edge that has a band (ribbed hem, cuff, neckband, waistband…)
  const bands = G.bands || {};
  const bandDist = {};
  for (const [name, bd] of Object.entries(bands)) {
    const src = new Uint8Array(nv);
    let any = false;
    for (let i = 0; i < nv; i++) if (edgeType[i] >= 0 && bandOf(parts[edgeType[i]].name) === name) { src[i] = 1; any = true; }
    if (any) bandDist[name] = { d: distToEdges(P, loops, src, bd.w * 1.5), w: bd.w, kind: bd.kind, b: bd };
  }
  // split the mesh exactly along each band's inner limit (crisp band edges)
  for (const [, bd] of Object.entries(bandDist)) {
    const names = Object.keys(bandDist);
    const val = new Float32Array(P.length / 3);
    for (let i = 0; i < val.length; i++) val[i] = bd.d[i] - bd.w;
    const sp = splitAlong(P, I, val, [{ array: edgeDist, size: 1 }, ...names.map(n2 => ({ array: bandDist[n2].d, size: 1 }))]);
    const grow = (arr, fill) => { const o = new arr.constructor(sp.P.length / 3).fill(fill); o.set(arr); return o; };
    edgeType = grow(edgeType, -1); isB = grow(isB, 0);
    P = sp.P; I = sp.I; edgeDist = sp.attrs[0];
    names.forEach((n2, j) => { bandDist[n2].d = sp.attrs[j + 1]; });
  }
  if (P.length / 3 !== nv) {
    nv = P.length / 3;
    loops = boundaryLoops(I);
    isB = new Uint8Array(nv);
    for (const lp of loops) for (const v of lp) isB[v] = 1;
    for (let i = 0; i < nv; i++) {
      if (!isB[i] || edgeType[i] >= 0) continue;
      let best = -1, bv = -Infinity;
      for (let k = 0; k < parts.length; k++) { const v = parts[k].fn(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); if (v > bv) { bv = v; best = k; } }
      edgeType[i] = best;
    }
  }
  const inBand = new Int8Array(nv).fill(-1);          // index into BAND_KINDS
  const bandU = new Float32Array(nv);                 // 0 at the edge … 1 at the band's inner limit
  for (const [, bd] of Object.entries(bandDist)) for (let i = 0; i < nv; i++) if (bd.d[i] < bd.w) { inBand[i] = BAND_KINDS.indexOf(bd.kind); bandU[i] = bd.d[i] / bd.w; }

  // ---- surface detail (outward only)
  let N = vertexNormals(P, I);
  if (G.displace || Object.keys(bandDist).length) {
    const info = { edgeDist: 0, index: 0, band: null, bandU: 0 };
    const P2 = new Float32Array(P);
    for (let i = 0; i < nv; i++) {
      info.edgeDist = edgeDist[i]; info.index = i; info.band = inBand[i] >= 0 ? BAND_KINDS[inBand[i]] : null; info.bandU = bandU[i];
      const p = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]], n = [N[i * 3], N[i * 3 + 1], N[i * 3 + 2]];
      let d = G.displace ? G.displace(p, n, info) || 0 : 0;
      if (info.band) d += bandRaise(info.band, info.bandU, S);
      d = Math.max(0, d);
      if (d) { P2[i * 3] += n[0] * d; P2[i * 3 + 1] += n[1] * d; P2[i * 3 + 2] += n[2] * d; }
    }
    P = P2;
    N = vertexNormals(P, I);
  }

  // ---- panels + UVs, split at the seams
  const panelOf = new Int16Array(nv);
  for (let i = 0; i < nv; i++) panelOf[i] = G.panel ? G.panel(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]) : 0;
  const uvFn = G.uv || ((pn, x, y) => [x, y]);
  const outer = splitPanels(P, N, I, G.panel || (() => 0), uvFn);

  // ---- thickness: inner surface near the openings + rims
  const th = G.thickness;
  const bandW = G.bandWidth ?? 0.1 * S;
  const mb = new Geo();
  mb.append(outer.P, outer.N, outer.UV, outer.I, outer.src, 0);
  const innerMap = new Int32Array(nv).fill(-1);
  const inP = [], inN = [], inUV = [], inSrc = [];
  for (let i = 0; i < nv; i++) {
    if (edgeDist[i] > bandW) continue;
    innerMap[i] = inSrc.length;
    inP.push(P[i * 3] - N[i * 3] * th, P[i * 3 + 1] - N[i * 3 + 1] * th, P[i * 3 + 2] - N[i * 3 + 2] * th);
    inN.push(-N[i * 3], -N[i * 3 + 1], -N[i * 3 + 2]);
    const uvp = uvFn(panelOf[i], P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
    inUV.push(uvp[0], uvp[1]);
    inSrc.push(i);
  }
  const inI = [];
  for (let t = 0; t < I.length; t += 3) {
    const a2 = innerMap[I[t]], b2 = innerMap[I[t + 1]], c2 = innerMap[I[t + 2]];
    if (a2 >= 0 && b2 >= 0 && c2 >= 0) inI.push(a2, c2, b2);
  }
  mb.append(new Float32Array(inP), new Float32Array(inN), new Float32Array(inUV), inI, inSrc, 1);
  const seg = Math.max(1, G.roundRim ?? 2);
  for (const lp of loops) rim(mb, P, N, lp, th, seg);

  // ---- material groups: main fabric, rib knit, lining (inside)
  const out = mb.build();
  const groupOf = (tri) => {
    const a2 = out.index[tri], b2 = out.index[tri + 1], c2 = out.index[tri + 2];
    let rib = 0;
    for (const v of [a2, b2, c2]) { const sv = out.source[v]; if (sv >= 0 && inBand[sv] === 0) rib++; }
    if (rib >= 2) return 'rib';
    let tr = 0;
    for (const v of [a2, b2, c2]) { const sv = out.source[v]; if (sv >= 0 && inBand[sv] === 3) tr++; }
    if (tr >= 2 && out.layer[a2] !== 1) return 'trim';
    if (out.layer[a2] === 1 && out.layer[b2] === 1) return G.lined ? 'lining' : 'inside';
    return 'main';
  };
  const byGroup = new Map();
  for (let t = 0; t < out.index.length; t += 3) { const g = groupOf(t); let l = byGroup.get(g); if (!l) byGroup.set(g, l = []); l.push(out.index[t], out.index[t + 1], out.index[t + 2]); }
  const sorted = [], groups = [];
  for (const name of ['main', 'rib', 'trim', 'inside', 'lining']) {
    const l = byGroup.get(name); if (!l) continue;
    groups.push({ name, start: sorted.length, count: l.length });
    for (const v of l) sorted.push(v);
  }
  out.index = Uint32Array.from(sorted);
  out.groups = groups;

  // ---- skin weights from the body underneath
  const nOut = out.position.length / 3;
  const offset = new Float32Array(nOut * 3);
  if (ctx.bodyField) {
    for (let i = 0; i < nOut; i++) {
      const x = out.position[i * 3], y = out.position[i * 3 + 1], z = out.position[i * 3 + 2];
      const d = Math.max(0, ctx.bodyField.eval(x, y, z));
      const s2 = out.layer[i] === 1 ? -1 : 1;     // inner normals point inward
      offset[i * 3] = out.normal[i * 3] * d * s2; offset[i * 3 + 1] = out.normal[i * 3 + 1] * d * s2; offset[i * 3 + 2] = out.normal[i * 3 + 2] * d * s2;
    }
    const w = skinWeights(out.position, ctx.bodyField, { offset, sigmaMin: 0.012 * S });
    out.skinIndex = w.skinIndex; out.skinWeight = w.skinWeight;
    if (G.adjustWeights) for (let i = 0; i < nOut; i++) G.adjustWeights(i, out.position, out.skinIndex, out.skinWeight);
  }
  // data for trims (collars, cuffs, buttons…) and stitching
  const loopInfo = loops.map(lp => {
    const cnt = new Map();
    for (const v of lp) { const tname = edgeType[v] >= 0 ? parts[edgeType[v]].name : '?'; cnt.set(tname, (cnt.get(tname) || 0) + 1); }
    const type = [...cnt.entries()].sort((x, y) => y[1] - x[1])[0][0];
    return { verts: lp, type, types: lp.map(v => (edgeType[v] >= 0 ? parts[edgeType[v]].name : '?')) };
  });
  out.surface = { P, N, I, loops: loopInfo, edgeDist, edgeType, panelOf, partNames: parts.map(p2 => p2.name), bandDist, seams: panelSeams(P, I, outer.triPanel, G.stitchSeams) };
  out.stats = { verts: nOut, tris: out.index.length / 3, ms: { mesh: tMesh - t0, total: now() - t0 }, octree: raw.stats };
  return out;
}

/** Band kinds: rib (knit rib: hems, cuffs, neckbands), band (same fabric, doubled), elastic (gathered). */
export const BAND_KINDS = ['rib', 'band', 'elastic', 'trim'];
/** Region part name → band name (cuffL / cuffR → cuff, legL / legR → legHem). */
export function bandOf(part) { return part.startsWith('cuff') ? 'cuff' : part.startsWith('armhole') ? 'armhole' : part; }
function bandRaise(kind, u, S) {
  const edge = Math.pow(Math.max(0, 1 - u), 0.15);   // a crisp step where the band starts
  if (kind === 'rib') return 0.0009 * S * edge;
  if (kind === 'band') return 0.0012 * S * edge;
  if (kind === 'trim') return 0.0008 * S * edge;
  return 0.0015 * S * edge;
}

/** Seam lines: mesh edges shared by triangles of different panels (polylines). keep(pa, pb) filters seams. */
function panelSeams(P, I, triPanel, keep) {
  const edges = new Map(), segs = [];
  for (let t = 0; t < I.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = I[t + k], b = I[t + (k + 1) % 3];
    const key = a < b ? a * 4194304 + b : b * 4194304 + a;
    const o = edges.get(key);
    if (o === undefined) edges.set(key, t / 3);
    else if (triPanel[o] !== triPanel[t / 3]) {
      const pa = Math.min(triPanel[o], triPanel[t / 3]), pb = Math.max(triPanel[o], triPanel[t / 3]);
      if (keep && !keep(pa, pb)) continue;
      segs.push([[P[a * 3], P[a * 3 + 1], P[a * 3 + 2]], [P[b * 3], P[b * 3 + 1], P[b * 3 + 2]], pa * 16 + pb]);
    }
  }
  return chainSegments(segs);
}
/** Join segments sharing end points into polylines (grouped by key). */
export function chainSegments(segs, tol = 1e-6) {
  const key = p => p.map(v => Math.round(v / 1e-5)).join(',');
  const lines = [];
  const byKey = new Map();
  for (const s of segs) {
    for (const end of [0, 1]) { const k = key(s[end]) + '|' + s[2]; let l = byKey.get(k); if (!l) byKey.set(k, l = []); l.push(s); }
  }
  const used = new Set();
  for (const s of segs) {
    if (used.has(s)) continue;
    used.add(s);
    const line = [s[0], s[1]];
    for (const dir of [1, 0]) {
      let guard = 0;
      for (;;) {
        const endP = dir ? line[line.length - 1] : line[0];
        const cand = (byKey.get(key(endP) + '|' + s[2]) || []).find(o => !used.has(o));
        if (!cand || guard++ > 100000) break;
        used.add(cand);
        const nxt = key(cand[0]) === key(endP) ? cand[1] : cand[0];
        if (dir) line.push(nxt); else line.unshift(nxt);
      }
    }
    lines.push({ key: s[2], pts: line });
  }
  void tol;
  return lines;
}

/* ------------------------------------------------------------------ helpers */
function project(f, p, iters) {
  let [x, y, z] = p;
  for (let i = 0; i < iters; i++) {
    const d = f.eval(x, y, z);
    if (Math.abs(d) < 1e-5) break;
    const e = 0.0005;
    const gx = (f.eval(x + e, y, z) - d) / e, gy = (f.eval(x, y + e, z) - d) / e, gz = (f.eval(x, y, z + e) - d) / e;
    const g2 = gx * gx + gy * gy + gz * gz;
    if (g2 < 1e-10) break;
    x -= d * gx / g2; y -= d * gy / g2; z -= d * gz / g2;
  }
  return [x, y, z];
}

/** Close boundary loops shorter than maxLen (and with at most maxVerts vertices) with a fan around their centroid. */
export function fillSmallHoles(P, I, flag, maxLen, maxVerts) {
  const loops = boundaryLoops(I).filter(lp => {
    if (lp.length > maxVerts) return false;
    let L = 0;
    for (let k = 0; k < lp.length; k++) { const a = lp[k] * 3, b = lp[(k + 1) % lp.length] * 3; L += Math.hypot(P[a] - P[b], P[a + 1] - P[b + 1], P[a + 2] - P[b + 2]); if (L > maxLen) return false; }
    return true;
  });
  if (!loops.length) return { P, I, onEdge: flag };
  const nv = P.length / 3, extra = loops.filter(lp => lp.length > 3).length;
  const P2 = new Float32Array((nv + extra) * 3); P2.set(P);
  const f2 = new Uint8Array(nv + extra); f2.set(flag);
  const tris = [];
  let c = nv;
  for (const lp of loops) {
    if (lp.length === 3) { tris.push(lp[2], lp[1], lp[0]); continue; }
    let x = 0, y = 0, z = 0;
    for (const v of lp) { x += P[v * 3]; y += P[v * 3 + 1]; z += P[v * 3 + 2]; }
    P2[c * 3] = x / lp.length; P2[c * 3 + 1] = y / lp.length; P2[c * 3 + 2] = z / lp.length;
    for (let k = 0; k < lp.length; k++) tris.push(lp[(k + 1) % lp.length], lp[k], c);
    c++;
  }
  const I2 = new Uint32Array(I.length + tris.length); I2.set(I); I2.set(tris, I.length);
  return { P: P2, I: I2, onEdge: f2 };
}

function compact(P, I, flag) {
  const n = P.length / 3, map = new Int32Array(n).fill(-1);
  let k = 0;
  for (const i of I) if (map[i] < 0) map[i] = k++;
  const P2 = new Float32Array(k * 3), f2 = new Uint8Array(k);
  for (let i = 0; i < n; i++) if (map[i] >= 0) { P2.set(P.subarray(i * 3, i * 3 + 3), map[i] * 3); f2[map[i]] = flag[i]; }
  const I2 = new Uint32Array(I.length);
  for (let i = 0; i < I.length; i++) I2[i] = map[I[i]];
  return { P: P2, I: I2, onEdge: f2 };
}

/** Area-weighted vertex normals. */
export function vertexNormals(P, I) {
  const N = new Float32Array(P.length);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const o of [a, b, c]) { N[o] += nx; N[o + 1] += ny; N[o + 2] += nz; }
  }
  for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; }
  return N;
}

/**
 * Euclidean distance from every vertex to the boundary segments whose both
 * ends are flagged (smooth iso-lines, unlike graph distances). Vertices
 * further than `maxD` get maxD.
 */
export function distToEdges(P, loops, flag, maxD) {
  const n = P.length / 3, out = new Float64Array(n).fill(maxD);
  const segs = [];
  for (const lp of loops) for (let k = 0; k < lp.length; k++) { const a = lp[k], b = lp[(k + 1) % lp.length]; if (flag[a] && flag[b]) segs.push(a, b); }
  if (!segs.length) return out;
  const cs = maxD, grid = new Map();
  const key = (x, y, z) => ((Math.floor(x / cs) * 73856093) ^ (Math.floor(y / cs) * 19349663) ^ (Math.floor(z / cs) * 83492791));
  for (let s = 0; s < segs.length; s += 2) {
    const a = segs[s], b = segs[s + 1];
    const mx = (P[a * 3] + P[b * 3]) / 2, my = (P[a * 3 + 1] + P[b * 3 + 1]) / 2, mz = (P[a * 3 + 2] + P[b * 3 + 2]) / 2;
    const k = key(mx, my, mz); let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(s);
  }
  for (let i = 0; i < n; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    let best = maxD * maxD;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const l = grid.get(key(x + dx * cs, y + dy * cs, z + dz * cs)); if (!l) continue;
      for (const s of l) {
        const a = segs[s], b = segs[s + 1];
        const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
        const ux = P[b * 3] - ax, uy = P[b * 3 + 1] - ay, uz = P[b * 3 + 2] - az;
        const L2 = ux * ux + uy * uy + uz * uz || 1e-12;
        let t = ((x - ax) * ux + (y - ay) * uy + (z - az) * uz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = ax + ux * t - x, qy = ay + uy * t - y, qz = az + uz * t - z;
        const d2 = qx * qx + qy * qy + qz * qz;
        if (d2 < best) best = d2;
      }
    }
    out[i] = Math.sqrt(best);
  }
  return out;
}

/** Dijkstra distance along mesh edges from the flagged vertices. */
export function geodesic(P, I, src) {
  const n = P.length / 3;
  const adj = new Map();
  const addE = (a, b) => { let l = adj.get(a); if (!l) adj.set(a, l = []); l.push(b); };
  for (let t = 0; t < I.length; t += 3) for (let k = 0; k < 3; k++) { const a = I[t + k], b = I[t + (k + 1) % 3]; addE(a, b); addE(b, a); }
  const dist = new Float64Array(n).fill(1e9);
  const heap = new MinHeap();
  for (let i = 0; i < n; i++) if (src[i]) { dist[i] = 0; heap.push(0, i); }
  while (heap.size) {
    const [d, v] = heap.pop();
    if (d > dist[v]) continue;
    const l = adj.get(v); if (!l) continue;
    for (const w of l) {
      const e = Math.hypot(P[v * 3] - P[w * 3], P[v * 3 + 1] - P[w * 3 + 1], P[v * 3 + 2] - P[w * 3 + 2]);
      if (d + e < dist[w]) { dist[w] = d + e; heap.push(d + e, w); }
    }
  }
  return dist;
}
class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= k[i]) break; [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p; }
  }
  pop() {
    const k = this.k, v = this.v; const top = [k[0], v[0]]; const lk = k.pop(), lv = v.pop();
    if (k.length) {
      k[0] = lk; v[0] = lv; let i = 0;
      for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < k.length && k[l] < k[m]) m = l; if (r < k.length && k[r] < k[m]) m = r; if (m === i) break; [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m; }
    }
    return top;
  }
}

/** Duplicate vertices where triangles of different panels meet; per-panel UVs. */
function splitPanels(P, N, I, panelFn, uvFn) {
  const map = new Map();
  const oP = [], oN = [], oUV = [], src = [], oI = [];
  const triPanel = new Int16Array(I.length / 3);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    const cx = (P[a * 3] + P[b * 3] + P[c * 3]) / 3, cy = (P[a * 3 + 1] + P[b * 3 + 1] + P[c * 3 + 1]) / 3, cz = (P[a * 3 + 2] + P[b * 3 + 2] + P[c * 3 + 2]) / 3;
    const pn = panelFn(cx, cy, cz);
    triPanel[t / 3] = pn;
    const ref = [cx, cy, cz];
    for (const v of [a, b, c]) {
      // uv relative to the triangle (unwrapped across angular seams), keyed by its branch
      const uv = uvFn(pn, P[v * 3], P[v * 3 + 1], P[v * 3 + 2], ref);
      const key = (v * 64 + pn) * 4 + ((uv[2] || 0) + 1);
      let ni = map.get(key);
      if (ni === undefined) {
        ni = src.length; map.set(key, ni); src.push(v);
        oP.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); oN.push(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]);
        oUV.push(uv[0], uv[1]);
      }
      oI.push(ni);
    }
  }
  return { P: new Float32Array(oP), N: new Float32Array(oN), UV: new Float32Array(oUV), I: oI, src, triPanel };
}

/** Rounded rim joining the outer surface to the inner one along an opening. */
function rim(mb, P, N, loop, th, seg) {
  const n = loop.length;
  if (n < 3) return;
  const rows = [];
  let perim = 0;
  for (let k = 0; k < n; k++) { const a = loop[k], b = loop[(k + 1) % n]; perim += Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]); }
  for (let s = 0; s <= seg; s++) {
    const ang = Math.PI * s / seg;                 // 0 outer surface → π inner surface
    const row = [];
    let acc = 0;
    for (let k = 0; k < n; k++) {
      const v = loop[k], pv = loop[(k + n - 1) % n], nx = loop[(k + 1) % n];
      const p = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]], nn = [N[v * 3], N[v * 3 + 1], N[v * 3 + 2]];
      const tg = norm3([P[nx * 3] - P[pv * 3], P[nx * 3 + 1] - P[pv * 3 + 1], P[nx * 3 + 2] - P[pv * 3 + 2]]);
      const out = norm3(cross3(tg, nn));          // away from the garment, in its surface
      // semicircle of radius th/2 centred th/2 inside the surface
      const r = th / 2, cx = -r;
      const off = cx + r * Math.cos(ang), ou = r * Math.sin(ang) * (seg > 1 ? 1 : 0);
      const pos = [p[0] + nn[0] * off + out[0] * ou, p[1] + nn[1] * off + out[1] * ou, p[2] + nn[2] * off + out[2] * ou];
      const nr = seg > 1 ? norm3([nn[0] * Math.cos(ang) + out[0] * Math.sin(ang), nn[1] * Math.cos(ang) + out[1] * Math.sin(ang), nn[2] * Math.cos(ang) + out[2] * Math.sin(ang)]) : out;
      if (k > 0) { const q = loop[k - 1]; acc += Math.hypot(P[v * 3] - P[q * 3], P[v * 3 + 1] - P[q * 3 + 1], P[v * 3 + 2] - P[q * 3 + 2]); }
      row.push(mb.vert(pos, nr, [acc, th * s / seg], v, 2));
    }
    rows.push(row);
  }
  void perim;
  for (let s = 0; s < seg; s++) for (let k = 0; k < n; k++) {
    const a = rows[s][k], b = rows[s][(k + 1) % n], c2 = rows[s + 1][(k + 1) % n], d = rows[s + 1][k];
    mb.quadOriented(a, b, c2, d);
  }
}
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm3 = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** Growable geometry with a "layer" tag per vertex (0 outer, 1 inner, 2 rim) and source vertex. */
class Geo {
  constructor() { this.p = []; this.n = []; this.uv = []; this.i = []; this.src = []; this.layer = []; }
  get count() { return this.p.length / 3; }
  vert(p, n, uv, src, layer) { this.p.push(p[0], p[1], p[2]); this.n.push(n[0], n[1], n[2]); this.uv.push(uv[0], uv[1]); this.src.push(src); this.layer.push(layer); return this.count - 1; }
  append(P, N, UV, I, src, layer) {
    const base = this.count;
    for (let i = 0; i < P.length; i++) this.p.push(P[i]);
    for (let i = 0; i < N.length; i++) this.n.push(N[i]);
    for (let i = 0; i < UV.length; i++) this.uv.push(UV[i]);
    for (const s of src) { this.src.push(s); this.layer.push(layer); }
    for (const i of I) this.i.push(i + base);
  }
  /** Quad whose winding agrees with its vertex normals. */
  quadOriented(a, b, c, d) {
    const P = this.p, N = this.n;
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
    const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const s = nx * (N[a * 3] + N[c * 3]) + ny * (N[a * 3 + 1] + N[c * 3 + 1]) + nz * (N[a * 3 + 2] + N[c * 3 + 2]);
    if (s >= 0) this.i.push(a, b, c, a, c, d); else this.i.push(a, c, b, a, d, c);
  }
  build() {
    return {
      position: new Float32Array(this.p), normal: new Float32Array(this.n), uv: new Float32Array(this.uv),
      index: new Uint32Array(this.i), source: Int32Array.from(this.src), layer: Uint8Array.from(this.layer),
    };
  }
}
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
