import { CATEGORIES, TOOLS, TOOL_MAP, CAT_MAP, countByCat } from './registry.js?v=9';
import { icon, esc, copy, toast } from './core/ui.js';
import { loadDeps, isLoaded, DEPS } from './core/deps.js';

const view = document.getElementById('view');
const sideNav = document.getElementById('side-nav');
const bottomNav = document.getElementById('bottom-nav');
const palette = document.getElementById('palette');
const paletteInput = document.getElementById('palette-input');
const paletteList = document.getElementById('palette-list');

const LS = {
  fav: 'kt:fav',
  recent: 'kt:recent',
  theme: 'kt:theme'
};
const readArr = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } };
const favs = () => readArr(LS.fav);
const recents = () => readArr(LS.recent);
const isFav = (id) => favs().includes(id);

function toggleFav(id) {
  const list = favs();
  const i = list.indexOf(id);
  if (i >= 0) { list.splice(i, 1); toast('已取消收藏'); }
  else { list.unshift(id); toast('已加入收藏', 'ok'); }
  localStorage.setItem(LS.fav, JSON.stringify(list));
  document.querySelectorAll(`[data-fav="${id}"]`).forEach((b) => b.classList.toggle('on', i < 0));
  if (routeName() === 'fav') render();
}
function addRecent(id) {
  const list = recents().filter((x) => x !== id);
  list.unshift(id);
  localStorage.setItem(LS.recent, JSON.stringify(list.slice(0, 16)));
}

/* ---------------- 搜索 ---------------- */
function subseq(hay, needle) {
  let i = 0;
  for (const ch of needle) { i = hay.indexOf(ch, i); if (i < 0) return false; i++; }
  return true;
}
function searchTools(q, limit = 20) {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const out = [];
  for (const tool of TOOLS) {
    const name = tool.name.toLowerCase();
    const id = tool.id.toLowerCase();
    const desc = tool.desc.toLowerCase();
    const tags = tool.tags.join(' ').toLowerCase();
    let score = 0;
    if (name === s) score = 200;
    else if (name.startsWith(s)) score = 150;
    else if (name.includes(s)) score = 120;
    else if (id.includes(s)) score = 100;
    else if (tags.includes(s)) score = 80;
    else if (desc.includes(s)) score = 50;
    else if (subseq(name + tags + desc, s)) score = 15;
    if (score) out.push({ tool, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.tool);
}

/* ---------------- 路由 ---------------- */
function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  return { parts, query: new URLSearchParams(qs || '') };
}
function routeName() {
  const { parts } = parseRoute();
  if (!parts.length) return 'home';
  if (parts[0] === 't') return 'tool';
  if (parts[0] === 'c') return 'cat';
  return parts[0];
}
let navToken = 0;
let cleanupFns = [];
function runCleanup() {
  for (const fn of cleanupFns) { try { fn(); } catch { /* ignore */ } }
  cleanupFns = [];
}

function renderSidebar() {
  const { parts } = parseRoute();
  const active = routeName();
  const activeCat = active === 'cat' ? parts[1] : (active === 'tool' ? TOOL_MAP[parts[1]]?.cat : null);
  const item = (href, name, ic, count, on) =>
    `<a class="nav-item${on ? ' active' : ''}" href="${href}">${icon(ic, 17)}<span>${esc(name)}</span>${count != null ? `<span class="cnt">${count}</span>` : ''}</a>`;
  sideNav.innerHTML = `
    <div class="nav-title">发现</div>
    ${item('#/', '首页', 'bolt', null, active === 'home')}
    ${item('#/all', '全部工具', 'data', TOOLS.length, active === 'all')}
    ${item('#/fav', '我的收藏', 'star', favs().length, active === 'fav')}
    ${item('#/recent', '最近使用', 'clock', recents().length, active === 'recent')}
    <div class="nav-title">工具分类</div>
    ${CATEGORIES.map((c) => item('#/c/' + c.id, c.name, c.icon, countByCat(c.id), activeCat === c.id)).join('')}
  `;
  [...bottomNav.querySelectorAll('a')].forEach((a) => {
    a.classList.toggle('active', a.dataset.nav === active || (active === 'cat' && a.dataset.nav === 'all'));
  });
  sideNav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => document.body.classList.remove('drawer-open')));
}

/* ---------------- 通用卡片 ---------------- */
function toolCard(tool) {
  const cat = CAT_MAP[tool.cat];
  const fav = isFav(tool.id);
  return `<div class="tool-card" role="link" tabindex="0" data-tool="${tool.id}">
    <span class="tc-icon">${icon(cat.icon, 16)}</span>
    <span class="tc-body">
      <b>${esc(tool.name)}</b>
      <p>${esc(tool.desc)}</p>
      <span class="tags">${tool.tags.slice(0, 3).map((x) => `<span class="tag">${esc(x)}</span>`).join('')}</span>
    </span>
    <button class="star-btn ${fav ? 'on' : ''}" data-fav="${tool.id}" title="收藏" aria-label="收藏">${icon('star', 15)}</button>
  </div>`;
}
function toolGrid(list) {
  if (!list.length) return `<div class="empty">${icon('search', 40)}<div>没有找到匹配的工具，换个关键词试试</div></div>`;
  return `<div class="tool-grid">${list.map(toolCard).join('')}</div>`;
}

function countUp(el, target, dur = 900) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = target; return; }
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    const ease = 1 - (1 - p) ** 3;
    el.textContent = Math.round(target * ease);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------------- 首页 ---------------- */
function renderHome() {
  const hot = TOOLS.filter((x) => x.hot);
  const recent = recents().map((id) => TOOL_MAP[id]).filter(Boolean);
  view.innerHTML = `
    <section class="hero">
      <div class="hero-orbit" aria-hidden="true">
        <svg viewBox="0 0 200 200" fill="none">
          <ellipse cx="100" cy="100" rx="92" ry="36" stroke="rgba(103,232,249,.35)" stroke-width="1.4" transform="rotate(-25 100 100)"/>
          <ellipse cx="100" cy="100" rx="92" ry="36" stroke="rgba(167,139,250,.3)" stroke-width="1.2" transform="rotate(35 100 100)"/>
          <ellipse cx="100" cy="100" rx="66" ry="24" stroke="rgba(255,255,255,.18)" stroke-width="1" transform="rotate(8 100 100)"/>
          <circle cx="100" cy="100" r="17" fill="rgba(56,205,240,.14)" stroke="rgba(103,232,249,.5)"/>
          <circle cx="186" cy="64" r="3.4" fill="#67e8f9"/>
          <circle cx="30" cy="150" r="2.4" fill="#a78bfa"/>
        </svg>
      </div>
      <div class="hero-kicker">${icon('bolt', 13)} PURE FRONTEND · ${TOOLS.length} TOOLS</div>
      <h1>一个页面，装下<br><em>浏览器能做的所有小事</em></h1>
      <p>文本、编码、JSON、图片、PDF、音视频、二维码、生活效率……打开即用。所有文件在本地处理，不上传、不追踪。</p>
      <div class="hero-search">
        ${icon('search', 20)}
        <input id="hero-search" placeholder="搜索你需要的工具，例如：压缩图片、JSON、转二维码…" autocomplete="off">
        <button class="btn primary" id="hero-go">搜索</button>
      </div>
      <div class="hero-stats">
        <div><b>${TOOLS.length}</b><span>个工具</span></div>
        <div><b>${CATEGORIES.length}</b><span>个分类</span></div>
        <div><b>0</b><span>文件上传</span></div>
        <div><b>100%</b><span>本地运行</span></div>
      </div>
    </section>

    <div class="section-title"><h2>${icon('data', 17)} 按分类浏览</h2><a class="more" href="#/all">查看全部 →</a></div>
    <div class="cat-grid">
      ${CATEGORIES.map((c) => `<a class="cat-card" href="#/c/${c.id}">
        <span class="cnt">${countByCat(c.id)}</span>
        <span class="cat-icon">${icon(c.icon, 18)}</span>
        <b>${esc(c.name)}</b>
        <small>${esc(c.desc)}</small>
      </a>`).join('')}
    </div>

    ${recent.length ? `<div class="section-title"><h2>${icon('clock', 17)} 最近使用</h2><a class="more" href="#/recent">全部 →</a></div>${toolGrid(recent.slice(0, 4))}` : ''}

    <div class="section-title"><h2>${icon('bolt', 17)} 热门工具</h2><a class="more" href="#/all">全部 →</a></div>
    ${toolGrid(hot)}

    <div class="panel" style="margin-top:26px;background:linear-gradient(135deg,rgba(56,205,240,.06),rgba(129,140,248,.05))">
      <div class="row between">
        <div>
          <b style="font-size:14px">为什么是「空天」？</b>
          <div class="hint" style="margin-top:4px;max-width:620px">像空天飞行器一样轻量：没有后端、没有数据库、没有账号。第三方依赖只在你打开对应工具时下载，并在界面中实时显示下载项与进度；工具代码按分类懒加载，首页保持轻快。</div>
        </div>
        <a class="btn" href="#/about">了解更多</a>
      </div>
    </div>
    <div class="center hint" style="margin-top:26px">空天工具合集 · 纯前端 · 文件不上传 · 支持手机与电脑</div>
  `;
  const input = document.getElementById('hero-search');
  document.querySelectorAll('.hero-stats b').forEach((el) => {
    const target = parseInt(el.textContent.replace(/[^\d]/g, ''), 10);
    if (!isNaN(target) && target > 0) countUp(el, target);
  });
  const go = () => { const q = input.value.trim(); location.hash = q ? `#/all?q=${encodeURIComponent(q)}` : '#/all'; };
  document.getElementById('hero-go').addEventListener('click', go);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
}

/* ---------------- 全部 / 分类 ---------------- */
function renderAll(query) {
  const initialQ = query.get('q') || '';
  view.innerHTML = `
    <div class="page-head">
      <h1>全部工具</h1>
      <p>共 ${TOOLS.length} 个工具，覆盖 ${CATEGORIES.length} 个分类。按名称、描述或标签搜索。</p>
    </div>
    <div class="panel tight" style="margin-bottom:14px">
      <input class="inp" id="all-search" placeholder="搜索工具…（试试 JSON、二维码、压缩、时间戳）" value="${esc(initialQ)}">
      <div class="row" style="margin-top:10px;gap:6px" id="cat-chips">
        <button class="chip active" data-cat="all">全部</button>
        ${CATEGORIES.map((c) => `<button class="chip" data-cat="${c.id}">${esc(c.name)}</button>`).join('')}
      </div>
    </div>
    <div class="row between" style="margin-bottom:10px"><span class="hint" id="all-count"></span></div>
    <div id="all-list"></div>
  `;
  const input = document.getElementById('all-search');
  const list = document.getElementById('all-list');
  const count = document.getElementById('all-count');
  let cat = 'all';
  function paint() {
    const q = input.value.trim();
    let items = q ? searchTools(q, 999) : TOOLS.slice();
    if (cat !== 'all') items = items.filter((x) => x.cat === cat);
    count.textContent = `找到 ${items.length} 个工具`;
    list.innerHTML = toolGrid(items);
  }
  input.addEventListener('input', paint);
  document.getElementById('cat-chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    cat = b.dataset.cat;
    document.querySelectorAll('#cat-chips .chip').forEach((x) => x.classList.toggle('active', x === b));
    paint();
  });
  paint();
}

function renderCat(catId) {
  const cat = CAT_MAP[catId];
  if (!cat) return renderNotFound();
  const items = TOOLS.filter((x) => x.cat === catId);
  view.innerHTML = `
    <div class="crumb"><a href="#/">首页</a><span class="sep">/</span><span>${esc(cat.name)}</span></div>
    <div class="page-head">
      <h1>${esc(cat.name)}</h1>
      <p>${esc(cat.desc)} · 共 ${items.length} 个工具</p>
    </div>
    ${toolGrid(items)}
  `;
}

function renderFav() {
  const items = favs().map((id) => TOOL_MAP[id]).filter(Boolean);
  view.innerHTML = `
    <div class="page-head"><h1>我的收藏</h1><p>收藏保存在本机浏览器，不上传。点击卡片右上角的星标即可收藏或取消。</p></div>
    ${items.length ? toolGrid(items) : `<div class="empty">${icon('star', 40)}<div>还没有收藏。打开任意工具，点击右上角「收藏」。</div><a class="btn" style="margin-top:14px" href="#/all">去逛逛</a></div>`}
  `;
}

function renderRecent() {
  const items = recents().map((id) => TOOL_MAP[id]).filter(Boolean);
  view.innerHTML = `
    <div class="page-head"><h1>最近使用</h1><p>只记录工具 ID，保存在本机。最多保留 16 条。</p></div>
    ${items.length ? toolGrid(items) : `<div class="empty">${icon('clock', 40)}<div>还没有使用记录。</div><a class="btn" style="margin-top:14px" href="#/all">从热门工具开始</a></div>`}
  `;
}

function renderAbout() {
  view.innerHTML = `
    <div class="page-head"><h1>关于空天工具合集</h1><p>一个完全运行在浏览器里的工具箱。</p></div>
    <div class="tool-ui">
      <div class="panel">
        <div class="panel-head"><b>设计原则</b></div>
        <div class="kv">
          <dt>纯前端</dt><dd>没有任何后端接口，所有计算、转换、编解码都在你的浏览器里完成。</dd>
          <dt>文件不上传</dt><dd>图片、PDF、音视频等文件只会被读取到内存或 IndexedDB，不会离开设备。</dd>
          <dt>按需加载</dt><dd>工具代码按分类拆分，第三方库在打开对应工具时才下载，并显示依赖名称与实时进度。</dd>
          <dt>一处代码，两端一致</dt><dd>同一套响应式布局服务手机与电脑，功能完全一致，触屏操作也经过适配。</dd>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><b>怎么快速找到工具</b></div>
        <div class="kv">
          <dt>Ctrl / ⌘ + K</dt><dd>打开命令面板，输入任意关键词直接跳转。</dd>
          <dt>分类浏览</dt><dd>左侧（手机为抽屉）按 21 个分类浏览，共 ${TOOLS.length} 个工具。</dd>
          <dt>收藏与最近</dt><dd>常用工具点星收藏；最近打开会自动记录，下次一眼找到。</dd>
          <dt>深链接</dt><dd>每个工具都有独立地址（#/t/工具ID），可以直接分享给同一局域网或线上的人。</dd>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><b>技术说明</b></div>
        <p class="hint" style="margin:0">原生 ES Modules + 原生 CSS，无需构建。依赖通过 jsDelivr 按需加载：marked、DOMPurify、JSZip、pdf-lib、PDF.js、Chart.js、PapaParse、js-yaml、math.js、SheetJS、Tesseract.js、jsQR、qrcode-generator、JsBarcode、KaTeX、Mermaid、sql.js 等。部分重型能力（OCR、本地 AI 模型）受浏览器性能与网络限制。</p>
      </div>
      <div class="panel">
        <div class="panel-head"><b>隐私与边界</b></div>
        <p class="hint" style="margin:0">需要摄像头、麦克风、剪贴板、定位等能力时，浏览器会向你请求授权，只有在你同意后工具才会工作。加密、医疗、法律、金融相关工具只做本地计算或模板，不构成专业建议。需要服务器或第三方 API 的能力（实时汇率、短链、IP 查询、邮件发送等）不在本工具集中冒充实现。</p>
      </div>
    </div>
  `;
}

function renderNotFound() {
  view.innerHTML = `<div class="empty">${icon('search', 40)}<div>页面不存在或工具已下线</div><a class="btn" style="margin-top:14px" href="#/all">浏览全部工具</a></div>`;
}

/* ---------------- 依赖进度面板 ---------------- */
function depCardHtml(ids) {
  return `<div class="dep-card" id="dep-card">
    <div class="dep-head"><span class="spinner"></span><span>正在下载运行依赖</span><span class="dep-sub">仅首次打开需要，之后走浏览器缓存</span></div>
    <div class="dep-list">
      ${ids.map((id) => {
        const d = DEPS[id] || { name: id, desc: '', bytes: 0 };
        return `<div class="dep-item" data-dep="${id}">
          <div class="dep-name">${esc(d.name)}<i>${esc(d.desc || '')}</i></div>
          <div class="progress"><i style="width:0%"></i></div>
          <div class="dep-pct">0%</div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

async function depsWithUI(ids, area) {
  const uniq = [...new Set(ids)].filter(Boolean);
  if (!uniq.length) return;
  const cachedAll = uniq.every((id) => isLoaded(id));
  if (cachedAll) return;
  area.innerHTML = depCardHtml(uniq);
  const card = area.querySelector('#dep-card');
  const emit = (ev) => {
    const row = card.querySelector(`[data-dep="${ev.id}"]`);
    if (!row) return;
    const bar = row.querySelector('.progress i');
    const pct = row.querySelector('.dep-pct');
    const name = row.querySelector('.dep-name');
    if (ev.status === 'start') { pct.textContent = '连接中'; }
    if (ev.status === 'progress') {
      const p = ev.total ? Math.min(100, Math.round(ev.loaded / ev.total * 100)) : 50;
      bar.style.width = p + '%';
      pct.textContent = p + '%';
    }
    if (ev.status === 'fallback') { pct.textContent = '备用线路'; }
    if (ev.status === 'done') {
      bar.style.width = '100%';
      bar.style.background = 'linear-gradient(90deg,#34d399,#22d3ee)';
      pct.textContent = '完成';
      name.style.color = 'var(--ok)';
    }
    if (ev.status === 'error') {
      bar.style.background = 'var(--err)';
      pct.textContent = '失败';
      if (ev.error) name.title = ev.error;
    }
  };
  try {
    await loadDeps(uniq, emit);
    const total = uniq.reduce((s, id) => s + (DEPS[id]?.bytes || 0), 0);
    const names = uniq.map((id) => `<b>${esc(DEPS[id]?.name || id)}</b>`).join('、');
    area.innerHTML = `<div class="dep-done">${icon('check', 14)}<span>已加载依赖：${names} · 约 ${(total / 1024).toFixed(0)} KB（已缓存）</span><button type="button" id="dep-hide">收起</button></div>`;
    area.querySelector('#dep-hide').addEventListener('click', () => { area.innerHTML = ''; });
  } catch (e) {
    const err = document.createElement('div');
    err.className = 'dep-err';
    err.textContent = '依赖加载失败：' + e.message;
    card.appendChild(err);
    const retry = document.createElement('button');
    retry.className = 'btn sm';
    retry.style.marginTop = '8px';
    retry.textContent = '重新加载工具';
    retry.onclick = () => render();
    card.appendChild(retry);
  }
}

/* ---------------- 工具页 ---------------- */
async function renderTool(id) {
  const tool = TOOL_MAP[id];
  if (!tool) return renderNotFound();
  addRecent(id);
  const cat = CAT_MAP[tool.cat];
  const related = TOOLS.filter((x) => x.cat === tool.cat && x.id !== id).slice(0, 4);
  view.innerHTML = `
    <div class="crumb"><a href="#/">首页</a><span class="sep">/</span><a href="#/c/${cat.id}">${esc(cat.name)}</a><span class="sep">/</span><span>${esc(tool.name)}</span></div>
    <div class="tool-head">
      <div class="th-icon">${icon(cat.icon, 24)}</div>
      <div>
        <h1>${esc(tool.name)}</h1>
        <p>${esc(tool.desc)}</p>
        <div class="tool-meta">
          <span class="pill acc">${esc(cat.name)}</span>
          ${tool.deps?.length ? `<span class="pill">按需加载 ${tool.deps.length} 项依赖</span>` : '<span class="pill ok">零依赖 · 本地运行</span>'}
          <span class="pill ok">文件不上传</span>
        </div>
      </div>
      <div class="tool-actions">
        <button class="btn sm" id="fav-tool">${icon('star', 14)} ${isFav(id) ? '已收藏' : '收藏'}</button>
        <button class="btn sm" id="share-tool">复制链接</button>
      </div>
    </div>
    <div class="dep-area" id="dep-area"></div>
    <div id="tool-root"><div class="skeleton-wrap"><div class="skeleton w40"></div><div class="skeleton h120"></div><div class="skeleton h180"></div><div class="skeleton w60"></div></div><div class="hint center" style="margin-top:10px">正在加载工具模块…</div></div>
    ${related.length ? `<div class="section-title"><h2>同类工具</h2></div>${toolGrid(related)}` : ''}
  `;
  renderSidebar();
  document.getElementById('fav-tool').addEventListener('click', (e) => {
    toggleFav(id);
    e.currentTarget.innerHTML = `${icon('star', 14)} ${isFav(id) ? '已收藏' : '收藏'}`;
  });
  document.getElementById('share-tool').addEventListener('click', () => copy(location.href));

  const root = document.getElementById('tool-root');
  const depArea = document.getElementById('dep-area');
  const token = ++navToken;
  try {
    const mod = await import(`./tools/${tool.cat}.js?v=9`);
    if (token !== navToken) return;
    const fn = mod.default?.[id];
    if (typeof fn !== 'function') throw new Error('该工具的实现尚未加载：' + id);
    root.innerHTML = '';
    root.classList.add('tool-body');
    const ctx = {
      tool,
      root,
      deps: (ids) => depsWithUI(ids, depArea),
      onDestroy: (f) => cleanupFns.push(f),
      toast,
      copy,
      icon,
      isMobile: () => window.matchMedia('(max-width: 860px)').matches
    };
    const ret = fn(root, ctx);
    if (ret && typeof ret.then === 'function') await ret;
  } catch (e) {
    if (token !== navToken) return;
    root.innerHTML = `<div class="panel"><div class="errbox">工具加载失败：${esc(e.message)}</div>
      <div class="row" style="margin-top:12px"><button class="btn" onclick="location.reload()">刷新页面</button><a class="btn" href="#/all">返回全部工具</a></div></div>`;
  }
}

/* ---------------- 主渲染 ---------------- */
function render() {
  runCleanup();
  const { parts, query } = parseRoute();
  const name = routeName();
  if (name === 'home') renderHome();
  else if (name === 'all') renderAll(query);
  else if (name === 'cat') renderCat(parts[1]);
  else if (name === 'tool') { renderSidebar(); renderTool(parts[1]); return; }
  else if (name === 'fav') renderFav();
  else if (name === 'recent') renderRecent();
  else if (name === 'about') renderAbout();
  else renderNotFound();
  renderSidebar();
}

/* 事件委托：工具卡片、收藏 */
view.addEventListener('click', (e) => {
  const favBtn = e.target.closest('[data-fav]');
  if (favBtn) {
    e.preventDefault();
    e.stopPropagation();
    toggleFav(favBtn.dataset.fav);
    return;
  }
  const card = e.target.closest('[data-tool]');
  if (card) location.hash = '#/t/' + card.dataset.tool;
});
view.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches('[data-tool]')) location.hash = '#/t/' + e.target.dataset.tool;
});

/* ---------------- 主题 ---------------- */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(LS.theme, theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'light' ? '#f3f6fc' : '#070b14';
}
applyTheme(localStorage.getItem(LS.theme) || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
document.getElementById('theme-btn').addEventListener('click', () => {
  document.documentElement.classList.add('theme-switching');
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  setTimeout(() => document.documentElement.classList.remove('theme-switching'), 360);
});

/* ---------------- 抽屉 ---------------- */
document.getElementById('menu-btn').addEventListener('click', () => document.body.classList.toggle('drawer-open'));
document.getElementById('scrim').addEventListener('click', () => document.body.classList.remove('drawer-open'));

/* ---------------- 命令面板 ---------------- */
let pIndex = 0;
let pResults = [];
function paintPalette(q = '') {
  pResults = q.trim() ? searchTools(q, 12) : TOOLS.filter((x) => x.hot).slice(0, 8);
  pIndex = 0;
  paletteList.innerHTML = pResults.length ? pResults.map((tool, i) => {
    const cat = CAT_MAP[tool.cat];
    return `<div class="p-item${i === 0 ? ' sel' : ''}" data-i="${i}">
      <span class="pi-icon">${icon(cat.icon, 14)}</span>
      <span style="min-width:0"><b>${esc(tool.name)}</b><small>${esc(tool.desc)}</small></span>
      <span class="pi-cat">${esc(cat.name)}</span>
    </div>`;
  }).join('') : `<div class="p-empty">没有找到「${esc(q)}」，试试更短的关键词</div>`;
}
function openPalette(q = '') {
  palette.classList.remove('hidden');
  paletteInput.value = q;
  paintPalette(q);
  setTimeout(() => paletteInput.focus(), 30);
}
function closePalette() { palette.classList.add('hidden'); }
function goPalette(i) {
  const tool = pResults[i];
  if (!tool) return;
  closePalette();
  location.hash = '#/t/' + tool.id;
}
document.getElementById('search-trigger').addEventListener('click', () => openPalette());
paletteInput.addEventListener('input', () => paintPalette(paletteInput.value));
paletteList.addEventListener('click', (e) => {
  const it = e.target.closest('.p-item');
  if (it) goPalette(Number(it.dataset.i));
});
palette.addEventListener('click', (e) => { if (e.target === palette) closePalette(); });
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    palette.classList.contains('hidden') ? openPalette() : closePalette();
  }
  if (e.key === 'Escape' && !palette.classList.contains('hidden')) closePalette();
  if (!palette.classList.contains('hidden')) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      pIndex = Math.min(pResults.length - 1, pIndex + 1);
      [...paletteList.children].forEach((el, i) => el.classList.toggle('sel', i === pIndex));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      pIndex = Math.max(0, pIndex - 1);
      [...paletteList.children].forEach((el, i) => el.classList.toggle('sel', i === pIndex));
    }
    if (e.key === 'Enter') goPalette(pIndex);
  }
});

/* ---------------- 启动 ---------------- */
window.addEventListener('hashchange', () => {
  window.scrollTo({ top: 0, behavior: 'instant' });
  render();
});
render();
window.dispatchEvent(new Event('kt:ready'));

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
