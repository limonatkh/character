/* =====================================================================
 * NORMAL 3D CHARACTER DOCUMENT — format "limonat-character-3d", v1.0
 *
 * Completely separate from the Voxel document ("limonat-character"):
 * different structure, ids, parameters and validation. The document is
 * what is saved, loaded, imported from AI models and embedded in exports.
 *
 * {
 *   format: 'limonat-character-3d', version: '1.0', mode: 'normal3d',
 *   meta:   { id, name, notes, createdAt, updatedAt },
 *   detail: 'standard' | 'high' | 'advanced',
 *   body:   { ...BODY_PARAMS }                         (multipliers / 0..1)
 *   face:   { ...FACE_PARAMS,                          (−1..1 offsets)
 *             eyes: { iris, irisSize, pupil, sclera, lashLength, lashDensity, lashColor },
 *             brows: { styleId, color, params },
 *             facialHair: { styleId, params, colors },
 *             makeup: { lipColor, lipAmount, blush, blushColor } }
 *   skin:   { tone, undertone, roughness, freckles, moles, wrinkles, scars: [...], blemishes }
 *   hair:   { styleId, params, colors }
 *   outfit: [ { assetId, params, colors, material: { fabric, pattern, patternScale, wear, hardware }, confidence? } ]
 *   accessories: [ { assetId, params, colors, material, confidence? } ]
 *   ai?:    { reference, observations, uncertain, unsupported, importedAt }   what an AI model reported
 * }
 * ===================================================================== */
import { BODY_PARAMS, FACE_PARAMS, completeParams, defaults } from './params.js';
import { DETAIL_IDS } from './detail.js';

export const N3D_FORMAT = 'limonat-character-3d';
export const N3D_VERSION = '1.0';
export const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

const P = (min, max, def, en, ar, doc, step) => ({ min, max, default: def, label: { en, ar }, doc, step: step ?? 0.01 });
export const EYE_PARAMS = {
  irisSize: P(0.8, 1.25, 1, 'Iris size', 'حجم القزحية', 'iris size relative to the eye'),
  pupil: P(0.6, 1.6, 1, 'Pupil size', 'حجم البؤبؤ', 'pupil size'),
  lashLength: P(0.4, 1.8, 1, 'Eyelash length', 'طول الرموش', 'eyelash length'),
  lashDensity: P(0.3, 1.6, 1, 'Eyelash density', 'كثافة الرموش', 'eyelash density'),
  lashCurl: P(0, 1, 0.6, 'Eyelash curl', 'انحناء الرموش', 'how much the lashes curl'),
};
export const SKIN_PARAMS = {
  roughness: P(0.3, 0.8, 0.52, 'Skin shine ↔ matte', 'لمعان البشرة ↔ مطفي', 'lower = shinier skin'),
  freckles: P(0, 1, 0, 'Freckles', 'النمش', 'amount of freckles on the nose and cheeks'),
  moles: P(0, 1, 0.15, 'Moles / beauty marks', 'الشامات', 'number of small moles'),
  wrinkles: P(0, 1, 0, 'Wrinkles / age lines', 'التجاعيد', 'forehead lines, crow’s feet, smile lines'),
  blemishes: P(0, 1, 0.1, 'Skin texture / blemishes', 'ملمس البشرة', 'pores, redness and small blemishes'),
  undertone: P(-1, 1, 0, 'Undertone: cool ↔ warm', 'الدرجة: باردة ↔ دافئة', 'cool pinkish (−) to warm golden (+)'),
  stubble: P(0, 1, 0, 'Stubble shadow', 'ظل اللحية', 'shaved beard shadow on the jaw and upper lip'),
};
export const MAKEUP_PARAMS = {
  lipAmount: P(0, 1, 0.35, 'Lip colour strength', 'شدة لون الشفاه', 'how strongly the lip colour shows'),
  blush: P(0, 1, 0.15, 'Blush', 'احمرار الخدين', 'cheek colour'),
  eyeShadow: P(0, 1, 0, 'Eye shadow', 'ظل العيون', 'eye shadow amount'),
  eyeliner: P(0, 1, 0, 'Eyeliner', 'الكحل', 'eyeliner amount'),
};
export const BROW_PARAMS = {
  thickness: P(0.4, 1.8, 1, 'Thickness', 'السماكة', 'brow height / thickness'),
  density: P(0.3, 1.6, 1, 'Density', 'الكثافة', 'number of hairs'),
  arch: P(-1, 1, 0, 'Arch', 'التقوس', 'flat (−) to high arch (+)'),
  angle: P(-1, 1, 0, 'Angle', 'الميل', 'inner ends lower (+, stern) or higher (−, worried)'),
  length: P(0.6, 1.3, 1, 'Length', 'الطول', 'length toward the temples'),
  tail: P(-1, 1, 0, 'Tail drop', 'انخفاض الطرف', 'how much the outer tail drops'),
  spacing: P(-1, 1, 0, 'Gap between brows', 'المسافة بين الحاجبين', 'closer (−, unibrow) or wider (+)'),
  bushiness: P(0, 1, 0.15, 'Bushiness', 'الكثافة العشوائية', 'unruly, bushy hairs'),
};

export const DEFAULT_COLORS = {
  skin: '#C8906A', iris: '#5A3A22', sclera: '#F2EEE6', lash: '#1A1410', brow: '#2B1E16', lip: '#B5655F', blush: '#D9776B', eyeShadow: '#6E5A7E', eyeliner: '#151515',
};

export function createN3DDocument(over = {}) {
  const now = new Date().toISOString();
  return completeN3D({
    format: N3D_FORMAT, version: N3D_VERSION, mode: 'normal3d',
    meta: { id: 'n3d_' + Math.random().toString(36).slice(2, 10), name: 'New character', notes: '', createdAt: now, updatedAt: now },
    detail: 'standard',
    body: defaults(BODY_PARAMS), face: { ...defaults(FACE_PARAMS) },
    skin: { tone: DEFAULT_COLORS.skin },
    hair: { styleId: 'hair_crop_01', params: {}, colors: {} },
    outfit: [
      { assetId: 'top_tshirt_01', params: {}, colors: {}, material: {} },
      { assetId: 'bottom_jeans_01', params: {}, colors: {}, material: {} },
      { assetId: 'shoes_sneakers_01', params: {}, colors: {}, material: {} },
    ],
    accessories: [],
    ...over,
  });
}

const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);

/* ---------------------------------------------------------------- AI notes
 * What an AI model reports next to the character: what the reference shows,
 * observations with confidence values, guesses about hidden or unclear parts,
 * and visible features the library cannot reproduce yet. Kept with the
 * character (and in exports) so the app can show what it could not do. */
export const AI_LIMITS = { notes: 24, text: 400 };
export const REF_FRAMING = ['full', 'upper', 'head', 'partial', 'description'];
export const REF_STYLE = ['realistic', 'stylized', 'cartoon', 'anime'];
export const OBS_AREAS = ['body', 'face', 'skin', 'hair', 'outfit', 'footwear', 'accessories', 'other'];
const txt = v => (typeof v === 'string' ? v.trim().slice(0, AI_LIMITS.text) : '');
const conf = v => (typeof v === 'number' && isFinite(v) ? Math.round(Math.min(1, Math.max(0, v)) * 100) / 100 : undefined);
/** Clean AI notes (never throws). warn(path, message) receives what had to be fixed. Returns null when empty. */
export function cleanAiNotes(src, warn = () => {}) {
  if (!src || typeof src !== 'object') return null;
  const out = {};
  const list = (key, mapItem) => {
    const v = src[key];
    if (v === undefined || v === null) return;
    if (!Array.isArray(v)) { warn(key, 'must be an array'); return; }
    if (v.length > AI_LIMITS.notes) warn(key, `only the first ${AI_LIMITS.notes} entries are kept`);
    const res = v.slice(0, AI_LIMITS.notes).map((e, i) => mapItem(e, `${key}[${i}]`)).filter(Boolean);
    if (res.length) out[key] = res;
  };
  const confOf = (e, path) => {
    if (e.confidence === undefined) return undefined;
    const c = conf(e.confidence);
    if (c === undefined) warn(path + '.confidence', 'must be a number from 0 to 1');
    else if (c !== e.confidence) warn(path + '.confidence', `clamped to ${c} (0…1)`);
    return c;
  };
  if (src.reference !== undefined && src.reference !== null) {
    const r = typeof src.reference === 'string' ? { description: src.reference } : src.reference;
    if (typeof r !== 'object') warn('reference', 'must be an object { description, framing, style }');
    else {
      const ref = {};
      if (txt(r.description)) ref.description = txt(r.description);
      if (r.framing !== undefined) { if (REF_FRAMING.includes(r.framing)) ref.framing = r.framing; else warn('reference.framing', `use one of: ${REF_FRAMING.join(', ')}`); }
      if (r.style !== undefined) { if (REF_STYLE.includes(r.style)) ref.style = r.style; else warn('reference.style', `use one of: ${REF_STYLE.join(', ')}`); }
      if (Object.keys(ref).length) out.reference = ref;
    }
  }
  list('observations', (e, path) => {
    if (typeof e === 'string') e = { note: e };
    if (!e || typeof e !== 'object' || !txt(e.note ?? e.text)) { warn(path, 'needs a "note"'); return null; }
    let area = e.area;
    if (!OBS_AREAS.includes(area)) { if (area !== undefined) warn(path + '.area', `use one of: ${OBS_AREAS.join(', ')}`); area = 'other'; }
    const c = confOf(e, path);
    return { area, note: txt(e.note ?? e.text), ...(c !== undefined ? { confidence: c } : {}) };
  });
  list('uncertain', (e, path) => {
    if (typeof e === 'string') e = { note: e };
    if (!e || typeof e !== 'object' || !txt(e.note ?? e.reason ?? e.choice)) { warn(path, 'needs a "note"'); return null; }
    const c = confOf(e, path);
    return { ...(txt(e.field) ? { field: txt(e.field) } : {}), note: txt(e.note ?? e.reason ?? e.choice), ...(c !== undefined ? { confidence: c } : {}) };
  });
  list('unsupported', (e, path) => {
    if (typeof e === 'string') e = { feature: e };
    if (!e || typeof e !== 'object' || !txt(e.feature)) { warn(path, 'needs a "feature"'); return null; }
    return { feature: txt(e.feature), ...(txt(e.closestSubstitute) ? { closestSubstitute: txt(e.closestSubstitute) } : {}) };
  });
  if (!Object.keys(out).length) return null;
  if (typeof src.importedAt === 'string') out.importedAt = src.importedAt.slice(0, 40);
  return out;
}
const clampT = (table, src) => completeParams(table, src || {});
const hex = (v, d) => (typeof v === 'string' && HEX_RE.test(v) ? v.toUpperCase() : d);

/** Fill every missing field with defaults and clamp every number (never throws). */
export function completeN3D(doc) {
  const d = doc && typeof doc === 'object' ? doc : {};
  const face = d.face || {};
  const eyes = face.eyes || {}, brows = face.brows || {}, fh = face.facialHair || {}, mk = face.makeup || {};
  const skin = d.skin || {};
  const out = {
    format: N3D_FORMAT, version: N3D_VERSION, mode: 'normal3d',
    meta: { id: String(d.meta?.id || 'n3d_' + Math.random().toString(36).slice(2, 10)), name: String(d.meta?.name ?? 'Character').slice(0, 80), notes: String(d.meta?.notes ?? '').slice(0, 2000), createdAt: d.meta?.createdAt || new Date().toISOString(), updatedAt: d.meta?.updatedAt || new Date().toISOString() },
    detail: DETAIL_IDS.includes(d.detail) ? d.detail : 'standard',
    body: clampT(BODY_PARAMS, d.body),
    face: {
      ...clampT(FACE_PARAMS, face),
      eyes: { ...clampT(EYE_PARAMS, eyes), iris: hex(eyes.iris, DEFAULT_COLORS.iris), sclera: hex(eyes.sclera, DEFAULT_COLORS.sclera), lashColor: hex(eyes.lashColor, DEFAULT_COLORS.lash), heterochromia: hex(eyes.heterochromia, null) },
      brows: { styleId: typeof brows.styleId === 'string' ? brows.styleId : 'brow_natural_01', color: hex(brows.color, null), params: brows.params && typeof brows.params === 'object' ? { ...brows.params } : {} },
      facialHair: { styleId: typeof fh.styleId === 'string' ? fh.styleId : 'facial_none', params: fh.params && typeof fh.params === 'object' ? { ...fh.params } : {}, colors: fh.colors && typeof fh.colors === 'object' ? { ...fh.colors } : {} },
      makeup: { ...clampT(MAKEUP_PARAMS, mk), lipColor: hex(mk.lipColor, DEFAULT_COLORS.lip), blushColor: hex(mk.blushColor, DEFAULT_COLORS.blush), eyeShadowColor: hex(mk.eyeShadowColor, DEFAULT_COLORS.eyeShadow) },
    },
    skin: { ...clampT(SKIN_PARAMS, skin), tone: hex(skin.tone, DEFAULT_COLORS.skin), scars: Array.isArray(skin.scars) ? skin.scars.slice(0, 6).map(s => ({ at: ['cheekLeft', 'cheekRight', 'browLeft', 'browRight', 'chin', 'forehead', 'nose', 'lip'].includes(s?.at) ? s.at : 'cheekLeft', size: Math.max(0.2, Math.min(1, num(s?.size, 0.5))), angle: Math.max(-90, Math.min(90, num(s?.angle, 0))) })) : [] },
    hair: { styleId: typeof d.hair?.styleId === 'string' ? d.hair.styleId : 'hair_none', params: d.hair?.params && typeof d.hair.params === 'object' ? { ...d.hair.params } : {}, colors: d.hair?.colors && typeof d.hair.colors === 'object' ? { ...d.hair.colors } : {} },
    outfit: Array.isArray(d.outfit) ? d.outfit.filter(it => it && typeof it.assetId === 'string').map(item) : [],
    accessories: Array.isArray(d.accessories) ? d.accessories.filter(it => it && typeof it.assetId === 'string').map(item) : [],
  };
  const ai = cleanAiNotes(d.ai);
  if (ai) out.ai = ai;
  return out;
}
function item(it) {
  return {
    assetId: it.assetId,
    params: it.params && typeof it.params === 'object' ? { ...it.params } : {},
    colors: it.colors && typeof it.colors === 'object' ? { ...it.colors } : {},
    material: it.material && typeof it.material === 'object' ? { ...it.material } : {},
    ...(typeof it.attach === 'string' ? { attach: it.attach } : {}),
    ...(typeof it.uid === 'string' ? { uid: it.uid } : {}),
    ...(conf(it.confidence) !== undefined ? { confidence: conf(it.confidence) } : {}),
  };
}
