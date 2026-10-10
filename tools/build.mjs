/* =====================================================================
 * Single-file build:  npm run build
 *   dist/limonat-character-creator.html   complete offline app in ONE file
 *                                          (open it directly, even from a phone's files)
 *   dist/artifact.html                     the same content without the <html>/<head>
 *                                          wrapper, for publishing as a claude.ai page
 * Bundles src/main.js + Three.js (vendor/) with esbuild, inlines the CSS
 * and the pixel fonts as data: URIs. The source version (index.html) keeps
 * working unchanged; this is only a packaging step.
 * ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = p => path.join(ROOT, p);

const threeAlias = {
  name: 'three-vendor',
  setup(b) {
    b.onResolve({ filter: /^three$/ }, () => ({ path: rel('vendor/three/three.module.js') }));
    b.onResolve({ filter: /^three\/addons\// }, a => ({ path: rel('vendor/three/addons/' + a.path.slice('three/addons/'.length)) }));
  },
};

const result = await esbuild.build({
  entryPoints: [rel('src/main.js')],
  bundle: true, format: 'esm', minify: true, target: ['es2020'], write: false,
  plugins: [threeAlias], legalComments: 'none', charset: 'utf8',
});
let js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

let css = fs.readFileSync(rel('css/app.css'), 'utf8');
css = css.replace(/url\(\.\.\/fonts\/([^)]+)\)/g, (_, f) => `url(data:font/woff2;base64,${fs.readFileSync(rel('fonts/' + f)).toString('base64')})`);
css = (await esbuild.transform(css, { loader: 'css', minify: true })).code;

const html = fs.readFileSync(rel('index.html'), 'utf8');
const body = html.slice(html.indexOf('<!--APP-->') + 10, html.indexOf('<!--/APP-->')).trim();
const title = html.match(/<title>([^<]*)<\/title>/)[1];
const desc = html.match(/<meta name="description" content="([^"]*)"/)[1];
const licence = '<!-- Limonat Character Creator. Bundles three.js (MIT, © three.js authors) and the Tiny5 + Handjet fonts (SIL OFL 1.1). -->';

const standalone = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${desc}">
${licence}
<style>${css}</style>
</head>
<body>
${body}
<script type="module">${js}</script>
</body>
</html>
`;

// claude.ai pages are wrapped in their own <html>/<head>/<body> at publish time.
const artifact = `<title>${title}</title>
${licence}
<style>${css}</style>
<script>document.documentElement.lang='ar';document.documentElement.dir='rtl';</script>
${body}
<script type="module">${js}</script>
`;

fs.mkdirSync(rel('dist'), { recursive: true });
fs.writeFileSync(rel('dist/limonat-character-creator.html'), standalone);
fs.writeFileSync(rel('dist/artifact.html'), artifact);
const kb = s => (Buffer.byteLength(s) / 1024).toFixed(0) + ' KB';
console.log('dist/limonat-character-creator.html', kb(standalone));
console.log('dist/artifact.html', kb(artifact));
