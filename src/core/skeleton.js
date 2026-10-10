/* =====================================================================
 * STANDARD SKELETON — identical for every humanoid character.
 *
 * Joint names follow the VRM humanoid bone names (the de-facto standard
 * for VTuber avatars and webcam motion capture), so the same character
 * can later be driven by a recording app without renaming anything.
 * Clothing, hair and accessories only ADD boxes to these joints; they
 * can never add, remove or rename a joint.
 *
 * `limonat` = which of Limonat's 6 animated parts the joint is merged
 * into when exporting to the game's VR.CHARACTERS format.
 * ===================================================================== */
export const JOINTS = [
  { name: 'hips',          parent: null,            limonat: 'body' },
  { name: 'spine',         parent: 'hips',          limonat: 'body' },
  { name: 'chest',         parent: 'spine',         limonat: 'body' },
  { name: 'neck',          parent: 'chest',         limonat: 'body' },
  { name: 'head',          parent: 'neck',          limonat: 'head' },
  { name: 'leftEye',       parent: 'head',          limonat: 'head' },
  { name: 'rightEye',      parent: 'head',          limonat: 'head' },
  { name: 'jaw',           parent: 'head',          limonat: 'head' },
  { name: 'leftUpperArm',  parent: 'chest',         limonat: 'armL' },
  { name: 'leftLowerArm',  parent: 'leftUpperArm',  limonat: 'armL' },
  { name: 'leftHand',      parent: 'leftLowerArm',  limonat: 'armL' },
  { name: 'rightUpperArm', parent: 'chest',         limonat: 'armR' },
  { name: 'rightLowerArm', parent: 'rightUpperArm', limonat: 'armR' },
  { name: 'rightHand',     parent: 'rightLowerArm', limonat: 'armR' },
  { name: 'leftUpperLeg',  parent: 'hips',          limonat: 'legL' },
  { name: 'leftLowerLeg',  parent: 'leftUpperLeg',  limonat: 'legL' },
  { name: 'leftFoot',      parent: 'leftLowerLeg',  limonat: 'legL' },
  { name: 'rightUpperLeg', parent: 'hips',          limonat: 'legR' },
  { name: 'rightLowerLeg', parent: 'rightUpperLeg', limonat: 'legR' },
  { name: 'rightFoot',     parent: 'rightLowerLeg', limonat: 'legR' },
];
export const JOINT_NAMES = JOINTS.map(j => j.name);
export const JOINT_INDEX = Object.fromEntries(JOINTS.map((j, i) => [j.name, i]));

/** Limonat's 6 parts and the joint whose rest position is the part's pivot. */
export const LIMONAT_PARTS = {
  legL: 'leftUpperLeg', legR: 'rightUpperLeg', body: 'hips', head: 'head', armL: 'leftUpperArm', armR: 'rightUpperArm',
};

/**
 * Attachment points for accessories. Positions are computed from the
 * body measurements (see body.js); `axis` tells an accessory which way
 * is "along" the mount (up for things worn upright, forward for held items).
 */
export const ATTACH_POINTS = {
  head_top:    { joint: 'head',          label: { en: 'Top of head', ar: 'أعلى الرأس' } },
  face:        { joint: 'head',          label: { en: 'Face', ar: 'الوجه' } },
  neck:        { joint: 'chest',         label: { en: 'Neck', ar: 'الرقبة' } },
  chest:       { joint: 'chest',         label: { en: 'Chest (front)', ar: 'الصدر' } },
  back:        { joint: 'chest',         label: { en: 'Back', ar: 'الظهر' } },
  waist:       { joint: 'hips',          label: { en: 'Waist', ar: 'الخصر' } },
  hip_left:    { joint: 'hips',          label: { en: 'Left hip', ar: 'الورك الأيسر' } },
  hip_right:   { joint: 'hips',          label: { en: 'Right hip', ar: 'الورك الأيمن' } },
  wrist_left:  { joint: 'leftLowerArm',  label: { en: 'Left wrist', ar: 'المعصم الأيسر' } },
  wrist_right: { joint: 'rightLowerArm', label: { en: 'Right wrist', ar: 'المعصم الأيمن' } },
  hand_left:   { joint: 'leftHand',      label: { en: 'Left hand (held)', ar: 'اليد اليسرى (ممسوك)' } },
  hand_right:  { joint: 'rightHand',     label: { en: 'Right hand (held)', ar: 'اليد اليمنى (ممسوك)' } },
};
export const ATTACH_POINT_IDS = Object.keys(ATTACH_POINTS);
