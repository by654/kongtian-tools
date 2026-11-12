/* 颜色、CSS 与设计 */
import { esc, copy, toast, download, fmtBytes } from '../core/ui.js';
import { bindFileZone, fileZone, loadImage } from '../core/kit.js';

const clamp = (v, a = 0, b = 255) => Math.min(b, Math.max(a, v));
const hex2 = (v) => v.toString(16).padStart(2, '0');
function hexToRgb(hex) {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error('颜色格式无效');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
const rgbToHex = ({ r, g, b }) => '#' + hex2(clamp(Math.round(r))) + hex2(clamp(Math.round(g))) + hex2(clamp(Math.round(b)));
function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}
function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}
function rgbToHsv({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s: max ? d / max * 100 : 0, v: max * 100 };
}
function cmyk({ r, g, b }) {
  const k = 1 - Math.max(r, g, b) / 255;
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  return { c: (1 - r / 255 - k) / (1 - k) * 100, m: (1 - g / 255 - k) / (1 - k) * 100, y: (1 - b / 255 - k) / (1 - k) * 100, k: k * 100 };
}
function luminance({ r, g, b }) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
  const l1 = luminance(a), l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function mix(a, b, t) {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}
function shade(hex, amt) {
  const c = hexToRgb(hex);
  return rgbToHex(amt > 0 ? mix(c, { r: 255, g: 255, b: 255 }, amt) : mix(c, { r: 0, g: 0, b: 0 }, -amt));
}
const NAMED = [['#f87171', '珊瑚红'], ['#fb923c', '橙'], ['#fbbf24', '琥珀'], ['#a3e635', '青柠'], ['#34d399', '翡翠'], ['#22d3ee', '青'], ['#38bdf8', '天蓝'], ['#818cf8', '靛蓝'], ['#c084fc', '紫'], ['#f472b6', '粉'], ['#94a3b8', '石板灰'], ['#e2e8f0', '云白'], ['#0f172a', '深海']];
function nearestName(hex) {
  const c = hexToRgb(hex);
  let best = NAMED[0], bd = Infinity;
  for (const [h, n] of NAMED) { const d = (hexToRgb(h).r - c.r) ** 2 + (hexToRgb(h).g - c.g) ** 2 + (hexToRgb(h).b - c.b) ** 2; if (d < bd) { bd = d; best = [h, n]; } }
  return best[1] + '（近似）';
}

export default {
  /* ================= 颜色转换 ================= */
  'color-convert'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="row"><input type="color" id="cc-picker" value="#38cdf0"><input class="inp mono" id="cc-hex" value="#38cdf0" style="max-width:160px">
            <button class="btn primary" id="cc-run">转换</button><button class="btn" id="cc-copy">复制全部</button></div>
        </div>
        <div class="panel" style="background:linear-gradient(135deg,var(--panel),var(--panel-2))"><div id="cc-swatch" style="height:110px;border-radius:10px;background:#38cdf0;border:1px solid var(--line)"></div></div>
        <div class="stat-grid" id="cc-out"></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const run = () => {
      try {
        const rgb = hexToRgb($('#cc-hex').value);
        const hsl = rgbToHsl(rgb), hsv = rgbToHsv(rgb), cm = cmyk(rgb);
        $('#cc-hex').value = rgbToHex(rgb);
        $('#cc-picker').value = rgbToHex(rgb);
        $('#cc-swatch').style.background = rgbToHex(rgb);
        $('#cc-out').innerHTML = [
          ['HEX', rgbToHex(rgb)], ['RGB', `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`],
          ['HSL', `hsl(${hsl.h.toFixed(0)}, ${hsl.s.toFixed(0)}%, ${hsl.l.toFixed(0)}%)`],
          ['HSV', `${hsv.h.toFixed(0)}°, ${hsv.s.toFixed(0)}%, ${hsv.v.toFixed(0)}%`],
          ['CMYK', `${cm.c.toFixed(0)}, ${cm.m.toFixed(0)}, ${cm.y.toFixed(0)}, ${cm.k.toFixed(0)}`],
          ['亮度', luminance(rgb).toFixed(3)], ['颜色名称', nearestName(rgbToHex(rgb))],
          ['变亮 20%', shade(rgbToHex(rgb), 0.2)], ['变暗 20%', shade(rgbToHex(rgb), -0.2)]
        ].map(([k, v]) => `<div class="stat"><b style="font-size:13px;word-break:break-all">${esc(String(v))}</b><span>${k}</span></div>`).join('');
      } catch (e) { toast(e.message, 'err'); }
    };
    $('#cc-picker').addEventListener('input', () => { $('#cc-hex').value = $('#cc-picker').value; run(); });
    $('#cc-hex').addEventListener('input', run);
    $('#cc-run').onclick = run;
    $('#cc-copy').onclick = () => copy($('#cc-out').innerText.replace(/\n/g, ' · '));
    run();
  },

  /* ================= 取色器 ================= */
  'color-picker'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>图片取色</b><span class="hint">点击图片任意位置取色，并提取主色调</span></div>
          ${fileZone('cp-zone', { accept: 'image/*', label: '选择图片或截图' })}
          <div class="row" style="margin-top:9px"><button class="btn" id="cp-eye">使用屏幕取色器</button><span class="hint" id="cp-info">尚未选择图片</span></div>
        </div>
        <div class="panel" id="cp-canvas-wrap" style="display:none"><div class="canvas-wrap"><canvas id="cp-canvas" style="cursor:crosshair"></canvas></div></div>
        <div class="grid2">
          <div class="panel"><div class="panel-head"><b>当前颜色</b></div><div class="row"><div id="cp-chip" style="width:56px;height:56px;border-radius:10px;border:1px solid var(--line);background:#38cdf0"></div><div><b class="mono" id="cp-hex">#38cdf0</b><div class="hint" id="cp-rgb">rgb(56, 205, 240)</div></div><button class="btn sm" id="cp-copy">复制</button></div></div>
          <div class="panel"><div class="panel-head"><b>主色调</b></div><div class="row" id="cp-palette"><span class="hint">选择图片后显示</span></div></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let img = null;
    const setColor = (r, g, b) => {
      const hex = rgbToHex({ r, g, b });
      $('#cp-chip').style.background = hex;
      $('#cp-hex').textContent = hex;
      $('#cp-rgb').textContent = `rgb(${r}, ${g}, ${b})`;
    };
    bindFileZone(root, 'cp-zone', async (files) => {
      const url = URL.createObjectURL(files[0]);
      img = await loadImage(url);
      const cv = $('#cp-canvas');
      const maxW = 900;
      const scale = Math.min(1, maxW / img.width);
      cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
      const g = cv.getContext('2d');
      g.drawImage(img, 0, 0, cv.width, cv.height);
      $('#cp-canvas-wrap').style.display = 'block';
      $('#cp-info').textContent = `${img.width} × ${img.height}`;
      const counts = new Map();
      const data = g.getImageData(0, 0, cv.width, cv.height).data;
      for (let i = 0; i < data.length; i += 4 * 12) {
        const key = (data[i] >> 4) + ',' + (data[i + 1] >> 4) + ',' + (data[i + 2] >> 4);
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
      $('#cp-palette').innerHTML = top.map(([k]) => {
        const [r, g2, b] = k.split(',').map((x) => (+x) * 17);
        const hex = rgbToHex({ r, g: g2, b });
        return `<div class="center" data-hex="${hex}" style="cursor:pointer"><div style="width:42px;height:42px;border-radius:8px;background:${hex};border:1px solid var(--line)"></div><div class="hint" style="font-size:8px">${hex}</div></div>`;
      }).join('');
      root.querySelectorAll('[data-hex]').forEach((el) => el.addEventListener('click', () => { const c = hexToRgb(el.dataset.hex); setColor(c.r, c.g, c.b); }));
      cv.onclick = (e) => {
        const rect = cv.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / rect.width * cv.width);
        const y = Math.floor((e.clientY - rect.top) / rect.height * cv.height);
        const p = g.getImageData(x, y, 1, 1).data;
        setColor(p[0], p[1], p[2]);
      };
    });
    $('#cp-eye').onclick = async () => {
      if (!window.EyeDropper) return toast('当前浏览器不支持屏幕取色器', 'err');
      try {
        const result = await new window.EyeDropper().open();
        const c = hexToRgb(result.sRGBHex);
        setColor(c.r, c.g, c.b);
        $('#cp-info').textContent = '已从屏幕取色 ' + result.sRGBHex;
      } catch { /* cancelled */ }
    };
    $('#cp-copy').onclick = () => copy($('#cp-hex').textContent);
  },

  /* ================= 调色板 ================= */
  'palette-gen'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="row"><label class="lab" style="margin:0">基色</label><input type="color" id="pg-base" value="#38cdf0">
            <select class="sel" id="pg-scheme" style="max-width:170px"><option value="analogous">邻近色</option><option value="complement">互补色</option><option value="triad">三角配色</option><option value="mono">单色渐变</option><option value="tetrad">四角配色</option></select>
            <button class="btn primary" id="pg-run">生成</button><button class="btn" id="pg-css">复制 CSS</button></div>
        </div>
        <div class="panel"><div id="pg-palette" class="row" style="gap:10px"></div></div>
        <div class="panel"><div class="panel-head"><b>CSS 渐变</b><button class="btn sm" id="pg-copy-grad">复制</button></div><div id="pg-grad" style="height:110px;border-radius:10px;border:1px solid var(--line)"></div><pre class="out" id="pg-grad-css" style="margin-top:9px"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let colors = [];
    const run = () => {
      const base = hexToRgb($('#pg-base').value);
      const hsl = rgbToHsl(base);
      const scheme = $('#pg-scheme').value;
      const offsets = scheme === 'analogous' ? [-40, -20, 0, 20, 40] : scheme === 'complement' ? [0, 180] : scheme === 'triad' ? [0, 120, 240] : scheme === 'tetrad' ? [0, 90, 180, 270] : [0, 15, 30, 45, 60];
      colors = offsets.map((o) => rgbToHex(hslToRgb(hsl.h + o, hsl.s, hsl.l)));
      if (scheme === 'mono') colors = [10, 30, 50, 70, 90].map((l) => rgbToHex(hslToRgb(hsl.h, hsl.s, l)));
      $('#pg-palette').innerHTML = colors.map((c) => `<div style="flex:1;min-width:74px;cursor:pointer" data-color="${c}"><div style="height:90px;border-radius:10px;background:${c};border:1px solid var(--line)"></div><div class="hint mono center" style="font-size:10px">${c}</div></div>`).join('');
      root.querySelectorAll('[data-color]').forEach((el) => el.addEventListener('click', () => copy(el.dataset.color)));
      const grad = `linear-gradient(135deg, ${colors[0]}, ${colors[colors.length - 1]})`;
      $('#pg-grad').style.background = grad;
      $('#pg-grad-css').textContent = `background: ${grad};`;
    };
    $('#pg-run').onclick = run;
    $('#pg-base').addEventListener('input', run);
    $('#pg-scheme').addEventListener('change', run);
    $('#pg-css').onclick = () => copy(colors.map((c, i) => `--color-${i + 1}: ${c};`).join('\n'));
    $('#pg-copy-grad').onclick = () => copy($('#pg-grad-css').textContent);
    run();
  },

  /* ================= 对比度 ================= */
  'contrast-check'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="row"><label class="lab" style="margin:0">文字</label><input type="color" id="ct-fg" value="#e9eefc">
            <label class="lab" style="margin:0">背景</label><input type="color" id="ct-bg" value="#070b14">
            <button class="btn primary" id="ct-run">检测</button>
            <button class="btn" id="ct-swap">交换</button></div>
        </div>
        <div class="panel" id="ct-preview" style="background:#070b14;padding:28px"><div style="color:#e9eefc;font-size:26px;font-weight:700">空天工具合集</div><div style="color:#e9eefc;font-size:14px;opacity:.8;margin-top:6px">The quick brown fox jumps over the lazy dog. 浏览器里的万能工具箱。</div></div>
        <div class="stat-grid" id="ct-out"></div>
        <div class="panel"><div class="panel-head"><b>色盲模拟</b></div><div class="row" id="ct-blind"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const sim = (c, type) => {
      const { r, g, b } = c;
      let m;
      if (type === 'protan') m = [[0.567, 0.433, 0], [0.558, 0.442, 0], [0, 0.242, 0.758]];
      else if (type === 'deutan') m = [[0.625, 0.375, 0], [0.7, 0.3, 0], [0, 0.3, 0.7]];
      else m = [[0.95, 0.05, 0], [0, 0.433, 0.567], [0, 0.475, 0.525]];
      return { r: m[0][0] * r + m[0][1] * g + m[0][2] * b, g: m[1][0] * r + m[1][1] * g + m[1][2] * b, b: m[2][0] * r + m[2][1] * g + m[2][2] * b };
    };
    const run = () => {
      const fg = hexToRgb($('#ct-fg').value), bg = hexToRgb($('#ct-bg').value);
      const ratio = contrast(fg, bg);
      $('#ct-preview').style.background = rgbToHex(bg);
      $('#ct-preview').childNodes[0].style.color = rgbToHex(fg);
      $('#ct-preview').childNodes[1].style.color = rgbToHex(fg);
      $('#ct-out').innerHTML = [
        ['对比度', ratio.toFixed(2) + ':1'], ['WCAG AA 正文', ratio >= 4.5 ? '✓ 通过' : '✗ 不通过'],
        ['WCAG AA 大字', ratio >= 3 ? '✓ 通过' : '✗ 不通过'], ['WCAG AAA 正文', ratio >= 7 ? '✓ 通过' : '✗ 不通过'],
        ['建议', ratio >= 7 ? '优秀' : ratio >= 4.5 ? '可读' : ratio >= 3 ? '仅适合大字' : '不建议']
      ].map(([k, v]) => `<div class="stat"><b style="font-size:15px">${v}</b><span>${k}</span></div>`).join('');
      $('#ct-blind').innerHTML = [['protan', '红色盲'], ['deutan', '绿色盲'], ['tritan', '蓝色盲']].map(([t, name]) => {
        const c = sim(fg, t), bg2 = sim(bg, t);
        return `<div class="center"><div style="width:76px;height:52px;border-radius:8px;background:${rgbToHex(bg2)};display:flex;align-items:center;justify-content:center;color:${rgbToHex(c)};font-weight:700">Aa</div><div class="hint" style="font-size:10px">${name}</div></div>`;
      }).join('');
    };
    $('#ct-run').onclick = run;
    $('#ct-swap').onclick = () => { const a = $('#ct-fg').value; $('#ct-fg').value = $('#ct-bg').value; $('#ct-bg').value = a; run(); };
    $('#ct-fg').addEventListener('input', run);
    $('#ct-bg').addEventListener('input', run);
    run();
  },

  /* ================= CSS 生成 ================= */
  'css-gen'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="tabs" id="cg-tabs"><button class="tab active" data-i="0">阴影</button><button class="tab" data-i="1">圆角边框</button><button class="tab" data-i="2">渐变</button><button class="tab" data-i="3">玻璃拟态</button><button class="tab" data-i="4">按钮</button></div>
          <div class="grid4" id="cg-controls" style="margin-top:11px"></div>
          <button class="btn primary" id="cg-run" style="margin-top:10px">生成 CSS</button>
        </div>
        <div class="panel"><div class="panel-head"><b>预览</b></div><div style="padding:28px;display:flex;justify-content:center;background:rgba(255,255,255,.02);border-radius:10px"><div id="cg-preview" style="width:200px;height:120px;background:#38cdf0;border-radius:12px"></div></div></div>
        <div class="panel"><div class="panel-head"><b>CSS</b><button class="btn sm" id="cg-copy">复制</button></div><pre class="out" id="cg-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let type = 'shadow';
    const layouts = {
      shadow: [['cg-c1', '颜色', '#38cdf0', 'color'], ['cg-c2', 'X', '0', 'number'], ['cg-c3', 'Y', '12', 'number'], ['cg-c4', '模糊', '30', 'number'], ['cg-c5', '扩散', '0', 'number']],
      radius: [['cg-c1', '圆角', '16', 'number'], ['cg-c2', '边框宽度', '1', 'number'], ['cg-c3', '边框色', '#38cdf0', 'color'], ['cg-c4', '背景', '#0e1626', 'color']],
      gradient: [['cg-c1', '起始色', '#22d3ee', 'color'], ['cg-c2', '结束色', '#818cf8', 'color'], ['cg-c3', '角度', '135', 'number']],
      glass: [['cg-c1', '模糊', '18', 'number'], ['cg-c2', '透明度', '0.12', 'number'], ['cg-c3', '边框透明', '0.25', 'number']],
      button: [['cg-c1', '主色', '#22d3ee', 'color'], ['cg-c2', '次色', '#6366f1', 'color'], ['cg-c3', '圆角', '10', 'number']]
    };
    const paint = () => {
      $('#cg-controls').innerHTML = layouts[type].map(([id, label, val, t]) => `<div class="field"><label class="lab">${label}</label><input class="inp" id="${id}" type="${t}" value="${val}" ${t === 'number' ? 'step="any"' : ''}></div>`).join('');
      $('#cg-run').click();
    };
    $('#cg-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      type = ['shadow', 'radius', 'gradient', 'glass', 'button'][Number(b.dataset.i)];
      root.querySelectorAll('#cg-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      paint();
    });
    $('#cg-run').onclick = () => {
      const v = (id) => document.getElementById(id)?.value;
      let css = '';
      if (type === 'shadow') {
        css = `box-shadow: ${v('cg-c2')}px ${v('cg-c3')}px ${v('cg-c4')}px ${v('cg-c5')}px ${v('cg-c1')}66;`;
        $('#cg-preview').style.cssText = `width:200px;height:120px;background:#0e1626;border-radius:14px;border:1px solid rgba(56,205,240,.2);${css}`;
      } else if (type === 'radius') {
        css = `border-radius: ${v('cg-c1')}px;\nborder: ${v('cg-c2')}px solid ${v('cg-c3')};\nbackground: ${v('cg-c4')};`;
        $('#cg-preview').style.cssText = `width:200px;height:120px;${css}`;
      } else if (type === 'gradient') {
        css = `background: linear-gradient(${v('cg-c3')}deg, ${v('cg-c1')}, ${v('cg-c2')});`;
        $('#cg-preview').style.cssText = `width:200px;height:120px;border-radius:12px;${css}`;
      } else if (type === 'glass') {
        css = `background: rgba(255,255,255,${v('cg-c2')});\nbackdrop-filter: blur(${v('cg-c1')}px);\nborder: 1px solid rgba(255,255,255,${v('cg-c3')});\nborder-radius: 14px;`;
        $('#cg-preview').style.cssText = `width:200px;height:120px;${css}`;
      } else {
        css = `background: linear-gradient(135deg, ${v('cg-c1')}, ${v('cg-c2')});\nborder: 0;\nborder-radius: ${v('cg-c3')}px;\ncolor: #fff;\npadding: 10px 22px;\nfont-weight: 600;\ncursor: pointer;`;
        $('#cg-preview').style.cssText = `width:auto;height:auto;${css}`;
        $('#cg-preview').textContent = '按钮';
      }
      $('#cg-out').textContent = css;
    };
    $('#cg-copy').onclick = () => copy($('#cg-out').textContent);
    paint();
  },

  /* ================= 布局生成 ================= */
  'layout-gen'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="grid4">
            <div class="field"><label class="lab">模式</label><select class="sel" id="lg-mode"><option value="grid">Grid</option><option value="flex">Flexbox</option></select></div>
            <div class="field"><label class="lab">列数 / 方向</label><select class="sel" id="lg-cols"><option value="3">3 列</option><option value="2">2 列</option><option value="4">4 列</option><option value="row">横向</option><option value="column">纵向</option></select></div>
            <div class="field"><label class="lab">间距 px</label><input class="inp" id="lg-gap" type="number" value="16"></div>
            <div class="field"><label class="lab">断点 px</label><input class="inp" id="lg-bp" type="number" value="768"></div>
          </div>
          <button class="btn primary" id="lg-run" style="margin-top:10px">生成</button>
        </div>
        <div class="panel"><div class="panel-head"><b>预览</b></div><div id="lg-preview" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">${Array.from({ length: 6 }, (_, i) => `<div style="background:rgba(56,205,240,.18);border:1px solid rgba(56,205,240,.35);border-radius:8px;padding:22px;text-align:center">${i + 1}</div>`).join('')}</div></div>
        <div class="panel"><div class="panel-head"><b>CSS</b><button class="btn sm" id="lg-copy">复制</button></div><pre class="out" id="lg-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const run = () => {
      const mode = $('#lg-mode').value, cols = $('#lg-cols').value, gap = $('#lg-gap').value, bp = $('#lg-bp').value;
      const p = $('#lg-preview');
      let css;
      if (mode === 'grid') {
        const n = ['2', '3', '4'].includes(cols) ? cols : 3;
        p.style.cssText = `display:grid;grid-template-columns:repeat(${n},1fr);gap:${gap}px`;
        css = `.container {\n  display: grid;\n  grid-template-columns: repeat(${n}, minmax(0, 1fr));\n  gap: ${gap}px;\n}\n\n@media (max-width: ${bp}px) {\n  .container {\n    grid-template-columns: 1fr;\n  }\n}`;
      } else {
        const dir = cols === 'column' ? 'column' : 'row';
        p.style.cssText = `display:flex;flex-direction:${dir};gap:${gap}px;flex-wrap:wrap`;
        css = `.container {\n  display: flex;\n  flex-direction: ${dir};\n  flex-wrap: wrap;\n  gap: ${gap}px;\n  align-items: stretch;\n}\n\n.container > * {\n  flex: 1 1 240px;\n}\n\n@media (max-width: ${bp}px) {\n  .container {\n    flex-direction: column;\n  }\n}`;
      }
      $('#lg-out').textContent = css;
    };
    $('#lg-run').onclick = run;
    $('#lg-copy').onclick = () => copy($('#lg-out').textContent);
    run();
  },

  /* ================= 字体 ================= */
  'font-tools'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="grid4">
            <div class="field"><label class="lab">字体</label><select class="sel" id="ft-family"><option value="system-ui">系统默认</option><option value="'PingFang SC','Microsoft YaHei',sans-serif">中文黑体</option><option value="Georgia,serif">Georgia 衬线</option><option value="ui-monospace,Menlo,monospace">等宽字体</option></select></div>
            <div class="field"><label class="lab">字号 px</label><input class="inp" id="ft-size" type="number" value="18"></div>
            <div class="field"><label class="lab">行高</label><input class="inp" id="ft-lh" type="number" step="0.1" value="1.6"></div>
            <div class="field"><label class="lab">字距 em</label><input class="inp" id="ft-ls" type="number" step="0.01" value="0"></div>
          </div>
          <textarea class="ta" id="ft-text" rows="3" style="margin-top:9px">空天工具合集 · 浏览器里的万能工具箱\nThe quick brown fox jumps over the lazy dog.</textarea>
        </div>
        <div class="panel"><div id="ft-preview" style="padding:14px">预览文本</div></div>
        <div class="panel"><div class="panel-head"><b>字号换算表</b></div><div id="ft-scale" class="grid4"></div></div>
        <div class="panel"><div class="panel-head"><b>字体配对建议</b></div><div class="hint">标题：思源黑体 / Inter · 正文：系统黑体 / Source Serif · 代码：JetBrains Mono。中文正文建议 14–16px，行高 1.6–1.8；英文正文 16px，行高 1.5。</div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const run = () => {
      const p = $('#ft-preview');
      p.style.fontFamily = $('#ft-family').value;
      p.style.fontSize = $('#ft-size').value + 'px';
      p.style.lineHeight = $('#ft-lh').value;
      p.style.letterSpacing = $('#ft-ls').value + 'em';
      p.style.whiteSpace = 'pre-wrap';
      p.textContent = $('#ft-text').value;
      $('#ft-scale').innerHTML = [12, 14, 16, 18, 20, 24, 32, 48].map((px) => `<div class="stat"><b>${px}px</b><span>${(px / 16).toFixed(3)} rem · ${(px * 0.75).toFixed(0)} pt</span></div>`).join('');
    };
    ['#ft-family', '#ft-size', '#ft-lh', '#ft-ls', '#ft-text'].forEach((s) => $(s).addEventListener('input', run));
    run();
  },

  /* ================= SVG ================= */
  'svg-tools'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>SVG 工具</b><span class="hint">预览、压缩、颜色替换、转 PNG</span></div>
          <textarea class="ta mono" id="sv-in" rows="7" placeholder="粘贴 SVG 代码…"></textarea>
          <div class="grid3" style="margin-top:9px">
            <div class="field"><label class="lab">查找颜色</label><input class="inp" id="sv-from" value="#38cdf0"></div>
            <div class="field"><label class="lab">替换为</label><input class="inp" id="sv-to" value="#818cf8"></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn" id="sv-replace" style="width:100%">替换颜色</button></div>
          </div>
          <div class="row" style="margin-top:9px"><button class="btn primary" id="sv-preview">预览</button><button class="btn" id="sv-min">压缩</button><button class="btn" id="sv-png">转 PNG</button><button class="btn" id="sv-copy">复制</button></div>
        </div>
        <div class="panel"><div class="canvas-wrap" id="sv-out"><div class="hint">预览区域</div></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const clean = (code) => code.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+="[^"]*"/gi, '').replace(/javascript:/gi, '');
    const paint = () => {
      try {
        const code = clean($('#sv-in').value);
        if (!code.trim()) return;
        const doc = new DOMParser().parseFromString(code, 'image/svg+xml');
        if (doc.querySelector('parsererror')) throw new Error('SVG 解析失败');
        $('#sv-out').innerHTML = code;
      } catch (e) { $('#sv-out').innerHTML = `<div class="errbox">${esc(e.message)}</div>`; }
    };
    $('#sv-preview').onclick = paint;
    $('#sv-min').onclick = () => { $('#sv-in').value = $('#sv-in').value.replace(/<!--[\s\S]*?-->/g, '').replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ').trim(); paint(); };
    $('#sv-replace').onclick = () => {
      const from = $('#sv-from').value.trim(), to = $('#sv-to').value.trim();
      $('#sv-in').value = $('#sv-in').value.split(from).join(to);
      paint();
    };
    $('#sv-png').onclick = () => {
      try {
        const code = clean($('#sv-in').value);
        const blob = new Blob([code], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          const cv = document.createElement('canvas');
          cv.width = img.width || 512; cv.height = img.height || 512;
          cv.getContext('2d').drawImage(img, 0, 0);
          cv.toBlob((b) => download('svg.png', b));
          URL.revokeObjectURL(url);
        };
        img.src = url;
      } catch (e) { toast(e.message, 'err'); }
    };
    $('#sv-copy').onclick = () => copy($('#sv-in').value);
    $('#sv-in').value = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="32" fill="#0e1626"/><circle cx="80" cy="80" r="34" fill="none" stroke="#38cdf0" stroke-width="6"/><ellipse cx="80" cy="80" rx="62" ry="24" fill="none" stroke="#818cf8" stroke-width="4" transform="rotate(-25 80 80)"/></svg>`;
    paint();
  },

  /* ================= 图标生成 ================= */
  'favicon-gen'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="grid4">
            <div class="field"><label class="lab">文字</label><input class="inp" id="fg-text" value="空" maxlength="2"></div>
            <div class="field"><label class="lab">背景</label><input type="color" id="fg-bg" value="#070b14"></div>
            <div class="field"><label class="lab">前景</label><input type="color" id="fg-fg" value="#38cdf0"></div>
            <div class="field"><label class="lab">形状</label><select class="sel" id="fg-shape"><option value="circle">圆形</option><option value="rounded">圆角方形</option><option value="square">方形</option></select></div>
          </div>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="fg-run">更新</button><button class="btn" id="fg-dl512">下载 512 PNG</button><button class="btn" id="fg-dl-all">下载常用尺寸</button></div>
        </div>
        <div class="panel center"><div id="fg-preview" style="display:inline-block"></div></div>
        <div class="panel"><div class="panel-head"><b>引入代码</b></div><pre class="out" id="fg-code"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const draw = (size) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = size;
      const g = cv.getContext('2d');
      const bg = $('#fg-bg').value, fg = $('#fg-fg').value, text = $('#fg-text').value || 'K';
      g.fillStyle = bg;
      const shape = $('#fg-shape').value;
      const r = size * 0.22;
      if (shape === 'circle') { g.beginPath(); g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); g.fill(); }
      else if (shape === 'rounded') { g.beginPath(); g.roundRect(0, 0, size, size, r); g.fill(); }
      else g.fillRect(0, 0, size, size);
      g.fillStyle = fg;
      g.font = `700 ${size * (text.length > 1 ? 0.42 : 0.52)}px -apple-system, "PingFang SC", sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, size / 2, size * 0.54);
      return cv;
    };
    const update = () => {
      const cv = draw(256);
      $('#fg-preview').innerHTML = '';
      cv.style.width = '128px'; cv.style.height = '128px'; cv.style.borderRadius = '14px'; cv.style.border = '1px solid var(--line)';
      $('#fg-preview').appendChild(cv);
      $('#fg-preview').innerHTML += `<div class="hint" style="margin-top:6px">256 × 256 预览</div>`;
      $('#fg-code').textContent = `<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">\n<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">\n<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">`;
    };
    const save = (size, name) => draw(size).toBlob((b) => download(name, b));
    $('#fg-run').onclick = update;
    $('#fg-dl512').onclick = () => save(512, 'icon-512.png');
    $('#fg-dl-all').onclick = () => { [16, 32, 180, 192, 512].forEach((s, i) => setTimeout(() => save(s, s === 180 ? 'apple-touch-icon.png' : `icon-${s}.png`), i * 120)); };
    ['#fg-text', '#fg-bg', '#fg-fg', '#fg-shape'].forEach((s) => $(s).addEventListener('input', update));
    $('#fg-shape').addEventListener('change', update);
    update();
  },

  /* ================= CSS 背景与动画 ================= */
  'css-effects'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="tabs" id="ce-tabs"><button class="tab active" data-i="0">背景图案</button><button class="tab" data-i="1">渐变文字</button><button class="tab" data-i="2">缓动预览</button></div>
          <div id="ce-p0">
            <div class="grid3" style="margin-top:10px">
              <div class="field"><label class="lab">图案</label><select class="sel" id="ce-pattern"><option value="grid">网格</option><option value="dots">圆点</option><option value="stripes">条纹</option><option value="noise">噪点</option></select></div>
              <div class="field"><label class="lab">尺寸 px</label><input class="inp" id="ce-size" type="number" value="24"></div>
              <div class="field"><label class="lab">颜色</label><input type="color" id="ce-color" value="#38cdf0"></div>
            </div>
            <button class="btn primary" id="ce-run" style="margin-top:9px">生成</button>
          </div>
          <div id="ce-p1" class="hidden">
            <div class="grid3" style="margin-top:10px">
              <div class="field"><label class="lab">起始色</label><input type="color" id="ce-g1" value="#22d3ee"></div>
              <div class="field"><label class="lab">结束色</label><input type="color" id="ce-g2" value="#c084fc"></div>
              <div class="field"><label class="lab">文字</label><input class="inp" id="ce-text" value="空天工具合集"></div>
            </div>
            <button class="btn primary" id="ce-textrun" style="margin-top:9px">生成</button>
          </div>
          <div id="ce-p2" class="hidden">
            <div class="row" style="margin-top:10px"><select class="sel" id="ce-ease" style="max-width:200px"><option value="ease">ease</option><option value="linear">linear</option><option value="ease-in-out">ease-in-out</option><option value="cubic-bezier(.68,-.55,.27,1.55)">回弹</option><option value="cubic-bezier(.22,1,.36,1)">平滑减速</option></select><button class="btn primary" id="ce-anim">播放</button></div>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>预览</b></div><div id="ce-preview" style="height:180px;border-radius:10px;border:1px solid var(--line);display:flex;align-items:center;justify-content:center"></div></div>
        <div class="panel"><div class="panel-head"><b>CSS</b><button class="btn sm" id="ce-copy">复制</button></div><pre class="out" id="ce-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let mode = 0;
    $('#ce-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      mode = Number(b.dataset.i);
      root.querySelectorAll('#ce-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      [0, 1, 2].forEach((i) => $('#ce-p' + i).classList.toggle('hidden', i !== mode));
    });
    $('#ce-run').onclick = () => {
      const p = $('#ce-pattern').value, size = $('#ce-size').value, c = $('#ce-color').value;
      let css, bg;
      if (p === 'grid') { bg = `linear-gradient(${c}33 1px, transparent 1px), linear-gradient(90deg, ${c}33 1px, transparent 1px)`; css = `background-image: ${bg};\nbackground-size: ${size}px ${size}px;`; }
      else if (p === 'dots') { css = `background-image: radial-gradient(${c}55 1.5px, transparent 1.5px);\nbackground-size: ${size}px ${size}px;`; }
      else if (p === 'stripes') { css = `background: repeating-linear-gradient(45deg, ${c}22 0 10px, transparent 10px 20px);`; }
      else { css = `background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='.25'/%3E%3C/svg%3E");`; }
      $('#ce-preview').style.cssText = `height:180px;border-radius:10px;border:1px solid var(--line);${css}`;
      $('#ce-out').textContent = css;
    };
    $('#ce-textrun').onclick = () => {
      const g = `linear-gradient(120deg, ${$('#ce-g1').value}, ${$('#ce-g2').value})`;
      const css = `background: ${g};\n-webkit-background-clip: text;\nbackground-clip: text;\ncolor: transparent;`;
      $('#ce-preview').style.cssText = `height:180px;border-radius:10px;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:800;${css}`;
      $('#ce-preview').textContent = $('#ce-text').value;
      $('#ce-out').textContent = css;
    };
    $('#ce-anim').onclick = () => {
      const ease = $('#ce-ease').value;
      $('#ce-preview').innerHTML = '<div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#22d3ee,#818cf8)"></div>';
      const box = $('#ce-preview').firstChild;
      $('#ce-preview').style.cssText = 'height:180px;border-radius:10px;border:1px solid var(--line);display:flex;align-items:center;padding:0 20px';
      box.style.transition = `transform 1.2s ${ease}`;
      box.style.transform = 'translateX(0)';
      requestAnimationFrame(() => { requestAnimationFrame(() => { box.style.transform = 'translateX(calc(100vw - 220px))'; }); });
      $('#ce-out').textContent = `transition: transform 1.2s ${ease};`;
    };
    $('#ce-copy').onclick = () => copy($('#ce-out').textContent);
    $('#ce-run').click();
  },

  /* ================= 设计变量 ================= */
  'design-token'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="row"><label class="lab" style="margin:0">主色</label><input type="color" id="dt-base" value="#38cdf0">
            <label class="lab" style="margin:0">圆角</label><input class="inp" id="dt-radius" type="number" value="12" style="max-width:80px">
            <button class="btn primary" id="dt-run">生成</button><button class="btn" id="dt-copy">复制 CSS</button><button class="btn" id="dt-tw">复制 Tailwind</button></div>
        </div>
        <div class="panel"><div class="panel-head"><b>色阶</b></div><div class="row" id="dt-scale" style="gap:6px"></div></div>
        <div class="panel"><div class="panel-head"><b>CSS 变量</b></div><pre class="out" id="dt-out"></pre></div>
        <div class="panel"><div class="panel-head"><b>Tailwind 配置</b></div><pre class="out" id="dt-tw-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const run = () => {
      const base = $('#dt-base').value;
      const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
      $('#dt-scale').innerHTML = steps.map((s) => `<div class="center" style="flex:1"><div style="height:42px;border-radius:6px;background:${shade(base, s < 500 ? (500 - s) / 700 : -(s - 500) / 700 * 0.55)};border:1px solid var(--line)"></div><div class="hint" style="font-size:9px">${s}</div></div>`).join('');
      const radius = $('#dt-radius').value;
      const css = `:root {\n  --color-primary-50: ${shade(base, 0.85)};\n  --color-primary-100: ${shade(base, 0.7)};\n  --color-primary-300: ${shade(base, 0.35)};\n  --color-primary-500: ${base};\n  --color-primary-700: ${shade(base, -0.3)};\n  --color-primary-900: ${shade(base, -0.55)};\n\n  --radius-sm: ${Math.max(2, radius - 6)}px;\n  --radius-md: ${radius}px;\n  --radius-lg: ${Number(radius) + 8}px;\n\n  --space-1: 4px;\n  --space-2: 8px;\n  --space-3: 12px;\n  --space-4: 16px;\n  --space-6: 24px;\n  --space-8: 32px;\n}`;
      $('#dt-out').textContent = css;
      $('#dt-tw-out').textContent = `module.exports = {\n  theme: {\n    extend: {\n      colors: {\n        primary: {\n          50: '${shade(base, 0.85)}',\n          100: '${shade(base, 0.7)}',\n          300: '${shade(base, 0.35)}',\n          500: '${base}',\n          700: '${shade(base, -0.3)}',\n          900: '${shade(base, -0.55)}'\n        }\n      },\n      borderRadius: { md: '${radius}px' }\n    }\n  }\n}`;
    };
    $('#dt-run').onclick = run;
    $('#dt-base').addEventListener('input', run);
    $('#dt-copy').onclick = () => copy($('#dt-out').textContent);
    $('#dt-tw').onclick = () => copy($('#dt-tw-out').textContent);
    run();
  },

  /* ================= 海报与名片 ================= */
  'poster-gen'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="grid4">
            <div class="field"><label class="lab">类型</label><select class="sel" id="ps-type"><option value="poster">海报 1080×1440</option><option value="social">社交封面 1200×630</option><option value="card">名片 1000×600</option></select></div>
            <div class="field"><label class="lab">主色</label><input type="color" id="ps-c1" value="#22d3ee"></div>
            <div class="field"><label class="lab">背景</label><input type="color" id="ps-bg" value="#070b14"></div>
            <div class="field"><label class="lab">强调色</label><input type="color" id="ps-c2" value="#818cf8"></div>
          </div>
          <div class="grid2" style="margin-top:9px">
            <div class="field"><label class="lab">标题</label><input class="inp" id="ps-title" value="空天工具合集"></div>
            <div class="field"><label class="lab">副标题</label><input class="inp" id="ps-sub" value="浏览器里的万能工具箱"></div>
            <div class="field"><label class="lab">说明</label><input class="inp" id="ps-desc" value="纯前端 · 文件不上传 · 手机电脑一致"></div>
            <div class="field"><label class="lab">落款</label><input class="inp" id="ps-foot" value="KONGTIAN TOOLBOX"></div>
          </div>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="ps-run">生成</button><button class="btn" id="ps-dl">下载 PNG</button></div>
        </div>
        <div class="panel"><div class="canvas-wrap"><canvas id="ps-canvas" width="1080" height="1440" style="max-height:620px"></canvas></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const run = () => {
      const type = $('#ps-type').value;
      const cv = $('#ps-canvas');
      const W = type === 'poster' ? 1080 : type === 'social' ? 1200 : 1000;
      const H = type === 'poster' ? 1440 : type === 'social' ? 630 : 600;
      cv.width = W; cv.height = H;
      const g = cv.getContext('2d');
      const c1 = $('#ps-c1').value, c2 = $('#ps-c2').value, bg = $('#ps-bg').value;
      const grad = g.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, bg); grad.addColorStop(0.55, shade(bg, 0.08)); grad.addColorStop(1, shade(c1, -0.72));
      g.fillStyle = grad; g.fillRect(0, 0, W, H);
      g.strokeStyle = c1 + '44'; g.lineWidth = 2;
      const cx = W / 2, cy = H * 0.36, R = Math.min(W, H) * 0.26;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.ellipse(cx, cy, R + i * 26, (R + i * 26) * 0.38, (-25 + i * 22) * Math.PI / 180, 0, Math.PI * 2);
        g.strokeStyle = i % 2 ? c2 + '55' : c1 + '66';
        g.stroke();
      }
      g.beginPath(); g.arc(cx, cy, R * 0.32, 0, Math.PI * 2);
      const core = g.createLinearGradient(cx - R / 2, cy - R / 2, cx + R / 2, cy + R / 2);
      core.addColorStop(0, c1); core.addColorStop(1, c2);
      g.fillStyle = core; g.fill();
      g.fillStyle = '#e9eefc'; g.textAlign = 'center';
      g.font = `800 ${type === 'poster' ? 86 : 64}px -apple-system, "PingFang SC", sans-serif`;
      g.fillText($('#ps-title').value, W / 2, H * 0.72);
      g.fillStyle = c1;
      g.font = `600 ${type === 'poster' ? 34 : 28}px -apple-system, "PingFang SC", sans-serif`;
      g.fillText($('#ps-sub').value, W / 2, H * 0.79);
      g.fillStyle = '#8b9bb8';
      g.font = `400 ${type === 'poster' ? 26 : 20}px -apple-system, "PingFang SC", sans-serif`;
      g.fillText($('#ps-desc').value, W / 2, H * 0.85);
      g.font = `600 ${type === 'poster' ? 20 : 16}px -apple-system, sans-serif`;
      g.fillStyle = '#5f6f8c';
      g.fillText($('#ps-foot').value, W / 2, H * 0.93);
      g.strokeStyle = c1 + '66'; g.lineWidth = 1;
      g.strokeRect(30, 30, W - 60, H - 60);
    };
    $('#ps-run').onclick = run;
    $('#ps-dl').onclick = () => $('#ps-canvas').toBlob((b) => download('poster.png', b));
    ['#ps-c1', '#ps-c2', '#ps-bg', '#ps-title', '#ps-sub', '#ps-desc', '#ps-foot'].forEach((s) => $(s).addEventListener('input', run));
    $('#ps-type').addEventListener('change', run);
    run();
  }
};
