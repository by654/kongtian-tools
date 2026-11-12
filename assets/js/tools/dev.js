/* 开发者工具 */
import { esc, copy, toast, download, fmtBytes, readAs } from '../core/ui.js';
import { bindFileZone, fileZone, warn } from '../core/kit.js';

const enc = new TextEncoder();

function b64urlFromBytes(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function randInt(max) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % max;
}
function pick(arr) { return arr[randInt(arr.length)]; }
function pad(n, len = 2) { return String(n).padStart(len, '0'); }

/* 简易 cron */
function parseCronPart(part, min, max) {
  const set = new Set();
  const addRange = (a, b, step = 1) => { for (let i = a; i <= b; i += step) set.add(i); };
  for (const seg of part.split(',')) {
    const [range, stepStr] = seg.split('/');
    const step = stepStr ? Number(stepStr) : 1;
    if (!step || step < 1) throw new Error('步长无效');
    if (range === '*') addRange(min, max, step);
    else if (range.includes('-')) { const [a, b] = range.split('-').map(Number); addRange(a, b, step); }
    else { const n = Number(range); if (isNaN(n) || n < min || n > max) throw new Error('数值超出范围：' + range); set.add(n); }
  }
  return set;
}
function parseCron(expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error('需要 5 个字段：分 时 日 月 周');
  return {
    minute: parseCronPart(parts[0], 0, 59),
    hour: parseCronPart(parts[1], 0, 23),
    dom: parseCronPart(parts[2], 1, 31),
    month: parseCronPart(parts[3], 1, 12),
    dow: parseCronPart(parts[4], 0, 6)
  };
}
function nextRuns(expr, n = 8, from = new Date()) {
  const c = parseCron(expr);
  const out = [];
  const d = new Date(from.getTime());
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);
  for (let i = 0; i < 60 * 24 * 366 && out.length < n; i++) {
    if (c.minute.has(d.getMinutes()) && c.hour.has(d.getHours()) && c.month.has(d.getMonth() + 1) && c.dom.has(d.getDate()) && c.dow.has(d.getDay())) {
      out.push(new Date(d));
    }
    d.setMinutes(d.getMinutes() + 1);
  }
  return out;
}

/* 简单代码美化 */
function beautifyHTML(s) {
  const tokens = s.replace(/>\s*</g, '><').split(/(?=<)/);
  let depth = 0, out = '';
  for (const t of tokens) {
    if (!t.trim()) continue;
    if (/^<\//.test(t)) depth--;
    out += '  '.repeat(Math.max(0, depth)) + t.trim() + '\n';
    if (/^<[^!?/][^>]*[^/]>$/.test(t.trim()) && !/^<(br|hr|img|input|meta|link|source|area|base|col|embed|param|track|wbr)\b/i.test(t.trim())) depth++;
  }
  return out.trim();
}
function minifyHTML(s) {
  return s.replace(/<!--[\s\S]*?-->/g, '').replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ').trim();
}
function beautifyCSS(s) {
  return s.replace(/\s*{\s*/g, ' {\n  ').replace(/;\s*/g, ';\n  ').replace(/\s*}\s*/g, '\n}\n').replace(/\n\s*\n/g, '\n').replace(/  \n/g, '\n').trim();
}
function minifyCSS(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{}:;,>])\s*/g, '$1').replace(/;}/g, '}').trim();
}
function beautifySQL(s) {
  const kw = /\b(select|from|where|and|or|inner join|left join|right join|join|group by|order by|having|limit|insert into|values|update|set|delete from|create table|alter table|union all|union)\b/gi;
  return s.replace(/\s+/g, ' ').replace(kw, (m) => '\n' + m.toUpperCase()).replace(/^\n/, '').trim();
}
function minifySQL(s) { return s.replace(/\s+/g, ' ').replace(/\s*([(),;])\s*/g, '$1').trim(); }

/* JSONPath 简化实现 */
function jsonPathQuery(obj, path) {
  path = path.trim();
  if (!path || path === '$') return obj;
  if (path.startsWith('$')) path = path.slice(1);
  if (path.startsWith('..')) {
    const key = path.slice(2);
    const out = [];
    (function walk(v) {
      if (v && typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) {
          if (k === key) out.push(x);
          walk(x);
        }
      } else if (Array.isArray(v)) v.forEach(walk);
    })(obj);
    return out;
  }
  const tokens = [];
  path.replace(/\[(\d+)\]|\.?([A-Za-z0-9_$\u4e00-\u9fa5-]+)/g, (m, idx, key) => { tokens.push(idx !== undefined ? Number(idx) : key); return m; });
  let cur = obj;
  for (const t of tokens) {
    if (cur == null) return undefined;
    cur = cur[t];
  }
  return cur;
}

function treeHtml(v, key = '') {
  if (v === null) return `<div><span class="dim">${esc(key)}</span>: <span style="color:#f472b6">null</span></div>`;
  if (Array.isArray(v)) {
    return `<details open><summary><span class="dim">${esc(key)}</span> <span style="color:var(--acc)">[${v.length}]</span></summary><div style="padding-left:14px;border-left:1px solid var(--line)">${v.map((x, i) => treeHtml(x, String(i))).join('')}</div></details>`;
  }
  if (typeof v === 'object') {
    const keys = Object.keys(v);
    return `<details open><summary><span class="dim">${esc(key)}</span> <span style="color:var(--acc-2)">{${keys.length}}</span></summary><div style="padding-left:14px;border-left:1px solid var(--line)">${keys.map((k) => treeHtml(v[k], k)).join('')}</div></details>`;
  }
  const color = typeof v === 'string' ? '#6ee7b7' : typeof v === 'number' ? '#fbbf24' : '#c084fc';
  return `<div><span class="dim">${esc(key)}</span>: <span style="color:${color}">${esc(JSON.stringify(v))}</span></div>`;
}

/* 类型推断 */
function inferName(k) { return k.replace(/[^A-Za-z0-9_$\u4e00-\u9fa5]/g, '_') || 'Field'; }
function pascal(k) { const n = inferName(k); return n.charAt(0).toUpperCase() + n.slice(1); }
function infer(v, name, out) {
  if (Array.isArray(v)) {
    if (!v.length) return { ts: 'any[]', go: '[]any', java: 'List<Object>', py: 'List[Any]', cs: 'List<object>', rust: 'Vec<Value>' };
    return infer(v[0], name.slice(0, -1) || 'Item', out);
  }
  if (v === null) return { ts: 'null', go: 'any', java: 'Object', py: 'None', cs: 'object', rust: 'Value' };
  if (typeof v === 'string') return { ts: 'string', go: 'string', java: 'String', py: 'str', cs: 'string', rust: 'String' };
  if (typeof v === 'number') return Number.isInteger(v)
    ? { ts: 'number', go: 'int64', java: 'long', py: 'int', cs: 'long', rust: 'i64' }
    : { ts: 'number', go: 'float64', java: 'double', py: 'float', cs: 'double', rust: 'f64' };
  if (typeof v === 'boolean') return { ts: 'boolean', go: 'bool', java: 'boolean', py: 'bool', cs: 'bool', rust: 'bool' };
  const cls = pascal(name);
  const fields = Object.entries(v).map(([k, x]) => ({ name: inferName(k), type: infer(x, k, out) }));
  out.push({ name: cls, fields });
  return { ts: cls, go: '*' + cls, java: cls, py: cls, cs: cls, rust: cls };
}
function genCode(json, lang) {
  const out = [];
  const rootType = infer(json, 'Root', out);
  const all = [...out].reverse();
  if (lang === 'typescript') {
    return all.map((c) => `export interface ${c.name} {\n${c.fields.map((f) => `  ${f.name}: ${f.type.ts};`).join('\n')}\n}`).join('\n\n');
  }
  if (lang === 'go') {
    return all.map((c) => `type ${c.name} struct {\n${c.fields.map((f) => `\t${pascal(f.name)} ${f.type.go} \`json:"${f.name}"\``).join('\n')}\n}`).join('\n\n');
  }
  if (lang === 'java') {
    return all.map((c) => `public class ${c.name} {\n${c.fields.map((f) => `    private ${f.type.java} ${f.name};`).join('\n')}\n\n${c.fields.map((f) => `    public ${f.type.java} get${pascal(f.name)}() { return ${f.name}; }\n    public void set${pascal(f.name)}(${f.type.java} v) { this.${f.name} = v; }`).join('\n')}\n}`).join('\n\n');
  }
  if (lang === 'python') {
    return `from dataclasses import dataclass\nfrom typing import Any, List\n\n` + all.map((c) => `@dataclass\nclass ${c.name}:\n${c.fields.map((f) => `    ${f.name}: ${f.type.py}`).join('\n') || '    pass'}`).join('\n\n');
  }
  if (lang === 'csharp') {
    return all.map((c) => `public class ${c.name}\n{\n${c.fields.map((f) => `    public ${f.type.cs} ${pascal(f.name)} { get; set; }`).join('\n')}\n}`).join('\n\n');
  }
  return all.map((c) => `#[derive(Debug, Clone, Serialize, Deserialize)]\npub struct ${c.name} {\n${c.fields.map((f) => `    pub ${f.name}: ${f.type.rust},`).join('\n')}\n}`).join('\n\n');
}

export default {
  /* ================= JSON 工作台 ================= */
  'json-workbench'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>JSON 输入</b><span class="hint" id="jw-status">等待输入</span></div>
          <textarea class="ta mono" id="jw-in" rows="11" placeholder='{"name":"空天","tools":200}'></textarea>
          <div class="row" style="margin-top:10px">
            <button class="btn primary" id="jw-fmt">格式化</button>
            <button class="btn" id="jw-min">压缩</button>
            <button class="btn" id="jw-valid">校验</button>
            <button class="btn" id="jw-copy">复制</button>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><b>提取 / 查看</b><span class="hint">支持 $.a.b[0] 与 $..key</span></div>
          <div class="row">
            <input class="inp mono" id="jw-path" placeholder="$.data.items[0].name" style="flex:1;min-width:180px">
            <button class="btn" id="jw-query">JSONPath 提取</button>
            <button class="btn" id="jw-tree">树形查看</button>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b><span class="hint" id="jw-meta"></span></div><div id="jw-out"><pre class="out" style="margin:0"></pre></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const getObj = () => {
      try { const o = JSON.parse($('#jw-in').value); $('#jw-status').textContent = 'JSON 合法'; $('#jw-status').style.color = 'var(--ok)'; return o; }
      catch (e) { $('#jw-status').textContent = '错误：' + e.message; $('#jw-status').style.color = 'var(--err)'; throw e; }
    };
    const show = (text) => { $('#jw-out').innerHTML = `<pre class="out" style="margin:0">${esc(text)}</pre>`; };
    $('#jw-fmt').onclick = () => { try { show(JSON.stringify(getObj(), null, 2)); $('#jw-meta').textContent = '已格式化'; } catch { /* */ } };
    $('#jw-min').onclick = () => { try { const s = JSON.stringify(getObj()); show(s); $('#jw-meta').textContent = `压缩后 ${s.length} 字节`; } catch { /* */ } };
    $('#jw-valid').onclick = () => { try { const o = getObj(); show('JSON 合法 ✓\n类型：' + (Array.isArray(o) ? '数组' : typeof o)); } catch (e) { show('JSON 非法：' + e.message); } };
    $('#jw-copy').onclick = () => copy($('#jw-out').textContent);
    $('#jw-query').onclick = () => {
      try {
        const r = jsonPathQuery(getObj(), $('#jw-path').value);
        show(r === undefined ? '未找到匹配路径' : JSON.stringify(r, null, 2));
      } catch (e) { show('查询失败：' + e.message); }
    };
    $('#jw-tree').onclick = () => {
      try { $('#jw-out').innerHTML = `<div style="font-family:var(--mono);font-size:12px">${treeHtml(getObj(), 'root')}</div>`; }
      catch { /* */ }
    };
  },

  /* ================= JSON 转代码 ================= */
  'json-to-code'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>JSON 示例</b><span class="hint">根据结构生成类型定义</span></div>
          <textarea class="ta mono" id="jc-in" rows="9">{
  "id": 1,
  "name": "空天工具",
  "active": true,
  "tags": ["工具", "浏览器"],
  "owner": { "id": 2, "email": "hello@example.com" }
}</textarea>
          <div class="row" style="margin-top:10px">
            <select class="sel" id="jc-lang" style="max-width:180px">
              <option value="typescript">TypeScript</option><option value="go">Go</option><option value="java">Java</option>
              <option value="python">Python</option><option value="csharp">C#</option><option value="rust">Rust</option>
            </select>
            <button class="btn primary" id="jc-run">生成</button><button class="btn" id="jc-copy">复制</button>
            <button class="btn" id="jc-dl">下载</button>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>代码</b><span class="hint" id="jc-meta"></span></div><pre class="out" id="jc-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#jc-run').onclick = () => {
      try {
        const code = genCode(JSON.parse($('#jc-in').value), $('#jc-lang').value);
        $('#jc-out').textContent = code;
        $('#jc-meta').textContent = $('#jc-lang').value;
      } catch (e) { $('#jc-out').textContent = '生成失败：' + e.message; }
    };
    $('#jc-copy').onclick = () => copy($('#jc-out').textContent);
    $('#jc-dl').onclick = () => {
      const ext = { typescript: 'ts', go: 'go', java: 'java', python: 'py', csharp: 'cs', rust: 'rs' }[$('#jc-lang').value];
      download('types.' + ext, $('#jc-out').textContent, 'text/plain');
    };
    $('#jc-run').click();
  },

  /* ================= Mock 数据 ================= */
  'json-mock'(root) {
    const first = ['张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴'];
    const last = ['明', '华', '静', '强', '磊', '娜', '敏', '杰', '涛', '丽'];
    const words = ['空天', '浏览器', '工具', '效率', '设计', '数据', '编码', '图像', '音频', '云端'];
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>Mock 数据生成</b><span class="hint">用于前端联调与测试</span></div>
          <div class="grid4">
            <div class="field"><label class="lab">类型</label><select class="sel" id="jm-type">
              <option value="user">用户列表</option><option value="order">订单列表</option><option value="product">商品列表</option><option value="article">文章列表</option>
            </select></div>
            <div class="field"><label class="lab">数量</label><input class="inp" id="jm-count" type="number" value="10" min="1" max="200"></div>
            <div class="field"><label class="lab">格式</label><select class="sel" id="jm-format"><option value="json">JSON</option><option value="csv">CSV</option></select></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="jm-run" style="width:100%">生成</button></div>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b><div class="row"><button class="btn sm" id="jm-copy">复制</button><button class="btn sm" id="jm-dl">下载</button></div></div><pre class="out" id="jm-out" style="max-height:500px"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const rnd = (n) => Math.floor(Math.random() * n);
    const name = () => pick(first) + pick(last) + (Math.random() > 0.6 ? pick(last) : '');
    const date = (daysAgo) => new Date(Date.now() - rnd(daysAgo) * 864e5).toISOString().slice(0, 10);
    $('#jm-run').onclick = () => {
      const n = Math.max(1, Math.min(200, Number($('#jm-count').value) || 10));
      const type = $('#jm-type').value;
      const arr = Array.from({ length: n }, (_, i) => {
        if (type === 'user') return { id: 1000 + i, name: name(), email: `user${i + 1}@example.com`, age: 18 + rnd(40), city: pick(['北京', '上海', '深圳', '杭州', '成都']), active: Math.random() > 0.2, createdAt: date(365) };
        if (type === 'order') return { orderNo: 'KT' + Date.now().toString().slice(-6) + pad(i, 3), userId: 1000 + rnd(50), amount: +(Math.random() * 900 + 10).toFixed(2), status: pick(['pending', 'paid', 'shipped', 'done']), createdAt: date(90) };
        if (type === 'product') return { id: 'P' + pad(i + 1, 4), title: pick(words) + pick(['工具', '套装', '服务', '会员']), price: +(Math.random() * 500 + 9.9).toFixed(2), stock: rnd(500), tags: [pick(words), pick(words)], onSale: Math.random() > 0.15 };
        return { id: i + 1, title: pick(words) + '的' + pick(['实践', '指南', '思考', '笔记']), author: name(), views: rnd(10000), tags: [pick(words), pick(words)], publishedAt: date(200) };
      });
      if ($('#jm-format').value === 'csv') {
        const head = Object.keys(arr[0]);
        $('#jm-out').textContent = [head.join(','), ...arr.map((o) => head.map((k) => JSON.stringify(Array.isArray(o[k]) ? o[k].join('|') : o[k])).join(','))].join('\n');
      } else $('#jm-out').textContent = JSON.stringify(arr, null, 2);
    };
    $('#jm-copy').onclick = () => copy($('#jm-out').textContent);
    $('#jm-dl').onclick = () => download('mock.' + ($('#jm-format').value === 'csv' ? 'csv' : 'json'), $('#jm-out').textContent, 'text/plain');
    $('#jm-run').click();
  },

  /* ================= JWT ================= */
  'jwt-tool'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>JWT 解析</b><span class="hint">只解码，不验证签名；签名校验需服务端密钥</span></div>
          <textarea class="ta mono" id="jt-in" rows="6" placeholder="粘贴 JWT，例如 eyJhbGciOi..."></textarea>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="jt-run">解析</button><button class="btn" id="jt-copy">复制 JSON</button><span class="hint" id="jt-meta"></span></div>
        </div>
        <div class="grid2">
          <div class="panel"><div class="panel-head"><b>Header</b></div><pre class="out" id="jt-head"></pre></div>
          <div class="panel"><div class="panel-head"><b>Payload</b></div><pre class="out" id="jt-payload"></pre></div>
        </div>
        <div class="panel" id="jt-time"></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#jt-run').onclick = () => {
      try {
        const parts = $('#jt-in').value.trim().split('.');
        if (parts.length < 2) throw new Error('JWT 至少需要 Header 与 Payload 两段');
        const head = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[0])));
        const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])));
        $('#jt-head').textContent = JSON.stringify(head, null, 2);
        $('#jt-payload').textContent = JSON.stringify(payload, null, 2);
        $('#jt-meta').textContent = `算法 ${head.alg || '未知'}`;
        const now = Math.floor(Date.now() / 1000);
        const rows = [];
        if (payload.exp) rows.push(`<div class="kv"><dt>过期时间</dt><dd>${new Date(payload.exp * 1000).toLocaleString()} ${payload.exp < now ? '<span style="color:var(--err)">已过期</span>' : '<span style="color:var(--ok)">有效</span>'}</dd></div>`);
        if (payload.iat) rows.push(`<div class="kv"><dt>签发时间</dt><dd>${new Date(payload.iat * 1000).toLocaleString()}</dd></div>`);
        if (payload.nbf) rows.push(`<div class="kv"><dt>生效时间</dt><dd>${new Date(payload.nbf * 1000).toLocaleString()}</dd></div>`);
        $('#jt-time').innerHTML = rows.join('') || '<div class="hint">没有 exp / iat / nbf 声明</div>';
      } catch (e) {
        $('#jt-head').textContent = '';
        $('#jt-payload').textContent = '';
        $('#jt-time').innerHTML = `<div class="errbox">解析失败：${esc(e.message)}</div>`;
      }
    };
    $('#jt-copy').onclick = () => copy($('#jt-payload').textContent);
  },

  /* ================= 正则 ================= */
  'regex-test'(root) {
    const presets = [
      ['邮箱', '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}'],
      ['手机号', '1[3-9]\\d{9}'],
      ['URL', 'https?://[^\\s]+'],
      ['IPv4', '((25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(25[0-5]|2[0-4]\\d|1?\\d?\\d)'],
      ['日期', '\\d{4}-\\d{2}-\\d{2}'],
      ['中文', '[\\u4e00-\\u9fa5]+'],
      ['HTML 标签', '<([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*>.*?</\\1>'],
      ['密码强度', '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[^\\s]{8,}$']
    ];
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>正则测试</b><span class="hint">实时匹配与替换预览</span></div>
          <div class="row" style="margin-bottom:9px">
            <input class="inp mono" id="rt-pattern" value="\\b\\w+@\\w+\\.\\w+\\b" style="flex:1;min-width:200px" placeholder="正则表达式">
            <label class="row" style="gap:3px"><input type="checkbox" id="rt-g" checked> g</label>
            <label class="row" style="gap:3px"><input type="checkbox" id="rt-i"> i</label>
            <label class="row" style="gap:3px"><input type="checkbox" id="rt-m"> m</label>
            <label class="row" style="gap:3px"><input type="checkbox" id="rt-s"> s</label>
          </div>
          <div class="row" style="gap:5px;margin-bottom:9px">${presets.map(([n, p], i) => `<button class="chip" data-preset="${i}">${n}</button>`).join('')}</div>
          <textarea class="ta mono" id="rt-text" rows="7">联系我们：hello@example.com 或 support@kongtian.dev</textarea>
          <div class="field" style="margin-top:9px"><label class="lab">替换为（可选）</label><input class="inp mono" id="rt-rep" placeholder="替换内容，支持 $1 分组"></div>
        </div>
        <div class="panel"><div class="panel-head"><b>匹配结果</b><span class="hint" id="rt-count"></span></div><pre class="out" id="rt-out" style="max-height:300px"></pre></div>
        <div class="panel"><div class="panel-head"><b>替换预览</b></div><pre class="out" id="rt-replaced" style="max-height:240px"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const run = () => {
      const pat = $('#rt-pattern').value;
      const flags = ($('#rt-g').checked ? 'g' : '') + ($('#rt-i').checked ? 'i' : '') + ($('#rt-m').checked ? 'm' : '') + ($('#rt-s').checked ? 's' : '');
      const text = $('#rt-text').value;
      let re;
      try { re = new RegExp(pat, flags); }
      catch (e) { $('#rt-out').textContent = '正则错误：' + e.message; $('#rt-count').textContent = ''; return; }
      const matches = [...text.matchAll(re)];
      $('#rt-count').textContent = `${matches.length} 处匹配`;
      let html = '', last = 0;
      for (const m of matches) {
        html += esc(text.slice(last, m.index));
        html += `<mark style="background:rgba(56,205,240,.3);color:inherit">${esc(m[0])}</mark>`;
        last = m.index + m[0].length;
      }
      html += esc(text.slice(last));
      $('#rt-out').innerHTML = matches.length ? html : '<span class="dim">没有匹配</span>';
      const rep = $('#rt-rep').value;
      $('#rt-replaced').textContent = rep ? text.replace(re, rep) : '(输入替换内容后显示)';
    };
    ['#rt-pattern', '#rt-text', '#rt-rep'].forEach((s) => $(s).addEventListener('input', run));
    ['#rt-g', '#rt-i', '#rt-m', '#rt-s'].forEach((s) => $(s).addEventListener('change', run));
    root.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
      $('#rt-pattern').value = presets[Number(b.dataset.preset)][1];
      run();
    }));
    run();
  },

  /* ================= 哈希 ================= */
  'hash-tool'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>哈希与 HMAC</b><span class="hint">使用 CryptoJS，本地计算</span></div>
          <textarea class="ta mono" id="ht-in" rows="6" placeholder="输入要计算哈希的文本…"></textarea>
          <div class="grid2" style="margin-top:9px">
            <div class="field"><label class="lab">算法</label>
              <div class="row" style="gap:10px;height:38px">
                <label class="row" style="gap:3px"><input type="checkbox" class="ht-alg" value="MD5" checked> MD5</label>
                <label class="row" style="gap:3px"><input type="checkbox" class="ht-alg" value="SHA1" checked> SHA-1</label>
                <label class="row" style="gap:3px"><input type="checkbox" class="ht-alg" value="SHA256" checked> SHA-256</label>
                <label class="row" style="gap:3px"><input type="checkbox" class="ht-alg" value="SHA512"> SHA-512</label>
              </div></div>
            <div class="field"><label class="lab">HMAC 密钥（可选）</label><input class="inp mono" id="ht-key" placeholder="留空则不算 HMAC"></div>
          </div>
          <div class="row" style="margin-top:9px"><button class="btn primary" id="ht-run">计算</button><button class="btn" id="ht-copy">复制全部</button></div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b><span class="hint" id="ht-meta"></span></div><pre class="out" id="ht-out"></pre></div>
        <div class="panel">
          <div class="panel-head"><b>文件哈希</b><span class="hint">用于校验文件完整性</span></div>
          ${fileZone('ht-zone', { label: '选择文件计算哈希' })}
          <pre class="out" id="ht-file" style="margin-top:10px"></pre>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const ensure = async () => {
      await ctx.deps(['cryptojs']);
      if (!window.CryptoJS) throw new Error('CryptoJS 未加载');
      return window.CryptoJS;
    };
    $('#ht-run').onclick = async () => {
      try {
        const C = await ensure();
        const text = $('#ht-in').value;
        const key = $('#ht-key').value;
        const algs = [...root.querySelectorAll('.ht-alg:checked')].map((x) => x.value);
        if (!algs.length) return toast('至少选择一种算法', 'err');
        const lines = [];
        for (const a of algs) {
          const h = key ? C['Hmac' + a](text, key).toString() : C[a](text).toString();
          lines.push(`${a.padEnd(7)} ${h}`);
        }
        $('#ht-out').textContent = lines.join('\n');
        $('#ht-meta').textContent = `${new TextEncoder().encode(text).length} 字节`;
      } catch (e) { $('#ht-out').textContent = '失败：' + e.message; }
    };
    $('#ht-copy').onclick = () => copy($('#ht-out').textContent);
    bindFileZone(root, 'ht-zone', async (files) => {
      const f = files[0];
      try {
        const C = await ensure();
        const buf = await readAs(f, 'arraybuffer');
        const u8 = new Uint8Array(buf);
        const word = [];
        for (let i = 0; i < u8.length; i += 4) word.push((u8[i] << 24) | ((u8[i + 1] || 0) << 16) | ((u8[i + 2] || 0) << 8) | (u8[i + 3] || 0));
        const wa = C.lib.WordArray.create(word, u8.length);
        $('#ht-file').textContent = `${f.name} · ${fmtBytes(f.size)}\nMD5    ${C.MD5(wa).toString()}\nSHA256 ${C.SHA256(wa).toString()}`;
      } catch (e) { $('#ht-file').textContent = '失败：' + e.message; }
    });
  },

  /* ================= UUID ================= */
  'uuid-tool'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>唯一 ID 生成</b><span class="hint">批量生成，使用加密随机数</span></div>
          <div class="grid3">
            <div class="field"><label class="lab">类型</label><select class="sel" id="ut-type">
              <option value="uuid">UUID v4</option><option value="ulid">ULID</option><option value="nano">NanoID (21)</option><option value="short">短 ID (8)</option>
            </select></div>
            <div class="field"><label class="lab">数量</label><input class="inp" id="ut-count" type="number" value="10" min="1" max="500"></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="ut-run" style="width:100%">生成</button></div>
          </div>
          <div class="row" style="margin-top:9px"><label class="row" style="gap:5px"><input type="checkbox" id="ut-upper"> 大写</label><label class="row" style="gap:5px"><input type="checkbox" id="ut-dash" checked> 保留连字符</label></div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b><button class="btn sm" id="ut-copy">复制</button></div><pre class="out" id="ut-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const nano = (n) => {
      const chars = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';
      let s = '';
      const a = new Uint8Array(n); crypto.getRandomValues(a);
      for (const b of a) s += chars[b & 63];
      return s;
    };
    const ulid = () => {
      const t = Date.now().toString(32).toUpperCase().padStart(10, '0');
      const chars = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
      let r = '';
      const a = new Uint8Array(16); crypto.getRandomValues(a);
      for (const b of a) r += chars[b & 31];
      return (t + r).slice(0, 26);
    };
    $('#ut-run').onclick = () => {
      const n = Math.max(1, Math.min(500, Number($('#ut-count').value) || 10));
      const type = $('#ut-type').value;
      const list = Array.from({ length: n }, () => {
        let id;
        if (type === 'uuid') id = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = randInt(16); return (c === 'x' ? r : (r & 3) | 8).toString(16); });
        else if (type === 'ulid') id = ulid();
        else if (type === 'nano') id = nano(21);
        else id = nano(8);
        if (!$('#ut-dash').checked) id = id.replace(/-/g, '');
        return $('#ut-upper').checked ? id.toUpperCase() : id;
      });
      $('#ut-out').textContent = list.join('\n');
    };
    $('#ut-copy').onclick = () => copy($('#ut-out').textContent);
    $('#ut-run').click();
  },

  /* ================= 密码 ================= */
  'password-tool'(root) {
    const words = ['orbit', 'lunar', 'solar', 'cloud', 'river', 'stone', 'light', 'tiger', 'eagle', 'ocean', 'forest', 'rocket', 'signal', 'matrix', 'pixel', 'quiet', 'brave', 'cobalt', 'amber', 'north', 'swift', 'vivid', 'delta', 'gamma', 'ember', 'frost', 'glide', 'haven', 'indigo', 'jade'];
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="pw-tabs"><button class="tab active" data-i="0">随机密码</button><button class="tab" data-i="1">密码短语</button></div>
        <div class="panel" id="pw-p0">
          <div class="grid3">
            <div class="field"><label class="lab">长度 <span id="pw-len-v">16</span></label><input type="range" id="pw-len" min="6" max="64" value="16"></div>
            <div class="field"><label class="lab">数量</label><input class="inp" id="pw-count" type="number" value="3" min="1" max="50"></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="pw-run" style="width:100%">生成</button></div>
          </div>
          <div class="row" style="margin-top:10px;gap:12px">
            <label class="row" style="gap:4px"><input type="checkbox" id="pw-upper" checked> 大写</label>
            <label class="row" style="gap:4px"><input type="checkbox" id="pw-lower" checked> 小写</label>
            <label class="row" style="gap:4px"><input type="checkbox" id="pw-digit" checked> 数字</label>
            <label class="row" style="gap:4px"><input type="checkbox" id="pw-symbol" checked> 符号</label>
            <label class="row" style="gap:4px"><input type="checkbox" id="pw-noamb"> 排除易混淆</label>
          </div>
        </div>
        <div class="panel hidden" id="pw-p1">
          <div class="grid3">
            <div class="field"><label class="lab">单词数</label><input class="inp" id="pw-words" type="number" value="4" min="2" max="10"></div>
            <div class="field"><label class="lab">分隔符</label><input class="inp" id="pw-sep" value="-"></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="pw-run2" style="width:100%">生成</button></div>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b><span class="hint" id="pw-meta"></span></div><pre class="out" id="pw-out"></pre><div id="pw-strength" style="margin-top:10px"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#pw-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#pw-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      $('#pw-p0').classList.toggle('hidden', b.dataset.i !== '0');
      $('#pw-p1').classList.toggle('hidden', b.dataset.i !== '1');
    });
    $('#pw-len').oninput = () => { $('#pw-len-v').textContent = $('#pw-len').value; };
    const gen = () => {
      let upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', lower = 'abcdefghijklmnopqrstuvwxyz', digit = '0123456789', symbol = '!@#$%^&*()-_=+[]{};:,.<>?';
      if ($('#pw-noamb').checked) { upper = upper.replace(/[IO]/g, ''); lower = lower.replace(/[l]/g, ''); digit = digit.replace(/[01]/g, ''); }
      let pool = '', must = [];
      if ($('#pw-upper').checked) { pool += upper; must.push(upper); }
      if ($('#pw-lower').checked) { pool += lower; must.push(lower); }
      if ($('#pw-digit').checked) { pool += digit; must.push(digit); }
      if ($('#pw-symbol').checked) { pool += symbol; must.push(symbol); }
      if (!pool) pool = lower;
      const len = Number($('#pw-len').value);
      const n = Math.max(1, Math.min(50, Number($('#pw-count').value) || 3));
      const list = [];
      for (let k = 0; k < n; k++) {
        const arr = must.map((set) => set[randInt(set.length)]);
        while (arr.length < len) arr.push(pool[randInt(pool.length)]);
        for (let i = arr.length - 1; i > 0; i--) { const j = randInt(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; }
        list.push(arr.join(''));
      }
      $('#pw-out').textContent = list.join('\n');
      const entropy = Math.round(len * Math.log2(pool.length));
      const score = Math.min(100, Math.round(entropy * 1.25));
      $('#pw-meta').textContent = `约 ${entropy} bit 熵`;
      $('#pw-strength').innerHTML = `<div class="progress"><i style="width:${score}%;background:${score > 75 ? 'linear-gradient(90deg,#34d399,#22d3ee)' : score > 45 ? 'var(--warn)' : 'var(--err)'}"></i></div><div class="hint" style="margin-top:4px">强度 ${score}/100 · ${score > 75 ? '很强' : score > 45 ? '中等' : '较弱'}</div>`;
    };
    $('#pw-run').onclick = gen;
    $('#pw-run2').onclick = () => {
      const n = Math.max(2, Math.min(10, Number($('#pw-words').value) || 4));
      const sep = $('#pw-sep').value;
      const list = Array.from({ length: 3 }, () => Array.from({ length: n }, () => pick(words)).join(sep) + sep + randInt(100));
      $('#pw-out').textContent = list.join('\n');
      $('#pw-meta').textContent = `${n} 个单词`;
      $('#pw-strength').innerHTML = '';
    };
    gen();
  },

  /* ================= TOTP ================= */
  'totp-tool'(root, ctx) {
    const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const base32Decode = (s) => {
      s = s.replace(/[\s=]/g, '').toUpperCase();
      let bits = 0, val = 0; const out = [];
      for (const c of s) {
        const i = B32.indexOf(c); if (i < 0) throw new Error('非法 Base32 密钥');
        val = (val << 5) | i; bits += 5;
        if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
      }
      return Uint8Array.from(out);
    };
    const hmac = async (key, msg) => {
      const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
      return new Uint8Array(await crypto.subtle.sign('HMAC', k, msg));
    };
    const hotp = async (key, counter, digits = 6) => {
      const buf = new ArrayBuffer(8);
      const view = new DataView(buf);
      view.setUint32(4, counter >>> 0);
      const h = await hmac(key, new Uint8Array(buf));
      const off = h[h.length - 1] & 15;
      const code = ((h[off] & 127) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
      return String(code % 10 ** digits).padStart(digits, '0');
    };
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>TOTP / HOTP</b><span class="hint">本地计算，可配合任意验证器</span></div>
          <div class="grid3">
            <div class="field"><label class="lab">Base32 密钥</label><input class="inp mono" id="tt-secret" value="JBSWY3DPEHPK3PXP"></div>
            <div class="field"><label class="lab">位数</label><select class="sel" id="tt-digits"><option value="6">6 位</option><option value="8">8 位</option></select></div>
            <div class="field"><label class="lab">周期（秒）</label><input class="inp" id="tt-period" type="number" value="30"></div>
          </div>
          <div class="row" style="margin-top:10px">
            <button class="btn primary" id="tt-run">生成当前口令</button>
            <button class="btn" id="tt-qr">生成二维码</button>
            <span class="hint" id="tt-meta"></span>
          </div>
          <div class="center" style="margin-top:14px"><div id="tt-code" style="font-size:42px;letter-spacing:8px;font-family:var(--mono);font-weight:700;color:var(--acc)">------</div><div class="hint" id="tt-left"></div></div>
          <div class="canvas-wrap" id="tt-qrbox" style="margin-top:12px;display:none"></div>
        </div>
        <div class="panel">
          <div class="panel-head"><b>验证口令</b></div>
          <div class="row"><input class="inp mono" id="tt-check" placeholder="输入 6 位口令" style="max-width:220px"><button class="btn" id="tt-verify">验证</button><span class="hint" id="tt-result"></span></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let current = '';
    const update = async () => {
      try {
        const key = base32Decode($('#tt-secret').value);
        const digits = Number($('#tt-digits').value);
        const period = Math.max(10, Number($('#tt-period').value) || 30);
        const counter = Math.floor(Date.now() / 1000 / period);
        current = await hotp(key, counter, digits);
        $('#tt-code').textContent = current.slice(0, 3) + ' ' + current.slice(3);
        $('#tt-meta').textContent = `更新于 ${new Date().toLocaleTimeString()}`;
      } catch (e) { $('#tt-code').textContent = 'ERROR'; $('#tt-meta').textContent = e.message; }
    };
    const tick = () => {
      const period = Math.max(10, Number($('#tt-period').value) || 30);
      $('#tt-left').textContent = `${period - (Math.floor(Date.now() / 1000) % period)} 秒后刷新`;
    };
    $('#tt-run').onclick = () => { update(); tick(); };
    $('#tt-verify').onclick = () => {
      $('#tt-result').textContent = $('#tt-check').value.replace(/\s/g, '') === current ? '✓ 口令正确' : '✗ 口令不匹配';
      $('#tt-result').style.color = $('#tt-check').value.replace(/\s/g, '') === current ? 'var(--ok)' : 'var(--err)';
    };
    $('#tt-qr').onclick = async () => {
      try {
        await ctx.deps(['qrcode']);
        const label = 'kongtian';
        const uri = `otpauth://totp/${label}?secret=${$('#tt-secret').value}&issuer=${label}&digits=${$('#tt-digits').value}&period=${$('#tt-period').value}`;
        const qr = window.qrcode(0, 'M');
        qr.addData(uri);
        qr.make();
        $('#tt-qrbox').style.display = 'block';
        $('#tt-qrbox').innerHTML = qr.createSvgTag({ cellSize: 5, margin: 4 });
      } catch (e) { toast(e.message, 'err'); }
    };
    const timer = setInterval(() => { tick(); if (Number($('#tt-period').value) && Math.floor(Date.now() / 1000) % Number($('#tt-period').value) === 0) update(); }, 1000);
    ctx.onDestroy(() => clearInterval(timer));
    update(); tick();
  },

  /* ================= 代码格式化 ================= */
  'code-format'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>代码格式化</b><span class="hint">轻量格式化，复杂代码建议使用 Prettier</span></div>
          <textarea class="ta mono" id="cf-in" rows="10" placeholder="粘贴代码…"></textarea>
          <div class="row" style="margin-top:10px">
            <select class="sel" id="cf-lang" style="max-width:150px"><option value="json">JSON</option><option value="html">HTML</option><option value="css">CSS</option><option value="sql">SQL</option><option value="xml">XML</option><option value="js">JavaScript</option></select>
            <button class="btn primary" id="cf-beauty">美化</button>
            <button class="btn" id="cf-min">压缩</button>
            <button class="btn" id="cf-copy">复制</button>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b><span class="hint" id="cf-meta"></span></div><pre class="out" id="cf-out" style="max-height:480px"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const run = (min) => {
      const s = $('#cf-in').value;
      const lang = $('#cf-lang').value;
      try {
        let out;
        if (lang === 'json') out = min ? JSON.stringify(JSON.parse(s)) : JSON.stringify(JSON.parse(s), null, 2);
        else if (lang === 'html') out = min ? minifyHTML(s) : beautifyHTML(s);
        else if (lang === 'css') out = min ? minifyCSS(s) : beautifyCSS(s);
        else if (lang === 'sql') out = min ? minifySQL(s) : beautifySQL(s);
        else if (lang === 'xml') {
          const doc = new DOMParser().parseFromString(s, 'application/xml');
          if (doc.querySelector('parsererror')) throw new Error('XML 格式错误');
          out = new XMLSerializer().serializeToString(doc);
          if (!min) out = beautifyHTML(out);
          else out = out.replace(/>\s+</g, '><');
        } else {
          out = min ? s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ').replace(/\s*([{};:,()])\s*/g, '$1').trim() : s.replace(/;\s*/g, ';\n').replace(/\{\s*/g, ' {\n  ').replace(/\}\s*/g, '\n}\n').replace(/\n\s*\n/g, '\n').trim();
        }
        $('#cf-out').textContent = out;
        $('#cf-meta').textContent = min ? '已压缩' : '已美化';
      } catch (e) { $('#cf-out').textContent = '失败：' + e.message; }
    };
    $('#cf-beauty').onclick = () => run(false);
    $('#cf-min').onclick = () => run(true);
    $('#cf-copy').onclick = () => copy($('#cf-out').textContent);
  },

  /* ================= Markdown 编辑器 ================= */
  'markdown-editor'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="row" style="justify-content:space-between">
          <div class="hint">左侧编辑，右侧实时预览</div>
          <div class="row"><button class="btn sm" id="me-html">导出 HTML</button><button class="btn sm" id="me-md">复制 Markdown</button><button class="btn sm" id="me-toc">插入目录</button></div>
        </div>
        <div class="grid2 stack">
          <div class="panel" style="padding:10px"><textarea class="ta mono" id="me-in" rows="20" style="border:0;background:transparent;padding:4px"># 空天工具合集

一个**纯前端**工具箱，所有文件都在本地处理。

## 为什么

- 打开即用，无需安装
- 文件不上传
- 手机与电脑体验一致

> 依赖只在打开工具时下载。

\`\`\`js
const tools = 200;
console.log(tools);
\`\`\`

| 分类 | 数量 |
| --- | --- |
| 文本 | 17 |
| 图片 | 14 |
</textarea></div>
          <div class="panel" style="padding:10px"><div id="me-preview" class="md-body" style="min-height:420px;max-height:640px;overflow:auto;padding:4px 10px"></div></div>
        </div>
      </div>
      <style>
        .md-body h1,.md-body h2,.md-body h3{line-height:1.3;margin:1em 0 .5em}
        .md-body h1{font-size:1.6em;border-bottom:1px solid var(--line);padding-bottom:.3em}
        .md-body h2{font-size:1.3em}
        .md-body p{margin:.6em 0}
        .md-body code{background:rgba(255,255,255,.08);padding:1px 5px;border-radius:4px;font-family:var(--mono);font-size:.9em}
        .md-body pre{background:rgba(0,0,0,.3);padding:12px;border-radius:8px;overflow:auto}
        .md-body pre code{background:none;padding:0}
        .md-body blockquote{border-left:3px solid var(--acc);margin:.8em 0;padding:.2em 12px;color:var(--muted)}
        .md-body table{border-collapse:collapse;width:100%;margin:.8em 0}
        .md-body th,.md-body td{border:1px solid var(--line);padding:6px 10px;text-align:left}
        .md-body img{max-width:100%}
        .md-body a{color:var(--acc);text-decoration:underline}
        .md-body ul,.md-body ol{padding-left:1.4em}
      </style>`;
    const $ = (s) => root.querySelector(s);
    let ready = false;
    const render = async () => {
      if (!ready) return;
      const md = window.marked.parse($('#me-in').value, { gfm: true, breaks: true });
      $('#me-preview').innerHTML = window.DOMPurify.sanitize(md);
    };
    ctx.deps(['marked', 'dompurify']).then(() => {
      ready = true;
      const input = $('#me-in');
      input.addEventListener('input', render);
      render();
    });
    $('#me-html').onclick = () => {
      const body = $('#me-preview').innerHTML;
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Markdown 导出</title><style>body{max-width:820px;margin:40px auto;padding:0 20px;font-family:-apple-system,"PingFang SC",sans-serif;line-height:1.7;color:#1f2937}pre{background:#f3f4f6;padding:12px;border-radius:8px;overflow:auto}code{background:#f3f4f6;padding:1px 5px;border-radius:4px}table{border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px 10px}blockquote{border-left:3px solid #38bdf8;margin:0;padding-left:12px;color:#555}</style></head><body>${body}</body></html>`;
      download('markdown.html', html, 'text/html');
    };
    $('#me-md').onclick = () => copy($('#me-in').value);
    $('#me-toc').onclick = () => {
      const heads = [...$('#me-preview').querySelectorAll('h1,h2,h3')];
      const toc = heads.map((h) => `${'  '.repeat(Number(h.tagName[1]) - 1)}- [${h.textContent}](#${h.textContent.toLowerCase().replace(/\s+/g, '-')})`).join('\n');
      const ta = $('#me-in');
      ta.value = '## 目录\n\n' + toc + '\n\n' + ta.value;
      render();
    };
  },

  /* ================= Markdown 转换 ================= */
  'markdown-convert'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>Markdown / HTML 转换</b><span class="hint">HTML 转 Markdown 为基础转换</span></div>
          <textarea class="ta mono" id="mc-in" rows="9"># 标题

这是 **粗体** 和 *斜体*，以及 [链接](https://example.com)。

- 列表一
- 列表二</textarea>
          <div class="row" style="margin-top:10px">
            <select class="sel" id="mc-mode" style="max-width:220px">
              <option value="md2html">Markdown → HTML</option><option value="md2text">Markdown → 纯文本</option>
              <option value="html2md">HTML → Markdown</option><option value="toc">生成目录</option>
            </select>
            <button class="btn primary" id="mc-run">转换</button><button class="btn" id="mc-copy">复制</button>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b><span class="hint" id="mc-meta"></span></div><pre class="out" id="mc-out" style="max-height:480px"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const html2md = (html) => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const walk = (node) => {
        if (node.nodeType === 3) return node.nodeValue.replace(/\s+/g, ' ');
        if (node.nodeType !== 1) return '';
        const inner = [...node.childNodes].map(walk).join('');
        const tag = node.tagName.toLowerCase();
        if (/^h[1-6]$/.test(tag)) return '\n' + '#'.repeat(Number(tag[1])) + ' ' + inner.trim() + '\n';
        if (tag === 'p') return '\n' + inner.trim() + '\n';
        if (tag === 'br') return '  \n';
        if (tag === 'strong' || tag === 'b') return `**${inner}**`;
        if (tag === 'em' || tag === 'i') return `*${inner}*`;
        if (tag === 'code') return node.closest('pre') ? inner : '`' + inner + '`';
        if (tag === 'pre') return '\n```\n' + node.textContent + '\n```\n';
        if (tag === 'a') return `[${inner}](${node.getAttribute('href') || ''})`;
        if (tag === 'img') return `![${node.getAttribute('alt') || ''}](${node.getAttribute('src') || ''})`;
        if (tag === 'li') return '\n- ' + inner.trim();
        if (tag === 'ul' || tag === 'ol') return '\n' + inner + '\n';
        if (tag === 'blockquote') return '\n> ' + inner.trim().replace(/\n/g, '\n> ') + '\n';
        if (tag === 'hr') return '\n---\n';
        if (tag === 'table') {
          const rows = [...node.querySelectorAll('tr')].map((tr) => '| ' + [...tr.children].map((td) => td.textContent.trim()).join(' | ') + ' |');
          if (rows.length) rows.splice(1, 0, '| ' + [...node.querySelectorAll('tr')[0].children].map(() => '---').join(' | ') + ' |');
          return '\n' + rows.join('\n') + '\n';
        }
        return inner;
      };
      return walk(doc.body).replace(/\n{3,}/g, '\n\n').trim();
    };
    $('#mc-run').onclick = async () => {
      const s = $('#mc-in').value;
      const mode = $('#mc-mode').value;
      try {
        if (mode === 'html2md') { $('#mc-out').textContent = html2md(s); $('#mc-meta').textContent = 'HTML → Markdown'; return; }
        await ctx.deps(['marked']);
        if (mode === 'md2html') { $('#mc-out').textContent = window.marked.parse(s); $('#mc-meta').textContent = 'Markdown → HTML'; }
        else if (mode === 'md2text') {
          const html = window.marked.parse(s);
          const d = document.createElement('div'); d.innerHTML = html;
          $('#mc-out').textContent = d.textContent.replace(/\n{3,}/g, '\n\n').trim();
          $('#mc-meta').textContent = 'Markdown → 纯文本';
        } else {
          const d = document.createElement('div'); d.innerHTML = window.marked.parse(s);
          const heads = [...d.querySelectorAll('h1,h2,h3,h4')];
          $('#mc-out').textContent = heads.map((h) => `${'  '.repeat(Number(h.tagName[1]) - 1)}- [${h.textContent}](#${h.textContent.trim().toLowerCase().replace(/\s+/g, '-')})`).join('\n');
          $('#mc-meta').textContent = `${heads.length} 个标题`;
        }
      } catch (e) { $('#mc-out').textContent = '失败：' + e.message; }
    };
    $('#mc-copy').onclick = () => copy($('#mc-out').textContent);
  },

  /* ================= 开发模板 ================= */
  'codegen'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>开发模板生成</b><span class="hint">常用项目文件一键生成</span></div>
          <div class="grid3">
            <div class="field"><label class="lab">模板</label><select class="sel" id="cg-type">
              <option value="gitignore">.gitignore</option><option value="mit">MIT LICENSE</option><option value="readme">README.md</option>
              <option value="docker">Dockerfile</option><option value="compose">docker-compose.yml</option><option value="nginx">nginx.conf</option>
            </select></div>
            <div class="field"><label class="lab">项目名</label><input class="inp" id="cg-name" value="my-project"></div>
            <div class="field"><label class="lab">作者 / 年份</label><input class="inp" id="cg-author" value="kongtian"></div>
          </div>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="cg-run">生成</button><button class="btn" id="cg-copy">复制</button><button class="btn" id="cg-dl">下载</button></div>
        </div>
        <div class="panel"><div class="panel-head"><b>内容</b><span class="hint" id="cg-meta"></span></div><pre class="out" id="cg-out" style="max-height:520px"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const gen = () => {
      const type = $('#cg-type').value;
      const name = $('#cg-name').value || 'my-project';
      const author = $('#cg-author').value || 'author';
      const year = new Date().getFullYear();
      if (type === 'gitignore') return `node_modules/\ndist/\nbuild/\n.env\n.env.local\n*.log\n.DS_Store\ncoverage/\n.vscode/\n.idea/\n`;
      if (type === 'mit') return `MIT License\n\nCopyright (c) ${year} ${author}\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n`;
      if (type === 'readme') return `# ${name}\n\n一个轻量、实用的项目。\n\n## 功能\n\n- 功能一\n- 功能二\n\n## 快速开始\n\n\`\`\`bash\ngit clone <repo-url>\ncd ${name}\n\`\`\`\n\n## 技术栈\n\n- 原生 HTML / CSS / JavaScript\n\n## License\n\nMIT © ${author}\n`;
      if (type === 'docker') return `FROM node:20-alpine AS build\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\n\nFROM nginx:alpine\nCOPY --from=build /app/dist /usr/share/nginx/html\nEXPOSE 80\nCMD ["nginx", "-g", "daemon off;"]\n`;
      if (type === 'compose') return `services:\n  ${name}:\n    build: .\n    ports:\n      - "8080:80"\n    restart: unless-stopped\n`;
      return `server {\n  listen 80;\n  server_name ${name}.local;\n  root /usr/share/nginx/html;\n  index index.html;\n\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n\n  gzip on;\n  gzip_types text/css application/javascript application/json image/svg+xml;\n}\n`;
    };
    $('#cg-run').onclick = () => { $('#cg-out').textContent = gen(); $('#cg-meta').textContent = $('#cg-type').value; };
    $('#cg-copy').onclick = () => copy($('#cg-out').textContent);
    $('#cg-dl').onclick = () => download($('#cg-type').value === 'mit' ? 'LICENSE' : $('#cg-type').value === 'readme' ? 'README.md' : $('#cg-type').value, $('#cg-out').textContent, 'text/plain');
    $('#cg-run').click();
  },

  /* ================= HTTP 信息 ================= */
  'http-info'(root) {
    const status = {
      200: 'OK 请求成功', 201: 'Created 已创建', 202: 'Accepted 已接受', 204: 'No Content 无内容', 206: 'Partial Content 部分内容',
      301: 'Moved Permanently 永久重定向', 302: 'Found 临时重定向', 304: 'Not Modified 未修改', 307: 'Temporary Redirect 临时重定向', 308: 'Permanent Redirect 永久重定向',
      400: 'Bad Request 请求错误', 401: 'Unauthorized 未认证', 403: 'Forbidden 禁止访问', 404: 'Not Found 未找到', 405: 'Method Not Allowed 方法不允许',
      406: 'Not Acceptable 不可接受', 408: 'Request Timeout 请求超时', 409: 'Conflict 冲突', 410: 'Gone 已删除', 413: 'Payload Too Large 负载过大',
      415: 'Unsupported Media Type 媒体类型不支持', 418: "I'm a teapot 我是茶壶", 422: 'Unprocessable Entity 无法处理', 429: 'Too Many Requests 请求过多',
      500: 'Internal Server Error 服务器错误', 501: 'Not Implemented 未实现', 502: 'Bad Gateway 网关错误', 503: 'Service Unavailable 服务不可用', 504: 'Gateway Timeout 网关超时'
    };
    const mimes = [
      ['text/html', 'HTML 页面'], ['text/css', 'CSS 样式'], ['text/plain', '纯文本'], ['text/markdown', 'Markdown'],
      ['application/json', 'JSON 数据'], ['application/xml', 'XML 数据'], ['application/javascript', 'JavaScript'],
      ['application/pdf', 'PDF 文档'], ['application/zip', 'ZIP 压缩包'], ['application/wasm', 'WebAssembly'],
      ['image/png', 'PNG 图片'], ['image/jpeg', 'JPEG 图片'], ['image/webp', 'WebP 图片'], ['image/svg+xml', 'SVG 矢量图'], ['image/gif', 'GIF 图片'],
      ['audio/mpeg', 'MP3 音频'], ['audio/ogg', 'OGG 音频'], ['audio/wav', 'WAV 音频'], ['video/mp4', 'MP4 视频'], ['video/webm', 'WebM 视频'],
      ['font/woff2', 'WOFF2 字体'], ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Excel xlsx'],
      ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Word docx'],
      ['multipart/form-data', '表单上传'], ['application/x-www-form-urlencoded', '表单编码']
    ];
    const ports = [[21, 'FTP'], [22, 'SSH'], [23, 'Telnet'], [25, 'SMTP'], [53, 'DNS'], [80, 'HTTP'], [110, 'POP3'], [143, 'IMAP'], [443, 'HTTPS'], [465, 'SMTPS'], [587, 'SMTP 提交'], [993, 'IMAPS'], [995, 'POP3S'], [1433, 'SQL Server'], [1521, 'Oracle'], [3306, 'MySQL'], [3389, '远程桌面'], [5432, 'PostgreSQL'], [6379, 'Redis'], [8080, 'HTTP 备用'], [8443, 'HTTPS 备用'], [27017, 'MongoDB']];
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="hi-tabs">
          <button class="tab active" data-i="0">HTTP 状态码</button><button class="tab" data-i="1">MIME 类型</button>
          <button class="tab" data-i="2">User-Agent</button><button class="tab" data-i="3">常用端口</button>
        </div>
        <div class="panel">
          <input class="inp" id="hi-search" placeholder="输入关键词过滤，例如 404、json、image、mysql…">
        </div>
        <div class="panel" id="hi-body" style="max-height:520px;overflow:auto"></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let tab = 0;
    const paint = () => {
      const q = $('#hi-search').value.trim().toLowerCase();
      let html = '';
      if (tab === 0) {
        html = Object.entries(status).filter(([k, v]) => !q || k.includes(q) || v.toLowerCase().includes(q))
          .map(([k, v]) => `<div class="row between" style="border-bottom:1px solid var(--line);padding:7px 0"><b class="mono" style="color:var(--acc)">${k}</b><span class="hint">${esc(v)}</span></div>`).join('');
      } else if (tab === 1) {
        html = mimes.filter(([k, v]) => !q || k.includes(q) || v.toLowerCase().includes(q))
          .map(([k, v]) => `<div class="row between" style="border-bottom:1px solid var(--line);padding:7px 0"><span class="mono">${esc(k)}</span><span class="hint">${esc(v)}</span></div>`).join('');
      } else if (tab === 3) {
        html = ports.filter(([k, v]) => !q || String(k).includes(q) || v.toLowerCase().includes(q))
          .map(([k, v]) => `<div class="row between" style="border-bottom:1px solid var(--line);padding:7px 0"><b class="mono" style="color:var(--acc)">${k}</b><span class="hint">${esc(v)}</span></div>`).join('');
      } else {
        html = `<div class="field"><label class="lab">粘贴 User-Agent</label><textarea class="ta mono" id="hi-ua" rows="4">${esc(navigator.userAgent)}</textarea></div><button class="btn primary" id="hi-parse" style="margin-top:9px">解析</button><div id="hi-ua-out" style="margin-top:12px"></div>`;
      }
      $('#hi-body').innerHTML = html || '<div class="hint">没有匹配项</div>';
      if (tab === 2) {
        $('#hi-parse').onclick = () => {
          const ua = $('#hi-ua').value;
          const browser = /Edg\/([\d.]+)/.exec(ua) || /Chrome\/([\d.]+)/.exec(ua) || /Firefox\/([\d.]+)/.exec(ua) || /Version\/([\d.]+).*Safari/.exec(ua);
          const os = /Windows NT ([\d.]+)/.exec(ua) ? 'Windows' : /Mac OS X ([\d_]+)/.exec(ua) ? 'macOS' : /Android ([\d.]+)/.exec(ua) ? 'Android' : /(iPhone|iPad)/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : '未知';
          const engine = /AppleWebKit/.test(ua) ? 'WebKit' : /Gecko/.test(ua) ? 'Gecko' : '未知';
          const mobile = /Mobile|Android|iPhone/.test(ua);
          $('#hi-ua-out').innerHTML = `<div class="kv"><dt>浏览器</dt><dd>${browser ? browser[0] : '未知'}</dd><dt>操作系统</dt><dd>${os}</dd><dt>渲染引擎</dt><dd>${engine}</dd><dt>设备类型</dt><dd>${mobile ? '移动设备' : '桌面设备'}</dd></div>`;
        };
      }
    };
    $('#hi-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      tab = Number(b.dataset.i);
      root.querySelectorAll('#hi-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      $('#hi-search').value = '';
      paint();
    });
    $('#hi-search').addEventListener('input', paint);
    paint();
  },

  /* ================= URL 工具 ================= */
  'url-tools'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="url-tabs"><button class="tab active" data-i="0">URL 解析</button><button class="tab" data-i="1">参数构建</button><button class="tab" data-i="2">UTM 生成</button><button class="tab" data-i="3">Cookie 解析</button></div>
        <div class="panel" id="url-p0">
          <input class="inp mono" id="url-in" value="https://example.com/path/page?name=kongtian&tag=a&tag=b#section">
          <button class="btn primary" id="url-parse" style="margin-top:9px">解析</button>
          <div id="url-out" style="margin-top:12px"></div>
        </div>
        <div class="panel hidden" id="url-p1">
          <div class="field"><label class="lab">基础 URL</label><input class="inp mono" id="url-base" value="https://example.com/search"></div>
          <div class="field" style="margin-top:8px"><label class="lab">参数（每行 key=value）</label><textarea class="ta mono" id="url-params" rows="5">q=空天 工具
page=1
sort=desc</textarea></div>
          <button class="btn primary" id="url-build" style="margin-top:9px">生成 URL</button>
          <pre class="out" id="url-built" style="margin-top:10px"></pre>
        </div>
        <div class="panel hidden" id="url-p2">
          <div class="grid2">
            <div class="field"><label class="lab">目标 URL</label><input class="inp mono" id="utm-url" value="https://example.com/"></div>
            <div class="field"><label class="lab">来源 source</label><input class="inp" id="utm-source" value="github"></div>
            <div class="field"><label class="lab">媒介 medium</label><input class="inp" id="utm-medium" value="social"></div>
            <div class="field"><label class="lab">活动 campaign</label><input class="inp" id="utm-campaign" value="launch"></div>
            <div class="field"><label class="lab">内容 content</label><input class="inp" id="utm-content" value="post"></div>
            <div class="field"><label class="lab">关键词 term</label><input class="inp" id="utm-term" placeholder="可选"></div>
          </div>
          <button class="btn primary" id="utm-build" style="margin-top:10px">生成 UTM 链接</button>
          <pre class="out" id="utm-out" style="margin-top:10px"></pre>
        </div>
        <div class="panel hidden" id="url-p3">
          <div class="field"><label class="lab">Cookie 字符串</label><textarea class="ta mono" id="ck-in" rows="5">${esc(document.cookie || 'name=kongtian; theme=dark; token=abc123')}</textarea></div>
          <button class="btn primary" id="ck-run" style="margin-top:9px">解析</button>
          <pre class="out" id="ck-out" style="margin-top:10px"></pre>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#url-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#url-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      [0, 1, 2, 3].forEach((i) => $('#url-p' + i).classList.toggle('hidden', String(i) !== b.dataset.i));
    });
    $('#url-parse').onclick = () => {
      try {
        const u = new URL($('#url-in').value);
        const params = [...u.searchParams.entries()];
        $('#url-out').innerHTML = `<div class="kv">
          <dt>协议</dt><dd>${esc(u.protocol)}</dd><dt>主机</dt><dd>${esc(u.host)}</dd>
          <dt>路径</dt><dd>${esc(u.pathname)}</dd><dt>Hash</dt><dd>${esc(u.hash)}</dd>
          <dt>Origin</dt><dd>${esc(u.origin)}</dd></div>
          <div style="margin-top:10px"><b class="lab">查询参数</b>${params.length ? `<table class="tbl"><tr><th>Key</th><th>Value</th></tr>${params.map(([k, v]) => `<tr><td class="mono">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>` : '<div class="hint">无</div>'}</div>`;
      } catch (e) { $('#url-out').innerHTML = `<div class="errbox">${esc(e.message)}</div>`; }
    };
    $('#url-build').onclick = () => {
      try {
        const u = new URL($('#url-base').value);
        for (const line of $('#url-params').value.split(/\r?\n/)) {
          const i = line.indexOf('=');
          if (i > 0) u.searchParams.append(line.slice(0, i).trim(), line.slice(i + 1).trim());
        }
        $('#url-built').textContent = u.toString();
      } catch (e) { $('#url-built').textContent = '错误：' + e.message; }
    };
    $('#utm-build').onclick = () => {
      try {
        const u = new URL($('#utm-url').value);
        const map = { utm_source: '#utm-source', utm_medium: '#utm-medium', utm_campaign: '#utm-campaign', utm_content: '#utm-content', utm_term: '#utm-term' };
        for (const [k, sel] of Object.entries(map)) { const v = $(sel).value.trim(); if (v) u.searchParams.set(k, v); }
        $('#utm-out').textContent = u.toString();
      } catch (e) { $('#utm-out').textContent = '错误：' + e.message; }
    };
    $('#ck-run').onclick = () => {
      const obj = {};
      $('#ck-in').value.split(';').forEach((p) => { const i = p.indexOf('='); if (i > 0) obj[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
      $('#ck-out').textContent = JSON.stringify(obj, null, 2);
    };
    $('#url-parse').click();
  },

  /* ================= cURL 转换 ================= */
  'curl-convert'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>cURL 命令</b><span class="hint">粘贴 cURL，生成 fetch / axios / HTTPie</span></div>
          <textarea class="ta mono" id="cc-in" rows="7">curl -X POST 'https://api.example.com/users' -H 'Content-Type: application/json' -H 'Authorization: Bearer token' -d '{"name":"kongtian"}'</textarea>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="cc-run">转换</button><button class="btn" id="cc-copy">复制</button></div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b><select class="sel" id="cc-target" style="max-width:130px"><option value="fetch">fetch</option><option value="axios">axios</option><option value="httpie">HTTPie</option></select></div><pre class="out" id="cc-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const parseCurl = (cmd) => {
      const args = [];
      const re = /'([^']*)'|"([^"]*)"|(\S+)/g;
      let m;
      while ((m = re.exec(cmd))) args.push(m[1] ?? m[2] ?? m[3]);
      const out = { method: 'GET', url: '', headers: {}, body: '' };
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-X' || a === '--request') out.method = args[++i];
        else if (a === '-H' || a === '--header') { const h = args[++i] || ''; const j = h.indexOf(':'); if (j > 0) out.headers[h.slice(0, j).trim()] = h.slice(j + 1).trim(); }
        else if (a === '-d' || a === '--data' || a === '--data-raw' || a === '--data-binary') { out.body = args[++i] || ''; out.method = out.method === 'GET' ? 'POST' : out.method; }
        else if (a === '-u' || a === '--user') { out.headers.Authorization = 'Basic ' + btoa(args[++i] || ''); }
        else if (a === '-b' || a === '--cookie') out.headers.Cookie = args[++i] || '';
        else if (!a.startsWith('-') && !out.url) out.url = a;
      }
      return out;
    };
    const build = (req, target) => {
      const headers = Object.entries(req.headers);
      const hObj = headers.length ? `{\n${headers.map(([k, v]) => `    "${k}": "${v}"`).join(',\n')}\n  }` : '{}';
      if (target === 'fetch') return `await fetch("${req.url}", {\n  method: "${req.method}",\n  headers: ${hObj},\n  body: ${req.body ? JSON.stringify(req.body) : 'undefined'}\n});`;
      if (target === 'axios') return `axios({\n  method: "${req.method.toLowerCase()}",\n  url: "${req.url}",\n  headers: ${hObj},\n  data: ${req.body || 'undefined'}\n});`;
      return `http ${req.method} ${req.url} \\\n${headers.map(([k, v]) => `  '${k}: ${v}'`).join(' \\\n')} \\\n  ${req.body ? `<<< '${req.body}'` : ''}`;
    };
    $('#cc-run').onclick = () => {
      try {
        const req = parseCurl($('#cc-in').value.trim());
        if (!req.url) throw new Error('未找到 URL');
        $('#cc-out').textContent = build(req, $('#cc-target').value);
      } catch (e) { $('#cc-out').textContent = '转换失败：' + e.message; }
    };
    $('#cc-target').addEventListener('change', () => $('#cc-run').click());
    $('#cc-copy').onclick = () => copy($('#cc-out').textContent);
    $('#cc-run').click();
  },

  /* ================= Cron ================= */
  'cron-tool'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>Cron 表达式</b><span class="hint">5 字段：分 时 日 月 周（支持 * / - ,）</span></div>
          <div class="row">
            <input class="inp mono" id="cr-in" value="*/15 * * * *" style="flex:1;min-width:180px">
            <button class="btn primary" id="cr-run">解析</button>
          </div>
          <div class="row" style="margin-top:8px;gap:5px">
            <button class="chip" data-cron="*/5 * * * *">每 5 分钟</button>
            <button class="chip" data-cron="0 * * * *">每小时</button>
            <button class="chip" data-cron="0 9 * * 1-5">工作日 9 点</button>
            <button class="chip" data-cron="0 0 1 * *">每月 1 日</button>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>接下来 8 次执行时间</b></div><div id="cr-out"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const run = () => {
      try {
        const list = nextRuns($('#cr-in').value);
        if (!list.length) { $('#cr-out').innerHTML = '<div class="hint">未来一年内没有匹配时间</div>'; return; }
        $('#cr-out').innerHTML = `<table class="tbl"><tr><th>#</th><th>时间</th><th>相对</th></tr>${list.map((d, i) => {
          const diff = Math.round((d - Date.now()) / 60000);
          return `<tr><td>${i + 1}</td><td class="mono">${d.toLocaleString('zh-CN', { hour12: false })}</td><td class="hint">${diff < 60 ? diff + ' 分钟后' : Math.round(diff / 60) + ' 小时后'}</td></tr>`;
        }).join('')}</table>`;
      } catch (e) { $('#cr-out').innerHTML = `<div class="errbox">${esc(e.message)}</div>`; }
    };
    $('#cr-run').onclick = run;
    root.querySelectorAll('[data-cron]').forEach((b) => b.addEventListener('click', () => { $('#cr-in').value = b.dataset.cron; run(); }));
    run();
  },

  /* ================= SemVer ================= */
  'semver-tool'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>版本号工具</b><span class="hint">SemVer 2.0 比较与递增</span></div>
          <div class="grid2">
            <div class="field"><label class="lab">版本 A</label><input class="inp mono" id="sv-a" value="1.2.3"></div>
            <div class="field"><label class="lab">版本 B</label><input class="inp mono" id="sv-b" value="1.3.0"></div>
          </div>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="sv-run">比较</button>
            <button class="btn" data-bump="major">A + Major</button><button class="btn" data-bump="minor">A + Minor</button><button class="btn" data-bump="patch">A + Patch</button>
          </div>
          <div class="field" style="margin-top:10px"><label class="lab">版本范围解析</label><input class="inp mono" id="sv-range" value="^1.2.3"></div>
          <button class="btn" id="sv-range-run" style="margin-top:8px">解析范围</button>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b></div><pre class="out" id="sv-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const parse = (s) => {
      const m = String(s).trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([\w.]+))?/);
      if (!m) throw new Error('版本格式无效：' + s);
      return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] || '' };
    };
    $('#sv-run').onclick = () => {
      try {
        const a = parse($('#sv-a').value), b = parse($('#sv-b').value);
        const cmp = a.major - b.major || a.minor - b.minor || a.patch - b.patch || (a.pre === b.pre ? 0 : a.pre ? -1 : 1);
        $('#sv-out').textContent = cmp === 0 ? 'A == B' : cmp > 0 ? 'A > B' : 'A < B';
      } catch (e) { $('#sv-out').textContent = e.message; }
    };
    root.querySelectorAll('[data-bump]').forEach((b) => b.addEventListener('click', () => {
      try {
        const v = parse($('#sv-a').value);
        if (b.dataset.bump === 'major') { v.major++; v.minor = 0; v.patch = 0; }
        if (b.dataset.bump === 'minor') { v.minor++; v.patch = 0; }
        if (b.dataset.bump === 'patch') v.patch++;
        $('#sv-out').textContent = `${v.major}.${v.minor}.${v.patch}`;
      } catch (e) { $('#sv-out').textContent = e.message; }
    }));
    $('#sv-range-run').onclick = () => {
      const r = $('#sv-range').value.trim();
      const map = { '^': '兼容该主版本（>= 当前，< 下一主版本）', '~': '兼容该次版本（>= 当前，< 下一次版本）', '>=': '大于等于', '<=': '小于等于', '>': '大于', '<': '小于', '=': '精确等于' };
      const key = Object.keys(map).find((k) => r.startsWith(k));
      $('#sv-out').textContent = key ? `${r}\n→ ${map[key]}` : (r === '*' ? '任意版本' : '精确版本 ' + r);
    };
    $('#sv-run').click();
  },

  /* ================= PKCE ================= */
  'pkce-tool'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>OAuth PKCE 生成器</b><span class="hint">S256 / plain，本地加密随机</span></div>
          <div class="row"><button class="btn primary" id="pk-run">生成</button><button class="btn" id="pk-copy">复制全部</button></div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b></div><pre class="out" id="pk-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#pk-run').onclick = async () => {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      const verifier = b64urlFromBytes(bytes);
      const digest = await crypto.subtle.digest('SHA-256', enc.encode(verifier));
      const challenge = b64urlFromBytes(new Uint8Array(digest));
      $('#pk-out').textContent = `code_verifier:\n${verifier}\n\ncode_challenge:\n${challenge}\n\ncode_challenge_method:\nS256`;
    };
    $('#pk-copy').onclick = () => copy($('#pk-out').textContent);
    $('#pk-run').click();
  },

  /* ================= JSON 与表单 ================= */
  'api-form'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="af-tabs"><button class="tab active" data-i="0">JSON → 表单</button><button class="tab" data-i="1">表单 → JSON</button><button class="tab" data-i="2">Mock API 响应</button></div>
        <div class="panel" id="af-p0">
          <textarea class="ta mono" id="af-json" rows="8">{"name":"空天","tags":["a","b"],"user":{"id":1,"email":"a@b.com"}}</textarea>
          <button class="btn primary" id="af-j2f" style="margin-top:9px">转换为表单</button>
          <pre class="out" id="af-form" style="margin-top:9px"></pre>
        </div>
        <div class="panel hidden" id="af-p1">
          <textarea class="ta mono" id="af-qs" rows="6">name=%E7%A9%BA%E5%A4%A9&tags=a&tags=b&user%5Bid%5D=1</textarea>
          <button class="btn primary" id="af-f2j" style="margin-top:9px">转换为 JSON</button>
          <pre class="out" id="af-jsonout" style="margin-top:9px"></pre>
        </div>
        <div class="panel hidden" id="af-p2">
          <div class="grid3">
            <div class="field"><label class="lab">状态码</label><select class="sel" id="af-status"><option>200</option><option>201</option><option>400</option><option>401</option><option>404</option><option>500</option></select></div>
            <div class="field"><label class="lab">Content-Type</label><select class="sel" id="af-ctype"><option>application/json</option><option>text/plain</option><option>text/html</option></select></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="af-gen" style="width:100%">生成响应</button></div>
          </div>
          <textarea class="ta mono" id="af-body" rows="6" style="margin-top:9px">{"code":0,"message":"ok","data":{"id":1,"name":"kongtian"}}</textarea>
          <pre class="out" id="af-resp" style="margin-top:9px"></pre>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#af-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#af-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      [0, 1, 2].forEach((i) => $('#af-p' + i).classList.toggle('hidden', String(i) !== b.dataset.i));
    });
    const flatten = (obj, prefix = '', out = []) => {
      for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}[${k}]` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
        else if (Array.isArray(v)) v.forEach((x) => out.push([key, String(x)]));
        else out.push([key, String(v)]);
      }
      return out;
    };
    $('#af-j2f').onclick = () => {
      try {
        const pairs = flatten(JSON.parse($('#af-json').value));
        $('#af-form').textContent = pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
      } catch (e) { $('#af-form').textContent = '失败：' + e.message; }
    };
    $('#af-f2j').onclick = () => {
      const out = {};
      new URLSearchParams($('#af-qs').value).forEach((v, k) => {
        const m = k.match(/^(\w+)(?:\[(\w+)\])?$/);
        if (!m) { out[k] = v; return; }
        if (m[2]) { out[m[1]] = out[m[1]] || {}; out[m[1]][m[2]] = v; }
        else if (out[k] !== undefined) { if (!Array.isArray(out[k])) out[k] = [out[k]]; out[k].push(v); }
        else out[k] = v;
      });
      try { $('#af-jsonout').textContent = JSON.stringify(out, null, 2); } catch (e) { $('#af-jsonout').textContent = e.message; }
    };
    $('#af-gen').onclick = () => {
      try {
        const body = JSON.parse($('#af-body').value);
        $('#af-resp').textContent = `HTTP/1.1 ${$('#af-status').value} OK\nContent-Type: ${$('#af-ctype').value}\nContent-Length: ${new Blob([JSON.stringify(body)]).size}\n\n${JSON.stringify(body, null, 2)}`;
      } catch (e) { $('#af-resp').textContent = 'JSON 无效：' + e.message; }
    };
  }
};
