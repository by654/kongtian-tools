/* 浏览器、设备与测试 */
import { esc, copy, toast } from '../core/ui.js';

const $ = (root, s) => root.querySelector(s);

export default {
  /* ================= 浏览器信息 ================= */
  'browser-info'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>浏览器与设备信息</b><button class="btn sm" id="bi-copy">复制全部</button></div>
          <div id="bi-out" class="kv"></div>
        </div>
        <div class="panel"><div class="panel-head"><b>WebGL 渲染器</b></div><pre class="out" id="bi-gl"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const ua = navigator.userAgent;
    let gl = '不可用';
    try {
      const cv = document.createElement('canvas');
      const ctx = cv.getContext('webgl') || cv.getContext('experimental-webgl');
      if (ctx) {
        const dbg = ctx.getExtension('WEBGL_debug_renderer_info');
        gl = dbg ? `${ctx.getParameter(dbg.UNMASKED_VENDOR_WEBGL)} / ${ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL)}` : 'WebGL 可用（渲染器信息被隐藏）';
      }
    } catch { /* ignore */ }
    const rows = [
      ['User-Agent', ua], ['平台', navigator.platform || '—'], ['语言', navigator.language + ' / ' + (navigator.languages || []).join(', ')],
      ['时区', Intl.DateTimeFormat().resolvedOptions().timeZone], ['CPU 逻辑核心', navigator.hardwareConcurrency || '未知'],
      ['设备内存', navigator.deviceMemory ? navigator.deviceMemory + ' GB' : '未知'], ['屏幕', `${screen.width} × ${screen.height}`],
      ['可用区域', `${screen.availWidth} × ${screen.availHeight}`], ['视口', `${innerWidth} × ${innerHeight}`], ['DPR', devicePixelRatio],
      ['颜色深度', screen.colorDepth + ' bit'], ['在线状态', navigator.onLine ? '在线' : '离线'],
      ['网络类型', navigator.connection?.effectiveType || '未知'], ['Cookie 启用', navigator.cookieEnabled ? '是' : '否'],
      ['WebGL', gl], ['PDF 查看器', navigator.pdfViewerEnabled ? '支持' : '不支持']
    ];
    $('#bi-out').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(String(v))}</dd>`).join('');
    $('#bi-gl').textContent = gl;
    $('#bi-copy').onclick = () => copy(rows.map(([k, v]) => `${k}: ${v}`).join('\n'));
  },

  /* ================= 特性检测 ================= */
  'feature-detect'(root) {
    const $ = (s) => root.querySelector(s);
    const features = [
      ['WebGL 2', () => !!document.createElement('canvas').getContext('webgl2')],
      ['WebAssembly', () => typeof WebAssembly === 'object'],
      ['Service Worker', () => 'serviceWorker' in navigator],
      ['IndexedDB', () => 'indexedDB' in window],
      ['OPFS', () => !!navigator.storage?.getDirectory],
      ['WebRTC', () => !!(window.RTCPeerConnection || window.webkitRTCPeerConnection)],
      ['Web Bluetooth', () => 'bluetooth' in navigator],
      ['Web USB', () => 'usb' in navigator],
      ['Web Serial', () => 'serial' in navigator],
      ['Web NFC', () => 'NDEFReader' in window],
      ['Wake Lock', () => 'wakeLock' in navigator],
      ['Web Share', () => !!navigator.share],
      ['Notification', () => 'Notification' in window],
      ['Clipboard', () => !!navigator.clipboard],
      ['EyeDropper', () => 'EyeDropper' in window],
      ['Speech Recognition', () => !!(window.SpeechRecognition || window.webkitSpeechRecognition)],
      ['Speech Synthesis', () => 'speechSynthesis' in window],
      ['WebGPU', () => 'gpu' in navigator],
      ['File System Access', () => 'showOpenFilePicker' in window],
      ['Gamepad', () => 'getGamepads' in navigator],
      ['Vibration', () => 'vibrate' in navigator],
      ['Web MIDI', () => 'requestMIDIAccess' in navigator],
      ['MediaRecorder', () => 'MediaRecorder' in window],
      ['Picture-in-Picture', () => 'pictureInPictureEnabled' in document]
    ];
    const css = [
      ['CSS Grid', () => CSS.supports('display', 'grid')],
      [':has()', () => CSS.supports('selector(:has(*))')],
      ['Container Queries', () => CSS.supports('container-type', 'inline-size')],
      ['backdrop-filter', () => CSS.supports('backdrop-filter', 'blur(4px)')],
      ['dvh 单位', () => CSS.supports('height', '100dvh')],
      ['color-mix()', () => CSS.supports('color', 'color-mix(in srgb, red, blue)')],
      ['aspect-ratio', () => CSS.supports('aspect-ratio', '1')],
      ['accent-color', () => CSS.supports('accent-color', 'red')]
    ];
    const ok = (f) => { try { return !!f(); } catch { return false; } };
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel"><div class="panel-head"><b>JavaScript / 浏览器 API</b><span class="hint" id="fd-count"></span></div><div id="fd-api" class="tool-ui"></div></div>
        <div class="panel"><div class="panel-head"><b>CSS 特性</b></div><div id="fd-css" class="tool-ui"></div></div>
      </div>`;
    const paint = (el, list) => {
      el.innerHTML = `<div class="grid4">${list.map(([name, fn]) => {
        const on = ok(fn);
        return `<div class="stat"><b style="font-size:13px;color:${on ? 'var(--ok)' : 'var(--err)'}">${on ? '支持' : '不支持'}</b><span>${esc(name)}</span></div>`;
      }).join('')}</div>`;
    };
    paint($('#fd-api'), features);
    paint($('#fd-css'), css);
    $('#fd-count').textContent = `${features.filter(([, f]) => ok(f)).length} / ${features.length}`;
  },

  /* ================= 权限测试 ================= */
  'permission-test'(root) {
    const perms = [
      ['camera', '摄像头', async () => { const s = await navigator.mediaDevices.getUserMedia({ video: true }); s.getTracks().forEach((t) => t.stop()); }],
      ['microphone', '麦克风', async () => { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach((t) => t.stop()); }],
      ['geolocation', '地理位置', () => new Promise((res, rej) => navigator.geolocation.getCurrentPosition(() => res(), rej))],
      ['notifications', '通知', async () => { const r = await Notification.requestPermission(); if (r !== 'granted') throw new Error('未授权'); }],
      ['clipboard-read', '剪贴板读取', async () => { await navigator.clipboard.readText(); }]
    ];
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel"><div class="panel-head"><b>权限状态</b><button class="btn sm" id="pt-refresh">刷新</button></div><div id="pt-list" class="tool-ui"></div></div>
        <div class="panel"><div class="panel-head"><b>说明</b></div><div class="hint">权限状态由浏览器管理。部分浏览器不会暴露 camera / microphone 的查询结果，只能通过实际请求判断。所有请求只用于测试，不会采集或上传任何数据。</div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const paint = async () => {
      const rows = [];
      for (const [name, label, request] of perms) {
        let state = '未知';
        try {
          const st = await navigator.permissions.query({ name });
          state = st.state;
        } catch { state = '需实际请求'; }
        rows.push(`<div class="panel tight"><div class="row between"><div><b>${label}</b><div class="hint">${name} · ${state}</div></div><button class="btn sm" data-perm="${name}">请求权限</button></div></div>`);
      }
      $('#pt-list').innerHTML = rows.join('');
      root.querySelectorAll('[data-perm]').forEach((b) => b.addEventListener('click', async () => {
        const p = perms.find((x) => x[0] === b.dataset.perm);
        try { await p[2](); toast('权限已授予', 'ok'); } catch (e) { toast('未授予或不可用：' + e.message, 'err'); }
        paint();
      }));
    };
    $('#pt-refresh').onclick = paint;
    paint();
  }
};
