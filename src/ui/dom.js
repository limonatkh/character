/* Tiny DOM helpers (no framework). Text is always set with textContent, so
 * nothing that comes from AI output or files is ever parsed as HTML. */

/**
 * h('button.btn.small', { onclick, title }, 'text', child, …)
 * Props: class/className, dataset, style (object), on<event> handlers,
 * attrs (object of raw attributes), and anything else as a property.
 */
export function h(tag, props, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) { children.unshift(props); props = null; }
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class' || k === 'className') el.className = (el.className ? el.className + ' ' : '') + v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'attrs') for (const [a, av] of Object.entries(v)) { if (av !== undefined && av !== null && av !== false) el.setAttribute(a, av === true ? '' : av); }
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el[k] = v;
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

/** Read a File as text. */
export function readFileText(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsText(file);
  });
}

/** A hidden <input type=file> that calls fn(file) when the user picks one. */
export function pickFile(accept, fn) {
  const input = h('input', { type: 'file', accept, style: { position: 'fixed', left: '-9999px' } });
  input.addEventListener('change', () => { const f = input.files && input.files[0]; input.remove(); if (f) fn(f); });
  document.body.appendChild(input);
  input.click();
}

let toastTimer = null;
/** Small status message at the bottom of the screen. kind: 'ok' | 'warn' | 'error' */
export function toast(msg, kind = 'ok', ms = 2600) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.dataset.kind = kind;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}
