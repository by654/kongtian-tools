/* 字幕：SRT / WebVTT / ASS(SSA) / 纯文本互转（仅解析时间轴与文字，不做语音识别） */
import { baseName, extOf, readText, textBlob } from './utils.js';

function parseClock(str) {
  const s = str.trim().replace(',', '.');
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/.exec(s);
  if (m) {
    const h = Number(m[1] || 0);
    return h * 3600 + Number(m[2]) * 60 + Number(m[3]);
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function stripVttTags(text) {
  return text
    .replace(/<c(?:\.[^>]*)?>/g, '')
    .replace(/<\/c>/g, '')
    .replace(/<v(?:\s[^>]*)?>/g, '')
    .replace(/<\/v>/g, '')
    .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, '')
    .replace(/<\d{2}:\d{2}:\d{2},\d{3}>/g, '');
}

export function parseSrt(input) {
  const text = String(input).replace(/^\uFEFF/, '').replace(/\r/g, '');
  const cues = [];
  for (const block of text.split(/\n{2,}/)) {
    const lines = block.split('\n').filter((l) => l.trim().length > 0);
    if (!lines.length) continue;
    const idx = lines.findIndex((l) => l.includes('-->'));
    if (idx < 0) continue;
    const times = lines[idx].split('-->');
    const start = parseClock(times[0]);
    const end = parseClock((times[1] || '').trim().split(/\s+/)[0]);
    const body = lines.slice(idx + 1).join('\n');
    if (Number.isFinite(start) && Number.isFinite(end) && body.trim()) {
      cues.push({ start, end, text: body.trim() });
    }
  }
  return cues;
}

export function parseVtt(input) {
  const text = String(input).replace(/^\uFEFF/, '').replace(/\r/g, '');
  const cues = [];
  const blocks = text.split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim().length > 0);
    if (!lines.length) continue;
    if (/^WEBVTT/.test(lines[0]) || /^(NOTE|STYLE|REGION)\b/.test(lines[0])) continue;
    const idx = lines.findIndex((l) => l.includes('-->'));
    if (idx < 0) continue;
    const times = lines[idx].split('-->');
    const start = parseClock(times[0]);
    const end = parseClock((times[1] || '').trim().split(/\s+/)[0]);
    const body = stripVttTags(lines.slice(idx + 1).join('\n')).trim();
    if (Number.isFinite(start) && Number.isFinite(end)) cues.push({ start, end, text: body });
  }
  return cues;
}

function assTimeToSeconds(s) {
  const m = /^(\d+):(\d{1,2}):(\d{1,2})[.:](\d{1,3})$/.exec(s.trim());
  if (!m) return NaN;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, '0').slice(0, 3)) / 1000;
}

function cleanAssText(text) {
  return text
    .replace(/\{[^}]*\}/g, '')
    .replace(/\\[Nn]/g, '\n')
    .replace(/\\h/g, ' ')
    .replace(/\\[^a-zA-Z]/g, '')
    .trim();
}

export function parseAss(input) {
  const text = String(input).replace(/^\uFEFF/, '').replace(/\r/g, '');
  const lines = text.split('\n');
  let inEvents = false;
  let format = null;
  const cues = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\[Events\]/i.test(trimmed)) { inEvents = true; format = null; continue; }
    if (/^\[/.test(trimmed)) { inEvents = false; continue; }
    if (!inEvents) continue;
    if (/^Format:/i.test(trimmed)) {
      format = trimmed.slice(7).split(',').map((s) => s.trim());
      continue;
    }
    if (!/^Dialogue:/i.test(trimmed)) continue;
    const fields = trimmed.slice(9).split(',');
    if (fields.length < 10) continue;
    let start = fields[1];
    let end = fields[2];
    let body;
    if (format) {
      const textIdx = format.indexOf('Text');
      if (textIdx > 0) {
        body = fields.slice(textIdx).join(',');
        start = fields[format.indexOf('Start')] || start;
        end = fields[format.indexOf('End')] || end;
      } else body = fields.slice(9).join(',');
    } else body = fields.slice(9).join(',');
    const s = assTimeToSeconds(start);
    const e = assTimeToSeconds(end);
    if (Number.isFinite(s) && Number.isFinite(e)) {
      cues.push({ start: s, end: e, text: cleanAssText(body) });
    }
  }
  return cues;
}

function pad(n, len = 2) {
  return String(Math.max(0, Math.floor(n))).padStart(len, '0');
}

function srtTime(sec) {
  const ms = Math.round(sec * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms % 1000, 3)}`;
}

function vttTime(sec) {
  const ms = Math.round(sec * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms % 1000, 3)}`;
}

function assTime(sec) {
  const cs = Math.round(sec * 100);
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${pad(m)}:${pad(s)}.${pad(cs % 100, 2)}`;
}

function assText(text) {
  return text.replace(/\n/g, '\\N');
}

export function buildSrt(cues) {
  return cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}`).join('\n\n') + '\n';
}

export function buildVtt(cues) {
  return 'WEBVTT\n\n' + cues.map((c) => `${vttTime(c.start)} --> ${vttTime(c.end)}\n${c.text}`).join('\n\n') + '\n';
}

export function buildAss(cues) {
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 384
PlayResY: 288
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const body = cues.map((c) => `Dialogue: 0,${assTime(c.start)},${assTime(c.end)},Default,,0,0,0,,${assText(c.text)}`).join('\n');
  return header + body + '\n';
}

function sortCues(cues) {
  return cues.slice().sort((a, b) => a.start - b.start || a.end - b.end);
}

export async function convertSubtitle(file, target, params = {}, hooks = {}) {
  const ext = extOf(file.name);
  const base = baseName(file.name);
  const encoding = params.subtitleEncoding || 'utf-8';
  hooks.onStage && hooks.onStage('读取字幕…');
  const raw = await readText(file, encoding);
  let cues;
  if (ext === 'vtt') cues = parseVtt(raw);
  else if (ext === 'ass' || ext === 'ssa') cues = parseAss(raw);
  else cues = parseSrt(raw);
  if (!cues.length) throw new Error('未找到字幕条目，请检查文件格式或源编码');
  cues = sortCues(cues);

  hooks.onStage && hooks.onStage('生成 ' + target.toUpperCase() + '…');
  let text;
  if (target === 'vtt') text = buildVtt(cues);
  else if (target === 'ass') text = buildAss(cues);
  else if (target === 'txt') text = cues.map((c) => c.text).join('\n\n') + '\n';
  else text = buildSrt(cues);

  const same = ext === target;
  const name = base + (same ? '-converted' : '') + '.' + target;
  const blob = textBlob(text, target === 'vtt' ? 'text/vtt;charset=utf-8' : 'text/plain;charset=utf-8');
  return [{ name, blob, size: blob.size, extra: cues.length }];
}
