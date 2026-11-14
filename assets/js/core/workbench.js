/* 通用工作台：多模式计算器、模板生成器、清单工具 */
import { esc, copy, toast, download } from './ui.js';

function fieldHtml(f, vi) {
  const [id, label, value, type = 'number', extra = ''] = f;
  if (type === 'select') {
    return `<div class="field"><label class="lab">${esc(label)}</label><select class="sel" id="${vi}-${id}">${(extra || []).map((o) => {
      const [v, n] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(n)}</option>`;
    }).join('')}</select></div>`;
  }
  if (type === 'textarea') {
    return `<div class="field" style="grid-column:1/-1"><label class="lab">${esc(label)}</label><textarea class="ta mono" id="${vi}-${id}" rows="3" placeholder="${esc(extra || '')}">${esc(value ?? '')}</textarea></div>`;
  }
  return `<div class="field"><label class="lab">${esc(label)}</label><input class="inp" id="${vi}-${id}" type="${type}" value="${esc(value ?? '')}" ${type === 'number' ? `step="${typeof extra === 'number' ? extra : 'any'}"` : `placeholder="${esc(extra || '')}"`}></div>`;
}

export function calcWorkbench(root, { title = '参数', groups, outTitle = '结果', note = '' }) {
  const $ = (s) => root.querySelector(s);
  const list = Array.isArray(groups) ? groups : [groups];
  let active = 0;
  root.innerHTML = `<div class="tool-ui">
    <div class="panel">
      <div class="panel-head"><b>${esc(title)}</b><span class="hint">全部本地计算</span></div>
      ${list.length > 1 ? `<div class="row" id="cw-groups" style="gap:6px;margin-bottom:11px">${list.map((g, i) => `<button class="chip${i === 0 ? ' active' : ''}" data-g="${i}">${esc(g.name)}</button>`).join('')}</div>` : ''}
      <div class="grid2" id="cw-fields"></div>
      <div class="row" style="margin-top:11px">
        <button class="btn primary" id="cw-run">计算</button>
        <button class="btn" id="cw-copy">复制</button>
        <button class="btn" id="cw-dl">下载 TXT</button>
        <span class="hint" id="cw-meta"></span>
      </div>
      ${note ? `<div class="hint" style="margin-top:8px">${note}</div>` : ''}
    </div>
    <div class="panel"><div class="panel-head"><b>${esc(outTitle)}</b></div><pre class="out" id="cw-out"></pre></div>
  </div>`;
  const fieldsEl = $('#cw-fields');
  const paint = () => {
    const g = list[active];
    fieldsEl.innerHTML = (g.fields || []).map((f) => fieldHtml(f, 'cw')).join('');
    const out = $('#cw-out');
    out.textContent = '';
    $('#cw-meta').textContent = '';
  };
  const run = () => {
    const g = list[active];
    const v = {};
    for (const f of g.fields || []) {
      const el = document.getElementById('cw-' + f[0]);
      v[f[0]] = f[3] === 'number' ? Number(el.value) : el.value;
    }
    try {
      const r = g.run(v);
      if (r && typeof r === 'object') {
        if (r.html) $('#cw-out').innerHTML = r.html;
        else $('#cw-out').textContent = r.text ?? '';
        $('#cw-meta').textContent = r.meta || '';
        if (r.filename) $('#cw-dl').dataset.name = r.filename;
      } else {
        $('#cw-out').textContent = r == null ? '' : String(r);
      }
    } catch (e) {
      $('#cw-out').textContent = '计算失败：' + e.message;
    }
  };
  root.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => {
    active = Number(b.dataset.g);
    root.querySelectorAll('[data-g]').forEach((x) => x.classList.toggle('active', x === b));
    paint(); run();
  }));
  $('#cw-run').onclick = run;
  $('#cw-copy').onclick = () => copy($('#cw-out').textContent);
  $('#cw-dl').onclick = () => download($('#cw-dl').dataset.name || 'result.txt', $('#cw-out').textContent, 'text/plain');
  paint(); run();
}

export function templateWorkbench(root, { title = '模板生成', templates, fields, note = '', outTitle = '生成结果' }) {
  const $ = (s) => root.querySelector(s);
  const tpls = Array.isArray(templates) ? templates : Object.entries(templates).map(([id, t]) => ({ id, ...t }));
  let active = 0;
  const baseFields = fields || [
    ['title', '标题 / 项目', '示例项目'],
    ['owner', '负责人', ''],
    ['date', '日期', new Date().toISOString().slice(0, 10), 'date'],
    ['notes', '要点（每行一条）', '完成第一项\n完成第二项\n计划下一步', 'textarea']
  ];
  root.innerHTML = `<div class="tool-ui">
    <div class="panel">
      <div class="panel-head"><b>${esc(title)}</b><span class="hint">${tpls.length} 个模板</span></div>
      <div class="field" style="margin-bottom:10px"><label class="lab">模板</label><select class="sel" id="tw-tpl">${tpls.map((t, i) => `<option value="${i}">${esc(t.name)}</option>`).join('')}</select></div>
      <div class="grid2" id="tw-fields">${baseFields.map((f) => fieldHtml(f, 'tw')).join('')}</div>
      <div class="row" style="margin-top:10px"><button class="btn primary" id="tw-run">生成</button><button class="btn" id="tw-copy">复制</button><button class="btn" id="tw-dl">下载 .md</button></div>
      ${note ? `<div class="hint" style="margin-top:8px">${note}</div>` : ''}
    </div>
    <div class="panel"><div class="panel-head"><b>${esc(outTitle)}</b></div><textarea class="ta mono" id="tw-out" rows="18"></textarea></div>
  </div>`;
  const run = () => {
    const t = tpls[active];
    const v = {};
    baseFields.forEach((f) => { v[f[0]] = document.getElementById('tw-' + f[0]).value; });
    try {
      $('#tw-out').value = t.build(v);
    } catch (e) { $('#tw-out').value = '生成失败：' + e.message; }
  };
  $('#tw-tpl').onchange = (e) => { active = Number(e.target.value); run(); };
  $('#tw-run').onclick = run;
  $('#tw-copy').onclick = () => copy($('#tw-out').value);
  $('#tw-dl').onclick = () => download((tpls[active].id || 'template') + '.md', $('#tw-out').value, 'text/markdown');
  run();
}

export function checklistWorkbench(root, { title = '检查清单', sections, note = '' }) {
  const $ = (s) => root.querySelector(s);
  const all = [];
  root.innerHTML = `<div class="tool-ui">
    <div class="panel">
      <div class="panel-head"><b>${esc(title)}</b><span class="hint" id="cl-count"></span></div>
      <div id="cl-list" class="tool-ui">${sections.map((sec, si) => `<div class="panel tight"><div class="panel-head"><b>${esc(sec.name)}</b></div>${sec.items.map((it, ii) => {
        const id = `cl-${si}-${ii}`; all.push({ id, text: it }) ;
        return `<label class="row" style="gap:7px;padding:3px 0"><input type="checkbox" id="${id}"><span>${esc(it)}</span></label>`;
      }).join('')}</div>`).join('')}</div>
      <div class="row" style="margin-top:10px"><button class="btn" id="cl-copy">复制清单</button><button class="btn" id="cl-reset">重置</button></div>
    </div>
    ${note ? `<div class="warnbox">${note}</div>` : ''}
  </div>`;
  const paint = () => {
    const done = all.filter((x) => document.getElementById(x.id).checked).length;
    $('#cl-count').textContent = `${done} / ${all.length}`;
  };
  root.querySelectorAll('input[type=checkbox]').forEach((c) => c.addEventListener('change', paint));
  $('#cl-copy').onclick = () => {
    const lines = sections.map((sec, si) => `## ${sec.name}\n` + sec.items.map((it, ii) => `- [${document.getElementById(`cl-${si}-${ii}`).checked ? 'x' : ' '}] ${it}`).join('\n')).join('\n\n');
    copy(lines);
  };
  $('#cl-reset').onclick = () => { root.querySelectorAll('input[type=checkbox]').forEach((c) => { c.checked = false; }); paint(); };
  paint();
}
