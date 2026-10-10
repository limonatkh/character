/* =====================================================================
 * ASSET REGISTRY — the single list of parts that exist.
 *
 * Everything downstream (UI dropdowns, validator, AI prompt, asset
 * catalog, JSON Schema) reads this registry, so registering an asset is
 * the only step needed to make it usable by people AND by AI models.
 * See docs/ADDING_ASSETS.md.
 * ===================================================================== */
import { ATTACH_POINT_IDS } from './skeleton.js';
import { isHex } from './color.js';
import { MATERIAL_IDS } from './constants.js';

/**
 * Slots. `path` is where the slot lives inside `character` (documentation),
 * `idField` the property name holding the asset id, `multi` = list slot.
 */
export const SLOTS = {
  bodyType:   { path: 'body.typeId',               idField: 'typeId',  label: { en: 'Body type', ar: 'نوع الجسم' } },
  headShape:  { path: 'head.shapeId',              idField: 'shapeId', label: { en: 'Head shape', ar: 'شكل الرأس' } },
  hair:       { path: 'hair.assetId',              idField: 'assetId', label: { en: 'Hair', ar: 'الشعر' } },
  headwear:   { path: 'headwear.assetId',          idField: 'assetId', label: { en: 'Headwear', ar: 'غطاء الرأس' } },
  eyes:       { path: 'face.eyes.styleId',         idField: 'styleId', label: { en: 'Eyes', ar: 'العيون' } },
  eyebrows:   { path: 'face.eyebrows.styleId',     idField: 'styleId', label: { en: 'Eyebrows', ar: 'الحواجب' } },
  mouth:      { path: 'face.mouth.styleId',        idField: 'styleId', label: { en: 'Mouth', ar: 'الفم' } },
  facialHair: { path: 'face.facialHair.assetId',   idField: 'assetId', label: { en: 'Facial hair', ar: 'شعر الوجه' } },
  faceDetail: { path: 'face.details[].assetId',    idField: 'assetId', multi: true, label: { en: 'Face details', ar: 'تفاصيل الوجه' } },
  top:        { path: 'clothing.top.assetId',      idField: 'assetId', label: { en: 'Top / shirt', ar: 'القميص' } },
  outerwear:  { path: 'clothing.outerwear.assetId', idField: 'assetId', label: { en: 'Outerwear / jacket', ar: 'الجاكيت' } },
  bottom:     { path: 'clothing.bottom.assetId',   idField: 'assetId', label: { en: 'Bottom / trousers', ar: 'البنطلون' } },
  shoes:      { path: 'clothing.shoes.assetId',    idField: 'assetId', label: { en: 'Shoes', ar: 'الحذاء' } },
  accessory:  { path: 'accessories[].assetId',     idField: 'assetId', multi: true, label: { en: 'Accessories', ar: 'الإكسسوارات' } },
};
export const SLOT_IDS = Object.keys(SLOTS);

const ID_RE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
const assets = new Map();
const bases = new Map();

function fail(msg) { throw new Error('[registry] ' + msg); }

/**
 * Register one asset.
 * {
 *   id: 'hair_spiky_01',            stable id (never rename once released)
 *   slot: 'hair',                   one of SLOTS
 *   label: { en, ar },              shown in the UI
 *   description: '...',             English, shown to AI models in the catalog
 *   tags: ['short', 'anime'],       extra matching hints for AI models
 *   colors: [{ key: 'color' | 'secondaryColor', label, default: '#RRGGBB' }],
 *   material: 'cloth',              default material (colourable slots)
 *   attach: { points: [...], default: 'face' }   accessories only
 *   sides: ['left','right','both']  face details that can be mirrored
 *   build(ctx, item)                adds voxel boxes (see compile.js)
 *   ...slot-specific fields (body measurements, hat line, etc.)
 * }
 */
export function registerAsset(def) {
  if (!def || typeof def !== 'object') fail('asset definition must be an object');
  if (!ID_RE.test(def.id || '')) fail(`bad asset id "${def.id}" (use lower_snake_case like hair_spiky_01)`);
  if (assets.has(def.id)) fail(`duplicate asset id "${def.id}"`);
  if (!SLOTS[def.slot]) fail(`asset "${def.id}" has unknown slot "${def.slot}"`);
  if (!def.label || !def.label.en) fail(`asset "${def.id}" needs label.en`);
  if (!def.description) fail(`asset "${def.id}" needs a description (AI models read it)`);
  for (const c of def.colors || []) {
    if (!['color', 'secondaryColor'].includes(c.key)) fail(`asset "${def.id}": colour key must be color or secondaryColor`);
    if (!isHex(c.default)) fail(`asset "${def.id}": colour default must be #RRGGBB`);
  }
  if (def.material && !MATERIAL_IDS.includes(def.material)) fail(`asset "${def.id}": unknown material "${def.material}"`);
  if (def.slot === 'accessory') {
    const a = def.attach;
    if (!a || !Array.isArray(a.points) || !a.points.length) fail(`accessory "${def.id}" needs attach.points`);
    for (const p of a.points) if (!ATTACH_POINT_IDS.includes(p)) fail(`accessory "${def.id}": unknown attach point "${p}"`);
    if (!a.points.includes(a.default)) fail(`accessory "${def.id}": attach.default must be one of its points`);
  }
  if (def.slot !== 'bodyType' && def.slot !== 'headShape' && typeof def.build !== 'function') fail(`asset "${def.id}" needs a build(ctx, item) function`);
  const entry = Object.freeze({ version: 1, tags: [], colors: [], ...def });
  assets.set(def.id, entry);
  return entry;
}

export function getAsset(id) { return assets.get(id) || null; }
export function hasAsset(id, slot) { const a = assets.get(id); return !!a && (!slot || a.slot === slot); }
export function listAssets(slot) { return [...assets.values()].filter(a => !slot || a.slot === slot); }
export function allAssets() { return [...assets.values()]; }

/** Default colour for a colour key of an asset, or null if the asset has no such colour. */
export function assetColorDefault(asset, key) {
  const c = (asset.colors || []).find(c => c.key === key);
  return c ? c.default : null;
}

/**
 * Base characters (presets). `character` is a full character config
 * (same shape as a validated command document's `character`).
 */
export function registerBase(def) {
  if (!ID_RE.test(def.id || '')) fail(`bad base id "${def.id}"`);
  if (bases.has(def.id)) fail(`duplicate base id "${def.id}"`);
  if (!def.character) fail(`base "${def.id}" needs a character config`);
  bases.set(def.id, Object.freeze(def));
}
export function getBase(id) { return bases.get(id) || null; }
export function listBases() { return [...bases.values()]; }
export function defaultBaseId() { return listBases()[0].id; }
