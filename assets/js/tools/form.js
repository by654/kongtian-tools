/* 表单、问卷与考试评分 */
import { esc, copy, toast, download } from '../core/ui.js';
import { calcWorkbench } from '../core/workbench.js';

const $ = (root, s) => root.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 8);

export default {
  /* ================= 表单生成器 ================= */
  'form-builder'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>表单字段</b><span class="hint">添加字段后生成 HTML / JSON / Schema</span></div>
          <div id="fb-fields" class="tool-ui"></div>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="fb-add">添加字段</button><button class="btn" id="fb-run">生成</button><button class="btn" id="fb-copy">复制</button></div>
        </div>
        <div class="panel">
          <div class="panel-head"><b>输出</b><select class="sel" id="fb-mode" style="max-width:150px"><option value="html">HTML</option><option value="json">JSON</option><option value="schema">JSON Schema</option><option value="preview">预览</option></select></div>
          <pre class="out" id="fb-out" style="max-height:420px"></pre>
          <div id="fb-preview" style="margin-top:10px"></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let fields = [
      { id: uid(), type: 'text', label: '姓名', name: 'name', required: true, options: '' },
      { id: uid(), type: 'email', label: '邮箱', name: 'email', required: true, options: '' },
      { id: uid(), type: 'select', label: '部门', name: 'dept', required: false, options: '技术,产品,设计' }
    ];
    const types = [['text', '文本'], ['email', '邮箱'], ['number', '数字'], ['tel', '电话'], ['textarea', '多行文本'], ['select', '下拉'], ['checkbox', '多选'], ['radio', '单选'], ['date', '日期'], ['file', '文件']];
    const paint = () => {
      $('#fb-fields').innerHTML = fields.map((f, i) => `<div class="panel tight"><div class="grid4">
        <div class="field"><label class="lab">类型</label><select class="sel" data-k="type" data-i="${i}">${types.map(([v, n]) => `<option value="${v}" ${f.type === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div class="field"><label class="lab">标签</label><input class="inp" data-k="label" data-i="${i}" value="${esc(f.label)}"></div>
        <div class="field"><label class="lab">字段名</label><input class="inp mono" data-k="name" data-i="${i}" value="${esc(f.name)}"></div>
        <div class="field"><label class="lab">选项 / 必填</label><div class="row"><input class="inp" data-k="options" data-i="${i}" value="${esc(f.options)}" placeholder="下拉/单选选项，逗号分隔" style="flex:1"><label class="row" style="gap:4px"><input type="checkbox" data-k="required" data-i="${i}" ${f.required ? 'checked' : ''}>必填</label><button class="btn sm danger" data-del="${i}">删</button></div></div>
      </div></div>`).join('');
      root.querySelectorAll('[data-k]').forEach((el) => {
        el.addEventListener('input', () => {
          const f = fields[Number(el.dataset.i)];
          if (el.type === 'checkbox') f.required = el.checked; else f[el.dataset.k] = el.value;
        });
      });
      root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { fields.splice(Number(b.dataset.del), 1); paint(); }));
    };
    const buildHtml = () => `<form class="kt-form" novalidate>\n${fields.map((f) => {
      const req = f.required ? ' required aria-required="true"' : '';
      const label = `<label for="${f.name}">${esc(f.label)}${f.required ? ' *' : ''}</label>`;
      if (f.type === 'textarea') return `  <div class="field">${label}<textarea id="${f.name}" name="${f.name}" rows="4"${req}></textarea></div>`;
      if (f.type === 'select' || f.type === 'radio' || f.type === 'checkbox') {
        const opts = f.options.split(',').map((x) => x.trim()).filter(Boolean);
        if (f.type === 'select') return `  <div class="field">${label}<select id="${f.name}" name="${f.name}"${req}>${opts.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select></div>`;
        return `  <fieldset><legend>${esc(f.label)}${f.required ? ' *' : ''}</legend>${opts.map((o, i) => `<label><input type="${f.type}" name="${f.name}" value="${esc(o)}" id="${f.name}-${i}"${req}> ${esc(o)}</label>`).join('')}</fieldset>`;
      }
      return `  <div class="field">${label}<input id="${f.name}" name="${f.name}" type="${f.type}"${req}></div>`;
    }).join('\n')}\n  <button type="submit">提交</button>\n</form>`;
    const buildJson = () => JSON.stringify(fields.map((f) => ({ type: f.type, label: f.label, name: f.name, required: f.required, options: f.options ? f.options.split(',').map((x) => x.trim()) : undefined })), null, 2);
    const buildSchema = () => {
      const props = {}, required = [];
      fields.forEach((f) => {
        props[f.name] = { type: f.type === 'number' ? 'number' : f.type === 'checkbox' ? 'array' : 'string', title: f.label };
        if (f.options) props[f.name].enum = f.options.split(',').map((x) => x.trim());
        if (f.required) required.push(f.name);
      });
      return JSON.stringify({ $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', properties: props, required }, null, 2);
    };
    const run = () => {
      const mode = $('#fb-mode').value;
      if (mode === 'preview') {
        $('#fb-out').textContent = '';
        $('#fb-preview').innerHTML = `<div class="panel">${buildHtml()}</div>`;
      } else {
        $('#fb-preview').innerHTML = '';
        $('#fb-out').textContent = mode === 'html' ? buildHtml() : mode === 'json' ? buildJson() : buildSchema();
      }
    };
    $('#fb-add').onclick = () => { fields.push({ id: uid(), type: 'text', label: '新字段', name: 'field' + (fields.length + 1), required: false, options: '' }); paint(); };
    $('#fb-run').onclick = run;
    $('#fb-mode').addEventListener('change', run);
    $('#fb-copy').onclick = () => copy($('#fb-out').textContent);
    paint(); run();
  },

  /* ================= 问卷生成器 ================= */
  'survey-builder'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>问卷题目</b><span class="hint">生成可离线填写的 HTML 包</span></div>
          <div class="field"><label class="lab">问卷标题</label><input class="inp" id="sv-title" value="空天工具使用体验问卷"></div>
          <div class="field" style="margin-top:8px"><label class="lab">说明</label><input class="inp" id="sv-desc" value="本问卷仅用于产品改进，匿名填写，数据保存在本地。"></div>
          <div id="sv-qs" class="tool-ui" style="margin-top:10px"></div>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="sv-add">添加题目</button><button class="btn" id="sv-run">生成问卷</button><button class="btn" id="sv-qr">问卷二维码</button><button class="btn" id="sv-dl">下载离线包</button><button class="btn" id="sv-copy">复制 HTML</button></div>
        </div>
        <div class="panel"><div class="panel-head"><b>预览</b></div><div id="sv-preview" style="padding:6px"></div><div id="sv-qrbox" style="margin-top:10px"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let qs = [
      { id: uid(), type: 'radio', title: '你最常用的分类是？', options: '文本处理,图片处理,开发工具,生活效率', required: true },
      { id: uid(), type: 'rating', title: '整体满意度（1–5）', options: '', required: false },
      { id: uid(), type: 'text', title: '你最希望新增什么功能？', options: '', required: false }
    ];
    const paint = () => {
      $('#sv-qs').innerHTML = qs.map((q, i) => `<div class="panel tight"><div class="grid3">
        <div class="field"><label class="lab">题型</label><select class="sel" data-qk="type" data-i="${i}"><option value="radio" ${q.type === 'radio' ? 'selected' : ''}>单选</option><option value="checkbox" ${q.type === 'checkbox' ? 'selected' : ''}>多选</option><option value="text" ${q.type === 'text' ? 'selected' : ''}>填空</option><option value="rating" ${q.type === 'rating' ? 'selected' : ''}>评分</option></select></div>
        <div class="field"><label class="lab">题目</label><input class="inp" data-qk="title" data-i="${i}" value="${esc(q.title)}"></div>
        <div class="field"><label class="lab">选项（逗号分隔）</label><div class="row"><input class="inp" data-qk="options" data-i="${i}" value="${esc(q.options)}" style="flex:1"><label class="row" style="gap:4px"><input type="checkbox" data-qk="required" data-i="${i}" ${q.required ? 'checked' : ''}>必填</label><button class="btn sm danger" data-qdel="${i}">删</button></div></div>
      </div></div>`).join('');
      root.querySelectorAll('[data-qk]').forEach((el) => el.addEventListener('input', () => {
        const q = qs[Number(el.dataset.i)];
        if (el.type === 'checkbox') q.required = el.checked; else q[el.dataset.qk] = el.value;
      }));
      root.querySelectorAll('[data-qdel]').forEach((b) => b.addEventListener('click', () => { qs.splice(Number(b.dataset.qdel), 1); paint(); }));
    };
    const build = () => {
      const title = $('#sv-title').value, desc = $('#sv-desc').value;
      const body = qs.map((q, i) => {
        const req = q.required ? ' required' : '';
        if (q.type === 'text') return `<div class="q"><label>${i + 1}. ${esc(q.title)}${q.required ? ' *' : ''}</label><textarea name="q${i}"${req}></textarea></div>`;
        if (q.type === 'rating') return `<div class="q"><label>${i + 1}. ${esc(q.title)}</label><div class="rate">${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="q${i}" value="${n}"${req}> ${n}</label>`).join('')}</div></div>`;
        return `<div class="q"><label>${i + 1}. ${esc(q.title)}${q.required ? ' *' : ''}</label>${q.options.split(',').map((o) => o.trim()).filter(Boolean).map((o) => `<label class="opt"><input type="${q.type}" name="q${i}${q.type === 'checkbox' ? '[]' : ''}" value="${esc(o)}"${req}> ${esc(o)}</label>`).join('')}</div>`;
      }).join('');
      return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>
body{font-family:-apple-system,"PingFang SC",sans-serif;background:#f4f7fc;color:#111;max-width:720px;margin:0 auto;padding:24px}
h1{font-size:24px;margin:0 0 6px}.desc{color:#666;font-size:13px;margin-bottom:18px}
.q{background:#fff;border:1px solid #e5e9f2;border-radius:10px;padding:14px;margin-bottom:12px}
.q>label{font-weight:600;display:block;margin-bottom:8px}
input[type=text],input[type=email],textarea,select{width:100%;padding:8px 10px;border:1px solid #d8dee9;border-radius:7px;font:inherit;box-sizing:border-box}
textarea{min-height:90px}.opt,.rate label{display:inline-flex;gap:6px;margin:4px 14px 4px 0;font-weight:400}
button{background:#0ea5e9;color:#fff;border:0;padding:10px 22px;border-radius:8px;font-size:15px;cursor:pointer}
#out{margin-top:14px;white-space:pre-wrap;background:#0f172a;color:#e2e8f0;padding:14px;border-radius:8px;display:none;font-size:12px}
</style></head><body>
<h1>${esc(title)}</h1><div class="desc">${esc(desc)}</div>
<form id="s">${body}<button type="submit">提交</button></form>
<pre id="out"></pre>
<script>
const form=document.getElementById('s');
form.addEventListener('submit',e=>{e.preventDefault();
const data={};
new FormData(form).forEach((v,k)=>{if(k.endsWith('[]')){const key=k.slice(0,-2);(data[key]=data[key]||[]).push(v)}else data[k]=v});
const json=JSON.stringify(data,null,2);
localStorage.setItem('kt-survey-${Date.now()}',json);
document.getElementById('out').style.display='block';document.getElementById('out').textContent=json;
const blob=new Blob([json],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='survey-response.json';a.click();
});
const draft=localStorage.getItem('kt-survey-draft');
if(draft){try{const d=JSON.parse(draft);for(const k in d){const els=form.querySelectorAll('[name="'+k+'"]');if(els.length){if(els[0].type==='radio'||els[0].type==='checkbox'){els.forEach(el=>{if([].concat(d[k]).includes(el.value))el.checked=true})}else els[0].value=d[k]}}}catch(e){}}
form.addEventListener('input',()=>{const d={};new FormData(form).forEach((v,k)=>{d[k]=v});localStorage.setItem('kt-survey-draft',JSON.stringify(d))});
<\/script></body></html>`;
    };
    const run = () => { $('#sv-preview').innerHTML = `<iframe srcdoc="${esc(build())}" style="width:100%;height:420px;border:1px solid var(--line);border-radius:9px;background:#fff"></iframe>`; };
    $('#sv-add').onclick = () => { qs.push({ id: uid(), type: 'radio', title: '新题目', options: '选项 A,选项 B', required: false }); paint(); };
    $('#sv-run').onclick = run;
    $('#sv-dl').onclick = () => download('survey.html', build(), 'text/html');
    $('#sv-copy').onclick = () => copy(build());
    $('#sv-qr').onclick = async () => {
      try {
        await ctx.deps(['qrcode']);
        const html = build();
        const url = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
        const qr = window.qrcode(0, 'L'); qr.addData(url.slice(0, 900)); qr.make();
        const n = qr.getModuleCount(), cell = 4, size = n * cell + 16;
        const cv = document.createElement('canvas'); cv.width = cv.height = size;
        const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, size, size); g.fillStyle = '#000';
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) g.fillRect(8 + c * cell, 8 + r * cell, cell, cell);
        $('#sv-qrbox').innerHTML = ''; cv.style.width = '180px'; $('#sv-qrbox').appendChild(cv);
      } catch (e) { toast(e.message, 'err'); }
    };
    paint(); run();
  },

  /* ================= 问卷统计 ================= */
  'survey-stats'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>问卷结果统计</b><span class="hint">粘贴 CSV 或导出的 JSON 数组</span></div>
          <textarea class="ta mono" id="ss-in" rows="8" placeholder="问题,选项A,选项B&#10;Q1,A,B&#10;Q1,A,A&#10;Q2,B,B"></textarea>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="ss-run">统计</button><button class="btn" id="ss-csv">导出汇总 CSV</button></div>
        </div>
        <div id="ss-out" class="tool-ui"></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let summary = [];
    $('#ss-run').onclick = () => {
      const text = $('#ss-in').value.trim();
      let rows = [];
      try {
        if (text.startsWith('[')) {
          const arr = JSON.parse(text);
          const keys = Object.keys(arr[0] || {});
          rows = [keys, ...arr.map((o) => keys.map((k) => o[k]))];
        } else rows = text.split(/\r?\n/).filter(Boolean).map((l) => l.split(','));
      } catch (e) { toast('JSON 解析失败', 'err'); return; }
      if (rows.length < 2) return toast('数据不足', 'err');
      const head = rows[0], data = rows.slice(1);
      summary = [];
      $('#ss-out').innerHTML = head.map((h, ci) => {
        if (ci === 0) return '';
        const freq = new Map();
        data.forEach((r) => { const v = (r[ci] || '').trim(); if (v) freq.set(v, (freq.get(v) || 0) + 1); });
        const total = [...freq.values()].reduce((a, b) => a + b, 0) || 1;
        const entries = [...freq.entries()].sort((a, b) => b[1] - a[1]);
        summary.push([h, ...entries.map(([k, v]) => `${k}: ${v}`)]);
        return `<div class="panel"><div class="panel-head"><b>${esc(h)}</b><span class="hint">${total} 份</span></div>${entries.map(([k, v]) => `<div class="row" style="margin-bottom:6px"><span style="min-width:90px">${esc(k)}</span><div class="progress" style="flex:1"><i style="width:${v / total * 100}%"></i></div><span class="hint" style="min-width:64px;text-align:right">${v} · ${(v / total * 100).toFixed(1)}%</span></div>`).join('')}</div>`;
      }).join('');
    };
    $('#ss-csv').onclick = () => {
      if (!summary.length) return toast('先统计', 'err');
      download('survey-summary.csv', '\ufeff' + summary.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
    };
  },

  /* ================= 考试与评分 ================= */
  'exam-tool'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="et-tabs"><button class="tab active" data-i="0">组卷</button><button class="tab" data-i="1">评分</button><button class="tab" data-i="2">统计</button></div>
        <div class="panel" id="et-p0">
          <div class="panel-head"><b>题库</b><span class="hint">每行：题干|A|B|C|D|答案|难度|知识点</span></div>
          <textarea class="ta mono" id="et-bank" rows="6">下列哪个是浏览器本地存储？|localStorage|MySQL|Redis|MongoDB|A|1|Web
HTTP 状态码 404 表示？|成功|未找到|服务器错误|重定向|B|1|HTTP
1KB 等于多少字节？|1000|1024|512|2048|B|2|基础</textarea>
          <div class="grid3" style="margin-top:9px">
            <div class="field"><label class="lab">题目数量</label><input class="inp" id="et-count" type="number" value="2"></div>
            <div class="field"><label class="lab">难度</label><select class="sel" id="et-diff"><option value="0">不限</option><option value="1">简单</option><option value="2">中等</option><option value="3">困难</option></select></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="et-gen" style="width:100%">随机组卷</button></div>
          </div>
          <pre class="out" id="et-paper" style="margin-top:9px"></pre>
        </div>
        <div class="panel hidden" id="et-p1">
          <div class="field"><label class="lab">答案（按题号，例如 1A 2B 3C）</label><input class="inp mono" id="et-key" placeholder="1A 2B 3C"></div>
          <div class="field" style="margin-top:8px"><label class="lab">学生作答</label><input class="inp mono" id="et-ans" placeholder="1A 2C 3B"></div>
          <div class="row" style="margin-top:9px"><button class="btn primary" id="et-grade">评分</button><span class="hint" id="et-result"></span></div>
        </div>
        <div class="panel hidden" id="et-p2">
          <div class="field"><label class="lab">成绩（每行一个分数）</label><textarea class="ta mono" id="et-scores" rows="6">85
92
78
66
95
58</textarea></div>
          <div class="row" style="margin-top:9px"><button class="btn primary" id="et-stats">统计</button></div>
          <div class="stat-grid" id="et-stats-out" style="margin-top:11px"></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#et-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#et-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      [0, 1, 2].forEach((i) => $('#et-p' + i).classList.toggle('hidden', String(i) !== b.dataset.i));
    });
    const parseBank = () => $('#et-bank').value.split(/\r?\n/).filter((l) => l.includes('|')).map((l) => {
      const [q, a, b, c, d, ans, diff, point] = l.split('|').map((x) => x.trim());
      return { q, opts: [a, b, c, d], ans: (ans || '').toUpperCase(), diff: Number(diff) || 1, point: point || '' };
    });
    $('#et-gen').onclick = () => {
      let bank = parseBank();
      const diff = Number($('#et-diff').value);
      if (diff) bank = bank.filter((x) => x.diff === diff);
      const n = Math.max(1, Math.min(bank.length, Number($('#et-count').value) || 5));
      const picked = [...bank].sort(() => Math.random() - 0.5).slice(0, n);
      $('#et-paper').textContent = `# 随机试卷\n\n` + picked.map((x, i) => `${i + 1}. ${x.q}\nA. ${x.opts[0]}  B. ${x.opts[1]}  C. ${x.opts[2]}  D. ${x.opts[3]}\n`).join('\n') + `\n\n## 答案\n${picked.map((x, i) => `${i + 1}. ${x.ans}`).join('  ')}`;
    };
    $('#et-grade').onclick = () => {
      const key = Object.fromEntries($('#et-key').value.split(/\s+/).filter(Boolean).map((x) => [x.replace(/[A-Da-d]/g, ''), x.slice(-1).toUpperCase()]));
      const ans = Object.fromEntries($('#et-ans').value.split(/\s+/).filter(Boolean).map((x) => [x.replace(/[A-Da-d]/g, ''), x.slice(-1).toUpperCase()]));
      let correct = 0, total = 0;
      for (const k of Object.keys(key)) { total++; if (key[k] === ans[k]) correct++; }
      const score = total ? Math.round(correct / total * 100) : 0;
      $('#et-result').innerHTML = `正确 ${correct}/${total} · 得分 <b style="color:${score >= 60 ? 'var(--ok)' : 'var(--err)'}">${score}</b>`;
    };
    $('#et-stats').onclick = () => {
      const scores = $('#et-scores').value.split(/\r?\n/).map(Number).filter((x) => !isNaN(x)).sort((a, b) => a - b);
      if (!scores.length) return toast('请输入成绩', 'err');
      const n = scores.length, sum = scores.reduce((a, b) => a + b, 0), mean = sum / n;
      const median = n % 2 ? scores[(n - 1) / 2] : (scores[n / 2 - 1] + scores[n / 2]) / 2;
      const std = Math.sqrt(scores.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
      const pass = scores.filter((x) => x >= 60).length;
      $('#et-stats-out').innerHTML = [['平均分', mean.toFixed(1)], ['中位数', median], ['标准差', std.toFixed(1)], ['及格率', (pass / n * 100).toFixed(1) + '%'], ['最高', scores[n - 1]], ['最低', scores[0]], ['人数', n]]
        .map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
      const bands = [[90, 100], [80, 89], [70, 79], [60, 69], [0, 59]];
      $('#et-stats-out').insertAdjacentHTML('afterend', `<div class="panel" style="margin-top:10px"><div class="panel-head"><b>分数段</b></div>${bands.map(([a, b]) => {
        const c = scores.filter((x) => x >= a && x <= b).length;
        return `<div class="row" style="margin-bottom:6px"><span style="min-width:70px">${a}–${b}</span><div class="progress" style="flex:1"><i style="width:${c / n * 100}%"></i></div><span class="hint">${c} 人</span></div>`;
      }).join('')}</div>`);
    };
    $('#et-gen').click();
  }
};
