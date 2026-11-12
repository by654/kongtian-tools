/* 办公、写作与模板 */
import { esc, copy, toast, download } from '../core/ui.js';

const $ = (root, s) => root.querySelector(s);
const today = () => new Date().toISOString().slice(0, 10);

function printHtml(html, title = '打印') {
  const w = window.open('', '_blank');
  if (!w) return toast('浏览器阻止了弹窗，请允许后重试', 'err');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#111;max-width:800px;margin:36px auto;padding:0 24px;line-height:1.7}
    h1{font-size:26px;border-bottom:2px solid #111;padding-bottom:8px}
    h2{font-size:17px;margin-top:22px}
    table{width:100%;border-collapse:collapse;margin:12px 0}
    th,td{border:1px solid #ccc;padding:7px 10px;text-align:left;font-size:13px}
    th{background:#f4f4f4}
    .muted{color:#666;font-size:12px}
    @media print{body{margin:0}}
  </style></head><body>${html}</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
}

export default {
  /* ================= 文档模板 ================= */
  'doc-templates'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="grid4">
            <div class="field"><label class="lab">模板</label><select class="sel" id="dt-type">
              <option value="weekly">周报</option><option value="daily">日报</option><option value="meeting">会议纪要</option>
              <option value="okr">OKR</option><option value="prd">需求文档</option><option value="bug">Bug 报告</option>
              <option value="story">用户故事</option><option value="retro">项目复盘</option><option value="adr">架构决策 ADR</option><option value="swot">SWOT</option>
            </select></div>
            <div class="field"><label class="lab">标题 / 项目</label><input class="inp" id="dt-title" value="空天工具合集"></div>
            <div class="field"><label class="lab">负责人</label><input class="inp" id="dt-owner" value=""></div>
            <div class="field"><label class="lab">日期</label><input class="inp" id="dt-date" type="date"></div>
          </div>
          <div class="field" style="margin-top:9px"><label class="lab">要点 / 内容（每行一条）</label><textarea class="ta" id="dt-points" rows="7">完成文本与编码模块
完成图片压缩与二维码
修复部分移动端布局问题
计划：补充 PDF 与音频工具</textarea></div>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="dt-run">生成</button><button class="btn" id="dt-copy">复制</button><button class="btn" id="dt-dl">下载 .md</button></div>
        </div>
        <div class="panel"><div class="panel-head"><b>Markdown</b></div><textarea class="ta mono" id="dt-out" rows="18"></textarea></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#dt-date').value = today();
    const gen = () => {
      const title = $('#dt-title').value, owner = $('#dt-owner').value || '（待填）', date = $('#dt-date').value;
      const pts = $('#dt-points').value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
      const list = pts.map((p) => '- ' + p).join('\n');
      const t = $('#dt-type').value;
      const h = (s) => `## ${s}`;
      if (t === 'weekly') return `# ${title} · 周报\n\n- 负责人：${owner}\n- 日期：${date}\n\n${h('本周完成')}\n${list}\n\n${h('进行中')}\n- \n\n${h('风险与阻塞')}\n- 无\n\n${h('下周计划')}\n- `;
      if (t === 'daily') return `# ${title} · 日报\n\n- 日期：${date}\n- 负责人：${owner}\n\n${h('今日完成')}\n${list}\n\n${h('明日计划')}\n- \n\n${h('需要协助')}\n- 无`;
      if (t === 'meeting') return `# ${title} · 会议纪要\n\n- 时间：${date}\n- 主持：${owner}\n- 参会人：\n\n${h('议题')}\n${list}\n\n${h('结论')}\n- \n\n${h('待办事项')}\n| 事项 | 负责人 | 截止时间 |\n| --- | --- | --- |\n|  |  |  |`;
      if (t === 'okr') return `# ${title} · OKR\n\n- 周期：${date}\n- 负责人：${owner}\n\n## O1：\n\n- KR1：\n- KR2：\n- KR3：\n\n${h('关键动作')}\n${list}`;
      if (t === 'prd') return `# ${title} · 需求文档\n\n- 版本：v0.1\n- 日期：${date}\n- 负责人：${owner}\n\n${h('背景与问题')}\n\n\n${h('目标与非目标')}\n- 目标：\n- 非目标：\n\n${h('需求描述')}\n${list}\n\n${h('验收标准')}\n- [ ] \n- [ ] `;
      if (t === 'bug') return `# ${title} · Bug 报告\n\n- 报告人：${owner}\n- 日期：${date}\n- 严重程度：中\n\n${h('环境')}\n- 浏览器 / 系统 / 版本：\n\n${h('复现步骤')}\n${pts.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\n${h('预期结果')}\n\n\n${h('实际结果')}\n\n\n${h('附件')}\n- 截图 / 录屏`;
      if (t === 'story') return `# ${title} · 用户故事\n\n- 日期：${date}\n- 负责人：${owner}\n\n${h('用户故事')}\n作为 <角色>，我希望 <目标>，以便 <价值>。\n\n${h('验收标准')}\n- [ ] Given ... When ... Then ...\n\n${h('补充')}\n${list}`;
      if (t === 'retro') return `# ${title} · 项目复盘\n\n- 日期：${date}\n- 负责人：${owner}\n\n${h('背景与目标')}\n\n\n${h('结果')}\n${list}\n\n${h('做得好的')}\n- \n\n${h('待改进')}\n- \n\n${h('行动项')}\n| 行动 | 负责人 | 时间 |\n| --- | --- | --- |\n|  |  |  |`;
      if (t === 'adr') return `# ADR-001：${title}\n\n- 状态：提议\n- 日期：${date}\n- 决策人：${owner}\n\n${h('背景')}\n\n\n${h('决策')}\n${list}\n\n${h('后果')}\n- 正面：\n- 负面：\n- 风险：`;
      return `# ${title} · SWOT 分析\n\n- 日期：${date}\n- 负责人：${owner}\n\n${h('Strengths 优势')}\n${list}\n\n${h('Weaknesses 劣势')}\n- \n\n${h('Opportunities 机会')}\n- \n\n${h('Threats 威胁')}\n- `;
    };
    $('#dt-run').onclick = () => { $('#dt-out').value = gen(); };
    $('#dt-copy').onclick = () => copy($('#dt-out').value);
    $('#dt-dl').onclick = () => download($('#dt-type').value + '.md', $('#dt-out').value, 'text/markdown');
    $('#dt-type').addEventListener('change', () => $('#dt-run').click());
    $('#dt-run').click();
  },

  /* ================= 简历 ================= */
  'resume'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="grid3">
            <div class="field"><label class="lab">姓名</label><input class="inp" id="rv-name" value="张三"></div>
            <div class="field"><label class="lab">职位</label><input class="inp" id="rv-job" value="前端工程师"></div>
            <div class="field"><label class="lab">城市</label><input class="inp" id="rv-city" value="北京"></div>
            <div class="field"><label class="lab">电话</label><input class="inp" id="rv-phone" value="138-0000-0000"></div>
            <div class="field"><label class="lab">邮箱</label><input class="inp" id="rv-email" value="zhangsan@example.com"></div>
            <div class="field"><label class="lab">网站</label><input class="inp" id="rv-site" value="github.com/example"></div>
          </div>
          <div class="field" style="margin-top:9px"><label class="lab">个人简介</label><textarea class="ta" id="rv-summary" rows="2">5 年前端开发经验，关注性能优化与用户体验，熟悉原生 JavaScript 与工程化。</textarea></div>
          <div class="field" style="margin-top:9px"><label class="lab">技能（逗号分隔）</label><input class="inp" id="rv-skills" value="JavaScript, TypeScript, React, Vue, Node.js, CSS"></div>
          <div class="field" style="margin-top:9px"><label class="lab">工作经历（每行：公司 | 职位 | 时间 | 描述）</label><textarea class="ta" id="rv-exp" rows="4">空天科技 | 高级前端工程师 | 2022 - 至今 | 负责浏览器工具体系建设，性能提升 40%
星河网络 | 前端工程师 | 2019 - 2022 | 负责中后台系统与组件库</textarea></div>
          <div class="field" style="margin-top:9px"><label class="lab">教育经历（每行：学校 | 专业 | 学历 | 时间）</label><textarea class="ta" id="rv-edu" rows="2">示例大学 | 计算机科学 | 本科 | 2015 - 2019</textarea></div>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="rv-run">生成预览</button><button class="btn" id="rv-print">打印 / 另存为 PDF</button><button class="btn" id="rv-dl">下载 HTML</button></div>
        </div>
        <div class="panel" style="background:#fff;color:#111;padding:28px" id="rv-preview"></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const gen = () => {
      const name = $('#rv-name').value, job = $('#rv-job').value;
      const contact = [$('#rv-phone').value, $('#rv-email').value, $('#rv-city').value, $('#rv-site').value].filter(Boolean).map(esc).join(' · ');
      const skills = $('#rv-skills').value.split(/[,，]/).map((x) => x.trim()).filter(Boolean);
      const exp = $('#rv-exp').value.split(/\r?\n/).filter((x) => x.trim()).map((l) => l.split('|').map((x) => x.trim()));
      const edu = $('#rv-edu').value.split(/\r?\n/).filter((x) => x.trim()).map((l) => l.split('|').map((x) => x.trim()));
      return `<div style="font-family:-apple-system,'PingFang SC',sans-serif;color:#111">
        <div style="border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:18px">
          <h1 style="margin:0;font-size:30px">${esc(name)} <span style="font-size:15px;font-weight:400;color:#555">${esc(job)}</span></h1>
          <div style="font-size:12px;color:#555;margin-top:6px">${contact}</div>
        </div>
        <h2 style="font-size:14px;letter-spacing:2px;border-bottom:1px solid #ddd;padding-bottom:4px">个人简介</h2>
        <p style="font-size:13px;line-height:1.8">${esc($('#rv-summary').value)}</p>
        <h2 style="font-size:14px;letter-spacing:2px;border-bottom:1px solid #ddd;padding-bottom:4px">技能</h2>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${skills.map((s) => `<span style="font-size:12px;border:1px solid #ddd;border-radius:4px;padding:3px 9px">${esc(s)}</span>`).join('')}</div>
        <h2 style="font-size:14px;letter-spacing:2px;border-bottom:1px solid #ddd;padding-bottom:4px">工作经历</h2>
        ${exp.map(([c, p, t, d]) => `<div style="margin:10px 0"><div style="display:flex;justify-content:space-between;font-size:13px"><b>${esc(c || '')}</b><span style="color:#666">${esc(t || '')}</span></div><div style="font-size:12px;color:#444">${esc(p || '')}</div><div style="font-size:12px;color:#555;margin-top:3px">${esc(d || '')}</div></div>`).join('')}
        <h2 style="font-size:14px;letter-spacing:2px;border-bottom:1px solid #ddd;padding-bottom:4px">教育经历</h2>
        ${edu.map(([s, m, d, t]) => `<div style="display:flex;justify-content:space-between;font-size:12px;margin:6px 0"><span><b>${esc(s || '')}</b> · ${esc(m || '')} · ${esc(d || '')}</span><span style="color:#666">${esc(t || '')}</span></div>`).join('')}
      </div>`;
    };
    $('#rv-run').onclick = () => { $('#rv-preview').innerHTML = gen(); };
    $('#rv-print').onclick = () => printHtml(gen(), '简历');
    $('#rv-dl').onclick = () => download('resume.html', `<!doctype html><html><head><meta charset="utf-8"></head><body>${gen()}</body></html>`, 'text/html');
    $('#rv-run').click();
  },

  /* ================= 单据 ================= */
  'invoice'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="grid3">
            <div class="field"><label class="lab">类型</label><select class="sel" id="iv-type"><option value="invoice">发票</option><option value="quote">报价单</option><option value="receipt">收据</option></select></div>
            <div class="field"><label class="lab">单据编号</label><input class="inp" id="iv-no" value="KT-2026-001"></div>
            <div class="field"><label class="lab">日期</label><input class="inp" id="iv-date" type="date"></div>
            <div class="field"><label class="lab">开票方</label><input class="inp" id="iv-from" value="空天科技有限公司"></div>
            <div class="field"><label class="lab">客户</label><input class="inp" id="iv-to" value="示例客户"></div>
            <div class="field"><label class="lab">税率 %</label><input class="inp" id="iv-tax" type="number" value="6"></div>
          </div>
          <div class="field" style="margin-top:9px"><label class="lab">项目（每行：名称, 数量, 单价）</label><textarea class="ta" id="iv-items" rows="4">网站设计, 1, 8000
前端开发, 1, 12000
维护服务, 3, 1000</textarea></div>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="iv-run">生成预览</button><button class="btn" id="iv-print">打印 / PDF</button></div>
        </div>
        <div class="panel" style="background:#fff;color:#111;padding:28px" id="iv-preview"></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#iv-date').value = today();
    const gen = () => {
      const items = $('#iv-items').value.split(/\r?\n/).filter((x) => x.trim()).map((l) => l.split(',').map((x) => x.trim()));
      const sub = items.reduce((s, [n, q, p]) => s + (Number(q) || 0) * (Number(p) || 0), 0);
      const tax = sub * (Number($('#iv-tax').value) || 0) / 100;
      const total = sub + tax;
      const title = { invoice: '发票', quote: '报价单', receipt: '收据' }[$('#iv-type').value];
      return `<div style="font-family:-apple-system,'PingFang SC',sans-serif;color:#111">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:12px">
          <div><h1 style="margin:0;font-size:26px">${esc(title)}</h1><div style="font-size:12px;color:#555;margin-top:4px">${esc($('#iv-from').value)}</div></div>
          <div style="text-align:right;font-size:12px;color:#555"><div>编号：${esc($('#iv-no').value)}</div><div>日期：${esc($('#iv-date').value)}</div></div>
        </div>
        <div style="margin:18px 0;font-size:13px"><b>客户：</b>${esc($('#iv-to').value)}</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <tr style="background:#f4f4f4"><th style="border:1px solid #ccc;padding:7px;text-align:left">项目</th><th style="border:1px solid #ccc;padding:7px">数量</th><th style="border:1px solid #ccc;padding:7px">单价</th><th style="border:1px solid #ccc;padding:7px">金额</th></tr>
          ${items.map(([n, q, p]) => `<tr><td style="border:1px solid #ccc;padding:7px">${esc(n || '')}</td><td style="border:1px solid #ccc;padding:7px;text-align:center">${esc(q || '')}</td><td style="border:1px solid #ccc;padding:7px;text-align:right">${Number(p || 0).toFixed(2)}</td><td style="border:1px solid #ccc;padding:7px;text-align:right">${((Number(q) || 0) * (Number(p) || 0)).toFixed(2)}</td></tr>`).join('')}
        </table>
        <div style="margin-left:auto;width:240px;margin-top:14px;font-size:13px">
          <div style="display:flex;justify-content:space-between;padding:3px 0"><span>小计</span><span>¥${sub.toFixed(2)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:3px 0"><span>税额（${$('#iv-tax').value}%）</span><span>¥${tax.toFixed(2)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:7px 0;border-top:2px solid #111;font-weight:700"><span>合计</span><span>¥${total.toFixed(2)}</span></div>
        </div>
        <div style="margin-top:32px;font-size:11px;color:#888">本单据由空天工具合集生成，仅作模板用途。</div>
      </div>`;
    };
    $('#iv-run').onclick = () => { $('#iv-preview').innerHTML = gen(); };
    $('#iv-print').onclick = () => printHtml(gen(), '单据');
    $('#iv-run').click();
  },

  /* ================= PPT 大纲 ================= */
  'ppt-outline'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>文本转 PPT 大纲</b><span class="hint">按段落或标题拆分，生成演讲提纲</span></div>
          <textarea class="ta" id="po-in" rows="8">空天工具合集的定位
浏览器里的万能工具箱，打开即用。

核心功能
文本、编码、开发、图片、PDF、二维码等 190+ 工具。

设计原则
纯前端、文件不上传、依赖按需加载、手机电脑一致。</textarea>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="po-run">生成大纲</button><button class="btn" id="po-copy">复制</button><button class="btn" id="po-dl">下载 .md</button></div>
        </div>
        <div class="panel"><pre class="out" id="po-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#po-run').onclick = () => {
      const blocks = $('#po-in').value.split(/\n\s*\n/).filter((x) => x.trim());
      const slides = [];
      slides.push(`# 演示大纲\n`);
      blocks.forEach((b, i) => {
        const lines = b.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
        const title = lines[0];
        const body = lines.slice(1);
        slides.push(`## 第 ${i + 1} 页：${title}\n\n${body.map((x) => '- ' + x).join('\n')}\n`);
      });
      $('#po-out').textContent = slides.join('\n');
    };
    $('#po-copy').onclick = () => copy($('#po-out').textContent);
    $('#po-dl').onclick = () => download('ppt-outline.md', $('#po-out').textContent, 'text/markdown');
    $('#po-run').click();
  },

  /* ================= 可访问性 ================= */
  'a11y-check'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>HTML 可访问性检查</b><span class="hint">本机解析，不访问网络</span></div>
          <textarea class="ta mono" id="ae-in" rows="9" placeholder="粘贴 HTML 片段…"><html lang="zh-CN"><body><h1>标题</h1><h3>跳级标题</h3><img src="a.png"><a href="/x"></a><form><input type="text"></form><table><tr><td>数据</td></tr></table></body></html></textarea>
          <button class="btn primary" id="ae-run" style="margin-top:9px">检查</button>
        </div>
        <div class="panel"><div class="panel-head"><b>报告</b><span class="hint" id="ae-meta"></span></div><div id="ae-out"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#ae-run').onclick = () => {
      const doc = new DOMParser().parseFromString($('#ae-in').value, 'text/html');
      const issues = [];
      const lang = doc.documentElement.getAttribute('lang');
      if (!lang) issues.push(['medium', 'html 缺少 lang 属性']);
      const h1 = doc.querySelectorAll('h1');
      if (h1.length !== 1) issues.push(['medium', `h1 数量为 ${h1.length}，建议每页一个`]);
      const heads = [...doc.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => Number(h.tagName[1]));
      for (let i = 1; i < heads.length; i++) if (heads[i] - heads[i - 1] > 1) issues.push(['low', `标题层级从 h${heads[i - 1]} 跳到 h${heads[i]}`]);
      doc.querySelectorAll('img').forEach((img) => { if (!img.hasAttribute('alt')) issues.push(['high', `图片缺少 alt：${img.getAttribute('src') || '(无 src)'}`]); });
      doc.querySelectorAll('a').forEach((a) => { if (!a.textContent.trim() && !a.getAttribute('aria-label')) issues.push(['high', `链接缺少可读文本：${a.getAttribute('href')}`]); });
      doc.querySelectorAll('input,select,textarea').forEach((el) => {
        if (el.type === 'hidden') return;
        const id = el.getAttribute('id');
        const hasLabel = id && doc.querySelector(`label[for="${id}"]`);
        if (!hasLabel && !el.getAttribute('aria-label')) issues.push(['high', `${el.tagName.toLowerCase()} 缺少关联的 label`]);
      });
      doc.querySelectorAll('table').forEach((t) => { if (!t.querySelector('th')) issues.push(['low', '表格缺少表头 th']); });
      doc.querySelectorAll('button').forEach((b) => { if (!b.textContent.trim() && !b.getAttribute('aria-label')) issues.push(['medium', '按钮缺少可读文本']); });
      $('#ae-meta').textContent = `${issues.length} 个问题`;
      $('#ae-out').innerHTML = issues.length ? issues.map(([lvl, text]) => `<div class="${lvl === 'high' ? 'errbox' : lvl === 'medium' ? 'warnbox' : 'okbox'}" style="margin-bottom:6px">${esc(text)}</div>`).join('') : '<div class="okbox">没有发现明显问题</div>';
    };
    $('#ae-run').click();
  }
};
