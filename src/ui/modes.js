/* =====================================================================
 * CREATION MODES — Voxel and Normal 3D are two independent creators in
 * one page. Each has its own interface, store, library, prompt, schema and
 * export; this module only provides the switch shown in both top bars.
 * ===================================================================== */
import { h } from './dom.js';
import { getLang } from './i18n.js';

export const MODES = ['voxel', 'n3d'];
const LABEL = {
  voxel: { ar: 'مكعّبات', en: 'Voxel' },
  n3d: { ar: '3D عادي', en: 'Normal 3D' },
  title: { ar: 'نمط الإنشاء', en: 'Creation mode' },
};
const tr = k => LABEL[k][getLang()] || LABEL[k].en;
export const modeName = m => tr(m);

/** Segmented control: [Voxel | Normal 3D]. onPick(mode) is called for the other mode. */
export function modeSwitch(current, onPick) {
  return h('div.seg.mode-switch', { attrs: { role: 'group', 'aria-label': tr('title'), title: tr('title') } },
    MODES.map(m => h('button', {
      type: 'button', dataset: { mode: m }, attrs: { 'aria-pressed': String(m === current) },
      onclick: () => { if (m !== current) onPick(m); },
    }, h('span.mode-ico', { attrs: { 'aria-hidden': 'true' } }, m === 'voxel' ? '▦' : '●'), h('span.mode-txt', tr(m)))));
}
