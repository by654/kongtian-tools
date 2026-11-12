/* 图片与 Canvas 工具 */
import { esc, copy, toast, download, fmtBytes, readAs } from '../core/ui.js';
import { bindFileZone, fileZone, loadImage } from '../core/kit.js';

const $ = (root, s) => root.querySelector(s);
const $$ = (root, s) => [...root.querySelectorAll(s)];
function canvasBlob(cv, type = 'image/png', q = 0.92) {
  return new Promise((res) => cv.toBlob(res, type, q));
}
function drawFit(img, maxW, maxH) {
  const r = Math.min(1, maxW / img.width, maxH / img.height);
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(img.width * r));
  cv.height = Math.max(1, Math.round(img.height * r));
  const g = cv.getContext('2d');
  g.drawImage(img, 0, 0, cv.width, cv.height);
  return cv;
}
async function loadFromFile(file) {
  const url = URL.createObjectURL(file);
  const img = await loadImage(url);
  return { img, url };
}
async function toPngBytes(file) {
  const { img } = await loadFromFile(file);
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  cv.getContext('2d').drawImage(img, 0, 0);
  const blob = await canvasBlob(cv, 'image/png');
  return new Uint8Array(await blob.arrayBuffer());
}

export default {
  /* ================= 图片压缩 ================= */
  'image-compress'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>图片压缩</b><span class="hint">可批量，全部在本地处理</span></div>
          ${fileZone('ic-zone', { accept: 'image/*', multiple: true, label: '选择一张或多张图片' })}
          <div class="grid3" style="margin-top:10px">
            <div class="field"><label class="lab">质量 <span id="ic-qv">0.82</span></label><input type="range" id="ic-q" min="0.2" max="1" step="0.02" value="0.82"></div>
            <div class="field"><label class="lab">最大宽度 px（0 不缩放）</label><input class="inp" id="ic-maxw" type="number" value="2000"></div>
            <div class="field"><label class="lab">输出格式</label><select class="sel" id="ic-fmt"><option value="image/jpeg">JPEG</option><option value="image/webp">WebP</option><option value="image/png">PNG</option></select></div>
          </div>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="ic-run">压缩</button><button class="btn" id="ic-zip">打包下载 ZIP</button><span class="hint" id="ic-meta"></span></div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b></div><div id="ic-list" class="tool-ui"><div class="hint">选择图片后显示</div></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let files = [], results = [];
    $('#ic-q').oninput = () => { $('#ic-qv').textContent = $('#ic-q').value; };
    bindFileZone(root, 'ic-zone', (f) => { files = f; $('#ic-meta').textContent = `${f.length} 张图片`; run(); });
    const run = async () => {
      if (!files.length) return;
      results = [];
      $('#ic-list').innerHTML = `<div class="hint">处理中…</div>`;
      for (const f of files) {
        try {
          const { img, url } = await loadFromFile(f);
          const maxW = Number($('#ic-maxw').value) || 0;
          let cv;
          if (maxW && img.width > maxW) {
            const w = maxW, h = Math.round(img.height * maxW / img.width);
            cv = document.createElement('canvas'); cv.width = w; cv.height = h;
            cv.getContext('2d').drawImage(img, 0, 0, w, h);
          } else {
            cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
            cv.getContext('2d').drawImage(img, 0, 0);
          }
          const fmt = $('#ic-fmt').value;
          const blob = await canvasBlob(cv, fmt, Number($('#ic-q').value));
          const ext = fmt.split('/')[1].replace('jpeg', 'jpg');
          results.push({ name: f.name.replace(/\.\w+$/, '') + '-min.' + ext, blob, before: f.size, after: blob.size, url, w: cv.width, h: cv.height });
        } catch (e) {
          results.push({ name: f.name, error: e.message });
        }
      }
      $('#ic-list').innerHTML = results.map((r) => r.error
        ? `<div class="panel tight"><div class="errbox">${esc(r.name)}：${esc(r.error)}</div></div>`
        : `<div class="panel tight"><div class="row between"><div class="row"><img src="${r.url}" style="width:54px;height:54px;object-fit:cover;border-radius:7px"><div><b>${esc(r.name)}</b><div class="hint">${r.w}×${r.h} · ${fmtBytes(r.before)} → ${fmtBytes(r.after)} · 节省 ${Math.max(0, Math.round((1 - r.after / r.before) * 100))}%</div></div></div><button class="btn sm" data-dl="${esc(r.name)}">下载</button></div></div>`).join('');
      root.querySelectorAll('[data-dl]').forEach((b) => b.addEventListener('click', () => {
        const r = results.find((x) => x.name === b.dataset.dl);
        if (r) download(r.name, r.blob);
      }));
      const total = results.reduce((s, r) => s + (r.after || 0), 0);
      $('#ic-meta').textContent = `共 ${results.length} 张 · ${fmtBytes(total)}`;
    };
    $('#ic-run').onclick = run;
    $('#ic-zip').onclick = async () => {
      if (!results.length) return toast('还没有结果', 'err');
      const { loadDeps } = await import('../core/deps.js');
      await loadDeps(['jszip']);
      const zip = new window.JSZip();
      results.filter((r) => r.blob).forEach((r) => zip.file(r.name, r.blob));
      const blob = await zip.generateAsync({ type: 'blob' });
      download('compressed-images.zip', blob);
    };
  },

  /* ================= 缩放与格式转换 ================= */
  'image-resize'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>缩放 / 格式转换</b></div>
          ${fileZone('ir-zone', { accept: 'image/*', multiple: true, label: '选择图片（可批量）' })}
          <div class="grid4" style="margin-top:10px">
            <div class="field"><label class="lab">宽度</label><input class="inp" id="ir-w" type="number" placeholder="800"></div>
            <div class="field"><label class="lab">高度</label><input class="inp" id="ir-h" type="number" placeholder="自动"></div>
            <div class="field"><label class="lab">格式</label><select class="sel" id="ir-fmt"><option value="image/png">PNG</option><option value="image/jpeg">JPEG</option><option value="image/webp">WebP</option></select></div>
            <div class="field" style="display:flex;align-items:flex-end"><label class="row" style="gap:5px"><input type="checkbox" id="ir-ratio" checked> 保持比例</label></div>
          </div>
          <button class="btn primary" id="ir-run" style="margin-top:10px">转换并下载</button>
        </div>
        <div class="panel"><div class="panel-head"><b>预览</b></div><div id="ir-list" class="thumbs"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let files = [];
    bindFileZone(root, 'ir-zone', (f) => {
      files = f;
      $('#ir-list').innerHTML = f.map((x) => `<div class="thumb"><img src="${URL.createObjectURL(x)}" alt=""></div>`).join('');
    });
    $('#ir-run').onclick = async () => {
      if (!files.length) return toast('请选择图片', 'err');
      const fmt = $('#ir-fmt').value;
      const ext = fmt.split('/')[1].replace('jpeg', 'jpg');
      for (const f of files) {
        const { img } = await loadFromFile(f);
        let w = Number($('#ir-w').value) || img.width;
        let h = Number($('#ir-h').value) || Math.round(img.height * w / img.width);
        if (img.width <= 0) continue;
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const g = cv.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, w, h);
        const blob = await canvasBlob(cv, fmt, 0.92);
        download(f.name.replace(/\.\w+$/, '') + '.' + ext, blob);
      }
    };
  },

  /* ================= 裁剪与旋转 ================= */
  'image-crop'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          ${fileZone('cr-zone', { accept: 'image/*', label: '选择图片' })}
          <div class="grid4" style="margin-top:10px">
            <div class="field"><label class="lab">X</label><input class="inp" id="cr-x" type="number" value="0"></div>
            <div class="field"><label class="lab">Y</label><input class="inp" id="cr-y" type="number" value="0"></div>
            <div class="field"><label class="lab">宽度</label><input class="inp" id="cr-w" type="number" value="0"></div>
            <div class="field"><label class="lab">高度</label><input class="inp" id="cr-h" type="number" value="0"></div>
          </div>
          <div class="row" style="margin-top:10px">
            <button class="btn" id="cr-rot90">旋转 90°</button><button class="btn" id="cr-flipx">水平翻转</button><button class="btn" id="cr-flipy">垂直翻转</button>
            <button class="btn primary" id="cr-run">裁剪并下载</button>
          </div>
          <div class="hint" id="cr-info" style="margin-top:7px">尚未选择图片</div>
        </div>
        <div class="panel"><div class="canvas-wrap" style="position:relative;display:inline-block" id="cr-wrap"><div class="hint">预览</div></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let img = null, rotation = 0, flipX = false, flipY = false;
    const paint = () => {
      if (!img) return;
      const cv = document.createElement('canvas');
      const rot = rotation % 360;
      const w = rot % 180 ? img.height : img.width, h = rot % 180 ? img.width : img.height;
      cv.width = w; cv.height = h;
      const g = cv.getContext('2d');
      g.translate(w / 2, h / 2);
      g.rotate(rotation * Math.PI / 180);
      g.scale(flipX ? -1 : 1, flipY ? -1 : 1);
      g.drawImage(img, -img.width / 2, -img.height / 2);
      $('#cr-wrap').innerHTML = '';
      cv.style.maxWidth = '100%';
      cv.style.cursor = 'crosshair';
      $('#cr-wrap').appendChild(cv);
      cv.style.width = cv.width > 900 ? '100%' : cv.width + 'px';
    };
    bindFileZone(root, 'cr-zone', async (files) => {
      const { img: i } = await loadFromFile(files[0]);
      img = i; rotation = 0; flipX = flipY = false;
      $('#cr-w').value = i.width; $('#cr-h').value = i.height; $('#cr-x').value = 0; $('#cr-y').value = 0;
      $('#cr-info').textContent = `${i.width} × ${i.height}`;
      paint();
    });
    $('#cr-rot90').onclick = () => { rotation = (rotation + 90) % 360; paint(); };
    $('#cr-flipx').onclick = () => { flipX = !flipX; paint(); };
    $('#cr-flipy').onclick = () => { flipY = !flipY; paint(); };
    $('#cr-run').onclick = () => {
      if (!img) return toast('请选择图片', 'err');
      const cv = document.createElement('canvas');
      const rot = rotation % 360;
      const fullW = rot % 180 ? img.height : img.width, fullH = rot % 180 ? img.width : img.height;
      cv.width = fullW; cv.height = fullH;
      const g = cv.getContext('2d');
      g.translate(fullW / 2, fullH / 2);
      g.rotate(rotation * Math.PI / 180);
      g.scale(flipX ? -1 : 1, flipY ? -1 : 1);
      g.drawImage(img, -img.width / 2, -img.height / 2);
      const x = Math.max(0, Number($('#cr-x').value) || 0), y = Math.max(0, Number($('#cr-y').value) || 0);
      const w = Math.min(fullW - x, Number($('#cr-w').value) || fullW), h = Math.min(fullH - y, Number($('#cr-h').value) || fullH);
      const out = document.createElement('canvas');
      out.width = w; out.height = h;
      out.getContext('2d').drawImage(cv, x, y, w, h, 0, 0, w, h);
      out.toBlob((b) => download('cropped.png', b));
    };
  },

  /* ================= 水印 ================= */
  'image-watermark'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          ${fileZone('wm-zone', { accept: 'image/*', multiple: true, label: '选择图片（批量使用同一水印）' })}
          <div class="grid3" style="margin-top:10px">
            <div class="field"><label class="lab">水印文字</label><input class="inp" id="wm-text" value="空天工具合集"></div>
            <div class="field"><label class="lab">位置</label><select class="sel" id="wm-pos"><option value="br">右下角</option><option value="bl">左下角</option><option value="tr">右上角</option><option value="tl">左上角</option><option value="center">居中</option><option value="tile">平铺</option></select></div>
            <div class="field"><label class="lab">透明度 <span id="wm-ov">0.5</span></label><input type="range" id="wm-op" min="0.05" max="1" step="0.05" value="0.5"></div>
            <div class="field"><label class="lab">字号比例 <span id="wm-sv">0.04</span></label><input type="range" id="wm-size" min="0.015" max="0.12" step="0.005" value="0.04"></div>
            <div class="field"><label class="lab">颜色</label><input type="color" id="wm-color" value="#ffffff"></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="wm-run" style="width:100%">应用并下载</button></div>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>预览</b></div><div class="canvas-wrap" id="wm-preview"><div class="hint">选择图片后预览</div></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let files = [], img = null;
    const apply = (im) => {
      const text = $('#wm-text').value;
      const cv = document.createElement('canvas');
      cv.width = im.width; cv.height = im.height;
      const g = cv.getContext('2d');
      g.drawImage(im, 0, 0);
      const size = Math.max(12, im.width * Number($('#wm-size').value));
      g.font = `600 ${size}px -apple-system, "PingFang SC", sans-serif`;
      g.fillStyle = $('#wm-color').value;
      g.globalAlpha = Number($('#wm-op').value);
      const pos = $('#wm-pos').value;
      if (pos === 'tile') {
        g.save();
        g.rotate(-20 * Math.PI / 180);
        for (let y = -im.height; y < im.height * 2; y += size * 3) for (let x = -im.width; x < im.width * 2; x += g.measureText(text).width + size * 3) g.fillText(text, x, y);
        g.restore();
      } else {
        const m = size * 0.8;
        const tw = g.measureText(text).width;
        const x = pos === 'br' ? im.width - tw - m : pos === 'bl' ? m : pos === 'tr' ? im.width - tw - m : pos === 'tl' ? m : (im.width - tw) / 2;
        const y = pos === 'br' || pos === 'bl' ? im.height - m : pos === 'tr' || pos === 'tl' ? size + m : im.height / 2;
        g.fillText(text, x, y);
      }
      g.globalAlpha = 1;
      return cv;
    };
    const preview = () => {
      if (!img) return;
      const cv = drawFit(apply(img), 900, 500);
      $('#wm-preview').innerHTML = '';
      $('#wm-preview').appendChild(cv);
    };
    bindFileZone(root, 'wm-zone', async (fs) => {
      files = fs;
      const { img: im } = await loadFromFile(fs[0]);
      img = im;
      preview();
    });
    $('#wm-op').oninput = () => { $('#wm-ov').textContent = $('#wm-op').value; preview(); };
    $('#wm-size').oninput = () => { $('#wm-sv').textContent = $('#wm-size').value; preview(); };
    ['#wm-text', '#wm-pos', '#wm-color'].forEach((s) => $(s).addEventListener('input', preview));
    $('#wm-run').onclick = async () => {
      if (!files.length) return toast('请选择图片', 'err');
      for (const f of files) {
        const { img: im } = await loadFromFile(f);
        const cv = apply(im);
        const b = await canvasBlob(cv);
        download(f.name.replace(/\.\w+$/, '') + '-wm.png', b);
      }
    };
  },

  /* ================= 滤镜 ================= */
  'image-filter'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          ${fileZone('ft-zone', { accept: 'image/*', label: '选择图片' })}
          <div class="grid4" style="margin-top:10px">
            <div class="field"><label class="lab">亮度</label><input type="range" id="ft-bright" min="0" max="2" step="0.05" value="1"></div>
            <div class="field"><label class="lab">对比度</label><input type="range" id="ft-contrast" min="0" max="2" step="0.05" value="1"></div>
            <div class="field"><label class="lab">饱和度</label><input type="range" id="ft-sat" min="0" max="2" step="0.05" value="1"></div>
            <div class="field"><label class="lab">模糊 px</label><input type="range" id="ft-blur" min="0" max="20" step="0.5" value="0"></div>
            <div class="field"><label class="lab">灰度</label><input type="range" id="ft-gray" min="0" max="1" step="0.05" value="0"></div>
            <div class="field"><label class="lab">棕褐</label><input type="range" id="ft-sepia" min="0" max="1" step="0.05" value="0"></div>
            <div class="field"><label class="lab">反色</label><input type="range" id="ft-invert" min="0" max="1" step="0.05" value="0"></div>
            <div class="field"><label class="lab">像素化</label><input type="range" id="ft-pixel" min="0" max="30" step="1" value="0"></div>
          </div>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="ft-run">应用并下载</button><button class="btn" id="ft-reset">重置</button><button class="btn" id="ft-preset" data-p="mono">黑白</button><button class="btn" id="ft-preset2" data-p="warm">暖色</button></div>
        </div>
        <div class="panel"><div class="canvas-wrap" id="ft-preview"><div class="hint">选择图片后预览</div></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let img = null, file = null;
    const filterCss = () => `brightness(${v('ft-bright')}) contrast(${v('ft-contrast')}) saturate(${v('ft-sat')}) blur(${v('ft-blur')}px) grayscale(${v('ft-gray')}) sepia(${v('ft-sepia')}) invert(${v('ft-invert')})`;
    function v(id) { return document.getElementById(id).value; }
    const paint = () => {
      if (!img) return;
      const maxW = 900;
      const cv = document.createElement('canvas');
      const scale = Math.min(1, maxW / img.width);
      cv.width = img.width * scale; cv.height = img.height * scale;
      const g = cv.getContext('2d');
      g.filter = filterCss();
      g.drawImage(img, 0, 0, cv.width, cv.height);
      $('#ft-preview').innerHTML = '';
      $('#ft-preview').appendChild(cv);
    };
    bindFileZone(root, 'ft-zone', async (fs) => { file = fs[0]; const r = await loadFromFile(file); img = r.img; paint(); });
    $$(root, '#ft-preview').forEach(() => {});
    ['#ft-bright', '#ft-contrast', '#ft-sat', '#ft-blur', '#ft-gray', '#ft-sepia', '#ft-invert'].forEach((s) => $(s).addEventListener('input', paint));
    $('#ft-pixel').addEventListener('input', () => {
      const px = Number($('#ft-pixel').value);
      if (!img) return;
      const cv = document.createElement('canvas');
      const scale = Math.min(1, 900 / img.width);
      cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
      const g = cv.getContext('2d');
      g.filter = filterCss();
      if (px > 1) {
        const small = document.createElement('canvas');
        small.width = Math.max(1, Math.round(cv.width / px)); small.height = Math.max(1, Math.round(cv.height / px));
        const sg = small.getContext('2d');
        sg.filter = filterCss();
        sg.drawImage(img, 0, 0, small.width, small.height);
        g.imageSmoothingEnabled = false;
        g.drawImage(small, 0, 0, cv.width, cv.height);
      } else g.drawImage(img, 0, 0, cv.width, cv.height);
      $('#ft-preview').innerHTML = '';
      $('#ft-preview').appendChild(cv);
    });
    $('#ft-reset').onclick = () => {
      ['ft-bright', 'ft-contrast', 'ft-sat', 'ft-blur'].forEach((id) => document.getElementById(id).value = 1);
      ['ft-gray', 'ft-sepia', 'ft-invert'].forEach((id) => document.getElementById(id).value = 0);
      $('#ft-blur').value = 0; $('#ft-pixel').value = 0;
      paint();
    };
    $('#ft-preset').onclick = () => { $('#ft-gray').value = 1; paint(); };
    $('#ft-preset2').onclick = () => { $('#ft-sepia').value = 0.35; $('#ft-bright').value = 1.05; paint(); };
    $('#ft-run').onclick = async () => {
      if (!img) return toast('请选择图片', 'err');
      const px = Number($('#ft-pixel').value);
      const cv = document.createElement('canvas');
      cv.width = img.width; cv.height = img.height;
      const g = cv.getContext('2d');
      g.filter = filterCss();
      if (px > 1) {
        const small = document.createElement('canvas');
        small.width = Math.max(1, Math.round(img.width / px)); small.height = Math.max(1, Math.round(img.height / px));
        const sg = small.getContext('2d'); sg.filter = filterCss(); sg.drawImage(img, 0, 0, small.width, small.height);
        g.imageSmoothingEnabled = false; g.drawImage(small, 0, 0, img.width, img.height);
      } else g.drawImage(img, 0, 0);
      cv.toBlob((b) => download('filtered.png', b));
    };
  },

  /* ================= 九宫格与拼接 ================= */
  'image-grid'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="tabs" id="ig-tabs"><button class="tab active" data-i="0">九宫格切图</button><button class="tab" data-i="1">长图拼接</button></div>
          ${fileZone('ig-zone', { accept: 'image/*', multiple: true, label: '选择图片（切图 1 张，拼接可多张）' })}
          <div class="row" style="margin-top:10px"><button class="btn primary" id="ig-run">生成</button><button class="btn" id="ig-zip">打包 ZIP</button><span class="hint" id="ig-meta"></span></div>
        </div>
        <div class="panel"><div class="thumbs" id="ig-preview"><div class="hint">选择图片后显示</div></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let files = [], mode = 0, outputs = [];
    $('#ig-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      mode = Number(b.dataset.i);
      root.querySelectorAll('#ig-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
    });
    bindFileZone(root, 'ig-zone', (fs) => { files = fs; $('#ig-meta').textContent = `${fs.length} 张图片`; });
    $('#ig-run').onclick = async () => {
      if (!files.length) return toast('请选择图片', 'err');
      outputs = [];
      if (mode === 0) {
        const { img } = await loadFromFile(files[0]);
        const size = Math.min(img.width, img.height);
        const offX = (img.width - size) / 2, offY = (img.height - size) / 2;
        const tile = Math.floor(size / 3);
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
          const cv = document.createElement('canvas');
          cv.width = tile; cv.height = tile;
          cv.getContext('2d').drawImage(img, offX + c * tile, offY + r * tile, tile, tile, 0, 0, tile, tile);
          const b = await canvasBlob(cv);
          outputs.push({ name: `grid-${r + 1}-${c + 1}.png`, blob: b, url: URL.createObjectURL(b) });
        }
      } else {
        const imgs = [];
        for (const f of files) { const r = await loadFromFile(f); imgs.push(r.img); }
        const W = Math.min(...imgs.map((i) => i.width));
        const parts = imgs.map((i) => { const h = Math.round(i.height * W / i.width); return { i, h }; });
        const H = parts.reduce((s, p) => s + p.h, 0);
        const cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        const g = cv.getContext('2d');
        let y = 0;
        for (const p of parts) { g.drawImage(p.i, 0, y, W, p.h); y += p.h; }
        const b = await canvasBlob(cv);
        outputs.push({ name: 'long-image.png', blob: b, url: URL.createObjectURL(b) });
      }
      $('#ig-preview').innerHTML = outputs.map((o) => `<div class="thumb" style="aspect-ratio:auto"><img src="${o.url}" alt=""><a class="btn sm" href="${o.url}" download="${o.name}" style="position:absolute;right:5px;bottom:5px">下载</a></div>`).join('');
      $('#ig-meta').textContent = `${outputs.length} 个文件`;
    };
    $('#ig-zip').onclick = async () => {
      if (!outputs.length) return toast('先生成图片', 'err');
      const { loadDeps } = await import('../core/deps.js');
      await loadDeps(['jszip']);
      const zip = new window.JSZip();
      outputs.forEach((o) => zip.file(o.name, o.blob));
      download('images.zip', await zip.generateAsync({ type: 'blob' }));
    };
  },

  /* ================= 图片信息 ================= */
  'image-info'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">${fileZone('ii-zone', { accept: 'image/*', label: '选择图片查看详细信息' })}</div>
        <div class="grid2">
          <div class="panel"><div class="panel-head"><b>基本信息</b></div><div id="ii-info" class="kv"><div class="hint">尚未选择图片</div></div></div>
          <div class="panel"><div class="panel-head"><b>RGB 直方图</b></div><div class="canvas-wrap"><canvas id="ii-hist" width="360" height="160"></canvas></div></div>
        </div>
        <div class="panel"><div class="panel-head"><b>预览</b></div><div class="canvas-wrap" id="ii-preview"><div class="hint">预览区域</div></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    bindFileZone(root, 'ii-zone', async (files) => {
      const f = files[0];
      const { img, url } = await loadFromFile(f);
      $('#ii-info').innerHTML = `<dt>文件名</dt><dd>${esc(f.name)}</dd><dt>类型</dt><dd>${esc(f.type || '未知')}</dd><dt>尺寸</dt><dd>${img.width} × ${img.height}</dd><dt>文件大小</dt><dd>${fmtBytes(f.size)}</dd><dt>宽高比</dt><dd>${(img.width / img.height).toFixed(4)}</dd><dt>像素总数</dt><dd>${(img.width * img.height).toLocaleString()}</dd><dt>修改时间</dt><dd>${new Date(f.lastModified).toLocaleString()}</dd>`;
      $('#ii-preview').innerHTML = `<img src="${url}" alt="预览">`;
      const cv = document.createElement('canvas');
      const scale = Math.min(1, 400 / img.width);
      cv.width = img.width * scale; cv.height = img.height * scale;
      const g = cv.getContext('2d');
      g.drawImage(img, 0, 0, cv.width, cv.height);
      const data = g.getImageData(0, 0, cv.width, cv.height).data;
      const hist = { r: new Array(256).fill(0), g: new Array(256).fill(0), b: new Array(256).fill(0) };
      for (let i = 0; i < data.length; i += 4) { hist.r[data[i]]++; hist.g[data[i + 1]]++; hist.b[data[i + 2]]++; }
      const hc = $('#ii-hist'), hg = hc.getContext('2d');
      hg.clearRect(0, 0, hc.width, hc.height);
      const max = Math.max(...hist.r, ...hist.g, ...hist.b);
      [['r', '#fb7185'], ['g', '#34d399'], ['b', '#38cdf0']].forEach(([k, color]) => {
        hg.beginPath(); hg.strokeStyle = color; hg.globalAlpha = 0.75;
        hist[k].forEach((v, i) => { const x = i / 255 * hc.width, y = hc.height - v / max * hc.height; i ? hg.lineTo(x, y) : hg.moveTo(x, y); });
        hg.stroke(); hg.globalAlpha = 1;
      });
    });
  },

  /* ================= 图片 Base64 ================= */
  'image-base64'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="ib-tabs"><button class="tab active" data-i="0">图片 → Base64</button><button class="tab" data-i="1">Base64 → 图片</button></div>
        <div class="panel" id="ib-p0">
          ${fileZone('ib-zone', { accept: 'image/*', label: '选择图片' })}
          <div class="field" style="margin-top:9px"><label class="lab">输出</label><select class="sel" id="ib-mode" style="max-width:200px"><option value="raw">纯 Base64</option><option value="data">Data URL</option><option value="css">CSS background</option></select></div>
          <div class="row" style="margin-top:9px"><button class="btn" id="ib-copy">复制</button><span class="hint" id="ib-meta"></span></div>
          <pre class="out" id="ib-out" style="margin-top:9px;max-height:220px"></pre>
        </div>
        <div class="panel hidden" id="ib-p1">
          <textarea class="ta mono" id="ib-src" rows="6" placeholder="粘贴 Base64 或 data:image/..."></textarea>
          <button class="btn primary" id="ib-show" style="margin-top:9px">预览</button>
          <div class="canvas-wrap" id="ib-preview" style="margin-top:9px"><div class="hint">预览区域</div></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#ib-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#ib-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      $('#ib-p0').classList.toggle('hidden', b.dataset.i !== '0');
      $('#ib-p1').classList.toggle('hidden', b.dataset.i !== '1');
    });
    bindFileZone(root, 'ib-zone', async (files) => {
      const f = files[0];
      const dataUrl = await readAs(f, 'dataurl');
      const raw = dataUrl.split(',')[1];
      const mode = $('#ib-mode').value;
      $('#ib-out').textContent = mode === 'raw' ? raw : mode === 'css' ? `background-image: url("${dataUrl}");` : dataUrl;
      $('#ib-meta').textContent = `${fmtBytes(f.size)} · Base64 ${fmtBytes(raw.length)}`;
    });
    $('#ib-mode').addEventListener('change', () => $('#ib-zone').click());
    $('#ib-copy').onclick = () => copy($('#ib-out').textContent);
    $('#ib-show').onclick = () => {
      const s = $('#ib-src').value.trim();
      const url = s.startsWith('data:') ? s : 'data:image/png;base64,' + s;
      $('#ib-preview').innerHTML = `<img src="${url}" alt="预览">`;
    };
  },

  /* ================= 图片转 ASCII ================= */
  'image-ascii'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          ${fileZone('ia-zone', { accept: 'image/*', label: '选择图片' })}
          <div class="grid3" style="margin-top:10px">
            <div class="field"><label class="lab">字符宽度</label><input class="inp" id="ia-w" type="number" value="100"></div>
            <div class="field"><label class="lab">字符集</label><select class="sel" id="ia-charset"><option value="standard">标准</option><option value="blocks">方块</option><option value="minimal">极简</option></select></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="ia-run" style="width:100%">生成</button></div>
          </div>
          <div class="row" style="margin-top:9px"><button class="btn" id="ia-copy">复制</button><button class="btn" id="ia-dl">下载 TXT</button></div>
        </div>
        <div class="panel"><pre class="out" id="ia-out" style="font-family:monospace;white-space:pre;line-height:1.05;max-height:600px;overflow:auto">选择图片后生成字符画</pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let img = null;
    bindFileZone(root, 'ia-zone', async (fs) => { img = (await loadFromFile(fs[0])).img; });
    $('#ia-run').onclick = () => {
      if (!img) return toast('请选择图片', 'err');
      const width = Math.max(20, Math.min(220, Number($('#ia-w').value) || 100));
      const cs = $('#ia-charset').value === 'blocks' ? ' .:-=+*#%@' : $('#ia-charset').value === 'minimal' ? ' .:+#' : ' .,:;irsXA253hMHGS#9B&@';
      const height = Math.round(width * img.height / img.width * 0.5);
      const cv = document.createElement('canvas');
      cv.width = width; cv.height = height;
      const g = cv.getContext('2d');
      g.drawImage(img, 0, 0, width, height);
      const data = g.getImageData(0, 0, width, height).data;
      let out = '';
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
          out += cs[Math.min(cs.length - 1, Math.floor((1 - lum) * cs.length))];
        }
        out += '\n';
      }
      $('#ia-out').textContent = out;
    };
    $('#ia-copy').onclick = () => copy($('#ia-out').textContent);
    $('#ia-dl').onclick = () => download('ascii-art.txt', $('#ia-out').textContent, 'text/plain');
  },

  /* ================= 图片转 PDF ================= */
  'image-pdf'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>图片转 PDF</b><span class="hint">支持多张图片，按选择顺序排列</span></div>
          ${fileZone('ip-zone', { accept: 'image/*', multiple: true, label: '选择一张或多张图片' })}
          <div class="grid3" style="margin-top:10px">
            <div class="field"><label class="lab">页面</label><select class="sel" id="ip-size"><option value="fit">适应图片</option><option value="a4">A4</option></select></div>
            <div class="field"><label class="lab">边距 px</label><input class="inp" id="ip-margin" type="number" value="0"></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="ip-run" style="width:100%">生成 PDF</button></div>
          </div>
          <div class="hint" id="ip-info" style="margin-top:8px">尚未选择图片</div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let files = [];
    bindFileZone(root, 'ip-zone', (f) => { files = f; $('#ip-info').textContent = `${f.length} 张图片 · ${fmtBytes(f.reduce((s, x) => s + x.size, 0))}`; });
    $('#ip-run').onclick = async () => {
      if (!files.length) return toast('请选择图片', 'err');
      try {
        await ctx.deps(['pdflib']);
        const { PDFDocument } = window.PDFLib;
        const pdf = await PDFDocument.create();
        const margin = Number($('#ip-margin').value) || 0;
        for (const f of files) {
          const bytes = await toPngBytes(f);
          const img = await pdf.embedPng(bytes);
          let pw = img.width + margin * 2, ph = img.height + margin * 2;
          if ($('#ip-size').value === 'a4') {
            const A4 = [595.28, 841.89];
            const landscape = img.width > img.height;
            [pw, ph] = landscape ? [A4[1], A4[0]] : A4;
          }
          const page = pdf.addPage([pw, ph]);
          const scale = Math.min((pw - margin * 2) / img.width, (ph - margin * 2) / img.height);
          page.drawImage(img, { x: (pw - img.width * scale) / 2, y: (ph - img.height * scale) / 2, width: img.width * scale, height: img.height * scale });
        }
        const bytes = await pdf.save();
        download('images.pdf', new Blob([bytes], { type: 'application/pdf' }));
      } catch (e) { toast('生成失败：' + e.message, 'err'); }
    };
  },

  /* ================= PDF 转图片 ================= */
  'pdf-image'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>PDF 转图片</b><span class="hint">逐页渲染，可下载当前页或全部</span></div>
          ${fileZone('pi-zone', { accept: 'application/pdf', label: '选择 PDF 文件' })}
          <div class="grid3" style="margin-top:10px">
            <div class="field"><label class="lab">缩放</label><input class="inp" id="pi-scale" type="number" step="0.5" value="2"></div>
            <div class="field"><label class="lab">格式</label><select class="sel" id="pi-fmt"><option value="image/png">PNG</option><option value="image/jpeg">JPEG</option></select></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="pi-run" style="width:100%">渲染</button></div>
          </div>
          <div class="row" style="margin-top:9px"><button class="btn" id="pi-all">下载全部</button><span class="hint" id="pi-info">尚未选择 PDF</span></div>
        </div>
        <div class="panel"><div id="pi-pages" class="thumbs"><div class="hint">渲染结果显示在这里</div></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let file = null, pages = [];
    bindFileZone(root, 'pi-zone', (fs) => { file = fs[0]; $('#pi-info').textContent = `${file.name} · ${fmtBytes(file.size)}`; });
    $('#pi-run').onclick = async () => {
      if (!file) return toast('请选择 PDF', 'err');
      try {
        await ctx.deps(['pdfjs']);
        const pdfjs = window.pdfjsLib;
        pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
        const data = await readAs(file, 'arraybuffer');
        const doc = await pdfjs.getDocument({ data }).promise;
        const scale = Math.max(0.5, Math.min(4, Number($('#pi-scale').value) || 2));
        pages = [];
        $('#pi-pages').innerHTML = '';
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale });
          const cv = document.createElement('canvas');
          cv.width = viewport.width; cv.height = viewport.height;
          await page.render({ canvasContext: cv.getContext('2d'), viewport }).promise;
          const blob = await canvasBlob(cv, $('#pi-fmt').value, 0.92);
          pages.push({ blob, url: URL.createObjectURL(blob), w: cv.width, h: cv.height });
          const div = document.createElement('div');
          div.className = 'thumb';
          div.style.aspectRatio = 'auto';
          div.innerHTML = `<img src="${pages[i - 1].url}" alt=""><a class="btn sm" href="${pages[i - 1].url}" download="page-${i}.${$('#pi-fmt').value === 'image/png' ? 'png' : 'jpg'}" style="position:absolute;right:5px;bottom:5px">下载</a>`;
          $('#pi-pages').appendChild(div);
        }
        $('#pi-info').textContent = `${doc.numPages} 页 · ${pages[0]?.w}×${pages[0]?.h}`;
      } catch (e) { toast('渲染失败：' + e.message, 'err'); }
    };
    $('#pi-all').onclick = () => {
      if (!pages.length) return toast('先渲染 PDF', 'err');
      pages.forEach((p, i) => setTimeout(() => download(`page-${i + 1}.${$('#pi-fmt').value === 'image/png' ? 'png' : 'jpg'}`, p.blob), i * 150));
    };
  },

  /* ================= OCR ================= */
  'image-ocr'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>图片 OCR</b><span class="hint">Tesseract.js 本地识别；首次会下载语言包</span></div>
          ${fileZone('oc-zone', { accept: 'image/*', label: '选择带有文字的图片' })}
          <div class="grid3" style="margin-top:10px">
            <div class="field"><label class="lab">语言</label><select class="sel" id="oc-lang"><option value="chi_sim+eng">中文 + 英文</option><option value="eng">英文</option><option value="chi_tra+eng">繁体中文 + 英文</option></select></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="oc-run" style="width:100%">开始识别</button></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn" id="oc-copy" style="width:100%">复制</button></div>
          </div>
          <div class="progress" style="margin-top:11px"><i id="oc-bar" style="width:0%"></i></div>
          <div class="hint" id="oc-status" style="margin-top:6px">等待开始</div>
        </div>
        <div class="panel"><pre class="out" id="oc-out" style="max-height:420px">识别结果会显示在这里</pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let file = null;
    bindFileZone(root, 'oc-zone', (fs) => { file = fs[0]; $('#oc-status').textContent = `${file.name} · ${fmtBytes(file.size)}`; });
    $('#oc-run').onclick = async () => {
      if (!file) return toast('请选择图片', 'err');
      try {
        await ctx.deps(['tesseract']);
        $('#oc-status').textContent = '初始化识别引擎…';
        const worker = await window.Tesseract.createWorker($('#oc-lang').value, 1, {
          logger: (m) => {
            if (m.progress != null) {
              $('#oc-bar').style.width = Math.round(m.progress * 100) + '%';
              $('#oc-status').textContent = `${m.status || '处理中'} ${Math.round(m.progress * 100)}%`;
            }
          }
        });
        const { data } = await worker.recognize(file);
        $('#oc-out').textContent = data.text.trim() || '没有识别到文字';
        $('#oc-status').textContent = `识别完成 · 置信度 ${(data.confidence || 0).toFixed(1)}%`;
        await worker.terminate();
      } catch (e) {
        $('#oc-status').textContent = '识别失败：' + e.message;
      }
    };
    $('#oc-copy').onclick = () => copy($('#oc-out').textContent);
  },

  /* ================= 图片对比 ================= */
  'image-diff'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="grid2">
            <div>${fileZone('df-zone1', { accept: 'image/*', label: '图片 A' })}</div>
            <div>${fileZone('df-zone2', { accept: 'image/*', label: '图片 B' })}</div>
          </div>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="df-run">对比</button><label class="row" style="gap:5px"><input type="checkbox" id="df-diffonly"> 只显示差异</label></div>
        </div>
        <div class="panel"><div class="canvas-wrap" id="df-out"><div class="hint">选择两张尺寸相同的图片</div></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const imgs = [null, null];
    bindFileZone(root, 'df-zone1', async (fs) => { imgs[0] = (await loadFromFile(fs[0])).img; });
    bindFileZone(root, 'df-zone2', async (fs) => { imgs[1] = (await loadFromFile(fs[0])).img; });
    $('#df-run').onclick = () => {
      if (!imgs[0] || !imgs[1]) return toast('请选择两张图片', 'err');
      const w = Math.max(imgs[0].width, imgs[1].width), h = Math.max(imgs[0].height, imgs[1].height);
      const c1 = document.createElement('canvas'), c2 = document.createElement('canvas');
      c1.width = c2.width = w; c1.height = c2.height = h;
      c1.getContext('2d').drawImage(imgs[0], 0, 0);
      c2.getContext('2d').drawImage(imgs[1], 0, 0);
      const d1 = c1.getContext('2d').getImageData(0, 0, w, h);
      const d2 = c2.getContext('2d').getImageData(0, 0, w, h);
      const out = document.createElement('canvas');
      out.width = w; out.height = h;
      const og = out.getContext('2d');
      const od = og.createImageData(w, h);
      let diff = 0;
      const only = $('#df-diffonly').checked;
      for (let i = 0; i < d1.data.length; i += 4) {
        const delta = Math.abs(d1.data[i] - d2.data[i]) + Math.abs(d1.data[i + 1] - d2.data[i + 1]) + Math.abs(d1.data[i + 2] - d2.data[i + 2]);
        if (delta > 30) {
          diff++;
          od.data[i] = 255; od.data[i + 1] = 40; od.data[i + 2] = 90; od.data[i + 3] = 255;
        } else if (!only) {
          od.data[i] = d1.data[i] * 0.45; od.data[i + 1] = d1.data[i + 1] * 0.45; od.data[i + 2] = d1.data[i + 2] * 0.45; od.data[i + 3] = 255;
        }
      }
      og.putImageData(od, 0, 0);
      $('#df-out').innerHTML = '';
      $('#df-out').appendChild(out);
      $('#df-out').insertAdjacentHTML('beforeend', `<div class="hint" style="padding:6px">差异像素：${diff.toLocaleString()} / ${(w * h).toLocaleString()}（${(diff / (w * h) * 100).toFixed(2)}%）</div>`);
    };
  },

  /* ================= 证件照 ================= */
  'image-idphoto'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          ${fileZone('id-zone', { accept: 'image/*', label: '选择人像照片' })}
          <div class="grid4" style="margin-top:10px">
            <div class="field"><label class="lab">尺寸</label><select class="sel" id="id-size"><option value="295x413">一寸 295×413</option><option value="413x579">二寸 413×579</option><option value="390x567">小二寸 390×567</option><option value="600x600">方形头像 600×600</option><option value="600x600a">护照 600×600</option></select></div>
            <div class="field"><label class="lab">背景</label><input type="color" id="id-bg" value="#ffffff"></div>
            <div class="field"><label class="lab">缩放</label><input type="range" id="id-zoom" min="0.5" max="2" step="0.01" value="1"></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="id-run" style="width:100%">生成</button></div>
          </div>
          <div class="row" style="margin-top:9px"><label class="row" style="gap:5px"><input type="checkbox" id="id-round"> 圆形头像</label><button class="btn" id="id-dl">下载 PNG</button></div>
        </div>
        <div class="panel"><div class="canvas-wrap" id="id-preview"><div class="hint">选择照片后预览</div></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let img = null;
    bindFileZone(root, 'id-zone', async (fs) => { img = (await loadFromFile(fs[0])).img; draw(); });
    const draw = () => {
      if (!img) return;
      const [w, h] = $('#id-size').value.replace('a', '').split('x').map(Number);
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const g = cv.getContext('2d');
      g.fillStyle = $('#id-bg').value;
      g.fillRect(0, 0, w, h);
      const zoom = Number($('#id-zoom').value);
      const scale = Math.max(w / img.width, h / img.height) * zoom;
      const dw = img.width * scale, dh = img.height * scale;
      g.save();
      if ($('#id-round').checked) { g.beginPath(); g.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2); g.clip(); }
      g.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      g.restore();
      $('#id-preview').innerHTML = '';
      cv.style.maxWidth = '260px';
      $('#id-preview').appendChild(cv);
      cv.dataset.ready = '1';
      $('#id-preview').append(`<div class="hint">${w} × ${h} px</div>`);
    };
    ['#id-size', '#id-bg', '#id-zoom', '#id-round'].forEach((s) => $(s).addEventListener('input', draw));
    $('#id-run').onclick = draw;
    $('#id-dl').onclick = () => {
      const cv = $('#id-preview canvas');
      if (cv) cv.toBlob((b) => download('id-photo.png', b));
      else toast('先生成', 'err');
    };
  }
};
