/* 游戏开发、精灵图、谜题、随机与生成艺术 */
import { esc, copy, toast, download } from '../core/ui.js';
import { bindFileZone, fileZone, loadImage } from '../core/kit.js';
import { calcWorkbench } from '../core/workbench.js';

const $ = (root, s) => root.querySelector(s);

function seeded(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = s * 16807 % 2147483647) / 2147483647;
}

export default {
  /* ================= 游戏数值 ================= */
  'game-dev'(root) {
    calcWorkbench(root, {
      title: '游戏数值设计',
      groups: [
        { name: '伤害公式', fields: [['atk', '攻击力', 100], ['def', '防御力', 40], ['mul', '技能倍率', 1.5], ['crit', '暴击率 %', 20], ['critDmg', '暴击伤害 %', 150]], run: (v) => { const base = v.atk * v.mul * (1 - v.def / (v.def + 100)); const avg = base * (1 + v.crit / 100 * (v.critDmg / 100 - 1)); return `非暴击伤害：${base.toFixed(1)}\n平均伤害：${avg.toFixed(1)}\n减伤率：${(v.def / (v.def + 100) * 100).toFixed(1)}%`; } },
        { name: '掉落率', fields: [['rate', '单次概率 %', 5], ['times', '次数', 20]], run: (v) => { const p = v.rate / 100; const atLeast = 1 - (1 - p) ** v.times; return `至少掉落一次：${(atLeast * 100).toFixed(2)}%\n期望掉落：${(p * v.times).toFixed(2)} 个\n${(1 / p).toFixed(1)} 次平均掉落 1 个`; } },
        { name: '经验曲线', fields: [['base', '基础经验', 100], ['growth', '成长系数', 1.15], ['level', '目标等级', 50]], run: (v) => `到达 ${v.level} 级累计经验 ≈ ${((v.base * (v.growth ** v.level - 1)) / (v.growth - 1)).toFixed(0)}\n该级升级所需 ≈ ${(v.base * v.growth ** (v.level - 1)).toFixed(0)}` },
        { name: '升级经验', fields: [['level', '当前等级', 10], ['base', '基础经验', 100], ['exp', '指数', 1.5]], run: (v) => `升到 ${v.level + 1} 级需要 ${(v.base * v.level ** v.exp).toFixed(0)} EXP` },
        { name: '掉落模拟', fields: [['rate', '概率 %', 5], ['times', '模拟次数', 1000], ['seed', '种子', 42]], run: (v) => { const rnd = seeded(v.seed); let hits = 0; for (let i = 0; i < v.times; i++) if (rnd() * 100 < v.rate) hits++; return `模拟 ${v.times} 次，掉落 ${hits} 次\n实际掉落率：${(hits / v.times * 100).toFixed(2)}%\n（可复现种子：${v.seed}）`; } }
      ]
    });
  },

  /* ================= 精灵图 ================= */
  'sprite-tools'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>精灵图切图与动画预览</b><span class="hint">按行列切分精灵表</span></div>
          ${fileZone('sp-zone', { accept: 'image/*', label: '选择精灵表图片' })}
          <div class="grid4" style="margin-top:10px">
            <div class="field"><label class="lab">列数</label><input class="inp" id="sp-cols" type="number" value="4"></div>
            <div class="field"><label class="lab">行数</label><input class="inp" id="sp-rows" type="number" value="1"></div>
            <div class="field"><label class="lab">缩放</label><input class="inp" id="sp-scale" type="number" value="1"></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="sp-run" style="width:100%">切分</button></div>
          </div>
          <div class="row" style="margin-top:9px"><button class="btn" id="sp-play">播放动画</button><button class="btn" id="sp-zip">下载全部 ZIP</button><span class="hint" id="sp-meta">尚未选择图片</span></div>
        </div>
        <div class="panel"><div class="panel-head"><b>帧预览</b></div><div class="thumbs" id="sp-frames"></div></div>
        <div class="panel center" id="sp-anim" style="display:none"></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let img = null, frames = [], timer = null;
    bindFileZone(root, 'sp-zone', async (fs) => {
      img = await loadImage(URL.createObjectURL(fs[0]));
      $('#sp-meta').textContent = `${img.width} × ${img.height}`;
    });
    $('#sp-run').onclick = () => {
      if (!img) return toast('请选择图片', 'err');
      const cols = Math.max(1, Number($('#sp-cols').value)), rows = Math.max(1, Number($('#sp-rows').value));
      const fw = img.width / cols, fh = img.height / rows;
      frames = [];
      $('#sp-frames').innerHTML = '';
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const cv = document.createElement('canvas');
        cv.width = fw; cv.height = fh;
        cv.getContext('2d').drawImage(img, c * fw, r * fh, fw, fh, 0, 0, fw, fh);
        frames.push(cv);
        const url = cv.toDataURL();
        $('#sp-frames').insertAdjacentHTML('beforeend', `<div class="thumb" style="aspect-ratio:auto"><img src="${url}" alt="" style="image-rendering:pixelated"><div class="hint">${frames.length}</div></div>`);
      }
      $('#sp-meta').textContent = `${frames.length} 帧 · ${fw}×${fh}`;
    };
    $('#sp-play').onclick = () => {
      if (!frames.length) return toast('先切分', 'err');
      const box = $('#sp-anim');
      box.style.display = 'block';
      box.innerHTML = '';
      const cv = document.createElement('canvas');
      const scale = Math.max(1, Number($('#sp-scale').value) || 1);
      cv.width = frames[0].width * scale; cv.height = frames[0].height * scale;
      cv.style.imageRendering = 'pixelated';
      box.appendChild(cv);
      const g = cv.getContext('2d');
      let i = 0;
      clearInterval(timer);
      timer = setInterval(() => { g.clearRect(0, 0, cv.width, cv.height); g.drawImage(frames[i], 0, 0, cv.width, cv.height); i = (i + 1) % frames.length; }, 120);
    };
    $('#sp-zip').onclick = async () => {
      if (!frames.length) return;
      await ctx.deps(['jszip']);
      const zip = new window.JSZip();
      frames.forEach((cv, i) => zip.file(`frame-${String(i + 1).padStart(3, '0')}.png`, cv.toDataURL().split(',')[1], { base64: true }));
      download('sprites.zip', await zip.generateAsync({ type: 'blob' }));
    };
    ctx.onDestroy(() => clearInterval(timer));
  },

  /* ================= 谜题 ================= */
  'puzzle-tools'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="pz-tabs"><button class="tab active" data-i="0">24 点</button><button class="tab" data-i="1">迷宫</button><button class="tab" data-i="2">记忆序列</button></div>
        <div class="panel" id="pz-p0">
          <div class="row"><input class="inp" id="pz-nums" value="3,3,8,8" style="max-width:200px"><button class="btn primary" id="pz-solve">求解</button><button class="btn" id="pz-gen">随机出题</button></div>
          <pre class="out" id="pz-out" style="margin-top:9px"></pre>
        </div>
        <div class="panel hidden" id="pz-p1">
          <div class="row"><input class="inp" id="pz-size" type="number" value="15" style="max-width:90px"><button class="btn primary" id="pz-maze">生成迷宫</button><span class="hint">起点左上，终点右下</span></div>
          <div class="canvas-wrap" style="margin-top:9px"><canvas id="pz-canvas" width="600" height="600" style="background:#070b14"></canvas></div>
        </div>
        <div class="panel hidden" id="pz-p2">
          <div class="row"><button class="btn primary" id="pz-start">开始</button><span class="hint" id="pz-status">记住闪烁的数字顺序</span></div>
          <div id="pz-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-width:300px;margin-top:12px"></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#pz-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#pz-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      [0, 1, 2].forEach((i) => $('#pz-p' + i).classList.toggle('hidden', String(i) !== b.dataset.i));
    });
    const ops = [['+', (a, b) => a + b], ['-', (a, b) => a - b], ['*', (a, b) => a * b], ['/', (a, b) => b ? a / b : NaN]];
    const solve24 = (nums) => {
      const rec = (arr) => {
        if (arr.length === 1) return Math.abs(arr[0].v - 24) < 1e-6 ? arr[0].e : null;
        for (let i = 0; i < arr.length; i++) for (let j = 0; j < arr.length; j++) {
          if (i === j) continue;
          const rest = arr.filter((_, k) => k !== i && k !== j);
          for (const [sym, fn] of ops) {
            const v = fn(arr[i].v, arr[j].v);
            if (!isFinite(v)) continue;
            const r = rec([...rest, { v, e: `(${arr[i].e} ${sym} ${arr[j].e})` }]);
            if (r) return r;
          }
        }
        return null;
      };
      return rec(nums.map((n) => ({ v: n, e: String(n) })));
    };
    $('#pz-solve').onclick = () => {
      const nums = $('#pz-nums').value.split(',').map(Number).filter((x) => !isNaN(x));
      if (nums.length !== 4) return toast('需要 4 个数字', 'err');
      $('#pz-out').textContent = solve24(nums) || '无解';
    };
    $('#pz-gen').onclick = () => {
      for (let i = 0; i < 100; i++) {
        const nums = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 13));
        if (solve24(nums)) { $('#pz-nums').value = nums.join(','); $('#pz-out').textContent = '已出题，点击求解查看答案'; return; }
      }
    };
    $('#pz-maze').onclick = () => {
      const N = Math.max(5, Math.min(40, Number($('#pz-size').value) || 15));
      const cv = $('#pz-canvas'), g = cv.getContext('2d');
      const cell = 600 / N;
      const grid = Array.from({ length: N * N }, () => ({ walls: [1, 1, 1, 1], v: false }));
      const stack = [0]; grid[0].v = true;
      const dirs = [[-1, 0, 0, 2], [1, 0, 2, 0], [0, -1, 3, 1], [0, 1, 1, 3]];
      while (stack.length) {
        const cur = stack[stack.length - 1], r = Math.floor(cur / N), c = cur % N;
        const opts = dirs.filter(([dr, dc]) => { const nr = r + dr, nc = c + dc; return nr >= 0 && nr < N && nc >= 0 && nc < N && !grid[nr * N + nc].v; });
        if (!opts.length) { stack.pop(); continue; }
        const [dr, dc, w1, w2] = opts[Math.floor(Math.random() * opts.length)];
        const ni = (r + dr) * N + c + dc;
        grid[cur].walls[w1] = 0; grid[ni].walls[w2] = 0; grid[ni].v = true; stack.push(ni);
      }
      g.fillStyle = '#070b14'; g.fillRect(0, 0, 600, 600);
      g.strokeStyle = '#38cdf0'; g.lineWidth = 2;
      grid.forEach((cellData, i) => {
        const r = Math.floor(i / N), c = i % N, x = c * cell, y = r * cell;
        if (cellData.walls[0]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + cell, y); g.stroke(); }
        if (cellData.walls[1]) { g.beginPath(); g.moveTo(x + cell, y); g.lineTo(x + cell, y + cell); g.stroke(); }
        if (cellData.walls[2]) { g.beginPath(); g.moveTo(x + cell, y + cell); g.lineTo(x, y + cell); g.stroke(); }
        if (cellData.walls[3]) { g.beginPath(); g.moveTo(x, y + cell); g.lineTo(x, y); g.stroke(); }
      });
      g.fillStyle = '#34d399'; g.fillRect(2, 2, cell - 2, cell - 2);
      g.fillStyle = '#fb7185'; g.fillRect(600 - cell + 2, 600 - cell + 2, cell - 4, cell - 4);
    };
    let seq = [], input = [];
    const paintMemory = () => {
      $('#pz-grid').innerHTML = Array.from({ length: 9 }, (_, i) => `<button class="btn" data-cell="${i}" style="height:70px;font-size:20px">${i + 1}</button>`).join('');
      root.querySelectorAll('[data-cell]').forEach((b) => b.addEventListener('click', () => {
        const v = Number(b.dataset.cell) + 1;
        input.push(v);
        b.style.background = 'var(--acc-soft)';
        setTimeout(() => { b.style.background = ''; }, 200);
        if (input.length === seq.length) {
          const ok = input.every((x, i) => x === seq[i]);
          $('#pz-status').textContent = ok ? `正确！长度 ${seq.length}` : '错误，重新开始';
          if (ok) setTimeout(startMemory, 800);
          input = [];
        }
      }));
    };
    const startMemory = () => {
      seq = Array.from({ length: Math.min(9, 3 + Math.floor(seq.length / 2)) }, () => 1 + Math.floor(Math.random() * 9));
      input = [];
      $('#pz-status').textContent = '观察…';
      let i = 0;
      const show = () => {
        if (i >= seq.length) { $('#pz-status').textContent = '请按顺序点击'; return; }
        const b = root.querySelector(`[data-cell="${seq[i] - 1}"]`);
        b.style.background = 'var(--acc)';
        setTimeout(() => { b.style.background = ''; i++; setTimeout(show, 200); }, 450);
      };
      show();
    };
    $('#pz-start').onclick = () => { seq = []; startMemory(); };
    paintMemory();
    $('#pz-solve').click();
  },

  /* ================= 随机扩展 ================= */
  'random-pro'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="grid3">
            <div class="field"><label class="lab">条目（每行：名称,权重）</label><textarea class="ta mono" id="rp-items" rows="5">一等奖,1
二等奖,3
三等奖,10
谢谢参与,86</textarea></div>
            <div class="field"><label class="lab">抽取数量</label><input class="inp" id="rp-count" type="number" value="1"></div>
            <div class="field"><label class="lab">随机种子（可复现）</label><input class="inp" id="rp-seed" type="number" value="42"></div>
          </div>
          <div class="row" style="margin-top:9px"><button class="btn primary" id="rp-run">加权抽取</button><button class="btn" id="rp-multi">多轮抽奖</button><button class="btn" id="rp-copy">复制</button></div>
        </div>
        <div class="panel"><pre class="out" id="rp-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const parse = () => $('#rp-items').value.split(/\r?\n/).filter(Boolean).map((l) => { const [n, w] = l.split(','); return { n: n.trim(), w: Number(w) || 1 }; });
    const pick = (items, rnd) => {
      const total = items.reduce((s, x) => s + x.w, 0);
      let r = rnd() * total;
      for (const x of items) { r -= x.w; if (r <= 0) return x.n; }
      return items[items.length - 1].n;
    };
    $('#rp-run').onclick = () => {
      const items = parse();
      const rnd = seeded(Number($('#rp-seed').value) || 42);
      const n = Math.max(1, Number($('#rp-count').value));
      $('#rp-out').textContent = Array.from({ length: n }, () => pick(items, rnd)).join('\n');
    };
    $('#rp-multi').onclick = () => {
      const items = parse();
      const rnd = seeded(Number($('#rp-seed').value) || 42);
      const counts = new Map();
      for (let i = 0; i < 10000; i++) { const x = pick(items, rnd); counts.set(x, (counts.get(x) || 0) + 1); }
      $('#rp-out').textContent = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v} 次（${(v / 100).toFixed(2)}%）`).join('\n');
    };
    $('#rp-copy').onclick = () => copy($('#rp-out').textContent);
    $('#rp-run').click();
  },

  /* ================= 生成艺术 ================= */
  'gen-art'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="row"><select class="sel" id="ga-type" style="max-width:160px"><option value="lsystem">L-system 树</option><option value="mandel">Mandelbrot</option><option value="julia">Julia 集</option><option value="spiro">万花尺</option></select><button class="btn primary" id="ga-run">生成</button><button class="btn" id="ga-dl">下载 PNG</button><span class="hint" id="ga-meta"></span></div>
        </div>
        <div class="panel"><div class="canvas-wrap"><canvas id="ga-canvas" width="640" height="640" style="background:#070b14;max-width:100%"></canvas></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const run = () => {
      const cv = $('#ga-canvas'), g = cv.getContext('2d');
      const W = cv.width, H = cv.height;
      const type = $('#ga-type').value;
      g.fillStyle = '#070b14'; g.fillRect(0, 0, W, H);
      if (type === 'lsystem') {
        g.strokeStyle = '#38cdf0'; g.lineWidth = 1.2; g.lineCap = 'round';
        const draw = (x, y, len, angle, depth) => {
          if (depth <= 0) return;
          const x2 = x + Math.cos(angle) * len, y2 = y + Math.sin(angle) * len;
          g.strokeStyle = depth > 5 ? '#34d399' : '#38cdf0';
          g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
          draw(x2, y2, len * 0.75, angle - 0.5, depth - 1);
          draw(x2, y2, len * 0.75, angle + 0.5, depth - 1);
        };
        draw(W / 2, H - 40, 120, -Math.PI / 2, 9);
      } else if (type === 'mandel' || type === 'julia') {
        const img = g.createImageData(W, H);
        const maxIter = 120;
        const jr = -0.8, ji = 0.156;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          let cr, ci;
          if (type === 'mandel') { cr = (x - W / 2) / (W * 0.35) - 0.5; ci = (y - H / 2) / (H * 0.35); }
          else { cr = jr; ci = ji; }
          let zr = type === 'julia' ? (x - W / 2) / (W * 0.35) : 0;
          let zi = type === 'julia' ? (y - H / 2) / (H * 0.35) : 0;
          let i = 0;
          while (i < maxIter && zr * zr + zi * zi < 4) { const t = zr * zr - zi * zi + cr; zi = 2 * zr * zi + ci; zr = t; i++; }
          const k = (y * W + x) * 4;
          const t = i / maxIter;
          img.data[k] = Math.round(40 + 200 * t ** 0.6);
          img.data[k + 1] = Math.round(20 + 120 * (1 - t));
          img.data[k + 2] = Math.round(80 + 160 * t);
          img.data[k + 3] = 255;
        }
        g.putImageData(img, 0, 0);
      } else {
        const R = 260, r = 90, d = 70;
        g.strokeStyle = '#818cf8'; g.lineWidth = 1;
        g.beginPath();
        for (let a = 0; a < Math.PI * 2 * 12; a += 0.005) {
          const x = W / 2 + (R - r) * Math.cos(a) + d * Math.cos((R - r) / r * a);
          const y = H / 2 + (R - r) * Math.sin(a) - d * Math.sin((R - r) / r * a);
          a ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.stroke();
      }
      $('#ga-meta').textContent = type;
    };
    $('#ga-run').onclick = run;
    $('#ga-dl').onclick = () => $('#ga-canvas').toBlob((b) => download('generative-art.png', b));
    run();
  }
};
