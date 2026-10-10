/* Body types and head shapes. Measurements are in voxel px (1 px = 0.084 m). */
import { registerAsset } from '../core/registry.js';

// ---------------------------------------------------------------- body types
registerAsset({
  id: 'body_toon_01', slot: 'bodyType',
  label: { en: 'Limonat toon', ar: 'كرتون ليمونات' },
  description: 'Limonat cartoon body (same proportions as the game hero): big head, compact torso, thin stick arms and legs, round mitten hands. Clothes look chunky over the thin limbs.',
  tags: ['cartoon', 'chibi', 'stick limbs', 'mitten hands', 'default'],
  measure: {
    limbStyle: 'stick',
    leg: { w: 0.55, d: 0.55, clothW: 1.9, clothD: 2.5, len: 5.15 },
    foot: { h: 1.45, len: 3.2, w: 2.0 },
    hipX: 0.95,
    torso: { w: 4.6, wLow: 3.8, d: 2.6, h: 6.9 },
    neck: { w: 0.45, len: 0.8 },
    arm: { w: 0.55, d: 0.55, clothW: 1.6, clothD: 1.6, upper: 2.3, lower: 2.1 },
    hand: { w: 1.8, h: 2.0, d: 1.7, style: 'mitten' },
    head: { w: 7.2, h: 7.0, d: 6.6 },
  },
});

registerAsset({
  id: 'body_block_01', slot: 'bodyType',
  label: { en: 'Classic block', ar: 'مكعبات كلاسيكي' },
  description: 'Classic blocky voxel humanoid: square limbs as thick as a block, square hands, normal human proportions with a slightly large head.',
  tags: ['blocky', 'minecraft-like', 'realistic proportions', 'thick limbs'],
  measure: {
    limbStyle: 'block',
    leg: { w: 2.0, d: 2.0, clothW: 2.3, clothD: 2.3, len: 6.6 },
    foot: { h: 1.2, len: 2.9, w: 2.2 },
    hipX: 1.0,
    torso: { w: 4.4, wLow: 4.0, d: 2.2, h: 6.4 },
    neck: { w: 1.4, len: 0.5 },
    arm: { w: 1.8, d: 1.8, clothW: 2.1, clothD: 2.1, upper: 3.0, lower: 2.6 },
    hand: { w: 1.7, h: 1.6, d: 1.7, style: 'block' },
    head: { w: 6.2, h: 6.2, d: 6.2 },
  },
});

// ---------------------------------------------------------------- head shapes
/** Rounded head made of three crossed boxes (the Limonat hero's head). */
function roundLayers(H) {
  const L = [[1, 0.94, 0.186, 0.814], [0.861, 0.818, 0.057, 0.943], [0.611, 0.606, 0.014, 1.0]];
  return L.map(([w, d, a, b]) => ({ x: -H.w * w / 2, y: H.y0 + H.h * a, z: -H.d * d / 2, w: H.w * w, h: H.h * (b - a), d: H.d * d }));
}
function buildLayers(ctx, skin) {
  const H = ctx.m.head;
  for (const l of H.layers) ctx.box('head', l.x, l.y, l.z, l.w, l.h, l.d, skin.main);
}

registerAsset({
  id: 'head_round_01', slot: 'headShape',
  label: { en: 'Round', ar: 'دائري' },
  description: 'Rounded cartoon head (stacked blocks that read as a circle from the front). Best for most cartoon and anime characters.',
  tags: ['round', 'cartoon', 'default'],
  dims: { w: 1, h: 1, d: 1 },
  face: { eyeY: 0.55, eyeX: 0.235, mouthY: 0.32, browY: 0.8, hairline: 0.77 },
  layers: roundLayers,
  faceZ: H => -H.d * 0.94 / 2,
  buildHead(ctx, skin) {
    buildLayers(ctx, skin);
    const H = ctx.m.head, l = H.layers[0];
    ctx.box('head', l.x - 0.04, l.y + 0.1, l.z + 0.6, 0.1, l.h * 0.7, l.d - 1.2, skin.mainShade);   // side shading (-X), like the hero
  },
});

registerAsset({
  id: 'head_block_01', slot: 'headShape',
  label: { en: 'Square block', ar: 'مكعب' },
  description: 'A single cube head, classic voxel style. Good for blocky or robot-like characters and realistic people.',
  tags: ['square', 'cube', 'blocky'],
  dims: { w: 0.92, h: 0.92, d: 0.92 },
  face: { eyeY: 0.5, eyeX: 0.22, mouthY: 0.24, browY: 0.74, hairline: 0.8 },
  layers: H => [{ x: H.x0, y: H.y0, z: H.z0, w: H.w, h: H.h, d: H.d }],
  faceZ: H => H.z0,
  buildHead(ctx, skin) {
    buildLayers(ctx, skin);
    const H = ctx.m.head;
    ctx.box('head', H.x0 - 0.04, H.y0 + 0.3, H.z0 + 0.5, 0.1, H.h - 0.8, H.d - 1.0, skin.mainShade);
  },
});

registerAsset({
  id: 'head_tall_01', slot: 'headShape',
  label: { en: 'Tall oval', ar: 'بيضاوي طويل' },
  description: 'Rounded head that is taller and narrower than round; suits adults, long faces and older characters.',
  tags: ['oval', 'long face', 'adult'],
  dims: { w: 0.9, h: 1.12, d: 0.95 },
  face: { eyeY: 0.53, eyeX: 0.24, mouthY: 0.27, browY: 0.76, hairline: 0.8 },
  layers: roundLayers,
  faceZ: H => -H.d * 0.94 / 2,
  buildHead(ctx, skin) {
    buildLayers(ctx, skin);
    const H = ctx.m.head, l = H.layers[0];
    ctx.box('head', l.x - 0.04, l.y + 0.1, l.z + 0.6, 0.1, l.h * 0.7, l.d - 1.2, skin.mainShade);
  },
});
