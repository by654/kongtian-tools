/* 健康、睡眠、心理、营养与运动 */
import { esc, copy, toast, download } from '../core/ui.js';
import { calcWorkbench } from '../core/workbench.js';

const $ = (root, s) => root.querySelector(s);
const today = () => new Date().toISOString().slice(0, 10);
const num = (id) => Number(document.getElementById(id)?.value || 0);
function beep(freq = 880, ms = 160) {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = freq; g.gain.value = 0.14;
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + ms / 1000);
    setTimeout(() => ac.close(), ms + 200);
  } catch { /* */ }
}
const LS = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(d)); } catch { return d; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
};

export default {
  /* ================= 健康记录 ================= */
  'vitals-log'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="grid4">
            <div class="field"><label class="lab">类型</label><select class="sel" id="vl-type"><option value="bp">血压</option><option value="glucose">血糖</option><option value="temp">体温</option><option value="weight">体重</option><option value="spo2">血氧</option></select></div>
            <div class="field"><label class="lab">数值 1</label><input class="inp" id="vl-v1" type="number" step="0.1"></div>
            <div class="field"><label class="lab">数值 2（血压舒张压）</label><input class="inp" id="vl-v2" type="number" step="0.1"></div>
            <div class="field"><label class="lab">日期</label><input class="inp" id="vl-date" type="date"></div>
          </div>
          <div class="row" style="margin-top:9px"><input class="inp" id="vl-note" placeholder="备注" style="flex:1"><button class="btn primary" id="vl-add">记录</button><button class="btn" id="vl-csv">导出 CSV</button><button class="btn" id="vl-mask">导出脱敏 CSV</button><button class="btn" id="vl-card">紧急信息卡</button></div>
        </div>
        <div class="panel"><div class="panel-head"><b>趋势</b><span class="hint" id="vl-meta"></span></div><div class="canvas-wrap"><canvas id="vl-chart" width="760" height="260"></canvas></div></div>
        <div class="panel"><div class="panel-head"><b>记录</b><button class="btn sm" id="vl-clear">清空</button></div><div id="vl-list" class="table-scroll" style="max-height:280px"></div></div>
        <div class="warnbox">健康记录仅作本地整理，不构成诊断或用药建议。请遵医嘱。</div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#vl-date').value = today();
    const load = () => LS.get('kt:vitals', []);
    const save = (x) => LS.set('kt:vitals', x);
    const label = { bp: '血压', glucose: '血糖', temp: '体温', weight: '体重', spo2: '血氧' };
    const unit = { bp: 'mmHg', glucose: 'mmol/L', temp: '°C', weight: 'kg', spo2: '%' };
    const paint = () => {
      const list = load();
      const type = $('#vl-type').value;
      const rows = list.filter((x) => x.type === type).slice(-30);
      $('#vl-meta').textContent = `${label[type]} · ${rows.length} 条`;
      const cv = $('#vl-chart'), g = cv.getContext('2d');
      g.clearRect(0, 0, cv.width, cv.height);
      const vals = rows.map((r) => r.v1);
      const vals2 = rows.map((r) => r.v2).filter((v) => v != null);
      const all = [...vals, ...vals2];
      if (!all.length) {
        g.fillStyle = '#8b9bb8'; g.font = '14px sans-serif'; g.textAlign = 'center'; g.fillText('还没有记录', cv.width / 2, 130); g.textAlign = 'left';
      } else {
        const min = Math.min(...all) * 0.95, max = Math.max(...all) * 1.05 || 1;
        g.strokeStyle = 'rgba(255,255,255,.08)';
        for (let i = 0; i < 5; i++) { const y = 20 + i * 50; g.beginPath(); g.moveTo(40, y); g.lineTo(740, y); g.stroke(); }
        const drawLine = (arr, color) => {
          g.strokeStyle = color; g.lineWidth = 2; g.beginPath();
          arr.forEach((v, i) => {
            const x = 40 + i / Math.max(1, arr.length - 1) * 700;
            const y = 230 - (v - min) / (max - min || 1) * 190;
            i ? g.lineTo(x, y) : g.moveTo(x, y);
          });
          g.stroke();
        };
        drawLine(vals, '#38cdf0');
        if (vals2.length) drawLine(vals2, '#f472b6');
        g.fillStyle = '#8b9bb8'; g.font = '11px sans-serif';
        g.fillText(`${min.toFixed(1)} – ${max.toFixed(1)} ${unit[type]}`, 40, 252);
      }
      $('#vl-list').innerHTML = list.length ? `<table class="tbl"><tr><th>日期</th><th>类型</th><th>数值</th><th>备注</th><th></th></tr>${list.slice().reverse().map((r) => `<tr><td>${r.date}</td><td>${label[r.type]}</td><td class="mono">${r.v1}${r.v2 != null ? ' / ' + r.v2 : ''} ${unit[r.type]}</td><td>${esc(r.note || '')}</td><td><button class="btn sm danger" data-del="${r.id}">删</button></td></tr>`).join('')}</table>` : '<div class="hint">还没有记录</div>';
      root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { save(load().filter((x) => x.id !== Number(b.dataset.del))); paint(); }));
    };
    $('#vl-type').addEventListener('change', paint);
    $('#vl-add').onclick = () => {
      const type = $('#vl-type').value, v1 = Number($('#vl-v1').value);
      if (!v1) return toast('请输入数值', 'err');
      const l = load();
      l.push({ id: Date.now(), type, v1, v2: type === 'bp' ? Number($('#vl-v2').value) || null : null, date: $('#vl-date').value || today(), note: $('#vl-note').value });
      save(l); $('#vl-v1').value = ''; $('#vl-v2').value = ''; $('#vl-note').value = '';
      paint();
    };
    const csv = (masked) => {
      const rows = [['日期', '类型', '数值1', '数值2', '备注'], ...load().map((r) => [r.date, label[r.type], masked ? '***' : r.v1, masked ? '***' : (r.v2 ?? ''), masked ? '' : r.note])];
      download(masked ? 'vitals-masked.csv' : 'vitals.csv', '\ufeff' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
    };
    $('#vl-csv').onclick = () => csv(false);
    $('#vl-mask').onclick = () => csv(true);
    $('#vl-card').onclick = () => {
      const w = window.open('', '_blank');
      const list = load().slice(-8);
      w.document.write(`<html><head><meta charset="utf-8"><title>紧急医疗信息卡</title><style>body{font-family:-apple-system,"PingFang SC",sans-serif;max-width:560px;margin:40px auto;padding:0 20px}h1{font-size:22px;border-bottom:2px solid #111;padding-bottom:8px}td,th{border:1px solid #ddd;padding:6px 10px;font-size:13px}table{width:100%;border-collapse:collapse}</style></head><body><h1>紧急医疗信息卡</h1><p>姓名：__________　血型：______　过敏史：__________</p><p>紧急联系人：__________　电话：__________</p><h2 style="font-size:16px">最近记录</h2><table><tr><th>日期</th><th>类型</th><th>数值</th></tr>${list.map((r) => `<tr><td>${r.date}</td><td>${label[r.type]}</td><td>${r.v1}${r.v2 != null ? '/' + r.v2 : ''}</td></tr>`).join('')}</table><p style="color:#888;font-size:12px;margin-top:24px">由空天工具合集本地生成，仅供就医沟通参考。</p></body></html>`);
      w.document.close();
    };
    $('#vl-clear').onclick = () => { if (confirm('清空全部健康记录？')) { save([]); paint(); } };
    paint();
  },

  /* ================= 睡眠与作息 ================= */
  'sleep-pro'(root) {
    calcWorkbench(root, {
      title: '睡眠与作息计算',
      note: '成人通常需要 7–9 小时睡眠；结果仅为估算，不替代医学建议。',
      groups: [
        { name: '睡眠周期', fields: [['wake', '起床时间', '07:00', 'time']], run: (v) => {
          const [h, m] = v.wake.split(':').map(Number);
          const base = new Date(); base.setHours(h, m, 0, 0);
          return [6, 5, 4].map((c) => {
            const d = new Date(base); d.setMinutes(d.getMinutes() - (c * 90 + 15));
            return `${c} 个周期（${(c * 1.5).toFixed(1)} h）：建议 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} 入睡`;
          }).join('\n');
        } },
        { name: '睡眠债务', fields: [['need', '每日需要 h', 8], ['actual', '实际睡眠（每行一天）', '6.5\n7\n6\n7.5', 'textarea']], run: (v) => {
          const arr = v.actual.split(/\r?\n/).map(Number).filter((x) => !isNaN(x));
          const debt = arr.reduce((s, x) => s + Math.max(0, v.need - x), 0);
          return `天数：${arr.length}\n累计睡眠债务：${debt.toFixed(1)} 小时\n平均睡眠：${(arr.reduce((a, b) => a + b, 0) / (arr.length || 1)).toFixed(2)} 小时/天\n建议分 3–5 天补回，每天多睡 1–2 小时。`;
        } },
        { name: '睡眠效率', fields: [['bed', '卧床时间 min', 480], ['asleep', '实际睡着 min', 420]], run: (v) => `睡眠效率 = ${(v.asleep / v.bed * 100).toFixed(1)}%\n（≥85% 通常较好，<75% 建议关注作息）` },
        { name: '咖啡因半衰期', fields: [['mg', '摄入量 mg', 200], ['hours', '经过小时', 4], ['half', '半衰期 h', 5]], run: (v) => `剩余咖啡因 ≈ ${(v.mg * 0.5 ** (v.hours / v.half)).toFixed(1)} mg\n约 ${(v.half * Math.log2(v.mg / 50)).toFixed(1)} 小时后降至 50 mg 以下` },
        { name: '时差调整', fields: [['from', '出发时区 UTC', 8], ['to', '到达时区 UTC', -5], ['days', '行程天数', 5]], run: (v) => {
          const diff = v.to - v.from;
          return `时差：${diff > 0 ? '+' : ''}${diff} 小时\n建议每天调整 ${(Math.abs(diff) / Math.max(1, v.days)).toFixed(1)} 小时\n抵达后白天多晒太阳，睡前 1 小时避免强光。`;
        } },
        { name: '小睡建议', fields: [['type', '小睡类型', 'power', 'select', [['power', '20 分钟能量盹'], ['full', '90 分钟完整周期']]]], run: (v) => v.type === 'power' ? '建议 15–25 分钟，避免进入深睡导致起床昏沉。' : '建议 90 分钟，完成一个完整睡眠周期；下午 3 点后不建议长睡。' }
      ]
    });
  },

  /* ================= 心理与冥想 ================= */
  'mind-care'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="mc-tabs"><button class="tab active" data-i="0">情绪</button><button class="tab" data-i="1">压力/焦虑</button><button class="tab" data-i="2">感恩日记</button><button class="tab" data-i="3">呼吸训练</button><button class="tab" data-i="4">冥想日志</button></div>
        <div class="panel" id="mc-p0">
          <div class="row">${[['很好', 5], ['不错', 4], ['一般', 3], ['低落', 2], ['很差', 1]].map(([n, v]) => `<button class="chip" data-mood="${v}">${n}</button>`).join('')}</div>
          <textarea class="ta" id="mc-note" rows="3" style="margin-top:9px" placeholder="今天发生了什么？"></textarea>
          <button class="btn primary" id="mc-save" style="margin-top:9px">保存今日情绪</button>
          <div id="mc-list" class="tool-ui" style="margin-top:12px"></div>
        </div>
        <div class="panel hidden" id="mc-p1">
          <div class="grid3"><div class="field"><label class="lab">压力 0–10</label><input class="inp" id="mc-stress" type="number" min="0" max="10" value="5"></div><div class="field"><label class="lab">焦虑 0–10</label><input class="inp" id="mc-anxiety" type="number" min="0" max="10" value="3"></div><div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="mc-save2" style="width:100%">记录</button></div></div>
          <div id="mc-list2" class="tool-ui" style="margin-top:12px"></div>
        </div>
        <div class="panel hidden" id="mc-p2">
          <div class="field"><label class="lab">今天值得感谢的三件事</label><textarea class="ta" id="mc-grat" rows="4" placeholder="1.\n2.\n3."></textarea></div>
          <button class="btn primary" id="mc-save3" style="margin-top:9px">保存</button>
          <div id="mc-list3" class="tool-ui" style="margin-top:12px"></div>
        </div>
        <div class="panel hidden" id="mc-p3">
          <div class="grid3">
            <div class="field"><label class="lab">呼吸法</label><select class="sel" id="mc-pattern"><option value="478">4-7-8 呼吸</option><option value="box">箱式呼吸 4-4-4-4</option><option value="calm">平稳呼吸 4-4-4</option></select></div>
            <div class="field"><label class="lab">轮数</label><input class="inp" id="mc-rounds" type="number" value="4"></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="mc-breath" style="width:100%">开始</button></div>
          </div>
          <div class="center" style="margin-top:20px"><div id="mc-circle" style="width:120px;height:120px;border-radius:50%;background:var(--acc-soft);border:2px solid var(--acc);margin:0 auto;transition:transform 1s ease,background 1s"></div><div class="hint" id="mc-phase" style="margin-top:12px">准备</div><div class="hint" id="mc-round-label"></div></div>
        </div>
        <div class="panel hidden" id="mc-p4">
          <div class="field"><label class="lab">冥想时长（分钟）</label><input class="inp" id="mc-min" type="number" value="10"></div>
          <button class="btn primary" id="mc-meditate" style="margin-top:9px">开始计时</button><span class="hint" id="mc-med-status"></span>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let mood = 3;
    const load = (k) => LS.get(k, []);
    const save = (k, v) => LS.set(k, v);
    const paintMood = () => {
      const list = load('kt:moodlog').slice(-14).reverse();
      $('#mc-list').innerHTML = list.length ? list.map((x) => `<div class="panel tight"><div class="row between"><b>${x.date} · ${x.score}/5</b></div><div class="hint" style="white-space:pre-wrap">${esc(x.note)}</div></div>`).join('') : '<div class="hint">还没有记录</div>';
    };
    const paintStress = () => {
      const list = load('kt:stress').slice(-14).reverse();
      $('#mc-list2').innerHTML = list.length ? list.map((x) => `<div class="row between" style="border-bottom:1px solid var(--line);padding:5px 0"><span>${x.date}</span><span class="hint">压力 ${x.stress} · 焦虑 ${x.anxiety}</span></div>`).join('') : '<div class="hint">还没有记录</div>';
    };
    const paintGrat = () => {
      const list = load('kt:gratitude').slice(-10).reverse();
      $('#mc-list3').innerHTML = list.length ? list.map((x) => `<div class="panel tight"><b>${x.date}</b><div class="hint" style="white-space:pre-wrap">${esc(x.text)}</div></div>`).join('') : '<div class="hint">还没有记录</div>';
    };
    $('#mc-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#mc-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      [0, 1, 2, 3, 4].forEach((i) => $('#mc-p' + i).classList.toggle('hidden', String(i) !== b.dataset.i));
    });
    root.querySelectorAll('[data-mood]').forEach((b) => b.addEventListener('click', () => { mood = Number(b.dataset.mood); root.querySelectorAll('[data-mood]').forEach((x) => x.classList.toggle('active', x === b)); }));
    $('#mc-save').onclick = () => {
      const l = load('kt:moodlog'); l.push({ date: today(), score: mood, note: $('#mc-note').value }); save('kt:moodlog', l); paintMood();
    };
    $('#mc-save2').onclick = () => {
      const l = load('kt:stress'); l.push({ date: today(), stress: num('mc-stress'), anxiety: num('mc-anxiety') }); save('kt:stress', l); paintStress();
    };
    $('#mc-save3').onclick = () => {
      const l = load('kt:gratitude'); l.push({ date: today(), text: $('#mc-grat').value }); save('kt:gratitude', l); paintGrat();
    };
    const patterns = { 478: [4, 7, 8], box: [4, 4, 4, 4], calm: [4, 4, 4] };
    let breathTimer = null;
    $('#mc-breath').onclick = () => {
      if (breathTimer) { clearTimeout(breathTimer); breathTimer = null; $('#mc-breath').textContent = '开始'; $('#mc-phase').textContent = '已停止'; return; }
      const seq = patterns[$('#mc-pattern').value];
      const rounds = Math.max(1, num('mc-rounds'));
      const labels = seq.length === 3 ? ['吸气', '屏息', '呼气'] : ['吸气', '屏息', '呼气', '屏息'];
      let r = 0, step = 0;
      const tick = () => {
        if (r >= rounds) { $('#mc-phase').textContent = '完成'; $('#mc-breath').textContent = '开始'; $('#mc-circle').style.transform = 'scale(1)'; breathTimer = null; return; }
        const phase = step % seq.length;
        const sec = seq[phase];
        $('#mc-phase').textContent = labels[phase] + ' ' + sec + ' 秒';
        $('#mc-round-label').textContent = `第 ${r + 1} / ${rounds} 轮`;
        $('#mc-circle').style.transform = phase === 0 ? 'scale(1.35)' : phase === 2 ? 'scale(.85)' : 'scale(1.1)';
        $('#mc-circle').style.background = phase === 0 ? 'rgba(56,205,240,.2)' : phase === 2 ? 'rgba(129,140,248,.12)' : 'rgba(56,205,240,.08)';
        step++;
        if (step % seq.length === 0) r++;
        breathTimer = setTimeout(tick, sec * 1000);
      };
      $('#mc-breath').textContent = '停止';
      tick();
    };
    let medTimer = null;
    $('#mc-meditate').onclick = () => {
      if (medTimer) { clearInterval(medTimer); medTimer = null; $('#mc-med-status').textContent = '已停止'; return; }
      let left = Math.max(1, num('mc-min')) * 60;
      $('#mc-med-status').textContent = `剩余 ${left}s`;
      medTimer = setInterval(() => {
        left--;
        $('#mc-med-status').textContent = `剩余 ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
        if (left <= 0) { clearInterval(medTimer); medTimer = null; beep(660, 500); $('#mc-med-status').textContent = '完成'; const l = load('kt:meditation'); l.push({ date: today(), min: num('mc-min') }); save('kt:meditation', l); }
      }, 1000);
    };
    ctx.onDestroy(() => { clearTimeout(breathTimer); clearInterval(medTimer); });
    paintMood(); paintStress(); paintGrat();
  },

  /* ================= 营养与烹饪 ================= */
  'nutrition'(root) {
    calcWorkbench(root, {
      title: '营养与烹饪计算',
      groups: [
        { name: '食谱缩放', fields: [['from', '原份数', 2], ['to', '目标份数', 4], ['amount', '某食材用量 g', 200]], run: (v) => `缩放系数 ×${(v.to / v.from).toFixed(2)}\n该食材需 ${(v.amount * v.to / v.from).toFixed(1)} g` },
        { name: '杯/克/毫升', fields: [['v', '体积', 1], ['unit', '单位', 'cup', 'select', [['cup', '杯'], ['tbsp', '汤匙'], ['tsp', '茶匙'], ['ml', '毫升']]], ['density', '密度 g/ml', 1]], run: (v) => { const ml = v.v * ({ cup: 240, tbsp: 15, tsp: 5, ml: 1 }[v.unit]); return `${v.v} ${v.unit} = ${ml} ml = ${(ml * v.density).toFixed(1)} g（按密度 ${v.density}）`; } },
        { name: '烤箱温度', fields: [['c', '摄氏度 °C', 180], ['fan', '热风', 'no', 'select', [['no', '否'], ['yes', '是（降 20°C）']]]], run: (v) => { const c = v.fan === 'yes' ? v.c - 20 : v.c; return `${v.c}°C → ${(c * 9 / 5 + 32).toFixed(0)}°F${v.fan === 'yes' ? '\n热风建议设为 ' + c + '°C' : ''}`; } },
        { name: '宏量营养', fields: [['p', '蛋白质 g', 30], ['c', '碳水 g', 50], ['f', '脂肪 g', 20]], run: (v) => { const cal = v.p * 4 + v.c * 4 + v.f * 9; return `总热量 = ${cal.toFixed(0)} kcal\n蛋白质 ${(v.p * 4 / cal * 100).toFixed(0)}% · 碳水 ${(v.c * 4 / cal * 100).toFixed(0)}% · 脂肪 ${(v.f * 9 / cal * 100).toFixed(0)}%`; } },
        { name: '每日热量目标', fields: [['kg', '体重 kg', 65], ['h', '身高 cm', 170], ['age', '年龄', 28], ['sex', '性别', 'm', 'select', [['m', '男'], ['f', '女']]], ['act', '活动系数', 1.5]], run: (v) => { const bmr = 10 * v.kg + 6.25 * v.h - 5 * v.age + (v.sex === 'm' ? 5 : -161); return `基础代谢 ≈ ${bmr.toFixed(0)} kcal\n每日消耗 ≈ ${(bmr * v.act).toFixed(0)} kcal\n减脂建议 ${(bmr * v.act - 400).toFixed(0)} kcal，增肌建议 ${(bmr * v.act + 300).toFixed(0)} kcal`; } },
        { name: '面团含水量', fields: [['flour', '面粉 g', 500], ['hydro', '含水量 %', 65]], run: (v) => `需水 ${(v.flour * v.hydro / 100).toFixed(0)} g\n总面团约 ${(v.flour * (1 + v.hydro / 100)).toFixed(0)} g` },
        { name: '咖啡粉水比', fields: [['coffee', '咖啡粉 g', 18], ['ratio', '粉水比 1:', 15]], run: (v) => `注水量 ≈ ${(v.coffee * v.ratio).toFixed(0)} g\n建议水温 90–94°C，总时长 2:00–2:30` },
        { name: '鸡尾酒缩放', fields: [['oz', '单杯某配料 oz', 1.5], ['servings', '杯数', 6]], run: (v) => `${v.servings} 杯需要 ${(v.oz * v.servings).toFixed(1)} oz（约 ${(v.oz * v.servings * 29.57).toFixed(0)} ml）` },
        { name: '腌制盐度', fields: [['water', '水 g', 1000], ['salt', '盐度 %', 5]], run: (v) => `需盐 ${(v.water * v.salt / 100).toFixed(0)} g\n总重 ${(v.water * (1 + v.salt / 100)).toFixed(0)} g` },
        { name: '保质期', fields: [['date', '生产日期', new Date().toISOString().slice(0, 10), 'date'], ['days', '保质天数', 180]], run: (v) => { const d = new Date(v.date); d.setDate(d.getDate() + v.days); return `到期日：${d.toISOString().slice(0, 10)}\n剩余 ${Math.ceil((d - new Date()) / 864e5)} 天`; } }
      ]
    });
  },

  /* ================= 运动健身 ================= */
  'fitness'(root) {
    calcWorkbench(root, {
      title: '运动与健身计算',
      note: '训练负荷与心率区间为估算值，请结合体感与专业教练建议。',
      groups: [
        { name: '配速换算', fields: [['km', '距离 km', 10], ['min', '时间 min', 50]], run: (v) => { const pace = v.min / v.km; return `配速 ${Math.floor(pace)}:${String(Math.round((pace % 1) * 60)).padStart(2, '0')} /km\n速度 ${(v.km / (v.min / 60)).toFixed(2)} km/h`; } },
        { name: '分段配速', fields: [['dist', '总距离 km', 42.195], ['pace', '目标配速 min/km', 5], ['split', '分段 km', 5]], run: (v) => { const out = []; for (let d = v.split; d < v.dist; d += v.split) { const t = d * v.pace; out.push(`${d.toFixed(1)} km  ${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}`); } return out.join('\n') + `\n\n全程预计 ${Math.floor(v.dist * v.pace / 60)}:${String(Math.round(v.dist * v.pace % 60)).padStart(2, '0')}`; } },
        { name: '骑行功率估算', fields: [['kg', '体重 kg', 70], ['speed', '速度 km/h', 30], ['grad', '坡度 %', 0]], run: (v) => { const w = v.kg * 9.8 * (v.speed / 3.6) * (0.008 + v.grad / 100) + 0.5 * 1.225 * 0.4 * (v.speed / 3.6) ** 3; return `估算功率 ≈ ${w.toFixed(0)} W\n功率体重比 ≈ ${(w / v.kg).toFixed(2)} W/kg`; } },
        { name: '功率体重比', fields: [['w', '功率 W', 250], ['kg', '体重 kg', 70]], run: (v) => `${(v.w / v.kg).toFixed(2)} W/kg` },
        { name: '心率区间', fields: [['age', '年龄', 30], ['rest', '静息心率', 60]], run: (v) => { const max = 220 - v.age, res = max - v.rest; return [['Z1 恢复', .5, .6], ['Z2 有氧', .6, .7], ['Z3 节奏', .7, .8], ['Z4 阈值', .8, .9], ['Z5 无氧', .9, 1]].map(([n, a, b]) => `${n}：${Math.round(v.rest + res * a)}–${Math.round(v.rest + res * b)} bpm`).join('\n'); } },
        { name: 'TRIMP 训练负荷', fields: [['hr', '平均心率', 150], ['rest', '静息心率', 60], ['max', '最大心率', 190], ['min', '时长 min', 60], ['sex', '性别', 'm', 'select', [['m', '男'], ['f', '女']]]], run: (v) => { const hrr = (v.hr - v.rest) / (v.max - v.rest); const k = v.sex === 'm' ? 1.92 : 1.67; return `TRIMP ≈ ${(v.min * hrr * 0.64 * Math.exp(k * hrr)).toFixed(0)}`; } },
        { name: '1RM 估算', fields: [['w', '重量 kg', 80], ['r', '次数', 5]], run: (v) => `Epley: ${(v.w * (1 + v.r / 30)).toFixed(1)} kg\nBrzycki: ${(v.w / (1.0278 - 0.0278 * v.r)).toFixed(1)} kg\nLombardi: ${(v.w * v.r ** 0.1).toFixed(1)} kg` },
        { name: '卡路里估算', fields: [['met', 'MET 值', 8], ['kg', '体重 kg', 70], ['min', '时长 min', 45]], run: (v) => `消耗 ≈ ${(v.met * 3.5 * v.kg / 200 * v.min).toFixed(0)} kcal` },
        { name: '泳池配速', fields: [['len', '泳池长度 m', 25], ['laps', '趟数', 40], ['min', '时间 min', 20]], run: (v) => `距离 ${v.len * v.laps / 1000} km\n配速 ${(v.min / (v.len * v.laps / 1000)).toFixed(1)} min/km\n每 100m ${(v.min * 60 / (v.len * v.laps / 100)).toFixed(0)} 秒` }
      ]
    });
  },

  /* ================= 间隔计时器 ================= */
  'interval-timer'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="row">
            <button class="chip active" data-preset="tabata">Tabata 20/10×8</button>
            <button class="chip" data-preset="hiit">HIIT 40/20×10</button>
            <button class="chip" data-preset="emom">EMOM 60s×10</button>
            <button class="chip" data-preset="amrap">AMRAP 10min</button>
          </div>
          <div class="grid4" style="margin-top:10px">
            <div class="field"><label class="lab">运动秒</label><input class="inp" id="it-work" type="number" value="20"></div>
            <div class="field"><label class="lab">休息秒</label><input class="inp" id="it-rest" type="number" value="10"></div>
            <div class="field"><label class="lab">轮数</label><input class="inp" id="it-rounds" type="number" value="8"></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="it-start" style="width:100%">开始</button></div>
          </div>
        </div>
        <div class="panel center" style="padding:28px">
          <div id="it-phase" style="font-size:22px;font-weight:700;color:var(--acc)">准备</div>
          <div id="it-clock" style="font-size:64px;font-weight:800;font-family:var(--mono);color:var(--text);line-height:1.1">00</div>
          <div class="hint" id="it-round">0 / 0</div>
          <div class="progress" style="max-width:420px;margin:14px auto 0;height:8px"><i id="it-bar" style="width:0%"></i></div>
          <button class="btn danger" id="it-stop" style="margin-top:14px">停止</button>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let timer = null, work = 20, rest = 10, rounds = 8, current = 0, phase = 'work', left = 20, running = false;
    const setPreset = (p) => {
      const presets = { tabata: [20, 10, 8], hiit: [40, 20, 10], emom: [60, 0, 10], amrap: [600, 0, 1] };
      const [w, r, n] = presets[p];
      $('#it-work').value = w; $('#it-rest').value = r; $('#it-rounds').value = n;
      reset();
    };
    const reset = () => {
      clearInterval(timer); timer = null; running = false;
      work = Math.max(1, num('it-work')); rest = Math.max(0, num('it-rest')); rounds = Math.max(1, num('it-rounds'));
      current = 1; phase = 'work'; left = work;
      paint();
      $('#it-start').textContent = '开始';
    };
    const paint = () => {
      $('#it-clock').textContent = String(left).padStart(2, '0');
      $('#it-phase').textContent = phase === 'work' ? '运动中' : phase === 'rest' ? '休息' : '完成';
      $('#it-round').textContent = `${current} / ${rounds}`;
      $('#it-bar').style.width = (phase === 'rest' ? 100 - left / (rest || 1) * 100 : left / (work || 1) * 100) + '%';
    };
    const tick = () => {
      left--;
      if (left <= 0) {
        beep(phase === 'work' ? 880 : 520, 180);
        if (phase === 'work') {
          if (rest > 0) { phase = 'rest'; left = rest; }
          else { current++; if (current > rounds) { finish(); return; } left = work; }
        } else {
          current++;
          if (current > rounds) { finish(); return; }
          phase = 'work'; left = work;
        }
      }
      paint();
    };
    const finish = () => {
      clearInterval(timer); timer = null; running = false; phase = 'done'; left = 0;
      $('#it-clock').textContent = '00'; $('#it-phase').textContent = '完成'; $('#it-start').textContent = '重新开始';
      beep(1046, 500);
    };
    $('#it-start').onclick = () => {
      if (running) { clearInterval(timer); timer = null; running = false; $('#it-start').textContent = '继续'; return; }
      if (phase === 'done' || !running) reset();
      running = true; $('#it-start').textContent = '暂停';
      timer = setInterval(tick, 1000);
    };
    $('#it-stop').onclick = reset;
    root.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
      root.querySelectorAll('[data-preset]').forEach((x) => x.classList.toggle('active', x === b));
      setPreset(b.dataset.preset);
    }));
    ['#it-work', '#it-rest', '#it-rounds'].forEach((s) => $(s).addEventListener('change', reset));
    reset();
    ctx.onDestroy(() => clearInterval(timer));
  },

  /* ================= 园艺与宠物 ================= */
  'garden-pet'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="gp-tabs"><button class="tab active" data-i="0">提醒清单</button><button class="tab" data-i="1">计算</button></div>
        <div class="panel" id="gp-p0">
          <div class="grid3">
            <div class="field"><label class="lab">类型</label><select class="sel" id="gp-type"><option value="water">浇水</option><option value="fert">施肥</option><option value="vaccine">宠物疫苗</option><option value="deworm">宠物驱虫</option><option value="repot">换盆</option></select></div>
            <div class="field"><label class="lab">对象</label><input class="inp" id="gp-name" placeholder="绿萝 / 猫咪"></div>
            <div class="field"><label class="lab">每隔天数</label><input class="inp" id="gp-days" type="number" value="7"></div>
          </div>
          <button class="btn primary" id="gp-add" style="margin-top:9px">添加提醒</button>
          <div id="gp-list" class="tool-ui" style="margin-top:12px"></div>
        </div>
        <div class="panel hidden" id="gp-p1">
          <div class="grid3">
            <div class="field"><label class="lab">肥料 N-P-K</label><input class="inp" id="gp-npk" value="10-10-10"></div>
            <div class="field"><label class="lab">稀释倍数</label><input class="inp" id="gp-dilute" type="number" value="1000"></div>
            <div class="field"><label class="lab">水量 L</label><input class="inp" id="gp-water" type="number" value="2"></div>
          </div>
          <button class="btn primary" id="gp-calc" style="margin-top:9px">计算</button>
          <div class="grid3" style="margin-top:9px">
            <div class="field"><label class="lab">堆肥 碳:氮</label><input class="inp" id="gp-ratio" value="30:1"></div>
            <div class="field"><label class="lab">宠物年龄（人类年）</label><input class="inp" id="gp-petage" type="number" value="3"></div>
            <div class="field"><label class="lab">宠物体重 kg</label><input class="inp" id="gp-petkg" type="number" value="5"></div>
          </div>
          <button class="btn" id="gp-calc2" style="margin-top:9px">换算</button>
          <pre class="out" id="gp-out" style="margin-top:9px"></pre>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const load = () => LS.get('kt:gardenpet', []);
    const save = (x) => LS.set('kt:gardenpet', x);
    const paint = () => {
      const list = load();
      const todayD = new Date(today());
      $('#gp-list').innerHTML = list.length ? list.map((x) => {
        const next = new Date(x.last); next.setDate(next.getDate() + x.days);
        const left = Math.ceil((next - todayD) / 864e5);
        return `<div class="panel tight"><div class="row between"><div><b>${esc(x.name)}</b><div class="hint">${x.type === 'water' ? '浇水' : x.type === 'fert' ? '施肥' : x.type === 'vaccine' ? '疫苗' : x.type === 'deworm' ? '驱虫' : '换盆'} · 每 ${x.days} 天 · 下次 ${next.toISOString().slice(0, 10)}</div></div><div class="row"><span class="pill ${left <= 1 ? 'acc' : ''}" style="color:${left <= 1 ? 'var(--warn)' : 'var(--muted)'}">${left <= 0 ? '已到期' : left + ' 天后'}</span><button class="btn sm" data-done="${x.id}">已完成</button><button class="btn sm danger" data-del="${x.id}">删除</button></div></div></div>`;
      }).join('') : '<div class="hint">还没有提醒</div>';
      root.querySelectorAll('[data-done]').forEach((b) => b.addEventListener('click', () => { const l = load(); const it = l.find((x) => x.id === Number(b.dataset.done)); if (it) it.last = today(); save(l); paint(); }));
      root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { save(load().filter((x) => x.id !== Number(b.dataset.del))); paint(); }));
    };
    $('#gp-add').onclick = () => {
      const name = $('#gp-name').value.trim();
      if (!name) return toast('请填写对象名称', 'err');
      const l = load(); l.push({ id: Date.now(), type: $('#gp-type').value, name, days: Math.max(1, num('gp-days')), last: today() }); save(l);
      $('#gp-name').value = ''; paint();
    };
    $('#gp-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#gp-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      $('#gp-p0').classList.toggle('hidden', b.dataset.i !== '0');
      $('#gp-p1').classList.toggle('hidden', b.dataset.i !== '1');
    });
    $('#gp-calc').onclick = () => {
      const [n, p, k] = $('#gp-npk').value.split('-').map(Number);
      const water = num('gp-water');
      const dose = water * 1000 / Math.max(1, num('gp-dilute'));
      $('#gp-out').textContent = `N-P-K = ${n}-${p}-${k}\n按 1:${num('gp-dilute')} 稀释，${water} L 水需肥液约 ${dose.toFixed(1)} g\n其中 N ≈ ${(dose * n / 100).toFixed(2)} g，P₂O₅ ≈ ${(dose * p / 100).toFixed(2)} g，K₂O ≈ ${(dose * k / 100).toFixed(2)} g`;
    };
    $('#gp-calc2').onclick = () => {
      const [c, n] = $('#gp-ratio').value.split(':').map(Number);
      const age = num('gp-petage'), kg = num('gp-petkg');
      $('#gp-out').textContent = `堆肥碳氮比 ${c}:1，每 1 份氮需 ${c} 份碳。\n宠物约 ${age <= 2 ? age * 12 : 24 + (age - 2) * 5} 人类岁\n每日建议饮水约 ${(kg * 50).toFixed(0)} ml，每日建议进食约 ${(kg * 25).toFixed(0)} g（干粮，按体重 2.5%）`;
    };
    paint();
  }
};
