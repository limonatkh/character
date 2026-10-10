# Adding assets, bases and commands

Version 1.0.0 · 2026-10-10

Registering an asset is the **only** step needed to make it available
everywhere: the Customize pickers, the validator, the AI prompt, the asset
catalog and the JSON Schema all read the registry (`src/core/registry.js`).

## 1. Where assets live

| File | Slots |
|---|---|
| `src/assets/bodies.js` | `bodyType`, `headShape` |
| `src/assets/face.js` | `eyes`, `eyebrows`, `mouth`, `facialHair`, `faceDetail` |
| `src/assets/hair.js` | `hair`, `headwear` |
| `src/assets/clothing.js` | `top`, `outerwear`, `bottom`, `shoes` |
| `src/assets/accessories.js` | `accessory` |
| `src/assets/bases.js` | base characters |
| `src/assets/index.js` | imports the files above; add a new file here |

## 2. Anatomy of an asset

```js
import { registerAsset } from '../core/registry.js';

registerAsset({
  id: 'hair_twintails_01',                 // permanent: lower_snake_case + number
  slot: 'hair',
  label: { en: 'Twin tails', ar: 'ذيلان' },  // shown in the app
  description: 'Two long ponytails tied high on both sides of the head, with hair ties (secondary colour).',
  tags: ['twin tails', 'pigtails', 'anime', 'long'],          // extra hints for AI models
  colors: [
    { key: 'color', label: { en: 'Hair colour', ar: 'لون الشعر' }, default: '#2A1A12' },
    { key: 'secondaryColor', label: { en: 'Hair ties', ar: 'الربطات' }, default: '#E05A47' },
  ],
  build(ctx, it) {
    const H = ctx.m.head, k = it.keys;                // body measurements + palette keys
    // … add boxes (section 3) …
  },
});
```

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Never rename or reuse a released id; add `_02` instead. |
| `slot` | yes | One of the 14 slots. |
| `label.en`, `label.ar` | yes | |
| `description` | yes | English. AI models choose by this text, so describe the **shape**. |
| `tags` | no | Synonyms an AI might use. |
| `colors` | no | 0–2 entries, keys `color` / `secondaryColor`, hex defaults. |
| `material` | no | Default material for clothing, headwear, accessories. |
| `attach` | accessories | `{ points: ['back', 'hand_right'], default: 'back' }` |
| `sides` | face details | `['left', 'right', 'both']` and `defaultSide` |
| `hatInfo(m)` | headwear | `{ lineY, topY, clip: true }` — hair above `lineY` is removed |
| `build(ctx, it)` | yes (not for body types / head shapes) | Adds the voxels. |

## 3. Writing `build(ctx, it)`

Coordinates are voxel px (1 px = 0.084 m), **−Z is the front**, +X is the
character's right, y = 0 at the soles.

| Call | Meaning |
|---|---|
| `ctx.box(joint, x, y, z, w, h, d, key, opts)` | box by its minimum corner |
| `ctx.boxC(joint, cx, y, cz, w, h, d, key)` | centred on x / z, bottom at y |
| `ctx.boxCC(joint, cx, cy, cz, w, h, d, key)` | centred on all axes |
| `ctx.mirror((s, side) => …)` | runs for the character's left (`s = -1`, `side = 'left'`) and right (`s = 1`) |
| `opts.hair: true` | the box is clipped by headwear |
| `ctx.attach(pointId)` | `{ joint, pos }` of an attachment point |
| `ctx.layers.torso / arms / legs / waist` | outermost clothing pad so far (put things on top of clothes) |

`joint` is one of the 20 skeleton joints; choose the one the part moves with
(sleeves on `leftUpperArm` / `leftLowerArm`, a hat on `head`, a belt on `hips`).

Palette keys in `it.keys` (created from the item's colours):

| Key | Look |
|---|---|
| `main`, `sec` | the colour, with ink outline |
| `mainFlat`, `secFlat` | same colour, no outline (small details) |
| `mainShade`, `secShade` | slightly darker, no outline (Limonat side shading) |
| `mainDark`, `secDark` | strong contrast (seams, buttons) |
| `'ink'` | Limonat black line colour |
| `ctx.skin.main` … | the skin colour set |

Measurements in `ctx.m` (all px): `head` (`x0 x1 y0 y1 z0 z1 w h d faceZ eyeY eyeX mouthY browY layers s t`),
`torso` (`w wLow d h y0 y1 yMid`), `arm`, `leg`, `hand`, `foot`, `hipY kneeY ankleY hipX`,
`shoulderX shoulderY elbowY wristY handOffset`. Build from these numbers, never
from fixed coordinates, so the part fits every body type, head shape and proportion.
`head.s` / `head.t` scale face details relative to the Limonat hero's head.

Good references: `hair_ponytail_01` (shell + extra boxes), `outer_vest_open_01`
(open front), `acc_sword_01` (one asset, several attachment points),
`detail_scar_cheek_01` (sides).

## 4. Base characters

A base is a complete character config (same shape as `character` in a save
file) registered with `registerBase({ id, label, description, character })` in
`src/assets/bases.js`. It appears in *Characters → New character from a base*
and in the prompt as a `baseCharacter` choice. The first registered base is
the default.

## 5. New commands / fields

1. Add the field to `src/schema/schema.js` (`FIELD_DOCS`, and `ITEM_FIELDS` or
   `PROPORTIONS` if it belongs there).
2. Read and validate it in `src/schema/validate.js` (`applyCharacter` /
   `applyItem`) and give it a default in `completeConfig`.
3. Use it in the compiler or an asset's `build`.
4. Add it to `buildJsonSchema()` in `src/schema/prompt.js`.
5. Bump the **minor** schema version in `src/core/constants.js` (1.0 → 1.1).

New proportion keys only need step 1 (with min / max / default / doc) and a use
in `src/core/body.js`; the slider, validator, prompt and schema follow.

## 6. Checklist

```bash
npm test          # every asset must compile on every base; arms stay connected
npm run build     # regenerates schema, catalog, prompt, examples, dist/
npm run test:e2e  # optional: browser test
```

Then open the app, find the new part in Customize, and check it from the
front, side and back with the view buttons.
