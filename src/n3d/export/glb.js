/* =====================================================================
 * NORMAL 3D EXPORT — GLB + metadata + document + Limonat loader + README
 *
 * The GLB contains every mesh (skin, eyes, lashes, brows, hair, facial
 * hair, garments, trims, footwear, accessories) as skinned meshes bound to
 * one 55-bone VRM-named skeleton, PBR materials (base colour, weave normal
 * maps, roughness, sheen, clearcoat, pattern textures, face texture),
 * vertex colours where used, attachment-point nodes under their bones,
 * stable mesh / material names, procedural clips (idle, walk, wave) and
 * the character document in the scene extras.
 * ===================================================================== */
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildScene } from '../render/scene.js';
import { applyPose } from '../render/skeleton3.js';
import { BONES, ATTACH_POINTS } from '../core/skeleton.js';
import { N3D_FORMAT, N3D_VERSION } from '../core/document.js';
import { getAsset } from '../core/registry.js';
import { APP_NAME, APP_VERSION } from '../../core/constants.js';
import { makeZip } from '../../export/zip.js';
import { hairStrip } from '../render/textures.js';

export const N3D_EXPORT_DEFAULTS = { facing: 'limonat', animations: true, detail: 'high' };

export function fileBase(name) {
  return (String(name || 'character').normalize('NFKD').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'character').slice(0, 40);
}

/** Map a position from build space to export space (ground offset, facing). */
function toExport(p, res, facing) {
  const dy = res.groundOffset || 0, f = facing === 'gltf' ? -1 : 1;
  return [p[0] * f, p[1] + dy, p[2] * f];
}
/** Attachment points (positions in the exported space) and their bones. */
export function attachmentPoints(res) {
  const J = res.rig.joints, hm = res.marks.head, S = res.frame.S, dy = res.groundOffset || 0;
  const up = p => [p[0], p[1] + dy, p[2]];
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const e0 = hm.eyes[0].center, e1 = hm.eyes[1].center;
  const pts = {
    head_top: [hm.top, 'head'], forehead: [hm.forehead, 'head'], eyes: [[0, (e0[1] + e1[1]) / 2, Math.min(e0[2], e1[2]) - 0.012 * S], 'head'],
    ear_left: [hm.ears.find(e => e.s < 0)?.c || hm.ears[0].c, 'head'], ear_right: [hm.ears.find(e => e.s > 0)?.c || hm.ears[1].c, 'head'],
    neck: [res.frame.neckBase, 'neck'], chest: [[0, J.upperChest[1], J.upperChest[2] - 0.12 * S], 'upperChest'], back: [[0, J.upperChest[1], J.upperChest[2] + 0.11 * S], 'upperChest'],
    shoulder_left: [J.leftUpperArm, 'leftShoulder'], shoulder_right: [J.rightUpperArm, 'rightShoulder'],
    waist: [[0, J.spine[1], J.spine[2]], 'hips'], hip_left: [J.leftUpperLeg, 'hips'], hip_right: [J.rightUpperLeg, 'hips'],
    wrist_left: [J.leftHand, 'leftLowerArm'], wrist_right: [J.rightHand, 'rightLowerArm'],
    hand_left: [mid(J.leftHand, J.leftMiddleProximal), 'leftHand'], hand_right: [mid(J.rightHand, J.rightMiddleProximal), 'rightHand'],
    finger_left: [J.leftRingProximal, 'leftRingProximal'], finger_right: [J.rightRingProximal, 'rightRingProximal'],
  };
  return Object.fromEntries(Object.entries(pts).map(([k, [p, bone]]) => [k, { position: up(p), bone }]));
}

/** Procedural clips sampled from the viewer poses (each loops seamlessly). */
export const CLIPS = { idle: { dur: 12, fps: 15 }, walk: { dur: 2 * Math.PI / 5.2, fps: 30 }, wave: { dur: 4 * Math.PI / 7, fps: 30 } };
function makeClips(sk) {
  const clips = [];
  for (const [name, { dur, fps }] of Object.entries(CLIPS)) {
    const n = Math.round(dur * fps) + 1, times = new Float32Array(n);
    const tracks = new Map();
    for (let f = 0; f < n; f++) {
      const t = f === n - 1 ? dur : f / fps; times[f] = t;
      applyPose(sk, name, t);
      for (const b of sk.bones) {
        let tr = tracks.get(b.name);
        if (!tr) { tr = { q: new Float32Array(n * 4), p: new Float32Array(n * 3) }; tracks.set(b.name, tr); }
        b.quaternion.toArray(tr.q, f * 4); b.position.toArray(tr.p, f * 3);
      }
    }
    applyPose(sk, 'rest');
    const kf = [];
    for (const b of sk.bones) {
      const tr = tracks.get(b.name), r = b.userData.rest;
      let moved = false;
      for (let f = 0; f < n && !moved; f++) if (Math.abs(tr.q[f * 4] - r.q.x) + Math.abs(tr.q[f * 4 + 1] - r.q.y) + Math.abs(tr.q[f * 4 + 2] - r.q.z) + Math.abs(tr.q[f * 4 + 3] - r.q.w) > 1e-5) moved = true;
      if (moved) kf.push(new THREE.QuaternionKeyframeTrack(b.name + '.quaternion', times, tr.q));
      if (b.name === 'hips') { let mp = false; for (let f = 0; f < n && !mp; f++) if (Math.abs(tr.p[f * 3 + 1] - r.p.y) > 1e-5) mp = true; if (mp) kf.push(new THREE.VectorKeyframeTrack(b.name + '.position', times, tr.p)); }
    }
    clips.push(new THREE.AnimationClip(name, dur, kf));
  }
  return clips;
}

/** Replace materials the glTF format cannot express directly (alpha maps, linear face maps). */
function gltfFriendly(group) {
  group.traverse(o => {
    if (!o.isMesh) return;
    const mats = [].concat(o.material).map(m => {
      if (m.alphaMap) {
        // hair cards: the strand alpha goes into the base colour texture (white RGB, alpha = strands), alphaMode MASK
        const t = new THREE.CanvasTexture(hairStrip('cards')); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
        const n = m.clone(); n.alphaMap = null; n.map = t; n.name = m.name || 'hair'; return n;
      }
      if (m.map && m.map.colorSpace === THREE.NoColorSpace && m.userData.desc?.kind === 'skin') {
        // face map: linear with a 0.78 base → normalised and converted to sRGB
        const src = m.map.image, c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
        const g = c.getContext('2d'); g.drawImage(src, 0, 0);
        const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
        for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) { const lin = Math.min(1, d[i + k] / 255 / 0.78); d[i + k] = Math.round(255 * (lin <= 0.0031308 ? lin * 12.92 : 1.055 * Math.pow(lin, 1 / 2.4) - 0.055)); }
        g.putImageData(img, 0, 0);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
        const n = m.clone(); n.map = t; return n;
      }
      return m;
    });
    o.material = Array.isArray(o.material) ? mats : mats[0];
    // vertex colours of the head were scaled for the viewer's face map: undo for glTF
    if (o.userData.kind === 'skin' && o.geometry.attributes.color && Array.isArray(o.material) === false && o.material.map) {
      const col = o.geometry.attributes.color.clone(); for (let i = 0; i < col.array.length; i++) col.array[i] = Math.min(1, col.array[i] * 0.78);
      o.geometry = o.geometry.clone(); o.geometry.setAttribute('color', col);
    }
  });
}

/** JOINTS_0 as unsigned bytes, WEIGHTS_0 as normalised unsigned bytes summing exactly to 255. */
function compactSkin(geo) {
  const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight; if (!si || !sw) return;
  const n = si.count, J = new Uint8Array(n * 4), W = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    let sum = 0; for (let k = 0; k < 4; k++) sum += Math.max(0, sw.array[i * 4 + k]);
    let tot = 0, best = 0;
    for (let k = 0; k < 4; k++) {
      const w = sum > 0 ? Math.max(0, sw.array[i * 4 + k]) / sum : k === 0 ? 1 : 0, q = Math.round(w * 255);
      W[i * 4 + k] = q; tot += q; if (q > W[i * 4 + best]) best = k;
      J[i * 4 + k] = q ? si.array[i * 4 + k] : 0;
    }
    W[i * 4 + best] += 255 - tot;
    if (!J[i * 4 + best] && si.array[i * 4 + best]) J[i * 4 + best] = si.array[i * 4 + best];
  }
  geo.setAttribute('skinIndex', new THREE.Uint8BufferAttribute(J, 4));
  geo.setAttribute('skinWeight', new THREE.Uint8BufferAttribute(W, 4, true));
}

/**
 * COLOR_0 as normalised unsigned shorts clamped to 0…1, RGBA (alpha 1) so the vertex stride is a multiple of
 * 4 bytes as glTF requires: a third smaller than floats, valid, and 16 bits keep dark gradients smooth.
 */
function compactColor(geo) {
  const c = geo.attributes.color; if (!c || c.normalized) return;
  const n = c.count, k = c.itemSize, a = new Uint16Array(n * 4);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < 3; j++) a[i * 4 + j] = Math.round(65535 * Math.min(1, Math.max(0, c.array[i * k + j])));
    a[i * 4 + 3] = k === 4 ? Math.round(65535 * Math.min(1, Math.max(0, c.array[i * k + 3]))) : 65535;
  }
  geo.setAttribute('color', new THREE.Uint16BufferAttribute(a, 4, true));
}
/** 16-bit indices for meshes with fewer than 65 536 vertices. */
function compactIndex(geo) {
  const idx = geo.index; if (!idx || idx.array instanceof Uint16Array || geo.attributes.position.count >= 65536) return;
  geo.setIndex(new THREE.Uint16BufferAttribute(Uint16Array.from(idx.array), 1));
}
/** Texture coordinates are only exported for meshes whose materials use a texture. */
function dropUnusedUV(o) {
  const usesTexture = [].concat(o.material).some(m => Object.values(m).some(v => v && v.isTexture));
  if (!usesTexture && o.geometry.attributes.uv) o.geometry.deleteAttribute('uv');
}

/** Export a GLB from a build result. Returns { glb, stats }. */
export async function exportN3DGLB(res, settings = N3D_EXPORT_DEFAULTS) {
  const group = buildScene(res, { mode: 'pbr', skinned: true });      // root → body (y = ground offset) → hips + meshes
  gltfFriendly(group);
  const sk = group.userData.skeleton;
  group.updateMatrixWorld(true);
  // attachment points as empty nodes under their bones
  const ap = attachmentPoints(res);
  for (const [k, a] of Object.entries(ap)) {
    const bone = sk.byName[a.bone]; if (!bone) continue;
    const node = new THREE.Object3D(); node.name = 'attach_' + k;
    node.position.copy(bone.worldToLocal(new THREE.Vector3(...a.position)));
    bone.add(node);
  }
  // stable node names (= part ids), material names <part id>/<slot>, compact skin attributes
  group.traverse(o => {
    if (!o.isMesh) return;
    o.userData.label = o.name; o.name = o.userData.id || o.name;
    compactSkin(o.geometry); compactColor(o.geometry); compactIndex(o.geometry);
    const slots = o.userData.slots || [];
    if (Array.isArray(o.material)) o.material = o.material.map((m, i) => { const n = m.clone(); n.name = `${o.name}/${slots[i] || i}`; return n; });
    else { const n = o.material.clone(); n.name = `${o.name}/${o.userData.materialSlot || o.userData.kind}`; o.material = n; }
    dropUnusedUV(o);
  });
  const clips = settings.animations ? makeClips(sk) : [];
  applyPose(sk, 'rest');
  if (settings.facing === 'gltf') group.rotation.y = Math.PI;      // glTF convention: front = +Z
  group.name = 'LimonatCharacter3D';
  const scene = new THREE.Scene();
  scene.name = fileBase(res.doc.meta.name);
  scene.userData = { limonatCharacter3D: { format: N3D_FORMAT, version: N3D_VERSION, generator: `${APP_NAME} ${APP_VERSION}`, units: 'metres', up: '+Y', facing: settings.facing === 'gltf' ? '+Z' : '-Z', restPose: 'A-pose', bones: BONES.length, attachmentPoints: Object.keys(ap).map(k => 'attach_' + k), document: res.doc } };
  scene.add(group);
  // skinned meshes become ROOT nodes (glTF: a skinned mesh ignores parent transforms; their bind matrices
  // already hold the ground offset, and the armature node holds the facing rotation)
  const skinned = [];
  group.traverse(o => { if (o.isSkinnedMesh) skinned.push(o); });
  for (const m of skinned) { m.parent.remove(m); m.position.set(0, 0, 0); m.quaternion.identity(); m.scale.set(1, 1, 1); scene.add(m); }
  const glb = await new GLTFExporter().parseAsync(scene, { binary: true, animations: clips, onlyVisible: false, maxTextureSize: 2048 });
  let tris = 0, meshes = 0;
  scene.traverse(o => { if (o.isMesh) { meshes++; tris += o.geometry.index.count / 3; } });
  return { glb, stats: { tris, meshes, bones: BONES.length, clips: clips.map(c => c.name), bytes: glb.byteLength, attachments: Object.keys(ap).length } };
}

/** Re-open a GLB and report its contents (export self-check). */
export async function inspectN3DGLB(buf) {
  const gltf = await new GLTFLoader().parseAsync(buf.slice(0), '');
  let bones = 0, skinned = 0, tris = 0, textures = new Set(), mats = new Set();
  const attach = [];
  gltf.scene.traverse(o => {
    if (o.isBone) bones++;
    if (o.isSkinnedMesh) { skinned++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }
    if (o.isMesh) for (const m of [].concat(o.material)) { mats.add(m); for (const k of ['map', 'normalMap']) if (m[k]) textures.add(m[k]); }
    if (o.name.startsWith('attach_')) attach.push(o.name);
  });
  return { bones, skinnedMeshes: skinned, tris: Math.round(tris), materials: mats.size, textures: textures.size, animations: gltf.animations.map(a => a.name), attachments: attach.length, gltf };
}

/** Metadata: the document + parts, materials, skeleton, attachment points. */
export function buildN3DMetadata(res, settings, files) {
  const X = p => toExport(p, res, settings.facing).map(v => Math.round(v * 10000) / 10000);
  const parts = res.meshes.filter(m => m.geometry && m.geometry.index && m.geometry.index.length).map(m => ({
    id: m.id, name: m.name, kind: m.kind, assetId: m.assetId || null, layer: m.layer ?? null,
    triangles: m.geometry.index.length / 3, materials: m.groups ? m.groups.map(g => `${m.name}/${g.name}`) : [`${m.name}/${m.materialSlot || m.kind}`],
  }));
  const items = [...res.doc.outfit.map(it => ({ list: 'outfit', ...it })), ...res.doc.accessories.map(it => ({ list: 'accessories', ...it }))].map(it => ({ ...it, slot: getAsset(it.assetId)?.slot, label: getAsset(it.assetId)?.label }));
  const ap = attachmentPoints(res);
  return {
    format: N3D_FORMAT + '-export', version: N3D_VERSION, generator: `${APP_NAME} ${APP_VERSION}`, exportedAt: new Date().toISOString(), files,
    units: 'metres', up: '+Y', facing: settings.facing === 'gltf' ? '+Z' : '-Z', restPose: 'A-pose (arms about 40° below horizontal)',
    heightMeters: Math.round((res.rig.H + (res.groundOffset || 0)) * 1000) / 1000, groundOffset: Math.round((res.groundOffset || 0) * 10000) / 10000, detail: res.doc.detail,
    animations: settings.animations ? Object.entries(CLIPS).map(([name, c]) => ({ name, seconds: Math.round(c.dur * 1000) / 1000, loop: true })) : [],
    skeleton: BONES.map(b => ({ name: b.name, parent: b.parent, limonatPart: b.limonat || null, rest: X(res.rig.joints[b.name] || [0, 0, 0]) })),
    attachmentPoints: Object.fromEntries(Object.entries(ap).map(([k, a]) => [k, { node: 'attach_' + k, bone: a.bone, position: X([a.position[0], a.position[1] - (res.groundOffset || 0), a.position[2]]), label: ATTACH_POINTS[k]?.label?.en }])),
    items, parts,
    document: res.doc,
  };
}

/**
 * The character's registration file for Limonat. It needs the integration runtime
 * (integration/limonat: three-gltf-loader.js + limonat-n3d.js), which wraps VR.buildCharacter
 * so the game animates the skinned character with its usual six parts.
 */
export function limonatLoaderScript(base, doc, height = 1.75) {
  const id = 'n3d_' + (fileBase(doc.meta.name).replace(/-/g, '_') || 'character');
  const def = { id, name: { en: doc.meta.name, ar: doc.meta.name }, glb: `characters/${base}.glb`, height: Math.round(height * 1000) / 1000 };
  return `/* ${doc.meta.name} — Normal 3D character for Limonat (exported by ${APP_NAME} ${APP_VERSION}).
 * 1. Copy ${base}.glb to the game's characters/ folder (or change "glb" below).
 * 2. In index.html, after js/character.js (once for all characters):
 *      <script src="lib/three-gltf-loader.js"></script>
 *      <script src="js/limonat-n3d.js"></script>
 *    then this file:  <script src="js/characters/${base}.limonat-n3d.js"></script>
 * The character appears in the Character menu and is animated like the game's own characters
 * (legs, body, head and arms). See docs/N3D_LIMONAT_INTEGRATION.md in the creator.
 */
(function () {
  if (!window.LimonatN3D) { console.warn('[${base}] the Limonat Normal 3D runtime (js/limonat-n3d.js) is not loaded'); return; }
  LimonatN3D.register(${JSON.stringify(def)});
})();
`;
}

export function readmeN3D(doc, base, stats, settings) {
  return `${doc.meta.name} — Normal 3D character exported with ${APP_NAME} ${APP_VERSION}

Files
  ${base}.glb            skinned 3D model: ${stats.meshes} meshes, ${Math.round(stats.tris).toLocaleString('en')} triangles, ${stats.bones} bones (VRM humanoid names), PBR materials and textures,
                         ${stats.attachments} attachment points (attach_* nodes)${settings.animations ? ', clips idle / walk / wave' : ''}
  ${base}.meta.json      parts, materials, skeleton, attachment points and the full character document
  ${base}.n3d.json       the character document (format ${N3D_FORMAT} ${N3D_VERSION}) — re-import it into the creator to keep editing
  ${base}.limonat-n3d.js registers the character in Limonat (needs the integration runtime: lib/three-gltf-loader.js + js/limonat-n3d.js)

Conventions: metres, +Y up, facing ${settings.facing === 'gltf' ? '+Z (glTF)' : '-Z (Limonat)'}, rest pose A-pose. The character stands on y = 0 (soles included).
Limonat: see docs/N3D_LIMONAT_INTEGRATION.md in the creator (integration kit in integration/limonat/).
`;
}

/** Everything for the export panel. */
export async function buildN3DExport(res, settings = N3D_EXPORT_DEFAULTS) {
  const base = fileBase(res.doc.meta.name) + '-3d';
  const { glb, stats } = await exportN3DGLB(res, settings);
  const names = { glb: `${base}.glb`, meta: `${base}.meta.json`, doc: `${base}.n3d.json`, js: `${base}.limonat-n3d.js` };
  const meta = buildN3DMetadata(res, settings, names);
  return {
    base, stats,
    files: {
      glb: { name: names.glb, data: glb, mime: 'model/gltf-binary' },
      meta: { name: names.meta, data: JSON.stringify(meta, null, 2), mime: 'application/json' },
      doc: { name: names.doc, data: JSON.stringify(res.doc, null, 2), mime: 'application/json' },
      js: { name: names.js, data: limonatLoaderScript(base, res.doc, res.rig.H + (res.groundOffset || 0)), mime: 'text/javascript' },
      readme: { name: 'README.txt', data: readmeN3D(res.doc, base, stats, settings), mime: 'text/plain' },
    },
  };
}
export function zipN3D(exp) {
  const f = exp.files;
  return makeZip([f.glb, f.meta, f.doc, f.js, f.readme].map(x => ({ name: `${exp.base}/${x.name}`, data: x.data })));
}
