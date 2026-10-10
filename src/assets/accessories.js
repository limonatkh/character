/* Accessories. Each one declares which attachment points it supports; build()
 * receives `it.at` = { id, joint, pos:[x,y,z] } for the chosen point.
 * Held items point DOWN along the arm in the rest pose (they follow the hand). */
import { registerAsset } from '../core/registry.js';
import { limbSize } from './clothing.js';

const acc = (def) => registerAsset({ slot: 'accessory', ...def });
const cols = (main, mainLabel, sec, secLabel) => [
  { key: 'color', label: mainLabel, default: main },
  ...(sec ? [{ key: 'secondaryColor', label: secLabel, default: sec }] : []),
];
const fixed = (ctx, key, hex, material) => ctx.palette[key] ? key : ctx.setColor(key, hex, { material, outline: true });
const FRAME = { en: 'Frame', ar: 'الإطار' };

// ------------------------------------------------------------------ face
function glasses(ctx, it, { w, h, bar, lens }) {
  const H = ctx.m.head, l1 = H.layers[0], s = H.s, t = H.t, z = H.faceZ - 0.62, k = it.keys;
  const W = w * s, Hh = h * t, b = bar;
  ctx.mirror(sd => {
    const cx = sd * H.eyeX, cy = H.eyeY;
    if (lens) ctx.boxCC('head', cx, cy, z + 0.06, W - 0.1, Hh - 0.1, 0.1, lens);
    ctx.boxCC('head', cx, cy + Hh / 2 - b / 2, z, W, b, 0.16, k.mainFlat);
    ctx.boxCC('head', cx, cy - Hh / 2 + b / 2, z, W, b, 0.16, k.mainFlat);
    ctx.boxCC('head', cx - W / 2 + b / 2, cy, z, b, Hh, 0.16, k.mainFlat);
    ctx.boxCC('head', cx + W / 2 - b / 2, cy, z, b, Hh, 0.16, k.mainFlat);
    // temple arm running back along the side of the head
    const x = sd * (l1.w / 2 + 0.08);
    ctx.box('head', x - 0.08, cy + Hh / 2 - 0.35, z, 0.16, 0.2, l1.d * 0.62, k.mainFlat);
    ctx.box('head', sd < 0 ? x - 0.08 : cx + W / 2 - 0.1, cy + Hh / 2 - 0.35, z, Math.abs(x - (cx + sd * W / 2)) + 0.18, 0.2, 0.16, k.mainFlat);
  });
  const inner = H.eyeX - W / 2;
  ctx.boxCC('head', 0, H.eyeY + Hh * 0.18, z, inner * 2 + 0.1, b, 0.16, k.mainFlat);
}
acc({
  id: 'acc_glasses_round_01', label: { en: 'Round glasses', ar: 'نظارة دائرية' },
  description: 'Thin round-ish glasses with clear lenses.', tags: ['glasses', 'spectacles', 'round', 'nerd'],
  colors: cols('#1C1C1C', FRAME), material: 'plastic', attach: { points: ['face'], default: 'face' },
  build(ctx, it) { glasses(ctx, it, { w: 3.0, h: 2.8, bar: 0.22 }); },
});
acc({
  id: 'acc_glasses_square_01', label: { en: 'Square glasses', ar: 'نظارة مربعة' },
  description: 'Thick rectangular glasses frames with clear lenses.', tags: ['glasses', 'square', 'rectangular', 'thick frames'],
  colors: cols('#3A2E28', FRAME), material: 'plastic', attach: { points: ['face'], default: 'face' },
  build(ctx, it) { glasses(ctx, it, { w: 3.0, h: 2.2, bar: 0.34 }); },
});
acc({
  id: 'acc_sunglasses_01', label: { en: 'Sunglasses', ar: 'نظارة شمسية' },
  description: 'Dark sunglasses with solid opaque lenses (secondary colour = lens tint). Hides the eyes.', tags: ['sunglasses', 'shades', 'dark glasses', 'cool'],
  colors: cols('#111111', FRAME, '#1E2A38', { en: 'Lenses', ar: 'العدسات' }), material: 'plastic', attach: { points: ['face'], default: 'face' },
  build(ctx, it) { glasses(ctx, it, { w: 3.0, h: 2.3, bar: 0.26, lens: it.keys.secFlat }); },
});

// ------------------------------------------------------------------ head
acc({
  id: 'acc_headphones_01', label: { en: 'Headphones', ar: 'سماعات رأس' },
  description: 'Over-ear headphones with a band over the head (secondary colour = ear cups).', tags: ['headphones', 'headset', 'gamer', 'music', 'dj'],
  colors: cols('#2B2B2F', { en: 'Band', ar: 'الطوق' }, '#E05A47', { en: 'Ear cups', ar: 'الأغطية' }), material: 'plastic',
  attach: { points: ['head_top'], default: 'head_top' },
  build(ctx, it) {
    const H = ctx.m.head, l1 = H.layers[0], top = it.at.pos[1], k = it.keys;
    const half = l1.w / 2 + Math.max(0.35, (ctx.hairInflate || 0) + 0.25), earY = H.y0 + H.h * 0.42, ez = l1.z + l1.d * 0.55;
    ctx.box('head', -half - 0.4, top - 0.1, ez - 0.5, 2 * half + 0.8, 0.5, 1.0, k.main);
    ctx.mirror(sd => {
      ctx.box('head', sd < 0 ? -half - 0.4 : half - 0.1, earY + 1.0, ez - 0.4, 0.5, top - earY - 0.95, 0.8, k.main);
      ctx.boxCC('head', sd * (half + 0.15), earY + 0.3, ez, 0.9, 2.2 * H.t, 1.9, k.sec);
    });
  },
});

// ------------------------------------------------------------------ neck / chest
acc({
  id: 'acc_scarf_01', label: { en: 'Scarf', ar: 'وشاح' },
  description: 'Knitted scarf wrapped around the neck with one end hanging down the front (secondary colour = stripes).', tags: ['scarf', 'muffler', 'winter'],
  colors: cols('#C8322B', { en: 'Scarf', ar: 'الوشاح' }, '#F2F2F2', { en: 'Stripes', ar: 'الخطوط' }), material: 'cloth',
  attach: { points: ['neck'], default: 'neck' },
  build(ctx, it) {
    const m = ctx.m, T = m.torso, y = it.at.pos[1], L = ctx.layers.torso, k = it.keys;
    const w = Math.max(T.w * 0.7, m.neck.w + 2.2), d = T.d + 2 * L + 0.4;
    ctx.boxC('chest', 0, y - 0.45, 0, w, 1.15, d, k.main);
    const x = -T.w * 0.18, z = -(T.d / 2 + L) - 0.45;
    ctx.boxC('chest', x, y - 3.4, z + 0.2, 1.3, 3.1, 0.45, k.main);
    for (const dy of [-2.6, -1.8]) ctx.boxC('chest', x, y + dy, z + 0.2, 1.36, 0.3, 0.5, k.secFlat);
  },
});
acc({
  id: 'acc_necklace_01', label: { en: 'Necklace with pendant', ar: 'قلادة مع حجر' },
  description: 'Thin chain necklace with a gem pendant on the chest (secondary colour = pendant).', tags: ['necklace', 'chain', 'pendant', 'jewelry', 'amulet'],
  colors: cols('#D9B44A', { en: 'Chain', ar: 'السلسلة' }, '#3FA9F5', { en: 'Pendant', ar: 'الحجر' }), material: 'metal',
  attach: { points: ['neck'], default: 'neck' },
  build(ctx, it) {
    const T = ctx.m.torso, y = it.at.pos[1], z = -(T.d / 2 + ctx.layers.torso) - 0.12, k = it.keys;
    ctx.mirror(sd => ctx.box('chest', sd * 0.9 - 0.09, y - 1.5, z, 0.18, 1.5, 0.12, k.mainFlat));
    ctx.boxC('chest', 0, y - 1.6, z + 0.06, 1.98, 0.18, 0.12, k.mainFlat);
    ctx.boxC('chest', 0, y - 2.45, z + 0.02, 0.6, 0.8, 0.2, k.sec);
  },
});
acc({
  id: 'acc_lemon_badge_01', label: { en: 'Lemon badge', ar: 'شارة الليمونة' },
  description: 'Small Limonat lemon pin badge with a green leaf (secondary colour = leaf).', tags: ['badge', 'pin', 'lemon', 'limonat', 'emblem'],
  colors: cols('#FFD83A', { en: 'Lemon', ar: 'الليمونة' }, '#4F9E32', { en: 'Leaf', ar: 'الورقة' }), material: 'plastic',
  attach: { points: ['chest', 'back'], default: 'chest' },
  build(ctx, it) {
    const T = ctx.m.torso, [, y, z] = it.at.pos, back = it.at.id === 'back', dz = back ? 1 : -1, x = back ? 0 : -T.w * 0.22, k = it.keys;
    ctx.boxCC('chest', x, y, z + dz * 0.12, 1.1, 0.8, 0.24, k.main);
    ctx.boxCC('chest', x, y, z + dz * 0.12, 0.7, 1.05, 0.24, k.main);
    ctx.boxCC('chest', x + 0.35, y + 0.6, z + dz * 0.14, 0.45, 0.3, 0.2, k.sec);
  },
});

// ------------------------------------------------------------------ back
acc({
  id: 'acc_backpack_01', label: { en: 'Backpack', ar: 'حقيبة ظهر' },
  description: 'School / adventure backpack with shoulder straps and a front flap (secondary colour = flap and straps).', tags: ['backpack', 'rucksack', 'school bag', 'bag'],
  colors: cols('#3E6B3A', { en: 'Bag', ar: 'الحقيبة' }, '#2A4A28', { en: 'Flap & straps', ar: 'الغطاء والأحزمة' }), material: 'cloth',
  attach: { points: ['back'], default: 'back' },
  build(ctx, it) {
    const T = ctx.m.torso, [, y, z] = it.at.pos, k = it.keys, w = T.w * 0.72, h = Math.min(T.h * 0.75, 5.2);
    ctx.boxCC('chest', 0, y - 0.3, z + 0.95, w, h, 1.9, k.main);
    ctx.boxCC('chest', 0, y + h / 2 - 1.0, z + 1.0, w + 0.1, 1.6, 2.0, k.sec);
    ctx.boxCC('chest', 0, y - h / 2 + 0.9, z + 1.92, w * 0.6, 1.2, 0.2, k.mainShade);
    const zf = -(T.d / 2 + ctx.layers.torso) - 0.12;
    ctx.mirror(sd => {
      ctx.box('chest', sd * T.w * 0.28 - 0.3, T.yMid - 0.2, zf, 0.6, T.y1 - T.yMid + 0.35, 0.16, k.sec);
      ctx.box('chest', sd * T.w * 0.28 - 0.3, T.y1 + 0.05, zf, 0.6, 0.18, z - zf + 0.1, k.sec);
    });
  },
});
acc({
  id: 'acc_cape_01', label: { en: 'Cape', ar: 'عباءة' },
  description: 'Long hero cape hanging from the shoulders down the back to the knees (secondary colour = collar / clasp).', tags: ['cape', 'cloak', 'superhero', 'royal', 'mantle'],
  colors: cols('#A3262A', { en: 'Cape', ar: 'العباءة' }, '#E0B13B', { en: 'Collar', ar: 'الياقة' }), material: 'cloth',
  attach: { points: ['back'], default: 'back' },
  build(ctx, it) {
    const m = ctx.m, T = m.torso, z = T.d / 2 + ctx.layers.torso + 0.08, k = it.keys, w = T.w + 1.4;
    ctx.box('chest', -w / 2, m.kneeY - 0.5, z, w, T.y1 + 0.25 - m.kneeY + 0.5, 0.35, k.main);
    ctx.box('chest', -w / 2 + 0.1, m.kneeY - 0.45, z + 0.3, w - 0.2, T.y1 - m.kneeY + 0.5, 0.1, k.mainShade);
    ctx.boxC('chest', 0, T.y1 - 0.3, 0, T.w * 0.8, 0.6, T.d + 2 * ctx.layers.torso + 0.45, k.sec);
  },
});

// ------------------------------------------------------------------ waist
acc({
  id: 'acc_belt_01', label: { en: 'Belt', ar: 'حزام' },
  description: 'Belt around the waist with a square buckle (secondary colour = buckle).', tags: ['belt', 'buckle', 'waist'],
  colors: cols('#4A3020', { en: 'Belt', ar: 'الحزام' }, '#D9B44A', { en: 'Buckle', ar: 'الإبزيم' }), material: 'leather',
  attach: { points: ['waist'], default: 'waist' },
  build(ctx, it) {
    const T = ctx.m.torso, y = it.at.pos[1] - 0.25, p = Math.max(ctx.layers.waist, 0.12) + 0.08, k = it.keys;
    ctx.boxC('hips', 0, y, 0, T.wLow + 2 * p, 0.55, T.d + 2 * p, k.main);
    ctx.boxC('hips', 0, y - 0.1, -(T.d / 2 + p) - 0.05, 0.95, 0.75, 0.18, k.sec);
  },
});

// ------------------------------------------------------------------ wrist
acc({
  id: 'acc_watch_01', label: { en: 'Wrist watch', ar: 'ساعة يد' },
  description: 'Wrist watch with a strap and a round face (secondary colour = watch face). Use wrist_left or wrist_right.', tags: ['watch', 'wristwatch', 'bracelet', 'smartwatch'],
  colors: cols('#222222', { en: 'Strap', ar: 'السوار' }, '#E8E8E8', { en: 'Face', ar: 'الوجه' }), material: 'plastic',
  attach: { points: ['wrist_left', 'wrist_right'], default: 'wrist_left' },
  build(ctx, it) {
    const m = ctx.m, [x, y] = it.at.pos, sd = x < 0 ? -1 : 1, k = it.keys;
    const w = Math.max(m.arm.w + 0.3, ctx.layers.arms ? limbSize(m.arm.w, m.arm.clothW, ctx.layers.arms) + 0.12 : 0), d = w;
    ctx.boxC(it.at.joint, x, y - 0.25, 0, w, 0.5, d, k.main);
    ctx.boxCC(it.at.joint, x + sd * (w / 2 + 0.06), y, 0, 0.14, 0.7, 0.7, k.sec);
  },
});

// ------------------------------------------------------------------ weapons
acc({
  id: 'acc_sword_01', label: { en: 'Sword', ar: 'سيف' },
  description: 'Straight sword / katana with a guard. On the back or a hip it is sheathed (scabbard = main colour); in a hand it is drawn and points down along the arm. Main colour = handle/scabbard, secondary = guard.',
  tags: ['sword', 'katana', 'blade', 'weapon', 'samurai', 'knight'],
  colors: cols('#2B2B33', { en: 'Handle / scabbard', ar: 'المقبض / الغمد' }, '#C9A227', { en: 'Guard', ar: 'الواقي' }), material: 'leather',
  attach: { points: ['back', 'hip_left', 'hip_right', 'hand_right', 'hand_left'], default: 'hip_left' },
  build(ctx, it) {
    const m = ctx.m, T = m.torso, k = it.keys, blade = fixed(ctx, 'swordBlade', '#D5DAE0', 'metal');
    const [x, y, z] = it.at.pos, j = it.at.joint;
    if (it.at.id.startsWith('hand')) {
      ctx.boxC(j, x, y - 0.3, z, 0.55, 1.6, 0.55, k.main);                // grip through the fist
      ctx.boxC(j, x, y - 0.6, z, 0.45, 0.3, 1.6, k.sec);                  // guard
      ctx.boxC(j, x, y - 6.4, z, 0.25, 5.8, 0.75, blade);                 // blade, pointing down
    } else if (it.at.id === 'back') {
      const bx = T.w * 0.12, bz = z + 0.35, top = T.y1 + 2.4;
      ctx.boxC(j, bx, top - 1.7, bz, 0.55, 1.7, 0.55, k.main);
      ctx.boxC(j, bx, top - 2.0, bz, 1.5, 0.3, 0.45, k.sec);
      ctx.boxC(j, bx, top - 8.6, bz, 0.7, 6.6, 0.55, k.main);             // scabbard
    } else {
      const sx = x, sz = 0.4;
      ctx.boxC(j, sx, y + 0.5, sz - 0.4, 0.55, 1.5, 0.55, k.main);
      ctx.boxC(j, sx, y + 0.2, sz - 0.4, 0.45, 0.3, 1.5, k.sec);
      ctx.boxC(j, sx, y - 5.6, sz - 0.1, 0.55, 5.8, 0.75, k.main);
    }
  },
});
acc({
  id: 'acc_shield_01', label: { en: 'Round shield', ar: 'درع دائري' },
  description: 'Round wooden shield with a metal boss (secondary colour = boss / rim). Held on the outside of a hand or carried on the back.',
  tags: ['shield', 'buckler', 'knight', 'viking', 'defence'],
  colors: cols('#8E5A2B', { en: 'Shield', ar: 'الدرع' }, '#C0C6CE', { en: 'Boss', ar: 'المركز' }), material: 'cloth',
  attach: { points: ['hand_left', 'hand_right', 'back'], default: 'hand_left' },
  build(ctx, it) {
    const m = ctx.m, k = it.keys, [x, y, z] = it.at.pos, j = it.at.joint;
    if (it.at.id === 'back') {
      const bz = z + 0.4;
      ctx.boxCC(j, 0, y - 0.4, bz, 4.2, 3.4, 0.4, k.main);
      ctx.boxCC(j, 0, y - 0.4, bz, 3.4, 4.2, 0.4, k.main);
      ctx.boxCC(j, 0, y - 0.4, bz + 0.3, 1.0, 1.0, 0.3, k.sec);
    } else {
      const sd = x < 0 ? -1 : 1, sx = x + sd * (m.hand.w / 2 + 0.35);
      ctx.boxCC(j, sx, y, z, 0.4, 3.4, 4.2, k.main);
      ctx.boxCC(j, sx, y, z, 0.4, 4.2, 3.4, k.main);
      ctx.boxCC(j, sx + sd * 0.3, y, z, 0.3, 1.0, 1.0, k.sec);
    }
  },
});
