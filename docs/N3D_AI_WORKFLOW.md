# Image → Normal 3D character with an external AI model

Version 1.0.0 · 2026-10-21 · creator 1.1.0

The creator has no AI built in. Any model that reads images works (ChatGPT,
Gemini, Claude, Copilot, a local vision model…). The Normal 3D mode has its
**own** prompt — the *Normal 3D Image-to-Character AI Prompt* — separate from
the Voxel prompt: different format, ids and parameters.

## 1. Steps

1. Switch to **3D عادي / Normal 3D** at the top of the page.
2. Tab **البرومبت / AI prompt** → **Copy the full prompt**
   (≈ 80 KB: instructions + document structure + every parameter + the asset catalog).
   *Copy without catalog* is shorter for models with small inputs; then also
   paste the catalog (*Copy the catalog*) or attach `docs/N3D_ASSET_CATALOG.md`.
3. Open the AI model, paste the prompt and attach the reference image (or
   describe the character in words).
4. Copy the JSON the model writes.
5. Tab **أوامر AI / AI import** → paste → **Check** (shows errors and
   warnings, applies nothing) → **Replace the character**.
6. Fine-tune anything in *Customize*. Every change can be undone.

The same prompt is in [`docs/N3D_AI_PROMPT.txt`](N3D_AI_PROMPT.txt).

## 2. What the prompt asks the model to do

* Read the **body** (height, build, muscle, fat, widths, limb lengths), the
  **face** (41 shape offsets, eyes, brows, nose, lips, ears, skin tone and
  details), the **hair** (closest of 30 styles, then length, volume, curl,
  parting, fringe, hairline, colours) and the **outfit layer by layer** (base
  top tucked or not, mid layer, outerwear, bottoms, full-body garments,
  footwear), then accessories.
* Report what it saw: a `reference` description, `observations` per area with
  a `confidence` (0–1), and a `confidence` on each garment and accessory.
* List guesses about hidden or unclear parts (feet out of frame, the back of
  the head) in `uncertain`, and visible features nothing in the library can
  reproduce in `unsupported`, with the closest substitute it used.
* Use only catalog ids and only the parameters each item lists; keep numbers
  in range; take colours from the fabric, not its shadow.
* Write only the JSON, no prose. No logos, brand names or copyrighted
  characters.

## 3. Replace or change

| Button | Use it for |
|---|---|
| **Replace the character** | a full description from an image: missing parts get default values |
| **Apply as changes** | a short follow-up: *"make the hair blond and add round glasses"* → the model writes only those fields ([example](../examples/n3d/ai-output-changes.json)); everything else is kept |

## 4. When the model makes mistakes

The importer never crashes and never applies a broken document silently.

* **Errors** (dropped): unknown ids — with *did you mean …?* —, items in the
  wrong list, wrong types, values not offered (e.g. `"fit": "baggy"` lists the
  real fits), colours like `"blue"`, Voxel documents.
* **Warnings** (fixed): numbers clamped to their range, parameters an item does
  not have (the message lists the ones it has), colours normalised, two pairs
  of shoes.
* With errors, nothing is applied; **Apply the valid parts only** applies the
  rest. Try [`examples/n3d/invalid-example.json`](../examples/n3d/invalid-example.json)
  to see the messages. You can also paste the error list back to the model and
  ask it to correct its JSON.
* JSON wrapped in prose or a ```` ```json ```` fence is found automatically.

## 5. What the model could not see or reproduce

After an import, the AI import tab shows **Notes from the model**: what the
reference shows, its observations with confidence values, its guesses, the
features it marked as not supported yet (with what it used instead) and the
items it chose with less than 50 % confidence. These notes stay with the
character (saved, and included in the export metadata), so you know what to
check or adjust by hand.

## 6. Tips

* A full-length, front-facing photo in plain light gives the best body and
  outfit; a close-up adds a better face (send both, or a second prompt with
  *Apply as changes* for the face).
* Ask for `"detail": "high"` for a character you will export.
* Models tend to exaggerate face offsets: values between −0.5 and 0.5 already
  read clearly.
