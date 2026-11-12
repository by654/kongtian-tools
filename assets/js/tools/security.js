/* 密码、安全、加密与隐私 */
import { esc, copy, toast, download, fmtBytes, readAs } from '../core/ui.js';
import { bindFileZone, fileZone, loadImage, warn } from '../core/kit.js';
import { randInt } from '../core/rand.js';

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (bytes) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

async function deriveKey(pass, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function aesEncrypt(text, pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text)));
  const out = new Uint8Array(16 + 12 + cipher.length);
  out.set(salt, 0); out.set(iv, 16); out.set(cipher, 28);
  return b64(out);
}
async function aesDecrypt(payload, pass) {
  const bytes = unb64(payload.trim());
  if (bytes.length < 29) throw new Error('密文格式不正确');
  const salt = bytes.slice(0, 16), iv = bytes.slice(16, 28), cipher = bytes.slice(28);
  const key = await deriveKey(pass, salt);
  return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher));
}

/* EXIF 解析 */
function readExif(buf) {
  const view = new DataView(buf);
  if (view.getUint16(0) !== 0xffd8) throw new Error('不是 JPEG 文件');
  let offset = 2, exifStart = -1;
  while (offset < view.byteLength - 4) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    const len = view.getUint16(offset + 2);
    if (marker === 0xe1) {
      const sig = new TextDecoder('ascii').decode(new Uint8Array(buf, offset + 4, 6));
      if (sig === 'Exif\0\0') { exifStart = offset + 10; break; }
    }
    offset += 2 + len;
  }
  if (exifStart < 0) return { tags: {}, found: false };
  const tiff = new DataView(buf, exifStart);
  const little = tiff.getUint16(0) === 0x4949;
  const get16 = (o) => tiff.getUint16(o, little);
  const get32 = (o) => tiff.getUint32(o, little);
  if (get16(2) !== 42) return { tags: {}, found: false };
  const ifd0 = get32(4);
  const tags = {};
  const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
  function readEntry(ifdOffset, wanted) {
    if (!ifdOffset || ifdOffset >= tiff.byteLength) return;
    const count = get16(ifdOffset);
    for (let i = 0; i < count; i++) {
      const e = ifdOffset + 2 + i * 12;
      if (e + 12 > tiff.byteLength) break;
      const tag = get16(e);
      const type = get16(e + 2);
      const num = get32(e + 4);
      const size = (TYPE_SIZE[type] || 1) * num;
      let valueOffset = size <= 4 ? e + 8 : get32(e + 8);
      if (valueOffset + size > tiff.byteLength) continue;
      let val = '';
      try {
        if (type === 2) val = new TextDecoder('utf-8').decode(new Uint8Array(tiff.buffer, tiff.byteOffset + valueOffset, num)).replace(/\0+$/, '');
        else if (type === 3) val = get16(valueOffset);
        else if (type === 4 || type === 9) val = get32(valueOffset);
        else if (type === 5 || type === 10) {
          const n = get32(valueOffset), d = get32(valueOffset + 4);
          val = d ? (n / d).toFixed(4).replace(/\.?0+$/, '') : n;
        } else if (type === 7) val = [...new Uint8Array(tiff.buffer, tiff.byteOffset + valueOffset, num)].slice(0, 32).map((x) => x.toString(16).padStart(2, '0')).join(' ');
        tags[tag] = val;
      } catch { /* ignore */ }
    }
  }
  readEntry(ifd0);
  if (tags[0x8769]) readEntry(tags[0x8769]);
  if (tags[0x8825]) readEntry(tags[0x8825]);
  return { tags, found: true };
}
const EXIF_NAMES = {
  0x010f: '相机品牌', 0x0110: '相机型号', 0x0112: '方向', 0x0131: '软件', 0x0132: '修改时间',
  0x8769: 'Exif IFD', 0x8825: 'GPS IFD', 0x9003: '拍摄时间', 0x9004: '数字化时间',
  0x829a: '曝光时间', 0x829d: '光圈', 0x8827: 'ISO', 0x920a: '焦距', 0x9209: '闪光灯',
  0xa002: '像素宽度', 0xa003: '像素高度', 0x9291: '秒级时间', 0x010e: '图像描述', 0x8298: '版权',
  0x0001: 'GPS 纬度参考', 0x0002: 'GPS 纬度', 0x0003: 'GPS 经度参考', 0x0004: 'GPS 经度', 0x0006: 'GPS 高度'
};
function stripExif(buf) {
  const view = new DataView(buf);
  const out = [new Uint8Array(buf, 0, 2)];
  let offset = 2;
  while (offset < view.byteLength - 4) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    const len = view.getUint16(offset + 2);
    const total = 2 + len;
    if (marker === 0xe1) {
      const sig = new TextDecoder('ascii').decode(new Uint8Array(buf, offset + 4, 6));
      if (sig === 'Exif\0\0') { offset += total; continue; }
    }
    out.push(new Uint8Array(buf, offset, total));
    offset += total;
    if (marker === 0xda) { out.push(new Uint8Array(buf, offset)); break; }
  }
  return new Blob(out, { type: 'image/jpeg' });
}

export default {
  /* ================= AES 文本 ================= */
  'aes-text'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>AES-GCM 文本加密</b><span class="hint">PBKDF2 派生密钥，密文包含随机盐与 IV</span></div>
          <textarea class="ta mono" id="at-in" rows="6" placeholder="要加密或解密的文本 / 密文…"></textarea>
          <div class="grid2" style="margin-top:9px">
            <div class="field"><label class="lab">口令</label><input class="inp" id="at-pass" type="password" placeholder="设置一个强口令"></div>
            <div class="field" style="display:flex;align-items:flex-end;gap:6px"><button class="btn primary" id="at-enc" style="flex:1">加密</button><button class="btn" id="at-dec" style="flex:1">解密</button></div>
          </div>
          <div class="row" style="margin-top:9px"><button class="btn" id="at-copy">复制结果</button><span class="hint" id="at-meta"></span></div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b></div><pre class="out" id="at-out"></pre></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#at-enc').onclick = async () => {
      const pass = $('#at-pass').value;
      if (!pass) return toast('请输入口令', 'err');
      try {
        const out = await aesEncrypt($('#at-in').value, pass);
        $('#at-out').textContent = out;
        $('#at-meta').textContent = `密文 ${out.length} 字符 · 忘记口令无法恢复`;
      } catch (e) { $('#at-out').textContent = '加密失败：' + e.message; }
    };
    $('#at-dec').onclick = async () => {
      const pass = $('#at-pass').value;
      if (!pass) return toast('请输入口令', 'err');
      try { $('#at-out').textContent = await aesDecrypt($('#at-in').value, pass); $('#at-meta').textContent = '解密成功'; }
      catch { $('#at-out').textContent = '解密失败：口令错误或密文损坏'; }
    };
    $('#at-copy').onclick = () => copy($('#at-out').textContent);
  },

  /* ================= 文件加密 ================= */
  'aes-file'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>文件 AES 加密 / 解密</b><span class="hint">文件只在本地内存中处理</span></div>
          ${fileZone('af-zone', { label: '选择要加密或解密的文件' })}
          <div class="row" style="margin-top:10px">
            <input class="inp" id="af-pass" type="password" placeholder="口令" style="max-width:220px">
            <button class="btn primary" id="af-enc">加密并下载 .ktenc</button>
            <button class="btn" id="af-dec">解密 .ktenc</button>
          </div>
          <div class="hint" id="af-info" style="margin-top:7px">尚未选择文件</div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let file = null;
    bindFileZone(root, 'af-zone', (files) => { file = files[0]; $('#af-info').textContent = `${file.name} · ${fmtBytes(file.size)}`; });
    $('#af-enc').onclick = async () => {
      if (!file) return toast('请选择文件', 'err');
      const pass = $('#af-pass').value;
      if (!pass) return toast('请输入口令', 'err');
      const buf = new Uint8Array(await readAs(file, 'arraybuffer'));
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await deriveKey(pass, salt);
      const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, buf));
      const header = new Uint8Array(4 + 16 + 12 + 2);
      header.set([0x4b, 0x54, 0x01, 0x00], 0);
      header.set(salt, 4); header.set(iv, 20);
      new DataView(header.buffer).setUint16(32, file.name.length);
      const nameBytes = enc.encode(file.name);
      const out = new Blob([header, nameBytes, cipher], { type: 'application/octet-stream' });
      download(file.name + '.ktenc', out);
      $('#af-info').textContent = `已加密：${file.name} → ${file.name}.ktenc（${fmtBytes(out.size)}）`;
    };
    $('#af-dec').onclick = async () => {
      if (!file) return toast('请选择 .ktenc 文件', 'err');
      const pass = $('#af-pass').value;
      if (!pass) return toast('请输入口令', 'err');
      try {
        const buf = new Uint8Array(await readAs(file, 'arraybuffer'));
        if (buf[0] !== 0x4b || buf[1] !== 0x54) throw new Error('不是本工具生成的密文');
        const salt = buf.slice(4, 20), iv = buf.slice(20, 32);
        const nameLen = new DataView(buf.buffer).getUint16(32);
        const name = dec.decode(buf.slice(34, 34 + nameLen));
        const cipher = buf.slice(34 + nameLen);
        const key = await deriveKey(pass, salt);
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
        download(name, new Blob([plain]));
        $('#af-info').textContent = `已解密：${name}（${fmtBytes(plain.byteLength)}）`;
      } catch (e) { $('#af-info').textContent = '解密失败：' + e.message; }
    };
  },

  /* ================= RSA ================= */
  'rsa-tool'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="rs-tabs"><button class="tab active" data-i="0">密钥生成</button><button class="tab" data-i="1">加密 / 解密</button><button class="tab" data-i="2">签名 / 验签</button></div>
        <div class="panel" id="rs-p0">
          <div class="row"><button class="btn primary" id="rs-gen">生成 RSA-2048 密钥对</button><span class="hint" id="rs-gmeta"></span></div>
          <div class="field" style="margin-top:10px"><label class="lab">公钥（SPKI PEM）</label><textarea class="ta mono" id="rs-pub" rows="5" placeholder="点击生成后显示"></textarea></div>
          <div class="field" style="margin-top:8px"><label class="lab">私钥（PKCS8 PEM）</label><textarea class="ta mono" id="rs-priv" rows="7" placeholder="点击生成后显示"></textarea></div>
          <div class="row" style="margin-top:8px"><button class="btn" id="rs-copy-pub">复制公钥</button><button class="btn" id="rs-copy-priv">复制私钥</button><button class="btn" id="rs-dl">下载密钥</button></div>
        </div>
        <div class="panel hidden" id="rs-p1">
          <div class="field"><label class="lab">公钥 / 私钥 PEM</label><textarea class="ta mono" id="rs-key" rows="4" placeholder="粘贴密钥"></textarea></div>
          <div class="field" style="margin-top:8px"><label class="lab">文本（RSA-OAEP 单次约 190 字节以内）</label><textarea class="ta mono" id="rs-text" rows="4">hello 空天</textarea></div>
          <div class="row" style="margin-top:9px"><button class="btn primary" id="rs-enc">用公钥加密</button><button class="btn" id="rs-dec">用私钥解密</button></div>
          <pre class="out" id="rs-out" style="margin-top:9px"></pre>
        </div>
        <div class="panel hidden" id="rs-p2">
          <div class="field"><label class="lab">私钥 PEM（签名）</label><textarea class="ta mono" id="rs-skey" rows="4"></textarea></div>
          <div class="field" style="margin-top:8px"><label class="lab">原文</label><textarea class="ta mono" id="rs-msg" rows="3">需要签名的内容</textarea></div>
          <div class="field" style="margin-top:8px"><label class="lab">签名（Base64）</label><textarea class="ta mono" id="rs-sig" rows="3"></textarea></div>
          <div class="row" style="margin-top:9px"><button class="btn primary" id="rs-sign">签名</button><button class="btn" id="rs-verify">验签</button><span class="hint" id="rs-vres"></span></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let keyPair = null;
    $('#rs-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#rs-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      [0, 1, 2].forEach((i) => $('#rs-p' + i).classList.toggle('hidden', String(i) !== b.dataset.i));
    });
    const exportPem = async (key, type) => {
      const buf = await crypto.subtle.exportKey(type, key);
      const b = b64(new Uint8Array(buf));
      const lines = b.match(/.{1,64}/g).join('\n');
      return `-----BEGIN ${type === 'spki' ? 'PUBLIC' : 'PRIVATE'} KEY-----\n${lines}\n-----END ${type === 'spki' ? 'PUBLIC' : 'PRIVATE'} KEY-----`;
    };
    const importPem = async (pem, isPriv, usage) => {
      const body = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
      const bytes = unb64(body);
      return crypto.subtle.importKey(isPriv ? 'pkcs8' : 'spki', bytes.buffer, usage, true, isPriv ? ['decrypt', 'sign'] : ['encrypt', 'verify']);
    };
    $('#rs-gen').onclick = async () => {
      try {
        keyPair = await crypto.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt']);
        $('#rs-pub').value = await exportPem(keyPair.publicKey, 'spki');
        $('#rs-priv').value = await exportPem(keyPair.privateKey, 'pkcs8');
        $('#rs-gmeta').textContent = '已生成 · 仅保存在当前页面内存';
      } catch (e) { toast(e.message, 'err'); }
    };
    $('#rs-copy-pub').onclick = () => copy($('#rs-pub').value);
    $('#rs-copy-priv').onclick = () => copy($('#rs-priv').value);
    $('#rs-dl').onclick = () => {
      if (!$('#rs-pub').value) return toast('先生成密钥', 'err');
      download('rsa-public.pem', $('#rs-pub').value, 'text/plain');
      download('rsa-private.pem', $('#rs-priv').value, 'text/plain');
    };
    $('#rs-enc').onclick = async () => {
      try {
        const key = await importPem($('#rs-key').value, false, { name: 'RSA-OAEP', hash: 'SHA-256' });
        const ct = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, enc.encode($('#rs-text').value));
        $('#rs-out').textContent = b64(new Uint8Array(ct));
      } catch (e) { $('#rs-out').textContent = '加密失败：' + e.message; }
    };
    $('#rs-dec').onclick = async () => {
      try {
        const key = await importPem($('#rs-key').value, true, { name: 'RSA-OAEP', hash: 'SHA-256' });
        const pt = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, key, unb64($('#rs-text').value));
        $('#rs-out').textContent = dec.decode(pt);
      } catch (e) { $('#rs-out').textContent = '解密失败：' + e.message; }
    };
    $('#rs-sign').onclick = async () => {
      try {
        const key = await importPem($('#rs-skey').value, true, { name: 'RSA-PSS', hash: 'SHA-256' });
        const sig = await crypto.subtle.sign({ name: 'RSA-PSS', saltLength: 32 }, key, enc.encode($('#rs-msg').value));
        $('#rs-sig').value = b64(new Uint8Array(sig));
        $('#rs-vres').textContent = '已签名';
      } catch (e) { $('#rs-vres').textContent = '签名失败：' + e.message; }
    };
    $('#rs-verify').onclick = async () => {
      try {
        const pub = await importPem($('#rs-key').value, false, { name: 'RSA-PSS', hash: 'SHA-256' });
        const ok = await crypto.subtle.verify({ name: 'RSA-PSS', saltLength: 32 }, pub, unb64($('#rs-sig').value), enc.encode($('#rs-msg').value));
        $('#rs-vres').textContent = ok ? '✓ 签名有效' : '✗ 签名无效';
      } catch (e) { $('#rs-vres').textContent = '验签失败：' + e.message; }
    };
  },

  /* ================= EXIF ================= */
  'exif-tool'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>图片 EXIF / 元数据</b><span class="hint">读取与清除均在本机完成</span></div>
          ${fileZone('ex-zone', { accept: 'image/jpeg,image/jpg', label: '选择 JPEG 图片' })}
          <div class="row" style="margin-top:10px"><button class="btn primary" id="ex-clear">清除 EXIF 并下载</button><span class="hint" id="ex-info">尚未选择图片</span></div>
        </div>
        <div class="grid2">
          <div class="panel"><div class="panel-head"><b>预览</b></div><div class="canvas-wrap" id="ex-preview"><div class="hint">选择图片后显示</div></div></div>
          <div class="panel"><div class="panel-head"><b>EXIF 信息</b><span class="hint" id="ex-meta"></span></div><div id="ex-tags" class="kv"><div class="hint">暂无数据</div></div></div>
        </div>
        <div class="warnbox">EXIF 可能包含拍摄位置、设备与时间等隐私信息，分享图片前建议清除。</div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let file = null;
    bindFileZone(root, 'ex-zone', async (files) => {
      file = files[0];
      $('#ex-info').textContent = `${file.name} · ${fmtBytes(file.size)}`;
      const url = URL.createObjectURL(file);
      $('#ex-preview').innerHTML = `<img src="${url}" alt="预览">`;
      try {
        const buf = await readAs(file, 'arraybuffer');
        const { tags, found } = readExif(buf);
        if (!found) { $('#ex-tags').innerHTML = '<div class="hint">没有找到 EXIF（可能是 PNG 或已清除）</div>'; $('#ex-meta').textContent = '无 EXIF'; return; }
        const rows = Object.entries(tags).filter(([k]) => EXIF_NAMES[k]).map(([k, v]) => `<dt>${esc(EXIF_NAMES[k])}</dt><dd>${esc(String(v))}</dd>`);
        $('#ex-tags').innerHTML = rows.length ? rows.join('') : '<div class="hint">EXIF 中没有常用字段</div>';
        $('#ex-meta').textContent = `${Object.keys(tags).length} 个字段`;
      } catch (e) { $('#ex-tags').innerHTML = `<div class="errbox">${esc(e.message)}</div>`; }
    });
    $('#ex-clear').onclick = async () => {
      if (!file) return toast('请选择图片', 'err');
      try {
        const buf = await readAs(file, 'arraybuffer');
        const blob = stripExif(buf);
        download(file.name.replace(/\.jpe?g$/i, '') + '-clean.jpg', blob);
        $('#ex-info').textContent = `已清除 EXIF：${fmtBytes(blob.size)}`;
      } catch (e) { toast(e.message, 'err'); }
    };
  },

  /* ================= 隐写 ================= */
  'image-stego'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="is-tabs"><button class="tab active" data-i="0">图片 LSB 隐写</button><button class="tab" data-i="1">文本零宽隐写</button></div>
        <div class="panel" id="is-p0">
          ${fileZone('is-zone', { accept: 'image/png', label: '选择 PNG 图片作为载体' })}
          <div class="field" style="margin-top:9px"><label class="lab">要隐藏的文本</label><textarea class="ta" id="is-secret" rows="4">这是一条隐藏消息</textarea></div>
          <div class="row" style="margin-top:9px"><button class="btn primary" id="is-hide">写入并下载 PNG</button><button class="btn" id="is-extract">从图片提取</button><span class="hint" id="is-meta"></span></div>
          <div class="canvas-wrap" id="is-preview" style="margin-top:10px"><div class="hint">选择 PNG 后显示预览</div></div>
        </div>
        <div class="panel hidden" id="is-p1">
          <div class="field"><label class="lab">载体文本（公开内容）</label><textarea class="ta" id="is-cover" rows="4">这是一段看起来普通的文本，里面可以藏东西。</textarea></div>
          <div class="field" style="margin-top:9px"><label class="lab">秘密文本</label><textarea class="ta" id="is-secret2" rows="3">secret</textarea></div>
          <div class="row" style="margin-top:9px"><button class="btn primary" id="is-hide2">隐藏</button><button class="btn" id="is-extract2">提取</button></div>
          <pre class="out" id="is-out" style="margin-top:9px"></pre>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let file = null, img = null;
    $('#is-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#is-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      $('#is-p0').classList.toggle('hidden', b.dataset.i !== '0');
      $('#is-p1').classList.toggle('hidden', b.dataset.i !== '1');
    });
    bindFileZone(root, 'is-zone', async (files) => {
      file = files[0];
      const url = URL.createObjectURL(file);
      img = await loadImage(url);
      $('#is-preview').innerHTML = `<img src="${url}" alt="预览">`;
      $('#is-meta').textContent = `${img.width} × ${img.height} · 容量约 ${Math.floor(img.width * img.height / 8 - 4)} 字节`;
    });
    const encodeBits = (text) => {
      const bytes = enc.encode(text);
      const header = new Uint8Array(4);
      new DataView(header.buffer).setUint32(0, bytes.length);
      const all = new Uint8Array(header.length + bytes.length);
      all.set(header, 0); all.set(bytes, 4);
      return [...all].map((b) => b.toString(2).padStart(8, '0')).join('');
    };
    $('#is-hide').onclick = () => {
      if (!img || !file) return toast('请选择 PNG 图片', 'err');
      const cv = document.createElement('canvas');
      cv.width = img.width; cv.height = img.height;
      const g = cv.getContext('2d');
      g.drawImage(img, 0, 0);
      const data = g.getImageData(0, 0, cv.width, cv.height);
      const bits = encodeBits($('#is-secret').value);
      if (bits.length > data.data.length / 4 * 1) { toast('文本太长，超出容量', 'err'); return; }
      for (let i = 0; i < bits.length; i++) {
        const idx = i * 4;
        data.data[idx] = (data.data[idx] & 0xfe) | Number(bits[i]);
      }
      g.putImageData(data, 0, 0);
      cv.toBlob((b) => download('stego.png', b), 'image/png');
    };
    $('#is-extract').onclick = () => {
      if (!img) return toast('请选择图片', 'err');
      const cv = document.createElement('canvas');
      cv.width = img.width; cv.height = img.height;
      const g = cv.getContext('2d');
      g.drawImage(img, 0, 0);
      const data = g.getImageData(0, 0, cv.width, cv.height).data;
      let bits = '';
      for (let i = 0; i < data.length; i += 4) bits += data[i] & 1;
      const len = parseInt(bits.slice(0, 32), 2);
      if (!len || len > 1e6) { $('#is-meta').textContent = '没有检测到隐藏数据'; return; }
      const bytes = [];
      for (let i = 0; i < len; i++) {
        const s = bits.slice(32 + i * 8, 32 + i * 8 + 8);
        if (s.length < 8) break;
        bytes.push(parseInt(s, 2));
      }
      try { $('#is-secret').value = dec.decode(Uint8Array.from(bytes)); $('#is-meta').textContent = `提取到 ${len} 字节`; }
      catch { $('#is-meta').textContent = '数据损坏'; }
    };
    $('#is-hide2').onclick = () => {
      const bits = encodeBits($('#is-secret2').value);
      const zw = bits.replace(/0/g, '\u200b').replace(/1/g, '\u200c');
      $('#is-out').textContent = $('#is-cover').value.split('').map((c) => c + zw).join('');
    };
    $('#is-extract2').onclick = () => {
      const zw = [...$('#is-cover').value].filter((c) => c === '\u200b' || c === '\u200c');
      let bits = zw.map((c) => c === '\u200b' ? '0' : '1').join('');
      const len = parseInt(bits.slice(0, 32), 2);
      if (!len || len > 1e6) { $('#is-out').textContent = '没有检测到零宽隐写'; return; }
      const bytes = [];
      for (let i = 0; i < len; i++) bytes.push(parseInt(bits.slice(32 + i * 8, 32 + i * 8 + 8), 2));
      $('#is-out').textContent = dec.decode(Uint8Array.from(bytes));
    };
  },

  /* ================= 隐私政策 ================= */
  'privacy-gen'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="grid3">
            <div class="field"><label class="lab">类型</label><select class="sel" id="pg-type"><option value="privacy">隐私政策</option><option value="cookie">Cookie 政策</option><option value="terms">服务条款</option></select></div>
            <div class="field"><label class="lab">主体名称</label><input class="inp" id="pg-company" value="空天工具合集"></div>
            <div class="field"><label class="lab">网站地址</label><input class="inp" id="pg-site" value="https://by654.github.io/kongtian-tools/"></div>
            <div class="field"><label class="lab">联系邮箱</label><input class="inp" id="pg-email" value="hello@example.com"></div>
            <div class="field"><label class="lab">生效日期</label><input class="inp" id="pg-date" type="date"></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="pg-run" style="width:100%">生成</button></div>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b><button class="btn sm" id="pg-copy">复制</button></div><textarea class="ta" id="pg-out" rows="16"></textarea></div>
        <div class="warnbox">模板仅供参考，正式使用前请根据实际业务与适用法律进行修改。</div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#pg-date').value = new Date().toISOString().slice(0, 10);
    const gen = () => {
      const c = $('#pg-company').value, u = $('#pg-site').value, e = $('#pg-email').value, d = $('#pg-date').value;
      const type = $('#pg-type').value;
      if (type === 'cookie') return `# ${c} Cookie 政策\n\n生效日期：${d}\n\n## 1. 什么是 Cookie\nCookie 是网站存储在浏览器中的小型文本文件，用于记住偏好、统计访问情况。\n\n## 2. 我们使用的 Cookie\n本网站（${u}）不使用广告或跟踪 Cookie。本地存储仅用于保存主题设置、收藏与最近使用记录。\n\n## 3. 如何管理\n你可以在浏览器设置中清除或禁用 Cookie 与本地存储。禁用后部分偏好可能无法保存。\n\n## 4. 联系我们\n如有疑问：${e}\n`;
      if (type === 'terms') return `# ${c} 服务条款\n\n生效日期：${d}\n\n## 1. 服务说明\n${c}（${u}）提供基于浏览器的本地工具，所有处理默认在你的设备上完成。\n\n## 2. 使用规范\n你应合法使用本服务，不得利用本工具处理违法内容或侵犯他人权益。\n\n## 3. 免责声明\n本工具按“现状”提供，不对计算结果的准确性、完整性作明示或暗示担保。加密、健康、金融相关结果不构成专业建议。\n\n## 4. 知识产权\n工具代码与界面归 ${c} 所有；你处理的文件与内容归你所有。\n\n## 5. 联系我们\n${e}\n`;
      return `# ${c} 隐私政策\n\n生效日期：${d}\n\n## 1. 我们收集什么\n${c}（${u}）不收集、不上传你在工具中处理的文本、图片、PDF、音视频等文件。所有处理在浏览器本地完成。\n\n## 2. 本地存储\n我们使用浏览器 localStorage 保存主题、收藏、最近使用等偏好；使用 IndexedDB 保存你主动创建的笔记、待办等数据。这些数据不会自动同步到服务器。\n\n## 3. 第三方依赖\n部分工具会从 CDN 加载开源库（如 PDF.js、Chart.js、Tesseract.js）。加载过程会暴露常规的网络请求信息（IP、User-Agent），具体以 CDN 服务商的隐私政策为准。\n\n## 4. 权限\n摄像头、麦克风、剪贴板、定位等权限只在你主动使用对应工具时请求，并仅用于完成该功能。\n\n## 5. 数据删除\n你可以随时清除浏览器站点数据，或使用工具内的“清空”按钮删除本地数据。\n\n## 6. 儿童隐私\n本服务不面向 14 岁以下儿童单独收集信息。\n\n## 7. 联系我们\n如对本政策有疑问，请联系：${e}\n`;
    };
    $('#pg-run').onclick = () => { $('#pg-out').value = gen(); };
    $('#pg-copy').onclick = () => copy($('#pg-out').value);
    $('#pg-run').click();
  },

  /* ================= 加密笔记 ================= */
  'vault'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>本地加密笔记 / 密码本</b><span class="hint">AES-GCM 加密后存入 localStorage，口令不保存</span></div>
          <div class="row">
            <input class="inp" id="va-pass" type="password" placeholder="主口令" style="max-width:240px">
            <button class="btn primary" id="va-unlock">解锁 / 创建</button>
            <button class="btn" id="va-lock">锁定</button>
            <span class="hint" id="va-status">未解锁</span>
          </div>
        </div>
        <div id="va-body" class="tool-ui hidden">
          <div class="grid2">
            <div class="panel"><div class="panel-head"><b>标题</b></div><input class="inp" id="va-title" placeholder="例如：邮箱密码"></div>
            <div class="panel"><div class="panel-head"><b>内容</b></div><textarea class="ta mono" id="va-note" rows="4" placeholder="账号 / 密码 / 备注"></textarea></div>
          </div>
          <div class="row"><button class="btn primary" id="va-add">保存笔记</button><button class="btn" id="va-export">导出加密备份</button></div>
          <div id="va-list" class="tool-ui"></div>
        </div>
        <div class="warnbox">忘记主口令将无法恢复内容。建议先用一条测试笔记验证导出与解锁流程。</div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const KEY = 'kt:vault';
    let pass = null, notes = [];
    const persist = async () => {
      const payload = await aesEncrypt(JSON.stringify(notes), pass);
      localStorage.setItem(KEY, payload);
    };
    const paint = () => {
      $('#va-list').innerHTML = notes.length ? notes.map((n, i) => `<div class="panel tight"><div class="row between"><div><b>${esc(n.title)}</b><div class="hint mono" style="white-space:pre-wrap">${esc(n.content)}</div></div><div class="row"><button class="btn sm" data-copy="${i}">复制</button><button class="btn sm danger" data-del="${i}">删除</button></div></div></div>`).join('') : '<div class="empty">还没有笔记</div>';
      root.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => copy(notes[Number(b.dataset.copy)].content)));
      root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
        notes.splice(Number(b.dataset.del), 1);
        await persist(); paint();
      }));
    };
    $('#va-unlock').onclick = async () => {
      const p = $('#va-pass').value;
      if (p.length < 6) return toast('主口令至少 6 位', 'err');
      const stored = localStorage.getItem(KEY);
      if (!stored) {
        pass = p; notes = [];
        await persist();
        $('#va-status').textContent = '已创建并解锁';
      } else {
        try {
          notes = JSON.parse(await aesDecrypt(stored, p));
          pass = p;
          $('#va-status').textContent = `已解锁 · ${notes.length} 条`;
        } catch { toast('口令错误', 'err'); return; }
      }
      $('#va-body').classList.remove('hidden');
      paint();
    };
    $('#va-lock').onclick = () => { pass = null; notes = []; $('#va-body').classList.add('hidden'); $('#va-status').textContent = '已锁定'; $('#va-pass').value = ''; };
    $('#va-add').onclick = async () => {
      if (!pass) return;
      const title = $('#va-title').value.trim(), content = $('#va-note').value;
      if (!title) return toast('请填写标题', 'err');
      notes.push({ title, content, at: Date.now() });
      await persist();
      $('#va-title').value = ''; $('#va-note').value = '';
      paint();
    };
    $('#va-export').onclick = () => {
      const stored = localStorage.getItem(KEY);
      if (stored) download('vault-backup.ktvault', stored, 'text/plain');
    };
  },

  /* ================= 域名安全 ================= */
  'idn-check'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>URL / 域名安全检查</b><span class="hint">检测 IDN 同形异义、可疑字符与结构</span></div>
          <input class="inp mono" id="ic-in" value="https://example.com/path?q=1" placeholder="输入 URL 或域名">
          <button class="btn primary" id="ic-run" style="margin-top:9px">检查</button>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b></div><div id="ic-out"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const suspicious = { 'а': 'a (西里尔)', 'е': 'e (西里尔)', 'о': 'o (西里尔)', 'р': 'p (西里尔)', 'с': 'c (西里尔)', 'у': 'y (西里尔)', 'х': 'x (西里尔)', 'і': 'i (西里尔)', 'ј': 'j (西里尔)', 'ѕ': 's (西里尔)', 'ο': 'o (希腊)', 'α': 'a (希腊)', 'ν': 'v (希腊)', 'ι': 'i (希腊)' };
    $('#ic-run').onclick = () => {
      let s = $('#ic-in').value.trim();
      if (!/^[a-z]+:\/\//i.test(s)) s = 'https://' + s;
      try {
        const u = new URL(s);
        const host = u.hostname;
        const issues = [];
        const hits = [...host].filter((c) => suspicious[c]);
        if (hits.length) issues.push({ level: 'high', text: `检测到 ${hits.length} 个同形异义字符：${hits.map((c) => `"${c}" → ${suspicious[c]}`).join('、')}` });
        if (host.startsWith('xn--') || host.includes('.xn--')) issues.push({ level: 'medium', text: '域名包含 Punycode（xn--），请确认实际指向。' });
        if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) issues.push({ level: 'medium', text: '使用 IP 地址而不是域名，常见于钓鱼链接。' });
        if (u.username || u.password) issues.push({ level: 'high', text: 'URL 中包含用户名或密码字段。' });
        if (u.port && !['80', '443', ''].includes(u.port)) issues.push({ level: 'low', text: `使用非标准端口 ${u.port}。` });
        if (host.split('.').length > 4) issues.push({ level: 'low', text: '子域层级较多，注意识别主域名。' });
        if (u.protocol !== 'https:') issues.push({ level: 'medium', text: '不是 HTTPS 连接。' });
        if (!issues.length) issues.push({ level: 'ok', text: '没有发现明显的结构性问题。仍请核对域名拼写与证书。' });
        $('#ic-out').innerHTML = `<div class="kv"><dt>协议</dt><dd>${esc(u.protocol)}</dd><dt>主机</dt><dd class="mono">${esc(host)}</dd><dt>Unicode 主机</dt><dd class="mono">${esc(punyDecodeHost(host))}</dd><dt>路径</dt><dd class="mono">${esc(u.pathname)}</dd></div><div style="margin-top:12px">${issues.map((x) => `<div class="${x.level === 'ok' ? 'okbox' : x.level === 'high' ? 'errbox' : 'warnbox'}" style="margin-bottom:7px">${esc(x.text)}</div>`).join('')}</div>`;
      } catch (e) { $('#ic-out').innerHTML = `<div class="errbox">${esc(e.message)}</div>`; }
    };
    function punyDecodeHost(h) {
      try { return new URL('https://' + h).hostname === h ? h : h; } catch { return h; }
    }
    $('#ic-run').click();
  },

  /* ================= 剪贴板 ================= */
  'clipboard-tool'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>剪贴板工具</b><span class="hint">需要浏览器授权</span></div>
          <div class="row"><button class="btn primary" id="cb-read">读取剪贴板</button><button class="btn" id="cb-write">写入下方内容</button><button class="btn" id="cb-clear">清空剪贴板</button></div>
          <textarea class="ta mono" id="cb-text" rows="8" style="margin-top:10px" placeholder="要写入剪贴板的内容…"></textarea>
          <div class="row" style="margin-top:8px"><button class="btn" id="cb-trim">去除首尾空格</button><button class="btn" id="cb-upper">转大写</button><button class="btn" id="cb-lower">转小写</button><button class="btn" id="cb-strip">去除格式（纯文本）</button></div>
        </div>
        <div class="panel"><div class="panel-head"><b>本次会话记录</b><button class="btn sm" id="cb-clear-h">清空</button></div><div id="cb-history" class="hint">暂无记录</div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const history = [];
    const paint = () => {
      $('#cb-history').innerHTML = history.length ? history.map((h, i) => `<div style="border-bottom:1px solid var(--line);padding:5px 0"><span class="dim">${i + 1}.</span> <span class="mono">${esc(h.slice(0, 120))}</span></div>`).join('') : '暂无记录';
    };
    $('#cb-read').onclick = async () => {
      try {
        const t = await navigator.clipboard.readText();
        $('#cb-text').value = t;
        history.unshift(t); paint();
      } catch { toast('浏览器未授权剪贴板读取', 'err'); }
    };
    $('#cb-write').onclick = async () => {
      try { await navigator.clipboard.writeText($('#cb-text').value); toast('已写入剪贴板', 'ok'); history.unshift($('#cb-text').value); paint(); }
      catch { toast('写入失败', 'err'); }
    };
    $('#cb-clear').onclick = async () => { try { await navigator.clipboard.writeText(''); toast('已清空'); } catch { toast('失败', 'err'); } };
    $('#cb-trim').onclick = () => { $('#cb-text').value = $('#cb-text').value.trim(); };
    $('#cb-upper').onclick = () => { $('#cb-text').value = $('#cb-text').value.toUpperCase(); };
    $('#cb-lower').onclick = () => { $('#cb-text').value = $('#cb-text').value.toLowerCase(); };
    $('#cb-strip').onclick = () => { const d = document.createElement('textarea'); d.innerHTML = $('#cb-text').value; $('#cb-text').value = d.value; };
    $('#cb-clear-h').onclick = () => { history.length = 0; paint(); };
  }
};
