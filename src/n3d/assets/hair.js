/* =====================================================================
 * NORMAL 3D — HAIRSTYLES (recipes for the hair engine)
 * Every style shares the same user controls (HAIR_PARAMS) with its own
 * defaults, so an AI or a person can lengthen, curl, part, thicken or
 * recolour any style. Lengths are metres for an average head and scale
 * with the head size.
 * ===================================================================== */
import { registerAsset, getAsset, num, enm } from '../core/registry.js';

export const HAIR_PARAMS = {
  length: num(0.4, 1.8, 1, 'Length', 'الطول', 'multiplies the hair length of the style'),
  volume: num(0, 1, 0.45, 'Volume', 'الكثافة الحجمية', 'how far the hair stands off the head'),
  density: num(0.35, 1.6, 1, 'Density', 'الكثافة', 'number of hair cards / clumps / strands'),
  thickness: num(0.5, 1.7, 1, 'Strand / clump thickness', 'سماكة الخصل', 'width of cards, clumps and strands'),
  curl: num(0, 1, 0, 'Curl', 'التجعيد', '0 straight, 0.5 curly, 1 tightly curled'),
  wave: num(0, 1, 0, 'Wave', 'التموّج', 'loose waves'),
  direction: num(-1, 1, 0, 'Combing direction', 'اتجاه التسريح', 'sweep toward the character’s left (−) or right (+)'),
  part: enm(['none', 'left', 'center', 'right'], 'none', 'Parting', 'الفرق', 'where the hair is parted (character’s own left/right)', {
    none: { en: 'None', ar: 'بدون' }, left: { en: 'Left', ar: 'يسار' }, center: { en: 'Center', ar: 'وسط' }, right: { en: 'Right', ar: 'يمين' } }),
  fringe: num(0, 1.6, 1, 'Fringe / bangs length', 'طول الغرّة', 'length of the fringe for styles that have one (0 removes it)'),
  messiness: num(0, 1, 0.25, 'Messiness', 'البعثرة', 'tousled, untidy direction changes'),
  flyaways: num(0, 1, 0.35, 'Flyaways', 'الشعيرات المتطايرة', 'loose fine strands and baby hairs at the hairline'),
  hairlineHeight: num(-1, 1, 0, 'Hairline height', 'ارتفاع منبت الشعر', 'forehead hairline height'),
  recession: num(0, 1, 0, 'Receding hairline', 'انحسار منبت الشعر', 'recession at the temples (M-shape)'),
  widowsPeak: num(0, 1, 0, "Widow's peak", 'رأس الأرملة', 'V-shaped point in the middle of the hairline'),
  sideburns: num(0, 1, 0.5, 'Sideburns', 'السوالف', 'length of the sideburns in front of the ears'),
  highlightAmount: num(0, 0.8, 0, 'Highlights', 'الخصل الفاتحة', 'share of strands in the highlight colour'),
  lowlightAmount: num(0, 0.8, 0, 'Lowlights', 'الخصل الداكنة', 'share of darker strands'),
  gloss: num(0, 1, 0.35, 'Shine', 'اللمعان', 'how glossy the hair is'),
};
const COLORS = (root = '#2B1E16', tip = null) => ({
  root: { label: { en: 'Root colour', ar: 'لون الجذور' }, default: root },
  tip: { label: { en: 'Tip colour', ar: 'لون الأطراف' }, default: tip || root },
  highlight: { label: { en: 'Highlight colour', ar: 'لون الخصل الفاتحة' }, default: '#B58A5A' },
});
/** Copy HAIR_PARAMS with style-specific defaults. */
const P = (over = {}) => Object.fromEntries(Object.entries(HAIR_PARAMS).map(([k, v]) => [k, over[k] !== undefined ? { ...v, default: over[k] } : v]));

// ---- tie points (head-relative)
const T = {
  high: h => [h.c[0], h.c[1] + h.marks.cranium.r[1] * 0.55, h.c[2] + h.marks.cranium.r[2] * 0.95],
  low: h => [h.c[0], h.c[1] - h.marks.cranium.r[1] * 0.42, h.c[2] + h.marks.cranium.r[2] * 0.98],
  top: h => [h.c[0], h.c[1] + h.marks.cranium.r[1] * 1.05, h.c[2] + h.marks.cranium.r[2] * 0.25],
  crownBack: h => [h.c[0], h.c[1] + h.marks.cranium.r[1] * 0.8, h.c[2] + h.marks.cranium.r[2] * 0.7],
  left: h => [h.c[0] - h.marks.cranium.r[0] * 0.98, h.c[1] - h.marks.cranium.r[1] * 0.42, h.c[2] + h.marks.cranium.r[2] * 0.42],
  right: h => [h.c[0] + h.marks.cranium.r[0] * 0.98, h.c[1] - h.marks.cranium.r[1] * 0.42, h.c[2] + h.marks.cranium.r[2] * 0.42],
};

// ---- layer helpers
const cards = (region, count, length, o = {}) => ({ rep: 'cards', region, count, length, width: 0.016, gravity: 0.75, lift: 0.3, offset: [0.002, 0.009], mess: 0.12, ...o });
const clumps = (region, count, length, o = {}) => ({ rep: 'clumps', region, count, length, radius: 0.0035, gravity: 0.5, lift: 0.3, offset: [0.0015, 0.006], mess: 0.2, taper: 1.4, ...o });
/** Long hair: flattened clumps lying on the sculpted mass (3D breakup of its surface and ends) + fine strands. */
const longLayers = (length, o = {}) => [
  clumps('notFace', 130, length, { ...o, gravity: o.gravity ?? 0.85, lift: 0.2, radius: 0.011, flat: 0.88, taper: 0.8, mess: 0.12, sides: 6, followBody: true }),
  { rep: 'strands', region: 'notFace', count: 120, length, width: 0.0006, gravity: o.gravity ?? 0.8, lift: 0.3, offset: [0.006, 0.012], mess: 0.35, flow: o.flow, cut: o.cut, cutSlope: o.cutSlope, followBody: true },
];
const fringeLayer = (o = {}) => clumps('fringe', 90, [0.06, 0.085], { flow: 'fringe', isFringe: true, cut: 'brow', gravity: 0.5, lift: 0.4, radius: 0.0045, flat: 0.75, taper: 0.8, mess: 0.15, sides: 6, ...o });
const sidesShort = (len = [0.012, 0.022]) => clumps('sides', 170, len, { flow: 'down', gravity: 0.7, radius: 0.004, flat: 0.3, offset: [0.001, 0.003], hug: 0.9 });
const backShort = (len = [0.015, 0.028]) => clumps('back', 170, len, { flow: 'down', gravity: 0.7, radius: 0.0042, flat: 0.3, offset: [0.001, 0.003], hug: 0.9 });

const H = (id, en, ar, description, tags, recipe, params = {}, colors = COLORS()) => registerAsset({ id, slot: 'hairStyle', label: { en, ar }, description, tags, recipe, params: P(params), colors });

// ================================================================== styles
H('hair_none', 'Bald', 'أصلع', 'No hair at all (bald, smooth scalp).', ['bald', 'shaved head', 'no hair'], { none: true, cap: false });
H('hair_buzz_01', 'Buzz cut', 'حلاقة قصيرة جداً', 'Very short clipper cut (2–5 mm) following the head shape; shows the hairline.', ['buzz', 'shaved', 'very short', 'military'],
  { cap: { offset: 0.0009, inset: 0.0, texture: 'buzz', volumeGrow: 0 }, layers: [], flyaways: 0 }, { volume: 0, flyaways: 0 });
H('hair_crew_01', 'Crew cut', 'قصة كرو', 'Short crew cut: about 2–3 cm on top brushed up and back, tapered short sides and back.', ['crew cut', 'short', 'tapered', 'classic'],
  { cap: { offset: 0.0016 }, layers: [clumps('top', 260, [0.018, 0.03], { flow: 'back', lift: 0.55, gravity: 0.15, radius: 0.0028, flat: 0.5 }), sidesShort([0.008, 0.014]), backShort([0.01, 0.018])], flyaways: 0.2 }, { volume: 0.3 });
H('hair_sidepart_01', 'Short side part', 'قصير بفرق جانبي', 'Classic short men’s cut with a side part: 5–7 cm on top combed to one side, shorter sides.', ['side part', 'short', 'classic', 'office', 'gentleman'],
  { cap: { offset: 0.0018 }, layers: [clumps('notSides', 240, [0.045, 0.07], { flow: 'part', lift: 0.35, gravity: 0.35, radius: 0.0058, flat: 0.32, hug: 0.8 }), sidesShort([0.014, 0.026]), backShort([0.018, 0.03])] }, { part: 'left', volume: 0.4 });
H('hair_slickback_01', 'Slicked back', 'مسرّح للخلف', 'Medium-short hair combed straight back with product, glossy, no parting.', ['slicked back', 'combed back', 'gelled', 'glossy'],
  { cap: { offset: 0.0016 }, layers: [clumps('notSides', 320, [0.06, 0.1], { flow: 'back', lift: 0.25, gravity: 0.25, stiff: 0.8, radius: 0.0032, flat: 0.35, mess: 0.05 }), clumps('sides', 160, [0.03, 0.05], { flow: 'back', gravity: 0.3, radius: 0.003, flat: 0.35, offset: [0.001, 0.003] })], flyaways: 0.2 }, { gloss: 0.8, messiness: 0.05, volume: 0.25 });
H('hair_crop_01', 'Textured crop', 'قصة كروب', 'Short textured crop with a short fringe pushed forward onto the forehead, faded sides.', ['crop', 'french crop', 'fringe', 'textured', 'short'],
  { cap: { offset: 0.0016 }, layers: [clumps('notSides', 300, [0.035, 0.055], { flow: 'forward', lift: 0.4, gravity: 0.35, radius: 0.0028, mess: 0.5, isFringe: true, cut: 'brow' }), sidesShort([0.006, 0.012]), backShort([0.008, 0.014])] }, { messiness: 0.5 });
H('hair_spiky_01', 'Spiky', 'شائك', 'Short spiky hair styled upward into pointed spikes all over the top.', ['spiky', 'spikes', 'punk', 'anime', 'gelled'],
  { cap: { offset: 0.0018 }, layers: [clumps('notSides', 160, [0.035, 0.065], { flow: 'up', lift: 0.75, gravity: 0.04, stiff: 1, radius: 0.0055, taper: 1.3, flat: 0.5, mess: 0.25 }), sidesShort([0.012, 0.02]), backShort([0.02, 0.035])] }, { volume: 0.5 });
H('hair_messy_01', 'Messy medium', 'متوسط منكوش', 'Medium-length tousled hair (8–12 cm) falling in loose, untidy clumps over the forehead and ears.', ['messy', 'tousled', 'medium', 'shaggy', 'bedhead'],
  { cap: {}, layers: [clumps('all', 340, [0.07, 0.12], { flow: 'down', lift: 0.5, gravity: 0.55, radius: 0.0042, flat: 0.5, mess: 0.7, lengthByHeight: true })] }, { messiness: 0.7, volume: 0.6 });
H('hair_curly_short_01', 'Short curly', 'مجعد قصير', 'Short curly hair: tight springy curls about 3–5 cm, rounded shape.', ['curly', 'short', 'ringlets', 'coils'],
  { cap: { offset: 0.002 }, layers: [clumps('all', 300, [0.03, 0.05], { flow: 'down', lift: 0.6, gravity: 0.25, radius: 0.0032, flat: 0.8, curlK: 1, mess: 0.3, sides: 5 })] }, { curl: 0.85, volume: 0.6 });
H('hair_afro_01', 'Afro', 'أفرو', 'Big rounded afro: tightly coiled hair forming a large soft volume around the head.', ['afro', 'coily', 'big', 'volume', 'natural'],
  { cap: { offset: 0.002 }, layers: [], extras: [{ type: 'volume', size: 0.05, curls: 300 }], flyaways: 0.2 }, { curl: 1, volume: 0.7 });
H('hair_pixie_01', 'Pixie cut', 'قصة بيكسي', 'Short pixie cut: longer textured top swept to the side, short sides and nape, side-swept fringe.', ['pixie', 'short', 'side swept', 'feminine short'],
  { cap: {}, layers: [clumps('notSides', 280, [0.05, 0.085], { flow: 'side', lift: 0.45, gravity: 0.45, radius: 0.0032, flat: 0.45, mess: 0.35, isFringe: true }), sidesShort([0.015, 0.028]), backShort([0.018, 0.03])] }, { direction: 0.6 });
H('hair_bob_01', 'Bob', 'بوب', 'Chin-length bob: straight hair cut to one length at the jaw, slightly longer in front, centre or side part.', ['bob', 'chin length', 'straight', 'blunt cut'],
  { cap: {}, layers: [clumps('all', 220, [0.14, 0.2], { flow: 'part', cut: 'chin', cutSlope: 0.25, gravity: 0.85, lift: 0.2, radius: 0.0055, flat: 0.72, taper: 0.7, mess: 0.12, sides: 6 })] }, { part: 'center' });
H('hair_bob_bangs_01', 'Bob with bangs', 'بوب مع غرّة', 'Chin-length bob with straight blunt bangs cut at the eyebrows.', ['bob', 'bangs', 'fringe', 'blunt'],
  { cap: {}, layers: [clumps('notFringe', 220, [0.14, 0.2], { flow: 'down', cut: 'chin', gravity: 0.85, lift: 0.2, radius: 0.0055, flat: 0.72, taper: 0.7, mess: 0.12, sides: 6 }), fringeLayer({ count: 90 })] }, { part: 'none' });
H('hair_shoulder_01', 'Shoulder length', 'حتى الكتفين', 'Shoulder-length straight hair with a centre part, ends resting on the shoulders.', ['shoulder length', 'medium', 'lob', 'straight', 'middle part'],
  { cap: {}, layers: longLayers([0.2, 0.28], { flow: 'part', cut: 'shoulder', gravity: 0.8 }) }, { part: 'center' });
H('hair_long_straight_01', 'Long straight', 'طويل ناعم', 'Long straight hair falling past the shoulders to the mid-back, centre part.', ['long', 'straight', 'sleek', 'middle part'],
  { cap: {}, layers: longLayers([0.34, 0.46], { flow: 'part', cut: 'midback', gravity: 0.85 }) }, { part: 'center' });
H('hair_long_wavy_01', 'Long wavy', 'طويل مموّج', 'Long hair with soft loose waves, side part, past the shoulders.', ['long', 'wavy', 'waves', 'beach waves', 'side part'],
  { cap: {}, layers: longLayers([0.3, 0.42], { flow: 'part', gravity: 0.8 }) }, { part: 'left', wave: 0.65, volume: 0.6 });
H('hair_long_curly_01', 'Long curly', 'طويل مجعد', 'Long curly hair: defined ringlet curls to below the shoulders with lots of volume.', ['long', 'curly', 'ringlets', 'voluminous'],
  { cap: {}, layers: [clumps((r) => !(Math.abs(r.az) < 1.3 && r.up < 0.7), 300, [0.22, 0.34], { flow: 'down', lift: 0.55, gravity: 0.6, radius: 0.0045, flat: 0.75, curlK: 1, curlAmpK: 0.7, mess: 0.25, followBody: true, offset: [0.003, 0.012] })] }, { curl: 0.75, volume: 0.75 });
H('hair_long_bangs_01', 'Long with bangs', 'طويل مع غرّة', 'Long straight hair with straight bangs covering the forehead.', ['long', 'bangs', 'fringe', 'straight'],
  { cap: {}, layers: [...longLayers([0.32, 0.44], { flow: 'down', gravity: 0.85 }), fringeLayer()] }, {});
H('hair_ponytail_01', 'High ponytail', 'ذيل حصان عالي', 'Hair pulled back tightly into a high ponytail at the back of the crown, tied with a band.', ['ponytail', 'high ponytail', 'sporty', 'tied back'],
  { cap: { offset: 0.0013 }, layers: [clumps('all', 260, [0.12, 0.2], { flow: 'tie', tie: T.high, tieRadius: 0.014, gravity: 0.02, lift: 0.1, radius: 0.0032, flat: 0.3, offset: [0.0012, 0.003], mess: 0.05, fixedLength: true })], extras: [{ type: 'ponytail', tie: T.high, length: 0.3, count: 80, dir: () => [0, -0.15, 1] }] });
H('hair_ponytail_low_01', 'Low ponytail', 'ذيل حصان منخفض', 'Hair gathered into a low ponytail at the nape.', ['ponytail', 'low ponytail', 'tied back'],
  { cap: { offset: 0.0013 }, layers: [clumps('all', 260, [0.12, 0.2], { flow: 'tie', tie: T.low, tieRadius: 0.014, gravity: 0.1, lift: 0.1, radius: 0.0032, flat: 0.3, offset: [0.0012, 0.003], mess: 0.05, fixedLength: true })], extras: [{ type: 'ponytail', tie: T.low, length: 0.26, count: 70, dir: () => [0, -0.85, 0.35] }] });
H('hair_bun_01', 'Top bun', 'كعكة علوية', 'Hair gathered into a round bun on top of the head.', ['bun', 'top knot', 'updo', 'messy bun'],
  { cap: { offset: 0.0013 }, layers: [clumps('all', 260, [0.12, 0.2], { flow: 'tie', tie: T.top, tieRadius: 0.016, gravity: 0, lift: 0.1, radius: 0.0032, flat: 0.3, offset: [0.0012, 0.003], mess: 0.08, fixedLength: true })], extras: [{ type: 'bun', tie: T.top, size: 0.032 }] });
H('hair_bun_low_01', 'Low bun', 'كعكة منخفضة', 'Neat low bun (chignon) at the nape of the neck.', ['bun', 'chignon', 'low bun', 'formal'],
  { cap: { offset: 0.0013 }, layers: [clumps('all', 260, [0.12, 0.2], { flow: 'tie', tie: T.low, tieRadius: 0.016, gravity: 0.1, lift: 0.1, radius: 0.0032, flat: 0.3, offset: [0.0012, 0.003], mess: 0.05, fixedLength: true })], extras: [{ type: 'bun', tie: T.low, size: 0.03 }] }, { part: 'center' });
H('hair_topknot_01', 'Man bun / top knot', 'كعكة رجالية', 'Medium hair tied into a small knot at the top-back of the head.', ['man bun', 'top knot', 'samurai'],
  { cap: { offset: 0.0013 }, layers: [clumps('all', 240, [0.12, 0.2], { flow: 'tie', tie: T.crownBack, tieRadius: 0.014, gravity: 0, lift: 0.1, radius: 0.0034, flat: 0.3, offset: [0.0012, 0.003], mess: 0.1, fixedLength: true })], extras: [{ type: 'bun', tie: T.crownBack, size: 0.024 }] });
H('hair_braids_01', 'Two braids', 'ضفيرتان', 'Hair parted in the middle and woven into two three-strand braids hanging behind the ears.', ['braids', 'pigtails', 'plaits', 'two braids'],
  { cap: { offset: 0.0013 }, layers: [clumps('left', 160, [0.12, 0.2], { flow: 'tie', tie: T.left, tieRadius: 0.012, gravity: 0.1, lift: 0.1, radius: 0.0032, flat: 0.3, offset: [0.0012, 0.003], mess: 0.05, fixedLength: true }), clumps('right', 160, [0.12, 0.2], { flow: 'tie', tie: T.right, tieRadius: 0.012, gravity: 0.1, lift: 0.1, radius: 0.0032, flat: 0.3, offset: [0.0012, 0.003], mess: 0.05, fixedLength: true })],
    extras: [{ type: 'braid', name: 'l', tie: T.left, length: 0.3, dir: () => [0, -0.9, 0.15] }, { type: 'braid', name: 'r', tie: T.right, length: 0.3, dir: () => [0, -0.9, 0.15] }] }, { part: 'center' });
H('hair_braid_back_01', 'Single braid', 'ضفيرة واحدة', 'All the hair woven into one long three-strand braid hanging down the back.', ['braid', 'plait', 'single braid', 'french braid'],
  { cap: { offset: 0.0013 }, layers: [clumps('all', 260, [0.12, 0.2], { flow: 'tie', tie: T.low, tieRadius: 0.012, gravity: 0.1, lift: 0.1, radius: 0.0032, flat: 0.3, offset: [0.0012, 0.003], mess: 0.05, fixedLength: true })],
    extras: [{ type: 'braid', name: 'b', tie: T.low, length: 0.36, width: 0.026, dir: () => [0, -0.8, 0.4] }] });
H('hair_undercut_01', 'Undercut', 'أندركت', 'Undercut: shaved/clipped sides and back with long hair on top swept back.', ['undercut', 'shaved sides', 'disconnected', 'swept back'],
  { cap: { offset: 0.0009, texture: 'buzz', region: 'undercutSides', volumeGrow: 0 }, layers: [clumps('undercutTop', 260, [0.08, 0.13], { flow: 'back', lift: 0.45, gravity: 0.3, radius: 0.0036, flat: 0.45, mess: 0.15 })] }, { volume: 0.5 });
H('hair_mohawk_01', 'Mohawk', 'موهوك', 'Mohawk: a strip of tall spiked hair along the centre of the head, shaved sides.', ['mohawk', 'punk', 'spikes', 'shaved sides'],
  { cap: { offset: 0.0008, texture: 'buzz', volumeGrow: 0 }, layers: [clumps('topStrip', 110, [0.06, 0.1], { flow: 'up', lift: 0.85, gravity: 0.02, stiff: 1, radius: 0.006, taper: 1.2, flat: 0.35, mess: 0.15 })], flyaways: 0 }, { volume: 0.6 });
H('hair_locs_01', 'Locs', 'خصل مجدولة (لوكس)', 'Medium-long locs (dreadlocks): rope-like twisted locks hanging around the head.', ['locs', 'dreadlocks', 'dreads', 'twists'],
  { cap: { offset: 0.002 }, layers: [clumps('all', 130, [0.18, 0.28], { flow: 'down', lift: 0.4, gravity: 0.85, radius: 0.0048, flat: 1, taper: 0.25, bumpy: true, sides: 7, mess: 0.15, followBody: true, offset: [0.003, 0.01] })], flyaways: 0 }, { volume: 0.5 });
H('hair_cornrows_01', 'Cornrows', 'ضفائر ملتصقة', 'Cornrows: small braids lying flat on the scalp in straight rows from front to back.', ['cornrows', 'braids', 'flat braids', 'rows'],
  { cap: { offset: 0.0008, texture: 'buzz', volumeGrow: 0 }, layers: [], extras: [{ type: 'cornrows', rows: 9 }], flyaways: 0 });
H('hair_anime_01', 'Anime spiky', 'أنمي شائك', 'Stylized anime/cartoon hair: big pointed clumps, spiky fringe over the forehead and side locks framing the face.', ['anime', 'manga', 'stylized', 'cartoon', 'spiky', 'shonen'],
  { cap: { offset: 0.002 }, layers: [], flyaways: 0 }, { volume: 0.7, flyaways: 0, messiness: 0.15 });

// ================================================================== sculpted hair masses
// Each style's silhouette as a real volume (hair/mass.js); the strand layers above lie on it.
// shell: thickness (m, before the volume control) on top / sides / back / nape / front (+ quiff, crown);
// fringe: slab over the forehead; curtain: long hair hanging from the head; spikes; bun; flow: texture direction.
const MASS = {
  hair_buzz_01: { shell: { top: 0.0045, side: 0.0035, back: 0.004, nape: 0.0025, edge: 0.004, partCrease: 0 }, texture: 'buzz', flow: 'natural' },
  hair_crew_01: { shell: { top: 0.017, side: 0.0055, back: 0.008, nape: 0.0035, front: 0.02, quiff: 0.004, edge: 0.01 }, flow: 'back', kind: 'short' },
  hair_sidepart_01: { shell: { top: 0.022, side: 0.008, back: 0.012, nape: 0.005, front: 0.026, quiff: 0.006, edge: 0.012 }, flow: 'side', kind: 'short' },
  hair_slickback_01: { shell: { top: 0.016, side: 0.01, back: 0.014, nape: 0.008, front: 0.02, edge: 0.012 }, flow: 'back', kind: 'straight' },
  hair_crop_01: { shell: { top: 0.016, side: 0.0045, back: 0.006, nape: 0.003, edge: 0.008 }, fringe: { to: 'brow', thick: 0.008, tipThick: 0.004, width: 0.95 }, fringeReach: 0.4, flow: 'forward', kind: 'short' },
  hair_spiky_01: { shell: { top: 0.012, side: 0.005, back: 0.008, nape: 0.003, edge: 0.008 }, spikes: { count: 24, length: 0.055, radius: 0.011, lean: 0.25 }, flow: 'up', kind: 'short' },
  hair_messy_01: { shell: { top: 0.03, side: 0.022, back: 0.028, nape: 0.02, crown: 0.006, edge: 0.03 }, fringe: { to: 'brow', thick: 0.012, tipThick: 0.005, width: 1.0 }, fringeReach: 0.75, flow: 'natural', kind: 'straight' },
  hair_curly_short_01: { shell: { top: 0.032, side: 0.024, back: 0.03, nape: 0.012, edge: 0.035 }, flow: 'natural', kind: 'curly' },
  hair_pixie_01: { shell: { top: 0.03, side: 0.008, back: 0.012, nape: 0.005, front: 0.03, edge: 0.02 }, fringe: { to: 'eye', thick: 0.011, tipThick: 0.004, width: 0.8, sweep: 0.45 }, fringeReach: 0.7, flow: 'side', kind: 'short' },
  hair_bob_01: { shell: { top: 0.012, side: 0.012, back: 0.014, nape: 0.012, edge: 0.012 }, curtain: { cut: 'jaw', thickness: 0.022, flare: 0.03, below: 'sides', face: 1.0, layers: 0.15 }, flow: 'natural', kind: 'straight' },
  hair_bob_bangs_01: { shell: { top: 0.012, side: 0.012, back: 0.014, nape: 0.012, edge: 0.012 }, curtain: { cut: 'jaw', thickness: 0.022, flare: 0.03, below: 'sides', face: 1.0, layers: 0.1 }, fringe: { to: 'brow', thick: 0.012, tipThick: 0.007, width: 1.05 }, flow: 'natural', kind: 'straight' },
  hair_shoulder_01: { shell: { top: 0.012, side: 0.012, back: 0.014, nape: 0.012, edge: 0.012 }, curtain: { cut: 'shoulder', thickness: 0.024, flare: 0.04, below: 'sides', face: 1.05, layers: 0.4 }, flow: 'natural', kind: 'straight' },
  hair_long_straight_01: { shell: { top: 0.011, side: 0.011, back: 0.013, nape: 0.012, edge: 0.012 }, curtain: { cut: 'midback', thickness: 0.024, flare: 0.05, below: 'behind', face: 1.05, layers: 0.5 }, flow: 'natural', kind: 'straight' },
  hair_long_wavy_01: { shell: { top: 0.016, side: 0.016, back: 0.018, nape: 0.016, edge: 0.014 }, curtain: { cut: 'chest', thickness: 0.032, flare: 0.1, below: 'behind', face: 1.05, layers: 0.8 }, flow: 'natural', kind: 'straight' },
  hair_long_curly_01: { shell: { top: 0.028, side: 0.026, back: 0.03, nape: 0.026, edge: 0.03 }, curtain: { cut: 'chest', thickness: 0.045, flare: 0.16, below: 'behind', face: 1.05, layers: 1 }, flow: 'natural', kind: 'curly' },
  hair_long_bangs_01: { shell: { top: 0.011, side: 0.011, back: 0.013, nape: 0.012, edge: 0.012 }, curtain: { cut: 'midback', thickness: 0.024, flare: 0.05, below: 'behind', face: 1.08, layers: 0.4 }, fringe: { to: 'brow', thick: 0.011, tipThick: 0.006, width: 1.05 }, flow: 'natural', kind: 'straight' },
  hair_ponytail_01: { shell: { top: 0.005, side: 0.0045, back: 0.005, nape: 0.004, edge: 0.006 }, flow: 'back', kind: 'straight' },
  hair_ponytail_low_01: { shell: { top: 0.005, side: 0.0045, back: 0.005, nape: 0.004, edge: 0.006 }, flow: 'back', kind: 'straight' },
  hair_bun_01: { shell: { top: 0.005, side: 0.0045, back: 0.005, nape: 0.004, edge: 0.006 }, flow: 'up', kind: 'straight' },
  hair_bun_low_01: { shell: { top: 0.005, side: 0.0045, back: 0.005, nape: 0.004, edge: 0.006 }, flow: 'back', kind: 'straight' },
  hair_topknot_01: { shell: { top: 0.006, side: 0.005, back: 0.006, nape: 0.004, edge: 0.006 }, flow: 'back', kind: 'straight' },
  hair_braids_01: { shell: { top: 0.005, side: 0.0045, back: 0.005, nape: 0.004, edge: 0.006 }, flow: 'natural', kind: 'straight' },
  hair_braid_back_01: { shell: { top: 0.005, side: 0.0045, back: 0.005, nape: 0.004, edge: 0.006 }, flow: 'back', kind: 'straight' },
  hair_undercut_01: { shell: { top: 0.026, side: 0.0025, back: 0.0028, nape: 0.002, front: 0.03, quiff: 0.006, edge: 0.006, disconnect: 0.5 }, flow: 'back', kind: 'straight' },
  hair_mohawk_01: { shell: { top: 0.003, side: 0.0025, back: 0.0028, nape: 0.002, edge: 0.004 }, spikes: { count: 9, length: 0.1, radius: 0.017, lean: 0.1, region: 'strip' }, texture: 'buzz', flow: 'up' },
  hair_locs_01: { shell: { top: 0.008, side: 0.007, back: 0.008, nape: 0.006, edge: 0.008 }, flow: 'natural', kind: 'curly' },
  hair_cornrows_01: { shell: { top: 0.0025, side: 0.0022, back: 0.0025, nape: 0.002, edge: 0.004, partCrease: 0 }, texture: 'buzz', flow: 'back' },
  hair_anime_01: { shell: { top: 0.034, side: 0.024, back: 0.032, nape: 0.022, front: 0.03, edge: 0.03 }, spikes: { count: 20, length: 0.13, radius: 0.016, lean: 1.4, region: 'locks', down: true }, fringe: { to: 'eye', thick: 0.016, tipThick: 0.004, width: 1.0, spiky: 5 }, fringeReach: 0.75, flow: 'natural', kind: 'straight' },
};
for (const [id, mass] of Object.entries(MASS)) { const a = getAsset(id); if (a) a.recipe.mass = mass; }
