/* Rest-pose / facing transforms of a compiled model (pure data).
 * Used by the exporter so a character can be delivered:
 *   - in Limonat's convention (arms down, facing -Z)  [default]
 *   - in a T-pose (arms out) for VRM / motion-capture tools
 *   - facing +Z, the glTF / VRM 1.0 convention
 * Rotations are multiples of 90°, so voxels stay axis-aligned. */

const ARM = { left: ['leftUpperArm', 'leftLowerArm', 'leftHand'], right: ['rightUpperArm', 'rightLowerArm', 'rightHand'] };
const ARM_POINTS = { left: ['wrist_left', 'hand_left'], right: ['wrist_right', 'hand_right'] };
const r3 = v => Math.round(v * 1000) / 1000;
const clone = o => JSON.parse(JSON.stringify(o));

/** Arms-down → T-pose: rotate each arm 90° about Z around its shoulder. */
export function toTPose(model) {
  const out = clone(model);
  const shoulder = {};
  for (const j of out.joints) if (j.name === 'leftUpperArm' || j.name === 'rightUpperArm') shoulder[j.name.startsWith('left') ? 'left' : 'right'] = j.pos.slice();
  // left arm hangs along -Y and must point along -X: (dx, dy) → (dy, -dx); right: (dx, dy) → (-dy, dx)
  const rot = (side, x, y) => {
    const [sx, sy] = shoulder[side], dx = x - sx, dy = y - sy;
    return side === 'left' ? [sx + dy, sy - dx] : [sx - dy, sy + dx];
  };
  for (const side of ['left', 'right']) {
    const joints = new Set(ARM[side]);
    for (const j of out.joints) if (joints.has(j.name)) { const [x, y] = rot(side, j.pos[0], j.pos[1]); j.pos = [r3(x), r3(y), j.pos[2]]; }
    for (const b of out.boxes) {
      if (!joints.has(b.joint)) continue;
      const pts = [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].map(([x, y]) => rot(side, x, y));
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const x0 = Math.min(...xs), y0 = Math.min(...ys);
      Object.assign(b, { x: r3(x0), y: r3(y0), w: r3(Math.max(...xs) - x0), h: r3(Math.max(...ys) - y0) });
    }
    for (const id of ARM_POINTS[side]) {
      const a = out.attachments[id];
      if (a) { const [x, y] = rot(side, a.pos[0], a.pos[1]); a.pos = [r3(x), r3(y), a.pos[2]]; }
    }
  }
  out.restPose = 'tpose';
  return out;
}

/** Turn the character 180° so it faces +Z (its left side moves to +X, as glTF/VRM 1.0 expect). */
export function toFacingPlusZ(model) {
  const out = clone(model);
  for (const j of out.joints) j.pos = [r3(-j.pos[0]), j.pos[1], r3(-j.pos[2])];
  for (const b of out.boxes) { b.x = r3(-(b.x + b.w)); b.z = r3(-(b.z + b.d)); }
  for (const a of Object.values(out.attachments)) a.pos = [r3(-a.pos[0]), a.pos[1], r3(-a.pos[2])];
  out.facing = '+Z';
  return out;
}
