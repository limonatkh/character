# Character document — schema 1.0

Version 1.0.0 · 2026-10-10

One JSON format is used everywhere:

| Use | Who writes it |
|---|---|
| AI command document | an external AI model, from a reference image |
| Saved character (`*.character.json`) | the app (*Characters → Download JSON*) |
| Export metadata (`*.character.json` in the export) | the app, plus an `export` section |

Machine-readable versions: `schema/character.schema.json` (JSON Schema draft
2020-12, asset id enums included) and `schema/asset-catalog.json`. Both are
generated from the asset registry (`npm run gen`). Valid ids are listed in
[ASSET_CATALOG.md](ASSET_CATALOG.md).

## 1. Top level

```json
{
  "schemaVersion": "1.0",
  "mode": "replace",
  "baseCharacter": "base_classic_block",
  "reference": { "description": "…", "source": "photo" },
  "character": { … },
  "uncertain":   [{ "field": "character.clothing.shoes", "note": "feet out of frame" }],
  "unsupported": [{ "feature": "logo on the shirt", "closestSubstitute": "none" }]
}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `schemaVersion` | `"1.0"` | yes | Major version must be 1. A newer minor version is accepted with a warning; unknown fields are ignored. |
| `mode` | `"replace"` \| `"patch"` | no (default `replace`) | `replace`: start from the base character and apply every given field. `patch`: change only the given fields of the character currently open. |
| `baseCharacter` | base id | no | Base to start from in `replace` mode. Default: the base of the current character. |
| `reference.description` | string ≤ 600 | no | What the reference image shows. Shown in the app under *the model's notes*. |
| `reference.source` | `photo` `cartoon` `anime` `game` `drawing` `other` | no | Kind of image. |
| `character` | object | yes | The customization (section 2). |
| `uncertain` | list ≤ 20 of strings or `{field, note}` | no | What the AI had to guess. |
| `unsupported` | list ≤ 20 of strings or `{feature, closestSubstitute}` | no | Visible features no asset can show, and what was used instead. |
| `kind`, `id`, `meta` | — | no | Written by the app in save files (`kind: "limonat-character"`, a stable `id`, timestamps). |

## 2. `character`

Every field is optional in a command document: omitted fields keep the base
(or current) value. Save files always contain every field.

| Field | Type | Notes |
|---|---|---|
| `name` | string ≤ 40 | Display name. |
| `body.typeId` | bodyType id | `body_toon_01` (Limonat proportions, stick limbs, mitten hands) or `body_block_01` (classic blocky human). |
| `body.skinColor` | `"#RRGGBB"` | Skin / body colour. |
| `body.proportions` | object | Multipliers, 1 = normal (table below). Values outside the range are clamped with a warning. |
| `head.shapeId` | headShape id | `head_round_01`, `head_block_01`, `head_tall_01`. |
| `hair` | `{ assetId, color, secondaryColor? }` | `hair_none` = bald / hidden. |
| `headwear` | `{ assetId, color, secondaryColor?, material? }` | `hat_none` = no hat. Hats clip the hair under them automatically. |
| `face.eyes` | `{ styleId, color, gaze }` | `gaze`: `center` `left` `right` `up` `down`. |
| `face.eyebrows` | `{ styleId, color }` | |
| `face.mouth` | `{ styleId }` | Mouths have no colour. |
| `face.facialHair` | `{ assetId, color }` | `facialhair_none` = none. |
| `face.details` | list ≤ 6 of `{ assetId, color?, side? }` | Blush, freckles, scars… `side` only for details that list sides: `left` `right` `both`. |
| `clothing.top` | `{ assetId, color, secondaryColor?, material? }` | Shirt. `top_none` = bare torso. |
| `clothing.outerwear` | same | Jacket / vest / hoodie / coat over the top. `outer_none` = none. |
| `clothing.bottom` | same | Trousers / shorts / skirt. |
| `clothing.shoes` | same | `shoes_none` = barefoot. |
| `accessories` | list ≤ 6 of `{ assetId, attachTo?, color?, secondaryColor?, material? }` | `attachTo` must be one of the points listed for that accessory; omit for its default. One entry per accessory + point. |

Proportions (`character.body.proportions`):

| Key | Min | Max | Meaning |
|---|---|---|---|
| `headScale` | 0.8 | 1.35 | head size (1.3 = chibi) |
| `torsoWidth` | 0.8 | 1.3 | shoulder / waist width |
| `torsoLength` | 0.85 | 1.2 | torso height |
| `armLength` | 0.85 | 1.2 | arm length |
| `legLength` | 0.75 | 1.25 | leg length (0.8 = child, 1.2 = tall) |
| `limbThickness` | 0.75 | 1.35 | arm and leg thickness |

Value rules:

| Kind | Rule |
|---|---|
| Ids | Must exist in the registry **and** belong to that slot (a shoe id cannot be a top). |
| Colours | `"#RRGGBB"`. `"#RGB"` is expanded with a warning. Stored upper-case. A colour key the chosen asset does not have is ignored with a note. |
| Materials | `cloth` `denim` `leather` `plastic` `metal` `emissive`. Only on headwear, clothing and accessories. |
| Left / right | Always the **character's own** left / right. |
| Changing an asset | Colours / material not given in the same item reset to the new asset's defaults. |

## 3. Validation results

The validator (`src/schema/validate.js`) treats the input as untrusted data:
it only reads known properties and copies validated values into a fresh
character. Nothing is executed and prototype keys are never copied.

| Level | Examples | Effect |
|---|---|---|
| **error** | not JSON, unsupported major version, unknown id, id from another slot, malformed colour, non-number proportion, missing `character` | The import is rejected and the current character is kept. The user may choose *Apply only the valid values* (each invalid field is skipped). |
| **warning** | Markdown fences or text around the JSON removed, trailing commas removed, unknown property ignored, number clamped, unknown attachment point / gaze / material replaced, too many list entries | Applied with the fallback shown in the message. |
| **info** | the AI's `uncertain` and `unsupported` notes, colours for a colour slot the asset lacks | Shown only. |

Unknown ids get a suggestion: `"hair_spikey_01" is not a hair asset in this
app. Did you mean "hair_spiky_01" …? Available: …`.

## 4. Save files

```json
{
  "schemaVersion": "1.0",
  "kind": "limonat-character",
  "id": "chr_lq3k9x2a7f",
  "baseCharacter": "base_limonat_hero",
  "character": { "name": "Limonat Hero", "body": { … }, … every field … },
  "meta": { "createdAt": "…", "updatedAt": "…", "generator": "Limonat Character Creator 1.0.0" }
}
```

Opening a save file runs the same validator, so an edited or older file is
checked exactly like AI output.

## 5. Export metadata

The exported `*.character.json` is the save document plus:

| `export.` field | Meaning |
|---|---|
| `files` | names of the GLB and Limonat script, the Limonat character id |
| `units`, `voxelSize`, `heightMeters` | metres; 1 voxel = 0.084 m (Limonat's `VR.CHARACTER_PX`) |
| `restPose` | `armsDown` (Limonat) or `tpose` |
| `facing` | `-Z` (Limonat) or `+Z` (glTF / VRM) |
| `shading` | `flat` (unlit, baked face shading like the game) or `pbr` |
| `animations` | clip names in the GLB |
| `skeleton` | the 20 joints: name, parent, Limonat part, rest position (metres) |
| `attachmentPoints` | id → joint and the empty node name (`attach_<id>`) in the GLB |
| `assetsUsed` | every asset id the character uses |

## 6. Versioning

* `schemaVersion` changes **minor** (1.1, 1.2…) when fields or enum values are
  added. Old documents stay valid; old apps ignore the new fields with a warning.
* It changes **major** (2.0) only if a field is renamed, removed or changes
  meaning. The app then rejects other majors with a clear message.
* Asset ids are permanent once released. To replace a part, add a new id
  (`hair_spiky_02`) and keep the old one.
