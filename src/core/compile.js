/* =====================================================================
 * COMPILER: character config  →  voxel model (pure data, no Three.js)
 *
 * Output ("model"), all coordinates in voxel px:
 * {
 *   joints:      [{ name, parent, pos:[x,y,z] }]        rest pose, absolute
 *   boxes:       [{ joint, x, y, z, w, h, d, key }]     min corner, absolute
 *   palette:     { key: { hex, material, outline } }    Limonat-style named colours
 *   attachments: { pointId: { joint, pos:[x,y,z] } }
 *   height, assets, measurements
 * }
 * The same model feeds the 3D preview, the GLB exporter and the
 * Limonat VR.CHARACTERS exporter, so all three always agree.
 * ===================================================================== */
import { INK } from './constants.js';
import { JOINT_INDEX, ATTACH_POINTS } from './skeleton.js';
import { getAsset } from './registry.js';
import { measure, buildBaseBody } from './body.js';
import { shadeFor, darkFor } from './color.js';

const r3 = v => Math.round(v * 1000) / 1000;

export class BuildContext {
  constructor(m, config) {
    this.m = m;
    this.cfg = config;
    this.boxes = [];
    this.palette = {};
    this.hat = null;        // { lineY, topY, clip } when headwear covers the crown
    this.layers = { torso: 0, arms: 0, legs: 0, waist: 0 };   // outermost inflate per region (for accessories)
    this.hairTop = null;
  }

  setColor(key, hex, opts = {}) {
    this.palette[key] = { hex, material: opts.material || 'cloth', outline: opts.outline !== false };
    return key;
  }

  /**
   * Register a coloured set for one part. Returns key names:
   *   main / sec           outlined voxels
   *   mainFlat / secFlat   same colour, no ink line (small details)
   *   mainShade / secShade slightly darker, no ink line (Limonat side shading)
   *   mainDark / secDark   strong contrast lines (seams, buttons)
   */
  colorSet(prefix, color, secondary, material = 'cloth') {
    const sec = secondary || color;
    const k = {
      main: prefix, mainFlat: prefix + 'Flat', mainShade: prefix + 'Shade', mainDark: prefix + 'Dark',
      sec: prefix + '2', secFlat: prefix + '2Flat', secShade: prefix + '2Shade', secDark: prefix + '2Dark',
    };
    this.setColor(k.main, color, { material });
    this.setColor(k.mainFlat, color, { material, outline: false });
    this.setColor(k.mainShade, shadeFor(color), { material, outline: false });
    this.setColor(k.mainDark, darkFor(color), { material, outline: false });
    this.setColor(k.sec, sec, { material });
    this.setColor(k.secFlat, sec, { material, outline: false });
    this.setColor(k.secShade, shadeFor(sec), { material, outline: false });
    this.setColor(k.secDark, darkFor(sec), { material, outline: false });
    return k;
  }

  /** Add a box by its minimum corner. opts.hair = clip under headwear. */
  box(joint, x, y, z, w, h, d, key, opts = {}) {
    if (!(joint in JOINT_INDEX)) throw new Error(`unknown joint "${joint}"`);
    if (!this.palette[key]) throw new Error(`unknown palette key "${key}"`);
    if (opts.hair && this.hat && this.hat.clip && this.hat.lineY != null) {
      if (y >= this.hat.lineY - 0.02) return;
      if (y + h > this.hat.lineY) h = this.hat.lineY - y;
    }
    if (!(w > 0.01 && h > 0.01 && d > 0.01)) return;
    this.boxes.push({ joint, x: r3(x), y: r3(y), z: r3(z), w: r3(w), h: r3(h), d: r3(d), key, tag: opts.tag || null });
  }
  /** Centred on x/z, bottom at y. */
  boxC(joint, cx, y, cz, w, h, d, key, opts) { this.box(joint, cx - w / 2, y, cz - d / 2, w, h, d, key, opts); }
  /** Centred on all three axes. */
  boxCC(joint, cx, cy, cz, w, h, d, key, opts) { this.box(joint, cx - w / 2, cy - h / 2, cz - d / 2, w, h, d, key, opts); }
  /** Run fn for the character's left (s = -1, x < 0) and right (s = +1) side. */
  mirror(fn) { fn(-1, 'left'); fn(1, 'right'); }

  /** Position of an attachment point after clothing is built. */
  attach(pointId) {
    const m = this.m, T = m.torso, H = m.head, L = this.layers;
    const pt = ATTACH_POINTS[pointId];
    let pos;
    switch (pointId) {
      case 'head_top': pos = [0, this.crownTop(), 0]; break;
      case 'face': pos = [0, H.eyeY, H.faceZ]; break;
      case 'neck': pos = [0, T.y1, 0]; break;
      case 'chest': pos = [0, T.yMid + (T.y1 - T.yMid) * 0.45, -(T.d / 2 + L.torso)]; break;
      case 'back': pos = [0, T.yMid + (T.y1 - T.yMid) * 0.35, T.d / 2 + L.torso]; break;
      case 'waist': pos = [0, m.hipY + 0.35, 0]; break;
      case 'hip_left': pos = [-(T.wLow / 2 + L.waist + 0.35), m.hipY - 0.2, 0]; break;
      case 'hip_right': pos = [T.wLow / 2 + L.waist + 0.35, m.hipY - 0.2, 0]; break;
      case 'wrist_left': pos = [-m.shoulderX, m.wristY + 0.55, 0]; break;
      case 'wrist_right': pos = [m.shoulderX, m.wristY + 0.55, 0]; break;
      case 'hand_left': pos = [-(m.shoulderX + m.handOffset), m.wristY - m.hand.h * 0.5, 0]; break;
      case 'hand_right': pos = [m.shoulderX + m.handOffset, m.wristY - m.hand.h * 0.5, 0]; break;
      default: throw new Error('unknown attach point ' + pointId);
    }
    return { id: pointId, joint: pt.joint, pos: pos.map(r3) };
  }

  crownTop() {
    if (this.hat) return this.hat.topY;
    return Math.max(this.m.head.y1, this.hairTop || 0);
  }

  finish(extra) {
    const used = new Set(this.boxes.map(b => b.key));
    const palette = {};
    for (const k of Object.keys(this.palette)) if (used.has(k)) palette[k] = this.palette[k];
    const attachments = {};
    for (const id of Object.keys(ATTACH_POINTS)) attachments[id] = this.attach(id);
    let height = 0;
    for (const b of this.boxes) height = Math.max(height, b.y + b.h);
    return {
      joints: this.m.joints,
      boxes: this.boxes.map(({ tag, ...b }) => b),
      palette,
      attachments,
      height: r3(height),
      measurements: this.m,
      ...extra,
    };
  }
}

function itemColors(asset, item) {
  const def = k => (asset.colors.find(c => c.key === k) || {}).default;
  return {
    color: item.color || def('color') || '#888888',
    secondaryColor: item.secondaryColor || def('secondaryColor') || item.color || def('color') || '#888888',
    material: item.material || asset.material || 'cloth',
  };
}

/**
 * Compile a validated, fully-populated character config.
 * Throws only on programming errors (unknown ids are rejected by the validator first).
 */
export function compile(config) {
  const bodyType = getAsset(config.body.typeId);
  const headShape = getAsset(config.head.shapeId);
  if (!bodyType || !headShape) throw new Error('compile: unknown body type or head shape');
  const m = measure(bodyType, headShape, config.body.proportions);
  const ctx = new BuildContext(m, config);
  ctx.setColor('ink', INK, { outline: false });
  const skin = ctx.colorSet('skin', config.body.skinColor, null, 'skin');
  ctx.skin = skin;

  const used = [bodyType.id, headShape.id];
  const run = (assetId, prefix, item = {}) => {
    const a = getAsset(assetId);
    if (!a) throw new Error('compile: unknown asset ' + assetId);
    used.push(a.id);
    const c = itemColors(a, item);
    const keys = a.colors.length ? ctx.colorSet(prefix, c.color, c.secondaryColor, c.material) : null;
    a.build(ctx, { ...item, ...c, keys, asset: a });
    return a;
  };

  buildBaseBody(ctx, skin);
  headShape.buildHead(ctx, skin);

  const F = config.face;
  run(F.eyes.styleId, 'eyes', F.eyes);
  // headwear decides where hair and eyebrows get clipped (after the eyes, which may peek under a brim)
  const hw = getAsset(config.headwear.assetId);
  ctx.hat = hw && hw.hatInfo ? hw.hatInfo(m) : null;
  run(F.eyebrows.styleId, 'brows', F.eyebrows);
  run(F.mouth.styleId, 'mouth', F.mouth);
  run(F.facialHair.assetId, 'beard', F.facialHair);
  (F.details || []).forEach((d, i) => run(d.assetId, 'detail' + (i + 1), d));
  run(config.hair.assetId, 'hair', config.hair);
  run(config.headwear.assetId, 'hat', config.headwear);

  const C = config.clothing;
  run(C.bottom.assetId, 'bottom', C.bottom);
  run(C.top.assetId, 'top', C.top);
  run(C.outerwear.assetId, 'outer', C.outerwear);
  run(C.shoes.assetId, 'shoes', C.shoes);

  (config.accessories || []).forEach((a, i) => {
    const asset = getAsset(a.assetId);
    const point = asset.attach.points.includes(a.attachTo) ? a.attachTo : asset.attach.default;
    run(a.assetId, 'acc' + (i + 1), { ...a, attachTo: point, at: ctx.attach(point) });
  });

  return ctx.finish({ assets: [...new Set(used)] });
}
