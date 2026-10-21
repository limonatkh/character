/* =====================================================================
 * Renders the Normal 3D asset thumbnails:  node tools/n3d-thumbs.mjs [ids…]
 * Builds every asset on a neutral mannequin (or a face / hand / foot close-
 * up), renders a small JPEG with headless Chromium and writes them to
 * src/n3d/assets/thumbs.js. With ids, only those thumbnails are redone.
 * Run it after adding or changing assets.
 * ===================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src/n3d/assets/thumbs.js');
const only = process.argv.slice(2);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, r));
let old = {};
try { old = (await import('file://' + OUT + '?t=' + Date.now())).default || {}; } catch { /* first run */ }
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', e => console.log('pageerror', e.message));
await page.goto(`http://localhost:${server.address().port}/tools/n3d-thumbs.html`);
await page.waitForFunction(() => window.ready);
const list = await page.evaluate(() => window.thumbList());
const out = { ...old };
const t0 = Date.now();
for (const { id, slot } of list) {
  if (only.length && !only.includes(id)) continue;
  const t = Date.now();
  const r = await page.evaluate(i => window.thumbOf(i, 112), id);
  out[id] = r.url;
  console.log(`${id.padEnd(28)} ${slot.padEnd(10)} ${String(Date.now() - t).padStart(6)} ms  ${(r.url.length / 1024).toFixed(1)} KB${r.errors && r.errors.length ? '  errors: ' + JSON.stringify(r.errors) : ''}`);
}
const ids = new Set(list.map(x => x.id));
for (const k of Object.keys(out)) if (!ids.has(k)) delete out[k];
const body = Object.keys(out).sort().map(k => `  ${JSON.stringify(k)}: ${JSON.stringify(out[k])},`).join('\n');
fs.writeFileSync(OUT, `/* Asset thumbnails (JPEG data URIs) rendered by tools/n3d-thumbs.mjs. Generated — do not edit by hand. */\nexport default {\n${body}\n};\n`);
console.log(`${Object.keys(out).length} thumbnails, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB, ${((Date.now() - t0) / 1000).toFixed(0)} s → ${path.relative(ROOT, OUT)}`);
await browser.close();
server.close();
