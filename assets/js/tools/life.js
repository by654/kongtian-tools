/* 生活、效率与健康 */
import { esc, copy, toast, download } from '../core/ui.js';

const $ = (root, s) => root.querySelector(s);
const LS = {
  get(k, def) { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(def)); } catch { return def; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
};
const today = () => new Date().toISOString().slice(0, 10);
const pad = (n) => String(n).padStart(2, '0');

export default {
  /* ================= 待办 ================= */
  'todo'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="row"><input class="inp" id="td-text" placeholder="添加待办…" style="flex:1"><select class="sel" id="td-pri" style="max-width:110px"><option value="normal">普通</option><option value="high">重要</option><option value="low">低</option></select><button class="btn primary" id="td-add">添加</button></div>
          <div class="row" style="margin-top:9px"><button class="chip active" data-filter="all">全部</button><button class="chip" data-filter="active">未完成</button><button class="chip" data-filter="done">已完成</button><button class="btn sm" id="td-clear" style="margin-left:auto">清除已完成</button><span class="hint" id="td-count"></span></div>
        </div>
        <div class="panel"><div id="td-list" class="tool-ui"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let filter = 'all';
    const load = () => LS.get('kt:todo', []);
    const save = (x) => LS.set('kt:todo', x);
    const paint = () => {
      let list = load();
      if (filter === 'active') list = list.filter((x) => !x.done);
      if (filter === 'done') list = list.filter((x) => x.done);
      const all = load();
      $('#td-count').textContent = `${all.filter((x) => !x.done).length} 项待完成 / 共 ${all.length} 项`;
      $('#td-list').innerHTML = list.length ? list.map((x) => `<div class="panel tight"><div class="row between"><label class="row" style="gap:8px;flex:1"><input type="checkbox" data-tog="${x.id}" ${x.done ? 'checked' : ''}><span style="${x.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(x.text)}</span>${x.pri === 'high' ? '<span class="pill" style="color:var(--err);border-color:rgba(251,113,133,.3)">重要</span>' : ''}</label><button class="btn sm danger" data-del="${x.id}">删除</button></div></div>`).join('') : '<div class="empty">这里空空的</div>';
      root.querySelectorAll('[data-tog]').forEach((c) => c.addEventListener('change', () => {
        const l = load(); const it = l.find((x) => x.id === Number(c.dataset.tog));
        if (it) it.done = c.checked;
        save(l); paint();
      }));
      root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { save(load().filter((x) => x.id !== Number(b.dataset.del))); paint(); }));
    };
    $('#td-add').onclick = () => {
      const text = $('#td-text').value.trim();
      if (!text) return;
      const l = load();
      l.unshift({ id: Date.now(), text, pri: $('#td-pri').value, done: false, at: Date.now() });
      save(l); $('#td-text').value = ''; paint();
    };
    $('#td-text').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#td-add').click(); });
    root.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
      filter = b.dataset.filter;
      root.querySelectorAll('[data-filter]').forEach((x) => x.classList.toggle('active', x === b));
      paint();
    }));
    $('#td-clear').onclick = () => { save(load().filter((x) => !x.done)); paint(); };
    paint();
  },

  /* ================= 记事本 ================= */
  'notes'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="row"><input class="inp" id="nt-title" placeholder="笔记标题" style="flex:1"><button class="btn primary" id="nt-new">新建</button><button class="btn" id="nt-export">导出全部</button></div>
          <textarea class="ta" id="nt-body" rows="14" style="margin-top:9px" placeholder="开始记录…（自动保存）"></textarea>
          <div class="hint" id="nt-meta" style="margin-top:6px">尚未保存</div>
        </div>
        <div class="panel"><div class="panel-head"><b>全部笔记</b><span class="hint" id="nt-count"></span></div><div id="nt-list" class="row" style="gap:6px"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let current = null;
    const load = () => LS.get('kt:notes', []);
    const save = (x) => LS.set('kt:notes', x);
    const paintList = () => {
      const list = load();
      $('#nt-count').textContent = `${list.length} 条`;
      $('#nt-list').innerHTML = list.map((n) => `<button class="chip" data-open="${n.id}">${esc(n.title || '无标题')}</button>`).join('') || '<span class="hint">还没有笔记</span>';
      root.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => open(Number(b.dataset.open))));
    };
    const open = (id) => {
      const n = load().find((x) => x.id === id);
      if (!n) return;
      current = n;
      $('#nt-title').value = n.title;
      $('#nt-body').value = n.body;
      $('#nt-meta').textContent = '编辑中 · 自动保存';
    };
    const persist = () => {
      if (!current) {
        if (!$('#nt-body').value.trim() && !$('#nt-title').value.trim()) return;
        current = { id: Date.now(), title: $('#nt-title').value, body: $('#nt-body').value, at: Date.now() };
        save([current, ...load()]);
      } else {
        const l = load(); const n = l.find((x) => x.id === current.id);
        if (n) { n.title = $('#nt-title').value; n.body = $('#nt-body').value; n.at = Date.now(); save(l); }
      }
      paintList();
      $('#nt-meta').textContent = `已保存 ${new Date().toLocaleTimeString()}`;
    };
    let timer;
    const auto = () => { clearTimeout(timer); timer = setTimeout(persist, 600); };
    $('#nt-title').addEventListener('input', auto);
    $('#nt-body').addEventListener('input', auto);
    $('#nt-new').onclick = () => { current = null; $('#nt-title').value = ''; $('#nt-body').value = ''; $('#nt-meta').textContent = '新笔记'; };
    $('#nt-export').onclick = () => {
      const md = load().map((n) => `# ${n.title || '无标题'}\n\n${n.body}\n`).join('\n---\n\n');
      download('notes.md', md, 'text/markdown');
    };
    paintList();
    const list = load();
    if (list.length) open(list[0].id);
  },

  /* ================= 习惯打卡 ================= */
  'habit'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="row"><input class="inp" id="hb-name" placeholder="新习惯，例如：喝水 / 阅读 20 分钟" style="flex:1"><button class="btn primary" id="hb-add">添加</button></div>
        </div>
        <div class="panel"><div class="panel-head"><b>今日打卡</b><span class="hint" id="hb-date"></span></div><div id="hb-list" class="tool-ui"></div></div>
        <div class="panel"><div class="panel-head"><b>最近 20 周</b></div><div id="hb-grid" style="overflow-x:auto"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#hb-date').textContent = today();
    const load = () => LS.get('kt:habit', []);
    const save = (x) => LS.set('kt:habit', x);
    const streak = (h) => {
      let n = 0;
      const d = new Date();
      while (h.days?.[d.toISOString().slice(0, 10)]) { n++; d.setDate(d.getDate() - 1); }
      return n;
    };
    const paint = () => {
      const list = load();
      $('#hb-list').innerHTML = list.length ? list.map((h) => {
        const done = !!h.days?.[today()];
        return `<div class="panel tight"><div class="row between"><div><b>${esc(h.name)}</b><div class="hint">连续 ${streak(h)} 天 · 累计 ${Object.keys(h.days || {}).length} 天</div></div><div class="row"><button class="btn ${done ? 'primary' : ''}" data-tog="${h.id}">${done ? '已完成' : '打卡'}</button><button class="btn sm danger" data-del="${h.id}">删除</button></div></div></div>`;
      }).join('') : '<div class="empty">还没有习惯，先添加一个</div>';
      $('#hb-grid').innerHTML = `<div style="display:grid;grid-template-columns:repeat(20,14px);gap:3px">${Array.from({ length: 20 * 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (139 - i));
        const ds = d.toISOString().slice(0, 10);
        const n = list.filter((h) => h.days?.[ds]).length;
        return `<div title="${ds} · ${n} 个习惯" style="width:14px;height:14px;border-radius:3px;background:${n ? `rgba(56,205,240,${0.25 + n * 0.2})` : 'rgba(255,255,255,.06)'}"></div>`;
      }).join('')}</div>`;
      root.querySelectorAll('[data-tog]').forEach((b) => b.addEventListener('click', () => {
        const l = load(); const h = l.find((x) => x.id === Number(b.dataset.tog));
        if (!h) return;
        h.days = h.days || {};
        const key = today();
        if (h.days[key]) delete h.days[key]; else h.days[key] = true;
        save(l); paint();
      }));
      root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { save(load().filter((x) => x.id !== Number(b.dataset.del))); paint(); }));
    };
    $('#hb-add').onclick = () => {
      const name = $('#hb-name').value.trim();
      if (!name) return;
      const l = load(); l.push({ id: Date.now(), name, days: {} }); save(l); $('#hb-name').value = ''; paint();
    };
    paint();
  },

  /* ================= 记账 ================= */
  'ledger'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="grid4">
            <div class="field"><label class="lab">类型</label><select class="sel" id="lg-type"><option value="out">支出</option><option value="in">收入</option></select></div>
            <div class="field"><label class="lab">金额</label><input class="inp" id="lg-amount" type="number" placeholder="0.00"></div>
            <div class="field"><label class="lab">分类</label><input class="inp" id="lg-cat" placeholder="餐饮 / 交通 / 工资"></div>
            <div class="field"><label class="lab">备注</label><input class="inp" id="lg-note" placeholder="可选"></div>
          </div>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="lg-add">记一笔</button><button class="btn" id="lg-export">导出 CSV</button><span class="hint" id="lg-budget-label"></span></div>
        </div>
        <div class="stat-grid" id="lg-stats"></div>
        <div class="panel"><div class="panel-head"><b>本月分类</b></div><div id="lg-cats"></div></div>
        <div class="panel"><div class="panel-head"><b>流水</b><button class="btn sm" id="lg-clear">清空</button></div><div id="lg-list" class="table-scroll" style="max-height:320px"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const load = () => LS.get('kt:ledger', []);
    const save = (x) => LS.set('kt:ledger', x);
    const paint = () => {
      const list = load();
      const month = today().slice(0, 7);
      const cur = list.filter((x) => x.date.startsWith(month));
      const income = cur.filter((x) => x.type === 'in').reduce((s, x) => s + x.amount, 0);
      const expense = cur.filter((x) => x.type === 'out').reduce((s, x) => s + x.amount, 0);
      $('#lg-stats').innerHTML = [['本月收入', income], ['本月支出', expense], ['本月结余', income - expense], ['记录笔数', list.length]]
        .map(([k, v]) => `<div class="stat"><b>${k === '记录笔数' ? v : '¥' + Number(v).toFixed(2)}</b><span>${k}</span></div>`).join('');
      const byCat = {};
      cur.filter((x) => x.type === 'out').forEach((x) => { byCat[x.cat || '其他'] = (byCat[x.cat || '其他'] || 0) + x.amount; });
      const max = Math.max(1, ...Object.values(byCat));
      $('#lg-cats').innerHTML = Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="row" style="margin-bottom:6px"><span style="min-width:64px">${esc(k)}</span><div class="progress" style="flex:1"><i style="width:${v / max * 100}%"></i></div><span class="hint" style="min-width:70px;text-align:right">¥${v.toFixed(2)}</span></div>`).join('') || '<div class="hint">本月还没有支出</div>';
      $('#lg-list').innerHTML = list.length ? `<table class="tbl"><tr><th>日期</th><th>类型</th><th>分类</th><th>金额</th><th>备注</th><th></th></tr>${list.map((x) => `<tr><td>${x.date}</td><td>${x.type === 'in' ? '收入' : '支出'}</td><td>${esc(x.cat || '')}</td><td style="color:${x.type === 'in' ? 'var(--ok)' : 'var(--text)'}">${x.type === 'in' ? '+' : '-'}${x.amount.toFixed(2)}</td><td>${esc(x.note || '')}</td><td><button class="btn sm danger" data-del="${x.id}">删</button></td></tr>`).join('')}</table>` : '<div class="hint">还没有记录</div>';
      root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { save(load().filter((x) => x.id !== Number(b.dataset.del))); paint(); }));
    };
    $('#lg-add').onclick = () => {
      const amount = Number($('#lg-amount').value);
      if (!amount || amount <= 0) return toast('请输入有效金额', 'err');
      const l = load();
      l.unshift({ id: Date.now(), type: $('#lg-type').value, amount, cat: $('#lg-cat').value.trim(), note: $('#lg-note').value.trim(), date: today() });
      save(l); $('#lg-amount').value = ''; $('#lg-note').value = ''; paint();
    };
    $('#lg-export').onclick = () => {
      const rows = [['日期', '类型', '分类', '金额', '备注'], ...load().map((x) => [x.date, x.type === 'in' ? '收入' : '支出', x.cat, x.amount, x.note])];
      download('ledger.csv', '\ufeff' + rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
    };
    $('#lg-clear').onclick = () => { if (confirm('清空全部记账数据？')) { save([]); paint(); } };
    paint();
  },

  /* ================= 情绪与复盘 ================= */
  'mood'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>今日情绪</b><span class="hint" id="md-date"></span></div>
          <div class="row">${[['很差', 1, '#fb7185'], ['低落', 2, '#fb923c'], ['一般', 3, '#fbbf24'], ['不错', 4, '#34d399'], ['很好', 5, '#22d3ee']].map(([n, v, c]) => `<button class="btn" data-mood="${v}" style="border-color:${c}55">${n}</button>`).join('')}</div>
          <textarea class="ta" id="md-note" rows="4" style="margin-top:10px" placeholder="今天发生了什么？想记住什么？"></textarea>
          <button class="btn primary" id="md-save" style="margin-top:9px">保存复盘</button>
        </div>
        <div class="panel"><div class="panel-head"><b>最近 14 天</b></div><div id="md-chart" class="row" style="align-items:flex-end;height:120px;gap:5px"></div></div>
        <div class="panel"><div class="panel-head"><b>历史记录</b></div><div id="md-list" class="tool-ui"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#md-date').textContent = today();
    let score = 3;
    const load = () => LS.get('kt:mood', []);
    const save = (x) => LS.set('kt:mood', x);
    root.querySelectorAll('[data-mood]').forEach((b) => b.addEventListener('click', () => {
      score = Number(b.dataset.mood);
      root.querySelectorAll('[data-mood]').forEach((x) => x.classList.toggle('primary', x === b));
    }));
    const paint = () => {
      const list = load();
      const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (13 - i)); return d.toISOString().slice(0, 10); });
      $('#md-chart').innerHTML = days.map((d) => {
        const it = list.find((x) => x.date === d);
        return `<div class="center" style="flex:1"><div style="height:${it ? it.score * 18 : 4}px;background:${it ? '#38cdf0' : 'rgba(255,255,255,.08)'};border-radius:4px 4px 0 0"></div><div class="hint" style="font-size:8px">${d.slice(5)}</div></div>`;
      }).join('');
      $('#md-list').innerHTML = list.slice(0, 20).map((x) => `<div class="panel tight"><div class="row between"><b>${x.date} · ${x.score}/5</b><button class="btn sm danger" data-del="${x.id}">删除</button></div><div class="hint" style="white-space:pre-wrap;margin-top:4px">${esc(x.note)}</div></div>`).join('') || '<div class="hint">还没有记录</div>';
      root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { save(load().filter((x) => x.id !== Number(b.dataset.del))); paint(); }));
    };
    $('#md-save').onclick = () => {
      const list = load();
      const date = today();
      const exist = list.find((x) => x.date === date);
      if (exist) { exist.score = score; exist.note = $('#md-note').value; }
      else list.unshift({ id: Date.now(), date, score, note: $('#md-note').value });
      save(list); paint(); toast('已保存', 'ok');
    };
    paint();
  },

  /* ================= 清单管理 ================= */
  'shopping'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="row"><select class="sel" id="sp-list" style="max-width:160px"><option value="shopping">购物清单</option><option value="travel">旅行清单</option><option value="packing">打包清单</option></select><input class="inp" id="sp-text" placeholder="添加条目…" style="flex:1"><button class="btn primary" id="sp-add">添加</button></div>
          <div class="row" style="margin-top:8px"><button class="btn sm" id="sp-template">载入模板</button><button class="btn sm" id="sp-clear">清空已完成</button><span class="hint" id="sp-count"></span></div>
        </div>
        <div class="panel"><div id="sp-items" class="tool-ui"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const templates = {
      shopping: ['牛奶', '鸡蛋', '面包', '水果', '纸巾'],
      travel: ['身份证', '充电器', '耳机', '雨伞', '常用药'],
      packing: ['换洗衣物', '洗漱包', '运动鞋', '相机', '水杯']
    };
    const key = () => 'kt:list:' + $('#sp-list').value;
    const load = () => LS.get(key(), []);
    const save = (x) => LS.set(key(), x);
    const paint = () => {
      const list = load();
      $('#sp-count').textContent = `${list.filter((x) => !x.done).length} / ${list.length}`;
      $('#sp-items').innerHTML = list.length ? list.map((x) => `<div class="row between" style="border-bottom:1px solid var(--line);padding:7px 0"><label class="row" style="gap:8px;flex:1"><input type="checkbox" data-tog="${x.id}" ${x.done ? 'checked' : ''}><span style="${x.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(x.text)}</span></label><button class="btn sm" data-del="${x.id}">删除</button></div>`).join('') : '<div class="empty">清单是空的</div>';
      root.querySelectorAll('[data-tog]').forEach((c) => c.addEventListener('change', () => { const l = load(); const it = l.find((x) => x.id === Number(c.dataset.tog)); if (it) it.done = c.checked; save(l); paint(); }));
      root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { save(load().filter((x) => x.id !== Number(b.dataset.del))); paint(); }));
    };
    $('#sp-add').onclick = () => {
      const text = $('#sp-text').value.trim();
      if (!text) return;
      const l = load(); l.push({ id: Date.now(), text, done: false }); save(l); $('#sp-text').value = ''; paint();
    };
    $('#sp-list').addEventListener('change', paint);
    $('#sp-template').onclick = () => {
      const l = load();
      templates[$('#sp-list').value].forEach((t, i) => l.push({ id: Date.now() + i, text: t, done: false }));
      save(l); paint();
    };
    $('#sp-clear').onclick = () => { save(load().filter((x) => !x.done)); paint(); };
    paint();
  },

  /* ================= 订阅管理 ================= */
  'subscription'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="grid4">
            <div class="field"><label class="lab">名称</label><input class="inp" id="sb-name" placeholder="会员 / 云服务"></div>
            <div class="field"><label class="lab">金额</label><input class="inp" id="sb-price" type="number" placeholder="0.00"></div>
            <div class="field"><label class="lab">周期</label><select class="sel" id="sb-cycle"><option value="monthly">每月</option><option value="yearly">每年</option><option value="weekly">每周</option></select></div>
            <div class="field"><label class="lab">下次扣费</label><input class="inp" id="sb-date" type="date"></div>
          </div>
          <button class="btn primary" id="sb-add" style="margin-top:10px">添加订阅</button>
        </div>
        <div class="stat-grid" id="sb-stats"></div>
        <div class="panel"><div id="sb-list" class="tool-ui"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const load = () => LS.get('kt:subs', []);
    const save = (x) => LS.set('kt:subs', x);
    const paint = () => {
      const list = load();
      const monthly = list.reduce((s, x) => s + (x.cycle === 'yearly' ? x.price / 12 : x.cycle === 'weekly' ? x.price * 4.33 : x.price), 0);
      $('#sb-stats').innerHTML = [['订阅数量', list.length], ['月均支出', '¥' + monthly.toFixed(2)], ['年均支出', '¥' + (monthly * 12).toFixed(2)]].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
      $('#sb-list').innerHTML = list.length ? list.map((x) => {
        const days = Math.ceil((new Date(x.date + 'T00:00:00') - new Date(new Date().toDateString())) / 864e5);
        return `<div class="panel tight"><div class="row between"><div><b>${esc(x.name)}</b><div class="hint">¥${x.price.toFixed(2)} · ${x.cycle === 'yearly' ? '每年' : x.cycle === 'weekly' ? '每周' : '每月'} · 下次 ${x.date}</div></div><div class="row"><span class="pill ${days <= 3 ? 'acc' : ''}" style="color:${days <= 3 ? 'var(--warn)' : 'var(--muted)'}">${days < 0 ? '已过期' : days + ' 天后'}</span><button class="btn sm danger" data-del="${x.id}">删除</button></div></div></div>`;
      }).join('') : '<div class="hint">暂无订阅</div>';
      root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { save(load().filter((x) => x.id !== Number(b.dataset.del))); paint(); }));
    };
    $('#sb-add').onclick = () => {
      const name = $('#sb-name').value.trim();
      if (!name) return toast('请填写名称', 'err');
      const l = load(); l.push({ id: Date.now(), name, price: Number($('#sb-price').value) || 0, cycle: $('#sb-cycle').value, date: $('#sb-date').value || today() });
      save(l); $('#sb-name').value = ''; paint();
    };
    $('#sb-date').value = today();
    paint();
  },

  /* ================= 饮水与久坐 ================= */
  'water'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>饮水打卡</b><span class="hint" id="wt-date"></span></div>
          <div class="row"><button class="btn primary" data-cup="250">+ 250ml</button><button class="btn" data-cup="500">+ 500ml</button><button class="btn" data-cup="-250">撤销</button><span class="hint" id="wt-total"></span></div>
          <div class="progress" style="margin-top:12px;height:10px"><i id="wt-bar" style="width:0%"></i></div>
          <div class="hint" id="wt-goal" style="margin-top:6px">目标 2000 ml</div>
        </div>
        <div class="panel">
          <div class="panel-head"><b>久坐提醒</b><span class="hint">到点播放提示音并提醒</span></div>
          <div class="row"><input class="inp" id="wt-min" type="number" value="45" style="max-width:90px"><span class="hint">分钟</span><button class="btn primary" id="wt-start">开始提醒</button><button class="btn" id="wt-stop">停止</button><label class="row" style="gap:5px"><input type="checkbox" id="wt-wake"> 屏幕常亮</label><span class="hint" id="wt-status">未开始</span></div>
        </div>
        <div class="panel"><div class="panel-head"><b>最近 7 天</b></div><div id="wt-history" class="row" style="align-items:flex-end;height:90px;gap:8px"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#wt-date').textContent = today();
    const load = () => LS.get('kt:water', {});
    const save = (x) => LS.set('kt:water', x);
    let timer = null, wakeLock = null;
    const paint = () => {
      const data = load();
      const v = data[today()] || 0;
      $('#wt-total').textContent = `${v} / 2000 ml`;
      $('#wt-bar').style.width = Math.min(100, v / 2000 * 100) + '%';
      $('#wt-history').innerHTML = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        const key = d.toISOString().slice(0, 10);
        const n = data[key] || 0;
        return `<div class="center" style="flex:1"><div style="height:${Math.min(60, n / 2000 * 60)}px;background:${n >= 2000 ? '#34d399' : '#38cdf0'}55;border-radius:4px 4px 0 0"></div><div class="hint" style="font-size:8px">${key.slice(5)}</div><div class="hint" style="font-size:8px">${n}ml</div></div>`;
      }).join('');
    };
    root.querySelectorAll('[data-cup]').forEach((b) => b.addEventListener('click', () => {
      const data = load();
      data[today()] = Math.max(0, (data[today()] || 0) + Number(b.dataset.cup));
      save(data); paint();
    }));
    $('#wt-start').onclick = async () => {
      const min = Math.max(1, Number($('#wt-min').value) || 45);
      clearInterval(timer);
      timer = setInterval(() => {
        try {
          const ac = new (window.AudioContext || window.webkitAudioContext)();
          const o = ac.createOscillator(), g = ac.createGain();
          o.frequency.value = 880; g.gain.value = 0.15;
          o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.4);
          setTimeout(() => ac.close(), 700);
        } catch { /* */ }
        if (Notification.permission === 'granted') new Notification('该起身活动一下了', { body: '久坐提醒 · 空天工具合集' });
        else if (Notification.permission === 'default') Notification.requestPermission();
      }, min * 60000);
      $('#wt-status').textContent = `已开始，每 ${min} 分钟提醒`;
      if ($('#wt-wake').checked) {
        try { wakeLock = await navigator.wakeLock.request('screen'); } catch { /* */ }
      }
    };
    $('#wt-stop').onclick = () => {
      clearInterval(timer); timer = null;
      wakeLock?.release?.(); wakeLock = null;
      $('#wt-status').textContent = '已停止';
    };
    paint();
    const obs = new MutationObserver(() => {
      if (!document.body.contains(root)) { clearInterval(timer); wakeLock?.release?.(); obs.disconnect(); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }
};
