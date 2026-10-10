/* =====================================================================
 * 3D PREVIEW — orbit / zoom / pan, view presets, poses, and a check mode
 * that re-opens an exported GLB with GLTFLoader (proves the file is valid
 * and its rig + clips play in a standard glTF loader).
 * ===================================================================== */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PX } from '../core/constants.js';
import { buildCharacterObject } from './mesh.js';
import { applyPose } from './poses.js';

const VIEW_DIRS = {
  front: [0, 0.08, -1], back: [0, 0.1, 1], left: [-1, 0.08, 0], right: [1, 0.08, 0],
  threeQuarter: [0.62, 0.22, -0.78], top: [0.01, 1, -0.2], face: [0, 0.02, -1],
};

export class Viewer {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label', '3D character preview');
    this.renderer.domElement.style.touchAction = 'none';

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#BFD9EF');
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(2, 4, -3);
    this.scene.add(sun);

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.05, 100);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 12;
    this.controls.maxPolarAngle = Math.PI * 0.62;
    this.controls.screenSpacePanning = true;

    this.addGround();
    this.rig = null;
    this.pose = 'idle';
    this.autoRotate = false;
    this.clock = new THREE.Clock();
    this.time = 0;
    this.height = 1.8;
    this.view = 'threeQuarter';
    this.check = null;            // { root, mixer } while showing a re-opened GLB

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
    this.setView('threeQuarter', true);
    this.renderer.setAnimationLoop(() => this.tick());
  }

  addGround() {
    // snowy voxel platform, Limonat style
    const g = new THREE.Group();
    const tile = new THREE.BoxGeometry(0.5, 0.12, 0.5);
    const a = new THREE.MeshBasicMaterial({ color: '#F2F6FA' }), b = new THREE.MeshBasicMaterial({ color: '#E2EAF2' });
    for (let i = -4; i < 4; i++) for (let j = -4; j < 4; j++) {
      if (i * i + j * j > 18) continue;
      const m = new THREE.Mesh(tile, (i + j) & 1 ? a : b);
      m.position.set(i * 0.5 + 0.25, -0.06, j * 0.5 + 0.25);
      g.add(m);
    }
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.14, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.002;
    g.add(shadow);
    this.scene.add(g);
  }

  /** Replace the displayed character with a newly compiled model. */
  setModel(model) {
    const old = this.rig;
    const rig = buildCharacterObject(model, { shading: 'flat' });
    rig.hipsRestY = rig.bones.hips.position.y;
    if (old) rig.root.rotation.y = old.root.rotation.y;
    this.scene.add(rig.root);
    if (old) { this.scene.remove(old.root); old.dispose(); }
    this.rig = rig;
    rig.root.visible = !this.check;
    const first = !this.modelLoaded;
    this.modelLoaded = true;
    this.height = model.height * PX;
    applyPose(rig, this.pose, this.time, rig.hipsRestY);
    if (first) this.setView(this.view, true);
  }

  setPose(name) { this.pose = name; }
  setAutoRotate(on) { this.autoRotate = !!on; if (!on && this.rig) this.rig.root.rotation.y = 0; }

  setView(name, instant) {
    this.view = name;
    const h = this.height, target = new THREE.Vector3(0, h * 0.5, 0);
    const d = new THREE.Vector3(...(VIEW_DIRS[name] || VIEW_DIRS.threeQuarter)).normalize();
    // fit the whole character (plus room for the overlay buttons) whatever the aspect ratio
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const fitH = (h * 1.55 / 2) / Math.tan(vFov / 2);
    const fitW = (h * 0.95 / 2) / (Math.tan(vFov / 2) * Math.max(0.3, this.camera.aspect));
    let dist = Math.max(fitH, fitW) + 0.2;
    if (name === 'face') { target.y = h * 0.8; dist = Math.max(h * 0.62, (h * 0.42 / 2) / Math.tan(vFov / 2)); }
    this.camera.position.copy(target).addScaledVector(d, dist);
    this.controls.target.copy(target);
    this.controls.update();
    if (instant) this.render();
  }

  resize() {
    const w = this.container.clientWidth || 300, h = this.container.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.time += dt;
    if (this.check) {
      this.check.mixer.update(dt);
      if (this.autoRotate) this.check.root.rotation.y += dt * 0.6;
    } else if (this.rig) {
      applyPose(this.rig, this.pose, this.time, this.rig.hipsRestY);
      if (this.autoRotate) this.rig.root.rotation.y += dt * 0.6;
    }
    this.controls.update();
    this.render();
  }

  render() { this.renderer.render(this.scene, this.camera); }

  /**
   * Show an exported GLB exactly as a glTF viewer would load it.
   * Returns { clips: [names] }. Plays `clip` (or the first clip).
   */
  async showGLB(arrayBuffer, clip) {
    this.hideGLB();
    const gltf = await new GLTFLoader().parseAsync(arrayBuffer.slice(0), '');
    const root = gltf.scene;
    const mixer = new THREE.AnimationMixer(root);
    const a = gltf.animations.find(c => c.name === clip) || gltf.animations[0];
    if (a) mixer.clipAction(a).play();
    this.scene.add(root);
    this.check = { root, mixer, gltf };
    if (this.rig) this.rig.root.visible = false;
    return { clips: gltf.animations.map(c => c.name) };
  }

  hideGLB() {
    if (!this.check) return;
    this.scene.remove(this.check.root);
    this.check.root.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => m.dispose()); });
    this.check = null;
    if (this.rig) this.rig.root.visible = true;
  }
}
