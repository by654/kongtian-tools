/* 文件、压缩与文件系统 */
import { esc, copy, toast, download, fmtBytes, readAs, pickFile } from '../core/ui.js';
import { bindFileZone, fileZone } from '../core/kit.js';

const $ = (root, s) => root.querySelector(s);

export default {
  /* ================= ZIP ================= */
  'zip-tool'(root, ctx) {
    const $ = (s) => root.querySelector(s);
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="zt-tabs"><button class="tab active" data-i="0">压缩打包</button><button class="tab" data-i="1">解压预览</button></div>
        <div class="panel" id="zt-p0">
          ${fileZone('zt-zone', { multiple: true, label: '选择要打包的文件（可多选）' })}
          <div class="grid3" style="margin-top:10px">
            <div class="field"><label class="lab">压缩级别</label><select class="sel" id="zt-level"><option value="6">标准</option><option value="9">最大</option><option value="1">最快</option></select></div>
            <div class="field"><label class="lab">压缩包名称</label><input class="inp" id="zt-name" value="archive.zip"></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="zt-run" style="width:100%">生成 ZIP</button></div>
          </div>
          <div class="hint" id="zt-info" style="margin-top:8px">尚未选择文件</div>
        </div>
        <div class="panel hidden" id="zt-p1">
          ${fileZone('zu-zone', { accept: '.zip', label: '选择 ZIP 文件解压' })}
          <div id="zu-list" class="table-scroll" style="margin-top:10px;max-height:320px"></div>
          <div class="row" style="margin-top:9px"><button class="btn primary" id="zu-all">全部下载</button><span class="hint" id="zu-info">尚未选择 ZIP</span></div>
        </div>
      </div>`;
    let files = [], zip = null;
    $('#zt-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#zt-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      $('#zt-p0').classList.toggle('hidden', b.dataset.i !== '0');
      $('#zt-p1').classList.toggle('hidden', b.dataset.i !== '1');
    });
    bindFileZone(root, 'zt-zone', (fs) => {
      files = fs;
      $('#zt-info').textContent = `${fs.length} 个文件 · ${fmtBytes(fs.reduce((s, f) => s + f.size, 0))}`;
    });
    $('#zt-run').onclick = async () => {
      if (!files.length) return toast('请选择文件', 'err');
      try {
        await ctx.deps(['jszip']);
        const z = new window.JSZip();
        for (const f of files) z.file(f.name, await readAs(f, 'arraybuffer'));
        const blob = await z.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: Number($('#zt-level').value) } });
        download($('#zt-name').value || 'archive.zip', blob);
        $('#zt-info').textContent = `已生成 ${fmtBytes(blob.size)}`;
      } catch (e) { toast('打包失败：' + e.message, 'err'); }
    };
    bindFileZone(root, 'zu-zone', async (fs) => {
      try {
        await ctx.deps(['jszip']);
        zip = await window.JSZip.loadAsync(await fs[0].arrayBuffer());
        const names = Object.keys(zip.files);
        $('#zu-list').innerHTML = `<table class="tbl"><tr><th>文件</th><th>大小</th><th>操作</th></tr>${names.map((n) => {
          const f = zip.files[n];
          return `<tr><td class="mono">${esc(n)}${f.dir ? ' /' : ''}</td><td>${f.dir ? '—' : fmtBytes(f._data?.uncompressedSize || 0)}</td><td>${f.dir ? '' : `<button class="btn sm" data-unzip="${esc(n)}">下载</button>`}</td></tr>`;
        }).join('')}</table>`;
        $('#zu-info').textContent = `${names.length} 个条目`;
        root.querySelectorAll('[data-unzip]').forEach((b) => b.addEventListener('click', async () => {
          const f = zip.file(b.dataset.unzip);
          if (f) download(b.dataset.unzip.split('/').pop(), await f.async('blob'));
        }));
      } catch (e) { $('#zu-info').textContent = '解压失败：' + e.message; }
    });
    $('#zu-all').onclick = async () => {
      if (!zip) return;
      const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
      for (let i = 0; i < names.length; i++) {
        const blob = await zip.file(names[i]).async('blob');
        setTimeout(() => download(names[i].split('/').pop(), blob), i * 120);
      }
    };
  },

  /* ================= 文件分割 ================= */
  'file-split'(root) {
    const $ = (s) => root.querySelector(s);
    root.innerHTML = `
      <div class="tool-ui">
        <div class="tabs" id="fs-tabs"><button class="tab active" data-i="0">分割文件</button><button class="tab" data-i="1">合并分片</button></div>
        <div class="panel" id="fs-p0">
          ${fileZone('fs-zone', { label: '选择要分割的文件' })}
          <div class="grid3" style="margin-top:10px">
            <div class="field"><label class="lab">每片大小</label><input class="inp" id="fs-size" type="number" value="5"></div>
            <div class="field"><label class="lab">单位</label><select class="sel" id="fs-unit"><option value="1048576">MB</option><option value="1024">KB</option></select></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="fs-run" style="width:100%">分割并下载</button></div>
          </div>
          <div class="hint" id="fs-info" style="margin-top:8px">尚未选择文件</div>
        </div>
        <div class="panel hidden" id="fs-p1">
          ${fileZone('fm-zone', { multiple: true, label: '选择同一文件的分片（按文件名排序）' })}
          <div class="row" style="margin-top:10px"><input class="inp" id="fm-name" value="merged.bin" style="max-width:240px"><button class="btn primary" id="fm-run">合并并下载</button><span class="hint" id="fm-info">尚未选择分片</span></div>
        </div>
      </div>`;
    let file = null, parts = [];
    $('#fs-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      root.querySelectorAll('#fs-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      $('#fs-p0').classList.toggle('hidden', b.dataset.i !== '0');
      $('#fs-p1').classList.toggle('hidden', b.dataset.i !== '1');
    });
    bindFileZone(root, 'fs-zone', (fs) => { file = fs[0]; $('#fs-info').textContent = `${file.name} · ${fmtBytes(file.size)}`; });
    $('#fs-run').onclick = async () => {
      if (!file) return toast('请选择文件', 'err');
      const chunkSize = Math.max(1024, Number($('#fs-size').value) * Number($('#fs-unit').value));
      const buf = new Uint8Array(await readAs(file, 'arraybuffer'));
      const total = Math.ceil(buf.length / chunkSize);
      for (let i = 0; i < total; i++) {
        const slice = buf.slice(i * chunkSize, (i + 1) * chunkSize);
        download(`${file.name}.part${String(i + 1).padStart(3, '0')}`, new Blob([slice]));
        await new Promise((r) => setTimeout(r, 180));
      }
      $('#fs-info').textContent = `已分割为 ${total} 片`;
    };
    bindFileZone(root, 'fm-zone', (fs) => {
      parts = fs.sort((a, b) => a.name.localeCompare(b.name));
      $('#fm-info').textContent = `${parts.length} 个分片 · ${fmtBytes(parts.reduce((s, f) => s + f.size, 0))}`;
    });
    $('#fm-run').onclick = async () => {
      if (!parts.length) return toast('请选择分片', 'err');
      const buffers = [];
      for (const f of parts) buffers.push(new Uint8Array(await readAs(f, 'arraybuffer')));
      download($('#fm-name').value || 'merged.bin', new Blob(buffers));
    };
  },

  /* ================= 文件预览 ================= */
  'file-preview'(root) {
    const $ = (s) => root.querySelector(s);
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>文件预览</b><span class="hint">支持图片、音视频、PDF、CSV、JSON、文本</span></div>
          ${fileZone('fp-zone', { label: '选择文件，或拖拽到这里' })}
          <div id="fp-meta" class="kv" style="margin-top:10px"><div class="hint">尚未选择文件</div></div>
        </div>
        <div class="panel"><div class="panel-head"><b>预览</b></div><div id="fp-view"><div class="hint">预览内容会显示在这里</div></div></div>
      </div>`;
    bindFileZone(root, 'fp-zone', async (fs) => {
      const f = fs[0];
      const url = URL.createObjectURL(f);
      $('#fp-meta').innerHTML = `<dt>文件名</dt><dd>${esc(f.name)}</dd><dt>类型</dt><dd>${esc(f.type || '未知')}</dd><dt>大小</dt><dd>${fmtBytes(f.size)}</dd><dt>修改时间</dt><dd>${new Date(f.lastModified).toLocaleString()}</dd>`;
      const type = f.type;
      if (type.startsWith('image/')) $('#fp-view').innerHTML = `<div class="canvas-wrap"><img src="${url}" alt="预览"></div>`;
      else if (type.startsWith('audio/')) $('#fp-view').innerHTML = `<audio controls src="${url}" style="width:100%"></audio>`;
      else if (type.startsWith('video/')) $('#fp-view').innerHTML = `<video controls src="${url}" style="width:100%;max-height:480px"></video>`;
      else if (type === 'application/pdf') $('#fp-view').innerHTML = `<iframe src="${url}" style="width:100%;height:560px;border:1px solid var(--line);border-radius:9px"></iframe>`;
      else if (type.includes('json') || f.name.endsWith('.json')) {
        try { $('#fp-view').innerHTML = `<pre class="out">${esc(JSON.stringify(JSON.parse(await readAs(f, 'text')), null, 2).slice(0, 20000))}</pre>`; }
        catch { $('#fp-view').innerHTML = '<div class="errbox">JSON 解析失败</div>'; }
      } else if (type.includes('csv') || f.name.endsWith('.csv')) {
        const text = await readAs(f, 'text');
        const rows = text.split(/\r?\n/).slice(0, 60).map((l) => l.split(','));
        $('#fp-view').innerHTML = `<div class="table-scroll"><table class="tbl">${rows.map((r, i) => `<tr>${r.map((c) => i ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`).join('')}</tr>`).join('')}</table></div>`;
      } else if (type.startsWith('text/') || /\.(txt|md|js|css|html|xml|yml|yaml|log)$/i.test(f.name)) {
        const text = await readAs(f, 'text');
        $('#fp-view').innerHTML = `<pre class="out">${esc(text.slice(0, 30000))}</pre>`;
      } else {
        $('#fp-view').innerHTML = `<div class="hint">此格式暂不支持内联预览。可以下载后用本地应用打开。</div><a class="btn" style="margin-top:9px" href="${url}" download="${esc(f.name)}">下载文件</a>`;
      }
    });
  },

  /* ================= 批量重命名 ================= */
  'batch-rename'(root) {
    const $ = (s) => root.querySelector(s);
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>批量重命名</b><span class="hint">支持 {name} {i} {ext} {date} 占位符</span></div>
          ${fileZone('br-zone', { multiple: true, label: '选择文件（可多选）' })}
          <div class="grid3" style="margin-top:10px">
            <div class="field"><label class="lab">命名规则</label><input class="inp mono" id="br-rule" value="{name}_{i:02}.{ext}"></div>
            <div class="field"><label class="lab">起始序号</label><input class="inp" id="br-start" type="number" value="1"></div>
            <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" id="br-run" style="width:100%">预览并下载</button></div>
          </div>
        </div>
        <div class="panel"><div class="panel-head"><b>预览</b></div><div id="br-list" class="hint">选择文件后显示</div></div>
      </div>`;
    let files = [];
    bindFileZone(root, 'br-zone', (fs) => {
      files = fs;
      paint();
    });
    const makeName = (f, i) => {
      const dot = f.name.lastIndexOf('.');
      const ext = dot > 0 ? f.name.slice(dot + 1) : '';
      const base = dot > 0 ? f.name.slice(0, dot) : f.name;
      return $('#br-rule').value
        .replace(/\{name\}/g, base)
        .replace(/\{ext\}/g, ext)
        .replace(/\{i(?::(\d+))?\}/g, (m, p) => String(Number($('#br-start').value) + i).padStart(p ? Number(p) : 0, '0'))
        .replace(/\{date\}/g, new Date().toISOString().slice(0, 10));
    };
    const paint = () => {
      $('#br-list').innerHTML = files.map((f, i) => `<div class="row between" style="border-bottom:1px solid var(--line);padding:4px 0"><span class="dim mono">${esc(f.name)}</span><span>→</span><span class="mono" style="color:var(--acc)">${esc(makeName(f, i))}</span></div>`).join('') || '选择文件后显示';
    };
    ['#br-rule', '#br-start'].forEach((s) => $(s).addEventListener('input', paint));
    $('#br-run').onclick = async () => {
      if (!files.length) return toast('请选择文件', 'err');
      for (let i = 0; i < files.length; i++) {
        const name = makeName(files[i], i);
        download(name, files[i]);
        await new Promise((r) => setTimeout(r, 150));
      }
    };
  },

  /* ================= 目录树 ================= */
  'dir-tree'(root) {
    const $ = (s) => root.querySelector(s);
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>目录树生成</b><span class="hint">选择文件夹，生成文本或 Markdown 目录树</span></div>
          <div class="drop" id="dt-drop"><b>点击选择文件夹</b><div class="hint">使用 webkitdirectory，文件不会上传</div></div>
          <div class="row" style="margin-top:10px"><button class="btn" id="dt-text">复制文本树</button><button class="btn" id="dt-md">复制 Markdown</button><span class="hint" id="dt-info">尚未选择</span></div>
        </div>
        <div class="panel"><pre class="out" id="dt-out" style="max-height:520px">目录树会显示在这里</pre></div>
      </div>`;
    let files = [];
    $('#dt-drop').onclick = () => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.webkitdirectory = true;
      inp.style.display = 'none';
      document.body.appendChild(inp);
      inp.addEventListener('change', () => { files = [...inp.files]; inp.remove(); build(); });
      inp.addEventListener('cancel', () => inp.remove());
      inp.click();
    };
    const build = () => {
      const paths = files.map((f) => f.webkitRelativePath || f.name).sort();
      const rootName = paths[0]?.split('/')[0] || 'root';
      const tree = { name: rootName, children: new Map() };
      for (const p of paths) {
        const parts = p.split('/').slice(1);
        let cur = tree;
        for (const part of parts) {
          if (!cur.children.has(part)) cur.children.set(part, { name: part, children: new Map() });
          cur = cur.children.get(part);
        }
      }
      const render = (node, prefix = '') => {
        const entries = [...node.children.values()];
        return entries.map((c, i) => {
          const last = i === entries.length - 1;
          const line = prefix + (last ? '└── ' : '├── ') + c.name + '\n';
          return line + (c.children.size ? render(c, prefix + (last ? '    ' : '│   ')) : '');
        }).join('');
      };
      const out = rootName + '/\n' + render(tree);
      $('#dt-out').textContent = out;
      $('#dt-info').textContent = `${files.length} 个文件`;
    };
    $('#dt-text').onclick = () => copy($('#dt-out').textContent);
    $('#dt-md').onclick = () => {
      const md = '```\n' + $('#dt-out').textContent + '```';
      copy(md);
    };
  },

  /* ================= 存储测试 ================= */
  'storage-test'(root) {
    root.innerHTML = `
      <div class="tool-ui">
        <div class="panel">
          <div class="panel-head"><b>浏览器存储测试</b><span class="hint">容量、写入与读取速度（会清理测试数据）</span></div>
          <div class="row"><button class="btn primary" id="st-local">测试 localStorage</button><button class="btn" id="st-idb">测试 IndexedDB</button><button class="btn" id="st-opfs">测试 OPFS</button><button class="btn" id="st-size">估算已用空间</button></div>
        </div>
        <div class="panel"><div class="panel-head"><b>结果</b></div><pre class="out" id="st-out">点击上方按钮开始测试</pre></div>
        <div class="panel"><div class="panel-head"><b>环境</b></div><div id="st-env" class="kv"></div></div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    $('#st-env').innerHTML = `<dt>localStorage</dt><dd>${'localStorage' in window ? '支持' : '不支持'}</dd><dt>IndexedDB</dt><dd>${'indexedDB' in window ? '支持' : '不支持'}</dd><dt>OPFS</dt><dd>${navigator.storage?.getDirectory ? '支持' : '不支持'}</dd><dt>存储配额</dt><dd id="st-quota">查询中…</dd>`;
    navigator.storage?.estimate?.().then((e) => {
      document.getElementById('st-quota').textContent = `可用 ${fmtBytes(e.quota || 0)} · 已用 ${fmtBytes(e.usage || 0)}`;
    }).catch(() => { document.getElementById('st-quota').textContent = '不可用'; });
    $('#st-local').onclick = () => {
      const key = '__kt_test__';
      const chunk = 'x'.repeat(1024);
      let count = 0, t0 = performance.now();
      try {
        for (; count < 5000; count++) localStorage.setItem(key + count, chunk);
        const write = performance.now() - t0;
        t0 = performance.now();
        for (let i = 0; i < count; i++) localStorage.getItem(key + i);
        const read = performance.now() - t0;
        for (let i = 0; i < count; i++) localStorage.removeItem(key + i);
        $('#st-out').textContent = `localStorage\n写入：${count} KB / ${write.toFixed(0)} ms\n读取：${count} KB / ${read.toFixed(0)} ms\n近似容量：至少 ${(count / 1024).toFixed(2)} MB`;
      } catch {
        for (let i = 0; i < count; i++) localStorage.removeItem(key + i);
        $('#st-out').textContent = `localStorage 在 ${count} KB 时达到上限（约 ${(count / 1024).toFixed(2)} MB）`;
      }
    };
    $('#st-idb').onclick = () => new Promise((resolve) => {
      const t0 = performance.now();
      const req = indexedDB.open('kt-test', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('t');
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('t', 'readwrite');
        const store = tx.objectStore('t');
        const data = new Blob([new Uint8Array(1024 * 1024)]);
        store.put(data, '1mb');
        tx.oncomplete = () => {
          const ms = performance.now() - t0;
          db.close();
          indexedDB.deleteDatabase('kt-test');
          $('#st-out').textContent = `IndexedDB\n写入 1 MB 用时 ${ms.toFixed(0)} ms\n状态：正常`;
          resolve();
        };
      };
      req.onerror = () => { $('#st-out').textContent = 'IndexedDB 打开失败'; resolve(); };
    });
    $('#st-opfs').onclick = async () => {
      if (!navigator.storage?.getDirectory) { $('#st-out').textContent = '当前浏览器不支持 OPFS'; return; }
      try {
        const t0 = performance.now();
        const dir = await navigator.storage.getDirectory();
        const fh = await dir.getFileHandle('kt-test.txt', { create: true });
        const w = await fh.createWritable();
        await w.write(new Uint8Array(1024 * 1024));
        await w.close();
        const f = await fh.getFile();
        await dir.removeEntry('kt-test.txt');
        $('#st-out').textContent = `OPFS\n写入 1 MB 用时 ${(performance.now() - t0).toFixed(0)} ms\n读取大小 ${fmtBytes(f.size)}\n状态：正常`;
      } catch (e) { $('#st-out').textContent = 'OPFS 测试失败：' + e.message; }
    };
    $('#st-size').onclick = async () => {
      let html = '';
      try {
        let total = 0;
        for (const k in localStorage) if (Object.prototype.hasOwnProperty.call(localStorage, k)) total += (localStorage[k] || '').length * 2;
        html += `localStorage 已用约 ${fmtBytes(total)}\n`;
      } catch { /* ignore */ }
      try {
        const e = await navigator.storage.estimate();
        html += `Storage API：已用 ${fmtBytes(e.usage || 0)} / 配额 ${fmtBytes(e.quota || 0)}`;
      } catch { html += 'Storage API 不可用'; }
      $('#st-out').textContent = html;
    };
  }
};
