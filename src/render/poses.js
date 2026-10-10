/* =====================================================================
 * Preview poses + exportable animation clips.
 *
 * Poses are written once, in Limonat's convention (rest = arms down,
 * facing -Z), as Euler rotations per bone. For other export conventions
 * the rotations are converted mathematically:
 *   T-pose rest:  upper arm  q' = q · R,   lower arm / hand  q' = R⁻¹ · q · R
 *   facing +Z:    q' = Ry(π) · q · Ry(π)⁻¹
 * so every clip stays correct whatever rest pose / facing is exported.
 * ===================================================================== */
import * as THREE from 'three';
import { PX } from '../core/constants.js';

export const POSES = ['rest', 'idle', 'walk', 'wave', 'tpose'];
const S = Math.sin, max = Math.max;

/** Returns { boneName: [x, y, z] Euler } and optional hips lift (px) for time t (seconds). */
export function poseAt(name, t) {
  const r = {};
  let lift = 0;
  if (name === 'idle') {
    const b = S(t * 2.2);
    r.chest = [b * 0.025, 0, 0];
    r.head = [S(t * 0.9) * 0.05, S(t * 0.6) * 0.22, 0];
    r.leftUpperArm = [S(t * 1.1) * 0.05, 0, -0.1 - b * 0.03];
    r.rightUpperArm = [S(t * 1.1 + 1) * 0.05, 0, 0.1 + b * 0.03];
    r.leftLowerArm = [0.12, 0, 0];
    r.rightLowerArm = [0.12, 0, 0];
  } else if (name === 'walk') {
    const ph = t * 6.5, sw = S(ph) * 0.6;
    r.leftUpperLeg = [sw, 0, 0];
    r.rightUpperLeg = [-sw, 0, 0];
    r.leftLowerLeg = [-0.75 * max(0, S(ph + 1.3)), 0, 0];
    r.rightLowerLeg = [-0.75 * max(0, S(ph + 1.3 + Math.PI)), 0, 0];
    r.leftUpperArm = [-sw * 0.85, 0, -0.08];
    r.rightUpperArm = [sw * 0.85, 0, 0.08];
    r.leftLowerArm = [0.3 + 0.25 * max(0, -S(ph)), 0, 0];
    r.rightLowerArm = [0.3 + 0.25 * max(0, S(ph)), 0, 0];
    r.chest = [0, S(ph) * 0.1, 0];
    r.hips = [0, -S(ph) * 0.06, 0];
    r.head = [0, -S(ph) * 0.05, 0];
    lift = Math.abs(S(ph)) * 0.35;
  } else if (name === 'wave') {
    r.rightUpperArm = [0, 0, 2.55];
    r.rightLowerArm = [0, 0, 0.25 + S(t * 9) * 0.45];
    r.leftUpperArm = [0, 0, -0.1];
    r.head = [0.05, S(t * 1.5) * 0.1, S(t * 2) * 0.06 - 0.05];
    r.chest = [0, 0, -0.04];
  } else if (name === 'tpose') {
    r.leftUpperArm = [0, 0, -Math.PI / 2];
    r.rightUpperArm = [0, 0, Math.PI / 2];
  }
  return { rot: r, lift };
}

/** Apply a pose to a live rig (preview). restHipsY is the hips bone rest y (metres). */
export function applyPose(rig, name, t, restHipsY) {
  for (const b of Object.values(rig.bones)) b.rotation.set(0, 0, 0);
  const { rot, lift } = poseAt(name, t);
  for (const [bone, e] of Object.entries(rot)) if (rig.bones[bone]) rig.bones[bone].rotation.set(e[0], e[1], e[2]);
  rig.bones.hips.position.y = restHipsY + lift * PX;
}

// ------------------------------------------------------------------ clip export
const ARMS = { leftUpperArm: 'left', rightUpperArm: 'right', leftLowerArm: 'left', rightLowerArm: 'right', leftHand: 'left', rightHand: 'right' };
const CLIPS = { idle: 4, walk: 2 * Math.PI / 6.5, wave: 2 * Math.PI / 9 * 2 };

/**
 * Build THREE.AnimationClips for the given export conventions.
 * @param opts { restPose: 'armsDown' | 'tpose', facing: 'limonat' | 'gltf', hipsRestY (metres), clips: ['idle','walk','wave'] }
 */
export function buildClips(opts) {
  const names = opts.clips || ['idle', 'walk', 'wave'];
  const rY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  const rYi = rY.clone().invert();
  const R = {
    left: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2),
    right: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2),
  };
  const e = new THREE.Euler(), q = new THREE.Quaternion();
  const convert = (bone, euler) => {
    q.setFromEuler(e.set(euler[0], euler[1], euler[2]));
    const side = ARMS[bone];
    if (opts.restPose === 'tpose' && side) {
      const r = R[side];
      if (bone.endsWith('UpperArm')) q.multiply(r);                       // q · R
      else q.premultiply(r.clone().invert()).multiply(r);                // R⁻¹ · q · R
    }
    if (opts.facing === 'gltf') q.premultiply(rY).multiply(rYi);         // Ry(π) · q · Ry(π)⁻¹
    return q;
  };
  const clips = [];
  for (const name of names) {
    const dur = CLIPS[name], frames = 24, times = [];
    const tracks = {}, hipsPos = [];
    for (let i = 0; i <= frames; i++) {
      const t = (i / frames) * dur;
      times.push(t);
      const { rot, lift } = poseAt(name, t);
      for (const bone of Object.keys(rot)) tracks[bone] = tracks[bone] || [];
      for (const bone of Object.keys(tracks)) {
        const qq = convert(bone, rot[bone] || [0, 0, 0]);
        tracks[bone].push(qq.x, qq.y, qq.z, qq.w);
      }
      hipsPos.push(0, opts.hipsRestY + lift * PX, 0);
    }
    const kt = Object.entries(tracks).map(([bone, v]) => new THREE.QuaternionKeyframeTrack(bone + '.quaternion', times, v));
    if (name === 'walk') kt.push(new THREE.VectorKeyframeTrack('hips.position', times, hipsPos));
    clips.push(new THREE.AnimationClip(name, dur, kt));
  }
  return clips;
}
