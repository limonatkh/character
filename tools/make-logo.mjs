/* =====================================================================
 * Regenerates the site logo and icons from the Limonat hero's head:
 *   src/ui/logo.js          head on sky blue (data URL) used in the top bar
 *   assets/icon-192.png     favicon / Android icon (head on sky blue)
 *   assets/icon-512.png     large icon
 *   assets/apple-touch-icon.png  iPhone home-screen icon (180 px)
 * Needs Playwright + Chromium:   node tools/make-logo.mjs
 * Change the base or the view direction below and re-run to restyle.
 * ===================================================================== */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'base_limonat_hero';
const DIR = [0.42, 0.2, -0.88];             // ¾ view from the front-right, a little above (−Z is the front)
const SKY = '#8FD3FF';                       // Limonat sky

const MIME = { '.html': 'text/html', '.js': 'text/javascript' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.goto(`http://localhost:${server.address().port}/tools/logo.html`);
await page.waitForFunction(() => window.ready === true);

const render = opts => page.evaluate(o => window.renderHead(o), { baseId: BASE, dir: DIR, ...opts });
const toFile = (url, rel) => { fs.mkdirSync(path.dirname(path.join(ROOT, rel)), { recursive: true }); fs.writeFileSync(path.join(ROOT, rel), Buffer.from(url.split(',')[1], 'base64')); console.log('wrote', rel); };

const logo = await render({ size: 160, pad: 0.09, background: SKY });   // shown in a bordered square, like a game portrait
fs.writeFileSync(path.join(ROOT, 'src/ui/logo.js'),
  `/* Site logo: the Limonat hero's voxel head, rendered by tools/make-logo.mjs. Do not edit by hand. */\nexport const LOGO_HEAD = '${logo}';\n`);
console.log('wrote src/ui/logo.js', Math.round(logo.length / 1024) + ' KB');
toFile(await render({ size: 192, pad: 0.14, background: SKY }), 'assets/icon-192.png');
toFile(await render({ size: 512, pad: 0.14, background: SKY }), 'assets/icon-512.png');
toFile(await render({ size: 180, pad: 0.14, background: SKY }), 'assets/apple-touch-icon.png');
toFile(logo, 'tests/e2e/out/logo-preview.png');

await browser.close();
server.close();
