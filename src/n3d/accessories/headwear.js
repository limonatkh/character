/* =====================================================================
 * HEADWEAR: caps, beanies, fedoras, bucket hats, kufi / taqiyah, berets,
 * hood worn up, hijab. Crowns are shells around the head AND the hair
 * (their size follows the measured hair thickness), clipped at a band line
 * that follows the head (forehead, above the ears, nape). Brims are curved
 * slabs. Hair inside the crown is removed.
 * ===================================================================== */
import { meshGarment, vertexNormals } from '../garments/shell.js';
import { MeshBuilder, add, sub, mul, dot, cross, norm, len, madd, disc } from '../mesh/builder.js';
import { MeshQuery } from '../mesh/query.js';
import { smin, gradient } from '../sdf/field.js';
import { noise3 } from '../mesh/builder.js';
import { headAz, bandY, hairThickness, ss } from './common.js';

const LEVELS = {
  cap: { front: 0.03, side: 0.008, back: 0.03 },
  beanie: { front: 0.022, side: -0.012, back: 0.012 },
  fedora: { front: 0.035, side: 0.012, back: 0.035 },
  bucket: { front: 0.028, side: 0.0, back: 0.025 },
  kufi: { front: 0.06, side: 0.035, back: 0.07 },
  beret: { front: 0.04, side: 0.012, back: 0.035 },
};

/**
 * @param spec { type: cap|beanie|fedora|bucket|kufi|beret|hoodUp|hijab, … }
 * @param ctx  { sf, rig, D, U (stack), hairParts, S }
 * @returns { meshes: [{ name, geometry, groups? , material }], hides(p) → bool (hair to remove), bone: 'head' }
 */
export function buildHeadwear(spec, ctx) {
  const { sf, D } = ctx;
  const m = sf.head.marks, S = m.S;
  const type = spec.type;
  if (type === 'hijab' || type === 'hoodUp') return headCovering(spec, ctx);
  const lv = { ...LEVELS[type], ...(spec.levels || {}) };
  const band = (x, z) => bandY(m, headAz(m, x, z), lv);
  const c = m.cranium.c, R = m.cranium.r;
  const hairT = Math.min(0.035 * S, hairThickness(ctx.hairParts, sf.farField, band(c[0], c[2] + 1) - 0.01 * S, S));
  const ease = (spec.ease ?? 0.004) * S + hairT;
  const U = sf.farField;
  // ---- crown field
  const topY = m.top[1] + ease;
  let crown;
  if (type === 'fedora' || type === 'bucket') {
    // oval crown with straight sides; fedora: a centre crease and front pinches
    const ry = (spec.crownHeight ?? (type === 'fedora' ? 0.11 : 0.085)) * S;
    const cy = band(c[0], c[2] - 1) - 0.005 * S;
    crown = (x, y, z) => {
      const hx = (x - c[0]) / (R[0] + ease + 0.012 * S), hz = (z - c[2]) / (R[2] + ease + 0.014 * S);
      const taper = 1 - 0.12 * ss(cy, cy + ry, y);
      const side = (Math.sqrt(hx * hx + hz * hz) / taper - 1) * Math.min(R[0], R[2]);
      let top = cy + ry - (y - cy) * 0;
      if (type === 'fedora') {
        top -= 0.022 * S * Math.exp(-((x - c[0]) ** 2) / (0.03 * S) ** 2) * ss(-0.08 * S, 0.0, -(z - c[2]) + 0.05 * S);  // centre dent
        top -= 0.012 * S * Math.exp(-((Math.abs(x - c[0]) - 0.035 * S) ** 2) / (0.015 * S) ** 2) * ss(c[2], c[2] - 0.08 * S, z);   // front pinches
      } else top -= 0.012 * S * ((x - c[0]) ** 2 + (z - c[2]) ** 2) / (R[0] * R[2]);
      // smooth intersection (rounded crown edge)
      const k = 0.014 * S, dTop = y - top;
      const hh = Math.max(k - Math.abs(side - dTop), 0) / k;
      return Math.max(side, dTop) + hh * hh * hh * k / 6;
    };
  } else if (type === 'beret') {
    const tilt = (spec.tilt ?? 0.4);
    const cx = c[0] + tilt * 0.035 * S, cy = topY - 0.012 * S, cz = c[2] + 0.005 * S;
    const ra = (R[0] + 0.035 * S) * (spec.size ?? 1), rb = 0.03 * S;
    crown = (x, y, z) => {
      const dx = x - cx, dy = y - cy - tilt * 0.12 * (x - cx), dz = z - cz;
      const flat = (Math.sqrt((dx / ra) ** 2 + (dy / rb) ** 2 + (dz / ra) ** 2) - 1) * rb * 1.5;
      return smin(flat, U.eval(x, y, z) - ease, 0.025 * S);
    };
  } else {
    // follows the head + hair, slightly rounder (structured cap front, slouchy beanie)
    const domeR = [R[0] + ease + 0.004 * S, R[1] + ease + (type === 'beanie' ? (spec.slouch ?? 0.3) * 0.035 * S : 0.006 * S), R[2] + ease + 0.006 * S];
    const dc = [c[0], c[1] + (type === 'beanie' ? (spec.slouch ?? 0.3) * 0.02 * S : 0.004 * S), c[2] + (type === 'beanie' ? (spec.slouch ?? 0.3) * 0.02 * S : -0.004 * S)];
    crown = (x, y, z) => {
      const dome = (Math.sqrt(((x - dc[0]) / domeR[0]) ** 2 + ((y - dc[1]) / domeR[1]) ** 2 + ((z - dc[2]) / domeR[2]) ** 2) - 1) * Math.min(...domeR);
      return smin(U.eval(x, y, z) - ease, dome, 0.02 * S) * 0.5 + Math.min(U.eval(x, y, z) - ease, dome) * 0.5;
    };
  }
  const region = (x, y, z) => {
    const box = Math.max(Math.abs(x - c[0]) - 0.2 * S, Math.abs(z - c[2]) - 0.22 * S, m.napeY - 0.04 * S - y);
    if (box > 0) return box;
    return band(x, z) - y;
  };
  const panels = type === 'cap' ? 6 : type === 'beanie' ? 0 : 0;
  const G = {
    field: { eval: crown }, region, regionParts: [{ name: 'band', fn: region }],
    thickness: (spec.thickness ?? (type === 'beanie' ? 0.004 : 0.0025)) * S, cell: Math.min(ctx.D.garment * 0.6, 0.006 * S),
    bounds: { min: [c[0] - 0.2 * S, m.napeY - 0.05 * S, c[2] - 0.22 * S], max: [c[0] + 0.2 * S, topY + 0.15 * S, c[2] + 0.22 * S] },
    bands: type === 'beanie' && spec.cuff !== false ? { band: { w: (spec.cuffH ?? 0.05) * S, kind: 'rib' } } : type === 'fedora' || type === 'bucket' ? { band: { w: (spec.ribbon ?? 0.024) * S, kind: 'trim' } } : {},
    panel: panels ? (x, y, z) => ((Math.floor(((headAz(m, x, z) + Math.PI + Math.PI / panels) / (2 * Math.PI)) * panels)) % panels) : () => 0,
    uv: (pn, x, y, z) => [headAz(m, x, z) * 0.09 * S, y],
    displace: type === 'beanie' ? (p, n, info) => (info.band ? 0.004 * S * (1 - info.bandU) ** 0.3 : 0) + 0.0012 * S * (0.5 + 0.5 * noise3(p[0] * 60, p[1] * 60, p[2] * 60, 3)) : null,
    bandWidth: 0.05 * S, roundRim: 3, minIsland: 30,
  };
  const mesh = meshGarment(G, {});
  const meshes = [{ name: 'crown', geometry: mesh, groups: mesh.groups }];
  const q = new MeshQuery(mesh.surface.P, mesh.surface.I, 0.015 * S);
  const parts = [];
  // ---- brims
  if (type === 'cap' || type === 'fedora' || type === 'bucket') {
    const mb = new MeshBuilder();
    const full = type !== 'cap';
    const azMax = full ? Math.PI : (spec.visorWidth ?? 1.05);
    const nA = full ? 72 : 30, nR = 8;
    const width = (spec.brim ?? (type === 'cap' ? 0.072 : type === 'fedora' ? 0.058 : 0.055)) * S;
    const th = 0.004 * S;
    const ring = [];
    const azOff = spec.backwards ? Math.PI : 0;
    for (let i = 0; i <= nA; i++) {
      const az0 = -azMax + 2 * azMax * i / nA, az = az0 + azOff;
      const dir = [Math.sin(az), 0, -Math.cos(az)];
      const y = band(c[0] + dir[0] * 0.1, c[2] + dir[2] * 0.1) + (type === 'cap' ? 0.002 * S : 0.0);
      const h = q.raycast([c[0] + dir[0] * 0.3 * S, y + 0.003 * S, c[2] + dir[2] * 0.3 * S], mul(dir, -1), 0.3 * S);
      const base = h ? h.p : [c[0] + dir[0] * (R[0] + ease), y, c[2] + dir[2] * (R[2] + ease)];
      const wv = type === 'cap' ? width * Math.pow(Math.max(0, Math.cos(az0 / azMax * Math.PI / 2)), 0.45) + 0.004 * S : width;
      const row = [];
      for (let k = 0; k <= nR; k++) {
        const r = wv * k / nR;
        let drop;
        if (type === 'cap') drop = -(spec.visorCurve ?? 0.4) * 0.35 * r * (r / Math.max(wv, 1e-4)) - 0.18 * r;
        else if (type === 'bucket') drop = -0.55 * r;
        else drop = (0.25 * r * Math.max(0, -Math.cos(az)) * (r / width)) - 0.18 * r * Math.max(0, Math.cos(az)) * (r / width) + 0.12 * r * Math.abs(Math.sin(az)) * (r / width);
        // caps: visor also curves around (sides lower than the centre)
        if (type === 'cap') drop -= (spec.visorCurve ?? 0.4) * 0.03 * S * Math.pow(Math.sin(az0), 2) * (k / nR);
        row.push(add(base, add(mul(dir, r), [0, drop, 0])));
      }
      ring.push(row);
    }
    // slab: top surface, bottom surface, edges
    const top = [], bot = [];
    for (let i = 0; i <= nA; i++) for (let k = 0; k <= nR; k++) {
      const p = ring[i][k];
      const tA = sub(ring[Math.min(nA, i + 1)][k], ring[Math.max(0, i - 1)][k]), tR = sub(ring[i][Math.min(nR, k + 1)], ring[i][Math.max(0, k - 1)]);
      let n = norm(cross(tA, tR)); if (n[1] < 0) n = mul(n, -1);
      top.push(mb.vert(madd(p, n, th / 2), n, i / nA, k / nR));
    }
    const botStart = mb.count;
    for (let i = 0; i <= nA; i++) for (let k = 0; k <= nR; k++) {
      const p = ring[i][k];
      const tA = sub(ring[Math.min(nA, i + 1)][k], ring[Math.max(0, i - 1)][k]), tR = sub(ring[i][Math.min(nR, k + 1)], ring[i][Math.max(0, k - 1)]);
      let n = norm(cross(tA, tR)); if (n[1] < 0) n = mul(n, -1);
      bot.push(mb.vert(madd(p, n, -th / 2), mul(n, -1), i / nA, k / nR));
    }
    const W = nR + 1;
    for (let i = 0; i < nA; i++) for (let k = 0; k < nR; k++) {
      const a = i * W + k;
      mb.quad(top[a], top[a + 1], top[a + W + 1], top[a + W]);
      mb.quad(bot[a], bot[a + W], bot[a + W + 1], bot[a + 1]);
    }
    for (let i = 0; i < nA; i++) { const a = i * W + nR, b = (i + 1) * W + nR; mb.quad(top[a], bot[a], bot[b], top[b]); }      // outer edge
    if (!full) for (const i of [0, nA]) for (let k = 0; k < nR; k++) { const a = i * W + k; if (i === 0) mb.quad(top[a], top[a + 1], bot[a + 1], bot[a]); else mb.quad(top[a], bot[a], bot[a + 1], top[a + 1]); }
    void botStart;
    const g = mb.build(); orientOut(g); g.normal = vertexNormals(g.position, g.index);
    parts.push({ name: 'brim', geometry: g, material: type === 'cap' ? 'main' : 'main' });
    // stitching rows on a cap visor
  }
  // ---- cap button and eyelets, beanie pom-pom, agal
  if (type === 'cap') {
    const hb = new MeshBuilder();
    const top = q.raycast([c[0], topY + 0.2 * S, c[2]], [0, -1, 0], 0.4 * S);
    if (top) disc(hb, madd(top.p, top.n, 0.002 * S), top.n, 0.008 * S, 0.004 * S, { sides: 14, dome: true });
    for (let k = 0; k < 6; k++) {
      const az = (k + 0.5) / 6 * Math.PI * 2 - Math.PI;
      const dir = [Math.sin(az), 0, -Math.cos(az)];
      const h = q.raycast(add([c[0], c[1] + 0.06 * S, c[2]], mul(dir, 0.3 * S)), mul(dir, -1), 0.3 * S);
      if (h) disc(hb, madd(h.p, h.n, 0.0004 * S), h.n, 0.0028 * S, 0.0009 * S, { sides: 10 });
    }
    const g = hb.build(); g.normal = vertexNormals(g.position, g.index);
    parts.push({ name: 'capButton', geometry: g, material: 'main' });
  }
  if (type === 'beanie' && spec.pompom) {
    const mb = new MeshBuilder();
    const top = q.raycast([c[0], topY + 0.3 * S, c[2]], [0, -1, 0], 0.5 * S);
    const ctr = top ? madd(top.p, top.n, 0.03 * S) : [c[0], topY + 0.05 * S, c[2]];
    const r = 0.035 * S;
    const nU = 24, nV = 16;
    for (let j = 0; j <= nV; j++) for (let i = 0; i <= nU; i++) {
      const th = j / nV * Math.PI, ph = i / nU * Math.PI * 2;
      const d = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
      const rr = r * (1 + 0.18 * noise3(d[0] * 6, d[1] * 6, d[2] * 6, 9) + 0.08 * noise3(d[0] * 20, d[1] * 20, d[2] * 20, 2));
      mb.vert(madd(ctr, d, rr), d, i / nU, j / nV);
    }
    for (let j = 0; j < nV; j++) for (let i = 0; i < nU; i++) { const a = j * (nU + 1) + i; mb.quad(a, a + nU + 1, a + nU + 2, a + 1); }
    const g = mb.build(); orientOut(g); g.normal = vertexNormals(g.position, g.index);
    parts.push({ name: 'pompom', geometry: g, material: 'rib' });
  }
  // hair hidden inside the crown
  const hides = (x, y, z) => region(x, y, z) < -0.004 * S && crown(x, y, z) < 0;
  return { meshes: meshes.concat(parts.map(p => ({ name: p.name, geometry: p.geometry, material: p.material }))), hides, bone: 'head' };
}

/** Hood worn up, hijab: a covering shell around the head (and neck / shoulders) with a face opening. */
function headCovering(spec, ctx) {
  const { sf, D, U } = ctx;
  const m = sf.head.marks, S = m.S, F = ctx.F;
  const c = m.cranium.c, R = m.cranium.r;
  const hairT = Math.min(0.045 * S, hairThickness(ctx.hairParts, sf.farField, m.napeY - 0.1 * S, S));
  const ease = (spec.ease ?? 0.006) * S + hairT * 0.85;
  const hijab = spec.type === 'hijab';
  // face opening: an oval around the eyes, nose, mouth and chin (hijab) or a wider hood opening
  const fc = [0, (m.eyes[0].center[1] + m.chin[1]) / 2 + (hijab ? 0.0 : 0.012) * S, m.noseTip[2]];
  const fw = (hijab ? 0.062 : 0.075) * S, fh = (hijab ? 0.085 : 0.1) * S;
  const faceHole = (x, y, z) => {
    if (z > c[2] - 0.02 * S) return 1;
    const dx = x / fw, dy = (y - fc[1]) / fh;
    return (Math.sqrt(dx * dx + dy * dy) - 1) * Math.min(fw, fh);
  };
  // bulk: around the head + hair, a crown peak for hoods, hanging onto the shoulders / chest
  const dome = (x, y, z) => (Math.sqrt(((x - c[0]) / (R[0] + ease)) ** 2 + ((y - c[1] - 0.006 * S) / (R[1] + ease)) ** 2 + ((z - c[2] - 0.01 * S) / (R[2] + ease + 0.006 * S)) ** 2) - 1) * Math.min(...R);
  // close to the face there is no hair: the fabric hugs the cheeks and chin
  const easeAt = (x, y, z) => {
    const front = ss(c[2] - 0.01 * S, c[2] - 0.07 * S, z);
    const nearFace = front * ss(m.browY + 0.02 * S, m.browY - 0.03 * S, y);
    // over the forehead the hair is pulled back under the fabric: it stays close (no brim over the eyes)
    const forehead = front * ss(m.top[1] - 0.01 * S, m.browY + 0.03 * S, y);
    let e = ease - (ease - 0.01 * S) * forehead;
    return e - (e - 0.005 * S) * nearFace;
  };
  const field = { eval: (x, y, z) => {
    const u = U.eval(x, y, z) - easeAt(x, y, z);
    let d = smin(u, dome(x, y, z), 0.03 * S);
    // fabric falls straight from the head to the shoulders around the neck: a capped cylinder (a continuous
    // distance, so it joins the head dome and the shoulders smoothly)
    const neckCurtain = (Math.hypot(x / ((hijab ? 0.085 : 0.1) * S), (z - c[2] - 0.015 * S) / ((hijab ? 0.085 : 0.11) * S)) - 1) * 0.08 * S;
    const seg = Math.max(neckCurtain, y - (m.chin[1] + 0.04 * S), (F.shoulderY - 0.05 * S) - y);
    d = smin(d, seg, 0.04 * S);
    return d;
  } };
  const bottom = hijab ? F.chestY + (spec.length ?? 0.04) * S : F.neckBase[1] - 0.01 * S;
  // a cape cone from the head over the shoulders (never down the arms)
  const capeR = y => 0.15 * S + hairT * 1.3 + Math.max(0, F.shoulderY + 0.04 * S - y) * 1.3;   // room for the hair underneath
  const region = (x, y, z) => {
    const box = Math.max(Math.abs(x) - 0.35 * S, bottom - y);
    if (box > 0) return box;
    let r = -faceHole(x, y, z);
    r = Math.max(r, Math.hypot(x, z - c[2]) - capeR(y));
    if (!hijab) r = Math.max(r, Math.hypot(x, z - c[2]) - 0.2 * S - hairT * 1.3);
    return Math.max(r, bottom - y);
  };
  const G = {
    field, region, regionParts: [{ name: 'face', fn: (x, y, z) => -faceHole(x, y, z) }, { name: 'hem', fn: (x, y) => bottom - y }],
    thickness: (spec.thickness ?? (hijab ? 0.0016 : 0.004)) * S, cell: Math.min(D.garment * 0.7, 0.007 * S),
    bounds: { min: [-0.36 * S, bottom - 0.02 * S, c[2] - 0.3 * S], max: [0.36 * S, m.top[1] + 0.08 * S, c[2] + 0.3 * S] },
    bands: hijab ? {} : { face: { w: 0.025 * S, kind: 'band' } },
    panel: (x) => (x < 0 ? 0 : 1), uv: (pn, x, y, z) => [Math.atan2(x, -(z - c[2])) * 0.1 * S, y],
    displace: (p, n, info) => 0.003 * S * (0.5 + 0.5 * noise3(p[0] * 30, p[1] * 18, p[2] * 30, 5)) + (hijab ? 0.006 * S * ss(m.chin[1], bottom, p[1]) * (0.5 + 0.5 * Math.sin(Math.atan2(p[0], -(p[2] - c[2])) * 9)) : 0),
    bandWidth: 0.08 * S, roundRim: 3, minIsland: 30,
  };
  const mesh = meshGarment(G, { bodyField: sf.field, S });
  const hides = hijab ? () => true : (x, y, z) => y > m.napeY - 0.08 * S && faceHole(x, y, z) > 0.012 * S && field.eval(x, y, z) < -0.002 * S;
  return { meshes: [{ name: hijab ? 'hijab' : 'hood', geometry: mesh, groups: mesh.groups }], hides, bone: null, field, region };
}

function orientOut(g) {
  const P = g.position, I = g.index;
  let v = 0;
  for (let t = 0; t < I.length; t += 3) { const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3; v += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]); }
  if (v < 0) for (let t = 0; t < I.length; t += 3) { const tmp = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = tmp; }
}
export { orientOut };
void gradient; void dot; void len;
