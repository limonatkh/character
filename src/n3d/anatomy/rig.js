/* =====================================================================
 * NORMAL 3D — PROPORTIONS → SKELETON
 *
 * Turns the body parameters into joint positions (rest A-pose) plus the
 * measurements the anatomy, garments and hair are built from. Ratios are
 * classic anthropometric averages (fractions of standing height H).
 * ===================================================================== */
import { BONE_NAMES, v3 } from '../core/skeleton.js';
import { completeParams, BODY_PARAMS } from '../core/params.js';

const lerp = (a, b, t) => a + (b - a) * t;
const ARM_DROP = 42 * Math.PI / 180;          // A-pose: arms 42° below horizontal

/**
 * @param body body params (partial ok)
 * @returns rig { H, P, st, joints: { bone: [x,y,z] }, frames: { bone: {x,y,z axes} }, dim: {...} }
 */
export function buildRig(body) {
  const P = completeParams(BODY_PARAMS, body);
  const H = P.height;
  const st = P.stylization;
  const m = P.masculinity;
  const hs = P.headScale * (1 + 0.42 * st);              // stylized characters get a bigger head
  const J = {};

  // ---- head and neck (from the top down)
  const headH = 0.128 * H * hs * (1 - 0.12 * st);       // vertex → chin
  const chinY = H - headH;
  const headJ = [0, chinY + 0.035 * headH, 0.02 * headH];   // skull base / atlas
  const neckLen = 0.052 * H * P.neckLength * (1 - 0.35 * st);
  const neckJ = [0, headJ[1] - neckLen, 0.012 * H];
  const shoulderY = neckJ[1] - 0.012 * H;

  // ---- legs / torso split
  const hipY = neckJ[1] * 0.62 * Math.sqrt(P.legLength / P.torsoLength) * (1 - 0.06 * st);
  const ankleY = 0.042 * H * Math.pow(P.footSize, 0.3);
  const tf = 0.5 * P.thighRatio / (0.5 * P.thighRatio + 0.5);
  const kneeY = hipY - (hipY - ankleY) * tf;
  const hipHalf = H * lerp(0.053, 0.047, m) * P.hipWidth;       // hip joint centres
  const hipsJ = [0, hipY + 0.03 * H, 0.004 * H];
  const torsoSpan = neckJ[1] - hipsJ[1];
  J.hips = hipsJ;
  J.spine = [0, hipsJ[1] + torsoSpan * 0.22, 0.006 * H];
  J.chest = [0, hipsJ[1] + torsoSpan * 0.48, 0.008 * H];
  J.upperChest = [0, hipsJ[1] + torsoSpan * 0.72, 0.01 * H];
  J.neck = neckJ;
  J.head = headJ;

  // ---- arms (A-pose)
  const shoulderHalf = 0.5 * H * lerp(0.205, 0.235, m) * P.shoulderWidth * (1 + 0.05 * (P.muscle - 0.35));
  const armL = 0.332 * H * P.armLength;
  const f = P.forearmRatio;
  const upperLen = armL * 0.56 / (0.56 + 0.44 * f), lowerLen = armL * 0.44 * f / (0.56 + 0.44 * f);
  const handLen = 0.108 * H * P.handSize;
  const dim = { H, st, m, hs, headH, chinY, neckLen, shoulderY, hipY, kneeY, ankleY, hipHalf, shoulderHalf, upperLen, lowerLen, handLen, torsoSpan };
  for (const s of [-1, 1]) {
    const side = s < 0 ? 'left' : 'right';
    J[side + 'Shoulder'] = [s * 0.018 * H, shoulderY - 0.004 * H, 0.0];
    const sh = [s * (shoulderHalf - 0.022 * H), shoulderY - 0.02 * H, 0.004 * H];
    J[side + 'UpperArm'] = sh;
    const dir = v3.norm([s * Math.cos(ARM_DROP), -Math.sin(ARM_DROP), -0.06]);
    const el = v3.add(sh, v3.mul(dir, upperLen));
    J[side + 'LowerArm'] = el;
    const fdir = v3.norm(v3.add(dir, [0, 0, -0.08]));       // slight natural bend forward
    const wr = v3.add(el, v3.mul(fdir, lowerLen));
    J[side + 'Hand'] = wr;
    handBones(J, side, s, wr, fdir, handLen, P);

    // legs
    const hip = [s * hipHalf, hipY, 0.004 * H];
    const ank = [s * hipHalf * 1.18, ankleY, 0.012 * H];
    const kn = [s * hipHalf * 1.1, kneeY, -0.004 * H];
    J[side + 'UpperLeg'] = hip;
    J[side + 'LowerLeg'] = kn;
    J[side + 'Foot'] = ank;
    const footLen = 0.152 * H * P.footSize;
    J[side + 'Toes'] = [ank[0] + s * 0.012 * H, 0.012 * H, ank[2] - footLen * 0.55];
  }
  dim.footLen = 0.152 * H * P.footSize;
  dim.armDir = { left: v3.norm([-Math.cos(ARM_DROP), -Math.sin(ARM_DROP), -0.06]), right: v3.norm([Math.cos(ARM_DROP), -Math.sin(ARM_DROP), -0.06]) };

  // eyes and jaw get positions from the face builder; give sensible defaults here
  J.leftEye = [-0.032 * hs * H / 1.75, chinY + headH * 0.56, -0.07 * hs * H / 1.75];
  J.rightEye = [0.032 * hs * H / 1.75, J.leftEye[1], J.leftEye[2]];
  J.jaw = [0, chinY + headH * 0.3, 0.0];
  for (const n of BONE_NAMES) if (!J[n]) throw new Error('rig: missing joint ' + n);
  return { H, P, st, joints: J, dim };
}

/**
 * Hand: wrist at `wr`, pointing along `d`. Local axes: a = along the hand,
 * f = forward (thumb side, −Z), n = palm normal (palms face the thighs, down-in).
 */
function handBones(J, side, s, wr, d, handLen, P) {
  const fwd = v3.norm(v3.sub([0, 0, -1], v3.mul(d, v3.dot([0, 0, -1], d))));
  const n = v3.norm(v3.cross(d, fwd)).map(v => v * -s);      // palm normal (toward body / down)
  const palmLen = handLen * 0.47;
  const fl = handLen * 0.53 * P.fingerLength;
  const spread = handLen * 0.42;
  const fingers = {
    Index: { off: 0.36, reach: 0.99, len: 0.92 },
    Middle: { off: 0.12, reach: 1.02, len: 1.0 },
    Ring: { off: -0.12, reach: 0.98, len: 0.94 },
    Little: { off: -0.36, reach: 0.9, len: 0.74 },
  };
  const curl = 0.16;                                           // gentle natural curl (rad per joint)
  for (const [name, F] of Object.entries(fingers)) {
    let p = v3.add(v3.add(wr, v3.mul(d, palmLen * F.reach)), v3.mul(fwd, spread * F.off));
    let dir = v3.norm(v3.add(d, v3.mul(fwd, F.off * 0.28)));
    const segs = [0.46, 0.3, 0.24];
    ['Proximal', 'Intermediate', 'Distal'].forEach((seg, i) => {
      J[side + name + seg] = p;
      dir = v3.norm(v3.add(v3.mul(dir, Math.cos(curl)), v3.mul(n, Math.sin(curl))));
      p = v3.add(p, v3.mul(dir, fl * F.len * segs[i]));
    });
    J['_' + side + name + 'Tip'] = p;
  }
  // thumb: from the base of the palm, forward and toward the palm
  const tb = v3.add(v3.add(wr, v3.mul(d, palmLen * 0.18)), v3.add(v3.mul(fwd, spread * 0.42), v3.mul(n, handLen * 0.04)));
  let tdir = v3.norm(v3.add(v3.add(v3.mul(d, 0.62), v3.mul(fwd, 0.62)), v3.mul(n, 0.35)));
  const tl = handLen * 0.5 * P.fingerLength;
  let p = tb;
  [['Metacarpal', 0.4], ['Proximal', 0.33], ['Distal', 0.27]].forEach(([seg, len]) => {
    J[side + 'Thumb' + seg] = p;
    tdir = v3.norm(v3.add(v3.mul(tdir, Math.cos(0.12)), v3.mul(d, Math.sin(0.12))));
    p = v3.add(p, v3.mul(tdir, tl * len));
  });
  J['_' + side + 'ThumbTip'] = p;
  J['_' + side + 'HandFwd'] = fwd;
  J['_' + side + 'HandNormal'] = n;
  J['_' + side + 'HandDir'] = d;
}
