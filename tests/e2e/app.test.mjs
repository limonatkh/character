/* =====================================================================
 * End-to-end acceptance test: drives the real app in Chromium.
 *
 *   node tests/e2e/app.test.mjs            test the source version (index.html)
 *   node tests/e2e/app.test.mjs --dist     test the single-file build
 *   add --shots to save screenshots to tests/e2e/screenshots/
 *
 * Needs the `playwright` package and a Chromium (npx playwright install chromium).
 * ===================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import validator from 'gltf-validator';
import { WebIO } from '@gltf-transform/core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = process.argv.includes('--dist');
const SHOTS = process.argv.includes('--shots');
const SHOT_DIR = path.join(ROOT, 'tests/e2e/screenshots');
const OUT_DIR = path.join(ROOT, 'tests/e2e/out');
fs.mkdirSync(OUT_DIR, { recursive: true });
if (SHOTS) fs.mkdirSync(SHOT_DIR, { recursive: true });

// ------------------------------------------------------------------ static server
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, r));
const URL_ = `http://localhost:${server.address().port}/${DIST ? 'dist/limonat-character-creator.html' : 'index.html'}`;

// ------------------------------------------------------------------ helpers
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1300, height: 860 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

const cfg = () => page.evaluate(() => JSON.parse(JSON.stringify(window.limonatCreator.store.config)));
const tab = id => page.click(`#tabbtn-${id}`);
const openSec = async id => { const open = await page.$eval(`details[data-sec="${id}"]`, d => d.open); if (!open) await page.click(`details[data-sec="${id}"] > summary`); };
async function download(action) {
  const [dl] = await Promise.all([page.waitForEvent('download'), action()]);
  const file = path.join(OUT_DIR, dl.suggestedFilename());
  await dl.saveAs(file);
  return file;
}
async function shot(name) { if (SHOTS) await page.screenshot({ path: path.join(SHOT_DIR, name + '.png') }); }

try {
  // 1. launch + 2. default character
  await page.goto(URL_);
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* ignore */ } });
  await page.reload();
  await page.waitForFunction(() => window.limonatCreator && window.limonatCreator.viewer && window.limonatCreator.viewer.rig, null, { timeout: 30000 });
  check('1. app launches', true, DIST ? 'single-file build' : 'source version');
  const rigInfo = await page.evaluate(() => { const r = window.limonatCreator.viewer.rig; return { meshes: r.meshes.length, bones: r.skeleton.bones.length, name: window.limonatCreator.store.config.name }; });
  check('2. default voxel character in the 3D preview', rigInfo.meshes > 0 && rigInfo.bones === 20, `${rigInfo.name}: ${rigInfo.meshes} meshes, ${rigInfo.bones} bones`);

  // 3. rotate
  const camBefore = await page.evaluate(() => window.limonatCreator.viewer.camera.position.toArray());
  const box = await page.locator('#viewport canvas').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 180, box.y + box.height / 2 + 30, { steps: 8 });
  await page.mouse.up();
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(400);
  const camAfter = await page.evaluate(() => window.limonatCreator.viewer.camera.position.toArray());
  check('3. rotate / zoom the character', camBefore.some((v, i) => Math.abs(v - camAfter[i]) > 0.05));
  await page.click('.seg-stage button >> nth=0');   // front view preset
  await shot('desk-1-customize');

  // 4. hairstyle, clothing and colours
  await openSec('head');
  await page.click('.slot[data-slot="hair"] .tile[title*="spikes"]');
  let c = await cfg();
  check('4a. change hairstyle (tile)', c.hair.assetId === 'hair_spiky_01', c.hair.assetId);
  await page.click('.slot[data-slot="hair"] .swatch[title="#B5462A"]');
  c = await cfg();
  check('4b. change hair colour (swatch)', c.hair.color === '#B5462A', c.hair.color);
  await openSec('clothes');
  await page.click('.slot[data-slot="top"] .tile[title*="crew-neck"]');
  await page.click('.slot[data-slot="outerwear"] .tile[title*="pirate-hero red vest"]');
  c = await cfg();
  check('4c. change clothing items', c.clothing.top.assetId === 'top_tshirt_01' && c.clothing.outerwear.assetId === 'outer_vest_open_01', `${c.clothing.top.assetId} + ${c.clothing.outerwear.assetId}`);
  await page.locator('.slot[data-slot="top"] input[type="color"]').first().fill('#2f8f83');
  await page.waitForTimeout(100);
  c = await cfg();
  check('4d. change colour with the colour picker', c.clothing.top.color === '#2F8F83', c.clothing.top.color);
  await openSec('body');
  await page.click('.slot .swatch[title="#C68A5E"]');
  c = await cfg();
  check('4e. change skin colour', c.body.skinColor === '#C68A5E', c.body.skinColor);
  const slider = page.locator('input.range').first();
  await slider.fill('1.25');
  await slider.dispatchEvent('change');
  c = await cfg();
  check('4f. change a body proportion', Math.abs(c.body.proportions.headScale - 1.25) < 0.001, String(c.body.proportions.headScale));
  await page.selectOption('.slot[data-slot="outerwear"] select.select', 'leather');
  c = await cfg();
  check('4g. change a material', c.clothing.outerwear.material === 'leather', c.clothing.outerwear.material);
  await openSec('acc');
  await page.click('.slot[data-slot="accessory"] .tile[title*="Straight sword"]');
  await page.selectOption('.slot[data-slot="accessory"] .list-row select.select', 'back');
  c = await cfg();
  check('4h. add an accessory and move it to another attachment point', c.accessories.length === 1 && c.accessories[0].attachTo === 'back', JSON.stringify(c.accessories[0]));
  await page.waitForTimeout(1500);
  await shot('desk-2-customized');

  // undo / redo
  await page.click('.top-actions .btn >> nth=0');
  c = await cfg();
  const afterUndo = c.accessories[0] && c.accessories[0].attachTo;
  await page.click('.top-actions .btn >> nth=1');
  c = await cfg();
  check('undo / redo', afterUndo !== 'back' && c.accessories[0].attachTo === 'back', `undo → ${afterUndo}, redo → ${c.accessories[0].attachTo}`);

  // 5. copy prompt
  await tab('prompt');
  await page.click('#tab-prompt .btn.primary');
  await page.waitForTimeout(300);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  check('5. copy the AI prompt (with asset catalog)', clip.includes('ASSET CATALOG') && clip.includes('hair_spiky_01') && clip.includes('Image') !== undefined && clip.length > 20000, `${clip.length} characters`);
  await shot('desk-3-prompt');

  // 6. valid JSON
  await tab('ai');
  await page.click('#tab-ai .btn.ghost >> nth=0');          // paste example
  await page.click('#ai-apply');
  c = await cfg();
  check('6. paste valid AI JSON → character updates', c.name === 'Red Jacket Kid' && c.hair.assetId === 'hair_spiky_01' && c.clothing.outerwear.assetId === 'outer_jacket_open_01', c.name);
  await shot('desk-4-import-ok');

  // 7. invalid JSON / unknown ids keep the current character
  const keep = JSON.stringify(await cfg());
  await page.fill('#ai-json', '{ "schemaVersion": "1.0", "character": { "hair": ');
  await page.click('#ai-apply');
  let report = await page.locator('#tab-ai .report').innerText();
  check('7a. broken JSON → clear error, character unchanged', report.length > 0 && JSON.stringify(await cfg()) === keep && /not valid JSON/i.test(report));
  await page.fill('#ai-json', JSON.stringify({ schemaVersion: '1.0', character: { name: 'Bad Ids', hair: { assetId: 'hair_spikey_01', color: 'red' }, clothing: { top: { assetId: 'top_hawaiian_99' } }, accessories: [{ assetId: 'acc_glasses_round_01', attachTo: 'tail' }] } }));
  await page.click('#ai-apply');
  report = await page.locator('#tab-ai .report').innerText();
  check('7b. unknown asset ids → errors with suggestions, character unchanged', /Did you mean "hair_spiky_01"/.test(report) && /top_hawaiian_99/.test(report) && JSON.stringify(await cfg()) === keep);
  await shot('desk-5-import-errors');
  await page.click('#tab-ai .report .btn.gold');
  c = await cfg();
  check('7c. "apply only the valid values" applies the rest', c.name === 'Bad Ids' && c.accessories.some(a => a.assetId === 'acc_glasses_round_01' && a.attachTo === 'face'), c.name);
  await page.fill('#ai-json', JSON.stringify({ schemaVersion: '2.0', character: {} }));
  await page.click('#ai-apply');
  report = await page.locator('#tab-ai .report').innerText();
  check('7d. unsupported schema version is rejected', /not supported/.test(report));
  // patch mode
  await page.selectOption('#ai-mode', 'patch');
  await page.fill('#ai-json', JSON.stringify({ schemaVersion: '1.0', character: { hair: { color: '#E9D08A' } } }));
  await page.click('#ai-apply');
  const patched = await cfg();
  check('7e. patch mode changes only the given field', patched.hair.color === '#E9D08A' && patched.name === 'Bad Ids', `${patched.name} / ${patched.hair.color}`);
  await page.selectOption('#ai-mode', 'doc');

  // 8. save, change, reload
  await page.fill('#char-name', 'Test Hero');
  await page.press('#char-name', 'Enter');
  await page.locator('#char-name').blur();
  await tab('chars');
  await page.click('#btn-save');
  await page.waitForTimeout(300);
  const saved = await cfg();
  check('8a. save a named character', saved.name === 'Test Hero' && (await page.locator('.char-card').count()) === 1);
  await tab('customize');
  await openSec('head');
  await page.click('.slot[data-slot="hair"] .tile[title*="Big round voluminous"]');
  check('8b. edit after saving', (await cfg()).hair.assetId === 'hair_afro_01');
  await tab('chars');
  await page.click('.char-card .btn.primary');                 // Open
  if (await page.locator('#modal-root:not([hidden]) .btn.danger').count()) await page.click('#modal-root .btn.danger');
  c = await cfg();
  check('8c. reload the saved character → appearance recovered', JSON.stringify(c) === JSON.stringify(saved), c.hair.assetId);
  await page.click('.char-card .btn >> nth=1');                // Duplicate
  await page.waitForTimeout(200);
  check('8d. multiple saved designs', (await page.locator('.char-card').count()) === 2);
  await shot('desk-6-characters');
  await page.reload();
  await page.waitForFunction(() => window.limonatCreator && window.limonatCreator.viewer && window.limonatCreator.viewer.rig);
  await page.waitForTimeout(300);
  c = await cfg();
  check('8e. survives a page reload (library + last open character)', c.name === 'Test Hero' && JSON.stringify(c) === JSON.stringify(saved));

  // 9. export
  await tab('export');
  const glbFile = await download(() => page.click('#tab-export [data-kind="glb"]'));
  const glb = fs.readFileSync(glbFile);
  const rep = await validator.validateBytes(new Uint8Array(glb));
  check("9a. export GLB → valid glTF 2.0 (Khronos validator)", rep.issues.numErrors === 0 && rep.issues.numWarnings === 0, `${glb.length} bytes, ${rep.issues.numErrors} errors, ${rep.issues.numWarnings} warnings`);
  const io = new WebIO();
  const gdoc = await io.readBinary(new Uint8Array(glb));
  const root = gdoc.getRoot();
  const skin = root.listSkins()[0];
  check('9b. GLB has the rig, materials and clips', skin && skin.listJoints().length === 20 && root.listMaterials().length > 0 && root.listAnimations().length === 3,
    `${skin ? skin.listJoints().length : 0} joints, ${root.listMaterials().length} materials, clips: ${root.listAnimations().map(a => a.getName()).join(', ')}`);
  const metaFile = await download(() => page.click('#tab-export [data-kind="meta"]'));
  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  check('9c. export metadata JSON', meta.kind === 'limonat-character' && meta.character.name === 'Test Hero' && meta.export && meta.export.skeleton.length === 20, path.basename(metaFile));
  const jsFile = await download(() => page.click('#tab-export [data-kind="js"]'));
  const sandbox = { window: {}, console };
  sandbox.window.VR = { CHARACTERS: [{ id: 'hero' }] };
  sandbox.VR = sandbox.window.VR;
  vm.runInNewContext(fs.readFileSync(jsFile, 'utf8'), sandbox);
  const def = sandbox.VR.CHARACTERS[1];
  check('9d. Limonat drop-in script registers a VR.CHARACTERS entry', def && ['legL', 'legR', 'body', 'head', 'armL', 'armR'].every(k => def.model[k] && def.model[k].boxes.length), def ? def.id : '');
  const zipFile = await download(() => page.click('#tab-export [data-kind="zip"]'));
  const zip = fs.readFileSync(zipFile);
  check('9e. export full ZIP package', zip.readUInt32LE(0) === 0x04034b50 && zip.includes(Buffer.from('.glb')) && zip.includes(Buffer.from('.limonat.js')), `${zip.length} bytes`);
  // T-pose / +Z variant also valid
  await page.check('input[name="restPose"][value="tpose"]');
  await page.check('input[name="facing"][value="gltf"]');
  const glb2 = fs.readFileSync(await download(() => page.click('#tab-export [data-kind="glb"]')));
  const rep2 = await validator.validateBytes(new Uint8Array(glb2));
  check('9f. T-pose / +Z export is valid too', rep2.issues.numErrors === 0, `${rep2.issues.numErrors} errors`);
  await page.check('input[name="restPose"][value="armsDown"]');
  await page.check('input[name="facing"][value="limonat"]');

  // 10. reopen the exported file
  await page.click('#tab-export [data-kind="verify"]');
  await page.waitForSelector('.check-banner', { timeout: 15000 });
  const chk = await page.evaluate(() => { const v = window.limonatCreator.viewer; let bones = 0; v.check.root.traverse(o => { if (o.isBone) bones++; }); return { bones, clips: v.check.gltf.animations.length }; });
  check('10. exported GLB re-opens in a glTF loader with rig + clips', chk.bones === 20 && chk.clips === 3, `${chk.bones} bones, ${chk.clips} clips`);
  await page.waitForTimeout(600);
  await shot('desk-7-export-check');

  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  // phone screenshots
  if (SHOTS) {
    await page.setViewportSize({ width: 400, height: 860 });
    await page.click('.check-banner .btn').catch(() => {});
    for (const id of ['customize', 'ai', 'prompt', 'chars', 'export']) {
      await tab(id);
      await page.waitForTimeout(id === 'customize' ? 2500 : 500);
      await shot('phone-' + id);
    }
  }
} catch (e) {
  check('test run', false, e.stack || e.message);
} finally {
  await browser.close();
  server.close();
}
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
