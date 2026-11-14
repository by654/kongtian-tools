/* 文件转换面板：本站原生界面，直接调用内置转换引擎，不嵌套任何子站页面 */
import {
  CATEGORY_MAP, categoryFromExt, defaultTarget, defaultParamsFor,
  paramDescriptors, targetOf,
} from './engine/registry.js';
import { runJob } from './engine/dispatch.js';
import { esc, fmtBytes, toast, download } from '../core/ui.js';
import { fileZone, bindFileZone } from '../core/kit.js';

const CVS_CSS = [
  '.cvp{display:flex;flex-direction:column;gap:14px}',
  '.cvp-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}',
  '.cvp-params{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}',
  '.cvp-params:empty{display:none}',
  '.cvp-params .hint{margin:0;font-size:13px;opacity:.65}',
  '.cvp-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px}',
  '.cvp-tip{font-size:13px;opacity:.7}',
  '.cvp-list{display:flex;flex-direction:column;gap:8px}',
  '.cvp-list:empty{display:none}',
  '.cvp-item{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:10px 12px;border:1px solid rgba(128,150,180,.22);border-radius:10px;background:rgba(128,150,180,.06)}',
  '.cvp-item .nm{flex:1 1 220px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}',
  '.cvp-item .st{font-size:12px;opacity:.75;white-space:nowrap}',
  '.cvp-item.ok{border-color:rgba(74,222,128,.45)}',
  '.cvp-item.err{border-color:rgba(248,113,113,.5)}',
  '.cvp-item.err .st{color:#f87171;opacity:1}',
  '.cvp-out{display:flex;flex-wrap:wrap;gap:6px;width:100%}',
  '.cvp-x{border:none;background:transparent;cursor:pointer;font-size:15px;line-height:1;opacity:.5;padding:2px 4px}',
  '.cvp-x:hover{opacity:1}',
  '.cvp .field-range .val{font-size:13px;opacity:.8;margin-left:6px}',
].join('');

function injectStyle() {
  if (document.getElementById('cvp-style')) return;
  const s = document.createElement('style');
  s.id = 'cvp-style';
  s.textContent = CVS_CSS;
  document.head.appendChild(s);
}

const extOf = (name) => {
  const m = /\.([a-z0-9]+)$/i.exec(name || '');
  return m ? m[1].toLowerCase() : '';
};

function optionsHtml(src, selected) {
  return (src || []).map(([v, label]) => (
    '<option value="' + esc(v) + '"' + (String(v) === String(selected) ? ' selected' : '') + '>' + esc(label) + '</option>'
  )).join('');
}

function targetOptionsHtml(cat, selected) {
  const groups = new Map();
  for (const t of cat.targets || []) {
    if (!t || t.disabled) continue;
    const g = t.group || '输出格式';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(t);
  }
  let html = '';
  for (const [g, list] of groups) {
    html += '<optgroup label="' + esc(g) + '">' + list.map((t) => (
      '<option value="' + esc(t.id) + '"' + (t.id === selected ? ' selected' : '') + '>' + esc(t.label || t.id) + (t.partial ? '（部分）' : '') + '</option>'
    )).join('') + '</optgroup>';
  }
  if (!html) html = '<option value="">（该类别暂无输出格式）</option>';
  return html;
}

function controlHtml(d, value) {
  const label = esc(d.label || d.id);
  const help = d.help ? '<small class="hint">' + esc(d.help) + '</small>' : '';
  const base = ' data-cvp="' + esc(d.id) + '"';
  if (d.type === 'select') {
    return '<label class="field">' + label + '<select class="inp"' + base + '>' + optionsHtml(d.options, value) + '</select>' + help + '</label>';
  }
  if (d.type === 'range') {
    return '<label class="field field-range">' + label + '<span class="val" data-val="' + esc(d.id) + '">' + esc(String(value)) + '</span>'
      + '<input class="inp" type="range"' + base
      + ' min="' + (d.min != null ? d.min : 0) + '" max="' + (d.max != null ? d.max : 100) + '"'
      + ' step="' + (d.step != null ? d.step : 1) + '" value="' + esc(String(value)) + '">' + help + '</label>';
  }
  if (d.type === 'color') {
    return '<label class="field field-color">' + label + '<input class="inp" type="color"' + base + ' value="' + esc(String(value)) + '">' + help + '</label>';
  }
  if (d.type === 'number') {
    return '<label class="field">' + label + '<input class="inp" type="number"' + base
      + ' value="' + esc(String(value)) + '"'
      + (d.min != null ? ' min="' + d.min + '"' : '') + (d.max != null ? ' max="' + d.max + '"' : '')
      + (d.step != null ? ' step="' + d.step + '"' : '') + '>' + help + '</label>';
  }
  if (d.type === 'checkbox' || d.type === 'switch') {
    return '<label class="field">' + label + '<input type="checkbox"' + base + (value ? ' checked' : '') + '>' + help + '</label>';
  }
  return '<label class="field">' + label + '<input class="inp" type="text"' + base + ' value="' + esc(String(value)) + '">' + help + '</label>';
}

function renderParamsHtml(descriptors, values) {
  if (!descriptors || !descriptors.length) return '<p class="hint">该输出格式无需额外参数。</p>';
  return descriptors.map((d) => controlHtml(d, values[d.id] !== undefined ? values[d.id] : d.default)).join('');
}

function readParams(scope, base) {
  const out = Object.assign({}, base);
  scope.querySelectorAll('[data-cvp]').forEach((el) => {
    const k = el.getAttribute('data-cvp');
    if (!(k in out)) return;
    const cur = out[k];
    if (typeof cur === 'boolean') out[k] = !!el.checked;
    else if (typeof cur === 'number') {
      const n = Number(el.value);
      out[k] = Number.isFinite(n) ? n : cur;
    } else out[k] = el.value;
  });
  return out;
}

/**
 * 挂载原生转换面板
 * @param {HTMLElement} root 容器
 * @param {{onDestroy:Function}} ctx 工具上下文
 * @param {{catId?:string, target?:string, hint?:string, sub?:string, auto?:boolean}} opt
 */
export function mountConvert(root, ctx, opt) {
  injectStyle();
  const o = opt || {};
  const auto = !!o.auto || !o.catId;
  const cat = auto ? null : CATEGORY_MAP[o.catId];
  if (!auto && !cat) {
    root.innerHTML = '<p class="hint">该转换类别不可用。</p>';
    return;
  }
  const files = [];
  let seq = 0;
  let target = o.target || (cat ? defaultTarget(cat.id) : '');
  if (cat && !targetOf(cat.id, target)) target = defaultTarget(cat.id);
  let busy = false;
  let lastPaint = 0;

  const zoneId = 'cvp-zone-' + Math.random().toString(36).slice(2, 8);
  const accept = auto ? '' : (cat.exts || []).map((e) => '.' + e).join(',');
  const sub = auto
    ? '自动识别文件类别并转为该类别默认输出格式'
    : (o.sub || (cat.hint ? cat.hint : '文件只在本机浏览器里处理，不会上传到任何服务器'));

  root.innerHTML =
    '<div class="cvp">'
    + fileZone(zoneId, { accept, multiple: true, label: '点击选择文件，或拖拽到这里', sub })
    + (auto ? '' : '<div class="cvp-opts" id="cvp-opts"></div><div class="cvp-params" id="cvp-params"></div>')
    + '<div class="cvp-bar">'
    + '<button class="btn primary" type="button" id="cvp-run">开始转换</button>'
    + '<button class="btn ghost sm" type="button" id="cvp-clear">清空列表</button>'
    + '<span class="cvp-tip" id="cvp-tip">' + (o.tip || '') + '</span>'
    + '</div>'
    + '<div class="cvp-list" id="cvp-list"></div>'
    + '</div>';

  const optsBox = root.querySelector('#cvp-opts');
  const paramsBox = root.querySelector('#cvp-params');
  const listBox = root.querySelector('#cvp-list');
  const tipBox = root.querySelector('#cvp-tip');
  const runBtn = root.querySelector('#cvp-run');

  function baseParams() {
    if (auto) return {};
    const sample = files.find((f) => f.status !== 'done');
    const ext = sample ? extOf(sample.file.name) : '';
    return defaultParamsFor(cat.id, target, ext);
  }

  function paintOpts() {
    if (auto || !optsBox) return;
    optsBox.innerHTML = '<label class="field">输出格式<select class="inp" id="cvp-target">'
      + targetOptionsHtml(cat, target) + '</select></label>';
    paintParams(baseParams());
  }

  function paintParams(values) {
    if (auto || !paramsBox) return;
    const sample = files.find((f) => f.status !== 'done');
    const ext = sample ? extOf(sample.file.name) : '';
    paramsBox.innerHTML = renderParamsHtml(paramDescriptors(cat.id, target, ext), values || baseParams());
  }

  function statusText(it) {
    if (it.status === 'idle') return fmtBytes(it.file.size);
    if (it.status === 'running') {
      const p = Math.round((it.progress || 0) * 100);
      return (it.stage ? it.stage + ' · ' : '') + p + '%';
    }
    if (it.status === 'done') return '已完成';
    if (it.status === 'error') return '失败：' + (it.error || '未知错误');
    return '';
  }

  function outputHtml(it) {
    if (!it.outputs || !it.outputs.length) return '';
    return '<div class="cvp-out">' + it.outputs.map((f, i) => (
      '<button class="btn sm" type="button" data-dl="' + it.id + ':' + i + '">下载 ' + esc(f.name)
      + (f.size ? ' · ' + fmtBytes(f.size) : '') + '</button>'
    )).join('') + '</div>';
  }

  function paint(force) {
    const now = Date.now();
    if (!force && now - lastPaint < 120) return;
    lastPaint = now;
    if (!listBox) return;
    listBox.innerHTML = files.map((it) => (
      '<div class="cvp-item ' + (it.status === 'done' ? 'ok' : it.status === 'error' ? 'err' : '') + '">'
      + '<span class="nm">' + esc(it.file.name) + '</span>'
      + '<span class="st">' + esc(statusText(it)) + '</span>'
      + (it.status === 'idle' ? '<button class="cvp-x" type="button" data-rm="' + it.id + '" title="移出列表">×</button>' : '')
      + outputHtml(it)
      + '</div>'
    )).join('');
  }

  function paintBar() {
    if (!runBtn) return;
    const pending = files.filter((f) => f.status === 'idle' || f.status === 'error').length;
    runBtn.disabled = busy || !pending || (!auto && !target);
    runBtn.textContent = busy ? '转换中…' : pending > 1 ? '开始转换（' + pending + '）' : '开始转换';
  }

  function addFiles(list) {
    const allow = auto ? null : (cat.exts || []);
    let skipped = 0;
    for (const f of list) {
      const ext = extOf(f.name);
      if (allow && allow.length && !allow.includes(ext)) { skipped += 1; continue; }
      files.push({ id: 'f' + (++seq), file: f, status: 'idle', progress: 0, stage: '', outputs: null, error: null });
    }
    if (skipped) toast('已跳过 ' + skipped + ' 个不支持的文件类型', 'warn');
    if (!files.length) return;
    paintParams(baseParams());
    paint(true);
    paintBar();
  }

  bindFileZone(root, zoneId, addFiles);

  root.addEventListener('change', (e) => {
    const el = e.target;
    if (!el) return;
    if (el.id === 'cvp-target') {
      target = el.value;
      paintParams(null);
      paint(true);
      paintBar();
      return;
    }
    const key = el.getAttribute && el.getAttribute('data-cvp');
    if (key) {
      const out = root.querySelector('[data-val="' + key + '"]');
      if (out) out.textContent = el.value;
    }
  });

  root.addEventListener('input', (e) => {
    const el = e.target;
    const key = el && el.getAttribute && el.getAttribute('data-cvp');
    if (!key) return;
    const out = root.querySelector('[data-val="' + key + '"]');
    if (out) out.textContent = el.value;
  });

  root.addEventListener('click', (e) => {
    const t = e.target.closest ? e.target.closest('[data-dl],[data-rm],#cvp-run,#cvp-clear') : null;
    if (!t) return;
    if (t.id === 'cvp-run') { start(); return; }
    if (t.id === 'cvp-clear') {
      if (busy) { toast('请等当前转换结束', 'warn'); return; }
      files.length = 0;
      paint(true);
      paintBar();
      return;
    }
    const dl = t.getAttribute('data-dl');
    if (dl) {
      const [fid, idx] = dl.split(':');
      const it = files.find((f) => f.id === fid);
      const f = it && it.outputs && it.outputs[Number(idx)];
      if (f) download(f.name, f.blob);
      return;
    }
    const rm = t.getAttribute('data-rm');
    if (rm) {
      const i = files.findIndex((f) => f.id === rm);
      if (i >= 0) files.splice(i, 1);
      paint(true);
      paintBar();
    }
  });

  async function start() {
    if (busy) return;
    const queue = files.filter((f) => f.status === 'idle' || f.status === 'error');
    if (!queue.length) { toast('没有待转换的文件', 'warn'); return; }
    const uiParams = auto ? {} : readParams(paramsBox, baseParams());
    busy = true;
    paintBar();
    let ok = 0;
    let fail = 0;
    for (const it of queue) {
      const ext = extOf(it.file.name);
      const catId = auto ? categoryFromExt(ext) : cat.id;
      const c = catId ? CATEGORY_MAP[catId] : null;
      if (!c) {
        it.status = 'error';
        it.error = '无法识别的文件类型' + (ext ? '（.' + ext + '）' : '');
        fail += 1;
        paint(true);
        continue;
      }
      const tg = auto ? defaultTarget(catId) : target;
      const params = auto ? defaultParamsFor(catId, tg, ext) : uiParams;
      it.status = 'running';
      it.progress = 0;
      it.stage = '准备中…';
      it.error = null;
      it.outputs = null;
      if (tipBox) tipBox.textContent = '正在处理 ' + it.file.name;
      paint(true);
      try {
        const outs = await runJob({
          category: catId, file: it.file, target: tg, ext, params,
        }, {
          isCancelled: () => false,
          onStage: (s) => { it.stage = s || ''; paint(); },
          onProgress: (p) => { it.progress = Number(p) || 0; paint(); },
          engineStage: (s) => { if (s) { it.stage = s; paint(); } },
          engineProgress: (p) => { if (Number(p) >= 0) { it.progress = Number(p); paint(); } },
        });
        it.outputs = outs || [];
        it.status = 'done';
        it.progress = 1;
        it.stage = '';
        ok += 1;
      } catch (err) {
        it.status = 'error';
        it.error = (err && err.message) ? err.message : String(err);
        fail += 1;
      }
      paint(true);
    }
    busy = false;
    if (tipBox) tipBox.textContent = ok || fail ? '完成 ' + ok + ' 个，失败 ' + fail + ' 个' : '';
    paintBar();
    if (ok) toast('转换完成 ' + ok + ' 个文件', 'ok');
    if (fail && !ok) toast('转换失败，请查看列表中的错误信息', 'warn');
  }

  paintOpts();
  paintBar();

  if (ctx && typeof ctx.onDestroy === 'function') {
    ctx.onDestroy(() => { files.length = 0; });
  }
}
