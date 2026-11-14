/* 出行、汽车、法律、职业与内容 */
import { esc, copy, toast, download } from '../core/ui.js';
import { calcWorkbench, templateWorkbench } from '../core/workbench.js';

const $ = (root, s) => root.querySelector(s);

export default {
  /* ================= 旅行与户外 ================= */
  'travel-tools'(root) {
    calcWorkbench(root, {
      title: '旅行与户外计算',
      groups: [
        { name: '旅行预算', fields: [['transport', '交通', 2000], ['hotel', '住宿/晚', 400], ['nights', '晚数', 5], ['food', '餐饮/天', 150], ['days', '天数', 6], ['tickets', '门票', 500], ['other', '其他', 300]], run: (v) => `交通：${v.transport}\n住宿：${v.hotel * v.nights}\n餐饮：${v.food * v.days}\n门票：${v.tickets}\n其他：${v.other}\n合计：${v.transport + v.hotel * v.nights + v.food * v.days + v.tickets + v.other} 元\n人均（2 人）：${((v.transport + v.hotel * v.nights + v.food * v.days + v.tickets + v.other) / 2).toFixed(0)} 元` },
        { name: '徒步时间', fields: [['km', '距离 km', 10], ['gain', '爬升 m', 500], ['speed', '平地速度 km/h', 4.5]], run: (v) => `平地时间：${(v.km / v.speed).toFixed(1)} h\n爬升附加：${(v.gain / 600).toFixed(2)} h\n预计总时长：${(v.km / v.speed + v.gain / 600).toFixed(1)} h（Naismith 规则）` },
        { name: '行李重量', fields: [['items', '物品（每行：名称,kg）', '背包,1.2\n衣物,2\n相机,0.8\n水,1.5', 'textarea'], ['limit', '限重 kg', 10]], run: (v) => { const items = v.items.split(/\r?\n/).filter(Boolean).map((l) => { const [n, k] = l.split(','); return [n, Number(k)]; }); const total = items.reduce((s, [, k]) => s + k, 0); return items.map(([n, k]) => `${n}: ${k} kg`).join('\n') + `\n合计：${total.toFixed(2)} kg / 限重 ${v.limit} kg（${(total / v.limit * 100).toFixed(0)}%）`; } },
        { name: '汇率换算', fields: [['amount', '金额', 1000], ['rate', '汇率', 7.2]], run: (v) => `${v.amount} × ${v.rate} = ${(v.amount * v.rate).toFixed(2)}\n反向：${(v.amount / v.rate).toFixed(2)}` },
        { name: '费用分摊', fields: [['total', '总费用', 3600], ['people', '人数', 4]], run: (v) => `每人：${(v.total / Math.max(1, v.people)).toFixed(2)} 元` },
        { name: '时区换算', fields: [['time', '当地时间', '10:00', 'time'], ['from', '出发 UTC', 8], ['to', '目的地 UTC', 1]], run: (v) => { const [h, m] = v.time.split(':').map(Number); const t = (h + (v.to - v.from) + 24) % 24; return `目的地时间：${String(t).padStart(2, '0')}:${String(m).padStart(2, '0')}`; } }
      ]
    });
  },

  /* ================= 汽车与交通 ================= */
  'auto-tools'(root) {
    calcWorkbench(root, {
      title: '汽车与交通计算',
      groups: [
        { name: '油耗与费用', fields: [['km', '里程 km', 500], ['cons', '百公里油耗 L', 7.5], ['price', '油价 元/L', 7.8]], run: (v) => `耗油：${(v.km / 100 * v.cons).toFixed(2)} L\n油费：${(v.km / 100 * v.cons * v.price).toFixed(2)} 元\n每公里：${(v.cons * v.price / 100).toFixed(3)} 元` },
        { name: '每公里综合成本', fields: [['price', '购车价', 150000], ['residual', '残值', 60000], ['years', '使用年数', 5], ['km', '年里程 km', 15000], ['fuel', '年油费', 9000], ['ins', '年保险', 5000], ['maint', '年保养', 2000]], run: (v) => { const total = (v.price - v.residual) + (v.fuel + v.ins + v.maint) * v.years; const km = v.km * v.years; return `总成本：${total.toFixed(0)} 元\n总里程：${km} km\n每公里：${(total / km).toFixed(2)} 元`; } },
        { name: '电动车续航', fields: [['kwh', '电池容量 kWh', 60], ['cons', '电耗 kWh/100km', 15], ['reserve', '保留电量 %', 10]], run: (v) => `可用续航：${(v.kwh * (1 - v.reserve / 100) / v.cons * 100).toFixed(0)} km\n每 10% 电量约 ${(v.kwh * 0.1 / v.cons * 100).toFixed(0)} km` },
        { name: '充电费用', fields: [['kwh', '充电量 kWh', 40], ['price', '电价 元/kWh', 0.8], ['loss', '损耗 %', 10]], run: (v) => `电费：${(v.kwh * (1 + v.loss / 100) * v.price).toFixed(2)} 元` },
        { name: '轮胎尺寸', fields: [['w', '胎宽 mm', 225], ['aspect', '扁平比 %', 45], ['rim', '轮毂英寸', 18]], run: (v) => `轮胎直径 ≈ ${(v.rim * 25.4 + v.w * v.aspect / 100 * 2).toFixed(1)} mm\n（${(v.rim * 25.4 + v.w * v.aspect / 100 * 2).toFixed(1)} mm / 25.4 = ${((v.rim * 25.4 + v.w * v.aspect / 100 * 2) / 25.4).toFixed(1)} 英寸）` },
        { name: '保养周期', fields: [['date', '上次保养', new Date().toISOString().slice(0, 10), 'date'], ['km', '上次里程', 30000], ['months', '间隔月', 6], ['kmInt', '间隔 km', 5000]], run: (v) => { const d = new Date(v.date); d.setMonth(d.getMonth() + v.months); return `下次保养：${d.toISOString().slice(0, 10)} 或 ${v.km + v.kmInt} km（以先到为准）`; } },
        { name: 'VIN 校验', fields: [['vin', '车架号', 'LSVAM4187C2123456', 'text']], run: (v) => {
          const s = v.vin.toUpperCase();
          if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(s)) return 'VIN 必须为 17 位且不含 I/O/Q';
          const map = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9, S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9 };
          const w = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
          let sum = 0;
          for (let i = 0; i < 17; i++) sum += (/[A-Z]/.test(s[i]) ? map[s[i]] : +s[i]) * w[i];
          const chk = sum % 11 === 10 ? 'X' : String(sum % 11);
          return `校验位：${s[8]} · 计算结果：${chk}\n${s[8] === chk ? 'VIN 校验通过' : 'VIN 校验失败'}`;
        } },
        { name: '车牌格式', fields: [['plate', '车牌', '京A12345', 'text']], run: (v) => /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领][A-Z][A-Z0-9]{5,6}$/.test(v.plate.toUpperCase()) ? '车牌格式有效' : '车牌格式可能无效（仅做本地规则校验）' }
      ]
    });
  },

  /* ================= 法律与合同 ================= */
  'law-tools'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="law-tabs"><button class="tab active" data-i="0">条款提取</button><button class="tab" data-i="1">模板</button></div>
        <div class="panel" id="law-p0">
          <textarea class="ta" id="law-in" rows="9" placeholder="粘贴合同文本…">甲方：空天科技有限公司\n乙方：示例客户\n合同金额：人民币 120,000 元\n签订日期：2026 年 11 月 14 日\n付款期限：2026-12-31\n违约金：未按期付款的，按日万分之五支付违约金。</textarea>
          <div class="row" style="margin-top:9px"><button class="btn primary" id="law-run">提取</button><button class="btn" id="law-copy">复制</button></div>
          <div id="law-out" class="tool-ui" style="margin-top:10px"></div>
        </div>
        <div class="panel hidden" id="law-p1"><div id="law-tpl"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#law-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#law-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      [0, 1].forEach((i) => $('#law-p' + i).classList.toggle('hidden', String(i) !== b.dataset.i));
    });
    $('#law-run').onclick = () => {
      const t = $('#law-in').value;
      const dates = [...new Set(t.match(/\d{4}\s*[-年/]\s*\d{1,2}\s*[-月/]\s*\d{1,2}\s*日?/g) || [])];
      const amounts = [...new Set(t.match(/(?:人民币|¥|￥)?\s*\d[\d,]*(?:\.\d{1,2})?\s*(?:元|万元)/g) || [])];
      const parties = [...new Set([...t.matchAll(/(甲方|乙方|丙方)[：:]\s*([^\n]+)/g)].map((m) => `${m[1]}：${m[2].trim()}`))];
      const riskWords = ['违约金', '单方解除', '无限责任', '免责', '自动续约', '排他', '保密', '赔偿', '不可抗力', '争议解决'];
      const risks = riskWords.filter((w) => t.includes(w));
      $('#law-out').innerHTML = `<div class="panel tight"><div class="panel-head"><b>关键日期</b></div><div class="row">${dates.map((d) => `<span class="chip">${esc(d)}</span>`).join('') || '<span class="hint">未找到</span>'}</div></div>
        <div class="panel tight"><div class="panel-head"><b>金额</b></div><div class="row">${amounts.map((d) => `<span class="chip">${esc(d)}</span>`).join('') || '<span class="hint">未找到</span>'}</div></div>
        <div class="panel tight"><div class="panel-head"><b>合同主体</b></div><div class="hint">${parties.map(esc).join('<br>') || '未找到'}</div></div>
        <div class="panel tight"><div class="panel-head"><b>风险词</b></div><div class="row">${risks.map((r) => `<span class="chip" style="color:var(--warn)">${r}</span>`).join('') || '<span class="hint">未发现常见风险词</span>'}</div></div>
        <div class="warnbox">仅为文本规则提取，不构成法律意见。正式签约前请由专业律师审核。</div>`;
    };
    $('#law-copy').onclick = () => copy($('#law-out').innerText);
    templateWorkbench($('#law-tpl'), {
      title: '合同与法律文书模板',
      note: '模板仅供参考，不构成法律意见。',
      templates: [
        { id: 'nda', name: '保密协议 NDA', build: (v) => `# 保密协议\n\n甲方：__________\n乙方：${v.owner || '__________'}\n签订日期：${v.date}\n\n## 1. 保密信息\n${v.notes.split('\n').filter(Boolean).map((x) => '- ' + x).join('\n')}\n\n## 2. 保密义务\n未经书面同意，不得向第三方披露、复制或用于本协议目的之外的用途。\n\n## 3. 期限\n自签订之日起 ____ 年。\n\n## 4. 违约责任\n违反本协议造成损失的，应承担赔偿责任。\n\n甲方：__________　乙方：__________` },
        { id: 'auth', name: '授权书', build: (v) => `# 授权书\n\n授权人：__________\n被授权人：${v.owner || '__________'}\n日期：${v.date}\n\n本人兹授权 ${v.owner || '__________'} 代表本人办理以下事项：\n${v.notes.split('\n').filter(Boolean).map((x) => '- ' + x).join('\n')}\n\n授权期限：自签署之日起至 ____ 年 ____ 月 ____ 日。\n\n授权人签名：__________` },
        { id: 'entrust', name: '委托书', build: (v) => `# 委托书\n\n委托人：__________\n受托人：${v.owner || '__________'}\n日期：${v.date}\n\n现委托受托人处理以下事务：\n${v.notes.split('\n').filter(Boolean).map((x) => '- ' + x).join('\n')}\n\n委托权限：____________________\n委托期限：____________________\n\n委托人签名：__________` },
        { id: 'statement', name: '声明书', build: (v) => `# 声明书\n\n声明人：${v.owner || '__________'}\n日期：${v.date}\n\n本人郑重声明：\n${v.notes.split('\n').filter(Boolean).map((x) => '1. ' + x).join('\n')}\n\n以上内容真实有效，如有虚假，本人愿承担相应责任。\n\n声明人签名：__________` }
      ]
    });
    $('#law-run').click();
  },

  /* ================= 求职与职业 ================= */
  'career-tools'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="car-tabs"><button class="tab active" data-i="0">ATS 检查</button><button class="tab" data-i="1">面试 STAR</button><button class="tab" data-i="2">薪资与 Offer</button></div>
        <div class="panel" id="car-p0">
          <div class="grid2"><textarea class="ta" id="car-resume" rows="8" placeholder="粘贴简历文本…"></textarea><textarea class="ta" id="car-jd" rows="8" placeholder="粘贴岗位 JD…"></textarea></div>
          <div class="row" style="margin-top:9px"><button class="btn primary" id="car-check">检查匹配度</button><span class="hint" id="car-meta"></span></div>
          <div id="car-out" class="tool-ui" style="margin-top:10px"></div>
        </div>
        <div class="panel hidden" id="car-p1">
          <div class="grid3"><div class="field"><label class="lab">情境 S</label><input class="inp" id="car-s" placeholder="在什么背景下"></div><div class="field"><label class="lab">任务 T</label><input class="inp" id="car-t" placeholder="你的任务"></div><div class="field"><label class="lab">行动 A</label><input class="inp" id="car-a" placeholder="你做了什么"></div></div>
          <div class="field" style="margin-top:8px"><label class="lab">结果 R</label><input class="inp" id="car-r" placeholder="量化结果"></div>
          <button class="btn primary" id="car-star" style="margin-top:9px">生成 STAR 回答</button>
          <pre class="out" id="car-star-out" style="margin-top:9px"></pre>
        </div>
        <div class="panel hidden" id="car-p2">
          <div class="grid3"><div class="field"><label class="lab">当前薪资</label><input class="inp" id="car-cur" type="number" value="15000"></div><div class="field"><label class="lab">Offer 薪资</label><input class="inp" id="car-offer" type="number" value="20000"></div><div class="field"><label class="lab">目标涨幅 %</label><input class="inp" id="car-pct" type="number" value="20"></div></div>
          <button class="btn primary" id="car-salary" style="margin-top:9px">计算</button>
          <div class="stat-grid" id="car-salary-out" style="margin-top:10px"></div>
          <div class="field" style="margin-top:10px"><label class="lab">Offer 对比（每行：公司,月薪,年终月数,股票/年,通勤分钟）</label><textarea class="ta mono" id="car-offers" rows="3">A 公司,20000,3,0,40
B 公司,18000,4,20000,20</textarea></div>
          <button class="btn" id="car-compare" style="margin-top:8px">生成对比表</button>
          <pre class="out" id="car-compare-out" style="margin-top:9px"></pre>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#car-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#car-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      [0, 1, 2].forEach((i) => $('#car-p' + i).classList.toggle('hidden', String(i) !== b.dataset.i));
    });
    $('#car-check').onclick = () => {
      const resume = $('#car-resume').value.toLowerCase(), jd = $('#car-jd').value.toLowerCase();
      const tokens = [...new Set(jd.match(/[\u4e00-\u9fa5]{2,}|[a-z][a-z0-9+#.-]{1,}/g) || [])].filter((w) => w.length > 1).slice(0, 60);
      const hit = tokens.filter((w) => resume.includes(w));
      const missing = tokens.filter((w) => !resume.includes(w));
      const score = tokens.length ? Math.round(hit.length / tokens.length * 100) : 0;
      const issues = [];
      if (!/[\w.+-]+@[\w.-]+\.\w+/.test(resume)) issues.push('未检测到邮箱');
      if (!/1[3-9]\d{9}/.test(resume)) issues.push('未检测到手机号');
      if (resume.length < 300) issues.push('简历内容偏短');
      if (!/(工作经历|experience)/.test(resume)) issues.push('缺少工作经历标题');
      if (!/(教育|education)/.test(resume)) issues.push('缺少教育经历标题');
      $('#car-meta').textContent = `关键词命中 ${hit.length}/${tokens.length}`;
      $('#car-out').innerHTML = `<div class="stat-grid"><div class="stat"><b>${score}%</b><span>匹配度</span></div><div class="stat"><b>${hit.length}</b><span>命中</span></div><div class="stat"><b>${missing.length}</b><span>缺失</span></div></div>
        <div class="panel tight"><div class="panel-head"><b>缺失关键词</b></div><div class="row">${missing.slice(0, 20).map((w) => `<span class="chip">${esc(w)}</span>`).join('') || '<span class="hint">无</span>'}</div></div>
        <div class="panel tight"><div class="panel-head"><b>格式检查</b></div>${issues.length ? issues.map((x) => `<div class="warnbox" style="margin-bottom:5px">${esc(x)}</div>`).join('') : '<div class="okbox">基础格式正常</div>'}</div>`;
    };
    $('#car-star').onclick = () => {
      $('#car-star-out').textContent = `在${$('#car-s').value || '（情境）'}的背景下，我负责${$('#car-t').value || '（任务）'}。\n\n我采取的行动是：${$('#car-a').value || '（行动）'}。\n\n最终结果是：${$('#car-r').value || '（量化结果）'}。`;
    };
    $('#car-salary').onclick = () => {
      const cur = Number($('#car-cur').value), offer = Number($('#car-offer').value), pct = Number($('#car-pct').value);
      $('#car-salary-out').innerHTML = [['涨幅', ((offer / cur - 1) * 100).toFixed(1) + '%'], ['月差额', (offer - cur).toFixed(0)], ['目标薪资', (cur * (1 + pct / 100)).toFixed(0)], ['年差额（12 月）', ((offer - cur) * 12).toFixed(0)]].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
    };
    $('#car-compare').onclick = () => {
      const rows = $('#car-offers').value.split(/\r?\n/).filter(Boolean).map((l) => l.split(','));
      $('#car-compare-out').textContent = `| 公司 | 月薪 | 年终 | 股票/年 | 年包估算 | 通勤 |\n| --- | --- | --- | --- | --- | --- |\n${rows.map(([n, m, bonus, stock, commute]) => `| ${n} | ${m} | ${bonus} 个月 | ${stock} | ${(Number(m) * (12 + Number(bonus)) + Number(stock)).toFixed(0)} | ${commute} 分钟 |`).join('\n')}`;
    };
  },

  /* ================= 内容与社媒 ================= */
  'content-tools'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="ct-tabs"><button class="tab active" data-i="0">内容日历</button><button class="tab" data-i="1">平台字数</button><button class="tab" data-i="2">Front Matter</button><button class="tab" data-i="3">RSS / Slug</button></div>
        <div class="panel" id="ct-p0">
          <div class="grid3"><div class="field"><label class="lab">开始日期</label><input class="inp" id="ct-start" type="date"></div><div class="field"><label class="lab">天数</label><input class="inp" id="ct-days" type="number" value="14"></div><div class="field"><label class="lab">主题（每行一个）</label><input class="inp" id="ct-topics" value="工具介绍,使用技巧,更新日志,用户案例"></div></div>
          <button class="btn primary" id="ct-run" style="margin-top:9px">生成日历</button>
          <pre class="out" id="ct-out" style="margin-top:9px"></pre>
        </div>
        <div class="panel hidden" id="ct-p1">
          <textarea class="ta" id="ct-text" rows="5">空天工具合集是一个纯前端工具箱，所有文件在本地处理，不上传服务器。</textarea>
          <div class="stat-grid" id="ct-count" style="margin-top:10px"></div>
        </div>
        <div class="panel hidden" id="ct-p2">
          <div class="grid3"><div class="field"><label class="lab">标题</label><input class="inp" id="ct-title" value="空天工具合集"></div><div class="field"><label class="lab">标签（逗号分隔）</label><input class="inp" id="ct-tags" value="工具,浏览器,效率"></div><div class="field"><label class="lab">作者</label><input class="inp" id="ct-author" value="kongtian"></div></div>
          <button class="btn primary" id="ct-fm" style="margin-top:9px">生成</button>
          <pre class="out" id="ct-fm-out" style="margin-top:9px"></pre>
        </div>
        <div class="panel hidden" id="ct-p3">
          <div class="field"><label class="lab">标题列表（每行一个）</label><textarea class="ta" id="ct-slugs" rows="4">空天工具合集：浏览器里的万能工具箱
JSON 工作台使用指南</textarea></div>
          <div class="row" style="margin-top:8px"><input class="inp" id="ct-site" value="https://example.com" style="flex:1"><button class="btn primary" id="ct-rss">生成 RSS</button><button class="btn" id="ct-slug">生成 Slug</button></div>
          <pre class="out" id="ct-rss-out" style="margin-top:9px"></pre>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#ct-start').value = new Date().toISOString().slice(0, 10);
    $('#ct-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#ct-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      [0, 1, 2, 3].forEach((i) => $('#ct-p' + i).classList.toggle('hidden', String(i) !== b.dataset.i));
    });
    $('#ct-run').onclick = () => {
      const start = new Date($('#ct-start').value), days = Math.max(1, Number($('#ct-days').value)), topics = $('#ct-topics').value.split(',').map((x) => x.trim()).filter(Boolean);
      $('#ct-out').textContent = `| 日期 | 星期 | 主题 |\n| --- | --- | --- |\n${Array.from({ length: days }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return `| ${d.toISOString().slice(0, 10)} | 周${['日', '一', '二', '三', '四', '五', '六'][d.getDay()]} | ${topics[i % topics.length] || ''} |`; }).join('\n')}`;
    };
    const count = () => {
      const t = $('#ct-text').value;
      const limits = [['X / Twitter', 280], ['微博', 2000], ['小红书', 1000], ['抖音', 2200], ['LinkedIn', 3000], ['微信公众号', 2000]];
      $('#ct-count').innerHTML = limits.map(([n, l]) => `<div class="stat"><b style="color:${[...t].length > l ? 'var(--err)' : 'var(--ok)'}">${[...t].length} / ${l}</b><span>${n}</span></div>`).join('');
    };
    $('#ct-text').addEventListener('input', count);
    count();
    $('#ct-fm').onclick = () => {
      $('#ct-fm-out').textContent = `---\ntitle: "${$('#ct-title').value}"\ndate: ${new Date().toISOString().slice(0, 10)}\nauthor: "${$('#ct-author').value}"\ntags: [${$('#ct-tags').value.split(',').map((x) => `"${x.trim()}"`).join(', ')}]\ndraft: false\n---`;
    };
    $('#ct-rss').onclick = () => {
      const titles = $('#ct-slugs').value.split(/\r?\n/).filter(Boolean);
      const site = $('#ct-site').value;
      $('#ct-rss-out').textContent = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>空天工具合集</title><link>${esc(site)}</link><description>纯前端工具箱</description>${titles.map((t) => `<item><title>${esc(t)}</title><link>${esc(site)}/post/${encodeURIComponent(t)}</link></item>`).join('')}</channel></rss>`;
    };
    $('#ct-slug').onclick = () => {
      $('#ct-rss-out').textContent = $('#ct-slugs').value.split(/\r?\n/).filter(Boolean).map((t) => t.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '')).join('\n');
    };
  }
};
