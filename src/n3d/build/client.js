/* =====================================================================
 * BUILD CLIENT — talks to the build worker (or builds in the page when
 * workers are unavailable). Requests are coalesced: while one build runs,
 * only the most recent request waits; older ones resolve as superseded.
 * Geometry arrives once and is kept by key, so unchanged meshes are reused.
 * ===================================================================== */
export class BuildClient {
  constructor() {
    this.geoms = new Map();          // gkey → geometry
    this.seq = 0;
    this.running = null;             // { id, resolve, onProgress }
    this.pending = null;             // { doc, detail, resolve, onProgress }
    this.worker = null;
    this.local = null;               // in-page fallback
    try {
      const src = globalThis.__N3D_WORKER_SRC__;
      this.worker = src ? new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))) : new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
      this.worker.onmessage = e => this.onMessage(e.data);
      this.worker.onerror = e => { console.warn('[n3d] build worker failed, building in the page instead', e.message || e); this.worker = null; this.retryLocal(); };
    } catch (e) { this.worker = null; }
  }

  /** Build a document; resolves { result } or { superseded: true } or { error }. */
  build(doc, detail, onProgress) {
    return new Promise(resolve => {
      if (this.pending) this.pending.resolve({ superseded: true });
      this.pending = { doc, detail, resolve, onProgress };
      if (!this.running) this.next();
    });
  }

  next() {
    const job = this.pending;
    if (!job) return;
    this.pending = null;
    const id = ++this.seq;
    this.running = { id, ...job };
    if (this.worker) this.worker.postMessage({ id, doc: job.doc, detail: job.detail });
    else this.buildLocal(id, job);
  }

  async buildLocal(id, job) {
    try {
      if (!this.local) {
        await import('../assets/index.js');
        const m = await import('./character.js');
        this.local = { build: m.buildCharacter, cache: new Map() };
      }
      await new Promise(r => setTimeout(r, 0));
      const res = this.local.build(job.doc, { cache: this.local.cache, detail: job.detail, onProgress: (stage, f) => job.onProgress && job.onProgress(stage, f) });
      this.finish(id, { result: res });
    } catch (e) { this.finish(id, { error: String((e && e.stack) || e) }); }
  }

  retryLocal() {
    if (this.running) { const job = this.running; this.running = null; this.pending = this.pending || job; this.next(); }
  }

  onMessage(msg) {
    if (!this.running || msg.id !== this.running.id) return;
    if (msg.progress) { this.running.onProgress && this.running.onProgress(msg.progress.stage, msg.progress.f); return; }
    if (msg.result) {
      for (const m of msg.result.meshes) {
        if (m.geometry) this.geoms.set(m.gkey, m.geometry);
        else m.geometry = this.geoms.get(m.gkey) || null;
      }
      // forget geometry no longer used (the worker then resends anything needed again)
      const live = new Set(msg.result.meshes.map(m => m.gkey));
      const missing = msg.result.meshes.some(m => !m.geometry);
      if (missing || this.geoms.size > live.size * 3 + 60) {
        for (const k of [...this.geoms.keys()]) if (!live.has(k)) this.geoms.delete(k);
        this.worker.postMessage({ reset: true });
        for (const m of msg.result.meshes) if (m.geometry) this.geoms.set(m.gkey, m.geometry);
      }
      msg.result.meshes = msg.result.meshes.filter(m => m.geometry);
    }
    this.finish(msg.id, msg.result ? { result: msg.result } : { error: msg.error });
  }

  finish(id, out) {
    if (!this.running || this.running.id !== id) return;
    const job = this.running;
    this.running = null;
    job.resolve(out);
    this.next();
  }
}
