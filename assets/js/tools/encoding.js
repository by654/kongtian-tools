/* 编码与格式转换 */
import { esc, copy, toast, download, fmtBytes, readAs, pickFile } from '../core/ui.js';
import { bindFileZone, fileZone } from '../core/kit.js';

const enc = new TextEncoder();
const dec = new TextDecoder();

function bytesToBin(bytes) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return s; }
function b64encBytes(bytes) { return btoa(bytesToBin(bytes)); }
function b64decBytes(s) { return Uint8Array.from(atob(s.replace(/\s/g, '')), (c) => c.charCodeAt(0)); }
function b64encText(s) { return b64encBytes(enc.encode(s)); }
function b64decText(s) { return dec.decode(b64decBytes(s)); }
function hexBytes(bytes) { return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(''); }

/* Base32 */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32enc(bytes) {
  let bits = 0, val = 0, out = '';
  for (const b of bytes) {
    val = (val << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  while (out.length % 8) out += '=';
  return out;
}
function b32dec(s) {
  s = s.replace(/=+$/, '').toUpperCase();
  let bits = 0, val = 0; const out = [];
  for (const c of s) {
    const i = B32.indexOf(c); if (i < 0) throw new Error('非法 Base32 字符：' + c);
    val = (val << 5) | i; bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Uint8Array.from(out);
}

/* Base58 / Base62 */
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
function baseXenc(bytes, alphabet) {
  const base = BigInt(alphabet.length);
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  let num = 0n;
  for (const b of bytes) num = num * 256n + BigInt(b);
  let out = '';
  while (num > 0n) { out = alphabet[Number(num % base)] + out; num /= base; }
  return alphabet[0].repeat(zeros) + out;
}
function baseXdec(str, alphabet) {
  const base = BigInt(alphabet.length);
  let num = 0n;
  for (const c of str) {
    const i = alphabet.indexOf(c); if (i < 0) throw new Error('非法字符：' + c);
    num = num * base + BigInt(i);
  }
  const bytes = [];
  while (num > 0n) { bytes.unshift(Number(num % 256n)); num /= 256n; }
  let zeros = 0;
  while (zeros < str.length && str[zeros] === alphabet[0]) zeros++;
  return Uint8Array.from([...Array(zeros).fill(0), ...bytes]);
}

/* Ascii85 */
function a85enc(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 4) {
    const chunk = bytes.subarray(i, i + 4);
    const pad = 4 - chunk.length;
    let n = 0;
    for (let j = 0; j < 4; j++) n = n * 256 + (chunk[j] ?? 0);
    let s = '';
    for (let j = 0; j < 5; j++) { s = String.fromCharCode((n % 85) + 33) + s; n = Math.floor(n / 85); }
    out += pad ? s.slice(0, 5 - pad) : s;
  }
  return out;
}
function a85dec(str) {
  str = str.replace(/\s/g, '').replace(/^<~|~>$/g, '');
  const out = [];
  for (let i = 0; i < str.length; i += 5) {
    const chunk = str.slice(i, i + 5);
    const pad = 5 - chunk.length;
    let n = 0;
    for (const c of chunk) n = n * 85 + (c.charCodeAt(0) - 33);
    for (let j = 0; j < 4 - pad; j++) out.push((n >>> (24 - j * 8)) & 255);
  }
  return Uint8Array.from(out);
}

/* Quoted-printable */
function qpenc(bytes) {
  let out = '', lineLen = 0;
  for (const b of bytes) {
    let tok;
    if ((b >= 33 && b <= 60) || (b >= 62 && b <= 126) || b === 32 || b === 9) tok = String.fromCharCode(b);
    else tok = '=' + b.toString(16).toUpperCase().padStart(2, '0');
    if (lineLen + tok.length > 75) { out += '=\r\n'; lineLen = 0; }
    out += tok; lineLen += tok.length;
  }
  return out;
}
function qpdec(s) {
  s = s.replace(/=\r?\n/g, '');
  const out = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(s.slice(i + 1, i + 3))) {
      out.push(parseInt(s.slice(i + 1, i + 3), 16)); i += 2;
    } else out.push(s.charCodeAt(i) & 255);
  }
  return Uint8Array.from(out);
}

/* UUencode */
function uuenc(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 45) {
    const chunk = bytes.subarray(i, i + 45);
    out += String.fromCharCode(chunk.length + 32);
    for (let j = 0; j < chunk.length; j += 3) {
      const b0 = chunk[j], b1 = chunk[j + 1] ?? 0, b2 = chunk[j + 2] ?? 0;
      const vals = [(b0 >> 2) & 63, ((b0 << 4) | (b1 >> 4)) & 63, ((b1 << 2) | (b2 >> 6)) & 63, b2 & 63];
      out += vals.map((v) => String.fromCharCode(v + 32)).join('');
    }
    out += '\r\n';
  }
  return out + '`\r\n';
}
function uudec(s) {
  const out = [];
  for (const line of s.split(/\r?\n/)) {
    if (!line || line === '`') continue;
    const len = line.charCodeAt(0) - 32;
    if (len <= 0) continue;
    const chars = line.slice(1);
    const chunk = [];
    for (let i = 0; i + 3 < chars.length; i += 4) {
      const v = [...chars.slice(i, i + 4)].map((c) => c.charCodeAt(0) - 32);
      chunk.push((v[0] << 2) | (v[1] >> 4), ((v[1] & 15) << 4) | (v[2] >> 2), ((v[2] & 3) << 6) | v[3]);
    }
    out.push(...chunk.slice(0, len));
  }
  return Uint8Array.from(out);
}

/* Punycode */
const P_BASE = 36, P_TMIN = 1, P_TMAX = 26, P_SKEW = 38, P_DAMP = 700, P_INITIAL_BIAS = 72, P_INITIAL_N = 128;
function adapt(delta, points, first) {
  delta = first ? Math.floor(delta / P_DAMP) : delta >> 1;
  delta += Math.floor(delta / points);
  let k = 0;
  while (delta > ((P_BASE - P_TMIN) * P_TMAX) >> 1) { delta = Math.floor(delta / (P_BASE - P_TMIN)); k += P_BASE; }
  return k + Math.floor(((P_BASE - P_TMIN + 1) * delta) / (delta + P_SKEW));
}
function digitToBasic(d) { return String.fromCharCode(d + 22 + (d < 26 ? 75 : 0)); }
function basicToDigit(c) { const code = c.charCodeAt(0); if (code >= 48 && code <= 57) return code - 22; if (code >= 65 && code <= 90) return code - 65; if (code >= 97 && code <= 122) return code - 97; return P_BASE; }
function punyEnc(input) {
  const cps = [...input].map((c) => c.codePointAt(0));
  let n = P_INITIAL_N, delta = 0, bias = P_INITIAL_BIAS;
  const basic = cps.filter((c) => c < 128);
  let out = String.fromCodePoint(...basic);
  let h = basic.length; const b = h;
  if (b) out += '-';
  while (h < cps.length) {
    let m = Infinity;
    for (const c of cps) if (c >= n && c < m) m = c;
    delta += (m - n) * (h + 1); n = m;
    for (const c of cps) {
      if (c < n) delta++;
      if (c === n) {
        let q = delta;
        for (let k = P_BASE; ; k += P_BASE) {
          const t = k <= bias ? P_TMIN : k >= bias + P_TMAX ? P_TMAX : k - bias;
          if (q < t) break;
          out += digitToBasic(t + ((q - t) % (P_BASE - t)));
          q = Math.floor((q - t) / (P_BASE - t));
        }
        out += digitToBasic(q);
        bias = adapt(delta, h + 1, h === b);
        delta = 0; h++;
      }
    }
    delta++; n++;
  }
  return out;
}
function punyDec(input) {
  const lastDash = input.lastIndexOf('-');
  const basic = lastDash >= 0 ? input.slice(0, lastDash) : '';
  const out = [...basic].map((c) => c.codePointAt(0));
  let i = lastDash >= 0 ? lastDash + 1 : 0;
  let n = P_INITIAL_N, bias = P_INITIAL_BIAS, delta = 0;
  while (i < input.length) {
    const oldi = i; let w = 1;
    for (let k = P_BASE; ; k += P_BASE) {
      if (i >= input.length) throw new Error('Punycode 数据不完整');
      const digit = basicToDigit(input[i++]);
      if (digit >= P_BASE) throw new Error('Punycode 非法字符');
      delta += digit * w;
      const t = k <= bias ? P_TMIN : k >= bias + P_TMAX ? P_TMAX : k - bias;
      if (digit < t) break;
      w *= P_BASE - t;
    }
    const len = out.length + 1;
    bias = adapt(delta, len, oldi === 0);
    n += Math.floor(delta / len);
    delta %= len;
    out.splice(delta, 0, n);
    delta++;
  }
  return String.fromCodePoint(...out);
}
function domainEnc(domain) {
  return domain.split('.').map((label) => /[^\x00-\x7F]/.test(label) ? 'xn--' + punyEnc(label) : label).join('.');
}
function domainDec(domain) {
  return domain.split('.').map((label) => label.startsWith('xn--') ? punyDec(label.slice(4)) : label).join('.');
}

/* XML <-> JSON */
function xmlToObj(node) {
  if (node.nodeType === 3) return node.nodeValue.trim() || undefined;
  if (node.nodeType === 8) return undefined;
  const obj = {};
  if (node.attributes?.length) for (const a of node.attributes) obj['@' + a.name] = a.value;
  const children = [...node.childNodes].map(xmlToObj).filter((x) => x !== undefined);
  const texts = children.filter((x) => typeof x === 'string');
  const elems = children.filter((x) => typeof x === 'object');
  if (texts.length) obj['#text'] = texts.join(' ').trim();
  for (const el of elems) {
    for (const [k, v] of Object.entries(el)) {
      if (obj[k] === undefined) obj[k] = v;
      else if (Array.isArray(obj[k])) obj[k].push(v);
      else obj[k] = [obj[k], v];
    }
  }
  const keys = Object.keys(obj);
  return keys.length === 1 && keys[0] === '#text' ? obj['#text'] : obj;
}
function objToXml(obj, name = 'root', indent = 0, pretty = true) {
  const pad = pretty ? '  '.repeat(indent) : '';
  const nl = pretty ? '\n' : '';
  if (obj === null || obj === undefined) return `${pad}<${name}/>${nl}`;
  if (typeof obj !== 'object') return `${pad}<${name}>${esc(String(obj))}</${name}>${nl}`;
  if (Array.isArray(obj)) return obj.map((v) => objToXml(v, name, indent, pretty)).join('');
  const attrs = Object.keys(obj).filter((k) => k.startsWith('@')).map((k) => ` ${k.slice(1)}="${esc(String(obj[k]))}"`).join('');
  const children = Object.keys(obj).filter((k) => !k.startsWith('@') && k !== '#text');
  const text = obj['#text'] !== undefined ? esc(String(obj['#text'])) : '';
  if (!children.length) return `${pad}<${name}${attrs}>${text}</${name}>${nl}`;
  return `${pad}<${name}${attrs}>${nl}${text ? pad + '  ' + text + nl : ''}${children.map((k) => objToXml(obj[k], k, indent + 1, pretty)).join('')}${pad}</${name}>${nl}`;
}

/* INI / TOML */
function parseINI(s) {
  const out = {}; let sec = out;
  for (const raw of s.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;
    const m = line.match(/^\[(.+)\]$/);
    if (m) { out[m[1]] = out[m[1]] || {}; sec = out[m[1]]; continue; }
    const i = line.indexOf('=');
    if (i > 0) sec[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}
function toINI(obj) {
  let out = '';
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out += `[${k}]\n` + Object.entries(v).map(([a, b]) => `${a}=${b}`).join('\n') + '\n\n';
    } else out += `${k}=${v}\n`;
  }
  return out.trim();
}
function parseTOML(s) {
  const out = {}; let sec = out;
  for (const raw of s.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^\[(.+)\]$/);
    if (m) { const path = m[1].split('.').map((x) => x.trim()); let cur = out; for (const p of path) cur = cur[p] = cur[p] || {}; sec = cur; continue; }
    const i = line.indexOf('=');
    if (i > 0) {
      const k = line.slice(0, i).trim();
      let v = line.slice(i + 1).trim();
      if (/^".*"$/.test(v) || /^'.*'$/.test(v)) v = v.slice(1, -1);
      else if (v === 'true' || v === 'false') v = v === 'true';
      else if (/^\[.*\]$/.test(v)) v = v.slice(1, -1).split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      else if (!isNaN(Number(v))) v = Number(v);
      sec[k] = v;
    }
  }
  return out;
}
function toTOML(obj, prefix = '') {
  let head = '', body = '';
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      head += `\n[${prefix ? prefix + '.' : ''}${k}]\n` + toTOML(v, prefix ? prefix + '.' + k : k);
    } else {
      body += `${k} = ${typeof v === 'string' ? JSON.stringify(v) : Array.isArray(v) ? JSON.stringify(v) : v}\n`;
    }
  }
  return body + head;
}

/* 简单 CSV */
function parseCSV(text, delimiter = ',') {
  const rows = []; let row = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === delimiter) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export default {
  /* ================= Base64 ================= */
  'base64'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="b64-tabs">
          <button class="tab active" data-i="0">文本编码/解码</button>
          <button class="tab" data-i="1">文件 → Base64</button>
          <button class="tab" data-i="2">Base64 → 文件</button>
        </div>
        <div class="panel" id="b64-p0">
          <textarea class="ta mono" id="b64-in" rows="8" placeholder="输入文本，支持中文（UTF-8）…"></textarea>
          <div class="row" style="margin-top:10px">
            <button class="btn primary" id="b64-enc">编码</button>
            <button class="btn" id="b64-dec">解码</button>
            <button class="btn" id="b64-copy">复制</button>
          </div>
        </div>
        <div class="panel hidden" id="b64-p1">
          ${fileZone('b64-zone', { label: '选择任意文件，转换为 Base64 / Data URL' })}
          <div class="row" style="margin-top:10px">
            <button class="btn" id="b64-pick">选择文件</button>
            <span class="hint" id="b64-info"></span>
          </div>
        </div>
        <div class="panel hidden" id="b64-p2">
          <textarea class="ta mono" id="b64-src" rows="6" placeholder="粘贴 Base64 或 data:URL…"></textarea>
          <div class="row" style="margin-top:10px">
            <input class="inp" id="b64-name" value="decoded.bin" style="max-width:240px">
            <button class="btn primary" id="b64-file">还原并下载</button>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b><span class="hint" id="b64-meta"></span></div><pre class="out" id="b64-out" style="max-height:320px"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const out = $('#b64-out');
    $('#b64-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#b64-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      [0, 1, 2].forEach((i) => $('#b64-p' + i).classList.toggle('hidden', String(i) !== b.dataset.i));
    });
    $('#b64-enc').onclick = () => { out.textContent = b64encText($('#b64-in').value); $('#b64-meta').textContent = 'UTF-8 → Base64'; };
    $('#b64-dec').onclick = () => {
      try { out.textContent = b64decText($('#b64-in').value); $('#b64-meta').textContent = 'Base64 → UTF-8'; }
      catch { out.textContent = '解码失败：不是合法的 Base64'; }
    };
    $('#b64-copy').onclick = () => copy(out.textContent);
    let bar = null;
    const handleFile = async (f) => {
      const buf = await readAs(f, 'arraybuffer');
      const bytes = new Uint8Array(buf);
      const b64 = b64encBytes(bytes);
      const dataUrl = `data:${f.type || 'application/octet-stream'};base64,${b64}`;
      out.textContent = `文件名：${f.name}\n大小：${fmtBytes(f.size)}\n类型：${f.type || '未知'}\n\n${b64}`;
      $('#b64-info').textContent = `${f.name} · ${fmtBytes(f.size)}`;
      if (bar) bar.remove();
      bar = document.createElement('div');
      bar.className = 'row';
      bar.style.marginTop = '8px';
      bar.innerHTML = `<button class="btn sm" id="b64-copy-data">复制 Data URL</button><button class="btn sm" id="b64-dl">下载 .txt</button>`;
      $('#b64-info').parentElement.after(bar);
      bar.querySelector('#b64-copy-data').onclick = () => copy(dataUrl);
      bar.querySelector('#b64-dl').onclick = () => download(f.name + '.base64.txt', dataUrl, 'text/plain');
    };
    bindFileZone(root, 'b64-zone', (files) => handleFile(files[0]));
    $('#b64-pick').onclick = async () => { const f = await pickFile(); if (f[0]) handleFile(f[0]); };
    $('#b64-file').onclick = () => {
      try {
        const src = $('#b64-src').value.trim();
        const m = src.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
        const b64 = m ? m[3] : src;
        const mime = m?.[1] || 'application/octet-stream';
        const bytes = b64decBytes(b64);
        download($('#b64-name').value || 'decoded.bin', new Blob([bytes], { type: mime }));
        out.textContent = `已还原 ${fmtBytes(bytes.length)}（${mime}）`;
      } catch (e) { out.textContent = '还原失败：' + e.message; }
    };
  },

  /* ================= Base N ================= */
  'base-n'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>Base32 / 58 / 62 / 85 / UU / QP / Punycode</b><span class="hint">文本按 UTF-8 编码后处理</span></div>
          <textarea class="ta mono" id="bn-in" rows="7" placeholder="输入要编码或解码的内容…"></textarea>
          <div class="grid3" style="margin-top:10px">
            <div class="field"><label class="lab">编码</label><select class="sel" id="bn-mode">
              <option value="b32">Base32</option><option value="b58">Base58</option><option value="b62">Base62</option>
              <option value="a85">Ascii85</option><option value="uu">UUencode</option><option value="qp">Quoted-printable</option>
              <option value="puny">Punycode 域名</option>
            </select></div>
            <div class="field"><label class="lab">方向</label><select class="sel" id="bn-dir"><option value="enc">编码</option><option value="dec">解码</option></select></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="bn-run" style="width:100%">执行</button></div>
          </div>
          <div class="row" style="margin-top:8px"><button class="btn" id="bn-copy">复制结果</button><span class="hint" id="bn-meta"></span></div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b></div><pre class="out" id="bn-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#bn-run').onclick = () => {
      const s = $('#bn-in').value;
      const mode = $('#bn-mode').value;
      const dir = $('#bn-dir').value;
      try {
        let out;
        if (mode === 'b32') out = dir === 'enc' ? b32enc(enc.encode(s)) : dec.decode(b32dec(s));
        else if (mode === 'b58') out = dir === 'enc' ? baseXenc(enc.encode(s), B58) : dec.decode(baseXdec(s, B58));
        else if (mode === 'b62') out = dir === 'enc' ? baseXenc(enc.encode(s), B62) : dec.decode(baseXdec(s, B62));
        else if (mode === 'a85') out = dir === 'enc' ? a85enc(enc.encode(s)) : dec.decode(a85dec(s));
        else if (mode === 'uu') out = dir === 'enc' ? uuenc(enc.encode(s)) : dec.decode(uudec(s));
        else if (mode === 'qp') out = dir === 'enc' ? qpenc(enc.encode(s)) : dec.decode(qpdec(s));
        else out = dir === 'enc' ? domainEnc(s) : domainDec(s);
        $('#bn-out').textContent = out;
        $('#bn-meta').textContent = `${[...out].length} 字符`;
      } catch (e) { $('#bn-out').textContent = '失败：' + e.message; }
    };
    $('#bn-copy').onclick = () => copy($('#bn-out').textContent);
    $('#bn-run').click();
  },

  /* ================= 进制 ================= */
  'radix'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>任意进制整数转换</b><span class="hint">使用 BigInt，支持超大整数</span></div>
          <textarea class="ta mono" id="rx-in" rows="4" style="min-height:70px">255</textarea>
          <div class="grid3" style="margin-top:10px">
            <div class="field"><label class="lab">源进制</label><input class="inp" id="rx-from" type="number" min="2" max="36" value="10"></div>
            <div class="field"><label class="lab">目标进制</label><input class="inp" id="rx-to" type="number" min="2" max="36" value="16"></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="rx-run" style="width:100%">转换</button></div>
          </div>
          <div class="row" style="margin-top:8px"><button class="btn" id="rx-copy">复制结果</button><span class="hint" id="rx-meta"></span></div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b></div><pre class="out" id="rx-out"></pre></div>
        <div class="stat-grid" id="rx-all"></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const toBase = (n, base) => {
      if (n === 0n) return '0';
      const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
      let neg = n < 0n; n = neg ? -n : n;
      let out = '';
      while (n > 0n) { out = digits[Number(n % BigInt(base))] + out; n /= BigInt(base); }
      return (neg ? '-' : '') + out;
    };
    const fromBase = (s, base) => {
      const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
      s = s.trim().toLowerCase();
      let neg = false;
      if (s[0] === '-') { neg = true; s = s.slice(1); }
      let n = 0n;
      for (const c of s) {
        const d = digits.indexOf(c);
        if (d < 0 || d >= base) throw new Error(`字符 "${c}" 不属于 ${base} 进制`);
        n = n * BigInt(base) + BigInt(d);
      }
      return neg ? -n : n;
    };
    $('#rx-run').onclick = () => {
      try {
        const from = Math.max(2, Math.min(36, Number($('#rx-from').value) || 10));
        const to = Math.max(2, Math.min(36, Number($('#rx-to').value) || 16));
        const n = fromBase($('#rx-in').value, from);
        $('#rx-out').textContent = toBase(n, to).toUpperCase();
        $('#rx-meta').textContent = `${from} 进制 → ${to} 进制`;
        $('#rx-all').innerHTML = [[2, '二进制'], [8, '八进制'], [10, '十进制'], [16, '十六进制']]
          .map(([b, name]) => `<div class="stat"><b style="font-size:14px;word-break:break-all">${toBase(n, b)}</b><span>${name}</span></div>`).join('');
      } catch (e) { $('#rx-out').textContent = '转换失败：' + e.message; }
    };
    $('#rx-copy').onclick = () => copy($('#rx-out').textContent);
    $('#rx-run').click();
  },

  /* ================= 文本与字节 ================= */
  'text-binary'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>文本与字节</b><span class="hint">文本按 UTF-8 处理</span></div>
          <textarea class="ta mono" id="tb-in" rows="7">Hello 空天</textarea>
          <div class="row" style="margin-top:10px">
            <select class="sel" id="tb-mode" style="max-width:250px">
              <option value="t2b">文本 → 二进制</option><option value="b2t">二进制 → 文本</option>
              <option value="t2h">文本 → 十六进制</option><option value="h2t">十六进制 → 文本</option>
              <option value="t2a">文本 → ASCII 码</option><option value="a2t">ASCII 码 → 文本</option>
              <option value="utf8">UTF-8 字节查看</option>
            </select>
            <button class="btn primary" id="tb-run">转换</button>
            <button class="btn" id="tb-copy">复制</button>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b><span class="hint" id="tb-meta"></span></div><pre class="out" id="tb-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#tb-run').onclick = () => {
      const s = $('#tb-in').value;
      const mode = $('#tb-mode').value;
      let out = '';
      try {
        if (mode === 't2b') out = [...enc.encode(s)].map((b) => b.toString(2).padStart(8, '0')).join(' ');
        else if (mode === 'b2t') {
          const bin = s.replace(/[^01]/g, '');
          if (bin.length % 8) throw new Error('二进制长度不是 8 的倍数');
          out = dec.decode(Uint8Array.from(bin.match(/.{8}/g).map((x) => parseInt(x, 2))));
        } else if (mode === 't2h') out = hexBytes(enc.encode(s)).replace(/(..)/g, '$1 ').trim();
        else if (mode === 'h2t') {
          const h = s.replace(/[^0-9a-fA-F]/g, '');
          if (h.length % 2) throw new Error('十六进制长度为奇数');
          out = dec.decode(Uint8Array.from(h.match(/../g).map((x) => parseInt(x, 16))));
        } else if (mode === 't2a') out = [...s].map((c) => c.codePointAt(0)).join(' ');
        else if (mode === 'a2t') out = s.trim().split(/[\s,]+/).map((n) => String.fromCodePoint(parseInt(n, 10))).join('');
        else {
          out = [...s].map((c) => {
            const bytes = [...enc.encode(c)].map((b) => b.toString(16).padStart(2, '0')).join(' ');
            return `${c}  U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}  ${bytes}`;
          }).join('\n');
        }
        $('#tb-out').textContent = out;
        $('#tb-meta').textContent = `${enc.encode(s).length} 字节`;
      } catch (e) { $('#tb-out').textContent = '转换失败：' + e.message; }
    };
    $('#tb-copy').onclick = () => copy($('#tb-out').textContent);
    $('#tb-run').click();
  },

  /* ================= XML <-> JSON ================= */
  'xml-json'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>XML / JSON 互转</b><span class="hint">保留属性（@属性）与 #text 文本</span></div>
          <textarea class="ta mono" id="xj-in" rows="9" placeholder="<root><item id=&quot;1&quot;>Hello</item></root>"></textarea>
          <div class="row" style="margin-top:10px">
            <button class="btn primary" id="xj-x2j">XML → JSON</button>
            <button class="btn" id="xj-j2x">JSON → XML</button>
            <button class="btn" id="xj-format">格式化</button>
            <button class="btn" id="xj-copy">复制</button>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b><span class="hint" id="xj-meta"></span></div><pre class="out" id="xj-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#xj-x2j').onclick = () => {
      const doc = new DOMParser().parseFromString($('#xj-in').value, 'application/xml');
      const err = doc.querySelector('parsererror');
      if (err) { $('#xj-out').textContent = 'XML 解析失败：' + err.textContent; return; }
      $('#xj-out').textContent = JSON.stringify({ [doc.documentElement.nodeName]: xmlToObj(doc.documentElement) }, null, 2);
      $('#xj-meta').textContent = 'XML → JSON';
    };
    $('#xj-j2x').onclick = () => {
      try {
        const obj = JSON.parse($('#xj-in').value);
        const key = Object.keys(obj)[0] || 'root';
        $('#xj-out').textContent = objToXml(obj[key], key).trim();
        $('#xj-meta').textContent = 'JSON → XML';
      } catch (e) { $('#xj-out').textContent = 'JSON 解析失败：' + e.message; }
    };
    $('#xj-copy').onclick = () => copy($('#xj-out').textContent);
  },

  /* ================= YAML / TOML / INI ================= */
  'yaml-json'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>配置格式互转</b><span class="hint">YAML 使用 js-yaml，TOML/INI 使用内置解析器</span></div>
          <textarea class="ta mono" id="yj-in" rows="9" placeholder="name: 空天&#10;version: 1.0&#10;features:&#10;  - 文本&#10;  - 图片"></textarea>
          <div class="row" style="margin-top:10px">
            <select class="sel" id="yj-mode" style="max-width:250px">
              <option value="y2j">YAML → JSON</option><option value="j2y">JSON → YAML</option>
              <option value="t2j">TOML → JSON</option><option value="j2t">JSON → TOML</option>
              <option value="i2j">INI → JSON</option><option value="j2i">JSON → INI</option>
            </select>
            <button class="btn primary" id="yj-run">转换</button>
            <button class="btn" id="yj-copy">复制</button>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b><span class="hint" id="yj-meta"></span></div><pre class="out" id="yj-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#yj-run').onclick = async () => {
      const mode = $('#yj-mode').value;
      const s = $('#yj-in').value;
      try {
        if (mode === 'y2j' || mode === 'j2y') {
          await ctx.deps(['yaml']);
          const yaml = window.jsyaml;
          if (mode === 'y2j') $('#yj-out').textContent = JSON.stringify(yaml.load(s), null, 2);
          else $('#yj-out').textContent = yaml.dump(JSON.parse(s), { indent: 2, lineWidth: 120 });
        } else if (mode === 't2j') $('#yj-out').textContent = JSON.stringify(parseTOML(s), null, 2);
        else if (mode === 'j2t') $('#yj-out').textContent = toTOML(JSON.parse(s)).trim();
        else if (mode === 'i2j') $('#yj-out').textContent = JSON.stringify(parseINI(s), null, 2);
        else $('#yj-out').textContent = toINI(JSON.parse(s));
        $('#yj-meta').textContent = '转换完成';
      } catch (e) { $('#yj-out').textContent = '转换失败：' + e.message; }
    };
    $('#yj-copy').onclick = () => copy($('#yj-out').textContent);
  },

  /* ================= CSV <-> JSON ================= */
  'csv-json'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>CSV / JSON 互转</b><span class="hint">CSV 解析使用 PapaParse，自动处理引号与换行</span></div>
          <textarea class="ta mono" id="cj-in" rows="9" placeholder="name,age&#10;小明,18&#10;小红,20"></textarea>
          <div class="grid3" style="margin-top:10px">
            <div class="field"><label class="lab">CSV 分隔符</label><select class="sel" id="cj-delim"><option value=",">逗号 ,</option><option value=";">分号 ;</option><option value="\t">制表符 Tab</option><option value="|">竖线 |</option></select></div>
            <div class="field"><label class="lab">JSON 输出</label><select class="sel" id="cj-shape"><option value="objects">对象数组</option><option value="arrays">二维数组</option></select></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="cj-run" style="width:100%">转换</button></div>
          </div>
          <div class="row" style="margin-top:8px">
            <button class="btn" id="cj-c2j">CSV → JSON</button>
            <button class="btn" id="cj-j2c">JSON → CSV</button>
            <button class="btn" id="cj-copy">复制</button>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b><span class="hint" id="cj-meta"></span></div><pre class="out" id="cj-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#cj-c2j').onclick = async () => {
      try {
        await ctx.deps(['papaparse']);
        const r = window.Papa.parse($('#cj-in').value, { delimiter: $('#cj-delim').value, skipEmptyLines: true });
        if (r.errors.length) throw new Error(r.errors[0].message);
        const rows = r.data;
        const head = rows[0].map((h, i) => h || 'col' + (i + 1));
        const data = rows.slice(1);
        const obj = $('#cj-shape').value === 'arrays'
          ? data
          : data.map((row) => Object.fromEntries(head.map((h, i) => [h, row[i] ?? ''])));
        $('#cj-out').textContent = JSON.stringify(obj, null, 2);
        $('#cj-meta').textContent = `${data.length} 行 × ${head.length} 列`;
      } catch (e) { $('#cj-out').textContent = '失败：' + e.message; }
    };
    $('#cj-j2c').onclick = async () => {
      try {
        await ctx.deps(['papaparse']);
        const obj = JSON.parse($('#cj-in').value);
        $('#cj-out').textContent = window.Papa.unparse(obj, { delimiter: $('#cj-delim').value });
        $('#cj-meta').textContent = 'JSON → CSV';
      } catch (e) { $('#cj-out').textContent = '失败：' + e.message; }
    };
    $('#cj-copy').onclick = () => copy($('#cj-out').textContent);
  },

  /* ================= Excel ================= */
  'excel-convert'(root, ctx) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>Excel / CSV 转换</b><span class="hint">使用 SheetJS，文件不上传</span></div>
          ${fileZone('ec-zone', { accept: '.xlsx,.xls,.csv', label: '选择 Excel 或 CSV 文件' })}
          <div class="row" style="margin-top:10px">
            <select class="sel" id="ec-mode" style="max-width:220px"><option value="json">Excel → JSON</option><option value="csv">Excel → CSV</option><option value="xlsx">CSV → Excel</option></select>
            <button class="btn primary" id="ec-run" disabled>转换</button>
            <span class="hint" id="ec-info">尚未选择文件</span>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>预览 / 结果</b><span class="hint" id="ec-meta"></span></div><div id="ec-out" class="table-scroll" style="max-height:420px;padding:0"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let file = null;
    bindFileZone(root, 'ec-zone', (files) => {
      file = files[0];
      $('#ec-info').textContent = `${file.name} · ${fmtBytes(file.size)}`;
      $('#ec-run').disabled = false;
    });
    $('#ec-run').onclick = async () => {
      if (!file) return;
      try {
        await ctx.deps(['xlsx']);
        const XLSX = window.XLSX;
        const mode = $('#ec-mode').value;
        if (mode === 'xlsx') {
          const text = await readAs(file, 'text');
          const wb = XLSX.read(text, { type: 'string' });
          const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
          download(file.name.replace(/\.csv$/i, '') + '.xlsx', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
          $('#ec-out').innerHTML = '<div class="hint" style="padding:14px">已生成 Excel 文件并开始下载。</div>';
          return;
        }
        const buf = await readAs(file, 'arraybuffer');
        const wb = XLSX.read(buf, { type: 'array' });
        let all = '';
        for (const name of wb.SheetNames) {
          const ws = wb.Sheets[name];
          all += `### ${name}\n` + (mode === 'csv' ? XLSX.utils.sheet_to_csv(ws) : JSON.stringify(XLSX.utils.sheet_to_json(ws), null, 2)) + '\n\n';
        }
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(0, 30);
        $('#ec-out').innerHTML = rows.length ? `<table class="tbl">${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(String(c ?? ''))}</td>`).join('')}</tr>`).join('')}</table>` : '<div class="hint" style="padding:14px">空表</div>';
        $('#ec-meta').textContent = `${wb.SheetNames.length} 个工作表 · ${file.name}`;
        const res = document.createElement('div');
        res.className = 'row';
        res.style.padding = '10px';
        res.innerHTML = `<button class="btn sm" id="ec-copy">复制全部</button><button class="btn sm" id="ec-dl">下载结果</button>`;
        $('#ec-out').prepend(res);
        res.querySelector('#ec-copy').onclick = () => copy(all);
        res.querySelector('#ec-dl').onclick = () => download(file.name.replace(/\.\w+$/, '') + (mode === 'csv' ? '.csv' : '.json'), all, 'text/plain');
      } catch (e) {
        $('#ec-out').innerHTML = `<div class="errbox" style="margin:10px">转换失败：${esc(e.message)}</div>`;
      }
    };
  },

  /* ================= 网页元信息 ================= */
  'meta-tags'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>页面信息</b><span class="hint">生成 SEO / 社交分享 / PWA 标签</span></div>
          <div class="grid2">
            <div class="field"><label class="lab">页面标题</label><input class="inp" id="mt-title" value="空天工具合集 · 浏览器里的万能工具箱"></div>
            <div class="field"><label class="lab">站点地址</label><input class="inp" id="mt-url" value="https://by654.github.io/kongtian-tools/"></div>
            <div class="field"><label class="lab">描述</label><input class="inp" id="mt-desc" value="纯前端工具箱，文件不上传，打开即用。"></div>
            <div class="field"><label class="lab">分享图 URL</label><input class="inp" id="mt-img" value="./assets/favicon.svg"></div>
            <div class="field"><label class="lab">站点名称</label><input class="inp" id="mt-site" value="空天工具合集"></div>
            <div class="field"><label class="lab">Twitter 账号</label><input class="inp" id="mt-tw" value="@kongtian"></div>
          </div>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="mt-run">生成</button><button class="btn" id="mt-copy">复制当前标签</button></div>
        </div>
        <div class="panel">
          <div class="panel-head"><b>输出</b>
            <select class="sel" id="mt-type" style="max-width:220px">
              <option value="meta">Meta + OG + Twitter</option><option value="jsonld">JSON-LD</option>
              <option value="manifest">PWA Manifest</option><option value="robots">robots.txt</option>
              <option value="sitemap">sitemap.xml</option><option value="rss">RSS 2.0</option>
            </select>
          </div>
          <pre class="out" id="mt-out" style="max-height:420px"></pre>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const gen = () => {
      const title = $('#mt-title').value, url = $('#mt-url').value, desc = $('#mt-desc').value;
      const img = $('#mt-img').value, site = $('#mt-site').value, tw = $('#mt-tw').value;
      const type = $('#mt-type').value;
      if (type === 'meta') {
        return `<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#070b14">
<link rel="canonical" href="${esc(url)}">

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(site)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(img)}">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(img)}">
<meta name="twitter:site" content="${esc(tw)}">`;
      }
      if (type === 'jsonld') {
        return JSON.stringify({
          '@context': 'https://schema.org', '@type': 'WebSite', name: site, url,
          description: desc, potentialAction: { '@type': 'SearchAction', target: `${url}#/all?q={search_term_string}`, 'query-input': 'required name=search_term_string' }
        }, null, 2);
      }
      if (type === 'manifest') {
        return JSON.stringify({
          name: title, short_name: site, description: desc, start_url: './', scope: './',
          display: 'standalone', background_color: '#070b14', theme_color: '#070b14', lang: 'zh-CN',
          icons: [{ src: './assets/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }]
        }, null, 2);
      }
      if (type === 'robots') return `User-agent: *\nAllow: /\n\nSitemap: ${url.replace(/\/$/, '')}/sitemap.xml`;
      if (type === 'sitemap') return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${esc(url)}</loc>\n    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>`;
      return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n  <title>${esc(title)}</title>\n  <link>${esc(url)}</link>\n  <description>${esc(desc)}</description>\n  <language>zh-CN</language>\n  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n  <item>\n    <title>${esc(title)}</title>\n    <link>${esc(url)}</link>\n    <description>${esc(desc)}</description>\n    <pubDate>${new Date().toUTCString()}</pubDate>\n  </item>\n</channel>\n</rss>`;
    };
    $('#mt-run').onclick = () => { $('#mt-out').textContent = gen(); };
    $('#mt-copy').onclick = () => copy($('#mt-out').textContent);
    $('#mt-type').addEventListener('change', () => { $('#mt-out').textContent = gen(); });
    $('#mt-run').click();
  }
};
