/* Web、CSS、国际化、无障碍、SEO、PWA 与性能 */
import { esc, copy, toast, download, fmtBytes } from '../core/ui.js';
import { checklistWorkbench } from '../core/workbench.js';

const $ = (root, s) => root.querySelector(s);

function flatten(obj, pre = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = pre ? pre + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

export default {
  /* ================= CSS 艺术 ================= */
  'css-art'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="row"><select class="sel" id="ca-type" style="max-width:190px"><option value="shape">CSS 形状</option><option value="clip">clip-path</option><option value="mask">遮罩</option><option value="blend">混合模式</option><option value="filter">滤镜链</option><option value="3d">3D 变换</option><option value="scroll">滚动动画</option></select><button class="btn primary" id="ca-run">生成</button><button class="btn" id="ca-copy">复制</button></div>
          <div class="grid3" id="ca-controls" style="margin-top:10px"></div>
        </div>
        <div class="panel"><div class="panel-head"><b>预览</b></div><div style="height:220px;display:flex;align-items:center;justify-content:center;background:repeating-conic-gradient(var(--w-04) 0 25%,transparent 0 50%) 0 0/20px 20px;border-radius:10px;overflow:hidden"><div id="ca-preview" style="width:140px;height:140px;background:linear-gradient(135deg,#22d3ee,#818cf8)"></div></div></div>
        <div class="panel"><div class="panel-head"><b>CSS</b></div><pre class="out" id="ca-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let type = 'shape';
    const controls = () => {
      const el = $('#ca-controls');
      if (type === 'clip') el.innerHTML = `<div class="field"><label class="lab">形状</label><select class="sel" id="ca-c1"><option value="polygon(50% 0, 100% 100%, 0 100%)">三角形</option><option value="circle(50% at 50% 50%)">圆形</option><option value="ellipse(45% 30% at 50% 50%)">椭圆</option><option value="polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)">六边形</option><option value="polygon(0 0, 100% 0, 100% 75%, 50% 100%, 0 75%)">对话框</option><option value="inset(10% 20% 10% 20% round 20px)">内缩</option></select></div>`;
      else if (type === 'filter') el.innerHTML = `<div class="field"><label class="lab">模糊</label><input type="range" id="ca-b" min="0" max="12" value="4"></div><div class="field"><label class="lab">饱和度</label><input type="range" id="ca-s" min="0" max="3" step="0.1" value="1.6"></div><div class="field"><label class="lab">对比度</label><input type="range" id="ca-c" min="0.5" max="2" step="0.1" value="1.2"></div>`;
      else if (type === '3d') el.innerHTML = `<div class="field"><label class="lab">旋转 X</label><input type="range" id="ca-x" min="-90" max="90" value="25"></div><div class="field"><label class="lab">旋转 Y</label><input type="range" id="ca-y" min="-90" max="90" value="35"></div><div class="field"><label class="lab">透视</label><input type="range" id="ca-p" min="200" max="1200" value="600"></div>`;
      else if (type === 'shape') el.innerHTML = `<div class="field"><label class="lab">圆角</label><input type="range" id="ca-r" min="0" max="100" value="30"></div><div class="field"><label class="lab">旋转</label><input type="range" id="ca-rot" min="0" max="360" value="0"></div><div class="field"><label class="lab">背景</label><input type="color" id="ca-bg" value="#22d3ee"></div>`;
      else el.innerHTML = '';
    };
    const run = () => {
      const p = $('#ca-preview');
      p.style.cssText = 'width:140px;height:140px;background:linear-gradient(135deg,#22d3ee,#818cf8)';
      let css = '';
      if (type === 'shape') {
        const r = Number($('#ca-r')?.value || 30);
        const rot = Number($('#ca-rot')?.value || 0);
        css = `background: ${$('#ca-bg')?.value || '#22d3ee'};\nborder-radius: ${r}% ${100 - r}% ${r}% ${100 - r}%;\ntransform: rotate(${rot}deg);`;
        p.style.background = $('#ca-bg')?.value || '#22d3ee';
        p.style.borderRadius = `${r}% ${100 - r}% ${r}% ${100 - r}%`;
        p.style.transform = `rotate(${rot}deg)`;
      } else if (type === 'clip') {
        const v = $('#ca-c1')?.value || 'circle(50% at 50% 50%)';
        css = `clip-path: ${v};`;
        p.style.clipPath = v;
      } else if (type === 'mask') {
        css = `-webkit-mask-image: radial-gradient(circle at 50% 50%, #000 40%, transparent 70%);\nmask-image: radial-gradient(circle at 50% 50%, #000 40%, transparent 70%);`;
        p.style.maskImage = 'radial-gradient(circle at 50% 50%, #000 40%, transparent 70%)';
        p.style.webkitMaskImage = p.style.maskImage;
      } else if (type === 'blend') {
        css = `mix-blend-mode: screen;\nbackground: linear-gradient(135deg, #22d3ee, #c084fc);`;
        p.style.mixBlendMode = 'screen';
      } else if (type === 'filter') {
        const f = `blur(${$('#ca-b')?.value || 0}px) saturate(${$('#ca-s')?.value || 1}) contrast(${$('#ca-c')?.value || 1})`;
        css = `filter: ${f};`;
        p.style.filter = f;
      } else if (type === '3d') {
        const t = `perspective(${$('#ca-p')?.value || 600}px) rotateX(${$('#ca-x')?.value || 0}deg) rotateY(${$('#ca-y')?.value || 0}deg)`;
        css = `transform: ${t};\ntransform-style: preserve-3d;`;
        p.style.transform = t;
      } else {
        css = `@keyframes floatIn {\n  from { opacity: 0; transform: translateY(40px) scale(.95); }\n  to { opacity: 1; transform: none; }\n}\n\n.reveal {\n  animation: floatIn .7s cubic-bezier(.22,1,.36,1) both;\n  animation-timeline: view();\n  animation-range: entry 0% cover 35%;\n}`;
        p.style.animation = 'floatIn 1.6s ease-in-out infinite alternate';
        p.style.transform = 'translateY(10px)';
      }
      $('#ca-out').textContent = css;
    };
    $('#ca-type').onchange = () => { type = $('#ca-type').value; controls(); run(); };
    $('#ca-run').onclick = run;
    $('#ca-copy').onclick = () => copy($('#ca-out').textContent);
    controls(); run();
  },

  /* ================= 国际化 ================= */
  'i18n-tools'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="i18-tabs"><button class="tab active" data-i="0">语言包对比</button><button class="tab" data-i="1">CSV ↔ JSON</button><button class="tab" data-i="2">伪本地化</button><button class="tab" data-i="3">RTL 预览</button></div>
        <div class="panel" id="i18-p0">
          <div class="grid2"><textarea class="ta mono" id="i18-a" rows="8" placeholder="基准语言 JSON">{"hello":"你好","save":"保存","cancel":"取消"}</textarea><textarea class="ta mono" id="i18-b" rows="8" placeholder="目标语言 JSON">{"hello":"Hello","save":"Save"}</textarea></div>
          <div class="row" style="margin-top:9px"><button class="btn primary" id="i18-run">对比</button><button class="btn" id="i18-copy">复制结果</button></div>
          <pre class="out" id="i18-out" style="margin-top:9px"></pre>
        </div>
        <div class="panel hidden" id="i18-p1">
          <textarea class="ta mono" id="i18-json" rows="8">{"hello":"你好","save":"保存"}</textarea>
          <div class="row" style="margin-top:9px"><button class="btn" id="i18-j2c">JSON → CSV</button><button class="btn" id="i18-c2j">CSV → JSON</button><button class="btn primary" id="i18-conv">转换</button></div>
          <pre class="out" id="i18-conv-out" style="margin-top:9px"></pre>
        </div>
        <div class="panel hidden" id="i18-p2">
          <textarea class="ta" id="i18-text" rows="5">空天工具合集 · 保存 取消 设置</textarea>
          <button class="btn primary" id="i18-pseudo" style="margin-top:9px">生成伪本地化文本</button>
          <pre class="out" id="i18-pseudo-out" style="margin-top:9px"></pre>
        </div>
        <div class="panel hidden" id="i18-p3">
          <div class="hint">RTL 布局预览（阿拉伯语示例）</div>
          <div dir="rtl" style="margin-top:10px;padding:16px;border:1px solid var(--line);border-radius:10px;background:var(--panel-2)">
            <h3 style="margin-top:0">أدوات كونغتيان</h3>
            <p>صندوق أدوات يعمل بالكامل داخل المتصفح. تتم معالجة جميع الملفات محليًا ولا يتم رفعها.</p>
            <button class="btn primary">ابدأ الآن</button>
          </div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#i18-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#i18-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      [0, 1, 2, 3].forEach((i) => $('#i18-p' + i).classList.toggle('hidden', String(i) !== b.dataset.i));
    });
    $('#i18-run').onclick = () => {
      try {
        const a = flatten(JSON.parse($('#i18-a').value));
        const b = flatten(JSON.parse($('#i18-b').value));
        const missing = Object.keys(a).filter((k) => !(k in b));
        const extra = Object.keys(b).filter((k) => !(k in a));
        const dup = Object.keys(b).filter((k) => b[k] === '');
        $('#i18-out').textContent = `基准键：${Object.keys(a).length}\n目标键：${Object.keys(b).length}\n\n缺失（${missing.length}）\n${missing.join('\n') || '无'}\n\n多余（${extra.length}）\n${extra.join('\n') || '无'}\n\n空值（${dup.length}）\n${dup.join('\n') || '无'}`;
      } catch (e) { $('#i18-out').textContent = 'JSON 解析失败：' + e.message; }
    };
    $('#i18-copy').onclick = () => copy($('#i18-out').textContent);
    const convert = (toCsv) => {
      try {
        if (toCsv) {
          const obj = flatten(JSON.parse($('#i18-json').value));
          $('#i18-conv-out').textContent = 'key,value\n' + Object.entries(obj).map(([k, v]) => `"${k}","${String(v).replace(/"/g, '""')}"`).join('\n');
        } else {
          const lines = $('#i18-json').value.split(/\r?\n/).filter(Boolean);
          const obj = {};
          lines.slice(1).forEach((l) => { const m = l.match(/^"([^"]+)","?(.*?)"?$/); if (m) obj[m[1]] = m[2]; });
          $('#i18-conv-out').textContent = JSON.stringify(obj, null, 2);
        }
      } catch (e) { $('#i18-conv-out').textContent = '转换失败：' + e.message; }
    };
    $('#i18-j2c').onclick = () => convert(true);
    $('#i18-c2j').onclick = () => convert(false);
    $('#i18-conv').onclick = () => convert(true);
    $('#i18-pseudo').onclick = () => {
      const map = { a: 'á', b: 'ƀ', c: 'ç', d: 'ð', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'í', j: 'ĵ', k: 'ķ', l: 'ĺ', m: 'ɱ', n: 'ñ', o: 'ó', p: 'þ', q: 'q', r: 'ŕ', s: 'š', t: 'ţ', u: 'ú', v: 'v', w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž', A: 'Á', B: 'Ɓ', C: 'Ç', D: 'Ð', E: 'É', F: 'Ƒ', G: 'Ĝ', H: 'Ĥ', I: 'Í', J: 'Ĵ', K: 'Ķ', L: 'Ĺ', M: 'Ṁ', N: 'Ñ', O: 'Ó', P: 'Þ', Q: 'Q', R: 'Ŕ', S: 'Š', T: 'Ţ', U: 'Ú', V: 'V', W: 'Ŵ', X: 'Ẋ', Y: 'Ý', Z: 'Ž' };
      const t = $('#i18-text').value;
      $('#i18-pseudo-out').textContent = '⟦' + [...t].map((c) => map[c] || c).join('') + '⟧   ' + '⟦' + [...t].map((c) => map[c] || c).join('') + '⟧';
    };
  },

  /* ================= 无障碍 ================= */
  'a11y-pro'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="a11-tabs"><button class="tab active" data-i="0">ARIA 查询</button><button class="tab" data-i="1">焦点顺序</button><button class="tab" data-i="2">WCAG 清单</button><button class="tab" data-i="3">对比度</button></div>
        <div class="panel" id="a11-p0">
          <div class="row"><input class="inp" id="a11-q" placeholder="搜索角色或属性，例如 button、aria-label" style="flex:1"><select class="sel" id="a11-kind" style="max-width:130px"><option value="all">全部</option><option value="role">角色</option><option value="attr">属性</option></select></div>
          <div id="a11-list" class="tool-ui" style="margin-top:10px"></div>
        </div>
        <div class="panel hidden" id="a11-p1">
          <div class="field"><label class="lab">HTML 片段</label><textarea class="ta mono" id="a11-html" rows="6"><button>保存</button><a href="/x">链接</a><input type="text" placeholder="姓名"><div tabindex="0">自定义焦点</div></textarea></div>
          <button class="btn primary" id="a11-focus" style="margin-top:9px">分析焦点顺序</button>
          <div id="a11-focus-out" class="tool-ui" style="margin-top:10px"></div>
        </div>
        <div id="a11-p2" class="hidden"></div>
        <div class="panel hidden" id="a11-p3">
          <div class="row"><input type="color" id="a11-fg" value="#e9eefc"><input type="color" id="a11-bg" value="#070b14"><button class="btn primary" id="a11-contrast">检测</button></div>
          <div class="stat-grid" id="a11-contrast-out" style="margin-top:10px"></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const ROLES = [['button', '按钮'], ['link', '链接'], ['heading', '标题'], ['img', '图片'], ['list', '列表'], ['listitem', '列表项'], ['navigation', '导航'], ['main', '主内容'], ['form', '表单'], ['dialog', '对话框'], ['alert', '警告'], ['tab', '标签页'], ['tabpanel', '标签面板'], ['checkbox', '复选框'], ['radio', '单选框'], ['switch', '开关'], ['progressbar', '进度条'], ['status', '状态'], ['tooltip', '提示']];
    const ATTRS = [['aria-label', '可访问名称'], ['aria-labelledby', '由元素提供名称'], ['aria-describedby', '描述'], ['aria-hidden', '隐藏于辅助技术'], ['aria-expanded', '展开状态'], ['aria-controls', '控制元素'], ['aria-live', '实时区域'], ['aria-current', '当前项'], ['aria-disabled', '禁用状态'], ['aria-checked', '选中状态'], ['aria-selected', '选择状态'], ['aria-required', '必填'], ['aria-invalid', '无效'], ['role', '角色']];
    const paint = () => {
      const q = $('#a11-q').value.toLowerCase(); const kind = $('#a11-kind').value;
      const rows = [];
      if (kind !== 'attr') ROLES.filter(([r, n]) => !q || r.includes(q) || n.includes(q)).forEach(([r, n]) => rows.push(`<div class="row between" style="border-bottom:1px solid var(--line);padding:5px 0"><span class="mono" style="color:var(--acc)">role="${r}"</span><span class="hint">${n}</span></div>`));
      if (kind !== 'role') ATTRS.filter(([r, n]) => !q || r.includes(q) || n.includes(q)).forEach(([r, n]) => rows.push(`<div class="row between" style="border-bottom:1px solid var(--line);padding:5px 0"><span class="mono" style="color:var(--acc-2)">${r}</span><span class="hint">${n}</span></div>`));
      $('#a11-list').innerHTML = rows.join('') || '<div class="hint">没有匹配项</div>';
    };
    $('#a11-q').addEventListener('input', paint);
    $('#a11-kind').addEventListener('change', paint);
    paint();
    const holder = document.createElement('div');
    $('#a11-p2').appendChild(holder);
    checklistWorkbench(holder, {
      title: 'WCAG 2.2 快速检查',
      sections: [
        { name: '可感知', items: ['图片有替代文本', '视频有字幕/转录', '颜色不是唯一信息载体', '对比度达标（正文 4.5:1）', '可缩放至 200%'] },
        { name: '可操作', items: ['全部功能可键盘操作', '焦点可见', '无键盘陷阱', '可跳过重复导航', '链接文本有意义'] },
        { name: '可理解', items: ['页面语言已声明', '标签与说明清晰', '错误提示可理解', '一致导航与标识'] },
        { name: '健壮', items: ['语义化 HTML', 'ARIA 使用正确', '兼容屏幕阅读器', '表单错误可被朗读'] }
      ]
    });
    $('#a11-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#a11-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      [0, 1, 2, 3].forEach((i) => $('#a11-p' + i).classList.toggle('hidden', String(i) !== b.dataset.i));
    });
    $('#a11-focus').onclick = () => {
      const doc = new DOMParser().parseFromString($('#a11-html').value, 'text/html');
      const els = [...doc.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')];
      $('#a11-focus-out').innerHTML = els.map((el, i) => `<div class="row between" style="border-bottom:1px solid var(--line);padding:5px 0"><span>${i + 1}. <b class="mono">${el.tagName.toLowerCase()}</b> ${el.textContent.trim().slice(0, 20)}</span><span class="hint">${el.getAttribute('tabindex') ? 'tabindex=' + el.getAttribute('tabindex') : ''}</span></div>`).join('') || '<div class="hint">没有可聚焦元素</div>';
    };
    $('#a11-contrast').onclick = () => {
      const hex = (h) => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) });
      const lum = ({ r, g, b }) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const a = lum(hex($('#a11-fg').value)), b = lum(hex($('#a11-bg').value));
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      $('#a11-contrast-out').innerHTML = [['对比度', ratio.toFixed(2) + ':1'], ['AA 正文', ratio >= 4.5 ? '通过' : '不通过'], ['AA 大字', ratio >= 3 ? '通过' : '不通过'], ['AAA 正文', ratio >= 7 ? '通过' : '不通过']].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
    };
  },

  /* ================= SEO 扩展 ================= */
  'seo-pro'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="seo-tabs"><button class="tab active" data-i="0">SERP 预览</button><button class="tab" data-i="1">JSON-LD</button><button class="tab" data-i="2">批量检查</button><button class="tab" data-i="3">Sitemap / robots</button></div>
        <div class="panel" id="seo-p0">
          <div class="grid3"><div class="field"><label class="lab">标题</label><input class="inp" id="seo-title" value="空天工具合集 · 浏览器里的万能工具箱"></div><div class="field"><label class="lab">URL</label><input class="inp" id="seo-url" value="https://by654.github.io/kongtian-tools/"></div><div class="field"><label class="lab">描述</label><input class="inp" id="seo-desc" value="191 个纯前端工具，文件不上传，打开即用。"></div></div>
          <button class="btn primary" id="seo-run" style="margin-top:9px">生成预览</button>
          <div id="seo-preview" style="margin-top:14px"></div>
        </div>
        <div class="panel hidden" id="seo-p1">
          <div class="grid3"><div class="field"><label class="lab">类型</label><select class="sel" id="seo-ld-type"><option value="breadcrumb">面包屑</option><option value="faq">FAQ</option><option value="product">产品</option><option value="article">文章</option><option value="local">本地商家</option></select></div><div class="field"><label class="lab">名称/标题</label><input class="inp" id="seo-ld-name" value="空天工具合集"></div><div class="field"><label class="lab">URL</label><input class="inp" id="seo-ld-url" value="https://by654.github.io/kongtian-tools/"></div></div>
          <button class="btn primary" id="seo-ld-run" style="margin-top:9px">生成 JSON-LD</button><pre class="out" id="seo-ld-out" style="margin-top:9px"></pre>
        </div>
        <div class="panel hidden" id="seo-p2">
          <div class="field"><label class="lab">标题（每行一个）</label><textarea class="ta" id="seo-titles" rows="4">空天工具合集
JSON 工作台
二维码生成器</textarea></div>
          <div class="field" style="margin-top:8px"><label class="lab">描述（每行一个）</label><textarea class="ta" id="seo-descs" rows="3">纯前端工具箱
格式化与校验 JSON
生成二维码并下载</textarea></div>
          <button class="btn primary" id="seo-bulk" style="margin-top:9px">批量检查</button>
          <div id="seo-bulk-out" class="tool-ui" style="margin-top:9px"></div>
        </div>
        <div class="panel hidden" id="seo-p3">
          <div class="field"><label class="lab">URL 列表（每行一个）</label><textarea class="ta mono" id="seo-urls" rows="4">https://example.com/
https://example.com/a
https://example.com/b</textarea></div>
          <div class="row" style="margin-top:8px"><input class="inp" id="seo-per" type="number" value="2" style="max-width:120px"><button class="btn primary" id="seo-sitemap">生成分片 sitemap</button><button class="btn" id="seo-robots">测试 robots</button></div>
          <pre class="out" id="seo-sitemap-out" style="margin-top:9px"></pre>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#seo-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#seo-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      [0, 1, 2, 3].forEach((i) => $('#seo-p' + i).classList.toggle('hidden', String(i) !== b.dataset.i));
    });
    $('#seo-run').onclick = () => {
      const title = $('#seo-title').value, url = $('#seo-url').value, desc = $('#seo-desc').value;
      $('#seo-preview').innerHTML = `<div style="background:#fff;color:#111;padding:18px;border-radius:10px;max-width:620px"><div style="font-size:12px;color:#5f6368">${esc(url)}</div><div style="font-size:19px;color:#1a0dab;margin:2px 0">${esc(title)}</div><div style="font-size:13px;color:#4d5156;line-height:1.6">${esc(desc)}</div></div><div class="hint" style="margin-top:7px">标题 ${[...title].length} 字（建议 ≤ 60）· 描述 ${[...desc].length} 字（建议 50–160）</div>`;
    };
    $('#seo-ld-run').onclick = () => {
      const name = $('#seo-ld-name').value, url = $('#seo-ld-url').value;
      const type = $('#seo-ld-type').value;
      let obj;
      if (type === 'breadcrumb') obj = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '首页', item: url }] };
      else if (type === 'faq') obj = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: '示例问题？', acceptedAnswer: { '@type': 'Answer', text: '示例回答。' } }] };
      else if (type === 'product') obj = { '@context': 'https://schema.org', '@type': 'Product', name, offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY', availability: 'https://schema.org/InStock' } };
      else if (type === 'article') obj = { '@context': 'https://schema.org', '@type': 'Article', headline: name, author: { '@type': 'Person', name: '作者' }, datePublished: new Date().toISOString().slice(0, 10), mainEntityOfPage: url };
      else obj = { '@context': 'https://schema.org', '@type': 'LocalBusiness', name, url, address: { '@type': 'PostalAddress', addressCountry: 'CN', addressLocality: '北京' } };
      $('#seo-ld-out').textContent = `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2)}\n</script>`;
    };
    $('#seo-bulk').onclick = () => {
      const titles = $('#seo-titles').value.split(/\r?\n/).filter(Boolean);
      const descs = $('#seo-descs').value.split(/\r?\n/).filter(Boolean);
      $('#seo-bulk-out').innerHTML = `<div class="panel tight"><div class="panel-head"><b>标题检查</b></div>${titles.map((t) => `<div class="row between" style="border-bottom:1px solid var(--line);padding:4px 0"><span>${esc(t)}</span><span class="hint" style="color:${[...t].length > 60 || [...t].length < 10 ? 'var(--warn)' : 'var(--ok)'}">${[...t].length} 字</span></div>`).join('')}</div><div class="panel tight" style="margin-top:9px"><div class="panel-head"><b>描述检查</b></div>${descs.map((t) => `<div class="row between" style="border-bottom:1px solid var(--line);padding:4px 0"><span>${esc(t)}</span><span class="hint" style="color:${[...t].length > 160 || [...t].length < 50 ? 'var(--warn)' : 'var(--ok)'}">${[...t].length} 字</span></div>`).join('')}</div>`;
    };
    $('#seo-sitemap').onclick = () => {
      const urls = $('#seo-urls').value.split(/\r?\n/).filter(Boolean);
      const per = Math.max(1, Number($('#seo-per').value));
      const files = [];
      for (let i = 0; i < urls.length; i += per) {
        const chunk = urls.slice(i, i + per);
        files.push(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${chunk.map((u) => `  <url><loc>${esc(u)}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>`).join('\n')}\n</urlset>`);
      }
      $('#seo-sitemap-out').textContent = files.map((f, i) => `--- sitemap-${i + 1}.xml ---\n${f}`).join('\n\n');
    };
    $('#seo-robots').onclick = () => {
      $('#seo-sitemap-out').textContent = `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /private/\n\nSitemap: https://example.com/sitemap.xml\n\n# 测试提示：本工具不做真实抓取。请在浏览器中访问 /robots.txt 核对规则；\n# 通配符 * 与 $ 的支持由爬虫决定，重要路径建议显式声明。`;
    };
    $('#seo-run').click();
  },

  /* ================= PWA ================= */
  'pwa-tools'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>PWA 工具箱</b><span class="hint">Manifest 校验、缓存策略、本地存储查看</span></div>
          <textarea class="ta mono" id="pwa-manifest" rows="8">{
  "name": "空天工具合集",
  "short_name": "空天工具",
  "start_url": "./",
  "display": "standalone",
  "background_color": "#070b14",
  "theme_color": "#070b14",
  "icons": [{ "src": "./assets/favicon.svg", "sizes": "any", "type": "image/svg+xml" }]
}</textarea>
          <div class="row" style="margin-top:9px"><button class="btn primary" id="pwa-check">校验 Manifest</button><button class="btn" id="pwa-cache">生成缓存策略</button><button class="btn" id="pwa-store">查看本地存储</button></div>
        </div>
        <div class="panel"><pre class="out" id="pwa-out" style="max-height:420px"></pre></div>
        <div class="panel"><div class="panel-head"><b>本地存储</b></div><div id="pwa-store-out" class="hint">点击“查看本地存储”</div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#pwa-check').onclick = () => {
      try {
        const m = JSON.parse($('#pwa-manifest').value);
        const issues = [];
        ['name', 'short_name', 'start_url', 'display', 'icons'].forEach((k) => { if (!m[k]) issues.push('缺少 ' + k); });
        if (m.display && !['standalone', 'fullscreen', 'minimal-ui', 'browser'].includes(m.display)) issues.push('display 值不常见');
        if (!m.icons?.some((i) => i.sizes?.includes('192'))) issues.push('建议提供 192×192 图标');
        if (!m.icons?.some((i) => i.sizes?.includes('512'))) issues.push('建议提供 512×512 图标');
        if (!m.theme_color) issues.push('缺少 theme_color');
        $('#pwa-out').textContent = issues.length ? issues.map((x) => '· ' + x).join('\n') : 'Manifest 基础字段完整。';
      } catch (e) { $('#pwa-out').textContent = 'JSON 解析失败：' + e.message; }
    };
    $('#pwa-cache').onclick = () => {
      $('#pwa-out').textContent = `const CACHE = 'app-v1';\nconst SHELL = ['./', './index.html', './assets/app.css', './assets/js/main.js'];\n\nself.addEventListener('install', (e) => {\n  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));\n});\n\nself.addEventListener('fetch', (e) => {\n  const req = e.request;\n  if (req.mode === 'navigate') {\n    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));\n    return;\n  }\n  e.respondWith(caches.match(req).then((r) => r || fetch(req)));\n});`;
    };
    $('#pwa-store').onclick = async () => {
      const rows = [];
      let lsSize = 0;
      for (const k in localStorage) if (Object.prototype.hasOwnProperty.call(localStorage, k)) { lsSize += localStorage[k].length * 2; rows.push(`localStorage · ${k} · ${fmtBytes(localStorage[k].length * 2)}`); }
      rows.unshift(`localStorage 合计：${fmtBytes(lsSize)}`);
      try { const keys = await caches.keys(); rows.push(`Cache Storage：${keys.join('、') || '空'}`); } catch { /* */ }
      try { const dbs = await indexedDB.databases(); rows.push(`IndexedDB：${dbs.map((d) => d.name).join('、') || '空'}`); } catch { /* */ }
      try { const e = await navigator.storage.estimate(); rows.push(`配额：${fmtBytes(e.quota)} · 已用 ${fmtBytes(e.usage)}`); } catch { /* */ }
      $('#pwa-store-out').innerHTML = rows.map(esc).join('<br>');
    };
  },

  /* ================= 性能 ================= */
  'perf-panel'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="row"><button class="btn primary" id="pf-timing">读取性能指标</button><button class="btn" id="pf-fps">测试帧率 5 秒</button><button class="btn" id="pf-mem">内存与存储</button><span class="hint" id="pf-status">就绪</span></div>
        </div>
        <div class="stat-grid" id="pf-stats"></div>
        <div class="panel"><div class="panel-head"><b>资源加载</b></div><div id="pf-res" class="table-scroll" style="max-height:320px"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#pf-timing').onclick = () => {
      const nav = performance.getEntriesByType('navigation')[0];
      if (!nav) return;
      $('#pf-stats').innerHTML = [
        ['DNS', (nav.domainLookupEnd - nav.domainLookupStart).toFixed(0) + ' ms'], ['TCP', (nav.connectEnd - nav.connectStart).toFixed(0) + ' ms'],
        ['TTFB', (nav.responseStart - nav.requestStart).toFixed(0) + ' ms'], ['DOM 解析', (nav.domContentLoadedEventEnd - nav.responseEnd).toFixed(0) + ' ms'],
        ['加载完成', (nav.loadEventEnd - nav.startTime).toFixed(0) + ' ms'], ['传输大小', fmtBytes(nav.transferSize || 0)]
      ].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
      const res = performance.getEntriesByType('resource').filter((r) => r.duration > 0).sort((a, b) => b.duration - a.duration).slice(0, 25);
      $('#pf-res').innerHTML = `<table class="tbl"><tr><th>资源</th><th>类型</th><th>耗时</th><th>大小</th></tr>${res.map((r) => `<tr><td class="mono" style="max-width:280px;overflow:hidden;text-overflow:ellipsis">${esc(r.name.split('/').pop())}</td><td>${r.initiatorType}</td><td>${r.duration.toFixed(0)} ms</td><td>${fmtBytes(r.transferSize || 0)}</td></tr>`).join('')}</table>`;
    };
    $('#pf-fps').onclick = () => {
      let frames = 0; const start = performance.now();
      $('#pf-status').textContent = '测试中…';
      const loop = (t) => {
        frames++;
        if (t - start < 5000) requestAnimationFrame(loop);
        else { const fps = frames / ((t - start) / 1000); $('#pf-status').textContent = `平均 ${fps.toFixed(1)} FPS`; $('#pf-stats').innerHTML = `<div class="stat"><b>${fps.toFixed(1)}</b><span>FPS</span></div><div class="stat"><b>${frames}</b><span>帧数</span></div>`; }
      };
      requestAnimationFrame(loop);
    };
    $('#pf-mem').onclick = async () => {
      const rows = [];
      if (performance.memory) rows.push(`JS 堆：${fmtBytes(performance.memory.usedJSHeapSize)} / ${fmtBytes(performance.memory.jsHeapSizeLimit)}`);
      try { const e = await navigator.storage.estimate(); rows.push(`存储：${fmtBytes(e.usage)} / ${fmtBytes(e.quota)}`); } catch { /* */ }
      rows.push(`硬件并发：${navigator.hardwareConcurrency || '未知'}`);
      $('#pf-stats').innerHTML = rows.map((r) => `<div class="stat"><b style="font-size:13px">${esc(r)}</b><span>信息</span></div>`).join('');
    };
    $('#pf-timing').click();
  }
};
