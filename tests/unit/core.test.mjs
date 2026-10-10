/* Unit tests for the pure modules (no browser needed):  npm test  */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import '../../src/assets/index.js';
import { allAssets, listAssets, listBases, SLOT_IDS, getAsset } from '../../src/core/registry.js';
import { JOINT_NAMES, JOINTS } from '../../src/core/skeleton.js';
import { compile } from '../../src/core/compile.js';
import { toTPose, toFacingPlusZ } from '../../src/core/transform.js';
import { newDocument, loadDocument, finalizeDocument } from '../../src/core/document.js';
import { baseConfig, validateText, validateDocument, extractJson, completeConfig } from '../../src/schema/validate.js';
import { buildPrompt, buildCatalogJson, buildJsonSchema, exampleDocument } from '../../src/schema/prompt.js';
import { PROPORTIONS } from '../../src/schema/schema.js';
import { toLimonatDef, toLimonatScript } from '../../src/export/limonat.js';
import { makeZip, crc32 } from '../../src/export/zip.js';

const clone = v => JSON.parse(JSON.stringify(v));

// ------------------------------------------------------------------ registry
test('every asset is registered with labels, description and a slot', () => {
  assert.ok(allAssets().length >= 80);
  for (const slot of SLOT_IDS) assert.ok(listAssets(slot).length > 0, `slot ${slot} has assets`);
  for (const a of allAssets()) {
    assert.match(a.id, /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/);
    assert.ok(a.label.en && a.label.ar, `${a.id} has en + ar labels`);
    assert.ok(a.description.length > 10, `${a.id} has a description`);
  }
});

test('base characters validate with no errors or warnings', () => {
  for (const b of listBases()) {
    const r = validateDocument({ schemaVersion: '1.0', baseCharacter: b.id, character: clone(b.character) });
    assert.equal(r.errors.length, 0, `${b.id}: ${r.errors.map(e => e.message)}`);
    assert.equal(r.warnings.length, 0, `${b.id}: ${r.warnings.map(e => e.message)}`);
  }
});

// ------------------------------------------------------------------ compiler / skeleton
function compileWith(base, slot, a) {
  const c = baseConfig(base);
  const set = {
    bodyType: () => { c.body.typeId = a.id; }, headShape: () => { c.head.shapeId = a.id; },
    hair: () => { c.hair = { assetId: a.id }; }, headwear: () => { c.headwear = { assetId: a.id }; },
    eyes: () => { c.face.eyes = { styleId: a.id }; }, eyebrows: () => { c.face.eyebrows = { styleId: a.id }; }, mouth: () => { c.face.mouth = { styleId: a.id }; },
    facialHair: () => { c.face.facialHair = { assetId: a.id }; }, faceDetail: () => { c.face.details = [{ assetId: a.id, side: 'both' }]; },
    top: () => { c.clothing.top = { assetId: a.id }; }, outerwear: () => { c.clothing.outerwear = { assetId: a.id }; },
    bottom: () => { c.clothing.bottom = { assetId: a.id }; }, shoes: () => { c.clothing.shoes = { assetId: a.id }; },
    accessory: () => { c.accessories = [{ assetId: a.id }]; },
  };
  set[slot]();
  return compile(completeConfig(c));
}

test('every asset compiles on every base, on the standard skeleton', () => {
  for (const b of listBases()) for (const a of allAssets()) {
    const pts = a.attach ? a.attach.points : [null];
    for (const p of pts) {
      const m = compileWith(b.id, a.slot, a);
      if (p) { const c = baseConfig(b.id); c.accessories = [{ assetId: a.id, attachTo: p }]; compile(completeConfig(c)); }
      assert.deepEqual(m.joints.map(j => j.name), JOINT_NAMES, 'joint list never changes');
      for (const box of m.boxes) {
        assert.ok(JOINT_NAMES.includes(box.joint));
        assert.ok(box.w > 0 && box.h > 0 && box.d > 0);
        assert.ok(m.palette[box.key], `palette has ${box.key}`);
      }
    }
  }
});

test('arms are normal connected arms (shoulder → elbow → wrist → hand, no floating hands)', () => {
  for (const b of listBases()) {
    const m = compile(baseConfig(b.id));
    const pos = Object.fromEntries(m.joints.map(j => [j.name, j.pos]));
    for (const side of ['left', 'right']) {
      const boxes = j => m.boxes.filter(x => x.joint === side + j);
      const up = boxes('UpperArm'), low = boxes('LowerArm'), hand = boxes('Hand');
      assert.ok(up.length && low.length && hand.length, `${b.id} ${side}: upper arm, forearm and hand all have voxels`);
      const minY = l => Math.min(...l.map(x => x.y)), maxY = l => Math.max(...l.map(x => x.y + x.h));
      assert.ok(maxY(low) >= minY(up) - 0.01, `${b.id} ${side}: forearm reaches the upper arm`);
      assert.ok(maxY(hand) >= minY(low) - 0.01, `${b.id} ${side}: hand reaches the forearm`);
      assert.ok(maxY(up) >= pos[side + 'UpperArm'][1] - 0.01, `${b.id} ${side}: upper arm reaches the shoulder`);
      // the arm hierarchy is chained
      const parent = n => JOINTS.find(j => j.name === n).parent;
      assert.equal(parent(side + 'Hand'), side + 'LowerArm');
      assert.equal(parent(side + 'LowerArm'), side + 'UpperArm');
    }
  }
});

test('proportions change the skeleton but never the joint names', () => {
  const c = baseConfig('base_limonat_hero');
  const a = compile(c);
  c.body.proportions.legLength = PROPORTIONS.legLength.max;
  c.body.proportions.armLength = PROPORTIONS.armLength.max;
  const b = compile(c);
  assert.deepEqual(a.joints.map(j => j.name), b.joints.map(j => j.name));
  assert.ok(b.height > a.height);
});

test('T-pose and +Z transforms move the arms / turn the character', () => {
  const m = compile(baseConfig('base_classic_block'));
  const t = toTPose(m);
  const hand = mm => mm.joints.find(j => j.name === 'rightHand').pos;
  assert.ok(hand(t)[0] > hand(m)[0] + 2, 'right hand moves out to +X in T-pose');
  assert.ok(Math.abs(hand(t)[1] - m.joints.find(j => j.name === 'rightUpperArm').pos[1]) < 0.01, 'hand at shoulder height');
  const z = toFacingPlusZ(m);
  assert.equal(z.joints.find(j => j.name === 'rightHand').pos[0], -hand(m)[0]);
});

// ------------------------------------------------------------------ validator
test('the generated example document is valid', () => {
  const r = validateDocument(exampleDocument());
  assert.equal(r.errors.length, 0);
  assert.ok(r.ok && r.applied > 10);
});

test('AI wrappers are stripped: fences, text around the JSON, trailing commas, curly quotes', () => {
  const r1 = validateText('Here you go:\n```json\n{"schemaVersion":"1.0","character":{"name":"A"}}\n```\nEnjoy!');
  assert.ok(r1.ok); assert.equal(r1.config.name, 'A');
  const r2 = extractJson('{"schemaVersion":"1.0","character":{"name":"B",},}');
  assert.equal(r2.error, null); assert.ok(r2.notes.some(n => /trailing/.test(n)));
  const r3 = extractJson('{“schemaVersion”:“1.0”,“character”:{}}');
  assert.equal(r3.error, null);
});

test('broken JSON gives a readable error with a line number', () => {
  const r = validateText('{\n "schemaVersion": "1.0",\n "character": { "hair": \n}');
  assert.equal(r.ok, false);
  assert.match(r.errors[0].message, /not valid JSON/);
});

test('unknown ids, bad colours and wrong slots are errors with suggestions', () => {
  const r = validateDocument({ schemaVersion: '1.0', character: { hair: { assetId: 'hair_spikey_01', color: 'red' }, clothing: { top: { assetId: 'shoes_boots_01' } } } });
  assert.equal(r.ok, false);
  const msgs = r.errors.map(e => e.message).join('\n');
  assert.match(msgs, /Did you mean "hair_spiky_01"/);
  assert.match(msgs, /hex colour/);
  assert.match(msgs, /cannot be used as top/);
});

test('out-of-range numbers are clamped with a warning; unknown keys are ignored with a warning', () => {
  const r = validateDocument({ schemaVersion: '1.0', character: { body: { proportions: { headScale: 9, wings: 2 } }, superpower: 'flight' } });
  assert.ok(r.ok);
  assert.equal(r.config.body.proportions.headScale, PROPORTIONS.headScale.max);
  assert.ok(r.warnings.some(w => w.path === 'character.superpower'));
  assert.ok(r.warnings.some(w => w.path === 'character.body.proportions.wings'));
});

test('an invalid attachment point falls back to the default with a warning', () => {
  const r = validateDocument({ schemaVersion: '1.0', character: { accessories: [{ assetId: 'acc_sword_01', attachTo: 'tail' }] } });
  assert.ok(r.ok);
  assert.equal(r.config.accessories[0].attachTo, getAsset('acc_sword_01').attach.default);
});

test('unsupported schema versions are rejected', () => {
  assert.equal(validateDocument({ schemaVersion: '2.0', character: {} }).ok, false);
});

test('patch mode keeps everything that is not mentioned', () => {
  const current = baseConfig('base_chibi');
  const r = validateDocument({ schemaVersion: '1.0', mode: 'patch', character: { hair: { color: '#FF0000' } } }, { current });
  assert.equal(r.config.hair.color, '#FF0000');
  assert.equal(r.config.hair.assetId, current.hair.assetId);
  assert.deepEqual(r.config.clothing, current.clothing);
});

test('AI data cannot pollute prototypes or inject code', () => {
  const evil = '{"schemaVersion":"1.0","__proto__":{"polluted":1},"character":{"constructor":{"prototype":{"x":1}},"name":"<img src=x onerror=alert(1)>","hair":{"assetId":"hair_none","__proto__":{"polluted":2}}}}';
  const r = validateText(evil);
  assert.equal(({}).polluted, undefined);
  assert.equal(Object.prototype.x, undefined);
  assert.equal(r.config.name, '<img src=x onerror=alert(1)>'.slice(0, 40), 'names are plain text (the UI only ever uses textContent)');
  assert.ok(!('constructor' in r.config && typeof r.config.constructor !== 'function'));
});

test('list limits are enforced', () => {
  const many = Array.from({ length: 10 }, (_, i) => ({ assetId: ['acc_belt_01', 'acc_scarf_01', 'acc_cape_01', 'acc_watch_01', 'acc_backpack_01', 'acc_necklace_01', 'acc_lemon_badge_01', 'acc_headphones_01', 'acc_shield_01', 'acc_sword_01'][i] }));
  const r = validateDocument({ schemaVersion: '1.0', character: { accessories: many } });
  assert.equal(r.config.accessories.length, 6);
});

// ------------------------------------------------------------------ document
test('save → load round trip keeps the appearance and id', () => {
  const d = newDocument('base_chibi');
  d.character.name = 'Round Trip';
  d.character.accessories = [{ assetId: 'acc_cape_01', attachTo: 'back', color: '#123456', secondaryColor: '#ABCDEF', material: 'cloth' }];
  const saved = finalizeDocument({ ...d, character: completeConfig(d.character) });
  const r = loadDocument(JSON.parse(JSON.stringify(saved)));
  assert.ok(r.ok);
  assert.equal(r.doc.id, saved.id);
  assert.deepEqual(r.doc.character, saved.character);
});

// ------------------------------------------------------------------ prompt + schema
test('the prompt and catalog list every registered asset id', () => {
  const p = buildPrompt();
  for (const a of allAssets()) assert.ok(p.includes(a.id), `prompt mentions ${a.id}`);
  const cat = buildCatalogJson();
  const ids = Object.values(cat.slots).flatMap(s => s.assets.map(a => a.id));
  assert.equal(ids.length, allAssets().length);
  const schema = JSON.stringify(buildJsonSchema());
  for (const a of allAssets()) assert.ok(schema.includes('"' + a.id + '"'));
});

// ------------------------------------------------------------------ exports
test('Limonat export: 6 parts, palette, and the script registers in VR.CHARACTERS', () => {
  const m = compile(baseConfig('base_limonat_hero'));
  const def = toLimonatDef(m, { name: 'Hero Copy', id: 'chr_x' });
  assert.deepEqual(Object.keys(def.model).sort(), ['armL', 'armR', 'body', 'head', 'legL', 'legR']);
  for (const p of Object.values(def.model)) for (const b of p.boxes) { assert.equal(b.length, 7); assert.ok(def.palette[b[6]] !== undefined); }
  const total = Object.values(def.model).reduce((s, p) => s + p.boxes.length, 0);
  assert.equal(total, m.boxes.length, 'no voxel is lost when merging 20 joints into 6 parts');
  const sandbox = { window: {}, console };
  sandbox.window.VR = sandbox.VR = { CHARACTERS: [{ id: 'hero' }] };
  vm.runInNewContext(toLimonatScript(def, { name: 'Hero Copy' }), sandbox);
  assert.equal(sandbox.VR.CHARACTERS.length, 2);
  assert.equal(sandbox.VR.CHARACTERS[1].id, 'cc_hero_copy');
});

test('ZIP writer produces a valid archive', () => {
  assert.equal(crc32(new TextEncoder().encode('hello')), 0x3610a686);
  const z = makeZip([{ name: 'a/b.txt', data: 'hi' }, { name: 'c.bin', data: new Uint8Array([1, 2, 3]) }]);
  const dv = new DataView(z.buffer);
  assert.equal(dv.getUint32(0, true), 0x04034b50);
  assert.equal(dv.getUint32(z.length - 22, true), 0x06054b50);
  assert.equal(dv.getUint16(z.length - 22 + 10, true), 2);
});
