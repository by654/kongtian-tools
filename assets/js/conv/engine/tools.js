/* 工具箱：哈希、编码转换、JSON 格式化、Base64 */
import { baseName, extOf, fmtSize, readAsArrayBuffer, readText, sanitizeFileName } from './utils.js';

const S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
const K = new Uint32Array(64);
for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296);

function rotl(x, c) {
  return ((x << c) | (x >>> (32 - c))) >>> 0;
}

export function md5Hex(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const len = bytes.length;
  const total = Math.ceil((len + 9) / 64) * 64;
  const buf = new Uint8Array(total);
  buf.set(bytes);
  buf[len] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(total - 8, (len * 8) >>> 0, true);
  dv.setUint32(total - 4, Math.floor((len * 8) / 4294967296) >>> 0, true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;
  const M = new Uint32Array(16);

  for (let off = 0; off < total; off += 64) {
    for (let j = 0; j < 16; j++) M[j] = dv.getUint32(off + j * 4, true);
    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;
    for (let i = 0; i < 64; i++) {
      let F;
      let g;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      const tmp = D;
      D = C;
      C = B;
      const sum = (A + F + K[i] + M[g]) >>> 0;
      B = (B + rotl(sum, S[i])) >>> 0;
      A = tmp;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const words = [a0, b0, c0, d0];
  let hex = '';
  for (const w of words) {
    for (let i = 0; i < 4; i++) hex += ((w >>> (i * 8)) & 0xff).toString(16).padStart(2, '0');
  }
  return hex;
}

export async function hashBytes(bytes, algos) {
  const out = [];
  if (algos.includes('MD5')) out.push(['MD5', md5Hex(bytes)]);
  const subtle = {
    'SHA-1': 'SHA-1',
    'SHA-256': 'SHA-256',
    'SHA-512': 'SHA-512',
  };
  for (const alg of algos) {
    if (!subtle[alg]) continue;
    const digest = await crypto.subtle.digest(subtle[alg], bytes);
    const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    out.push([alg, hex]);
  }
  return out;
}

export async function hashFile(file, algos = ['SHA-256']) {
  const bytes = new Uint8Array(await readAsArrayBuffer(file));
  const results = await hashBytes(bytes, algos);
  const when = new Date().toLocaleString('zh-CN');
  const text = [
    `文件：${file.name}`,
    `大小：${fmtSize(file.size)}`,
    `时间：${when}`,
    '-'.repeat(40),
    ...results.map(([k, v]) => `${k}: ${v}`),
    '',
  ].join('\n');
  return { text, name: sanitizeFileName(baseName(file.name) + '-' + algos.join('_').replace(/[^\w-]/g, '') + '.txt') };
}

const ENC_LABELS = {
  'utf-8': 'UTF-8',
  'utf-8-bom': 'UTF-8 (BOM)',
  'utf-16le': 'UTF-16 LE',
  'utf-16be': 'UTF-16 BE',
  gbk: 'GBK / GB18030',
  big5: 'Big5',
  shift_jis: 'Shift-JIS',
  'windows-1252': 'Windows-1252',
  'utf-16': 'UTF-16',
};

export function encodingLabel(code) {
  return ENC_LABELS[code] || code;
}

function encodeUtf16(text, littleEndian) {
  const units = text.length;
  const out = new Uint8Array(units * 2);
  for (let i = 0; i < units; i++) {
    const code = text.charCodeAt(i);
    if (littleEndian) {
      out[i * 2] = code & 0xff;
      out[i * 2 + 1] = code >>> 8;
    } else {
      out[i * 2] = code >>> 8;
      out[i * 2 + 1] = code & 0xff;
    }
  }
  return out;
}

export async function encodingConvert(file, from, to) {
  const text = await readText(file, from || 'utf-8');
  let bytes;
  if (to === 'utf-8') bytes = new TextEncoder().encode(text);
  else if (to === 'utf-8-bom') {
    const body = new TextEncoder().encode(text);
    bytes = new Uint8Array(body.length + 3);
    bytes.set([0xef, 0xbb, 0xbf]);
    bytes.set(body, 3);
  } else if (to === 'utf-16le') bytes = encodeUtf16(text, true);
  else if (to === 'utf-16be') bytes = encodeUtf16(text, false);
  else throw new Error('不支持的输出编码：' + to);

  const ext = extOf(file.name) || 'txt';
  const name = `${baseName(file.name)}-${to}.${ext}`;
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  return { blob, name, text };
}

export function jsonFormat(text, indent = 2) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error('JSON 解析失败：' + e.message);
  }
  return JSON.stringify(parsed, null, indent);
}

export function base64Encode(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function base64Decode(b64) {
  const clean = String(b64).replace(/\s+/g, '');
  let binary;
  try {
    binary = atob(clean);
  } catch (_) {
    throw new Error('不是有效的 Base64 内容');
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

export async function readTextFile(file, encoding = 'utf-8') {
  return readText(file, encoding);
}

export { ENC_LABELS };
