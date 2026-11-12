/* 视频、摄像头与屏幕工具 */
import { esc, copy, toast, download, fmtBytes, readAs } from '../core/ui.js';
import { bindFileZone, fileZone } from '../core/kit.js';

const $ = (root, s) => root.querySelector(s);
const pad = (n) => String(n).padStart(2, '0');

export default {
  /* ================= 摄像头 ================= */
  'camera'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>摄像头</b><span class="hint">首次使用需要授权</span></div>
          <div class="canvas-wrap"><video id="cm-video" autoplay playsinline muted style="width:100%;max-height:520px;transform:scaleX(1)"></video></div>
          <div class="row" style="margin-top:10px">
            <button class="btn primary" id="cm-open">开启摄像头</button><button class="btn" id="cm-switch">切换前后</button>
            <button class="btn" id="cm-mirror">镜像</button><button class="btn" id="cm-photo">拍照</button>
            <button class="btn danger" id="cm-rec">开始录像</button><button class="btn" id="cm-close">关闭</button>
          </div>
          <div class="grid3" style="margin-top:10px">
            <div class="field"><label class="lab">滤镜</label><select class="sel" id="cm-filter"><option value="none">无</option><option value="grayscale(1)">黑白</option><option value="sepia(.6)">复古</option><option value="saturate(1.8)">鲜艳</option><option value="contrast(1.3) brightness(1.1)">高对比</option></select></div>
            <div class="field"><label class="lab">状态</label><div class="hint" id="cm-status" style="padding-top:9px">未开启</div></div>
            <div class="field" style="display:flex;align-items:flex-end"><a class="btn hidden" id="cm-dl">下载录像</a></div>
          </div>
          <div class="thumbs" id="cm-shots" style="margin-top:10px"></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let stream = null, recorder = null, chunks = [], mirror = false, facing = 'user', filter = 'none';
    const open = async () => {
      try {
        stream?.getTracks().forEach((t) => t.stop());
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: true });
        const v = $('#cm-video');
        v.srcObject = stream;
        v.style.filter = filter;
        v.style.transform = `scaleX(${mirror ? -1 : 1})`;
        $('#cm-status').textContent = '摄像头已开启';
      } catch (e) { $('#cm-status').textContent = '无法访问：' + e.message; }
    };
    $('#cm-open').onclick = open;
    $('#cm-switch').onclick = () => { facing = facing === 'user' ? 'environment' : 'user'; open(); };
    $('#cm-mirror').onclick = () => {
      mirror = !mirror;
      $('#cm-video').style.transform = `scaleX(${mirror ? -1 : 1})`;
    };
    $('#cm-filter').onchange = () => {
      filter = $('#cm-filter').value === 'none' ? 'none' : $('#cm-filter').value;
      $('#cm-video').style.filter = filter;
    };
    $('#cm-photo').onclick = () => {
      const v = $('#cm-video');
      if (!stream) return toast('请先开启摄像头', 'err');
      const cv = document.createElement('canvas');
      cv.width = v.videoWidth; cv.height = v.videoHeight;
      const g = cv.getContext('2d');
      g.filter = filter;
      if (mirror) { g.translate(cv.width, 0); g.scale(-1, 1); }
      g.drawImage(v, 0, 0);
      cv.toBlob((b) => {
        const url = URL.createObjectURL(b);
        $('#cm-shots').insertAdjacentHTML('afterbegin', `<div class="thumb"><img src="${url}" alt=""><a class="btn sm" href="${url}" download="photo-${Date.now()}.png" style="position:absolute;right:5px;bottom:5px">下载</a></div>`);
      });
    };
    $('#cm-rec').onclick = () => {
      if (!stream) return toast('请先开启摄像头', 'err');
      if (recorder && recorder.state === 'recording') {
        recorder.stop();
        $('#cm-rec').textContent = '开始录像';
        $('#cm-rec').classList.remove('danger');
        return;
      }
      chunks = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = $('#cm-dl');
        a.href = url; a.download = `video-${Date.now()}.webm`; a.classList.remove('hidden');
        $('#cm-status').textContent = `录像完成 · ${fmtBytes(blob.size)}`;
      };
      recorder.start();
      $('#cm-rec').textContent = '停止录像';
      $('#cm-rec').classList.add('danger');
      $('#cm-status').textContent = '录像中…';
    };
    $('#cm-close').onclick = () => {
      stream?.getTracks().forEach((t) => t.stop()); stream = null;
      $('#cm-video').srcObject = null;
      $('#cm-status').textContent = '已关闭';
      try { recorder?.stop(); } catch { /* */ }
    };
    ctx.onDestroy(() => { stream?.getTracks().forEach((t) => t.stop()); try { recorder?.stop(); } catch { /* */ } });
  },

  /* ================= 屏幕录制 ================= */
  'screen-record'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>屏幕录制</b><span class="hint">选择屏幕 / 窗口 / 标签页，可混入麦克风</span></div>
          <div class="canvas-wrap"><video id="sr-video" autoplay playsinline muted style="width:100%;max-height:460px;background:#000"></video></div>
          <div class="row" style="margin-top:10px">
            <button class="btn primary" id="sr-start">开始录制</button><button class="btn danger" id="sr-stop" disabled>停止</button>
            <label class="row" style="gap:5px"><input type="checkbox" id="sr-mic"> 混入麦克风</label>
            <span class="hint" id="sr-status">待机</span>
          </div>
          <div class="row" style="margin-top:9px"><a class="btn hidden" id="sr-dl">下载 WebM</a></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let display = null, mic = null, ac = null, recorder = null, chunks = [];
    $('#sr-start').onclick = async () => {
      try {
        display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const tracks = [...display.getVideoTracks()];
        let mixedAudio = null;
        if ($('#sr-mic').checked) {
          mic = await navigator.mediaDevices.getUserMedia({ audio: true });
          ac = new (window.AudioContext || window.webkitAudioContext)();
          const dest = ac.createMediaStreamDestination();
          ac.createMediaStreamSource(mic).connect(dest);
          if (display.getAudioTracks().length) ac.createMediaStreamSource(new MediaStream(display.getAudioTracks())).connect(dest);
          mixedAudio = dest.stream.getAudioTracks();
        } else mixedAudio = display.getAudioTracks();
        const mixed = new MediaStream([...tracks, ...mixedAudio]);
        $('#sr-video').srcObject = mixed;
        chunks = [];
        recorder = new MediaRecorder(mixed, { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm' });
        recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = $('#sr-dl'); a.href = url; a.download = `screen-${Date.now()}.webm`; a.classList.remove('hidden');
          $('#sr-status').textContent = `完成 · ${fmtBytes(blob.size)}`;
        };
        recorder.start();
        $('#sr-start').disabled = true; $('#sr-stop').disabled = false;
        $('#sr-status').textContent = '录制中…';
        display.getVideoTracks()[0].onended = () => $('#sr-stop').click();
      } catch (e) { $('#sr-status').textContent = '无法开始：' + e.message; }
    };
    $('#sr-stop').onclick = () => {
      try { recorder?.stop(); } catch { /* */ }
      display?.getTracks().forEach((t) => t.stop());
      mic?.getTracks().forEach((t) => t.stop());
      ac?.close();
      $('#sr-start').disabled = false; $('#sr-stop').disabled = true;
      $('#sr-status').textContent = '已停止';
    };
    ctx.onDestroy(() => { try { recorder?.stop(); } catch { /* */ } display?.getTracks().forEach((t) => t.stop()); mic?.getTracks().forEach((t) => t.stop()); ac?.close(); });
  },

  /* ================= 视频截图 ================= */
  'video-snapshot'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>视频截图 / 帧提取</b></div>
          ${fileZone('vs-zone', { accept: 'video/*', label: '选择视频文件' })}
          <video id="vs-video" controls playsinline style="width:100%;max-height:440px;margin-top:10px;background:#000;border-radius:9px"></video>
          <div class="field" style="margin-top:10px"><label class="lab">时间点 <span id="vs-time">0.0</span> s</label><input type="range" id="vs-seek" min="0" max="100" step="0.1" value="0"></div>
          <div class="row" style="margin-top:9px"><button class="btn primary" id="vs-grab">截取当前帧</button><input class="inp" id="vs-count" type="number" value="6" style="max-width:80px"><button class="btn" id="vs-batch">均匀抽帧</button><span class="hint" id="vs-info">尚未选择视频</span></div>
        </div>
        <div class="panel"><div class="thumbs" id="vs-shots"><div class="hint">截图会显示在这里</div></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let duration = 0, fileName = 'video';
    bindFileZone(root, 'vs-zone', (fs) => {
      const f = fs[0];
      fileName = f.name.replace(/\.\w+$/, '');
      $('#vs-video').src = URL.createObjectURL(f);
      $('#vs-info').textContent = `${f.name} · ${fmtBytes(f.size)}`;
      $('#vs-video').onloadedmetadata = () => {
        duration = $('#vs-video').duration;
        $('#vs-seek').max = duration;
        $('#vs-info').textContent += ` · ${duration.toFixed(1)}s`;
      };
    });
    $('#vs-seek').oninput = () => {
      $('#vs-time').textContent = Number($('#vs-seek').value).toFixed(1);
      $('#vs-video').currentTime = Number($('#vs-seek').value);
    };
    const capture = () => {
      const v = $('#vs-video');
      if (!v.videoWidth) return null;
      const cv = document.createElement('canvas');
      cv.width = v.videoWidth; cv.height = v.videoHeight;
      cv.getContext('2d').drawImage(v, 0, 0);
      return cv;
    };
    const addShot = (cv, label) => {
      cv.toBlob((b) => {
        const url = URL.createObjectURL(b);
        const name = `${fileName}-${label}.png`;
        $('#vs-shots').insertAdjacentHTML('afterbegin', `<div class="thumb"><img src="${url}" alt=""><a class="btn sm" href="${url}" download="${name}" style="position:absolute;right:5px;bottom:5px">下载</a></div>`);
      });
    };
    $('#vs-grab').onclick = () => {
      const cv = capture();
      if (cv) addShot(cv, `frame-${Date.now()}`);
    };
    $('#vs-batch').onclick = async () => {
      if (!duration) return toast('请选择视频', 'err');
      const n = Math.max(1, Math.min(20, Number($('#vs-count').value) || 6));
      const v = $('#vs-video');
      for (let i = 0; i < n; i++) {
        const t = duration * (i + 0.5) / n;
        v.currentTime = t;
        await new Promise((res) => {
          const onSeek = () => { v.removeEventListener('seeked', onSeek); setTimeout(res, 120); };
          v.addEventListener('seeked', onSeek);
        });
        const cv = capture();
        if (cv) addShot(cv, t.toFixed(1) + 's');
      }
    };
  },

  /* ================= 视频信息 ================= */
  'video-info'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">${fileZone('vi-zone', { accept: 'video/*,audio/*', label: '选择视频或音频文件' })}</div>
        <div class="grid2">
          <div class="panel"><div class="panel-head"><b>媒体信息</b></div><div id="vi-info" class="kv"><div class="hint">尚未选择</div></div></div>
          <div class="panel"><div class="panel-head"><b>预览</b></div><div id="vi-preview"><div class="hint">预览区域</div></div></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    bindFileZone(root, 'vi-zone', (fs) => {
      const f = fs[0];
      const url = URL.createObjectURL(f);
      const media = document.createElement(f.type.startsWith('audio') ? 'audio' : 'video');
      media.src = url; media.controls = true;
      media.style.width = '100%';
      $('#vi-preview').innerHTML = ''; $('#vi-preview').appendChild(media);
      const paint = () => {
        $('#vi-info').innerHTML = [
          ['文件名', f.name], ['类型', f.type || '未知'], ['大小', fmtBytes(f.size)],
          ['时长', media.duration ? media.duration.toFixed(2) + ' 秒' : '—'],
          ['分辨率', media.videoWidth ? `${media.videoWidth} × ${media.videoHeight}` : '仅音频'],
          ['宽高比', media.videoWidth ? (media.videoWidth / media.videoHeight).toFixed(2) : '—'],
          ['修改时间', new Date(f.lastModified).toLocaleString()]
        ].map(([k, v]) => `<dt>${k}</dt><dd>${esc(String(v))}</dd>`).join('');
      };
      media.onloadedmetadata = paint;
      paint();
    });
  },

  /* ================= 屏幕测试 ================= */
  'screen-test'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>屏幕测试</b><span class="hint">坏点、色彩、刷新率与显示参数</span></div>
          <div class="row">
            ${[['#ff0000', '红'], ['#00ff00', '绿'], ['#0000ff', '蓝'], ['#ffffff', '白'], ['#000000', '黑'], ['#808080', '灰']].map(([c, n]) => `<button class="btn" data-color="${c}" style="background:${c};color:${c === '#000000' ? '#fff' : '#000'};border-color:transparent">${n}</button>`).join('')}
            <button class="btn" id="st-full">全屏纯色</button><button class="btn" id="st-refresh">测试刷新率</button>
          </div>
          <div id="st-fs" class="hidden" style="position:fixed;inset:0;z-index:999;display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer"></div>
        </div>
        <div class="stat-grid" id="st-stats"></div>
        <div class="panel"><div class="panel-head"><b>实时分辨率 / 视口</b></div><div id="st-live" class="kv" style="margin-top:4px"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const paint = () => {
      $('#st-stats').innerHTML = [
        ['屏幕分辨率', `${screen.width} × ${screen.height}`], ['可用区域', `${screen.availWidth} × ${screen.availHeight}`],
        ['设备像素比', devicePixelRatio], ['颜色深度', screen.colorDepth + ' bit'], ['视口', `${innerWidth} × ${innerHeight}`],
        ['屏幕方向', screen.orientation?.type || '未知'], ['触摸支持', 'ontouchstart' in window ? '支持' : '不支持']
      ].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
      $('#st-live').innerHTML = `<dt>window.innerWidth</dt><dd>${innerWidth}</dd><dt>window.innerHeight</dt><dd>${innerHeight}</dd><dt>devicePixelRatio</dt><dd>${devicePixelRatio}</dd>`;
    };
    paint();
    window.addEventListener('resize', paint);
    root.querySelectorAll('[data-color]').forEach((b) => b.addEventListener('click', () => {
      const el = $('#st-fs');
      el.style.background = b.dataset.color;
      el.textContent = '点击退出 · ' + b.textContent;
      el.classList.remove('hidden');
      el.onclick = () => el.classList.add('hidden');
    }));
    $('#st-full').onclick = () => {
      const cv = document.createElement('canvas');
      cv.width = screen.width; cv.height = screen.height;
      cv.style.cssText = 'position:fixed;inset:0;z-index:999;width:100vw;height:100vh;cursor:pointer';
      document.body.appendChild(cv);
      cv.onclick = () => cv.remove();
      const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000'];
      let i = 0;
      const g = cv.getContext('2d');
      g.fillStyle = colors[0]; g.fillRect(0, 0, cv.width, cv.height);
      cv.addEventListener('click', () => { i = (i + 1) % colors.length; g.fillStyle = colors[i]; g.fillRect(0, 0, cv.width, cv.height); });
    };
    $('#st-refresh').onclick = () => new Promise((resolve) => {
      let frames = 0;
      const start = performance.now();
      const loop = (t) => {
        frames++;
        if (t - start < 1000) requestAnimationFrame(loop);
        else {
          $('#st-stats').insertAdjacentHTML('beforeend', `<div class="stat"><b>${frames} Hz</b><span>实测刷新率（近似）</span></div>`);
          resolve();
        }
      };
      requestAnimationFrame(loop);
    });
  },

  /* ================= 输入设备 ================= */
  'input-test'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>键盘 / 鼠标 / 触摸 / 手柄</b><span class="hint">在下方区域操作，实时显示事件</span></div>
          <div id="it-pad" tabindex="0" style="height:200px;border:1px solid var(--line);border-radius:10px;display:flex;align-items:center;justify-content:center;background:rgba(56,205,240,.04);outline:none;touch-action:none">
            <div class="center"><div class="hint">点击这里获得焦点，然后按键 / 移动鼠标 / 触摸</div><div class="mono" id="it-pos" style="margin-top:8px;color:var(--acc)">—</div></div>
          </div>
          <div class="stat-grid" id="it-keys" style="margin-top:12px"></div>
        </div>
        <div class="panel"><div class="panel-head"><b>事件日志</b><button class="btn sm" id="it-clear">清空</button></div><pre class="out" id="it-log" style="max-height:220px"></pre></div>
        <div class="panel"><div class="panel-head"><b>手柄与震动</b></div><div id="it-pad-out" class="hint">未检测到手柄。连接后按任意键。</div><button class="btn" id="it-vibrate" style="margin-top:8px">测试震动（移动设备）</button></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const log = (t) => { const el = $('#it-log'); el.textContent = `[${new Date().toLocaleTimeString()}] ${t}\n` + el.textContent; if (el.textContent.length > 8000) el.textContent = el.textContent.slice(0, 8000); };
    const pad = $('#it-pad');
    pad.addEventListener('keydown', (e) => {
      e.preventDefault();
      $('#it-keys').innerHTML = [['按键', e.key], ['代码', e.code], ['KeyCode', e.keyCode], ['修饰键', [e.ctrlKey && 'Ctrl', e.shiftKey && 'Shift', e.altKey && 'Alt', e.metaKey && 'Meta'].filter(Boolean).join(' + ') || '无']]
        .map(([k, v]) => `<div class="stat"><b>${esc(String(v))}</b><span>${k}</span></div>`).join('');
      log(`keydown ${e.key} / ${e.code}`);
    });
    pad.addEventListener('mousemove', (e) => {
      const r = pad.getBoundingClientRect();
      $('#it-pos').textContent = `x ${Math.round(e.clientX - r.left)} · y ${Math.round(e.clientY - r.top)} · 按钮 ${e.buttons}`;
    });
    pad.addEventListener('mousedown', (e) => log(`mousedown button=${e.button}`));
    pad.addEventListener('wheel', (e) => { e.preventDefault(); log(`wheel deltaY=${e.deltaY}`); }, { passive: false });
    pad.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      $('#it-pos').textContent = `触摸点 ${e.touches.length} · x ${Math.round(t.clientX)} y ${Math.round(t.clientY)}`;
      log(`touchstart touches=${e.touches.length}`);
    }, { passive: true });
    $('#it-clear').onclick = () => { $('#it-log').textContent = ''; };
    const padLoop = () => {
      const gps = navigator.getGamepads?.() || [];
      const active = [...gps].filter(Boolean);
      if (active.length) {
        $('#it-pad-out').innerHTML = active.map((g) => `<div style="margin-bottom:7px"><b>${esc(g.id)}</b><div class="hint">按钮 ${g.buttons.filter((b) => b.pressed).length} 个按下 · 摇杆 ${g.axes.map((a) => a.toFixed(2)).join(', ')}</div></div>`).join('');
      }
      padRaf = requestAnimationFrame(padLoop);
    };
    let padRaf = requestAnimationFrame(padLoop);
    ctx.onDestroy(() => cancelAnimationFrame(padRaf));
    $('#it-vibrate').onclick = () => {
      if (navigator.vibrate) { navigator.vibrate([200, 100, 200]); log('触发震动'); }
      else toast('当前设备不支持震动 API', 'err');
    };
  }
};
