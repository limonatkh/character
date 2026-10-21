/* =====================================================================
 * GARMENT TRIMS AND CONSTRUCTION DETAILS
 *
 * Built on the finished garment surface (folds included):
 *   collars (shirt, polo, mandarin, Peter Pan, blazer), turtleneck rolls,
 *   hoods, lapels (notch / peak / shawl), plackets with buttons, zippers
 *   (closed or open), patch / flap / cargo / kangaroo / welt / jeans
 *   pockets, belt loops, fly, rivets, cuff buttons, turn-ups,
 *   drawstrings with eyelets and aglets, and stitching along hems, seams,
 *   pockets and plackets.
 * Each trim is a separate mesh part with a material slot:
 *   main (garment fabric) · trim (contrast fabric) · rib · lining ·
 *   hardware (buttons, zips, rivets, aglets) · stitch (thread) · cord · tape
 * ===================================================================== */
import { MeshBuilder, resample, add, sub, mul, dot, cross, norm, len, madd, lerp3, rng, disc, box, projectTo, fieldNormal } from '../mesh/builder.js';
import { MeshQuery } from '../mesh/query.js';
import { vertexNormals } from './shell.js';

const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/**
 * @param list   trim specs [{ type, ...params }]
 * @param ctx    { F, S, D, g (meshGarment output), region (garment region fn), seed, cut info }
 * @returns parts [{ name, material, geometry }]
 */
export function buildTrims(list, ctx) {
  const { g, S } = ctx;
  const sf = g.surface;
  const q = new MeshQuery(sf.P, sf.I, 0.02 * S);
  const T = { ...ctx, q, sf, parts: [], rand: rng(ctx.seed || 7) };
  for (const tr of list || []) {
    const fn = TRIMS[tr.type];
    if (!fn) continue;
    try { fn(T, tr); } catch (e) { if (typeof console !== 'undefined') console.warn('[n3d trims]', tr.type, e.message); }
  }
  // stitching along edges / seams (garment-level setting)
  if (ctx.stitch) stitching(T, ctx.stitch);
  return T.parts;
}

/* =================================================================== helpers */
function part(T, name, material, mb, opts = {}) {
  if (!mb.idx.length) return;
  const geo = mb.build();
  if (opts.open) orient(T, geo); else orientClosed(geo);
  if (opts.smooth !== false && !opts.keepNormals) geo.normal = vertexNormals(geo.position, geo.index);
  else geo.normal = flatFacing(T, geo);
  T.parts.push({ name, material, geometry: geo });
}
/** Make triangles face outward: majority vote against the garment surface normal underneath. */
function orient(T, geo) {
  const P = geo.position, I = geo.index;
  let vote = 0;
  for (let t = 0; t < I.length; t += 3 * Math.max(1, Math.floor(I.length / 3 / 300))) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    const ctr = [(P[a] + P[b] + P[c]) / 3, (P[a + 1] + P[b + 1] + P[c + 1]) / 3, (P[a + 2] + P[b + 2] + P[c + 2]) / 3];
    const h = T.q.nearest(ctr, 0.08 * T.S);
    if (!h) continue;
    // outward = away from the garment surface point, or along its normal when on it
    let o = sub(ctr, h.p); if (len(o) < 0.0015 * T.S) o = h.n;
    vote += Math.sign(dot(n, o)) * Math.min(1, len(n) * 1e6);
  }
  if (vote < 0) for (let t = 0; t < I.length; t += 3) { const tmp = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = tmp; }
}
/** Closed parts: positive signed volume ⇒ outward winding. */
function orientClosed(geo) {
  const P = geo.position, I = geo.index;
  let v = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    v += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]);
  }
  if (v < 0) for (let t = 0; t < I.length; t += 3) { const tmp = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = tmp; }
}
/** Flat parts (stitches, thread): normals along the garment surface normal. */
function flatFacing(T, geo) {
  const P = geo.position, N = new Float32Array(P.length);
  for (let i = 0; i < P.length; i += 3) { const h = T.q.nearest([P[i], P[i + 1], P[i + 2]], 0.03 * T.S); const n = h ? h.n : [0, 0, -1]; N[i] = n[0]; N[i + 1] = n[1]; N[i + 2] = n[2]; }
  return N;
}

/** Contiguous runs of boundary vertices of a type (prefix match), as ordered point lists. */
export function edgeRuns(sf, typePrefix, minLen = 0.04) {
  const runs = edgeRunsAll(sf, typePrefix);
  // drop slivers (a few stray boundary vertices of the same type)
  return runs.filter(r => { let L = 0; for (let i = 1; i < r.pts.length; i++) L += len(sub(r.pts[i], r.pts[i - 1])); return L >= minLen; });
}
function edgeRunsAll(sf, typePrefix) {
  const out = [];
  for (const lp of sf.loops) {
    const n = lp.verts.length, ok = lp.types.map(t => t.startsWith(typePrefix));
    if (!ok.some(Boolean)) continue;
    const pts = v => [sf.P[v * 3], sf.P[v * 3 + 1], sf.P[v * 3 + 2]];
    const nrm = v => [sf.N[v * 3], sf.N[v * 3 + 1], sf.N[v * 3 + 2]];
    if (ok.every(Boolean)) {
      const xs = lp.verts.map(v => Math.sign(sf.P[v * 3]));
      const cut = lp.types[0].startsWith('legHem') ? xs.findIndex((x, i) => x !== xs[(i + n - 1) % n]) : -1;
      if (cut < 0) { out.push({ pts: lp.verts.map(pts), nrm: lp.verts.map(nrm), closed: true, type: lp.types[0] }); continue; }
      // one loop around both trouser legs (they touch at the hem): one open run per leg
      let run = [];
      for (let k = 0; k < n; k++) {
        const i = (cut + k) % n;
        if (run.length && xs[i] !== xs[(i + n - 1) % n]) { if (run.length > 2) out.push({ pts: run.map(pts), nrm: run.map(nrm), closed: false, type: lp.types[0] }); run = []; }
        run.push(lp.verts[i]);
      }
      if (run.length > 2) out.push({ pts: run.map(pts), nrm: run.map(nrm), closed: false, type: lp.types[0] });
      continue;
    }
    let start = ok.findIndex((v, i) => v && !ok[(i + n - 1) % n]);
    for (let k = 0; k < n; k++) {
      const i = (start + k) % n;
      if (!ok[i] || ok[(i + n - 1) % n]) continue;
      const run = [];
      for (let j = i; ok[j % n] && run.length < n; j++) {
        const v = lp.verts[j % n];
        // a trouser leg's hem never crosses the centre line: where the legs were split apart the run
        // jumps to the other leg, so it ends there
        if (run.length && lp.types[j % n].startsWith('legHem') && Math.sign(sf.P[v * 3]) !== Math.sign(sf.P[run[run.length - 1] * 3])) {
          if (run.length > 2) out.push({ pts: run.map(pts), nrm: run.map(nrm), closed: false, type: lp.types[i] });
          run.length = 0;
        }
        run.push(v);
      }
      if (run.length > 2) out.push({ pts: run.map(pts), nrm: run.map(nrm), closed: false, type: lp.types[i] });
    }
    void start;
  }
  return out;
}

/** Rotate a closed loop so it starts at the front-most point near x = 0. */
function startAtFront(pts) {
  let best = 0, bz = Infinity;
  pts.forEach((p, i) => { const sc = p[2] + Math.abs(p[0]) * 3; if (sc < bz) { bz = sc; best = i; } });
  return [...pts.slice(best), ...pts.slice(0, best + 1)];
}
/** Make the loop run counter-clockwise seen from above (front → character's left → back → right). */
function orientLoop(pts, cz) {
  let area = 0;
  for (let i = 0; i < pts.length - 1; i++) area += (pts[i][0]) * (pts[i + 1][2] - cz) - (pts[i + 1][0]) * (pts[i][2] - cz);
  return area < 0 ? pts.slice().reverse() : pts;
}

/** Cut `d` metres off both ends of a polyline. */
function trimEnds(pts, d) {
  const cut = (arr) => { let acc = 0; for (let i = 1; i < arr.length; i++) { acc += len(sub(arr[i], arr[i - 1])); if (acc >= d) return arr.slice(i); } return arr; };
  return cut(cut(pts).reverse()).reverse();
}

/** Push p outside the garment surface by at least `gap` (keeps trims on top). */
function liftOut(T, p, gap, maxD = 0.06) {
  const h = T.q.nearest(p, maxD * T.S);
  if (!h) return p;
  const d = dot(sub(p, h.p), h.n);
  return d < gap ? madd(h.p, h.n, gap) : p;
}

/** Point on the garment around the torso at angle θ (0 front, + character's right), height y. */
function torsoHit(T, th, y) {
  const S = T.S, zc = 0.01 * S;
  const dir = [Math.sin(th), 0, -Math.cos(th)], back = mul(dir, -1);
  let o = [dir[0] * 0.6 * S, y, zc + dir[2] * 0.6 * S], left = 0.6 * S;
  // skip the sleeves (an arm hanging in front of the hip must not catch a pocket or a placket)
  for (let k = 0; k < 4; k++) {
    const h = T.q.raycast(o, back, left);
    if (!h) return null;
    const pn = T.sf.panelOf ? T.sf.panelOf[T.sf.I[h.tri * 3]] : 0;
    if (pn !== 2 && pn !== 3) return h;
    const step = h.t + 0.002 * S;
    o = madd(o, back, step); left -= step;
    if (left <= 0) return null;
  }
  return null;
}
/** Point on a trouser leg / sleeve: around the limb axis at t (0 root … 1 end), angle φ (0 = front). */
function limbHit(T, seg, t, phi) {
  const S = T.S;
  const c = madd(seg.a, seg.d, seg.L * t);
  const f = norm(sub([0, 0, -1], mul(seg.d, dot([0, 0, -1], seg.d))));
  const side = norm(cross(seg.d, f));
  const dir = norm(add(mul(f, Math.cos(phi)), mul(side, Math.sin(phi) * (seg.sign || 1))));
  return T.q.raycast(madd(c, dir, 0.35 * S), mul(dir, -1), 0.35 * S);
}

/** Generic sweep: rings of a 2D profile (x along `o`, y along `h`) at each path point. */
function sweep(mb, path, axes, profile, opts = {}) {
  const n = path.length;
  const start = mb.count;
  let m = 0, Lacc = 0;
  for (let i = 0; i < n; i++) {
    if (i) Lacc += len(sub(path[i], path[i - 1]));
    const prof = profile(i, i / (n - 1));
    m = prof.length;
    const { o, h } = axes(i);
    prof.forEach(([x, y], k) => {
      let p = add(path[i], add(mul(o, x), mul(h, y)));
      if (opts.post) p = opts.post(p, i, k);
      mb.vert(p, o, k / (m - 1), Lacc * (opts.vScale ?? 20));
    });
  }
  const closedProf = opts.closedProfile !== false;
  for (let i = 0; i < n - 1 + (opts.closedPath ? 1 : 0); i++) {
    const i2 = (i + 1) % n;
    for (let k = 0; k < m - (closedProf ? 0 : 1); k++) {
      const k2 = (k + 1) % m;
      const a = start + i * m + k, b = start + i * m + k2, c = start + i2 * m + k2, d = start + i2 * m + k;
      mb.quad(a, b, c, d);
    }
  }
  if (opts.caps && !opts.closedPath && closedProf) {
    for (const [ring, flip] of [[0, true], [n - 1, false]]) {
      let cx = 0, cy = 0, cz = 0;
      for (let k = 0; k < m; k++) { const v = start + ring * m + k; cx += mb.pos[v * 3]; cy += mb.pos[v * 3 + 1]; cz += mb.pos[v * 3 + 2]; }
      const ci = mb.vert([cx / m, cy / m, cz / m], [0, 1, 0], 0.5, 0.5);
      for (let k = 0; k < m; k++) { const a = start + ring * m + k, b = start + ring * m + (k + 1) % m; if (flip) mb.tri(a, b, ci); else mb.tri(b, a, ci); }
    }
  }
  return { start, m };
}

/** Thin closed polygon around a 2D polyline (thickness t, rounded ends). */
function thickProfile(line, t) {
  const n = line.length, up = [], dn = [];
  for (let i = 0; i < n; i++) {
    const a = line[Math.max(0, i - 1)], b = line[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const nx = -ty, ny = tx;
    up.push([line[i][0] + nx * t / 2, line[i][1] + ny * t / 2]);
    dn.push([line[i][0] - nx * t / 2, line[i][1] - ny * t / 2]);
  }
  return [...up, ...dn.reverse()];
}

/** Resample a polyline at a target spacing. */
function respace(pts, spacing, closed = false) {
  const p = closed ? [...pts, pts[0]] : pts;
  let L = 0; for (let i = 1; i < p.length; i++) L += len(sub(p[i], p[i - 1]));
  const n = Math.max(4, Math.round(L / spacing) + 1);
  const r = resample(p, n);
  return closed ? r.slice(0, -1) : r;
}

/* =================================================================== button */
export function button(mb, c, n, r, opts = {}) {
  const th = opts.thickness ?? r * 0.45;
  disc(mb, madd(c, n, th / 2), n, r, th, { sides: opts.sides || 14, bevel: 0.35 });
}
function threadCross(mb, c, n, r) {
  const u = norm(cross(n, Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), v = cross(n, u);
  for (const [a, b] of [[u, v], [v, mul(u, -1)]]) {
    const s = r * 0.32, w = r * 0.07;
    const p0 = madd(madd(c, a, -s), b, -w), p1 = madd(madd(c, a, s), b, -w), p2 = madd(madd(c, a, s), b, w), p3 = madd(madd(c, a, -s), b, w);
    const i0 = mb.vert(p0, n, 0, 0), i1 = mb.vert(p1, n, 1, 0), i2 = mb.vert(p2, n, 1, 1), i3 = mb.vert(p3, n, 0, 1);
    mb.quad(i0, i1, i2, i3);
  }
}
function buttonsAlong(T, pts, nrms, count, r, opts = {}) {
  const hw = new MeshBuilder(), th = new MeshBuilder();
  const L = []; let acc = 0;
  for (let i = 0; i < pts.length; i++) { if (i) acc += len(sub(pts[i], pts[i - 1])); L.push(acc); }
  const top = opts.startAt ?? 0.015 * T.S, bottom = acc - (opts.endGap ?? 0.04 * T.S);
  for (let k = 0; k < count; k++) {
    const s = count === 1 ? top : top + (bottom - top) * k / (count - 1);
    let i = L.findIndex(v => v >= s); if (i < 0) i = pts.length - 1;
    const c = madd(pts[i], nrms[i], opts.lift ?? 0.0015 * T.S), n = nrms[i];
    button(hw, c, n, r);
    if (opts.holes !== false) threadCross(th, madd(c, n, r * 0.47 + 0.0002), n, r);
  }
  part(T, 'buttons', 'hardware', hw);
  part(T, 'buttonThread', 'stitch', th, { smooth: false, open: true });
}

/* =================================================================== stitching */
/**
 * Dashed thread along a polyline lying on the surface.
 * opts: { dash, gap, width, lift, rows: [offsets across] , closed }
 */
export function stitchLine(mb, T, pts, opts = {}) {
  const S = T.S;
  const dash = opts.dash ?? 0.003 * S, gap = opts.gap ?? 0.0018 * S, w = opts.width ?? 0.0007 * S, lift = opts.lift ?? 0.00045 * S;
  const path = respace(pts, (dash + gap) / 2, opts.closed);
  let acc = 0, on = true, segStart = null;
  const emit = (a, b) => {
    const ha = T.q.nearest(a, 0.03 * S), hb = T.q.nearest(b, 0.03 * S);
    if (!ha || !hb) return;
    const n = norm(add(ha.n, hb.n));
    const pa = madd(ha.p, n, lift), pb = madd(hb.p, n, lift);
    const t = norm(sub(pb, pa)), side = mul(norm(cross(n, t)), w / 2);
    const i0 = mb.vert(sub(pa, side), n, 0, 0), i1 = mb.vert(add(pa, side), n, 1, 0), i2 = mb.vert(add(pb, side), n, 1, 1), i3 = mb.vert(sub(pb, side), n, 0, 1);
    mb.quad(i0, i3, i2, i1);
  };
  for (let i = 1; i < path.length; i++) {
    const l = len(sub(path[i], path[i - 1]));
    if (on && !segStart) segStart = path[i - 1];
    acc += l;
    if (on && acc >= dash) { emit(segStart, path[i]); segStart = null; acc = 0; on = false; }
    else if (!on && acc >= gap) { acc = 0; on = true; }
  }
}

/** Offset a boundary run into the garment by `d` (along the surface). */
function insetRun(T, run, d) {
  const out = [];
  const n = run.pts.length;
  for (let i = 0; i < n; i++) {
    const a = run.pts[run.closed ? (i + n - 1) % n : Math.max(0, i - 1)], b = run.pts[run.closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const t = norm(sub(b, a)), nn = run.nrm[i];
    let side = norm(cross(nn, t));
    // inward = toward the garment (region value decreases)
    const r = T.region;
    if (r) { const p1 = madd(run.pts[i], side, 0.004 * T.S), p2 = madd(run.pts[i], side, -0.004 * T.S); if (r(...p1) > r(...p2)) side = mul(side, -1); }
    const h = T.q.nearest(madd(run.pts[i], side, d), 0.04 * T.S);
    out.push(h ? h.p : madd(run.pts[i], side, d));
  }
  return out;
}

function stitching(T, st) {
  const mb = new MeshBuilder();
  const S = T.S;
  // hems, cuffs, necklines, waistbands: rows at given offsets from the edge
  for (const [type, rows] of Object.entries(st.edges || {})) {
    for (const run of edgeRuns(T.sf, type)) {
      if (run.pts.length < 4) continue;
      for (const off of rows) stitchLine(mb, T, insetRun(T, run, off * S), { closed: run.closed });
    }
  }
  // panel seams (side seams, shoulder seams, armholes, inseams…): one row each side
  if (st.seams) for (const sm of T.sf.seams) {
    if (sm.pts.length < 5) continue;
    for (const side of st.seams === 'double' ? [-1, 1] : [1]) {
      const pts = sm.pts.map((p, i) => {
        const a = sm.pts[Math.max(0, i - 1)], b = sm.pts[Math.min(sm.pts.length - 1, i + 1)];
        const h = T.q.nearest(p, 0.03 * S); if (!h) return p;
        const sd = norm(cross(h.n, norm(sub(b, a))));
        const h2 = T.q.nearest(madd(h.p, sd, side * 0.0035 * S), 0.03 * S);
        return h2 ? h2.p : p;
      });
      stitchLine(mb, T, pts, {});
    }
  }
  part(T, 'stitching', 'stitch', mb, { smooth: false, open: true });
}

/* =================================================================== trims */
const TRIMS = {};

/** Collars: shirt · polo · mandarin · peterpan · blazer · turtle (rolled) · sailor */
TRIMS.collar = (T, tr) => {
  const S = T.S, F = T.F;
  const runs = edgeRuns(T.sf, 'neck');
  if (!runs.length) return;
  const style = tr.style || 'shirt';
  const P = {
    shirt: { stand: 0.03, fall: 0.042, spread: 0.3, point: 0.03, th: 0.0028, lean: -0.003 },
    polo: { stand: 0.014, fall: 0.04, spread: 0.5, point: 0.012, th: 0.0035, lean: 0 },
    mandarin: { stand: 0.032, fall: 0, spread: 0, point: 0, th: 0.003, lean: -0.004 },
    peterpan: { stand: 0.004, fall: 0.05, spread: 1, point: -0.02, th: 0.0025, lean: 0 },
    blazer: { stand: 0.026, fall: 0.045, spread: 0.6, point: 0.02, th: 0.004, lean: -0.002 },
    turtle: { stand: 0.0, fall: 0.055, spread: 0.0, point: 0, th: 0.006, lean: 0, roll: 0.009 },
    sailor: { stand: 0.004, fall: 0.15, spread: 1, point: 0.06, th: 0.0025, lean: 0, back: 1 },
  }[style] || {};
  const stand = (tr.stand ?? P.stand) * S, fall = (tr.fall ?? P.fall) * S, spread = tr.spread ?? P.spread, pointL = (tr.point ?? P.point) * S;
  const th = (tr.thickness ?? P.th) * S;
  const nc = [0, F.neckBase[1], F.neckBase[2]];
  for (const run of runs) {
    let pts = run.closed ? startAtFront(orientLoop(run.pts, nc[2])) : run.pts.slice();
    if (style === 'turtle') pts = run.closed ? orientLoop(run.pts, nc[2]).concat([run.pts[0]]) : pts;
    pts = respace(pts, 0.004 * S);
    // collar ends sit at the placket edges, not at the centre line
    if (run.closed && style !== 'turtle') { const gap = (tr.frontGap ?? 0.011) * S; pts = trimEnds(pts, gap); }
    pts = respace(pts, 0.006 * S);
    const n = pts.length;
    const mb = new MeshBuilder();
    const axes = i => {
      const p = pts[i];
      const o = norm([p[0] - nc[0], 0, p[2] - nc[2]]);
      return { o, h: [0, 1, 0] };
    };
    const profile = (i, u) => {
      const end = Math.max(0, 1 - Math.min(u, 1 - u) / 0.2);           // 1 at the collar points (front)
      const e = end * end;
      const line = [];
      if (style === 'turtle') {
        // folded-over roll: up the neck, round fold, back down outside
        const r = P.roll * S;
        line.push([0, 0], [0.002 * S, 0.004 * S]);
        for (let k = 0; k <= 6; k++) { const a = Math.PI * k / 6; line.push([r - r * Math.cos(a) + 0.002 * S, 0.006 * S + r * Math.sin(a) * 1.1]); }
        line.push([2 * r + 0.003 * S, -fall * 0.5], [2 * r + 0.004 * S, -fall]);
        return thickProfile(line.reverse(), th);
      }
      line.push([0, 0], [P.lean * S * 0.5, stand * 0.5], [P.lean * S, stand]);
      if (fall > 0) {
        const fr = 0.004 * S;
        line.push([P.lean * S + fr * 0.6, stand + fr * 0.7], [P.lean * S + fr * 1.6, stand + fr * 0.5]);
        const fo = 0.01 * S + spread * 0.012 * S + e * pointL * 0.7;
        const fh = stand - fall - e * pointL * 1.3;
        line.push([(P.lean * S + fo) * 0.6, stand - fall * 0.35], [fo, fh]);
      }
      return thickProfile(line, th);
    };
    sweep(mb, pts, axes, profile, { caps: true, closedPath: style === 'turtle' && run.closed, post: (p, i, k) => (k > 3 ? liftOut(T, p, th * 0.6) : p) });
    part(T, 'collar', tr.material || (style === 'polo' || style === 'turtle' ? 'rib' : 'main'), mb);
  }
};

/** Front placket with buttons (shirts, polos, henleys, cardigans). */
TRIMS.placket = (T, tr) => {
  const S = T.S, F = T.F;
  const top = tr.top ?? F.neckBase[1] - 0.01 * S, bottom = tr.bottom ?? (T.info.hemY ?? F.hipY) + 0.01 * S;
  const xo = (tr.x || 0) * S;
  const pts = [], nrms = [];
  for (let y = top; y >= bottom; y -= 0.006 * S) {
    const h = T.q.raycast([xo, y, -0.6 * S], [0, 0, 1], 0.7 * S);
    if (h) { pts.push(h.p); nrms.push(h.n); }
  }
  if (pts.length < 3) return;
  const w = (tr.width ?? 0.032) * S, th = (tr.thickness ?? 0.0016) * S;
  const mb = new MeshBuilder();
  sweep(mb, pts, i => ({ o: nrms[i], h: norm(cross(nrms[i], norm(sub(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)])))) }),
    () => [[0, -w / 2], [th, -w / 2 + 0.001 * S], [th, w / 2 - 0.001 * S], [0, w / 2]], { caps: true });
  part(T, 'placket', tr.material || 'main', mb);
  if (tr.buttons) buttonsAlong(T, pts, nrms, tr.buttons, (tr.buttonSize ?? 0.0055) * S, { lift: th });
  const st = new MeshBuilder();
  for (const side of [-1, 1]) stitchLine(st, T, pts.map((p, i) => madd(p, norm(cross(nrms[i], norm(sub(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)])))), side * (w / 2 - 0.003 * S))), { lift: th + 0.0003 * S });
  part(T, 'placketStitch', 'stitch', st, { smooth: false, open: true });
};

/** Free buttons on the front (jackets, coats, double-breasted rows). */
TRIMS.buttons = (T, tr) => {
  const S = T.S, F = T.F;
  const ys = tr.ys || [];
  const xs = tr.xs || [0];
  const hw = new MeshBuilder(), th = new MeshBuilder();
  for (const y of ys) for (const x of xs) {
    const h = T.q.raycast([x * S, y, -0.6 * S], [0, 0, 1], 0.7 * S);
    if (!h) continue;
    const r = (tr.size ?? 0.009) * S;
    button(hw, madd(h.p, h.n, 0.0004 * S), h.n, r);
    threadCross(th, madd(h.p, h.n, r * 0.47 + 0.0006 * S), h.n, r);
  }
  part(T, 'buttons', 'hardware', hw);
  part(T, 'buttonThread', 'stitch', th, { smooth: false, open: true });
};

/** Dungaree straps: from the bib's top corners over the shoulders, crossing on the back, with buckles. */
TRIMS.overallStraps = (T, tr) => {
  const S = T.S, F = T.F, fld = T.field;
  if (!fld) return;
  const topF = F.chestY + 0.045 * S, topB = F.waistY + 0.07 * S, w = (tr.w ?? 0.024) * S, th = 0.0028 * S;
  const mb = new MeshBuilder(), hw = new MeshBuilder();
  for (const s of [-1, 1]) {
    // control points: bib corner (front) → over the shoulder near the neck → across the back to the other side
    const sh = F.J ? F.J[(s < 0 ? 'left' : 'right') + 'Shoulder'] : null;
    const shx = sh ? sh[0] * 0.75 : s * 0.1 * S, shy = F.shoulderY + 0.02 * S;
    const ctrl = [[s * 0.085 * S, topF - 0.01 * S, -0.2 * S], [s * 0.09 * S, (topF + shy) / 2, -0.2 * S], [shx, shy + 0.05 * S, 0], [s * 0.05 * S, (shy + topB) / 2 + 0.02 * S, 0.25 * S], [-s * 0.07 * S, topB - 0.005 * S, 0.25 * S]];
    let path = [];
    for (let i = 0; i < ctrl.length - 1; i++) for (let k = 0; k < 8; k++) path.push(lerp3(ctrl[i], ctrl[i + 1], k / 8));
    path.push(ctrl[ctrl.length - 1]);
    // lay the path on the garment / body surface (just outside it)
    path = path.map(p => projectTo(fld, p, th * 0.8 + 0.001 * S, 6));
    path = resample(path, 40);
    const nrm = path.map(p => fieldNormal(fld, p));
    sweep(mb, path, i => { const t = norm(sub(path[Math.min(path.length - 1, i + 1)], path[Math.max(0, i - 1)])); const o = nrm[i]; return { o, h: norm(cross(t, o)) }; },
      () => [[-th / 2, -w / 2], [th / 2, -w / 2], [th / 2, w / 2], [-th / 2, w / 2]], { caps: true });
    // buckle on the front, just above the bib corner
    const b = path[3], bn = nrm[3], bt = norm(sub(path[4], path[2])), bs = norm(cross(bt, bn));
    const c = madd(b, bn, th);
    const bw = w * 0.75, bh = w * 0.55;
    const frame = [[-bw, -bh], [bw, -bh], [bw, bh], [-bw, bh]].map(([u, v]) => add(c, add(mul(bs, u), mul(bt, v))));
    for (let i = 0; i < 4; i++) {
      const a = frame[i], e = frame[(i + 1) % 4];
      sweep(hw, [a, e], () => ({ o: bn, h: norm(sub(e, a)) }), () => [[0, -0.0018 * S], [0.0026 * S, -0.0018 * S], [0.0026 * S, 0.0018 * S], [0, 0.0018 * S]].map(([x, y]) => [x, y]), { caps: true });
    }
    disc(hw, madd(path[1], nrm[1], th), nrm[1], 0.0055 * S, 0.0025 * S);     // the bib button the strap hooks onto
  }
  part(T, 'straps', tr.material || 'main', mb);
  part(T, 'buckles', 'hardware', hw);
};

/** Welt pocket: a narrow lip with the opening above it (tailored jackets, trousers' back). */
TRIMS.welt = (T, tr) => {
  const S = T.S;
  const at = tr.at || {};
  const W = (tr.w ?? 0.13) * S, H = (tr.h ?? 0.012) * S;
  const mb = new MeshBuilder(), slot = new MeshBuilder();
  const pts = [];
  for (let k = 0; k <= 10; k++) {
    const th = (at.th || 0) + ((k / 10) - 0.5) * W / (0.16 * S) * (tr.angle ? 1 : 1);
    const h = torsoHit(T, th, (at.y ?? T.F.waistY) + (tr.slant || 0) * ((k / 10) - 0.5) * S);
    if (h) pts.push(h);
  }
  if (pts.length < 4) return;
  const p = pts.map(h => h.p), n = pts.map(h => h.n);
  sweep(mb, p, i => ({ o: n[i], h: [0, 1, 0] }), () => [[0, -H / 2], [0.0025 * S, -H / 2], [0.0025 * S, H / 2], [0, H / 2]], { caps: true });
  sweep(slot, p, i => ({ o: n[i], h: [0, 1, 0] }), () => [[0, H / 2], [0.0012 * S, H / 2], [0.0012 * S, H / 2 + 0.0015 * S], [0, H / 2 + 0.0015 * S]], { caps: true });
  part(T, 'welt', tr.material || 'main', mb);
  part(T, 'weltOpening', 'lining', slot);
  if (tr.flap) {
    const fb = new MeshBuilder();
    sweep(fb, p.map((q2, i) => madd(q2, n[i], 0.003 * S)), i => ({ o: n[i], h: [0, 1, 0] }), () => [[0, -0.045 * S], [0.002 * S, -0.045 * S], [0.002 * S, H / 2], [0, H / 2]], { caps: true, post: q2 => liftOut(T, q2, 0.0025 * S) });
    part(T, 'pocketFlap', tr.material || 'main', fb);
  }
};

/** Zipper: closed (centre front) or open (along both opening edges). */
TRIMS.zipper = (T, tr) => {
  const S = T.S, F = T.F;
  const lines = [];
  if (tr.open) {
    for (const run of edgeRuns(T.sf, 'opening')) lines.push({ pts: run.pts.slice().sort((a, b) => b[1] - a[1]), nrm: null, half: true });
  } else {
    const top = tr.top ?? F.neckBase[1] + 0.03 * S, bottom = tr.bottom ?? (T.info.hemY ?? F.hipY) + 0.005 * S;
    const pts = [];
    for (let y = top; y >= bottom; y -= 0.005 * S) { const h = T.q.raycast([0, y, -0.6 * S], [0, 0, 1], 0.7 * S); if (h) pts.push(h.p); }
    lines.push({ pts, half: false });
  }
  const tape = new MeshBuilder(), teeth = new MeshBuilder(), hw = new MeshBuilder();
  for (const ln of lines) {
    const pts = ln.pts;
    if (pts.length < 3) continue;
    const nrms = pts.map(p => { const h = T.q.nearest(p, 0.03 * S); return h ? h.n : [0, 0, -1]; });
    const tw = (ln.half ? 0.012 : 0.024) * S, th = 0.0012 * S;
    const side = i => norm(cross(nrms[i], norm(sub(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)]))));
    sweep(tape, pts, i => ({ o: nrms[i], h: side(i) }), () => [[0, -tw / 2], [th, -tw / 2], [th, tw / 2], [0, tw / 2]], { caps: true });
    // teeth: alternating small blocks along the centre
    const tp = respace(pts, 0.0028 * S);
    for (let i = 0; i < tp.length; i++) {
      const h = T.q.nearest(tp[i], 0.03 * S); const n = h ? h.n : [0, 0, -1];
      const t = norm(sub(tp[Math.min(tp.length - 1, i + 1)], tp[Math.max(0, i - 1)])), sd = norm(cross(n, t));
      const c = madd(madd(h ? h.p : tp[i], n, th + 0.0012 * S), sd, (i % 2 ? 1 : -1) * 0.0015 * S * (ln.half ? 0 : 1));
      box(teeth, c, [0.0028 * S, 0.0011 * S, 0.0012 * S].map((v, k) => (k === 0 ? v : v)), [sd, t, n]);
    }
    // slider and pull at the top
    if (!ln.half || tr.slider !== false) {
      const p0 = pts[ln.half ? 0 : Math.min(2, pts.length - 1)], n0 = nrms[0], t0 = norm(sub(pts[0], pts[Math.min(3, pts.length - 1)])), s0 = norm(cross(n0, t0));
      box(hw, madd(p0, n0, th + 0.003 * S), [0.006 * S, 0.009 * S, 0.0025 * S], [s0, t0, n0]);
      box(hw, madd(madd(p0, n0, th + 0.0055 * S), t0, -0.016 * S), [0.0045 * S, 0.013 * S, 0.001 * S], [s0, t0, n0]);
    }
  }
  part(T, 'zipperTape', 'tape', tape);
  part(T, 'zipperTeeth', 'hardware', teeth, { smooth: false });
  part(T, 'zipperPull', 'hardware', hw, { smooth: false });
};

/**
 * Pockets. kind: patch | flap | cargo | jeansBack | kangaroo | welt | jeansFront
 * at: { area: 'torso' | 'legL' | 'legR', th (angle), y (height) or t (along the leg) }
 */
TRIMS.pocket = (T, tr) => {
  const S = T.S, F = T.F;
  const kind = tr.kind || 'patch';
  if (kind === 'jeansFront') return jeansFront(T, tr);
  const W = (tr.w ?? 0.12) * S, H = (tr.h ?? 0.14) * S;
  let hit;
  const at = tr.at || {};
  if (!at.area || at.area === 'torso') hit = torsoHit(T, at.th || 0, at.y ?? F.chestY);
  else { const s = at.area === 'legL' ? 'left' : 'right'; hit = limbHit(T, F.legs[s], at.t ?? 0.35, at.th ?? Math.PI / 2); }
  if (!hit) return;
  const n = hit.n;
  const v = norm(sub([0, 1, 0], mul(n, n[1]))), u = norm(cross(v, n));
  const th = (tr.thickness ?? (kind === 'cargo' ? 0.012 : 0.0018)) * S;
  const mb = new MeshBuilder();
  // outline in (s, t): rectangle, pointed (jeans back), kangaroo trapezoid
  const nu = 12, nv = 12;
  const shape = (a, b) => {          // a, b ∈ [0,1]
    if (kind === 'kangaroo') {
      const wt = W * 0.62, wb = W;
      const half = (wb + (wt - wb) * b) / 2 - (b > 0.05 && b < 0.95 ? 0.02 * S * Math.sin(Math.PI * b) : 0);
      return [(a - 0.5) * 2 * half, (b - 0.5) * H];
    }
    let y = (b - 0.5) * H;
    if (kind === 'jeansBack' && b < 0.2) y -= (0.2 - b) / 0.2 * 0 + 0.018 * S * (1 - Math.abs(a - 0.5) * 2) * (1 - b / 0.2);
    return [(a - 0.5) * W, y];
  };
  const place = (a, b, lift) => {
    const [s2, t2] = shape(a, b);
    const p0 = add(hit.p, add(mul(u, s2), mul(v, t2)));
    const h = T.q.nearest(p0, 0.05 * S);
    const base = h ? h.p : p0, nn = h ? h.n : n;
    // bellows pockets bulge in the middle
    const bulge = kind === 'cargo' ? Math.sin(Math.PI * a) * Math.sin(Math.PI * Math.min(1, b * 1.2)) * 0.6 + 0.4 : 1;
    return madd(base, nn, lift * bulge);
  };
  // top surface grid
  const g0 = mb.count;
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) mb.vert(place(i / nu, j / nv, th), n, i / nu * W * 20, j / nv * H * 20);
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = g0 + j * (nu + 1) + i; mb.quad(a, a + 1, a + nu + 2, a + nu + 1); }
  // side walls (perimeter) down to the garment
  const perim = [];
  for (let i = 0; i <= nu; i++) perim.push([i / nu, 0]);
  for (let j = 1; j <= nv; j++) perim.push([1, j / nv]);
  for (let i = nu - 1; i >= 0; i--) perim.push([i / nu, 1]);
  for (let j = nv - 1; j > 0; j--) perim.push([0, j / nv]);
  const w0 = mb.count;
  for (const [a, b] of perim) { mb.vert(place(a, b, th), n, 0, 0); mb.vert(place(a, b, 0.0002 * S), n, 0, 1); }
  for (let k = 0; k < perim.length; k++) { const a = w0 + k * 2, b = w0 + ((k + 1) % perim.length) * 2; mb.quad(a, b, b + 1, a + 1); }
  part(T, 'pocket', tr.material || 'main', mb, { open: true });
  // stitching around (inset), opening edge left free on kangaroo pockets
  const st = new MeshBuilder();
  const inset = 0.004 * S;
  const ring = [];
  for (let k = 0; k < perim.length; k++) {
    const [a, b] = perim[k];
    const aa = clamp(a, inset / W, 1 - inset / W), bb = clamp(b, inset / H, 1 - inset / H);
    if (kind === 'kangaroo' && (a === 0 || a === 1) && b > 0.08 && b < 0.92) { if (ring.length > 2) stitchLine(st, T, ring.splice(0), { lift: th + 0.0004 * S }); ring.length = 0; continue; }
    ring.push(place(aa, bb, th));
  }
  if (ring.length > 2) stitchLine(st, T, ring.concat(kind === 'kangaroo' ? [] : [ring[0]]), { lift: th + 0.0004 * S });
  part(T, 'pocketStitch', 'stitch', st, { smooth: false, open: true });
  // flap with a button / snap
  if (kind === 'flap' || kind === 'cargo' || tr.flap) {
    const fb = new MeshBuilder();
    const fh = H * 0.32, fth = th + 0.003 * S;
    const placeF = (a, b, lift) => {
      const tip = kind === 'cargo' ? 0 : 0.012 * S * (1 - Math.abs(a - 0.5) * 2);
      const t2 = H / 2 + 0.008 * S - b * (fh + (b > 0.8 ? tip : 0));
      const p0 = add(hit.p, add(mul(u, (a - 0.5) * (W + 0.008 * S)), mul(v, t2)));
      const h = T.q.nearest(p0, 0.05 * S);
      return madd(h ? h.p : p0, h ? h.n : n, lift);
    };
    const f0 = fb.count;
    for (let j = 0; j <= 4; j++) for (let i = 0; i <= nu; i++) fb.vert(placeF(i / nu, j / 4, fth), n, i / nu, j / 4);
    for (let j = 0; j < 4; j++) for (let i = 0; i < nu; i++) { const a = f0 + j * (nu + 1) + i; fb.quad(a, a + 1, a + nu + 2, a + nu + 1); }
    const e0 = fb.count;
    for (let i = 0; i <= nu; i++) { fb.vert(placeF(i / nu, 1, fth), n, 0, 0); fb.vert(placeF(i / nu, 1, 0.0003 * S), n, 0, 1); }
    for (let i = 0; i < nu; i++) { const a = e0 + i * 2; fb.quad(a, a + 2, a + 3, a + 1); }
    part(T, 'pocketFlap', tr.material || 'main', fb, { open: true });
    if (tr.button !== false) {
      const bb = new MeshBuilder();
      const c = placeF(0.5, 0.75, fth);
      button(bb, c, n, 0.0055 * S);
      part(T, 'pocketButton', 'hardware', bb);
    }
  }
};

/** Jeans front pockets: curved opening, coin pocket, rivets. */
function jeansFront(T, tr) {
  const S = T.S, F = T.F, info = T.info;
  const top = (info.riseY ?? F.hipY + 0.06 * S) - 0.035 * S;
  const st = new MeshBuilder(), edge = new MeshBuilder(), hw = new MeshBuilder();
  for (const s of [-1, 1]) {
    const pts = [];
    for (let k = 0; k <= 16; k++) {
      const a = k / 16;
      const th = s * (0.62 + 0.5 * Math.pow(a, 0.7)), y = top - 0.075 * S * Math.sin(a * Math.PI / 2);
      const h = torsoHit(T, th, y); if (h) pts.push(madd(h.p, h.n, 0.0012 * S));
    }
    if (pts.length > 3) {
      const nrms = pts.map(p => { const h = T.q.nearest(p, 0.03 * S); return h ? h.n : [0, 0, -1]; });
      sweep(edge, pts, i => ({ o: nrms[i], h: norm(cross(nrms[i], norm(sub(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)])))) }), () => [[-0.001 * S, -0.0015 * S], [0.0005 * S, -0.0015 * S], [0.0005 * S, 0.0015 * S], [-0.001 * S, 0.0015 * S]], { caps: true });
      stitchLine(st, T, pts.map((p, i) => madd(p, norm(cross(nrms[i], norm(sub(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)])))), -0.006 * S * s)), {});
      for (const p of [pts[0], pts[pts.length - 1]]) { const h = T.q.nearest(p, 0.03 * S); if (h) disc(hw, madd(h.p, h.n, 0.0008 * S), h.n, 0.0035 * S, 0.0016 * S, { sides: 10, dome: true }); }
    }
  }
  part(T, 'pocketEdge', 'main', edge);
  part(T, 'pocketStitch', 'stitch', st, { smooth: false, open: true });
  part(T, 'rivets', 'hardware', hw);
  if (tr.coin !== false) TRIMS.pocket(T, { kind: 'patch', w: 0.05, h: 0.055, at: { th: 0.75, y: top - 0.03 * S }, material: tr.material });
}

/** Trouser waistband extras: belt loops, button, fly stitching. */
TRIMS.waistband = (T, tr) => {
  const S = T.S, F = T.F, info = T.info;
  const top = info.riseY ?? F.hipY + 0.06 * S, bw = (tr.width ?? 0.038) * S;
  const hw = new MeshBuilder(), loops = new MeshBuilder(), st = new MeshBuilder();
  if (tr.loops !== false) {
    const angles = tr.loopAngles || [-2.5, -1.45, -0.55, 0.55, 1.45, 2.5, Math.PI];
    for (const a of angles) {
      const pts = [];
      for (const y of [top + 0.004 * S, top - bw * 0.5, top - bw - 0.008 * S]) { const h = torsoHit(T, a, y); if (h) pts.push(madd(h.p, h.n, 0.0016 * S)); }
      if (pts.length < 3) continue;
      const nrms = pts.map(p => { const h = T.q.nearest(p, 0.04 * S); return h ? h.n : [0, 0, -1]; });
      const lw = 0.0055 * S, lt = 0.0018 * S;
      sweep(loops, resample(pts, 6), i => { const k = Math.min(2, Math.round(i / 2.5)); return { o: nrms[k], h: norm(cross(nrms[k], [0, 1, 0])) }; }, () => [[-lt / 2, -lw], [lt / 2, -lw], [lt / 2, lw], [-lt / 2, lw]], { caps: true });
    }
  }
  part(T, 'beltLoops', tr.material || 'main', loops);
  // front button / snap at the centre of the waistband
  if (tr.button !== false) {
    const h = torsoHit(T, 0.0, top - bw * 0.5);
    if (h) { disc(hw, madd(h.p, h.n, 0.0015 * S), h.n, 0.0075 * S, 0.003 * S, { sides: 16, dome: true }); }
  }
  part(T, 'waistButton', 'hardware', hw);
  // fly: J-stitch on the wearer's left front
  if (tr.fly !== false) {
    const pts = [];
    const crotch = F.crotchY + 0.03 * S;
    for (let k = 0; k <= 20; k++) {
      const a = k / 20;
      const y = top - bw - (top - bw - crotch) * Math.min(1, a * 1.15);
      const x = -0.032 * S * (a < 0.8 ? 1 : Math.cos((a - 0.8) / 0.2 * Math.PI / 2));
      const hh = T.q.raycast([x, y, -0.6 * S], [0, 0, 1], 0.7 * S); if (hh) pts.push(hh.p);
    }
    if (pts.length > 4) stitchLine(st, T, pts, {});
  }
  part(T, 'flyStitch', 'stitch', st, { smooth: false, open: true });
};

/** Hood lying on the back (down). */
TRIMS.hood = (T, tr) => {
  const S = T.S, F = T.F;
  const runs = edgeRuns(T.sf, 'neck');
  if (!runs.length) return;
  const nc = [0, F.neckBase[1], F.neckBase[2]];
  const size = tr.size ?? 1;
  const th = (tr.thickness ?? 0.011) * S;
  for (const run of runs) {
    let pts = run.closed ? startAtFront(orientLoop(run.pts, nc[2])) : run.pts.slice();
    pts = respace(pts, 0.008 * S);
    // the hood's front edges overlap slightly at the centre front
    const mb = new MeshBuilder();
    const axes = i => { const p = pts[i]; return { o: norm([p[0] - nc[0], 0, p[2] - nc[2]]), h: [0, 1, 0] }; };
    const profile = (i, u) => {
      const back = Math.pow(Math.sin(Math.PI * u), 0.9);
      const Lb = (0.06 + 0.17 * back) * S * size;             // how far the hood hangs down the back
      const rise = (0.028 + 0.012 * back) * S;
      const line = [[0, 0], [-0.002 * S, rise * 0.6], [0.004 * S, rise], [0.016 * S, rise + 0.006 * S], [0.03 * S, rise - 0.004 * S], [0.04 * S + 0.02 * S * back, rise - Lb * 0.5], [0.042 * S + 0.03 * S * back, rise - Lb]];
      return thickProfile(line, th * (0.5 + 0.5 * back));
    };
    sweep(mb, pts, axes, profile, { caps: true, post: (p, i, k) => (k > 2 ? liftOut(T, p, th * 0.55) : p) });
    part(T, 'hood', tr.material || 'main', mb);
    // hood lining visible at the rim → the same part (lining colour via material)
  }
};

/** Drawstrings with eyelets and aglets (hood or waistband). */
TRIMS.drawstrings = (T, tr) => {
  const S = T.S, F = T.F, info = T.info;
  const cord = new MeshBuilder(), hw = new MeshBuilder();
  const at = tr.at || 'hood';
  const y0 = at === 'hood' ? F.neckBase[1] + 0.012 * S : (info.riseY ?? F.hipY + 0.06 * S) - 0.015 * S;
  const Lc = (tr.length ?? (at === 'hood' ? 0.24 : 0.2)) * S, r = (tr.radius ?? 0.0028) * S;
  for (const s of [-1, 1]) {
    const x0 = s * (at === 'hood' ? 0.042 : 0.022) * S;
    let start = null;
    if (at === 'hood') {
      // just below the hood's front edge, on the neckline
      let best = null, bd = Infinity;
      for (const run of edgeRuns(T.sf, 'neck')) for (const p of run.pts) { if (p[2] > F.neckBase[2]) continue; const d = Math.abs(p[0] - x0) + Math.max(0, p[1] - y0) * 0.2; if (d < bd) { bd = d; best = p; } }
      if (best) start = T.q.nearest(madd(best, [0, -1, 0], 0.012 * S), 0.04 * S);
    } else start = T.q.raycast([x0, y0, -0.6 * S], [0, 0, 1], 0.7 * S);
    if (!start) continue;
    const n0 = start.n;
    disc(hw, madd(start.p, n0, 0.0012 * S), n0, 0.0045 * S, 0.0018 * S, { sides: 12 });      // eyelet
    const pts = [madd(start.p, n0, 0.004 * S)];
    let p = pts[0];
    const seg = 0.012 * S;
    for (let k = 0; k < Lc / seg; k++) {
      const dir = norm([s * 0.05 + 0.08 * (T.rand() - 0.5), -1, -0.12]);
      p = madd(p, dir, seg);
      p = liftOut(T, p, r * 1.3);
      pts.push(p);
    }
    const path = resample(pts, Math.max(6, pts.length * 2));
    tubeAlong(cord, path, r);
    const end = path[path.length - 1], d = norm(sub(end, path[path.length - 3]));
    tubeAlong(hw, [madd(end, d, -0.016 * S), madd(end, d, 0.004 * S)], r * 1.25, true);
  }
  part(T, 'drawstrings', 'cord', cord);
  part(T, 'aglets', 'hardware', hw);
};
function tubeAlong(mb, path, r, caps = true) {
  const n = path.length, sides = 8, start = mb.count;
  for (let i = 0; i < n; i++) {
    const t = norm(sub(path[Math.min(n - 1, i + 1)], path[Math.max(0, i - 1)]));
    const u = norm(cross(t, Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), v = cross(t, u);
    for (let k = 0; k < sides; k++) { const a = k / sides * Math.PI * 2; const d = add(mul(u, Math.cos(a)), mul(v, Math.sin(a))); mb.vert(madd(path[i], d, r), d, k / sides, i / (n - 1)); }
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < sides; k++) { const a = start + i * sides + k, b = start + i * sides + (k + 1) % sides; mb.quad(a, b, b + sides, a + sides); }
  if (caps) for (const [ring, flip] of [[0, true], [n - 1, false]]) {
    const ci = mb.vert(path[ring], [0, 1, 0], 0.5, 0.5);
    for (let k = 0; k < sides; k++) { const a = start + ring * sides + k, b = start + ring * sides + (k + 1) % sides; if (flip) mb.tri(b, a, ci); else mb.tri(a, b, ci); }
  }
}

/** Lapels for open-front jackets and coats: notch, peak or shawl. */
TRIMS.lapels = (T, tr) => {
  const S = T.S, F = T.F;
  const style = tr.style || 'notch';
  const Wl = (tr.width ?? 0.075) * S, th = (tr.thickness ?? 0.004) * S;
  const breakY = tr.breakY ?? F.waistY + 0.06 * S;
  const runs = edgeRuns(T.sf, 'opening').concat(edgeRuns(T.sf, 'neck'));
  const mb = new MeshBuilder(), stitchLines = [];
  for (const side of [-1, 1]) {
    // the opening edge on this side, above the break point, ordered bottom → top
    let pts = [];
    for (const run of runs) for (const p of run.pts) if (Math.sign(p[0] || side) === side && p[1] > breakY - 0.01 * S && p[2] < F.neckBase[2]) pts.push(p);
    pts.sort((a, b) => a[1] - b[1]);
    if (pts.length < 4) continue;
    pts = respace(pts, 0.008 * S);
    const n = pts.length;
    const outer = [], inner = [];
    for (let i = 0; i < n; i++) {
      const s = i / (n - 1);
      const h = T.q.nearest(pts[i], 0.03 * S); const nn = h ? h.n : [0, 0, -1];
      const t = norm(sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]));
      let d = norm(cross(nn, t)); if (d[0] * side < 0) d = mul(d, -1);      // away from the opening
      let w = Wl * ss(0, 0.5, s);
      if (style === 'notch' && s > 0.78) w *= 1 - 0.75 * ss(0.78, 0.86, s);
      if (style === 'peak') w *= 1 + 0.35 * ss(0.6, 0.95, s);
      if (style === 'shawl') w = Wl * 0.8 * ss(0, 0.4, s);
      const ho = T.q.nearest(madd(pts[i], d, w), 0.05 * S);
      const roll = 1 + 1.2 * s;                                            // lapels roll higher toward the collar
      outer.push(madd(ho ? ho.p : madd(pts[i], d, w), ho ? ho.n : nn, th * roll));
      inner.push(madd(pts[i], nn, th * 1.4 * roll));
    }
    stitchLines.push(outer.map((o, i) => lerp3(inner[i], o, 0.9)).filter((_, i) => i > 2));
    // lapel surface (strip between the fold line and the outer edge) + rounded fold
    const g0 = mb.count, cols = 5;
    for (let i = 0; i < n; i++) for (let k = 0; k <= cols; k++) {
      let p = lerp3(inner[i], outer[i], k / cols);
      p = liftOut(T, p, th);
      mb.vert(p, [0, 0, -1], k / cols, i / n);
    }
    for (let i = 0; i < n - 1; i++) for (let k = 0; k < cols; k++) {
      const a = g0 + i * (cols + 1) + k;
      if (side > 0) mb.quad(a, a + 1, a + cols + 2, a + cols + 1); else mb.quad(a, a + cols + 1, a + cols + 2, a + 1);
    }
    // edge wall along the outer edge
    const e0 = mb.count;
    for (let i = 0; i < n; i++) { const h = T.q.nearest(outer[i], 0.05 * S); mb.vert(outer[i], [0, 0, -1], 0, 0); mb.vert(h ? madd(h.p, h.n, 0.0004 * S) : outer[i], [0, 0, -1], 0, 1); }
    for (let i = 0; i < n - 1; i++) { const a = e0 + i * 2; if (side > 0) mb.quad(a, a + 1, a + 3, a + 2); else mb.quad(a, a + 2, a + 3, a + 1); }
  }
  part(T, 'lapels', tr.material || 'main', mb, { open: true });
  // pick-stitching just inside the lapel edges
  const st = new MeshBuilder();
  for (const line of stitchLines) if (line.length > 3) stitchLine(st, T, line, { lift: th * 1.6 });
  part(T, 'lapelStitch', 'stitch', st, { smooth: false, open: true });
  if (style !== 'shawl') TRIMS.collar(T, { style: 'blazer', material: tr.material });
};

/** Buttons on a sleeve end (shirt cuffs, jacket sleeves). */
TRIMS.cuffButtons = (T, tr) => {
  const S = T.S, F = T.F;
  const hw = new MeshBuilder(), th = new MeshBuilder();
  for (const s of ['left', 'right']) {
    const seg = F.arms[s];
    const tEnd = T.sleeveT ?? 1;
    const count = tr.count ?? 1;
    for (let k = 0; k < count; k++) {
      const t = tEnd - (0.035 + k * 0.022) * S / seg.L;
      const h = limbHit(T, seg, t, tr.phi ?? 2.2);
      if (!h) continue;
      const r = (tr.size ?? 0.0055) * S;
      button(hw, madd(h.p, h.n, 0.0005 * S), h.n, r);
      threadCross(th, madd(h.p, h.n, r * 0.47 + 0.0008 * S), h.n, r);
    }
  }
  part(T, 'cuffButtons', 'hardware', hw);
  part(T, 'cuffThread', 'stitch', th, { smooth: false, open: true });
};

/** Trouser turn-ups (rolled hems) / sleeve roll-ups. */
TRIMS.turnUp = (T, tr) => {
  const S = T.S;
  const type = tr.on === 'sleeve' ? 'cuff' : 'legHem';
  const hgt = (tr.height ?? 0.04) * S, th = (tr.thickness ?? 0.004) * S;
  const mb = new MeshBuilder();
  for (const run of edgeRuns(T.sf, type)) {
    if (!run.closed || run.pts.length < 6) continue;
    const pts = respace(run.pts, 0.007 * S, true);
    const nrms = pts.map(p => { const h = T.q.nearest(p, 0.03 * S); return h ? h.n : [1, 0, 0]; });
    const n = pts.length;
    const ctr = pts.reduce((a, p) => add(a, mul(p, 1 / n)), [0, 0, 0]);
    // "up" = away from the opening, along the garment
    const up = norm(sub(T.q.nearest(madd(ctr, [0, 1, 0], hgt), 0.1 * S)?.p || add(ctr, [0, 1, 0]), ctr));
    void up;
    sweep(mb, pts, i => ({ o: nrms[i], h: tr.on === 'sleeve' ? norm(sub(ctr, add(ctr, [0, -1, 0]))) : [0, 1, 0] }),
      () => [[-0.0005 * S, -0.001 * S], [th * 0.7, -0.002 * S], [th, hgt * 0.5], [th * 0.7, hgt], [0, hgt + 0.001 * S], [-0.0005 * S, hgt * 0.5]], { closedPath: true, post: p => liftOut(T, p, 0.0005 * S) });
  }
  part(T, 'turnUps', tr.material || 'main', mb);
};

/** Rolled neck edge (crew necks): a soft round binding. */
TRIMS.neckband = (T, tr) => {
  const S = T.S, F = T.F;
  const r = (tr.radius ?? 0.0035) * S;
  const mb = new MeshBuilder();
  for (const run of edgeRuns(T.sf, tr.edge || 'neck')) {
    const pts = respace(run.pts, 0.005 * S, run.closed);
    const nrms = pts.map(p => { const h = T.q.nearest(p, 0.03 * S); return h ? h.n : [0, 0, -1]; });
    const n = pts.length;
    sweep(mb, pts, i => {
      const t = norm(sub(pts[(i + 1) % n], pts[(i + n - 1) % n]));
      let up = norm(cross(t, nrms[i]));
      if (up[1] < 0 && (tr.edge || 'neck') === 'neck') up = mul(up, -1);
      return { o: nrms[i], h: up };
    }, () => { const ring = []; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; ring.push([Math.cos(a) * r * 0.9 - r * 0.25, Math.sin(a) * r - r * 0.4]); } return ring; }, { closedPath: run.closed, caps: !run.closed });
  }
  part(T, 'neckband', tr.material || 'rib', mb);
  void F;
};

/** Epaulettes / shoulder tabs (uniforms, trench coats). */
TRIMS.epaulettes = (T, tr) => {
  const S = T.S, F = T.F;
  const mb = new MeshBuilder(), hw = new MeshBuilder();
  for (const s of [-1, 1]) {
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      const x = s * (0.07 + 0.085 * k / 6) * S;
      const h = T.q.raycast([x, F.shoulderY + 0.3 * S, F.neckBase[2]], [0, -1, 0], 0.5 * S);
      if (h) pts.push(madd(h.p, h.n, 0.0015 * S));
    }
    if (pts.length < 3) continue;
    const nrms = pts.map(p => { const h = T.q.nearest(p, 0.03 * S); return h ? h.n : [0, 1, 0]; });
    const w = 0.022 * S, t = 0.002 * S;
    sweep(mb, pts, i => ({ o: nrms[i], h: [0, 0, 1] }), () => [[-t / 2, -w], [t / 2, -w], [t / 2, w], [-t / 2, w]], { caps: true });
    button(hw, madd(pts[0], nrms[0], t), nrms[0], 0.0045 * S);
  }
  part(T, 'epaulettes', tr.material || 'main', mb);
  part(T, 'epauletteButtons', 'hardware', hw);
};

export const TRIM_TYPES = Object.keys(TRIMS);
