/* =====================================================================
 * "Image-to-Character AI Prompt" panel. The prompt, the catalog and the
 * JSON Schema are generated from the live asset registry every time the
 * app starts, so they always list exactly the assets that exist.
 * ===================================================================== */
import { h, clear, toast } from './dom.js';
import { t } from './i18n.js';
import { allAssets, SLOT_IDS } from '../core/registry.js';
import { SCHEMA_VERSION } from '../schema/schema.js';
import { buildPrompt, buildCatalogText, buildCatalogJson, buildJsonSchema } from '../schema/prompt.js';
import { copyText, saveFile } from '../export/download.js';
import { reportSave } from './export-panel.js';

export class PromptPanel {
  constructor(root, ctx) {
    this.root = root;
    this.ctx = ctx;
    this.full = buildPrompt({ includeCatalog: true });
    this.short = buildPrompt({ includeCatalog: false });
    this.catalog = buildCatalogText();
  }

  async copy(text, btn) {
    const ta = this.root.querySelector('#prompt-text');
    // copy inside the click handler (required by the clipboard API); fall back to selecting the text
    const ok = await copyText(text);
    if (ok) {
      toast(t('copied'));
      if (btn) { const old = btn.textContent; btn.textContent = '✓ ' + t('copied'); setTimeout(() => { btn.textContent = old; }, 1600); }
    } else {
      if (ta) { ta.value = text; ta.focus(); ta.select(); }
      toast(t('copyFailed'), 'warn', 4500);
    }
  }

  render() {
    clear(this.root);
    const steps = [t('step1'), t('step2'), t('step3'), t('step4')];
    const btn = (cls, label, fn) => { const b = h('button.btn' + cls, { type: 'button' }, label); b.addEventListener('click', () => fn(b)); return b; };
    this.root.append(
      h('section.card-sec',
        h('h2', { attrs: { dir: 'ltr' } }, t('promptTitle')),
        h('p.lead', t('promptSub')),
        h('ol.steps', steps.map(s => h('li', s))),
        h('div.row.wrap',
          btn('.primary', t('copyFull'), b => this.copy(this.full, b)),
          btn('', t('copyShort'), b => this.copy(this.short, b)),
          btn('', t('copyCatalog'), b => this.copy(this.catalog, b))),
        h('div.row.wrap',
          btn('.ghost.small', t('dlCatalog'), async () => reportSave(await saveFile('limonat-asset-catalog.json', JSON.stringify(buildCatalogJson(), null, 2), 'application/json'))),
          btn('.ghost.small', t('dlSchema'), async () => reportSave(await saveFile(`limonat-character.schema-${SCHEMA_VERSION}.json`, JSON.stringify(buildJsonSchema(), null, 2), 'application/json'))),
          btn('.ghost.small', t('goAi'), () => this.ctx.goTab('ai'))),
        h('p.muted.small', t('promptStats', { a: allAssets().length, s: SLOT_IDS.length, v: SCHEMA_VERSION, c: this.full.length.toLocaleString('en-US') }))),
      h('section.card-sec',
        h('textarea.code.prompt-text', { id: 'prompt-text', readOnly: true, value: this.full, spellcheck: false, attrs: { dir: 'ltr', 'aria-label': t('promptTitle') } })));
  }
}
