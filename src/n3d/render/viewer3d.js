/* =====================================================================
 * NORMAL 3D VIEWER — studio viewport for the Normal 3D mode.
 *   orbit / pan / zoom, view presets (front, side, back, ¾, face, hands,
 *   feet), lighting presets (studio, daylight, warm indoor, dramatic rim, flat;
 *   image-based room light + key / rim lights + soft contact shadow), inspection modes (materials, clay, wireframe /
 *   topology, normals, UV checker, material slots), pose previews on the
 *   real skeleton, side-by-side comparison with a saved character, and
 *   thumbnails.
 * ===================================================================== */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildScene } from './scene.js';
import { applyPose } from './skeleton3.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const VIEWS = {
  front: { dir: [0, 0.05, -1], fit: 'full' }, side: { dir: [1, 0.05, 0], fit: 'full' }, back: { dir: [0, 0.08, 1], fit: 'full' },
  threeQuarter: { dir: [0.75, 0.18, -0.85], fit: 'full' }, face: { dir: [0.25, 0.05, -1], fit: 'face' },
  hands: { dir: [0.5, 0.45, -0.75], fit: 'hand' }, feet: { dir: [0.45, 0.4, -1], fit: 'feet' }, upper: { dir: [0.4, 0.1, -1], fit: 'upper' },
};
export const VIEW_IDS = Object.keys(VIEWS);
export const INSPECT_MODES = ['pbr', 'clay', 'wire', 'normals', 'uv', 'materials'];
export const POSES = ['rest', 'relaxed', 'idle', 'walk', 'wave', 'tpose'];
/** Lighting presets: key light, rim light, sky / ground fill, exposure (light counts never change, so no shader recompiles). */
const LIGHTS = {
  studio: { key: [1.5, '#ffffff', [-1.6, 3.2, -2.4]], rim: [0.9, '#cfe0ff', [2.2, 2.4, 2.2]], hemi: [0.25, '#ffffff', '#3a4252'], exposure: 1.0 },
  daylight: { key: [2.4, '#fff1dc', [-2.0, 4.0, -1.2]], rim: [0.4, '#bcd4ff', [2.0, 2.0, 2.4]], hemi: [0.65, '#bcd8ff', '#6b5a45'], exposure: 0.95 },
  indoor: { key: [1.1, '#ffd2a1', [-1.2, 2.6, -1.8]], rim: [0.35, '#ffe2c0', [1.8, 2.2, 2.0]], hemi: [0.35, '#ffe8cc', '#40342a'], exposure: 1.05 },
  dramatic: { key: [0.9, '#ffffff', [-2.6, 2.0, -0.4]], rim: [2.4, '#9ec4ff', [1.6, 2.6, 2.6]], hemi: [0.04, '#ffffff', '#202430'], exposure: 0.9 },
  flat: { key: [0, '#ffffff', [-1.6, 3.2, -2.4]], rim: [0, '#ffffff', [2.2, 2.4, 2.2]], hemi: [1.1, '#ffffff', '#d8d8d8'], exposure: 1.1 },
};
export const LIGHT_IDS = Object.keys(LIGHTS);

export class N3DViewer {
  constructor(container) {
    this.container = container;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(r.domElement);
    r.domElement.setAttribute('aria-label', '3D character preview');
    r.domElement.style.touchAction = 'none';

    const scene = this.scene = new THREE.Scene();
    scene.background = gradientTexture();
    const pmrem = new THREE.PMREMGenerator(r);
    scene.environment = pmrem.fromScene(new RoomEnvironment(r), 0.04).texture;
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(-1.6, 3.2, -2.4); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -1.2; key.shadow.camera.right = 1.2; key.shadow.camera.top = 2.4; key.shadow.camera.bottom = -0.4; key.shadow.radius = 4; key.shadow.bias = -0.0005;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xcfe0ff, 0.9); rim.position.set(2.2, 2.4, 2.2); scene.add(rim);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x3a4252, 0.25); scene.add(hemi);
    this.lights = { key, rim, hemi }; this.lighting = 'studio';
    const ground = new THREE.Mesh(new THREE.CircleGeometry(2.2, 64), new THREE.ShadowMaterial({ opacity: 0.28 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.75, 64), new THREE.MeshStandardMaterial({ color: '#2a3140', roughness: 0.9, transparent: true, opacity: 0.55 }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = -0.001; scene.add(disc);

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.02, 60);
    const c = this.controls = new OrbitControls(this.camera, r.domElement);
    c.enableDamping = true; c.dampingFactor = 0.1; c.minDistance = 0.25; c.maxDistance = 9; c.screenSpacePanning = true; c.maxPolarAngle = Math.PI * 0.95;
    this.mode = 'pbr'; this.pose = 'relaxed'; this.autoRotate = false;
    this.group = null; this.compare = null; this.res = null; this.geoCache = new Map(); this.cmpCache = new Map();
    this.clock = new THREE.Clock(); this.time = 0; this.anim = null;
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(container);
    this.resize();
    this.setView('threeQuarter', true);
    this.running = true;
    r.setAnimationLoop(() => this.tick());
  }

  /** Lighting preset (studio, daylight, indoor, dramatic, flat). */
  setLighting(id) {
    const L = LIGHTS[id] || LIGHTS.studio, { key, rim, hemi } = this.lights;
    this.lighting = LIGHTS[id] ? id : 'studio';
    for (const [light, [i, col, pos]] of [[key, L.key], [rim, L.rim]]) { light.intensity = i; light.color.set(col); light.position.set(...pos); }
    hemi.intensity = L.hemi[0]; hemi.color.set(L.hemi[1]); hemi.groundColor.set(L.hemi[2]);
    this.renderer.toneMappingExposure = L.exposure;
  }

  pause() { this.running = false; this.renderer.setAnimationLoop(null); }
  resume() { if (this.running) return; this.running = true; this.clock.getDelta(); this.renderer.setAnimationLoop(() => this.tick()); }

  resize() {
    const w = this.container.clientWidth || 300, h = this.container.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  /** Show a build result. */
  setCharacter(res) {
    this.res = res;
    this.rebuild();
  }
  rebuild() {
    if (!this.res) return;
    const old = this.group;
    this.group = buildScene(this.res, { mode: this.mode, skinned: true, geoCache: this.geoCache });
    this.scene.add(this.group);
    if (old) this.scene.remove(old);
    if (this.compare) this.placeCompare();
    this.height = this.res.rig.H + (this.res.groundOffset || 0);
    this.marks = this.res.marks;
    this.joints = this.res.rig.joints;
    if (!this.framed) { this.framed = true; this.setView(this.view || 'threeQuarter', true); }
  }
  setMode(m) { this.mode = m; this.rebuild(); if (this.compareRes) this.setCompare(this.compareRes); }
  setPose(p) { this.pose = p; }
  setAutoRotate(on) { this.autoRotate = on; }

  /** Show another character beside the current one (null to hide). */
  setCompare(res) {
    if (this.compare) { this.scene.remove(this.compare); this.compare = null; }
    this.compareRes = res;
    if (!res) { this.setView(this.view, false); return; }
    this.compare = buildScene(res, { mode: this.mode, skinned: true, geoCache: this.cmpCache });
    this.scene.add(this.compare);
    this.placeCompare();
    this.setView('front', false, 2.1);
  }
  placeCompare() {
    if (!this.compare || !this.group) return;
    this.group.position.x = -0.45; this.compare.position.x = 0.45;
  }

  setView(name, instant, widen = 1) {
    this.view = name;
    const v = VIEWS[name] || VIEWS.threeQuarter;
    const H = this.height || 1.75, J = this.joints, go = this.res?.groundOffset || 0;
    let target = new THREE.Vector3(0, H * 0.5, 0), dist = H * 2.4 * widen;
    if (!this.compare && this.group) this.group.position.x = 0;
    if (v.fit === 'face' && this.marks) { const e = this.marks.head.eyes[0].center; target.set(0, e[1] - 0.03 + go, e[2]); dist = 0.62; }
    if (v.fit === 'upper') { target.set(0, H * 0.72, 0); dist = H * 1.05; }
    if (v.fit === 'hand' && J) { const p = J.rightMiddleProximal; target.set(p[0], p[1] + go, p[2]); dist = 0.42; }
    if (v.fit === 'feet' && J) { target.set(0, 0.08, J.rightToes[2] + 0.05); dist = 0.95; }
    const dir = new THREE.Vector3(...v.dir).normalize();
    const pos = target.clone().addScaledVector(dir, dist);
    if (instant) { this.camera.position.copy(pos); this.controls.target.copy(target); this.controls.update(); this.anim = null; }
    else this.anim = { t: 0, p0: this.camera.position.clone(), p1: pos, t0: this.controls.target.clone(), t1: target };
  }

  tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.time += dt;
    if (this.anim) {
      this.anim.t = Math.min(1, this.anim.t + dt * 2.6);
      const k = 1 - Math.pow(1 - this.anim.t, 3);
      this.camera.position.lerpVectors(this.anim.p0, this.anim.p1, k);
      this.controls.target.lerpVectors(this.anim.t0, this.anim.t1, k);
      if (this.anim.t >= 1) this.anim = null;
    }
    if (this.check) { this.check.mixer.update(dt); if (this.autoRotate) this.check.root.rotation.y += dt * 0.5; }
    for (const g of [this.group, this.compare]) {
      if (!g) continue;
      const sk = g.userData.skeleton;
      if (sk) applyPose(sk, this.pose, this.time);
      if (this.autoRotate) g.rotation.y += dt * 0.5;
    }
    this.controls.update();
    if (this.thumbJobs && this.thumbJobs.length) this.drawThumbnails();
    this.renderer.render(this.scene, this.camera);
  }

  /** Show an exported GLB instead of the live character (export self-check), playing one of its clips. */
  async showGLB(buf, clip = 'walk') {
    this.hideGLB();
    const gltf = await new GLTFLoader().parseAsync(buf.slice(0), '');
    const root = gltf.scene;
    root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
    const mixer = new THREE.AnimationMixer(root);
    const a = gltf.animations.find(x => x.name === clip) || gltf.animations[0];
    if (a) mixer.clipAction(a).play();
    this.check = { root, mixer, anims: gltf.animations, clips: gltf.animations.map(x => x.name) };
    this.scene.add(root);
    if (this.group) this.group.visible = false;
    if (this.compare) this.compare.visible = false;
    return this.check;
  }
  playGLB(name) {
    const c = this.check; if (!c) return;
    const clip = c.anims.find(x => x.name === name); if (!clip) return;
    c.mixer.stopAllAction(); c.mixer.clipAction(clip).play();
  }
  hideGLB() {
    if (!this.check) return;
    this.scene.remove(this.check.root);
    this.check.root.traverse(o => { if (o.isMesh) { o.geometry.dispose(); [].concat(o.material).forEach(m => { for (const k of ['map', 'normalMap']) if (m[k]) m[k].dispose(); m.dispose(); }); } });
    this.check = null;
    if (this.group) this.group.visible = true;
    if (this.compare) this.compare.visible = true;
  }

  /**
   * Small square image of the current character (for the library). Resolves with a JPEG data URL.
   * Drawn on the viewport canvas itself, in a small corner (scissor), just before the next frame is drawn
   * over it: same render settings as the view, so no shader is recompiled (a render target would
   * recompile every PBR material, freezing slow GPUs for seconds), only size² pixels are shaded, the
   * shadow map of the frame is reused, and no extra full frame is rendered.
   */
  thumbnail(size = 192) {
    if (!this.group) return Promise.resolve('');
    return new Promise(resolve => {
      (this.thumbJobs || (this.thumbJobs = [])).push({ size, resolve });
      if (!this.running) { this.drawThumbnails(); this.renderer.render(this.scene, this.camera); }
    });
  }
  drawThumbnails() {
    const jobs = this.thumbJobs.splice(0), r = this.renderer, canvas = r.domElement;
    const pr = r.getPixelRatio();
    const prevShadow = r.shadowMap.autoUpdate;
    const hidden = [];
    if (this.compare && this.compare.visible) { this.compare.visible = false; hidden.push(this.compare); }
    for (const job of jobs) {
      let url = '';
      try {
        const px = Math.max(16, Math.min(job.size, canvas.width, canvas.height));   // device pixels
        const css = px / pr;
        const cam = new THREE.PerspectiveCamera(26, 1, 0.02, 30);
        const H = this.height || 1.75;
        const t = new THREE.Vector3(this.group.position.x, H * 0.55, 0);
        cam.position.copy(t).add(new THREE.Vector3(0.45, 0.12, -1).normalize().multiplyScalar(H * 2.3));
        cam.lookAt(t);
        r.setViewport(0, 0, css, css); r.setScissor(0, 0, css, css); r.setScissorTest(true);
        r.shadowMap.autoUpdate = false;
        r.render(this.scene, cam);
        const c = document.createElement('canvas'); c.width = c.height = job.size;
        // the viewport (0, 0) is the bottom-left corner of the canvas
        c.getContext('2d').drawImage(canvas, 0, canvas.height - px, px, px, 0, 0, job.size, job.size);
        url = c.toDataURL('image/jpeg', 0.82);
      } catch (e) { console.warn('[n3d] thumbnail failed', e); }
      job.resolve(url);
    }
    r.setScissorTest(false);
    r.setViewport(0, 0, canvas.width / pr, canvas.height / pr);
    r.shadowMap.autoUpdate = prevShadow;
    for (const o of hidden) o.visible = true;
  }
}

function gradientTexture() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#4b5568'); grd.addColorStop(0.55, '#323a4b'); grd.addColorStop(1, '#1d222d');
  g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
