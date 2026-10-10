/* =====================================================================
 * APP STORE — the current character document + undo / redo.
 *
 * Every change goes through one of three calls:
 *   commit(mutator, label)  a finished change (one undo step)
 *   preview(mutator)        live change while dragging a slider or colour
 *                           wheel; the following commit() closes the step
 *   replace(doc, label)     a whole new document (import, load, new)
 * Listeners get (doc, info) where info.kind is 'commit' | 'preview' |
 * 'replace' | 'undo' | 'redo'. Manual edits and AI imports both end up
 * here, so they always stay consistent with each other.
 * ===================================================================== */
import { completeConfig } from '../schema/validate.js';

const MAX_HISTORY = 120;
const clone = v => JSON.parse(JSON.stringify(v));

export class Store {
  constructor(doc) {
    this.doc = clone(doc);
    this.undoStack = [];
    this.redoStack = [];
    this.listeners = new Set();
    this.pendingBase = null;      // snapshot taken when a preview sequence started
    this.cleanSnapshot = JSON.stringify(this.doc.character);   // character as last saved / opened
    this.everSaved = false;
  }

  get config() { return this.doc.character; }
  snapshot() { return JSON.stringify(this.doc); }
  /** True when the character differs from how it was last saved / opened. */
  dirtyOrNew() { return JSON.stringify(this.doc.character) !== this.cleanSnapshot; }
  /** 'saved' | 'unsaved' | 'new' — for the status chip. */
  status() { return this.dirtyOrNew() ? 'unsaved' : this.everSaved ? 'saved' : 'new'; }
  markSaved() { this.cleanSnapshot = JSON.stringify(this.doc.character); this.everSaved = true; this.emit({ kind: 'saved' }); }
  markUnsavedNew() { this.cleanSnapshot = JSON.stringify(this.doc.character); this.everSaved = false; this.emit({ kind: 'saved' }); }

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(info) { for (const fn of this.listeners) fn(this.doc, info); }

  push(snap, label) {
    this.undoStack.push({ snap, label });
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  /** Apply mutator(config) to a copy, normalise it, and record one undo step. */
  commit(mutator, label = 'edit') {
    const before = this.pendingBase || this.snapshot();
    this.pendingBase = null;
    const next = clone(this.doc);
    if (mutator) mutator(next.character, next);
    next.character = completeConfig(next.character);
    if (JSON.stringify(next) === before) { this.emit({ kind: 'noop', label }); return false; }
    this.push(before, label);
    this.doc = next;
    this.emit({ kind: 'commit', label });
    return true;
  }

  /** Live update without a history step (the next commit closes it). */
  preview(mutator) {
    if (!this.pendingBase) this.pendingBase = this.snapshot();
    const next = clone(this.doc);
    mutator(next.character, next);
    next.character = completeConfig(next.character);
    this.doc = next;
    this.emit({ kind: 'preview' });
  }

  /** silent: no undo step (e.g. refreshed timestamps when saving). */
  replace(doc, label = 'replace', { resetHistory = false, silent = false } = {}) {
    const before = this.pendingBase || this.snapshot();
    this.pendingBase = null;
    if (resetHistory) { this.undoStack.length = 0; this.redoStack.length = 0; }
    else if (!silent) this.push(before, label);
    this.doc = clone(doc);
    this.emit({ kind: 'replace', label });
  }

  canUndo() { return this.undoStack.length > 0; }
  canRedo() { return this.redoStack.length > 0; }

  undo() {
    if (this.pendingBase) { this.doc = JSON.parse(this.pendingBase); this.pendingBase = null; }
    const e = this.undoStack.pop();
    if (!e) return false;
    this.redoStack.push({ snap: this.snapshot(), label: e.label });
    this.doc = JSON.parse(e.snap);
    this.emit({ kind: 'undo', label: e.label });
    return true;
  }

  redo() {
    const e = this.redoStack.pop();
    if (!e) return false;
    this.undoStack.push({ snap: this.snapshot(), label: e.label });
    this.doc = JSON.parse(e.snap);
    this.emit({ kind: 'redo', label: e.label });
    return true;
  }
}
