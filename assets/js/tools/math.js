/* 数学、计算与单位换算 */
import { esc, copy, toast } from '../core/ui.js';

const n = (id) => Number(document.getElementById(id)?.value || 0);
const q = (root, s) => root.querySelector(s);
const money = (x) => (isFinite(x) ? x.toLocaleString('zh-CN', { maximumFractionDigits: 2, minimumFractionDigits: 2 }) : '—');
const pct = (x) => (isFinite(x) ? (x * 100).toFixed(2) + '%' : '—');

const UNIT_GROUPS = {
  length: { name: '长度', base: 'm', units: { 米: 1, 千米: 1000, 厘米: 0.01, 毫米: 0.001, 微米: 1e-6, 英里: 1609.344, 码: 0.9144, 英尺: 0.3048, 英寸: 0.0254, 海里: 1852, 里: 500, 丈: 3.3333, 尺: 0.3333 } },
  mass: { name: '重量', base: 'kg', units: { 千克: 1, 克: 0.001, 毫克: 1e-6, 吨: 1000, 磅: 0.45359237, 盎司: 0.0283495, 斤: 0.5, 两: 0.05 } },
  area: { name: '面积', base: 'm²', units: { '平方米': 1, '平方千米': 1e6, '平方厘米': 1e-4, '公顷': 10000, '亩': 666.6667, '英亩': 4046.86, '平方英尺': 0.092903 } },
  volume: { name: '体积', base: 'L', units: { 升: 1, 毫升: 0.001, 立方米: 1000, '加仑(US)': 3.78541, 夸脱: 0.946353, 液量盎司: 0.0295735, 杯: 0.24 } },
  speed: { name: '速度', base: 'm/s', units: { '米/秒': 1, '千米/时': 0.277778, '英里/时': 0.44704, 节: 0.514444, '英尺/秒': 0.3048 } },
  pressure: { name: '压力', base: 'Pa', units: { 帕: 1, 千帕: 1000, 兆帕: 1e6, 巴: 1e5, 标准大气压: 101325, PSI: 6894.76, '毫米汞柱': 133.322 } },
  energy: { name: '能量', base: 'J', units: { 焦: 1, 千焦: 1000, 卡: 4.184, 千卡: 4184, 瓦时: 3600, 千瓦时: 3.6e6, BTU: 1055.06 } },
  power: { name: '功率', base: 'W', units: { 瓦: 1, 千瓦: 1000, 兆瓦: 1e6, 马力: 745.7, 公制马力: 735.5 } },
  data: { name: '数据存储', base: 'B', units: { B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776, bit: 0.125, Kbit: 128, Mbit: 131072 } },
  time: { name: '时间', base: 's', units: { 秒: 1, 毫秒: 0.001, 分钟: 60, 小时: 3600, 天: 86400, 周: 604800, 年: 31557600 } },
  angle: { name: '角度', base: 'deg', units: { 度: 1, 弧度: 57.29578, 百分度: 0.9, 圈: 360 } }
};

function unitConvert(cat, v, from, to) {
  if (!cat || !UNIT_GROUPS[cat]) throw new Error('未知单位类别');
  const g = UNIT_GROUPS[cat];
  return v * g.units[from] / g.units[to];
}
function tempConvert(v, from, to) {
  let c = v;
  if (from === 'F') c = (v - 32) * 5 / 9;
  if (from === 'K') c = v - 273.15;
  if (to === 'C') return c;
  if (to === 'F') return c * 9 / 5 + 32;
  return c + 273.15;
}
function determinant(m) {
  const a = m.map((r) => [...r]);
  const n = a.length;
  let det = 1;
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let j = i + 1; j < n; j++) if (Math.abs(a[j][i]) > Math.abs(a[p][i])) p = j;
    if (Math.abs(a[p][i]) < 1e-12) return 0;
    if (p !== i) { [a[i], a[p]] = [a[p], a[i]]; det = -det; }
    det *= a[i][i];
    for (let j = i + 1; j < n; j++) {
      const f = a[j][i] / a[i][i];
      for (let k = i; k < n; k++) a[j][k] -= f * a[i][k];
    }
  }
  return det;
}
function inverse(m) {
  const n = m.length;
  const a = m.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let j = i + 1; j < n; j++) if (Math.abs(a[j][i]) > Math.abs(a[p][i])) p = j;
    if (Math.abs(a[p][i]) < 1e-12) throw new Error('矩阵不可逆');
    [a[i], a[p]] = [a[p], a[i]];
    const d = a[i][i];
    for (let k = 0; k < 2 * n; k++) a[i][k] /= d;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const f = a[j][i];
      for (let k = 0; k < 2 * n; k++) a[j][k] -= f * a[i][k];
    }
  }
  return a.map((r) => r.slice(n));
}
function matMul(a, b) {
  const r = Array.from({ length: a.length }, () => Array(b[0].length).fill(0));
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b[0].length; j++) for (let k = 0; k < b.length; k++) r[i][j] += a[i][k] * b[k][j];
  return r;
}
function fmtMat(m) { return m.map((r) => r.map((x) => (Math.abs(x) < 1e-10 ? 0 : +x.toFixed(6))).join('\t')).join('\n'); }
function parseMat(s) {
  const rows = s.trim().split(/\r?\n/).filter((x) => x.trim()).map((l) => l.trim().split(/[\s,]+/).map(Number));
  if (!rows.length || rows.some((r) => r.some(isNaN))) throw new Error('矩阵格式错误，每行用空格或逗号分隔');
  const cols = rows[0].length;
  if (rows.some((r) => r.length !== cols)) throw new Error('每行列数需一致');
  return rows;
}
function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

function calcUI(root, rows, runLabel = '计算', resultTitle = '结果') {
  root.innerHTML = `<div class="tool-ui">
    <div class="panel"><div class="panel-head"><b>参数</b></div><div class="grid2">${rows.map(([id, label, value, type = 'number', extra = ''] = []) => `<div class="field"><label class="lab">${label}</label><input class="inp" id="${id}" type="${type}" value="${value ?? ''}" ${extra}></div>`).join('')}</div><button class="btn primary" id="calc-run" style="margin-top:11px">${runLabel}</button></div>
    <div class="panel"><div class="panel-head"><b>${resultTitle}</b></div><div id="calc-out" class="hint">填写参数后点击计算</div></div>
  </div>`;
}

export default {
  /* ================= 计算器 ================= */
  'calculator'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <input class="inp mono" id="ca-in" style="font-size:20px;padding:14px" placeholder="例如：sqrt(2) + sin(pi/4) * 10" value="2*sqrt(3) + 5^2">
          <div class="row" style="margin-top:10px">
            <button class="btn primary" id="ca-run">=</button>
            <button class="btn" id="ca-clear">清空</button>
            <button class="btn" id="ca-copy">复制结果</button>
          </div>
          <div class="hint" style="margin-top:8px">支持 sqrt、sin、cos、log、pi、e、矩阵、导数等 math.js 语法</div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b><span class="hint" id="ca-meta"></span></div><div class="mono" id="ca-out" style="font-size:28px;color:var(--acc);word-break:break-all">—</div></div>
        <div class="panel"><div class="panel-head"><b>历史记录</b><button class="btn sm" id="ca-clear-h">清空</button></div><div id="ca-history" class="hint">还没有记录</div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const hist = [];
    const run = async () => {
      try {
        await ctx.deps(['mathjs']);
        const math = window.math;
        const value = math.evaluate($('#ca-in').value);
        const text = math.format(value, { precision: 12 });
        $('#ca-out').textContent = text;
        $('#ca-meta').textContent = typeof value;
        hist.unshift(`${$('#ca-in').value} = ${text}`);
        if (hist.length > 12) hist.pop();
        $('#ca-history').innerHTML = hist.map((h) => `<div class="mono" style="padding:3px 0;border-bottom:1px solid var(--line)">${esc(h)}</div>`).join('');
      } catch (e) { $('#ca-out').textContent = '错误：' + e.message; }
    };
    $('#ca-run').onclick = run;
    $('#ca-copy').onclick = () => copy($('#ca-out').textContent);
    $('#ca-clear').onclick = () => { $('#ca-in').value = ''; $('#ca-in').focus(); };
    $('#ca-clear-h').onclick = () => { hist.length = 0; $('#ca-history').textContent = '还没有记录'; };
    $('#ca-in').addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
    run();
  },

  /* ================= 单位换算 ================= */
  'unit-convert'(root) {
    const cats = Object.keys(UNIT_GROUPS);
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="ticks" id="uc-cats" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:11px">
            ${cats.map((c, i) => `<button class="chip${i === 0 ? ' active' : ''}" data-cat="${c}">${UNIT_GROUPS[c].name}</button>`).join('')}
            <button class="chip" data-cat="temperature">温度</button>
          </div>
          <div class="grid3">
            <div class="field"><label class="lab">数值</label><input class="inp" id="uc-value" type="number" value="1"></div>
            <div class="field"><label class="lab">从</label><select class="sel" id="uc-from"></select></div>
            <div class="field"><label class="lab">到</label><select class="sel" id="uc-to"></select></div>
          </div>
          <button class="btn primary" id="uc-run" style="margin-top:11px">换算</button>
        </div>
        <div class="panel center" style="padding:24px"><div id="uc-out" style="font-size:32px;font-weight:700;color:var(--acc);font-family:var(--mono)">—</div><div class="hint" id="uc-meta"></div></div>
        <div class="panel"><div class="panel-head"><b>全部单位</b></div><div id="uc-all" class="grid4"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let cat = 'length';
    const setUnits = () => {
      const units = cat === 'temperature' ? { C: '摄氏度 °C', F: '华氏度 °F', K: '开尔文 K' } : UNIT_GROUPS[cat].units;
      const opts = Object.entries(units).map(([k, v]) => `<option value="${k}">${typeof v === 'string' ? v : k}</option>`).join('');
      $('#uc-from').innerHTML = opts;
      $('#uc-to').innerHTML = opts;
      const keys = Object.keys(units);
      if (keys.length > 1) $('#uc-to').value = keys[1];
    };
    const run = () => {
      const v = Number($('#uc-value').value);
      const from = $('#uc-from').value, to = $('#uc-to').value;
      const r = cat === 'temperature' ? tempConvert(v, from, to) : unitConvert(cat, v, from, to);
      $('#uc-out').textContent = `${(+r.toFixed(8))} ${to}`;
      $('#uc-meta').textContent = `${v} ${from} = ${r} ${to}`;
      const units = cat === 'temperature' ? { C: 1, F: 1, K: 1 } : UNIT_GROUPS[cat].units;
      $('#uc-all').innerHTML = Object.keys(units).map((u) => {
        const val = cat === 'temperature' ? tempConvert(v, from, u) : unitConvert(cat, v, from, u);
        return `<div class="stat"><b style="font-size:14px">${(+val.toFixed(6)).toLocaleString('zh-CN')}</b><span>${u}</span></div>`;
      }).join('');
    };
    root.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => {
      cat = b.dataset.cat;
      root.querySelectorAll('[data-cat]').forEach((x) => x.classList.toggle('active', x === b));
      setUnits(); run();
    }));
    $('#uc-value').addEventListener('input', run);
    $('#uc-from').addEventListener('change', run);
    $('#uc-to').addEventListener('change', run);
    $('#uc-run').onclick = run;
    setUnits(); run();
  },

  /* ================= 百分比与分摊 ================= */
  'percentage-calc'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="pc-tabs"><button class="tab active" data-i="0">百分比</button><button class="tab" data-i="1">折扣</button><button class="tab" data-i="2">小费/AA</button><button class="tab" data-i="3">比例</button></div>
        <div class="panel" id="pc-p0">
          <div class="grid3"><div class="field"><label class="lab">数值 A</label><input class="inp" id="pc-a" type="number" value="200"></div><div class="field"><label class="lab">数值 B</label><input class="inp" id="pc-b" type="number" value="35"></div><div class="field"><label class="lab">百分比 %</label><input class="inp" id="pc-p" type="number" value="15"></div></div>
          <button class="btn primary" id="pc-run0" style="margin-top:10px">计算</button>
          <div class="stat-grid" id="pc-out0" style="margin-top:12px"></div>
        </div>
        <div class="panel hidden" id="pc-p1">
          <div class="grid3"><div class="field"><label class="lab">原价</label><input class="inp" id="pc-price" type="number" value="299"></div><div class="field"><label class="lab">折扣 %</label><input class="inp" id="pc-disc" type="number" value="20"></div><div class="field"><label class="lab">叠加折扣 %</label><input class="inp" id="pc-disc2" type="number" value="0"></div></div>
          <button class="btn primary" id="pc-run1" style="margin-top:10px">计算</button>
          <div class="stat-grid" id="pc-out1" style="margin-top:12px"></div>
        </div>
        <div class="panel hidden" id="pc-p2">
          <div class="grid3"><div class="field"><label class="lab">账单金额</label><input class="inp" id="pc-bill" type="number" value="360"></div><div class="field"><label class="lab">小费 %</label><input class="inp" id="pc-tip" type="number" value="10"></div><div class="field"><label class="lab">人数</label><input class="inp" id="pc-people" type="number" value="4"></div></div>
          <button class="btn primary" id="pc-run2" style="margin-top:10px">计算</button>
          <div class="stat-grid" id="pc-out2" style="margin-top:12px"></div>
        </div>
        <div class="panel hidden" id="pc-p3">
          <div class="grid4"><div class="field"><label class="lab">A</label><input class="inp" id="pc-ra" type="number" value="3"></div><div class="field"><label class="lab">B</label><input class="inp" id="pc-rb" type="number" value="4"></div><div class="field"><label class="lab">C</label><input class="inp" id="pc-rc" type="number" value="5"></div><div class="field"><label class="lab">总量</label><input class="inp" id="pc-total" type="number" value="1200"></div></div>
          <button class="btn primary" id="pc-run3" style="margin-top:10px">按比例分配</button>
          <div class="stat-grid" id="pc-out3" style="margin-top:12px"></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#pc-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#pc-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      [0, 1, 2, 3].forEach((i) => $('#pc-p' + i).classList.toggle('hidden', String(i) !== b.dataset.i));
    });
    $('#pc-run0').onclick = () => {
      const a = n('pc-a'), b = n('pc-b'), p = n('pc-p');
      $('#pc-out0').innerHTML = [
        [`${p}% of ${a}`, money(a * p / 100)], [`${b} 是 ${a} 的`, pct(a ? b / a : 0)],
        [`${a} 增加 ${p}%`, money(a * (1 + p / 100))], [`${a} 减少 ${p}%`, money(a * (1 - p / 100))],
        [`变化率`, pct(a ? (b - a) / a : 0)]
      ].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
    };
    $('#pc-run1').onclick = () => {
      const p = n('pc-price'), d = n('pc-disc'), d2 = n('pc-disc2');
      const final = p * (1 - d / 100) * (1 - d2 / 100);
      $('#pc-out1').innerHTML = [
        ['最终价格', money(final)], ['节省', money(p - final)], ['实际折扣', pct(p ? (p - final) / p : 0)]
      ].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
    };
    $('#pc-run2').onclick = () => {
      const b = n('pc-bill'), t = n('pc-tip'), people = Math.max(1, n('pc-people'));
      const total = b * (1 + t / 100);
      $('#pc-out2').innerHTML = [['总金额', money(total)], ['每人', money(total / people)], ['小费', money(b * t / 100)]].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
    };
    $('#pc-run3').onclick = () => {
      const a = n('pc-ra'), b = n('pc-rb'), c = n('pc-rc'), total = n('pc-total');
      const sum = a + b + c || 1;
      $('#pc-out3').innerHTML = [['A', a / sum], ['B', b / sum], ['C', c / sum]].map(([k, r]) => `<div class="stat"><b>${money(total * r)}</b><span>${k} · ${pct(r)}</span></div>`).join('');
    };
    $('#pc-run0').click();
  },

  /* ================= 贷款 ================= */
  'loan-calc'(root) {
    calcUI(root, [
      ['ln-p', '贷款金额（元）', 1000000], ['ln-rate', '年利率（%）', 3.85], ['ln-years', '贷款年限', 30],
      ['ln-type', '还款方式', 'equal', 'text']
    ], '计算月供');
    const $ = (s) => root.querySelector(s);
    $('#ln-type').outerHTML = `<select class="sel" id="ln-type"><option value="equal">等额本息</option><option value="principal">等额本金</option></select>`;
    const run = () => {
      const P = n('ln-p'), rate = n('ln-rate') / 100 / 12, years = n('ln-years');
      const N = Math.round(years * 12);
      if (P <= 0 || N <= 0) { $('#calc-out').textContent = '请输入有效金额与年限'; return; }
      const type = $('#ln-type').value;
      let monthly = 0, totalInterest = 0, first = 0, last = 0;
      const rows = [];
      if (type === 'equal') {
        monthly = rate === 0 ? P / N : P * rate * (1 + rate) ** N / ((1 + rate) ** N - 1);
        totalInterest = monthly * N - P;
        first = last = monthly;
        let remain = P;
        for (let i = 1; i <= Math.min(N, 12); i++) {
          const interest = remain * rate;
          const principal = monthly - interest;
          remain -= principal;
          rows.push([i, money(monthly), money(principal), money(interest), money(remain)]);
        }
      } else {
        const principal = P / N;
        let remain = P;
        for (let i = 1; i <= N; i++) {
          const interest = remain * rate;
          const pay = principal + interest;
          if (i === 1) first = pay;
          last = pay;
          totalInterest += interest;
          if (i <= 12) rows.push([i, money(pay), money(principal), money(interest), money(remain - principal)]);
          remain -= principal;
        }
        monthly = first;
      }
      $('#calc-out').innerHTML = `<div class="stat-grid">
        <div class="stat"><b>${money(monthly)}</b><span>${type === 'equal' ? '每月月供' : '首月月供'}</span></div>
        <div class="stat"><b>${money(totalInterest)}</b><span>总利息</span></div>
        <div class="stat"><b>${money(P + totalInterest)}</b><span>还款总额</span></div>
        <div class="stat"><b>${N}</b><span>还款月数</span></div>
        <div class="stat"><b>${money(first)}</b><span>首月</span></div>
        <div class="stat"><b>${money(last)}</b><span>末月</span></div>
      </div>
      <div class="table-scroll" style="margin-top:12px;max-height:280px"><table class="tbl"><tr><th>期数</th><th>月供</th><th>本金</th><th>利息</th><th>剩余</th></tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table></div>`;
    };
    $('#calc-run').onclick = run;
    $('#ln-type').addEventListener('change', run);
    run();
  },

  /* ================= 理财 ================= */
  'finance-calc'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="fc-tabs"><button class="tab active" data-i="0">复利</button><button class="tab" data-i="1">定投</button><button class="tab" data-i="2">年化收益</button><button class="tab" data-i="3">APR/APY</button></div>
        <div class="panel" id="fc-p0">
          <div class="grid3"><div class="field"><label class="lab">本金</label><input class="inp" id="fc-p" type="number" value="10000"></div><div class="field"><label class="lab">年利率 %</label><input class="inp" id="fc-r" type="number" value="5"></div><div class="field"><label class="lab">年数</label><input class="inp" id="fc-y" type="number" value="10"></div></div>
          <button class="btn primary" id="fc-run0" style="margin-top:10px">计算</button><div class="stat-grid" id="fc-out0" style="margin-top:12px"></div>
        </div>
        <div class="panel hidden" id="fc-p1">
          <div class="grid3"><div class="field"><label class="lab">每月投入</label><input class="inp" id="fc-m" type="number" value="1000"></div><div class="field"><label class="lab">年化收益 %</label><input class="inp" id="fc-mr" type="number" value="6"></div><div class="field"><label class="lab">年数</label><input class="inp" id="fc-my" type="number" value="20"></div></div>
          <button class="btn primary" id="fc-run1" style="margin-top:10px">计算</button><div class="stat-grid" id="fc-out1" style="margin-top:12px"></div>
        </div>
        <div class="panel hidden" id="fc-p2">
          <div class="grid3"><div class="field"><label class="lab">初始投入</label><input class="inp" id="fc-start" type="number" value="10000"></div><div class="field"><label class="lab">最终价值</label><input class="inp" id="fc-end" type="number" value="18000"></div><div class="field"><label class="lab">年数</label><input class="inp" id="fc-years" type="number" value="5"></div></div>
          <button class="btn primary" id="fc-run2" style="margin-top:10px">计算</button><div class="stat-grid" id="fc-out2" style="margin-top:12px"></div>
        </div>
        <div class="panel hidden" id="fc-p3">
          <div class="grid3"><div class="field"><label class="lab">APR %</label><input class="inp" id="fc-apr" type="number" value="12"></div><div class="field"><label class="lab">每年复利次数</label><input class="inp" id="fc-times" type="number" value="12"></div><div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="fc-run3" style="width:100%">换算</button></div></div>
          <div class="stat-grid" id="fc-out3" style="margin-top:12px"></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#fc-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#fc-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      [0, 1, 2, 3].forEach((i) => $('#fc-p' + i).classList.toggle('hidden', String(i) !== b.dataset.i));
    });
    $('#fc-run0').onclick = () => {
      const P = n('fc-p'), r = n('fc-r') / 100, y = n('fc-y');
      const A = P * (1 + r) ** y;
      $('#fc-out0').innerHTML = [['最终金额', money(A)], ['收益', money(A - P)], ['总收益率', pct(P ? (A - P) / P : 0)]].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
    };
    $('#fc-run1').onclick = () => {
      const m = n('fc-m'), r = n('fc-mr') / 100 / 12, y = n('fc-my'), N = y * 12;
      const fv = r === 0 ? m * N : m * ((1 + r) ** N - 1) / r;
      const invested = m * N;
      $('#fc-out1').innerHTML = [['最终金额', money(fv)], ['累计投入', money(invested)], ['收益', money(fv - invested)], ['收益率', pct(invested ? (fv - invested) / invested : 0)]].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
    };
    $('#fc-run2').onclick = () => {
      const a = n('fc-start'), b = n('fc-end'), y = n('fc-years');
      const cagr = a > 0 && y > 0 ? (b / a) ** (1 / y) - 1 : NaN;
      $('#fc-out2').innerHTML = [['年化收益率', pct(cagr)], ['总收益率', pct(a ? (b - a) / a : 0)], ['总收益', money(b - a)]].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
    };
    $('#fc-run3').onclick = () => {
      const apr = n('fc-apr') / 100, t = Math.max(1, n('fc-times'));
      const apy = (1 + apr / t) ** t - 1;
      $('#fc-out3').innerHTML = [['APY', pct(apy)], ['APR', pct(apr)], ['差额', pct(apy - apr)]].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
    };
    $('#fc-run0').click();
  },

  /* ================= 健康 ================= */
  'health-calc'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="grid4">
            <div class="field"><label class="lab">性别</label><select class="sel" id="hc-sex"><option value="m">男</option><option value="f">女</option></select></div>
            <div class="field"><label class="lab">年龄</label><input class="inp" id="hc-age" type="number" value="30"></div>
            <div class="field"><label class="lab">身高 cm</label><input class="inp" id="hc-h" type="number" value="175"></div>
            <div class="field"><label class="lab">体重 kg</label><input class="inp" id="hc-w" type="number" value="70"></div>
            <div class="field"><label class="lab">活动水平</label><select class="sel" id="hc-act"><option value="1.2">久坐</option><option value="1.375">轻度活动</option><option value="1.55" selected>中度活动</option><option value="1.725">高强度</option><option value="1.9">运动员</option></select></div>
            <div class="field"><label class="lab">腰围 cm</label><input class="inp" id="hc-waist" type="number" value="80"></div>
            <div class="field"><label class="lab">颈围 cm</label><input class="inp" id="hc-neck" type="number" value="38"></div>
            <div class="field"><label class="lab">臀围 cm（女）</label><input class="inp" id="hc-hip" type="number" value="95"></div>
          </div>
          <button class="btn primary" id="hc-run" style="margin-top:10px">计算</button>
        </div>
        <div class="stat-grid" id="hc-out"></div>
        <div class="panel"><div class="panel-head"><b>运动与补水建议</b></div><div id="hc-extra" class="hint"></div></div>
        <div class="warnbox">健康指标仅为估算，不构成医疗建议。</div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#hc-run').onclick = () => {
      const sex = $('#hc-sex').value, age = n('hc-age'), h = n('hc-h'), w = n('hc-w'), act = n('hc-act');
      const bmi = w / (h / 100) ** 2;
      const bmr = 10 * w + 6.25 * h - 5 * age + (sex === 'm' ? 5 : -161);
      const tdee = bmr * act;
      const water = w * 35;
      const waist = n('hc-waist'), neck = n('hc-neck'), hip = n('hc-hip');
      let bf = NaN;
      if (h > 0 && waist > 0 && neck > 0) {
        bf = sex === 'm'
          ? 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(h)) - 450
          : 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.22100 * Math.log10(h)) - 450;
      }
      $('#hc-out').innerHTML = [
        ['BMI', bmi.toFixed(1), bmi < 18.5 ? '偏瘦' : bmi < 24 ? '正常' : bmi < 28 ? '超重' : '肥胖'],
        ['体脂率', isFinite(bf) ? bf.toFixed(1) + '%' : '—', '海军公式估算'],
        ['基础代谢', Math.round(bmr) + ' kcal', 'Mifflin-St Jeor'],
        ['每日消耗', Math.round(tdee) + ' kcal', '含活动系数'],
        ['每日饮水', (water / 1000).toFixed(2) + ' L', '约 35ml/kg'],
        ['蛋白质建议', Math.round(w * 1.2) + ' g', '日常活动'],
        ['心率上限', 220 - age + ' bpm', '估算最大心率'],
        ['心率区间', `${Math.round((220 - age) * 0.6)}–${Math.round((220 - age) * 0.8)}`, '有氧区间']
      ].map(([k, v, s]) => `<div class="stat"><b>${v}</b><span>${k}${s ? ' · ' + s : ''}</span></div>`).join('');
      $('#hc-extra').textContent = `减脂建议每日摄入约 ${Math.round(tdee - 400)} kcal，增肌约 ${Math.round(tdee + 300)} kcal。保持每周 150 分钟中等强度运动。`;
    };
    $('#hc-run').click();
  },

  /* ================= 数论与组合 ================= */
  'number-theory'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="grid3">
            <div class="field"><label class="lab">数字 A</label><input class="inp" id="nt-a" type="number" value="84"></div>
            <div class="field"><label class="lab">数字 B</label><input class="inp" id="nt-b" type="number" value="126"></div>
            <div class="field"><label class="lab">n / k</label><input class="inp" id="nt-n" type="number" value="10"></div>
          </div>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="nt-run">计算</button></div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b></div><div id="nt-out" class="stat-grid"></div></div>
        <div class="panel"><div class="panel-head"><b>排列组合 / 斐波那契</b></div><pre class="out" id="nt-extra"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const gcd = (a, b) => b ? gcd(b, a % b) : a;
    const isPrime = (x) => {
      if (x < 2) return false;
      for (let i = 2; i * i <= x; i++) if (x % i === 0) return false;
      return true;
    };
    const factor = (x) => {
      const out = [];
      let d = 2;
      while (d * d <= x) { while (x % d === 0) { out.push(d); x /= d; } d++; }
      if (x > 1) out.push(x);
      return out;
    };
    const fact = (x) => { let r = 1n; for (let i = 2n; i <= BigInt(x); i++) r *= i; return r; };
    const comb = (n2, k) => (k < 0 || k > n2) ? 0n : fact(n2) / (fact(k) * fact(n2 - k));
    $('#nt-run').onclick = () => {
      const a = Math.abs(n('nt-a')), b = Math.abs(n('nt-b')), nn = Math.max(1, Math.min(200, Math.floor(n('nt-n'))));
      const g = gcd(a, b);
      const l = a && b ? a / g * b : 0;
      $('#nt-out').innerHTML = [
        ['A', a], ['B', b], ['GCD', g], ['LCM', l], ['A 是否质数', isPrime(a) ? '是' : '否'],
        ['B 是否质数', isPrime(b) ? '是' : '否'], ['A 因数分解', factor(a).join(' × ') || '—'], ['B 因数分解', factor(b).join(' × ') || '—']
      ].map(([k, v]) => `<div class="stat"><b style="font-size:15px">${v}</b><span>${k}</span></div>`).join('');
      const fib = [0n, 1n];
      for (let i = 2; i <= nn; i++) fib.push(fib[i - 1] + fib[i - 2]);
      $('#nt-extra').textContent = `第 ${nn} 个斐波那契数：${fib[nn]}\nC(${nn}, ${Math.floor(nn / 2)}) = ${comb(nn, Math.floor(nn / 2))}\nA(${nn}, 2) = ${fact(nn) / fact(nn - 2)}`;
    };
    $('#nt-run').click();
  },

  /* ================= 方程与函数绘图 ================= */
  'equation-plot'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="grid4">
            <div class="field"><label class="lab">a</label><input class="inp" id="eq-a" type="number" value="1"></div>
            <div class="field"><label class="lab">b</label><input class="inp" id="eq-b" type="number" value="-3"></div>
            <div class="field"><label class="lab">c</label><input class="inp" id="eq-c" type="number" value="2"></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="eq-solve" style="width:100%">解 ax²+bx+c=0</button></div>
          </div>
          <pre class="out" id="eq-out" style="margin-top:10px"></pre>
        </div>
        <div class="panel">
          <div class="panel-head"><b>函数绘图</b><span class="hint">使用 math.js 语法，例如 sin(x)、x^2/5、sqrt(x)</span></div>
          <input class="inp mono" id="eq-fn" value="sin(x) + x/5">
          <div class="row" style="margin-top:9px"><button class="btn primary" id="eq-plot">绘制</button><span class="hint" id="eq-meta"></span></div>
          <div class="canvas-wrap" style="margin-top:10px"><canvas id="eq-canvas" width="760" height="380"></canvas></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#eq-solve').onclick = () => {
      const a = n('eq-a'), b = n('eq-b'), c = n('eq-c');
      if (a === 0) { $('#eq-out').textContent = b === 0 ? (c === 0 ? '任意实数解' : '无解') : `x = ${(-c / b).toFixed(6)}`; return; }
      const d = b * b - 4 * a * c;
      if (d < 0) { $('#eq-out').textContent = `判别式 Δ = ${d}\n无实数解\n复根：x = ${(-b / (2 * a)).toFixed(4)} ± ${(Math.sqrt(-d) / (2 * a)).toFixed(4)}i`; return; }
      const x1 = (-b + Math.sqrt(d)) / (2 * a), x2 = (-b - Math.sqrt(d)) / (2 * a);
      $('#eq-out').textContent = `判别式 Δ = ${d}\nx₁ = ${x1.toFixed(8)}\nx₂ = ${x2.toFixed(8)}`;
    };
    $('#eq-plot').onclick = async () => {
      try {
        await ctx.deps(['mathjs']);
        const math = window.math;
        const expr = $('#eq-fn').value;
        const node = math.compile(expr);
        const cv = $('#eq-canvas'), g = cv.getContext('2d');
        const W = cv.width, H = cv.height;
        g.clearRect(0, 0, W, H);
        g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 1;
        for (let x = 0; x <= W; x += 38) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
        for (let y = 0; y <= H; y += 38) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
        g.strokeStyle = 'rgba(139,155,184,.5)'; g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke();
        const xmin = -10, xmax = 10, ymin = -6, ymax = 6;
        g.strokeStyle = '#38cdf0'; g.lineWidth = 2; g.beginPath();
        let started = false;
        for (let px = 0; px <= W; px++) {
          const x = xmin + (xmax - xmin) * px / W;
          let y;
          try { y = node.evaluate({ x }); } catch { continue; }
          if (typeof y !== 'number' || !isFinite(y)) { started = false; continue; }
          const py = H - (y - ymin) / (ymax - ymin) * H;
          if (py < -2000 || py > 2000) { started = false; continue; }
          if (!started) { g.moveTo(px, py); started = true; } else g.lineTo(px, py);
        }
        g.stroke();
        g.fillStyle = '#8b9bb8'; g.font = '12px sans-serif';
        g.fillText('x: -10 … 10', 10, H - 10);
        $('#eq-meta').textContent = '已绘制 ' + expr;
      } catch (e) { $('#eq-meta').textContent = '错误：' + e.message; }
    };
    $('#eq-solve').click();
    $('#eq-plot').click();
  },

  /* ================= 矩阵 ================= */
  'matrix-calc'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="grid2">
          <div class="panel"><div class="panel-head"><b>矩阵 A</b><span class="hint">每行用空格分隔</span></div><textarea class="ta mono" id="mx-a" rows="5">1 2
3 4</textarea></div>
          <div class="panel"><div class="panel-head"><b>矩阵 B（可选）</b></div><textarea class="ta mono" id="mx-b" rows="5">5 6
7 8</textarea></div>
        </div>
        <div class="panel">
          <div class="row">
            <button class="btn primary" data-op="add">A + B</button><button class="btn" data-op="sub">A − B</button>
            <button class="btn" data-op="mul">A × B</button><button class="btn" data-op="trans">Aᵀ</button>
            <button class="btn" data-op="det">det(A)</button><button class="btn" data-op="inv">A⁻¹</button>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b></div><pre class="out" id="mx-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    root.querySelectorAll('[data-op]').forEach((b) => b.addEventListener('click', () => {
      try {
        const A = parseMat($('#mx-a').value), B = parseMat($('#mx-b').value);
        const op = b.dataset.op;
        let out;
        if (op === 'add' || op === 'sub') {
          if (A.length !== B.length || A[0].length !== B[0].length) throw new Error('矩阵维度不一致');
          out = A.map((r, i) => r.map((v, j) => op === 'add' ? v + B[i][j] : v - B[i][j]));
        } else if (op === 'mul') {
          if (A[0].length !== B.length) throw new Error('A 的列数需等于 B 的行数');
          out = matMul(A, B);
        } else if (op === 'trans') {
          out = A[0].map((_, j) => A.map((r) => r[j]));
        } else if (op === 'det') {
          if (A.length !== A[0].length) throw new Error('行列式需要方阵');
          $('#mx-out').textContent = 'det(A) = ' + determinant(A);
          return;
        } else out = inverse(A);
        $('#mx-out').textContent = fmtMat(out);
      } catch (e) { $('#mx-out').textContent = '错误：' + e.message; }
    }));
  },

  /* ================= 统计与分布 ================= */
  'stats-pro'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="sp-tabs"><button class="tab active" data-i="0">正态分布</button><button class="tab" data-i="1">置信区间</button><button class="tab" data-i="2">A/B 样本量</button></div>
        <div class="panel" id="sp-p0">
          <div class="grid3"><div class="field"><label class="lab">均值 μ</label><input class="inp" id="sp-mu" type="number" value="100"></div><div class="field"><label class="lab">标准差 σ</label><input class="inp" id="sp-sd" type="number" value="15"></div><div class="field"><label class="lab">X</label><input class="inp" id="sp-x" type="number" value="115"></div></div>
          <button class="btn primary" id="sp-run0" style="margin-top:10px">计算</button><div class="stat-grid" id="sp-out0" style="margin-top:12px"></div>
        </div>
        <div class="panel hidden" id="sp-p1">
          <div class="grid3"><div class="field"><label class="lab">样本均值</label><input class="inp" id="sp-mean" type="number" value="72"></div><div class="field"><label class="lab">样本量 n</label><input class="inp" id="sp-n" type="number" value="36"></div><div class="field"><label class="lab">标准差 σ</label><input class="inp" id="sp-sigma" type="number" value="8"></div><div class="field"><label class="lab">置信水平</label><select class="sel" id="sp-level"><option value="1.645">90%</option><option value="1.96" selected>95%</option><option value="2.576">99%</option></select></div></div>
          <button class="btn primary" id="sp-run1" style="margin-top:10px">计算</button><div class="stat-grid" id="sp-out1" style="margin-top:12px"></div>
        </div>
        <div class="panel hidden" id="sp-p2">
          <div class="grid4"><div class="field"><label class="lab">基线转化率 %</label><input class="inp" id="sp-p" type="number" value="10"></div><div class="field"><label class="lab">期望提升 %</label><input class="inp" id="sp-lift" type="number" value="10"></div><div class="field"><label class="lab">显著性 α</label><select class="sel" id="sp-alpha"><option value="1.645">90%</option><option value="1.96" selected>95%</option><option value="2.576">99%</option></select></div><div class="field"><label class="lab">功效 β</label><select class="sel" id="sp-beta"><option value="0.84">80%</option><option value="1.28">90%</option></select></div></div>
          <button class="btn primary" id="sp-run2" style="margin-top:10px">计算</button><div class="stat-grid" id="sp-out2" style="margin-top:12px"></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#sp-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#sp-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      [0, 1, 2].forEach((i) => $('#sp-p' + i).classList.toggle('hidden', String(i) !== b.dataset.i));
    });
    $('#sp-run0').onclick = () => {
      const mu = n('sp-mu'), sd = n('sp-sd'), x = n('sp-x');
      if (sd <= 0) { $('#sp-out0').innerHTML = '<div class="hint">标准差需大于 0</div>'; return; }
      const z = (x - mu) / sd;
      $('#sp-out0').innerHTML = [['Z 分数', z.toFixed(4)], ['P(X ≤ x)', (normalCdf(z) * 100).toFixed(2) + '%'], ['P(X ≥ x)', ((1 - normalCdf(z)) * 100).toFixed(2) + '%'], ['±1σ 范围', `${mu - sd} – ${mu + sd}`], ['±2σ 范围', `${mu - 2 * sd} – ${mu + 2 * sd}`]].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
    };
    $('#sp-run1').onclick = () => {
      const mean = n('sp-mean'), nn = Math.max(1, n('sp-n')), sd = n('sp-sigma'), z = n('sp-level');
      const se = sd / Math.sqrt(nn), margin = z * se;
      $('#sp-out1').innerHTML = [['置信区间', `${money(mean - margin)} – ${money(mean + margin)}`], ['标准误', se.toFixed(4)], ['误差范围', '±' + margin.toFixed(4)]].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
    };
    $('#sp-run2').onclick = () => {
      const p = Math.min(0.99, Math.max(0.0001, n('sp-p') / 100)), lift = Math.max(0.001, n('sp-lift') / 100);
      const delta = p * lift, z = n('sp-alpha'), b = n('sp-beta');
      const size = Math.ceil(2 * (z + b) ** 2 * p * (1 - p) / delta ** 2);
      $('#sp-out2').innerHTML = [['每组样本量', size.toLocaleString()], ['总样本量', (size * 2).toLocaleString()], ['绝对提升', (delta * 100).toFixed(2) + '%']].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
    };
    $('#sp-run0').click();
  },

  /* ================= 摄影计算 ================= */
  'photo-calc'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="ph-tabs"><button class="tab active" data-i="0">曝光 / ND</button><button class="tab" data-i="1">景深</button><button class="tab" data-i="2">等效焦距</button></div>
        <div class="panel" id="ph-p0">
          <div class="grid4">
            <div class="field"><label class="lab">光圈 f/</label><input class="inp" id="ph-ap" type="number" value="2.8"></div>
            <div class="field"><label class="lab">快门（秒）</label><input class="inp" id="ph-sh" type="number" value="0.004"></div>
            <div class="field"><label class="lab">ISO</label><input class="inp" id="ph-iso" type="number" value="100"></div>
            <div class="field"><label class="lab">ND 档数</label><input class="inp" id="ph-nd" type="number" value="6"></div>
          </div>
          <button class="btn primary" id="ph-run0" style="margin-top:10px">计算</button>
          <div class="stat-grid" id="ph-out0" style="margin-top:12px"></div>
        </div>
        <div class="panel hidden" id="ph-p1">
          <div class="grid4">
            <div class="field"><label class="lab">焦距 mm</label><input class="inp" id="ph-f" type="number" value="50"></div>
            <div class="field"><label class="lab">光圈 f/</label><input class="inp" id="ph-ap2" type="number" value="2.8"></div>
            <div class="field"><label class="lab">对焦距离 m</label><input class="inp" id="ph-d" type="number" value="3"></div>
            <div class="field"><label class="lab">弥散圆 mm</label><input class="inp" id="ph-coc" type="number" value="0.03" step="0.001"></div>
          </div>
          <button class="btn primary" id="ph-run1" style="margin-top:10px">计算</button>
          <div class="stat-grid" id="ph-out1" style="margin-top:12px"></div>
        </div>
        <div class="panel hidden" id="ph-p2">
          <div class="grid3">
            <div class="field"><label class="lab">实际焦距 mm</label><input class="inp" id="ph-f2" type="number" value="50"></div>
            <div class="field"><label class="lab">裁切系数</label><input class="inp" id="ph-crop" type="number" value="1.5"></div>
            <div class="field"><label class="lab">传感器宽度 mm</label><input class="inp" id="ph-sw" type="number" value="36"></div>
          </div>
          <button class="btn primary" id="ph-run2" style="margin-top:10px">计算</button>
          <div class="stat-grid" id="ph-out2" style="margin-top:12px"></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#ph-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#ph-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      [0, 1, 2].forEach((i) => $('#ph-p' + i).classList.toggle('hidden', String(i) !== b.dataset.i));
    });
    $('#ph-run0').onclick = () => {
      const ap = n('ph-ap'), sh = n('ph-sh'), iso = n('ph-iso'), nd = n('ph-nd');
      if (ap <= 0 || sh <= 0 || iso <= 0) return;
      const ev = Math.log2(ap * ap / sh) - Math.log2(iso / 100);
      const newSh = sh * 2 ** nd;
      $('#ph-out0').innerHTML = [['EV（ISO 100）', ev.toFixed(2)], ['加 ND 后快门', newSh >= 1 ? newSh.toFixed(2) + ' s' : '1/' + Math.round(1 / newSh) + ' s'], ['相当于减少', nd + ' 档'], ['ND 透过率', (100 / 2 ** nd).toFixed(2) + '%']].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
    };
    $('#ph-run1').onclick = () => {
      const f = n('ph-f'), ap = n('ph-ap2'), d = n('ph-d') * 1000, coc = n('ph-coc');
      const H = f * f / (ap * coc) + f;
      const near = d * (H - f) / (H + d - 2 * f);
      const far = d * (H - f) / (H - d);
      $('#ph-out1').innerHTML = [['超焦距', (H / 1000).toFixed(2) + ' m'], ['前景深', (d - near).toFixed(0) + ' mm'], ['后景深', far > 0 ? (far - d).toFixed(0) + ' mm' : '∞'], ['总景深', far > 0 ? (far - near).toFixed(0) + ' mm' : '∞'], ['近点', (near / 1000).toFixed(2) + ' m'], ['远点', far > 0 ? (far / 1000).toFixed(2) + ' m' : '∞']].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
    };
    $('#ph-run2').onclick = () => {
      const f = n('ph-f2'), crop = n('ph-crop'), sw = n('ph-sw');
      const eq = f * crop;
      const fov = 2 * Math.atan(sw / (2 * f)) * 180 / Math.PI;
      $('#ph-out2').innerHTML = [['等效焦距', eq.toFixed(1) + ' mm'], ['水平视角', fov.toFixed(1) + '°'], ['裁切系数', crop]].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
    };
    $('#ph-run0').click();
  },

  /* ================= 商业 ================= */
  'business-calc'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="grid4">
            <div class="field"><label class="lab">售价</label><input class="inp" id="bc-price" type="number" value="100"></div>
            <div class="field"><label class="lab">成本</label><input class="inp" id="bc-cost" type="number" value="60"></div>
            <div class="field"><label class="lab">广告花费</label><input class="inp" id="bc-ad" type="number" value="500"></div>
            <div class="field"><label class="lab">带来客户数</label><input class="inp" id="bc-cust" type="number" value="20"></div>
            <div class="field"><label class="lab">固定成本</label><input class="inp" id="bc-fixed" type="number" value="5000"></div>
            <div class="field"><label class="lab">客单价</label><input class="inp" id="bc-aov" type="number" value="100"></div>
            <div class="field"><label class="lab">复购月数</label><input class="inp" id="bc-months" type="number" value="12"></div>
            <div class="field"><label class="lab">毛利率 %</label><input class="inp" id="bc-gm" type="number" value="40"></div>
          </div>
          <button class="btn primary" id="bc-run" style="margin-top:10px">计算</button>
        </div>
        <div class="stat-grid" id="bc-out"></div>
        <div class="panel"><div class="panel-head"><b>说明</b></div><div class="hint" id="bc-note"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#bc-run').onclick = () => {
      const price = n('bc-price'), cost = n('bc-cost'), ad = n('bc-ad'), cust = Math.max(1, n('bc-cust'));
      const fixed = n('bc-fixed'), aov = n('bc-aov'), months = n('bc-months'), gm = n('bc-gm') / 100;
      const gross = price - cost;
      const margin = price ? gross / price : 0;
      const markup = cost ? gross / cost : 0;
      const cac = ad / cust;
      const ltv = aov * gm * months;
      const roi = cost ? (price - cost) / cost : 0;
      const roas = ad ? price * cust / ad : 0;
      const beUnits = gross > 0 ? fixed / gross : Infinity;
      $('#bc-out').innerHTML = [
        ['毛利', money(gross)], ['毛利率', pct(margin)], ['加价率', pct(markup)],
        ['CAC', money(cac)], ['LTV', money(ltv)], ['LTV / CAC', (ltv / cac).toFixed(2)],
        ['ROI', pct(roi)], ['ROAS', roas.toFixed(2) + 'x'], ['盈亏平衡销量', isFinite(beUnits) ? Math.ceil(beUnits) : '∞']
      ].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
      $('#bc-note').textContent = 'LTV 使用「客单价 × 毛利率 × 复购月数」估算；ROAS = 收入 / 广告花费。盈亏平衡按单件毛利覆盖固定成本计算。';
    };
    $('#bc-run').click();
  }
};
