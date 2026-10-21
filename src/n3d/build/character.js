/* =====================================================================
 * NORMAL 3D CHARACTER PIPELINE (pure JS: runs in a worker and in Node)
 *
 *   document → rig → skin field + skin mesh → body measurements
 *            → footwear → garments in layer order (each sits on everything
 *              underneath) → trims → hair (collides with the clothes)
 *            → eyes, lashes, brows, facial hair → accessories
 *            → hidden-surface removal (skin and inner layers under clothes)
 *
 * Results are plain typed arrays + material descriptions: the viewer turns
 * them into Three.js meshes, the exporter into GLB. Every stage is cached
 * by the inputs that affect its geometry, so recolouring never re-meshes
 * and changing a jacket never re-meshes the shirt underneath.
 * ===================================================================== */
import { buildRig } from '../anatomy/rig.js';
import { skinField, meshSkin } from './skin.js';
import { splitGroups } from '../mesh/attributes.js';
import { detailOf } from '../core/detail.js';
import { completeN3D } from '../core/document.js';
import { getAsset, paramDefaults, colorDefaults } from '../core/registry.js';
import { bodyFrame } from '../garments/body-frame.js';
import { measureBody } from '../garments/measure.js';
import { cutGarment } from '../garments/cut.js';
import { meshGarment } from '../garments/shell.js';
import { buildTrims } from '../garments/trims.js';
import { buildHair } from '../hair/engine.js';
import { scalpDepth } from '../hair/scalp.js';
import { buildEyeballs, buildLashes, buildBrows } from '../face/features.js';
import { buildFacialHair, faceZones } from '../face/facialhair.js';
import { BONE_INDEX } from '../core/skeleton.js';
import { FABRICS, garmentMaterials } from '../materials/fabrics.js';
import { GARMENT_LAYER_TUCKED } from '../assets/garments.js';
import { clipHairParts, bodyWeights, rigidWeights } from '../accessories/common.js';
import { BONE_INDEX as BI } from '../core/skeleton.js';

export const STAGES = ['anatomy', 'garments', 'hair', 'face', 'accessories', 'finish'];

/** Stable short hash of any JSON value. */
export function hashOf(v) {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36) + s.length.toString(36);
}

/** Effective layer of an outfit item (tucked tops go under the bottoms). */
export function itemLayer(asset, params) {
  if (asset.slot === 'footwear') return 5;
  if (asset.slot === 'top') return params.tucked ? GARMENT_LAYER_TUCKED : 25;
  return asset.layer ?? 30;
}

/** Complete an outfit / accessory item's params and colours from its asset. */
export function resolveItem(it) {
  const a = getAsset(it.assetId);
  if (!a) return null;
  const params = { ...paramDefaults(a) };
  for (const [k, spec] of Object.entries(a.params || {})) {
    const v = it.params?.[k];
    if (v === undefined) continue;
    if (spec.type === 'number' && typeof v === 'number' && isFinite(v)) params[k] = Math.min(spec.max, Math.max(spec.min, v));
    else if (spec.type === 'enum' && spec.values.includes(v)) params[k] = v;
    else if (spec.type === 'bool' && typeof v === 'boolean') params[k] = v;
  }
  const colors = { ...colorDefaults(a) };
  for (const k of Object.keys(a.colors || {})) if (typeof it.colors?.[k] === 'string' && /^#[0-9A-Fa-f]{6}$/.test(it.colors[k])) colors[k] = it.colors[k].toUpperCase();
  const material = { ...(it.material || {}) };
  if (material.fabric && a.fabrics && !a.fabrics.includes(material.fabric)) delete material.fabric;
  return { asset: a, params, colors, material };
}

/**
 * Build a character.
 * @param docIn  Normal 3D document (partial ok)
 * @param opts { detail, cache (Map), onProgress(stage, fraction), only: Set of stages to rebuild }
 */
export function buildCharacter(docIn, opts = {}) {
  const t0 = now();
  const doc = completeN3D(docIn);
  const detailId = opts.detail || doc.detail;
  const D = detailOf(detailId);
  const cache = opts.cache || new Map();
  const progress = opts.onProgress || (() => {});
  const timings = {};
  const meshes = [];
  const lap = (name, t) => { timings[name] = Math.round(now() - t); };

  // ------------------------------------------------------------ anatomy
  let t = now();
  progress('anatomy', 0);
  const shapeFace = Object.fromEntries(Object.entries(doc.face).filter(([, v]) => typeof v === 'number'));
  const anatomyKey = hashOf({ b: doc.body, f: shapeFace, d: detailId });
  let A = cache.get('anatomy');
  if (!A || A.key !== anatomyKey) {
    const rig = buildRig(doc.body);
    const sf = skinField(rig, shapeFace);
    const skin = meshSkin(rig, sf, D);
    const F = bodyFrame(rig, sf.body.marks, sf.head.marks);
    const meas = measureBody(sf, F);
    A = { key: anatomyKey, rig, sf, skin, F, meas };
    cache.set('anatomy', A);
    for (const k of [...cache.keys()]) if (k !== 'anatomy' && !k.startsWith('tex:')) cache.delete(k);
  }
  const { rig, sf, skin, F, meas } = A;
  const S = F.S;
  lap('anatomy', t);

  // ------------------------------------------------------------ outfit (footwear first, then layers)
  t = now();
  const items = doc.outfit.map((it, i) => ({ it, i, r: resolveItem(it) })).filter(x => x.r);
  // one-piece garments with legs (overalls, jumpsuits, coveralls) are worn over the top: it is tucked in
  if (items.some(x => x.r.asset.tucksTops)) for (const x of items) if (x.r.asset.slot === 'top' && 'tucked' in (x.r.asset.params || {})) x.r = { ...x.r, params: { ...x.r.params, tucked: true } };
  items.forEach(x => { x.layer = itemLayer(x.r.asset, x.r.params); });
  items.sort((a, b) => a.layer - b.layer || a.i - b.i);
  let U = sf.farField;
  let chainKey = anatomyKey;
  const garments = [];
  items.forEach((x, k) => {
    progress('garments', k / Math.max(1, items.length));
    const { asset, params, colors, material } = x.r;
    const fabricId = material.fabric || asset.fabric;
    const geoKey = hashOf({ c: chainKey, a: asset.id, p: params, f: fabricId, d: detailId, l: x.layer });
    chainKey = geoKey;
    let G = cache.get('g:' + geoKey);
    if (!G) {
      try {
        const ctx = { F, S, fabric: fabricId, D };
        if (asset.slot === 'footwear') G = asset.buildFootwear ? asset.buildFootwear(params, { ...ctx, sf, rig, U, meas }) : null;
        else {
          const spec = asset.build(params, ctx, asset);
          G = buildGarment(spec, { F, S, D, meas, U, sf, seed: 1 + x.i, asset });
        }
      } catch (e) {
        G = { error: String(e && e.message || e) };
        if (typeof console !== 'undefined') console.warn('[n3d] garment failed', asset.id, e);
      }
      cache.set('g:' + geoKey, G);
    }
    if (!G || G.error) { garments.push({ item: x, error: G?.error || 'no geometry' }); return; }
    if (G.stack) U = G.stack;
    const mats = garmentMaterials(asset, { colors, material });
    if (asset.slot === 'footwear') {
      for (const slot of ['midsole', 'outsole', 'laces', 'accent', 'elastic']) if (colors[slot]) mats[slot] = { kind: slot === 'outsole' || slot === 'midsole' ? 'rubber' : 'fabric', fabric: slot === 'laces' ? 'cotton_jersey' : slot === 'elastic' ? 'rib_knit' : mats.main.fabric, color: colors[slot], pattern: 'solid', roughness: slot === 'outsole' ? 0.85 : slot === 'midsole' ? 0.6 : mats.main.roughness, sheen: 0.1, sheenRoughness: 0.5, weave: slot === 'elastic' ? 'rib' : slot === 'laces' ? 'rib' : mats.main.weave, scale: mats.main.scale };
      if (colors.lining) mats.lining = { ...mats.lining, color: colors.lining };
    }
    garments.push({ item: x, G, materials: mats });
  });
  lap('garments', t);

  // ------------------------------------------------------------ hair (rests on the clothes)
  t = now();
  progress('hair', 0);
  const hairAsset = getAsset(doc.hair.styleId);
  let hairParts = [];
  if (hairAsset && hairAsset.recipe && !hairAsset.recipe.none) {
    const hr = resolveItem({ assetId: hairAsset.id, params: doc.hair.params, colors: doc.hair.colors });
    const covered = garments.some(g => g.G?.hidesHair);
    const hairKey = hashOf({ a: anatomyKey, h: hr.params, s: hairAsset.id, c: hr.colors, o: covered ? chainKey : garments.length ? chainKey : 0, d: detailId });
    let H = cache.get('h:' + hairKey);
    if (!H) {
      const P = { ...hr.params, hairline: { height: hr.params.hairlineHeight, recession: hr.params.recession, widowsPeak: hr.params.widowsPeak, sideburns: hr.params.sideburns }, rootRGB: lin(hr.colors.root), tipRGB: lin(hr.colors.tip), highlightRGB: lin(hr.colors.highlight) };
      H = buildHair({ field: sf.field, far: sf.farField, collide: U === sf.farField ? null : U, marks: sf.head.marks, rig, D, skinMesh: skin.raw }, hairAsset.recipe, P);
      cache.set('h:' + hairKey, H);
    }
    hairParts = H.parts;
  }
  lap('hair', t);

  // ------------------------------------------------------------ accessories (on top of everything; hats hide hair)
  t = now();
  progress('accessories', 0);
  const accessories = [];
  const riseItem = garments.find(g => g.G?.info?.riseY && ['bottom', 'fullBody'].includes(g.item.r.asset.slot));
  doc.accessories.forEach((it, i) => {
    const r = resolveItem(it);
    if (!r) return;
    const key = hashOf({ c: chainKey, h: hairParts.length ? hashOf(doc.hair) : 0, a: r.asset.id, p: r.params, d: detailId });
    let X = cache.get('x:' + key);
    if (!X) {
      try {
        X = r.asset.build(r.params, { F, S, sf, rig, D, U, meas, hairParts, waistY: riseItem ? riseItem.G.info.riseY - 0.018 * S : undefined });
        for (const m of X.meshes) {
          const geo = m.geometry;
          if (geo.skinIndex) continue;
          const n = geo.position.length / 3;
          Object.assign(geo, m.skinned ? {} : X.bone ? rigidWeights(n, X.bone) : bodyWeights(geo.position, sf, S));
        }
      } catch (e) { X = { error: String(e && e.message || e) }; if (typeof console !== 'undefined') console.warn('[n3d] accessory failed', r.asset.id, e); }
      cache.set('x:' + key, X);
    }
    accessories.push({ i, r, X });
  });
  for (const a of accessories) if (a.X?.hides) hairParts = clipHairParts(hairParts, a.X.hides);
  lap('accessories', t);

  // ------------------------------------------------------------ face features
  t = now();
  const head = sf.head;
  const faceKey = hashOf({ a: anatomyKey, e: doc.face.eyes, b: doc.face.brows, fh: doc.face.facialHair, d: detailId, c: hashOf(chainKey) });
  let FF = cache.get('f:' + faceKey);
  if (!FF) {
    const browAsset = getAsset(doc.face.brows.styleId);
    const browCfg = { ...(browAsset?.brow || {}), ...(doc.face.brows.params || {}) };
    FF = {
      eyes: buildEyeballs(head, { irisSize: doc.face.eyes.irisSize }),
      lashes: buildLashes(head, { length: doc.face.eyes.lashLength, density: doc.face.eyes.lashDensity, curl: doc.face.eyes.lashCurl }, D),
      brows: browAsset?.none ? null : buildBrows(sf, head, browCfg, D),
    };
    const fhAsset = getAsset(doc.face.facialHair.styleId);
    if (fhAsset && fhAsset.style && !fhAsset.style.none) {
      const fr = resolveItem({ assetId: fhAsset.id, params: doc.face.facialHair.params, colors: doc.face.facialHair.colors });
      FF.facialHair = buildFacialHair(fhAsset.style, fr.params, { skin: skin.raw, field: sf.field, collide: U, marks: head.marks, D });
      if (FF.facialHair) Object.assign(FF.facialHair.geometry, bodyWeights(FF.facialHair.geometry.position, sf, S));
      FF.facialHairColors = fr.colors;
      FF.shadow = fhAsset.style.shadow || 0;
      FF.fhStyle = fhAsset.style;
    }
    cache.set('f:' + faceKey, FF);
  }
  // per-vertex face details on the skin: beard shadow, blush, eye shadow (painted into vertex colours)
  const detKey = hashOf({ a: anatomyKey, fh: doc.face.facialHair.styleId, st: doc.skin.stubble });
  let DET = cache.get('det:' + detKey);
  if (!DET) {
    const P = skin.raw.positions, n = P.length / 3, det = new Float32Array(n * 4);
    const hm = head.marks;
    const beardZones = FF.fhStyle?.zones || null;
    const stub = Math.max(doc.skin.stubble || 0, FF.shadow || 0);
    for (let i = 0; i < n; i++) {
      if (!skin.raw.isHead[i] && P[i * 3 + 1] < hm.chin[1] - 0.09 * S) continue;
      const p = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
      const z = faceZones(hm, p);
      let beard = 0;
      if (stub > 0) {
        const zones = beardZones || { moustache: 1, chin: 1, jaw: 1, neck: 0.6 };
        for (const [k, w] of Object.entries(zones)) beard = Math.max(beard, (z[k] || 0) * w);
        beard *= stub;
      }
      // blush: soft area on the cheekbones
      const ce = hm.eyes, sx = Math.sign(p[0]) || 1;
      const eye = ce.find(e => Math.sign(e.center[0]) === sx) || ce[0];
      const ck = [eye.center[0] + sx * 0.008 * S, eye.center[1] - 0.032 * S, eye.center[2] + 0.004 * S];
      const blush = Math.exp(-((p[0] - ck[0]) ** 2 + (p[1] - ck[1]) ** 2 * 1.6 + (p[2] - ck[2]) ** 2) / (0.022 * S) ** 2);
      // eyelids (eye shadow) and lash line (eyeliner)
      const dE = Math.hypot((p[0] - eye.center[0]) / 1.25, p[1] - eye.center[1] - 0.006 * S, p[2] - eye.center[2]);
      const lid = Math.exp(-((dE - eye.radius * 1.1) ** 2) / (eye.radius * 0.45) ** 2) * (p[1] > eye.center[1] - 0.002 * S ? 1 : 0.15);
      const liner = Math.exp(-((dE - eye.radius * 0.98) ** 2) / (eye.radius * 0.12) ** 2) * (p[1] > eye.center[1] - eye.radius * 0.2 ? 1 : 0.4);
      det[i * 4] = beard; det[i * 4 + 1] = blush; det[i * 4 + 2] = lid; det[i * 4 + 3] = liner;
    }
    DET = det;
    cache.set('det:' + detKey, DET);
  }
  lap('face', t);

  // ------------------------------------------------------------ hidden surfaces
  t = now();
  const covers = garments.filter(g => g.G && g.G.region && g.G.opaque !== false).map(g => ({ region: g.G.region, layer: g.item.layer, margin: g.G.coverMargin ?? 0.03 * S }));
  // the scalp under a sculpted hair mass is never visible (and would show through its thin edge)
  const massHair = hairParts.some(p => p.rep === 'mass') ? { hl: { height: doc.hair.params?.hairlineHeight ?? 0, recession: doc.hair.params?.recession ?? 0, widowsPeak: doc.hair.params?.widowsPeak ?? 0, sideburns: doc.hair.params?.sideburns ?? 0.5 } } : null;
  const hideKey = hashOf({ c: chainKey, a: anatomyKey, h: massHair });
  let hidden = cache.get('hide:' + hideKey);
  if (!hidden) {
    const P = skin.raw.positions, n = P.length / 3, hid = new Uint8Array(n);
    if (covers.length) for (let i = 0; i < n; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      for (const c of covers) if (c.region(x, y, z) < -c.margin) { hid[i] = 1; break; }
    }
    if (massHair) {
      const hm = sf.head.marks, isHead = skin.raw.isHead;
      for (let i = 0; i < n; i++) {
        if (hid[i] || (isHead && !isHead[i])) continue;
        const p = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
        if (scalpDepth(p, massHair.hl, hm) < 0.008 * S) continue;
        let nearEar = false;
        for (const e of hm.ears) if (Math.hypot(p[0] - e.c[0], p[1] - e.c[1], p[2] - e.c[2]) < 0.035 * S) nearEar = true;
        if (!nearEar) hid[i] = 1;
      }
    }
    hidden = hid;
    cache.set('hide:' + hideKey, hidden);
  }
  lap('hide', t);

  // ------------------------------------------------------------ assemble meshes
  const skinGroups = regroupSkin(skin, hidden, DET);
  for (const [name, g] of Object.entries(skinGroups)) {
    const fhc = FF.facialHairColors?.root || doc.hair.colors?.root || '#2B1E16';
    meshes.push({ id: 'skin_' + name, kind: 'skin', name: name === 'head' ? 'Head' : 'Body', material: { kind: 'skin', part: name, tone: doc.skin.tone, roughness: doc.skin.roughness, undertone: doc.skin.undertone, lip: doc.face.makeup.lipColor, lipAmount: doc.face.makeup.lipAmount,
      beard: fhc, blush: doc.face.makeup.blushColor, blushAmount: doc.face.makeup.blush, eyeShadow: doc.face.makeup.eyeShadowColor, eyeShadowAmount: doc.face.makeup.eyeShadow, eyeliner: doc.face.makeup.eyeliner,
      details: name === 'head' ? { freckles: doc.skin.freckles, moles: doc.skin.moles, wrinkles: doc.skin.wrinkles, blemishes: doc.skin.blemishes, scars: doc.skin.scars, seed: hashOf(doc.meta.id) } : null },
      geometry: { position: g.attributes.position.array, normal: g.attributes.normal.array, uv: g.attributes.uv.array, region: g.attributes.region.array, detail: g.attributes.detail.array, skinIndex: g.attributes.skinIndex.array, skinWeight: g.attributes.skinWeight.array, index: g.indices } });
  }
  FF.eyes.forEach((e, i) => meshes.push({ id: 'eye_' + (i ? 'right' : 'left'), kind: 'eye', name: i ? 'Eye R' : 'Eye L', bone: BONE_INDEX[i ? 'rightEye' : 'leftEye'], material: { kind: 'eye', iris: (i && doc.face.eyes.heterochromia) || doc.face.eyes.iris, sclera: doc.face.eyes.sclera, pupil: doc.face.eyes.pupil }, geometry: e.geometry }));
  meshes.push({ id: 'lashes', kind: 'lashes', name: 'Eyelashes', bone: BONE_INDEX.head, material: { kind: 'lashes', color: doc.face.eyes.lashColor }, geometry: FF.lashes.geometry });
  if (FF.facialHair) meshes.push({ id: 'facial_hair', kind: 'facialHair', name: 'Facial hair', material: { kind: 'facialHair', color: FF.facialHairColors?.root || '#2B1E16', tip: FF.facialHairColors?.tip, rep: FF.facialHair.rep }, geometry: FF.facialHair.geometry });
  if (FF.brows) meshes.push({ id: 'brows', kind: 'brows', name: 'Eyebrows', bone: BONE_INDEX.head, material: { kind: 'brows', color: doc.face.brows.color || doc.hair.colors?.root || colorDefaults(hairAsset || { colors: {} }).root || '#2B1E16' }, geometry: FF.brows.geometry });
  hairParts.forEach((p, i) => meshes.push({ id: 'hair_' + i, kind: 'hair', name: 'Hair ' + p.rep, bone: p.bone ?? BONE_INDEX.head, material: { kind: 'hair', rep: p.rep, texture: p.texture, ...(p.massKind ? { massKind: p.massKind } : {}), alpha: !!p.alpha, gloss: doc.hair.params?.gloss ?? 0.35 }, geometry: p.geometry }));
  for (const g of garments) {
    if (!g.G) continue;
    const { asset } = g.item.r;
    const base = `${asset.id}_${g.item.i}`;
    if (g.G.mesh) meshes.push({ id: base, kind: 'garment', name: asset.label.en, itemIndex: g.item.i, assetId: asset.id, layer: g.item.layer, materials: g.materials, geometry: g.G.mesh, groups: g.G.mesh.groups });
    for (const [k, m] of (g.G.meshes || []).entries()) {
      const groups = (m.mesh.groups || [{ name: 'main', start: 0, count: m.mesh.index.length }]).map(gr => ({ ...gr, name: gr.name === 'inside' || gr.name === 'lining' ? 'lining' : gr.name === 'rib' ? 'main' : gr.name }));
      meshes.push({ id: `${base}_${m.part}_${m.side}_${k}`, kind: 'footwear', name: `${asset.label.en} – ${m.part} ${m.side}`, itemIndex: g.item.i, assetId: asset.id, layer: g.item.layer, materials: g.materials, geometry: m.mesh, groups });
    }
    for (const [k, p] of (g.G.parts || []).entries()) meshes.push({ id: `${base}_${p.name}_${k}`, kind: 'trim', name: `${asset.label.en} – ${p.name}`, itemIndex: g.item.i, assetId: asset.id, layer: g.item.layer, material: g.materials[p.material] || g.materials.main, materialSlot: p.material, geometry: p.geometry });
  }
  for (const a of accessories) {
    if (!a.X || a.X.error) continue;
    const mats = accessoryMaterials(a.r);
    a.X.meshes.forEach((m, k) => {
      meshes.push({ id: `${a.r.asset.id}_${a.i}_${m.name}_${k}`, kind: 'accessory', name: `${a.r.asset.label.en} – ${m.name}`, accessoryIndex: a.i, assetId: a.r.asset.id,
        ...(m.groups ? { materials: mats, groups: m.groups.map(g => ({ ...g, name: g.name === 'inside' ? 'lining' : g.name })) } : { material: mats[m.material] || mats.main, materialSlot: m.material }),
        bone: a.X.bone ? BI[a.X.bone] : undefined, geometry: m.geometry });
    });
  }
  const groundOffset = Math.max(0, ...garments.map(g => g.G?.groundOffset || 0));
  timings.total = Math.round(now() - t0);
  progress('finish', 1);
  return {
    doc, groundOffset, rig: { joints: rig.joints, H: rig.H }, marks: { head: head.marks, body: sf.body.marks }, frame: { neckBase: F.neckBase, S },
    faceUV: skin.headUV,
    meshes, errors: [...garments.filter(g => g.error).map(g => ({ assetId: g.item.r.asset.id, error: g.error })), ...accessories.filter(a => a.X?.error).map(a => ({ assetId: a.r.asset.id, error: a.X.error }))],
    stats: { timings, tris: meshes.reduce((s, m) => s + (m.geometry.index ? m.geometry.index.length / 3 : 0), 0), meshes: meshes.length },
  };
}

/** Material slots of an accessory (metal / plastic / fabric main + lens, strap, accent). */
export function accessoryMaterials(r) {
  const { asset, colors, material, params } = r;
  const mats = garmentMaterials(asset, { colors, material });
  if (asset.materialKind === 'metal') mats.main = { kind: 'hardware', color: colors.main, metalness: 1, roughness: 0.22 };
  if (asset.materialKind === 'plastic') mats.main = { kind: 'hardware', color: colors.main, metalness: 0.1, roughness: 0.3 };
  if (colors.lens) mats.lens = { kind: 'glass', color: colors.lens, opacity: 0.25 + 0.7 * (params.tint ?? 0) };
  if (colors.strap) mats.strap = { ...mats.main, kind: 'fabric', fabric: 'leather', color: colors.strap, pattern: 'solid', weave: 'grain', scale: 0.006, roughness: 0.55, sheen: 0, sheenRoughness: 0.5 };
  if (colors.accent) mats.accent = asset.materialKind === 'metal' ? { kind: 'hardware', color: colors.accent, metalness: 0, roughness: 0.15 } : { ...mats.main, kind: 'fabric', color: colors.accent, pattern: 'solid', roughness: 0.8 };
  if (asset.id === 'head_keffiyeh_01' && mats.accent) mats.accent = { kind: 'fabric', fabric: 'rib_knit', color: colors.accent, pattern: 'solid', weave: 'rib', scale: 0.002, roughness: 0.9, sheen: 0.2, sheenRoughness: 0.8 };
  return mats;
}

/** Garment = shell + trims, with skin weights on the trims copied from the shell. */
export function buildGarment(spec, ctx) {
  const { F, S, D, meas, U, sf } = ctx;
  const c = cutGarment(spec, { F, meas, U, D, S, seed: ctx.seed });
  const mesh = meshGarment(c.G, { bodyField: sf.field, S });
  const parts = buildTrims(spec.trims || [], { F, S, D, g: mesh, region: c.region, info: c.info, seed: ctx.seed + 5, stitch: spec.stitch, sleeveT: spec.sleeves?.t, field: c.field });
  const near = nearestIndex(mesh.position, 0.02 * S);
  for (const p of parts) {
    const n = p.geometry.position.length / 3;
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const j = near(p.geometry.position[i * 3], p.geometry.position[i * 3 + 1], p.geometry.position[i * 3 + 2]);
      for (let k = 0; k < 4; k++) { si[i * 4 + k] = mesh.skinIndex[j * 4 + k]; sw[i * 4 + k] = mesh.skinWeight[j * 4 + k]; }
    }
    p.geometry.skinIndex = si; p.geometry.skinWeight = sw;
  }
  delete mesh.surface;            // large; not needed after trims
  return { mesh, parts, stack: c.stack, region: c.region, info: c.info, hidesHair: false };
}

/** Nearest-vertex lookup (spatial hash). */
export function nearestIndex(P, cell) {
  const grid = new Map(), key = (x, y, z) => ((Math.floor(x / cell) * 73856093) ^ (Math.floor(y / cell) * 19349663) ^ (Math.floor(z / cell) * 83492791));
  for (let i = 0; i < P.length / 3; i++) { const k = key(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(i); }
  return (x, y, z) => {
    let best = 0, bd = Infinity;
    for (let r = 1; r <= 4 && bd === Infinity; r++) {
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
        const l = grid.get(key(x + dx * cell, y + dy * cell, z + dz * cell)); if (!l) continue;
        for (const i of l) { const d = (P[i * 3] - x) ** 2 + (P[i * 3 + 1] - y) ** 2 + (P[i * 3 + 2] - z) ** 2; if (d < bd) { bd = d; best = i; } }
      }
    }
    return best;
  };
}

/** Skin groups without the triangles hidden under clothes. */
function regroupSkin(skin, hidden, det) {
  const { raw } = skin;
  const P = raw.positions, N = raw.normals, I = raw.indices;
  // reuse the attributes computed by meshSkin through its groups' source arrays
  const attrs = { ...skin.attrs, detail: { array: det, itemSize: 4 } };
  return splitGroups(I, attrs, (a, b, c) => {
    if (hidden && hidden[a] && hidden[b] && hidden[c]) return null;
    return (raw.isHead[a] + raw.isHead[b] + raw.isHead[c]) >= 2 ? 'head' : 'body';
  });
  void P; void N;
}

/** sRGB hex → linear RGB triple. */
export function lin(hex) {
  const n = parseInt((hex || '#808080').slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.pow(v / 255, 2.2));
}
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
export { FABRICS };
