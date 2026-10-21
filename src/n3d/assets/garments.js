/* =====================================================================
 * NORMAL 3D — GARMENT LIBRARY
 *
 * Each garment registers ONLY the controls that make sense for it (a
 * T-shirt has no lapels, jeans have no sleeves) and a build() that turns
 * those controls into a cut (garments/cut.js) plus trims (garments/trims.js).
 * Fit always changes the garment's shape — ease, drape, where it touches
 * the body — never a uniform scale.
 *
 * To add a garment: copy an entry, give it a unique id, labels in English
 * and Arabic, a description for AI models, its params and a build(); it
 * then appears in the interface, the validator, the AI prompt, the catalog
 * and the JSON Schema automatically.
 * ===================================================================== */
import { registerAsset, num, enm, bool } from '../core/registry.js';
import { FITS, FIT_IDS, looseness } from '../garments/fit.js';
import { FABRICS } from '../materials/fabrics.js';
import { hemHeight, riseHeight } from '../garments/cut.js';

/* ------------------------------------------------------------------ shared controls */
const fitLabels = Object.fromEntries(Object.entries(FITS).map(([k, v]) => [k, v.label]));
const FIT = (def = 'regular', ids = FIT_IDS) => enm(ids, def, 'Fit', 'المقاس', 'how close the garment sits to the body: skin-tight, slim, regular, relaxed, loose, oversized (changes the shape, not the scale)', fitLabels);
const LEN_TOP = (def = 0.55, min = 0, max = 1.3) => num(min, max, def, 'Length', 'الطول', '0 cropped · 0.5 at the hip · 1 upper thigh (tunic)');
const LEN_LONG = (def = 2, min = 1, max = 3) => num(min, max, def, 'Length', 'الطول', '1 upper thigh · 1.5 above the knee · 2 knee · 2.5 mid-calf · 3 ankle');
const SLEEVE = (def = 0.3, min = 0, max = 1) => num(min, max, def, 'Sleeve length', 'طول الكم', '0 sleeveless · 0.12 cap · 0.3 short · 0.5 elbow · 0.75 three-quarter · 1 full length');
const SLEEVE_W = (def = 0) => num(-1, 1, def, 'Sleeve width', 'عرض الكم', 'tapered (−1) … straight (0) … wide / bell (+1)');
const NECK = (def = 'crew', values = ['crew', 'v', 'scoop', 'boat', 'square']) => enm(values, def, 'Neckline', 'فتحة الرقبة', 'neckline shape', {
  crew: { en: 'Crew (round)', ar: 'دائرية' }, v: { en: 'V-neck', ar: 'على شكل V' }, scoop: { en: 'Scoop', ar: 'دائرية واسعة' },
  boat: { en: 'Boat', ar: 'قارب' }, square: { en: 'Square', ar: 'مربعة' }, turtle: { en: 'Turtleneck', ar: 'ياقة عالية ملفوفة' }, mock: { en: 'Mock neck', ar: 'ياقة عالية قصيرة' } });
const NECK_DEPTH = (def = 0.3) => num(0, 1, def, 'Neckline depth', 'عمق فتحة الرقبة', 'how low the neckline goes');
const NECK_W = (def = 0) => num(-1, 1, def, 'Neckline width', 'عرض فتحة الرقبة', 'narrow (−) to wide (+)');
const HEM_W = (def = 0) => num(-1, 1, def, 'Hem width', 'عرض الطرف السفلي', 'fitted (−1) … straight (0) … flared / A-line (+1)');
const TUCK = (def = false) => bool(def, 'Tucked in', 'مدخل في البنطال', 'tucked into the trousers or skirt (sits under their waistband)');
const THICK = (def = 1) => num(0.6, 2, def, 'Fabric thickness', 'سماكة القماش', 'multiplies the fabric thickness (padded garments look puffier)');
const CLOSURE = (def = 'closed', values = ['closed', 'open']) => enm(values, def, 'Closure', 'الإغلاق', 'how the front is worn', {
  closed: { en: 'Closed', ar: 'مغلق' }, open: { en: 'Open', ar: 'مفتوح' }, buttoned: { en: 'Buttoned', ar: 'مزرّر' }, zipped: { en: 'Zipped', ar: 'مسحّب' }, halfZip: { en: 'Half zip', ar: 'سحاب نصفي' } });
const RISE = (def = 0.5) => num(0, 1, def, 'Rise (waist height)', 'ارتفاع الخصر', '0 low rise · 0.5 mid rise · 1 high waist');
const LEG_LEN = (def = 1, min = 0.3, max = 1.04) => num(min, max, def, 'Leg length', 'طول الساق', '0.35 short shorts · 0.45 shorts · 0.6 knee · 0.75 capri · 1 ankle · 1.03 full break');
const LEG_OPEN = (def = 0) => num(-1, 1, def, 'Leg opening', 'اتساع أسفل الساق', 'tapered / skinny (−1) … straight (0) … wide / flared (+1)');
const CROTCH = (def = 0) => num(0, 1, def, 'Dropped crotch', 'انخفاض منطقة الحِجر', 'how low the crotch hangs (sirwal, harem, baggy)');
const CUFF = (def = 'none', values = ['none', 'rib', 'turnUp']) => enm(values, def, 'Hem finish', 'إنهاء الطرف', 'finish at the end of the sleeve or leg', {
  none: { en: 'Plain hem', ar: 'طرف عادي' }, rib: { en: 'Ribbed cuff', ar: 'كفة مطاطية' }, turnUp: { en: 'Turn-up', ar: 'ثنية مقلوبة' }, band: { en: 'Buttoned cuff', ar: 'كفة بزر' }, rolled: { en: 'Rolled up', ar: 'مطوي للأعلى' } });
const POCKETS = (def = true, en = 'Pockets', ar = 'الجيوب', doc = 'show the pockets') => bool(def, en, ar, doc);
const HOOD = (def = true) => bool(def, 'Hood', 'قبعة القطعة (هود)', 'hood lying on the back');
const BUTTONS = (def = 5, min = 0, max = 8) => num(min, max, def, 'Buttons', 'الأزرار', 'number of front buttons', 1);
const COLLAR = (def = 'shirt', values = ['shirt', 'mandarin', 'none']) => enm(values, def, 'Collar', 'الياقة', 'collar style', {
  shirt: { en: 'Point collar', ar: 'ياقة قميص' }, mandarin: { en: 'Mandarin (band)', ar: 'ياقة صينية (قائمة)' }, none: { en: 'No collar', ar: 'بدون ياقة' },
  polo: { en: 'Polo collar', ar: 'ياقة بولو' }, peterpan: { en: 'Rounded (Peter Pan)', ar: 'ياقة مستديرة' }, notch: { en: 'Notch lapel', ar: 'طية مشقوقة' }, peak: { en: 'Peak lapel', ar: 'طية مدببة' }, shawl: { en: 'Shawl lapel', ar: 'طية شال' }, hood: { en: 'Hood', ar: 'قبعة' } });
const HEM_SHAPE = (def = 'straight', values = ['straight', 'curved', 'asymmetric', 'longBack']) => enm(values, def, 'Hem shape', 'شكل الطرف', 'shape of the bottom edge', {
  straight: { en: 'Straight', ar: 'مستقيم' }, curved: { en: 'Curved (shirt-tail)', ar: 'منحني' }, asymmetric: { en: 'Asymmetric', ar: 'غير متماثل' }, longBack: { en: 'Longer at the back', ar: 'أطول من الخلف' } });

const COLORS = (main, extra = {}) => ({ main: { label: { en: 'Main colour', ar: 'اللون الأساسي' }, default: main }, ...extra });
const C2 = (def, en = 'Secondary colour (patterns)', ar = 'اللون الثانوي (للنقشات)') => ({ label: { en, ar }, default: def });
const CK = {
  secondary: d => ({ secondary: C2(d) }),
  accent: d => ({ accent: C2(d, 'Accent colour (patterns)', 'لون إضافي (للنقشات)') }),
  rib: d => ({ rib: C2(d, 'Ribbed bands', 'الأطراف المضلعة') }),
  trim: d => ({ trim: C2(d, 'Trim (collar, plackets, contrast panels)', 'الحواف والياقة') }),
  stitch: d => ({ stitch: C2(d, 'Stitching thread', 'لون الخياطة') }),
  hardware: d => ({ hardware: C2(d, 'Buttons / zip / rivets', 'الأزرار والسحاب') }),
  cord: d => ({ cord: C2(d, 'Drawstrings', 'الأربطة') }),
  lining: d => ({ lining: C2(d, 'Lining', 'البطانة') }),
};

/* ------------------------------------------------------------------ build helpers */
const fabricOf = (ctx, asset) => FABRICS[ctx.fabric] || FABRICS[asset.fabric] || FABRICS.cotton_jersey;
const sleeveSpec = (p, L, o = {}) => (p.sleeveLength > 0.06 ? { t: p.sleeveLength, width: p.sleeveWidth || 0, L: o.sleeveL ?? L, cuffBand: o.cuffBand || 0 } : null);
const necklineDepth = (type, d, S) => (type === 'v' ? (0.06 + 0.16 * d) * S : type === 'scoop' ? (0.03 + 0.14 * d) * S : type === 'square' ? (0.04 + 0.12 * d) * S : (0.02 + 0.04 * d) * S);
const hemOf = (shape) => ({ hemCurve: shape === 'curved' ? 0.8 : 0, hemAsym: shape === 'asymmetric' ? 0.6 : 0, hemDip: shape === 'longBack' ? 1 : 0 });
const detail = (fab, L, extra = {}) => ({ drape: (1 / Math.sqrt(fab.stiffness)) * (0.6 + 0.6 * (fab.drapeK ?? 1)), wrinkle: fab.wrinkle, ...extra });

/**
 * Upper-body garment template (tees, shirts, sweaters, hoodies, jackets, coats, dresses, robes).
 * o: { neck, collar, placket, zip, hood, cuff, hemBand, pockets, lapels, layerThick, extraEase, skirt, … }
 */
function upper(p, ctx, asset, o = {}) {
  const S = ctx.F.S;
  const fab = fabricOf(ctx, asset);
  const L = looseness(p.fit ?? o.fit ?? 'regular');
  const th = fab.thickness * (p.thickness ?? 1) * (o.thick ?? 1) * S;
  const neckType = o.neck || p.neckline || 'crew';
  const torso = {
    length: p.length ?? o.length ?? 0.55,
    neckline: { type: neckType, width: p.necklineWidth || 0, depth: necklineDepth(neckType, p.necklineDepth ?? 0.3, S) },
    flare: (p.hemWidth || 0) * (o.flareK ?? 0.12) + (o.flare || 0), flareFrom: o.flareFrom,
    hang: o.hang, ease: o.ease,
    ...hemOf(p.hemShape),
  };
  // tucked in: the hem sits a few cm inside the waistband, without flare or hang, so the bottoms stay smooth over it
  if (p.tucked && asset.slot === 'top') Object.assign(torso, { length: Math.min(torso.length, 0.4), flare: 0, hang: 0, hemCurve: 0, hemDip: 0, hemAsym: 0 });
  if (o.hemBand) torso.hemBand = o.hemBand * S;
  if (o.noHem) { torso.noHem = true; torso.cutBelow = ctx.F.crotchY - 0.03 * S; }
  const bands = {}, trims = [], stitch = { edges: {}, seams: o.seams ?? 'single' };
  // sleeves and their finish
  const SL = sleeveSpec(p, L, { cuffBand: o.cuff === 'rib' && p.sleeveLength > 0.85 ? 0.08 : 0 });
  if (o.cuff === 'rib' && SL) { bands.cuff = { w: Math.min(0.07, 0.07 * p.sleeveLength) * S, kind: 'rib' }; stitch.edges.cuff = [0.075]; }
  else if (o.cuff === 'band' && SL && p.sleeveLength > 0.85) { bands.cuff = { w: 0.06 * S, kind: 'band' }; trims.push({ type: 'cuffButtons', count: 1 }); stitch.edges.cuff = [0.006, 0.058]; }
  else if (SL) stitch.edges.cuff = [0.012];
  if (SL && p.sleeveRoll) trims.push({ type: 'turnUp', on: 'sleeve', height: 0.05 });
  // hem
  if (o.hemBand) { bands.hem = { w: o.hemBand * S, kind: o.hemBandKind || 'rib' }; stitch.edges.hem = [o.hemBand + 0.004]; }
  else stitch.edges.hem = [0.014];
  // neckline finish
  if (neckType === 'crew' || neckType === 'v' || neckType === 'scoop' || neckType === 'boat' || neckType === 'square') {
    if (o.neckband !== false) { bands.neck = { w: (o.neckbandW ?? 0.018) * S, kind: 'rib' }; stitch.edges.neck = [(o.neckbandW ?? 0.018) + 0.003]; }
  }
  if (neckType === 'turtle' || neckType === 'mock') { torso.collarH = (neckType === 'turtle' ? 0.075 : 0.04) * S; if (neckType === 'turtle') trims.push({ type: 'collar', style: 'turtle' }); else bands.head = { w: 0.035 * S, kind: 'rib' }; }
  // collars, plackets, zips, lapels, hoods
  const col = p.collar ?? o.collar;
  if (col && col !== 'none' && col !== 'hood' && !['notch', 'peak', 'shawl'].includes(col)) trims.push({ type: 'collar', style: col, material: o.collarMaterial });
  if (o.placket) trims.push({ type: 'placket', buttons: p.buttons ?? o.placket.buttons, bottom: o.placket.bottom ? o.placket.bottom(ctx.F, torso) : undefined, width: o.placket.width });
  const closure = p.closure ?? o.closure;
  if (o.zip) {
    if (closure === 'open') { torso.opening = { gap: 0.03 * S }; trims.push({ type: 'zipper', open: true }); }
    else if (closure === 'halfZip') { torso.opening = { gap: 0.004 * S, yLow: ctx.F.chestY - 0.02 * S }; trims.push({ type: 'zipper', open: true }); }
    else trims.push({ type: 'zipper', top: ctx.F.neckBase[1] + (o.zipTop ?? 0.02) * S });
  }
  if (o.lapels) {
    const breakY = ctx.F.waistY + (o.breakAbove ?? 0.07) * S + (p.lapelDepth ?? 0) * -0.08 * S;
    torso.opening = { gap: closure === 'open' ? 0.06 * S : 0, breakY, slope: 0.42 + (p.lapelWidth || 0) * 0.05 };
    trims.push({ type: 'lapels', style: col === 'peak' || col === 'shawl' ? col : 'notch', breakY, width: 0.075 + (p.lapelWidth || 0) * 0.025 });
  }
  if (o.openFront && !o.lapels && !o.zip) {
    const breakY = o.vBreak ? o.vBreak(ctx.F) : null;
    if (closure === 'open') torso.opening = { gap: 0.07 * S, breakY: breakY ?? undefined, slope: breakY ? 0.3 : 0 };
    else if (breakY) torso.opening = { gap: 0, breakY, slope: 0.32 };
  }
  if ((p.hood ?? o.hood) === true || col === 'hood') { torso.neckline.type = 'hood'; trims.push({ type: 'hood', size: o.hoodSize ?? 1, thickness: Math.max(0.009, th / S * 3) }); if (o.drawstrings !== false && closure !== 'open') trims.push({ type: 'drawstrings', at: 'hood' }); }
  if (o.buttons && closure !== 'open') trims.push({ type: 'buttons', ys: o.buttons(ctx.F, p), xs: o.buttonXs || [0], size: o.buttonSize ?? 0.009 });
  if (o.trims) trims.push(...o.trims(ctx.F, p, S));
  const spec = {
    L, thickness: th, extraEase: (o.extraEase || 0) * S + (o.layerEase || 0) * S, torso, sleeves: SL,
    bands, trims, stitch, lined: !!o.lined, skirt: !!o.skirt,
    armhole: SL ? undefined : { strapX: o.strapX ?? 0.11, depth: o.armholeDepth ?? 0.03 },
    detail: detail(fab, L, o.detail),
    blend: o.blend,
  };
  if (o.bottom) spec.bottom = o.bottom(p, ctx);
  return spec;
}

/** Lower-body template (trousers, jeans, shorts, sweatpants, sirwal). */
function lower(p, ctx, asset, o = {}) {
  const S = ctx.F.S;
  const fab = fabricOf(ctx, asset);
  const L = looseness(p.fit ?? o.fit ?? 'regular');
  const th = fab.thickness * (p.thickness ?? 1) * S;
  const elastic = !!o.elastic;
  const bands = { waist: { w: (o.waistW ?? 0.038) * S, kind: elastic ? 'elastic' : 'band' } };
  const stitch = { edges: { waist: elastic ? [0.004] : [0.004, (o.waistW ?? 0.038) - 0.004], legHem: [0.014] }, seams: o.seams ?? 'single' };
  const trims = [];
  const cuff = p.cuff ?? o.cuff ?? 'none';
  if (cuff === 'rib') { bands.legHem = { w: 0.07 * S, kind: 'rib' }; stitch.edges.legHem = [0.074]; }
  if (cuff === 'turnUp') trims.push({ type: 'turnUp', height: 0.04 });
  if (!elastic) trims.push({ type: 'waistband', loops: o.beltLoops !== false, fly: o.fly !== false, button: o.button !== false, width: o.waistW ?? 0.038 });
  else if (o.drawstrings !== false) trims.push({ type: 'drawstrings', at: 'waist' });
  if (o.trims) trims.push(...o.trims(ctx.F, p, S));
  return {
    L, thickness: th, bands, trims, stitch,
    bottom: { rise: p.rise ?? o.rise ?? 0.5, t: p.legLength ?? o.legLength ?? 1, opening: p.legOpening ?? 0, crotchDrop: (p.crotchDrop || 0) * 0.16, cuffBand: cuff === 'rib' ? 0.07 * S : 0, waistBand: (o.waistW ?? 0.038) * S, legL: o.legL },
    detail: detail(fab, L, o.detail),
  };
}

/** Skirt template. */
function skirt(p, ctx, asset, o = {}) {
  const S = ctx.F.S;
  const fab = fabricOf(ctx, asset);
  const L = looseness(p.fit ?? 'regular');
  const th = fab.thickness * S;
  const style = p.style || 'aline';
  const flare = { pencil: 0, aline: 0.22, circle: 0.55, pleated: 0.3, tulip: 0.08, wrap: 0.15 }[style] ?? 0.2;
  return {
    L: Math.min(L, 0.45), thickness: th,
    bottom: { skirt: true, rise: p.rise ?? 0.75, length: p.length ?? 2, flare: flare * (1 + (p.hemWidth || 0) * 0.8), waistBand: 0.03 * S, hemAsym: style === 'wrap' ? 0.4 : 0 },
    bands: { waist: { w: 0.03 * S, kind: o.elastic ? 'elastic' : 'band' } },
    trims: [...(p.slit ? [] : []), ...(style === 'wrap' ? [{ type: 'buttons', ys: [ctx.F.hipY + 0.06 * S], xs: [0.09], size: 0.01 }] : [])],
    stitch: { edges: { waist: [0.004, 0.026], hem: [0.015] }, seams: 'single' },
    detail: detail(fab, L, { pleats: style === 'pleated' ? 24 + Math.round((p.pleats ?? 0.5) * 24) : 0, pleatDepth: 0.008 }),
  };
}

/* ------------------------------------------------------------------ registration */
const G = (def) => registerAsset({ category: { top: 'upper', mid: 'upper', outer: 'upper', bottom: 'lower', fullBody: 'full' }[def.slot], tags: [], ...def });
const yAt = (F, k) => F.waistY + (F.chestY - F.waistY) * k;

/* ============================ BASE LAYER TOPS ============================ */
G({
  id: 'top_tshirt_01', slot: 'top', layer: 10, label: { en: 'T-shirt', ar: 'تيشيرت' },
  description: 'Classic T-shirt in cotton jersey with a ribbed neckband; choose crew, V or scoop neck, sleeve length and fit.',
  tags: ['casual', 'tshirt', 'tee', 'knit'], fabric: 'cotton_jersey', fabrics: ['cotton_jersey', 'polyester_sport', 'linen', 'rib_knit'],
  params: { fit: FIT('regular'), length: LEN_TOP(0.6), sleeveLength: SLEEVE(0.3), sleeveWidth: SLEEVE_W(0), neckline: NECK('crew', ['crew', 'v', 'scoop', 'boat']), necklineDepth: NECK_DEPTH(0.3), necklineWidth: NECK_W(0), hemWidth: HEM_W(0), tucked: TUCK(false), sleeveRoll: bool(false, 'Rolled sleeves', 'أكمام مطوية', 'sleeve ends rolled up once') },
  colors: COLORS('#F2F2F2', { ...CK.secondary('#1F2A44'), ...CK.accent('#C0392B'), ...CK.rib('#F2F2F2') }),
  build: (p, ctx, a) => upper(p, ctx, a, {}),
});
G({
  id: 'top_longsleeve_01', slot: 'top', layer: 10, label: { en: 'Long-sleeve T-shirt', ar: 'تيشيرت بأكمام طويلة' },
  description: 'Long-sleeve jersey top with optional ribbed cuffs.',
  tags: ['casual', 'long sleeve', 'knit'], fabric: 'cotton_jersey', fabrics: ['cotton_jersey', 'rib_knit', 'polyester_sport'],
  params: { fit: FIT('slim'), length: LEN_TOP(0.6), sleeveLength: SLEEVE(1, 0.5, 1), sleeveWidth: SLEEVE_W(0), neckline: NECK('crew', ['crew', 'v', 'scoop', 'boat', 'mock']), necklineDepth: NECK_DEPTH(0.25), cuffs: CUFF('none', ['none', 'rib']), tucked: TUCK(false) },
  colors: COLORS('#2E3A4F', { ...CK.secondary('#E6E6E6'), ...CK.rib('#2E3A4F') }),
  build: (p, ctx, a) => upper(p, ctx, a, { cuff: p.cuffs }),
});
G({
  id: 'top_polo_01', slot: 'top', layer: 10, label: { en: 'Polo shirt', ar: 'قميص بولو' },
  description: 'Piqué polo shirt with a knitted polo collar, three-button placket and ribbed sleeve bands.',
  tags: ['smart casual', 'polo', 'collar'], fabric: 'cotton_jersey', fabrics: ['cotton_jersey', 'polyester_sport'], hardware: 'plastic',
  params: { fit: FIT('regular'), length: LEN_TOP(0.6), sleeveLength: SLEEVE(0.3, 0.2, 1), buttons: BUTTONS(3, 0, 4), tucked: TUCK(false) },
  colors: COLORS('#1E5631', { ...CK.rib('#1E5631'), ...CK.hardware('#F0EDE5'), ...CK.secondary('#FFFFFF') }),
  build: (p, ctx, a) => upper({ ...p, neckline: 'collar' }, ctx, a, { neck: 'collar', collar: 'polo', placket: { buttons: p.buttons, bottom: (F) => F.chestY + 0.035 * F.S, width: 0.026 }, cuff: 'none', trims: (F, pp) => (pp.sleeveLength < 0.6 ? [] : []) }),
});
G({
  id: 'top_dress_shirt_01', slot: 'top', layer: 10, label: { en: 'Button-up shirt', ar: 'قميص بأزرار' },
  description: 'Woven button-up shirt with a point collar, full button placket, buttoned cuffs and a curved shirt-tail hem; optional chest pocket.',
  tags: ['formal', 'shirt', 'collar', 'buttons'], fabric: 'cotton_poplin', fabrics: ['cotton_poplin', 'oxford_cloth', 'linen', 'denim', 'silk', 'corduroy'], hardware: 'plastic',
  params: { fit: FIT('regular'), length: LEN_TOP(0.75, 0.4, 1.2), sleeveLength: SLEEVE(1, 0.25, 1), collar: COLLAR('shirt', ['shirt', 'mandarin', 'none']), buttons: BUTTONS(7, 3, 9), pocket: POCKETS(false, 'Chest pocket', 'جيب الصدر', 'patch pocket on the left chest'), hemShape: HEM_SHAPE('curved', ['straight', 'curved']), tucked: TUCK(false), sleeveRoll: bool(false, 'Rolled sleeves', 'أكمام مطوية', 'sleeves rolled up') },
  colors: COLORS('#EEF2F7', { ...CK.secondary('#7C93B8'), ...CK.accent('#1F2A44'), ...CK.hardware('#EDEAE2'), ...CK.stitch('#D9DEE6') }),
  build: (p, ctx, a) => upper({ ...p, neckline: 'collar' }, ctx, a, { neck: 'collar', placket: { buttons: p.buttons }, cuff: 'band', seams: 'single',
    trims: (F, pp, S) => (pp.pocket ? [{ type: 'pocket', kind: 'patch', w: 0.11, h: 0.13, at: { th: -0.45, y: F.chestY + 0.07 * S } }] : []) }),
});
G({
  id: 'top_tank_01', slot: 'top', layer: 10, label: { en: 'Tank top', ar: 'قميص بدون أكمام' },
  description: 'Sleeveless tank top with adjustable strap width and armhole depth.',
  tags: ['sleeveless', 'summer', 'sport'], fabric: 'cotton_jersey', fabrics: ['cotton_jersey', 'rib_knit', 'polyester_sport', 'silk'],
  params: { fit: FIT('slim'), length: LEN_TOP(0.6), neckline: NECK('scoop', ['crew', 'scoop', 'v', 'square']), necklineDepth: NECK_DEPTH(0.4), strapWidth: num(0, 1, 0.4, 'Strap width', 'عرض الحمّالة', 'thin straps (0) to wide (1)'), armholeDepth: num(0, 1, 0.4, 'Armhole depth', 'عمق فتحة الذراع', 'how low the armholes are cut'), tucked: TUCK(false) },
  colors: COLORS('#FFFFFF', { ...CK.secondary('#222222'), ...CK.rib('#FFFFFF') }),
  build: (p, ctx, a) => upper({ ...p, sleeveLength: 0 }, ctx, a, { strapX: 0.075 + 0.05 * (p.strapWidth ?? 0.4) - 0.0 * 0, armholeDepth: 0.0 + 0.07 * (p.armholeDepth ?? 0.4), neckbandW: 0.012,
    trims: () => [], detail: {} }),
});
G({
  id: 'top_henley_01', slot: 'top', layer: 10, label: { en: 'Henley', ar: 'هنلي' },
  description: 'Collarless knit top with a short button placket at the neck.',
  tags: ['casual', 'buttons', 'knit'], fabric: 'cotton_jersey', fabrics: ['cotton_jersey', 'rib_knit', 'linen'],
  params: { fit: FIT('slim'), length: LEN_TOP(0.6), sleeveLength: SLEEVE(1, 0.25, 1), buttons: BUTTONS(3, 2, 5), cuffs: CUFF('rib', ['none', 'rib']), tucked: TUCK(false) },
  colors: COLORS('#8A7660', { ...CK.rib('#8A7660'), ...CK.hardware('#D9CBB5') }),
  build: (p, ctx, a) => upper(p, ctx, a, { neck: 'crew', cuff: p.cuffs, placket: { buttons: p.buttons, bottom: F => F.chestY + 0.03 * F.S, width: 0.024 } }),
});
G({
  id: 'top_blouse_01', slot: 'top', layer: 10, label: { en: 'Blouse', ar: 'بلوزة' },
  description: 'Soft flowing blouse with a V or round neck, optional buttons and loose sleeves.',
  tags: ['blouse', 'feminine', 'flowing'], fabric: 'crepe', fabrics: ['crepe', 'silk', 'chiffon', 'cotton_poplin', 'linen'],
  params: { fit: FIT('relaxed'), length: LEN_TOP(0.65), sleeveLength: SLEEVE(0.75), sleeveWidth: SLEEVE_W(0.4), neckline: NECK('v', ['v', 'crew', 'scoop', 'boat', 'square']), necklineDepth: NECK_DEPTH(0.35), buttons: BUTTONS(0, 0, 8), hemWidth: HEM_W(0.2), tucked: TUCK(false) },
  colors: COLORS('#F4E1D2', { ...CK.secondary('#C76D7E'), ...CK.accent('#3B5B4F'), ...CK.hardware('#F8F5EE') }),
  build: (p, ctx, a) => upper(p, ctx, a, { neckband: false, placket: p.buttons > 0 ? { buttons: p.buttons, width: 0.022 } : null }),
});
G({
  id: 'top_turtleneck_01', slot: 'top', layer: 10, label: { en: 'Turtleneck', ar: 'كنزة بياقة عالية' },
  description: 'Fine-knit turtleneck (rolled high collar) or mock neck.',
  tags: ['knit', 'winter', 'turtleneck'], fabric: 'rib_knit', fabrics: ['rib_knit', 'knit_wool', 'cotton_jersey'],
  params: { fit: FIT('slim'), length: LEN_TOP(0.6), sleeveLength: SLEEVE(1, 0.3, 1), neckline: NECK('turtle', ['turtle', 'mock']), tucked: TUCK(false) },
  colors: COLORS('#1C1C1C', { ...CK.rib('#1C1C1C') }),
  build: (p, ctx, a) => upper(p, ctx, a, { cuff: 'rib', hemBand: 0.04 }),
});

/* ============================ MID LAYERS ============================ */
G({
  id: 'mid_sweatshirt_01', slot: 'mid', layer: 30, label: { en: 'Sweatshirt', ar: 'سويت شيرت' },
  description: 'Crew-neck fleece sweatshirt with ribbed neckband, cuffs and hem band that gather the body.',
  tags: ['casual', 'fleece', 'sport'], fabric: 'fleece', fabrics: ['fleece', 'cotton_jersey', 'knit_wool'],
  params: { fit: FIT('relaxed'), length: LEN_TOP(0.6), sleeveLength: SLEEVE(1, 0.3, 1), sleeveWidth: SLEEVE_W(0), thickness: THICK(1) },
  colors: COLORS('#9AA5B1', { ...CK.rib('#9AA5B1'), ...CK.secondary('#2D2D2D') }),
  build: (p, ctx, a) => upper(p, ctx, a, { cuff: 'rib', hemBand: 0.06, neckbandW: 0.022 }),
});
G({
  id: 'mid_hoodie_01', slot: 'mid', layer: 30, label: { en: 'Hoodie', ar: 'هودي' },
  description: 'Fleece hoodie with a lined hood, drawstrings, kangaroo pocket and ribbed cuffs and hem; pullover or zip-up (closed or open).',
  tags: ['casual', 'hood', 'fleece', 'streetwear'], fabric: 'fleece', fabrics: ['fleece', 'cotton_jersey', 'polyester_sport'], hardware: 'silver',
  params: { fit: FIT('relaxed'), length: LEN_TOP(0.62), sleeveLength: SLEEVE(1, 0.3, 1), closure: CLOSURE('closed', ['closed', 'zipped', 'open']), hood: HOOD(true), pocket: POCKETS(true, 'Kangaroo pocket', 'جيب أمامي', 'front pouch pocket'), thickness: THICK(1) },
  colors: COLORS('#3B3F46', { ...CK.rib('#3B3F46'), ...CK.cord('#EDEDED'), ...CK.hardware('#BDBDBD'), ...CK.secondary('#E0E0E0') }),
  build: (p, ctx, a) => upper({ ...p, closure: p.closure === 'closed' ? 'closed' : p.closure }, ctx, a, { neck: 'crew', neckband: false, cuff: 'rib', hemBand: 0.06, hood: p.hood,
    zip: p.closure !== 'closed', closure: p.closure === 'zipped' ? 'closed' : p.closure,
    trims: (F, pp, S) => (pp.pocket ? (pp.closure === 'closed'
      ? [{ type: 'pocket', kind: 'kangaroo', w: 0.36, h: 0.17, at: { th: 0, y: hemHeight(F, pp.length) + 0.13 * S } }]
      : [{ type: 'pocket', kind: 'kangaroo', w: 0.16, h: 0.16, at: { th: -0.55, y: hemHeight(F, pp.length) + 0.13 * S } }, { type: 'pocket', kind: 'kangaroo', w: 0.16, h: 0.16, at: { th: 0.55, y: hemHeight(F, pp.length) + 0.13 * S } }]) : []) }),
});
G({
  id: 'mid_sweater_01', slot: 'mid', layer: 30, label: { en: 'Sweater', ar: 'كنزة صوف' },
  description: 'Knitted wool sweater (jumper) with ribbed hem, cuffs and neck; crew, V or turtleneck.',
  tags: ['knit', 'wool', 'winter', 'jumper'], fabric: 'knit_wool', fabrics: ['knit_wool', 'cable_knit', 'fleece'],
  params: { fit: FIT('relaxed'), length: LEN_TOP(0.62), sleeveLength: SLEEVE(1, 0.5, 1), neckline: NECK('crew', ['crew', 'v', 'turtle', 'mock']), necklineDepth: NECK_DEPTH(0.3), thickness: THICK(1) },
  colors: COLORS('#7A2E3A', { ...CK.rib('#7A2E3A'), ...CK.secondary('#E8DCC8'), ...CK.accent('#2C3E50') }),
  build: (p, ctx, a) => upper(p, ctx, a, { cuff: 'rib', hemBand: 0.05, neckbandW: 0.025 }),
});
G({
  id: 'mid_cardigan_01', slot: 'mid', layer: 30, label: { en: 'Cardigan', ar: 'كارديغان' },
  description: 'Knitted cardigan with a V front, button band and optional patch pockets; worn buttoned or open.',
  tags: ['knit', 'buttons', 'layering'], fabric: 'knit_wool', fabrics: ['knit_wool', 'cable_knit', 'cotton_jersey'], hardware: 'horn',
  params: { fit: FIT('relaxed'), length: LEN_TOP(0.75, 0.4, 1.6), sleeveLength: SLEEVE(1, 0.5, 1), closure: CLOSURE('closed', ['closed', 'open']), buttons: BUTTONS(5, 0, 7), pocket: POCKETS(true) },
  colors: COLORS('#C8B48A', { ...CK.rib('#C8B48A'), ...CK.hardware('#5A4632') }),
  build: (p, ctx, a) => upper(p, ctx, a, { neck: 'crew', neckband: false, cuff: 'rib', hemBand: 0.045, openFront: true, vBreak: F => F.chestY - 0.02 * F.S,
    buttons: (F, pp) => { const n = pp.buttons || 0, top = F.chestY - 0.03 * F.S, bot = hemHeight(F, pp.length) + 0.05 * F.S; return Array.from({ length: n }, (_, i) => (n === 1 ? top : top - (top - bot) * i / (n - 1))); }, buttonSize: 0.0075,
    trims: (F, pp, S) => (pp.pocket ? [{ type: 'pocket', kind: 'patch', w: 0.12, h: 0.12, at: { th: -0.6, y: hemHeight(F, pp.length) + 0.12 * S } }, { type: 'pocket', kind: 'patch', w: 0.12, h: 0.12, at: { th: 0.6, y: hemHeight(F, pp.length) + 0.12 * S } }] : []) }),
});
G({
  id: 'mid_waistcoat_01', slot: 'mid', layer: 30, label: { en: 'Waistcoat (vest)', ar: 'صدرية (فيست)' },
  description: 'Tailored sleeveless waistcoat with a V front, buttons and welt pockets.',
  tags: ['formal', 'suit', 'vest', 'sleeveless'], fabric: 'wool_suiting', fabrics: ['wool_suiting', 'tweed', 'linen', 'velvet'], hardware: 'horn',
  params: { fit: FIT('slim', ['skinTight', 'slim', 'regular']), length: LEN_TOP(0.45, 0.3, 0.7), buttons: BUTTONS(5, 3, 6), pocket: POCKETS(true) },
  colors: COLORS('#3A3F4A', { ...CK.lining('#8E8E8E'), ...CK.hardware('#2B2B2B'), ...CK.secondary('#5B6070') }),
  build: (p, ctx, a) => upper({ ...p, sleeveLength: 0, closure: 'closed' }, ctx, a, { neck: 'crew', neckband: false, openFront: true, vBreak: F => yAt(F, 0.35), strapX: 0.085, armholeDepth: 0.06, lined: true, layerEase: 0.002,
    buttons: (F, pp) => { const n = pp.buttons, top = yAt(F, 0.3), bot = hemHeight(F, pp.length) + 0.05 * F.S; return Array.from({ length: n }, (_, i) => top - (top - bot) * i / (n - 1)); }, buttonSize: 0.0065,
    trims: (F, pp) => (pp.pocket ? [{ type: 'welt', w: 0.09, at: { th: -0.6, y: F.waistY - 0.01 * F.S } }, { type: 'welt', w: 0.09, at: { th: 0.6, y: F.waistY - 0.01 * F.S } }] : []) }),
});

/* ============================ OUTERWEAR ============================ */
G({
  id: 'outer_denim_jacket_01', slot: 'outer', layer: 40, label: { en: 'Denim jacket', ar: 'جاكيت جينز' },
  description: 'Trucker denim jacket with a point collar, metal buttons, flap chest pockets, buttoned waistband and contrast stitching.',
  tags: ['denim', 'casual', 'jacket'], fabric: 'denim', fabrics: ['denim', 'corduroy', 'cotton_canvas', 'suede'], hardware: 'brass',
  params: { fit: FIT('regular', ['slim', 'regular', 'relaxed', 'oversized']), length: LEN_TOP(0.45, 0.3, 0.7), sleeveLength: SLEEVE(1, 0.5, 1), closure: CLOSURE('closed', ['closed', 'open']), pocket: POCKETS(true, 'Chest pockets', 'جيوب الصدر', 'flap pockets on the chest') },
  colors: COLORS('#4A6A95', { ...CK.stitch('#D39B3A'), ...CK.hardware('#B08D57'), ...CK.secondary('#3B5579') }),
  build: (p, ctx, a) => upper({ ...p, collar: 'shirt' }, ctx, a, { neck: 'collar', collar: 'shirt', cuff: 'band', hemBand: 0.05, hemBandKind: 'band', openFront: true, layerEase: 0.004, seams: 'double',
    placket: p.closure === 'open' ? null : { buttons: 6, width: 0.036 },
    trims: (F, pp, S) => (pp.pocket ? [{ type: 'pocket', kind: 'flap', w: 0.11, h: 0.12, at: { th: -0.5, y: F.chestY + 0.05 * S } }, { type: 'pocket', kind: 'flap', w: 0.11, h: 0.12, at: { th: 0.5, y: F.chestY + 0.05 * S } }] : []) }),
});
G({
  id: 'outer_bomber_01', slot: 'outer', layer: 40, label: { en: 'Bomber jacket', ar: 'جاكيت بومبر' },
  description: 'Padded bomber jacket with a ribbed collar, cuffs and hem, front zip and welt pockets.',
  tags: ['jacket', 'zip', 'padded', 'streetwear'], fabric: 'nylon', fabrics: ['nylon', 'leather', 'suede', 'wool_coating'], hardware: 'silver',
  params: { fit: FIT('relaxed'), length: LEN_TOP(0.5, 0.35, 0.7), closure: CLOSURE('zipped', ['zipped', 'open']), thickness: THICK(1.6), sleeveLength: SLEEVE(1, 0.8, 1) },
  colors: COLORS('#4B5320', { ...CK.rib('#1F1F1F'), ...CK.lining('#E8772E'), ...CK.hardware('#C0C0C0') }),
  build: (p, ctx, a) => upper(p, ctx, a, { neck: 'mock', cuff: 'rib', hemBand: 0.06, zip: true, closure: p.closure === 'zipped' ? 'closed' : 'open', lined: true, layerEase: 0.006, extraEase: 0.004,
    trims: F => [{ type: 'welt', w: 0.12, at: { th: -0.75, y: F.waistY + 0.02 * F.S }, slant: 0.05 }, { type: 'welt', w: 0.12, at: { th: 0.75, y: F.waistY + 0.02 * F.S }, slant: -0.05 }] }),
});
G({
  id: 'outer_leather_jacket_01', slot: 'outer', layer: 40, label: { en: 'Leather jacket', ar: 'جاكيت جلد' },
  description: 'Short leather jacket with notch lapels, front zip and zipped pockets.',
  tags: ['leather', 'jacket', 'rock'], fabric: 'leather', fabrics: ['leather', 'suede', 'denim'], hardware: 'silver',
  params: { fit: FIT('slim', ['slim', 'regular', 'relaxed']), length: LEN_TOP(0.45, 0.3, 0.65), closure: CLOSURE('open', ['open', 'zipped']) },
  colors: COLORS('#1B1B1B', { ...CK.lining('#5A1A1A'), ...CK.hardware('#BFC3C7'), ...CK.stitch('#2A2A2A') }),
  build: (p, ctx, a) => upper({ ...p, sleeveLength: 1, collar: 'notch' }, ctx, a, { lapels: true, collar: 'notch', closure: p.closure === 'open' ? 'open' : 'closed', breakAbove: 0.2, cuff: 'none', lined: true, layerEase: 0.006, hemBand: 0.04, hemBandKind: 'band',
    trims: F => [{ type: 'welt', w: 0.13, at: { th: -0.7, y: F.waistY + 0.03 * F.S }, slant: 0.04 }, { type: 'welt', w: 0.13, at: { th: 0.7, y: F.waistY + 0.03 * F.S }, slant: -0.04 }] }),
});
G({
  id: 'outer_blazer_01', slot: 'outer', layer: 40, label: { en: 'Blazer / suit jacket', ar: 'بليزر / جاكيت بدلة' },
  description: 'Tailored, lined blazer with notch, peak or shawl lapels, one to three front buttons, flap pockets, a chest welt pocket and sleeve buttons.',
  tags: ['formal', 'suit', 'tailored', 'lapels'], fabric: 'wool_suiting', fabrics: ['wool_suiting', 'tweed', 'linen', 'velvet', 'corduroy'], hardware: 'horn',
  params: { fit: FIT('regular', ['slim', 'regular', 'relaxed']), length: LEN_TOP(0.95, 0.75, 1.2), collar: COLLAR('notch', ['notch', 'peak', 'shawl']), lapelWidth: num(-1, 1, 0, 'Lapel width', 'عرض طية الصدر', 'narrow (−) to wide (+) lapels'), buttons: BUTTONS(2, 1, 3), closure: CLOSURE('closed', ['closed', 'open']), pocket: POCKETS(true) },
  colors: COLORS('#2B3242', { ...CK.secondary('#3D4659'), ...CK.lining('#6B2737'), ...CK.hardware('#1C1C1C') }),
  build: (p, ctx, a) => upper({ ...p, sleeveLength: 1 }, ctx, a, { lapels: true, lined: true, layerEase: 0.005, extraEase: 0.002, breakAbove: 0.04 + 0.03 * (3 - p.buttons),
    buttons: (F, pp) => Array.from({ length: pp.buttons }, (_, i) => F.waistY + (0.04 + 0.03 * (3 - pp.buttons)) * F.S - 0.009 * F.S - i * 0.09 * F.S),
    trims: (F, pp, S) => [{ type: 'cuffButtons', count: 3, size: 0.0055 }, ...(pp.pocket ? [{ type: 'welt', at: { th: -0.85, y: F.waistY - 0.05 * S }, flap: true }, { type: 'welt', at: { th: 0.85, y: F.waistY - 0.05 * S }, flap: true }, { type: 'welt', w: 0.1, at: { th: -0.5, y: F.chestY + 0.06 * S }, slant: 0.01 }] : [])] }),
});
G({
  id: 'outer_coat_01', slot: 'outer', layer: 45, label: { en: 'Overcoat / trench coat', ar: 'معطف' },
  description: 'Long lined coat: overcoat with notch lapels or trench coat with epaulettes; single or open front, belt optional.',
  tags: ['coat', 'winter', 'long', 'formal'], fabric: 'wool_coating', fabrics: ['wool_coating', 'cotton_canvas', 'tweed', 'leather', 'nylon'], hardware: 'horn',
  params: { fit: FIT('regular', ['slim', 'regular', 'relaxed', 'oversized']), length: LEN_LONG(2, 1, 3), style: enm(['overcoat', 'trench'], 'overcoat', 'Style', 'الطراز', 'overcoat (clean) or trench (epaulettes)', { overcoat: { en: 'Overcoat', ar: 'معطف كلاسيكي' }, trench: { en: 'Trench coat', ar: 'معطف ترنش' } }), collar: COLLAR('notch', ['notch', 'peak']), closure: CLOSURE('closed', ['closed', 'open']), buttons: BUTTONS(3, 2, 5), hemWidth: HEM_W(0.2), thickness: THICK(1) },
  colors: COLORS('#5B4636', { ...CK.lining('#2F2F35'), ...CK.hardware('#2A211A'), ...CK.secondary('#3E3027') }),
  build: (p, ctx, a) => upper({ ...p, sleeveLength: 1 }, ctx, a, { lapels: true, lined: true, layerEase: 0.008, extraEase: 0.004, skirt: true, flareFrom: ctx.F.hipY, flareK: 0.12, breakAbove: 0.12,
    buttons: (F, pp) => Array.from({ length: pp.buttons }, (_, i) => F.waistY + 0.1 * F.S - i * 0.1 * F.S), buttonSize: 0.011,
    trims: (F, pp, S) => [{ type: 'cuffButtons', count: 2, size: 0.006 }, { type: 'pocket', kind: 'flap', w: 0.16, h: 0.05, at: { th: -0.95, y: F.hipY - 0.0 * S }, button: false }, { type: 'pocket', kind: 'flap', w: 0.16, h: 0.05, at: { th: 0.95, y: F.hipY }, button: false }, ...(pp.style === 'trench' ? [{ type: 'epaulettes' }] : [])] }),
});
G({
  id: 'outer_parka_01', slot: 'outer', layer: 45, label: { en: 'Parka', ar: 'باركا' },
  description: 'Padded hooded parka with a front zip, big flap pockets and ribbed inner cuffs.',
  tags: ['coat', 'winter', 'hood', 'padded'], fabric: 'cotton_canvas', fabrics: ['cotton_canvas', 'nylon', 'quilted'], hardware: 'gunmetal',
  params: { fit: FIT('relaxed', ['regular', 'relaxed', 'loose', 'oversized']), length: LEN_LONG(1.3, 0.8, 2), closure: CLOSURE('zipped', ['zipped', 'open']), hood: HOOD(true), thickness: THICK(1.5) },
  colors: COLORS('#4E5B3A', { ...CK.lining('#C46A2B'), ...CK.hardware('#3A3A3A'), ...CK.cord('#2B2B2B') }),
  build: (p, ctx, a) => upper({ ...p, sleeveLength: 1 }, ctx, a, { neck: 'mock', zip: true, closure: p.closure === 'zipped' ? 'closed' : 'open', hood: p.hood, hoodSize: 1.15, cuff: 'none', lined: true, layerEase: 0.01, extraEase: 0.006, skirt: p.length > 1.05, flareFrom: ctx.F.hipY, flareK: 0.1,
    trims: (F, pp, S) => [{ type: 'pocket', kind: 'flap', w: 0.17, h: 0.18, at: { th: -0.75, y: F.hipY + 0.02 * S } }, { type: 'pocket', kind: 'flap', w: 0.17, h: 0.18, at: { th: 0.75, y: F.hipY + 0.02 * S } }] }),
});
G({
  id: 'outer_puffer_01', slot: 'outer', layer: 45, label: { en: 'Puffer jacket', ar: 'جاكيت منفوخ' },
  description: 'Quilted down puffer jacket: horizontal baffles, stand collar, front zip; with or without sleeves (gilet).',
  tags: ['padded', 'winter', 'quilted', 'zip'], fabric: 'quilted', fabrics: ['quilted', 'nylon'], hardware: 'silver',
  params: { fit: FIT('relaxed', ['regular', 'relaxed', 'loose']), length: LEN_TOP(0.6, 0.4, 1.3), sleeveLength: SLEEVE(1, 0, 1), closure: CLOSURE('zipped', ['zipped', 'open']), puffiness: num(0.3, 1.5, 1, 'Puffiness', 'درجة الانتفاخ', 'how thick the padded baffles are') },
  colors: COLORS('#1F3A5F', { ...CK.lining('#1F3A5F'), ...CK.hardware('#D0D0D0') }),
  build: (p, ctx, a) => upper(p, ctx, a, { neck: 'mock', zip: true, closure: p.closure === 'zipped' ? 'closed' : 'open', cuff: 'rib', hemBand: 0.02, hemBandKind: 'band', thick: 0.5 + 0.4 * (p.puffiness ?? 1), layerEase: 0.01 + 0.01 * (p.puffiness ?? 1), extraEase: 0.006, lined: true, armholeDepth: 0.05, strapX: 0.07,
    detail: { quilt: 0.09, quiltDepth: 0.008 * (p.puffiness ?? 1) } }),
});
G({
  id: 'outer_service_jacket_01', slot: 'outer', layer: 40, label: { en: 'Uniform jacket', ar: 'جاكيت زي رسمي' },
  description: 'Uniform / service jacket with a stand or notch collar, epaulettes, four flap pockets and a row of buttons (military, police, pilot, school uniforms).',
  tags: ['uniform', 'military', 'formal', 'buttons'], fabric: 'wool_suiting', fabrics: ['wool_suiting', 'cotton_canvas', 'chino_twill'], hardware: 'gold',
  params: { fit: FIT('regular', ['slim', 'regular', 'relaxed']), length: LEN_TOP(0.85, 0.6, 1.1), collar: COLLAR('mandarin', ['mandarin', 'notch']), buttons: BUTTONS(5, 4, 7) },
  colors: COLORS('#2F3B2B', { ...CK.hardware('#C9A54A'), ...CK.trim('#2F3B2B'), ...CK.lining('#25301F') }),
  build: (p, ctx, a) => upper({ ...p, sleeveLength: 1, neckline: 'collar' }, ctx, a, p.collar === 'notch'
    ? { lapels: true, collar: 'notch', lined: true, layerEase: 0.004, breakAbove: 0.16, buttons: (F, pp) => Array.from({ length: pp.buttons }, (_, i) => F.waistY + 0.16 * F.S - i * 0.085 * F.S), trims: uniformPockets }
    : { neck: 'collar', collar: 'mandarin', lined: true, layerEase: 0.004, buttons: (F, pp) => Array.from({ length: pp.buttons }, (_, i) => F.neckBase[1] - 0.03 * F.S - i * ((F.neckBase[1] - hemHeight(F, pp.length) - 0.1 * F.S) / (pp.buttons - 1))), trims: uniformPockets }),
});
function uniformPockets(F, p, S) {
  return [{ type: 'epaulettes' }, { type: 'cuffButtons', count: 2, size: 0.006 },
    { type: 'pocket', kind: 'flap', w: 0.11, h: 0.12, at: { th: -0.5, y: F.chestY + 0.05 * S } }, { type: 'pocket', kind: 'flap', w: 0.11, h: 0.12, at: { th: 0.5, y: F.chestY + 0.05 * S } },
    { type: 'pocket', kind: 'flap', w: 0.15, h: 0.15, at: { th: -0.85, y: F.hipY + 0.06 * S } }, { type: 'pocket', kind: 'flap', w: 0.15, h: 0.15, at: { th: 0.85, y: F.hipY + 0.06 * S } }];
}

/* ============================ BOTTOMS ============================ */
G({
  id: 'bottom_jeans_01', slot: 'bottom', layer: 20, label: { en: 'Jeans', ar: 'بنطال جينز' },
  description: 'Five-pocket denim jeans with belt loops, button fly, rivets and contrast double stitching. Fit + leg opening give skinny, slim, straight, bootcut, loose or baggy.',
  tags: ['denim', 'casual', 'trousers'], fabric: 'denim', fabrics: ['denim', 'corduroy', 'cotton_canvas', 'chino_twill'], hardware: 'brass',
  params: { fit: FIT('slim'), rise: RISE(0.45), legLength: LEG_LEN(1), legOpening: LEG_OPEN(-0.2), cuff: CUFF('none', ['none', 'turnUp']), crotchDrop: CROTCH(0) },
  colors: COLORS('#34507A', { ...CK.stitch('#D39B3A'), ...CK.hardware('#B08D57'), ...CK.secondary('#2A4063') }),
  build: (p, ctx, a) => lower(p, ctx, a, { seams: 'double', trims: (F, pp, S) => [{ type: 'pocket', kind: 'jeansFront' }, { type: 'pocket', kind: 'jeansBack', w: 0.13, h: 0.15, at: { th: 2.7, y: riseHeight(F, pp.rise) - 0.085 * S } }, { type: 'pocket', kind: 'jeansBack', w: 0.13, h: 0.15, at: { th: -2.7, y: riseHeight(F, pp.rise) - 0.085 * S } }] }),
});
G({
  id: 'bottom_trousers_01', slot: 'bottom', layer: 20, label: { en: 'Trousers / chinos', ar: 'بنطال قماش / تشينو' },
  description: 'Woven trousers (chinos or dress trousers) with a waistband, belt loops, slanted front pockets, welt back pockets; skinny to wide via fit and leg opening.',
  tags: ['trousers', 'formal', 'smart casual', 'chinos'], fabric: 'chino_twill', fabrics: ['chino_twill', 'wool_suiting', 'linen', 'corduroy', 'cotton_canvas'], hardware: 'horn',
  params: { fit: FIT('regular'), rise: RISE(0.55), legLength: LEG_LEN(1.02), legOpening: LEG_OPEN(0), cuff: CUFF('none', ['none', 'turnUp']) },
  colors: COLORS('#B9A27C', { ...CK.hardware('#3B2F25'), ...CK.secondary('#8C7A5B'), ...CK.stitch('#A89272') }),
  build: (p, ctx, a) => lower(p, ctx, a, { trims: (F, pp, S) => [{ type: 'welt', w: 0.12, at: { th: 2.6, y: riseHeight(F, pp.rise) - 0.075 * S } }, { type: 'welt', w: 0.12, at: { th: -2.6, y: riseHeight(F, pp.rise) - 0.075 * S } }] }),
});
G({
  id: 'bottom_cargo_01', slot: 'bottom', layer: 20, label: { en: 'Cargo trousers', ar: 'بنطال كارغو' },
  description: 'Loose utility trousers with big bellows cargo pockets on the thighs and flap back pockets.',
  tags: ['utility', 'military', 'streetwear', 'pockets'], fabric: 'cotton_canvas', fabrics: ['cotton_canvas', 'chino_twill', 'nylon'], hardware: 'gunmetal',
  params: { fit: FIT('loose', ['regular', 'relaxed', 'loose', 'oversized']), rise: RISE(0.5), legLength: LEG_LEN(1), legOpening: LEG_OPEN(-0.2), cuff: CUFF('none', ['none', 'rib']) },
  colors: COLORS('#5A5E3D', { ...CK.hardware('#2E2E2E'), ...CK.secondary('#3E4229'), ...CK.accent('#7A6C4F') }),
  build: (p, ctx, a) => lower(p, ctx, a, { trims: (F, pp, S) => [{ type: 'pocket', kind: 'cargo', w: 0.15, h: 0.18, at: { area: 'legL', t: 0.38, th: Math.PI / 2 } }, { type: 'pocket', kind: 'cargo', w: 0.15, h: 0.18, at: { area: 'legR', t: 0.38, th: Math.PI / 2 } }, { type: 'pocket', kind: 'flap', w: 0.13, h: 0.14, at: { th: 2.65, y: riseHeight(F, pp.rise) - 0.09 * S } }, { type: 'pocket', kind: 'flap', w: 0.13, h: 0.14, at: { th: -2.65, y: riseHeight(F, pp.rise) - 0.09 * S } }] }),
});
G({
  id: 'bottom_shorts_01', slot: 'bottom', layer: 20, label: { en: 'Shorts', ar: 'شورت' },
  description: 'Casual woven shorts with waistband and belt loops; length from short to knee.',
  tags: ['summer', 'casual', 'shorts'], fabric: 'chino_twill', fabrics: ['chino_twill', 'denim', 'linen', 'cotton_canvas'], hardware: 'horn',
  params: { fit: FIT('regular', ['slim', 'regular', 'relaxed', 'loose']), rise: RISE(0.5), legLength: LEG_LEN(0.42, 0.3, 0.65), legOpening: LEG_OPEN(0.2), cuff: CUFF('none', ['none', 'turnUp']) },
  colors: COLORS('#C4B08A', { ...CK.hardware('#3B2F25'), ...CK.secondary('#5E7A99') }),
  build: (p, ctx, a) => lower(p, ctx, a, {}),
});
G({
  id: 'bottom_athletic_shorts_01', slot: 'bottom', layer: 20, label: { en: 'Athletic shorts', ar: 'شورت رياضي' },
  description: 'Lightweight sports shorts with an elastic drawstring waist.',
  tags: ['sport', 'gym', 'shorts'], fabric: 'polyester_sport', fabrics: ['polyester_sport', 'nylon', 'cotton_jersey'],
  params: { fit: FIT('relaxed', ['slim', 'regular', 'relaxed', 'loose']), legLength: LEG_LEN(0.4, 0.3, 0.6), legOpening: LEG_OPEN(0.4) },
  colors: COLORS('#1B1F2A', { ...CK.cord('#FFFFFF'), ...CK.secondary('#E14B3B') }),
  build: (p, ctx, a) => lower({ ...p, rise: 0.55 }, ctx, a, { elastic: true, waistW: 0.035 }),
});
G({
  id: 'bottom_sweatpants_01', slot: 'bottom', layer: 20, label: { en: 'Sweatpants / joggers', ar: 'بنطال رياضي' },
  description: 'Fleece sweatpants with an elastic drawstring waist; straight hem or ribbed jogger cuffs.',
  tags: ['sport', 'casual', 'fleece', 'joggers'], fabric: 'fleece', fabrics: ['fleece', 'cotton_jersey', 'polyester_sport'],
  params: { fit: FIT('relaxed', ['slim', 'regular', 'relaxed', 'loose', 'oversized']), legLength: LEG_LEN(1, 0.8, 1.04), cuff: CUFF('rib', ['none', 'rib']), legOpening: LEG_OPEN(-0.3) },
  colors: COLORS('#6B6F76', { ...CK.cord('#EDEDED'), ...CK.rib('#6B6F76') }),
  build: (p, ctx, a) => lower({ ...p, rise: 0.6 }, ctx, a, { elastic: true, waistW: 0.045 }),
});
G({
  id: 'bottom_leggings_01', slot: 'bottom', layer: 20, label: { en: 'Leggings', ar: 'ليغنز' },
  description: 'Skin-tight stretch leggings with an elastic waistband.',
  tags: ['sport', 'tight', 'stretch'], fabric: 'polyester_sport', fabrics: ['polyester_sport', 'cotton_jersey', 'rib_knit'],
  params: { rise: RISE(0.75), legLength: LEG_LEN(1, 0.45, 1) },
  colors: COLORS('#151515', { ...CK.secondary('#3A3A3A') }),
  build: (p, ctx, a) => lower({ ...p, fit: 'skinTight' }, ctx, a, { elastic: true, drawstrings: false, waistW: 0.05 }),
});
G({
  id: 'bottom_sirwal_01', slot: 'bottom', layer: 20, label: { en: 'Sirwal (traditional trousers)', ar: 'سروال' },
  description: 'Traditional loose sirwal / harem trousers with a gathered waist, dropped crotch and narrower ankles.',
  tags: ['traditional', 'arab', 'loose', 'harem'], fabric: 'cotton_poplin', fabrics: ['cotton_poplin', 'linen', 'cotton_canvas', 'crepe'],
  params: { fit: FIT('loose', ['relaxed', 'loose', 'oversized']), legLength: LEG_LEN(0.98, 0.7, 1.02), crotchDrop: CROTCH(0.7), legOpening: LEG_OPEN(-0.6), cuff: CUFF('none', ['none', 'rib']) },
  colors: COLORS('#EDE6D6', { ...CK.secondary('#B8A988'), ...CK.cord('#EDE6D6') }),
  build: (p, ctx, a) => lower({ ...p, rise: 0.75 }, ctx, a, { elastic: true, drawstrings: true, waistW: 0.04, detail: { gather: null } }),
});
G({
  id: 'bottom_skirt_01', slot: 'bottom', layer: 20, label: { en: 'Skirt', ar: 'تنورة' },
  description: 'Skirt with a waistband: pencil, A-line, circle, pleated or wrap; any length from mini to maxi.',
  tags: ['skirt', 'feminine'], fabric: 'wool_suiting', fabrics: ['wool_suiting', 'denim', 'crepe', 'silk', 'linen', 'leather', 'tweed', 'corduroy'],
  params: { style: enm(['pencil', 'aline', 'circle', 'pleated', 'wrap'], 'aline', 'Style', 'الطراز', 'skirt cut', { pencil: { en: 'Pencil', ar: 'قلم' }, aline: { en: 'A-line', ar: 'حرف A' }, circle: { en: 'Circle', ar: 'دائرية' }, pleated: { en: 'Pleated', ar: 'بكسرات' }, wrap: { en: 'Wrap', ar: 'ملفوفة' } }),
    length: LEN_LONG(1.8, 1, 3), rise: RISE(0.8), hemWidth: HEM_W(0), pleats: num(0, 1, 0.5, 'Pleat count', 'عدد الكسرات', 'fewer (0) to more (1) pleats (pleated style)') },
  colors: COLORS('#3E2A47', { ...CK.secondary('#C9B6D6'), ...CK.accent('#E4C04A'), ...CK.hardware('#2B2B2B') }),
  build: (p, ctx, a) => skirt(p, ctx, a),
});

/* ============================ FULL BODY ============================ */
G({
  id: 'full_dress_01', slot: 'fullBody', layer: 22, label: { en: 'Dress', ar: 'فستان' },
  description: 'One-piece dress: any sleeve length, neckline and length (mini to maxi), fitted to flared skirt.',
  tags: ['dress', 'feminine', 'formal', 'summer'], fabric: 'crepe', fabrics: ['crepe', 'silk', 'cotton_jersey', 'linen', 'velvet', 'chiffon', 'denim'],
  params: { fit: FIT('regular', ['skinTight', 'slim', 'regular', 'relaxed', 'loose']), length: LEN_LONG(2, 1, 3), sleeveLength: SLEEVE(0), sleeveWidth: SLEEVE_W(0), neckline: NECK('v', ['crew', 'v', 'scoop', 'boat', 'square']), necklineDepth: NECK_DEPTH(0.4), hemWidth: HEM_W(0.3), strapWidth: num(0, 1, 0.5, 'Strap width (sleeveless)', 'عرض الحمّالة', 'thin straps (0) to wide shoulders (1)') },
  colors: COLORS('#2A6A5A', { ...CK.secondary('#F2E6C9'), ...CK.accent('#B3473F') }),
  build: (p, ctx, a) => upper(p, ctx, a, { skirt: true, neckband: false, flareK: 0.25, flareFrom: ctx.F.waistY, strapX: 0.075 + 0.05 * (p.strapWidth ?? 0.5), armholeDepth: 0.02 }),
});
G({
  id: 'full_jumpsuit_01', slot: 'fullBody', layer: 27, tucksTops: true, label: { en: 'Jumpsuit', ar: 'جمبسوت' },
  description: 'One-piece jumpsuit with collar, front placket, sleeves and full-length legs.',
  tags: ['jumpsuit', 'one piece', 'utility'], fabric: 'chino_twill', fabrics: ['chino_twill', 'denim', 'crepe', 'linen', 'cotton_canvas'], hardware: 'horn',
  params: { fit: FIT('relaxed', ['slim', 'regular', 'relaxed', 'loose']), sleeveLength: SLEEVE(0.3), legLength: LEG_LEN(1), legOpening: LEG_OPEN(0), buttons: BUTTONS(5, 0, 7) },
  colors: COLORS('#6C7A55', { ...CK.hardware('#3B3B3B'), ...CK.secondary('#4D583D') }),
  build: (p, ctx, a) => upper({ ...p, length: 1, neckline: 'collar' }, ctx, a, { neck: 'collar', collar: 'shirt', noHem: true, placket: p.buttons ? { buttons: p.buttons, bottom: F => F.waistY - 0.02 * F.S } : null,
    bottom: (pp, c) => ({ rise: 0.95, t: pp.legLength, opening: pp.legOpening || 0, crotchDrop: 0.02 }) }),
});
G({
  id: 'full_coveralls_01', slot: 'fullBody', layer: 27, tucksTops: true, label: { en: 'Coveralls / boiler suit', ar: 'أفرول عمل' },
  description: 'Loose workwear coveralls with a stand collar, full front zip, chest pockets and long sleeves.',
  tags: ['workwear', 'uniform', 'utility', 'zip'], fabric: 'cotton_canvas', fabrics: ['cotton_canvas', 'chino_twill', 'denim', 'nylon'], hardware: 'silver',
  params: { fit: FIT('loose', ['regular', 'relaxed', 'loose', 'oversized']), sleeveLength: SLEEVE(1, 0.3, 1), legLength: LEG_LEN(1) },
  colors: COLORS('#24477A', { ...CK.hardware('#B5B5B5'), ...CK.trim('#24477A'), ...CK.stitch('#E2C044') }),
  build: (p, ctx, a) => upper({ ...p, length: 1, neckline: 'collar' }, ctx, a, { neck: 'collar', collar: 'shirt', noHem: true, zip: true, closure: 'closed', zipTop: 0.0, cuff: 'none', seams: 'double',
    trims: (F, pp, S) => [{ type: 'pocket', kind: 'flap', w: 0.12, h: 0.13, at: { th: -0.5, y: F.chestY + 0.05 * S } }, { type: 'pocket', kind: 'flap', w: 0.12, h: 0.13, at: { th: 0.5, y: F.chestY + 0.05 * S } }],
    bottom: (pp) => ({ rise: 1, t: pp.legLength, opening: 0, crotchDrop: 0.03 }) }),
});
G({
  id: 'full_overalls_01', slot: 'fullBody', layer: 27, tucksTops: true, label: { en: 'Overalls (dungarees)', ar: 'سالوبيت' },
  description: 'Denim dungarees: bib front with a chest pocket, shoulder straps with metal buckles, full trousers.',
  tags: ['denim', 'workwear', 'casual'], fabric: 'denim', fabrics: ['denim', 'cotton_canvas', 'corduroy'], hardware: 'brass',
  params: { fit: FIT('relaxed', ['regular', 'relaxed', 'loose']), legLength: LEG_LEN(1), legOpening: LEG_OPEN(0), cuff: CUFF('none', ['none', 'turnUp']) },
  colors: COLORS('#3F5F8C', { ...CK.stitch('#D39B3A'), ...CK.hardware('#B08D57') }),
  build: (p, ctx, a) => {
    const sp = lower({ ...p, rise: 1 }, ctx, a, { seams: 'double', beltLoops: false, fly: false });
    // bib front + low back panel instead of a waistband; straps over the shoulders with buckles; bib pocket
    sp.bib = { w: 0.12, front: 0.045, back: 0.07 };
    sp.trims = sp.trims.filter(t => t.type !== 'waistband');
    sp.trims.push({ type: 'overallStraps' }, { type: 'pocket', kind: 'patch', w: 0.13, h: 0.11, at: { th: 0, y: ctx.F.chestY - 0.02 * ctx.F.S } });
    delete sp.bands.waist;
    sp.stitch.edges = { bib: [0.006], legHem: sp.stitch.edges.legHem };
    return sp;
  },
});
G({
  id: 'full_robe_01', slot: 'fullBody', layer: 50, label: { en: 'Robe / kimono', ar: 'روب / كيمونو' },
  description: 'Long wrap robe with wide sleeves and an open V front (bathrobe, kimono, house robe, academic gown).',
  tags: ['robe', 'kimono', 'loose', 'long'], fabric: 'cotton_jersey', fabrics: ['fleece', 'silk', 'cotton_jersey', 'linen', 'velvet'],
  params: { fit: FIT('loose', ['relaxed', 'loose', 'oversized']), length: LEN_LONG(2.3, 1.2, 3), sleeveLength: SLEEVE(0.8, 0.5, 1), sleeveWidth: SLEEVE_W(0.7), closure: CLOSURE('closed', ['closed', 'open']), thickness: THICK(1) },
  colors: COLORS('#7F1D2D', { ...CK.trim('#7F1D2D'), ...CK.secondary('#E8D8B0') }),
  build: (p, ctx, a) => upper(p, ctx, a, { skirt: true, neckband: false, openFront: true, vBreak: F => F.waistY + 0.02 * F.S, flareK: 0.12, flareFrom: ctx.F.hipY, layerEase: 0.006, hang: 1.4 }),
});
G({
  id: 'full_thobe_01', slot: 'fullBody', layer: 22, label: { en: 'Thobe / kandura', ar: 'ثوب / كندورة' },
  description: 'Traditional ankle-length thobe (dishdasha, kandura) with long sleeves, a collar or collarless neck, short button placket and side pocket slits.',
  tags: ['traditional', 'arab', 'gulf', 'long'], fabric: 'cotton_poplin', fabrics: ['cotton_poplin', 'linen', 'wool_suiting', 'crepe'], hardware: 'plastic',
  params: { fit: FIT('relaxed', ['regular', 'relaxed', 'loose']), length: LEN_LONG(2.95, 2.5, 3), collar: COLLAR('mandarin', ['mandarin', 'shirt', 'none']), buttons: BUTTONS(3, 0, 5), sleeveLength: SLEEVE(1, 0.8, 1), cuffs: CUFF('none', ['none', 'band']) },
  colors: COLORS('#F7F7F4', { ...CK.hardware('#F7F7F4'), ...CK.stitch('#E9E9E4'), ...CK.secondary('#D9D4C7') }),
  build: (p, ctx, a) => upper({ ...p, neckline: p.collar === 'none' ? 'crew' : 'collar' }, ctx, a, { neck: p.collar === 'none' ? 'crew' : 'collar', skirt: true, flareK: 0.08, flareFrom: ctx.F.hipY, flare: 0.05, cuff: p.cuffs === 'band' ? 'band' : 'none', neckband: false, hang: 1.4,
    placket: p.buttons ? { buttons: p.buttons, bottom: F => F.chestY + 0.02 * F.S, width: 0.026 } : null,
    trims: (F, pp, S) => [{ type: 'welt', w: 0.16, h: 0.006, at: { th: -1.45, y: F.hipY - 0.0 * S } }, { type: 'welt', w: 0.16, h: 0.006, at: { th: 1.45, y: F.hipY } }] }),
});
G({
  id: 'full_abaya_01', slot: 'fullBody', layer: 50, label: { en: 'Abaya', ar: 'عباءة' },
  description: 'Long flowing abaya with wide sleeves, worn closed or open over clothes.',
  tags: ['traditional', 'arab', 'modest', 'long'], fabric: 'crepe', fabrics: ['crepe', 'chiffon', 'silk', 'linen'],
  params: { fit: FIT('loose', ['relaxed', 'loose', 'oversized']), length: LEN_LONG(3, 2.6, 3), sleeveWidth: SLEEVE_W(0.6), closure: CLOSURE('closed', ['closed', 'open']), trimColor: bool(false, 'Contrast trim', 'حواف بلون مختلف', 'decorative trim colour on the edges') },
  colors: COLORS('#121212', { ...CK.trim('#6E5A2F'), ...CK.secondary('#2A2A2A') }),
  build: (p, ctx, a) => upper({ ...p, sleeveLength: 1, neckline: 'crew' }, ctx, a, { skirt: true, neckband: false, openFront: p.closure === 'open', flareK: 0.14, flare: 0.08, flareFrom: ctx.F.waistY, layerEase: 0.008, hang: 1.5, sleeveL: 0.9 }),
});

export const GARMENT_LAYER_TUCKED = 15;
