/* =====================================================================
 * NORMAL 3D — STANDARD HUMANOID SKELETON (VRM 1.0 humanoid bone names)
 *
 * 55 bones, identical for every Normal 3D character: torso, neck, head,
 * eyes, jaw, shoulders, arms, hands with 15 finger bones each, legs, feet,
 * toes. Garments, hair and accessories never add, rename or remove bones.
 * Rest pose = relaxed A-pose (arms ~40° below horizontal), −Z = front,
 * +X = the character's right, metres, feet on y = 0.
 * ===================================================================== */

const B = (name, parent, limonat) => ({ name, parent, limonat });
const side = (s, list) => list.map(([n, p, l]) => B(s + n, p ? (p === 'upperChest' || p === 'hips' ? p : s + p) : null, l));
const arm = s => side(s, [
  ['Shoulder', 'upperChest', s === 'left' ? 'armL' : 'armR'],
  ['UpperArm', 'Shoulder', s === 'left' ? 'armL' : 'armR'],
  ['LowerArm', 'UpperArm', s === 'left' ? 'armL' : 'armR'],
  ['Hand', 'LowerArm', s === 'left' ? 'armL' : 'armR'],
  ['ThumbMetacarpal', 'Hand'], ['ThumbProximal', 'ThumbMetacarpal'], ['ThumbDistal', 'ThumbProximal'],
  ['IndexProximal', 'Hand'], ['IndexIntermediate', 'IndexProximal'], ['IndexDistal', 'IndexIntermediate'],
  ['MiddleProximal', 'Hand'], ['MiddleIntermediate', 'MiddleProximal'], ['MiddleDistal', 'MiddleIntermediate'],
  ['RingProximal', 'Hand'], ['RingIntermediate', 'RingProximal'], ['RingDistal', 'RingIntermediate'],
  ['LittleProximal', 'Hand'], ['LittleIntermediate', 'LittleProximal'], ['LittleDistal', 'LittleIntermediate'],
].map(([n, p, l]) => [n, p, l || (s === 'left' ? 'armL' : 'armR')]));
const leg = s => side(s, [
  ['UpperLeg', 'hips'], ['LowerLeg', 'UpperLeg'], ['Foot', 'LowerLeg'], ['Toes', 'Foot'],
].map(([n, p]) => [n, p, s === 'left' ? 'legL' : 'legR']));

export const BONES = [
  B('hips', null, 'body'), B('spine', 'hips', 'body'), B('chest', 'spine', 'body'), B('upperChest', 'chest', 'body'),
  B('neck', 'upperChest', 'body'), B('head', 'neck', 'head'), B('leftEye', 'head', 'head'), B('rightEye', 'head', 'head'), B('jaw', 'head', 'head'),
  ...arm('left'), ...arm('right'), ...leg('left'), ...leg('right'),
];
export const BONE_NAMES = BONES.map(b => b.name);
export const BONE_INDEX = Object.fromEntries(BONES.map((b, i) => [b.name, i]));
export const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Little'];

/** Attachment points (empty nodes in the GLB; accessories anchor here). */
export const ATTACH_POINTS = {
  head_top: { bone: 'head', label: { en: 'Top of head', ar: 'أعلى الرأس' } },
  forehead: { bone: 'head', label: { en: 'Forehead', ar: 'الجبهة' } },
  eyes: { bone: 'head', label: { en: 'Eyes (glasses)', ar: 'العينان (نظارة)' } },
  ear_left: { bone: 'head', label: { en: 'Left ear', ar: 'الأذن اليسرى' } },
  ear_right: { bone: 'head', label: { en: 'Right ear', ar: 'الأذن اليمنى' } },
  neck: { bone: 'neck', label: { en: 'Neck', ar: 'الرقبة' } },
  chest: { bone: 'upperChest', label: { en: 'Chest', ar: 'الصدر' } },
  back: { bone: 'upperChest', label: { en: 'Back', ar: 'الظهر' } },
  shoulder_left: { bone: 'leftShoulder', label: { en: 'Left shoulder', ar: 'الكتف الأيسر' } },
  shoulder_right: { bone: 'rightShoulder', label: { en: 'Right shoulder', ar: 'الكتف الأيمن' } },
  waist: { bone: 'hips', label: { en: 'Waist', ar: 'الخصر' } },
  hip_left: { bone: 'hips', label: { en: 'Left hip', ar: 'الورك الأيسر' } },
  hip_right: { bone: 'hips', label: { en: 'Right hip', ar: 'الورك الأيمن' } },
  wrist_left: { bone: 'leftLowerArm', label: { en: 'Left wrist', ar: 'المعصم الأيسر' } },
  wrist_right: { bone: 'rightLowerArm', label: { en: 'Right wrist', ar: 'المعصم الأيمن' } },
  hand_left: { bone: 'leftHand', label: { en: 'Left hand (held)', ar: 'اليد اليسرى (ممسوك)' } },
  hand_right: { bone: 'rightHand', label: { en: 'Right hand (held)', ar: 'اليد اليمنى (ممسوك)' } },
  finger_left: { bone: 'leftRingProximal', label: { en: 'Left ring finger', ar: 'بنصر اليد اليسرى' } },
  finger_right: { bone: 'rightRingProximal', label: { en: 'Right ring finger', ar: 'بنصر اليد اليمنى' } },
};
export const ATTACH_POINT_IDS = Object.keys(ATTACH_POINTS);

/* ---------------------------------------------------------------- vector helpers */
export const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
  len: a => Math.hypot(a[0], a[1], a[2]),
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  mirror: a => [-a[0], a[1], a[2]],
};
