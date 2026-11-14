/* 文档转换：TXT / Markdown / HTML / DOCX / RTF */
import {
  baseName, extOf, escapeHtml, escapeXml, loadVendor, mimeForExt, readAsArrayBuffer, readText, textBlob,
} from './utils.js';

function uid() {
  try {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
  } catch (_) {}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/* ---------- Markdown -> HTML ---------- */
export async function mdToHtml(md) {
  await loadVendor('marked/marked.min.js');
  const marked = window.marked;
  if (!marked || !marked.parse) throw new Error('Markdown 解析器加载失败');
  return marked.parse(md, { gfm: true, breaks: false });
}

/* ---------- HTML -> 纯文本 ---------- */
const TEXT_BLOCKS = new Set([
  'p', 'div', 'section', 'article', 'header', 'footer', 'aside', 'nav', 'main',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'pre', 'blockquote', 'table', 'tr', 'hr', 'br',
]);

function textWalk(node) {
  if (node.nodeType === 3) return node.nodeValue;
  if (node.nodeType !== 1) return '';
  const tag = node.tagName.toLowerCase();
  if (tag === 'script' || tag === 'style' || tag === 'head') return '';
  if (tag === 'br') return '\n';
  if (tag === 'td' || tag === 'th') {
    return Array.from(node.childNodes).map(textWalk).join('') + '\t';
  }
  const inner = Array.from(node.childNodes).map(textWalk).join('');
  return TEXT_BLOCKS.has(tag) ? inner + '\n' : inner;
}

export function htmlToText(html) {
  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  let out = Array.from(doc.body.childNodes).map(textWalk).join('');
  return out
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ---------- HTML -> Markdown ---------- */
function inlineHtml(node, skipNestedLists) {
  if (node.nodeType === 3) return node.nodeValue.replace(/\s+/g, ' ');
  if (node.nodeType !== 1) return '';
  const tag = node.tagName.toLowerCase();
  if (tag === 'script' || tag === 'style' || tag === 'head') return '';
  if (skipNestedLists && (tag === 'ul' || tag === 'ol')) return '';
  if (tag === 'br') return '  \n';
  if (tag === 'strong' || tag === 'b') return '**' + inner() + '**';
  if (tag === 'em' || tag === 'i') return '*' + inner() + '*';
  if (tag === 'del' || tag === 's') return '~~' + inner() + '~~';
  if (tag === 'code') return '`' + node.textContent.replace(/`/g, '\\`') + '`';
  if (tag === 'a') {
    const href = node.getAttribute('href') || '';
    const text = inner().trim() || href;
    return href && !/^javascript:/i.test(href) ? `[${text}](${href})` : text;
  }
  if (tag === 'img') {
    const alt = node.getAttribute('alt') || '';
    const src = node.getAttribute('src') || '';
    return src ? `![${alt}](${src})` : '';
  }
  function inner() {
    return Array.from(node.childNodes).map((c) => inlineHtml(c, skipNestedLists)).join('');
  }
  return inner();
}

const BLOCK_TAGS = new Set([
  'p', 'div', 'section', 'article', 'main', 'header', 'footer', 'aside', 'nav',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'pre', 'blockquote', 'hr', 'table', 'tr',
]);

function renderTable(el) {
  const rows = Array.from(el.querySelectorAll('tr'));
  if (!rows.length) return '';
  const lines = [];
  rows.forEach((tr, idx) => {
    const cells = Array.from(tr.children).map((c) => inlineHtml(c, true).replace(/\s+/g, ' ').trim());
    lines.push('| ' + cells.join(' | ') + ' |');
    if (idx === 0) lines.push('| ' + cells.map(() => '---').join(' | ') + ' |');
  });
  return lines.join('\n');
}

function renderBlock(el) {
  const tag = el.tagName.toLowerCase();
  if (/^h[1-6]$/.test(tag)) return '#'.repeat(Number(tag[1])) + ' ' + inlineHtml(el, true).trim();
  if (tag === 'p') return inlineHtml(el, true).trim();
  if (tag === 'pre') {
    const code = el.textContent.replace(/\n$/, '');
    return '```\n' + code + '\n```';
  }
  if (tag === 'ul' || tag === 'ol') {
    return Array.from(el.children)
      .filter((c) => c.tagName === 'LI')
      .map((li, i) => {
        const marker = tag === 'ul' ? '- ' : `${i + 1}. `;
        const main = inlineHtml(li, true).replace(/\s+/g, ' ').trim();
        const nested = Array.from(li.children)
          .filter((c) => c.tagName === 'UL' || c.tagName === 'OL')
          .map((c) => renderBlock(c))
          .join('\n');
        return marker + main + (nested ? '\n' + nested.split('\n').map((l) => '  ' + l).join('\n') : '');
      })
      .join('\n');
  }
  if (tag === 'blockquote') {
    const inner = renderChildren(el);
    return inner.split('\n').map((l) => (l ? '> ' + l : '>')).join('\n');
  }
  if (tag === 'hr') return '---';
  if (tag === 'table') return renderTable(el);
  if (tag === 'tr' || tag === 'li') return inlineHtml(el, true).trim();
  return renderChildren(el);
}

function renderChildren(el) {
  const parts = [];
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 3) {
      const t = child.nodeValue.replace(/\s+/g, ' ').trim();
      if (t) parts.push(t);
    } else if (child.nodeType === 1) {
      const tag = child.tagName.toLowerCase();
      if (!BLOCK_TAGS.has(tag)) {
        const t = inlineHtml(child, true).trim();
        if (t) parts.push(t);
      } else {
        parts.push(renderBlock(child));
      }
    }
  }
  return parts.filter(Boolean).join('\n\n');
}

export function htmlToMarkdown(html) {
  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  return renderChildren(doc.body).replace(/\n{3,}/g, '\n\n').trim();
}

/* ---------- RTF 读写 ---------- */
const RTF_SKIP = new Set([
  'fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'header', 'footer', 'headerl', 'headerr',
  'footerl', 'footerr', 'object', 'latentstyles', 'listtable', 'listoverridetable', 'rsidtbl',
  'themedata', 'colorschememapping', 'datafield', 'fldinst', 'xref', 'template', 'filetbl', 'revtbl',
  'generator', 'mmathPr', 'xmlns', 'wgrffmtfilter', 'panose', 'fname', 'nonshppict', 'shprslt',
]);

const CP1252 = new TextDecoder('windows-1252');

export function rtfToText(rtf) {
  if (!rtf) return '';
  let out = '';
  let i = 0;
  let depth = 0;
  let skipDepth = 0;
  const n = rtf.length;
  while (i < n) {
    const ch = rtf[i];
    if (ch === '{') {
      depth++;
      i++;
      if (!skipDepth) {
        const la = rtf.slice(i, i + 60).match(/^\s*(\\\*|\\[a-z]+)/);
        if (la) {
          const token = la[1];
          if (token === '\\*') skipDepth = depth;
          else {
            const word = token.slice(1);
            if (RTF_SKIP.has(word)) skipDepth = depth;
          }
        }
      }
      continue;
    }
    if (ch === '}') {
      if (skipDepth && depth === skipDepth) skipDepth = 0;
      depth--;
      i++;
      continue;
    }
    if (skipDepth) {
      i++;
      continue;
    }
    if (ch === '\\') {
      i++;
      if (i >= n) break;
      const c = rtf[i];
      if (c === '*') {
        i++;
        continue;
      }
      if (/[a-z]/.test(c)) {
        let word = '';
        while (i < n && /[a-z]/.test(rtf[i])) word += rtf[i++];
        let num = '';
        if (rtf[i] === '-') {
          num += '-';
          i++;
        }
        while (i < n && /[0-9]/.test(rtf[i])) num += rtf[i++];
        if (rtf[i] === ' ') i++;
        if (word === 'par' || word === 'ln' || word === 'l') out += '\n';
        else if (word === 'tab') out += '\t';
        else if (word === 'u' && num) {
          let code = parseInt(num, 10);
          if (code < 0) code += 65536;
          out += String.fromCharCode(code);
          if (rtf[i] === '?') i++;
          else if (rtf[i] === '\\' && rtf[i + 1] === "'") i += 4;
        }
        continue;
      }
      if (c === "'") {
        const hex = rtf.slice(i + 1, i + 3);
        if (/^[0-9a-fA-F]{2}$/.test(hex)) {
          out += CP1252.decode(new Uint8Array([parseInt(hex, 16)]));
          i += 3;
        } else i++;
        continue;
      }
      if (c === '\\' || c === '{' || c === '}') {
        out += c;
        i++;
        continue;
      }
      if (c === '~') {
        out += ' ';
        i++;
        continue;
      }
      if (c === '_' || c === '-') {
        i++;
        continue;
      }
      i++;
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      i++;
      continue;
    }
    out += ch;
    i++;
  }
  return out.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

export function textToRtf(text) {
  let body = '';
  for (const ch of String(text)) {
    const code = ch.codePointAt(0);
    if (ch === '\\' || ch === '{' || ch === '}') body += '\\' + ch;
    else if (ch === '\n') body += '\\par\n';
    else if (ch === '\t') body += '\\tab ';
    else if (code < 128) body += ch;
    else if (code <= 65535) body += `\\u${code}?`;
    else {
      const v = code - 0x10000;
      body += `\\u${0xd800 + (v >> 10)}?\\u${0xdc00 + (v & 0x3ff)}?`;
    }
  }
  return `{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\fnil\\fcharset0 Segoe UI;}}\n${body}\n}`;
}

/* ---------- 抽取段落用于 DOCX 生成 ---------- */
const DOCX_BLOCK_SEL = 'h1,h2,h3,h4,h5,h6,p,li,pre,blockquote,td';

function paragraphsFromHtml(html) {
  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  const nodes = Array.from(doc.body.querySelectorAll(DOCX_BLOCK_SEL));
  const out = [];
  for (const el of nodes) {
    if (el.parentElement && el.parentElement.closest(DOCX_BLOCK_SEL)) continue;
    const tag = el.tagName.toLowerCase();
    const level = /^h[1-6]$/.test(tag) ? Number(tag[1]) : 0;
    const text = el.textContent.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
    if (text) out.push({ level, text });
  }
  if (!out.length) {
    const t = htmlToText(html);
    if (t) out.push({ level: 0, text: t });
  }
  return out;
}

function paragraphsFromMarkdown(md) {
  const lines = String(md).split(/\r?\n/);
  const out = [];
  let buf = [];
  let inFence = false;
  const flush = () => {
    if (buf.length) {
      out.push({ level: 0, text: buf.join(' ') });
      buf = [];
    }
  };
  for (const raw of lines) {
    const line = raw;
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      if (!inFence) flush();
      continue;
    }
    if (inFence) {
      if (line.trim()) out.push({ level: 0, text: line.replace(/^\s{0,4}/, '') });
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      out.push({ level: h[1].length, text: h[2].trim() });
      continue;
    }
    const li = /^\s*(?:[-*+]|\d+\.)\s+(.*)$/.exec(line);
    if (li) {
      flush();
      out.push({ level: 0, text: '• ' + li[1].trim() });
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    buf.push(line.trim());
  }
  flush();
  return out;
}

function paragraphsFromText(text) {
  return String(text)
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.length > 0)
    .map((l) => ({ level: 0, text: l }));
}

/* ---------- DOCX 生成 ---------- */
const DOCX_SIZES = { 1: 36, 2: 32, 3: 28, 4: 26, 5: 24, 6: 22 };

export async function buildDocx(paragraphs) {
  await loadVendor('jszip/jszip.min.js');
  const paras = paragraphs.length ? paragraphs : [{ level: 0, text: '' }];
  const body = paras
    .map((p) => {
      if (!p.text) return '<w:p/>';
      const size = p.level ? DOCX_SIZES[p.level] || 22 : 22;
      const rPr = p.level
        ? `<w:rPr><w:b/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr>`
        : '<w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>';
      const text = escapeXml(p.text).replace(/\t/g, '</w:t><w:tab/><w:t xml:space="preserve">');
      return `<w:p>${p.level ? '<w:pPr><w:keepNext/></w:pPr>' : ''}<w:r>${rPr}<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
    })
    .join('');

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;

  const typesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

  const zip = new window.JSZip();
  zip.file('[Content_Types].xml', typesXml);
  zip.file('_rels/.rels', relsXml);
  zip.file('word/document.xml', documentXml);
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

/* ---------- DOCX 读取 ---------- */
async function readDocx(file) {
  const arrayBuffer = await readAsArrayBuffer(file);
  try {
    await loadVendor('mammoth/mammoth.browser.min.js');
    const mammoth = window.mammoth;
    const htmlRes = await mammoth.convertToHtml({ arrayBuffer });
    const textRes = await mammoth.extractRawText({ arrayBuffer });
    return { html: htmlRes.value || '', text: textRes.value || '' };
  } catch (e) {
    console.warn('mammoth 失败，使用轻量解析', e);
    return docxFallback(arrayBuffer);
  }
}

async function docxFallback(arrayBuffer) {
  await loadVendor('jszip/jszip.min.js');
  const zip = await window.JSZip.loadAsync(arrayBuffer);
  const doc = zip.file('word/document.xml');
  if (!doc) throw new Error('不是有效的 DOCX 文件');
  const xml = await doc.async('string');
  const parsed = new DOMParser().parseFromString(xml, 'application/xml');
  const paras = Array.from(parsed.getElementsByTagName('w:p')).map((p) => p.textContent || '');
  const text = paras.join('\n');
  return { html: paras.map((p) => `<p>${escapeHtml(p)}</p>`).join(''), text };
}

/* ---------- EPUB 读取 ---------- */
function stripEpubPath(p) {
  return String(p || '').replace(/^\.\//, '').replace(/^\/+/, '');
}

async function readEpub(file) {
  await loadVendor('jszip/jszip.min.js');
  let zip;
  try {
    zip = await window.JSZip.loadAsync(await readAsArrayBuffer(file));
  } catch (e) {
    throw new Error('EPUB 解析失败（可能已加密或文件损坏）');
  }

  let opfPath = '';
  const container = zip.file('META-INF/container.xml');
  if (container) {
    try {
      const xml = await container.async('string');
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      const root = doc.getElementsByTagName('rootfile')[0];
      if (root) opfPath = stripEpubPath(root.getAttribute('full-path'));
    } catch (_) {}
  }
  if (!opfPath) {
    const candidates = Object.keys(zip.files).filter((n) => /\.opf$/i.test(n) && !zip.files[n].dir);
    opfPath = candidates[0] || '';
  }

  const titles = [];
  const files = [];
  if (opfPath && zip.file(opfPath)) {
    const baseDir = opfPath.includes('/') ? opfPath.replace(/[^/]+$/, '') : '';
    const xml = await zip.file(opfPath).async('string');
    const opf = new DOMParser().parseFromString(xml, 'application/xml');
    const titleEl = opf.getElementsByTagName('dc:title')[0] || opf.getElementsByTagName('title')[0];
    if (titleEl && titleEl.textContent.trim()) titles.push(titleEl.textContent.trim());
    const manifest = new Map();
    for (const item of Array.from(opf.getElementsByTagName('item'))) {
      const id = item.getAttribute('id');
      const href = item.getAttribute('href');
      const type = item.getAttribute('media-type') || '';
      if (id && href && (/xhtml|html/i.test(type) || /\.x?html?$/i.test(href))) {
        manifest.set(id, stripEpubPath(baseDir + decodeURIComponent(href)));
      }
    }
    for (const ref of Array.from(opf.getElementsByTagName('itemref'))) {
      const idref = ref.getAttribute('idref');
      const path = manifest.get(idref);
      if (path && zip.file(path)) files.push(path);
    }
  }
  if (!files.length) {
    files.push(...Object.keys(zip.files).filter((n) => /\.x?html?$/i.test(n) && !zip.files[n].dir).sort());
  }
  if (!files.length) throw new Error('EPUB 中没有可读取的正文页面');

  const parts = [];
  for (const path of files) {
    const entry = zip.file(path);
    if (!entry) continue;
    const raw = await entry.async('string');
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    Array.from(doc.querySelectorAll('script,style')).forEach((el) => el.remove());
    const body = doc.body ? doc.body.innerHTML : raw;
    if (body && body.trim()) parts.push(body);
  }
  const html = parts.join('\n');
  const text = htmlToText(html);
  return { html, text, title: titles[0] || '' };
}

/* ---------- ODT 读取 ---------- */
function odtNodeText(node) {
  if (node.nodeType === 3) return node.nodeValue;
  if (node.nodeType !== 1) return '';
  const tag = (node.localName || node.tagName || '').toLowerCase();
  if (tag === 's') {
    const n = Number(node.getAttribute('text:c') || node.getAttribute('c') || 1);
    return ' '.repeat(Number.isFinite(n) && n > 0 ? Math.min(n, 200) : 1);
  }
  if (tag === 'tab') return '\t';
  if (tag === 'line-break') return '\n';
  return Array.from(node.childNodes).map(odtNodeText).join('');
}

async function readOdt(file) {
  await loadVendor('jszip/jszip.min.js');
  let zip;
  try {
    zip = await window.JSZip.loadAsync(await readAsArrayBuffer(file));
  } catch (e) {
    throw new Error('ODT 解析失败（可能已加密或文件损坏）');
  }
  const entry = zip.file('content.xml');
  if (!entry) throw new Error('不是有效的 ODT 文件（缺少 content.xml）');
  const xml = await entry.async('string');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const body = doc.getElementsByTagName('office:body')[0];
  if (!body) throw new Error('ODT 正文为空');

  const blocks = [];
  const walk = (node) => {
    for (const child of Array.from(node.children || [])) {
      const tag = (child.localName || '').toLowerCase();
      if (tag === 'h' || tag === 'p') {
        const level = tag === 'h' ? Math.max(1, Math.min(6, Number(child.getAttribute('text:outline-level') || 1))) : 0;
        const text = odtNodeText(child).replace(/\s+$/g, '').trim();
        if (text) blocks.push({ level, text });
      } else if (tag === 'table') {
        for (const row of Array.from(child.getElementsByTagName('table:table-row')) || []) {
          const cells = Array.from(row.getElementsByTagName('table:table-cell'))
            .map((c) => odtNodeText(c).replace(/\s+/g, ' ').trim());
          if (cells.join('')) blocks.push({ level: 0, text: cells.join('\t') });
        }
      } else {
        walk(child);
      }
    }
  };
  walk(body);

  const text = blocks.map((b) => b.text).join('\n');
  const html = blocks.map((b) => (b.level ? `<h${b.level}>${escapeHtml(b.text)}</h${b.level}>` : `<p>${escapeHtml(b.text)}</p>`)).join('\n');
  return { html, text };
}

/* ---------- EPUB / ODT 生成 ---------- */
function paragraphsOf(html, text, ext) {
  if (ext === 'md' || ext === 'markdown') return paragraphsFromMarkdown(text);
  if (ext === 'html' || ext === 'htm' || ext === 'docx' || ext === 'epub' || ext === 'odt') return paragraphsFromHtml(html);
  return paragraphsFromText(text);
}

function epubFragment(paras) {
  if (!paras.length) return '<p>（空文档）</p>';
  return paras.map((p) => {
    const t = escapeXml(p.text);
    return p.level ? `<h${p.level}>${t}</h${p.level}>` : `<p>${t}</p>`;
  }).join('\n');
}

async function buildEpub(paras, title) {
  await loadVendor('jszip/jszip.min.js');
  const bookTitle = title || '空天文档';
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const chapter = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN"><head><meta charset="utf-8"/><title>${escapeXml(bookTitle)}</title></head><body>
${epubFragment(paras)}
</body></html>`;
  const nav = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="zh-CN"><head><meta charset="utf-8"/><title>目录</title></head><body>
<nav epub:type="toc" id="toc"><h1>目录</h1><ol><li><a href="chapter1.xhtml">正文</a></li></ol></nav>
</body></html>`;
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:${uid()}</dc:identifier>
    <dc:title>${escapeXml(bookTitle)}</dc:title>
    <dc:language>zh-CN</dc:language>
    <meta property="dcterms:modified">${now}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine><itemref idref="chapter1"/></spine>
</package>`;
  const container = `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;

  const zip = new window.JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', container);
  zip.file('OEBPS/content.opf', opf);
  zip.file('OEBPS/nav.xhtml', nav);
  zip.file('OEBPS/chapter1.xhtml', chapter);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip', compression: 'DEFLATE' });
}

async function buildOdt(paras, title) {
  await loadVendor('jszip/jszip.min.js');
  const body = (paras.length ? paras : [{ level: 0, text: '' }])
    .map((p) => (p.level
      ? `<text:h text:outline-level="${p.level}">${escapeXml(p.text)}</text:h>`
      : `<text:p>${escapeXml(p.text)}</text:p>`))
    .join('\n');
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2">
<office:meta><dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">${escapeXml(title || '空天文档')}</dc:title></office:meta>
<office:body><office:text>
${body}
</office:text></office:body>
</office:document-content>`;
  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
  <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`;
  const zip = new window.JSZip();
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
  zip.file('META-INF/manifest.xml', manifest);
  zip.file('content.xml', content);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.oasis.opendocument.text' });
}

/* ---------- HTML 包装 ---------- */
function fullHtml(fragment, title) {
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title || '文档')}</title>
<style>body{max-width:860px;margin:40px auto;padding:0 20px;font:16px/1.75 "Segoe UI","Microsoft YaHei",system-ui,sans-serif;color:#1f2937}h1,h2,h3{line-height:1.3}pre{background:#f5f7fa;padding:14px;border-radius:8px;overflow:auto}code{background:#f2f4f7;padding:1px 5px;border-radius:4px}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #d7dde5;padding:6px 10px}</style>
</head><body>
${fragment}
</body></html>`;
}

/* ---------- 主流程 ---------- */
export async function convertDocument(file, target, params = {}, hooks = {}) {
  const ext = extOf(file.name);
  const base = baseName(file.name);
  hooks.onStage && hooks.onStage('读取文档…');

  let html = '';
  let text = '';
  if (ext === 'docx') {
    const r = await readDocx(file);
    html = r.html;
    text = r.text;
  } else if (ext === 'rtf') {
    text = rtfToText(await readText(file));
    html = '';
  } else if (ext === 'html' || ext === 'htm') {
    html = await readText(file);
    text = htmlToText(html);
  } else if (ext === 'epub') {
    const r = await readEpub(file);
    html = r.html;
    text = r.text;
  } else if (ext === 'odt') {
    const r = await readOdt(file);
    html = r.html;
    text = r.text;
  } else {
    text = await readText(file);
  }

  hooks.onStage && hooks.onStage('生成 ' + target.toUpperCase() + '…');
  let blob;
  let outExt = target;

  if (target === 'txt') {
    if (ext === 'md' || ext === 'markdown') text = htmlToText(await mdToHtml(text));
    if (ext === 'html' || ext === 'htm') text = htmlToText(html);
    blob = textBlob(text);
  } else if (target === 'md') {
    if (ext === 'html' || ext === 'htm' || ext === 'docx' || ext === 'epub' || ext === 'odt') text = htmlToMarkdown(html);
    else if (ext === 'rtf') text = text.trim();
    blob = textBlob(text, mimeForExt('md'));
  } else if (target === 'html') {
    let fragment;
    if (ext === 'md' || ext === 'markdown') fragment = await mdToHtml(text);
    else if (ext === 'docx' || ext === 'html' || ext === 'htm' || ext === 'epub' || ext === 'odt') fragment = html;
    else fragment = paragraphsFromText(text).map((p) => `<p>${escapeHtml(p.text)}</p>`).join('\n');
    blob = textBlob(fullHtml(fragment, base), mimeForExt('html'));
  } else if (target === 'docx') {
    blob = await buildDocx(paragraphsOf(html, text, ext));
  } else if (target === 'epub') {
    blob = await buildEpub(paragraphsOf(html, text, ext), base);
  } else if (target === 'odt') {
    blob = await buildOdt(paragraphsOf(html, text, ext), base);
  } else if (target === 'rtf') {
    let plain = text;
    if (ext === 'html' || ext === 'htm' || ext === 'docx' || ext === 'epub' || ext === 'odt') plain = htmlToText(html);
    if (ext === 'md' || ext === 'markdown') plain = htmlToText(await mdToHtml(text));
    blob = textBlob(textToRtf(plain), mimeForExt('rtf'));
  } else {
    throw new Error('不支持的文档输出格式：' + target);
  }

  const same = ext === target;
  const name = base + (same ? '-converted' : '') + '.' + outExt;
  return [{ name, blob, size: blob.size }];
}

export { paragraphsFromHtml, paragraphsFromMarkdown, paragraphsFromText };
