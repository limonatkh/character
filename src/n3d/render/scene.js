/* =====================================================================
 * NORMAL 3D → THREE.JS
 * Turns a build result (plain arrays + material descriptions) into a
 * Three.js group with PBR materials: skin, eyes, hair cards and strands,
 * fabrics with weave normal maps and patterns, hardware, thread, rubber.
 * Materials are cached by description, so rebuilding a character reuses
 * every texture and shader.
 * ===================================================================== */
import * as THREE from 'three';
import { weaveNormal, WEAVE_TILE, patternMap, hairStrip, hairMass, irisMap, skinDetailNormal } from './textures.js';
import { paintFace, FACE_BASE } from './face-texture.js';
import { makeSkeleton, rigidSkin } from './skeleton3.js';
import { BONE_INDEX } from '../core/skeleton.js';

const matCache = new Map();
const texCache = new WeakMap();
function tex(canvas, repeat, srgb = false) {
  let base = texCache.get(canvas);
  if (!base) { base = new THREE.CanvasTexture(canvas); base.wrapS = base.wrapT = THREE.RepeatWrapping; base.anisotropy = 4; if (srgb) base.colorSpace = THREE.SRGBColorSpace; texCache.set(canvas, base); }
  if (!repeat) return base;
  const t = base.clone(); t.needsUpdate = true; t.repeat.set(repeat, repeat); return t;
}

/** Material for a description (cached). */
export function material(desc, opts = {}) {
  const key = JSON.stringify(desc) + (opts.wire ? ':w' : '') + (opts.mode || '');
  const hit = matCache.get(key);
  if (hit) return hit;
  let m;
  const wire = !!opts.wire;
  switch (desc.kind) {
    case 'skin': {
      const common = { vertexColors: true, roughness: desc.roughness ?? 0.52, sheen: 0.25, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffd9c8'), wireframe: wire };
      if (desc.part === 'head' && opts.face) {
        const f = paintFace(desc.details || {}, opts.face.marks, opts.face.uv);
        const map = tex(f.color); map.colorSpace = THREE.NoColorSpace; map.wrapS = THREE.RepeatWrapping; map.wrapT = THREE.ClampToEdgeWrapping;
        const nm = tex(f.normal); nm.wrapT = THREE.ClampToEdgeWrapping;
        m = new THREE.MeshPhysicalMaterial({ ...common, map, normalMap: nm, normalScale: new THREE.Vector2(0.35, 0.35) });
      } else m = new THREE.MeshPhysicalMaterial({ ...common, normalMap: tex(skinDetailNormal(), 40), normalScale: new THREE.Vector2(0.25, 0.25) });
      break;
    }
    case 'facialHair':
      m = new THREE.MeshStandardMaterial({ color: desc.color, vertexColors: true, side: THREE.DoubleSide, roughness: 0.75, wireframe: wire });
      break;
    case 'eye':
      m = new THREE.MeshPhysicalMaterial({ map: tex(irisMap(desc.iris, desc.sclera || '#F2EEE6', desc.pupil || 1), 0, true), roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02, wireframe: wire });
      break;
    case 'lashes': case 'brows':
      m = new THREE.MeshStandardMaterial({ color: desc.color, side: THREE.DoubleSide, roughness: 0.75, vertexColors: desc.kind === 'brows', wireframe: wire });
      break;
    case 'hair': {
      // hair: low specular, a soft sheen and anisotropic highlights along the strands
      const gloss = desc.gloss ?? 0.35;
      const common = { vertexColors: true, metalness: 0, roughness: 0.6 - 0.3 * gloss, specularIntensity: 0.35 + 0.35 * gloss, sheen: 0.12, sheenRoughness: 0.5, sheenColor: new THREE.Color('#8a8a8a'), wireframe: wire };
      if (desc.rep === 'mass') {
        const hm = hairMass(desc.texture === 'buzz' ? 'buzz' : desc.massKind || 'straight');
        const map = new THREE.CanvasTexture(hm.color); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(1 / hm.tile[0], 1 / hm.tile[1]); map.anisotropy = 4;
        const nm = new THREE.CanvasTexture(hm.normal); nm.wrapS = nm.wrapT = THREE.RepeatWrapping; nm.repeat.copy(map.repeat); nm.anisotropy = 4;
        m = new THREE.MeshPhysicalMaterial({ ...common, map, normalMap: nm, normalScale: new THREE.Vector2(0.9, 0.9), anisotropy: 0.6, anisotropyRotation: Math.PI / 2 });
      } else {
        const alpha = desc.alpha;
        m = new THREE.MeshPhysicalMaterial({ ...common, side: THREE.DoubleSide, ...(alpha ? { alphaMap: tex(hairStrip('cards')), alphaTest: 0.35 } : {}) });
      }
      break;
    }
    case 'hardware':
      m = new THREE.MeshStandardMaterial({ color: desc.color, metalness: desc.metalness ?? 0, roughness: desc.roughness ?? 0.4, wireframe: wire });
      break;
    case 'thread':
      m = new THREE.MeshStandardMaterial({ color: desc.color, roughness: 0.8, side: THREE.DoubleSide, wireframe: wire, polygonOffset: true, polygonOffsetFactor: -1 });
      break;
    case 'glass':
      m = new THREE.MeshPhysicalMaterial({ color: desc.color, roughness: 0.04, metalness: 0, transparent: true, opacity: desc.opacity ?? 0.3, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false, wireframe: wire });
      break;
    case 'rubber':
      m = new THREE.MeshStandardMaterial({ color: desc.color, roughness: desc.roughness ?? 0.8, wireframe: wire });
      break;
    case 'fabric': default: {
      const pm = patternMap(desc.pattern, { main: desc.color, secondary: desc.secondary, accent: desc.accent }, desc.patternScale || 1, desc.wear || 0, 512);
      const weave = desc.weave || 'plain';
      const tileM = Math.max(0.01, (desc.scale || 0.002) * (WEAVE_TILE[weave] || 20));
      m = new THREE.MeshPhysicalMaterial({
        color: pm ? '#ffffff' : desc.color, map: pm ? tex(pm.canvas, 1 / pm.metres, true) : null,
        normalMap: tex(weaveNormal(weave), 1 / tileM), normalScale: new THREE.Vector2(0.6, 0.6),
        roughness: desc.roughness ?? 0.85, sheen: desc.sheen ?? 0.2, sheenRoughness: desc.sheenRoughness ?? 0.6, sheenColor: new THREE.Color(desc.color).lerp(new THREE.Color('#ffffff'), 0.4),
        clearcoat: desc.clearcoat || 0, transparent: (desc.opacity ?? 1) < 1, opacity: desc.opacity ?? 1, wireframe: wire,
      });
    }
  }
  m.userData.desc = desc;
  matCache.set(key, m);
  return m;
}

/**
 * Vertex colours for the skin: tone, undertone, lips, nails, beard shadow,
 * blush, eye shadow and eyeliner (exported as COLOR_0 too).
 */
export function skinColors(geo, desc, scale = 1) {
  const n = geo.position.length / 3, col = new Float32Array(n * 3);
  const base = new THREE.Color(desc.tone);
  if (desc.undertone) { const hsl = {}; base.getHSL(hsl); base.setHSL(hsl.h + desc.undertone * 0.012, Math.min(1, hsl.s * (1 + desc.undertone * 0.15)), hsl.l); }
  const lip = new THREE.Color(desc.lip || '#B5655F'), nail = base.clone().lerp(new THREE.Color('#F4D6CC'), 0.55), tmp = new THREE.Color();
  const beard = base.clone().multiply(new THREE.Color(desc.beard || '#2B1E16').lerp(new THREE.Color('#6a7a8a'), 0.35)).multiplyScalar(1.6);
  const blush = new THREE.Color(desc.blush || '#D9776B'), shadow = new THREE.Color(desc.eyeShadow || '#6E5A7E'), liner = new THREE.Color('#141110');
  const reg = geo.region, det = geo.detail;
  for (let i = 0; i < n; i++) {
    tmp.copy(base);
    if (reg) { tmp.lerp(lip, reg[i * 3] * (0.25 + 0.6 * (desc.lipAmount ?? 0.35))); tmp.lerp(nail, reg[i * 3 + 1] * 0.7); }
    if (det) {
      if (det[i * 4]) tmp.lerp(beard, Math.min(1, det[i * 4]) * 0.55);
      if (det[i * 4 + 1] && desc.blushAmount) tmp.lerp(blush, det[i * 4 + 1] * desc.blushAmount * 0.45);
      if (det[i * 4 + 2] && desc.eyeShadowAmount) tmp.lerp(shadow, det[i * 4 + 2] * desc.eyeShadowAmount * 0.6);
      if (det[i * 4 + 3] && desc.eyeliner) tmp.lerp(liner, det[i * 4 + 3] * desc.eyeliner * 0.85);
    }
    col[i * 3] = tmp.r * scale; col[i * 3 + 1] = tmp.g * scale; col[i * 3 + 2] = tmp.b * scale;
  }
  return col;
}

/** Build a THREE.Group from a build result.
 * opts: { wire, mode: 'pbr' | 'clay' | 'normals' | 'uv' | 'materials', skinned: bool, geoCache: Map }
 * Returns the group; group.userData.skeleton is set when skinned. */
export function buildScene(res, opts = {}) {
  opts = { ...opts, face: res.faceUV ? { marks: res.marks.head, uv: res.faceUV } : null };
  const root = new THREE.Group();
  root.name = res.doc?.meta?.name || 'character';
  const body = new THREE.Group();
  body.name = 'body';
  body.position.y = res.groundOffset || 0;
  root.add(body);
  let sk = null;
  if (opts.skinned) {
    sk = makeSkeleton(res.rig.joints, body);
    root.userData.skeleton = sk;
  }
  const gc = opts.geoCache || null;
  const used = new Set();
  for (const m of res.meshes) {
    const g = m.geometry;
    if (!g || !g.index || !g.index.length) continue;
    const ck = (m.gkey || m.id) + (m.kind === 'skin' ? ':' + JSON.stringify(m.material) : '') + (opts.skinned ? ':s' : '');
    let geo = gc && gc.get(ck);
    if (!geo) {
      geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(g.position, 3));
      if (g.normal) geo.setAttribute('normal', new THREE.BufferAttribute(g.normal, 3));
      if (g.uv) geo.setAttribute('uv', new THREE.BufferAttribute(g.uv, 2));
      if (m.kind === 'skin') geo.setAttribute('color', new THREE.BufferAttribute(skinColors(g, m.material, m.material.part === 'head' ? 1 / FACE_BASE : 1), 3));
      else if (g.color) geo.setAttribute('color', new THREE.BufferAttribute(g.color, 3));
      if (opts.skinned) {
        const n = g.position.length / 3;
        const w = g.skinIndex && g.skinWeight ? { skinIndex: g.skinIndex, skinWeight: g.skinWeight } : rigidSkin(n, m.bone ?? BONE_INDEX.head);
        geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(w.skinIndex, 4));
        geo.setAttribute('skinWeight', new THREE.BufferAttribute(w.skinWeight, 4));
      }
      geo.setIndex(new THREE.BufferAttribute(g.index, 1));
      if (m.groups) m.groups.forEach((gr, i) => geo.addGroup(gr.start, gr.count, i));
      if (gc) gc.set(ck, geo);
    }
    used.add(ck);
    let mat;
    if (opts.mode === 'clay' || opts.mode === 'wire') mat = clayMaterial(opts);
    else if (opts.mode === 'normals') mat = new THREE.MeshNormalMaterial({ wireframe: !!opts.wire });
    else if (opts.mode === 'uv') mat = uvMaterial();
    else if (opts.mode === 'materials') mat = m.groups ? m.groups.map(gr => slotMaterial(gr.name)) : slotMaterial(m.materialSlot || m.kind);
    else if (m.groups && m.materials) mat = m.groups.map(gr => material(m.materials[gr.name] || m.materials.main, opts));
    else mat = material(m.material || m.materials?.main || { kind: 'fabric', color: '#888888' }, opts);
    const mesh = opts.skinned ? new THREE.SkinnedMesh(geo, mat) : new THREE.Mesh(geo, mat);
    mesh.name = m.name; mesh.userData = { id: m.id, kind: m.kind, itemIndex: m.itemIndex, assetId: m.assetId, materialSlot: m.materialSlot, slots: m.groups ? m.groups.map(gr => gr.name) : null };
    mesh.castShadow = true; mesh.receiveShadow = true;
    body.add(mesh);
    if (opts.skinned) { mesh.updateMatrixWorld(true); mesh.bind(sk.skeleton, mesh.matrixWorld); mesh.frustumCulled = false; }
    if (opts.mode === 'wire') {
      const wire = opts.skinned ? new THREE.SkinnedMesh(geo, wireMaterial()) : new THREE.Mesh(geo, wireMaterial());
      body.add(wire);
      if (opts.skinned) { wire.updateMatrixWorld(true); wire.bind(sk.skeleton, wire.matrixWorld); wire.frustumCulled = false; }
    }
  }
  if (gc) for (const k of [...gc.keys()]) if (!used.has(k)) { gc.get(k).dispose(); gc.delete(k); }
  return root;
}
let uvMat = null, wireMat = null;
function uvMaterial() {
  if (uvMat) return uvMat;
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#e8e8e8' : '#3a7bd5'; g.fillRect(x * 32, y * 32, 32, 32); }
  g.fillStyle = '#ff5a36'; g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 8); t.colorSpace = THREE.SRGBColorSpace;
  return (uvMat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }));
}
function wireMaterial() { return wireMat || (wireMat = new THREE.MeshBasicMaterial({ color: '#1b2233', wireframe: true, transparent: true, opacity: 0.35, depthWrite: false })); }
const SLOT_COLORS = { main: '#4F8FD8', rib: '#E3A13B', trim: '#D85A9C', inside: '#7A7A7A', lining: '#9B6BD8', hardware: '#E8D25A', stitch: '#FF5A36', cord: '#5AD8C8', tape: '#333333', skin: '#E8B89A', hair: '#6B4A2E', eye: '#FFFFFF', lashes: '#222', brows: '#222', facialHair: '#3B2A1E', midsole: '#DDDDDD', outsole: '#555555', laces: '#F0F0F0', accent: '#5AD87A', lens: '#9AD0F0', strap: '#8A5A33', elastic: '#3B3B3B' };
const slotCache = new Map();
function slotMaterial(slot) {
  if (!slotCache.has(slot)) slotCache.set(slot, new THREE.MeshStandardMaterial({ color: SLOT_COLORS[slot] || '#BBBBBB', roughness: 0.7 }));
  return slotCache.get(slot);
}
let clay = null;
function clayMaterial(opts) {
  if (!clay || clay.wireframe !== !!opts.wire) clay = new THREE.MeshStandardMaterial({ color: '#c9c3bb', roughness: 0.7, wireframe: !!opts.wire, side: THREE.DoubleSide });
  return clay;
}
export function disposeScene(group) {
  // (geometries owned by a geoCache are disposed by buildScene when they stop being used)
  group.traverse(o => { if (o.isMesh && !o.userData.cached) o.geometry.dispose(); });
}
