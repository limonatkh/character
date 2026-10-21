/* =====================================================================
 * NORMAL 3D — HEAD AND FACE
 *
 * A canonical adult head (chin at y = 0, top at 0.224 m, ear axis at z = 0,
 * face toward −Z) built from independent anatomical features: cranium,
 * forehead, brow ridge, eye sockets + eyelids (with a real almond-shaped
 * opening), nose (bridge, tip, wings, nostrils), lips (upper with cupid's
 * bow, lower, mouth line), cheekbones, cheeks, jaw, chin, ears.
 * Every face parameter moves or reshapes only its own features.
 * The canonical head is then scaled and placed on the skeleton.
 * ===================================================================== */
import { sphere, ellipsoid, roundCone, custom, frameFromEuler } from '../sdf/field.js';
import { completeParams, FACE_PARAMS } from '../core/params.js';
import { BONE_INDEX } from '../core/skeleton.js';
import { TAG } from './tags.js';

const HEAD = BONE_INDEX.head, JAW = BONE_INDEX.jaw;
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * @param rig   output of buildRig
 * @param face  face params (−1..1, partial ok)
 * @returns { union: [Prim], subtract: [Prim], late: [Prim], lateSubtract: [Prim], eyes: [..], marks: {...} }
 */
export function buildHead(rig, faceIn) {
  const f = completeParams(FACE_PARAMS, faceIn);
  const { dim } = rig, st = rig.st, mg = (dim.m - 0.5) * 2;   // masculinity −1..1
  const S = dim.headH / 0.224;
  const O = [0, dim.chinY, rig.joints.head[2] - 0.02 * S];
  const kS = 1 + 0.9 * st;                                     // stylized: softer blends
  const W = (x, y, z) => [O[0] + x * S, O[1] + y * S, O[2] + z * S];
  const r = v => v * S;

  // derived feature values -----------------------------------------------------
  const faceW = 1 + 0.05 * f.headWidth;
  const eyeY0 = 0.113 + 0.005 * f.eyeHeight - 0.004 * f.foreheadHeight - 0.012 * st;
  const lowY = y => eyeY0 - (eyeY0 - y) * (1 + 0.08 * f.faceLength - 0.08 * st);   // lower-face length
  const noseK = (1 - 0.45 * st) * (1 + 0.08 * mg);
  const eyeR = 0.0118 * (1 + 0.12 * f.eyeSize) * (1 + 0.55 * st);
  const eyeX = 0.0315 * (1 + 0.08 * f.eyeSpacing) * faceW * (1 + 0.12 * st);
  const eyeZ = -0.0715 + 0.004 * f.eyeDepth - 0.006 * st + (eyeR - 0.0118) * 0.6;
  const browY = eyeY0 + 0.018 + 0.005 * f.browHeight + 0.002 * st;
  const browRidge = Math.max(0, 1 + 0.4 * f.browRidge + 0.45 * mg - 0.8 * st);

  const U = [], SUB = [], LATE = [], LATESUB = [];
  const o = (k, bone = HEAD, tag = TAG.SKIN) => ({ k: k * S * kS, bone, tag });

  // ---- cranium and forehead
  U.push(ellipsoid(W(0, 0.138 + 0.005 * f.craniumHeight + 0.008 * st, 0.012 + 0.006 * f.headDepth), [r(0.075 * (1 + 0.08 * f.headWidth) * (1 + 0.1 * st)), r(0.088 * (1 + 0.07 * f.craniumHeight) * (1 + 0.12 * st)), r(0.097 * (1 + 0.08 * f.headDepth) * (1 + 0.06 * st))], o(0.02)));
  U.push(ellipsoid(W(0, 0.152 - 0.004 * f.foreheadHeight, -0.052 + 0.012 * f.foreheadSlope), [r(0.062 * faceW), r(0.05 * (1 + 0.1 * f.foreheadHeight)), r(0.04)], { ...o(0.03), m: frameFromEuler(-0.25 * f.foreheadSlope, 0, 0) }));
  // occipital bump and temples
  U.push(ellipsoid(W(0, 0.118, 0.07 + 0.006 * f.headDepth), [r(0.062), r(0.06), r(0.04)], o(0.03)));

  // ---- brow ridge
  if (browRidge > 0.05) {
    const br = 0.0088 * browRidge;
    U.push(roundCone(W(-0.044 * faceW, browY - 0.003, -0.074 - 0.003 * browRidge), W(-0.011, browY - 0.002, -0.082 - 0.003 * browRidge), r(br * 0.8), r(br), o(0.018)));
    U.push(roundCone(W(0.044 * faceW, browY - 0.003, -0.074 - 0.003 * browRidge), W(0.011, browY - 0.002, -0.082 - 0.003 * browRidge), r(br * 0.8), r(br), o(0.018)));
  }

  // ---- midface (maxilla) and muzzle
  U.push(ellipsoid(W(0, lowY(0.092), -0.043), [r(0.06 * faceW), r(0.058), r(0.046)], o(0.03)));
  U.push(ellipsoid(W(0, lowY(0.058), -0.068 - 0.003 * f.lipProjection), [r(0.037 * (1 + 0.1 * f.mouthWidth)), r(0.03), r(0.028)], o(0.022)));

  // ---- cheekbones and cheeks
  const cbS = Math.max(0.3, 1 + 0.35 * f.cheekbones + 0.1 * mg - 0.3 * st);
  const chS = Math.max(0.4, 1 + 0.3 * f.cheekFullness - 0.15 * mg + 0.35 * st);
  for (const s of [-1, 1]) {
    U.push(ellipsoid(W(s * 0.05 * faceW * (1 + 0.04 * f.cheekbones), lowY(0.096), -0.054), [r(0.02 * cbS), r(0.011 * cbS), r(0.018 * cbS)], { ...o(0.026), m: frameFromEuler(0, s * 0.5, s * -0.25) }));
    U.push(ellipsoid(W(s * 0.041 * faceW, lowY(0.07), -0.064), [r(0.025 * chS), r(0.026 * chS), r(0.02 * chS)], o(0.024)));
    U.push(ellipsoid(W(s * 0.043 * faceW, lowY(0.058), -0.045), [r(0.02 * chS), r(0.024 * chS), r(0.024)], o(0.03)));
  }

  // ---- jaw and chin (on the jaw bone)
  const jawW = 0.049 * faceW * (1 + 0.12 * f.jawWidth + 0.07 * mg - 0.08 * st);
  const jawSq = Math.max(0, 0.5 + 0.5 * f.jawAngle + 0.35 * mg - 0.6 * st);
  const chinY = lowY(0.016 - 0.006 * f.chinLength), chinZ = -0.077 - 0.008 * f.chinProjection + 0.004 * st;
  const chinW = 0.021 * (1 + 0.25 * f.chinWidth + 0.15 * mg);
  for (const s of [-1, 1]) {
    U.push(roundCone(W(s * jawW, lowY(0.044), -0.006), W(s * chinW * 0.7, chinY + 0.004, chinZ + 0.01), r(0.0125 + 0.002 * jawSq), r(0.014), o(lerp(0.03, 0.016, jawSq), JAW)));
    if (jawSq > 0.15) U.push(sphere(W(s * jawW * 0.97, lowY(0.04), -0.008), r(0.008 * jawSq + 0.003), o(0.018, JAW)));
    // masseter (cheekbone → jaw angle) and the soft area between jaw, ear and neck
    U.push(ellipsoid(W(s * jawW * 0.93, lowY(0.068), -0.018), [r(0.012), r(0.028), r(0.022)], { ...o(0.032), m: frameFromEuler(0.25, 0, s * 0.1) }));
    U.push(ellipsoid(W(s * jawW * 0.9, lowY(0.07), 0.012), [r(0.018), r(0.028), r(0.022)], o(0.03)));
  }
  U.push(ellipsoid(W(0, chinY, chinZ), [r(chinW), r(0.019 * (1 + 0.15 * f.chinLength)), r(0.015)], o(0.02, JAW)));
  U.push(ellipsoid(W(0, lowY(0.04), -0.048), [r(0.04 * faceW), r(0.034), r(0.038)], o(0.03, JAW)));
  if (f.chinCleft > 0.02) SUB.push(roundCone(W(0, chinY + 0.006, chinZ - 0.017), W(0, chinY - 0.008, chinZ - 0.016), r(0.0018 * f.chinCleft), r(0.0018 * f.chinCleft), o(0.004, JAW)));

  // ---- eyes: sockets now, lids later (after the sockets are carved)
  const eyes = [];
  const A = 1.18 * (1 - 0.12 * f.eyeShape) * (1 + 0.08 * st);                  // half-width of the opening (rad)
  const Eu = 0.52 * (1 + 0.3 * f.eyeOpen) * (1 + 0.15 * f.eyeShape) * (1 + 0.25 * st) * (1 - 0.25 * f.lidHood);
  const El = 0.46 * (1 + 0.25 * f.eyeOpen) * (1 + 0.1 * f.eyeShape) * (1 + 0.2 * st);
  const pw = 1.1 - 0.45 * f.eyeShape - 0.2 * st;                              // almond (sharp corners) → round
  const tilt = 0.14 * f.eyeTilt + 0.03;
  for (const s of [-1, 1]) {
    const c = W(s * eyeX, eyeY0, eyeZ);
    const R = r(eyeR);
    // orbit: hollow around the eye (refilled by the lid bulb below), plus the hollow under the brow
    SUB.push(ellipsoid(W(s * eyeX * 1.04, eyeY0 + 0.0005, eyeZ - 0.0035), [r(0.0178 * (1 + 0.3 * st)), r(0.0128 * (1 + 0.3 * st)), r(0.0125)], o(0.007)));
    SUB.push(ellipsoid(W(s * eyeX * 1.02, eyeY0 + 0.01, eyeZ - 0.016 - 0.003 * f.eyeDepth), [r(0.016), r(0.007), r(0.007)], o(0.012)));
    const eye = { side: s < 0 ? 'left' : 'right', s, center: c, radius: R, u: [s, 0, 0], v: [0, 1, 0], w: [0, 0, -1], A, Eu, El, pw, tilt: s > 0 ? tilt : tilt, lid: r(0.0029 + 0.0006 * st) };
    eyes.push(eye);
    LATE.push(sphere(c, R + eye.lid, o(0.006)));          // lid bulb over the eyeball
    LATESUB.push(eyeOpening(eye, o(0.0016)));               // the almond-shaped opening
    // lid fold / hooded lid fat pad
    const hood = 0.25 + 0.75 * f.lidHood;
    LATE.push(ellipsoid(W(s * eyeX * 1.04, eyeY0 + eyeR * 0.82, eyeZ - eyeR * 0.45), [r(0.016), r(0.004 + 0.003 * hood), r(0.007 + 0.003 * hood)], { ...o(0.006), m: frameFromEuler(0.5, 0, s * -0.12) }));
    // under-eye / lower lid fat
    LATE.push(ellipsoid(W(s * eyeX * 1.02, eyeY0 - eyeR * 1.0, eyeZ - eyeR * 0.5), [r(0.013), r(0.003), r(0.005)], { ...o(0.008), m: frameFromEuler(-0.4, 0, 0) }));
  }

  // ---- nose: bridge (two segments for the profile), tip, wings, columella
  const nl = 1 + 0.12 * f.noseLength;
  const nasion = [0, browY - 0.006, -0.0875 - 0.003 * f.noseBridge];
  const tipY = lowY(0.078 - 0.008 * f.noseLength + 0.003 * f.noseTipUpturn);
  const tipZ = -0.112 - 0.006 * f.noseBridge * noseK - 0.004 * (noseK - 1);
  const mid = [0, (nasion[1] + tipY) / 2, (nasion[2] + tipZ) / 2 - 0.002 - 0.0045 * f.noseHook];
  const bw = 0.0065 * (1 + 0.3 * f.noseBridgeWidth) * noseK;
  U.push(roundCone(W(...nasion), W(...mid), r(bw * 0.95), r(bw), o(0.01)));
  U.push(roundCone(W(...mid), W(0, tipY + 0.004, tipZ + 0.004), r(bw), r(bw * 1.15), o(0.008)));
  const tipR = 0.0095 * (1 + 0.25 * f.noseTip) * noseK;
  U.push(ellipsoid(W(0, tipY, tipZ + tipR * 0.25), [r(tipR * 1.05), r(tipR * 0.95), r(tipR)], { ...o(0.006), m: frameFromEuler(0.3 * f.noseTipUpturn, 0, 0) }));
  const alaX = 0.0125 * (1 + 0.2 * f.noseWidth) * noseK;
  for (const s of [-1, 1]) {
    U.push(ellipsoid(W(s * alaX, tipY - 0.0045, tipZ + 0.015), [r(0.0074 * noseK * (1 + 0.15 * f.noseWidth)), r(0.0064 * noseK), r(0.0078 * noseK)], { ...o(0.006), m: frameFromEuler(0, s * 0.35, 0) }));
    // nostrils: shallow openings on the underside (carved after the wings)
    LATESUB.push(ellipsoid(W(s * alaX * 0.6, tipY - 0.0098, tipZ + 0.0118), [r(0.0036 * noseK * (1 + 0.15 * f.noseWidth)), r(0.0028 * noseK), r(0.0052 * noseK)], { ...o(0.0018), m: frameFromEuler(0.35, s * 0.4, 0) }));
  }
  U.push(ellipsoid(W(0, tipY - 0.005, tipZ + 0.008), [r(0.0075 * noseK), r(0.0055), r(0.009 * noseK)], o(0.006)));

  // ---- mouth: carve the groove between the lips, then add the lips
  const mouthY = lowY(0.047);
  const mw = 0.025 * (1 + 0.15 * f.mouthWidth) * (1 - 0.1 * st);
  const lipZ = -0.088 - 0.004 * f.lipProjection;
  const ul = Math.max(0.3, 1 + 0.35 * f.upperLip - 0.15 * mg);
  const ll = Math.max(0.3, 1 + 0.35 * f.lowerLip - 0.15 * mg);
  const cb = Math.max(0, 1 + 0.8 * f.cupidsBow - st);
  const corner = 0.0035 * f.mouthCorners;
  // philtrum
  SUB.push(roundCone(W(0, tipY - 0.016, tipZ + 0.019), W(0, mouthY + 0.009 * ul, lipZ - 0.0042), r(0.0022), r(0.002), o(0.005)));
  // Lips: chains of overlapping ellipsoids along the lip curves, so the outline can be
  // shaped (cupid's bow, central tubercle, fuller lower lip, thin corners).
  const N = 9;
  for (let i = 0; i <= N; i++) {
    const t = i / N * 2 - 1;                             // −1 (character's left corner) … 1
    const a = Math.abs(t);
    const x = t * mw * 0.94;
    const yC = corner * a * a;                         // corners lift for a smile
    // upper lip: thick in the centre with a slight downward tubercle, thin at the corners
    const uh = 0.0047 * ul * (1 - 0.55 * a * a) * (1 + 0.15 * Math.max(0, 1 - a * 4));
    const uy = mouthY + 0.0012 + uh * 0.8 + yC + 0.0013 * cb * Math.exp(-Math.pow((a - 0.22) / 0.12, 2)) - 0.0008 * Math.max(0, 1 - a * 5);
    const uz = lipZ - 0.0012 + 0.0075 * a * a;           // the lip curves back around the teeth
    LATE.push(ellipsoid(W(x, uy, uz), [r(mw * 0.16), r(uh), r(0.0072 * ul * (1 - 0.35 * a))], { ...o(0.0035, HEAD, TAG.LIPS), m: frameFromEuler(-0.45, t * 0.5, 0) }));
    // lower lip: fuller, crescent-shaped
    const lh = 0.0058 * ll * (1 - 0.6 * a * a);
    const ly = mouthY - 0.0012 - lh * 0.85 + yC * 0.8;
    const lz = lipZ - 0.0006 + 0.008 * a * a;
    LATE.push(ellipsoid(W(x * 0.94, ly, lz), [r(mw * 0.16), r(lh), r(0.0082 * ll * (1 - 0.4 * a))], { ...o(0.0035, JAW, TAG.LIPS), m: frameFromEuler(0.4, t * 0.5, 0) }));
  }
  // mouth line with tiltable corners
  for (const s of [-1, 1]) {
    LATESUB.push(ellipsoid(W(s * mw * 0.46, mouthY + corner * 0.6, lipZ - 0.0075), [r(mw * 0.6), r(0.0014), r(0.0045)], { ...o(0.0016), m: frameFromEuler(0, 0, s * corner * 14) }));
  }
  // groove under the lower lip
  SUB.push(ellipsoid(W(0, lowY(0.031), -0.0885), [r(0.016), r(0.0035), r(0.006)], o(0.008, JAW)));

  // ---- ears
  const earS = (1 + 0.15 * f.earSize) * (1 - 0.15 * st);
  const earY = eyeY0 - 0.012 + 0.006 * f.earHeight;
  const prot = 0.2 + 0.28 * f.earProtrusion;
  for (const s of [-1, 1]) {
    const ex = s * (0.0715 * (1 + 0.07 * f.headWidth) + 0.003);
    const m = frameFromEuler(0, s * -prot, 0);
    const ec = W(ex, earY, 0.01);
    U.push(ellipsoid(ec, [r(0.0065 * earS), r(0.031 * earS), r(0.0185 * earS)], { ...o(0.004), m: mulM(m, frameFromEuler(0.12, 0, 0)) }));
    // helix rim
    U.push(custom(earRim(ec, s, r(0.0155 * earS), r(0.026 * earS), r(0.0032 * earS), prot), boxAround(ec, r(0.034 * earS)), o(0.003)));
    // lobe
    U.push(sphere(W(ex + s * 0.002, earY - 0.026 * earS, 0.008), r(0.0075 * earS), o(0.004)));
    if (f.earPoint > 0.02) U.push(roundCone(W(ex + s * 0.002, earY + 0.022 * earS, 0.016), W(ex + s * 0.006 * f.earPoint, earY + (0.032 + 0.022 * f.earPoint) * earS, 0.03 + 0.012 * f.earPoint), r(0.008 * earS), r(0.0015), o(0.006)));
    // concha (bowl) carved on the outer side
    LATESUB.push(ellipsoid(W(ex + s * 0.0072 * earS, earY - 0.003, 0.006), [r(0.0045 * earS), r(0.0115 * earS), r(0.0085 * earS)], { ...o(0.003), m: m }));
  }

  // ---- landmarks for hair, brows, lashes, glasses, beards, hats
  const marks = {
    S, O,
    cranium: { c: W(0, 0.138, 0.012), r: [r(0.075 * (1 + 0.08 * f.headWidth) * (1 + 0.1 * st)), r(0.088 * (1 + 0.12 * st)), r(0.097 * (1 + 0.08 * f.headDepth))] },
    top: W(0, 0.226 + 0.01 * st, 0.01),
    forehead: W(0, browY + 0.03, -0.085),
    browY: W(0, browY, 0)[1],
    brows: [-1, 1].map(s => ({ s, inner: W(s * 0.012, browY + 0.002, -0.089 - 0.004 * browRidge), outer: W(s * 0.05 * faceW, browY - 0.002, -0.07), peak: W(s * 0.035 * faceW, browY + 0.005, -0.085 - 0.003 * browRidge) })),
    eyes,
    noseBridge: W(0, nasion[1] - 0.008, nasion[2] - 0.003),
    noseTip: W(0, tipY, tipZ - tipR),
    mouth: W(0, mouthY, lipZ - 0.008), mouthWidth: r(mw * 2),
    chin: W(0, chinY - 0.012, chinZ - 0.004),
    jawAngle: [W(-jawW, lowY(0.04), 0.01), W(jawW, lowY(0.04), 0.01)],
    ears: [-1, 1].map(s => ({ s, c: W(s * (0.0715 * (1 + 0.07 * f.headWidth) + 0.003), earY, 0.01), top: W(s * (0.0715 + 0.004), earY + 0.03 * earS, 0.012) })),
    templeY: W(0, eyeY0 + 0.03, 0)[1],
    napeY: W(0, lowY(0.05), 0)[1],
    faceParams: f,
  };
  return { union: U, subtract: SUB, late: LATE, lateSubtract: LATESUB, eyes, marks };
}

/* ---------------------------------------------------------------- eye opening */
/**
 * The eyelids are the skin of the lid bulb; this carves the almond-shaped
 * opening through which the (separate) eyeball shows: the eyeball volume
 * itself plus, in front of it, the angular region |azimuth| < A and
 * lower(az) < elevation < upper(az), tilted by `tilt`, limited to the lid depth.
 */
function eyeOpening(e, o) {
  const [cx, cy, cz] = e.center, R = e.radius, t = e.lid, s = e.s;
  const fn = (x, y, z) => {
    const dx = (x - cx) * s, dy = y - cy, dz = -(z - cz);        // u (outward), v (up), w (forward)
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const ball = dist - (R + 0.00035);
    const az = Math.atan2(dx, dz);
    const el = Math.asin(Math.max(-1, Math.min(1, dy / (dist || 1)))) - e.tilt * az;
    const q = Math.cos(Math.min(Math.PI / 2, Math.abs(az) * Math.PI / (2 * e.A)));
    const up = e.Eu * Math.pow(Math.max(q, 0), e.pw) - 0.03;
    const lo = -e.El * Math.pow(Math.max(q, 0), e.pw * 0.85) + 0.03;
    const open = Math.max(Math.abs(az) - e.A, el - up, lo - el) * R;   // < 0 inside the opening
    const cone = Math.max(open, dist - (R + t + 0.009), -dz);
    return Math.min(ball, cone);
  };
  const m = R + t + 0.006;
  return custom(fn, [cx - m, cy - m, cz - m, cx + m, cy + m, cz + m], o);
}

/** Ear helix rim: a partial elliptical torus around the back and top of the ear. */
function earRim(c, s, a, b, tube, prot) {
  const cy = Math.cos(-s * prot), sy = Math.sin(-s * prot);
  return (x, y, z) => {
    let dx = x - c[0], dy = y - c[1] + b * 0.08, dz = z - c[2];
    // into ear-local frame (undo the yaw)
    const lx = dx * cy - dz * sy, lz = dx * sy + dz * cy;
    // ellipse in the (z, y) plane: semi-axes a (front-back), b (up-down)
    const ang = Math.atan2(dy / b, lz / a);
    if (ang < -Math.PI * 0.45 || ang > Math.PI * 0.95) return 1;          // rim only on the back and top
    const ex = a * Math.cos(ang), ey = b * Math.sin(ang);
    const ddx = lx - s * 0.0025, ddy = dy - ey, ddz = lz - ex;
    return Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz) - tube;
  };
}

function boxAround(c, m) { return [c[0] - m, c[1] - m, c[2] - m, c[0] + m, c[1] + m, c[2] + m]; }
function mulM(a, b) {
  const o = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return o;
}
export { mulM };
