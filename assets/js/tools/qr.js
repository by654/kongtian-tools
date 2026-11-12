/* 二维码、条码与识别 */
import { esc, copy, toast, download, fmtBytes } from '../core/ui.js';
import { bindFileZone, fileZone, loadImage } from '../core/kit.js';

const $ = (root, s) => root.querySelector(s);

function makeQr(text, ec = 'M') {
  const qr = window.qrcode(0, ec);
  qr.addData(text);
  qr.make();
  return qr;
}
function drawQr(cv, qr, { size = 640, margin = 4, fg = '#000000', bg = '#ffffff', logo = null } = {}) {
  const count = qr.getModuleCount();
  const cell = Math.floor(size / (count + margin * 2));
  const total = cell * (count + margin * 2);
  cv.width = total; cv.height = total;
  const g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, total, total);
  g.fillStyle = fg;
  for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) {
    if (qr.isDark(r, c)) g.fillRect((c + margin) * cell, (r + margin) * cell, cell, cell);
  }
  if (logo) {
    const lw = total * 0.22;
    const x = (total - lw) / 2, y = (total - lw) / 2;
    g.fillStyle = bg;
    g.beginPath(); g.roundRect(x - 6, y - 6, lw + 12, lw + 12, 10); g.fill();
    g.drawImage(logo, x, y, lw, lw);
  }
  return cv;
}
function qrSvg(qr, { margin = 4, fg = '#000000', bg = '#ffffff' } = {}) {
  const count = qr.getModuleCount();
  let path = '';
  for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (qr.isDark(r, c)) path += `M${c + margin},${r + margin}h1v1h-1z`;
  const size = count + margin * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="512" height="512" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="${bg}"/><path d="${path}" fill="${fg}"/></svg>`;
}

export default {
  /* ================= 二维码生成 ================= */
  'qr-gen'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="grid3">
            <div class="field"><label class="lab">内容类型</label><select class="sel" id="qg-type"><option value="text">文本</option><option value="url">网址</option><option value="wifi">WiFi</option><option value="vcard">名片 vCard</option><option value="email">邮件</option><option value="sms">短信</option><option value="tel">电话</option><option value="geo">位置</option></select></div>
            <div class="field"><label class="lab">尺寸 px</label><input class="inp" id="qg-size" type="number" value="640"></div>
            <div class="field"><label class="lab">容错级别</label><select class="sel" id="qg-ec"><option value="L">L (7%)</option><option value="M" selected>M (15%)</option><option value="Q">Q (25%)</option><option value="H">H (30%)</option></select></div>
          </div>
          <div id="qg-form" style="margin-top:10px"></div>
          <div class="grid3" style="margin-top:10px">
            <div class="field"><label class="lab">前景色</label><input type="color" id="qg-fg" value="#000000"></div>
            <div class="field"><label class="lab">背景色</label><input type="color" id="qg-bg" value="#ffffff"></div>
            <div class="field"><label class="lab">Logo（可选）</label><input type="file" id="qg-logo" accept="image/*" class="inp" style="padding:6px"></div>
          </div>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="qg-run">生成二维码</button><button class="btn" id="qg-png">下载 PNG</button><button class="btn" id="qg-svg">下载 SVG</button><span class="hint" id="qg-meta"></span></div>
        </div>
        <div class="panel center"><div class="canvas-wrap" id="qg-preview" style="display:inline-block"><div class="hint">二维码会显示在这里</div></div><pre class="out" id="qg-content" style="margin-top:10px;text-align:left;display:none"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let logoImg = null, currentQr = null;
    const forms = {
      text: `<div class="field"><label class="lab">文本</label><textarea class="ta" id="qg-text" rows="3">空天工具合集</textarea></div>`,
      url: `<div class="field"><label class="lab">网址</label><input class="inp mono" id="qg-url" value="https://by654.github.io/kongtian-tools/"></div>`,
      wifi: `<div class="grid3"><div class="field"><label class="lab">WiFi 名称</label><input class="inp" id="qg-ssid" value="MyWiFi"></div><div class="field"><label class="lab">密码</label><input class="inp" id="qg-pass" value="password"></div><div class="field"><label class="lab">加密</label><select class="sel" id="qg-enc"><option value="WPA">WPA/WPA2</option><option value="WEP">WEP</option><option value="nopass">无密码</option></select></div></div>`,
      vcard: `<div class="grid2"><div class="field"><label class="lab">姓名</label><input class="inp" id="qg-name" value="张三"></div><div class="field"><label class="lab">电话</label><input class="inp" id="qg-phone" value="13800000000"></div><div class="field"><label class="lab">邮箱</label><input class="inp" id="qg-email" value="zhangsan@example.com"></div><div class="field"><label class="lab">公司</label><input class="inp" id="qg-org" value="空天科技"></div></div>`,
      email: `<div class="grid2"><div class="field"><label class="lab">收件人</label><input class="inp" id="qg-to" value="hello@example.com"></div><div class="field"><label class="lab">主题</label><input class="inp" id="qg-subject" value="你好"></div></div><div class="field" style="margin-top:8px"><label class="lab">正文</label><textarea class="ta" id="qg-body" rows="2"></textarea></div>`,
      sms: `<div class="grid2"><div class="field"><label class="lab">手机号</label><input class="inp" id="qg-smsphone" value="13800000000"></div><div class="field"><label class="lab">短信内容</label><input class="inp" id="qg-smsbody" value="你好"></div></div>`,
      tel: `<div class="field"><label class="lab">电话号码</label><input class="inp" id="qg-tel" value="+8613800000000"></div>`,
      geo: `<div class="grid2"><div class="field"><label class="lab">纬度</label><input class="inp" id="qg-lat" value="39.9042"></div><div class="field"><label class="lab">经度</label><input class="inp" id="qg-lng" value="116.4074"></div></div>`
    };
    const paintForm = () => { $('#qg-form').innerHTML = forms[$('#qg-type').value]; };
    paintForm();
    $('#qg-type').addEventListener('change', paintForm);
    const content = () => {
      const t = $('#qg-type').value;
      if (t === 'text') return $('#qg-text').value;
      if (t === 'url') return $('#qg-url').value;
      if (t === 'wifi') return `WIFI:T:${$('#qg-enc').value};S:${$('#qg-ssid').value};P:${$('#qg-pass').value};;`;
      if (t === 'vcard') return `BEGIN:VCARD\nVERSION:3.0\nFN:${$('#qg-name').value}\nTEL:${$('#qg-phone').value}\nEMAIL:${$('#qg-email').value}\nORG:${$('#qg-org').value}\nEND:VCARD`;
      if (t === 'email') return `mailto:${$('#qg-to').value}?subject=${encodeURIComponent($('#qg-subject').value)}&body=${encodeURIComponent($('#qg-body').value)}`;
      if (t === 'sms') return `SMSTO:${$('#qg-smsphone').value}:${$('#qg-smsbody').value}`;
      if (t === 'tel') return `tel:${$('#qg-tel').value}`;
      return `geo:${$('#qg-lat').value},${$('#qg-lng').value}`;
    };
    $('#qg-logo').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      logoImg = f ? await loadImage(URL.createObjectURL(f)) : null;
    });
    const run = async () => {
      try {
        await ctx.deps(['qrcode']);
        const text = content();
        if (!text.trim()) return toast('内容不能为空', 'err');
        currentQr = makeQr(text, $('#qg-ec').value);
        const cv = document.createElement('canvas');
        drawQr(cv, currentQr, { size: Number($('#qg-size').value) || 640, margin: 4, fg: $('#qg-fg').value, bg: $('#qg-bg').value, logo: logoImg });
        cv.style.maxWidth = '300px';
        $('#qg-preview').innerHTML = '';
        $('#qg-preview').appendChild(cv);
        $('#qg-content').style.display = 'block';
        $('#qg-content').textContent = text;
        $('#qg-meta').textContent = `${currentQr.getModuleCount()} × ${currentQr.getModuleCount()} 模块`;
      } catch (e) { toast(e.message, 'err'); }
    };
    $('#qg-run').onclick = run;
    $('#qg-png').onclick = () => { const cv = $('#qg-preview canvas'); if (cv) cv.toBlob((b) => download('qrcode.png', b)); else toast('先生成', 'err'); };
    $('#qg-svg').onclick = () => {
      if (!currentQr) return toast('先生成', 'err');
      download('qrcode.svg', qrSvg(currentQr, { fg: $('#qg-fg').value, bg: $('#qg-bg').value }), 'image/svg+xml');
    };
    run();
  },

  /* ================= 批量二维码 ================= */
  'qr-batch'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>批量二维码</b><span class="hint">每行一个内容，生成后打包下载</span></div>
          <textarea class="ta mono" id="qb-in" rows="7">https://example.com/1
https://example.com/2
https://example.com/3</textarea>
          <div class="grid3" style="margin-top:9px">
            <div class="field"><label class="lab">每张尺寸</label><input class="inp" id="qb-size" type="number" value="320"></div>
            <div class="field"><label class="lab">容错</label><select class="sel" id="qb-ec"><option value="M">M</option><option value="L">L</option><option value="Q">Q</option><option value="H">H</option></select></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="qb-run" style="width:100%">生成</button></div>
          </div>
          <div class="row" style="margin-top:8px"><button class="btn" id="qb-zip">下载 ZIP</button><span class="hint" id="qb-meta">尚未生成</span></div>
        </div>
        <div class="panel"><div class="thumbs" id="qb-list"><div class="hint">结果会显示在这里</div></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let blobs = [];
    $('#qb-run').onclick = async () => {
      try {
        await ctx.deps(['qrcode']);
        const lines = $('#qb-in').value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean).slice(0, 200);
        blobs = [];
        $('#qb-list').innerHTML = '';
        for (let i = 0; i < lines.length; i++) {
          const qr = makeQr(lines[i], $('#qb-ec').value);
          const cv = document.createElement('canvas');
          drawQr(cv, qr, { size: Number($('#qb-size').value) || 320, margin: 3 });
          const blob = await new Promise((res) => cv.toBlob(res));
          blobs.push({ name: `qr-${String(i + 1).padStart(2, '0')}.png`, blob });
          const url = URL.createObjectURL(blob);
          $('#qb-list').insertAdjacentHTML('beforeend', `<div class="thumb" style="aspect-ratio:auto"><img src="${url}" alt=""><div class="hint" style="font-size:9px">qr-${i + 1}.png</div></div>`);
        }
        $('#qb-meta').textContent = `${blobs.length} 张二维码`;
      } catch (e) { toast(e.message, 'err'); }
    };
    $('#qb-zip').onclick = async () => {
      if (!blobs.length) return toast('先生成', 'err');
      await ctx.deps(['jszip']);
      const zip = new window.JSZip();
      blobs.forEach((b) => zip.file(b.name, b.blob));
      download('qrcodes.zip', await zip.generateAsync({ type: 'blob' }));
    };
    $('#qb-run').click();
  },

  /* ================= 二维码识别 ================= */
  'qr-scan'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>二维码识别</b><span class="hint">上传图片或使用摄像头，本地解码</span></div>
          ${fileZone('qs-zone', { accept: 'image/*', label: '选择二维码图片' })}
          <div class="row" style="margin-top:10px"><button class="btn primary" id="qs-cam">摄像头扫码</button><button class="btn" id="qs-stop">停止</button><span class="hint" id="qs-meta">等待识别</span></div>
          <div class="canvas-wrap" style="margin-top:10px"><video id="qs-video" playsinline muted style="width:100%;max-height:320px;display:none;background:#000"></video><div id="qs-preview" class="hint">图片预览区域</div></div>
        </div>
        <div class="panel"><div class="panel-head"><b>识别结果</b><button class="btn sm" id="qs-copy">复制</button></div><pre class="out" id="qs-out" style="max-height:220px"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let stream = null, raf = 0;
    const decode = async (source) => {
      try {
        await ctx.deps(['jsqr']);
        const cv = document.createElement('canvas');
        const isVideo = source instanceof HTMLVideoElement;
        cv.width = isVideo ? source.videoWidth : source.width;
        cv.height = isVideo ? source.videoHeight : source.height;
        if (!cv.width || !cv.height) return false;
        const g = cv.getContext('2d');
        g.drawImage(source, 0, 0, cv.width, cv.height);
        const data = g.getImageData(0, 0, cv.width, cv.height);
        const code = window.jsQR(data.data, cv.width, cv.height);
        if (code) {
          $('#qs-out').textContent = code.data;
          $('#qs-meta').textContent = `识别成功 · ${code.data.length} 字符`;
          if (isVideo) {
            cancelAnimationFrame(raf);
            stream?.getTracks().forEach((t) => t.stop());
            $('#qs-video').style.display = 'none';
          }
          return true;
        }
        return false;
      } catch (e) { $('#qs-meta').textContent = '识别失败：' + e.message; return false; }
    };
    bindFileZone(root, 'qs-zone', async (fs) => {
      const img = await loadImage(URL.createObjectURL(fs[0]));
      $('#qs-preview').innerHTML = `<img src="${img.src}" alt="" style="max-height:260px">`;
      await decode(img);
    });
    $('#qs-cam').onclick = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        const v = $('#qs-video');
        v.srcObject = stream; v.style.display = 'block';
        await v.play();
        const loop = async () => { const ok = await decode(v); if (!ok) raf = requestAnimationFrame(loop); };
        loop();
        $('#qs-meta').textContent = '正在扫描…';
      } catch (e) { $('#qs-meta').textContent = '摄像头不可用：' + e.message; }
    };
    $('#qs-stop').onclick = () => { cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); $('#qs-video').style.display = 'none'; $('#qs-meta').textContent = '已停止'; };
    $('#qs-copy').onclick = () => copy($('#qs-out').textContent);
    ctx.onDestroy(() => { cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); });
  },

  /* ================= 条形码 ================= */
  'barcode'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="grid3">
            <div class="field"><label class="lab">内容</label><input class="inp mono" id="bc-value" value="6901234567892"></div>
            <div class="field"><label class="lab">格式</label><select class="sel" id="bc-format"><option value="CODE128">Code 128</option><option value="EAN13">EAN-13</option><option value="UPC">UPC-A</option><option value="CODE39">Code 39</option><option value="ITF14">ITF-14</option></select></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="bc-run" style="width:100%">生成</button></div>
          </div>
          <div class="grid3" style="margin-top:10px">
            <div class="field"><label class="lab">条码宽度</label><input class="inp" id="bc-width" type="number" value="2"></div>
            <div class="field"><label class="lab">高度</label><input class="inp" id="bc-height" type="number" value="90"></div>
            <div class="field"><label class="lab">显示文字</label><select class="sel" id="bc-text"><option value="1">显示</option><option value="0">隐藏</option></select></div>
          </div>
          <div class="row" style="margin-top:9px"><button class="btn" id="bc-png">下载 PNG</button><span class="hint" id="bc-meta"></span></div>
        </div>
        <div class="panel center"><div class="canvas-wrap"><canvas id="bc-canvas"></canvas></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const validateEan = (v) => {
      if (!/^\d{12,13}$/.test(v)) return false;
      let sum = 0;
      for (let i = 0; i < 12; i++) sum += +v[i] * (i % 2 ? 3 : 1);
      return (10 - sum % 10) % 10 === +v[12];
    };
    $('#bc-run').onclick = async () => {
      try {
        await ctx.deps(['jsbarcode']);
        const format = $('#bc-format').value;
        const value = $('#bc-value').value.trim();
        if (format === 'EAN13' && value.length === 13 && !validateEan(value)) toast('EAN-13 校验位可能不正确', 'err');
        window.JsBarcode($('#bc-canvas'), value, {
          format, width: Number($('#bc-width').value) || 2, height: Number($('#bc-height').value) || 90,
          displayValue: $('#bc-text').value === '1', margin: 10, lineColor: '#000000', background: '#ffffff'
        });
        $('#bc-meta').textContent = `${format} · ${value}`;
      } catch (e) { toast('生成失败：' + e.message, 'err'); }
    };
    $('#bc-png').onclick = () => {
      const cv = $('#bc-canvas');
      if (cv.width) cv.toBlob((b) => download('barcode.png', b));
      else toast('先生成', 'err');
    };
    $('#bc-format').addEventListener('change', () => $('#bc-run').click());
    $('#bc-run').click();
  }
};
