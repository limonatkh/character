# Normal 3D — adding assets

Version 1.0.0 · 2026-10-11 · creator 1.1.0

As in the Voxel mode, **registering an asset is the only step** needed to make
it available everywhere: the Customize pickers (with search, tags and its own
controls), the validator, the AI prompt, the catalogs, the JSON Schema and the
export metadata all read the Normal 3D registry (`src/n3d/core/registry.js`).
The Normal 3D registry is separate from the Voxel one: ids are never shared.

## 1. Where assets live

| File | Slots |
|---|---|
| `src/n3d/assets/garments.js` | `top`, `mid`, `outer`, `bottom`, `fullBody` |
| `src/n3d/assets/footwear.js` | `footwear` |
| `src/n3d/assets/accessories.js` | `headwear`, `neckwear`, `handwear`, `eyewear`, `jewelry`, `bag`, `belt` |
| `src/n3d/assets/hair.js` | `hairStyle` (strand recipe + hair-mass table `MASS`) |
| `src/n3d/assets/face.js` | `browStyle`, `facialHair` |
| `src/n3d/assets/presets.js` | `preset` (whole characters) |
| `src/n3d/materials/fabrics.js` | fabrics, patterns, hardware finishes (not registry assets, but read the same way) |

## 2. Rules the registry enforces at start-up

* `id`: permanent, `lower_snake_case`, ending in a number (`top_henley_01`).
  Never rename or reuse an id: saved characters and AI output refer to it.
* `label.en` and `label.ar`; a `description` in English — **AI models choose
  assets from it**, so describe what it looks like (cut, length, details).
* `tags`: words people and models search for (`'hoodie', 'kangaroo pocket'`).
* `params`: only the controls that make sense for this item, each with a type
  (`num`, `enm`, `bool`), range / values, default, bilingual label and a `doc`
  sentence (used in the prompt). Defaults must be inside the range.
* `colors`: named channels with an upper-case `#RRGGBB` default.

A broken definition throws at start-up with the asset id in the message, and
the unit tests build every registered asset.

## 3. Garments

Garments are **pattern descriptions**, not meshes. The shared templates
(`upper()`, `lower()`, `skirt()` in `garments.js`) turn parameters into a cut
(torso length, neckline, sleeves, openings, legs, bands, trims, stitching);
the pipeline fits it around the body and the layers below.

```js
G({
  id: 'top_henley_01', slot: 'top', layer: 10,
  label: { en: 'Henley', ar: 'قميص هنلي' },
  description: 'Long-sleeve knit henley with a short three-button placket and ribbed cuffs.',
  tags: ['casual', 'henley', 'buttons', 'knit'],
  fabric: 'cotton_jersey', fabrics: ['cotton_jersey', 'rib_knit', 'linen'], hardware: 'plastic',
  params: { fit: FIT('slim'), length: LEN_TOP(0.6), sleeveLength: SLEEVE(1, 0.5, 1),
            buttons: BUTTONS(3, 0, 4), tucked: TUCK(false) },
  colors: COLORS('#8A7F70', { ...CK.rib('#8A7F70'), ...CK.hardware('#E8E2D6') }),
  build: (p, ctx, a) => upper(p, ctx, a, {
    cuff: 'rib',
    placket: { buttons: p.buttons, bottom: F => F.chestY + 0.02 * F.S, width: 0.024 },
  }),
});
```

* **Layer** (`layer`): 10 base tops · 20 bottoms · 27 full-body · 30 mid ·
  40 outer. Tucked tops are moved under the bottoms automatically; a full-body
  garment with `tucksTops: true` (overalls, jumpsuits) tucks tops into it.
* **Fit** comes from `FIT()`: it changes ease, drape and hang — never scale.
* **Template options** (second argument of `upper` / `lower`): `zip`, `lapels`,
  `openFront`, `hood`, `collar`, `placket`, `buttons`, `cuff` (`rib`, `band`),
  `hemBand`, `lined`, `skirt`, `bottom`, `trims`, `extraEase`… — see the
  existing garments for each one in use.
* **Trims** (`src/n3d/garments/trims.js`): collars, lapels, plackets, buttons,
  zips, pockets (patch, welt, kangaroo, cargo, jeans), waistbands, belt loops,
  drawstrings, hoods, straps, turn-ups. A new trim is a function in `TRIMS`
  that returns parts (meshes) built on the garment's surface.
* **Regions** (`src/n3d/garments/regions.js`) describe where the fabric stops
  (hem, neckline, cuffs, openings, bib). They must stay continuous distance
  bounds — see the comments there.

## 4. Footwear, accessories, hair, faces

* **Footwear** (`F({ … shoe: (p, ctx) => ({ upper, sole, laces, … }) })`):
  a shoe description built by `garments/footwear.js`.
* **Headwear**: `buildHeadwear({ type, … }, ctx)` (cap, beanie, fedora,
  bucket, kufi, hijab, keffiyeh, hood…) — sized to the hair automatically.
* **Worn items** (`accessories/items.js`): glasses, jewellery, watch, belt,
  bags, tie, gloves — built from tubes / sweeps along the body and attached to
  a skeleton point (`attach: 'hand_right'`, `'neck'`, `'head_top'`…).
* **Drapes** (`accessories/drape.js`): scarves, shawls, keffiyeh — cloth
  simulated over the body; parameters choose the wrap.
* **Hairstyles**: `H(id, en, ar, description, tags, recipe, paramDefaults)`
  where the recipe lists strand layers (`clumps`, `strands`, region, length,
  flow, cut, curl…) and extras (ponytail, bun, braid…); add a matching line to
  `MASS` (shell thickness map, fringe, curtain, spikes, bun, flow) for the
  sculpted volume. All hairstyles share the same user controls (`HAIR_PARAMS`).
* **Brows / facial hair**: a growth description (region, density, length,
  direction) in `face.js`.

## 5. Fabrics, patterns, hardware

Add an entry to `FABRICS` (weave, tile size in metres, roughness, sheen,
thickness, stiffness, wrinkle amount), `PATTERNS` (then draw it in
`patternMap()` in `src/n3d/render/textures.js`) or `HARDWARE`. List the fabric
in the `fabrics` of the garments that may use it.

## 6. After adding

```bash
npm run gen                 # schema, catalogs, prompt, examples
node tools/n3d-thumbs.mjs   # picker thumbnails (Chromium, ~2 min)
npm test                    # unit tests build every asset
npm run build               # single-file app in dist/
```

Then check it in the app at every detail level, with the layers it is likely
to be worn with, in the clay and wireframe views.
