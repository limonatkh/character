/* =====================================================================
 * NORMAL 3D — EYEBROW AND FACIAL-HAIR STYLES
 * Brow styles are starting points for the brow controls (face.brows.params
 * override any of them). Facial-hair styles combine growth zones of the
 * face with lengths; their params let a person or an AI model lengthen,
 * thin out or curl any style.
 * ===================================================================== */
import { registerAsset, num } from '../core/registry.js';

const B = (id, en, ar, description, brow, tags = []) => registerAsset({ id, slot: 'browStyle', label: { en, ar }, description, tags, brow, none: !brow, params: {}, colors: {} });
B('brow_none', 'No eyebrows', 'بدون حواجب', 'No eyebrows (shaved / very light).', null);
B('brow_natural_01', 'Natural', 'طبيعي', 'Medium natural brows with a soft arch.', { thickness: 1, density: 1, arch: 0.1, bushiness: 0.15 });
B('brow_thick_straight_01', 'Thick straight', 'كثيف مستقيم', 'Thick, fairly straight, dense brows.', { thickness: 1.45, density: 1.35, arch: -0.6, bushiness: 0.3 });
B('brow_thin_arched_01', 'Thin arched', 'رفيع مقوس', 'Thin, groomed, high-arched brows.', { thickness: 0.6, density: 0.85, arch: 0.9, tail: 0.3, bushiness: 0 });
B('brow_bushy_01', 'Bushy', 'كثيف غير مرتب', 'Full, untidy bushy brows.', { thickness: 1.5, density: 1.5, arch: 0, bushiness: 0.95 });
B('brow_angled_01', 'Angled', 'زاوية حادة', 'Sharp angled brows (stern look).', { thickness: 1.1, density: 1.1, arch: 0.5, angle: 0.6, tail: 0.5, bushiness: 0.1 });
B('brow_rounded_01', 'Rounded', 'مستدير', 'Softly rounded, gently curved brows.', { thickness: 0.95, density: 1, arch: 0.45, tail: 0.6, bushiness: 0.1 });
B('brow_sparse_01', 'Sparse / light', 'خفيف', 'Light, sparse brows.', { thickness: 0.8, density: 0.45, arch: 0.1, bushiness: 0.2 });
B('brow_worried_01', 'Upturned (worried)', 'مرفوع من الداخل', 'Inner ends raised (worried / sad expression).', { thickness: 0.95, density: 1, arch: 0.2, angle: -0.8, bushiness: 0.1 });
B('brow_unibrow_01', 'Joined (unibrow)', 'حاجبان متصلان', 'Thick brows nearly meeting in the middle.', { thickness: 1.3, density: 1.3, arch: -0.2, spacing: -1, bushiness: 0.5 });

const FH_PARAMS = (len = 1) => ({
  length: num(0.3, 3, len, 'Length', 'الطول', 'multiplies the length of the style'),
  density: num(0.3, 1.6, 1, 'Density', 'الكثافة', 'how full the facial hair is'),
  thickness: num(0.5, 1.6, 1, 'Hair thickness', 'سماكة الشعر', 'width of the hairs / clumps'),
  curl: num(0, 1, 0, 'Curl', 'التجعيد', 'straight (0) to curly (1)'),
  messiness: num(0, 1, 0.3, 'Messiness', 'البعثرة', 'groomed (0) to untidy (1)'),
});
const FH_COLORS = { root: { label: { en: 'Colour', ar: 'اللون' }, default: '#2B1E16' }, tip: { label: { en: 'Tip colour', ar: 'لون الأطراف' }, default: '#3A2A1E' } };
const H = (id, en, ar, description, style, len = 1, tags = []) => registerAsset({ id, slot: 'facialHair', label: { en, ar }, description, tags, style, params: style.none ? {} : FH_PARAMS(len), colors: style.none ? {} : FH_COLORS });

H('facial_none', 'Clean-shaven', 'حليق', 'No facial hair.', { none: true });
H('facial_stubble_01', 'Stubble', 'لحية خفيفة جداً', 'A few days of stubble over the jaw, chin and upper lip (mostly a shadow with very short hairs).', { zones: { moustache: 1, chin: 1, jaw: 1, neck: 0.6 }, length: 0.0018, density: 0.9, shadow: 0.55 });
H('facial_short_beard_01', 'Short beard', 'لحية قصيرة', 'Short, even, trimmed full beard with moustache.', { zones: { moustache: 1, chin: 1, jaw: 1, neck: 0.7 }, length: 0.007, lengthBy: { moustache: 0.8 }, shadow: 0.75 });
H('facial_full_beard_01', 'Full beard', 'لحية كاملة', 'Full beard of medium length connected to the moustache.', { zones: { moustache: 1, chin: 1, jaw: 1, neck: 0.85 }, length: 0.018, lengthBy: { moustache: 0.6, chin: 1.3, neck: 0.8 }, shadow: 0.85 });
H('facial_long_beard_01', 'Long beard', 'لحية طويلة', 'Long full beard hanging onto the chest.', { zones: { moustache: 1, chin: 1, jaw: 1, neck: 0.9 }, length: 0.05, lengthBy: { moustache: 0.35, chin: 1.6, jaw: 1.1, neck: 0.8 }, rep: 'clumps', density: 1.1, shadow: 0.9 }, 1);
H('facial_goatee_01', 'Goatee', 'سكسوكة', 'Chin beard joined to the moustache (circle beard).', { zones: { moustache: 1, chin: 1 }, length: 0.008, shadow: 0.7 });
H('facial_chin_beard_01', 'Chin beard', 'لحية الذقن', 'Beard only on the chin (no moustache).', { zones: { chin: 1 }, length: 0.012, lengthBy: { chin: 1.2 }, shadow: 0.6 });
H('facial_moustache_01', 'Moustache', 'شارب', 'Classic full moustache over the upper lip.', { zones: { moustache: 1 }, length: 0.009, density: 1.5, shadow: 0.6 });
H('facial_handlebar_01', 'Handlebar moustache', 'شارب مفتول', 'Long moustache with ends curled upward.', { zones: { moustache: 1 }, length: 0.016, handlebar: true, density: 1.6, shadow: 0.55 });
H('facial_pencil_01', 'Pencil moustache', 'شارب رفيع', 'Thin, neatly trimmed moustache along the lip.', { zones: { moustache: 0.55 }, length: 0.004, density: 0.8, shadow: 0.4 });
H('facial_chinstrap_01', 'Chin strap', 'لحية خط الفك', 'Narrow beard line along the jaw from ear to ear.', { zones: { jaw: 0.9, chin: 1 }, length: 0.006, density: 1, strap: true, shadow: 0.6 });
H('facial_mutton_chops_01', 'Mutton chops', 'سوالف عريضة', 'Wide sideburns down the cheeks, shaved chin.', { zones: { chops: 1, sideburn: 1 }, length: 0.012, shadow: 0.7 });
H('facial_soul_patch_01', 'Soul patch', 'شعر تحت الشفة', 'Small tuft under the lower lip.', { zones: { soulPatch: 1 }, length: 0.008, shadow: 0.4 });
