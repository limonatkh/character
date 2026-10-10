/* Face parts: eyes, eyebrows, mouths, facial hair and small face details.
 * Every face part is drawn on the front plane of the head (H.faceZ, -Z is front)
 * and scaled by H.s / H.t (head width / height relative to the Limonat hero). */
import { registerAsset } from '../core/registry.js';

const fixed = (ctx, key, hex, opts = {}) => ctx.palette[key] ? key : ctx.setColor(key, hex, { outline: false, ...opts });
const GAZE = { center: [0, 0], left: [-1, 0], right: [1, 0], up: [0, 1], down: [0, -1] };
function gazeOf(item) { return GAZE[item.gaze] || GAZE.center; }
function markFaceTop(ctx, y) { ctx.faceTop = Math.max(ctx.faceTop || 0, y); if (ctx.eyeTop == null) ctx.eyeTop = y; }

// ============================================================== EYES
// Eye voxels go on the leftEye / rightEye joints so a future app can blink by scaling them.
const eyeColor = [{ key: 'color', label: { en: 'Eye colour', ar: 'لون العين' }, default: '#161616' }];

registerAsset({
  id: 'eyes_round_big_01', slot: 'eyes', label: { en: 'Big round (Limonat)', ar: 'دائرية كبيرة (ليمونات)' },
  description: 'Huge round cartoon eyes: thick black ring, white eyeball and a coloured pupil (the Limonat hero eyes). Supports gaze direction.',
  tags: ['big', 'round', 'cartoon', 'cute', 'limonat'], colors: eyeColor,
  build(ctx, it) {
    const H = ctx.m.head, s = H.s, t = H.t, z = H.faceZ, [gx, gy] = gazeOf(it);
    const white = fixed(ctx, 'eyeWhite', '#FFFFFF');
    ctx.mirror((sd, side) => {
      const j = side + 'Eye', cx = sd * H.eyeX, cy = H.eyeY;
      ctx.boxCC(j, cx, cy, z - 0.1, 2.6 * s, 1.9 * t, 0.3, 'ink');
      ctx.boxCC(j, cx, cy, z - 0.1, 1.9 * s, 2.6 * t, 0.3, 'ink');
      ctx.boxCC(j, cx, cy, z - 0.25, 2.0 * s, 1.3 * t, 0.3, white);
      ctx.boxCC(j, cx, cy, z - 0.25, 1.3 * s, 2.0 * t, 0.3, white);
      ctx.boxCC(j, cx + gx * 0.42 * s, cy + gy * 0.4 * t, z - 0.42, 0.8 * s, 0.85 * t, 0.2, it.keys.mainFlat);
    });
    markFaceTop(ctx, H.eyeY + 1.3 * t);
  },
});

registerAsset({
  id: 'eyes_dot_01', slot: 'eyes', label: { en: 'Small dots', ar: 'نقاط صغيرة' },
  description: 'Small solid dot eyes, simple and cute (chibi / mascot style).',
  tags: ['small', 'dot', 'simple', 'chibi'], colors: eyeColor,
  build(ctx, it) {
    const H = ctx.m.head, s = H.s, t = H.t, z = H.faceZ, [gx, gy] = gazeOf(it);
    ctx.mirror((sd, side) => {
      ctx.boxCC(side + 'Eye', sd * H.eyeX * 0.85 + gx * 0.2 * s, H.eyeY + gy * 0.2 * t, z - 0.08, 0.95 * s, 1.25 * t, 0.25, it.keys.mainFlat);
    });
    markFaceTop(ctx, H.eyeY + 0.7 * t);
  },
});

registerAsset({
  id: 'eyes_block_01', slot: 'eyes', label: { en: 'Classic block', ar: 'مربعة كلاسيكية' },
  description: 'Classic voxel-game eyes: a white rectangle with a square coloured iris. Good for realistic people and blocky styles.',
  tags: ['classic', 'square', 'realistic', 'minecraft-like'], colors: [{ key: 'color', label: { en: 'Iris', ar: 'القزحية' }, default: '#3B2A1E' }],
  build(ctx, it) {
    const H = ctx.m.head, s = H.s, t = H.t, z = H.faceZ, [gx, gy] = gazeOf(it);
    const white = fixed(ctx, 'eyeWhite', '#FFFFFF');
    ctx.mirror((sd, side) => {
      const cx = sd * H.eyeX;
      ctx.boxCC(side + 'Eye', cx, H.eyeY, z - 0.05, 1.9 * s, 1.0 * t, 0.15, white);
      // iris sits toward the nose unless the character looks sideways
      const ix = gx !== 0 ? gx * 0.48 * s : -sd * 0.48 * s;
      ctx.boxCC(side + 'Eye', cx + ix, H.eyeY + gy * 0.15 * t, z - 0.1, 0.95 * s, 1.0 * t, 0.15, it.keys.mainFlat);
    });
    markFaceTop(ctx, H.eyeY + 0.5 * t);
  },
});

registerAsset({
  id: 'eyes_anime_01', slot: 'eyes', label: { en: 'Anime', ar: 'أنمي' },
  description: 'Tall anime eyes: thick upper lash line, big coloured iris with a darker pupil and a white highlight.',
  tags: ['anime', 'manga', 'tall', 'expressive', 'highlight'], colors: [{ key: 'color', label: { en: 'Iris', ar: 'القزحية' }, default: '#3D6FB8' }],
  build(ctx, it) {
    const H = ctx.m.head, s = H.s, t = H.t, z = H.faceZ, [gx, gy] = gazeOf(it);
    const white = fixed(ctx, 'eyeWhite', '#FFFFFF');
    ctx.mirror((sd, side) => {
      const j = side + 'Eye', cx = sd * H.eyeX, cy = H.eyeY;
      ctx.boxCC(j, cx, cy - 0.1 * t, z - 0.05, 2.1 * s, 1.9 * t, 0.15, white);
      const ix = cx + gx * 0.3 * s, iy = cy - 0.15 * t + gy * 0.2 * t;
      ctx.boxCC(j, ix, iy, z - 0.12, 1.4 * s, 1.85 * t, 0.15, it.keys.mainFlat);
      ctx.boxCC(j, ix, iy - 0.1 * t, z - 0.18, 0.75 * s, 1.0 * t, 0.12, it.keys.mainDark);
      ctx.boxCC(j, ix - sd * 0.3 * s, iy + 0.45 * t, z - 0.24, 0.45 * s, 0.45 * t, 0.1, white);
      ctx.boxCC(j, cx + sd * 0.12 * s, cy + 0.95 * t, z - 0.12, 2.5 * s, 0.4 * t, 0.25, 'ink');                 // upper lash
      ctx.boxCC(j, cx + sd * 1.15 * s, cy + 0.6 * t, z - 0.12, 0.35 * s, 0.5 * t, 0.25, 'ink');                 // outer corner
    });
    markFaceTop(ctx, H.eyeY + 1.15 * t);
  },
});

registerAsset({
  id: 'eyes_sleepy_01', slot: 'eyes', label: { en: 'Sleepy / closed', ar: 'نعسانة / مغمضة' },
  description: 'Short horizontal dash eyes: sleepy, calm, squinting or closed eyes.',
  tags: ['sleepy', 'closed', 'calm', 'squint', 'dash'], colors: eyeColor,
  build(ctx, it) {
    const H = ctx.m.head, s = H.s, t = H.t, z = H.faceZ;
    ctx.mirror((sd, side) => ctx.boxCC(side + 'Eye', sd * H.eyeX, H.eyeY, z - 0.08, 1.4 * s, 0.3 * t, 0.2, it.keys.mainFlat));
    markFaceTop(ctx, H.eyeY + 0.2 * t);
  },
});

registerAsset({
  id: 'eyes_happy_01', slot: 'eyes', label: { en: 'Happy arcs ^ ^', ar: 'سعيدة ^ ^' },
  description: 'Closed happy eyes shaped like upside-down U (^ ^), used for laughing or very cheerful characters.',
  tags: ['happy', 'laughing', 'closed', 'smiling eyes'], colors: eyeColor,
  build(ctx, it) {
    const H = ctx.m.head, s = H.s, t = H.t, z = H.faceZ, k = it.keys.mainFlat;
    ctx.mirror((sd, side) => {
      const j = side + 'Eye', cx = sd * H.eyeX, cy = H.eyeY;
      ctx.boxCC(j, cx - 0.6 * s, cy - 0.15 * t, z - 0.08, 0.4 * s, 0.55 * t, 0.2, k);
      ctx.boxCC(j, cx + 0.6 * s, cy - 0.15 * t, z - 0.08, 0.4 * s, 0.55 * t, 0.2, k);
      ctx.boxCC(j, cx, cy + 0.25 * t, z - 0.08, 1.0 * s, 0.35 * t, 0.2, k);
    });
    markFaceTop(ctx, H.eyeY + 0.45 * t);
  },
});

// ============================================================== EYEBROWS
const browColor = [{ key: 'color', label: { en: 'Eyebrow colour', ar: 'لون الحاجب' }, default: '#2A211C' }];
/** y of the brow bottom, just above whatever eyes were drawn. */
function browBase(ctx) { const H = ctx.m.head; return Math.max(H.browY, (ctx.faceTop || H.eyeY) + 0.22 * H.t); }

registerAsset({
  id: 'brows_none', slot: 'eyebrows', label: { en: 'None', ar: 'بدون' },
  description: 'No visible eyebrows (the Limonat hero has none).', tags: ['none', 'hidden'],
  build() {},
});

function browAsset(id, label, description, tags, draw) {
  registerAsset({
    id, slot: 'eyebrows', label, description, tags, colors: browColor,
    build(ctx, it) {
      const H = ctx.m.head, y = browBase(ctx);
      ctx.mirror((sd) => draw(ctx, it.keys.mainFlat, sd, sd * H.eyeX, y, H.faceZ - 0.1, H.s, H.t));
      markFaceTop(ctx, y + 0.6 * H.t);
    },
  });
}
const brow = (ctx, k, x, y, z, w, h) => ctx.box('head', x - w / 2, y, z - 0.1, w, h, 0.25, k, { hair: true });
browAsset('brows_flat_01', { en: 'Thin straight', ar: 'رفيعة مستقيمة' }, 'Thin straight eyebrows; neutral expression.', ['thin', 'straight', 'neutral'],
  (c, k, sd, x, y, z, s, t) => brow(c, k, x, y, z, 1.7 * s, 0.3 * t));
browAsset('brows_thick_01', { en: 'Thick', ar: 'كثيفة' }, 'Thick, bold straight eyebrows.', ['thick', 'bold', 'heavy'],
  (c, k, sd, x, y, z, s, t) => brow(c, k, x, y, z, 2.0 * s, 0.55 * t));
browAsset('brows_angry_01', { en: 'Angry / determined', ar: 'غاضبة / حازمة' }, 'Eyebrows slanting down toward the nose: angry, serious or determined.', ['angry', 'serious', 'determined', 'slanted'],
  (c, k, sd, x, y, z, s, t) => { brow(c, k, x - sd * 0.45 * s, y, z, 1.0 * s, 0.35 * t); brow(c, k, x + sd * 0.45 * s, y + 0.3 * t, z, 1.0 * s, 0.35 * t); });
browAsset('brows_sad_01', { en: 'Worried / sad', ar: 'قلقة / حزينة' }, 'Eyebrows slanting up toward the nose: worried, sad or pleading.', ['sad', 'worried', 'raised inner'],
  (c, k, sd, x, y, z, s, t) => { brow(c, k, x - sd * 0.45 * s, y + 0.3 * t, z, 1.0 * s, 0.35 * t); brow(c, k, x + sd * 0.45 * s, y, z, 1.0 * s, 0.35 * t); });
browAsset('brows_arched_01', { en: 'Arched', ar: 'مقوّسة' }, 'Rounded arched eyebrows (flat top with short drops on both ends); surprised or elegant.', ['arched', 'surprised', 'elegant'],
  (c, k, sd, x, y, z, s, t) => { brow(c, k, x, y + 0.3 * t, z, 1.4 * s, 0.25 * t); brow(c, k, x - 0.8 * s, y, z, 0.35 * s, 0.45 * t); brow(c, k, x + 0.8 * s, y, z, 0.35 * s, 0.45 * t); });

// ============================================================== MOUTHS (on the jaw joint)
function mouthAsset(id, label, description, tags, draw) {
  registerAsset({
    id, slot: 'mouth', label, description, tags,
    build(ctx) { const H = ctx.m.head; draw(ctx, 0, H.mouthY, H.faceZ + 0.05, H.s, H.t); },
  });
}
const mb = (ctx, cx, cy, z, w, h, key, d = 0.2) => ctx.boxCC('jaw', cx, cy, z - d / 2, w, h, d, key);
mouthAsset('mouth_dash_01', { en: 'Small dash', ar: 'شرطة صغيرة' }, 'Tiny straight line mouth; neutral or calm (Limonat hero).', ['neutral', 'small', 'line', 'calm'],
  (c, x, y, z, s, t) => mb(c, x, y, z, 1.0 * s, 0.25 * t, 'ink'));
mouthAsset('mouth_smile_01', { en: 'Smile', ar: 'ابتسامة' }, 'Closed U-shaped smile.', ['smile', 'happy', 'friendly'],
  (c, x, y, z, s, t) => { mb(c, x, y - 0.1 * t, z, 1.4 * s, 0.25 * t, 'ink'); mb(c, x - 0.8 * s, y + 0.1 * t, z, 0.3 * s, 0.5 * t, 'ink'); mb(c, x + 0.8 * s, y + 0.1 * t, z, 0.3 * s, 0.5 * t, 'ink'); });
mouthAsset('mouth_grin_01', { en: 'Big grin (teeth)', ar: 'ضحكة عريضة (أسنان)' }, 'Wide open grin showing a row of white teeth; excited, cheeky or laughing (very common for energetic anime heroes).', ['grin', 'teeth', 'laughing', 'excited', 'wide'],
  (c, x, y, z, s, t) => {
    const inner = fixed(c, 'mouthInner', '#5A1E22'), teeth = fixed(c, 'teeth', '#FFFFFF');
    mb(c, x, y, z, 2.4 * s, 1.0 * t, 'ink');
    mb(c, x, y - 0.05 * t, z - 0.08, 2.0 * s, 0.65 * t, inner, 0.15);
    mb(c, x, y + 0.15 * t, z - 0.14, 2.0 * s, 0.28 * t, teeth, 0.12);
  });
mouthAsset('mouth_open_01', { en: 'Open "O"', ar: 'مفتوح "O"' }, 'Small round open mouth: surprised, singing or talking.', ['open', 'surprised', 'o', 'shocked'],
  (c, x, y, z, s, t) => { const inner = fixed(c, 'mouthInner', '#5A1E22'); mb(c, x, y, z, 1.0 * s, 1.1 * t, 'ink'); mb(c, x, y, z - 0.08, 0.55 * s, 0.65 * t, inner, 0.15); });
mouthAsset('mouth_frown_01', { en: 'Frown', ar: 'عابس' }, 'Upside-down U mouth: sad, grumpy or unimpressed.', ['frown', 'sad', 'grumpy', 'angry'],
  (c, x, y, z, s, t) => { mb(c, x, y + 0.1 * t, z, 1.4 * s, 0.25 * t, 'ink'); mb(c, x - 0.8 * s, y - 0.1 * t, z, 0.3 * s, 0.5 * t, 'ink'); mb(c, x + 0.8 * s, y - 0.1 * t, z, 0.3 * s, 0.5 * t, 'ink'); });
mouthAsset('mouth_cat_01', { en: 'Cat smile :3', ar: 'ابتسامة قطة :3' }, 'Small w-shaped "cat" smile (:3); playful or smug.', ['cat', 'w', 'playful', 'smug', 'cute'],
  (c, x, y, z, s, t) => { mb(c, x - 0.45 * s, y - 0.1 * t, z, 0.7 * s, 0.25 * t, 'ink'); mb(c, x + 0.45 * s, y - 0.1 * t, z, 0.7 * s, 0.25 * t, 'ink'); mb(c, x, y + 0.1 * t, z, 0.22 * s, 0.4 * t, 'ink'); mb(c, x - 0.85 * s, y + 0.1 * t, z, 0.22 * s, 0.4 * t, 'ink'); mb(c, x + 0.85 * s, y + 0.1 * t, z, 0.22 * s, 0.4 * t, 'ink'); });

// ============================================================== FACIAL HAIR
const fhColor = [{ key: 'color', label: { en: 'Facial hair colour', ar: 'لون شعر الوجه' }, default: '#2B2118' }];
registerAsset({ id: 'facialhair_none', slot: 'facialHair', label: { en: 'None', ar: 'بدون' }, description: 'Clean shaven / no facial hair.', tags: ['none', 'clean shaven'], build() {} });
registerAsset({
  id: 'facialhair_mustache_01', slot: 'facialHair', label: { en: 'Mustache', ar: 'شارب' },
  description: 'A thick mustache above the mouth.', tags: ['mustache', 'moustache'], colors: fhColor,
  build(ctx, it) {
    const H = ctx.m.head, y = H.mouthY + 0.45 * H.t, z = H.faceZ;
    ctx.mirror(sd => ctx.boxCC('jaw', sd * 0.6 * H.s, y, z - 0.18, 1.1 * H.s, 0.4 * H.t, 0.3, it.keys.main));
  },
});
registerAsset({
  id: 'facialhair_goatee_01', slot: 'facialHair', label: { en: 'Goatee', ar: 'سكسوكة' },
  description: 'Small beard on the chin only (goatee), optionally with a thin mustache.', tags: ['goatee', 'chin beard'], colors: fhColor,
  build(ctx, it) {
    const H = ctx.m.head, z = H.faceZ, top = H.mouthY - 0.3 * H.t;
    ctx.box('jaw', -0.7 * H.s, H.y0 + 0.1, z - 0.35, 1.4 * H.s, top - H.y0 - 0.1, 1.2, it.keys.main);
    ctx.mirror(sd => ctx.boxCC('jaw', sd * 0.55 * H.s, H.mouthY + 0.42 * H.t, z - 0.1, 0.9 * H.s, 0.25 * H.t, 0.2, it.keys.mainFlat));
  },
});
registerAsset({
  id: 'facialhair_beard_full_01', slot: 'facialHair', label: { en: 'Full beard', ar: 'لحية كاملة' },
  description: 'Full beard covering the jaw, chin and cheeks up to the sideburns, with a mustache.', tags: ['beard', 'full beard', 'bearded'], colors: fhColor,
  build(ctx, it) {
    const H = ctx.m.head, l = H.layers[0], z = H.faceZ, k = it.keys.main, below = H.mouthY - 0.32 * H.t;
    ctx.box('jaw', -l.w * 0.4, H.y0 - 0.45, z - 0.35, l.w * 0.8, below - H.y0 + 0.45, 2.2, k);
    ctx.mirror(sd => {
      ctx.box('head', sd < 0 ? l.x - 0.25 : l.x + l.w - 0.9, H.y0 - 0.3, z + 0.1, 1.15, H.eyeY - 0.9 * H.t - H.y0 + 0.3, l.d * 0.55, k);
      ctx.boxCC('jaw', sd * 0.62 * H.s, H.mouthY + 0.42 * H.t, z - 0.2, 1.15 * H.s, 0.42 * H.t, 0.35, k);
    });
  },
});
registerAsset({
  id: 'facialhair_stubble_01', slot: 'facialHair', label: { en: 'Stubble', ar: 'لحية خفيفة' },
  description: 'Light stubble / five o\'clock shadow on the jaw and chin.', tags: ['stubble', 'shadow', 'unshaven'], colors: fhColor,
  build(ctx, it) {
    const H = ctx.m.head, l = H.layers[0], z = H.faceZ, k = it.keys.mainShade, y0 = Math.max(H.y0 + 0.05, l.y + 0.05);
    ctx.box('jaw', -l.w * 0.36, y0, z - 0.04, l.w * 0.72, H.mouthY - 0.2 * H.t - y0, 0.06, k);
  },
});

// ============================================================== FACE DETAILS (list, up to 6)
function detailAsset(def) { registerAsset({ slot: 'faceDetail', ...def }); }
const sidesOf = (it) => it.side === 'both' ? [-1, 1] : it.side === 'right' ? [1] : [-1];

detailAsset({
  id: 'detail_blush_01', label: { en: 'Blush', ar: 'احمرار الخدود' },
  description: 'Pink blush marks on both cheeks.', tags: ['blush', 'cheeks', 'cute', 'shy'],
  colors: [{ key: 'color', label: { en: 'Blush', ar: 'الاحمرار' }, default: '#F29AA5' }],
  build(ctx, it) { const H = ctx.m.head; ctx.mirror(sd => ctx.boxCC('head', sd * H.eyeX * 1.12, H.eyeY - 1.75 * H.t, H.faceZ - 0.04, 1.3 * H.s, 0.5 * H.t, 0.08, it.keys.mainFlat)); },
});
detailAsset({
  id: 'detail_freckles_01', label: { en: 'Freckles', ar: 'نمش' },
  description: 'Small freckle dots across the cheeks and nose.', tags: ['freckles', 'spots'],
  colors: [{ key: 'color', label: { en: 'Freckles', ar: 'النمش' }, default: '#B7714A' }],
  build(ctx, it) {
    const H = ctx.m.head, y = H.eyeY - 1.6 * H.t;
    for (const [x, dy] of [[-2.1, 0], [-1.6, -0.4], [-1.1, 0.1], [1.1, 0.1], [1.6, -0.4], [2.1, 0], [-0.3, 0.3], [0.3, 0.3]]) {
      ctx.boxCC('head', x * H.s, y + dy * H.t, H.faceZ - 0.04, 0.28, 0.28, 0.08, it.keys.mainFlat);
    }
  },
});
detailAsset({
  id: 'detail_scar_cheek_01', label: { en: 'Stitched scar under eye', ar: 'ندبة تحت العين' },
  description: 'A short stitched scar just under one eye (like a classic pirate-hero scar). Use side "left" or "right" (the character\'s own side).', tags: ['scar', 'stitches', 'under eye', 'cheek'],
  sides: ['left', 'right', 'both'], defaultSide: 'left',
  colors: [{ key: 'color', label: { en: 'Scar', ar: 'الندبة' }, default: '#7A3030' }],
  build(ctx, it) {
    const H = ctx.m.head, y = H.eyeY - 1.75 * H.t, z = H.faceZ - 0.05;
    for (const sd of sidesOf(it)) {
      const x = sd * H.eyeX;
      ctx.boxCC('head', x, y, z, 1.5 * H.s, 0.16 * H.t, 0.1, it.keys.mainFlat);
      for (const dx of [-0.5, 0, 0.5]) ctx.boxCC('head', x + dx * H.s, y, z - 0.02, 0.14, 0.5 * H.t, 0.1, it.keys.mainFlat);
    }
  },
});
detailAsset({
  id: 'detail_whiskers_01', label: { en: 'Whisker marks', ar: 'علامات شوارب' },
  description: 'Three thin horizontal whisker-like marks on each cheek (fox / ninja style).', tags: ['whiskers', 'cheek marks', 'lines', 'fox'],
  colors: [{ key: 'color', label: { en: 'Marks', ar: 'العلامات' }, default: '#3A2A22' }],
  build(ctx, it) {
    const H = ctx.m.head, y = H.eyeY - 1.9 * H.t;
    ctx.mirror(sd => { for (const dy of [0.45, 0, -0.45]) ctx.boxCC('head', sd * H.eyeX * 1.25, y + dy * H.t, H.faceZ - 0.04, 1.3 * H.s, 0.14 * H.t, 0.08, it.keys.mainFlat); });
  },
});
detailAsset({
  id: 'detail_bandage_01', label: { en: 'Cheek bandage', ar: 'لاصقة على الخد' },
  description: 'A small adhesive bandage on one cheek. Use side "left" or "right".', tags: ['bandage', 'plaster', 'band-aid', 'injury'],
  sides: ['left', 'right', 'both'], defaultSide: 'right',
  colors: [{ key: 'color', label: { en: 'Bandage', ar: 'اللاصقة' }, default: '#F1D2A8' }],
  build(ctx, it) {
    const H = ctx.m.head, y = H.eyeY - 1.8 * H.t, z = H.faceZ - 0.06;
    for (const sd of sidesOf(it)) {
      ctx.boxCC('head', sd * H.eyeX * 1.05, y, z, 1.6 * H.s, 0.6 * H.t, 0.12, it.keys.mainFlat);
      ctx.boxCC('head', sd * H.eyeX * 1.05, y, z - 0.03, 0.5 * H.s, 0.6 * H.t, 0.12, it.keys.mainShade);
    }
  },
});
