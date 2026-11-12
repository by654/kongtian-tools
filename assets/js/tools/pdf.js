/* PDF 文档工具 */
import { esc, copy, toast, download, fmtBytes, readAs } from '../core/ui.js';
import { bindFileZone, fileZone } from '../core/kit.js';

const $ = (root, s) => root.querySelector(s);
function parseRanges(str, max) {
  const out = [];
  for (const part of str.split(',').map((x) => x.trim()).filter(Boolean)) {
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number);
      for (let i = Math.max(1, a); i <= Math.min(max, b); i++) out.push(i - 1);
    } else {
      const n = Number(part);
      if (n >= 1 && n <= max) out.push(n - 1);
    }
  }
  return [...new Set(out)];
}
async function setupPdfjs(ctx) {
  await ctx.deps(['pdfjs']);
  const pdfjs = window.pdfjsLib;
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  return pdfjs;
}

export default {
  /* ================= 合并拆分 ================= */
  'pdf-merge'(root, ctx) {
    const $ = (s) => root.querySelector(s);
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>PDF 合并 / 拆分 / 页面管理</b><span class="hint">文件不离开浏览器</span></div>
          ${fileZone('pm-zone', { accept: 'application/pdf', multiple: true, label: '选择一个或多个 PDF' })}
          <div class="grid3" style="margin-top:10px">
            <div class="field"><label class="lab">操作</label><select class="sel" id="pm-mode"><option value="merge">合并</option><option value="split">拆分页面</option><option value="rotate">旋转页面</option><option value="delete">删除页面</option></select></div>
            <div class="field"><label class="lab">页码范围</label><input class="inp mono" id="pm-ranges" placeholder="例如 1-3,5（留空=全部）"></div>
            <div class="field"><label class="lab">旋转角度</label><select class="sel" id="pm-deg"><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></div>
          </div>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="pm-run">执行</button><span class="hint" id="pm-info">尚未选择文件</span></div>
        </div>
        <div class="panel"><div class="panel-head"><b>文件列表</b></div><div id="pm-list" class="hint">选择 PDF 后显示</div></div>
      </div>`;
    let files = [];
    bindFileZone(root, 'pm-zone', (fs) => {
      files = fs;
      $('#pm-info').textContent = `${fs.length} 个文件 · ${fmtBytes(fs.reduce((s, f) => s + f.size, 0))}`;
      $('#pm-list').innerHTML = fs.map((f, i) => `<div class="row between" style="border-bottom:1px solid var(--line);padding:5px 0"><span class="mono">${i + 1}. ${esc(f.name)}</span><span class="hint">${fmtBytes(f.size)}</span></div>`).join('');
    });
    $('#pm-run').onclick = async () => {
      if (!files.length) return toast('请选择 PDF', 'err');
      try {
        await ctx.deps(['pdflib']);
        const { PDFDocument } = window.PDFLib;
        const mode = $('#pm-mode').value;
        const out = await PDFDocument.create();
        if (mode === 'merge') {
          for (const f of files) {
            const src = await PDFDocument.load(await readAs(f, 'arraybuffer'), { ignoreEncryption: true });
            const pages = await out.copyPages(src, src.getPageIndices());
            pages.forEach((p) => out.addPage(p));
          }
          download('merged.pdf', new Blob([await out.save()], { type: 'application/pdf' }));
          return;
        }
        if (mode === 'split') {
          if (files.length > 1) throw new Error('拆分一次只处理一个 PDF');
          const src = await PDFDocument.load(await readAs(files[0], 'arraybuffer'), { ignoreEncryption: true });
          const total = src.getPageCount();
          const idx = $('#pm-ranges').value.trim() ? parseRanges($('#pm-ranges').value, total) : [...Array(total).keys()];
          const pages = await out.copyPages(src, idx.length ? idx : [0]);
          pages.forEach((p) => out.addPage(p));
          download('split.pdf', new Blob([await out.save()], { type: 'application/pdf' }));
          return;
        }
        const src = await PDFDocument.load(await readAs(files[0], 'arraybuffer'), { ignoreEncryption: true });
        const total = src.getPageCount();
        const idx = $('#pm-ranges').value.trim() ? parseRanges($('#pm-ranges').value, total) : [...Array(total).keys()];
        if (mode === 'rotate') {
          const deg = Number($('#pm-deg').value);
          idx.forEach((i) => { const p = src.getPage(i); p.setRotation(window.PDFLib.degrees((p.getRotation().angle + deg) % 360)); });
        } else {
          [...idx].sort((a, b) => b - a).forEach((i) => { if (src.getPageCount() > 1) src.removePage(i); });
        }
        download(mode === 'rotate' ? 'rotated.pdf' : 'deleted.pdf', new Blob([await src.save()], { type: 'application/pdf' }));
      } catch (e) { toast('处理失败：' + e.message, 'err'); }
    };
  },

  /* ================= PDF 信息 ================= */
  'pdf-info'(root, ctx) {
    const $ = (s) => root.querySelector(s);
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>PDF 信息</b><span class="hint">页数、元数据与缩略图</span></div>
          ${fileZone('pi-zone', { accept: 'application/pdf', label: '选择 PDF 文件' })}
          <button class="btn primary" id="pi-run" style="margin-top:10px" disabled>读取信息</button>
        </div>
        <div class="grid2">
          <div class="panel"><div class="panel-head"><b>元数据</b></div><div id="pi-meta" class="kv"><div class="hint">尚未读取</div></div></div>
          <div class="panel"><div class="panel-head"><b>缩略图</b></div><div id="pi-thumbs" class="thumbs"><div class="hint">尚未读取</div></div></div>
        </div>
      </div>`;
    let file = null;
    bindFileZone(root, 'pi-zone', (fs) => { file = fs[0]; $('#pi-run').disabled = false; });
    $('#pi-run').onclick = async () => {
      if (!file) return;
      try {
        const pdfjs = await setupPdfjs(ctx);
        const doc = await pdfjs.getDocument({ data: await readAs(file, 'arraybuffer') }).promise;
        const meta = await doc.getMetadata().catch(() => ({}));
        const info = meta.info || {};
        $('#pi-meta').innerHTML = [
          ['文件名', file.name], ['大小', fmtBytes(file.size)], ['页数', doc.numPages],
          ['标题', info.Title || '—'], ['作者', info.Author || '—'], ['创建工具', info.Creator || '—'],
          ['PDF 版本', info.PDFFormatVersion || '—'], ['加密', '—']
        ].map(([k, v]) => `<dt>${k}</dt><dd>${esc(String(v))}</dd>`).join('');
        $('#pi-thumbs').innerHTML = '';
        for (let i = 1; i <= Math.min(4, doc.numPages); i++) {
          const page = await doc.getPage(i);
          const vp = page.getViewport({ scale: 0.6 });
          const cv = document.createElement('canvas');
          cv.width = vp.width; cv.height = vp.height;
          await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
          const div = document.createElement('div');
          div.className = 'thumb'; div.style.aspectRatio = 'auto';
          div.appendChild(cv);
          $('#pi-thumbs').appendChild(div);
        }
      } catch (e) { $('#pi-meta').innerHTML = `<div class="errbox">${esc(e.message)}</div>`; }
    };
  },

  /* ================= PDF 文本 ================= */
  'pdf-text'(root, ctx) {
    const $ = (s) => root.querySelector(s);
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>PDF 文本提取</b><span class="hint">使用 PDF.js 逐页提取</span></div>
          ${fileZone('pt-zone', { accept: 'application/pdf', label: '选择 PDF 文件' })}
          <div class="row" style="margin-top:10px"><button class="btn primary" id="pt-run">提取文本</button><button class="btn" id="pt-copy">复制</button><button class="btn" id="pt-dl">下载 TXT</button><span class="hint" id="pt-status">尚未开始</span></div>
        </div>
        <div class="panel"><pre class="out" id="pt-out" style="max-height:560px">提取结果会显示在这里</pre></div>
      </div>`;
    let file = null;
    bindFileZone(root, 'pt-zone', (fs) => { file = fs[0]; $('#pt-status').textContent = `${file.name} · ${fmtBytes(file.size)}`; });
    $('#pt-run').onclick = async () => {
      if (!file) return toast('请选择 PDF', 'err');
      try {
        const pdfjs = await setupPdfjs(ctx);
        const doc = await pdfjs.getDocument({ data: await readAs(file, 'arraybuffer') }).promise;
        let out = '';
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          out += `\n===== 第 ${i} 页 =====\n` + content.items.map((x) => x.str).join(' ');
        }
        $('#pt-out').textContent = out.trim();
        $('#pt-status').textContent = `${doc.numPages} 页 · ${[...out].length} 字符`;
      } catch (e) { $('#pt-status').textContent = '提取失败：' + e.message; }
    };
    $('#pt-copy').onclick = () => copy($('#pt-out').textContent);
    $('#pt-dl').onclick = () => download(file ? file.name.replace(/\.pdf$/i, '') + '.txt' : 'pdf-text.txt', $('#pt-out').textContent, 'text/plain');
  },

  /* ================= PDF 水印页码 ================= */
  'pdf-watermark'(root, ctx) {
    const $ = (s) => root.querySelector(s);
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>PDF 水印与页码</b><span class="hint">使用 pdf-lib 写入</span></div>
          ${fileZone('pw-zone', { accept: 'application/pdf', label: '选择 PDF 文件' })}
          <div class="grid4" style="margin-top:10px">
            <div class="field"><label class="lab">水印文字</label><input class="inp" id="pw-text" value="内部资料"></div>
            <div class="field"><label class="lab">透明度</label><input class="inp" id="pw-op" type="number" step="0.05" value="0.12"></div>
            <div class="field"><label class="lab">字号</label><input class="inp" id="pw-size" type="number" value="48"></div>
            <div class="field"><label class="lab">颜色</label><input type="color" id="pw-color" value="#888888"></div>
          </div>
          <div class="row" style="margin-top:9px"><label class="row" style="gap:5px"><input type="checkbox" id="pw-pageno" checked> 添加页码</label><button class="btn primary" id="pw-run">生成 PDF</button></div>
        </div>
      </div>`;
    let file = null;
    bindFileZone(root, 'pw-zone', (fs) => { file = fs[0]; });
    $('#pw-run').onclick = async () => {
      if (!file) return toast('请选择 PDF', 'err');
      try {
        await ctx.deps(['pdflib']);
        const { PDFDocument, StandardFonts, rgb, degrees } = window.PDFLib;
        const pdf = await PDFDocument.load(await readAs(file, 'arraybuffer'), { ignoreEncryption: true });
        const font = await pdf.embedFont(StandardFonts.HelveticaBold);
        const hex = $('#pw-color').value;
        const color = rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);
        const text = $('#pw-text').value;
        const size = Number($('#pw-size').value) || 48;
        const opacity = Number($('#pw-op').value) || 0.12;
        const pages = pdf.getPages();
        pages.forEach((page, i) => {
          const { width, height } = page.getSize();
          const tw = font.widthOfTextAtSize(text, size);
          page.drawText(text, {
            x: (width - tw * Math.cos(degrees(-30).angle)) / 2 - 40,
            y: height / 2 - 30,
            size, font, color, opacity, rotate: degrees(-30)
          });
          if ($('#pw-pageno').checked) {
            const label = `${i + 1} / ${pages.length}`;
            page.drawText(label, { x: width / 2 - 20, y: 18, size: 9, font, color: rgb(0.4, 0.4, 0.4), opacity: 0.8 });
          }
        });
        download('watermarked.pdf', new Blob([await pdf.save()], { type: 'application/pdf' }));
      } catch (e) { toast('处理失败：' + e.message, 'err'); }
    };
  },

  /* ================= PDF 签名 ================= */
  'pdf-sign'(root, ctx) {
    const $ = (s) => root.querySelector(s);
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>PDF 手写签名</b><span class="hint">在下方画布签名，然后嵌入 PDF</span></div>
          ${fileZone('sg-zone', { accept: 'application/pdf', label: '选择 PDF 文件' })}
          <div class="canvas-wrap" style="margin-top:10px"><canvas id="sg-canvas" width="520" height="180" style="background:#fff;border-radius:8px;touch-action:none;cursor:crosshair"></canvas></div>
          <div class="row" style="margin-top:9px"><button class="btn" id="sg-clear">清除签名</button>
            <select class="sel" id="sg-pos" style="max-width:150px"><option value="br">右下角</option><option value="bl">左下角</option><option value="tr">右上角</option><option value="tl">左上角</option></select>
            <input class="inp" id="sg-page" type="number" value="1" style="max-width:90px">
            <button class="btn primary" id="sg-run">嵌入签名并下载</button></div>
        </div>
      </div>`;
    let file = null;
    const cv = $('#sg-canvas');
    const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
    g.strokeStyle = '#111'; g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round';
    let drawing = false, hasInk = false;
    const pos = (e) => {
      const r = cv.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return [(t.clientX - r.left) / r.width * cv.width, (t.clientY - r.top) / r.height * cv.height];
    };
    const start = (e) => { e.preventDefault(); drawing = true; const [x, y] = pos(e); g.beginPath(); g.moveTo(x, y); };
    const move = (e) => { if (!drawing) return; e.preventDefault(); const [x, y] = pos(e); g.lineTo(x, y); g.stroke(); hasInk = true; };
    const end = () => { drawing = false; };
    cv.addEventListener('mousedown', start); cv.addEventListener('mousemove', move); window.addEventListener('mouseup', end);
    cv.addEventListener('touchstart', start, { passive: false }); cv.addEventListener('touchmove', move, { passive: false }); cv.addEventListener('touchend', end);
    $('#sg-clear').onclick = () => { g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); hasInk = false; };
    bindFileZone(root, 'sg-zone', (fs) => { file = fs[0]; });
    $('#sg-run').onclick = async () => {
      if (!file) return toast('请选择 PDF', 'err');
      if (!hasInk) return toast('请先签名', 'err');
      try {
        await ctx.deps(['pdflib']);
        const { PDFDocument, degrees } = window.PDFLib;
        const pdf = await PDFDocument.load(await readAs(file, 'arraybuffer'), { ignoreEncryption: true });
        const png = await new Promise((res) => cv.toBlob(res, 'image/png'));
        const img = await pdf.embedPng(await png.arrayBuffer());
        const pages = pdf.getPages();
        const idx = Math.max(0, Math.min(pages.length - 1, (Number($('#sg-page').value) || 1) - 1));
        const page = pages[idx];
        const { width, height } = page.getSize();
        const w = Math.min(180, width * 0.3), h = w * cv.height / cv.width;
        const m = 36;
        const p = $('#sg-pos').value;
        page.drawImage(img, {
          x: p === 'br' || p === 'tr' ? width - w - m : m,
          y: p === 'br' || p === 'bl' ? m : height - h - m,
          width: w, height: h
        });
        download('signed.pdf', new Blob([await pdf.save()], { type: 'application/pdf' }));
      } catch (e) { toast('签名失败：' + e.message, 'err'); }
    };
  },

  /* ================= PDF Base64 ================= */
  'pdf-base64'(root) {
    const $ = (s) => root.querySelector(s);
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>PDF ↔ Base64</b></div>
          ${fileZone('pb-zone', { accept: 'application/pdf', label: '选择 PDF 转换为 Base64' })}
          <div class="row" style="margin-top:10px"><button class="btn" id="pb-copy">复制 Base64</button><span class="hint" id="pb-info">尚未选择文件</span></div>
          <pre class="out" id="pb-out" style="margin-top:9px;max-height:200px"></pre>
        </div>
        <div class="panel">
          <div class="panel-head"><b>Base64 → PDF</b></div>
          <textarea class="ta mono" id="pb-src" rows="5" placeholder="粘贴 Base64 或 data:application/pdf;base64,..."></textarea>
          <button class="btn primary" id="pb-dec" style="margin-top:9px">还原并下载</button>
        </div>
      </div>`;
    let b64 = '';
    bindFileZone(root, 'pb-zone', async (fs) => {
      const dataUrl = await readAs(fs[0], 'dataurl');
      b64 = dataUrl.split(',')[1];
      $('#pb-out').textContent = b64;
      $('#pb-info').textContent = `${fs[0].name} · ${fmtBytes(fs[0].size)}`;
    });
    $('#pb-copy').onclick = () => copy(b64);
    $('#pb-dec').onclick = () => {
      try {
        const src = $('#pb-src').value.trim();
        const data = src.includes(',') ? src.split(',')[1] : src;
        const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
        download('restored.pdf', new Blob([bytes], { type: 'application/pdf' }));
      } catch { toast('Base64 无效', 'err'); }
    };
  }
};
