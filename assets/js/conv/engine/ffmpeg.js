/* ffmpeg.wasm 单线程封装：无 SharedArrayBuffer，可在 GitHub Pages 运行 */
import { loadVendor, VENDOR, streamFetch } from './utils.js';

let ffmpeg = null;
let loaded = false;
let loadPromise = null;
let loadAbort = null;
let execChain = Promise.resolve();

const CORE_URL = new URL('ffmpeg/ffmpeg-core.js', VENDOR).href;
const WASM_URL = new URL('ffmpeg/ffmpeg-core.wasm', VENDOR).href;
const WASM_BYTES = 32129114;

export function isFFmpegLoaded() {
  return loaded && !!ffmpeg;
}

export async function ensureFFmpeg(hooks = {}) {
  if (loaded && ffmpeg) return ffmpeg;
  if (loadPromise) return loadPromise;

  const stage = (msg) => {
    if (hooks.engineStage) hooks.engineStage(msg);
    else if (hooks.onStage) hooks.onStage(msg);
  };
  const report = (received, total) => {
    if (hooks.engineProgress) hooks.engineProgress(received, total);
    else if (hooks.onProgress) hooks.onProgress(total ? received / total : null);
  };

  loadPromise = (async () => {
    stage('加载 ffmpeg 引擎…');
    await loadVendor('ffmpeg/ffmpeg.js');
    const FFmpegWASM = window.FFmpegWASM;
    if (!FFmpegWASM) throw new Error('ffmpeg.wasm 脚本未能初始化');

    // 预下载核心，展示进度；之后的实例化通常会命中浏览器缓存
    try {
      if (!sessionStorage.getItem('kt-ffmpeg-warm')) {
        loadAbort = new AbortController();
        stage('首次下载单线程核心（约 30.6 MB）…');
        await streamFetch(WASM_URL, (ratio, received, total) => {
          report(received, total || WASM_BYTES);
        }, loadAbort.signal);
        sessionStorage.setItem('kt-ffmpeg-warm', '1');
        report(WASM_BYTES, WASM_BYTES);
      }
    } catch (e) {
      if (e && e.name === 'AbortError') throw e;
      // 预下载失败不阻断，交给加载器重试
      console.warn('核心预下载失败，继续尝试加载', e);
    } finally {
      loadAbort = null;
    }

    ffmpeg = new FFmpegWASM.FFmpeg();
    stage('初始化单线程核心…');
    report(0, 0);
    await ffmpeg.load({ coreURL: CORE_URL, wasmURL: WASM_URL });
    loaded = true;
    return ffmpeg;
  })();

  loadPromise = loadPromise.catch((err) => {
    loaded = false;
    try {
      if (ffmpeg) ffmpeg.terminate();
    } catch (_) {}
    ffmpeg = null;
    loadPromise = null;
    throw err;
  });
  return loadPromise;
}

export function terminateFFmpeg() {
  try {
    if (ffmpeg) ffmpeg.terminate();
  } catch (_) {}
  ffmpeg = null;
  loaded = false;
  loadPromise = null;
  if (loadAbort) {
    try { loadAbort.abort(); } catch (_) {}
    loadAbort = null;
  }
}

/** 核心崩溃（wasm 内存越界等）后实例不可复用，需丢弃以免影响后续任务 */
function isCoreCrash(err) {
  const msg = String((err && (err.message || err)) || '');
  return (err && err.name === 'RuntimeError') || /memory access out of bounds|out of memory|RuntimeError/i.test(msg);
}

/**
 * 串行执行一次 ffmpeg 任务
 * @param {object} opts {args, inputs:[{name, data}], outputName, hooks}
 */
export function runFFmpeg({ args, inputs = [], outputName, hooks = {} }) {
  const task = async () => {
    const ff = await ensureFFmpeg(hooks);
    if (hooks.isCancelled && hooks.isCancelled()) throw new DOMException('已取消', 'AbortError');

    const logs = [];
    const onLog = ({ message }) => {
      logs.push(message);
      if (logs.length > 300) logs.shift();
    };
    const onProgress = ({ progress }) => {
      if (Number.isFinite(progress)) hooks.onProgress && hooks.onProgress(Math.max(0, Math.min(1, progress)));
    };

    hooks.onStage && hooks.onStage('写入临时文件…');
    for (const item of inputs) {
      await ff.writeFile(item.name, item.data);
    }

    ff.on('log', onLog);
    ff.on('progress', onProgress);
    try {
      hooks.onStage && hooks.onStage('正在编码…');
      hooks.onProgress && hooks.onProgress(0);
      const code = await ff.exec(args, -1);
      if (typeof code === 'number' && code !== 0) {
        // 失败的任务可能让共享核心处于不稳定状态（实测后续任务会内存越界），
        // 直接丢弃实例，下一次任务重建，避免错误级联。
        terminateFFmpeg();
        throw new Error('ffmpeg 返回错误码 ' + code + (logs.length ? '：' + logs.slice(-3).join(' | ') : ''));
      }
      hooks.onStage && hooks.onStage('读取输出…');
      const data = await ff.readFile(outputName, 'binary');
      if (!data || data.length === 0) throw new Error('转换未生成有效输出');
      return data;
    } catch (err) {
      if (isCoreCrash(err)) terminateFFmpeg();
      throw err;
    } finally {
      try { ff.off('log', onLog); } catch (_) {}
      try { ff.off('progress', onProgress); } catch (_) {}
      if (isFFmpegLoaded()) {
        for (const item of inputs) {
          try { await ff.deleteFile(item.name); } catch (_) {}
        }
        try { await ff.deleteFile(outputName); } catch (_) {}
      }
    }
  };

  const p = execChain.then(task, task);
  execChain = p.then(() => {}, () => {});
  return p;
}

/** 运行无输出的 ffmpeg 命令（如 -encoders），返回日志 */
export async function runFFmpegInfo(args, hooks = {}) {
  const task = async () => {
    const ff = await ensureFFmpeg(hooks);
    const logs = [];
    const onLog = ({ message }) => logs.push(message);
    ff.on('log', onLog);
    try {
      await ff.exec(args, -1);
    } finally {
      try { ff.off('log', onLog); } catch (_) {}
    }
    return logs;
  };
  const p = execChain.then(task, task);
  execChain = p.then(() => {}, () => {});
  return p;
}
