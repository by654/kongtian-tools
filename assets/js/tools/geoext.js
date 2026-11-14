/* 地图、坐标、轨迹、气象与天文 */
import { esc, copy, toast, download } from '../core/ui.js';
import { bindFileZone, fileZone } from '../core/kit.js';
import { calcWorkbench } from '../core/workbench.js';

const $ = (root, s) => root.querySelector(s);
const rad = Math.PI / 180;

function dmsToDd(d, m, s, dir) {
  let v = Math.abs(Number(d)) + Math.abs(Number(m) || 0) / 60 + Math.abs(Number(s) || 0) / 3600;
  if (/[SW]/i.test(dir) || Number(d) < 0) v = -v;
  return v;
}
function ddToDms(v, lat = true) {
  const dir = v < 0 ? (lat ? 'S' : 'W') : (lat ? 'N' : 'E');
  v = Math.abs(v);
  const d = Math.floor(v), m = Math.floor((v - d) * 60), s = ((v - d) * 60 - m) * 60;
  return `${d}° ${m}′ ${s.toFixed(2)}″ ${dir}`;
}
function utm(lat, lon) {
  const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996;
  const zone = Math.floor((lon + 180) / 6) + 1;
  const lon0 = (zone - 1) * 6 - 180 + 3;
  const e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  const N = a / Math.sqrt(1 - e2 * Math.sin(lat * rad) ** 2);
  const T = Math.tan(lat * rad) ** 2, C = ep2 * Math.cos(lat * rad) ** 2;
  const A = Math.cos(lat * rad) * (lon - lon0) * rad;
  const M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64) * lat * rad - (3 * e2 / 8 + 3 * e2 ** 2 / 32) * Math.sin(2 * lat * rad) + (15 * e2 ** 2 / 256) * Math.sin(4 * lat * rad));
  const easting = k0 * N * (A + (1 - T + C) * A ** 3 / 6) + 500000;
  let northing = k0 * (M + N * Math.tan(lat * rad) * (A ** 2 / 2 + (5 - T + 9 * C) * A ** 4 / 24));
  if (lat < 0) northing += 10000000;
  return { zone, band: 'CDEFGHJKLMNPQRSTUVWXX'[Math.floor((lat + 80) / 8)] || '', easting, northing };
}
function haversine(a, b) {
  const R = 6371008.8;
  const dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function moon(date) {
  const syn = 29.530588853, known = Date.UTC(2000, 0, 6, 18, 14);
  let age = ((date.getTime() - known) / 864e5) % syn;
  if (age < 0) age += syn;
  const f = age / syn;
  return { age, name: f < 0.03 || f > 0.97 ? '新月' : f < 0.22 ? '峨眉月' : f < 0.28 ? '上弦月' : f < 0.47 ? '盈凸月' : f < 0.53 ? '满月' : f < 0.72 ? '亏凸月' : f < 0.78 ? '下弦月' : '残月' };
}

export default {
  /* ================= 坐标转换 ================= */
  'coord-convert'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="tabs" id="cc-tabs"><button class="tab active" data-i="0">度分秒 ↔ 十进制</button><button class="tab" data-i="1">批量转 UTM</button><button class="tab" data-i="2">EPSG 查询</button></div>
          <div id="cc-p0" style="margin-top:10px">
            <div class="grid3"><div class="field"><label class="lab">纬度（DMS 或十进制）</label><input class="inp" id="cc-lat" value="39°54′15.1″ N"></div><div class="field"><label class="lab">经度</label><input class="inp" id="cc-lon" value="116°24′26.6″ E"></div><div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="cc-run" style="width:100%">转换</button></div></div>
            <pre class="out" id="cc-out" style="margin-top:9px"></pre>
          </div>
          <div id="cc-p1" class="hidden" style="margin-top:10px">
            <textarea class="ta mono" id="cc-batch" rows="5">39.9042,116.4074
31.2304,121.4737</textarea>
            <button class="btn primary" id="cc-batch-run" style="margin-top:9px">批量转换</button>
            <pre class="out" id="cc-batch-out" style="margin-top:9px"></pre>
          </div>
          <div id="cc-p2" class="hidden" style="margin-top:10px">
            <input class="inp" id="cc-epsg" placeholder="搜索 EPSG 代码或名称" value="4326">
            <div id="cc-epsg-out" class="tool-ui" style="margin-top:9px"></div>
          </div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#cc-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#cc-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      [0, 1, 2].forEach((i) => $('#cc-p' + i).classList.toggle('hidden', String(i) !== b.dataset.i));
    });
    const parseDms = (s) => {
      if (/^[-+]?\d+(\.\d+)?$/.test(s.trim())) return Number(s);
      const m = s.match(/([-+]?\d+)[°d:\s]+(\d+)?['′m:\s]*(\d+(?:\.\d+)?)?["″s]?\s*([NSEW])?/i);
      if (!m) return NaN;
      return dmsToDd(m[1], m[2], m[3], m[4]);
    };
    $('#cc-run').onclick = () => {
      const lat = parseDms($('#cc-lat').value), lon = parseDms($('#cc-lon').value);
      const u = utm(lat, lon);
      $('#cc-out').textContent = `十进制：${lat.toFixed(6)}, ${lon.toFixed(6)}\n纬度 DMS：${ddToDms(lat, true)}\n经度 DMS：${ddToDms(lon, false)}\nUTM：${u.zone}${u.band} ${u.easting.toFixed(2)}E ${u.northing.toFixed(2)}N`;
    };
    $('#cc-batch-run').onclick = () => {
      $('#cc-batch-out').textContent = $('#cc-batch').value.split(/\r?\n/).filter(Boolean).map((l) => {
        const [lat, lon] = l.split(/[,，\s]+/).map(Number);
        const u = utm(lat, lon);
        return `${lat},${lon} → ${u.zone}${u.band} E${u.easting.toFixed(1)} N${u.northing.toFixed(1)}`;
      }).join('\n');
    };
    const EPSG = [['4326', 'WGS 84 经纬度'], ['3857', 'Web Mercator'], ['4490', 'CGCS2000 经纬度'], ['4479', 'CGCS2000 3 度带'], ['32650', 'WGS 84 / UTM 50N'], ['32649', 'WGS 84 / UTM 49N'], ['4547', 'CGCS2000 / 3 度带 39 带'], ['2154', 'RGF93 / Lambert-93'], ['27700', 'OSGB 1936 / British National Grid'], ['3395', 'World Mercator']];
    const paintEpsg = () => {
      const q = $('#cc-epsg').value.toLowerCase();
      $('#cc-epsg-out').innerHTML = EPSG.filter(([c, n]) => c.includes(q) || n.toLowerCase().includes(q)).map(([c, n]) => `<div class="row between" style="border-bottom:1px solid var(--line);padding:5px 0"><b class="mono" style="color:var(--acc)">EPSG:${c}</b><span class="hint">${n}</span></div>`).join('');
    };
    $('#cc-epsg').addEventListener('input', paintEpsg);
    paintEpsg();
    $('#cc-run').click();
  },

  /* ================= 地图分幅与瓦片 ================= */
  'map-grid'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="tabs" id="mg-tabs"><button class="tab active" data-i="0">经纬度 → 瓦片</button><button class="tab" data-i="1">瓦片 → 经纬度</button><button class="tab" data-i="2">比例尺 / 分辨率</button></div>
          <div id="mg-p0" style="margin-top:10px"><div class="grid4"><div class="field"><label class="lab">纬度</label><input class="inp" id="mg-lat" value="39.9042"></div><div class="field"><label class="lab">经度</label><input class="inp" id="mg-lon" value="116.4074"></div><div class="field"><label class="lab">缩放级别 z</label><input class="inp" id="mg-z" type="number" value="10"></div><div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="mg-run" style="width:100%">计算</button></div></div><pre class="out" id="mg-out" style="margin-top:9px"></pre></div>
          <div id="mg-p1" class="hidden" style="margin-top:10px"><div class="grid4"><div class="field"><label class="lab">x</label><input class="inp" id="mg-x" type="number" value="843"></div><div class="field"><label class="lab">y</label><input class="inp" id="mg-y" type="number" value="388"></div><div class="field"><label class="lab">z</label><input class="inp" id="mg-z2" type="number" value="10"></div><div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="mg-run2" style="width:100%">计算</button></div></div><pre class="out" id="mg-out2" style="margin-top:9px"></pre></div>
          <div id="mg-p2" class="hidden" style="margin-top:10px"><div class="grid3"><div class="field"><label class="lab">纬度</label><input class="inp" id="mg-lat2" value="39.9042"></div><div class="field"><label class="lab">缩放级别</label><input class="inp" id="mg-z3" type="number" value="10"></div><div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="mg-run3" style="width:100%">计算</button></div></div><pre class="out" id="mg-out3" style="margin-top:9px"></pre></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#mg-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#mg-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      [0, 1, 2].forEach((i) => $('#mg-p' + i).classList.toggle('hidden', String(i) !== b.dataset.i));
    });
    $('#mg-run').onclick = () => {
      const lat = Number($('#mg-lat').value), lon = Number($('#mg-lon').value), z = Number($('#mg-z').value);
      const n = 2 ** z;
      const x = Math.floor((lon + 180) / 360 * n);
      const y = Math.floor((1 - Math.log(Math.tan(lat * rad) + 1 / Math.cos(lat * rad)) / Math.PI) / 2 * n);
      $('#mg-out').textContent = `瓦片：z=${z} x=${x} y=${y}\nURL：https://tile.openstreetmap.org/${z}/${x}/${y}.png\n每瓦片约 ${(156543.03392 * Math.cos(lat * rad) / n).toFixed(2)} m/px`;
    };
    $('#mg-run2').onclick = () => {
      const x = Number($('#mg-x').value), y = Number($('#mg-y').value), z = Number($('#mg-z2').value);
      const n = 2 ** z;
      const lon = x / n * 360 - 180;
      const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) / rad;
      $('#mg-out2').textContent = `经纬度：${lat.toFixed(6)}, ${lon.toFixed(6)}\n瓦片范围：${lon.toFixed(3)}° – ${(x + 1) / n * 360 - 180}°`;
    };
    $('#mg-run3').onclick = () => {
      const lat = Number($('#mg-lat2').value), z = Number($('#mg-z3').value);
      const res = 156543.03392 * Math.cos(lat * rad) / 2 ** z;
      $('#mg-out3').textContent = `分辨率：${res.toFixed(3)} m/px\n比例尺（96dpi）：1:${Math.round(res * 96 / 0.0254).toLocaleString()}\n每瓦片 256px 约 ${(res * 256 / 1000).toFixed(2)} km`;
    };
    $('#mg-run').click();
  },

  /* ================= 轨迹分析 ================= */
  'track-tools'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>GPX / 轨迹分析</b><span class="hint">距离、爬升、速度、简化、导出</span></div>
          ${fileZone('tt-zone', { accept: '.gpx,application/gpx+xml', label: '选择 GPX 文件' })}
          <div class="row" style="margin-top:9px"><button class="btn primary" id="tt-run">分析</button><button class="btn" id="tt-simplify">简化轨迹</button><button class="btn" id="tt-export">导出 GeoJSON</button><span class="hint" id="tt-meta">尚未选择文件</span></div>
        </div>
        <div class="stat-grid" id="tt-stats"></div>
        <div class="panel"><div class="canvas-wrap"><canvas id="tt-chart" width="760" height="240"></canvas></div></div>
        <div class="panel"><div class="panel-head"><b>轨迹点</b></div><div id="tt-points" class="table-scroll" style="max-height:260px"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let pts = [];
    bindFileZone(root, 'tt-zone', async (fs) => {
      const text = await fs[0].text();
      const doc = new DOMParser().parseFromString(text, 'application/xml');
      pts = [...doc.querySelectorAll('trkpt,wpt,rtept')].map((p) => ({ lat: +p.getAttribute('lat'), lon: +p.getAttribute('lon'), ele: +(p.querySelector('ele')?.textContent || 0), time: p.querySelector('time')?.textContent || '' }));
      $('#tt-meta').textContent = `${pts.length} 个点`;
      $('#tt-points').innerHTML = `<table class="tbl"><tr><th>#</th><th>纬度</th><th>经度</th><th>海拔</th></tr>${pts.slice(0, 200).map((p, i) => `<tr><td>${i + 1}</td><td>${p.lat.toFixed(5)}</td><td>${p.lon.toFixed(5)}</td><td>${p.ele.toFixed(1)}</td></tr>`).join('')}</table>`;
    });
    const stats = () => {
      let dist = 0, gain = 0, loss = 0;
      for (let i = 1; i < pts.length; i++) {
        dist += haversine([pts[i - 1].lat, pts[i - 1].lon], [pts[i].lat, pts[i].lon]);
        const d = pts[i].ele - pts[i - 1].ele;
        if (d > 0) gain += d; else loss -= d;
      }
      const times = pts.map((p) => p.time ? new Date(p.time).getTime() : NaN).filter((x) => !isNaN(x));
      const dur = times.length > 1 ? (times[times.length - 1] - times[0]) / 1000 : 0;
      const eles = pts.map((p) => p.ele);
      $('#tt-stats').innerHTML = [
        ['距离', (dist / 1000).toFixed(2) + ' km'], ['爬升', gain.toFixed(0) + ' m'], ['下降', loss.toFixed(0) + ' m'],
        ['时长', dur ? (dur / 3600).toFixed(2) + ' h' : '—'], ['平均速度', dur ? (dist / dur * 3.6).toFixed(1) + ' km/h' : '—'],
        ['最高海拔', Math.max(...eles).toFixed(0) + ' m'], ['最低海拔', Math.min(...eles).toFixed(0) + ' m']
      ].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
      const cv = $('#tt-chart'), g = cv.getContext('2d');
      g.clearRect(0, 0, cv.width, cv.height);
      if (!pts.length) return;
      const min = Math.min(...eles), max = Math.max(...eles);
      g.strokeStyle = '#38cdf0'; g.lineWidth = 2; g.beginPath();
      eles.forEach((e, i) => { const x = 24 + i / Math.max(1, eles.length - 1) * 712, y = 210 - (e - min) / (max - min || 1) * 180; i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.stroke();
      g.fillStyle = '#8b9bb8'; g.font = '11px sans-serif'; g.fillText(`海拔 ${min}–${max} m`, 24, 230);
    };
    $('#tt-run').onclick = () => { if (!pts.length) return toast('请选择 GPX', 'err'); stats(); };
    $('#tt-simplify').onclick = () => {
      if (pts.length < 3) return;
      const keep = [pts[0]];
      for (let i = 1; i < pts.length - 1; i++) if (haversine([pts[i - 1].lat, pts[i - 1].lon], [pts[i].lat, pts[i].lon]) > 10) keep.push(pts[i]);
      keep.push(pts[pts.length - 1]);
      pts = keep; $('#tt-meta').textContent = `简化后 ${pts.length} 个点`; stats();
    };
    $('#tt-export').onclick = () => {
      download('track.geojson', JSON.stringify({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts.map((p) => [p.lon, p.lat, p.ele]) } }, null, 2), 'application/json');
    };
  },

  /* ================= 气象计算 ================= */
  'weather-calc'(root) {
    calcWorkbench(root, {
      title: '气象与天气计算',
      note: '热指数、风寒、露点等为常用近似公式，极端天气请以官方预警为准。',
      groups: [
        { name: '热指数', fields: [['t', '气温 °C', 32], ['rh', '相对湿度 %', 70]], run: (v) => { const T = v.t * 9 / 5 + 32; const HI = -42.379 + 2.04901523 * T + 10.14333127 * v.rh - 0.22475541 * T * v.rh - 0.00683783 * T * T - 0.05481717 * v.rh * v.rh + 0.00122874 * T * T * v.rh + 0.00085282 * T * v.rh * v.rh - 0.00000199 * T * T * v.rh * v.rh; return `体感温度（热指数）≈ ${((HI - 32) * 5 / 9).toFixed(1)} °C`; } },
        { name: '风寒指数', fields: [['t', '气温 °C', -5], ['wind', '风速 km/h', 20]], run: (v) => { const T = v.t, W = v.wind; const c = 13.12 + 0.6215 * T - 11.37 * W ** 0.16 + 0.3965 * T * W ** 0.16; return `风寒温度 ≈ ${c.toFixed(1)} °C`; } },
        { name: '露点', fields: [['t', '气温 °C', 25], ['rh', '相对湿度 %', 60]], run: (v) => { const a = 17.27, b = 237.7; const alpha = a * v.t / (b + v.t) + Math.log(v.rh / 100); const dp = b * alpha / (a - alpha); return `露点 ≈ ${dp.toFixed(1)} °C\n${dp > 20 ? '闷热，注意通风' : dp > 12 ? '较舒适' : '偏干爽'}`; } },
        { name: '气压高度', fields: [['p', '当地气压 hPa', 1000], ['t', '温度 °C', 15]], run: (v) => `气压高度 ≈ ${(44330 * (1 - (v.p / 1013.25) ** 0.1903)).toFixed(0)} m\n（标准大气近似）` },
        { name: '蒲福风级', fields: [['kmh', '风速 km/h', 25]], run: (v) => { const vv = v.kmh; const level = vv < 1 ? 0 : vv < 6 ? 1 : vv < 12 ? 2 : vv < 20 ? 3 : vv < 29 ? 4 : vv < 39 ? 5 : vv < 50 ? 6 : vv < 62 ? 7 : vv < 75 ? 8 : vv < 89 ? 9 : vv < 103 ? 10 : vv < 118 ? 11 : 12; const names = ['无风', '软风', '轻风', '微风', '和风', '清劲风', '强风', '疾风', '大风', '烈风', '狂风', '暴风', '飓风']; return `${vv} km/h ≈ ${level} 级 · ${names[level]}`; } },
        { name: '紫外线 / AQI', fields: [['uv', 'UV 指数', 6], ['aqi', 'AQI', 80]], run: (v) => `UV ${v.uv}：${v.uv <= 2 ? '低' : v.uv <= 5 ? '中等' : v.uv <= 7 ? '高' : v.uv <= 10 ? '很高' : '极高'}\nAQI ${v.aqi}：${v.aqi <= 50 ? '优' : v.aqi <= 100 ? '良' : v.aqi <= 150 ? '轻度污染' : v.aqi <= 200 ? '中度污染' : '重度污染'}` },
        { name: '降雨量换算', fields: [['mm', '降雨量 mm', 10], ['area', '面积 m²', 100]], run: (v) => `体积：${(v.mm * v.area / 1000).toFixed(2)} m³ = ${(v.mm * v.area).toFixed(0)} L` }
      ]
    });
  },

  /* ================= 天文计算 ================= */
  'astro-calc'(root) {
    calcWorkbench(root, {
      title: '天文与望远镜计算',
      groups: [
        { name: '望远镜倍率', fields: [['f', '物镜焦距 mm', 1000], ['e', '目镜焦距 mm', 25]], run: (v) => `放大倍率：${(v.f / v.e).toFixed(0)}×\n焦比：f/${(v.f / 100).toFixed(1)}（假设口径 100mm）` },
        { name: '视场', fields: [['f', '物镜焦距 mm', 1000], ['e', '目镜焦距 mm', 25], ['afov', '目镜视场 °', 50]], run: (v) => `实际视场：${(v.afov / (v.f / v.e)).toFixed(2)}°\n约 ${(v.afov / (v.f / v.e) * 60).toFixed(1)} 角分` },
        { name: '极限星等', fields: [['d', '口径 mm', 100]], run: (v) => `极限星等 ≈ ${(2.7 + 5 * Math.log10(v.d)).toFixed(2)} 等（理想条件）` },
        { name: '天文单位', fields: [['au', '天文单位 AU', 1]], run: (v) => `${v.au} AU\n= ${(v.au * 1.495978707e8).toFixed(0)} km\n= ${(v.au * 499.004784).toFixed(3)} 光秒\n= ${(v.au / 63241.077).toExponential(3)} 光年\n= ${(v.au / 206264.806).toExponential(3)} 秒差距` },
        { name: '恒星时', fields: [['lon', '经度（东正）', 116.4074], ['date', '日期', new Date().toISOString().slice(0, 10), 'date']], run: (v) => { const d = new Date(v.date); const jd = d.getTime() / 86400000 + 2440587.5; const T = (jd - 2451545) / 36525; const gmst = 280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * T * T; const lst = ((gmst + v.lon) % 360 + 360) % 360; const h = Math.floor(lst / 15), m = Math.floor(lst % 15 * 4); return `当地恒星时 ≈ ${h}h ${m}m（${lst.toFixed(2)}°）`; } },
        { name: '月相', fields: [['date', '日期', new Date().toISOString().slice(0, 10), 'date']], run: (v) => { const m = moon(new Date(v.date)); return `${m.name}\n月龄 ${m.age.toFixed(2)} 天 · 相位 ${(m.age / 29.530588853 * 100).toFixed(1)}%`; } }
      ]
    });
    root.insertAdjacentHTML('beforeend', `<div class="panel" style="margin-top:12px"><div class="panel-head"><b>流星雨与天文事件</b></div><div class="hint">象限仪座 1/3 · 英仙座 8/12 · 猎户座 10/21 · 双子座 12/14（日期为常见极大期，具体以当年预报为准）。日食/月食、行星位置与潮汐需天文历表或在线数据，本站不做精确推算。</div></div>`);
  }
};
