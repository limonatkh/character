/* =====================================================================
 * NORMAL 3D BUILD WORKER — runs the character pipeline off the main
 * thread. Keeps its own stage cache between builds, and only sends the
 * geometry the page has not received yet (unchanged meshes are sent as
 * references), so editing one garment transfers only that garment.
 * ===================================================================== */
import '../assets/index.js';
import { buildCharacter } from './character.js';

const cache = new Map();
const ids = new WeakMap();
let nextId = 1, sent = new Set();
const keyOf = g => { let k = ids.get(g); if (!k) { k = 'g' + (nextId++); ids.set(g, k); } return k; };

self.onmessage = e => {
  const { id, doc, detail, reset } = e.data || {};
  if (reset) { sent = new Set(); if (!doc) return; }
  try {
    const res = buildCharacter(doc, { cache, detail, onProgress: (stage, f) => self.postMessage({ id, progress: { stage, f } }) });
    const meshes = res.meshes.map(m => {
      const gkey = keyOf(m.geometry);
      if (sent.has(gkey)) return { ...m, geometry: null, gkey };
      sent.add(gkey);
      return { ...m, gkey };
    });
    if (sent.size > 4000) sent = new Set(meshes.map(m => m.gkey));
    self.postMessage({ id, result: { ...res, meshes } });
  } catch (err) {
    self.postMessage({ id, error: String((err && err.stack) || err) });
  }
};
