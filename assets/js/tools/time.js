/* 时间、日期与日程 */
import { esc, copy, toast, download } from '../core/ui.js';

const pad = (n) => String(n).padStart(2, '0');
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const parseDate = (s) => {
  const d = new Date(s);
  if (isNaN(d)) throw new Error('日期格式无效');
  return d;
};
function beep(freq = 880, ms = 160, vol = 0.12) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ac = new AC();
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = freq; g.gain.value = vol;
    o.connect(g); g.connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + ms / 1000);
    setTimeout(() => ac.close().catch(() => {}), ms + 200);
  } catch { /* ignore */ }
}
function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
function daysInMonth(y, m) { return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m]; }
function weekNumber(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / 864e5 + 1) / 7);
}
function solarToLunar(date) {
  try {
    const fmt = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { year: 'numeric', month: 'long', day: 'numeric' });
    const parts = fmt.formatToParts(date);
    const get = (t) => parts.find((p) => p.type === t)?.value || '';
    return { text: `${get('yearName')}年 ${get('month')}${get('day')}`, related: get('relatedYear'), month: get('month'), day: get('day') };
  } catch { return { text: '当前浏览器不支持农历' }; }
}
const CONSTELLATIONS = [['摩羯座', 1, 20], ['水瓶座', 2, 19], ['双鱼座', 3, 21], ['白羊座', 4, 20], ['金牛座', 5, 21], ['双子座', 6, 22], ['巨蟹座', 7, 23], ['狮子座', 8, 23], ['处女座', 9, 23], ['天秤座', 10, 24], ['天蝎座', 11, 23], ['射手座', 12, 22], ['摩羯座', 12, 32]];
function constellation(m, d) {
  for (let i = 0; i < CONSTELLATIONS.length - 1; i++) {
    const [, cm, cd] = CONSTELLATIONS[i];
    const [, nm, nd] = CONSTELLATIONS[i + 1];
    if ((m === cm && d >= cd) || (m === nm && d < nd)) return CONSTELLATIONS[i][0];
  }
  return '摩羯座';
}
/* NOAA 日出日落 */
function sunTimes(date, lat, lon) {
  const rad = Math.PI / 180, dayMs = 86400000, J1970 = 2440588, J2000 = 2451545;
  const toJulian = (d) => d.getTime() / dayMs - 0.5 + J1970;
  const n = Math.round(toJulian(date) - J2000 + 0.0008);
  const Jstar = n - lon / 360;
  const M = (357.5291 + 0.98560028 * Jstar) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const Jtransit = J2000 + Jstar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * lambda * rad);
  const dec = Math.asin(Math.sin(lambda * rad) * Math.sin(23.44 * rad));
  const calc = (alt) => {
    const cosH = (Math.sin(alt * rad) - Math.sin(lat * rad) * Math.sin(dec)) / (Math.cos(lat * rad) * Math.cos(dec));
    if (cosH < -1 || cosH > 1) return null;
    const H = Math.acos(cosH) / rad;
    return { rise: new Date((Jtransit - H / 360 - J1970 + 0.5) * dayMs), set: new Date((Jtransit + H / 360 - J1970 + 0.5) * dayMs) };
  };
  const main = calc(-0.833), golden = calc(6), blue = calc(-4);
  return { transit: new Date((Jtransit - J1970 + 0.5) * dayMs), main, golden, blue };
}
function moonPhase(date) {
  const synodic = 29.530588853;
  const knownNew = Date.UTC(2000, 0, 6, 18, 14);
  let age = ((date.getTime() - knownNew) / 864e5) % synodic;
  if (age < 0) age += synodic;
  const frac = age / synodic;
  const name = frac < 0.03 || frac > 0.97 ? '新月' : frac < 0.22 ? '峨眉月' : frac < 0.28 ? '上弦月' : frac < 0.47 ? '盈凸月' : frac < 0.53 ? '满月' : frac < 0.72 ? '亏凸月' : frac < 0.78 ? '下弦月' : '残月';
  return { age, frac, name };
}

export default {
  /* ================= 时间戳 ================= */
  'timestamp'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel center">
          <div class="hint">当前 Unix 时间戳</div>
          <div id="ts-now" style="font-size:38px;font-weight:700;font-family:var(--mono);color:var(--acc);letter-spacing:1px">—</div>
          <div class="hint" id="ts-now-date"></div>
          <div class="row" style="justify-content:center;margin-top:10px"><button class="btn sm" id="ts-copy-now">复制秒级</button><button class="btn sm" id="ts-copy-ms">复制毫秒</button></div>
        </div>
        <div class="grid2">
          <div class="panel">
            <div class="panel-head"><b>时间戳 → 日期</b></div>
            <input class="inp mono" id="ts-in" placeholder="1730000000 或 1730000000000">
            <div class="row" style="margin-top:8px"><button class="btn primary" id="ts-to-date">转换</button><select class="sel" id="ts-tz" style="max-width:160px"><option value="local">本地时区</option><option value="utc">UTC</option><option value="8">UTC+8</option></select></div>
            <pre class="out" id="ts-out" style="margin-top:9px"></pre>
          </div>
          <div class="panel">
            <div class="panel-head"><b>日期 → 时间戳</b></div>
            <input class="inp" id="ts-date" type="datetime-local">
            <button class="btn primary" id="ts-to-ts" style="margin-top:8px">转换</button>
            <pre class="out" id="ts-out2" style="margin-top:9px"></pre>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><b>批量转换</b><span class="hint">每行一个时间戳</span></div>
          <textarea class="ta mono" id="ts-batch" rows="5">1730000000
1735689600000</textarea>
          <button class="btn" id="ts-batch-run" style="margin-top:8px">批量转换</button>
          <pre class="out" id="ts-batch-out" style="margin-top:9px"></pre>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const tick = () => {
      const d = new Date();
      $('#ts-now').textContent = Math.floor(d.getTime() / 1000);
      $('#ts-now-date').textContent = `${d.toLocaleString('zh-CN', { hour12: false })} · UTC${-d.getTimezoneOffset() / 60 >= 0 ? '+' : ''}${-d.getTimezoneOffset() / 60}`;
    };
    tick();
    const timer = setInterval(tick, 1000);
    const now = new Date();
    $('#ts-date').value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    $('#ts-copy-now').onclick = () => copy(String(Math.floor(Date.now() / 1000)));
    $('#ts-copy-ms').onclick = () => copy(String(Date.now()));
    $('#ts-to-date').onclick = () => {
      const v = $('#ts-in').value.trim();
      const n = Number(v);
      if (!v || isNaN(n)) { $('#ts-out').textContent = '请输入数字时间戳'; return; }
      const ms = v.length <= 10 ? n * 1000 : n;
      const d = new Date(ms);
      const tz = $('#ts-tz').value;
      const opts = { hour12: false };
      if (tz === 'utc') opts.timeZone = 'UTC';
      if (tz === '8') opts.timeZone = 'Asia/Shanghai';
      $('#ts-out').textContent = `${d.toLocaleString('zh-CN', opts)}\nISO: ${d.toISOString()}\n星期${WEEK[d.getDay()]}`;
    };
    $('#ts-to-ts').onclick = () => {
      const d = new Date($('#ts-date').value);
      if (isNaN(d)) { $('#ts-out2').textContent = '请选择日期时间'; return; }
      $('#ts-out2').textContent = `秒级：${Math.floor(d.getTime() / 1000)}\n毫秒：${d.getTime()}\nISO：${d.toISOString()}`;
    };
    $('#ts-batch-run').onclick = () => {
      const out = $('#ts-batch').value.split(/\r?\n/).filter((x) => x.trim()).map((v) => {
        const n = Number(v.trim());
        if (isNaN(n)) return `${v} → 无效`;
        const ms = v.trim().length <= 10 ? n * 1000 : n;
        return `${v.trim()} → ${new Date(ms).toLocaleString('zh-CN', { hour12: false })}`;
      });
      $('#ts-batch-out').textContent = out.join('\n');
    };
    root.parentElement && window.addEventListener('beforeunload', () => clearInterval(timer));
    // 路由切换时清理由 ctx 提供；此处由 main 的 cleanup 捕获
    if (root.__ctxOnDestroy) root.__ctxOnDestroy(() => clearInterval(timer));
    const obs = new MutationObserver(() => { if (!document.body.contains(root)) { clearInterval(timer); obs.disconnect(); } });
    obs.observe(document.body, { childList: true, subtree: true });
  },

  /* ================= 日期计算 ================= */
  'date-calc'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>日期差</b></div>
          <div class="grid3">
            <div class="field"><label class="lab">开始日期</label><input class="inp" id="dc-a" type="date"></div>
            <div class="field"><label class="lab">结束日期</label><input class="inp" id="dc-b" type="date"></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="dc-run" style="width:100%">计算</button></div>
          </div>
          <div id="dc-out" class="stat-grid" style="margin-top:12px"></div>
        </div>
        <div class="panel">
          <div class="panel-head"><b>日期加减</b></div>
          <div class="grid4">
            <div class="field"><label class="lab">基准日期</label><input class="inp" id="dc-base" type="date"></div>
            <div class="field"><label class="lab">数值</label><input class="inp" id="dc-num" type="number" value="7"></div>
            <div class="field"><label class="lab">单位</label><select class="sel" id="dc-unit"><option value="day">天</option><option value="week">周</option><option value="month">月</option><option value="year">年</option></select></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn" id="dc-add" style="width:100%">加</button></div>
          </div>
          <pre class="out" id="dc-add-out" style="margin-top:10px"></pre>
        </div>
        <div class="panel">
          <div class="panel-head"><b>日期信息</b></div>
          <input class="inp" id="dc-one" type="date">
          <div id="dc-info" class="kv" style="margin-top:10px"></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const today = fmtDate(new Date());
    $('#dc-a').value = today; $('#dc-b').value = today; $('#dc-base').value = today; $('#dc-one').value = today;
    const calc = () => {
      const a = parseDate($('#dc-a').value), b = parseDate($('#dc-b').value);
      const diff = Math.round((b - a) / 864e5);
      let work = 0;
      const dir = diff >= 0 ? 1 : -1;
      for (let i = 0; i !== diff; i += dir) {
        const d = new Date(a); d.setDate(d.getDate() + i + (dir > 0 ? 0 : 1));
        const w = d.getDay();
        if (w !== 0 && w !== 6) work++;
      }
      $('#dc-out').innerHTML = [
        ['相差天数', Math.abs(diff)], ['相差周数', (Math.abs(diff) / 7).toFixed(1)],
        ['相差月数（约）', (Math.abs(diff) / 30.44).toFixed(1)], ['相差年数（约）', (Math.abs(diff) / 365.25).toFixed(2)],
        ['工作日', work], ['周末', Math.abs(diff) - work], ['起始星期', '星期' + WEEK[a.getDay()]], ['结束星期', '星期' + WEEK[b.getDay()]]
      ].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
    };
    $('#dc-run').onclick = calc;
    $('#dc-add').onclick = () => {
      const d = parseDate($('#dc-base').value);
      const n = Number($('#dc-num').value) || 0;
      const u = $('#dc-unit').value;
      if (u === 'day') d.setDate(d.getDate() + n);
      if (u === 'week') d.setDate(d.getDate() + n * 7);
      if (u === 'month') d.setMonth(d.getMonth() + n);
      if (u === 'year') d.setFullYear(d.getFullYear() + n);
      $('#dc-add-out').textContent = `${fmtDate(d)} 星期${WEEK[d.getDay()]}`;
    };
    const info = () => {
      const d = parseDate($('#dc-one').value);
      const now = new Date();
      let age = now.getFullYear() - d.getFullYear();
      if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
      const start = new Date(d.getFullYear(), 0, 1);
      const idx = Math.floor((d - start) / 864e5) + 1;
      $('#dc-info').innerHTML = `<dt>星期</dt><dd>星期${WEEK[d.getDay()]}</dd><dt>一年中的第</dt><dd>${idx} 天</dd><dt>周数</dt><dd>第 ${weekNumber(d)} 周</dd><dt>季度</dt><dd>Q${Math.floor(d.getMonth() / 3) + 1}</dd><dt>年龄</dt><dd>${age} 岁</dd><dt>农历</dt><dd>${solarToLunar(d).text}</dd><dt>星座</dt><dd>${constellation(d.getMonth() + 1, d.getDate())}</dd>`;
    };
    $('#dc-one').addEventListener('change', info);
    calc(); info();
  },

  /* ================= 世界时钟 ================= */
  'world-clock'(root) {
    const cities = [
      ['北京', 'Asia/Shanghai'], ['东京', 'Asia/Tokyo'], ['首尔', 'Asia/Seoul'], ['新加坡', 'Asia/Singapore'],
      ['悉尼', 'Australia/Sydney'], ['迪拜', 'Asia/Dubai'], ['伦敦', 'Europe/London'], ['巴黎', 'Europe/Paris'],
      ['柏林', 'Europe/Berlin'], ['莫斯科', 'Europe/Moscow'], ['纽约', 'America/New_York'], ['洛杉矶', 'America/Los_Angeles'],
      ['多伦多', 'America/Toronto'], ['圣保罗', 'America/Sao_Paulo'], ['温哥华', 'America/Vancouver'], ['檀香山', 'Pacific/Honolulu']
    ];
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>世界时钟</b><span class="hint" id="wc-now"></span></div>
          <div class="row" style="gap:6px">${cities.map(([n], i) => `<button class="chip" data-city="${i}">${n}</button>`).join('')}</div>
        </div>
        <div class="grid3" id="wc-grid"></div>
        <div class="panel">
          <div class="panel-head"><b>时区会议规划</b></div>
          <div class="grid3">
            <div class="field"><label class="lab">日期</label><input class="inp" id="wc-date" type="date"></div>
            <div class="field"><label class="lab">时间</label><input class="inp" id="wc-time" type="time" value="10:00"></div>
            <div class="field"><label class="lab">基准城市</label><select class="sel" id="wc-base">${cities.map(([n], i) => `<option value="${i}">${n}</option>`).join('')}</select></div>
          </div>
          <button class="btn primary" id="wc-plan" style="margin-top:9px">换算</button>
          <div id="wc-plan-out" class="grid3" style="margin-top:11px"></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const selected = new Set([0, 1, 6, 10, 11]);
    $('#wc-date').value = fmtDate(new Date());
    const paint = () => {
      const now = new Date();
      $('#wc-now').textContent = now.toLocaleString('zh-CN', { hour12: false });
      $('#wc-grid').innerHTML = cities.map(([name, tz], i) => {
        if (!selected.has(i)) return '';
        const t = new Intl.DateTimeFormat('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
        const d = new Intl.DateTimeFormat('zh-CN', { timeZone: tz, month: '2-digit', day: '2-digit', weekday: 'short' }).format(now);
        return `<div class="panel tight"><div class="row between"><b>${name}</b><span class="hint">${tz.split('/')[1]}</span></div><div class="mono" style="font-size:22px;color:var(--acc)">${t}</div><div class="hint">${d}</div></div>`;
      }).join('');
    };
    root.querySelectorAll('[data-city]').forEach((b) => b.addEventListener('click', () => {
      const i = Number(b.dataset.city);
      selected.has(i) ? selected.delete(i) : selected.add(i);
      b.classList.toggle('active');
      paint();
    }));
    selected.forEach((i) => root.querySelector(`[data-city="${i}"]`)?.classList.add('active'));
    $('#wc-plan').onclick = () => {
      const base = cities[Number($('#wc-base').value)];
      const d = new Date(`${$('#wc-date').value}T${$('#wc-time').value}:00`);
      const tzBase = new Intl.DateTimeFormat('en-US', { timeZone: base[1], hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(d);
      const get = (t) => Number(tzBase.find((p) => p.type === t)?.value);
      const utcApprox = new Date(Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') === 24 ? 0 : get('hour'), get('minute'))).getTime() + d.getTime() - new Date(d).setSeconds(0, 0);
      $('#wc-plan-out').innerHTML = cities.map(([name, tz]) => {
        const t = new Intl.DateTimeFormat('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' }).format(d);
        return `<div class="panel tight"><b>${name}</b><div class="mono" style="font-size:17px;color:var(--acc)">${t}</div></div>`;
      }).join('');
    };
    paint();
    const timer = setInterval(paint, 1000);
    const obs = new MutationObserver(() => { if (!document.body.contains(root)) { clearInterval(timer); obs.disconnect(); } });
    obs.observe(document.body, { childList: true, subtree: true });
  },

  /* ================= 倒计时 ================= */
  'countdown'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>倒计时</b></div>
          <div class="row"><input class="inp" id="cd-in" type="datetime-local" style="max-width:260px"><button class="btn primary" id="cd-set">开始</button><button class="btn" id="cd-stop">停止</button></div>
        </div>
        <div class="panel center" style="padding:34px">
          <div id="cd-days" style="font-size:56px;font-weight:800;color:var(--acc);font-family:var(--mono);line-height:1.1">00</div>
          <div class="hint" style="letter-spacing:4px">天</div>
          <div id="cd-clock" style="font-size:32px;font-family:var(--mono);margin-top:8px">00:00:00</div>
          <div class="progress" style="margin-top:16px"><i id="cd-bar" style="width:0%"></i></div>
          <div class="hint" id="cd-meta" style="margin-top:8px"></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    $('#cd-in').value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    let target = null, timer = null;
    const tick = () => {
      if (!target) return;
      const diff = target - Date.now();
      const abs = Math.abs(diff);
      $('#cd-days').textContent = pad(Math.floor(abs / 864e5), 2);
      $('#cd-clock').textContent = `${pad(Math.floor(abs % 864e5 / 3600000))}:${pad(Math.floor(abs % 3600000 / 60000))}:${pad(Math.floor(abs % 60000 / 1000))}`;
      $('#cd-meta').textContent = diff > 0 ? `距离 ${target.toLocaleString('zh-CN', { hour12: false })} 还有` : '已结束，正在正计时';
      $('#cd-bar').style.width = diff > 0 ? Math.min(100, 100 - diff / (target - (window.__cdStart || Date.now())) * 100) + '%' : '100%';
      if (diff <= 0 && diff > -1000) beep(1046, 300);
    };
    $('#cd-set').onclick = () => {
      target = new Date($('#cd-in').value);
      if (isNaN(target)) return toast('请选择时间', 'err');
      window.__cdStart = Date.now();
      clearInterval(timer); timer = setInterval(tick, 1000); tick();
    };
    $('#cd-stop').onclick = () => { clearInterval(timer); timer = null; target = null; $('#cd-meta').textContent = '已停止'; };
    const obs = new MutationObserver(() => { if (!document.body.contains(root)) { clearInterval(timer); obs.disconnect(); } });
    obs.observe(document.body, { childList: true, subtree: true });
  },

  /* ================= 番茄钟 ================= */
  'pomodoro'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel center" style="padding:30px">
          <div class="tabs" style="max-width:260px;margin:0 auto 18px">
            <button class="tab active" data-mode="focus">专注 25 分钟</button><button class="tab" data-mode="break">休息 5 分钟</button>
          </div>
          <div id="pm-time" style="font-size:60px;font-weight:800;font-family:var(--mono);color:var(--acc);letter-spacing:2px">25:00</div>
          <div class="hint" id="pm-status">准备开始</div>
          <div class="row" style="justify-content:center;margin-top:16px">
            <button class="btn primary" id="pm-start">开始</button><button class="btn" id="pm-reset">重置</button>
          </div>
          <div class="progress" style="margin-top:18px;max-width:420px;margin-left:auto;margin-right:auto"><i id="pm-bar" style="width:0%"></i></div>
        </div>
        <div class="panel"><div class="panel-head"><b>今日记录</b><button class="btn sm" id="pm-clear">清空</button></div><div class="stat-grid" id="pm-stats"></div><div class="hint" id="pm-log" style="margin-top:9px"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const saved = JSON.parse(localStorage.getItem('kt:pomodoro') || '{}');
    let mode = 'focus', left = 25 * 60, total = 25 * 60, timer = null;
    const paint = () => {
      $('#pm-time').textContent = `${pad(Math.floor(left / 60))}:${pad(left % 60)}`;
      $('#pm-bar').style.width = `${(1 - left / total) * 100}%`;
      const today = fmtDate(new Date());
      const log = saved[today] || [];
      $('#pm-stats').innerHTML = `<div class="stat"><b>${log.length}</b><span>完成番茄</span></div><div class="stat"><b>${log.length * 25}</b><span>专注分钟</span></div>`;
      $('#pm-log').textContent = log.length ? '最近：' + log.slice(-3).map((t) => new Date(t).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })).join('、') : '还没有记录';
    };
    const setMode = (m) => {
      mode = m; total = left = (m === 'focus' ? 25 : 5) * 60;
      root.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
      $('#pm-status').textContent = m === 'focus' ? '准备专注' : '准备休息';
      paint();
    };
    root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { clearInterval(timer); timer = null; setMode(b.dataset.mode); }));
    $('#pm-start').onclick = () => {
      if (timer) { clearInterval(timer); timer = null; $('#pm-start').textContent = '继续'; $('#pm-status').textContent = '已暂停'; return; }
      $('#pm-start').textContent = '暂停';
      $('#pm-status').textContent = mode === 'focus' ? '专注中…' : '休息中…';
      timer = setInterval(() => {
        left--;
        if (left <= 0) {
          clearInterval(timer); timer = null;
          beep(1046, 500);
          if (mode === 'focus') {
            const today = fmtDate(new Date());
            saved[today] = saved[today] || [];
            saved[today].push(Date.now());
            localStorage.setItem('kt:pomodoro', JSON.stringify(saved));
            setMode('break');
            $('#pm-status').textContent = '专注完成，休息一下';
          } else {
            setMode('focus');
            $('#pm-status').textContent = '休息结束，继续专注';
          }
          $('#pm-start').textContent = '开始';
          paint();
          return;
        }
        paint();
      }, 1000);
    };
    $('#pm-reset').onclick = () => { clearInterval(timer); timer = null; $('#pm-start').textContent = '开始'; setMode(mode); };
    $('#pm-clear').onclick = () => { delete saved[fmtDate(new Date())]; localStorage.setItem('kt:pomodoro', JSON.stringify(saved)); paint(); };
    paint();
    const obs = new MutationObserver(() => { if (!document.body.contains(root)) { clearInterval(timer); obs.disconnect(); } });
    obs.observe(document.body, { childList: true, subtree: true });
  },

  /* ================= 秒表 ================= */
  'stopwatch'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel center" style="padding:30px">
          <div id="sw-time" style="font-size:52px;font-weight:800;font-family:var(--mono);color:var(--acc);letter-spacing:1px">00:00.000</div>
          <div class="row" style="justify-content:center;margin-top:16px">
            <button class="btn primary" id="sw-start">开始</button>
            <button class="btn" id="sw-lap">分段</button>
            <button class="btn" id="sw-reset">重置</button>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>分段记录</b></div><div id="sw-laps" class="hint">还没有分段</div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let start = 0, elapsed = 0, timer = null, laps = [];
    const paint = () => {
      const t = elapsed + (timer ? Date.now() - start : 0);
      $('#sw-time').textContent = `${pad(Math.floor(t / 60000))}:${pad(Math.floor(t % 60000 / 1000))}.${String(t % 1000).padStart(3, '0')}`;
    };
    $('#sw-start').onclick = () => {
      if (timer) { clearInterval(timer); timer = null; elapsed += Date.now() - start; $('#sw-start').textContent = '继续'; }
      else { start = Date.now(); timer = setInterval(paint, 30); $('#sw-start').textContent = '暂停'; }
      paint();
    };
    $('#sw-lap').onclick = () => {
      if (!timer) return;
      laps.push(elapsed + Date.now() - start);
      $('#sw-laps').innerHTML = laps.map((t, i) => `<div class="row between" style="border-bottom:1px solid var(--line);padding:4px 0"><span>分段 ${i + 1}</span><span class="mono">${(t / 1000).toFixed(3)} s</span></div>`).join('');
    };
    $('#sw-reset').onclick = () => { clearInterval(timer); timer = null; elapsed = 0; laps = []; $('#sw-start').textContent = '开始'; $('#sw-laps').textContent = '还没有分段'; paint(); };
    paint();
    const obs = new MutationObserver(() => { if (!document.body.contains(root)) { clearInterval(timer); obs.disconnect(); } });
    obs.observe(document.body, { childList: true, subtree: true });
  },

  /* ================= 日历 ================= */
  'calendar-gen'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="row between">
            <div class="row"><button class="btn sm" id="cal-prev">‹</button><b id="cal-title" style="font-size:16px;min-width:140px;text-align:center"></b><button class="btn sm" id="cal-next">›</button></div>
            <div class="row"><button class="btn sm" id="cal-today">今天</button><button class="btn sm" id="cal-png">下载 PNG</button></div>
          </div>
        </div>
        <div class="panel" style="padding:12px"><div id="cal-body"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let cursor = new Date();
    const paint = () => {
      const y = cursor.getFullYear(), m = cursor.getMonth();
      $('#cal-title').textContent = `${y} 年 ${m + 1} 月`;
      const first = new Date(y, m, 1);
      const start = first.getDay();
      const days = daysInMonth(y, m);
      const today = fmtDate(new Date());
      let html = `<div class="cal-grid">${['日', '一', '二', '三', '四', '五', '六'].map((d) => `<div class="cal-head">${d}</div>`).join('')}`;
      for (let i = 0; i < start; i++) html += '<div></div>';
      for (let d = 1; d <= days; d++) {
        const ds = `${y}-${pad(m + 1)}-${pad(d)}`;
        const lunar = solarToLunar(new Date(y, m, d));
        html += `<div class="cal-day${ds === today ? ' today' : ''}"><b>${d}</b><small>${esc(lunar.day || '')}</small></div>`;
      }
      html += '</div>';
      $('#cal-body').innerHTML = html;
    };
    $('#cal-prev').onclick = () => { cursor.setMonth(cursor.getMonth() - 1); paint(); };
    $('#cal-next').onclick = () => { cursor.setMonth(cursor.getMonth() + 1); paint(); };
    $('#cal-today').onclick = () => { cursor = new Date(); paint(); };
    $('#cal-png').onclick = () => {
      const y = cursor.getFullYear(), m = cursor.getMonth();
      const cv = document.createElement('canvas');
      cv.width = 720; cv.height = 780;
      const g = cv.getContext('2d');
      g.fillStyle = '#0e1626'; g.fillRect(0, 0, cv.width, cv.height);
      g.fillStyle = '#e9eefc'; g.font = '700 30px -apple-system, "PingFang SC", sans-serif'; g.textAlign = 'center';
      g.fillText(`${y} 年 ${m + 1} 月`, 360, 56);
      const cw = 96, ch = 100, left = 24, top = 90;
      g.font = '600 15px sans-serif'; g.fillStyle = '#8b9bb8';
      ['日', '一', '二', '三', '四', '五', '六'].forEach((d, i) => g.fillText(d, left + cw * i + cw / 2, top - 18));
      const start = new Date(y, m, 1).getDay();
      const days = daysInMonth(y, m);
      for (let d = 1; d <= days; d++) {
        const idx = start + d - 1, col = idx % 7, row = Math.floor(idx / 7);
        const x = left + col * cw, yy = top + row * ch;
        g.strokeStyle = 'rgba(255,255,255,.08)'; g.strokeRect(x, yy, cw, ch);
        g.fillStyle = '#e9eefc'; g.font = '600 18px sans-serif'; g.textAlign = 'left'; g.fillText(String(d), x + 10, yy + 28);
        g.fillStyle = '#8b9bb8'; g.font = '12px sans-serif'; g.fillText(solarToLunar(new Date(y, m, d)).day || '', x + 10, yy + 52);
      }
      cv.toBlob((b) => download(`calendar-${y}-${m + 1}.png`, b));
    };
    paint();
    root.querySelector('style') || (root.innerHTML += `<style>.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}.cal-head{text-align:center;font-size:11px;color:var(--muted);padding:6px 0}.cal-day{aspect-ratio:1;border:1px solid var(--line);border-radius:8px;padding:6px;display:flex;flex-direction:column;justify-content:space-between}.cal-day b{font-size:13px}.cal-day small{font-size:9px;color:var(--muted)}.cal-day.today{border-color:var(--acc);background:var(--acc-soft)}</style>`);
  },

  /* ================= 农历 ================= */
  'lunar'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>农历 / 节气 / 生肖 / 星座</b><span class="hint">使用浏览器 Intl 农历日历</span></div>
          <div class="grid3">
            <div class="field"><label class="lab">公历日期</label><input class="inp" id="ln-date" type="date"></div>
            <div class="field"><label class="lab">出生月日（星座）</label><input class="inp" id="ln-md" type="date"></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="ln-run" style="width:100%">查询</button></div>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b></div><div id="ln-out" class="kv"></div></div>
        <div class="panel">
          <div class="panel-head"><b>二十四节气（近似日期）</b></div>
          <div class="row" style="gap:6px">${['小寒 1/5', '大寒 1/20', '立春 2/4', '雨水 2/19', '惊蛰 3/5', '春分 3/20', '清明 4/5', '谷雨 4/20', '立夏 5/5', '小满 5/21', '芒种 6/6', '夏至 6/21', '小暑 7/7', '大暑 7/23', '立秋 8/7', '处暑 8/23', '白露 9/8', '秋分 9/23', '寒露 10/8', '霜降 10/23', '立冬 11/7', '小雪 11/22', '大雪 12/7', '冬至 12/22'].map((x) => `<span class="tag" style="font-size:11px;padding:3px 6px">${x}</span>`).join('')}</div>
          <div class="hint" style="margin-top:7px">节气日期每年略有浮动，此处为常见日期，仅供日常参考。</div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#ln-date').value = fmtDate(new Date());
    $('#ln-md').value = '1995-06-15';
    const run = () => {
      const d = parseDate($('#ln-date').value);
      const lunar = solarToLunar(d);
      const md = parseDate($('#ln-md').value);
      const zodiac = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'][(d.getFullYear() - 4) % 12];
      $('#ln-out').innerHTML = `<dt>公历</dt><dd>${fmtDate(d)} 星期${WEEK[d.getDay()]}</dd><dt>农历</dt><dd>${esc(lunar.text)}</dd><dt>生肖（农历年）</dt><dd>${zodiac}</dd><dt>星座</dt><dd>${constellation(md.getMonth() + 1, md.getDate())}</dd><dt>一年中的第</dt><dd>${Math.floor((d - new Date(d.getFullYear(), 0, 1)) / 864e5) + 1} 天</dd>`;
    };
    $('#ln-run').onclick = run;
    run();
  },

  /* ================= 日出日落 ================= */
  'sun-moon'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>日出日落 / 黄金时刻 / 月相</b><span class="hint">输入经纬度与日期，本地计算</span></div>
          <div class="grid4">
            <div class="field"><label class="lab">纬度</label><input class="inp" id="sm-lat" value="39.9042"></div>
            <div class="field"><label class="lab">经度</label><input class="inp" id="sm-lon" value="116.4074"></div>
            <div class="field"><label class="lab">日期</label><input class="inp" id="sm-date" type="date"></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="sm-run" style="width:100%">计算</button></div>
          </div>
          <div class="row" style="margin-top:8px;gap:5px">
            <button class="chip" data-loc="39.9042,116.4074">北京</button><button class="chip" data-loc="31.2304,121.4737">上海</button>
            <button class="chip" data-loc="22.5431,114.0579">深圳</button><button class="chip" data-loc="51.5074,-0.1278">伦敦</button><button class="chip" data-loc="40.7128,-74.0060">纽约</button>
          </div>
        </div>
        <div class="grid2" id="sm-cards"></div>
        <div class="panel"><div class="panel-head"><b>月相</b></div><div id="sm-moon"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#sm-date').value = fmtDate(new Date());
    const run = () => {
      const lat = Number($('#sm-lat').value), lon = Number($('#sm-lon').value);
      const date = parseDate($('#sm-date').value);
      const t = sunTimes(date, lat, lon);
      const time = (d) => d ? d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—';
      if (!t.main) { $('#sm-cards').innerHTML = '<div class="panel"><div class="warnbox">该纬度出现极昼或极夜，没有常规日出日落。</div></div>'; }
      else {
        $('#sm-cards').innerHTML = [
          ['日出', time(t.main.rise), '#fbbf24'], ['日落', time(t.main.set), '#f472b6'],
          ['正午', time(t.transit), '#38cdf0'], ['白昼时长', ((t.main.set - t.main.rise) / 3600000).toFixed(2) + ' 小时', '#34d399'],
          ['黄金时刻（傍晚）', `${time(t.golden?.set)} 起`, '#f59e0b'], ['蓝调时刻（傍晚）', `${time(t.blue?.set)} 起`, '#818cf8']
        ].map(([k, v, c]) => `<div class="panel tight"><div class="hint">${k}</div><div class="mono" style="font-size:19px;color:${c}">${v}</div></div>`).join('');
      }
      const mp = moonPhase(date);
      const lit = Math.round(mp.frac * 100);
      $('#sm-moon').innerHTML = `<div class="row"><div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(90deg,#cbd5e1 ${lit}%, #1e293b ${lit}%);border:1px solid var(--line-strong)"></div><div><b>${mp.name}</b><div class="hint">月龄 ${mp.age.toFixed(1)} 天 · 相位 ${lit}%</div></div></div>`;
    };
    $('#sm-run').onclick = run;
    root.querySelectorAll('[data-loc]').forEach((b) => b.addEventListener('click', () => {
      const [a, o] = b.dataset.loc.split(',');
      $('#sm-lat').value = a; $('#sm-lon').value = o; run();
    }));
    run();
  },

  /* ================= 睡眠计算 ================= */
  'sleep-calc'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>睡眠周期计算</b><span class="hint">以 90 分钟为一个周期，预留 15 分钟入睡</span></div>
          <div class="grid3">
            <div class="field"><label class="lab">模式</label><select class="sel" id="sl-mode"><option value="wake">我想几点起床 → 建议入睡</option><option value="sleep">我准备几点睡 → 建议起床</option></select></div>
            <div class="field"><label class="lab">时间</label><input class="inp" id="sl-time" type="time" value="07:00"></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="sl-run" style="width:100%">计算</button></div>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>建议时间</b><span class="hint">选择醒后精神最好的时长</span></div><div id="sl-out" class="grid3"></div></div>
        <div class="warnbox">睡眠需求因人而异，本工具只做简单周期推算，不构成健康建议。</div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const run = () => {
      const [h, m] = $('#sl-time').value.split(':').map(Number);
      const base = new Date(); base.setHours(h, m, 0, 0);
      const mode = $('#sl-mode').value;
      const out = [];
      for (let cycles = 6; cycles >= 3; cycles--) {
        const mins = cycles * 90 + 15;
        const d = new Date(base);
        if (mode === 'wake') d.setMinutes(d.getMinutes() - mins);
        else d.setMinutes(d.getMinutes() + mins);
        out.push([`${cycles} 个周期`, d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }), `${(cycles * 1.5).toFixed(1)} 小时`]);
      }
      $('#sl-out').innerHTML = out.map(([a, b, c], i) => `<div class="panel tight" style="${i === 1 ? 'border-color:rgba(56,205,240,.4)' : ''}"><div class="hint">${a}</div><div class="mono" style="font-size:22px;color:var(--acc)">${b}</div><div class="hint">${c}</div></div>`).join('');
    };
    $('#sl-run').onclick = run;
    run();
  },

  /* ================= 纪念日 ================= */
  'anniversary'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>纪念日 / 倒数日</b><span class="hint">保存在本机浏览器</span></div>
          <div class="grid4">
            <div class="field"><label class="lab">名称</label><input class="inp" id="an-name" placeholder="生日 / 项目上线"></div>
            <div class="field"><label class="lab">日期</label><input class="inp" id="an-date" type="date"></div>
            <div class="field"><label class="lab">类型</label><select class="sel" id="an-type"><option value="countdown">倒数日</option><option value="annual">每年纪念</option></select></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="an-add" style="width:100%">添加</button></div>
          </div>
        </div>
        <div id="an-list" class="tool-ui"></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const load = () => JSON.parse(localStorage.getItem('kt:anniversary') || '[]');
    const save = (x) => localStorage.setItem('kt:anniversary', JSON.stringify(x));
    const paint = () => {
      const list = load();
      const today = new Date(); today.setHours(0, 0, 0, 0);
      $('#an-list').innerHTML = list.length ? list.map((it, i) => {
        let target = new Date(it.date + 'T00:00:00');
        if (it.type === 'annual') { target.setFullYear(today.getFullYear()); if (target < today) target.setFullYear(today.getFullYear() + 1); }
        const days = Math.round((target - today) / 864e5);
        return `<div class="panel tight"><div class="row between"><div><b>${esc(it.name)}</b><div class="hint">${esc(it.date)}${it.type === 'annual' ? ' · 每年' : ''}</div></div><div class="center"><div class="mono" style="font-size:26px;color:var(--acc)">${days}</div><div class="hint">天后</div></div><button class="btn sm danger" data-del="${i}">删除</button></div></div>`;
      }).join('') : '<div class="empty">还没有纪念日，添加一个吧</div>';
      root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { const l = load(); l.splice(Number(b.dataset.del), 1); save(l); paint(); }));
    };
    $('#an-add').onclick = () => {
      const name = $('#an-name').value.trim();
      const date = $('#an-date').value;
      if (!name || !date) return toast('请填写名称和日期', 'err');
      const list = load();
      list.push({ name, date, type: $('#an-type').value });
      save(list);
      $('#an-name').value = '';
      paint();
    };
    paint();
  }
};
