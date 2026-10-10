/* =====================================================================
 * BODY MEASUREMENTS + BASE (SKIN) BODY
 *
 * measure() turns a body type, a head shape and the proportion sliders
 * into concrete numbers (in voxel px) and joint rest positions. Every
 * asset builds against these numbers, which is why clothes and hair fit
 * any body type and any proportions without per-body variants.
 * ===================================================================== */
import { JOINTS } from './skeleton.js';

export const PROPORTION_DEFAULTS = {
  headScale: 1, torsoWidth: 1, torsoLength: 1, armLength: 1, legLength: 1, limbThickness: 1,
};

const r3 = v => Math.round(v * 1000) / 1000;

export function measure(bodyType, headShape, proportions) {
  const b = bodyType.measure;
  const P = { ...PROPORTION_DEFAULTS, ...(proportions || {}) };
  const lt = P.limbThickness;

  const foot = { h: b.foot.h, len: b.foot.len * (0.85 + 0.15 * lt), w: b.foot.w * (0.8 + 0.2 * lt) };
  const leg = {
    w: b.leg.w * lt, d: b.leg.d * lt,
    clothW: b.leg.clothW * lt, clothD: b.leg.clothD * lt,
    len: b.leg.len * P.legLength,
  };
  const torso = {
    w: b.torso.w * P.torsoWidth, wLow: b.torso.wLow * P.torsoWidth,
    d: b.torso.d * (0.85 + 0.15 * P.torsoWidth), h: b.torso.h * P.torsoLength,
  };
  const neck = { w: b.neck.w * lt, len: b.neck.len };
  const arm = {
    w: b.arm.w * lt, d: b.arm.d * lt, clothW: b.arm.clothW * lt, clothD: b.arm.clothD * lt,
    upper: b.arm.upper * P.armLength, lower: b.arm.lower * P.armLength,
  };
  const hk = 0.75 + 0.25 * lt;
  const hand = { w: b.hand.w * hk, h: b.hand.h * hk, d: b.hand.d * hk, style: b.hand.style };
  const hs = headShape.dims || { w: 1, h: 1, d: 1 };
  const head = { w: b.head.w * P.headScale * hs.w, h: b.head.h * P.headScale * hs.h, d: b.head.d * P.headScale * hs.d };

  // ----- vertical layout (y = 0 at the soles) -----
  const ankleY = foot.h;
  const kneeY = ankleY + leg.len * 0.5;
  const hipY = ankleY + leg.len;
  const hipX = Math.max(b.hipX * (0.5 + 0.5 * P.torsoWidth), leg.w / 2 + 0.08);
  torso.y0 = hipY;
  torso.y1 = hipY + torso.h;
  torso.yMid = hipY + torso.h * 0.45;
  const spineY = hipY + torso.h * 0.22;
  const chestY = torso.yMid;
  const neckY = torso.y1;
  const headY = torso.y1 + neck.len;
  const shoulderY = torso.y1 - Math.min(0.8, torso.h * 0.12);
  const shoulderX = torso.w / 2 + arm.w / 2 + 0.05;
  const handOffset = Math.max(0, torso.wLow / 2 + hand.w / 2 + 0.12 - shoulderX);
  const elbowY = shoulderY - arm.upper;
  const wristY = elbowY - arm.lower;

  // ----- head frame -----
  head.y0 = headY; head.y1 = headY + head.h;
  head.x0 = -head.w / 2; head.x1 = head.w / 2;
  head.z0 = -head.d / 2; head.z1 = head.d / 2;
  head.layers = headShape.layers(head);            // skin boxes making up the head shape
  head.faceZ = headShape.faceZ(head);              // front plane of the face
  const f = headShape.face;
  head.s = head.w / 7.2;                           // detail scale vs. the Limonat hero head
  head.t = head.h / 7.0;
  head.eyeY = head.y0 + head.h * f.eyeY;
  head.eyeX = head.w * f.eyeX;
  head.mouthY = head.y0 + head.h * f.mouthY;
  head.browY = head.y0 + head.h * f.browY;
  head.hairline = head.y0 + head.h * f.hairline;

  const m = {
    bodyType: bodyType.id, headShape: headShape.id, hands: hand.style, limbStyle: b.limbStyle || 'block',
    proportions: P, foot, leg, torso, neck, arm, hand, head,
    ankleY, kneeY, hipY, hipX, spineY, chestY, neckY, headY, shoulderY, shoulderX, handOffset, elbowY, wristY,
  };
  m.joints = jointPositions(m);
  return m;
}

function jointPositions(m) {
  const p = {
    hips: [0, m.hipY, 0], spine: [0, m.spineY, 0], chest: [0, m.chestY, 0], neck: [0, m.neckY, 0], head: [0, m.headY, 0],
    leftEye: [-m.head.eyeX, m.head.eyeY, m.head.faceZ], rightEye: [m.head.eyeX, m.head.eyeY, m.head.faceZ],
    jaw: [0, m.head.mouthY, m.head.faceZ],
  };
  for (const [s, side] of [[-1, 'left'], [1, 'right']]) {
    p[side + 'UpperArm'] = [s * m.shoulderX, m.shoulderY, 0];
    p[side + 'LowerArm'] = [s * m.shoulderX, m.elbowY, 0];
    p[side + 'Hand'] = [s * m.shoulderX, m.wristY, 0];
    p[side + 'UpperLeg'] = [s * m.hipX, m.hipY, 0];
    p[side + 'LowerLeg'] = [s * m.hipX, m.kneeY, 0];
    p[side + 'Foot'] = [s * m.hipX, m.ankleY, 0];
  }
  return JOINTS.map(j => ({ name: j.name, parent: j.parent, pos: p[j.name].map(r3) }));
}

/** The bare body in skin colour. Clothing is layered over it. */
export function buildBaseBody(ctx, skin) {
  const m = ctx.m, T = m.torso, A = m.arm, L = m.leg, F = m.foot, H = m.hand;
  // pelvis + torso
  ctx.boxC('hips', 0, m.hipY - 0.6, 0, T.wLow * 0.96, 1.2, T.d * 0.96, skin.main);
  ctx.boxC('spine', 0, m.hipY, 0, T.wLow, T.yMid - m.hipY + 0.05, T.d, skin.main);
  ctx.boxC('chest', 0, T.yMid, 0, T.w, T.y1 - T.yMid, T.d, skin.main);
  ctx.box('chest', T.w / 2 - 0.04, T.yMid + 0.1, -T.d / 2 + 0.1, 0.1, T.y1 - T.yMid - 0.2, T.d - 0.2, skin.mainShade); // side shading (+X), Limonat style
  // neck
  ctx.boxC('neck', 0, T.y1 - 0.3, 0, m.neck.w, m.headY - T.y1 + 0.6, m.neck.w, skin.main);
  ctx.mirror((s, side) => {
    const x = s * m.shoulderX;
    // shoulder nub joins thin "stick" arms to the torso
    if (A.w < 1.2) {
      const x0 = s < 0 ? x - A.w / 2 - 0.15 : T.w / 2 - 0.4;
      const x1 = s < 0 ? -T.w / 2 + 0.4 : x + A.w / 2 + 0.15;
      ctx.box('chest', x0, m.shoulderY - 0.35, -A.d / 2 - 0.25, x1 - x0, 0.85, A.d + 0.5, skin.main);
    }
    ctx.boxC(side + 'UpperArm', x, m.elbowY - 0.05, 0, A.w, m.shoulderY + 0.3 - m.elbowY + 0.05, A.d, skin.main);
    ctx.boxC(side + 'LowerArm', x, m.wristY - 0.1, 0, A.w, m.elbowY - m.wristY + 0.15, A.d, skin.main);
    // hands
    const hx = x + s * m.handOffset;
    if (H.style === 'mitten') {
      // Limonat mitten: a rounded block plus a thumb toward the body
      ctx.boxC(side + 'Hand', hx, m.wristY - H.h, 0, H.w, H.h, H.d, skin.main);
      ctx.boxC(side + 'Hand', hx, m.wristY - H.h + 0.25, 0, H.w + 0.12, H.h - 0.5, H.d - 0.4, skin.main);
      ctx.boxC(side + 'Hand', hx - s * (H.w / 2 + 0.15), m.wristY - H.h * 0.72, -H.d * 0.15, 0.6, H.h * 0.48, H.d * 0.55, skin.main);
      ctx.box(side + 'Hand', s > 0 ? hx + H.w / 2 + 0.02 : hx - H.w / 2 - 0.12, m.wristY - H.h + 0.2, -H.d / 2 + 0.15, 0.1, H.h - 0.4, H.d - 0.3, skin.mainShade);
    } else {
      ctx.boxC(side + 'Hand', hx, m.wristY - H.h, 0, H.w, H.h + 0.1, H.d, skin.main);
    }
    // legs
    const lx = s * m.hipX;
    ctx.boxC(side + 'UpperLeg', lx, m.kneeY - 0.05, 0, L.w, m.hipY + 0.2 - m.kneeY + 0.05, L.d, skin.main);
    ctx.boxC(side + 'LowerLeg', lx, m.ankleY - 0.1, 0, L.w, m.kneeY - m.ankleY + 0.15, L.d, skin.main);
    // bare foot (hidden by most shoes)
    ctx.boxC(side + 'Foot', lx + s * 0.1, 0, -F.len * 0.18, F.w * 0.72, F.h * 0.62, F.len * 0.78, skin.main);
  });
}
