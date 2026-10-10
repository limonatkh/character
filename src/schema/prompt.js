/* =====================================================================
 * AI PROMPT, ASSET CATALOG and JSON SCHEMA — all generated from the live
 * registry + schema.js, so they can never drift out of sync with the
 * assets that actually exist. Provider-neutral plain text.
 * ===================================================================== */
import { allAssets, listAssets, listBases, SLOTS, SLOT_IDS, getAsset } from '../core/registry.js';
import { ATTACH_POINTS, ATTACH_POINT_IDS } from '../core/skeleton.js';
import { APP_NAME, APP_VERSION } from '../core/constants.js';
import {
  SCHEMA_VERSION, DOC_KIND, PROPORTIONS, PROPORTION_KEYS, GAZE, SIDES, MODES, REFERENCE_SOURCES, MATERIALS, LIMITS, FIELD_DOCS,
} from './schema.js';
import { baseConfig } from './validate.js';

const CATALOG_ORDER = ['bodyType', 'headShape', 'hair', 'headwear', 'eyes', 'eyebrows', 'mouth', 'facialHair', 'faceDetail', 'top', 'outerwear', 'bottom', 'shoes', 'accessory'];

/** Plain-text asset catalog (what an AI model needs to pick ids). */
export function buildCatalogText() {
  const lines = [`ASSET CATALOG (schema ${SCHEMA_VERSION}, ${allAssets().length} assets) — use these ids exactly; never invent ids.`];
  lines.push('', 'BASE CHARACTERS (baseCharacter):');
  for (const b of listBases()) lines.push(`- ${b.id}: ${b.description}`);
  for (const slot of CATALOG_ORDER) {
    lines.push('', `[${slot}] ${SLOTS[slot].label.en} → ${SLOTS[slot].path}`);
    for (const a of listAssets(slot)) {
      const extra = [];
      if (a.colors.length) extra.push('colours: ' + a.colors.map(c => `${c.key} (${c.label.en.toLowerCase()}, default ${c.default})`).join(', '));
      if (a.material) extra.push('default material: ' + a.material);
      if (a.sides) extra.push('side: ' + a.sides.join('|'));
      if (a.attach) extra.push(`attachTo: ${a.attach.points.join('|')} (default ${a.attach.default})`);
      lines.push(`- ${a.id}: ${a.description}${a.tags.length ? ' Tags: ' + a.tags.join(', ') + '.' : ''}${extra.length ? ' [' + extra.join('; ') + ']' : ''}`);
    }
  }
  lines.push('', 'ATTACHMENT POINTS: ' + ATTACH_POINT_IDS.map(p => `${p} (${ATTACH_POINTS[p].label.en})`).join(', '));
  lines.push('MATERIALS: ' + MATERIALS.join(', '));
  return lines.join('\n');
}

/** Machine-readable catalog. */
export function buildCatalogJson() {
  return {
    schemaVersion: SCHEMA_VERSION, generator: `${APP_NAME} ${APP_VERSION}`,
    bases: listBases().map(b => ({ id: b.id, description: b.description })),
    slots: Object.fromEntries(CATALOG_ORDER.map(slot => [slot, {
      path: SLOTS[slot].path,
      assets: listAssets(slot).map(a => ({
        id: a.id, label: a.label.en, description: a.description, tags: a.tags,
        colors: a.colors.map(c => ({ key: c.key, label: c.label.en, default: c.default })),
        ...(a.material ? { material: a.material } : {}), ...(a.sides ? { sides: a.sides } : {}), ...(a.attach ? { attach: a.attach } : {}),
      })),
    }])),
    attachPoints: ATTACH_POINT_IDS, materials: MATERIALS, proportions: PROPORTIONS, gaze: GAZE,
  };
}

/** A complete, valid example document (generated from a base, so it always validates). */
export function exampleDocument() {
  const c = baseConfig('base_classic_block');
  c.name = 'Red Jacket Kid';
  c.body.skinColor = '#C68A5E';
  c.body.proportions.headScale = 1.1;
  c.hair = { assetId: 'hair_spiky_01', color: '#242424' };
  c.face.eyes = { styleId: 'eyes_anime_01', color: '#5A3A22', gaze: 'center' };
  c.face.mouth = { styleId: 'mouth_grin_01' };
  c.clothing.outerwear = { assetId: 'outer_jacket_open_01', color: '#D92F35', secondaryColor: '#8E1F24', material: 'cloth' };
  c.clothing.top = { assetId: 'top_tshirt_01', color: '#F2F2F2', material: 'cloth' };
  c.clothing.shoes = { assetId: 'shoes_sneakers_01', color: '#F2F2F2', secondaryColor: '#D92F35', material: 'cloth' };
  c.accessories = [{ assetId: 'acc_headphones_01', attachTo: 'head_top', color: '#2B2B2F', secondaryColor: '#D92F35', material: 'plastic' }];
  return {
    schemaVersion: SCHEMA_VERSION,
    mode: 'replace',
    baseCharacter: 'base_classic_block',
    reference: { description: 'Teenage boy with short spiky black hair, red open jacket over a white T-shirt, dark jeans, white sneakers, black headphones.', source: 'photo' },
    character: c,
    uncertain: [{ field: 'character.clothing.shoes', note: 'Feet are cut off in the image; chose white sneakers.' }],
    unsupported: [{ feature: 'Logo print on the T-shirt', closestSubstitute: 'none' }],
  };
}

/** The full image-to-character prompt (instructions + schema + catalog + example). */
export function buildPrompt({ includeCatalog = true } = {}) {
  const P = PROPORTION_KEYS.map(k => `  - ${k}: ${PROPORTIONS[k].min} to ${PROPORTIONS[k].max} (1 = normal) — ${PROPORTIONS[k].doc}`).join('\n');
  const fields = FIELD_DOCS.map(([f, t, d]) => `  - ${f}: ${t} — ${d}`).join('\n');
  const text = `You are a character designer for "${APP_NAME}", an app that builds blocky 3D VOXEL characters (Minecraft-like, cartoon style) for the game Limonat.

TASK
Look at the attached reference image (a person, cartoon or game character) and describe that character as JSON commands for this app. The app does NOT accept 3D models or new shapes: it only combines the voxel parts listed in the ASSET CATALOG below and colours them. Your job is to pick the closest parts and colours so the voxel character is recognisable as the reference.

RULES
1. Analyse only what is visible in the image: hairstyle and hair colour, skin colour, eyes, eyebrows, mouth/expression, facial hair, face marks, hat, shirt, jacket, trousers/skirt, shoes, glasses, bags, weapons and other accessories, and the body build.
2. For every part, choose the closest supported asset id from the ASSET CATALOG. Read each description and tags; pick by shape first, colour second.
3. Choose colours as hex "#RRGGBB" sampled from the image (main colour = the largest area of that part). Use proportions only within the listed ranges.
4. Prefer the closest available asset. NEVER invent an asset id, slot, property or attachment point that is not in this prompt. If nothing fits, use the closest asset or the "_none" asset of that slot.
5. Output must strictly follow the SCHEMA below: same property names, nesting and value types.
6. Your final answer must be ONLY the JSON object — no explanations, no Markdown, no code fences, no text before or after it.
7. Do not invent details that cannot be seen (no guessed tattoos, logos, hidden accessories).
8. For hidden or unclear parts (e.g. feet out of frame, back of the head), use sensible defaults that fit the character, and list each guess in "uncertain".
9. List visible features that no asset can represent in "unsupported" (with the closest substitute you used, or "none"). Never pretend an unsupported feature was implemented.
10. Keep the character recognisable: signature items (iconic hat, hair colour, outfit colours, scars, weapons) matter more than small details.

LEFT / RIGHT
"left" and "right" always mean the CHARACTER'S OWN left/right (as the character sees it), not the viewer's. A character facing you has its right side on YOUR left.

SCHEMA (version ${SCHEMA_VERSION})
Top-level object:
${fields}
Allowed values:
  - mode: ${MODES.join(' | ')}
  - reference.source: ${REFERENCE_SOURCES.join(' | ')}
  - gaze: ${GAZE.join(' | ')}
  - side (face details that support it): ${SIDES.join(' | ')}
  - material (clothing, headwear, accessories): ${MATERIALS.join(' | ')}
  - colours: "#RRGGBB" hex strings only
  - at most ${LIMITS.maxAccessories} accessories and ${LIMITS.maxDetails} face details
PROPORTIONS (character.body.proportions, all optional):
${P}
Omitted fields keep the base character's value. Every accessory must use an attachTo point listed for that accessory.

${includeCatalog ? buildCatalogText() : '(The asset catalog is supplied separately — use only ids from it.)'}

EXAMPLE OUTPUT (for a different reference image — do not copy its values):
${JSON.stringify(exampleDocument(), null, 2)}

Now analyse the image and reply with ONLY the JSON object for this character.`;
  return text;
}

/** Standard JSON Schema (draft 2020-12) of the command / save document, with live asset id enums. */
export function buildJsonSchema() {
  const ids = slot => ({ type: 'string', enum: listAssets(slot).map(a => a.id) });
  const color = { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' };
  const mat = { type: 'string', enum: MATERIALS };
  const item = (idKey, slot, opts = {}) => ({
    type: 'object', additionalProperties: false, required: opts.required ? [idKey] : [],
    properties: {
      [idKey]: ids(slot),
      ...(opts.colors !== false ? { color, secondaryColor: color } : {}),
      ...(opts.material ? { material: mat } : {}),
      ...(opts.extra || {}),
    },
  });
  const proportions = { type: 'object', additionalProperties: false, properties: Object.fromEntries(PROPORTION_KEYS.map(k => [k, { type: 'number', minimum: PROPORTIONS[k].min, maximum: PROPORTIONS[k].max }])) };
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `https://limonat.example/schemas/character-${SCHEMA_VERSION}.json`,
    title: `Limonat character command / save document v${SCHEMA_VERSION}`,
    description: 'Generated from the Limonat Character Creator asset registry. Asset id enums list the assets that exist in this version.',
    type: 'object',
    required: ['schemaVersion', 'character'],
    additionalProperties: false,
    properties: {
      $schema: { type: 'string' },
      schemaVersion: { const: SCHEMA_VERSION },
      kind: { const: DOC_KIND },
      id: { type: 'string' },
      mode: { enum: MODES },
      baseCharacter: { type: 'string', enum: listBases().map(b => b.id) },
      reference: { type: 'object', additionalProperties: false, properties: { description: { type: 'string', maxLength: LIMITS.maxDescription }, source: { enum: REFERENCE_SOURCES } } },
      character: {
        type: 'object', additionalProperties: false,
        properties: {
          name: { type: 'string', maxLength: LIMITS.maxName },
          body: { type: 'object', additionalProperties: false, properties: { typeId: ids('bodyType'), skinColor: color, proportions } },
          head: { type: 'object', additionalProperties: false, properties: { shapeId: ids('headShape') } },
          hair: item('assetId', 'hair'),
          face: {
            type: 'object', additionalProperties: false, properties: {
              eyes: item('styleId', 'eyes', { extra: { gaze: { enum: GAZE } } }),
              eyebrows: item('styleId', 'eyebrows'),
              mouth: item('styleId', 'mouth', { colors: false }),
              facialHair: item('assetId', 'facialHair'),
              details: { type: 'array', maxItems: LIMITS.maxDetails, items: item('assetId', 'faceDetail', { required: true, extra: { side: { enum: SIDES } } }) },
            },
          },
          headwear: item('assetId', 'headwear', { material: true }),
          clothing: {
            type: 'object', additionalProperties: false, properties: {
              top: item('assetId', 'top', { material: true }), outerwear: item('assetId', 'outerwear', { material: true }),
              bottom: item('assetId', 'bottom', { material: true }), shoes: item('assetId', 'shoes', { material: true }),
            },
          },
          accessories: { type: 'array', maxItems: LIMITS.maxAccessories, items: item('assetId', 'accessory', { required: true, material: true, extra: { attachTo: { enum: ATTACH_POINT_IDS } } }) },
        },
      },
      uncertain: { type: 'array', maxItems: LIMITS.maxNotes, items: { anyOf: [{ type: 'string' }, { type: 'object', properties: { field: { type: 'string' }, note: { type: 'string' } } }] } },
      unsupported: { type: 'array', maxItems: LIMITS.maxNotes, items: { anyOf: [{ type: 'string' }, { type: 'object', properties: { feature: { type: 'string' }, closestSubstitute: { type: 'string' } } }] } },
      meta: { type: 'object' },
    },
  };
}

export { getAsset };
