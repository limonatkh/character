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
