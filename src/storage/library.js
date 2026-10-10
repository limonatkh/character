/* =====================================================================
 * CHARACTER LIBRARY — named saved designs.
 *
 * Two back-ends with the same interface, chosen at start-up:
 *   cloud  inside the published claude.ai page: the artifact's `db`
 *          capability, in the viewer's PRIVATE subtree data/users/<id>/,
 *          so saves follow the user across devices (phone ↔ PC).
 *   local  anywhere else (local copy, own web server): localStorage.
 * Every record is { id, name, updatedAt, baseCharacter, thumb, doc } where
 * doc is a complete character document (schema 1.0). Files (.json) work in
 * both modes for backups and moving characters between apps.
 * ===================================================================== */

const LS_KEY = 'limonat-cc.library.v1';
const clone = v => JSON.parse(JSON.stringify(v));

function lsRead() {
  try { const v = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function lsWrite(list) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); return true; } catch { return false; }
}

class LocalBackend {
  constructor() { this.mode = 'local'; }
  async list() { return lsRead(); }
  async put(rec) {
    const list = lsRead().filter(r => r.id !== rec.id);
    list.push(rec);
    if (!lsWrite(list)) throw Object.assign(new Error('Browser storage is full or blocked.'), { code: 'storage' });
  }
  async remove(id) { lsWrite(lsRead().filter(r => r.id !== id)); }
  watch(fn) {
    const h = e => { if (e.key === LS_KEY) fn(lsRead()); };
    try { window.addEventListener('storage', h); } catch { /* not a browser */ }
    return () => window.removeEventListener('storage', h);
  }
}

class CloudBackend {
  constructor(db, uid) { this.mode = 'cloud'; this.db = db; this.col = db.collection('data/users/' + uid); }
  async list() { const s = await this.col.get(); return s.docs.filter(d => d.exists).map(d => clone(d.data())); }
  async put(rec) { await this.col.doc(rec.id).set(clone(rec)); }
  async remove(id) { await this.col.doc(id).delete(); }
  watch(fn, onError) {
    return this.col.onSnapshot(s => fn(s.docs.filter(d => d.exists).map(d => clone(d.data()))), e => onError && onError(e));
  }
}

export class Library {
  constructor() {
    this.backend = new LocalBackend();
    this.records = [];
    this.listeners = new Set();
    this.unwatch = null;
  }
  get mode() { return this.backend.mode; }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { const sorted = this.sorted(); for (const fn of this.listeners) fn(sorted, this.mode); }
  sorted() { return this.records.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))); }

  async start() {
    await this.useBackend(this.backend);
    // Inside a claude.ai viewer, switch to the private cloud store when it is available.
    const c = typeof window !== 'undefined' ? window.claude : null;
    if (!c || typeof c.use !== 'function') return;
    try {
      const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
      const uid = user && typeof user.id === 'function' ? await user.id() : null;
      if (db && uid) await this.useBackend(new CloudBackend(db, uid));
    } catch { /* stay local */ }
  }

  async useBackend(b) {
    if (this.unwatch) { try { this.unwatch(); } catch { /* ignore */ } }
    this.backend = b;
    try { this.records = await b.list(); } catch { this.records = []; }
    this.emit();
    this.unwatch = b.watch(list => { this.records = list; this.emit(); }, () => { /* keep last list */ });
  }

  get(id) { return this.records.find(r => r.id === id) || null; }

  async save(doc, thumb) {
    const rec = { id: doc.id, name: doc.character.name, updatedAt: new Date().toISOString(), baseCharacter: doc.baseCharacter, thumb: thumb || '', doc: clone(doc) };
    await this.backend.put(rec);
    this.records = this.records.filter(r => r.id !== rec.id).concat([rec]);
    this.emit();
    return rec;
  }

  async remove(id) {
    await this.backend.remove(id);
    this.records = this.records.filter(r => r.id !== id);
    this.emit();
  }
}

/** Remember which character was open last (a per-browser convenience). */
export const lastOpen = {
  get() { try { return localStorage.getItem('limonat-cc.last') || null; } catch { return null; } },
  set(id) { try { localStorage.setItem('limonat-cc.last', id); } catch { /* ignore */ } },
};
export const prefs = {
  get(k, d) { try { const v = localStorage.getItem('limonat-cc.' + k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('limonat-cc.' + k, v); } catch { /* ignore */ } },
};
