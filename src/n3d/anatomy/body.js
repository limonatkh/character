/* =====================================================================
 * NORMAL 3D — BODY ANATOMY AS SMOOTH PRIMITIVES
 *
 * Torso masses (pelvis, glutes, abdomen, waist, rib cage, upper chest,
 * pecs / bust, lats, shoulder blades, trapezius, collarbones), neck,
 * arms with deltoid / biceps / triceps / forearm masses, hands with 15
 * finger segments + nails + knuckles, legs with quadriceps / hamstrings /
 * adductors / calves, knees, ankles and feet with toes. Muscle and fat
 * parameters change the size of the matching masses, not a global scale.
 * Every primitive is tied to a skeleton bone (skin weights follow).
 * ===================================================================== */
import { sphere, ellipsoid, roundCone, roundBox, frameFromY, frameFromEuler } from '../sdf/field.js';
import { BONE_INDEX as BI, v3 } from '../core/skeleton.js';
import { TAG } from './tags.js';

const lerp = (a, b, t) => a + (b - a) * t;

/** Rotation whose columns are the given axes (x, y, z). */
function axes(x, y, z) { return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]]; }

/**
 * @returns { union: [Prim], subtract: [Prim], marks }
 */
export function buildBody(rig) {
  const { P, dim, joints: J } = rig;
  const s = dim.H / 1.75;                      // overall scale
  const m = dim.m, st = rig.st;
  const mus = P.muscle, fat = P.bodyFat;
  const kS = 1 + 0.6 * st;
  const U = [], SUB = [];
  const o = (k, bone, tag = TAG.SKIN) => ({ k: k * s * kS, bone: BI[bone], tag });
  const R = v => v * s;

  const hipY = dim.hipY, shY = dim.shoulderY, neckY = J.neck[1];
  const span = shY - hipY;                     // hip joints → shoulder line (≈ 0.53 m)
  const yAt = t => hipY + span * t;            // torso height fraction
  const tS = span / 0.53;                      // torso vertical scale

  // widths (half) and depths
  const hipHalfW = R(lerp(0.172, 0.152, m)) * P.hipWidth * (1 + 0.12 * fat);
  const waistHalf = R(lerp(0.118, 0.138, m)) * P.waist * (1 + 0.28 * fat + 0.25 * P.belly);
  const chestHalf = R(lerp(0.136, 0.158, m)) * P.chestWidth * (1 + 0.06 * mus + 0.06 * fat);
  const chestDepth = R(lerp(0.104, 0.114, m)) * P.chestDepth * (1 + 0.08 * fat + 0.06 * mus);
  const shHalf = dim.shoulderHalf;

  // ---------------------------------------------------------------- torso
  U.push(ellipsoid([0, hipY + R(0.035), R(0.01)], [hipHalfW * 0.9, R(0.105) * tS, R(0.1) * (1 + 0.1 * fat)], o(0.06, 'hips')));
  for (const x of [-1, 1]) {
    U.push(ellipsoid([x * (hipHalfW - R(0.05)), hipY - R(0.012), R(0.004)], [R(0.05), R(0.08) * tS, R(0.07)], o(0.06, 'hips')));
    const g = P.glutes * (1 + 0.25 * fat) * lerp(1.12, 0.95, m);
    U.push(ellipsoid([x * R(0.07) * P.hipWidth, hipY - R(0.03), R(0.05) + R(0.012) * (g - 1)], [R(0.082) * g, R(0.1) * tS * Math.sqrt(g), R(0.072) * g], { ...o(0.05, 'hips'), m: frameFromEuler(0.15, 0, x * 0.1) }));
  }
  U.push(ellipsoid([0, yAt(0.22), R(-0.012)], [waistHalf * 1.02, R(0.1) * tS, R(0.085) * (1 + 0.25 * P.belly + 0.1 * fat)], o(0.07, 'spine')));
  U.push(ellipsoid([0, yAt(0.38), R(0.006)], [waistHalf, R(0.08) * tS, R(0.088) * (1 + 0.15 * fat)], o(0.07, 'spine')));
  U.push(ellipsoid([0, yAt(0.62), R(0.012)], [chestHalf, R(0.16) * tS, chestDepth], o(0.06, 'chest')));
  U.push(ellipsoid([0, shY - R(0.045), R(0.018)], [shHalf * 0.8, R(0.06) * tS, R(0.082)], o(0.05, 'upperChest')));
  // belly
  if (P.belly + fat > 0.25) {
    const b = P.belly * 0.8 + Math.max(0, fat - 0.25) * 0.4;
    U.push(ellipsoid([0, yAt(0.25), R(-0.045) - R(0.03) * b], [R(0.12) * (0.8 + 0.4 * b), R(0.11) * tS * (0.8 + 0.3 * b), R(0.06) * (0.6 + 0.8 * b)], o(0.07, 'spine')));
  }
  // pecs, bust, lats, shoulder blades, trapezius, collarbones, abs
  const pecS = (0.55 + 0.55 * mus) * lerp(0.6, 1.1, m);
  const bust = P.bust * Math.max(0, 1 - 1.35 * m) * (1 + 0.3 * fat);
  for (const x of [-1, 1]) {
    U.push(ellipsoid([x * R(0.068), shY - R(0.115) * tS, R(-0.06) - R(0.01) * pecS], [R(0.078) * (0.85 + 0.15 * pecS), R(0.05) * tS, R(0.024) * pecS], { ...o(0.05, 'upperChest'), m: frameFromEuler(-0.15, x * -0.3, x * -0.12) }));
    if (bust > 0.03) {
      const bs = 0.55 + 0.75 * bust;
      U.push(ellipsoid([x * R(0.07), shY - R(0.175) * tS - R(0.012) * bust, R(-0.07) - R(0.022) * bust], [R(0.058) * bs, R(0.055) * bs, R(0.048) * bs], { ...o(0.045, 'upperChest'), m: frameFromEuler(0.1, x * -0.3, 0) }));
    }
    U.push(ellipsoid([x * (chestHalf - R(0.022)), yAt(0.6), R(0.028)], [R(0.035) * (0.7 + 0.6 * mus), R(0.11) * tS, R(0.06)], o(0.05, 'chest')));
    U.push(ellipsoid([x * R(0.07), shY - R(0.1) * tS, R(0.078)], [R(0.055), R(0.07) * tS, R(0.024)], { ...o(0.05, 'upperChest'), m: frameFromEuler(0, 0, x * 0.2) }));
    U.push(roundCone([0, neckY - R(0.005), R(0.032)], [x * (shHalf - R(0.035)), shY - R(0.008), R(0.018)], R(0.04) * (0.85 + 0.35 * mus), R(0.032), o(0.04, 'upperChest')));
    U.push(roundCone([x * R(0.026), shY - R(0.016), R(-0.056)], [x * (shHalf - R(0.05)), shY - R(0.008), R(-0.03)], R(0.006), R(0.0065), o(0.04, x < 0 ? 'leftShoulder' : 'rightShoulder')));
  }
  if (mus > 0.45 && fat < 0.45) {
    // abdominal definition (subtle grooves)
    const a = (mus - 0.45) * (0.45 - fat) * 6;
    SUB.push(roundCone([0, yAt(0.5), R(-0.093)], [0, yAt(0.18), R(-0.085)], R(0.004) * a, R(0.004) * a, o(0.01, 'spine')));
    for (const t of [0.28, 0.38, 0.48]) SUB.push(roundCone([R(-0.04), yAt(t), R(-0.089)], [R(0.04), yAt(t), R(-0.089)], R(0.0025) * a, R(0.0025) * a, o(0.01, 'spine')));
  }
  // navel
  SUB.push(sphere([0, yAt(0.25), R(-0.088) - R(0.035) * (P.belly * 0.8 + Math.max(0, fat - 0.25) * 0.4)], R(0.0055), o(0.006, 'spine')));

  // ---------------------------------------------------------------- neck
  const nT = P.neckThickness * lerp(0.94, 1.07, m) * (1 + 0.12 * mus) * (1 - 0.15 * st);
  // neck: from the shoulders up to the skull base (behind and above the chin), narrowing
  const hS = dim.headH / 0.224;
  const skullBase = [0, dim.chinY + 0.062 * hS, J.head[2] + 0.012 * hS];
  U.push(roundCone([0, shY - R(0.03), R(0.014)], skullBase, R(0.056) * nT, R(0.044) * nT * hS, o(0.03, 'neck')));
  // throat: slopes forward up to under the chin
  U.push(roundCone([0, shY - R(0.01), R(-0.02)], [0, dim.chinY + 0.022 * hS, J.head[2] - 0.035 * hS], R(0.032) * nT, R(0.024) * nT, o(0.03, 'neck')));
  for (const x of [-1, 1]) {
    // sternocleidomastoid: behind the ear → top of the sternum
    U.push(roundCone([x * 0.046 * hS, dim.chinY + 0.075 * hS, J.head[2] + 0.012 * hS], [x * R(0.013), shY - R(0.014), R(-0.042)], R(0.011) * nT, R(0.011) * nT, o(0.018, 'neck')));
  }
  if (m > 0.6) U.push(ellipsoid([0, J.neck[1] + (J.head[1] - J.neck[1]) * 0.45, R(-0.045) * nT], [R(0.009), R(0.014), R(0.009)].map(v => v * (m - 0.55) * 2), o(0.015, 'neck')));

  // ---------------------------------------------------------------- arms and hands
  for (const side of ['left', 'right']) {
    const x = side === 'left' ? -1 : 1;
    const sh = J[side + 'UpperArm'], el = J[side + 'LowerArm'], wr = J[side + 'Hand'];
    const d1 = v3.norm(v3.sub(el, sh)), d2 = v3.norm(v3.sub(wr, el));
    const ua = P.upperArmThickness * lerp(0.9, 1.08, m) * (1 + 0.1 * fat);
    const fa = P.forearmThickness * lerp(0.9, 1.07, m) * (1 + 0.06 * fat);
    const at = (a, d, t, off) => v3.add(v3.add(a, v3.mul(d, t)), off);
    const UA = side + 'UpperArm', LA = side + 'LowerArm', HD = side + 'Hand';
    // deltoid
    const del = (0.75 + 0.45 * mus) * ua;
    U.push(ellipsoid(at(sh, d1, R(0.028), [x * R(0.008), R(0.006), 0]), [R(0.05) * del, R(0.072), R(0.052) * del], { ...o(0.04, UA), m: frameFromY(d1) }));
    // upper arm core + biceps + triceps
    U.push(roundCone(sh, el, R(0.047) * ua, R(0.037) * ua, o(0.03, UA)));
    const bic = (0.7 + 0.6 * mus) * ua, tri = (0.75 + 0.5 * mus) * ua;
    const front = v3.norm(v3.cross(d1, [x, 0, 0]).map(v => -v * x));      // toward −Z
    U.push(ellipsoid(at(sh, d1, dim.upperLen * 0.58, v3.mul([0, 0, -1], R(0.014))), [R(0.032) * bic, R(0.075), R(0.034) * bic], { ...o(0.025, UA), m: frameFromY(d1) }));
    U.push(ellipsoid(at(sh, d1, dim.upperLen * 0.42, v3.add(v3.mul([0, 0, 1], R(0.014)), [0, R(0.004), 0])), [R(0.034) * tri, R(0.085), R(0.032) * tri], { ...o(0.025, UA), m: frameFromY(d1) }));
    // elbow
    U.push(sphere(v3.add(el, [0, 0, R(0.006)]), R(0.03) * Math.sqrt(fa), o(0.025, LA)));
    // forearm: wide across (thumb ↔ little finger), flatter front-back
    const n = J['_' + side + 'HandNormal'], fw = J['_' + side + 'HandFwd'];
    U.push(roundCone(el, wr, R(0.038) * fa, R(0.025) * fa, { ...o(0.025, LA), flat: [1.18, 0.78], zHint: n }));
    U.push(ellipsoid(at(el, d2, dim.lowerLen * 0.28, [0, 0, 0]), [R(0.042) * fa * (0.85 + 0.3 * mus), R(0.075), R(0.033) * fa], { ...o(0.028, LA), m: axes(fw, d2, n) }));
    // hand
    const hs = dim.handLen / 0.189;
    const palmLen = dim.handLen * 0.47;
    const pc = v3.add(v3.add(wr, v3.mul(d2, palmLen * 0.55)), v3.mul(n, R(-0.002)));
    U.push(roundBox(pc, [R(0.038) * hs * Math.pow(P.fingerThickness, 0.3), palmLen * 0.52, R(0.0135) * hs], R(0.011) * hs, { ...o(0.012, HD), m: axes(fw, d2, n) }));
    U.push(ellipsoid(v3.add(v3.add(wr, v3.mul(d2, palmLen * 0.3)), v3.add(v3.mul(fw, R(0.022) * hs), v3.mul(n, R(0.01) * hs))), [R(0.016) * hs, R(0.03) * hs, R(0.012) * hs], { ...o(0.012, HD), m: axes(fw, d2, n) }));
    U.push(sphere(v3.add(wr, v3.mul(d2, R(0.006))), R(0.024) * fa, o(0.02, HD)));
    // fingers
    const ft = P.fingerThickness * hs * lerp(0.92, 1.06, m);
    for (const name of ['Thumb', 'Index', 'Middle', 'Ring', 'Little']) {
      const segs = name === 'Thumb' ? ['Metacarpal', 'Proximal', 'Distal'] : ['Proximal', 'Intermediate', 'Distal'];
      const pts = segs.map(sg => J[side + name + sg]).concat([J['_' + side + name + 'Tip']]);
      const base = name === 'Thumb' ? 0.0115 : name === 'Little' ? 0.0078 : name === 'Index' ? 0.0092 : 0.0095;
      for (let i = 0; i < 3; i++) {
        const r1 = R(base * (1 - 0.1 * i)) * ft, r2 = R(base * (0.92 - 0.12 * i)) * ft;
        const bone = side + name + segs[i];
        // keep the tip inside the fingertip length
        const endP = i === 2 ? v3.lerp(pts[i], pts[i + 1], 0.85) : pts[i + 1];
        U.push(roundCone(pts[i], endP, r1, r2, o(i === 0 ? (name === 'Thumb' ? 0.014 : 0.008) : 0.003, bone)));
      }
      // nail on the back of the distal segment (back of hand = −n)
      const dd = v3.norm(v3.sub(pts[3], pts[2]));
      const nailC = v3.add(v3.lerp(pts[2], pts[3], 0.55), v3.mul(n, -R(base * 0.45) * ft));
      U.push(ellipsoid(nailC, [R(base * 0.62) * ft, R(base * 0.95) * ft, R(base * 0.38) * ft], { ...o(0.0025, side + name + 'Distal', TAG.NAIL), m: axes(v3.norm(v3.cross(dd, n)), dd, n) }));
      // knuckle
      if (name !== 'Thumb') U.push(sphere(v3.add(pts[0], v3.mul(n, -R(0.006) * ft)), R(base * 0.95) * ft, o(0.006, side + name + 'Proximal')));
    }
  }

  // ---------------------------------------------------------------- legs and feet
  for (const side of ['left', 'right']) {
    const x = side === 'left' ? -1 : 1;
    const hp = J[side + 'UpperLeg'], kn = J[side + 'LowerLeg'], an = J[side + 'Foot'], toe = J[side + 'Toes'];
    const UL = side + 'UpperLeg', LL = side + 'LowerLeg', FT = side + 'Foot', TO = side + 'Toes';
    const d1 = v3.norm(v3.sub(kn, hp)), d2 = v3.norm(v3.sub(an, kn));
    const th = P.thighThickness * lerp(1.04, 0.98, m) * (1 + 0.2 * fat);
    const cf = P.calfThickness * (1 + 0.1 * fat) * (0.9 + 0.2 * mus);
    const at = (a, d, t, off) => v3.add(v3.add(a, v3.mul(d, t)), off);
    const thighL = v3.len(v3.sub(kn, hp)), shinL = v3.len(v3.sub(an, kn));
    U.push(roundCone(v3.add(hp, [x * R(0.006), R(0.02), 0]), kn, R(0.082) * th, R(0.05) * Math.sqrt(th), o(0.05, UL)));
    const q = (0.75 + 0.5 * mus) * th;
    U.push(ellipsoid(at(hp, d1, thighL * 0.48, [x * R(0.008), 0, R(-0.028)]), [R(0.058) * q, thighL * 0.36, R(0.047) * q], { ...o(0.04, UL), m: frameFromY(d1) }));
    U.push(ellipsoid(at(hp, d1, thighL * 0.42, [0, 0, R(0.03)]), [R(0.05) * th, thighL * 0.36, R(0.042) * th], { ...o(0.04, UL), m: frameFromY(d1) }));
    U.push(ellipsoid(at(hp, d1, thighL * 0.24, [-x * R(0.035), 0, R(0.004)]), [R(0.042) * th, thighL * 0.24, R(0.05) * th], { ...o(0.045, UL), m: frameFromY(d1) }));
    if (m < 0.5 || fat > 0.4) {
      const sw = Math.max(0, 0.5 - m) * 1.2 + Math.max(0, fat - 0.4);
      U.push(ellipsoid(at(hp, d1, thighL * 0.12, [x * R(0.04), 0, R(0.01)]), [R(0.04) * (0.6 + sw), thighL * 0.2, R(0.05)], { ...o(0.05, UL), m: frameFromY(d1) }));
    }
    // knee
    U.push(sphere(v3.add(kn, [0, R(0.008), R(0.004)]), R(0.046) * Math.sqrt(th), o(0.03, LL)));
    U.push(ellipsoid(v3.add(kn, [0, R(0.012), R(-0.04)]), [R(0.024), R(0.028), R(0.012)], o(0.018, LL)));
    // shin and calf
    U.push(roundCone(kn, an, R(0.045) * Math.sqrt(cf), R(0.028), o(0.03, LL)));
    U.push(ellipsoid(at(kn, d2, shinL * 0.3, [-x * R(0.004), 0, R(0.022)]), [R(0.044) * cf, shinL * 0.24, R(0.042) * cf], { ...o(0.035, LL), m: frameFromY(d2) }));
    // ankle bones
    U.push(sphere(v3.add(an, [x * R(0.019), R(0.004), R(0.004)]), R(0.012), o(0.012, LL)));
    U.push(sphere(v3.add(an, [-x * R(0.017), R(0.012), R(0.0)]), R(0.012), o(0.012, LL)));
    // foot
    const fs = dim.footLen / 0.266;
    const heel = [an[0], R(0.032), an[2] + R(0.035) * fs];
    U.push(ellipsoid(heel, [R(0.03), R(0.032), R(0.037) * fs], o(0.02, FT)));
    const ball = [toe[0], R(0.022), toe[2]];
    U.push(roundCone([an[0] - x * R(0.002), R(0.042), an[2] + R(0.0)], ball, R(0.034), R(0.022), { ...o(0.025, FT), flat: [1.5, 0.75], zHint: [0, 1, 0] }));
    U.push(roundCone(heel, ball, R(0.026), R(0.02), { ...o(0.02, FT), flat: [1.6, 0.8], zHint: [0, 1, 0] }));
    // toes: big toe + four small toes
    const fwd = [0, 0, -1];
    const toeLen = dim.footLen * 0.24;
    const toeRow = [-0.026, -0.012, 0.0, 0.011, 0.021].map(v => v * fs);
    toeRow.forEach((ox, i) => {
      const px = toe[0] - x * ox - x * R(0.006);
      const base = [px, R(0.016), ball[2] - R(0.004)];
      const len = toeLen * [1.0, 0.85, 0.78, 0.7, 0.6][i];
      const tip = [px - x * R(0.002) * i, R(0.011), base[2] - len];
      const rr = [0.0115, 0.0075, 0.007, 0.0065, 0.006][i] * fs;
      U.push(roundCone(base, tip, R(rr), R(rr * 0.85), o(i === 0 ? 0.006 : 0.004, TO)));
      U.push(ellipsoid(v3.add(v3.lerp(base, tip, 0.8), [0, R(rr * 0.7), 0]), [R(rr * 0.7), R(0.001), R(rr * 0.8)], o(0.0015, TO, TAG.NAIL)));
    });
  }

  const marks = {
    hipY, shoulderY: shY, waistY: yAt(0.38), chestY: yAt(0.62), underBustY: shY - R(0.215) * tS, crotchY: hipY - R(0.065) * tS,
    hipHalfW, waistHalf, chestHalf, chestDepth, shoulderHalf: shHalf, neckR: R(0.056) * nT,
    footLen: dim.footLen, s, tS,
  };
  return { union: U, subtract: SUB, marks };
}
