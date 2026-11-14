/* 表格：XLSX / XLS / CSV / TSV / JSON 互转（SheetJS） */
import { baseName, extOf, loadVendor, makeZip, mimeForExt, readAsArrayBuffer, readText, sanitizeFileName } from './utils.js';

async function ensureXlsx() {
  await loadVendor('xlsx/xlsx.full.min.js');
  if (!window.XLSX) throw new Error('表格引擎加载失败');
  return window.XLSX;
}

function jsonToWorkbook(XLSX, text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error('JSON 解析失败：' + e.message);
  }
  const wb = { SheetNames: [], Sheets: {} };
  const add = (name, data) => {
    let ws;
    if (Array.isArray(data)) {
      if (data.length && Array.isArray(data[0])) ws = XLSX.utils.aoa_to_sheet(data);
      else if (data.length && typeof data[0] === 'object' && data[0] !== null) ws = XLSX.utils.json_to_sheet(data);
      else ws = XLSX.utils.aoa_to_sheet([['value'], ...data.map((v) => [v])]);
    } else if (typeof data === 'object' && data !== null) {
      ws = XLSX.utils.json_to_sheet([data]);
    } else {
      ws = XLSX.utils.aoa_to_sheet([['value'], [data]]);
    }
    wb.SheetNames.push(name);
    wb.Sheets[name] = ws;
  };
  if (Array.isArray(parsed)) add('Sheet1', parsed);
  else if (parsed && typeof parsed === 'object') {
    const keys = Object.keys(parsed);
    if (!keys.length) add('Sheet1', []);
    else for (const k of keys) add(k.slice(0, 31) || 'Sheet1', parsed[k]);
  } else add('Sheet1', parsed);
  return wb;
}

function detectDelimiter(text) {
  const line = String(text).split(/\r?\n/, 1)[0] || '';
  const counts = { ',': 0, '\t': 0, ';': 0 };
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') quoted = !quoted;
    else if (!quoted && counts[ch] !== undefined) counts[ch]++;
  }
  let best = ',';
  let max = 0;
  for (const k of Object.keys(counts)) {
    if (counts[k] > max) { max = counts[k]; best = k; }
  }
  return max > 0 ? best : ',';
}

function decodeCsv(XLSX, text, ext, params = {}) {
  let fs = params.csvInputDelimiter && params.csvInputDelimiter !== 'auto' ? params.csvInputDelimiter : null;
  if (!fs) fs = ext === 'tsv' ? '\t' : detectDelimiter(text);
  try {
    return XLSX.read(text, { type: 'string', FS: fs });
  } catch (_) {
    return XLSX.read(text, { type: 'string' });
  }
}

export async function convertSheet(file, target, params = {}, hooks = {}) {
  const XLSX = await ensureXlsx();
  const ext = extOf(file.name);
  const base = baseName(file.name);

  hooks.onStage && hooks.onStage('解析表格…');
  let wb;
  if (ext === 'csv' || ext === 'tsv') {
    const text = await readText(file, params.csvEncoding || 'utf-8');
    wb = decodeCsv(XLSX, text, ext, params);
  } else if (ext === 'json') {
    wb = jsonToWorkbook(XLSX, await readText(file, 'utf-8'));
  } else {
    wb = XLSX.read(await readAsArrayBuffer(file), { type: 'array', cellDates: true });
  }
  if (!wb || !wb.SheetNames || !wb.SheetNames.length) throw new Error('表格没有可读取的工作表');

  const sheetNames = wb.SheetNames;
  const single = sheetNames.length === 1;

  if (target === 'xlsx') {
    hooks.onStage && hooks.onStage('写入 XLSX…');
    const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true });
    const blob = new Blob([bytes], { type: mimeForExt('xlsx') });
    return [{ name: base + (ext === 'xlsx' ? '-converted' : '') + '.xlsx', blob, size: blob.size }];
  }

  const outputs = [];
  for (let i = 0; i < sheetNames.length; i++) {
    hooks.onStage && hooks.onStage(`处理工作表 ${i + 1}/${sheetNames.length}`);
    if (hooks.isCancelled && hooks.isCancelled()) throw new DOMException('已取消', 'AbortError');
    const ws = wb.Sheets[sheetNames[i]];
    if (!ws) continue;
    const safeSheet = sanitizeFileName(sheetNames[i]).replace(/\s+/g, '_') || `Sheet${i + 1}`;
    const suffix = single ? '' : '-' + safeSheet;

    if (target === 'csv' || target === 'tsv') {
      const fs = params.csvDelimiter && params.csvDelimiter !== 'auto'
        ? params.csvDelimiter
        : (target === 'tsv' ? '\t' : ',');
      const text = XLSX.utils.sheet_to_csv(ws, {
        FS: fs,
        blankrows: false,
      });
      const blob = new Blob([text], { type: mimeForExt(target) });
      outputs.push({ name: `${base}${suffix}.${target}`, blob, size: blob.size });
    } else if (target === 'json') {
      const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });
      let jsonText;
      if (single) jsonText = JSON.stringify(rows, null, 2);
      else jsonText = JSON.stringify({ [sheetNames[i]]: rows }, null, 2);
      outputs.push({
        name: `${base}${suffix}.json`,
        blob: new Blob([jsonText], { type: mimeForExt('json') }),
        size: jsonText.length,
      });
    } else if (target === 'html') {
      const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${sheetNames[i]}</title>
<style>body{font:14px/1.5 "Segoe UI","Microsoft YaHei",system-ui,sans-serif;padding:24px;color:#1f2937}table{border-collapse:collapse}td,th{border:1px solid #d7dde5;padding:5px 9px}th{background:#f1f5f9}</style></head><body>${XLSX.utils.sheet_to_html(ws, { editable: false })}</body></html>`;
      outputs.push({
        name: `${base}${suffix}.html`,
        blob: new Blob([html], { type: mimeForExt('html') }),
        size: html.length,
      });
    }
  }

  if (!outputs.length) throw new Error('没有可导出的工作表');
  if (outputs.length === 1) return outputs;
  const zip = await makeZip(outputs);
  return [{ name: `${base}-${target}-${outputs.length}个工作表.zip`, blob: zip, size: zip.size }];
}

export { jsonToWorkbook };
