/* 趣味、艺术与生成 */
import { esc, copy, toast, download, fmtBytes } from '../core/ui.js';
import { bindFileZone, fileZone, loadImage } from '../core/kit.js';
import { randInt } from '../core/rand.js';

const $ = (root, s) => root.querySelector(s);

export default {
  /* ================= ASCII 艺术 ================= */
  'ascii-art'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="grid3">
            <div class="field"><label class="lab">文字</label><input class="inp" id="aa-text" value="KONGTIAN"></div>
            <div class="field"><label class="lab">宽度（字符）</label><input class="inp" id="aa-width" type="number" value="100"></div>
            <div class="field"><label class="lab">字符集</label><select class="sel" id="aa-chars"><option value="# "># / 空格</option><option value="@%#*+=-:. ">灰度渐变</option><option value="█▓▒░ ">方块渐变</option></select></div>
          </div>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="aa-run">生成</button><button class="btn" id="aa-copy">复制</button><button class="btn" id="aa-dl">下载 TXT</button></div>
        </div>
        <div class="panel"><pre class="out" id="aa-out" style="white-space:pre;font-family:monospace;line-height:1.05;font-size:10px;overflow:auto;max-height:520px">输入文字后生成</pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const run = () => {
      const text = $('#aa-text').value || 'K';
      const W = Math.max(30, Math.min(180, Number($('#aa-width').value) || 100));
      const cv = document.createElement('canvas');
      cv.width = 1200; cv.height = 300;
      const g = cv.getContext('2d');
      g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
      g.fillStyle = '#fff';
      g.font = '900 180px -apple-system, "PingFang SC", sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, cv.width / 2, cv.height / 2, 1120);
      const ratio = cv.height / cv.width;
      const cols = W;
      const rows = Math.max(6, Math.round(cols * ratio * 0.5));
      const sample = document.createElement('canvas');
      sample.width = cols; sample.height = rows;
      const sg = sample.getContext('2d');
      sg.drawImage(cv, 0, 0, cols, rows);
      const data = sg.getImageData(0, 0, cols, rows).data;
      const chars = $('#aa-chars').value;
      let out = '';
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4;
          const lum = data[i] / 255;
          out += chars[Math.min(chars.length - 1, Math.floor((1 - lum) * chars.length))];
        }
        out += '\n';
      }
      $('#aa-out').textContent = out;
    };
    $('#aa-run').onclick = run;
    $('#aa-copy').onclick = () => copy($('#aa-out').textContent);
    $('#aa-dl').onclick = () => download('ascii-art.txt', $('#aa-out').textContent, 'text/plain');
    run();
  },

  /* ================= 像素画板 ================= */
  'pixel-editor'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="row">
            <input type="color" id="pe-color" value="#38cdf0">
            ${['#38cdf0', '#818cf8', '#34d399', '#fbbf24', '#fb7185', '#ffffff', '#0e1626'].map((c) => `<button class="btn sm" data-color="${c}" style="background:${c};border-color:transparent;width:28px;height:28px;padding:0"></button>`).join('')}
            <select class="sel" id="pe-size" style="max-width:110px"><option value="16">16 × 16</option><option value="24" selected>24 × 24</option><option value="32">32 × 32</option></select>
            <button class="btn" id="pe-eraser">橡皮</button><button class="btn" id="pe-clear">清空</button><button class="btn primary" id="pe-dl">下载 PNG</button>
          </div>
          <div class="canvas-wrap" style="margin-top:10px;display:inline-block"><canvas id="pe-canvas" width="480" height="480" style="background:#fff;touch-action:none;cursor:crosshair"></canvas></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const cv = $('#pe-canvas'), g = cv.getContext('2d');
    let size = 24, color = '#38cdf0', eraser = false, drawing = false, pixels = [];
    const reset = () => {
      size = Number($('#pe-size').value);
      pixels = Array.from({ length: size * size }, () => null);
      paint();
    };
    const paint = () => {
      const cell = cv.width / size;
      g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const c = pixels[y * size + x];
        if (c) { g.fillStyle = c; g.fillRect(x * cell, y * cell, cell, cell); }
      }
      g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 1;
      for (let i = 0; i <= size; i++) {
        g.beginPath(); g.moveTo(i * cell, 0); g.lineTo(i * cell, cv.height); g.stroke();
        g.beginPath(); g.moveTo(0, i * cell); g.lineTo(cv.width, i * cell); g.stroke();
      }
    };
    const draw = (e) => {
      const r = cv.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      const x = Math.floor((t.clientX - r.left) / r.width * size);
      const y = Math.floor((t.clientY - r.top) / r.height * size);
      if (x < 0 || y < 0 || x >= size || y >= size) return;
      pixels[y * size + x] = eraser ? null : color;
      paint();
    };
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); drawing = true; draw(e); });
    cv.addEventListener('pointermove', (e) => { if (drawing) draw(e); });
    window.addEventListener('pointerup', () => { drawing = false; });
    root.querySelectorAll('[data-color]').forEach((b) => b.addEventListener('click', () => { color = b.dataset.color; $('#pe-color').value = color; eraser = false; }));
    $('#pe-color').addEventListener('input', () => { color = $('#pe-color').value; eraser = false; });
    $('#pe-eraser').onclick = () => { eraser = !eraser; $('#pe-eraser').classList.toggle('primary', eraser); };
    $('#pe-clear').onclick = reset;
    $('#pe-size').addEventListener('change', reset);
    $('#pe-dl').onclick = () => {
      const out = document.createElement('canvas');
      out.width = out.height = 512;
      const og = out.getContext('2d');
      const cell = 512 / size;
      og.fillStyle = '#fff'; og.fillRect(0, 0, 512, 512);
      pixels.forEach((c, i) => { if (!c) return; og.fillStyle = c; og.fillRect((i % size) * cell, Math.floor(i / size) * cell, cell, cell); });
      out.toBlob((b) => download('pixel-art.png', b));
    };
    reset();
  },

  /* ================= 曼陀罗 / 分形 / 迷宫 ================= */
  'mandala-gen'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="tabs" id="mg-tabs"><button class="tab active" data-i="0">曼陀罗</button><button class="tab" data-i="1">分形树</button><button class="tab" data-i="2">迷宫</button></div>
          <div class="row" style="margin-top:10px"><label class="lab" style="margin:0">对称数</label><input class="inp" id="mg-sym" type="number" value="8" min="3" max="24" style="max-width:80px">
            <label class="lab" style="margin:0">复杂度</label><input class="inp" id="mg-comp" type="number" value="6" min="2" max="12" style="max-width:80px">
            <button class="btn primary" id="mg-run">重新生成</button><button class="btn" id="mg-dl">下载 PNG</button></div>
        </div>
        <div class="panel center"><div class="canvas-wrap" style="display:inline-block"><canvas id="mg-canvas" width="640" height="640" style="max-width:100%;background:#070b14"></canvas></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const cv = $('#mg-canvas'), g = cv.getContext('2d');
    let mode = 0;
    $('#mg-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      mode = Number(b.dataset.i);
      root.querySelectorAll('#mg-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      run();
    });
    const mandala = () => {
      g.fillStyle = '#070b14'; g.fillRect(0, 0, 640, 640);
      const sym = Math.max(3, Math.min(24, Number($('#mg-sym').value) || 8));
      const comp = Math.max(2, Math.min(12, Number($('#mg-comp').value) || 6));
      const cx = 320, cy = 320;
      const colors = ['#38cdf0', '#818cf8', '#34d399', '#fbbf24', '#f472b6', '#c084fc'];
      g.translate(cx, cy);
      for (let s = 0; s < sym; s++) {
        g.save(); g.rotate(s * Math.PI * 2 / sym);
        for (let i = 0; i < comp; i++) {
          const r = 40 + i * (250 / comp) + randInt(30);
          g.strokeStyle = colors[i % colors.length] + '88';
          g.lineWidth = 1 + Math.random() * 2;
          g.beginPath();
          g.ellipse(0, -r / 2, 8 + randInt(26), r / 2, Math.random() * 0.6, 0, Math.PI * 2);
          g.stroke();
          if (Math.random() > 0.5) {
            g.fillStyle = colors[(i + 2) % colors.length] + '22';
            g.beginPath(); g.arc(0, -r, 3 + randInt(5), 0, Math.PI * 2); g.fill();
          }
        }
        g.restore();
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
    };
    const tree = () => {
      g.fillStyle = '#070b14'; g.fillRect(0, 0, 640, 640);
      g.strokeStyle = '#38cdf0'; g.lineCap = 'round';
      const branch = (x, y, len, angle, depth) => {
        if (depth <= 0 || len < 4) return;
        const x2 = x + Math.cos(angle) * len, y2 = y + Math.sin(angle) * len;
        g.lineWidth = depth * 0.8;
        g.strokeStyle = depth > 5 ? '#34d399' : depth > 3 ? '#38cdf0' : '#818cf8';
        g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
        branch(x2, y2, len * 0.72, angle - 0.4 - Math.random() * 0.25, depth - 1);
        branch(x2, y2, len * 0.72, angle + 0.4 + Math.random() * 0.25, depth - 1);
      };
      g.save(); g.translate(320, 600); g.rotate(-Math.PI / 2);
      branch(0, 0, 170, 0, 9);
      g.restore();
    };
    const maze = () => {
      g.fillStyle = '#070b14'; g.fillRect(0, 0, 640, 640);
      const N = 16, cell = 600 / N, ox = 20, oy = 20;
      const grid = Array.from({ length: N * N }, () => ({ walls: [1, 1, 1, 1], visited: false }));
      const stack = [0]; grid[0].visited = true;
      const dirs = [[-1, 0, 0, 2], [1, 0, 2, 0], [0, -1, 3, 1], [0, 1, 1, 3]];
      while (stack.length) {
        const cur = stack[stack.length - 1];
        const r = Math.floor(cur / N), c = cur % N;
        const opts = dirs.filter(([dr, dc]) => {
          const nr = r + dr, nc = c + dc;
          return nr >= 0 && nr < N && nc >= 0 && nc < N && !grid[nr * N + nc].visited;
        });
        if (!opts.length) { stack.pop(); continue; }
        const [dr, dc, w1, w2] = opts[randInt(opts.length)];
        const nr = r + dr, nc = c + dc, ni = nr * N + nc;
        grid[cur].walls[w1] = 0; grid[ni].walls[w2] = 0;
        grid[ni].visited = true; stack.push(ni);
      }
      g.strokeStyle = '#38cdf0'; g.lineWidth = 2;
      grid.forEach((c, i) => {
        const r = Math.floor(i / N), cc = i % N;
        const x = ox + cc * cell, y = oy + r * cell;
        if (c.walls[0]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + cell, y); g.stroke(); }
        if (c.walls[1]) { g.beginPath(); g.moveTo(x + cell, y); g.lineTo(x + cell, y + cell); g.stroke(); }
        if (c.walls[2]) { g.beginPath(); g.moveTo(x + cell, y + cell); g.lineTo(x, y + cell); g.stroke(); }
        if (c.walls[3]) { g.beginPath(); g.moveTo(x, y + cell); g.lineTo(x, y); g.stroke(); }
      });
      g.fillStyle = '#34d399'; g.fillRect(ox, oy - 3, cell, 6);
      g.fillStyle = '#fb7185'; g.fillRect(ox + (N - 1) * cell, oy + (N - 1) * cell + cell - 3, cell, 6);
    };
    const run = () => { g.setTransform(1, 0, 0, 1, 0, 0); if (mode === 0) mandala(); else if (mode === 1) tree(); else maze(); };
    $('#mg-run').onclick = run;
    $('#mg-dl').onclick = () => cv.toBlob((b) => download('art.png', b));
    run();
  },

  /* ================= 表情包 ================= */
  'meme-gen'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          ${fileZone('mm-zone', { accept: 'image/*', label: '选择底图' })}
          <div class="grid2" style="margin-top:10px">
            <div class="field"><label class="lab">上方文字</label><input class="inp" id="mm-top" value="当工具全部纯前端"></div>
            <div class="field"><label class="lab">下方文字</label><input class="inp" id="mm-bottom" value="文件一个都不上传"></div>
          </div>
          <div class="row" style="margin-top:9px"><label class="lab" style="margin:0">字号</label><input class="inp" id="mm-size" type="number" value="48" style="max-width:80px"><input type="color" id="mm-color" value="#ffffff"><input type="color" id="mm-stroke" value="#000000"><button class="btn primary" id="mm-dl">下载 PNG</button></div>
        </div>
        <div class="panel"><div class="canvas-wrap"><canvas id="mm-canvas" width="800" height="600" style="background:#eee"></canvas></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let img = null;
    const draw = () => {
      const cv = $('#mm-canvas'), g = cv.getContext('2d');
      if (!img) { g.fillStyle = '#eee'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#666'; g.font = '24px sans-serif'; g.textAlign = 'center'; g.fillText('选择底图后生成表情包', cv.width / 2, cv.height / 2); return; }
      const scale = Math.max(cv.width / img.width, cv.height / img.height);
      const w = img.width * scale, h = img.height * scale;
      g.drawImage(img, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
      const size = Number($('#mm-size').value) || 48;
      g.font = `900 ${size}px Impact, "Arial Black", -apple-system, "PingFang SC", sans-serif`;
      g.textAlign = 'center';
      g.lineWidth = Math.max(3, size / 12);
      g.strokeStyle = $('#mm-stroke').value;
      g.fillStyle = $('#mm-color').value;
      const lines = (text, y, fromTop) => {
        const words = [...text];
        const perLine = Math.floor((cv.width - 40) / (size * 0.9));
        const ls = [];
        for (let i = 0; i < words.length; i += perLine) ls.push(words.slice(i, i + perLine).join(''));
        ls.forEach((line, i) => {
          const yy = fromTop ? y + i * size * 1.1 : y - (ls.length - 1 - i) * size * 1.1;
          g.strokeText(line, cv.width / 2, yy, cv.width - 30);
          g.fillText(line, cv.width / 2, yy, cv.width - 30);
        });
      };
      if ($('#mm-top').value) lines($('#mm-top').value, size + 16, true);
      if ($('#mm-bottom').value) lines($('#mm-bottom').value, cv.height - 24, false);
    };
    bindFileZone(root, 'mm-zone', async (fs) => { img = await loadImage(URL.createObjectURL(fs[0])); draw(); });
    ['#mm-top', '#mm-bottom', '#mm-size', '#mm-color', '#mm-stroke'].forEach((s) => $(s).addEventListener('input', draw));
    $('#mm-dl').onclick = () => $('#mm-canvas').toBlob((b) => download('meme.png', b));
    draw();
  },

  /* ================= 壁纸 ================= */
  'wallpaper-gen'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="grid4">
            <div class="field"><label class="lab">风格</label><select class="sel" id="wg-style"><option value="gradient">渐变</option><option value="stars">星空</option><option value="geo">几何</option><option value="wave">波纹</option></select></div>
            <div class="field"><label class="lab">尺寸</label><select class="sel" id="wg-size"><option value="1080x1920">手机 1080×1920</option><option value="1920x1080">桌面 1920×1080</option><option value="1440x2560">手机 2K</option></select></div>
            <div class="field"><label class="lab">主色</label><input type="color" id="wg-c1" value="#0ea5e9"></div>
            <div class="field"><label class="lab">辅色</label><input type="color" id="wg-c2" value="#7c3aed"></div>
          </div>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="wg-run">生成</button><button class="btn" id="wg-dl">下载 PNG</button></div>
        </div>
        <div class="panel"><div class="canvas-wrap"><canvas id="wg-canvas" width="1080" height="1920" style="max-height:620px"></canvas></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const run = () => {
      const [w, h] = $('#wg-size').value.split('x').map(Number);
      const cv = $('#wg-canvas'); cv.width = w; cv.height = h;
      const g = cv.getContext('2d');
      const c1 = $('#wg-c1').value, c2 = $('#wg-c2').value;
      const style = $('#wg-style').value;
      const grad = g.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, c1); grad.addColorStop(1, c2);
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      if (style === 'stars') {
        for (let i = 0; i < 500; i++) {
          g.fillStyle = `rgba(255,255,255,${0.1 + Math.random() * 0.8})`;
          const r = Math.random() * 2.2;
          g.beginPath(); g.arc(Math.random() * w, Math.random() * h, r, 0, Math.PI * 2); g.fill();
        }
      } else if (style === 'geo') {
        g.globalAlpha = 0.18;
        for (let i = 0; i < 18; i++) {
          g.fillStyle = i % 2 ? '#fff' : '#000';
          g.beginPath();
          const x = Math.random() * w, y = Math.random() * h;
          g.moveTo(x, y); g.lineTo(x + 100 + Math.random() * 300, y + 50); g.lineTo(x + 60, y + 200 + Math.random() * 200);
          g.closePath(); g.fill();
        }
        g.globalAlpha = 1;
      } else if (style === 'wave') {
        g.globalAlpha = 0.22;
        for (let i = 0; i < 12; i++) {
          g.strokeStyle = i % 2 ? c1 : '#fff'; g.lineWidth = 2 + Math.random() * 4;
          g.beginPath();
          for (let x = 0; x <= w; x += 8) {
            const y = h * 0.5 + Math.sin(x / w * Math.PI * (2 + i * 0.3) + i) * h * 0.16 + (i - 6) * h * 0.06;
            x ? g.lineTo(x, y) : g.moveTo(x, y);
          }
          g.stroke();
        }
        g.globalAlpha = 1;
      }
      g.fillStyle = 'rgba(255,255,255,.85)';
      g.font = `800 ${Math.round(w * 0.07)}px -apple-system, "PingFang SC", sans-serif`;
      g.textAlign = 'center';
      g.fillText('空天工具合集', w / 2, h * 0.86);
      g.font = `400 ${Math.round(w * 0.028)}px -apple-system, sans-serif`;
      g.fillStyle = 'rgba(255,255,255,.6)';
      g.fillText('KONGTIAN TOOLBOX', w / 2, h * 0.9);
    };
    $('#wg-run').onclick = run;
    $('#wg-dl').onclick = () => $('#wg-canvas').toBlob((b) => download('wallpaper.png', b));
    ['#wg-style', '#wg-size', '#wg-c1', '#wg-c2'].forEach((s) => $(s).addEventListener('change', run));
    run();
  }
};
