/* =====================================================================
 * GLB EXPORT (+ metadata + Limonat script + ZIP package)
 * ===================================================================== */
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PX, APP_NAME, APP_VERSION, SCHEMA_VERSION, DOC_KIND } from '../core/constants.js';
import { JOINTS, ATTACH_POINTS } from '../core/skeleton.js';
import { toTPose, toFacingPlusZ } from '../core/transform.js';
import { buildCharacterObject, meshStats } from '../render/mesh.js';
import { buildClips } from '../render/poses.js';
import { toLimonatDef, toLimonatScript } from './limonat.js';
import { makeZip } from './zip.js';

export const DEFAULT_EXPORT = { restPose: 'armsDown', facing: 'limonat', shading: 'flat', animations: true };

export function fileBase(name) {
  return (String(name || 'character').normalize('NFKD').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'character').slice(0, 40);
}

function prepareModel(model, settings) {
  let m = model;
  if (settings.restPose === 'tpose') m = toTPose(m);
  if (settings.facing === 'gltf') m = toFacingPlusZ(m);
  return m;
}

/** Skeleton description stored in the metadata (metres, in the exported conventions). */
function skeletonInfo(m) {
  const parentPos = Object.fromEntries(m.joints.map(j => [j.name, j.pos]));
  return JOINTS.map(j => {
    const p = parentPos[j.name];
    return { name: j.name, parent: j.parent, limonatPart: j.limonat, restPosition: p.map(v => Math.round(v * PX * 10000) / 10000) };
  });
}

/** Export a GLB. Returns { glb: ArrayBuffer, stats }. */
export async function exportGLB(model, doc, settings = DEFAULT_EXPORT) {
  const m = prepareModel(model, settings);
  const obj = buildCharacterObject(m, { shading: settings.shading, name: fileBase(doc.character.name) || 'LimonatCharacter' });
  obj.root.userData = {
    limonatCharacter: {
      schemaVersion: SCHEMA_VERSION, kind: DOC_KIND, id: doc.id, name: doc.character.name,
      generator: `${APP_NAME} ${APP_VERSION}`, units: 'metres', voxelSize: PX,
      restPose: settings.restPose, facing: settings.facing === 'gltf' ? '+Z' : '-Z', shading: settings.shading,
      assets: model.assets,
    },
  };
  const clips = settings.animations ? buildClips({ restPose: settings.restPose, facing: settings.facing, hipsRestY: obj.bones.hips.position.y }) : [];
  // Export a Scene so the armature and the skinned meshes are ROOT nodes (glTF best practice:
  // a skinned mesh ignores parent transforms). Character info goes into the scene's extras.
  const scene = new THREE.Scene();
  scene.name = obj.root.name;
  scene.userData = obj.root.userData;
  for (const child of [...obj.root.children]) scene.add(child);
  const exporter = new GLTFExporter();
  const glb = await exporter.parseAsync(scene, { binary: true, animations: clips, onlyVisible: false });
  const stats = { ...meshStats(obj), clips: clips.map(c => c.name), bytes: glb.byteLength };
  obj.dispose();
  return { glb, stats, model: m };
}

/** Reload a GLB with Three's GLTFLoader and report what is inside (self-check after export). */
export async function inspectGLB(arrayBuffer) {
  const loader = new GLTFLoader();
  const gltf = await loader.parseAsync(arrayBuffer.slice(0), '');
  let bones = 0, skinned = 0, tris = 0;
  const attach = [];
  gltf.scene.traverse(o => {
    if (o.isBone) bones++;
    if (o.isSkinnedMesh) { skinned++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }
    if (o.name.startsWith('attach_')) attach.push(o.name);
  });
  return { bones, skinnedMeshes: skinned, tris, animations: gltf.animations.map(a => a.name), attachments: attach.length, extras: gltf.scene.userData || {} };
}

/** The metadata file: the character document + what was exported and how. */
export function buildMetadata(doc, model, settings, files) {
  const m = prepareModel(model, settings);
  return {
    ...doc,
    export: {
      generator: `${APP_NAME} ${APP_VERSION}`,
      exportedAt: new Date().toISOString(),
      files,
      units: 'metres', voxelSize: PX, heightMeters: Math.round(model.height * PX * 1000) / 1000,
      restPose: settings.restPose, facing: settings.facing === 'gltf' ? '+Z' : '-Z', shading: settings.shading,
      animations: settings.animations ? ['idle', 'walk', 'wave'] : [],
      skeleton: skeletonInfo(m),
      attachmentPoints: Object.fromEntries(Object.entries(m.attachments).map(([k, a]) => [k, { joint: a.joint, node: 'attach_' + k, label: ATTACH_POINTS[k].label.en }])),
      assetsUsed: model.assets,
      limonat: { format: 'VR.CHARACTERS entry (6 parts)', characterPx: PX },
    },
  };
}

export function readmeText(doc, base, settings) {
  return `${doc.character.name} — exported with ${APP_NAME} ${APP_VERSION}

Files
  ${base}.glb             3D model: skinned mesh, ${JOINTS.length} standard bones (VRM names), ink outline, materials${settings.animations ? ', clips idle/walk/wave' : ''}
  ${base}.character.json  character document (schema ${SCHEMA_VERSION}) + export info; re-import it into the creator to edit
  ${base}.limonat.js      drop-in file for the Limonat game (adds the character to VR.CHARACTERS)

Settings: rest pose ${settings.restPose === 'tpose' ? 'T-pose' : 'arms down (Limonat)'}, facing ${settings.facing === 'gltf' ? '+Z (glTF)' : '-Z (Limonat)'}, shading ${settings.shading}.
Units: metres. 1 voxel = ${PX} m.

Limonat: copy ${base}.limonat.js to js/characters/ in the game and add
  <script src="js/characters/${base}.limonat.js"></script>
right after <script src="js/character.js"></script> in index.html.
`;
}

/** Build every export file. Returns { files: [{name, data, mime}], stats }. */
export async function buildExportFiles(model, doc, settings = DEFAULT_EXPORT) {
  const base = fileBase(doc.character.name);
  const { glb, stats } = await exportGLB(model, doc, settings);
  const def = toLimonatDef(model, { name: doc.character.name, id: doc.id });
  const js = toLimonatScript(def, { name: doc.character.name, id: doc.id });
  const names = { glb: `${base}.glb`, meta: `${base}.character.json`, js: `${base}.limonat.js` };
  const meta = buildMetadata(doc, model, settings, { model: names.glb, limonatScript: names.js, limonatCharacterId: def.id });
  return {
    base, stats, limonatId: def.id,
    files: {
      glb: { name: names.glb, data: glb, mime: 'model/gltf-binary' },
      meta: { name: names.meta, data: JSON.stringify(meta, null, 2), mime: 'application/json' },
      js: { name: names.js, data: js, mime: 'text/javascript' },
      readme: { name: 'README.txt', data: readmeText(doc, base, settings), mime: 'text/plain' },
    },
  };
}

export function zipPackage(exp) {
  const f = exp.files;
  return makeZip([f.glb, f.meta, f.js, f.readme].map(x => ({ name: `${exp.base}/${x.name}`, data: x.data })));
}
