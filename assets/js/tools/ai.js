/* 本地文本智能（纯算法，不联网） */
import { esc, copy, toast, download } from '../core/ui.js';

const $ = (root, s) => root.querySelector(s);

const STOP = new Set('的 了 和 是 在 我 有 就 不 人 都 一 一个 上 也 很 到 说 要 去 你 会 着 没有 看 好 自己 这 那 与 及 或 但 并 而 被 把 让 从 对 为 以 于 中 等 可以 我们 他们 这个 那个 以及 通过 进行 使用 一个 一些 什么 如何 为什么 the a an and or but if then of to in on at for with from is are was were be been being this that these those it its as by not no you we they he she i'.split(/\s+/));

function splitSentences(text) {
  return text.replace(/\s+/g, ' ').match(/[^.!?。！？]+[.!?。！？]?/g)?.map((s) => s.trim()).filter((s) => s.length > 4) || [];
}
function tokenize(text) {
  const out = [];
  if (window.Intl && Intl.Segmenter) {
    try {
      const seg = new Intl.Segmenter('zh-CN', { granularity: 'word' });
      for (const s of seg.segment(text)) {
        const w = s.segment.trim().toLowerCase();
        if (s.isWordLike && w.length > 1 && !STOP.has(w)) out.push(w);
      }
      return out;
    } catch { /* */ }
  }
  return (text.toLowerCase().match(/[\u4e00-\u9fa5]{2,}|[a-z][a-z0-9'-]{2,}/g) || []).filter((w) => !STOP.has(w));
}
function keywords(text, limit = 15) {
  const sentences = splitSentences(text);
  const tf = new Map(), df = new Map();
  for (const s of sentences) {
    const words = tokenize(s);
    const seen = new Set();
    for (const w of words) {
      tf.set(w, (tf.get(w) || 0) + 1);
      if (!seen.has(w)) { df.set(w, (df.get(w) || 0) + 1); seen.add(w); }
    }
  }
  const total = sentences.length || 1;
  const scores = [];
  for (const [w, f] of tf) {
    const idf = Math.log(1 + total / (1 + (df.get(w) || 1)));
    scores.push([w, f * idf]);
  }
  return scores.sort((a, b) => b[1] - a[1]).slice(0, limit);
}
function summarize(text, ratio = 0.3) {
  const sentences = splitSentences(text);
  if (sentences.length <= 2) return { summary: sentences.join(''), scores: sentences.map(() => 1) };
  const kw = new Map(keywords(text, 40));
  const scores = sentences.map((s) => {
    const words = tokenize(s);
    if (!words.length) return 0;
    const score = words.reduce((sum, w) => sum + (kw.get(w) || 0), 0) / Math.sqrt(words.length);
    return score * (1 + Math.min(0.4, s.length / 400));
  });
  const n = Math.max(1, Math.min(sentences.length, Math.round(sentences.length * ratio)));
  const ranked = sentences.map((s, i) => ({ s, i, score: scores[i] })).sort((a, b) => b.score - a.score).slice(0, n);
  ranked.sort((a, b) => a.i - b.i);
  return { summary: ranked.map((x) => x.s).join(''), sentences: ranked.map((x) => x.s), scores: scores };
}

const POS = '好 优秀 成功 喜欢 开心 快乐 满意 推荐 值得 高效 方便 清晰 稳定 强大 简洁 快速 便宜 实用 惊喜 完美 信任 安全 放心 舒适 漂亮 感谢 支持 赞 棒 顺利 提升 收获 进步 友好 灵活 优雅 可靠 创新 丰富 流畅 贴心'.split(/\s+/);
const NEG = '差 糟糕 失败 讨厌 难过 生气 失望 退款 卡顿 崩溃 难用 复杂 混乱 缓慢 昂贵 危险 漏洞 错误 问题 投诉 垃圾 后悔 担心 焦虑 麻烦 欺骗 虚假 敷衍 不稳定 崩溃 丢失 损坏 难受 无聊 平庸 落后 脆弱 模糊'.split(/\s+/);

export default {
  /* ================= 本地摘要 ================= */
  'ai-summary'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>TextRank / TF-IDF 摘要</b><span class="hint">纯本地算法，不下载模型</span></div>
          <textarea class="ta" id="as-in" rows="9" placeholder="粘贴文章或长文本…">空天工具合集是一个完全运行在浏览器里的工具箱。它整合了文本处理、编码转换、数据表格、图片处理、PDF 文档、音视频、二维码等常用小功能。所有文件都在本地处理，不会上传到服务器。第三方依赖只在打开对应工具时加载，并在界面中显示下载进度。手机和电脑使用同一套响应式界面，功能完全一致。</textarea>
          <div class="grid3" style="margin-top:9px">
            <div class="field"><label class="lab">摘要比例 <span id="as-ratio-v">0.35</span></label><input type="range" id="as-ratio" min="0.1" max="0.8" step="0.05" value="0.35"></div>
            <div class="field"><label class="lab">关键词数量</label><input class="inp" id="as-kw" type="number" value="12"></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="as-run" style="width:100%">生成摘要</button></div>
          </div>
        </div>
        <div class="stat-grid" id="as-stats"></div>
        <div class="panel"><div class="panel-head"><b>摘要</b><button class="btn sm" id="as-copy">复制</button></div><pre class="out" id="as-out">结果会显示在这里</pre></div>
        <div class="panel"><div class="panel-head"><b>关键词</b></div><div id="as-keywords" class="row" style="gap:6px"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#as-ratio').oninput = () => { $('#as-ratio-v').textContent = $('#as-ratio').value; };
    $('#as-run').onclick = () => {
      const text = $('#as-in').value;
      if (text.trim().length < 20) return toast('文本太短', 'err');
      const ratio = Number($('#as-ratio').value);
      const { summary } = summarize(text, ratio);
      const kw = keywords(text, Math.max(3, Number($('#as-kw').value) || 12));
      const original = text.length;
      $('#as-out').textContent = summary;
      $('#as-stats').innerHTML = [
        ['原文字符', original], ['摘要字符', summary.length], ['压缩率', ((1 - summary.length / original) * 100).toFixed(1)], ['关键词', kw.length]
      ].map(([k, v]) => `<div class="stat"><b>${k === '压缩率' ? v + '%' : v}</b><span>${k}</span></div>`).join('');
      $('#as-keywords').innerHTML = kw.map(([w, s]) => `<span class="chip">${esc(w)} · ${s.toFixed(1)}</span>`).join('');
    };
    $('#as-copy').onclick = () => copy($('#as-out').textContent);
    $('#as-run').click();
  },

  /* ================= 情感分析 ================= */
  'ai-sentiment'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>文本情感与风险分析</b><span class="hint">基于本地词典，仅供粗略参考</span></div>
          <textarea class="ta" id="se-in" rows="7">这个工具非常方便，界面简洁，处理速度很快，文件也不会上传，值得推荐。不过个别功能在手机上有点卡顿，希望能优化。</textarea>
          <button class="btn primary" id="se-run" style="margin-top:9px">分析</button>
        </div>
        <div class="stat-grid" id="se-stats"></div>
        <div class="panel"><div class="panel-head"><b>情感倾向</b></div><div class="progress" style="height:10px"><i id="se-bar" style="width:50%"></i></div><div class="hint" id="se-label" style="margin-top:7px">—</div></div>
        <div class="panel"><div class="panel-head"><b>命中词与敏感信息</b></div><div id="se-words" class="row" style="gap:6px"></div><div id="se-sensitive" style="margin-top:10px"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#se-run').onclick = () => {
      const text = $('#se-in').value;
      const pos = POS.filter((w) => text.includes(w));
      const neg = NEG.filter((w) => text.includes(w));
      const score = (pos.length - neg.length) / Math.max(1, pos.length + neg.length);
      const pctv = Math.round((score + 1) / 2 * 100);
      $('#se-stats').innerHTML = [
        ['正向词', pos.length], ['负向词', neg.length], ['情感得分', score.toFixed(2)],
        ['字符数', text.length], ['句子数', splitSentences(text).length],
        ['平均句长', (text.length / Math.max(1, splitSentences(text).length)).toFixed(1)]
      ].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
      $('#se-bar').style.width = pctv + '%';
      $('#se-bar').style.background = score > 0.15 ? 'linear-gradient(90deg,#34d399,#22d3ee)' : score < -0.15 ? 'linear-gradient(90deg,#fb7185,#f97316)' : 'linear-gradient(90deg,#fbbf24,#f59e0b)';
      $('#se-label').textContent = score > 0.15 ? '整体偏正向' : score < -0.15 ? '整体偏负向' : '整体中性';
      $('#se-words').innerHTML = [...pos.map((w) => `<span class="chip" style="color:var(--ok)">${w}</span>`), ...neg.map((w) => `<span class="chip" style="color:var(--err)">${w}</span>`)].join('') || '<span class="hint">没有命中情感词</span>';
      const issues = [];
      if (/1[3-9]\d{9}/.test(text)) issues.push('疑似手机号');
      if (/\d{17}[\dXx]/.test(text)) issues.push('疑似身份证号');
      if (/\d{16,19}/.test(text)) issues.push('疑似银行卡号');
      if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(text)) issues.push('疑似邮箱');
      if (/密码|口令|验证码/.test(text)) issues.push('包含密码相关词汇');
      $('#se-sensitive').innerHTML = issues.length ? `<div class="warnbox">${issues.join(' · ')}</div>` : '<div class="okbox">没有发现常见敏感信息</div>';
    };
    $('#se-run').click();
  }
};
