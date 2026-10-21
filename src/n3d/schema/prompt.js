/* =====================================================================
 * NORMAL 3D — "IMAGE-TO-CHARACTER" AI PROMPT, CATALOG AND JSON SCHEMA
 *
 * Generated from the live registry, the parameter tables, the fabric /
 * pattern lists and the validator limits, so the prompt can never offer an
 * id, a parameter or a range the creator does not support. Separate from
 * the Voxel prompt: different format, ids and parameters.
 * ===================================================================== */
import { allAssets, listAssets, SLOTS } from '../core/registry.js';
import { BODY_PARAMS, FACE_PARAMS, BODY_GROUPS, FACE_GROUPS } from '../core/params.js';
import { EYE_PARAMS, SKIN_PARAMS, MAKEUP_PARAMS, BROW_PARAMS, N3D_FORMAT, N3D_VERSION, createN3DDocument, AI_LIMITS, REF_FRAMING, REF_STYLE, OBS_AREAS } from '../core/document.js';
import { FABRICS, PATTERNS, HARDWARE } from '../materials/fabrics.js';
import { FITS } from '../garments/fit.js';
import { DETAIL_LEVELS } from '../core/detail.js';
import { LIMITS } from './validate.js';

export const N3D_CATALOG_ORDER = ['hairStyle', 'browStyle', 'facialHair', 'top', 'mid', 'outer', 'bottom', 'fullBody', 'footwear', 'headwear', 'neckwear', 'eyewear', 'jewelry', 'handwear', 'bag', 'belt'];
const fmt = v => (Math.abs(v) >= 10 ? String(v) : String(Math.round(v * 1000) / 1000));

function paramLine(k, p) {
  if (p.type === 'enum') return `${k}: ${p.values.map(v => (p.labels?.[v]?.en ? `${v} (${p.labels[v].en})` : v)).join(' | ')}; default ${p.default} — ${p.doc || p.label.en}`;
  if (p.type === 'bool') return `${k}: true | false; default ${p.default} — ${p.doc || p.label.en}`;
  return `${k}: ${fmt(p.min)}…${fmt(p.max)}; default ${fmt(p.default)} — ${p.doc || p.label.en}`;
}
function tableLines(tbl, groups) {
  const out = [];
  for (const [g, gl] of Object.entries(groups || { all: { en: '' } })) {
    const keys = Object.entries(tbl).filter(([, p]) => !groups || p.group === g);
    if (!keys.length) continue;
    if (groups) out.push(`  ${gl.en}:`);
    for (const [k, p] of keys) out.push(`  - ${k}: ${fmt(p.min)}…${fmt(p.max)} (default ${fmt(p.default)}) — ${p.doc}`);
  }
  return out;
}

/** Plain-text catalog of every Normal 3D asset. */
export function buildN3DCatalogText() {
  const L = [`NORMAL 3D ASSET CATALOG (${N3D_FORMAT} ${N3D_VERSION}, ${allAssets().length} assets). Use ids exactly as written; never invent ids.`];
  for (const slot of N3D_CATALOG_ORDER) {
    const list = listAssets(slot);
    if (!list.length) continue;
    L.push('', `[${slot}] ${SLOTS[slot].label.en} → ${SLOTS[slot].path}`);
    for (const a of list) {
      L.push(`- ${a.id} — ${a.label.en}: ${a.description}`);
      const ps = Object.entries(a.params || {});
      if (ps.length && slot !== 'hairStyle') for (const [k, p] of ps) L.push(`    · ${paramLine(k, p)}`);
      const cs = Object.entries(a.colors || {});
      if (cs.length && slot !== 'hairStyle') L.push(`    · colors: ${cs.map(([k, c]) => `${k} (${c.label.en}, default ${c.default})`).join(', ')}`);
      if (a.fabrics && a.fabrics.length) L.push(`    · fabrics: ${a.fabrics.join(', ')} (default ${a.fabric})`);
    }
    if (slot === 'hairStyle') {
      const p = listAssets('hairStyle').find(a => a.params && Object.keys(a.params).length)?.params || {};
      L.push('  Every hairstyle shares these params (hair.params):');
      for (const [k, q] of Object.entries(p)) L.push(`    · ${paramLine(k, q)}`);
      L.push('  hair.colors: root, tip, highlight (#RRGGBB).');
    }
  }
  L.push('', 'FABRICS (outfit[].material.fabric): ' + Object.entries(FABRICS).map(([k, f]) => `${k} (${f.label.en})`).join(', '));
  L.push('PATTERNS (material.pattern, drawn with colors main + secondary + accent): ' + Object.entries(PATTERNS).map(([k, p]) => `${k} (${p.label.en})`).join(', '));
  L.push('HARDWARE (material.hardware: buttons, zips, rivets, buckles): ' + Object.keys(HARDWARE).join(', '));
  L.push('material.patternScale: 0.25…4 (1 = natural size); material.wear: 0…1 (fading / washed look).');
  L.push('FITS (params.fit): ' + Object.entries(FITS).map(([k, f]) => `${k} (${f.label.en})`).join(', ') + ' — fit changes the garment shape (ease, drape), never its scale.');
  return L.join('\n');
}

/** A complete example (built from defaults, validated by the tests). */
export function exampleN3D() {
  return {
    format: N3D_FORMAT, version: N3D_VERSION, mode: 'normal3d',
    meta: { name: 'Layla', notes: 'Example: smart-casual outfit from a reference photo' },
    detail: 'high',
    body: { height: 1.66, masculinity: 0.15, muscle: 0.25, bodyFat: 0.3, hipWidth: 1.05, legLength: 1.02 },
    face: {
      headWidth: -0.1, jawWidth: -0.3, chinLength: 0.1, cheekbones: 0.4, eyeSize: 0.25, eyeTilt: 0.2, noseWidth: -0.2, upperLip: 0.3, lowerLip: 0.4,
      eyes: { iris: '#4A3020', lashLength: 1.2 },
      brows: { styleId: 'brow_rounded_01', color: '#2A1B12' },
      facialHair: { styleId: 'facial_none' },
      makeup: { lipColor: '#A8505A', lipAmount: 0.5, blush: 0.3 },
    },
    skin: { tone: '#C08A64', undertone: 0.3, freckles: 0.15 },
    hair: { styleId: 'hair_long_wavy_01', params: { length: 1.1, volume: 0.55, part: 'left' }, colors: { root: '#2B1B12', tip: '#5A3A22', highlight: '#8A6040' } },
    outfit: [
      { assetId: 'top_blouse_01', params: { fit: 'relaxed', neckline: 'v', sleeveLength: 0.75, tucked: true }, colors: { main: '#F3E9DC' }, material: { fabric: 'silk' } },
      { assetId: 'bottom_trousers_01', params: { fit: 'relaxed', rise: 0.85, legOpening: 0.6, legLength: 1.02 }, colors: { main: '#2F3A4A' }, material: { fabric: 'wool_suiting' } },
      { assetId: 'outer_blazer_01', params: { fit: 'regular', collar: 'notch', closure: 'open', buttons: 1 }, colors: { main: '#B8A48A', lining: '#5A2A35' }, material: { fabric: 'linen' } },
      { assetId: 'shoes_dress_01', params: { style: 'loafer' }, colors: { main: '#3B2416' } },
    ],
    accessories: [
      { assetId: 'jewel_earrings_01', params: { style: 'hoop', size: 1 }, colors: { main: '#D4AF37' } },
      { assetId: 'bag_crossbody_01', params: { style: 'crossbody', side: 'right' }, colors: { main: '#6B3E26', strap: '#4A2A18' }, confidence: 0.6 },
    ],
    reference: { description: 'Full-length photo of a young woman in smart-casual clothes, front view, soft daylight.', framing: 'full', style: 'realistic' },
    observations: [
      { area: 'hair', note: 'Long dark-brown hair in loose waves past the shoulders, side part on the left.', confidence: 0.9 },
      { area: 'outfit', note: 'Beige linen blazer worn open over a cream silk blouse tucked into navy trousers.', confidence: 0.85 },
      { area: 'face', note: 'Oval face, high cheekbones, almond eyes, full lips.', confidence: 0.7 },
    ],
    uncertain: [{ field: 'outfit[3]', note: 'The feet are partly hidden: chose brown loafers.', confidence: 0.4 }],
    unsupported: [{ feature: 'Small embroidered flowers on the blouse cuffs', closestSubstitute: 'plain cuffs' }],
  };
}

/** The full prompt an AI model receives (paste it together with a reference image). */
export function buildN3DPrompt(opts = {}) {
  const L = [];
  L.push('You are a character designer for the Limonat game. Turn the reference image (or description) into a NORMAL 3D (realistic or stylized, smooth — NOT voxel) character by writing ONE JSON document for the Limonat Character Creator, Normal 3D mode.');
  L.push('', 'OUTPUT: only the JSON object (no prose, no comments). Format "' + N3D_FORMAT + '", version "' + N3D_VERSION + '", mode "normal3d". Omitted fields keep sensible defaults, so set what you can see and leave the rest out.');
  L.push('', 'HOW TO READ THE IMAGE');
  L.push('1. Body: estimate height (m), build (masculinity 0 feminine … 1 masculine anatomy), muscle, body fat, shoulder / hip / waist widths, limb lengths and thickness. Values are multipliers around 1 (average) or 0…1 amounts. Use stylization 0 for realistic people, up to 1 for cartoon / anime proportions.');
  L.push('2. Face: offsets from −1 to 1 around an average face (0). Judge head and jaw shape, cheekbones, chin, eyes (size, spacing, tilt, openness, shape), brows, nose (bridge, tip, width, profile), lips, ears. Pick the closest brow style, eye (iris) colour, facial hair style and skin tone (hex). Add freckles, moles, wrinkles, scars or makeup only if visible.');
  L.push('3. Hair: pick the closest hairstyle, then tune length, volume, curl, wave, parting, fringe, hairline (recession, widow’s peak), colours (root, tip, highlights).');
  L.push('4. Clothing, layer by layer from the skin outward: base top (tucked or not), mid layer (sweater, hoodie, cardigan, waistcoat), outerwear (jacket, blazer, coat), bottoms, full-body garments (dresses, jumpsuits, thobe, abaya), footwear. For each item set the fit, lengths, sleeves, neckline / collar, closure (open / closed), and the fabric, pattern and colours you see. Use pattern + secondary / accent colours for stripes, checks, plaid, prints, colour blocking; wear for faded / washed garments.');
  L.push('5. Accessories: headwear (caps, hats, beanies, kufi, hijab, keffiyeh with agal, hood up), scarves, shawls, ties, glasses, jewellery, watches, gloves, belts, bags.');
  L.push('6. Colours are #RRGGBB taken from the image (account for lighting: pick the fabric’s real colour, not its shadow).');
  L.push(`7. Report what you saw: "reference" { description, framing (${REF_FRAMING.join(' | ')}), style (${REF_STYLE.join(' | ')}) } and "observations": one entry per area you analysed { area (${OBS_AREAS.join(' | ')}), note, confidence 0…1 }. Give every outfit / accessory item a "confidence" 0…1 (how sure you are it matches).`);
  L.push('8. Hidden or unclear parts (feet out of frame, the back of the head, a covered garment): choose sensible defaults that fit the character and list each guess in "uncertain" { field, note, confidence }. Never present a guess as seen.');
  L.push('9. Visible features that no asset, parameter, fabric or pattern can reproduce (an embroidery, a logo, an unusual garment) go in "unsupported" { feature, closestSubstitute } — the closest thing you used instead, or "none". Never invent ids or parameters to cover them.');
  L.push(`Keep these lists short and concrete (at most ${AI_LIMITS.notes} entries each).`);
  L.push('', 'RULES');
  L.push(`- Only ids from the catalog below; each item’s params and colors must be ones that item lists. Max ${LIMITS.outfit} outfit items, ${LIMITS.accessories} accessories, one pair of footwear.`);
  L.push('- Numbers must stay inside their ranges (they are clamped otherwise). Enum params must use one of the listed values.');
  L.push('- Garments are layered automatically by type (base → bottoms → mid → outer); tucked tops go under the trousers / skirt.');
  L.push('- Do not reproduce logos, brand names or copyrighted characters; describe the look with generic garments, colours and patterns.');
  L.push('- Detail level: "standard" (fast), "high" (default for exports), "advanced" (maximum detail). Levels: ' + Object.entries(DETAIL_LEVELS).map(([k, d]) => `${k} — ${d.doc}`).join(' '));
  L.push('', 'DOCUMENT STRUCTURE');
  L.push('{ format, version, mode: "normal3d", meta: { name, notes }, detail, body: {…}, face: { …shape numbers…, eyes: {…}, brows: { styleId, color, params }, facialHair: { styleId, params, colors }, makeup: {…} }, skin: { tone, undertone, freckles, moles, wrinkles, blemishes, stubble, scars: [{ at, size, angle }] }, hair: { styleId, params, colors }, outfit: [ { assetId, params, colors, material: { fabric, pattern, patternScale, wear, hardware }, confidence } ], accessories: [ { assetId, params, colors, material, confidence } ], reference: { description, framing, style }, observations: [ { area, note, confidence } ], uncertain: [ { field, note, confidence } ], unsupported: [ { feature, closestSubstitute } ] }');
  L.push('', 'BODY PARAMETERS (body.*)'); L.push(...tableLines(BODY_PARAMS, BODY_GROUPS));
  L.push('', 'FACE SHAPE PARAMETERS (face.*)'); L.push(...tableLines(FACE_PARAMS, FACE_GROUPS));
  L.push('', 'EYES (face.eyes.*): iris, sclera, lashColor, heterochromia (optional second iris colour) as #RRGGBB, and:'); L.push(...tableLines(EYE_PARAMS));
  L.push('', 'BROW PARAMS (face.brows.params.*, override the style):'); L.push(...tableLines(BROW_PARAMS));
  L.push('', 'SKIN (skin.*): tone #RRGGBB; scars: up to 6 of { at: cheekLeft | cheekRight | browLeft | browRight | chin | forehead | nose | lip, size 0.2…1, angle −90…90 }, and:'); L.push(...tableLines(SKIN_PARAMS));
  L.push('', 'MAKEUP (face.makeup.*): lipColor, blushColor, eyeShadowColor as #RRGGBB, and:'); L.push(...tableLines(MAKEUP_PARAMS));
  if (opts.includeCatalog !== false) { L.push(''); L.push(buildN3DCatalogText()); }
  L.push('', 'EXAMPLE (a complete, valid document):');
  L.push(JSON.stringify(exampleN3D(), null, 1));
  L.push('', 'Now look at the reference and write the JSON document.');
  return L.join('\n');
}

/** Machine-readable catalog. */
export function buildN3DCatalogJson() {
  return {
    format: N3D_FORMAT, version: N3D_VERSION,
    slots: Object.fromEntries(N3D_CATALOG_ORDER.map(slot => [slot, { path: SLOTS[slot].path, label: SLOTS[slot].label, assets: listAssets(slot).map(a => ({ id: a.id, label: a.label, description: a.description, tags: a.tags, params: a.params, colors: a.colors, fabrics: a.fabrics, fabric: a.fabric })) }])),
    body: BODY_PARAMS, face: FACE_PARAMS, eyes: EYE_PARAMS, skin: SKIN_PARAMS, makeup: MAKEUP_PARAMS, brows: BROW_PARAMS,
    fabrics: FABRICS, patterns: PATTERNS, hardware: HARDWARE, fits: FITS, detailLevels: Object.keys(DETAIL_LEVELS),
  };
}

/** JSON Schema (draft 2020-12) with the live id / enum lists. */
export function buildN3DJsonSchema() {
  const num = p => ({ type: 'number', minimum: p.min, maximum: p.max, default: p.default, description: p.doc || p.label?.en });
  const tbl = t => ({ type: 'object', additionalProperties: false, properties: Object.fromEntries(Object.entries(t).map(([k, p]) => [k, num(p)])) });
  const color = { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' };
  const paramSchema = p => (p.type === 'enum' ? { enum: p.values, default: p.default, description: p.doc } : p.type === 'bool' ? { type: 'boolean', default: p.default, description: p.doc } : num(p));
  const itemSchema = slots => ({
    oneOf: allAssets().filter(a => slots.includes(a.slot)).map(a => ({
      type: 'object', required: ['assetId'], additionalProperties: false,
      properties: {
        assetId: { const: a.id, description: a.description }, uid: { type: 'string' }, confidence: { type: 'number', minimum: 0, maximum: 1, description: 'how sure the model is that this item matches the reference' },
        params: { type: 'object', additionalProperties: false, properties: Object.fromEntries(Object.entries(a.params || {}).map(([k, p]) => [k, paramSchema(p)])) },
        colors: { type: 'object', additionalProperties: false, properties: Object.fromEntries(Object.keys(a.colors || {}).map(k => [k, color])) },
        material: { type: 'object', additionalProperties: false, properties: { fabric: { enum: a.fabrics && a.fabrics.length ? a.fabrics : Object.keys(FABRICS) }, pattern: { enum: Object.keys(PATTERNS) }, patternScale: { type: 'number', minimum: 0.25, maximum: 4 }, wear: { type: 'number', minimum: 0, maximum: 1 }, hardware: { enum: Object.keys(HARDWARE) } } },
      },
    })),
  });
  const styleRef = (slot, extra = {}) => ({ type: 'object', properties: { styleId: { enum: listAssets(slot).map(a => a.id) }, params: { type: 'object' }, colors: { type: 'object', additionalProperties: color }, ...extra } });
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'https://limonat.game/schema/limonat-character-3d-1.0.json',
    title: 'Limonat Normal 3D character', type: 'object',
    properties: {
      format: { const: N3D_FORMAT }, version: { type: 'string', pattern: '^1\\.' }, mode: { const: 'normal3d' },
      meta: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string', maxLength: LIMITS.name }, notes: { type: 'string' }, createdAt: { type: 'string' }, updatedAt: { type: 'string' } } },
      detail: { enum: Object.keys(DETAIL_LEVELS) },
      body: tbl(BODY_PARAMS),
      face: { type: 'object', properties: { ...tbl(FACE_PARAMS).properties, eyes: { type: 'object', properties: { ...tbl(EYE_PARAMS).properties, iris: color, sclera: color, lashColor: color, heterochromia: color } }, brows: styleRef('browStyle', { color }), facialHair: styleRef('facialHair'), makeup: { type: 'object', properties: { ...tbl(MAKEUP_PARAMS).properties, lipColor: color, blushColor: color, eyeShadowColor: color } } } },
      skin: { type: 'object', properties: { ...tbl(SKIN_PARAMS).properties, tone: color, scars: { type: 'array', maxItems: LIMITS.scars, items: { type: 'object', properties: { at: { enum: ['cheekLeft', 'cheekRight', 'browLeft', 'browRight', 'chin', 'forehead', 'nose', 'lip'] }, size: { type: 'number', minimum: 0.2, maximum: 1 }, angle: { type: 'number', minimum: -90, maximum: 90 } } } } } },
      hair: styleRef('hairStyle'),
      outfit: { type: 'array', maxItems: LIMITS.outfit, items: itemSchema(['top', 'mid', 'outer', 'bottom', 'fullBody', 'footwear']) },
      accessories: { type: 'array', maxItems: LIMITS.accessories, items: itemSchema(['headwear', 'neckwear', 'handwear', 'eyewear', 'jewelry', 'bag', 'belt']) },
      reference: { type: 'object', description: 'what the reference image shows', properties: { description: { type: 'string', maxLength: AI_LIMITS.text }, framing: { enum: REF_FRAMING }, style: { enum: REF_STYLE } } },
      observations: { type: 'array', maxItems: AI_LIMITS.notes, items: { type: 'object', required: ['note'], properties: { area: { enum: OBS_AREAS }, note: { type: 'string', maxLength: AI_LIMITS.text }, confidence: { type: 'number', minimum: 0, maximum: 1 } } } },
      uncertain: { type: 'array', maxItems: AI_LIMITS.notes, description: 'guesses about hidden or unclear parts', items: { type: 'object', required: ['note'], properties: { field: { type: 'string' }, note: { type: 'string', maxLength: AI_LIMITS.text }, confidence: { type: 'number', minimum: 0, maximum: 1 } } } },
      unsupported: { type: 'array', maxItems: AI_LIMITS.notes, description: 'visible features the library cannot reproduce', items: { type: 'object', required: ['feature'], properties: { feature: { type: 'string', maxLength: AI_LIMITS.text }, closestSubstitute: { type: 'string', maxLength: AI_LIMITS.text } } } },
      ai: { type: 'object', description: 'the same four notes as stored by the app (reference, observations, uncertain, unsupported, importedAt)' },
    },
  };
}
export { createN3DDocument };
