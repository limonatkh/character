/* =====================================================================
 * GARMENT CUTS — the pattern-making layer.
 *
 * A garment asset describes WHAT it is (a hoodie, jeans, a maxi dress) and
 * which controls it exposes; its parameters are turned here into a cut:
 * coverage (necklines, hems, sleeves, legs, openings), fit (ease and
 * drapes), panels (front, back, sleeves, legs — for UVs and seams) and
 * surface detail (drape folds, compression folds at elbows and knees,
 * trouser breaks, pleats, gathers, hem turn-ups).
 *
 * Every cut works on every body: all positions come from the body frame
 * and the measurements, never from fixed coordinates.
 * ===================================================================== */
import * as R from './regions.js';
import { torsoDrape, limbDrape, legDrape, sleeveRadius, garmentField, stackField, baseEase } from './fit.js';
import { noise3 } from '../mesh/builder.js';
import { BONES } from '../core/skeleton.js';
import { primDist } from '../sdf/field.js';
import { measureStack } from './measure.js';

const ss = R.smoothstep;
const lerp = (a, b, t) => a + (b - a) * t;
const bell = (x, c, w) => Math.exp(-((x - c) * (x - c)) / (w * w));
const wrapPi = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

export const PANEL = { FRONT: 0, BACK: 1, SLEEVE_L: 2, SLEEVE_R: 3, LEG_LF: 4, LEG_LB: 5, LEG_RF: 6, LEG_RB: 7 };
/* Which bones each panel may follow: sleeves only their own arm (plus the chest at the armhole), the body of a
 * garment never the forearms or hands, each trouser leg only its own leg (and the hips / spine), no arm bone. Without this, a loose sleeve or a coat hem
 * hanging next to the hand in the A-pose takes the hip's or the hand's weights and tears when the arms move. */
const ARM_CHAIN = /^(left|right)(Shoulder|UpperArm|LowerArm|Hand|Thumb|Index|Middle|Ring|Little)/;
const FOREARM_DOWN = /^(left|right)(LowerArm|Hand|Thumb|Index|Middle|Ring|Little)/;
const boneSet = keep => new Set(BONES.map((b, i) => (keep(b.name) ? i : -1)).filter(i => i >= 0));
const BONE_SETS = {
  sleeveL: boneSet(n => /^left(Shoulder|UpperArm|LowerArm|Hand)$/.test(n) || n === 'upperChest' || n === 'chest'),
  sleeveR: boneSet(n => /^right(Shoulder|UpperArm|LowerArm|Hand)$/.test(n) || n === 'upperChest' || n === 'chest'),
  noForearms: boneSet(n => !FOREARM_DOWN.test(n)),
  legL: boneSet(n => !ARM_CHAIN.test(n) && !/^right(UpperLeg|LowerLeg|Foot|Toes)$/.test(n)),
  legR: boneSet(n => !ARM_CHAIN.test(n) && !/^left(UpperLeg|LowerLeg|Foot|Toes)$/.test(n)),
};
const isLeg = pn => pn >= 4;

/** Hem height of tops / jackets / dresses from a 0..1 (or longer) length. */
export function hemHeight(F, length) {
  const S = F.S;
  // 0 cropped (above the navel) · 0.5 hip · 1 upper thigh · 2 knee · 3 ankle
  const keys = [[0, F.waistY + 0.035 * S], [0.5, F.hipY - 0.03 * S], [1, F.crotchY - 0.12 * S], [2, F.kneeY + 0.02 * S], [2.5, (F.kneeY + F.ankleY) / 2], [3, F.ankleY + 0.035 * S]];
  if (length <= 0) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (length <= keys[i][0]) { const [a, ya] = keys[i - 1], [b, yb] = keys[i]; return lerp(ya, yb, (length - a) / (b - a)); }
  return keys[keys.length - 1][1];
}
/** Waistband height from rise 0 (low) … 0.5 (mid) … 1 (high). */
export function riseHeight(F, rise) {
  const S = F.S;
  return rise < 0.5 ? lerp(F.hipY + 0.035 * S, F.hipY + 0.085 * S, rise / 0.5) : lerp(F.hipY + 0.085 * S, F.waistY + 0.015 * S, (rise - 0.5) / 0.5);
}
/** Trouser / skirt length → t along the leg (0 hip joint, 1 ankle) or a hem height. */
export function legT(length) { return length; }

/**
 * Build the cut.
 * @param spec see the templates (garments/templates.js)
 * @param ctx { F, meas, U, D, S, bodyField, seed }
 * @returns { G (for meshGarment), field, region, stack, info }
 */
export function cutGarment(spec, ctx) {
  const { F, meas, U, D } = ctx;
  const S = F.S;
  const L = spec.L ?? 0.45;
  const th = spec.thickness ?? 0.002 * S;
  const e0 = baseEase(L, th, S) + (spec.extraEase || 0);
  const parts = [], drapes = [];
  const add = (name, fn) => parts.push({ name, fn });
  const info = { L, thickness: th, ease: e0 };
  const seed = ctx.seed || 1;
  let foldMax = 0;

  // ---------------------------------------------------------- upper body
  const T = spec.torso;
  let hemFn = null, sleeveR = {}, keepHole = null;
  if (T) {
    const hemBase = T.hemY ?? hemHeight(F, T.length ?? 0.5);
    const curve = (T.hemCurve || 0) * 0.05 * S, dip = (T.hemDip || 0) * 0.04 * S, asym = (T.hemAsym || 0) * 0.08 * S;
    hemFn = th2 => hemBase + curve * Math.pow(Math.sin(th2), 2) + dip * (Math.cos(th2) - 1) / 2 + asym * Math.sin(th2);   // curve: shirt-tail sides · dip: longer back · asym: diagonal
    info.hemY = hemBase;
    if (!T.noHem) add('hem', R.hem(F, hemFn));
    if (T.topY !== undefined) add('top', R.topLine(F, T.topY));
    add('head', R.headLimit(F, T.collarH ?? (T.neckline && /turtle|mock/.test(T.neckline.type) ? 0.045 * S : 0.09 * S)));
    if (T.neckline) add('neck', R.neckline(F, T.neckline.type, { ease: e0, ...T.neckline }));
    if (T.opening) add('opening', R.frontOpening(F, T.opening));
    const yTop = Math.min(F.armpitY - 0.005 * S, T.drapeTop ?? Infinity);
    const skirtBelow = spec.skirt ? F.crotchY + 0.04 * S : -Infinity;
    // over other garments the fabric hangs from them (a coat over a hoodie does not step in below its hem)
    const torsoProf = ctx.layered ? measureStack(U, meas.torso, F, { y1: yTop + 0.02 * S }) : meas.torso;
    drapes.push(torsoDrape(torsoProf, F, {
      yTop, hang: Math.min(1, (T.hang ?? 1.25) * L), ease: (T.ease ?? 1) * 0.03 * S * L * L, baseEase: e0,
      flare: T.flare || 0, flareFrom: T.flareFrom ?? F.waistY, front: T.front || 0,
      cutBelow: T.cutBelow, skirtBelow, skirtHull: spec.skirt ? 0.55 : 0,
      bandBottom: T.hemBand ? { y: hemBase, h: T.hemBand } : null,
      bandTop: T.waistBand ? { y: T.topY, h: T.waistBand } : null,
    }));
    // sleeves or armholes
    const SL = spec.sleeves;
    for (const side of ['left', 'right']) {
      if (SL && SL.t > 0.06) {
        const rf = sleeveRadius(meas, F, side, { L: SL.L ?? L, baseEase: e0, tEnd: SL.t, width: SL.width || 0, cuffBand: SL.cuffBand || 0 });
        sleeveR[side] = rf;
        drapes.push(limbDrape(F.arms[side], rf, 0.05, SL.t + 0.06, t => meas.arms[side].at(t) + e0 * 0.6 - 0.002 * S, 0.22));
        add(side === 'left' ? 'cuffL' : 'cuffR', R.sleeveEnd(F, side, SL.t, t => rf(Math.min(t, SL.t + 0.05)) + 0.03 * S));
      } else if (!spec.noArmholes) {
        add(side === 'left' ? 'armholeL' : 'armholeR', R.armhole(F, side, { strapX: (spec.armhole?.strapX ?? 0.11) * S, depth: (spec.armhole?.depth ?? 0.03) * S }));
      }
    }
  }

  // ---------------------------------------------------------- lower body
  const B = spec.bottom;
  if (B) {
    const riseY = B.riseY ?? riseHeight(F, B.rise ?? 0.5);
    const riseFn = th2 => riseY + 0.014 * S * (1 - Math.cos(th2)) / 2;
    info.riseY = riseY;
    if (!T) {
      if (spec.bib) add('bib', R.bib(F, { w: spec.bib.w * S, topFront: F.chestY + spec.bib.front * S, topBack: F.waistY + spec.bib.back * S }));
      else add('waist', R.topLine(F, riseFn));
      add('arms', R.excludeArms(F));
    }
    if (B.skirt) {
      // skirts: one tube from the waist, hanging from the seat, flaring
      const hemY = B.hemY ?? hemHeight(F, B.length ?? 1.6);
      info.hemY = hemY;
      add('hem', R.hem(F, th2 => hemY + (B.hemAsym || 0) * 0.08 * S * Math.sin(th2) + (B.hemDip || 0) * 0.05 * S * (0.5 - 0.5 * Math.cos(th2))));
      drapes.push(torsoDrape(meas.torso, F, {
        yTop: riseY + 0.01 * S, hang: 1, ease: 0.006 * S + 0.02 * S * L, easeRamp: 0.1 * S, baseEase: e0,
        flare: B.flare || 0, flareFrom: F.hipY + 0.02 * S, skirtBelow: F.crotchY + 0.06 * S, skirtHull: 0.6,
        bandTop: B.waistBand ? { y: riseY, h: B.waistBand } : null,
      }));
    } else {
      const tEnd = B.t ?? 1;
      info.legT = tEnd;
      add('legHem', R.legEnd(F, tEnd));
      // the two legs never join below the crotch, even where wide hems meet behind the heels
      // (wider than a mesh cell, or a triangle could span it)
      const splitY = F.crotchY - 0.06 * S - (B.crotchDrop || 0) * S, gap = Math.max(0.003 * S, 0.6 * (spec.cell ?? D.garment * (spec.cellScale || 1)));
      add('legSplit', (x, y) => Math.min(gap - Math.abs(x), splitY - y));
      keepHole = (x, y) => y < splitY + 0.01 * S && Math.abs(x) < 0.012 * S;
      const hemY = F.legs.left.a[1] + (F.legs.left.b[1] - F.legs.left.a[1]) * tEnd;
      for (const side of ['left', 'right']) {
        drapes.push(legDrape(meas.legHulls[side], F, {
          L: B.legL ?? L, baseEase: e0, riseY, crotchY: F.crotchY, crotchDrop: (B.crotchDrop || 0) * S + 0.04 * S * L * L,
          hemY, opening: B.opening || 0, cuffBand: B.cuffBand || 0, waistBand: B.waistBand || 0,
        }));
      }
    }
  }

  const region = R.all(...parts.map(p => p.fn));
  const field = garmentField(U, e0, drapes, (spec.blend ?? (0.006 + 0.03 * L)) * S);
  if (T && typeof T.tuckY === 'number') {
    // tucked in: below the waistband the fabric is pressed against what is underneath (blended over 12 cm
    // so the field stays a distance bound)
    const base = field.fromU, ty = T.tuckY, tight = 0.0015 * S;
    field.fromU = (u, x, y, z) => { const f = base(u, x, y, z), w = ss(ty + 0.04 * S, ty - 0.08 * S, y); return w > 0 ? f + w * (u - tight - f) : f; };
    field.eval = (x, y, z) => field.fromU(U.eval(x, y, z), x, y, z);
  }

  // ---------------------------------------------------------- panels and UVs
  const zc = 0.01 * S;
  const hasSleeves = !!(spec.sleeves && spec.sleeves.t > 0.06);
  // armhole seam: a plane across the arm at t = 0.07, limited to the arm's surroundings
  const armSeam = s => (x, y, z) => { const l = R.limbCoords(F.arms[s], x, y, z); return Math.max(0.07 * F.arms[s].L - l.along, l.r - 0.13 * S, F.crotchY - y); };
  const armSeams = { left: armSeam('left'), right: armSeam('right') };
  // a loose or layered sleeve can stand further from the arm than the armhole seam's 13 cm: it is still the
  // sleeve while it is nearer the arm than the trunk (otherwise its wrist end would follow the hips)
  const trunkDist = (x, y, z) => { let d = Infinity; for (const p of meas.trunkPrims) { const v = primDist(p, x, y, z); if (v < d) d = v; } return d; };
  const inSleeve = (s, x, y, z) => {
    const a = armSeams[s](x, y, z);
    if (a < 0) return true;
    const l = R.limbCoords(F.arms[s], x, y, z);
    if (l.along < 0.07 * F.arms[s].L || y < F.crotchY || l.r < 0.13 * S || l.r > 0.35 * S) return false;
    return l.r - meas.arms[s].at(Math.min(1, Math.max(0, l.t))) < trunkDist(x, y, z) - 0.01 * S;
  };
  const panel = (x, y, z) => {
    if (hasSleeves) for (const s of ['left', 'right']) if (inSleeve(s, x, y, z)) return s === 'left' ? PANEL.SLEEVE_L : PANEL.SLEEVE_R;
    // trousers: four panels per pair (front / back of each leg) → centre, side and inside-leg seams
    if (B && !B.skirt && (!T || y < F.crotchY + 0.02 * S)) {
      const s = x < 0 ? 'left' : 'right';
      const front = z < legSeamZ(y);
      return s === 'left' ? (front ? PANEL.LEG_LF : PANEL.LEG_LB) : (front ? PANEL.LEG_RF : PANEL.LEG_RB);
    }
    return z < zc ? PANEL.FRONT : PANEL.BACK;
  };
  const armRef = {};
  function legSeamZ(y) { return F.legs.left.a[2] - 0.01 * S * ss(F.crotchY - 0.02 * S, F.crotchY + 0.02 * S, y); }
  for (const s of ['left', 'right']) {
    const d = F.arms[s].d, up = [0, 1, 0];
    const k = d[1];
    let u = [up[0] - d[0] * k, up[1] - d[1] * k, up[2] - d[2] * k];
    const l = Math.hypot(...u); u = u.map(v => v / l);
    armRef[s] = { u, w: [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]] };
  }
  const uv = (pn, x, y, z, ref) => {
    if (pn === PANEL.FRONT || pn === PANEL.BACK) {
      let a = Math.atan2(x, -(z - zc));
      if (pn === PANEL.BACK) a = wrapPi(a - Math.PI);
      return [a * 0.16 * S, y];
    }
    if (pn === PANEL.SLEEVE_L || pn === PANEL.SLEEVE_R) {
      const s = pn === PANEL.SLEEVE_L ? 'left' : 'right', sg = F.arms[s], rf = armRef[s];
      const qx = x - sg.a[0], qy = y - sg.a[1], qz = z - sg.a[2];
      const along = qx * sg.d[0] + qy * sg.d[1] + qz * sg.d[2];
      // angle around the arm: 0 on top, ±π under the arm (the sleeve seam); unwrapped near the triangle
      const ang = (px, py, pz) => { const ax = px - sg.a[0], ay = py - sg.a[1], az = pz - sg.a[2]; return Math.atan2(ax * rf.w[0] + ay * rf.w[1] + az * rf.w[2], ax * rf.u[0] + ay * rf.u[1] + az * rf.u[2]); };
      let a = ang(x, y, z), wrap = 0;
      if (ref) { const ar = ang(ref[0], ref[1], ref[2]); if (a - ar > Math.PI) { a -= 2 * Math.PI; wrap = -1; } else if (ar - a > Math.PI) { a += 2 * Math.PI; wrap = 1; } }
      return [a * 0.055 * S * (s === 'left' ? -1 : 1), -along, wrap];
    }
    const s = pn <= PANEL.LEG_LB ? 'left' : 'right', sg = F.legs[s];
    const a = Math.atan2(-(z - sg.a[2]), (x - sg.a[0]) * sg.sign);          // 0 = outer side … ±π inseam
    return [a * 0.075 * S, y];
  };

  // ---------------------------------------------------------- surface detail
  const det = spec.detail || {};
  const yTopD = F.armpitY - 0.02 * S;
  const foldAmp = (det.drape ?? 1) * 0.011 * S * Math.max(0, L - 0.2);
  const wrinkle = (det.wrinkle ?? 1) * 0.0016 * S * (0.4 + L);
  const hemTurn = det.hemTurn ?? 0.0007 * S, hemW = det.hemWidth ?? 0.018 * S;
  const elbowT = F.arms.left.elbowT, kneeT = F.legs.left.kneeT;
  const SLt = hasSleeves ? spec.sleeves.t : 0;
  const pleats = det.pleats || 0, pleatAmp = (det.pleatDepth ?? 0.006) * S;
  const quilt = det.quilt ? det.quilt * S : 0, quiltD = (det.quiltDepth ?? 0.008) * S;
  const gather = det.gather || null;               // { y, h, amp } gathers at a waistband / tuck line
  foldMax = foldAmp + wrinkle + hemTurn + (pleats ? pleatAmp : 0) + (gather ? gather.amp : 0) + (quilt ? quiltD : 0) + 0.004 * S;
  const displace = (p, n, inf) => {
    const [x, y, z] = p;
    let d = 0;
    const pn = panel(x, y, z);
    // hem allowance (turned-up edge, slightly thicker)
    if (inf.edgeDist < hemW) d += hemTurn * ss(hemW, hemW * 0.6, inf.edgeDist);
    // soft wrinkles everywhere
    d += wrinkle * (0.5 + 0.5 * noise3(x * 22 / S, y * 9 / S, z * 22 / S, seed));
    // quilted baffles (puffer jackets): padded channels between stitched seams
    if (quilt) {
      const v = (pn === PANEL.SLEEVE_L || pn === PANEL.SLEEVE_R) ? R.limbCoords(F.arms[pn === PANEL.SLEEVE_L ? 'left' : 'right'], x, y, z).along : y;
      const ph = v / quilt;
      d += quiltD * Math.pow(Math.sin(Math.PI * (ph - Math.floor(ph))), 0.7) * ss(0, 0.012 * S, inf.edgeDist);
    }
    if (pn === PANEL.FRONT || pn === PANEL.BACK) {
      const a = Math.atan2(x, -(z - zc));
      // drape folds falling from the chest / seat
      if (foldAmp > 0 && T) {
        const k = ss(yTopD, yTopD - 0.22 * S, y);
        const ph = a * (7 + 6 * L) + 2.2 * noise3(a * 2, y * 3 / S, 0, seed + 3);
        d += foldAmp * k * Math.pow(0.5 + 0.5 * Math.sin(ph), 1.6);
      }
      if (pleats && (B?.skirt || spec.skirt)) {
        const ph = a * pleats / (2 * Math.PI);
        d += pleatAmp * (ph - Math.floor(ph)) * ss((info.riseY ?? F.waistY) - 0.02 * S, (info.riseY ?? F.waistY) - 0.1 * S, y);
      }
      if (gather) d += gather.amp * bell(y, gather.y, gather.h) * (0.5 + 0.5 * Math.sin(a * 40 + 3 * noise3(a, y * 10, 0, seed)));
    } else if (pn === PANEL.SLEEVE_L || pn === PANEL.SLEEVE_R) {
      const s = pn === PANEL.SLEEVE_L ? 'left' : 'right', l = R.limbCoords(F.arms[s], x, y, z);
      // compression folds inside the elbow and above a cuff
      if (SLt > elbowT - 0.05) d += 0.0035 * S * bell(l.t, elbowT, 0.09) * (0.5 + 0.5 * Math.sin(l.along / (0.022 * S) * 6.283 + 2 * noise3(x * 30, y * 30, z * 30, seed)));
      if (spec.sleeves.cuffBand) d += 0.004 * S * L * bell(l.t, SLt - spec.sleeves.cuffBand * 1.6, 0.05) * (0.5 + 0.5 * Math.sin(l.along / (0.018 * S) * 6.283));
    } else if (isLeg(pn)) {
      const s = pn <= PANEL.LEG_LB ? 'left' : 'right', l = R.limbCoords(F.legs[s], x, y, z);
      // knee folds and the trouser "break" above the shoe
      d += 0.003 * S * (0.3 + L) * bell(l.t, kneeT, 0.07) * (0.5 + 0.5 * Math.sin(l.along / (0.028 * S) * 6.283 + 2 * noise3(x * 25, y * 25, z * 25, seed)));
      const tEnd = info.legT ?? 1;
      if (tEnd > 0.92) d += 0.006 * S * (0.4 + L) * ss(tEnd - 0.12, tEnd - 0.02, l.t) * (0.5 + 0.5 * Math.sin(l.along / (0.03 * S) * 6.283 + 3 * noise3(x * 20, y * 20, z * 20, seed + 1)));
      if (B?.cuffBand) d += 0.004 * S * L * bell(l.t, tEnd - B.cuffBand * 1.5, 0.05) * (0.5 + 0.5 * Math.sin(l.along / (0.02 * S) * 6.283));
    }
    return d;
  };

  const seams = [];
  if (T) seams.push((x, y, z) => z - zc);                                  // side + shoulder seams
  if (hasSleeves) seams.push(armSeams.left, armSeams.right);               // armholes
  if (B && !B.skirt) { seams.push((x) => x); seams.push((x, y, z) => z - legSeamZ(y)); }
  if (B && B.skirt && !T) seams.push((x, y, z) => z - zc);
  const b = { min: [-1.0 * S, 0, -0.42 * S], max: [1.0 * S, F.neckBase[1] + 0.12 * S, 0.42 * S] };
  const G = {
    field, region, regionParts: parts, bands: spec.bands || {}, lined: !!spec.lined, thickness: th, seams, cell: spec.cell ?? D.garment * (spec.cellScale || 1), bounds: b,
    panel, uv, displace, bandWidth: spec.bandWidth ?? 0.11 * S, roundRim: th > 0.003 * S ? 3 : 2,
    adjustWeights: (spec.skirt || B?.skirt || (T && hemFn && info.hemY < F.crotchY)) ? skirtWeights(F) : null,
    keepHole,
    allowBones: pn => (pn === PANEL.SLEEVE_L ? BONE_SETS.sleeveL : pn === PANEL.SLEEVE_R ? BONE_SETS.sleeveR : pn === PANEL.LEG_LF || pn === PANEL.LEG_LB ? BONE_SETS.legL : pn >= PANEL.LEG_RF ? BONE_SETS.legR : BONE_SETS.noForearms),
  };
  return { G, field, region, drapes, stack: stackField(field, region, foldMax + th * 0.5, (B ? 0.04 : 0.025) * S), info: { ...info, foldMax }, sleeveR };
}

/**
 * Skirts, dresses and coat tails: below the crotch, fabric follows the hips
 * more than the legs (a skirt skinned only to the thighs would split).
 */
function skirtWeights(F) {
  return (i, P, SI, SW) => {
    const y = P[i * 3 + 1];
    if (y > F.crotchY + 0.02 * F.S) return;
    const k = ss(F.crotchY + 0.02 * F.S, F.crotchY - 0.1 * F.S, y) * 0.55;
    // blend toward hips (index 0)
    const w = {};
    for (let j = 0; j < 4; j++) if (SW[i * 4 + j] > 0) w[SI[i * 4 + j]] = (w[SI[i * 4 + j]] || 0) + SW[i * 4 + j] * (1 - k);
    w[0] = (w[0] || 0) + k;
    const top = Object.entries(w).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((s2, [, v]) => s2 + v, 0) || 1;
    for (let j = 0; j < 4; j++) { SI[i * 4 + j] = top[j] ? +top[j][0] : 0; SW[i * 4 + j] = top[j] ? top[j][1] / sum : 0; }
  };
}
