/* =====================================================================
 * AI IMPORT PANEL — paste or open the JSON an external AI model produced.
 * The text is only ever parsed with JSON.parse and validated field by
 * field; on any error the current character is left untouched, and the
 * user may choose to apply just the valid values.
 * ===================================================================== */
import { h, clear, pickFile, readFileText, toast } from './dom.js';
import { t, L } from './i18n.js';
import { SLOTS } from '../core/registry.js';
import { extractJson, validateDocument } from '../schema/validate.js';
import { exampleDocument } from '../schema/prompt.js';
import { documentFromValidation } from '../core/document.js';
import { prefs } from '../storage/library.js';

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

const PATH_LABELS = [
  ['character.body.proportions', () => t('proportions')], ['character.body.skinColor', () => t('skinColor')], ['character.body', () => L(SLOTS.bodyType.label)],
  ['character.head', () => L(SLOTS.headShape.label)], ['character.hair', () => L(SLOTS.hair.label)], ['character.headwear', () => L(SLOTS.headwear.label)],
  ['character.face.eyes', () => L(SLOTS.eyes.label)], ['character.face.eyebrows', () => L(SLOTS.eyebrows.label)], ['character.face.mouth', () => L(SLOTS.mouth.label)],
  ['character.face.facialHair', () => L(SLOTS.facialHair.label)], ['character.face.details', () => L(SLOTS.faceDetail.label)], ['character.face', () => t('secFace')],
  ['character.clothing.top', () => L(SLOTS.top.label)], ['character.clothing.outerwear', () => L(SLOTS.outerwear.label)], ['character.clothing.bottom', () => L(SLOTS.bottom.label)],
  ['character.clothing.shoes', () => L(SLOTS.shoes.label)], ['character.clothing', () => t('secClothes')], ['character.accessories', () => L(SLOTS.accessory.label)],
  ['character.name', () => t('name')], ['reference', () => t('refDesc')], ['uncertain', () => t('uncertain')], ['unsupported', () => t('unsupported')],
];
export function pathLabel(path) {
  if (!path) return t('whole');
  for (const [p, f] of PATH_LABELS) if (path === p || path.startsWith(p + '.') || path.startsWith(p + '[')) return f();
  return path;
}

export class ImportPanel {
  constructor(root, ctx) {
    this.root = root;
    this.ctx = ctx;
    this.text = prefs.get('aiDraft', '');
    this.mode = 'doc';
    this.report = null;       // last validation outcome to show
  }
  get store() { return this.ctx.store; }

  render() {
    clear(this.root);
    const ta = h('textarea.code', {
      id: 'ai-json', spellcheck: false, value: this.text, placeholder: t('aiPlaceholder'),
      attrs: { dir: 'ltr', 'aria-label': t('aiTitle'), autocomplete: 'off', autocapitalize: 'off' },
      oninput: () => { this.text = ta.value; prefs.set('aiDraft', this.text.length < 100000 ? this.text : ''); },
    });
    const modeSel = h('select.select', { id: 'ai-mode', onchange: () => { this.mode = modeSel.value; } },
      [['doc', t('modeDoc')], ['replace', t('modeReplace')], ['patch', t('modePatch')]].map(([v, l]) => h('option', { value: v, selected: v === this.mode }, l)));
    this.root.append(
      h('section.card-sec',
        h('h2', t('aiTitle')),
        h('p.lead', t('aiHelp')),
        ta,
        h('div.row.wrap',
          h('button.btn.primary', { type: 'button', id: 'ai-apply', onclick: () => this.apply(false) }, t('aiApply')),
          h('button.btn', { type: 'button', onclick: () => this.openFile() }, t('aiOpen')),
          h('button.btn.ghost', { type: 'button', onclick: () => { this.setText(JSON.stringify(exampleDocument(), null, 2)); } }, t('aiExample')),
          h('button.btn.ghost', { type: 'button', onclick: () => { this.setText(''); this.report = null; this.render(); } }, t('aiClear'))),
        h('label.inline', h('span', t('aiMode')), modeSel)),
      this.reportView(),
      this.notesView());
  }

  setText(s) {
    this.text = s;
    prefs.set('aiDraft', s.length < 100000 ? s : '');
    const ta = this.root.querySelector('#ai-json');
    if (ta) ta.value = s;
  }

  openFile() {
    pickFile('.json,application/json,text/plain', async f => {
      try { this.setText(await readFileText(f)); this.apply(false); } catch { toast(t('fileReadError'), 'error'); }
    });
  }

  /** Validate the text and apply it. validOnly = apply even with errors (valid fields only). */
  apply(validOnly) {
    const ex = extractJson(this.text);
    if (ex.error) {
      this.report = { ok: false, applied: false, items: [{ level: 'error', path: '', message: ex.error }] };
      this.render();
      this.focusReport();
      return;
    }
    let raw = ex.value;
    if (isObj(raw) && this.mode !== 'doc') raw = { ...raw, mode: this.mode };
    const r = validateDocument(raw, { current: this.store.config, currentBase: this.store.doc.baseCharacter });
    const items = ex.notes.map(n => ({ level: 'warning', path: '', message: n })).concat(r.items);
    if (r.config && (r.ok || validOnly)) {
      const doc = documentFromValidation(r, raw, r.mode === 'patch' ? this.store.doc : null);
      this.store.replace(doc, t('tabAi'));
      this.report = { ok: true, applied: true, count: r.applied, items, skipped: r.errors.length };
      toast(t('rOk', { n: r.applied }), r.errors.length ? 'warn' : 'ok');
    } else {
      this.report = { ok: false, applied: false, items, canApplyValid: !!r.config && r.applied > 0 };
    }
    this.render();
    this.focusReport();
  }

  focusReport() {
    const el = this.root.querySelector('.report');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  reportView() {
    const R = this.report;
    if (!R) return null;
    const count = lv => R.items.filter(i => i.level === lv).length;
    const head = R.applied
      ? h('div.banner.ok', h('strong', t('rOk', { n: R.count })), ' ', t('rOkUndo'))
      : h('div.banner.error', h('strong', t('rRejected')));
    const counts = h('p.counts', t('rCounts', { e: count('error'), w: count('warning'), i: count('info') }));
    const list = h('ul.issues', R.items.map(it => h('li.issue', { dataset: { level: it.level } },
      h('span.pill', { dataset: { level: it.level } }, t(it.level === 'error' ? 'lvError' : it.level === 'warning' ? 'lvWarning' : 'lvInfo')),
      h('span.issue-field', pathLabel(it.path)),
      it.path ? h('code.issue-path', { attrs: { dir: 'ltr' } }, it.path) : null,
      h('span.issue-msg', { attrs: { dir: 'ltr' } }, it.message))));
    const valid = R.canApplyValid ? h('button.btn.gold', { type: 'button', onclick: () => this.apply(true) }, t('rApplyValid')) : null;
    return h('section.card-sec.report', { attrs: { 'aria-live': 'polite' } }, head, counts, valid, R.items.length ? list : null);
  }

  notesView() {
    const d = this.store.doc;
    const desc = d.reference && d.reference.description;
    const unc = d.uncertain || [], uns = d.unsupported || [];
    if (!desc && !unc.length && !uns.length) return null;
    return h('section.card-sec.notes',
      h('h3', t('aiNotes')),
      desc ? h('div.note-block', h('div.field-label', t('refDesc')), h('p', { attrs: { dir: 'auto' } }, desc)) : null,
      unc.length ? h('div.note-block', h('div.field-label', t('uncertain')), h('ul', unc.map(u => h('li', { attrs: { dir: 'auto' } }, u)))) : null,
      uns.length ? h('div.note-block', h('div.field-label', t('unsupported')), h('ul', uns.map(u => h('li', { attrs: { dir: 'auto' } }, u)))) : null);
  }
}
