/* =====================================================================
 * DETAIL LEVELS — what each level really changes.
 * Every number here is used by the generators; nothing is cosmetic.
 * ===================================================================== */
export const DETAIL_LEVELS = {
  standard: {
    label: { en: 'Standard', ar: 'عادي' },
    doc: 'Fast editing: body 11 mm / face 3.2 mm / hands 3.2 mm mesh cells, garment 10 mm, hair cards and clumps at base density, 512 px textures.',
    body: 0.011, face: 0.0032, head: 0.0055, hands: 0.0032, feet: 0.007, garment: 0.010, trim: 1,
    hairDensity: 0.55, hairMass: 0.0045, strands: 0, flyaways: 60, texture: 512, stitching: false, relax: 0,
  },
  high: {
    label: { en: 'High detail', ar: 'تفاصيل عالية' },
    doc: 'Body 8 mm / face 2.3 mm / hands 2.5 mm, garment 7 mm, denser hair with fine strands at the hairline, 1024 px textures, buttonholes and drawstring details.',
    body: 0.008, face: 0.0023, head: 0.004, hands: 0.0025, feet: 0.005, garment: 0.007, trim: 1.5,
    hairDensity: 1, hairMass: 0.0032, strands: 400, flyaways: 160, texture: 1024, stitching: false, relax: 1,
  },
  advanced: {
    label: { en: 'Advanced detail', ar: 'تفاصيل متقدمة' },
    doc: 'Body 6 mm / face 1.8 mm / hands 2 mm, garment 5 mm, maximum hair density with individual strands, 2048 px textures, stitching as real geometry.',
    body: 0.006, face: 0.0018, head: 0.0032, hands: 0.002, feet: 0.004, garment: 0.005, trim: 2,
    hairDensity: 1.6, hairMass: 0.0025, strands: 1500, flyaways: 320, texture: 2048, stitching: true, relax: 1,
  },
};
export const DETAIL_IDS = Object.keys(DETAIL_LEVELS);
export const detailOf = id => DETAIL_LEVELS[id] || DETAIL_LEVELS.standard;
