/* =====================================================================
 * FABRICS, PATTERNS AND FINISHES (Normal 3D)
 *
 * A fabric sets the physical look (PBR) AND the construction of the
 * garment: thickness (shell thickness, hem rims), stiffness (how deep the
 * drape folds are), drape (how much it hangs), weave (procedural normal /
 * roughness texture). Patterns are drawn with the garment's colours on the
 * panel UVs (metres), so stripes follow the cut of each panel.
 * ===================================================================== */

const L = (en, ar) => ({ en, ar });
export const FABRICS = {
  cotton_jersey: { label: L('Cotton jersey (T-shirt knit)', 'جيرسي قطني'), weave: 'jersey', scale: 0.004, roughness: 0.92, sheen: 0.35, sheenRoughness: 0.8, thickness: 0.0018, stiffness: 0.8, wrinkle: 1 },
  rib_knit: { label: L('Rib knit', 'تريكو مضلع'), weave: 'rib', scale: 0.006, roughness: 0.94, sheen: 0.3, sheenRoughness: 0.8, thickness: 0.0025, stiffness: 0.6, wrinkle: 0.6 },
  fleece: { label: L('Fleece / sweatshirt', 'صوف قطني (فليس)'), weave: 'fleece', scale: 0.004, roughness: 0.97, sheen: 0.6, sheenRoughness: 0.9, thickness: 0.0035, stiffness: 1, wrinkle: 0.8 },
  cotton_poplin: { label: L('Cotton poplin (shirting)', 'بوبلين قطني'), weave: 'plain', scale: 0.0016, roughness: 0.75, sheen: 0.15, sheenRoughness: 0.6, thickness: 0.0016, stiffness: 1.1, wrinkle: 1.2 },
  oxford_cloth: { label: L('Oxford cloth', 'قماش أكسفورد'), weave: 'basket', scale: 0.0022, roughness: 0.82, sheen: 0.15, sheenRoughness: 0.6, thickness: 0.0018, stiffness: 1.1, wrinkle: 1.1 },
  denim: { label: L('Denim', 'جينز'), weave: 'twill', scale: 0.003, roughness: 0.88, sheen: 0.1, sheenRoughness: 0.6, thickness: 0.003, stiffness: 1.4, wrinkle: 1.3, fade: true },
  chino_twill: { label: L('Chino twill', 'تويل قطني (تشينو)'), weave: 'twill', scale: 0.0022, roughness: 0.84, sheen: 0.12, sheenRoughness: 0.6, thickness: 0.0024, stiffness: 1.2, wrinkle: 1 },
  wool_suiting: { label: L('Wool suiting', 'صوف للبدل'), weave: 'twill', scale: 0.0012, roughness: 0.78, sheen: 0.25, sheenRoughness: 0.5, thickness: 0.003, stiffness: 1.3, wrinkle: 0.5 },
  wool_coating: { label: L('Wool coating (melton)', 'صوف للمعاطف'), weave: 'felt', scale: 0.003, roughness: 0.95, sheen: 0.35, sheenRoughness: 0.8, thickness: 0.0045, stiffness: 1.6, wrinkle: 0.4 },
  tweed: { label: L('Tweed', 'تويد'), weave: 'tweed', scale: 0.004, roughness: 0.96, sheen: 0.3, sheenRoughness: 0.9, thickness: 0.004, stiffness: 1.5, wrinkle: 0.4 },
  knit_wool: { label: L('Wool knit (sweater)', 'تريكو صوفي'), weave: 'knit', scale: 0.008, roughness: 0.96, sheen: 0.5, sheenRoughness: 0.9, thickness: 0.004, stiffness: 0.7, wrinkle: 0.5 },
  cable_knit: { label: L('Cable knit', 'تريكو مجدول'), weave: 'cable', scale: 0.05, roughness: 0.96, sheen: 0.5, sheenRoughness: 0.9, thickness: 0.006, stiffness: 0.8, wrinkle: 0.3 },
  linen: { label: L('Linen', 'كتان'), weave: 'slub', scale: 0.0025, roughness: 0.86, sheen: 0.1, sheenRoughness: 0.7, thickness: 0.0018, stiffness: 1.2, wrinkle: 1.8 },
  silk: { label: L('Silk / satin', 'حرير / ساتان'), weave: 'satin', scale: 0.001, roughness: 0.35, sheen: 0.9, sheenRoughness: 0.3, thickness: 0.0012, stiffness: 0.5, wrinkle: 0.7, aniso: true },
  chiffon: { label: L('Chiffon (sheer)', 'شيفون'), weave: 'plain', scale: 0.0008, roughness: 0.6, sheen: 0.6, sheenRoughness: 0.4, thickness: 0.001, stiffness: 0.3, wrinkle: 0.8, opacity: 0.85 },
  velvet: { label: L('Velvet', 'مخمل'), weave: 'pile', scale: 0.002, roughness: 0.9, sheen: 1, sheenRoughness: 0.35, thickness: 0.003, stiffness: 0.9, wrinkle: 0.6 },
  corduroy: { label: L('Corduroy', 'كوردروي'), weave: 'cord', scale: 0.004, roughness: 0.9, sheen: 0.6, sheenRoughness: 0.5, thickness: 0.0035, stiffness: 1.2, wrinkle: 0.8 },
  leather: { label: L('Leather', 'جلد'), weave: 'grain', scale: 0.006, roughness: 0.5, sheen: 0, sheenRoughness: 0.5, thickness: 0.0035, stiffness: 1.8, wrinkle: 0.7, clearcoat: 0.2 },
  suede: { label: L('Suede', 'شامواه'), weave: 'pile', scale: 0.003, roughness: 0.95, sheen: 0.5, sheenRoughness: 0.8, thickness: 0.003, stiffness: 1.5, wrinkle: 0.7 },
  nylon: { label: L('Nylon / technical', 'نايلون / قماش تقني'), weave: 'ripstop', scale: 0.005, roughness: 0.45, sheen: 0.2, sheenRoughness: 0.4, thickness: 0.0015, stiffness: 0.9, wrinkle: 1.4 },
  polyester_sport: { label: L('Sport polyester (mesh)', 'بوليستر رياضي'), weave: 'mesh', scale: 0.002, roughness: 0.55, sheen: 0.3, sheenRoughness: 0.4, thickness: 0.0013, stiffness: 0.6, wrinkle: 0.7 },
  quilted: { label: L('Quilted padding (puffer)', 'مبطن (منفوخ)'), weave: 'ripstop', scale: 0.005, roughness: 0.4, sheen: 0.2, sheenRoughness: 0.4, thickness: 0.012, stiffness: 1.2, wrinkle: 0.6, quilted: true },
  cotton_canvas: { label: L('Cotton canvas / workwear', 'قماش كانفاس'), weave: 'plain', scale: 0.0025, roughness: 0.9, sheen: 0.1, sheenRoughness: 0.6, thickness: 0.0032, stiffness: 1.6, wrinkle: 0.9 },
  crepe: { label: L('Crepe (flowing)', 'كريب'), weave: 'crepe', scale: 0.0012, roughness: 0.8, sheen: 0.3, sheenRoughness: 0.6, thickness: 0.0014, stiffness: 0.5, wrinkle: 0.6 },
  embroidered: { label: L('Embroidered cotton', 'قطن مطرز'), weave: 'plain', scale: 0.002, roughness: 0.8, sheen: 0.2, sheenRoughness: 0.6, thickness: 0.002, stiffness: 1, wrinkle: 0.9 },
};
export const FABRIC_IDS = Object.keys(FABRICS);

export const PATTERNS = {
  solid: { label: L('Solid', 'سادة'), colors: 1 },
  stripes: { label: L('Horizontal stripes', 'خطوط عرضية'), colors: 2 },
  verticalStripes: { label: L('Vertical stripes', 'خطوط طولية'), colors: 2 },
  pinstripe: { label: L('Pinstripe', 'خطوط رفيعة'), colors: 2 },
  checks: { label: L('Checks', 'مربعات'), colors: 2 },
  gingham: { label: L('Gingham', 'جنغام'), colors: 2 },
  plaid: { label: L('Plaid / tartan', 'كاروهات اسكتلندية'), colors: 3 },
  houndstooth: { label: L('Houndstooth', 'نقشة سن الكلب'), colors: 2 },
  herringbone: { label: L('Herringbone', 'نقشة عظم السمكة'), colors: 2 },
  polka: { label: L('Polka dots', 'منقط'), colors: 2 },
  camo: { label: L('Camouflage', 'تمويه'), colors: 3 },
  floral: { label: L('Floral print', 'مطبوع زهور'), colors: 3 },
  geometric: { label: L('Geometric print', 'نقشة هندسية'), colors: 3 },
  shemagh: { label: L('Shemagh / keffiyeh weave', 'نقشة الشماغ'), colors: 2 },
  colorBlock: { label: L('Colour blocking (panels)', 'ألوان متباينة للقطع'), colors: 3 },
};
export const PATTERN_IDS = Object.keys(PATTERNS);

/** Hardware finishes (buttons, zips, rivets, buckles, aglets). */
export const HARDWARE = {
  plastic: { label: L('Plastic', 'بلاستيك'), metalness: 0, roughness: 0.35 },
  horn: { label: L('Horn / corozo', 'قرن'), metalness: 0, roughness: 0.45 },
  brass: { label: L('Brass', 'نحاس'), metalness: 1, roughness: 0.32 },
  silver: { label: L('Silver / nickel', 'فضي'), metalness: 1, roughness: 0.25 },
  gunmetal: { label: L('Gunmetal', 'معدن داكن'), metalness: 1, roughness: 0.4 },
  gold: { label: L('Gold', 'ذهبي'), metalness: 1, roughness: 0.2 },
};
export const HARDWARE_IDS = Object.keys(HARDWARE);

/**
 * Material description for one garment (renderer- and exporter-independent).
 * colors: { main, secondary, accent, trim, rib, lining, stitch, hardware }
 */
export function garmentMaterials(asset, item) {
  const m = item.material || {};
  const fabric = FABRICS[m.fabric] ? m.fabric : asset.fabric || 'cotton_jersey';
  const f = FABRICS[fabric];
  const c = { ...defaultColors(asset), ...(item.colors || {}) };
  const hw = HARDWARE[m.hardware] ? m.hardware : asset.hardware || 'plastic';
  const pattern = PATTERNS[m.pattern] ? m.pattern : 'solid';
  return {
    fabric, pattern, patternScale: m.patternScale ?? 1, wear: m.wear ?? 0,
    main: { kind: 'fabric', fabric, color: c.main, secondary: c.secondary || c.main, accent: c.accent || c.secondary || c.main, pattern, patternScale: m.patternScale ?? 1, wear: m.wear ?? 0, roughness: f.roughness, sheen: f.sheen, sheenRoughness: f.sheenRoughness, weave: f.weave, scale: f.scale, opacity: f.opacity ?? 1, clearcoat: f.clearcoat || 0 },
    rib: { kind: 'fabric', fabric: 'rib_knit', color: c.rib || c.main, pattern: 'solid', roughness: 0.94, sheen: 0.3, sheenRoughness: 0.8, weave: 'rib', scale: 0.006 },
    trim: { kind: 'fabric', fabric, color: c.trim || c.main, pattern: c.trim ? 'solid' : pattern, secondary: c.secondary || c.main, accent: c.accent || c.main, patternScale: m.patternScale ?? 1, roughness: f.roughness, sheen: f.sheen, sheenRoughness: f.sheenRoughness, weave: f.weave, scale: f.scale },
    lining: { kind: 'fabric', fabric: 'silk', color: c.lining || shade(c.main, 0.7), pattern: 'solid', roughness: 0.5, sheen: 0.5, sheenRoughness: 0.4, weave: 'satin', scale: 0.001 },
    inside: { kind: 'fabric', fabric, color: shade(c.main, 0.82), pattern: 'solid', roughness: f.roughness, sheen: f.sheen * 0.5, sheenRoughness: f.sheenRoughness, weave: f.weave, scale: f.scale },
    hardware: { kind: 'hardware', finish: hw, color: c.hardware || (HARDWARE[hw].metalness ? '#C9B27A' : '#E8E2D6'), metalness: HARDWARE[hw].metalness, roughness: HARDWARE[hw].roughness },
    stitch: { kind: 'thread', color: c.stitch || shade(c.main, 0.75), roughness: 0.8 },
    cord: { kind: 'fabric', fabric: 'cotton_jersey', color: c.cord || c.trim || '#F2F2F2', pattern: 'solid', roughness: 0.85, sheen: 0.3, sheenRoughness: 0.8, weave: 'rib', scale: 0.002 },
    tape: { kind: 'fabric', fabric: 'nylon', color: c.tape || '#1E1E1E', pattern: 'solid', roughness: 0.6, sheen: 0.1, sheenRoughness: 0.5, weave: 'plain', scale: 0.001 },
  };
}
export function defaultColors(asset) { return Object.fromEntries(Object.entries(asset.colors || {}).map(([k, v]) => [k, v.default])); }
export function shade(hex, k) {
  const n = parseInt((hex || '#888888').slice(1), 16);
  const ch = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * k)));
  return '#' + [16, 8, 0].map(s => ch(s).toString(16).padStart(2, '0')).join('').toUpperCase();
}
