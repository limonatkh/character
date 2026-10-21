/* =====================================================================
 * LIMONAT × NORMAL 3D CHARACTERS — runtime for the game (classic script)
 * Version 1.1.0 · Limonat Character Creator
 *
 * Lets Limonat use the skinned GLB characters exported by the creator's
 * Normal 3D mode exactly like its own voxel characters:
 *   - LimonatN3D.register(def) adds the character to VR.CHARACTERS (it shows
 *     in the Character menu) and starts loading its GLB;
 *   - VR.buildCharacter(def) returns the usual rig { root, inner, parts, def }
 *     for it: `parts.legL / legR / body / head / armL / armR` are the same
 *     rotation handles the game already animates, mapped onto the skeleton's
 *     bones every frame (arms hang down at rotation 0, as in the game);
 *   - first-person hands keep using voxel arms (def.fpArms), so the
 *     first-person view works unchanged.
 *
 * Load order in index.html (after js/character.js):
 *   <script src="lib/three-gltf-loader.js"></script>      (THREE.GLTFLoader for r158 classic scripts)
 *   <script src="js/limonat-n3d.js"></script>               (this file)
 *   <script src="js/characters/<name>.limonat-n3d.js"></script>   (one per exported character)
 *
 * No game file has to change: the runtime wraps VR.buildCharacter.
 * ===================================================================== */
(function (global) {
  'use strict';
  const THREE = global.THREE, VR = global.VR;
  if (!THREE || !VR || typeof VR.buildCharacter !== 'function') { console.warn('[LimonatN3D] load this after three.min.js and js/character.js'); return; }

  /** Limonat's six animated parts → skeleton bones (VRM names). */
  const PARTS = { legL: 'leftUpperLeg', legR: 'rightUpperLeg', body: 'spine', head: 'head', armL: 'leftUpperArm', armR: 'rightUpperArm' };
  const ARM_DOWN = 0.62;                 // rest pose is an A-pose; the game's arms hang straight down at rotation 0
  const registry = new Map();            // id → { def, template, buffer, waiting: [rig], error }
  const opts = { material: 'standard', shadows: true, height: 0 };

  /**
   * Settings: material = 'standard' (default, PBR without the costly extensions) | 'lambert' (fastest, phones) | 'original';
   * shadows (cast shadows); height = 0 (real size, metres) or a height every Normal 3D character is scaled to
   * (e.g. 2.09 to match the voxel hero).
   */
  function configure(o) { Object.assign(opts, o || {}); }

  function loaderFor() {
    const L = THREE.GLTFLoader || global.GLTFLoader;
    if (!L) throw new Error('THREE.GLTFLoader missing: add lib/three-gltf-loader.js before limonat-n3d.js');
    return new L();
  }

  /** Simplify materials for the game's lighting / mobile GPUs. */
  function adaptMaterials(root) {
    if (opts.material === 'original') return;
    const cache = new Map();
    root.traverse(o => {
      if (!o.isMesh) return;
      if (opts.shadows) { o.castShadow = true; o.receiveShadow = false; }
      const conv = m => {
        if (cache.has(m)) return cache.get(m);
        const base = { name: m.name, color: m.color, map: m.map, vertexColors: m.vertexColors, transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest, side: m.side };
        const n = opts.material === 'lambert'
          ? new THREE.MeshLambertMaterial(base)
          : new THREE.MeshStandardMaterial({ ...base, normalMap: m.normalMap, normalScale: m.normalScale, roughness: m.roughness ?? 0.8, metalness: m.metalness ?? 0, roughnessMap: m.roughnessMap, metalnessMap: m.metalnessMap });
        n.userData = { n3d: true };
        cache.set(m, n);
        return n;
      };
      o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
    });
  }

  /** Clone a skinned hierarchy (like SkeletonUtils.clone): bones are re-bound by name. */
  function cloneSkinned(src) {
    const clone = src.clone(true);
    const srcBones = {}, dstBones = {};
    src.traverse(o => { if (o.isBone) srcBones[o.name] = o; });
    clone.traverse(o => { if (o.isBone) dstBones[o.name] = o; });
    const srcMeshes = [], dstMeshes = [];
    src.traverse(o => { if (o.isSkinnedMesh) srcMeshes.push(o); });
    clone.traverse(o => { if (o.isSkinnedMesh) dstMeshes.push(o); });
    dstMeshes.forEach((m, i) => {
      const s = srcMeshes[i];
      const bones = s.skeleton.bones.map(b => dstBones[b.name]);
      m.bind(new THREE.Skeleton(bones, s.skeleton.boneInverses), s.bindMatrix);
    });
    return clone;
  }

  /** The game-facing rig: parts are rotation handles synced to bones before each frame is drawn. */
  function makeRig(def) {
    const root = new THREE.Group(), inner = new THREE.Group();
    root.add(inner);
    root.name = 'n3d:' + def.id;
    const parts = {};
    for (const k of Object.keys(PARTS)) { const p = new THREE.Object3D(); p.name = k; parts[k] = p; inner.add(p); }
    const rig = { root, inner, parts, def, n3d: true, bones: null, ready: false };
    const entry = registry.get(def.id);
    if (entry && entry.template) attach(rig, entry.template);
    else if (entry) entry.waiting.push(rig);
    return rig;
  }

  const qa = new THREE.Quaternion(), qd = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1);
  function attach(rig, template) {
    const model = cloneSkinned(template);
    let s = rig.def.scale || 1;
    if (opts.height > 0 && rig.def.height > 0) s *= opts.height / rig.def.height;
    model.scale.setScalar(s);
    rig.inner.add(model);
    const bones = {};
    model.traverse(o => { if (o.isBone) bones[o.name] = o; });
    const rest = {};
    for (const k in bones) rest[k] = bones[k].quaternion.clone();
    rig.bones = bones; rig.model = model;
    // attachment points (attach_hand_right …) for held items
    rig.attach = {};
    model.traverse(o => { if (o.name && o.name.indexOf('attach_') === 0) rig.attach[o.name.slice(7)] = o; });
    const sync = () => {
      for (const k in PARTS) {
        const b = bones[PARTS[k]]; if (!b) continue;
        b.quaternion.copy(rest[PARTS[k]]).multiply(qa.setFromEuler(rig.parts[k].rotation));
        if (k === 'armL' || k === 'armR') b.quaternion.multiply(qd.setFromAxisAngle(zAxis, (k === 'armL' ? 1 : -1) * ARM_DOWN));
      }
      model.updateMatrixWorld(true);
    };
    let first = null;
    model.traverse(o => { if (o.isSkinnedMesh && !first) first = o; });
    if (first) { const prev = first.onBeforeRender; first.onBeforeRender = function () { sync(); if (prev) prev.apply(this, arguments); }; }
    sync();
    rig.ready = true;
  }

  function load(entry) {
    const def = entry.def;
    const done = gltf => {
      const scene = gltf.scene;
      adaptMaterials(scene);
      scene.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
      entry.template = scene;
      entry.animations = gltf.animations;
      for (const rig of entry.waiting.splice(0)) attach(rig, scene);
    };
    try {
      loaderFor().load(def.glb, done, undefined, e => { entry.error = e; console.warn('[LimonatN3D] could not load', def.glb, e); });
    } catch (e) { entry.error = e; console.warn('[LimonatN3D]', e.message); }
  }

  /**
   * Register an exported character. def: { id, name: {en, ar}, tagline?, glb (url), height (m), scale?, voxelFallback? }
   * Returns the VR.CHARACTERS entry.
   */
  function register(def) {
    const fallback = (def.voxelFallback && VR.CHARACTERS.find(c => c.id === def.voxelFallback)) || VR.CHARACTERS[0];
    const entry = {
      ...def, n3d: true,
      tagline: def.tagline || { en: 'Normal 3D character', ar: 'شخصية ثلاثية الأبعاد' },
      // voxel data the game reads for the first-person hands (they stay voxel mittens)
      model: fallback.model, palette: fallback.palette, outline: fallback.outline, noOutline: fallback.noOutline,
      fpArms: fallback.fpArms || { armL: fallback.model.armL.boxes, armR: fallback.model.armR.boxes },
    };
    const i = VR.CHARACTERS.findIndex(c => c.id === entry.id);
    if (i >= 0) VR.CHARACTERS[i] = entry; else VR.CHARACTERS.push(entry);
    const rec = { def: entry, template: null, waiting: [], error: null };
    registry.set(entry.id, rec);
    load(rec);
    return entry;
  }

  // ---- wrap VR.buildCharacter: Normal 3D entries get the skinned rig. The first-person view builds a
  //      COPY of the entry with only voxel arms (def.fpArms) — that copy keeps the voxel path.
  const original = VR.buildCharacter;
  VR.buildCharacter = function (def) {
    const rec = def && def.n3d ? registry.get(def.id) : null;
    if (rec && def.model === rec.def.model) return makeRig(def);
    return original.apply(this, arguments);
  };

  global.LimonatN3D = { register, configure, PARTS, buildRig: makeRig, version: '1.1.0', isReady: id => !!(registry.get(id) && registry.get(id).template) };
})(typeof window !== 'undefined' ? window : globalThis);
