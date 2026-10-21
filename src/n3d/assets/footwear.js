/* =====================================================================
 * NORMAL 3D — FOOTWEAR LIBRARY
 * Shoes are built around the character's feet (garments/footwear.js);
 * each asset exposes only the controls that make sense for it.
 * ===================================================================== */
import { registerAsset, num, enm, bool } from '../core/registry.js';
import { buildShoes } from '../garments/footwear.js';

const C = (en, ar, def) => ({ label: { en, ar }, default: def });
const TOE = (def = 0) => num(-1, 1, def, 'Toe shape', 'شكل المقدمة', 'round (−1) … almond (0) … pointed (+1)');
const SOLE = (def, min, max) => num(min, max, def, 'Sole thickness', 'سماكة النعل', 'sole height in centimetres', 0.1);
const SHAFT = (def, min, max) => num(min, max, def, 'Shaft height', 'ارتفاع الساق', 'how high the boot goes (cm above the ground)', 0.5);
const F = (def) => registerAsset({ slot: 'footwear', category: 'footwear', layer: 5, tags: [], ...def, buildFootwear: (p, ctx) => buildShoes(def.shoe(p, ctx), ctx) });

F({
  id: 'shoes_sneakers_01', label: { en: 'Sneakers', ar: 'حذاء رياضي (سنيكرز)' },
  description: 'Low-top sneakers with a padded collar, tongue, laces and eyelets, rubber midsole, toe cap and side panel.',
  tags: ['casual', 'sport', 'laces'], fabric: 'leather', fabrics: ['leather', 'suede', 'cotton_canvas', 'polyester_sport'],
  params: { toe: TOE(-0.4), sole: SOLE(3, 1.5, 5), laceRows: num(4, 8, 6, 'Lace rows', 'صفوف الأربطة', 'number of eyelet pairs', 1), highTop: bool(false, 'High-top', 'رقبة عالية', 'collar above the ankle') },
  colors: { main: C('Upper', 'الجزء العلوي', '#F4F4F2'), accent: C('Side panel', 'اللوحة الجانبية', '#1E3A8A'), trim: C('Toe cap / heel', 'المقدمة والكعب', '#E8E8E4'), midsole: C('Midsole', 'النعل الأوسط', '#FFFFFF'), outsole: C('Outsole', 'النعل الخارجي', '#2A2A2A'), laces: C('Laces', 'الأربطة', '#FFFFFF'), lining: C('Lining', 'البطانة', '#D9D9D9'), hardware: C('Eyelets', 'الحلقات', '#CFCFCF') },
  shoe: p => ({ soleH: p.sole / 100, soleTop: 0.014, toe: p.toe, collar: p.highTop ? { back: 0.12, front: 0.11, sides: 0.11 } : { back: 0.075, front: 0.065, sides: 0.058 }, collarPad: true, laces: { rows: p.laceRows }, toeCap: true, heelCounter: true, sidePanel: true, lastVolume: 1.05, ease: 0.005 }),
});
F({
  id: 'shoes_running_01', label: { en: 'Running shoes', ar: 'حذاء جري' },
  description: 'Lightweight running shoes with a thick cushioned midsole, mesh upper and padded heel.',
  tags: ['sport', 'running', 'laces'], fabric: 'polyester_sport', fabrics: ['polyester_sport', 'nylon'],
  params: { toe: TOE(-0.2), sole: SOLE(3.8, 2.5, 6) },
  colors: { main: C('Upper', 'الجزء العلوي', '#3A3F4B'), accent: C('Side panel', 'اللوحة الجانبية', '#FF5A36'), trim: C('Toe / heel', 'المقدمة والكعب', '#2C303A'), midsole: C('Midsole', 'النعل الأوسط', '#F2F2F2'), outsole: C('Outsole', 'النعل الخارجي', '#FF5A36'), laces: C('Laces', 'الأربطة', '#F2F2F2'), lining: C('Lining', 'البطانة', '#222222'), hardware: C('Eyelets', 'الحلقات', '#2C303A') },
  shoe: p => ({ soleH: p.sole / 100, soleTop: 0.016, toe: p.toe, collar: { back: 0.078, front: 0.066, sides: 0.056 }, collarPad: true, laces: { rows: 6 }, heelCounter: true, sidePanel: true, outsole: 0.25, ease: 0.005 }),
});
F({
  id: 'shoes_boots_01', label: { en: 'Boots', ar: 'جزمة (بوت)' },
  description: 'Boots: ankle boots, lace-up combat / work boots, Chelsea boots with elastic gussets, or knee-high boots; thick sole with a heel block.',
  tags: ['boots', 'winter', 'leather'], fabric: 'leather', fabrics: ['leather', 'suede', 'cotton_canvas'], hardware: 'gunmetal',
  params: { style: enm(['ankle', 'combat', 'chelsea', 'knee'], 'combat', 'Style', 'الطراز', 'boot style', { ankle: { en: 'Ankle boot', ar: 'بوت قصير' }, combat: { en: 'Combat / work (laced)', ar: 'بوت عسكري برباط' }, chelsea: { en: 'Chelsea (elastic sides)', ar: 'تشيلسي (جوانب مطاطية)' }, knee: { en: 'Knee-high', ar: 'بوت طويل للركبة' } }),
    shaft: SHAFT(18, 10, 45), toe: TOE(-0.3), sole: SOLE(3.2, 2, 5) },
  colors: { main: C('Leather', 'الجلد', '#3B2A1E'), trim: C('Toe / heel', 'المقدمة والكعب', '#33251A'), elastic: C('Elastic gussets', 'الجوانب المطاطية', '#1E1E1E'), midsole: C('Welt / sole edge', 'حافة النعل', '#2A1E15'), outsole: C('Outsole', 'النعل الخارجي', '#151515'), laces: C('Laces', 'الأربطة', '#5A4632'), lining: C('Lining', 'البطانة', '#7A6450'), hardware: C('Hooks / eyelets', 'الحلقات', '#4A4A4A') },
  shoe: p => {
    const sh = p.style === 'knee' ? Math.max(p.shaft, 38) : p.style === 'ankle' || p.style === 'chelsea' ? Math.min(p.shaft, 16) : p.shaft;
    return { soleH: p.sole / 100, soleTop: 0.012, toe: p.toe, shaft: sh / 100, laces: p.style === 'combat' ? { rows: Math.round(5 + sh / 4), bow: true } : null, opening: p.style !== 'combat', slit: p.style === 'combat' ? 0.016 : 0.001, throat: 0.6, gusset: p.style === 'chelsea', heelCounter: true, toeCap: p.style === 'combat', archGap: 0.006, ease: 0.006, thickness: 0.003 };
  },
});
F({
  id: 'shoes_dress_01', label: { en: 'Dress shoes', ar: 'حذاء رسمي' },
  description: 'Formal leather shoes: Oxford (closed lacing, toe cap), Derby or penny loafer; slim sole with a stacked heel.',
  tags: ['formal', 'leather', 'suit'], fabric: 'leather', fabrics: ['leather', 'suede'], hardware: 'silver',
  params: { style: enm(['oxford', 'derby', 'loafer'], 'oxford', 'Style', 'الطراز', 'shoe style', { oxford: { en: 'Oxford', ar: 'أكسفورد' }, derby: { en: 'Derby', ar: 'ديربي' }, loafer: { en: 'Penny loafer', ar: 'لوفر' } }), toe: TOE(0.2) },
  colors: { main: C('Leather', 'الجلد', '#1A1412'), trim: C('Toe cap / strap', 'المقدمة', '#1A1412'), midsole: C('Sole edge', 'حافة النعل', '#1A1412'), outsole: C('Sole', 'النعل', '#3A2A20'), laces: C('Laces', 'الأربطة', '#111111'), lining: C('Lining', 'البطانة', '#8A6A4A'), hardware: C('Eyelets', 'الحلقات', '#1A1412') },
  shoe: p => ({ soleH: 0.022, soleTop: 0.006, welt: 0.004, toe: p.toe, collar: { back: 0.07, front: p.style === 'loafer' ? 0.07 : 0.06, sides: 0.05 }, laces: p.style === 'loafer' ? null : { rows: 5, radius: 0.0012 }, slit: p.style === 'oxford' ? 0.006 : 0.012, opening: p.style === 'loafer', throat: p.style === 'loafer' ? 0.5 : 0.6, toeCap: p.style === 'oxford', pennyStrap: p.style === 'loafer', archGap: 0.008, outsole: 0.6, lastVolume: 0.92, ease: 0.003 }),
});
F({
  id: 'shoes_sandals_01', label: { en: 'Sandals', ar: 'صندل' },
  description: 'Open sandals with a footbed sole and straps across the foot; or slides with one wide strap.',
  tags: ['summer', 'open', 'straps'], fabric: 'leather', fabrics: ['leather', 'nylon', 'suede'],
  params: { style: enm(['strappy', 'slide', 'arabic'], 'strappy', 'Style', 'الطراز', 'sandal style', { strappy: { en: 'Strappy sandal', ar: 'صندل بأحزمة' }, slide: { en: 'Slide', ar: 'شبشب مفتوح' }, arabic: { en: 'Arabic sandal (na‘al)', ar: 'نعال عربي' } }), sole: SOLE(1.8, 1, 4) },
  colors: { main: C('Straps', 'الأحزمة', '#6B4A2E'), midsole: C('Footbed', 'الفرشة', '#8A6A4A'), outsole: C('Sole', 'النعل', '#2A2A2A') },
  shoe: p => ({ sandal: true, soleH: p.sole / 100, soleTop: 0.006, toe: -0.5, welt: 0.004,
    straps: p.style === 'slide' ? [{ u0: 0.55, u1: 0.68, w: 0.05 }] : p.style === 'arabic' ? [{ u0: 0.62, u1: 0.62, w: 0.03 }, { u0: 0.5, u1: 0.72, w: 0.012 }] : [{ u0: 0.7, u1: 0.74, w: 0.016 }, { u0: 0.45, u1: 0.5, w: 0.018 }, { u0: 0.15, u1: 0.15, w: 0.014 }] }),
});
F({
  id: 'shoes_slippers_01', label: { en: 'Slippers', ar: 'خف منزلي' },
  description: 'Soft closed house slippers with a padded collar.',
  tags: ['home', 'soft'], fabric: 'fleece', fabrics: ['fleece', 'suede', 'velvet'],
  params: { toe: TOE(-0.8), openBack: bool(false, 'Open back', 'مفتوح من الخلف', 'backless slipper (mule)') },
  colors: { main: C('Upper', 'الجزء العلوي', '#6E7B8B'), midsole: C('Sole', 'النعل', '#E9E4DA'), outsole: C('Outsole', 'النعل الخارجي', '#5A5A5A'), lining: C('Lining', 'البطانة', '#E9E4DA') },
  shoe: p => ({ soleH: 0.016, soleTop: 0.01, toe: p.toe, collar: p.openBack ? { back: 0.01, front: 0.06, sides: 0.03 } : { back: 0.06, front: 0.055, sides: 0.045 }, collarPad: true, lastVolume: 1.15, ease: 0.007, thickness: 0.004 }),
});
