/* 证书、徽章与白板 */
import { esc, copy, toast, download, fmtBytes } from '../core/ui.js';

const $ = (root, s) => root.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 9);
const pad = (n) => String(n).padStart(2, '0');

function qrDataUrl(text, ctx, scale = 4) {
  return ctx.deps(['qrcode']).then(() => {
    const qr = window.qrcode(0, 'M');
    qr.addData(text); qr.make();
    const n = qr.getModuleCount(), size = (n + 8) * scale;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, size, size);
    g.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) g.fillRect((c + 4) * scale, (r + 4) * scale, scale, scale);
    return cv.toDataURL('image/png');
  });
}

export default {
  /* ================= 徽章生成器 ================= */
  'badge-gen'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="grid4">
            <div class="field"><label class="lab">标题</label><input class="inp" id="bg-title" value="空天探索者"></div>
            <div class="field"><label class="lab">副标题</label><input class="inp" id="bg-sub" value="KONGTIAN EXPLORER"></div>
            <div class="field"><label class="lab">形状</label><select class="sel" id="bg-shape"><option value="shield">盾牌</option><option value="circle">圆形</option><option value="hex">六边形</option></select></div>
            <div class="field"><label class="lab">主色</label><input type="color" id="bg-c1" value="#38cdf0"></div>
            <div class="field"><label class="lab">辅色</label><input type="color" id="bg-c2" value="#818cf8"></div>
            <div class="field"><label class="lab">编号前缀</label><input class="inp" id="bg-prefix" value="KT"></div>
            <div class="field" style="display:flex;align-items:flex-end"><label class="row" style="gap:5px"><input type="checkbox" id="bg-qr" checked> 含二维码</label></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="bg-run" style="width:100%">生成</button></div>
          </div>
          <div class="field" style="margin-top:9px"><label class="lab">批量名称（每行一个，可选）</label><textarea class="ta" id="bg-list" rows="4" placeholder="张三&#10;李四&#10;王五"></textarea></div>
          <div class="row" style="margin-top:9px"><button class="btn" id="bg-svg">下载 SVG</button><button class="btn" id="bg-png">下载 PNG</button><button class="btn" id="bg-batch">批量生成 ZIP</button><span class="hint" id="bg-meta"></span></div>
        </div>
        <div class="panel center"><div class="canvas-wrap" id="bg-preview" style="display:inline-block"><div class="hint">徽章预览</div></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let current = null;
    const buildSvg = async (name, code) => {
      const id = 'g' + uid();
      const c1 = $('#bg-c1').value, c2 = $('#bg-c2').value;
      const shape = $('#bg-shape').value;
      const title = name || $('#bg-title').value;
      const sub = $('#bg-sub').value;
      const path = shape === 'shield'
        ? 'M300 60 L520 130 V300 C520 420 420 510 300 560 C180 510 80 420 80 300 V130 Z'
        : shape === 'hex'
          ? 'M300 50 L520 175 V425 L300 550 L80 425 V175 Z'
          : '';
      const qr = $('#bg-qr').checked ? await qrDataUrl(`https://by654.github.io/kongtian-tools/#/t/cert-verify?v=${encodeURIComponent(code)}`, ctx, 6) : '';
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 620" width="600" height="620">
<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect width="600" height="620" fill="#070b14"/>
${shape === 'circle' ? `<circle cx="300" cy="300" r="240" fill="url(#${id})"/><circle cx="300" cy="300" r="212" fill="#0b1220" stroke="${c1}" stroke-width="2"/>` : `<path d="${path}" fill="url(#${id})"/><path d="${path}" fill="#0b1220" transform="translate(300 310) scale(.9) translate(-300 -310)" stroke="${c1}" stroke-width="2"/>`}
<circle cx="300" cy="250" r="74" fill="none" stroke="${c1}" stroke-width="3"/>
<ellipse cx="300" cy="250" rx="100" ry="34" fill="none" stroke="${c2}" stroke-width="2" transform="rotate(-25 300 250)"/>
<circle cx="300" cy="250" r="26" fill="url(#${id})"/>
<text x="300" y="390" text-anchor="middle" fill="#e9eefc" font-family="-apple-system,'PingFang SC',sans-serif" font-size="34" font-weight="800">${esc(title)}</text>
<text x="300" y="424" text-anchor="middle" fill="${c1}" font-family="-apple-system,sans-serif" font-size="13" letter-spacing="3">${esc(sub)}</text>
<text x="300" y="468" text-anchor="middle" fill="#8b9bb8" font-family="ui-monospace,monospace" font-size="13">${esc(code)}</text>
${qr ? `<image href="${qr}" x="430" y="490" width="110" height="110"/>` : ''}
<circle cx="300" cy="560" r="4" fill="${c1}"/>
</svg>`;
    };
    const run = async () => {
      const code = `${$('#bg-prefix').value}-${Date.now().toString().slice(-6)}`;
      current = await buildSvg('', code);
      $('#bg-preview').innerHTML = current;
      $('#bg-meta').textContent = code;
    };
    const svgToPng = (svg) => new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 1240;
        cv.getContext('2d').drawImage(img, 0, 0, 1200, 1240);
        cv.toBlob(res);
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    });
    $('#bg-run').onclick = run;
    $('#bg-svg').onclick = () => current && download('badge.svg', current, 'image/svg+xml');
    $('#bg-png').onclick = async () => { if (current) download('badge.png', await svgToPng(current)); };
    $('#bg-batch').onclick = async () => {
      const names = $('#bg-list').value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
      if (!names.length) return toast('请填写批量名称', 'err');
      try {
        await ctx.deps(['jszip']);
        const zip = new window.JSZip();
        for (let i = 0; i < names.length; i++) {
          const code = `${$('#bg-prefix').value}-${pad(i + 1, 4)}`;
          const svg = await buildSvg(names[i], code);
          zip.file(`badge-${pad(i + 1, 3)}-${names[i]}.svg`, svg);
        }
        download('badges.zip', await zip.generateAsync({ type: 'blob' }));
      } catch (e) { toast(e.message, 'err'); }
    };
    ['#bg-title', '#bg-sub', '#bg-shape', '#bg-c1', '#bg-c2', '#bg-qr'].forEach((s) => $(s).addEventListener('input', () => run()));
    $('#bg-shape').addEventListener('change', () => run());
    run();
  },

  /* ================= 证书生成器 ================= */
  'cert-gen'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="grid4">
            <div class="field"><label class="lab">模板</label><select class="sel" id="cg-tpl"><option value="award">奖状</option><option value="completion">结业证书</option><option value="participation">参赛证书</option><option value="volunteer">志愿者证书</option><option value="training">培训证书</option></select></div>
            <div class="field"><label class="lab">姓名 / 单位</label><input class="inp" id="cg-name" value="张三"></div>
            <div class="field"><label class="lab">课程 / 事由</label><input class="inp" id="cg-course" value="空天工具合集前端实践"></div>
            <div class="field"><label class="lab">颁发方</label><input class="inp" id="cg-issuer" value="空天工具合集"></div>
            <div class="field"><label class="lab">日期</label><input class="inp" id="cg-date" type="date"></div>
            <div class="field"><label class="lab">证书编号</label><input class="inp mono" id="cg-no" value="KT-2026-0001"></div>
            <div class="field"><label class="lab">主题色</label><input type="color" id="cg-color" value="#38cdf0"></div>
            <div class="field" style="display:flex;align-items:flex-end"><label class="row" style="gap:5px"><input type="checkbox" id="cg-qr" checked> 含校验二维码</label></div>
          </div>
          <div class="field" style="margin-top:9px"><label class="lab">批量姓名（每行一个，可选）</label><textarea class="ta" id="cg-list" rows="3" placeholder="张三&#10;李四"></textarea></div>
          <div class="row" style="margin-top:9px"><button class="btn primary" id="cg-run">生成证书</button><button class="btn" id="cg-png">下载 PNG</button><button class="btn" id="cg-print">打印 / PDF</button><button class="btn" id="cg-batch">批量 ZIP</button><button class="btn" id="cg-verify">校验页</button></div>
        </div>
        <div class="panel"><div class="canvas-wrap"><canvas id="cg-canvas" width="1600" height="1131" style="max-height:560px"></canvas></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#cg-date').value = new Date().toISOString().slice(0, 10);
    const tplText = { award: ['奖 状', '在本次活动中表现优异，特发此状，以资鼓励。'], completion: ['结 业 证 书', '已完成全部课程学习，经考核合格，特发此证。'], participation: ['参 赛 证 书', '积极参加本次竞赛，展现良好风采，特此证明。'], volunteer: ['志 愿 者 证 书', '热心参与志愿服务，奉献爱心，特此致谢。'], training: ['培 训 证 书', '已完成本次培训课程，成绩合格，特发此证。'] };
    let qrImg = null;
    const draw = async () => {
      const cv = $('#cg-canvas'), g = cv.getContext('2d');
      const W = cv.width, H = cv.height;
      const color = $('#cg-color').value;
      g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
      const grad = g.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, color + '22'); grad.addColorStop(1, '#ffffff');
      g.fillStyle = grad; g.fillRect(30, 30, W - 60, H - 60);
      g.strokeStyle = color; g.lineWidth = 6; g.strokeRect(40, 40, W - 80, H - 80);
      g.lineWidth = 1; g.strokeRect(58, 58, W - 116, H - 116);
      g.textAlign = 'center';
      g.fillStyle = color; g.font = '600 24px -apple-system, "PingFang SC", sans-serif';
      g.fillText($('#cg-issuer').value, W / 2, 150);
      const [title, body] = tplText[$('#cg-tpl').value];
      g.fillStyle = '#0e1a2f'; g.font = '800 70px -apple-system, "PingFang SC", serif';
      g.fillText(title, W / 2, 300);
      g.font = '400 26px -apple-system, "PingFang SC", sans-serif';
      g.fillStyle = '#333';
      g.fillText(body, W / 2, 380);
      g.fillStyle = '#111'; g.font = '700 54px -apple-system, "PingFang SC", sans-serif';
      g.fillText($('#cg-name').value, W / 2, 520);
      g.strokeStyle = '#999'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(W / 2 - 200, 540); g.lineTo(W / 2 + 200, 540); g.stroke();
      g.fillStyle = '#555'; g.font = '400 26px -apple-system, "PingFang SC", sans-serif';
      g.fillText($('#cg-course').value, W / 2, 600);
      g.textAlign = 'left'; g.fillStyle = '#666'; g.font = '400 20px sans-serif';
      g.fillText('证书编号：' + $('#cg-no').value, 110, H - 110);
      g.fillText('颁发日期：' + $('#cg-date').value, 110, H - 80);
      g.textAlign = 'right';
      g.fillText($('#cg-issuer').value, W - 110, H - 90);
      g.strokeStyle = '#999'; g.beginPath(); g.moveTo(W - 360, H - 118); g.lineTo(W - 110, H - 118); g.stroke();
      if ($('#cg-qr').checked) {
        if (!qrImg) {
          const url = await qrDataUrl('https://by654.github.io/kongtian-tools/#/t/cert-verify', ctx, 4);
          qrImg = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = url; });
        }
        g.drawImage(qrImg, W - 210, H - 230, 120, 120);
        g.textAlign = 'center'; g.fillStyle = '#888'; g.font = '12px sans-serif';
        g.fillText('扫码校验', W - 150, H - 96);
      }
    };
    $('#cg-run').onclick = draw;
    $('#cg-png').onclick = () => $('#cg-canvas').toBlob((b) => download('certificate.png', b));
    $('#cg-print').onclick = () => {
      const url = $('#cg-canvas').toDataURL('image/png');
      const w = window.open('', '_blank');
      w.document.write(`<html><head><title>证书</title><style>@page{size:A4 landscape;margin:0}body{margin:0}img{width:100%;height:100vh;object-fit:contain}</style></head><body><img src="${url}"></body></html>`);
      w.document.close(); setTimeout(() => w.print(), 300);
    };
    $('#cg-batch').onclick = async () => {
      const names = $('#cg-list').value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
      if (!names.length) return toast('请填写批量姓名', 'err');
      try {
        await ctx.deps(['jszip']);
        const zip = new window.JSZip();
        const original = $('#cg-name').value;
        for (let i = 0; i < names.length; i++) {
          $('#cg-name').value = names[i];
          $('#cg-no').value = `KT-${new Date().getFullYear()}-${pad(i + 1, 4)}`;
          qrImg = null;
          await draw();
          const blob = await new Promise((res) => $('#cg-canvas').toBlob(res));
          zip.file(`cert-${pad(i + 1, 3)}-${names[i]}.png`, blob);
        }
        $('#cg-name').value = original;
        await draw();
        download('certificates.zip', await zip.generateAsync({ type: 'blob' }));
      } catch (e) { toast(e.message, 'err'); }
    };
    $('#cg-verify').onclick = () => {
      const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>证书校验</title><style>body{font-family:-apple-system,"PingFang SC",sans-serif;background:#f4f7fc;color:#111;max-width:560px;margin:60px auto;padding:0 20px}.card{background:#fff;border:1px solid #e5e9f2;border-radius:12px;padding:24px}h1{font-size:22px}input{width:100%;padding:10px;border:1px solid #d8dee9;border-radius:8px;font:inherit;box-sizing:border-box}button{margin-top:10px;background:#0ea5e9;color:#fff;border:0;padding:10px 20px;border-radius:8px}#r{margin-top:14px;font-size:14px}</style></head><body><div class="card"><h1>证书校验</h1><p>输入证书编号：</p><input id="n" placeholder="KT-2026-0001"><button onclick="check()">校验</button><div id="r"></div></div><script>function check(){const v=document.getElementById('n').value.trim();document.getElementById('r').textContent=v?'编号格式'+(/^KT-\\d{4}-\\d{4}$/.test(v)?'有效':'无效')+'（本地演示，实际需接入签发记录）':'请输入编号'}<\/script></body></html>`;
      download('verify.html', html, 'text/html');
    };
    ['#cg-tpl', '#cg-name', '#cg-course', '#cg-issuer', '#cg-date', '#cg-no', '#cg-color', '#cg-qr'].forEach((s) => {
      $(s).addEventListener('input', draw);
      $(s).addEventListener('change', draw);
    });
    draw();
  },

  /* ================= 白板 ================= */
  'whiteboard'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="row" style="gap:6px;flex-wrap:wrap">
            <select class="sel" id="wb-tool" style="max-width:110px"><option value="pen">画笔</option><option value="eraser">橡皮</option><option value="line">直线</option><option value="rect">矩形</option><option value="ellipse">椭圆</option><option value="text">文字</option></select>
            <input type="color" id="wb-color" value="#38cdf0">
            <input type="range" id="wb-width" min="1" max="20" value="3" style="max-width:110px">
            <button class="btn sm" id="wb-undo">撤销</button><button class="btn sm" id="wb-clear">清空</button>
            <select class="sel" id="wb-tpl" style="max-width:150px"><option value="">模板…</option><option value="brainstorm">头脑风暴</option><option value="journey">用户旅程</option><option value="kanban">Kanban</option><option value="swot">SWOT</option><option value="flow">流程图</option><option value="org">组织架构</option><option value="timeline">时间轴</option><option value="fishbone">鱼骨图</option><option value="matrix">矩阵图</option><option value="affinity">亲和图</option></select>
            <button class="btn sm" id="wb-png">PNG</button><button class="btn sm" id="wb-svg">SVG</button><button class="btn sm" id="wb-json">JSON</button><button class="btn sm" id="wb-import">导入</button>
          </div>
        </div>
        <div class="panel" style="padding:8px"><div class="canvas-wrap" style="padding:0;background:#fff"><canvas id="wb-canvas" width="1200" height="680" style="width:100%;background:#fff;touch-action:none;cursor:crosshair"></canvas></div></div>
        <div class="panel">
          <div class="panel-head"><b>本地投票</b><span class="hint">点选项投票，结果保存在本机</span></div>
          <textarea class="ta" id="wb-vote-opts" rows="3" style="margin-bottom:8px">方案 A
方案 B
方案 C</textarea>
          <div class="row" id="wb-vote-btns"></div>
          <div id="wb-vote-result" class="hint" style="margin-top:8px"></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const cv = $('#wb-canvas'), g = cv.getContext('2d');
    let ops = [], current = null, drawing = false;
    const save = () => localStorage.setItem('kt:whiteboard', JSON.stringify(ops));
    const load = () => { try { ops = JSON.parse(localStorage.getItem('kt:whiteboard') || '[]'); } catch { ops = []; } };
    const drawOp = (op) => {
      g.save();
      g.strokeStyle = op.color; g.fillStyle = op.color; g.lineWidth = op.width; g.lineCap = 'round'; g.lineJoin = 'round';
      if (op.t === 'pen' || op.t === 'eraser') {
        g.strokeStyle = op.t === 'eraser' ? '#ffffff' : op.color;
        g.lineWidth = op.t === 'eraser' ? op.width * 4 : op.width;
        g.beginPath();
        op.pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
        g.stroke();
      } else if (op.t === 'line') {
        g.beginPath(); g.moveTo(op.x1, op.y1); g.lineTo(op.x2, op.y2); g.stroke();
      } else if (op.t === 'rect') {
        g.strokeRect(op.x1, op.y1, op.x2 - op.x1, op.y2 - op.y1);
      } else if (op.t === 'ellipse') {
        g.beginPath(); g.ellipse((op.x1 + op.x2) / 2, (op.y1 + op.y2) / 2, Math.abs(op.x2 - op.x1) / 2, Math.abs(op.y2 - op.y1) / 2, 0, 0, Math.PI * 2); g.stroke();
      } else if (op.t === 'text') {
        g.font = `600 ${op.size || 22}px -apple-system, "PingFang SC", sans-serif`;
        g.textAlign = 'left'; g.textBaseline = 'top';
        g.fillText(op.text, op.x1, op.y1);
      }
      g.restore();
    };
    const redraw = () => {
      g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
      g.strokeStyle = 'rgba(0,0,0,.06)'; g.lineWidth = 1;
      for (let x = 0; x <= cv.width; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, cv.height); g.stroke(); }
      for (let y = 0; y <= cv.height; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(cv.width, y); g.stroke(); }
      ops.forEach(drawOp);
      if (current) drawOp(current);
    };
    const pos = (e) => {
      const r = cv.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return [Math.round((t.clientX - r.left) / r.width * cv.width), Math.round((t.clientY - r.top) / r.height * cv.height)];
    };
    const down = (e) => {
      e.preventDefault();
      const [x, y] = pos(e);
      const tool = $('#wb-tool').value;
      drawing = true;
      if (tool === 'text') {
        const text = prompt('输入文字');
        if (text) { ops.push({ t: 'text', x1: x, y1: y, text, color: $('#wb-color').value, size: 22 }); save(); redraw(); }
        drawing = false; return;
      }
      if (tool === 'pen' || tool === 'eraser') current = { t: tool, pts: [[x, y]], color: $('#wb-color').value, width: Number($('#wb-width').value) };
      else current = { t: tool, x1: x, y1: y, x2: x, y2: y, color: $('#wb-color').value, width: Number($('#wb-width').value) };
      redraw();
    };
    const move = (e) => {
      if (!drawing || !current) return;
      e.preventDefault();
      const [x, y] = pos(e);
      if (current.pts) current.pts.push([x, y]); else { current.x2 = x; current.y2 = y; }
      redraw();
    };
    const up = () => {
      if (!drawing || !current) { drawing = false; return; }
      ops.push(current); current = null; drawing = false; save(); redraw();
    };
    cv.addEventListener('mousedown', down); cv.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    cv.addEventListener('touchstart', down, { passive: false }); cv.addEventListener('touchmove', move, { passive: false }); cv.addEventListener('touchend', up);
    $('#wb-undo').onclick = () => { ops.pop(); save(); redraw(); };
    $('#wb-clear').onclick = () => { ops = []; save(); redraw(); };
    $('#wb-png').onclick = () => cv.toBlob((b) => download('whiteboard.png', b));
    $('#wb-json').onclick = () => download('whiteboard.json', JSON.stringify(ops, null, 2), 'application/json');
    $('#wb-svg').onclick = () => {
      const parts = ops.map((op) => {
        if (op.t === 'pen' || op.t === 'eraser') {
          const d = op.pts.map(([x, y], i) => (i ? 'L' : 'M') + x + ' ' + y).join(' ');
          return `<path d="${d}" fill="none" stroke="${op.t === 'eraser' ? '#fff' : op.color}" stroke-width="${op.width}" stroke-linecap="round"/>`;
        }
        if (op.t === 'line') return `<line x1="${op.x1}" y1="${op.y1}" x2="${op.x2}" y2="${op.y2}" stroke="${op.color}" stroke-width="${op.width}"/>`;
        if (op.t === 'rect') return `<rect x="${Math.min(op.x1, op.x2)}" y="${Math.min(op.y1, op.y2)}" width="${Math.abs(op.x2 - op.x1)}" height="${Math.abs(op.y2 - op.y1)}" fill="none" stroke="${op.color}" stroke-width="${op.width}"/>`;
        if (op.t === 'ellipse') return `<ellipse cx="${(op.x1 + op.x2) / 2}" cy="${(op.y1 + op.y2) / 2}" rx="${Math.abs(op.x2 - op.x1) / 2}" ry="${Math.abs(op.y2 - op.y1) / 2}" fill="none" stroke="${op.color}" stroke-width="${op.width}"/>`;
        return `<text x="${op.x1}" y="${op.y1}" fill="${op.color}" font-size="${op.size || 22}">${esc(op.text)}</text>`;
      }).join('');
      download('whiteboard.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cv.width} ${cv.height}" width="${cv.width}" height="${cv.height}"><rect width="100%" height="100%" fill="#fff"/>${parts}</svg>`, 'image/svg+xml');
    };
    $('#wb-import').onclick = () => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
      inp.onchange = async () => { try { ops = JSON.parse(await inp.files[0].text()); save(); redraw(); } catch { toast('JSON 无效', 'err'); } };
      inp.click();
    };
    $('#wb-tpl').onchange = () => {
      const t = $('#wb-tpl').value; if (!t) return;
      const color = $('#wb-color').value;
      const box = (x, y, w, h, text) => { ops.push({ t: 'rect', x1: x, y1: y, x2: x + w, y2: y + h, color, width: 2 }); ops.push({ t: 'text', x1: x + 10, y1: y + 10, text, color, size: 22 }); };
      ops = [];
      if (t === 'brainstorm') { box(60, 60, 220, 120, '主题'); for (let i = 0; i < 5; i++) box(360 + (i % 2) * 280, 60 + Math.floor(i / 2) * 150, 220, 100, '想法 ' + (i + 1)); }
      else if (t === 'journey') { ['认知', '考虑', '购买', '使用', '推荐'].forEach((s, i) => box(50 + i * 220, 100, 190, 90, s)); [0, 1, 2, 3, 4].forEach((i) => box(50 + i * 220, 260, 190, 120, '情绪/触点')); }
      else if (t === 'kanban') { ['待办', '进行中', '已完成'].forEach((s, i) => box(50 + i * 380, 50, 330, 520, s)); }
      else if (t === 'swot') { ['S 优势', 'W 劣势', 'O 机会', 'T 威胁'].forEach((s, i) => box(80 + (i % 2) * 520, 80 + Math.floor(i / 2) * 250, 460, 200, s)); }
      else if (t === 'flow') { ['开始', '步骤一', '判断', '结束'].forEach((s, i) => box(120 + i * 240, 280, 180, 100, s)); }
      else if (t === 'org') { box(450, 50, 300, 100, '负责人'); for (let i = 0; i < 3; i++) box(120 + i * 340, 250, 260, 100, '成员 ' + (i + 1)); }
      else if (t === 'timeline') { for (let i = 0; i < 5; i++) box(60 + i * 220, 300, 190, 90, '阶段 ' + (i + 1)); ops.push({ t: 'line', x1: 40, y1: 345, x2: 1160, y2: 345, color, width: 3 }); }
      else if (t === 'fishbone') { ops.push({ t: 'line', x1: 100, y1: 340, x2: 1080, y2: 340, color, width: 4 }); for (let i = 0; i < 4; i++) box(200 + i * 220, 120, 160, 80, '原因 ' + (i + 1)); for (let i = 0; i < 4; i++) box(200 + i * 220, 470, 160, 80, '原因 ' + (i + 5)); }
      else if (t === 'matrix') { box(60, 60, 500, 260, '重要且紧急'); box(620, 60, 500, 260, '重要不紧急'); box(60, 360, 500, 260, '紧急不重要'); box(620, 360, 500, 260, '不重要不紧急'); }
      else if (t === 'affinity') { for (let g = 0; g < 4; g++) box(50 + g * 290, 80, 250, 460, '分组 ' + (g + 1)); }
      save(); redraw();
    };
    const paintVote = () => {
      const opts = $('#wb-vote-opts').value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
      const data = JSON.parse(localStorage.getItem('kt:wb-vote') || '{}');
      $('#wb-vote-btns').innerHTML = opts.map((o, i) => `<button class="chip" data-vote="${i}">${esc(o)}</button>`).join('');
      const total = Object.values(data).reduce((s, v) => s + v, 0);
      $('#wb-vote-result').textContent = total ? opts.map((o, i) => `${o}: ${data[i] || 0} 票`).join(' · ') : '还没有投票';
      root.querySelectorAll('[data-vote]').forEach((b) => b.addEventListener('click', () => {
        const d = JSON.parse(localStorage.getItem('kt:wb-vote') || '{}');
        const k = b.dataset.vote; d[k] = (d[k] || 0) + 1;
        localStorage.setItem('kt:wb-vote', JSON.stringify(d)); paintVote();
      }));
    };
    $('#wb-vote-opts').addEventListener('input', paintVote);
    load(); redraw(); paintVote();
  }
};
