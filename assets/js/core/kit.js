/* 工具页面通用组件 */
import { copy, toast, esc } from './ui.js';

export function bench(root, o = {}) {
  const {
    title = '输入', rows = 9, placeholder = '', value = '',
    options = '', action = '运行', outTitle = '结果', hint = '', mono = true, stack = false
  } = o;
  root.innerHTML = `<div class="tool-ui">
    <div class="grid2${stack ? ' stack' : ''}">
      <div class="panel">
        <div class="panel-head"><b>${esc(title)}</b>${hint ? `<span class="hint">${hint}</span>` : ''}</div>
        ${options}
        <textarea id="bench-in" class="ta ${mono ? 'mono' : ''}" rows="${rows}" placeholder="${esc(placeholder)}">${esc(value)}</textarea>
        <div class="row" style="margin-top:10px">
          <button class="btn primary" id="bench-run">${esc(action)}</button>
          <button class="btn" id="bench-copy">复制结果</button>
          <button class="btn ghost" id="bench-clear">清空</button>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><b>${esc(outTitle)}</b><span class="hint" id="bench-meta"></span></div>
        <pre class="out" id="bench-out"></pre>
      </div>
    </div>
  </div>`;

  const $ = (s) => root.querySelector(s);
  const out = $('#bench-out');
  const api = {
    root, input: $('#bench-in'), out, els: (s) => root.querySelector(s),
    set(t) { out.textContent = t == null ? '' : String(t); },
    setHtml(h) { out.innerHTML = h; },
    meta(t) { $('#bench-meta').textContent = t || ''; },
    get value() { return api.input.value; }
  };
  const run = () => {
    try {
      const r = o.run ? o.run(api) : null;
      if (r !== undefined) {
        if (r && typeof r === 'object' && r.html) api.setHtml(r.html);
        else api.set(r);
      }
    } catch (e) {
      api.set('出错了：' + e.message);
    }
  };
  $('#bench-run').onclick = run;
  $('#bench-copy').onclick = () => out.textContent.trim() ? copy(out.textContent) : toast('还没有结果');
  $('#bench-clear').onclick = () => { api.input.value = ''; api.set(''); api.meta(''); };
  if (o.live) api.input.addEventListener('input', run);
  if (o.autoRun && value) run();
  return api;
}

export function tabsHtml(id, items, active = 0) {
  return `<div class="tabs" id="${id}">${items.map((it, i) =>
    `<button class="tab${i === active ? ' active' : ''}" data-i="${i}">${esc(typeof it === 'string' ? it : it.label)}</button>`).join('')}</div>`;
}

export function bindTabs(root, id, onChange) {
  const box = root.querySelector('#' + id);
  if (!box) return;
  box.addEventListener('click', (e) => {
    const b = e.target.closest('.tab');
    if (!b) return;
    box.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === b));
    onChange(Number(b.dataset.i), b);
  });
}

export function fileZone(id, { accept = '', multiple = false, label = '点击选择文件，或拖拽到这里', sub = '文件只在本地处理，不会上传' } = {}) {
  return `<div class="drop" id="${id}" data-accept="${accept}" data-multiple="${multiple ? 1 : 0}">
    <svg viewBox="0 0 24 24"><path d="M12 16V4m0 0L7 9m5-5 5 5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <div><b>${esc(label)}</b></div><div style="margin-top:3px">${esc(sub)}</div>
  </div>`;
}

export function bindFileZone(root, id, onFiles) {
  const el = root.querySelector('#' + id);
  if (!el) return;
  const accept = el.dataset.accept || '';
  const multiple = el.dataset.multiple === '1';
  ['dragenter', 'dragover'].forEach((ev) => el.addEventListener(ev, (e) => { e.preventDefault(); el.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => el.addEventListener(ev, (e) => { e.preventDefault(); el.classList.remove('over'); }));
  el.addEventListener('drop', (e) => {
    const files = [...(e.dataTransfer?.files || [])];
    if (files.length) onFiles(files);
  });
  el.addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = accept;
    inp.multiple = multiple;
    inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.addEventListener('change', () => { const f = [...inp.files]; inp.remove(); if (f.length) onFiles(f); });
    inp.addEventListener('cancel', () => inp.remove());
    inp.click();
  });
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = src;
  });
}

export function canvasBlob(canvas, type = 'image/png', quality = 0.92) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export function setOut(root, id, text) {
  const el = root.querySelector('#' + id);
  if (el) el.textContent = text;
}

export function toggleClass(el, cls, on) {
  el.classList.toggle(cls, !!on);
}

export function warn(text) {
  return `<div class="warnbox">${text}</div>`;
}
