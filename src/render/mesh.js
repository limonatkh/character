/* =====================================================================
 * MODEL → THREE.JS RIG
 *
 * Builds a real rigged character from a compiled voxel model:
 *   - one THREE.Bone per standard joint (VRM humanoid names)
 *   - one SkinnedMesh per material type, every vertex weighted 100% to
 *     its joint (rigid voxel parts, works in every engine)
 *   - a black "inverted hull" SkinnedMesh for the Limonat ink outline
 *     (reversed winding, so it also renders correctly in any glTF viewer)
 *   - empty nodes "attach_<point>" under bones for accessories / weapons
 * The same function feeds the live preview and the GLB exporter.
 * ===================================================================== */
import * as THREE from 'three';
import { PX, OUTLINE_PX, MATERIALS, BRIGHTNESS, INK } from '../core/constants.js';
import { JOINT_INDEX } from '../core/skeleton.js';

// unit-cube faces: normal, corners, shading slot (same layout as Limonat's VoxelBuilder)
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], s: 'side' },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], s: 'side' },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 'top' },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 'bottom' },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], s: 'side' },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], s: 'side' },
];

function newBucket() { return { pos: [], nor: [], col: [], si: [], sw: [], idx: [], n: 0 }; }

function pushBox(B, x, y, z, w, h, d, faceColors, joint, invert) {
  for (const f of FACES) {
    const col = faceColors ? faceColors[f.s] : null;
    for (const c of f.c) {
      B.pos.push((x + c[0] * w) * PX, (y + c[1] * h) * PX, (z + c[2] * d) * PX);
      B.nor.push(invert ? -f.n[0] : f.n[0], invert ? -f.n[1] : f.n[1], invert ? -f.n[2] : f.n[2]);
      if (col) B.col.push(col[0], col[1], col[2]);
      B.si.push(joint, 0, 0, 0);
      B.sw.push(1, 0, 0, 0);
    }
    const n = B.n;
    if (invert) B.idx.push(n, n + 2, n + 1, n, n + 3, n + 2);
    else B.idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
    B.n += 4;
  }
}

function toGeometry(B) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(B.nor, 3));
  if (B.col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(B.col, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(B.si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(B.sw, 4));
  g.setIndex(B.n > 65535 ? new THREE.Uint32BufferAttribute(B.idx, 1) : new THREE.Uint16BufferAttribute(B.idx, 1));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

const tmp = new THREE.Color();
/** Linear-space vertex colours per face slot. flat = Limonat baked shading, pbr = plain colour. */
function faceColors(hex, matId, shading) {
  tmp.setStyle(hex);               // sRGB hex → linear working colour
  const lin = [tmp.r, tmp.g, tmp.b];
  const mat = MATERIALS[matId] || MATERIALS.cloth;
  const out = {};
  for (const slot of ['top', 'side', 'bottom']) {
    const k = shading === 'flat' ? mat.shade[slot] * BRIGHTNESS : 1;
    out[slot] = lin.map(v => Math.min(1, v * k));
  }
  return out;
}

function makeMaterial(matId, shading) {
  const def = MATERIALS[matId] || MATERIALS.cloth;
  let m;
  if (shading === 'flat' || def.emissive) {
    m = new THREE.MeshBasicMaterial({ vertexColors: true });          // exported as KHR_materials_unlit
  } else {
    m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: def.roughness, metalness: def.metalness });
  }
  m.name = 'mat_' + matId;
  return m;
}

/**
 * @param model  output of compile()
 * @param opts   { shading: 'flat' | 'pbr', outline: true, name }
 * @returns { root, armature, skeleton, bones, meshes, dispose() }
 */
export function buildCharacterObject(model, opts = {}) {
  const shading = opts.shading || 'flat';
  const root = new THREE.Group();
  root.name = opts.name || 'LimonatCharacter';

  // ---- skeleton
  const bones = {}, boneList = [], posOf = {};
  for (const j of model.joints) posOf[j.name] = j.pos;
  for (const j of model.joints) {
    const b = new THREE.Bone();
    b.name = j.name;
    const pp = j.parent ? posOf[j.parent] : [0, 0, 0];
    b.position.set((j.pos[0] - pp[0]) * PX, (j.pos[1] - pp[1]) * PX, (j.pos[2] - pp[2]) * PX);
    if (j.parent) bones[j.parent].add(b);
    bones[j.name] = b;
    boneList.push(b);
  }
  const armature = new THREE.Group();
  armature.name = 'Armature';
  armature.add(bones.hips);
  root.add(armature);
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(boneList);

  // ---- attachment points
  for (const [id, a] of Object.entries(model.attachments || {})) {
    const o = new THREE.Object3D();
    o.name = 'attach_' + id;
    const jp = posOf[a.joint];
    o.position.set((a.pos[0] - jp[0]) * PX, (a.pos[1] - jp[1]) * PX, (a.pos[2] - jp[2]) * PX);
    o.userData = { attachPoint: id };
    bones[a.joint].add(o);
  }

  // ---- geometry (one bucket per material type) + outline hull
  const buckets = {}, outline = newBucket(), t = OUTLINE_PX;
  const colorCache = {};
  for (const b of model.boxes) {
    const pal = model.palette[b.key];
    const matId = pal.material || 'cloth';
    const ck = pal.hex + '|' + matId;
    const fc = colorCache[ck] || (colorCache[ck] = faceColors(pal.hex, matId, shading));
    const ji = JOINT_INDEX[b.joint];
    pushBox(buckets[matId] || (buckets[matId] = newBucket()), b.x, b.y, b.z, b.w, b.h, b.d, fc, ji, false);
    if (opts.outline !== false && pal.outline) pushBox(outline, b.x - t, b.y - t, b.z - t, b.w + 2 * t, b.h + 2 * t, b.d + 2 * t, null, ji, true);
  }

  const meshes = [];
  const addMesh = (name, geometry, material) => {
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.name = name;
    mesh.frustumCulled = false;
    root.add(mesh);
    mesh.bind(skeleton, mesh.matrixWorld);
    meshes.push(mesh);
  };
  for (const matId of Object.keys(buckets).sort()) addMesh('voxels_' + matId, toGeometry(buckets[matId]), makeMaterial(matId, shading));
  if (outline.n) {
    const inkMat = new THREE.MeshBasicMaterial({ color: INK });
    inkMat.name = 'mat_ink_outline';
    addMesh('ink_outline', toGeometry(outline), inkMat);
  }

  return {
    root, armature, skeleton, bones, meshes,
    dispose() { for (const m of meshes) { m.geometry.dispose(); m.material.dispose(); } skeleton.dispose(); },
  };
}

/** Triangle / vertex counts for the export panel. */
export function meshStats(obj) {
  let tris = 0, verts = 0;
  for (const m of obj.meshes) { tris += m.geometry.index.count / 3; verts += m.geometry.attributes.position.count; }
  return { tris, verts, bones: obj.skeleton.bones.length, meshes: obj.meshes.length };
}
