/* =====================================================================
 * End-to-end acceptance test of the Normal 3D mode: drives the real app.
 *
 *   node tests/e2e/n3d.test.mjs           source version (index.html)
 *   node tests/e2e/n3d.test.mjs --dist    single-file build
 *   add --shots to save screenshots to tests/e2e/screenshots/
 * ===================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import validator from 'gltf-validator';
import { WebIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = process.argv.includes('--dist');
const SHOTS = process.argv.includes('--shots');
const SHOT_DIR = path.join(ROOT, 'tests/e2e/screenshots');
const OUT_DIR = path.join(ROOT, 'tests/e2e/out');
fs.mkdirSync(OUT_DIR, { recursive: true });
if (SHOTS) fs.mkdirSync(SHOT_DIR, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, r));
const URL_ = `http://localhost:${server.address().port}/${DIST ? 'dist/limonat-character-creator.html' : 'index.html'}`;

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1300, height: 860 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
page.setDefaultTimeout(120000);              // software WebGL draws a dressed character in seconds per frame
page.setDefaultNavigationTimeout(180000);
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

const APP = 'window.limonatCreator3D';
const doc = () => page.evaluate(() => JSON.parse(JSON.stringify(window.limonatCreator3D.store.doc)));
const built = (timeout = 180000) => page.waitForFunction(() => window.limonatCreator3D && window.limonatCreator3D.isCurrent(), null, { timeout, polling: 250 });
const tab = id => page.click(`#n3d-tabbtn-${id}`);
const section = i => page.click(`#n3d-tab-customize .sec-nav button >> nth=${i}`);
async function download(action) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 240000 }), action()]);
  const file = path.join(OUT_DIR, dl.suggestedFilename());
  await dl.saveAs(file);
  return file;
}
async function shot(name) { if (SHOTS) await page.screenshot({ path: path.join(SHOT_DIR, 'n3d-' + name + '.png'), timeout: 180000 }); }
/** Average horizontal distance of a garment's vertices from the body axis (silhouette size). */
const spread = id => page.evaluate(aid => {
  const m = window.limonatCreator3D.res.meshes.find(x => x.assetId === aid && x.kind === 'garment');
  if (!m) return 0;
  const P = m.geometry.position; let s = 0, n = 0;
  for (let i = 0; i < P.length; i += 3) if (P[i + 1] > 1.0 && P[i + 1] < 1.3 && Math.abs(P[i]) < 0.25) { s += Math.hypot(P[i], P[i + 2] - 0.01); n++; }
  return n ? s / n : 0;
}, id);

try {
  // ---------------------------------------------------------------- modes
  await page.goto(URL_);
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* ignore */ } });
  await page.reload();
  await page.waitForFunction(() => window.limonatCreator && window.limonatCreator.viewer && window.limonatCreator.viewer.rig, null, { timeout: 60000 });
  check('1. app starts in Voxel mode (default) with its rig', await page.evaluate(() => window.limonatCreator.viewer.rig.skeleton.bones.length === 20 && !document.getElementById('app').hidden));
  await page.click('#app .mode-switch button[data-mode="n3d"]');
  await page.waitForFunction(() => window.limonatCreator3D, null, { timeout: 60000 });
  await built();
  const first = await page.evaluate(() => { const a = window.limonatCreator3D, g = a.viewer.group; let bones = 0, skinned = 0; g.traverse(o => { if (o.isBone) bones++; if (o.isSkinnedMesh) skinned++; }); return { meshes: a.res.meshes.length, tris: a.res.stats.tris, bones, skinned, voxelHidden: document.getElementById('app').hidden }; });
  check('2. switch to Normal 3D: smooth skinned character built', first.voxelHidden && first.meshes > 20 && first.tris > 50000 && first.bones === 55 && first.skinned > 20, JSON.stringify(first));
  await page.reload();
  await page.waitForFunction(() => window.limonatCreator3D, null, { timeout: 60000 });
  await built();
  check('3. the chosen mode is remembered after a reload', await page.evaluate(() => document.getElementById('app').hidden && !document.getElementById('app3d').hidden));
  await shot('1-default');

  // ---------------------------------------------------------------- viewport
  const cam0 = await page.evaluate(() => window.limonatCreator3D.viewer.camera.position.toArray());
  const box = await page.locator('#n3d-viewport canvas').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2 + 20, { steps: 8 }); await page.mouse.up();
  await page.mouse.wheel(0, -300); await page.waitForTimeout(400);
  const cam1 = await page.evaluate(() => window.limonatCreator3D.viewer.camera.position.toArray());
  check('4. orbit / zoom the viewport', cam0.some((v, i) => Math.abs(v - cam1[i]) > 0.05));
  await page.click('#n3d-stage-tools .stage-top button[data-v="face"]');
  await page.selectOption('#n3d-stage-tools select:not(#n3d-lighting)', 'wire');
  await page.waitForTimeout(300);
  await page.selectOption('#n3d-stage-tools select:not(#n3d-lighting)', 'pbr');
  await page.selectOption('#n3d-lighting', 'dramatic');
  const lit = await page.evaluate(() => { const v = window.limonatCreator3D.viewer; return { id: v.lighting, rim: v.lights.rim.intensity }; });
  await page.selectOption('#n3d-lighting', 'studio');
  await page.click('#n3d-stage-tools .poses button[data-v="walk"]');
  check('5. view presets, inspection modes, lighting presets and poses', lit.id === 'dramatic' && lit.rim > 2 && await page.evaluate(() => window.limonatCreator3D.viewer.view === 'face' && window.limonatCreator3D.viewer.pose === 'walk' && window.limonatCreator3D.viewer.lighting === 'studio'));
  await page.click('#n3d-stage-tools .stage-top button[data-v="threeQuarter"]');

  // ---------------------------------------------------------------- body + face
  await section(0);
  await page.click('#n3d-tab-customize .chip:has-text("Muscular"), #n3d-tab-customize .chip:has-text("عضلي")');
  let d = await doc();
  check('6. body preset applied', d.body.muscle === 1, `muscle ${d.body.muscle}`);
  await built();
  await section(1);
  const slider = page.locator('#n3d-tab-customize details.sub[open] input.range').first();
  await slider.fill('0.6'); await slider.dispatchEvent('change');
  d = await doc();
  check('7. face parameter changed with a slider', Math.abs(d.face.headWidth - 0.6) < 1e-6, `headWidth ${d.face.headWidth}`);
  await built();

  // ---------------------------------------------------------------- hair
  await section(2);
  await page.fill('#n3d-tab-customize .picker .search', 'mid-back');
  await page.click('#n3d-tab-customize .picker .tile >> nth=0');
  d = await doc();
  await built();
  const hair = await page.evaluate(() => window.limonatCreator3D.res.meshes.filter(m => m.kind === 'hair').map(m => [m.name, m.geometry.index.length / 3]));
  check('8. hairstyle changed: sculpted mass + strand layers', d.hair.styleId === 'hair_long_straight_01' && hair.some(([n, t]) => /mass/.test(n) && t > 2000) && hair.length >= 2, JSON.stringify(hair));
  await shot('2-hair');

  // ---------------------------------------------------------------- clothing fit, layers, accessories
  const looseOf = async fit => { await page.evaluate(f => window.limonatCreator3D.store.commit(x => { x.outfit[0].params.fit = f; }, 'fit'), fit); await built(); return spread('top_tshirt_01'); };
  const tight = await looseOf('skinTight'), loose = await looseOf('oversized');
  check('9. tight vs oversized T-shirt: different silhouettes', loose > tight + 0.012, `mean radius ${tight.toFixed(3)} m → ${loose.toFixed(3)} m`);
  await section(3);
  await page.fill('#n3d-tab-customize .picker .search', 'kangaroo');
  await page.click('#n3d-tab-customize .picker .tile >> nth=0');
  await page.fill('#n3d-tab-customize .picker .search', 'overcoat');
  await page.click('#n3d-tab-customize .picker .tile >> nth=0');
  d = await doc();
  await built();
  const layers = await page.evaluate(() => { const r = window.limonatCreator3D.res; return { garments: r.meshes.filter(m => m.kind === 'garment').map(m => m.assetId), errors: r.errors }; });
  check('10. layered outfit (T-shirt + hoodie + coat + jeans) builds', ['top_tshirt_01', 'mid_hoodie_01', 'outer_coat_01', 'bottom_jeans_01'].every(id => layers.garments.includes(id)) && !layers.errors.length, layers.garments.join(', '));
  // garment-specific controls only
  const params = await page.locator('#n3d-tab-customize .list-row.open .param-form').innerText();
  check('11. only relevant controls for the open item (coat: lapels/closure, no trouser rise)', /closure|الإغلاق/i.test(params) && !/rise|ارتفاع الخصر/i.test(params));
  await section(7);
  await page.fill('#n3d-tab-customize .picker .search', 'wrapped once');
  await page.click('#n3d-tab-customize .picker .tile >> nth=0');
  await page.evaluate(() => window.limonatCreator3D.store.commit(x => { const s = x.accessories.find(a => a.assetId === 'neck_scarf_01'); s.params.wrap = 'oneBack'; s.params.length = 1.8; s.colors.main = '#2F5FD0'; }, 'scarf'));
  await built();
  const scarf = await page.evaluate(() => window.limonatCreator3D.res.meshes.filter(m => m.assetId === 'neck_scarf_01').map(m => m.geometry.index.length / 3));
  check('12. scarf added and customised (wrap, length, colour)', scarf.length && scarf[0] > 500, JSON.stringify(scarf));
  await shot('3-outfit');

  // undo / redo
  const before = (await doc()).accessories.length;
  await page.click('#n3d-undo');
  const afterUndo = (await doc()).accessories.find(a => a.assetId === 'neck_scarf_01')?.params.wrap;
  await page.click('#n3d-redo');
  const afterRedo = (await doc()).accessories.find(a => a.assetId === 'neck_scarf_01')?.params.wrap;
  check('13. undo / redo', before === 1 && afterUndo !== 'oneBack' && afterRedo === 'oneBack', `${afterUndo} → ${afterRedo}`);

  // ---------------------------------------------------------------- AI import
  await tab('ai');
  await page.click('#n3d-ai-example');
  await page.click('#n3d-ai-check');
  check('14a. example document checks as valid', /0 errors|0 أخطاء/.test(await page.locator('#n3d-tab-ai .report .counts').innerText()));
  await page.click('#n3d-ai-apply');
  d = await doc();
  check('14b. valid AI JSON replaces the character', d.meta.name === 'Layla' && d.outfit.length >= 4, `${d.meta.name}, ${d.outfit.map(o => o.assetId).join(', ')}`);
  const notes = await page.locator('#n3d-ai-notes').innerText().catch(() => '');
  check("14c. the model's notes are shown: observations with confidence, guesses, unsupported features", /embroidered/i.test(notes) && /90%/.test(notes) && /loafers/i.test(notes) && d.ai && d.ai.unsupported.length === 1, notes.split('\n').slice(0, 2).join(' / '));
  await built(240000);
  await shot('4-ai');
  await page.fill('#n3d-ai-json', JSON.stringify({ format: 'limonat-character-3d', version: '1.0', mode: 'normal3d', body: { height: 3, muscle: 'big' }, hair: { styleId: 'hair_spikey_01' }, outfit: [{ assetId: 'top_hawaiian_99' }, { assetId: 'bottom_jeans_01', colors: { main: '#123456' } }] }));
  await page.click('#n3d-ai-apply');
  const rep = await page.locator('#n3d-tab-ai .report').innerText();
  check('15a. invalid commands are reported and nothing is applied', /hair_spiky_01/.test(rep) && /top_hawaiian_99/.test(rep) && (await doc()).meta.name === 'Layla', rep.split('\n').slice(0, 3).join(' / '));
  await page.click('#n3d-ai-valid');
  d = await doc();
  check('15b. "apply the valid parts" keeps only valid fields', d.body.height === 2.05 && d.outfit.length === 1 && d.outfit[0].colors.main === '#123456', `height ${d.body.height}, outfit ${d.outfit.map(o => o.assetId)}`);
  await page.click('#n3d-undo');
  await page.fill('#n3d-ai-json', JSON.stringify({ schemaVersion: '1.0', kind: 'limonat-character', baseCharacter: 'base_limonat_hero', character: { name: 'V' } }));
  await page.click('#n3d-ai-check');
  check('15c. a Voxel document is recognised and refused', /Voxel|المكعّبات/.test(await page.locator('#n3d-tab-ai .report').innerText()));

  // ---------------------------------------------------------------- prompt
  await tab('prompt');
  await page.click('#n3d-copy-full');
  await page.waitForTimeout(300);
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  const promptText = clip || await page.locator('#n3d-prompt-text').inputValue();
  check('16. Normal 3D prompt is generated from the live catalog (separate from Voxel)', /normal3d/.test(promptText) && /outer_parka_01/.test(promptText) && /hair_anime_01/.test(promptText) && !/base_limonat_hero/.test(promptText), `${promptText.length} characters`);

  // ---------------------------------------------------------------- characters
  await built(240000);
  await tab('chars');
  await page.click('#n3d-save');
  await page.waitForSelector('#n3d-tab-chars .char-card', { timeout: 180000 });   // the thumbnail is drawn with the next frame (slow with software WebGL)
  const saved = await doc();
  await page.click('#n3d-tab-chars .char-card .btn:has-text("Rename"), #n3d-tab-chars .char-card .btn:has-text("إعادة تسمية")');
  await page.fill('#n3d-tab-chars .char-card input.name-input', 'Layla Test');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  await page.click('#n3d-tab-chars .char-card .btn:has-text("Duplicate"), #n3d-tab-chars .char-card .btn:has-text("نسخ") >> nth=0');
  await page.waitForTimeout(400);
  const cards = await page.locator('#n3d-tab-chars .char-card').count();
  check('17. save, rename and duplicate', cards === 2 && (await doc()).meta.name === 'Layla Test', `${cards} saved`);
  await page.click('#n3d-tab-chars .char-card [data-act="compare"] >> nth=1');
  await page.waitForFunction(() => window.limonatCreator3D.viewer.compare, null, { timeout: 240000 });
  check('18. compare two saved characters side by side', await page.evaluate(() => !!window.limonatCreator3D.viewer.compare && !!window.limonatCreator3D.viewer.group));
  await shot('5-compare');
  await page.evaluate(() => window.limonatCreator3D.compare(null));
  // change something, reload → the saved one comes back
  await page.reload();
  await page.waitForFunction(() => window.limonatCreator3D && window.limonatCreator3D.library.records.length, null, { timeout: 60000 });
  await page.waitForTimeout(500);
  d = await doc();
  check('19. saved characters survive a reload (last one reopened)', d.meta.name === 'Layla Test' && d.outfit.length === saved.outfit.length && (await page.evaluate(() => window.limonatCreator3D.library.records.length)) === 2);
  await built(240000);

  // ---------------------------------------------------------------- export
  await tab('export');
  const glbFile = await download(() => page.click('#n3d-tab-export [data-kind="glb"]'));
  const glb = fs.readFileSync(glbFile);
  const vrep = await validator.validateBytes(new Uint8Array(glb), { maxIssues: 200 });
  check('20a. export GLB → valid glTF 2.0 (Khronos validator: 0 errors, skinned meshes are root nodes)', vrep.issues.numErrors === 0 && !vrep.issues.messages.some(m => m.code === 'NODE_SKINNED_MESH_NON_ROOT'), `${(glb.length / 1048576).toFixed(1)} MB, ${vrep.issues.numErrors} errors, ${vrep.issues.numWarnings} warnings`);
  const io = new WebIO().registerExtensions(ALL_EXTENSIONS);
  const gdoc = await io.readBinary(new Uint8Array(glb));
  const root = gdoc.getRoot();
  const skin = root.listSkins()[0];
  const attach = root.listNodes().filter(n => n.getName().startsWith('attach_')).length;
  const extras = root.listScenes()[0].getExtras();
  check('20b. GLB: 55-joint skin, PBR materials + textures, clips, attachment points, document extras',
    skin && skin.listJoints().length === 55 && root.listMaterials().length > 10 && root.listTextures().length > 3 && root.listAnimations().length === 3 && attach === 19 && extras?.limonatCharacter3D?.document?.format === 'limonat-character-3d',
    `${skin ? skin.listJoints().length : 0} joints, ${root.listMeshes().length} meshes, ${root.listMaterials().length} materials, ${root.listTextures().length} textures, clips ${root.listAnimations().map(a => a.getName())}, ${attach} attach nodes`);
  const nodeNames = root.listNodes().map(n => n.getName());
  const worn = (await doc()).outfit.map(o => o.assetId);
  check('20c. stable part ids as node names', ['skin_body', 'skin_head', 'eye_left'].every(n => nodeNames.includes(n)) && worn.every(id => nodeNames.some(n => n.startsWith(id))), worn.join(', '));
  const metaFile = await download(() => page.click('#n3d-tab-export [data-kind="meta"]'));
  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  check('20d. metadata JSON', meta.format === 'limonat-character-3d-export' && meta.skeleton.length === 55 && meta.parts.length > 20 && Object.keys(meta.attachmentPoints).length === 19 && meta.document.meta.name === 'Layla Test', path.basename(metaFile));
  const docFile = await download(() => page.click('#n3d-tab-export [data-kind="doc"]'));
  check('20e. character document JSON', JSON.parse(fs.readFileSync(docFile, 'utf8')).mode === 'normal3d', path.basename(docFile));
  const jsFile = await download(() => page.click('#n3d-tab-export [data-kind="js"]'));
  // the registration file + the integration runtime in a minimal stand-in of the game (VR + THREE globals)
  class O3 { constructor() { this.children = []; this.rotation = {}; } add(...c) { this.children.push(...c); } }
  const game = { console, VR: { CHARACTERS: [{ id: 'hero', name: { en: 'Hero' }, model: { armL: { pivot: [0, 0, 0], boxes: [] }, armR: { pivot: [0, 0, 0], boxes: [] } }, palette: {} }], buildCharacter: () => ({ voxel: true }) },
    THREE: { Group: O3, Object3D: O3, Quaternion: class {}, Vector3: class {}, GLTFLoader: class { load() { /* the GLB is not fetched in this check */ } } } };
  game.window = game; game.globalThis = game;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'integration/limonat/limonat-n3d.js'), 'utf8'), game);
  vm.runInNewContext(fs.readFileSync(jsFile, 'utf8'), game);
  const entry = game.VR.CHARACTERS[1];
  check('20f. Limonat registration file + runtime add a VR.CHARACTERS entry with the 6 Limonat parts', entry && entry.n3d && /\.glb$/.test(entry.glb) && Object.keys(game.LimonatN3D.PARTS).join() === 'legL,legR,body,head,armL,armR' && game.VR.buildCharacter(game.VR.CHARACTERS[0]).voxel, entry ? `${entry.id} → ${entry.glb}` : '');
  const zipFile = await download(() => page.click('#n3d-tab-export [data-kind="zip"]'));
  const zip = fs.readFileSync(zipFile);
  check('20g. ZIP package', zip.readUInt32LE(0) === 0x04034b50 && ['.glb', '.meta.json', '.n3d.json', '.limonat-n3d.js', 'README.txt'].every(s => zip.includes(Buffer.from(s))), `${(zip.length / 1048576).toFixed(1)} MB`);
  await page.check('input[name="n3d-facing"][value="gltf"]');
  const glb2 = fs.readFileSync(await download(() => page.click('#n3d-tab-export [data-kind="glb"]')));
  const vrep2 = await validator.validateBytes(new Uint8Array(glb2));
  check('20h. glTF-facing (+Z) export valid too', vrep2.issues.numErrors === 0, `${vrep2.issues.numErrors} errors`);
  await page.check('input[name="n3d-facing"][value="limonat"]');
  await page.click('#n3d-tab-export [data-kind="verify"]');
  await page.waitForSelector('#n3d-verify-text', { timeout: 240000 });
  const chk = await page.evaluate(() => { const c = window.limonatCreator3D.viewer.check; let bones = 0, skinned = 0; c.root.traverse(o => { if (o.isBone) bones++; if (o.isSkinnedMesh) skinned++; }); return { bones, skinned, clips: c.clips }; });
  check('21. exported GLB re-opens in a glTF loader with rig + clips', chk.bones === 55 && chk.skinned > 20 && chk.clips.length === 3, JSON.stringify(chk));
  await page.waitForTimeout(800);
  await shot('6-export-check');
  await page.click('#n3d-stage-tools .check-banner .btn.gold');

  // ---------------------------------------------------------------- back to Voxel
  await page.click('#app3d .mode-switch button[data-mode="voxel"]');
  await page.waitForFunction(() => window.limonatCreator && window.limonatCreator.viewer && window.limonatCreator.viewer.rig, null, { timeout: 60000 });
  check('22. switch back: Voxel mode still works with its own character', await page.evaluate(() => !document.getElementById('app').hidden && window.limonatCreator.store.config && window.limonatCreator.viewer.rig.skeleton.bones.length === 20));

  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) {
  check('test run', false, e.stack || e.message);
} finally {
  await browser.close();
  server.close();
}
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
