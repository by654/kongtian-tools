/* 通用工具：路径、加载、文件、ZIP、文本编码等 */
export const VENDOR = new URL('../../../vendor/', import.meta.url).href;

const scriptCache = new Map();

export function loadScript(url) {
  if (scriptCache.has(url)) return scriptCache.get(url);
  const p = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptCache.delete(url);
      reject(new Error('依赖加载失败：' + url));
    };
    document.head.appendChild(s);
  });
  scriptCache.set(url, p);
  return p;
}

/** 相对 vendor 目录加载第三方 UMD 库 */
export function loadVendor(rel) {
  return loadScript(new URL(rel, VENDOR).href);
}

export function extOf(name) {
  const m = /\.([^.\/]+)$/.exec(name || '');
  return m ? m[1].toLowerCase() : '';
}

export function baseName(name) {
  return (name || '').replace(/\.[^.]+$/, '') || 'output';
}

export function fmtSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return (n >= 100 || i === 0 ? n.toFixed(0) : n.toFixed(n >= 10 ? 1 : 2)) + ' ' + u[i];
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function escapeXml(s) {
  return String(s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function sanitizeFileName(name) {
  return String(name)
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\.+$/, '')
    .slice(0, 220) || 'output';
}

export function readAsArrayBuffer(file) {
  if (file.arrayBuffer) return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error || new Error('读取文件失败'));
    fr.readAsArrayBuffer(file);
  });
}

export async function readText(file, encoding = 'utf-8') {
  const ab = await readAsArrayBuffer(file);
  return new TextDecoder(encoding || 'utf-8').decode(ab);
}

export function textBlob(text, mime = 'text/plain;charset=utf-8') {
  return new Blob([text], { type: mime });
}

export function bytesToUtf16Be(bytes) {
  const u16 = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 2) {
    u16[i] = bytes[i + 1];
    u16[i + 1] = bytes[i];
  }
  return u16;
}

export function mimeForExt(ext) {
  const map = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
    avif: 'image/avif', bmp: 'image/bmp', ico: 'image/x-icon', gif: 'image/gif',
    svg: 'image/svg+xml', tiff: 'image/tiff', tif: 'image/tiff',
    pdf: 'application/pdf', txt: 'text/plain;charset=utf-8',
    md: 'text/markdown;charset=utf-8', markdown: 'text/markdown;charset=utf-8', html: 'text/html;charset=utf-8',
    htm: 'text/html;charset=utf-8',
    rtf: 'application/rtf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    epub: 'application/epub+zip', odt: 'application/vnd.oasis.opendocument.text',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12', xlsb: 'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
    ods: 'application/vnd.oasis.opendocument.spreadsheet',
    csv: 'text/csv;charset=utf-8', tsv: 'text/tab-separated-values;charset=utf-8',
    json: 'application/json', zip: 'application/zip', tar: 'application/x-tar', gz: 'application/gzip',
    mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', ogg: 'audio/ogg', oga: 'audio/ogg',
    opus: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', aiff: 'audio/aiff', aif: 'audio/aiff',
    ac3: 'audio/ac3', wma: 'audio/x-ms-wma', mp2: 'audio/mpeg', amr: 'audio/amr', au: 'audio/basic', caf: 'audio/x-caf',
    mp4: 'video/mp4', m4v: 'video/x-m4v', webm: 'video/webm', mkv: 'video/x-matroska',
    mov: 'video/quicktime', avi: 'video/x-msvideo', flv: 'video/x-flv', wmv: 'video/x-ms-wmv',
    ts: 'video/mp2t', mts: 'video/mp2t', m2ts: 'video/mp2t', mpeg: 'video/mpeg', mpg: 'video/mpeg',
    '3gp': 'video/3gpp', ogv: 'video/ogg', asf: 'video/x-ms-asf', f4v: 'video/x-f4v', vob: 'video/dvd',
    srt: 'application/x-subrip;charset=utf-8', vtt: 'text/vtt;charset=utf-8',
    ass: 'text/x-ssa;charset=utf-8', ssa: 'text/x-ssa;charset=utf-8',
  };
  return map[ext] || 'application/octet-stream';
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function makeZip(entries, options = {}) {
  await loadVendor('jszip/jszip.min.js');
  const zip = new window.JSZip();
  const used = new Set();
  const rawLevel = options.level === undefined || options.level === null ? 6 : Number(options.level);
  const level = Number.isFinite(rawLevel) ? Math.max(0, Math.min(9, rawLevel)) : 6;
  const safePath = (path) => String(path).split('/')
    .filter((s) => s && s !== '.' && s !== '..')
    .map((s) => sanitizeFileName(s))
    .join('/');
  for (const e of entries) {
    const original = options.keepPaths ? safePath(e.name || 'file') : sanitizeFileName(e.name || 'file');
    let name = original;
    let i = 1;
    while (used.has(name.toLowerCase())) {
      const dot = name.lastIndexOf('.');
      const suffix = '-' + i++;
      name = dot > 0 ? name.slice(0, dot) + suffix + name.slice(dot) : name + suffix;
    }
    used.add(name.toLowerCase());
    const data = e.blob instanceof Blob ? await e.blob.arrayBuffer() : e.data;
    zip.file(name, data);
  }
  const compression = level === 0 ? 'STORE' : 'DEFLATE';
  return zip.generateAsync({ type: 'blob', compression, compressionOptions: { level } });
}

export function zipStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/** 流式 fetch，用于首次下载 ffmpeg 核心时展示进度 */
export async function streamFetch(url, onProgress, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body || !res.body.getReader) {
    const buf = await res.arrayBuffer();
    onProgress && onProgress(1, buf.byteLength, buf.byteLength);
    return buf;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress && onProgress(total ? received / total : null, received, total);
  }
  const out = new Uint8Array(received);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out.buffer;
}

export function debounce(fn, ms = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
