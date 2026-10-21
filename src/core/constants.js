/* =====================================================================
 * Shared constants. Pure data — no Three.js, safe to import from Node.
 *
 * Coordinate system (identical to Limonat's js/character.js):
 *   unit  = 1 voxel "px" = PX metres (0.084 m, Limonat's VR.CHARACTER_PX)
 *   +Y up, feet at y = 0
 *   -Z is the FRONT of the character (face / running direction)
 *   +X is the character's RIGHT-hand side, -X its LEFT
 * ===================================================================== */
export const APP_NAME = 'Limonat Character Creator';
export const APP_VERSION = '1.1.0';
export const SCHEMA_VERSION = '1.0';
export const DOC_KIND = 'limonat-character';

export const PX = 0.084;            // metres per voxel px (Limonat VR.CHARACTER_PX)
export const OUTLINE_PX = 0.32;     // ink line thickness (Limonat hero uses 0.32)
export const INK = '#161616';       // Limonat ink colour
export const BRIGHTNESS = 1.1;      // Limonat draws characters 10% brighter than world blocks

/** Baked per-face shading, same as Limonat's VoxelBuilder (top / sides / bottom). */
export const FACE_SHADE = { top: 1, side: 0.85, bottom: 0.6 };

/** Material types a coloured part can use (preview shading + glTF PBR values). */
export const MATERIALS = {
  cloth:    { label: { en: 'Cloth', ar: 'قماش' },     roughness: 0.95, metalness: 0,   shade: { top: 1, side: 0.85, bottom: 0.6 } },
  denim:    { label: { en: 'Denim', ar: 'جينز' },     roughness: 0.9,  metalness: 0,   shade: { top: 0.97, side: 0.82, bottom: 0.58 } },
  leather:  { label: { en: 'Leather', ar: 'جلد' },    roughness: 0.55, metalness: 0,   shade: { top: 1.08, side: 0.8, bottom: 0.55 } },
  plastic:  { label: { en: 'Glossy / plastic', ar: 'لامع / بلاستيك' }, roughness: 0.3, metalness: 0, shade: { top: 1.12, side: 0.84, bottom: 0.58 } },
  metal:    { label: { en: 'Metal', ar: 'معدن' },     roughness: 0.35, metalness: 1,   shade: { top: 1.25, side: 0.78, bottom: 0.48 } },
  emissive: { label: { en: 'Glowing', ar: 'مضيء' },   roughness: 1,    metalness: 0,   shade: { top: 1.1, side: 1.05, bottom: 0.95 }, emissive: true },
  skin:     { label: { en: 'Skin', ar: 'بشرة' },      roughness: 0.8,  metalness: 0,   shade: { top: 1, side: 0.85, bottom: 0.6 }, internal: true },
};
export const MATERIAL_IDS = Object.keys(MATERIALS).filter(k => !MATERIALS[k].internal);
