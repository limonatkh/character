/* =====================================================================
 * FACE TEXTURE PAINTER (browser): freckles, moles, skin blemishes, age
 * lines and scars painted into the head's cylindrical UV space from the
 * face landmarks, plus a matching normal map (pores, wrinkles, scars).
 * The colour map is in linear space with a mid-grey base (0.78) so marks
 * can both darken (freckles, lines) and lighten (scars) the skin; the skin
 * vertex colours are scaled to compensate.
 * ===================================================================== */
export const FACE_BASE = 0.78;
const cache = new Map();
const rnd = seed => { let a = seed >>> 0 || 7; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

/** UV of a 3D point with the head's cylindrical projection. */
export function headUVOf(p, fuv) {
  const ang = Math.atan2(-(p[0] - fuv.o[0]), -(p[2] - fuv.o[2]));
  return [0.5 + ang / (2 * Math.PI), (p[1] - fuv.o[1]) / fuv.vSpan];
}

/**
 * @param det { freckles, moles, wrinkles, blemishes, scars: [{ at, size, angle }], seed }
 * @param marks head marks, fuv head UV params
 * @returns { color: canvas, normal: canvas }
 */
export function paintFace(det, marks, fuv, size = 1024) {
  const key = JSON.stringify([det, size, marks.mouth, marks.noseTip, fuv]);
  if (cache.has(key)) return cache.get(key);
  const N = size;
  const mk = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }));
  const col = mk(N, N), g = col.getContext('2d');
  const base = Math.round(FACE_BASE * 255);
  g.fillStyle = `rgb(${base},${base},${base})`; g.fillRect(0, 0, N, N);
  const H = new Float32Array(N * N);                      // height field for the normal map
  const R = rnd(typeof det.seed === 'string' ? [...det.seed].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) : det.seed || 7);
  const px = p => { const [u, v] = headUVOf(p, fuv); return [u * N, (1 - v) * N]; };
  const S = marks.S;
  const mmPx = N / (2 * Math.PI * 0.09 * S) / 1000;        // pixels per millimetre (approx.)
  const dot = (x, y, r, c, a) => { g.globalAlpha = a; g.fillStyle = c; g.beginPath(); g.arc(x, y, Math.max(0.6, r), 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; };
  const groove = (pts, w, depth) => {
    // rasterise a polyline into the height field
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], L = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(L);
      for (let k = 0; k <= n; k++) {
        const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n;
        for (let dy = -w * 2; dy <= w * 2; dy++) for (let dx = -w * 2; dx <= w * 2; dx++) {
          const xi = Math.round(x + dx), yi = Math.round(y + dy); if (xi < 0 || yi < 0 || xi >= N || yi >= N) continue;
          const d = Math.hypot(dx, dy) / w; H[yi * N + xi] = Math.min(H[yi * N + xi], -depth * Math.exp(-d * d));
        }
      }
    }
  };
  const stroke = (pts, w, c, a) => { g.globalAlpha = a; g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); g.globalAlpha = 1; };
  const eyes = marks.eyes.slice().sort((a, b) => a.center[0] - b.center[0]);
  // ---- blemishes: soft redness and uneven tone
  const blem = det.blemishes ?? 0.1;
  for (let i = 0; i < 260 * blem; i++) {
    const p = [(R() - 0.5) * 0.11 * S, marks.mouth[1] + (R() - 0.2) * 0.12 * S, marks.noseTip[2] + 0.03 * S];
    const [x, y] = px(p);
    dot(x + (R() - 0.5) * 6, y, (0.8 + 2.5 * R()) * mmPx, R() < 0.5 ? 'rgb(214,150,140)' : 'rgb(170,140,130)', 0.08 + 0.12 * R());
  }
  // ---- freckles: nose bridge and cheeks
  const fr = det.freckles ?? 0;
  for (let i = 0; i < 420 * fr; i++) {
    const side = R() < 0.18 ? 0 : (R() < 0.5 ? -1 : 1);
    const e = eyes[side < 0 ? 0 : 1];
    const c = side === 0 ? [0, marks.noseBridge[1] - 0.01 * S, marks.noseTip[2]] : [e.center[0] + side * 0.004 * S, e.center[1] - 0.03 * S, e.center[2]];
    const p = [c[0] + (R() - 0.5) * (side === 0 ? 0.03 : 0.05) * S, c[1] + (R() - 0.5) * 0.035 * S, c[2]];
    const [x, y] = px(p);
    dot(x, y, (0.6 + 1.2 * R()) * mmPx, 'rgb(150,95,62)', 0.25 + 0.45 * R());
  }
  // ---- moles
  const nm = Math.round((det.moles ?? 0.15) * 8);
  for (let i = 0; i < nm; i++) {
    const p = [(R() - 0.5) * 0.12 * S, marks.chin[1] + R() * 0.13 * S, marks.noseTip[2]];
    const [x, y] = px(p);
    dot(x, y, (1.2 + 1.8 * R()) * mmPx, 'rgb(80,50,38)', 0.75);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xi = Math.round(x + dx), yi = Math.round(y + dy); if (xi >= 0 && yi >= 0 && xi < N && yi < N) H[yi * N + xi] = Math.max(H[yi * N + xi], 0.4 * Math.exp(-(dx * dx + dy * dy) / 2)); }
  }
  // ---- age lines: forehead, crow's feet, nasolabial folds, under-eye
  const wr = det.wrinkles ?? 0;
  if (wr > 0.02) {
    const fy = marks.browY + 0.02 * S;
    for (let k = 0; k < 4; k++) {
      const pts = [];
      for (let a = -1; a <= 1.0001; a += 0.1) pts.push(px([a * 0.045 * S, fy + k * 0.009 * S + Math.abs(a) * 0.004 * S - 0.003 * S * (1 - a * a), marks.forehead[2] + 0.004 * S]));
      stroke(pts, 1.1 * mmPx, 'rgb(120,85,70)', 0.18 * wr); groove(pts, 1.3, 0.8 * wr);
    }
    for (const e of eyes) {
      const s = Math.sign(e.center[0]);
      for (let k = -1; k <= 1; k++) {
        const a = [e.center[0] + s * e.radius * 1.15, e.center[1] + k * 0.002 * S, e.center[2] + 0.006 * S];
        const b = [a[0] + s * 0.012 * S, a[1] + k * 0.005 * S, a[2] + 0.01 * S];
        const pts = [px(a), px(b)];
        stroke(pts, 1 * mmPx, 'rgb(120,85,70)', 0.16 * wr); groove(pts, 1.1, 0.7 * wr);
      }
      const under = [];
      for (let a = -1; a <= 1.0001; a += 0.2) under.push(px([e.center[0] + a * e.radius * 0.9, e.center[1] - e.radius * 1.15 - (1 - a * a) * 0.002 * S, e.center[2] - 0.002 * S]));
      stroke(under, 1 * mmPx, 'rgb(120,85,75)', 0.14 * wr); groove(under, 1.1, 0.5 * wr);
      // nasolabial fold: from beside the nose wing to beside the mouth corner
      const nl = [];
      for (let t = 0; t <= 1.0001; t += 0.1) nl.push(px([s * (0.018 + 0.012 * t) * S, marks.noseTip[1] - 0.008 * S - t * (marks.noseTip[1] - marks.mouth[1] + 0.006 * S), marks.noseTip[2] + (0.025 + 0.01 * t) * S]));
      stroke(nl, 1.6 * mmPx, 'rgb(120,82,70)', 0.22 * wr); groove(nl, 2, 1.1 * wr);
    }
  }
  // ---- scars: lighter, slightly raised lines
  const SPOT = {
    cheekLeft: [-1, 'cheek'], cheekRight: [1, 'cheek'], browLeft: [-1, 'brow'], browRight: [1, 'brow'], chin: [0, 'chin'], forehead: [0, 'forehead'], nose: [0, 'nose'], lip: [0, 'lip'],
  };
  for (const sc of det.scars || []) {
    const [s, where] = SPOT[sc.at] || SPOT.cheekLeft;
    const e = eyes[s < 0 ? 0 : 1];
    let c;
    if (where === 'cheek') c = [e.center[0] + s * 0.012 * S, e.center[1] - 0.035 * S, e.center[2] + 0.002 * S];
    else if (where === 'brow') c = [e.center[0] + s * 0.004 * S, marks.browY, e.center[2] - 0.012 * S];
    else if (where === 'chin') c = [0.008 * S, marks.chin[1] + 0.008 * S, marks.chin[2]];
    else if (where === 'forehead') c = [0.015 * S, marks.browY + 0.035 * S, marks.forehead[2]];
    else if (where === 'nose') c = [0, marks.noseBridge[1] - 0.01 * S, marks.noseTip[2] + 0.006 * S];
    else c = [0.01 * S, marks.mouth[1] + 0.006 * S, marks.mouth[2]];
    const L = (0.008 + 0.025 * sc.size) * S, a = (sc.angle || 0) * Math.PI / 180;
    const pts = [];
    for (let t = -0.5; t <= 0.5001; t += 0.1) pts.push(px([c[0] + Math.cos(a) * L * t, c[1] + Math.sin(a) * L * t + 0.001 * S * Math.sin(t * 9), c[2]]));
    stroke(pts, 2.2 * mmPx, 'rgb(255,226,214)', 0.7); stroke(pts, 0.8 * mmPx, 'rgb(205,140,130)', 0.35);
    for (const [x, y] of pts) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const xi = Math.round(x + dx), yi = Math.round(y + dy); if (xi >= 0 && yi >= 0 && xi < N && yi < N) H[yi * N + xi] = Math.max(H[yi * N + xi], 0.6 * Math.exp(-(dx * dx + dy * dy) / 3)); }
  }
  // ---- pores (fine noise) + normal map
  for (let i = 0; i < N * N * 0.04; i++) { const k = (R() * N * N) | 0; H[k] -= 0.25 * R(); }
  const nrm = mk(N, N), ng = nrm.getContext('2d'), img = ng.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const xl = (x + N - 1) % N, xr = (x + 1) % N, yu = Math.max(0, y - 1), yd = Math.min(N - 1, y + 1);
    const dx = (H[y * N + xr] - H[y * N + xl]) * 1.2, dy = (H[yd * N + x] - H[yu * N + x]) * 1.2, l = Math.hypot(dx, dy, 1), i = (y * N + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  ng.putImageData(img, 0, 0);
  const res = { color: col, normal: nrm };
  cache.set(key, res);
  return res;
}
