/* =====================================================================
 * Builds the Limonat integration kit:  node tools/build-integration.mjs
 *   integration/limonat/three-gltf-loader.js   THREE.GLTFLoader (three.js r158) as a CLASSIC
 *                                              script for games that load three.min.js
 *                                              (Limonat), from the vendored ES module
 * The runtime (integration/limonat/limonat-n3d.js) is hand-written.
 * ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const globalThree = {
  name: 'global-three',
  setup(b) {
    b.onResolve({ filter: /^three$/ }, () => ({ path: 'three', namespace: 'global-three' }));
    b.onLoad({ filter: /.*/, namespace: 'global-three' }, () => ({ contents: 'module.exports = globalThis.THREE;', loader: 'js' }));
    b.onResolve({ filter: /^three\/addons\// }, a => ({ path: path.join(ROOT, 'vendor/three/addons', a.path.slice('three/addons/'.length)) }));
  },
};
const res = await esbuild.build({
  stdin: { contents: "import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; globalThis.THREE.GLTFLoader = GLTFLoader;", resolveDir: ROOT, loader: 'js' },
  bundle: true, format: 'iife', minify: true, target: ['es2018'], write: false, plugins: [globalThree], legalComments: 'none',
});
const out = path.join(ROOT, 'integration/limonat/three-gltf-loader.js');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `/* THREE.GLTFLoader (three.js r158, MIT © three.js authors) as a classic script: load it after three.min.js. Built by tools/build-integration.mjs. */\n${res.outputFiles[0].text}`);
console.log('wrote', path.relative(ROOT, out), (fs.statSync(out).size / 1024).toFixed(0), 'KB');
