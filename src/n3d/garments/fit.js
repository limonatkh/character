/* =====================================================================
 * FIT: how a garment's outer surface sits around what is underneath.
 *
 *   F(p) = smin( U(p) − ease,  drape(p) )
 *
 * U is the distance to everything underneath (skin, then earlier layers),
 * so a skin-tight garment follows every curve of the body at its fabric
 * thickness. Looser fits add DRAPE volumes cut from the body measurements:
 * the torso drape hangs straight down from the most prominent point above
 * (bust, belly, seat), limb drapes wrap the arms and legs as tubes, skirts
 * flare from the hips. Fit therefore changes the SHAPE — where fabric
 * touches the body and where it hangs free — never a uniform scale.
 *
 * Fits (looseness L): skin-tight 0 · slim 0.25 · regular 0.45 · relaxed 0.6 ·
 * loose 0.75 · oversized 0.9.
 * ===================================================================== */
import { smin } from '../sdf/field.js';
import { RadialProfile } from './measure.js';
import { limbCoords } from './regions.js';

export const FITS = {
  skinTight: { L: 0, label: { en: 'Skin-tight', ar: 'ملتصق' } },
  slim: { L: 0.25, label: { en: 'Slim', ar: 'ضيق' } },
  regular: { L: 0.45, label: { en: 'Regular', ar: 'عادي' } },
  relaxed: { L: 0.6, label: { en: 'Relaxed', ar: 'مريح' } },
  loose: { L: 0.75, label: { en: 'Loose', ar: 'واسع' } },
  oversized: { L: 0.9, label: { en: 'Oversized', ar: 'واسع جداً' } },
};
export const FIT_IDS = Object.keys(FITS);
export const looseness = fit => (typeof fit === 'number' ? fit : (FITS[fit] || FITS.regular).L);

const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Base ease (m) between the garment's outer surface and what is underneath. */
export function baseEase(L, thickness, S) { return thickness + 0.0012 * S + 0.009 * S * L * L; }

/**
 * Torso drape around the vertical axis.
 * opts: {
 *   yTop       drape starts here (follows the body above)
 *   hang       0..1 how much fabric falls straight from prominent points
 *   ease       m of extra room below yTop (reached `easeRamp` below the top)
 *   flare      m per m of extra width below `flareFrom` (skirts, A-line)
 *   flareFrom  y where flaring starts
 *   cutBelow   y below which the drape closes (trousers: the crotch)
 *   bandBottom { y, h }  tight band at the bottom (ribbed hem, elastic waist)
 *   bandTop    { y, h }  tight band at the top (waistbands)
 *   baseEase   the garment's base ease (the drape never goes inside it)
 *   front      extra room at the front (m) — e.g. tucked blouson
 * }
 */
/**
 * Distance-bound correction for a radial drape d = r − g(y, θ) whose radius changes fast (bands,
 * flares, the receding top): near the surface (|d| < δ) divide by the local slope factor n ≥ 1,
 * farther away keep slope 1 — so the field never overestimates the distance (octree pruning stays
 * safe) and the slope factor's own variation cannot create a steep field far from the surface.
 */
function lipNorm(d, n, delta) {
  if (n <= 1) return d;
  const a = Math.abs(d);
  return a <= delta ? d / n : Math.sign(d) * (delta / n + (a - delta));
}

export function torsoDrape(prof, F, opts) {
  const S = F.S;
  const yTop = Math.min(opts.yTop, prof.y1);
  const G = new RadialProfile(prof.axisZ, prof.y0, prof.dy, prof.ny, prof.na);
  const { ny, na } = prof, R = prof.R;
  const hang = opts.hang ?? 0.5, ease = opts.ease ?? 0, ramp = opts.easeRamp ?? 0.08 * S;
  const flare = opts.flare || 0, flareFrom = opts.flareFrom ?? F.hipY;
  const e0 = opts.baseEase || 0;
  const skirtBelow = opts.skirtBelow ?? -Infinity;
  for (let j = 0; j < na; j++) {
    let run = 0;
    for (let i = ny - 1; i >= 0; i--) {
      const y = prof.yAt(i), r = R[i * na + j];
      if (y > yTop) { G.R[i * na + j] = r + e0; continue; }
      if (r > run) run = r;                       // hang: highest prominence above
      const th = prof.thAt(j);
      const hg = skirtBelow > -Infinity ? hang + (1 - hang) * ss(skirtBelow + 0.04 * S, skirtBelow - 0.04 * S, y) : hang;
      // tight areas stay just inside the body offset (the offset wins there)
      let g = r + hg * (run - r) + e0 * 0.6 - 0.002 * S;
      g += ease * ss(yTop, yTop - ramp, y) * (1 + (opts.front || 0) * Math.max(0, Math.cos(th)));
      g += flare * Math.max(0, flareFrom - y);
      G.R[i * na + j] = g;
    }
  }
  // skirts bridge the gap between the legs: angular hull below the crotch
  if (opts.skirtHull > 0 && skirtBelow > -Infinity) {
    const w = opts.skirtHull, nW = Math.ceil(w / (2 * Math.PI / na));
    const row = new Float32Array(na);
    for (let i = 0; i < ny; i++) {
      const y = prof.yAt(i);
      const k = ss(skirtBelow + 0.08 * S, skirtBelow - 0.02 * S, y);
      if (k <= 0) continue;
      for (let j = 0; j < na; j++) {
        let best = 0;
        for (let q = -nW; q <= nW; q++) { const v = G.R[i * na + ((j + q + na) % na)] * Math.cos(q * 2 * Math.PI / na); if (v > best) best = v; }
        row[j] = best;
      }
      for (let j = 0; j < na; j++) G.R[i * na + j] += (Math.max(row[j], G.R[i * na + j]) - G.R[i * na + j]) * k;
    }
  }
  G.blur(2);
  // start from the body itself at the top of the drape (no ledge)
  for (let i = 0; i < ny; i++) {
    const y = prof.yAt(i);
    const k = ss(yTop, yTop - 0.05 * S, y);
    for (let j = 0; j < na; j++) { const b0 = R[i * na + j] + e0 * 0.6 - 0.002 * S; G.R[i * na + j] = b0 + (G.R[i * na + j] - b0) * k; }
  }
  const cutBelow = opts.cutBelow ?? -Infinity;
  const bb = opts.bandBottom, bt = opts.bandTop;
  const zc = prof.axisZ;
  const gAt = (y, th) => {
    let g = G.at(y, th);
    if (bb || bt) {
      // tight bands: the drape shrinks back to the body inside the band
      let w = 1;
      if (bb) w = Math.min(w, ss(bb.y + bb.h * 0.5, bb.y + bb.h * 1.6, y));
      if (bt) w = Math.min(w, ss(bt.y - bt.h * 0.5, bt.y - bt.h * 1.6, y));
      const body = prof.at(y, th) + e0;
      g = body + (g - body) * w;
    }
    return g;
  };
  // above its top the drape recedes into the body (no crease where it ends)
  const gFull = (y, th) => (y > yTop ? gAt(yTop, th) - 2 * (y - yTop) : gAt(y, th));
  const hy = 0.012 * S, ha = 0.08, delta = 0.015 * S;
  return (x, y, z) => {
    if (y > yTop + 0.06 * S) return 1;
    const dz = z - zc, r = Math.sqrt(x * x + dz * dz), th = Math.atan2(x, -dz);
    // a radius that changes fast with height (bands, flares, the receding top) is steeper than a distance: normalise
    const gy = (gFull(y + hy, th) - gFull(y - hy, th)) / (2 * hy), ga = (gFull(y, th + ha) - gFull(y, th - ha)) / (2 * ha * Math.max(r, 0.03 * S));
    let d = lipNorm(r - gFull(y, th), Math.sqrt(1 + gy * gy + ga * ga), delta);
    if (y < cutBelow + 0.04 * S) d = Math.max(d, (cutBelow - y) + (1 - ss(cutBelow - 0.01 * S, cutBelow + 0.04 * S, y)) * 0.03 * S);
    return d;
  };
}

/**
 * Trouser leg drape from the leg hull: hangs from the hip, the seat and the
 * thigh; the inner side hangs only from the crotch down (legs stay apart).
 * opts: { L, baseEase, riseY, crotchY, tEnd (hem height y), opening (−1 taper … 1 flare),
 *         hemY, cuffBand (m), waistBand (m), crotchDrop (m) }
 */
export function legDrape(prof, F, opts) {
  const S = F.S, s = prof.side;
  const { ny, na } = prof, R = prof.R;
  const G = new RadialProfile(0, prof.y0, prof.dy, ny, na);
  const L = opts.L ?? 0.45, e0 = opts.baseEase || 0;
  const hang = Math.min(1, 1.3 * L), ease = 0.022 * S * L * L;
  const crotch = opts.crotchY - (opts.crotchDrop || 0);
  const kneeY = F.kneeY, hemY = opts.hemY ?? F.ankleY;
  const opening = opts.opening || 0;
  for (let j = 0; j < na; j++) {
    const th = prof.thAt(j), inner = Math.max(0, -s * Math.sin(th));
    const wIn = ss(0.25, 0.7, inner);
    let runAll = 0, runLow = 0;
    for (let i = ny - 1; i >= 0; i--) {
      const y = prof.yAt(i), r = R[i * na + j];
      if (r > runAll) runAll = r;
      if (y < crotch && r > runLow) runLow = r;
      const run = runAll + (Math.max(runLow, r) - runAll) * wIn;
      let g = r + hang * (run - r) + e0 * 0.6 - 0.002 * S;
      g += ease * ss(opts.riseY, opts.riseY - 0.08 * S, y);
      // tapered or flared below the knee
      if (y < kneeY + 0.05 * S) {
        const k = ss(kneeY + 0.05 * S, hemY, y);
        if (opening < 0) g = g + (r + e0 * 0.6 + 0.004 * S - g) * k * (-opening) * Math.min(1, L * 2 + 0.3);
        else g += opening * 0.04 * S * k;
      }
      g = Math.max(g, r + e0 * 0.6 - 0.002 * S);
      // below the crotch the two legs never touch: stay clear of the midline
      if (y < crotch - 0.01 * S && inner > 0.05) {
        const toMid = Math.abs(prof.cx(y)) / inner - 0.007 * S;
        g = Math.min(g, Math.max(toMid, r + 0.002 * S));
      }
      G.R[i * na + j] = g;
    }
  }
  G.blur(2);
  const cx = prof.cx, cz = prof.cz;
  const top = opts.riseY + 0.01 * S;
  const cb = opts.cuffBand ? { y: hemY, h: opts.cuffBand } : null, wb = opts.waistBand ? { y: opts.riseY, h: opts.waistBand } : null;
  const gAt = (y, th) => {
    let g = G.at(y, th);
    if (cb || wb) {
      let w = 1;
      if (cb) w = Math.min(w, ss(cb.y + cb.h * 0.5, cb.y + cb.h * 1.8, y));
      if (wb) w = Math.min(w, ss(wb.y - wb.h * 0.5, wb.y - wb.h * 1.6, y));
      const body = prof.at(y, th) + e0 * 0.6 - 0.002 * S;
      g = body + (g - body) * w;
    }
    return g;
  };
  const gFull = (y, th) => (y > top ? gAt(top, th) - 2 * (y - top) : gAt(y, th));
  const hy = 0.012 * S, ha = 0.08, delta = 0.015 * S;
  return (x, y, z) => {
    if (y > top + 0.06 * S) return 1;
    const dx = x - cx(y), dz = z - cz(y), r = Math.sqrt(dx * dx + dz * dz), th = Math.atan2(dx, -dz);
    const gy = (gFull(y + hy, th) - gFull(y - hy, th)) / (2 * hy), ga = (gFull(y, th + ha) - gFull(y, th - ha)) / (2 * ha * Math.max(r, 0.03 * S));
    return lipNorm(r - gFull(y, th), Math.sqrt(1 + gy * gy + ga * ga), delta);
  };
}

/**
 * Tube drape around a limb (sleeves, trouser legs).
 * radius(t) = drape radius at t (0 root … 1 end); tStart/tEnd bound the tube.
 */
export function limbDrape(seg, radius, tStart = 0, tEnd = 1.08, base = null, blendLen = 0.2) {
  return (x, y, z) => {
    const l = limbCoords(seg, x, y, z);
    const t = Math.max(tStart, Math.min(tEnd, l.t));
    let rr = radius(t);
    // grow out of the body near the root (no step where the tube starts)
    if (base) { const b = base(t); rr = b + (rr - b) * ss(tStart, tStart + blendLen, t); }
    let d = l.r - rr;
    // radius changing along the limb (cuffs, bells) → divide by the slope so it stays a distance bound
    {
      const dt = 0.025, t0 = Math.max(tStart, t - dt), t1 = Math.min(tEnd, t + dt);
      if (t1 > t0) {
        let ra = radius(t0), rb = radius(t1);
        if (base) { ra = base(t0) + (ra - base(t0)) * ss(tStart, tStart + blendLen, t0); rb = base(t1) + (rb - base(t1)) * ss(tStart, tStart + blendLen, t1); }
        const slope = (rb - ra) / ((t1 - t0) * seg.L);
        d = lipNorm(d, Math.sqrt(1 + slope * slope), 0.015);
      }
    }
    d = Math.max(d, tStart * seg.L - l.along, l.along - tEnd * seg.L);
    return d;
  };
}

/** A sleeve radius function from the arm measurements. */
export function sleeveRadius(meas, F, side, o) {
  const S = F.S, arm = meas.arms[side];
  const L = o.L ?? 0.45, e0 = o.baseEase, tEnd = o.tEnd ?? 1;
  const width = o.width ?? 0;                     // −1 tapered … 1 wide / bell
  const top = arm.at(0.12) + e0 + 0.02 * S * L;
  const cuffBand = o.cuffBand || 0;               // ribbed cuff length (fraction of the arm)
  return t => {
    const body = arm.at(Math.min(1, t)) + e0;
    // fabric hangs from the shoulder: tube that narrows slowly toward the cuff
    const hangR = top * (1 - 0.35 * t) + 0.012 * S * L;
    let r = body + (Math.max(body, hangR) - body) * Math.min(1, L * 1.4) + 0.01 * S * L * L;
    r += width * 0.03 * S * ss(0.2, Math.max(0.3, tEnd), t);
    if (cuffBand > 0) {
      const w = ss(tEnd - cuffBand * 0.5, tEnd - cuffBand * 1.8, t);
      r = body + 0.002 * S + (r - body - 0.002 * S) * w;
    }
    return Math.max(r, body);
  };
}

/** A trouser-leg radius function from the leg measurements. */
export function legRadius(meas, F, side, o) {
  const S = F.S, leg = meas.legs[side];
  const L = o.L ?? 0.45, e0 = o.baseEase, tEnd = o.tEnd ?? 1;
  const opening = o.opening ?? 0;                 // −1 tapered (skinny) … 0 straight … 1 wide / flare
  const kneeT = F.legs[side].kneeT;
  const thigh = leg.at(0.1) + e0 + 0.025 * S * L;
  const cuffBand = o.cuffBand || 0;               // joggers: elastic ankle cuffs
  return t => {
    const body = leg.at(Math.min(1, t)) + e0;
    // straight tube hanging from the thigh, tapering slightly
    let straight = thigh * (1 - 0.32 * t);
    straight += opening * 0.035 * S * ss(kneeT * 0.6, 1, t);
    let r = body + (Math.max(body, straight) - body) * Math.min(1, L * 1.5) + 0.006 * S * L;
    if (cuffBand > 0) {
      const w = ss(tEnd - cuffBand * 0.5, tEnd - cuffBand * 1.6, t);
      r = body + 0.002 * S + (r - body - 0.002 * S) * w;
    }
    return Math.max(r, body);
  };
}

/**
 * The garment's outer surface field: F = smin(U − ease(p), drapes).
 * @param U underlying field ({ eval })
 * @param easeFn ease at a point (m) or a number
 * @param drapes array of drape functions
 * @param k blend size (m) where drapes join the body (shoulders, crotch)
 */
export function garmentField(U, easeFn, drapes, k) {
  const ef = typeof easeFn === 'function' ? easeFn : () => easeFn;
  const n = drapes.length;
  const fromU = (u, x, y, z) => {
    const d = u - ef(x, y, z);
    let dr = Infinity;
    for (let i = 0; i < n; i++) { const v = drapes[i](x, y, z); if (v < dr) dr = v; }
    return dr === Infinity ? d : smin(d, dr, k);
  };
  return { U, fromU, eval(x, y, z) { return fromU(U.eval(x, y, z), x, y, z); } };
}

/**
 * Stack: what the NEXT layer sees underneath = min(U, garment solid), smoothed by `fillet`.
 * The garment solid is the inside of its outer surface within its region.
 * (U is evaluated once per point, whatever the number of layers.)
 */
export function stackField(Fg, region, inflate = 0, fillet = 0) {
  const U = Fg.U, K = fillet;
  return {
    eval(x, y, z) {
      const u = U.eval(x, y, z);
      const r = region(x, y, z);
      if (r >= u + K) return u;                   // exact shortcut: g ≥ r ≥ u + K, so the (smooth) min is u
      const g = Math.max(Fg.fromU(u, x, y, z) - inflate, r);
      // a fillet where the garment's edge stands on what is below (a waistband, a hem): the next layer
      // bridges the step instead of copying it
      return K > 0 ? smin(u, g, K) : (u < g ? u : g);
    },
  };
}
