/* =====================================================================
 * EXPORT PANEL — GLB model, metadata JSON, Limonat drop-in script, ZIP.
 * After exporting, the GLB can be re-opened with Three's GLTFLoader in
 * the preview to prove the file is a valid, rigged, animated glTF.
 * ===================================================================== */
import { h, clear, toast } from './dom.js';
import { t } from './i18n.js';
import { PX } from '../core/constants.js';
import { compile } from '../core/compile.js';
import { finalizeDocument } from '../core/document.js';
import { buildExportFiles, zipPackage, inspectGLB, DEFAULT_EXPORT } from '../export/gltf.js';
import { saveFile } from '../export/download.js';
import { buildCharacterObject, meshStats } from '../render/mesh.js';
import { prefs } from '../storage/library.js';

/** Toast for a saveFile() result. */
export function reportSave(res) {
  if (!res) return;
  if (res.status === 'saved') toast(t('dlSaved', { n: res.name }));
  else if (res.status === 'zipped') toast(t('dlZipped', { n: res.name }), 'ok', 4200);
  else if (res.status === 'declined') toast(t('dlDeclined'), 'warn');
  else toast(t('dlUnavailable'), 'error', 4200);
}

export class ExportPanel {
  constructor(root, ctx) {
    this.root = root;
    this.ctx = ctx;
    let s = {};
    try { s = JSON.parse(prefs.get('exportSettings', '{}')); } catch { /* defaults */ }
    this.settings = { ...DEFAULT_EXPORT, ...s };
    this.verifyText = '';
    this.busy = false;
  }
  get store() { return this.ctx.store; }

  saveSettings() { prefs.set('exportSettings', JSON.stringify(this.settings)); }

  stats() {
    const model = compile(this.store.config);
    const obj = buildCharacterObject(model, { shading: 'flat' });
    const s = meshStats(obj);
    obj.dispose();
    return { ...s, boxes: model.boxes.length, height: model.height * PX };
  }

  radio(name, label, options) {
    return h('fieldset.opt', h('legend', label), options.map(([v, text]) => h('label.radio',
      h('input', { type: 'radio', name, value: v, checked: this.settings[name] === v, onchange: () => { this.settings[name] = v; this.saveSettings(); } }),
      h('span', text))));
  }

  async run(kind) {
    if (this.busy) return;
    this.busy = true;
    this.root.classList.add('busy');
    try {
      const doc = finalizeDocument(this.store.doc);
      const exp = await buildExportFiles(compile(doc.character), doc, this.settings);
      const f = exp.files;
      if (kind === 'glb') reportSave(await saveFile(f.glb.name, f.glb.data, f.glb.mime));
      else if (kind === 'meta') reportSave(await saveFile(f.meta.name, f.meta.data, f.meta.mime));
      else if (kind === 'js') reportSave(await saveFile(f.js.name, f.js.data, f.js.mime));
      else if (kind === 'zip') reportSave(await saveFile(exp.base + '.zip', zipPackage(exp), 'application/zip'));
      else if (kind === 'verify') {
        const info = await inspectGLB(f.glb.data);
        await this.ctx.viewer.showGLB(f.glb.data, 'walk');
        this.ctx.onCheckMode(true);
        this.verifyText = t('verifyOk', { b: info.bones, m: info.skinnedMeshes, c: info.animations.join(', ') || '—' });
        this.render();
      }
    } catch (e) {
      console.error(e);
      toast(t('exportFailed', { m: e && e.message ? e.message : String(e) }), 'error', 5000);
    } finally {
      this.busy = false;
      this.root.classList.remove('busy');
    }
  }

  render() {
    clear(this.root);
    let st = null;
    try { st = this.stats(); } catch (e) { console.warn(e); }
    const stat = (label, value) => h('div.stat', h('span.stat-label', label), h('span.stat-val', value));
    const anims = h('input', { type: 'checkbox', checked: !!this.settings.animations, onchange: () => { this.settings.animations = anims.checked; this.saveSettings(); } });
    const b = (cls, label, kind) => h('button.btn' + cls, { type: 'button', dataset: { kind }, onclick: () => this.run(kind) }, label);
    this.root.append(
      h('section.card-sec',
        h('h2', t('exportTitle')),
        h('p.lead', t('exportHelp')),
        st ? h('div.stats', stat(t('stBones'), st.bones), stat(t('stParts'), st.boxes), stat(t('stTris'), st.tris.toLocaleString('en-US')), stat(t('stHeight'), st.height.toFixed(2) + ' m')) : null,
        h('div.opts',
          this.radio('restPose', t('restPose'), [['armsDown', t('rpArms')], ['tpose', t('rpT')]]),
          this.radio('facing', t('facing'), [['limonat', t('fLimonat')], ['gltf', t('fGltf')]]),
          this.radio('shading', t('shading'), [['flat', t('shFlat')], ['pbr', t('shPbr')]])),
        h('label.check', anims, h('span', t('anims'))),
        h('div.row.wrap', b('.primary', t('dlZip'), 'zip'), b('', t('dlGlb'), 'glb'), b('', t('dlMeta'), 'meta'), b('', t('dlJs'), 'js')),
        h('div.row.wrap', b('.gold', t('verify'), 'verify')),
        this.verifyText ? h('div.banner.ok', this.verifyText) : null),
      h('section.card-sec',
        h('h3', t('limonatHow')),
        h('p', t('limonatSteps'))));
  }
}
