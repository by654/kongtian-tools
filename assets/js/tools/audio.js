/* 音频工具 */
import { esc, copy, toast, download, fmtBytes, readAs } from '../core/ui.js';
import { bindFileZone, fileZone } from '../core/kit.js';
import { randInt } from '../core/rand.js';

const $ = (root, s) => root.querySelector(s);
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function encodeWav(buffer) {
  const numCh = buffer.numberOfChannels, len = buffer.length, sr = buffer.sampleRate;
  const data = new DataView(new ArrayBuffer(44 + len * numCh * 2));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); data.setUint32(4, 36 + len * numCh * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, numCh, true);
  data.setUint32(24, sr, true); data.setUint32(28, sr * numCh * 2, true); data.setUint16(32, numCh * 2, true);
  data.setUint16(34, 16, true); str(36, 'data'); data.setUint32(40, len * numCh * 2, true);
  let off = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < numCh; c++) {
    const v = Math.max(-1, Math.min(1, buffer.getChannelData(c)[i]));
    data.setInt16(off, v < 0 ? v * 0x8000 : v * 0x7fff, true);
    off += 2;
  }
  return new Blob([data], { type: 'audio/wav' });
}

function drawWave(cv, buffer, color = '#38cdf0') {
  const g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  const ch = buffer.getChannelData(0);
  const step = Math.ceil(ch.length / cv.width);
  g.strokeStyle = color; g.lineWidth = 2; g.beginPath();
  for (let x = 0; x < cv.width; x++) {
    let min = 1, max = -1;
    for (let i = 0; i < step; i++) {
      const v = ch[x * step + i] || 0;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const y1 = (1 + min) / 2 * cv.height, y2 = (1 + max) / 2 * cv.height;
    g.moveTo(x, y1); g.lineTo(x, y2);
  }
  g.stroke();
}

export default {
  /* ================= 录音机 ================= */
  'recorder'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>麦克风录音</b><span class="hint">需要授权；音频不会上传</span></div>
          <div class="canvas-wrap"><canvas id="rc-wave" width="760" height="120"></canvas></div>
          <div class="row" style="margin-top:12px"><span class="mono" id="rc-time" style="font-size:22px;color:var(--acc)">00:00</span>
            <button class="btn primary" id="rc-start">开始录音</button><button class="btn danger" id="rc-stop" disabled>停止</button>
            <span class="hint" id="rc-status">待机</span></div>
          <audio id="rc-audio" controls style="width:100%;margin-top:12px;display:none"></audio>
          <div class="row" style="margin-top:9px"><a class="btn hidden" id="rc-dl">下载录音</a></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let stream = null, recorder = null, chunks = [], ac = null, analyser = null, raf = 0, timer = 0, startAt = 0;
    const draw = () => {
      const cv = $('#rc-wave'), g = cv.getContext('2d');
      if (!analyser) return;
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(data);
      g.clearRect(0, 0, cv.width, cv.height);
      g.strokeStyle = '#38cdf0'; g.lineWidth = 2; g.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = i / data.length * cv.width, y = data[i] / 255 * cv.height;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
      raf = requestAnimationFrame(draw);
    };
    $('#rc-start').onclick = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        ac = new (window.AudioContext || window.webkitAudioContext)();
        const src = ac.createMediaStreamSource(stream);
        analyser = ac.createAnalyser(); analyser.fftSize = 1024; src.connect(analyser);
        chunks = [];
        recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const url = URL.createObjectURL(blob);
          $('#rc-audio').src = url; $('#rc-audio').style.display = 'block';
          const a = $('#rc-dl'); a.href = url; a.download = 'recording.webm'; a.classList.remove('hidden');
          $('#rc-status').textContent = `完成 · ${fmtBytes(blob.size)}`;
        };
        recorder.start();
        startAt = Date.now();
        timer = setInterval(() => { $('#rc-time').textContent = fmtTime((Date.now() - startAt) / 1000); }, 500);
        draw();
        $('#rc-start').disabled = true; $('#rc-stop').disabled = false;
        $('#rc-status').textContent = '录音中…';
      } catch (e) { $('#rc-status').textContent = '无法访问麦克风：' + e.message; }
    };
    $('#rc-stop').onclick = () => {
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      stream?.getTracks().forEach((t) => t.stop());
      cancelAnimationFrame(raf);
      ac?.close().catch(() => {});
      clearInterval(timer);
      $('#rc-start').disabled = false; $('#rc-stop').disabled = true;
      $('#rc-status').textContent = '已停止';
    };
    ctx.onDestroy(() => { try { recorder?.stop(); } catch { /* */ } stream?.getTracks().forEach((t) => t.stop()); cancelAnimationFrame(raf); ac?.close(); clearInterval(timer); });
  },

  /* ================= 播放与波形 ================= */
  'audio-player'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>音频播放与可视化</b></div>
          ${fileZone('ap-zone', { accept: 'audio/*', label: '选择音频文件' })}
          <audio id="ap-audio" controls style="width:100%;margin-top:10px"></audio>
          <div class="hint" id="ap-info" style="margin-top:6px">尚未选择文件</div>
        </div>
        <div class="panel"><div class="panel-head"><b>波形</b></div><div class="canvas-wrap"><canvas id="ap-wave" width="760" height="120"></canvas></div></div>
        <div class="panel"><div class="panel-head"><b>频谱</b></div><div class="canvas-wrap"><canvas id="ap-spec" width="760" height="180"></canvas></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let ac = null, analyser = null, raf = 0;
    bindFileZone(root, 'ap-zone', async (fs) => {
      const f = fs[0];
      const url = URL.createObjectURL(f);
      $('#ap-audio').src = url;
      $('#ap-info').textContent = `${f.name} · ${fmtBytes(f.size)}`;
      const buf = await readAs(f, 'arraybuffer');
      const tmp = new (window.AudioContext || window.webkitAudioContext)();
      try {
        const decoded = await tmp.decodeAudioData(buf.slice(0));
        drawWave($('#ap-wave'), decoded);
        $('#ap-info').textContent += ` · ${decoded.duration.toFixed(1)}s · ${decoded.sampleRate} Hz`;
      } catch { /* ignore */ }
      tmp.close();
    });
    $('#ap-audio').addEventListener('play', () => {
      if (ac) return;
      const audio = $('#ap-audio');
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const src = ac.createMediaElementSource(audio);
      analyser = ac.createAnalyser(); analyser.fftSize = 2048;
      src.connect(analyser); analyser.connect(ac.destination);
      const g = $('#ap-spec').getContext('2d');
      const loop = () => {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        g.clearRect(0, 0, 760, 180);
        const step = Math.floor(data.length / 90);
        for (let i = 0; i < 90; i++) {
          const v = data[i * step] / 255;
          const h = v * 170;
          g.fillStyle = `hsl(${190 + i * 1.4}, 80%, ${45 + v * 20}%)`;
          g.fillRect(i * 8.4, 180 - h, 6, h);
        }
        raf = requestAnimationFrame(loop);
      };
      loop();
    });
    ctx.onDestroy(() => { cancelAnimationFrame(raf); ac?.close(); });
  },

  /* ================= 音频剪辑 ================= */
  'audio-edit'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          ${fileZone('ae-zone', { accept: 'audio/*', label: '选择音频文件' })}
          <div class="canvas-wrap" style="margin-top:10px"><canvas id="ae-wave" width="760" height="120"></canvas></div>
          <div class="grid4" style="margin-top:10px">
            <div class="field"><label class="lab">开始（秒）</label><input class="inp" id="ae-start" type="number" step="0.1" value="0"></div>
            <div class="field"><label class="lab">结束（秒）</label><input class="inp" id="ae-end" type="number" step="0.1" value="0"></div>
            <div class="field"><label class="lab">淡入淡出（秒）</label><input class="inp" id="ae-fade" type="number" step="0.1" value="0.2"></div>
            <div class="field"><label class="lab">音量倍率</label><input class="inp" id="ae-gain" type="number" step="0.1" value="1"></div>
          </div>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="ae-run">裁剪并导出 WAV</button><span class="hint" id="ae-info">尚未选择音频</span></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let decoded = null, ac = null;
    bindFileZone(root, 'ae-zone', async (fs) => {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      decoded = await ac.decodeAudioData(await readAs(fs[0], 'arraybuffer'));
      drawWave($('#ae-wave'), decoded);
      $('#ae-end').value = decoded.duration.toFixed(2);
      $('#ae-info').textContent = `${fs[0].name} · ${decoded.duration.toFixed(2)}s · ${decoded.sampleRate} Hz`;
    });
    $('#ae-run').onclick = () => {
      if (!decoded) return toast('请选择音频', 'err');
      const start = Math.max(0, Number($('#ae-start').value) || 0);
      const end = Math.min(decoded.duration, Number($('#ae-end').value) || decoded.duration);
      if (end <= start) return toast('结束时间需大于开始时间', 'err');
      const fade = Math.max(0, Number($('#ae-fade').value) || 0);
      const gain = Number($('#ae-gain').value) || 1;
      const rate = decoded.sampleRate;
      const len = Math.round((end - start) * rate);
      const out = ac.createBuffer(decoded.numberOfChannels, len, rate);
      for (let c = 0; c < decoded.numberOfChannels; c++) {
        const src = decoded.getChannelData(c);
        const dst = out.getChannelData(c);
        for (let i = 0; i < len; i++) {
          let v = src[Math.round(start * rate) + i] * gain;
          const fi = Math.round(fade * rate);
          if (i < fi) v *= i / fi;
          if (i > len - fi) v *= (len - i) / fi;
          dst[i] = Math.max(-1, Math.min(1, v));
        }
      }
      download('edited.wav', encodeWav(out));
      $('#ae-info').textContent = `已导出 ${(len / rate).toFixed(2)} 秒`;
    };
    ctx.onDestroy(() => ac?.close());
  },

  /* ================= 音频转换 ================= */
  'audio-convert'(root, ctx) {
    const $ = (s) => root.querySelector(s);
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>音频 / 视频转 WAV</b><span class="hint">浏览器解码后导出无损 WAV</span></div>
          ${fileZone('ac-zone', { accept: 'audio/*,video/*', label: '选择音频或视频文件' })}
          <div class="row" style="margin-top:10px"><button class="btn primary" id="ac-run">转换为 WAV</button><span class="hint" id="ac-info">尚未选择文件</span></div>
          <div class="hint" style="margin-top:7px">不支持 WAV 以外的有损格式导出；MP3 编码需要额外 WASM 库。</div>
        </div>
      </div>`;
    let file = null, ac = null;
    bindFileZone(root, 'ac-zone', (fs) => { file = fs[0]; $('#ac-info').textContent = `${file.name} · ${fmtBytes(file.size)}`; });
    $('#ac-run').onclick = async () => {
      if (!file) return toast('请选择文件', 'err');
      try {
        ac = ac || new (window.AudioContext || window.webkitAudioContext)();
        $('#ac-info').textContent = '解码中…';
        const buf = await ac.decodeAudioData(await readAs(file, 'arraybuffer'));
        download(file.name.replace(/\.\w+$/, '') + '.wav', encodeWav(buf));
        $('#ac-info').textContent = `完成 · ${buf.duration.toFixed(2)} 秒 · ${buf.sampleRate} Hz`;
      } catch (e) { $('#ac-info').textContent = '解码失败：' + e.message; }
    };
    ctx.onDestroy(() => ac?.close());
  },

  /* ================= 变速与倒放 ================= */
  'audio-speed'(root, ctx) {
    const $ = (s) => root.querySelector(s);
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          ${fileZone('as-zone', { accept: 'audio/*', label: '选择音频文件' })}
          <div class="grid3" style="margin-top:10px">
            <div class="field"><label class="lab">播放速度 <span id="as-v">1.0</span>×</label><input type="range" id="as-rate" min="0.5" max="2" step="0.1" value="1"></div>
            <div class="field"><label class="lab">音调</label><select class="sel" id="as-pitch"><option value="1">保持音调</option><option value="0">随速度变化</option></select></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="as-rev" style="width:100%">生成倒放 WAV</button></div>
          </div>
          <audio id="as-audio" controls style="width:100%;margin-top:10px"></audio>
        </div>
      </div>`;
    let ac = null;
    bindFileZone(root, 'as-zone', (fs) => {
      $('#as-audio').src = URL.createObjectURL(fs[0]);
      $('#as-audio').preservesPitch = true;
    });
    $('#as-rate').oninput = () => {
      $('#as-v').textContent = $('#as-rate').value;
      $('#as-audio').playbackRate = Number($('#as-rate').value);
    };
    $('#as-pitch').onchange = () => {
      const a = $('#as-audio');
      a.preservesPitch = $('#as-pitch').value === '1';
      a.mozPreservesPitch = a.preservesPitch;
      a.webkitPreservesPitch = a.preservesPitch;
    };
    $('#as-rev').onclick = async () => {
      const src = $('#as-audio').src;
      if (!src) return toast('请选择音频', 'err');
      try {
        ac = ac || new (window.AudioContext || window.webkitAudioContext)();
        const buf = await (await fetch(src)).arrayBuffer();
        const decoded = await ac.decodeAudioData(buf);
        const out = ac.createBuffer(decoded.numberOfChannels, decoded.length, decoded.sampleRate);
        for (let c = 0; c < decoded.numberOfChannels; c++) {
          const s = decoded.getChannelData(c), d = out.getChannelData(c);
          for (let i = 0; i < s.length; i++) d[i] = s[s.length - 1 - i];
        }
        download('reversed.wav', encodeWav(out));
      } catch (e) { toast('失败：' + e.message, 'err'); }
    };
    ctx.onDestroy(() => ac?.close());
  },

  /* ================= 节拍器 ================= */
  'metronome'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel center" style="padding:28px">
          <div id="mt-beat" style="width:84px;height:84px;border-radius:50%;background:rgba(56,205,240,.12);border:2px solid rgba(56,205,240,.4);margin:0 auto;transition:.08s"></div>
          <div class="mono" style="font-size:40px;font-weight:800;color:var(--acc);margin-top:12px"><span id="mt-bpm-v">100</span><span style="font-size:16px"> BPM</span></div>
          <div class="grid3" style="margin-top:16px;max-width:520px;margin-left:auto;margin-right:auto">
            <div class="field"><label class="lab">BPM</label><input type="range" id="mt-bpm" min="30" max="240" value="100"></div>
            <div class="field"><label class="lab">每小节拍数</label><input class="inp" id="mt-beats" type="number" value="4" min="1" max="12"></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="mt-toggle" style="width:100%">开始</button></div>
          </div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let timer = null, beat = 0, ac = null;
    const click = (accent) => {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = accent ? 1320 : 880;
      g.gain.setValueAtTime(0.25, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.06);
      o.connect(g); g.connect(ac.destination);
      o.start(); o.stop(ac.currentTime + 0.07);
      const el = $('#mt-beat');
      el.style.background = accent ? 'rgba(56,205,240,.5)' : 'rgba(56,205,240,.2)';
      el.style.transform = 'scale(1.12)';
      setTimeout(() => { el.style.transform = 'scale(1)'; }, 70);
    };
    const start = () => {
      const bpm = Number($('#mt-bpm').value);
      const beats = Number($('#mt-beats').value) || 4;
      click(beat % beats === 0);
      beat++;
      timer = setTimeout(start, 60000 / bpm);
    };
    $('#mt-toggle').onclick = () => {
      if (timer) { clearTimeout(timer); timer = null; $('#mt-toggle').textContent = '开始'; }
      else { beat = 0; start(); $('#mt-toggle').textContent = '停止'; }
    };
    $('#mt-bpm').oninput = () => { $('#mt-bpm-v').textContent = $('#mt-bpm').value; };
    ctx.onDestroy(() => { clearTimeout(timer); ac?.close(); });
  },

  /* ================= 调音器 ================= */
  'tuner'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel center" style="padding:28px">
          <div id="tn-note" style="font-size:64px;font-weight:800;color:var(--acc);font-family:var(--mono)">—</div>
          <div class="hint" id="tn-freq">等待麦克风</div>
          <div class="progress" style="max-width:420px;margin:16px auto 0;height:8px"><i id="tn-bar" style="width:50%"></i></div>
          <div class="row" style="justify-content:center;margin-top:14px"><button class="btn primary" id="tn-start">开始检测</button><button class="btn" id="tn-stop">停止</button><button class="btn" id="tn-ref">播放 A4 标准音</button></div>
        </div>
        <div class="panel"><div class="hint">标准音高：A4 = 440 Hz。检测结果受环境噪音影响，安静环境下更准确。</div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let stream = null, ac = null, analyser = null, raf = 0;
    const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const detect = (buf, sampleRate) => {
      let rms = 0;
      for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
      rms = Math.sqrt(rms / buf.length);
      if (rms < 0.01) return -1;
      const minLag = Math.max(2, Math.floor(sampleRate / 2000));
      const maxLag = Math.min(buf.length - 2, Math.ceil(sampleRate / 50));
      let best = -1, bestOff = minLag;
      for (let off = minLag; off < maxLag; off++) {
        let sum = 0;
        for (let i = 0; i < buf.length - off; i += 2) sum += buf[i] * buf[i + off];
        if (sum > best) { best = sum; bestOff = off; }
      }
      return best > 0 ? sampleRate / bestOff : -1;
    };
    const loop = () => {
      if (!analyser) return;
      const buf = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(buf);
      const f = detect(buf, ac.sampleRate);
      if (f > 40 && f < 2000) {
        const midi = Math.round(12 * Math.log2(f / 440) + 69);
        const note = NOTE[midi % 12] + (Math.floor(midi / 12) - 1);
        const target = 440 * 2 ** ((midi - 69) / 12);
        const cents = Math.round(1200 * Math.log2(f / target));
        $('#tn-note').textContent = note;
        $('#tn-freq').textContent = `${f.toFixed(1)} Hz · ${cents > 0 ? '+' : ''}${cents} cents`;
        $('#tn-bar').style.width = Math.max(0, Math.min(100, 50 + cents)) + '%';
      }
      raf = requestAnimationFrame(loop);
    };
    $('#tn-start').onclick = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        ac = new (window.AudioContext || window.webkitAudioContext)();
        const src = ac.createMediaStreamSource(stream);
        analyser = ac.createAnalyser(); analyser.fftSize = 4096;
        src.connect(analyser);
        loop();
        $('#tn-freq').textContent = '正在聆听…';
      } catch (e) { $('#tn-freq').textContent = '麦克风不可用：' + e.message; }
    };
    $('#tn-stop').onclick = () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      ac?.close(); ac = null; analyser = null;
      $('#tn-note').textContent = '—'; $('#tn-freq').textContent = '已停止';
    };
    $('#tn-ref').onclick = () => {
      const a = new (window.AudioContext || window.webkitAudioContext)();
      const o = a.createOscillator(), g = a.createGain();
      o.frequency.value = 440; g.gain.value = 0.15;
      o.connect(g); g.connect(a.destination); o.start();
      setTimeout(() => { o.stop(); a.close(); }, 1500);
    };
    ctx.onDestroy(() => { cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); ac?.close(); });
  },

  /* ================= 噪音混音 ================= */
  'noise'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>白 / 粉 / 棕噪音混音器</b><span class="hint">适合专注与助眠</span></div>
          <div class="grid3">
            ${['白噪音|white', '粉噪音|pink', '棕噪音|brown'].map((x) => { const [n, t] = x.split('|'); return `<div class="field"><label class="lab">${n} <span id="nz-${t}-v">0</span></label><input type="range" id="nz-${t}" min="0" max="100" value="40"></div>`; }).join('')}
          </div>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="nz-toggle">开始播放</button><span class="hint" id="nz-status">停止</span></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let ac = null, nodes = [], playing = false;
    const makeNoise = (type, gainVal) => {
      const len = ac.sampleRate * 2;
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const data = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (type === 'white') data[i] = w;
        else if (type === 'brown') { last = (last + 0.02 * w) / 1.02; data[i] = last * 3.5; }
        else { data[i] = (last + 0.02 * w) / 1.02 * 3.5; last = data[i]; }
      }
      const src = ac.createBufferSource();
      src.buffer = buf; src.loop = true;
      const g = ac.createGain(); g.gain.value = gainVal;
      src.connect(g); g.connect(ac.destination);
      src.start();
      return { src, g };
    };
    const update = () => {
      if (!playing) return;
      nodes.forEach((n, i) => {
        const type = ['white', 'pink', 'brown'][i];
        n.g.gain.value = Number($('#nz-' + type).value) / 100 * 0.35;
      });
    };
    ['white', 'pink', 'brown'].forEach((t) => {
      $('#nz-' + t).addEventListener('input', () => { $('#nz-' + t + '-v').textContent = $('#nz-' + t).value; update(); });
    });
    $('#nz-toggle').onclick = () => {
      if (playing) {
        nodes.forEach((n) => { try { n.src.stop(); } catch { /* */ } });
        ac?.close(); ac = null; nodes = []; playing = false;
        $('#nz-toggle').textContent = '开始播放'; $('#nz-status').textContent = '停止';
        return;
      }
      ac = new (window.AudioContext || window.webkitAudioContext)();
      nodes = ['white', 'pink', 'brown'].map((t) => makeNoise(t, Number($('#nz-' + t).value) / 100 * 0.35));
      playing = true;
      $('#nz-toggle').textContent = '停止播放'; $('#nz-status').textContent = '播放中…';
    };
    ctx.onDestroy(() => { nodes.forEach((n) => { try { n.src.stop(); } catch { /* */ } }); ac?.close(); });
  },

  /* ================= 合成器 ================= */
  'synth'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="row between">
            <div class="row"><select class="sel" id="sy-wave" style="max-width:130px"><option value="sine">正弦波</option><option value="triangle">三角波</option><option value="square">方波</option><option value="sawtooth">锯齿波</option></select>
            <span class="hint">点击琴键发声</span></div>
            <div class="row"><button class="btn sm" data-chord="major">大三和弦</button><button class="btn sm" data-chord="minor">小三和弦</button><button class="btn sm" data-chord="sus4">sus4</button></div>
          </div>
          <div class="canvas-wrap" style="margin-top:10px;overflow-x:auto"><div id="sy-keys" style="display:flex;gap:3px;min-width:520px"></div></div>
        </div>
        <div class="panel"><div class="panel-head"><b>音阶参考</b></div><div class="hint">C 大调：C D E F G A B · A 小调：A B C D E F G · 五声音阶：C D E G A</div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const notes = ['C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4', 'C5'];
    const freq = (n) => {
      const map = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
      const m = n.match(/^([A-G]#?)(\d)$/);
      const midi = (Number(m[2]) + 1) * 12 + map[m[1]];
      return 440 * 2 ** ((midi - 69) / 12);
    };
    let ac = null;
    const play = (f, dur = 0.6) => {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = $('#sy-wave').value;
      o.frequency.value = f;
      g.gain.setValueAtTime(0.001, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2, ac.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
      o.connect(g); g.connect(ac.destination);
      o.start(); o.stop(ac.currentTime + dur + 0.05);
    };
    $('#sy-keys').innerHTML = notes.map((n) => {
      const black = n.includes('#');
      return `<button class="sy-key" data-note="${n}" style="flex:1;height:${black ? 90 : 130}px;margin-top:${black ? 0 : 14}px;border-radius:0 0 8px 8px;border:1px solid var(--line);background:${black ? '#1b2334' : '#e9eefc'};color:${black ? '#e9eefc' : '#0e1a2f'};font-size:11px;font-weight:600">${n}</button>`;
    }).join('');
    root.querySelectorAll('[data-note]').forEach((b) => b.addEventListener('pointerdown', () => play(freq(b.dataset.note))));
    root.querySelectorAll('[data-chord]').forEach((b) => b.addEventListener('click', () => {
      const base = 261.63;
      const chords = { major: [0, 4, 7], minor: [0, 3, 7], sus4: [0, 5, 7] };
      chords[b.dataset.chord].forEach((s) => play(base * 2 ** (s / 12), 1.2));
    }));
    ctx.onDestroy(() => ac?.close());
  }
};
