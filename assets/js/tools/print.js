/* 打印、拼版与扫描 */
import { esc, copy, toast, download, fmtBytes, readAs } from '../core/ui.js';
import { bindFileZone, fileZone, loadImage } from '../core/kit.js';
import { calcWorkbench } from '../core/workbench.js';

const $ = (root, s) => root.querySelector(s);
const PAPERS = {
  A4: [210, 297], A3: [297, 420], A5: [148, 210], A6: [105, 148], B5: [176, 250],
  Letter: [215.9, 279.4], Legal: [215.9, 355.6], '5寸': [89, 127], '6寸': [102, 152],
  '名片': [90, 54], '证件照': [25, 35]
};

export default {
  /* ================= 打印工作台 ================= */
  'print-workbench'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="grid4">
            <div class="field"><label class="lab">纸张</label><select class="sel" id="pw-paper">${Object.keys(PAPERS).map((k) => `<option>${k}</option>`).join('')}</select></div>
            <div class="field"><label class="lab">方向</label><select class="sel" id="pw-dir"><option value="portrait">纵向</option><option value="landscape">横向</option></select></div>
            <div class="field"><label class="lab">页边距 mm</label><input class="inp" id="pw-margin" type="number" value="12"></div>
            <div class="field"><label class="lab">出血 mm</label><input class="inp" id="pw-bleed" type="number" value="3"></div>
            <div class="field"><label class="lab">页眉</label><input class="inp" id="pw-head" value="空天工具合集"></div>
            <div class="field"><label class="lab">页脚</label><input class="inp" id="pw-foot" value="kongtian-tools"></div>
            <div class="field"><label class="lab">水印</label><input class="inp" id="pw-wm" value="内部预览"></div>
            <div class="field" style="display:flex;align-items:flex-end"><label class="row" style="gap:5px"><input type="checkbox" id="pw-marks" checked> 裁切线</label></div>
          </div>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="pw-run">更新预览</button><button class="btn" id="pw-css">复制打印 CSS</button><button class="btn" id="pw-print">打印当前页</button></div>
        </div>
        <div class="panel"><div class="panel-head"><b>页面预览</b><span class="hint" id="pw-meta"></span></div><div id="pw-preview" style="display:flex;justify-content:center;padding:16px;background:rgba(0,0,0,.15);border-radius:10px;overflow:auto"></div></div>
        <div class="panel"><div class="panel-head"><b>打印 CSS</b></div><pre class="out" id="pw-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const run = () => {
      const paper = PAPERS[$('#pw-paper').value] || PAPERS.A4;
      const landscape = $('#pw-dir').value === 'landscape';
      const w = landscape ? paper[1] : paper[0], h = landscape ? paper[0] : paper[1];
      const margin = Number($('#pw-margin').value) || 0;
      const bleed = Number($('#pw-bleed').value) || 0;
      const scale = Math.min(2.2, 520 / w);
      const el = $('#pw-preview');
      el.innerHTML = `<div style="position:relative;width:${w * scale}px;height:${h * scale}px;background:#fff;box-shadow:0 8px 30px rgba(0,0,0,.35);color:#111;overflow:hidden">
        <div style="position:absolute;inset:${bleed * scale}px;border:1px dashed rgba(220,50,50,.55)"></div>
        <div style="position:absolute;inset:${(margin) * scale}px;border:1px solid #ddd;padding:${6 * scale}px;box-sizing:border-box">
          <div style="font-size:${10 * scale}px;color:#777;border-bottom:1px solid #eee;padding-bottom:4px">${esc($('#pw-head').value)}</div>
          <div style="height:calc(100% - ${44 * scale}px);display:flex;align-items:center;justify-content:center;text-align:center;color:#666;font-size:${14 * scale}px">
            <div><div style="font-size:${28 * scale}px;font-weight:800;color:#111">页面内容预览</div><div style="margin-top:6px">${w} × ${h} mm · 页边距 ${margin} mm</div></div>
          </div>
          <div style="position:absolute;left:${6 * scale}px;right:${6 * scale}px;bottom:${4 * scale}px;font-size:${9 * scale}px;color:#888;border-top:1px solid #eee;padding-top:3px;display:flex;justify-content:space-between"><span>${esc($('#pw-foot').value)}</span><span>第 1 页</span></div>
        </div>
        ${$('#pw-wm').value ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transform:rotate(-28deg);font-size:${34 * scale}px;font-weight:800;color:rgba(30,120,200,.12);pointer-events:none">${esc($('#pw-wm').value)}</div>` : ''}
        ${$('#pw-marks').checked ? '<div style="position:absolute;inset:6px;border:1px solid #38cdf0"></div>' : ''}
      </div>`;
      $('#pw-meta').textContent = `${w} × ${h} mm · 出血 ${bleed} mm`;
      const css = `@page {\n  size: ${w}mm ${h}mm;\n  margin: ${margin}mm;\n  marks: crop cross;\n  bleed: ${bleed}mm;\n}\n\n@media print {\n  body { margin: 0; color: #000; background: #fff; }\n  .no-print { display: none !important; }\n  .page-header { position: fixed; top: 0; left: 0; right: 0; font-size: 9pt; color: #666; border-bottom: 1px solid #ddd; }\n  .page-footer { position: fixed; bottom: 0; left: 0; right: 0; font-size: 9pt; color: #666; border-top: 1px solid #ddd; }\n  h1, h2, h3 { break-after: avoid; }\n  table, figure { break-inside: avoid; }\n  a[href]::after { content: " (" attr(href) ")"; font-size: 8pt; color: #666; }\n}`;
      $('#pw-out').textContent = css;
    };
    ['#pw-paper', '#pw-dir', '#pw-margin', '#pw-bleed', '#pw-head', '#pw-foot', '#pw-wm', '#pw-marks'].forEach((s) => {
      $(s).addEventListener('input', run);
      $(s).addEventListener('change', run);
    });
    $('#pw-run').onclick = run;
    $('#pw-css').onclick = () => copy($('#pw-out').textContent);
    $('#pw-print').onclick = () => window.print();
    run();
  },

  /* ================= 拼版计算 ================= */
  'imposition'(root) {
    calcWorkbench(root, {
      title: '拼版与开数计算',
      note: '结果为理论值，实际印刷需预留咬口与裁切余量。',
      groups: [
        {
          name: 'N 拼版',
          fields: [['pw', '纸张宽 mm', 210], ['ph', '纸张高 mm', 297], ['iw', '成品宽 mm', 90], ['ih', '成品高 mm', 54], ['gap', '间距 mm', 3], ['bleed', '出血 mm', 3]],
          run: (v) => {
            const w = v.iw + v.bleed * 2 + v.gap, h = v.ih + v.bleed * 2 + v.gap;
            const cols = Math.floor((v.pw + v.gap) / w), rows = Math.floor((v.ph + v.gap) / h);
            const per = Math.max(0, cols) * Math.max(0, rows);
            const util = per * (v.iw + v.bleed * 2) * (v.ih + v.bleed * 2) / (v.pw * v.ph) * 100;
            return `纸张：${v.pw} × ${v.ph} mm\n单件（含出血）：${v.iw + v.bleed * 2} × ${v.ih + v.bleed * 2} mm\n排布：${cols} 列 × ${rows} 行 = ${per} 件/张\n材料利用率：${util.toFixed(1)}%\n\n提示：四边留 3–5 mm 咬口，裁切线间距至少 3 mm。`;
          }
        },
        {
          name: '名片',
          fields: [['pw', '纸张宽 mm', 210], ['ph', '纸张高 mm', 297], ['iw', '名片宽 mm', 90], ['ih', '名片高 mm', 54]],
          run: (v) => {
            const per = Math.floor(v.pw / (v.iw + 3)) * Math.floor(v.ph / (v.ih + 3));
            return `A4 可排 ${per} 张名片（90×54 mm，间距 3 mm）\n每 100 张约需 ${Math.ceil(100 / per)} 张纸`;
          }
        },
        {
          name: '证件照',
          fields: [['pw', '相纸宽 mm', 89], ['ph', '相纸高 mm', 127], ['iw', '照片宽 mm', 25], ['ih', '照片高 mm', 35]],
          run: (v) => {
            const cols = Math.floor((v.pw + 2) / (v.iw + 2)), rows = Math.floor((v.ph + 2) / (v.ih + 2));
            return `5 寸相纸可排 ${cols} × ${rows} = ${cols * rows} 张 ${v.iw}×${v.ih} mm 证件照`;
          }
        },
        {
          name: '小册子',
          fields: [['pages', '内页数（4 的倍数）', 16], ['sheets', '每帖张数', 4]],
          run: (v) => {
            const p = Math.ceil(v.pages / 4) * 4;
            return `总页数（补足后）：${p} 页\n骑马钉：${p / 4} 张纸（每张 2 面，共 ${p / 2} 个页码位）\n建议每帖 ${v.sheets} 张，共 ${Math.ceil(p / 4 / v.sheets)} 帖`;
          }
        },
        {
          name: '书脊',
          fields: [['pages', '页数', 200], ['thick', '单张纸厚 mm', 0.1], ['cover', '封面厚 mm', 0.5]],
          run: (v) => `书脊厚度约 ${(v.pages / 2 * v.thick + v.cover).toFixed(2)} mm（按每张 2 页计）`
        }
      ]
    });
  },

  /* ================= 扫描件处理 ================= */
  'scan-clean'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>扫描件处理</b><span class="hint">去底色、增强对比、转黑白、裁剪、转 PDF</span></div>
          ${fileZone('sc-zone', { accept: 'image/*', label: '选择扫描件图片' })}
          <div class="grid4" style="margin-top:10px">
            <div class="field"><label class="lab">旋转</label><select class="sel" id="sc-rot"><option value="0">0°</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></div>
            <div class="field"><label class="lab">对比度 <span id="sc-cv">1.2</span></label><input type="range" id="sc-contrast" min="0.5" max="2.5" step="0.05" value="1.2"></div>
            <div class="field"><label class="lab">亮度 <span id="sc-bv">1.05</span></label><input type="range" id="sc-bright" min="0.5" max="2" step="0.05" value="1.05"></div>
            <div class="field"><label class="lab">二值化阈值 <span id="sc-tv">190</span></label><input type="range" id="sc-thres" min="80" max="250" value="190"></div>
            <div class="field"><label class="lab">裁剪 X</label><input class="inp" id="sc-x" type="number" value="0"></div>
            <div class="field"><label class="lab">裁剪 Y</label><input class="inp" id="sc-y" type="number" value="0"></div>
            <div class="field"><label class="lab">宽度</label><input class="inp" id="sc-w" type="number" value="0"></div>
            <div class="field"><label class="lab">高度</label><input class="inp" id="sc-h" type="number" value="0"></div>
          </div>
          <div class="row" style="margin-top:10px"><label class="row" style="gap:5px"><input type="checkbox" id="sc-gray"> 灰度</label><label class="row" style="gap:5px"><input type="checkbox" id="sc-bin"> 黑白二值</label><label class="row" style="gap:5px"><input type="checkbox" id="sc-white"> 去底色</label><button class="btn primary" id="sc-run">应用</button><button class="btn" id="sc-png">下载 PNG</button><button class="btn" id="sc-pdf">导出 PDF</button></div>
        </div>
        <div class="panel"><div class="canvas-wrap" id="sc-preview"><div class="hint">选择图片后预览</div></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let img = null;
    bindFileZone(root, 'sc-zone', async (fs) => {
      img = await loadImage(URL.createObjectURL(fs[0]));
      $('#sc-w').value = img.width; $('#sc-h').value = img.height;
      paint();
    });
    const render = () => {
      if (!img) return null;
      const rot = Number($('#sc-rot').value);
      const full = document.createElement('canvas');
      full.width = rot % 180 ? img.height : img.width;
      full.height = rot % 180 ? img.width : img.height;
      const g = full.getContext('2d');
      g.translate(full.width / 2, full.height / 2); g.rotate(rot * Math.PI / 180);
      g.drawImage(img, -img.width / 2, -img.height / 2);
      const x = Math.max(0, Number($('#sc-x').value) || 0), y = Math.max(0, Number($('#sc-y').value) || 0);
      const w = Math.min(full.width - x, Number($('#sc-w').value) || full.width), h = Math.min(full.height - y, Number($('#sc-h').value) || full.height);
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const cg = cv.getContext('2d');
      cg.filter = `contrast(${$('#sc-contrast').value}) brightness(${$('#sc-bright').value}) ${$('#sc-gray').checked ? 'grayscale(1)' : ''}`;
      cg.drawImage(full, x, y, w, h, 0, 0, w, h);
      if ($('#sc-bin').checked || $('#sc-white').checked) {
        const data = cg.getImageData(0, 0, w, h);
        const thres = Number($('#sc-thres').value);
        for (let i = 0; i < data.data.length; i += 4) {
          const v = 0.299 * data.data[i] + 0.587 * data.data[i + 1] + 0.114 * data.data[i + 2];
          const out = $('#sc-bin').checked ? (v > thres ? 255 : 0) : (v > 235 ? 255 : v);
          data.data[i] = data.data[i + 1] = data.data[i + 2] = out;
        }
        cg.putImageData(data, 0, 0);
      }
      return cv;
    };
    const paint = () => {
      const cv = render();
      if (!cv) return;
      $('#sc-preview').innerHTML = '';
      cv.style.maxWidth = '100%';
      $('#sc-preview').appendChild(cv);
    };
    ['#sc-rot', '#sc-contrast', '#sc-bright', '#sc-thres', '#sc-gray', '#sc-bin', '#sc-white', '#sc-x', '#sc-y', '#sc-w', '#sc-h'].forEach((s) => {
      $(s).addEventListener('input', paint);
      $(s).addEventListener('change', paint);
    });
    $('#sc-contrast').addEventListener('input', () => { $('#sc-cv').textContent = $('#sc-contrast').value; });
    $('#sc-bright').addEventListener('input', () => { $('#sc-bv').textContent = $('#sc-bright').value; });
    $('#sc-thres').addEventListener('input', () => { $('#sc-tv').textContent = $('#sc-thres').value; });
    $('#sc-run').onclick = paint;
    $('#sc-png').onclick = () => { const cv = render(); if (cv) cv.toBlob((b) => download('scan.png', b)); };
    $('#sc-pdf').onclick = async () => {
      const cv = render();
      if (!cv) return toast('请选择图片', 'err');
      try {
        await ctx.deps(['pdflib']);
        const { PDFDocument } = window.PDFLib;
        const pdf = await PDFDocument.create();
        const bytes = await new Promise((res) => cv.toBlob((b) => b.arrayBuffer().then(res), 'image/png'));
        const img2 = await pdf.embedPng(bytes);
        const page = pdf.addPage([img2.width, img2.height]);
        page.drawImage(img2, { x: 0, y: 0, width: img2.width, height: img2.height });
        download('scan.pdf', new Blob([await pdf.save()], { type: 'application/pdf' }));
      } catch (e) { toast(e.message, 'err'); }
    };
  },

  /* ================= 扫描 OCR ================= */
  'scan-ocr'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>扫描件 OCR 队列</b><span class="hint">本地识别，可批量、去重、脱敏、导出</span></div>
          ${fileZone('so-zone', { accept: 'image/*', multiple: true, label: '选择一张或多张扫描件' })}
          <div class="grid3" style="margin-top:10px">
            <div class="field"><label class="lab">语言</label><select class="sel" id="so-lang"><option value="chi_sim+eng">中文 + 英文</option><option value="eng">英文</option><option value="chi_tra+eng">繁体 + 英文</option></select></div>
            <div class="field"><label class="lab">预处理</label><select class="sel" id="so-pre"><option value="gray">灰度增强</option><option value="none">原图</option><option value="bin">黑白二值</option></select></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="so-run" style="width:100%">开始识别</button></div>
          </div>
          <div class="progress" style="margin-top:11px"><i id="so-bar" style="width:0%"></i></div>
          <div class="hint" id="so-status" style="margin-top:6px">等待开始</div>
        </div>
        <div class="panel">
          <div class="panel-head"><b>识别结果</b><span class="hint" id="so-meta"></span></div>
          <textarea class="ta mono" id="so-out" rows="12" placeholder="识别文本会显示在这里"></textarea>
          <div class="row" style="margin-top:9px"><button class="btn" id="so-dedup">去重</button><button class="btn" id="so-mask">脱敏</button><button class="btn" id="so-key">关键词</button><button class="btn" id="so-csv">导出 CSV</button><button class="btn" id="so-json">导出 JSON</button></div>
          <pre class="out" id="so-extra" style="margin-top:9px"></pre>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let files = [], results = [];
    bindFileZone(root, 'so-zone', (fs) => { files = fs; $('#so-status').textContent = `${fs.length} 张图片`; });
    const preprocess = async (f) => {
      if ($('#so-pre').value === 'none') return f;
      const img = await loadImage(URL.createObjectURL(f));
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      const g = cv.getContext('2d');
      g.drawImage(img, 0, 0);
      const data = g.getImageData(0, 0, cv.width, cv.height);
      const bin = $('#so-pre').value === 'bin';
      for (let i = 0; i < data.data.length; i += 4) {
        let v = 0.299 * data.data[i] + 0.587 * data.data[i + 1] + 0.114 * data.data[i + 2];
        v = Math.min(255, Math.max(0, (v - 128) * 1.35 + 128));
        if (bin) v = v > 180 ? 255 : 0;
        data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
      }
      g.putImageData(data, 0, 0);
      return new Promise((res) => cv.toBlob(res, 'image/png'));
    };
    $('#so-run').onclick = async () => {
      if (!files.length) return toast('请选择扫描件', 'err');
      try {
        await ctx.deps(['tesseract']);
        results = [];
        let done = 0;
        const worker = await window.Tesseract.createWorker($('#so-lang').value, 1, {
          logger: (m) => {
            if (m.progress != null) {
              const total = (done + m.progress) / files.length;
              $('#so-bar').style.width = Math.round(total * 100) + '%';
              $('#so-status').textContent = `${done + 1} / ${files.length} · ${m.status || '识别中'}`;
            }
          }
        });
        for (const f of files) {
          const img = await preprocess(f);
          const { data } = await worker.recognize(img);
          results.push({ name: f.name, text: data.text, confidence: data.confidence });
          done++;
          $('#so-bar').style.width = Math.round(done / files.length * 100) + '%';
          $('#so-out').value = results.map((r) => `### ${r.name}\n${r.text}`).join('\n\n');
        }
        await worker.terminate();
        $('#so-status').textContent = `完成 · ${results.length} 张`;
        $('#so-meta').textContent = `平均置信度 ${(results.reduce((s, r) => s + r.confidence, 0) / results.length).toFixed(1)}%`;
      } catch (e) { $('#so-status').textContent = '识别失败：' + e.message; }
    };
    $('#so-dedup').onclick = () => { $('#so-out').value = [...new Set($('#so-out').value.split(/\r?\n/).filter((x) => x.trim()))].join('\n'); };
    $('#so-mask').onclick = () => {
      $('#so-out').value = $('#so-out').value
        .replace(/(?<!\d)(1[3-9]\d)\d{4}(\d{4})(?!\d)/g, '$1****$2')
        .replace(/\d{17}[\dXx]/g, (m) => m.slice(0, 6) + '********' + m.slice(-4))
        .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, (m) => m.slice(0, 2) + '***' + m.slice(m.indexOf('@')));
    };
    $('#so-key').onclick = () => {
      const text = $('#so-out').value;
      const words = text.match(/[\u4e00-\u9fa5]{2,}|[A-Za-z]{3,}/g) || [];
      const freq = new Map();
      words.forEach((w) => freq.set(w, (freq.get(w) || 0) + 1));
      $('#so-extra').textContent = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([w, n]) => `${w}\t${n}`).join('\n');
    };
    $('#so-csv').onclick = () => {
      if (!results.length) return toast('还没有结果', 'err');
      const rows = [['文件名', '置信度', '文本'], ...results.map((r) => [r.name, r.confidence, r.text])];
      download('ocr-results.csv', '\ufeff' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
    };
    $('#so-json').onclick = () => download('ocr-results.json', JSON.stringify(results, null, 2), 'application/json');
  }
};
