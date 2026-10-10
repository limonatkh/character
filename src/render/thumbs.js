/* =====================================================================
 * THUMBNAILS — one shared off-screen WebGL renderer (browsers allow only a
 * handful of WebGL contexts, so the pickers never create their own).
 * Renders a compiled model framed on the part of the body a slot affects
 * (face for eyes, feet for shoes…) and returns a JPEG data URL.
 * A small time-budgeted queue keeps the UI responsive on slow phones.
 * ===================================================================== */
import * as THREE from 'three';
import { PX } from '../core/constants.js';
import { buildCharacterObject } from './mesh.js';

const SKY = '#BFD9EF';
const FOV = 28;

/** Which part of the body to frame for a slot (accessories: by attach point). */
export function frameGroup(slot, attachTo) {
  if (slot === 'accessory') {
    if (attachTo === 'face') return 'face';
    if (attachTo === 'head_top') return 'head';
    if (attachTo === 'neck' || attachTo === 'chest') return 'torso';
    if (attachTo === 'back') return 'back';
    if (attachTo === 'waist') return 'hips';
    return 'full';
  }
  return ({
    bodyType: 'full', base: 'full', headShape: 'head', hair: 'head', headwear: 'head',
    eyes: 'face', eyebrows: 'face', mouth: 'face', facialHair: 'jaw', faceDetail: 'face',
    top: 'torso', outerwear: 'torso', bottom: 'legs', shoes: 'feet',
  })[slot] || 'full';
}

/** Camera target / framed height (px) / view direction for a group. -Z is the front. */
function framing(group, model) {
  const m = model.measurements, H = m.head, T = m.torso, top = model.height;
  const tq = [0.55, 0.22, -0.8];
  switch (group) {
    case 'face': return { t: [0, H.y0 + H.h * 0.48, 0], size: H.h * 1.2, dir: [0.12, 0.03, -1] };
    case 'jaw': return { t: [0, H.y0 + H.h * 0.35, 0], size: H.h * 1.45, dir: [0.35, 0.02, -1] };
    case 'head': return { t: [0, (H.y0 + top) / 2, 0], size: (top - H.y0) * 1.18 + 1.2, dir: tq };
    case 'torso': return { t: [0, (T.y0 + T.y1) / 2 + 0.3, 0], size: (T.y1 - m.hipY) + 7.5, dir: tq };
    case 'back': return { t: [0, (T.y0 + T.y1) / 2 - 0.5, 0], size: (T.y1 - m.kneeY) + 6, dir: [0.6, 0.2, 0.78] };
    case 'hips': return { t: [0, m.hipY + 0.5, 0], size: 10, dir: tq };
    case 'legs': return { t: [0, m.hipY * 0.55, 0], size: m.hipY + 3.5, dir: tq };
    case 'feet': return { t: [0, m.foot.h * 0.9 + 0.6, -0.6], size: Math.max(m.foot.len * 2.1, m.kneeY) + 2.5, dir: [0.6, 0.38, -0.72] };
    default: return { t: [0, top / 2, 0], size: top * 1.08, dir: tq };
  }
}

export class ThumbRenderer {
  constructor(size = 112) {
    this.size = size;
    this.ok = true;
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(size, size, false);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    } catch { this.ok = false; return; }
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY);
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.02, 60);
  }

  /** Render a model and return a JPEG data URL ('' when WebGL is unavailable). */
  render(model, group, opts = {}) {
    if (!this.ok) return '';
    const rig = buildCharacterObject(model, { shading: 'flat' });
    this.scene.background = new THREE.Color(opts.background || SKY);
    this.scene.add(rig.root);
    const f = framing(group, model);
    const target = new THREE.Vector3(f.t[0] * PX, f.t[1] * PX, f.t[2] * PX);
    const dist = (f.size * PX / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    this.camera.position.copy(target).addScaledVector(new THREE.Vector3(...f.dir).normalize(), dist);
    this.camera.lookAt(target);
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/jpeg', opts.quality || 0.86);
    this.scene.remove(rig.root);
    rig.dispose();
    return url;
  }
}

/**
 * Time-budgeted job queue: jobs run a few at a time between frames.
 * job = { key, run: () => void }; a job with an already-queued key replaces it.
 */
export class ThumbQueue {
  constructor(budgetMs = 14) { this.budget = budgetMs; this.jobs = new Map(); this.scheduled = false; }
  add(key, run) { this.jobs.set(key, run); this.schedule(); }
  clear(prefix) { for (const k of [...this.jobs.keys()]) if (!prefix || k.startsWith(prefix)) this.jobs.delete(k); }
  schedule() {
    if (this.scheduled) return;
    this.scheduled = true;
    const go = () => {
      this.scheduled = false;
      const t0 = performance.now();
      for (const [k, run] of this.jobs) {
        this.jobs.delete(k);
        try { run(); } catch (e) { console.warn('thumbnail failed', k, e); }
        if (performance.now() - t0 > this.budget) break;
      }
      if (this.jobs.size) this.schedule();
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(go, 0)); else setTimeout(go, 0);
  }
}
