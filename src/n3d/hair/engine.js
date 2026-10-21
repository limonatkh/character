/* =====================================================================
 * HAIR ENGINE
 *
 * A hairstyle is a RECIPE (see styles.js): a scalp cap plus layers of
 * guides grown from roots on the real scalp, each layer with its own flow
 * (combed back, natural fall, side part, fringe, spikes, toward a tie…),
 * length / cut, gravity, lift, curl, wave and messiness, rendered with the
 * construction method that suits it:
 *   cards   textured strips of many strands (realistic straight/wavy hair)
 *   clumps  sculpted tapering tubes (stylized, spiky, locs, short textured)
 *   strands individual fine hairs (flyaways, baby hairs, advanced detail)
 *   cap     offset scalp shell (base colour so the scalp never shows; buzz cuts)
 *   volume  meshed curl volume (afros) with surface curls
 *   braid   three interleaved strands (braids, cornrows)
 * Strands collide with the head and body (and an optional outfit field),
 * so long hair rests on the shoulders and back instead of passing through.
 * ===================================================================== */
import { MeshBuilder, tube, ribbon, frames, add, sub, mul, dot, cross, norm, len, madd, lerp3, rotate, rng, noise3, pushOut, projectTo, fieldNormal, resample } from '../mesh/builder.js';
import { sampleScalp, scalpDepth, azimuthOf, hairlineY } from './scalp.js';
import { contour } from '../mesh/octree.js';
import { FnField } from '../sdf/field.js';
import { BONE_INDEX } from '../core/skeleton.js';
import { buildHairMass } from './mass.js';

const tangential = (v, n) => norm(sub(v, mul(n, dot(v, n))));
const clamp01 = x => Math.max(0, Math.min(1, x));
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * Build all hair geometry for a style.
 * @param ctx { field (skin), collide (field for body/outfit, optional), marks (head marks), rig, skinMesh (raw skin: positions, normals, indices, isHead), D (detail) }
 * @param recipe style recipe
 * @param P user params (complete): { length, volume, density, thickness, curl, wave, direction, part, fringe, messiness, flyaways, hairline, colors... }
 * @returns { parts: [{ id, rep, geometry, bone, layerIndex }] }
 */
export function buildHair(ctx, recipe, P) {
  const parts = [];
  if (!recipe || recipe.none) return { parts };
  const m = ctx.marks, S = m.S, D = ctx.D;
  const hl = { ...(recipe.hairline || {}), ...(P.hairline || {}) };
  const seed = recipe.seed || 7;
  const c = m.cranium.c;
  const whorl = [c[0] + 0.012 * S * (P.part === 'left' ? -1 : 1), c[1] + m.cranium.r[1] * 0.72, c[2] + m.cranium.r[2] * 0.42];
  const partX = P.part === 'left' ? -0.028 * S : P.part === 'right' ? 0.028 * S : 0;
  const hctx = { ...ctx, S, hl, c, whorl, partX, P, recipe };

  // ---- sculpted mass (silhouette + strand-textured surface); strand layers then lie on it
  let layerCtx = hctx;
  if (recipe.mass) {
    const mp = buildHairMass(hctx, recipe.mass, P);
    if (mp) {
      parts.push({ ...mp.part, massKind: recipe.mass.kind || 'straight' });
      layerCtx = { ...hctx, field: mp.field, onMass: true };
    }
  }

  // ---- cap (styles without a mass, or when the recipe asks for both)
  if (recipe.cap !== false && ctx.skinMesh && (!recipe.mass || recipe.cap?.withMass)) {
    const capOpts = recipe.cap || {};
    const g = buildCap(ctx, hl, { offset: (capOpts.offset ?? 0.0014) * S * (1 + 0.6 * P.volume * (capOpts.volumeGrow ?? 1)), inset: (capOpts.inset ?? 0.0035) * S, region: capOpts.region ? REGIONS[capOpts.region] : null, hctx, P });
    if (g) parts.push({ id: 'hair_cap', rep: 'cap', geometry: g, bone: BONE_INDEX.head, texture: capOpts.texture || 'cap' });
  }

  // ---- guide layers
  (recipe.layers || []).forEach((L, li) => {
    const mb = new MeshBuilder({ colors: true });
    const region = typeof L.region === 'function' ? L.region : REGIONS[L.region || 'all'];
    const count = Math.max(4, Math.round(L.count * P.density * (L.rep === 'cards' || L.rep === 'strands' ? D.hairDensity : Math.sqrt(D.hairDensity))));
    const roots = sampleScalp(ctx.field, m, hl, count, seed + li * 101, r => region(r, hctx));
    const R = rng(seed + li * 977);
    const lc = L.underMass ? hctx : layerCtx;
    for (const root of roots) {
      const path = growStrand(root, L, lc, R);
      if (!path || path.length < 2) continue;
      emitStrand(mb, path, L, lc, R, root);
    }
    if (mb.count) parts.push({ id: `hair_${li}_${L.rep}`, rep: L.rep, geometry: mb.build(), bone: BONE_INDEX.head, texture: L.rep === 'cards' ? 'cards' : L.rep === 'clumps' ? 'clumps' : 'strands', alpha: L.rep === 'cards', followBody: !!L.followBody });
  });

  // ---- extras (ponytail, bun, braids, volume, cornrows)
  for (const X of recipe.extras || []) {
    const builder = EXTRAS[X.type];
    if (!builder) continue;
    for (const part of builder(hctx, X, P)) parts.push(part);
  }

  // ---- flyaways and baby hairs at the hairline
  const fly = Math.round((D.flyaways || 0) * P.flyaways * (recipe.flyaways ?? 1));
  if (fly > 0) {
    const mb = new MeshBuilder({ colors: true });
    const roots = sampleScalp(ctx.field, m, hl, fly * 3, seed + 999, r => r.h < 0.012 * S || Math.random() < 0.2);
    const R = rng(seed + 31);
    const L = { flow: recipe.flyFlow || 'down', length: [0.012, 0.05], gravity: 0.4, lift: 0.2, mess: 0.9, rep: 'strands', width: 0.0005, offset: [0.001, 0.003], segs: 6 };
    roots.slice(0, fly).forEach(root => {
      const path = growStrand(root, L, hctx, R);
      if (path) emitStrand(mb, path, L, hctx, R, root);
    });
    if (mb.count) parts.push({ id: 'hair_flyaways', rep: 'strands', geometry: mb.build(), bone: BONE_INDEX.head, texture: 'strands' });
  }
  return { parts };
}

/* ---------------------------------------------------------------- regions */
export const REGIONS = {
  all: () => true,
  top: (r, h) => r.up > 0.55,
  front: (r) => Math.abs(r.az) < 0.75 && r.up < 0.75,
  fringe: (r) => Math.abs(r.az) < 0.85 && r.up < 0.62,
  notFringe: (r) => !(Math.abs(r.az) < 0.85 && r.up < 0.62),
  notFace: (r) => !(Math.abs(r.az) < 1.05 && r.up < 0.62),       // long hair: nothing grows down in front of the face
  sides: (r) => Math.abs(r.az) > 0.9 && Math.abs(r.az) < 2.3 && r.up < 0.55,
  back: (r) => Math.abs(r.az) > 2.1,
  crown: (r) => r.up > 0.7,
  notSides: (r) => !(Math.abs(r.az) > 0.9 && r.up < 0.5),
  topStrip: (r, h) => Math.abs(r.p[0] - h.c[0]) < 0.022 * h.S && r.up > 0.15,
  undercutTop: (r) => r.up > 0.5 || (Math.abs(r.az) < 0.9 && r.up > 0.3),
  undercutSides: (r) => !(r.up > 0.5 || (Math.abs(r.az) < 0.9 && r.up > 0.3)),
  left: (r, h) => r.p[0] < h.c[0],
  right: (r, h) => r.p[0] >= h.c[0],
};

/* ---------------------------------------------------------------- flow */
function flowDir(root, L, h) {
  const n = root.n, p = root.p;
  let v;
  const flow = L.flow || 'down';
  switch (flow) {
    case 'back': v = [0, 0.15, 1]; break;
    case 'forward': v = [0, -0.35, -1]; break;
    case 'up': v = add(mul(n, 1.4), [0, 0.6, 0.15]); break;
    case 'out': v = add(mul(n, 1.6), [0, 0.2, 0.2]); break;
    case 'side': { const s = h.P.direction >= 0 ? 1 : -1; v = [s, -0.15, 0.25]; break; }
    case 'tie': { const T = L.tie(h); v = sub(T, p); break; }
    case 'part': {
      const dx = p[0] - (h.c[0] + h.partX);
      const front = p[2] < h.c[2] + 0.04 * h.S;
      if (front && root.up > 0.35 && h.P.part !== 'none') v = [Math.sign(dx || 1) * 1, -0.35, -0.05];
      else v = add(sub(p, h.whorl), [0, -0.02, 0]);
      break;
    }
    case 'fringe': v = [h.P.direction * 0.6, -0.45, -1]; break;
    default: v = add(sub(p, h.whorl), [0, -0.04 * h.S, 0]);          // natural fall from the crown whorl
  }
  v = add(v, [h.P.direction * (L.dirBias ?? 0.35), 0, 0]);
  const t = tangential(v, n);
  return isFinite(t[0]) ? t : tangential([0, -1, 0.2], n);
}

/* ---------------------------------------------------------------- growth */
function cutY(L, h) {
  const m = h.marks, S = h.S;
  const lv = { brow: m.browY - 0.004 * S, eye: m.eyes[0].center[1], nose: m.noseTip[1], chin: m.chin[1] + 0.006 * S, jaw: m.chin[1] + 0.02 * S, shoulder: h.rig.dim.shoulderY + 0.012, chest: h.rig.dim.shoulderY - 0.12, midback: h.rig.dim.shoulderY - 0.24, waist: h.rig.dim.shoulderY - 0.4 }[L.cut];
  return lv;
}

/**
 * Grow one guide from a root. Returns the centreline points (curl and wave
 * are added later as offsets around it, so collisions stay stable).
 */
export function growStrand(root, L, h, R) {
  const S = h.S, P = h.P;
  const fringeK = L.isFringe ? (P.fringe ?? 1) : 1;
  const lenK = L.fixedLength ? 1 : P.length;
  const Lmin = L.length[0] * S * lenK * fringeK, Lmax = L.length[1] * S * lenK * fringeK;
  let total = Lmin + (Lmax - Lmin) * R();
  if (L.lengthByHeight) total *= 0.6 + 0.4 * root.up;                     // layered cuts: shorter on top / longer below
  const segs = L.segs || Math.max(4, Math.min(28, Math.round(total / (0.008 * S))));
  const seg = total / segs;
  const n = root.n;
  const f0 = flowDir(root, L, h);
  const lift = (L.lift ?? 0.3) * (0.6 + 0.8 * P.volume);
  let dir = norm(add(mul(f0, 1 - lift), mul(n, lift)));
  // on a sculpted mass the strands lie right on its surface; otherwise they float at their layer's offset
  const vol = h.onMass ? (0.0006 + 0.0006 * Math.pow(root.up, 0.8)) * S : L.offset ? (L.offset[0] + (L.offset[1] - L.offset[0]) * Math.pow(root.up, 0.8)) * S * (0.6 + 0.8 * P.volume) : 0.002 * S;
  const pts = [madd(root.p, n, 0.0006 * S)];
  const grav = (L.gravity ?? 0.6);
  const stiff = L.stiff ?? 0.5;
  const mess = (L.mess ?? 0.2) * (0.3 + 1.4 * P.messiness);
  const yCut = L.cut ? cutY(L, h) : null;
  const tie = L.flow === 'tie' ? L.tie(h) : null;
  const seedN = R() * 100;
  for (let k = 1; k <= segs; k++) {
    const t = k / segs;
    // gravity grows along the strand; stiffness keeps the flow near the root
    const g = grav * Math.min(1, Math.pow(t, 0.6) * (1.6 - stiff));
    let nd = add(dir, [0, -g * 0.55, 0]);
    if (tie) nd = add(nd, mul(norm(sub(tie, pts[k - 1])), 0.9));
    if (mess > 0) {
      const q = pts[k - 1];
      nd = add(nd, mul([noise3(q[0] * 40, q[1] * 40, seedN, 1), noise3(q[0] * 40, seedN, q[2] * 40, 2), noise3(seedN, q[1] * 40, q[2] * 40, 3)], mess * 0.35));
    }
    dir = norm(nd);
    let p = madd(pts[k - 1], dir, seg);
    // collisions: head (layered offset) and body / outfit
    let dHead = h.field.eval(p[0], p[1], p[2]);
    const want = vol * Math.min(1, 0.25 + t * 3);
    // hug: combed hair follows the head contour at its layer offset instead of sticking out
    const hug = L.hug ?? 0.65;
    const cq = h.marks.cranium, qx = (p[0] - cq.c[0]) / cq.r[0], qy = (p[1] - cq.c[1]) / cq.r[1], qz = (p[2] - cq.c[2]) / cq.r[2];
    const onSkull = qx * qx + qy * qy + qz * qz < 1.9 && p[1] > h.marks.napeY;
    if (hug > 0 && onSkull && dHead > want && dHead < 0.06 * S) {
      const nn = fieldNormal(h.field, p);
      const pull = (dHead - want) * hug * Math.min(1, 0.4 + t * 2);
      p = madd(p, nn, -pull);
      dir = norm(sub(p, pts[k - 1]));
      dHead -= pull;
    }
    if (dHead < want) {
      p = pushOut(h.field, p, want, 3);
      const nn = fieldNormal(h.field, p);
      dir = tangential(dir, nn);
      if (dot(dir, nn) < 0) dir = norm(sub(dir, mul(nn, dot(dir, nn))));
    }
    if (h.collide) {
      const dc = h.collide.eval(p[0], p[1], p[2]);
      const wantB = 0.006 * S + vol * 0.5;
      if (dc < wantB) {
        p = pushOut(h.collide, p, wantB, 3);
        const nn = fieldNormal(h.collide, p);
        if (dot(dir, nn) < 0) dir = norm(sub(dir, mul(nn, dot(dir, nn) * 1.05)));
      }
    }
    pts.push(p);
    if (yCut !== null && p[1] < yCut + (L.cutSlope || 0) * (p[2] - h.c[2])) break;
    if (tie && len(sub(tie, p)) < (L.tieRadius || 0.012) * S) { pts.push(tie); break; }
  }
  return pts;
}

/* ---------------------------------------------------------------- emit */
function strandColor(h, R, extra = {}) {
  const P = h.P;
  const hl = R() < (P.highlightAmount ?? 0) ? 1 : 0;
  const ll = !hl && R() < (P.lowlightAmount ?? 0) ? 1 : 0;
  const jitter = 0.92 + 0.16 * R();
  return t => {
    let col = mix3(P.rootRGB, P.tipRGB, clamp01(Math.pow(t, P.gradientSharpness ?? 0.9) * (P.gradient ?? 1)));
    if (hl) col = mix3(col, P.highlightRGB, 0.7 * clamp01(0.3 + t));
    if (ll) col = mix3(col, P.lowlightRGB || mul(P.rootRGB, 0.6), 0.6);
    const ao = (extra.ao ?? 0.85) + (1 - (extra.ao ?? 0.85)) * clamp01(t * 3);
    return mul(col, jitter * ao);
  };
}

/** Add curl and wave around a centreline. */
function styledPath(path, L, h, R) {
  const P = h.P, S = h.S;
  const curl = (L.curl ?? 0) + (L.userCurl === false ? 0 : P.curl * (L.curlK ?? 1));
  const wave = (L.wave ?? 0) + (L.userWave === false ? 0 : P.wave * (L.waveK ?? 1));
  const n = Math.max(path.length * (curl > 0.3 ? 4 : 2), 6);
  const pts = resample(path, Math.min(90, n));
  if (curl < 0.02 && wave < 0.02) return pts;
  const F = frames(pts, i => norm(sub(pts[i], h.c)));
  const phase = R() * Math.PI * 2;
  let s = 0;
  const out = [];
  const curlAmp = curl * 0.0055 * S * (L.curlAmpK ?? 1), curlPer = (0.03 - 0.018 * curl) * S * (L.curlPerK ?? 1);
  const waveAmp = wave * 0.0065 * S, wavePer = 0.11 * S;
  for (let i = 0; i < pts.length; i++) {
    if (i) s += len(sub(pts[i], pts[i - 1]));
    const ramp = clamp01(s / (0.02 * S));
    const a = s / curlPer * Math.PI * 2 + phase;
    let p = pts[i];
    if (curl > 0.02) p = add(p, add(mul(F.N[i], Math.cos(a) * curlAmp * ramp), mul(F.B[i], Math.sin(a) * curlAmp * ramp)));
    if (wave > 0.02) p = madd(p, F.B[i], Math.sin(s / wavePer * Math.PI * 2 + phase) * waveAmp * ramp);
    out.push(p);
  }
  return out;
}

function emitStrand(mb, path, L, h, R, root) {
  const S = h.S, P = h.P;
  const pts = styledPath(path, L, h, R);
  const color = strandColor(h, R, { ao: L.ao });
  const thick = P.thickness;
  const outward = i => { const p = pts[Math.min(i, pts.length - 1)]; return norm(sub(p, [h.c[0], p[1] * 0.3 + h.c[1] * 0.7, h.c[2]])); };
  if (L.rep === 'cards') {
    const W = (L.width || 0.016) * S * thick * (0.75 + 0.5 * R());
    ribbon(mb, pts, t => W * (1 - 0.55 * t * t), (i) => outward(i), { color });
  } else if (L.rep === 'clumps') {
    const r0 = (L.radius || 0.004) * S * thick * (0.75 + 0.5 * R());
    const taper = L.taper ?? 0.8;
    tube(mb, pts, t => r0 * Math.max(0.02, Math.pow(1 - t, taper) * (L.bulb ? 1 + 0.25 * Math.sin(t * Math.PI) : 1)) * (L.bumpy ? 1 + 0.18 * Math.sin(t * 40) : 1), {
      sides: L.sides || 6, flat: () => L.flat ?? 0.55, up: outward(0), color: (t) => color(t), vScale: 1,
    });
  } else {
    const W = (L.width || 0.0007) * S * Math.sqrt(thick);
    ribbon(mb, pts, t => W * (1 - 0.6 * t), (i) => outward(i), { color });
  }
}

/* ---------------------------------------------------------------- cap */
function buildCap(ctx, hl, o) {
  const sk = ctx.skinMesh;
  if (!sk) return null;
  const P = sk.positions, N = sk.normals, I = sk.indices, m = ctx.marks;
  const n = P.length / 3;
  const inside = new Uint8Array(n), map = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    if (!sk.isHead[i]) continue;
    const p = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
    let ok = scalpDepth(p, hl, m) > o.inset;
    if (ok) for (const e of m.ears) if (Math.hypot(p[0] - e.c[0], p[1] - e.c[1], p[2] - e.c[2]) < 0.026 * m.S) ok = false;
    if (ok && o.region) ok = o.region({ p, n: [N[i * 3], N[i * 3 + 1], N[i * 3 + 2]], az: azimuthOf(p, m.cranium.c), h: 0, up: Math.max(0, Math.min(1, (p[1] - m.browY) / (m.top[1] - m.browY))) }, o.hctx);
    inside[i] = ok ? 1 : 0;
  }
  const mb = new MeshBuilder({ colors: true });
  const color = strandColor(o.hctx, rng(5), { ao: 0.7 });
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    if (!inside[a] || !inside[b] || !inside[c]) continue;
    const ids = [a, b, c].map(i => {
      if (map[i] < 0) {
        const nn = [N[i * 3], N[i * 3 + 1], N[i * 3 + 2]];
        const p = [P[i * 3] + nn[0] * o.offset, P[i * 3 + 1] + nn[1] * o.offset, P[i * 3 + 2] + nn[2] * o.offset];
        const az = azimuthOf(p, m.cranium.c);
        map[i] = mb.vert(p, nn, az / (Math.PI * 2) * 0.6 / m.S * 3, p[1] / m.S * 3, color(0.05));
      }
      return map[i];
    });
    mb.tri(ids[0], ids[1], ids[2]);
  }
  return mb.count ? mb.build() : null;
}

/* ---------------------------------------------------------------- extras */
const EXTRAS = {
  /** Ponytail: tail bundle hanging from the tie point, plus the hair tie. */
  ponytail(h, X, P) {
    const S = h.S, T = X.tie(h);
    const R = rng(41);
    const mb = new MeshBuilder({ colors: true });
    const total = (X.length || 0.25) * S * P.length;
    const count = Math.round((X.count || 70) * P.density * h.D.hairDensity);
    const backDir = norm(X.dir ? X.dir(h) : [0, -0.2, 1]);
    for (let i = 0; i < count; i++) {
      const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * (X.spread || 0.012) * S;
      const off = [Math.cos(a) * rr, Math.sin(a) * rr * 0.6, 0];
      const pts = [add(T, mul(off, 0.4))];
      let dir = norm(add(backDir, [off[0] * 30, off[1] * 30, 0]));
      const segs = 18, seg = total * (0.75 + 0.35 * R()) / segs;
      for (let k = 1; k <= segs; k++) {
        const t = k / segs;
        dir = norm(add(dir, [0, -0.35 * t - 0.1, 0]));
        let p = madd(pts[k - 1], dir, seg);
        p = add(p, mul(off, 0.06 * (1 + t * 2)));
        if (h.field.eval(...p) < 0.01 * S) p = pushOut(h.field, p, 0.01 * S, 2);
        if (h.collide && h.collide.eval(...p) < 0.012 * S) p = pushOut(h.collide, p, 0.012 * S, 3);
        pts.push(p);
      }
      emitStrand(mb, pts, { rep: X.rep || 'clumps', width: X.width || 0.012, radius: X.radius || 0.0048, taper: 0.75, flat: 0.55, sides: 6, curl: X.curl || 0, mess: 0.15 }, h, R, null);
    }
    const rep = X.rep || 'clumps';
    const parts = [{ id: 'hair_ponytail', rep, geometry: mb.build(), bone: BONE_INDEX.head, texture: rep === 'clumps' ? 'clumps' : 'cards', alpha: rep !== 'clumps' }];
    parts.push(hairTie(T, backDir, (X.tieSize || 0.011) * S, h));
    return parts;
  },

  /** Bun: hair wound around the tie point. */
  bun(h, X, P) {
    const S = h.S, T = X.tie(h), R = rng(61);
    const mb = new MeshBuilder({ colors: true });
    const rad = (X.size || 0.03) * S * (0.8 + 0.4 * P.volume);
    const axis = norm(sub(T, h.c));
    const u = norm(cross(axis, [0, 0, 1])), v = cross(axis, u);
    const center = madd(T, axis, rad * 0.55);
    const count = Math.round((X.count || 46) * P.density * Math.sqrt(h.D.hairDensity));
    for (let i = 0; i < count; i++) {
      const a0 = R() * Math.PI * 2, turns = 0.8 + R() * 0.6, lift = (R() - 0.5) * 0.9;
      const pts = [];
      for (let k = 0; k <= 24; k++) {
        const t = k / 24, a = a0 + t * turns * Math.PI * 2;
        const r = rad * (0.95 - 0.35 * t);
        const p = add(center, add(add(mul(u, Math.cos(a) * r), mul(v, Math.sin(a) * r)), mul(axis, lift * rad * 0.6 * Math.sin(t * Math.PI) + (t - 0.5) * rad * 0.25)));
        pts.push(p);
      }
      emitStrand(mb, pts, { rep: 'clumps', radius: X.radius || 0.0065, taper: 0.35, flat: 0.6, sides: 6, mess: 0.05 }, h, R, null);
    }
    return [{ id: 'hair_bun', rep: 'clumps', geometry: mb.build(), bone: BONE_INDEX.head, texture: 'clumps' }, hairTie(T, axis, rad * 0.45, h)];
  },

  /** Braid(s) from a tie point down the back or front. */
  braid(h, X, P) {
    const S = h.S, T = X.tie(h), R = rng(71);
    const total = (X.length || 0.3) * S * P.length;
    const dir0 = norm(X.dir ? X.dir(h) : [0, -0.3, 1]);
    // centreline with gravity and collisions
    const segs = 40, seg = total / segs;
    const line = [T];
    let dir = dir0;
    for (let k = 1; k <= segs; k++) {
      dir = norm(add(dir, [0, -0.25, 0]));
      let p = madd(line[k - 1], dir, seg);
      if (h.field.eval(...p) < 0.012 * S) p = pushOut(h.field, p, 0.012 * S, 3);
      if (h.collide && h.collide.eval(...p) < 0.014 * S) p = pushOut(h.collide, p, 0.014 * S, 3);
      dir = norm(sub(p, line[k - 1]));
      line.push(p);
    }
    const mb = new MeshBuilder({ colors: true });
    braidGeometry(mb, line, (X.width || 0.022) * S * Math.sqrt(P.thickness), h, R, X);
    const parts = [{ id: 'hair_braid_' + (X.name || ''), rep: 'clumps', geometry: mb.build(), bone: BONE_INDEX.head, texture: 'clumps', followBody: true }];
    // tie and tuft at the end
    const end = line[line.length - 1];
    parts.push(hairTie(end, norm(sub(end, line[line.length - 2])), 0.007 * S, h));
    const tm = new MeshBuilder({ colors: true });
    for (let i = 0; i < 14; i++) {
      const a = R() * Math.PI * 2;
      const pts = [end, madd(madd(end, dir, 0.02 * S), [Math.cos(a), 0, Math.sin(a)], 0.006 * S), madd(madd(end, dir, 0.045 * S), [Math.cos(a), 0, Math.sin(a)], 0.01 * S)];
      emitStrand(tm, resample(pts, 6), { rep: 'clumps', radius: 0.0025, taper: 0.9, sides: 5 }, h, R, null);
    }
    parts.push({ id: 'hair_braid_tuft_' + (X.name || ''), rep: 'clumps', geometry: tm.build(), bone: BONE_INDEX.head, texture: 'clumps' });
    return parts;
  },

  /** Cornrows: braids lying on the scalp in rows from the hairline to the nape. */
  cornrows(h, X, P) {
    const S = h.S, m = h.marks, R = rng(81);
    const rows = X.rows || 8;
    const mb = new MeshBuilder({ colors: true });
    for (let r = 0; r < rows; r++) {
      // each row is a meridian from the front hairline over the crown to the nape
      const l = Math.sin(-0.72 + 1.44 * (r + 0.5) / rows), q = Math.sqrt(1 - l * l);
      const c = m.cranium.c, Rr = m.cranium.r;
      const pts = [];
      for (let k = 0; k <= 40; k++) {
        const th = k / 40 * Math.PI * 1.22;
        const d = [l, Math.sin(th) * q, -Math.cos(th) * q];
        let p = [c[0] + d[0] * Rr[0] * 1.3, c[1] + d[1] * Rr[1] * 1.3, c[2] + d[2] * Rr[2] * 1.3];
        p = projectTo(h.field, p, 0.003 * S, 6);
        const inScalp = p[1] > hairlineY(azimuthOf(p, c), h.hl, m) + 0.003 * S;
        if (!inScalp) { if (pts.length > 3) break; else continue; }
        pts.push(p);
      }
      if (pts.length > 4) braidGeometry(mb, resample(pts, 40), 0.0085 * S * Math.sqrt(P.thickness), h, R, { flatOnScalp: true });
    }
    return [{ id: 'hair_cornrows', rep: 'clumps', geometry: mb.build(), bone: BONE_INDEX.head, texture: 'clumps' }];
  },

  /** Big curly volume (afro): a meshed noisy volume plus small surface curls. */
  volume(h, X, P) {
    const S = h.S, m = h.marks, c = m.cranium.c, Rr = m.cranium.r;
    const grow = (X.size || 0.045) * S * (0.6 + 0.8 * P.volume) * P.length;
    const ctr = [c[0], c[1] + grow * 0.25, c[2] + grow * 0.12];
    const rx = Rr[0] + grow, ry = Rr[1] + grow * 0.85, rz = Rr[2] + grow * 0.9;
    const hl = h.hl;
    const fn = (x, y, z) => {
      const qx = (x - ctr[0]) / rx, qy = (y - ctr[1]) / ry, qz = (z - ctr[2]) / rz;
      const k0 = Math.sqrt(qx * qx + qy * qy + qz * qz), k1 = Math.sqrt(qx * qx / (rx * rx) + qy * qy / (ry * ry) + qz * qz / (rz * rz)) || 1e-9;
      let d = k0 * (k0 - 1) / k1;
      d += noise3(x * 90, y * 90, z * 90, 5) * 0.004 * S + noise3(x * 30, y * 30, z * 30, 9) * 0.006 * S;
      // keep the face and the neck free: cut below the hairline
      const az = Math.atan2(x - c[0], -(z - c[2]));
      const cut = hairlineY(az, hl, m) - 0.006 * S - y;
      return Math.max(d, cut, -h.field.eval(x, y, z) + 0.002 * S);
    };
    const size = Math.max(rx, ry, rz) * 2.4;
    const cell = Math.max(0.004, h.D.body * 0.6);
    const depth = Math.ceil(Math.log2(size / cell));
    const root = cell * (1 << depth);
    const mesh = contour(new FnField(fn), { min: [ctr[0] - root / 2, ctr[1] - root / 2, ctr[2] - root / 2], size: root, maxDepth: depth, cellSizeAt: () => cell, margin: 1.6 });
    const col = strandColor(h, rng(3), { ao: 0.9 });
    const n = mesh.positions.length / 3, colors = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const p = [mesh.positions[i * 3], mesh.positions[i * 3 + 1], mesh.positions[i * 3 + 2]];
      const t = clamp01(len(sub(p, c)) / (Math.max(rx, ry) * 1.1));
      const cc = col(t);
      colors.set(cc, i * 3);
      uv[i * 2] = (p[0] + p[2]) / S * 6; uv[i * 2 + 1] = p[1] / S * 6;
    }
    const parts = [{ id: 'hair_volume', rep: 'volume', geometry: { position: mesh.positions, normal: mesh.normals, uv, color: colors, index: mesh.indices }, bone: BONE_INDEX.head, texture: 'curls' }];
    // small curls on the surface for texture
    const mb = new MeshBuilder({ colors: true });
    const R = rng(91);
    const nCurls = Math.round((X.curls || 260) * P.density * h.D.hairDensity);
    for (let i = 0; i < nCurls; i++) {
      const vi = Math.floor(R() * n);
      const p0 = [mesh.positions[vi * 3], mesh.positions[vi * 3 + 1], mesh.positions[vi * 3 + 2]], nn = [mesh.normals[vi * 3], mesh.normals[vi * 3 + 1], mesh.normals[vi * 3 + 2]];
      const u = norm(cross(nn, [0, 1, 0.3])), v = cross(nn, u);
      const pts = [];
      for (let k = 0; k <= 16; k++) {
        const t = k / 16, a = t * Math.PI * 3.2;
        pts.push(add(p0, add(mul(nn, -0.002 * S + 0.004 * S * t), add(mul(u, Math.cos(a) * 0.003 * S), mul(v, Math.sin(a) * 0.003 * S)))));
      }
      emitStrand(mb, pts, { rep: 'clumps', radius: 0.0011, taper: 0.4, sides: 4, flat: 1 }, h, R, null);
    }
    parts.push({ id: 'hair_volume_curls', rep: 'clumps', geometry: mb.build(), bone: BONE_INDEX.head, texture: 'clumps' });
    return parts;
  },
};

/** Three interleaved strands along a centreline (figure-eight braid pattern). */
function braidGeometry(mb, line, width, h, R, X = {}) {
  const pts = resample(line, Math.max(30, line.length * 3));
  const F = frames(pts, i => norm(sub(pts[i], h.c)));
  let L = 0;
  const Ls = [0];
  for (let i = 1; i < pts.length; i++) { L += len(sub(pts[i], pts[i - 1])); Ls.push(L); }
  const period = width * 1.6;
  const color = strandColor(h, R, { ao: 0.9 });
  for (let k = 0; k < 3; k++) {
    const ph = k * Math.PI * 2 / 3;
    const sp = pts.map((p, i) => {
      const a = Ls[i] / period * Math.PI * 2 + ph;
      const taper = 1 - 0.45 * Math.pow(i / (pts.length - 1), 2);
      const side = Math.sin(a) * width * 0.36 * taper;
      const depth = Math.sin(2 * a) * width * (X.flatOnScalp ? 0.08 : 0.16) * taper;
      return add(p, add(mul(F.B[i], side), mul(F.N[i], depth)));
    });
    tube(mb, sp, t => width * 0.3 * (1 - 0.4 * t * t), { sides: 7, flat: () => 0.75, frames: frames(sp, i => F.N[i]), color });
  }
}

function hairTie(T, axis, r, h) {
  const mb = new MeshBuilder({ colors: true });
  const u = norm(cross(axis, Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), v = cross(axis, u);
  const loop = [];
  for (let k = 0; k <= 24; k++) { const a = k / 24 * Math.PI * 2; loop.push(add(T, add(mul(u, Math.cos(a) * r), mul(v, Math.sin(a) * r)))); }
  const col = h.P.tieRGB || [0.12, 0.12, 0.14];
  tube(mb, loop, () => r * 0.32, { sides: 8, color: () => col });
  return { id: 'hair_tie_' + Math.round(T[1] * 1000), rep: 'tie', geometry: mb.build(), bone: BONE_INDEX.head, texture: 'tie' };
}
