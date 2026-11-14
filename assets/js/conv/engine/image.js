/* 图片转换：Canvas 编码 PNG/JPG/WEBP/BMP/ICO，AVIF 视浏览器能力 */
import { baseName, extOf, mimeForExt } from './utils.js';
import { AVIF_ENCODE_SUPPORTED } from './registry.js';

const MAX_DIM = 16384;
const MAX_PIXELS = 80 * 1000000;

export function canEncodeAvif() {
  return AVIF_ENCODE_SUPPORTED;
}

export async function loadImage(file) {
  const ext = extOf(file.name);
  if (ext !== 'svg') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { el: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close && bmp.close() };
    } catch (_) {
      /* 某些格式不支持 createImageBitmap，走 Image 回退 */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('当前浏览器无法解码该图片格式'));
      im.src = url;
    });
    const w = img.naturalWidth || img.width || 1024;
    const h = img.naturalHeight || img.height || 1024;
    return { el: img, w, h, close: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

export function computeSize(w0, h0, params = {}) {
  let w = parseInt(params.width, 10) || 0;
  let h = parseInt(params.height, 10) || 0;
  if (w === 0 && h === 0) return { w: w0, h: h0 };
  if (w && !h) h = Math.round((h0 / w0) * w);
  else if (!w && h) w = Math.round((w0 / h0) * h);
  return { w: Math.max(1, w), h: Math.max(1, h) };
}

function guardSize(w, h) {
  if (w > MAX_DIM || h > MAX_DIM) throw new Error('目标尺寸超过浏览器画布上限（16384 px）');
  if (w * h > MAX_PIXELS) throw new Error('目标像素总量过大，请降低分辨率');
}

function makeCanvas(w, h) {
  guardSize(w, h);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return { canvas, ctx };
}

function paint(ctx, img, w, h, background, keepAlpha) {
  if (!keepAlpha) {
    ctx.fillStyle = background || '#ffffff';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('浏览器无法输出 ' + mime + ' 格式'));
    }, mime, quality);
  });
}

function encodeBmp(canvas) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  const pixels = ctx.getImageData(0, 0, w, h).data;
  const rowSize = Math.floor((24 * w + 31) / 32) * 4;
  const dataSize = rowSize * h;
  const fileSize = 54 + dataSize;
  const buf = new ArrayBuffer(fileSize);
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);

  dv.setUint16(0, 0x4d42, true);
  dv.setUint32(2, fileSize, true);
  dv.setUint32(10, 54, true);
  dv.setUint32(14, 40, true);
  dv.setInt32(18, w, true);
  dv.setInt32(22, h, true);
  dv.setUint16(26, 1, true);
  dv.setUint16(28, 24, true);
  dv.setUint32(34, dataSize, true);
  dv.setUint32(38, 2835, true);
  dv.setUint32(42, 2835, true);

  for (let y = 0; y < h; y++) {
    const srcRow = h - 1 - y;
    const dst = 54 + y * rowSize;
    for (let x = 0; x < w; x++) {
      const s = (srcRow * w + x) * 4;
      const d = dst + x * 3;
      u8[d] = pixels[s + 2];
      u8[d + 1] = pixels[s + 1];
      u8[d + 2] = pixels[s];
    }
  }
  return new Blob([buf], { type: 'image/bmp' });
}

/** 未压缩 RGB TIFF（小端），供不依赖第三方编码器的场景使用 */
function encodeTiff(canvas) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  const pixels = ctx.getImageData(0, 0, w, h).data;
  const entries = 13;
  const ifdStart = 8;
  const bitsOffset = ifdStart + 2 + entries * 12 + 4;
  const xResOffset = bitsOffset + 6;
  const yResOffset = xResOffset + 8;
  const stripOffset = yResOffset + 8;
  const dataSize = w * h * 3;
  const total = stripOffset + dataSize;
  const buf = new ArrayBuffer(total);
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);

  dv.setUint16(0, 0x4949, true);
  dv.setUint16(2, 42, true);
  dv.setUint32(4, ifdStart, true);
  dv.setUint16(ifdStart, entries, true);

  let pos = ifdStart + 2;
  const put = (tag, type, count, value) => {
    dv.setUint16(pos, tag, true);
    dv.setUint16(pos + 2, type, true);
    dv.setUint32(pos + 4, count, true);
    if (type === 3 && count === 1) dv.setUint16(pos + 8, value, true);
    else dv.setUint32(pos + 8, value, true);
    pos += 12;
  };
  put(256, 4, 1, w);
  put(257, 4, 1, h);
  put(258, 3, 3, bitsOffset);
  put(259, 3, 1, 1);
  put(262, 3, 1, 2);
  put(273, 4, 1, stripOffset);
  put(277, 3, 1, 3);
  put(278, 4, 1, h);
  put(279, 4, 1, dataSize);
  put(282, 5, 1, xResOffset);
  put(283, 5, 1, yResOffset);
  put(284, 3, 1, 1);
  put(296, 3, 1, 2);
  dv.setUint32(pos, 0, true);

  dv.setUint16(bitsOffset, 8, true);
  dv.setUint16(bitsOffset + 2, 8, true);
  dv.setUint16(bitsOffset + 4, 8, true);
  dv.setUint32(xResOffset, 72, true);
  dv.setUint32(xResOffset + 4, 1, true);
  dv.setUint32(yResOffset, 72, true);
  dv.setUint32(yResOffset + 4, 1, true);

  let d = stripOffset;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4;
      u8[d++] = pixels[s];
      u8[d++] = pixels[s + 1];
      u8[d++] = pixels[s + 2];
    }
  }
  return new Blob([buf], { type: 'image/tiff' });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
    fr.onerror = () => reject(new Error('图片转 Base64 失败'));
    fr.readAsDataURL(blob);
  });
}

async function encodeSvg(canvas) {
  const png = await canvasToBlob(canvas, 'image/png');
  const b64 = await blobToBase64(png);
  const w = canvas.width;
  const h = canvas.height;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <image href="data:image/png;base64,${b64}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>
</svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
}

/** 体积优先：对支持质量参数的格式做二分搜索，逼近目标 KB */
async function encodeLossy(canvas, mime, params, quality) {
  const targetKB = parseInt(params.targetKB, 10) || 0;
  if (params.compressStrategy !== 'size' || targetKB <= 0) return canvasToBlob(canvas, mime, quality);
  const target = targetKB * 1024;
  let lo = 0.12;
  let hi = 0.98;
  let bestUnder = null;
  let smallest = null;
  for (let i = 0; i < 8; i++) {
    const q = (lo + hi) / 2;
    const b = await canvasToBlob(canvas, mime, q);
    if (!smallest || b.size < smallest.size) smallest = b;
    if (b.size <= target) { bestUnder = b; lo = q; } else hi = q;
  }
  return bestUnder || smallest;
}

function fitSquareCanvas(img, size, background) {
  const { canvas, ctx } = makeCanvas(size, size);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, size, size);
  }
  const ratio = Math.min(size / img.w, size / img.h);
  const w = Math.round(img.w * ratio);
  const h = Math.round(img.h * ratio);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img.el, Math.round((size - w) / 2), Math.round((size - h) / 2), w, h);
  return canvas;
}

async function encodeIco(img) {
  const sizes = [16, 32, 48, 64, 128, 256];
  const pngs = [];
  for (const size of sizes) {
    const canvas = fitSquareCanvas(img, size, null);
    const blob = await canvasToBlob(canvas, 'image/png');
    pngs.push({ size, bytes: new Uint8Array(await blob.arrayBuffer()) });
  }
  const count = pngs.length;
  const headerSize = 6 + 16 * count;
  let offset = headerSize;
  const total = headerSize + pngs.reduce((s, p) => s + p.bytes.length, 0);
  const buf = new ArrayBuffer(total);
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  dv.setUint16(0, 0, true);
  dv.setUint16(2, 1, true);
  dv.setUint16(4, count, true);
  let pos = 6;
  for (const p of pngs) {
    dv.setUint8(pos, p.size >= 256 ? 0 : p.size);
    dv.setUint8(pos + 1, p.size >= 256 ? 0 : p.size);
    dv.setUint8(pos + 2, 0);
    dv.setUint8(pos + 3, 0);
    dv.setUint16(pos + 4, 1, true);
    dv.setUint16(pos + 6, 32, true);
    dv.setUint32(pos + 8, p.bytes.length, true);
    dv.setUint32(pos + 12, offset, true);
    u8.set(p.bytes, offset);
    offset += p.bytes.length;
    pos += 16;
  }
  return new Blob([buf], { type: 'image/x-icon' });
}

/** 供 PDF 模块复用的光栅化：返回 PNG/JPG Blob */
export async function rasterize(file, opts = {}) {
  const img = await loadImage(file);
  try {
    const { w, h } = computeSize(img.w, img.h, opts);
    const mime = opts.mime || 'image/png';
    const keepAlpha = mime === 'image/png' || mime === 'image/webp';
    const { canvas, ctx } = makeCanvas(w, h);
    paint(ctx, img.el, w, h, opts.background, keepAlpha);
    const blob = await canvasToBlob(canvas, mime, opts.quality);
    return { blob, w, h };
  } finally {
    img.close();
  }
}

export async function convertImage(file, target, params = {}, hooks = {}) {
  hooks.onStage && hooks.onStage('解码图片…');
  const img = await loadImage(file);
  try {
    const base = baseName(file.name);
    const same = extOf(file.name) === target;

    if (target === 'ico') {
      hooks.onStage && hooks.onStage('生成多尺寸图标…');
      const blob = await encodeIco(img);
      return [{ name: base + (same ? '-icons' : '') + '.ico', blob, size: blob.size }];
    }

    const { w, h } = computeSize(img.w, img.h, params);
    const quality = (parseInt(params.quality, 10) || 90) / 100;
    const keepAlpha = target === 'png' || target === 'webp' || target === 'avif';
    const { canvas, ctx } = makeCanvas(w, h);
    paint(ctx, img.el, w, h, params.background, keepAlpha);

    hooks.onStage && hooks.onStage('编码 ' + target.toUpperCase() + '…');
    let blob;
    const useQuality = target === 'jpg' || target === 'webp' || target === 'avif';
    if (target === 'bmp') blob = encodeBmp(canvas);
    else if (target === 'tiff') blob = encodeTiff(canvas);
    else if (target === 'svg') blob = await encodeSvg(canvas);
    else if (useQuality) blob = await encodeLossy(canvas, mimeForExt(target), params, quality);
    else blob = await canvasToBlob(canvas, mimeForExt(target));

    const name = base + (same ? '-converted' : '') + '.' + target;
    return [{ name, blob, size: blob.size }];
  } finally {
    img.close();
  }
}
