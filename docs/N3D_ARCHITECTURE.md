# Normal 3D mode — architecture

Version 1.0.0 · 2026-10-21 · creator 1.1.0

## 1. How the two modes share one app

```
index.html ─ #app (Voxel, src/main.js)          #app3d (Normal 3D, src/n3d/ui/app.js — loaded on first use)
                 │                                   │
src/main.js  ModeHost.show(mode) ── shows one app, pauses the other's renderer, remembers the mode
```

| Shared (safe, mode-neutral) | Separate (never mixed) |
|---|---|
| page shell, CSS design system, fonts, logo | stores, documents, undo histories |
| `src/ui/dom.js`, `i18n.js` (language) , `modes.js` (the switch) | registries and asset ids (`src/core/registry.js` vs `src/n3d/core/registry.js`) |
| `src/export/download.js`, `zip.js` (file saving) | validators, prompts, catalogs, JSON Schemas |
| `src/storage/library.js` (one class, two namespaces: records carry `kind: 'n3d'`) | viewers, renderers, exporters |
| Three.js r158 (vendored) | panels and strings (`src/n3d/ui/*`) |

The Voxel code is unchanged apart from: the mode switch in its top bar, a
`pause()/resume()` on its viewer, keyboard shortcuts only while it is visible,
the library namespace option, and its importer recognising Normal 3D documents.

## 2. Data flow

```
asset files ─register─▶ N3D REGISTRY ─▶ pickers · validator · prompt · catalog · JSON Schema · thumbnails
                                  │
AI JSON / file / UI ─▶ validateN3D ─▶ document (limonat-character-3d) ─▶ N3DStore (undo/redo)
                                                                          │
                                         BuildClient ─postMessage─▶ build WORKER: buildCharacter(doc)
                                                                          │   (stage cache, geometry diff)
                                   viewer (Three.js scene, skeleton, poses) ◀── result: meshes + material descriptions + rig
                                                                          │
                                       exporter ─▶ GLB · metadata · document · Limonat registration · ZIP
```

AI notes (`reference`, `observations` with confidence, `uncertain`,
`unsupported`) and item `confidence` values pass through the same validator
(`cleanAiNotes` in `core/document.js`), are stored in the document as `ai`, never
affect the geometry, and are shown in the AI import tab and written to exports.

The pipeline (`src/n3d/build/character.js`) is pure JavaScript on typed arrays:
it runs in a Web Worker (the page stays responsive), in the page as a fallback,
and in Node (unit tests, thumbnails, generated docs).

## 3. Pipeline stages (all cached by content hash)

| Stage | Module | Output |
|---|---|---|
| Rig | `anatomy/rig.js` | 55 joint positions from height, proportions, limb lengths |
| Anatomy | `anatomy/body.js`, `anatomy/head.js`, `sdf/field.js` | smooth primitives combined with smooth min/max; two fields: `field` (exact near the skin, for meshing) and `farField` (exact up to 16 cm: garments, hair and accessories sit on it) |
| Skin | `build/skin.js`, `mesh/octree.js` | adaptive dual-contoured mesh (fine on the face / hands), UVs, region tags (lips, nails…), skin weights |
| Garments | `garments/*` | per item, in layer order: cut → fit field → mesh → bands / panels / seams → trims → weights; each layer becomes the "body" of the next (`stackField`) |
| Footwear | `garments/footwear.js` | uppers, soles, laces, overlays around the feet; sets the ground offset |
| Hair | `hair/mass.js`, `hair/engine.js`, `hair/scalp.js` | sculpted mass + strand layers + extras, resting on clothes |
| Accessories | `accessories/*` | headwear (sized to the hair), worn items, cloth-simulated drapes |
| Face | `face/features.js`, `face/facialhair.js` | eyes, lids, lashes, brows, facial hair |
| Hidden surfaces | `build/character.js` | skin under opaque clothes and under a hair mass removed |

A change rebuilds only the stages whose inputs changed (colours: nothing;
one garment: that garment and the layers above it; body: everything).

## 4. Key techniques

* **Signed distance fields.** Every shape (body, garments, hair volume, hats)
  is a distance function. Functions are kept *continuous and ≤ ~1.3-Lipschitz*
  (a distance bound), because the octree prunes cells by distance: drapes are
  normalised by their own slope (`lipNorm`), region cuts by their widening
  rate, and far-field distances are exact where clothes sit.
* **Garment = fit field + region.** `F = smin(U − ease, drapes)` where `U` is
  what is underneath (body or the previous layer's solid) and drapes are hulls
  measured on the body (torso hang, per-leg hulls, sleeve tubes, skirt hull).
  The region (hem, neckline, cuffs, openings, bib…) clips the mesh exactly
  along its zero line; bands, panels and seams split the mesh exactly too.
  Fit (`skinTight … oversized`) changes ease, hang and drape volume — never a
  scale.
* **Hair mass.** A thickness map over the scalp (top / sides / back / nape /
  front / quiff / crown, undercut step, parting crease), a fringe slab, a
  hollow long-hair hull measured around the head and body (face opening,
  layered and V/U cuts), spikes or locks as rounded cones, buns — meshed like
  the body, textured with flow-aligned UVs. Strand layers grow on a closed,
  crease-free version of it.
* **Drapes** (scarf, shawl, keffiyeh): position-based cloth simulation with
  collisions against the body and clothes, pinned where they are tied.
* **Rendering:** MeshPhysicalMaterial (sheen, clearcoat, anisotropy for hair),
  procedural textures in metres (weaves, patterns, hair strands, iris, face),
  image-based studio light.

## 5. Module map (`src/n3d/`)

| Folder | Modules |
|---|---|
| `core/` | `registry.js` (asset registration + param specs), `params.js` (body / face tables), `document.js` (format, defaults, `completeN3D`), `skeleton.js` (55 bones, attachment points), `detail.js` (detail levels) |
| `sdf/`, `mesh/` | distance-field primitives and grid acceleration; octree dual contouring; mesh clip / split / boundary loops; nearest / raycast queries; geometry toolkit; skin weights |
| `anatomy/` | rig, body and head primitives, region tags |
| `garments/` | body frame + measurements, regions, fit fields, cuts, shell meshing, trims, footwear |
| `hair/` | scalp + hairline, hair mass, strand engine |
| `face/` | eyes, lids, lashes, brows, facial hair |
| `accessories/` | headwear, worn items, draped items, shared helpers |
| `materials/` | fabrics, patterns, hardware, garment material slots |
| `assets/` | the library: garments, footwear, accessories, hair, face, presets, thumbnails |
| `build/` | pipeline, skin, worker, client |
| `render/` | Three.js scene, textures, face painter, skeleton + poses, viewer |
| `schema/` | validator, prompt / catalog / JSON Schema generators |
| `export/` | GLB, metadata, Limonat registration file, README, ZIP |
| `ui/` | app shell, store, controls, customize, panels, strings |

## 6. Coordinates and units

Metres, +Y up, the character faces −Z (+X is the character's right), feet on
y = 0 (soles included), rest pose = relaxed A-pose (arms about 40° below
horizontal), bone orientations = identity in the rest pose. The GLB can also
be exported facing +Z (glTF convention).
