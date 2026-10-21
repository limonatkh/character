/* =====================================================================
 * CLIP A MESH BY A SCALAR FIELD (keep where value < 0) with clean edges:
 * triangles crossing the zero level are split, so garment hems, necklines
 * and cuffs follow smooth curves instead of the triangle grid. Also
 * extracts the boundary loops (for hems, rims, cuffs, collars).
 * ===================================================================== */

/**
 * @param P positions (Float32Array), N normals, I indices
 * @param value per-vertex scalar (Float32Array) — keep < 0
 * @param refine optional (pA, pB, vA, vB) => [x, y, z] exact edge crossing
 * @returns { positions, normals, indices, onEdge: Uint8Array (1 = boundary vertex) }
 */
export function clipMesh(P, N, I, value, refine = null) {
  const pos = Array.from(P), nor = Array.from(N);
  const onEdge = [];
  for (let i = 0; i < P.length / 3; i++) onEdge.push(0);
  const out = [];
  const edgeMap = new Map();
  const cut = (a, b) => {
    const key = a < b ? a * 4194304 + b : b * 4194304 + a;
    let v = edgeMap.get(key);
    if (v !== undefined) return v;
    const va = value[a], vb = value[b], t = va / (va - vb);
    let p = [P[a * 3] + (P[b * 3] - P[a * 3]) * t, P[a * 3 + 1] + (P[b * 3 + 1] - P[a * 3 + 1]) * t, P[a * 3 + 2] + (P[b * 3 + 2] - P[a * 3 + 2]) * t];
    if (refine) p = refine([P[a * 3], P[a * 3 + 1], P[a * 3 + 2]], [P[b * 3], P[b * 3 + 1], P[b * 3 + 2]], va, vb, p);
    const n = [N[a * 3] + (N[b * 3] - N[a * 3]) * t, N[a * 3 + 1] + (N[b * 3 + 1] - N[a * 3 + 1]) * t, N[a * 3 + 2] + (N[b * 3 + 2] - N[a * 3 + 2]) * t];
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    v = pos.length / 3;
    pos.push(p[0], p[1], p[2]); nor.push(n[0] / l, n[1] / l, n[2] / l); onEdge.push(1);
    edgeMap.set(key, v);
    return v;
  };
  for (let t = 0; t < I.length; t += 3) {
    const tri = [I[t], I[t + 1], I[t + 2]];
    const inside = tri.map(i => value[i] < 0);
    const n = inside.filter(Boolean).length;
    if (n === 3) { out.push(...tri); continue; }
    if (n === 0) continue;
    // rotate so the pattern starts at a consistent vertex (keeps winding)
    for (let r = 0; r < 3; r++) {
      const a = tri[r], b = tri[(r + 1) % 3], c = tri[(r + 2) % 3];
      const ia = inside[r], ib = inside[(r + 1) % 3], ic = inside[(r + 2) % 3];
      if (n === 1 && ia) { out.push(a, cut(a, b), cut(a, c)); break; }
      if (n === 2 && ia && ib && !ic) { const ac = cut(a, c), bc = cut(b, c); out.push(a, b, bc, a, bc, ac); break; }
    }
  }
  // compact
  const used = new Int32Array(pos.length / 3).fill(-1);
  let k = 0;
  for (const i of out) if (used[i] < 0) used[i] = k++;
  const positions = new Float32Array(k * 3), normals = new Float32Array(k * 3), edge = new Uint8Array(k);
  for (let i = 0; i < used.length; i++) {
    const j = used[i];
    if (j < 0) continue;
    positions.set([pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], j * 3);
    normals.set([nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]], j * 3);
    edge[j] = onEdge[i];
  }
  const indices = new Uint32Array(out.length);
  for (let i = 0; i < out.length; i++) indices[i] = used[out[i]];
  return { positions, normals, indices, onEdge: edge, sourceIndex: used };
}

/** Boundary loops of an open mesh: arrays of vertex indices (ordered, following the triangle winding). */
export function boundaryLoops(I) {
  let nV = 0;
  for (let i = 0; i < I.length; i++) if (I[i] + 1 > nV) nV = I[i] + 1;
  // CSR adjacency of directed edges a → b
  const deg = new Int32Array(nV + 1);
  for (let t = 0; t < I.length; t += 3) for (let k = 0; k < 3; k++) deg[I[t + k] + 1]++;
  for (let i = 0; i < nV; i++) deg[i + 1] += deg[i];
  const fill = deg.slice(0, nV), to = new Int32Array(I.length);
  for (let t = 0; t < I.length; t += 3) for (let k = 0; k < 3; k++) { const a = I[t + k], b = I[t + (k + 1) % 3]; to[fill[a]++] = b; }
  const has = (a, b) => { for (let j = deg[a]; j < deg[a + 1]; j++) if (to[j] === b) return true; return false; };
  // a directed edge a → b is on the boundary when b → a does not exist
  const next = new Int32Array(nV).fill(-1);
  for (let a = 0; a < nV; a++) for (let j = deg[a]; j < deg[a + 1]; j++) { const b = to[j]; if (!has(b, a)) next[a] = b; }
  const loops = [], seen = new Uint8Array(nV);
  for (let s = 0; s < nV; s++) {
    if (next[s] < 0 || seen[s]) continue;
    const loop = [];
    let v = s, guard = 0;
    while (v >= 0 && !seen[v] && guard++ < 1000000) { seen[v] = 1; loop.push(v); v = next[v]; }
    if (loop.length > 2) loops.push(loop);
  }
  return loops;
}

/** Remove tiny disconnected pieces (fewer than `minTris` triangles). */
export function dropSmallIslands(I, nVerts, minTris) {
  const parent = new Int32Array(nVerts).map((_, i) => i);
  const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (let t = 0; t < I.length; t += 3) { const a = find(I[t]), b = find(I[t + 1]), c = find(I[t + 2]); parent[b] = a; parent[find(c)] = a; }
  const size = new Map();
  for (let t = 0; t < I.length; t += 3) { const r = find(I[t]); size.set(r, (size.get(r) || 0) + 1); }
  const out = [];
  for (let t = 0; t < I.length; t += 3) if (size.get(find(I[t])) >= minTris) out.push(I[t], I[t + 1], I[t + 2]);
  return Uint32Array.from(out);
}

/**
 * Split triangles along the zero level of `value` WITHOUT removing anything:
 * both sides are kept and the iso-line becomes a clean polyline of edges
 * (crisp band edges, panel boundaries, colour blocking).
 * attrs: [{ array, size }] per-vertex arrays interpolated onto new vertices.
 * Returns { P, I, attrs: [arrays], value }.
 */
export function splitAlong(P, I, value, attrs = []) {
  const pos = Array.from(P), val = Array.from(value);
  const arrs = attrs.map(a => Array.from(a.array));
  const edgeMap = new Map();
  const cut = (a, b) => {
    const key = a < b ? a * 4194304 + b : b * 4194304 + a;
    let v = edgeMap.get(key);
    if (v !== undefined) return v;
    const t = val[a] / (val[a] - val[b]);
    v = pos.length / 3;
    for (let k = 0; k < 3; k++) pos.push(pos[a * 3 + k] + (pos[b * 3 + k] - pos[a * 3 + k]) * t);
    val.push(0);
    attrs.forEach((at, j) => { for (let k = 0; k < at.size; k++) arrs[j].push(arrs[j][a * at.size + k] + (arrs[j][b * at.size + k] - arrs[j][a * at.size + k]) * t); });
    edgeMap.set(key, v);
    return v;
  };
  const out = [];
  for (let t = 0; t < I.length; t += 3) {
    const tri = [I[t], I[t + 1], I[t + 2]];
    const neg = tri.map(i => val[i] < 0);
    const n = neg.filter(Boolean).length;
    if (n === 0 || n === 3) { out.push(...tri); continue; }
    for (let r = 0; r < 3; r++) {
      const a = tri[r], b = tri[(r + 1) % 3], c = tri[(r + 2) % 3];
      // the lone vertex (on its own side) is a
      const lone = n === 1 ? neg[r] : !neg[r];
      if (!lone) continue;
      const ab = cut(a, b), ac = cut(a, c);
      out.push(a, ab, ac, ab, b, c, ab, c, ac);
      break;
    }
  }
  return { P: new Float32Array(pos), I: Uint32Array.from(out), attrs: arrs.map((a, j) => (attrs[j].array instanceof Float64Array ? Float64Array.from(a) : Float32Array.from(a))), value: Float32Array.from(val) };
}
