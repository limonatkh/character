/* =====================================================================
 * CHARACTER DOCUMENT — the one format for AI commands, saves and exports.
 *
 * {
 *   schemaVersion: "1.0", kind: "limonat-character", id: "chr_…",
 *   baseCharacter: "base_…", reference?: { description, source },
 *   character: { …full character config… },
 *   uncertain?: [string], unsupported?: [string],
 *   meta: { createdAt, updatedAt, generator }
 * }
 * Pure data (no DOM / Three.js) so Node tests and the game can reuse it.
 * ===================================================================== */
import { SCHEMA_VERSION, DOC_KIND, APP_NAME, APP_VERSION } from './constants.js';
import { getBase, defaultBaseId } from './registry.js';
import { baseConfig, validateDocument } from '../schema/validate.js';

const ID_RE = /^[A-Za-z0-9_-]{4,48}$/;
const clone = v => JSON.parse(JSON.stringify(v));

export function newId() {
  const rnd = Math.random().toString(36).slice(2, 8);
  return 'chr_' + Date.now().toString(36) + rnd;
}

function stamp(meta) {
  const now = new Date().toISOString();
  return { createdAt: meta && typeof meta.createdAt === 'string' ? meta.createdAt : now, updatedAt: now, generator: `${APP_NAME} ${APP_VERSION}` };
}

/** A fresh document from a base character. */
export function newDocument(baseId) {
  const id = getBase(baseId) ? baseId : defaultBaseId();
  return {
    schemaVersion: SCHEMA_VERSION, kind: DOC_KIND, id: newId(), baseCharacter: id,
    character: baseConfig(id), meta: stamp(null),
  };
}

/**
 * Build the document that results from a validation result.
 * keep: the document being replaced (id / meta are kept when the import
 * modifies the current character; a saved file brings its own id).
 */
export function documentFromValidation(result, raw, keep) {
  const fromFile = raw && typeof raw.id === 'string' && ID_RE.test(raw.id) && raw.kind === DOC_KIND;
  const doc = {
    schemaVersion: SCHEMA_VERSION, kind: DOC_KIND,
    id: fromFile ? raw.id : (keep && keep.id) || newId(),
    baseCharacter: result.baseCharacter || (keep && keep.baseCharacter) || defaultBaseId(),
    character: clone(result.config),
    meta: stamp(fromFile ? raw.meta : keep && keep.meta),
  };
  if (result.reference && (result.reference.description || result.reference.source)) doc.reference = result.reference;
  if (result.uncertain && result.uncertain.length) doc.uncertain = result.uncertain.slice();
  if (result.unsupported && result.unsupported.length) doc.unsupported = result.unsupported.slice();
  return doc;
}

/** Validate + normalise a stored / opened document (a save file is just a command document). */
export function loadDocument(raw) {
  const r = validateDocument(raw, {});
  if (!r.config) return { ok: false, result: r, doc: null };
  return { ok: r.ok, result: r, doc: documentFromValidation(r, raw, null) };
}

/** Copy of a document with refreshed timestamps (what gets saved / exported). */
export function finalizeDocument(doc) {
  const d = clone(doc);
  d.meta = stamp(doc.meta);
  return d;
}
