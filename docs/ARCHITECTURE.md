# Architecture

Version 1.0.0 · 2026-10-10

## 1. Technology choice

| Decision | Why |
|---|---|
| Plain JavaScript ES modules, no framework, no build step for the source | Same approach as Limonat (plain JS + Three.js), easy to read and extend, runs from any static server. |
| Three.js r158 (vendored) | The exact revision Limonat uses (`lib/three.min.js`), so geometry, colours and materials behave the same. Includes `GLTFExporter` / `GLTFLoader` for real GLB files. |
| Characters as voxel boxes | Limonat's own format: every character is boxes `[x, y, z, w, h, d, colour]` in "px" units. The creator produces the same boxes, so the game can use them directly. |
| GLB (glTF 2.0) for 3D export | The standard interchange format: Blender, Unity, Godot, three.js, Babylon, online viewers, and the base format of VRM avatars. |
| esbuild only for packaging | `npm run build` bundles everything into one offline HTML file; development needs no tooling. |

## 2. Data flow

```
asset files ──register──▶ REGISTRY ──▶ UI pickers, validator, prompt, catalog, JSON Schema
                                │
AI JSON / save file ──▶ VALIDATOR ──▶ character config ──▶ STORE (undo/redo) ◀── manual edits
                                                              │
                                                              ▼
                                                 COMPILER (pure data)
                                         joints + boxes + palette + attachments
                                       ┌──────────────┼───────────────┐
                                       ▼              ▼               ▼
                                3D preview      GLB exporter    Limonat exporter
                              (Three.js rig)   (+ metadata)    (VR.CHARACTERS entry)
```

Every consumer works from the same compiled model, so the preview, the GLB and
the game file always agree.

## 3. Modules

| Folder | Responsibility | Uses Three.js |
|---|---|---|
| `src/core/` | constants, colour helpers, skeleton + attachment points, body measurements, asset registry, compiler, rest-pose / facing transforms, character document | no |
| `src/assets/` | the asset library (one file per family) | no |
| `src/schema/` | schema constants, validator, prompt / catalog / JSON Schema generators | no |
| `src/render/` | rigged mesh builder, viewer, poses + animation clips, thumbnail renderer | yes |
| `src/export/` | GLB + metadata, Limonat script, ZIP writer, file saving | GLB only |
| `src/storage/` | saved-character library (claude.ai account store or localStorage) | no |
| `src/ui/` | panels, store, i18n, DOM helpers | no |

`core`, `assets` and `schema` have no browser or Three.js dependency: they run
in Node (unit tests, generators) and can be reused by the game or by a future
recording app.

## 4. Coordinate system (same as Limonat)

| Item | Value |
|---|---|
| Unit | 1 voxel "px" = 0.084 m (`VR.CHARACTER_PX`) |
| Up | +Y, feet at y = 0 |
| Front | **−Z** (face, running direction) |
| Character's right | +X |
| Ink outline | 0.32 px, colour `#161616`, drawn around every box whose colour is outlined |
| Shading | unlit vertex colours with baked face shading (top 1.0, sides 0.85, bottom 0.6) × 1.1 brightness |

The GLB exporter can turn the character to **+Z** (glTF / VRM convention) and
switch to a **T-pose**; both are exact 90°/180° transforms of the voxel boxes
(`src/core/transform.js`), and the animation clips are converted with them.

## 5. Skeleton

20 joints, identical for every character; assets only add boxes to joints and
can never add, rename or remove one. Names are the **VRM humanoid** bone names,
the standard for VTuber avatars and webcam motion capture.

| Joint | Parent | Limonat part |
|---|---|---|
| hips | — | body |
| spine | hips | body |
| chest | spine | body |
| neck | chest | body |
| head | neck | head |
| leftEye, rightEye, jaw | head | head |
| leftUpperArm → leftLowerArm → leftHand | chest | armL |
| rightUpperArm → rightLowerArm → rightHand | chest | armR |
| leftUpperLeg → leftLowerLeg → leftFoot | hips | legL |
| rightUpperLeg → rightLowerLeg → rightFoot | hips | legR |

Arms are **normal connected arms**: shoulder → elbow → wrist → hand, each with
its own voxels (a unit test checks that no hand floats). Eyes have their own
joints so a future app can blink or look around; the mouth sits on `jaw`.

Attachment points (`attach_<id>` empty nodes in the GLB): `head_top`, `face`,
`neck`, `chest`, `back`, `waist`, `hip_left`, `hip_right`, `wrist_left`,
`wrist_right`, `hand_left`, `hand_right`. Their positions are computed after
clothing is built, so a backpack sits on the jacket, not inside it.

## 6. Body measurements and fitting

`src/core/body.js` turns *body type × head shape × proportions* into numbers
(torso width, leg length, shoulder position, head box, eye line…) and joint
positions. Every asset builds against those numbers, so one hairstyle fits all
head shapes and one jacket fits both body types and every proportion. Clothing
is layered by "pad" (distance from the body): skin < top 0.12 < outerwear 0.3,
and headwear tells hair where to stop (`hatInfo`).

## 7. The compiled model

```js
{
  joints:      [{ name, parent, pos: [x, y, z] }],          // rest pose, absolute px
  boxes:       [{ joint, x, y, z, w, h, d, key }],          // min corner, absolute px
  palette:     { key: { hex, material, outline } },         // Limonat-style named colours
  attachments: { pointId: { joint, pos: [x, y, z] } },
  height, assets: [ids used], measurements
}
```

Each coloured part gets named palette keys (`top`, `topShade`, `topDark`,
`top2`…), exactly like Limonat palettes (`skin`, `shade`, `ink`, …).

## 8. Rendering and the GLB

`src/render/mesh.js` builds a real rig: one `THREE.Bone` per joint, one
`SkinnedMesh` per material type with every vertex weighted 100 % to its joint
(rigid voxel parts work in every engine), and an "ink" `SkinnedMesh` that is the
inverted hull of all outlined boxes (reversed winding, so the outline also
shows in ordinary glTF viewers). The preview uses the same function.

The GLB contains: the armature (root node `Armature` → `hips` …), the skinned
meshes as root nodes, materials (`KHR_materials_unlit` for the flat look, or
PBR roughness / metalness), the attachment empties, optional clips `idle`,
`walk`, `wave`, and the character info in the scene `extras`. It validates
with the Khronos glTF validator with 0 errors and 0 warnings.

## 9. Application state

| Piece | File | Notes |
|---|---|---|
| Store | `src/ui/store.js` | Current document + undo/redo (120 steps). `commit` = one step, `preview` = live update while dragging, `replace` = import / open / new. Manual and AI changes go through the same store. |
| Library | `src/storage/library.js` | Saved designs. In the published claude.ai page: the viewer's private `data/users/<id>/` collection (follows the account across devices). Elsewhere: localStorage. Same interface, files (.json) in both. |
| Thumbnails | `src/render/thumbs.js` | One shared off-screen WebGL renderer and a time-budgeted queue; picker tiles show each option on the current character, rendered only for open sections. |

## 10. Security

AI output and opened files are untrusted. They are parsed with `JSON.parse`
only, validated property by property into a new object (prototype keys such as
`__proto__` are never copied), and every string reaches the page through
`textContent`. No `eval`, no `innerHTML` with data, no dynamic imports from data.
