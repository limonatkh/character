/* =====================================================================
 * PROCEDURAL TEXTURES (browser): fabric weaves (normal + roughness),
 * patterns (stripes, checks, plaid, houndstooth, herringbone, polka, camo,
 * floral, geometric, shemagh), skin detail, hair strips, iris.
 * Every texture is a canvas tiled in METRES (garment UVs are metric), so
 * the same denim twill has the same thread size on every garment.
 * Results are cached by their parameters.
 * ===================================================================== */
const cache = new Map();
const rnd = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const canvas = (w, h) => { const c = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }); return c; };

/* ------------------------------------------------------------------ weaves: height fields */
function weaveHeight(type, N, R) {
  const H = new Float32Array(N * N);
  const set = (fn) => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) H[y * N + x] = fn(x / N, y / N, x, y); };
  const noise = () => R() * 2 - 1;
  const s = Math.sin, PI2 = Math.PI * 2;
  switch (type) {
    case 'jersey': set((u, v) => { const k = 16; const cu = (u * k) % 1, cv = (v * k * 1.3) % 1; return Math.max(0, 1 - Math.abs(cu - 0.5 + (cv - 0.5) * 0.6) * 3) * 0.6 + Math.max(0, 1 - Math.abs(cu - 0.5 - (cv - 0.5) * 0.6) * 3) * 0.6; }); break;
    case 'rib': set(u => 0.5 + 0.5 * s(u * PI2 * 8)); break;
    case 'twill': set((u, v) => 0.5 + 0.5 * s((u * 24 + v * 24) * Math.PI) * (0.8 + 0.2 * s(v * PI2 * 48))); break;
    case 'plain': case 'crepe': set((u, v) => 0.5 + 0.25 * s(u * PI2 * 24) * s(v * PI2 * 24) + (type === 'crepe' ? 0.25 * noise() : 0)); break;
    case 'basket': set((u, v) => { const a = Math.floor(u * 16) % 2, b = Math.floor(v * 16) % 2; return a === b ? 0.5 + 0.4 * s((u * 32) * Math.PI) : 0.5 + 0.4 * s((v * 32) * Math.PI); }); break;
    case 'knit': set((u, v) => { const k = 8; const cu = (u * k) % 1, cv = (v * k * 1.4) % 1; const vv = Math.abs(cu - 0.5) * 2; return Math.max(0, 1 - Math.abs(cv - vv * 0.6 - 0.2) * 2.2); }); break;
    case 'cable': set((u, v) => { const lane = (u * 4) % 1; const tw = s(v * PI2 * 2 + (lane < 0.5 ? 0 : Math.PI)); return 0.4 + 0.6 * Math.max(0, 1 - Math.abs(lane - 0.5 - 0.18 * tw) * 4) + 0.15 * Math.max(0, s(u * PI2 * 4 * 6)); }); break;
    case 'fleece': case 'felt': case 'pile': { for (let i = 0; i < H.length; i++) H[i] = 0.5 + 0.5 * noise(); blur(H, N, type === 'felt' ? 2 : 1); break; }
    case 'tweed': { for (let i = 0; i < H.length; i++) H[i] = 0.5 + 0.5 * noise(); blur(H, N, 1); const t2 = new Float32Array(H.length); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) t2[y * N + x] = H[y * N + x] * 0.6 + 0.4 * (0.5 + 0.5 * s(((x + y) / N) * PI2 * 10)); H.set(t2); break; }
    case 'satin': set((u, v) => 0.5 + 0.1 * s(u * PI2 * 64)); break;
    case 'cord': set(u => Math.pow(Math.abs(s(u * Math.PI * 6)), 0.6)); break;
    case 'grain': { for (let i = 0; i < 260; i++) { const cx = R() * N, cy = R() * N, r = 2 + R() * 6; for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const d = Math.hypot(x, y) / r; if (d < 1) { const ix = ((Math.round(cx + x) % N) + N) % N, iy = ((Math.round(cy + y) % N) + N) % N; H[iy * N + ix] += (1 - d) * 0.5; } } } blur(H, N, 1); break; }
    case 'ripstop': set((u, v) => 0.4 + 0.4 * (Math.abs(s(u * Math.PI * 8)) < 0.08 || Math.abs(s(v * Math.PI * 8)) < 0.08 ? 1 : 0) + 0.2 * s(u * PI2 * 48) * s(v * PI2 * 48)); break;
    case 'mesh': set((u, v) => { const cu = (u * 12) % 1 - 0.5, cv = (v * 12) % 1 - 0.5; return Math.min(1, Math.hypot(cu, cv) * 3); }); break;
    case 'slub': { set((u, v) => 0.5 + 0.25 * s(u * PI2 * 24) * s(v * PI2 * 24)); for (let k = 0; k < 40; k++) { const y = Math.floor(R() * N), x0 = Math.floor(R() * N), L = 10 + R() * 60; for (let x = 0; x < L; x++) H[y * N + ((x0 + x) % N)] += 0.6; } blur(H, N, 1); break; }
    default: set(() => 0.5);
  }
  return H;
}
function blur(H, N, passes) {
  const T = new Float32Array(H.length);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let s = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += H[((y + dy + N) % N) * N + ((x + dx + N) % N)];
      T[y * N + x] = s / 9;
    }
    H.set(T);
  }
}
/** Normal map (tangent space) canvas from a weave, tiled. */
export function weaveNormal(type, size = 256, strength = 2.2) {
  const key = `wn:${type}:${size}:${strength}`;
  if (cache.has(key)) return cache.get(key);
  const N = size, H = weaveHeight(type, N, rnd(17 + type.length));
  const c = canvas(N, N), g = c.getContext('2d'), img = g.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (H[y * N + (x + 1) % N] - H[y * N + (x + N - 1) % N]) * strength;
    const dy = (H[((y + 1) % N) * N + x] - H[((y + N - 1) % N) * N + x]) * strength;
    const l = Math.hypot(dx, dy, 1);
    const i = (y * N + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  cache.set(key, c);
  return c;
}
/** Physical size (m) covered by one weave tile. */
export const WEAVE_TILE = { jersey: 16, rib: 8, twill: 24, plain: 24, crepe: 24, basket: 16, knit: 8, cable: 4, fleece: 30, felt: 30, pile: 30, tweed: 20, satin: 64, cord: 6, grain: 3, ripstop: 8, mesh: 12, slub: 24 };

/* ------------------------------------------------------------------ patterns */
/**
 * Colour map for a pattern. Returns { canvas, metres } (tile size in metres) or null for solid.
 * colors: { main, secondary, accent }, scale: user pattern scale, wear 0..1
 */
export function patternMap(pattern, colors, scale = 1, wear = 0, size = 512) {
  if ((!pattern || pattern === 'solid') && wear <= 0.01) return null;
  const key = `pt:${pattern}:${colors.main}:${colors.secondary}:${colors.accent}:${scale}:${wear}:${size}`;
  if (cache.has(key)) return cache.get(key);
  const N = size, c = canvas(N, N), g = c.getContext('2d');
  const A = colors.main, B = colors.secondary || '#FFFFFF', Cc = colors.accent || B;
  const R = rnd(91);
  let metres = 0.1 * scale;
  g.fillStyle = A; g.fillRect(0, 0, N, N);
  const stripe = (vertical, w, period, col) => { g.fillStyle = col; for (let p = 0; p < N; p += period) vertical ? g.fillRect(p, 0, w, N) : g.fillRect(0, p, N, w); };
  switch (pattern) {
    case 'stripes': metres = 0.08 * scale; stripe(false, N / 4, N / 2, B); break;
    case 'verticalStripes': metres = 0.08 * scale; stripe(true, N / 4, N / 2, B); break;
    case 'pinstripe': metres = 0.06 * scale; stripe(true, Math.max(2, N / 96), N / 4, B); break;
    case 'checks': metres = 0.06 * scale; g.fillStyle = B; for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) if ((x + y) % 2) g.fillRect(x * N / 2, y * N / 2, N / 2, N / 2); break;
    case 'gingham': metres = 0.03 * scale; g.globalAlpha = 0.5; g.fillStyle = B; g.fillRect(0, 0, N / 2, N); g.fillRect(0, 0, N, N / 2); g.globalAlpha = 1; g.fillStyle = B; g.fillRect(0, 0, N / 2, N / 2); break;
    case 'plaid': metres = 0.16 * scale; {
      g.globalAlpha = 0.55; g.fillStyle = B; g.fillRect(N * 0.1, 0, N * 0.3, N); g.fillRect(0, N * 0.1, N, N * 0.3);
      g.globalAlpha = 0.8; g.fillStyle = Cc; g.fillRect(N * 0.62, 0, N * 0.04, N); g.fillRect(0, N * 0.62, N, N * 0.04);
      g.globalAlpha = 0.35; g.fillStyle = '#000'; g.fillRect(N * 0.78, 0, N * 0.12, N); g.fillRect(0, N * 0.78, N, N * 0.12); g.globalAlpha = 1; break; }
    case 'houndstooth': metres = 0.025 * scale; {
      g.fillStyle = B; const u = N / 4;
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        const ox = x * u, oy = y * u;
        if ((x + y) % 2 === 0) { g.fillRect(ox, oy, u / 2, u / 2); g.beginPath(); g.moveTo(ox + u / 2, oy); g.lineTo(ox + u, oy + u / 2); g.lineTo(ox + u, oy); g.fill(); g.beginPath(); g.moveTo(ox, oy + u / 2); g.lineTo(ox + u / 2, oy + u); g.lineTo(ox, oy + u); g.fill(); }
      } break; }
    case 'herringbone': metres = 0.04 * scale; { g.strokeStyle = B; g.lineWidth = N / 40; for (let col = 0; col < 8; col++) for (let k = -8; k < 16; k++) { const x0 = col * N / 8; g.beginPath(); const dir = col % 2 ? 1 : -1; g.moveTo(x0, k * N / 8); g.lineTo(x0 + N / 8, k * N / 8 + dir * N / 8); g.stroke(); } break; }
    case 'polka': metres = 0.05 * scale; g.fillStyle = B; for (const [x, y] of [[0.25, 0.25], [0.75, 0.75]]) { g.beginPath(); g.arc(x * N, y * N, N * 0.09, 0, Math.PI * 2); g.fill(); } break;
    case 'camo': metres = 0.35 * scale; for (const col of [B, Cc, '#2B2B22']) { g.fillStyle = col; for (let i = 0; i < 9; i++) blob(g, R() * N, R() * N, N * (0.07 + R() * 0.1), R, N); } break;
    case 'floral': metres = 0.12 * scale; for (let i = 0; i < 7; i++) { const x = R() * N, y = R() * N, r = N * (0.04 + R() * 0.04); g.fillStyle = i % 2 ? B : Cc; for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; wrapCircle(g, x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.7, N); } g.fillStyle = '#F2D16B'; wrapCircle(g, x, y, r * 0.45, N); g.fillStyle = '#4C7A43'; wrapCircle(g, x + r * 1.6, y + r * 0.8, r * 0.45, N); } break;
    case 'geometric': metres = 0.1 * scale; { const u = N / 4; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 3 === 0 ? B : (x + y) % 3 === 1 ? Cc : A; g.beginPath(); g.moveTo(x * u + u / 2, y * u); g.lineTo(x * u + u, y * u + u / 2); g.lineTo(x * u + u / 2, y * u + u); g.lineTo(x * u, y * u + u / 2); g.fill(); } break; }
    case 'shemagh': metres = 0.07 * scale; {
      // the classic keffiyeh: dense small houndstooth-like net with a border feel
      g.fillStyle = B; const u = N / 8;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const ox = x * u, oy = y * u; g.fillRect(ox + u * 0.15, oy + u * 0.15, u * 0.3, u * 0.3); g.fillRect(ox + u * 0.55, oy + u * 0.55, u * 0.3, u * 0.3); g.fillRect(ox + u * 0.45, oy + u * 0.05, u * 0.1, u * 0.9); }
      break; }
    case 'colorBlock': default: break;
  }
  // wear / fading: lighter mottled noise (denim fades, washed cotton)
  if (wear > 0.01) {
    const img = g.getImageData(0, 0, N, N), d = img.data;
    const field = new Float32Array(64 * 64); for (let i = 0; i < field.length; i++) field[i] = R(); blur(field, 64, 2);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const f = field[((y * 64 / N) | 0) * 64 + ((x * 64 / N) | 0)];
      const k = wear * (0.25 + 0.75 * f) * 0.55;
      const i = (y * N + x) * 4;
      d[i] += (235 - d[i]) * k; d[i + 1] += (238 - d[i + 1]) * k; d[i + 2] += (240 - d[i + 2]) * k;
    }
    g.putImageData(img, 0, 0);
  }
  const res = { canvas: c, metres };
  cache.set(key, res);
  return res;
}
function blob(g, x, y, r, R, N) { g.beginPath(); for (let k = 0; k <= 12; k++) { const a = k / 12 * Math.PI * 2, rr = r * (0.6 + 0.6 * R()); const px = x + Math.cos(a) * rr * 1.6, py = y + Math.sin(a) * rr; k ? g.lineTo(px, py) : g.moveTo(px, py); } g.fill(); for (const [dx, dy] of [[N, 0], [-N, 0], [0, N], [0, -N]]) { g.save(); g.translate(dx, dy); g.fill(); g.restore(); } }
function wrapCircle(g, x, y, r, N) { for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) { g.beginPath(); g.arc(x + dx, y + dy, r, 0, Math.PI * 2); g.fill(); } }

/* ------------------------------------------------------------------ hair, iris, skin */
export function hairStrip(kind = 'cards') {
  const key = 'hair:' + kind;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(128, 256), g = c.getContext('2d'), R = rnd(5);
  g.clearRect(0, 0, 128, 256);
  for (let i = 0; i < 300; i++) {
    const x = R() * 128, w = 0.8 + R() * 1.8, a = 0.5 + R() * 0.5, top = R() * 16;
    const edge = Math.abs(x - 64) / 64; if (R() < edge * edge) continue;
    const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, `rgba(255,255,255,${a})`); grd.addColorStop(0.75, `rgba(255,255,255,${a * 0.9})`); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(x, top, w, 256 - top - R() * 50);
  }
  cache.set(key, c);
  return c;
}
/**
 * Strand texture for the sculpted hair mass, tiled in metres along the hair flow (v) and across it (u).
 * kind: straight | short | curly | buzz. Returns { color, normal, tile: [u metres, v metres] }:
 * colour = brightness streaks (multiplies the root → tip vertex colours), normal = strand grooves.
 */
export const HAIR_TILE = { straight: [0.03, 0.12], short: [0.03, 0.05], curly: [0.04, 0.04], buzz: [0.02, 0.02] };
export function hairMass(kind = 'straight') {
  const key = 'hm:' + kind;
  if (cache.has(key)) return cache.get(key);
  const W = 256, Hh = kind === 'straight' ? 1024 : 256, R = rnd(41 + kind.length);
  const Hf = new Float32Array(W * Hh), B = new Float32Array(W * Hh).fill(1);
  const wrapX = x => ((x % W) + W) % W, wrapY = y => ((y % Hh) + Hh) % Hh;
  if (kind === 'buzz') {
    // stubble: tiny dark dots with a fine directional grain
    for (let i = 0; i < 2600; i++) { const x = Math.floor(R() * W), y = Math.floor(R() * Hh); Hf[y * W + x] += 1; B[y * W + x] *= 0.72; B[wrapY(y + 1) * W + x] *= 0.85; }
  } else {
    // strands: many thin lines along v with slow lateral drift; grouped into clumps of a few millimetres
    const nStr = kind === 'curly' ? 520 : 900;
    for (let k = 0; k < nStr; k++) {
      let x = R() * W;
      const y0 = R() * Hh, L = kind === 'short' ? Hh * (0.3 + 0.5 * R()) : kind === 'curly' ? Hh * (0.5 + 0.5 * R()) : Hh * (0.6 + 0.5 * R());
      const bright = 0.75 + 0.5 * R(), depth = 0.4 + 0.6 * R(), phase = R() * 6.28, amp = kind === 'curly' ? 6 + 6 * R() : 1.5 * R();
      for (let t = 0; t < L; t++) {
        const y = wrapY(Math.floor(y0 + t));
        const xx = x + amp * Math.sin(phase + t / (kind === 'curly' ? 9 : 90));
        const xi = wrapX(Math.floor(xx));
        const fade = Math.min(1, t / 20, (L - t) / 20);
        Hf[y * W + xi] += depth * fade; B[y * W + xi] = B[y * W + xi] * 0.6 + bright * 0.4 * fade + B[y * W + xi] * 0.4 * (1 - fade);
        x += (R() - 0.5) * 0.08;
      }
    }
    // clump grooves: broad darker gaps every few millimetres
    const nG = kind === 'curly' ? 10 : 14;
    for (let gI = 0; gI < nG; gI++) {
      const gx = (gI + R() * 0.6) / nG * W, ph = R() * 6.28;
      for (let y = 0; y < Hh; y++) {
        const cx = gx + 3 * Math.sin(ph + y / 70);
        for (let dx = -4; dx <= 4; dx++) { const xi = wrapX(Math.floor(cx + dx)), f = 1 - Math.abs(dx) / 5; Hf[y * W + xi] -= 0.9 * f; B[y * W + xi] *= 1 - 0.28 * f; }
      }
    }
  }
  // blur along v a little (strands are continuous), across u very little
  const T = new Float32Array(Hf.length);
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) T[y * W + x] = (Hf[wrapY(y - 1) * W + x] + 2 * Hf[y * W + x] + Hf[wrapY(y + 1) * W + x]) / 4;
  const color = canvas(W, Hh), cg = color.getContext('2d'), ci = cg.createImageData(W, Hh);
  const normal = canvas(W, Hh), ng = normal.getContext('2d'), ni = ng.createImageData(W, Hh);
  const strength = kind === 'buzz' ? 1.2 : 0.9;
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, o = i * 4;
    const b = Math.max(0.35, Math.min(1.25, B[i])) / 1.25;
    const v = Math.round(255 * b);
    ci.data[o] = v; ci.data[o + 1] = v; ci.data[o + 2] = v; ci.data[o + 3] = 255;
    const dx = (T[y * W + wrapX(x + 1)] - T[y * W + wrapX(x - 1)]) * strength;
    const dy = (T[wrapY(y + 1) * W + x] - T[wrapY(y - 1) * W + x]) * strength * 0.3;
    const l = Math.hypot(dx, dy, 1);
    ni.data[o] = (-dx / l * 0.5 + 0.5) * 255; ni.data[o + 1] = (dy / l * 0.5 + 0.5) * 255; ni.data[o + 2] = (1 / l * 0.5 + 0.5) * 255; ni.data[o + 3] = 255;
  }
  cg.putImageData(ci, 0, 0); ng.putImageData(ni, 0, 0);
  const out = { color, normal, tile: HAIR_TILE[kind] || HAIR_TILE.straight };
  cache.set(key, out);
  return out;
}
/** Iris texture (polar: u around, v from the centre outward) — matches the eyeball UVs. */
export function irisMap(iris, sclera, pupil = 1) {
  const key = `iris:${iris}:${sclera}:${pupil}`;
  if (cache.has(key)) return cache.get(key);
  const W = 512, Hh = 256, c = canvas(W, Hh), g = c.getContext('2d'), R = rnd(3);
  g.fillStyle = sclera; g.fillRect(0, 0, W, Hh);
  // v: 0 at the back of the eye … 1 at the front (pupil). The iris occupies the last ~22%
  const irisTop = Hh * (1 - 0.2), pupilTop = Hh * (1 - 0.075 * pupil);
  const grd = g.createLinearGradient(0, irisTop, 0, Hh); grd.addColorStop(0, shadeHex(iris, 0.55)); grd.addColorStop(0.35, iris); grd.addColorStop(1, shadeHex(iris, 1.25));
  g.fillStyle = grd; g.fillRect(0, irisTop, W, Hh - irisTop);
  for (let i = 0; i < 380; i++) { const x = R() * W; g.strokeStyle = R() < 0.5 ? shadeHex(iris, 0.7) : shadeHex(iris, 1.35); g.globalAlpha = 0.35; g.lineWidth = 1 + R() * 2; g.beginPath(); g.moveTo(x, irisTop + R() * 6); g.lineTo(x + (R() - 0.5) * 6, pupilTop); g.stroke(); }
  g.globalAlpha = 1;
  g.fillStyle = shadeHex(iris, 0.35); g.fillRect(0, irisTop, W, 4);         // limbal ring
  g.fillStyle = '#0B0B0B'; g.fillRect(0, pupilTop, W, Hh - pupilTop);
  // faint scleral veins and a warm edge
  g.globalAlpha = 0.12; g.strokeStyle = '#B04A4A'; for (let i = 0; i < 30; i++) { g.beginPath(); const x = R() * W; g.moveTo(x, R() * irisTop * 0.6); g.lineTo(x + (R() - 0.5) * 40, irisTop * (0.6 + R() * 0.35)); g.stroke(); }
  g.globalAlpha = 1;
  cache.set(key, c);
  return c;
}
export function shadeHex(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const ch = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * k)));
  return '#' + [16, 8, 0].map(s => ch(s).toString(16).padStart(2, '0')).join('');
}
/** Fine skin detail (pores) as a tiling normal map. */
export function skinDetailNormal() {
  const key = 'skinN';
  if (cache.has(key)) return cache.get(key);
  const N = 256, H = new Float32Array(N * N), R = rnd(11);
  for (let i = 0; i < H.length; i++) H[i] = R();
  blur(H, N, 1);
  for (let i = 0; i < 2500; i++) { const x = (R() * N) | 0, y = (R() * N) | 0; H[y * N + x] -= 0.8; }
  blur(H, N, 1);
  const c = canvas(N, N), g = c.getContext('2d'), img = g.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (H[y * N + (x + 1) % N] - H[y * N + (x + N - 1) % N]) * 1.6, dy = (H[((y + 1) % N) * N + x] - H[((y + N - 1) % N) * N + x]) * 1.6, l = Math.hypot(dx, dy, 1), i = (y * N + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  cache.set(key, c);
  return c;
}
export function clearTextureCache() { cache.clear(); }
