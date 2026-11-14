/* 硬件、WebRTC、IoT 与 3D/XR */
import { esc, copy, toast, download, fmtBytes } from '../core/ui.js';
import { bindFileZone, fileZone } from '../core/kit.js';

const $ = (root, s) => root.querySelector(s);

function parseStl(buf) {
  const dv = new DataView(buf);
  const isAscii = new TextDecoder().decode(new Uint8Array(buf.slice(0, 5))) === 'solid' && !/^\s*solid\s+\w*\s*\n\s*facet/.test('');
  const tris = [];
  if (isAscii && buf.byteLength < 5000000 && new TextDecoder().decode(new Uint8Array(buf.slice(0, 200))).includes('facet')) {
    const text = new TextDecoder().decode(buf);
    const verts = [...text.matchAll(/vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g)].map((m) => [+m[1], +m[2], +m[3]]);
    for (let i = 0; i + 2 < verts.length; i += 3) tris.push([verts[i], verts[i + 1], verts[i + 2]]);
  } else if (buf.byteLength >= 84) {
    const n = dv.getUint32(80, true);
    for (let i = 0; i < n; i++) {
      const off = 84 + i * 50 + 12;
      tris.push([[dv.getFloat32(off, true), dv.getFloat32(off + 4, true), dv.getFloat32(off + 8, true)], [dv.getFloat32(off + 12, true), dv.getFloat32(off + 16, true), dv.getFloat32(off + 20, true)], [dv.getFloat32(off + 24, true), dv.getFloat32(off + 28, true), dv.getFloat32(off + 32, true)]]);
    }
  }
  let vol = 0, area = 0;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const [a, b, c] of tris) {
    vol += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cr = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    area += Math.sqrt(cr[0] ** 2 + cr[1] ** 2 + cr[2] ** 2) / 2;
    [a, b, c].forEach((v) => v.forEach((x, i) => { if (x < min[i]) min[i] = x; if (x > max[i]) max[i] = x; }));
  }
  return { tris: tris.length, volume: Math.abs(vol), area, min, max, size: max.map((x, i) => x - min[i]) };
}

export default {
  /* ================= 硬件测试 ================= */
  'hardware-test'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>硬件与设备能力</b><span class="hint">电池、媒体设备、手柄、传感器、全屏</span></div>
          <div class="row"><button class="btn primary" id="hw-battery">读取电池</button><button class="btn" id="hw-devices">媒体设备</button><button class="btn" id="hw-gamepad">手柄测试</button><button class="btn" id="hw-full">全屏</button><button class="btn" id="hw-pip">画中画</button><button class="btn" id="hw-vibrate">震动</button></div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b></div><pre class="out" id="hw-out" style="max-height:420px"></pre></div>
        <div class="panel"><div class="panel-head"><b>传感器</b></div><div class="row"><button class="btn" id="hw-acc">加速度计</button><button class="btn" id="hw-gyro">陀螺仪</button><span class="hint" id="hw-sensor">点击请求权限</span></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#hw-battery').onclick = async () => {
      if (!navigator.getBattery) { $('#hw-out').textContent = '当前浏览器不支持 Battery API'; return; }
      const b = await navigator.getBattery();
      $('#hw-out').textContent = `电量：${(b.level * 100).toFixed(0)}%\n充电中：${b.charging ? '是' : '否'}\n充满剩余：${b.chargingTime === Infinity ? '—' : (b.chargingTime / 60).toFixed(0) + ' 分钟'}\n放电剩余：${b.dischargingTime === Infinity ? '—' : (b.dischargingTime / 60).toFixed(0) + ' 分钟'}`;
    };
    $('#hw-devices').onclick = async () => {
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        $('#hw-out').textContent = list.map((d) => `${d.kind}\n  ${d.label || '(未授权，标签为空)'}\n  ${d.deviceId.slice(0, 16)}…`).join('\n\n') || '没有设备';
      } catch (e) { $('#hw-out').textContent = e.message; }
    };
    let padTimer = null;
    $('#hw-gamepad').onclick = () => {
      clearInterval(padTimer);
      padTimer = setInterval(() => {
        const pads = [...(navigator.getGamepads?.() || [])].filter(Boolean);
        if (!pads.length) { $('#hw-out').textContent = '未检测到手柄，连接后按下任意键'; return; }
        $('#hw-out').textContent = pads.map((g) => `${g.id}\n按键：${g.buttons.map((b, i) => b.pressed ? i : '').filter(Boolean).join(', ') || '无'}\n摇杆：${g.axes.map((a) => a.toFixed(2)).join(', ')}`).join('\n\n');
      }, 200);
    };
    $('#hw-full').onclick = async () => {
      try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen(); $('#hw-out').textContent = document.fullscreenElement ? '已进入全屏' : '已退出全屏'; }
      catch (e) { $('#hw-out').textContent = '全屏失败：' + e.message; }
    };
    $('#hw-pip').onclick = async () => {
      if (!document.pictureInPictureEnabled) { $('#hw-out').textContent = '当前浏览器不支持画中画'; return; }
      $('#hw-out').textContent = '画中画需要视频元素。可在“视频截图”工具中加载视频后使用浏览器原生控件开启。';
    };
    $('#hw-vibrate').onclick = () => {
      if (navigator.vibrate) { navigator.vibrate([200, 100, 200]); $('#hw-out').textContent = '已触发震动（移动设备）'; }
      else $('#hw-out').textContent = '当前设备不支持震动';
    };
    const sensor = async (type) => {
      const C = window[type];
      if (!C) { $('#hw-sensor').textContent = '不支持 ' + type; return; }
      try {
        if (C.requestPermission) { const p = await C.requestPermission(); if (p !== 'granted') throw new Error('未授权'); }
        const s = new C({ frequency: 10 });
        s.onreading = () => { $('#hw-sensor').textContent = `${type}: x=${s.x?.toFixed(3)} y=${s.y?.toFixed(3)} z=${s.z?.toFixed(3)}`; };
        s.start();
      } catch (e) { $('#hw-sensor').textContent = '失败：' + e.message; }
    };
    $('#hw-acc').onclick = () => sensor('Accelerometer');
    $('#hw-gyro').onclick = () => sensor('Gyroscope');
    ctx.onDestroy(() => clearInterval(padTimer));
  },

  /* ================= WebRTC ================= */
  'webrtc-tools'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>WebRTC 本地回环测试</b><span class="hint">在两个本地 PeerConnection 间建立数据通道</span></div>
          <div class="row"><button class="btn primary" id="wr-run">开始回环测试</button><button class="btn" id="wr-devices">枚举设备</button><span class="hint" id="wr-status">就绪</span></div>
          <pre class="out" id="wr-out" style="margin-top:10px;max-height:260px"></pre>
        </div>
        <div class="panel"><div class="panel-head"><b>SDP 格式化</b></div><textarea class="ta mono" id="wr-sdp" rows="5" placeholder="粘贴 SDP…"></textarea><button class="btn" id="wr-fmt" style="margin-top:8px">格式化</button><pre class="out" id="wr-sdp-out" style="margin-top:8px"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#wr-run').onclick = async () => {
      try {
        $('#wr-out').textContent = '';
        const log = (t) => { $('#wr-out').textContent += t + '\n'; };
        const pc1 = new RTCPeerConnection(), pc2 = new RTCPeerConnection();
        const c1 = [], c2 = [];
        pc1.onicecandidate = (e) => { if (e.candidate) { c1.push(e.candidate); if (pc2.remoteDescription) pc2.addIceCandidate(e.candidate).catch(() => {}); } };
        pc2.onicecandidate = (e) => { if (e.candidate) { c2.push(e.candidate); if (pc1.remoteDescription) pc1.addIceCandidate(e.candidate).catch(() => {}); } };
        const dc = pc1.createDataChannel('test');
        dc.onopen = () => { log('数据通道已打开'); dc.send('hello from pc1'); };
        dc.onmessage = (e) => { log('收到消息：' + e.data); $('#wr-status').textContent = '回环测试成功'; };
        pc2.ondatachannel = (e) => { e.channel.onmessage = (ev) => { log('pc2 收到：' + ev.data); e.channel.send('hello from pc2'); }; };
        const offer = await pc1.createOffer();
        await pc1.setLocalDescription(offer);
        await pc2.setRemoteDescription(offer);
        c1.forEach((cand) => pc2.addIceCandidate(cand).catch(() => {}));
        const answer = await pc2.createAnswer();
        await pc2.setLocalDescription(answer);
        await pc1.setRemoteDescription(answer);
        c2.forEach((cand) => pc1.addIceCandidate(cand).catch(() => {}));
        setTimeout(async () => {
          const stats = await pc1.getStats();
          let pair = '';
          stats.forEach((v) => { if (v.type === 'candidate-pair' && v.state === 'succeeded') pair = `本地候选 ${v.localCandidateId} / 远程 ${v.remoteCandidateId}`; });
          if (pair) log(pair);
          pc1.close(); pc2.close();
        }, 1800);
        $('#wr-status').textContent = '连接中…';
      } catch (e) { $('#wr-status').textContent = '失败：' + e.message; }
    };
    $('#wr-devices').onclick = async () => {
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        $('#wr-out').textContent = list.map((d) => `${d.kind} · ${d.label || '未授权'}`).join('\n');
      } catch (e) { $('#wr-out').textContent = e.message; }
    };
    $('#wr-fmt').onclick = () => {
      $('#wr-sdp-out').textContent = $('#wr-sdp').value.replace(/([a-z]=)/g, '\n$1').replace(/\r/g, '').trim();
    };
  },

  /* ================= IoT ================= */
  'iot-tools'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>IoT 主题与消息设计</b><span class="hint">MQTT 主题、传感器模拟、设备注册</span></div>
          <div class="grid4">
            <div class="field"><label class="lab">租户/项目</label><input class="inp" id="io-tenant" value="kongtian"></div>
            <div class="field"><label class="lab">设备类型</label><input class="inp" id="io-type" value="sensor"></div>
            <div class="field"><label class="lab">设备 ID</label><input class="inp" id="io-id" value="dev-001"></div>
            <div class="field"><label class="lab">QoS</label><select class="sel" id="io-qos"><option>0</option><option>1</option><option selected>2</option></select></div>
          </div>
          <div class="row" style="margin-top:9px"><button class="btn primary" id="io-run">生成主题与消息</button><button class="btn" id="io-sim">模拟传感器数据</button><button class="btn" id="io-register">登记设备</button><button class="btn" id="io-qr">设备二维码</button></div>
        </div>
        <div class="panel"><pre class="out" id="io-out" style="max-height:360px"></pre></div>
        <div class="panel"><div class="panel-head"><b>设备注册表</b></div><div id="io-list" class="table-scroll" style="max-height:240px"></div><div id="io-qrbox" style="margin-top:9px"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#io-run').onclick = () => {
      const topic = `${$('#io-tenant').value}/${$('#io-type').value}/${$('#io-id').value}`;
      $('#io-out').textContent = `主题：${topic}/telemetry\n命令：${topic}/cmd\n状态：${topic}/state\nQoS：${$('#io-qos').value}\n\n消息：\n${JSON.stringify({ deviceId: $('#io-id').value, ts: Date.now(), temp: 25.6, humidity: 58, battery: 92 }, null, 2)}`;
    };
    $('#io-sim').onclick = () => {
      let temp = 25, hum = 55;
      const rows = [['ts', 'temp', 'humidity', 'battery']];
      for (let i = 0; i < 24; i++) {
        temp += (Math.random() - 0.5) * 0.8; hum += (Math.random() - 0.5) * 3;
        rows.push([Date.now() + i * 3600000, temp.toFixed(1), Math.max(20, Math.min(90, hum)).toFixed(0), (100 - i * 3)]);
      }
      $('#io-out').textContent = rows.map((r) => r.join(',')).join('\n');
    };
    const load = () => JSON.parse(localStorage.getItem('kt:devices') || '[]');
    const save = (x) => localStorage.setItem('kt:devices', JSON.stringify(x));
    const paint = () => {
      const list = load();
      $('#io-list').innerHTML = list.length ? `<table class="tbl"><tr><th>设备</th><th>类型</th><th>ID</th><th>状态</th><th></th></tr>${list.map((d, i) => `<tr><td>${esc(d.name)}</td><td>${esc(d.type)}</td><td class="mono">${esc(d.id)}</td><td>${esc(d.status || '在线')}</td><td><button class="btn sm danger" data-del="${i}">删</button></td></tr>`).join('')}</table>` : '<div class="hint">还没有登记设备</div>';
      root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { const l = load(); l.splice(Number(b.dataset.del), 1); save(l); paint(); }));
    };
    $('#io-register').onclick = () => {
      const l = load();
      l.push({ name: $('#io-id').value, type: $('#io-type').value, id: $('#io-id').value + '-' + Date.now().toString().slice(-4), status: '在线' });
      save(l); paint();
    };
    $('#io-qr').onclick = async () => {
      try {
        await ctx.deps(['qrcode']);
        const text = `mqtt://${$('#io-tenant').value}/${$('#io-type').value}/${$('#io-id').value}`;
        const qr = window.qrcode(0, 'M'); qr.addData(text); qr.make();
        const n = qr.getModuleCount(), cell = 4, size = n * cell + 16;
        const cv = document.createElement('canvas'); cv.width = cv.height = size;
        const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, size, size); g.fillStyle = '#000';
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) g.fillRect(8 + c * cell, 8 + r * cell, cell, cell);
        $('#io-qrbox').innerHTML = ''; cv.style.width = '160px'; $('#io-qrbox').appendChild(cv);
      } catch (e) { toast(e.message, 'err'); }
    };
    paint();
    $('#io-run').click();
  },

  /* ================= 3D / XR ================= */
  'xr3d-tools'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>3D / XR 检查</b><span class="hint">WebXR 支持、STL 体积与面积、GLTF 结构</span></div>
          <div class="row"><button class="btn primary" id="xr-check">检测 WebXR</button><span class="hint" id="xr-status">点击检测</span></div>
          ${fileZone('x3-zone', { accept: '.stl,.gltf,.glb', label: '选择 STL / GLTF / GLB 文件' })}
          <button class="btn primary" id="x3-run" style="margin-top:10px">分析模型</button>
        </div>
        <div class="stat-grid" id="x3-stats"></div>
        <div class="panel"><pre class="out" id="x3-out" style="max-height:360px"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#xr-check').onclick = async () => {
      if (!navigator.xr) { $('#xr-status').textContent = '当前浏览器不支持 WebXR'; return; }
      const vr = await navigator.xr.isSessionSupported('immersive-vr');
      const ar = await navigator.xr.isSessionSupported('immersive-ar');
      $('#xr-status').textContent = `VR：${vr ? '支持' : '不支持'} · AR：${ar ? '支持' : '不支持'}`;
    };
    let file = null;
    bindFileZone(root, 'x3-zone', (fs) => { file = fs[0]; });
    $('#x3-run').onclick = async () => {
      if (!file) return toast('请选择模型文件', 'err');
      const name = file.name.toLowerCase();
      if (name.endsWith('.stl')) {
        const st = parseStl(await file.arrayBuffer());
        $('#x3-stats').innerHTML = [['三角形', st.tris.toLocaleString()], ['体积', st.volume.toFixed(2) + ' mm³'], ['表面积', st.area.toFixed(2) + ' mm²'], ['尺寸', st.size.map((x) => x.toFixed(1)).join(' × ') + ' mm']].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
        $('#x3-out').textContent = `包围盒：\nmin ${st.min.map((x) => x.toFixed(2)).join(', ')}\nmax ${st.max.map((x) => x.toFixed(2)).join(', ')}\n\n按 1.24 g/cm³（PLA）估算耗材：${(st.volume / 1000 * 1.24).toFixed(1)} g`;
      } else {
        let json;
        if (name.endsWith('.glb')) {
          const buf = await file.arrayBuffer();
          const dv = new DataView(buf);
          const len = dv.getUint32(12, true);
          json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, len)));
        } else json = JSON.parse(await file.text());
        const meshes = (json.meshes || []).reduce((s, m) => s + m.primitives.length, 0);
        let verts = 0;
        (json.meshes || []).forEach((m) => m.primitives.forEach((p) => { const acc = json.accessors?.[p.attributes?.POSITION]; if (acc) verts += acc.count; }));
        $('#x3-stats').innerHTML = [['网格', meshes], ['节点', json.nodes?.length || 0], ['材质', json.materials?.length || 0], ['动画', json.animations?.length || 0], ['纹理', json.textures?.length || 0], ['顶点', verts.toLocaleString()]].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
        $('#x3-out').textContent = `生成器：${json.asset?.generator || '未知'}\n版本：${json.asset?.version || '—'}\n场景：${json.scenes?.length || 0}\n\n材质：${(json.materials || []).map((m) => m.name || '未命名').join('、') || '无'}\n动画：${(json.animations || []).map((a) => a.name || '未命名').join('、') || '无'}`;
      }
    };
  }
};
