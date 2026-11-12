/* 第三方依赖按需加载器：打开工具时才下载，并实时汇报进度
   每个依赖都是 UMD 版本，加载完成后挂到 window[global] 上。 */

export const DEPS = {
  marked: {
    name: 'marked', desc: 'Markdown 解析器', url: 'https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js',
    global: 'marked', bytes: 41000
  },
  dompurify: {
    name: 'DOMPurify', desc: 'HTML 安全清洗', url: 'https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js',
    global: 'DOMPurify', bytes: 22000
  },
  qrcode: {
    name: 'qrcode-generator', desc: '二维码矩阵生成', url: 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js',
    global: 'qrcode', bytes: 24000
  },
  jsqr: {
    name: 'jsQR', desc: '二维码图像识别', url: 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
    global: 'jsQR', bytes: 53000
  },
  jsbarcode: {
    name: 'JsBarcode', desc: '一维条形码绘制', url: 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js',
    global: 'JsBarcode', bytes: 59000
  },
  jszip: {
    name: 'JSZip', desc: 'ZIP 压缩与解压', url: 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
    global: 'JSZip', bytes: 97000
  },
  pdflib: {
    name: 'pdf-lib', desc: 'PDF 创建与编辑', url: 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    global: 'PDFLib', bytes: 520000
  },
  pdfjs: {
    name: 'PDF.js', desc: 'PDF 渲染与文本提取', url: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
    global: 'pdfjsLib', bytes: 340000
  },
  chartjs: {
    name: 'Chart.js', desc: '统计图表渲染', url: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.js',
    global: 'Chart', bytes: 205000
  },
  papaparse: {
    name: 'PapaParse', desc: 'CSV 解析与生成', url: 'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js',
    global: 'Papa', bytes: 47000
  },
  yaml: {
    name: 'js-yaml', desc: 'YAML 解析与生成', url: 'https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js',
    global: 'jsyaml', bytes: 42000
  },
  mathjs: {
    name: 'math.js', desc: '表达式求值与矩阵运算', url: 'https://cdn.jsdelivr.net/npm/mathjs@12.4.3/lib/browser/math.js',
    global: 'math', bytes: 760000
  },
  xlsx: {
    name: 'SheetJS', desc: 'Excel 读写', url: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    global: 'XLSX', bytes: 880000
  },
  diff: {
    name: 'jsdiff', desc: '文本差异算法', url: 'https://cdn.jsdelivr.net/npm/diff@5.2.0/dist/diff.min.js',
    global: 'Diff', bytes: 43000
  },
  cryptojs: {
    name: 'CryptoJS', desc: 'MD5 / AES 等算法', url: 'https://cdn.jsdelivr.net/npm/crypto-js@4.2.0/crypto-js.min.js',
    global: 'CryptoJS', bytes: 78000
  },
  katex: {
    name: 'KaTeX', desc: '数学公式排版', url: 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js',
    global: 'katex', bytes: 280000
  },
  katexCss: {
    name: 'KaTeX 样式', desc: '公式样式表', type: 'css', url: 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css'
  },
  tesseract: {
    name: 'Tesseract.js', desc: 'OCR 文字识别引擎', url: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/tesseract.min.js',
    global: 'Tesseract', bytes: 65000
  },
  mermaid: {
    name: 'Mermaid', desc: '流程图与时序图渲染', url: 'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js',
    global: 'mermaid', bytes: 2900000
  },
  sqljs: {
    name: 'sql.js', desc: '浏览器内 SQLite 引擎', url: 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/sql-wasm.js',
    global: 'initSqlJs', bytes: 38000
  }
};

const loaded = new Set();
const pending = new Map();

function injectScript(src, timeout = 45000) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    const timer = setTimeout(() => { s.remove(); reject(new Error('脚本加载超时')); }, timeout);
    s.onload = () => { clearTimeout(timer); resolve(); };
    s.onerror = () => { clearTimeout(timer); s.remove(); reject(new Error('脚本下载失败')); };
    document.head.appendChild(s);
  });
}

function injectCss(href) {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error('样式下载失败'));
    document.head.appendChild(link);
  });
}

async function readWithProgress(res, total, emit, id) {
  if (!res.body || !window.TextDecoder) {
    const buf = await res.arrayBuffer();
    emit({ id, status: 'progress', loaded: buf.byteLength, total: buf.byteLength });
    return buf;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    emit({ id, status: 'progress', loaded: received, total });
  }
  const out = new Uint8Array(received);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.byteLength; }
  return out.buffer;
}

async function loadOne(id, emit) {
  const dep = DEPS[id];
  if (!dep) throw new Error('未知依赖：' + id);

  if (dep.type === 'css') {
    emit({ id, status: 'start', dep });
    try {
      await injectCss(dep.url);
      emit({ id, status: 'done', dep, loaded: 0, total: 0 });
    } catch (e) {
      emit({ id, status: 'error', dep, error: e.message });
      throw e;
    }
    return;
  }

  emit({ id, status: 'start', dep });
  const est = dep.bytes || 0;
  let payload = null;
  let size = est;
  try {
    const res = await fetch(dep.url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const total = Number(res.headers.get('content-length')) || est;
    payload = await readWithProgress(res, total, emit, id);
    size = payload.byteLength || total;
  } catch (e) {
    emit({ id, status: 'fallback', dep, error: e.message });
    try {
      await injectScript(dep.url);
      emit({ id, status: 'done', dep, loaded: est, total: est, fallback: true });
      return;
    } catch (e2) {
      emit({ id, status: 'error', dep, error: e2.message });
      throw new Error(`${dep.name} 下载失败：${e2.message}（请检查网络后重试）`);
    }
  }

  const blob = new Blob([payload], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  try {
    await injectScript(url);
    emit({ id, status: 'done', dep, loaded: size, total: size });
  } catch (e) {
    emit({ id, status: 'fallback', dep, error: e.message });
    await injectScript(dep.url);
    emit({ id, status: 'done', dep, loaded: est, total: est, fallback: true });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * 按顺序加载依赖，emit 会收到每个依赖的实时进度。
 * 已在本会话加载过的依赖直接返回 cached。
 */
export async function loadDeps(ids, emit = () => {}) {
  const list = [...new Set(ids)];
  for (const id of list) {
    if (loaded.has(id)) {
      emit({ id, status: 'cached', dep: DEPS[id] });
      continue;
    }
    if (!pending.has(id)) pending.set(id, loadOne(id, emit));
    try {
      await pending.get(id);
      loaded.add(id);
      pending.delete(id);
    } catch (e) {
      pending.delete(id);
      throw e;
    }
  }
}

export function isLoaded(id) { return loaded.has(id); }

export function globalOf(id) {
  const dep = DEPS[id];
  return dep ? window[dep.global] : undefined;
}
