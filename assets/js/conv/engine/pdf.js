/* PDF：文本抽取、逐页渲染、拆分、合并、图片转 PDF */
import { baseName, extOf, loadVendor, makeZip, mimeForExt, readAsArrayBuffer, VENDOR } from './utils.js';
import { rasterize } from './image.js';

let pdfjsReady = null;
let pdfLibReady = null;

export async function ensurePdfJs() {
  if (!pdfjsReady) {
    pdfjsReady = (async () => {
      await loadVendor('pdfjs/pdf.min.js');
      if (!window.pdfjsLib) throw new Error('pdf.js 加载失败');
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs/pdf.worker.min.js', VENDOR).href;
      return window.pdfjsLib;
    })().catch((e) => {
      pdfjsReady = null;
      throw e;
    });
  }
  return pdfjsReady;
}

export async function ensurePdfLib() {
  if (!pdfLibReady) {
    pdfLibReady = (async () => {
      await loadVendor('pdf-lib/pdf-lib.min.js');
      if (!window.PDFLib) throw new Error('pdf-lib 加载失败');
      return window.PDFLib;
    })().catch((e) => {
      pdfLibReady = null;
      throw e;
    });
  }
  return pdfLibReady;
}

export function parseRangeGroups(str, max) {
  const s = (str || '').trim();
  if (!s) return [];
  const groups = [];
  for (const part of s.split(',')) {
    const p = part.trim();
    if (!p) continue;
    const m = /^(\d+)\s*[-~～]\s*(\d+)$/.exec(p);
    if (m) {
      let a = Number(m[1]);
      let b = Number(m[2]);
      if (a > b) [a, b] = [b, a];
      a = Math.max(1, a);
      b = Math.min(max, b);
      if (a <= b) {
        const arr = [];
        for (let i = a; i <= b; i++) arr.push(i);
        groups.push(arr);
      }
    } else {
      const n = Number(p);
      if (Number.isInteger(n) && n >= 1 && n <= max) groups.push([n]);
    }
  }
  return groups;
}

function flattenPages(groups, max) {
  if (!groups.length) return Array.from({ length: max }, (_, i) => i + 1);
  const set = new Set();
  for (const g of groups) for (const p of g) set.add(p);
  return Array.from(set).sort((a, b) => a - b);
}

async function loadPdf(file) {
  const pdfjs = await ensurePdfJs();
  const data = new Uint8Array(await readAsArrayBuffer(file));
  try {
    return await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  } catch (e) {
    if (e && /password/i.test(String(e.name || e.message))) {
      throw new Error('PDF 已加密，暂不支持处理加密文档');
    }
    throw new Error('PDF 解析失败：' + (e.message || e));
  }
}

/* ---------- 文本抽取 ---------- */
export async function pdfToText(file, params = {}, hooks = {}) {
  const pdf = await loadPdf(file);
  try {
    const pages = flattenPages(parseRangeGroups(params.range, pdf.numPages), pdf.numPages);
    let out = '';
    for (let idx = 0; idx < pages.length; idx++) {
      if (hooks.isCancelled && hooks.isCancelled()) throw new DOMException('已取消', 'AbortError');
      const pageNum = pages[idx];
      hooks.onStage && hooks.onStage(`提取文本 ${idx + 1}/${pages.length} 页`);
      hooks.onProgress && hooks.onProgress((idx + 1) / pages.length);
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      let pageText = '';
      let lastY = null;
      for (const item of content.items) {
        if (!item.str) continue;
        const y = item.transform ? item.transform[5] : null;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 2.5) pageText += '\n';
        else if (pageText && !pageText.endsWith('\n') && !pageText.endsWith(' ')) pageText += ' ';
        pageText += item.str;
        if (y !== null) lastY = y;
      }
      page.cleanup();
      out += (out ? '\n\n' : '') + pageText.trim();
    }
    if (!out.trim()) out = '（未检测到可提取文本，可能是扫描版 PDF）';
    const blob = new Blob([out], { type: mimeForExt('txt') });
    return [{ name: baseName(file.name) + '.txt', blob, size: blob.size }];
  } finally {
    try { await pdf.destroy(); } catch (_) {}
  }
}

/* ---------- 逐页渲染 ---------- */
export async function pdfToImages(file, target, params = {}, hooks = {}) {
  const pdf = await loadPdf(file);
  try {
    const pages = flattenPages(parseRangeGroups(params.range, pdf.numPages), pdf.numPages);
    const scale = (Number(params.dpi) || 144) / 72;
    const mime = target === 'jpg' ? 'image/jpeg' : target === 'webp' ? 'image/webp' : 'image/png';
    const quality = (Number(params.quality) || 90) / 100;
    const outputs = [];
    for (let idx = 0; idx < pages.length; idx++) {
      if (hooks.isCancelled && hooks.isCancelled()) throw new DOMException('已取消', 'AbortError');
      const pageNum = pages[idx];
      hooks.onStage && hooks.onStage(`渲染第 ${pageNum} 页（${idx + 1}/${pages.length}）`);
      hooks.onProgress && hooks.onProgress((idx + 1) / pages.length);
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      if (viewport.width > 16384 || viewport.height > 16384) throw new Error('页面渲染尺寸过大，请降低渲染精度');
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('页面编码失败'));
        }, mime, quality);
      });
      outputs.push({ name: `${baseName(file.name)}-p${String(pageNum).padStart(3, '0')}.${target}`, blob, size: blob.size });
      page.cleanup();
    }

    if (outputs.length === 1) return outputs;
    const zip = await makeZip(outputs);
    return [{
      name: `${baseName(file.name)}-images-${outputs.length}页.zip`,
      blob: zip,
      size: zip.size,
      extra: outputs.length,
    }];
  } finally {
    try { await pdf.destroy(); } catch (_) {}
  }
}

/* ---------- 拆分 ---------- */
export async function splitPdf(file, params = {}, hooks = {}) {
  const { PDFDocument } = await ensurePdfLib();
  const src = await PDFDocument.load(await readAsArrayBuffer(file), { ignoreEncryption: true });
  const max = src.getPageCount();
  let groups = parseRangeGroups(params.range, max);
  if (!groups.length) groups = Array.from({ length: max }, (_, i) => [i + 1]);

  const outputs = [];
  for (let idx = 0; idx < groups.length; idx++) {
    if (hooks.isCancelled && hooks.isCancelled()) throw new DOMException('已取消', 'AbortError');
    const group = groups[idx];
    hooks.onStage && hooks.onStage(`拆分 ${idx + 1}/${groups.length}`);
    hooks.onProgress && hooks.onProgress((idx + 1) / groups.length);
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, group.map((n) => n - 1));
    copied.forEach((p) => out.addPage(p));
    const bytes = await out.save();
    const label = group.length === 1 ? `p${group[0]}` : `p${group[0]}-${group[group.length - 1]}`;
    outputs.push({
      name: `${baseName(file.name)}-${label}.pdf`,
      blob: new Blob([bytes], { type: 'application/pdf' }),
      size: bytes.length,
    });
  }
  if (outputs.length === 1) return outputs;
  const zip = await makeZip(outputs);
  return [{ name: `${baseName(file.name)}-split-${outputs.length}份.zip`, blob: zip, size: zip.size }];
}

/* ---------- 旋转 ---------- */
export async function rotatePdf(file, params = {}, hooks = {}) {
  const { PDFDocument, degrees } = await ensurePdfLib();
  let doc;
  try {
    doc = await PDFDocument.load(await readAsArrayBuffer(file), { ignoreEncryption: true });
  } catch (e) {
    throw new Error('PDF 解析失败：' + (e.message || e));
  }
  const max = doc.getPageCount();
  const pages = flattenPages(parseRangeGroups(params.range, max), max);
  const angle = ((Number(params.rotate) || 90) % 360 + 360) % 360;
  hooks.onStage && hooks.onStage('旋转页面…');
  for (const n of pages) {
    const page = doc.getPage(n - 1);
    const current = page.getRotation().angle || 0;
    page.setRotation(degrees((current + angle) % 360));
  }
  const bytes = await doc.save();
  const blob = new Blob([bytes], { type: 'application/pdf' });
  return [{
    name: baseName(file.name) + `-rotated-${angle}.pdf`,
    blob,
    size: blob.size,
  }];
}

/* ---------- 重压（有损栅格化） ---------- */
export async function compressPdf(file, params = {}, hooks = {}) {
  const pdf = await loadPdf(file);
  try {
    const { PDFDocument } = await ensurePdfLib();
    const out = await PDFDocument.create();
    const pages = flattenPages(parseRangeGroups(params.range, pdf.numPages), pdf.numPages);
    const dpi = Number(params.dpi) || 144;
    const quality = (Number(params.quality) || 80) / 100;
    const scale = dpi / 72;
    for (let idx = 0; idx < pages.length; idx++) {
      if (hooks.isCancelled && hooks.isCancelled()) throw new DOMException('已取消', 'AbortError');
      const pageNum = pages[idx];
      hooks.onStage && hooks.onStage(`重压第 ${pageNum} 页（${idx + 1}/${pages.length}）`);
      hooks.onProgress && hooks.onProgress((idx + 1) / pages.length);
      const page = await pdf.getPage(pageNum);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale });
      if (viewport.width > 16384 || viewport.height > 16384) throw new Error('页面渲染尺寸过大，请降低渲染精度');
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const jpeg = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('页面编码失败'))), 'image/jpeg', quality);
      });
      const img = await out.embedJpg(await jpeg.arrayBuffer());
      const outPage = out.addPage([base.width, base.height]);
      outPage.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
      page.cleanup();
    }
    const bytes = await out.save();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    return [{
      name: baseName(file.name) + '-compressed.pdf',
      blob,
      size: blob.size,
      extra: pages.length,
    }];
  } finally {
    try { await pdf.destroy(); } catch (_) {}
  }
}

/* ---------- 合并 ---------- */
export async function mergePdfs(files, hooks = {}) {
  const { PDFDocument } = await ensurePdfLib();
  const out = await PDFDocument.create();
  for (let idx = 0; idx < files.length; idx++) {
    if (hooks.isCancelled && hooks.isCancelled()) throw new DOMException('已取消', 'AbortError');
    const file = files[idx];
    hooks.onStage && hooks.onStage(`合并 ${idx + 1}/${files.length}：${file.name}`);
    hooks.onProgress && hooks.onProgress((idx + 1) / files.length);
    let doc;
    try {
      doc = await PDFDocument.load(await readAsArrayBuffer(file), { ignoreEncryption: true });
    } catch (e) {
      throw new Error(`无法读取 ${file.name}：${e.message || e}`);
    }
    const pages = await out.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  const bytes = await out.save();
  const blob = new Blob([bytes], { type: 'application/pdf' });
  return [{
    name: `合并-${files.length}份-${baseName(files[0].name)}.pdf`,
    blob,
    size: blob.size,
  }];
}

/* ---------- 图片 -> PDF ---------- */
const A4 = { w: 595.28, h: 841.89 };

export async function imagesToPdf(files, params = {}, hooks = {}) {
  const { PDFDocument } = await ensurePdfLib();
  const doc = await PDFDocument.create();
  const perPage = [1, 2, 4].includes(Number(params.pdfPerPage)) ? Number(params.pdfPerPage) : 1;
  const a4Mode = params.pdfPage === 'a4' || perPage > 1;
  const quality = params.imageQuality && params.imageQuality !== 'original' ? Number(params.imageQuality) / 100 : null;
  const margin = Math.max(0, Math.min(120, Number(params.pdfMargin ?? 28)));
  const orientation = params.pdfOrientation || 'auto';

  const embed = async (file) => {
    const ext = extOf(file.name);
    if (!quality) {
      if (ext === 'jpg' || ext === 'jpeg') return doc.embedJpg(await readAsArrayBuffer(file));
      if (ext === 'png') return doc.embedPng(await readAsArrayBuffer(file));
      const r = await rasterize(file, { mime: 'image/png', background: params.background });
      return doc.embedPng(await r.blob.arrayBuffer());
    }
    const r = await rasterize(file, { mime: 'image/jpeg', quality, background: params.background || '#ffffff' });
    return doc.embedJpg(await r.blob.arrayBuffer());
  };

  const pageCount = Math.ceil(files.length / perPage);
  let processed = 0;
  for (let pageIdx = 0; pageIdx < pageCount; pageIdx++) {
    if (hooks.isCancelled && hooks.isCancelled()) throw new DOMException('已取消', 'AbortError');
    const group = files.slice(pageIdx * perPage, (pageIdx + 1) * perPage);
    hooks.onStage && hooks.onStage(`排版第 ${pageIdx + 1}/${pageCount} 页`);

    const imgs = [];
    for (const file of group) {
      try {
        imgs.push(await embed(file));
      } catch (e) {
        throw new Error(`无法读取图片 ${file.name}：${e.message || e}`);
      }
      processed++;
      hooks.onProgress && hooks.onProgress(processed / files.length);
    }
    if (!imgs.length) continue;

    let pageW;
    let pageH;
    const cells = [];
    if (a4Mode) {
      let landscape;
      if (orientation === 'landscape') landscape = true;
      else if (orientation === 'portrait') landscape = false;
      else landscape = perPage === 1 && imgs[0].width > imgs[0].height;
      pageW = landscape ? A4.h : A4.w;
      pageH = landscape ? A4.w : A4.h;
      const cols = perPage === 4 ? 2 : 1;
      const rows = perPage === 4 ? 2 : perPage;
      const cellW = (pageW - margin * 2) / cols;
      const cellH = (pageH - margin * 2) / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          cells.push({ x: margin + c * cellW, y: pageH - margin - (r + 1) * cellH, w: cellW, h: cellH });
        }
      }
    } else {
      const iw = imgs[0].width;
      const ih = imgs[0].height;
      const factor = 0.75;
      pageW = iw * factor;
      pageH = ih * factor;
      const cap = 2000;
      if (pageW > cap || pageH > cap) {
        const k = Math.min(cap / pageW, cap / pageH);
        pageW *= k;
        pageH *= k;
      }
      cells.push({ x: 0, y: 0, w: pageW, h: pageH });
    }

    const page = doc.addPage([pageW, pageH]);
    imgs.forEach((img, i) => {
      const cell = cells[i] || cells[0];
      const ratio = Math.min(cell.w / img.width, cell.h / img.height);
      const drawW = img.width * ratio;
      const drawH = img.height * ratio;
      page.drawImage(img, {
        x: cell.x + (cell.w - drawW) / 2,
        y: cell.y + (cell.h - drawH) / 2,
        width: drawW,
        height: drawH,
      });
    });
  }
  const bytes = await doc.save();
  const blob = new Blob([bytes], { type: 'application/pdf' });
  return [{
    name: baseName(files[0].name) + (files.length > 1 ? `-等${files.length}张` : '') + '.pdf',
    blob,
    size: blob.size,
  }];
}
