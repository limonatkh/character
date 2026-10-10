/* Hairstyles and headwear. Hair is built as an inflated "shell" around the
 * head-shape layers, so every style fits round, block and tall heads.
 * Hair boxes use { hair: true }: headwear clips them at its hat line. */
import { registerAsset } from '../core/registry.js';

const hairColor = (def, sec) => [
  { key: 'color', label: { en: 'Hair colour', ar: 'لون الشعر' }, default: def },
  ...(sec ? [{ key: 'secondaryColor', label: sec.label, default: sec.default }] : []),
];

/** y of the hairline: above the eyebrows / eyes, never above 90% of the head. */
function hairline(ctx) {
  const H = ctx.m.head;
  return Math.min(H.y0 + H.h * 0.9, Math.max(H.hairline, (ctx.faceTop || 0) + 0.15));
}

/**
 * Hair shell.
 *  inflate   how far hair stands off the head
 *  bangsY    bottom of the crown at the front (hairline)
 *  sideY     how far the sides come down (behind the face)
 *  backY     how far the back comes down (can be below the head = long hair)
 *  sideFront fraction of head depth where the sides start (smaller = closer to the face)
 */
function shell(ctx, key, o) {
  const H = ctx.m.head, i = o.inflate, L = H.layers, l1 = L[0], top = o.bangsY;
  for (const l of L) {
    const y0 = Math.max(l.y, top), y1 = l.y + l.h + i;
    if (y1 - y0 > 0.05) ctx.box('head', l.x - i, y0, l.z - i, l.w + 2 * i, y1 - y0, l.d + 2 * i, key, { hair: true });
  }
  if (o.sideY != null && o.sideY < top) {
    const zf = l1.z + l1.d * (o.sideFront ?? 0.3);
    ctx.box('head', l1.x - i, o.sideY, zf, l1.w + 2 * i, top - o.sideY + 0.01, l1.z + l1.d + i - zf, key, { hair: true });
  }
  if (o.backY != null) {
    const from = o.sideY != null ? Math.min(o.sideY, top) : top;
    if (o.backY < from) {
      const zb = l1.z + l1.d * 0.55, yA = Math.max(o.backY, H.y0 - 0.2);
      if (from - yA > 0.05) ctx.box('head', l1.x - i, yA, zb, l1.w + 2 * i, from - yA + 0.01, l1.z + l1.d + i - zb, key, { hair: true });
      if (o.backY < H.y0 - 0.2) {                       // long hair hangs behind the back
        const zEnd = l1.z + l1.d + i;
        const zStart = Math.min(ctx.m.torso.d / 2 + 0.55, zEnd - 0.8);
        const w = (l1.w + 2 * i) * (o.backWidth ?? 0.9);
        ctx.box('head', -w / 2, o.backY, zStart, w, H.y0 - 0.2 - o.backY + 0.02, zEnd - zStart, key, { hair: true });
      }
    }
  }
  ctx.hairInflate = Math.max(ctx.hairInflate || 0, i);
  ctx.hairTop = Math.max(ctx.hairTop || 0, H.y1 + i);
}

/** Front fringe pieces: [centreX (fraction of head width), width (fraction), length (px)]. */
function fringe(ctx, key, pieces, bangsY, i, minY) {
  const H = ctx.m.head, l1 = H.layers[0];
  for (const [fx, fw, len] of pieces) {
    const y0 = Math.max(bangsY - len, minY ?? -1e9);
    ctx.box('head', fx * H.w - fw * H.w / 2, y0, l1.z - i, fw * H.w, bangsY - y0 + 0.2, 1.3, key, { hair: true });
  }
}

registerAsset({
  id: 'hair_none', slot: 'hair', label: { en: 'Bald / none', ar: 'أصلع / بدون' },
  description: 'No hair (bald or fully covered).', tags: ['bald', 'none', 'shaved'],
  build() {},
});

registerAsset({
  id: 'hair_buzz_01', slot: 'hair', label: { en: 'Buzz cut', ar: 'قصة قصيرة جداً' },
  description: 'Very short buzz cut that hugs the head; a thin layer of hair with no volume.',
  tags: ['buzz', 'very short', 'military', 'crew cut'], colors: hairColor('#2B2118'),
  build(ctx, it) {
    const H = ctx.m.head;
    shell(ctx, it.keys.main, { inflate: 0.12, bangsY: hairline(ctx), sideY: H.eyeY + 0.3 * H.t, backY: H.y0 + 0.2 * H.h });
  },
});

registerAsset({
  id: 'hair_short_01', slot: 'hair', label: { en: 'Short', ar: 'قصير' },
  description: 'Neat short hair with a small fringe; sides cover the top of the ears. Everyday hairstyle.',
  tags: ['short', 'neat', 'everyday', 'fringe'], colors: hairColor('#3A2A1E'),
  build(ctx, it) {
    const H = ctx.m.head, hl = hairline(ctx), k = it.keys.main;
    shell(ctx, k, { inflate: 0.3, bangsY: hl, sideY: H.eyeY, backY: H.y0 + 0.22 * H.h });
    fringe(ctx, k, [[-0.28, 0.2, 0.5 * H.t], [-0.08, 0.22, 0.8 * H.t], [0.14, 0.2, 0.55 * H.t], [0.32, 0.16, 0.35 * H.t]], hl, 0.3, (ctx.eyeTop || 0) + 0.05);
  },
});

registerAsset({
  id: 'hair_spiky_01', slot: 'hair', label: { en: 'Spiky / messy', ar: 'شائك / منكوش' },
  description: 'Short messy anime hair with spikes on top and the back, and pointed bangs hanging over the forehead (energetic shonen hero look).',
  tags: ['spiky', 'messy', 'anime', 'shonen', 'short', 'bangs'], colors: hairColor('#1E1E22'),
  build(ctx, it) {
    const H = ctx.m.head, hl = hairline(ctx), k = it.keys.main, s = H.s, t = H.t, i = 0.3;
    shell(ctx, k, { inflate: i, bangsY: hl, sideY: H.eyeY + 0.2 * t, backY: H.y0 + 0.25 * H.h });
    const top = H.y1 + i - 0.2;
    // spikes on the crown: [x, z (fractions), size, height]
    for (const [fx, fz, sz, h] of [[-0.25, -0.18, 1.7, 1.3], [0.05, -0.25, 1.9, 1.7], [0.3, -0.05, 1.5, 1.2], [-0.1, 0.15, 1.9, 1.5], [0.2, 0.3, 1.6, 1.0], [-0.32, 0.25, 1.4, 1.0]]) {
      const x = fx * H.w, z = fz * H.d;
      ctx.boxC('head', x, top - 0.6, z, sz * s, (h + 0.6) * t, sz * s, k, { hair: true });
      ctx.boxC('head', x + 0.15 * s, top + h * t - 0.05, z, sz * 0.5 * s, 0.7 * t, sz * 0.5 * s, k, { hair: true });
    }
    // spikes poking out of the back
    const back = H.layers[0].z + H.layers[0].d + i;
    for (const [fx, fy, len] of [[-0.25, 0.55, 1.0], [0.15, 0.62, 1.3], [-0.05, 0.38, 1.1], [0.3, 0.42, 0.8]]) {
      ctx.box('head', fx * H.w - 0.7 * s, H.y0 + fy * H.h, back - 0.4, 1.4 * s, 1.1 * t, len + 0.4, k, { hair: true });
    }
    // pointed bangs
    const minY = (ctx.eyeTop || 0) + 0.05, z0 = H.layers[0].z - i;
    for (const [fx, len] of [[-0.27, 1.2], [-0.04, 1.6], [0.2, 1.3], [0.36, 0.8]]) {
      const x = fx * H.w;
      const yA = Math.max(hl - len * 0.55 * t, minY), yB = Math.max(hl - len * t, minY);
      ctx.box('head', x - 0.7 * s, yA, z0, 1.4 * s, hl - yA + 0.2, 1.2, k, { hair: true });
      if (yB < yA - 0.05) ctx.box('head', x - 0.32 * s, yB, z0, 0.64 * s, yA - yB + 0.05, 1.2, k, { hair: true });
    }
  },
});

registerAsset({
  id: 'hair_long_01', slot: 'hair', label: { en: 'Long straight', ar: 'طويل ناعم' },
  description: 'Long straight hair parted in the middle, falling past the shoulders at the back.',
  tags: ['long', 'straight', 'middle part', 'flowing'], colors: hairColor('#4A2E1C'),
  build(ctx, it) {
    const H = ctx.m.head, hl = hairline(ctx), k = it.keys.main, i = 0.38;
    shell(ctx, k, { inflate: i, bangsY: hl, sideY: H.y0 + 0.05 * H.h, sideFront: 0.2, backY: H.y0 - 4.2 });
    fringe(ctx, k, [[-0.27, 0.42, 0.7 * H.t], [0.27, 0.42, 0.7 * H.t]], hl, i, (ctx.eyeTop || 0) + 0.1);
  },
});

registerAsset({
  id: 'hair_bob_01', slot: 'hair', label: { en: 'Bob with bangs', ar: 'بوب مع غرّة' },
  description: 'Chin-length bob haircut with straight bangs cut across the forehead.',
  tags: ['bob', 'bangs', 'chin length', 'straight fringe'], colors: hairColor('#20140E'),
  build(ctx, it) {
    const H = ctx.m.head, hl = hairline(ctx), k = it.keys.main, i = 0.42;
    shell(ctx, k, { inflate: i, bangsY: hl, sideY: H.y0 + 0.12 * H.h, sideFront: 0.24, backY: H.y0 + 0.1 * H.h });
    fringe(ctx, k, [[0, 0.86, 1.1 * H.t]], hl, i, (ctx.eyeTop || 0) + 0.1);
  },
});

registerAsset({
  id: 'hair_ponytail_01', slot: 'hair', label: { en: 'Ponytail', ar: 'ذيل حصان' },
  description: 'Hair pulled back into a ponytail at the back of the head, tied with a band (secondary colour).',
  tags: ['ponytail', 'tied back', 'sporty'],
  colors: hairColor('#3A2414', { label: { en: 'Hair tie', ar: 'ربطة الشعر' }, default: '#D94B5C' }),
  build(ctx, it) {
    const H = ctx.m.head, hl = hairline(ctx), k = it.keys.main, i = 0.3, s = H.s, t = H.t;
    shell(ctx, k, { inflate: i, bangsY: hl, sideY: H.eyeY + 0.1 * t, backY: H.y0 + 0.3 * H.h });
    fringe(ctx, k, [[-0.2, 0.45, 0.6 * t]], hl, i, (ctx.eyeTop || 0) + 0.1);
    const back = H.layers[0].z + H.layers[0].d + i, y = H.y0 + 0.66 * H.h;
    ctx.boxC('head', 0, y - 0.5 * t, back - 0.2, 1.3 * s, 1.0 * t, 0.9, it.keys.sec, { hair: true });
    ctx.boxC('head', 0, y - 2.3 * t, back + 0.75, 1.5 * s, 2.4 * t, 1.3, k, { hair: true });
    ctx.boxC('head', 0, y - 4.0 * t, back + 0.95, 1.2 * s, 1.9 * t, 1.1, k, { hair: true });
    ctx.boxC('head', 0, y - 5.0 * t, back + 1.05, 0.8 * s, 1.2 * t, 0.8, k, { hair: true });
  },
});

registerAsset({
  id: 'hair_bun_01', slot: 'hair', label: { en: 'Top bun', ar: 'كعكة' },
  description: 'Hair gathered into a round bun on top/back of the head, with a hair tie (secondary colour).',
  tags: ['bun', 'top knot', 'tied up'],
  colors: hairColor('#2A1A12', { label: { en: 'Hair tie', ar: 'ربطة الشعر' }, default: '#E0B13B' }),
  build(ctx, it) {
    const H = ctx.m.head, hl = hairline(ctx), k = it.keys.main, i = 0.3, s = H.s, t = H.t;
    shell(ctx, k, { inflate: i, bangsY: hl, sideY: H.eyeY + 0.2 * t, backY: H.y0 + 0.28 * H.h });
    const z = H.d * 0.14, y = H.y1 + i - 0.2;
    ctx.boxC('head', 0, y - 0.1, z, 1.7 * s, 0.6 * t, 1.7 * s, it.keys.sec, { hair: true });
    ctx.boxC('head', 0, y + 0.4 * t, z, 2.5 * s, 2.0 * t, 2.5 * s, k, { hair: true });
    ctx.boxC('head', 0, y + 0.7 * t, z, 2.9 * s, 1.3 * t, 2.0 * s, k, { hair: true });
    ctx.hairTop = Math.max(ctx.hairTop, y + 2.4 * t);
  },
});

registerAsset({
  id: 'hair_afro_01', slot: 'hair', label: { en: 'Afro / big curly', ar: 'أفرو / مجعد كبير' },
  description: 'Big round voluminous curly hair (afro) standing far off the head.',
  tags: ['afro', 'curly', 'big', 'volume', 'round'], colors: hairColor('#1C1410'),
  build(ctx, it) {
    const H = ctx.m.head;
    shell(ctx, it.keys.main, { inflate: 1.15, bangsY: hairline(ctx) + 0.2, sideY: H.eyeY - 0.2 * H.t, sideFront: 0.38, backY: H.y0 + 0.15 * H.h });
  },
});

registerAsset({
  id: 'hair_mohawk_01', slot: 'hair', label: { en: 'Mohawk', ar: 'موهوك' },
  description: 'Tall strip of hair running front-to-back over the middle of the head, with shaved sides (secondary colour = shaved stubble).',
  tags: ['mohawk', 'punk', 'shaved sides', 'tall'],
  colors: hairColor('#D93A2B', { label: { en: 'Shaved sides', ar: 'الجوانب المحلوقة' }, default: '#4A3A30' }),
  build(ctx, it) {
    const H = ctx.m.head, k = it.keys.main, s = H.s, t = H.t, L3 = H.layers[H.layers.length - 1];
    shell(ctx, it.keys.secFlat, { inflate: 0.06, bangsY: hairline(ctx), sideY: H.eyeY + 0.4 * t, backY: H.y0 + 0.25 * H.h });
    const z0 = H.layers[0].z - 0.1, z1 = H.layers[0].z + H.layers[0].d + 0.4, len = z1 - z0;
    for (const [a, b, h] of [[0, 0.3, 1.6], [0.25, 0.65, 2.6], [0.6, 1, 2.0]]) {
      ctx.box('head', -0.75 * s, H.y1 - 1.5 * t, z0 + a * len, 1.5 * s, (1.5 + h) * t, (b - a) * len, k, { hair: true });
    }
    ctx.hairInflate = 0.1;
    ctx.hairTop = H.y1 + 2.6 * t;
  },
});

registerAsset({
  id: 'hair_tuft_01', slot: 'hair', label: { en: 'Limonat tuft', ar: 'خصلة ليمونات' },
  description: 'The Limonat hero\'s single spiky tuft sweeping up and to the right out of the top of the head or hat; no other visible hair.',
  tags: ['tuft', 'cowlick', 'limonat', 'spike', 'single lock'], colors: hairColor('#F7F7F5'),
  build(ctx, it) {
    const H = ctx.m.head, s = H.s, t = H.t;
    const base = ctx.hat ? ctx.hat.topY - 0.25 : H.y1 - 0.15;
    const m = it.keys.main, sh = it.keys.mainShade;
    for (const [x, y, z, w, h, d, k] of [
      [-0.2, 0, -0.6, 1.7, 1.5, 1.2, m], [0.9, 0.9, -0.55, 1.6, 1.3, 1.1, m], [2.0, 1.6, -0.5, 1.5, 1.0, 1.0, m],
      [3.1, 2.1, -0.4, 1.0, 0.8, 0.8, m], [0.3, 1.4, -0.45, 1.0, 1.1, 0.9, m], [1.3, 0.1, -0.5, 1.5, 0.8, 1.0, sh],
      [2.5, -0.4, -0.4, 1.2, 0.6, 0.8, sh], [3.4, -0.8, -0.3, 0.7, 0.5, 0.6, sh], [-1.1, 0.9, -0.35, 0.8, 0.9, 0.8, m],
    ]) ctx.box('head', x * s, base + y * t, z * s, w * s, h * t, d * s, k);
    ctx.hairTop = base + 2.9 * t;
  },
});

// ====================================================================== HEADWEAR
const hatColors = (main, sec, secLabel) => [
  { key: 'color', label: { en: 'Hat colour', ar: 'لون القبعة' }, default: main },
  ...(sec ? [{ key: 'secondaryColor', label: secLabel, default: sec }] : []),
];
/** Box per head layer above y, inflated by i (makes a hat crown that follows the head shape). */
function crown(ctx, key, y, i) {
  for (const l of ctx.m.head.layers) {
    const y0 = Math.max(l.y, y), y1 = l.y + l.h + i;
    if (y1 - y0 > 0.05) ctx.box('head', l.x - i, y0, l.z - i, l.w + 2 * i, y1 - y0, l.d + 2 * i, key);
  }
}

registerAsset({
  id: 'hat_none', slot: 'headwear', label: { en: 'None', ar: 'بدون' },
  description: 'No hat or headwear.', tags: ['none', 'bare head'], build() {},
});

registerAsset({
  id: 'hat_beanie_01', slot: 'headwear', label: { en: 'Beanie (Limonat)', ar: 'طاقية صوف (ليمونات)' },
  description: 'Snug knitted beanie covering the top of the head down to the eyebrows, with a small knot on top (the Limonat hero\'s black beanie).',
  tags: ['beanie', 'knit cap', 'winter hat', 'limonat'], colors: hatColors('#161616'),
  hatInfo: (m) => ({ lineY: m.head.y0 + m.head.h * 0.686, topY: m.head.y1 + 0.15 + 0.85 * m.head.t, clip: true }),
  build(ctx, it) {
    const H = ctx.m.head;
    crown(ctx, it.keys.main, ctx.hat.lineY, 0.15);
    ctx.boxC('head', 0.4 * H.s, H.y1, -0.05, 1.6 * H.s, 0.9 * H.t, 1.4 * H.s, it.keys.main);
  },
});

registerAsset({
  id: 'hat_cap_01', slot: 'headwear', label: { en: 'Baseball cap', ar: 'كاب' },
  description: 'Baseball cap with a front brim (secondary colour = brim).',
  tags: ['cap', 'baseball cap', 'sporty', 'brim'], colors: hatColors('#2F5FD0', '#1E3A8A', { en: 'Brim', ar: 'الحافة' }),
  hatInfo: (m) => ({ lineY: m.head.y0 + m.head.h * 0.7, topY: m.head.y1 + 0.5, clip: true }),
  build(ctx, it) {
    const H = ctx.m.head, l1 = H.layers[0], y = ctx.hat.lineY;
    crown(ctx, it.keys.main, y, 0.2);
    ctx.box('head', -l1.w * 0.42, y - 0.05, l1.z - 0.2 - 2.5 * H.s, l1.w * 0.84, 0.35, 2.5 * H.s + 1.4, it.keys.sec);
    ctx.boxC('head', 0, H.y1 + 0.15, 0, 0.7, 0.35, 0.7, it.keys.sec);
    ctx.box('head', -l1.w / 2 - 0.25, y, l1.z - 0.24, l1.w + 0.5, 0.18, 0.1, it.keys.mainDark);
  },
});

registerAsset({
  id: 'hat_straw_01', slot: 'headwear', label: { en: 'Straw hat', ar: 'قبعة قش' },
  description: 'Wide-brimmed straw hat with a coloured band around the crown (secondary colour = band). The classic pirate-hero straw hat.',
  tags: ['straw hat', 'sun hat', 'wide brim', 'pirate'], colors: hatColors('#E6C35C', '#C62E2E', { en: 'Band', ar: 'الشريط' }),
  hatInfo: (m) => ({ lineY: m.head.y0 + m.head.h * 0.74, topY: m.head.y1 + 0.9 * m.head.t, clip: true }),
  build(ctx, it) {
    const H = ctx.m.head, [l1, l2] = H.layers, y = ctx.hat.lineY, s = H.s;
    const c = (l, i, y0, y1, k) => ctx.box('head', l.x - i, y0, l.z - i, l.w + 2 * i, y1 - y0, l.d + 2 * i, k);
    c(l1, 0.35, y, H.y1 + 0.3, it.keys.main);
    c(l2 || l1, 0.35, y, H.y1 + 0.9 * H.t, it.keys.main);
    c(l1, 0.43, y + 0.3, y + 1.0 * H.t, it.keys.sec);
    const r = 2.3 * s;
    ctx.box('head', l1.x - r, y - 0.05, l1.z - r, l1.w + 2 * r, 0.35, l1.d + 2 * r, it.keys.main);
    ctx.box('head', l1.x - r + 0.05, y - 0.12, l1.z - r + 0.05, l1.w + 2 * r - 0.1, 0.1, l1.d + 2 * r - 0.1, it.keys.mainShade);
  },
});

registerAsset({
  id: 'hat_headband_01', slot: 'headwear', label: { en: 'Headband / bandana', ar: 'عصابة رأس' },
  description: 'Cloth band tied around the forehead with tails at the back; optional front plate (secondary colour). Ninja headband, sports band or tied bandana.',
  tags: ['headband', 'bandana', 'ninja', 'sweatband'], colors: hatColors('#2D3A8C', '#AEB6C2', { en: 'Front plate', ar: 'اللوحة الأمامية' }),
  build(ctx, it) {
    const H = ctx.m.head, l1 = H.layers[0], t = H.t, s = H.s;
    const i = (ctx.hairInflate || 0) + 0.12;
    const y = Math.min(H.y0 + 0.8 * H.h, Math.max(H.y0 + 0.66 * H.h, (ctx.faceTop || 0) + 0.08));
    ctx.box('head', l1.x - i, y, l1.z - i, l1.w + 2 * i, 0.85 * t, l1.d + 2 * i, it.keys.main);
    ctx.box('head', -1.5 * s, y + 0.08, l1.z - i - 0.12, 3.0 * s, 0.7 * t, 0.15, it.keys.sec);
    const back = l1.z + l1.d + i;
    ctx.box('head', 0.2 * s, y - 1.6 * t, back - 0.05, 0.7 * s, 2.2 * t, 0.3, it.keys.main);
    ctx.box('head', -0.9 * s, y - 1.2 * t, back + 0.05, 0.7 * s, 1.8 * t, 0.3, it.keys.main);
  },
});

registerAsset({
  id: 'hat_tophat_01', slot: 'headwear', label: { en: 'Top hat', ar: 'قبعة طويلة' },
  description: 'Tall formal top hat with a narrow brim and a band (secondary colour). Magicians, gentlemen, villains.',
  tags: ['top hat', 'formal', 'tall hat', 'magician'], colors: hatColors('#1E1E22', '#8E2B2B', { en: 'Band', ar: 'الشريط' }),
  hatInfo: (m) => ({ lineY: m.head.y0 + m.head.h * 0.8, topY: m.head.y0 + m.head.h * 0.8 + 4.2 * m.head.t, clip: true }),
  build(ctx, it) {
    const H = ctx.m.head, l1 = H.layers[0], y = ctx.hat.lineY, t = H.t;
    ctx.box('head', l1.x - 1.1, y - 0.05, l1.z - 1.1, l1.w + 2.2, 0.3, l1.d + 2.2, it.keys.main);
    const w = l1.w * 0.9, d = l1.d * 0.9;
    ctx.box('head', -w / 2, y, -d / 2, w, 4.2 * t, d, it.keys.main);
    ctx.box('head', -w / 2 - 0.06, y + 0.25, -d / 2 - 0.06, w + 0.12, 0.75 * t, d + 0.12, it.keys.sec);
  },
});
