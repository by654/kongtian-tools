/* 空天工具合集 · 工具合并层
   作用：把功能重复、或 A 功能被 B 完全包含的工具，合并成同一页面内的多标签工具。
   原则：
   1. 只在前端组织层合并——被合并工具的实现模块原样保留，切换标签时按需加载，功能零丢失；
   2. 旧链接（#/t/<被合并 id>）自动落到主工具并切到对应标签，不会 404；
   3. 首页 / 分类 / 搜索里只出现主工具一条，避免重复条目。 */

import { esc } from './ui.js';
import { MERGED, ALIAS } from './merge-map.js';

export { MERGED, ALIAS };

const CSS_ID = 'kt-merge-css';
function injectCss() {
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement('style');
  style.id = CSS_ID;
  style.textContent = [
    '.mg-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 10px}',
    '.mg-note{font-size:12px;color:var(--muted);display:inline-flex;align-items:center;gap:6px}',
    '.mg-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px;padding-bottom:10px;border-bottom:1px solid var(--line)}',
    '.mg-tab{appearance:none;cursor:pointer;font:inherit;font-size:13px;padding:7px 13px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--muted);transition:color .15s,border-color .15s,background .15s}',
    '.mg-tab:hover{color:var(--text);border-color:var(--line-strong)}',
    '.mg-tab.on{color:var(--text);border-color:rgba(56,205,240,.45);background:linear-gradient(135deg,rgba(56,205,240,.16),rgba(129,140,248,.16))}',
    '.mg-body{min-height:120px}'
  ].join('');
  document.head.appendChild(style);
}

/* 挂载合并工具：ownFn 为主工具自身实现（已由 main.js 加载），其余标签按需 import */
export function mountMerged(root, ctx, spec, ownFn, initialTab) {
  injectCss();
  const ownId = ctx.tool && ctx.tool.id;
  const sections = spec.sections.map((s) => (s.id === ownId ? Object.assign({}, s, { render: ownFn }) : s));
  const start = Math.max(0, sections.findIndex((s) => s.label === initialTab));

  root.innerHTML = `
    <div class="mg-head"><span class="mg-note">${esc(spec.note || '')}</span></div>
    <div class="mg-tabs" role="tablist">
      ${sections.map((s, i) => `<button type="button" class="mg-tab${i === start ? ' on' : ''}" role="tab" data-i="${i}">${esc(s.label)}</button>`).join('')}
    </div>
    <div class="mg-body"></div>
  `;

  const body = root.querySelector('.mg-body');
  const tabs = [...root.querySelectorAll('.mg-tab')];
  let cleanup = [];
  let current = -1;

  function clearTab() {
    const fns = cleanup;
    cleanup = [];
    for (const fn of fns) { try { fn(); } catch { /* ignore */ } }
  }
  ctx.onDestroy(clearTab);

  async function show(i) {
    if (i === current) return;
    current = i;
    clearTab();
    tabs.forEach((t, k) => t.classList.toggle('on', k === i));
    const sec = sections[i];
    body.innerHTML = '<div class="hint" style="padding:16px 2px">正在加载工具…</div>';
    try {
      let fn = sec.render;
      if (!fn) {
        const mod = await import(`../tools/${sec.cat}.js?v=11`);
        fn = mod.default?.[sec.id];
      }
      if (typeof fn !== 'function') throw new Error('未找到实现：' + sec.id);
      body.innerHTML = '';
      const childCtx = Object.assign({}, ctx, {
        root: body,
        tool: Object.assign({}, ctx.tool, { id: sec.id, name: sec.label }),
        onDestroy: (f) => { cleanup.push(f); }
      });
      const ret = fn(body, childCtx);
      if (ret && typeof ret.then === 'function') await ret;
    } catch (e) {
      body.innerHTML = `<div class="panel"><div class="errbox">标签页加载失败：${esc(e.message || String(e))}</div></div>`;
    }
  }

  tabs.forEach((t) => t.addEventListener('click', () => show(Number(t.dataset.i))));
  show(start);
}
