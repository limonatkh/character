/* =====================================================================
 * NORMAL 3D — BODY PRESETS AND CHARACTER PRESETS
 * Body presets change only the body parameters. Character presets are
 * complete looks (body, face, hair, outfit, accessories) registered as
 * assets of the 'preset' slot, so they also appear in the AI catalog.
 * ===================================================================== */
import { registerAsset } from '../core/registry.js';

const L = (en, ar) => ({ en, ar });
export const BODY_PRESETS = {
  slim: { label: L('Slim', 'نحيف'), body: { muscle: 0.15, bodyFat: 0.08, shoulderWidth: 0.95, chestWidth: 0.92, waist: 0.86, hipWidth: 0.94, upperArmThickness: 0.85, forearmThickness: 0.88, thighThickness: 0.85, calfThickness: 0.88, neckThickness: 0.9, belly: 0 } },
  average: { label: L('Average', 'متوسط'), body: { muscle: 0.35, bodyFat: 0.25, shoulderWidth: 1, chestWidth: 1, waist: 1, hipWidth: 1, upperArmThickness: 1, forearmThickness: 1, thighThickness: 1, calfThickness: 1, neckThickness: 1, belly: 0 } },
  athletic: { label: L('Athletic', 'رياضي'), body: { muscle: 0.7, bodyFat: 0.12, shoulderWidth: 1.08, chestWidth: 1.06, chestDepth: 1.05, waist: 0.92, hipWidth: 0.98, upperArmThickness: 1.15, forearmThickness: 1.1, thighThickness: 1.12, calfThickness: 1.1, neckThickness: 1.08, belly: 0 } },
  muscular: { label: L('Muscular', 'عضلي'), body: { muscle: 1, bodyFat: 0.18, shoulderWidth: 1.18, chestWidth: 1.15, chestDepth: 1.15, waist: 1.0, hipWidth: 1.0, upperArmThickness: 1.38, forearmThickness: 1.26, thighThickness: 1.3, calfThickness: 1.22, neckThickness: 1.25, belly: 0 } },
  heavy: { label: L('Heavy', 'ممتلئ'), body: { muscle: 0.3, bodyFat: 0.85, shoulderWidth: 1.06, chestWidth: 1.12, chestDepth: 1.2, waist: 1.3, hipWidth: 1.18, upperArmThickness: 1.3, forearmThickness: 1.18, thighThickness: 1.35, calfThickness: 1.2, neckThickness: 1.2, belly: 0.75 } },
  curvy: { label: L('Curvy', 'منحنيات'), body: { masculinity: 0.1, muscle: 0.25, bodyFat: 0.45, bust: 0.6, waist: 0.92, hipWidth: 1.22, glutes: 1.2, thighThickness: 1.18 } },
  petite: { label: L('Petite', 'صغير الحجم'), body: { height: 1.55, shoulderWidth: 0.92, hipWidth: 0.95, handSize: 0.92, footSize: 0.9, headScale: 1.04 } },
  tall: { label: L('Tall', 'طويل'), body: { height: 1.95, legLength: 1.06, armLength: 1.03, torsoLength: 1.02 } },
  elder: { label: L('Elderly', 'مسنّ'), body: { muscle: 0.15, bodyFat: 0.4, belly: 0.35, shoulderWidth: 0.96, neckLength: 0.92 } },
  stylized: { label: L('Stylized (cartoon)', 'منمّق (كرتوني)'), body: { stylization: 0.85, headScale: 1.2 } },
  anime: { label: L('Anime / chibi-ish', 'أنمي'), body: { stylization: 1, headScale: 1.35, legLength: 1.08, height: 1.6 } },
};

const P = (id, en, ar, description, doc, tags = []) => registerAsset({ id, slot: 'preset', label: L(en, ar), description, tags, doc, params: {}, colors: {} });

P('preset_casual_01', 'Casual', 'كاجوال', 'T-shirt, jeans and sneakers.', {
  body: { masculinity: 0.75 }, hair: { styleId: 'hair_crop_01', colors: { root: '#2A1E16', tip: '#3A2A1E' } },
  outfit: [{ assetId: 'top_tshirt_01', colors: { main: '#E9E4D8' } }, { assetId: 'bottom_jeans_01' }, { assetId: 'shoes_sneakers_01' }],
});
P('preset_student_01', 'Student', 'طالب', 'Hoodie, jeans, sneakers, backpack and glasses.', {
  body: { masculinity: 0.4, height: 1.68 }, hair: { styleId: 'hair_bob_01', colors: { root: '#3A2618', tip: '#5A3A22' } },
  outfit: [{ assetId: 'top_tshirt_01' }, { assetId: 'bottom_jeans_01', params: { fit: 'relaxed' } }, { assetId: 'mid_hoodie_01', colors: { main: '#6B2E3A', rib: '#6B2E3A' } }, { assetId: 'shoes_sneakers_01' }],
  accessories: [{ assetId: 'bag_backpack_01' }, { assetId: 'glasses_01', params: { style: 'round' } }],
});
P('preset_business_01', 'Business suit', 'بدلة رسمية', 'Shirt and tie, suit jacket and trousers, dress shoes.', {
  body: { masculinity: 0.85 }, hair: { styleId: 'hair_sidepart_01' }, face: { facialHair: { styleId: 'facial_short_beard_01' } },
  outfit: [{ assetId: 'top_dress_shirt_01', params: { tucked: true }, colors: { main: '#F4F6F9' } }, { assetId: 'bottom_trousers_01', material: { fabric: 'wool_suiting' }, colors: { main: '#2B3242' } }, { assetId: 'outer_blazer_01', colors: { main: '#2B3242' } }, { assetId: 'shoes_dress_01' }],
  accessories: [{ assetId: 'neck_tie_01', colors: { main: '#7A1F2B' } }, { assetId: 'watch_01' }],
});
P('preset_business_02', 'Business (women)', 'رسمي نسائي', 'Blouse, pencil skirt, blazer and loafers.', {
  body: { masculinity: 0.1, height: 1.66 }, hair: { styleId: 'hair_shoulder_01' }, face: { makeup: { lipAmount: 0.55, blush: 0.25 } },
  outfit: [{ assetId: 'top_blouse_01', params: { tucked: true } }, { assetId: 'bottom_skirt_01', params: { style: 'pencil', length: 2 }, colors: { main: '#2F3A4A' } }, { assetId: 'outer_blazer_01', params: { closure: 'open', buttons: 1 }, colors: { main: '#2F3A4A' } }, { assetId: 'shoes_dress_01', params: { style: 'loafer' } }],
  accessories: [{ assetId: 'jewel_earrings_01', params: { style: 'hoop' } }],
});
P('preset_gulf_01', 'Gulf traditional', 'زي خليجي', 'White thobe, ghutra with agal and Arabic sandals.', {
  body: { masculinity: 0.85 }, hair: { styleId: 'hair_crop_01' }, face: { facialHair: { styleId: 'facial_full_beard_01' } },
  outfit: [{ assetId: 'full_thobe_01' }, { assetId: 'shoes_sandals_01', params: { style: 'arabic' } }],
  accessories: [{ assetId: 'head_keffiyeh_01', colors: { main: '#F7F7F4' } }],
});
P('preset_levant_01', 'Shemagh and jacket', 'شماغ وجاكيت', 'Red-and-white shemagh, shirt, jacket and trousers.', {
  body: { masculinity: 0.8 }, hair: { styleId: 'hair_crop_01' }, face: { facialHair: { styleId: 'facial_moustache_01' } },
  outfit: [{ assetId: 'top_dress_shirt_01' }, { assetId: 'bottom_trousers_01', colors: { main: '#3B3B3B' } }, { assetId: 'outer_denim_jacket_01', material: { fabric: 'corduroy' }, colors: { main: '#5A4632' } }, { assetId: 'shoes_dress_01', params: { style: 'derby' } }],
  accessories: [{ assetId: 'head_keffiyeh_01', material: { pattern: 'shemagh' }, colors: { main: '#F7F7F4', secondary: '#B3262B' } }],
});
P('preset_hijab_01', 'Abaya and hijab', 'عباءة وحجاب', 'Black abaya with a hijab and flats.', {
  body: { masculinity: 0.1, height: 1.62 }, hair: { styleId: 'hair_long_straight_01' }, face: { makeup: { lipAmount: 0.45 } },
  outfit: [{ assetId: 'full_abaya_01' }, { assetId: 'shoes_dress_01', params: { style: 'loafer' }, colors: { main: '#1A1412' } }],
  accessories: [{ assetId: 'head_hijab_01', colors: { main: '#2A2A30' } }],
});
P('preset_winter_01', 'Winter', 'شتوي', 'Sweater, parka, jeans, boots, beanie and scarf.', {
  body: { masculinity: 0.6 }, hair: { styleId: 'hair_messy_01' },
  outfit: [{ assetId: 'mid_sweater_01' }, { assetId: 'bottom_jeans_01' }, { assetId: 'outer_parka_01', params: { closure: 'open' } }, { assetId: 'shoes_boots_01' }],
  accessories: [{ assetId: 'hat_beanie_01' }, { assetId: 'neck_scarf_01' }, { assetId: 'gloves_01', params: { knit: true }, colors: { main: '#3A3A3A' } }],
});
P('preset_athlete_01', 'Athlete', 'رياضي', 'Tank top, athletic shorts and running shoes.', {
  body: { masculinity: 0.8, muscle: 0.85, bodyFat: 0.1, shoulderWidth: 1.1 }, hair: { styleId: 'hair_buzz_01' },
  outfit: [{ assetId: 'top_tank_01', material: { fabric: 'polyester_sport' }, colors: { main: '#E14B3B' } }, { assetId: 'bottom_athletic_shorts_01' }, { assetId: 'shoes_running_01' }],
  accessories: [{ assetId: 'watch_01', params: { shape: 'square' }, colors: { strap: '#1E1E1E' } }],
});
P('preset_worker_01', 'Worker', 'عامل', 'Coveralls, boots, cap and gloves.', {
  body: { masculinity: 0.85, muscle: 0.55 }, hair: { styleId: 'hair_crop_01' }, face: { facialHair: { styleId: 'facial_stubble_01' } },
  outfit: [{ assetId: 'full_coveralls_01' }, { assetId: 'shoes_boots_01', params: { style: 'combat' } }],
  accessories: [{ assetId: 'hat_cap_01', colors: { main: '#E8A33B' } }, { assetId: 'gloves_01' }],
});
P('preset_summer_01', 'Summer dress', 'فستان صيفي', 'Floral sleeveless dress, sandals and sunglasses.', {
  body: { masculinity: 0.05, height: 1.64 }, hair: { styleId: 'hair_long_wavy_01', colors: { root: '#6A4A2A', tip: '#B58A5A' } },
  outfit: [{ assetId: 'full_dress_01', params: { length: 2.2 }, material: { pattern: 'floral' }, colors: { main: '#F4E6C9', secondary: '#D9576B', accent: '#5A8AD9' } }, { assetId: 'shoes_sandals_01' }],
  accessories: [{ assetId: 'glasses_01', params: { style: 'cateye', tint: 0.85 } }, { assetId: 'hat_bucket_01', colors: { main: '#E8DCC0' } }],
});
P('preset_stylized_01', 'Stylized hero', 'بطل كرتوني', 'Stylized proportions, bomber jacket, cargo trousers and boots.', {
  body: { stylization: 0.9, headScale: 1.2, masculinity: 0.7 }, face: { eyeSize: 0.6 }, hair: { styleId: 'hair_spiky_01', colors: { root: '#2B2B2B', tip: '#2B2B2B' } },
  outfit: [{ assetId: 'top_tshirt_01', colors: { main: '#F2D16B' } }, { assetId: 'bottom_cargo_01' }, { assetId: 'outer_bomber_01', params: { closure: 'open' }, colors: { main: '#2F4A6B' } }, { assetId: 'shoes_boots_01', params: { style: 'combat' } }],
});
