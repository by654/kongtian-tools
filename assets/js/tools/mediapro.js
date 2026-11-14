/* 字幕、电子书、视频、音频与音乐 */
import { esc, copy, toast, download, fmtBytes, readAs } from '../core/ui.js';
import { bindFileZone, fileZone, loadImage } from '../core/kit.js';
import { calcWorkbench } from '../core/workbench.js';

const $ = (root, s) => root.querySelector(s);
const pad = (n, l = 2) => String(n).padStart(l, '0');

function parseTime(s) {
  const m = s.trim().match(/(\d+):(\d+):(\d+)[.,](\d+)/);
  if (!m) return 0;
  return (+m[1]) * 3600000 + (+m[2]) * 60000 + (+m[3]) * 1000 + (+m[4].padEnd(3, '0'));
}
function fmtTime(ms, fmt = 'srt') {
  ms = Math.max(0, Math.round(ms));
  const h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000), s = Math.floor(ms % 60000 / 1000), x = ms % 1000;
  if (fmt === 'vtt') return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(x, 3)}`;
  if (fmt === 'ass') return `${h}:${pad(m)}:${pad(s)}.${pad(Math.floor(x / 10))}`;
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(x, 3)}`;
}
function parseSub(text) {
  const t = text.trim();
  if (/^WEBVTT/.test(t)) return { fmt: 'vtt', cues: t.replace(/^WEBVTT[^\n]*\n/, '').split(/\n\s*\n/).filter((b) => b.includes('-->')).map((b) => { const lines = b.split('\n'); const i = lines.findIndex((l) => l.includes('-->')); const [a, c] = lines[i].split('-->'); return { start: parseTime(a), end: parseTime(c), text: lines.slice(i + 1).join('\n') }; }) };
  if (/\[Events\]/i.test(t)) {
    return { fmt: 'ass', cues: t.split(/\r?\n/).filter((l) => /^Dialogue:/i.test(l)).map((l) => { const parts = l.split(','); return { start: parseTime(parts[1]), end: parseTime(parts[2]), text: parts.slice(9).join(',').replace(/\{[^}]*\}/g, '') }; }) };
  }
  return { fmt: 'srt', cues: t.split(/\n\s*\n/).filter((b) => b.includes('-->')).map((b) => { const lines = b.split('\n'); const i = lines.findIndex((l) => l.includes('-->')); const [a, c] = lines[i].split('-->'); return { start: parseTime(a), end: parseTime(c), text: lines.slice(i + 1).join('\n') }; }) };
}
function buildSub(cues, fmt) {
  if (fmt === 'vtt') return 'WEBVTT\n\n' + cues.map((c, i) => `${i + 1}\n${fmtTime(c.start, 'vtt')} --> ${fmtTime(c.end, 'vtt')}\n${c.text}`).join('\n\n');
  if (fmt === 'ass') return `[Script Info]\nScriptType: v4.00+\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n` + cues.map((c) => `Dialogue: 0,${fmtTime(c.start, 'ass')},${fmtTime(c.end, 'ass')},Default,,0,0,0,,${c.text.replace(/\n/g, '\\N')}`).join('\n');
  return cues.map((c, i) => `${i + 1}\n${fmtTime(c.start)} --> ${fmtTime(c.end)}\n${c.text}`).join('\n\n');
}

export default {
  /* ================= 字幕工作台 ================= */
  'subtitle-tools'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>字幕工作台</b><span class="hint">SRT / VTT / ASS 互转、偏移、缩放、合并、QC</span></div>
          <textarea class="ta mono" id="st-in" rows="10" placeholder="粘贴 SRT / VTT / ASS 字幕…"></textarea>
          <div class="grid4" style="margin-top:9px">
            <div class="field"><label class="lab">输出格式</label><select class="sel" id="st-fmt"><option value="srt">SRT</option><option value="vtt">VTT</option><option value="ass">ASS</option></select></div>
            <div class="field"><label class="lab">偏移 ms</label><input class="inp" id="st-shift" type="number" value="0"></div>
            <div class="field"><label class="lab">时间缩放</label><input class="inp" id="st-scale" type="number" step="0.01" value="1"></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="st-run" style="width:100%">转换</button></div>
          </div>
          <div class="row" style="margin-top:9px"><button class="btn" id="st-merge">合并</button><button class="btn" id="st-dedup">去重</button><button class="btn" id="st-clean">清理</button><button class="btn" id="st-copy">复制</button><button class="btn" id="st-dl">下载</button><span class="hint" id="st-meta"></span></div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果 / QC</b></div><pre class="out" id="st-out" style="max-height:320px"></pre><div id="st-qc" class="hint" style="margin-top:8px"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let cues = [];
    const load = () => { cues = parseSub($('#st-in').value).cues; };
    const run = () => {
      try {
        load();
        const shift = Number($('#st-shift').value) || 0;
        const scale = Number($('#st-scale').value) || 1;
        const out = cues.map((c) => ({ start: c.start * scale + shift, end: c.end * scale + shift, text: c.text }));
        $('#st-out').textContent = buildSub(out, $('#st-fmt').value);
        $('#st-meta').textContent = `${out.length} 条字幕`;
        const tooLong = out.filter((c) => [...c.text].length > 42).length;
        const tooFast = out.filter((c) => (c.end - c.start) > 0 && [...c.text].length / ((c.end - c.start) / 1000) > 20).length;
        $('#st-qc').innerHTML = `<span style="color:${tooLong ? 'var(--warn)' : 'var(--ok)'}">超长行 ${tooLong}</span> · <span style="color:${tooFast ? 'var(--warn)' : 'var(--ok)'}">阅读速度过快 ${tooFast}</span> · 建议单行 ≤ 42 字符、CPS ≤ 20`;
      } catch (e) { $('#st-out').textContent = '解析失败：' + e.message; }
    };
    $('#st-run').onclick = run;
    $('#st-merge').onclick = () => {
      load();
      const merged = [];
      cues.forEach((c) => {
        const last = merged[merged.length - 1];
        if (last && c.start - last.end < 300) { last.end = c.end; last.text += ' ' + c.text; }
        else merged.push({ ...c });
      });
      cues = merged;
      $('#st-out').textContent = buildSub(merged, $('#st-fmt').value);
      $('#st-meta').textContent = `合并后 ${merged.length} 条`;
    };
    $('#st-dedup').onclick = () => {
      load();
      const seen = new Set();
      cues = cues.filter((c) => { const k = c.text.trim(); if (seen.has(k)) return false; seen.add(k); return true; });
      $('#st-out').textContent = buildSub(cues, $('#st-fmt').value);
      $('#st-meta').textContent = `去重后 ${cues.length} 条`;
    };
    $('#st-clean').onclick = () => {
      load();
      cues = cues.map((c) => ({ ...c, text: c.text.replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').replace(/\n{2,}/g, '\n').trim() })).filter((c) => c.text);
      $('#st-out').textContent = buildSub(cues, $('#st-fmt').value);
      $('#st-meta').textContent = `清理后 ${cues.length} 条`;
    };
    $('#st-copy').onclick = () => copy($('#st-out').textContent);
    $('#st-dl').onclick = () => download('subtitle.' + $('#st-fmt').value, $('#st-out').textContent, 'text/plain');
    run();
  },

  /* ================= 电子书与漫画 ================= */
  'ebook-tools'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>电子书 / 漫画</b><span class="hint">EPUB 元数据、目录、封面、正文提取；CBZ 转 PDF</span></div>
          ${fileZone('eb-zone', { accept: '.epub,.cbz,.zip', label: '选择 EPUB 或 CBZ 文件' })}
          <div class="row" style="margin-top:10px"><button class="btn primary" id="eb-parse">解析</button><button class="btn" id="eb-pdf">CBZ → PDF</button><button class="btn" id="eb-cbz">图片 → CBZ</button><span class="hint" id="eb-meta">尚未选择文件</span></div>
        </div>
        <div class="grid2">
          <div class="panel"><div class="panel-head"><b>元数据 / 目录</b></div><div id="eb-info" class="kv"><div class="hint">尚未解析</div></div></div>
          <div class="panel"><div class="panel-head"><b>封面</b></div><div class="canvas-wrap" id="eb-cover"><div class="hint">暂无封面</div></div></div>
        </div>
        <div class="panel"><div class="panel-head"><b>正文提取</b><button class="btn sm" id="eb-copy">复制</button></div><pre class="out" id="eb-text" style="max-height:360px"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let file = null, analysis = null;
    bindFileZone(root, 'eb-zone', (fs) => { file = fs[0]; $('#eb-meta').textContent = `${file.name} · ${fmtBytes(file.size)}`; });
    const resolve = (base, href) => {
      const parts = (base.split('/').slice(0, -1).concat(href.split('/')));
      const out = [];
      parts.forEach((p) => { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); });
      return out.join('/');
    };
    $('#eb-parse').onclick = async () => {
      if (!file) return toast('请选择文件', 'err');
      try {
        await ctx.deps(['jszip']);
        const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
        if (file.name.toLowerCase().endsWith('.epub')) {
          const container = await zip.file('META-INF/container.xml').async('text');
          const opfPath = container.match(/full-path="([^"]+)"/)[1];
          const opf = new DOMParser().parseFromString(await zip.file(opfPath).async('text'), 'application/xml');
          const title = opf.querySelector('metadata title')?.textContent || '未知';
          const creator = opf.querySelector('metadata creator')?.textContent || '';
          const items = [...opf.querySelectorAll('manifest item')].map((x) => ({ id: x.getAttribute('id'), href: x.getAttribute('href'), type: x.getAttribute('media-type'), props: x.getAttribute('properties') || '' }));
          const spine = [...opf.querySelectorAll('spine itemref')].map((x) => x.getAttribute('idref'));
          const chapters = spine.map((id) => items.find((i) => i.id === id)).filter(Boolean);
          const coverItem = items.find((i) => i.props.includes('cover-image')) || items.find((i) => /cover/i.test(i.href) && /image/.test(i.type));
          let cover = '';
          if (coverItem) {
            const bytes = await zip.file(resolve(opfPath, coverItem.href)).async('uint8array');
            const blob = new Blob([bytes], { type: coverItem.type });
            cover = URL.createObjectURL(blob);
            $('#eb-cover').innerHTML = `<img src="${cover}" alt="封面" style="max-height:320px">`;
          }
          let text = '';
          for (const ch of chapters.slice(0, 50)) {
            const f = zip.file(resolve(opfPath, ch.href));
            if (!f) continue;
            const doc = new DOMParser().parseFromString(await f.async('text'), 'text/html');
            doc.querySelectorAll('script,style').forEach((x) => x.remove());
            text += '\n\n# ' + (doc.querySelector('h1,h2,h3,title')?.textContent || ch.href) + '\n' + doc.body.textContent.replace(/\s+\n/g, '\n').trim();
          }
          analysis = { type: 'epub', title, creator, chapters: chapters.length, text };
          $('#eb-info').innerHTML = `<dt>标题</dt><dd>${esc(title)}</dd><dt>作者</dt><dd>${esc(creator || '—')}</dd><dt>章节</dt><dd>${chapters.length}</dd><dt>字数（约）</dt><dd>${text.length}</dd><dt>文件大小</dt><dd>${fmtBytes(file.size)}</dd>`;
          $('#eb-text').textContent = text.slice(0, 20000);
        } else {
          const imgs = Object.keys(zip.files).filter((n) => /\.(png|jpe?g|webp|gif)$/i.test(n)).sort();
          analysis = { type: 'cbz', images: imgs, zip };
          $('#eb-info').innerHTML = `<dt>类型</dt><dd>CBZ / ZIP 漫画</dd><dt>页数</dt><dd>${imgs.length}</dd><dt>文件大小</dt><dd>${fmtBytes(file.size)}</dd>`;
          if (imgs[0]) {
            const bytes = await zip.file(imgs[0]).async('uint8array');
            const url = URL.createObjectURL(new Blob([bytes]));
            $('#eb-cover').innerHTML = `<img src="${url}" alt="封面" style="max-height:320px">`;
          }
        }
      } catch (e) { $('#eb-info').innerHTML = `<div class="errbox">解析失败：${esc(e.message)}</div>`; }
    };
    $('#eb-pdf').onclick = async () => {
      if (!analysis || analysis.type !== 'cbz') return toast('请先解析 CBZ', 'err');
      try {
        await ctx.deps(['pdflib']);
        const { PDFDocument } = window.PDFLib;
        const pdf = await PDFDocument.create();
        for (const name of analysis.images) {
          const bytes = await analysis.zip.file(name).async('uint8array');
          let img;
          try { img = await pdf.embedJpg(bytes); } catch { img = await pdf.embedPng(bytes); }
          const page = pdf.addPage([img.width, img.height]);
          page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        }
        download('comic.pdf', new Blob([await pdf.save()], { type: 'application/pdf' }));
      } catch (e) { toast(e.message, 'err'); }
    };
    $('#eb-cbz').onclick = async () => {
      const fs = await new Promise((res) => {
        const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true; inp.style.display = 'none';
        document.body.appendChild(inp); inp.onchange = () => { res([...inp.files]); inp.remove(); }; inp.oncancel = () => { res([]); inp.remove(); }; inp.click();
      });
      if (!fs.length) return;
      await ctx.deps(['jszip']);
      const zip = new window.JSZip();
      fs.sort((a, b) => a.name.localeCompare(b.name)).forEach((f, i) => zip.file(pad(i + 1, 3) + '.' + f.name.split('.').pop(), f));
      download('comic.cbz', await zip.generateAsync({ type: 'blob' }));
    };
    $('#eb-copy').onclick = () => copy($('#eb-text').textContent);
  },

  /* ================= 视频计算 ================= */
  'video-calc'(root) {
    calcWorkbench(root, {
      title: '视频后期计算',
      groups: [
        { name: '码率与体积', fields: [['w', '宽', 1920], ['h', '高', 1080], ['fps', '帧率', 30], ['bitrate', '码率 Mbps', 8], ['min', '时长 min', 10]], run: (v) => `像素数：${(v.w * v.h / 1e6).toFixed(2)} MP\n文件大小 ≈ ${(v.bitrate * v.min * 60 / 8).toFixed(2)} MB\n每分钟 ≈ ${(v.bitrate * 60 / 8).toFixed(1)} MB` },
        { name: '时间码 / 帧号', fields: [['fps', '帧率', 25], ['tc', '时间码 HH:MM:SS:FF', '00:01:30:12']], run: (v) => { const [h, m, s, f] = v.tc.split(':').map(Number); const frames = ((h * 3600 + m * 60 + s) * v.fps) + f; return `总帧数：${frames}\n秒数：${(frames / v.fps).toFixed(3)}`; } },
        { name: '变速时长', fields: [['min', '原时长 min', 10], ['speed', '倍速', 1.5]], run: (v) => `变速后时长：${(v.min / v.speed).toFixed(2)} min` },
        { name: '分辨率缩放', fields: [['w', '原宽', 3840], ['h', '原高', 2160], ['tw', '目标宽', 1920]], run: (v) => `目标高（保持比例）：${Math.round(v.h * v.tw / v.w)}\n缩放比例：${(v.tw / v.w * 100).toFixed(1)}%` },
        { name: '平台尺寸套件', fields: [['w', '主尺寸宽', 1920], ['h', '主尺寸高', 1080]], run: (v) => { const list = [['16:9', 1920, 1080], ['9:16', 1080, 1920], ['1:1', 1080, 1080], ['4:5', 1080, 1350], ['4:3', 1440, 1080]]; return list.map(([n, w, h]) => `${n}：${w}×${h}（缩放 ${(w / v.w * 100).toFixed(0)}%）`).join('\n'); } },
        { name: '安全区域', fields: [['w', '画面宽', 1920], ['h', '画面高', 1080], ['pct', '安全边距 %', 5]], run: (v) => `安全区内边距：${Math.round(v.w * v.pct / 100)} px / ${Math.round(v.h * v.pct / 100)} px\n字幕基线建议距底部 ≥ ${Math.round(v.h * 0.08)} px` },
        { name: 'GIF 参数', fields: [['w', '宽', 480], ['h', '高', 270], ['fps', '帧率', 12], ['sec', '秒数', 3]], run: (v) => `帧数：${Math.round(v.fps * v.sec)}\n估算体积：${(v.w * v.h * v.fps * v.sec * 0.05 / 1024).toFixed(1)} KB（视内容而定）` }
      ]
    });
  },

  /* ================= 音频分析 ================= */
  'audio-analyze'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>音频响度与质量分析</b><span class="hint">峰值、RMS、动态范围、DC 偏移、立体声兼容</span></div>
          ${fileZone('aa-zone', { accept: 'audio/*', label: '选择音频文件' })}
          <div class="canvas-wrap" style="margin-top:10px"><canvas id="aa-wave" width="760" height="140"></canvas></div>
          <div class="row" style="margin-top:9px"><button class="btn primary" id="aa-run">分析</button><span class="hint" id="aa-meta">尚未选择音频</span></div>
        </div>
        <div class="stat-grid" id="aa-out"></div>
        <div class="panel"><div class="panel-head"><b>建议</b></div><div class="hint" id="aa-tip"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let file = null, ac = null;
    bindFileZone(root, 'aa-zone', (fs) => { file = fs[0]; $('#aa-meta').textContent = `${file.name} · ${fmtBytes(file.size)}`; });
    $('#aa-run').onclick = async () => {
      if (!file) return toast('请选择音频', 'err');
      try {
        ac = ac || new (window.AudioContext || window.webkitAudioContext)();
        const buf = await ac.decodeAudioData(await readAs(file, 'arraybuffer'));
        const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
        let peak = 0, sum = 0, dc = 0, corr = 0;
        for (let i = 0; i < L.length; i++) {
          const l = L[i], r = R[i];
          const a = Math.max(Math.abs(l), Math.abs(r));
          if (a > peak) peak = a;
          sum += l * l; dc += l; corr += l * r;
        }
        const rms = Math.sqrt(sum / L.length);
        const dbfs = (v) => 20 * Math.log10(Math.max(1e-8, v));
        const peakDb = dbfs(peak), rmsDb = dbfs(rms);
        const dynamic = peakDb - rmsDb;
        const mono = Math.sqrt(corr / (Math.sqrt(sum) * Math.sqrt(sum)) || 0);
        const cv = $('#aa-wave'), g = cv.getContext('2d');
        g.clearRect(0, 0, cv.width, cv.height);
        g.strokeStyle = '#38cdf0'; g.lineWidth = 1; g.beginPath();
        const step = Math.ceil(L.length / cv.width);
        for (let x = 0; x < cv.width; x++) {
          let min = 1, max = -1;
          for (let i = 0; i < step; i++) { const v = L[x * step + i] || 0; if (v < min) min = v; if (v > max) max = v; }
          g.moveTo(x, (1 - max) * cv.height / 2); g.lineTo(x, (1 - min) * cv.height / 2);
        }
        g.stroke();
        $('#aa-out').innerHTML = [
          ['时长', buf.duration.toFixed(2) + ' s'], ['采样率', buf.sampleRate + ' Hz'], ['声道', buf.numberOfChannels],
          ['峰值', peakDb.toFixed(2) + ' dBFS'], ['RMS', rmsDb.toFixed(2) + ' dBFS'], ['动态范围', dynamic.toFixed(2) + ' dB'],
          ['DC 偏移', (dc / L.length).toExponential(2)], ['立体声相关', mono.toFixed(3)]
        ].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
        $('#aa-tip').textContent = `峰值${peak > 0.99 ? '接近 0 dBFS，注意削波。' : '未削波。'} RMS ${rmsDb.toFixed(1)} dBFS；${mono < 0.2 ? '单声道兼容性一般，检查相位。' : '单声道兼容性良好。'} 流媒体通常建议整体响度 -14 LUFS 左右，可用导出后二次处理。`;
        $('#aa-meta').textContent = `${file.name} · ${buf.duration.toFixed(1)}s`;
      } catch (e) { $('#aa-meta').textContent = '解码失败：' + e.message; }
    };
    ctx.onDestroy(() => ac?.close());
  },

  /* ================= 音乐理论 ================= */
  'music-theory'(root) {
    const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const freq = (n) => {
      const m = n.match(/^([A-G]#?)(-?\d)$/);
      const midi = (Number(m[2]) + 1) * 12 + NOTES.indexOf(m[1]);
      return 440 * 2 ** ((midi - 69) / 12);
    };
    calcWorkbench(root, {
      title: '音乐理论与音高计算',
      groups: [
        { name: '音名 / 频率', fields: [['note', '音名', 'A4'], ['mode', '方向', 'n2f', 'select', [['n2f', '音名 → 频率'], ['f2n', '频率 → 音名']]], ['f', '频率 Hz', 440]], run: (v) => {
          if (v.mode === 'n2f') return `${v.note} = ${freq(v.note).toFixed(3)} Hz`;
          const midi = Math.round(69 + 12 * Math.log2(v.f / 440));
          return `${v.f} Hz ≈ ${NOTES[(midi % 12 + 12) % 12]}${Math.floor(midi / 12) - 1}（MIDI ${midi}）`;
        } },
        { name: '音程', fields: [['a', '音 A', 'C4'], ['b', '音 B', 'G4']], run: (v) => { const d = Math.abs(Math.round(12 * Math.log2(freq(v.b) / freq(v.a)))); const names = ['纯一度', '小二度', '大二度', '小三度', '大三度', '纯四度', '增四度', '纯五度', '小六度', '大六度', '小七度', '大七度', '纯八度']; return `${v.a} → ${v.b}：${d} 个半音 · ${names[d] || d + ' 半音'}`; } },
        { name: '移调', fields: [['note', '原音', 'C4'], ['semi', '移动半音', 3]], run: (v) => { const m = v.note.match(/^([A-G]#?)(-?\d)$/); const midi = (Number(m[2]) + 1) * 12 + NOTES.indexOf(m[1]) + v.semi; return `移调后：${NOTES[(midi % 12 + 12) % 12]}${Math.floor(midi / 12) - 1}`; } },
        { name: '和弦构成', fields: [['root', '根音', 'C'], ['type', '类型', 'major', 'select', [['major', '大三和弦'], ['minor', '小三和弦'], ['dim', '减三和弦'], ['aug', '增三和弦'], ['sus4', 'sus4'], ['maj7', '大七和弦'], ['min7', '小七和弦'], ['dom7', '属七和弦']]]], run: (v) => { const map = { major: [0, 4, 7], minor: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], sus4: [0, 5, 7], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], dom7: [0, 4, 7, 10] }; const i = NOTES.indexOf(v.root); return map[v.type].map((x) => NOTES[(i + x) % 12]).join(' - '); } },
        { name: '五度圈', fields: [['key', '起点', 'C']], run: (v) => { const i = NOTES.indexOf(v.key); const order = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F']; return order.map((x, j) => `${j + 1}. ${x}`).join('\n'); } },
        { name: 'MIDI / BPM', fields: [['midi', 'MIDI 音符', 69], ['bpm', 'BPM', 120]], run: (v) => `MIDI ${v.midi} = ${NOTES[v.midi % 12]}${Math.floor(v.midi / 12) - 1} = ${(440 * 2 ** ((v.midi - 69) / 12)).toFixed(2)} Hz\nBPM ${v.bpm}：四分音符 ${(60000 / v.bpm).toFixed(1)} ms · 八分 ${(30000 / v.bpm).toFixed(1)} ms · 十六分 ${(15000 / v.bpm).toFixed(1)} ms` }
      ]
    });
  },

  /* ================= 音效生成 ================= */
  'audio-gen'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>音效与噪音生成</b><span class="hint">白/粉/棕噪音、双耳节拍、扫频音效</span></div>
          <div class="row">
            <button class="chip" data-gen="white">白噪音</button><button class="chip" data-gen="pink">粉红噪音</button><button class="chip" data-gen="brown">布朗噪音</button>
            <button class="chip" data-gen="binaural">双耳节拍</button><button class="chip" data-gen="sweep">扫频音效</button>
            <button class="btn danger" id="ag-stop">停止</button>
          </div>
          <div class="grid3" style="margin-top:10px"><div class="field"><label class="lab">音量</label><input type="range" id="ag-vol" min="0" max="100" value="40"></div><div class="field"><label class="lab">双耳差频 Hz</label><input class="inp" id="ag-beat" type="number" value="10"></div><div class="field"><label class="lab">状态</label><div class="hint" id="ag-status" style="padding-top:9px">待机</div></div></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let ac = null, nodes = [];
    const stop = () => { nodes.forEach((n) => { try { n.stop(); } catch { /* */ } }); nodes = []; ac?.close(); ac = null; $('#ag-status').textContent = '已停止'; };
    const start = (type) => {
      stop();
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const vol = Number($('#ag-vol').value) / 100;
      if (type === 'binaural') {
        const beat = Number($('#ag-beat').value) || 10;
        [440, 440 + beat].forEach((f, i) => {
          const o = ac.createOscillator(), g = ac.createGain(), p = ac.createStereoPanner();
          o.frequency.value = f; g.gain.value = vol * 0.25; p.pan.value = i ? 1 : -1;
          o.connect(g); g.connect(p); p.connect(ac.destination); o.start(); nodes.push(o);
        });
      } else if (type === 'sweep') {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(200, ac.currentTime);
        o.frequency.exponentialRampToValueAtTime(2000, ac.currentTime + 2);
        g.gain.setValueAtTime(vol * 0.3, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 2.2);
        o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 2.2); nodes.push(o);
      } else {
        const len = ac.sampleRate * 3;
        const buf = ac.createBuffer(1, len, ac.sampleRate);
        const d = buf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < len; i++) {
          const w = Math.random() * 2 - 1;
          if (type === 'white') d[i] = w;
          else if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
          else { d[i] = (last + 0.02 * w) / 1.02 * 3.5; last = d[i]; }
        }
        const src = ac.createBufferSource(), g = ac.createGain();
        src.buffer = buf; src.loop = true; g.gain.value = vol * 0.35;
        src.connect(g); g.connect(ac.destination); src.start(); nodes.push(src);
      }
      $('#ag-status').textContent = '播放中：' + type;
    };
    root.querySelectorAll('[data-gen]').forEach((b) => b.addEventListener('click', () => start(b.dataset.gen)));
    $('#ag-stop').onclick = stop;
    ctx.onDestroy(stop);
  }
};
