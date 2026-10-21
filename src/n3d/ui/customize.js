/* =====================================================================
 * NORMAL 3D — CUSTOMIZE PANEL
 * Sections: Body · Face · Hair · Upper body · Lower body · Full body ·
 * Footwear · Accessories · Materials · Advanced. Every control comes from
 * the parameter tables and the asset registry, so only what really exists
 * is offered, with only the controls that make sense for each item.
 * ===================================================================== */
import { h, clear, toast } from '../../ui/dom.js';
import { T, Lb } from './strings.js';
import { slider, colorRow, choice, toggle, select, paramForm, assetPicker, PALETTE } from './controls.js';
import { BODY_PARAMS, FACE_PARAMS, BODY_GROUPS, FACE_GROUPS } from '../core/params.js';
import { EYE_PARAMS, SKIN_PARAMS, MAKEUP_PARAMS, BROW_PARAMS, createN3DDocument } from '../core/document.js';
import { listAssets, getAsset, paramDefaults, colorDefaults } from '../core/registry.js';
import { FABRICS, PATTERNS, HARDWARE } from '../materials/fabrics.js';
import { DETAIL_LEVELS, DETAIL_IDS } from '../core/detail.js';
import { BODY_PRESETS } from '../assets/presets.js';
import { LIMITS } from '../schema/validate.js';
import { prefs } from '../../storage/library.js';

const SECTIONS = [
  ['body', 'secBody'], ['face', 'secFace'], ['hair', 'secHair'], ['upper', 'secUpper'], ['lower', 'secLower'],
  ['full', 'secFull'], ['feet', 'secFeet'], ['acc', 'secAcc'], ['mat', 'secMat'], ['adv', 'secAdv'],
];
const SECTION_SLOTS = { upper: ['top', 'mid', 'outer'], lower: ['bottom'], full: ['fullBody'], feet: ['footwear'], acc: ['headwear', 'neckwear', 'eyewear', 'jewelry', 'handwear', 'bag', 'belt'] };
const SCAR_SPOTS = ['cheekLeft', 'cheekRight', 'browLeft', 'browRight', 'chin', 'forehead', 'nose', 'lip'];
const SCAR_LABEL = { cheekLeft: { en: 'Left cheek', ar: 'الخد الأيسر' }, cheekRight: { en: 'Right cheek', ar: 'الخد الأيمن' }, browLeft: { en: 'Left brow', ar: 'الحاجب الأيسر' }, browRight: { en: 'Right brow', ar: 'الحاجب الأيمن' }, chin: { en: 'Chin', ar: 'الذقن' }, forehead: { en: 'Forehead', ar: 'الجبهة' }, nose: { en: 'Nose', ar: 'الأنف' }, lip: { en: 'Lip', ar: 'الشفة' } };

export class N3DCustomize {
  constructor(root, ctx) {
    this.root = root; this.ctx = ctx;
    this.section = SECTIONS.some(([id]) => id === prefs.get('n3d.section', 'body')) ? prefs.get('n3d.section', 'body') : 'body';
    this.openItem = null;          // index of the expanded worn item
  }
  get store() { return this.ctx.store; }
  get doc() { return this.store.doc; }
  commit(fn, label) { this.store.commit(fn, label); }
  preview(fn) { this.store.preview(fn); }

  render() {
    const scroll = this.root.scrollTop;
    clear(this.root);
    const nav = h('nav.sec-nav', { attrs: { 'aria-label': 'sections' } }, SECTIONS.map(([id, key]) => h('button.chip.sec-chip', {
      type: 'button', attrs: { 'aria-pressed': String(id === this.section) },
      onclick: () => { this.section = id; prefs.set('n3d.section', id); this.root.scrollTop = 0; this.render(); },
    }, T(key), this.count(id))));
    const body = h('div.sec-content', this.sectionBody());
    this.root.append(nav, body);
    this.root.scrollTop = scroll;
  }
  count(id) {
    const slots = SECTION_SLOTS[id];
    if (!slots) return null;
    const list = id === 'acc' ? this.doc.accessories : this.doc.outfit;
    const n = list.filter(it => slots.includes(getAsset(it.assetId)?.slot)).length;
    return n ? h('span.badge', String(n)) : null;
  }
  sectionBody() {
    switch (this.section) {
      case 'body': return this.bodySection();
      case 'face': return this.faceSection();
      case 'hair': return this.hairSection();
      case 'acc': return this.itemsSection('acc');
      case 'mat': return this.materialsSection();
      case 'adv': return this.advancedSection();
      default: return this.itemsSection(this.section);
    }
  }

  block(title, ...children) { return h('section.card-sec.n3d-block', h('h3', title), ...children); }
  group(title, children, open = false) { return h('details.sub', { open }, h('summary', title), h('div.sub-body', children)); }

  /** Sliders for a numeric table at doc[path]. */
  tableSliders(tbl, keys, get, set) {
    return h('div.ranges', keys.map(k => slider(tbl[k], get()[k] ?? tbl[k].default, v => this.preview(d => { set(d)[k] = v; }), v => this.commit(d => { set(d)[k] = v; }, Lb(tbl[k].label)))));
  }

  // ------------------------------------------------------------------ BODY
  bodySection() {
    const d = this.doc;
    const presets = h('div.chips.wrap', Object.entries(BODY_PRESETS).map(([id, p]) => h('button.chip', {
      type: 'button', onclick: () => this.commit(doc => { Object.assign(doc.body, p.body); }, Lb(p.label)),
    }, Lb(p.label))));
    const chars = assetPicker(listAssets('preset'), null, a => this.commit(doc => {
      const fresh = createN3DDocument({ ...a.doc, meta: { ...doc.meta } });
      fresh.meta = doc.meta; fresh.detail = doc.detail;
      Object.assign(doc, fresh);
    }, Lb(a.label)), { thumb: this.ctx.thumb });
    const groups = Object.entries(BODY_GROUPS).map(([g, gl], i) => this.group(Lb(gl), this.tableSliders(BODY_PARAMS, Object.keys(BODY_PARAMS).filter(k => BODY_PARAMS[k].group === g), () => this.doc.body, doc => doc.body), i === 0));
    const skin = this.block(T('skin'),
      colorRow(T('skinTone'), d.skin.tone, PALETTE.skin, v => this.preview(doc => { doc.skin.tone = v; }), v => this.commit(doc => { doc.skin.tone = v; }, T('skinTone'))),
      this.tableSliders(SKIN_PARAMS, ['undertone', 'roughness'], () => this.doc.skin, doc => doc.skin));
    return [this.block(T('presets'), presets), this.block(T('charPresets'), chars), this.block(T('secBody'), groups), skin];
  }

  // ------------------------------------------------------------------ FACE
  faceSection() {
    const d = this.doc, f = d.face;
    const shape = Object.entries(FACE_GROUPS).map(([g, gl], i) => this.group(Lb(gl), this.tableSliders(FACE_PARAMS, Object.keys(FACE_PARAMS).filter(k => FACE_PARAMS[k].group === g), () => this.doc.face, doc => doc.face), i === 0));
    const eyes = this.block(T('eyes'),
      colorRow(T('iris'), f.eyes.iris, PALETTE.eyes, v => this.preview(doc => { doc.face.eyes.iris = v; }), v => this.commit(doc => { doc.face.eyes.iris = v; }, T('iris'))),
      this.tableSliders(EYE_PARAMS, Object.keys(EYE_PARAMS), () => this.doc.face.eyes, doc => doc.face.eyes),
      colorRow(T('lashColor'), f.eyes.lashColor, PALETTE.hair, v => this.preview(doc => { doc.face.eyes.lashColor = v; }), v => this.commit(doc => { doc.face.eyes.lashColor = v; }, T('lashColor'))));
    const browA = getAsset(f.brows.styleId);
    const browParams = { ...(browA?.brow || {}), ...f.brows.params };
    const brows = this.block(T('brows'),
      assetPicker(listAssets('browStyle'), f.brows.styleId, a => this.commit(doc => { doc.face.brows.styleId = a.id; doc.face.brows.params = {}; }, T('brows')), { thumb: this.ctx.thumb }),
      browA && !browA.none ? h('div.ranges', Object.keys(BROW_PARAMS).map(k => slider(BROW_PARAMS[k], browParams[k] ?? BROW_PARAMS[k].default, v => this.preview(doc => { doc.face.brows.params[k] = v; }), v => this.commit(doc => { doc.face.brows.params[k] = v; }, Lb(BROW_PARAMS[k].label))))) : null,
      colorRow(T('browColor'), f.brows.color || d.hair.colors?.root || '#2B1E16', PALETTE.hair, v => this.preview(doc => { doc.face.brows.color = v; }), v => this.commit(doc => { doc.face.brows.color = v; }, T('browColor')),
        { extra: f.brows.color ? h('button.btn.small.ghost', { type: 'button', onclick: () => this.commit(doc => { doc.face.brows.color = null; }, T('sameAsHair')) }, T('sameAsHair')) : null }));
    const fhA = getAsset(f.facialHair.styleId);
    const fh = this.block(T('facialHair'),
      assetPicker(listAssets('facialHair'), f.facialHair.styleId, a => this.commit(doc => { doc.face.facialHair = { styleId: a.id, params: {}, colors: doc.face.facialHair.colors || {} }; }, T('facialHair')), { thumb: this.ctx.thumb }),
      fhA && Object.keys(fhA.params || {}).length ? paramForm(fhA.params, { ...paramDefaults(fhA), ...f.facialHair.params }, (k, v) => this.preview(doc => { doc.face.facialHair.params[k] = v; }), (k, v) => this.commit(doc => { doc.face.facialHair.params[k] = v; }, Lb(fhA.params[k].label))) : null,
      fhA && Object.keys(fhA.colors || {}).length ? h('div.controls', Object.entries(fhA.colors).map(([k, c]) => colorRow(Lb(c.label), f.facialHair.colors?.[k] || d.hair.colors?.root || c.default, PALETTE.hair, v => this.preview(doc => { doc.face.facialHair.colors[k] = v; }), v => this.commit(doc => { doc.face.facialHair.colors[k] = v; }, Lb(c.label))))) : null);
    const details = this.block(T('skin'),
      this.tableSliders(SKIN_PARAMS, ['freckles', 'moles', 'wrinkles', 'blemishes', 'stubble'], () => this.doc.skin, doc => doc.skin),
      this.scarsBlock());
    const mk = f.makeup;
    const makeup = this.block(T('makeup'),
      this.tableSliders(MAKEUP_PARAMS, Object.keys(MAKEUP_PARAMS), () => this.doc.face.makeup, doc => doc.face.makeup),
      h('div.controls',
        colorRow(T('lipColor'), mk.lipColor, ['#B5655F', '#A8505A', '#C0392B', '#8E2B3A', '#D98A8A', '#E0A08A', '#7A3A4A'], v => this.preview(doc => { doc.face.makeup.lipColor = v; }), v => this.commit(doc => { doc.face.makeup.lipColor = v; }, T('lipColor'))),
        colorRow(T('blushColor'), mk.blushColor, ['#D9776B', '#E39A8A', '#C25A5A', '#E0806F'], v => this.preview(doc => { doc.face.makeup.blushColor = v; }), v => this.commit(doc => { doc.face.makeup.blushColor = v; }, T('blushColor'))),
        colorRow(T('eyeShadowColor'), mk.eyeShadowColor, ['#6E5A7E', '#8A6A4A', '#4A5A7A', '#B58A6A', '#3A3A3A', '#C9A06A'], v => this.preview(doc => { doc.face.makeup.eyeShadowColor = v; }), v => this.commit(doc => { doc.face.makeup.eyeShadowColor = v; }, T('eyeShadowColor')))));
    return [this.block(T('secFace'), shape), eyes, brows, fh, details, makeup];
  }
  scarsBlock() {
    const scars = this.doc.skin.scars || [];
    const rows = scars.map((s, i) => h('div.list-row',
      h('div.list-row-head', select(T('at'), SCAR_SPOTS.map(p => [p, Lb(SCAR_LABEL[p])]), s.at, v => this.commit(doc => { doc.skin.scars[i].at = v; }, T('scars'))),
        h('button.btn.small.danger', { type: 'button', onclick: () => this.commit(doc => { doc.skin.scars.splice(i, 1); }, T('remove')) }, T('remove'))),
      h('div.ranges',
        slider({ min: 0.2, max: 1, default: 0.5, label: { en: 'Size', ar: 'الحجم' } }, s.size, v => this.preview(doc => { doc.skin.scars[i].size = v; }), v => this.commit(doc => { doc.skin.scars[i].size = v; }, T('size'))),
        slider({ min: -90, max: 90, step: 1, default: 0, label: { en: 'Angle', ar: 'الزاوية' } }, s.angle, v => this.preview(doc => { doc.skin.scars[i].angle = v; }), v => this.commit(doc => { doc.skin.scars[i].angle = v; }, T('angle'))))));
    return h('div', h('div.field-label', T('scars')), h('div.list', rows),
      scars.length < LIMITS.scars ? h('button.btn.small.ghost', { type: 'button', onclick: () => this.commit(doc => { doc.skin.scars.push({ at: 'cheekLeft', size: 0.5, angle: 20 }); }, T('addScar')) }, T('addScar')) : null);
  }

  // ------------------------------------------------------------------ HAIR
  hairSection() {
    const d = this.doc, a = getAsset(d.hair.styleId);
    const out = [this.block(T('hairStyle'), assetPicker(listAssets('hairStyle'), d.hair.styleId, x => this.commit(doc => { doc.hair = { styleId: x.id, params: {}, colors: doc.hair.colors || {} }; }, T('hairStyle')), { thumb: this.ctx.thumb }))];
    if (a && !a.recipe?.none && Object.keys(a.params || {}).length) {
      out.push(this.block(T('params'), paramForm(a.params, { ...paramDefaults(a), ...d.hair.params }, (k, v) => this.preview(doc => { doc.hair.params[k] = v; }), (k, v) => this.commit(doc => { doc.hair.params[k] = v; }, Lb(a.params[k].label)))));
      const cd = { ...colorDefaults(a), ...d.hair.colors };
      out.push(this.block(T('hairColors'), h('div.controls', Object.entries(a.colors).map(([k, c]) => colorRow(Lb(c.label), cd[k], PALETTE.hair, v => this.preview(doc => { doc.hair.colors[k] = v; }), v => this.commit(doc => { doc.hair.colors[k] = v; }, Lb(c.label)))))));
    }
    return out;
  }

  // ------------------------------------------------------------------ WORN ITEMS (outfit / accessories)
  itemsSection(id) {
    const slots = SECTION_SLOTS[id];
    const acc = id === 'acc';
    const listKey = acc ? 'accessories' : 'outfit';
    const list = this.doc[listKey];
    const worn = list.map((it, i) => ({ it, i, a: getAsset(it.assetId) })).filter(x => x.a && slots.includes(x.a.slot));
    const cards = worn.map(x => this.itemCard(listKey, x.i, x.it, x.a));
    const max = acc ? LIMITS.accessories : LIMITS.outfit;
    const assets = slots.flatMap(s => listAssets(s));
    const full = list.length >= max;
    const add = full ? h('p.muted', T('maxReached', { n: max })) : assetPicker(assets, null, a => {
      this.commit(doc => {
        const L = doc[listKey];
        // single-choice slots replace what is there (one pair of shoes)
        if (a.slot === 'footwear') { const k = L.findIndex(it => getAsset(it.assetId)?.slot === 'footwear'); if (k >= 0) L.splice(k, 1); }
        L.push({ assetId: a.id, params: {}, colors: {}, material: {} });
        this.openItem = L.length - 1;
      }, Lb(a.label));
    }, { thumb: this.ctx.thumb });
    return [this.block(T('wearing'), cards.length ? h('div.list', cards) : h('p.muted', T('noneWorn'))), this.block(T('addItem'), add)];
  }

  itemCard(listKey, i, it, a) {
    const open = this.openItem === i;
    const at = doc => doc[listKey][i];
    const head = h('div.list-row-head',
      h('button.item-title', { type: 'button', attrs: { 'aria-expanded': String(open) }, onclick: () => { this.openItem = open ? null : i; this.render(); } },
        h('span.item-thumb', this.ctx.thumb(a.id) ? h('img', { src: this.ctx.thumb(a.id), alt: '' }) : null), h('strong', Lb(a.label)), h('span.chev', open ? '▾' : '▸')),
      h('div.row.tight',
        listKey === 'outfit' ? h('button.btn.small.ghost.icon', { type: 'button', title: T('moveUp'), disabled: i === 0, onclick: () => this.commit(doc => { const L = doc.outfit; [L[i - 1], L[i]] = [L[i], L[i - 1]]; this.openItem = i - 1; }, T('moveUp')) }, '↑') : null,
        listKey === 'outfit' ? h('button.btn.small.ghost.icon', { type: 'button', title: T('moveDown'), disabled: i === this.doc.outfit.length - 1, onclick: () => this.commit(doc => { const L = doc.outfit; [L[i + 1], L[i]] = [L[i], L[i + 1]]; this.openItem = i + 1; }, T('moveDown')) }, '↓') : null,
        h('button.btn.small.danger', { type: 'button', onclick: () => { this.openItem = null; this.commit(doc => { doc[listKey].splice(i, 1); }, T('remove')); } }, T('remove'))));
    if (!open) return h('div.list-row', head);
    const params = Object.keys(a.params || {}).length ? paramForm(a.params, { ...paramDefaults(a), ...it.params }, (k, v) => this.preview(doc => { at(doc).params[k] = v; }), (k, v) => this.commit(doc => { at(doc).params[k] = v; }, Lb(a.params[k].label))) : null;
    const cd = { ...colorDefaults(a), ...it.colors };
    const colors = Object.keys(a.colors || {}).length ? h('div.controls', Object.entries(a.colors).map(([k, c]) => colorRow(Lb(c.label), cd[k], a.materialKind === 'metal' ? PALETTE.metal : PALETTE.cloth, v => this.preview(doc => { at(doc).colors[k] = v; }), v => this.commit(doc => { at(doc).colors[k] = v; }, Lb(c.label))))) : null;
    return h('div.list-row.open', head, params ? h('div.item-sec', h('div.field-label', T('params')), params) : null, colors ? h('div.item-sec', h('div.field-label', T('colors')), colors) : null, this.materialControls(a, it, at));
  }

  materialControls(a, it, at) {
    if (!a.fabrics || !a.fabrics.length) return null;
    const m = it.material || {};
    const fab = select(T('fabric'), a.fabrics.map(f => [f, Lb(FABRICS[f].label)]), m.fabric || a.fabric, v => this.commit(doc => { at(doc).material.fabric = v; }, T('fabric')));
    const pat = select(T('pattern'), Object.entries(PATTERNS).map(([k, p]) => [k, Lb(p.label)]), m.pattern || 'solid', v => this.commit(doc => { at(doc).material.pattern = v; }, T('pattern')));
    const scale = slider({ min: 0.25, max: 4, default: 1, step: 0.05, label: { en: 'Pattern size', ar: 'حجم النقشة' } }, m.patternScale ?? 1, v => this.preview(doc => { at(doc).material.patternScale = v; }), v => this.commit(doc => { at(doc).material.patternScale = v; }, T('patternScale')));
    const wear = slider({ min: 0, max: 1, default: 0, label: { en: 'Wear / fading', ar: 'البهتان' } }, m.wear ?? 0, v => this.preview(doc => { at(doc).material.wear = v; }), v => this.commit(doc => { at(doc).material.wear = v; }, T('wear')));
    const hw = a.slot !== 'footwear' && (a.hardware || ['top', 'mid', 'outer', 'bottom', 'fullBody'].includes(a.slot)) ? select(T('hardware'), Object.entries(HARDWARE).map(([k, x]) => [k, Lb(x.label)]), m.hardware || a.hardware || 'plastic', v => this.commit(doc => { at(doc).material.hardware = v; }, T('hardware'))) : null;
    return h('div.item-sec', h('div.field-label', T('fabric')), h('div.row.wrap', fab, pat, hw), h('div.ranges', (m.pattern && m.pattern !== 'solid') ? scale : null, wear));
  }

  // ------------------------------------------------------------------ MATERIALS overview
  materialsSection() {
    const rows = [];
    for (const [listKey, list] of [['outfit', this.doc.outfit], ['accessories', this.doc.accessories]]) {
      list.forEach((it, i) => {
        const a = getAsset(it.assetId); if (!a) return;
        const at = doc => doc[listKey][i];
        const cd = { ...colorDefaults(a), ...it.colors };
        const main = a.colors?.main ? colorRow(Lb(a.label), cd.main, PALETTE.cloth, v => this.preview(doc => { at(doc).colors.main = v; }), v => this.commit(doc => { at(doc).colors.main = v; }, Lb(a.label))) : h('strong', Lb(a.label));
        rows.push(h('div.list-row', main, this.materialControls(a, it, at)));
      });
    }
    return [this.block(T('secMat'), rows.length ? h('div.list', rows) : h('p.muted', T('noneWorn')))];
  }

  // ------------------------------------------------------------------ ADVANCED
  advancedSection() {
    const d = this.doc;
    const detail = h('div', choice(T('detail'), DETAIL_IDS.map(id => [id, Lb(DETAIL_LEVELS[id].label)]), d.detail, v => this.commit(doc => { doc.detail = v; }, T('detail'))),
      h('p.hint-line', Lb(DETAIL_LEVELS[d.detail].label) + ': ' + DETAIL_LEVELS[d.detail].doc), h('p.hint-line', T('detailNote')));
    const st = this.ctx.lastStats ? this.ctx.lastStats() : null;
    const stats = st ? h('p.counts', `${st.tris.toLocaleString()} ${T('triangles')} · ${st.meshes} ${T('meshes')} · ${T('buildTime')}: ${(st.timings.total / 1000).toFixed(1)} s`) : null;
    const ta = h('textarea.json-edit', { spellcheck: false, value: JSON.stringify(d, null, 2), attrs: { 'aria-label': T('jsonView'), dir: 'ltr' } });
    const apply = h('button.btn.small.primary', { type: 'button', onclick: () => this.ctx.applyJson(ta.value) }, T('applyJson'));
    const actions = h('div.row.wrap',
      h('button.btn.small.ghost', { type: 'button', onclick: () => this.ctx.randomize() }, T('randomize')),
      h('button.btn.small.danger', { type: 'button', onclick: async () => { if (await this.ctx.confirm(T('confirmNew'), T('yes'))) this.store.replace(createN3DDocument(), T('resetAll')); } }, T('resetAll')));
    return [this.block(T('detail'), detail, stats), this.block(T('secAdv'), actions), this.block(T('jsonView'), ta, apply)];
  }
}
export { toast, toggle };
