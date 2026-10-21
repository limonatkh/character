/* =====================================================================
 * NORMAL 3D CREATOR — application shell of the second creation mode.
 * Fully independent of the Voxel creator: own store (limonat-character-3d
 * documents), build worker, studio viewer, panels, library namespace,
 * prompt / schema and GLB exporter. Shares only the page, the language,
 * the visual style and the mode switch.
 * ===================================================================== */
import '../assets/index.js';
import { N3DViewer } from '../render/viewer3d.js';
import { BuildClient } from '../build/client.js';
import { N3DStore } from './store.js';
import { createN3DDocument } from '../core/document.js';
import { FACE_PARAMS } from '../core/params.js';
import { listAssets } from '../core/registry.js';
import { validateN3D } from '../schema/validate.js';
import { BODY_PRESETS } from '../assets/presets.js';
import { Library, prefs, makeLastOpen } from '../../storage/library.js';
import { h, clear, toast } from '../../ui/dom.js';
import { setLang, getLang } from '../../ui/i18n.js';
import { LOGO_HEAD } from '../../ui/logo.js';
import { modeSwitch } from '../../ui/modes.js';
import { T } from './strings.js';
import { PALETTE } from './controls.js';
import { N3DCustomize } from './customize.js';
import { N3DImportPanel, N3DPromptPanel, N3DCharactersPanel, N3DExportPanel } from './panels.js';
import THUMBS from '../assets/thumbs.js';

const TABS = [['customize', 'tabCustomize'], ['ai', 'tabAi'], ['prompt', 'tabPrompt'], ['chars', 'tabChars'], ['export', 'tabExport']];
const VIEWS = [['front', 'vFront'], ['side', 'vSide'], ['back', 'vBack'], ['threeQuarter', 'v34'], ['face', 'vFace'], ['upper', 'vUpper'], ['hands', 'vHands'], ['feet', 'vFeet']];
const POSES = [['rest', 'pRest'], ['relaxed', 'pRelaxed'], ['idle', 'pIdle'], ['walk', 'pWalk'], ['wave', 'pWave'], ['tpose', 'pT']];
const LIGHTING = [['studio', 'lStudio'], ['daylight', 'lDay'], ['indoor', 'lIndoor'], ['dramatic', 'lDramatic'], ['flat', 'lFlat']];
const MODES = [['pbr', 'mPbr'], ['clay', 'mClay'], ['wire', 'mWire'], ['normals', 'mNormals'], ['uv', 'mUv'], ['materials', 'mMaterials']];
const geoKey = doc => JSON.stringify({ ...doc, meta: null });
const pick = a => a[Math.floor(Math.random() * a.length)];

export class N3DApp {
  /** root: the #app3d element; host: { show(mode) } */
  constructor(root, host) {
    this.root = root; this.host = host;
    this.store = new N3DStore(createN3DDocument());
    this.library = new Library({ kind: 'n3d', storageKey: 'limonat-cc.n3d.library.v1', describe: d => ({ id: d.meta.id, name: d.meta.name }) });
    this.lastOpen = makeLastOpen('limonat-cc.n3d.last');
    this.tab = TABS.some(([id]) => id === prefs.get('n3d.tab', 'customize')) ? prefs.get('n3d.tab', 'customize') : 'customize';
    this.pose = prefs.get('n3d.pose', 'relaxed');
    this.inspect = 'pbr'; this.spin = false; this.check = null;
    this.lighting = LIGHTING.some(([v]) => v === prefs.get('n3d.lighting', 'studio')) ? prefs.get('n3d.lighting', 'studio') : 'studio';
    this.res = null; this.resKey = ''; this.building = false; this.progress = null; this.comparing = null;
    this.client = new BuildClient();
    this.layout();
    try { this.viewer = new N3DViewer(this.el.viewport); this.viewer.setPose(this.pose); this.viewer.setLighting(this.lighting); }
    catch (e) { console.error(e); this.viewer = null; this.el.viewport.append(h('p.no-webgl', 'WebGL is not available in this browser, so the 3D preview is off. Editing, saving and export still work.')); }

    const ctx = {
      store: this.store, library: this.library, viewer: this.viewer, lastOpen: this.lastOpen,
      thumb: id => THUMBS[id] || '', lastStats: () => this.res && this.res.stats, lastResult: () => this.res,
      applyJson: text => this.applyJson(text), randomize: () => this.randomize(), confirm: (m, y) => this.confirm(m, y),
      goTab: id => this.setTab(id), switchMode: m => this.host.show(m),
      thumbnail: () => (this.viewer && !this.check ? this.viewer.thumbnail(160) : Promise.resolve('')),
      compare: rec => this.compare(rec), comparing: () => this.comparing,
      resultFor: detail => this.resultFor(detail), onCheckMode: (on, clips) => this.setCheckMode(on, clips),
    };
    this.panels = {
      customize: new N3DCustomize(this.el.tab.customize, ctx),
      ai: new N3DImportPanel(this.el.tab.ai, ctx),
      prompt: new N3DPromptPanel(this.el.tab.prompt, ctx),
      chars: new N3DCharactersPanel(this.el.tab.chars, ctx),
      export: new N3DExportPanel(this.el.tab.export, ctx),
    };
    this.stale = new Set(Object.keys(this.panels));
    this.store.subscribe((doc, info) => this.onChange(info));
    this.renderShell();
    this.setTab(this.tab);
    this.bindKeys();
    this.requestBuild();
    this.library.start().then(() => this.restoreLast());
  }

  // ------------------------------------------------------------------ DOM skeleton (ids are prefixed n3d-)
  layout() {
    const tab = {};
    const panels = h('main.panels', TABS.map(([id]) => (tab[id] = h('div.tabpanel', { id: 'n3d-tab-' + id, attrs: { role: 'tabpanel', 'aria-labelledby': 'n3d-tabbtn-' + id }, hidden: true }))));
    this.el = {
      top: h('header.topbar', { id: 'n3d-topbar' }),
      viewport: h('div.viewport', { id: 'n3d-viewport' }),
      tools: h('div.stage-tools', { id: 'n3d-stage-tools' }),
      tabs: h('nav.tabs', { id: 'n3d-tabs', attrs: { role: 'tablist', 'aria-label': 'Sections' } }),
      tab,
    };
    clear(this.root).append(this.el.top, h('section.stage.n3d-stage', { attrs: { 'aria-label': '3D preview' } }, this.el.viewport, this.el.tools), this.el.tabs, panels);
  }

  // ------------------------------------------------------------------ show / hide (mode switching)
  pause() { if (this.viewer) this.viewer.pause(); }
  onShow() {
    if (this.lang !== getLang()) { this.renderShell(); for (const k of Object.keys(this.panels)) this.stale.add(k); this.setTab(this.tab); }
    if (this.viewer) { this.viewer.resume(); this.viewer.resize(); }
    document.title = T('appTitle') + ' — ' + T('modeN3D');
  }

  // ------------------------------------------------------------------ state → view
  onChange(info) {
    if (info.kind === 'noop') return;
    if (info.kind !== 'saved') {
      if (this.check) this.setCheckMode(false);
      if (geoKey(this.store.doc) !== this.resKey) this.requestBuild(info.kind === 'preview' ? 90 : 10);
    }
    this.updateHeader();
    if (info.kind === 'preview') return;
    for (const k of Object.keys(this.panels)) if (k !== 'prompt') this.stale.add(k);
    this.renderPanel(this.tab);
  }

  requestBuild(delay = 10) {
    clearTimeout(this.buildTimer);
    this.buildTimer = setTimeout(() => this.runBuild(), delay);
  }
  async runBuild() {
    const doc = this.store.doc, key = geoKey(doc);
    this.building = true; this.progress = null; this.renderStatus();
    const out = await this.client.build(doc, doc.detail, (stage, f) => { this.progress = { stage, f }; this.renderStatus(); });
    if (out.superseded) return;
    this.building = false;
    if (out.error) {
      console.error(out.error);
      toast(T('buildError', { m: String(out.error).split('\n')[0].slice(0, 160) }), 'error', 6000);
      this.renderStatus();
      return;
    }
    this.res = out.result; this.resKey = key;
    if (this.viewer) this.viewer.setCharacter(this.res);
    if (this.res.errors && this.res.errors.length) toast(T('buildError', { m: this.res.errors.map(e => e.item || e.message || e).join(', ').slice(0, 160) }), 'warn', 5000);
    this.renderStatus();
    if (this.tab === 'export' || (this.tab === 'customize' && this.panels.customize.section === 'adv')) { this.stale.add(this.tab); this.renderPanel(this.tab); }
    else { this.stale.add('export'); }
    this.whenBuilt && this.whenBuilt();
  }
  /** True when the preview shows the current document (tests and the exporter wait on this). */
  isCurrent() { return !!this.res && !this.building && this.resKey === geoKey(this.store.doc); }
  /** A build result at a given detail level for the current document (used by the exporter). */
  async resultFor(detail) {
    const doc = this.store.doc, key = geoKey(doc);
    if (detail === doc.detail) {
      if (this.res && this.resKey === key) return { ...this.res, doc };
      for (let i = 0; i < 600 && !(this.res && this.resKey === geoKey(this.store.doc)); i++) await new Promise(r => setTimeout(r, 100));
      if (this.res && this.resKey === geoKey(this.store.doc)) return { ...this.res, doc: this.store.doc };
    }
    if (!this.exportClient) this.exportClient = new BuildClient();
    const out = await this.exportClient.build({ ...doc, detail }, detail);
    if (out.error) throw new Error(String(out.error).split('\n')[0]);
    if (out.superseded) throw new Error('superseded');
    return { ...out.result, doc: { ...doc, detail } };
  }
  async compare(rec) {
    if (!rec) { this.comparing = null; if (this.viewer) this.viewer.setCompare(null); this.stale.add('chars'); this.renderPanel(this.tab); return; }
    if (!this.compareClient) this.compareClient = new BuildClient();
    this.comparing = rec.name; this.renderPanel(this.tab);
    toast(T('building'));
    const r = validateN3D(rec.doc, { mode: 'replace' });
    const out = await this.compareClient.build(r.doc, r.doc.detail);
    if (out.result && this.viewer && this.comparing === rec.name) this.viewer.setCompare(out.result);
    this.stale.add('chars'); this.renderPanel(this.tab);
  }

  renderPanel(id) {
    if (!this.stale.has(id)) return;
    this.stale.delete(id);
    const p = this.panels[id];
    p.visible = true;
    try { p.render(); } catch (e) { console.error(e); clear(p.root).append(h('p.banner.error', 'This panel failed to draw: ' + e.message)); }
  }
  setTab(id) {
    this.tab = id; prefs.set('n3d.tab', id);
    for (const [tid] of TABS) {
      const btn = this.root.querySelector('#n3d-tabbtn-' + tid);
      this.el.tab[tid].hidden = tid !== id;
      this.panels[tid].visible = tid === id;
      if (btn) { btn.setAttribute('aria-selected', String(tid === id)); btn.tabIndex = tid === id ? 0 : -1; }
    }
    this.renderPanel(id);
  }
  restoreLast() {
    const id = this.lastOpen.get(), rec = id && this.library.get(id);
    if (!rec || this.store.canUndo()) return;          // the user already started editing
    const r = validateN3D(rec.doc, { mode: 'replace' });
    this.store.replace(r.doc, 'open', { resetHistory: true });
    this.store.markSaved();
  }

  // ------------------------------------------------------------------ shell
  renderShell() {
    this.lang = getLang();
    if (!this.root.hidden) document.title = T('appTitle') + ' — ' + T('modeN3D');
    const top = clear(this.el.top);
    this.nameInput = h('input.name-input', { id: 'n3d-name', type: 'text', maxLength: 80, value: this.store.doc.meta.name, attrs: { 'aria-label': T('name'), dir: 'auto', autocomplete: 'off' } });
    this.nameInput.addEventListener('input', () => { const v = this.nameInput.value.trim(); if (v) this.store.preview(d => { d.meta.name = v.slice(0, 80); }); });
    this.nameInput.addEventListener('change', () => { if (!this.nameInput.value.trim()) this.nameInput.value = this.store.doc.meta.name; this.store.commit(d => { d.meta.name = this.nameInput.value.trim().slice(0, 80) || d.meta.name; }, T('name')); });
    this.statusChip = h('span.status-chip');
    this.undoBtn = h('button.btn.small.icon', { type: 'button', id: 'n3d-undo', title: T('undo') + ' (Ctrl+Z)', attrs: { 'aria-label': T('undo') }, onclick: () => this.store.undo() }, '↶');
    this.redoBtn = h('button.btn.small.icon', { type: 'button', id: 'n3d-redo', title: T('redo') + ' (Ctrl+Shift+Z)', attrs: { 'aria-label': T('redo') }, onclick: () => this.store.redo() }, '↷');
    const langBtn = h('button.btn.small.lang', { type: 'button', title: 'العربية / English', attrs: { 'aria-label': 'Language' }, onclick: () => this.toggleLang() }, getLang() === 'ar' ? 'EN' : 'ع');
    top.append(
      h('div.brand', h('img.logo', { src: LOGO_HEAD, alt: '', width: 40, height: 40, attrs: { 'aria-hidden': 'true' } }), h('div.brand-text', h('h1', T('appTitle')), h('span.brand-sub', T('appSub')))),
      modeSwitch('n3d', m => this.host.show(m)),
      h('label.name-wrap', h('span.sr', T('name')), this.nameInput, this.statusChip),
      h('div.top-actions', this.undoBtn, this.redoBtn, langBtn));
    const tabs = clear(this.el.tabs);
    TABS.forEach(([id, key]) => tabs.append(h('button.tab', {
      id: 'n3d-tabbtn-' + id, type: 'button', attrs: { role: 'tab', 'aria-controls': 'n3d-tab-' + id, 'aria-selected': String(id === this.tab) },
      onclick: () => this.setTab(id),
    }, h('span.tab-label', T(key)))));
    tabs.onkeydown = e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const i = TABS.findIndex(([id]) => id === this.tab), rtl = getLang() === 'ar';
      const next = TABS[(i + ((e.key === 'ArrowRight') !== rtl ? 1 : -1) + TABS.length) % TABS.length][0];
      this.setTab(next); this.root.querySelector('#n3d-tabbtn-' + next).focus();
    };
    this.renderStageTools();
    this.updateHeader();
  }

  renderStageTools() {
    const tools = clear(this.el.tools);
    if (!this.viewer) return;
    const seg = (items, cur, fn, label, cls = '') => h('div.seg.seg-stage' + cls, { attrs: { role: 'group', 'aria-label': label } },
      items.map(([v, key]) => h('button', { type: 'button', dataset: { v }, attrs: { 'aria-pressed': String(v === cur) }, onclick: () => fn(v) }, T(key))));
    this.statusEl = h('div.build-chip', { attrs: { role: 'status', 'aria-live': 'polite' } });
    if (this.check) {
      tools.append(h('div.check-banner', h('span', '✓ ' + T('checkMode')),
        this.check.clips && this.check.clips.length ? h('div.seg.seg-stage', this.check.clips.map(c => h('button', { type: 'button', onclick: () => this.viewer.playGLB(c) }, c))) : null,
        h('button.btn.small.gold', { type: 'button', onclick: () => this.setCheckMode(false) }, T('backToEditor'))));
    }
    const modeSel = h('select.select.stage-select', { attrs: { 'aria-label': T('inspect') }, onchange: () => { this.inspect = modeSel.value; this.viewer.setMode(this.inspect); } },
      MODES.map(([v, k]) => h('option', { value: v, selected: v === this.inspect }, T(k))));
    const lightSel = h('select.select.stage-select', { id: 'n3d-lighting', attrs: { 'aria-label': T('lighting') }, onchange: () => { this.lighting = lightSel.value; prefs.set('n3d.lighting', this.lighting); this.viewer.setLighting(this.lighting); } },
      LIGHTING.map(([v, k]) => h('option', { value: v, selected: v === this.lighting }, '☀ ' + T(k))));
    tools.append(
      this.statusEl,
      h('div.stage-top', seg(VIEWS, null, v => this.viewer.setView(v), T('vFront'))),
      h('div.stage-bottom',
        this.check ? null : seg(POSES, this.pose, v => { this.pose = v; prefs.set('n3d.pose', v); this.viewer.setPose(v); this.renderStageTools(); }, T('pose'), '.poses'),
        h('label.stage-mode', h('span.sr', T('inspect')), modeSel),
        h('label.stage-mode', h('span.sr', T('lighting')), lightSel),
        h('button.btn.small.spin', { type: 'button', attrs: { 'aria-pressed': String(this.spin) }, onclick: () => { this.spin = !this.spin; this.viewer.setAutoRotate(this.spin); this.renderStageTools(); } }, '⟳ ' + T('spin'))),
      h('p.stage-hint', T('viewHint')));
    this.renderStatus();
  }
  renderStatus() {
    const el = this.statusEl; if (!el) return;
    clear(el);
    el.hidden = !this.building && !(this.comparing);
    if (this.building) {
      const p = this.progress;
      el.append(h('span.spinner', { attrs: { 'aria-hidden': 'true' } }), h('span', T('building') + (p && p.stage ? ' ' + T('stage_' + p.stage) : '')),
        h('span.bar', h('span.bar-fill', { style: { width: Math.round(100 * (p ? p.f : 0.05)) + '%' } })));
    } else if (this.comparing) el.append(h('span', T('comparing', { n: this.comparing })), h('button.btn.small.ghost', { type: 'button', onclick: () => this.compare(null) }, T('compareOff')));
  }
  setCheckMode(on, clips) {
    this.check = on ? { clips: clips || [] } : null;
    if (!on && this.viewer) this.viewer.hideGLB();
    this.renderStageTools();
  }
  updateHeader() {
    if (!this.nameInput) return;
    if (document.activeElement !== this.nameInput) this.nameInput.value = this.store.doc.meta.name;
    const st = this.store.status();
    this.statusChip.textContent = st === 'saved' ? T('savedChip') : st === 'unsaved' ? T('unsaved') : T('newChip');
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
      if (this.root.hidden) return;
      const typing = e.target && (e.target.tagName === 'TEXTAREA' || (e.target.tagName === 'INPUT' && /text|search|number/.test(e.target.type)));
      if (typing || !(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); this.store.undo(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); this.store.redo(); }
    });
  }

  // ------------------------------------------------------------------ actions used by the panels
  applyJson(text) {
    const r = validateN3D(text, { mode: 'replace' });
    if (!r.ok) { toast(`${T('errorsN', { n: r.errors.length })}: ${r.errors[0].path} — ${r.errors[0].message}`, 'error', 6000); return; }
    r.doc.meta = { ...r.doc.meta, id: this.store.doc.meta.id };
    this.store.replace(r.doc, T('applyJson'));
    toast(T('applied') + (r.warnings.length ? ` (${T('warningsN', { n: r.warnings.length })})` : ''));
  }
  randomize() {
    const p = pick(listAssets('preset'));
    const cur = this.store.doc;
    const doc = createN3DDocument({ ...JSON.parse(JSON.stringify(p.doc)), meta: { ...cur.meta }, detail: cur.detail });
    const bp = pick(Object.values(BODY_PRESETS).filter(x => !('stylization' in x.body)));
    for (const [k, v] of Object.entries(bp.body)) if (k !== 'masculinity' && k !== 'height') doc.body[k] = v;
    doc.body.height = Math.round((doc.body.masculinity > 0.5 ? 1.68 + Math.random() * 0.22 : 1.55 + Math.random() * 0.2) * 100) / 100;
    for (const [k, s] of Object.entries(FACE_PARAMS)) doc.face[k] = Math.round((s.default + (Math.random() * 2 - 1) * 0.3 * (s.max - s.min) / 2) * 100) / 100;
    doc.skin.tone = pick(PALETTE.skin);
    const hc = pick(PALETTE.hair.slice(0, 9));
    doc.hair.colors = { root: hc, tip: hc };
    doc.face.eyes = { ...doc.face.eyes, iris: pick(PALETTE.eyes) };
    for (const it of doc.outfit) if (Math.random() < 0.6) it.colors = { ...it.colors, main: pick(PALETTE.cloth) };
    this.store.replace(doc, T('randomize'));
  }
  /** In-page confirmation (the artifact viewer does not show window.confirm). */
  confirm(message, yesLabel) {
    return new Promise(resolve => {
      const root = document.getElementById('modal-root');
      const done = v => { root.hidden = true; clear(root); document.removeEventListener('keydown', onKey); resolve(v); };
      const onKey = e => { if (e.key === 'Escape') done(false); };
      const yes = h('button.btn.danger', { type: 'button', onclick: () => done(true) }, yesLabel);
      clear(root).append(h('div.modal', { attrs: { role: 'alertdialog', 'aria-modal': 'true', 'aria-label': message } },
        h('p', message), h('div.row.wrap', yes, h('button.btn.ghost', { type: 'button', onclick: () => done(false) }, T('cancel')))));
      root.hidden = false;
      document.addEventListener('keydown', onKey);
      yes.focus();
    });
  }
}
