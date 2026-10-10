/* =====================================================================
 * CHARACTER COMMAND SCHEMA — version 1.0
 *
 * One format is used everywhere:
 *   - AI models output it (the "command document")
 *   - saved characters are stored in it
 *   - the exported metadata JSON is it (plus export info)
 * The constants below are the single source of truth for the validator,
 * the generated AI prompt, the JSON Schema file and the documentation.
 * ===================================================================== */
import { SCHEMA_VERSION, DOC_KIND, MATERIAL_IDS } from '../core/constants.js';

export { SCHEMA_VERSION, DOC_KIND };

/** Body proportion multipliers (1 = the body type's normal size). Values outside the range are clamped. */
export const PROPORTIONS = {
  headScale:     { min: 0.8,  max: 1.35, default: 1, doc: 'head size (1.3 = chibi big head)' },
  torsoWidth:    { min: 0.8,  max: 1.3,  default: 1, doc: 'shoulder/waist width (1.25 = broad or heavy build, 0.85 = slim)' },
  torsoLength:   { min: 0.85, max: 1.2,  default: 1, doc: 'torso height' },
  armLength:     { min: 0.85, max: 1.2,  default: 1, doc: 'arm length' },
  legLength:     { min: 0.75, max: 1.25, default: 1, doc: 'leg length (0.8 = short / child, 1.2 = tall / long legs)' },
  limbThickness: { min: 0.75, max: 1.35, default: 1, doc: 'arm and leg thickness (1.3 = muscular / chunky)' },
};
export const PROPORTION_KEYS = Object.keys(PROPORTIONS);

export const GAZE = ['center', 'left', 'right', 'up', 'down'];
export const SIDES = ['left', 'right', 'both'];
export const MODES = ['replace', 'patch'];
export const REFERENCE_SOURCES = ['photo', 'cartoon', 'anime', 'game', 'drawing', 'other'];
export const MATERIALS = MATERIAL_IDS;

export const LIMITS = {
  maxAccessories: 6,
  maxDetails: 6,
  maxName: 40,
  maxDescription: 600,
  maxNotes: 20,
  maxNoteLength: 300,
  maxInputChars: 200000,
};

/** Known top-level properties of a command / save document. */
export const TOP_LEVEL_KEYS = ['$schema', 'schemaVersion', 'kind', 'id', 'mode', 'baseCharacter', 'reference', 'character', 'uncertain', 'unsupported', 'meta'];

/** Which colour / option fields each kind of item accepts. */
export const ITEM_FIELDS = {
  hair:       { id: 'assetId', slot: 'hair',       colors: true },
  headwear:   { id: 'assetId', slot: 'headwear',   colors: true, material: true },
  eyes:       { id: 'styleId', slot: 'eyes',       colors: true, extra: ['gaze'] },
  eyebrows:   { id: 'styleId', slot: 'eyebrows',   colors: true },
  mouth:      { id: 'styleId', slot: 'mouth' },
  facialHair: { id: 'assetId', slot: 'facialHair', colors: true },
  detail:     { id: 'assetId', slot: 'faceDetail', colors: true, extra: ['side'] },
  top:        { id: 'assetId', slot: 'top',        colors: true, material: true },
  outerwear:  { id: 'assetId', slot: 'outerwear',  colors: true, material: true },
  bottom:     { id: 'assetId', slot: 'bottom',     colors: true, material: true },
  shoes:      { id: 'assetId', slot: 'shoes',      colors: true, material: true },
  accessory:  { id: 'assetId', slot: 'accessory',  colors: true, material: true, extra: ['attachTo'] },
};

/**
 * Human-readable field reference (used by the AI prompt and docs).
 * `type` uses a compact notation; ids refer to the asset catalog.
 */
export const FIELD_DOCS = [
  ['schemaVersion', '"1.0"', 'Required. Always the string "1.0".'],
  ['mode', '"replace" | "patch"', 'Optional, default "replace": start from the base character and apply every field given. "patch" changes only the fields given on the current character.'],
  ['baseCharacter', 'base id', 'Optional. Which base character to start from (see BASE CHARACTERS).'],
  ['reference.description', 'string ≤ 600', 'Short description of the character in the image (who/what, notable features).'],
  ['reference.source', '"photo" | "cartoon" | "anime" | "game" | "drawing" | "other"', 'Optional. Kind of reference image.'],
  ['character.name', 'string ≤ 40', 'Display name for the character.'],
  ['character.body.typeId', 'bodyType id', 'Body type (see catalog).'],
  ['character.body.skinColor', '"#RRGGBB"', 'Skin / body colour.'],
  ['character.body.proportions.<key>', 'number', 'Proportion multipliers, 1 = normal. Keys and ranges listed under PROPORTIONS.'],
  ['character.head.shapeId', 'headShape id', 'Head shape.'],
  ['character.hair', '{ assetId, color, secondaryColor? }', 'Hairstyle id (hair slot) and colours. Use hair_none for bald or fully hidden hair.'],
  ['character.face.eyes', '{ styleId, color, gaze }', 'Eye style id (eyes slot), iris/pupil colour, gaze = "center" | "left" | "right" | "up" | "down" (left/right = the character\'s own left/right).'],
  ['character.face.eyebrows', '{ styleId, color }', 'Eyebrow style id (eyebrows slot) and colour.'],
  ['character.face.mouth', '{ styleId }', 'Mouth style id (mouth slot).'],
  ['character.face.facialHair', '{ assetId, color }', 'Facial hair id (facialHair slot) and colour.'],
  ['character.face.details', '[{ assetId, side?, color? }] ≤ 6', 'Face details (faceDetail slot). side = "left" | "right" | "both" only for details that list sides.'],
  ['character.headwear', '{ assetId, color, secondaryColor?, material? }', 'Hat / headwear id (headwear slot). Use hat_none for none.'],
  ['character.clothing.top', '{ assetId, color, secondaryColor?, material? }', 'Shirt / inner top (top slot). top_none = bare torso.'],
  ['character.clothing.outerwear', '{ assetId, color, secondaryColor?, material? }', 'Jacket / vest / hoodie / coat worn over the top (outerwear slot). outer_none for none.'],
  ['character.clothing.bottom', '{ assetId, color, secondaryColor?, material? }', 'Trousers / shorts / skirt (bottom slot).'],
  ['character.clothing.shoes', '{ assetId, color, secondaryColor?, material? }', 'Shoes (shoes slot). shoes_none = barefoot.'],
  ['character.accessories', '[{ assetId, attachTo?, color?, secondaryColor?, material? }] ≤ 6', 'Accessories (accessory slot). attachTo must be one of the points listed for that accessory; omit it to use the default.'],
  ['uncertain', '[{ field, note }]', 'Things you had to guess (hidden or unclear in the image) and what you chose.'],
  ['unsupported', '[{ feature, closestSubstitute? }]', 'Visible features that no catalog asset can represent, and the closest asset used instead (or "none").'],
];
