/* =====================================================================
 * NORMAL 3D — ASSET REGISTRY
 *
 * The single list of Normal 3D parts (separate from the Voxel registry:
 * ids, slots and parameters are NOT interchangeable between modes).
 * The UI, the validator, the AI prompt, the catalog and the JSON Schema
 * all read this registry, so registering an asset is the only step needed
 * to make it usable by people and by AI models.
 *
 * Asset definition:
 * {
 *   id: 'top_tshirt_01', slot: 'top', category: 'upper',
 *   label: { en, ar }, description (English, for AI models), tags: [],
 *   params: { key: ParamSpec },        controls that make sense for THIS asset
 *   colors: { channel: { label, default } },
 *   fabrics: ['cotton_jersey', …], fabric: default fabric id,
 *   layer: number (garment stacking order), attach: { points, default },
 *   ...slot-specific (recipe, build, template…)
 * }
 * ParamSpec: { type: 'number', min, max, default, step?, label, doc }
 *          | { type: 'enum', values: [...], labels?: {value: {en, ar}}, default, label, doc }
 *          | { type: 'bool', default, label, doc }
 * ===================================================================== */

export const SLOTS = {
  preset: { label: { en: 'Character preset', ar: 'شخصية جاهزة' }, path: 'preset' },
  browStyle: { label: { en: 'Eyebrows', ar: 'الحاجبان' }, path: 'face.brows.styleId' },
  hairStyle: { label: { en: 'Hairstyle', ar: 'تسريحة الشعر' }, path: 'hair.styleId' },
  facialHair: { label: { en: 'Facial hair', ar: 'شعر الوجه' }, path: 'face.facialHair.styleId' },
  faceDetail: { label: { en: 'Face details', ar: 'تفاصيل الوجه' }, path: 'face.details[].assetId', multi: true },
  top: { label: { en: 'Tops (base layer)', ar: 'القطع العلوية (الطبقة الأولى)' }, path: 'outfit[] (slot top)', garment: true },
  mid: { label: { en: 'Mid layer (sweaters, hoodies, vests)', ar: 'الطبقة الوسطى (كنزات وهوديات وصدريات)' }, path: 'outfit[] (slot mid)', garment: true },
  outer: { label: { en: 'Outerwear (jackets, coats, blazers)', ar: 'الطبقة الخارجية (جاكيتات ومعاطف وبليزر)' }, path: 'outfit[] (slot outer)', garment: true },
  bottom: { label: { en: 'Bottoms (trousers, shorts, skirts)', ar: 'القطع السفلية (بناطيل وشورتات وتنانير)' }, path: 'outfit[] (slot bottom)', garment: true },
  fullBody: { label: { en: 'Full-body garments', ar: 'ملابس كاملة' }, path: 'outfit[] (slot fullBody)', garment: true },
  footwear: { label: { en: 'Footwear', ar: 'الأحذية' }, path: 'outfit[] (slot footwear)', garment: true },
  headwear: { label: { en: 'Hats and head coverings', ar: 'القبعات وأغطية الرأس' }, path: 'accessories[] (slot headwear)', accessory: true },
  neckwear: { label: { en: 'Scarves, shawls, ties', ar: 'الأوشحة والشالات وربطات العنق' }, path: 'accessories[] (slot neckwear)', accessory: true },
  handwear: { label: { en: 'Gloves', ar: 'القفازات' }, path: 'accessories[] (slot handwear)', accessory: true },
  eyewear: { label: { en: 'Glasses', ar: 'النظارات' }, path: 'accessories[] (slot eyewear)', accessory: true },
  jewelry: { label: { en: 'Jewellery and watches', ar: 'المجوهرات والساعات' }, path: 'accessories[] (slot jewelry)', accessory: true },
  bag: { label: { en: 'Bags', ar: 'الحقائب' }, path: 'accessories[] (slot bag)', accessory: true },
  belt: { label: { en: 'Belts', ar: 'الأحزمة' }, path: 'accessories[] (slot belt)', accessory: true },
};
export const SLOT_IDS = Object.keys(SLOTS);
export const GARMENT_SLOTS = SLOT_IDS.filter(s => SLOTS[s].garment);
export const ACCESSORY_SLOTS = SLOT_IDS.filter(s => SLOTS[s].accessory);

const ID_RE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
const assets = new Map();
const fail = msg => { throw new Error('[n3d registry] ' + msg); };

function checkParams(id, params) {
  for (const [k, p] of Object.entries(params || {})) {
    if (!p.label || !p.label.en) fail(`${id}: param ${k} needs label.en`);
    if (p.type === 'number') { if (!(p.min <= p.default && p.default <= p.max)) fail(`${id}: param ${k} default out of range`); }
    else if (p.type === 'enum') { if (!Array.isArray(p.values) || !p.values.includes(p.default)) fail(`${id}: param ${k} enum default must be one of its values`); }
    else if (p.type === 'bool') { if (typeof p.default !== 'boolean') fail(`${id}: param ${k} bool default`); }
    else fail(`${id}: param ${k} has unknown type ${p.type}`);
  }
}

export function registerAsset(def) {
  if (!def || !ID_RE.test(def.id || '')) fail(`bad asset id "${def && def.id}"`);
  if (assets.has(def.id)) fail(`duplicate asset id "${def.id}"`);
  if (!SLOTS[def.slot]) fail(`asset "${def.id}" has unknown slot "${def.slot}"`);
  if (!def.label || !def.label.en || !def.label.ar) fail(`asset "${def.id}" needs label.en and label.ar`);
  if (!def.description) fail(`asset "${def.id}" needs a description (AI models read it)`);
  checkParams(def.id, def.params);
  for (const [k, c] of Object.entries(def.colors || {})) if (!/^#[0-9A-F]{6}$/.test(c.default || '')) fail(`${def.id}: colour ${k} default must be #RRGGBB upper-case`);
  const entry = Object.freeze({ tags: [], params: {}, colors: {}, ...def });
  assets.set(def.id, entry);
  return entry;
}
export const getAsset = id => assets.get(id) || null;
export const hasAsset = (id, slot) => { const a = assets.get(id); return !!a && (!slot || a.slot === slot); };
export const listAssets = slot => [...assets.values()].filter(a => !slot || a.slot === slot);
export const allAssets = () => [...assets.values()];

/** Default value of every param of an asset. */
export function paramDefaults(asset) { return Object.fromEntries(Object.entries(asset.params || {}).map(([k, p]) => [k, p.default])); }
export function colorDefaults(asset) { return Object.fromEntries(Object.entries(asset.colors || {}).map(([k, c]) => [k, c.default])); }

/* Shared parameter specs (garment templates inherit these). */
export const num = (min, max, def, en, ar, doc, step) => ({ type: 'number', min, max, default: def, label: { en, ar }, doc, ...(step ? { step } : {}) });
export const enm = (values, def, en, ar, doc, labels) => ({ type: 'enum', values, default: def, label: { en, ar }, doc, ...(labels ? { labels } : {}) });
export const bool = (def, en, ar, doc) => ({ type: 'bool', default: def, label: { en, ar }, doc });
