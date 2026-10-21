/* =====================================================================
 * BODY FRAME FOR GARMENTS
 *
 * Garments are described in body coordinates, not in world space:
 *   arm(p, side)   t along the arm (0 shoulder → 1 wrist), distance to the arm axis
 *   leg(p, side)   t along the leg (0 hip → 1 ankle), distance to the leg axis
 *   torsoArc(p)    angle around the torso axis (0 = front centre)
 *   neck(p)        angle around the neck (0 = front) and height above the neck base
 * so one garment definition fits every body type, proportion and pose.
 * ===================================================================== */
import { v3 } from '../core/skeleton.js';

export function bodyFrame(rig, bodyMarks, headMarks) {
  const J = rig.joints, d = rig.dim;
  const seg = (a, b) => { const ax = v3.sub(b, a), L = v3.len(ax); return { a, b, d: v3.mul(ax, 1 / L), L }; };
  const arms = {}, legs = {};
  for (const s of ['left', 'right']) {
    arms[s] = seg(J[s + 'UpperArm'], J[s + 'Hand']);
    arms[s].elbowT = v3.len(v3.sub(J[s + 'LowerArm'], J[s + 'UpperArm'])) / arms[s].L;
    arms[s].sign = s === 'left' ? -1 : 1;
    legs[s] = seg(J[s + 'UpperLeg'], J[s + 'Foot']);
    legs[s].kneeT = v3.len(v3.sub(J[s + 'LowerLeg'], J[s + 'UpperLeg'])) / legs[s].L;
    legs[s].sign = s === 'left' ? -1 : 1;
  }
  const F = {
    rig, J, d, body: bodyMarks, head: headMarks, arms, legs,
    S: d.H / 1.75,
    neckBase: [0, d.shoulderY + 0.004 * d.H / 1.75, J.neck[2] + 0.004],
    neckR: bodyMarks.neckR,
    armpitY: J.leftUpperArm[1] - 0.075 * d.H / 1.75,
    hipY: d.hipY, shoulderY: d.shoulderY, waistY: bodyMarks.waistY, chestY: bodyMarks.chestY, crotchY: bodyMarks.crotchY, kneeY: d.kneeY, ankleY: d.ankleY,
    /** position along an arm: { t, r (distance to the axis), x (closest axis point) } */
    arm(p, s) { return along(arms[s], p); },
    leg(p, s) { return along(legs[s], p); },
    /** angle around the vertical torso axis, 0 = front centre, + toward the character's right */
    torsoArc(p) { return Math.atan2(p[0], -(p[2] - 0.01 * F.S)); },
    /** neck coordinates: angle around the neck axis and height above the neck base */
    neck(p) { return { a: Math.atan2(p[0], -(p[2] - F.neckBase[2])), h: p[1] - F.neckBase[1], r: Math.hypot(p[0], p[2] - F.neckBase[2]) }; },
    /** which limb a point belongs to: 'torso' | 'armL' | 'armR' | 'legL' | 'legR' */
    region(p) {
      let best = 'torso';
      for (const s of ['left', 'right']) {
        const a = along(arms[s], p);
        if (a.t > 0.06 && a.r < 0.11 * F.S) best = s === 'left' ? 'armL' : 'armR';
        if (p[1] < F.crotchY + 0.02 * F.S) { const l = along(legs[s], p); if (Math.sign(p[0] || 1) === legs[s].sign || Math.abs(p[0]) < 0.004) best = s === 'left' ? 'legL' : 'legR'; void l; }
      }
      return best;
    },
  };
  return F;
}

function along(sg, p) {
  const q = v3.sub(p, sg.a);
  const tt = v3.dot(q, sg.d);
  const x = v3.add(sg.a, v3.mul(sg.d, tt));
  return { t: tt / sg.L, r: v3.len(v3.sub(p, x)), x, along: tt };
}
