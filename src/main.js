/* =====================================================================
 * LIMONAT CHARACTER CREATOR — application entry point.
 * Wires the store (character document + undo), the 3D viewer, the five
 * panels and the character library together. Everything else lives in
 * its own module: assets/ (parts), core/ (skeleton, compiler, document),
 * schema/ (validator, prompt), render/ (Three.js), export/, storage/, ui/.
 * ===================================================================== */
import './assets/index.js';
import { Viewer } from './render/viewer.js';
import { ThumbRenderer, ThumbQueue } from './render/thumbs.js';
import { compile } from './core/compile.js';
import { newDocument, loadDocument } from './core/document.js';
import { defaultBaseId } from './core/registry.js';
import { Store } from './ui/store.js';
import { Library, lastOpen, prefs } from './storage/library.js';
import { h, clear, toast } from './ui/dom.js';
import { LOGO_HEAD } from './ui/logo.js';
import { t, setLang, getLang } from './ui/i18n.js';
import { CustomizePanel } from './ui/customize.js';
import { ImportPanel } from './ui/importer.js';
import { PromptPanel } from './ui/prompt-panel.js';
import { CharactersPanel } from './ui/characters.js';
import { ExportPanel } from './ui/export-panel.js';
import { modeSwitch } from './ui/modes.js';

const TABS = [['customize', 'tabCustomize'], ['ai', 'tabAi'], ['prompt', 'tabPrompt'], ['chars', 'tabChars'], ['export', 'tabExport']];
const VIEWS = [['front', 'vFront'], ['right', 'vSide'], ['back', 'vBack'], ['threeQuarter', 'v34'], ['face', 'vFace']];
const POSES = [['rest', 'pRest'], ['idle', 'pIdle'], ['walk', 'pWalk'], ['wave', 'pWave'], ['tpose', 'pT']];

const el = id => document.getElementById(id);

class App {
  constructor(host) {
    this.host = host;
    this.store = new Store(newDocument(defaultBaseId()));
    this.library = new Library();
    this.tab = TABS.some(([id]) => id === prefs.get('tab', 'customize')) ? prefs.get('tab', 'customize') : 'customize';
    this.pose = prefs.get('pose', 'idle');
    this.spin = false;
    this.checkMode = false;

    // 3D preview (the rest of the app still works if WebGL is unavailable)
    try { this.viewer = new Viewer(el('viewport')); this.viewer.setPose(this.pose); }
    catch (e) { console.error(e); this.viewer = null; el('viewport').append(h('p.no-webgl', 'WebGL is not available in this browser, so the 3D preview is off. Import, editing, saving and export still work.')); }
    this.thumbs = new ThumbRenderer(112);
    this.queue = new ThumbQueue();
    this.cache = new Map();

    const ctx = {
      store: this.store, library: this.library, viewer: this.viewer, thumbs: this.thumbs, queue: this.queue, cache: this.cache,
      goTab: id => this.setTab(id), confirm: (m, y) => this.confirm(m, y), onCheckMode: on => this.setCheckMode(on),
      switchMode: m => this.host && this.host.show(m),
    };
    this.panels = {
      customize: new CustomizePanel(el('tab-customize'), ctx),
      ai: new ImportPanel(el('tab-ai'), ctx),
      prompt: new PromptPanel(el('tab-prompt'), ctx),
      chars: new CharactersPanel(el('tab-chars'), ctx),
      export: new ExportPanel(el('tab-export'), ctx),
    };
    this.stale = new Set(Object.keys(this.panels));

    this.store.subscribe((doc, info) => this.onChange(info));
    this.renderShell();
    this.updateModel();
    this.setTab(this.tab);
    this.bindKeys();
    this.library.start().then(() => this.restoreLast());
  }

  // ------------------------------------------------------------------ show / hide (mode switching)
  pause() { if (this.viewer && this.viewer.pause) this.viewer.pause(); }
  onShow() {
    if (this.lang !== getLang()) { this.renderShell(); for (const k of Object.keys(this.panels)) this.stale.add(k); this.setTab(this.tab); }
    if (this.viewer && this.viewer.resume) { this.viewer.resume(); this.viewer.resize(); }
    document.title = t('appTitle');
  }

  // ------------------------------------------------------------------ state → view
  onChange(info) {
    if (info.kind === 'noop') return;
    if (info.kind !== 'saved') {
      if (this.checkMode) this.setCheckMode(false);
      this.scheduleModel();
    }
    this.updateHeader();
    if (info.kind === 'preview') return;           // keep inputs alive while dragging
    for (const k of Object.keys(this.panels)) if (k !== 'prompt') this.stale.add(k);
    this.renderPanel(this.tab);
  }

  scheduleModel() {
    if (this.modelQueued) return;
    this.modelQueued = true;
    requestAnimationFrame(() => { this.modelQueued = false; this.updateModel(); });
  }

  updateModel() {
    if (!this.viewer) return;
    try { this.viewer.setModel(compile(this.store.config)); }
    catch (e) { console.error(e); toast('Preview error: ' + e.message, 'error', 5000); }
  }

  renderPanel(id) {
    if (!this.stale.has(id)) return;
    this.stale.delete(id);
    const p = this.panels[id];
    p.visible = true;
    try { p.render(); } catch (e) { console.error(e); clear(p.root).append(h('p.banner.error', 'This panel failed to draw: ' + e.message)); }
  }

  setTab(id) {
    this.tab = id;
    prefs.set('tab', id);
    for (const [tid] of TABS) {
      const panel = el('tab-' + tid), btn = el('tabbtn-' + tid);
      panel.hidden = tid !== id;
      this.panels[tid].visible = tid === id;
      if (btn) { btn.setAttribute('aria-selected', String(tid === id)); btn.tabIndex = tid === id ? 0 : -1; }
    }
    this.renderPanel(id);
  }

  restoreLast() {
    const id = lastOpen.get(), rec = id && this.library.get(id);
    if (!rec || this.store.canUndo() || this.store.dirtyOrNew()) return;
    const r = loadDocument(rec.doc);
    if (!r.doc) return;
    this.store.replace(r.doc, 'open', { resetHistory: true });
    this.store.markSaved();
  }

  setCheckMode(on) {
    this.checkMode = on;
    if (!on && this.viewer) this.viewer.hideGLB();
    this.renderStageTools();
  }

  // ------------------------------------------------------------------ shell
  renderShell() {
    this.lang = getLang();
    if (!el('app').hidden) document.title = t('appTitle');
    const top = clear(el('topbar'));
    this.nameInput = h('input.name-input', {
      id: 'char-name', type: 'text', maxLength: 40, value: this.store.config.name, attrs: { 'aria-label': t('name'), dir: 'auto', autocomplete: 'off' },
    });
    this.nameInput.addEventListener('input', () => { const v = this.nameInput.value; if (v.trim()) this.store.preview(c => { c.name = v.trim().slice(0, 40); }); });
    this.nameInput.addEventListener('change', () => { if (!this.nameInput.value.trim()) this.nameInput.value = this.store.config.name; this.store.commit(c => { c.name = this.nameInput.value.trim().slice(0, 40) || c.name; }, t('name')); });
    this.statusChip = h('span.status-chip');
    this.undoBtn = h('button.btn.small.icon', { type: 'button', title: t('undo') + ' (Ctrl+Z)', attrs: { 'aria-label': t('undo') }, onclick: () => this.store.undo() }, '↶');
    this.redoBtn = h('button.btn.small.icon', { type: 'button', title: t('redo') + ' (Ctrl+Shift+Z)', attrs: { 'aria-label': t('redo') }, onclick: () => this.store.redo() }, '↷');
    const langBtn = h('button.btn.small.lang', { type: 'button', title: t('langLabel'), attrs: { 'aria-label': t('langLabel') }, onclick: () => this.toggleLang() }, t('lang'));
    top.append(
      h('div.brand', h('img.logo', { src: LOGO_HEAD, alt: '', width: 40, height: 40, attrs: { 'aria-hidden': 'true' } }), h('div.brand-text', h('h1', t('appTitle')), h('span.brand-sub', t('appSub')))),
      this.host ? modeSwitch('voxel', m => this.host.show(m)) : null,
      h('label.name-wrap', h('span.sr', t('name')), this.nameInput, this.statusChip),
      h('div.top-actions', this.undoBtn, this.redoBtn, langBtn));

    const tabs = clear(el('tabs'));
    TABS.forEach(([id, key]) => tabs.append(h('button.tab', {
      id: 'tabbtn-' + id, type: 'button', attrs: { role: 'tab', 'aria-controls': 'tab-' + id, 'aria-selected': String(id === this.tab) },
      onclick: () => this.setTab(id),
    }, h('span.tab-icon', { attrs: { 'aria-hidden': 'true' }, dataset: { icon: id } }), h('span.tab-label', t(key)))));
    tabs.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const i = TABS.findIndex(([id]) => id === this.tab), rtl = getLang() === 'ar';
      const step = (e.key === 'ArrowRight') !== rtl ? 1 : -1;
      const next = TABS[(i + step + TABS.length) % TABS.length][0];
      this.setTab(next); el('tabbtn-' + next).focus();
    });
    this.renderStageTools();
    this.updateHeader();
  }

  renderStageTools() {
    const tools = clear(el('stage-tools'));
    if (!this.viewer) return;
    const seg = (items, cur, fn, label) => h('div.seg.seg-stage', { attrs: { role: 'group', 'aria-label': label } },
      items.map(([v, key]) => h('button', { type: 'button', attrs: { 'aria-pressed': String(v === cur) }, onclick: () => fn(v) }, t(key))));
    if (this.checkMode) {
      tools.append(h('div.check-banner', h('span', '✓ ' + t('checkMode')), h('button.btn.small.gold', { type: 'button', onclick: () => this.setCheckMode(false) }, t('backToEditor'))));
    }
    tools.append(
      h('div.stage-top', seg(VIEWS, null, v => this.viewer.setView(v), 'View')),
      h('div.stage-bottom',
        this.checkMode ? null : seg(POSES, this.pose, v => { this.pose = v; prefs.set('pose', v); this.viewer.setPose(v); this.renderStageTools(); }, 'Pose'),
        h('button.btn.small.spin', { type: 'button', attrs: { 'aria-pressed': String(this.spin) }, onclick: () => { this.spin = !this.spin; this.viewer.setAutoRotate(this.spin); this.renderStageTools(); } }, '⟳ ' + t('spin'))),
      h('p.stage-hint', t('viewHint')));
  }

  updateHeader() {
    if (!this.nameInput) return;
    if (document.activeElement !== this.nameInput) this.nameInput.value = this.store.config.name;
    const st = this.store.status();
    this.statusChip.textContent = st === 'saved' ? t('savedChip') : st === 'unsaved' ? t('unsaved') : t('newChip');
    this.statusChip.dataset.status = st;
    this.undoBtn.disabled = !this.store.canUndo();
    this.redoBtn.disabled = !this.store.canRedo();
  }

  toggleLang() {
    setLang(getLang() === 'ar' ? 'en' : 'ar');
    prefs.set('lang', getLang());
    this.renderShell();
    for (const k of Object.keys(this.panels)) this.stale.add(k);
    this.setTab(this.tab);
  }

  bindKeys() {
    window.addEventListener('keydown', e => {
      if (el('app').hidden) return;
      const typing = e.target && (e.target.tagName === 'TEXTAREA' || (e.target.tagName === 'INPUT' && /text|search|number/.test(e.target.type)));
      if (typing || !(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); this.store.undo(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); this.store.redo(); }
    });
  }

  /** In-page confirmation (the artifact viewer does not show window.confirm). */
  confirm(message, yesLabel) {
    return new Promise(resolve => {
      const root = el('modal-root');
      const done = v => { root.hidden = true; clear(root); document.removeEventListener('keydown', onKey); resolve(v); };
      const onKey = e => { if (e.key === 'Escape') done(false); };
      const yes = h('button.btn.danger', { type: 'button', onclick: () => done(true) }, yesLabel);
      clear(root).append(h('div.modal', { attrs: { role: 'alertdialog', 'aria-modal': 'true', 'aria-label': message } },
        h('p', message), h('div.row.wrap', yes, h('button.btn.ghost', { type: 'button', onclick: () => done(false) }, t('cancel')))));
      root.hidden = false;
      document.addEventListener('keydown', onKey);
      yes.focus();
    });
  }
}

/**
 * Two independent creation modes share the page: Voxel (#app, this file)
 * and Normal 3D (#app3d, src/n3d/ui/app.js, loaded the first time it is
 * opened). The chosen mode is remembered per browser.
 */
class ModeHost {
  constructor() { this.apps = {}; this.mode = null; }
  async show(mode) {
    mode = mode === 'n3d' ? 'n3d' : 'voxel';
    prefs.set('mode', mode);
    this.mode = mode;
    el('app').hidden = mode !== 'voxel';
    el('app3d').hidden = mode !== 'n3d';
    for (const [m, a] of Object.entries(this.apps)) if (m !== mode && a.pause) a.pause();
    try {
      if (!this.apps[mode]) {
        if (mode === 'voxel') { this.apps.voxel = new App(this); window.limonatCreator = this.apps.voxel; }
        else {
          el('app3d').append(h('p.banner.loading', '…'));
          const { N3DApp } = await import('./n3d/ui/app.js');
          if (this.mode !== 'n3d') return;
          this.apps.n3d = new N3DApp(el('app3d'), this);
          window.limonatCreator3D = this.apps.n3d;
        }
      }
      this.apps[mode].onShow();
    } catch (e) {
      console.error(e);
      const root = el(mode === 'voxel' ? 'app' : 'app3d');
      if (root) root.append(h('p.banner.error', 'The creator failed to start: ' + e.message));
    }
  }
}

function boot() {
  setLang(prefs.get('lang', 'ar'));
  const host = window.limonatModes = new ModeHost();
  host.show(prefs.get('mode', 'voxel'));
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
