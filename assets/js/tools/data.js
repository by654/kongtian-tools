/* 数据、表格与可视化 */
import { esc, copy, toast, download, fmtBytes, readAs } from '../core/ui.js';
import { bindFileZone, fileZone, loadImage } from '../core/kit.js';

function splitCSV(text, delimiter = ',') {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delimiter) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
function toCSV(rows, d = ',') {
  return rows.map((r) => r.map((c) => {
    const s = String(c ?? '');
    return /["\n\r]|,/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(d)).join('\n');
}
function tableHtml(rows, max = 300) {
  if (!rows.length) return '<div class="hint">没有数据</div>';
  const head = rows[0], body = rows.slice(1, max);
  return `<table class="tbl"><thead><tr><th>#</th>${head.map((h) => `<th>${esc(String(h ?? ''))}</th>`).join('')}</tr></thead><tbody>${body.map((r, i) => `<tr><td class="dim">${i + 1}</td>${r.map((c) => `<td>${esc(String(c ?? ''))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
function nums(text) {
  return (text.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
}
function stats(arr) {
  const a = [...arr].sort((x, y) => x - y);
  const n = a.length;
  const sum = a.reduce((s, x) => s + x, 0);
  const mean = sum / n;
  const median = n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
  const freq = new Map();
  a.forEach((x) => freq.set(x, (freq.get(x) || 0) + 1));
  let mode = a[0], mc = 0;
  for (const [k, v] of freq) if (v > mc) { mc = v; mode = k; }
  const variance = a.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  const q = (p) => {
    const idx = (n - 1) * p;
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return a[lo] + (a[hi] - a[lo]) * (idx - lo);
  };
  return { n, sum, mean, median, mode, variance, std, min: a[0], max: a[n - 1], q1: q(0.25), q3: q(0.75) };
}
function luhn(s) {
  s = s.replace(/\D/g, '');
  if (s.length < 2) return false;
  let sum = 0, alt = false;
  for (let i = s.length - 1; i >= 0; i--) {
    let d = +s[i];
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    sum += d; alt = !alt;
  }
  return sum % 10 === 0;
}
function validID(id) {
  if (!/^\d{17}[\dXx]$/.test(id)) return false;
  const w = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += +id[i] * w[i];
  return '10X98765432'[sum % 11] === id[17].toUpperCase();
}
function validIBAN(s) {
  s = s.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const rearr = s.slice(4) + s.slice(0, 4);
  let rem = 0;
  for (const c of rearr) rem = (rem * 10 + (/\d/.test(c) ? +c : c.charCodeAt(0) - 55)) % 97;
  return rem === 1;
}
function validISBN(s) {
  s = s.replace(/[-\s]/g, '');
  if (s.length === 10) {
    let sum = 0;
    for (let i = 0; i < 10; i++) sum += (s[i] === 'X' ? 10 : +s[i]) * (10 - i);
    return sum % 11 === 0;
  }
  if (s.length === 13) {
    let sum = 0;
    for (let i = 0; i < 13; i++) sum += +s[i] * (i % 2 ? 3 : 1);
    return sum % 10 === 0;
  }
  return false;
}
function validEAN(s) {
  s = s.replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(s.length)) return false;
  let sum = 0;
  for (let i = 0; i < s.length - 1; i++) sum += +s[i] * (i % 2 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === +s[s.length - 1];
}
function validVIN(s) {
  s = s.replace(/\s/g, '').toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(s)) return false;
  const map = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9, S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9 };
  const w = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += (/[A-Z]/.test(s[i]) ? map[s[i]] : +s[i]) * w[i];
  const chk = sum % 11;
  return (chk === 10 ? 'X' : String(chk)) === s[8];
}

function latLonToUTM(lat, lon) {
  const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996;
  const zone = Math.floor((lon + 180) / 6) + 1;
  const lon0 = (zone - 1) * 6 - 180 + 3;
  const rad = Math.PI / 180;
  const e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  const N = a / Math.sqrt(1 - e2 * Math.sin(lat * rad) ** 2);
  const T = Math.tan(lat * rad) ** 2;
  const C = ep2 * Math.cos(lat * rad) ** 2;
  const A = Math.cos(lat * rad) * (lon - lon0) * rad;
  const M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * lat * rad
    - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * lat * rad)
    + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * lat * rad)
    - (35 * e2 ** 3 / 3072) * Math.sin(6 * lat * rad));
  const easting = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5 / 120) + 500000;
  let northing = k0 * (M + N * Math.tan(lat * rad) * (A ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24 + (61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6 / 720));
  if (lat < 0) northing += 10000000;
  return { zone, easting, northing, band: 'CDEFGHJKLMNPQRSTUVWXX'[Math.floor((lat + 80) / 8)] || '' };
}
function haversine(a, b) {
  const R = 6371008.8, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function bearing(a, b) {
  const rad = Math.PI / 180;
  const y = Math.sin((b[1] - a[1]) * rad) * Math.cos(b[0] * rad);
  const x = Math.cos(a[0] * rad) * Math.sin(b[0] * rad) - Math.sin(a[0] * rad) * Math.cos(b[0] * rad) * Math.cos((b[1] - a[1]) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

export default {
  /* ================= CSV 工作台 ================= */
  'csv-workbench'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>CSV 数据</b><span class="hint">预览、筛选、排序、去重、导出</span></div>
          ${fileZone('cw-zone', { accept: '.csv,.tsv,.txt', label: '拖入 CSV / TSV 文件，或直接粘贴到下方' })}
          <textarea class="ta mono" id="cw-in" rows="6" style="margin-top:9px" placeholder="name,age,city&#10;小明,18,北京">name,age,city
小明,18,北京
小红,22,上海
小刚,18,深圳</textarea>
          <div class="grid3" style="margin-top:9px">
            <div class="field"><label class="lab">分隔符</label><select class="sel" id="cw-delim"><option value=",">逗号</option><option value="\t">Tab</option><option value=";">分号</option></select></div>
            <div class="field"><label class="lab">排序</label><select class="sel" id="cw-sort"><option value="">不排序</option></select></div>
            <div class="field"><label class="lab">筛选（包含）</label><input class="inp" id="cw-filter" placeholder="关键词"></div>
          </div>
          <div class="row" style="margin-top:9px">
            <button class="btn primary" id="cw-run">解析</button>
            <button class="btn" id="cw-dedupe">去重</button>
            <button class="btn" id="cw-export-csv">导出 CSV</button>
            <button class="btn" id="cw-export-json">导出 JSON</button>
            <span class="hint" id="cw-meta"></span>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>预览</b><span class="hint">最多显示 300 行</span></div><div class="table-scroll" id="cw-table" style="max-height:420px"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let data = [];
    const parse = async () => {
      await ctx.deps(['papaparse']);
      const r = window.Papa.parse($('#cw-in').value, { delimiter: $('#cw-delim').value, skipEmptyLines: 'greedy' });
      data = r.data;
      const sortSel = $('#cw-sort');
      sortSel.innerHTML = '<option value="">不排序</option>' + (data[0] || []).map((h, i) => `<option value="${i}">${esc(h)}</option>`).join('');
      paint();
    };
    const paint = () => {
      if (!data.length) { $('#cw-table').innerHTML = '<div class="hint" style="padding:12px">没有数据</div>'; return; }
      const f = $('#cw-filter').value.trim().toLowerCase();
      let body = data.slice(1);
      if (f) body = body.filter((r) => r.join(' ').toLowerCase().includes(f));
      const si = $('#cw-sort').value;
      if (si !== '') body = [...body].sort((a, b) => {
        const x = a[si] ?? '', y = b[si] ?? '';
        return !isNaN(x) && !isNaN(y) && x !== '' && y !== '' ? x - y : String(x).localeCompare(String(y), 'zh-CN');
      });
      const rows = [data[0], ...body];
      $('#cw-table').innerHTML = tableHtml(rows);
      $('#cw-meta').textContent = `${body.length} 行 × ${data[0].length} 列`;
    };
    $('#cw-run').onclick = parse;
    $('#cw-filter').addEventListener('input', paint);
    $('#cw-sort').addEventListener('change', paint);
    $('#cw-dedupe').onclick = () => {
      if (!data.length) return;
      const seen = new Set();
      const rows = [data[0]];
      for (const r of data.slice(1)) {
        const k = r.join('\u0001');
        if (!seen.has(k)) { seen.add(k); rows.push(r); }
      }
      toast(`去重 ${data.length - rows.length} 行`);
      data = rows;
      paint();
    };
    $('#cw-export-csv').onclick = () => download('data.csv', toCSV(data), 'text/csv');
    $('#cw-export-json').onclick = () => {
      if (!data.length) return;
      const head = data[0];
      download('data.json', JSON.stringify(data.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? '']))), null, 2), 'application/json');
    };
    bindFileZone(root, 'cw-zone', async (files) => {
      $('#cw-in').value = await readAs(files[0], 'text');
      parse();
    });
    parse();
  },

  /* ================= 表格格式转换 ================= */
  'table-convert'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>表格格式互转</b><span class="hint">CSV / TSV / Markdown / HTML / JSON</span></div>
          <textarea class="ta mono" id="tc-in" rows="9">name,age
小明,18
小红,22</textarea>
          <div class="row" style="margin-top:10px">
            <select class="sel" id="tc-from" style="max-width:130px"><option value="csv">CSV</option><option value="tsv">TSV</option><option value="md">Markdown</option><option value="html">HTML</option><option value="json">JSON</option></select>
            <span class="hint">→</span>
            <select class="sel" id="tc-to" style="max-width:130px"><option value="md">Markdown</option><option value="csv">CSV</option><option value="json">JSON</option><option value="html">HTML</option><option value="tsv">TSV</option></select>
            <button class="btn primary" id="tc-run">转换</button><button class="btn" id="tc-copy">复制</button>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b></div><pre class="out" id="tc-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const parseAny = (s, from) => {
      if (from === 'csv' || from === 'tsv') return splitCSV(s, from === 'csv' ? ',' : '\t');
      if (from === 'md') {
        return s.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())).filter((r) => !r.every((c) => /^-+$/.test(c)));
      }
      if (from === 'html') {
        const d = new DOMParser().parseFromString(s, 'text/html');
        return [...d.querySelectorAll('tr')].map((tr) => [...tr.children].map((td) => td.textContent.trim()));
      }
      const j = JSON.parse(s);
      if (!Array.isArray(j)) throw new Error('JSON 需要是数组');
      if (!j.length) return [];
      if (Array.isArray(j[0])) return j;
      const head = Object.keys(j[0]);
      return [head, ...j.map((o) => head.map((k) => o[k]))];
    };
    const build = (rows, to) => {
      if (to === 'md') return `| ${rows[0].join(' | ')} |\n| ${rows[0].map(() => '---').join(' | ')} |\n${rows.slice(1).map((r) => `| ${r.join(' | ')} |`).join('\n')}`;
      if (to === 'csv') return toCSV(rows);
      if (to === 'tsv') return toCSV(rows, '\t');
      if (to === 'json') return JSON.stringify(rows.slice(1).map((r) => Object.fromEntries(rows[0].map((h, i) => [h, r[i] ?? '']))), null, 2);
      return `<table>\n${rows.map((r, i) => `  <tr>${r.map((c) => i ? `<td>${esc(String(c))}</td>` : `<th>${esc(String(c))}</th>`).join('')}</tr>`).join('\n')}\n</table>`;
    };
    $('#tc-run').onclick = () => {
      try { $('#tc-out').textContent = build(parseAny($('#tc-in').value, $('#tc-from').value), $('#tc-to').value); }
      catch (e) { $('#tc-out').textContent = '转换失败：' + e.message; }
    };
    $('#tc-copy').onclick = () => copy($('#tc-out').textContent);
    $('#tc-run').click();
  },

  /* ================= 统计计算 ================= */
  'data-stats'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>统计数据</b><span class="hint">每行一个数字，也支持逗号/空格分隔</span></div>
          <textarea class="ta mono" id="ds-in" rows="8">12, 15, 18, 20, 22, 25, 30, 35, 40, 42</textarea>
          <div class="field" style="margin-top:9px"><label class="lab">第二组数据（用于相关系数与回归，可选）</label><textarea class="ta mono" id="ds-y" rows="3" placeholder="与第一组数量一致"></textarea></div>
          <button class="btn primary" id="ds-run" style="margin-top:9px">计算</button>
        </div>
        <div class="stat-grid" id="ds-out"></div>
        <div class="panel"><div class="panel-head"><b>相关系数与线性回归</b></div><pre class="out" id="ds-reg"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#ds-run').onclick = () => {
      const a = nums($('#ds-in').value);
      if (!a.length) { $('#ds-out').innerHTML = '<div class="hint">请输入数字</div>'; return; }
      const s = stats(a);
      $('#ds-out').innerHTML = [
        ['样本数', s.n], ['总和', s.sum], ['平均数', s.mean], ['中位数', s.median], ['众数', s.mode],
        ['标准差', s.std], ['方差', s.variance], ['最小值', s.min], ['最大值', s.max], ['Q1', s.q1], ['Q3', s.q3], ['极差', s.max - s.min]
      ].map(([k, v]) => `<div class="stat"><b>${Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 3 })}</b><span>${k}</span></div>`).join('');
      const b = nums($('#ds-y').value);
      if (b.length === a.length && a.length > 1) {
        const ma = a.reduce((x, y) => x + y, 0) / a.length, mb = b.reduce((x, y) => x + y, 0) / b.length;
        let cov = 0, va = 0, vb = 0;
        for (let i = 0; i < a.length; i++) { cov += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; }
        const r = cov / Math.sqrt(va * vb);
        const slope = cov / va, intercept = mb - slope * ma;
        $('#ds-reg').textContent = `皮尔逊相关系数 r = ${r.toFixed(4)}\n决定系数 R² = ${(r * r).toFixed(4)}\n回归方程 y = ${slope.toFixed(4)}x + ${intercept.toFixed(4)}`;
      } else $('#ds-reg').textContent = '两组数据数量一致时显示相关性与回归。';
    };
    $('#ds-run').click();
  },

  /* ================= 数据校验 ================= */
  'data-validate'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>数据校验</b><span class="hint">只做算法校验，不联网</span></div>
          <div class="grid2">
            <div class="field"><label class="lab">类型</label><select class="sel" id="dv-type">
              <option value="email">邮箱</option><option value="phone">手机号</option><option value="id">身份证（18 位）</option>
              <option value="luhn">银行卡 / Luhn</option><option value="iban">IBAN</option><option value="isbn">ISBN</option>
              <option value="ean">EAN / UPC</option><option value="vin">VIN 车架号</option><option value="imei">IMEI</option>
            </select></div>
            <div class="field"><label class="lab">输入（每行一条）</label><input class="inp mono" id="dv-in" value="test@example.com"></div>
          </div>
          <textarea class="ta mono" id="dv-list" rows="6" style="margin-top:9px" placeholder="批量校验时，每行一条…"></textarea>
          <button class="btn primary" id="dv-run" style="margin-top:9px">校验</button>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b><span class="hint" id="dv-meta"></span></div><div id="dv-out"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const check = (v, t) => {
      if (t === 'email') return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(v);
      if (t === 'phone') return /^1[3-9]\d{9}$/.test(v.replace(/[\s-]/g, ''));
      if (t === 'id') return validID(v.trim());
      if (t === 'luhn') return luhn(v);
      if (t === 'iban') return validIBAN(v);
      if (t === 'isbn') return validISBN(v);
      if (t === 'ean') return validEAN(v);
      if (t === 'vin') return validVIN(v);
      return luhn(v);
    };
    $('#dv-run').onclick = () => {
      const t = $('#dv-type').value;
      const list = ($('#dv-list').value.trim() ? $('#dv-list').value : $('#dv-in').value).split(/\r?\n/).filter((x) => x.trim());
      const res = list.map((v) => ({ v: v.trim(), ok: check(v, t) }));
      const ok = res.filter((x) => x.ok).length;
      $('#dv-meta').textContent = `${ok} / ${res.length} 通过`;
      $('#dv-out').innerHTML = res.map((x) => `<div class="row between" style="padding:5px 0;border-bottom:1px solid var(--line)"><span class="mono">${esc(x.v)}</span><span style="color:${x.ok ? 'var(--ok)' : 'var(--err)'}">${x.ok ? '✓ 有效' : '✗ 无效'}</span></div>`).join('') || '<div class="hint">没有输入</div>';
    };
    $('#dv-run').click();
  },

  /* ================= 分组与透视 ================= */
  'data-pivot'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>分组统计 / 透视表</b><span class="hint">粘贴 CSV，选择分组列与汇总列</span></div>
          <textarea class="ta mono" id="dp-in" rows="7">部门,姓名,金额
销售,小明,1200
销售,小红,800
技术,小刚,1500
技术,小李,900
技术,小王,1100</textarea>
          <div class="grid4" style="margin-top:9px">
            <div class="field"><label class="lab">分组列</label><select class="sel" id="dp-group"></select></div>
            <div class="field"><label class="lab">汇总列</label><select class="sel" id="dp-value"></select></div>
            <div class="field"><label class="lab">聚合</label><select class="sel" id="dp-agg"><option value="sum">求和</option><option value="count">计数</option><option value="avg">平均</option><option value="min">最小</option><option value="max">最大</option></select></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="dp-run" style="width:100%">计算</button></div>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b><span class="hint" id="dp-meta"></span></div><div id="dp-out"></div></div>
        <div class="panel"><div class="panel-head"><b>分组柱状图</b></div><div class="canvas-wrap"><canvas id="dp-chart" height="220"></canvas></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let chart = null;
    const load = () => {
      const rows = splitCSV($('#dp-in').value);
      if (rows.length < 2) return;
      const head = rows[0];
      $('#dp-group').innerHTML = head.map((h, i) => `<option value="${i}">${esc(h)}</option>`).join('');
      $('#dp-value').innerHTML = head.map((h, i) => `<option value="${i}">${esc(h)}</option>`).join('');
      $('#dp-value').value = String(head.length - 1);
    };
    $('#dp-run').onclick = () => {
      const rows = splitCSV($('#dp-in').value).slice(1);
      const gi = Number($('#dp-group').value), vi = Number($('#dp-value').value), agg = $('#dp-agg').value;
      const map = new Map();
      for (const r of rows) {
        const k = r[gi] ?? '', v = Number(r[vi]);
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(v);
      }
      const out = [];
      for (const [k, arr] of map) {
        const vals = arr.filter((x) => !isNaN(x));
        let v = 0;
        if (agg === 'sum') v = vals.reduce((a, b) => a + b, 0);
        else if (agg === 'count') v = arr.length;
        else if (agg === 'avg') v = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
        else if (agg === 'min') v = Math.min(...vals);
        else v = Math.max(...vals);
        out.push([k, v]);
      }
      out.sort((a, b) => b[1] - a[1]);
      $('#dp-out').innerHTML = `<table class="tbl"><tr><th>分组</th><th>${agg}</th></tr>${out.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="mono">${(+v).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}</td></tr>`).join('')}</table>`;
      $('#dp-meta').textContent = `${out.length} 组`;
      if (chart) chart.destroy();
      if (window.Chart) {
        chart = new window.Chart($('#dp-chart'), {
          type: 'bar',
          data: { labels: out.map((x) => x[0]), datasets: [{ label: agg, data: out.map((x) => x[1]), backgroundColor: 'rgba(56,205,240,.55)', borderColor: '#38cdf0', borderWidth: 1, borderRadius: 5 }] },
          options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#8b9bb8' }, grid: { color: 'rgba(255,255,255,.06)' } }, y: { ticks: { color: '#8b9bb8' }, grid: { color: 'rgba(255,255,255,.06)' } } } }
        });
      }
    };
    $('#dp-in').addEventListener('change', load);
    load();
    // 首次计算需要 Chart.js；不阻塞，用户点击时如果没有则加载
    $('#dp-run').addEventListener('click', async () => {
      if (!window.Chart) {
        await import('../core/deps.js').then((m) => m.loadDeps(['chartjs'])).catch(() => {});
        $('#dp-run').click();
      }
    }, { once: true });
  },

  /* ================= 图表 ================= */
  'chart-maker'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>图表生成</b><span class="hint">粘贴 CSV 或每行「标签,数值」</span></div>
          <textarea class="ta mono" id="cm-in" rows="7">一月,120
二月,180
三月,150
四月,220
五月,260</textarea>
          <div class="grid4" style="margin-top:9px">
            <div class="field"><label class="lab">类型</label><select class="sel" id="cm-type"><option value="line">折线图</option><option value="bar">柱状图</option><option value="pie">饼图</option><option value="doughnut">环形图</option><option value="radar">雷达图</option></select></div>
            <div class="field"><label class="lab">标题</label><input class="inp" id="cm-title" value="月度数据"></div>
            <div class="field"><label class="lab">配色</label><select class="sel" id="cm-theme"><option value="aurora">极光</option><option value="sunset">日落</option><option value="mono">单色</option></select></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="cm-run" style="width:100%">生成</button></div>
          </div>
          <div class="row" style="margin-top:8px"><button class="btn" id="cm-png">下载 PNG</button><span class="hint" id="cm-meta"></span></div>
        </div>
        <div class="panel"><div class="canvas-wrap"><canvas id="cm-canvas" height="300"></canvas></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let chart = null;
    const palettes = {
      aurora: ['#22d3ee', '#818cf8', '#34d399', '#fbbf24', '#f472b6', '#a78bfa'],
      sunset: ['#fb7185', '#fbbf24', '#f472b6', '#fdba74', '#c084fc'],
      mono: ['#38cdf0', '#7dd3fc', '#bae6fd', '#e0f2fe']
    };
    const render = async () => {
      try {
        await ctx.deps(['chartjs']);
        const rows = splitCSV($('#cm-in').value).filter((r) => r.length >= 2);
        if (!rows.length) throw new Error('没有数据');
        const labels = rows.map((r) => r[0]);
        const values = rows.map((r) => Number(r[1]));
        const type = $('#cm-type').value;
        const colors = palettes[$('#cm-theme').value];
        if (chart) chart.destroy();
        const isPie = type === 'pie' || type === 'doughnut';
        chart = new window.Chart($('#cm-canvas'), {
          type,
          data: {
            labels,
            datasets: [{
              label: $('#cm-title').value, data: values,
              backgroundColor: isPie ? labels.map((_, i) => colors[i % colors.length] + 'cc') : colors[0] + '55',
              borderColor: isPie ? '#0b1220' : colors[0], borderWidth: isPie ? 2 : 2,
              fill: type === 'line', tension: 0.35, pointBackgroundColor: colors[0], pointRadius: 3
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: isPie, labels: { color: '#8b9bb8' } }, title: { display: !!$('#cm-title').value, text: $('#cm-title').value, color: '#e9eefc' } },
            scales: isPie ? {} : { x: { ticks: { color: '#8b9bb8' }, grid: { color: 'rgba(255,255,255,.06)' } }, y: { ticks: { color: '#8b9bb8' }, grid: { color: 'rgba(255,255,255,.06)' } } }
          }
        });
        $('#cm-meta').textContent = `${rows.length} 个数据点`;
      } catch (e) { toast(e.message, 'err'); }
    };
    $('#cm-run').onclick = render;
    $('#cm-png').onclick = () => {
      if (!chart) return toast('先生成图表', 'err');
      $('#cm-canvas').toBlob((b) => download('chart.png', b), 'image/png');
    };
    render();
  },

  /* ================= SQLite ================= */
  'sqlite-browser'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>SQLite 浏览器</b><span class="hint">sql.js 在浏览器内运行，数据只在内存中</span></div>
          <textarea class="ta mono" id="sq-in" rows="5">SELECT 1 AS id, 'hello' AS message;</textarea>
          <div class="row" style="margin-top:9px">
            <button class="btn primary" id="sq-run">执行 SQL</button>
            <button class="btn" id="sq-init">初始化示例表</button>
            <button class="btn" id="sq-export">导出数据库</button>
            <span class="hint" id="sq-meta">尚未初始化</span>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b></div><div class="table-scroll" id="sq-out" style="max-height:420px;padding:8px"><div class="hint">加载 sql.js 后执行第一条 SQL…</div></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let db = null;
    const init = async () => {
      await ctx.deps(['sqljs']);
      if (!db) {
        const SQL = await window.initSqlJs({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/${f}` });
        db = new SQL.Database();
        $('#sq-meta').textContent = '数据库已就绪（内存）';
      }
      return db;
    };
    $('#sq-init').onclick = async () => {
      try {
        await init();
        db.run(`CREATE TABLE IF NOT EXISTS tools (id INTEGER PRIMARY KEY, name TEXT, category TEXT, stars INTEGER);
INSERT INTO tools (name, category, stars) VALUES ('JSON 工作台','开发',128),('二维码生成','二维码',96),('图片压缩','图片',87);`);
        $('#sq-out').innerHTML = '<div class="okbox">已创建 tools 表并插入 3 条示例数据。</div>';
      } catch (e) { $('#sq-out').innerHTML = `<div class="errbox">${esc(e.message)}</div>`; }
    };
    $('#sq-run').onclick = async () => {
      try {
        await init();
        const res = db.exec($('#sq-in').value);
        if (!res.length) { $('#sq-out').innerHTML = '<div class="okbox">执行成功，无返回结果。</div>'; return; }
        $('#sq-out').innerHTML = res.map((r) => `<div class="hint" style="margin:6px 0">${r.columns.length} 列 · ${r.values.length} 行</div><table class="tbl"><tr>${r.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>${r.values.map((row) => `<tr>${row.map((c) => `<td>${esc(String(c ?? ''))}</td>`).join('')}</tr>`).join('')}</table>`).join('');
      } catch (e) { $('#sq-out').innerHTML = `<div class="errbox">${esc(e.message)}</div>`; }
    };
    $('#sq-export').onclick = async () => {
      try {
        await init();
        download('kongtian.db', new Blob([db.export()], { type: 'application/octet-stream' }));
      } catch (e) { toast(e.message, 'err'); }
    };
  },

  /* ================= IP / CIDR ================= */
  'ip-cidr'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>IPv4 / CIDR 计算</b><span class="hint">子网、掩码、可用地址范围</span></div>
          <div class="row">
            <input class="inp mono" id="ip-in" value="192.168.31.65/24" style="flex:1;min-width:200px">
            <button class="btn primary" id="ip-run">计算</button>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b></div><div id="ip-out"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const ipToInt = (ip) => ip.split('.').reduce((a, b) => (a << 8) + Number(b), 0) >>> 0;
    const intToIp = (n) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.');
    $('#ip-run').onclick = () => {
      try {
        const [ip, bitsStr] = $('#ip-in').value.trim().split('/');
        const bits = bitsStr === undefined ? 32 : Number(bitsStr);
        if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip) || bits < 0 || bits > 32) throw new Error('格式应为 192.168.1.1/24');
        const n = ipToInt(ip);
        const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
        const network = (n & mask) >>> 0;
        const broadcast = (network | (~mask >>> 0)) >>> 0;
        const count = 2 ** (32 - bits);
        const rows = [
          ['IP 地址', ip], ['CIDR', `${ip}/${bits}`], ['子网掩码', intToIp(mask)],
          ['网络地址', intToIp(network)], ['广播地址', intToIp(broadcast)],
          ['可用地址范围', bits >= 31 ? '—' : `${intToIp(network + 1)} – ${intToIp(broadcast - 1)}`],
          ['地址总数', count.toLocaleString('zh-CN')],
          ['可用主机数', bits >= 31 ? (bits === 32 ? 1 : 2).toString() : (count - 2).toLocaleString('zh-CN')],
          ['IP 十进制', n]
        ];
        $('#ip-out').innerHTML = `<div class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd class="mono">${esc(String(v))}</dd>`).join('')}</div>`;
      } catch (e) { $('#ip-out').innerHTML = `<div class="errbox">${esc(e.message)}</div>`; }
    };
    $('#ip-run').click();
  },

  /* ================= 地理计算 ================= */
  'geo-tools'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="ge-tabs"><button class="tab active" data-i="0">距离与方位</button><button class="tab" data-i="1">多边形面积</button><button class="tab" data-i="2">UTM 转换</button></div>
        <div class="panel" id="ge-p0">
          <div class="grid2">
            <div class="field"><label class="lab">点 A（纬度, 经度）</label><input class="inp mono" id="ge-a" value="39.9042, 116.4074"></div>
            <div class="field"><label class="lab">点 B（纬度, 经度）</label><input class="inp mono" id="ge-b" value="31.2304, 121.4737"></div>
          </div>
          <button class="btn primary" id="ge-run" style="margin-top:9px">计算</button>
          <pre class="out" id="ge-out" style="margin-top:9px"></pre>
        </div>
        <div class="panel hidden" id="ge-p1">
          <div class="field"><label class="lab">顶点（每行 lat,lng）</label><textarea class="ta mono" id="ge-poly" rows="5">39.9,116.4
40.0,116.5
39.95,116.6</textarea></div>
          <button class="btn primary" id="ge-area" style="margin-top:9px">计算面积与周长</button>
          <pre class="out" id="ge-area-out" style="margin-top:9px"></pre>
        </div>
        <div class="panel hidden" id="ge-p2">
          <div class="grid2">
            <div class="field"><label class="lab">纬度</label><input class="inp" id="ge-lat" value="39.9042"></div>
            <div class="field"><label class="lab">经度</label><input class="inp" id="ge-lon" value="116.4074"></div>
          </div>
          <button class="btn primary" id="ge-utm" style="margin-top:9px">转 UTM</button>
          <pre class="out" id="ge-utm-out" style="margin-top:9px"></pre>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#ge-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#ge-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      [0, 1, 2].forEach((i) => $('#ge-p' + i).classList.toggle('hidden', String(i) !== b.dataset.i));
    });
    const parsePt = (s) => s.split(/[,，\s]+/).map(Number);
    $('#ge-run').onclick = () => {
      const a = parsePt($('#ge-a').value), b = parsePt($('#ge-b').value);
      if (a.length < 2 || b.length < 2) { $('#ge-out').textContent = '格式错误'; return; }
      const d = haversine(a, b), br = bearing(a, b);
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      $('#ge-out').textContent = `距离：${(d / 1000).toFixed(3)} km（${d.toFixed(0)} m）\n方位角：${br.toFixed(1)}°\n中点：${mid[0].toFixed(5)}, ${mid[1].toFixed(5)}`;
    };
    $('#ge-area').onclick = () => {
      const pts = $('#ge-poly').value.split(/\r?\n/).filter((x) => x.trim()).map(parsePt);
      if (pts.length < 3) { $('#ge-area-out').textContent = '至少需要 3 个顶点'; return; }
      const R = 6371008.8, rad = Math.PI / 180;
      let area = 0, per = 0;
      for (let i = 0; i < pts.length; i++) {
        const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
        area += (p2[1] - p1[1]) * rad * (2 + Math.sin(p1[0] * rad) + Math.sin(p2[0] * rad));
        per += haversine(p1, p2);
      }
      area = Math.abs(area * R * R / 2);
      $('#ge-area-out').textContent = `面积：${(area / 1e6).toFixed(4)} km²（${area.toFixed(0)} m²）\n周长：${(per / 1000).toFixed(3)} km`;
    };
    $('#ge-utm').onclick = () => {
      const r = latLonToUTM(Number($('#ge-lat').value), Number($('#ge-lon').value));
      $('#ge-utm-out').textContent = `UTM Zone ${r.zone}${r.band}\nEasting: ${r.easting.toFixed(2)} m\nNorthing: ${r.northing.toFixed(2)} m`;
    };
    $('#ge-run').click();
  },

  /* ================= Geo 文件 ================= */
  'geo-file'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>GeoJSON / GPX / KML</b><span class="hint">查看、格式化、KML/GPX 转 GeoJSON</span></div>
          <textarea class="ta mono" id="gf-in" rows="9" placeholder="粘贴 GeoJSON、GPX 或 KML…"></textarea>
          <div class="row" style="margin-top:9px">
            <button class="btn primary" id="gf-run">解析</button>
            <button class="btn" id="gf-geo">转 GeoJSON</button>
            <button class="btn" id="gf-copy">复制</button>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b><span class="hint" id="gf-meta"></span></div><pre class="out" id="gf-out" style="max-height:420px"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let current = null;
    const gpxToGeo = (doc) => {
      const feats = [];
      doc.querySelectorAll('trkpt,wpt,rtept').forEach((p) => {
        feats.push({ type: 'Feature', properties: { name: p.querySelector('name')?.textContent || '', ele: p.querySelector('ele')?.textContent || '' }, geometry: { type: 'Point', coordinates: [+p.getAttribute('lon'), +p.getAttribute('lat')] } });
      });
      return { type: 'FeatureCollection', features: feats };
    };
    const kmlToGeo = (doc) => {
      const feats = [];
      doc.querySelectorAll('Placemark').forEach((pm) => {
        const name = pm.querySelector('name')?.textContent || '';
        const coordText = pm.querySelector('coordinates')?.textContent?.trim();
        if (coordText) {
          const coords = coordText.split(/\s+/).map((c) => c.split(',').map(Number).slice(0, 2));
          feats.push({ type: 'Feature', properties: { name }, geometry: { type: coords.length > 1 ? 'LineString' : 'Point', coordinates: coords.length > 1 ? coords : coords[0] } });
        }
      });
      return { type: 'FeatureCollection', features: feats };
    };
    $('#gf-run').onclick = () => {
      const s = $('#gf-in').value.trim();
      try {
        if (s.startsWith('<')) {
          const doc = new DOMParser().parseFromString(s, 'application/xml');
          if (doc.querySelector('parsererror')) throw new Error('XML 解析失败');
          const rootName = doc.documentElement.nodeName;
          current = /gpx/i.test(rootName) ? gpxToGeo(doc) : kmlToGeo(doc);
          $('#gf-meta').textContent = `${rootName} · ${current.features.length} 个要素`;
          $('#gf-out').textContent = JSON.stringify(current, null, 2);
        } else {
          current = JSON.parse(s);
          $('#gf-meta').textContent = `${current.type || 'JSON'} · ${current.features?.length ?? 0} 个要素`;
          $('#gf-out').textContent = JSON.stringify(current, null, 2);
        }
      } catch (e) { $('#gf-out').textContent = '解析失败：' + e.message; }
    };
    $('#gf-geo').onclick = () => {
      try {
        const s = $('#gf-in').value.trim();
        if (s.startsWith('<')) $('#gf-run').click();
        else { current = JSON.parse(s); $('#gf-out').textContent = JSON.stringify(current, null, 2); }
        $('#gf-meta').textContent = '已转换为 GeoJSON';
      } catch (e) { $('#gf-out').textContent = '失败：' + e.message; }
    };
    $('#gf-copy').onclick = () => copy($('#gf-out').textContent);
  },

  /* ================= 可视化 ================= */
  'visualization'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="vz-tabs"><button class="tab active" data-i="0">词云</button><button class="tab" data-i="1">日历热力图</button><button class="tab" data-i="2">甘特图</button><button class="tab" data-i="3">时间轴</button></div>
        <div class="panel" id="vz-p0">
          <div class="field"><label class="lab">词语与权重（每行：词,权重）</label><textarea class="ta mono" id="vz-words" rows="6">空天,10
工具,9
浏览器,8
本地,7
隐私,6
效率,5
二维码,4
图片,4
PDF,3
音频,3</textarea></div>
          <button class="btn primary" id="vz-word-run" style="margin-top:9px">生成词云</button>
          <div class="canvas-wrap" style="margin-top:10px"><canvas id="vz-word" width="760" height="380"></canvas></div>
        </div>
        <div class="panel hidden" id="vz-p1">
          <div class="field"><label class="lab">日期列表（每行 YYYY-MM-DD）</label><textarea class="ta mono" id="vz-dates" rows="5">2026-11-01
2026-11-02
2026-11-02
2026-11-05
2026-11-08</textarea></div>
          <button class="btn primary" id="vz-heat-run" style="margin-top:9px">生成热力图</button>
          <div class="canvas-wrap" style="margin-top:10px"><canvas id="vz-heat" width="760" height="150"></canvas></div>
        </div>
        <div class="panel hidden" id="vz-p2">
          <div class="field"><label class="lab">任务（每行：名称,开始,结束）</label><textarea class="ta mono" id="vz-tasks" rows="5">设计,2026-11-01,2026-11-05
开发,2026-11-04,2026-11-15
测试,2026-11-14,2026-11-20
上线,2026-11-21,2026-11-22</textarea></div>
          <button class="btn primary" id="vz-gantt-run" style="margin-top:9px">生成甘特图</button>
          <div class="canvas-wrap" style="margin-top:10px"><canvas id="vz-gantt" width="760" height="240"></canvas></div>
        </div>
        <div class="panel hidden" id="vz-p3">
          <div class="field"><label class="lab">事件（每行：日期,事件）</label><textarea class="ta mono" id="vz-events" rows="5">2026-01,立项
2026-06,内测
2026-11,正式发布</textarea></div>
          <button class="btn primary" id="vz-tl-run" style="margin-top:9px">生成时间轴</button>
          <div id="vz-timeline" style="margin-top:12px"></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#vz-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#vz-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      [0, 1, 2, 3].forEach((i) => $('#vz-p' + i).classList.toggle('hidden', String(i) !== b.dataset.i));
    });
    const colors = ['#38cdf0', '#818cf8', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#22d3ee'];
    $('#vz-word-run').onclick = () => {
      const words = $('#vz-words').value.split(/\r?\n/).map((l) => l.split(/[,，]/)).filter((x) => x[0]);
      const cv = $('#vz-word'); const g = cv.getContext('2d');
      g.clearRect(0, 0, cv.width, cv.height);
      const max = Math.max(...words.map((x) => Number(x[1]) || 1));
      const placed = [];
      for (const [w, wt] of words) {
        const size = 12 + (Number(wt) || 1) / max * 46;
        let x, y, ok = false;
        for (let i = 0; i < 400 && !ok; i++) {
          x = 30 + Math.random() * (cv.width - 100);
          y = 40 + Math.random() * (cv.height - 70);
          ok = !placed.some((p) => Math.abs(p.x - x) < (p.w + w.length * size * 0.6) / 2 && Math.abs(p.y - y) < (p.h + size) / 2);
        }
        if (!ok) continue;
        placed.push({ x, y, w: w.length * size * 0.62, h: size });
        g.font = `700 ${size}px -apple-system, "PingFang SC", sans-serif`;
        g.fillStyle = colors[placed.length % colors.length];
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(w, x, y);
      }
    };
    $('#vz-heat-run').onclick = () => {
      const cv = $('#vz-heat'); const g = cv.getContext('2d');
      g.clearRect(0, 0, cv.width, cv.height);
      const counts = new Map();
      $('#vz-dates').value.split(/\r?\n/).forEach((d) => { if (d.trim()) counts.set(d.trim(), (counts.get(d.trim()) || 0) + 1); });
      const today = new Date(); const start = new Date(today); start.setDate(start.getDate() - 25 * 7);
      const cell = 12, gap = 3, left = 26, top = 24;
      const max = Math.max(1, ...counts.values());
      for (let w = 0; w < 26; w++) for (let d = 0; d < 7; d++) {
        const day = new Date(start); day.setDate(start.getDate() + w * 7 + d);
        const key = day.toISOString().slice(0, 10);
        const n = counts.get(key) || 0;
        g.fillStyle = n ? `rgba(56,205,240,${0.2 + 0.8 * (n / max)})` : 'rgba(255,255,255,.06)';
        g.fillRect(left + w * (cell + gap), top + d * (cell + gap), cell, cell);
      }
      g.fillStyle = '#8b9bb8'; g.font = '10px sans-serif'; g.textAlign = 'left';
      g.fillText('过去 26 周', left, 14);
      $('#vz-heat').title = `${counts.size} 天有记录`;
    };
    $('#vz-gantt-run').onclick = () => {
      const cv = $('#vz-gantt'); const g = cv.getContext('2d');
      g.clearRect(0, 0, cv.width, cv.height);
      const tasks = $('#vz-tasks').value.split(/\r?\n/).map((l) => l.split(/[,，]/)).filter((x) => x.length >= 3);
      const dates = tasks.flatMap((t) => [new Date(t[1]), new Date(t[2])]).filter((d) => !isNaN(d));
      if (!dates.length) return;
      const min = Math.min(...dates), max = Math.max(...dates);
      const span = Math.max(1, max - min);
      const rowH = Math.min(34, (cv.height - 40) / Math.max(1, tasks.length));
      tasks.forEach((t, i) => {
        const s = new Date(t[1]), e = new Date(t[2]);
        const x = 120 + (s - min) / span * (cv.width - 150);
        const w = Math.max(4, (e - s) / span * (cv.width - 150));
        g.fillStyle = colors[i % colors.length] + 'aa';
        g.fillRect(x, 26 + i * rowH, w, rowH - 8);
        g.fillStyle = '#c3cfe6'; g.font = '11px sans-serif'; g.textAlign = 'right';
        g.fillText(t[0].slice(0, 10), 112, 26 + i * rowH + (rowH - 8) / 2 + 4);
      });
      g.strokeStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.moveTo(120, 18); g.lineTo(120, 26 + tasks.length * rowH); g.stroke();
    };
    $('#vz-tl-run').onclick = () => {
      const items = $('#vz-events').value.split(/\r?\n/).map((l) => l.split(/[,，]/)).filter((x) => x[0]);
      $('#vz-timeline').innerHTML = `<div style="border-left:2px solid rgba(56,205,240,.4);padding-left:16px">${items.map(([d, e]) => `<div style="position:relative;padding:7px 0"><span style="position:absolute;left:-22px;top:13px;width:9px;height:9px;border-radius:50%;background:var(--acc)"></span><b class="mono" style="color:var(--acc)">${esc(d)}</b><div class="hint">${esc(e)}</div></div>`).join('')}</div>`;
    };
    $('#vz-word-run').click();
  }
};
