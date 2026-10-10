/* Base characters (presets). Each is a complete character config in the same
 * format the AI produces and the save files use. Add new bases here. */
import { registerBase } from '../core/registry.js';

const P = (o = {}) => ({ headScale: 1, torsoWidth: 1, torsoLength: 1, armLength: 1, legLength: 1, limbThickness: 1, ...o });

registerBase({
  id: 'base_limonat_hero',
  label: { en: 'Limonat hero', ar: 'بطل ليمونات' },
  description: 'The Limonat hero (white toon body, black beanie, white tuft, big round eyes), with normal connected arms.',
  character: {
    name: 'Limonat Hero',
    body: { typeId: 'body_toon_01', skinColor: '#F4F3EF', proportions: P() },
    head: { shapeId: 'head_round_01' },
    hair: { assetId: 'hair_tuft_01', color: '#F7F7F5' },
    face: {
      eyes: { styleId: 'eyes_round_big_01', color: '#161616', gaze: 'left' },
      eyebrows: { styleId: 'brows_none', color: '#2A211C' },
      mouth: { styleId: 'mouth_dash_01' },
      facialHair: { assetId: 'facialhair_none', color: '#2B2118' },
      details: [],
    },
    headwear: { assetId: 'hat_beanie_01', color: '#161616', material: 'cloth' },
    clothing: {
      top: { assetId: 'top_vneck_01', color: '#F4F3EF', material: 'cloth' },
      outerwear: { assetId: 'outer_none' },
      bottom: { assetId: 'bottom_shorts_01', color: '#F0EFEB', material: 'cloth' },
      shoes: { assetId: 'shoes_sneakers_01', color: '#F4F3EF', secondaryColor: '#B4B9C5', material: 'cloth' },
    },
    accessories: [],
  },
});

registerBase({
  id: 'base_classic_block',
  label: { en: 'Classic block human', ar: 'إنسان مكعبات كلاسيكي' },
  description: 'Blocky human with normal proportions; a neutral starting point for realistic people.',
  character: {
    name: 'Block Human',
    body: { typeId: 'body_block_01', skinColor: '#D6A078', proportions: P() },
    head: { shapeId: 'head_block_01' },
    hair: { assetId: 'hair_short_01', color: '#3A2A1E' },
    face: {
      eyes: { styleId: 'eyes_block_01', color: '#3B2A1E', gaze: 'center' },
      eyebrows: { styleId: 'brows_flat_01', color: '#2A211C' },
      mouth: { styleId: 'mouth_smile_01' },
      facialHair: { assetId: 'facialhair_none', color: '#2B2118' },
      details: [],
    },
    headwear: { assetId: 'hat_none' },
    clothing: {
      top: { assetId: 'top_tshirt_01', color: '#3B82C4', material: 'cloth' },
      outerwear: { assetId: 'outer_none' },
      bottom: { assetId: 'bottom_pants_straight_01', color: '#2E3A55', material: 'denim' },
      shoes: { assetId: 'shoes_sneakers_01', color: '#F2F2F2', secondaryColor: '#C9CDD4', material: 'cloth' },
    },
    accessories: [],
  },
});

registerBase({
  id: 'base_chibi',
  label: { en: 'Chibi', ar: 'تشيبي' },
  description: 'Cute chibi proportions: very big head, short body and legs, anime eyes.',
  character: {
    name: 'Chibi',
    body: { typeId: 'body_toon_01', skinColor: '#FFD9B8', proportions: P({ headScale: 1.25, torsoLength: 0.9, armLength: 0.9, legLength: 0.8, limbThickness: 1.15 }) },
    head: { shapeId: 'head_round_01' },
    hair: { assetId: 'hair_bob_01', color: '#2A1A12' },
    face: {
      eyes: { styleId: 'eyes_anime_01', color: '#4A7BD0', gaze: 'center' },
      eyebrows: { styleId: 'brows_flat_01', color: '#2A1A12' },
      mouth: { styleId: 'mouth_cat_01' },
      facialHair: { assetId: 'facialhair_none', color: '#2B2118' },
      details: [{ assetId: 'detail_blush_01', color: '#F29AA5' }],
    },
    headwear: { assetId: 'hat_none' },
    clothing: {
      top: { assetId: 'top_tshirt_01', color: '#FFD83A', material: 'cloth' },
      outerwear: { assetId: 'outer_none' },
      bottom: { assetId: 'bottom_shorts_01', color: '#5B6EE1', material: 'cloth' },
      shoes: { assetId: 'shoes_sneakers_01', color: '#FFFFFF', secondaryColor: '#E05A47', material: 'cloth' },
    },
    accessories: [],
  },
});
