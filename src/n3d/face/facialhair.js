/* =====================================================================
 * FACIAL HAIR: beards, moustaches, goatees, chin straps, mutton chops,
 * stubble. Hair grows from zones on the real face (upper lip, chin, jaw,
 * cheeks, neck) defined from the face landmarks, so every style follows
 * every face shape. Strands lie along the skin, grow downward and forward,
 * long beards hang with gravity onto the chest / clothes. A matching
 * shadow is painted in the face texture (render/face-texture.js).
 * ===================================================================== */
import { MeshBuilder, add, sub, mul, dot, cross, norm, len, madd, lerp3, rng, ribbon, projectTo, pushOut, fieldNormal, noise3 } from '../mesh/builder.js';
import { BONE_INDEX } from '../core/skeleton.js';

const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * Zone weights (0..1) at a point of the face for a style.
 * zones: { moustache, chin, jaw, cheek, neck, sideburn, soulPatch, chops }
 */
export function faceZones(m, p) {
  const S = m.S, [x, y, z] = p;
  const mouth = m.mouth, mw = m.mouthWidth / 2, chin = m.chin, nose = m.noseTip;
  const ear = m.ears[x < 0 ? 0 : 1] || m.ears[0];
  const ax = Math.abs(x);
  const front = ss(m.cranium.c[2] + 0.01 * S, m.cranium.c[2] - 0.03 * S, z);       // in front of the ears' plane
  const noseBase = nose[1] - 0.012 * S;
  // upper lip band (moustache)
  const moustache = ss(mouth[1] + 0.002 * S, mouth[1] + 0.006 * S, y) * ss(noseBase + 0.002 * S, noseBase - 0.004 * S, y) * ss(mw + 0.012 * S, mw + 0.002 * S, ax) * ss(mouth[2] + 0.03 * S, mouth[2] + 0.01 * S, z);
  // chin and below the lower lip
  const chinZ = ss(mouth[1] - 0.006 * S, mouth[1] - 0.012 * S, y) * ss(chin[1] - 0.03 * S, chin[1] - 0.012 * S, y) * ss(0.032 * S, 0.02 * S, ax) * ss(chin[2] + 0.045 * S, chin[2] + 0.02 * S, z);
  const soulPatch = ss(mouth[1] - 0.006 * S, mouth[1] - 0.01 * S, y) * ss(mouth[1] - 0.03 * S, mouth[1] - 0.022 * S, y) * ss(0.012 * S, 0.006 * S, ax) * ss(mouth[2] + 0.02 * S, mouth[2] + 0.005 * S, z);
  // cheek line: from the sideburn (in front of the ear) down to the mouth corner
  const sbY = ear.top[1] - 0.035 * S;
  const t = Math.max(0, Math.min(1, (Math.abs(x) - (mw + 0.01 * S)) / (Math.abs(ear.c[0]) - mw - 0.01 * S)));
  const cheekLineY = mouth[1] + 0.012 * S + (sbY - mouth[1] - 0.012 * S) * Math.pow(t, 0.8);
  const belowCheek = ss(cheekLineY + 0.004 * S, cheekLineY - 0.004 * S, y);
  // jaw region: from below the cheek line down to the jaw edge / under the chin
  const jawEdgeY = chin[1] - 0.025 * S - 0.02 * S * (1 - t);
  const jaw = belowCheek * ss(jawEdgeY - 0.01 * S, jawEdgeY + 0.004 * S, y) * front * ss(Math.abs(ear.c[0]) + 0.003 * S, Math.abs(ear.c[0]) - 0.012 * S, ax) * ss(ear.c[2] + 0.004 * S, ear.c[2] - 0.006 * S, z);
  const cheek = jaw * ss(mouth[1] - 0.01 * S, mouth[1] + 0.02 * S, y);
  // under the jaw / upper neck
  const neck = ss(chin[1] + 0.005 * S, chin[1] - 0.01 * S, y) * ss(chin[1] - 0.04 * S, chin[1] - 0.025 * S, y) * ss(ear.c[2] + 0.01 * S, ear.c[2] - 0.01 * S, z) * ss(Math.abs(ear.c[0]), Math.abs(ear.c[0]) - 0.02 * S, ax);
  const sideburn = ss(sbY - 0.012 * S, sbY + 0.005 * S, y) * ss(ear.top[1] + 0.005 * S, ear.top[1] - 0.004 * S, y) * ss(Math.abs(ear.c[0]) - 0.03 * S, Math.abs(ear.c[0]) - 0.022 * S, ax) * ss(ear.c[2] - 0.004 * S, ear.c[2] - 0.016 * S, z) * front;
  return { moustache, chin: Math.max(chinZ, soulPatch * 0.8), soulPatch, jaw, cheek, neck, sideburn, chops: jaw * ss(mouth[1] - 0.012 * S, mouth[1] + 0.005 * S, y) };
}

/**
 * @param style { zones: { name: density 0..1 }, length (m), lengthBy: { zone: k }, curl, rep: 'strands' | 'clumps', handlebar }
 * @param P user params { length, density, curl, thickness, messiness }
 * @param ctx { skin (raw skin mesh), field (skin), collide (outfit field), marks, D, colors: { root, tip } }
 */
export function buildFacialHair(style, P, ctx) {
  if (!style || style.none || !style.zones) return null;
  const m = ctx.marks, S = m.S, D = ctx.D;
  const raw = ctx.skin;
  const Pp = raw.positions, Ii = raw.indices;
  const R = rng(style.seed || 101);
  // weighted triangles on the head
  const tris = [], weights = [];
  let total = 0;
  for (let t = 0; t < Ii.length; t += 3) {
    const a = Ii[t], b = Ii[t + 1], c = Ii[t + 2];
    if (!raw.isHead[a] && !raw.isHead[b] && !raw.isHead[c] && Pp[a * 3 + 1] < m.chin[1] - 0.08 * S) continue;
    const pa = [Pp[a * 3], Pp[a * 3 + 1], Pp[a * 3 + 2]], pb = [Pp[b * 3], Pp[b * 3 + 1], Pp[b * 3 + 2]], pc = [Pp[c * 3], Pp[c * 3 + 1], Pp[c * 3 + 2]];
    const ctr = mul(add(add(pa, pb), pc), 1 / 3);
    if (ctr[1] > m.ears[0].top[1] + 0.01 * S || ctr[1] < m.chin[1] - 0.08 * S) continue;
    const z = faceZones(m, ctr);
    let w = 0;
    for (const [k, v] of Object.entries(style.zones)) w = Math.max(w, (z[k] || 0) * v);
    if (w < 0.02) continue;
    const area = len(cross(sub(pb, pa), sub(pc, pa))) / 2;
    tris.push([pa, pb, pc, z]); total += area * w; weights.push(total);
  }
  if (!tris.length) return null;
  const density = (style.density ?? 1) * (P.density ?? 1);
  const perM2 = (style.rep === 'clumps' ? 14000 : 75000) * density * Math.sqrt(D.hairDensity || 0.55);
  const count = Math.min(14000, Math.round(total * perM2));
  const mb = new MeshBuilder({ colors: true });
  const lenK = (P.length ?? 1);
  const curl = Math.max(style.curl ?? 0, P.curl ?? 0);
  const thick = (P.thickness ?? 1) * (style.rep === 'clumps' ? 0.0032 : 0.0008) * S;
  const down = [0, -1, 0];
  for (let i = 0; i < count; i++) {
    const r = R() * total;
    let lo = 0, hi = weights.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (weights[mid] < r) lo = mid + 1; else hi = mid; }
    const [pa, pb, pc, z] = tris[lo];
    let u = R(), v = R(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const root = add(pa, add(mul(sub(pb, pa), u), mul(sub(pc, pa), v)));
    const n = fieldNormal(ctx.field, root);
    // zone at the root decides the length
    let zoneW = 0, zoneName = 'jaw';
    for (const [k, w] of Object.entries(style.zones)) { const q = (z[k] || 0) * w; if (q > zoneW) { zoneW = q; zoneName = k; } }
    if (R() > zoneW * 1.15) continue;                                     // soft edges
    const L = (style.length ?? 0.01) * S * lenK * (style.lengthBy?.[zoneName] ?? 1) * (0.7 + 0.5 * R()) * (0.6 + 0.4 * zoneW);
    // growth direction: down along the face; moustache down-out from the centre, handlebar curls up at the ends
    const side = Math.sign(root[0]) || 1;
    let dir;
    if (zoneName === 'moustache') dir = norm(add(down, [side * (0.5 + Math.abs(root[0]) / (0.03 * S)), 0, -0.2]));
    else if (zoneName === 'neck') dir = norm(add(down, [0, 0, -0.4]));
    else dir = norm(add(down, [0, 0, -0.25]));
    dir = norm(sub(dir, mul(n, dot(dir, n) * 0.85)));
    const segs = L > 0.02 * S ? 6 : 3;
    const pts = [madd(root, n, 0.0002 * S)];
    let p = pts[0], dcur = dir;
    for (let k = 1; k <= segs; k++) {
      const f = k / segs;
      // curl and frizz
      if (curl > 0) dcur = norm(add(dcur, mul(cross(n, dcur), Math.sin(f * Math.PI * 2 * (1 + 2 * curl) + i) * curl * 0.9)));
      dcur = norm(add(dcur, [(noise3(root[0] * 400, root[1] * 400, k, 3)) * 0.25 * (P.messiness ?? 0.3), 0, 0]));
      if (L > 0.03 * S) dcur = norm(add(dcur, mul(down, 0.35 * f)));       // gravity on long beards
      if (style.handlebar && zoneName === 'moustache' && Math.abs(root[0]) > m.mouthWidth * 0.35) dcur = norm(add(dcur, [side * 0.3, 0.55 * f, 0]));
      p = madd(p, dcur, L / segs);
      // lie on the skin for short hair; collide with the body / clothes for long hair
      const off = 0.0006 * S + (L > 0.02 * S ? 0.004 * S * f : 0.0012 * S * f);
      if (ctx.field.eval(...p) < off) p = pushOut(ctx.field, p, off, 2);
      if (ctx.collide && L > 0.03 * S && ctx.collide.eval(...p) < 0.004 * S) p = pushOut(ctx.collide, p, 0.004 * S, 2);
      pts.push(p);
    }
    const shade = 0.82 + 0.36 * R();
    ribbon(mb, pts, t => thick * (1 - 0.75 * t) * (0.8 + 0.4 * R()), () => n, { color: t => [shade * (1 - 0.15 * t), shade * (1 - 0.15 * t), shade * (1 - 0.15 * t)] });
  }
  return { id: 'facialHair', geometry: mb.build(), bone: BONE_INDEX.head, rep: style.rep || 'strands' };
}
export { lerp3, projectTo };
