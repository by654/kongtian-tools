/* 学习、教育与小游戏 */
import { esc, copy, toast, download } from '../core/ui.js';

const $ = (root, s) => root.querySelector(s);
const pad = (n) => String(n).padStart(2, '0');
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

/* ---------- 数独 ---------- */
function solveSudoku(board) {
  const empty = board.indexOf(0);
  if (empty < 0) return true;
  const r = Math.floor(empty / 9), c = empty % 9;
  for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
    if (validSudoku(board, r, c, v)) {
      board[empty] = v;
      if (solveSudoku(board)) return true;
      board[empty] = 0;
    }
  }
  return false;
}
function validSudoku(b, r, c, v) {
  for (let i = 0; i < 9; i++) {
    if (b[r * 9 + i] === v || b[i * 9 + c] === v) return false;
  }
  const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (b[(br + i) * 9 + bc + j] === v) return false;
  return true;
}
function genSudoku(holes) {
  const board = new Array(81).fill(0);
  solveSudoku(board);
  const puzzle = [...board];
  const idx = shuffle([...Array(81).keys()]);
  for (let i = 0; i < holes; i++) puzzle[idx[i]] = 0;
  return { puzzle, solution: board };
}

export default {
  /* ================= 记忆卡片 ================= */
  'flashcards'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="row"><button class="btn primary" data-mode="review">开始复习</button><button class="btn" data-mode="manage">管理卡片</button><span class="hint" id="fc-due"></span></div>
        </div>
        <div id="fc-area"></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const load = () => JSON.parse(localStorage.getItem('kt:cards') || '[]');
    const save = (x) => localStorage.setItem('kt:cards', JSON.stringify(x));
    let queue = [], currentIdx = 0, mode = 'review';
    const due = () => load().filter((c) => !c.next || c.next <= Date.now());
    const paintReview = () => {
      const all = load();
      $('#fc-due').textContent = `共 ${all.length} 张 · 今日待复习 ${due().length} 张`;
      if (!queue.length) queue = shuffle(due());
      if (!queue.length) {
        $('#fc-area').innerHTML = `<div class="panel"><div class="empty">今天没有待复习卡片。<br><button class="btn" data-mode="manage" style="margin-top:10px">去添加卡片</button></div></div>`;
        root.querySelector('[data-mode="manage"]')?.addEventListener('click', () => switchMode('manage'));
        return;
      }
      const card = queue[0];
      let revealed = false;
      $('#fc-area').innerHTML = `<div class="panel center" style="padding:30px">
        <div class="hint">${all.length - queue.length + 1} / ${all.length}</div>
        <div id="fc-front" style="font-size:26px;font-weight:700;margin:18px 0;min-height:70px">${esc(card.front)}</div>
        <div id="fc-back" style="font-size:18px;color:var(--acc);min-height:40px"></div>
        <div class="row" style="justify-content:center;margin-top:18px"><button class="btn primary" id="fc-reveal">显示答案</button></div>
        <div class="row hidden" id="fc-rate" style="justify-content:center;margin-top:14px">
          <button class="btn" data-rate="0" style="border-color:rgba(251,113,133,.4)">忘记</button>
          <button class="btn" data-rate="1">模糊</button>
          <button class="btn" data-rate="2" style="border-color:rgba(52,211,153,.4)">记住</button>
        </div>
      </div>`;
      $('#fc-reveal').onclick = () => {
        revealed = true;
        $('#fc-back').textContent = card.back;
        $('#fc-reveal').classList.add('hidden');
        $('#fc-rate').classList.remove('hidden');
      };
      root.querySelectorAll('[data-rate]').forEach((b) => b.addEventListener('click', () => {
        const r = Number(b.dataset.rate);
        const l = load();
        const c = l.find((x) => x.id === card.id);
        if (c) {
          c.level = Math.max(0, (c.level || 0) + (r === 2 ? 1 : r === 1 ? 0 : -1));
          const days = r === 0 ? 0 : r === 1 ? 1 : Math.max(1, 2 ** Math.min(6, c.level || 1));
          c.next = Date.now() + days * 864e5;
          save(l);
        }
        queue.shift();
        paintReview();
      }));
    };
    const paintManage = () => {
      const all = load();
      $('#fc-due').textContent = `共 ${all.length} 张`;
      $('#fc-area').innerHTML = `<div class="panel">
        <div class="grid2"><div class="field"><label class="lab">正面</label><input class="inp" id="fc-front-in" placeholder="问题 / 单词"></div><div class="field"><label class="lab">背面</label><input class="inp" id="fc-back-in" placeholder="答案 / 释义"></div></div>
        <div class="row" style="margin-top:10px"><button class="btn primary" id="fc-add">添加</button><button class="btn" id="fc-export">导出 JSON</button><label class="btn" style="cursor:pointer">导入 JSON<input type="file" id="fc-import" accept=".json" hidden></label></div>
      </div><div class="panel"><div class="panel-head"><b>卡片列表</b><span class="hint">${all.length} 张</span></div>${all.map((c, i) => `<div class="row between" style="border-bottom:1px solid var(--line);padding:5px 0"><div><b>${esc(c.front)}</b><div class="hint">${esc(c.back)}</div></div><button class="btn sm danger" data-del="${i}">删除</button></div>`).join('') || '<div class="hint">还没有卡片</div>'}</div>`;
      $('#fc-add').onclick = () => {
        const front = $('#fc-front-in').value.trim(), back = $('#fc-back-in').value.trim();
        if (!front || !back) return toast('请填写正反面', 'err');
        const l = load(); l.push({ id: Date.now(), front, back, level: 0, next: 0 }); save(l); paintManage();
      };
      $('#fc-export').onclick = () => download('flashcards.json', JSON.stringify(all, null, 2), 'application/json');
      $('#fc-import').onchange = async (e) => {
        const text = await e.target.files[0].text();
        try { const l = load(); l.push(...JSON.parse(text)); save(l); paintManage(); }
        catch { toast('导入失败', 'err'); }
      };
      root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { const l = load(); l.splice(Number(b.dataset.del), 1); save(l); paintManage(); }));
    };
    const switchMode = (m) => {
      mode = m;
      if (m === 'review') paintReview(); else paintManage();
    };
    root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => switchMode(b.dataset.mode)));
    switchMode('review');
  },

  /* ================= 打字测试 ================= */
  'typing-test'(root) {
    const samples = [
      'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs. How vexingly quick daft zebras jump.',
      '空天工具合集把常用的文本、编码、图片与计算功能放进浏览器，打开就能用。所有文件都在本地处理，不会上传到服务器。',
      'Simplicity is the ultimate sophistication. Design is not just what it looks like and feels like. Design is how it works.'
    ];
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="row between"><select class="sel" id="tt-sample" style="max-width:170px"><option value="0">英文短文</option><option value="1">中文短文</option><option value="2">英文名言</option></select><button class="btn primary" id="tt-restart">重新开始</button><span class="hint" id="tt-time">60 秒</span></div>
          <div id="tt-text" style="font-size:17px;line-height:1.9;margin-top:14px;letter-spacing:.2px"></div>
        </div>
        <textarea class="ta" id="tt-input" rows="4" placeholder="点击这里开始输入…" style="font-size:15px"></textarea>
        <div class="stat-grid" id="tt-stats"></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let text = '', start = 0, timer = null, done = false;
    const paintText = () => {
      const typed = $('#tt-input').value;
      $('#tt-text').innerHTML = [...text].map((c, i) => {
        if (i < typed.length) return `<span style="color:${typed[i] === c ? '#34d399' : '#fb7185'};background:${typed[i] === c ? 'transparent' : 'rgba(251,113,133,.12)'}">${esc(c)}</span>`;
        if (i === typed.length) return `<span style="border-bottom:2px solid var(--acc)">${esc(c)}</span>`;
        return `<span style="color:var(--muted)">${esc(c)}</span>`;
      }).join('');
    };
    const finish = () => {
      clearInterval(timer);
      done = true;
      const typed = $('#tt-input').value;
      const correct = [...typed].filter((c, i) => c === text[i]).length;
      const minutes = Math.max(1 / 60, (Date.now() - start) / 60000);
      const wpm = Math.round((typed.length / 5) / minutes);
      const acc = typed.length ? Math.round(correct / typed.length * 100) : 0;
      $('#tt-stats').innerHTML = [['速度', wpm + ' WPM'], ['字符', typed.length], ['准确率', acc + '%'], ['正确字符', correct]]
        .map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
      $('#tt-time').textContent = '已完成';
    };
    $('#tt-input').addEventListener('input', () => {
      if (done) return;
      if (!start) {
        start = Date.now();
        timer = setInterval(() => {
          const left = 60 - Math.floor((Date.now() - start) / 1000);
          $('#tt-time').textContent = `${Math.max(0, left)} 秒`;
          if (left <= 0) finish();
        }, 250);
      }
      paintText();
      if ($('#tt-input').value.length >= text.length) finish();
    });
    const reset = () => {
      clearInterval(timer);
      text = samples[Number($('#tt-sample').value)];
      start = 0; done = false;
      $('#tt-input').value = ''; $('#tt-time').textContent = '60 秒';
      $('#tt-stats').innerHTML = '';
      paintText(); $('#tt-input').focus();
    };
    $('#tt-restart').onclick = reset;
    $('#tt-sample').onchange = reset;
    reset();
    const obs = new MutationObserver(() => { if (!document.body.contains(root)) { clearInterval(timer); obs.disconnect(); } });
    obs.observe(document.body, { childList: true, subtree: true });
  },

  /* ================= 口算练习 ================= */
  'math-practice'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="row">
            <label class="row" style="gap:4px"><input type="checkbox" class="mp-op" value="+" checked> 加</label>
            <label class="row" style="gap:4px"><input type="checkbox" class="mp-op" value="-" checked> 减</label>
            <label class="row" style="gap:4px"><input type="checkbox" class="mp-op" value="×" checked> 乘</label>
            <label class="row" style="gap:4px"><input type="checkbox" class="mp-op" value="÷"> 除</label>
            <select class="sel" id="mp-level" style="max-width:120px"><option value="10">10 以内</option><option value="20" selected>20 以内</option><option value="100">100 以内</option></select>
            <button class="btn primary" id="mp-new">出题</button><button class="btn" id="mp-check">检查</button><span class="hint" id="mp-score"></span>
          </div>
        </div>
        <div class="panel"><div id="mp-list" class="tool-ui"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const rnd = (n) => Math.floor(Math.random() * n);
    let answers = [];
    const gen = () => {
      const ops = [...root.querySelectorAll('.mp-op:checked')].map((x) => x.value);
      const max = Number($('#mp-level').value);
      if (!ops.length) return toast('至少选择一种运算', 'err');
      answers = [];
      const qs = Array.from({ length: 10 }, () => {
        let op = ops[rnd(ops.length)];
        let a = 1 + rnd(max), b = 1 + rnd(max);
        if (op === '-') { if (a < b) [a, b] = [b, a]; }
        if (op === '÷') { b = 1 + rnd(Math.min(10, max)); a = b * (1 + rnd(Math.min(10, max))); }
        let ans = op === '+' ? a + b : op === '-' ? a - b : op === '×' ? a * b : a / b;
        answers.push(ans);
        return `${a} ${op} ${b} =`;
      });
      $('#mp-list').innerHTML = qs.map((q, i) => `<div class="row"><span class="mono" style="min-width:130px">${q}</span><input class="inp" id="mp-${i}" type="number" style="max-width:120px"></div>`).join('');
      $('#mp-score').textContent = '';
    };
    $('#mp-new').onclick = gen;
    $('#mp-check').onclick = () => {
      let correct = 0;
      answers.forEach((a, i) => {
        const v = Number(document.getElementById('mp-' + i)?.value);
        if (v === a) correct++;
      });
      $('#mp-score').textContent = `${correct} / 10 正确`;
    };
    gen();
  },

  /* ================= 五十音 ================= */
  'kana'(root) {
    const seion = [
      ['あ', 'a'], ['い', 'i'], ['う', 'u'], ['え', 'e'], ['お', 'o'],
      ['か', 'ka'], ['き', 'ki'], ['く', 'ku'], ['け', 'ke'], ['こ', 'ko'],
      ['さ', 'sa'], ['し', 'shi'], ['す', 'su'], ['せ', 'se'], ['そ', 'so'],
      ['た', 'ta'], ['ち', 'chi'], ['つ', 'tsu'], ['て', 'te'], ['と', 'to'],
      ['な', 'na'], ['に', 'ni'], ['ぬ', 'nu'], ['ね', 'ne'], ['の', 'no'],
      ['は', 'ha'], ['ひ', 'hi'], ['ふ', 'fu'], ['へ', 'he'], ['ほ', 'ho'],
      ['ま', 'ma'], ['み', 'mi'], ['む', 'mu'], ['め', 'me'], ['も', 'mo'],
      ['や', 'ya'], ['ゆ', 'yu'], ['よ', 'yo'],
      ['ら', 'ra'], ['り', 'ri'], ['る', 'ru'], ['れ', 're'], ['ろ', 'ro'],
      ['わ', 'wa'], ['を', 'wo'], ['ん', 'n']
    ];
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="kn-tabs"><button class="tab active" data-i="0">假名表</button><button class="tab" data-i="1">发音测验</button></div>
        <div class="panel" id="kn-p0"><div class="row" id="kn-grid" style="gap:7px"></div></div>
        <div class="panel hidden" id="kn-p1">
          <div class="center"><div id="kn-q" style="font-size:52px;font-weight:700;color:var(--acc)">—</div><div class="hint" id="kn-status">点击开始</div></div>
          <div class="row" id="kn-opts" style="justify-content:center;margin-top:16px"></div>
          <div class="row" style="justify-content:center;margin-top:14px"><button class="btn primary" id="kn-start">出题</button><span class="hint" id="kn-score"></span></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#kn-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#kn-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      $('#kn-p0').classList.toggle('hidden', b.dataset.i !== '0');
      $('#kn-p1').classList.toggle('hidden', b.dataset.i !== '1');
    });
    $('#kn-grid').innerHTML = seion.map(([k, r]) => `<button class="btn" data-kana="${k}" style="flex-direction:column;min-width:52px;min-height:58px"><span style="font-size:20px">${k}</span><span class="hint" style="font-size:10px">${r}</span></button>`).join('');
    const speak = (text) => {
      if (!('speechSynthesis' in window)) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP';
      speechSynthesis.speak(u);
    };
    root.querySelectorAll('[data-kana]').forEach((b) => b.addEventListener('click', () => speak(b.dataset.kana)));
    let score = 0, total = 0, answer = '';
    $('#kn-start').onclick = () => {
      const item = seion[Math.floor(Math.random() * seion.length)];
      answer = item[1];
      $('#kn-q').textContent = item[0];
      const opts = shuffle([answer, ...shuffle(seion.filter((x) => x[1] !== answer)).slice(0, 3).map((x) => x[1])]);
      $('#kn-opts').innerHTML = opts.map((o) => `<button class="btn" data-opt="${o}">${o}</button>`).join('');
      root.querySelectorAll('[data-opt]').forEach((b) => b.addEventListener('click', () => {
        total++;
        if (b.dataset.opt === answer) { score++; speak(item[0]); $('#kn-status').textContent = '正确'; }
        else $('#kn-status').textContent = '错误，正确答案是 ' + answer;
        $('#kn-score').textContent = `${score} / ${total}`;
        setTimeout(() => $('#kn-start').click(), 700);
      }));
    };
  },

  /* ================= 数独 ================= */
  'sudoku'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="row"><select class="sel" id="sd-level" style="max-width:130px"><option value="30">简单</option><option value="42" selected>中等</option><option value="52">困难</option></select><button class="btn primary" id="sd-new">新游戏</button><button class="btn" id="sd-check">检查</button><button class="btn" id="sd-solve">显示答案</button><span class="hint" id="sd-status"></span></div>
        </div>
        <div class="panel center"><div id="sd-board" style="display:inline-grid;grid-template-columns:repeat(9,1fr);gap:0;border:2px solid var(--line-strong)"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let puzzle = [], solution = [];
    const paint = () => {
      $('#sd-board').innerHTML = puzzle.map((v, i) => {
        const r = Math.floor(i / 9), c = i % 9;
        const thickR = c === 2 || c === 5 ? 'border-right:2px solid var(--line-strong);' : 'border-right:1px solid var(--line);';
        const thickB = r === 2 || r === 5 ? 'border-bottom:2px solid var(--line-strong);' : 'border-bottom:1px solid var(--line);';
        return `<input id="sd-${i}" value="${v || ''}" ${v ? 'readonly' : ''} maxlength="1" inputmode="numeric" style="width:42px;height:42px;text-align:center;border:0;${thickR}${thickB}background:${v ? 'var(--w-04)' : 'var(--panel)'};color:${v ? 'var(--text)' : 'var(--acc)'};font-size:18px;outline:none">`;
      }).join('');
      root.querySelectorAll('#sd-board input').forEach((inp) => inp.addEventListener('input', () => {
        inp.value = inp.value.replace(/[^1-9]/g, '').slice(0, 1);
      }));
    };
    const newGame = () => {
      const { puzzle: p, solution: s } = genSudoku(Number($('#sd-level').value));
      puzzle = p; solution = s;
      paint();
      $('#sd-status').textContent = '新游戏开始';
    };
    $('#sd-new').onclick = newGame;
    $('#sd-check').onclick = () => {
      let filled = 0, wrong = 0;
      puzzle.forEach((v, i) => {
        const val = Number(document.getElementById('sd-' + i).value);
        if (val) filled++;
        if (val && val !== solution[i]) { wrong++; document.getElementById('sd-' + i).style.color = 'var(--err)'; }
      });
      $('#sd-status').textContent = wrong ? `${wrong} 处错误` : filled === 81 ? '完成！' : '目前全部正确';
    };
    $('#sd-solve').onclick = () => { puzzle = [...solution]; paint(); $('#sd-status').textContent = '已显示答案'; };
    newGame();
  },

  /* ================= 2048 ================= */
  'game-2048'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="row between"><div><b style="font-size:22px;color:var(--acc)" id="g2-score">0</b><span class="hint"> 分</span></div><div class="row"><button class="btn primary" id="g2-new">新游戏</button><span class="hint" id="g2-status">方向键 / 滑动操作</span></div></div>
          <div id="g2-board" style="margin-top:14px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;background:var(--w-04);padding:8px;border-radius:12px;touch-action:none"></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const colors = { 2: '#1f2a44', 4: '#243356', 8: '#2b4370', 16: '#31527f', 32: '#3b6495', 64: '#4a78a8', 128: '#5f8fbd', 256: '#7aa6cf', 512: '#99bde0', 1024: '#b8d4ee', 2048: '#d6e9fb' };
    let grid = [], score = 0, over = false;
    const emptyCell = () => {
      const empty = [];
      grid.forEach((v, i) => { if (!v) empty.push(i); });
      return empty;
    };
    const add = () => { const e = emptyCell(); if (e.length) grid[e[Math.floor(Math.random() * e.length)]] = Math.random() < 0.9 ? 2 : 4; };
    const paint = () => {
      $('#g2-board').innerHTML = grid.map((v) => `<div style="aspect-ratio:1;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:${v > 999 ? 18 : 24}px;background:${v ? colors[v] || '#e9eefc' : 'var(--w-03)'};color:${v > 128 ? '#0e1a2f' : v ? '#e9eefc' : 'transparent'}">${v || ''}</div>`).join('');
      $('#g2-score').textContent = score;
      $('#g2-status').textContent = over ? '游戏结束，点击新游戏' : '方向键 / 滑动操作';
    };
    const move = (dir) => {
      if (over) return;
      const old = [...grid];
      const lines = [];
      for (let i = 0; i < 4; i++) {
        const line = [];
        for (let j = 0; j < 4; j++) {
          if (dir === 'left') line.push(i * 4 + j);
          if (dir === 'right') line.push(i * 4 + (3 - j));
          if (dir === 'up') line.push(j * 4 + i);
          if (dir === 'down') line.push((3 - j) * 4 + i);
        }
        lines.push(line);
      }
      for (const line of lines) {
        let vals = line.map((i) => grid[i]).filter(Boolean);
        for (let i = 0; i < vals.length - 1; i++) {
          if (vals[i] === vals[i + 1]) { vals[i] *= 2; score += vals[i]; vals.splice(i + 1, 1); }
        }
        while (vals.length < 4) vals.push(0);
        line.forEach((idx, i) => { grid[idx] = vals[i]; });
      }
      if (grid.some((v, i) => v !== old[i])) add();
      if (!emptyCell().length && !canMove()) over = true;
      paint();
    };
    const canMove = () => {
      for (let i = 0; i < 16; i++) {
        const v = grid[i];
        if (i % 4 < 3 && grid[i + 1] === v) return true;
        if (i + 4 < 16 && grid[i + 4] === v) return true;
      }
      return false;
    };
    const reset = () => {
      grid = new Array(16).fill(0); score = 0; over = false;
      add(); add(); paint();
    };
    const keyHandler = (e) => {
      const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
      if (map[e.key]) { e.preventDefault(); move(map[e.key]); }
    };
    window.addEventListener('keydown', keyHandler);
    let sx = 0, sy = 0;
    const board = $('#g2-board');
    board.addEventListener('touchstart', (e) => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; }, { passive: true });
    board.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    });
    $('#g2-new').onclick = reset;
    reset();
    ctx.onDestroy(() => window.removeEventListener('keydown', keyHandler));
  },

  /* ================= 贪吃蛇 ================= */
  'game-snake'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="row between"><b>得分 <span id="sn-score" style="color:var(--acc);font-size:20px">0</span></b><div class="row"><button class="btn primary" id="sn-start">开始</button><button class="btn" id="sn-pause">暂停</button><span class="hint" id="sn-status">方向键 / WASD</span></div></div>
          <div class="canvas-wrap" style="margin-top:12px"><canvas id="sn-canvas" width="480" height="480" style="width:100%;max-width:480px;background:#070b14;touch-action:none"></canvas></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const cv = $('#sn-canvas'), g = cv.getContext('2d');
    const N = 20, CELL = cv.width / N;
    let snake = [], dir = { x: 1, y: 0 }, nextDir = { x: 1, y: 0 }, food = { x: 5, y: 5 }, timer = null, score = 0, alive = false;
    const placeFood = () => {
      do { food = { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) }; } while (snake.some((s) => s.x === food.x && s.y === food.y));
    };
    const paint = () => {
      g.fillStyle = '#070b14'; g.fillRect(0, 0, cv.width, cv.height);
      g.strokeStyle = 'rgba(255,255,255,.04)';
      for (let i = 1; i < N; i++) { g.beginPath(); g.moveTo(i * CELL, 0); g.lineTo(i * CELL, cv.height); g.moveTo(0, i * CELL); g.lineTo(cv.width, i * CELL); g.stroke(); }
      g.fillStyle = '#fbbf24';
      g.beginPath(); g.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL * 0.32, 0, Math.PI * 2); g.fill();
      snake.forEach((s, i) => {
        g.fillStyle = i === 0 ? '#67e8f9' : `rgba(56,205,240,${0.45 + 0.5 * (1 - i / snake.length)})`;
        g.fillRect(s.x * CELL + 2, s.y * CELL + 2, CELL - 4, CELL - 4);
      });
    };
    const tick = () => {
      dir = nextDir;
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      if (head.x < 0 || head.y < 0 || head.x >= N || head.y >= N || snake.some((s) => s.x === head.x && s.y === head.y)) {
        alive = false; clearInterval(timer); timer = null;
        $('#sn-status').textContent = '游戏结束 · 点击开始重来';
        return;
      }
      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) { score += 10; $('#sn-score').textContent = score; placeFood(); }
      else snake.pop();
      paint();
    };
    const reset = () => {
      snake = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }];
      dir = { x: 1, y: 0 }; nextDir = { x: 1, y: 0 }; score = 0; alive = true;
      $('#sn-score').textContent = '0'; placeFood(); paint();
    };
    $('#sn-start').onclick = () => { reset(); clearInterval(timer); timer = setInterval(tick, 110); $('#sn-status').textContent = '进行中'; };
    $('#sn-pause').onclick = () => {
      if (timer) { clearInterval(timer); timer = null; $('#sn-status').textContent = '已暂停'; }
      else if (alive) { timer = setInterval(tick, 110); $('#sn-status').textContent = '进行中'; }
    };
    const key = (e) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'w'].includes(k) && dir.y === 0) nextDir = { x: 0, y: -1 };
      else if (['arrowdown', 's'].includes(k) && dir.y === 0) nextDir = { x: 0, y: 1 };
      else if (['arrowleft', 'a'].includes(k) && dir.x === 0) nextDir = { x: -1, y: 0 };
      else if (['arrowright', 'd'].includes(k) && dir.x === 0) nextDir = { x: 1, y: 0 };
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', key);
    let sx = 0, sy = 0;
    cv.addEventListener('touchstart', (e) => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; }, { passive: true });
    cv.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0]; const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
      if (Math.abs(dx) > Math.abs(dy)) { if (dir.x === 0) nextDir = { x: dx > 0 ? 1 : -1, y: 0 }; }
      else if (dir.y === 0) nextDir = { x: 0, y: dy > 0 ? 1 : -1 };
    });
    reset();
    ctx.onDestroy(() => { clearInterval(timer); window.removeEventListener('keydown', key); });
  },

  /* ================= 扫雷 ================= */
  'game-minesweeper'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="row between">
            <div class="row"><select class="sel" id="ms-level" style="max-width:120px"><option value="9,9,10">简单 9×9</option><option value="16,16,40" selected>中等 16×16</option><option value="16,30,99">困难 16×30</option></select><button class="btn primary" id="ms-new">新游戏</button></div>
            <span class="hint" id="ms-status">左键翻开 · 右键插旗</span>
          </div>
          <div id="ms-board" style="margin-top:12px;display:inline-grid;gap:2px;touch-action:manipulation"></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let cols = 9, rows = 9, mines = 10, cells = [], started = false, ended = false;
    const newGame = () => {
      const [c, r, m] = $('#ms-level').value.split(',').map(Number);
      cols = c; rows = r; mines = m; started = false; ended = false;
      cells = Array.from({ length: rows * cols }, () => ({ mine: false, open: false, flag: false, n: 0 }));
      let placed = 0;
      while (placed < mines) { const i = Math.floor(Math.random() * cells.length); if (!cells[i].mine) { cells[i].mine = true; placed++; } }
      for (let i = 0; i < cells.length; i++) {
        if (cells[i].mine) continue;
        const r0 = Math.floor(i / cols), c0 = i % cols;
        let n = 0;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const rr = r0 + dr, cc = c0 + dc;
          if (rr >= 0 && rr < rows && cc >= 0 && cc < cols && cells[rr * cols + cc].mine) n++;
        }
        cells[i].n = n;
      }
      $('#ms-status').textContent = `雷数 ${mines} · 左键翻开 · 右键插旗`;
      paint();
    };
    const paint = () => {
      const board = $('#ms-board');
      board.style.gridTemplateColumns = `repeat(${cols}, 30px)`;
      board.innerHTML = cells.map((c, i) => {
        const base = 'width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:4px;font-size:12px;font-weight:700;user-select:none;cursor:pointer;';
        if (c.open) {
          if (c.mine) return `<div style="${base}background:rgba(251,113,133,.25);color:var(--err)">*</div>`;
          const colors = ['', '#38cdf0', '#34d399', '#fbbf24', '#fb923c', '#f472b6', '#c084fc', '#e879f9', '#fb7185'];
          return `<div style="${base}background:var(--w-06);color:${colors[c.n] || 'var(--text)'}">${c.n || ''}</div>`;
        }
        return `<div style="${base}background:var(--w-12);color:${c.flag ? 'var(--warn)' : 'transparent'}" data-cell="${i}">${c.flag ? 'F' : '·'}</div>`;
      }).join('');
      board.querySelectorAll('[data-cell]').forEach((el) => {
        const i = Number(el.dataset.cell);
        el.addEventListener('click', () => open(i));
        el.addEventListener('contextmenu', (e) => { e.preventDefault(); if (!ended && !cells[i].open) { cells[i].flag = !cells[i].flag; paint(); } });
      });
    };
    const open = (i) => {
      if (ended || cells[i].open || cells[i].flag) return;
      started = true;
      const stack = [i];
      while (stack.length) {
        const k = stack.pop();
        const c = cells[k];
        if (c.open || c.flag) continue;
        c.open = true;
        if (c.mine) { ended = true; cells.forEach((x) => { if (x.mine) x.open = true; }); $('#ms-status').textContent = '踩到地雷，游戏结束'; paint(); return; }
        if (c.n === 0) {
          const r0 = Math.floor(k / cols), c0 = k % cols;
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            const rr = r0 + dr, cc = c0 + dc;
            if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) stack.push(rr * cols + cc);
          }
        }
      }
      const remain = cells.filter((c) => !c.open).length;
      if (remain === mines) { ended = true; $('#ms-status').textContent = '全部扫清，胜利！'; }
      paint();
    };
    $('#ms-new').onclick = newGame;
    $('#ms-level').addEventListener('change', newGame);
    newGame();
  },

  /* ================= 五子棋 ================= */
  'game-gomoku'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="row between"><b>你执黑先行</b><div class="row"><button class="btn primary" id="gm-new">重新开始</button><span class="hint" id="gm-status">点击棋盘落子</span></div></div>
          <div class="canvas-wrap" style="margin-top:12px"><canvas id="gm-canvas" width="540" height="540" style="width:100%;max-width:540px;background:#d9a55b;border-radius:8px;touch-action:manipulation"></canvas></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const cv = $('#gm-canvas'), g = cv.getContext('2d');
    const N = 15, M = 36, PAD = 18;
    let board = [], over = false;
    const paint = () => {
      g.fillStyle = '#d9a55b'; g.fillRect(0, 0, 540, 540);
      g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1;
      for (let i = 0; i < N; i++) {
        g.beginPath(); g.moveTo(PAD, PAD + i * M); g.lineTo(PAD + (N - 1) * M, PAD + i * M); g.stroke();
        g.beginPath(); g.moveTo(PAD + i * M, PAD); g.lineTo(PAD + i * M, PAD + (N - 1) * M); g.stroke();
      }
      board.forEach((v, i) => {
        if (!v) return;
        const r = Math.floor(i / N), c = i % N;
        const x = PAD + c * M, y = PAD + r * M;
        const grad = g.createRadialGradient(x - 4, y - 4, 2, x, y, 13);
        grad.addColorStop(0, v === 1 ? '#555' : '#fff');
        grad.addColorStop(1, v === 1 ? '#000' : '#bbb');
        g.beginPath(); g.arc(x, y, 13, 0, Math.PI * 2); g.fillStyle = grad; g.fill();
      });
    };
    const win = (p) => {
      const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
      for (let i = 0; i < board.length; i++) {
        if (board[i] !== p) continue;
        const r = Math.floor(i / N), c = i % N;
        for (const [dr, dc] of dirs) {
          let n = 0;
          for (let k = 0; k < 5; k++) {
            const rr = r + dr * k, cc = c + dc * k;
            if (rr < 0 || rr >= N || cc < 0 || cc >= N || board[rr * N + cc] !== p) break;
            n++;
          }
          if (n === 5) return true;
        }
      }
      return false;
    };
    const aiMove = () => {
      let best = -1, bestScore = -1;
      for (let i = 0; i < board.length; i++) {
        if (board[i]) continue;
        let s = 0;
        const r = Math.floor(i / N), c = i % N;
        for (const [dr, dc] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
          for (const player of [2, 1]) {
            let cnt = 1;
            for (const sign of [1, -1]) {
              for (let k = 1; k < 5; k++) {
                const rr = r + dr * k * sign, cc = c + dc * k * sign;
                if (rr < 0 || rr >= N || cc < 0 || cc >= N || board[rr * N + cc] !== player) break;
                cnt++;
              }
            }
            s += (player === 2 ? 1.15 : 1) * (cnt >= 5 ? 100000 : cnt === 4 ? 1000 : cnt === 3 ? 100 : cnt === 2 ? 10 : 1);
          }
        }
        if (s > bestScore) { bestScore = s; best = i; }
      }
      if (best >= 0) board[best] = 2;
    };
    const click = (e) => {
      if (over) return;
      const rect = cv.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width * 540;
      const y = (e.clientY - rect.top) / rect.height * 540;
      const c = Math.round((x - PAD) / M), r = Math.round((y - PAD) / M);
      if (r < 0 || r >= N || c < 0 || c >= N) return;
      const i = r * N + c;
      if (board[i]) return;
      board[i] = 1;
      if (win(1)) { over = true; $('#gm-status').textContent = '你赢了！'; paint(); return; }
      aiMove();
      if (win(2)) { over = true; $('#gm-status').textContent = 'AI 获胜'; paint(); return; }
      paint();
      $('#gm-status').textContent = '轮到你落子';
    };
    const reset = () => { board = new Array(N * N).fill(0); over = false; $('#gm-status').textContent = '点击棋盘落子'; paint(); };
    cv.addEventListener('click', click);
    $('#gm-new').onclick = reset;
    reset();
  },

  /* ================= 反应力测试 ================= */
  'reaction-test'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="rt-tabs"><button class="tab active" data-i="0">反应速度</button><button class="tab" data-i="1">舒尔特方格</button><button class="tab" data-i="2">色感测试</button></div>
        <div class="panel" id="rt-p0">
          <div id="rt-box" style="height:220px;border-radius:12px;background:#7f1d1d;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;cursor:pointer;user-select:none">点击开始</div>
          <div class="hint" id="rt-info" style="margin-top:8px">变绿后尽快点击</div>
        </div>
        <div class="panel hidden" id="rt-p1">
          <div class="row"><button class="btn primary" id="rt-schulte">生成 5×5</button><span class="hint" id="rt-schulte-info">按 1–25 顺序点击</span></div>
          <div id="rt-grid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:10px"></div>
        </div>
        <div class="panel hidden" id="rt-p2">
          <div class="center"><div id="rt-word" style="font-size:40px;font-weight:800">颜色</div><div class="row" id="rt-opts" style="justify-content:center;margin-top:14px"></div><div class="hint" id="rt-color-info" style="margin-top:8px">选择文字的颜色，而不是字义</div></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#rt-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#rt-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      [0, 1, 2].forEach((i) => $('#rt-p' + i).classList.toggle('hidden', String(i) !== b.dataset.i));
    });
    let state = 'idle', startAt = 0, timeout = null;
    $('#rt-box').onclick = () => {
      if (state === 'idle') {
        state = 'wait';
        $('#rt-box').style.background = '#7f1d1d';
        $('#rt-box').textContent = '等待变绿…';
        timeout = setTimeout(() => {
          state = 'go'; startAt = performance.now();
          $('#rt-box').style.background = '#065f46';
          $('#rt-box').textContent = '点！';
        }, 1200 + Math.random() * 2500);
      } else if (state === 'wait') {
        clearTimeout(timeout); state = 'idle';
        $('#rt-box').style.background = '#7f1d1d'; $('#rt-box').textContent = '太早了，点击重试';
        $('#rt-info').textContent = '请等待变绿后再点击';
      } else if (state === 'go') {
        const ms = Math.round(performance.now() - startAt);
        state = 'idle';
        $('#rt-box').style.background = 'var(--panel-2)';
        $('#rt-box').textContent = `${ms} ms`;
        $('#rt-info').textContent = `你的反应时间：${ms} ms · 点击再来一次`;
      }
    };
    let nextNum = 1;
    $('#rt-schulte').onclick = () => {
      nextNum = 1;
      const nums = shuffle([...Array(25).keys()].map((x) => x + 1));
      $('#rt-grid').innerHTML = nums.map((n) => `<button class="btn" data-n="${n}" style="height:56px">${n}</button>`).join('');
      $('#rt-schulte-info').textContent = '按 1–25 顺序点击';
      root.querySelectorAll('[data-n]').forEach((b) => b.addEventListener('click', () => {
        if (Number(b.dataset.n) === nextNum) {
          b.disabled = true; b.style.opacity = '.4';
          nextNum++;
          if (nextNum > 25) $('#rt-schulte-info').textContent = '完成！';
          else $('#rt-schulte-info').textContent = `下一个：${nextNum}`;
        } else {
          b.style.borderColor = 'var(--err)';
        }
      }));
    };
    const COLORS = [['红', '#fb7185'], ['绿', '#34d399'], ['蓝', '#38bdf8'], ['黄', '#fbbf24'], ['紫', '#c084fc']];
    const colorQuiz = () => {
      const word = COLORS[Math.floor(Math.random() * COLORS.length)];
      const ink = COLORS[Math.floor(Math.random() * COLORS.length)];
      $('#rt-word').textContent = word[0];
      $('#rt-word').style.color = ink[1];
      $('#rt-opts').innerHTML = shuffle(COLORS).slice(0, 4).map((c) => `<button class="btn" data-color="${c[0]}">${c[0]}</button>`).join('');
      root.querySelectorAll('[data-color]').forEach((b) => b.addEventListener('click', () => {
        $('#rt-color-info').textContent = b.dataset.color === ink[0] ? '正确！' : `错误，文字颜色是${ink[0]}`;
        setTimeout(colorQuiz, 700);
      }));
    };
    colorQuiz();
  },

  /* ================= 快捷键 ================= */
  'shortcut-ref'(root) {
    const data = {
      Windows: [['Ctrl + C', '复制'], ['Ctrl + V', '粘贴'], ['Ctrl + X', '剪切'], ['Ctrl + Z', '撤销'], ['Ctrl + Shift + Z', '重做'], ['Alt + Tab', '切换窗口'], ['Win + D', '显示桌面'], ['Win + L', '锁定电脑'], ['Win + E', '打开资源管理器'], ['Ctrl + Shift + Esc', '任务管理器'], ['F2', '重命名'], ['Shift + Delete', '永久删除']],
      macOS: [['⌘ + C', '复制'], ['⌘ + V', '粘贴'], ['⌘ + Z', '撤销'], ['⌘ + Shift + Z', '重做'], ['⌘ + Tab', '切换应用'], ['⌘ + Space', '聚焦搜索'], ['⌘ + Q', '退出应用'], ['⌘ + W', '关闭窗口'], ['⌘ + Shift + 4', '区域截图']],
      'VS Code': [['Ctrl + P', '快速打开文件'], ['Ctrl + Shift + P', '命令面板'], ['Ctrl + `', '终端'], ['Ctrl + B', '侧边栏'], ['F2', '重命名符号'], ['Alt + ↑/↓', '移动行'], ['Ctrl + /', '注释'], ['Ctrl + D', '选择下一个相同项'], ['Ctrl + Shift + F', '全局搜索']],
      浏览器: [['Ctrl + T', '新标签页'], ['Ctrl + W', '关闭标签页'], ['Ctrl + Shift + T', '恢复关闭的标签'], ['Ctrl + L', '聚焦地址栏'], ['Ctrl + F', '页面查找'], ['Ctrl + Shift + N', '无痕窗口'], ['F12', '开发者工具'], ['Ctrl + 0', '重置缩放'], ['Ctrl + Shift + K', '打开本工具搜索（本站）']]
    };
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel"><input class="inp" id="sc-search" placeholder="搜索快捷键或功能…"></div>
        <div id="sc-area" class="tool-ui"></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const paint = () => {
      const q = $('#sc-search').value.trim().toLowerCase();
      $('#sc-area').innerHTML = Object.entries(data).map(([group, rows]) => {
        const list = rows.filter(([k, v]) => !q || k.toLowerCase().includes(q) || v.includes(q));
        return list.length ? `<div class="panel"><div class="panel-head"><b>${group}</b><span class="hint">${list.length} 条</span></div>${list.map(([k, v]) => `<div class="row between" style="border-bottom:1px solid var(--line);padding:5px 0"><span class="mono" style="color:var(--acc)">${esc(k)}</span><span class="hint">${esc(v)}</span></div>`).join('')}</div>` : '';
      }).join('') || '<div class="empty">没有匹配的快捷键</div>';
    };
    $('#sc-search').addEventListener('input', paint);
    paint();
  },

  /* ================= 公式预览 ================= */
  'latex-preview'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>LaTeX 公式预览</b><span class="hint">KaTeX 本地渲染</span></div>
          <textarea class="ta mono" id="lx-in" rows="4">\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}</textarea>
          <div class="row" style="margin-top:9px">
            <button class="btn" data-ex="\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}">求根公式</button>
            <button class="btn" data-ex="e^{i\\pi} + 1 = 0">欧拉恒等式</button>
            <button class="btn" data-ex="\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}">巴塞尔问题</button>
            <button class="btn" data-ex="\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}">矩阵</button>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>预览</b></div><div id="lx-out" class="canvas-wrap" style="padding:22px;font-size:20px">渲染结果</div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const render = async () => {
      try {
        await ctx.deps(['katex', 'katexCss']);
        $('#lx-out').innerHTML = window.katex.renderToString($('#lx-in').value, { displayMode: true, throwOnError: false });
      } catch (e) { $('#lx-out').textContent = '渲染失败：' + e.message; }
    };
    $('#lx-in').addEventListener('input', render);
    root.querySelectorAll('[data-ex]').forEach((b) => b.addEventListener('click', () => { $('#lx-in').value = b.dataset.ex; render(); }));
    render();
  }
};
