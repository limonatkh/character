/* =====================================================================
 * ACCESSORY HELPERS: head coordinates, hair thickness, skin weights for
 * worn items, hair hidden under hats and head coverings.
 * ===================================================================== */
import { skinWeights } from '../mesh/attributes.js';
import { projectTo } from '../mesh/builder.js';
import { BONE_INDEX } from '../core/skeleton.js';

export const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Azimuth around the cranium (0 = front, + toward the character's right, ±π back). */
export function headAz(m, x, z) { return Math.atan2(x - m.cranium.c[0], -(z - m.cranium.c[2])); }

/**
 * Height of a head band line at azimuth `az`.
 * levels: { front, side, back } in metres relative to: front → brow line, side → top of the ear, back → nape.
 */
export function bandY(m, az, levels) {
  const S = m.S, a = Math.abs(az);
  const front = m.browY + levels.front * S, side = m.ears[0].top[1] + levels.side * S, back = m.napeY + levels.back * S;
  return a < Math.PI / 2 ? front + (side - front) * ss(0.15, Math.PI / 2, a) : side + (back - side) * ss(Math.PI / 2, Math.PI - 0.15, a);
}

/** How far the hair stands off the scalp above a height (robust high percentile, metres). */
export function hairThickness(hairParts, field, yMin, S) {
  const ds = [];
  for (const p of hairParts || []) {
    const P = p.geometry.position;
    const step = Math.max(3, Math.floor(P.length / 3 / 4000)) * 3;
    for (let i = 0; i < P.length; i += step) {
      if (P[i + 1] < yMin) continue;
      const d = field.eval(P[i], P[i + 1], P[i + 2]);
      if (d > 0 && d < 0.12 * S) ds.push(d);
    }
  }
  if (!ds.length) return 0;
  ds.sort((a, b) => a - b);
  return ds[Math.floor(ds.length * 0.92)];
}

/** Remove hair triangles whose three corners are inside `inside(p)` (hair under hats). */
export function clipHairParts(parts, inside) {
  return parts.map(p => {
    const g = p.geometry, P = g.position, I = g.index;
    const keep = [];
    const inn = new Uint8Array(P.length / 3);
    for (let i = 0; i < inn.length; i++) inn[i] = inside(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]) ? 1 : 0;
    for (let t = 0; t < I.length; t += 3) if (!(inn[I[t]] && inn[I[t + 1]] && inn[I[t + 2]])) keep.push(I[t], I[t + 1], I[t + 2]);
    if (keep.length === I.length) return p;
    return { ...p, geometry: { ...g, index: Uint32Array.from(keep) } };
  }).filter(p => p.geometry.index.length);
}

/** Skin weights for items that follow the body (necklaces, straps, belts, drapes). */
export function bodyWeights(positions, sf, S) {
  const n = positions.length / 3, probe = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const q = projectTo(sf.farField || sf.field, [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]], 0, 4);
    probe[i * 3] = q[0]; probe[i * 3 + 1] = q[1]; probe[i * 3 + 2] = q[2];
  }
  const w = skinWeights(probe, sf.field, { sigmaMin: 0.012 * S });
  return { skinIndex: w.skinIndex, skinWeight: w.skinWeight };
}
/** Rigid attachment to one bone. */
export function rigidWeights(n, bone) {
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  const b = typeof bone === 'number' ? bone : BONE_INDEX[bone] ?? 0;
  for (let i = 0; i < n; i++) { si[i * 4] = b; sw[i * 4] = 1; }
  return { skinIndex: si, skinWeight: sw };
}
