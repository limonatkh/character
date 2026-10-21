/* =====================================================================
 * NORMAL 3D — ACCESSORIES LIBRARY
 * Headwear, neckwear (scarves, shawls, keffiyeh, ties), glasses, gloves,
 * jewellery, watches, bags and belts. Each exposes only its own controls.
 * build(params, ctx) → { meshes: [{ name, geometry, material | groups, follow, skinned }], hides?, bone? }
 * ===================================================================== */
import { registerAsset, num, enm, bool } from '../core/registry.js';
import { buildHeadwear } from '../accessories/headwear.js';
import { buildGlasses, buildEarrings, buildNecklace, buildRing, buildBracelet, buildWatch, buildGloves, buildBelt, buildBag, buildTie } from '../accessories/items.js';
import { buildScarf, buildShawl, buildKeffiyeh } from '../accessories/drapes.js';

const C = (en, ar, def) => ({ label: { en, ar }, default: def });
const A = def => registerAsset({ category: 'accessory', tags: [], ...def });
const SIZE = (def = 1, min = 0.8, max = 1.25) => num(min, max, def, 'Size', 'الحجم', 'overall size');

/* ---------------------------------------------------------------- headwear */
A({ id: 'hat_cap_01', slot: 'headwear', attach: 'head_top', label: { en: 'Baseball cap', ar: 'قبعة كاب' },
  description: 'Six-panel baseball cap with a curved visor, top button and eyelets; sits on the hair (hair under the crown is hidden).',
  fabric: 'cotton_canvas', fabrics: ['cotton_canvas', 'denim', 'wool_suiting', 'polyester_sport', 'corduroy'],
  params: { visorCurve: num(0, 1, 0.45, 'Visor curve', 'انحناء الحافة', 'flat (0) to strongly curved (1) visor'), visorLength: num(0.7, 1.3, 1, 'Visor length', 'طول الحافة', 'visor length'), backwards: bool(false, 'Worn backwards', 'معكوسة', 'visor at the back') },
  colors: { main: C('Crown', 'التاج', '#1F2A44'), accent: C('Visor underside', 'أسفل الحافة', '#1F2A44') },
  build: (p, ctx) => buildHeadwear({ type: 'cap', visorCurve: p.visorCurve, brim: 0.072 * p.visorLength, backwards: p.backwards }, ctx) });
A({ id: 'hat_beanie_01', slot: 'headwear', attach: 'head_top', label: { en: 'Beanie', ar: 'طاقية صوف (بيني)' },
  description: 'Knitted beanie with a folded rib cuff; optional slouch and pom-pom.',
  fabric: 'knit_wool', fabrics: ['knit_wool', 'rib_knit', 'cable_knit', 'fleece'],
  params: { slouch: num(0, 1, 0.25, 'Slouch', 'الارتخاء', 'fitted (0) to slouchy (1)'), cuff: bool(true, 'Folded cuff', 'حافة مطوية', 'turned-up rib band'), pompom: bool(false, 'Pom-pom', 'كرة صوف', 'pom-pom on top') },
  colors: { main: C('Knit', 'الصوف', '#A23B2C'), rib: C('Cuff', 'الحافة', '#A23B2C') },
  build: (p, ctx) => buildHeadwear({ type: 'beanie', slouch: p.slouch, cuff: p.cuff, pompom: p.pompom, ease: 0.003 }, ctx) });
A({ id: 'hat_fedora_01', slot: 'headwear', attach: 'head_top', label: { en: 'Fedora', ar: 'قبعة فيدورا' },
  description: 'Felt fedora with a pinched, dented crown, ribbon band and medium brim.',
  fabric: 'wool_coating', fabrics: ['wool_coating', 'tweed', 'suede', 'linen'],
  params: { brim: num(0.04, 0.08, 0.058, 'Brim width', 'عرض الحافة', 'brim width (m)', 0.002), crownHeight: num(0.08, 0.13, 0.11, 'Crown height', 'ارتفاع التاج', 'crown height (m)', 0.002) },
  colors: { main: C('Felt', 'اللباد', '#5A4A3A'), trim: C('Ribbon', 'الشريط', '#1F1A16') },
  build: (p, ctx) => buildHeadwear({ type: 'fedora', brim: p.brim, crownHeight: p.crownHeight }, ctx) });
A({ id: 'hat_bucket_01', slot: 'headwear', attach: 'head_top', label: { en: 'Bucket hat', ar: 'قبعة باكيت' },
  description: 'Soft bucket hat with a downward-sloping brim.',
  fabric: 'cotton_canvas', fabrics: ['cotton_canvas', 'denim', 'nylon', 'corduroy', 'fleece'],
  params: { brim: num(0.035, 0.075, 0.055, 'Brim width', 'عرض الحافة', 'brim width (m)', 0.002) },
  colors: { main: C('Fabric', 'القماش', '#C8B58A'), trim: C('Band', 'الشريط', '#C8B58A') },
  build: (p, ctx) => buildHeadwear({ type: 'bucket', brim: p.brim }, ctx) });
A({ id: 'hat_kufi_01', slot: 'headwear', attach: 'head_top', label: { en: 'Kufi / taqiyah', ar: 'طاقية / كوفية' },
  description: 'Close-fitting rounded skullcap (kufi, taqiyah, kippah-style) covering the top of the head.',
  fabric: 'embroidered', fabrics: ['embroidered', 'cotton_jersey', 'knit_wool', 'velvet'],
  params: { depth: num(0, 1, 0.5, 'Depth', 'العمق', 'small cap on the crown (0) to deep cap (1)') },
  colors: { main: C('Cap', 'الطاقية', '#F4F1EA'), secondary: C('Embroidery', 'التطريز', '#D8D2C4') },
  build: (p, ctx) => buildHeadwear({ type: 'kufi', levels: { front: 0.075 - 0.03 * p.depth, side: 0.05 - 0.035 * p.depth, back: 0.09 - 0.04 * p.depth }, ease: 0.002 }, ctx) });
A({ id: 'hat_beret_01', slot: 'headwear', attach: 'head_top', label: { en: 'Beret', ar: 'بيريه' },
  description: 'Soft round felt beret, tilted to one side.',
  fabric: 'wool_coating', fabrics: ['wool_coating', 'knit_wool', 'velvet'],
  params: { tilt: num(-1, 1, 0.5, 'Tilt', 'الميل', 'tilted to the character’s left (−) or right (+)'), size: SIZE(1) },
  colors: { main: C('Felt', 'اللباد', '#8B1E2D') },
  build: (p, ctx) => buildHeadwear({ type: 'beret', tilt: p.tilt, size: p.size }, ctx) });
A({ id: 'head_hijab_01', slot: 'headwear', attach: 'head_top', label: { en: 'Hijab', ar: 'حجاب' },
  description: 'Head scarf covering the hair, ears and neck with an open face, falling over the shoulders and chest.',
  fabric: 'crepe', fabrics: ['crepe', 'chiffon', 'silk', 'cotton_jersey'],
  params: { length: num(0, 0.2, 0.06, 'Length on the chest', 'الطول على الصدر', 'how far it falls over the chest (m)', 0.005) },
  colors: { main: C('Fabric', 'القماش', '#3A4A5C'), secondary: C('Pattern', 'النقشة', '#D9CBB5') },
  build: (p, ctx) => buildHeadwear({ type: 'hijab', length: p.length }, ctx) });
A({ id: 'head_hood_up_01', slot: 'headwear', attach: 'head_top', label: { en: 'Hood (worn up)', ar: 'قبعة مرفوعة (هود)' },
  description: 'A hood worn up over the head, open at the face (pair it with a hoodie or parka).',
  fabric: 'fleece', fabrics: ['fleece', 'cotton_jersey', 'nylon', 'wool_coating'],
  params: {},
  colors: { main: C('Fabric', 'القماش', '#3B3F46'), rib: C('Edge', 'الحافة', '#3B3F46') },
  build: (p, ctx) => buildHeadwear({ type: 'hoodUp' }, ctx) });
A({ id: 'head_keffiyeh_01', slot: 'headwear', attach: 'head_top', label: { en: 'Keffiyeh / ghutra', ar: 'شماغ / غترة' },
  description: 'Square head cloth folded into a triangle and draped over the head and shoulders, optionally held by a black agal. Use the shemagh pattern for a red-and-white or black-and-white keffiyeh, solid white for a ghutra.',
  fabric: 'cotton_poplin', fabrics: ['cotton_poplin', 'linen', 'cotton_jersey'],
  params: { agal: bool(true, 'Agal (black cord)', 'عقال', 'black double cord ring on top'), size: SIZE(1, 0.85, 1.2) },
  colors: { main: C('Cloth', 'القماش', '#F7F7F4'), secondary: C('Pattern', 'النقشة', '#B3262B'), accent: C('Agal', 'العقال', '#141414') },
  build: (p, ctx) => buildKeffiyeh({ agal: p.agal, size: p.size }, ctx) });

/* ---------------------------------------------------------------- neckwear */
A({ id: 'neck_scarf_01', slot: 'neckwear', attach: 'neck', label: { en: 'Scarf', ar: 'وشاح (سكارف)' },
  description: 'Knitted or woven scarf wrapped once around the neck with the ends hanging in front (or one end thrown over the shoulder).',
  fabric: 'knit_wool', fabrics: ['knit_wool', 'cable_knit', 'wool_coating', 'silk', 'cotton_jersey', 'linen'],
  params: { length: num(1, 2, 1.6, 'Length', 'الطول', 'scarf length (m)', 0.05), width: num(0.12, 0.4, 0.24, 'Width', 'العرض', 'scarf width (m)', 0.01), wrap: enm(['front', 'oneBack'], 'front', 'Wrap', 'طريقة اللف', 'how the ends hang', { front: { en: 'Both ends in front', ar: 'الطرفان للأمام' }, oneBack: { en: 'One end over the shoulder', ar: 'طرف على الكتف' } }) },
  colors: { main: C('Main', 'الأساسي', '#B5462F'), secondary: C('Pattern', 'النقشة', '#E8D9B5'), accent: C('Accent', 'لون إضافي', '#2C3E50') },
  build: (p, ctx) => buildScarf(p, ctx) });
A({ id: 'neck_shawl_01', slot: 'neckwear', attach: 'neck', label: { en: 'Shawl', ar: 'شال' },
  description: 'Large shawl wrapped over the shoulders and back, ends falling in front.',
  fabric: 'knit_wool', fabrics: ['knit_wool', 'silk', 'chiffon', 'linen', 'cotton_jersey'],
  params: { length: num(1.1, 2, 1.5, 'Length', 'الطول', 'shawl length (m)', 0.05), width: num(0.35, 0.8, 0.6, 'Width', 'العرض', 'shawl width (m)', 0.01) },
  colors: { main: C('Main', 'الأساسي', '#6D5A7A'), secondary: C('Pattern', 'النقشة', '#E7D8C9'), accent: C('Accent', 'لون إضافي', '#B9965B') },
  build: (p, ctx) => buildShawl(p, ctx) });
A({ id: 'neck_tie_01', slot: 'neckwear', attach: 'neck', label: { en: 'Tie / bow tie', ar: 'ربطة عنق / ببيون' },
  description: 'Necktie with a knot under the collar and the blade lying on the shirt, or a bow tie. Wear with a collared shirt.',
  fabric: 'silk', fabrics: ['silk', 'knit_wool', 'wool_suiting', 'linen'],
  params: { style: enm(['tie', 'bow'], 'tie', 'Style', 'الطراز', 'necktie or bow tie', { tie: { en: 'Necktie', ar: 'ربطة عنق' }, bow: { en: 'Bow tie', ar: 'ببيون' } }), width: num(0.7, 1.2, 1, 'Blade width', 'العرض', 'skinny (0.7) to wide (1.2)'), length: num(0.85, 1.1, 1, 'Length', 'الطول', 'how low the tie ends') },
  colors: { main: C('Tie', 'الربطة', '#7A1F2B'), secondary: C('Pattern', 'النقشة', '#1F2A44'), accent: C('Accent', 'لون إضافي', '#C9A54A') },
  build: (p, ctx) => buildTie(p, ctx) });

/* ---------------------------------------------------------------- eyewear */
A({ id: 'glasses_01', slot: 'eyewear', attach: 'eyes', label: { en: 'Glasses / sunglasses', ar: 'نظارة / نظارة شمسية' },
  description: 'Eyeglasses or sunglasses: rectangular, round, thick acetate, cat-eye or aviator frames with clear or tinted lenses.',
  fabric: 'leather', fabrics: [],
  params: { style: enm(['rectangle', 'round', 'acetate', 'cateye', 'aviator'], 'rectangle', 'Frame style', 'شكل الإطار', 'frame shape', { rectangle: { en: 'Rectangular metal', ar: 'معدني مستطيل' }, round: { en: 'Round metal', ar: 'معدني دائري' }, acetate: { en: 'Thick frame', ar: 'إطار سميك' }, cateye: { en: 'Cat-eye', ar: 'عين القطة' }, aviator: { en: 'Aviator', ar: 'طيار' } }), size: SIZE(1, 0.85, 1.2), tint: num(0, 1, 0, 'Lens tint', 'تعتيم العدسة', 'clear (0) to dark sunglasses (1)') },
  colors: { main: C('Frame', 'الإطار', '#1E1E1E'), lens: C('Lens tint', 'لون العدسة', '#30343A') }, materialKind: 'plastic',
  build: (p, ctx) => buildGlasses(p, ctx) });

/* ---------------------------------------------------------------- jewellery and watches */
A({ id: 'jewel_earrings_01', slot: 'jewelry', attach: 'ear_left', label: { en: 'Earrings', ar: 'أقراط' },
  description: 'A pair of earrings: studs, hoops or drops.',
  fabric: 'leather', fabrics: [],
  params: { style: enm(['stud', 'hoop', 'drop'], 'stud', 'Style', 'الطراز', 'earring style', { stud: { en: 'Stud', ar: 'حبة' }, hoop: { en: 'Hoop', ar: 'حلقة' }, drop: { en: 'Drop', ar: 'متدلي' } }), size: SIZE(1, 0.6, 2) },
  colors: { main: C('Metal / stone', 'المعدن', '#D4AF37') }, hardware: 'gold', materialKind: 'metal',
  build: (p, ctx) => buildEarrings(p, ctx) });
A({ id: 'jewel_necklace_01', slot: 'jewelry', attach: 'neck', label: { en: 'Necklace', ar: 'قلادة' },
  description: 'Chain or bead necklace resting on the clothes, with an optional pendant.',
  fabric: 'leather', fabrics: [],
  params: { style: enm(['chain', 'beads'], 'chain', 'Style', 'الطراز', 'necklace type', { chain: { en: 'Chain', ar: 'سلسلة' }, beads: { en: 'Beads', ar: 'خرز' } }), length: num(0, 1, 0.45, 'Length', 'الطول', 'choker (0) to long (1)'), pendant: bool(true, 'Pendant', 'دلاية', 'pendant at the front'), pendantShape: enm(['round', 'disc'], 'round', 'Pendant shape', 'شكل الدلاية', 'pendant shape', { round: { en: 'Round stone', ar: 'حجر دائري' }, disc: { en: 'Disc', ar: 'قرص' } }) },
  colors: { main: C('Chain / beads', 'السلسلة', '#D4AF37'), accent: C('Pendant', 'الدلاية', '#2E86AB') }, hardware: 'gold', materialKind: 'metal',
  build: (p, ctx) => buildNecklace(p, ctx) });
A({ id: 'jewel_ring_01', slot: 'jewelry', attach: 'finger_left', label: { en: 'Ring', ar: 'خاتم' },
  description: 'Ring on a finger, plain band or with a stone.',
  fabric: 'leather', fabrics: [],
  params: { hand: enm(['left', 'right'], 'left', 'Hand', 'اليد', 'which hand'), finger: enm(['Ring', 'Index', 'Middle', 'Little'], 'Ring', 'Finger', 'الإصبع', 'which finger', { Ring: { en: 'Ring finger', ar: 'البنصر' }, Index: { en: 'Index', ar: 'السبابة' }, Middle: { en: 'Middle', ar: 'الوسطى' }, Little: { en: 'Little finger', ar: 'الخنصر' } }), gem: bool(false, 'Stone', 'فص', 'stone on top') },
  colors: { main: C('Metal', 'المعدن', '#C0C0C0') }, hardware: 'silver', materialKind: 'metal',
  build: (p, ctx) => buildRing(p, ctx) });
A({ id: 'jewel_bracelet_01', slot: 'jewelry', attach: 'wrist_left', label: { en: 'Bracelet', ar: 'سوار' },
  description: 'Bracelet on a wrist: chain, bead or cuff.',
  fabric: 'leather', fabrics: [],
  params: { side: enm(['left', 'right'], 'right', 'Wrist', 'المعصم', 'which wrist'), style: enm(['chain', 'beads', 'cuff'], 'chain', 'Style', 'الطراز', 'bracelet type', { chain: { en: 'Chain', ar: 'سلسلة' }, beads: { en: 'Beads', ar: 'خرز' }, cuff: { en: 'Cuff', ar: 'إسوارة عريضة' } }) },
  colors: { main: C('Material', 'المادة', '#C9A54A') }, hardware: 'gold', materialKind: 'metal',
  build: (p, ctx) => buildBracelet(p, ctx) });
A({ id: 'watch_01', slot: 'jewelry', attach: 'wrist_left', label: { en: 'Wrist watch', ar: 'ساعة يد' },
  description: 'Analogue wrist watch with a round or square case, dial, hands and strap.',
  fabric: 'leather', fabrics: [],
  params: { side: enm(['left', 'right'], 'left', 'Wrist', 'المعصم', 'which wrist'), shape: enm(['round', 'square'], 'round', 'Case', 'شكل العلبة', 'case shape', { round: { en: 'Round', ar: 'دائرية' }, square: { en: 'Square', ar: 'مربعة' } }), size: SIZE(1, 0.8, 1.3) },
  colors: { main: C('Case', 'العلبة', '#C0C0C0'), accent: C('Dial', 'المينا', '#F4F1EA'), strap: C('Strap', 'السوار', '#4A3020'), lens: C('Crystal', 'الزجاج', '#DDEEFF') }, hardware: 'silver', materialKind: 'metal',
  build: (p, ctx) => buildWatch(p, ctx) });

/* ---------------------------------------------------------------- hands, waist, bags */
A({ id: 'gloves_01', slot: 'handwear', attach: 'hand_left', label: { en: 'Gloves', ar: 'قفازات' },
  description: 'A pair of gloves that follow the hands and fingers: leather or knitted with a rib cuff.',
  fabric: 'leather', fabrics: ['leather', 'knit_wool', 'suede', 'polyester_sport'],
  params: { cuff: num(0, 1, 0.25, 'Cuff length', 'طول الكفة', 'wrist (0) to gauntlet (1)'), knit: bool(false, 'Knitted cuff', 'كفة محبوكة', 'ribbed knit cuff') },
  colors: { main: C('Gloves', 'القفازات', '#2B2420'), rib: C('Cuff', 'الكفة', '#2B2420') },
  build: (p, ctx) => buildGloves(p, ctx) });
A({ id: 'belt_01', slot: 'belt', attach: 'waist', label: { en: 'Belt', ar: 'حزام' },
  description: 'Leather belt with a metal buckle, worn on the trousers’ waistband (or the natural waist).',
  fabric: 'leather', fabrics: ['leather', 'suede', 'cotton_canvas'], hardware: 'silver',
  params: { width: num(0.02, 0.05, 0.034, 'Width', 'العرض', 'belt width (m)', 0.001) },
  colors: { main: C('Leather', 'الجلد', '#3B2414'), hardware: C('Buckle', 'الإبزيم', '#C0C0C0') },
  build: (p, ctx) => buildBelt(p, ctx) });
A({ id: 'bag_backpack_01', slot: 'bag', attach: 'back', label: { en: 'Backpack', ar: 'حقيبة ظهر' },
  description: 'Backpack on the back with padded shoulder straps, front pocket, top handle and zip pulls.',
  fabric: 'nylon', fabrics: ['nylon', 'cotton_canvas', 'leather', 'denim'], hardware: 'gunmetal',
  params: { size: SIZE(1, 0.75, 1.3) },
  colors: { main: C('Bag', 'الحقيبة', '#2F4A3A'), strap: C('Straps', 'الأحزمة', '#1E1E1E'), hardware: C('Zips', 'السحابات', '#2B2B2B') },
  build: (p, ctx) => buildBag({ type: 'backpack', size: p.size }, ctx) });
A({ id: 'bag_crossbody_01', slot: 'bag', attach: 'hip_right', label: { en: 'Crossbody / waist bag', ar: 'حقيبة كتف / خصر' },
  description: 'Messenger-style crossbody bag with a flap (strap across the chest) or a waist bag (belt bag).',
  fabric: 'leather', fabrics: ['leather', 'nylon', 'cotton_canvas', 'suede'], hardware: 'brass',
  params: { style: enm(['crossbody', 'waist'], 'crossbody', 'Style', 'الطراز', 'bag type', { crossbody: { en: 'Crossbody', ar: 'كتف' }, waist: { en: 'Waist bag', ar: 'حقيبة خصر' } }), side: enm(['left', 'right'], 'right', 'Side', 'الجانب', 'which hip'), size: SIZE(1, 0.75, 1.3) },
  colors: { main: C('Bag', 'الحقيبة', '#6B3E26'), strap: C('Strap', 'الحزام', '#4A2A18'), hardware: C('Hardware', 'المعدن', '#B08D57') },
  build: (p, ctx) => buildBag({ type: p.style === 'waist' ? 'waist' : 'crossbody', side: p.side, size: p.size }, ctx) });
