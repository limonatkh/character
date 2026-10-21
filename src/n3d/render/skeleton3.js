/* =====================================================================
 * THREE.JS SKELETON for a Normal 3D build: one bone per humanoid joint
 * (VRM names), in the rest A-pose, shared by every skinned mesh. Used by
 * the viewer (pose previews prove the rig works) and by the GLB exporter.
 * Also a few procedural poses: relaxed, idle breathing, walk, wave, T-pose.
 * ===================================================================== */
import * as THREE from 'three';
import { BONES, BONE_INDEX } from '../core/skeleton.js';

/**
 * Bones from the joint positions (rest pose). The root bone is added to
 * `parent` (if given) BEFORE the bind (inverse) matrices are computed, so
 * meshes in the same parent bind correctly whatever the parent's transform.
 * Returns { bones, skeleton, root, byName }.
 */
export function makeSkeleton(joints, parent = null) {
  const bones = BONES.map(b => { const bone = new THREE.Bone(); bone.name = b.name; return bone; });
  const byName = {};
  BONES.forEach((b, i) => { byName[b.name] = bones[i]; });
  BONES.forEach((b, i) => {
    const j = joints[b.name], bone = bones[i];
    if (b.parent) {
      const pj = joints[b.parent];
      bone.position.set(j[0] - pj[0], j[1] - pj[1], j[2] - pj[2]);
      byName[b.parent].add(bone);
    } else bone.position.set(j[0], j[1], j[2]);
  });
  const root = byName.hips;
  if (parent) { parent.add(root); parent.updateMatrixWorld(true); } else root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);          // inverse bind matrices from the rest pose
  for (const b of bones) b.userData.rest = { p: b.position.clone(), q: b.quaternion.clone() };
  return { bones, skeleton, root, byName };
}

/** Rigid weights (one bone) when a mesh has none. */
export function rigidSkin(n, bone) {
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { si[i * 4] = bone; sw[i * 4] = 1; }
  return { skinIndex: si, skinWeight: sw };
}

const Z = new THREE.Vector3(0, 0, 1), X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
const q = new THREE.Quaternion();
function rot(bone, axis, angle) { if (!bone) return; q.setFromAxisAngle(axis, angle); bone.quaternion.multiply(q); }

/** Apply a pose at time t (seconds). Poses: rest | relaxed | idle | walk | wave | tpose */
export function applyPose(sk, pose, t = 0) {
  const B = sk.byName;
  for (const b of sk.bones) { b.position.copy(b.userData.rest.p); b.quaternion.copy(b.userData.rest.q); }
  if (pose === 'rest') return;
  const arm = (s, down, fwd = 0) => { rot(B[s + 'UpperArm'], Z, (s === 'left' ? 1 : -1) * down); rot(B[s + 'UpperArm'], X, -fwd); };
  if (pose === 'tpose') { arm('left', -0.73); arm('right', -0.73); return; }
  if (pose === 'relaxed' || pose === 'idle' || pose === 'walk' || pose === 'wave') {
    arm('left', 0.62); arm('right', 0.62);
    rot(B.leftLowerArm, X, -0.18); rot(B.rightLowerArm, X, -0.18);
  }
  if (pose === 'idle' || pose === 'relaxed') {
    // frequencies are whole multiples of 2π/12 s, so the exported idle clip (12 s) loops seamlessly
    const w = 2 * Math.PI / 12, br = Math.sin(t * 4 * w) * 0.012;
    rot(B.chest, X, br); rot(B.neck, X, -br * 0.6);
    rot(B.spine, Z, Math.sin(t * w) * 0.012);
    rot(B.head, Y, Math.sin(t * w + 1) * 0.06);
  }
  if (pose === 'walk') {
    const w = t * 5.2, s = Math.sin(w);
    rot(B.leftUpperLeg, X, -s * 0.42); rot(B.rightUpperLeg, X, s * 0.42);
    rot(B.leftLowerLeg, X, Math.max(0, Math.sin(w + 1.2)) * 0.65); rot(B.rightLowerLeg, X, Math.max(0, Math.sin(w + Math.PI + 1.2)) * 0.65);
    rot(B.leftUpperArm, X, s * 0.38); rot(B.rightUpperArm, X, -s * 0.38);
    rot(B.spine, Y, s * 0.06);
    B.hips.position.y = B.hips.userData.rest.p.y + Math.abs(Math.cos(w)) * 0.018 - 0.012;
  }
  if (pose === 'wave') {
    rot(B.rightUpperArm, Z, 1.9); rot(B.rightLowerArm, Z, 0.7 + Math.sin(t * 7) * 0.35); rot(B.rightLowerArm, X, -0.2);
  }
}
export { BONE_INDEX };
