/* =====================================================================
 * NORMAL 3D — BODY AND FACE PARAMETERS
 *
 * The single source of truth for every numeric shape control: the UI
 * sliders, the validator ranges, the AI prompt and the JSON Schema are all
 * generated from these tables. Body values are multipliers (1 = average)
 * or 0..1 amounts; face values are offsets from −1 to 1 (0 = average face).
 * ===================================================================== */

const P = (min, max, def, en, ar, doc, group, step) => ({ min, max, default: def, label: { en, ar }, doc, group, step: step ?? (max - min > 3 ? 0.01 : 0.01) });

export const BODY_GROUPS = {
  overall: { en: 'Overall', ar: 'عام' },
  torso: { en: 'Torso', ar: 'الجذع' },
  arms: { en: 'Arms and hands', ar: 'الذراعان واليدان' },
  legs: { en: 'Legs and feet', ar: 'الساقان والقدمان' },
  style: { en: 'Style', ar: 'الأسلوب' },
};

export const BODY_PARAMS = {
  height: P(1.45, 2.05, 1.75, 'Height (m)', 'الطول (م)', 'standing height in metres', 'overall', 0.005),
  masculinity: P(0, 1, 0.5, 'Anatomy: feminine ↔ masculine', 'البنية: أنثوية ↔ ذكورية', '0 = feminine anatomy (narrower shoulders, wider hips, softer jaw), 1 = masculine', 'overall'),
  muscle: P(0, 1, 0.35, 'Muscle', 'العضلات', 'muscle mass and definition', 'overall'),
  bodyFat: P(0, 1, 0.25, 'Body fat', 'الدهون', 'softness and overall mass', 'overall'),
  headScale: P(0.85, 1.45, 1, 'Head size', 'حجم الرأس', 'head size relative to the body', 'overall'),
  neckLength: P(0.75, 1.3, 1, 'Neck length', 'طول الرقبة', 'neck length', 'torso'),
  neckThickness: P(0.75, 1.35, 1, 'Neck thickness', 'سماكة الرقبة', 'neck thickness', 'torso'),
  shoulderWidth: P(0.8, 1.25, 1, 'Shoulder width', 'عرض الكتفين', 'shoulder width', 'torso'),
  chestWidth: P(0.8, 1.25, 1, 'Chest width', 'عرض الصدر', 'rib cage width', 'torso'),
  chestDepth: P(0.8, 1.3, 1, 'Chest depth', 'عمق الصدر', 'rib cage depth (front to back)', 'torso'),
  bust: P(0, 1, 0.25, 'Chest volume', 'حجم الصدر', 'bust volume (mainly for feminine anatomy)', 'torso'),
  waist: P(0.75, 1.4, 1, 'Waist', 'الخصر', 'waist width', 'torso'),
  hipWidth: P(0.8, 1.3, 1, 'Hips', 'الوركان', 'hip width', 'torso'),
  belly: P(0, 1, 0, 'Belly', 'البطن', 'belly volume', 'torso'),
  glutes: P(0.7, 1.35, 1, 'Glutes', 'الأرداف', 'buttock volume', 'torso'),
  torsoLength: P(0.88, 1.15, 1, 'Torso length', 'طول الجذع', 'torso length relative to the legs', 'torso'),
  armLength: P(0.88, 1.15, 1, 'Arm length', 'طول الذراعين', 'arm length', 'arms'),
  forearmRatio: P(0.8, 1.2, 1, 'Forearm ↔ upper arm', 'الساعد ↔ العضد', 'forearm length relative to the upper arm', 'arms'),
  upperArmThickness: P(0.75, 1.45, 1, 'Upper-arm thickness', 'سماكة العضد', 'upper arm thickness', 'arms'),
  forearmThickness: P(0.75, 1.35, 1, 'Forearm thickness', 'سماكة الساعد', 'forearm thickness', 'arms'),
  handSize: P(0.85, 1.2, 1, 'Hand size', 'حجم اليد', 'hand size', 'arms'),
  fingerLength: P(0.85, 1.2, 1, 'Finger length', 'طول الأصابع', 'finger length', 'arms'),
  fingerThickness: P(0.8, 1.25, 1, 'Finger thickness', 'سماكة الأصابع', 'finger thickness', 'arms'),
  legLength: P(0.88, 1.15, 1, 'Leg length', 'طول الساقين', 'leg length', 'legs'),
  thighRatio: P(0.9, 1.1, 1, 'Thigh ↔ shin', 'الفخذ ↔ الساق', 'thigh length relative to the shin', 'legs'),
  thighThickness: P(0.75, 1.45, 1, 'Thigh thickness', 'سماكة الفخذ', 'thigh thickness', 'legs'),
  calfThickness: P(0.75, 1.35, 1, 'Calf thickness', 'سماكة بطن الساق', 'calf thickness', 'legs'),
  footSize: P(0.85, 1.2, 1, 'Foot size', 'حجم القدم', 'foot size', 'legs'),
  stylization: P(0, 1, 0, 'Realistic ↔ stylized', 'واقعي ↔ كرتوني', '0 = realistic proportions, 1 = stylized cartoon (bigger head and eyes, simpler features, softer forms)', 'style'),
};

export const FACE_GROUPS = {
  head: { en: 'Head shape', ar: 'شكل الرأس' },
  jaw: { en: 'Jaw, chin, cheeks', ar: 'الفك والذقن والوجنتان' },
  eyes: { en: 'Eyes and brows', ar: 'العينان والحاجبان' },
  nose: { en: 'Nose', ar: 'الأنف' },
  mouth: { en: 'Mouth and lips', ar: 'الفم والشفاه' },
  ears: { en: 'Ears', ar: 'الأذنان' },
};

const F = (en, ar, doc, group, min = -1, max = 1) => P(min, max, 0, en, ar, doc, group);
export const FACE_PARAMS = {
  headWidth: F('Head width', 'عرض الرأس', 'skull width', 'head'),
  headDepth: F('Head depth', 'عمق الرأس', 'skull length front to back', 'head'),
  craniumHeight: F('Cranium height', 'ارتفاع الجمجمة', 'height of the top of the head', 'head'),
  foreheadHeight: F('Forehead height', 'ارتفاع الجبهة', 'forehead height', 'head'),
  foreheadSlope: F('Forehead slope', 'ميل الجبهة', 'how much the forehead slopes back', 'head'),
  faceLength: F('Face length', 'طول الوجه', 'length of the lower face', 'head'),
  jawWidth: F('Jaw width', 'عرض الفك', 'jaw width at the angles', 'jaw'),
  jawAngle: F('Jaw: rounded ↔ square', 'الفك: مستدير ↔ حاد', 'softness of the jaw angle', 'jaw'),
  chinLength: F('Chin length', 'طول الذقن', 'chin height', 'jaw'),
  chinWidth: F('Chin width', 'عرض الذقن', 'chin width', 'jaw'),
  chinProjection: F('Chin projection', 'بروز الذقن', 'how far the chin comes forward', 'jaw'),
  chinCleft: F('Chin cleft', 'غمازة الذقن', 'dimple in the chin', 'jaw', 0, 1),
  cheekbones: F('Cheekbones', 'عظام الوجنتين', 'cheekbone prominence', 'jaw'),
  cheekFullness: F('Cheek fullness', 'امتلاء الخدين', 'cheek fat', 'jaw'),
  eyeSize: F('Eye size', 'حجم العين', 'eye size', 'eyes'),
  eyeSpacing: F('Eye spacing', 'المسافة بين العينين', 'distance between the eyes', 'eyes'),
  eyeHeight: F('Eye height', 'ارتفاع العينين', 'vertical position of the eyes', 'eyes'),
  eyeTilt: F('Eye tilt', 'ميل العينين', 'outer corners up (+) or down (−)', 'eyes'),
  eyeOpen: F('Eye openness', 'انفتاح العينين', 'how open the eyelids are', 'eyes'),
  eyeShape: F('Eye shape: almond ↔ round', 'شكل العين: لوزي ↔ دائري', 'almond (−) to round (+)', 'eyes'),
  eyeDepth: F('Eye depth', 'عمق العينين', 'deep-set (+) or prominent (−) eyes', 'eyes'),
  lidHood: F('Hooded lids', 'الجفن المنسدل', 'upper lid fold covering the crease', 'eyes', 0, 1),
  browRidge: F('Brow ridge', 'بروز الحاجب', 'brow bone prominence', 'eyes'),
  browHeight: F('Brow height', 'ارتفاع الحاجبين', 'brow position', 'eyes'),
  noseLength: F('Nose length', 'طول الأنف', 'nose length', 'nose'),
  noseBridge: F('Bridge height', 'ارتفاع قصبة الأنف', 'bridge projection', 'nose'),
  noseBridgeWidth: F('Bridge width', 'عرض قصبة الأنف', 'bridge width', 'nose'),
  noseTip: F('Tip size', 'حجم طرف الأنف', 'nose tip size', 'nose'),
  noseTipUpturn: F('Tip up / down', 'طرف الأنف لأعلى / لأسفل', 'upturned (+) or drooping (−) tip', 'nose'),
  noseWidth: F('Nostril width', 'عرض فتحتي الأنف', 'width of the nose wings', 'nose'),
  noseHook: F('Profile: scooped ↔ hooked', 'الجانب: مقعّر ↔ معقوف', 'concave (−) or aquiline (+) profile', 'nose'),
  mouthWidth: F('Mouth width', 'عرض الفم', 'mouth width', 'mouth'),
  upperLip: F('Upper lip', 'الشفة العليا', 'upper lip fullness', 'mouth'),
  lowerLip: F('Lower lip', 'الشفة السفلى', 'lower lip fullness', 'mouth'),
  lipProjection: F('Lip projection', 'بروز الشفاه', 'how far the lips come forward', 'mouth'),
  cupidsBow: F("Cupid's bow", 'قوس الشفة', 'definition of the upper lip curve', 'mouth'),
  mouthCorners: F('Mouth corners', 'زاويتا الفم', 'corners up (+, smiling) or down (−)', 'mouth'),
  earSize: F('Ear size', 'حجم الأذن', 'ear size', 'ears'),
  earProtrusion: F('Ear protrusion', 'بروز الأذن', 'how far the ears stick out', 'ears'),
  earHeight: F('Ear height', 'ارتفاع الأذن', 'vertical position of the ears', 'ears'),
  earPoint: F('Pointed ears', 'أذن مدببة', 'pointed (elf-like) ear tips', 'ears', 0, 1),
};

export const BODY_KEYS = Object.keys(BODY_PARAMS);
export const FACE_KEYS = Object.keys(FACE_PARAMS);

export function defaults(table) { return Object.fromEntries(Object.entries(table).map(([k, v]) => [k, v.default])); }
export function clampParam(table, key, v) {
  const d = table[key];
  if (!d || typeof v !== 'number' || !isFinite(v)) return d ? d.default : 0;
  return Math.min(d.max, Math.max(d.min, Math.round(v * 1000) / 1000));
}
/** Fill a partial param object with defaults and clamp everything. */
export function completeParams(table, src) {
  const out = {};
  for (const k of Object.keys(table)) out[k] = clampParam(table, k, src && typeof src[k] === 'number' ? src[k] : table[k].default);
  return out;
}
