/* Unit tests for the Normal 3D mode (no browser needed):  npm test
 * Registry, documents, validator, prompt / schema, and the build pipeline:
 * every garment, shoe, accessory, hairstyle and facial-hair style builds
 * without errors, with sane skin weights and the feet on the ground. */
import test from 'node:test';
import assert from 'node:assert/strict';
import '../../src/n3d/assets/index.js';
import { allAssets, listAssets, getAsset, SLOTS } from '../../src/n3d/core/registry.js';
import { createN3DDocument, completeN3D, N3D_FORMAT } from '../../src/n3d/core/document.js';
import { BONES, ATTACH_POINTS } from '../../src/n3d/core/skeleton.js';
import { validateN3D, LIMITS } from '../../src/n3d/schema/validate.js';
import { buildN3DPrompt, buildN3DJsonSchema, buildN3DCatalogJson, exampleN3D, N3D_CATALOG_ORDER } from '../../src/n3d/schema/prompt.js';
import { buildCharacter } from '../../src/n3d/build/character.js';
import { FABRICS, PATTERNS } from '../../src/n3d/materials/fabrics.js';

const clone = v => JSON.parse(JSON.stringify(v));
const HEX = /^#[0-9A-F]{6}$/i;
const cache = new Map();
const build = over => buildCharacter(createN3DDocument(over), { cache, detail: 'standard' });

// ------------------------------------------------------------------ registry
test('Normal 3D registry: ids, labels, params and colours are well formed', () => {
  const ids = new Set();
  assert.ok(allAssets().length >= 100, 'at least 100 assets');
  for (const slot of N3D_CATALOG_ORDER) assert.ok(listAssets(slot).length > 0, `slot ${slot} has assets`);
  for (const a of allAssets()) {
    assert.ok(!ids.has(a.id), `unique id ${a.id}`); ids.add(a.id);
    assert.match(a.id, /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/);
    assert.ok(SLOTS[a.slot], `${a.id} has a known slot`);
    assert.ok(a.label.en && a.label.ar, `${a.id} has en + ar labels`);
    assert.ok(a.description && a.description.length > 5, `${a.id} has a description`);
    for (const [k, p] of Object.entries(a.params || {})) {
      if (p.type === 'enum') assert.ok(p.values.includes(p.default), `${a.id}.${k} default in values`);
      else if (p.type === 'bool') assert.equal(typeof p.default, 'boolean');
      else assert.ok(p.min <= p.default && p.default <= p.max, `${a.id}.${k} default in range`);
    }
    for (const [k, c] of Object.entries(a.colors || {})) assert.match(c.default, HEX, `${a.id}.colors.${k}`);
    for (const f of a.fabrics || []) assert.ok(FABRICS[f], `${a.id} fabric ${f} exists`);
  }
});

// ------------------------------------------------------------------ documents + validator
test('default document, the example and every preset validate cleanly', () => {
  assert.equal(validateN3D(createN3DDocument()).ok, true);
  const ex = validateN3D(exampleN3D());
  assert.equal(ex.ok, true, ex.errors.map(e => e.path + ' ' + e.message).join('; '));
  for (const p of listAssets('preset')) {
    const r = validateN3D({ format: N3D_FORMAT, version: '1.0', mode: 'normal3d', ...clone(p.doc) });
    assert.equal(r.ok, true, `${p.id}: ${r.errors.map(e => e.path + ' ' + e.message).join('; ')}`);
  }
});

test('validator: errors, suggestions, clamping, colour normalisation', () => {
  const r = validateN3D({ mode: 'normal3d', body: { height: 3, muscle: 'x' }, hair: { styleId: 'hair_spikey_01' }, outfit: [{ assetId: 'top_hawaiian_99' }, { assetId: 'bottom_jeans_01', params: { fit: 'baggy' }, colors: { main: 'abc' } }] });
  assert.equal(r.ok, false);
  const msg = r.errors.map(e => `${e.path}: ${e.message}`).join('\n');
  assert.match(msg, /body\.muscle/);
  assert.match(msg, /did you mean "hair_spiky_01"/);
  assert.match(msg, /top_hawaiian_99/);
  assert.match(msg, /outfit\[1\]\.params\.fit/);
  assert.ok(r.warnings.some(w => w.path === 'body.height' && /clamped/.test(w.message)));
  assert.equal(r.doc.body.height, 2.05);
  assert.equal(r.doc.outfit.length, 1, 'only the valid item is kept');
  assert.equal(r.doc.outfit[0].colors.main, '#AABBCC', 'short hex normalised');
});

test('validator: merge mode keeps the base, voxel documents are refused, text with fences is accepted', () => {
  const base = createN3DDocument({ meta: { name: 'Base' } });
  const m = validateN3D({ hair: { colors: { root: '#112233' } } }, { mode: 'merge', base });
  assert.equal(m.ok, true);
  assert.equal(m.doc.meta.name, 'Base');
  assert.equal(m.doc.outfit.length, base.outfit.length);
  assert.equal(m.doc.hair.colors.root, '#112233');
  const v = validateN3D({ mode: 'voxel', character: { name: 'x' } });
  assert.equal(v.ok, false);
  const t = validateN3D('Here you go:\n```json\n' + JSON.stringify(exampleN3D()) + '\n```');
  assert.equal(t.ok, true);
  const lim = validateN3D({ outfit: Array.from({ length: LIMITS.outfit + 3 }, () => ({ assetId: 'top_tshirt_01' })) });
  assert.ok(lim.doc.outfit.length <= LIMITS.outfit);
});

test('AI notes: reference, observations with confidence, guesses and unsupported features are kept and checked', () => {
  const r = validateN3D({
    mode: 'normal3d',
    outfit: [{ assetId: 'top_tshirt_01', confidence: 0.3 }, { assetId: 'bottom_jeans_01', confidence: 7 }],
    reference: { description: 'Photo, front view', framing: 'upper', style: 'photo' },
    observations: [{ area: 'hair', note: 'short black crop', confidence: 0.9 }, 'wears a watch', { area: 'tail', note: 'x', confidence: 'high' }, { area: 'face' }],
    uncertain: ['feet hidden: chose sneakers', { field: 'outfit[1]', note: 'legs cropped', confidence: -1 }],
    unsupported: [{ feature: 'Embroidered logo', closestSubstitute: 'none' }, 'cape with fur trim', 42],
  });
  assert.equal(r.ok, true, 'notes never block a document');
  const ai = r.doc.ai;
  assert.deepEqual(ai.reference, { description: 'Photo, front view', framing: 'upper' }, 'unknown style dropped');
  assert.equal(ai.observations.length, 3, 'observation without a note dropped');
  assert.deepEqual(ai.observations[1], { area: 'other', note: 'wears a watch' });
  assert.equal(ai.observations[2].area, 'other', 'unknown area → other');
  assert.equal(ai.observations[2].confidence, undefined, 'non-numeric confidence dropped');
  assert.equal(ai.uncertain[1].confidence, 0, 'confidence clamped');
  assert.deepEqual(ai.unsupported.map(u => u.feature), ['Embroidered logo', 'cape with fur trim']);
  assert.equal(r.doc.outfit[0].confidence, 0.3);
  assert.equal(r.doc.outfit[1].confidence, 1, 'item confidence clamped');
  for (const path of ['reference.style', 'observations[2].area', 'observations[2].confidence', 'observations[3]', 'uncertain[1].confidence', 'unsupported[2]', 'outfit[1].confidence'])
    assert.ok(r.warnings.some(w => w.path === path), `warning for ${path}`);
  // the notes survive completeN3D (saves, exports) and merges that do not mention them
  assert.deepEqual(completeN3D(r.doc).ai.unsupported, ai.unsupported);
  const m = validateN3D({ hair: { colors: { root: '#222222' } } }, { mode: 'merge', base: r.doc });
  assert.deepEqual(m.doc.ai.unsupported, ai.unsupported);
  const m2 = validateN3D({ unsupported: ['new thing'] }, { mode: 'merge', base: r.doc });
  assert.deepEqual(m2.doc.ai.unsupported, [{ feature: 'new thing' }]);
  // the example shows the model how to write them; the prompt and schema describe them
  const ex = validateN3D(exampleN3D());
  assert.ok(ex.doc.ai.observations.length && ex.doc.ai.unsupported.length && ex.doc.ai.uncertain.length);
  assert.equal(ex.warnings.length, 0, ex.warnings.map(w => w.path + ' ' + w.message).join('; '));
  const prompt = buildN3DPrompt({ includeCatalog: false }), schema = buildN3DJsonSchema();
  for (const k of ['reference', 'observations', 'uncertain', 'unsupported', 'confidence']) assert.ok(prompt.includes(k), `prompt explains ${k}`);
  for (const k of ['reference', 'observations', 'uncertain', 'unsupported']) assert.ok(schema.properties[k], `schema has ${k}`);
});

test('completeN3D never throws and always returns a full document', () => {
  for (const junk of [null, 5, 'x', [], { body: 7 }, { outfit: [1, null, { assetId: 3 }] }, { face: { eyes: 'blue' } }]) {
    const d = completeN3D(junk);
    assert.equal(d.format, N3D_FORMAT);
    assert.ok(d.body && d.face && d.skin && d.hair && Array.isArray(d.outfit));
  }
});

// ------------------------------------------------------------------ prompt, schema, catalog
test('prompt, catalog and schema list every asset id and fabric', () => {
  const prompt = buildN3DPrompt({ includeCatalog: true }), schema = JSON.stringify(buildN3DJsonSchema()), cat = JSON.stringify(buildN3DCatalogJson());
  for (const a of allAssets().filter(x => N3D_CATALOG_ORDER.includes(x.slot))) {
    assert.ok(prompt.includes(a.id), `prompt lists ${a.id}`);
    assert.ok(schema.includes(`"${a.id}"`), `schema lists ${a.id}`);
    assert.ok(cat.includes(`"${a.id}"`), `catalog lists ${a.id}`);
  }
  for (const f of Object.keys(FABRICS)) assert.ok(prompt.includes(f), `prompt lists fabric ${f}`);
  for (const p of Object.keys(PATTERNS)) assert.ok(prompt.includes(p), `prompt lists pattern ${p}`);
  assert.ok(prompt.length < 120000, 'prompt stays a reasonable size');
});

// ------------------------------------------------------------------ build pipeline
function checkResult(name, res) {
  assert.deepEqual(res.errors, [], `${name}: build errors ${JSON.stringify(res.errors)}`);
  assert.ok(res.meshes.length > 5, `${name}: has meshes`);
  for (const m of res.meshes) {
    const g = m.geometry; if (!g || !g.index || !g.index.length) continue;
    const n = g.position.length / 3;
    for (let i = 0; i < g.position.length; i++) if (!Number.isFinite(g.position[i])) assert.fail(`${name}/${m.id}: NaN position`);
    for (let i = 0; i < g.index.length; i++) if (g.index[i] >= n) assert.fail(`${name}/${m.id}: index out of range`);
    if (g.skinWeight) {
      for (let v = 0; v < n; v += Math.max(1, (n / 500) | 0)) {
        const s = g.skinWeight[v * 4] + g.skinWeight[v * 4 + 1] + g.skinWeight[v * 4 + 2] + g.skinWeight[v * 4 + 3];
        if (Math.abs(s - 1) > 0.02) assert.fail(`${name}/${m.id}: weights sum ${s}`);
        for (let k = 0; k < 4; k++) if (g.skinIndex[v * 4 + k] >= BONES.length) assert.fail(`${name}/${m.id}: bad bone index`);
      }
    }
  }
}

test('default character builds: skeleton, ground contact, stable mesh ids', () => {
  const res = build({});
  checkResult('default', res);
  assert.equal(Object.keys(res.rig.joints).filter(k => BONES.some(b => b.name === k)).length, BONES.length, 'every bone has a joint');
  assert.ok(res.groundOffset >= 0 && res.groundOffset < 0.06, 'soles lift the body a little');
  const ids = res.meshes.map(m => m.id);
  assert.equal(new Set(ids).size, ids.length, 'mesh ids are unique');
  assert.ok(ids.includes('skin_body') && ids.includes('skin_head') && ids.includes('eye_left'));
  const again = build({});
  assert.deepEqual(again.meshes.map(m => m.id), ids, 'ids are stable between builds');
  assert.ok(Object.keys(ATTACH_POINTS).length >= 19);
});

test('every garment and every pair of footwear builds', { timeout: 900000 }, () => {
  for (const slot of ['top', 'mid', 'outer', 'bottom', 'fullBody', 'footwear']) {
    for (const a of listAssets(slot)) {
      const outfit = slot === 'footwear' ? [{ assetId: a.id }] : slot === 'bottom' ? [{ assetId: 'top_tshirt_01' }, { assetId: a.id }] : [{ assetId: a.id }];
      const res = build({ outfit });
      checkResult(a.id, res);
      assert.ok(res.meshes.some(m => m.assetId === a.id), `${a.id} produced geometry`);
    }
  }
});

test('every accessory, hairstyle, brow style and facial-hair style builds', { timeout: 900000 }, () => {
  for (const slot of ['headwear', 'neckwear', 'eyewear', 'jewelry', 'handwear', 'bag', 'belt']) {
    for (const a of listAssets(slot)) {
      const res = build({ accessories: [{ assetId: a.id }] });
      checkResult(a.id, res);
      assert.ok(res.meshes.some(m => m.assetId === a.id), `${a.id} produced geometry`);
    }
  }
  for (const a of listAssets('hairStyle')) checkResult(a.id, build({ hair: { styleId: a.id } }));
  for (const a of listAssets('facialHair')) checkResult(a.id, build({ face: { facialHair: { styleId: a.id } } }));
  for (const a of listAssets('browStyle')) checkResult(a.id, build({ face: { brows: { styleId: a.id } } }));
});

test('presets and extreme bodies build', { timeout: 900000 }, () => {
  for (const p of listAssets('preset')) checkResult(p.id, build(clone(p.doc)));
  checkResult('extreme', build({ body: { height: 2.05, muscle: 1, bodyFat: 1, belly: 1, stylization: 1, headScale: 1.4 }, outfit: [{ assetId: 'outer_coat_01' }, { assetId: 'bottom_trousers_01', params: { fit: 'oversized' } }] }));
  checkResult('petite', build({ body: { height: 1.45, masculinity: 0, muscle: 0, bodyFat: 0 }, outfit: [{ assetId: 'full_dress_01', params: { length: 3 } }] }));
});

// ------------------------------------------------------------------ posing: garments follow the skeleton
test('posed garments do not tear: sleeves follow their arm, trouser legs their leg, bags the body', { timeout: 900000 }, async () => {
  const THREE = await import('three');
  const { makeSkeleton, applyPose } = await import('../../src/n3d/render/skeleton3.js');
  const outfits = [
    exampleN3D(),
    { hair: { styleId: 'hair_long_straight_01' }, outfit: [{ assetId: 'top_tshirt_01' }, { assetId: 'bottom_jeans_01' }, { assetId: 'shoes_sneakers_01' }, { assetId: 'mid_hoodie_01' }, { assetId: 'outer_coat_01' }], accessories: [{ assetId: 'neck_scarf_01' }] },
  ];
  for (const doc of outfits) {
    const res = buildCharacter(createN3DDocument(clone(doc)), { detail: 'standard' });
    const sk = makeSkeleton(res.rig.joints);
    applyPose(sk, 'walk', 0.6); sk.root.updateMatrixWorld(true);
    const M = sk.bones.map((b, i) => new THREE.Matrix4().multiplyMatrices(b.matrixWorld, sk.skeleton.boneInverses[i]));
    const v = new THREE.Vector3(), acc = new THREE.Vector3(), tmp = new THREE.Vector3();
    for (const m of res.meshes) {
      const g = m.geometry; if (!g || !g.index || !g.skinIndex || !['garment', 'accessory'].includes(m.kind)) continue;
      const n = g.position.length / 3, Q = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        v.set(g.position[i * 3], g.position[i * 3 + 1], g.position[i * 3 + 2]); acc.set(0, 0, 0);
        for (let k = 0; k < 4; k++) { const w = g.skinWeight[i * 4 + k]; if (w) { tmp.copy(v).applyMatrix4(M[g.skinIndex[i * 4 + k]]); acc.addScaledVector(tmp, w); } }
        Q[i * 3] = acc.x; Q[i * 3 + 1] = acc.y; Q[i * 3 + 2] = acc.z;
      }
      const L = (A, a, b) => Math.hypot(A[a * 3] - A[b * 3], A[a * 3 + 1] - A[b * 3 + 1], A[a * 3 + 2] - A[b * 3 + 2]);
      let worst = 0;
      for (let t = 0; t < g.index.length; t += 3) for (const [a, b] of [[g.index[t], g.index[t + 1]], [g.index[t + 1], g.index[t + 2]], [g.index[t + 2], g.index[t]]]) worst = Math.max(worst, L(Q, a, b) - L(g.position, a, b));
      assert.ok(worst < 0.1, `${m.id}: an edge stretches ${worst.toFixed(3)} m in the walk pose`);
    }
  }
});
