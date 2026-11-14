/* 音视频转换：把界面参数翻译成 ffmpeg 命令 */
import { runFFmpeg } from './ffmpeg.js';
import { baseName, extOf, mimeForExt } from './utils.js';

const AUDIO_OUT = new Set(['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'aiff', 'ac3', 'wma', 'mp2']);

const PCM_LE = { 16: 'pcm_s16le', 24: 'pcm_s24le', '32f': 'pcm_f32le' };
const PCM_BE = { 16: 'pcm_s16be', 24: 'pcm_s24be', '32f': 'pcm_f32be' };

function trimArgs(params) {
  const out = [];
  const start = (params.start || '').trim();
  const end = (params.end || '').trim();
  if (start) out.push('-ss', start);
  if (end) out.push('-to', end);
  return out;
}

function metadataArgs(params) {
  return [(params.metadata === 'strip' ? '-map_metadata' : '-map_metadata'),
    params.metadata === 'strip' ? '-1' : '0'];
}

function channelArgs(params, out) {
  if (params.sampleRate && params.sampleRate !== 'auto') out.push('-ar', params.sampleRate);
  if (params.channels === 'mono') out.push('-ac', '1');
  else if (params.channels === 'stereo') out.push('-ac', '2');
  else if (params.channels === '6') out.push('-ac', '6');
}

function audioArgs(target, params) {
  const p = params || {};
  const args = ['-vn'];
  const br = p.bitrate && p.bitrate !== 'auto' ? p.bitrate + 'k' : null;
  const depth = p.wavDepth || '16';
  switch (target) {
    case 'mp3':
      args.push('-c:a', 'libmp3lame');
      if (p.mp3Vbr && p.mp3Vbr !== 'off') args.push('-q:a', p.mp3Vbr);
      else if (br) args.push('-b:a', br);
      break;
    case 'wav':
      args.push('-c:a', PCM_LE[depth] || PCM_LE[16]);
      break;
    case 'flac':
      args.push('-c:a', 'flac');
      break;
    case 'ogg':
      args.push('-c:a', 'libvorbis', '-q:a', p.vorbisQuality || '5');
      break;
    case 'm4a':
      args.push('-c:a', 'aac');
      if (br) args.push('-b:a', br);
      args.push('-movflags', '+faststart');
      break;
    case 'aac':
      args.push('-c:a', 'aac', '-f', 'adts');
      if (br) args.push('-b:a', br);
      break;
    case 'aiff':
      args.push('-c:a', PCM_BE[depth] || PCM_BE[16], '-f', 'aiff');
      break;
    case 'ac3':
      args.push('-c:a', 'ac3');
      args.push('-b:a', br || '192k');
      break;
    case 'wma':
      args.push('-c:a', 'wmav2');
      if (br) args.push('-b:a', br);
      break;
    case 'mp2':
      args.push('-c:a', 'mp2');
      args.push('-b:a', br || '192k');
      break;
    default:
      args.push('-c:a', 'aac');
  }
  channelArgs(p, args);
  if (target !== 'wav' && target !== 'aiff') args.push(...metadataArgs(p));
  return args;
}

function videoCrf(quality, kind) {
  if (kind === 'vp8') return quality === 'high' ? 10 : quality === 'low' ? 32 : 20;
  return quality === 'high' ? 20 : quality === 'low' ? 32 : 26;
}

function videoArgs(target, params) {
  const p = params || {};
  const q = p.videoQuality || 'medium';
  const crf = videoCrf(q, target === 'webm' ? 'vp8' : 'x264');
  const abr = p.audioBitrate && p.audioBitrate !== 'auto' ? p.audioBitrate + 'k' : null;
  const args = ['-map', '0:v:0', '-map', '0:a:0?'];
  const res = p.resolution && p.resolution !== 'auto' ? p.resolution : null;
  const crop = (p.crop || '').trim();
  if (crop && !/^\d+:\d+:\d+:\d+$/.test(crop)) throw new Error('画面裁剪格式应为 宽:高:x:y，例如 640:480:0:0');

  if (target === 'gif') {
    const fps = p.fps && p.fps !== 'auto' ? p.fps : '12';
    const pre = [];
    if (crop) pre.push(`crop=${crop}`);
    pre.push(`fps=${fps}`);
    if (res) pre.push(`scale=-2:${res}:flags=lanczos`);
    args.length = 0;
    args.push(
      '-filter_complex',
      `[0:v]${pre.join(',')},split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer`,
      '-an',
      '-loop', '0'
    );
    return args;
  }

  const vf = [];
  if (crop) vf.push(`crop=${crop}`);
  if (res) vf.push(`scale=-2:${res}:flags=lanczos`);
  if (vf.length) args.push('-vf', vf.join(','));
  if (p.fps && p.fps !== 'auto') args.push('-r', p.fps);

  const pix = p.pixelFormat && p.pixelFormat !== 'auto' ? p.pixelFormat : 'yuv420p';
  const useMpeg4 = p.videoEncoder === 'mpeg4';
  const x264 = () => {
    args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(crf), '-pix_fmt', pix);
  };
  const mpeg4 = () => {
    args.push('-c:v', 'mpeg4', '-q:v', q === 'high' ? '2' : q === 'low' ? '8' : '5', '-pix_fmt', 'yuv420p');
  };

  switch (target) {
    case 'mp4':
    case 'mov':
      useMpeg4 ? mpeg4() : x264();
      args.push('-c:a', 'aac');
      if (abr) args.push('-b:a', abr);
      args.push('-movflags', '+faststart');
      break;
    case 'mkv':
      useMpeg4 ? mpeg4() : x264();
      args.push('-c:a', 'aac');
      if (abr) args.push('-b:a', abr);
      break;
    case 'webm':
      args.push('-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '8', '-b:v', '0', '-crf', String(crf));
      args.push('-c:a', 'libvorbis', '-q:a', '5');
      break;
    case 'avi':
      args.push('-c:v', 'mpeg4', '-q:v', q === 'high' ? '2' : q === 'low' ? '8' : '5');
      args.push('-c:a', 'libmp3lame');
      if (abr) args.push('-b:a', abr);
      break;
    case 'ts':
      x264();
      args.push('-c:a', 'aac', '-f', 'mpegts');
      if (abr) args.push('-b:a', abr);
      break;
    case 'flv':
      x264();
      args.push('-c:a', 'aac', '-f', 'flv');
      if (abr) args.push('-b:a', abr);
      break;
    case 'wmv':
      args.push('-c:v', 'wmv2', '-q:v', q === 'high' ? '2' : q === 'low' ? '8' : '5');
      args.push('-c:a', 'wmav2');
      if (abr) args.push('-b:a', abr);
      break;
    case '3gp':
      x264();
      args.push('-c:a', 'aac', '-f', '3gp');
      if (abr) args.push('-b:a', abr);
      break;
    case 'mpg':
      args.push('-c:v', 'mpeg1video', '-q:v', q === 'high' ? '2' : q === 'low' ? '8' : '5', '-pix_fmt', 'yuv420p');
      // MPEG-1 只接受 24/25/30/50/60 等标准帧率，其他帧率统一按 25 fps 输出
      if (!['24', '25', '30', '50', '60'].includes(p.fps)) args.push('-r', '25');
      args.push('-c:a', 'mp2', '-f', 'mpeg');
      if (abr) args.push('-b:a', abr);
      break;
    default:
      x264();
  }
  args.push(...metadataArgs(p));
  return args;
}

export async function convertMedia(job, hooks = {}) {
  const { file, category, target, params } = job;
  const ext = extOf(file.name);
  const inputName = 'in.' + (ext || 'bin');
  const outputName = 'out.' + target;
  const audioOut = (category === 'audio') || (category === 'video' && AUDIO_OUT.has(target));

  let args = ['-y', '-i', inputName];
  args.push(...trimArgs(params || {}));
  if (audioOut) args.push(...audioArgs(target, params));
  else args.push(...videoArgs(target, params));
  args.push(outputName);

  hooks.onStage && hooks.onStage('读取文件…');
  const data = await runFFmpeg({
    args,
    inputs: [{ name: inputName, data: new Uint8Array(await file.arrayBuffer()) }],
    outputName,
    hooks,
  });

  const same = ext === target;
  const outName = baseName(file.name) + (same ? '-converted' : '') + '.' + target;
  return [{ name: outName, blob: new Blob([data], { type: mimeForExt(target) }), size: data.length }];
}

export { AUDIO_OUT };
