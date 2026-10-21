/* =====================================================================
 * NORMAL 3D UI CONTROLS — sliders, colour pickers, choice chips, toggles,
 * asset pickers with search / tag filter / thumbnails, parameter forms
 * generated from ParamSpecs. Every control writes through the store
 * (preview while dragging, commit on release), so undo works everywhere.
 * ===================================================================== */
import { h } from '../../ui/dom.js';
import { T, Lb } from './strings.js';

export const PALETTE = {
  skin: ['#FBE3D2', '#F2C9A8', '#E8B38A', '#D9A07C', '#C8906A', '#B07650', '#94603E', '#7A4A2E', '#5E3722', '#3F2416'],
  hair: ['#0F0D0C', '#2B1E16', '#3E2A1C', '#5A3A22', '#7A5232', '#A0703E', '#C9A06A', '#E6CF9A', '#B5462A', '#8A8A8A', '#E8E8E8', '#2F5FD0', '#D85AA0'],
  eyes: ['#3B2416', '#5A3A22', '#7A5232', '#2F5F8A', '#4A7AA8', '#4F7A3A', '#7A8A5A', '#8A9AA8', '#2B2B2B'],
  cloth: ['#F4F4F2', '#1C1C1C', '#7C7F86', '#2B3242', '#34507A', '#3D6FB0', '#2A6A5A', '#4E5B3A', '#C8B58A', '#8A5A33', '#7A1F2B', '#B5462F', '#E8A33B', '#F2D16B', '#D85A9C', '#6B4FA0'],
  metal: ['#C0C0C0', '#D4AF37', '#B08D57', '#B87333', '#3A3A3A', '#E8E2D6'],
};

/** Slider row. spec: { min, max, step, label, doc }. onPreview(v) while dragging, onCommit(v) on release. */
export function slider(spec, value, onPreview, onCommit, opts = {}) {
  const step = spec.step ?? ((spec.max - spec.min) > 5 ? 0.1 : 0.01);
  const fmtV = v => (opts.format ? opts.format(v) : Math.abs(spec.max - spec.min) >= 10 ? (+v).toFixed(step >= 1 ? 0 : 1) : (+v).toFixed(2));
  const out = h('output.range-val', fmtV(value));
  const input = h('input.range', { type: 'range', min: spec.min, max: spec.max, step, value, attrs: { 'aria-label': Lb(spec.label) } });
  input.addEventListener('input', () => { out.textContent = fmtV(input.value); onPreview(+input.value); });
  input.addEventListener('change', () => onCommit(+input.value));
  const reset = h('button.reset-dot', { type: 'button', title: (spec.doc || '') + ' — ' + 'reset', attrs: { 'aria-label': 'reset ' + Lb(spec.label) }, onclick: () => { input.value = spec.default; out.textContent = fmtV(spec.default); onCommit(spec.default); } }, '•');
  const row = h('label.range-row', { title: spec.doc || '' }, h('span.range-label', Lb(spec.label)), input, h('span.range-end', out, value !== spec.default ? reset : null));
  return row;
}

/** Colour row with palette. */
export function colorRow(label, value, palette, onPreview, onCommit, opts = {}) {
  const v0 = (value || '#888888').toUpperCase();
  const input = h('input.color-input', { type: 'color', value: v0.toLowerCase(), attrs: { 'aria-label': label } });
  const code = h('span.color-code', v0);
  input.addEventListener('input', () => { const v = input.value.toUpperCase(); code.textContent = v; onPreview(v); });
  input.addEventListener('change', () => onCommit(input.value.toUpperCase()));
  const sw = h('div.swatches', (palette || PALETTE.cloth).map(hex => h('button.swatch', {
    type: 'button', title: hex, style: { background: hex }, attrs: { 'aria-label': hex, 'aria-pressed': String(hex.toUpperCase() === v0) }, onclick: () => onCommit(hex.toUpperCase()),
  })));
  return h('div.color', h('div.color-head', h('span.color-label', label), opts.extra || null, h('label.color-well', input, code)), sw);
}

/** Segmented choice. options: [[value, text]] */
export function choice(label, options, value, onPick) {
  return h('div.seg-wrap', label ? h('span.seg-label', label) : null, h('div.seg', { attrs: { role: 'group', 'aria-label': label || '' } },
    options.map(([v, text]) => h('button', { type: 'button', attrs: { 'aria-pressed': String(v === value) }, onclick: () => { if (v !== value) onPick(v); } }, text))));
}
export function toggle(label, value, onSet, doc) {
  const cb = h('input', { type: 'checkbox', checked: !!value, onchange: () => onSet(cb.checked) });
  return h('label.toggle', { title: doc || '' }, cb, h('span', label));
}
export function select(label, options, value, onPick) {
  const sel = h('select.select', { attrs: { 'aria-label': label }, onchange: () => onPick(sel.value) }, options.map(([v, text]) => h('option', { value: v, selected: v === value }, text)));
  return h('label.inline', h('span', label), sel);
}

/**
 * Parameter form for an asset's ParamSpecs.
 * get(): current params; set(mutator, preview?) applies a change.
 */
export function paramForm(params, current, onPreview, onCommit) {
  const enums = [], bools = [], nums = [];
  for (const [k, p] of Object.entries(params || {})) {
    const v = current[k] ?? p.default;
    if (p.type === 'enum') {
      const opts = p.values.map(x => [x, p.labels?.[x] ? Lb(p.labels[x]) : x]);
      enums.push(opts.length <= 4 ? choice(Lb(p.label), opts, v, x => onCommit(k, x)) : select(Lb(p.label), opts, v, x => onCommit(k, x)));
    } else if (p.type === 'bool') bools.push(toggle(Lb(p.label), v, x => onCommit(k, x), p.doc));
    else nums.push(slider(p, v, x => onPreview(k, x), x => onCommit(k, x)));
  }
  return h('div.param-form', enums.length ? h('div.param-choices', enums) : null, bools.length ? h('div.toggles', bools) : null, nums.length ? h('div.ranges', nums) : null);
}

/**
 * Asset picker: search box, tag chips, tiles with thumbnails.
 * thumbs: (assetId) → url | '' ; onPick(asset)
 */
export function assetPicker(assets, currentId, onPick, opts = {}) {
  const wrap = h('div.picker');
  const tags = [...new Set(assets.flatMap(a => a.tags || []))].slice(0, 14);
  let q = '', tag = '';
  const grid = h('div.tiles.tiles-wrap', { attrs: { role: 'listbox' } });
  const draw = () => {
    grid.replaceChildren();
    const ql = q.trim().toLowerCase();
    const list = assets.filter(a => (!tag || (a.tags || []).includes(tag)) && (!ql || [a.id, a.label.en, a.label.ar, a.description, ...(a.tags || [])].join(' ').toLowerCase().includes(ql)));
    for (const a of list) {
      const url = opts.thumb ? opts.thumb(a.id) : '';
      grid.append(h('button.tile', {
        type: 'button', title: a.description, attrs: { 'aria-pressed': String(a.id === currentId), role: 'option', 'aria-selected': String(a.id === currentId) },
        onclick: () => onPick(a),
      }, h('span.tile-img', url ? h('img', { src: url, alt: '', loading: 'lazy' }) : h('span.tile-glyph', glyph(a))), h('span.tile-name', Lb(a.label))));
    }
    if (!list.length) grid.append(h('p.muted.small', '—'));
  };
  if (assets.length > 6) {
    const search = h('input.search', { type: 'search', placeholder: T('search'), attrs: { 'aria-label': T('search') } });
    search.addEventListener('input', () => { q = search.value; draw(); });
    wrap.append(h('div.picker-bar', search, tags.length > 2 ? h('div.chips', [h('button.chip', { type: 'button', attrs: { 'aria-pressed': 'true' }, onclick: e => { tag = ''; mark(e.target); draw(); } }, T('allTags')), ...tags.map(tg => h('button.chip', { type: 'button', attrs: { 'aria-pressed': 'false' }, onclick: e => { tag = tg; mark(e.target); draw(); } }, tg))]) : null));
  }
  const mark = btn => { for (const b of btn.parentNode.children) b.setAttribute('aria-pressed', String(b === btn)); };
  wrap.append(grid);
  draw();
  return wrap;
}
/** A simple glyph for assets without a thumbnail. */
function glyph(a) {
  const s = { top: '👕', mid: '🧥', outer: '🧥', bottom: '👖', fullBody: '👗', footwear: '👟', headwear: '🧢', neckwear: '🧣', eyewear: '👓', jewelry: '💍', bag: '🎒', belt: '➰', handwear: '🧤', hairStyle: '💇', browStyle: '〰', facialHair: '🧔', preset: '🧍' }[a.slot];
  return s || '◆';
}
