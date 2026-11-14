/* 压缩包解压：ZIP / TAR / GZIP */
import { baseName, extOf, loadVendor, makeZip, readAsArrayBuffer, sanitizeFileName } from './utils.js';

const MAX_ENTRIES = 2000;
const MAX_TOTAL = 500 * 1024 * 1024;

async function unzip(file, hooks) {
  await loadVendor('jszip/jszip.min.js');
  let zip;
  try {
    zip = await window.JSZip.loadAsync(await readAsArrayBuffer(file));
  } catch (e) {
    throw new Error('ZIP 解析失败（可能已加密或文件损坏）');
  }
  const entries = [];
  zip.forEach((path, entry) => {
    if (!entry.dir && !/^__MACOSX\//.test(path)) entries.push({ path, entry });
  });
  if (!entries.length) throw new Error('压缩包内没有文件');
  if (entries.length > MAX_ENTRIES) throw new Error(`压缩包文件数超过 ${MAX_ENTRIES} 个，暂不支持`);

  const outputs = [];
  let total = 0;
  for (let i = 0; i < entries.length; i++) {
    if (hooks.isCancelled && hooks.isCancelled()) throw new DOMException('已取消', 'AbortError');
    hooks.onStage && hooks.onStage(`解压 ${i + 1}/${entries.length}：${entries[i].path}`);
    hooks.onProgress && hooks.onProgress((i + 1) / entries.length);
    const blob = await entries[i].entry.async('blob');
    total += blob.size;
    if (total > MAX_TOTAL) throw new Error('解压后总大小超过 500 MB 上限');
    outputs.push({ name: sanitizeFileName(entries[i].path.replace(/\//g, '_')), blob, size: blob.size });
  }
  return outputs;
}

function decodeAscii(bytes) {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function parseTar(bytes) {
  const out = [];
  let off = 0;
  while (off + 512 <= bytes.length) {
    const header = bytes.subarray(off, off + 512);
    const name = decodeAscii(header.subarray(0, 100)).replace(/\0[\s\S]*$/, '').trim();
    if (!name) break;
    const size = parseInt(decodeAscii(header.subarray(124, 136)).trim(), 8) || 0;
    const type = header[156] ? String.fromCharCode(header[156]) : '0';
    const prefix = decodeAscii(header.subarray(345, 500)).replace(/\0[\s\S]*$/, '').trim();
    const full = prefix ? prefix + '/' + name : name;
    off += 512;
    const dataSize = Math.ceil(size / 512) * 512;
    if (type === '5' || size <= 0) {
      off += dataSize;
      continue;
    }
    if (type === '0' || type === '7' || type === '\0' || type === 'x') {
      out.push({ name: full, data: new Uint8Array(bytes.subarray(off, off + size)) });
    }
    off += dataSize;
  }
  return out;
}

async function gunzip(arrayBuffer) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('当前浏览器不支持 GZIP 解压（需要较新版本 Chrome / Edge / Firefox / Safari）');
  }
  const stream = new Blob([arrayBuffer]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

/* ---------- 重新打包为 ZIP ---------- */
async function archiveEntries(file, hooks) {
  const ext = extOf(file.name);
  const lower = file.name.toLowerCase();
  const outputs = [];
  let total = 0;
  const push = (name, blob) => {
    total += blob.size;
    if (total > MAX_TOTAL) throw new Error('解压后总大小超过 500 MB 上限');
    outputs.push({ name, blob });
  };

  if (ext === 'zip') {
    await loadVendor('jszip/jszip.min.js');
    let zip;
    try {
      zip = await window.JSZip.loadAsync(await readAsArrayBuffer(file));
    } catch (e) {
      throw new Error('ZIP 解析失败（可能已加密或文件损坏）');
    }
    const list = [];
    zip.forEach((path, entry) => {
      if (!entry.dir && !/^__MACOSX\//.test(path)) list.push({ path, entry });
    });
    if (!list.length) throw new Error('压缩包内没有文件');
    if (list.length > MAX_ENTRIES) throw new Error(`压缩包文件数超过 ${MAX_ENTRIES} 个，暂不支持`);
    for (let i = 0; i < list.length; i++) {
      if (hooks.isCancelled && hooks.isCancelled()) throw new DOMException('已取消', 'AbortError');
      hooks.onStage && hooks.onStage(`读取 ${i + 1}/${list.length}：${list[i].path}`);
      hooks.onProgress && hooks.onProgress((i + 1) / list.length);
      push(list[i].path, await list[i].entry.async('blob'));
    }
    return outputs;
  }

  let entries;
  if (ext === 'gz' || ext === 'tgz') {
    const raw = new Uint8Array(await gunzip(await readAsArrayBuffer(file)));
    if (ext === 'tgz' || lower.endsWith('.tar.gz')) entries = parseTar(raw);
    else {
      const name = file.name.replace(/\.gz$/i, '') || baseName(file.name) + '.out';
      push(name, new Blob([raw]));
      return outputs;
    }
  } else if (ext === 'tar') {
    entries = parseTar(new Uint8Array(await readAsArrayBuffer(file)));
  } else {
    throw new Error('不支持的压缩格式，仅支持 ZIP / TAR / GZIP');
  }
  if (!entries.length) throw new Error('压缩包内没有可读取的文件');
  if (entries.length > MAX_ENTRIES) throw new Error('压缩包文件数过多');
  for (let i = 0; i < entries.length; i++) {
    if (hooks.isCancelled && hooks.isCancelled()) throw new DOMException('已取消', 'AbortError');
    hooks.onStage && hooks.onStage(`读取 ${i + 1}/${entries.length}：${entries[i].name}`);
    hooks.onProgress && hooks.onProgress((i + 1) / entries.length);
    push(entries[i].name, new Blob([entries[i].data]));
  }
  return outputs;
}

export async function repackZip(file, params = {}, hooks = {}) {
  const entries = await archiveEntries(file, hooks);
  hooks.onStage && hooks.onStage('写入 ZIP…');
  const level = Number(params.zipLevel);
  const blob = await makeZip(entries, { level: Number.isFinite(level) ? level : 6, keepPaths: true });
  return [{
    name: baseName(file.name) + '-repacked.zip',
    blob,
    size: blob.size,
    extra: entries.length,
  }];
}

export async function extractArchive(file, params = {}, hooks = {}) {
  const ext = extOf(file.name);
  const lower = file.name.toLowerCase();
  hooks.onStage && hooks.onStage('读取压缩包…');

  if (ext === 'zip') return unzip(file, hooks);

  if (ext === 'gz' || ext === 'tgz') {
    const raw = await gunzip(await readAsArrayBuffer(file));
    const isTar = ext === 'tgz' || lower.endsWith('.tar.gz');
    if (isTar) {
      const entries = parseTar(new Uint8Array(raw));
      if (!entries.length) throw new Error('TAR 内没有可解出的文件');
      if (entries.length > MAX_ENTRIES) throw new Error('压缩包文件数过多');
      const outputs = [];
      let total = 0;
      for (let i = 0; i < entries.length; i++) {
        if (hooks.isCancelled && hooks.isCancelled()) throw new DOMException('已取消', 'AbortError');
        hooks.onStage && hooks.onStage(`解压 ${i + 1}/${entries.length}：${entries[i].name}`);
        hooks.onProgress && hooks.onProgress((i + 1) / entries.length);
        const blob = new Blob([entries[i].data]);
        total += blob.size;
        if (total > MAX_TOTAL) throw new Error('解压后总大小超过 500 MB 上限');
        outputs.push({ name: sanitizeFileName(entries[i].name.replace(/\//g, '_')), blob, size: blob.size });
      }
      return outputs;
    }
    const name = sanitizeFileName(file.name.replace(/\.gz$/i, '')) || baseName(file.name) + '.out';
    const blob = new Blob([raw]);
    return [{ name, blob, size: blob.size }];
  }

  if (ext === 'tar') {
    const entries = parseTar(new Uint8Array(await readAsArrayBuffer(file)));
    if (!entries.length) throw new Error('TAR 内没有可解出的文件');
    if (entries.length > MAX_ENTRIES) throw new Error('压缩包文件数过多');
    const outputs = [];
    for (let i = 0; i < entries.length; i++) {
      if (hooks.isCancelled && hooks.isCancelled()) throw new DOMException('已取消', 'AbortError');
      hooks.onStage && hooks.onStage(`解压 ${i + 1}/${entries.length}：${entries[i].name}`);
      hooks.onProgress && hooks.onProgress((i + 1) / entries.length);
      const blob = new Blob([entries[i].data]);
      outputs.push({ name: sanitizeFileName(entries[i].name.replace(/\//g, '_')), blob, size: blob.size });
    }
    return outputs;
  }

  throw new Error('不支持的压缩格式，仅支持 ZIP / TAR / GZIP');
}
