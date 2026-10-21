# Normal 3D characters in Limonat

Version 1.0.0 · 2026-10-11 · creator 1.1.0 · checked against Limonat v1.44 (`limonatkhi`, commit 4ab5bb1)

The game repository was only read for this; nothing in it was changed. This
document describes how an exported Normal 3D character can be used by the game
and what that would cost. (Voxel characters: see
[LIMONAT_INTEGRATION.md](LIMONAT_INTEGRATION.md).)

## 1. What the game does with characters today

| Fact (v1.44) | Where |
|---|---|
| Classic `<script>` files, no bundler; Three.js r158 as `lib/three.min.js` (global `THREE`), **no GLTFLoader** | `index.html` |
| Characters are entries of `VR.CHARACTERS` `{ id, name, tagline, model, palette, outline, fpArms? }`; the menu lists them | `js/character.js`, `js/game.js`, `js/ui.js` |
| `VR.buildCharacter(def)` returns `{ root, inner, parts: { legL, legR, body, head, armL, armR }, def }`, feet at y = 0, facing −Z | `js/character.js` |
| The game animates only `parts.X.rotation` (arms hang down at 0) and `inner.rotation / position` | `js/player.js`, `js/duel/duel.js` (`DuelBody.animate`) … |
| First person builds a copy of the entry whose arms are `def.fpArms` (voxel boxes) and reads `def.model.armR.boxes` | `js/missions/fpcontroller.js` |
| Duels, challenges and mini-games build characters by id through the same `VR.buildCharacter` | `js/duel/*.js`, `js/challenge/challenge.js`, `js/mini/*.js` |
| `VR.toneCharacter` tints materials marked `userData.hero` (grey team) | `js/character.js` |

Voxel characters are 2.09 m tall (`PX` = 0.084 m); a Normal 3D character is
its real height (1.45–2.05 m).

## 2. The integration kit (in this repository)

| File | What it does |
|---|---|
| `integration/limonat/three-gltf-loader.js` (45 KB) | Three.js r158's GLTFLoader as a classic script: sets `THREE.GLTFLoader` |
| `integration/limonat/limonat-n3d.js` (runtime 1.1.0) | `LimonatN3D.register(def)` adds the character to `VR.CHARACTERS` and loads its GLB; it wraps `VR.buildCharacter` so that a Normal 3D entry returns the **same rig shape** (`root`, `inner`, `parts`), whose six parts are rotation handles mapped onto the skeleton every frame |
| `<name>.limonat-n3d.js` (from the export) | one line: `LimonatN3D.register({ id, name, glb, height })` |
| `<name>.glb` (from the export) | the skinned character |

Mapping of the game's parts to bones: `legL/legR → left/rightUpperLeg`,
`body → spine`, `head → head`, `armL/armR → left/rightUpperArm` (the exported
rest pose is an A-pose; the runtime lowers the arms so that rotation 0 hangs
straight down, as the game expects). `inner` moves the whole model (crouch,
lean). `rig.attach.hand_right` etc. are the GLB's attachment points for held
items.

### Installing (when you decide to)

1. Copy `three-gltf-loader.js` to `lib/` and `limonat-n3d.js` to `js/`.
2. Copy each exported `<name>.glb` to `characters/` and `<name>.limonat-n3d.js` to `js/characters/`.
3. In `index.html`, after `js/character.js`:
   ```html
   <script src="lib/three-gltf-loader.js"></script>
   <script src="js/limonat-n3d.js"></script>
   <script src="js/characters/<name>.limonat-n3d.js"></script>
   ```
4. Optional, before the registration files:
   `LimonatN3D.configure({ material: 'lambert', height: 2.09 })`.

No other game file has to change.

## 3. What works and what stays voxel

| Feature | Normal 3D character |
|---|---|
| Character menu, runner, third-person views, duels, mini-games | the skinned model, animated through the six parts |
| First-person hands | voxel arms of the fallback character (`voxelFallback` id, default the first character) — the runtime copies its `model`, `palette`, `fpArms` into the entry so the first-person code is unchanged |
| Weapon placement in duels (`def.model.armR.pivot`) | the fallback's voxel pivot: guns sit where a voxel hand would be |
| Grey team tone (`VR.toneCharacter`) | not applied (only voxel hero materials are tinted) |
| Exported clips (idle, walk, wave) | in the GLB, not used by the game (it animates parts itself) |
| Outline effect | voxel only |

The GLB loads asynchronously: the rig is returned at once and the model
appears when loading finishes (`LimonatN3D.isReady(id)`).

## 4. Performance

Measured exports (GLB with textures, skeleton and the three clips):

| Detail | T-shirt, jeans, sneakers, short hair | blouse, trousers, blazer, bag, long wavy hair |
|---|---|---|
| Standard | 246 k triangles · 9.4 MB | 426 k · 15.2 MB |
| High (export default) | 414 k · 14.4 MB | 736 k · 25 MB |
| Advanced | 667 k · 23 MB | — |

The exported voxel hero is about 1 500 triangles. On phones a Normal 3D
character at standard detail is heavy, especially with several on screen:
duel bots and opponents pick their characters from the same `VR.CHARACTERS`
list, so a registered Normal 3D character can appear on them too.
Recommended for the game: export at *standard*, use `material: 'lambert'`,
and consider a decimation step (e.g. `gltf-transform simplify`) for a mobile
build. Textures are capped at 2048 px (512 px at standard, 1024 px at high).

## 5. For the future recording app

The GLB is a standard skinned glTF 2.0 (VRM bone names, 55 bones, 19
attachment points, `extras.limonatCharacter3D` with the full creator
document), so it is meant to load in any glTF 2.0 tool (three.js `GLTFLoader` +
`AnimationMixer`, Blender, game engines with a glTF importer) with its clips.
Tested: Three's GLTFLoader (the clips play), the Khronos validator and
gltf-transform; not yet opened in Blender or a game engine.
