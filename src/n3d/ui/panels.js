/* =====================================================================
 * NORMAL 3D — AI import, AI prompt, Characters and Export panels.
 * Same contract as the Voxel panels (render() into a tab, ctx for shared
 * services), but working on the limonat-character-3d document, its own
 * library namespace, prompt / schema / catalog and GLB exporter.
 * ===================================================================== */
import { h, clear, toast, pickFile, readFileText } from '../../ui/dom.js';
import { getLang } from '../../ui/i18n.js';
import { T, Lb } from './strings.js';
import { extractJson } from '../../schema/validate.js';
import { validateN3D } from '../schema/validate.js';
import { buildN3DPrompt, buildN3DCatalogText, buildN3DCatalogJson, buildN3DJsonSchema, exampleN3D, N3D_CATALOG_ORDER } from '../schema/prompt.js';
import { N3D_FORMAT, N3D_VERSION, createN3DDocument } from '../core/document.js';
import { allAssets } from '../core/registry.js';
import { DETAIL_LEVELS, DETAIL_IDS } from '../core/detail.js';
import { copyText, saveFile } from '../../export/download.js';
import { reportSave } from '../../ui/export-panel.js';
import { prefs } from '../../storage/library.js';

const clone = v => JSON.parse(JSON.stringify(v));
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
export const n3dFileBase = name => (String(name || 'character').normalize('NFKD').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'character').slice(0, 40);
const isVoxelDoc = v => isObj(v) && (v.kind === 'limonat-character' || (v.schemaVersion && v.baseCharacter) || (isObj(v.character) && isObj(v.character.body) && (v.character.body.type || v.character.body.proportions)));
const issueList = items => h('ul.issues', items.map(it => h('li.issue', { dataset: { level: it.level } },
  h('span.pill', { dataset: { level: it.level } }, T(it.level === 'error' ? 'lvError' : 'lvWarning')),
  h('code.issue-path', { attrs: { dir: 'ltr' } }, it.path || '—'),
  h('span.issue-msg', { attrs: { dir: 'ltr' } }, it.message))));

/* ------------------------------------------------------------------ AI IMPORT */
export class N3DImportPanel {
  constructor(root, ctx) { this.root = root; this.ctx = ctx; this.text = prefs.get('n3d.aiDraft', ''); this.mode = 'replace'; this.report = null; }
  get store() { return this.ctx.store; }

  render() {
    clear(this.root);
    const ta = h('textarea.code', {
      id: 'n3d-ai-json', spellcheck: false, value: this.text, placeholder: T('pasteHere'),
      attrs: { dir: 'ltr', 'aria-label': T('aiTitle'), autocomplete: 'off', autocapitalize: 'off' },
      oninput: () => { this.text = ta.value; prefs.set('n3d.aiDraft', this.text.length < 100000 ? this.text : ''); },
    });
    const modeSeg = h('div.seg', { attrs: { role: 'group', 'aria-label': 'mode' } }, [['replace', T('applyReplace')], ['merge', T('applyMerge')]].map(([v, l]) =>
      h('button', { type: 'button', dataset: { mode: v }, attrs: { 'aria-pressed': String(v === this.mode) }, onclick: () => { this.mode = v; this.render(); } }, l)));
    this.root.append(
      h('section.card-sec',
        h('h2', T('aiTitle')),
        h('p.lead', T('aiHelp')),
        modeSeg, h('p.muted.small', T('modeHelp')),
        ta,
        h('div.row.wrap',
          h('button.btn.primary', { type: 'button', id: 'n3d-ai-apply', onclick: () => this.apply(false) }, this.mode === 'replace' ? T('applyReplace') : T('applyMerge')),
          h('button.btn', { type: 'button', id: 'n3d-ai-check', onclick: () => this.check() }, T('check')),
          h('button.btn.ghost', { type: 'button', onclick: () => this.openFile() }, T('openFile')),
          h('button.btn.ghost', { type: 'button', id: 'n3d-ai-example', onclick: () => this.setText(JSON.stringify(exampleN3D(), null, 2)) }, T('aiExample')),
          h('button.btn.ghost', { type: 'button', onclick: () => { this.setText(''); this.report = null; this.render(); } }, T('aiClear')))),
      ...[this.reportView(), this.notesView()].filter(Boolean));
  }
  setText(s) { this.text = s; prefs.set('n3d.aiDraft', s.length < 100000 ? s : ''); const ta = this.root.querySelector('#n3d-ai-json'); if (ta) ta.value = s; }
  openFile() { pickFile('.json,application/json,text/plain', async f => { try { this.setText(await readFileText(f)); this.check(); } catch { toast(T('fileError'), 'error'); } }); }

  parse() {
    const ex = extractJson(this.text);
    if (ex.error) return { fatal: [{ level: 'error', path: '', message: ex.error }] };
    if (isVoxelDoc(ex.value)) return { voxel: true, fatal: [{ level: 'error', path: '', message: T('voxelDoc') }] };
    const r = validateN3D(ex.value, { mode: this.mode, base: this.store.doc });
    const items = ex.notes.map(n => ({ level: 'warning', path: '', message: n }))
      .concat(r.errors.map(e => ({ level: 'error', ...e })), r.warnings.map(w => ({ level: 'warning', ...w })));
    return { r, items, value: ex.value };
  }
  check() {
    const p = this.parse();
    this.report = p.fatal ? { checked: true, items: p.fatal, voxel: p.voxel } : { checked: true, ok: p.r.ok, items: p.items, canApplyValid: !p.r.ok };
    this.render(); this.focusReport();
  }
  /** Apply the document. validOnly = apply even with errors (the invalid fields are dropped). */
  apply(validOnly) {
    const p = this.parse();
    if (p.fatal) { this.report = { items: p.fatal, voxel: p.voxel }; this.render(); this.focusReport(); return; }
    if (!p.r.ok && !validOnly) { this.report = { items: p.items, canApplyValid: true }; this.render(); this.focusReport(); return; }
    const doc = p.r.doc;
    if (this.mode === 'replace') doc.meta = { ...doc.meta, id: this.store.doc.meta.id, createdAt: this.store.doc.meta.createdAt };
    this.store.replace(doc, T('tabAi'));
    this.report = { applied: true, items: p.items };
    toast(T('applied'), p.items.some(i => i.level === 'error') ? 'warn' : 'ok');
    this.render(); this.focusReport();
  }
  focusReport() { const el = this.root.querySelector('.report'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  reportView() {
    const R = this.report; if (!R) return null;
    const ne = R.items.filter(i => i.level === 'error').length, nw = R.items.length - ne;
    const head = R.applied ? h('div.banner.ok', h('strong', T('rApplied'))) : R.checked && R.ok ? h('div.banner.ok', h('strong', T('valid'))) : R.checked && !R.voxel && !ne ? h('div.banner.ok', T('rChecked')) : h('div.banner.error', h('strong', R.checked ? T('invalid') : T('rRejected')));
    return h('section.card-sec.report', { attrs: { 'aria-live': 'polite' } }, head,
      h('p.counts', `${T('errorsN', { n: ne })} · ${T('warningsN', { n: nw })}`),
      R.voxel && this.ctx.switchMode ? h('button.btn.gold', { type: 'button', onclick: () => this.ctx.switchMode('voxel') }, T('switchToVoxel')) : null,
      R.canApplyValid ? h('button.btn.gold', { type: 'button', id: 'n3d-ai-valid', onclick: () => this.apply(true) }, T('applyValid')) : null,
      R.items.length ? issueList(R.items) : null);
  }
  /** What the model reported with the current character: notes, reference, observations, guesses, unsupported features, low-confidence items. */
  notesView() {
    const doc = this.store.doc, ai = doc.ai || {}, n = doc.meta.notes;
    const pct = c => (typeof c === 'number' ? h('span.conf', { dataset: { low: String(c < 0.5) } }, Math.round(c * 100) + '%') : null);
    const block = (title, items) => (items && items.length ? h('div.note-block', h('div.field-label', title), h('ul', items)) : null);
    const label = it => Lb(allAssets().find(a => a.id === it.assetId)?.label) || it.assetId;
    const low = [...doc.outfit, ...doc.accessories].filter(it => typeof it.confidence === 'number' && it.confidence < 0.5);
    const ref = ai.reference;
    const blocks = [
      n ? h('p', { attrs: { dir: 'auto' } }, n) : null,
      ref ? h('div.note-block', h('div.field-label', T('refTitle')), h('p', { attrs: { dir: 'auto' } }, [ref.description, ref.framing && T('framing_' + ref.framing), ref.style && T('style_' + ref.style)].filter(Boolean).join(' · '))) : null,
      block(T('obsTitle'), (ai.observations || []).map(o => h('li', h('span.chip.small', T('area_' + o.area)), ' ', h('span', { attrs: { dir: 'auto' } }, o.note), ' ', pct(o.confidence)))),
      block(T('uncTitle'), (ai.uncertain || []).map(u => h('li', u.field ? h('code', { attrs: { dir: 'ltr' } }, u.field) : null, u.field ? ' ' : null, h('span', { attrs: { dir: 'auto' } }, u.note), ' ', pct(u.confidence)))),
      block(T('unsTitle'), (ai.unsupported || []).map(u => h('li', h('span', { attrs: { dir: 'auto' } }, u.feature), u.closestSubstitute ? h('span.muted', { attrs: { dir: 'auto' } }, ' → ' + T('substitute') + ': ' + u.closestSubstitute) : null))),
      block(T('lowConfTitle'), low.map(it => h('li', h('span', label(it)), ' ', pct(it.confidence)))),
    ].filter(Boolean);
    return blocks.length ? h('section.card-sec.notes', { id: 'n3d-ai-notes' }, h('h3', T('notesTitle')), ...blocks) : null;
  }
}

/* ------------------------------------------------------------------ AI PROMPT */
export class N3DPromptPanel {
  constructor(root, ctx) { this.root = root; this.ctx = ctx; this.full = null; }
  ensure() {
    if (this.full) return;
    this.full = buildN3DPrompt({ includeCatalog: true });
    this.short = buildN3DPrompt({ includeCatalog: false });
    this.catalog = buildN3DCatalogText();
  }
  async copy(text, btn) {
    if (await copyText(text)) {
      toast(T('copied'));
      if (btn) { const old = btn.textContent; btn.textContent = '✓ ' + T('copied'); setTimeout(() => { btn.textContent = old; }, 1600); }
    } else {
      const ta = this.root.querySelector('#n3d-prompt-text'); if (ta) { ta.value = text; ta.focus(); ta.select(); }
      toast(T('copyFailed'), 'warn', 4500);
    }
  }
  render() {
    this.ensure();
    clear(this.root);
    const btn = (cls, label, fn, id) => { const b = h('button.btn' + cls, { type: 'button', id }, label); b.addEventListener('click', () => fn(b)); return b; };
    const nAssets = allAssets().filter(a => N3D_CATALOG_ORDER.includes(a.slot)).length;
    this.root.append(
      h('section.card-sec',
        h('h2', T('promptTitle')),
        h('p.lead', T('promptHelp')),
        h('ol.steps', ['step1', 'step2', 'step3', 'step4'].map(k => h('li', T(k)))),
        h('div.row.wrap',
          btn('.primary', T('copyFull'), b => this.copy(this.full, b), 'n3d-copy-full'),
          btn('', T('copyShort'), b => this.copy(this.short, b)),
          btn('', T('copyCatalog'), b => this.copy(this.catalog, b))),
        h('div.row.wrap',
          btn('.ghost.small', T('catalogFile'), async () => reportSave(await saveFile('limonat-3d-asset-catalog.json', JSON.stringify(buildN3DCatalogJson(), null, 2), 'application/json'))),
          btn('.ghost.small', T('schemaFile'), async () => reportSave(await saveFile(`limonat-character-3d.schema-${N3D_VERSION}.json`, JSON.stringify(buildN3DJsonSchema(), null, 2), 'application/json'))),
          btn('.ghost.small', T('example'), async () => reportSave(await saveFile('limonat-character-3d.example.json', JSON.stringify(exampleN3D(), null, 2), 'application/json'))),
          btn('.ghost.small', T('goAi'), () => this.ctx.goTab('ai'))),
        h('p.muted.small', { attrs: { dir: 'auto' } }, T('promptStats', { a: nAssets, s: N3D_CATALOG_ORDER.length, v: `${N3D_FORMAT} ${N3D_VERSION}`, c: this.full.length.toLocaleString('en-US') }))),
      h('section.card-sec', h('textarea.code.prompt-text', { id: 'n3d-prompt-text', readOnly: true, value: this.full, spellcheck: false, attrs: { dir: 'ltr', 'aria-label': T('promptTitle') } })));
  }
}

/* ------------------------------------------------------------------ CHARACTERS */
export class N3DCharactersPanel {
  /** ctx: { store, library, lastOpen, thumbnail(), confirm(), compare(rec|null), comparing() } */
  constructor(root, ctx) {
    this.root = root; this.ctx = ctx; this.pendingDelete = null; this.renaming = null;
    ctx.library.subscribe(() => { if (this.visible) this.render(); });
  }
  get store() { return this.ctx.store; }
  get library() { return this.ctx.library; }
  async guard() { return !this.store.dirtyOrNew() || this.ctx.confirm(T('confirmLeave'), T('cont')); }
  stamp(doc) { const d = clone(doc); d.meta.updatedAt = new Date().toISOString(); return d; }

  async save(asCopy) {
    let doc = this.stamp(this.store.doc);
    if (asCopy) {
      doc.meta.id = 'n3d_' + Math.random().toString(36).slice(2, 10); doc.meta.createdAt = doc.meta.updatedAt;
      doc.meta.name = (doc.meta.name + T('copySuffix')).slice(0, 80);
      this.store.replace(doc, T('saveAs'));
    } else this.store.replace(doc, T('save'), { silent: true });
    try {
      await this.library.save(doc, await this.ctx.thumbnail());
      this.store.markSaved(); this.ctx.lastOpen.set(doc.meta.id);
      toast(T('savedN', { n: doc.meta.name }));
    } catch (e) { toast(T('saveFailed', { m: e && e.message ? e.message : String(e) }), 'error', 5000); }
    this.render();
  }
  async openRecord(rec) {
    if (!(await this.guard())) return;
    const r = validateN3D(rec.doc, { mode: 'replace' });
    this.store.replace(r.doc, T('open')); this.store.markSaved(); this.ctx.lastOpen.set(r.doc.meta.id);
    toast(T('loaded', { n: r.doc.meta.name }));
    this.render();
  }
  async duplicate(rec) {
    const doc = clone(rec.doc); doc.meta.id = 'n3d_' + Math.random().toString(36).slice(2, 10); doc.meta.name = (doc.meta.name + T('copySuffix')).slice(0, 80); doc.meta.updatedAt = new Date().toISOString();
    try { await this.library.save(doc, rec.thumb); toast(T('savedN', { n: doc.meta.name })); } catch (e) { toast(T('saveFailed', { m: e.message }), 'error'); }
  }
  async rename(rec, name) {
    name = String(name || '').trim().slice(0, 80); this.renaming = null;
    if (!name || name === rec.name) { this.render(); return; }
    const doc = clone(rec.doc); doc.meta.name = name; doc.meta.updatedAt = new Date().toISOString();
    try { await this.library.save(doc, rec.thumb); toast(T('renameOk')); } catch (e) { toast(T('saveFailed', { m: e.message }), 'error'); }
    if (rec.id === this.store.doc.meta.id) { this.store.replace({ ...this.store.doc, meta: { ...this.store.doc.meta, name } }, T('rename'), { silent: true }); this.store.markSaved(); }
    this.render();
  }
  async newCharacter() {
    if (!(await this.guard())) return;
    this.store.replace(createN3DDocument({ meta: { name: T('newCharacter') } }), T('resetAll'));
    this.render();
  }
  openFile() {
    pickFile('.json,application/json,text/plain', async f => {
      try {
        const ex = extractJson(await readFileText(f));
        if (ex.error) { toast(ex.error, 'error', 6000); return; }
        if (isVoxelDoc(ex.value)) { toast(T('voxelDoc'), 'error', 6000); return; }
        if (!(await this.guard())) return;
        const r = validateN3D(ex.value, { mode: 'replace' });
        this.store.replace(r.doc, T('importJson'));
        toast(T('loaded', { n: r.doc.meta.name }) + (r.errors.length ? ` (${T('errorsN', { n: r.errors.length })})` : ''), r.errors.length ? 'warn' : 'ok', 3500);
        this.render();
      } catch { toast(T('fileError'), 'error'); }
    });
  }
  async download(doc) { reportSave(await saveFile(`${n3dFileBase(doc.meta.name)}.n3d.json`, JSON.stringify(doc, null, 2), 'application/json')); }

  render() {
    clear(this.root);
    const doc = this.store.doc;
    const fmt = iso => { try { return new Date(iso).toLocaleString(getLang() === 'ar' ? 'ar' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; } };
    const cmp = this.ctx.comparing();
    const current = h('section.card-sec',
      h('h2', T('charsTitle')),
      h('p.lead', h('strong', { attrs: { dir: 'auto' } }, doc.meta.name)),
      h('div.row.wrap',
        h('button.btn.primary', { type: 'button', id: 'n3d-save', onclick: () => this.save(false) }, T('save')),
        h('button.btn', { type: 'button', onclick: () => this.save(true) }, T('saveAs')),
        h('button.btn.ghost', { type: 'button', onclick: () => this.download(doc) }, T('exportJson')),
        h('button.btn.ghost', { type: 'button', onclick: () => this.openFile() }, T('importJson')),
        h('button.btn.ghost', { type: 'button', onclick: () => this.newCharacter() }, T('newCharacter'))),
      cmp ? h('div.row.wrap', h('span.badge.wide', T('comparing', { n: cmp })), h('button.btn.small.ghost', { type: 'button', onclick: () => this.ctx.compare(null) }, T('compareOff'))) : null,
      h('p.muted.small', this.library.mode === 'cloud' ? T('storeCloud') : T('storeLocal')));
    const recs = this.library.sorted();
    const cards = recs.map(rec => {
      const confirming = this.pendingDelete === rec.id, renaming = this.renaming === rec.id;
      let nameEl;
      if (renaming) {
        const inp = h('input.name-input.small', { type: 'text', value: rec.name, maxLength: 80, attrs: { 'aria-label': T('newName'), dir: 'auto' } });
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') this.rename(rec, inp.value); if (e.key === 'Escape') { this.renaming = null; this.render(); } });
        nameEl = h('div.row.tight', inp, h('button.btn.small.primary', { type: 'button', onclick: () => this.rename(rec, inp.value) }, '✓'));
        setTimeout(() => inp.focus(), 0);
      } else nameEl = h('strong.char-name', { attrs: { dir: 'auto' } }, rec.name);
      return h('article.char-card', { dataset: { current: String(rec.id === doc.meta.id), id: rec.id } },
        h('div.char-thumb', rec.thumb ? h('img', { src: rec.thumb, alt: '' }) : null),
        h('div.char-info', nameEl,
          h('span.muted.small', `${T('updated')}: ${fmt(rec.updatedAt)}`),
          confirming
            ? h('div.row.wrap.tight', h('span.warn-text', T('confirmDelete', { n: rec.name })),
              h('button.btn.small.danger', { type: 'button', onclick: async () => { this.pendingDelete = null; await this.library.remove(rec.id); toast(T('deleted')); } }, T('del')),
              h('button.btn.small.ghost', { type: 'button', onclick: () => { this.pendingDelete = null; this.render(); } }, T('cancel')))
            : h('div.row.wrap.tight',
              h('button.btn.small.primary', { type: 'button', onclick: () => this.openRecord(rec) }, T('open')),
              h('button.btn.small', { type: 'button', onclick: () => this.duplicate(rec) }, T('duplicate')),
              h('button.btn.small.ghost', { type: 'button', onclick: () => { this.renaming = rec.id; this.render(); } }, T('rename')),
              h('button.btn.small.ghost', { type: 'button', dataset: { act: 'compare' }, onclick: () => this.ctx.compare(rec) }, T('compare')),
              h('button.btn.small.ghost', { type: 'button', onclick: () => this.download(rec.doc) }, 'JSON'),
              h('button.btn.small.ghost', { type: 'button', onclick: () => { this.pendingDelete = rec.id; this.render(); } }, T('del')))));
    });
    this.root.append(current, h('section.card-sec', h('h2', `${T('savedList')} (${recs.length})`), recs.length ? h('div.char-grid', cards) : h('p.muted', T('noChars'))));
  }
}

/* ------------------------------------------------------------------ EXPORT */
export class N3DExportPanel {
  /** ctx: { store, resultFor(detail) → Promise<res>, viewer, onCheckMode(on) } */
  constructor(root, ctx) {
    this.root = root; this.ctx = ctx; this.busy = false; this.verifyText = '';
    let s = {}; try { s = JSON.parse(prefs.get('n3d.exportSettings', '{}')); } catch { /* defaults */ }
    this.settings = { facing: 'limonat', animations: true, detail: '', ...s };
  }
  get store() { return this.ctx.store; }
  saveSettings() { prefs.set('n3d.exportSettings', JSON.stringify(this.settings)); }
  radio(name, label, options) {
    return h('fieldset.opt', h('legend', label), options.map(([v, text]) => h('label.radio',
      h('input', { type: 'radio', name: 'n3d-' + name, value: v, checked: this.settings[name] === v, onchange: () => { this.settings[name] = v; this.saveSettings(); } }), h('span', text))));
  }
  async run(kind) {
    if (this.busy) return;
    this.busy = true; this.root.classList.add('busy');
    const status = this.root.querySelector('.export-status');
    const detail = this.settings.detail || this.store.doc.detail;
    if (status) status.textContent = T('exportBuilding', { d: Lb(DETAIL_LEVELS[detail].label) });
    try {
      const { buildN3DExport, zipN3D, inspectN3DGLB } = await import('../export/glb.js');
      const res = await this.ctx.resultFor(detail);
      if (status) status.textContent = T('exporting');
      const exp = await buildN3DExport(res, { facing: this.settings.facing, animations: this.settings.animations });
      const f = exp.files;
      if (kind === 'zip') reportSave(await saveFile(exp.base + '.zip', zipN3D(exp), 'application/zip'));
      else if (kind === 'verify') {
        const info = await inspectN3DGLB(f.glb.data);
        await this.ctx.viewer.showGLB(f.glb.data, 'walk');
        this.ctx.onCheckMode(true, info.animations);
        this.verifyText = T('verifyOk', { b: info.bones, m: info.skinnedMeshes, t: info.tris.toLocaleString('en-US'), x: info.textures, a: info.attachments, c: info.animations.join(', ') || '—' });
        this.lastSize = f.glb.data.byteLength;
      } else { const x = f[kind]; reportSave(await saveFile(x.name, x.data, x.mime)); }
      if (kind !== 'verify') this.lastSize = f.glb.data.byteLength;
    } catch (e) {
      console.error(e);
      toast(T('exportFailed', { m: e && e.message ? e.message : String(e) }), 'error', 6000);
    } finally {
      this.busy = false; this.root.classList.remove('busy');
      this.render();
    }
  }
  render() {
    clear(this.root);
    const st = this.ctx.lastStats ? this.ctx.lastStats() : null, res = this.ctx.lastResult ? this.ctx.lastResult() : null;
    const stat = (label, value) => h('div.stat', h('span.stat-label', label), h('span.stat-val', value));
    const anims = h('input', { type: 'checkbox', checked: !!this.settings.animations, onchange: () => { this.settings.animations = anims.checked; this.saveSettings(); } });
    const b = (cls, label, kind) => h('button.btn' + cls, { type: 'button', dataset: { kind }, onclick: () => this.run(kind) }, label);
    const mb = n => (n / 1048576).toFixed(1) + ' MB';
    this.root.append(
      h('section.card-sec',
        h('h2', T('exportTitle')),
        h('p.lead', T('exportHelp')),
        st ? h('div.stats', stat(T('stBones'), 55), stat(T('stMeshes'), st.meshes), stat(T('stTris'), st.tris.toLocaleString('en-US')), stat(T('stHeight'), res ? (res.rig.H + (res.groundOffset || 0)).toFixed(2) + ' m' : '—')) : null,
        h('div.opts',
          this.radio('detail', T('exportDetail'), [['', Lb(DETAIL_LEVELS[this.store.doc.detail].label) + ' ✓'], ...DETAIL_IDS.filter(id => id !== this.store.doc.detail).map(id => [id, Lb(DETAIL_LEVELS[id].label)])]),
          this.radio('facing', T('facing'), [['limonat', T('fLimonat')], ['gltf', T('fGltf')]])),
        h('label.check', anims, h('span', T('anims'))),
        h('div.row.wrap', b('.primary', T('exportAll'), 'zip'), b('', T('exportGlb'), 'glb'), b('', T('exportMeta'), 'meta'), b('', T('exportDoc'), 'doc'), b('', T('exportLimonat'), 'js')),
        h('div.row.wrap', b('.gold', T('verify'), 'verify')),
        h('p.muted.small.export-status', { attrs: { 'aria-live': 'polite' } }, this.lastSize ? T('sizeNote', { s: mb(this.lastSize) }) : ''),
        this.verifyText ? h('div.banner.ok', { id: 'n3d-verify-text' }, this.verifyText) : null),
      h('section.card-sec', h('h3', T('limonatHow')), h('p', T('limonatSteps'))));
  }
}
