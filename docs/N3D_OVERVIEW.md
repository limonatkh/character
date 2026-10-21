# Normal 3D mode — overview

Version 1.0.0 · 2026-10-21 · creator 1.1.0 · document format `limonat-character-3d` 1.0

The creator now has **two independent creation modes** in one page:

| | Voxel | Normal 3D |
|---|---|---|
| Characters | Limonat's voxel boxes (20-bone rig) | Smooth realistic or stylized meshes (55-bone rig) |
| Document | `limonat-character` (schema 1.0) | `limonat-character-3d` 1.0 — separate format, separate ids |
| AI prompt | *Image-to-Character AI Prompt* | *Normal 3D Image-to-Character AI Prompt* |
| Library | voxel saves | Normal 3D saves (same account / browser, kept apart) |
| Export | GLB + `*.limonat.js` (voxel entry) | GLB + metadata + document + `*.limonat-n3d.js` |

Nothing is shared between the two except the page, the language, the visual style,
the file-saving helpers and the storage backend. A Voxel document pasted into the
Normal 3D importer (or the other way round) is recognised and refused with a
message that offers to switch modes.

## 1. Switching modes

The switch is at the top of the page, next to the logo: **مكعّبات | 3D عادي**
(*Voxel | Normal 3D*). On phones it shows two icons (▦ voxel, ● normal 3D).
The choice is remembered per browser. Each mode keeps its own character, undo
history, open tab and saved characters; switching never discards work.

## 2. What a Normal 3D character is made of

Every character is generated from the document by a real geometry pipeline (no
pre-made meshes are scaled or swapped):

| Part | How it is built |
|---|---|
| Body | Signed-distance anatomy (torso, pelvis, limbs, hands with five fingers, feet) from 29 body parameters, meshed with adaptive octree dual contouring: finer on the face and hands. |
| Head and face | 41 independent face parameters (head shape, forehead, jaw, cheekbones, chin, eyes, brows, nose, lips, ears); real eyeballs with iris / pupil textures, eyelids and lashes; skin colour, undertone, roughness, freckles, moles, wrinkles, blemishes, stubble, scars and makeup painted into the face texture. |
| Hair | A **sculpted hair mass** (the hairstyle's real volume and silhouette: height, sides, fringe, long hair falling over the back and resting on the shoulders, spikes, locks) with a strand texture that follows the combing direction, **plus** strand layers lying on it (flattened clumps, fine strands, flyaways) and tied extras (ponytails, buns, braids, cornrows, afro volume). 30 styles. |
| Facial hair and brows | Thousands of individual hairs grown on the skin (13 facial-hair styles, 10 brow styles with 8 brow controls). |
| Clothes | Each garment is cut from a pattern description (hem, neckline, sleeves, openings) around the body **and the layers under it**, with a fit that changes its real volume (tight → oversized), drape, folds and wrinkles, fabric thickness, ribbed bands, seams, stitching and trims (collars, lapels, plackets, buttons, zips, pockets, waistbands, belt loops, drawstrings, hoods, straps). 37 garments. |
| Footwear | Uppers fitted to the foot, real soles, tongues, laces with bows, eyelets, overlays; 6 shoes with styles. |
| Accessories | Hats (brims and crowns sized to the hair), hijab, keffiyeh with agal, raised hood, glasses, jewellery, watch, gloves, belt, bags, tie; scarves and shawls simulated as cloth that falls over the body. 22 items. |
| Materials | PBR fabrics (25 fabrics with weave normal maps, sheen, roughness), 14 patterns besides plain (stripes, checks, plaid, houndstooth, camo, floral, shemagh, colour blocking…), wear / fading, 6 hardware finishes, leather, rubber, glass, metal. |
| Rig | 55 bones with VRM humanoid names, skin weights for every mesh, 19 attachment points. |

## 3. Interface

* **Viewport:** orbit (drag), pan (two fingers / right button), zoom (wheel / pinch);
  views *front, side, back, ¾, face, upper body, hand, feet*; display modes
  *materials, clay, wireframe / topology, normals, UV checker, material slots*;
  lighting *studio, daylight, warm indoor, dramatic, flat*;
  poses *A-pose, relaxed, idle, walk, wave, T-pose* on the real skeleton; spin.
  A chip shows the build stage while the character is rebuilt in the background.
* **Customize** — sections *Body, Face, Hair, Upper body, Lower body, Full body,
  Footwear, Accessories, Materials, Advanced*. Asset pickers have search, tag
  filters and thumbnails. Every worn item opens to **only its own controls**
  (a T-shirt shows fit, length, sleeves, neckline, hem width, tucked, rolled
  sleeves; trousers show fit, rise, leg length, leg opening, cuff…), its colours
  and its fabric, pattern, pattern size, wear and hardware. Items can be moved
  a layer in or out.
* **Body presets** (slim, average, athletic, muscular, heavy, curvy, petite,
  tall, elderly, stylized, anime) and **12 character presets** are starting
  points: everything stays editable.
* **Characters** — save, save a copy, open, duplicate, rename, delete,
  **compare** (a saved character beside the current one), download / import JSON,
  new character. Saves follow your Claude account in the published page.
* **AI prompt / AI import** — the Normal 3D prompt (with the asset catalog,
  copy buttons, schema and catalog downloads); the importer checks the JSON,
  replaces the character or applies changes, and shows the model's notes:
  what it observed with confidence values, its guesses, and features it could
  not reproduce. See [N3D_AI_WORKFLOW.md](N3D_AI_WORKFLOW.md).
* **Undo / redo** for every change (Ctrl+Z / Ctrl+Shift+Z, or the arrows).
* **Advanced** — detail level, statistics, random character, and the full
  document as editable JSON.

## 4. Detail levels

| Level | Mesh cells (body / face / hands) | Garments | Hair | Textures | Use |
|---|---|---|---|---|---|
| Standard | 11 / 3.2 / 3.2 mm | 10 mm | mass 4.5 mm, base strand density | 512 px | editing (default) |
| High | 8 / 2.3 / 2.5 mm | 7 mm | mass 3.2 mm, full density, fine strands at the hairline, buttonholes | 1024 px | exports |
| Advanced | 6 / 1.8 / 2 mm | 5 mm | mass 2.5 mm, maximum density, individual strands, stitching as geometry | 2048 px | close-ups, offline renders |

The export panel can export at a different level than the one used for editing.
A default character at standard detail is about 250 000 triangles (a layered
outfit with long hair about 430 000). Building runs in a background worker, so
the page stays usable, and each edit rebuilds only what changed. Measured in
the test container (2 shared virtual CPUs, while a browser test was running):
first build 13 s; a colour or fabric change 0.04 s; one garment 6 s; long hair
9 s; a body change (everything is refitted) 15 s.

## 5. Limits (what is not done)

* Cloth is **fitted**, not simulated, except scarves / shawls / keffiyeh
  (position-based cloth simulation). Garments do not swing when posed.
* Layering is handled by fitting each layer over the ones below; extreme
  combinations (an oversized puffer over a coat over a hoodie) can still show
  small intersections.
* Poses in the viewer and the exported clips (idle, walk, wave) are procedural;
  garments follow the skeleton through skin weights (no corrective shapes).
* Hair is a sculpted mass + strand geometry, not a groom of individual
  simulated hairs; it does not move with physics.
* No logos or brand marks are generated (patterns are generic).
* A character at standard detail is heavy for a phone game (≈250 k triangles);
  see [N3D_LIMONAT_INTEGRATION.md](N3D_LIMONAT_INTEGRATION.md) for the game
  path and its costs.
