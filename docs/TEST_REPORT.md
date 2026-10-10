# Test report — version 1.0.2

Version 1.0.2 · 2026-10-11

**1.0.2:** the site logo and icons are now the Limonat hero's voxel head, rendered by the app's own voxel engine (`npm run logo`). Tests re-run.

**1.0.1:** Arabic text showed with unjoined letters on iPhone (Safari cannot shape the game's Arabic pixel font, Handjet). Arabic now uses Changa (interface) and Kufam (titles); Latin letters and digits keep the Tiny5 pixel font. All tests re-run after the change.

## 1. Summary

| Suite | Result |
|---|---|
| Browser acceptance test, source version (`npm run test:e2e`) | **32 / 32** |
| Browser acceptance test, single-file build (`npm run test:dist`) | **32 / 32** |
| Unit tests (`npm test`) | **20 / 20** |
| Exported GLB, Khronos glTF validator | **0 errors, 0 warnings** (arms-down / −Z and T-pose / +Z) |
| Generated JSON Schema vs. examples (Ajv, draft 2020-12) | valid examples pass, the invalid example fails for the same reasons the app reports |
| Exported character inside the real game (copy of Limonat v1.39) | listed in the Character menu, renders, no console errors |
| Single file opened from disk (`file://`, phone-sized window) | starts, fonts load, import works |
| Game repository | untouched (`git status` clean) |

Environment: Chromium (Playwright 1.56, software WebGL), Node 22, desktop
1300×860 and phone 400×860 viewports. Not yet tried on a physical phone GPU or
in Blender / Unity directly (the GLB was checked with the Khronos validator,
gltf-transform and Three's GLTFLoader).

## 2. Acceptance criteria

| # | Criterion | How it was tested | Result |
|---|---|---|---|
| 1 | App launches | page loads, app object created, no page errors | pass |
| 2 | Default voxel character in 3D | rig with 20 bones and skinned meshes in the scene | pass |
| 3 | Rotate and inspect | mouse drag + wheel move the camera; view presets | pass |
| 4 | Change hairstyle, clothing, colours | tile clicks (hair, top, vest), palette swatch, colour picker, skin colour, proportion slider, material, accessory + attachment point | pass (8 checks) |
| 5 | Copy the AI prompt | clipboard contains the 28,457-character prompt with the catalog | pass |
| 6 | Paste valid JSON → character updates | example document applied | pass |
| 7 | Invalid JSON / unknown ids → clear errors, character kept | broken JSON (line/column message); unknown ids with "Did you mean"; wrong schema version; "apply only valid values"; patch mode | pass (5 checks) |
| 8 | Save, reload, recover | save named design, edit, reopen → identical; duplicate → 2 designs; page reload restores library and last character | pass (5 checks) |
| 9 | Export 3D file + metadata | GLB (validator, 20 joints, 5 materials, 3 clips), metadata JSON, Limonat JS executed against a fake `VR.CHARACTERS`, ZIP, T-pose/+Z GLB | pass (6 checks) |
| 10 | Exported file reopens in a 3D viewer | GLB re-opened with GLTFLoader in the app (20 bones, 3 clips, walk plays); validator; gltf-transform | pass |
| 11 | Documentation for AI models | `docs/AI_WORKFLOW.md`, `docs/SCHEMA.md`, generated `docs/AI_PROMPT.txt`, `docs/ASSET_CATALOG.md`, JSON Schema | done |
| 12 | Path into Limonat | drop-in script loaded in a game copy; classic-script bundle of the compiler tested; `docs/LIMONAT_INTEGRATION.md` | done |
| — | Undo / redo | undo and redo of an accessory move | pass |

Unit tests cover: registry completeness (labels in both languages,
descriptions), every asset on every base and every attachment point compiling
onto the unchanged 20-joint skeleton, **connected arms on every base**,
proportions, T-pose / +Z transforms, the example document, AI wrappers
(fences, extra text, trailing commas, curly quotes), readable JSON errors,
unknown ids / wrong slots / bad colours, clamping, attachment fallback,
schema versions, patch mode, prototype-pollution attempts, list limits, save →
load round trip, prompt / catalog / schema listing every id, the Limonat export
(no voxel lost) and the ZIP writer.

## 3. Issues found and fixed during testing

| Issue | Fix |
|---|---|
| Camera cropped the head on phones | Fit the camera to the character height and the screen aspect, with room for the overlay buttons |
| Hair picker tiles all looked the same under the beanie | Picker thumbnails take off whatever hides the part (hat for hair, jacket for shirts, glasses for eyes) |
| Drag hint overlapped the character | Moved above the pose buttons |
| 5 glTF validator warnings (skinned meshes under a wrapper node) | Export a scene so armature and skinned meshes are root nodes |
| Export buttons hard to target reliably | Stable `data-kind` attributes |
| Arabic letters not joined on iPhone (reported from a real device) | Arabic fonts switched to Changa / Kufam |

## 4. Known limits (for a later version)

| Area | Limit |
|---|---|
| Asset library | 86 parts. Not yet: dresses, long robes, wings, tails, animal ears, helmets, gloves, patterned fabrics (except stripes), hair that comes through a hat. |
| Cloth | Capes, long coats and skirts are rigid and attached to the hips / chest, so they can intersect the legs during big leg movements. |
| In the game | The game animates 6 parts, so elbows and knees are straight in-game (the GLB keeps them). |
| Animation | `idle`, `walk`, `wave` are simple test clips, not production animation. |
| VRM | Bone names and T-pose are VRM-ready; the `VRMC_vrm` extension itself is not written yet. |
| Saving | In the published page, saves go to your Claude account (private, all devices). In a local copy they stay in that browser; use *Download JSON* for backups. |
| Downloads in the published page | The viewer accepts only some file types, so `.glb` and `.js` arrive inside a `.zip` there (the local / single-file version saves them directly). |
| Thumbnails | Rendered on demand per open section; slow phones fill them in over a second or two. |
| AI | No built-in model by design; result quality depends on the external model. |

## 5. How to repeat

```bash
npm install
npm test
npm run test:e2e -- --shots     # screenshots in tests/e2e/screenshots/
npm run test:dist
```
