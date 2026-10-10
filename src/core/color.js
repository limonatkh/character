/* Colour helpers (pure). Colours are always stored as '#RRGGBB' upper-case. */

const HEX6 = /^#[0-9a-fA-F]{6}$/;
const HEX3 = /^#[0-9a-fA-F]{3}$/;

/** Returns { value, expanded } or null when the string is not a hex colour. */
export function parseHex(str) {
  if (typeof str !== 'string') return null;
  const s = str.trim();
  if (HEX6.test(s)) return { value: s.toUpperCase(), expanded: false };
  if (HEX3.test(s)) return { value: ('#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toUpperCase(), expanded: true };
  return null;
}

export function isHex(str) { return typeof str === 'string' && HEX6.test(str); }

export function hexToInt(hex) { return parseInt(hex.slice(1), 16); }
export function intToHex(n) { return '#' + (n >>> 0).toString(16).padStart(6, '0').toUpperCase(); }

export function hexToRgb(hex) {
  const n = hexToInt(hex);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex(r, g, b) {
  const c = v => Math.max(0, Math.min(255, Math.round(v)));
  return intToHex((c(r) << 16) | (c(g) << 8) | c(b));
}

/** Multiply brightness (f < 1 darker, f > 1 lighter). */
export function shadeHex(hex, f) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * f, g * f, b * f);
}

/** Mix two colours, t = 0 → a, 1 → b. */
export function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

/** Relative luminance 0..1 (sRGB approximation, good enough for contrast picks). */
export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** A shade colour that stays visible on very dark colours (lightens instead of darkening). */
export function shadeFor(hex, f = 0.78) {
  return luminance(hex) < 0.12 ? mixHex(hex, '#FFFFFF', 0.18) : shadeHex(hex, f);
}
/** A line/detail colour with clear contrast against the base colour. */
export function darkFor(hex) {
  return luminance(hex) < 0.16 ? mixHex(hex, '#FFFFFF', 0.32) : shadeHex(hex, 0.55);
}
