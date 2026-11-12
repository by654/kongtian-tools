/* 文本处理工具 */
import { esc, copy, toast, download, fmtBytes, debounce } from '../core/ui.js';
import { bench, fileZone, bindFileZone, warn } from '../core/kit.js';

/* ---------- 公共 ---------- */
function byteLen(s) { return new TextEncoder().encode(s).length; }
function uniq(arr) { return [...new Set(arr)]; }
function tokenize(text) {
  if (window.Intl && Intl.Segmenter) {
    try {
      const seg = new Intl.Segmenter('zh-CN', { granularity: 'word' });
      const out = [];
      for (const s of seg.segment(text)) if (s.isWordLike && s.segment.trim().length > 1) out.push(s.segment.toLowerCase());
      return out;
    } catch { /* ignore */ }
  }
  return text.toLowerCase().match(/[\u4e00-\u9fa5]{2,}|[a-z][a-z0-9'-]{1,}/g) || [];
}
function splitWords(s) {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9\u4e00-\u9fa5]+/)
    .filter(Boolean);
}
function readFileText(file) {
  return new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsText(file); });
}

export default {
  /* ================= 文本统计 ================= */
  'text-stats'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>输入文本</b><span class="hint">输入即统计，支持中英文混排</span></div>
          <textarea class="ta" id="ts-in" rows="8" placeholder="在这里粘贴或输入文本…"></textarea>
          <div class="row" style="margin-top:9px">
            <button class="btn sm" id="ts-clear">清空</button>
            <button class="btn sm" id="ts-paste">读取剪贴板</button>
          </div>
        </div>
        <div class="stat-grid" id="ts-stats"></div>
        <div class="grid2">
          <div class="panel">
            <div class="panel-head"><b>词频 Top 15</b><span class="hint">中文自动分词</span></div>
            <div class="table-scroll"><table class="tbl" id="ts-words"><tbody></tbody></table></div>
          </div>
          <div class="panel">
            <div class="panel-head"><b>重复行 Top 10</b><span class="hint">出现 2 次以上</span></div>
            <div class="table-scroll"><table class="tbl" id="ts-dups"><tbody></tbody></table></div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><b>可读性</b><span class="hint">基于句长与段落结构的粗略估计</span></div>
          <div id="ts-read" class="hint"></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const input = $('#ts-in');
    const statsEl = $('#ts-stats');
    const wordsEl = $('#ts-words tbody');
    const dupsEl = $('#ts-dups tbody');
    const readEl = $('#ts-read');

    const render = debounce(() => {
      const text = input.value;
      const chars = [...text];
      const cn = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
      const enWords = (text.match(/[A-Za-z]+(?:['-][A-Za-z]+)*/g) || []).length;
      const nums = (text.match(/\d+(?:\.\d+)?/g) || []).length;
      const lines = text ? text.split(/\r\n|\r|\n/) : [];
      const nonEmpty = lines.filter((l) => l.trim()).length;
      const paras = text.split(/\n\s*\n/).filter((p) => p.trim()).length;
      const sentences = (text.match(/[^.!?。！？\n]+[.!?。！？]/g) || []).length;
      const bytes = byteLen(text);
      const noSpace = chars.filter((c) => !/\s/.test(c)).length;
      const readMin = Math.max(1, Math.round(cn / 300 + enWords / 200));
      const items = [
        ['总字符数', chars.length], ['不含空白', noSpace], ['中文字符', cn], ['英文单词', enWords],
        ['数字串', nums], ['行数', lines.length], ['非空行', nonEmpty], ['段落', paras],
        ['句子', sentences], ['UTF-8 字节', bytes], ['预计阅读', readMin + ' 分钟']
      ];
      statsEl.innerHTML = items.map(([k, v]) => `<div class="stat"><b>${typeof v === 'number' ? v.toLocaleString('zh-CN') : v}</b><span>${k}</span></div>`).join('');

      const tokens = tokenize(text);
      const freq = new Map();
      for (const w of tokens) freq.set(w, (freq.get(w) || 0) + 1);
      const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
      wordsEl.innerHTML = top.length
        ? top.map(([w, n], i) => `<tr><td class="dim">${i + 1}</td><td>${esc(w)}</td><td>${n}</td><td><div class="progress" style="width:70px"><i style="width:${Math.round(n / top[0][1] * 100)}%"></i></div></td></tr>`).join('')
        : '<tr><td class="dim">暂无数据</td></tr>';

      const lineFreq = new Map();
      for (const l of lines) { const s = l.trim(); if (s) lineFreq.set(s, (lineFreq.get(s) || 0) + 1); }
      const dups = [...lineFreq.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 10);
      dupsEl.innerHTML = dups.length
        ? dups.map(([l, n]) => `<tr><td style="max-width:320px;overflow:hidden;text-overflow:ellipsis">${esc(l)}</td><td>×${n}</td></tr>`).join('')
        : '<tr><td class="dim">没有重复行</td></tr>';

      if (!text.trim()) { readEl.textContent = '输入文本后显示可读性评估。'; return; }
      const avgSentence = sentences ? chars.length / sentences : chars.length;
      const avgPara = paras ? chars.length / paras : chars.length;
      let score = 100 - Math.max(0, avgSentence - 18) * 1.6 - Math.max(0, avgPara - 120) * 0.06;
      score = Math.max(5, Math.min(100, Math.round(score)));
      const label = score >= 80 ? '易读' : score >= 60 ? '适中' : score >= 40 ? '偏难' : '较难';
      readEl.innerHTML = `<div class="row" style="margin-bottom:6px"><b style="color:var(--acc);font-size:20px">${score}</b><span>/ 100 · ${label}</span></div>
        平均句长 ${avgSentence.toFixed(1)} 字，平均段长 ${avgPara.toFixed(0)} 字。${avgSentence > 40 ? '句子偏长，建议拆分。' : '句子长度舒适。'}`;
    }, 120);
    input.addEventListener('input', render);
    $('#ts-clear').onclick = () => { input.value = ''; render(); };
    $('#ts-paste').onclick = async () => {
      try { input.value = await navigator.clipboard.readText(); render(); toast('已粘贴'); }
      catch { toast('浏览器未授权剪贴板读取', 'err'); }
    };
    render();
  },

  /* ================= 大小写与命名 ================= */
  'case-convert'(root) {
    bench(root, {
      title: '源文本',
      rows: 9,
      value: 'hello world example text',
      options: `<div class="field" style="margin-bottom:9px">
        <label class="lab">转换方式</label>
        <select class="sel" id="cc-mode">
          <option value="upper">全部大写 UPPER</option>
          <option value="lower">全部小写 lower</option>
          <option value="title">每词首字母大写 Title Case</option>
          <option value="sentence">句首大写 Sentence case</option>
          <option value="camel">小驼峰 camelCase</option>
          <option value="pascal">大驼峰 PascalCase</option>
          <option value="snake">下划线 snake_case</option>
          <option value="kebab">短横线 kebab-case</option>
          <option value="constant">常量 CONSTANT_CASE</option>
          <option value="dot">点号 dot.case</option>
          <option value="all">同时输出全部命名</option>
        </select></div>`,
      runLabel: '转换',
      outTitle: '结果',
      live: true,
      autoRun: true,
      run(api) {
        const mode = api.els('#cc-mode').value;
        const s = api.value;
        const words = splitWords(s);
        const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        const map = {
          upper: s.toUpperCase(),
          lower: s.toLowerCase(),
          title: s.replace(/\b\w/g, (c) => c.toUpperCase()),
          sentence: s.replace(/(^\s*[a-z])|([.!?。！？]\s*[a-z])/g, (m) => m.toUpperCase()),
          camel: words.map((w, i) => i ? cap(w) : w.toLowerCase()).join(''),
          pascal: words.map(cap).join(''),
          snake: words.map((w) => w.toLowerCase()).join('_'),
          kebab: words.map((w) => w.toLowerCase()).join('-'),
          constant: words.map((w) => w.toUpperCase()).join('_'),
          dot: words.map((w) => w.toLowerCase()).join('.')
        };
        if (mode === 'all') {
          return Object.entries(map).map(([k, v]) => `${k.padEnd(9)} ${v}`).join('\n');
        }
        return map[mode];
      }
    });
    root.querySelector('#cc-mode').addEventListener('change', () => root.querySelector('#bench-run').click());
  },

  /* ================= 文本清洗 ================= */
  'text-clean'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>原始文本</b><span class="hint">勾选需要的清洗步骤</span></div>
          <textarea class="ta mono" id="tc-in" rows="9" placeholder="粘贴需要清洗的文本…"></textarea>
          <div class="grid3" style="margin-top:10px">
            <label class="row" style="gap:6px"><input type="checkbox" id="tc-trim" checked> 去首尾空格</label>
            <label class="row" style="gap:6px"><input type="checkbox" id="tc-blank" checked> 去空行</label>
            <label class="row" style="gap:6px"><input type="checkbox" id="tc-space"> 合并连续空格</label>
            <label class="row" style="gap:6px"><input type="checkbox" id="tc-dupe" checked> 行去重</label>
            <label class="row" style="gap:6px"><input type="checkbox" id="tc-case"> 去重忽略大小写</label>
            <label class="row" style="gap:6px"><input type="checkbox" id="tc-invisible" checked> 删除不可见字符</label>
            <label class="row" style="gap:6px"><input type="checkbox" id="tc-sort"> 按行排序</label>
            <label class="row" style="gap:6px"><input type="checkbox" id="tc-reverse"> 倒序</label>
            <label class="row" style="gap:6px"><input type="checkbox" id="tc-shuffle"> 随机打乱</label>
          </div>
          <div class="row" style="margin-top:10px">
            <button class="btn primary" id="tc-run">清洗</button>
            <button class="btn" id="tc-copy">复制</button>
            <button class="btn ghost" id="tc-clear">清空</button>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><b>结果</b><span class="hint" id="tc-meta"></span></div>
          <pre class="out" id="tc-out"></pre>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const run = () => {
      let lines = $('#tc-in').value.split(/\r\n|\r|\n/);
      const before = lines.length;
      if ($('#tc-trim').checked) lines = lines.map((l) => l.trim());
      if ($('#tc-invisible').checked) lines = lines.map((l) => l.replace(/[\u200B-\u200D\uFEFF\u2060\u0000]/g, ''));
      if ($('#tc-space').checked) lines = lines.map((l) => l.replace(/[ \t]+/g, ' '));
      if ($('#tc-blank').checked) lines = lines.filter((l) => l.trim());
      if ($('#tc-dupe').checked) {
        const seen = new Set();
        lines = lines.filter((l) => { const k = $('#tc-case').checked ? l.toLowerCase() : l; if (seen.has(k)) return false; seen.add(k); return true; });
      }
      if ($('#tc-sort').checked) lines.sort((a, b) => a.localeCompare(b, 'zh-CN'));
      if ($('#tc-reverse').checked) lines.reverse();
      if ($('#tc-shuffle').checked) {
        for (let i = lines.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [lines[i], lines[j]] = [lines[j], lines[i]]; }
      }
      $('#tc-out').textContent = lines.join('\n');
      $('#tc-meta').textContent = `${before} 行 → ${lines.length} 行`;
    };
    $('#tc-run').onclick = run;
    $('#tc-copy').onclick = () => copy($('#tc-out').textContent);
    $('#tc-clear').onclick = () => { $('#tc-in').value = ''; $('#tc-out').textContent = ''; $('#tc-meta').textContent = ''; };
  },

  /* ================= 行处理与行列转换 ================= */
  'line-tools'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>文本</b><span class="hint">按行处理，支持行列互转</span></div>
          <textarea class="ta mono" id="lt-in" rows="9" placeholder="每行一条内容…"></textarea>
          <div class="grid3" style="margin-top:10px">
            <div class="field"><label class="lab">操作</label>
              <select class="sel" id="lt-mode">
                <option value="number">添加行号</option>
                <option value="unnumber">删除行号</option>
                <option value="split">按分隔符拆成多行</option>
                <option value="join">多行合并</option>
                <option value="columns">分列（转 TSV）</option>
                <option value="json">转 JSON 数组</option>
                <option value="quoted">转带引号列表</option>
                <option value="commas">逗号拼接</option>
              </select></div>
            <div class="field"><label class="lab">分隔符</label><input class="inp mono" id="lt-sep" value=","></div>
            <div class="field"><label class="lab">行号格式</label>
              <select class="sel" id="lt-fmt">
                <option value="dot">1. 内容</option>
                <option value="paren">1) 内容</option>
                <option value="pad">001 内容</option>
                <option value="raw">1 内容</option>
              </select></div>
          </div>
          <div class="row" style="margin-top:10px">
            <button class="btn primary" id="lt-run">执行</button>
            <button class="btn" id="lt-copy">复制结果</button>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b><span class="hint" id="lt-meta"></span></div><pre class="out" id="lt-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const run = () => {
      const raw = $('#lt-in').value;
      const lines = raw.split(/\r\n|\r|\n/);
      const sep = $('#lt-sep').value || ',';
      const mode = $('#lt-mode').value;
      let out = '';
      if (mode === 'number') {
        const fmt = $('#lt-fmt').value;
        out = lines.map((l, i) => {
          const n = i + 1;
          if (fmt === 'dot') return `${n}. ${l}`;
          if (fmt === 'paren') return `${n}) ${l}`;
          if (fmt === 'pad') return `${String(n).padStart(3, '0')} ${l}`;
          return `${n} ${l}`;
        }).join('\n');
      } else if (mode === 'unnumber') {
        out = lines.map((l) => l.replace(/^\s*\d+[.)、:：-]?\s+/, '')).join('\n');
      } else if (mode === 'split') {
        out = lines.flatMap((l) => l.split(sep)).map((s) => s.trim()).join('\n');
      } else if (mode === 'join') {
        out = lines.map((l) => l.trim()).filter(Boolean).join(sep);
      } else if (mode === 'columns') {
        out = lines.map((l) => l.split(sep).map((s) => s.trim()).join('\t')).join('\n');
      } else if (mode === 'json') {
        out = JSON.stringify(lines.filter((l) => l.trim()), null, 2);
      } else if (mode === 'quoted') {
        out = lines.filter((l) => l.trim()).map((l) => JSON.stringify(l)).join(', ');
      } else {
        out = lines.map((l) => l.trim()).filter(Boolean).join(', ');
      }
      $('#lt-out').textContent = out;
      $('#lt-meta').textContent = `${lines.length} 行`;
    };
    $('#lt-run').onclick = run;
    $('#lt-copy').onclick = () => copy($('#lt-out').textContent);
    run();
  },

  /* ================= 查找替换 ================= */
  'find-replace'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>文本</b><span class="hint">支持正则替换，$1 引用分组</span></div>
          <textarea class="ta mono" id="fr-in" rows="7" placeholder="粘贴文本…"></textarea>
          <div class="grid3" style="margin-top:10px">
            <div class="field"><label class="lab">查找</label><input class="inp mono" id="fr-find" placeholder="要查找的内容"></div>
            <div class="field"><label class="lab">替换为</label><input class="inp mono" id="fr-rep" placeholder="留空表示删除"></div>
            <div class="field"><label class="lab">选项</label>
              <div class="row" style="height:38px">
                <label class="row" style="gap:5px"><input type="checkbox" id="fr-regex"> 正则</label>
                <label class="row" style="gap:5px"><input type="checkbox" id="fr-ignore" checked> 忽略大小写</label>
              </div></div>
          </div>
          <div class="row" style="margin-top:10px">
            <button class="btn" id="fr-preview">预览匹配</button>
            <button class="btn primary" id="fr-run">全部替换</button>
            <button class="btn" id="fr-copy">复制结果</button>
            <span class="hint" id="fr-count"></span>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><b>结果</b><span class="hint">匹配项以高亮显示</span></div>
          <pre class="out" id="fr-out"></pre>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const buildRE = () => {
      const f = $('#fr-find').value;
      if (!f) return null;
      const flags = 'g' + ($('#fr-ignore').checked ? 'i' : '');
      try { return $('#fr-regex').checked ? new RegExp(f, flags) : new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags); }
      catch (e) { toast('正则错误：' + e.message, 'err'); return null; }
    };
    const preview = () => {
      const re = buildRE();
      const text = $('#fr-in').value;
      if (!re) { $('#fr-out').textContent = text; $('#fr-count').textContent = ''; return; }
      const matches = [...text.matchAll(re)];
      $('#fr-count').textContent = `共 ${matches.length} 处匹配`;
      let html = '', last = 0;
      for (const m of matches) {
        html += esc(text.slice(last, m.index));
        html += `<mark style="background:rgba(56,205,240,.28);color:inherit;border-radius:3px">${esc(m[0])}</mark>`;
        last = m.index + m[0].length;
      }
      html += esc(text.slice(last));
      $('#fr-out').innerHTML = html || '<span class="dim">没有内容</span>';
    };
    const replaceAll = () => {
      const re = buildRE();
      if (!re) return;
      const text = $('#fr-in').value;
      const rep = $('#fr-rep').value;
      const result = text.replace(re, rep);
      $('#fr-out').textContent = result;
      $('#fr-count').textContent = '已替换';
    };
    $('#fr-preview').onclick = preview;
    $('#fr-run').onclick = replaceAll;
    $('#fr-copy').onclick = () => copy($('#fr-out').textContent);
    ['#fr-find', '#fr-rep'].forEach((s) => $(s).addEventListener('input', preview));
    ['#fr-regex', '#fr-ignore'].forEach((s) => $(s).addEventListener('change', preview));
    $('#fr-in').addEventListener('input', preview);
  },

  /* ================= 文本对比与相似度 ================= */
  'text-diff'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="grid2 stack">
          <div class="panel"><div class="panel-head"><b>文本 A</b></div><textarea class="ta mono" id="df-a" rows="9" placeholder="原始文本…"></textarea></div>
          <div class="panel"><div class="panel-head"><b>文本 B</b></div><textarea class="ta mono" id="df-b" rows="9" placeholder="修改后的文本…"></textarea></div>
        </div>
        <div class="row"><button class="btn primary" id="df-run">对比</button><span class="hint" id="df-meta"></span></div>
        <div class="panel"><div class="panel-head"><b>逐行差异</b><span class="hint">绿色新增 · 红色删除</span></div><pre class="out" id="df-out" style="font-family:var(--mono)"></pre></div>
        <div class="stat-grid" id="df-scores"></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    function lcsDiff(a, b) {
      const n = a.length, m = b.length;
      if (n * m > 1600000) return null;
      const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
      for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
      const out = [];
      let i = 0, j = 0;
      while (i < n && j < m) {
        if (a[i] === b[j]) { out.push(['same', a[i]]); i++; j++; }
        else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push(['del', a[i]]); i++; }
        else { out.push(['add', b[j]]); j++; }
      }
      while (i < n) out.push(['del', a[i++]]);
      while (j < m) out.push(['add', b[j++]]);
      return out;
    }
    function levenshtein(a, b) {
      if (a === b) return 0;
      if (!a.length) return b.length;
      if (!b.length) return a.length;
      let prev = new Uint16Array(b.length + 1);
      for (let j = 0; j <= b.length; j++) prev[j] = j;
      for (let i = 1; i <= a.length; i++) {
        const cur = new Uint16Array(b.length + 1);
        cur[0] = i;
        for (let j = 1; j <= b.length; j++) {
          cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        prev = cur;
      }
      return prev[b.length];
    }
    function jaroWinkler(a, b) {
      if (a === b) return 1;
      const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
      const matchA = new Array(a.length).fill(false), matchB = new Array(b.length).fill(false);
      let matches = 0;
      for (let i = 0; i < a.length; i++) {
        for (let j = Math.max(0, i - range); j < Math.min(b.length, i + range + 1); j++) {
          if (!matchB[j] && a[i] === b[j]) { matchA[i] = matchB[j] = true; matches++; break; }
        }
      }
      if (!matches) return 0;
      let t = 0, k = 0;
      for (let i = 0; i < a.length; i++) {
        if (matchA[i]) { while (!matchB[k]) k++; if (a[i] !== b[k]) t++; k++; }
      }
      t /= 2;
      const jaro = (matches / a.length + matches / b.length + (matches - t) / matches) / 3;
      let p = 0;
      while (p < Math.min(4, a.length, b.length) && a[p] === b[p]) p++;
      return jaro + p * 0.1 * (1 - jaro);
    }
    function cosine(a, b) {
      const grams = (s) => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
      const A = grams(a), B = grams(b);
      let dot = 0, na = 0, nb = 0;
      for (const [g, v] of A) { na += v * v; if (B.has(g)) dot += v * B.get(g); }
      for (const v of B.values()) nb += v * v;
      return na && nb ? dot / Math.sqrt(na * nb) : 0;
    }
    $('#df-run').onclick = () => {
      const a = $('#df-a').value, b = $('#df-b').value;
      const al = a.split(/\r\n|\r|\n/), bl = b.split(/\r\n|\r|\n/);
      const diff = lcsDiff(al, bl);
      if (!diff) { $('#df-out').textContent = '文本行数过多，请分段对比。'; return; }
      let add = 0, del = 0;
      $('#df-out').innerHTML = diff.map(([t, l]) => {
        if (t === 'add') { add++; return `<span style="color:#34d399">+ ${esc(l)}</span>`; }
        if (t === 'del') { del++; return `<span style="color:#fb7185">- ${esc(l)}</span>`; }
        return `<span class="dim">  ${esc(l)}</span>`;
      }).join('\n');
      $('#df-meta').textContent = `新增 ${add} 行，删除 ${del} 行`;
      const bigrams = (s) => s.toLowerCase();
      const lev = levenshtein(bigrams(a), bigrams(b));
      const max = Math.max(a.length, b.length) || 1;
      const scores = [
        ['相似度', ((1 - lev / max) * 100).toFixed(1) + '%'],
        ['Jaro-Winkler', (jaroWinkler(bigrams(a), bigrams(b)) * 100).toFixed(1) + '%'],
        ['余弦相似度', (cosine(bigrams(a), bigrams(b)) * 100).toFixed(1) + '%'],
        ['编辑距离', lev]
      ];
      $('#df-scores').innerHTML = scores.map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
    };
  },

  /* ================= 信息提取 ================= */
  'text-extract'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>输入文本</b><span class="hint">从杂乱文本中抽取结构化信息</span></div>
          <textarea class="ta" id="te-in" rows="8" placeholder="粘贴文本，自动提取其中的手机号、邮箱、链接、日期等…"></textarea>
          <div class="row" style="margin-top:10px">
            ${[['phone', '手机号'], ['email', '邮箱'], ['url', 'URL'], ['ip', 'IP 地址'], ['date', '日期'], ['money', '金额'], ['idcard', '身份证'], ['number', '数字']].map(([k, n]) => `<label class="chip" style="cursor:pointer"><input type="checkbox" data-type="${k}" ${['phone', 'email', 'url'].includes(k) ? 'checked' : ''}> ${n}</label>`).join('')}
          </div>
          <div class="row" style="margin-top:10px">
            <button class="btn primary" id="te-run">提取</button>
            <label class="row" style="gap:5px"><input type="checkbox" id="te-uniq" checked> 去重</label>
            <button class="btn" id="te-copy">复制全部</button>
          </div>
        </div>
        <div id="te-res" class="tool-ui"></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const rules = {
      phone: { name: '手机号', re: /(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)/g },
      email: { name: '邮箱', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
      url: { name: 'URL', re: /https?:\/\/[^\s<>"')，。；]+/g },
      ip: { name: 'IP 地址', re: /(?<!\d)(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?!\d)/g },
      date: { name: '日期', re: /(?:\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)|(?:\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/g },
      money: { name: '金额', re: /[¥￥$€£]\s?\d[\d,]*(?:\.\d{1,2})?|\d[\d,]*(?:\.\d{1,2})?\s?(?:元|美元|欧元|英镑)/g },
      idcard: { name: '身份证', re: /(?<!\d)\d{17}[\dXx](?!\d)/g },
      number: { name: '数字', re: /(?<![.\d])-?\d+(?:\.\d+)?(?![.\d])/g }
    };
    $('#te-run').onclick = () => {
      const text = $('#te-in').value;
      const uniq = $('#te-uniq').checked;
      const blocks = [];
      root.querySelectorAll('[data-type]:checked').forEach((cb) => {
        const rule = rules[cb.dataset.type];
        let list = text.match(rule.re) || [];
        list = list.map((s) => s.trim());
        if (uniq) list = [...new Set(list)];
        blocks.push(`<div class="panel"><div class="panel-head"><b>${rule.name}</b><span class="hint">${list.length} 项</span></div>
          ${list.length ? `<div class="row" style="gap:6px">${list.map((v) => `<span class="chip" style="cursor:pointer" data-copy="${esc(v)}">${esc(v)}</span>`).join('')}</div>` : '<div class="hint">没有匹配</div>'}</div>`);
      });
      $('#te-res').innerHTML = blocks.join('') || '<div class="empty">请至少选择一种类型</div>';
      $('#te-res').querySelectorAll('[data-copy]').forEach((el) => el.addEventListener('click', () => copy(el.dataset.copy)));
    };
    $('#te-copy').onclick = () => {
      const all = [...root.querySelectorAll('[data-copy]')].map((x) => x.dataset.copy);
      if (all.length) copy(all.join('\n')); else toast('还没有结果');
    };
  },

  /* ================= 文本脱敏 ================= */
  'text-mask'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>原文</b><span class="hint">脱敏在本机完成</span></div>
          <textarea class="ta" id="tm-in" rows="8" placeholder="粘贴包含手机号、邮箱、姓名等信息的文本…"></textarea>
          <div class="grid3" style="margin-top:10px">
            <div class="field"><label class="lab">脱敏选项</label>
              <div class="row" style="gap:8px;height:38px">
                <label class="row" style="gap:4px"><input type="checkbox" id="tm-phone" checked> 手机</label>
                <label class="row" style="gap:4px"><input type="checkbox" id="tm-email" checked> 邮箱</label>
                <label class="row" style="gap:4px"><input type="checkbox" id="tm-name"> 姓名</label>
                <label class="row" style="gap:4px"><input type="checkbox" id="tm-bank" checked> 银行卡</label>
                <label class="row" style="gap:4px"><input type="checkbox" id="tm-id" checked> 身份证</label>
              </div></div>
            <div class="field"><label class="lab">遮罩字符</label><select class="sel" id="tm-char"><option value="*">星号 *</option><option value="●">圆点 ●</option><option value="x">小写 x</option></select></div>
            <div class="field"><label class="lab">自定义敏感词（逗号分隔）</label><input class="inp" id="tm-words" placeholder="例如：内部, 机密, 张三"></div>
          </div>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="tm-run">脱敏</button><button class="btn" id="tm-copy">复制</button><span class="hint" id="tm-meta"></span></div>
        </div>
        <div class="panel"><div class="panel-head"><b>脱敏结果</b></div><pre class="out" id="tm-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const mask = (n, c) => c.repeat(n);
    $('#tm-run').onclick = () => {
      let s = $('#tm-in').value;
      let hits = 0;
      const c = $('#tm-char').value;
      if ($('#tm-phone').checked) s = s.replace(/(?<!\d)(1[3-9]\d)(\d{4})(\d{4})(?!\d)/g, (m, a, b, d) => { hits++; return a + mask(b.length, c) + d; });
      if ($('#tm-id').checked) s = s.replace(/(?<!\d)(\d{6})(\d{8})(\d{3}[\dXx])(?!\d)/g, (m, a, b, d) => { hits++; return a + mask(b.length, c) + d; });
      if ($('#tm-bank').checked) s = s.replace(/(?<!\d)(\d{4})(\d{8,11})(\d{4})(?!\d)/g, (m, a, b, d) => { hits++; return a + mask(b.length, c) + d; });
      if ($('#tm-email').checked) s = s.replace(/([A-Za-z0-9._%+-]{1,2})([A-Za-z0-9._%+-]*)(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, (m, a, b, d) => { hits++; return a + mask(Math.min(6, Math.max(2, b.length)), c) + d; });
      if ($('#tm-name').checked) s = s.replace(/(?<![\u4e00-\u9fa5])[\u4e00-\u9fa5]{2,3}(?=先生|女士|老师|同学|经理|总|，|。|\s|$)/g, (m) => { hits++; return m[0] + mask(m.length - 1, c); });
      const words = $('#tm-words').value.split(/[,，\s]+/).filter(Boolean);
      for (const w of words) {
        s = s.replaceAll(w, (m) => { hits++; return mask(m.length, c); });
      }
      $('#tm-out').textContent = s;
      $('#tm-meta').textContent = `共处理 ${hits} 处`;
    };
    $('#tm-copy').onclick = () => copy($('#tm-out').textContent);
  },

  /* ================= 文本编码与转义 ================= */
  'text-escape'(root) {
    const formats = [
      ['base64', 'Base64'], ['url', 'URL 编码'], ['unicode', 'Unicode 转义'],
      ['html', 'HTML 实体'], ['json', 'JSON 字符串'], ['sql', 'SQL 字符串'],
      ['regex', '正则转义'], ['shell', 'Shell 引号'], ['yaml', 'YAML 标量'], ['markdown', 'Markdown 转义'], ['csv', 'CSV 字段']
    ];
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>输入</b><span class="hint">所有转换在本地完成</span></div>
          <textarea class="ta mono" id="tse-in" rows="7" placeholder="输入需要编码或转义的文本…"></textarea>
          <div class="grid2" style="margin-top:10px">
            <div class="field"><label class="lab">格式</label><select class="sel" id="tse-fmt">${formats.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select></div>
            <div class="field"><label class="lab">方向</label><select class="sel" id="tse-dir"><option value="enc">编码 / 转义</option><option value="dec">解码 / 还原</option></select></div>
          </div>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="tse-run">转换</button><button class="btn" id="tse-copy">复制</button></div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b></div><pre class="out" id="tse-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const b64enc = (s) => {
      const bytes = new TextEncoder().encode(s);
      let bin = '';
      bytes.forEach((b) => { bin += String.fromCharCode(b); });
      return btoa(bin);
    };
    const b64dec = (s) => {
      const bin = atob(s.trim());
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    };
    const unescapeHtml = (s) => { const d = document.createElement('textarea'); d.innerHTML = s; return d.value; };
    $('#tse-run').onclick = () => {
      const s = $('#tse-in').value;
      const fmt = $('#tse-fmt').value;
      const dec = $('#tse-dir').value === 'dec';
      let out = '';
      try {
        if (fmt === 'base64') out = dec ? b64dec(s) : b64enc(s);
        else if (fmt === 'url') out = dec ? decodeURIComponent(s) : encodeURIComponent(s);
        else if (fmt === 'unicode') {
          out = dec
            ? s.replace(/\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})/g, (m, a, b) => String.fromCodePoint(parseInt(a || b, 16)))
            : [...s].map((ch) => ch.codePointAt(0) > 0xffff ? `\\u{${ch.codePointAt(0).toString(16)}}` : `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`).join('');
        } else if (fmt === 'html') {
          out = dec ? unescapeHtml(s) : s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        } else if (fmt === 'json') {
          out = dec ? JSON.parse(s) : JSON.stringify(s);
        } else if (fmt === 'sql') {
          out = dec ? s.replace(/''/g, "'") : "'" + s.replace(/'/g, "''") + "'";
        } else if (fmt === 'regex') {
          out = dec ? s.replace(/\\(.)/g, '$1') : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        } else if (fmt === 'shell') {
          out = dec ? s.replace(/'\\''/g, "'").replace(/^'|'$/g, '') : "'" + s.replace(/'/g, "'\\''") + "'";
        } else if (fmt === 'yaml') {
          out = dec ? s.replace(/^'|'$/g, '').replace(/''/g, "'") : "'" + s.replace(/'/g, "''") + "'";
        } else if (fmt === 'markdown') {
          out = dec ? s.replace(/\\([\\`*_{}\[\]()#+\-.!>|])/g, '$1') : s.replace(/([\\`*_{}\[\]()#+\-.!>|])/g, '\\$1');
        } else if (fmt === 'csv') {
          out = dec ? s.replace(/^"|"$/g, '').replace(/""/g, '"') : '"' + s.replace(/"/g, '""') + '"';
        }
      } catch (e) { out = '转换失败：' + e.message; }
      $('#tse-out').textContent = out;
    };
    $('#tse-copy').onclick = () => copy($('#tse-out').textContent);
    $('#tse-run').click();
  },

  /* ================= 古典密码 ================= */
  'cipher-classic'(root) {
    const morse = {
      A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
      K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
      U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
      0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
      '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-', '"': '.-..-.', '$': '...-..-', '@': '.--.-.'
    };
    const revMorse = Object.fromEntries(Object.entries(morse).map(([k, v]) => [v, k]));
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>输入</b><span class="hint">古典密码仅用于学习与趣味，不要用于真实加密</span></div>
          <textarea class="ta mono" id="cp-in" rows="7">Hello World</textarea>
          <div class="grid3" style="margin-top:10px">
            <div class="field"><label class="lab">算法</label><select class="sel" id="cp-mode">
              <option value="morse">摩斯电码</option><option value="rot13">ROT13</option><option value="caesar">凯撒密码</option>
              <option value="vigenere">维吉尼亚密码</option><option value="bacon">培根密码</option><option value="atbash">Atbash 反转字母表</option>
              <option value="reverse">文本反转</option><option value="mirror">镜像文本</option>
            </select></div>
            <div class="field"><label class="lab">密钥 / 位移</label><input class="inp" id="cp-key" value="3" placeholder="凯撒填数字，维吉尼亚填单词"></div>
            <div class="field"><label class="lab">方向</label><select class="sel" id="cp-dir"><option value="enc">加密</option><option value="dec">解密</option></select></div>
          </div>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="cp-run">转换</button><button class="btn" id="cp-copy">复制</button></div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b></div><pre class="out" id="cp-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const caesar = (s, n) => s.replace(/[a-z]/gi, (c) => {
      const base = c <= 'Z' ? 65 : 97;
      return String.fromCharCode((c.charCodeAt(0) - base + n + 26) % 26 + base);
    });
    const vigenere = (s, key, dir) => {
      const k = key.toLowerCase().replace(/[^a-z]/g, '');
      if (!k) return s;
      let j = 0;
      return s.replace(/[a-z]/gi, (c) => {
        const base = c <= 'Z' ? 65 : 97;
        const shift = k.charCodeAt(j % k.length) - 97;
        j++;
        return String.fromCharCode((c.charCodeAt(0) - base + (dir === 'dec' ? -shift : shift) + 26) % 26 + base);
      });
    };
    const bacon = (s) => [...s.toUpperCase()].map((c) => {
      const i = c.charCodeAt(0) - 65;
      if (i < 0 || i > 25) return c;
      return i.toString(2).padStart(5, '0').replace(/0/g, 'A').replace(/1/g, 'B');
    }).join(' ');
    const unBacon = (s) => s.replace(/[ABab\s]{5,}/g, (m) => {
      return m.trim().split(/\s+/).map((g) => g.length === 5 ? String.fromCharCode(parseInt(g.toUpperCase().replace(/A/g, '0').replace(/B/g, '1'), 2) + 65) : '').join('');
    });
    const atbash = (s) => s.replace(/[a-z]/gi, (c) => {
      const base = c <= 'Z' ? 65 : 97;
      return String.fromCharCode(base + 25 - (c.charCodeAt(0) - base));
    });
    const mirrorMap = { '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<', 'b': 'd', 'd': 'b', 'p': 'q', 'q': 'p' };
    $('#cp-run').onclick = () => {
      const s = $('#cp-in').value;
      const mode = $('#cp-mode').value;
      const dir = $('#cp-dir').value;
      const key = $('#cp-key').value;
      let out = '';
      if (mode === 'morse') {
        if (dir === 'enc') out = [...s.toUpperCase()].map((c) => c === ' ' ? '/' : (morse[c] || c)).join(' ');
        else out = s.trim().split(/\s+/).map((t) => t === '/' ? ' ' : (revMorse[t] || t)).join('');
      } else if (mode === 'rot13') out = caesar(s, 13);
      else if (mode === 'caesar') { const n = ((parseInt(key, 10) || 3) % 26 + 26) % 26; out = caesar(s, dir === 'dec' ? -n : n); }
      else if (mode === 'vigenere') out = vigenere(s, key, dir);
      else if (mode === 'bacon') out = dir === 'enc' ? bacon(s) : unBacon(s);
      else if (mode === 'atbash') out = atbash(s);
      else if (mode === 'reverse') out = [...s].reverse().join('');
      else out = [...s].reverse().map((c) => mirrorMap[c] || c).join('');
      $('#cp-out').textContent = out;
    };
    $('#cp-copy').onclick = () => copy($('#cp-out').textContent);
    $('#cp-run').click();
  },

  /* ================= Unicode ================= */
  'unicode-tools'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>输入</b><span class="hint">检测零宽字符、同形异义与编码异常</span></div>
          <textarea class="ta mono" id="ut-in" rows="7" placeholder="粘贴文本…"></textarea>
          <div class="row" style="margin-top:10px">
            <select class="sel" id="ut-mode" style="max-width:240px">
              <option value="NFC">规范化 NFC</option><option value="NFD">规范化 NFD</option>
              <option value="NFKC">规范化 NFKC</option><option value="NFKD">规范化 NFKD</option>
              <option value="full2half">全角 → 半角</option><option value="half2full">半角 → 全角</option>
              <option value="zero">检测零宽字符</option><option value="rmzero">移除零宽字符</option>
              <option value="invisible">检测不可见字符</option><option value="bom">BOM 检测/移除</option>
              <option value="confusable">同形异义检测</option>
            </select>
            <button class="btn primary" id="ut-run">执行</button>
            <button class="btn" id="ut-copy">复制</button>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b><span class="hint" id="ut-meta"></span></div><pre class="out" id="ut-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const confusables = { 'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'і': 'i', 'ј': 'j', 'ѕ': 's', 'ԁ': 'd', 'ɡ': 'g', 'ο': 'o', 'α': 'a', 'ν': 'v', 'ι': 'i', 'κ': 'k', 'ρ': 'p', 'τ': 't', 'υ': 'u', 'χ': 'x', 'ӏ': 'l' };
    $('#ut-run').onclick = () => {
      let s = $('#ut-in').value;
      const mode = $('#ut-mode').value;
      const lines = [];
      if (['NFC', 'NFD', 'NFKC', 'NFKD'].includes(mode)) {
        const before = s;
        s = s.normalize(mode);
        lines.push(`已按 ${mode} 规范化`, `长度：${[...before].length} → ${[...s].length}`);
      } else if (mode === 'full2half') {
        s = s.replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/\u3000/g, ' ');
        lines.push('全角字符已转换为半角');
      } else if (mode === 'half2full') {
        s = s.replace(/[!-~]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xFEE0)).replace(/ /g, '\u3000');
        lines.push('半角字符已转换为全角');
      } else if (mode === 'zero' || mode === 'rmzero') {
        const re = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;
        const found = [...s.matchAll(re)];
        lines.push(`发现 ${found.length} 个零宽/方向控制字符`);
        if (found.length) lines.push([...new Set(found.map((m) => 'U+' + m[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0')))].join('、'));
        if (mode === 'rmzero') { s = s.replace(re, ''); lines.push('已全部移除'); }
      } else if (mode === 'invisible') {
        const bad = [...s.matchAll(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u00AD\u034F\u061C\u180E]/g)];
        lines.push(`发现 ${bad.length} 个不可见控制字符`);
        if (bad.length) lines.push([...new Set(bad.map((m) => 'U+' + m[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0')))].join('、'));
      } else if (mode === 'bom') {
        if (s.charCodeAt(0) === 0xFEFF) { s = s.slice(1); lines.push('检测到 BOM，已移除'); }
        else lines.push('未检测到 BOM');
      } else if (mode === 'confusable') {
        const hits = [];
        [...s].forEach((c, i) => { if (confusables[c]) hits.push(`位置 ${i}：${c} (U+${c.codePointAt(0).toString(16).toUpperCase()}) 疑似 ${confusables[c]}`); });
        lines.push(hits.length ? `发现 ${hits.length} 个同形异义字符` : '未发现常见同形异义字符');
        lines.push(...hits.slice(0, 30));
        s = s;
      }
      $('#ut-out').textContent = s + (lines.length ? '\n\n— ' + lines.join('\n— ') : '');
      $('#ut-meta').textContent = `${[...s].length} 个字符 · ${byteLen(s)} 字节`;
    };
    $('#ut-copy').onclick = () => copy($('#ut-out').textContent);
  },

  /* ================= 中文转换 ================= */
  'cn-convert'(root) {
    // 上面的繁简表若长度不一致会自动回退为只处理常用字，见下方安全处理
    const commonPairs = [
      ['爱', '愛'], ['办', '辦'], ['帮', '幫'], ['报', '報'], ['备', '備'], ['贝', '貝'], ['笔', '筆'], ['毕', '畢'], ['边', '邊'], ['变', '變'],
      ['标', '標'], ['表', '錶'], ['别', '別'], ['宾', '賓'], ['补', '補'], ['参', '參'], ['仓', '倉'], ['产', '產'], ['长', '長'], ['场', '場'],
      ['车', '車'], ['彻', '徹'], ['陈', '陳'], ['称', '稱'], ['成', '成'], ['承', '承'], ['城', '城'], ['程', '程'], ['吃', '吃'], ['迟', '遲'],
      ['持', '持'], ['冲', '沖'], ['出', '出'], ['处', '處'], ['传', '傳'], ['创', '創'], ['纯', '純'], ['词', '詞'], ['从', '從'], ['村', '村'],
      ['错', '錯'], ['达', '達'], ['带', '帶'], ['单', '單'], ['担', '擔'], ['当', '當'], ['党', '黨'], ['导', '導'], ['岛', '島'], ['到', '到'],
      ['德', '德'], ['灯', '燈'], ['邓', '鄧'], ['敌', '敵'], ['底', '底'], ['地', '地'], ['点', '點'], ['电', '電'], ['调', '調'], ['东', '東'],
      ['动', '動'], ['都', '都'], ['读', '讀'], ['断', '斷'], ['对', '對'], ['队', '隊'], ['吨', '噸'], ['夺', '奪'], ['发', '發'], ['法', '法'],
      ['反', '反'], ['饭', '飯'], ['范', '範'], ['飞', '飛'], ['费', '費'], ['分', '分'], ['风', '風'], ['丰', '豐'], ['风', '風'], ['复', '復'],
      ['干', '乾'], ['赶', '趕'], ['刚', '剛'], ['钢', '鋼'], ['个', '個'], ['给', '給'], ['跟', '跟'], ['工', '工'], ['公', '公'], ['功', '功'],
      ['共', '共'], ['够', '夠'], ['构', '構'], ['购', '購'], ['古', '古'], ['关', '關'], ['观', '觀'], ['管', '管'], ['光', '光'], ['广', '廣'],
      ['规', '規'], ['国', '國'], ['过', '過'], ['还', '還'], ['海', '海'], ['韩', '韓'], ['汉', '漢'], ['号', '號'], ['合', '合'], ['和', '和'],
      ['红', '紅'], ['后', '後'], ['护', '護'], ['华', '華'], ['画', '畫'], ['话', '話'], ['怀', '懷'], ['欢', '歡'], ['环', '環'], ['换', '換'],
      ['回', '回'], ['会', '會'], ['机', '機'], ['鸡', '雞'], ['积', '積'], ['极', '極'], ['级', '級'], ['计', '計'], ['记', '記'], ['纪', '紀'],
      ['济', '濟'], ['家', '家'], ['价', '價'], ['间', '間'], ['见', '見'], ['将', '將'], ['讲', '講'], ['交', '交'], ['教', '教'], ['结', '結'],
      ['节', '節'], ['进', '進'], ['近', '近'], ['经', '經'], ['静', '靜'], ['九', '九'], ['旧', '舊'], ['举', '舉'], ['据', '據'], ['军', '軍'],
      ['开', '開'], ['看', '看'], ['课', '課'], ['空', '空'], ['口', '口'], ['库', '庫'], ['快', '快'], ['来', '來'], ['劳', '勞'], ['老', '老'],
      ['乐', '樂'], ['离', '離'], ['里', '裡'], ['历', '歷'], ['丽', '麗'], ['连', '連'], ['联', '聯'], ['脸', '臉'], ['练', '練'], ['量', '量'],
      ['两', '兩'], ['疗', '療'], ['了', '了'], ['临', '臨'], ['领', '領'], ['龙', '龍'], ['楼', '樓'], ['陆', '陸'], ['录', '錄'], ['乱', '亂'],
      ['论', '論'], ['罗', '羅'], ['马', '馬'], ['买', '買'], ['卖', '賣'], ['满', '滿'], ['没', '沒'], ['门', '門'], ['们', '們'], ['梦', '夢'],
      ['面', '面'], ['民', '民'], ['明', '明'], ['名', '名'], ['难', '難'], ['内', '內'], ['能', '能'], ['年', '年'], ['鸟', '鳥'], ['宁', '寧'],
      ['农', '農'], ['女', '女'], ['欧', '歐'], ['盘', '盤'], ['票', '票'], ['品', '品'], ['气', '氣'], ['钱', '錢'], ['强', '強'], ['亲', '親'],
      ['轻', '輕'], ['请', '請'], ['庆', '慶'], ['穷', '窮'], ['区', '區'], ['权', '權'], ['全', '全'], ['劝', '勸'], ['热', '熱'], ['认', '認'],
      ['让', '讓'], ['荣', '榮'], ['软', '軟'], ['赛', '賽'], ['三', '三'], ['丧', '喪'], ['扫', '掃'], ['色', '色'], ['杀', '殺'], ['山', '山'],
      ['伤', '傷'], ['商', '商'], ['上', '上'], ['烧', '燒'], ['少', '少'], ['设', '設'], ['社', '社'], ['谁', '誰'], ['身', '身'], ['深', '深'],
      ['什', '什'], ['生', '生'], ['声', '聲'], ['省', '省'], ['胜', '勝'], ['师', '師'], ['时', '時'], ['识', '識'], ['实', '實'], ['十', '十'],
      ['石', '石'], ['使', '使'], ['世', '世'], ['适', '適'], ['收', '收'], ['手', '手'], ['书', '書'], ['树', '樹'], ['数', '數'], ['双', '雙'],
      ['谁', '誰'], ['水', '水'], ['说', '說'], ['思', '思'], ['四', '四'], ['送', '送'], ['算', '算'], ['虽', '雖'], ['随', '隨'], ['岁', '歲'],
      ['孙', '孫'], ['所', '所'], ['台', '臺'], ['太', '太'], ['态', '態'], ['谈', '談'], ['唐', '唐'], ['讨', '討'], ['特', '特'], ['题', '題'],
      ['体', '體'], ['天', '天'], ['条', '條'], ['铁', '鐵'], ['听', '聽'], ['同', '同'], ['统', '統'], ['头', '頭'], ['图', '圖'], ['团', '團'],
      ['推', '推'], ['外', '外'], ['万', '萬'], ['王', '王'], ['王', '王'], ['网', '網'], ['为', '為'], ['卫', '衛'], ['位', '位'], ['文', '文'],
      ['问', '問'], ['我', '我'], ['无', '無'], ['五', '五'], ['务', '務'], ['物', '物'], ['西', '西'], ['习', '習'], ['洗', '洗'], ['系', '系'],
      ['戏', '戲'], ['下', '下'], ['先', '先'], ['显', '顯'], ['现', '現'], ['线', '線'], ['相', '相'], ['想', '想'], ['向', '向'], ['小', '小'],
      ['校', '校'], ['笑', '笑'], ['些', '些'], ['写', '寫'], ['谢', '謝'], ['心', '心'], ['新', '新'], ['信', '信'], ['星', '星'], ['行', '行'],
      ['形', '形'], ['兴', '興'], ['学', '學'], ['压', '壓'], ['亚', '亞'], ['严', '嚴'], ['言', '言'], ['研', '研'], ['眼', '眼'], ['演', '演'],
      ['样', '樣'], ['要', '要'], ['药', '藥'], ['也', '也'], ['业', '業'], ['叶', '葉'], ['页', '頁'], ['一', '一'], ['医', '醫'], ['衣', '衣'],
      ['以', '以'], ['艺', '藝'], ['亿', '億'], ['义', '義'], ['议', '議'], ['因', '因'], ['阴', '陰'], ['应', '應'], ['英', '英'], ['营', '營'],
      ['影', '影'], ['用', '用'], ['优', '優'], ['由', '由'], ['邮', '郵'], ['有', '有'], ['又', '又'], ['于', '於'], ['与', '與'], ['语', '語'],
      ['育', '育'], ['元', '元'], ['员', '員'], ['原', '原'], ['远', '遠'], ['院', '院'], ['愿', '願'], ['月', '月'], ['云', '雲'], ['运', '運'],
      ['杂', '雜'], ['在', '在'], ['战', '戰'], ['张', '張'], ['长', '長'], ['找', '找'], ['这', '這'], ['真', '真'], ['政', '政'], ['之', '之'],
      ['支', '支'], ['只', '只'], ['知', '知'], ['织', '織'], ['直', '直'], ['职', '職'], ['止', '止'], ['纸', '紙'], ['指', '指'], ['制', '制'],
      ['质', '質'], ['治', '治'], ['中', '中'], ['钟', '鐘'], ['种', '種'], ['众', '眾'], ['重', '重'], ['周', '周'], ['州', '州'], ['主', '主'],
      ['住', '住'], ['注', '註'], ['专', '專'], ['转', '轉'], ['装', '裝'], ['状', '狀'], ['准', '準'], ['资', '資'], ['子', '子'], ['字', '字'],
      ['自', '自'], ['总', '總'], ['走', '走'], ['组', '組'], ['祖', '祖'], ['最', '最'], ['左', '左'], ['作', '作'], ['坐', '坐'], ['座', '座']
    ];
    const s2t = new Map(commonPairs);
    const t2s = new Map(commonPairs.map(([a, b]) => [b, a]));
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>中文转换</b><span class="hint">简繁转换使用常用字表，生僻字可能不完整</span></div>
          <textarea class="ta" id="cn-in" rows="7">这是一个简体中文示例：时间、学习、发展、电脑、网络。</textarea>
          <div class="row" style="margin-top:10px">
            <select class="sel" id="cn-mode" style="max-width:220px">
              <option value="s2t">简体 → 繁体</option><option value="t2s">繁体 → 简体</option>
              <option value="num2cn">阿拉伯数字 → 中文</option><option value="cn2num">中文数字 → 阿拉伯</option>
              <option value="money">金额转中文大写</option><option value="vertical">转竖排文本</option>
              <option value="punct2en">中文标点 → 英文</option><option value="punct2cn">英文标点 → 中文</option>
            </select>
            <button class="btn primary" id="cn-run">转换</button>
            <button class="btn" id="cn-copy">复制</button>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b></div><pre class="out" id="cn-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const num2cn = (num) => {
      const digits = '零一二三四五六七八九';
      const units = ['', '十', '百', '千'];
      const bigs = ['', '万', '亿', '兆'];
      if (num === 0) return '零';
      let s = String(num);
      if (s.length > 16) return s;
      let out = '', bigIdx = 0;
      while (s.length) {
        const part = s.slice(-4);
        s = s.slice(0, -4);
        let partOut = '', zero = false;
        for (let i = 0; i < part.length; i++) {
          const d = +part[i];
          const u = units[part.length - 1 - i];
          if (d === 0) { zero = true; continue; }
          if (zero) { partOut += '零'; zero = false; }
          partOut += digits[d] + u;
        }
        if (partOut) out = partOut + bigs[bigIdx] + out;
        else if (out && !out.startsWith('零')) out = '零' + out;
        bigIdx++;
      }
      return out.replace(/^零+/, '').replace(/零+/g, '零').replace(/零$/, '');
    };
    const cn2num = (s) => {
      const d = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
      const u = { 十: 10, 百: 100, 千: 1000 };
      let total = 0, section = 0, number = 0;
      for (const ch of s) {
        if (ch in d) number = d[ch];
        else if (ch in u) { if (!number) number = 1; section += number * u[ch]; number = 0; }
        else if (ch === '万') { section = (section + number) * 10000; total += section; section = 0; number = 0; }
        else if (ch === '亿') { section = (section + number) * 100000000; total += section; section = 0; number = 0; }
      }
      return total + section + number;
    };
    const moneyUpper = (n) => {
      const digits = '零壹贰叁肆伍陆柒捌玖';
      const units = ['', '拾', '佰', '仟'];
      const bigs = ['', '万', '亿'];
      const [int, dec] = String(n).split('.');
      let out = '';
      let s = int, idx = 0;
      while (s.length) {
        const part = s.slice(-4); s = s.slice(0, -4);
        let po = '', zero = false;
        for (let i = 0; i < part.length; i++) {
          const d = +part[i], u = units[part.length - 1 - i];
          if (!d) { zero = true; continue; }
          if (zero) { po += '零'; zero = false; }
          po += digits[d] + u;
        }
        if (po) out = po + bigs[idx] + out;
        idx++;
      }
      out = out || '零';
      out += '元';
      const jiao = Number(dec?.[0] || 0), fen = Number(dec?.[1] || 0);
      if (jiao) out += digits[jiao] + '角';
      if (fen) out += digits[fen] + '分';
      if (!jiao && !fen) out += '整';
      return out;
    };
    $('#cn-run').onclick = () => {
      const s = $('#cn-in').value;
      const mode = $('#cn-mode').value;
      let out = s;
      if (mode === 's2t') out = [...s].map((c) => s2t.get(c) || c).join('');
      else if (mode === 't2s') out = [...s].map((c) => t2s.get(c) || c).join('');
      else if (mode === 'num2cn') out = s.replace(/\d+/g, (n) => num2cn(Number(n)));
      else if (mode === 'cn2num') out = s.replace(/[零一二两三四五六七八九十百千万亿]+/g, (n) => String(cn2num(n)));
      else if (mode === 'money') out = s.replace(/\d+(?:\.\d{1,2})?/g, (n) => moneyUpper(n));
      else if (mode === 'vertical') out = [...s.replace(/\n/g, '')].join('\n');
      else if (mode === 'punct2en') out = s.replace(/[，。！？；：、“”‘’（）【】《》]/g, (c) => ({ '，': ',', '。': '.', '！': '!', '？': '?', '；': ';', '：': ':', '、': ',', '“': '"', '”': '"', '‘': "'", '’': "'", '（': '(', '）': ')', '【': '[', '】': ']', '《': '<', '》': '>' }[c] || c));
      else out = s.replace(/[,!?;:"]/g, (c) => ({ ',': '，', '!': '！', '?': '？', ';': '；', ':': '：', '"': '“' }[c] || c));
      $('#cn-out').textContent = out;
    };
    $('#cn-copy').onclick = () => copy($('#cn-out').textContent);
    $('#cn-run').click();
  },

  /* ================= SEO 文案 ================= */
  'seo-text'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>文章内容</b><span class="hint">检查标题/描述长度与关键词密度</span></div>
          <div class="grid2">
            <div class="field"><label class="lab">标题</label><input class="inp" id="seo-title" placeholder="页面标题"></div>
            <div class="field"><label class="lab">目标关键词</label><input class="inp" id="seo-key" placeholder="例如：浏览器工具箱"></div>
          </div>
          <div class="field" style="margin-top:9px"><label class="lab">描述</label><textarea class="ta" id="seo-desc" rows="2" placeholder="页面描述"></textarea></div>
          <textarea class="ta" id="seo-body" rows="6" style="margin-top:9px" placeholder="正文内容…">空天工具合集是一个完全运行在浏览器里的工具箱，提供文本处理、编码转换、图片压缩、PDF 工具与二维码生成等常用功能，所有文件都在本地处理，不上传服务器。</textarea>
          <button class="btn primary" style="margin-top:10px" id="seo-run">分析</button>
        </div>
        <div class="stat-grid" id="seo-stats"></div>
        <div class="panel"><div class="panel-head"><b>优化建议</b></div><div id="seo-tips" class="hint"></div></div>
        <div class="panel"><div class="panel-head"><b>关键词密度</b></div><div id="seo-density" class="hint"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#seo-run').onclick = () => {
      const title = $('#seo-title').value.trim();
      const desc = $('#seo-desc').value.trim();
      const body = $('#seo-body').value;
      const key = $('#seo-key').value.trim().toLowerCase();
      const tLen = [...title].length, dLen = [...desc].length;
      const text = body + ' ' + desc + ' ' + title;
      const words = (text.match(/[\u4e00-\u9fa5]|[A-Za-z0-9]+/g) || []);
      const total = words.length || 1;
      const keyCount = key ? (text.toLowerCase().match(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length : 0;
      const density = key ? (keyCount * [...key].length / total * 100) : 0;
      const sentences = (body.match(/[.!?。！？]/g) || []).length || 1;
      const avg = [...body].length / sentences;
      const score = Math.max(0, Math.min(100, Math.round(100 - Math.abs(avg - 22) * 1.5 - (title.length > 60 ? 10 : 0))));
      $('#seo-stats').innerHTML = [
        ['标题长度', tLen + ' 字', tLen >= 10 && tLen <= 60 ? 'ok' : 'warn'],
        ['描述长度', dLen + ' 字', dLen >= 50 && dLen <= 160 ? 'ok' : 'warn'],
        ['正文字数', [...body].length],
        ['关键词次数', keyCount],
        ['关键词密度', density.toFixed(2) + '%', density >= 1 && density <= 3 ? 'ok' : 'warn'],
        ['可读性', score + ' 分']
      ].map(([k, v]) => `<div class="stat"><b style="${v === 'ok' ? 'color:var(--ok)' : v === 'warn' ? 'color:var(--warn)' : ''}">${typeof v === 'string' && v.startsWith('ok') ? '✓' : typeof v === 'string' && v.startsWith('warn') ? '!' : ''} ${k === '标题长度' || k === '描述长度' || k === '关键词密度' ? v.split(' ')[0] : v}</b><span>${k}</span></div>`).join('');
      const tips = [];
      if (tLen > 60) tips.push('标题超过 60 字，搜索结果可能被截断。');
      if (tLen < 10) tips.push('标题偏短，建议补充核心关键词。');
      if (dLen > 160) tips.push('描述超过 160 字，建议精简到 120–160 字。');
      if (dLen < 50) tips.push('描述偏短，建议写清价值点。');
      if (key && density < 1) tips.push('关键词密度低于 1%，可在标题、首段、小标题中自然出现。');
      if (key && density > 3) tips.push('关键词密度高于 3%，可能被视为堆砌，建议降低。');
      if (!key) tips.push('填写目标关键词后可计算密度。');
      tips.push('建议为图片补充 alt，为页面设置 canonical 与 OG 信息。');
      $('#seo-tips').innerHTML = tips.map((x) => `· ${esc(x)}`).join('<br>');
      const freq = new Map();
      for (const w of (text.toLowerCase().match(/[\u4e00-\u9fa5]{2,}|[a-z][a-z0-9-]{1,}/g) || [])) freq.set(w, (freq.get(w) || 0) + 1);
      const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
      $('#seo-density').innerHTML = top.map(([w, n]) => `<span class="chip" style="margin:0 6px 6px 0">${esc(w)} · ${n}</span>`).join('') || '暂无';
    };
    $('#seo-run').click();
  },

  /* ================= Slug ================= */
  'slug-tools'(root) {
    bench(root, {
      title: '标题 / 文件名列表',
      rows: 9,
      value: '空天工具合集：浏览器里的万能工具箱',
      options: `<div class="grid2" style="margin-bottom:9px">
        <div class="field"><label class="lab">模式</label><select class="sel" id="slug-mode">
          <option value="slug">URL Slug</option><option value="file">安全文件名</option><option value="path">路径规范化</option><option value="batch">批量文件名</option>
        </select></div>
        <div class="field"><label class="lab">分隔符</label><select class="sel" id="slug-sep"><option value="-">短横线 -</option><option value="_">下划线 _</option><option value=".">点 .</option></select></div>
      </div>
      <label class="row" style="gap:6px;margin-bottom:6px"><input type="checkbox" id="slug-lower" checked> 转小写</label>`,
      action: '生成',
      run(api) {
        const mode = api.els('#slug-mode').value;
        const sep = api.els('#slug-sep').value;
        const lower = api.els('#slug-lower').checked;
        return api.value.split(/\r?\n/).map((line) => {
          if (mode === 'path') {
            return line.replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/\/\.\//g, '/').replace(/[^\w\u4e00-\u9fa5\-./]/g, '');
          }
          if (mode === 'file') {
            let n = line.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().replace(/\.+$/, '');
            if (lower) n = n.toLowerCase();
            return n || 'untitled';
          }
          let s = line.trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
          s = s.replace(/[^\w\u4e00-\u9fa5]+/g, sep).replace(new RegExp('\\' + sep + '+', 'g'), sep).replace(new RegExp('^\\' + sep + '|\\' + sep + '$', 'g'), '');
          if (!lower) s = s;
          if (mode === 'batch') return String(Math.floor(Math.random() * 900 + 100)) + sep + s;
          return s;
        }).join('\n');
      }
    });
  },

  /* ================= 模板填充 ================= */
  'template-fill'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="grid2 stack">
          <div class="panel">
            <div class="panel-head"><b>模板</b><span class="hint">支持 \{\{变量\}\} 和 \{\{变量|默认值\}\}</span></div>
            <textarea class="ta mono" id="tf-tpl" rows="9">你好，\{\{name\}\}！\n\n欢迎加入 \{\{company|空天团队\}\}。\n你的账号是 \{\{account\}\}，到期时间 \{\{date\}\}。</textarea>
          </div>
          <div class="panel">
            <div class="panel-head"><b>变量（每行 key=value）</b></div>
            <textarea class="ta mono" id="tf-vars" rows="9">name=小明
account=kt-2026
date=2026-12-31</textarea>
          </div>
        </div>
        <div class="row"><button class="btn primary" id="tf-run">渲染</button><button class="btn" id="tf-copy">复制</button><span class="hint" id="tf-meta"></span></div>
        <div class="panel"><div class="panel-head"><b>结果</b></div><pre class="out" id="tf-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#tf-run').onclick = () => {
      const vars = {};
      $('#tf-vars').value.split(/\r?\n/).forEach((line) => {
        const i = line.indexOf('=');
        if (i > 0) vars[line.slice(0, i).trim()] = line.slice(i + 1).trim();
      });
      const missing = new Set();
      const out = $('#tf-tpl').value.replace(/\{\{\s*([\w\u4e00-\u9fa5.]+)\s*(?:\|\s*([^}]*))?\}\}/g, (m, k, def) => {
        if (vars[k] !== undefined) return vars[k];
        if (def !== undefined) return def;
        missing.add(k);
        return m;
      });
      $('#tf-out').textContent = out;
      $('#tf-meta').textContent = missing.size ? '缺少变量：' + [...missing].join(', ') : '渲染完成';
    };
    $('#tf-copy').onclick = () => copy($('#tf-out').textContent);
    $('#tf-run').click();
  },

  /* ================= 文本转语音 ================= */
  'text-speech'(root, ctx) {
    const supported = 'speechSynthesis' in window;
    root.innerHTML = `
      <div class="tool-ui">
        ${supported ? '' : warn('当前浏览器不支持 SpeechSynthesis，请换用 Chrome / Edge / Safari。')}
        <div class="panel">
          <div class="panel-head"><b>朗读文本</b><span class="hint">使用系统内置语音，不联网</span></div>
          <textarea class="ta" id="tts-in" rows="7">空天工具合集，浏览器里的万能工具箱。所有文件都在本地处理，不上传服务器。</textarea>
          <div class="grid3" style="margin-top:10px">
            <div class="field"><label class="lab">语音</label><select class="sel" id="tts-voice"></select></div>
            <div class="field"><label class="lab">语速 <span id="tts-rate-v">1.0</span></label><input type="range" id="tts-rate" min="0.5" max="2" step="0.1" value="1"></div>
            <div class="field"><label class="lab">音调 <span id="tts-pitch-v">1.0</span></label><input type="range" id="tts-pitch" min="0.5" max="2" step="0.1" value="1"></div>
          </div>
          <div class="row" style="margin-top:10px">
            <button class="btn primary" id="tts-play">开始朗读</button>
            <button class="btn" id="tts-pause">暂停</button>
            <button class="btn" id="tts-resume">继续</button>
            <button class="btn danger" id="tts-stop">停止</button>
            <span class="hint" id="tts-status"></span>
          </div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const voices = [];
    const fill = () => {
      const list = speechSynthesis.getVoices();
      if (!list.length) return;
      voices.length = 0; voices.push(...list);
      $('#tts-voice').innerHTML = list.map((v, i) => `<option value="${i}">${esc(v.name)} (${v.lang})</option>`).join('');
      const zh = list.findIndex((v) => /zh|Chinese/i.test(v.lang + v.name));
      if (zh >= 0) $('#tts-voice').value = zh;
    };
    if (supported) { fill(); speechSynthesis.onvoiceschanged = fill; }
    $('#tts-rate').oninput = () => { $('#tts-rate-v').textContent = $('#tts-rate').value; };
    $('#tts-pitch').oninput = () => { $('#tts-pitch-v').textContent = $('#tts-pitch').value; };
    $('#tts-play').onclick = () => {
      if (!supported) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance($('#tts-in').value);
      const v = voices[Number($('#tts-voice').value)];
      if (v) u.voice = v;
      u.rate = Number($('#tts-rate').value);
      u.pitch = Number($('#tts-pitch').value);
      u.onstart = () => { $('#tts-status').textContent = '正在朗读…'; };
      u.onend = () => { $('#tts-status').textContent = '朗读结束'; };
      u.onerror = (e) => { $('#tts-status').textContent = '出错：' + e.error; };
      speechSynthesis.speak(u);
    };
    $('#tts-pause').onclick = () => speechSynthesis.pause();
    $('#tts-resume').onclick = () => speechSynthesis.resume();
    $('#tts-stop').onclick = () => { speechSynthesis.cancel(); $('#tts-status').textContent = '已停止'; };
    ctx.onDestroy(() => { if (supported) speechSynthesis.cancel(); });
  },

  /* ================= 语音转文本 ================= */
  'speech-text'(root, ctx) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    root.innerHTML = `
      <div class="tool-ui">
        ${SR ? '' : warn('当前浏览器不支持 Web Speech API。Chrome / Edge 可用，且通常需要联网；Safari 与 Firefox 支持有限。')}
        <div class="panel">
          <div class="panel-head"><b>实时听写</b><span class="hint">音频由浏览器语音服务处理，可能联网</span></div>
          <div class="grid3">
            <div class="field"><label class="lab">语言</label><select class="sel" id="stt-lang">
              <option value="zh-CN">中文（普通话）</option><option value="en-US">English (US)</option>
              <option value="ja-JP">日本語</option><option value="ko-KR">한국어</option>
            </select></div>
            <div class="field"><label class="lab">模式</label><select class="sel" id="stt-mode"><option value="continuous">连续听写</option><option value="once">单句</option></select></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="stt-start" ${SR ? '' : 'disabled'}>开始</button></div>
          </div>
          <div class="row" style="margin-top:10px"><button class="btn danger" id="stt-stop" ${SR ? '' : 'disabled'}>停止</button><span class="hint" id="stt-status">待机</span></div>
        </div>
        <div class="panel"><div class="panel-head"><b>识别结果</b><button class="btn sm" id="stt-copy">复制</button></div><pre class="out" id="stt-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    if (!SR) return;
    let rec = null;
    let finalText = '';
    $('#stt-start').onclick = () => {
      try {
        rec = new SR();
        rec.lang = $('#stt-lang').value;
        rec.continuous = $('#stt-mode').value === 'continuous';
        rec.interimResults = true;
        rec.onstart = () => { $('#stt-status').textContent = '正在聆听…'; };
        rec.onresult = (e) => {
          let interim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) finalText += e.results[i][0].transcript + '\n';
            else interim += e.results[i][0].transcript;
          }
          $('#stt-out').textContent = finalText + interim;
        };
        rec.onerror = (e) => { $('#stt-status').textContent = '错误：' + e.error; };
        rec.onend = () => { $('#stt-status').textContent = '已停止'; };
        rec.start();
      } catch (e) { toast(e.message, 'err'); }
    };
    $('#stt-stop').onclick = () => { if (rec) rec.stop(); };
    $('#stt-copy').onclick = () => copy($('#stt-out').textContent);
    ctx.onDestroy(() => { if (rec) { try { rec.stop(); } catch { /* ignore */ } } });
  }
};
