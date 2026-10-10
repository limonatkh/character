/* =====================================================================
 * CHARACTERS PANEL — choose a base, name / save / load / duplicate /
 * delete designs, open and download character files, reset to base.
 * ===================================================================== */
import { h, clear, toast, pickFile, readFileText } from './dom.js';
import { t, L, getLang } from './i18n.js';
import { listBases, getBase } from '../core/registry.js';
import { compile } from '../core/compile.js';
import { newDocument, newId, loadDocument, finalizeDocument } from '../core/document.js';
import { baseConfig, extractJson } from '../schema/validate.js';
import { fileBase } from '../export/gltf.js';
import { saveFile } from '../export/download.js';
import { reportSave } from './export-panel.js';
import { lastOpen } from '../storage/library.js';

const clone = v => JSON.parse(JSON.stringify(v));

export class CharactersPanel {
  /** ctx: { store, library, thumbs, cache, confirm(msg, yes) → Promise<bool> } */
  constructor(root, ctx) {
    this.root = root;
    this.ctx = ctx;
    this.pendingDelete = null;
    this.baseThumbs = {};
    ctx.library.subscribe(() => { if (this.visible) this.render(); });
  }
  get store() { return this.ctx.store; }
  get library() { return this.ctx.library; }

  thumbOf(doc) {
    try { return this.ctx.thumbs.render(compile(doc.character), 'full', { quality: 0.8 }); } catch { return ''; }
  }

  /** Ask before throwing away unsaved changes. */
  async guard() {
    if (!this.store.dirtyOrNew()) return true;
    return this.ctx.confirm(t('confirmLeave'), t('confirmLeaveYes'));
  }

  async save(asCopy) {
    let doc = finalizeDocument(this.store.doc);
    if (asCopy) {
      doc = { ...doc, id: newId(), character: { ...doc.character, name: (doc.character.name + t('copySuffix')).slice(0, 40) } };
      this.store.replace(doc, t('saveCopy'));
    } else this.store.replace(doc, t('save'), { silent: true });
    try {
      await this.library.save(doc, this.thumbOf(doc));
      this.store.markSaved();
      lastOpen.set(doc.id);
      toast(t('savedToast', { n: doc.character.name }));
    } catch (e) {
      toast(t('saveFailed', { m: e && e.message ? e.message : String(e) }), 'error', 5000);
    }
    this.render();
  }

  async openRecord(rec) {
    if (!(await this.guard())) return;
    const r = loadDocument(rec.doc);
    if (!r.doc) { toast(t('rRejected'), 'error'); return; }
    this.store.replace(r.doc, t('open'));
    this.store.markSaved();
    lastOpen.set(r.doc.id);
    toast(t('loadedToast', { n: r.doc.character.name }));
    this.render();
  }

  async duplicate(rec) {
    const doc = clone(rec.doc);
    doc.id = newId();
    doc.character.name = (doc.character.name + t('copySuffix')).slice(0, 40);
    try { await this.library.save(doc, rec.thumb); toast(t('savedToast', { n: doc.character.name })); } catch (e) { toast(t('saveFailed', { m: e.message }), 'error'); }
  }

  async newFrom(baseId) {
    if (!(await this.guard())) return;
    this.store.replace(newDocument(baseId), t('newFromBase'));
    this.store.markUnsavedNew();
    this.render();
  }

  openFile() {
    pickFile('.json,application/json,text/plain', async f => {
      try {
        const ex = extractJson(await readFileText(f));
        if (ex.error) { toast(ex.error, 'error', 6000); return; }
        if (!(await this.guard())) return;
        const r = loadDocument(ex.value);
        if (!r.doc) { toast(r.result.errors.map(e => e.message).join(' '), 'error', 6000); return; }
        this.store.replace(r.doc, t('openJson'));
        this.store.markUnsavedNew();
        const nErr = r.result.errors.length;
        toast(t('loadedToast', { n: r.doc.character.name }) + (nErr ? ` (${nErr} ${t('lvError')})` : ''), nErr ? 'warn' : 'ok', 3500);
        this.render();
      } catch { toast(t('fileReadError'), 'error'); }
    });
  }

  async download(doc) {
    const d = finalizeDocument(doc);
    reportSave(await saveFile(`${fileBase(d.character.name)}.character.json`, JSON.stringify(d, null, 2), 'application/json'));
  }

  resetToBase() {
    const id = this.store.doc.baseCharacter;
    this.store.commit((c, doc) => { const name = c.name; Object.assign(c, baseConfig(id)); c.name = name; doc.reference = undefined; delete doc.reference; delete doc.uncertain; delete doc.unsupported; }, t('resetBase'));
  }

  baseThumb(id) {
    if (this.baseThumbs[id] === undefined) {
      try { this.baseThumbs[id] = this.ctx.thumbs.render(compile(baseConfig(id)), 'full'); } catch { this.baseThumbs[id] = ''; }
    }
    return this.baseThumbs[id];
  }

  render() {
    clear(this.root);
    const doc = this.store.doc, cur = getBase(doc.baseCharacter);
    const fmt = iso => { try { return new Date(iso).toLocaleString(getLang() === 'ar' ? 'ar' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; } };

    const currentSec = h('section.card-sec',
      h('h2', t('current')),
      h('p.lead', h('strong', doc.character.name), ' · ', L(cur ? cur.label : '')),
      h('div.row.wrap',
        h('button.btn.primary', { type: 'button', id: 'btn-save', onclick: () => this.save(false) }, t('save')),
        h('button.btn', { type: 'button', onclick: () => this.save(true) }, t('saveCopy')),
        h('button.btn.ghost', { type: 'button', onclick: () => this.download(doc) }, t('dlJson')),
        h('button.btn.ghost', { type: 'button', onclick: () => this.openFile() }, t('openJson')),
        h('button.btn.ghost', { type: 'button', onclick: () => this.resetToBase() }, t('resetBase'))),
      h('p.muted.small', this.library.mode === 'cloud' ? t('storeCloud') : t('storeLocal')));

    const recs = this.library.sorted();
    const cards = recs.map(rec => {
      const confirming = this.pendingDelete === rec.id;
      const isCurrent = rec.id === doc.id;
      return h('article.char-card', { dataset: { current: String(isCurrent) } },
        h('div.char-thumb', rec.thumb ? h('img', { src: rec.thumb, alt: '' }) : null),
        h('div.char-info',
          h('strong.char-name', { attrs: { dir: 'auto' } }, rec.name),
          h('span.muted.small', `${t('updated')}: ${fmt(rec.updatedAt)}`),
          confirming
            ? h('div.row.wrap.tight', h('span.warn-text', t('confirmDel')),
              h('button.btn.small.danger', { type: 'button', onclick: async () => { this.pendingDelete = null; await this.library.remove(rec.id); toast(t('deletedToast')); } }, t('yesDel')),
              h('button.btn.small.ghost', { type: 'button', onclick: () => { this.pendingDelete = null; this.render(); } }, t('cancel')))
            : h('div.row.wrap.tight',
              h('button.btn.small.primary', { type: 'button', onclick: () => this.openRecord(rec) }, t('open')),
              h('button.btn.small', { type: 'button', onclick: () => this.duplicate(rec) }, t('duplicate')),
              h('button.btn.small.ghost', { type: 'button', onclick: () => this.download(rec.doc) }, 'JSON'),
              h('button.btn.small.ghost', { type: 'button', onclick: () => { this.pendingDelete = rec.id; this.render(); } }, t('del')))));
    });
    const libSec = h('section.card-sec',
      h('h2', `${t('savedList')} (${recs.length})`),
      recs.length ? h('div.char-grid', cards) : h('p.muted', t('emptyLib')));

    const basesSec = h('section.card-sec',
      h('h2', t('newFromBase')),
      h('p.lead', t('basesHelp')),
      h('div.base-grid', listBases().map(b => h('button.base-card', { type: 'button', title: b.description, onclick: () => this.newFrom(b.id), attrs: { 'aria-pressed': String(b.id === doc.baseCharacter) } },
        h('span.base-thumb', this.baseThumb(b.id) ? h('img', { src: this.baseThumb(b.id), alt: '' }) : null),
        h('span.base-name', L(b.label))))));

    this.root.append(currentSec, libSec, basesSec);
  }
}
