/* 随机、抽奖与生成器 */
import { esc, copy, toast, download } from '../core/ui.js';
import { pick, randInt } from '../core/rand.js';
import { uid } from '../core/ui.js';

function cryptoInt(max) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % max;
}

export default {
  /* ================= 随机数与颜色 ================= */
  'random-basic'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="grid4">
            <div class="field"><label class="lab">最小值</label><input class="inp" id="rb-min" type="number" value="1"></div>
            <div class="field"><label class="lab">最大值</label><input class="inp" id="rb-max" type="number" value="100"></div>
            <div class="field"><label class="lab">数量</label><input class="inp" id="rb-count" type="number" value="5"></div>
            <div class="field"><label class="lab">小数位</label><input class="inp" id="rb-dec" type="number" value="0" min="0" max="8"></div>
          </div>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="rb-run">生成随机数</button><button class="btn" id="rb-color">随机颜色</button><button class="btn" id="rb-copy">复制</button></div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b></div><pre class="out" id="rb-out"></pre></div>
        <div class="panel"><div class="panel-head"><b>随机色板</b><span class="hint">点击复制色值</span></div><div id="rb-palette" class="row"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const gen = () => {
      const min = Number($('#rb-min').value), max = Number($('#rb-max').value);
      const count = Math.max(1, Math.min(200, Number($('#rb-count').value) || 5));
      const dec = Math.max(0, Math.min(8, Number($('#rb-dec').value) || 0));
      const out = [];
      for (let i = 0; i < count; i++) {
        const v = min + Math.random() * (max - min);
        out.push(dec ? v.toFixed(dec) : Math.round(v));
      }
      $('#rb-out').textContent = out.join('\n');
    };
    const color = () => {
      const hex = () => '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
      const list = Array.from({ length: 12 }, hex);
      $('#rb-palette').innerHTML = list.map((c) => `<div class="center" style="cursor:pointer" data-color="${c}"><div style="width:52px;height:52px;border-radius:10px;background:${c};border:1px solid var(--line)"></div><div class="hint" style="font-size:9px">${c}</div></div>`).join('');
      root.querySelectorAll('[data-color]').forEach((el) => el.addEventListener('click', () => copy(el.dataset.color)));
      $('#rb-out').textContent = list.join('\n');
    };
    $('#rb-run').onclick = gen;
    $('#rb-color').onclick = color;
    $('#rb-copy').onclick = () => copy($('#rb-out').textContent);
    gen(); color();
  },

  /* ================= 随机身份 ================= */
  'random-person'(root) {
    const first = ['张', '王', '李', '赵', '陈', '刘', '杨', '黄', '周', '吴', '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗'];
    const last = ['伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '涛', '明', '超', '秀英', '霞', '平', '刚'];
    const en = ['James', 'Olivia', 'Liam', 'Emma', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Lucas', 'Mia', 'Mason', 'Isabella'];
    const company = ['空天', '星轨', '云图', '轻舟', '远山', '拾光', '鸣石', '青岚'];
    const suffix = ['科技有限公司', '网络科技', '数据服务', '设计工作室', '文化传媒'];
    const cities = ['北京市朝阳区', '上海市浦东新区', '深圳市南山区', '杭州市西湖区', '成都市高新区', '广州市天河区'];
    const streets = ['科技路', '创新街', '建设大道', '人民路', '滨江路'];
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="row"><label class="lab" style="margin:0">数量</label><input class="inp" id="rp-count" type="number" value="5" style="max-width:100px">
          <button class="btn primary" id="rp-run">生成</button><button class="btn" id="rp-copy">复制</button><button class="btn" id="rp-json">复制 JSON</button></div>
          <div class="hint" style="margin-top:7px">仅用于测试与占位，电话号码使用不可用的测试号段。</div>
        </div>
        <div class="panel"><div class="table-scroll"><table class="tbl" id="rp-table"></table></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let data = [];
    const gen = () => {
      const count = Math.max(1, Math.min(100, Number($('#rp-count').value) || 5));
      data = Array.from({ length: count }, (_, i) => ({
        name: pick(first) + pick(last),
        en: pick(en) + ' ' + pick(['Smith', 'Johnson', 'Brown', 'Davis', 'Wilson']),
        company: pick(company) + pick(suffix),
        email: `user${randInt(9000) + 1000}@example.com`,
        phone: '138' + String(randInt(100000000)).padStart(8, '0'),
        address: pick(cities) + pick(streets) + (randInt(200) + 1) + '号',
        id: 1000 + i
      }));
      $('#rp-table').innerHTML = `<tr><th>#</th><th>姓名</th><th>英文名</th><th>公司</th><th>邮箱</th><th>手机</th><th>地址</th></tr>${data.map((d) => `<tr><td>${d.id}</td><td>${esc(d.name)}</td><td>${esc(d.en)}</td><td>${esc(d.company)}</td><td class="mono">${esc(d.email)}</td><td class="mono">${d.phone}</td><td>${esc(d.address)}</td></tr>`).join('')}`;
    };
    $('#rp-run').onclick = gen;
    $('#rp-copy').onclick = () => copy(data.map((d) => `${d.name}\t${d.email}\t${d.phone}\t${d.address}`).join('\n'));
    $('#rp-json').onclick = () => copy(JSON.stringify(data, null, 2));
    gen();
  },

  /* ================= 随机文案 ================= */
  'lorem-gen'(root) {
    const zh = ['空天工具把常用的文本、图片、编码与计算功能放进浏览器，打开就能用。', '所有文件都在本地处理，不会上传到服务器。', '依赖只在打开对应功能时加载，并在界面中显示下载进度。', '手机和电脑使用同一套界面，功能完全一致。', '没有账号、没有追踪，也没有隐藏的上传。'];
    const quotes = ['简单是可靠的前提。', '任何足够先进的技术都与魔法无异。', '把复杂留给自己，把简单留给用户。', '先让它跑起来，再让它跑得更好。', '真正的效率，是少做无用的事。'];
    const poems = ['海上生明月，天涯共此时。', '会当凌绝顶，一览众山小。', '长风破浪会有时，直挂云帆济沧海。', '山重水复疑无路，柳暗花明又一村。', '落霞与孤鹜齐飞，秋水共长天一色。'];
    const jokes = ['程序员最讨厌的两件事：写文档，和别人的代码没有文档。', '为什么代码能跑？因为它不敢不跑。', '调试：你以为在找 bug，其实是 bug 在找你。'];
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="row">
            <select class="sel" id="lg-type" style="max-width:150px"><option value="lorem">Lorem Ipsum</option><option value="zh">中文段落</option><option value="quote">名言</option><option value="poem">诗词</option><option value="joke">冷笑话</option></select>
            <input class="inp" id="lg-count" type="number" value="3" style="max-width:90px">
            <button class="btn primary" id="lg-run">生成</button><button class="btn" id="lg-copy">复制</button>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b></div><pre class="out" id="lg-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const loremWords = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat'.split(' ');
    $('#lg-run').onclick = () => {
      const type = $('#lg-type').value;
      const count = Math.max(1, Math.min(20, Number($('#lg-count').value) || 3));
      let out;
      if (type === 'lorem') out = Array.from({ length: count }, () => {
        const len = 25 + randInt(30);
        return Array.from({ length: len }, () => pick(loremWords)).join(' ').replace(/^./, (c) => c.toUpperCase()) + '.';
      }).join('\n\n');
      else if (type === 'zh') out = Array.from({ length: count }, () => pick(zh) + pick(zh)).join('\n\n');
      else if (type === 'quote') out = Array.from({ length: count }, () => pick(quotes)).join('\n');
      else if (type === 'poem') out = Array.from({ length: count }, () => pick(poems)).join('\n');
      else out = Array.from({ length: count }, () => pick(jokes)).join('\n');
      $('#lg-out').textContent = out;
    };
    $('#lg-copy').onclick = () => copy($('#lg-out').textContent);
    $('#lg-run').click();
  },

  /* ================= 假数据 JSON ================= */
  'fake-json'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="grid3">
            <div class="field"><label class="lab">结构</label><select class="sel" id="fj-type"><option value="user">用户</option><option value="order">订单</option><option value="product">商品</option><option value="article">文章</option></select></div>
            <div class="field"><label class="lab">数量</label><input class="inp" id="fj-count" type="number" value="3"></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="fj-run" style="width:100%">生成</button></div>
          </div>
          <div class="row" style="margin-top:9px"><button class="btn" id="fj-copy">复制</button><button class="btn" id="fj-dl">下载 JSON</button></div>
        </div>
        <div class="panel"><pre class="out" id="fj-out" style="max-height:500px"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const names = ['小明', '小红', '小刚', '小丽', '阿杰', '阿敏'];
    const words = ['空天', '工具', '效率', '浏览器', '本地', '隐私', '设计', '数据'];
    const stamp = () => new Date(Date.now() - randInt(30) * 864e5).toISOString();
    $('#fj-run').onclick = () => {
      const n = Math.max(1, Math.min(50, Number($('#fj-count').value) || 3));
      const type = $('#fj-type').value;
      const data = Array.from({ length: n }, (_, i) => {
        if (type === 'user') return { id: 100 + i, name: pick(names), email: `user${i + 1}@example.com`, avatar: `https://example.com/avatar/${i + 1}.png`, roles: ['user'], profile: { city: pick(['北京', '上海', '深圳']), bio: pick(words) + '爱好者' }, createdAt: stamp() };
        if (type === 'order') return { id: 'ORD' + (10000 + i), userId: 100 + randInt(20), items: [{ sku: 'SKU-' + (100 + randInt(50)), qty: 1 + randInt(3), price: +(Math.random() * 200 + 10).toFixed(2) }], total: +(Math.random() * 500 + 20).toFixed(2), status: pick(['pending', 'paid', 'shipped', 'completed']), createdAt: stamp() };
        if (type === 'product') return { id: 'P' + (1000 + i), title: pick(words) + pick(['工具箱', '会员', '套装']), price: +(Math.random() * 300 + 9.9).toFixed(2), stock: randInt(300), categories: [pick(words)], onSale: Math.random() > 0.2, createdAt: stamp() };
        return { id: i + 1, title: pick(words) + '的' + pick(['实践', '笔记', '指南']), author: { id: 100 + i, name: pick(names) }, tags: [pick(words), pick(words)], views: randInt(5000), content: pick(words) + '是本文的主题。', publishedAt: stamp() };
      });
      $('#fj-out').textContent = JSON.stringify(type === 'user' ? data[0] : data, null, 2);
    };
    $('#fj-copy').onclick = () => copy($('#fj-out').textContent);
    $('#fj-dl').onclick = () => download('mock.json', $('#fj-out').textContent, 'application/json');
    $('#fj-run').click();
  },

  /* ================= 随机分组与点名 ================= */
  'random-group'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>名单</b><span class="hint">每行一个名字</span></div>
          <textarea class="ta" id="rg-names" rows="6">小明
小红
小刚
小丽
阿杰
阿敏
小雨
小云</textarea>
          <div class="grid3" style="margin-top:9px">
            <div class="field"><label class="lab">分组数</label><input class="inp" id="rg-groups" type="number" value="2"></div>
            <div class="field"><label class="lab">操作</label><select class="sel" id="rg-mode"><option value="group">随机分组</option><option value="pick">随机点名</option><option value="shuffle">打乱顺序</option></select></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="rg-run" style="width:100%">执行</button></div>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b><span class="hint" id="rg-meta"></span></div><div id="rg-out"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = randInt(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
    $('#rg-run').onclick = () => {
      const list = $('#rg-names').value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
      if (!list.length) return toast('请填写名单', 'err');
      const mode = $('#rg-mode').value;
      if (mode === 'pick') {
        const name = pick(list);
        $('#rg-out').innerHTML = `<div class="center" style="padding:18px"><div style="font-size:40px;font-weight:800;color:var(--acc)">${esc(name)}</div><div class="hint">被选中</div></div>`;
        $('#rg-meta').textContent = `共 ${list.length} 人`;
        return;
      }
      if (mode === 'shuffle') {
        $('#rg-out').innerHTML = `<div class="row" style="gap:7px">${shuffle(list).map((x, i) => `<span class="chip">${i + 1}. ${esc(x)}</span>`).join('')}</div>`;
        $('#rg-meta').textContent = '已打乱';
        return;
      }
      const g = Math.max(1, Math.min(list.length, Number($('#rg-groups').value) || 2));
      const groups = Array.from({ length: g }, () => []);
      shuffle(list).forEach((name, i) => groups[i % g].push(name));
      $('#rg-out').innerHTML = `<div class="grid2">${groups.map((grp, i) => `<div class="panel tight"><div class="panel-head"><b>第 ${i + 1} 组</b><span class="hint">${grp.length} 人</span></div><div class="row" style="gap:5px">${grp.map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div></div>`).join('')}</div>`;
      $('#rg-meta').textContent = `${list.length} 人 · ${g} 组`;
    };
    $('#rg-run').click();
  },

  /* ================= 抽奖转盘 ================= */
  'wheel'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>奖项</b><span class="hint">每行一个，最多 12 个</span></div>
          <textarea class="ta" id="wh-items" rows="5">一等奖
二等奖
三等奖
谢谢参与
再来一次
神秘礼物</textarea>
          <div class="row" style="margin-top:9px"><button class="btn primary" id="wh-spin">开始抽奖</button><span class="hint" id="wh-result"></span></div>
        </div>
        <div class="panel center"><canvas id="wh-canvas" width="360" height="360" style="max-width:100%"></canvas></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let angle = 0, spinning = false;
    const colors = ['#38cdf0', '#818cf8', '#34d399', '#fbbf24', '#f472b6', '#a78bfa'];
    const draw = () => {
      const items = $('#wh-items').value.split(/\r?\n/).filter((x) => x.trim()).slice(0, 12);
      const cv = $('#wh-canvas'), g = cv.getContext('2d');
      const W = cv.width, cx = W / 2, cy = W / 2, R = W / 2 - 16;
      g.clearRect(0, 0, W, W);
      if (!items.length) return;
      const step = Math.PI * 2 / items.length;
      items.forEach((item, i) => {
        const a0 = angle + i * step;
        g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, a0, a0 + step); g.closePath();
        g.fillStyle = colors[i % colors.length] + 'cc'; g.fill();
        g.strokeStyle = '#0b1220'; g.lineWidth = 2; g.stroke();
        g.save(); g.translate(cx, cy); g.rotate(a0 + step / 2);
        g.fillStyle = '#071018'; g.font = '600 14px -apple-system, "PingFang SC", sans-serif'; g.textAlign = 'right'; g.textBaseline = 'middle';
        g.fillText(item.slice(0, 8), R - 14, 0);
        g.restore();
      });
      g.beginPath(); g.arc(cx, cy, 34, 0, Math.PI * 2); g.fillStyle = '#0e1626'; g.fill();
      g.strokeStyle = '#38cdf0'; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#e9eefc'; g.font = '700 15px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('抽奖', cx, cy);
      g.beginPath(); g.moveTo(cx, 10); g.lineTo(cx - 10, 30); g.lineTo(cx + 10, 30); g.closePath(); g.fillStyle = '#fbbf24'; g.fill();
    };
    $('#wh-spin').onclick = () => {
      if (spinning) return;
      const items = $('#wh-items').value.split(/\r?\n/).filter((x) => x.trim());
      if (items.length < 2) return toast('至少需要两个奖项', 'err');
      spinning = true;
      $('#wh-result').textContent = '转动中…';
      const start = angle;
      const target = angle + Math.PI * 2 * (4 + Math.random() * 3) + Math.random() * Math.PI * 2;
      const t0 = performance.now();
      const dur = 3200;
      const frame = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        const ease = 1 - (1 - p) ** 3;
        angle = start + (target - start) * ease;
        draw();
        if (p < 1) requestAnimationFrame(frame);
        else {
          spinning = false;
          const step = Math.PI * 2 / items.length;
          const norm = ((Math.PI * 1.5 - angle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
          const idx = Math.floor(norm / step) % items.length;
          $('#wh-result').innerHTML = `抽中：<b style="color:var(--acc);font-size:18px">${esc(items[idx])}</b>`;
        }
      };
      requestAnimationFrame(frame);
    };
    $('#wh-items').addEventListener('input', draw);
    draw();
  },

  /* ================= 骰子与决定器 ================= */
  'dice-coin'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="dc-tabs"><button class="tab active" data-i="0">骰子</button><button class="tab" data-i="1">硬币</button><button class="tab" data-i="2">猜拳</button><button class="tab" data-i="3">决定器</button></div>
        <div class="panel center" id="dc-p0" style="padding:30px">
          <div id="dc-dice" style="font-size:64px;line-height:1;font-family:var(--mono);color:var(--acc);font-weight:800">?</div>
          <button class="btn primary" id="dc-roll" style="margin-top:16px">掷骰子</button>
          <div class="hint" id="dc-dice-out" style="margin-top:10px"></div>
        </div>
        <div class="panel center hidden" id="dc-p1" style="padding:30px">
          <div id="dc-coin" style="font-size:52px;line-height:1;font-weight:800;color:var(--warn)">?</div>
          <button class="btn primary" id="dc-flip" style="margin-top:16px">抛硬币</button>
          <div class="hint" id="dc-coin-out" style="margin-top:10px"></div>
        </div>
        <div class="panel center hidden" id="dc-p2" style="padding:30px">
          <div class="row" style="justify-content:center;gap:10px">
            <button class="btn" data-rps="石头" style="font-size:18px">石头</button>
            <button class="btn" data-rps="剪刀" style="font-size:18px">剪刀</button>
            <button class="btn" data-rps="布" style="font-size:18px">布</button>
          </div>
          <div id="dc-rps-out" style="margin-top:18px;font-size:18px"></div>
        </div>
        <div class="panel hidden" id="dc-p3">
          <div class="field"><label class="lab">选项（每行一个）</label><textarea class="ta" id="dc-options" rows="5">吃火锅
吃烧烤
吃面
点外卖</textarea></div>
          <button class="btn primary" id="dc-decide" style="margin-top:10px">帮我决定</button>
          <div id="dc-decide-out" class="center" style="margin-top:14px;font-size:26px;color:var(--acc);font-weight:700"></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#dc-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#dc-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      [0, 1, 2, 3].forEach((i) => $('#dc-p' + i).classList.toggle('hidden', String(i) !== b.dataset.i));
    });
    $('#dc-roll').onclick = () => { const v = randInt(6) + 1; $('#dc-dice').textContent = String(v); $('#dc-dice-out').textContent = `结果：${v}`; };
    $('#dc-flip').onclick = () => { const v = Math.random() > 0.5 ? '正面' : '反面'; $('#dc-coin').textContent = v; $('#dc-coin-out').textContent = `结果：${v}`; };
    root.querySelectorAll('[data-rps]').forEach((b) => b.addEventListener('click', () => {
      const ai = pick(['石头', '剪刀', '布']);
      const me = b.dataset.rps;
      const win = (me === '石头' && ai === '剪刀') || (me === '剪刀' && ai === '布') || (me === '布' && ai === '石头');
      $('#dc-rps-out').innerHTML = `你出 <b>${me}</b>，电脑出 <b>${ai}</b><br><span style="color:${win ? 'var(--ok)' : me === ai ? 'var(--warn)' : 'var(--err)'};font-size:22px">${win ? '你赢了' : me === ai ? '平局' : '你输了'}</span>`;
    }));
    $('#dc-decide').onclick = () => {
      const opts = $('#dc-options').value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
      if (!opts.length) return toast('请填写选项', 'err');
      $('#dc-decide-out').textContent = pick(opts);
    };
  },

  /* ================= 占位图 ================= */
  'placeholder-gen'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="grid4">
            <div class="field"><label class="lab">宽度</label><input class="inp" id="ph-w" type="number" value="800"></div>
            <div class="field"><label class="lab">高度</label><input class="inp" id="ph-h" type="number" value="450"></div>
            <div class="field"><label class="lab">背景色</label><input class="inp" id="ph-bg" type="color" value="#0e1626"></div>
            <div class="field"><label class="lab">文字色</label><input class="inp" id="ph-fg" type="color" value="#38cdf0"></div>
          </div>
          <div class="grid2" style="margin-top:9px">
            <div class="field"><label class="lab">文字</label><input class="inp" id="ph-text" value="800 × 450"></div>
            <div class="field"><label class="lab">字体大小</label><input class="inp" id="ph-size" type="number" value="42"></div>
          </div>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="ph-run">生成</button><button class="btn" id="ph-png">下载 PNG</button><button class="btn" id="ph-svg">下载 SVG</button></div>
        </div>
        <div class="panel"><div class="canvas-wrap" id="ph-preview"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let svg = '';
    const gen = () => {
      const w = Math.max(16, Math.min(4000, Number($('#ph-w').value) || 800));
      const h = Math.max(16, Math.min(4000, Number($('#ph-h').value) || 450));
      const bg = $('#ph-bg').value, fg = $('#ph-fg').value;
      const text = $('#ph-text').value || `${w} × ${h}`;
      const size = Number($('#ph-size').value) || 42;
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="${bg}"/><text x="50%" y="50%" fill="${fg}" font-family="-apple-system,'PingFang SC',sans-serif" font-size="${size}" font-weight="700" text-anchor="middle" dominant-baseline="middle">${esc(text)}</text></svg>`;
      $('#ph-preview').innerHTML = svg;
    };
    $('#ph-run').onclick = gen;
    $('#ph-png').onclick = () => {
      const svgEl = $('#ph-preview svg');
      const img = new Image();
      const data = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
      img.onload = () => {
        const cv = document.createElement('canvas');
        cv.width = img.width; cv.height = img.height;
        cv.getContext('2d').drawImage(img, 0, 0);
        cv.toBlob((b) => download(`placeholder-${img.width}x${img.height}.png`, b));
      };
      img.src = data;
    };
    $('#ph-svg').onclick = () => download('placeholder.svg', svg, 'image/svg+xml');
    gen();
  },

  /* ================= 邀请码 ================= */
  'coupon-gen'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="grid4">
            <div class="field"><label class="lab">格式</label><input class="inp mono" id="cg-fmt" value="KT-XXXX-XXXX"></div>
            <div class="field"><label class="lab">字符集</label><select class="sel" id="cg-charset"><option value="upper">大写字母+数字</option><option value="alnum">大小写+数字</option><option value="digit">纯数字</option></select></div>
            <div class="field"><label class="lab">数量</label><input class="inp" id="cg-count" type="number" value="10"></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="cg-run" style="width:100%">生成</button></div>
          </div>
          <div class="row" style="margin-top:9px"><button class="btn" id="cg-copy">复制</button><button class="btn" id="cg-csv">下载 CSV</button><span class="hint">X 会被替换为随机字符</span></div>
        </div>
        <div class="panel"><pre class="out" id="cg-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#cg-run').onclick = () => {
      const fmt = $('#cg-fmt').value || 'XXXX';
      const charset = $('#cg-charset').value === 'digit' ? '0123456789' : $('#cg-charset').value === 'alnum' ? 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789' : 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const count = Math.max(1, Math.min(1000, Number($('#cg-count').value) || 10));
      const set = new Set();
      while (set.size < count) {
        set.add([...fmt].map((c) => c === 'X' ? charset[randInt(charset.length)] : c).join(''));
      }
      $('#cg-out').textContent = [...set].join('\n');
    };
    $('#cg-copy').onclick = () => copy($('#cg-out').textContent);
    $('#cg-csv').onclick = () => download('codes.csv', 'code\n' + $('#cg-out').textContent.split('\n').join('\n'), 'text/csv');
    $('#cg-run').click();
  },

  /* ================= 塔罗与星座 ================= */
  'tarot'(root) {
    const cards = [
      ['愚者', '新的开始、冒险、纯真、未知的旅程'], ['魔术师', '创造力、行动力、资源整合'], ['女祭司', '直觉、潜意识、内在智慧'],
      ['皇后', '丰盛、滋养、创造力、母性'], ['皇帝', '秩序、权威、稳定、掌控'], ['教皇', '传统、指引、学习、信念'],
      ['恋人', '选择、关系、价值观一致'], ['战车', '意志力、前进、胜利'], ['力量', '勇气、耐心、内在力量'],
      ['隐士', '内省、独处、寻找答案'], ['命运之轮', '转机、循环、时机'], ['正义', '公平、因果、平衡'],
      ['倒吊人', '暂停、换位思考、牺牲'], ['死神', '结束与重生、转变'], ['节制', '平衡、协调、节奏'],
      ['恶魔', '欲望、束缚、执念'], ['高塔', '突变、打破、觉醒'], ['星星', '希望、疗愈、灵感'],
      ['月亮', '迷茫、潜意识、不确定'], ['太阳', '成功、活力、清晰'], ['审判', '复盘、召唤、重生'], ['世界', '完成、圆满、整合']
    ];
    const signs = ['白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座', '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座'];
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="tr-tabs"><button class="tab active" data-i="0">塔罗牌</button><button class="tab" data-i="1">星座运势</button><button class="tab" data-i="2">MBTI 随机</button></div>
        <div class="panel center" id="tr-p0" style="padding:28px">
          <div id="tr-card" style="width:180px;height:280px;margin:0 auto;border-radius:14px;border:1px solid rgba(56,205,240,.4);background:linear-gradient(160deg,rgba(56,205,240,.15),rgba(129,140,248,.1));display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:var(--acc)">点击抽牌</div>
          <button class="btn primary" id="tr-draw" style="margin-top:16px">抽一张</button>
          <div id="tr-meaning" class="hint" style="margin-top:14px;max-width:420px;margin-left:auto;margin-right:auto"></div>
        </div>
        <div class="panel hidden" id="tr-p1">
          <div class="row"><select class="sel" id="tr-sign" style="max-width:160px">${signs.map((s) => `<option>${s}</option>`).join('')}</select><button class="btn primary" id="tr-horoscope">生成今日运势</button></div>
          <div id="tr-horoscope-out" class="hint" style="margin-top:12px;line-height:1.9"></div>
        </div>
        <div class="panel hidden" id="tr-p2">
          <button class="btn primary" id="tr-mbti">随机 MBTI</button>
          <div id="tr-mbti-out" style="margin-top:12px"></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#tr-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#tr-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      [0, 1, 2].forEach((i) => $('#tr-p' + i).classList.toggle('hidden', String(i) !== b.dataset.i));
    });
    $('#tr-draw').onclick = () => {
      const [name, meaning] = pick(cards);
      $('#tr-card').textContent = name;
      $('#tr-meaning').innerHTML = `<b style="color:var(--text)">${name}</b><br>${esc(meaning)}`;
    };
    $('#tr-horoscope').onclick = () => {
      const sign = $('#tr-sign').value;
      const luck = ['不错', '平稳', '需要一点耐心', '有意外惊喜'];
      const areas = ['工作', '学习', '感情', '财务', '健康'];
      $('#tr-horoscope-out').innerHTML = `<b>${sign} · 今日模板</b><br>` + areas.map((a) => `· ${a}：${pick(luck)}`).join('<br>') + `<br><br>幸运色：${pick(['蓝色', '绿色', '紫色', '橙色'])} · 幸运数字：${randInt(9) + 1}`;
    };
    $('#tr-mbti').onclick = () => {
      const types = ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'];
      const desc = { I: '内倾', E: '外倾', N: '直觉', S: '实感', T: '思考', F: '情感', J: '判断', P: '知觉' };
      const t = pick(types);
      $('#tr-mbti-out').innerHTML = `<div style="font-size:34px;font-weight:800;color:var(--acc)">${t}</div><div class="hint">${[...t].map((c) => desc[c]).join(' · ')}</div><div class="hint" style="margin-top:7px">随机结果，仅供娱乐。</div>`;
    };
  }
};
