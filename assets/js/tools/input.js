/* 输入法、剪贴板与拖放 */
import { esc, copy, toast, download, fmtBytes, readAs } from '../core/ui.js';
import { bindFileZone, fileZone } from '../core/kit.js';

const $ = (root, s) => root.querySelector(s);
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function sha256(text) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}
async function sha256Buf(buf) {
  return hex(await crypto.subtle.digest('SHA-256', buf));
}

const SHUANGPIN = {
  '自然码': { a: 'a', o: 'o', e: 'e', i: 'i', u: 'u', v: 'v', ai: 'l', ei: 'z', ao: 'k', ou: 'b', an: 'j', en: 'f', ang: 'h', eng: 'g', ong: 's', ia: 'w', ie: 'x', iao: 'c', iu: 'q', ian: 'm', in: 'n', iang: 'd', ing: 'y', iong: 's', ua: 'w', uo: 'o', uai: 'c', ui: 'v', uan: 'r', un: 'p', uang: 'd', ue: 't', ve: 't' },
  '小鹤双拼': { a: 'a', o: 'o', e: 'e', i: 'i', u: 'u', v: 'v', ai: 'd', ei: 'w', ao: 'c', ou: 'z', an: 'j', en: 'f', ang: 'l', eng: 'g', ong: 's', ia: 'x', ie: 'p', iao: 'n', iu: 'q', ian: 'm', in: 'b', iang: 'l', ing: 'k', iong: 's', ua: 'x', uo: 'o', uai: 'k', ui: 'v', uan: 'r', un: 'y', uang: 'l', ue: 't', ve: 't' },
  '微软双拼': { a: 'a', o: 'o', e: 'e', i: 'i', u: 'u', v: 'v', ai: 's', ei: 'w', ao: 'd', ou: 'z', an: 'j', en: 'f', ang: 'h', eng: 'g', ong: 's', ia: 'w', ie: 'x', iao: 'c', iu: 'q', ian: 'm', in: 'n', iang: 'd', ing: 'y', iong: 's', ua: 'w', uo: 'o', uai: 'c', ui: 'v', uan: 'r', un: 'p', uang: 'd', ue: 't', ve: 't' }
};
const WUBI = {
  G: '王旁青头戋五一', F: '土士二干十寸雨', D: '大犬三羊古石厂', S: '木丁西', A: '工戈草头右框七',
  H: '目具上止卜虎皮', J: '日早两竖与虫依', K: '口与川，字根稀', L: '田甲方框四车力', M: '山由贝，下框几',
  T: '禾竹一撇双人立', R: '白手看头三二斤', E: '月彡乃用家衣底', W: '人和八，三四里', Q: '金勺缺点无尾鱼',
  Y: '言文方广在四一', U: '立辛两点六门疒', I: '水旁兴头小倒立', O: '火业头，四点米', P: '之宝盖，摘礻衤',
  N: '已半巳满不出己', B: '子耳了也框向上', V: '女刀九臼山朝西', C: '又巴马，丢矢矣', X: '慈母无心弓和匕'
};
const CANGJIE = {
  A: '日', B: '月', C: '金', D: '木', E: '水', F: '火', G: '土', H: '竹', I: '戈', J: '十',
  K: '大', L: '中', M: '一', N: '弓', O: '人', P: '心', Q: '手', R: '口', S: '尸', T: '廿',
  U: '山', V: '女', W: '田', X: '難', Y: '卜', Z: '重'
};
const ZHUYIN = 'ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄧㄨㄩㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦ';

export default {
  /* ================= 输入辅助 ================= */
  'input-assist'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="ia-tabs">
          <button class="tab active" data-i="0">全半角</button><button class="tab" data-i="1">标点转换</button>
          <button class="tab" data-i="2">自定义短语</button><button class="tab" data-i="3">快捷回复</button>
          <button class="tab" data-i="4">候选排序</button><button class="tab" data-i="5">词频统计</button>
        </div>
        <div class="panel">
          <textarea class="ta" id="ia-in" rows="6" placeholder="输入内容…">空天工具合集，输入法测试：ＡＢＣ１２３，你好！</textarea>
          <div class="row" style="margin-top:9px" id="ia-opts"></div>
          <div class="row" style="margin-top:9px"><button class="btn primary" id="ia-run">处理</button><button class="btn" id="ia-copy">复制</button><span class="hint" id="ia-meta"></span></div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b></div><pre class="out" id="ia-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let mode = 0;
    const opts = () => {
      const el = $('#ia-opts');
      if (mode === 3) el.innerHTML = `<input class="inp" id="ia-name" placeholder="称呼，例如：客户" style="max-width:180px"><input class="inp" id="ia-topic" placeholder="主题" style="max-width:180px">`;
      else if (mode === 4) el.innerHTML = `<input class="inp" id="ia-pinyin" placeholder="拼音，例如：nihao" style="max-width:200px"><input class="inp" id="ia-cands" placeholder="候选词，逗号分隔" value="你好,尼好,你号,拟好" style="flex:1">`;
      else el.innerHTML = '';
    };
    $('#ia-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      mode = Number(b.dataset.i);
      root.querySelectorAll('#ia-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      opts();
    });
    $('#ia-run').onclick = () => {
      let s = $('#ia-in').value;
      if (mode === 0) s = s.replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/\u3000/g, ' ');
      else if (mode === 1) s = s.replace(/[，。！？；：、“”‘’（）【】《》]/g, (c) => ({ '，': ',', '。': '.', '！': '!', '？': '?', '；': ';', '：': ':', '、': ',', '“': '"', '”': '"', '‘': "'", '’': "'", '（': '(', '）': ')', '【': '[', '】': ']', '《': '<', '》': '>' }[c] || c));
      else if (mode === 2) {
        s = s.split(/\r?\n/).filter((x) => x.includes('=')).map((l) => { const [k, ...v] = l.split('='); return `${k.trim()}\t${v.join('=').trim()}`; }).join('\n');
      } else if (mode === 3) {
        const name = $('#ia-name')?.value || '客户';
        s = `您好，${name}！关于${$('#ia-topic')?.value || '您咨询的问题'}，我们已经收到，会尽快为您处理。\n\n如需补充信息，直接回复本条消息即可。\n\n空天工具合集`;
      } else if (mode === 4) {
        const py = $('#ia-pinyin')?.value || 'nihao';
        const cands = ($('#ia-cands')?.value || '').split(',').filter(Boolean);
        s = cands.map((c, i) => `${i + 1}. ${c}（${py} · 频率 ${cands.length - i}）`).join('\n');
      } else {
        const tokens = s.match(/[\u4e00-\u9fa5]{2,}|[A-Za-z]{2,}/g) || [];
        const freq = new Map();
        tokens.forEach((t) => freq.set(t, (freq.get(t) || 0) + 1));
        s = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([w, n]) => `${w}\t${n}`).join('\n');
      }
      $('#ia-out').textContent = s;
      $('#ia-meta').textContent = `${[...s].length} 字符`;
    };
    $('#ia-copy').onclick = () => copy($('#ia-out').textContent);
    opts();
    $('#ia-run').click();
  },

  /* ================= 输入方案查询 ================= */
  'ime-schemes'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="row"><select class="sel" id="is-type" style="max-width:160px"><option value="shuangpin">双拼方案</option><option value="wubi">五笔字根</option><option value="cangjie">仓颉码</option><option value="zhuyin">注音符号</option></select><input class="inp" id="is-search" placeholder="搜索键位或内容" style="flex:1"></div>
        </div>
        <div class="panel" id="is-out"></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const paint = () => {
      const type = $('#is-type').value, q = $('#is-search').value.trim().toLowerCase();
      let rows = [];
      if (type === 'shuangpin') {
        rows = Object.entries(SHUANGPIN).map(([name, map]) => `<div class="panel tight"><div class="panel-head"><b>${name}</b><span class="hint">${Object.keys(map).length} 个韵母</span></div><div class="row" style="gap:5px">${Object.entries(map).filter(([k, v]) => !q || k.includes(q) || v.includes(q)).map(([k, v]) => `<span class="chip mono">${k} → ${v}</span>`).join('')}</div></div>`).join('');
      } else if (type === 'wubi') {
        rows = Object.entries(WUBI).filter(([k, v]) => !q || k.toLowerCase().includes(q) || v.includes(q)).map(([k, v]) => `<div class="row between" style="border-bottom:1px solid var(--line);padding:6px 0"><b class="mono" style="color:var(--acc)">${k}</b><span>${esc(v)}</span></div>`).join('');
      } else if (type === 'cangjie') {
        rows = Object.entries(CANGJIE).filter(([k, v]) => !q || k.toLowerCase().includes(q) || v.includes(q)).map(([k, v]) => `<span class="chip mono" style="margin:0 5px 5px 0">${k} · ${v}</span>`).join('');
      } else {
        rows = [...ZHUYIN].filter((c) => !q || c.includes(q)).map((c) => `<span class="chip" style="font-size:16px">${c}</span>`).join('');
      }
      $('#is-out').innerHTML = rows || '<div class="hint">没有匹配项</div>';
    };
    $('#is-type').addEventListener('change', paint);
    $('#is-search').addEventListener('input', paint);
    paint();
  },

  /* ================= 手写板 ================= */
  'handwriting'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>手写板测试</b><span class="hint">仅测试绘制与笔迹，不做文字识别</span></div>
          <div class="canvas-wrap"><canvas id="hw-canvas" width="720" height="300" style="background:#fff;border-radius:8px;touch-action:none;cursor:crosshair;width:100%"></canvas></div>
          <div class="row" style="margin-top:10px"><label class="lab" style="margin:0">粗细</label><input type="range" id="hw-size" min="1" max="16" value="4" style="max-width:160px"><input type="color" id="hw-color" value="#111111"><button class="btn" id="hw-clear">清空</button><button class="btn primary" id="hw-dl">下载 PNG</button><span class="hint" id="hw-meta">0 笔</span></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const cv = $('#hw-canvas'), g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
    g.lineCap = 'round'; g.lineJoin = 'round';
    let drawing = false, strokes = 0;
    const pos = (e) => {
      const r = cv.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return [(t.clientX - r.left) / r.width * cv.width, (t.clientY - r.top) / r.height * cv.height];
    };
    const start = (e) => { e.preventDefault(); drawing = true; strokes++; const [x, y] = pos(e); g.strokeStyle = $('#hw-color').value; g.lineWidth = Number($('#hw-size').value); g.beginPath(); g.moveTo(x, y); $('#hw-meta').textContent = strokes + ' 笔'; };
    const move = (e) => { if (!drawing) return; e.preventDefault(); const [x, y] = pos(e); g.lineTo(x, y); g.stroke(); };
    const end = () => { drawing = false; };
    cv.addEventListener('mousedown', start); cv.addEventListener('mousemove', move); window.addEventListener('mouseup', end);
    cv.addEventListener('touchstart', start, { passive: false }); cv.addEventListener('touchmove', move, { passive: false }); cv.addEventListener('touchend', end);
    $('#hw-clear').onclick = () => { g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); strokes = 0; $('#hw-meta').textContent = '0 笔'; };
    $('#hw-dl').onclick = () => cv.toBlob((b) => download('handwriting.png', b));
  },

  /* ================= 剪贴板工作台 ================= */
  'clipboard-pro'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>剪贴板工作台</b><span class="hint">读取需要浏览器授权</span></div>
          <div class="row"><button class="btn primary" id="cp-read">读取文本</button><button class="btn" id="cp-img">读取图片</button><button class="btn" id="cp-write">写入文本</button><button class="btn" id="cp-clear">清空剪贴板</button></div>
          <textarea class="ta mono" id="cp-text" rows="8" style="margin-top:10px" placeholder="剪贴板内容会显示在这里…"></textarea>
          <div id="cp-preview" style="margin-top:10px"></div>
          <div class="stat-grid" id="cp-stats" style="margin-top:10px"></div>
          <div class="row" style="margin-top:10px"><button class="btn" id="cp-clean">清理 HTML</button><button class="btn" id="cp-plain">富文本转纯文本</button><button class="btn" id="cp-hash">计算哈希</button><button class="btn" id="cp-qr">生成二维码</button><button class="btn" id="cp-dedup">按行去重</button></div>
          <pre class="out" id="cp-out" style="margin-top:9px"></pre>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const stats = () => {
      const t = $('#cp-text').value;
      $('#cp-stats').innerHTML = [['字符', [...t].length], ['字节', new TextEncoder().encode(t).length], ['行数', t.split(/\r?\n/).length], ['格式', t.trim().startsWith('{') || t.trim().startsWith('[') ? 'JSON' : t.includes('<') ? 'HTML' : t.includes(',') ? 'CSV/文本' : '纯文本']]
        .map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
    };
    $('#cp-text').addEventListener('input', stats);
    $('#cp-read').onclick = async () => {
      try { $('#cp-text').value = await navigator.clipboard.readText(); stats(); toast('已读取', 'ok'); }
      catch { toast('未授权或浏览器不支持', 'err'); }
    };
    $('#cp-img').onclick = async () => {
      try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const type = item.types.find((t) => t.startsWith('image/'));
          if (type) {
            const blob = await item.getType(type);
            const url = URL.createObjectURL(blob);
            $('#cp-preview').innerHTML = `<img src="${url}" style="max-width:100%;max-height:260px;border-radius:8px;border:1px solid var(--line)">`;
            $('#cp-stats').innerHTML = `<div class="stat"><b>${type}</b><span>图片类型</span></div><div class="stat"><b>${fmtBytes(blob.size)}</b><span>大小</span></div>`;
            return;
          }
        }
        toast('剪贴板里没有图片', 'err');
      } catch { toast('未授权读取图片', 'err'); }
    };
    $('#cp-write').onclick = async () => { try { await navigator.clipboard.writeText($('#cp-text').value); toast('已写入', 'ok'); } catch { toast('写入失败', 'err'); } };
    $('#cp-clear').onclick = async () => { try { await navigator.clipboard.writeText(''); toast('已清空'); } catch { /* */ } };
    $('#cp-clean').onclick = () => {
      const d = document.createElement('div'); d.innerHTML = $('#cp-text').value;
      d.querySelectorAll('script,style').forEach((x) => x.remove());
      $('#cp-out').textContent = d.innerHTML;
    };
    $('#cp-plain').onclick = () => {
      const d = document.createElement('div'); d.innerHTML = $('#cp-text').value;
      $('#cp-out').textContent = d.textContent;
    };
    $('#cp-hash').onclick = async () => { $('#cp-out').textContent = 'SHA-256: ' + await sha256($('#cp-text').value); };
    $('#cp-dedup').onclick = () => { $('#cp-out').textContent = [...new Set($('#cp-text').value.split(/\r?\n/))].join('\n'); };
    $('#cp-qr').onclick = async () => {
      try {
        await ctx.deps(['qrcode']);
        const qr = window.qrcode(0, 'M'); qr.addData($('#cp-text').value.slice(0, 1200)); qr.make();
        const count = qr.getModuleCount(), cell = 4, size = count * cell + 16;
        const cv = document.createElement('canvas'); cv.width = cv.height = size;
        const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, size, size); g.fillStyle = '#000';
        for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (qr.isDark(r, c)) g.fillRect(8 + c * cell, 8 + r * cell, cell, cell);
        $('#cp-preview').innerHTML = ''; cv.style.width = '200px'; $('#cp-preview').appendChild(cv);
      } catch (e) { toast(e.message, 'err'); }
    };
    stats();
  },

  /* ================= 拖放工作台 ================= */
  'dragdrop-pro'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>拖放文件工作台</b><span class="hint">类型识别、大小统计、哈希、目录树、文本提取</span></div>
          ${fileZone('dd-zone', { multiple: true, label: '拖入文件或文件夹' })}
          <div class="row" style="margin-top:10px"><button class="btn primary" id="dd-hash">计算 SHA-256</button><button class="btn" id="dd-tree">生成目录树</button><button class="btn" id="dd-csv">导出清单 CSV</button><span class="hint" id="dd-meta">尚未选择文件</span></div>
        </div>
        <div class="panel"><div class="panel-head"><b>文件列表</b></div><div id="dd-list" class="table-scroll" style="max-height:300px"><div class="hint">拖入文件后显示</div></div></div>
        <div class="panel"><div class="panel-head"><b>文本提取</b><span class="hint">从文本类文件中提取 URL / 邮箱 / 手机号</span></div><button class="btn" id="dd-extract">提取信息</button><pre class="out" id="dd-out" style="margin-top:9px"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let files = [];
    const paint = () => {
      $('#dd-meta').textContent = `${files.length} 个文件 · ${fmtBytes(files.reduce((s, f) => s + f.size, 0))}`;
      $('#dd-list').innerHTML = files.length ? `<table class="tbl"><tr><th>文件名</th><th>类型</th><th>大小</th></tr>${files.map((f) => `<tr><td class="mono">${esc(f.webkitRelativePath || f.name)}</td><td>${esc(f.type || '未知')}</td><td>${fmtBytes(f.size)}</td></tr>`).join('')}</table>` : '<div class="hint">拖入文件后显示</div>';
    };
    bindFileZone(root, 'dd-zone', (fs) => { files = fs; paint(); });
    $('#dd-hash').onclick = async () => {
      if (!files.length) return toast('请先选择文件', 'err');
      const lines = [];
      for (const f of files) lines.push(`${await sha256Buf(await readAs(f, 'arraybuffer'))}  ${f.name}`);
      $('#dd-out').textContent = lines.join('\n');
    };
    $('#dd-tree').onclick = () => {
      const paths = files.map((f) => f.webkitRelativePath || f.name).sort();
      const rootName = paths[0]?.split('/')[0] || 'files';
      const tree = {};
      paths.forEach((p) => { let cur = tree; p.split('/').slice(paths[0].includes('/') ? 1 : 0).forEach((part) => { cur[part] = cur[part] || {}; cur = cur[part]; }); });
      const render = (node, pre = '') => Object.keys(node).map((k, i, arr) => {
        const last = i === arr.length - 1;
        return pre + (last ? '└── ' : '├── ') + k + '\n' + render(node[k], pre + (last ? '    ' : '│   '));
      }).join('');
      $('#dd-out').textContent = rootName + '/\n' + render(tree);
    };
    $('#dd-csv').onclick = () => {
      const rows = [['文件名', '类型', '大小'], ...files.map((f) => [f.webkitRelativePath || f.name, f.type, f.size])];
      download('files.csv', '\ufeff' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
    };
    $('#dd-extract').onclick = async () => {
      let text = '';
      for (const f of files) {
        if (/text|json|csv|xml|javascript|markdown/.test(f.type) || /\.(txt|md|json|csv|xml|js|html|log)$/i.test(f.name)) text += await readAs(f, 'text') + '\n';
      }
      const urls = [...new Set(text.match(/https?:\/\/[^\s<>"']+/g) || [])];
      const emails = [...new Set(text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [])];
      const phones = [...new Set(text.match(/(?<!\d)1[3-9]\d{9}(?!\d)/g) || [])];
      const jsons = files.filter((f) => f.name.endsWith('.json')).length;
      const csvs = files.filter((f) => f.name.endsWith('.csv')).length;
      $('#dd-out').textContent = `URL（${urls.length}）\n${urls.join('\n')}\n\n邮箱（${emails.length}）\n${emails.join('\n')}\n\n手机号（${phones.length}）\n${phones.join('\n')}\n\nJSON 文件：${jsons} · CSV 文件：${csvs}`;
    };
    paint();
  }
};
