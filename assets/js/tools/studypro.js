/* 语言学习、成语词汇、教育行政与学术引用 */
import { esc, copy, toast, download } from '../core/ui.js';
import { templateWorkbench } from '../core/workbench.js';

const $ = (root, s) => root.querySelector(s);

const GODAN = { う: ['います', 'って', 'った', 'わない', 'える', 'おう', 'われる', 'わされる'], く: ['きます', 'いて', 'いた', 'かない', 'ける', 'こう', 'かれる', 'かされる'], ぐ: ['ぎます', 'いで', 'いだ', 'がない', 'げる', 'ごう', 'がれる', 'がされる'], す: ['します', 'して', 'した', 'さない', 'せる', 'そう', 'される', 'させる'], つ: ['ちます', 'って', 'った', 'たない', 'てる', 'とう', 'たれる', 'たされる'], ぬ: ['にます', 'んで', 'んだ', 'なない', 'ねる', 'のう', 'なれる', 'なされる'], ぶ: ['びます', 'んで', 'んだ', 'ばない', 'べる', 'ぼう', 'ばれる', 'ばされる'], む: ['みます', 'んで', 'んだ', 'まない', 'める', 'もう', 'まれる', 'まされる'], る: ['ります', 'って', 'った', 'らない', 'れる', 'ろう', 'られる', 'らされる'] };
const ICHIDAN = ['ます', 'て', 'た', 'ない', 'られる', 'よう', 'られる', 'させる'];

function jpVerb(v) {
  if (v === 'する') return ['します', 'して', 'した', 'しない', 'できる', 'しよう', 'される', 'させる'];
  if (v === '来る' || v === 'くる') return ['来ます', '来て', '来た', '来ない', '来られる', '来よう', '来られる', '来させる'];
  if (v.endsWith('る') && /[いきぎしじちぢにひびぴみりえけげせぜてでねへべぺめれ]る$/.test(v)) return ICHIDAN.map((e) => v.slice(0, -1) + e);
  const end = v.slice(-1);
  if (GODAN[end]) return GODAN[end].map((e) => v.slice(0, -1) + e);
  return null;
}

const IDIOMS = ['一心一意', '意气风发', '发扬光大', '大公无私', '私心杂念', '念念不忘', '忘乎所以', '以身作则', '则无旁贷', '贷无止境', '镜花水月', '月下老人', '人山人海', '海阔天空', '空穴来风', '风平浪静', '静水流深', '深入浅出', '出类拔萃', '萃聚一堂', '堂堂正正', '正大光明', '明察秋毫', '毫不犹豫', '豫备不虞', '虞诈我虞', '愚公移山', '山清水秀', '秀外慧中', '中流砥柱'];
const SYN = { '快乐': '高兴、愉快、欢喜', '美丽': '漂亮、秀丽、俊美', '聪明': '机智、聪慧、伶俐', '安静': '宁静、寂静、平静', '勇敢': '英勇、无畏、果敢', '困难': '艰难、困苦、棘手', '迅速': '快速、飞快、敏捷', '重要': '关键、要紧、重大' };
const ANTO = { '快乐': '悲伤、痛苦', '美丽': '丑陋、难看', '聪明': '愚笨、迟钝', '安静': '喧闹、嘈杂', '勇敢': '怯懦、胆小', '困难': '容易、简单', '迅速': '缓慢、迟缓', '重要': '次要、无关紧要' };
const ROOTS = [['anti-', '反对', 'antibody 抗体'], ['auto-', '自己', 'automatic 自动的'], ['bio-', '生命', 'biology 生物学'], ['chron-', '时间', 'chronology 年表'], ['cycl-', '圆/循环', 'bicycle 自行车'], ['dict-', '说', 'predict 预测'], ['graph-', '写', 'photograph 照片'], ['log-', '言语/学科', 'biology 生物学'], ['mit-', '送', 'transmit 传输'], ['phon-', '声音', 'telephone 电话'], ['port-', '携带', 'transport 运输'], ['scrib-', '写', 'describe 描述'], ['spect-', '看', 'inspect 检查'], ['tele-', '远', 'telescope 望远镜'], ['therm-', '热', 'thermometer 温度计']];

export default {
  /* ================= 语言实验室 ================= */
  'language-lab'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="ll-tabs"><button class="tab active" data-i="0">日语</button><button class="tab" data-i="1">西/法/德</button><button class="tab" data-i="2">英语</button><button class="tab" data-i="3">字符与音标</button></div>
        <div class="panel" id="ll-p0">
          <div class="grid3">
            <div class="field"><label class="lab">词形</label><select class="sel" id="ll-jp-kind"><option value="verb">动词</option><option value="iadj">い形容词</option><option value="naadj">な形容词</option></select></div>
            <div class="field"><label class="lab">辞书形</label><input class="inp" id="ll-jp-word" value="食べる"></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="ll-jp-run" style="width:100%">变形</button></div>
          </div>
          <pre class="out" id="ll-jp-out" style="margin-top:10px"></pre>
        </div>
        <div class="panel hidden" id="ll-p1">
          <div class="grid3">
            <div class="field"><label class="lab">语言</label><select class="sel" id="ll-lang"><option value="es">西班牙语</option><option value="fr">法语</option><option value="de">德语</option></select></div>
            <div class="field"><label class="lab">动词/名词</label><input class="inp" id="ll-word" value="hablar"></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="ll-run" style="width:100%">生成</button></div>
          </div>
          <pre class="out" id="ll-out" style="margin-top:10px"></pre>
        </div>
        <div class="panel hidden" id="ll-p2">
          <div class="grid3">
            <div class="field"><label class="lab">动词</label><input class="inp" id="ll-en-verb" value="write"></div>
            <div class="field"><label class="lab">时态</label><select class="sel" id="ll-en-tense"><option value="present">一般现在时</option><option value="past">一般过去时</option><option value="perfect">现在完成时</option><option value="passive">被动语态</option></select></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="ll-en-run" style="width:100%">变化</button></div>
          </div>
          <pre class="out" id="ll-en-out" style="margin-top:10px"></pre>
        </div>
        <div class="panel hidden" id="ll-p3">
          <div class="row"><select class="sel" id="ll-char" style="max-width:170px"><option value="kana">日语五十音</option><option value="ipa">国际音标</option><option value="kanji">常用汉字</option><option value="alphabet">俄语/阿拉伯语字母</option></select><input class="inp" id="ll-char-q" placeholder="搜索" style="flex:1"></div>
          <div id="ll-char-out" class="tool-ui" style="margin-top:10px"></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#ll-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#ll-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      [0, 1, 2, 3].forEach((i) => $('#ll-p' + i).classList.toggle('hidden', String(i) !== b.dataset.i));
    });
    $('#ll-jp-run').onclick = () => {
      const w = $('#ll-jp-word').value.trim();
      const kind = $('#ll-jp-kind').value;
      try {
        if (kind === 'verb') {
          const f = jpVerb(w);
          if (!f) throw new Error('无法识别动词类型');
          $('#ll-jp-out').textContent = ['ます形', 'て形', 'た形', 'ない形', '可能形', '意志形', '被动形', '使役形'].map((n, i) => `${n}：${f[i]}`).join('\n');
        } else if (kind === 'iadj') {
          const s = w.replace(/い$/, '');
          $('#ll-jp-out').textContent = `否定：${s}くない\n过去：${s}かった\n过去否定：${s}くなかった\nて形：${s}くて\n条件：${s}ければ`;
        } else {
          $('#ll-jp-out').textContent = `否定：${w}ではない\n过去：${w}だった\n过去否定：${w}ではなかった\n修饰：${w}な + 名词\nて形：${w}で`;
        }
      } catch (e) { $('#ll-jp-out').textContent = e.message; }
    };
    $('#ll-run').onclick = () => {
      const lang = $('#ll-lang').value, w = $('#ll-word').value.trim();
      if (lang === 'es') {
        if (!/(ar|er|ir)$/.test(w)) { $('#ll-out').textContent = '请输入 -ar/-er/-ir 结尾的动词原形'; return; }
        const stem = w.slice(0, -2), end = w.slice(-2);
        const endings = end === 'ar' ? ['o', 'as', 'a', 'amos', 'áis', 'an'] : end === 'er' ? ['o', 'es', 'e', 'emos', 'éis', 'en'] : ['o', 'es', 'e', 'imos', 'ís', 'en'];
        $('#ll-out').textContent = ['yo', 'tú', 'él/ella', 'nosotros', 'vosotros', 'ellos'].map((p, i) => `${p}: ${stem}${endings[i]}`).join('\n');
      } else if (lang === 'fr') {
        const vowels = /^[aeiouh]/i.test(w);
        $('#ll-out').textContent = `定冠词：${vowels ? "l'" : 'le/la'} ${w}\n不定冠词：${vowels ? "un/une" : 'un/une'} ${w}\n复数：les ${w}${/s$/.test(w) ? '' : 's'}\n提示：法语名词阴阳性需查词典，此处仅演示冠词形式。`;
      } else {
        $('#ll-out').textContent = `定冠词：der / die / das + ${w}\n不定冠词：ein / eine + ${w}\n复数：die ${w}${/s$/.test(w) ? '' : 'e'}\n提示：德语名词词性需查词典，复合词以最后一个词性为准。`;
      }
    };
    const IRREG = { write: ['wrote', 'written'], go: ['went', 'gone'], see: ['saw', 'seen'], take: ['took', 'taken'], make: ['made', 'made'], do: ['did', 'done'], have: ['had', 'had'], be: ['was', 'been'], run: ['ran', 'run'], read: ['read', 'read'] };
    $('#ll-en-run').onclick = () => {
      const v = $('#ll-en-verb').value.trim().toLowerCase();
      const t = $('#ll-en-tense').value;
      const [past, pp] = IRREG[v] || [v.endsWith('e') ? v + 'd' : v + 'ed', v.endsWith('e') ? v + 'd' : v + 'ed'];
      if (t === 'present') $('#ll-en-out').textContent = `I/you/we/they ${v}\nhe/she/it ${v.endsWith('s') ? v + 'es' : v + 's'}`;
      else if (t === 'past') $('#ll-en-out').textContent = `I/you/he/she/we/they ${past}`;
      else if (t === 'perfect') $('#ll-en-out').textContent = `have/has ${pp}`;
      else $('#ll-en-out').textContent = `am/is/are ${pp}`;
    };
    const CHAR = {
      kana: [['あ', 'a'], ['い', 'i'], ['う', 'u'], ['え', 'e'], ['お', 'o'], ['か', 'ka'], ['き', 'ki'], ['く', 'ku'], ['け', 'ke'], ['こ', 'ko'], ['さ', 'sa'], ['し', 'shi'], ['す', 'su'], ['せ', 'se'], ['そ', 'so'], ['た', 'ta'], ['ち', 'chi'], ['つ', 'tsu'], ['て', 'te'], ['と', 'to'], ['な', 'na'], ['に', 'ni'], ['ぬ', 'nu'], ['ね', 'ne'], ['の', 'no'], ['は', 'ha'], ['ひ', 'hi'], ['ふ', 'fu'], ['へ', 'he'], ['ほ', 'ho'], ['ま', 'ma'], ['み', 'mi'], ['む', 'mu'], ['め', 'me'], ['も', 'mo'], ['や', 'ya'], ['ゆ', 'yu'], ['よ', 'yo'], ['ら', 'ra'], ['り', 'ri'], ['る', 'ru'], ['れ', 're'], ['ろ', 'ro'], ['わ', 'wa'], ['を', 'wo'], ['ん', 'n']],
      ipa: [['iː', 'see'], ['ɪ', 'sit'], ['e', 'bed'], ['æ', 'cat'], ['ɑː', 'car'], ['ɒ', 'hot'], ['ɔː', 'law'], ['ʊ', 'book'], ['uː', 'food'], ['ʌ', 'cup'], ['ɜː', 'bird'], ['ə', 'about'], ['eɪ', 'day'], ['aɪ', 'my'], ['ɔɪ', 'boy'], ['aʊ', 'now'], ['əʊ', 'go'], ['ɪə', 'near'], ['eə', 'hair'], ['ʊə', 'tour']],
      kanji: [['日', 'rì / ひ', '太阳、日子'], ['月', 'yuè / つき', '月亮、月份'], ['水', 'shuǐ / みず', '水'], ['火', 'huǒ / ひ', '火'], ['木', 'mù / き', '树木'], ['金', 'jīn / かね', '金属、钱'], ['土', 'tǔ / つち', '土地'], ['人', 'rén / ひと', '人'], ['口', 'kǒu / くち', '嘴'], ['目', 'mù / め', '眼睛'], ['耳', 'ěr / みみ', '耳朵'], ['手', 'shǒu / て', '手'], ['足', 'zú / あし', '脚'], ['山', 'shān / やま', '山'], ['川', 'chuān / かわ', '河流'], ['田', 'tián / た', '田地'], ['中', 'zhōng / なか', '中间'], ['大', 'dà / おお', '大'], ['小', 'xiǎo / ちい', '小'], ['上', 'shàng / うえ', '上面'], ['下', 'xià / した', '下面'], ['学', 'xué / まな', '学习'], ['生', 'shēng / い', '生命'], ['先', 'xiān / さき', '先前'], ['語', 'yǔ / ご', '语言']],
      alphabet: [['А а', 'A'], ['Б б', 'B'], ['В в', 'V'], ['Г г', 'G'], ['Д д', 'D'], ['Е е', 'Ye'], ['Ё ё', 'Yo'], ['Ж ж', 'Zh'], ['З з', 'Z'], ['И и', 'I'], ['Й й', 'Y'], ['К к', 'K'], ['Л л', 'L'], ['М м', 'M'], ['Н н', 'N'], ['О о', 'O'], ['П п', 'P'], ['Р р', 'R'], ['С с', 'S'], ['Т т', 'T'], ['У у', 'U'], ['Ф ф', 'F'], ['Х х', 'Kh'], ['Ц ц', 'Ts'], ['Ч ч', 'Ch'], ['Ш ш', 'Sh'], ['Щ щ', 'Shch'], ['Ъ ъ', '—'], ['Ы ы', 'Y'], ['Ь ь', '—'], ['Э э', 'E'], ['Ю ю', 'Yu'], ['Я я', 'Ya']]
    };
    const paintChar = () => {
      const type = $('#ll-char').value, q = $('#ll-char-q').value.trim().toLowerCase();
      const list = (CHAR[type] || []).filter((row) => !q || row.join(' ').toLowerCase().includes(q));
      $('#ll-char-out').innerHTML = `<div class="row" style="gap:6px">${list.map(([a, b, c]) => `<span class="chip" style="flex-direction:column;align-items:flex-start"><b style="font-size:15px">${esc(a)}</b><span class="hint" style="font-size:10px">${esc(b)}${c ? ' · ' + esc(c) : ''}</span></span>`).join('')}</div>`;
    };
    $('#ll-char').addEventListener('change', paintChar);
    $('#ll-char-q').addEventListener('input', paintChar);
    paintChar();
    $('#ll-jp-run').click(); $('#ll-run').click(); $('#ll-en-run').click();
  },

  /* ================= 成语与词汇 ================= */
  'idioms'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="id-tabs"><button class="tab active" data-i="0">成语接龙</button><button class="tab" data-i="1">近反义词</button><button class="tab" data-i="2">英语词根</button><button class="tab" data-i="3">成语填空</button></div>
        <div class="panel" id="id-p0">
          <div class="row"><input class="inp" id="id-start" value="一心一意" style="flex:1"><button class="btn primary" id="id-chain">接龙</button></div>
          <pre class="out" id="id-out" style="margin-top:9px"></pre>
        </div>
        <div class="panel hidden" id="id-p1">
          <div class="row"><input class="inp" id="id-word" value="快乐" style="flex:1"><button class="btn primary" id="id-syn">查询</button></div>
          <pre class="out" id="id-syn-out" style="margin-top:9px"></pre>
        </div>
        <div class="panel hidden" id="id-p2">
          <div class="row"><input class="inp" id="id-root" placeholder="搜索词根，例如 bio" style="flex:1"><button class="btn" id="id-root-run">搜索</button></div>
          <div id="id-root-out" class="tool-ui" style="margin-top:9px"></div>
        </div>
        <div class="panel hidden" id="id-p3">
          <button class="btn primary" id="id-fill">出题</button>
          <div id="id-fill-out" style="margin-top:12px;font-size:20px"></div>
          <div class="row" id="id-fill-opts" style="margin-top:12px"></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#id-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#id-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      [0, 1, 2, 3].forEach((i) => $('#id-p' + i).classList.toggle('hidden', String(i) !== b.dataset.i));
    });
    $('#id-chain').onclick = () => {
      const start = $('#id-start').value.trim();
      const chain = [start];
      let cur = start;
      const used = new Set(chain);
      for (let i = 0; i < 12; i++) {
        const next = IDIOMS.find((x) => x[0] === cur[cur.length - 1] && !used.has(x));
        if (!next) break;
        chain.push(next); used.add(next); cur = next;
      }
      $('#id-out').textContent = chain.join(' → ') + (chain.length < 3 ? '\n提示：词库有限，可尝试其他起始成语。' : '');
    };
    $('#id-syn').onclick = () => {
      const w = $('#id-word').value.trim();
      $('#id-syn-out').textContent = `近义词：${SYN[w] || '本地词库暂未收录'}\n反义词：${ANTO[w] || '本地词库暂未收录'}`;
    };
    const paintRoot = () => {
      const q = $('#id-root').value.trim().toLowerCase();
      $('#id-root-out').innerHTML = `<div class="panel tight">${ROOTS.filter(([r]) => !q || r.includes(q)).map(([r, m, e]) => `<div class="row between" style="border-bottom:1px solid var(--line);padding:5px 0"><b class="mono" style="color:var(--acc)">${r}</b><span class="hint">${m}</span><span class="mono">${e}</span></div>`).join('')}</div>`;
    };
    $('#id-root-run').onclick = paintRoot;
    $('#id-root').addEventListener('input', paintRoot);
    paintRoot();
    $('#id-fill').onclick = () => {
      const item = IDIOMS[Math.floor(Math.random() * IDIOMS.length)];
      const idx = Math.floor(Math.random() * 4);
      const blanked = item.slice(0, idx) + '□' + item.slice(idx + 1);
      const opts = [item[idx], ...IDIOMS.filter((x) => x !== item).slice(0, 3).map((x) => x[idx])].sort(() => Math.random() - 0.5);
      $('#id-fill-out').textContent = blanked;
      $('#id-fill-opts').innerHTML = opts.map((o) => `<button class="chip" data-opt="${o}">${o}</button>`).join('');
      root.querySelectorAll('[data-opt]').forEach((b) => b.addEventListener('click', () => {
        b.style.color = b.dataset.opt === item[idx] ? 'var(--ok)' : 'var(--err)';
      }));
    };
    $('#id-fill').click();
  },

  /* ================= 教育行政 ================= */
  'teaching'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="te-tabs"><button class="tab active" data-i="0">课程表</button><button class="tab" data-i="1">座位表</button><button class="tab" data-i="2">值日表</button><button class="tab" data-i="3">教案模板</button></div>
        <div class="panel" id="te-p0">
          <div class="grid3"><div class="field"><label class="lab">科目（逗号分隔）</label><input class="inp" id="te-subjects" value="语文,数学,英语,物理,化学,体育"></div><div class="field"><label class="lab">每天节数</label><input class="inp" id="te-periods" type="number" value="6"></div><div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="te-timetable" style="width:100%">生成课程表</button></div></div>
          <div class="table-scroll" id="te-tt" style="margin-top:10px"></div>
        </div>
        <div class="panel hidden" id="te-p1">
          <div class="grid3"><div class="field"><label class="lab">行数</label><input class="inp" id="te-rows" type="number" value="6"></div><div class="field"><label class="lab">列数</label><input class="inp" id="te-cols" type="number" value="8"></div><div class="field"><label class="lab">姓名（逗号分隔）</label><input class="inp" id="te-names" value="张三,李四,王五,赵六,钱七,孙八"></div></div>
          <button class="btn primary" id="te-seat" style="margin-top:9px">生成座位表</button>
          <div class="table-scroll" id="te-seat-out" style="margin-top:10px"></div>
        </div>
        <div class="panel hidden" id="te-p2">
          <div class="grid3"><div class="field"><label class="lab">姓名（逗号分隔）</label><input class="inp" id="te-duty-names" value="张三,李四,王五,赵六,钱七"></div><div class="field"><label class="lab">天数</label><input class="inp" id="te-duty-days" type="number" value="5"></div><div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="te-duty" style="width:100%">生成值日表</button></div></div>
          <pre class="out" id="te-duty-out" style="margin-top:10px"></pre>
        </div>
        <div class="panel hidden" id="te-p3"><div id="te-plan"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#te-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#te-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      [0, 1, 2, 3].forEach((i) => $('#te-p' + i).classList.toggle('hidden', String(i) !== b.dataset.i));
    });
    $('#te-timetable').onclick = () => {
      const subs = $('#te-subjects').value.split(',').map((x) => x.trim()).filter(Boolean);
      const periods = Math.max(1, Math.min(12, Number($('#te-periods').value) || 6));
      const days = ['周一', '周二', '周三', '周四', '周五'];
      let html = `<table class="tbl"><tr><th>节次</th>${days.map((d) => `<th>${d}</th>`).join('')}</tr>`;
      for (let p = 0; p < periods; p++) {
        html += `<tr><td>第 ${p + 1} 节</td>${days.map((d, di) => `<td>${subs[(p * days.length + di) % subs.length] || ''}</td>`).join('')}</tr>`;
      }
      html += '</table>';
      $('#te-tt').innerHTML = html;
    };
    $('#te-seat').onclick = () => {
      const rows = Math.max(1, Number($('#te-rows').value)), cols = Math.max(1, Number($('#te-cols').value));
      const names = $('#te-names').value.split(',').map((x) => x.trim()).filter(Boolean).sort(() => Math.random() - 0.5);
      let html = '<table class="tbl">';
      for (let r = 0; r < rows; r++) {
        html += '<tr>' + Array.from({ length: cols }, (_, c) => `<td>${esc(names[r * cols + c] || '')}</td>`).join('') + '</tr>';
      }
      $('#te-seat-out').innerHTML = html + '</table>';
    };
    $('#te-duty').onclick = () => {
      const names = $('#te-duty-names').value.split(',').map((x) => x.trim()).filter(Boolean);
      const days = Math.max(1, Number($('#te-duty-days').value));
      $('#te-duty-out').textContent = Array.from({ length: days }, (_, i) => `第 ${i + 1} 天：${names[i % names.length] || '—'}`).join('\n');
    };
    templateWorkbench($('#te-plan'), {
      title: '教案模板',
      templates: [
        { id: 'lesson', name: '教案', build: (v) => `# ${v.title} · 教案\n\n- 授课人：${v.owner}\n- 日期：${v.date}\n- 课时：\n\n## 教学目标\n1. 知识与技能\n2. 过程与方法\n3. 情感态度\n\n## 教学重点 / 难点\n- 重点：\n- 难点：\n\n## 教学过程\n${v.notes.split('\n').filter(Boolean).map((x) => '- ' + x).join('\n')}\n\n## 板书设计\n\n\n## 作业布置\n\n\n## 教学反思\n` },
        { id: 'observation', name: '听课记录', build: (v) => `# ${v.title} · 听课记录\n\n- 授课教师：\n- 听课人：${v.owner}\n- 日期：${v.date}\n\n## 教学环节\n${v.notes.split('\n').filter(Boolean).map((x) => '- ' + x).join('\n')}\n\n## 亮点\n- \n\n## 建议\n- ` }
      ]
    });
    $('#te-timetable').click();
  },

  /* ================= 学术引用 ================= */
  'citation'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>BibTeX → 引用格式</b><span class="hint">APA / MLA / Chicago / RIS</span></div>
          <textarea class="ta mono" id="ci-bib" rows="7">@article{kong2026tools,
  author = {Kong, Tian and Li, Ming},
  title = {Browser-based Toolbox},
  journal = {Journal of Web Tools},
  year = {2026},
  volume = {12},
  number = {3},
  pages = {45--60}
}</textarea>
          <div class="row" style="margin-top:9px"><button class="btn primary" id="ci-run">转换</button><select class="sel" id="ci-fmt" style="max-width:120px"><option value="apa">APA</option><option value="mla">MLA</option><option value="chicago">Chicago</option><option value="ris">RIS</option></select><button class="btn" id="ci-copy">复制</button></div>
        </div>
        <div class="panel"><pre class="out" id="ci-out"></pre></div>
        <div class="panel"><div class="panel-head"><b>标识符校验</b></div><div class="row"><input class="inp" id="ci-id" placeholder="DOI / ISBN / ISSN" style="flex:1"><button class="btn primary" id="ci-check">校验</button><span class="hint" id="ci-check-out"></span></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const parseBib = (text) => {
      const m = text.match(/@\w+\{([^,]+),([\s\S]*?)\n\}/);
      if (!m) throw new Error('未识别 BibTeX 条目');
      const fields = {};
      m[2].split(/\n/).forEach((line) => { const x = line.match(/^\s*(\w+)\s*=\s*[{"]([\s\S]*?)[}"],?\s*$/); if (x) fields[x[1].toLowerCase()] = x[2]; });
      return fields;
    };
    $('#ci-run').onclick = () => {
      try {
        const f = parseBib($('#ci-bib').value);
        const authors = (f.author || '').split(' and ').map((a) => { const [last, first] = a.split(',').map((x) => x.trim()); return { last: last || a, first: first || '' }; });
        const fmt = $('#ci-fmt').value;
        let out = '';
        if (fmt === 'apa') out = `${authors.map((a) => `${a.last}, ${a.first.charAt(0)}.`).join(', ')} (${f.year}). ${f.title}. ${f.journal || ''}${f.volume ? ', ' + f.volume : ''}${f.number ? '(' + f.number + ')' : ''}${f.pages ? ', ' + f.pages : ''}.`;
        else if (fmt === 'mla') out = `${authors.map((a) => `${a.last}, ${a.first}`).join(', and ')}. "${f.title}." ${f.journal || ''} ${f.volume || ''}${f.number ? '.' + f.number : ''} (${f.year}): ${f.pages || ''}.`;
        else if (fmt === 'chicago') out = `${authors.map((a) => `${a.first} ${a.last}`).join(', ')}. "${f.title}." ${f.journal || ''} ${f.volume || ''}, no. ${f.number || ''} (${f.year}): ${f.pages || ''}.`;
        else out = `TY  - JOUR\n${authors.map((a) => `AU  - ${a.last}, ${a.first}`).join('\n')}\nTI  - ${f.title}\nJO  - ${f.journal || ''}\nPY  - ${f.year}\nVL  - ${f.volume || ''}\nIS  - ${f.number || ''}\nSP  - ${(f.pages || '').split('--')[0]}\nEP  - ${(f.pages || '').split('--')[1] || ''}\nER  -`;
        $('#ci-out').textContent = out;
      } catch (e) { $('#ci-out').textContent = e.message; }
    };
    $('#ci-copy').onclick = () => copy($('#ci-out').textContent);
    $('#ci-check').onclick = () => {
      const v = $('#ci-id').value.trim();
      if (/^10\.\d{4,9}\//.test(v)) { $('#ci-check-out').textContent = 'DOI 格式有效'; return; }
      const isbn = v.replace(/[-\s]/g, '');
      if (isbn.length === 10 || isbn.length === 13) {
        if (isbn.length === 10) { let s = 0; for (let i = 0; i < 10; i++) s += (isbn[i] === 'X' ? 10 : +isbn[i]) * (10 - i); $('#ci-check-out').textContent = s % 11 === 0 ? 'ISBN-10 有效' : 'ISBN-10 校验失败'; }
        else { let s = 0; for (let i = 0; i < 13; i++) s += +isbn[i] * (i % 2 ? 3 : 1); $('#ci-check-out').textContent = s % 10 === 0 ? 'ISBN-13 有效' : 'ISBN-13 校验失败'; }
        return;
      }
      if (/^\d{4}-\d{3}[\dX]$/.test(v)) {
        let s = 0; const d = v.replace('-', '');
        for (let i = 0; i < 7; i++) s += +d[i] * (8 - i);
        const c = (11 - s % 11) % 11;
        $('#ci-check-out').textContent = (c === 10 ? 'X' : c) === d[7] ? 'ISSN 有效' : 'ISSN 校验失败';
        return;
      }
      $('#ci-check-out').textContent = '无法识别的标识符格式';
    };
    $('#ci-run').click();
  }
};
