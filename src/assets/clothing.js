/* Clothing: tops, outerwear, bottoms and shoes. Each garment is built from the
 * body measurements with a "pad" (how far it stands off the body), so the same
 * asset fits thin toon limbs and thick block limbs. Layers: skin < top (0.12)
 * < outerwear (0.3). Limonat style details: ink hem lines and side shading. */
import { registerAsset } from '../core/registry.js';

const PAD_TOP = 0.12, PAD_OUT = 0.3, PAD_BOTTOM = 0.12;
const mainColors = (label, main, sec, secLabel) => [
  { key: 'color', label, default: main },
  ...(sec ? [{ key: 'secondaryColor', label: secLabel, default: sec }] : []),
];
const L = { top: { en: 'Shirt colour', ar: 'لون القميص' }, outer: { en: 'Jacket colour', ar: 'لون الجاكيت' }, bottom: { en: 'Trousers colour', ar: 'لون البنطلون' }, shoes: { en: 'Shoe colour', ar: 'لون الحذاء' } };

// ------------------------------------------------------------------ helpers
export const limbSize = (core, cloth, pad) => Math.max(core + 2 * pad, cloth + 2 * (pad - PAD_TOP));
const sleeveW = (m, pad) => limbSize(m.arm.w, m.arm.clothW, pad);
const sleeveD = (m, pad) => limbSize(m.arm.d, m.arm.clothD, pad);
const legW = (m, pad) => limbSize(m.leg.w, m.leg.clothW, pad);
const legD = (m, pad) => limbSize(m.leg.d, m.leg.clothD, pad);
const grow = (ctx, region, pad) => { ctx.layers[region] = Math.max(ctx.layers[region], pad); };

/** Closed torso garment: lower (spine) + chest boxes, ink hem, side shading. */
function torsoClosed(ctx, k, pad, o = {}) {
  const m = ctx.m, T = m.torso;
  const yLow = o.yLow ?? m.hipY + 0.35, y1 = T.y1 + 0.05;
  const wl = (o.wLow ?? T.wLow) + 2 * pad, wc = (o.wChest ?? T.w) + 2 * pad, d = T.d + 2 * pad;
  ctx.boxC('spine', 0, yLow, 0, wl, T.yMid - yLow + 0.02, d, k.main);
  ctx.boxC('chest', 0, T.yMid, 0, wc, y1 - T.yMid, d, k.main);
  if (o.hem !== false) ctx.boxC('spine', 0, yLow - 0.02, 0, wl + 0.08, 0.14, d + 0.08, 'ink');
  ctx.box('spine', wl / 2 - 0.04, yLow + 0.18, -d / 2 + 0.1, 0.1, T.yMid - yLow - 0.15, d - 0.2, k.mainShade);
  ctx.box('chest', wc / 2 - 0.04, T.yMid, -d / 2 + 0.1, 0.1, y1 - T.yMid - 0.3, d - 0.2, k.mainShade);
  grow(ctx, 'torso', pad);
  return { yLow, y1, wl, wc, d, front: -d / 2 };
}

/** Open-front torso garment (jacket, vest, coat): two front panels + back, gap in the middle. */
function torsoOpen(ctx, k, pad, gap, o = {}) {
  const m = ctx.m, T = m.torso;
  const yLow = o.yLow ?? m.hipY - 0.3, y1 = T.y1 + 0.08, d = T.d + 2 * pad;
  for (const [joint, y0, yTop, w0] of [['spine', yLow, T.yMid + 0.02, T.wLow], ['chest', T.yMid, y1, T.w]]) {
    const w = w0 + 2 * pad, g = Math.min(gap, w - 1.2);
    ctx.box(joint, -w / 2, y0, -d / 2, w / 2 - g / 2, yTop - y0, d, k.main);
    ctx.box(joint, g / 2, y0, -d / 2, w / 2 - g / 2, yTop - y0, d, k.main);
    ctx.box(joint, -g / 2 - 0.01, y0, -d / 2 + 0.7, g + 0.02, yTop - y0, d - 0.7, k.main);
    ctx.box(joint, w / 2 - 0.04, y0 + 0.15, -d / 2 + 0.1, 0.1, yTop - y0 - 0.3, d - 0.2, k.mainShade);
  }
  ctx.boxC('spine', 0, yLow - 0.02, 0, T.wLow + 2 * pad + 0.08, 0.14, d + 0.08, 'ink');
  grow(ctx, 'torso', pad);
  return { yLow, y1, d, front: -d / 2, gap };
}

/** Sleeves. len: 'short' | 'elbow' | 'long'. */
function sleeves(ctx, k, pad, len, cuffKey) {
  const m = ctx.m, w = sleeveW(m, pad), d = sleeveD(m, pad);
  ctx.mirror((s, side) => {
    const x = s * m.shoulderX, top = m.shoulderY + 0.5;
    const bottom = len === 'short' ? m.shoulderY - m.arm.upper * 0.62 : m.elbowY - 0.05;
    ctx.boxC(side + 'UpperArm', x, bottom, 0, w, top - bottom, d, k.main);
    ctx.box(side + 'UpperArm', x + s * (w / 2) - (s > 0 ? 0.06 : 0.04), bottom + 0.15, -d / 2 + 0.1, 0.1, top - bottom - 0.3, d - 0.2, k.mainShade);
    if (len === 'long') {
      ctx.boxC(side + 'LowerArm', x, m.wristY + 0.1, 0, w * 0.97, m.elbowY - m.wristY + 0.05, d * 0.97, k.main);
      ctx.boxC(side + 'LowerArm', x, m.wristY + 0.02, 0, w + 0.12, 0.45, d + 0.12, cuffKey || k.mainShade);
    } else {
      ctx.boxC(side + 'UpperArm', x, bottom - 0.02, 0, w + 0.08, 0.14, d + 0.08, 'ink');
    }
  });
  grow(ctx, 'arms', pad);
}

/** Waist of trousers / shorts on the hips joint. */
function waist(ctx, k, pad) {
  const m = ctx.m, T = m.torso;
  ctx.boxC('hips', 0, m.hipY - 0.9, 0, T.wLow + 2 * pad, 1.55, T.d + 2 * pad, k.main);
  ctx.box('hips', -0.05, m.hipY - 0.9, -T.d / 2 - pad - 0.06, 0.1, 1.0, 0.1, 'ink');   // centre seam (Limonat shorts)
  grow(ctx, 'waist', pad);
}

/** Trouser legs down to endY (absolute). */
function trouserLegs(ctx, k, pad, endY, cuffKey) {
  const m = ctx.m, w = legW(m, pad), d = legD(m, pad);
  ctx.mirror((s, side) => {
    const x = s * m.hipX, top = m.hipY + 0.3;
    const shade = (joint, y0, h) => ctx.box(joint, x + s * (w / 2) - (s > 0 ? 0.06 : 0.04), y0 + 0.1, -d / 2 + 0.05, 0.1, h - 0.2, d - 0.1, k.mainShade);
    if (endY >= m.kneeY - 0.1) {
      ctx.boxC(side + 'UpperLeg', x, endY, 0, w, top - endY, d, k.main);
      shade(side + 'UpperLeg', endY, top - endY);
      ctx.boxC(side + 'UpperLeg', x, endY - 0.02, 0, w + 0.08, 0.14, d + 0.08, cuffKey || 'ink');
    } else {
      ctx.boxC(side + 'UpperLeg', x, m.kneeY - 0.05, 0, w, top - m.kneeY + 0.05, d, k.main);
      shade(side + 'UpperLeg', m.kneeY, top - m.kneeY);
      ctx.boxC(side + 'LowerLeg', x, endY, 0, w * 0.97, m.kneeY - endY + 0.05, d * 0.97, k.main);
      shade(side + 'LowerLeg', endY, m.kneeY - endY);
      ctx.boxC(side + 'LowerLeg', x, endY - 0.02, 0, w + 0.1, cuffKey ? 0.45 : 0.14, d + 0.1, cuffKey || 'ink');
    }
  });
  grow(ctx, 'legs', pad);
}

// ================================================================== TOPS
registerAsset({ id: 'top_none', slot: 'top', label: { en: 'None (bare torso)', ar: 'بدون (صدر عاري)' }, description: 'No shirt; bare skin torso (use with an open vest or jacket for an open-chest look).', tags: ['none', 'shirtless', 'bare chest'], build() {} });

registerAsset({
  id: 'top_tshirt_01', slot: 'top', label: { en: 'T-shirt', ar: 'تيشيرت' },
  description: 'Plain crew-neck T-shirt with short sleeves.', tags: ['t-shirt', 'tee', 'crew neck', 'short sleeves', 'casual'],
  colors: mainColors(L.top, '#3B82C4'), material: 'cloth',
  build(ctx, it) {
    const k = it.keys, m = ctx.m, T = m.torso;
    const t = torsoClosed(ctx, k, PAD_TOP);
    sleeves(ctx, k, PAD_TOP, 'short');
    ctx.boxC('chest', 0, T.y1 - 0.45, t.front - 0.02, Math.min(2.2, T.w * 0.45), 0.5, 0.12, k.mainDark);   // collar
  },
});

registerAsset({
  id: 'top_vneck_01', slot: 'top', label: { en: 'V-neck tee (Limonat)', ar: 'تيشيرت بفتحة V (ليمونات)' },
  description: 'Short-sleeve T-shirt with a V-neck collar (the Limonat hero\'s white shirt).', tags: ['v-neck', 't-shirt', 'short sleeves', 'limonat'],
  colors: mainColors(L.top, '#F4F3EF'), material: 'cloth',
  build(ctx, it) {
    const k = it.keys, T = ctx.m.torso;
    const t = torsoClosed(ctx, k, PAD_TOP);
    sleeves(ctx, k, PAD_TOP, 'short');
    const z = t.front - 0.08, y = T.y1 - 0.2;
    for (const [x, dy] of [[-1.2, 0], [0.4, 0], [-0.8, -0.5], [0.1, -0.5], [-0.35, -0.95]]) ctx.box('chest', x + 0.05, y + dy - 0.45, z, x < -0.5 || x > 0.2 ? 0.8 : 0.7, 0.5, 0.15, k.mainShade);
  },
});

registerAsset({
  id: 'top_tank_01', slot: 'top', label: { en: 'Tank top', ar: 'شيال' },
  description: 'Sleeveless tank top / singlet with bare shoulders and arms.', tags: ['tank top', 'sleeveless', 'singlet', 'vest top'],
  colors: mainColors(L.top, '#F2F2F2'), material: 'cloth',
  build(ctx, it) {
    const k = it.keys, T = ctx.m.torso;
    const t = torsoClosed(ctx, k, PAD_TOP, { wChest: T.w * 0.78 });
    ctx.boxC('chest', 0, T.y1 - 0.6, t.front - 0.02, T.w * 0.3, 0.65, 0.12, ctx.skin.main);   // scoop neck
  },
});

registerAsset({
  id: 'top_longsleeve_01', slot: 'top', label: { en: 'Long-sleeve shirt', ar: 'قميص بأكمام طويلة' },
  description: 'Plain long-sleeve shirt / sweater with cuffs at the wrists.', tags: ['long sleeves', 'sweater', 'jumper', 'pullover'],
  colors: mainColors(L.top, '#6B4FA0'), material: 'cloth',
  build(ctx, it) {
    const k = it.keys, T = ctx.m.torso;
    const t = torsoClosed(ctx, k, PAD_TOP);
    sleeves(ctx, k, PAD_TOP, 'long');
    ctx.boxC('chest', 0, T.y1 - 0.45, t.front - 0.02, Math.min(2.2, T.w * 0.45), 0.5, 0.12, k.mainShade);
  },
});

registerAsset({
  id: 'top_collar_shirt_01', slot: 'top', label: { en: 'Collared shirt', ar: 'قميص بياقة' },
  description: 'Button-up shirt with a pointed collar, a button line and long sleeves (secondary colour = collar and buttons). Formal or school shirt.',
  tags: ['button-up', 'dress shirt', 'collar', 'formal', 'school uniform'],
  colors: mainColors(L.top, '#F5F5F0', '#D8DCE2', { en: 'Collar & buttons', ar: 'الياقة والأزرار' }), material: 'cloth',
  build(ctx, it) {
    const k = it.keys, T = ctx.m.torso;
    const t = torsoClosed(ctx, k, PAD_TOP);
    sleeves(ctx, k, PAD_TOP, 'long', k.sec);
    const z = t.front - 0.1;
    ctx.mirror(s => {
      ctx.box('chest', s < 0 ? -1.25 : 0.1, T.y1 - 0.75, z, 1.15, 0.6, 0.18, k.sec);
      ctx.box('chest', s < 0 ? -0.75 : 0.1, T.y1 - 1.2, z, 0.65, 0.5, 0.18, k.sec);
    });
    for (let y = t.yLow + 0.6; y < T.y1 - 1.3; y += 1.2) ctx.boxC('chest', 0, y, t.front - 0.04, 0.3, 0.3, 0.1, k.secDark);
    ctx.box('spine', -0.05, t.yLow + 0.1, t.front - 0.03, 0.1, T.y1 - t.yLow - 1.3, 0.08, k.mainShade);
  },
});

registerAsset({
  id: 'top_striped_01', slot: 'top', label: { en: 'Striped tee', ar: 'تيشيرت مخطط' },
  description: 'Short-sleeve T-shirt with wide horizontal stripes (secondary colour = stripes). Sailor / casual striped shirt.',
  tags: ['striped', 'stripes', 'sailor', 'breton', 't-shirt'],
  colors: mainColors(L.top, '#F4F4F4', '#2A4B8D', { en: 'Stripes', ar: 'الخطوط' }), material: 'cloth',
  build(ctx, it) {
    const k = it.keys, m = ctx.m, T = m.torso;
    const t = torsoClosed(ctx, k, PAD_TOP);
    sleeves(ctx, k, PAD_TOP, 'short');
    const h = (T.y1 - t.yLow) / 7;
    for (let i = 1; i < 7; i += 2) {
      const y = t.yLow + i * h, joint = y + h / 2 < T.yMid ? 'spine' : 'chest', w = (joint === 'spine' ? t.wl : t.wc) + 0.06;
      ctx.boxC(joint, 0, y, 0, w, h * 0.9, t.d + 0.06, k.secFlat);
    }
  },
});

// ================================================================== OUTERWEAR
registerAsset({ id: 'outer_none', slot: 'outerwear', label: { en: 'None', ar: 'بدون' }, description: 'No jacket or outer layer.', tags: ['none'], build() {} });

registerAsset({
  id: 'outer_jacket_open_01', slot: 'outerwear', label: { en: 'Open jacket', ar: 'جاكيت مفتوح' },
  description: 'Long-sleeve jacket worn open, showing the shirt underneath, with lapels (secondary colour = lapels / lining). Blazer, open hoodie-less jacket, open coat.',
  tags: ['jacket', 'open', 'blazer', 'lapels', 'long sleeves'],
  colors: mainColors(L.outer, '#2B2F3A', '#1B1E26', { en: 'Lapels', ar: 'طيّة الصدر' }), material: 'cloth',
  build(ctx, it) {
    const k = it.keys, T = ctx.m.torso, gap = Math.max(1.3, T.w * 0.32);
    const t = torsoOpen(ctx, k, PAD_OUT, gap);
    sleeves(ctx, k, PAD_OUT, 'long');
    ctx.mirror(s => ctx.box('chest', s < 0 ? -gap / 2 - 0.7 : gap / 2, T.yMid + 0.6, t.front - 0.08, 0.7, T.y1 - T.yMid - 0.5, 0.16, k.sec));
  },
});

registerAsset({
  id: 'outer_jacket_closed_01', slot: 'outerwear', label: { en: 'Zip jacket (closed)', ar: 'جاكيت بسحّاب (مسكّر)' },
  description: 'Closed zip-up jacket or windbreaker with a zipper line, collar band and two pockets (secondary colour = zipper and collar).',
  tags: ['jacket', 'zip', 'windbreaker', 'track jacket', 'bomber', 'closed'],
  colors: mainColors(L.outer, '#D92F35', '#F2F2F2', { en: 'Zip & collar', ar: 'السحّاب والياقة' }), material: 'cloth',
  build(ctx, it) {
    const k = it.keys, m = ctx.m, T = m.torso;
    const t = torsoClosed(ctx, k, PAD_OUT, { yLow: m.hipY - 0.2 });
    sleeves(ctx, k, PAD_OUT, 'long', k.sec);
    ctx.box('spine', -0.08, t.yLow + 0.1, t.front - 0.06, 0.16, T.yMid - t.yLow, 0.12, k.sec);
    ctx.box('chest', -0.08, T.yMid - 0.05, t.front - 0.06, 0.16, T.y1 - T.yMid, 0.12, k.sec);
    ctx.boxC('chest', 0, T.y1 - 0.25, 0, T.w * 0.62, 0.7, t.d + 0.15, k.sec);
    ctx.mirror(s => ctx.boxC('spine', s * T.wLow * 0.27, t.yLow + 0.5, t.front - 0.03, 1.0, 0.9, 0.08, k.mainShade));
  },
});

registerAsset({
  id: 'outer_hoodie_01', slot: 'outerwear', label: { en: 'Hoodie', ar: 'هودي' },
  description: 'Pullover hoodie with the hood down at the back of the neck, a front pocket and drawstrings (secondary colour = drawstrings / lining).',
  tags: ['hoodie', 'hooded sweatshirt', 'pullover', 'streetwear'],
  colors: mainColors(L.outer, '#8A8F99', '#F2F2F2', { en: 'Drawstrings', ar: 'الأربطة' }), material: 'cloth',
  build(ctx, it) {
    const k = it.keys, m = ctx.m, T = m.torso;
    const t = torsoClosed(ctx, k, PAD_OUT, { yLow: m.hipY - 0.1 });
    sleeves(ctx, k, PAD_OUT, 'long');
    ctx.boxC('chest', 0, T.y1 - 0.8, t.d / 2 - 0.4, T.w * 0.62, 1.9, 1.6, k.main);               // hood resting on the back
    ctx.boxC('chest', 0, T.y1 - 0.35, t.d / 2 - 0.45, T.w * 0.4, 1.1, 1.0, k.secShade);
    ctx.boxC('spine', 0, t.yLow + 0.35, t.front - 0.05, T.wLow * 0.55, 1.4, 0.12, k.mainShade);    // pocket
    ctx.mirror(s => ctx.boxC('chest', s * 0.45, T.y1 - 2.2, t.front - 0.1, 0.18, 1.8, 0.12, k.secFlat));
  },
});

registerAsset({
  id: 'outer_vest_open_01', slot: 'outerwear', label: { en: 'Open vest', ar: 'صدرية مفتوحة' },
  description: 'Sleeveless vest worn open over a bare chest or shirt, with buttons on one side (secondary colour = buttons). Classic pirate-hero red vest.',
  tags: ['vest', 'waistcoat', 'sleeveless', 'open', 'buttons'],
  colors: mainColors(L.outer, '#D3312F', '#F2C230', { en: 'Buttons', ar: 'الأزرار' }), material: 'cloth',
  build(ctx, it) {
    const k = it.keys, m = ctx.m, T = m.torso, gap = Math.max(1.6, T.w * 0.4);
    const t = torsoOpen(ctx, k, 0.22, gap, { yLow: m.hipY + 0.3 });
    for (let i = 0; i < 3; i++) ctx.boxC(i < 1 ? 'chest' : 'spine', gap / 2 + 0.45, T.yMid + 1.2 - i * 1.35, t.front - 0.05, 0.4, 0.4, 0.12, k.secFlat);
  },
});

registerAsset({
  id: 'outer_coat_long_01', slot: 'outerwear', label: { en: 'Long open coat', ar: 'معطف طويل مفتوح' },
  description: 'Knee-length open coat with long sleeves and a collar (secondary colour = collar / trim). Trench coat, lab coat, captain\'s coat.',
  tags: ['coat', 'long coat', 'trench coat', 'lab coat', 'cloak with sleeves'],
  colors: mainColors(L.outer, '#5A4632', '#3A2C1F', { en: 'Collar & trim', ar: 'الياقة والحواف' }), material: 'cloth',
  build(ctx, it) {
    const k = it.keys, m = ctx.m, T = m.torso, gap = Math.max(1.3, T.w * 0.3);
    const t = torsoOpen(ctx, k, PAD_OUT + 0.05, gap, { yLow: m.hipY - 0.6 });
    sleeves(ctx, k, PAD_OUT + 0.05, 'long', k.sec);
    // skirt of the coat hanging from the hips, open at the front
    const reach = m.hipX + legW(m, PAD_OUT) / 2 + 0.25, w = Math.max(T.wLow + 0.9, reach * 2), d = T.d + 1.1;
    const y0 = m.kneeY - 0.4, h = m.hipY - 0.55 - y0;
    ctx.box('hips', -w / 2, y0, -d / 2, w / 2 - gap / 2, h, d, k.main);
    ctx.box('hips', gap / 2, y0, -d / 2, w / 2 - gap / 2, h, d, k.main);
    ctx.box('hips', -gap / 2 - 0.01, y0, -d / 2 + 0.9, gap + 0.02, h, d - 0.9, k.main);
    ctx.box('hips', w / 2 - 0.04, y0 + 0.15, -d / 2 + 0.1, 0.1, h - 0.3, d - 0.2, k.mainShade);
    ctx.boxC('hips', 0, y0 - 0.02, 0, w + 0.08, 0.14, d + 0.08, 'ink');
    ctx.boxC('chest', 0, T.y1 - 0.3, 0.1, T.w * 0.75, 0.9, t.d + 0.2, k.sec);
    ctx.layers.waist = Math.max(ctx.layers.waist, 0.6);
  },
});

// ================================================================== BOTTOMS
registerAsset({
  id: 'bottom_shorts_01', slot: 'bottom', label: { en: 'Shorts (Limonat)', ar: 'شورت (ليمونات)' },
  description: 'Mid-thigh shorts (the Limonat hero\'s shorts).', tags: ['shorts', 'short trousers', 'summer', 'limonat'],
  colors: mainColors(L.bottom, '#F0EFEB'), material: 'cloth',
  build(ctx, it) { const m = ctx.m; waist(ctx, it.keys, PAD_BOTTOM); trouserLegs(ctx, it.keys, PAD_BOTTOM, m.hipY - m.leg.len * 0.5); },
});

registerAsset({
  id: 'bottom_shorts_rolled_01', slot: 'bottom', label: { en: 'Rolled knee shorts', ar: 'شورت طويل مطوي' },
  description: 'Knee-length shorts / cut-off jeans with thick rolled-up cuffs just below the knee.', tags: ['shorts', 'rolled cuffs', 'knee length', 'jeans shorts', 'capri'],
  colors: mainColors(L.bottom, '#3E6FB0'), material: 'denim',
  build(ctx, it) { const m = ctx.m; waist(ctx, it.keys, PAD_BOTTOM); trouserLegs(ctx, it.keys, PAD_BOTTOM, m.kneeY - m.leg.len * 0.12, it.keys.mainShade); },
});

registerAsset({
  id: 'bottom_pants_straight_01', slot: 'bottom', label: { en: 'Straight trousers', ar: 'بنطلون مستقيم' },
  description: 'Full-length straight trousers / jeans / slacks down to the shoes.', tags: ['trousers', 'pants', 'jeans', 'slacks', 'long'],
  colors: mainColors(L.bottom, '#2E3A55'), material: 'cloth',
  build(ctx, it) { const m = ctx.m; waist(ctx, it.keys, PAD_BOTTOM); trouserLegs(ctx, it.keys, PAD_BOTTOM, m.ankleY + 0.15); },
});

registerAsset({
  id: 'bottom_cargo_01', slot: 'bottom', label: { en: 'Cargo trousers', ar: 'بنطلون كارجو' },
  description: 'Loose full-length cargo trousers with side pockets on the thighs and a belt (secondary colour = belt).', tags: ['cargo', 'pockets', 'utility', 'military', 'baggy'],
  colors: mainColors(L.bottom, '#6B6B4A', '#2B2620', { en: 'Belt', ar: 'الحزام' }), material: 'cloth',
  build(ctx, it) {
    const m = ctx.m, k = it.keys, T = m.torso;
    waist(ctx, k, PAD_BOTTOM + 0.06);
    trouserLegs(ctx, k, PAD_BOTTOM + 0.08, m.ankleY + 0.15, k.mainShade);
    ctx.boxC('hips', 0, m.hipY + 0.05, 0, T.wLow + 0.5, 0.5, T.d + 0.5, k.sec);
    const w = legW(m, PAD_BOTTOM + 0.08);
    ctx.mirror((s, side) => ctx.boxC(side + 'UpperLeg', s * (m.hipX + w / 2 + 0.05), m.kneeY + 0.4, 0, 0.3, 1.5, 1.4, k.mainShade));
  },
});

registerAsset({
  id: 'bottom_skirt_01', slot: 'bottom', label: { en: 'Skirt', ar: 'تنورة' },
  description: 'Knee-length A-line skirt (flared at the bottom) with bare legs below.', tags: ['skirt', 'a-line', 'dress bottom', 'school skirt'],
  colors: mainColors(L.bottom, '#2F3E75'), material: 'cloth',
  build(ctx, it) {
    const m = ctx.m, k = it.keys, T = m.torso;
    ctx.boxC('hips', 0, m.hipY - 1.4, 0, T.wLow + 0.3, 2.05, T.d + 0.3, k.main);
    const w = Math.max(T.wLow + 1.0, 2 * (m.hipX + legW(m, PAD_BOTTOM) / 2) + 0.6), d = T.d + 1.2, y0 = m.kneeY + 0.3;
    ctx.boxC('hips', 0, y0, 0, w, m.hipY - 1.3 - y0, d, k.main);
    ctx.boxC('hips', 0, y0 - 0.02, 0, w + 0.08, 0.14, d + 0.08, 'ink');
    ctx.box('hips', w / 2 - 0.04, y0 + 0.15, -d / 2 + 0.1, 0.1, m.hipY - 1.6 - y0, d - 0.2, k.mainShade);
    grow(ctx, 'waist', 0.6);
  },
});

// ================================================================== SHOES
function foot(m, s) {
  const F = m.foot, flare = m.limbStyle === 'stick' ? 0.3 : 0;
  return { F, x: s * (m.hipX + flare), z0: -F.len * 0.656 };
}

registerAsset({ id: 'shoes_none', slot: 'shoes', label: { en: 'Barefoot', ar: 'حافي' }, description: 'No shoes, bare feet.', tags: ['barefoot', 'none'], build() {} });

registerAsset({
  id: 'shoes_sneakers_01', slot: 'shoes', label: { en: 'Sneakers (Limonat)', ar: 'سنيكرز (ليمونات)' },
  description: 'Rounded chunky sneakers with a contrasting sole (secondary colour = sole). The Limonat hero\'s shoes.',
  tags: ['sneakers', 'trainers', 'running shoes', 'casual', 'limonat'],
  colors: mainColors(L.shoes, '#F4F3EF', '#B4B9C5', { en: 'Sole', ar: 'النعل' }), material: 'cloth',
  build(ctx, it) {
    const m = ctx.m, k = it.keys;
    ctx.mirror((s, side) => {
      const { F, x, z0 } = foot(m, s), j = side + 'Foot', sole = F.h * 0.31;
      const cuffW = Math.max(F.w * 0.7, limbSize(m.leg.w, 0, 0.15));
      ctx.box(j, x - F.w / 2, 0, z0, F.w, sole, F.len, k.sec);
      ctx.box(j, x - F.w / 2, sole, z0, F.w, F.h - sole, F.len, k.main);
      ctx.boxC(j, x, F.h, -0.05, cuffW, 0.3, Math.max(F.len * 0.53, cuffW), k.main);
      ctx.box(j, x - F.w * 0.3, F.h - 0.04, z0 + 0.35, F.w * 0.6, 0.08, F.len * 0.35, k.mainShade);
      ctx.box(j, s > 0 ? x + F.w / 2 - 0.06 : x - F.w / 2 - 0.04, sole + 0.1, z0 + 0.2, 0.1, F.h - sole - 0.2, F.len - 0.4, k.mainShade);
    });
  },
});

registerAsset({
  id: 'shoes_boots_01', slot: 'shoes', label: { en: 'Boots', ar: 'بوت' },
  description: 'Sturdy boots reaching up the shin, worn over the trousers (secondary colour = sole).', tags: ['boots', 'combat boots', 'hiking', 'cowboy', 'tall shoes'],
  colors: mainColors(L.shoes, '#4A3326', '#1E1612', { en: 'Sole', ar: 'النعل' }), material: 'leather',
  build(ctx, it) {
    const m = ctx.m, k = it.keys;
    ctx.mirror((s, side) => {
      const { F, x, z0 } = foot(m, s), j = side + 'Foot', sole = 0.35;
      ctx.box(j, x - F.w / 2 - 0.05, 0, z0 - 0.05, F.w + 0.1, sole, F.len + 0.1, k.sec);
      ctx.box(j, x - F.w / 2, sole, z0, F.w, F.h - sole + 0.1, F.len, k.main);
      const sw = Math.max(legW(m, PAD_BOTTOM), m.leg.w) + 0.3, sd = Math.max(legD(m, PAD_BOTTOM), m.leg.d) * 0.85 + 0.3;
      const lx = s * m.hipX, top = m.ankleY + m.leg.len * 0.38;
      ctx.boxC(side + 'LowerLeg', (lx + x) / 2, F.h - 0.3, 0.1, sw, top - F.h + 0.3, sd, k.main);
      ctx.boxC(side + 'LowerLeg', (lx + x) / 2, top - 0.35, 0.1, sw + 0.1, 0.4, sd + 0.1, k.mainShade);
    });
    ctx.layers.legs = Math.max(ctx.layers.legs, 0.45);
  },
});

registerAsset({
  id: 'shoes_sandals_01', slot: 'shoes', label: { en: 'Sandals', ar: 'صندل' },
  description: 'Open sandals / flip-flops: a sole with straps, toes visible (secondary colour = sole).', tags: ['sandals', 'flip-flops', 'open toe', 'summer', 'beach'],
  colors: mainColors(L.shoes, '#7A4A2A', '#3A2618', { en: 'Sole', ar: 'النعل' }), material: 'leather',
  build(ctx, it) {
    const m = ctx.m, k = it.keys, F = m.foot;
    ctx.mirror((s, side) => {
      const j = side + 'Foot', fx = s * m.hipX + s * 0.1, fw = F.w * 0.72, fz = -F.len * 0.18, fl = F.len * 0.78, fh = F.h * 0.62;
      ctx.boxC(j, fx, -0.05, fz, fw + 0.3, 0.35, fl + 0.3, k.sec);
      for (const dz of [-0.28, 0.12]) ctx.boxC(j, fx, 0.3, fz + dz * fl, fw + 0.14, fh - 0.2, 0.4, k.main);
    });
  },
});

registerAsset({
  id: 'shoes_dress_01', slot: 'shoes', label: { en: 'Dress shoes', ar: 'حذاء رسمي' },
  description: 'Low polished formal shoes / loafers with a small heel (secondary colour = sole and heel).', tags: ['dress shoes', 'formal', 'loafers', 'oxford', 'polished'],
  colors: mainColors(L.shoes, '#1C1C1E', '#0E0E10', { en: 'Sole', ar: 'النعل' }), material: 'plastic',
  build(ctx, it) {
    const m = ctx.m, k = it.keys;
    ctx.mirror((s, side) => {
      const { F, x, z0 } = foot(m, s), j = side + 'Foot', len = F.len * 0.95, w = F.w * 0.9;
      ctx.box(j, x - w / 2, 0, z0, w, 0.22, len, k.sec);
      ctx.box(j, x - w / 2, 0, z0 + len - 0.8, w, 0.4, 0.8, k.sec);
      ctx.box(j, x - w / 2, 0.22, z0, w, F.h * 0.7 - 0.22, len, k.main);
      ctx.box(j, x - w * 0.3, F.h * 0.7 - 0.04, z0 + 0.3, w * 0.6, 0.08, len * 0.3, k.mainShade);
    });
  },
});
