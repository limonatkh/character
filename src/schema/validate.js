/* =====================================================================
 * VALIDATOR — AI output is UNTRUSTED DATA.
 *
 * Nothing in the input is ever executed or used as code. The validator
 * only reads known properties, copies validated values into a fresh
 * character config, and reports everything else in plain language.
 *   errors   → the import is rejected (the current character is kept),
 *              but the user may choose to apply only the valid fields
 *   warnings → applied with a fallback (clamped number, default option…)
 *   info     → notes (AI's uncertain/unsupported list, ignored values)
 * ===================================================================== */
import { parseHex, isHex } from '../core/color.js';
import { getAsset, getBase, listBases, listAssets, defaultBaseId, SLOTS } from '../core/registry.js';
import { ATTACH_POINTS } from '../core/skeleton.js';
import {
  SCHEMA_VERSION, DOC_KIND, PROPORTIONS, PROPORTION_KEYS, GAZE, SIDES, MODES, REFERENCE_SOURCES,
  MATERIALS, LIMITS, TOP_LEVEL_KEYS, ITEM_FIELDS,
} from './schema.js';

const own = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const clone = v => JSON.parse(JSON.stringify(v));
const typeName = v => v === null ? 'null' : Array.isArray(v) ? 'a list' : typeof v === 'object' ? 'an object' : typeof v === 'string' ? `the text "${v.slice(0, 40)}"` : `${typeof v} ${String(v)}`;
const short = v => { const s = typeof v === 'string' ? v : JSON.stringify(v); return s && s.length > 40 ? s.slice(0, 40) + '…' : s; };

// ------------------------------------------------------------------ JSON extraction
/**
 * Get a JSON value out of whatever the user pasted. AI models sometimes add
 * Markdown fences or a sentence before the JSON; those are stripped with a note.
 * Returns { value, notes: [string], error: string | null }.
 */
export function extractJson(text) {
  const notes = [];
  if (typeof text !== 'string' || !text.trim()) return { value: null, notes, error: 'The text box is empty. Paste the JSON produced by the AI model.' };
  if (text.length > LIMITS.maxInputChars) return { value: null, notes, error: `The input is too large (${text.length} characters, limit ${LIMITS.maxInputChars}).` };
  let s = text.trim().replace(/^﻿/, '');
  const tryParse = str => { try { return { ok: true, v: JSON.parse(str) }; } catch (e) { return { ok: false, e }; } };
  let r = tryParse(s);
  if (r.ok) return { value: r.v, notes, error: null };
  const firstError = r.e;

  const fence = s.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fence) { s = fence[1].trim(); notes.push('Removed Markdown code fences (```) around the JSON.'); r = tryParse(s); if (r.ok) return { value: r.v, notes, error: null }; }

  const obj = sliceObject(s);
  if (obj && obj.text !== s) {
    if (obj.before) notes.push('Ignored text before the JSON.');
    if (obj.after) notes.push('Ignored text after the JSON.');
    s = obj.text; r = tryParse(s);
    if (r.ok) return { value: r.v, notes, error: null };
  }
  // common AI typos: smart quotes, trailing commas
  let fixed = s.replace(/[“”]/g, '"');
  if (fixed !== s) { r = tryParse(fixed); if (r.ok) { notes.push('Replaced curly quotes “ ” with straight quotes.'); return { value: r.v, notes, error: null }; } }
  const noTrailing = fixed.replace(/,(\s*[}\]])/g, '$1');
  if (noTrailing !== fixed) { r = tryParse(noTrailing); if (r.ok) { notes.push('Removed trailing commas.'); if (fixed !== s) notes.push('Replaced curly quotes with straight quotes.'); return { value: r.v, notes, error: null }; } }
  return { value: null, notes, error: describeJsonError(firstError, text.trim()) };
}

function sliceObject(s) {
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return { text: s.slice(start, i + 1), before: s.slice(0, start).trim().length > 0, after: s.slice(i + 1).trim().length > 0 }; }
  }
  return null;
}

function describeJsonError(e, text) {
  const msg = (e && e.message) || 'parse error';
  const m = msg.match(/position (\d+)/);
  if (m) {
    const pos = +m[1], before = text.slice(0, pos), line = before.split('\n').length, col = pos - before.lastIndexOf('\n');
    const near = text.slice(Math.max(0, pos - 15), pos + 15).replace(/\n/g, ' ');
    return `This is not valid JSON (problem at line ${line}, column ${col}, near "${near}"). Check for missing commas, quotes or brackets.`;
  }
  return `This is not valid JSON (${msg}). Check for missing commas, quotes or brackets.`;
}

// ------------------------------------------------------------------ suggestions
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function suggestIds(value, slot) {
  const ids = listAssets(slot).map(a => a.id);
  const v = String(value).toLowerCase();
  const tokens = v.split(/[^a-z0-9]+/).filter(t => t.length > 2 && !/^\d+$/.test(t));
  const scored = ids.map(id => {
    const a = getAsset(id), hay = (id + ' ' + a.tags.join(' ') + ' ' + a.label.en).toLowerCase();
    const hits = tokens.filter(t => hay.includes(t)).length;
    return { id, score: hits * 10 - lev(v, id) };
  }).sort((a, b) => b.score - a.score);
  return { best: scored.slice(0, 2).map(s => s.id), all: ids };
}
function unknownIdMessage(value, slot) {
  const { best, all } = suggestIds(value, slot);
  const label = SLOTS[slot].label.en.toLowerCase();
  return `"${short(value)}" is not a ${label} asset in this app. Did you mean ${best.map(b => `"${b}"`).join(' or ')}? Available: ${all.join(', ')}.`;
}

// ------------------------------------------------------------------ report
class Report {
  constructor() { this.items = []; this.applied = 0; }
  error(path, message) { this.items.push({ level: 'error', path, message }); }
  warn(path, message) { this.items.push({ level: 'warning', path, message }); }
  info(path, message) { this.items.push({ level: 'info', path, message }); }
  get errors() { return this.items.filter(i => i.level === 'error'); }
  get warnings() { return this.items.filter(i => i.level === 'warning'); }
  get infos() { return this.items.filter(i => i.level === 'info'); }
}
function warnUnknownKeys(obj, allowed, path, R, extraAllowed = []) {
  for (const k of Object.keys(obj)) if (!allowed.includes(k) && !extraAllowed.includes(k)) R.warn(path ? `${path}.${k}` : k, `"${k}" is not part of the schema here and was ignored.`);
}

// ------------------------------------------------------------------ completion (defaults + pruning)
function completeItem(src, spec, fallback) {
  let id = src && typeof src[spec.id] === 'string' ? src[spec.id] : null;
  let a = id && getAsset(id);
  if (!a || a.slot !== spec.slot) { id = fallback[spec.id]; a = getAsset(id); }
  const o = { [spec.id]: id };
  for (const c of a.colors) o[c.key] = src && isHex(src[c.key]) ? src[c.key].toUpperCase() : c.default;
  if (spec.material && a.colors.length) o.material = src && MATERIALS.includes(src.material) ? src.material : (a.material || 'cloth');
  if (spec.extra?.includes('gaze')) o.gaze = src && GAZE.includes(src.gaze) ? src.gaze : 'center';
  if (spec.extra?.includes('side') && a.sides) o.side = src && a.sides.includes(src.side) ? src.side : (a.defaultSide || a.sides[0]);
  if (spec.extra?.includes('attachTo')) o.attachTo = src && a.attach.points.includes(src.attachTo) ? src.attachTo : a.attach.default;
  return o;
}
function completeList(list, spec, max) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const it of list.slice(0, max)) {
    const a = it && typeof it.assetId === 'string' && getAsset(it.assetId);
    if (a && a.slot === spec.slot) out.push(completeItem(it, spec, { assetId: a.id }));
  }
  return out;
}

/** Fill every field of a (possibly partial) config with valid values. Never throws. */
export function completeConfig(input) {
  const base = getBase(defaultBaseId()).character;
  const c = isObj(input) ? input : {};
  const body = isObj(c.body) ? c.body : {}, head = isObj(c.head) ? c.head : {}, face = isObj(c.face) ? c.face : {}, cl = isObj(c.clothing) ? c.clothing : {};
  const props = {};
  for (const k of PROPORTION_KEYS) {
    const v = isObj(body.proportions) ? body.proportions[k] : undefined, P = PROPORTIONS[k];
    props[k] = typeof v === 'number' && isFinite(v) ? Math.min(P.max, Math.max(P.min, Math.round(v * 1000) / 1000)) : P.default;
  }
  const bt = getAsset(body.typeId), hs = getAsset(head.shapeId);
  return {
    name: typeof c.name === 'string' && c.name.trim() ? c.name.trim().slice(0, LIMITS.maxName) : base.name,
    body: {
      typeId: bt && bt.slot === 'bodyType' ? bt.id : base.body.typeId,
      skinColor: isHex(body.skinColor) ? body.skinColor.toUpperCase() : base.body.skinColor,
      proportions: props,
    },
    head: { shapeId: hs && hs.slot === 'headShape' ? hs.id : base.head.shapeId },
    hair: completeItem(c.hair, ITEM_FIELDS.hair, base.hair),
    face: {
      eyes: completeItem(face.eyes, ITEM_FIELDS.eyes, base.face.eyes),
      eyebrows: completeItem(face.eyebrows, ITEM_FIELDS.eyebrows, base.face.eyebrows),
      mouth: completeItem(face.mouth, ITEM_FIELDS.mouth, base.face.mouth),
      facialHair: completeItem(face.facialHair, ITEM_FIELDS.facialHair, base.face.facialHair),
      details: completeList(face.details, ITEM_FIELDS.detail, LIMITS.maxDetails),
    },
    headwear: completeItem(c.headwear, ITEM_FIELDS.headwear, base.headwear),
    clothing: {
      top: completeItem(cl.top, ITEM_FIELDS.top, base.clothing.top),
      outerwear: completeItem(cl.outerwear, ITEM_FIELDS.outerwear, base.clothing.outerwear),
      bottom: completeItem(cl.bottom, ITEM_FIELDS.bottom, base.clothing.bottom),
      shoes: completeItem(cl.shoes, ITEM_FIELDS.shoes, base.clothing.shoes),
    },
    accessories: completeList(c.accessories, ITEM_FIELDS.accessory, LIMITS.maxAccessories),
  };
}

/** Full default config of a base character. */
export function baseConfig(baseId) {
  const b = getBase(baseId) || getBase(defaultBaseId());
  return completeConfig(clone(b.character));
}

// ------------------------------------------------------------------ item application
/**
 * Apply one item (hair, top, accessory…) from untrusted `src` onto `target`.
 * Returns false when the item must be dropped (lists only).
 */
function applyItem(src, target, path, spec, R, isNew) {
  if (!isObj(src)) { R.error(path, `Must be an object like { "${spec.id}": "…" }, but got ${typeName(src)}.`); return false; }
  const alias = spec.id === 'styleId' ? 'assetId' : 'styleId';
  const allowed = [spec.id, ...(spec.colors ? ['color', 'secondaryColor'] : []), ...(spec.material ? ['material'] : []), ...(spec.extra || [])];
  warnUnknownKeys(src, allowed, path, R, [alias]);

  let idVal, idPath = `${path}.${spec.id}`;
  if (own(src, spec.id)) idVal = src[spec.id];
  else if (own(src, alias)) { idVal = src[alias]; idPath = `${path}.${alias}`; R.warn(idPath, `Use "${spec.id}" for this item; "${alias}" was accepted.`); }

  let asset = target[spec.id] ? getAsset(target[spec.id]) : null;
  if (idVal !== undefined) {
    const a = typeof idVal === 'string' ? getAsset(idVal) : null;
    let bad = null;
    if (typeof idVal !== 'string') bad = `The id must be text, but got ${typeName(idVal)}.`;
    else if (!a) bad = unknownIdMessage(idVal, spec.slot);
    else if (a.slot !== spec.slot) bad = `"${idVal}" is a ${SLOTS[a.slot].label.en.toLowerCase()} asset and cannot be used as ${SLOTS[spec.slot].label.en.toLowerCase()}.`;
    if (bad) {
      R.error(idPath, bad);
      // still check the colours so every problem is reported at once
      for (const key of ['color', 'secondaryColor']) if (spec.colors && own(src, key) && !parseHex(src[key])) R.error(`${path}.${key}`, `Expected a hex colour like "#D92F35", but got ${typeName(src[key])}.`);
      return false;
    }
    if (a.id !== target[spec.id]) {
      // a different asset: start from its own default colours / material
      for (const k of ['color', 'secondaryColor', 'material', 'side', 'attachTo']) delete target[k];
      Object.assign(target, completeItem({ [spec.id]: a.id }, spec, { [spec.id]: a.id }));
    }
    target[spec.id] = a.id;
    asset = a;
    R.applied++;
  } else if (isNew) {
    R.error(path, `Missing "${spec.id}".`);
    return false;
  }

  for (const key of ['color', 'secondaryColor']) {
    if (!spec.colors || !own(src, key)) continue;
    const p = parseHex(src[key]);
    if (!p) { R.error(`${path}.${key}`, `Expected a hex colour like "#D92F35", but got ${typeName(src[key])}.`); continue; }
    if (p.expanded) R.warn(`${path}.${key}`, `Short colour "${src[key]}" was expanded to ${p.value}.`);
    if (!asset.colors.some(c => c.key === key)) { R.info(`${path}.${key}`, `${asset.id} has no ${key === 'color' ? 'main' : 'secondary'} colour, so ${p.value} is not used.`); continue; }
    target[key] = p.value;
    R.applied++;
  }
  if (spec.material && own(src, 'material')) {
    if (MATERIALS.includes(src.material)) { if (asset.colors.length) { target.material = src.material; R.applied++; } }
    else R.warn(`${path}.material`, `Unknown material "${short(src.material)}"; kept "${target.material || asset.material || 'cloth'}". Allowed: ${MATERIALS.join(', ')}.`);
  }
  if (spec.extra?.includes('gaze') && own(src, 'gaze')) {
    if (GAZE.includes(src.gaze)) { target.gaze = src.gaze; R.applied++; }
    else R.warn(`${path}.gaze`, `Unknown gaze "${short(src.gaze)}"; kept "${target.gaze || 'center'}". Allowed: ${GAZE.join(', ')}.`);
  }
  if (spec.extra?.includes('side') && own(src, 'side')) {
    if (!asset.sides) R.info(`${path}.side`, `${asset.id} is always drawn on both sides; "side" was ignored.`);
    else if (asset.sides.includes(src.side)) { target.side = src.side; R.applied++; }
    else R.warn(`${path}.side`, `Unknown side "${short(src.side)}"; used "${target.side}". Allowed: ${asset.sides.join(', ')}.`);
  }
  if (spec.extra?.includes('attachTo') && own(src, 'attachTo')) {
    if (asset.attach.points.includes(src.attachTo)) { target.attachTo = src.attachTo; R.applied++; }
    else {
      const known = ATTACH_POINTS[src.attachTo] ? `"${src.attachTo}" is not supported for ${asset.id}` : `Unknown attachment point "${short(src.attachTo)}"`;
      R.warn(`${path}.attachTo`, `${known}; used "${target.attachTo}". ${asset.id} supports: ${asset.attach.points.join(', ')}.`);
    }
  }
  return true;
}

function applyList(list, path, spec, max, R) {
  if (!Array.isArray(list)) { R.error(path, `Must be a list [ … ], but got ${typeName(list)}.`); return null; }
  if (list.length > max) R.warn(path, `Only the first ${max} entries are used (${list.length} given).`);
  const out = [], seen = new Set();
  list.slice(0, max).forEach((src, i) => {
    const t = {};
    if (!applyItem(src, t, `${path}[${i}]`, spec, R, true)) return;
    const full = completeItem(t, spec, { [spec.id]: t[spec.id] });
    const key = full[spec.id] + '|' + (full.attachTo || full.side || '');
    if (seen.has(key)) { R.warn(`${path}[${i}]`, `Duplicate ${full[spec.id]} was removed.`); return; }
    seen.add(key);
    out.push(full);
  });
  return out;
}

// ------------------------------------------------------------------ character section
function applyCharacter(c, cfg, R) {
  warnUnknownKeys(c, ['name', 'body', 'head', 'hair', 'face', 'headwear', 'clothing', 'accessories'], 'character', R);
  if (own(c, 'name')) {
    if (typeof c.name !== 'string' || !c.name.trim()) R.warn('character.name', 'The name must be non-empty text; it was not changed.');
    else { if (c.name.trim().length > LIMITS.maxName) R.warn('character.name', `The name was shortened to ${LIMITS.maxName} characters.`); cfg.name = c.name.trim().slice(0, LIMITS.maxName); R.applied++; }
  }
  if (own(c, 'body')) {
    const b = c.body;
    if (!isObj(b)) R.error('character.body', `Must be an object, but got ${typeName(b)}.`);
    else {
      warnUnknownKeys(b, ['typeId', 'skinColor', 'proportions'], 'character.body', R);
      if (own(b, 'typeId')) {
        const a = typeof b.typeId === 'string' && getAsset(b.typeId);
        if (a && a.slot === 'bodyType') { cfg.body.typeId = a.id; R.applied++; } else R.error('character.body.typeId', unknownIdMessage(b.typeId, 'bodyType'));
      }
      if (own(b, 'skinColor')) {
        const p = parseHex(b.skinColor);
        if (!p) R.error('character.body.skinColor', `Expected a hex colour like "#D6A078", but got ${typeName(b.skinColor)}.`);
        else { if (p.expanded) R.warn('character.body.skinColor', `Short colour expanded to ${p.value}.`); cfg.body.skinColor = p.value; R.applied++; }
      }
      if (own(b, 'proportions')) {
        const P = b.proportions;
        if (!isObj(P)) R.error('character.body.proportions', `Must be an object like { "headScale": 1.1 }, but got ${typeName(P)}.`);
        else {
          warnUnknownKeys(P, PROPORTION_KEYS, 'character.body.proportions', R);
          for (const k of PROPORTION_KEYS) {
            if (!own(P, k)) continue;
            const v = P[k], lim = PROPORTIONS[k], path = `character.body.proportions.${k}`;
            if (typeof v !== 'number' || !isFinite(v)) { R.error(path, `Must be a number between ${lim.min} and ${lim.max}, but got ${typeName(v)}.`); continue; }
            const cl = Math.min(lim.max, Math.max(lim.min, v));
            if (cl !== v) R.warn(path, `${v} is outside the safe range ${lim.min}–${lim.max}; clamped to ${cl}.`);
            cfg.body.proportions[k] = Math.round(cl * 1000) / 1000;
            R.applied++;
          }
        }
      }
    }
  }
  if (own(c, 'head')) {
    if (!isObj(c.head)) R.error('character.head', `Must be an object like { "shapeId": "head_round_01" }, but got ${typeName(c.head)}.`);
    else {
      warnUnknownKeys(c.head, ['shapeId'], 'character.head', R);
      if (own(c.head, 'shapeId')) {
        const a = typeof c.head.shapeId === 'string' && getAsset(c.head.shapeId);
        if (a && a.slot === 'headShape') { cfg.head.shapeId = a.id; R.applied++; } else R.error('character.head.shapeId', unknownIdMessage(c.head.shapeId, 'headShape'));
      }
    }
  }
  if (own(c, 'hair')) applyItem(c.hair, cfg.hair, 'character.hair', ITEM_FIELDS.hair, R);
  if (own(c, 'headwear')) applyItem(c.headwear, cfg.headwear, 'character.headwear', ITEM_FIELDS.headwear, R);
  if (own(c, 'face')) {
    const f = c.face;
    if (!isObj(f)) R.error('character.face', `Must be an object, but got ${typeName(f)}.`);
    else {
      warnUnknownKeys(f, ['eyes', 'eyebrows', 'mouth', 'facialHair', 'details'], 'character.face', R);
      for (const k of ['eyes', 'eyebrows', 'mouth', 'facialHair']) if (own(f, k)) applyItem(f[k], cfg.face[k], `character.face.${k}`, ITEM_FIELDS[k], R);
      if (own(f, 'details')) { const l = applyList(f.details, 'character.face.details', ITEM_FIELDS.detail, LIMITS.maxDetails, R); if (l) cfg.face.details = l; }
    }
  }
  if (own(c, 'clothing')) {
    const cl = c.clothing;
    if (!isObj(cl)) R.error('character.clothing', `Must be an object, but got ${typeName(cl)}.`);
    else {
      warnUnknownKeys(cl, ['top', 'outerwear', 'bottom', 'shoes'], 'character.clothing', R);
      for (const k of ['top', 'outerwear', 'bottom', 'shoes']) if (own(cl, k)) applyItem(cl[k], cfg.clothing[k], `character.clothing.${k}`, ITEM_FIELDS[k], R);
    }
  }
  if (own(c, 'accessories')) { const l = applyList(c.accessories, 'character.accessories', ITEM_FIELDS.accessory, LIMITS.maxAccessories, R); if (l) cfg.accessories = l; }
}

function readNotes(v, path, R, kind) {
  if (v === undefined) return [];
  if (!Array.isArray(v)) { R.warn(path, `Must be a list; ignored.`); return []; }
  const out = [];
  for (const n of v.slice(0, LIMITS.maxNotes)) {
    let text = '';
    if (typeof n === 'string') text = n;
    else if (isObj(n)) {
      if (kind === 'uncertain') text = [n.field, n.note || n.reason || n.choice].filter(x => typeof x === 'string').join(': ');
      else text = [n.feature, n.closestSubstitute ? `closest: ${n.closestSubstitute}` : '', n.note].filter(x => typeof x === 'string' && x).join(' — ');
    }
    text = text.trim().slice(0, LIMITS.maxNoteLength);
    if (text) out.push(text);
  }
  return out;
}

// ------------------------------------------------------------------ document
/**
 * Validate a parsed document.
 * @param doc   parsed JSON (untrusted)
 * @param opts  { current: full config, currentBase: base id }
 * @returns { ok, items, errors, warnings, infos, applied, config, baseCharacter, mode, reference, uncertain, unsupported }
 */
export function validateDocument(doc, opts = {}) {
  const R = new Report();
  const result = (config, extra = {}) => ({
    ok: R.errors.length === 0 && !!config, items: R.items, errors: R.errors, warnings: R.warnings, infos: R.infos, applied: R.applied, config, ...extra,
  });
  if (!isObj(doc)) { R.error('', `The JSON must be an object { … } describing a character, but got ${typeName(doc)}.`); return result(null); }

  warnUnknownKeys(doc, TOP_LEVEL_KEYS, '', R);
  if (!own(doc, 'schemaVersion')) R.warn('schemaVersion', `Missing "schemaVersion"; assumed "${SCHEMA_VERSION}".`);
  else {
    const v = String(doc.schemaVersion), [maj, min] = v.split('.'), [cMaj, cMin] = SCHEMA_VERSION.split('.');
    if (!/^\d+(\.\d+)?$/.test(v) || maj !== cMaj) { R.error('schemaVersion', `Schema version "${short(doc.schemaVersion)}" is not supported. This app reads version ${SCHEMA_VERSION}.`); return result(null); }
    if (+(min || 0) > +cMin) R.warn('schemaVersion', `Document uses a newer minor version (${v}); unknown fields are ignored.`);
  }
  if (own(doc, 'kind') && doc.kind !== DOC_KIND) R.warn('kind', `Unexpected kind "${short(doc.kind)}" (expected "${DOC_KIND}").`);

  let mode = 'replace';
  if (own(doc, 'mode')) { if (MODES.includes(doc.mode)) mode = doc.mode; else R.warn('mode', `Unknown mode ${typeName(doc.mode)}; used "replace".`); }

  let baseId = getBase(opts.currentBase) ? opts.currentBase : defaultBaseId();
  if (own(doc, 'baseCharacter')) {
    if (typeof doc.baseCharacter === 'string' && getBase(doc.baseCharacter)) baseId = doc.baseCharacter;
    else R.error('baseCharacter', `Unknown base character ${typeName(doc.baseCharacter)}. Available: ${listBases().map(b => b.id).join(', ')}.`);
  }

  const start = mode === 'patch' && opts.current ? completeConfig(clone(opts.current)) : baseConfig(baseId);
  const cfg = clone(start);
  if (!own(doc, 'character')) R.error('character', 'Missing the "character" object, so there is nothing to apply.');
  else if (!isObj(doc.character)) R.error('character', `"character" must be an object, but got ${typeName(doc.character)}.`);
  else applyCharacter(doc.character, cfg, R);

  let reference = null;
  if (own(doc, 'reference')) {
    const r = doc.reference;
    if (!isObj(r)) R.warn('reference', 'Must be an object; ignored.');
    else {
      warnUnknownKeys(r, ['description', 'source'], 'reference', R);
      reference = {};
      if (typeof r.description === 'string') {
        if (r.description.length > LIMITS.maxDescription) R.warn('reference.description', `Shortened to ${LIMITS.maxDescription} characters.`);
        reference.description = r.description.trim().slice(0, LIMITS.maxDescription);
      }
      if (own(r, 'source')) { if (REFERENCE_SOURCES.includes(r.source)) reference.source = r.source; else R.warn('reference.source', `Unknown source ${typeName(r.source)}; ignored.`); }
    }
  }
  const uncertain = readNotes(doc.uncertain, 'uncertain', R, 'uncertain');
  const unsupported = readNotes(doc.unsupported, 'unsupported', R, 'unsupported');
  for (const u of uncertain) R.info('uncertain', 'AI guessed: ' + u);
  for (const u of unsupported) R.info('unsupported', 'Not supported by the asset library: ' + u);
  if (own(doc, 'character') && isObj(doc.character) && R.applied === 0 && R.errors.length === 0) R.warn('character', 'No customization fields were found, so nothing changed.');

  return result(completeConfig(cfg), { baseCharacter: baseId, mode, reference, uncertain, unsupported });
}

/** extractJson + validateDocument in one call (what the Import button does). */
export function validateText(text, opts) {
  const ex = extractJson(text);
  if (ex.error) return { ok: false, items: [{ level: 'error', path: '', message: ex.error }], errors: [{ level: 'error', path: '', message: ex.error }], warnings: [], infos: [], applied: 0, config: null, parseNotes: ex.notes };
  const r = validateDocument(ex.value, opts);
  for (const n of ex.notes) r.items.unshift({ level: 'warning', path: '', message: n });
  r.warnings = r.items.filter(i => i.level === 'warning');
  r.parseNotes = ex.notes;
  return r;
}
