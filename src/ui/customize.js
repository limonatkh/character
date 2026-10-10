/* =====================================================================
 * CUSTOMIZE PANEL — manual editing of every supported option.
 * Options come straight from the asset registry, so only parts that
 * really exist are offered. Picker tiles show each option rendered on the
 * CURRENT character (lazily, only for open sections).
 * ===================================================================== */
import { h, clear } from './dom.js';
import { t, L } from './i18n.js';
import { listAssets, getAsset, SLOTS } from '../core/registry.js';
import { ATTACH_POINTS } from '../core/skeleton.js';
import { MATERIALS, MATERIAL_IDS } from '../core/constants.js';
import { PROPORTIONS, PROPORTION_KEYS, GAZE, LIMITS, ITEM_FIELDS } from '../schema/schema.js';
import { completeConfig } from '../schema/validate.js';
import { compile } from '../core/compile.js';
import { frameGroup } from '../render/thumbs.js';
import { prefs } from '../storage/library.js';

const clone = v => JSON.parse(JSON.stringify(v));

export const PALETTES = {
  skin: ['#F4F3EF', '#FFE0C2', '#F5C9A0', '#E0A57A', '#C68A5E', '#A0663D', '#7A4A2A', '#4E2E1A', '#9BE38A', '#8FB8FF'],
  hair: ['#161616', '#2B2118', '#4A2E1C', '#7A4B2A', '#C89B5A', '#E9D08A', '#B5462A', '#E3E3E3', '#2F5FD0', '#E76FA8'],
  eyes: ['#161616', '#3B2A1E', '#5A3A22', '#3D6FB8', '#4F9E32', '#8A5A33', '#9AA3AD', '#C0392B'],
  general: ['#F4F3EF', '#161616', '#7C7F86', '#D92F35', '#F28A2E', '#FFD83A', '#5FAE3A', '#2F8F83', '#3B82C4', '#2E3A55', '#6B4FA0', '#8A5A33'],
};

/** Where each single-item slot lives in the config. */
export const SLOT_ITEM = {
  hair: c => c.hair, headwear: c => c.headwear,
  eyes: c => c.face.eyes, eyebrows: c => c.face.eyebrows, mouth: c => c.face.mouth, facialHair: c => c.face.facialHair,
  top: c => c.clothing.top, outerwear: c => c.clothing.outerwear, bottom: c => c.clothing.bottom, shoes: c => c.clothing.shoes,
};
const SPEC = { hair: 'hair', headwear: 'headwear', eyes: 'eyes', eyebrows: 'eyebrows', mouth: 'mouth', facialHair: 'facialHair', top: 'top', outerwear: 'outerwear', bottom: 'bottom', shoes: 'shoes', faceDetail: 'detail', accessory: 'accessory' };
const idKeyOf = slot => ITEM_FIELDS[SPEC[slot]].id;

function paletteFor(slot, key) {
  if (slot === 'skin') return PALETTES.skin;
  if ((slot === 'hair' || slot === 'eyebrows' || slot === 'facialHair') && key === 'color') return PALETTES.hair;
  if (slot === 'eyes') return PALETTES.eyes;
  return PALETTES.general;
}

/**
 * Replace the asset of an item, keeping colours the user customised.
 * A colour that still equals the old asset's default is reset to the new
 * asset's default, so untouched items always look as designed.
 */
export function switchItem(item, slot, newId) {
  const idKey = idKeyOf(slot);
  const oldA = getAsset(item[idKey]), newA = getAsset(newId);
  const out = { [idKey]: newId };
  if (!newA) return out;
  const oldDefault = k => oldA && (oldA.colors.find(c => c.key === k) || {}).default;
  if (oldA && oldA.colors.length && item.color && item.color !== oldDefault('color') && newA.colors.some(c => c.key === 'color')) out.color = item.color;
  if (item.material && oldA && item.material !== oldA.material && newA.colors.length) out.material = item.material;
  if (item.gaze) out.gaze = item.gaze;
  if (item.side && newA.sides && newA.sides.includes(item.side)) out.side = item.side;
  if (item.attachTo && newA.attach && newA.attach.points.includes(item.attachTo)) out.attachTo = item.attachTo;
  return out;
}

/**
 * For picker thumbnails only: take off whatever would hide the part being
 * chosen (a hat over the hair, a jacket over the shirt, glasses over the eyes).
 */
export function isolateFor(slot, cfg) {
  const noFaceAcc = () => { cfg.accessories = cfg.accessories.filter(a => a.attachTo !== 'face'); };
  if (slot === 'hair') cfg.headwear = { assetId: 'hat_none' };
  else if (slot === 'eyes' || slot === 'eyebrows' || slot === 'faceDetail') noFaceAcc();
  else if (slot === 'top' || slot === 'bottom') { cfg.clothing.outerwear = { assetId: 'outer_none' }; if (slot === 'top') cfg.accessories = cfg.accessories.filter(a => a.attachTo !== 'neck'); }
  return cfg;
}

function hash(str) { let x = 5381; for (let i = 0; i < str.length; i++) x = ((x << 5) + x + str.charCodeAt(i)) | 0; return (x >>> 0).toString(36); }

export class CustomizePanel {
  /**
   * @param root   container element
   * @param ctx    { store, thumbs: ThumbRenderer, queue: ThumbQueue, cache: Map }
   */
  constructor(root, ctx) {
    this.root = root;
    this.ctx = ctx;
    this.jobs = new Map();
    let open = ['head'];
    try { open = JSON.parse(prefs.get('openSections', '["head"]')); } catch { /* default */ }
    this.open = new Set(Array.isArray(open) ? open : ['head']);
  }

  get store() { return this.ctx.store; }
  get cfg() { return this.store.config; }

  // ------------------------------------------------------------------ thumbnails
  /** Register a thumbnail job; returns the <img> that will receive it. */
  thumb(slot, makeCfg, attachTo) {
    const cfg = isolateFor(slot, makeCfg());
    const group = frameGroup(slot, attachTo);
    const key = 't' + hash(group + JSON.stringify(cfg));
    const img = h('img', { alt: '', loading: 'lazy', decoding: 'async', dataset: { thumb: key } });
    const cached = this.ctx.cache.get(key);
    if (cached) img.src = cached;
    else this.jobs.set(key, () => {
      if (this.ctx.cache.has(key)) return this.ctx.cache.get(key);
      const url = this.ctx.thumbs.render(compile(completeConfig(cfg)), group);
      if (url) {
        this.ctx.cache.set(key, url);
        if (this.ctx.cache.size > 500) this.ctx.cache.delete(this.ctx.cache.keys().next().value);
      }
      return url;
    });
    return img;
  }

  queueSection(sec) {
    if (!this.ctx.thumbs.ok) return;
    for (const img of sec.querySelectorAll('img[data-thumb]')) {
      if (img.getAttribute('src')) continue;
      const key = img.dataset.thumb, job = this.jobs.get(key);
      if (!job) continue;
      this.ctx.queue.add(key, () => {
        const url = job();
        if (url) for (const el of this.root.querySelectorAll(`img[data-thumb="${key}"]`)) el.src = url;
      });
    }
  }

  // ------------------------------------------------------------------ render
  render() {
    const scroll = this.root.scrollTop;
    this.jobs.clear();
    this.ctx.queue.clear('t');
    clear(this.root);
    const sections = [
      ['body', t('secBody'), () => this.bodySection()],
      ['head', t('secHead'), () => this.headSection()],
      ['face', t('secFace'), () => this.faceSection()],
      ['clothes', t('secClothes'), () => this.clothesSection()],
      ['acc', t('secAcc'), () => this.accessorySection()],
    ];
    for (const [id, label, build] of sections) {
      const det = h('details.sec', { open: this.open.has(id), dataset: { sec: id } },
        h('summary', h('span.sec-title', label), h('span.sec-meta', this.sectionMeta(id))),
        h('div.sec-body', build()));
      det.addEventListener('toggle', () => {
        if (det.open) { this.open.add(id); this.queueSection(det); } else this.open.delete(id);
        prefs.set('openSections', JSON.stringify([...this.open]));
      });
      this.root.append(det);
    }
    this.root.scrollTop = scroll;
    for (const det of this.root.querySelectorAll('details.sec[open]')) this.queueSection(det);
  }

  sectionMeta(id) {
    const c = this.cfg, n = a => L((getAsset(a) || {}).label);
    if (id === 'body') return n(c.body.typeId);
    if (id === 'head') return n(c.hair.assetId);
    if (id === 'face') return n(c.face.eyes.styleId);
    if (id === 'clothes') return [c.clothing.outerwear.assetId !== 'outer_none' ? n(c.clothing.outerwear.assetId) : n(c.clothing.top.assetId), n(c.clothing.bottom.assetId)].join(' + ');
    if (id === 'acc') return String(c.accessories.length);
    return '';
  }

  // ------------------------------------------------------------------ building blocks
  field(label, ...content) { return h('div.field', h('div.field-label', label), ...content); }

  /** Horizontal row of picker tiles. */
  tiles(slot, assets, currentId, onPick, makeCfg, attachOf) {
    return h('div.tiles', { attrs: { role: 'listbox', 'aria-label': L(SLOTS[slot] ? SLOTS[slot].label : '') } },
      assets.map(a => h('button.tile', {
        type: 'button', title: a.description,
        attrs: { 'aria-pressed': String(a.id === currentId), role: 'option', 'aria-selected': String(a.id === currentId) },
        onclick: () => { if (a.id !== currentId) onPick(a); },
      }, h('span.tile-img', this.thumb(slot, () => makeCfg(a), attachOf ? attachOf(a) : undefined)), h('span.tile-name', L(a.label)))));
  }

  colorControl(label, value, slot, key, apply) {
    const input = h('input.color-input', { type: 'color', value: value.toLowerCase(), attrs: { 'aria-label': label } });
    const code = h('span.color-code', value);
    input.addEventListener('input', () => { const v = input.value.toUpperCase(); code.textContent = v; this.store.preview(c => apply(c, v)); });
    input.addEventListener('change', () => this.store.commit(c => apply(c, input.value.toUpperCase()), label));
    const swatches = h('div.swatches', paletteFor(slot, key).map(hex => h('button.swatch', {
      type: 'button', title: hex, style: { background: hex },
      attrs: { 'aria-label': hex, 'aria-pressed': String(hex.toUpperCase() === value.toUpperCase()) },
      onclick: () => this.store.commit(c => apply(c, hex), label),
    })));
    return h('div.color', h('div.color-head', h('span.color-label', label), h('label.color-well', input, code)), swatches);
  }

  materialControl(value, apply) {
    const sel = h('select.select', { attrs: { 'aria-label': t('material') }, onchange: () => this.store.commit(c => apply(c, sel.value), 'material') },
      MATERIAL_IDS.map(id => h('option', { value: id, selected: id === value }, L(MATERIALS[id].label))));
    return h('label.inline', h('span', t('material')), sel);
  }

  segmented(label, options, value, onPick) {
    return h('div.seg-wrap', h('span.seg-label', label), h('div.seg', { attrs: { role: 'group', 'aria-label': label } },
      options.map(([v, text]) => h('button', { type: 'button', attrs: { 'aria-pressed': String(v === value) }, onclick: () => { if (v !== value) onPick(v); } }, text))));
  }

  /** Colour + material controls for an item of an asset. */
  itemControls(slot, asset, item, getItem) {
    const out = [];
    for (const col of asset.colors) {
      out.push(this.colorControl(L(col.label), item[col.key] || col.default, slot, col.key, (c, v) => { getItem(c)[col.key] = v; }));
    }
    const spec = ITEM_FIELDS[SPEC[slot]];
    if (spec && spec.material && asset.colors.length) out.push(this.materialControl(item.material || asset.material || 'cloth', (c, v) => { getItem(c).material = v; }));
    return out.length ? h('div.controls', out) : null;
  }

  /** A complete single-item slot: tiles + colour / material controls. */
  slotBlock(slot, extra) {
    const get = SLOT_ITEM[slot], idKey = idKeyOf(slot), item = get(this.cfg), asset = getAsset(item[idKey]);
    const pick = a => this.store.commit(c => { const it = get(c); const next = switchItem(it, slot, a.id); for (const k of Object.keys(it)) delete it[k]; Object.assign(it, next); }, L(SLOTS[slot].label));
    const preview = a => { const c = clone(this.cfg); const it = get(c); const next = switchItem(it, slot, a.id); for (const k of Object.keys(it)) delete it[k]; Object.assign(it, next); return c; };
    return h('div.slot', { dataset: { slot } },
      h('div.slot-head', h('h3', L(SLOTS[slot].label)), h('span.slot-current', L(asset.label))),
      this.tiles(slot, listAssets(slot), asset.id, pick, preview),
      this.itemControls(slot, asset, item, get),
      extra ? extra(item, asset) : null);
  }

  // ------------------------------------------------------------------ sections
  bodySection() {
    const c = this.cfg;
    const bt = getAsset(c.body.typeId);
    const body = h('div.slot', { dataset: { slot: 'bodyType' } },
      h('div.slot-head', h('h3', L(SLOTS.bodyType.label)), h('span.slot-current', L(bt.label))),
      this.tiles('bodyType', listAssets('bodyType'), bt.id,
        a => this.store.commit(cc => { cc.body.typeId = a.id; }, 'body'),
        a => { const cc = clone(c); cc.body.typeId = a.id; return cc; }));
    const skin = this.colorControl(t('skinColor'), c.body.skinColor, 'skin', 'color', (cc, v) => { cc.body.skinColor = v; });
    const sliders = PROPORTION_KEYS.map(k => {
      const P = PROPORTIONS[k], v = c.body.proportions[k];
      const out = h('output.range-val', v.toFixed(2));
      const input = h('input.range', { type: 'range', min: P.min, max: P.max, step: 0.01, value: v, attrs: { 'aria-label': t(k) } });
      input.addEventListener('input', () => { const n = +input.value; out.textContent = n.toFixed(2); this.store.preview(cc => { cc.body.proportions[k] = n; }); });
      input.addEventListener('change', () => this.store.commit(null, t(k)));
      return h('label.range-row', h('span.range-label', t(k)), input, out);
    });
    const reset = h('button.btn.small.ghost', { type: 'button', onclick: () => this.store.commit(cc => { for (const k of PROPORTION_KEYS) cc.body.proportions[k] = PROPORTIONS[k].default; }, t('resetProps')) }, t('resetProps'));
    return [body, h('div.slot', skin), h('div.slot', h('div.slot-head', h('h3', t('proportions')), reset), h('div.ranges', sliders))];
  }

  headSection() {
    const c = this.cfg, hs = getAsset(c.head.shapeId);
    const shape = h('div.slot', { dataset: { slot: 'headShape' } },
      h('div.slot-head', h('h3', L(SLOTS.headShape.label)), h('span.slot-current', L(hs.label))),
      this.tiles('headShape', listAssets('headShape'), hs.id,
        a => this.store.commit(cc => { cc.head.shapeId = a.id; }, 'head'),
        a => { const cc = clone(c); cc.head.shapeId = a.id; return cc; }));
    return [shape, this.slotBlock('hair'), this.slotBlock('headwear')];
  }

  faceSection() {
    const gaze = item => this.segmented(t('gaze'), GAZE.map(g => [g, t('g_' + g)]), item.gaze || 'center', v => this.store.commit(c => { c.face.eyes.gaze = v; }, t('gaze')));
    return [this.slotBlock('eyes', gaze), this.slotBlock('eyebrows'), this.slotBlock('mouth'), this.slotBlock('facialHair'), this.detailsBlock()];
  }

  clothesSection() { return ['top', 'outerwear', 'bottom', 'shoes'].map(s => this.slotBlock(s)); }

  /** List slots (face details, accessories): current rows + add tiles. */
  listBlock(slot, listOf, max, rowExtra, newItem, attachOf) {
    const c = this.cfg, list = listOf(c);
    const rows = list.map((it, i) => {
      const a = getAsset(it.assetId);
      const at = c2 => listOf(c2)[i];
      return h('div.list-row',
        h('div.list-row-head', h('strong', L(a.label)), h('button.btn.small.danger', { type: 'button', onclick: () => this.store.commit(cc => { listOf(cc).splice(i, 1); }, t('remove')) }, t('remove'))),
        rowExtra ? rowExtra(it, a, i, at) : null,
        this.itemControls(slot, a, it, at));
    });
    const full = list.length >= max;
    const add = full ? h('p.muted', t('maxReached', { n: max })) :
      h('div', h('div.field-label', t('pickToAdd')), this.tiles(slot, listAssets(slot), null,
        a => this.store.commit(cc => { listOf(cc).push(newItem(a)); }, L(SLOTS[slot].label)),
        a => { const cc = clone(c); const l = listOf(cc); l.length = 0; l.push(newItem(a)); return cc; }, attachOf));
    return h('div.slot', { dataset: { slot } },
      h('div.slot-head', h('h3', L(SLOTS[slot].label)), h('span.slot-current', list.length ? `${list.length} / ${max}` : t('noneYet'))),
      rows.length ? h('div.list', rows) : null, add);
  }

  detailsBlock() {
    const sideCtl = (it, a, i) => a.sides ? h('div', this.segmented(t('side'), a.sides.map(s => [s, t('s_' + s)]), it.side, v => this.store.commit(c => { c.face.details[i].side = v; }, t('side'))), h('p.hint-line', t('sideNote'))) : null;
    return this.listBlock('faceDetail', c => c.face.details, LIMITS.maxDetails, sideCtl,
      a => ({ assetId: a.id, ...(a.sides ? { side: a.defaultSide || a.sides[0] } : {}) }));
  }

  accessorySection() {
    const attachCtl = (it, a, i) => {
      if (a.attach.points.length < 2) return h('p.hint-line', `${t('attachTo')}: ${L(ATTACH_POINTS[it.attachTo].label)}`);
      const sel = h('select.select', { attrs: { 'aria-label': t('attachTo') }, onchange: () => this.store.commit(c => { c.accessories[i].attachTo = sel.value; }, t('attachTo')) },
        a.attach.points.map(p => h('option', { value: p, selected: p === it.attachTo }, L(ATTACH_POINTS[p].label))));
      return h('label.inline', h('span', t('attachTo')), sel);
    };
    return this.listBlock('accessory', c => c.accessories, LIMITS.maxAccessories, attachCtl,
      a => ({ assetId: a.id, attachTo: a.attach.default }), a => a.attach.default);
  }
}
