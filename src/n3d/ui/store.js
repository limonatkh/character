/* =====================================================================
 * NORMAL 3D STORE — the current Normal 3D document + undo / redo.
 * Same contract as the Voxel store (commit / preview / replace), but for
 * the "limonat-character-3d" document; every change is normalised by
 * completeN3D, so the document is always complete and in range.
 * ===================================================================== */
import { completeN3D } from '../core/document.js';

const MAX_HISTORY = 150;
const clone = v => JSON.parse(JSON.stringify(v));
const body = d => JSON.stringify({ ...d, meta: { ...d.meta, updatedAt: '', createdAt: '' } });

export class N3DStore {
  constructor(doc) {
    this.doc = completeN3D(clone(doc));
    this.undoStack = []; this.redoStack = [];
    this.listeners = new Set();
    this.pendingBase = null;
    this.clean = body(this.doc);
    this.everSaved = false;
  }
  snapshot() { return JSON.stringify(this.doc); }
  dirtyOrNew() { return body(this.doc) !== this.clean; }
  status() { return this.dirtyOrNew() ? 'unsaved' : this.everSaved ? 'saved' : 'new'; }
  markSaved() { this.clean = body(this.doc); this.everSaved = true; this.emit({ kind: 'saved' }); }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(info) { for (const fn of this.listeners) fn(this.doc, info); }
  push(snap, label) { this.undoStack.push({ snap, label }); if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift(); this.redoStack.length = 0; }

  commit(mutator, label = 'edit') {
    const before = this.pendingBase || this.snapshot();
    this.pendingBase = null;
    const next = clone(this.doc);
    if (mutator) mutator(next);
    const done = completeN3D(next);
    if (JSON.stringify(done) === before) { this.doc = done; this.emit({ kind: 'noop', label }); return false; }
    this.push(before, label);
    this.doc = done;
    this.emit({ kind: 'commit', label });
    return true;
  }
  preview(mutator) {
    if (!this.pendingBase) this.pendingBase = this.snapshot();
    const next = clone(this.doc);
    mutator(next);
    this.doc = completeN3D(next);
    this.emit({ kind: 'preview' });
  }
  replace(doc, label = 'replace', { resetHistory = false, silent = false } = {}) {
    const before = this.pendingBase || this.snapshot();
    this.pendingBase = null;
    if (resetHistory) { this.undoStack.length = 0; this.redoStack.length = 0; }
    else if (!silent) this.push(before, label);
    this.doc = completeN3D(clone(doc));
    this.emit({ kind: 'replace', label });
  }
  canUndo() { return this.undoStack.length > 0; }
  canRedo() { return this.redoStack.length > 0; }
  undo() {
    if (this.pendingBase) { this.doc = JSON.parse(this.pendingBase); this.pendingBase = null; }
    const e = this.undoStack.pop(); if (!e) return false;
    this.redoStack.push({ snap: this.snapshot(), label: e.label });
    this.doc = JSON.parse(e.snap);
    this.emit({ kind: 'undo', label: e.label });
    return true;
  }
  redo() {
    const e = this.redoStack.pop(); if (!e) return false;
    this.undoStack.push({ snap: this.snapshot(), label: e.label });
    this.doc = JSON.parse(e.snap);
    this.emit({ kind: 'redo', label: e.label });
    return true;
  }
}
