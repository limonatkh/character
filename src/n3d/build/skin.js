/* =====================================================================
 * SKIN: body + head distance field → meshed, rigged skin surface.
 * Output groups: 'head' (face material, cylindrical head UVs for decals)
 * and 'body' (tiling skin detail UVs). Both share positions/normals at the
 * neck boundary, so there is no visible seam.
 * ===================================================================== */
import { Field, UNION, SUBTRACT } from '../sdf/field.js';
import { contour, zonedCellSize } from '../mesh/octree.js';
import { skinWeights, splitGroups, cylindricalUV, boneUV } from '../mesh/attributes.js';
import { buildBody } from '../anatomy/body.js';
import { buildHead } from '../anatomy/head.js';
import { BONE_NAMES, BONE_INDEX, BONES } from '../core/skeleton.js';
import { TAG } from '../anatomy/tags.js';

export const CHILD_OF = (() => {
  const m = {};
  for (const b of BONES) if (b.parent && !m[b.parent]) m[b.parent] = b.name;
  m.head = null; m.hips = 'spine';
  for (const s of ['left', 'right']) {
    m[s + 'Hand'] = s + 'MiddleProximal';
    for (const f of ['Thumb', 'Index', 'Middle', 'Ring', 'Little']) m[s + f + 'Distal'] = '_' + s + f + 'Tip';
    m[s + 'Toes'] = null; m[s + 'Foot'] = s + 'Toes';
  }
  return m;
})();
const HEAD_BONES = new Set([BONE_INDEX.head, BONE_INDEX.jaw, BONE_INDEX.leftEye, BONE_INDEX.rightEye]);

/** Build the anatomy field (no meshing). */
export function skinField(rig, face) {
  const body = buildBody(rig);
  const head = buildHead(rig, face);
  const layers = () => [
    { op: UNION, prims: [...body.union, ...head.union] },
    { op: SUBTRACT, prims: [...body.subtract, ...head.subtract] },
    { op: UNION, prims: head.late },
    { op: SUBTRACT, prims: head.lateSubtract },
  ];
  const field = new Field(layers(), { cell: 0.025 * rig.H / 1.75, margin: 0.015 });
  // the same body with exact distances up to ~16 cm away (and a ≥ 16 cm lower bound beyond), so even
  // outer layers (coats over sweaters) sit on an exact, continuous field:
  // garments, hair and accessories sit on it
  const farField = new Field(layers(), { cell: 0.025 * rig.H / 1.75, margin: 0.16 * rig.H / 1.75 });
  return { field, farField, body, head };
}

/**
 * Mesh the skin.
 * @param D detail level object (core/detail.js)
 */
export function meshSkin(rig, sf, D, opts = {}) {
  const { field, head } = sf;
  const J = rig.joints, H = rig.H;
  const hm = head.marks;
  const faceC = [0, hm.eyes[0].center[1] - 0.02 * hm.S, hm.eyes[0].center[2] + 0.01 * hm.S];
  const featC = [0, (hm.noseTip[1] + hm.mouth[1]) / 2, hm.noseTip[2] + 0.01 * hm.S];
  const zones = [
    { c: featC, r: 0.032 * hm.S, cell: D.face * 0.72 },
    ...hm.eyes.map(e => ({ c: e.center, r: e.radius * 1.9, cell: D.face * 0.72 })),
    { c: faceC, r: 0.07 * hm.S, cell: D.face },
    { c: [0, hm.cranium.c[1] - 0.02 * hm.S, hm.cranium.c[2]], r: 0.13 * hm.S, cell: D.head },
    ...hm.ears.map(e => ({ c: e.c, r: 0.04 * hm.S, cell: D.face * 1.15 })),
  ];
  for (const s of ['left', 'right']) {
    const hc = J[s + 'MiddleProximal'];
    zones.push({ c: hc, r: rig.dim.handLen * 0.75, cell: D.hands });
    zones.push({ c: [J[s + 'Toes'][0], 0.03, J[s + 'Toes'][2] + 0.02], r: rig.dim.footLen * 0.55, cell: D.feet });
  }
  const b = field.bounds;
  const size = Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) + 0.02;
  const finest = Math.min(D.face, D.hands);
  const maxDepth = Math.ceil(Math.log2(size / finest));
  const rootSize = finest * (1 << maxDepth);
  const cx = (b.min[0] + b.max[0]) / 2, cy = (b.min[1] + b.max[1]) / 2, cz = (b.min[2] + b.max[2]) / 2;
  const mesh = contour(field, {
    min: [cx - rootSize / 2, cy - rootSize / 2, cz - rootSize / 2], size: rootSize, maxDepth,
    cellSizeAt: zonedCellSize(D.body, zones, 0.05 * H / 1.75), relax: D.relax,
  });
  const P = mesh.positions, N = mesh.normals, I = mesh.indices;
  const w = skinWeights(P, field, { sigmaMin: 0.003 });

  // vertex colours: lips, nails (multiplied with the skin colour in the material)
  const n = P.length / 3;
  const regions = new Float32Array(n * 3);      // r = lips, g = nails, b = reserved
  for (let i = 0; i < n; i++) {
    regions[i * 3] = w.tags[i] === TAG.LIPS ? 1 : 0;
    regions[i * 3 + 1] = w.tags[i] === TAG.NAIL ? 1 : 0;
  }
  smoothAttr(regions, I, 3, 2);

  // groups: head (face material) vs body
  const isHead = new Uint8Array(n);
  for (let i = 0; i < n; i++) isHead[i] = HEAD_BONES.has(w.dominant[i]) && P[i * 3 + 1] > J.neck[1] + 0.25 * (J.head[1] - J.neck[1]) ? 1 : 0;
  // head UVs: cylinder around the head's vertical axis, face front at u = 0.5
  const hc = [0, hm.cranium.c[1], hm.cranium.c[2] - 0.01 * hm.S];
  const headUV = cylindricalUV(P, [0, rig.dim.chinY - 0.03 * hm.S, hc[2]], [0, 1, 0], [0, 0, -1], { v0: 0, vSpan: rig.dim.headH + 0.06 * hm.S });
  const detailUV = boneUV(P, N, w.dominant, J, BONE_NAMES, CHILD_OF);
  const uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { if (isHead[i]) { uv[i * 2] = headUV[i * 2]; uv[i * 2 + 1] = headUV[i * 2 + 1]; } else { uv[i * 2] = detailUV[i * 2]; uv[i * 2 + 1] = detailUV[i * 2 + 1]; } }
  const attrs = {
    position: { array: P, itemSize: 3 }, normal: { array: N, itemSize: 3 }, uv: { array: uv, itemSize: 2 }, uv1: { array: detailUV, itemSize: 2 },
    skinIndex: { array: w.skinIndex, itemSize: 4 }, skinWeight: { array: w.skinWeight, itemSize: 4 }, region: { array: regions, itemSize: 3 },
  };
  const hide = opts.hideTri || null;
  const groups = splitGroups(I, attrs, (a, b2, c) => {
    if (hide && hide(a, b2, c)) return null;
    return (isHead[a] + isHead[b2] + isHead[c]) >= 2 ? 'head' : 'body';
  });
  // head UV parameters (the face texture painter maps landmarks with the same projection)
  const headUVParams = { o: [0, rig.dim.chinY - 0.03 * hm.S, hc[2]], vSpan: rig.dim.headH + 0.06 * hm.S };
  return { groups, attrs, headUV: headUVParams, stats: mesh.stats, raw: { positions: P, normals: N, indices: I, weights: w, isHead } };
}

/** Average a per-vertex attribute over neighbours (soft region edges). */
function smoothAttr(A, I, size, passes) {
  const n = A.length / size;
  for (let p = 0; p < passes; p++) {
    const sum = new Float32Array(A.length), cnt = new Uint16Array(n);
    for (let t = 0; t < I.length; t += 3) for (let k = 0; k < 3; k++) {
      const a = I[t + k];
      for (let j = 0; j < 3; j++) { const b = I[t + j]; for (let c = 0; c < size; c++) sum[a * size + c] += A[b * size + c]; }
      cnt[a] += 3;
    }
    for (let i = 0; i < n; i++) if (cnt[i]) for (let c = 0; c < size; c++) A[i * size + c] = sum[i * size + c] / cnt[i];
  }
}
