/* 科学、化学、物理与实验 */
import { esc, copy, toast, download } from '../core/ui.js';
import { calcWorkbench } from '../core/workbench.js';

const $ = (root, s) => root.querySelector(s);

const ELEMENTS = ('H 氢 1.008;He 氦 4.0026;Li 锂 6.94;Be 铍 9.0122;B 硼 10.81;C 碳 12.011;N 氮 14.007;O 氧 15.999;F 氟 18.998;Ne 氖 20.180;' +
'Na 钠 22.990;Mg 镁 24.305;Al 铝 26.982;Si 硅 28.085;P 磷 30.974;S 硫 32.06;Cl 氯 35.45;Ar 氩 39.948;K 钾 39.098;Ca 钙 40.078;' +
'Sc 钪 44.956;Ti 钛 47.867;V 钒 50.942;Cr 铬 51.996;Mn 锰 54.938;Fe 铁 55.845;Co 钴 58.933;Ni 镍 58.693;Cu 铜 63.546;Zn 锌 65.38;' +
'Ga 镓 69.723;Ge 锗 72.630;As 砷 74.922;Se 硒 78.971;Br 溴 79.904;Kr 氪 83.798;Rb 铷 85.468;Sr 锶 87.62;Y 钇 88.906;Zr 锆 91.224;' +
'Nb 铌 92.906;Mo 钼 95.95;Tc 锝 98;Ru 钌 101.07;Rh 铑 102.91;Pd 钯 106.42;Ag 银 107.87;Cd 镉 112.41;In 铟 114.82;Sn 锡 118.71;' +
'Sb 锑 121.76;Te 碲 127.60;I 碘 126.90;Xe 氙 131.29;Cs 铯 132.91;Ba 钡 137.33;La 镧 138.91;Ce 铈 140.12;Pr 镨 140.91;Nd 钕 144.24;' +
'Pm 钷 145;Sm 钐 150.36;Eu 铕 151.96;Gd 钆 157.25;Tb 铽 158.93;Dy 镝 162.50;Ho 钬 164.93;Er 铒 167.26;Tm 铥 168.93;Yb 镱 173.05;' +
'Lu 镥 174.97;Hf 铪 178.49;Ta 钽 180.95;W 钨 183.84;Re 铼 186.21;Os 锇 190.23;Ir 铱 192.22;Pt 铂 195.08;Au 金 196.97;Hg 汞 200.59;' +
'Tl 铊 204.38;Pb 铅 207.2;Bi 铋 208.98;Po 钋 209;At 砹 210;Rn 氡 222;Fr 钫 223;Ra 镭 226;Ac 锕 227;Th 钍 232.04;Pa 镤 231.04;' +
'U 铀 238.03;Np 镎 237;Pu 钚 244;Am 镅 243;Cm 锔 247;Bk 锫 247;Cf 锎 251;Es 锿 252;Fm 镄 257;Md 钔 258;No 锘 259;Lr 铹 266;' +
'Rf 𬬻 267;Db 𬭊 268;Sg 𬭳 269;Bh 𬭛 270;Hs 𬭶 269;Mt 鿏 278;Ds 𫟼 281;Rg 𬬭 282;Cn 鿔 285;Nh 鿭 286;Fl 𫓧 289;Mc 镆 290;' +
'Lv 鉝 293;Ts 鿬 294;Og 鿫 294').split(';').map((x, i) => { const [sym, name, mass] = x.split(' '); return { n: i + 1, sym, name, mass: Number(mass) }; });

const ATOMIC = Object.fromEntries(ELEMENTS.map((e) => [e.sym, e.mass]));

function molarMass(formula) {
  let i = 0;
  const parse = (stop) => {
    let total = 0;
    while (i < formula.length) {
      const c = formula[i];
      if (c === stop) { i++; break; }
      if (c === '(') { i++; total += parse(')'); continue; }
      if (/[A-Z]/.test(c)) {
        let sym = c; i++;
        while (i < formula.length && /[a-z]/.test(formula[i])) sym += formula[i++];
        let num = '';
        while (i < formula.length && /\d/.test(formula[i])) num += formula[i++];
        if (!ATOMIC[sym]) throw new Error('未知元素：' + sym);
        total += ATOMIC[sym] * (num ? Number(num) : 1);
        continue;
      }
      i++;
    }
    return total;
  };
  return parse(null);
}

export default {
  /* ================= 元素周期表 ================= */
  'periodic-table'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="row"><input class="inp" id="pt-search" placeholder="搜索元素名称、符号或原子序数" style="flex:1"><select class="sel" id="pt-cat" style="max-width:160px"><option value="all">全部</option><option value="nonmetal">非金属</option><option value="metal">金属</option><option value="noble">稀有气体</option><option value="radio">放射性</option></select></div>
        </div>
        <div class="panel"><div id="pt-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:5px"></div></div>
        <div class="panel" id="pt-detail"><div class="hint">点击元素查看详情</div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const isMetal = (n) => (n >= 3 && n <= 4) || (n >= 11 && n <= 13) || (n >= 19 && n <= 31) || (n >= 37 && n <= 51) || (n >= 55 && n <= 84) || (n >= 87 && n <= 116);
    const isNoble = (n) => [2, 10, 18, 36, 54, 86, 118].includes(n);
    const isRadio = (n) => n >= 84 || n === 43 || n === 61;
    const paint = () => {
      const q = $('#pt-search').value.trim().toLowerCase(); const cat = $('#pt-cat').value;
      const list = ELEMENTS.filter((e) => {
        if (q && !(e.sym.toLowerCase().includes(q) || e.name.includes(q) || String(e.n).includes(q))) return false;
        if (cat === 'metal' && !isMetal(e.n)) return false;
        if (cat === 'nonmetal' && isMetal(e.n)) return false;
        if (cat === 'noble' && !isNoble(e.n)) return false;
        if (cat === 'radio' && !isRadio(e.n)) return false;
        return true;
      });
      $('#pt-grid').innerHTML = list.map((e) => `<button class="btn" data-el="${e.n}" style="flex-direction:column;min-height:66px;padding:4px;background:${isNoble(e.n) ? 'rgba(129,140,248,.12)' : isMetal(e.n) ? 'rgba(56,205,240,.08)' : 'rgba(52,211,153,.1)'}"><span class="hint" style="font-size:8px">${e.n}</span><b style="font-size:16px;color:var(--acc)">${e.sym}</b><span style="font-size:10px">${e.name}</span></button>`).join('');
      root.querySelectorAll('[data-el]').forEach((b) => b.addEventListener('click', () => {
        const e = ELEMENTS[Number(b.dataset.el) - 1];
        $('#pt-detail').innerHTML = `<div class="row"><div style="width:88px;height:88px;border-radius:14px;background:var(--acc-soft);display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:800;color:var(--acc)">${e.sym}</div><div><b style="font-size:20px">${e.name}</b><div class="hint">原子序数 ${e.n} · 相对原子质量 ${e.mass}</div><div class="hint">分类：${isNoble(e.n) ? '稀有气体' : isMetal(e.n) ? '金属' : '非金属'}${isRadio(e.n) ? ' · 放射性' : ''}</div></div></div>`;
      }));
    };
    $('#pt-search').addEventListener('input', paint);
    $('#pt-cat').addEventListener('change', paint);
    paint();
  },

  /* ================= 化学计算 ================= */
  'chem-calc'(root) {
    calcWorkbench(root, {
      title: '化学计算',
      note: '原子量取常用近似值；缓冲液、配平等专业计算请结合实验条件复核。',
      groups: [
        { name: '摩尔质量', fields: [['formula', '化学式', 'H2SO4', 'text', '支持括号，如 Ca(OH)2']], run: (v) => `摩尔质量：${molarMass(v.formula).toFixed(3)} g/mol` },
        { name: '溶液浓度', fields: [['m', '溶质物质的量 mol', 0.5], ['vol', '溶液体积 L', 1]], run: (v) => `物质的量浓度：${(v.m / v.vol).toFixed(4)} mol/L` },
        { name: '稀释计算', fields: [['c1', 'C1 mol/L', 1], ['v1', 'V1 mL', 10], ['c2', 'C2 mol/L', 0.1]], run: (v) => `V2 = ${(v.c1 * v.v1 / v.c2).toFixed(3)} mL\n需加水约 ${(v.c1 * v.v1 / v.c2 - v.v1).toFixed(3)} mL` },
        { name: 'pH / pOH', fields: [['h', 'H+ 浓度 mol/L', 0.001], ['mode', '输入类型', 'h', 'select', [['h', 'H+ 浓度'], ['ph', 'pH 值']]]], run: (v) => { const ph = v.mode === 'ph' ? v.h : -Math.log10(v.h); return `pH = ${ph.toFixed(3)}\npOH = ${(14 - ph).toFixed(3)}\n[OH-] = ${(10 ** -(14 - ph)).toExponential(3)} mol/L`; } },
        { name: '理想气体', fields: [['p', '压强 kPa', 101.325], ['vol', '体积 L', 22.4], ['t', '温度 °C', 0]], run: (v) => { const T = v.t + 273.15; const n = v.p * v.vol / (8.314 * T); return `n = ${n.toFixed(4)} mol\n标准状况体积 = ${(n * 22.414).toFixed(3)} L`; } },
        { name: '质量分数', fields: [['solute', '溶质质量 g', 10], ['solution', '溶液质量 g', 100]], run: (v) => `质量分数：${(v.solute / v.solution * 100).toFixed(2)}%` },
        { name: '反应计量', fields: [['mass', '反应物质量 g', 10], ['mm', '反应物摩尔质量', 100], ['ratio', '产物/反应物摩尔比', 1], ['pm', '产物摩尔质量', 44]], run: (v) => `反应物物质的量：${(v.mass / v.mm).toFixed(4)} mol\n理论产物质量：${(v.mass / v.mm * v.ratio * v.pm).toFixed(3)} g` }
      ]
    });
  },

  /* ================= 物理计算 ================= */
  'physics-calc'(root) {
    calcWorkbench(root, {
      title: '物理与工程计算',
      note: '默认使用国际单位制（m、kg、s、N、J、W）。',
      groups: [
        { name: '匀加速运动', fields: [['u', '初速度 m/s', 0], ['a', '加速度 m/s²', 9.8], ['t', '时间 s', 3]], run: (v) => `末速度 v = ${(v.u + v.a * v.t).toFixed(3)} m/s\n位移 s = ${(v.u * v.t + 0.5 * v.a * v.t ** 2).toFixed(3)} m` },
        { name: '力与加速度', fields: [['m', '质量 kg', 10], ['a', '加速度 m/s²', 2]], run: (v) => `F = m·a = ${(v.m * v.a).toFixed(3)} N` },
        { name: '功与功率', fields: [['f', '力 N', 100], ['s', '位移 m', 10], ['t', '时间 s', 2]], run: (v) => `功 W = ${(v.f * v.s).toFixed(2)} J\n功率 P = ${(v.f * v.s / v.t).toFixed(2)} W` },
        { name: '动能 / 势能', fields: [['m', '质量 kg', 2], ['v', '速度 m/s', 10], ['h', '高度 m', 5]], run: (v) => `动能 = ${(0.5 * v.m * v.v ** 2).toFixed(2)} J\n重力势能 = ${(v.m * 9.8 * v.h).toFixed(2)} J` },
        { name: '动量', fields: [['m', '质量 kg', 2], ['v', '速度 m/s', 10]], run: (v) => `动量 p = ${(v.m * v.v).toFixed(3)} kg·m/s` },
        { name: '压强 / 浮力', fields: [['f', '力 N', 100], ['a', '面积 m²', 0.5], ['vol', '排开体积 m³', 0.001], ['rho', '液体密度 kg/m³', 1000]], run: (v) => `压强 P = ${(v.f / v.a).toFixed(2)} Pa\n浮力 F = ${(v.rho * 9.8 * v.vol).toFixed(3)} N` },
        { name: '欧姆定律', fields: [['u', '电压 V', 12], ['r', '电阻 Ω', 6], ['i', '电流 A', 2], ['mode', '求', 'i', 'select', [['i', '电流'], ['u', '电压'], ['r', '电阻']]]], run: (v) => v.mode === 'i' ? `I = U / R = ${(v.u / v.r).toFixed(4)} A` : v.mode === 'u' ? `U = I × R = ${(v.i * v.r).toFixed(3)} V` : `R = U / I = ${(v.u / (v.i || 1)).toFixed(3)} Ω` },
        { name: '电功率', fields: [['u', '电压 V', 220], ['i', '电流 A', 0.5]], run: (v) => `P = ${(v.u * v.i).toFixed(2)} W\n1 小时耗电 ${(v.u * v.i / 1000).toFixed(3)} kWh` },
        { name: '波速与频率', fields: [['f', '频率 Hz', 440], ['lambda', '波长 m', 0.78]], run: (v) => `波速 v = ${(v.f * v.lambda).toFixed(3)} m/s\n周期 T = ${(1 / v.f).toFixed(5)} s` },
        { name: '分贝', fields: [['p', '声压 Pa', 0.02]], run: (v) => `声压级 = ${(20 * Math.log10(v.p / 0.00002)).toFixed(1)} dB SPL` },
        { name: '热膨胀', fields: [['l', '原长 m', 1], ['alpha', '线膨胀系数 /°C', 0.000012], ['dt', '温差 °C', 50]], run: (v) => `伸长量 = ${(v.l * v.alpha * v.dt * 1000).toFixed(4)} mm` }
      ]
    });
  },

  /* ================= 工程计算 ================= */
  'engineering-calc'(root) {
    calcWorkbench(root, {
      title: '工程常用计算',
      groups: [
        { name: '齿轮比', fields: [['a', '主动轮齿数', 20], ['b', '从动轮齿数', 40], ['rpm', '主动转速 rpm', 1500]], run: (v) => `传动比 = ${(v.b / v.a).toFixed(3)}\n从动转速 = ${(v.rpm * v.a / v.b).toFixed(1)} rpm` },
        { name: '扭矩', fields: [['f', '力 N', 50], ['r', '力臂 m', 0.3]], run: (v) => `扭矩 = ${(v.f * v.r).toFixed(3)} N·m` },
        { name: '皮带轮', fields: [['d1', '主动轮直径 mm', 100], ['d2', '从动轮直径 mm', 200], ['n1', '主动转速 rpm', 1450]], run: (v) => `从动转速 = ${(v.n1 * v.d1 / v.d2).toFixed(1)} rpm` },
        { name: '材料重量', fields: [['type', '材料', 'steel', 'select', [['steel', '钢 7.85'], ['aluminum', '铝 2.70'], ['copper', '铜 8.96'], ['abs', 'ABS 1.04'], ['glass', '玻璃 2.50']]], ['l', '长 mm', 100], ['w', '宽 mm', 100], ['h', '厚 mm', 2]], run: (v) => { const d = { steel: 7.85, aluminum: 2.70, copper: 8.96, abs: 1.04, glass: 2.50 }[v.type]; const kg = v.l * v.w * v.h / 1000 * d / 1000; return `体积 = ${(v.l * v.w * v.h / 1000).toFixed(2)} cm³\n重量 ≈ ${kg.toFixed(4)} kg（${(kg * 1000).toFixed(1)} g）`; } },
        { name: '公差与配合', fields: [['nom', '公称尺寸 mm', 50], ['up', '上偏差 mm', 0.02], ['low', '下偏差 mm', -0.01]], run: (v) => `最大极限尺寸 = ${(v.nom + v.up).toFixed(3)} mm\n最小极限尺寸 = ${(v.nom + v.low).toFixed(3)} mm\n公差 = ${(v.up - v.low).toFixed(3)} mm` },
        { name: '图纸比例', fields: [['real', '实际长度 mm', 1000], ['scale', '比例 1:', 50]], run: (v) => `图纸长度 = ${(v.real / v.scale).toFixed(3)} mm` },
        { name: '热传导', fields: [['k', '导热系数 W/m·K', 0.6], ['a', '面积 m²', 1], ['dt', '温差 K', 20], ['d', '厚度 m', 0.1]], run: (v) => `热流 = ${(v.k * v.a * v.dt / v.d).toFixed(2)} W` }
      ]
    });
  },

  /* ================= 实验记录 ================= */
  'lab-record'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="grid3">
            <div class="field"><label class="lab">实验名称</label><input class="inp" id="lr-title" value="示例实验"></div>
            <div class="field"><label class="lab">实验人</label><input class="inp" id="lr-owner" value=""></div>
            <div class="field"><label class="lab">日期</label><input class="inp" id="lr-date" type="date"></div>
          </div>
          <div class="field" style="margin-top:9px"><label class="lab">数据（CSV：x,y 或 时间,温度,压力）</label><textarea class="ta mono" id="lr-data" rows="7">0,20
10,24
20,29
30,35
40,42</textarea></div>
          <div class="row" style="margin-top:9px"><button class="btn primary" id="lr-run">生成图表</button><button class="btn" id="lr-csv">导出 CSV</button><button class="btn" id="lr-md">复制记录</button></div>
        </div>
        <div class="panel"><div class="canvas-wrap"><canvas id="lr-chart" width="760" height="300"></canvas></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#lr-date').value = new Date().toISOString().slice(0, 10);
    const run = () => {
      const rows = $('#lr-data').value.split(/\r?\n/).filter(Boolean).map((l) => l.split(/[,，\s]+/).map(Number));
      const cv = $('#lr-chart'), g = cv.getContext('2d');
      g.clearRect(0, 0, cv.width, cv.height);
      if (!rows.length) return;
      const xs = rows.map((r) => r[0]), ys = rows.map((r) => r[1]);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      g.strokeStyle = 'rgba(255,255,255,.1)';
      for (let i = 0; i < 5; i++) { const y = 20 + i * 58; g.beginPath(); g.moveTo(40, y); g.lineTo(740, y); g.stroke(); }
      g.strokeStyle = '#38cdf0'; g.lineWidth = 2; g.beginPath();
      rows.forEach(([x, y], i) => {
        const px = 40 + (x - minX) / (maxX - minX || 1) * 700;
        const py = 280 - (y - minY) / (maxY - minY || 1) * 240;
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      });
      g.stroke();
      g.fillStyle = '#8b9bb8'; g.font = '11px sans-serif';
      g.fillText(`X: ${minX} – ${maxX}`, 40, 296);
      g.fillText(`Y: ${minY} – ${maxY}`, 640, 296);
    };
    $('#lr-run').onclick = run;
    $('#lr-csv').onclick = () => download('lab-data.csv', $('#lr-data').value, 'text/csv');
    $('#lr-md').onclick = () => {
      copy(`# ${$('#lr-title').value}\n\n- 实验人：${$('#lr-owner').value}\n- 日期：${$('#lr-date').value}\n\n## 数据\n\n\`\`\`\n${$('#lr-data').value}\n\`\`\``);
    };
    run();
  }
};
