/* PDF 工具箱：页面整理、拼版、水印页码、元数据、裁剪、HTML 转换等
   参考 BentoPDF（https://github.com/alam00000/bentopdf，AGPL-3.0）的功能设计，
   使用 pdf-lib / pdf.js 在浏览器本地实现，纯静态、无服务端依赖。 */
import { baseName, escapeHtml, makeZip, readAsArrayBuffer } from './utils.js';
import { ensurePdfJs, ensurePdfLib, parseRangeGroups } from './pdf.js';

const A4 = { w: 595.28, h: 841.89 };
const PAPER = {
  a4: A4,
  a3: { w: 841.89, h: 1190.55 },
  a5: { w: 419.53, h: 595.28 },
  letter: { w: 612, h: 792 },
  legal: { w: 612, h: 1008 },
};

const clamp01 = (n) => Math.max(0, Math.min(1, n));
const num = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

function assertActive(hooks) {
  if (hooks.isCancelled && hooks.isCancelled()) throw new DOMException('已取消', 'AbortError');
}
function stage(hooks, text) {
  hooks.onStage && hooks.onStage(text);
}
function progress(hooks, p) {
  hooks.onProgress && hooks.onProgress(clamp01(p));
}

export async function loadPdfDoc(file) {
  const { PDFDocument } = await ensurePdfLib();
  try {
    return await PDFDocument.load(await readAsArrayBuffer(file), { ignoreEncryption: true, updateMetadata: false });
  } catch (e) {
    throw new Error('PDF 解析失败：' + ((e && e.message) || e));
  }
}

export async function pdfInfo(file) {
  const doc = await loadPdfDoc(file);
  const pages = doc.getPages().map((p) => {
    const box = p.getMediaBox();
    return { width: box.width, height: box.height, rotation: (p.getRotation() && p.getRotation().angle) || 0 };
  });
  return {
    pageCount: doc.getPageCount(),
    pages,
    metadata: readMetadata(doc),
    encrypted: false,
  };
}

function readMetadata(doc) {
  const safe = (fn, d = '') => {
    try {
      const v = fn();
      return v == null ? d : String(v);
    } catch (_) {
      return d;
    }
  };
  return {
    title: safe(() => doc.getTitle()),
    author: safe(() => doc.getAuthor()),
    subject: safe(() => doc.getSubject()),
    keywords: safe(() => doc.getKeywords()),
    creator: safe(() => doc.getCreator()),
    producer: safe(() => doc.getProducer()),
  };
}

function fileOut(name, bytes) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  return { name, blob, size: blob.size };
}

function flatten(groups, max) {
  if (!groups.length) return Array.from({ length: max }, (_, i) => i + 1);
  const set = new Set();
  for (const g of groups) for (const p of g) set.add(p);
  return Array.from(set).sort((a, b) => a - b);
}

/* ---------- 页面整理（可视化编辑器的提交入口） ---------- */
/**
 * plan: [{ src: 0基于页索引, rotate: 角度增量 }, { blank: true, width, height }]
 * 可选 plan 中条目 src 可重复，用于复制页面。
 */
export async function applyPagePlan(file, plan, hooks = {}) {
  const { PDFDocument, degrees } = await ensurePdfLib();
  const src = await loadPdfDoc(file);
  const max = src.getPageCount();
  const out = await PDFDocument.create();
  for (let i = 0; i < plan.length; i++) {
    assertActive(hooks);
    stage(hooks, `生成第 ${i + 1}/${plan.length} 页`);
    progress(hooks, (i + 1) / plan.length);
    const item = plan[i];
    if (item && item.blank) {
      out.addPage([num(item.width, A4.w) || A4.w, num(item.height, A4.h) || A4.h]);
      continue;
    }
    const idx = Math.max(0, Math.min(max - 1, Number(item.src) || 0));
    const [copied] = await out.copyPages(src, [idx]);
    if (item.rotate) {
      const base = (copied.getRotation() && copied.getRotation().angle) || 0;
      copied.setRotation(degrees(((base + Number(item.rotate)) % 360 + 360) % 360));
    }
    out.addPage(copied);
  }
  const bytes = await out.save();
  return [fileOut(baseName(file.name) + '-页面整理.pdf', bytes)];
}

/* ---------- 删除 / 提取 ---------- */
export async function deletePdfPages(file, params = {}, hooks = {}) {
  const { PDFDocument } = await ensurePdfLib();
  const doc = await loadPdfDoc(file);
  const max = doc.getPageCount();
  const groups = parseRangeGroups(params.range, max);
  if (!groups.length) throw new Error('请填写要删除的页码，例如 2,5-7');
  const remove = new Set(flatten(groups, max));
  if (remove.size >= max) throw new Error('不能删除全部页面');
  stage(hooks, '删除页面…');
  const keep = [];
  for (let i = 1; i <= max; i++) if (!remove.has(i)) keep.push(i - 1);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(doc, keep);
  copied.forEach((p) => out.addPage(p));
  const bytes = await out.save();
  return [fileOut(baseName(file.name) + '-已删除页面.pdf', bytes)];
}

export async function extractPdfPages(file, params = {}, hooks = {}) {
  const { PDFDocument } = await ensurePdfLib();
  const doc = await loadPdfDoc(file);
  const max = doc.getPageCount();
  let groups = parseRangeGroups(params.range, max);
  if (!groups.length) groups = [[1]];
  const mode = params.extractMode === 'separate' ? 'separate' : 'single';

  if (mode === 'single') {
    stage(hooks, '提取页面…');
    const out = await PDFDocument.create();
    const indices = [];
    for (const g of groups) for (const p of g) indices.push(p - 1);
    const copied = await out.copyPages(doc, indices);
    copied.forEach((p) => out.addPage(p));
    const bytes = await out.save();
    progress(hooks, 1);
    return [fileOut(`${baseName(file.name)}-提取${indices.length}页.pdf`, bytes)];
  }

  const outputs = [];
  for (let i = 0; i < groups.length; i++) {
    assertActive(hooks);
    stage(hooks, `提取第 ${i + 1}/${groups.length} 组`);
    progress(hooks, (i + 1) / groups.length);
    const out = await PDFDocument.create();
    const copied = await out.copyPages(doc, groups[i].map((n) => n - 1));
    copied.forEach((p) => out.addPage(p));
    const bytes = await out.save();
    const g = groups[i];
    outputs.push(fileOut(`${baseName(file.name)}-p${g[0]}${g.length > 1 ? '-' + g[g.length - 1] : ''}.pdf`, bytes));
  }
  if (outputs.length === 1) return outputs;
  const zip = await makeZip(outputs);
  return [{ name: `${baseName(file.name)}-提取${outputs.length}份.zip`, blob: zip, size: zip.size }];
}

/* ---------- N-up 多页拼版 ---------- */
function gridFor(n, orientation) {
  if (n === 2) return { cols: orientation === 'portrait' ? 1 : 2, rows: orientation === 'portrait' ? 2 : 1 };
  if (n === 4) return { cols: 2, rows: 2 };
  if (n === 6) return { cols: 2, rows: 3 };
  if (n === 9) return { cols: 3, rows: 3 };
  return { cols: 2, rows: 2 };
}

async function sheetSize(n, orientation) {
  const landscape = orientation === 'landscape' || (orientation === 'auto' && n === 2);
  return landscape ? { w: A4.h, h: A4.w } : { w: A4.w, h: A4.h };
}

export async function nupPdf(file, params = {}, hooks = {}) {
  const { PDFDocument } = await ensurePdfLib();
  const src = await loadPdfDoc(file);
  const out = await PDFDocument.create();
  const n = [2, 4, 6, 9].includes(Number(params.nupGrid)) ? Number(params.nupGrid) : 4;
  const orientation = ['auto', 'portrait', 'landscape'].includes(params.nupOrientation) ? params.nupOrientation : 'auto';
  const margin = Math.max(0, Math.min(72, num(params.nupMargin, 18)));
  const gap = Math.max(0, Math.min(36, num(params.nupGap, 8)));
  const { w: sheetW, h: sheetH } = await sheetSize(n, orientation);
  const { cols, rows } = gridFor(n, orientation);
  const cellW = (sheetW - margin * 2 - gap * (cols - 1)) / cols;
  const cellH = (sheetH - margin * 2 - gap * (rows - 1)) / rows;
  const total = src.getPageCount();
  const sheets = Math.ceil(total / n);
  const embeddedCache = new Map();

  for (let s = 0; s < sheets; s++) {
    assertActive(hooks);
    stage(hooks, `拼版第 ${s + 1}/${sheets} 页`);
    progress(hooks, (s + 1) / sheets);
    const page = out.addPage([sheetW, sheetH]);
    for (let k = 0; k < n; k++) {
      const idx = s * n + k;
      if (idx >= total) break;
      const col = k % cols;
      const row = Math.floor(k / cols);
      let embedded = embeddedCache.get(idx);
      if (!embedded) {
        embedded = await out.embedPage(src.getPage(idx));
        embeddedCache.set(idx, embedded);
      }
      const ratio = Math.min(cellW / embedded.width, cellH / embedded.height);
      const drawW = embedded.width * ratio;
      const drawH = embedded.height * ratio;
      const x = margin + col * (cellW + gap) + (cellW - drawW) / 2;
      const y = sheetH - margin - (row + 1) * cellH - row * gap + (cellH - drawH) / 2;
      page.drawPage(embedded, { x, y, width: drawW, height: drawH });
    }
  }
  const bytes = await out.save();
  return [fileOut(`${baseName(file.name)}-${n}合1.pdf`, bytes)];
}

/* ---------- 小册子（2 页一张，骑马订顺序） ---------- */
export async function bookletPdf(file, params = {}, hooks = {}) {
  const { PDFDocument } = await ensurePdfLib();
  const src = await loadPdfDoc(file);
  const out = await PDFDocument.create();
  const total = src.getPageCount();
  const padded = Math.max(4, Math.ceil(total / 4) * 4);
  const sheets = padded / 4;
  const sheet = { w: A4.h, h: A4.w };
  const margin = Math.max(0, Math.min(48, num(params.nupMargin, 12)));
  const gap = 6;
  const cellW = (sheet.w - margin * 2 - gap) / 2;
  const cellH = sheet.h - margin * 2;
  const cache = new Map();

  const embed = async (pageNo) => {
    if (pageNo < 0 || pageNo >= total) return null;
    let e = cache.get(pageNo);
    if (!e) {
      e = await out.embedPage(src.getPage(pageNo));
      cache.set(pageNo, e);
    }
    return e;
  };

  const drawPair = async (leftNo, rightNo) => {
    const page = out.addPage([sheet.w, sheet.h]);
    for (const [i, pageNo] of [[0, leftNo], [1, rightNo]]) {
      const e = await embed(pageNo);
      if (!e) continue;
      const ratio = Math.min(cellW / e.width, cellH / e.height);
      const drawW = e.width * ratio;
      const drawH = e.height * ratio;
      const x = margin + i * (cellW + gap) + (cellW - drawW) / 2;
      const y = margin + (cellH - drawH) / 2;
      page.drawPage(e, { x, y, width: drawW, height: drawH });
    }
    return page;
  };

  for (let s = 0; s < sheets; s++) {
    assertActive(hooks);
    stage(hooks, `生成小册子第 ${s + 1}/${sheets} 张`);
    progress(hooks, (s + 1) / sheets);
    await drawPair(padded - 1 - 2 * s, 2 * s);
    await drawPair(2 * s + 1, padded - 2 - 2 * s);
  }
  const bytes = await out.save();
  return [fileOut(`${baseName(file.name)}-小册子.pdf`, bytes)];
}

/* ---------- 统一页面尺寸 ---------- */
export async function resizePdf(file, params = {}, hooks = {}) {
  const doc = await loadPdfDoc(file);
  const paper = PAPER[params.pageSizeTarget] || A4;
  const mode = params.pageSizeOrientation || 'auto';
  const pages = doc.getPages();
  for (let i = 0; i < pages.length; i++) {
    assertActive(hooks);
    stage(hooks, `缩放页面 ${i + 1}/${pages.length}`);
    progress(hooks, (i + 1) / pages.length);
    const page = pages[i];
    const box = page.getMediaBox();
    const oldW = box.width;
    const oldH = box.height;
    let w = paper.w;
    let h = paper.h;
    if (mode === 'auto' ? oldW > oldH : mode === 'landscape') {
      w = paper.h;
      h = paper.w;
    }
    const fx = w / oldW;
    const fy = h / oldH;
    if (typeof page.scaleContent === 'function') page.scaleContent(fx, fy);
    else if (typeof page.scale === 'function') page.scale(fx, fy);
    page.setSize(w, h);
  }
  const bytes = await doc.save();
  return [fileOut(`${baseName(file.name)}-统一尺寸.pdf`, bytes)];
}

/* ---------- 裁剪 ---------- */
export async function cropPdf(file, params = {}, hooks = {}) {
  const doc = await loadPdfDoc(file);
  const top = Math.max(0, num(params.cropTop, 0));
  const right = Math.max(0, num(params.cropRight, 0));
  const bottom = Math.max(0, num(params.cropBottom, 0));
  const left = Math.max(0, num(params.cropLeft, 0));
  const pages = doc.getPages();
  for (let i = 0; i < pages.length; i++) {
    assertActive(hooks);
    stage(hooks, `裁剪页面 ${i + 1}/${pages.length}`);
    progress(hooks, (i + 1) / pages.length);
    const page = pages[i];
    const box = page.getMediaBox();
    const w = box.width - left - right;
    const h = box.height - top - bottom;
    if (w <= 0 || h <= 0) throw new Error('裁剪尺寸大于页面本身');
    page.setCropBox(box.x + left, box.y + bottom, w, h);
  }
  const bytes = await doc.save();
  return [fileOut(`${baseName(file.name)}-裁剪.pdf`, bytes)];
}

/* ---------- 文本绘制（中文自动转图片，避免标准字体乱码） ---------- */
function hasCJK(text) {
  return /[^\u0000-\u00ff]/.test(text || '');
}

function makeTextCanvas(text, { fontSize = 14, color = '#111827', padding = 6 } = {}) {
  const scale = 3;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = `${fontSize * scale}px "Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif`;
  ctx.font = font;
  const w = Math.max(1, Math.ceil(ctx.measureText(text).width + padding * 2 * scale));
  const h = Math.ceil(fontSize * 1.5 * scale + padding * 2 * scale);
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d');
  c.font = font;
  c.fillStyle = color;
  c.textBaseline = 'middle';
  c.fillText(text, padding * scale, h / 2);
  return canvas;
}

async function drawTextLine(page, text, opts = {}) {
  const { x = 0, y = 0, size = 10, color = '#111827', align = 'left', opacity = 1, rotate = 0 } = opts;
  if (!text) return;
  if (hasCJK(text)) {
    const canvas = makeTextCanvas(text, { fontSize: size, color });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const img = await page.doc.embedPng(await blob.arrayBuffer());
    const w = img.width / 3;
    const h = img.height / 3;
    let dx = x;
    if (align === 'center') dx = x - w / 2;
    else if (align === 'right') dx = x - w;
    page.drawImage(img, { x: dx, y: y - h / 2, width: w, height: h, opacity, rotate: rotate ? degreesOf(rotate) : undefined });
    return;
  }
  const { PDFDocument: _PD, StandardFonts, rgb } = await ensurePdfLib();
  const doc = page.doc;
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const c = hexToRgb(color);
  const width = font.widthOfTextAtSize(text, size);
  let dx = x;
  if (align === 'center') dx = x - width / 2;
  else if (align === 'right') dx = x - width;
  page.drawText(text, { x: dx, y: y - size * 0.35, size, font, color: rgb(c[0], c[1], c[2]), opacity });
}

function degreesOf(angle) {
  return { angle: Number(angle) || 0, type: 'degrees' };
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || '#111827'));
  if (!m) return [0.1, 0.1, 0.1];
  return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
}

/* ---------- 水印 ---------- */
export async function watermarkPdf(file, params = {}, hooks = {}) {
  const PDFLib = await ensurePdfLib();
  const doc = await loadPdfDoc(file);
  const text = String(params.wmText || '空天文件转换').slice(0, 80);
  const fontSize = Math.max(8, Math.min(200, num(params.wmSize, 48)));
  const opacity = Math.max(0.05, Math.min(1, num(params.wmOpacity, 0.22)));
  const color = params.wmColor || '#d11a2a';
  // 先把文字渲染为透明 PNG，支持中文并复用
  const canvas = makeTextCanvas(text, { fontSize, color });
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const pngBytes = await blob.arrayBuffer();
  const img = await doc.embedPng(pngBytes);
  const w0 = img.width / 3;
  const h0 = img.height / 3;
  const angle = num(params.wmRotation, -30);
  const theta = (angle * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const pages = doc.getPages();
  const mode = params.wmMode || 'center';
  for (let i = 0; i < pages.length; i++) {
    assertActive(hooks);
    stage(hooks, `加水印 ${i + 1}/${pages.length}`);
    progress(hooks, (i + 1) / pages.length);
    const page = pages[i];
    const box = page.getMediaBox();
    const scale = Math.min(1, (box.width * 0.78) / w0, (box.height * 0.5) / h0);
    const w = w0 * scale;
    const h = h0 * scale;
    const positions = mode === 'tile'
      ? [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75], [0.5, 0.5]]
      : [[0.5, 0.5]];
    for (const [px, py] of positions) {
      const cx = box.x + box.width * px;
      const cy = box.y + box.height * py;
      const x = cx - (w / 2) * cos + (h / 2) * sin;
      const y = cy - (w / 2) * sin - (h / 2) * cos;
      page.drawImage(img, { x, y, width: w, height: h, opacity, rotate: PDFLib.degrees(angle) });
    }
  }
  const bytes = await doc.save();
  return [fileOut(`${baseName(file.name)}-水印.pdf`, bytes)];
}

/* ---------- 页码 ---------- */
export async function pageNumbersPdf(file, params = {}, hooks = {}) {
  const doc = await loadPdfDoc(file);
  const position = params.pnPosition || 'bottom-center';
  const size = Math.max(6, Math.min(24, num(params.pnSize, 10)));
  const start = num(params.pnStart, 1);
  const color = params.pnColor || '#334155';
  const fmt = params.pnFormat || 'n';
  const total = doc.getPageCount();
  const pages = doc.getPages();
  for (let i = 0; i < pages.length; i++) {
    assertActive(hooks);
    stage(hooks, `添加页码 ${i + 1}/${pages.length}`);
    progress(hooks, (i + 1) / pages.length);
    const page = pages[i];
    const box = page.getMediaBox();
    const n = start + i;
    const text = fmt === 'n-total' ? `${n} / ${start + total - 1}` : fmt === 'cn' ? `第 ${n} 页` : String(n);
    const [vpos, hpos = 'center'] = position.split('-');
    const margin = 18;
    const x = hpos === 'left' ? box.x + margin : hpos === 'right' ? box.x + box.width - margin : box.x + box.width / 2;
    const y = vpos === 'top' ? box.y + box.height - margin : box.y + margin;
    await drawTextLine(page, text, { x, y, size, color, align: hpos === 'left' ? 'left' : hpos === 'right' ? 'right' : 'center' });
  }
  const bytes = await doc.save();
  return [fileOut(`${baseName(file.name)}-页码.pdf`, bytes)];
}

/* ---------- 页眉页脚 ---------- */
export async function headerFooterPdf(file, params = {}, hooks = {}) {
  const doc = await loadPdfDoc(file);
  const size = Math.max(6, Math.min(20, num(params.hfSize, 9)));
  const color = params.hfColor || '#64748b';
  const header = String(params.hfHeader || '').trim();
  const footer = String(params.hfFooter || '').trim();
  if (!header && !footer) throw new Error('请至少填写页眉或页脚文字');
  const pages = doc.getPages();
  for (let i = 0; i < pages.length; i++) {
    assertActive(hooks);
    stage(hooks, `添加页眉页脚 ${i + 1}/${pages.length}`);
    progress(hooks, (i + 1) / pages.length);
    const page = pages[i];
    const box = page.getMediaBox();
    const margin = 18;
    if (header) await drawTextLine(page, header, { x: box.x + box.width / 2, y: box.y + box.height - margin, size, color, align: 'center' });
    if (footer) await drawTextLine(page, footer, { x: box.x + box.width / 2, y: box.y + margin, size, color, align: 'center' });
  }
  const bytes = await doc.save();
  return [fileOut(`${baseName(file.name)}-页眉页脚.pdf`, bytes)];
}

/* ---------- Bates 编号 ---------- */
export async function batesPdf(file, params = {}, hooks = {}) {
  const doc = await loadPdfDoc(file);
  const prefix = String(params.batesPrefix || 'KT');
  const start = Math.max(0, num(params.batesStart, 1));
  const digits = Math.max(2, Math.min(10, num(params.batesDigits, 6)));
  const size = Math.max(6, Math.min(20, num(params.batesSize, 9)));
  const pages = doc.getPages();
  for (let i = 0; i < pages.length; i++) {
    assertActive(hooks);
    stage(hooks, `编号 ${i + 1}/${pages.length}`);
    progress(hooks, (i + 1) / pages.length);
    const page = pages[i];
    const box = page.getMediaBox();
    const text = `${prefix}${String(start + i).padStart(digits, '0')}`;
    await drawTextLine(page, text, { x: box.x + box.width - 18, y: box.y + 18, size, color: '#334155', align: 'right' });
  }
  const bytes = await doc.save();
  return [fileOut(`${baseName(file.name)}-Bates.pdf`, bytes)];
}

/* ---------- 遮盖（涂黑） ---------- */
export async function redactPdf(file, params = {}, hooks = {}) {
  const { rgb } = await ensurePdfLib();
  const doc = await loadPdfDoc(file);
  const spec = String(params.redactRects || '').trim();
  if (!spec) throw new Error('请填写遮盖区域，格式如 1:40,60,300,80（页码:x,y,w,h，单位 pt，左上角为原点）');
  const items = [];
  for (const line of spec.split(/[;\n]/)) {
    const m = /^\s*(\d+)\s*[:：]\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*$/.exec(line);
    if (!m) continue;
    items.push({ page: Number(m[1]), x: Number(m[2]), y: Number(m[3]), w: Number(m[4]), h: Number(m[5]) });
  }
  if (!items.length) throw new Error('没有识别到有效的遮盖区域');
  const c = hexToRgb(params.redactColor || '#000000');
  const pages = doc.getPages();
  const total = pages.length;
  for (let i = 0; i < total; i++) {
    assertActive(hooks);
    stage(hooks, `遮盖第 ${i + 1}/${total} 页`);
    progress(hooks, (i + 1) / total);
    const page = pages[i];
    const box = page.getMediaBox();
    for (const it of items) {
      if (it.page !== i + 1) continue;
      if (it.x > box.width || it.y > box.height) continue;
      const w = Math.min(it.w, box.width - it.x);
      const h = Math.min(it.h, box.height - it.y);
      if (w <= 0 || h <= 0) continue;
      page.drawRectangle({ x: box.x + it.x, y: box.y + box.height - it.y - h, width: w, height: h, color: rgb(c[0], c[1], c[2]) });
    }
  }
  const bytes = await doc.save();
  return [fileOut(`${baseName(file.name)}-遮盖.pdf`, bytes)];
}

/* ---------- 元数据 ---------- */
export async function editMetadataPdf(file, params = {}, hooks = {}) {
  const doc = await loadPdfDoc(file);
  stage(hooks, '写入元数据…');
  const map = {
    title: params.metaTitle,
    author: params.metaAuthor,
    subject: params.metaSubject,
    keywords: params.metaKeywords,
    creator: params.metaCreator,
  };
  const setters = {
    title: (v) => doc.setTitle(v),
    author: (v) => doc.setAuthor(v),
    subject: (v) => doc.setSubject(v),
    keywords: (v) => doc.setKeywords(String(v).split(/[,;，；]/).map((s) => s.trim()).filter(Boolean)),
    creator: (v) => doc.setCreator(v),
  };
  for (const [k, v] of Object.entries(map)) {
    if (v === undefined || v === null) continue;
    try { setters[k](String(v)); } catch (_) {}
  }
  const bytes = await doc.save();
  progress(hooks, 1);
  return [{ ...fileOut(`${baseName(file.name)}-元数据.pdf`, bytes), extra: 1 }];
}

export async function clearMetadataPdf(file, params = {}, hooks = {}) {
  const doc = await loadPdfDoc(file);
  stage(hooks, '清除元数据…');
  try {
    doc.setTitle('');
    doc.setAuthor('');
    doc.setSubject('');
    doc.setKeywords([]);
    doc.setCreator('');
    doc.setProducer('');
  } catch (_) {}
  const bytes = await doc.save();
  progress(hooks, 1);
  return [fileOut(`${baseName(file.name)}-无元数据.pdf`, bytes)];
}

/* ---------- 清理（元数据 + 注释 + 脚本动作） ---------- */
export async function sanitizePdf(file, params = {}, hooks = {}) {
  const { PDFName } = await ensurePdfLib();
  const doc = await loadPdfDoc(file);
  try {
    doc.setTitle('');
    doc.setAuthor('');
    doc.setSubject('');
    doc.setKeywords([]);
    doc.setCreator('');
    doc.setProducer('');
  } catch (_) {}
  const pages = doc.getPages();
  for (let i = 0; i < pages.length; i++) {
    assertActive(hooks);
    stage(hooks, `清理第 ${i + 1}/${pages.length} 页`);
    progress(hooks, (i + 1) / pages.length);
    try { pages[i].node.delete(PDFName.of('Annots')); } catch (_) {}
    try { pages[i].node.delete(PDFName.of('AA')); } catch (_) {}
  }
  try {
    doc.catalog.delete(PDFName.of('OpenAction'));
    doc.catalog.delete(PDFName.of('AA'));
    doc.catalog.delete(PDFName.of('Metadata'));
  } catch (_) {}
  const bytes = await doc.save();
  return [fileOut(`${baseName(file.name)}-已清理.pdf`, bytes)];
}

/* ---------- 文本抽取（HTML） ---------- */
export async function pdfToHtml(file, params = {}, hooks = {}) {
  const pdfjs = await ensurePdfJs();
  const data = new Uint8Array(await readAsArrayBuffer(file));
  let pdf;
  try {
    pdf = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  } catch (e) {
    throw new Error('PDF 解析失败：' + ((e && e.message) || e));
  }
  try {
    const max = pdf.numPages;
    const pages = flatten(parseRangeGroups(params.range, max), max);
    const sections = [];
    for (let i = 0; i < pages.length; i++) {
      assertActive(hooks);
      const n = pages[i];
      stage(hooks, `提取文本 ${i + 1}/${pages.length} 页`);
      progress(hooks, (i + 1) / pages.length);
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      let html = '';
      let lastY = null;
      for (const item of content.items) {
        if (!item.str) continue;
        const y = item.transform ? item.transform[5] : null;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 2.5) html += '</p><p>';
        else if (html && !html.endsWith(' ') && !html.endsWith('>')) html += ' ';
        html += escapeHtml(item.str);
        if (y !== null) lastY = y;
      }
      page.cleanup();
      sections.push(`<section class="pdf-page"><h2>第 ${n} 页</h2><p>${html || '（本页没有可提取文本）'}</p></section>`);
    }
    const title = escapeHtml(baseName(file.name));
    const doc = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>${title}</title>
<style>
body{margin:0;background:#f6f8fb;color:#1f2937;font:15px/1.8 "Microsoft YaHei","PingFang SC",system-ui,sans-serif}
main{max-width:860px;margin:0 auto;padding:32px 20px}
h1{font-size:20px;margin:0 0 22px}
.pdf-page{background:#fff;border-radius:12px;padding:22px 26px;margin:0 0 18px;box-shadow:0 2px 10px rgba(15,40,80,.06)}
.pdf-page h2{font-size:12px;color:#94a3b8;font-weight:500;margin:0 0 10px;letter-spacing:.08em}
.pdf-page p{white-space:pre-wrap;word-break:break-word;margin:0}
</style></head><body><main><h1>${title}</h1>${sections.join('\n')}</main></body></html>`;
    const blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
    return [{ name: baseName(file.name) + '.html', blob, size: blob.size }];
  } finally {
    try { await pdf.destroy(); } catch (_) {}
  }
}

/* ---------- 页面缩略图（供可视化页面管理器） ---------- */
export async function openPdfForPreview(file) {
  const pdfjs = await ensurePdfJs();
  const data = new Uint8Array(await readAsArrayBuffer(file));
  const pdf = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  return pdf;
}

export async function renderThumb(pdf, pageNo, width = 150) {
  const page = await pdf.getPage(pageNo);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(2, Math.max(0.2, width / base.width));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  page.cleanup();
  return canvas;
}

/* ---------- 逐页渲染（BMP / TIFF / CBZ 共用） ---------- */
async function renderPageCanvas(pdf, pageNo, dpi) {
  const page = await pdf.getPage(pageNo);
  const scale = Math.max(0.5, Math.min(5, (Number(dpi) || 144) / 72));
  const viewport = page.getViewport({ scale });
  if (viewport.width > 16384 || viewport.height > 16384) throw new Error('页面渲染尺寸过大，请降低 DPI');
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  page.cleanup();
  return canvas;
}

function canvasToBmp(canvas) {
  const w = canvas.width;
  const h = canvas.height;
  const rowSize = Math.floor((w * 3 + 3) / 4) * 4;
  const dataSize = rowSize * h;
  const buf = new ArrayBuffer(54 + dataSize);
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  u8[0] = 0x42; u8[1] = 0x4d;
  dv.setUint32(2, 54 + dataSize, true);
  dv.setUint32(10, 54, true);
  dv.setUint32(14, 40, true);
  dv.setInt32(18, w, true);
  dv.setInt32(22, h, true);
  dv.setUint16(26, 1, true);
  dv.setUint16(28, 24, true);
  dv.setUint32(34, dataSize, true);
  dv.setUint32(38, 2835, true);
  dv.setUint32(42, 2835, true);
  const px = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  for (let y = 0; y < h; y++) {
    const sy = h - 1 - y;
    let off = 54 + y * rowSize;
    for (let x = 0; x < w; x++) {
      const i = (sy * w + x) * 4;
      u8[off++] = px[i + 2];
      u8[off++] = px[i + 1];
      u8[off++] = px[i];
    }
  }
  return new Blob([buf], { type: 'image/bmp' });
}

function canvasesToTiff(canvases) {
  const pages = canvases.map((c) => ({
    w: c.width,
    h: c.height,
    data: c.getContext('2d').getImageData(0, 0, c.width, c.height).data,
  }));
  const entryCount = 12;
  const ifdSize = 2 + entryCount * 12 + 4;
  const extraSize = 6 + 8 + 8; // BitsPerSample + XResolution + YResolution
  const blockSize = ifdSize + extraSize;
  let offset = 8;
  const layouts = pages.map((p) => {
    const ifdOffset = offset;
    offset += blockSize;
    const dataOffset = offset;
    offset += p.w * p.h * 3;
    return { ifdOffset, dataOffset };
  });
  const buf = new ArrayBuffer(offset);
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  u8[0] = 0x49; u8[1] = 0x49;
  dv.setUint16(2, 42, true);
  dv.setUint32(4, 8, true);
  pages.forEach((p, i) => {
    const L = layouts[i];
    let o = L.ifdOffset;
    dv.setUint16(o, entryCount, true);
    o += 2;
    const entry = (tag, type, count, value) => {
      dv.setUint16(o, tag, true);
      dv.setUint16(o + 2, type, true);
      dv.setUint32(o + 4, count, true);
      if (type === 3 && count === 1) {
        dv.setUint16(o + 8, value, true);
        dv.setUint16(o + 10, 0, true);
      } else {
        dv.setUint32(o + 8, value, true);
      }
      o += 12;
    };
    const bitsOff = L.ifdOffset + ifdSize;
    const xresOff = bitsOff + 6;
    const yresOff = xresOff + 8;
    entry(256, 4, 1, p.w);
    entry(257, 4, 1, p.h);
    entry(258, 3, 3, bitsOff);
    entry(259, 3, 1, 1);
    entry(262, 3, 1, 2);
    entry(273, 4, 1, L.dataOffset);
    entry(277, 3, 1, 3);
    entry(278, 4, 1, p.h);
    entry(279, 4, 1, p.w * p.h * 3);
    entry(282, 5, 1, xresOff);
    entry(283, 5, 1, yresOff);
    entry(284, 3, 1, 1);
    dv.setUint32(o, i + 1 < pages.length ? layouts[i + 1].ifdOffset : 0, true);
    dv.setUint16(bitsOff, 8, true);
    dv.setUint16(bitsOff + 2, 8, true);
    dv.setUint16(bitsOff + 4, 8, true);
    dv.setUint32(xresOff, 72, true);
    dv.setUint32(xresOff + 4, 1, true);
    dv.setUint32(yresOff, 72, true);
    dv.setUint32(yresOff + 4, 1, true);
    let d = L.dataOffset;
    const px = p.data;
    for (let k = 0; k < px.length; k += 4) {
      u8[d++] = px[k];
      u8[d++] = px[k + 1];
      u8[d++] = px[k + 2];
    }
  });
  return new Blob([buf], { type: 'image/tiff' });
}

export async function pdfToBmp(file, params = {}, hooks = {}) {
  const pdf = await openPdfForPreview(file);
  try {
    const pages = flatten(parseRangeGroups(params.range, pdf.numPages), pdf.numPages);
    const outputs = [];
    for (let i = 0; i < pages.length; i++) {
      assertActive(hooks);
      stage(hooks, `渲染第 ${pages[i]} 页（${i + 1}/${pages.length}）`);
      progress(hooks, (i + 1) / pages.length);
      const canvas = await renderPageCanvas(pdf, pages[i], params.dpi);
      const blob = canvasToBmp(canvas);
      outputs.push({ name: `${baseName(file.name)}-p${String(pages[i]).padStart(3, '0')}.bmp`, blob, size: blob.size });
    }
    if (outputs.length === 1) return outputs;
    const zip = await makeZip(outputs);
    return [{ name: `${baseName(file.name)}-bmp-${outputs.length}页.zip`, blob: zip, size: zip.size, extra: outputs.length }];
  } finally {
    try { await pdf.destroy(); } catch (_) {}
  }
}

export async function pdfToTiff(file, params = {}, hooks = {}) {
  const pdf = await openPdfForPreview(file);
  try {
    const pages = flatten(parseRangeGroups(params.range, pdf.numPages), pdf.numPages);
    const canvases = [];
    for (let i = 0; i < pages.length; i++) {
      assertActive(hooks);
      stage(hooks, `渲染第 ${pages[i]} 页（${i + 1}/${pages.length}）`);
      progress(hooks, (i + 1) / pages.length);
      canvases.push(await renderPageCanvas(pdf, pages[i], params.dpi));
    }
    const blob = canvasesToTiff(canvases);
    return [{ name: `${baseName(file.name)}-${canvases.length}页.tiff`, blob, size: blob.size, extra: canvases.length }];
  } finally {
    try { await pdf.destroy(); } catch (_) {}
  }
}

export async function pdfToCbz(file, params = {}, hooks = {}) {
  const pdf = await openPdfForPreview(file);
  try {
    const pages = flatten(parseRangeGroups(params.range, pdf.numPages), pdf.numPages);
    const quality = Math.max(0.4, Math.min(1, (Number(params.quality) || 90) / 100));
    const parts = [];
    for (let i = 0; i < pages.length; i++) {
      assertActive(hooks);
      stage(hooks, `渲染第 ${pages[i]} 页（${i + 1}/${pages.length}）`);
      progress(hooks, (i + 1) / pages.length);
      const canvas = await renderPageCanvas(pdf, pages[i], params.dpi);
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('页面编码失败'))), 'image/jpeg', quality);
      });
      parts.push({ name: `page-${String(i + 1).padStart(3, '0')}.jpg`, blob });
    }
    const zip = await makeZip(parts);
    return [{ name: `${baseName(file.name)}.cbz`, blob: zip, size: zip.size, extra: parts.length }];
  } finally {
    try { await pdf.destroy(); } catch (_) {}
  }
}

export async function pdfToJson(file, params = {}, hooks = {}) {
  const pdf = await openPdfForPreview(file);
  try {
    const doc = await loadPdfDoc(file);
    const meta = readMetadata(doc);
    const pages = flatten(parseRangeGroups(params.range, pdf.numPages), pdf.numPages);
    const out = { file: file.name, pageCount: pdf.numPages, metadata: meta, pages: [] };
    for (let i = 0; i < pages.length; i++) {
      assertActive(hooks);
      stage(hooks, `提取第 ${pages[i]} 页（${i + 1}/${pages.length}）`);
      progress(hooks, (i + 1) / pages.length);
      const page = await pdf.getPage(pages[i]);
      const content = await page.getTextContent();
      const text = content.items.map((it) => it.str || '').join(' ').replace(/\s+/g, ' ').trim();
      const vp = page.getViewport({ scale: 1 });
      out.pages.push({ page: pages[i], width: Math.round(vp.width * 10) / 10, height: Math.round(vp.height * 10) / 10, text });
      page.cleanup();
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    return [{ name: baseName(file.name) + '.json', blob, size: blob.size }];
  } finally {
    try { await pdf.destroy(); } catch (_) {}
  }
}

/* ---------- 文本 / Markdown / HTML -> PDF（Canvas 排版） ---------- */
function htmlToPlain(src) {
  const cleaned = String(src)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<li[\s\S]*?>/gi, '\n• ')
    .replace(/<[^>]+>/g, '');
  const el = document.createElement('div');
  el.innerHTML = cleaned;
  return el.textContent.replace(/\n{3,}/g, '\n\n').trim();
}

function mdToPlain(src) {
  return String(src)
    .replace(/\r\n?/g, '\n')
    .replace(/^```[\s\S]*?```$/gm, (m) => m.replace(/```[a-z]*\n?/gi, '').replace(/```/g, ''))
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/^>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/^\s*(\d+)\.\s+/gm, '$1. ')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

function wrapLines(ctx, text, maxWidth) {
  const lines = [];
  for (const raw of String(text).split('\n')) {
    if (!raw.trim()) { lines.push(''); continue; }
    let line = '';
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      const next = line + ch;
      if (ctx.measureText(next).width > maxWidth && line) {
        const cut = Math.max(line.lastIndexOf(' '), line.lastIndexOf('　'));
        if (cut > line.length * 0.45) {
          lines.push(line.slice(0, cut).trimEnd());
          line = line.slice(cut + 1) + ch;
        } else {
          lines.push(line);
          line = ch;
        }
      } else {
        line = next;
      }
    }
    if (line) lines.push(line.trimEnd());
  }
  return lines;
}

export async function textToPdf(blob, params = {}, hooks = {}, name = 'document.txt', ext = 'txt') {
  const raw = await blob.text();
  let text;
  if (ext === 'html' || ext === 'htm') text = htmlToPlain(raw);
  else if (ext === 'md' || ext === 'markdown') text = mdToPlain(raw);
  else text = raw.replace(/\r\n?/g, '\n');
  if (!text.trim()) text = '（空文档）';

  const { PDFDocument } = await ensurePdfLib();
  const dpi = 150;
  const scale = dpi / 72;
  const pageW = Math.round(595.28 * scale);
  const pageH = Math.round(841.89 * scale);
  const marginPt = Math.max(10, Math.min(40, Number(params.textPdfMargin) || 20));
  const margin = Math.round(marginPt * scale);
  const fontSize = Math.max(8, Math.min(20, Number(params.textPdfSize) || 12)) * scale;
  const lineHeight = fontSize * 1.75;
  const family = '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", system-ui, sans-serif';

  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d');
  mctx.font = `${fontSize}px ${family}`;
  const lines = wrapLines(mctx, text, pageW - margin * 2);
  const linesPerPage = Math.max(1, Math.floor((pageH - margin * 2) / lineHeight));
  const pageTotal = Math.ceil(lines.length / linesPerPage) || 1;

  const out = await PDFDocument.create();
  for (let p = 0; p < pageTotal; p++) {
    assertActive(hooks);
    stage(hooks, `排版第 ${p + 1}/${pageTotal} 页`);
    progress(hooks, (p + 1) / pageTotal);
    const canvas = document.createElement('canvas');
    canvas.width = pageW;
    canvas.height = pageH;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pageW, pageH);
    ctx.fillStyle = '#172033';
    ctx.font = `${fontSize}px ${family}`;
    ctx.textBaseline = 'top';
    const slice = lines.slice(p * linesPerPage, (p + 1) * linesPerPage);
    slice.forEach((line, i) => {
      ctx.fillText(line, margin, margin + i * lineHeight);
    });
    const png = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('页面编码失败'))), 'image/png');
    });
    const img = await out.embedPng(await png.arrayBuffer());
    const pdfPage = out.addPage([595.28, 841.89]);
    pdfPage.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
  }
  const bytes = await out.save();
  const outBlob = new Blob([bytes], { type: 'application/pdf' });
  return [{ name: baseName(name) + '.pdf', blob: outBlob, size: outBlob.size, extra: pageTotal }];
}

export async function comparePdfs(fileA, fileB, params = {}, hooks = {}) {
  const pdfA = await openPdfForPreview(fileA);
  const pdfB = await openPdfForPreview(fileB);
  try {
    const nA = pdfA.numPages;
    const nB = pdfB.numPages;
    const max = Math.max(nA, nB);
    const rows = [];
    for (let i = 1; i <= max; i++) {
      assertActive(hooks);
      stage(hooks, `比较第 ${i}/${max} 页`);
      progress(hooks, i / max);
      const a = i <= nA ? await renderThumb(pdfA, i, 520) : null;
      const b = i <= nB ? await renderThumb(pdfB, i, 520) : null;
      let diff = 1;
      if (a && b) {
        const w = Math.min(a.width, b.width, 600);
        const h = Math.min(a.height, b.height, 800);
        const ca = document.createElement('canvas');
        ca.width = w;
        ca.height = h;
        const cxa = ca.getContext('2d');
        cxa.drawImage(a, 0, 0, w, h);
        const da = cxa.getImageData(0, 0, w, h).data;
        const cb = document.createElement('canvas');
        cb.width = w;
        cb.height = h;
        const cxb = cb.getContext('2d');
        cxb.drawImage(b, 0, 0, w, h);
        const db = cxb.getImageData(0, 0, w, h).data;
        let changed = 0;
        const total = w * h;
        for (let p = 0; p < da.length; p += 4) {
          if (Math.abs(da[p] - db[p]) + Math.abs(da[p + 1] - db[p + 1]) + Math.abs(da[p + 2] - db[p + 2]) > 24) changed++;
        }
        diff = changed / total;
      }
      rows.push({
        page: i,
        state: !a ? '仅在 B 中存在' : !b ? '仅在 A 中存在' : diff > 0.002 ? '内容不同' : '基本一致',
        diff,
        a: a ? a.toDataURL('image/jpeg', 0.8) : '',
        b: b ? b.toDataURL('image/jpeg', 0.8) : '',
      });
    }
    const totalDiff = rows.filter((r) => r.state === '内容不同').length;
    const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>PDF 比较报告</title>
<style>
body{margin:0;background:#f2f5fa;color:#172033;font:14px/1.6 "Microsoft YaHei","PingFang SC",system-ui,sans-serif}
main{max-width:1100px;margin:0 auto;padding:28px 18px}
h1{font-size:20px;margin:0 0 6px}
.summary{color:#526079;margin:0 0 18px}
.row{background:#fff;border-radius:12px;padding:14px;margin-bottom:14px;box-shadow:0 2px 10px rgba(15,40,80,.06)}
.row-head{display:flex;gap:12px;align-items:center;margin-bottom:10px;flex-wrap:wrap}
.badge{border-radius:99px;padding:2px 10px;font-size:12px;background:#e8eefc;color:#2456d6}
.badge.warn{background:#fff3d6;color:#946200}
.badge.err{background:#ffe4e4;color:#b32626}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.pair figure{margin:0}
.pair img{width:100%;border:1px solid #dbe4f0;border-radius:8px;background:#fff}
.pair figcaption{font-size:12px;color:#7b8aa4;margin-bottom:6px}
@media(max-width:640px){.pair{grid-template-columns:1fr}}
</style></head><body><main>
<h1>A / B 文档比较报告</h1>
<p class="summary">A：${escapeHtml(fileA.name)}（${nA} 页） · B：${escapeHtml(fileB.name)}（${nB} 页） · 内容不同 ${totalDiff} 页</p>
${rows.map((r) => `<div class="row"><div class="row-head"><b>第 ${r.page} 页</b>
<span class="badge ${r.state === '基本一致' ? '' : r.state === '内容不同' ? 'warn' : 'err'}">${r.state}</span>
<span class="summary">差异像素 ${(r.diff * 100).toFixed(2)}%</span></div>
<div class="pair">
<figure><figcaption>A · 第 ${r.page} 页</figcaption>${r.a ? `<img src="${r.a}" alt="">` : '<p class="summary">该页不存在</p>'}</figure>
<figure><figcaption>B · 第 ${r.page} 页</figcaption>${r.b ? `<img src="${r.b}" alt="">` : '<p class="summary">该页不存在</p>'}</figure>
</div></div>`).join('')}
</main></body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    return [{ name: 'PDF比较报告.html', blob, size: blob.size }];
  } finally {
    try { await pdfA.destroy(); } catch (_) {}
    try { await pdfB.destroy(); } catch (_) {}
  }
}
