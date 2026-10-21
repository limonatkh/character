/* =====================================================================
 * NORMAL 3D DOCUMENT VALIDATOR ("limonat-character-3d" v1.x)
 *
 * Accepts a full document OR a partial one (what an AI model usually
 * writes: only the parts it wants to set). Never throws. Returns
 *   { ok, doc, errors: [{ path, message }], warnings: [{ path, message }], applied }
 * Errors are things that had to be dropped (unknown ids, wrong types);
 * warnings are things that were fixed (clamped numbers, defaults filled,
 * colours normalised). `doc` is always a complete, safe document.
 *
 * mode 'replace': the input describes a whole character (missing → default)
 * mode 'merge':   the input changes the given base document (missing → keep)
 * AI notes (reference, observations, uncertain, unsupported — top level or
 * inside "ai") never block a document: bad entries are dropped with a warning.
 * ===================================================================== */
import { BODY_PARAMS, FACE_PARAMS } from '../core/params.js';
import { completeN3D, N3D_FORMAT, EYE_PARAMS, SKIN_PARAMS, MAKEUP_PARAMS, BROW_PARAMS, HEX_RE, cleanAiNotes } from '../core/document.js';
import { getAsset, SLOTS, allAssets } from '../core/registry.js';
import { DETAIL_IDS } from '../core/detail.js';
import { FABRICS, PATTERNS, HARDWARE } from '../materials/fabrics.js';

export const LIMITS = { outfit: 14, accessories: 12, scars: 6, name: 80 };
const OUTFIT_SLOTS = ['top', 'mid', 'outer', 'bottom', 'fullBody', 'footwear'];
const ACC_SLOTS = ['headwear', 'neckwear', 'handwear', 'eyewear', 'jewelry', 'bag', 'belt'];
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const clone = v => JSON.parse(JSON.stringify(v));

export function validateN3D(input, opts = {}) {
  const errors = [], warnings = [];
  const err = (path, message) => errors.push({ path, message });
  const warn = (path, message) => warnings.push({ path, message });
  let src = input;
  if (typeof src === 'string') {
    try { src = JSON.parse(extractJson(src)); } catch (e) { return { ok: false, doc: completeN3D(opts.base || {}), errors: [{ path: '', message: 'Not valid JSON: ' + e.message }], warnings }; }
  }
  if (!isObj(src)) return { ok: false, doc: completeN3D(opts.base || {}), errors: [{ path: '', message: 'Expected a JSON object' }], warnings };
  // voxel documents belong to the other creation mode
  const voxel = src.kind === 'limonat-character' || (src.schemaVersion && src.baseCharacter) || (src.mode && !['normal3d', 'replace', 'merge'].includes(src.mode) && isObj(src.character));
  if (voxel) return { ok: false, doc: completeN3D(opts.base || {}), errors: [{ path: '', message: 'This is a Voxel character document; open it in the Voxel mode (the Normal 3D creator expects format "' + N3D_FORMAT + '", mode "normal3d")' }], warnings };
  // allow { character: {...} } wrappers
  if (isObj(src.character) && !src.body && !src.outfit) src = { ...src.character, mode: src.mode ?? src.character.mode };
  if (src.mode && src.mode !== 'normal3d') err('mode', `This is a "${src.mode}" document; the Normal 3D creator expects mode "normal3d" (voxel characters belong to the Voxel mode)`);
  if (src.format && src.format !== N3D_FORMAT) warn('format', `format should be "${N3D_FORMAT}" (got "${src.format}")`);
  if (src.version && !/^1\./.test(String(src.version))) warn('version', `version ${src.version} is newer than this creator (1.x); unknown fields are ignored`);
  const merge = opts.mode === 'merge' && opts.base;
  const out = merge ? clone(opts.base) : {};
  const known = ['format', 'version', 'mode', 'meta', 'name', 'detail', 'body', 'face', 'skin', 'hair', 'outfit', 'accessories', '$schema', 'notes', 'reference', 'observations', 'uncertain', 'unsupported', 'ai'];
  for (const k of Object.keys(src)) if (!known.includes(k)) warn(k, 'unknown field ignored');

  // ---- AI notes: what the reference shows, observations + confidence, guesses, unsupported features
  const aiSrc = isObj(src.ai) ? src.ai : {};
  const noteKeys = ['reference', 'observations', 'uncertain', 'unsupported'];
  if (noteKeys.some(k => src[k] !== undefined || aiSrc[k] !== undefined)) {
    const ai = cleanAiNotes(Object.fromEntries(noteKeys.map(k => [k, src[k] !== undefined ? src[k] : aiSrc[k]])), warn);
    if (ai) out.ai = { ...ai, importedAt: new Date().toISOString() }; else delete out.ai;
  }

  // ---- meta / name
  out.meta = { ...(out.meta || {}), ...(isObj(src.meta) ? src.meta : {}) };
  if (typeof src.name === 'string') out.meta.name = src.name;
  if (typeof src.notes === 'string') out.meta.notes = src.notes;
  if (out.meta.name && String(out.meta.name).length > LIMITS.name) { warn('meta.name', `name shortened to ${LIMITS.name} characters`); out.meta.name = String(out.meta.name).slice(0, LIMITS.name); }
  if (src.detail !== undefined) { if (DETAIL_IDS.includes(src.detail)) out.detail = src.detail; else warn('detail', `unknown detail level "${src.detail}" (use ${DETAIL_IDS.join(', ')})`); }

  // ---- numeric tables
  const table = (path, tbl, val, into) => {
    if (val === undefined) return;
    if (!isObj(val)) { err(path, 'must be an object'); return; }
    for (const [k, v] of Object.entries(val)) {
      const spec = tbl[k];
      if (!spec) { if (typeof v !== 'object') warn(`${path}.${k}`, 'unknown parameter ignored'); continue; }
      if (typeof v !== 'number' || !isFinite(v)) { err(`${path}.${k}`, `must be a number (${spec.min}…${spec.max})`); continue; }
      const c = Math.min(spec.max, Math.max(spec.min, v));
      if (c !== v) warn(`${path}.${k}`, `${v} clamped to ${c} (range ${spec.min}…${spec.max})`);
      into[k] = c;
    }
  };
  out.body = { ...(out.body || {}) };
  table('body', BODY_PARAMS, src.body, out.body);
  out.face = { ...(out.face || {}) };
  const sf = isObj(src.face) ? src.face : undefined;
  if (src.face !== undefined && !sf) err('face', 'must be an object');
  if (sf) {
    const numeric = Object.fromEntries(Object.entries(sf).filter(([, v]) => typeof v !== 'object'));
    table('face', FACE_PARAMS, numeric, out.face);
    if (sf.eyes !== undefined) {
      const e = { ...(out.face.eyes || {}) };
      if (!isObj(sf.eyes)) err('face.eyes', 'must be an object');
      else {
        table('face.eyes', EYE_PARAMS, Object.fromEntries(Object.entries(sf.eyes).filter(([k]) => EYE_PARAMS[k])), e);
        if (sf.eyes.heterochromia === null) e.heterochromia = null;          // null = unset (same iris colour on both eyes)
        for (const k of ['iris', 'sclera', 'lashColor', 'heterochromia']) if (sf.eyes[k] !== undefined && sf.eyes[k] !== null) { const c = color(sf.eyes[k]); if (c) e[k] = c; else err(`face.eyes.${k}`, 'must be a #RRGGBB colour'); }
      }
      out.face.eyes = e;
    }
    if (sf.brows !== undefined) out.face.brows = styled('face.brows', sf.brows, out.face.brows, 'browStyle', BROW_PARAMS, ['color']);
    if (sf.facialHair !== undefined) out.face.facialHair = styled('face.facialHair', sf.facialHair, out.face.facialHair, 'facialHair', null, null);
    if (sf.makeup !== undefined) {
      const mk = { ...(out.face.makeup || {}) };
      if (!isObj(sf.makeup)) err('face.makeup', 'must be an object');
      else {
        table('face.makeup', MAKEUP_PARAMS, Object.fromEntries(Object.entries(sf.makeup).filter(([k]) => MAKEUP_PARAMS[k])), mk);
        for (const k of ['lipColor', 'blushColor', 'eyeShadowColor']) if (sf.makeup[k] !== undefined) { const c = color(sf.makeup[k]); if (c) mk[k] = c; else err(`face.makeup.${k}`, 'must be a #RRGGBB colour'); }
      }
      out.face.makeup = mk;
    }
  }
  // ---- skin
  if (src.skin !== undefined) {
    const sk = { ...(out.skin || {}) };
    if (!isObj(src.skin)) err('skin', 'must be an object');
    else {
      table('skin', SKIN_PARAMS, Object.fromEntries(Object.entries(src.skin).filter(([k]) => SKIN_PARAMS[k])), sk);
      if (src.skin.tone !== undefined) { const c = color(src.skin.tone); if (c) sk.tone = c; else err('skin.tone', 'must be a #RRGGBB colour'); }
      if (src.skin.scars !== undefined) {
        if (!Array.isArray(src.skin.scars)) err('skin.scars', 'must be an array');
        else { if (src.skin.scars.length > LIMITS.scars) warn('skin.scars', `only the first ${LIMITS.scars} scars are kept`); sk.scars = src.skin.scars.slice(0, LIMITS.scars); }
      }
    }
    out.skin = sk;
  }
  // ---- hair
  if (src.hair !== undefined) out.hair = styled('hair', src.hair, out.hair, 'hairStyle', null, null);

  // ---- outfit and accessories
  const items = (path, list, slots, limit, prev) => {
    if (list === undefined) return prev || [];
    if (!Array.isArray(list)) { err(path, 'must be an array'); return prev || []; }
    if (list.length > limit) warn(path, `only the first ${limit} items are kept`);
    const res = [];
    list.slice(0, limit).forEach((it, i) => {
      const p = `${path}[${i}]`;
      if (typeof it === 'string') it = { assetId: it };
      if (!isObj(it) || typeof it.assetId !== 'string') { err(p, 'needs an "assetId" string'); return; }
      const a = getAsset(it.assetId);
      if (!a) { err(`${p}.assetId`, `unknown asset "${it.assetId}"${suggest(it.assetId, slots)}`); return; }
      if (!slots.includes(a.slot)) { err(`${p}.assetId`, `"${it.assetId}" is a ${a.slot} asset and does not belong in ${path}`); return; }
      res.push(cleanItem(p, it, a));
    });
    return res;
  };
  out.outfit = items('outfit', src.outfit, OUTFIT_SLOTS, LIMITS.outfit, out.outfit);
  out.accessories = items('accessories', src.accessories, ACC_SLOTS, LIMITS.accessories, out.accessories);
  // ---- conflicts
  const count = slot => out.outfit.filter(it => getAsset(it.assetId)?.slot === slot).length;
  if (count('footwear') > 1) warn('outfit', 'more than one pair of footwear: only the first pair is worn');
  if (count('fullBody') && (count('top') || count('bottom'))) warn('outfit', 'a full-body garment with tops / bottoms: they are layered (tops tucked under, others over)');
  const heads = out.accessories.filter(it => getAsset(it.assetId)?.slot === 'headwear').length;
  if (heads > 1) warn('accessories', 'more than one head covering: all are built, they may overlap');
  if (count('footwear') > 1) { let seen = false; out.outfit = out.outfit.filter(it => { if (getAsset(it.assetId)?.slot !== 'footwear') return true; if (seen) return false; seen = true; return true; }); }

  const doc = completeN3D(out);
  return { ok: errors.length === 0, doc, errors, warnings };

  // ------------------------------------------------------------ helpers
  function styled(path, val, prev, slot, numTable, colorKeys) {
    const res = { ...(prev || {}) };
    if (typeof val === 'string') val = { styleId: val };
    if (!isObj(val)) { err(path, 'must be an object'); return res; }
    if (val.styleId !== undefined) {
      const a = getAsset(val.styleId);
      if (!a || a.slot !== slot) err(`${path}.styleId`, `unknown ${SLOTS[slot].label.en.toLowerCase()} "${val.styleId}"${suggest(String(val.styleId), [slot])}`);
      else { res.styleId = a.id; if (!prev || prev.styleId !== a.id) { res.params = {}; res.colors = {}; } }
    }
    const a = getAsset(res.styleId);
    if (val.params !== undefined) {
      if (!isObj(val.params)) err(`${path}.params`, 'must be an object');
      else {
        res.params = { ...(res.params || {}) };
        const spec = numTable || (a ? a.params : {});
        for (const [k, v] of Object.entries(val.params)) {
          const s = spec[k];
          if (!s) { warn(`${path}.params.${k}`, 'unknown parameter ignored'); continue; }
          res.params[k] = param(`${path}.params.${k}`, s, v) ?? res.params[k];
          if (res.params[k] === undefined) delete res.params[k];
        }
      }
    }
    if (val.colors !== undefined) {
      if (!isObj(val.colors)) err(`${path}.colors`, 'must be an object');
      else {
        res.colors = { ...(res.colors || {}) };
        for (const [k, v] of Object.entries(val.colors)) {
          if (a && a.colors && !a.colors[k]) { warn(`${path}.colors.${k}`, `"${k}" is not a colour of this style (${Object.keys(a.colors || {}).join(', ') || 'none'})`); continue; }
          const c = color(v); if (c) res.colors[k] = c; else err(`${path}.colors.${k}`, 'must be a #RRGGBB colour');
        }
      }
    }
    for (const k of colorKeys || []) if (val[k] === null) res[k] = null; else if (val[k] !== undefined) { const c = color(val[k]); if (c) res[k] = c; else err(`${path}.${k}`, 'must be a #RRGGBB colour'); }
    return res;
  }
  function cleanItem(p, it, a) {
    const res = { assetId: a.id, params: {}, colors: {}, material: {} };
    if (typeof it.uid === 'string') res.uid = it.uid;
    if (it.confidence !== undefined) {
      if (typeof it.confidence !== 'number' || !isFinite(it.confidence)) warn(`${p}.confidence`, 'must be a number from 0 to 1');
      else { const c = Math.min(1, Math.max(0, it.confidence)); if (c !== it.confidence) warn(`${p}.confidence`, `clamped to ${c} (0…1)`); res.confidence = c; }
    }
    if (it.params !== undefined) {
      if (!isObj(it.params)) err(`${p}.params`, 'must be an object');
      else for (const [k, v] of Object.entries(it.params)) {
        const s = a.params[k];
        if (!s) { warn(`${p}.params.${k}`, `"${a.id}" has no parameter "${k}" (it has: ${Object.keys(a.params).join(', ') || 'none'})`); continue; }
        const val = param(`${p}.params.${k}`, s, v);
        if (val !== undefined) res.params[k] = val;
      }
    }
    if (it.colors !== undefined) {
      if (!isObj(it.colors)) err(`${p}.colors`, 'must be an object');
      else for (const [k, v] of Object.entries(it.colors)) {
        if (!a.colors[k]) { warn(`${p}.colors.${k}`, `"${a.id}" has no colour "${k}" (it has: ${Object.keys(a.colors).join(', ')})`); continue; }
        const c = color(v); if (c) res.colors[k] = c; else err(`${p}.colors.${k}`, 'must be a #RRGGBB colour');
      }
    }
    if (it.material !== undefined) {
      if (!isObj(it.material)) err(`${p}.material`, 'must be an object');
      else {
        const m = it.material;
        if (m.fabric !== undefined) { if (!FABRICS[m.fabric]) err(`${p}.material.fabric`, `unknown fabric "${m.fabric}"`); else if (a.fabrics && a.fabrics.length && !a.fabrics.includes(m.fabric)) warn(`${p}.material.fabric`, `"${m.fabric}" is not offered for ${a.id} (use ${a.fabrics.join(', ')})`); else res.material.fabric = m.fabric; }
        if (m.pattern !== undefined) { if (!PATTERNS[m.pattern]) err(`${p}.material.pattern`, `unknown pattern "${m.pattern}"`); else res.material.pattern = m.pattern; }
        if (m.hardware !== undefined) { if (!HARDWARE[m.hardware]) err(`${p}.material.hardware`, `unknown hardware finish "${m.hardware}"`); else res.material.hardware = m.hardware; }
        for (const [k, lo, hi] of [['patternScale', 0.25, 4], ['wear', 0, 1]]) if (m[k] !== undefined) { if (typeof m[k] !== 'number' || !isFinite(m[k])) err(`${p}.material.${k}`, 'must be a number'); else { const c = Math.min(hi, Math.max(lo, m[k])); if (c !== m[k]) warn(`${p}.material.${k}`, `clamped to ${c}`); res.material[k] = c; } }
      }
    }
    return res;
  }
  function param(path, s, v) {
    if (s.type === 'number') {
      if (typeof v !== 'number' || !isFinite(v)) { err(path, `must be a number (${s.min}…${s.max})`); return undefined; }
      const c = Math.min(s.max, Math.max(s.min, v));
      if (c !== v) warn(path, `${v} clamped to ${c}`);
      return s.step === 1 ? Math.round(c) : c;
    }
    if (s.type === 'enum') { if (!s.values.includes(v)) { err(path, `must be one of: ${s.values.join(', ')}`); return undefined; } return v; }
    if (s.type === 'bool') { if (typeof v !== 'boolean') { err(path, 'must be true or false'); return undefined; } return v; }
    if (typeof s.min === 'number') { // body/face style tables (no type)
      if (typeof v !== 'number' || !isFinite(v)) { err(path, `must be a number (${s.min}…${s.max})`); return undefined; }
      const c = Math.min(s.max, Math.max(s.min, v)); if (c !== v) warn(path, `${v} clamped to ${c}`); return c;
    }
    return undefined;
  }
  function color(v) {
    if (typeof v !== 'string') return null;
    let s = v.trim();
    if (/^#?[0-9a-fA-F]{3}$/.test(s)) { s = s.replace('#', ''); s = '#' + s.split('').map(c => c + c).join(''); }
    if (/^[0-9a-fA-F]{6}$/.test(s)) s = '#' + s;
    if (!HEX_RE.test(s)) return null;
    if (s !== v) warn('', `colour "${v}" normalised to ${s.toUpperCase()}`);
    return s.toUpperCase();
  }
}

/** Find the JSON object inside text that may contain prose or code fences. */
export function extractJson(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1];
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  return a >= 0 && b > a ? text.slice(a, b + 1) : text;
}

/** Closest known id (for helpful error messages). */
function suggest(id, slots) {
  const pool = [];
  for (const a of allAssets()) if (slots.includes(a.slot)) pool.push(a.id);
  let best = null, bd = Infinity;
  for (const p of pool) { const d = lev(id, p); if (d < bd) { bd = d; best = p; } }
  return best && bd <= Math.max(3, id.length * 0.4) ? ` — did you mean "${best}"?` : '';
}
function lev(a, b) {
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
