/* 通用界面与浏览器工具函数 */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function fmtBytes(n) {
  if (n == null || isNaN(n)) return '—';
  if (n < 1024) return n + ' B';
  const u = ['KB', 'MB', 'GB', 'TB'];
  let i = -1;
  do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
  return n.toFixed(n >= 100 ? 0 : n >= 10 ? 1 : 2) + ' ' + u[i];
}

export function fmtNum(n, digits = 2) {
  if (!isFinite(n)) return '—';
  return Number(n.toFixed(digits)).toLocaleString('zh-CN');
}

let toastTimer = [];
export function toast(msg, type = '') {
  const wrap = document.getElementById('toast-wrap');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  wrap.appendChild(el);
  const t = setTimeout(() => { el.style.opacity = '0'; el.style.transition = '.2s'; setTimeout(() => el.remove(), 220); }, 2400);
  toastTimer.push(t);
  if (toastTimer.length > 4) clearTimeout(toastTimer.shift());
}

export async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast('已复制到剪贴板', 'ok');
}

export function download(filename, data, mime = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function pickFile({ accept = '', multiple = false } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      const files = [...input.files];
      input.remove();
      resolve(files);
    });
    input.addEventListener('cancel', () => { input.remove(); resolve([]); });
    input.click();
  });
}

export function readAs(file, how = 'text') {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    if (how === 'text') r.readAsText(file);
    else if (how === 'dataurl') r.readAsDataURL(file);
    else r.readAsArrayBuffer(file);
  });
}

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function throttle(fn, ms = 130) {
  let last = 0, timer;
  return (...args) => {
    const now = Date.now();
    const wait = ms - (now - last);
    if (wait <= 0) { last = now; fn(...args); }
    else { clearTimeout(timer); timer = setTimeout(() => { last = Date.now(); fn(...args); }, wait); }
  };
}

export function uid(n = 8) {
  return Math.random().toString(36).slice(2, 2 + n);
}

export function escAttr(s = '') {
  return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/* 常用 SVG 图标（stroke 风格） */
const P = {
  text: '<path d="M5 6h14M5 11h14M5 16h9M5 21h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  encoding: '<path d="M4 8h13l-3-3M20 16H7l3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="5" cy="16" r="1.6" fill="currentColor"/><circle cx="19" cy="8" r="1.6" fill="currentColor"/>',
  dev: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  data: '<rect x="3.5" y="5" width="17" height="14" rx="2" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M3.5 10h17M9.5 10v9M15 10v9" stroke="currentColor" stroke-width="1.5"/>',
  time: '<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M12 7v5.2l3.2 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  math: '<rect x="4" y="3" width="16" height="18" rx="2.5" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M8 7h8M8 12h3M15.5 11v4M13.5 13h4M8 17h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  random: '<rect x="4" y="4" width="16" height="16" rx="3.5" stroke="currentColor" stroke-width="1.7" fill="none"/><circle cx="9" cy="9" r="1.4" fill="currentColor"/><circle cx="15" cy="15" r="1.4" fill="currentColor"/><circle cx="15" cy="9" r="1.4" fill="currentColor"/><circle cx="9" cy="15" r="1.4" fill="currentColor"/>',
  security: '<path d="M12 3.5 19 6v6c0 4.3-2.9 7.4-7 8.5-4.1-1.1-7-4.2-7-8.5V6l7-2.5Z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/><path d="m9 12 2 2 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  design: '<path d="M12 3a9 9 0 1 0 0 18h1.2a2.3 2.3 0 0 0 1.4-4.1c-.8-.6-.4-1.9.6-1.9H18a3 3 0 0 0 3-3c0-5-4-9-9-9Z" stroke="currentColor" stroke-width="1.7" fill="none"/><circle cx="8.5" cy="10" r="1.3" fill="currentColor"/><circle cx="12" cy="7.5" r="1.3" fill="currentColor"/><circle cx="15.5" cy="10" r="1.3" fill="currentColor"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5" stroke="currentColor" stroke-width="1.7" fill="none"/><circle cx="9" cy="9.5" r="1.6" fill="currentColor"/><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  pdf: '<path d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/><path d="M14 3v5h5M8.5 17v-4h1.3a1.3 1.3 0 0 1 0 2.6H8.5m4.2 1.4v-4h1a2 2 0 0 1 0 4h-1Zm4.8-4h2m-2 0v4m0-2h1.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  file: '<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H9l2 2h7.5A1.5 1.5 0 0 1 20 7.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/><path d="M4 10h16" stroke="currentColor" stroke-width="1.5"/>',
  audio: '<path d="M9 18V6l10-2v12" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6.5" cy="18" r="2.6" stroke="currentColor" stroke-width="1.7" fill="none"/><circle cx="16.5" cy="16" r="2.6" stroke="currentColor" stroke-width="1.7" fill="none"/>',
  media: '<rect x="3" y="5" width="13" height="14" rx="2.5" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="m16 10 5-3v10l-5-3" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/>',
  qr: '<rect x="4" y="4" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.7" fill="none"/><rect x="14" y="4" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.7" fill="none"/><rect x="4" y="14" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" fill="currentColor"/>',
  life: '<path d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 7.5a4.1 4.1 0 0 1 7.5 3.1C19.5 15.4 12 20 12 20Z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/><path d="M8.6 11h1.8l1 2 1.6-3.5 1 1.5h1.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
  learn: '<path d="M12 5.5 3.5 9.5 12 13.5l8.5-4-8.5-4Z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/><path d="M6.5 11.5v4.2c0 1.4 2.5 2.8 5.5 2.8s5.5-1.4 5.5-2.8v-4.2" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/>',
  office: '<rect x="3.5" y="7.5" width="17" height="12" rx="2" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3.5 12h17M10 12v2h4v-2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  browser: '<rect x="3" y="4" width="18" height="15" rx="2.5" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M3 8.5h18" stroke="currentColor" stroke-width="1.6"/><circle cx="6" cy="6.3" r=".9" fill="currentColor"/><circle cx="8.8" cy="6.3" r=".9" fill="currentColor"/>',
  fun: '<path d="m12 3 1.9 4.6L19 9.5l-5.1 1.9L12 16l-1.9-4.6L5 9.5l5.1-1.9L12 3Z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/><path d="M18.5 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z" fill="currentColor"/>',
  ai: '<rect x="7" y="7" width="10" height="10" rx="2.5" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M10 10.5h4v4h-4zM12 3v4M12 17v4M3 12h4M17 12h4M5.5 5.5 8 8M16 16l2.5 2.5M18.5 5.5 16 8M8 16l-2.5 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  search: '<circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="m16.5 16.5 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  star: '<path d="m12 3.8 2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.8l-5.1 2.6 1-5.6-4.1-4 5.7-.8L12 3.8Z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/>',
  clock: '<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M12 7v5.2l3.2 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  upload: '<path d="M12 16V4m0 0L7 9m5-5 5 5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  check: '<path d="m4 12 5 5L20 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  lock: '<rect x="4.5" y="10" width="15" height="10" rx="2.5" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10" stroke="currentColor" stroke-width="1.7" fill="none"/>',
  bolt: '<path d="m13 2-8 12h6l-1 8 9-13h-6l0-7Z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>'
};

export function icon(name, size = 18) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${P[name] || P.bolt}</svg>`;
}

/* 通用：把文件拖放区绑定到 input */
export function bindDrop(dropEl, onFiles) {
  ['dragenter', 'dragover'].forEach((ev) => dropEl.addEventListener(ev, (e) => {
    e.preventDefault(); dropEl.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach((ev) => dropEl.addEventListener(ev, (e) => {
    e.preventDefault(); dropEl.classList.remove('over');
  }));
  dropEl.addEventListener('drop', (e) => {
    const files = [...(e.dataTransfer?.files || [])];
    if (files.length) onFiles(files);
  });
  dropEl.addEventListener('click', async () => {
    const files = await pickFile();
    if (files.length) onFiles(files);
  });
}

export const download_ = download;
