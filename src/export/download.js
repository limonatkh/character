/* Saving files to the user's device.
 * - Normal browser (local file or web server): a temporary <a download> link.
 * - Inside a claude.ai Artifact viewer: the platform's `downloads` capability
 *   (the viewer confirms each file). It only accepts some extensions, so other
 *   files (.glb, .js) are wrapped in a .zip automatically. */
import { makeZip } from './zip.js';

const ARTIFACT_EXT = ['gif', 'png', 'jpg', 'jpeg', 'webp', 'mp4', 'webm', 'txt', 'json', 'md', 'docx', 'pptx', 'epub', 'csv', 'ttf', 'html', 'svg', 'pdf', 'xlsx', 'zip'];

export const inArtifactViewer = () => typeof window !== 'undefined' && !!(window.claude && typeof window.claude.use === 'function');

let dlPromise = null;
function artifactDownloads() {
  if (!dlPromise) dlPromise = window.claude.use('downloads').catch(() => null);
  return dlPromise;
}

/**
 * Save a file. Returns { status: 'saved' | 'declined' | 'zipped' | 'unavailable', name }.
 */
export async function saveFile(name, data, mime = 'application/octet-stream') {
  if (inArtifactViewer()) {
    const dl = await artifactDownloads();
    if (!dl) return { status: 'unavailable', name };
    let fname = name, payload = data, zipped = false;
    const ext = name.split('.').pop().toLowerCase();
    if (!ARTIFACT_EXT.includes(ext)) { fname = name + '.zip'; payload = makeZip([{ name, data }]); zipped = true; }
    const blob = payload instanceof Blob ? payload : new Blob([payload], { type: mime });
    try {
      await dl.save({ filename: fname, data: blob });
      return { status: zipped ? 'zipped' : 'saved', name: fname };
    } catch (e) {
      return { status: e && e.code === 'declined' ? 'declined' : 'unavailable', name: fname, code: e && e.code };
    }
  }
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { status: 'saved', name };
}

/** Copy text; falls back to selecting a textarea when the clipboard API is refused. */
export async function copyText(text, fallbackEl) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = fallbackEl || document.createElement('textarea');
      if (!fallbackEl) { ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); }
      ta.focus(); ta.select();
      const ok = document.execCommand && document.execCommand('copy');
      if (!fallbackEl) ta.remove();
      return !!ok;
    } catch { return false; }
  }
}
